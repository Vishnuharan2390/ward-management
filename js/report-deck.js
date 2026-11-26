// One design for every unit's report PowerPoint (specialty weekly reports, scheme report): navy cover with the
// Callus tree, case slides with three cards (history · imaging · diagnosis & plan), image slides two to a page,
// and a closing slide. Uses pptxgenjs (window.PptxGenJS), 13.33 x 7.5 in.
const ReportDeck = (() => {
  const C = { navy: '13294B', gold: 'FFD34D', ink: '1F2937', muted: '6B7280', card: 'F3F5F9', line: 'D5DBE6', white: 'FFFFFF' };
  const FONT = 'Calibri';
  const W = 13.33;
  const H = 7.5;
  const U = (v) => String(v ?? '').toUpperCase().trim();
  const DEPT = 'Department of Orthopaedic Surgery & Traumatology · Govt. Rajaji Hospital & Madurai Medical College';

  let logo = null; // the app icon (tree on navy), as a data URL
  async function loadLogo() {
    if (logo) return logo;
    try {
      const blob = await (await fetch('assets/icons/icon-512.png')).blob();
      logo = await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(blob); });
    } catch { logo = ''; }
    return logo;
  }

  function create() {
    const pres = new window.PptxGenJS();
    pres.layout = 'LAYOUT_WIDE';
    pres.defineSlideMaster({
      title: 'RPT',
      background: { color: C.white },
      objects: [
        { line: { x: 0.4, y: H - 0.42, w: W - 0.8, h: 0, line: { color: C.line, width: 0.75 } } },
        { text: { text: DEPT, options: { x: 0.4, y: H - 0.4, w: 10, h: 0.3, fontSize: 9, color: C.muted, fontFace: FONT } } },
      ],
      slideNumber: { x: W - 1.0, y: H - 0.4, w: 0.6, h: 0.3, fontSize: 9, color: C.muted, fontFace: FONT, align: 'right' },
    });
    return pres;
  }

  // Cover: title, what it covers, professor, unit
  function cover(pres, { title, sub, lines = [] }) {
    const s = pres.addSlide();
    s.background = { color: C.navy };
    s.addShape(pres.ShapeType.rect, { x: 0, y: 0, w: 0.22, h: H, fill: { color: C.gold }, line: { color: C.gold } });
    if (logo) s.addImage({ data: logo, x: 0.9, y: 0.9, w: 1.3, h: 1.3 });
    s.addText(U(title), { x: 0.9, y: 2.55, w: 11.5, h: 1.1, fontSize: 40, bold: true, color: C.white, fontFace: FONT });
    if (sub) s.addText(sub, { x: 0.9, y: 3.6, w: 11.5, h: 0.6, fontSize: 22, color: C.gold, fontFace: FONT });
    lines.filter(Boolean).forEach((l, i) => s.addText(l, { x: 0.9, y: 4.6 + i * 0.5, w: 11.5, h: 0.45, fontSize: 18, color: 'E5E7EB', fontFace: FONT, bold: i === 0 }));
    s.addText(DEPT, { x: 0.9, y: H - 0.8, w: 11.5, h: 0.4, fontSize: 12, color: '9CA3AF', fontFace: FONT });
    return s;
  }

  // Navy band across the top of a content slide: small kicker (e.g. CASE 2), the title, and a chip on the right
  function header(pres, s, { kicker, title, chip, right }) {
    s.addShape(pres.ShapeType.rect, { x: 0, y: 0, w: W, h: 0.95, fill: { color: C.navy }, line: { color: C.navy } });
    if (kicker) s.addText(U(kicker), { x: 0.4, y: 0.08, w: 6, h: 0.32, fontSize: 12, bold: true, color: C.gold, fontFace: FONT });
    s.addText(title, { x: 0.4, y: kicker ? 0.36 : 0.15, w: 9.3, h: kicker ? 0.52 : 0.65, fontSize: kicker ? 22 : 24, bold: true, color: C.white, fontFace: FONT, fit: 'shrink' });
    if (chip) {
      s.addShape(pres.ShapeType.roundRect, { x: W - 2.15, y: 0.27, w: 1.75, h: 0.42, fill: { color: C.gold }, line: { color: C.gold }, rectRadius: 0.2 });
      s.addText(U(chip), { x: W - 2.15, y: 0.27, w: 1.75, h: 0.42, fontSize: 13, bold: true, color: C.navy, align: 'center', valign: 'middle', fontFace: FONT });
    }
    if (right) s.addText(right, { x: W - 4.6, y: 0.27, w: chip ? 2.35 : 4.2, h: 0.42, fontSize: 12, color: 'E5E7EB', align: 'right', valign: 'middle', fontFace: FONT });
  }

  // A card: coloured title strip + body made of [{ label, text }] blocks; the font shrinks for long text
  function card(pres, s, { x, y, w, h, title, blocks }) {
    s.addShape(pres.ShapeType.roundRect, { x, y, w, h, fill: { color: C.card }, line: { color: C.line, width: 0.75 }, rectRadius: 0.08 });
    s.addShape(pres.ShapeType.rect, { x: x + 0.18, y: y + 0.18, w: 0.08, h: 0.36, fill: { color: C.gold }, line: { color: C.gold } });
    s.addText(U(title), { x: x + 0.34, y: y + 0.14, w: w - 0.5, h: 0.44, fontSize: 14, bold: true, color: C.navy, fontFace: FONT });
    const items = blocks.filter((b) => String(b.text ?? '').trim());
    const chars = items.reduce((n, b) => n + String(b.text).length + (b.label ? 20 : 0), 0);
    const size = chars > 900 ? 11 : chars > 650 ? 12 : chars > 450 ? 13 : chars > 280 ? 14 : 16;
    const runs = [];
    items.forEach((b, i) => {
      if (b.label) runs.push({ text: U(b.label), options: { bold: true, color: C.muted, fontSize: size - 2, breakLine: true, paraSpaceBefore: i ? 6 : 0 } });
      String(b.text).split('\n').map((l) => l.trim()).filter(Boolean).forEach((l) => runs.push({ text: U(l), options: { color: C.ink, fontSize: size, bold: !!b.strong, breakLine: true } }));
    });
    if (!runs.length) runs.push({ text: '—', options: { color: C.muted, fontSize: size } });
    s.addText(runs, { x: x + 0.22, y: y + 0.65, w: w - 0.44, h: h - 0.8, valign: 'top', fontFace: FONT, paraSpaceAfter: 2, fit: 'shrink' });
  }

  // One case: header, three cards, and (if operated) a strip with procedure / implants / date of surgery
  function caseSlide(pres, k) {
    const s = pres.addSlide({ masterName: 'RPT' });
    header(pres, s, { kicker: `CASE ${k.n}`, title: `${U(k.name)}  ${k.ageSex || ''}`.trim(), chip: k.unit, right: k.ip ? `IP ${k.ip}` : '' });
    const strip = (k.done || []).filter((x) => String(x.text || '').trim());
    const top = 1.2;
    const h = strip.length ? 4.55 : 5.6;
    const cw = (W - 0.8 - 0.4) / 3;
    card(pres, s, { x: 0.4, y: top, w: cw, h, title: 'History & examination', blocks: k.history });
    card(pres, s, { x: 0.4 + cw + 0.2, y: top, w: cw, h, title: 'Imaging', blocks: k.imaging });
    card(pres, s, { x: 0.4 + 2 * (cw + 0.2), y: top, w: cw, h, title: 'Diagnosis & plan', blocks: k.plan });
    if (strip.length) {
      const y = top + h + 0.18;
      s.addShape(pres.ShapeType.roundRect, { x: 0.4, y, w: W - 0.8, h: 0.95, fill: { color: 'FFF8E1' }, line: { color: 'F2D98A', width: 0.75 }, rectRadius: 0.08 });
      const sw = (W - 1.2) / strip.length;
      strip.forEach((b, i) => {
        s.addText([{ text: U(b.label), options: { bold: true, color: C.muted, fontSize: 10, breakLine: true } }, { text: U(b.text), options: { color: C.ink, fontSize: 12, bold: true } }],
          { x: 0.6 + i * sw, y: y + 0.08, w: sw - 0.2, h: 0.8, valign: 'top', fontFace: FONT, fit: 'shrink' });
      });
    }
    return s;
  }

  // Images two to a slide, each fitted inside its frame without stretching
  function imageSlides(pres, { kicker, title, chip, images }) {
    for (let i = 0; i < images.length; i += 2) {
      const pair = images.slice(i, i + 2);
      const s = pres.addSlide({ masterName: 'RPT' });
      header(pres, s, { kicker, title: images.length > 2 ? `${title} (${i / 2 + 1}/${Math.ceil(images.length / 2)})` : title, chip });
      const boxW = pair.length === 1 ? W - 0.8 : (W - 0.8 - 0.3) / 2;
      const boxH = H - 1.2 - 0.6;
      pair.forEach((im, j) => {
        const x = 0.4 + j * (boxW + 0.3);
        const y = 1.15;
        s.addShape(pres.ShapeType.rect, { x, y, w: boxW, h: boxH, fill: { color: '0B0F17' }, line: { color: C.line, width: 0.5 } });
        const r = Math.min((boxW - 0.1) / im.w, (boxH - 0.1) / im.h);
        const w = im.w * r;
        const h = im.h * r;
        s.addImage({ data: im.data, x: x + (boxW - w) / 2, y: y + (boxH - h) / 2, w, h });
      });
    }
  }

  function thanks(pres, text = 'THANK YOU SIR') {
    const s = pres.addSlide();
    s.background = { color: C.navy };
    s.addShape(pres.ShapeType.rect, { x: 0, y: 0, w: 0.22, h: H, fill: { color: C.gold }, line: { color: C.gold } });
    if (logo) s.addImage({ data: logo, x: (W - 1.1) / 2, y: 2.0, w: 1.1, h: 1.1 });
    s.addText(text, { x: 0.5, y: 3.4, w: W - 1, h: 1, fontSize: 40, bold: true, color: C.white, align: 'center', fontFace: FONT });
    return s;
  }

  // A plain table in the house style (header row navy, optional bold last row)
  function table(pres, s, rows, { x = 0.4, y = 1.2, w = W - 0.8, colW, fontSize = 12, totalRow = false, rowH } = {}) {
    const th = (t) => ({ text: U(t), options: { bold: true, color: C.white, fill: { color: C.navy }, align: 'center', valign: 'middle' } });
    const body = rows.slice(1).map((r, i, all) => r.map((v) => (typeof v === 'object' && v && 'text' in v ? v : {
      text: String(v ?? ''), options: { align: 'center', valign: 'middle', color: C.ink, ...(totalRow && i === all.length - 1 ? { bold: true, fill: { color: 'FFF4CC' } } : i % 2 ? { fill: { color: 'F8FAFC' } } : {}) } })));
    s.addTable([rows[0].map(th), ...body], { x, y, w, colW, fontSize, fontFace: FONT, valign: 'middle', rowH, border: { type: 'solid', pt: 0.5, color: 'B8C1D1' } });
  }

  return { C, U, create, loadLogo, cover, header, card, caseSlide, imageSlides, thanks, table };
})();
