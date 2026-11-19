// POST /send-ot — the ward app sends the OT list PDF here and the bot sends it from its WhatsApp
// number to the unit's OT list contacts (Settings → "WhatsApp the OT list to").
//
// Who may send: the request carries the person's own Firebase sign-in (ID token). The bot reads the
// unit's settings document with it; Firestore only allows that for team members (firestore.rules),
// so a stranger gets 403 and nothing is sent. The contact list comes from that same document, so it
// can only be changed from the app's Settings.
//
// What is sent: Meta only lets a business message someone first with an approved template. The
// template (OT_TEMPLATE, e.g. "ot_list") has a Document header and a body with one {{1}} — the
// list's title. Without OT_TEMPLATE the PDF goes as a plain document, which WhatsApp only delivers
// to people who have messaged the bot's number in the last 24 hours.

const MAX_PDF = 10 * 1024 * 1024;
const MAX_CONTACTS = 25;

const graph = (env, path) => `https://graph.facebook.com/${env.GRAPH_VERSION || 'v21.0'}/${path}`;
const firestore = (env, unit) => `${env.FIRESTORE_URL || 'https://firestore.googleapis.com'}/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/units/${unit}`;

// "98765 43210, +91 98123-45678" → ['919876543210', '919812345678'] (10 digits get 91 in front).
export function parseNumbers(text) {
  const out = [];
  for (const part of String(text || '').split(/[,;\n]+/)) {
    let d = part.replace(/\D/g, '');
    if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
    if (d.length === 10) d = '91' + d;
    if (d.length >= 11 && d.length <= 15 && !out.includes(d)) out.push(d);
  }
  return out;
}

function cors(request, env) {
  const origin = request.headers.get('Origin') || '';
  const allowed = String(env.APP_ORIGINS || 'https://vishnuharan2390.github.io').split(',').map((s) => s.trim()).filter(Boolean);
  return {
    'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : allowed[0],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

export async function sendOt(request, env) {
  const headers = cors(request, env);
  const json = (obj, status = 200) => Response.json(obj, { status, headers });
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'POST') return json({ error: 'POST only' }, 405);
  if (!env.WHATSAPP_TOKEN || !env.WHATSAPP_PHONE_ID || !env.FIREBASE_PROJECT_ID) {
    return json({ error: 'The bot is missing its WhatsApp or Firebase settings.' }, 500);
  }

  // 1. A team member of the unit sending? (their own token reads that unit's settings, or Firestore
  //    refuses). One bot serves every unit: each unit's own contact list is used.
  const token = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'Sign in to the ward app first.' }, 401);
  let body;
  try { body = await request.json(); } catch { return json({ error: 'Bad request.' }, 400); }
  const unit = /^ortho-unit-\d{1,2}$/.test(String(body.unit || '')) ? body.unit : env.FIREBASE_UNIT_ID;
  const metaRes = await fetch(`${firestore(env, unit)}/meta/main`, { headers: { Authorization: `Bearer ${token}` } });
  if (metaRes.status === 401 || metaRes.status === 403) return json({ error: 'Only the unit team can send the OT list.' }, 403);
  if (!metaRes.ok) return json({ error: `Couldn't read the unit settings (${metaRes.status}).` }, 502);
  const meta = (await metaRes.json()).fields || {};
  const to = parseNumbers(meta.otWaNumbers?.stringValue).slice(0, MAX_CONTACTS);
  if (!to.length) return json({ error: 'No OT list WhatsApp numbers in Settings.' }, 400);

  // 2. The PDF
  const filename = String(body.filename || 'OT LIST.pdf').replace(/[^\w .()-]/g, '').slice(0, 120) || 'OT LIST.pdf';
  const title = String(body.title || filename.replace(/\.pdf$/i, '')).slice(0, 200);
  let bytes;
  try { bytes = Uint8Array.from(atob(String(body.pdf || '')), (c) => c.charCodeAt(0)); } catch { return json({ error: 'The PDF did not arrive.' }, 400); }
  if (!bytes.length || bytes.length > MAX_PDF || String.fromCharCode(...bytes.subarray(0, 4)) !== '%PDF') return json({ error: 'That is not a PDF (or it is over 10 MB).' }, 400);

  // 3. Upload once to WhatsApp, then send to each contact
  const auth = { Authorization: `Bearer ${env.WHATSAPP_TOKEN}` };
  const form = new FormData();
  form.append('messaging_product', 'whatsapp');
  form.append('type', 'application/pdf');
  form.append('file', new Blob([bytes], { type: 'application/pdf' }), filename);
  const up = await fetch(graph(env, `${env.WHATSAPP_PHONE_ID}/media`), { method: 'POST', headers: auth, body: form });
  const upJson = await up.json().catch(() => ({}));
  if (!up.ok || !upJson.id) return json({ error: `WhatsApp didn't take the PDF: ${upJson.error?.message || up.status}` }, 502);
  const doc = { id: upJson.id, filename };

  const message = (num) => (env.OT_TEMPLATE
    ? {
      to: num, type: 'template',
      template: {
        name: env.OT_TEMPLATE,
        language: { code: env.OT_TEMPLATE_LANG || 'en' },
        components: [
          { type: 'header', parameters: [{ type: 'document', document: doc }] },
          { type: 'body', parameters: [{ type: 'text', text: title }] },
        ],
      },
    }
    : { to: num, type: 'document', document: { ...doc, caption: title } });

  const results = [];
  for (const num of to) {
    const r = await fetch(graph(env, `${env.WHATSAPP_PHONE_ID}/messages`), {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', ...message(num) }),
    });
    const j = await r.json().catch(() => ({}));
    results.push(r.ok ? { to: num, ok: true } : { to: num, ok: false, error: j.error?.message || `error ${r.status}` });
  }
  return json({ sent: results.filter((x) => x.ok).length, total: results.length, results, template: !!env.OT_TEMPLATE });
}
