// Case intake: forwarded case posts → Firestore documents shaped like the ward app's own.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import worker from '../src/index.js';
import { parseCaseText, admissionDay, parseDoaCommand } from '../src/caseparse.js';

const env = {
  ALLOWED_NUMBERS: '919876543210', GRAPH_VERSION: 'v21.0', WHATSAPP_TOKEN: 'wa', WHATSAPP_PHONE_ID: '555', APP_SECRET: 'shh', VERIFY_TOKEN: 'v',
  FIREBASE_PROJECT_ID: 'ortho-ward-c2e69', FIREBASE_API_KEY: 'k', FIREBASE_UNIT_ID: 'ortho-unit-1', BOT_EMAIL: 'bot@example.com', BOT_PASSWORD: 'pw',
};
const FS = 'https://firestore.googleapis.com/v1/projects/ortho-ward-c2e69/databases/(default)/documents/units/ortho-unit-1/';
let kv, sent, docs, patches, signIns, claude;
// Firestore REST value → plain JS (to read back what was written)
const plain = (v) => ('stringValue' in v ? v.stringValue : 'integerValue' in v ? Number(v.integerValue) : 'booleanValue' in v ? v.booleanValue
  : 'nullValue' in v ? null : 'arrayValue' in v ? (v.arrayValue.values || []).map(plain) : Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, plain(x)])));
const fields = (f) => Object.fromEntries(Object.entries(f).map(([k, v]) => [k, plain(v)]));

beforeEach(() => {
  const store = new Map();
  kv = { get: async (k) => store.get(k) ?? null, put: async (k, v) => void store.set(k, v), delete: async (k) => void store.delete(k) };
  env.HISTORY = kv; sent = []; docs = {}; patches = []; signIns = 0; claude = 0;
  globalThis.fetch = async (input, init = {}) => {
    const url = String(input.url || input);
    const body = init.body ? JSON.parse(init.body) : null;
    if (url.startsWith('https://identitytoolkit.googleapis.com/')) { signIns++; return Response.json({ idToken: 'tok' }); }
    if (url.startsWith(FS)) {
      assert.equal(new Headers(init.headers).get('authorization'), 'Bearer tok');
      const [path, qs] = url.slice(FS.length).split('?');
      if (init.method === 'POST') {
        const id = new URLSearchParams(qs).get('documentId');
        docs[`${path}/${id}`] = fields(body.fields);
      } else if (init.method === 'PATCH') {
        patches.push({ path, mask: new URLSearchParams(qs).getAll('updateMask.fieldPaths'), fields: fields(body.fields) });
      }
      return Response.json({});
    }
    if (url.startsWith('https://api.anthropic.com/')) { claude++; return Response.json({ id: 'm', type: 'message', role: 'assistant', model: 'x', usage: {}, stop_reason: 'end_turn', content: [{ type: 'text', text: 'hi' }] }); }
    if (url === 'https://graph.facebook.com/v21.0/555/messages') { sent.push(body); return Response.json({ ok: true }); }
    if (url === 'https://graph.facebook.com/v21.0/IMG1') return Response.json({ url: 'https://lookaside.fbsbx.com/1', mime_type: 'image/jpeg' });
    if (url === 'https://lookaside.fbsbx.com/1') return new Response(new Uint8Array([0xff, 0xd8, 0xff, 9, 9, 9]));
    throw new Error('unexpected fetch ' + url);
  };
});

const sign = (raw) => 'sha256=' + createHmac('sha256', env.APP_SECRET).update(raw).digest('hex');
async function deliver(messages) {
  const raw = JSON.stringify({ entry: [{ changes: [{ value: { messages } }] }] });
  const waits = [];
  await worker.fetch(new Request('https://bot/webhook', { method: 'POST', body: raw, headers: { 'x-hub-signature-256': sign(raw) } }), env, { waitUntil: (p) => waits.push(p) });
  await Promise.all(waits);
}
const ts = (iso) => String(Math.floor(Date.parse(iso) / 1000));
const txt = (id, body, when = '2026-11-02T17:46:00Z') => ({ id, from: '919876543210', timestamp: ts(when), type: 'text', text: { body } });
const replies = () => sent.filter((s) => s.type === 'text').map((s) => s.text.body);
const cases = () => Object.entries(docs).filter(([k]) => k.startsWith('cases/')).map(([k, v]) => ({ id: k.slice(6), ...v }));

test('parser and admission day', () => {
  assert.equal(parseCaseText('ok sir'), null);
  assert.equal(parseCaseText('Case 11\nUmar Faruk 19/M\nMLC/RTA\n\nRIGHT ILIAC WING FRACTURE').name, 'UMAR FARUK');
  assert.equal(admissionDay(ts('2026-11-02T17:46:00Z')), '2026-11-02'); // 11:16 PM IST
  assert.equal(admissionDay(ts('2026-11-03T01:00:00Z')), '2026-11-02'); // 6:30 AM next day
  assert.equal(admissionDay(ts('2026-11-03T06:00:00Z')), '2026-11-03'); // 11:30 AM
  assert.equal(parseDoaCommand('DOA 2/11', 2026), '2026-11-02');
});

