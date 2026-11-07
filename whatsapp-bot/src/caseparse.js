// Reads a case post the way the website's WhatsApp import does (js/wa-import.js):
//   Case 10
//   Sivagamy 47/F
//   NMLC/ACCIDENTAL FALL
//
//   CLOSED FRACTURE BOTH BONE FOREARM LEFT
// Keep in step with js/wa-import.js and js/data.js (MODES, defaultPlanFor).

export const MODES = ['MLC/RTA', 'MLC/OLD RTA', 'MLC/TTA', 'NMLC/FALL', 'MLC/FALL FROM HEIGHT', 'MLC/ASSAULT', 'NMLC/ACCIDENTAL INJURY', 'MLC/WORKSPOT INJURY', 'MLC/SELF INFLICTED', 'MLC/ELECTROCUTION'];
export const STANDARD_TREATMENT = ['IV FLUIDS', 'ANALGESICS'];

const clean = (s) => String(s ?? '').replace(/[‎‏‪-‮﻿]/g, '').replace(/[  ]/g, ' ');
const NAME_RE = /^(.*?[A-Za-z].*?)[\s,.\-:]+(\d{1,3})\s*(?:y(?:rs?|ears?)?|yo)?\.?\s*(?:\/|\s|,|-)\s*(m|f|male|female)\b\.?(.*)$/i;
const CASE_RE = /^\s*case\s*(?:no\.?|number|#)?\s*[:.\-]?\s*(\d+)\b\s*[:.\-]?\s*(.*)$/i;
const MODE_RE = /^(n?mlc\b.*|.*\b(rta|tta|assault|fall|accidental|work ?spot|electrocution|self inflicted|old rta)\b.*)$/i;

const modeOf = (line) => {
  const u = line.toUpperCase().replace(/\s*\/\s*/g, '/').replace(/\s+/g, ' ').trim();
  return MODES.find((m) => m === u) || u;
};

// One post's text → case fields, or null when it isn't a case post.
export function parseCaseText(text) {
  const lines = clean(text).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const out = { caseNo: '', name: '', age: '', sex: '', mode: '', ipNo: '', ward: '', diagnosis: '' };
  const rest = [];
  for (let line of lines) {
    const cm = !out.caseNo && line.match(CASE_RE);
    if (cm) {
      out.caseNo = cm[1];
      line = cm[2].trim();
      if (!line) continue;
    }
    const ip = line.match(/\bIP\s*(?:no\.?)?\s*[:.\-]?\s*(\d{3,})\b/i);
    if (ip) { out.ipNo = ip[1]; line = line.replace(ip[0], '').trim(); }
    const wd = line.match(/\bward\s*(?:no\.?)?\s*[:.\-]?\s*(\w+)/i);
    if (wd) { out.ward = wd[1].toUpperCase(); line = line.replace(wd[0], '').trim(); }
    line = line.replace(/^[,;\-–\s]+|[,;\-–\s]+$/g, '');
    if (!line) continue;
    const nm = !out.name && line.match(NAME_RE);
    if (nm && nm[1].replace(/[^A-Za-z]/g, '').length >= 2 && !MODE_RE.test(nm[1])) {
      out.name = nm[1].replace(/^name\s*[:.\-]\s*/i, '').replace(/[,.\-:\s]+$/, '').trim().toUpperCase();
      out.age = nm[2];
      out.sex = nm[3][0].toUpperCase();
      const tail = nm[4].replace(/^[\s,.\-:]+/, '').trim();
      if (tail) (MODE_RE.test(tail) && !out.mode ? (out.mode = modeOf(tail)) : rest.push(tail));
      continue;
    }
    if (!out.mode && MODE_RE.test(line) && line.length <= 40) { out.mode = modeOf(line); continue; }
    rest.push(line);
  }
  out.diagnosis = rest.join(' ').replace(/^(dx|diagnosis)\s*[:.\-]\s*/i, '').replace(/\s+/g, ' ').trim().toUpperCase();
  if (!out.name || !(out.diagnosis || out.caseNo)) return null;
  return out;
}

export function defaultPlanFor(diagnosis) {
  const d = String(diagnosis || '').toUpperCase();
  const side = /\b(LEFT|LT)\b/.test(d) ? ' LEFT' : /\b(RIGHT|RT)\b/.test(d) ? ' RIGHT' : '';
  if (/SUB\s*TROCHANTER/.test(d)) return 'CR/ORIF WITH LONG PFN' + side;
  if (/INTER\s*TROCHANTER|PER\s*TROCHANTER|\bIT\b/.test(d)) return 'CR/ORIF WITH SHORT PFN' + side;
  if (/NECK\s+OF\s+(THE\s+)?FEMUR|FEMORAL\s+NECK|\bNOF\b|NECK\s+FEMUR/.test(d)) return 'HEMIARTHROPLASTY HIP' + side;
  return '';
}

// Key used to spot a post forwarded twice: same name + age.
export const caseKey = (name, age) => `${String(name).toUpperCase().replace(/[^A-Z]/g, '')}|${String(age || '').replace(/\D/g, '')}`;

// The admission day a post belongs to, in India time: posts before 10 AM count for the day before
// (an admission night runs past midnight). `ts` is the WhatsApp timestamp in seconds.
export function admissionDay(ts) {
  const ist = new Date((Number(ts) * 1000) + 5.5 * 3600e3);
  if (ist.getUTCHours() < 10) ist.setUTCDate(ist.getUTCDate() - 1);
  return ist.toISOString().slice(0, 10);
}

// "DOA 2/11", "doa 02/11/2026", "DOA 2-11-26" → "2026-11-02" (year defaults to the current one).
export function parseDoaCommand(text, nowYear) {
  const m = String(text || '').trim().match(/^doa\s*[:\-]?\s*(\d{1,2})[/.\-](\d{1,2})(?:[/.\-](\d{2,4}))?\s*$/i);
  if (!m) return null;
  let y = m[3] ? Number(m[3]) : nowYear;
  if (y < 100) y += 2000;
  const d = Number(m[1]);
  const mo = Number(m[2]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
