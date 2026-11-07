// WhatsApp bot for the Ortho Unit I team (Govt. Rajaji Hospital, Madurai).
// Runs as a Cloudflare Worker: Meta's WhatsApp Cloud API posts each incoming message to /webhook.
//  1. Case intake: forward your "Case 10 / Sivagamy 47/F / NMLC/FALL / diagnosis" posts (with their
//     photos) and the bot saves them as cases in the ward app's Firebase — they appear in the
//     Admission day PPT and the pre-op ward. "DOA 2/11" sets the admission day for what follows.
//  2. Anything else goes to Claude (only if ANTHROPIC_API_KEY is set).
// Only numbers listed in ALLOWED_NUMBERS get answers; everyone else is ignored.
import Anthropic from '@anthropic-ai/sdk';
import { parseCaseText, defaultPlanFor, caseKey, admissionDay, parseDoaCommand, STANDARD_TREATMENT } from './caseparse.js';
import { createDoc, patchDoc, uid } from './firestore.js';

const HISTORY_TURNS = 20; // messages kept per chat (user + assistant)
const HISTORY_TTL = 12 * 3600; // forget a chat after 12 h of silence
const WA_MAX = 4000; // WhatsApp text limit is 4096

const SYSTEM = `You are a WhatsApp assistant for the orthopaedics team (Ortho Unit I) at Government Rajaji Hospital and Madurai Medical College, Madurai, India. The people writing to you are orthopaedic postgraduates and doctors.

How to reply:
- This is WhatsApp: keep answers short and scannable. Use *bold* and _italic_ (single asterisks/underscores), simple "•" bullets and line breaks. No markdown headings, tables or code blocks.
- Answer clinical questions at the level of an orthopaedic PG: classifications, management options, implant choices, drug doses, investigations, viva-style explanations. Mention when Indian practice or availability in a government hospital matters.
- When they send a photo of a lab report, X-ray, prescription or case sheet, read it carefully, say what you can and cannot make out, and flag abnormal values.
- Be honest about uncertainty. Decisions stay with the treating team; say so only when it actually matters, not on every message.
- If someone writes in Tamil or Tanglish, reply the same way.`;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname !== '/webhook') return new Response('ward-whatsapp-bot', { status: 200 });

    // Meta's one-time webhook check.
    if (request.method === 'GET') {
      const ok = url.searchParams.get('hub.mode') === 'subscribe' && url.searchParams.get('hub.verify_token') === env.VERIFY_TOKEN;
      return ok ? new Response(url.searchParams.get('hub.challenge')) : new Response('forbidden', { status: 403 });
    }
    if (request.method !== 'POST') return new Response('method not allowed', { status: 405 });

    const raw = await request.text();
    if (!(await validSignature(raw, request.headers.get('x-hub-signature-256'), env.APP_SECRET))) {
      return new Response('bad signature', { status: 401 });
    }
    let body;
    try { body = JSON.parse(raw); } catch { return new Response('bad json', { status: 400 }); }

    // Answer Meta at once (it retries slow webhooks); do the work in the background.
    const msgs = (body.entry || []).flatMap((e) => (e.changes || []).flatMap((c) => c.value?.messages || []));
    for (const m of msgs) ctx.waitUntil(handle(m, env).catch((err) => console.error('handle failed', err)));
    return new Response('ok');
  },
};

