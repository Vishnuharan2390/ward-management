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
const unitOf = (id) => UNITS.find((u) => u.id === id) || UNITS[0];
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

// Work-up items recorded as text. Empty = pending.
const WORKUP = [
  { k: 'ecg', label: 'ECG' },
  { k: 'echo', label: 'ECHO', long: 'ECHO & cardio opinion' },
  { k: 'xray', label: 'X-ray', img: true },
  { k: 'ct', label: 'CT', img: true },
  { k: 'mri', label: 'MRI', img: true },
  { k: 'anaes', label: 'PAC', long: 'Anaesthesia assessment (PAC)' },
];

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
const FLAG_MARK = { high: ' ↑', low: ' ↓', abn: '' };

const listOf = (map) => Object.entries(map || {})
  .map(([id, v]) => ({ id, ...v }))
  .sort((a, b) => (a.at || 0) - (b.at || 0));

function customParams(c) {
  return listOf(c.custom).map((x) => ({ k: 'x_' + x.id, label: x.label, range: x.range, unit: x.unit, custom: true }));
}

function labSets(c) {
  return listOf(c.labs).sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.at || 0) - (b.at || 0));
}

function latest(c, key) {
  const sets = labSets(c);
  for (let i = sets.length - 1; i >= 0; i--) {
    const v = sets[i].v?.[key];
    if (v != null && String(v).trim() !== '') return { value: String(v).trim(), date: sets[i].date };
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
  for (const w of WORKUP) if (!hasText(c.work?.[w.k])) out.push({ kind: 'inv', text: w.label });
  for (const o of listOf(c.opinions)) if (!hasText(o.note)) out.push({ kind: 'inv', text: o.dept + ' op.' });
  for (const t of listOf(c.tasks)) if (!t.done) out.push({ kind: 'task', text: t.text + (t.to ? ` → ${t.to}` : '') });
  return out;
}

function abnormalList(c) {
  const out = [];
  for (const p of [...ALL_PARAMS, ...customParams(c)]) {
    const l = latest(c, p.k);
    const f = l && flagOf(l.value, p);
    if (f) out.push({ kind: 'flag', text: `${p.label} ${l.value}${FLAG_MARK[f]}` });
  }
  return out;
}

function readiness(c) {
  let total = 0;
  let done = 0;
  const tick = (ok) => { total++; if (ok) done++; };
  for (const g of LAB_GROUPS) if (!g.optional) g.params.forEach((p) => tick(latest(c, p.k)));
  customParams(c).forEach((p) => tick(latest(c, p.k)));
  WORKUP.forEach((w) => tick(hasText(c.work?.[w.k])));
  listOf(c.opinions).forEach((o) => tick(hasText(o.note)));
  return { done, total, ready: total > 0 && done === total };
}

function ageSex(c) {
  return [c.age, c.sex].filter(Boolean).join('/');
}

// Older saves stored labs as inv.cbc.hb etc.; fold them into one dated set.
function migrateCase(c) {
  if (!c.inv || c.labs) return c;
  const map = { cbc: { hb: 'hb', wbc: 'wbc', plt: 'plt' }, rft: { u: 'urea', c: 'creat', na: 'na', k: 'k' }, lft: { tbili: 'tbili', sgot: 'sgot', sgpt: 'sgpt' }, esr: { v: 'esr' }, crp: { v: 'crp' } };
  const v = {};
  for (const [g, fields] of Object.entries(map)) for (const [f, k] of Object.entries(fields)) if (hasText(c.inv[g]?.[f])) v[k] = c.inv[g][f];
  if (Object.keys(v).length) c.labs = { m0: { date: c.doa || '', at: c.createdAt || 0, v } };
  c.work ||= {};
  for (const w of WORKUP) if (hasText(c.inv[w.k]?.note) && !hasText(c.work[w.k])) c.work[w.k] = c.inv[w.k].note;
  if (hasText(c.inv.pus?.note) && !c.pus) c.pus = { organism: c.inv.pus.note };
  delete c.inv;
  return c;
}

// ---- Implant matching ---------------------------------------------------

function keywordRegex(k) {
  const e = k.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s*');
  return new RegExp(`(^|[^a-z0-9])${e}([^a-z0-9]|$)`, 'i');
}

// A rule matches on its procedure name or any of its other names.
function matchImplants(text, rules) {
  if (!text) return [];
  return Object.values(rules || {})
    .filter((r) => [r.name, ...(r.keywords || [])].some((k) => k && keywordRegex(k).test(text)))
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
}

function suggestFromPlan(plan, rules) {
  const m = matchImplants(plan, rules);
  const levels = m.map((r) => LEVELS.indexOf(r.level)).filter((i) => i >= 0);
  return {
    matches: m,
    implants: m.map((r) => r.implants).filter((x) => x && x.toUpperCase() !== 'NIL').join(', '),
    level: levels.length ? LEVELS[Math.max(...levels)] : '',
  };
}

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
  ['CONTINUE ANALGESICS', 'வலி நிவாரண மருந்துகளைத் தொடர்ந்து எடுத்துக் கொள்ளவும்.'],
  ['CONTINUE CUFF & COLLAR', 'கட்டை தொடர்ந்து கட்டிக்கொள்ளவும்.'],
  ['CONTINUE SLAB / POP', 'மாவுக்கட்டை தொடர்ந்து அணிந்து கொள்ளவும்; ஈரமாக்க வேண்டாம்.'],
  ['LIMB ELEVATION', 'அடிபட்ட கை / காலை உயர்த்தி வைக்கவும்.'],
  ['ACTIVE TOE / FINGER MOVEMENTS', 'விரல்களை அடிக்கடி அசைத்துக் கொண்டே இருக்கவும்.'],
  ['NON WEIGHT BEARING', 'அடிபட்ட காலில் எடை போட வேண்டாம்.'],
  ['KEEP WOUND DRY', 'காயத்தை ஈரமில்லாமல் சுத்தமாக வைக்கவும்.'],
  ['SUTURE REMOVAL ON POD 12', 'அறுவை சிகிச்சைக்குப் பின் 12-ஆம் நாள் தையல் பிரிக்க வரவும்.'],
  ['CONTINUE DIABETIC / ANTIHYPERTENSIVE MEDICATIONS', 'சர்க்கரை / இரத்த அழுத்த மருந்துகளைத் தொடர்ந்து எடுத்துக் கொள்ளவும்.'],
  ['REPORT IMMEDIATELY IF PAIN, SWELLING, NUMBNESS OR DISCOLOURATION', 'வலி, வீக்கம், மரத்துப்போதல் அல்லது நிறமாற்றம் இருந்தால் உடனே மருத்துவமனைக்கு வரவும்.'],
];

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
