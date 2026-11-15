// Ward order from a typed / pasted / dictated bed list.
// "3 Ravi", "Bed 4 - Selvi 62/F", "Murugan", or dictation run together:
// "bed one ravi bed two selvi bed three murugan". Each line is matched to a patient by name
// (spelling need not be exact) or IP number; a bed number on the line is kept.
const BedArrange = (() => {
  const WORDS = {
    ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5, SIX: 6, SEVEN: 7, EIGHT: 8, NINE: 9, TEN: 10,
    ELEVEN: 11, TWELVE: 12, THIRTEEN: 13, FOURTEEN: 14, FIFTEEN: 15, SIXTEEN: 16, SEVENTEEN: 17,
    EIGHTEEN: 18, NINETEEN: 19, TWENTY: 20, THIRTY: 30, FORTY: 40, FIFTY: 50,
  };
  const TENS = { TWENTY: 20, THIRTY: 30, FORTY: 40, FIFTY: 50 };
  // "twenty one" → 21, "three" → 3; leaves other words alone. Speech often writes "to/too/for" for 2/4.
  function numberWords(s) {
    return s
      .replace(/\b(TWENTY|THIRTY|FORTY|FIFTY)[\s-]+(ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE)\b/g, (_, t, u) => String(TENS[t] + WORDS[u]))
      .replace(/\b(BED)\s+(TO|TOO)\b/g, '$1 2').replace(/\b(BED)\s+(FOR)\b/g, '$1 4')
      .replace(/\b(ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN|ELEVEN|TWELVE|THIRTEEN|FOURTEEN|FIFTEEN|SIXTEEN|SEVENTEEN|EIGHTEEN|NINETEEN|TWENTY|THIRTY|FORTY|FIFTY)\b/g, (w) => String(WORDS[w]));
  }

  // Text → [{ raw, bed, query }]
  function parse(text) {
    let t = numberWords(String(text || '').toUpperCase());
    // Dictation comes as one run: start a new line at each "BED".
    t = t.replace(/\s+(?=BED\b)/g, '\n');
    return t.split(/[\n,;]+|\.(?=\s|$)/).map((raw) => raw.trim()).filter(Boolean).map((raw) => {
      let rest = raw;
      let bed = '';
      const m = rest.match(/^(?:BED\s*(?:NO\.?|NUMBER)?\s*[:.-]?\s*)?(\d{1,3}[A-Z]?)\b[\s.:)-]*/) || rest.match(/\bBED\s*(?:NO\.?|NUMBER)?\s*[:.-]?\s*(\d{1,3}[A-Z]?)\b/);
      if (m) { bed = m[1]; rest = rest.replace(m[0], ' '); }
      rest = rest.replace(/\bBED\b/g, ' ');
      return { raw, bed, query: rest.replace(/\s+/g, ' ').trim() };
    }).filter((l) => l.query || l.bed);
  }

  // Spelling-insensitive form of a name: LAXMI = LAKSHMI, SARASWATHY = SARASWATHI, VELU = WELU…
  const sound = (w) => w.replace(/KSH|KS|X/g, 'K').replace(/SH/g, 'S').replace(/([TDKGBP])H/g, '$1').replace(/PH/g, 'F').replace(/W/g, 'V').replace(/Z/g, 'S')
    .replace(/EE|IE/g, 'I').replace(/OO/g, 'U').replace(/Y\b/g, 'I').replace(/Y/g, 'I').replace(/(.)\1+/g, '$1');
  const letters = (s) => sound(String(s || '').toUpperCase().replace(/[^A-Z]/g, ''));
  const tokens = (s) => String(s || '').toUpperCase().split(/[^A-Z]+/).filter((w) => w.length > 1).map(sound);
  function dice(a, b) {
    if (!a || !b) return 0;
    if (a === b) return 1;
    if (a.length < 2 || b.length < 2) return 0;
    const grams = (s) => { const m = new Map(); for (let i = 0; i < s.length - 1; i++) { const g = s.slice(i, i + 2); m.set(g, (m.get(g) || 0) + 1); } return m; };
    const A = grams(a);
    const B = grams(b);
    let both = 0;
    for (const [g, n] of A) both += Math.min(n, B.get(g) || 0);
    return (2 * both) / (a.length - 1 + b.length - 1);
  }
  // How well a line names this patient (0–1).
  function score(line, c) {
    const ip = (line.query.match(/\b\d{4,}\b/) || [])[0];
    if (ip && String(c.ipNo || '').includes(ip)) return 1;
    const qt = tokens(line.query.replace(/\d+\s*\/?\s*[MF]\b/g, ' ')); // drop "62/F"
    const nt = tokens(c.name);
    if (!qt.length || !nt.length) return 0;
    const whole = dice(letters(qt.join('')), letters(c.name));
    // each spoken word against its best name word (handles initials and extra words)
    const per = qt.map((q) => Math.max(...nt.map((n) => (n.startsWith(q) || q.startsWith(n) ? Math.max(0.85, dice(q, n)) : dice(q, n)))));
    const words = per.reduce((a, b) => a + b, 0) / per.length;
    return Math.max(whole, words * 0.97);
  }

  // Lines + cases → { order: [caseId], beds: {caseId: bed}, unmatched: [raw], missing: [case] }
  function match(lines, cases, threshold = 0.55) {
    const pairs = [];
    lines.forEach((l, i) => cases.forEach((c) => { const s = score(l, c); if (s >= threshold) pairs.push([s, i, c.id]); }));
    pairs.sort((a, b) => b[0] - a[0]);
    const lineTo = new Map();
    const used = new Set();
    for (const [, i, id] of pairs) if (!lineTo.has(i) && !used.has(id)) { lineTo.set(i, id); used.add(id); }
    const order = [];
    const beds = {};
    const unmatched = [];
    lines.forEach((l, i) => {
      const id = lineTo.get(i);
      if (!id) { unmatched.push(l.raw); return; }
      order.push(id);
      if (l.bed) beds[id] = l.bed;
    });
    return { order, beds, unmatched, missing: cases.filter((c) => !used.has(c.id)) };
  }

  return { parse, match, score };
})();
