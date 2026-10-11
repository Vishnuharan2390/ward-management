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
  'Plastic Surgery', 'Vascular Surgery', 'General Surgery', 'Obstetrics & Gynaecology',
];

const ANAESTHESIA = ['SA', 'SA + EA', 'GA', 'GA + block', 'Brachial plexus block', 'Regional block', 'Local'];
const SCHEMES = ['CMCHIS', 'CMCHIS – pre-auth sent', 'CMCHIS – approved', 'Non-scheme', 'Insurance'];
const ROLES = ['House Surgeon', 'PG', 'Senior PG', 'Assistant Professor', 'Professor'];
const SIDES = ['Right', 'Left', 'Bilateral', 'N/A'];

const DISPOSITIONS = {
  postop: { label: 'Transfer to Post-operative Ward', title: 'TRANSFER SUMMARY', status: 'postop' },
  discharge: { label: 'Discharge', title: 'DISCHARGE SUMMARY', status: 'discharged' },
  lama: { label: 'LAMA / AA', title: 'DISCHARGE SUMMARY (LAMA / AGAINST ADVICE)', status: 'discharged' },
  absconded: { label: 'Absconded', title: 'ABSCONDED SUMMARY', status: 'discharged' },
};

const SEED_IMPLANTS = [
  ['PFN / PFNA', 'pfn, pfna, proximal femoral nail', 'PFN / PFNA (short/long, size as per templating), lag & derotation screws / helical blade, distal locking bolts, guide wires'],
  ['DHS', 'dhs, dynamic hip screw', 'DHS barrel plate 135° (4/5 hole), DHS lag screw, compression screw, 4.5 mm cortical screws'],
  ['Hemiarthroplasty', 'bipolar, hemiarthroplasty, austin moore', 'Bipolar prosthesis (head & cup sizes), femoral stem (cemented/uncemented), bone cement 40 g ×1'],
  ['THR', 'thr, total hip', 'Acetabular cup, liner, femoral stem & head (sizes), bone cement 40 g ×2 if cemented'],
  ['TKR', 'tkr, total knee', 'Femoral & tibial components, polyethylene insert, ± patellar button, bone cement 40 g ×2'],
  ['ILN femur', 'iln femur, ilin femur, femur iln, femur ilin, interlocking nail femur, femur interlocking nail, femoral iln', 'Femur interlocking nail (length × diameter), proximal & distal locking bolts, guide wire, reamers'],
  ['ILN tibia', 'iln tibia, ilin tibia, tibia iln, tibia ilin, interlocking nail tibia, tibia interlocking nail, tibial iln', 'Tibia interlocking nail (length × diameter), locking bolts, guide wire, reamers'],
  ['Humerus nail', 'humerus nail, iln humerus, ilin humerus, humeral nail', 'Humerus interlocking nail (length × diameter), locking bolts'],
  ['Forearm plating', 'both bone forearm, bbfa, radius ulna, radius and ulna, orif radius, orif ulna, forearm plating', '3.5 mm LC-DCP / LCP (6–8 hole) ×2, 3.5 mm cortical screws'],
  ['Distal radius', 'distal radius, drf, colles, volar plate', 'Distal radius volar locking plate, 2.4/2.7 mm locking screws, K-wires 1.5/1.8 mm'],
  ['K-wire fixation', 'k wire, k-wire, kwire, k wiring, crpp', 'K-wires 1.5 / 1.8 / 2.0 mm'],
  ['Tension band wiring', 'tbw, tension band, patella, olecranon', 'K-wires 1.8 / 2.0 mm, SS wire 18G / 20G'],
  ['CC screws', 'cc screw, cc screws, cannulated cancellous, ccs, cannulated screw', 'Cannulated cancellous screws 6.5 / 7.0 mm with washers, guide wires'],
  ['Distal femur plating', 'distal femur, dfl, supracondylar femur', 'Distal femur locking plate (anatomical / LISS), 5.0 mm locking & 4.5 mm cortical screws'],
  ['Proximal tibia plating', 'proximal tibia, tibial plateau, schatzker', 'Proximal tibia locking plate (lateral / medial buttress), 3.5 / 5.0 mm locking screws, CC screws, bone graft substitute'],
  ['Proximal humerus plating', 'proximal humerus, philos', 'PHILOS plate, 3.5 mm locking & cortical screws, Ethibond / FibreWire for cuff'],
  ['Clavicle plating', 'clavicle', 'Clavicle anatomical locking plate / 3.5 mm recon plate, 3.5 mm screws'],
  ['Ankle ORIF', 'bimalleolar, trimalleolar, malleolus, malleolar, ankle orif', 'One-third tubular plate, 3.5 mm screws, 4.0 mm CC / malleolar screws, K-wires'],
  ['External fixator', 'external fixator, ex-fix, exfix, jess, lrs, limb reconstruction', 'Ex-fix rods, Schanz pins 4.5 / 5 mm, pin-rod clamps'],
  ['Implant removal', 'implant removal, implant exit, hardware removal', 'Matching screwdriver set, broken screw removal set, nail extraction set'],
  ['ACL reconstruction', 'acl, aclr', 'Endobutton (adjustable / fixed loop), interference screw, graft harvester'],
  ['Spine fixation', 'pedicle screw, tlif, plif, spinal fixation, spine fixation', 'Pedicle screws (sizes), rods, locking caps, cage if TLIF/PLIF, bone graft'],
  ['Debridement', 'debridement, wound debridement, i&d', 'Nil (antibiotic beads / VAC if planned)'],
].map(([name, kw, implants], i) => ({
  id: 'seed' + i,
  name,
  keywords: kw.split(',').map((s) => s.trim()).filter(Boolean),
  implants,
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
  return matchImplants(c.plan, rules).map((r) => r.implants).join('\n');
}
