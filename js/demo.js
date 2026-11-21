// Guest demo (temporary): sample patients so someone can look round every page without seeing the unit's
// real data. Runs in local mode on the guest's own phone only (Store.guest); nothing reaches Firebase.
// To remove guest access: delete this file, its <script> in index.html / SHELL entry in sw.js, the
// "Look around as a guest" button in the Gate view (js/app.js) and the `guest` lines in js/store.js.
const Demo = (() => {
  const iso = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
  const ago = (h) => Date.now() - h * 3600e3;

  // a made-up "radiograph": dark film, a pale bone with a break line, labelled DEMO
  function film(label, broken = true) {
    const c = document.createElement('canvas');
    c.width = 600;
    c.height = 800;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(300, 400, 50, 300, 400, 520);
    grd.addColorStop(0, '#3a3a3a');
    grd.addColorStop(1, '#050505');
    g.fillStyle = grd;
    g.fillRect(0, 0, 600, 800);
    g.fillStyle = 'rgba(235,235,225,.85)';
    g.beginPath();
    g.ellipse(300, 130, 95, 70, 0, 0, Math.PI * 2);
    g.fill();
    g.fillRect(255, 150, 90, 520);
    g.beginPath();
    g.ellipse(300, 690, 110, 60, 0, 0, Math.PI * 2);
    g.fill();
    if (broken) {
      g.strokeStyle = '#111';
      g.lineWidth = 7;
      g.beginPath();
      g.moveTo(240, 400);
      g.lineTo(290, 380);
      g.lineTo(320, 420);
      g.lineTo(360, 395);
      g.stroke();
    }
    g.fillStyle = '#fff';
    g.font = 'bold 34px sans-serif';
    g.fillText('DEMO', 24, 50);
    g.font = '24px sans-serif';
    g.fillText(label, 24, 780);
    return c.toDataURL('image/jpeg', 0.8);
  }

  const lab = (date, v) => ({ [`d_${date.replace(/-/g, '')}`]: { date, at: Date.now(), by: 'DEMO', v } });

  const CASES = {
    d1: { name: 'MURUGAN', age: '62', sex: 'M', ipNo: '100201', ward: '102', doa: iso(-4), status: 'preop', mode: 'ACCIDENTAL FALL', diagnosis: 'CLOSED FRACTURE NECK OF FEMUR LEFT (GARDEN IV)', plan: 'CEMENTED BIPOLAR HEMIARTHROPLASTY LEFT', level: 'III', scheme: 'APPROVED',
      comorb: { T2DM: { on: true, rx: 'T. METFORMIN 500MG BD' } }, comorbid: 'T2DM', attender: 'SELVI (WIFE)', phone: '9000000001', address: 'MELUR',
      work: { ecg: 'Taken', anaes: 'Provisionally assessed', anaesPending: 'ECHO\nCARDIOLOGY OPINION' }, labs: lab(iso(-3), { hb: '10.8', wbc: '8.4', plt: '2.4', rbs: '168', urea: '32', creat: '1.1', na: '138', k: '4.2' }),
      opinions: { o1: { dept: 'CARDIOLOGY', note: '', at: ago(26) } }, invTodo: 'CBC\nCXR', invAsked: { CBC: ago(26), CXR: ago(26) }, tasks: { t1: { text: 'CROSS MATCH 1 UNIT PRBC', done: false, at: ago(26) } } },
    d2: { name: 'LAKSHMI', age: '58', sex: 'F', ipNo: '100202', ward: '102', doa: iso(-3), status: 'posted', otDate: iso(1), diagnosis: 'CLOSED INTERTROCHANTERIC FRACTURE RIGHT FEMUR', plan: 'CRIF WITH PFN RIGHT', level: 'III', scheme: 'VALIDATION',
      work: { ecg: 'Taken', echo: 'EF 60%', anaes: 'Assessed' }, labs: lab(iso(-2), { hb: '11.6', wbc: '7.1', plt: '2.8', rbs: '110', urea: '26', creat: '0.9', na: '139', k: '4.0', hbsag: 'Negative', hcv: 'Negative', hiv: 'Non-reactive' }) },
    d3: { name: 'RAVI', age: '34', sex: 'M', ipNo: '100203', ward: '103', doa: iso(-2), status: 'preop', mode: 'RTA', diagnosis: 'CLOSED FRACTURE BOTH BONES FOREARM RIGHT', plan: 'ORIF WITH PLATING RIGHT', level: 'II', scheme: 'TO BE SUBMITTED',
      work: { ecg: 'Taken', anaes: 'Not assessed' }, tasks: { t1: { text: 'DRESSING', done: false, at: ago(20) } } },
    d4: { name: 'SELVI', age: '38', sex: 'F', ipNo: '100204', ward: '104', doa: iso(-5), status: 'preop', mode: 'FALL FROM HEIGHT', diagnosis: 'D12 BURST FRACTURE WITH PARAPLEGIA (ASIA B)', plan: 'POSTERIOR STABILISATION WITH PEDICLE SCREWS', level: 'IV', scheme: 'APPROVED', work: { anaes: 'Assessed' } },
    d5: { name: 'KARTHIK', age: '9', sex: 'M', ipNo: '100205', ward: '105', doa: iso(-1), status: 'preop', mode: 'FALL WHILE PLAYING', diagnosis: 'CLOSED SUPRACONDYLAR FRACTURE HUMERUS LEFT (GARTLAND III)', plan: 'CRPP WITH K WIRES LEFT', level: 'II', scheme: 'NO SCHEME', schemeReason: 'NO CMCHIS CARD', work: {} },
    d6: { name: 'KAMALA', age: '66', sex: 'F', ipNo: '100206', ward: '201', doa: iso(-8), status: 'postop', surgeryDate: iso(-3), diagnosis: 'PRIMARY OSTEOARTHRITIS KNEE RIGHT', plan: 'TKR RIGHT', procedureDone: 'TOTAL KNEE REPLACEMENT RIGHT', implantsUsed: 'TKR SET (FEMUR 3, TIBIA 3, INSERT 10)', level: 'IV', scheme: 'APPROVED', work: {} },
    d7: { name: 'ARUN', age: '24', sex: 'M', ipNo: '100207', ward: '103', doa: iso(-1), status: 'preop', diagnosis: 'ACL TEAR LEFT KNEE', plan: 'ARTHROSCOPIC ACL RECONSTRUCTION LEFT', level: 'III', scheme: 'APPROVED', work: {} },
    d8: { name: 'RAJU', age: '40', sex: 'M', ipNo: '100208', ward: '201', doa: iso(-9), status: 'postop', surgeryDate: iso(-5), diagnosis: 'CLOSED FRACTURE SHAFT OF FEMUR RIGHT', procedureDone: 'CRIF WITH IMIL FEMUR NAILING RIGHT', implantsUsed: 'ILIM 11 X 380', level: 'III', scheme: 'APPROVED', work: {}, invTodo: 'CHECK X-RAY', invAsked: { 'CHECK X-RAY': ago(24) } },
    d9: { name: 'GANESH', age: '50', sex: 'M', ipNo: '100209', ward: '104', doa: iso(-6), status: 'plastic', plastic: { out: iso(-2), at: ago(48), by: 'DEMO', from: 'preop' }, diagnosis: 'COMPOUND GRADE IIIB FRACTURE BOTH BONES LEG LEFT', plan: 'WOUND DEBRIDEMENT AND EX FIX', work: {} },
    d10: { name: 'VALLI', age: '70', sex: 'F', ipNo: '100210', ward: '201', doa: iso(-7), status: 'sicu', sicu: { out: iso(-1), at: ago(24), by: 'DEMO', from: 'postop' }, surgeryDate: iso(-2), diagnosis: 'CLOSED FRACTURE NECK OF FEMUR RIGHT', procedureDone: 'BIPOLAR HEMIARTHROPLASTY RIGHT', work: {} },
  };

  async function seed() {
    for (const [id, c] of Object.entries(CASES)) Store.create('cases', id, { ...c, specs: specsOf(c) });
    Store.setMeta({ capsV1: true, doaFix1103: true, peopleV1: true });
    Store.create('updates', 'u1', { caseId: 'd1', name: 'MURUGAN', text: 'CBC: Hb 10.8, WBC 8.4, PLT 2.4', by: 'DR. DEMO (House Surgeon)', role: 'hs', at: ago(2) });
    Store.create('updates', 'u2', { caseId: 'd3', name: 'RAVI', text: 'DRESSING — done', by: 'DR. DEMO (House Surgeon)', role: 'hs', at: ago(1) });
    const pics = [['d1', 'xray', 'PRE-OP X-RAY HIP'], ['d2', 'xray', 'PRE-OP X-RAY HIP'], ['d3', 'xray', 'X-RAY FOREARM'], ['d4', 'ct', 'CT SPINE'], ['d6', 'xray', 'PRE-OP X-RAY KNEE'], ['d6', 'poxray', 'POST-OP X-RAY KNEE', false], ['d8', 'xray', 'X-RAY FEMUR'], ['d8', 'poxray', 'POST-OP X-RAY FEMUR', false], ['d9', 'wound', 'WOUND']];
    for (const [id, kind, label, broken] of pics) await Store.addImage(id, kind, film(label, broken !== false), 'DEMO');
  }
  return { seed };
})();
