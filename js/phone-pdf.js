// Phones can't be trusted with window.print(): iPhone Safari (and the home-screen app) often
// ignores it, more so after an await, and Android's print-to-PDF is hit and miss. So on a
// phone the OT list's pre-op imaging and Tamil consent forms are built as real PDF files
// with jsPDF and handed to the share sheet. The consent forms are drawn on a canvas first,
// because jsPDF's fonts can't lay out Tamil script.
const PhonePdf = (() => {
  const up = (s) => String(s ?? '').toUpperCase();
  // jsPDF's built-in fonts cover plain Latin only.
  const latin = (s) => String(s ?? '').replace(/[·•]/g, '-').replace(/[^\x20-\x7E\xA0-\xFF]/g, '').replace(/\s+/g, ' ').trim();
  const stamp = (iso) => fmtDate(iso || todayISO()).replace(/\//g, '-');

  // iPads say "Macintosh" but have touch; a real Mac has no touch points.
  function isPhone() {
    const ua = navigator.userAgent || '';
    return /iPhone|iPad|iPod|Android|Mobile/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  }

  const loadImg = (src) => new Promise((res) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => res(null);
    i.src = src;
  });

  // jsPDF takes JPEG and PNG; anything else (WebP, HEIC that the browser decoded) goes through a canvas.
  async function pdfImage(src) {
    const img = await loadImg(src);
    if (!img || !img.naturalWidth) return null;
    const m = /^data:image\/(jpe?g|png);/i.exec(src);
    if (m) return { data: src, fmt: /png/i.test(m[1]) ? 'PNG' : 'JPEG', w: img.naturalWidth, h: img.naturalHeight };
    const cv = document.createElement('canvas');
    cv.width = img.naturalWidth;
    cv.height = img.naturalHeight;
    const g = cv.getContext('2d');
    g.fillStyle = '#fff';
    g.fillRect(0, 0, cv.width, cv.height);
    g.drawImage(img, 0, 0);
    return { data: cv.toDataURL('image/jpeg', 0.9), fmt: 'JPEG', w: cv.width, h: cv.height };
  }

  // A share needs a fresh tap: the work above took too long for the original one to still count.
  // So show a bar with a button; tapping it opens the share sheet (or saves the file).
  function offer(file) {
    $('#pdf-ready')?.remove();
    const bar = document.createElement('div');
    bar.id = 'pdf-ready';
    bar.setAttribute('role', 'dialog');
    bar.style.cssText = 'position:fixed;left:50%;bottom:calc(16px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:70;'
      + 'display:flex;gap:.5rem;align-items:center;max-width:calc(100% - 32px);padding:.6rem .8rem;border-radius:10px;'
      + 'background:var(--bg,#fff);color:var(--ink,#000);box-shadow:0 6px 24px rgba(0,0,0,.3);';
    bar.innerHTML = `<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.85rem">${esc(file.name)}</span>`
      + '<button class="btn primary" data-go>Share / Save</button><button class="btn" data-x aria-label="Close">✕</button>';
    document.body.appendChild(bar);
    const close = () => bar.remove();
    bar.querySelector('[data-x]').onclick = close;
    bar.querySelector('[data-go]').onclick = () => {
      let canShare = false;
      try { canShare = !!(navigator.share && navigator.canShare && navigator.canShare({ files: [file] })); } catch { canShare = false; }
      if (canShare) {
        navigator.share({ files: [file], title: file.name })
          .then(close)
          .catch((e) => { if (e.name !== 'AbortError') { download(file); close(); } });
      } else {
        download(file);
        close();
      }
    };
  }
  function download(file) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file);
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 60000);
    toast(`Saved ${file.name}`, 4000);
  }

  // ---------------------------------------------------------------- Pre-op imaging
  // Same layout as Print.otXrays: patient box, section heading, the images side by side, list line at the foot.
  // opt.foot / opt.name: footer line and file name (default: the OT list's).
  async function otXrays(items, draft, opt = {}) {
    const { jsPDF } = window.jspdf;
    const d = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const PW = 210;
    const PH = 297;
    const M = 10;
    const CW = PW - 2 * M;
    const foot = latin(opt.foot ?? Print.otTitle(draft)[0]);
    let first = true;
    for (const { c, n, sections } of items) {
      for (const { title, images, per = 3 } of sections) {
        const pics = (await Promise.all(images.map(pdfImage))).filter(Boolean);
        const total = Math.ceil(pics.length / per);
        for (let i = 0; i < pics.length; i += per) {
          const part = pics.slice(i, i + per);
          if (!first) d.addPage();
          first = false;
          // patient box
          d.setTextColor(0);
          d.setFont('helvetica', 'bold');
          d.setFontSize(12.5);
          const dx = d.splitTextToSize(latin(up(c.diagnosis)), CW - 6);
          const boxH = 4 + 6.5 + dx.length * 5 + 2;
          d.setLineWidth(0.5);
          d.rect(M, M, CW, boxH);
          d.setFontSize(17);
          d.setFont('helvetica', 'normal');
          const no = n ? `${n}.` : '';
          d.text(no, M + 3, M + 8.5);
          const nw = no ? d.getTextWidth(no + ' ') : 0;
          d.setFont('helvetica', 'bold');
          d.text(latin(`${up(c.name)}   ${up(ageSex(c))}`), M + 3 + nw, M + 8.5, { maxWidth: CW - 6 - nw });
          d.setFontSize(12.5);
          d.text(dx, M + 3, M + 15);
          let y = M + boxH + 4;
          // heading
          d.setFont('times', 'bold');
          d.setFontSize(16);
          const t = latin(title);
          const tw = d.getTextWidth(t);
          const partTxt = total > 1 ? `  (${i / per + 1}/${total})` : '';
          d.setFont('times', 'normal');
          d.setFontSize(11);
          const pw = partTxt ? d.getTextWidth(partTxt) : 0;
          const tx = (PW - tw - pw) / 2;
          d.setFont('times', 'bold');
          d.setFontSize(16);
          d.text(t, tx, y + 5.5);
          d.setLineWidth(0.4);
          d.line(tx, y + 6.6, tx + tw, y + 6.6);
          if (partTxt) { d.setFont('times', 'normal'); d.setFontSize(11); d.text(partTxt, tx + tw, y + 5.5); }
          y += 10;
          // images, side by side, each fitted into its slot
          const bottom = PH - M - 5;
          const gap = 4;
          const slotW = (CW - gap * (part.length - 1)) / part.length;
          const slotH = bottom - y;
          part.forEach((im, k) => {
            const s = Math.min(slotW / im.w, slotH / im.h);
            const w = im.w * s;
            const h = im.h * s;
            d.addImage(im.data, im.fmt, M + k * (slotW + gap) + (slotW - w) / 2, y + (slotH - h) / 2, w, h, undefined, 'FAST');
          });
          // foot
          d.setFont('helvetica', 'normal');
          d.setFontSize(8.5);
          d.setTextColor(68);
          d.text(foot, PW - M, PH - M, { align: 'right' });
        }
      }
    }
    const name = opt.name || `PREOP_IMAGING_${latin(up(draft.unit || '')).replace(/\s+/g, '_')}_${stamp(draft.date)}`.replace(/_+/g, '_') + '.pdf';
    return new File([d.output('blob')], name, { type: 'application/pdf' });
  }

  // ---------------------------------------------------------------- Discharge summary
  // The same A4 pages the discharge PowerPoint uses (DcPages), one per PDF page.
  async function discharge(c, dd, meta) {
    const { jsPDF } = window.jspdf;
    const pages = await DcPages.render(c, dd, meta);
    const d = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    pages.forEach((png, i) => {
      if (i) d.addPage();
      d.addImage(png, 'PNG', 0, 0, 210, 297, undefined, 'FAST');
    });
    return new File([d.output('blob')], `${latin(up(c.name)).replace(/\s+/g, '_') || 'PATIENT'}_DISCHARGE.pdf`, { type: 'application/pdf' });
  }

  // ---------------------------------------------------------------- Radiographs (discharge page)
  function radiographs(c, dd, sections, meta) {
    const who = { ...c, diagnosis: dd.diagnosis || c.diagnosis };
    const foot = [up(dd.procedure || c.plan), dd.dos ? 'DOS ' + fmtDate(dd.dos) : '', unitName(meta.unitId)].filter(Boolean).join(' - ');
    return otXrays([{ c: who, n: '', sections: sections.map((x) => ({ ...x, per: 3 })) }], {}, {
      foot, name: `${latin(up(c.name)).replace(/\s+/g, '_') || 'PATIENT'}_RADIOGRAPHS.pdf`,
    });
  }

  // ---------------------------------------------------------------- Consent forms (Tamil)
  // Same content and layout as Print.consents, one A4 page per case, drawn at 200 dpi.
  const DPI = 200;
  const W = Math.round(210 / 25.4 * DPI);
  const H = Math.round(297 / 25.4 * DPI);
  const MM = DPI / 25.4;
  const PT = DPI / 72;
  const TAMIL = '"Noto Sans Tamil", "Tamil Sangam MN", "Latha", "Nirmala UI", sans-serif';

  async function fontsReady() {
    try {
      await Promise.race([
        Promise.all(['400', '600', '700'].map((w) => document.fonts.load(`${w} 20px "Noto Sans Tamil"`, 'அ'))),
        new Promise((r) => setTimeout(r, 3000)),
      ]);
    } catch { /* system Tamil font it is */ }
  }

  // Word wrap; the first line can be shorter (paragraph indent). Long words break by character.
  function wrap(g, text, width, firstIndent = 0) {
    const out = [];
    let line = '';
    const limit = () => width - (out.length ? 0 : firstIndent);
    for (const word of String(text ?? '').split(/\s+/).filter(Boolean)) {
      const tryLine = line ? line + ' ' + word : word;
      if (g.measureText(tryLine).width <= limit()) { line = tryLine; continue; }
      if (line) out.push(line);
      line = '';
      if (g.measureText(word).width <= limit()) { line = word; continue; }
      for (const ch of word) {
        if (g.measureText(line + ch).width > limit() && line) { out.push(line); line = ''; }
        line += ch;
      }
    }
    if (line || !out.length) out.push(line);
    return out;
  }

  function consentPage(c, draft) {
    const cv = document.createElement('canvas');
    cv.width = W;
    cv.height = H;
    const g = cv.getContext('2d');
    g.fillStyle = '#fff';
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#000';
    g.strokeStyle = '#000';
    g.textBaseline = 'alphabetic';
    const M = 12 * MM;
    const CW = W - 2 * M;
    const font = (pt, weight = 400) => { g.font = `${weight} ${pt * PT}px ${TAMIL}`; };
    let y = M;

    // title
    font(15, 700);
    const title = 'எடுத்துரைக்கப்பட்ட ஒப்புதல் படிவம்';
    const tw = g.measureText(title).width;
    let sw = 0;
    if (c.standby) { font(11, 700); sw = g.measureText('  (STANDBY)').width; font(15, 700); }
    const tx = (W - tw - sw) / 2;
    y += 15 * PT;
    g.fillText(title, tx, y);
    g.fillRect(tx, y + 2.5 * PT, tw, Math.max(2, PT * 0.8));
    if (c.standby) { font(11, 700); g.fillText('  (STANDBY)', tx + tw, y); }
    y += 6 * PT + 3 * MM;

    // details box: label | value | label | value, two rows
    const rows = [
      [['பெயர் ', '/ NAME'], c.name, ['வயது / பாலினம்', ''], ageSex(c)],
      [['உள்நோயாளி எண் ', '/ IP NO'], c.ipNo, ['வார்டு ', '/ WARD'], c.ward],
    ];
    const bpt = 9.5;
    const pad = 2 * MM;
    const vpad = 0.8 * MM;
    const blh = bpt * PT * 1.55;
    const labW = (l) => { font(bpt, 600); let w = g.measureText(l[0]).width; font(8, 400); w += g.measureText(l[1]).width; return w + 2 * pad; };
    const lw0 = Math.max(...rows.map((r) => labW(r[0])));
    const lw2 = Math.max(...rows.map((r) => labW(r[2])));
    const vw = (CW - lw0 - lw2) / 2;
    const colX = [M, M + lw0, M + lw0 + vw, M + lw0 + vw + lw2, M + CW];
    g.lineWidth = Math.max(2, PT * 0.75);
    for (const r of rows) {
      font(bpt, 400);
      const vals = [r[1], r[3]].map((v) => wrap(g, up(v), vw - 2 * pad));
      const rh = Math.max(...vals.map((v) => v.length)) * blh + 2 * vpad;
      const base = y + vpad + bpt * PT * 1.15;
      [r[0], r[2]].forEach((l, k) => {
        const x = colX[k * 2] + pad;
        font(bpt, 600);
        g.fillText(l[0], x, base);
        const w = g.measureText(l[0]).width;
        font(8, 400);
        g.fillText(l[1], x + w, base);
      });
      font(bpt, 400);
      vals.forEach((lines, k) => lines.forEach((t, i) => g.fillText(t, colX[k * 2 + 1] + pad, base + i * blh)));
      for (const x of colX) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + rh); g.stroke(); }
      g.beginPath(); g.moveTo(M, y); g.lineTo(M + CW, y); g.moveTo(M, y + rh); g.lineTo(M + CW, y + rh); g.stroke();
      y += rh;
    }
    y += 3 * MM;

    // body paragraphs: 10.5pt, line height 1.55, first-line indent 10mm, justified
    const pt = 10.5;
    const lh = pt * PT * 1.55;
    const indent = 10 * MM;
    const para = (text) => {
      font(pt, 400);
      const lines = wrap(g, text, CW, indent);
      lines.forEach((ln, i) => {
        const x = M + (i === 0 ? indent : 0);
        const width = CW - (i === 0 ? indent : 0);
        const words = ln.split(' ');
        if (i < lines.length - 1 && words.length > 1) {
          const space = (width - words.reduce((a, w) => a + g.measureText(w).width, 0)) / (words.length - 1);
          let cx = x;
          for (const w of words) { g.fillText(w, cx, y + pt * PT * 1.1); cx += g.measureText(w).width + space; }
        } else {
          g.fillText(ln, x, y + pt * PT * 1.1);
        }
        y += lh;
      });
      y += 2 * MM;
    };
    const field = (label, value) => {
      font(pt, 700);
      const x = M + indent;
      g.fillText(label, x, y + pt * PT * 1.1);
      const lw = g.measureText(label + ' ').width;
      font(pt, 400);
      const lines = String(value || '').trim() ? wrap(g, up(value), CW - indent - lw) : [''];
      lines.forEach((ln) => { g.fillText(ln, x + lw, y + pt * PT * 1.1); y += lh; });
      y += 2 * MM;
    };

    para(`நான் அரசு இராசாசி மருத்துவமனையில் ${c.doa ? `${fmtDate(c.doa)} அன்று ` : ''}அனுமதிக்கப்பட்டேன். ${Print.CONSENT_PARAS[0]}`);
    field('Δ :', c.diagnosis);
    field('PLAN :', c.plan);
    Print.CONSENT_RISK_PARAS.forEach(para);

    // date (left) and signature block (right)
    y += 6 * MM - 2 * MM;
    const spt = 9.5;
    const slh = spt * PT * 1.55;
    const sx = M + CW - 70 * MM;
    font(spt, 400);
    g.fillText('இப்படிக்கு,', sx, y + spt * PT * 1.1);
    y += slh;
    const sig = (label) => {
      y += 11 * MM;
      g.fillRect(sx, y, 70 * MM, Math.max(2, PT * 0.75));
      y += 1 * MM;
      g.fillText(label, sx, y + spt * PT * 1.1);
      y += slh;
    };
    sig('கையொப்பம் / பெருவிரல் ரேகை');
    sig('பெயர் & உறவுமுறை');
    font(pt, 400);
    g.fillText(`நாள் : ${fmtDate(draft.date)}`, M, y - 2);
    return cv;
  }

  async function consents(cases, draft) {
    await fontsReady();
    const { jsPDF } = window.jspdf;
    const d = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    cases.forEach((c, i) => {
      if (i) d.addPage();
      const cv = consentPage(c, draft);
      d.addImage(cv.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
      cv.width = cv.height = 0; // free the canvas memory right away (iPhone Safari is stingy)
    });
    const name = `CONSENT_${latin(up(draft.unit || '')).replace(/\s+/g, '_')}_${stamp(draft.date)}`.replace(/_+/g, '_') + '.pdf';
    return new File([d.output('blob')], name, { type: 'application/pdf' });
  }

  async function run(build, label) {
    try {
      toast(`Making the ${label} PDF…`, 15000);
      const file = await build();
      toast('PDF ready — tap Share / Save', 3000);
      offer(file);
    } catch (e) {
      console.error(e);
      toast(`Couldn't make the ${label} PDF: ${e.message || e}`, 6000);
    }
  }

  return {
    isPhone,
    otXrays: (items, draft) => run(() => otXrays(items, draft), 'pre-op imaging'),
    consents: (cases, draft) => run(() => consents(cases, draft), 'consent forms'),
    discharge: (c, dd, meta) => run(() => discharge(c, dd, meta), 'discharge summary'),
    radiographs: (c, dd, sections, meta) => run(() => radiographs(c, dd, sections, meta), 'radiographs'),
  };
})();
