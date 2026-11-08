// Builds printable pages in the unit's own formats and opens the browser's
// print dialog (choose "Save as PDF" as the printer to get a PDF).
const Print = (() => {
  const nl = (s) => esc(s).replace(/\n/g, '<br>');
  const up = (s) => String(s ?? '').toUpperCase();

  // noHeader: zero page margins, so the browser has no room to print its date/time and URL
  // header and footer; the margins are recreated inside the page (repeated on every page).
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
    const title = `OT LIST ${draft.unit || ''} ${fmtDate(draft.date).replace(/\//g, '')}`;
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
    go(html, { title: `${up(c.name)}_RADIOGRAPHS`, page: 'A4 portrait', margin: '10mm' });
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
    go(`<div class="pr ip">${pages.join('')}</div>`, { title: `PREOP IMAGING ${draft.unit || ''} ${fmtDate(draft.date).replace(/\//g, '')}`, page: 'A4 portrait', margin: '10mm' });
  }

  // ---------------------------------------------------------------- Consent forms (Tamil)
  // One A4 page per OT list case: letterhead, the case details filled in, the consent typed in Tamil,
  // and signature lines for the patient / relative, witness and doctor.
  const CONSENT_RISKS = [
    'அதிக இரத்தப்போக்கு மற்றும் இரத்தம் ஏற்ற வேண்டிய தேவை',
    'காயத்தில் கிருமித் தொற்று (சீழ் பிடித்தல்)',
    'நரம்பு மற்றும் இரத்தக் குழாய்களில் பாதிப்பு',
    'எலும்பு கூடாமை, தாமதமாகக் கூடுதல் அல்லது தவறான நிலையில் கூடுதல்',
    'பொருத்தப்படும் உலோகக் கருவிகள் (பிளேட், ஸ்க்ரூ, ராடு, கம்பி) உடைதல், தளர்தல் அல்லது தொற்று',
    'மூட்டு இறுக்கம், தொடர்ந்த வலி, கை / கால் நீளத்தில் வேறுபாடு',
    'கால் நரம்புகளில் இரத்தம் உறைதல் (DVT), நுரையீரல் இரத்தக் கட்டி அடைப்பு (PE), கொழுப்புத் துகள் அடைப்பு (FAT EMBOLISM)',
    'மீண்டும் அறுவை சிகிச்சை செய்ய வேண்டிய நிலை',
    'மயக்க மருந்தினால் ஏற்படக்கூடிய ஒவ்வாமை, இதயம் மற்றும் சுவாசம் சார்ந்த சிக்கல்கள்',
    'மிக அரிதாக உயிருக்கு ஆபத்து',
  ];
  function consents(cases, draft, meta = {}) {
    const letterhead = meta.letterhead || 'assets/letterhead.jpg';
    const blank = '<span class="cf-blank"></span>';
    const val = (v) => (String(v || '').trim() ? esc(up(v)) : blank);
    const page = (c) => {
      const anaes = c.opBuild?.anaes || '';
      const rows = [
        ['நோயாளியின் பெயர்', 'NAME', c.name],
        ['வயது / பாலினம்', 'AGE / SEX', ageSex(c)],
        ['உள்நோயாளி எண்', 'IP NO', c.ipNo],
        ['வார்டு', 'WARD', c.ward],
        ['நோயறிதல்', 'DIAGNOSIS', c.diagnosis],
        ['செய்யப்பட உள்ள அறுவை சிகிச்சை', 'PROPOSED SURGERY', c.plan],
        ['மயக்க மருந்து முறை', 'ANAESTHESIA', anaes],
        ['அறுவை சிகிச்சை தேதி', 'DATE OF SURGERY', fmtDate(draft.date)],
      ];
      return `
      <section class="cf-page">
        <div class="cf-lh"><img src="${esc(letterhead)}" alt=""></div>
        <h1 class="cf-title">அறுவை சிகிச்சைக்கான ஒப்புதல் படிவம்<small>INFORMED CONSENT FOR SURGERY${c.standby ? ' (STANDBY)' : ''}</small></h1>
        <table class="cf-box">${rows.map(([ta, en, v]) => `<tr><th>${ta} <span>/ ${en}</span></th><td>${val(v)}</td></tr>`).join('')}</table>
        <ol class="cf-text">
          <li>மேற்கண்ட நோயாளிக்கு உள்ள நோய் பற்றியும், அதற்கு மேற்கண்ட அறுவை சிகிச்சை தேவை என்பது பற்றியும் மருத்துவர்கள் எனக்குப் புரியும் மொழியில் (தமிழில்) விளக்கினார்கள்.</li>
          <li>அறுவை சிகிச்சையின் நோக்கம், அதனால் கிடைக்கும் நன்மைகள், மாற்று சிகிச்சை முறைகள், அறுவை சிகிச்சை செய்யாவிட்டால் ஏற்படக்கூடிய விளைவுகள் ஆகியவை எனக்கு விளக்கப்பட்டன.</li>
          <li>அறுவை சிகிச்சையின் போதும் அதற்குப் பின்பும் கீழ்க்கண்ட சிக்கல்கள் ஏற்படலாம் என்று எனக்குத் தெரிவிக்கப்பட்டது:
            <ul>${CONSENT_RISKS.map((r) => `<li>${r}</li>`).join('')}</ul></li>
          <li>அறுவை சிகிச்சையின் போது தேவைப்பட்டால், நோயாளியின் நலன் கருதி சிகிச்சை முறையை மாற்றவும், கூடுதல் சிகிச்சை செய்யவும், இரத்தம் மற்றும் இரத்தக் கூறுகளை ஏற்றவும் மருத்துவர்களுக்கு ஒப்புதல் அளிக்கிறேன்.</li>
          <li>தேவையான மயக்க மருந்து (முதுகுத் தண்டு மயக்கம் / நரம்புத் தடுப்பு / முழு மயக்கம்) கொடுக்க ஒப்புதல் அளிக்கிறேன். அதன் அபாயங்கள் எனக்கு விளக்கப்பட்டன.</li>
          <li>அறுவை சிகிச்சையின் முடிவு குறித்து எந்த உத்தரவாதமும் அளிக்கப்படவில்லை என்பதை நான் புரிந்துகொண்டேன்.</li>
          <li>என் சந்தேகங்கள் அனைத்துக்கும் பதில் அளிக்கப்பட்டது. நான் சுயநினைவுடனும், யாருடைய வற்புறுத்தலும் இன்றியும், முழு மனதுடன் இந்த அறுவை சிகிச்சைக்கு ஒப்புதல் அளிக்கிறேன்.</li>
        </ol>
        <div class="cf-sign">
          <div><span class="cf-line"></span>நோயாளியின் கையொப்பம் / இடது கை பெருவிரல் ரேகை</div>
          <div><span class="cf-line"></span>உறவினர் / பாதுகாவலர் கையொப்பம்</div>
          <div><span class="cf-line"></span>உறவினர் பெயர் &amp; உறவுமுறை</div>
          <div><span class="cf-line"></span>சாட்சி பெயர் &amp; கையொப்பம்</div>
          <div><span class="cf-line"></span>மருத்துவர் பெயர் &amp; கையொப்பம்</div>
          <div><span class="cf-line"></span>தேதி &amp; நேரம்</div>
        </div>
      </section>`;
    };
    go(`<div class="pr cf">${cases.map(page).join('')}</div>`, { title: `CONSENT ${draft.unit || ''} ${fmtDate(draft.date).replace(/\//g, '')}`.replace(/\s+/g, ' '), page: 'A4 portrait', margin: '10mm', noHeader: true });
  }

  return { otList, wardBoard, discharge, chart, imagesPdf, otXrays, consents, OT_COLUMNS, otTitle };
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
