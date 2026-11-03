// Domain definitions: investigation parameters (the unit's standard ranges),
// work-up items, units and staff, option lists, and case helpers.

const CASE_STATUS = {
  preop: 'Pre-op',
  posted: 'Posted',
  postop: 'Post-op',
  discharged: 'Discharged',
};

const ANAES = 'GA/RA';
const LEVELS = ['I', 'II', 'III', 'IV'];
const SCHEMES = ['APPROVED', 'VALIDATION', 'TO BE SUBMITTED', 'DENIED', 'NO SCHEME'];
const ROLES = ['House Surgeon', 'PG', 'Senior PG', 'Assistant Professor', 'Professor'];

const UNITS = [
  { id: 'I', chief: 'PROF. DR. PATHIARASAKUMAR MS ORTHO', aps: ['DR. KARTHIKEYAN MS ORTHO', 'DR. PARAMAGURU RAJESH MS ORTHO', 'DR. ASHOK MS ORTHO'] },
  { id: 'II', chief: 'PROF. DR. K.P. SARAVANAKUMAR MS ORTHO', aps: ['DR. SARAVANAMUTHU MS ORTHO', 'DR. CHANDRU MS ORTHO'] },
  { id: 'III', chief: 'PROF. DR. RAMANATHAN MS ORTHO', aps: ['DR. MANOJ DEEPAK MS ORTHO', 'DR. ANBARASAN MS ORTHO'] },
  { id: 'IV', chief: 'PROF. DR. PATHIARASAKUMAR MS ORTHO', aps: ['DR. BALAJI MS ORTHO', 'DR. SARAVANAN MS ORTHO'] },
  { id: 'V', chief: 'PROF. DR. SENTHIL KUMAR MS ORTHO', aps: ['DR. ALAGURAJESH MS ORTHO', 'DR. MOHAN RAJ MS ORTHO'] },
  { id: 'VI', chief: 'PROF. DR. SINGARAVEL MS ORTHO', aps: ['DR. GOPINATH MS ORTHO', 'DR. GOPI MANOHAR DNB ORTHO'] },
];
// Built-in roster; names edited in Settings (meta.roster) take precedence.
function unitOf(id) {
  const base = UNITS.find((u) => u.id === id) || UNITS[0];
  const o = (typeof Store !== 'undefined' && Store.meta.roster?.[base.id]) || {};
  return { id: base.id, chief: o.chief || base.chief, aps: o.aps?.length ? o.aps : base.aps };
}
const allUnits = () => UNITS.map((u) => unitOf(u.id));
const unitName = (id) => 'UNIT ' + unitOf(id).id;

// Defaults match the unit's letterhead; editable in Settings.
const DEFAULT_META = {
  institution: 'Govt. Rajaji Hospital & Madurai Medical College',
  department: 'Department of Orthopaedic Surgery & Traumatology',
  unitId: 'I',
  opd: '802',
};

// ---- Investigations ------------------------------------------------------
// Standard parameters from the unit's reference table. `scale` lets people
// type counts the way they say them (WBC 8.4 → 8,400; PLT 2.4 → 2,40,000).
const LAB_GROUPS = [
  { k: 'cbc', label: 'CBC', params: [
    { k: 'hb', label: 'Hb', range: '10 – 17.5', unit: 'g/dL' },
    { k: 'wbc', label: 'WBC', range: '4,000 – 11,000', unit: 'cells/µL', scale: 1000 },
    { k: 'plt', label: 'PLT', range: '1,50,000 – 4,50,000', unit: 'cells/µL', scale: 100000 },
  ] },
  { k: 'rft', label: 'RFT', params: [
    { k: 'rbs', label: 'RBS', range: '70 – 140', unit: 'mg/dL' },
    { k: 'urea', label: 'Urea', range: '15 – 40', unit: 'mg/dL' },
    { k: 'creat', label: 'Creat', range: '0.5 – 1.2', unit: 'mg/dL' },
    { k: 'na', label: 'Na', range: '135 – 145', unit: 'mEq/L' },
    { k: 'k', label: 'K', range: '3.5 – 5.0', unit: 'mEq/L' },
  ] },
  { k: 'lft', label: 'LFT', params: [
    { k: 'tbili', label: 'T.Bili', range: '0.2 – 1.2', unit: 'mg/dL' },
    { k: 'dbili', label: 'D.Bili', range: '0.0 – 0.3', unit: 'mg/dL' },
    { k: 'ibili', label: 'I.Bili', range: '0.1 – 1.0', unit: 'mg/dL' },
    { k: 'sgot', label: 'SGOT', range: '10 – 40', unit: 'U/L' },
    { k: 'sgpt', label: 'SGPT', range: '7 – 56', unit: 'U/L' },
    { k: 'alp', label: 'ALP', range: '44 – 147', unit: 'U/L' },
  ] },
  { k: 'inflam', label: 'Inflammatory markers', optional: true, params: [
    { k: 'esr', label: 'ESR', range: '0 – 20', unit: 'mm/hr' },
    { k: 'crp', label: 'qCRP', range: '< 5', unit: 'mg/L' },
  ] },
  { k: 'vm', label: 'VM', long: 'Viral markers', params: [
    { k: 'hbsag', label: 'HBsAg', range: 'Negative', options: ['Negative', 'Positive'] },
    { k: 'hcv', label: 'HCV', range: 'Negative', options: ['Negative', 'Positive'] },
  ] },
  { k: 'vctc', label: 'VCTC', params: [
    { k: 'hiv', label: 'HIV', range: 'Non-reactive', options: ['Non-reactive', 'Reactive'] },
  ] },
];
const ALL_PARAMS = LAB_GROUPS.flatMap((g) => g.params.map((p) => ({ ...p, group: g })));

// Work-up items shown with the investigations. ECG is a tick; ECHO is text;
// PAC is a status with a note of the work pending before assessment.
const PAC_OPTIONS = ['Assessed', 'Provisionally assessed', 'Not assessed'];
const WORKUP = [
  { k: 'ecg', label: 'ECG', type: 'check' },
  { k: 'echo', label: 'ECHO', long: 'ECHO & cardio opinion' },
  { k: 'anaes', label: 'PAC', long: 'Anaesthesia assessment', type: 'pac' },
];
function workDone(c, w) {
  const v = c.work?.[w.k];
  return w.type === 'pac' ? v === 'Assessed' : hasText(v);
}
function workText(c, w) {
  const v = c.work?.[w.k];
  if (w.type === 'check') return v ? 'Taken' : '';
  if (w.type === 'pac') {
    if (!v) return '';
    const p = c.work?.anaesPending;
    return v !== 'Assessed' && hasText(p) ? `${v} — pending: ${p}` : v;
  }
  return v || '';
}
const hasPreopXray = (c) => Object.values(c.images || {}).some((i) => i.kind === 'xray');

// Image types. `deck` is the slide title used in the admission-day deck.
// `admission` = taken at admission (add-case page, admission-day deck).
const IMAGE_KINDS = [
  { k: 'xray', label: 'X-ray', deck: 'X-RAY', admission: true },
  { k: 'ct', label: 'CT', deck: 'CT', admission: true },
  { k: 'mri', label: 'MRI', deck: 'MRI', admission: true },
  { k: 'wound', label: 'Wound pic', deck: 'WOUND PIC', admission: true },
  { k: 'prxray', label: 'Post-reduction X-ray', deck: 'POST-REDUCTION X-RAY' },
  { k: 'poxray', label: 'Post-op X-ray', deck: 'POST-OP X-RAY' },
  { k: 'powound', label: 'Post-op wound pic', deck: 'POST-OP WOUND PIC' },
];
const ADMISSION_KINDS = IMAGE_KINDS.filter((k) => k.admission);
// Upload buttons on the add-case page: admission pictures plus post-op X-ray.
const ADD_CASE_KINDS = IMAGE_KINDS.filter((k) => k.admission || k.k === 'poxray');
// Admission day PPT upload buttons: admission pictures + post-reduction and post-op X-rays
// (+ "Custom": each batch is its own slide, kind custom-1, custom-2…, with a title you type).
const DECK_KINDS = [...ADMISSION_KINDS, ...IMAGE_KINDS.filter((k) => k.k === 'prxray' || k.k === 'poxray')];
const imageKind = (k) => IMAGE_KINDS.find((x) => x.k === k)
  || (/^custom/.test(k) ? { k, label: 'Custom', deck: 'CUSTOM' } : { k, label: k, deck: String(k).toUpperCase() });

