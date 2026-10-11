// Domain definitions: the pre-op checklist, option lists and the starter
// implant database.

const STATUS = { '': 'Not needed', pending: 'Pending', sent: 'Sent', done: 'Done', na: 'N/A' };

const CASE_STATUS = {
  preop: 'Pre-op',
  posted: 'Posted',
  postop: 'Post-op',
  discharged: 'Discharged',
};

// Order follows the ward notebook. `req` items count as pending until marked.
// `fields` are values typed straight into the checklist.
const CHECKS = [
  { k: 'cbc', label: 'CBC', req: true, fields: [['hb', 'Hb'], ['wbc', 'WBC'], ['plt', 'Plt']] },
  { k: 'rft', label: 'RFT', req: true, fields: [['u', 'U'], ['c', 'C'], ['na', 'Na'], ['k', 'K']] },
  { k: 'lft', label: 'LFT', req: true, fields: [['tbili', 'T.Bili'], ['sgot', 'SGOT'], ['sgpt', 'SGPT']] },
  { k: 'vm', label: 'VM', long: 'Viral markers', req: true },
  { k: 'vctc', label: 'VCTC', req: true },
  { k: 'ecg', label: 'ECG', req: true },
  { k: 'echo', label: 'ECHO', long: 'ECHO & cardio opinion', req: true },
  // Opinions are rendered here (separate list).
  { k: 'xray', label: 'X-ray', req: true, img: true },
  { k: 'ct', label: 'CT', img: true },
  { k: 'mri', label: 'MRI', img: true },
  { k: 'anaes', label: 'PAC', long: 'Anaesthesia assessment', req: true },
  { k: 'esr', label: 'ESR', fields: [['v', 'ESR']] },
  { k: 'crp', label: 'qCRP', fields: [['v', 'qCRP']] },
  { k: 'pus', label: 'Pus C/S', long: 'Pus culture & sensitivity' },
];
const CHECKS_BEFORE_OPINIONS = 7;

const OPINION_DEPTS = [
  'General Medicine', 'Cardiology', 'Pulmonology', 'Nephrology', 'Neurology',
  'Endocrinology', 'Diabetology', 'ENT', 'Dental', 'Psychiatry',
  'Plastic Surgery', 'Vascular Surgery', 'Neurosurgery', 'CTVS', 'General Surgery', 'Urology', 'Obstetrics & Gynaecology',
];

const ANAESTHESIA = ['GA/RA', 'RA', 'GA', 'SA', 'SA + EA', 'Brachial plexus block', 'Local'];
const SCHEMES = ['APPROVED', 'APPLIED', 'TO BE APPLIED', 'NO SCHEME'];
const ROLES = ['House Surgeon', 'PG', 'Senior PG', 'Assistant Professor', 'Professor'];
const SIDES = ['Right', 'Left', 'Bilateral', 'N/A'];

const DISPOSITIONS = {
  discharge: { label: 'Discharge', title: '', status: 'discharged', course: 'PATIENT IS BEING DISCHARGED IN A STABLE CONDITION.' },
  dar: { label: 'Discharge at request', title: '', status: 'discharged', course: 'PATIENT DISCHARGED AT REQUEST.' },
  postop: { label: 'Transfer to Post-operative Ward', title: 'TRANSFER SUMMARY', status: 'postop', course: 'PATIENT IS BEING TRANSFERRED TO THE POST-OPERATIVE WARD FOR FURTHER MANAGEMENT.' },
  lama: { label: 'LAMA / AA', title: 'LAMA / AGAINST ADVICE', status: 'discharged', course: 'PATIENT LEFT AGAINST MEDICAL ADVICE. THE CONSEQUENCES WERE EXPLAINED TO THE PATIENT AND ATTENDERS.' },
  absconded: { label: 'Absconded', title: 'ABSCONDED', status: 'discharged', course: 'PATIENT ABSCONDED FROM THE WARD.' },
};

const LEVELS = ['I', 'II', 'III', 'IV'];

// Defaults match the unit's existing letterhead / OT list; editable in Settings.
const DEFAULT_META = {
  institution: 'Govt. Rajaji Hospital & Madurai Medical College',
  department: 'Department of Orthopaedic Surgery & Traumatology',
  unit: 'UNIT I',
  chief: 'PROF. DR. PATHIARASAKUMAR M.S. ORTHO',
  profs: ['DR KARTHIKEYAN MS ORTHO'],
  opd: '802',
};

