// Data layer. Two backends behind one API:
//  - local: localStorage (+ IndexedDB for images), single device.
//  - firebase: Firestore with live sync, Google sign-in, shared by the team.
// Writes are field-level patches ({ 'inv.cbc.hb': '11.2' }) so two people
// editing different parts of the same case never overwrite each other.
const Store = (() => {
  const CFG = window.WARD_CONFIG || {};
  // Guest demo (temporary, js/demo.js): sample patients in this browser only, kept apart from real data.
  const guest = (() => { try { return localStorage.getItem('wm.guest') === '1'; } catch { return false; } })();
  const LS = guest ? 'wm.guest.' : 'wm.v1.';
  const COLLS = ['cases', 'implants', 'levels', 'meta', 'updates'];
  const state = { cases: {}, implants: {}, levels: {}, meta: {}, members: {}, updates: {} };
  const subs = new Set();
  const imgCache = new Map();
  let fb = null;
  let user = null;
  let status = 'local';
  const syncFresh = {}; // collections that have arrived from the server (not just the offline cache)
  let unsubs = [];

  // Firebase sign-in needs a real web address; a downloaded copy opened as a
  // file stays in local mode.
  const mode = !guest && CFG.firebase && location.protocol.startsWith('http') ? 'firebase' : 'local';
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
    // The unit's implant list, loaded once (kept if later edited or deleted).
    const seed = state.meta.main?.implantSeed;
    if (seed !== UNIT_IMPLANTS_VERSION) {
      if (!seed) for (const r of UNIT_IMPLANTS) if (!state.implants[r.id]) state.implants[r.id] = { ...r };
      if (seed === 'ot2') implantUpgrade((id) => delete state.implants[id], (id, ch) => Object.assign(state.implants[id], ch));
      state.meta.main = { ...(state.meta.main || {}), implantSeed: UNIT_IMPLANTS_VERSION };
      saveLocal('implants');
      saveLocal('meta');
    }
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
      const r = indexedDB.open(guest ? 'ward-images-guest' : 'ward-images', 1);
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

  // ---- this phone's copy of the shared images (so they open with poor or no network) ----
  let cdbP = null;
  function cdb() {
    cdbP ||= new Promise((res, rej) => {
      const r = indexedDB.open('ward-img-cache', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('images', { keyPath: 'id' });
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    return cdbP;
  }
  async function cacheDo(method, arg) {
    const db = await cdb();
    return new Promise((res, rej) => {
      const tx = db.transaction('images', ['get', 'getAll', 'getAllKeys'].includes(method) ? 'readonly' : 'readwrite');
      const r = tx.objectStore('images')[method](arg);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }
  let savedIds = null; // ids kept on this phone
  let savedP = null;
  function loadSaved() {
    savedP ||= cacheDo('getAllKeys').then((k) => { savedIds = new Set(k); }).catch(() => { savedIds = new Set(); });
    return savedP;
  }
  async function keep(id, data) {
    try {
      await cacheDo('put', { id, data, at: Date.now() });
      (savedIds ||= new Set()).add(id);
    } catch { /* phone storage full: still shown this time */ }
  }
  // From the server, waiting at most `ms` (a bad signal can otherwise hang for a long time).
  const imgRef = (id, unit) => (unit && unit !== fb.unit ? fb.fsM.doc(fb.db, 'units', unit, 'images', id) : ref('images', id));
  async function fetchRemote(id, ms = 20000, unit) {
    const get = fb.fsM.getDoc(imgRef(id, unit)).then((d) => {
      const rec = d.data();
      if (rec?.data) return rec.data;
      return rec?.url ? urlToData(rec.url) : null; // moved to Firebase Storage
    }).catch(() => null);
    return Promise.race([get, new Promise((res) => setTimeout(() => res(null), ms))]);
  }

  // ---- Photos in Firebase Storage (switched on per unit by an owner: meta.photoStore = { on, bucket }) ----
  // The database keeps a small record { id, caseId, kind, url, path, … }; the picture itself is a file in Storage.
  const photoStore = () => { const ps = state.meta.main?.photoStore; return fb && ps?.on && ps.bucket ? ps : null; };
  let storageMods = null;
  async function storageFor(bucket) {
    storageMods ||= await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js');
    return { st: storageMods.getStorage(fb.app, `gs://${String(bucket).replace(/^gs:\/\//, '')}`), sM: storageMods };
  }
  function dataToBlob(dataUrl) {
    const [head, b64] = String(dataUrl).split(',');
    const type = (head.match(/data:([^;]+)/) || [])[1] || 'image/jpeg';
    const bin = atob(b64);
    const u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return new Blob([u], { type });
  }
  async function urlToData(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`photo download failed (${r.status})`);
    const blob = await r.blob();
    return new Promise((res, rej) => { const f = new FileReader(); f.onload = () => res(f.result); f.onerror = rej; f.readAsDataURL(blob); });
  }
  const photoPath = (unit, caseId, id) => `units/${unit}/images/${caseId}/${id}.jpg`;
  async function uploadPhoto(bucket, unit, caseId, id, dataUrl) {
    const { st, sM } = await storageFor(bucket);
    const path = photoPath(unit, caseId, id);
    const r = sM.ref(st, path);
    await sM.uploadBytes(r, dataToBlob(dataUrl), { contentType: 'image/jpeg', cacheControl: 'private, max-age=31536000' });
    return { path, url: await sM.getDownloadURL(r) };
  }
  // Settings → Photo storage → Test: upload a tiny picture, read it back through its link, delete it.
  async function testPhotoStore(bucket) {
    if (!fb) throw new Error('Only in shared mode');
    const c = document.createElement('canvas');
    c.width = 8; c.height = 8;
    const dataUrl = c.toDataURL('image/jpeg', 0.5);
    const { st, sM } = await storageFor(bucket);
    const r = sM.ref(st, `units/${fb.unit}/images/_test/${uid()}.jpg`);
    try { await sM.uploadBytes(r, dataToBlob(dataUrl), { contentType: 'image/jpeg' }); } catch (e) { throw new Error(`upload refused (${e.code || e.message}) — is Storage set up and are its rules published?`); }
    let back;
    try { back = await urlToData(await sM.getDownloadURL(r)); } catch (e) { throw new Error(`uploaded, but the app can't read it back (${e.message}) — the CORS step hasn't been done yet`); } finally { sM.deleteObject(r).catch(() => {}); }
    if (!String(back).startsWith('data:image')) throw new Error('read back something that is not a picture');
    return true;
  }
  // Owner: switch photo storage on / off for every unit (each unit's settings)
  async function setPhotoStore(ps) {
    if (!fb) return;
    for (const u of UNIT_KEYS) await fb.fsM.setDoc(fb.fsM.doc(fb.db, 'units', u, 'meta', 'main'), { photoStore: ps }, { merge: true });
  }
  // Move one unit's photos out of the database into Storage. Resumable: photos already moved are skipped.
  async function movePhotos(unit, bucket, onProgress) {
    if (!fb) throw new Error('Only in shared mode');
    const caseDocs = unit === fb.unit ? Object.entries(state.cases) : [];
    if (unit !== fb.unit) (await fb.fsM.getDocs(fb.fsM.collection(fb.db, 'units', unit, 'cases'))).forEach((d) => caseDocs.push([d.id, d.data()]));
    const todo = caseDocs.flatMap(([cid, c]) => Object.keys(c.images || {}).map((iid) => [cid, iid]));
    let moved = 0;
    let skipped = 0;
    let failed = 0;
    for (const [i, [cid, iid]] of todo.entries()) {
      try {
        const dref = fb.fsM.doc(fb.db, 'units', unit, 'images', iid);
        const snap = await fb.fsM.getDoc(dref);
        const rec = snap.data();
        if (!rec || !rec.data) { skipped++; } else {
          const { path, url } = await uploadPhoto(bucket, unit, rec.caseId || cid, iid, rec.data);
          await fb.fsM.updateDoc(dref, { url, path, data: fb.fsM.deleteField() });
          moved++;
        }
      } catch (e) { failed++; console.warn('move photo', iid, e); }
      onProgress?.({ done: i + 1, total: todo.length, moved, skipped, failed });
    }
    return { total: todo.length, moved, skipped, failed };
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
    fb = { app, authM, fsM, auth: authM.getAuth(app), db, unit: CFG.unitId || 'ortho-unit-1' };
    if (CFG.emulators) {
      // Local test setup only (firebase emulators:start).
      authM.connectAuthEmulator(fb.auth, 'http://127.0.0.1:9099', { disableWarnings: true });
      fsM.connectFirestoreEmulator(db, '127.0.0.1', 8080);
    }
    authM.onAuthStateChanged(fb.auth, (u) => {
      user = u;
      unitKnown = false;
      stopListening();
      if (!u) status = 'signed-out';
      // Password accounts must confirm their email first (the database rules
      // only admit verified addresses, so nobody can borrow a colleague's).
      else if (!u.emailVerified) status = 'unverified';
      else {
        status = 'connecting';
        chooseUnit().then((ok) => {
          if (user !== u) return; // signed out meanwhile
          if (ok) { unitKnown = true; listen(); }
          else status = 'denied';
          emit();
        });
      }
      emit();
    });
  }

  // ---- units: each of the department's units has its own data (units/ortho-unit-N) ----
  // Everyone belongs to exactly one unit (its Settings → Team list); the app finds it at sign-in.
  // Owners (config.js ownerEmails) look after all units and can switch.
  const UNIT_KEYS = UNITS.map((u, i) => `ortho-unit-${i + 1}`);
  const unitSaveKey = () => `wm.unit.${email()}`;
  const memberRef = (unit, mail) => fb.fsM.doc(fb.db, 'units', unit, 'members', mail);
  const peopleRef = (mail) => fb.fsM.doc(fb.db, 'people', mail);
  async function isIn(unit) {
    try { return (await fb.fsM.getDoc(memberRef(unit, email()))).exists(); } catch { return false; }
  }
  async function chooseUnit() {
    let saved = '';
    try { saved = localStorage.getItem(unitSaveKey()) || ''; } catch { /* private mode */ }
    if (isOwner()) {
      fb.unit = UNIT_KEYS.includes(saved) ? saved : (CFG.unitId || UNIT_KEYS[0]);
      return true;
    }
    if (UNIT_KEYS.includes(saved)) {
      // open at once (works offline); if they have since moved to another unit, follow them
      fb.unit = saved;
      isIn(saved).then(async (ok) => {
        if (ok || !navigator.onLine) return;
        try { localStorage.removeItem(unitSaveKey()); } catch { /* ignore */ }
        const next = await findUnit();
        if (next && next !== fb.unit) switchUnit(next);
      });
      return true;
    }
    const found = await findUnit();
    if (!found) return false;
    fb.unit = found;
    try { localStorage.setItem(unitSaveKey(), found); } catch { /* ignore */ }
    return true;
  }
  async function findUnit() {
    const hits = await Promise.all(UNIT_KEYS.map(isIn));
    return UNIT_KEYS[hits.findIndex(Boolean)] || null;
  }
  function switchUnit(unit) {
    if (!fb || !UNIT_KEYS.includes(unit) || unit === fb.unit) return;
    stopListening();
    for (const k of Object.keys(syncFresh)) delete syncFresh[k];
    fb.unit = unit;
    try { localStorage.setItem(unitSaveKey(), unit); localStorage.removeItem(LS + 'otDraft'); } catch { /* ignore */ }
    listen();
    emit();
  }
  const unitIndex = () => Math.max(0, UNIT_KEYS.indexOf(fb?.unit));
  let unitKnown = false; // the signed-in person's unit has been worked out

  const ref = (coll, id) => fb.fsM.doc(fb.db, 'units', fb.unit, coll, id);
  const collRef = (coll) => fb.fsM.collection(fb.db, 'units', fb.unit, coll);

  function listen() {
    status = 'connecting';
    let seededLevels = false;
    const fresh = syncFresh;
    const seen = {};
    let implantSeedChecked = false;
    const maybeSeedImplants = () => {
      if (implantSeedChecked || !fresh.implants || !fresh.meta) return;
      implantSeedChecked = true;
      const seed = state.meta.main?.implantSeed;
      if (seed === UNIT_IMPLANTS_VERSION) return;
      if (!seed) for (const r of UNIT_IMPLANTS) if (!state.implants[r.id]) fb.fsM.setDoc(ref('implants', r.id), r);
      if (seed === 'ot2') implantUpgrade((id) => fb.fsM.deleteDoc(ref('implants', id)), (id, ch) => fb.fsM.updateDoc(ref('implants', id), ch));
      fb.fsM.setDoc(ref('meta', 'main'), { implantSeed: UNIT_IMPLANTS_VERSION }, { merge: true });
    };
    for (const coll of [...COLLS, 'members']) {
      // includeMetadataChanges: with the offline cache, the first snapshot comes from the cache
      // and, if nothing changed, the server's confirmation arrives only as a metadata change.
      // That is how we learn the data is current (Store.synced); data-free updates are not re-rendered.
      unsubs.push(fb.fsM.onSnapshot(collRef(coll), { includeMetadataChanges: true }, (snap) => {
        const metaOnly = seen[coll] && snap.docChanges().length === 0;
        if (metaOnly) {
          if (!snap.metadata.fromCache && !fresh[coll]) { fresh[coll] = true; maybeSeedImplants(); emit(); }
          return;
        }
        const m = {};
        snap.forEach((d) => { m[d.id] = coll === 'cases' ? migrateCase(d.data()) : d.data(); });
        state[coll] = m;
        seen[coll] = true;
        status = 'ok';
        if (!snap.metadata.fromCache) { fresh[coll] = true; maybeSeedImplants(); backfillPeople(); }
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

  async function signInEmail(mail, password, remember = true) {
    if (fb.authM.setPersistence) await fb.authM.setPersistence(fb.auth, remember ? fb.authM.browserLocalPersistence : fb.authM.browserSessionPersistence).catch(() => {});
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
      status = 'connecting';
      emit();
      status = (await chooseUnit()) ? (unitKnown = true, listen(), 'connecting') : 'denied';
    }
    emit();
  }

  // ot2 → ot2b: drop the removed entries; short/long PFN no longer pulls both.
  function implantUpgrade(del, upd) {
    for (const id of UNIT_IMPLANTS_REMOVED) if (state.implants[id]) del(id);
    for (const r of UNIT_IMPLANTS.filter((x) => x.id === 'ot2_10' || x.id === 'ot2_11')) if (state.implants[r.id]) upd(r.id, { keywords: r.keywords });
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
    let rec = { id, caseId, kind, data: dataUrl, caption, at: Date.now(), by: who() };
    if (fb) {
      const ps = photoStore();
      if (ps) {
        try {
          const { path, url } = await uploadPhoto(ps.bucket, fb.unit, caseId, id, dataUrl);
          rec = { id, caseId, kind, url, path, caption, at: rec.at, by: rec.by };
        } catch (e) { console.warn('photo storage upload failed — kept in the database instead', e); }
      }
      await fb.fsM.setDoc(ref('images', id), rec);
      keep(id, dataUrl);
    } else await idbDo('put', rec);
    imgCache.set(id, dataUrl);
    await patch('cases', caseId, { ['images.' + id]: { kind, caption, at: rec.at, by: rec.by } });
  }
  const inFlight = new Map();
  async function getImage(id, unit) {
    if (imgCache.has(id)) return imgCache.get(id);
    if (!fb) {
      const rec = await idbDo('get', id);
      if (rec) imgCache.set(id, rec.data);
      return rec?.data;
    }
    if (inFlight.has(id)) return inFlight.get(id);
    const p = (async () => {
      // 1. this phone's copy, 2. Firestore's offline copy, 3. the server
      let data = (await cacheDo('get', id).catch(() => null))?.data;
      if (!data) data = await fb.fsM.getDocFromCache(imgRef(id, unit)).then((d) => d.data()?.data).catch(() => null);
      if (!data) data = await fetchRemote(id, 20000, unit);
      if (data) {
        imgCache.set(id, data);
        if (!savedIds?.has(id)) keep(id, data);
      }
      return data;
    })().finally(() => inFlight.delete(id));
    inFlight.set(id, p);
    return p;
  }
  // Save these images on this phone ahead of time (not kept in memory). Returns how many are saved.
  async function saveOffline(ids, onProgress) {
    if (!fb) return { saved: ids.length, total: ids.length, failed: 0 };
    await loadSaved();
    const todo = ids.filter((id) => !savedIds.has(id));
    let failed = 0;
    const work = async () => {
      while (todo.length) {
        const id = todo.shift();
        let data = imgCache.get(id) || await fb.fsM.getDocFromCache(ref('images', id)).then((d) => d.data()?.data).catch(() => null);
        if (!data) data = await fetchRemote(id, 30000);
        if (data) await keep(id, data); else failed++;
        onProgress?.();
      }
    };
    await Promise.all([work(), work(), work()]);
    return { saved: ids.filter((id) => savedIds.has(id)).length, total: ids.length, failed };
  }
  // Drop saved images that no longer belong to a case on the lists.
  async function pruneOffline(keepIds) {
    if (!fb) return;
    await loadSaved();
    const want = new Set(keepIds);
    for (const id of [...savedIds]) {
      if (want.has(id)) continue;
      await cacheDo('delete', id).catch(() => {});
      savedIds.delete(id);
    }
  }
  async function deleteImage(caseId, id) {
    if (fb) {
      const path = await fb.fsM.getDoc(ref('images', id)).then((d) => d.data()?.path).catch(() => null);
      if (path) storageFor(photoStore()?.bucket || state.meta.main?.photoStore?.bucket || '').then(({ st, sM }) => sM.deleteObject(sM.ref(st, path))).catch(() => {});
      await fb.fsM.deleteDoc(ref('images', id)).catch(remoteFail);
      cacheDo('delete', id).catch(() => {});
      savedIds?.delete(id);
    } else await idbDo('delete', id);
    imgCache.delete(id);
    await patch('cases', caseId, { ['images.' + id]: DELETE });
  }

  // ---- a specialty's cases from every unit (the rules let a specialty unit read only those) ----
  async function specCases(spec) {
    if (!fb) return Object.entries(state.cases).filter(([, c]) => (c.specs || []).includes(spec)).map(([id, c]) => ({ id, unit: '', ...c }));
    const out = [];
    const failed = [];
    await Promise.all(UNIT_KEYS.map(async (u) => {
      try {
        const snap = await fb.fsM.getDocs(fb.fsM.query(fb.fsM.collection(fb.db, 'units', u, 'cases'), fb.fsM.where('specs', 'array-contains', spec)));
        snap.forEach((d) => out.push({ id: d.id, unit: u, ...migrateCase(d.data()) }));
      } catch (e) { failed.push(u); console.warn('specialty cases', u, e.code || e); }
    }));
    out.failed = failed;
    return out;
  }

  // ---- Records: a receipt for every document generated (its frozen inputs), so it can be rebuilt later ----
  const REC_LS = LS + 'records';
  const recLocal = () => { try { return JSON.parse(localStorage.getItem(REC_LS)) || {}; } catch { return {}; } };
  async function addRecord(rec) {
    const id = rec.id || uid(); // the same document made again the same day replaces its record
    const doc = { ...rec, id, at: Date.now(), by: who(), unit: fb ? fb.unit : '' };
    if (!fb) {
      const all = recLocal();
      all[id] = doc;
      try { localStorage.setItem(REC_LS, JSON.stringify(all)); } catch { /* full */ }
      return doc;
    }
    await fb.fsM.setDoc(ref('records', id), doc);
    return doc;
  }
  // records dated from..to (YYYY-MM-DD) of the given units (default: this unit)
  async function records(from, to, units) {
    if (!fb) return Object.values(recLocal()).filter((r) => r.date >= from && r.date <= to);
    const out = [];
    const failed = [];
    await Promise.all((units || [fb.unit]).map(async (u) => {
      try {
        const q = fb.fsM.query(fb.fsM.collection(fb.db, 'units', u, 'records'), fb.fsM.where('date', '>=', from), fb.fsM.where('date', '<=', to));
        (await fb.fsM.getDocs(q)).forEach((d) => out.push({ ...d.data(), id: d.id, unit: u }));
      } catch (e) { failed.push(u); console.warn('records', u, e.code || e); }
    }));
    out.failed = failed;
    return out;
  }
  async function caseRecords(caseId) {
    if (!fb) return Object.values(recLocal()).filter((r) => (r.caseIds || []).includes(caseId));
    const q = fb.fsM.query(fb.fsM.collection(fb.db, 'units', fb.unit, 'records'), fb.fsM.where('caseIds', 'array-contains', caseId));
    const out = [];
    (await fb.fsM.getDocs(q)).forEach((d) => out.push({ ...d.data(), id: d.id, unit: fb.unit }));
    return out;
  }

  // ---- every case of the given units (owners: all six, for the department census) ----
  async function unitsCases(units = UNIT_KEYS) {
    if (!fb) return Object.entries(state.cases).map(([id, c]) => ({ id, unit: '', ...c }));
    const out = [];
    const failed = [];
    await Promise.all(units.map(async (u) => {
      try {
        const snap = await fb.fsM.getDocs(fb.fsM.collection(fb.db, 'units', u, 'cases'));
        snap.forEach((d) => out.push({ id: d.id, unit: u, ...migrateCase(d.data()) }));
      } catch (e) { failed.push(u); console.warn('census cases', u, e.code || e); }
    }));
    out.failed = failed;
    return out;
  }

  // ---- scheme status of each OT list, for Unit VI's weekly scheme report ----
  // one document per unit and OT date: schemeReports/ortho-unit-N_YYYY-MM-DD
  const SCHEME_LS = LS + 'schemeReports';
  // keep: an update of a list already sent (its sender and time stay)
  async function saveSchemeReport(rep, keep = false) {
    const unit = fb ? fb.unit : 'local';
    const doc = keep ? { ...rep, unit } : { ...rep, unit, by: who(), at: Date.now() };
    const id = `${unit}_${rep.date}`;
    if (!fb) {
      let all = {};
      try { all = JSON.parse(localStorage.getItem(SCHEME_LS)) || {}; } catch { /* ignore */ }
      all[id] = doc;
      localStorage.setItem(SCHEME_LS, JSON.stringify(all));
      return;
    }
    await fb.fsM.setDoc(fb.fsM.doc(fb.db, 'schemeReports', id), doc);
  }
  // this unit's own lists since `from` (to keep their scheme status current)
  async function mySchemeReports(from) {
    if (!fb) return (await schemeReports(from, '9999')).filter((r) => r.unit === 'local');
    // one filter only (unit): a unit + date-range query would need a composite index in the console
    const snap = await fb.fsM.getDocs(fb.fsM.query(fb.fsM.collection(fb.db, 'schemeReports'), fb.fsM.where('unit', '==', fb.unit)));
    const out = [];
    snap.forEach((d) => { const r = d.data(); if (r.date >= from) out.push(r); });
    return out;
  }
  async function schemeReports(from, to) {
    if (!fb) {
      let all = {};
      try { all = JSON.parse(localStorage.getItem(SCHEME_LS)) || {}; } catch { /* ignore */ }
      return Object.values(all).filter((r) => r.date >= from && r.date <= to);
    }
    const snap = await fb.fsM.getDocs(fb.fsM.query(fb.fsM.collection(fb.db, 'schemeReports'), fb.fsM.where('date', '>=', from), fb.fsM.where('date', '<=', to)));
    const out = [];
    snap.forEach((d) => out.push(d.data()));
    return out;
  }

  // ---- team (shared mode) ----
  // The member's doc in this unit and their entry in the department directory are written together;
  // the database rules refuse it if they are already on another unit's team.
  async function addMember(mail, name, role, admin = false) {
    mail = mail.trim().toLowerCase();
    if (!fb || !mail) return false;
    const at = Date.now();
    const b = fb.fsM.writeBatch(fb.db);
    b.set(ref('members', mail), { email: mail, name, role, admin: !!admin, addedBy: who(), at });
    b.set(peopleRef(mail), { email: mail, unit: fb.unit, name, role, admin: !!admin, addedBy: who(), at });
    try {
      await b.commit();
      return true;
    } catch (e) {
      console.error(e);
      toast(e.code === 'permission-denied'
        ? `Couldn't add ${mail}: they are already on another unit's team (or you aren't this unit's admin). They must be removed there first.`
        : 'Could not add: ' + (e.code || e.message), 7000);
      return false;
    }
  }
  async function removeMember(mail) {
    if (!fb) return;
    const b = fb.fsM.writeBatch(fb.db);
    b.delete(ref('members', mail));
    b.delete(peopleRef(mail));
    return b.commit().catch(remoteFail);
  }
  function setRole(mail, role) {
    if (!fb) return;
    const b = fb.fsM.writeBatch(fb.db);
    b.update(ref('members', mail), { role });
    b.set(peopleRef(mail), { email: mail, unit: fb.unit, role }, { merge: true });
    return b.commit().catch(remoteFail);
  }
  function setAdmin(mail, admin) {
    if (!fb) return;
    const b = fb.fsM.writeBatch(fb.db);
    b.update(ref('members', mail), { admin: !!admin });
    b.set(peopleRef(mail), { email: mail, unit: fb.unit, admin: !!admin }, { merge: true });
    return b.commit().catch(remoteFail);
  }
  // Team lists made before units: put them in the department directory once (owner's phone).
  function backfillPeople() {
    if (!isOwner() || !syncFresh.members || !syncFresh.meta || state.meta.main?.peopleV1) return;
    for (const m of Object.values(state.members)) {
      if (m.email) fb.fsM.setDoc(peopleRef(m.email), { email: m.email, unit: fb.unit, name: m.name || '', role: m.role || '', admin: !!m.admin }, { merge: true }).catch(() => {});
    }
    patch('meta', 'main', { peopleV1: true });
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
    get guest() { return guest; },
    get status() { return status; },
    // true once cases and meta are known up to date (always in local mode)
    get synced() { return mode === 'local' || !!(syncFresh.cases && syncFresh.meta); },
    get user() { return user; },
    get cases() { return state.cases; },
    get implants() { return state.implants; },
    get levels() { return state.levels; },
    // In shared mode the unit is the one signed in to, whatever an old setting says.
    get meta() { return { ...DEFAULT_META, ...(state.meta.main || {}), ...(fb ? { unitId: UNITS[unitIndex()].id } : {}) }; },
    get unitKey() { return fb?.unit || ''; },
    // shared mode: true once the unit is known (until then nothing should say "Unit I")
    get unitKnown() { return mode === 'local' || unitKnown; },
    unitKeys: UNIT_KEYS,
    switchUnit,
    canManageTeam: () => mode === 'local' || isOwner() || state.members[email()]?.admin === true,
    get members() { return state.members; },
    // What house surgeons (and others) saved: { caseId, name, text, by, email, role, at }
    get updates() { return state.updates; },
    // This person's role on the unit's team list (or what they set on this phone).
    get myRole() { return state.members[email()]?.role || profile().role || ''; },
    get myEmail() { return email(); },
    setMeta: (changes) => {
      if (!state.meta.main) create('meta', 'main', {});
      return patch('meta', 'main', changes);
    },
    who, isOwner, profile, setProfile, signIn,
    signInEmail, signUpEmail, resendVerification, resetPassword, recheckVerified,
    localCaseCount: () => Object.keys(localLeftovers().cases).length,
    uploadLocal,
    signOut: () => fb && fb.authM.signOut(fb.auth),
    // The signed-in person's Firebase ID token (for the WhatsApp bot to check they are on the team).
    idToken: () => (fb?.auth.currentUser ? fb.auth.currentUser.getIdToken() : Promise.resolve(null)),
    create, patch, remove,
    addImage, getImage, deleteImage,
    get photoStore() { return photoStore(); }, testPhotoStore, setPhotoStore, movePhotos,
    saveOffline, pruneOffline,
    loadSaved,
    isSaved: (id) => !fb || !!savedIds?.has(id),
    addMember, removeMember, setAdmin, setRole, specCases, unitsCases, addRecord, records, caseRecords, saveSchemeReport, schemeReports, mySchemeReports,
    exportAll, importAll,
  };
})();