export async function handle(m, env) {
  const from = String(m.from || '');
  const allowed = String(env.ALLOWED_NUMBERS || '').split(',').map((s) => s.replace(/\D/g, '')).filter(Boolean);
  if (!allowed.includes(from)) return; // strangers get silence

  // Meta can deliver the same message twice.
  const seenKey = `seen:${m.id}`;
  if (await env.HISTORY.get(seenKey)) return;
  await env.HISTORY.put(seenKey, '1', { expirationTtl: 86400 });

  await wa(env, { status: 'read', message_id: m.id }).catch(() => {});

  const histKey = `h:${from}`;
  const text = (m.text?.body || '').trim();
  if (m.type === 'text' && /^\/?(reset|new|clear)$/i.test(text)) {
    await env.HISTORY.delete(histKey);
    return reply(env, from, 'Fresh start — I have forgotten our earlier chat.');
  }

  // ---- case intake (when the ward app's Firebase is configured) ----
  if (intakeOn(env)) {
    if (m.type === 'text' && /^\/?help$/i.test(text)) return reply(env, from, HELP);
    if (m.type === 'text' && /^doa\s*[:\-]?\s*(auto|today)$/i.test(text)) {
      await env.HISTORY.delete(`doa:${from}`);
      return reply(env, from, 'OK — admission day is worked out from the time you forward (before 10 AM counts as the previous day).');
    }
    const doaCmd = m.type === 'text' && parseDoaCommand(text, new Date().getUTCFullYear());
    if (doaCmd) {
      await env.HISTORY.put(`doa:${from}`, doaCmd, { expirationTtl: 14 * 3600 });
      return reply(env, from, `✓ Cases you forward now go to the *${dmy(doaCmd)}* admission day (for the next 14 hours). Send *DOA AUTO* to go back to automatic.`);
    }
    const caption = (m.image?.caption || '').trim();
    const post = m.type === 'text' ? parseCaseText(text) : m.type === 'image' ? parseCaseText(caption) : null;
    if (post) return intake(env, m, from, post, m.type === 'image' ? m.image : null);
    if (m.type === 'image') {
      const last = await recentCase(env, from);
      if (last) return addPhoto(env, from, last, m.image, kindFromCaption(caption));
    }
    if (!env.ANTHROPIC_API_KEY) return reply(env, from, HELP);
  }

  // Build this turn's content: what Claude sees now, and the lighter copy we keep in history.
  let content;
  let saved;
  if (m.type === 'text') {
    content = text;
    saved = text;
  } else if (m.type === 'image' || (m.type === 'document' && m.document?.mime_type === 'application/pdf')) {
    const media = m.image || m.document;
    const caption = (media.caption || '').trim();
    const { data, mime } = await downloadMedia(env, media.id);
    const block = m.type === 'image'
      ? { type: 'image', source: { type: 'base64', media_type: imageMime(mime), data } }
      : { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } };
    content = [block, { type: 'text', text: caption || (m.type === 'image' ? 'Please read this image.' : 'Please read this PDF.') }];
    saved = `[sent a ${m.type === 'image' ? 'photo' : 'PDF'}${caption ? `: ${caption}` : ''}]`;
  } else {
    return reply(env, from, 'I can read text messages, photos and PDFs. Voice notes and other attachments are not supported yet.');
  }

  let history = [];
  try { history = JSON.parse((await env.HISTORY.get(histKey)) || '[]'); } catch { history = []; }

  const answer = await askClaude(env, [...history, { role: 'user', content }]);
  await reply(env, from, answer);

  // Keep only text in history (photos are summarised as a note) so later turns stay cheap.
  history.push({ role: 'user', content: saved }, { role: 'assistant', content: answer });
  await env.HISTORY.put(histKey, JSON.stringify(history.slice(-HISTORY_TURNS)), { expirationTtl: HISTORY_TTL });
}

// ---------------------------------------------------------------- case intake
const intakeOn = (env) => !!(env.FIREBASE_PROJECT_ID && env.FIREBASE_API_KEY && env.FIREBASE_UNIT_ID && env.BOT_EMAIL && env.BOT_PASSWORD);
const dmy = (iso) => iso.split('-').reverse().join('/');
const MAX_IMAGE = 950000; // a Firestore document holds 1 MB; the app keeps images under that too

const HELP = `*Ortho Unit I — case bot*
Forward your case posts here (photos too):
_Case 10_
_Sivagamy 47/F_
_NMLC/ACCIDENTAL FALL_
_CLOSED FRACTURE BOTH BONE FOREARM LEFT_
Each post is saved as a case — it appears in the *Admission day PPT* and the *pre-op ward*.

• A photo sent with the post goes on its X-ray slide. Photos sent just after a post join that case (caption *wound* / *CT* / *MRI* to file them there; otherwise X-ray).
• Admission day: posts forwarded before 10 AM count for the previous day. To choose it yourself send e.g. *DOA 2/11* (lasts 14 h; *DOA AUTO* to undo).
• Forwarding the same patient twice won't make a duplicate.`;

