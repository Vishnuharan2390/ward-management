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

  // ---- Ward status / pending works: a table on a phone-shaped page ----
  // Portrait and narrow (about a phone screen's shape) so the table fills the phone's width and the
  // text is big enough to read without zooming. Never more than ROWS_PER_PAGE patients on a page;
  // the column headings repeat on every page.
  const PW = 150;
  const PH = 290;
  const PM = 6;
  const ROWS_PER_PAGE = 10;
  function tablePdf(title, sub, head, body, columnStyles, postedRows = new Set()) {
    const { jsPDF } = window.jspdf;
    const mk = () => new jsPDF({ orientation: 'portrait', unit: 'mm', format: [PW, PH] });
    const top = PM + 15;
    const drawHead = (d) => {
      d.setTextColor(0); d.setFont('helvetica', 'bold'); d.setFontSize(12);
      d.text(d.splitTextToSize(clean(title), PW - 2 * PM)[0], PM, PM + 5);
      d.setFont('helvetica', 'normal'); d.setFontSize(9); d.setTextColor(90);
      d.text(clean(sub), PM, PM + 10.5);
      d.setTextColor(0);
    };
    const draw = (d, start, rows) => d.autoTable({
      head: [head], body: rows, startY: top, theme: 'grid',
      margin: { top, left: PM, right: PM, bottom: PM + 6 },
      styles: { font: 'helvetica', fontSize: 9, cellPadding: 1.5, valign: 'top', textColor: 0, lineColor: 0, lineWidth: 0.2, overflow: 'linebreak' },
      headStyles: { fillColor: [228, 228, 228], textColor: 0, fontStyle: 'bold', fontSize: 8.5 },
      columnStyles,
      rowPageBreak: 'avoid',
      didParseCell: (h) => { if (h.section === 'body' && postedRows.has(start + h.row.index)) h.cell.styles.fillColor = [255, 243, 214]; },
      didDrawPage: () => drawHead(d),
    });
    // How many of the next rows (at most ROWS_PER_PAGE) fit on one page — measured on a scratch copy.
    const fitting = (start) => {
      for (let n = Math.min(ROWS_PER_PAGE, body.length - start); n > 1; n--) {
        const t = mk();
        draw(t, start, body.slice(start, start + n));
        if (t.internal.getNumberOfPages() === 1) return n;
      }
      return 1;
    };
    const d = mk();
    if (!body.length) draw(d, 0, []);
    for (let start = 0; start < body.length;) {
      const n = fitting(start);
      if (start) d.addPage([PW, PH], 'portrait');
      draw(d, start, body.slice(start, start + n));
      start += n;
    }
    const pages = d.internal.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      d.setPage(i); d.setFont('helvetica', 'normal'); d.setFontSize(8); d.setTextColor(110);
      d.text(`Page ${i} of ${pages}`, PW - PM, PH - PM + 1, { align: 'right' });
    }
    return d;
  }

  // Ward status: the notebook as a table.
  function wardPdf(cases, meta, post) {
    const ward = post ? 'POST-OP WARD' : 'PRE-OP WARD';
    const posted = cases.filter((c) => c.status === 'posted').length;
    const body = cases.map((c, i) => {
      const dx = [U(c.diagnosis)];
      if (post) {
        if (c.procedureDone || c.plan) dx.push('DONE: ' + U(c.procedureDone || c.plan));
        if (podOf(c) != null) dx.push('POD ' + podOf(c));
      } else {
        if (c.plan) dx.push('PLAN: ' + U(c.plan));
        if (c.procedureDone) dx.push('DONE: ' + U(c.procedureDone)); // pre-op ward: only when entered
      }
      const todo = [...lines(invTodoText(c)).map((x) => 'INV: ' + x), ...lines(opTodoText(c))];
      return [
        String(i + 1),
        [U(c.name) + (c.status === 'posted' ? ' (POSTED)' : ''), clean([ageSex(c), c.ipNo && 'IP ' + c.ipNo].filter(Boolean).join(' - '))].join('\n'),
        dx.join('\n'),
        todo.join('\n'),
        post ? U(c.scheme) : clean(assessmentScheme(c)),
      ];
    });
    const postedRows = new Set(cases.map((c, i) => (c.status === 'posted' ? i : -1)).filter((i) => i >= 0));
    const d = tablePdf(`${unitName(meta.unitId)} - ${ward} STATUS`, `${fmtDate(todayISO())} - ${cases.length} cases${posted ? ` - ${posted} posted` : ''}`,
      ['NO', 'NAME', post ? 'DIAGNOSIS / PROCEDURE' : 'DIAGNOSIS', "TO DO'S", post ? 'SCHEME' : 'PAC / SCHEME'], body,
      { 0: { cellWidth: 8.5 }, 1: { cellWidth: 32 }, 2: { cellWidth: 41 }, 3: { cellWidth: todoColW(post) }, 4: { cellWidth: 25, fontSize: 8 } }, postedRows);
    return new File([d.output('blob')], `${post ? 'POSTOP' : 'PREOP'}_WARD_STATUS_${stamp()}.pdf`, { type: 'application/pdf' });
  }
  const todoColW = () => PW - 2 * PM - (8.5 + 32 + 41 + 25);

  // Pending works: what is still to be done, case by case.
  function pendingPdf(cases, meta, post) {
    const ward = post ? 'POST-OP WARD' : 'PRE-OP WARD';
    const rows = cases.map((c) => {
      const items = [...lines(invTodoText(c)), ...pendingList(c).map((p) => U(p.text))];
      return [c, [...new Set(items)]];
    }).filter(([, items]) => items.length);
    const body = rows.map(([c, items], i) => [String(i + 1), [U(c.name) + (c.status === 'posted' ? ' (POSTED)' : ''), clean([ageSex(c), c.ipNo && 'IP ' + c.ipNo].filter(Boolean).join(' - '))].join('\n'), items.join(', ')]);
    if (!body.length) body.push(['', 'Nothing pending', '']);
    const postedRows = new Set(rows.map(([c], i) => (c.status === 'posted' ? i : -1)).filter((i) => i >= 0));
    const d = tablePdf(`${unitName(meta.unitId)} - ${ward} PENDING WORKS`, `${fmtDate(todayISO())} - ${rows.length} cases`,
      ['NO', 'NAME', 'PENDING'], body, { 0: { cellWidth: 8.5 }, 1: { cellWidth: 40 } }, postedRows);
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
