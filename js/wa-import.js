// Pick up cases posted in the unit WhatsApp group.
// A post looks like:
//   Case 11
//   Udayakumar 26/M
//   MLC/RTA
//
//   COMPOUND GRADE IIIB
//   FRACTURE BOTH BONE LEG LEFT
// with X-ray and wound photos in the same post.
// Two ways in: paste one message, or open WhatsApp's "Export chat" file (.zip with photos, or .txt).
const WaImport = (() => {
  const clean = (s) => String(s ?? '').replace(/[‎‏‪-‮﻿]/g, '').replace(/[  ]/g, ' ');

  // "Udayakumar 26/M", "MURUGAN, 45 / F", "Selvi 62yrs/F", "Raja 30 M", "Baby Kavya 3y/F"
  const NAME_RE = /^(.*?[A-Za-z].*?)[\s,.\-:]+(\d{1,3})\s*(?:y(?:rs?|ears?)?|yo)?\.?\s*(?:\/|\s|,|-)\s*(m|f|male|female)\b\.?(.*)$/i;
  const CASE_RE = /^\s*case\s*(?:no\.?|number|#)?\s*[:.\-]?\s*(\d+)\b\s*[:.\-]?\s*(.*)$/i;
  const MODE_RE = /^(n?mlc\b.*|.*\b(rta|tta|assault|fall|accidental|work ?spot|electrocution|self inflicted|old rta)\b.*)$/i;

  const modeOf = (line) => {
    const u = line.toUpperCase().replace(/\s*\/\s*/g, '/').replace(/\s+/g, ' ').trim();
    return MODES.find((m) => m === u) || u;
  };

  // One message's text → case fields. Returns null when it doesn't look like a case post.
  function parseCaseText(text) {
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

  // ---- Exported chat ---------------------------------------------------------------
  // iPhone:  [26/10/26, 2:28:14 AM] Vishnu: Case 11 …        attachments: <attached: 00000012-PHOTO-….jpg>
  // Android: 26/10/26, 2:28 am - Vishnu: Case 11 …           attachments: IMG-20261026-WA0012.jpg (file attached)
  const IOS = /^\[(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4}),?\s+(\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?\s*([ap]\.?\s?m\.?)?\]\s*([^:]{1,60}?):\s?(.*)$/i;
  const AND = /^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4}),?\s+(\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?\s*([ap]\.?\s?m\.?)?\s+-\s+([^:]{1,60}?):\s?(.*)$/i;
  const ATTACH = [/<attached:\s*([^>]+)>/gi, /([\w\-. ]+\.(?:jpe?g|png|webp|heic|gif))\s*\(file attached\)/gi];

  function parseChat(txt) {
    const msgs = [];
    for (const rawLine of clean(txt).split(/\r?\n/)) {
      const m = rawLine.match(IOS) || rawLine.match(AND);
      if (m) {
        let [, d, mo, y, h, mi, s, ap, sender, body] = m;
        y = y.length === 2 ? '20' + y : y;
        let hh = +h;
        if (ap) { const pm = /p/i.test(ap); if (pm && hh < 12) hh += 12; if (!pm && hh === 12) hh = 0; }
        const date = `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        msgs.push({ date, t: Date.UTC(+y, +mo - 1, +d, hh, +mi, +(s || 0)), sender: sender.trim(), text: body, files: [] });
      } else if (msgs.length) {
        msgs.at(-1).text += '\n' + rawLine;
      }
    }
    for (const msg of msgs) {
      for (const re of ATTACH) msg.text = msg.text.replace(re, (_, f) => { msg.files.push(f.trim()); return ''; });
      msg.text = msg.text.replace(/^\s*(image|photo|video) omitted\s*$/gim, '').replace(/<media omitted>/gi, '').trim();
    }
    return msgs;
  }

  // Case posts plus the photos that belong to them: the photos in the same message, then
  // photo-only messages from the same person just before it (an album with a caption),
  // or, if none, just after it.
  function casesFromChat(msgs) {
    const out = [];
    const used = new Set();
    const photosOnly = (m) => m && !m.text && m.files.length;
    msgs.forEach((m, i) => {
      const c = m.text && parseCaseText(m.text);
      if (!c) return;
      const files = [...m.files];
      const near = (o) => o.sender === m.sender && Math.abs(o.t - m.t) <= 5 * 60e3;
      let j = i - 1;
      const before = [];
      while (photosOnly(msgs[j]) && near(msgs[j]) && !used.has(j)) before.unshift(j--);
      let idx = before;
      if (!idx.length) {
        idx = [];
        j = i + 1;
        while (photosOnly(msgs[j]) && near(msgs[j])) idx.push(j++);
      }
      idx.forEach((k) => used.add(k));
      const extra = idx.flatMap((k) => msgs[k].files);
      if (before.length) files.unshift(...extra); else files.push(...extra);
      out.push({ ...c, doa: m.date, t: m.t, sender: m.sender, files });
    });
    return out;
  }

  // X-rays are greyscale, wound photos are colourful.
  async function guessKind(blob) {
    const url = URL.createObjectURL(blob);
    try {
      const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
      const cv = document.createElement('canvas');
      cv.width = 48; cv.height = 48;
      const g = cv.getContext('2d');
      g.drawImage(img, 0, 0, 48, 48);
      const d = g.getImageData(0, 0, 48, 48).data;
      let sat = 0;
      let r = 0;
      let b = 0;
      for (let p = 0; p < d.length; p += 4) {
        sat += Math.max(d[p], d[p + 1], d[p + 2]) - Math.min(d[p], d[p + 1], d[p + 2]);
        r += d[p];
        b += d[p + 2];
      }
      const n = d.length / 4;
      const s = sat / n / 255;
      // greyscale film, or a blue-grey film photographed on a light box / phone screen
      return s < 0.07 || (b / n > r / n + 8 && s < 0.35) ? 'xray' : 'wound';
    } catch { return 'wound'; } finally { URL.revokeObjectURL(url); }
  }

  // Open an export (.zip or .txt) → [{ ...case, photos: [{ name, blob }] }]
  async function readExport(file) {
    if (/\.txt$/i.test(file.name) || file.type === 'text/plain') {
      return casesFromChat(parseChat(await file.text())).map((c) => ({ ...c, photos: [], missing: c.files.length }));
    }
    const zip = await JSZip.loadAsync(file);
    const entries = Object.values(zip.files).filter((f) => !f.dir);
    const chat = entries.find((f) => /(^|\/)_chat\.txt$/i.test(f.name)) || entries.find((f) => /\.txt$/i.test(f.name));
    if (!chat) throw new Error('No chat text in this zip');
    const byName = new Map(entries.map((f) => [f.name.split('/').pop().toLowerCase(), f]));
    const cases = casesFromChat(parseChat(await chat.async('string')));
    for (const c of cases) {
      c.photos = [];
      for (const n of c.files) {
        const f = byName.get(n.toLowerCase());
        if (f && /\.(jpe?g|png|webp|gif|heic)$/i.test(n)) c.photos.push({ name: n, blob: await f.async('blob') });
      }
      c.missing = c.files.length - c.photos.length;
    }
    return cases;
  }

  const key = (name, age) => `${String(name).toUpperCase().replace(/[^A-Z]/g, '')}|${String(age || '').replace(/\D/g, '')}`;

  return { parseCaseText, parseChat, casesFromChat, readExport, guessKind, key };
})();