// Admission-day deck (same lists as the unit's admission-deck tool).
const MODES = ['MLC/RTA', 'MLC/OLD RTA', 'MLC/TTA', 'NMLC/FALL', 'MLC/FALL FROM HEIGHT', 'MLC/ASSAULT', 'NMLC/ACCIDENTAL INJURY', 'MLC/WORKSPOT INJURY', 'MLC/SELF INFLICTED', 'MLC/ELECTROCUTION'];

const OPINION_DEPTS = [
  'General Medicine', 'Cardiology', 'Pulmonology', 'Nephrology', 'Neurology',
  'Endocrinology', 'Diabetology', 'ENT', 'Dental', 'Psychiatry',
  'Plastic Surgery', 'Vascular Surgery', 'Neurosurgery', 'CTVS', 'General Surgery', 'Urology', 'Obstetrics & Gynaecology',
];

function parseNum(v, p = {}) {
  const m = String(v ?? '').trim().toLowerCase().replace(/,/g, '').match(/^[<>]?\s*(\d*\.?\d+)\s*(lakhs?|lacs?|l|k)?\b/);
  if (!m) return NaN;
  let n = parseFloat(m[1]);
  if (m[2] === 'k') n *= 1000;
  else if (m[2]) n *= 100000;
  else if (p.scale && n < 100) n *= p.scale;
  return n;
}

function parseRange(r) {
  const s = String(r || '').replace(/,/g, '').trim();
  let m;
  if ((m = s.match(/^<\s*=?\s*(\d*\.?\d+)/))) return { hi: +m[1] };
  if ((m = s.match(/^>\s*=?\s*(\d*\.?\d+)/))) return { lo: +m[1] };
  if ((m = s.match(/(\d*\.?\d+)\s*(?:–|-|to)\s*(\d*\.?\d+)/))) return { lo: +m[1], hi: +m[2] };
  return s ? { normal: s.toLowerCase() } : {};
}

// 'high' | 'low' | 'abn' | ''
function flagOf(value, p) {
  if (value == null || String(value).trim() === '') return '';
  const r = parseRange(p.range);
  if (r.normal) return String(value).trim().toLowerCase() === r.normal ? '' : 'abn';
  const n = parseNum(value, p);
  if (isNaN(n)) return '';
  if (r.hi != null && n > r.hi) return 'high';
  if (r.lo != null && n < r.lo) return 'low';
  return '';
}
const FLAG_MARK = { high: ' ↑', low: ' ↓', abn: '', '': '' };

// Value as shown to people: with its unit, and shorthand counts written out
// (PLT 2.4 → 2,40,000 cells/µL).
function fmtVal(v, p) {
  const raw = String(v ?? '').trim();
  if (!raw || p.options) return raw;
  let shown = raw;
  if (p.scale && /^\d*\.?\d+\s*(l|lakhs?|lacs?|k)?$/i.test(raw.replace(/,/g, ''))) {
    const n = parseNum(raw, p);
    if (!isNaN(n)) shown = Math.round(n).toLocaleString('en-IN');
  }
  return p.unit ? `${shown} ${p.unit}` : shown;
}

const listOf = (map) => Object.entries(map || {})
  .map(([id, v]) => ({ id, ...v }))
  .sort((a, b) => (a.at || 0) - (b.at || 0));

function customParams(c) {
  return listOf(c.custom).map((x) => ({ k: 'x_' + x.id, label: x.label, range: x.range, unit: x.unit, custom: true }));
}

function labSets(c) {
  return listOf(c.labs).sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.at || 0) - (b.at || 0));
}

// Every dated result for the case: investigation sets and chart entries.
function allEntries(c) {
  const out = labSets(c).map((s) => ({ date: s.date || '', time: '', at: s.at || 0, v: s.v || {} }));
  for (const ch of Object.values(c.charts || {})) {
    for (const r of Object.values(ch.rows || {})) out.push({ date: r.date || '', time: r.time || '', at: r.at || 0, v: r.v || {} });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time) || a.at - b.at);
}

function latest(c, key) {
  const all = allEntries(c);
  for (let i = all.length - 1; i >= 0; i--) {
    const v = all[i].v[key];
    if (v != null && String(v).trim() !== '') return { value: String(v).trim(), date: all[i].date };
  }
  return null;
}

const hasText = (x) => x != null && String(x).trim() !== '';

function pendingList(c) {
  const out = [];
  for (const g of LAB_GROUPS) {
    if (g.optional) continue;
    const missing = g.params.filter((p) => !latest(c, p.k));
    if (missing.length === g.params.length) out.push({ kind: 'inv', text: g.label });
    else if (missing.length) out.push({ kind: 'inv', text: `${g.label}: ${missing.map((p) => p.label).join(', ')}` });
  }
  for (const p of customParams(c)) if (!latest(c, p.k)) out.push({ kind: 'inv', text: p.label });
  if (!hasPreopXray(c)) out.push({ kind: 'inv', text: 'X-ray' });
  for (const w of WORKUP) {
    if (workDone(c, w)) continue;
    const p = w.type === 'pac' ? c.work?.anaesPending : '';
    out.push({ kind: 'inv', text: hasText(p) ? `PAC: ${p}` : w.label });
  }
  for (const o of listOf(c.opinions)) if (!hasText(o.note)) out.push({ kind: 'inv', text: o.dept + ' op.' });
  for (const t of listOf(c.tasks)) if (!t.done) out.push({ kind: 'task', text: t.text + (t.to ? ` → ${t.to}` : '') });
  return out;
}

// Ward notebook "To do's", two editable boxes shared with the e-case sheet.
// 1. Investigation: only what someone typed (no automatic suggestions).
function invTodoText(c) {
  return c.invTodo || '';
}
// 2. Opinion / to-do: pending opinions ("CARDIOLOGY OPINION") and open pending works, one per line.
const opLine = (o) => `${String(o.dept || '').toUpperCase()} OPINION`;
const taskLine = (t) => String(t.text || '').toUpperCase();
function opTodoText(c) {
  return [...listOf(c.opinions).filter((o) => !hasText(o.note)).map(opLine), ...listOf(c.tasks).filter((t) => !t.done).map(taskLine)].join('\n');
}
// Edited box → case changes: a removed line marks that opinion obtained / that work done; a new
// line becomes an opinion if it says OPINION or starts with a department, otherwise a pending work.
function opTodoChanges(c, text, who) {
  const lines = String(text || '').split('\n').map((l) => l.trim().toUpperCase().replace(/\s+/g, ' ')).filter(Boolean);
  const left = [...lines];
  const ch = {};
  const now = Date.now();
  const take = (line) => { const i = left.indexOf(line); if (i < 0) return false; left.splice(i, 1); return true; };
  for (const o of listOf(c.opinions).filter((x) => !hasText(x.note))) if (!take(opLine(o))) ch[`opinions.${o.id}.note`] = 'OPINION OBTAINED';
  for (const t of listOf(c.tasks).filter((x) => !x.done)) {
    if (!take(taskLine(t))) Object.assign(ch, { [`tasks.${t.id}.done`]: true, [`tasks.${t.id}.doneBy`]: who, [`tasks.${t.id}.doneAt`]: now });
  }
  const depts = OPINION_DEPTS.map((d) => d.toUpperCase());
  left.forEach((line, i) => {
    const id = now.toString(36) + i + Math.random().toString(36).slice(2, 6);
    const isOp = /\b(OPINION|OPN|REFERRAL)\b/.test(line) || depts.some((d) => line.startsWith(d));
    if (isOp) {
      const dept = line.replace(/\b(OPINION|OPN|REFERRAL)\b\.?/g, ' ').replace(/^[\s:\-–]+|[\s:\-–]+$/g, '').replace(/\s+/g, ' ') || line;
      ch['opinions.' + id] = { dept, note: '', at: now };
    } else {
      ch['tasks.' + id] = { text: line, to: '', done: false, by: who, at: now };
    }
  });
  return ch;
}