const kindFromCaption = (c) => (/\bwound|clinical|pic(ture)?\b/i.test(c) ? 'wound' : /\bct\b/i.test(c) ? 'ct' : /\bmri\b/i.test(c) ? 'mri' : /post[\s-]?op/i.test(c) ? 'poxray' : /post[\s-]?reduction/i.test(c) ? 'prxray' : 'xray');
const KIND_LABEL = { xray: 'X-ray', wound: 'wound pic', ct: 'CT', mri: 'MRI', poxray: 'post-op X-ray', prxray: 'post-reduction X-ray' };

async function recentCase(env, from) {
  try { return JSON.parse((await env.HISTORY.get(`last:${from}`)) || 'null'); } catch { return null; }
}

async function intake(env, m, from, p, image) {
  const doa = (await env.HISTORY.get(`doa:${from}`)) || admissionDay(m.timestamp || Date.now() / 1000);
  const who = env.BOT_NAME || 'WhatsApp bot';
  const dupKey = `ck:${env.FIREBASE_UNIT_ID}:${caseKey(p.name, p.age)}:${doa}`;
  let id = await env.HISTORY.get(dupKey);
  const label = `${p.caseNo ? `Case ${p.caseNo} ` : ''}*${p.name}* ${[p.age, p.sex].filter(Boolean).join('/')}`;
  const last = { id: null, label };
  try {
    if (id) {
      last.id = id;
      await env.HISTORY.put(`last:${from}`, JSON.stringify(last), { expirationTtl: 20 * 60 });
      if (image) return addPhoto(env, from, last, image, 'xray');
      return reply(env, from, `${label} is already in the ${dmy(doa)} admission day — not added again.`);
    }
    id = uid();
    const now = Date.now();
    const diagnosis = p.diagnosis.toUpperCase();
    await createDoc(env, 'cases', id, {
      name: p.name, age: p.age, sex: p.sex, ipNo: p.ipNo, ward: p.ward, mode: p.mode, diagnosis,
      plan: defaultPlanFor(diagnosis), doa, status: 'preop', work: {}, treatment: STANDARD_TREATMENT.join('\n'), writtenBy: '',
      ...(p.caseNo ? { caseNo: String(p.caseNo) } : {}), source: 'whatsapp-bot',
      createdAt: now, createdBy: who, updatedAt: now, updatedBy: who,
    });
    await env.HISTORY.put(dupKey, id, { expirationTtl: 7 * 86400 });
    last.id = id;
    await env.HISTORY.put(`last:${from}`, JSON.stringify(last), { expirationTtl: 20 * 60 });
    let photo = '';
    if (image) {
      const ok = await savePhoto(env, id, image, 'xray', p.caseNo ? `WhatsApp case ${p.caseNo}` : 'WhatsApp').catch((e) => e);
      photo = ok === true ? ' (1 X-ray)' : ` — photo not saved: ${ok.message}`;
    }
    return reply(env, from, `✓ ${label} added to the *${dmy(doa)}* admission day${photo}.`);
  } catch (err) {
    console.error('intake failed', err);
    return reply(env, from, `✗ Couldn't save ${label}: ${err.message}. Add it in the app, or try again in a minute.`);
  }
}

async function savePhoto(env, caseId, image, kind, caption) {
  const { data, mime } = await downloadMedia(env, image.id);
  const dataUrl = `data:${imageMime(mime)};base64,${data}`;
  if (dataUrl.length > MAX_IMAGE) throw new Error('too large — add it from the app');
  const imgId = uid();
  const now = Date.now();
  const by = env.BOT_NAME || 'WhatsApp bot';
  await createDoc(env, 'images', imgId, { id: imgId, caseId, kind, data: dataUrl, caption, at: now, by });
  await patchDoc(env, 'cases', caseId, { [`images.${imgId}`]: { kind, caption, at: now, by }, updatedAt: now, updatedBy: by });
  return true;
}

