// End-to-end tests with fake WhatsApp (graph.facebook.com) and fake Claude (api.anthropic.com).
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import worker, { chunks } from '../src/index.js';

const env = {
  ALLOWED_NUMBERS: '919876543210, 919800000001', GRAPH_VERSION: 'v21.0', CLAUDE_MODEL: 'claude-opus-5-5',
  ANTHROPIC_API_KEY: 'sk-test', WHATSAPP_TOKEN: 'wa-token', WHATSAPP_PHONE_ID: '555', APP_SECRET: 'shh', VERIFY_TOKEN: 'grh-ortho',
};
let kv, sent, claudeCalls, claudeReply;
beforeEach(() => {
  const store = new Map();
  kv = { get: async (k) => store.get(k) ?? null, put: async (k, v) => void store.set(k, v), delete: async (k) => void store.delete(k), store };
  env.HISTORY = kv; sent = []; claudeCalls = []; claudeReply = { stop_reason: 'end_turn', content: [{ type: 'text', text: '*Hb 9.8* is low.' }] };
  globalThis.fetch = async (input, init = {}) => {
    const url = String(input.url || input);
    const body = init.body ? JSON.parse(init.body) : null;
    if (url.startsWith('https://api.anthropic.com/')) {
      claudeCalls.push({ url, body, headers: new Headers(init.headers) });
      return Response.json({ id: 'msg_1', type: 'message', role: 'assistant', model: body.model, usage: { input_tokens: 1, output_tokens: 1 }, ...claudeReply });
    }
    if (url === 'https://graph.facebook.com/v21.0/555/messages') { sent.push(body); return Response.json({ ok: true }); }
    if (url === 'https://graph.facebook.com/v21.0/MEDIA1') return Response.json({ url: 'https://lookaside.fbsbx.com/x', mime_type: 'image/jpeg' });
    if (url === 'https://lookaside.fbsbx.com/x') return new Response(new Uint8Array([0xff, 0xd8, 0xff, 1, 2, 3]));
    throw new Error('unexpected fetch ' + url);
  };
});

const sign = (raw) => 'sha256=' + createHmac('sha256', env.APP_SECRET).update(raw).digest('hex');
async function deliver(messages, { badSig = false } = {}) {
  const raw = JSON.stringify({ entry: [{ changes: [{ value: { messages } }] }] });
  const waits = [];
  const res = await worker.fetch(new Request('https://bot.example/webhook', { method: 'POST', body: raw, headers: { 'x-hub-signature-256': badSig ? 'sha256=00' : sign(raw) } }), env, { waitUntil: (p) => waits.push(p) });
  await Promise.all(waits);
  return res;
}
const txt = (id, from, body) => ({ id, from, type: 'text', text: { body } });
const texts = () => sent.filter((s) => s.type === 'text').map((s) => s.text.body);

test('webhook verification handshake', async () => {
  const ok = await worker.fetch(new Request('https://b/webhook?hub.mode=subscribe&hub.verify_token=grh-ortho&hub.challenge=42'), env, {});
  assert.equal(await ok.text(), '42');
  const bad = await worker.fetch(new Request('https://b/webhook?hub.mode=subscribe&hub.verify_token=nope&hub.challenge=42'), env, {});
  assert.equal(bad.status, 403);
});

test('rejects unsigned / forged webhooks', async () => {
  const res = await deliver([txt('w1', '919876543210', 'hi')], { badSig: true });
  assert.equal(res.status, 401);
  assert.equal(claudeCalls.length, 0);
});

test('allowed number gets a Claude answer with the right request shape', async () => {
  await deliver([txt('w2', '919876543210', 'Hb 9.8 before PFN?')]);
  assert.deepEqual(texts(), ['*Hb 9.8* is low.']);
  const { body, headers } = claudeCalls[0];
  assert.equal(body.model, 'claude-opus-5-5');
  assert.deepEqual(body.thinking, { type: 'adaptive' });
  assert.equal(body.fallbacks, 'default');
  assert.match(headers.get('anthropic-beta'), /server-side-fallback-2026-07-01/);
  assert.deepEqual(body.messages, [{ role: 'user', content: 'Hb 9.8 before PFN?' }]);
  assert.ok(sent.some((s) => s.status === 'read' && s.message_id === 'w2'));
});

test('strangers are ignored', async () => {
  await deliver([txt('w3', '911111111111', 'hello')]);
  assert.equal(claudeCalls.length, 0);
  assert.equal(sent.length, 0);
});

test('duplicate delivery is answered once', async () => {
  await deliver([txt('w4', '919876543210', 'hi')]);
  await deliver([txt('w4', '919876543210', 'hi')]);
  assert.equal(claudeCalls.length, 1);
});

test('history carries over, and /reset clears it', async () => {
  await deliver([txt('a1', '919876543210', 'first')]);
  await deliver([txt('a2', '919876543210', 'second')]);
  assert.deepEqual(claudeCalls[1].body.messages.map((m) => m.content), ['first', '*Hb 9.8* is low.', 'second']);
  await deliver([txt('a3', '919876543210', '/reset')]);
  assert.match(texts().at(-1), /Fresh start/);
  await deliver([txt('a4', '919876543210', 'third')]);
  assert.deepEqual(claudeCalls[2].body.messages, [{ role: 'user', content: 'third' }]);
});

test('photo is sent to Claude as an image block, stored as a note', async () => {
  await deliver([{ id: 'p1', from: '919800000001', type: 'image', image: { id: 'MEDIA1', caption: 'RFT report' } }]);
  const [img, cap] = claudeCalls[0].body.messages[0].content;
  assert.equal(img.type, 'image');
  assert.equal(img.source.media_type, 'image/jpeg');
  assert.equal(img.source.data, Buffer.from([0xff, 0xd8, 0xff, 1, 2, 3]).toString('base64'));
  assert.deepEqual(cap, { type: 'text', text: 'RFT report' });
  assert.equal(JSON.parse(kv.store.get('h:919800000001'))[0].content, '[sent a photo: RFT report]');
});

test('refusal and unsupported types get a polite reply', async () => {
  claudeReply = { stop_reason: 'refusal', content: [] };
  await deliver([txt('r1', '919876543210', 'x')]);
  await deliver([{ id: 'v1', from: '919876543210', type: 'audio', audio: { id: 'A' } }]);
  assert.match(texts()[0], /can't help/);
  assert.match(texts()[1], /Voice notes/);
});

test('long answers are split for WhatsApp', () => {
  const long = Array.from({ length: 300 }, (_, i) => `Line ${i} about implants and plans.`).join('\n');
  const parts = chunks(long, 4000);
  assert.ok(parts.length > 1 && parts.every((p) => p.length <= 4000));
  assert.equal(parts.join('\n').replace(/\s+/g, ' '), long.replace(/\s+/g, ' '));
});