// The ward notebook's "To do's": pending opinions, investigations to repeat (the deranged
// ones, by name only), and the to-do list. Deranged values themselves are not listed.
function notebookTodo(c) {
  const out = [];
  for (const o of listOf(c.opinions)) if (!hasText(o.note)) out.push({ kind: 'inv', text: `${String(o.dept).toUpperCase()} OPINION` });
  const rep = [...new Set(abnormalList(c).map((x) => x.label))];
  if (rep.length) out.push({ kind: 'flag', text: 'REPEAT ' + rep.join(', ').toUpperCase() });
  for (const t of listOf(c.tasks)) if (!t.done) out.push({ kind: 'task', text: t.text + (t.to ? ` → ${t.to}` : '') });
  return out;
}

function abnormalList(c) {
  const out = [];
  const seen = new Set();
  const check = (p) => {
    if (seen.has(p.k) || p.text) return;
    seen.add(p.k);
    const l = latest(c, p.k);
    const f = l && flagOf(l.value, p);
    if (f) out.push({ kind: 'flag', label: p.label, text: `${p.label} ${fmtVal(l.value, p)}${FLAG_MARK[f]}` });
  };
  [...ALL_PARAMS, ...customParams(c)].forEach(check);
  Object.values(c.charts || {}).forEach((ch) => (ch.cols || []).forEach(check));
  return out;
}

// ---- Monitoring charts ---------------------------------------------------
const P = (k) => ALL_PARAMS.find((p) => p.k === k);
const CHART_TEMPLATES = {
  rft: {
    title: 'RFT chart',
    why: 'CKD / AKI',
    match: /\b(ckd|aki|kidney|renal|nephro)/i,
    cols: [P('urea'), P('creat'), P('na'), P('k'), { k: 'uo', label: 'Urine output', unit: 'mL/24 h', range: '> 400' }, { k: 'note', label: 'Remarks', text: true }],
  },
  inflam: {
    title: 'ESR / CRP chart',
    why: 'Wound / infection',
    match: /\b(wound|compound|open (fracture|#)|infect|osteomyelitis|cellulitis|abscess|pus|debridement|sequestrectomy|ssi)/i,
    cols: [P('esr'), P('crp'), P('wbc'), { k: 'wound', label: 'Wound status', text: true }, { k: 'note', label: 'Remarks', text: true }],
  },
  dm: {
    title: 'Diabetic chart',
    why: 'Diabetes',
    match: /\b(dm|t1dm|t2dm|diabet|niddm|iddm)/i,
    cols: [
      { k: 'fbs', label: 'FBS', unit: 'mg/dL', range: '70 – 100' },
      { k: 'ppbs', label: 'PPBS', unit: 'mg/dL', range: '< 140' },
      P('rbs'),
      { k: 'ins_m', label: 'Insulin M', unit: 'U' },
      { k: 'ins_a', label: 'Insulin A', unit: 'U' },
      { k: 'ins_n', label: 'Insulin N', unit: 'U' },
      { k: 'ins_type', label: 'Insulin type', text: true },
      { k: 'note', label: 'Remarks', text: true },
    ],
  },
};
const chartCol = (col) => ({ k: col.k, label: col.label, unit: col.unit || '', range: col.range || '', ...(col.scale ? { scale: col.scale } : {}), ...(col.text ? { text: true } : {}) });

// A chart's rows, plus investigation sets that carry any of its columns
// (so an RFT chart shows the RFTs entered under Investigations too).
function chartRows(c, ch) {
  const keys = (ch.cols || []).filter((x) => !x.text).map((x) => x.k);
  const own = listOf(ch.rows).map((r) => ({ ...r, src: 'chart' }));
  const inv = labSets(c).filter((s) => keys.some((k) => hasText(s.v?.[k]))).map((s) => ({ id: s.id, date: s.date || '', time: '', at: s.at || 0, v: s.v, src: 'inv' }));
  return [...own, ...inv].sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.time || '').localeCompare(b.time || '') || (a.at || 0) - (b.at || 0));
}

function suggestedCharts(c) {
  const have = new Set(Object.values(c.charts || {}).map((ch) => ch.type));
  return Object.entries(CHART_TEMPLATES).filter(([t, tpl]) => !have.has(t) && tpl.match.test(`${c.comorbid || ''} ${c.diagnosis || ''} ${c.plan || ''}`)).map(([t]) => t);
}

function readiness(c) {
  let total = 0;
  let done = 0;
  const tick = (ok) => { total++; if (ok) done++; };
  for (const g of LAB_GROUPS) if (!g.optional) g.params.forEach((p) => tick(latest(c, p.k)));
  customParams(c).forEach((p) => tick(latest(c, p.k)));
  WORKUP.forEach((w) => tick(workDone(c, w)));
  tick(hasPreopXray(c));
  listOf(c.opinions).forEach((o) => tick(hasText(o.note)));
  return { done, total, ready: total > 0 && done === total };
}

function ageSex(c) {
  return [c.age, c.sex].filter(Boolean).join('/');
}

// Older saves stored labs as inv.cbc.hb etc.; fold them into one dated set.
function migrateCase(c) {
  // Earlier versions kept PAC as free text: map it onto the dropdown.
  const a = c.work?.anaes;
  if (hasText(a) && !PAC_OPTIONS.includes(a)) {
    const fit = /\b(fit|assessed|asa)\b/i.test(a) && !/\b(unfit|not|pending|provision)/i.test(a);
    c.work.anaes = fit ? 'Assessed' : 'Not assessed';
    if (!fit && !hasText(c.work.anaesPending)) c.work.anaesPending = a;
  }
  if (!c.inv || c.labs) return c;
  const map = { cbc: { hb: 'hb', wbc: 'wbc', plt: 'plt' }, rft: { u: 'urea', c: 'creat', na: 'na', k: 'k' }, lft: { tbili: 'tbili', sgot: 'sgot', sgpt: 'sgpt' }, esr: { v: 'esr' }, crp: { v: 'crp' } };
  const v = {};
  for (const [g, fields] of Object.entries(map)) for (const [f, k] of Object.entries(fields)) if (hasText(c.inv[g]?.[f])) v[k] = c.inv[g][f];
  if (Object.keys(v).length) c.labs = { m0: { date: c.doa || '', at: c.createdAt || 0, v } };
  c.work ||= {};
  for (const k of ['ecg', 'echo', 'anaes']) if (hasText(c.inv[k]?.note) && !hasText(c.work[k])) c.work[k] = c.inv[k].note;
  if (hasText(c.inv.pus?.note) && !c.pus) c.pus = { organism: c.inv.pus.note };
  delete c.inv;
  return c;
}

// ---- Level of surgery (Weighted Orthopaedic Procedure List) -------------

