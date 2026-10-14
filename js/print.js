// Builds printable pages in the unit's own formats and opens the browser's
// print dialog (choose "Save as PDF" as the printer to get a PDF).
const Print = (() => {
  const nl = (s) => esc(s).replace(/\n/g, '<br>');
  const up = (s) => String(s ?? '').toUpperCase();

  function go(html, { title, page, margin = '12mm', fit }) {
    $('#print').innerHTML = html;
    $('#page-style').textContent = `@page { size: ${page}; margin: ${margin}; }`;
    if (fit) fit();
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
    anaes: ['ANAES', 780],
    implants: ['IMPLANTS', 2130],
    scheme: ['SCHEME STATUS', 1554],
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
      case 'anaes': return ANAES;
      case 'implants': return nl(up(c.implants));
      case 'scheme': return esc(up(c.scheme));
      default: return '';
    }
  }

  // Line 1: list, unit, date, day. Line 2: the unit chief.
  function otTitle(draft) {
    return [
      `OT LIST FOR ORTHO ${up(draft.unit)} ON ${fmtDate(draft.date)} ${up(draft.day)}`.replace(/\s+/g, ' ').trim(),
      up(draft.chief),
    ];
  }

  function otHTML(cases, draft) {
    const cols = Object.keys(OT_COLUMNS);
    const total = cols.reduce((a, k) => a + OT_COLUMNS[k][1], 0);
    return `
      <div class="pr ot">
        <div class="ot-title">${otTitle(draft).map(esc).join('<br>')}</div>
        <table class="ot-table">
          <colgroup>${cols.map((k) => `<col style="width:${((OT_COLUMNS[k][1] / total) * 100).toFixed(2)}%">`).join('')}</colgroup>
          <thead><tr>${cols.map((k) => `<th>${OT_COLUMNS[k][0]}</th>`).join('')}</tr></thead>
          <tbody>${cases.map((c, i) => `<tr>${cols.map((k) => `<td>${otCell(k, c, i, draft)}</td>`).join('')}</tr>`).join('')}</tbody>
        </table>
        <div class="ot-sign">${esc(up(draft.prof))}</div>
      </div>`;
  }

  // US Letter landscape, like the unit's Word template.
  const PAGE_W_MM = 279.4;
  const PAGE_H_MM = 215.9;
  const MM = 96 / 25.4; // CSS px per mm

  // `twice`: two copies on one sheet, top and bottom, each shrunk to fit its half.
  function otList(cases, draft, twice) {
    const title = `OT LIST ${draft.unit || ''} ${fmtDate(draft.date).replace(/\//g, '')}`;
    if (!twice) {
      go(otHTML(cases, draft), { title, page: 'letter landscape' });
      return;
    }
    const margin = 8;
    const gap = 8;
    const halfH = (PAGE_H_MM - 2 * margin - gap) / 2;
    const one = otHTML(cases, draft);
    const html = `<div class="ot-dup" style="--half:${halfH}mm">
      <div class="ot-half">${one}</div><div class="ot-cut" style="height:${gap}mm"></div><div class="ot-half">${one}</div></div>`;
    const fit = () => {
      // Lay the page out off-screen at print width, then zoom each copy into its half.
      const pr = $('#print');
      pr.classList.add('measuring');
      pr.style.width = `${PAGE_W_MM - 2 * margin}mm`;
      // Zoom changes how text wraps, so search for the largest zoom that fits.
      const target = (halfH - 5) * MM; // keep the signature clear of the cut line
      $$('.ot-half > .pr', pr).forEach((el) => {
        const fits = (z) => {
          el.style.zoom = String(z);
          return el.getBoundingClientRect().height <= target;
        };
        if (fits(1)) return;
        let lo = 0.25;
        let hi = 1;
        for (let i = 0; i < 10; i++) {
          const mid = (lo + hi) / 2;
          if (fits(mid)) lo = mid;
          else hi = mid;
        }
        el.style.zoom = lo.toFixed(3);
      });
      pr.classList.remove('measuring');
      pr.style.width = '';
    };
    go(html, { title: title + ' PRINT', page: 'letter landscape', margin: margin + 'mm', fit });
  }

  // ---------------------------------------------------------------- Ward board
  // The ward notebook: S.NO | NAME | DIAGNOSIS | TO DO'S | ASSESSMENT/SCHEME.
  function wardBoard(cases, meta) {
    const rows = cases.map((c, i) => `
      <tr>
        <td class="nb-sno">${c.status === 'posted' ? '<span class="nb-bot">BOT</span>' : ''}${i + 1}</td>
        <td><b>${esc(c.name)}</b><div class="pr-sub">${esc(ageSex(c))} · ${esc(c.ipNo)}${c.ward ? ' · ' + esc(c.ward) : ''}</div></td>
        <td>${nl(c.diagnosis)}${c.plan ? `<div class="pr-sub">▸ ${esc(c.plan)}</div>` : ''}</td>
        <td class="nb-todo">${abnormalList(c).map((t) => `<b class="pr-flag">${esc(t.text)}</b>`).join('')}${todoList(c).map((t) => `<span>${esc(t)}</span>`).join('')}</td>
        <td>${esc(assessmentScheme(c))}</td>
      </tr>`).join('');
    const html = `
      <div class="pr nb">
        <div class="nb-head"><b>${esc(unitName(meta.unitId))} — PRE-OP WARD</b><span>${fmtDate(todayISO())} · ${cases.length} cases</span></div>
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

  // ---------------------------------------------------------------- Chart
  function chart(c, chId, meta) {
    const ch = c.charts[chId];
    const cols = ch.cols || [];
    const rows = chartRows(c, ch);
    const html = `
      <div class="pr chart-pr">
        <div class="chart-pr-head">
          <div><b>${esc(up(ch.title))}</b> — ${esc(unitName(meta.unitId))}</div>
          <div>${esc(up(c.name))} · ${esc(ageSex(c))} · IP ${esc(c.ipNo || '')}${c.ward ? ' · WARD ' + esc(c.ward) : ''}</div>
          <div class="pr-sub">${esc(up(c.diagnosis))}${c.comorbid ? ' · ' + esc(up(c.comorbid)) : ''}</div>
        </div>
        <table class="nb-table chart-pr-table">
          <thead><tr><th>DATE</th><th>TIME</th>${cols.map((col) => `<th>${esc(up(col.label))}${col.unit ? `<div class="pr-sub">${esc(col.unit)}</div>` : ''}${col.range ? `<div class="pr-sub">${esc(col.range)}</div>` : ''}</th>`).join('')}</tr></thead>
          <tbody>${rows.map((r) => `<tr><td>${esc(fmtDate(r.date))}</td><td>${esc(r.time || '')}</td>${cols.map((col) => {
            const v = r.v?.[col.k];
            const f = col.text ? '' : flagOf(v, col);
            const shown = hasText(v) ? (col.text ? v : fmtVal(v, { ...col, unit: '' })) + FLAG_MARK[f] : '';
            return `<td>${f ? `<b class="pr-flag">${esc(shown)}</b>` : esc(shown)}</td>`;
          }).join('')}</tr>`).join('')}</tbody>
        </table>
      </div>`;
    go(html, { title: `${ch.title} ${c.name}`, page: cols.length > 7 ? 'A4 landscape' : 'A4 portrait' });
  }

  return { otList, wardBoard, discharge, chart, OT_COLUMNS, otTitle };
})();

// Shared with the on-screen ward view.
function todoList(c) {
  return pendingList(c).map((p) => p.text);
}
function assessmentScheme(c) {
  const a = hasText(c.work?.anaes) ? 'Assessed' : 'TBA';
  return [a, c.scheme].filter(Boolean).join(' / ');
}