// [procedure, keywords, implants, level, anaesthesia]
const SEED_IMPLANTS = [
  ['Hemiarthroplasty (bipolar / AMP)', 'hemiarthroplasty, bipolar, austin moore, amp', '39-47 BIPOLAR AND AUSTIN MOORE PROSTHESIS', 'III', 'GA/RA'],
  ['Short PFN', 'pfn, short pfn, pfna, proximal femoral nail', '9,10,11*250MM SHORT PFN, 6.2MM DEROTATION SCREW, 8MM CERVICAL SCREW, 4.9MM LOCKING BOLTS', 'II', 'GA/RA'],
  ['Long PFN', 'long pfn', '9,10,11 MM LONG PFN (340-420MM), 6.2MM DEROTATION SCREW, 8MM CERVICAL SCREW, 4.9MM LOCKING BOLTS', 'III', 'GA/RA'],
  ['DHS', 'dhs, dynamic hip screw', '135° DHS BARREL PLATE 4/5 HOLE, 70-100MM DHS LAG SCREW, 4.5MM CORTICAL SCREWS', 'II', 'GA/RA'],
  ['THR', 'thr, total hip', 'THR SET – ACETABULAR CUP, LINER, FEMORAL STEM & HEAD (SIZES), BONE CEMENT 40G X 2', 'IV', 'GA/RA'],
  ['TKR', 'tkr, total knee', 'TKR SET – FEMORAL & TIBIAL COMPONENTS, POLY INSERT, BONE CEMENT 40G X 2', 'IV', 'GA/RA'],
  ['ILN femur', 'iln femur, ilin femur, femur iln, femur ilin, interlocking nail femur, femur interlocking nail, femoral iln', '9-12MM X 340-440MM FEMUR INTERLOCKING NAIL, 4.9MM LOCKING BOLTS', 'III', 'GA/RA'],
  ['ILN tibia', 'iln tibia, ilin tibia, tibia iln, tibia ilin, interlocking nail tibia, tibia interlocking nail, tibial iln', '8-11MM X 280-380MM TIBIA INTERLOCKING NAIL, 4.5MM LOCKING BOLTS', 'II', 'GA/RA'],
  ['Humerus nail', 'humerus nail, iln humerus, ilin humerus, humeral nail', '7-9MM HUMERUS INTERLOCKING NAIL, 4MM LOCKING BOLTS', 'II', 'GA'],
  ['Forearm plating', 'both bone forearm, bbfa, bb forearm, radius ulna, radius and ulna, orif radius, orif ulna, forearm plating', '3.5MM LC-DCP / LCP 6-8 HOLE X 2, 3.5MM CORTICAL SCREWS', 'II', 'GA/RA'],
  ['Distal radius plating', 'distal radius, drf, volar plate, volar plating', 'DISTAL RADIUS VOLAR LOCKING PLATE, 2.7MM LOCKING SCREWS, 1.5/1.8MM K-WIRES', 'II', 'GA/RA'],
  ['K-wire fixation', 'k wire, k-wire, kwire, k wiring, crpp', '1.5 / 1.8 / 2MM K-WIRES', 'I', 'GA/RA'],
  ['Tension band wiring', 'tbw, tension band', '1.8 / 2MM K-WIRES, 18G SS WIRE', 'II', 'GA/RA'],
  ['CC screws', 'cc screw, cc screws, cc screwing, cannulated cancellous, ccs, cannulated screw', '6.5 / 7MM CANNULATED CANCELLOUS SCREWS WITH WASHERS', 'II', 'GA/RA'],
  ['Distal femur plating', 'distal femur, dfl, supracondylar femur', 'DISTAL FEMUR LOCKING PLATE, 5MM LOCKING & 4.5MM CORTICAL SCREWS', 'III', 'GA/RA'],
  ['Proximal tibia plating', 'proximal tibia, tibial plateau, schatzker', 'PROXIMAL TIBIA LOCKING PLATE (LATERAL / MEDIAL), 5MM LOCKING SCREWS, 6.5MM CC SCREWS', 'III', 'GA/RA'],
  ['Proximal humerus plating', 'proximal humerus, philos', 'PHILOS PLATE, 3.5MM LOCKING & CORTICAL SCREWS', 'III', 'GA'],
  ['Clavicle plating', 'clavicle', 'CLAVICLE ANATOMICAL LOCKING PLATE / 3.5MM RECON PLATE, 3.5MM SCREWS', 'II', 'GA'],
  ['Ankle ORIF', 'bimalleolar, trimalleolar, malleolus, malleolar, ankle orif', '1/3 TUBULAR PLATE, 3.5MM SCREWS, 4MM CC SCREWS, K-WIRES', 'II', 'GA/RA'],
  ['External fixator', 'external fixator, ex-fix, exfix, jess, spanning fixator', '3.5MM SCHANZ PINS, AO CLAMPS, AO RODS', 'I', 'GA/RA'],
  ['LRS', 'lrs, limb reconstruction', 'LRS RAIL, CLAMPS, 6MM SCHANZ PINS', 'III', 'GA/RA'],
  ['Implant removal', 'implant removal, implant exit, hardware removal', 'SCREWDRIVER SET, BROKEN SCREW REMOVAL SET, NAIL EXTRACTOR', 'I', 'GA/RA'],
  ['ACL reconstruction', 'acl, aclr', 'ENDOBUTTON, 7-9MM INTERFERENCE SCREW', 'III', 'GA/RA'],
  ['Spine fixation', 'pedicle screw, tlif, plif, spinal fixation, spine fixation', 'PEDICLE SCREWS, RODS, LOCKING CAPS, CAGE (IF TLIF/PLIF)', 'IV', 'GA'],
  ['Debridement', 'debridement, wound debridement, i&d, wd', 'NIL', 'I', 'GA/RA'],
  ['SSG', 'ssg, split skin graft', 'NIL', 'I', 'GA/RA'],
].map(([name, kw, implants, level, anaes], i) => ({
  id: 'seed' + i,
  name,
  keywords: kw.split(',').map((x) => x.trim()).filter(Boolean),
  implants,
  level,
  anaes,
}));

