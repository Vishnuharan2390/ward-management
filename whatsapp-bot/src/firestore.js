// Writes cases into the ward app's Firebase (Firestore REST API), signed in as the bot's own
// account. That account must be on the unit's team list (Settings → Team) with a verified email —
// the same firestore.rules as every PG apply to it.
// Data shape mirrors js/store.js: units/{unit}/cases/{id} and units/{unit}/images/{id}.

const TOKEN_KEY = 'fb:idtoken';

// Sign in (email + password) and cache the ID token in KV for ~50 minutes. Messages arriving
// together share one sign-in.
let signingIn = null;
export async function idToken(env) {
  const cached = await env.HISTORY.get(TOKEN_KEY);
  if (cached) return cached;
  signingIn ||= signIn(env).finally(() => { signingIn = null; });
  return signingIn;
}
async function signIn(env) {
  const r = await fetch(`${env.AUTH_URL || 'https://identitytoolkit.googleapis.com'}/v1/accounts:signInWithPassword?key=${env.FIREBASE_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: env.BOT_EMAIL, password: env.BOT_PASSWORD, returnSecureToken: true }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.idToken) throw new Error(`Firebase sign-in failed: ${j.error?.message || r.status}`);
  await env.HISTORY.put(TOKEN_KEY, j.idToken, { expirationTtl: 50 * 60 });
  return j.idToken;
}

// JS value → Firestore REST value.
export function toValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toValue) } };
  return { mapValue: { fields: toFields(v) } };
}
export const toFields = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, toValue(v)]));

// AUTH_URL / FIRESTORE_URL only change for tests against the Firebase emulator.
const base = (env) => `${env.FIRESTORE_URL || 'https://firestore.googleapis.com'}/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/units/${env.FIREBASE_UNIT_ID}`;

async function call(env, url, init) {
  const send = async () => fetch(url, { ...init, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await idToken(env)}`, ...(init.headers || {}) } });
  let r = await send();
  if (r.status === 401) { // token expired early: sign in again once
    await env.HISTORY.delete(TOKEN_KEY);
    r = await send();
  }
  if (!r.ok) throw new Error(`Firestore ${init.method || 'GET'} failed ${r.status}: ${(await r.text()).slice(0, 300)}`);
  return r.json();
}

// Create a document with a chosen id.
export const createDoc = (env, coll, id, data) => call(env, `${base(env)}/${coll}?documentId=${encodeURIComponent(id)}`, { method: 'POST', body: JSON.stringify({ fields: toFields(data) }) });

// Set some fields of an existing document (dotted paths allowed, like the app's patch).
export function patchDoc(env, coll, id, changes) {
  const fields = {};
  for (const [path, v] of Object.entries(changes)) {
    // nest "images.abc" into { images: { abc: … } } for the body; updateMask keeps the rest
    const keys = path.split('.');
    let o = fields;
    keys.slice(0, -1).forEach((k) => { o[k] ||= {}; o = o[k]; });
    o[keys.at(-1)] = v;
  }
  const mask = Object.keys(changes).map((p) => `updateMask.fieldPaths=${p.split('.').map((k) => (/^[A-Za-z_][A-Za-z_0-9]*$/.test(k) ? k : '`' + k + '`')).join('.')}`).join('&');
  return call(env, `${base(env)}/${coll}/${encodeURIComponent(id)}?${mask}`, { method: 'PATCH', body: JSON.stringify({ fields: toFields(fields) }) });
}

// Same id style as the app (js/util.js uid): time + random, base 36.
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