const LEVEL_INFO = {
  IV: { title: 'High complexity / super-specialty', weight: 2.0 },
  III: { title: 'Major procedures', weight: 1.5 },
  II: { title: 'Intermediate procedures', weight: 1.0 },
  I: { title: 'Minor / day-care procedures', weight: 0.5 },
};

// [level, category, procedure, match words]
const SEED_LEVELS = [
  ['IV', 'Arthroplasty', 'Revision total hip / knee arthroplasty', 'revision thr, revision tkr, revision tha, revision tka, revision arthroplasty'],
  ['IV', 'Arthroplasty', 'Complex primary arthroplasty with bone grafting / augments', 'augment, augments, complex primary'],
  ['IV', 'Spine', 'Pedicle screw fixation', 'pedicle screw, pedicle screws, psf'],
  ['IV', 'Spine', 'TLIF / PLIF', 'tlif, plif'],
  ['IV', 'Spine', 'Scoliosis correction', 'scoliosis'],
  ['IV', 'Spine', 'Spinal decompression with instrumentation', 'decompression with instrumentation, decompression and fixation, decompression and instrumentation'],
  ['IV', 'Trauma', 'Pelvic fracture fixation', 'pelvic fracture, pelvic fixation, pelvic ring, si screw, symphysis plating'],
  ['IV', 'Trauma', 'Acetabular fracture fixation', 'acetabulum, acetabular fracture, acetabular fixation'],
  ['IV', 'Trauma', 'Neglected / malunited intra-articular fractures', 'neglected, malunited, malunion'],
  ['IV', 'Oncology', 'Limb salvage surgery (megaprosthesis)', 'megaprosthesis, limb salvage'],
  ['IV', 'Oncology', 'Resection of bone tumours', 'tumour resection, tumor resection, wide resection, en bloc resection'],
  ['IV', 'Microvascular', 'Free tissue transfer / microvascular flaps', 'free flap, free fibula, microvascular, free tissue transfer'],
  ['III', 'Joint replacement', 'Primary total knee arthroplasty (TKA)', 'tkr, tka, total knee'],
  ['III', 'Joint replacement', 'Total hip arthroplasty (THA)', 'thr, tha, total hip'],
  ['III', 'Sports medicine', 'Multi-ligament knee reconstruction (ACL + PCL/MCL)', 'multiligament, multi-ligament, multi ligament, pcl, mcl reconstruction'],
  ['III', 'Sports medicine', 'Shoulder arthroscopy (Bankart / rotator cuff repair)', 'bankart, rotator cuff, cuff repair, shoulder arthroscopy'],
  ['III', 'Trauma', 'Proximal femoral nailing (PFN)', 'pfn, pfna, proximal femoral nail, proximal femoral nailing'],
  ['III', 'Trauma', 'Hemiarthroplasty', 'hemiarthroplasty, bipolar, austin moore'],
  ['III', 'Trauma', 'Complex distal radius / pilon fractures', 'pilon, complex distal radius, intra-articular distal radius'],
  ['III', 'Trauma', 'Arthrodesis', 'arthrodesis'],
  ['III', 'Trauma', 'Hip, knee, shoulder disarticulation', 'disarticulation'],
  ['III', 'Pediatric', 'Corrective osteotomies for deformities (CTEV, DDH)', 'ctev, ddh, corrective osteotomy'],
  ['III', 'Pediatric', 'Pelvic osteotomies', 'pelvic osteotomy, salter, pemberton, dega'],
  ['III', 'Infection', 'Ilizarov ring fixator for non-union / bone transport', 'ilizarov, ring fixator, bone transport'],
  ['II', 'Basic trauma', 'Intramedullary nailing of femur / tibia / humerus', 'iln, ilin, interlocking nail, interlocking nailing, intramedullary nail, intramedullary nailing, im nail, im nailing, nailing'],
  ['II', 'Basic trauma', 'Plating of long bones', 'plating, lcp, dcp, lc-dcp, locking plate, mipo, plate osteosynthesis'],
  ['II', 'Arthroscopy', 'Diagnostic arthroscopy', 'diagnostic arthroscopy, arthroscopy'],
  ['II', 'Arthroscopy', 'Simple meniscectomy', 'meniscectomy'],
  ['II', 'Hand / foot', 'Tendon repairs', 'tendon repair, flexor tendon, extensor tendon, tendo achilles repair, ta repair'],
  ['II', 'Hand / foot', 'Triple arthrodesis', 'triple arthrodesis'],
  ['II', 'Hand / foot', 'Hallux valgus correction', 'hallux valgus, bunion'],
  ['II', 'General', 'Sequestrectomy for chronic osteomyelitis', 'sequestrectomy, saucerisation, saucerization'],
  ['II', 'General', 'Dynamic hip screw (DHS) fixation', 'dhs, dynamic hip screw'],
  ['II', 'General', 'External fixation', 'external fixator, external fixation, ex-fix, exfix, spanning fixator'],
  ['I', 'Trauma', 'K-wiring of small bones', 'k wire, k-wire, kwire, k wiring, k-wiring, crpp'],
  ['I', 'Trauma', 'Closed reduction and internal fixation (CRIF)', 'crif'],
  ['I', 'General', 'Implant removal', 'implant removal, implant exit, hardware removal'],
  ['I', 'General', 'Debridement of open fractures', 'debridement, wound debridement'],
  ['I', 'General', 'Biopsies', 'biopsy'],
  ['I', 'Soft tissue', 'Carpal tunnel release', 'carpal tunnel, ctr'],
  ['I', 'Soft tissue', 'Trigger finger', 'trigger finger, a1 pulley'],
  ['I', 'Soft tissue', 'Excision of lipoma / ganglion', 'lipoma, ganglion'],
].map(([level, category, name, kw], i) => ({
  id: 'wopl' + i,
  level,
  category,
  name,
  keywords: kw.split(',').map((x) => x.trim()).filter(Boolean),
}));

// Every match word found in the plan, as text spans. A match that sits inside
// a longer one is dropped ("arthrodesis" inside "triple arthrodesis").
function levelFor(plan, rules) {
  const hits = [];
  for (const r of Object.values(rules || {})) {
    for (const k of r.keywords || []) {
      if (!k) continue;
      const re = new RegExp(keywordRegex(k).source, 'gi');
      let m;
      while ((m = re.exec(plan || ''))) {
        const start = m.index + m[1].length;
        const end = m.index + m[0].length - m[2].length;
        hits.push({ r, start, end });
        re.lastIndex = Math.max(end, m.index + 1);
      }
    }
  }
  const kept = hits.filter((h) => !hits.some((o) => o !== h && o.start <= h.start && o.end >= h.end && o.end - o.start > h.end - h.start));
  const rules2 = [...new Set(kept.map((h) => h.r))];
  const best = rules2.reduce((a, r) => (LEVELS.indexOf(r.level) > LEVELS.indexOf(a?.level) ? r : a), null);
  return { level: best?.level || '', rule: best, matches: rules2 };
}

// ---- Implants used, read from operative notes -------------------------------
// Picks out phrases like "10MM X 250MM SHORT PFN", "6.2MM DEROTATION SCREW",
// "4.5MM 8 HOLE LCP" from free-text notes. The result is editable.
const IMPLANT_WORDS = 'tension band wiring|nails?|plates?|screws?|k-?wires?|wires?|bolts?|prosthes[ie]s|bipolar|austin moore|stems?|cups?|liners?|cages?|rods?|pins?|anchors?|endobuttons?|bone cement|fixators?|clamps?|washers?|lcp|dcp|lc-dcp|pfna?|dhs|dcs|iln|ilin|tens|philos|lrs|ex-?fix|staples?|tension band|tbw|interference screws?';
const IMPLANT_RE = new RegExp(
  `((?:\\d[\\d./]*\\s*(?:mm|cm|g|hole[sd]?)?\\s*(?:[x×*]\\s*\\d[\\d.]*\\s*(?:mm|cm)?\\s*)?)?(?:[a-z0-9.-]+\\s+){0,4}?(?:${IMPLANT_WORDS})(?:\\s+(?:${IMPLANT_WORDS}))?(?:\\s+(?:size|no\\.?|#)\\s*\\d[\\d.]*)?)\\b`, 'gi');
