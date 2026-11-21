// Read an OT list made outside the app (Word .docx or PDF) for the scheme report: the OT date from the
// title (or the file name) and, from the table found by its headings, each patient's name, age/sex,
// IP no., diagnosis, plan, scheme status and standby mark.
const OtImport = (() => {
  const COLS = [
    ['sno', /^S\.?\s?NO\.?$|^SL\.?\s?NO|^NO\.?$/],
    ['name', /NAME/],
    ['ageSex', /AGE/],
    ['ipNo', /\bI\.?\s?P\b|IP\s?NO|IPNO/],
    ['ward', /^WARD/],
    ['diagnosis', /DIAG/],
    ['procedure', /\bPLAN\b|PROCEDURE|SURGERY|OPERATION/], // not IMPLANTS
    ['level', /^LEVEL/],
    ['anaes', /ANAES|ANES/],
    ['implants', /IMPLANT/],
    ['scheme', /SCHEME|CMCHIS|INSURANCE|STATUS/],
  ];
  const keyOf = (h) => { const u = String(h || '').toUpperCase().replace(/\s+/g, ' ').trim(); const c = COLS.find(([, re]) => re.test(u)); return c ? c[0] : ''; };

  // "APPROVED", "VALIDATION", "NO SCHEME - NO CARD" … → [status, reason]
  function scheme(text) {
    const t = String(text || '').toUpperCase().replace(/\s+/g, ' ').trim();
    if (!t) return ['', ''];
    if (/NO SCHEME|NON[\s-]?SCHEME|\bNIL\b|NOT ELIGIBLE|NO CARD|PAYING|\bCASH\b|OTHER STATE|OUT OF STATE/.test(t)) {
      const reason = t.replace(/NO SCHEME|NON[\s-]?SCHEME|\bNIL\b/g, '').replace(/^[\s\-–:(),.]+|[\s\-–:(),.]+$/g, '').replace(/^REASON\s*[:\-]?\s*/, '');
      return ['NO SCHEME', reason];
    }
    if (/DENI|REJECT/.test(t)) return ['DENIED', ''];
    if (/APPROV|SANCTION|\bAPPD?\b/.test(t)) return ['APPROVED', ''];
    if (/VALIDAT/.test(t)) return ['VALIDATION', ''];
    if (/SUBMIT|PENDING|APPLIED|PRE[\s-]?AUTH|IN PROCESS|PROCESSING/.test(t)) return ['TO BE SUBMITTED', ''];
    return ['', ''];
  }
  function isoFrom(text) {
    const m = /(\d{1,2})\s*[./-]\s*(\d{1,2})\s*[./-]\s*(\d{2,4})/.exec(text || '');
    if (!m) return '';
    const y = m[3].length === 2 ? '20' + m[3] : m[3];
    return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }
  function rowOut(cells) {
    const r = Object.fromEntries(Object.entries(cells).map(([k, v]) => [k, String(v || '').replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim()]));
    const standby = /\bSTAND\s?-?\s?BY\b/i.test(r.name || '');
    const name = (r.name || '').replace(/\(?\s*STAND\s?-?\s?BY\s*\)?/ig, '').split('\n').map((x) => x.trim()).filter(Boolean).join(' ').toUpperCase();
    const [st, reason] = scheme(r.scheme);
    return { name, ageSex: (r.ageSex || '').toUpperCase().replace(/\s+/g, ''), ipNo: (r.ipNo || '').replace(/\s+/g, ''), diagnosis: (r.diagnosis || '').replace(/\n/g, ' ').toUpperCase(),
      procedure: (r.procedure || '').replace(/\n/g, ' ').toUpperCase(), schemeText: (r.scheme || '').replace(/\n/g, ' '), scheme: st, reason, standby };
  }

  // ---- Word
  const WNS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const pText = (p) => [...p.getElementsByTagNameNS(WNS, 't')].map((t) => t.textContent).join('');
  const textOf = (el) => (el.localName === 'p' ? pText(el) : [...el.getElementsByTagNameNS(WNS, 'p')].map(pText).join('\n'));
  async function fromDocx(file) {
    const z = await window.JSZip.loadAsync(file);
    const xml = await z.file('word/document.xml')?.async('string');
    if (!xml) throw new Error('not a Word document');
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    let header = '';
    for (const n of ['word/header1.xml', 'word/header2.xml', 'word/header3.xml']) { const h = await z.file(n)?.async('string'); if (h) header += ' ' + textOf(new DOMParser().parseFromString(h, 'application/xml')); }
    const body = doc.getElementsByTagNameNS(WNS, 'body')[0];
    const loose = [...body.childNodes].filter((n) => n.localName === 'p').map(textOf).join('\n');
    const rows = [];
    for (const tbl of doc.getElementsByTagNameNS(WNS, 'tbl')) {
      const trs = [...tbl.getElementsByTagNameNS(WNS, 'tr')].filter((tr) => tr.parentNode === tbl);
      let map = null;
      for (const tr of trs) {
        const tds = [...tr.childNodes].filter((n) => n.localName === 'tc').map(textOf);
        if (!map) {
          const keys = tds.map(keyOf);
          if (keys.includes('name') && (keys.includes('scheme') || keys.includes('procedure'))) map = keys;
          continue;
        }
        if (tds.map(keyOf).filter(Boolean).length >= 3) continue; // a repeated heading row
        const cells = {};
        tds.forEach((t, i) => { if (map[i]) cells[map[i]] = (cells[map[i]] ? cells[map[i]] + '\n' : '') + t; });
        const r = rowOut(cells);
        if (r.name) rows.push(r);
      }
    }
    const title = `${header}\n${loose}`;
    return { title: (title.match(/OT LIST[^\n]*/i) || [''])[0].trim(), date: isoFrom(title.match(/OT LIST[^\n]*/i)?.[0]) || isoFrom(title) || isoFrom(file.name), rows };
  }

  // ---- PDF: columns placed by the x of the heading words
  async function fromPdf(file) {
    const doc = await DcImport.open(file);
    const rows = [];
    let title = '';
    let cur = null;
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const tc = await page.getTextContent();
      const items = tc.items.filter((i) => i.str && i.str.trim()).map((i) => ({ s: i.str, x: i.transform[4], y: i.transform[5], w: i.width || 0, h: Math.abs(i.transform[3]) || 8 }));
      // lines (top to bottom)
      items.sort((a, b) => b.y - a.y || a.x - b.x);
      const lines = [];
      for (const it of items) {
        const l = lines.find((L) => Math.abs(L.y - it.y) < Math.max(2, it.h * 0.45));
        if (l) l.items.push(it); else lines.push({ y: it.y, items: [it] });
      }
      lines.forEach((l) => l.items.sort((a, b) => a.x - b.x));
      let cols = null;
      for (let li = 0; li < lines.length; li++) {
        const l = lines[li];
        const text = l.items.map((i) => i.s).join(' ');
        if (!title && /OT LIST/i.test(text)) { title = text.trim(); continue; }
        if (!cols) {
          // the heading: may wrap onto the next line ("AGE/" "SEX")
          const heads = [...l.items, ...(lines[li + 1] && lines[li + 1].y > l.y - 14 ? lines[li + 1].items : [])];
          const found = heads.map((i) => ({ k: keyOf(i.s), x: i.x })).filter((c) => c.k);
          if (found.some((c) => c.k === 'name') && found.length >= 3) {
            cols = [];
            for (const c of found.sort((a, b) => a.x - b.x)) if (!cols.some((o) => o.k === c.k)) cols.push(c);
            if (lines[li + 1] && lines[li + 1].y > l.y - 14 && lines[li + 1].items.every((i) => !/\d{3,}/.test(i.s))) li++;
          }
          continue;
        }
        if (/^\s*(ASSISTANT|ASST|PROF|DR\.?\s)/i.test(text) && l.items.length <= 3) continue; // the signature
        const colOf = (x) => { let k = cols[0].k; for (const c of cols) if (x >= c.x - 3) k = c.k; return k; };
        const parts = {};
        for (const it of l.items) { const k = colOf(it.x); parts[k] = (parts[k] ? parts[k] + ' ' : '') + it.s; }
        if (Object.values(parts).filter(Boolean).length >= 3 && Object.keys(parts).map((k) => keyOf(parts[k])).filter(Boolean).length >= 3) continue; // heading again
        const starts = cols.some((c) => c.k === 'sno') ? /^\d{1,3}\.?$/.test((parts.sno || '').trim()) : !!(parts.name && parts.ipNo);
        if (starts) { if (cur) rows.push(rowOut(cur)); cur = {}; }
        if (!cur) continue;
        for (const [k, v] of Object.entries(parts)) cur[k] = cur[k] ? `${cur[k]}\n${v}` : v;
      }
    }
    if (cur) rows.push(rowOut(cur));
    return { title, date: isoFrom(title) || isoFrom(file.name), rows: rows.filter((r) => r.name) };
  }

  async function read(file) {
    const isPdf = /\.pdf$/i.test(file.name) || file.type === 'application/pdf';
    const isDocx = /\.docx$/i.test(file.name) || /wordprocessingml/.test(file.type);
    if (!isPdf && !isDocx) throw new Error('use the Word (.docx) or PDF file of the OT list');
    return isPdf ? fromPdf(file) : fromDocx(file);
  }
  return { read, scheme };
})();