async function addPhoto(env, from, last, image, kind) {
  const ok = await savePhoto(env, last.id, image, kind, 'WhatsApp').catch((e) => e);
  if (ok !== true) return reply(env, from, `✗ Photo for ${last.label} not saved: ${ok.message}`);
  await env.HISTORY.put(`last:${from}`, JSON.stringify(last), { expirationTtl: 20 * 60 });
  return reply(env, from, `✓ ${KIND_LABEL[kind] || kind} added to ${last.label}.`);
}

async function askClaude(env, messages) {
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  try {
    const res = await client.beta.messages.create({
      model: env.CLAUDE_MODEL || 'claude-opus-5-5',
      max_tokens: 16000,
      system: SYSTEM,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'medium' },
      // If the main model declines on a safety filter, the API retries on a suitable fallback model.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      messages,
    });
    if (res.stop_reason === 'refusal') return "Sorry, I can't help with that one.";
    const out = res.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
    return out || 'I had nothing useful to say to that — try rephrasing?';
  } catch (err) {
    console.error('Claude API error', err);
    if (err instanceof Anthropic.RateLimitError) return 'Too many questions at once — try again in a minute.';
    if (err instanceof Anthropic.AuthenticationError) return 'The bot\'s Anthropic API key is not working. Ask the admin to check it.';
    if (err instanceof Anthropic.BadRequestError) return 'That message was too large or unreadable for me. Try a smaller photo, or send /reset.';
    if (err instanceof Anthropic.APIError) return 'Claude is having trouble right now. Try again in a little while.';
    throw err;
  }
}

// ---- WhatsApp Cloud API -------------------------------------------------------------
const graph = (env, path) => `https://graph.facebook.com/${env.GRAPH_VERSION || 'v21.0'}/${path}`;

async function wa(env, payload) {
  const r = await fetch(graph(env, `${env.WHATSAPP_PHONE_ID}/messages`), {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', ...payload }),
  });
  if (!r.ok) throw new Error(`WhatsApp send failed ${r.status}: ${await r.text()}`);
}

async function reply(env, to, text) {
  for (const body of chunks(text, WA_MAX)) await wa(env, { to, type: 'text', text: { body } });
}

// Split long answers on paragraph / line breaks so nothing is cut mid-sentence.
export function chunks(text, max) {
  const out = [];
  let rest = String(text);
  while (rest.length > max) {
    let cut = rest.lastIndexOf('\n\n', max);
    if (cut < max / 2) cut = rest.lastIndexOf('\n', max);
    if (cut < max / 2) cut = rest.lastIndexOf(' ', max);
    if (cut < max / 2) cut = max;
    out.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) out.push(rest);
  return out;
}

async function downloadMedia(env, id) {
  const auth = { Authorization: `Bearer ${env.WHATSAPP_TOKEN}` };
  const meta = await fetch(graph(env, id), { headers: auth });
  if (!meta.ok) throw new Error(`media lookup failed ${meta.status}`);
  const { url, mime_type: mime } = await meta.json();
  const file = await fetch(url, { headers: auth });
  if (!file.ok) throw new Error(`media download failed ${file.status}`);
  return { data: toBase64(await file.arrayBuffer()), mime };
}

const imageMime = (m) => (['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(m) ? m : 'image/jpeg');

function toBase64(buf) {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

// Meta signs every webhook with the app secret (HMAC-SHA256 of the raw body).
async function validSignature(raw, header, secret) {
  if (!secret || !header?.startsWith('sha256=')) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(raw)));
  const hex = [...mac].map((b) => b.toString(16).padStart(2, '0')).join('');
  const given = header.slice(7);
  if (given.length !== hex.length) return false;
  let diff = 0;
  for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ given.charCodeAt(i);
  return diff === 0;
}
