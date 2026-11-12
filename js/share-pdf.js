// Ward status and pending works as real PDF files for WhatsApp (share sheet → WhatsApp → group).
// Built on the phone with jsPDF + AutoTable (js/vendor), so it works offline too.
const SharePdf = (() => {
  // The built-in PDF font covers plain Latin only: swap the few symbols the app uses.
  const clean = (s) => String(s ?? '')
    .replace(/→/g, '->').replace(/[✓✔]/g, '').replace(/[↑]/g, '(H)').replace(/[↓]/g, '(L)').replace(/[·•]/g, '-')
    .replace(/[^\x09\x0A\x0D\x20-\x7E -ÿ]/g, '').replace(/[ \t]+/g, ' ').trim();
  const U = (s) => clean(String(s ?? '').toUpperCase());
  const lines = (s) => String(s ?? '').split('\n').map((x) => U(x)).filter(Boolean);
  const stamp = () => fmtDate(todayISO()).replace(/\//g, '-');
  const podOf = (c) => { const d = c.surgeryDate || c.otDate; return d ? daysSince(d) : null; };

  function newDoc(orientation, title, sub) {
    const { jsPDF } = window.jspdf;
    const d = new jsPDF({ orientation, unit: 'mm', format: 'a4' });
    const W = d.internal.pageSize.getWidth();
    const head = () => {
      d.setFont('helvetica', 'bold'); d.setFontSize(12); d.setTextColor(0);
      d.text(clean(title), 10, 12);
      d.setFont('helvetica', 'normal'); d.setFontSize(9);
      d.text(clean(sub), W - 10, 12, { align: 'right' });
    };
    const foot = () => {
      d.setFontSize(7.5); d.setTextColor(110);
      d.text(`Page ${d.internal.getCurrentPageInfo().pageNumber}`, W - 10, d.internal.pageSize.getHeight() - 6, { align: 'right' });
      d.setTextColor(0);
    };
    return { d, hooks: { didDrawPage: () => { head(); foot(); } } };
  }

  const table = (d, hooks, head, body, columnStyles) => d.autoTable({
    head: [head], body, theme: 'grid', margin: { top: 17, left: 10, right: 10, bottom: 12 },
    styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 1.6, valign: 'top', textColor: 0, lineColor: 0, lineWidth: 0.15, overflow: 'linebreak' },
    headStyles: { fillColor: [228, 228, 228], textColor: 0, fontStyle: 'bold' },
    columnStyles, ...hooks,
  });

  // Ward status: the notebook as a PDF.
  function wardPdf(cases, meta, post) {
    const ward = post ? 'POST-OP WARD' : 'PRE-OP WARD';
    const { d, hooks } = newDoc('landscape', `${unitName(meta.unitId)} - ${ward} STATUS`, `${fmtDate(todayISO())} - ${cases.length} cases`);
    const body = cases.map((c, i) => {
      const dx = [U(c.diagnosis)];
      if (post) {
        if (c.procedureDone || c.plan) dx.push('DONE: ' + U(c.procedureDone || c.plan));
        if (podOf(c) != null) dx.push('POD ' + podOf(c));
      } else if (c.plan) dx.push('PLAN: ' + U(c.plan));
      const todo = [...lines(invTodoText(c)).map((x) => 'INV: ' + x), ...lines(opTodoText(c))];
      return [
        String(i + 1) + (c.status === 'posted' ? '\nBOT' : ''),
        U(c.bed),
        [U(c.name), clean([ageSex(c), c.ipNo && 'IP ' + c.ipNo].filter(Boolean).join(' - '))].join('\n'),
        dx.join('\n'),
        todo.join('\n'),
        post ? U(c.scheme) : clean(assessmentScheme(c)),
      ];
    });
    table(d, hooks, ['S.NO', 'BED', 'NAME', post ? 'DIAGNOSIS / PROCEDURE' : 'DIAGNOSIS', "TO DO'S", post ? 'SCHEME' : 'ASSESSMENT / SCHEME'], body,
      { 0: { cellWidth: 11 }, 1: { cellWidth: 13 }, 2: { cellWidth: 42 }, 3: { cellWidth: 78 }, 5: { cellWidth: 38 } });
    return new File([d.output('blob')], `${post ? 'POSTOP' : 'PREOP'}_WARD_STATUS_${stamp()}.pdf`, { type: 'application/pdf' });
  }

  // Pending works: what is still to be done, case by case.
  function pendingPdf(cases, meta, post) {
    const ward = post ? 'POST-OP WARD' : 'PRE-OP WARD';
    const rows = cases.map((c) => {
      const items = [...lines(invTodoText(c)), ...pendingList(c).map((p) => U(p.text))];
      return [c, [...new Set(items)]];
    }).filter(([, items]) => items.length);
    const { d, hooks } = newDoc('portrait', `${unitName(meta.unitId)} - ${ward} PENDING WORKS`, `${fmtDate(todayISO())} - ${rows.length} cases`);
    const body = rows.map(([c, items], i) => [String(i + 1), U(c.bed), [U(c.name), clean([ageSex(c), c.ipNo && 'IP ' + c.ipNo].filter(Boolean).join(' - '))].join('\n'), items.map((x) => '- ' + x).join('\n')]);
    if (!body.length) body.push(['', '', 'Nothing pending', '']);
    table(d, hooks, ['S.NO', 'BED', 'NAME', 'PENDING'], body, { 0: { cellWidth: 11 }, 1: { cellWidth: 13 }, 2: { cellWidth: 48 } });
    return new File([d.output('blob')], `${post ? 'POSTOP' : 'PREOP'}_PENDING_WORKS_${stamp()}.pdf`, { type: 'application/pdf' });
  }

  // OT list as a PDF file: same page as the printed one (US Letter landscape, the unit's 11 columns,
  // title on top, Assistant Professor bottom-right). Named "OT LIST UNIT I 11-11-2026.pdf".
  // twice: the "print" version — the same list twice on one sheet, top and bottom, each shrunk
  // until it fits its half, with a dashed cut line between (like Print.otList(…, true)).
  function otPdf(cases, draft, twice = false) {
    const { jsPDF } = window.jspdf;
    const newDoc = () => new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'letter' });
    const probe = newDoc();
    const W = probe.internal.pageSize.getWidth();
    const H = probe.internal.pageSize.getHeight();
    const M = twice ? 8 : 12;
    const cols = Object.keys(Print.OT_COLUMNS);
    const total = cols.reduce((a, k) => a + Print.OT_COLUMNS[k][1], 0);
    const cell = (k, c, i) => {
      switch (k) {
        case 'sno': return String(i + 1);
        case 'name': return U(c.name) + (c.standby ? '\n(STANDBY)' : '');
        case 'agesex': return U(ageSex(c));
        case 'ip': return clean(c.ipNo);
        case 'ward': return U(c.ward);
        case 'diagnosis': return U(c.diagnosis);
        case 'procedure': return U(c.plan);
        case 'level': return clean(c.level);
        case 'anaes': return ANAES;
        case 'implants': return U(c.implants);
        case 'scheme': return U(c.scheme);
        default: return '';
      }
    };
    const title = Print.otTitle(draft).filter(Boolean).map(clean);
    const body = cases.map((c, i) => cols.map((k) => cell(k, c, i)));
    // One copy of the list from y0 at scale s; returns where it ends (below the signature).
    const draw = (d, y0, s) => {
      d.setFont('helvetica', 'bold');
      d.setFontSize(14 * s);
      title.forEach((t, i) => d.text(t, W / 2, y0 + 5 * s + i * 6.5 * s, { align: 'center' }));
      d.autoTable({
        startY: y0 + 5 * s + title.length * 6.5 * s + 2 * s,
        head: [cols.map((k) => Print.OT_COLUMNS[k][0])],
        body,
        theme: 'grid',
        margin: { top: M, left: M, right: M, bottom: twice ? 2 : M },
        styles: { font: 'times', fontStyle: 'bold', fontSize: 8 * s, cellPadding: 1 * s, valign: 'top', textColor: 0, lineColor: 0, lineWidth: 0.25, overflow: 'linebreak', minCellHeight: (twice ? 9 : 13.4) * s },
        headStyles: { fillColor: false, minCellHeight: 0 },
        columnStyles: Object.fromEntries(cols.map((k, i) => [i, { cellWidth: ((W - 2 * M) * Print.OT_COLUMNS[k][1]) / total }])),
        rowPageBreak: 'avoid',
      });
      let y = d.lastAutoTable.finalY + 12 * s;
      if (!twice && y > H - M) { d.addPage(); y = M + 5; }
      d.setFont('times', 'bold');
      d.setFontSize(8 * s);
      d.text(U(draft.prof), W - M - 14 * s, y, { align: 'right' });
      return y + 2 * s;
    };
    let d;
    if (!twice) {
      d = newDoc();
      draw(d, M, 1);
    } else {
      const gap = 8;
      const half = (H - 2 * M - gap) / 2;
      // Largest scale at which one copy stays on the page and inside its half.
      let s = 1;
      for (; s > 0.35; s -= 0.05) {
        const t = newDoc();
        const end = draw(t, M, s);
        if (t.internal.getNumberOfPages() === 1 && end <= M + half) break;
      }
      d = newDoc();
      draw(d, M, s);
      draw(d, M + half + gap, s);
      d.setLineDashPattern([2, 2], 0);
      d.setLineWidth(0.2);
      d.setDrawColor(120);
      d.line(4, M + half + gap / 2, W - 4, M + half + gap / 2);
    }
    const name = otFileName(draft) + (twice ? ' PRINT' : '');
    d.setProperties({ title: name }); // the tab / PDF viewer shows this instead of a random id
    d.setDisplayMode(undefined, undefined, 'UseNone');
    return new File([d.output('blob')], name + '.pdf', { type: 'application/pdf' });
  }

  // Email the OT list to the unit's address (Settings). A web page can't send mail by itself,
  // so: phone - share sheet with the PDF (pick Gmail / Mail), address copied to paste into "To";
  // computer - the PDF is downloaded and the mail app opens addressed, to attach it.
  function email(file, to, draft) {
    const subject = file.name.replace(/\.pdf$/, '');
    const body = `${Print.otTitle(draft).filter(Boolean).join('\n')}\n\nOT list attached.`;
    let ok = false;
    try { ok = !!(navigator.share && navigator.canShare && navigator.canShare({ files: [file] })); } catch { ok = false; }
    if (ok && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
      navigator.clipboard?.writeText(to).catch(() => {});
      toast(`Pick Gmail / Mail — ${to} is copied, paste it into "To"`, 7000);
      navigator.share({ files: [file], title: subject, text: body }).catch((e) => { if (e.name !== 'AbortError') mailto(); });
      return;
    }
    mailto();
    function mailto() {
      download(file, `Saved ${file.name} — attach it to the email`);
      const a = document.createElement('a');
      a.href = `mailto:${encodeURIComponent(to).replace(/%40/g, '@')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      a.click();
    }
  }

  // Phone: share sheet (pick WhatsApp). Computer / browsers without file sharing: download it.
  function send(file) {
    let ok = false;
    try { ok = !!(navigator.share && navigator.canShare && navigator.canShare({ files: [file] })); } catch { ok = false; }
    if (ok) {
      navigator.share({ files: [file], title: file.name }).catch((e) => { if (e.name !== 'AbortError') download(file); });
      return;
    }
    download(file);
  }
  function download(file, msg) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file);
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 60000);
    toast(msg || `Saved ${file.name} — attach it in WhatsApp`, 4000);
  }

  // Computer: open the PDF in a new tab (the browser's PDF viewer prints it as it is — no web-address
  // strip, which the print dialog adds, above all in Safari). Phone: the share sheet.
  function open(file) {
    if (PhonePdf.isPhone()) return send(file);
    const url = URL.createObjectURL(file);
    const w = window.open(url, '_blank');
    if (!w) { URL.revokeObjectURL(url); download(file, `Saved ${file.name}`); return; }
    setTimeout(() => URL.revokeObjectURL(url), 10 * 60e3);
  }

  return {
    ward: (cases, meta, post) => send(wardPdf(cases, meta, post)),
    otOpen: (cases, draft, twice = false) => open(otPdf(cases, draft, twice)),
    pending: (cases, meta, post) => send(pendingPdf(cases, meta, post)),
    ot: (cases, draft, twice = false) => send(otPdf(cases, draft, twice)),
    otEmail: (cases, draft, to) => email(otPdf(cases, draft), to, draft),
    wardPdf, pendingPdf, otPdf,
  };
})();
