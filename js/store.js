// Data layer. Two backends behind one API:
//  - local: localStorage (+ IndexedDB for images), single device.
//  - firebase: Firestore with live sync, Google sign-in, shared by the team.
// Writes are field-level patches ({ 'inv.cbc.hb': '11.2' }) so two people
// editing different parts of the same case never overwrite each other.
const Store = (() => {
  const CFG = window.WARD_CONFIG || {};
  const LS = 'wm.v1.';
  const COLLS = ['cases', 'implants', 'levels', 'meta'];
  const state = { cases: {}, implants: {}, levels: {}, meta: {}, members: {} };
  const subs = new Set();
  const imgCache = new Map();
  let fb = null;
  let user = null;
  let status = 'local';
  let unsubs = [];

  const mode = CFG.firebase ? 'firebase' : 'local';
  const emit = () => subs.forEach((f) => f());

  // ---- profile (per device) ----
  function profile() {
    try {
      return JSON.parse(localStorage.getItem(LS + 'profile')) || {};
    } catch {
      return {};
    }
  }
  function setProfile(p) {
    localStorage.setItem(LS + 'profile', JSON.stringify({ ...profile(), ...p }));
    emit();
  }
  function email() {
    return (user?.email || '').toLowerCase();
  }
  function who() {
    const m = state.members[email()];
    const p = profile();
    const name = p.name || m?.name || user?.displayName || email() || 'Me';
    const role = p.role || m?.role || '';
    return role ? `${name} (${role})` : name;
  }
  function isOwner() {
    return mode === 'local' || (CFG.ownerEmails || []).map((e) => e.toLowerCase()).includes(email());
  }

  // ---- local backend ----
  function loadLocal() {
    for (const k of COLLS) {
      try {
        state[k] = JSON.parse(localStorage.getItem(LS + k)) || {};
      } catch {
        state[k] = {};
      }
    }
    // Old saves: fold labs into dated sets; drop the starter implant list
    // and the activity log, which the unit no longer uses.
    for (const c of Object.values(state.cases)) {
      migrateCase(c);
      delete c.log;
    }
    for (const id of Object.keys(state.implants)) if (id.startsWith('seed')) delete state.implants[id];
    saveLocal('cases');
    saveLocal('implants');
    if (localStorage.getItem(LS + 'levels') === null) {
      state.levels = Object.fromEntries(SEED_LEVELS.map((r) => [r.id, { ...r }]));
      saveLocal('levels');
    }
  }
  function saveLocal(k) {
    if (mode !== 'local') return;
    try {
      localStorage.setItem(LS + k, JSON.stringify(state[k]));
    } catch {
      toast('Browser storage is full — export a backup and remove old cases.');
    }
  }

  let idbP = null;
  function idb() {
    idbP ||= new Promise((res, rej) => {
      const r = indexedDB.open('ward-images', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('images', { keyPath: 'id' });
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    return idbP;
  }
  async function idbDo(method, arg) {
    const db = await idb();
    return new Promise((res, rej) => {
      const tx = db.transaction('images', method === 'get' || method === 'getAll' ? 'readonly' : 'readwrite');
      const r = tx.objectStore('images')[method](arg);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }

  // ---- firebase backend ----
  async function initFirebase() {
    status = 'connecting';
    const base = 'https://www.gstatic.com/firebasejs/10.12.2/';
    const [appM, authM, fsM] = await Promise.all([
      import(base + 'firebase-app.js'),
      import(base + 'firebase-auth.js'),
      import(base + 'firebase-firestore.js'),
    ]);
    const app = appM.initializeApp(CFG.firebase);
    let db;
    try {
      db = fsM.initializeFirestore(app, {
        ignoreUndefinedProperties: true,
        localCache: fsM.persistentLocalCache({ tabManager: fsM.persistentMultipleTabManager() }),
      });
    } catch {
      db = fsM.getFirestore(app);
    }
    fb = { authM, fsM, auth: authM.getAuth(app), db, unit: CFG.unitId || 'ortho-unit-1' };
    if (CFG.emulators) {
      // Local test setup only (firebase emulators:start).
      authM.connectAuthEmulator(fb.auth, 'http://127.0.0.1:9099', { disableWarnings: true });
      fsM.connectFirestoreEmulator(db, '127.0.0.1', 8080);
    }
    authM.onAuthStateChanged(fb.auth, (u) => {
      user = u;
      stopListening();
      if (!u) status = 'signed-out';
      // Password accounts must confirm their email first (the database rules
      // only admit verified addresses, so nobody can borrow a colleague's).
      else if (!u.emailVerified) status = 'unverified';
      else listen();
      emit();
    });
  }

  const ref = (coll, id) => fb.fsM.doc(fb.db, 'units', fb.unit, coll, id);
  const collRef = (coll) => fb.fsM.collection(fb.db, 'units', fb.unit, coll);

  function listen() {
    status = 'connecting';
    let seededLevels = false;
    for (const coll of [...COLLS, 'members']) {
      unsubs.push(fb.fsM.onSnapshot(collRef(coll), { includeMetadataChanges: false }, (snap) => {
        const m = {};
        snap.forEach((d) => { m[d.id] = coll === 'cases' ? migrateCase(d.data()) : d.data(); });
        state[coll] = m;
        status = 'ok';
        // First connection for the unit: load the WOPL level list once.
        if (coll === 'levels' && snap.empty && !snap.metadata.fromCache && !seededLevels) {
          seededLevels = true;
          SEED_LEVELS.forEach((r) => fb.fsM.setDoc(ref('levels', r.id), r));
        }
        emit();
      }, (err) => {
        status = err.code === 'permission-denied' ? 'denied' : 'error: ' + err.code;
        emit();
      }));
    }
  }
  function stopListening() {
    unsubs.forEach((u) => u());
    unsubs = [];
    for (const k of [...COLLS, 'members']) state[k] = {};
  }

  async function signIn() {
    const p = new fb.authM.GoogleAuthProvider();
    try {
      await fb.authM.signInWithPopup(fb.auth, p);
    } catch (e) {
      if (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment') {
        await fb.authM.signInWithRedirect(fb.auth, p);
      } else {
        throw e;
      }
    }
  }

  async function signInEmail(mail, password) {
    await fb.authM.signInWithEmailAndPassword(fb.auth, mail.trim(), password);
  }
  async function signUpEmail(mail, password) {
    const cred = await fb.authM.createUserWithEmailAndPassword(fb.auth, mail.trim(), password);
    await fb.authM.sendEmailVerification(cred.user);
  }
  async function resendVerification() {
    if (fb.auth.currentUser) await fb.authM.sendEmailVerification(fb.auth.currentUser);
  }
  async function resetPassword(mail) {
    await fb.authM.sendPasswordResetEmail(fb.auth, mail.trim());
  }
  // After the person clicks the link in their inbox.
  async function recheckVerified() {
    const u = fb.auth.currentUser;
    if (!u) return;
    await u.reload();
    await u.getIdToken(true); // fresh token carries email_verified for the rules
    user = fb.auth.currentUser;
    if (user.emailVerified) {
      stopListening();
      listen();
    }
    emit();
  }

  // Cases typed on this device before sharing was switched on.
  function localLeftovers() {
    const out = {};
    for (const k of COLLS) {
      try { out[k] = JSON.parse(localStorage.getItem(LS + k)) || {}; } catch { out[k] = {}; }
    }
    return out;
  }
  async function uploadLocal() {
    const data = localLeftovers();
    Object.values(data.cases).forEach(migrateCase);
    let images = [];
    try { images = await idbDo('getAll'); } catch { /* no local images */ }
    for (const coll of COLLS) {
      for (const [id, doc] of Object.entries(data[coll])) await fb.fsM.setDoc(ref(coll, id), doc, { merge: true });
    }
    for (const img of images) await fb.fsM.setDoc(ref('images', img.id), img);
    for (const k of ['cases', 'implants', 'levels']) localStorage.setItem(LS + k + '.uploaded', localStorage.getItem(LS + k) || '{}');
    for (const k of ['cases', 'implants', 'levels', 'meta']) localStorage.removeItem(LS + k);
    return Object.keys(data.cases).length;
  }

  function remoteFail(e) {
    console.error(e);
    toast('Could not save: ' + (e.code || e.message));
  }

  // ---- public write API ----
  function create(coll, id, data) {
    const now = Date.now();
    const doc = { ...data, createdAt: now, createdBy: who(), updatedAt: now, updatedBy: who() };
    state[coll][id] = doc;
    saveLocal(coll);
    emit();
    if (fb) return fb.fsM.setDoc(ref(coll, id), doc).catch(remoteFail);
  }

  function patch(coll, id, changes) {
    const doc = state[coll][id];
    if (!doc) return;
    const all = { ...changes, updatedAt: Date.now(), updatedBy: who() };
    for (const [p, v] of Object.entries(all)) setPath(doc, p, v);
    saveLocal(coll);
    emit();
    if (fb) {
      const upd = {};
      for (const [p, v] of Object.entries(all)) upd[p] = v === DELETE ? fb.fsM.deleteField() : (v ?? null);
      return fb.fsM.updateDoc(ref(coll, id), upd).catch(remoteFail);
    }
  }

  function remove(coll, id) {
    delete state[coll][id];
    saveLocal(coll);
    emit();
    if (fb) return fb.fsM.deleteDoc(ref(coll, id)).catch(remoteFail);
  }

  // ---- images (stored apart from the case so lists stay light) ----
  async function addImage(caseId, kind, dataUrl, caption = '') {
    const id = uid();
    const rec = { id, caseId, kind, data: dataUrl, caption, at: Date.now(), by: who() };
    if (fb) await fb.fsM.setDoc(ref('images', id), rec);
    else await idbDo('put', rec);
    imgCache.set(id, dataUrl);
    await patch('cases', caseId, { ['images.' + id]: { kind, caption, at: rec.at, by: rec.by } });
  }
  async function getImage(id) {
    if (imgCache.has(id)) return imgCache.get(id);
    let rec;
    if (fb) rec = (await fb.fsM.getDoc(ref('images', id))).data();
    else rec = await idbDo('get', id);
    if (rec) imgCache.set(id, rec.data);
    return rec?.data;
  }
  async function deleteImage(caseId, id) {
    if (fb) await fb.fsM.deleteDoc(ref('images', id)).catch(remoteFail);
    else await idbDo('delete', id);
    imgCache.delete(id);
    await patch('cases', caseId, { ['images.' + id]: DELETE });
  }

  // ---- team (shared mode) ----
  function addMember(mail, name, role) {
    mail = mail.trim().toLowerCase();
    if (!fb || !mail) return;
    return fb.fsM.setDoc(ref('members', mail), { email: mail, name, role, addedBy: who(), at: Date.now() }).catch(remoteFail);
  }
  function removeMember(mail) {
    if (fb) return fb.fsM.deleteDoc(ref('members', mail)).catch(remoteFail);
  }

  // ---- backup ----
  async function exportAll() {
    const images = fb ? [] : await idbDo('getAll');
    return { app: 'ward-management', version: 1, exportedAt: new Date().toISOString(), cases: state.cases, implants: state.implants, levels: state.levels, meta: state.meta, images };
  }
  async function importAll(data) {
    for (const coll of COLLS) {
      for (const [id, doc] of Object.entries(data[coll] || {})) {
        state[coll][id] = doc;
        if (fb) await fb.fsM.setDoc(ref(coll, id), doc);
      }
      saveLocal(coll);
    }
    for (const img of data.images || []) {
      if (fb) await fb.fsM.setDoc(ref('images', img.id), img);
      else await idbDo('put', img);
    }
    emit();
  }

  async function init() {
    if (mode === 'local') {
      loadLocal();
      emit();
      return;
    }
    try {
      await initFirebase();
    } catch (e) {
      console.error(e);
      status = 'error: could not load Firebase (offline?)';
      emit();
    }
  }

  return {
    DELETE,
    init,
    subscribe: (f) => subs.add(f),
    get mode() { return mode; },
    get status() { return status; },
    get user() { return user; },
    get cases() { return state.cases; },
    get implants() { return state.implants; },
    get levels() { return state.levels; },
    get meta() { return { ...DEFAULT_META, ...(state.meta.main || {}) }; },
    get members() { return state.members; },
    setMeta: (changes) => {
      if (!state.meta.main) create('meta', 'main', {});
      return patch('meta', 'main', changes);
    },
    who, isOwner, profile, setProfile, signIn,
    signInEmail, signUpEmail, resendVerification, resetPassword, recheckVerified,
    localCaseCount: () => Object.keys(localLeftovers().cases).length,
    uploadLocal,
    signOut: () => fb && fb.authM.signOut(fb.auth),
    create, patch, remove,
    addImage, getImage, deleteImage,
    addMember, removeMember,
    exportAll, importAll,
  };
})();
