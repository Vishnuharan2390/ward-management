// Admission-day deck engine, taken unchanged from the unit's admission-deck
// tool (github.com/Vishnuharan2390/admission-deck) so slides come out the same.
// Wrapped so its helpers (fmtDate, up, …) don't clash with the ward app's.
window.DeckEngine = (() => {
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
/* ===== Slide engine: shared by live preview and PowerPoint export ===== */
const SW = 26.667, SH = 15;            // slide size in inches (matches master deck)
const BAR_TOP = 13.855;                 // top of the amber/rust footer bars
const IMG_TOP = 0.3, IMG_BOTTOM = BAR_TOP - 0.3;   // image top & bottom margins
const IMG_SIDE = 0.3, IMG_GAP = 0.2;
const LABEL_PT = 40, LABEL_X = 0.35, LABEL_Y = 0.3, LABEL_H = 0.85;
const COL = { rust: 'BD582C', amber: 'E48312', title: '404040', cover: '262626', navy: '002060',
  rule: '808080', red: 'FF0000', peach: 'FBE4D5', ink: '000000', cons: '404040', bullet: '080808' };
const TBL = { x: 2.72, y: 3.8, colW: [4.13, 16.31] };
TBL.w = TBL.colW[0] + TBL.colW[1];
TBL.maxH = IMG_BOTTOM - TBL.y;

const WEEKDAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
const CONS_LEFT = [['admissions', 'TOTAL NO OF ADMISSIONS'], ['major', 'NO OF MAJOR PROCEDURES'],
  ['minor', 'NO OF MINOR PROCEDURES'], ['deaths', 'DEATHS'], ['ama', 'AMA'], ['abscond', 'ABSCOND'],
  ['transfer', 'TRANSFER OUT TO NS']];
const CONS_RIGHT = [['rta', 'RTA'], ['tta', 'TTA'], ['fall', 'FALL INJURIES'], ['assault', 'ASSAULT'],
  ['accidental', 'ACCIDENTAL INJURY'], ['self', 'SELF INFLICTED'], ['electro', 'ELECTROCUTION'], ['nmlc', 'NMLC']];

const STATUSES = ['OPERATED', 'AMA', 'ABSCOND', 'NEUROSURGERY T/O', 'PLASTIC T/O', 'VASCULAR T/O', 'SURGERY T/O'];
const caseStatus = c => up(c.status || (c.operated ? 'OPERATED' : ''));   // older saves used a tick box
const titleSize = (n, st) => Math.min(96, Math.floor(21.5 * 72 / (0.6 * (`CASE ${n}`.length + (st ? st.length + 3 : 0)))));
const up = s => String(s == null ? '' : s).toUpperCase().replace(/\r/g, '').trim();
function fmtDate(iso) { if (!iso) return ''; const [y, m, d] = iso.split('-'); return `${d}.${m}.${y}`; }
function weekday(iso) { if (!iso) return ''; const [y, m, d] = iso.split('-').map(Number); return WEEKDAYS[new Date(y, m - 1, d).getDay()]; }

/* ---- text measuring (approximate, Calibri caps) ---- */
function estLines(text, pt, widthIn, bold) {
  const cw = pt * (bold ? 0.66 : 0.6) / 72;
  const per = Math.max(1, Math.floor((widthIn - 0.15) / cw));
  return String(text || ' ').split('\n').reduce((n, p) => n + Math.max(1, Math.ceil(p.length / per)), 0);
}
function textWidth(text, pt) { return text.length * pt * 0.6 / 72; }

/* ---- case table: shrink fonts uniformly until it fits above the footer ---- */
function caseRows(c) {
  return [
    { k: 'NAME', v: up(c.name), kb: true, vb: true },
    { k: 'AGE/SEX', v: up(c.ageSex), vb: true },
    { k: 'MODE', v: up(c.mode) },
    { k: 'DIAGNOSIS', v: up(c.diagnosis), vb: true, diag: true },
    { k: 'TREATMENT', v: up(c.treatment) },
    { k: 'CASE SHEET WRITTEN BY', v: up(c.writtenBy), small: true },
  ];
}
function tableLayout(rows) {
  let s = 1, heights;
  for (; s >= 0.45; s -= 0.05) {
    heights = rows.map(r => {
      const vpt = (r.diag ? 32 : 36) * s, kpt = r.small ? 18 : 36 * s;
      const vh = estLines(r.v, vpt, TBL.colW[1], r.vb) * vpt;
      const kh = estLines(r.k, kpt, TBL.colW[0], r.kb) * kpt;
      return Math.max(1.05 * Math.max(s, 0.7), Math.max(vh, kh) * 1.2 / 72 + 0.18);
    });
    if (heights.reduce((a, b) => a + b, 0) <= TBL.maxH) break;
  }
  return { scale: Math.max(s, 0.45), heights };
}

/* ---- image fit: top & bottom of the picture sit on the slide margins, centred ---- */
function imageLayout(imgs, label) {
  const H = IMG_BOTTOM - IMG_TOP, maxW = SW - 2 * IMG_SIDE;
  const ars = imgs.map(i => i.w / i.h);
  const sum = ars.reduce((a, b) => a + b, 0);
  const gaps = IMG_GAP * Math.max(0, imgs.length - 1);
  let h = H, total = h * sum + gaps;
  if (total > maxW) { h = (maxW - gaps) / sum; total = maxW; }   // only very wide/panoramic sets
  let x = (SW - total) / 2;
  const y = IMG_TOP + (H - h) / 2;
  const boxes = ars.map(ar => { const b = { x, y, w: h * ar, h }; x += h * ar + IMG_GAP; return b; });
  const lw = label.length * LABEL_PT * 0.66 / 72 + 0.6;
  // Label sits in the free space top-left; if the image occupies that corner, it becomes a dark chip on the image
  const overlay = boxes.length > 0 && boxes[0].x < LABEL_X + lw + 0.15 && boxes[0].y < LABEL_Y + LABEL_H;
  const labelBox = overlay
    ? { x: boxes[0].x + 0.2, y: boxes[0].y + 0.2, w: lw, h: LABEL_H, chip: true }
    : { x: LABEL_X, y: LABEL_Y, w: lw, h: LABEL_H, chip: false };
  return { boxes, labelBox };
}

function coverModel(st) {
  const unit = up(st.unit) || 'I';
  const lines = [`ORTHO  UNIT ${unit}`, fmtDate(st.date), `(${weekday(st.date)})`];
  const prof = 'PROF.' + up(st.professor), daos = 'DAOS: ' + up(st.daos);
  const longest = Math.max(prof.length, daos.length);
  const subPt = Math.min(60, Math.floor(21.3 * 72 / (0.68 * Math.max(longest, 1))));
  return { kind: 'cover', target: 'sec-cover', lines, prof, daos, subPt };
}
function consModel(st) {
  const v = st.cons || {};
  return { kind: 'cons', target: 'sec-cons',
    left: CONS_LEFT.map(([k, l]) => `${l} : ${up(v[k])}`),
    right: CONS_RIGHT.map(([k, l]) => `${l} : ${up(v[k])}`) };
}

function buildModels(st, images) {
  const out = [coverModel(st), consModel(st)];
  (st.cases || []).forEach((c, i) => {
    const rows = caseRows(c);
    out.push({ kind: 'case', target: 'case-' + c.id, caseNo: i + 1, status: caseStatus(c), rows, ...tableLayout(rows) });
    (c.slides || []).forEach(s => {
      const imgs = s.images.map(id => images[id]).filter(Boolean);
      const label = up(s.label) || 'IMAGE';
      out.push({ kind: 'image', target: 'islide-' + s.id, caseNo: i + 1, label, imgs, ...imageLayout(imgs, label) });
    });
  });
  return out;
}

/* ---- PowerPoint export (pptxgenjs) ---- */
function buildPptx(PptxGenJS, st, images) {
  const pres = new PptxGenJS();
  pres.defineLayout({ name: 'DAY', width: SW, height: SH });
  pres.layout = 'DAY';
  pres.title = `Ortho Unit ${up(st.unit)} ${fmtDate(st.date)}`;
  pres.theme = { headFontFace: 'Calibri Light', bodyFontFace: 'Calibri' };
  const bars = () => [
    { rect: { x: 0, y: BAR_TOP, w: SW, h: 14.0 - BAR_TOP, fill: { color: COL.amber } } },
    { rect: { x: 0, y: 14.0, w: SW, h: 1.0, fill: { color: COL.rust } } },
  ];
  pres.defineSlideMaster({ title: 'BASE', background: { color: 'FFFFFF' }, objects: bars() });
  pres.defineSlideMaster({ title: 'RULED', background: { color: 'FFFFFF' },
    objects: [...bars(), { line: { x: 2.61, y: 3.8, w: 21.8, h: 0, line: { color: COL.rule, width: 0.75 } } }] });

  const rule = (slide, y) => slide.addShape(pres.shapes.LINE, { x: 2.61, y, w: 21.8, h: 0, line: { color: COL.rule, width: 0.75 } });

  for (const m of buildModels(st, images)) {
    if (m.kind === 'cover') {
      const s = pres.addSlide({ masterName: 'BASE' });
      s.addText(m.lines.map((t, i) => ({ text: t, options: { breakLine: i < m.lines.length - 1 } })), {
        x: 2.69, y: 1.1, w: 21.3, h: 8.0, isTextBox: true, fontFace: 'Calibri', fontSize: 160, color: COL.cover,
        align: 'center', valign: 'middle', lineSpacingMultiple: 0.9, margin: 0, objectName: 'Day title' });
      rule(s, 9.49);
      s.addText([{ text: m.prof, options: { breakLine: true } }, { text: m.daos }], {
        x: 2.69, y: 9.75, w: 21.3, h: 3.4, isTextBox: true, fontFace: 'Times New Roman', fontSize: m.subPt,
        color: COL.navy, charSpacing: 3, valign: 'top', paraSpaceAfter: 10, margin: 0, objectName: 'Faculty' });
    } else if (m.kind === 'cons') {
      const s = pres.addSlide({ masterName: 'RULED' });
      s.addText('CONSOLIDATION', { x: 1.18, y: 1.58, w: 19.2, h: 1.29, isTextBox: true, fontFace: 'Times New Roman',
        fontSize: 72, underline: { style: 'sng' }, color: COL.ink, align: 'center', valign: 'bottom', margin: 0, objectName: 'Title' });
      s.addText(m.left.map((t, i) => ({ text: t, options: { breakLine: i < m.left.length - 1, italic: i === 1 || i === 2 } })), {
        x: 3.23, y: 4.25, w: 10.2, h: 8.6, isTextBox: true, fontFace: 'Calibri', fontSize: 40, color: COL.cons,
        valign: 'top', paraSpaceAfter: 16, margin: 0, fit: 'shrink', objectName: 'Outcomes' });
      s.addText(m.right.map((t, i) => ({ text: t, options: { bullet: true, breakLine: i < m.right.length - 1 } })), {
        x: 13.9, y: 4.1, w: 11.0, h: 8.9, isTextBox: true, fontFace: 'Calibri', fontSize: 44, color: COL.bullet,
        valign: 'top', paraSpaceAfter: 14, margin: 0, fit: 'shrink', objectName: 'Mode of injury' });
    } else if (m.kind === 'case') {
      const s = pres.addSlide({ masterName: 'RULED' });
      const title = [{ text: `CASE ${m.caseNo}` }];
      if (m.status) title.push({ text: ` (${m.status})`, options: { color: COL.red } });
      s.addText(title, { x: 2.4, y: 0.63, w: 22, h: 3.1, isTextBox: true, fontFace: 'Calibri Light', fontSize: titleSize(m.caseNo, m.status),
        color: COL.title, valign: 'bottom', margin: 0, objectName: 'Case title' });
      const k = m.scale;
      const border = [{ type: 'solid', pt: 1, color: COL.ink }, { type: 'solid', pt: 1, color: COL.ink },
        { type: 'solid', pt: 1, color: COL.ink }, { type: 'solid', pt: 1, color: COL.ink }];
      const rows = m.rows.map(r => {
        const fill = r.diag ? { color: COL.peach } : undefined;
        return [
          { text: r.k, options: { bold: !!r.kb, fontSize: r.small ? 18 : Math.round(36 * k), color: COL.ink, fill, border } },
          { text: r.v || ' ', options: { bold: !!r.vb, fontSize: Math.round((r.diag ? 32 : 36) * k),
            color: r.diag ? COL.red : COL.ink, fill, border } },
        ];
      });
      s.addTable(rows, { x: TBL.x, y: TBL.y, w: TBL.w, colW: TBL.colW, rowH: m.heights, fontFace: 'Calibri',
        valign: 'top', margin: [3.6, 3.6, 3.6, 3.6], autoPage: false, objectName: 'Case details' });
    } else if (m.kind === 'image') {
      if (!m.imgs.length) continue;
      const s = pres.addSlide({ masterName: 'BASE' });
      m.imgs.forEach((img, i) => {
        const b = m.boxes[i];
        s.addImage({ data: img.data.replace(/^data:/, ''), x: b.x, y: b.y, w: b.w, h: b.h, objectName: `${m.label} ${i + 1}` });
      });
      const L = m.labelBox;
      s.addText(m.label, { x: L.x, y: L.y, w: L.w, h: L.h, isTextBox: true, fontFace: 'Calibri Light', fontSize: LABEL_PT,
        color: L.chip ? 'FFFFFF' : COL.title, fill: L.chip ? { color: '000000', transparency: 35 } : undefined,
        valign: 'middle', margin: [6, 12, 6, 12], wrap: false, objectName: 'Image title' });
    }
  }
  return pres;
}

/* ---- live preview (from the same tool) ---- */
const pct = (v, of) => (v / of * 100).toFixed(3) + '%';
const P = (x, y, w, h) => `left:${pct(x, SW)};top:${pct(y, SH)};width:${pct(w, SW)};height:${pct(h, SH)}`;
const F = pt => `font-size:${(pt / 72 / SW * 100).toFixed(3)}cqw`;
const bars = `<div class="abs bar-a" style="${P(0, 13.855, SW, 0.145)}"></div><div class="abs bar-r" style="${P(0, 14, SW, 1)}"></div>`;
const ruleAt = y => `<div class="abs rule" style="${P(2.61, y, 21.8, 0)}"></div>`;

function slideHTML(m) {
  let h = bars;
  if (m.kind === 'cover') {
    h += `<div class="abs" style="${P(2.69, 1.1, 21.3, 8)};display:flex;flex-direction:column;justify-content:center;text-align:center;${F(160)};color:#262626;line-height:.95">${m.lines.map(esc).join('<br>')}</div>`
      + ruleAt(9.49)
      + `<div class="abs tnr" style="${P(2.69, 9.75, 21.3, 3.4)};${F(m.subPt)};color:#002060;letter-spacing:.05em;white-space:nowrap">${esc(m.prof)}<div style="margin-top:.3em">${esc(m.daos)}</div></div>`;
  } else if (m.kind === 'cons') {
    h += `<div class="abs tnr" style="${P(1.18, 1.58, 19.2, 1.29)};${F(72)};text-align:center;text-decoration:underline;display:flex;align-items:flex-end;justify-content:center">CONSOLIDATION</div>` + ruleAt(3.8)
      + `<div class="abs" style="${P(3.23, 4.25, 10.2, 8.6)};${F(40)};color:#404040">${m.left.map((t, i) => `<div style="margin-bottom:.4em;${i === 1 || i === 2 ? 'font-style:italic' : ''}">${esc(t)}</div>`).join('')}</div>`
      + `<div class="abs" style="${P(13.9, 4.1, 11, 8.9)};${F(44)};color:#080808">${m.right.map(t => `<div style="margin-bottom:.32em">&bull;&nbsp; ${esc(t)}</div>`).join('')}</div>`;
  } else if (m.kind === 'case') {
    h += `<div class="abs light" style="${P(2.4, 0.63, 22, 3.1)};${F(titleSize(m.caseNo, m.status))};display:flex;align-items:flex-end;white-space:nowrap">CASE ${m.caseNo}${m.status ? `&nbsp;<span style="color:#FF0000">(${esc(m.status)})</span>` : ''}</div>` + ruleAt(3.8)
      + `<div class="abs" style="${P(2.72, 3.8, 20.44, 9.75)}"><table><colgroup><col style="width:${pct(4.13, 20.44)}"><col></colgroup>`
      + m.rows.map((r, i) => {
        const bg = r.diag ? 'background:#FBE4D5;' : '';
        return `<tr style="height:${(m.heights[i] / SW * 100).toFixed(3)}cqw"><td style="${bg}${F(r.small ? 18 : 36 * m.scale)};${r.kb ? 'font-weight:700' : ''}">${esc(r.k)}</td><td style="${bg}${F((r.diag ? 32 : 36) * m.scale)};${r.vb ? 'font-weight:700;' : ''}${r.diag ? 'color:#FF0000' : ''}">${esc(r.v)}</td></tr>`;
      }).join('') + `</table></div>`;
  } else if (m.kind === 'image') {
    if (!m.imgs.length) h += `<div class="abs noimg" style="${P(4, 0.3, 18.67, 13.25)}">No image on this slide yet. It will be left out of the download.</div>`;
    m.imgs.forEach((im, i) => { const b = m.boxes[i]; h += `<img class="abs" src="${im.url}" alt="" style="${P(b.x, b.y, b.w, b.h)}">`; });
    if (m.imgs.length) {
      const L = m.labelBox;
      h += `<div class="abs light ${L.chip ? 'lbl-chip' : 'plain'}" style="${P(L.x, L.y, L.w, L.h)};${F(LABEL_PT)};${L.chip ? 'color:#fff' : ''}">${esc(m.label)}</div>`;
    }
  }
  return h;
}

return { buildModels, buildPptx, slideHTML, CONS_LEFT, CONS_RIGHT, STATUSES, caseStatus, up, SW, SH };
})();
