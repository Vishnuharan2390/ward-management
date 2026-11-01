// The discharge summary drawn as A4 page images (same layout as the printed PDF), for the
// end of the discharge PowerPoint: one page per slide. Drawn with the canvas text API so it
// works the same on iPhone Safari and desktop browsers.
const DcPages = (() => {
  const W = 1240; // A4 at 150 dpi
  const H = 1754;
  const PT = 150 / 72; // px per point
  const M = Math.round(12 * 150 / 25.4); // 12 mm page margin
  const SERIF = '"Times New Roman", Times, serif';
  const TAMIL = '"Tamil Sangam MN", "Noto Sans Tamil", "Latha", "Nirmala UI", sans-serif';
  const up = (s) => String(s ?? '').toUpperCase();

  const loadImg = (src) => new Promise((res) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => res(null);
    i.src = src;
  });

  // Word-wrap one paragraph to a width; very long words are broken by character.
  function wrap(g, text, width) {
    const out = [];
    for (const para of String(text ?? '').split('\n')) {
      let line = '';
      for (const word of para.split(/\s+/).filter(Boolean)) {
        const tryLine = line ? line + ' ' + word : word;
        if (g.measureText(tryLine).width <= width) { line = tryLine; continue; }
        if (line) out.push(line);
        if (g.measureText(word).width <= width) { line = word; continue; }
        line = '';
        for (const ch of word) {
          if (g.measureText(line + ch).width > width && line) { out.push(line); line = ''; }
          line += ch;
        }
      }
      out.push(line);
    }
    return out;
  }

  async function render(c, d, meta) {
    const lh = await loadImg(meta.letterhead || 'assets/letterhead.jpg');
    const disp = DISPOSITIONS[d.disposition] || DISPOSITIONS.discharge;
    const pages = [];
    let g;
    let y;

    // ---- the header block (letterhead + grey details box), repeated on every page
    const box = [
      ['PATIENT NAME', c.name, 'I.P NO', c.ipNo],
      ['AGE / GENDER', ageSex(c), 'AR NO', d.arNo],
      ['DOA', fmtDate(c.doa), d.disposition === 'postop' ? 'DOT' : 'DOD', [fmtDate(d.dod), d.dodTime ? '@ ' + d.dodTime : ''].filter(Boolean).join(' ')],
      ['CONSULTANT', d.consultant, 'PH.NO', d.phone],
      ['ATTENDER', d.attender, 'ADDRESS', d.address],
      ...(d.contact ? [['CONTACT NO', d.contact, '', '']] : []),
    ];
    const CW = W - 2 * M;
    const col = [0.175, 0.02, 0.315, 0.12].map((f) => f * CW);
    const bx = [M, M + col[0], M + col[0] + col[1], M + col[0] + col[1] + col[2], M + col[0] + col[1] + col[2] + col[3]];
    const bxW = [col[0], col[1], col[2], col[3], CW - col[0] - col[1] - col[2] - col[3]];
    const boxPt = 9 * PT;
    const boxLH = boxPt * 1.3;
    const pad = 2.5 * PT;

    function header() {
      y = M;
      if (lh) {
        const h = 24 * 150 / 25.4;
        let w = lh.width * (h / lh.height);
        let hh = h;
        if (w > CW * 0.8) { w = CW * 0.8; hh = lh.height * (w / lh.width); }
        g.drawImage(lh, (W - w) / 2, y, w, hh);
        y += hh + 3 * PT;
      }
      // measure rows first, then paint the grey box behind them
      g.font = `bold ${boxPt}px ${SERIF}`;
      const rows = box.map((r) => {
        const cells = [r[0], ':', up(r[1]), r[2] ? r[2] + ':' : '', up(r[3])].map((t, i) => wrap(g, t, bxW[i] - 2 * pad - (i === 0 ? 10 * PT - pad : 0)));
        return { cells, h: Math.max(...cells.map((l) => l.length)) * boxLH + 2 * pad };
      });
      const total = rows.reduce((a, r) => a + r.h, 0);
      g.fillStyle = '#e6e6e6';
      g.fillRect(M, y, CW, total);
      g.fillStyle = '#000';
      g.textBaseline = 'top';
      for (const r of rows) {
        r.cells.forEach((lines, i) => {
          const x = bx[i] + pad + (i === 0 ? 10 * PT - pad : 0);
          lines.forEach((t, k) => g.fillText(t, x, y + pad + k * boxLH));
        });
        y += r.h;
      }
      y += 8 * PT;
    }

    function newPage() {
      const cv = document.createElement('canvas');
      cv.width = W;
      cv.height = H;
      g = cv.getContext('2d');
      g.fillStyle = '#fff';
      g.fillRect(0, 0, W, H);
      g.fillStyle = '#000';
      pages.push(cv);
      header();
    }

    // ---- body
    const bodyPt = 10.5 * PT;
    const LH = bodyPt * 1.25;
    const BX = M + CW * 0.06;
    const BW = CW * 0.88;
    const bottom = H - M;
    const room = (h) => { if (y + h > bottom) newPage(); };
    const text = (t, x, { bold = false, underline = false, center = false, font = SERIF, pt = bodyPt } = {}) => {
      g.font = `${bold ? 'bold ' : ''}${pt}px ${font}`;
      const w = g.measureText(t).width;
      const tx = center ? (W - w) / 2 : x;
      g.fillText(t, tx, y);
      if (underline && t) g.fillRect(tx, y + pt * 1.02, w, Math.max(1, pt / 14));
    };
    const para = (t, x, width, opt = {}) => {
      g.font = `${opt.bold ? 'bold ' : ''}${opt.pt || bodyPt}px ${opt.font || SERIF}`;
      for (const line of wrap(g, t, width)) {
        room(opt.lh || LH);
        text(line, x, opt);
        y += opt.lh || LH;
      }
    };
    const section = (label, val, indent = 0) => {
      if (!val || !String(val).trim()) return;
      room(LH * 2);
      text(label, BX, { bold: true, underline: true });
      y += LH + 3 * PT - (LH - bodyPt * 1.15);
      para(String(val), BX + indent, BW - indent);
      y += 8 * PT;
    };

    newPage();
    if (disp.title) { room(LH); text(disp.title, 0, { bold: true, underline: true, center: true }); y += LH + 8 * PT; }
    section('DIAGNOSIS IN DETAIL', up(d.diagnosis));
    section('PROCEDURE IN DETAIL', up(d.procedure));
    section('UNIT/CONSULTANTS', up(d.unitLine));
    section('H/O INJURY / ILLNESS', up(d.history));
    section('PAST HISTORY / TREATMENT HISTORY', up(d.past));
    section('EXAMINATION FINDINGS:', d.exam);
    section('INVESTIGATIONS', up(d.investigations));
    section('OPERATIVE NOTES', up(c.opNotes || d.opNotes));
    section('TREATMENT GIVEN', up(d.treatment));
    section('COURSE IN HOSPITAL:', up(d.course));
    section('CONDITION ON ' + (d.disposition === 'postop' ? 'TRANSFER' : 'DISCHARGE'), up(d.condition));
    section('DISCHARGE MEDICATIONS', up(d.meds));
    section('DISCHARGE ADVICE', up(d.advice), 30 * PT);
    const ta = String(d.adviceTa || '').split('\n').map((l) => l.trim()).filter(Boolean);
    if (ta.length) {
      y += 6 * PT - 8 * PT;
      for (const l of ta) para('* ' + l, BX, BW, { font: TAMIL, pt: 9 * PT, lh: 9 * PT * 1.45 });
      y += 8 * PT;
    }
    // doctor + signature stay together
    room(26 * PT + LH + 30 * PT + LH);
    y += 26 * PT;
    g.font = `bold ${bodyPt}px ${SERIF}`;
    const lab = 'DISCHARGING DOCTOR: ';
    g.fillText(lab, BX, y);
    const lw = g.measureText(lab).width;
    g.font = `${bodyPt}px ${SERIF}`;
    g.fillText(up(d.doctor), BX + lw, y);
    y += LH + 30 * PT;
    g.font = `bold ${bodyPt}px ${SERIF}`;
    const sig = 'DOCTOR SIGNATURE';
    g.fillText(sig, M + CW * 0.9 - g.measureText(sig).width, y);

    return pages.map((cv) => cv.toDataURL('image/png'));
  }

  return { render, ASPECT: H / W };
})();
