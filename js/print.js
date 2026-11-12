// Builds printable pages in the unit's own formats and opens the browser's
// print dialog (choose "Save as PDF" as the printer to get a PDF).
const Print = (() => {
  const nl = (s) => esc(s).replace(/\n/g, '<br>');
  const up = (s) => String(s ?? '').toUpperCase();

  // noHeader: zero page margins, so the browser has no room to print its date/time and URL
  // header and footer (the web-address strip); the margins are recreated inside the page
  // (repeated on every page). Every print uses it.
  function go(html, { title, page, margin = '12mm', fit, noHeader = false }) {
    if (noHeader) {
      html = `<table class="pg-wrap"><thead><tr><td style="height:${margin}"></td></tr></thead>`
        + `<tbody><tr><td>${html}</td></tr></tbody><tfoot><tr><td style="height:${margin}"></td></tr></tfoot></table>`;
    }
    $('#print').innerHTML = html;
    $('#page-style').textContent = noHeader
      ? `@page { size: ${page}; margin: 0; } @media print { #print { padding: 0 ${margin}; } }`
      : `@page { size: ${page}; margin: ${margin}; }`;
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
      case 'name': return esc(up(c.name)) + (c.standby ? '<br>(STANDBY)' : '');
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
    const title = otFileName(draft); // the browser's "Save as PDF" uses this as the file name
    if (!twice) {
      go(otHTML(cases, draft), { title, page: 'letter landscape', noHeader: true });
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
    go(html, { title: title + ' PRINT', page: 'letter landscape', margin: margin + 'mm', fit, noHeader: true });
  }

  // ---------------------------------------------------------------- Ward board
  // The ward notebook: S.NO | NAME | DIAGNOSIS | TO DO'S | ASSESSMENT/SCHEME.
  function wardBoard(cases, meta, title = 'PRE-OP WARD') {
    const rows = cases.map((c, i) => `
      <tr>
        <td class="nb-sno">${c.status === 'posted' ? '<span class="nb-bot">BOT</span>' : ''}${i + 1}</td>
        <td><b>${esc(c.name)}</b><div class="pr-sub">${esc(ageSex(c))} · ${esc(c.ipNo)}${c.ward ? ' · ' + esc(c.ward) : ''}${c.bed ? ' · BED ' + esc(c.bed) : ''}</div></td>
        <td>${nl(c.diagnosis)}${c.plan ? `<div class="pr-sub">▸ ${esc(c.plan)}</div>` : ''}</td>
        <td class="nb-todo">${invTodoText(c).trim() ? `<b class="pr-flag">${nl(invTodoText(c).trim())}</b>` : ''}${opTodoText(c).split('\n').filter(Boolean).map((t) => `<span>${esc(t)}</span>`).join('')}</td>
        <td>${esc(assessmentScheme(c))}</td>
      </tr>`).join('');
    const html = `
      <div class="pr nb">
        <div class="nb-head"><b>${esc(unitName(meta.unitId))} — ${esc(title)}</b><span>${fmtDate(todayISO())} · ${cases.length} cases</span></div>
        <table class="nb-table">
          <colgroup><col style="width:6%"><col style="width:17%"><col style="width:30%"><col style="width:32%"><col style="width:15%"></colgroup>
          <thead><tr><th>S.NO</th><th>NAME</th><th>DIAGNOSIS</th><th>TO DO'S</th><th>ASSESSMENT / SCHEME</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
    go(html, { title: `Ward status ${fmtDate(todayISO()).replace(/\//g, '-')}`, page: 'A4 landscape', noHeader: true });
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
          ${sec('OPERATIVE NOTES', up(c.opNotes || d.opNotes))}
          ${sec('TREATMENT GIVEN', up(d.treatment))}
          ${sec('COURSE IN HOSPITAL:', up(d.course))}
          ${sec('CONDITION ON ' + (d.disposition === 'postop' ? 'TRANSFER' : 'DISCHARGE'), up(d.condition))}
          ${sec('DISCHARGE MEDICATIONS', up(d.meds))}
          ${sec('DISCHARGE ADVICE', up(d.advice), 'dc-advice')}
          ${d.adviceTa && d.adviceTa.trim() ? row(`<div class="dc-ta">${d.adviceTa.split('\n').filter((l) => l.trim()).map((l) => `<div>* ${esc(l.trim())}</div>`).join('')}</div>`) : ''}
          ${row(`<div class="dc-end"><div class="dc-doc"><b>DISCHARGING DOCTOR:</b> ${esc(up(d.doctor))}</div><div class="dc-sig">DOCTOR SIGNATURE</div></div>`)}
        </tbody>
      </table>`;
    go(html, { title: `${up(c.name)}_DISCHARGE`, page: 'A4 portrait', noHeader: true });
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
    go(html, { title: `${ch.title} ${c.name}`, page: cols.length > 7 ? 'A4 landscape' : 'A4 portrait', noHeader: true });
  }

  // ---------------------------------------------------------------- Radiographs PDF
  // One page per section (pre-op X-ray, post-op X-ray, post-op wound pic),
  // pictures side by side under a patient strip.
  function imagesPdf(c, d, sections, meta) {
    const strip = `<div class="ip-strip"><b>${esc(up(c.name))}</b> · ${esc(ageSex(c))} · IP ${esc(c.ipNo || '')}${d.arNo ? ' · AR ' + esc(d.arNo) : ''}
      <div>${esc(up(d.diagnosis || c.diagnosis))}</div>
      <div class="pr-sub">${esc(up(d.procedure || c.plan))}${d.dos ? ' · DOS ' + esc(fmtDate(d.dos)) : ''} · ${esc(unitName(meta.unitId))}</div></div>`;
    const html = `<div class="pr ip">${sections.map((sec) => `
      <section class="ip-page">
        ${strip}
        <h2 class="ip-title">${esc(sec.title)}</h2>
        <div class="ip-imgs n${Math.min(sec.images.length, 3)}">${sec.images.map((src) => `<img src="${src}" alt="">`).join('')}</div>
      </section>`).join('')}</div>`;
    go(html, { title: `${up(c.name)}_RADIOGRAPHS`, page: 'A4 portrait', margin: '10mm', noHeader: true });
  }


  // Pre-op imaging of the OT list cases: for each patient, X-rays, then CT, then MRI, each under
  // its own heading (X-rays 3 per page; CT and MRI one image per page), name/age/sex/diagnosis on every page.
  function otXrays(items, draft) {
    const pages = [];
    items.forEach(({ c, n, sections }) => {
      sections.forEach(({ title, images, per = 3 }) => {
        const total = Math.ceil(images.length / per);
        for (let i = 0; i < images.length; i += per) {
          const part = images.slice(i, i + per);
          pages.push(`
      <section class="ip-page xr-page">
        <div class="xr-head">
          <div class="xr-name"><span class="xr-no">${n}.</span> ${esc(up(c.name))} <span class="xr-as">${esc(up(ageSex(c)))}</span></div>
          <div class="xr-dx">${esc(up(c.diagnosis))}</div>
        </div>
        <h2 class="ip-title">${esc(title)}${total > 1 ? ` <span class="xr-part">(${i / per + 1}/${total})</span>` : ''}</h2>
        <div class="ip-imgs n${part.length}">${part.map((src) => `<img src="${src}" alt="">`).join('')}</div>
        <div class="xr-foot">${esc(otTitle(draft)[0])}</div>
      </section>`);
        }
      });
    });
    go(`<div class="pr ip">${pages.join('')}</div>`, { title: `PREOP IMAGING ${draft.unit || ''} ${fmtDate(draft.date).replace(/\//g, '')}`, page: 'A4 portrait', margin: '10mm', noHeader: true });
  }

  // ---------------------------------------------------------------- Consent forms (Tamil)
  // The hospital's own "எடுத்துரைக்கப்பட்ட ஒப்புதல் படிவம்", typed out: one A4 page per OT list case,
  // with the patient's details, diagnosis (Δ) and plan filled in. கால் / கை and the implant options
  // are printed as on the form, to be struck off by hand.
  const CF_IMPL = 'உள்புறக் கம்பி / வெளிப்புறச் சட்டம் / தகடு / திருகாணி';
  const CONSENT_PARAS = [
    'என்னைப் பரிசோதனை செய்த மருத்துவர்கள் எனது கால் / கை எலும்பு முறிவு ஏற்பட்டுள்ளது என்று கூறினர். அதற்கு '
      + CF_IMPL + ' கொண்டு அறுவை சிகிச்சை செய்து சரிசெய்ய வேண்டும் என்று கூறினர். இவ்வறுவை சிகிச்சைக்கு நான் என் மனப்பூர்வ சம்மதம் அளிக்கிறேன்.',
  ];
  const CONSENT_RISK_PARAS = [
    'மேலும், அறுவை சிகிச்சையின் போது மயக்க மருந்து கொடுப்பதால் மூச்சுத்திணறல், மாரடைப்பு மற்றும் மேசை மேல் மரணம் போன்றவை ஏற்படலாம் என அறிவேன். தேவைப்பட்டால் அறுவை சிகிச்சைக்குப் பின்னர் செயற்கை சுவாசம் பொருத்தும் நிலை வரலாம் என அறிவேன்.',
    'மேலும், இரத்த நாளங்கள் சேதம் அடைந்து அதிக இரத்தம் இழக்க வாய்ப்புள்ளது என அறிவேன். அதற்கு இரத்தம் ஏற்றும் நிலை வரலாம் என அறிவேன். அவ்வாறு ஏற்றும் இரத்தத்தினால் ஒவ்வாமை ஏற்பட வாய்ப்புள்ளது என அறிவேன். மேலும் கால் / கைக்கு இரத்த ஓட்டம் இல்லாமல் கால் / கை கருகும் நிலை வரலாம் என அறிவேன்.',
    'மேலும், கிருமித் தொற்று ஏற்பட்டு கால் / கை சீழ்பிடித்து அழுகும் நிலை வரலாம் என அறிவேன். அதற்கு கால் / கையைத் தக்க நிலையில் வெட்டி அகற்றும் நிலை வரலாம் என அறிவேன்.',
    'மேலும், நரம்புகள் சேதம் அடைந்து கால் / கை உணர்ச்சியற்றோ மற்றும் செயல் இழந்து போகவோ வாய்ப்புள்ளது என அறிவேன்.',
    'மேலும், ' + CF_IMPL + ' கொண்டு அறுவை சிகிச்சை செய்யும் போது எனது கை / கால் எலும்புகள் உடைய வாய்ப்புள்ளது என அறிவேன். அதனைப் பொருத்த இயலாத நிலை வரலாம் என அறிவேன். அறுவை சிகிச்சைக்குப் பின்னர் எலும்புகள் கூடாமல் போகவும் வாய்ப்புள்ளது என அறிவேன். மேலும் எலும்பில் பொருத்திய உலோகம் உடைய வாய்ப்புள்ளது என அறிவேன். தேவைப்பட்டால் மறு அறுவை சிகிச்சை செய்யும் நிலை வரலாம் என அறிவேன்.',
    'மேலும், அறுவை சிகிச்சைக்குப் பின்னர் ஆழ்சிரை இரத்த உறைவு (DVT), இரத்தத்தில் கிருமித் தொற்று ஏற்படுதல் (SEPTICAEMIA) மற்றும் எலும்புகளில் சீழ்பிடித்தல் (OSTEOMYELITIS) போன்ற பல சிக்கல்கள் ஏற்பட வாய்ப்புள்ளது என அறிவேன்.',
    'ஆகவே, இவ்வறுவை சிகிச்சை எனது பூரண சம்மதத்துடன் செய்யப்படுவதால், மேற்குறிப்பிட்ட சிக்கல்கள் ஏற்படுமாயின் அதற்கு மருத்துவரோ மருத்துவமனை நிர்வாகமோ பொறுப்பல்ல என்பதை ஒப்புக்கொள்கிறேன்.',
  ];
  function consents(cases, draft, meta = {}) {
    const blank = '<span class="cf-blank"></span>';
    const val = (v) => (String(v || '').trim() ? esc(up(v)) : blank);
    const page = (c) => `
      <section class="cf-page">
        <h1 class="cf-title">எடுத்துரைக்கப்பட்ட ஒப்புதல் படிவம்${c.standby ? ' <small>(STANDBY)</small>' : ''}</h1>
        <table class="cf-box">
          <tr><th>பெயர் <span>/ NAME</span></th><td>${val(c.name)}</td><th>வயது / பாலினம்</th><td>${val(ageSex(c))}</td></tr>
          <tr><th>உள்நோயாளி எண் <span>/ IP NO</span></th><td>${val(c.ipNo)}</td><th>வார்டு <span>/ WARD</span></th><td>${val(c.ward)}</td></tr>
        </table>
        <p class="cf-p">நான் அரசு இராசாசி மருத்துவமனையில் ${c.doa ? `${esc(fmtDate(c.doa))} அன்று ` : ''}அனுமதிக்கப்பட்டேன். ${CONSENT_PARAS[0]}</p>
        <div class="cf-dx"><b>Δ :</b> ${val(c.diagnosis)}</div>
        <div class="cf-dx"><b>PLAN :</b> ${val(c.plan)}</div>
        ${CONSENT_RISK_PARAS.map((t) => `<p class="cf-p">${t}</p>`).join('')}
        <div class="cf-end">
          <div class="cf-date">நாள் : ${esc(fmtDate(draft.date))}</div>
          <div class="cf-by">இப்படிக்கு,
            <span class="cf-line"></span>கையொப்பம் / பெருவிரல் ரேகை
            <span class="cf-line"></span>பெயர் &amp; உறவுமுறை</div>
        </div>
      </section>`;
    go(`<div class="pr cf">${cases.map(page).join('')}</div>`, { title: `CONSENT ${draft.unit || ''} ${fmtDate(draft.date).replace(/\//g, '')}`.replace(/\s+/g, ' '), page: 'A4 portrait', margin: '12mm', noHeader: true });
  }

  return { otList, wardBoard, discharge, chart, imagesPdf, otXrays, consents, OT_COLUMNS, otTitle, CONSENT_PARAS, CONSENT_RISK_PARAS };
})();

// Shared with the on-screen ward view.
function todoList(c) {
  return pendingList(c).map((p) => p.text);
}
function assessmentScheme(c) {
  const v = c.work?.anaes;
  const a = v === 'Assessed' ? 'Assessed' : v === 'Provisionally assessed' ? 'Prov. assessed' : 'TBA';
  return [a, c.scheme].filter(Boolean).join(' / ');
}
