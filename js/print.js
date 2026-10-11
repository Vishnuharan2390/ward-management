// Builds printable pages and opens the browser's print dialog
// (choose "Save as PDF" as the printer to get a PDF).
const Print = (() => {
  const nl = (s) => esc(s).replace(/\n/g, '<br>');

  function header(meta, title) {
    return `
      <div class="pr-head">
        ${meta.institution ? `<div class="pr-inst">${esc(meta.institution)}</div>` : ''}
        <div class="pr-dept">${esc(meta.department || 'Department of Orthopaedics')}${meta.unit ? ' — ' + esc(meta.unit) : ''}</div>
        ${meta.chief ? `<div class="pr-chief">Unit chief: ${esc(meta.chief)}</div>` : ''}
        <div class="pr-title">${esc(title)}</div>
      </div>`;
  }

  function go(html, { title, landscape }) {
    $('#print').innerHTML = html;
    $('#page-style').textContent = `@page { size: A4 ${landscape ? 'landscape' : 'portrait'}; margin: 10mm; }`;
    const old = document.title;
    document.title = title;
    // Give the browser a frame to lay out the print DOM first.
    setTimeout(() => {
      window.print();
      document.title = old;
    }, 50);
  }

  const OT_COLUMNS = {
    sno: 'S.No',
    name: 'Name',
    agesex: 'Age/Sex',
    ip: 'IP No',
    diagnosis: 'Diagnosis',
    procedure: 'Proposed procedure',
    anaes: 'Anaesthesia',
    implants: 'Implants',
    scheme: 'Scheme',
    remarks: 'Remarks',
  };

  function otCell(col, c, i, draft) {
    switch (col) {
      case 'sno': return i + 1;
      case 'name': return `<b>${esc(c.name)}</b>${c.bed ? `<div class="pr-sub">Bed ${esc(c.bed)}</div>` : ''}`;
      case 'agesex': return esc(ageSex(c));
      case 'ip': return esc(c.ipNo);
      case 'diagnosis': return nl([c.side && c.side !== 'N/A' ? c.side : '', c.diagnosis].filter(Boolean).join(' — '));
      case 'procedure': return nl(c.plan);
      case 'anaes': return esc(c.anaesthesia);
      case 'implants': return nl(c.implants);
      case 'scheme': return esc(c.scheme);
      case 'remarks': return nl(draft.remarks?.[c.id]);
      default: return '';
    }
  }

  function otList(cases, draft, meta) {
    const cols = Object.keys(OT_COLUMNS).filter((k) => draft.cols[k] !== false);
    const rows = cases.map((c, i) => `<tr>${cols.map((k) => `<td class="c-${k}">${otCell(k, c, i, draft)}</td>`).join('')}</tr>`).join('');
    const html = `
      <div class="pr">
        ${header(meta, 'OPERATION THEATRE LIST')}
        <div class="pr-meta">
          <span><b>Date:</b> ${esc(fmtDate(draft.date))}</span>
          <span><b>Day:</b> ${esc(draft.day)}</span>
          ${draft.theatre ? `<span><b>Theatre:</b> ${esc(draft.theatre)}</span>` : ''}
        </div>
        <table class="pr-table">
          <thead><tr>${cols.map((k) => `<th class="c-${k}">${OT_COLUMNS[k]}</th>`).join('')}</tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="pr-sign">
          <div>
            <div class="pr-sign-line"></div>
            <b>${esc(draft.prof || '')}</b><br>Assistant Professor<br>${esc(meta.department || 'Department of Orthopaedics')}${meta.unit ? ', ' + esc(meta.unit) : ''}
          </div>
        </div>
      </div>`;
    go(html, { title: `OT List ${fmtDate(draft.date).replace(/\//g, '-')}`, landscape: true });
  }

  function wardBoard(cases, meta) {
    const cell = (c, k) => esc(checkSummary(c, CHECKS.find((x) => x.k === k)));
    const rows = cases.map((c, i) => {
      const ops = listOf(c.opinions).map((o) => `${o.dept}: ${STATUS[o.s || 'pending']}`).join('; ');
      const img = ['xray', 'ct', 'mri'].map((k) => {
        const s = cell(c, k);
        return s ? `${CHECKS.find((x) => x.k === k).label}: ${s}` : '';
      }).filter(Boolean).join('<br>');
      const tasks = listOf(c.tasks).filter((t) => !t.done).map((t) => '• ' + esc(t.text)).join('<br>');
      return `<tr>
        <td>${i + 1}</td>
        <td><b>${esc(c.name)}</b><br>${esc(ageSex(c))} · ${esc(c.ipNo)}${c.bed ? '<br>Bed ' + esc(c.bed) : ''}</td>
        <td>${esc(fmtDate(c.doa))}</td>
        <td>${nl(c.diagnosis)}</td>
        <td>${nl(c.plan)}</td>
        <td>${cell(c, 'cbc')}</td><td>${cell(c, 'rft')}</td><td>${cell(c, 'lft')}</td>
        <td>${cell(c, 'vm')}</td><td>${cell(c, 'vctc')}</td><td>${cell(c, 'ecg')}</td><td>${cell(c, 'echo')}</td>
        <td>${esc(ops)}</td><td>${img}</td><td>${cell(c, 'anaes')}</td>
        <td>${tasks}</td>
      </tr>`;
    }).join('');
    const html = `
      <div class="pr pr-small">
        ${header(meta, 'PRE-OPERATIVE WARD STATUS')}
        <div class="pr-meta"><span><b>Date:</b> ${fmtDate(todayISO())}</span><span><b>Cases:</b> ${cases.length}</span></div>
        <table class="pr-table">
          <thead><tr><th>#</th><th>Patient</th><th>DOA</th><th>Diagnosis</th><th>Plan</th>
            <th>CBC<br>Hb/WBC/Plt</th><th>RFT<br>U/C/Na/K</th><th>LFT<br>TB/OT/PT</th>
            <th>VM</th><th>VCTC</th><th>ECG</th><th>ECHO</th><th>Opinions</th><th>Imaging</th><th>PAC</th><th>Pending works</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
    go(html, { title: `Ward status ${fmtDate(todayISO()).replace(/\//g, '-')}`, landscape: true });
  }

  function discharge(c, d, meta) {
    const disp = DISPOSITIONS[d.disposition] || DISPOSITIONS.discharge;
    const sec = (label, val) => (val && String(val).trim() ? `<div class="pr-sec"><h4>${label}</h4><div>${nl(val)}</div></div>` : '');
    const html = `
      <div class="pr">
        ${header(meta, disp.title)}
        <table class="pr-grid">
          <tr><th>Name</th><td>${esc(c.name)}</td><th>Age / Sex</th><td>${esc(ageSex(c))}</td></tr>
          <tr><th>IP No</th><td>${esc(c.ipNo)}</td><th>AR No</th><td>${esc(d.arNo)}</td></tr>
          <tr><th>Date of admission</th><td>${esc(fmtDate(c.doa))}</td><th>Date of surgery</th><td>${esc(fmtDate(d.dos))}</td></tr>
          <tr><th>${d.disposition === 'postop' ? 'Date of transfer' : 'Date of discharge'}</th><td>${esc(fmtDate(d.dod))}</td><th>Disposition</th><td>${esc(disp.label)}</td></tr>
        </table>
        ${sec('Diagnosis', d.diagnosis)}
        ${sec('Procedure done', d.procedure)}
        ${sec('History of injury / illness', d.history)}
        ${sec('Past history / treatment history', d.past)}
        ${sec('Examination findings', d.exam)}
        ${sec('Investigations', d.investigations)}
        ${sec('Treatment / drugs given', d.treatment)}
        ${sec('Operative notes', d.opNotes)}
        ${sec('Course in hospital', d.course)}
        ${sec('Condition on ' + (d.disposition === 'postop' ? 'transfer' : 'discharge'), d.condition)}
        ${sec('Discharge medications', d.meds)}
        ${sec('Advice', d.advice)}
        ${sec('Review', d.review)}
        <div class="pr-sign pr-sign-2">
          <div><div class="pr-sign-line"></div>${esc(d.preparedBy || '')}<br>Postgraduate</div>
          <div><div class="pr-sign-line"></div>${esc(d.signedBy || '')}<br>Assistant Professor</div>
        </div>
      </div>`;
    go(html, { title: `${disp.title.split(' (')[0]} ${c.name} ${c.ipNo || ''}`.trim(), landscape: false });
  }

  return { otList, wardBoard, discharge, OT_COLUMNS };
})();
