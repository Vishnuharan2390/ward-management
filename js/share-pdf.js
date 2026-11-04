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
  function download(file) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file);
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 60000);
    toast(`Saved ${file.name} — attach it in WhatsApp`, 4000);
  }

  return {
    ward: (cases, meta, post) => send(wardPdf(cases, meta, post)),
    pending: (cases, meta, post) => send(pendingPdf(cases, meta, post)),
    wardPdf, pendingPdf,
  };
})();