const IMPLANT_STOP = new Set(['with', 'and', 'using', 'used', 'fixed', 'fixation', 'inserted', 'insertion', 'was', 'were', 'is', 'a', 'an', 'the', 'by', 'of', 'over', 'into', 'then', 'distally', 'proximally', 'locked', 'locking-', 'placed', 'passed', 'applied', 'done', 'reduction', 'reduced', 'under', 'through', 'via', 'after', 'followed', 'secured', 'stabilised', 'stabilized', 'achieved', 'in', 'on', 'to', 'for', 'one', 'and/or']);
const NOT_IMPLANT = /\b(no|removed?|removal|broken|old|guide wires?|drill|wound closed|skin|sutures?)\b/i;

function extractImplants(notes) {
  const out = [];
  for (const clause of String(notes || '').split(/[\n;.](?!\d)|,\s*(?=[a-z]*\s*\d)|\band\b|\bwith\b/i)) {
    if (NOT_IMPLANT.test(clause)) continue;
    let m;
    IMPLANT_RE.lastIndex = 0;
    while ((m = IMPLANT_RE.exec(clause))) {
      const words = m[1].trim().split(/\s+/);
      while (words.length > 1 && IMPLANT_STOP.has(words[0].toLowerCase())) words.shift();
      const phrase = words.join(' ').toUpperCase().replace(/\s+([X×*])\s+/g, ' X ');
      // Keep phrases with a size, a named implant system, or a describing word
      // ("AO CLAMPS", "UNCEMENTED STEM"); drop a bare "PLATE".
      if (!/\d/.test(phrase) && words.length < 2 && !/\b(PFNA?|DHS|DCS|ILN|ILIN|TENS|PHILOS|LRS|LCP|DCP|BIPOLAR|TBW|ENDOBUTTONS?)\b/.test(phrase)) continue;
      if (!out.some((x) => x === phrase || x.includes(phrase))) {
        for (let i = out.length - 1; i >= 0; i--) if (phrase.includes(out[i])) out.splice(i, 1);
        out.push(phrase);
      }
    }
  }
  return out.join(', ');
}

// ---- Implant matching ---------------------------------------------------

function keywordRegex(k) {
  const e = k.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s*');
  return new RegExp(`(^|[^a-z0-9])${e}([^a-z0-9]|$)`, 'i');
}

// A rule matches when its procedure words (`keywords`, or else its name)
// appear in the plan, and — if it lists a `site` — that bone / region is in
// the plan or diagnosis. `exclude` words (in plan or diagnosis) veto it.
const kwHit = (list, text) => (list || []).some((k) => k && keywordRegex(k).test(text));
function matchImplants(plan, rules, diagnosis = '') {
  if (!plan) return [];
  const both = `${plan} ${diagnosis || ''}`;
  return Object.values(rules || {})
    .filter((r) => kwHit(r.keywords?.length ? r.keywords : [r.name], plan))
    .filter((r) => !r.site?.length || kwHit(r.site, both))
    .filter((r) => !kwHit(r.exclude, both))
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || (a.name || '').localeCompare(b.name || ''));
}

function suggestFromPlan(plan, rules, diagnosis = '') {
  const m = matchImplants(plan, rules, diagnosis);
  // Join the matched lists, dropping repeated items (e.g. 8MM CERVICAL SCREW in short and long PFN).
  const seen = new Set();
  const items = [];
  for (const r of m) {
    // Items are separated by ", "; sizes like 8,9,10 have no space and stay whole.
    for (const part of String(r.implants || '').split(/,\s+/)) {
      const t = part.trim();
      if (!t || t.toUpperCase() === 'NIL' || seen.has(t.toUpperCase())) continue;
      seen.add(t.toUpperCase());
      items.push(t);
    }
  }
  return { matches: m, implants: items.join(', ') };
}