test('a forwarded case post becomes a case in the app', async () => {
  await deliver([txt('a', 'Case 11\nUmar Faruk 19/M\nMLC/RTA\n\nRIGHT ILIAC WING FRACTURE')]);
  const [c] = cases();
  assert.deepEqual({ name: c.name, age: c.age, sex: c.sex, mode: c.mode, diagnosis: c.diagnosis, doa: c.doa, caseNo: c.caseNo, status: c.status, treatment: c.treatment },
    { name: 'UMAR FARUK', age: '19', sex: 'M', mode: 'MLC/RTA', diagnosis: 'RIGHT ILIAC WING FRACTURE', doa: '2026-11-02', caseNo: '11', status: 'preop', treatment: 'IV FLUIDS\nANALGESICS' });
  assert.equal(typeof c.createdAt, 'number');
  assert.match(replies()[0], /✓ Case 11 \*UMAR FARUK\* 19\/M added to the \*02\/11\/2026\* admission day/);
});

test('photo with the post goes on its X-ray slide; default plan filled', async () => {
  await deliver([{ id: 'b', from: '919876543210', timestamp: ts('2026-11-02T17:46:00Z'), type: 'image', image: { id: 'IMG1', caption: 'Case 12\nMurugesan 62/M\nNMLC/FALL\nCLOSED FRACTURE INTERTROCHANTERIC FEMUR RIGHT' } }]);
  const [c] = cases();
  assert.equal(c.plan, 'CR/ORIF WITH SHORT PFN RIGHT');
  const img = Object.entries(docs).find(([k]) => k.startsWith('images/'))[1];
  assert.equal(img.caseId, c.id);
  assert.equal(img.kind, 'xray');
  assert.equal(img.data, 'data:image/jpeg;base64,' + Buffer.from([0xff, 0xd8, 0xff, 9, 9, 9]).toString('base64'));
  assert.equal(patches[0].path, `cases/${c.id}`);
  assert.deepEqual(patches[0].mask.sort(), [`images.${img.id}`, 'updatedAt', 'updatedBy'].sort());
  assert.match(replies()[0], /\(1 X-ray\)/);
});

test('captionless photo after a post joins that case; "wound" caption files it as wound pic', async () => {
  await deliver([txt('c', 'Case 13\nSelvi 62/F\nNMLC/FALL\nNOF LEFT')]);
  await deliver([{ id: 'd', from: '919876543210', type: 'image', image: { id: 'IMG1', caption: 'wound' } }]);
  const img = Object.entries(docs).find(([k]) => k.startsWith('images/'))[1];
  assert.equal(img.kind, 'wound');
  assert.equal(img.caseId, cases()[0].id);
  assert.match(replies()[1], /wound pic added to Case 13 \*SELVI\*/);
});

test('same patient forwarded twice is not duplicated', async () => {
  await deliver([txt('e', 'Case 11\nUmar Faruk 19/M\nMLC/RTA\nRIGHT ILIAC WING FRACTURE')]);
  await deliver([txt('f', 'Case 11\nUmar Faruk 19/M\nMLC/RTA\nRIGHT ILIAC WING FRACTURE')]);
  assert.equal(cases().length, 1);
  assert.match(replies()[1], /already in the 02\/11\/2026 admission day/);
});

test('DOA command sets the admission day for what follows', async () => {
  await deliver([txt('g', 'DOA 1/11', '2026-11-03T08:00:00Z')]);
  await deliver([txt('h', 'Case 4\nKannan 38/M\nMLC/ASSAULT\nCUT INJURY RIGHT WRIST', '2026-11-03T08:01:00Z')]);
  assert.equal(cases()[0].doa, '2026-11-01');
  await deliver([txt('i', 'doa auto', '2026-11-03T08:02:00Z')]);
  await deliver([txt('j', 'Case 5\nRaja 30/M\nMLC/RTA\nSHAFT FEMUR', '2026-11-03T08:03:00Z')]);
  assert.equal(cases().find((c) => c.name === 'RAJA').doa, '2026-11-03');
});

test('other messages get help (no Claude key) and sign-in is reused', async () => {
  await deliver([txt('k', 'hello')]);
  assert.match(replies()[0], /case bot/);
  assert.equal(claude, 0);
  await deliver([txt('l', 'Case 1\nA Kumar 20/M\nMLC/RTA\nX'), txt('m', 'Case 2\nB Kumar 21/M\nMLC/RTA\nY')]);
  assert.equal(signIns, 1);
});
