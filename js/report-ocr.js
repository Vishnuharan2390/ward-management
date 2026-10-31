// Reads a photo of a lab report on the device (Tesseract OCR, nothing is
// uploaded) and picks out the unit's standard investigation values.
const ReportOCR = (() => {
  // Pinned versions. Downloaded once (~7 MB), then cached by the browser.
  const CDN = {
    script: 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js',
    worker: 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/worker.min.js',
    core: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1',
    lang: 'https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng@1.0.0/4.0.0_best_int',
  };
  let workerP = null;
  let onProgress = null;

  const loadScript = (src) => new Promise((res, rej) => {
    if (window.Tesseract) return res();
    const s = document.createElement('script');
    s.src = src;
    s.onload = res;
    s.onerror = () => rej(new Error('Could not download the report reader. Check the internet connection and try again.'));
    document.head.appendChild(s);
  });

  function worker() {
    workerP ||= (async () => {
      await loadScript(CDN.script);
      return Tesseract.createWorker('eng', 1, {
        workerPath: CDN.worker, corePath: CDN.core, langPath: CDN.lang,
        logger: (m) => onProgress && onProgress(m),
      });
    })().catch((e) => { workerP = null; throw e; });
    return workerP;
  }

  // Grey, contrast-stretched, at most 2200 px: helps with phone photos.
  async function prepare(file) {
    const src = URL.createObjectURL(file);
    try {
      const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('That file is not an image.')); i.src = src; });
      const k = Math.min(1, 2200 / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.round(img.naturalWidth * k);
      c.height = Math.round(img.naturalHeight * k);
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0, c.width, c.height);
      const d = ctx.getImageData(0, 0, c.width, c.height);
      let lo = 255;
      let hi = 0;
      const g = new Uint8ClampedArray(d.data.length / 4);
      for (let i = 0; i < g.length; i++) {
        g[i] = 0.299 * d.data[i * 4] + 0.587 * d.data[i * 4 + 1] + 0.114 * d.data[i * 4 + 2];
        if (g[i] < lo) lo = g[i];
        if (g[i] > hi) hi = g[i];
      }
      const span = Math.max(1, hi - lo);
      for (let i = 0; i < g.length; i++) {
        const v = ((g[i] - lo) * 255) / span;
        d.data[i * 4] = d.data[i * 4 + 1] = d.data[i * 4 + 2] = v;
      }
      ctx.putImageData(d, 0, 0);
      return c;
    } finally {
      URL.revokeObjectURL(src);
    }
  }

  async function read(file, progress) {
    onProgress = progress;
    const w = await worker();
    const { data } = await w.recognize(await prepare(file));
    return data.text || '';
  }

  // ---- text → values ----------------------------------------------------
  // Order matters: direct / indirect bilirubin before total.
  const ALIASES = [
    ['hb', /\b(ha?emoglobin|hgb|hb)\b/i],
    ['wbc', /\b(total\s*(wbc|w\.?\s*b\.?\s*c\.?|leu[ck]ocyte\s*count|leu[ck]ocytes?|count)|t\.?\s*l\.?\s*c\b|wbc|w\.b\.c|tc)\b/i],
    ['plt', /\b(platelets?(\s*count)?|plt)\b/i],
    ['rbs', /\b(rbs|grbs|random\s*(blood\s*)?(sugar|glucose)|(blood\s*)?(sugar|glucose)\s*[(-]?\s*random)\b/i],
    ['urea', /\b(blood\s*)?urea\b/i],
    ['creat', /\b(serum\s*)?creat(inine)?\b/i],
    ['na', /\b(sodium|na\+?)(?![a-z])/i],
    ['k', /\b(potassium|k\+)(?![a-z])/i],
    ['dbili', /\b((direct|conjugated)\s*bilirubin|bilirubin\s*[(-]?\s*direct|d\.?\s*bil)/i],
    ['ibili', /\b((indirect|unconjugated)\s*bilirubin|bilirubin\s*[(-]?\s*indirect|i\.?\s*bil)/i],
    ['tbili', /\b(total\s*bilirubin|bilirubin\s*[(-]?\s*total|t\.?\s*bil|bilirubin)\b/i],
    ['sgot', /\b(sgot|s\.g\.o\.t|ast)\b/i],
    ['sgpt', /\b(sgpt|s\.g\.p\.t|alt)\b/i],
    ['alp', /\b(alp|alkaline\s*phosphatase)\b/i],
    ['esr', /\besr\b/i],
    ['crp', /\b(c\s*-?\s*reactive\s*protein|q?crp)\b/i],
    ['hbsag', /\bhbs\s*ag\b/i],
    ['hcv', /\b(anti\s*-?\s*)?hcv\b/i],
    ['hiv', /\bhiv(\s*[i1]\s*(&|and)\s*[i2]+)?\b/i],
  ];
  // Plausible ranges: anything outside is treated as a misread.
  const SANE = {
    hb: [2, 25], wbc: [300, 150000], plt: [3000, 2500000], rbs: [20, 900], urea: [2, 450], creat: [0.1, 25],
    na: [95, 190], k: [1.5, 9.5], tbili: [0, 45], dbili: [0, 35], ibili: [0, 35], sgot: [1, 8000], sgpt: [1, 8000],
    alp: [10, 3500], esr: [0, 160], crp: [0, 600],
  };

  function fixDigits(line) {
    // Common OCR slips inside numbers: O→0, l/I→1, comma decimal.
    return line.replace(/(?<=\d)[Oo]|(?<![a-z])[Oo](?=[.,]?\d)/g, '0').replace(/(?<=\d)[lI|]|[lI|](?=\d)/g, '1');
  }

  // → { v, unsure } or null. `unsure` = a decimal point was put back.
  function valueFrom(seg, key) {
    const p = ALL_PARAMS.find((x) => x.k === key);
    if (p.options) {
      if (/non\s*-?\s*reactive|negative|\bnr\b|not\s*detected|absent/i.test(seg)) return { v: p.options[0] };
      if (/reactive|positive|detected|present/i.test(seg)) return { v: p.options[1] };
      return null;
    }
    // First number that isn't the start of a reference range ("06-12").
    const nums = [...seg.matchAll(/(\d[\d,]*(?:\.\d+)?)/g)];
    const m = nums.find((x) => !/^\s*[-–]\s*\d/.test(seg.slice(x.index + x[0].length)) && !/[-–]\s*$/.test(seg.slice(0, x.index)));
    if (!m) return null;
    const raw = m[1].replace(/,/g, '');
    let n = parseFloat(raw);
    if (Number.isNaN(n)) return null;
    const after = seg.slice(m.index + m[0].length, m.index + m[0].length + 24);
    const [lo, hi] = SANE[key];
    let unsure = false;
    if (p.scale) {
      if (/^\s*(lakhs?|lacs?|l)\b/i.test(after)) n *= 100000;
      else if (/10\s*\^?\s*3|10³|thou|^\s*k\b|x\s*10/i.test(after) && n < 2000) n *= 1000;
      else if (n < 100) n *= p.scale; // 8.4 → 8,400; 2.4 → 2,40,000
      n = Math.round(n);
    } else if (!raw.includes('.')) {
      // Blurry photos lose decimal points ("4.8" → "48"). If the reference
      // range printed on the line is ~10× the usual one, or the value is
      // impossible but makes sense ÷10, put the point back and say so.
      const ref = parseRange(p.range);
      const lr = seg.slice(m.index + m[0].length).match(/(\d[\d.]*)\s*[-–]\s*(\d[\d.]*)/);
      const lineHi = lr && !lr[0].includes('.') ? parseFloat(lr[2]) : null;
      if (lineHi && ref.hi && lineHi >= ref.hi * 8 && lineHi <= ref.hi * 12) { n /= 10; unsure = true; }
      else if ((n < lo || n > hi) && n / 10 >= lo && n / 10 <= hi) { n /= 10; unsure = true; }
    }
    return n >= lo && n <= hi ? { v: String(n), unsure } : null;
  }

  function parse(text) {
    const values = {};
    const unsure = [];
    for (const raw of String(text).split(/\n/)) {
      const line = fixDigits(raw);
      const hits = [];
      for (const [key, re] of ALIASES) {
        const g = new RegExp(re.source, 'gi');
        let m;
        while ((m = g.exec(line))) {
          // A shorter name inside a longer one already found (BILIRUBIN in DIRECT BILIRUBIN) isn't a new value.
          if (!hits.some((h) => m.index >= h.start && m.index < h.end)) hits.push({ key, start: m.index, end: m.index + m[0].length });
        }
      }
      hits.sort((a, b) => a.start - b.start);
      // "Haemoglobin (Hb) 10.2": consecutive names for the same test count once.
      const merged = hits.filter((h, i) => i === 0 || hits[i - 1].key !== h.key);
      merged.forEach((h, i) => {
        if (values[h.key]) return;
        const next = merged[i + 1];
        const seg = line.slice(h.end, next ? next.start : undefined).replace(/^[\s:=\-|.)(]+/, '');
        const r = valueFrom(seg, h.key);
        if (r) { values[h.key] = r.v; if (r.unsure) unsure.push(h.key); }
      });
    }
    // Report date: first dd/mm/yyyy (or dd-mm-yy) within the last four months.
    let date = '';
    const dm = String(text).match(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})\b/);
    if (dm) {
      const y = dm[3].length === 2 ? '20' + dm[3] : dm[3];
      const iso = `${y}-${String(dm[2]).padStart(2, '0')}-${String(dm[1]).padStart(2, '0')}`;
      const age = (new Date(todayISO()) - new Date(iso)) / 86400000;
      if (age >= 0 && age <= 120) date = iso;
    }
    return { values, date, unsure };
  }

  return { read, parse };
})();