// ---- Case helpers -------------------------------------------------------

function effStatus(c, chk) {
  const s = c.inv?.[chk.k]?.s || '';
  return s || (chk.req ? 'pending' : '');
}

function checkSummary(c, chk) {
  const d = c.inv?.[chk.k] || {};
  const st = effStatus(c, chk);
  let out = '';
  if (chk.fields && chk.fields.some(([f]) => d[f])) {
    out = chk.fields.map(([f]) => d[f] || '–').join('/');
  } else if (st) {
    out = STATUS[st];
  }
  if (d.note) out += (out ? ' · ' : '') + d.note;
  return out;
}

const listOf = (map) => Object.entries(map || {})
  .map(([id, v]) => ({ id, ...v }))
  .sort((a, b) => (a.at || 0) - (b.at || 0));

function pendingList(c) {
  const out = [];
  for (const chk of CHECKS) {
    const s = effStatus(c, chk);
    if (s === 'pending') out.push({ kind: 'inv', text: chk.label });
    if (s === 'sent') out.push({ kind: 'sent', text: chk.label + ' (sent)' });
  }
  for (const o of listOf(c.opinions)) {
    if (o.s !== 'done' && o.s !== 'na') out.push({ kind: o.s === 'sent' ? 'sent' : 'inv', text: o.dept + ' opinion' + (o.s === 'sent' ? ' (sent)' : '') });
  }
  for (const t of listOf(c.tasks)) {
    if (!t.done) out.push({ kind: 'task', text: t.text + (t.to ? ` → ${t.to}` : '') });
  }
  return out;
}

function readiness(c) {
  let total = 0;
  let done = 0;
  for (const chk of CHECKS) {
    const s = effStatus(c, chk);
    if (!s) continue;
    total++;
    if (s === 'done' || s === 'na') done++;
  }
  for (const o of listOf(c.opinions)) {
    total++;
    if (o.s === 'done' || o.s === 'na') done++;
  }
  return { done, total, ready: total > 0 && done === total };
}

function ageSex(c) {
  return [c.age, c.sex].filter(Boolean).join('/');
}

// ---- Implant matching ---------------------------------------------------

function keywordRegex(k) {
  const e = k.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s*');
  return new RegExp(`(^|[^a-z0-9])${e}([^a-z0-9]|$)`, 'i');
}

function matchImplants(text, rules) {
  if (!text) return [];
  return Object.values(rules || {})
    .filter((r) => (r.keywords || []).some((k) => k && keywordRegex(k).test(text)))
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
}

function suggestImplants(c, rules) {
  return matchImplants(c.plan, rules).map((r) => r.implants).filter((x) => x && x !== 'NIL').join(', ');
}

function suggestFromPlan(plan, rules) {
  const m = matchImplants(plan, rules);
  const levels = m.map((r) => LEVELS.indexOf(r.level)).filter((i) => i >= 0);
  return {
    matches: m,
    implants: suggestImplants({ plan }, rules),
    level: levels.length ? LEVELS[Math.max(...levels)] : '',
    anaesthesia: m.find((r) => r.anaes)?.anaes || '',
  };
}

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
BP:   MMHG   PR:   /MIN   SpO2:   % (RA)

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
      ? `AFTER OBTAINING FITNESS, PATIENT UNDERWENT ${up(d.procedure)}${c.anaesthesia ? ' UNDER ' + up(c.anaesthesia) : ''} ON ${fmtDate(d.dos)}. POST-OPERATIVE PERIOD WAS UNEVENTFUL.`
      : (up(d.procedure) ? managedSentence(up(d.procedure)) : ''),
    ops.length ? `EXPERT OPINIONS WERE OBTAINED FROM ${ops.length > 1 ? ops.slice(0, -1).join(', ') + ' AND ' + ops.at(-1) : ops[0]} AND ORDERS WERE FOLLOWED.` : '',
    (DISPOSITIONS[d.disposition] || DISPOSITIONS.discharge).course,
  ];
  return parts.filter(Boolean).join(' ');
}
