// Read a discharge summary typed elsewhere (PDF) into the discharge page: the sections by their
// headings, the patient-box fields by their labels, and the disposition from the wording.
// PDF.js (js/vendor/pdfjs, Apache-2.0) is loaded only when a PDF is opened.
const DcImport = (() => {
  let libP = null;
  function lib() {
    libP ||= new Promise((res, rej) => {
      if (window.pdfjsLib) return res(window.pdfjsLib);
      const s = document.createElement('script');
      s.src = 'js/vendor/pdfjs/pdf.min.js';
      s.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'js/vendor/pdfjs/pdf.worker.min.js'; res(window.pdfjsLib); };
      s.onerror = () => { libP = null; rej(new Error("couldn't load the PDF reader — check the network and try again")); };
      document.head.appendChild(s);
    });
    return libP;
  }
  async function open(file) {
    const L = await lib();
    return L.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  }

  // The text, line by line (items on the same baseline joined, left to right).
  async function lines(doc) {
    const out = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const tc = await page.getTextContent();
      const items = tc.items.filter((i) => i.str !== undefined).map((i) => ({ s: i.str, x: i.transform[4], y: i.transform[5], w: i.width || 0, h: Math.abs(i.transform[3]) || i.height || 10 }));
      items.sort((a, b) => b.y - a.y || a.x - b.x);
      let row = [];
      const flush = () => {
        if (!row.length) return;
        row.sort((a, b) => a.x - b.x);
        let t = '';
        let end = null;
        for (const it of row) {
          if (end !== null && it.x - end > Math.max(1.5, it.h * 0.15) && !/\s$/.test(t) && !/^\s/.test(it.s)) t += it.x - end > it.h * 2.5 ? '   ' : ' ';
          t += it.s;
          end = it.x + it.w;
        }
        if (t.trim()) out.push(t.replace(/\s+$/, ''));
        row = [];
      };
      for (const it of items) {
        if (row.length && Math.abs(it.y - row[0].y) > Math.max(2, row[0].h * 0.5)) flush();
        if (it.s.trim() || row.length) row.push(it);
      }
      flush();
    }
    return out;
  }

  // Each page as a picture (for the discharge PowerPoint).
  async function pageImages(doc, width = 1240) {
    const out = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const v0 = page.getViewport({ scale: 1 });
      const v = page.getViewport({ scale: width / v0.width });
      const cv = document.createElement('canvas');
      cv.width = Math.round(v.width);
      cv.height = Math.round(v.height);
      const g = cv.getContext('2d');
      g.fillStyle = '#fff';
      g.fillRect(0, 0, cv.width, cv.height);
      await page.render({ canvasContext: g, viewport: v }).promise;
      out.push({ data: cv.toDataURL('image/jpeg', 0.9), aspect: cv.height / cv.width });
      cv.width = cv.height = 0;
    }
    return out;
  }

  // ---- reading the text
  const SECTIONS = [
    ['diagnosis', ['DIAGNOSIS IN DETAIL', 'FINAL DIAGNOSIS', 'PROVISIONAL DIAGNOSIS', 'DIAGNOSIS']],
    ['procedure', ['PROCEDURE IN DETAIL', 'PROCEDURE DONE', 'PROCEDURES DONE', 'SURGERY DONE', 'OPERATION DONE', 'SURGICAL PROCEDURE', 'OPERATIVE PROCEDURE', 'PROCEDURE', 'SURGERY']],
    ['unitLine', ['UNIT / CONSULTANTS', 'UNIT/CONSULTANTS', 'UNIT & CONSULTANTS', 'CONSULTANTS']],
    ['history', ['H/O INJURY / ILLNESS', 'H/O INJURY/ILLNESS', 'H/O PRESENTING ILLNESS', 'H/O PRESENT ILLNESS', 'H/O PRESENTING COMPLAINTS', 'H/O PRESENTING COMPLAINT', 'H/O INJURY', 'H/O ILLNESS', 'HISTORY OF PRESENT ILLNESS', 'HISTORY OF PRESENTING ILLNESS', 'HISTORY OF PRESENTING COMPLAINTS', 'HISTORY OF INJURY', 'PRESENTING COMPLAINTS', 'PRESENTING COMPLAINT', 'CHIEF COMPLAINTS', 'COMPLAINTS', 'HOPI', 'HPI', 'HISTORY']],
    ['past', ['PAST HISTORY / TREATMENT HISTORY', 'PAST HISTORY/TREATMENT HISTORY', 'PAST MEDICAL HISTORY', 'PAST HISTORY', 'TREATMENT HISTORY']],
    ['exam', ['EXAMINATION FINDINGS', 'CLINICAL EXAMINATION', 'GENERAL EXAMINATION', 'LOCAL EXAMINATION', 'ON EXAMINATION', 'EXAMINATION', 'O/E']],
    ['investigations', ['INVESTIGATIONS', 'LAB INVESTIGATIONS', 'INVESTIGATION']],
    ['opNotes', ['OPERATIVE NOTES', 'OPERATIVE NOTE', 'OPERATION NOTES', 'OP NOTES']],
    ['treatment', ['TREATMENT GIVEN', 'TREATMENT', 'MANAGEMENT']],
    ['course', ['COURSE IN HOSPITAL', 'COURSE IN THE HOSPITAL', 'HOSPITAL COURSE']],
    ['condition', ['CONDITION ON DISCHARGE', 'CONDITION AT DISCHARGE', 'CONDITION AT THE TIME OF DISCHARGE', 'CONDITION ON TRANSFER', 'CONDITION AT TRANSFER', 'GENERAL CONDITION ON DISCHARGE']],
    ['meds', ['DISCHARGE MEDICATIONS', 'DISCHARGE MEDICATION', 'MEDICATIONS ON DISCHARGE', 'DRUGS ON DISCHARGE', 'DISCHARGE DRUGS', 'MEDICATIONS', 'RX']],
    ['advice', ['DISCHARGE ADVICE', 'ADVICE ON DISCHARGE', 'FOLLOW UP ADVICE', 'FOLLOW-UP ADVICE', 'ADVICE', 'FOLLOW UP', 'FOLLOW-UP']],
  ];
  const STOP = /^(DOCTOR'?S? SIGNATURE|SIGNATURE|SIGNATURE OF|SIGN\b|SD\/-|DUTY DOCTOR|DISCHARGING DOCTOR)/;
  const HEADS = SECTIONS.flatMap(([k, names]) => names.map((n) => [k, n])).sort((a, b) => b[1].length - a[1].length);
  const norm = (s) => s.toUpperCase().replace(/\s+/g, ' ').trim();
  function heading(line) {
    const u = norm(line);
    for (const [k, n] of HEADS) {
      if (!u.startsWith(n)) continue;
      const rest = u.slice(n.length);
      // the heading alone, or followed by ":" / "-" and the text
      if (!rest || /^\s*[:：\-–]/.test(rest) || (/^\s*$/.test(rest))) return { k, rest: line.trim().slice(line.trim().length - rest.length).replace(/^\s*[:：\-–]\s*/, '') };
    }
    return null;
  }

  // Labelled fields, read from anywhere (the patient box is often two pairs to a line).
  const LABELS = [
    ['name', /PATIENT\s*NAME|\bNAME\b/],
    ['ipNo', /\bI\.?\s?P\.?\s*NO\.?|\bIP\s*NUMBER/],
    ['arNo', /\bA\.?\s?R\.?\s*NO\.?/],
    ['ageSex', /AGE\s*\/\s*(SEX|GENDER)/],
    ['doa', /\bD\.?O\.?A\b\.?|DATE OF ADMISSION/],
    ['dos', /\bD\.?O\.?S\b\.?|DATE OF SURGERY|DATE OF OPERATION/],
    ['dod', /\bD\.?O\.?D\b\.?|\bD\.?O\.?T\b\.?|DATE OF DISCHARGE|DATE OF TRANSFER/],
    ['consultant', /\bCONSULTANT\b/],
    ['phone', /\bPH(ONE)?\.?\s*NO\.?|\bMOBILE(\s*NO\.?)?|\bCELL(\s*NO\.?)?/],
    ['contact', /CONTACT\s*NO\.?/],
    ['attender', /\bATTENDER\b|\bATTENDANT\b/],
    ['address', /\bADDRESS\b/],
  ];
  function pairs(line) {
    const u = line.toUpperCase();
    const hits = [];
    for (const [k, re] of LABELS) {
      const g = new RegExp(re.source, 'g');
      let m;
      while ((m = g.exec(u))) hits.push({ k, at: m.index, end: m.index + m[0].length });
    }
    hits.sort((a, b) => a.at - b.at || b.end - a.end);
    const keep = hits.filter((h, i) => !hits.some((o, j) => j < i && h.at < o.end)); // no overlaps
    return keep.map((h, i) => ({ k: h.k, v: line.slice(h.end, keep[i + 1]?.at ?? line.length).replace(/^\s*[:：\-–]+\s*/, '').trim() }))
      // nothing written: blank, a dash, NA / NIL / not applicable
      .filter((p) => p.v && !/^([:\-–.]+|N\.?\/?A\.?|NIL|NONE|NOT APPLICABLE)$/i.test(p.v));
  }
  function isoDate(s) {
    const m = /(\d{1,2})\s*[./-]\s*(\d{1,2})\s*[./-]\s*(\d{2,4})/.exec(s || '');
    if (!m) return '';
    const y = m[3].length === 2 ? '20' + m[3] : m[3];
    return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }

  function parse(all) {
    const text = all.join('\n').toUpperCase();
    const out = { fields: {}, sections: {}, disposition: 'discharge' };
    // disposition from the wording
    if (/DISCHARGED? AT REQUEST|\bD\.?A\.?R\b/.test(text)) out.disposition = 'dar';
    else if (/AGAINST MEDICAL ADVICE|\bL?\.?D?\.?A\.?M\.?A\b/.test(text)) out.disposition = 'ama';
    else if (/ABSCOND/.test(text)) out.disposition = 'absconded';
    else if (/\bEXPIRED\b|DEATH SUMMARY/.test(text)) out.disposition = 'expired';
    else if (/TRANSFER SUMMARY|TRANSFERRED TO (THE )?POST[\s-]?OP/.test(text)) out.disposition = 'postop';
    // sections and labelled fields
    let cur = null;
    for (const line of all) {
      const u = norm(line);
      if (STOP.test(u)) { cur = null; continue; }
      const h = heading(line);
      if (h) {
        cur = h.k;
        out.sections[cur] ||= [];
        if (h.rest) out.sections[cur].push(h.rest);
        continue;
      }
      if (!cur) {
        for (const p of pairs(line)) if (!out.fields[p.k]) out.fields[p.k] = p.v;
        continue;
      }
      out.sections[cur].push(line.trim());
    }
    const f = out.fields;
    for (const k of ['doa', 'dos', 'dod']) if (f[k]) { const t = /@\s*([\d:.]+\s*(AM|PM)?)/i.exec(f[k]); f[k] = isoDate(f[k]); if (k === 'dod' && t) f.dodTime = t[1].toUpperCase(); }
    if (f.phone) f.phone = (f.phone.match(/[\d+][\d\s-]{6,}\d/) || [f.phone])[0].replace(/\s+/g, ' ').trim();
    if (f.ipNo) f.ipNo = f.ipNo.split(/\s{2,}/)[0].trim();
    // English and Tamil advice apart
    const sec = {};
    for (const [k, list] of Object.entries(out.sections)) {
      const body = list.filter((l) => l.trim());
      if (k === 'advice') {
        const ta = body.filter((l) => /[஀-௿]/.test(l));
        sec.advice = body.filter((l) => !/[஀-௿]/.test(l)).join('\n');
        if (ta.length) sec.adviceTa = ta.join('\n');
      } else sec[k] = body.join('\n');
    }
    out.sections = Object.fromEntries(Object.entries(sec).filter(([, v]) => v.trim()));
    return out;
  }

  async function read(file) {
    const doc = await open(file);
    const ls = await lines(doc);
    return { doc, lines: ls, ...parse(ls) };
  }

  return { read, open, lines, parse, pageImages, LABEL: Object.fromEntries(SECTIONS.map(([k, n]) => [k, n[0]])) };
})();
