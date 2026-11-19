// /send-ot with fake Firestore (team check + contacts) and fake WhatsApp (media upload + messages).
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';
import { parseNumbers } from '../src/otsend.js';

const env = {
  WHATSAPP_TOKEN: 'wa-token', WHATSAPP_PHONE_ID: '555', GRAPH_VERSION: 'v21.0',
  FIREBASE_PROJECT_ID: 'proj', FIREBASE_UNIT_ID: 'unit-1', OT_TEMPLATE: 'ot_list', OT_TEMPLATE_LANG: 'en',
};
const META = 'https://firestore.googleapis.com/v1/projects/proj/databases/(default)/documents/units/unit-1/meta/main';
const PDF = Buffer.from('%PDF-1.4 fake ot list').toString('base64');
let numbers, uploads, sent, failFor, metaAuth;
beforeEach(() => {
  numbers = '98765 43210, +91 98123-45678\n919876543210';
  uploads = []; sent = []; failFor = null; metaAuth = [];
  globalThis.fetch = async (input, init = {}) => {
    const url = String(input.url || input);
    const h = new Headers(init.headers);
    if (url === META) {
      metaAuth.push(h.get('authorization'));
      if (h.get('authorization') !== 'Bearer member-token') return new Response('{"error":{"status":"PERMISSION_DENIED"}}', { status: 403 });
      return Response.json({ fields: { otWaNumbers: { stringValue: numbers } } });
    }
    if (url === 'https://graph.facebook.com/v21.0/555/media') {
      const f = init.body.get('file');
      uploads.push({ name: f.name, type: f.type, size: f.size, auth: h.get('authorization') });
      return Response.json({ id: 'MEDIA42' });
    }
    if (url === 'https://graph.facebook.com/v21.0/555/messages') {
      const body = JSON.parse(init.body);
      sent.push(body);
      if (body.to === failFor) return Response.json({ error: { message: 'Recipient not on WhatsApp' } }, { status: 400 });
      return Response.json({ messages: [{ id: 'wamid.1' }] });
    }
    throw new Error('unexpected fetch ' + url);
  };
});

const post = (token, body, origin = 'https://vishnuharan2390.github.io') => worker.fetch(new Request('https://bot.example/send-ot', {
  method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  body: JSON.stringify(body),
}), env, { waitUntil() {} });

test('numbers: 10 digits get 91, duplicates and junk dropped', () => {
  assert.deepEqual(parseNumbers('98765 43210, +91 98123-45678\n919876543210; 12, 09876543211'), ['919876543210', '919812345678', '919876543211']);
});

test('CORS preflight for the app', async () => {
  const r = await worker.fetch(new Request('https://bot.example/send-ot', { method: 'OPTIONS', headers: { Origin: 'https://vishnuharan2390.github.io' } }), env, {});
  assert.equal(r.status, 204);
  assert.equal(r.headers.get('access-control-allow-origin'), 'https://vishnuharan2390.github.io');
  assert.match(r.headers.get('access-control-allow-headers'), /Authorization/);
});

test('a team member sends the PDF to every contact with the template', async () => {
  const r = await post('member-token', { pdf: PDF, filename: 'OT LIST UNIT I 20.11.2026.pdf', title: 'OT LIST UNIT I 20/11/2026' });
  const j = await r.json();
  assert.equal(r.status, 200);
  assert.deepEqual([j.sent, j.total], [2, 2]);
  assert.deepEqual(uploads, [{ name: 'OT LIST UNIT I 20.11.2026.pdf', type: 'application/pdf', size: Buffer.from(PDF, 'base64').length, auth: 'Bearer wa-token' }]);
  assert.deepEqual(sent.map((s) => s.to), ['919876543210', '919812345678']);
  const t = sent[0].template;
  assert.equal(t.name, 'ot_list');
  assert.deepEqual(t.components[0], { type: 'header', parameters: [{ type: 'document', document: { id: 'MEDIA42', filename: 'OT LIST UNIT I 20.11.2026.pdf' } }] });
  assert.deepEqual(t.components[1].parameters, [{ type: 'text', text: 'OT LIST UNIT I 20/11/2026' }]);
});

test('without a template it sends a plain document', async () => {
  const { OT_TEMPLATE, ...noTpl } = env;
  const r = await worker.fetch(new Request('https://bot.example/send-ot', { method: 'POST', headers: { Authorization: 'Bearer member-token' }, body: JSON.stringify({ pdf: PDF, filename: 'X.pdf', title: 'X' }) }), noTpl, {});
  assert.equal((await r.json()).sent, 2);
  assert.deepEqual(sent[0], { messaging_product: 'whatsapp', to: '919876543210', type: 'document', document: { id: 'MEDIA42', filename: 'X.pdf', caption: 'X' } });
});

test('not on the team / not signed in: nothing is sent', async () => {
  const r1 = await post('stranger-token', { pdf: PDF });
  assert.equal(r1.status, 403);
  const r2 = await post('', { pdf: PDF });
  assert.equal(r2.status, 401);
  assert.equal(uploads.length + sent.length, 0);
});

test('one failed contact is reported, the rest still go', async () => {
  failFor = '919812345678';
  const j = await (await post('member-token', { pdf: PDF, filename: 'a.pdf' })).json();
  assert.equal(j.sent, 1);
  assert.deepEqual(j.results[1], { to: '919812345678', ok: false, error: 'Recipient not on WhatsApp' });
});

test('no contacts set, or not a PDF: refused before anything is uploaded', async () => {
  numbers = '';
  assert.equal((await post('member-token', { pdf: PDF })).status, 400);
  numbers = '9876543210';
  assert.equal((await post('member-token', { pdf: Buffer.from('hello').toString('base64') })).status, 400);
  assert.equal(uploads.length, 0);
});
