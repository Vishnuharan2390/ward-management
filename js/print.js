// Builds printable pages in the unit's own formats and opens the browser's
// print dialog (choose "Save as PDF" as the printer to get a PDF).
const Print = (() => {
  const nl = (s) => esc(s).replace(/\n/g, '<br>');
  const up = (s) => String(s ?? '').toUpperCase();

  function go(html, { title, page }) {
    $('#print').innerHTML = html;
    $('#page-style').textContent = `@page { size: ${page}; margin: 12mm; }`;
    const old = document.title;
    document.title = title;
    // Let images (letterhead) load before the print snapshot.
    const imgs = $$('#print img');
    Promise.all(imgs.map((i) => (i.complete ? null : new Promise((r) => { i.onload = i.onerror = r; })))).then(() => {
      setTimeout(() => {
        window.print();
        document.title = old;
      }, 50);
    });
  }

  // ---------------------------------------------------------------- OT list
  // Mirrors OT_LIST_UNIT_1_*.docx: landscape, title line, 11 columns, the
  // Assistant Professor's name bottom-right.
  const OT_COLUMNS = {
    sno: ['S.NO', 704],
    name: ['NAME', 1701],
    agesex: ['AGE/SEX', 992],
    ip: ['IPNO:', 709],
    ward: ['WARD', 851],
    diagnosis: ['DIAGNOSIS', 2002],
    procedure: ['PLAN', 2108],
    level: ['LEVEL', 851],
    anaes: ['ANAES', 609],
    implants: ['IMPLANTS', 2300],
    scheme: ['SCHEME STATUS', 1554],
    remarks: ['REMARKS', 1300],
  };

  function otCell(col, c, i, draft) {
    switch (col) {
      case 'sno': return i + 1;
      case 'name': return esc(up(c.name));
      case 'agesex': return esc(up(ageSex(c)));
      case 'ip': return esc(c.ipNo);
      case 'ward': return esc(up(c.ward));
      case 'diagnosis': return nl(up(c.diagnosis));
      case 'procedure': return nl(up(c.plan));
      case 'level': return esc(c.level);
      case 'anaes': return esc(up(c.anaesthesia));
      case 'implants': return nl(up(c.implants));
      case 'scheme': return esc(up(c.scheme));
      case 'remarks': return nl(up(draft.remarks?.[c.id]));
      default: return '';
    }
  }

  function otTitle(draft) {
    return `OT LIST FOR ORTHO ${up(draft.unit)} ON ${fmtDate(draft.date)} ${up(draft.day)} ${up(draft.chief)}`.replace(/\s+/g, ' ').trim();
  }

  function otHTML(cases, draft) {
    const cols = Object.keys(OT_COLUMNS).filter((k) => draft.cols[k] !== false);
    const total = cols.reduce((a, k) => a + OT_COLUMNS[k][1], 0);
    return `
      <div class="pr ot">
        <div class="ot-title">${esc(otTitle(draft))}</div>
        <table class="ot-table">
          <colgroup>${cols.map((k) => `<col style="width:${((OT_COLUMNS[k][1] / total) * 100).toFixed(2)}%">`).join('')}</colgroup>
          <thead><tr>${cols.map((k) => `<th>${OT_COLUMNS[k][0]}</th>`).join('')}</tr></thead>
          <tbody>${cases.map((c, i) => `<tr>${cols.map((k) => `<td>${otCell(k, c, i, draft)}</td>`).join('')}</tr>`).join('')}</tbody>
        </table>
        <div class="ot-sign">${esc(up(draft.prof))}</div>
      </div>`;
  }

  function otList(cases, draft) {
    go(otHTML(cases, draft), { title: `OT LIST ${draft.unit || ''} ${fmtDate(draft.date).replace(/\//g, '')}`, page: 'letter landscape' });
  }

  // Same list as an editable Word file, for last-minute changes in MS Word.
  function otWord(cases, draft) {
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8">
      <style>
        @page WordSection1 { size: 11in 8.5in; mso-page-orientation: landscape; margin: 1in; }
        div.WordSection1 { page: WordSection1; }
        .ot-title { font: bold 14pt Arial; text-align: center; margin-bottom: 12pt; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #000; font: bold 8pt "Times New Roman"; padding: 2pt 4pt; vertical-align: top; text-align: left; }
        th { font-size: 8pt; }
        .ot-sign { font: bold 8pt "Times New Roman"; text-align: right; margin-top: 30pt; }
      </style></head><body><div class="WordSection1">${otHTML(cases, draft)}</div></body></html>`;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿', html], { type: 'application/msword' }));
    a.download = `OT_LIST_${(draft.unit || 'UNIT').replace(/\s+/g, '_')}_${fmtDate(draft.date).replace(/\//g, '')}.doc`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  // ---------------------------------------------------------------- Ward board
  // The ward notebook: S.NO | NAME | DIAGNOSIS | TO DO'S | ASSESSMENT/SCHEME.
  function wardBoard(cases, meta) {
    const rows = cases.map((c, i) => `
      <tr>
        <td class="nb-sno">${c.status === 'posted' ? '<span class="nb-bot">BOT</span>' : ''}${i + 1}</td>
        <td><b>${esc(c.name)}</b><div class="pr-sub">${esc(ageSex(c))} · ${esc(c.ipNo)}${c.ward ? ' · ' + esc(c.ward) : ''}</div></td>
        <td>${nl(c.diagnosis)}${c.plan ? `<div class="pr-sub">▸ ${esc(c.plan)}</div>` : ''}</td>
        <td class="nb-todo">${todoList(c).map((t) => `<span>${esc(t)}</span>`).join('')}</td>
        <td>${esc(assessmentScheme(c))}</td>
      </tr>`).join('');
    const html = `
      <div class="pr nb">
        <div class="nb-head"><b>${esc(up(meta.unit))} — PRE-OP WARD</b><span>${fmtDate(todayISO())} · ${cases.length} cases</span></div>
        <table class="nb-table">
          <colgroup><col style="width:6%"><col style="width:17%"><col style="width:30%"><col style="width:32%"><col style="width:15%"></colgroup>
          <thead><tr><th>S.NO</th><th>NAME</th><th>DIAGNOSIS</th><th>TO DO'S</th><th>ASSESSMENT / SCHEME</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
    go(html, { title: `Ward status ${fmtDate(todayISO()).replace(/\//g, '-')}`, page: 'A4 landscape' });
  }

  // ---------------------------------------------------------------- Discharge
  // Mirrors the unit's discharge summary: letterhead + grey patient box on
  // every page (repeating table header), CAPS underlined section headings.
  function discharge(c, d, meta) {
    const disp = DISPOSITIONS[d.disposition] || DISPOSITIONS.discharge;
    // One table row per section so the header block repeats on every printed page.
    const row = (inner) => `<tr><td class="dc-body">${inner}</td></tr>`;
    const sec = (label, val, cls = '') => (val && String(val).trim() ? row(`<div class="dc-sec ${cls}"><h4>${label}</h4><div>${nl(val)}</div></div>`) : '');
    const box = [
      ['PATIENT NAME', c.name, 'I.P NO', c.ipNo],
      ['AGE / GENDER', ageSex(c), 'AR NO', d.arNo],
      ['DOA', fmtDate(c.doa), d.disposition === 'postop' ? 'DOT' : 'DOD', [fmtDate(d.dod), d.dodTime ? '@ ' + d.dodTime : ''].filter(Boolean).join(' ')],
      ['CONSULTANT', d.consultant, 'PH.NO', d.phone],
      ['ATTENDER', d.attender, 'ADDRESS', d.address],
      ...(d.contact ? [['CONTACT NO', d.contact, '', '']] : []),
    ];
    const letterhead = meta.letterhead || 'assets/letterhead.jpg';
    const html = `
      <table class="pr dc">
        <thead><tr><td>
          <div class="dc-lh"><img src="${esc(letterhead)}" alt=""></div>
          <table class="dc-box">
            ${box.map(([a, av, b, bv]) => `<tr><th>${a}</th><td>:</td><td>${esc(up(av))}</td><th>${b}${b ? ':' : ''}</th><td>${esc(up(bv))}</td></tr>`).join('')}
          </table>
        </td></tr></thead>
        <tbody>
          ${disp.title ? row(`<div class="dc-title">${disp.title}</div>`) : ''}
          ${sec('DIAGNOSIS IN DETAIL', up(d.diagnosis))}
          ${sec('PROCEDURE IN DETAIL', up(d.procedure))}
          ${sec('UNIT/CONSULTANTS', up(d.unitLine))}
          ${sec('H/O INJURY / ILLNESS', up(d.history))}
          ${sec('PAST HISTORY / TREATMENT HISTORY', up(d.past))}
          ${sec('EXAMINATION FINDINGS:', d.exam)}
          ${sec('INVESTIGATIONS', up(d.investigations))}
          ${sec('OPERATIVE NOTES', up(d.opNotes))}
          ${sec('TREATMENT GIVEN', up(d.treatment))}
          ${sec('COURSE IN HOSPITAL:', up(d.course))}
          ${sec('CONDITION ON ' + (d.disposition === 'postop' ? 'TRANSFER' : 'DISCHARGE'), up(d.condition))}
          ${sec('DISCHARGE MEDICATIONS', up(d.meds))}
          ${sec('DISCHARGE ADVICE', up(d.advice), 'dc-advice')}
          ${d.adviceTa && d.adviceTa.trim() ? row(`<div class="dc-ta">${d.adviceTa.split('\n').filter((l) => l.trim()).map((l) => `<div>* ${esc(l.trim())}</div>`).join('')}</div>`) : ''}
          ${row(`<div class="dc-end"><div class="dc-doc"><b>DISCHARGING DOCTOR:</b> ${esc(up(d.doctor))}</div><div class="dc-sig">DOCTOR SIGNATURE</div></div>`)}
        </tbody>
      </table>`;
    go(html, { title: `${up(c.name)}_DISCHARGE`, page: 'A4 portrait' });
  }

  return { otList, otWord, wardBoard, discharge, OT_COLUMNS, otTitle };
})();

// Shared with the on-screen ward view.
function todoList(c) {
  return pendingList(c).map((p) => p.text.replace(' opinion', ' op.'));
}
function assessmentScheme(c) {
  const pac = effStatus(c, CHECKS.find((x) => x.k === 'anaes'));
  const a = pac === 'done' ? 'Assessed' : pac === 'sent' ? 'Sent for PAC' : pac === 'na' ? '' : 'TBA';
  return [a, c.scheme].filter(Boolean).join(' / ') || '—';
}