// ---- Previous OT lists (OT_HISTORY, js/ot-history.js) ---------------------
// A new case is compared with every past case: procedure and bone must
// agree; side, spelling and filler words are ignored. The most similar
// (most recent on a tie) gives the implants, exactly as written then.
const OT_SYNONYMS = [
  [/#/g, ' FRACTURE '], [/\bCR\s*\/\s*ORIF\b|\bCR\s*\/\s*IF\b|\bCRIF\b|\bCRPP\b/g, ' CRIF '], [/\bOSTEOSYN\s*THESIS\b|\bOSSTEOSYNTHESIS\b|\bPLATEOSTEOSYNTHESIS\b/g, ' PLATE OSTEOSYNTHESIS '],
  [/\bINTRA\s*MEDULLARY\b|\bINTRAMEDULLARY\b|\bINTERLOCKING\b|\bILN\b|\bILIN\b|\bIMIL\b|\bIM\b/g, ' IMIL '], [/\bNAILING\b|\bNAILS?\b/g, ' NAIL '],
  [/\bPLATING\b|\bPLATES\b/g, ' PLATE '], [/\bK[-\s]?WIRES?\b|\bK[-\s]?WIRING\b|\bKWIRES?\b/g, ' KWIRE '], [/\bHEMI\s*ARTHROPLASTY\b|\bBIPOLAR\b|\bAUSTIN[-\s]*MOORE\b|\bAMP\b/g, ' HEMIARTHROPLASTY '],
  [/\bNOF\b/g, ' NECK FEMUR '], [/\bIT\b|\bINTER\s*TROCHANTERIC\b|\bINTERTROCHANTER\b/g, ' INTERTROCHANTERIC '], [/\bSUB\s*TROCHANTERIC\b|\bSUBTROCHANTER\b/g, ' SUBTROCHANTERIC '],
  [/\bBB\b|\bBOTH\s*BONES?\b/g, ' BOTHBONE '], [/\bEX[-\s]?FIX\b|\bEXTERNAL\s*FIXATORS?\b|\bEXTERNAL\s*FIXATION\b/g, ' EXFIX '], [/\bTENSION\s*BAND\s*WIRING\b|\bTBW\b/g, ' TBW '],
  [/\bCANCELLOUS\s*SCREWS?\b|\bCC\s*SCREWS?\b|\bCCS\b/g, ' CCSCREW '], [/\bSUPRA\s*CONDYLAR\b|\bSUPRACONYLAR\b/g, ' SUPRACONDYLAR '], [/\bCALCANEUS\b|\bCALCANEAL\b/g, ' CALCANEUM '],
  [/\bMALLEOL\w*\b|\bBIMALLEOLAR\b|\bTRIMALLEOLAR\b/g, ' MALLEOLUS '], [/\bVERTEBRA\w*\b|\b[CDTL]\d{1,2}\b/g, ' SPINE '],
];
const OT_STOP = new Set(['LEFT', 'RIGHT', 'LT', 'RT', 'BILATERAL', 'WITH', 'AND', 'OF', 'THE', 'FOR', 'TO', 'A', 'AN', 'IN', 'ON', 'AT', 'UNDER', 'CLOSED', 'SIMPLE', 'TYPE', 'FRACTURE', 'FRACTURES', 'SIDE', 'HIP', 'JOINT', 'REGION', 'MIDDLE', 'MID', 'THIRD', '3RD', 'PROXIMAL', 'DISTAL', 'SHAFT', 'ORIF', 'CRIF', 'OPEN', 'REDUCTION', 'INTERNAL', 'FIXATION', 'OSTEOSYNTHESIS']);
// Words that decide the implants: if the new case has one, the past case must too.
const OT_KEY = ['PFN', 'PFNA', 'SHORT', 'LONG', 'DHS', 'DCS', 'IMIL', 'RETROGRADE', 'TENS', 'PLATE', 'KWIRE', 'CCSCREW', 'HEMIARTHROPLASTY', 'THR', 'TKR', 'EXFIX', 'LRS', 'ILIZAROV', 'TBW', 'PEDICLE', 'SPINE', 'EXIT', 'REMOVAL', 'ARTHROSCOPIC', 'ARTHROSCOPY', 'ACL', 'BIOPSY', 'DEBRIDEMENT', 'SSG', 'AMPUTATION', 'CERCLAGE', 'BONE', 'GRAFT', 'GRAFTING', 'HYBRID', 'RING', 'ACDF', 'ANTERIOR', 'POSTERIOR', 'REVISION', 'INJECTION', 'RECON', 'ACETABULUM', 'FEMORAL', 'GUIDED', 'ULTRASOUNDED', 'ULTRASOUND'];
const OT_BONES = ['FEMUR', 'TIBIA', 'FIBULA', 'HUMERUS', 'RADIUS', 'ULNA', 'FOREARM', 'CLAVICLE', 'MALLEOLUS', 'ANKLE', 'PATELLA', 'OLECRANON', 'CALCANEUM', 'SPINE', 'ACETABULUM', 'PELVIS', 'SCAPULA', 'METACARPAL', 'METATARSAL', 'PHALANX', 'NECK', 'INTERTROCHANTERIC', 'SUBTROCHANTERIC', 'SUPRACONDYLAR', 'LEG', 'WRIST', 'ELBOW', 'KNEE', 'SHOULDER', 'BOTHBONE'];

function otTokens(text) {
  let t = ` ${String(text || '').toUpperCase()} `;
  for (const [re, to] of OT_SYNONYMS) t = t.replace(re, to);
  return new Set(t.replace(/[^A-Z0-9]+/g, ' ').split(' ').filter((w) => w && w.length > 1 && !OT_STOP.has(w) && !/^\d+$/.test(w)));
}
const dice = (a, b) => {
  if (!a.size || !b.size) return 0;
  let n = 0;
  for (const x of a) if (b.has(x)) n++;
  return (2 * n) / (a.size + b.size);
};
let otIndex = null;
function otIndexed() {
  otIndex ||= (typeof OT_HISTORY === 'undefined' ? [] : OT_HISTORY).filter((r) => r.implants).map((r) => {
    const plan = otTokens(r.plan);
    const all = new Set([...plan, ...otTokens(r.dx)]);
    return { r, plan, dx: otTokens(r.dx), all };
  });
  return otIndex;
}

// → { entry, score } or null
function matchOtHistory(plan, diagnosis, skip) {
  const qp = otTokens(plan);
  const qd = otTokens(diagnosis);
  const qa = new Set([...qp, ...qd]);
  if (!qp.size) return null;
  const keys = OT_KEY.filter((k) => qp.has(k));
  const bones = OT_BONES.filter((k) => qa.has(k));
  const scored = [];
  for (const it of otIndexed()) {
    if (it.r === skip) continue;
    if (keys.some((k) => !it.plan.has(k) && !it.dx.has(k))) continue; // different procedure
    if (bones.length && !bones.some((k) => it.all.has(k))) continue; // different bone
    // A past case with extra procedures the new one doesn't mention ("implant
    // exit WITH EXTERNAL FIXATOR") is a weaker match.
    const extra = OT_KEY.filter((k) => it.plan.has(k) && !qp.has(k)).length;
    const score = (0.65 * dice(qp, it.plan) + 0.35 * dice(qd, it.dx)) * 0.8 ** extra;
    scored.push({ entry: it.r, score });
  }
  if (!scored.length) return null;
  const top = Math.max(...scored.map((x) => x.score));
  if (top < 0.45) return null;
  // Near-ties (within 0.05) go to the most recent OT list.
  return scored.filter((x) => x.score >= top - 0.05).sort((a, b) => b.entry.date.localeCompare(a.entry.date) || b.score - a.score)[0];
}

// Implants for a plan: previous OT lists first, then the reference list.
function suggestImplantsFor(plan, diagnosis, rules) {
  const h = matchOtHistory(plan, diagnosis);
  if (h) return { implants: h.entry.implants, source: 'history', entry: h.entry, score: h.score };
  const r = suggestFromPlan(plan, rules, diagnosis);
  return r.implants ? { implants: r.implants, source: 'list', matches: r.matches } : { implants: '', source: '' };
}

const UNIT_IMPLANTS_REMOVED = ['ot2_15', 'ot2_20', 'ot2_23']; // femur shaft plating, cancellous screws, SS grafting
const UNIT_IMPLANTS_VERSION = 'ot2b';

// Standard plans, filled from the diagnosis until the plan is typed.
function defaultPlanFor(diagnosis) {
  const d = String(diagnosis || '').toUpperCase();
  const side = /\b(LEFT|LT)\b/.test(d) ? ' LEFT' : /\b(RIGHT|RT)\b/.test(d) ? ' RIGHT' : '';
  if (/SUB\s*TROCHANTER/.test(d)) return 'CR/ORIF WITH LONG PFN' + side;
  if (/INTER\s*TROCHANTER|PER\s*TROCHANTER|\bIT\b/.test(d)) return 'CR/ORIF WITH SHORT PFN' + side;
  if (/NECK\s+OF\s+(THE\s+)?FEMUR|FEMORAL\s+NECK|\bNOF\b|NECK\s+FEMUR/.test(d)) return 'HEMIARTHROPLASTY HIP' + side;
  return '';
}

// The unit's implant list (from OT_LIST_2_1.docx). Loaded once into the
// implant database; everything stays editable in Settings.
const PLATE_WORDS = ['plate', 'plating', 'plates', 'osteosynthesis', 'plateosteosynthesis', 'ossteosynthesis'];
const NAIL_WORDS = ['imil', 'iln', 'ilin', 'interlocking', 'nailing', 'nail'];
const UNIT_IMPLANTS = [
  ['Plating — radius / ulna (forearm, Galeazzi)', { keywords: PLATE_WORDS, site: ['radius', 'ulna', 'forearm', 'galeazzi', 'monteggia', 'bbfa', 'bb forearm'], exclude: ['distal radius', 'barton', 'radial head', 'giant cell tumor', 'gct'] }, '6-10 HOLED ASIAN DCP, 3.5MM CORTICAL SCREWS (10-30)'],
  ['Plating — humerus shaft', { keywords: PLATE_WORDS, site: ['shaft of humerus', 'humerus shaft', 'humeral shaft', 'shaft humerus'] }, '6-10 HOLED NARROW DCP, 8-10 HOLED NARROW LCP, 4.5MM CORTICAL SCREWS, 5MM LOCKING SCREWS'],
  ['Plating — clavicle', { keywords: PLATE_WORDS, site: ['clavicle'] }, '6-10 HOLED CLAVICULAR PLATE / RECON PLATE, 3.5MM CORTICAL SCREWS'],
  ['Volar Barton / distal radius', { keywords: [...PLATE_WORDS, 'k wire', 'k-wire', 'kwire'], site: ['barton', 'distal radius'] }, '2-3MM K WIRES, 3-5 HOLED ELLIS PLATE, 3.5MM CORTICAL SCREWS'],
  ['K-wire stabilisation (supracondylar humerus)', { keywords: ['k wire', 'k-wire', 'kwire', 'k wiring', 'crpp'], exclude: ['barton', 'distal radius', 'calcaneum', 'calcaneus'] }, '1.5 / 2.5MM K WIRES'],
  ['TENS nailing', { keywords: ['tens', 'tens nailing', 'elastic nail'] }, '2-3.5MM TENS NAILS'],
  ['Arthroscopic procedures', { keywords: ['arthroscopic', 'arthroscopy'] }, 'ARTHROSCOPIC INSTRUMENTS'],
  ['ACL reconstruction', { keywords: ['acl', 'acl reconstruction', 'aclr'] }, 'INTERFERENTIAL SCREWS'],
  ['IMIL nailing — tibia', { keywords: NAIL_WORDS, site: ['tibia', 'tibial', 'leg'], exclude: ['tens', 'femur', 'femoral'] }, '8,9,10 * 320-360MM IMIL TIBIA NAIL, 4.9MM LOCKING BOLTS'],
  ['IMIL nailing — femur', { keywords: NAIL_WORDS, site: ['femur', 'femoral'], exclude: ['tens', 'pfn', 'intertrochanteric', 'subtrochanter', 'subtrochanteric', 'tibia', 'leg'] }, '8,9,10 * 360-440MM IMIL FEMUR NAIL, 4.5MM LOCKING SCREWS'],
  ['Short PFN', { keywords: ['short pfn'] }, '8,9,10 * 250MM SHORT PFN, 8MM CERVICAL SCREW, 6.2MM DEROTATION SCREW, 4.9MM LOCKING BOLTS'],
  ['Long PFN', { keywords: ['long pfn'] }, '8,9,10 * 380-440MM LONG PFN, 8MM CERVICAL SCREW, 6.2MM DEROTATION SCREW, 4.9MM LOCKING BOLTS'],
  ['PFN (length not stated)', { keywords: ['pfn', 'pfna'], exclude: ['short pfn', 'long pfn', 'short/long pfn'] }, '8,9,10 * 250MM SHORT PFN, 8MM CERVICAL SCREW, 6.2MM DEROTATION SCREW, 4.9MM LOCKING BOLTS'],
  ['DHS', { keywords: ['dhs', 'dynamic hip screw'] }, 'DHS SYSTEM, 4-10 HOLED DHS PLATE, RICHARD SCREWS'],
  ['Plating — distal femur (supracondylar)', { keywords: [...PLATE_WORDS, 'retrograde'], site: ['supracondylar femur', 'supraconylar femur', 'distal femur', 'supracondylar # femur', 'supracondylar'], exclude: ['humerus'] }, '8-12 HOLED DFLCP / NON LOCKING PLATE, 4.5MM CORTICAL SCREWS, 4.5MM LOCKING SCREWS, 6.5MM CANCELLOUS SCREWS'],
  ['Plating — femur shaft', { keywords: PLATE_WORDS, site: ['shaft of femur', 'femur shaft', 'femoral shaft', 'shaft femur'], exclude: ['supracondylar', 'distal femur'] }, '8 HOLED NARROW DCP, 4.5MM LOCKING SCREWS'],
  ['Plating — ankle / malleoli', { keywords: [...PLATE_WORDS, 'screw fixation'], site: ['bimalleolar', 'trimalleolar', 'malleolus', 'malleolar', 'ankle'] }, '6-10 HOLED 1/3RD TUBULAR PLATE, 3.5MM CORTICAL SCREWS, 4MM MALLEOLAR SCREWS, WASHER'],
  ['Plating — distal tibia', { keywords: PLATE_WORDS, site: ['tibia', 'leg', 'distal tibia'], exclude: ['malleolus', 'malleolar', 'ankle', 'plateau'] }, '6-10 HOLED DTLCP, LOCKING SCREWS, 4MM CORTICAL SCREWS (30-60), 6-10 HOLED 1/3RD TUBULAR PLATE, 3.5MM CORTICAL SCREWS'],
  ['Bone grafting', { keywords: ['bone grafting', 'bone graft'] }, 'BONE GRAFTING INSTRUMENTS'],
  ['Hemiarthroplasty', { keywords: ['hemiarthroplasty', 'bipolar', 'austin moore', 'austin-moore', 'amp'] }, '41-53 AUSTIN-MOORE / BIPOLAR PROSTHESIS'],
  ['Cancellous screw fixation', { keywords: ['cancellous screw', 'cancellous screws', 'cc screw', 'cc screws', 'ccs'] }, '6.5MM CANCELLOUS SCREW SYSTEM'],
  ['Plating — calcaneum', { keywords: PLATE_WORDS, site: ['calcaneum', 'calcaneus', 'calcaneal'] }, 'CALCANEUM PLATE, 2MM K WIRE, 4MM CANCELLOUS SCREWS (20-50MM)'],
  ['Radial head replacement', { keywords: ['radial head replacement', 'radial head arthroplasty'] }, 'RADIAL HEAD PROSTHESIS'],
  ['Split skin grafting', { keywords: ['ss grafting', 'ssg', 'split skin graft', 'split skin grafting', 'skin grafting'] }, 'HUMPY KNIFE & BLADE'],
  ['Amputation', { keywords: ['amputation'] }, 'GIGLI SAW, SOFT TISSUE INSTRUMENTS'],
  ['Biopsy / excision / curettage / implant exit', { keywords: ['biopsy', 'excision', 'curettage', 'implant exit', 'implant removal'] }, 'SOFT TISSUE INSTRUMENTS'],
].map(([name, m, implants], i) => ({ id: 'ot2_' + String(i).padStart(2, '0'), order: i, name, keywords: m.keywords || [], site: m.site || [], exclude: m.exclude || [], implants }))
  // Removed at the unit's request (ids kept stable for the rest).
  .filter((r) => !UNIT_IMPLANTS_REMOVED.includes(r.id));

const DISPOSITIONS = {
  discharge: { label: 'Discharge', title: '', status: 'discharged', course: 'PATIENT IS BEING DISCHARGED IN A STABLE CONDITION.' },
  dar: { label: 'Discharge at request', title: '', status: 'discharged', course: 'PATIENT DISCHARGED AT REQUEST.' },
  postop: { label: 'Transfer to Post-operative Ward', title: 'TRANSFER SUMMARY', status: 'postop', course: 'PATIENT IS BEING TRANSFERRED TO THE POST-OPERATIVE WARD FOR FURTHER MANAGEMENT.' },
  ama: { label: 'AMA', title: 'DISCHARGED AGAINST MEDICAL ADVICE (AMA)', status: 'discharged', course: 'PATIENT LEFT AGAINST MEDICAL ADVICE. THE CONSEQUENCES WERE EXPLAINED TO THE PATIENT AND ATTENDERS.' },
  absconded: { label: 'Absconded', title: 'ABSCONDED', status: 'discharged', course: 'PATIENT ABSCONDED FROM THE WARD.' },
};


// ---- Discharge helpers --------------------------------------------------

const TA_DAYS = ['ஞாயிற்றுக்கிழமை', 'திங்கட்கிழமை', 'செவ்வாய்க்கிழமை', 'புதன்கிழமை', 'வியாழக்கிழமை', 'வெள்ளிக்கிழமை', 'சனிக்கிழமை'];
const EN_DAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

// Common advice lines with the Tamil line printed for the patient.
const ADVICE_PHRASES = [
  ['CONTINUE ANALGESICS AND ANTIBIOTICS', 'வலி நிவாரண மருந்துகளையும் ஆன்டிபயாடிக் மருந்துகளையும் தொடர்ந்து எடுத்துக் கொள்ளவும்.'],
  ['CONTINUE POP', 'மாவுக்கட்டைத் தொடர்ந்து அணிந்து கொள்ளவும்; ஈரமாக்க வேண்டாம்.'],
  ['CONTINUE LIMB ELEVATION', 'அடிபட்ட கை / காலை உயர்த்தி வைப்பதைத் தொடரவும்.'],
  ['ALTERNATE DAY CLEANING AND DRESSING AT NEARBY GH OR PHC', 'ஒரு நாள் விட்டு ஒரு நாள் அருகிலுள்ள அரசு மருத்துவமனை அல்லது ஆரம்ப சுகாதார நிலையத்தில் காயத்தைச் சுத்தம் செய்து கட்டுப் போட்டுக் கொள்ளவும்.'],
  ['NON-WEIGHT BEARING WALK WITH WALKER SUPPORT', 'வாக்கர் உதவியுடன், அடிபட்ட காலில் எடை போடாமல் நடக்கவும்.'],
  ['CONTINUE ANALGESICS', 'வலி நிவாரண மருந்துகளைத் தொடர்ந்து எடுத்துக் கொள்ளவும்.'],
  ['CONTINUE CUFF & COLLAR', 'கட்டை தொடர்ந்து கட்டிக்கொள்ளவும்.'],
  ['ACTIVE TOE / FINGER MOVEMENTS', 'விரல்களை அடிக்கடி அசைத்துக் கொண்டே இருக்கவும்.'],
  ['KEEP WOUND DRY', 'காயத்தை ஈரமில்லாமல் சுத்தமாக வைக்கவும்.'],
  ['SUTURE REMOVAL ON POD 12', 'அறுவை சிகிச்சைக்குப் பின் 12-ஆம் நாள் தையல் பிரிக்க வரவும்.'],
  ['CONTINUE DIABETIC / ANTIHYPERTENSIVE MEDICATIONS', 'சர்க்கரை / இரத்த அழுத்த மருந்துகளைத் தொடர்ந்து எடுத்துக் கொள்ளவும்.'],
  ['REPORT IMMEDIATELY IF PAIN, SWELLING, NUMBNESS OR DISCOLOURATION', 'வலி, வீக்கம், மரத்துப்போதல் அல்லது நிறமாற்றம் இருந்தால் உடனே மருத்துவமனைக்கு வரவும்.'],
];

// Treatment given — quick-add drug lists.
// Standard treatment for every case.
const STANDARD_TREATMENT = ['IV FLUIDS', 'ANALGESICS'];
const DRUGS_ALL = [
  ...STANDARD_TREATMENT,
  'INJ. HEPARIN 5000 IU SC BD',
  'INJ. PARACETAMOL 1G IV BD',
  'INJ. RANITIDINE 50MG IV BD',
  'INJ. TRAMADOL 100MG IV BD',
];
const DRUGS_SPINE_PELVIS = [
  'INJ. DEXAMETHASONE 8MG IV BD',
  'INJ. DERIPHYLLINE 220MG IV BD',
  'NEB. SALBUTAMOL Q8H',
  'NEB. BUDESONIDE Q12H',
  'INCENTIVE SPIROMETRY',
  'CHEST PHYSIOTHERAPY',
  'ACTIVE AND PASSIVE MOBILISATION OF ALL FOUR LIMBS',
  'LOG ROLL Q2H',
  'ALPHA BED, BBB CARE',
];
const ANTIBIOTICS = [
  'INJ. PIPTAZ 4.5G IV TDS',
  'INJ. GENTAMICIN 80MG IV BD',
  'INJ. CEFTRIAXONE 1G IV BD',
  'INJ. MEROPENEM 1G IV BD',
  'INJ. CEFOPERAZONE SULBACTAM 1.5G IV BD',
  'INJ. CLINDAMYCIN 600MG IV BD',
  'INJ. AMIKACIN 500MG IV OD',
  'INJ. VANCOMYCIN 1G IV BD',
  'T. SEPTRAN 2 BD',
  'C. DOXY BD',
  'T. CEFIXIME BD',
  'C. CEPHALEXIN BD',
  'T. PENICILLIN BD',
];
const isSpinePelvis = (c) => /\b(spine|spinal|vertebra|vertebral|cervical spine|dorsal|lumbar|thoracolumbar|[CDTL]\d{1,2}\b|pelvi[sc]|acetabul|sacr|ilium|iliac|pubic|rami|si joint)/i.test(`${c.diagnosis || ''} ${c.plan || ''}`);
const isCompound = (c) => /\b(compound|open (fracture|#)|gustilo|grade\s*(i{1,3}|[1-3])[abc]?\b)/i.test(c.diagnosis || '');


function reviewPhrase(weeks, day, opd, time = '8AM') {
  const w = Number(weeks) || 2;
  const d = EN_DAYS.indexOf(day);
  const hour = parseInt(time, 10) || 8;
  const unit = w === 1 ? 'WEEK' : 'WEEKS';
  return [
    `REVIEW IN ORTHO OPD ${opd || ''} ON ${day} AT ${time} AFTER ${w} ${unit}`.replace(/\s+/g, ' '),
    `${w} வாரம் கழித்து, ${TA_DAYS[d] || ''} காலை ${hour} மணிக்கு எலும்பு முறிவு புறநோயாளிகள் பிரிவில் (${opd || ''}) வந்து காண்பிக்கவும்.`.replace(' ()', ''),
  ];
}

const EXAM_TEMPLATE = `PT. CONSCIOUS, ORIENTED, AFEBRILE
BP:    MMHG
PR:    /MIN
SpO2:    % (RA)

SYSTEMIC EXAMINATION:
CVS: S1, S2 +
RS: B/L AE +
PA: SOFT

L/E OF
SWELLING +
TENDERNESS +
DISTAL PULSE +
ACTIVE FINGER / TOE MOVEMENTS +`;

function pastTemplate(c) {
  const known = (c.comorbid || '').trim();
  return [
    known ? `K/C/O ${known.toUpperCase()}` : '',
    'NOT A K/C/O DM/HTN/TB/BA/CAD/EPILEPSY',
    'NO H/O PREVIOUS HOSPITALISATIONS OR PAST SURGERIES',
    'NO H/O FOOD OR DRUG ALLERGIES',
  ].filter(Boolean).join('\n');
}

function managedSentence(proc) {
  const m = proc.match(/^CONSERVATIVE(?:LY)?(?: MANAGEMENT| TREATMENT)?(?: WITH)?\s*(.*?)(?: APPLICATION)?\.?$/);
  if (m) return m[1] ? `PATIENT WAS MANAGED CONSERVATIVELY WITH ${m[1]}.` : 'PATIENT WAS MANAGED CONSERVATIVELY.';
  return `PATIENT WAS MANAGED WITH ${proc}.`;
}

// Drafts the "course in hospital" paragraph from what's already in the case.
function courseTemplate(c, d) {
  const up = (x) => String(x || '').trim().toUpperCase().replace(/\s+/g, ' ');
  const ops = listOf(c.opinions).map((o) => up(o.dept));
  const operated = !!(d.dos && up(d.procedure));
  const parts = [
    'THE PATIENT WAS ADMITTED FROM TRIAGE. INITIAL MANAGEMENT WAS DONE AS PER MODIFIED ATLS PROTOCOL. NECESSARY INVESTIGATIONS WERE TAKEN.',
    up(d.diagnosis) ? `PATIENT WAS DIAGNOSED WITH ${up(d.diagnosis)}.` : '',
    operated
      ? `AFTER OBTAINING FITNESS, PATIENT UNDERWENT ${up(d.procedure)} UNDER ${ANAES} ON ${fmtDate(d.dos)}. POST-OPERATIVE PERIOD WAS UNEVENTFUL.`
      : (up(d.procedure) ? managedSentence(up(d.procedure)) : ''),
    ops.length ? `EXPERT OPINIONS WERE OBTAINED FROM ${ops.length > 1 ? ops.slice(0, -1).join(', ') + ' AND ' + ops.at(-1) : ops[0]} AND ORDERS WERE FOLLOWED.` : '',
    (DISPOSITIONS[d.disposition] || DISPOSITIONS.discharge).course,
  ];
  return parts.filter(Boolean).join(' ');
}
