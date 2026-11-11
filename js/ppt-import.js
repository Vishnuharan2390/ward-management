// Read an admission-day PowerPoint (.pptx) back into cases for the e-case sheet.
// Built for the unit's admission deck (cover → consolidation → for each case: a "CASE n"
// slide with a NAME / AGE/SEX / MODE / DIAGNOSIS … table, then picture slides titled
// X-RAY, CT, WOUND PIC …), but also reads hand-made slides with "NAME : …" lines or a
// WhatsApp-style "Raja 26/M" line. Everything stays on the phone: the .pptx is just a zip.
const PptImport = (() => {
  const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const up = (s) => String(s ?? '').replace(/\s+/g, ' ').trim().toUpperCase();
  const all = (el, tag) => [...el.getElementsByTagNameNS('*', tag)];
  const xml = (s) => new DOMParser().parseFromString(s, 'application/xml');

  // Relationship id → target path, resolved against the part's folder.
  async function rels(zip, partPath) {
    const dir = partPath.replace(/[^/]*$/, '');
    const relPath = dir + '_rels/' + partPath.split('/').pop() + '.rels';
    const f = zip.file(relPath);
    const out = {};
    if (!f) return out;
    for (const r of all(xml(await f.async('string')), 'Relationship')) {
      const t = r.getAttribute('Target');
      if (r.getAttribute('TargetMode') === 'External') continue;
      const parts = (t.startsWith('/') ? t.slice(1) : dir + t).split('/');
      const res = [];
      for (const p of parts) { if (p === '..') res.pop(); else if (p !== '.') res.push(p); }
      out[r.getAttribute('Id')] = res.join('/');
    }
    return out;
  }

  // Paragraphs of a text body, joined with new lines.
  const textOf = (el) => all(el, 'p').map((p) => all(p, 't').map((t) => t.textContent).join('')).join('\n').trim();

  // One slide → { tables: [[[cell, …], …]], texts: [string], pics: [mediaPath] }
  async function readSlide(zip, path) {
    const doc = xml(await zip.file(path).async('string'));
    const rel = await rels(zip, path);
    const tables = all(doc, 'tbl').map((tbl) => all(tbl, 'tr').map((tr) => all(tr, 'tc').map((tc) => textOf(tc))));
    // Text boxes / placeholders (shapes), not the table cells.
    const texts = all(doc, 'sp').map((sp) => textOf(sp)).filter(Boolean);
    const pics = [];
    for (const b of all(doc, 'blip')) {
      const id = b.getAttributeNS(NS_R, 'embed') || b.getAttribute('r:embed');
      const p = id && rel[id];
      if (p && !pics.includes(p)) pics.push(p);
    }
    return { tables, texts, pics };
  }

  // Slides in the order they are shown (presentation.xml), not file-name order.
  async function slidePaths(zip) {
    const pres = 'ppt/presentation.xml';
    const f = zip.file(pres);
    if (!f) throw new Error('Not a PowerPoint (.pptx) file');
    const rel = await rels(zip, pres);
    return all(xml(await f.async('string')), 'sldId')
      .map((s) => rel[s.getAttributeNS(NS_R, 'id') || s.getAttribute('r:id')])
      .filter((p) => p && zip.file(p));
  }

  // "11.11.2026", "11/11/2026", "11-11-26" → ISO
  function isoDate(s) {
    const m = String(s || '').match(/\b(\d{1,2})[./\-](\d{1,2})[./\-](\d{2}|\d{4})\b/);
    if (!m) return '';
    const y = m[3].length === 2 ? '20' + m[3] : m[3];
    const mo = +m[2];
    const d = +m[1];
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return '';
    return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  // "26/M", "26 Y / F", "26yrs/male"
  const AGE_SEX = /(\d{1,3})\s*(?:y(?:rs?|ears?)?|yo)?\.?\s*[/\s,-]\s*(m|f|male|female)\b/i;
  const IP = /\bIP\s*(?:NO\.?|NUMBER)?\s*[:.\-]?\s*(\d{3,})/i;

  // Row label → which field it fills.
  function fieldOf(key) {
    const k = up(key).replace(/[^A-Z/ ]/g, '').replace(/\s+/g, ' ').trim();
    if (!k) return '';
    if (/^(PATIENT )?NAME$/.test(k)) return 'name';
    if (/^AGE ?\/? ?(SEX|GENDER)$|^AGE$|^SEX$/.test(k)) return 'ageSex';
    if (/^(IP|I\/P|IPNO|IP NO|IP NUMBER|INPATIENT NO)$/.test(k.replace(/\./g, ''))) return 'ipNo';
    if (/^WARD/.test(k)) return 'ward';
    if (/CONTACT|PHONE|MOBILE|ADDRESS/.test(k)) return 'contact';
    if (/^MODE/.test(k)) return 'mode';
    if (/DIAGNOSIS|^DX$|^D\/?X$/.test(k)) return 'diagnosis';
    if (/^TREATMENT|^MANAGEMENT|^TX$/.test(k)) return 'treatment';
    if (/WRITTEN BY|CASE SHEET/.test(k)) return 'writtenBy';
    if (/^PLAN|^PROCEDURE|^SURGERY/.test(k)) return 'plan';
    if (/^DOA$|DATE OF ADMISSION|^ADMITTED/.test(k)) return 'doa';
    return '';
  }

  // [[key, value], …] → case fields (null when it isn't a case).
  function fromPairs(pairs) {
    const c = {};
    for (const [k, v] of pairs) {
      const f = fieldOf(k);
      const val = String(v ?? '').trim();
      if (!f || !val) continue;
      if (f === 'name') {
        // "RAJA 26/M" in the name cell
        const m = val.match(AGE_SEX);
        c.name = up(m ? val.slice(0, m.index) : val).replace(/[,\-:\s]+$/, '');
        if (m && !c.age) { c.age = m[1]; c.sex = m[2][0].toUpperCase(); }
      } else if (f === 'ageSex') {
        const m = val.match(AGE_SEX);
        if (m) { c.age = m[1]; c.sex = m[2][0].toUpperCase(); } else if (/^\d{1,3}$/.test(val)) c.age = val;
        else if (/^(m|f|male|female)$/i.test(val)) c.sex = val[0].toUpperCase();
        const ip = val.match(IP);
        if (ip) c.ipNo = ip[1];
      } else if (f === 'contact') {
        const flat = val.replace(/\s*\n\s*/g, ', ');
        const ph = flat.match(/(?:\+?91[\s-]?)?\b[6-9]\d{4}[\s-]?\d{5}\b/);
        if (ph) c.phone = ph[0].replace(/[^\d+]/g, '');
        const addr = flat.replace(ph ? ph[0] : '', '').replace(/^[\s,;:\-]+|[\s,;:\-]+$/g, '');
        if (addr) c.address = up(addr);
      } else if (f === 'ipNo') c.ipNo = val.replace(/\D/g, '') || val;
      else if (f === 'doa') c.doa = isoDate(val);
      else if (f === 'diagnosis' || f === 'treatment' || f === 'plan') c[f] = val.split('\n').map(up).filter(Boolean).join('\n');
      else c[f] = up(val);
    }
    if (!c.name) return null;
    return c;
  }

  // "NAME : RAJA" lines in text boxes → pairs
  const linePairs = (text) => String(text).split('\n').map((l) => l.match(/^\s*([A-Za-z][A-Za-z ./]{1,30}?)\s*[:\-–]\s*(.+)$/)).filter(Boolean).map((m) => [m[1], m[2]]);

  // Picture-slide title → image type. Unknown titles get the X-ray / wound colour guess later.
  function kindOf(label) {
    const s = up(label);
    if (!s) return '';
    if (/POST[\s-]*OP.*(WOUND|PIC|PHOTO|CLINICAL)/.test(s)) return 'powound';
    if (/POST[\s-]*OP/.test(s)) return 'poxray';
    if (/POST[\s-]*RED|REDUCTION|CMR|AFTER (SLAB|POP|REDUCTION)/.test(s)) return 'prxray';
    if (/\bMRI\b/.test(s)) return 'mri';
    if (/\bCT\b|CT SCAN|\b3D\b/.test(s)) return 'ct';
    if (/WOUND|CLINICAL|PIC\b|PHOTO|INJURY/.test(s)) return 'wound';
    if (/X[\s-]*RAY|\bXR\b|RADIOGRAPH/.test(s)) return 'xray';
    return '';
  }

  const IMG_EXT = /\.(jpe?g|png|gif|webp|bmp)$/i;
  const MIME = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp' };

  // .pptx File → { date, unit, cases: [{ caseNo, name, age, sex, …, photos: [{ name, blob, kind }] }], skipped }
  async function read(file) {
    if (/\.ppt$/i.test(file.name)) throw new Error('This is an old .ppt file. Open it in PowerPoint / Keynote / Google Slides and save it as .pptx');
    let zip;
    try { zip = await JSZip.loadAsync(file); } catch { throw new Error('Not a PowerPoint (.pptx) file'); }
    const paths = await slidePaths(zip);
    if (!paths.length) throw new Error('No slides in this file');
    let date = '';
    let unit = '';
    let skipped = 0; // pictures PowerPoint stored in a format a browser can't show (EMF, TIFF…)
    const cases = [];
    let cur = null;
    for (const path of paths) {
      const s = await readSlide(zip, path);
      const allText = [...s.texts, ...s.tables.flat(2)].join('\n');
      // Cover slide: "ORTHO UNIT I", "11.11.2026"
      if (!cases.length && !date) {
        const d = isoDate(allText);
        if (d && /\bUNIT\b|ORTHO|PROF|DAOS/i.test(allText)) {
          date = d;
          unit = (allText.match(/\bUNIT\s+([IVX]+|\d+)\b/i) || [])[1]?.toUpperCase() || '';
          continue;
        }
      }
      // Case slide: a two-column table, or "KEY : value" lines, or a WhatsApp-style post.
      let c = null;
      for (const t of s.tables) {
        c = fromPairs(t.filter((r) => r.length >= 2).map((r) => [r[0], r.slice(1).join('\n')]));
        if (c) break;
      }
      if (!c) c = fromPairs(s.texts.flatMap(linePairs));
      if (!c && !s.pics.length) {
        const w = WaImport.parseCaseText(s.texts.join('\n'));
        if (w) c = w;
      }
      if (c) {
        // "CASE 3 (OPERATED)" title
        const title = s.texts.find((t) => /^\s*CASE\s*\d+/i.test(t)) || '';
        const no = title.match(/CASE\s*(?:NO\.?)?\s*(\d+)/i);
        const st = title.match(/\(([^)]+)\)/);
        cur = {
          name: '', age: '', sex: '', ipNo: '', ward: '', mode: '', diagnosis: '',
          ...c, caseNo: no ? no[1] : c.caseNo || String(cases.length + 1), deckStatus: st ? up(st[1]) : '', photos: [],
        };
        cases.push(cur);
      }
      // Pictures go with the case they follow (or sit on).
      if (cur && s.pics.length) {
        const label = s.texts.filter((t) => t.length <= 40).join(' ');
        for (const p of s.pics) {
          if (!IMG_EXT.test(p)) { skipped++; continue; }
          const data = await zip.file(p)?.async('blob');
          if (!data || data.size < 3000) continue; // logos / bullets
          const ext = p.split('.').pop().toLowerCase();
          cur.photos.push({ name: p.split('/').pop(), blob: new Blob([data], { type: MIME[ext] || 'image/jpeg' }), kind: kindOf(label), label });
        }
      }
    }
    return { date, unit, cases, skipped };
  }

  return { read, kindOf, fieldOf, isoDate };
})();
