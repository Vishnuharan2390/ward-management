// UI: hash-routed views rendered from Store state.
const App = (() => {
  let current = null; // { hash, view, loading }
  let deferred = false;

  const opts = (list, sel) => list.map((v) => {
    const [val, label] = Array.isArray(v) ? v : [v, v];
    return `<option value="${esc(val)}"${val === sel ? ' selected' : ''}>${esc(label)}</option>`;
  }).join('');
  const datalist = (id, list) => `<datalist id="${id}">${list.map((v) => `<option value="${esc(v)}">`).join('')}</datalist>`;
  // OT-only cases (added straight to the OT list) stay out of the e-case sheet, wards and PPTs.
  const allCases = () => Object.entries(Store.cases).map(([id, c]) => ({ id, ...c }));
  const caseList = () => allCases().filter((c) => !c.otOnly);
  const statusBadge = (s) => `<span class="badge st-${esc(s || 'preop')}">${esc(CASE_STATUS[s] || 'Pre-op')}</span>`;
  const levelOpts = (sel) => opts([['', '—'], ...LEVELS.map((l) => [l, l])], sel || '');
  const schemeOpts = (sel) => opts([['', '—'], ...SCHEMES.map((s) => [s, s])], sel || '');
  const isActive = (c) => ['preop', 'posted', undefined, ''].includes(c.status);
  const byWard = (a, b) => String(a.ward || '').localeCompare(String(b.ward || ''), undefined, { numeric: true }) || (a.doa || '').localeCompare(b.doa || '');
  const flagged = (text, f) => (f ? `<b class="flag">${esc(text)}${FLAG_MARK[f]}</b>` : esc(text));
  const metaLine = (c) => [ageSex(c), c.ipNo, c.ward, c.bed && 'BED ' + c.bed].filter(Boolean).join(' · ');
  const tagHTML = (p) => `<span class="tag ${p.kind}">${esc(p.text)}</span>`;

  // ---------------------------------------------------------------- Lab entry
  // One dated set of results. Used on the new-case page and for repeats.
  function paramInput(p, v) {
    const f = flagOf(v, p);
    const field = p.options
      ? `<select name="p_${p.k}"><option value="">—</option>${opts(p.options, v || '')}</select>`
      : `<input name="p_${p.k}" value="${esc(v)}" inputmode="decimal" autocomplete="off">`;
    return `<label class="lab-in${f ? ' is-flag' : ''}" data-param="${p.k}">
      <span class="lab-name">${esc(p.label)}</span>${field}
      <small>${esc(p.range)}${p.unit ? ' ' + esc(p.unit) : ''}</small></label>`;
  }

  function labFormHTML(c, set = {}) {
    const v = set.v || {};
    const customs = customParams(c);
    return `
      <div class="lab-form">
        <div class="ocr-row">
          <label class="btn small">📷 Read report photo<input type="file" accept="image/*" data-ocr hidden></label>
          <span class="ocr-status small muted">Take a clear, flat photo of the report — values are filled in for you to check.</span>
        </div>
        <label class="lab-date">Date of investigations<input type="date" name="labdate" value="${esc(set.date || c.doa || todayISO())}"></label>
        ${LAB_GROUPS.map((g) => `
          <fieldset class="lab-group"><legend>${esc(g.long || g.label)}${g.optional ? ' <span class="muted">(if needed)</span>' : ''}</legend>
            <div class="lab-grid">${g.params.map((p) => paramInput(p, v[p.k])).join('')}</div>
          </fieldset>`).join('')}
        <fieldset class="lab-group"><legend>Other investigations</legend>
          ${customs.length ? `<div class="lab-grid">${customs.map((p) => paramInput(p, v[p.k])).join('')}</div>` : ''}
          <div class="new-customs"></div>
          <button type="button" class="btn small" data-add-custom>+ Add investigation</button>
        </fieldset>
      </div>`;
  }

  const customRow = () => `
    <div class="custom-row">
      <label class="mini-lab">Investigation<input data-cn></label>
      <label class="mini-lab">Value<input data-cv inputmode="decimal"></label>
      <label class="mini-lab">Normal range<input data-cr></label>
      <label class="mini-lab">Units<input data-cu></label>
      <button type="button" class="icon" data-rm-custom title="Remove">✕</button>
    </div>`;

  // Live red flags, new custom rows.
  function bindLabForm(root, c) {
    const params = Object.fromEntries([...ALL_PARAMS, ...customParams(c)].map((p) => [p.k, p]));
    root.addEventListener('input', (e) => {
      const l = e.target.closest('[data-param]');
      if (l) l.classList.toggle('is-flag', !!flagOf(e.target.value, params[l.dataset.param]));
      const row = e.target.closest('.custom-row');
      if (row) $('[data-cv]', row).classList.toggle('is-flag', !!flagOf($('[data-cv]', row).value, { range: $('[data-cr]', row).value }));
    });
    root.addEventListener('change', async (e) => {
      const l = e.target.closest('[data-param]');
      if (l && e.target.tagName === 'SELECT') l.classList.toggle('is-flag', !!flagOf(e.target.value, params[l.dataset.param]));
      if (e.target.dataset.ocr === undefined) return;
      // Photo of a report → fill the empty boxes, highlight what was filled.
      const file = e.target.files[0];
      e.target.value = '';
      if (!file) return;
      const status = $('.ocr-status', root);
      status.classList.remove('muted');
      status.textContent = 'Getting the report reader ready (first time downloads about 7 MB)…';
      try {
        const text = await ReportOCR.read(file, (m) => {
          if (m.status === 'recognizing text') status.textContent = `Reading the report… ${Math.round(m.progress * 100)}%`;
        });
        const { values, date, unsure } = ReportOCR.parse(text);
        const filled = [];
        const skipped = [];
        for (const [k, v] of Object.entries(values)) {
          const el = $(`[name="p_${k}"]`, root);
          if (!el) continue;
          const p = params[k];
          if (el.value.trim() && el.value.trim() !== v) { skipped.push(p.label); continue; }
          el.value = v;
          const lab = el.closest('[data-param]');
          lab.classList.add('from-photo');
          lab.classList.toggle('photo-unsure', unsure.includes(k));
          lab.classList.toggle('is-flag', !!flagOf(v, p));
          filled.push(`${p.label} ${p.options ? v : fmtVal(v, p)}${unsure.includes(k) ? ' (check — decimal point restored)' : ''}`);
        }
        if (date) $('[name=labdate]', root).value = date;
        status.innerHTML = filled.length
          ? `<b>Filled ${filled.length} value(s) from the photo — check each highlighted box before saving.</b> ${esc(filled.join(' · '))}${skipped.length ? `<br>Kept what you had typed for: ${esc(skipped.join(', '))}.` : ''}${date ? `<br>Report date set to ${esc(fmtDate(date))}.` : ''}
             <details><summary>What the reader saw</summary><pre class="ocr-text">${esc(text)}</pre></details>`
          : `<b>Couldn't find any values in that photo.</b> Try again with the report flat, well lit and filling the frame, or type them in.
             <details><summary>What the reader saw</summary><pre class="ocr-text">${esc(text)}</pre></details>`;
      } catch (err) {
        console.error(err);
        status.textContent = 'Could not read the photo: ' + err.message;
      }
    });
    root.addEventListener('click', (e) => {
      if (e.target.closest('[data-add-custom]')) {
        $('.new-customs', root).insertAdjacentHTML('beforeend', customRow());
        $('.new-customs .custom-row:last-child [data-cn]', root).focus();
      }
      const rm = e.target.closest('[data-rm-custom]');
      if (rm) rm.closest('.custom-row').remove();
    });
  }

  // → patch entries for the case (custom params + the set), or null if empty.
  function readLabForm(root, setId) {
    const v = {};
    const changes = {};
    $$('[name^="p_"]', root).forEach((el) => {
      if (el.value.trim()) v[el.name.slice(2)] = el.value.trim();
    });
    $$('.custom-row', root).forEach((row) => {
      const label = $('[data-cn]', row).value.trim();
      if (!label) return;
      const id = uid();
      changes['custom.' + id] = { label, range: $('[data-cr]', row).value.trim(), unit: $('[data-cu]', row).value.trim(), at: Date.now() };
      const val = $('[data-cv]', row).value.trim();
      if (val) v['x_' + id] = val;
    });
    const date = $('[name=labdate]', root).value;
    if (Object.keys(v).length) changes['labs.' + (setId || uid())] = { date, at: Date.now(), by: Store.who(), v };
    else if (setId) changes['labs.' + setId] = DELETE;
    return Object.keys(changes).length ? changes : null;
  }

  function openLabModal(caseId, setId) {
    const c = Store.cases[caseId];
    const set = setId ? c.labs[setId] : { date: todayISO() };
    const m = $('#modal');
    m.innerHTML = `
      <form class="sheet card form" id="lab-modal" autocomplete="off">
        <div class="row-between"><h3>${setId ? 'Edit investigations' : 'Repeat investigations'}</h3><button type="button" class="icon" data-close>✕</button></div>
        <p class="muted small">Fill only what was repeated. Everything else keeps its last value.</p>
        ${labFormHTML(c, set)}
        <div class="form-actions"><button class="btn primary">Save</button><button type="button" class="btn" data-close>Cancel</button></div>
      </form>`;
    m.hidden = false;
    m.classList.add('sheet-wrap');
    const f = $('#lab-modal', m);
    bindLabForm(f, c);
    const close = () => {
      m.hidden = true;
      m.classList.remove('sheet-wrap');
      m.innerHTML = '';
    };
    m.onclick = (e) => { if (e.target === m || e.target.closest('[data-close]')) close(); };
    f.onsubmit = (e) => {
      e.preventDefault();
      const ch = readLabForm(f, setId);
      if (ch) Store.patch('cases', caseId, ch);
      close();
    };
  }

  // ECG tick, ECHO text and PAC status (+ work pending) — on the add-case
  // form (`form` true: named fields) and on the case page (bound fields).
  // c: the case (for age-dependent items — ECHO is optional under 40).
  function workupHTML(work = {}, form = false, c = null) {
    const echoOpt = c ? !workNeeded(c, WORKUP.find((w) => w.k === 'echo')) : false;
    const pend = work.anaes && work.anaes !== 'Assessed';
    const attr = (k) => (form ? `name="w_${k}"` : `data-bind="work.${k}"`);
    return `
      <div class="workup">
        <label class="ecg-check"><input type="checkbox" ${form ? 'name="w_ecg"' : 'data-check="work.ecg"'} ${work.ecg ? 'checked' : ''}> ECG</label>
        <label class="echo-line">ECHO <span class="hint">${form ? 'not needed under 40 yrs — fill only if taken' : echoOpt ? 'not needed (under 40) — fill only if taken' : ''}</span><input ${attr('echo')} value="${esc(work.echo)}" placeholder="${echoOpt ? 'Optional' : ''}"></label>
        <label>Anaesthesia assessment
          <select ${attr('anaes')} data-pac><option value="">—</option>${opts(PAC_OPTIONS, work.anaes || '')}</select></label>
        <label class="pac-pending"${pend ? '' : ' hidden'}>Work pending to get assessment
          <textarea ${attr('anaesPending')} rows="2">${esc(work.anaesPending)}</textarea></label>
      </div>`;
  }

  // ---------------------------------------------------------------- Case order
  // Date of admission (oldest first) unless someone rearranged: then the saved order (shared
  // with the team), with newly added cases slotted in by their DOA.
  const byDoa = (a, b) => (a.doa || '').localeCompare(b.doa || '') || (a.createdAt || 0) - (b.createdAt || 0);
  function orderedAll() {
    const all = allCases().sort(byDoa);
    const ord = Store.meta.caseOrder;
    if (!ord?.length) return all;
    const pos = new Map(ord.map((id, i) => [id, i]));
    const out = all.filter((c) => pos.has(c.id)).sort((a, b) => pos.get(a.id) - pos.get(b.id));
    for (const c of all.filter((x) => !pos.has(x.id))) {
      // just after the last case admitted on or before its date
      let i = -1;
      out.forEach((k, j) => { if ((k.doa || '') <= (c.doa || '')) i = j; });
      out.splice(i + 1, 0, c);
    }
    return out;
  }
  const inOrder = (list) => { const ids = new Set(list.map((c) => c.id)); return orderedAll().filter((c) => ids.has(c.id)); };
  // New order for the cases currently shown (e.g. after a drag); hidden/filtered cases keep their places.
  function setShownOrder(newShown) {
    const full = orderedAll().map((c) => c.id);
    const set = new Set(newShown);
    const slots = full.map((id, i) => (set.has(id) ? i : -1)).filter((i) => i >= 0);
    slots.forEach((slot, k) => { full[slot] = newShown[k]; });
    Store.setMeta({ caseOrder: full });
  }
  // Move a case one place up/down among the cases currently shown.
  function moveCase(id, dir, shown) {
    const j = shown.indexOf(id) + dir;
    if (j < 0 || j >= shown.length) return;
    const full = orderedAll().map((c) => c.id);
    const a = full.indexOf(id);
    const b = full.indexOf(shown[j]);
    [full[a], full[b]] = [full[b], full[a]];
    Store.setMeta({ caseOrder: full });
  }

  // Pre-op → post-op handover: the case (with everything in it) leaves the pre-op ward and
  // waits in the post-op ward's Incoming list until the post-op PG taps Receive.
  function transferToPostop(id) {
    // Straight into the post-op ward (no separate "receive" step).
    Store.patch('cases', id, { status: 'postop', transfer: { by: Store.who(), at: Date.now(), received: true } });
  }

  // Transfer outs (Plastic surgery, Neurosurgery): from the pre-op or post-op ward the case leaves both
  // wards and the OT list and waits under that department's tab; transferred back in, it joins the
  // pre-op ward. The open stay is c[dept], each finished stay is kept in c[dept + 'Log'].
  const wardOf = (c) => (c.status === 'postop' ? 'Post-op ward' : 'Pre-op ward');
  const canTransferOut = (c) => isActive(c) || c.status === 'postop';
  function transferOut(id, dept) {
    const c = Store.cases[id];
    const ch = { status: dept, [dept]: { out: todayISO(), at: Date.now(), by: Store.who(), from: c.status === 'postop' ? 'postop' : c[c.status]?.from || 'preop' } };
    // Straight from one department to another: close the first stay.
    if (TRANSFER_DEPTS[c.status] && c.status !== dept) Object.assign(ch, closeStay(c, c.status, dept));
    Store.patch('cases', id, ch);
  }
  // `to`: where the case went when the stay ended — 'preop' (transferred back in) or another department.
  const closeStay = (c, dept, to = 'preop') => ({ [dept]: DELETE, [`${dept}Log.${uid()}`]: { ...(c[dept] || {}), in: todayISO(), inAt: Date.now(), inBy: Store.who(), to } });
  function backIn(id) {
    const c = Store.cases[id];
    Store.patch('cases', id, { status: 'preop', ...closeStay(c, c.status) });
  }
  function askOut(id, dept) {
    const c = Store.cases[id];
    const D = TRANSFER_DEPTS[dept];
    const T = deptSay(dept);
    const here = TRANSFER_DEPTS[c.status] ? `${TRANSFER_DEPTS[c.status].tab} list` : `${wardOf(c).toLowerCase()} and the OT list`;
    if (!confirm(`${T.outQ(c.name || 'this case')}\n\nIt leaves the ${here}, and waits under "${D.tab}" until it goes back to the pre-op ward.`)) return false;
    transferOut(id, dept);
    toast(T.outToast(c.name || 'Case'));
    return true;
  }
  function askBack(id) {
    const c = Store.cases[id];
    const D = TRANSFER_DEPTS[c.status];
    if (!D) return false;
    const T = deptSay(c.status);
    if (!confirm(`${T.backQ(c.name || 'this case')}\n\nIt goes into the pre-op ward.`)) return false;
    backIn(id);
    toast(`${c.name || 'Case'} is back in the pre-op ward`);
    return true;
  }

  // ---------------------------------------------------------------- Dashboard
  let dashFilter = sessionStorage.getItem('wm.filter') || 'active';
  if (TRANSFER_DEPTS[dashFilter]) dashFilter = 'active'; // those filter chips became the transfer-out buttons
  let dashQuery = '';

  // Census tiles on the e-Case Sheet page: each one is also a filter for the case list below,
  // using the same rule as its number (so the list length always equals the tile).
  const TILE_FILTERS = {
    ward: { label: 'Pre-op ward', test: (c) => isActive(c) },
    ready: { label: 'Work-up complete', test: (c) => isActive(c) && readiness(c).ready },
    posted: { label: 'Posted (BOT)', test: (c) => c.status === 'posted' },
    postward: { label: 'Post-op ward', test: (c) => c.status === 'postop' && !isIncoming(c) },
  };
  function filteredCases() {
    const q = dashQuery.toLowerCase();
    const tile = TILE_FILTERS[dashFilter];
    return inOrder(caseList()
      .filter((c) => (tile ? tile.test(c) : dashFilter === 'active' ? isActive(c) : dashFilter === 'all' || (c.status || 'preop') === dashFilter))
      .filter((c) => !q || [c.name, c.ipNo, c.ward, c.diagnosis, c.plan].join(' ').toLowerCase().includes(q)));
  }

  const Dashboard = {
    live: true,
    render() {
      const all = caseList();
      const cnt = (s) => all.filter((c) => (c.status || 'preop') === s).length;
      // Census: counted from the very lists the ward pages show, so the numbers always match them.
      const preWard = activeCases(); // pre-op + posted (BOT) patients — all still in the pre-op ward
      const postWard = postWardCases(); // received into the post-op ward
      const ready = preWard.filter((c) => readiness(c).ready).length;
      const filters = [['active', 'Active'], ['preop', 'Pre-op'], ['posted', 'Posted'], ['postop', 'Post-op'], ['discharged', 'Discharged'], ['all', 'All']];
      const u = unitOf(Store.meta.unitId);
      return `
        <div class="hosp">
          <div class="hosp-logo" aria-hidden="true"></div>
          <div class="hosp-l1">GOVERNMENT RAJAJI HOSPITAL, MADURAI</div>
          <div class="hosp-l2">MADURAI MEDICAL COLLEGE</div>
          <div class="hosp-l3">DEPARTMENT OF ORTHOPAEDICS AND TRAUMATOLOGY</div>
          <div class="hosp-l4">ORTHO UNIT ${esc(u.id)} · ${esc(u.chief)}</div>
        </div>
        <div class="stats">
          ${[['ward', preWard.length, 'Pre-op ward'], ['ready', ready, 'Work-up complete'], ['posted', cnt('posted'), 'Posted (BOT)'],
    ['postward', postWard.length, 'Post-op ward']]
    .map(([k, n, l]) => `<div class="stat-btn${dashFilter === k ? ' on' : ''}" role="button" tabindex="0" data-filter="${k}" data-tile aria-pressed="${dashFilter === k}" title="Show these cases">
            <b>${n}</b><span>${l}</span></div>`).join('')}
        </div>
        <div class="toolbar dash-tools">
          <label class="search-lab">Search<input type="search" id="q" aria-label="Search name, IP, ward, diagnosis" value="${esc(dashQuery)}"></label>
          <a class="btn primary" href="#/new">+ New case</a>
          <a class="btn wa" href="#/import">From WhatsApp</a>
          <a class="btn" href="#/import">From PowerPoint</a>
        </div>
        <div class="xfer-links">${Object.entries(TRANSFER_DEPTS).map(([k, D]) => `<a class="btn small" href="#/${k}" title="${esc(D.tab)}">${esc(D.btn || D.tab)}${cnt(k) ? ` <span class="pill">${cnt(k)}</span>` : ''}</a>`).join('')}</div>
        <div class="chips dash-chips">${filters.map(([k, l]) => `<button class="chip${dashFilter === k ? ' on' : ''}" data-filter="${k}">${l}</button>`).join('')}</div>
        <div class="order-bar">
          <span class="muted small">${Store.meta.caseOrder?.length ? 'Your own order' : 'By date of admission (oldest first)'}</span>
          ${Store.meta.caseOrder?.length ? '<button class="btn small" id="order-reset">Back to DOA order</button>' : ''}
        </div>
        ${TILE_FILTERS[dashFilter] ? `<div class="tile-filter"><span>Showing <b>${esc(TILE_FILTERS[dashFilter].label)}</b> — ${filteredCases().length} case${filteredCases().length === 1 ? '' : 's'}</span>
          <button class="btn small" data-filter="active">✕ Show all active</button></div>` : ''}
        <div class="cards">${cardsHTML(all.length)}</div>`;
    },
    mount(el) {
      $('#q', el).addEventListener('input', (e) => {
        dashQuery = e.target.value;
        $('.cards', el).innerHTML = cardsHTML(1);
      });
      const reset = $('#order-reset', el);
      if (reset) reset.onclick = () => { Store.setMeta({ caseOrder: [] }); toast('Back to date-of-admission order'); };
      el.addEventListener('click', (e) => {
        const mv = e.target.closest('[data-cmove]');
        if (mv) {
          e.preventDefault();
          moveCase(mv.closest('[data-cid]').dataset.cid, +mv.dataset.cmove, filteredCases().map((c) => c.id));
          return;
        }
        const f = e.target.closest('[data-filter]');
        if (!f) return;
        const tile = f.dataset.tile !== undefined;
        // A tile tapped again goes back to all active cases.
        dashFilter = tile && dashFilter === f.dataset.filter ? 'active' : f.dataset.filter;
        sessionStorage.setItem('wm.filter', dashFilter);
        render();
        // From a tile: bring the list into view (below the sticky header).
        if (tile && dashFilter !== 'active') {
          const top = $('.tile-filter')?.getBoundingClientRect().top;
          if (top != null) window.scrollTo({ top: window.scrollY + top - 110, behavior: 'smooth' });
        }
      });
      // Tiles are buttons for the keyboard too.
      el.addEventListener('keydown', (e) => {
        if ((e.key === 'Enter' || e.key === ' ') && e.target.matches?.('[data-tile]')) { e.preventDefault(); e.target.click(); }
      });
    },
  };

  function cardsHTML(total) {
    const list = filteredCases();
    if (!list.length) return `<div class="empty">${total ? 'No cases match.' : 'No cases yet. Tap “+ New case” to add your first patient.'}</div>`;
    return list.map((c, i) => {
      const r = readiness(c);
      const pend = pendingList(c);
      const d = daysSince(c.doa);
      return `
        <div class="case-row" data-cid="${c.id}">
        <div class="cc-move"><button class="icon" data-cmove="-1" ${i ? '' : 'disabled'} aria-label="Move up" title="Move up">↑</button><button class="icon" data-cmove="1" ${i < list.length - 1 ? '' : 'disabled'} aria-label="Move down" title="Move down">↓</button></div>
        <a class="card case-card" href="#/case/${c.id}">
          <div class="row-between">
            <div>
              <div class="cc-name">${esc(c.name)} <span class="muted">${esc(ageSex(c))}</span></div>
              <div class="muted small">IP ${esc(c.ipNo || '—')}${c.ward ? ' · Ward ' + esc(c.ward) : ''} · DOA ${esc(fmtDate(c.doa))}${d != null ? ` (D${d})` : ''}${c.scheme ? ' · ' + esc(c.scheme) : ''}</div>
            </div>
            ${statusBadge(c.status)}
          </div>
          <div class="cc-dx">${esc(c.diagnosis)}</div>
          ${c.plan ? `<div class="cc-plan">▸ ${esc(c.plan)}</div>` : ''}
          <div class="progress" title="${r.done}/${r.total} done"><i style="width:${r.total ? Math.round((r.done / r.total) * 100) : 0}%" class="${r.ready ? 'ok' : ''}"></i></div>
          <div class="pend">
            ${r.ready && !pend.length ? '<span class="tag ok">✓ Work-up complete</span>' : ''}
            ${pend.slice(0, 8).map(tagHTML).join('')}${pend.length > 8 ? `<span class="tag">+${pend.length - 8} more</span>` : ''}
          </div>
        </a>
        </div>`;
    }).join('');
  }


  // ---------------------------------------------------------------- Import from WhatsApp
  // Cases posted in the unit WhatsApp group: paste one message, or open the group's "Export chat" file.
  const Import = {
    live: false,
    items: null,
    busy: '',
    doa: '', // date of admission = the Admission day PPT's date
    usePosted: false, // or the date each post was sent
    back: '#/',
    open(deckDate) {
      Import.doa = deckDate || Deck.date || todayISO();
      Import.back = deckDate ? '#/deck' : '#/';
      Import.applyDoa();
      return Import;
    },
    applyDoa() {
      (Import.items || []).forEach((c) => { c.doa = Import.usePosted ? c.posted || Import.doa : Import.doa; });
    },
    render() {
      const it = Import.items;
      const sexSel = (i, v) => `<select data-i="${i}" data-f="sex">${['', 'M', 'F'].map((x) => `<option${x === v ? ' selected' : ''}>${x}</option>`).join('')}</select>`;
      const kinds = [...IMAGE_KINDS.map((k) => [k.k, k.label]), ['skip', 'Don’t add']];
      const ppt = Import.source === 'ppt';
      const deckMode = Import.back === '#/deck';
      const others = deckMode && it ? it.filter((c) => c.otherDay).length : 0;
      const shown = it ? it.filter((c) => !deckMode || !c.otherDay || Import.otherDay) : [];
      const list = it ? `
        <div class="toolbar"><h2>${deckMode ? `${shown.length} case${shown.length === 1 ? '' : 's'} posted on the ${esc(fmtDate(Import.doa))} admission day` : `${it.length} case${it.length === 1 ? '' : 's'} found`}</h2>
          <button class="btn" id="imp-clear">Start over</button></div>
        <div class="card imp-doa">
          <label>Date of admission<input type="date" id="imp-doa" value="${esc(Import.doa)}" ${Import.usePosted ? 'disabled' : ''}></label>
          ${ppt ? `<p class="small muted">${Import.pptDate ? 'Taken from the date on the PowerPoint’s first slide.' : 'No date found on the PowerPoint’s first slide — check it.'}</p>` : `<p class="small muted">${Import.usePosted ? 'Each case gets the date it was posted in the group.' : 'Taken from the Admission day PPT date. Changing it here changes the PPT date too.'}
            <button class="link" id="imp-posted">${Import.usePosted ? 'Use the Admission day PPT date' : 'Use the date each case was posted instead'}</button></p>`}
        </div>
        ${it.length ? '' : ppt ? '<p class="empty">No cases found in that PowerPoint. A case slide needs a NAME row (or a “Raja 26/M” line) and the diagnosis.</p>' : '<p class="empty">No case posts found. A post needs a line like “Udayakumar 26/M” and the diagnosis.</p>'}
        ${ppt && Import.pptSkipped ? `<p class="muted small">${Import.pptSkipped} picture(s) are in a format a browser can’t open (EMF/TIFF) and were left out.</p>` : ''}
        ${others ? `<p class="small"><button class="link" id="imp-others">${Import.otherDay ? 'Hide' : 'Show'} ${others} post${others === 1 ? '' : 's'} from other days</button></p>` : ''}
        ${it.map((c, i) => (deckMode && c.otherDay && !Import.otherDay ? '' : `
          <div class="card imp-case${c.dup ? ' imp-dup' : ''}">
            <label class="imp-pick"><input type="checkbox" data-i="${i}" data-f="sel" ${c.sel ? 'checked' : ''}>
              <b>${c.caseNo ? `Case ${esc(c.caseNo)} · ` : ''}${esc(c.name)} ${esc(c.age)}/${esc(c.sex)}</b>
              <span class="muted small">${ppt ? `${c.deckStatus ? esc(c.deckStatus) + ' · ' : ''}${c.photos.length} picture(s)` : `${(c.posted || c.doa) ? 'posted ' + esc(fmtDate(c.posted || c.doa)) : ''}${c.sender ? ' by ' + esc(c.sender) : ''}`}</span>
              ${c.dup ? '<span class="tag task">Already in Cases</span>' : ''}</label>
            <div class="form imp-grid">
              <label class="span2">Name<input data-i="${i}" data-f="name" value="${esc(c.name)}"></label>
              <label>Age<input data-i="${i}" data-f="age" inputmode="numeric" value="${esc(c.age)}"></label>
              <label>Sex${sexSel(i, c.sex)}</label>
              <label>IP no.<input data-i="${i}" data-f="ipNo" value="${esc(c.ipNo)}"></label>
              <label>Ward<input data-i="${i}" data-f="ward" value="${esc(c.ward)}"></label>
              <label>Mode<input data-i="${i}" data-f="mode" list="dl-mode" value="${esc(c.mode)}"></label>
              <label>DOA<input type="date" data-i="${i}" data-f="doa" value="${esc(c.doa)}"></label>
              <label class="span2">Diagnosis<textarea data-i="${i}" data-f="diagnosis" rows="2">${esc(c.diagnosis)}</textarea></label>
              <label class="span2">Plan<input data-i="${i}" data-f="plan" value="${esc(c.plan)}"></label>
              ${c.phone != null || c.address != null ? `<label>Phone<input data-i="${i}" data-f="phone" inputmode="tel" value="${esc(c.phone || '')}"></label>
              <label>Address<input data-i="${i}" data-f="address" value="${esc(c.address || '')}"></label>` : ''}
              ${c.treatment != null ? `<label class="span2">Treatment<textarea data-i="${i}" data-f="treatment" rows="2">${esc(c.treatment)}</textarea></label>` : ''}
            </div>
            ${c.photos.length ? `<div class="imp-photos">${c.photos.map((ph, j) => `
              <figure><img src="${ph.url}" alt=""><select data-i="${i}" data-p="${j}">${kinds.map(([k, l]) => `<option value="${k}"${k === ph.kind ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></figure>`).join('')}</div>` : ''}
            ${c.skippedPhotos ? `<p class="muted small">${c.skippedPhotos} photo(s) not loaded — this post is from another day.</p>` : c.missing ? `<p class="muted small">${c.missing} photo(s) in this post weren't in the file — export the chat <b>with media</b> (Attach Media) to bring them in.</p>` : ''}
          </div>`)).join('')}
        ${it.length ? `<div class="form-actions"><button class="btn primary" id="imp-add">Add ${it.filter((c) => c.sel).length} case(s) to Cases</button></div>` : ''}
        ${datalist('dl-mode', MODES)}` : '';
      return `
        <h2>${it ? (ppt ? 'Import from PowerPoint' : 'Import from WhatsApp') : 'Import cases'}</h2>
        ${Import.busy ? `<p class="notice">${esc(Import.busy)}</p>` : ''}
        ${it ? list : `
        <section class="card">
          <h3>Admission day PowerPoint (.pptx)</h3>
          <p class="small muted">The deck you made separately: each “CASE n” slide (name, age/sex, IP no., mode, diagnosis…) becomes a case,
            and the picture slides after it (X-RAY, CT, MRI, WOUND PIC…) become its images. You check everything before it's added.</p>
          <label class="btn primary">Open PowerPoint (.pptx)<input type="file" id="imp-ppt" accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation" hidden></label>
        </section>
        <section class="card">
          <h3>WhatsApp: whole group (with photos)</h3>
          <ol class="small imp-steps">
            <li>Open the group in WhatsApp → tap the group name at the top.</li>
            <li>Scroll down → <b>Export chat</b> → <b>Attach Media</b> → <b>Save to Files</b> (Android: ⋮ → More → Export chat → Include media).</li>
            <li>Pick that file here. Every “Case …” post is found, with its X-ray and wound photos.</li>
          </ol>
          <label class="btn primary">Open exported chat (.zip / .txt)<input type="file" id="imp-file" accept=".zip,.txt,application/zip,text/plain" hidden></label>
        </section>
        <section class="card">
          <h3>One case (text only)</h3>
          <p class="small muted">Long-press the case message in WhatsApp → Copy → paste here.</p>
          <textarea id="imp-text" rows="6"></textarea>
          <div class="form-actions"><button class="btn primary" id="imp-read">Read message</button></div>
        </section>`}`;
    },
    // From the admission day PPT: only the posts of that admission day (8 AM to 10 AM next morning)
    // are ticked; posts from other days stay hidden unless asked for.
    dayWindow() {
      if (Import.back !== '#/deck' || !Import.doa) return null;
      const [y, mo, d] = Import.doa.split('-').map(Number);
      const from = Date.UTC(y, mo - 1, d, 8, 0);
      return [from, from + 26 * 3600e3];
    },
    markDay() {
      const win = Import.dayWindow();
      if (!win) return;
      const [from, to] = win;
      for (const c of Import.items || []) {
        const other = c.t != null && (c.t < from || c.t >= to);
        if (other !== !!c.otherDay) c.sel = !c.dup && !other;
        c.otherDay = other;
      }
    },
    async load(cases) {
      const have = new Set(allCases().map((c) => WaImport.key(c.name, c.age)));
      const num = (c) => (c.caseNo ? parseInt(c.caseNo, 10) : 1e9);
      cases.sort((a, b) => (a.doa || '').localeCompare(b.doa || '') || num(a) - num(b));
      for (const c of cases) {
        c.dup = have.has(WaImport.key(c.name, c.age));
        c.sel = !c.dup;
        c.plan = defaultPlanFor(c.diagnosis);
        c.posted = c.doa;
        c.photos = c.photos || [];
        for (const ph of c.photos) {
          ph.url = URL.createObjectURL(ph.blob);
          ph.kind = ph.kind || await WaImport.guessKind(ph.blob); // a PowerPoint slide title already says X-ray / CT / wound
        }
      }
      Import.items = cases;
      Import.otherDay = false;
      Import.markDay();
      Import.applyDoa();
      Import.busy = '';
      render();
    },
    mount(el) {
      const pptIn = $('#imp-ppt', el);
      if (pptIn) pptIn.onchange = async () => {
        const f = pptIn.files[0];
        if (!f) return;
        Import.busy = 'Reading the PowerPoint…';
        render();
        try {
          const { date, cases, skipped } = await PptImport.read(f);
          Import.source = 'ppt';
          Import.pptDate = date;
          Import.pptSkipped = skipped;
          Import.usePosted = false;
          if (date) Import.doa = date;
          if (date && Import.back === '#/deck') Deck.date = date;
          await Import.load(cases.map((c) => ({ ...c, doa: c.doa || Import.doa })));
        } catch (err) {
          Import.busy = '';
          render();
          toast(`Couldn't read that file: ${err.message}`, 7000);
        }
      };
      const file = $('#imp-file', el);
      if (file) file.onchange = async () => {
        const f = file.files[0];
        if (!f) return;
        Import.busy = 'Reading the chat…';
        render();
        try {
          // From the admission day PPT: only that day's photos are unpacked from the export.
          const win = Import.dayWindow();
          Import.source = 'wa';
          await Import.load(await WaImport.readExport(f, (c) => !win || c.t == null || (c.t >= win[0] && c.t < win[1])));
        } catch (err) {
          Import.busy = '';
          render();
          toast(`Couldn't read that file (${err.message}). Pick the .zip or .txt from WhatsApp's Export chat.`, 6000);
        }
      };
      const read = $('#imp-read', el);
      if (read) read.onclick = () => {
        const c = WaImport.parseCaseText($('#imp-text', el).value);
        if (!c) return toast('Couldn’t find a “Name 26/M” line and a diagnosis in that message', 5000);
        Import.source = 'wa';
        Import.load([{ ...c, doa: todayISO(), photos: [] }]);
      };
      const doa = $('#imp-doa', el);
      if (doa) doa.onchange = () => {
        Import.doa = doa.value || todayISO();
        Deck.date = Import.doa;
        Import.markDay();
        Import.applyDoa();
        render();
      };
      const oth = $('#imp-others', el);
      if (oth) oth.onclick = () => { Import.otherDay = !Import.otherDay; render(); };
      const posted = $('#imp-posted', el);
      if (posted) posted.onclick = () => {
        Import.usePosted = !Import.usePosted;
        Import.applyDoa();
        render();
      };
      const clear = $('#imp-clear', el);
      if (clear) clear.onclick = () => {
        (Import.items || []).forEach((c) => c.photos.forEach((ph) => URL.revokeObjectURL(ph.url)));
        Import.items = null;
        render();
      };
      el.addEventListener('input', (e) => {
        const t = e.target;
        const c = Import.items?.[t.dataset.i];
        if (!c) return;
        if (t.dataset.p !== undefined) c.photos[t.dataset.p].kind = t.value;
        else if (t.dataset.f === 'sel') c.sel = t.checked;
        else if (t.dataset.f) {
          if (t.dataset.f === 'diagnosis' && c.plan === defaultPlanFor(c.diagnosis)) {
            c.plan = defaultPlanFor(t.value);
            const pl = $(`[data-i="${t.dataset.i}"][data-f="plan"]`, el);
            if (pl) pl.value = c.plan;
          }
          c[t.dataset.f] = t.value;
        }
        if (t.dataset.f === 'sel') $('#imp-add', el).textContent = `Add ${Import.items.filter((x) => x.sel).length} case(s) to Cases`;
      });
      el.addEventListener('change', (e) => e.target.dispatchEvent(new Event('input', { bubbles: true })));
      const add = $('#imp-add', el);
      if (add) add.onclick = async () => {
        const pick = Import.items.filter((c) => c.sel);
        if (!pick.length) return toast('Tick at least one case');
        add.disabled = true;
        let photos = 0;
        let bad = 0;
        for (const c of pick) {
          const nid = uid();
          const plan = c.plan.trim().toUpperCase();
          const diagnosis = c.diagnosis.trim().toUpperCase();
          Store.create('cases', nid, {
            name: c.name.trim().toUpperCase(), age: String(c.age).trim(), sex: c.sex, ipNo: (c.ipNo || '').trim(), ward: (c.ward || '').trim().toUpperCase(),
            mode: c.mode.trim().toUpperCase(), diagnosis, plan, doa: c.doa || todayISO(),
            implants: plan ? suggestImplantsFor(plan, diagnosis, Store.implants).implants : '', level: plan ? levelFor(plan, Store.levels).level || '' : '',
            status: 'preop', work: {}, treatment: String(c.treatment || '').trim() || STANDARD_TREATMENT.join('\n'), writtenBy: (c.writtenBy || '').trim().toUpperCase(),
            ...(c.caseNo ? { caseNo: String(c.caseNo) } : {}),
            ...(c.phone ? { phone: String(c.phone).trim() } : {}),
            ...(c.address ? { address: String(c.address).trim().toUpperCase() } : {}),
            ...(c.deckStatus ? { deckStatus: c.deckStatus } : {}),
          });
          for (const ph of c.photos.filter((x) => x.kind !== 'skip')) {
            toast(`Saving photos… ${++photos}`, 8000);
            try {
              const src = Import.source === 'ppt' ? 'PowerPoint' : 'WhatsApp';
              await Store.addImage(nid, ph.kind, await compressImage(ph.blob), c.caseNo ? `${src} case ${c.caseNo}` : src);
            } catch { bad++; }
          }
        }
        (Import.items || []).forEach((c) => c.photos.forEach((ph) => URL.revokeObjectURL(ph.url)));
        Import.items = null;
        toast(`Added ${pick.length} case(s)${photos ? ` with ${photos - bad} photo(s)` : ''}${bad ? ` — ${bad} photo(s) couldn't be opened` : ''}`, 5000);
        if (Import.back === '#/deck') {
          Deck.date = Import.doa;
          // The PPT follows the case numbers from the group (Case 10 before Case 11), whatever order they were posted in.
          const cfg = deckCfg(Import.doa);
          const ids = deckCases(Import.doa, cfg).map((x) => x.id);
          const no = (id) => { const n = parseInt(Store.cases[id]?.caseNo, 10); return Number.isFinite(n) ? n : null; };
          const pos = new Map(ids.map((id, k) => [id, k]));
          const ordered = [...ids].sort((a, b) => {
            const A = no(a);
            const B = no(b);
            if (A != null && B != null) return A - B;
            return pos.get(a) - pos.get(b);
          });
          saveDeckCfg(Import.doa, { ...cfg, order: ordered });
        }
        location.hash = Import.back;
      };
    },
  };

  // ---------------------------------------------------------------- Ward board
  const activeCases = () => inOrder(caseList().filter(isActive));

  // Latest value of one parameter, flagged; the date shows on hover.
  function paramCell(c, p) {
    const l = latest(c, p.k);
    if (!l) return `<td class="v ${p.group?.optional ? 'muted' : 'miss'}">–</td>`;
    const f = flagOf(l.value, p);
    const shown = p.scale ? fmtVal(l.value, { ...p, unit: '' }) : l.value;
    return `<td class="v${f ? ' flag' : ''}" title="${esc(fmtDate(l.date))}">${esc(shown)}${FLAG_MARK[f]}</td>`;
  }

  // Ward order: by bed number (default — follows the walk round the ward), or the shared list order.
  const bedKey = (c) => String(c.bed || '').trim();
  // Post-op ward: every post-op case. There is no "incoming / receive" step any more — a transfer
  // lands in the post-op ward at once, and cases still marked "not received" from before count as in.
  const isIncoming = () => false;
  const postWardCases = () => inOrder(caseList().filter((c) => c.status === 'postop' && !isIncoming(c)));
  const podOf = (c) => { const d = c.surgeryDate || c.otDate; return d ? daysSince(d) : null; };
  function wardCases(W) {
    const list = W.kind === 'post' ? postWardCases() : activeCases();
    if (W.sort !== 'bed') return list;
    const pos = new Map(list.map((c, i) => [c.id, i]));
    return [...list].sort((a, b) => {
      const A = bedKey(a);
      const B = bedKey(b);
      if (!A || !B) return (!A) - (!B) || pos.get(a.id) - pos.get(b.id); // no bed yet → end, in list order
      return A.localeCompare(B, undefined, { numeric: true, sensitivity: 'base' }) || pos.get(a.id) - pos.get(b.id);
    });
  }
  const lsGet = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } };

  // ---- Comorbidities
  const comorbOn = (c) => COMORBIDITIES.filter(([k]) => c.comorb?.[k]?.on).map(([k]) => k);
  // "Other" box: what was typed there, or (older cases) the free-text comorbidities line.
  const comorbOtherOf = (c) => (c.comorbOther !== undefined ? c.comorbOther : (c.comorb ? '' : (c.comorbid || '')));
  function comorbCardHTML(c) {
    const cm = c.comorb || {};
    const rows = COMORBIDITIES.filter(([k]) => cm[k]?.on).map(([k, label]) => `<div class="cm-row">
        <b title="${esc(label)}">${esc(k)}</b>
        <label class="cm-y">Years<input data-cmk="${esc(k)}" data-cmf="years" inputmode="decimal" autocomplete="off" value="${esc(cm[k].years || '')}"></label>
        <label class="cm-rx">Current treatment<input data-cmk="${esc(k)}" data-cmf="rx" autocomplete="off" value="${esc(cm[k].rx || '')}"></label>
      </div>`).join('');
    return `<h3>Comorbidities</h3>
      <div class="cm-chips">${COMORBIDITIES.map(([k, label]) => `<button type="button" class="chip cm-chip${cm[k]?.on ? ' on' : ''}" data-cm="${esc(k)}" title="${esc(label)}" aria-pressed="${cm[k]?.on ? 'true' : 'false'}">${cm[k]?.on ? '✓ ' : ''}${esc(k)}</button>`).join('')}</div>
      ${rows}
      <label class="cm-other">Other<input data-cmo autocomplete="off" value="${esc(comorbOtherOf(c))}"></label>`;
  }

  // ---- Rounds suggestion pop-up: shown once per patient per session for each new suggestion.
  const sugSeen = new Map(); // case id -> Set of suggestion lines already shown
  function suggestHTML(c) {
    const seen = sugSeen.get(c.id) || new Set();
    const sug = roundSuggestions(c);
    if (!sug.length || sug.every((x) => seen.has(x.line))) return '';
    return `<div class="sug-back" data-sug-case="${c.id}">
      <div class="sug-box card" role="dialog" aria-label="Suggestions">
        <h3>Suggested for ${esc(c.name)}</h3>
        ${sug.map((x) => `<label class="sug-row"><input type="checkbox" data-sug="${esc(x.line)}" checked>
          <span><b>${esc(x.line)}</b><span class="muted small">${esc(x.why)}</span></span></label>`).join('')}
        <div class="form-actions"><button type="button" class="btn primary" data-sug-add>Add selected</button><button type="button" class="btn" data-sug-skip>Not now</button></div>
      </div></div>`;
  }

  // Rounds view: one patient per screen.
  function roundsHTML(W, list) {
    const post = W.kind === 'post';
    if (!list.length) return '<div class="empty">No active pre-op cases.</div>';
    let i = list.findIndex((c) => c.id === W.roundId);
    if (i < 0) i = 0;
    const c = list[i];
    W.roundId = c.id;
    const lines = (t) => Math.max(2, String(t || '').split('\n').length);
    const seg = (field, cur, values) => values.map((v) => `<button type="button" class="seg${cur === v ? ' on' : ''}" data-set="${field}" data-val="${esc(v)}">${esc(v)}</button>`).join('');
    const chips = (box, list2) => list2.map((x) => `<button type="button" class="chip" data-add="${box}" data-text="${esc(x)}">+ ${esc(x)}</button>`).join('');
    const nav = (where) => `<div class="rd-nav rd-${where}">
        <button class="btn rd-btn" data-rd="-1" ${i ? '' : 'disabled'}>‹ Prev</button>
        ${where === 'top' ? `<select id="rd-jump" aria-label="Go to patient">${list.map((x, j) => `<option value="${x.id}"${j === i ? ' selected' : ''}>${j + 1}. ${x.bed ? 'BED ' + esc(x.bed) + ' · ' : ''}${esc(x.name)}</option>`).join('')}</select>` : `<span class="muted small">${i + 1} of ${list.length}</span>`}
        <button class="btn primary rd-btn" data-rd="1" ${i < list.length - 1 ? '' : 'disabled'}>Next ›</button>
      </div>`;
    return `<div class="rounds" data-nbcase="${c.id}">
      ${nav('top')}
      <div class="card rd-card">
        <div class="rd-head">
          <label class="bed-lab rd-bed">Bed<input data-nb="bed" value="${esc(c.bed || '')}" autocomplete="off"></label>
          <div class="rd-who"><div class="rd-name">${esc(c.name)} <span class="muted">${esc(ageSex(c))}</span>${c.status === 'posted' ? ' <span class="tag task">BOT</span>' : ''}</div>
            <div class="muted small">${esc([c.ipNo && 'IP ' + c.ipNo, c.ward && 'Ward ' + c.ward, c.doa && 'DOA ' + fmtDate(c.doa), post && podOf(c) != null && 'POD ' + podOf(c)].filter(Boolean).join(' · '))}</div></div>
          <a class="btn small" href="#/case/${c.id}">e-Case sheet</a>
        </div>
        <div class="rd-dx">${esc(c.diagnosis)}</div>${c.comorbid ? `<div class="rd-cm">K/C/O ${esc(c.comorbid)}</div>` : ''}${post ? (c.procedureDone || c.plan ? `<div class="rd-plan">✓ ${esc(c.procedureDone || c.plan)}</div>` : '') : (c.plan ? `<div class="rd-plan">▸ ${esc(c.plan)}</div>` : '')}
        <div class="rd-sec"><div class="rd-lab">Investigation</div>
          <textarea data-nb="inv" rows="${lines(invTodoText(c))}">${esc(invTodoText(c))}</textarea>
          <div class="rd-chips">${chips('inv', post ? POST_INV_CHIPS : ROUND_INV_CHIPS)}</div></div>
        <div class="rd-sec"><div class="rd-lab">Opinion / To-do</div>
          <textarea data-nb="op" rows="${lines(opTodoText(c))}">${esc(opTodoText(c))}</textarea>
          <div class="rd-chips">${chips('op', post ? POST_OP_CHIPS : ROUND_OP_CHIPS)}</div></div>
        ${post ? '' : `<div class="rd-sec"><div class="rd-lab">Assessment</div><div class="rd-seg">${seg('work.anaes', c.work?.anaes || '', PAC_OPTIONS)}</div></div>`}
        <div class="rd-sec"><div class="rd-lab">Scheme</div><div class="rd-seg">${seg('scheme', c.scheme || '', SCHEMES)}</div></div>
      </div>
      ${nav('bottom')}
      ${suggestHTML(c)}
    </div>`;
  }

  function makeWard(kind) {
  const post = kind === 'post';
  const K = post ? 'wm.postWard' : 'wm.ward'; // per-ward settings on this phone
  const W = {
    live: true,
    kind,
    layout: sessionStorage.getItem(K + 'Layout') || (!post && sessionStorage.getItem('wm.wardDetailed') === '1' ? '1' : '0'), // 0 notebook · 1 detailed · 2 rounds
    get detailed() { return this.layout === '1'; },
    sort: lsGet(K + 'Sort') || 'bed',
    roundId: null,
    render() {
      const list = wardCases(W);
      const work = (c, w) => (workDone(c, w) ? `<td>${esc(workText(c, w))}</td>`
        : !workNeeded(c, w) ? '<td class="muted small">Not needed</td>'
          : `<td class="miss">${esc(workText(c, w) || 'Pending')}</td>`);
      // Notebook: To do's and Assessment / Scheme are edited right here and saved to the case
      // (the e-case sheet and the OT list show the same values).
      const lines = (t) => Math.max(1, String(t || '').split('\n').length);
      const notebook = `
        <table class="board nb-screen nb-edit${W.sort === 'bed' ? ' by-bed' : ''}">
          <thead><tr><th>S.No</th><th>Name</th><th>${post ? 'Diagnosis / procedure' : 'Diagnosis'}</th><th>To do's</th><th>${post ? 'Scheme' : 'Assessment / Scheme'}</th></tr></thead>
          <tbody>
            ${list.map((c, i) => `<tr data-go="${c.id}" data-nbcase="${c.id}" data-q="${esc([c.bed && 'BED ' + c.bed, c.name, c.ipNo, c.ward, c.diagnosis, c.plan].join(' ').toUpperCase())}">
              <td class="nb-sno"><button class="drag-handle" data-drag aria-label="Drag to reorder" title="Drag to reorder">⠿</button><span class="nb-num">${i + 1}</span>${c.status === 'posted' ? '<br><span class="tag task">BOT</span>' : ''}</td>
              <td class="nb-name"><label class="bed-lab">Bed<input data-nb="bed" value="${esc(c.bed || '')}" autocomplete="off"></label><b>${esc(c.name)}</b><div class="muted small">${esc([ageSex(c), c.ipNo, c.ward].filter(Boolean).join(' · '))}</div></td>
              <td class="nb-dx">${esc(c.diagnosis)}${post
                ? `${c.procedureDone || c.plan ? `<div class="muted small">✓ ${esc(c.procedureDone || c.plan)}</div>` : ''}${podOf(c) != null ? `<span class="tag task">POD ${podOf(c)}</span>` : ''}`
                : (c.plan ? `<div class="muted small">▸ ${esc(c.plan)}</div>` : '')}</td>
              <td class="nb-todo-cell">
                <label class="nb-lab">Investigation<textarea data-nb="inv" rows="${lines(invTodoText(c))}">${esc(invTodoText(c))}</textarea></label>
                <label class="nb-lab">Opinion / To-do<textarea data-nb="op" rows="${lines(opTodoText(c))}">${esc(opTodoText(c))}</textarea></label>
              </td>
              <td class="nb-as-cell">
                ${post ? '' : `<label class="nb-lab">Assessment<select data-nb="work.anaes"><option value="">—</option>${opts(PAC_OPTIONS, c.work?.anaes || '')}</select></label>`}
                <label class="nb-lab">Scheme<select data-nb="scheme">${schemeOpts(c.scheme)}</select></label>
              </td>
            </tr>`).join('') || `<tr><td colspan="5" class="empty">${post ? 'No post-op cases yet.' : 'No active pre-op cases.'}</td></tr>`}
          </tbody>
        </table>`;
      const detailed = `
        <table class="board detail">
          <thead>
            <tr>
              <th rowspan="2">Patient</th><th rowspan="2">Diagnosis / Plan</th>
              ${LAB_GROUPS.map((g) => `<th colspan="${g.params.length}" class="grp-h">${esc(g.k === 'inflam' ? 'ESR / qCRP' : g.label)}</th>`).join('')}
              <th rowspan="2">Other</th>
              ${WORKUP.map((w) => `<th rowspan="2">${esc(w.label)}</th>`).join('')}
              <th rowspan="2">Opinions</th><th rowspan="2">Pending works</th>
            </tr>
            <tr>${ALL_PARAMS.map((p) => `<th class="ph">${esc(p.label)}${p.unit ? `<span>${esc(p.unit)}</span>` : ''}</th>`).join('')}</tr>
          </thead>
          <tbody>
            ${list.map((c) => `<tr data-go="${c.id}">
              <td><b>${esc(c.name)}</b><div class="muted small">${esc(metaLine(c))}</div></td>
              <td>${esc(c.diagnosis)}<div class="muted small">▸ ${esc(c.plan)}</div></td>
              ${ALL_PARAMS.map((p) => paramCell(c, p)).join('')}
              <td>${customParams(c).map((p) => {
                const l = latest(c, p.k);
                return l ? `<div>${esc(p.label)} ${flagged(fmtVal(l.value, p), flagOf(l.value, p))}</div>` : `<div class="miss">${esc(p.label)} –</div>`;
              }).join('')}</td>
              ${WORKUP.map((w) => work(c, w)).join('')}
              <td>${listOf(c.opinions).map((o) => `<div class="${hasText(o.note) ? '' : 'miss'}">${esc(o.dept)}${hasText(o.note) ? ': ' + esc(o.note) : ''}</div>`).join('')}</td>
              <td>${listOf(c.tasks).filter((t) => !t.done).map((t) => `<div>• ${esc(t.text)}</div>`).join('')}</td>
            </tr>`).join('') || `<tr><td colspan="${ALL_PARAMS.length + WORKUP.length + 5}" class="empty">No active pre-op cases.</td></tr>`}
          </tbody>
        </table>`;
      // Rounds mode: the whole screen, one patient at a time (app header and ward page hidden).
      if (W.layout === '2') {
        const enter = W.entering;
        W.entering = null;
        return `<div class="rm-wrap${enter ? ' rm-enter' : ''}"${enter ? ` style="--rx:${enter.x}px;--ry:${enter.y}px"` : ''}>
          <div class="rm-bar"><div class="rm-title"><b>Rounds · ${post ? 'Post-op' : 'Pre-op'} ward</b><div class="muted small">${fmtDate(todayISO())} · ${list.length} patient${list.length === 1 ? '' : 's'}</div></div>
            <button class="btn" data-exit-rounds>✕ Exit rounds</button></div>
          ${roundsHTML(W, list)}
        </div>`;
      }
      return `
        <div class="toolbar ward-tools">
          <h2>${post ? 'Post-op ward' : 'Pre-op ward'} <span class="muted small">${fmtDate(todayISO())}</span></h2>
          <button class="btn primary" data-layout="2">▶ Rounds mode</button>
          <button class="btn" id="print-ward">Print / PDF</button>
        </div>
        <div class="row wa-row">
          <button class="btn small wa" id="wa-ward">WhatsApp: ward status (PDF)</button>
          <button class="btn small wa" id="wa-pending">WhatsApp: pending works (PDF)</button>
        </div>
        <label class="search-lab nb-search">Search<input type="search" id="nb-q" aria-label="Search name, IP, ward, diagnosis" value="${esc(W.q || '')}"></label>
        <div class="chips">
          <button class="chip ${W.layout === '0' ? 'on' : ''}" data-layout="0">Notebook</button>
          <button class="chip ${W.layout === '1' ? 'on' : ''}" data-layout="1">Detailed</button>
        </div>
        <div class="order-bar">
          <span class="muted small">Order</span>
          <button class="chip ${W.sort === 'bed' ? 'on' : ''}" data-wsort="bed">By bed</button>
          <button class="chip ${W.sort !== 'bed' ? 'on' : ''}" data-wsort="list">List order</button>
          <span class="muted small">${W.sort === 'bed' ? 'Type each patient’s bed number once — cases without one go to the end.' : `Hold ⠿ and drag a row to reorder · ${Store.meta.caseOrder?.length ? 'your own order (same as the e-case sheet and OT list)' : 'earliest admitted first'}`}</span>
          ${W.sort !== 'bed' && Store.meta.caseOrder?.length ? '<button class="btn small" id="nb-order-reset">Back to DOA order</button>' : ''}
        </div>
        <div class="table-wrap">${W.detailed ? detailed : notebook}</div>
        <details class="help" data-keep="ward-help"><summary>How this page works</summary><p class="muted small">Tap a name or diagnosis to open the case. BOT = posted for OT. In the notebook, type straight into the boxes: <b>Investigation</b> (what to send or repeat) and <b>Opinion / To-do</b> — one per line; a line with “OPINION” or a department name becomes an opinion on the e-case sheet, any other line a pending work; delete a line once it’s done. Assessment and scheme are the same as on the e-case sheet and OT list. Red bold = outside the normal range. Detailed shows the most recent value of each investigation (hover or long-press for its date). Any empty investigation except ESR, qCRP and pus C/S counts as pending.</p></details>`;
    },
    mount(el) {
      document.body.classList.toggle('rounds-mode', W.layout === '2');
      const exitRounds = () => {
        W.layout = W.prevLayout || '0';
        sessionStorage.setItem(K + 'Layout', W.layout);
        document.body.classList.remove('rounds-mode');
        if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
        render();
        window.scrollTo(0, 0);
      };
      const xr = $('[data-exit-rounds]', el);
      if (xr) xr.onclick = exitRounds;
      // The entry animation leaves nothing behind (no clip / transform once it has played).
      const ent = $('.rm-enter', el);
      if (ent) setTimeout(() => ent.classList.remove('rm-enter'), 1500);
      // Esc on a computer leaves rounds (not while typing in a box).
      W.offEsc?.();
      W.offEsc = null;
      if (W.layout === '2') {
        const onKey = (e) => { if (e.key === 'Escape' && !e.target.closest?.('textarea, input, select')) exitRounds(); };
        document.addEventListener('keydown', onKey);
        W.offEsc = () => document.removeEventListener('keydown', onKey);
      }
      const pw = $('#print-ward', el);
      // Phones: the notebook as a PDF file (window.print is unreliable there).
      if (pw) pw.onclick = () => (PhonePdf.isPhone() ? SharePdf.ward(wardCases(W), Store.meta, post) : Print.wardBoard(wardCases(W), Store.meta, post ? 'POST-OP WARD' : 'PRE-OP WARD'));
      // Sent as PDF files (share sheet → WhatsApp). Built straight from the tap, as Safari requires.
      const waW = $('#wa-ward', el);
      if (waW) waW.onclick = () => SharePdf.ward(wardCases(W), Store.meta, post);
      const waP = $('#wa-pending', el);
      if (waP) waP.onclick = () => SharePdf.pending(wardCases(W), Store.meta, post);
      // Rounds: go to the previous / next patient (saving the box being typed in first).
      const goRound = (id) => {
        document.activeElement?.blur?.();
        W.roundId = id;
        render();
        window.scrollTo(0, 0);
      };
      const step = (dir) => {
        const ids = wardCases(W).map((c) => c.id);
        const j = ids.indexOf(W.roundId) + dir;
        if (j >= 0 && j < ids.length) goRound(ids[j]);
      };
      const jump = $('#rd-jump', el);
      if (jump) jump.onchange = () => goRound(jump.value);
      const card = $('.rd-card', el);
      if (card) {
        let sx = null;
        let sy = 0;
        card.addEventListener('touchstart', (e) => {
          if (e.target.closest('textarea, input, select')) { sx = null; return; }
          sx = e.touches[0].clientX; sy = e.touches[0].clientY;
        }, { passive: true });
        card.addEventListener('touchend', (e) => {
          if (sx == null) return;
          const dx = e.changedTouches[0].clientX - sx;
          const dy = e.changedTouches[0].clientY - sy;
          sx = null;
          if (Math.abs(dx) > 70 && Math.abs(dy) < 60) step(dx < 0 ? 1 : -1); // swipe left = next
        });
      }
      el.addEventListener('click', (e) => {
        const l = e.target.closest('[data-layout]');
        if (l) {
          if (l.dataset.layout === '2') {
            // Entering rounds: remember the table to come back to, and ask for true full screen
            // (computers / Android; the iPhone home-screen app is full screen already).
            W.prevLayout = W.layout === '2' ? '0' : W.layout;
            const r = l.getBoundingClientRect();
            W.entering = { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
            document.documentElement.requestFullscreen?.().catch(() => {});
          }
          W.layout = l.dataset.layout;
          sessionStorage.setItem(K + 'Layout', W.layout);
          render();
          return window.scrollTo(0, 0);
        }
        const ws = e.target.closest('[data-wsort]');
        if (ws) {
          W.sort = ws.dataset.wsort;
          lsSet(K + 'Sort', W.sort);
          return render();
        }
        const rd = e.target.closest('[data-rd]');
        if (rd) return step(+rd.dataset.rd);
        const sb = e.target.closest('[data-sug-add],[data-sug-skip]');
        if (sb) {
          const back = sb.closest('[data-sug-case]');
          const cid = back.dataset.sugCase;
          const all = $$('[data-sug]', back);
          sugSeen.set(cid, new Set([...(sugSeen.get(cid) || []), ...all.map((x) => x.dataset.sug)]));
          const pick = sb.dataset.sugAdd !== undefined ? all.filter((x) => x.checked).map((x) => x.dataset.sug) : [];
          back.remove();
          if (pick.length) {
            const box = $('.rounds textarea[data-nb="op"]', el);
            const have = box.value.split('\n').map((x) => x.trim().toUpperCase());
            const add2 = pick.filter((x) => !have.includes(x));
            if (add2.length) box.value = [box.value.trim(), ...add2].filter(Boolean).join('\n');
            box.dispatchEvent(new Event('input', { bubbles: true }));
            box.dispatchEvent(new Event('change', { bubbles: true }));
            toast(`Added ${pick.length} to Opinion / To-do`);
          }
          return;
        }
        // Quick-tap chip: add the line to the box and save it.
        const add = e.target.closest('[data-add]');
        if (add) {
          const box = $(`.rounds textarea[data-nb="${add.dataset.add}"]`, el);
          const have = box.value.split('\n').map((x) => x.trim().toUpperCase());
          if (!have.includes(add.dataset.text)) box.value = (box.value.trim() ? box.value.trim() + '\n' : '') + add.dataset.text;
          box.dispatchEvent(new Event('input', { bubbles: true }));
          box.dispatchEvent(new Event('change', { bubbles: true }));
          return;
        }
        // Assessment / scheme buttons (tap again to clear).
        const set = e.target.closest('[data-set]');
        if (set) {
          const id = set.closest('[data-nbcase]').dataset.nbcase;
          const cur = set.dataset.set === 'scheme' ? Store.cases[id].scheme : Store.cases[id].work?.anaes;
          Store.patch('cases', id, { [set.dataset.set]: cur === set.dataset.val ? '' : set.dataset.val });
          return;
        }
        // Opening the case from the row, but not while using a box or dropdown in it.
        if (e.target.closest('textarea, input, select, label, button')) return;
        const tr = e.target.closest('[data-go]');
        if (tr) location.hash = '#/case/' + tr.dataset.go;
      });
      // Drag to reorder (finger or mouse): hold the ⠿ handle and move the row up or down.
      el.addEventListener('pointerdown', (e) => {
        const h = e.target.closest('[data-drag]');
        if (!h) return;
        e.preventDefault();
        const row = h.closest('tr');
        const tbody = row.parentElement;
        document.body.classList.add('dragging');
        row.classList.add('drag-row');
        const before = $$('tr[data-nbcase]', tbody).filter((r) => !r.hidden).map((r) => r.dataset.nbcase);
        const move = (ev) => {
          const y = ev.clientY;
          const rows = $$('tr[data-nbcase]', tbody).filter((r) => !r.hidden && r !== row);
          const next = rows.find((r) => { const b = r.getBoundingClientRect(); return y < b.top + b.height / 2; });
          if (next) { if (row.nextElementSibling !== next) tbody.insertBefore(row, next); } else if (tbody.lastElementChild !== row) tbody.appendChild(row);
          // keep the page scrolling while dragging near the top/bottom edge
          if (y < 70) window.scrollBy(0, -12); else if (y > window.innerHeight - 70) window.scrollBy(0, 12);
        };
        const end = () => {
          window.removeEventListener('pointermove', move);
          window.removeEventListener('pointerup', end);
          window.removeEventListener('pointercancel', end);
          row.classList.remove('drag-row');
          document.body.classList.remove('dragging');
          const after = $$('tr[data-nbcase]', tbody).filter((r) => !r.hidden).map((r) => r.dataset.nbcase);
          if (after.join() !== before.join()) {
            setShownOrder(after);
            toast('Order saved');
          }
          render();
        };
        // on the window, not the handle: moving the row in the page would drop a pointer capture
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', end);
        window.addEventListener('pointercancel', end);
      });
      // Boxes grow with what's typed (no scrolling inside a small box on rounds).
      const fit = (ta) => { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 2 + 'px'; };
      $$('.nb-edit textarea, .rounds textarea', el).forEach(fit);
      el.addEventListener('input', (e) => { if (e.target.matches('.nb-edit textarea, .rounds textarea')) fit(e.target); });
      // Search: hide rows that don't match (no re-render, so typing isn't interrupted).
      const filter = () => {
        const q = String(W.q || '').trim().toUpperCase();
        $$('tbody tr[data-q]', el).forEach((tr) => { tr.hidden = !!q && !tr.dataset.q.includes(q); });
      };
      $('#nb-q', el)?.addEventListener('input', (e) => { W.q = e.target.value; filter(); });
      const nbReset = $('#nb-order-reset', el);
      if (nbReset) nbReset.onclick = () => { Store.setMeta({ caseOrder: [] }); toast('Back to date-of-admission order'); };
      filter();
      el.addEventListener('change', (e) => {
        const t = e.target;
        const id = t.closest('[data-nbcase]')?.dataset.nbcase;
        const f = t.dataset.nb;
        if (!id || !f || !Store.cases[id]) return;
        const c = { id, ...Store.cases[id] };
        if (f === 'inv') Store.patch('cases', id, { invTodo: t.value.trim().toUpperCase() });
        else if (f === 'bed') Store.patch('cases', id, { bed: t.value.trim().toUpperCase() });
        else if (f === 'op') {
          const ch = opTodoChanges(c, t.value, Store.who());
          if (Object.keys(ch).length) Store.patch('cases', id, ch);
        } else Store.patch('cases', id, { [f]: t.value });
      });
    },
  };
  return W;
  }
  const Ward = makeWard('pre');
  const PostWard = makeWard('post');


  // ---------------------------------------------------------------- Transfer-out tabs (Plastic, Neurosurgery)
  function TransferTab(dept) {
    const D = TRANSFER_DEPTS[dept];
    const T = deptSay(dept);
    return {
      live: true,
      render() {
        const out = caseList().filter((c) => c.status === dept).sort((a, b) => (a[dept]?.at || 0) - (b[dept]?.at || 0));
        // Came back in the last 14 days (now in the pre-op ward).
        const back = caseList().flatMap((c) => listOf(c[dept + 'Log']).filter((l) => l.in && daysSince(l.in) <= 14).map((l) => ({ c, l })))
          .sort((a, b) => (b.l.inAt || 0) - (a.l.inAt || 0));
        const row = (c) => {
          const p = c[dept] || {};
          const d = p.out ? daysSince(p.out) : null;
          return `<div class="card pl-row">
            <div class="pl-main">
              <div><b>${esc(c.name)}</b> <span class="muted">${esc(ageSex(c))}${c.ipNo ? ' · IP ' + esc(c.ipNo) : ''}${c.bed ? ' · Bed ' + esc(c.bed) : ''}</span></div>
              <div class="small">${esc(c.diagnosis) || '—'}</div>
              ${c.procedureDone ? `<div class="small muted">Done: ${esc(c.procedureDone)}</div>` : ''}
              <div class="muted small">From the ${esc(p.from === 'postop' ? 'post-op' : 'pre-op')} ward · ${esc(T.outWord)} ${esc(fmtDate(p.out))}${d != null ? ` · <b>day ${d}</b>` : ''}${p.by ? ' · by ' + esc(p.by) : ''}</div>
            </div>
            <span class="pl-acts"><a class="btn small" href="#/case/${c.id}">e-Case sheet</a><button class="btn small primary" data-back-in="${c.id}">${esc(T.backBtn)}</button></span>
          </div>`;
        };
        return `
          <p class="small"><a href="#/">← e-Case Sheet</a></p>
          <div class="toolbar"><h2>${esc(D.tab)} <span class="pill">${out.length}</span></h2></div>
          <p class="muted small">${esc(T.intro)} <b>${esc(T.backBtn)}</b> puts the case in the pre-op ward.
            ${T.howTo}</p>
          ${out.map(row).join('') || `<div class="empty">${esc(T.empty)}</div>`}
          ${back.length ? `<h3 class="pl-back-h">${esc(T.backH)}</h3>
            <div class="card">${back.map(({ c, l }) => `<div class="pl-done"><a href="#/case/${c.id}"><b>${esc(c.name)}</b></a> <span class="muted small">${esc(ageSex(c))}</span>
              <div class="muted small">${esc(T.outWord[0].toUpperCase() + T.outWord.slice(1))} ${esc(fmtDate(l.out))} → ${TRANSFER_DEPTS[l.to] ? esc(deptSay(l.to).movedTo) : 'back to the pre-op ward'} ${esc(fmtDate(l.in))} (${Math.max(0, daysSince(l.out) - daysSince(l.in))} day(s) ${esc(T.spent)})</div></div>`).join('')}</div>` : ''}`;
      },
      mount(el) {
        el.addEventListener('click', (e) => {
          const b = e.target.closest('[data-back-in]');
          if (b) askBack(b.dataset.backIn);
        });
      },
    };
  }
  const TransferTabs = Object.fromEntries(Object.keys(TRANSFER_DEPTS).map((k) => [k, TransferTab(k)]));

  // ---------------------------------------------------------------- Case form
  // `deckDate`: opened from the admission day PPT — preset the DOA and go back there after saving.
  function CaseForm(id, deckDate) {
    return {
      live: false,
      render() {
        const c = id ? Store.cases[id] : { doa: deckDate || todayISO() };
        if (!c) return notFound();
        return `
          <h2>${id ? 'Edit case' : 'New case'}${deckDate ? ` <span class="muted small">for the admission day PPT of ${esc(fmtDate(deckDate))}</span>` : ''}</h2>
          <nav class="chips jump" aria-label="Sections">
            <a class="chip" href="#sec-patient" data-jump>Patient</a>
            <a class="chip" href="#sec-plan" data-jump>Diagnosis & plan</a>
            <a class="chip on" href="#sec-inv" data-jump>Investigations</a>
            ${id ? '' : '<a class="chip" href="#sec-img" data-jump>Images</a>'}
          </nav>
          <form id="case-form" class="form" autocomplete="off">
            <fieldset class="card" id="sec-patient"><legend>Patient</legend>
              <label class="span2">Name<input name="name" required value="${esc(c.name)}"></label>
              <label>Age<input name="age" inputmode="numeric" value="${esc(c.age)}"></label>
              <label>Sex<select name="sex">${opts([['', '—'], ['M', 'Male'], ['F', 'Female'], ['O', 'Other']], c.sex || '')}</select></label>
              <label>IP number<input name="ipNo" value="${esc(c.ipNo)}"></label>
              <label>Ward<input name="ward" value="${esc(c.ward)}"></label>
              <label>Bed<input name="bed" value="${esc(c.bed)}" autocomplete="off"></label>
              <label>Date of admission<input type="date" name="doa" value="${esc(c.doa)}"></label>
              <label>Attender<input name="attender" value="${esc(c.attender)}"></label>
              <label>Phone<input name="phone" type="tel" value="${esc(c.phone)}"></label>
              <label>Address<input name="address" value="${esc(c.address)}"></label>
            </fieldset>
 <fieldset class="card" id="sec-plan"><legend>Diagnosis & plan</legend>
              <label class="span2">Diagnosis<textarea name="diagnosis" rows="2">${esc(c.diagnosis)}</textarea></label>
              <label class="span2">Plan (proposed surgery)<textarea name="plan" rows="2">${esc(c.plan)}</textarea></label>
              <label>Level<select name="level">${levelOpts(c.level)}</select><span class="hint" id="level-hint"></span></label>
              <label>Scheme status<select name="scheme">${schemeOpts(c.scheme)}</select></label>
              ${id && comorbOn(c).length
                ? `<label class="span2">Comorbidities <span class="hint">edit them on the Comorbidities card of the e-case sheet</span><input name="comorbid" value="${esc(c.comorbid)}" readonly></label>`
                : `<label class="span2">Comorbidities<input name="comorbid" value="${esc(c.comorbid)}"></label>`}
              <label>Mode<input name="mode" list="dl-mode" value="${esc(c.mode)}"></label>
              <label>Case sheet written by<input name="writtenBy" list="dl-pg" value="${esc(c.writtenBy || '')}"></label>
              <label class="span2">Treatment given <span class="hint">for the admission deck — one item per line</span><textarea name="treatment" rows="3">${esc(id ? c.treatment : (c.treatment ?? STANDARD_TREATMENT.join('\n')))}</textarea></label>
              <label class="span2">Implants
                <textarea name="implants" rows="2">${esc(c.implants)}</textarea>
                <span class="hint" id="impl-hint"></span>
              </label>
              <div class="span2"><button type="button" class="btn small" id="impl-fill">↻ Fill implants & level from database</button></div>
            </fieldset>
            ${id ? `
            <fieldset class="card" id="sec-inv"><legend>Investigations</legend>
              <p class="span2 muted">Blood investigations are entered as dated sets on the case page.</p>
              <div class="span2"><button type="button" class="btn primary" id="edit-labs">+ Enter / repeat investigations</button></div>
            </fieldset>` : `
            <fieldset class="card block-fs" id="sec-inv"><legend>Investigations</legend>
              <div class="span2">${labFormHTML(c)}</div>
              <label>Pus C/S — organism<input name="pusOrganism" class="italic"></label>
              <label>Sensitive to<input name="pusSensitive"></label>
              <div class="span2">${workupHTML({}, true)}</div>
            </fieldset>
            <fieldset class="card" id="sec-img"><legend>Radiographs & wound pictures</legend>
              <p class="span2 muted small">Uploaded once here — they appear on the case page, in the OT list viewer and in the PowerPoints.</p>
              <div class="span2 img-adders">${ADD_CASE_KINDS.map((k) => `<label class="btn small">+ ${esc(k.label)}<input type="file" accept="image/*" multiple data-pending="${k.k}" hidden></label>`).join('')}</div>
              <div class="span2 pending-imgs" id="pending-imgs"></div>
            </fieldset>
`}
            <div class="form-actions">
              <button class="btn primary" type="submit">${id ? 'Save' : 'Add case'}</button>
              <a class="btn" href="${id ? '#/case/' + id : deckDate ? '#/deck' : '#/'}">Cancel</a>
              ${id ? '<button class="btn danger right" type="button" id="del">Delete case</button>' : ''}
            </div>
          </form>
          ${datalist('dl-mode', MODES)}${datalist('dl-pg', Store.meta.pgs || [])}`;
      },
      mount(el) {
        const f = $('#case-form', el);
        if (!f) return;
        if (!id) bindLabForm(f, {});
        // In-page jumps (the URL hash is the router, so scroll instead of navigating).
        $$('[data-jump]', el).forEach((a) => {
          a.onclick = (e) => {
            e.preventDefault();
            $(a.getAttribute('href'), el)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          };
        });
        const el2 = $('#edit-labs', el);
        if (el2) el2.onclick = () => openLabModal(id);
        // Implants follow the plan until someone edits them by hand.
        const auto = ['implants', 'level'];
        const touched = Object.fromEntries(auto.map((k) => [k, !!f.elements[k].value.trim()]));
        auto.forEach((k) => ['input', 'change'].forEach((ev) => f.elements[k].addEventListener(ev, () => { touched[k] = true; })));
        const hint = () => {
          const plan = f.elements.plan.value;
          const sug = suggestImplantsFor(plan, f.elements.diagnosis.value, Store.implants);
          const lv = levelFor(plan, Store.levels);
          $('#impl-hint', el).textContent = sug.source === 'history'
            ? `From your OT list of ${fmtDate(sug.entry.date)}: ${sug.entry.dx} — ${sug.entry.plan}`
            : sug.source === 'list' ? 'From the reference implant list: ' + sug.matches.map((r) => r.name).join(', ')
              : (plan.trim() ? 'No match in your previous OT lists or the reference list — type the implants.' : '');
          $('#level-hint', el).textContent = lv.rule ? `Level ${lv.level}: ${lv.rule.name}` : (plan.trim() ? 'No level match — pick it manually.' : '');
        };
        const fill = (force) => {
          const plan = f.elements.plan.value;
          const sug = { implants: suggestImplantsFor(plan, f.elements.diagnosis.value, Store.implants).implants, level: levelFor(plan, Store.levels).level };
          auto.forEach((k) => { if (force || !touched[k]) f.elements[k].value = sug[k]; });
        };
        let planTouched = !!f.elements.plan.value.trim();
        f.elements.plan.addEventListener('input', () => { planTouched = true; });
        ['plan', 'diagnosis'].forEach((k) => f.elements[k].addEventListener('input', () => {
          if (k === 'diagnosis' && !planTouched) f.elements.plan.value = defaultPlanFor(f.elements.diagnosis.value);
          hint();
          fill(false);
        }));
        $('#impl-fill', el).onclick = () => fill(true);
        hint();

        const BASIC = ['name', 'age', 'sex', 'ipNo', 'ward', 'bed', 'doa', 'attender', 'phone', 'address', 'diagnosis', 'plan', 'level', 'scheme', 'comorbid', 'implants', 'mode', 'treatment', 'writtenBy'];

        // Images picked before the case exists are held here and saved with it.
        const pending = [];
        const drawPending = () => {
          const box = $('#pending-imgs', el);
          if (!box) return;
          box.innerHTML = pending.map((p, i) => `<div class="pthumb"><img src="${p.data}" alt=""><span>${esc(imageKind(p.kind).label)}</span><button type="button" class="icon" data-unpend="${i}" title="Remove">✕</button></div>`).join('');
        };
        f.addEventListener('change', async (e) => {
          const kind = e.target.dataset.pending;
          if (!kind) return;
          const files = [...e.target.files];
          e.target.value = '';
          for (const file of files) {
            try {
              pending.push({ kind, data: await compressImage(file), name: file.name.replace(/\.[^.]+$/, '') });
            } catch {
              toast(`"${file.name}" couldn't be opened as an image. Use JPG or PNG (on iPhone: Settings → Camera → Formats → Most Compatible).`, 5000);
            }
          }
          drawPending();
        });
        f.addEventListener('click', (e) => {
          const b = e.target.closest('[data-unpend]');
          if (!b) return;
          pending.splice(+b.dataset.unpend, 1);
          drawPending();
        });
        const rememberPg = (name) => {
          name = (name || '').trim().toUpperCase();
          if (!name) return;
          const pgs = [name, ...(Store.meta.pgs || []).filter((x) => x !== name)].slice(0, 15);
          Store.setMeta({ pgs, lastPg: name });
        };
        f.onsubmit = async (e) => {
          e.preventDefault();
          const data = Object.fromEntries(BASIC.map((k) => [k, f.elements[k].value.trim()]));
          rememberPg(data.writtenBy);
          if (id) {
            const before = Store.cases[id];
            const changed = BASIC.filter((k) => (before[k] || '') !== data[k]);
            if (changed.length) Store.patch('cases', id, Object.fromEntries(changed.map((k) => [k, data[k]])));
            location.hash = '#/case/' + id;
            return;
          }
          const nid = uid();
          const work = {
            ecg: f.elements.w_ecg.checked ? 'Taken' : '',
            echo: f.elements.w_echo.value.trim(),
            anaes: f.elements.w_anaes.value,
            anaesPending: f.elements.w_anaes.value && f.elements.w_anaes.value !== 'Assessed' ? f.elements.w_anaesPending.value.trim() : '',
          };
          const doc = { ...data, status: 'preop', work, pus: { organism: f.elements.pusOrganism.value.trim(), sensitive: f.elements.pusSensitive.value.trim() } };
          for (const [path, val] of Object.entries(readLabForm(f) || {})) setPath(doc, path, val);
          Store.create('cases', nid, doc);
          if (pending.length) {
            toast(`Saving ${pending.length} image(s)…`, 8000);
            for (const p of pending) await Store.addImage(nid, p.kind, p.data, p.name);
            toast('Saved');
          }
          if (deckDate) {
            Deck.date = f.elements.doa.value || deckDate;
            location.hash = '#/deck';
            return;
          }
          location.hash = '#/case/' + nid;
        };
        const del = $('#del', el);
        if (del) {
          del.onclick = () => {
            if (!confirm('Delete this case permanently? This removes it for everyone.')) return;
            Object.keys(Store.cases[id].images || {}).forEach((img) => Store.deleteImage(id, img));
            Store.remove('cases', id);
            location.hash = '#/';
          };
        }
      },
    };
  }

  // ---------------------------------------------------------------- Case detail
  // Every value is typed straight into the table: change a box and it saves when you
  // leave it (empty = no value). Abnormal values go red with ↑ / ↓ as you type.
  function flowCell(p, v) {
    const f = flagOf(v, p);
    const shown = p.scale && hasText(v) ? fmtVal(v, { ...p, unit: '' }) : '';
    return `data-mark="${esc(FLAG_MARK[f].trim())}" class="v${f ? ' flag' : ''}"`
      // the full count under shorthand (PLT 2.4 → 2,40,000), not when it would only add commas
      + ` title="${esc(hasText(v) ? fmtVal(v, p) : '')}" data-fv="${esc(shown.replace(/,/g, '') !== String(v ?? '').trim().replace(/,/g, '') ? shown : '')}"`;
  }
  function flowsheetHTML(c) {
    const sets = labSets(c);
    if (!sets.length) return '<div class="muted">No investigations entered yet. Tap <b>+ Column</b> to type them into the table, or use the button above.</div>';
    const row = (p, optional) => {
      const missing = !optional && !latest(c, p.k);
      return `<tr class="${missing ? 'missing' : ''}" data-row="${p.k}">
        <td class="pn">${esc(p.label)}${missing ? ' <span class="tag inv">pending</span>' : ''}<span class="rng">${esc(p.range)}${p.unit ? ' ' + esc(p.unit) : ''}</span></td>
        ${sets.map((s) => {
          const v = s.v?.[p.k] ?? '';
          const aria = `${p.label} ${fmtDate(s.date)}`;
          const field = p.options
            ? `<select class="flow-in" data-lab="${s.id}" data-lk="${p.k}" aria-label="${esc(aria)}"><option value=""></option>${opts(hasText(v) && !p.options.includes(v) ? [...p.options, v] : p.options, v)}</select>`
            : `<input class="flow-in" data-lab="${s.id}" data-lk="${p.k}" value="${esc(v)}" inputmode="decimal" autocomplete="off" data-nocaps aria-label="${esc(aria)}">`;
          return `<td ${flowCell(p, v)}>${field}</td>`;
        }).join('')}
      </tr>`;
    };
    const cols = sets.length + 2;
    const customs = customParams(c);
    return `
      <div class="table-wrap">
        <table class="flow">
          <thead><tr><th>Investigation <span class="rng">normal range</span></th>${sets.map((s) => `<th class="d">
            <input type="date" class="flow-date" data-lab-date="${s.id}" value="${esc(s.date || '')}" aria-label="Date of these investigations">
            <span class="set-acts"><button class="icon" data-edit-set="${s.id}" title="Edit in the form (photo of report, other investigations)">✎</button><button class="icon" data-del-set="${s.id}" title="Delete this column">✕</button></span></th>`).join('')}
            <th class="d add-col"><button class="icon" data-add-col title="Add a column for today">+ Column</button></th></tr></thead>
          <tbody>
            ${LAB_GROUPS.map((g) => `<tr class="grp"><th colspan="${cols}">${esc(g.long || g.label)}${g.optional ? ' <span class="muted">(if needed)</span>' : ''}</th></tr>${g.params.map((p) => row(p, g.optional)).join('')}`).join('')}
            ${customs.length ? `<tr class="grp"><th colspan="${cols}">Other</th></tr>${customs.map((p) => row(p)).join('')}` : ''}
          </tbody>
        </table>
      </div>`;
  }

  // ---------------------------------------------------------------- Charts
  function chartHTML(c, chId) {
    const ch = c.charts[chId];
    const cols = ch.cols || [];
    const rows = chartRows(c, ch);
    const editing = Charts.editing[chId];
    const editRow = editing ? ch.rows?.[editing] : null;
    const input = (col) => {
      const v = editRow?.v?.[col.k] ?? '';
      const f = col.text ? '' : flagOf(v, col);
      return `<label class="${col.text ? 'wide' : ''}">${esc(col.label)}${col.unit ? ` <span class="muted">${esc(col.unit)}</span>` : ''}
        <input data-cin="${col.k}" value="${esc(v)}" class="${f ? 'is-flag' : ''}" ${col.text ? '' : 'inputmode="decimal"'}></label>`;
    };
    return `
      <div class="chart" data-chart="${chId}">
        <div class="row-between chart-head">
          <h4>${esc(ch.title)}</h4>
          <span class="chart-acts">
            <button class="btn small" data-chart-print="${chId}">Print / PDF</button>
            <button class="icon" data-chart-del="${chId}" title="Delete chart">✕</button>
          </span>
        </div>
        <div class="table-wrap">
          <table class="flow chart-table">
            <thead><tr><th>Date</th><th>Time</th>${cols.map((col) => `<th class="d">${esc(col.label)}${col.unit ? `<span class="rng">${esc(col.unit)}</span>` : ''}${col.range ? `<span class="rng">${esc(col.range)}</span>` : ''}</th>`).join('')}<th></th></tr></thead>
            <tbody>
              ${rows.map((r) => `<tr class="${r.src === 'inv' ? 'from-inv' : ''}${editing === r.id ? ' editing' : ''}">
                <td class="nowrap">${esc(fmtDate(r.date))}</td><td class="nowrap">${esc(r.time || '')}</td>
                ${cols.map((col) => {
                  const v = r.v?.[col.k];
                  const f = col.text ? '' : flagOf(v, col);
                  return `<td class="${col.text ? 'txt' : 'v'}${f ? ' flag' : ''}">${hasText(v) ? esc(col.text ? v : fmtVal(v, { ...col, unit: '' })) + FLAG_MARK[f] : ''}</td>`;
                }).join('')}
                <td class="nowrap">${r.src === 'inv' ? '<span class="muted small" title="Entered under Investigations">Inv.</span>' : `<button class="icon" data-row-edit="${r.id}" title="Edit">✎</button><button class="icon" data-row-del="${r.id}" title="Delete">✕</button>`}</td>
              </tr>`).join('') || `<tr><td colspan="${cols.length + 3}" class="muted small">No entries yet — add the first below.</td></tr>`}
            </tbody>
          </table>
        </div>
        <div class="chart-form${editing ? ' editing' : ''}">
          <label>Date<input type="date" data-cin="_date" value="${esc(editRow?.date || todayISO())}"></label>
          <label>Time<input type="time" data-cin="_time" value="${esc(editRow?.time || '')}"></label>
          ${cols.map(input).join('')}
          <div class="chart-form-acts">
            <button class="btn small primary" data-row-save>${editing ? 'Update entry' : 'Add entry'}</button>
            ${editing ? '<button class="btn small" data-row-cancel>Cancel</button>' : ''}
          </div>
        </div>
      </div>`;
  }

  const Charts = { editing: {} };

  function openCustomChartModal(caseId) {
    const m = $('#modal');
    const colRow = () => `<div class="custom-row cc-row">
      <label class="mini-lab">Column<input data-cc="label"></label>
      <label class="mini-lab">Unit<input data-cc="unit"></label>
      <label class="mini-lab">Normal range<input data-cc="range"></label>
      <label class="small nowrap"><input type="checkbox" data-cc="text"> text</label>
      <button type="button" class="icon" data-rm-custom title="Remove">✕</button>
    </div>`;
    m.innerHTML = `
      <form class="sheet card form" id="chart-modal" autocomplete="off">
        <div class="row-between"><h3>New chart</h3><button type="button" class="icon" data-close>✕</button></div>
        <label>Chart name<input name="title" required></label>
        <p class="muted small">Columns to record each time. Tick “text” for words rather than numbers.</p>
        <div class="cc-cols">${colRow()}${colRow()}</div>
        <button type="button" class="btn small" data-add-col>+ Add column</button>
        <div class="form-actions"><button class="btn primary">Create chart</button><button type="button" class="btn" data-close>Cancel</button></div>
      </form>`;
    m.hidden = false;
    m.classList.add('sheet-wrap');
    const f = $('#chart-modal', m);
    const close = () => {
      m.hidden = true;
      m.classList.remove('sheet-wrap');
      m.innerHTML = '';
    };
    m.onclick = (e) => {
      if (e.target === m || e.target.closest('[data-close]')) return close();
      if (e.target.closest('[data-add-col]')) $('.cc-cols', f).insertAdjacentHTML('beforeend', colRow());
      const rm = e.target.closest('[data-rm-custom]');
      if (rm) rm.closest('.cc-row').remove();
    };
    f.onsubmit = (e) => {
      e.preventDefault();
      const cols = $$('.cc-row', f).map((r) => ({
        k: 'c_' + uid(),
        label: $('[data-cc=label]', r).value.trim(),
        unit: $('[data-cc=unit]', r).value.trim(),
        range: $('[data-cc=range]', r).value.trim(),
        ...($('[data-cc=text]', r).checked ? { text: true } : {}),
      })).filter((x) => x.label);
      if (!cols.length) return toast('Add at least one column');
      Store.patch('cases', caseId, { ['charts.' + uid()]: { type: 'custom', title: f.elements.title.value.trim(), cols, at: Date.now(), rows: {} } });
      close();
    };
  }

  function CaseDetail(id) {
    return {
      live: true,
      render() {
        const c = Store.cases[id];
        if (!c) return notFound();
        const r = readiness(c);
        const d = daysSince(c.doa);
        const images = listOf(c.images);
        const opinions = listOf(c.opinions);
        const tasks = listOf(c.tasks);
        return `
          <div class="card case-head">
            <div class="row-between">
              <div>
                <h2>${esc(c.name)} <span class="muted">${esc(ageSex(c))}</span></h2>
                <div class="muted">IP ${esc(c.ipNo || '—')}${c.ward ? ' · Ward ' + esc(c.ward) : ''} · DOA ${esc(fmtDate(c.doa))}${d != null ? ` (day ${d})` : ''}</div>
              </div>
              <select id="case-status" class="badge-select st-${esc(c.status || 'preop')}" aria-label="Case status">${opts(Object.entries(CASE_STATUS), c.status || 'preop')}</select>
            </div>
            <dl class="kv">
              <dt>Diagnosis</dt><dd>${esc(c.diagnosis) || '—'}</dd>
              <dt>Plan</dt><dd>${esc(c.plan) || '—'}</dd>
              ${c.comorbid ? `<dt>Comorbid</dt><dd>${esc(c.comorbid)}</dd>` : ''}
              <dt>Level</dt><dd>${esc(c.level) || '—'}</dd>
              <dt>Implants</dt><dd class="pre">${esc(c.implants) || '—'}</dd>
              <dt>Scheme</dt><dd><select class="kv-sel" data-bind="scheme" aria-label="Scheme status">${schemeOpts(c.scheme)}</select></dd>
              ${c.mode ? `<dt>Mode</dt><dd>${esc(c.mode)}</dd>` : ''}
              ${c.treatment ? `<dt>Treatment</dt><dd class="pre">${esc(c.treatment)}</dd>` : ''}
              ${c.writtenBy ? `<dt>Case sheet</dt><dd>${esc(c.writtenBy)}</dd>` : ''}
            </dl>
            <div class="actions">
              <a class="btn" href="#/case/${id}/edit">Edit details</a>
              ${isActive(c) ? '<button class="btn primary" id="to-postop">Transfer to post-op ward</button>' : ''}
              ${c.status === 'postop' ? `<span class="tag ok">In the post-op ward</span>` : ''}
              ${TRANSFER_DEPTS[c.status] ? `<span class="tag task">${esc(deptSay(c.status).withTag)} ${esc(fmtDate(c[c.status]?.out))}${c[c.status]?.out ? ` (day ${daysSince(c[c.status].out)})` : ''}</span>
              <button class="btn primary" id="back-in">${esc(deptSay(c.status).backBtnLong)}</button>` : ''}
              <a class="btn" href="#/discharge/${id}">Discharge / transfer</a>
              <button class="btn wa" id="wa-case">WhatsApp${caseImages(id).length ? ` + ${caseImages(id).length} photo${caseImages(id).length === 1 ? '' : 's'}` : ''}</button>
            </div>
            <details class="more-acts" data-keep="more-acts">
              <summary>More actions</summary>
              <div class="actions">
                ${canTransferOut(c) ? Object.keys(TRANSFER_DEPTS).map((k) => `<button class="btn" data-out-to="${k}">${esc(deptSay(k).outBtn)}</button>`).join('') : ''}
                <button class="btn" id="ot-toggle">${c.otHidden ? 'Show in OT list' : 'Hide from OT list'}</button>
              </div>
            </details>
          </div>

          <section class="card cm-card" id="cm-card">${comorbCardHTML(c)}</section>

          <section class="card">
            <div class="row-between"><h3>Investigations <span class="pill ${r.ready ? 'ok' : ''}">${r.done}/${r.total}</span></h3>
              <span class="row-acts">${labSets(c).length ? '' : '<button class="btn small" data-add-col>+ Column</button>'}<button class="btn small primary" id="add-set">+ ${labSets(c).length ? 'Repeat investigations' : 'Enter investigations'}</button></span></div>
            ${labSets(c).length ? '<p class="muted small flow-hint">Tap any box to type or correct a value — it saves when you move on.</p>' : ''}
            ${flowsheetHTML(c)}
            <div class="pus">
              <label>Pus C/S — organism<input class="italic" data-bind="pus.organism" value="${esc(c.pus?.organism)}"></label>
              <label>Sensitive to<input data-bind="pus.sensitive" value="${esc(c.pus?.sensitive)}"></label>
            </div>
            ${workupHTML(c.work || {}, false, c)}
          </section>

          <section class="card" id="charts">
            <h3>Monitoring charts</h3>
            ${Object.keys(c.charts || {}).sort((a, b) => (c.charts[a].at || 0) - (c.charts[b].at || 0)).map((chId) => chartHTML(c, chId)).join('') || '<p class="muted small">For patients followed with repeated values — RFT for CKD, sugars and insulin for diabetics, or any chart you define.</p>'}
            <div class="actions">
              ${Object.entries(CHART_TEMPLATES).map(([t, tpl]) => `<button class="btn small${suggestedCharts(c).includes(t) ? ' suggest' : ''}" data-chart-new="${t}">+ ${esc(tpl.title)}${suggestedCharts(c).includes(t) ? ` <span class="pill">${esc(tpl.why)}</span>` : ''}</button>`).join('')}
              <button class="btn small" data-chart-new="custom">+ Custom chart</button>
            </div>
          </section>


          <section class="card">
            <h3>Opinions</h3>
            <div class="work">
              ${opinions.map((o) => `
                <div class="work-row ${hasText(o.note) ? '' : 'missing'}">
                  <label>${esc(o.dept)}<input data-bind="opinions.${o.id}.note" value="${esc(o.note)}"></label>
                  <button class="icon" data-del-op="${o.id}" title="Remove">✕</button>
                </div>`).join('') || '<div class="muted small">No opinions sought.</div>'}
            </div>
            <div class="op-quick">${QUICK_OPINIONS.map((d) => `<button type="button" class="btn small" data-op-quick="${esc(d)}">+ ${esc(d)}</button>`).join('')}</div>
            <form class="inline-add" id="add-op">
              <label class="mini-lab">Add opinion — department<input name="dept" list="dl-depts" required></label>
              <button class="btn small">Add</button>
            </form>
          </section>

          <section class="card">
            <h3>Investigations to do</h3>
            <label class="nb-lab">Same as the Investigation box in the ward notebook<textarea data-bind="invTodo" rows="2">${esc(invTodoText({ id, ...c }))}</textarea></label>
          </section>

          <section class="card">
            <h3>Pending works <span class="pill">${tasks.filter((t) => !t.done).length} open</span></h3>
            <ul class="tasks">
              ${tasks.map((t) => `
                <li class="${t.done ? 'done' : ''}">
                  <div class="task-line"><input type="checkbox" data-task="${t.id}" ${t.done ? 'checked' : ''} aria-label="Done">
                    <input class="task-text" data-bind="tasks.${t.id}.text" value="${esc(t.text)}" aria-label="Pending work — tap to edit"></div>
                  ${t.to ? `<span class="tag">${esc(t.to)}</span>` : ''}
                  <div class="muted small">Added by ${esc(t.by)} · ${fmtTime(t.at)}${t.done ? ` — done by ${esc(t.doneBy)} · ${fmtTime(t.doneAt)}` : ''}</div>
                  <button class="icon" data-del-task="${t.id}" title="Delete">✕</button>
                </li>`).join('') || '<li class="muted small">Nothing pending. Add works for your HS / co-PGs below.</li>'}
            </ul>
            <form class="inline-add" id="add-task">
              <label class="mini-lab">New pending work<input name="text" required></label>
              <select name="to"><option value="">Anyone</option>${opts(ROLES)}</select>
              <button class="btn small primary">Add</button>
            </form>
          </section>

          <section class="card" id="operative">
            <h3>Operative details</h3>
            <div class="op-grid">
              <label>Date of surgery<input type="date" data-bind="surgeryDate" value="${esc(c.surgeryDate || c.otDate || '')}"></label>
              <label>Surgeon<input data-bind="surgeon" list="dl-surgeons" value="${esc(c.surgeon)}"></label>
              <label class="span2">Procedure done<textarea data-bind="procedureDone" rows="2">${esc(c.procedureDone)}</textarea></label>
              <label class="span2">Assistant surgeon(s)<input data-bind="assistants" list="dl-pg" value="${esc(c.assistants)}"></label>
              <details class="span2 opn-wrap"${c.opBuild ? ' open' : ''}>
                <summary>Op-note builder — choose from the lists and it writes the operative notes</summary>
                <div id="opn">${opnHTML(c.opBuild || opnDefaults(c))}</div>
                <div class="form-actions"><button type="button" class="btn primary" id="opn-gen">Write operative notes</button></div>
              </details>
              <label class="span2">Operative notes<textarea data-bind="opNotes" rows="6">${esc(c.opNotes)}</textarea></label>
              <label class="span2">Implants used <span class="hint">picked up from the operative notes — edit if needed</span>
                <textarea data-bind="implantsUsed" rows="2">${esc(c.implantsUsed)}</textarea></label>
              <div class="span2"><button class="btn small" id="impl-from-notes">↻ Pick implants from operative notes</button></div>
            </div>
          </section>

          <section class="card">
            <h3>Radiographs & wound pictures</h3>
            <div class="img-adders">${IMAGE_KINDS.map((k) => `<label class="btn small">+ ${esc(k.label)}<input type="file" accept="image/*" multiple data-upload="${k.k}" hidden></label>`).join('')}</div>
            <div class="gallery">
              ${caseImages(id).map((im) => `<button class="thumb" data-open="${im.id}"><img data-img="${im.id}" alt=""><span>${esc(imageKind(im.kind).label)}${im.caption ? ' · ' + esc(im.caption) : ''}</span></button>`).join('') || '<div class="muted small">None yet.</div>'}
            </div>
          </section>
          ${datalist('dl-depts', OPINION_DEPTS)}
          ${datalist('dl-surgeons', [...new Set(allUnits().flatMap((u) => [u.chief, ...u.aps]))])}${datalist('dl-pg', Store.meta.pgs || [])}`;
      },
      mount(el) {
        if (!Store.cases[id]) return;
        $('#impl-from-notes', el).onclick = () => {
          const found = extractImplants(Store.cases[id].opNotes);
          if (!found) return toast('No implants with sizes found in the operative notes.', 3500);
          Store.patch('cases', id, { implantsUsed: found, implantsAuto: found });
          toast('Implants picked up from the operative notes');
        };
        $$('img[data-img]', el).forEach((img) => {
          Store.getImage(img.dataset.img).then((src) => { if (src) img.src = src; });
        });
        $('#case-status', el).onchange = (e) => {
          const cur = Store.cases[id];
          const to = e.target.value;
          // Transfer outs go through the same steps as the buttons, so the stay is recorded.
          if (TRANSFER_DEPTS[to] && cur.status !== to) { if (!askOut(id, to)) e.target.value = cur.status || 'preop'; return; }
          if (TRANSFER_DEPTS[cur.status] && to === 'preop') { if (!askBack(id)) e.target.value = cur.status; return; }
          Store.patch('cases', id, { status: to });
        };
        $$('[data-out-to]', el).forEach((b) => { b.onclick = () => { if (askOut(id, b.dataset.outTo)) location.hash = '#/' + b.dataset.outTo; }; });
        const bin = $('#back-in', el);
        if (bin) bin.onclick = () => askBack(id);
        el.addEventListener('input', (e) => {
          const k = e.target.dataset.cin;
          const box = e.target.closest('[data-chart]');
          if (!k || !box) return;
          const col = (Store.cases[id].charts[box.dataset.chart].cols || []).find((x) => x.k === k);
          if (col && !col.text) e.target.classList.toggle('is-flag', !!flagOf(e.target.value, col));
        });
        el.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' && e.target.dataset.cin) {
            e.preventDefault();
            $('[data-row-save]', e.target.closest('[data-chart]'))?.click();
          }
        });
        $('#add-set', el).onclick = () => openLabModal(id);
        // Comorbidities card: buttons switch each one on/off; years + current treatment per one.
        const cmBox = $('#cm-card', el);
        const cmSave = (cm, other) => Store.patch('cases', id, { comorb: cm, comorbOther: other, comorbid: comorbText(cm, other) });
        const cmNow = () => { const cur = Store.cases[id]; return [JSON.parse(JSON.stringify(cur.comorb || {})), comorbOtherOf(cur)]; };
        cmBox.addEventListener('click', (e) => {
          const b = e.target.closest('[data-cm]');
          if (!b) return;
          const [cm, other] = cmNow();
          const k = b.dataset.cm;
          cm[k] = { years: '', rx: '', ...cm[k], on: !cm[k]?.on };
          cmBox.innerHTML = comorbCardHTML({ ...Store.cases[id], comorb: cm, comorbOther: other });
          cmSave(cm, other);
          if (cm[k].on) $(`[data-cmk="${k}"][data-cmf="years"]`, cmBox)?.focus();
        });
        cmBox.addEventListener('change', (e) => {
          const t = e.target;
          const [cm, other] = cmNow();
          if (t.dataset.cmk) {
            cm[t.dataset.cmk] = { ...cm[t.dataset.cmk], [t.dataset.cmf]: t.value.trim().toUpperCase() };
            cmSave(cm, other);
          } else if (t.dataset.cmo !== undefined) cmSave(cm, t.value.trim().toUpperCase());
        });
        // Op-note builder: every choice is saved on the case (opBuild) and fills what follows.
        const opnBox = $('#opn', el);
        const opnState = () => JSON.parse(JSON.stringify(opnNormalize(Store.cases[id].opBuild) || opnDefaults({ id, ...Store.cases[id] })));
        const opnSave = (b) => { opnBox.innerHTML = opnHTML(b); Store.patch('cases', id, { opBuild: b }); };
        if (opnBox) {
          opnBox.addEventListener('change', (e) => {
            const b = opnState();
            if (opnApplyChange(b, e.target)) opnSave(b);
          });
          opnBox.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-add-proc],[data-rm-proc],[data-add-imp],[data-rm-imp],[data-add-scr],[data-rm-scr]');
            if (!btn) return;
            const b = opnState();
            if (opnApplyClick(b, btn, Store.cases[id])) opnSave(b);
          });
          $('#opn-gen', el).onclick = () => {
            document.activeElement?.blur?.();
            const b = opnState();
            const text = opNoteText({ ...b, dx: Store.cases[id].diagnosis });
            if (!text) return toast('Choose the bone, fracture site, approach and implant first', 4000);
            const ta = $('[data-bind="opNotes"]', el);
            if (ta.value.trim() && !confirm('Replace the operative notes already typed with the new notes?')) return;
            ta.value = text;
            ta.dispatchEvent(new Event('change', { bubbles: true }));
            const cur = Store.cases[id];
            const ch = {};
            if (!hasText(cur.procedureDone)) ch.procedureDone = opProcedureName(b);
            if (Object.keys(ch).length) Store.patch('cases', id, ch);
            ta.scrollIntoView({ block: 'start', behavior: 'smooth' });
            toast('Operative notes written — read through and edit as needed', 4000);
          };
        }
        const tp = $('#to-postop', el);
        if (tp) tp.onclick = () => {
          const cur = Store.cases[id];
          if (!confirm(`Transfer ${cur.name || 'this case'} to the post-op ward?\n\nIt leaves the pre-op ward and the OT list and goes straight into the post-op ward.`)) return;
          transferToPostop(id);
          toast(`${cur.name || 'Case'} sent to the post-op ward`);
          location.hash = '#/';
        };
        // Photos are turned into files as soon as the page opens, so the tap can share at once.
        let waFiles = null;
        const imgs = caseImages(id);
        Promise.all(imgs.map(async (im) => ({ kind: im.kind, data: await Store.getImage(im.id) })))
          .then((list) => { waFiles = Share.imageFiles(Store.cases[id], list.filter((x) => x.data)); })
          .catch(() => { waFiles = []; });
        $('#wa-case', el).onclick = () => {
          const text = Share.caseText({ id, ...Store.cases[id] });
          if (!imgs.length) return Share.send(text);
          if (!waFiles) return toast('Still loading the photos — tap again in a moment');
          Share.sendWithFiles(text, waFiles);
        };
        $('#ot-toggle', el).onclick = () => {
          const hide = !Store.cases[id].otHidden;
          Store.patch('cases', id, { otHidden: hide });
          toast(hide ? 'Hidden from the OT list builder' : 'Back in the OT list builder');
        };

        // Investigations table: live red flag while typing.
        el.addEventListener('input', (e) => {
          const t = e.target;
          if (!t.dataset?.lab) return;
          const c = Store.cases[id];
          const p = [...ALL_PARAMS, ...customParams(c)].find((x) => x.k === t.dataset.lk);
          const td = t.closest('td');
          if (!p || !td) return;
          const f = flagOf(t.value, p);
          td.classList.toggle('flag', !!f);
          td.dataset.mark = FLAG_MARK[f].trim();
          td.dataset.fv = '';
        });

        el.addEventListener('change', async (e) => {
          const t = e.target;
          if (t.dataset.lab) {
            const base = `labs.${t.dataset.lab}`;
            const cur = Store.cases[id].labs?.[t.dataset.lab]?.v?.[t.dataset.lk] ?? '';
            const val = t.value.trim();
            if (val === String(cur).trim()) return;
            Store.patch('cases', id, { [`${base}.v.${t.dataset.lk}`]: val || DELETE, [`${base}.by`]: Store.who() });
            return;
          }
          if (t.dataset.labDate) {
            Store.patch('cases', id, { [`labs.${t.dataset.labDate}.date`]: t.value });
            return;
          }
          if (t.dataset.check) {
            Store.patch('cases', id, { [t.dataset.check]: t.checked ? 'Taken' : '' });
          } else if (t.dataset.bind === 'opNotes') {
            // Fill "Implants used" from the notes unless someone has edited it by hand.
            const cur = Store.cases[id];
            const found = extractImplants(t.value);
            const ch = { opNotes: t.value.trim() };
            if (!hasText(cur.implantsUsed) || cur.implantsUsed === cur.implantsAuto) Object.assign(ch, { implantsUsed: found, implantsAuto: found });
            Store.patch('cases', id, ch);
          } else if (t.dataset.bind) {
            Store.patch('cases', id, { [t.dataset.bind]: t.value.trim() });
          } else if (t.dataset.task) {
            const k = 'tasks.' + t.dataset.task;
            Store.patch('cases', id, t.checked
              ? { [k + '.done']: true, [k + '.doneBy']: Store.who(), [k + '.doneAt']: Date.now() }
              : { [k + '.done']: false });
          } else if (t.dataset.upload) {
            const files = [...t.files];
            t.value = '';
            for (const file of files) {
              try {
                toast(`Uploading ${file.name}…`, 6000);
                await Store.addImage(id, t.dataset.upload, await compressImage(file), file.name.replace(/\.[^.]+$/, ''));
                toast('Uploaded');
              } catch (err) {
                toast('Upload failed: ' + (err.code || err.message));
              }
            }
          }
        });

        el.addEventListener('click', (e) => {
          const b = e.target.closest('button');
          if (!b) return;
          if (b.dataset.delOp) {
            Store.patch('cases', id, { ['opinions.' + b.dataset.delOp]: DELETE });
          } else if (b.dataset.delTask) {
            if (confirm('Delete this task?')) Store.patch('cases', id, { ['tasks.' + b.dataset.delTask]: DELETE });
          } else if (b.dataset.addCol !== undefined) {
            // A new empty column dated today, then straight into its first box.
            const sid = uid();
            Store.patch('cases', id, { ['labs.' + sid]: { date: todayISO(), at: Date.now(), by: Store.who(), v: {} } });
            render();
            setTimeout(() => $(`[data-lab="${sid}"]`)?.focus(), 0);
          } else if (b.dataset.editSet) {
            openLabModal(id, b.dataset.editSet);
          } else if (b.dataset.delSet) {
            const s = Store.cases[id].labs[b.dataset.delSet];
            if (confirm(`Delete the investigations dated ${fmtDate(s.date) || '(no date)'}?`)) Store.patch('cases', id, { ['labs.' + b.dataset.delSet]: DELETE });
          } else if (b.dataset.chartNew) {
            const t = b.dataset.chartNew;
            if (t === 'custom') return openCustomChartModal(id);
            const tpl = CHART_TEMPLATES[t];
            Store.patch('cases', id, { ['charts.' + uid()]: { type: t, title: tpl.title, cols: tpl.cols.map(chartCol), at: Date.now(), rows: {} } });
          } else if (b.dataset.chartDel) {
            const ch = Store.cases[id].charts[b.dataset.chartDel];
            if (confirm(`Delete the ${ch.title} and all its entries?`)) Store.patch('cases', id, { ['charts.' + b.dataset.chartDel]: DELETE });
          } else if (b.dataset.chartPrint) {
            Print.chart(Store.cases[id], b.dataset.chartPrint, Store.meta);
          } else if (b.dataset.rowEdit || b.dataset.rowCancel !== undefined) {
            const chId = b.closest('[data-chart]').dataset.chart;
            Charts.editing[chId] = b.dataset.rowEdit || null;
            render();
          } else if (b.dataset.rowDel) {
            const chId = b.closest('[data-chart]').dataset.chart;
            if (confirm('Delete this entry?')) Store.patch('cases', id, { [`charts.${chId}.rows.${b.dataset.rowDel}`]: DELETE });
          } else if (b.dataset.rowSave !== undefined) {
            const box = b.closest('[data-chart]');
            const chId = box.dataset.chart;
            const v = {};
            $$('.chart-form [data-cin]', box).forEach((inp) => {
              if (!inp.dataset.cin.startsWith('_') && inp.value.trim()) v[inp.dataset.cin] = inp.value.trim();
            });
            if (!Object.keys(v).length) return toast('Type at least one value');
            const rowId = Charts.editing[chId] || uid();
            const prev = Store.cases[id].charts[chId].rows?.[rowId];
            Store.patch('cases', id, { [`charts.${chId}.rows.${rowId}`]: {
              date: $('[data-cin=_date]', box).value, time: $('[data-cin=_time]', box).value,
              v, at: prev?.at || Date.now(), by: Store.who(),
            } });
            Charts.editing[chId] = null;
            // Redraw now (a save made with Enter keeps focus in the form, which
            // would otherwise postpone it) and put the cursor back for the next entry.
            render();
            $(`[data-chart="${chId}"] .chart-form [data-cin]:not([data-cin^="_"])`, App.el)?.focus();
            toast('Saved');
          } else if (b.dataset.gallery) {
            const first = listOf(Store.cases[id].images).find((i) => i.kind === b.dataset.gallery);
            if (first) openViewer(id, first.id, b.dataset.gallery);
          } else if (b.dataset.open) {
            openViewer(id, b.dataset.open);
          }
        });

        $$('[data-op-quick]', el).forEach((b) => {
          b.onclick = () => {
            const dept = b.dataset.opQuick;
            const open = listOf(Store.cases[id].opinions).some((o) => String(o.dept).toUpperCase() === dept.toUpperCase() && !hasText(o.note));
            if (open) return toast(`${dept} opinion is already pending`);
            Store.patch('cases', id, { ['opinions.' + uid()]: { dept, note: '', at: Date.now() } });
            toast(`${dept} opinion added`);
          };
        });
        $('#add-op', el).onsubmit = (e) => {
          e.preventDefault();
          const dept = e.target.elements.dept.value.trim();
          if (dept) Store.patch('cases', id, { ['opinions.' + uid()]: { dept, note: '', at: Date.now() } });
        };
        $('#add-task', el).onsubmit = (e) => {
          e.preventDefault();
          const text = e.target.elements.text.value.trim();
          const to = e.target.elements.to.value;
          if (text) Store.patch('cases', id, { ['tasks.' + uid()]: { text, to, done: false, by: Store.who(), at: Date.now() } });
        };
      },
    };
  }

  // Full-screen image viewer. Without `kind` it walks every image of the
  // case in order X-ray → CT → MRI, oldest first within each.
  const IMG_ORDER = IMAGE_KINDS.map((k) => k.k);
  const caseImages = (caseId, kind) => listOf(Store.cases[caseId]?.images)
    .filter((i) => !kind || i.kind === kind)
    .sort((a, b) => IMG_ORDER.indexOf(a.kind) - IMG_ORDER.indexOf(b.kind) || (a.at || 0) - (b.at || 0));

  function openViewer(caseId, imgId, kind) {
    const m = $('#modal');
    const c = Store.cases[caseId];
    let cur = imgId || caseImages(caseId, kind)[0]?.id;
    const close = () => {
      m.hidden = true;
      m.innerHTML = '';
      document.removeEventListener('keydown', onKey);
    };
    const step = (dir) => {
      const all = caseImages(caseId, kind);
      const i = all.findIndex((x) => x.id === cur) + dir;
      if (all[i]) show(all[i].id);
    };
    const onKey = (e) => {
      if (e.key === 'ArrowRight') step(1);
      else if (e.key === 'ArrowLeft') step(-1);
      else if (e.key === 'Escape') close();
    };
    const show = async (iid) => {
      cur = iid;
      const all = caseImages(caseId, kind);
      const idx = all.findIndex((i) => i.id === iid);
      const im = all[idx];
      if (!im) return close();
      m.innerHTML = `
        <div class="viewer">
          <div class="viewer-bar">
            <span><b>${esc(c?.name || '')}</b> · ${esc(imageKind(im.kind).deck)} · ${idx + 1} of ${all.length}${im.caption ? ' · ' + esc(im.caption) : ''}</span>
            <span>
              <button class="btn small danger" data-v="del">Delete</button>
              <button class="btn small" data-v="close">Close</button>
            </span>
          </div>
          <div class="viewer-img">
            <button class="v-nav v-prev" data-v="prev" ${idx ? '' : 'disabled'} aria-label="Previous image">‹</button>
            <img alt="">
            <button class="v-nav v-next" data-v="next" ${idx < all.length - 1 ? '' : 'disabled'} aria-label="Next image">›</button>
          </div>
          <div class="viewer-strip">${all.map((x, i) => `<button class="v-dot${i === idx ? ' on' : ''}" data-go-img="${x.id}">${esc(imageKind(x.kind).label)} ${all.filter((y, j) => y.kind === x.kind && j <= i).length}</button>`).join('')}</div>
        </div>`;
      $('img', m).src = (await Store.getImage(im.id)) || '';
      // Swipe on phones.
      const area = $('.viewer-img', m);
      let x0 = null;
      area.ontouchstart = (e) => { x0 = e.touches.length === 1 ? e.touches[0].clientX : null; };
      area.ontouchend = (e) => {
        if (x0 == null) return;
        const dx = e.changedTouches[0].clientX - x0;
        if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
        x0 = null;
      };
      m.onclick = async (e) => {
        const go = e.target.closest('[data-go-img]');
        if (go) return show(go.dataset.goImg);
        const v = e.target.closest('[data-v]')?.dataset.v || (e.target === m || e.target.classList.contains('viewer-img') ? 'close' : '');
        if (v === 'prev') step(-1);
        if (v === 'next') step(1);
        if (v === 'close') close();
        if (v === 'del' && confirm('Delete this image for everyone?')) {
          await Store.deleteImage(caseId, im.id);
          close();
        }
      };
    };
    if (!cur) return toast('No radiographs uploaded for this patient yet');
    m.hidden = false;
    document.addEventListener('keydown', onKey);
    show(cur);
  }

  // ---------------------------------------------------------------- OT builder
  const OT_KEY = 'wm.v1.otDraft';
  function otDraft() {
    let d;
    try { d = JSON.parse(localStorage.getItem(OT_KEY)); } catch { /* ignore */ }
    d ||= {};
    const m = Store.meta;
    d.date ||= todayISO(1);
    d.day ||= dayName(d.date).toUpperCase();
    d.selected ||= [];
    d.standby ||= [];
    d.unitId ||= m.unitId || 'I';
    d.chief ||= unitOf(d.unitId).chief;
    d.prof ||= m.lastProf || unitOf(d.unitId).aps[0];
    d.unit = unitName(d.unitId);
    return d;
  }
  const saveDraft = (d) => {
    try { localStorage.setItem(OT_KEY, JSON.stringify(d)); } catch { /* ignore */ }
  };

  const OT = {
    // live: redraw when the shared data changes (order reset / moves / edits on another phone, or the
    // up-to-date data arriving after the page first drew from the offline copy). Never while typing.
    live: true,
    showAll: false,
    render() {
      const d = otDraft();
      d.selected = d.selected.filter((id) => Store.cases[id]);
      const pool = inOrder(allCases().filter((c) => !c.otHidden && (OT.showAll || d.selected.includes(c.id) || isActive(c))));
      const hidden = allCases().filter((c) => c.otHidden && (OT.showAll || isActive(c))).sort(byWard);
      const sel = d.selected.map((id) => ({ id, ...Store.cases[id] }));
      // Selected unit's staff first, then everyone else.
      const unitFirst = [unitOf(d.unitId), ...allUnits().filter((u) => u.id !== d.unitId)];
      const chiefs = [...new Set(unitFirst.map((u) => u.chief))];
      const apOptions = unitFirst.map((u) => `<optgroup label="Unit ${u.id}">${opts(u.aps, d.prof)}</optgroup>`).join('');
      if (!/^#\/ot\/list/.test(location.hash)) {
        return `
        <div class="toolbar">
          <h2>OT list · pick cases</h2>
          <a class="btn primary" href="#/ot/list" ${sel.length ? '' : 'aria-disabled="true"'} id="ot-next">Next (${sel.length}) →</a>
        </div>
        <div class="card">
          <div class="row-between"><p class="muted small">Tap a row to add it to the list. Radiographs open in a viewer; use → to step through X-ray, CT and MRI.</p>
            <label class="small nowrap"><input type="checkbox" id="ot-all" ${OT.showAll ? 'checked' : ''}> show all statuses</label></div>
          <div class="order-bar">
            <span class="muted small">${Store.meta.caseOrder?.length ? 'Your own order (same as the Cases page)' : 'Earliest admitted first'}</span>
            ${Store.meta.caseOrder?.length ? '<button class="btn small" id="ot-order-reset">Back to DOA order</button>' : ''}
          </div>
          <div class="table-wrap">
            <table class="board picker">
              <thead><tr><th title="Change the order">Order</th><th></th><th>Name</th><th>Age/Sex</th><th>Diagnosis</th><th>Plan</th><th>DOA</th><th>Anaesthesia</th><th>Scheme</th><th>Radiographs</th><th></th></tr></thead>
              <tbody>
                ${pool.map((c, pi) => {
                  const n = listOf(c.images).length;
                  return `<tr class="${d.selected.includes(c.id) ? 'picked' : ''}" data-row="${c.id}" data-case="${c.id}">
                  <td class="ot-move"><button class="icon" data-omove="-1" ${pi ? '' : 'disabled'} aria-label="Move up" title="Move up">↑</button><button class="icon" data-omove="1" ${pi < pool.length - 1 ? '' : 'disabled'} aria-label="Move down" title="Move down">↓</button></td>
                  <td><input type="checkbox" data-pick="${c.id}" ${d.selected.includes(c.id) ? 'checked' : ''} aria-label="Select ${esc(c.name)}"></td>
                  <td><b>${esc(c.name)}</b>${c.otOnly ? '<br><span class="tag task">OT only</span>' : ''}</td><td class="nowrap">${esc(ageSex(c))}</td>
                  <td>${esc(c.diagnosis)}</td><td>${esc(c.plan)}</td>
                  <td class="nowrap">${esc(fmtDate(c.doa))}</td>
                  <td><select class="ot-sel" data-f="work.anaes" aria-label="Anaesthesia assessment"><option value="">—</option>${opts(PAC_OPTIONS, c.work?.anaes || '')}</select></td>
                  <td><select class="ot-sel" data-f="scheme" aria-label="Scheme status">${schemeOpts(c.scheme)}</select></td>
                  <td class="nowrap">${n ? `<a href="#" class="img-link" data-imaging="${c.id}">View ${n} ›</a>` : '<span class="muted">None</span>'}</td>
                  <td>${c.otOnly
                    ? `<span class="ot-only-acts"><label class="btn small">+ X-ray<input type="file" accept="image/*" multiple data-ot-xray="${c.id}" hidden></label><button class="btn small" data-ot-keep="${c.id}" title="Also put this case in the e-case sheet and ward">+ e-Case sheet</button><button class="btn small hide-btn" data-ot-del="${c.id}" title="Delete this OT-only case">Delete</button></span>`
                    : `<button class="btn small hide-btn" data-ot-hide="${c.id}" title="Hide from the OT list builder">Hide</button>`}</td>
                </tr>`;
                }).join('') || `<tr><td colspan="11" class="empty">${hidden.length ? 'All cases are hidden — add them back below.' : 'No pre-op cases.'}</td></tr>`}
              </tbody>
            </table>
          </div>
          ${hidden.length ? `
          <details class="hidden-cases"${OT.openHidden ? ' open' : ''}>
            <summary>Hidden from OT list (${hidden.length})</summary>
            <ul>${hidden.map((c) => `<li><span><b>${esc(c.name)}</b> <span class="muted">${esc(ageSex(c))} · ${esc(c.diagnosis)}</span></span>
              <button class="btn small" data-ot-show="${c.id}">Add back</button></li>`).join('')}</ul>
          </details>` : ''}
        </div>
        <details class="card ot-quick" id="ot-quick"${OT.openQuick ? ' open' : ''}>
          <summary>+ Add case to OT list only</summary>
          <p class="muted small">For a case that isn't in your e-case sheet or ward (e.g. from another unit or an emergency). It goes on the OT list only.</p>
          <form id="ot-quick-form" class="form imp-grid" autocomplete="off">
            <label class="span2">Name<input name="name" required></label>
            <label>Age<input name="age" inputmode="numeric"></label>
            <label>Sex<select name="sex"><option></option><option>M</option><option>F</option></select></label>
            <label>IP no.<input name="ipNo"></label>
            <label>Ward<input name="ward"></label>
            <label class="span2">Diagnosis<textarea name="diagnosis" rows="2" required></textarea></label>
            <label class="span2">Plan<input name="plan"></label>
            <label>Anaesthesia<select name="anaes"><option value="">—</option>${opts(PAC_OPTIONS, '')}</select></label>
            <label>Scheme<select name="scheme">${schemeOpts('')}</select></label>
            <div class="span2 img-adders">
              ${[['xray', 'X-ray'], ['ct', 'CT'], ['mri', 'MRI']].map(([k, l]) => `<label class="btn small">+ ${l}<input type="file" accept="image/*" multiple data-qimg="${k}" hidden></label>`).join('')}
            </div>
            <div class="span2 pending-imgs" id="ot-quick-imgs"></div>
            <div class="span2 form-actions"><button class="btn primary">Add to OT list</button></div>
          </form>
        </details>
        <div class="form-actions"><a class="btn primary" href="#/ot/list" ${sel.length ? '' : 'aria-disabled="true"'}>Next (${sel.length} selected) →</a></div>`;
      }
      return `
        <div class="toolbar"><a class="btn" href="#/ot">← Pick cases</a></div>
        <h2>OT list · details</h2>
        <div class="card form">
          <fieldset><legend>List details</legend>
            <label>Date<input type="date" id="ot-date" value="${esc(d.date)}"></label>
            <label>Day<input id="ot-day" value="${esc(d.day)}"></label>
            <label>Unit<select id="ot-unit">${opts(UNITS.map((u) => [u.id, 'UNIT ' + u.id]), d.unitId)}</select></label>
            <label>Chief (header)<select id="ot-chief">${opts(chiefs, d.chief)}</select></label>
            <label class="span2">Assistant Professor (signs the list)<select id="ot-prof">${apOptions}</select></label>
          </fieldset>
          <div class="ot-preview-title">${Print.otTitle(d).map(esc).join('<br>')}</div>
        </div>

        <div class="card">
          <h3>Order & confirm <span class="pill">${sel.length}</span></h3>
          <p class="muted small">Edits here are saved back to the case. Anaesthesia prints as ${ANAES}.</p>
          <div class="ot-rows">
            ${sel.map((c, i) => `
              <div class="ot-row" data-case="${c.id}">
                <div class="ot-row-head">
                  <b>${i + 1}. ${esc(c.name)}</b>${d.standby.includes(c.id) ? ' <span class="tag task">(STANDBY)</span>' : ''} <span class="muted">${esc(ageSex(c))} · IP ${esc(c.ipNo)} · DOA ${esc(fmtDate(c.doa))}</span>
                  <span class="right">
                    <button class="btn small${d.standby.includes(c.id) ? ' primary' : ''}" data-standby title="Print “(STANDBY)” under the name">Standby</button>
                    <button class="icon" data-move="-1" ${i ? '' : 'disabled'} title="Move up">↑</button>
                    <button class="icon" data-move="1" ${i < sel.length - 1 ? '' : 'disabled'} title="Move down">↓</button>
                    <button class="icon" data-unpick title="Remove">✕</button>
                  </span>
                </div>
                <div class="ot-fields">
                  <label>Ward<input data-f="ward" value="${esc(c.ward)}"></label>
                  <label>Level<select data-f="level">${levelOpts(c.level)}</select></label>
                  <label>Scheme status<select data-f="scheme">${schemeOpts(c.scheme)}</select></label>
                  <label>Anaesthesia assessment<select data-f="work.anaes"><option value="">—</option>${opts(PAC_OPTIONS, c.work?.anaes || '')}</select></label>
                  <label class="span3">Diagnosis<textarea data-f="diagnosis" rows="2">${esc(c.diagnosis)}</textarea></label>
                  <label class="span3">Plan<textarea data-f="plan" rows="2">${esc(c.plan)}</textarea></label>
                  <label class="span3">Implants <button type="button" class="link small" data-refill>↻ implants & level from database</button><textarea data-f="implants" rows="2">${esc(c.implants)}</textarea></label>
                </div>
              </div>`).join('') || '<div class="empty">Tick cases above to add them.</div>'}
          </div>
        </div>

        <div class="card print-card">
          <label class="small"><input type="checkbox" id="ot-mark" checked> Mark these cases as “Posted” (BOT)</label>
          <div class="form-actions">
            <button class="btn primary" id="ot-go" ${sel.length ? '' : 'disabled'}>Generate OT list PDF</button>
            <button class="btn primary" id="ot-go2" ${sel.length ? '' : 'disabled'}>Generate OT list print PDF</button>
            <button class="btn wa" id="ot-wa" ${sel.length ? '' : 'disabled'}>WhatsApp OT list PDF</button>
            <button class="btn" id="ot-mail" ${sel.length ? '' : 'disabled'} title="${esc(Store.meta.otEmail ? 'To ' + Store.meta.otEmail : 'Set the address in Settings')}">Email OT list PDF</button>
            <button class="btn" id="ot-xr" ${sel.length ? '' : 'disabled'}>Pre-op imaging PDF (X-ray, CT, MRI)</button>
            <button class="btn" id="ot-consent" ${sel.length ? '' : 'disabled'}>Consent forms (Tamil)</button>
          </div>
          <p class="muted small">The print PDF puts the same list twice on one landscape sheet — top and bottom — to print and cut.</p>
        </div>`;
    },
    mount(el) {
      const d = otDraft();
      const upd = (fn, rerender = true) => {
        fn(d);
        saveDraft(d);
        if (rerender) render();
        else if ($('.ot-preview-title', el)) $('.ot-preview-title', el).innerHTML = Print.otTitle(otDraft()).map(esc).join('<br>');
      };
      if ($('#ot-date', el)) $('#ot-date', el).onchange = (e) => upd((x) => { x.date = e.target.value; x.day = dayName(x.date).toUpperCase(); });
      if ($('#ot-day', el)) $('#ot-day', el).onchange = (e) => upd((x) => { x.day = e.target.value; }, false);
      if ($('#ot-unit', el)) $('#ot-unit', el).onchange = (e) => upd((x) => {
        const u = unitOf(e.target.value);
        x.unitId = u.id;
        x.chief = u.chief;
        x.prof = u.aps[0];
      });
      if ($('#ot-chief', el)) $('#ot-chief', el).onchange = (e) => upd((x) => { x.chief = e.target.value; }, false);
      if ($('#ot-prof', el)) $('#ot-prof', el).onchange = (e) => upd((x) => { x.prof = e.target.value; }, false);
      if ($('#ot-all', el)) $('#ot-all', el).onchange = (e) => { OT.showAll = e.target.checked; render(); };

      el.addEventListener('change', (e) => {
        const t = e.target;
        if (t.dataset.otXray) {
          const cid = t.dataset.otXray;
          const files = [...t.files];
          t.value = '';
          (async () => {
            let n = 0;
            for (const file of files) {
              try { await Store.addImage(cid, 'xray', await compressImage(file), file.name.replace(/\.[^.]+$/, '')); n++; } catch { toast(`"${file.name}" couldn't be opened as an image. Use JPG or PNG.`, 4000); }
            }
            if (n) toast(`${n} X-ray(s) added to ${Store.cases[cid]?.name || 'the case'}`);
            render();
          })();
          return;
        }
        if (t.dataset.pick) {
          upd((x) => {
            x.selected = x.selected.filter((i) => i !== t.dataset.pick);
            if (t.checked) x.selected.push(t.dataset.pick);
          });
        } else if (t.dataset.f) {
          Store.patch('cases', t.closest('[data-case]').dataset.case, { [t.dataset.f]: t.value.trim() });
        }
      });

      const ores = $('#ot-order-reset', el);
      // Quick add: an OT-only case, ticked straight onto the list.
      const qd = $('#ot-quick', el);
      if (qd) qd.ontoggle = () => { OT.openQuick = qd.open; };
      const qf = $('#ot-quick-form', el);
      if (qf) {
        const qImgs = [];
        const drawQ = () => {
          $('#ot-quick-imgs', el).innerHTML = qImgs.map((q, i) => `<div class="pthumb"><img src="${q.data}" alt=""><span>${esc(imageKind(q.kind).label)}</span><button type="button" class="icon" data-qrm="${i}" title="Remove">✕</button></div>`).join('');
        };
        qf.addEventListener('change', async (e) => {
          const kind = e.target.dataset.qimg;
          if (!kind) return;
          const files = [...e.target.files];
          e.target.value = '';
          for (const file of files) {
            try { qImgs.push({ kind, data: await compressImage(file), name: file.name.replace(/\.[^.]+$/, '') }); } catch { toast(`"${file.name}" couldn't be opened as an image. Use JPG or PNG.`, 4000); }
          }
          drawQ();
        });
        qf.addEventListener('click', (e) => {
          const r = e.target.closest('[data-qrm]');
          if (r) { qImgs.splice(+r.dataset.qrm, 1); drawQ(); }
        });
        let planTouched = false;
        qf.elements.plan.addEventListener('input', () => { planTouched = true; });
        qf.elements.diagnosis.addEventListener('input', () => { if (!planTouched) qf.elements.plan.value = defaultPlanFor(qf.elements.diagnosis.value); });
        qf.onsubmit = async (e) => {
          e.preventDefault();
          const v = (k) => qf.elements[k].value.trim();
          const plan = v('plan').toUpperCase();
          const diagnosis = v('diagnosis').toUpperCase();
          const nid = uid();
          Store.create('cases', nid, {
            otOnly: true, name: v('name').toUpperCase(), age: v('age'), sex: qf.elements.sex.value, ipNo: v('ipNo'), ward: v('ward').toUpperCase(),
            diagnosis, plan, doa: todayISO(), status: 'preop', scheme: qf.elements.scheme.value, work: { anaes: qf.elements.anaes.value },
            implants: plan ? suggestImplantsFor(plan, diagnosis, Store.implants).implants : '', level: plan ? levelFor(plan, Store.levels).level || '' : '',
          });
          const dd = otDraft();
          dd.selected = [...dd.selected.filter((i) => i !== nid), nid];
          saveDraft(dd);
          OT.openQuick = false;
          if (qImgs.length) {
            toast(`Saving ${qImgs.length} image(s)…`, 8000);
            for (const q of qImgs) await Store.addImage(nid, q.kind, q.data, q.name);
          }
          toast(`${v('name').toUpperCase()} added to the OT list${qImgs.length ? ` with ${qImgs.length} image(s)` : ''}`);
          render();
        };
      }
      if (ores) ores.onclick = () => { Store.setMeta({ caseOrder: [] }); toast('Back to date-of-admission order'); render(); };
      el.addEventListener('click', (e) => {
        const om = e.target.closest('[data-omove]');
        if (om) {
          const shown = $$('[data-row]', el).map((r) => r.dataset.row);
          moveCase(om.closest('[data-row]').dataset.row, +om.dataset.omove, shown);
          render();
          return;
        }
        const keepB = e.target.closest('[data-ot-keep]');
        if (keepB) {
          Store.patch('cases', keepB.dataset.otKeep, { otOnly: false });
          toast('Now also in the e-case sheet and ward');
          return render();
        }
        const delB = e.target.closest('[data-ot-del]');
        if (delB) {
          const cid = delB.dataset.otDel;
          if (!confirm(`Delete ${Store.cases[cid]?.name || 'this case'} from the OT list?`)) return;
          d.selected = d.selected.filter((i) => i !== cid);
          saveDraft(d);
          Store.remove('cases', cid);
          return render();
        }
        const hideB = e.target.closest('[data-ot-hide]');
        if (hideB) {
          const cid = hideB.dataset.otHide;
          d.selected = d.selected.filter((i) => i !== cid);
          saveDraft(d);
          Store.patch('cases', cid, { otHidden: true });
          render();
          toast('Hidden — find it under “Hidden from OT list” at the bottom');
          return;
        }
        const showB = e.target.closest('[data-ot-show]');
        if (showB) {
          OT.openHidden = true;
          Store.patch('cases', showB.dataset.otShow, { otHidden: false });
          render();
          return;
        }
        const img = e.target.closest('[data-imaging]');
        if (img) {
          e.preventDefault();
          return openViewer(img.dataset.imaging);
        }
        const nx = e.target.closest('[aria-disabled="true"]');
        if (nx) {
          e.preventDefault();
          return toast('Tick at least one case first');
        }
        // Tapping anywhere on a picker row toggles it.
        const pr = e.target.closest('[data-row]');
        if (pr && !/^(INPUT|SELECT|OPTION|LABEL|BUTTON)$/.test(e.target.tagName) && !e.target.closest('label, button')) {
          const cb = $('[data-pick]', pr);
          cb.checked = !cb.checked;
          cb.dispatchEvent(new Event('change', { bubbles: true }));
          return;
        }
        const b = e.target.closest('button');
        const row = b?.closest('[data-case]');
        if (!b || !row) return;
        const cid = row.dataset.case;
        if (b.dataset.move) {
          upd((x) => {
            const i = x.selected.indexOf(cid);
            const j = i + Number(b.dataset.move);
            [x.selected[i], x.selected[j]] = [x.selected[j], x.selected[i]];
          });
        } else if (b.dataset.standby !== undefined) {
          upd((x) => { x.standby = x.standby.includes(cid) ? x.standby.filter((i) => i !== cid) : [...x.standby, cid]; });
        } else if (b.dataset.unpick !== undefined) {
          upd((x) => { x.selected = x.selected.filter((i) => i !== cid); });
        } else if (b.dataset.refill !== undefined) {
          const sug = suggestImplantsFor($('[data-f="plan"]', row).value, $('[data-f="diagnosis"]', row).value, Store.implants);
          const ta = $('[data-f="implants"]', row);
          ta.value = sug.implants;
          ta.dispatchEvent(new Event('change', { bubbles: true }));
          const lv = levelFor($('[data-f="plan"]', row).value, Store.levels).level;
          if (lv) {
            const sel = $('[data-f="level"]', row);
            sel.value = lv;
            sel.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }
      });

      const build = () => {
        document.activeElement?.blur(); // flush the field being edited
        const dd = otDraft();
        Store.setMeta({ lastProf: dd.prof });
        return [dd.selected.map((id) => ({ id, ...Store.cases[id], standby: dd.standby.includes(id) })), dd];
      };
      if (!$('#ot-go', el)) return;
      const generate = (twice) => {
        const [cases, dd] = build();
        if ($('#ot-mark', el).checked) {
          cases.filter((c) => c.status !== 'posted').forEach((c) => Store.patch('cases', c.id, { status: 'posted', otDate: dd.date }));
        }
        // A real PDF file, not the print dialog: iPhone ignores window.print(), and the print dialog
        // adds the web-address strip (Safari even with zero margins). Phone: share sheet;
        // computer: opens in a new tab to print or save.
        SharePdf.otOpen(cases, dd, twice);
      };
      $('#ot-go', el).onclick = () => generate(false);
      $('#ot-go2', el).onclick = () => generate(true);
      $('#ot-wa', el).onclick = () => { const [cases, dd] = build(); SharePdf.ot(cases, dd); };
      $('#ot-mail', el).onclick = () => {
        const to = String(Store.meta.otEmail || '').trim();
        if (!to) return toast('Add the OT list email address in Settings first', 4000);
        const [cases, dd] = build();
        SharePdf.otEmail(cases, dd, to);
      };
      // Phones get a real PDF file (window.print is unreliable there); computers keep the print dialog.
      $('#ot-consent', el).onclick = () => { const [cases, dd] = build(); if (PhonePdf.isPhone()) PhonePdf.consents(cases, dd); else Print.consents(cases, dd, Store.meta); };
      $('#ot-xr', el).onclick = async () => {
        const [cases, dd] = build();
        toast('Collecting X-rays, CT and MRI…', 8000);
        const KINDS = [['xray', 'PRE-OP X-RAY', 3], ['ct', 'CT', 1], ['mri', 'MRI', 1]];
        const items = [];
        const none = [];
        for (const [i, c] of cases.entries()) {
          const sections = [];
          for (const [k, title, per] of KINDS) {
            const images = (await Promise.all(caseImages(c.id, k).map((im) => Store.getImage(im.id)))).filter(Boolean);
            if (images.length) sections.push({ title, images, per });
          }
          if (sections.length) items.push({ c, n: i + 1, sections });
          else none.push(c.name || 'Unnamed');
        }
        if (!items.length) return toast('None of these cases has a pre-op X-ray, CT or MRI uploaded yet.', 4000);
        toast(none.length ? `No pre-op imaging for: ${none.join(', ')} — left out.` : 'Ready', none.length ? 6000 : 1500);
        if (PhonePdf.isPhone()) PhonePdf.otXrays(items, dd); else Print.otXrays(items, dd);
      };
    },
  };

  // ---------------------------------------------------------------- Admission deck
  // Builds the unit's admission-day PowerPoint from the cases already in the
  // app (details + radiographs + wound pictures), using the admission-deck
  // tool's own slide engine so the slides look the same.
  const deckImgs = new Map(); // image id -> { data, w, h, url }
  const DECK_KEY = (date) => 'deck_' + date;

  function deckCfg(date) {
    return { cons: {}, extra: [], skip: [], order: [], split: {}, labels: {}, skipImg: {}, ...(Store.meta[DECK_KEY(date)] || {}) };
  }
  const saveDeckCfg = (date, cfg) => Store.setMeta({ [DECK_KEY(date)]: cfg });
  const stripProf = (s) => String(s || '').replace(/^PROF\.?\s*/i, '');

  function deckCases(date, cfg) {
    const all = caseList();
    const ids = new Set([...all.filter((c) => c.doa === date).map((c) => c.id), ...cfg.extra.filter((id) => Store.cases[id])]);
    cfg.skip.forEach((id) => ids.delete(id));
    const rank = (id) => { const i = cfg.order.indexOf(id); return i < 0 ? 1e9 : i; };
    // Cases not placed by hand follow their group case number (Case 10 before 11), then time added.
    const no = (c) => { const n = parseInt(c.caseNo, 10); return Number.isFinite(n) ? n : 1e9; };
    return [...ids].map((id) => ({ id, ...Store.cases[id] }))
      .sort((a, b) => rank(a.id) - rank(b.id) || no(a) - no(b) || (a.createdAt || 0) - (b.createdAt || 0));
  }

  // Image slides for a case: one slide per image type with the pictures side
  // by side, unless split into separate slides.
  // The image groups a case shows in the deck: the fixed kinds, then its custom batches.
  const deckKindsFor = (cid) => [...DECK_KINDS, ...[...new Set(caseImages(cid).map((im) => im.kind).filter((k) => /^custom-/.test(k)))]
    .sort((a, b) => parseInt(a.slice(7), 10) - parseInt(b.slice(7), 10)).map(imageKind)];

  function deckSlides(c, cfg) {
    const out = [];
    for (const k of deckKindsFor(c.id)) {
      const imgs = caseImages(c.id, k.k).filter((im) => !cfg.skipImg[im.id]);
      if (!imgs.length) continue;
      const key = c.id + ':' + k.k;
      const label = cfg.labels[key] || k.deck;
      if (cfg.split[key]) imgs.forEach((im) => out.push({ id: key + ':' + im.id, label, images: [im.id] }));
      else out.push({ id: key, label, images: imgs.map((im) => im.id) });
    }
    return out;
  }

  function deckState(date, cfg) {
    const m = Store.meta;
    return {
      unit: unitOf(m.unitId).id,
      date,
      professor: stripProf(cfg.professor ?? unitOf(m.unitId).chief),
      daos: cfg.daos || '',
      cons: cfg.cons,
      cases: deckCases(date, cfg).map((c) => ({
        id: c.id, status: c.deckStatus || '', name: c.name, ageSex: ageSex(c), ipNo: c.ipNo, phone: c.phone, address: c.address, mode: c.mode, diagnosis: c.diagnosis,
        treatment: c.treatment, writtenBy: c.writtenBy, slides: deckSlides(c, cfg),
      })),
    };
  }

  async function loadDeckImages(st) {
    const ids = st.cases.flatMap((c) => c.slides.flatMap((s) => s.images)).filter((id) => !deckImgs.has(id));
    for (const id of ids) {
      const data = await Store.getImage(id);
      if (!data) continue;
      const img = await new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = data; });
      if (img) deckImgs.set(id, { data, w: img.naturalWidth, h: img.naturalHeight, url: data });
    }
    return ids.length > 0;
  }

  function countCons(st) {
    const cs = st.cases;
    const S = DeckEngine.caseStatus;
    const n = (re) => { const x = cs.filter((c) => re.test(DeckEngine.up(c.mode))).length; return x ? String(x) : ''; };
    const st1 = (v) => cs.filter((c) => S(c) === v).length;
    const nil = (x) => (x ? String(x) : 'NIL');
    const op = st1('OPERATED');
    return {
      admissions: String(cs.length), major: String(op), minor: String(cs.length - op),
      deaths: st.cons.deaths || 'NIL', ama: nil(st1('AMA')), abscond: nil(st1('ABSCOND')), transfer: nil(st1('NEUROSURGERY T/O')),
      rta: n(/RTA/), tta: n(/TTA/), fall: n(/FALL/), assault: n(/ASSAULT/), accidental: n(/ACCIDENT/),
      self: n(/SELF/), electro: n(/ELECTR/), nmlc: n(/^\s*NMLC/),
    };
  }

  const CONS_UI = { admissions: 'Total admissions', major: 'Major procedures', minor: 'Minor procedures', deaths: 'Deaths', ama: 'AMA',
    abscond: 'Abscond', transfer: 'Transfer out to NS', rta: 'RTA', tta: 'TTA', fall: 'Fall injuries', assault: 'Assault',
    accidental: 'Accidental injury', self: 'Self inflicted', electro: 'Electrocution', nmlc: 'NMLC' };

  const Deck = {
    live: false,
    date: null,
    showPreview: false,
    render() {
      const date = Deck.date ||= todayISO();
      const cfg = deckCfg(date);
      const st = deckState(date, cfg);
      const chiefs = [...new Set(allUnits().map((u) => stripProf(u.chief)))];
      const aps = [...new Set(allUnits().flatMap((u) => u.aps))];
      const others = caseList().filter((c) => !st.cases.some((x) => x.id === c.id))
        .sort((a, b) => (b.doa || '').localeCompare(a.doa || '') || (a.name || '').localeCompare(b.name || ''));
      const thumbs = (c, k) => caseImages(c.id, k.k).map((im) => `
        <label class="dthumb${cfg.skipImg[im.id] ? ' off' : ''}"><img data-img="${im.id}" alt="">
          <input type="checkbox" data-skipimg="${im.id}" ${cfg.skipImg[im.id] ? '' : 'checked'} aria-label="Include in deck"></label>`).join('');
      return `
        <div class="toolbar">
          <h2>Admission day PPT</h2>
          <button class="btn primary" id="deck-dl" ${st.cases.length ? '' : 'disabled'}>Download PowerPoint</button>
        </div>
        <div class="card form">
          <fieldset><legend>Title slide</legend>
            <label>Date<input type="date" id="deck-date" value="${esc(date)}"></label>
            <label>Unit<input value="UNIT ${esc(st.unit)}" disabled></label>
            <label class="span2">Professor<input id="deck-prof" list="dl-chiefs" value="${esc(st.professor)}"></label>
            <label class="span2">DAOS<input id="deck-daos" list="dl-aps" value="${esc(st.daos)}"></label>
          </fieldset>
        </div>

        <div class="card">
          <div class="row-between"><h3>Cases (${st.cases.length})</h3>
            <span class="muted small">Admitted on ${esc(fmtDate(date))}${cfg.extra.length ? ' + added' : ''}</span></div>
          ${st.cases.map((c, i) => {
            const cc = Store.cases[c.id];
            if (!cc) return '';
            return `
            <div class="deck-case" data-dcase="${c.id}">
              <div class="row-between">
                <b>Case ${i + 1}${c.name ? ' · ' + esc(c.name) : ''} <span class="muted">${esc(c.ageSex)}</span></b>
                <span class="nowrap">
                  <button class="icon" data-dmove="-1" ${i ? '' : 'disabled'} title="Move up">↑</button>
                  <button class="icon" data-dmove="1" ${i < st.cases.length - 1 ? '' : 'disabled'} title="Move down">↓</button>
                  <button class="icon" data-dskip title="${cc.name ? 'Leave out of this deck' : 'Delete this blank case'}">✕</button>
                </span>
              </div>
              <div class="deck-fields">
                <label>Name<input data-cf="name" value="${esc(cc.name)}" autocomplete="off"></label>
                <label>Age/Sex<input data-agesex value="${esc(ageSex(cc))}" autocomplete="off"></label>
                <label>IP number <span class="hint">shown next to age/sex</span><input data-cf="ipNo" inputmode="numeric" value="${esc(cc.ipNo)}" autocomplete="off"></label>
                <label>Status<select data-cf="deckStatus"><option value="">No status</option>${opts(DeckEngine.STATUSES, cc.deckStatus || '')}</select></label>
                <label>Mode<input data-cf="mode" list="dl-mode" value="${esc(cc.mode)}"></label>
                <label class="span2">Diagnosis<textarea data-cf="diagnosis" rows="2">${esc(cc.diagnosis)}</textarea></label>
                <label>Phone number<input data-cf="phone" type="tel" inputmode="tel" value="${esc(cc.phone)}" autocomplete="off"></label>
                <label>Address<input data-cf="address" value="${esc(cc.address)}" autocomplete="off"></label>
                <label class="span2">Treatment <span class="hint">one item per line</span><textarea data-cf="treatment" rows="3">${esc(cc.treatment)}</textarea></label>
                <label class="span2">Case sheet written by<input data-cf="writtenBy" list="dl-pg" value="${esc(cc.writtenBy)}"></label>
              </div>
              ${deckKindsFor(c.id).filter((k) => caseImages(c.id, k.k).length).map((k) => {
                const key = c.id + ':' + k.k;
                return `<div class="deck-imgs">
                  <div class="row-between"><input class="deck-label" data-dlabel="${key}" value="${esc(cfg.labels[key] || k.deck)}" aria-label="Slide title">
                    <label class="small nowrap"><input type="checkbox" data-dsplit="${key}" ${cfg.split[key] ? 'checked' : ''}> separate slides</label></div>
                  <div class="dthumbs">${thumbs(c, k)}</div></div>`;
              }).join('')}
              <div class="img-adders deck-uploads">${[...DECK_KINDS, { k: 'custom', label: 'Custom' }].map((k) => `<label class="btn small">+ ${esc(k.label)}<input type="file" accept="image/*" multiple data-dupload="${k.k}" hidden></label>`).join('')}<span class="busy small muted"></span></div>
            </div>`;
          }).join('') || '<div class="empty">No cases on this date yet. Tap “+ Add case” below.</div>'}
          <div class="deck-add-row">
            <button class="btn primary" id="deck-new">+ Add case ${st.cases.length + 1}</button>
            <a class="btn wa" href="#/import/deck/${esc(date)}">From WhatsApp</a>
            <a class="btn" href="#/import/deck/${esc(date)}">From PowerPoint</a>
            ${others.length ? `<select id="deck-add" aria-label="Add an existing case"><option value="">or add an existing case…</option>${others.map((c) => `<option value="${c.id}">${esc(c.name)}${c.ipNo ? ' · IP ' + esc(c.ipNo) : ''} — DOA ${esc(fmtDate(c.doa))}</option>`).join('')}</select>` : ''}
          </div>
          ${cfg.skip.length ? `<p class="small"><button class="link" id="deck-unskip">Bring back ${cfg.skip.length} left-out case(s)</button></p>` : ''}
        </div>

        <div class="card">
          <div class="row-between"><h3>Consolidation</h3><button class="btn small" id="deck-count">Count from cases</button></div>
          <div class="cons-grid">
            ${[DeckEngine.CONS_LEFT, DeckEngine.CONS_RIGHT].map((col) => `<div>${col.map(([k]) => `<label class="cons-row">${CONS_UI[k]}<input data-cons="${k}" value="${esc(cfg.cons[k] ?? '')}"></label>`).join('')}</div>`).join('')}
          </div>
        </div>

        <div class="card">
          <div class="row-between"><h3>Slides</h3><button class="btn small" id="deck-pv">${Deck.showPreview ? 'Hide preview' : 'Show preview'}</button></div>
          <div id="deck-previews" class="deck-previews"${Deck.showPreview ? '' : ' hidden'}></div>
        </div>
        ${datalist('dl-chiefs', chiefs)}${datalist('dl-aps', aps)}${datalist('dl-mode', MODES)}${datalist('dl-pg', Store.meta.pgs || [])}`;
    },
    mount(el) {
      const date = Deck.date;
      const cfg = deckCfg(date);
      const save = (fn, rerender = true) => { fn(cfg); saveDeckCfg(date, cfg); if (rerender) render(); else drawPreview(); };
      $$('img[data-img]', el).forEach((img) => Store.getImage(img.dataset.img).then((src) => { if (src) img.src = src; }));

      const drawPreview = async () => {
        const box = $('#deck-previews', el);
        if (!box || box.hidden) return;
        const st = deckState(date, deckCfg(date));
        const paint = () => {
          const models = DeckEngine.buildModels(st, Object.fromEntries(deckImgs));
          let n = 0;
          box.innerHTML = models.filter((m) => !(m.kind === 'image' && !m.imgs.length)).map((m) => `
            <div class="pslide"><div class="meta"><b>Slide ${++n}</b></div><div class="slide">${DeckEngine.slideHTML(m)}</div></div>`).join('');
        };
        paint();
        if (await loadDeckImages(st)) paint();
      };
      drawPreview();

      $('#deck-date', el).onchange = (e) => { Deck.date = e.target.value || todayISO(); render(); };
      $('#deck-prof', el).onchange = (e) => save((x) => { x.professor = e.target.value.trim().toUpperCase(); }, false);
      $('#deck-daos', el).onchange = (e) => save((x) => { x.daos = e.target.value.trim().toUpperCase(); }, false);
      $('#deck-pv', el).onclick = () => { Deck.showPreview = !Deck.showPreview; render(); };
      $('#deck-count', el).onclick = () => save((x) => { x.cons = countCons(deckState(date, x)); });
      // A case added here is a real ward case: admitted on the deck's date.
      $('#deck-new', el).onclick = () => {
        const nid = uid();
        Store.create('cases', nid, {
          name: '', doa: date, status: 'preop', work: {}, treatment: STANDARD_TREATMENT.join('\n'),
          writtenBy: '',
        });
        save((x) => { x.order = [...deckCases(date, x).map((c) => c.id).filter((i) => i !== nid), nid]; });
        const card = $(`[data-dcase="${nid}"]`, App.el);
        if (card) {
          card.scrollIntoView({ behavior: 'smooth', block: 'start' });
          setTimeout(() => $('[data-cf=name]', card)?.focus({ preventScroll: true }), 350);
        }
      };
      const add = $('#deck-add', el);
      if (add) add.onchange = () => save((x) => { x.extra = [...new Set([...x.extra, add.value])]; x.skip = x.skip.filter((i) => i !== add.value); });
      const uns = $('#deck-unskip', el);
      if (uns) uns.onclick = () => save((x) => { x.skip = []; });

      el.addEventListener('change', (e) => {
        const t = e.target;
        const cid = t.closest('[data-dcase]')?.dataset.dcase;
        if (t.dataset.agesex !== undefined && cid) {
          // "66/M", "66 M", "66yrs/F" → age and sex on the ward case.
          const m = t.value.trim().match(/^(\d{1,3})\s*(?:y(?:rs?|ears?)?)?\s*[/,\s-]?\s*([mfo])?/i);
          Store.patch('cases', cid, m ? { age: m[1], ...(m[2] ? { sex: m[2].toUpperCase() } : {}) } : { age: t.value.trim() });
          render();
        } else if (t.dataset.dupload && cid) {
          const files = [...t.files];
          let kind = t.dataset.dupload;
          t.value = '';
          // Custom: a new slide group per upload, with its own editable title.
          if (kind === 'custom') {
            const n = Math.max(0, ...caseImages(cid).map((im) => (/^custom-(\d+)$/.exec(im.kind) || [0, 0])[1] * 1));
            kind = 'custom-' + (n + 1);
          }
          (async () => {
            const busy = $('.busy', t.closest('[data-dcase]'));
            for (let i = 0; i < files.length; i++) {
              if (busy) busy.textContent = `Adding image ${i + 1} of ${files.length}…`;
              try {
                await Store.addImage(cid, kind, await compressImage(files[i]), files[i].name.replace(/\.[^.]+$/, ''));
              } catch (err) {
                toast(`"${files[i].name}" couldn't be opened as an image. Use JPG or PNG.`, 4000);
              }
            }
            render();
            if (/^custom-/.test(kind)) {
              const title = $(`[data-dlabel="${cid}:${kind}"]`, App.el);
              if (title) { title.scrollIntoView({ block: 'center' }); title.focus(); title.select(); toast('Type a title for this slide'); }
            }
          })();
        } else if (t.dataset.cf && cid) {
          const v = t.value.trim();
          const ch = { [t.dataset.cf]: v };
          const cur = Store.cases[cid];
          if (t.dataset.cf === 'diagnosis' && !hasText(cur.plan)) {
            const plan = defaultPlanFor(v);
            if (plan) Object.assign(ch, { plan, implants: suggestImplantsFor(plan, v, Store.implants).implants, level: levelFor(plan, Store.levels).level });
          }
          Store.patch('cases', cid, ch);
          if (t.dataset.cf === 'deckStatus' || t.dataset.cf === 'name') render(); else drawPreview();
        } else if (t.dataset.skipimg) {
          save((x) => { if (t.checked) delete x.skipImg[t.dataset.skipimg]; else x.skipImg[t.dataset.skipimg] = true; }, false);
          t.closest('.dthumb').classList.toggle('off', !t.checked);
        } else if (t.dataset.dsplit) {
          save((x) => { x.split[t.dataset.dsplit] = t.checked; }, false);
        } else if (t.dataset.dlabel) {
          save((x) => { x.labels[t.dataset.dlabel] = t.value.trim().toUpperCase(); }, false);
        } else if (t.dataset.cons) {
          save((x) => { x.cons[t.dataset.cons] = t.value.trim().toUpperCase(); }, false);
        }
      });
      el.addEventListener('click', (e) => {
        const b = e.target.closest('button');
        const cid = b?.closest('[data-dcase]')?.dataset.dcase;
        if (!b || !cid) return;
        if (b.dataset.dmove) {
          save((x) => {
            const ids = deckCases(date, x).map((c) => c.id);
            const i = ids.indexOf(cid);
            const j = i + Number(b.dataset.dmove);
            [ids[i], ids[j]] = [ids[j], ids[i]];
            x.order = ids;
          });
        } else if (b.dataset.dskip !== undefined) {
          const cc = Store.cases[cid];
          if (cc && !hasText(cc.name) && !Object.keys(cc.images || {}).length) {
            Store.remove('cases', cid); // a blank card added by mistake
            save((x) => { x.order = x.order.filter((i) => i !== cid); });
            return;
          }
          save((x) => { x.skip = [...new Set([...x.skip, cid])]; x.extra = x.extra.filter((i) => i !== cid); });
        }
      });

      $('#deck-dl', el).onclick = async (e) => {
        const btn = e.currentTarget;
        document.activeElement?.blur();
        btn.disabled = true;
        btn.textContent = 'Building…';
        try {
          const st = deckState(date, deckCfg(date));
          await loadDeckImages(st);
          const pres = DeckEngine.buildPptx(window.PptxGenJS, st, Object.fromEntries(deckImgs));
          const blob = await pres.write({ outputType: 'blob' });
          const name = `ORTHO_UNIT_${st.unit}_${fmtDate(date).replace(/\//g, '_')}.pptx`;
          const file = new File([blob], name, { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' });
          offerFile(file);
        } catch (err) {
          console.error(err);
          toast('Could not build the PowerPoint: ' + err.message, 5000);
        } finally {
          btn.disabled = false;
          btn.textContent = 'Download PowerPoint';
        }
      };
    },
  };

  // ---------------------------------------------------------------- Post-op PPT
  // Operated cases → one details slide each (name, age/sex, diagnosis,
  // procedure, implants, surgeon, assistant) followed by pre-op X-ray,
  // pre-op CT / MRI and post-op X-ray, in the admission deck's slide style.
  const surgeryDate = (c) => c.surgeryDate || c.otDate || c.discharge?.dos || '';
  const isOperated = (c) => !!(c.surgeryDate || hasText(c.opNotes) || hasText(c.procedureDone) || c.deckStatus === 'OPERATED'
    || caseImages(c.id, 'poxray').length || ((c.status === 'postop' || c.status === 'discharged') && c.otDate));
  const POSTOP_SEL = 'wm.v1.postopSel';
  const postopSel = () => { try { return JSON.parse(localStorage.getItem(POSTOP_SEL)) || []; } catch { return []; } };
  const setPostopSel = (ids) => { try { localStorage.setItem(POSTOP_SEL, JSON.stringify(ids)); } catch { /* ignore */ } };

  function postopState(ids) {
    const slidesFor = (c) => [['xray', 'PRE-OP X-RAY'], ['ct', 'PRE-OP CT'], ['mri', 'PRE-OP MRI'], ['poxray', 'POST-OP X-RAY']]
      .map(([k, label]) => ({ id: c.id + ':' + k, label, images: caseImages(c.id, k).map((im) => im.id) }))
      .filter((x) => x.images.length);
    return {
      noCover: true,
      unit: unitOf(Store.meta.unitId).id,
      date: todayISO(),
      cons: {},
      cases: ids.map((id) => ({ id, ...Store.cases[id] })).filter((c) => c.name !== undefined).map((c) => ({
        id: c.id,
        status: '',
        rows: [
          { k: 'NAME', v: DeckEngine.up(c.name), kb: true, vb: true },
          { k: 'AGE/SEX', v: DeckEngine.up(ageSex(c)), vb: true },
          { k: 'DIAGNOSIS', v: DeckEngine.up(c.diagnosis), vb: true, diag: true },
          { k: 'PROCEDURE DONE', v: DeckEngine.up(c.procedureDone || c.plan) },
          { k: 'IMPLANTS', v: DeckEngine.up(c.implantsUsed || extractImplants(c.opNotes) || c.implants) },
          { k: 'SURGEON', v: DeckEngine.up(c.surgeon) },
          { k: 'ASSISTANT SURGEON', v: DeckEngine.up(c.assistants) },
        ],
        slides: slidesFor(c),
      })),
    };
  }

  const PostOp = {
    live: false,
    from: null,
    to: null,
    all: false,
    showPreview: false,
    render() {
      PostOp.to ||= todayISO();
      PostOp.from ||= todayISO(-14);
      const sel = postopSel().filter((id) => Store.cases[id]);
      const list = allCases().filter(isOperated)
        .filter((c) => PostOp.all || sel.includes(c.id) || !surgeryDate(c) || (surgeryDate(c) >= PostOp.from && surgeryDate(c) <= PostOp.to))
        .sort((a, b) => surgeryDate(b).localeCompare(surgeryDate(a)) || (a.name || '').localeCompare(b.name || ''));
      const cnt = (c, ...ks) => ks.reduce((n, k) => n + caseImages(c.id, k).length, 0);
      const missing = (c) => [!hasText(c.surgeon) && 'surgeon', !hasText(c.implantsUsed || extractImplants(c.opNotes) || c.implants) && 'implants', !cnt(c, 'poxray') && 'post-op X-ray'].filter(Boolean);
      return `
        <div class="toolbar">
          <h2>Post-operative PPT</h2>
          <button class="btn primary" id="po-dl" ${sel.length ? '' : 'disabled'}>Download PowerPoint (${sel.length})</button>
        </div>
        <div class="card">
          <h3>Operated cases</h3>
          <div class="po-filter">
            <label>Operated from<input type="date" id="po-from" value="${esc(PostOp.from)}"></label>
            <label>to<input type="date" id="po-to" value="${esc(PostOp.to)}"></label>
            <label class="small nowrap"><input type="checkbox" id="po-all" ${PostOp.all ? 'checked' : ''}> show all</label>
          </div>
          <p class="muted small">A case shows here once it has a date of surgery, operative notes, procedure done or a post-op X-ray (fill these under <b>Operative details</b> on the case page).</p>
          <div class="table-wrap">
            <table class="board picker po-table">
              <thead><tr><th></th><th>Name</th><th>Age/Sex</th><th>Diagnosis</th><th>Procedure done</th><th>Surgery</th><th>Images</th><th></th></tr></thead>
              <tbody>
                ${list.map((c) => {
                  const miss = missing(c);
                  return `<tr class="${sel.includes(c.id) ? 'picked' : ''}" data-row="${c.id}">
                    <td><input type="checkbox" data-po="${c.id}" ${sel.includes(c.id) ? 'checked' : ''} aria-label="Select ${esc(c.name)}"></td>
                    <td><b>${esc(c.name)}</b>${miss.length ? `<div class="miss small">missing: ${esc(miss.join(', '))}</div>` : ''}</td>
                    <td class="nowrap">${esc(ageSex(c))}</td>
                    <td>${esc(c.diagnosis)}</td>
                    <td>${esc(c.procedureDone || c.plan)}</td>
                    <td class="nowrap">${esc(fmtDate(surgeryDate(c))) || '—'}</td>
                    <td class="nowrap small">Pre X ${cnt(c, 'xray')} · CT/MRI ${cnt(c, 'ct', 'mri')} · Post X ${cnt(c, 'poxray')}</td>
                    <td><a href="#/case/${c.id}" class="small" data-nopick>Edit</a></td>
                  </tr>`;
                }).join('') || '<tr><td colspan="8" class="empty">No operated cases in this range.</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>
        <div class="card">
          <div class="row-between"><h3>Slides</h3><button class="btn small" id="po-pv">${PostOp.showPreview ? 'Hide preview' : 'Show preview'}</button></div>
          <div id="po-previews" class="deck-previews"${PostOp.showPreview ? '' : ' hidden'}></div>
        </div>`;
    },
    mount(el) {
      const ids = () => postopSel().filter((id) => Store.cases[id]);
      const drawPreview = async () => {
        const box = $('#po-previews', el);
        if (!box || box.hidden) return;
        const st = postopState(ids());
        const paint = () => {
          let n = 0;
          box.innerHTML = DeckEngine.buildModels(st, Object.fromEntries(deckImgs)).filter((m) => !(m.kind === 'image' && !m.imgs.length))
            .map((m) => `<div class="pslide"><div class="meta"><b>Slide ${++n}</b></div><div class="slide">${DeckEngine.slideHTML(m)}</div></div>`).join('')
            || '<p class="muted">Tick cases above.</p>';
        };
        paint();
        if (await loadDeckImages(st)) paint();
      };
      drawPreview();
      $('#po-from', el).onchange = (e) => { PostOp.from = e.target.value; render(); };
      $('#po-to', el).onchange = (e) => { PostOp.to = e.target.value; render(); };
      $('#po-all', el).onchange = (e) => { PostOp.all = e.target.checked; render(); };
      $('#po-pv', el).onclick = () => { PostOp.showPreview = !PostOp.showPreview; render(); };
      el.addEventListener('click', (e) => {
        if (e.target.closest('[data-nopick]')) return;
        const row = e.target.closest('[data-row]');
        if (!row) return;
        const cid = row.dataset.row;
        const cur = ids();
        const on = e.target.matches('[data-po]') ? e.target.checked : !cur.includes(cid);
        setPostopSel(on ? [...new Set([...cur, cid])] : cur.filter((x) => x !== cid));
        render();
      });
      $('#po-dl', el).onclick = async (e) => {
        const btn = e.currentTarget;
        btn.disabled = true;
        btn.textContent = 'Building…';
        try {
          const st = postopState(ids());
          await loadDeckImages(st);
          const pres = DeckEngine.buildPptx(window.PptxGenJS, st, Object.fromEntries(deckImgs));
          const blob = await pres.write({ outputType: 'blob' });
          const name = `POST_OP_CASES_UNIT_${st.unit}_${fmtDate(todayISO()).replace(/\//g, '_')}.pptx`;
          offerFile(new File([blob], name, { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' }));
        } catch (err) {
          console.error(err);
          toast('Could not build the PowerPoint: ' + err.message, 5000);
        } finally {
          btn.disabled = false;
          btn.textContent = `Download PowerPoint (${ids().length})`;
        }
      };
    },
  };

  // Phones need a fresh tap for Save / Share, so ask in a small sheet.
  function offerFile(file) {
    const saveIt = () => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(file);
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 60000);
    };
    const canShare = (() => { try { return !!(navigator.canShare && navigator.canShare({ files: [file] })); } catch { return false; } })();
    if (!matchMedia('(pointer: coarse)').matches) {
      saveIt();
      toast('Downloaded ' + file.name);
      return;
    }
    const m = $('#modal');
    m.innerHTML = `<div class="sheet card"><h3>PowerPoint is ready</h3><p class="muted small">${esc(file.name)} (${(file.size / 1048576).toFixed(1)} MB)</p>
      <div class="actions"><button class="btn primary" data-f="save">Save to device</button>${canShare ? '<button class="btn" data-f="share">Share (WhatsApp, Drive, Files…)</button>' : ''}<button class="btn" data-f="close">Close</button></div></div>`;
    m.classList.add('sheet-wrap');
    m.hidden = false;
    const close = () => { m.hidden = true; m.classList.remove('sheet-wrap'); m.innerHTML = ''; };
    m.onclick = async (e) => {
      const f = e.target.closest('[data-f]')?.dataset.f;
      if (f === 'save') saveIt();
      if (f === 'share') { try { await navigator.share({ files: [file], title: file.name }); close(); } catch (err) { if (err.name !== 'AbortError') toast('Sharing did not work here. Try Save to device.'); } }
      if (f === 'close' || e.target === m) close();
    };
  }

  // ---------------------------------------------------------------- Discharge
  function investigationsText(c) {
    const lines = [];
    for (const g of LAB_GROUPS) {
      const vals = g.params.map((p) => {
        const l = latest(c, p.k);
        return l ? `${p.label} ${fmtVal(l.value, p)}` : '';
      }).filter(Boolean);
      if (vals.length) lines.push(`${g.k === 'inflam' ? '' : g.label + ': '}${vals.join(', ')}`);
    }
    const cust = customParams(c).map((p) => {
      const l = latest(c, p.k);
      return l ? `${p.label} ${fmtVal(l.value, p)}` : '';
    }).filter(Boolean);
    if (cust.length) lines.push(cust.join(', '));
    if (hasText(c.pus?.organism)) lines.push(`PUS C/S: ${c.pus.organism}${hasText(c.pus.sensitive) ? ' — SENSITIVE TO ' + c.pus.sensitive : ''}`);
    for (const w of WORKUP) if (workText(c, w)) lines.push(`${w.label}: ${workText(c, w)}`);
    return lines.join('\n');
  }

  // Kinds used for the discharge files, in slide/page order.
  const DC_KINDS = ['wound', 'xray', 'poxray', 'powound'];
  function dcImgsHTML(id) {
    return DC_KINDS.map((k) => {
      const kind = imageKind(k);
      const imgs = caseImages(id, k);
      const pre = k === 'xray' ? 'Pre-op X-ray' : k === 'wound' ? 'Pre-op wound pic' : kind.label;
      return `<div class="kindbox${imgs.length ? '' : ' missing'}"><b>${esc(pre)} (${imgs.length})</b>
        <div class="mini">${imgs.map((im) => `<img data-img="${im.id}" alt="">`).join('')}</div>
        <label class="btn small">+ Add<input type="file" accept="image/*" multiple data-dcup="${k}" hidden></label></div>`;
    }).join('');
  }
  const loadThumbs = (root) => $$('img[data-img]', root).forEach((img) => Store.getImage(img.dataset.img).then((src) => { if (src) img.src = src; }));

  function Discharge(id) {
    // [key, label, rows, helper button]
    const FIELDS = [
      ['diagnosis', 'Diagnosis in detail', 2],
      ['procedure', 'Procedure in detail', 2],
      ['unitLine', 'Unit / consultants', 1],
      ['history', 'H/O injury / illness', 6],
      ['past', 'Past history / treatment history', 4, ['past', '↻ template']],
      ['exam', 'Examination findings', 12, ['exam', '↻ template']],
      ['investigations', 'Investigations (optional)', 3, ['inv', '↻ from case']],
      ['treatment', 'Treatment given', 6],
      ['course', 'Course in hospital', 5, ['course', '↻ auto-write']],
      ['condition', 'Condition on discharge', 4],
      ['meds', 'Discharge medications (optional)', 3],
    ];
    return {
      live: false,
      render() {
        const c = Store.cases[id];
        if (!c) return notFound();
        const m = Store.meta;
        const unit = unitName(m.unitId);
        const d = {
          disposition: 'discharge',
          dod: todayISO(),
          dos: c.surgeryDate || c.otDate || '',
          consultant: unit,
          unitLine: unit,
          doctor: 'ORTHO ' + unit,
          attender: c.attender,
          phone: c.phone,
          address: c.address,
          diagnosis: c.diagnosis,
          procedure: c.procedureDone || c.plan,
          past: pastTemplate(c),
          exam: EXAM_TEMPLATE,
          treatment: [...DRUGS_ALL, ...(isSpinePelvis(c) ? DRUGS_SPINE_PELVIS : [])].join('\n'),
          condition: 'PATIENT VITALS STABLE',
          ...(c.discharge || {}),
        };
        if (d.disposition === 'lama') d.disposition = 'ama';
        if (!d.course) d.course = courseTemplate(c, d);
        const sp = isSpinePelvis(c);
        const drugBtns = `<div class="span2 drug-btns">
            <button type="button" class="chip" data-drugset="all">+ All-case drugs</button>
            <button type="button" class="chip${sp ? ' suggest' : ''}" data-drugset="spine">+ Spine / pelvis set${sp ? ' (suggested)' : ''}</button>
          </div>
          <div class="span2 drug-btns"><span class="muted small">Antibiotics:</span>${ANTIBIOTICS.map((a, i) => `<button type="button" class="chip" data-abx="${i}">+ ${esc(a)}</button>`).join('')}</div>`;
        const field = ([k, l, rows, btn]) => `<label class="span2">${l}${btn ? ` <button type="button" class="link small" data-tpl="${btn[0]}">${btn[1]}</button>` : ''}<textarea name="${k}" rows="${rows}">${esc(d[k])}</textarea></label>${k === 'treatment' ? drugBtns : ''}`;
        return `
          <h2>Discharge / transfer — ${esc(c.name)} <span class="muted small">${esc(ageSex(c))} · IP ${esc(c.ipNo)}</span></h2>
          <form id="dc-form" class="card form" autocomplete="off">
            <fieldset><legend>Disposition</legend>
              <div class="span2 radios">${Object.entries(DISPOSITIONS).map(([k, v]) => `<label class="chip ${d.disposition === k ? 'on' : ''}"><input type="radio" name="disposition" value="${k}" ${d.disposition === k ? 'checked' : ''} hidden>${v.label}</label>`).join('')}</div>
              <div class="span2 dc-quick">
                <p class="muted small">No discharge summary for AMA, absconded or expired — the case is just closed.</p>
                <div class="dc-quick-row">
                  <label>Date<input type="date" id="dq-date" value="${esc(d.dod)}"></label>
                  <button type="button" class="btn primary" id="dc-dispose">Dispose case</button>
                </div>
              </div>
            </fieldset>
            <fieldset><legend>Patient box</legend>
              <label>AR number<input name="arNo" value="${esc(d.arNo)}"></label>
              <label>Consultant<input name="consultant" value="${esc(d.consultant)}"></label>
              <label>Date of surgery<input type="date" name="dos" value="${esc(d.dos)}"></label>
              <label>Date of discharge / transfer<input type="date" name="dod" value="${esc(d.dod)}"></label>
              <label>Time<input name="dodTime" value="${esc(d.dodTime)}"></label>
              <label>Attender<input name="attender" value="${esc(d.attender)}"></label>
              <label>Ph. no<input name="phone" type="tel" value="${esc(d.phone)}"></label>
              <label>Contact no (optional)<input name="contact" type="tel" value="${esc(d.contact)}"></label>
              <label class="span2">Address<input name="address" value="${esc(d.address)}"></label>
            </fieldset>
            <fieldset><legend>Summary</legend>
              ${FIELDS.map(field).join('')}
            </fieldset>
            <fieldset><legend>Discharge advice</legend>
              <div class="span2 chips">${ADVICE_PHRASES.map(([en], i) => `<button type="button" class="chip" data-phrase="${i}">+ ${esc(en)}</button>`).join('')}</div>
              <div class="span2 review-row">
                <span>Review after</span>
                <input id="rv-weeks" type="number" min="1" value="2">
                <span>weeks on</span>
                <select id="rv-day">${opts(EN_DAYS.slice(1), 'MONDAY')}</select>
                <span>OPD</span><input id="rv-opd" value="${esc(m.opd || '')}">
                <button type="button" class="btn small" id="rv-add">+ Add review</button>
              </div>
              <label class="span2">Advice (English)<textarea name="advice" rows="4">${esc(d.advice)}</textarea></label>
              <label class="span2">Advice (Tamil — printed below, one line each)<textarea name="adviceTa" rows="4" lang="ta">${esc(d.adviceTa)}</textarea></label>
              <label class="span2">Discharging doctor<input name="doctor" value="${esc(d.doctor)}"></label>
            </fieldset>
            <div class="form-actions">
              <button class="btn" type="button" id="dc-save">Save draft</button>
              <button class="btn primary" type="submit">Save & generate PDF</button>
              <a class="btn" href="#/case/${id}">Back</a>
            </div>
            <label class="small"><input type="checkbox" id="dc-status" checked> Update case status (Transfer → Post-op, others → Discharged)</label>
          </form>

          <div class="card">
            <h3>Discharge files</h3>
            <div class="dc-imgs" id="dc-imgs">${dcImgsHTML(id)}</div>
            <div class="dc-out">
              <div class="out-row"><div><b>1 · Discharge summary PDF</b><div class="muted small">The summary above, in the unit's format.</div></div>
                <button type="button" class="btn primary" id="out-summary">Generate PDF</button></div>
              <div class="out-row"><div><b>2 · Radiographs PDF</b><div class="muted small">Pre-op X-ray, post-op X-ray and post-op wound pic, one page each.</div></div>
                <button type="button" class="btn primary" id="out-imgs">Generate PDF</button></div>
              <div class="out-row"><div><b>3 · Discharge PowerPoint</b><div class="muted small">Patient slide (name, age/sex, IP no., DOA/DOS/DOD, diagnosis, procedure, phone, address), then pre-op X-ray, wound pic if any, post-op X-ray, then the discharge summary (one page per slide). Saved as NAME_AGE-SEX_IPNO.</div></div>
                <button type="button" class="btn primary" id="out-ppt">Download PowerPoint</button></div>
            </div>
          </div>`;
      },
      mount(el) {
        const f = $('#dc-form', el);
        if (!f) return;
        const c = () => Store.cases[id];
        const data = () => Object.fromEntries(new FormData(f).entries());
        const addLine = (name, line) => {
          const ta = f.elements[name];
          if (!ta.value.split('\n').includes(line)) ta.value = (ta.value.trim() ? ta.value.trim() + '\n' : '') + line;
        };
        const quickMode = () => {
          const k = f.elements.disposition.value;
          const q = !!DISPOSITIONS[k]?.quick;
          el.dataset.quick = q ? '1' : '';
          if (q) $('#dc-dispose', el).textContent = `Dispose as ${DISPOSITIONS[k].label}`;
        };
        quickMode();
        $('#dc-dispose', el).onclick = () => {
          const k = f.elements.disposition.value;
          const dod = $('#dq-date', el).value || todayISO();
          const cur = Store.cases[id];
          Store.patch('cases', id, { status: DISPOSITIONS[k].status, discharge: { ...(cur.discharge || {}), disposition: k, dod } });
          toast(`${cur.name || 'Case'} disposed — ${DISPOSITIONS[k].label}`, 3500);
          location.hash = '#/';
        };
        f.addEventListener('change', (e) => {
          if (e.target.name !== 'disposition') return;
          $$('.radios .chip', f).forEach((l) => l.classList.toggle('on', l.querySelector('input').checked));
          quickMode();
          // Keep the closing line of the course in step with the disposition.
          const course = f.elements.course;
          const hit = Object.values(DISPOSITIONS).map((x) => x.course).find((x) => course.value.trim().endsWith(x));
          if (hit) course.value = course.value.trim().slice(0, -hit.length) + DISPOSITIONS[e.target.value].course;
        });
        loadThumbs(el);
        f.addEventListener('click', (e) => {
          const ds = e.target.closest('[data-drugset],[data-abx]');
          if (ds) {
            const lines = ds.dataset.abx !== undefined ? [ANTIBIOTICS[ds.dataset.abx]] : ds.dataset.drugset === 'spine' ? DRUGS_SPINE_PELVIS : DRUGS_ALL;
            lines.forEach((l) => addLine('treatment', l));
            return;
          }
          const t = e.target.closest('[data-tpl],[data-phrase]');
          if (!t) return;
          if (t.dataset.phrase) {
            const [en, ta] = ADVICE_PHRASES[t.dataset.phrase];
            addLine('advice', en);
            addLine('adviceTa', ta);
          } else if (t.dataset.tpl === 'inv') f.elements.investigations.value = investigationsText(c());
          else if (t.dataset.tpl === 'exam') f.elements.exam.value = EXAM_TEMPLATE;
          else if (t.dataset.tpl === 'past') f.elements.past.value = pastTemplate(c());
          else if (t.dataset.tpl === 'course') f.elements.course.value = courseTemplate(c(), data());
        });
        $('#rv-add', el).onclick = () => {
          const opd = $('#rv-opd', el).value.trim();
          const [en, ta] = reviewPhrase($('#rv-weeks', el).value, $('#rv-day', el).value, opd);
          addLine('advice', en);
          addLine('adviceTa', ta);
          if (opd && opd !== Store.meta.opd) Store.setMeta({ opd });
        };
        const save = () => {
          const d = data();
          Store.patch('cases', id, { discharge: d });
          return d;
        };
        $('#dc-save', el).onclick = () => {
          save();
          toast('Draft saved');
        };
        f.onsubmit = (e) => {
          e.preventDefault();
          const d = save();
          if ($('#dc-status', el).checked) {
            const st = DISPOSITIONS[d.disposition].status;
            if (st === 'postop' && c().status !== 'postop') transferToPostop(id);
            else if (c().status !== st) Store.patch('cases', id, { status: st });
          }
          if (PhonePdf.isPhone()) PhonePdf.discharge(c(), d, Store.meta);
          else Print.discharge(c(), d, Store.meta);
        };
        $('#out-summary', el).onclick = () => f.requestSubmit();

        // Post-op pictures can be added right here.
        el.addEventListener('change', async (e) => {
          const k = e.target.dataset.dcup;
          if (!k) return;
          const files = [...e.target.files];
          e.target.value = '';
          for (const file of files) {
            try {
              toast(`Uploading ${file.name}…`, 6000);
              await Store.addImage(id, k, await compressImage(file), file.name.replace(/\.[^.]+$/, ''));
            } catch (err) {
              toast('Upload failed: ' + (err.code || err.message), 5000);
            }
          }
          toast('Uploaded');
          $('#dc-imgs', el).innerHTML = dcImgsHTML(id);
          loadThumbs($('#dc-imgs', el));
        });

        const imageData = async (k) => (await Promise.all(caseImages(id, k).map((im) => Store.getImage(im.id)))).filter(Boolean);
        $('#out-imgs', el).onclick = async () => {
          const d = save();
          const sections = [];
          for (const [k, title] of [['xray', 'PRE-OP X-RAY'], ['poxray', 'POST-OP X-RAY'], ['powound', 'POST-OP WOUND PIC']]) {
            const images = await imageData(k);
            if (images.length) sections.push({ title, images });
          }
          if (!sections.length) return toast('No pre-op X-ray, post-op X-ray or post-op wound pic uploaded yet.', 4000);
          const missing = ['PRE-OP X-RAY', 'POST-OP X-RAY', 'POST-OP WOUND PIC'].filter((t) => !sections.some((x) => x.title === t));
          if (missing.length) toast('Not uploaded, left out: ' + missing.join(', '), 4000);
          if (PhonePdf.isPhone()) PhonePdf.radiographs(c(), d, sections, Store.meta);
          else Print.imagesPdf(c(), d, sections, Store.meta);
        };

        $('#out-ppt', el).onclick = async (e) => {
          const btn = e.currentTarget;
          const d = save();
          const cc = c();
          const fd = (iso) => (iso ? fmtDate(iso).replace(/\//g, '.') : '—');
          const statusOf = { dar: 'DISCHARGED AT REQUEST', ama: 'AMA', absconded: 'ABSCOND', postop: 'TRANSFERRED TO POST-OP WARD' };
          const want = [['xray', 'PRE-OP X-RAY'], ['wound', 'WOUND PIC'], ['poxray', 'POST-OP X-RAY']];
          const slides = want.map(([k, label]) => ({ id: 'dc-' + k, label, images: caseImages(id, k).map((im) => im.id) })).filter((x) => x.images.length);
          const st = {
            noCover: true,
            unit: unitOf(Store.meta.unitId).id,
            date: d.dod || todayISO(),
            cons: {},
            cases: [{
              id,
              title: 'DISCHARGE SUMMARY',
              status: statusOf[d.disposition] || '',
              rows: [
                { k: 'NAME', v: DeckEngine.up(cc.name), kb: true, vb: true },
                { k: 'AGE/SEX', v: DeckEngine.up(ageSex(cc)), vb: true },
                { k: 'IP NO', v: DeckEngine.up(cc.ipNo) },
                { k: 'DOA / DOS / DOD', v: `${fd(cc.doa)} / ${fd(d.dos)} / ${fd(d.dod)}` },
                { k: 'DIAGNOSIS', v: DeckEngine.up(d.diagnosis || cc.diagnosis), vb: true, diag: true },
                { k: 'PROCEDURE DONE', v: DeckEngine.up(d.procedure || cc.plan) },
                { k: 'PHONE NO', v: (cc.phone || '').trim() },
                { k: 'ADDRESS', v: DeckEngine.up(cc.address).replace(/\s*\n\s*/g, ', ') },
              ],
              slides,
            }],
          };
          btn.disabled = true;
          btn.textContent = 'Building…';
          try {
            await loadDeckImages(st);
            st.pages = await DcPages.render(cc, d, Store.meta); // the discharge summary, a page per slide, at the end
            st.pageAspect = DcPages.ASPECT;
            const pres = DeckEngine.buildPptx(window.PptxGenJS, st, Object.fromEntries(deckImgs));
            const blob = await pres.write({ outputType: 'blob' });
            // NAME_AGE-SEX_IPNO.pptx — a "/" isn't allowed in file names, so 26/M is written 26-M.
            const part = (x) => DeckEngine.up(x).replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
            const name = [part(cc.name) || 'PATIENT', [cc.age, cc.sex].map((x) => part(x)).filter(Boolean).join('-'), part(cc.ipNo)].filter(Boolean).join('_') + '.pptx';
            offerFile(new File([blob], name, { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' }));
            if (!slides.length) toast('No X-rays uploaded yet — the PowerPoint has only the summary slide.', 4000);
          } catch (err) {
            console.error(err);
            toast('Could not build the PowerPoint: ' + err.message, 5000);
          } finally {
            btn.disabled = false;
            btn.textContent = 'Download PowerPoint';
          }
        };
      },
    };
  }

  // ---------------------------------------------------------------- Settings
  function implantSection() {
    const rules = Object.entries(Store.implants).map(([id, r]) => ({ ...r, id }))
      .sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || (a.name || '').localeCompare(b.name || ''));
    const how = (r) => (r.keywords?.length
      ? `plan has: ${r.keywords.slice(0, 3).join(', ')}${r.keywords.length > 3 ? '…' : ''}${r.site?.length ? ` · site: ${r.site.slice(0, 4).join(', ')}${r.site.length > 4 ? '…' : ''}` : ''}`
      : 'plan contains the procedure name');
    return `
      <div class="card" id="implants">
        <h3>Implant database</h3>
        <p class="small"><b>Searched first:</b> your previous OT lists — ${OT_HISTORY.length} cases from ${esc(fmtDate(OT_HISTORY.at(-1).date))} to ${esc(fmtDate(OT_HISTORY[0].date))}. The most similar past case (same procedure and bone; side and spelling ignored) gives the implants exactly as written then. <b>Backup:</b> the reference list below.</p>
        <p class="muted small">When a case's plan matches an entry below, its implants fill in automatically (several matches are combined). Your own entries match on the procedure name, e.g. “SHORT PFN” matches “CR/ORIF WITH SHORT PFN LEFT”; the unit's list also checks the bone in the plan or diagnosis, as shown under each name.</p>
        <div class="table-wrap">
          <table class="board impl-table">
            <thead><tr><th>Procedure</th><th>Implants</th><th></th></tr></thead>
            <tbody>
              ${rules.map((r) => `<tr data-rule="${r.id}">
                <td><input data-k="name" value="${esc(r.name)}" aria-label="Procedure"><div class="muted small impl-how">${esc(how(r))}</div></td>
                <td><textarea data-k="implants" rows="2" aria-label="Implants">${esc(r.implants)}</textarea></td>
                <td><button class="icon" data-del-rule title="Delete">✕</button></td>
              </tr>`).join('') || '<tr><td colspan="3" class="empty">No procedures yet. Add the first one below.</td></tr>'}
            </tbody>
            <tfoot>
              <tr id="impl-add">
                <td><input name="name" aria-label="New procedure"></td>
                <td><textarea name="implants" rows="2" aria-label="New implants"></textarea></td>
                <td><button class="btn small primary" id="impl-add-btn">Add</button></td>
              </tr>
            </tfoot>
          </table>
        </div>
        <label class="block test">Test a diagnosis and plan<input id="impl-test"></label>
        <div id="impl-out" class="muted small"></div>
      </div>`;
  }

  function levelSection() {
    const rules = Object.entries(Store.levels).map(([id, r]) => ({ ...r, id }))
      .sort((a, b) => LEVELS.indexOf(b.level) - LEVELS.indexOf(a.level) || (a.category || '').localeCompare(b.category || '') || (a.name || '').localeCompare(b.name || ''));
    const byLevel = [...LEVELS].reverse().map((lv) => [lv, rules.filter((r) => r.level === lv)]);
    const row = (r) => `<tr data-lrule="${r.id}">
      <td><select data-k="level" aria-label="Level">${levelOpts(r.level)}</select></td>
      <td><input data-k="category" value="${esc(r.category)}" aria-label="Category"></td>
      <td><input data-k="name" value="${esc(r.name)}" aria-label="Procedure"></td>
      <td><input data-k="keywords" value="${esc((r.keywords || []).join(', '))}" aria-label="Match words"></td>
      <td><button class="icon" data-del-lrule title="Delete">✕</button></td>
    </tr>`;
    return `
      <div class="card" id="levels">
        <h3>Level of surgery database</h3>
        <p class="muted small">From the Weighted Orthopaedic Procedure List. When a plan contains a procedure's match words, its level fills in. If several match, the highest level wins; a longer match beats a shorter one inside it (“triple arthrodesis” is level II, not the level III “arthrodesis”).</p>
        <div class="table-wrap">
          <table class="board impl-table level-table">
            <thead><tr><th>Level</th><th>Category</th><th>Procedure</th><th>Match words in plans</th><th></th></tr></thead>
            ${byLevel.map(([lv, list]) => `<tbody>
              <tr class="lv-head"><th colspan="5">Level ${lv} — ${esc(LEVEL_INFO[lv].title)} <span class="muted">(weightage ${LEVEL_INFO[lv].weight.toFixed(1)})</span></th></tr>
              ${list.map(row).join('') || '<tr><td colspan="5" class="muted small">None</td></tr>'}
            </tbody>`).join('')}
            <tfoot>
              <tr id="level-add">
                <td><select name="level" aria-label="New level">${levelOpts('II')}</select></td>
                <td><input name="category" aria-label="New category"></td>
                <td><input name="name" aria-label="New procedure"></td>
                <td><input name="keywords" aria-label="New match words"></td>
                <td><button class="btn small primary" id="level-add-btn">Add</button></td>
              </tr>
            </tfoot>
          </table>
        </div>
        <label class="block test">Test a plan<input id="level-test"></label>
        <div id="level-out" class="muted small"></div>
      </div>`;
  }

  function staffSection() {
    return `
      <div class="card" id="staff">
        <h3>Unit staff</h3>
        <p class="muted small">Used for the OT list header and signature. One Assistant Professor per line.</p>
        <div class="staff-grid">
          ${allUnits().map((u) => `
            <div class="staff-unit" data-unit="${u.id}">
              <b>UNIT ${u.id}</b>
              <label>Chief<input data-staff="chief" value="${esc(u.chief)}"></label>
              <label>Assistant Professors<textarea data-staff="aps" rows="3">${esc(u.aps.join('\n'))}</textarea></label>
            </div>`).join('')}
        </div>
      </div>`;
  }

  const Settings = {
    live: true,
    render() {
      const p = Store.profile();
      const m = Store.meta;
      const members = Object.values(Store.members).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      return `
        <h2>Settings</h2>
        <form class="card form" id="prof">
          <fieldset><legend>You (on this device)</legend>
            <label>Your name<input name="name" value="${esc(p.name)}"></label>
            <label>Role<select name="role"><option value="">—</option>${opts(ROLES, p.role)}</select></label>
          </fieldset>
        </form>

        <div class="card" id="myward">
          <h3>This phone is for</h3>
          <p class="muted small">Which ward the app opens on, on this device.</p>
          <div class="chips">
            <button class="chip${lsGet('wm.myWard') !== 'post' ? ' on' : ''}" data-myward="pre">Pre-op ward</button>
            <button class="chip${lsGet('wm.myWard') === 'post' ? ' on' : ''}" data-myward="post">Post-op ward</button>
          </div>
        </div>

        <div class="card" id="look">
          <h3>Look</h3>
          <p class="muted small">How the app looks on this device. Printouts and PowerPoints are not affected.</p>
          <p class="small"><b>Modern</b></p>
          <div class="chips">${[['graphite', 'Graphite (dark)'], ['tangerine', 'Tangerine'], ['blossom', 'Blossom (pastel)'], ['mint', 'Mint (pastel)'], ['sorbet', 'Sorbet (pastel)'], ['crimson', 'Navy & Crimson (gradient)'], ['aurora', 'Aurora (gradient)'], ['modern', 'Modern clinical'], ['midnight', 'Midnight (dark)'], ['glass', 'Glass'], ['material', 'Material']]
            .map(([k, l]) => `<button class="chip${(document.documentElement.dataset.ui || 'win98') === k ? ' on' : ''}" data-ui-pick="${k}">${l}</button>`).join('')}</div>
          <p class="small"><b>Retro</b></p>
          <div class="chips">${[['win98', 'Windows 98'], ['xp', 'Windows XP'], ['mac', 'Classic Mac'], ['dos', 'DOS terminal']]
            .map(([k, l]) => `<button class="chip${(document.documentElement.dataset.ui || 'win98') === k ? ' on' : ''}" data-ui-pick="${k}">${l}</button>`).join('')}</div>
        </div>

        <form class="card form" id="meta">
          <fieldset><legend>Unit & letterhead (shared)</legend>
            <label>Unit<select name="unitId">${opts(UNITS.map((u) => [u.id, 'UNIT ' + u.id]), m.unitId)}</select></label>
            <label>Ortho OPD no.<input name="opd" value="${esc(m.opd)}"></label>
            <label class="span2" data-nocaps>Email the OT list to<input type="email" name="otEmail" value="${esc(m.otEmail)}" placeholder="name@example.com" autocomplete="off"></label>
            <div class="span2 muted small">Chief: ${esc(unitOf(m.unitId).chief)} · Asst. Profs: ${esc(unitOf(m.unitId).aps.join(', '))}</div>
            <label class="span2">Institution<input name="institution" value="${esc(m.institution)}"></label>
            <label class="span2">Department<input name="department" value="${esc(m.department)}"></label>
          </fieldset>
          <div class="lh-preview"><img src="${esc(m.letterhead || 'assets/letterhead.jpg')}" alt="Letterhead"></div>
          <div class="actions">
            <label class="btn small">Replace letterhead image<input type="file" id="lh-file" accept="image/*" hidden></label>
            ${m.letterhead ? '<button type="button" class="btn small" id="lh-reset">Use default</button>' : ''}
          </div>
        </form>

        ${implantSection()}

        ${levelSection()}

        ${staffSection()}

        <div class="card">
          <h3>Sharing</h3>
          ${Store.mode === 'local'
            ? (window.WARD_CONFIG?.firebase
              ? '<p>This copy was opened as a file, so it runs in <b>local mode</b>: data stays in this browser only. For live sharing, open <b>https://vishnuharan2390.github.io/ward-management/</b> instead.</p>'
              : '<p>Running in <b>local mode</b>: data lives only in this browser. To share with your HS and senior PGs, connect Firebase — see <b>README.md</b>.</p>')
            : `<p>Signed in as <b>${esc(Store.user?.email)}</b> · sync: ${esc(Store.status)} <button class="btn small" id="signout">Sign out</button></p>
               ${Store.localCaseCount() ? `<p class="notice">This device has <b>${Store.localCaseCount()}</b> case(s) saved before sharing was switched on. <button class="btn small primary" id="upload-local">Copy them to the shared database</button></p>` : ''}
               <h4>Team</h4>
               <ul class="members">${members.map((x) => `<li><b>${esc(x.name || x.email)}</b> <span class="muted">${esc(x.role)} · ${esc(x.email)}</span>${Store.isOwner() ? ` <button class="icon" data-rm="${esc(x.email)}">✕</button>` : ''}</li>`).join('') || '<li class="muted">Only owners so far.</li>'}</ul>
               ${Store.isOwner() ? `<form class="inline-add" id="add-member">
                 <label class="mini-lab">Gmail of HS / PG<input name="email" type="email" required></label>
                 <label class="mini-lab">Name<input name="name"></label>
                 <select name="role">${opts(ROLES, 'PG')}</select>
                 <button class="btn small primary">Add</button></form>` : '<p class="muted small">Ask the unit owner to add people.</p>'}`}
        </div>

        <div class="card">
          <h3>Backup</h3>
          <div class="actions">
            <button class="btn" id="export">Export backup (.json)</button>
            <label class="btn">Import backup<input type="file" id="import" accept="application/json" hidden></label>
          </div>
        </div>`;
    },
    mount(el) {
      $('#prof', el).onchange = (e) => Store.setProfile({ [e.target.name]: e.target.value.trim() });
      $('#myward', el).addEventListener('click', (e) => {
        const k = e.target.closest('[data-myward]')?.dataset.myward;
        if (!k) return;
        lsSet('wm.myWard', k);
        toast(k === 'post' ? 'This phone now opens on the Post-op Ward' : 'This phone now opens on the e-Case Sheet');
        render();
      });
      $('#look', el).addEventListener('click', (e) => {
        const k = e.target.closest('[data-ui-pick]')?.dataset.uiPick;
        if (!k) return;
        if (k === 'win98') delete document.documentElement.dataset.ui;
        else document.documentElement.dataset.ui = k;
        document.documentElement.classList.toggle('flat', ['modern', 'midnight', 'glass', 'material', 'crimson', 'aurora', 'blossom', 'mint', 'sorbet', 'tangerine', 'graphite'].includes(k));
        document.documentElement.classList.toggle('grad', ['crimson', 'aurora', 'blossom', 'mint', 'sorbet'].includes(k));
        try { localStorage.setItem('wm.ui', k); } catch { /* private mode */ }
        render();
      });
      $('#meta', el).onchange = async (e) => {
        if (e.target.id === 'lh-file') {
          const file = e.target.files[0];
          if (file) Store.setMeta({ letterhead: await compressImage(file, 1800, 0.85) });
          return;
        }
        Store.setMeta({ [e.target.name]: e.target.value.trim() });
      };
      const lr = $('#lh-reset', el);
      if (lr) lr.onclick = () => Store.setMeta({ letterhead: '' });

      // Implant database
      const test = $('#impl-test', el);
      const runTest = () => {
        const s = suggestImplantsFor(test.value, test.value, Store.implants);
        $('#impl-out', el).innerHTML = s.source === 'history'
          ? `<div><b>From your OT list of ${esc(fmtDate(s.entry.date))}</b> (${esc(s.entry.dx)} — ${esc(s.entry.plan)}):<br>${esc(s.entry.implants)}</div>`
          : s.source === 'list' ? s.matches.map((r) => `<div><b>Reference list — ${esc(r.name)}</b>: ${esc(r.implants)}</div>`).join('')
            : (test.value ? 'No match' : '');
      };
      test.oninput = runTest;
      $('#implants', el).addEventListener('change', (e) => {
        const k = e.target.dataset.k;
        const id = e.target.closest('[data-rule]')?.dataset.rule;
        if (!k || !id) return;
        Store.patch('implants', id, { [k]: e.target.value.trim() });
      });
      $('#implants', el).addEventListener('click', (e) => {
        const b = e.target.closest('[data-del-rule]');
        if (!b) return;
        const id = b.closest('[data-rule]').dataset.rule;
        if (confirm(`Delete "${Store.implants[id].name}"?`)) Store.remove('implants', id);
      });
      $('#impl-add-btn', el).onclick = (e) => {
        e.preventDefault();
        const row = $('#impl-add', el);
        const val = (n) => $(`[name=${n}]`, row).value.trim();
        if (!val('name')) return toast('Type the procedure name first');
        Store.create('implants', uid(), {
          name: val('name'),
          implants: val('implants'),
        });
        toast('Added');
      };

      // Level database
      $('#level-test', el).oninput = (e) => {
        const r = levelFor(e.target.value, Store.levels);
        $('#level-out', el).innerHTML = r.rule
          ? `<b>Level ${esc(r.level)}</b> — ${esc(r.rule.name)}${r.matches.length > 1 ? ` <span>(also matched: ${esc(r.matches.filter((x) => x !== r.rule).map((x) => `${x.name} [${x.level}]`).join(', '))})</span>` : ''}`
          : (e.target.value ? 'No match' : '');
      };
      $('#levels', el).addEventListener('change', (e) => {
        const k = e.target.dataset.k;
        const id = e.target.closest('[data-lrule]')?.dataset.lrule;
        if (!k || !id) return;
        const v = k === 'keywords' ? e.target.value.split(',').map((x) => x.trim()).filter(Boolean) : e.target.value.trim();
        Store.patch('levels', id, { [k]: v });
      });
      $('#levels', el).addEventListener('click', (e) => {
        const b = e.target.closest('[data-del-lrule]');
        if (!b) return;
        const id = b.closest('[data-lrule]').dataset.lrule;
        if (confirm(`Delete "${Store.levels[id].name}"?`)) Store.remove('levels', id);
      });
      $('#level-add-btn', el).onclick = (e) => {
        e.preventDefault();
        const row = $('#level-add', el);
        const val = (n) => $(`[name=${n}]`, row).value.trim();
        if (!val('name')) return toast('Type the procedure name first');
        Store.create('levels', uid(), {
          level: val('level'),
          category: val('category'),
          name: val('name'),
          keywords: (val('keywords') || val('name')).split(',').map((x) => x.trim()).filter(Boolean),
        });
        toast('Added');
      };

      $('#staff', el).addEventListener('change', (e) => {
        const k = e.target.dataset.staff;
        const u = e.target.closest('[data-unit]')?.dataset.unit;
        if (!k || !u) return;
        const roster = { ...(Store.meta.roster || {}) };
        const cur = { ...(roster[u] || {}) };
        cur[k] = k === 'aps' ? e.target.value.split('\n').map((x) => x.trim().toUpperCase()).filter(Boolean) : e.target.value.trim().toUpperCase();
        roster[u] = cur;
        Store.setMeta({ roster });
        toast('Saved');
      });

      const so = $('#signout', el);
      if (so) so.onclick = () => Store.signOut();
      const ul = $('#upload-local', el);
      if (ul) {
        ul.onclick = async () => {
          ul.disabled = true;
          try {
            toast(`Copied ${await Store.uploadLocal()} case(s) to the shared database`, 3500);
          } catch (err) {
            ul.disabled = false;
            toast('Copy failed: ' + (err.code || err.message), 4000);
          }
          render();
        };
      }
      const am = $('#add-member', el);
      if (am) {
        am.onsubmit = (e) => {
          e.preventDefault();
          const f = e.target.elements;
          Store.addMember(f.email.value, f.name.value.trim(), f.role.value);
          e.target.reset();
        };
      }
      el.addEventListener('click', (e) => {
        const b = e.target.closest('[data-rm]');
        if (b && confirm('Remove ' + b.dataset.rm + '?')) Store.removeMember(b.dataset.rm);
      });
      $('#export', el).onclick = async () => {
        const blob = new Blob([JSON.stringify(await Store.exportAll())], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `ward-backup-${todayISO()}.json`;
        a.click();
        URL.revokeObjectURL(a.href);
      };
      $('#import', el).onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
          const data = JSON.parse(await file.text());
          if (data.app !== 'ward-management') throw new Error('Not a ward backup file');
          if (!confirm(`Import ${Object.keys(data.cases || {}).length} cases? Existing cases with the same id are overwritten.`)) return;
          Object.values(data.cases || {}).forEach(migrateCase);
          await Store.importAll(data);
          toast('Imported');
        } catch (err) {
          toast('Import failed: ' + err.message);
        }
      };
    },
  };

  // ---------------------------------------------------------------- Shell
  function notFound() {
    return Store.status === 'connecting' ? '<div class="empty">Loading…</div>' : '<div class="empty">Case not found. <a href="#/">Back to the e-case sheet</a></div>';
  }

  const Gate = {
    live: true,
    mode: 'in', // 'in' | 'up' | 'reset'
    render() {
      const s = Store.status;
      if (s === 'denied') {
        return `<div class="card gate"><h2>No access yet</h2><p>You're signed in as <b>${esc(Store.user?.email)}</b>, but this email isn't on the team list. Ask the unit owner to add it under Settings → Team, then tap Try again.</p>
          <div class="actions center"><button class="btn primary" id="retry">Try again</button><button class="btn" id="signout">Sign out</button></div></div>`;
      }
      if (s === 'unverified') {
        return `<div class="card gate"><h2>Confirm your email</h2><p>We sent a link to <b>${esc(Store.user?.email)}</b>. Open it (check spam too), then come back and tap the button below.</p>
          <div class="actions center"><button class="btn primary" id="verified">I've confirmed it</button><button class="btn" id="resend">Send the link again</button><button class="btn" id="signout">Sign out</button></div></div>`;
      }
      if (s.startsWith('error')) return `<div class="card gate"><h2>Connection problem</h2><p>${esc(s)}</p><button class="btn" onclick="location.reload()">Retry</button></div>`;
      if (s === 'signed-out') {
        const m = Gate.mode;
        return `<div class="card gate">
          <h2>Pre-op Ward</h2>
          <p class="muted">${m === 'up' ? 'Create your account with the email your unit added to the team.' : m === 'reset' ? 'We will email you a link to set a new password.' : 'Sign in with the email your unit added to the team.'}</p>
          <form id="email-form" class="gate-form" autocomplete="on">
            <label>Email<input name="email" type="email" autocomplete="username" required></label>
            ${m === 'reset' ? '' : `<label>Password<input name="password" type="password" autocomplete="${m === 'up' ? 'new-password' : 'current-password'}" minlength="6" required></label>`}
            <button class="btn primary">${m === 'up' ? 'Create account' : m === 'reset' ? 'Send reset link' : 'Sign in'}</button>
          </form>
          <div class="gate-links">
            ${m !== 'in' ? '<button class="link" data-mode="in">Sign in</button>' : '<button class="link" data-mode="up">New here? Create account</button><button class="link" data-mode="reset">Forgot password</button>'}
          </div>
          <div class="gate-or"><span>or</span></div>
          <button class="btn" id="signin">Sign in with Google</button>
        </div>`;
      }
      return '<div class="empty">Connecting…</div>';
    },
    mount(el) {
      const fail = (e) => toast(({
        'auth/invalid-credential': 'Email or password is wrong.',
        'auth/wrong-password': 'Email or password is wrong.',
        'auth/user-not-found': 'No account with that email yet — tap “Create account”.',
        'auth/email-already-in-use': 'That email already has an account — sign in instead.',
        'auth/weak-password': 'Use at least 6 characters for the password.',
        'auth/too-many-requests': 'Too many tries. Wait a minute and try again.',
        'auth/popup-blocked': 'The Google window was blocked. Use email and password instead.',
      })[e.code] || 'Sign-in failed: ' + (e.code || e.message), 4000);
      const si = $('#signin', el);
      if (si) si.onclick = () => Store.signIn().catch(fail);
      const so = $('#signout', el);
      if (so) so.onclick = () => Store.signOut();
      const re = $('#retry', el);
      if (re) re.onclick = () => Store.recheckVerified();
      const ve = $('#verified', el);
      if (ve) {
        ve.onclick = async () => {
          await Store.recheckVerified();
          if (Store.status === 'unverified') toast('Not confirmed yet — open the link in the email first.', 3500);
        };
      }
      const rs = $('#resend', el);
      if (rs) rs.onclick = () => Store.resendVerification().then(() => toast('Link sent')).catch(fail);
      el.addEventListener('click', (e) => {
        const b = e.target.closest('[data-mode]');
        if (b) {
          Gate.mode = b.dataset.mode;
          render();
        }
      });
      const f = $('#email-form', el);
      if (f) {
        f.onsubmit = async (e) => {
          e.preventDefault();
          const mail = f.elements.email.value;
          try {
            if (Gate.mode === 'reset') {
              await Store.resetPassword(mail);
              toast('Reset link sent — check your inbox.', 3500);
              Gate.mode = 'in';
              render();
            } else if (Gate.mode === 'up') {
              await Store.signUpEmail(mail, f.elements.password.value);
            } else {
              await Store.signInEmail(mail, f.elements.password.value);
            }
          } catch (err) {
            fail(err);
          }
        };
      }
    },
  };

  const ROUTES = [
    [/^#?\/?$/, () => Dashboard],
    [/^#\/ward$/, () => Ward],
    [/^#\/postward$/, () => PostWard],
    [new RegExp(`^#\\/(${Object.keys(TRANSFER_DEPTS).join('|')})$`), (k) => TransferTabs[k]], // #/plastic, #/neuro, #/retained
    [/^#\/new$/, () => CaseForm()],
    [/^#\/import$/, () => Import.open()],
    [/^#\/import\/deck\/([\d-]+)$/, (d) => Import.open(d)],
    [/^#\/new\/deck\/([\d-]+)$/, (d) => CaseForm(null, d)],
    [/^#\/case\/(\w+)$/, (id) => CaseDetail(id)],
    [/^#\/case\/(\w+)\/edit$/, (id) => CaseForm(id)],
    [/^#\/ot(\/list)?$/, () => OT],
    [/^#\/discharge\/(\w+)$/, (id) => Discharge(id)],
    [/^#\/(settings|implants)$/, () => Settings],
    [/^#\/deck$/, () => Deck],
    [/^#\/postop$/, () => PostOp],
  ];

  function resolve() {
    if (Store.mode === 'firebase' && Store.status !== 'ok') return Gate;
    const h = location.hash || '#/';
    for (const [re, mk] of ROUTES) {
      const m = h.match(re);
      if (m) return mk(m[1]);
    }
    return Dashboard;
  }

  function section() {
    const m = (location.hash || '#/').match(/^#\/(ward|postward|ot|deck|postop|settings)\b/);
    return m ? '#/' + m[1] : '#/';
  }

  // PAC: show "work pending" only for provisionally / not assessed.
  document.addEventListener('change', (e) => {
    if (e.target.dataset.pac === undefined) return;
    const box = e.target.closest('.workup')?.querySelector('.pac-pending');
    if (box) box.hidden = !e.target.value || e.target.value === 'Assessed';
  });

  function render() {
    deferred = false;
    document.body.classList.remove('rounds-mode'); // the ward view puts it back while rounds are on
    Voice.stop();
    const y = window.scrollY;
    const same = current && current.hash === location.hash;
    if (!same) current = { hash: location.hash, view: resolve() };
    const v = current.view;
    // Swap in a fresh element so delegated listeners from the last render don't pile up.
    // Drawers (details[data-keep]) stay open when the same page redraws — e.g. a teammate's edit syncing in.
    const keepOpen = same ? $$('details[data-keep][open]', App.el).map((d) => d.dataset.keep) : [];
    const fresh = document.createElement('main');
    fresh.id = 'view';
    fresh.innerHTML = v.render();
    App.el.replaceWith(fresh);
    App.el = fresh;
    keepOpen.forEach((k) => { const d = fresh.querySelector(`details[data-keep="${k}"]`); if (d) d.open = true; });
    v.mount?.(fresh);
    capsKeyboard(fresh);
    // Voice.attach(fresh); — dictation buttons switched off for now (js/voice.js)
    current.loading = Store.status === 'connecting' && !!fresh.querySelector('.empty');
    window.scrollTo(0, same ? y : 0);
    const sec = section();
    $$('#nav a').forEach((a) => a.classList.toggle('on', a.getAttribute('href') === sec));
    updateSync();
  }

  function updateSync() {
    const s = $('#sync');
    if (Store.mode === 'local') {
      s.textContent = 'Local';
      s.className = 'sync local';
    } else {
      s.textContent = Store.status === 'ok' ? '● Live' : Store.status;
      s.className = 'sync ' + (Store.status === 'ok' ? 'ok' : 'warn');
    }
  }

  const editing = () => {
    if (document.body.classList.contains('dragging')) return true;
    const a = document.activeElement;
    return a && App.el?.contains(a) && /INPUT|TEXTAREA|SELECT/.test(a.tagName) && a.type !== 'checkbox' && a.type !== 'file';
  };

  // ---------------------------------------------------------------- CAPITALS
  // Every typed text entry is stored in capitals. Left alone: email, password, dates,
  // numbers, dropdowns, and anything marked data-nocaps.
  const capsOK = (t) => (t.tagName === 'TEXTAREA' || (t.tagName === 'INPUT' && /^(text|search|tel|)$/.test(t.type)))
    && !t.closest('[data-nocaps]') && !/email|password|username/i.test(t.autocomplete || '') && !/email/i.test(t.name || '');
  function toCaps(t) {
    const v = t.value;
    const u = v.toUpperCase();
    if (u === v) return;
    const [a, b] = [t.selectionStart, t.selectionEnd];
    t.value = u;
    try { t.setSelectionRange(a, b); } catch { /* some input types have no caret */ }
    // Safari treats a value set by script as "unchanged", so it skips the change event when the
    // field is left, and the edit is never saved. Remember it and send the change ourselves.
    t._capsDirty = true;
  }
  document.addEventListener('focusin', (e) => {
    if (capsOK(e.target)) e.target.setAttribute('autocapitalize', 'characters');
    e.target._capsDirty = false;
  });
  document.addEventListener('change', (e) => { e.target._capsDirty = false; }, true);
  document.addEventListener('focusout', (e) => {
    const t = e.target;
    if (!t._capsDirty) return;
    t._capsDirty = false;
    t.dispatchEvent(new Event('change', { bubbles: true }));
  }, true);
  // Keyboard opens in caps lock from the first tap (iPhone reads this before focus).
  const capsKeyboard = (root) => $$('input, textarea', root).forEach((el) => { if (capsOK(el)) el.setAttribute('autocapitalize', 'characters'); });
  // Capture phase: values are already in capitals when the app's own handlers read them.
  document.addEventListener('input', (e) => { if (!e.isComposing && capsOK(e.target)) toCaps(e.target); }, true);
  document.addEventListener('compositionend', (e) => { if (capsOK(e.target)) { toCaps(e.target); e.target.dispatchEvent(new Event('input', { bubbles: true })); } }, true);

  // One-time: bring entries saved before this into capitals (free-text fields only;
  // statuses and other internal values stay as they are).
  const CAPS_FIELDS = ['name', 'ward', 'attender', 'address', 'diagnosis', 'plan', 'level', 'scheme', 'comorbid', 'implants', 'mode', 'treatment', 'writtenBy', 'ipNo'];
  let capsChecked = false;
  function capsMigrate() {
    if (Store.meta.capsV1) return;
    const U = (x) => (typeof x === 'string' ? x.toUpperCase() : x);
    for (const [id, c] of Object.entries(Store.cases)) {
      const ch = {};
      for (const k of CAPS_FIELDS) if (typeof c[k] === 'string' && c[k] !== c[k].toUpperCase()) ch[k] = c[k].toUpperCase();
      const lists = { tasks: ['text', 'to'], opinions: ['dept', 'note'] };
      for (const [k, keys] of Object.entries(lists)) {
        for (const [iid, item] of Object.entries(c[k] || {})) {
          for (const f of keys) if (typeof item?.[f] === 'string' && item[f] !== U(item[f])) ch[`${k}.${iid}.${f}`] = U(item[f]);
        }
      }
      for (const f of ['organism', 'sensitive']) if (typeof c.pus?.[f] === 'string' && c.pus[f] !== U(c.pus[f])) ch['pus.' + f] = U(c.pus[f]);
      for (const f of ['echo', 'anaesPending']) if (typeof c.work?.[f] === 'string' && c.work[f] !== U(c.work[f])) ch['work.' + f] = U(c.work[f]);
      if (Object.keys(ch).length) Store.patch('cases', id, ch);
    }
    Store.setMeta({ capsV1: true });
  }

  // One-time correction (3 Nov 2026): cases entered with DOA 02/11/2026 were admitted on
  // 01/11/2026, and those with 03/11/2026 on 02/11/2026. Each corrected case is marked, so a
  // second phone running this at the same moment can't shift it twice. The admission day PPT
  // settings move with them.
  const DOA_FIX = { '2026-11-02': '2026-11-01', '2026-11-03': '2026-11-02' };
  function doaFix() {
    if (!Store.synced) return setTimeout(doaFix, 2000); // only with the full, current case list
    if (Store.meta.doaFix1103) return;
    if (todayISO() > '2026-11-04') return; // never on a later day: those dates are real admissions by then
    let n = 0;
    for (const [id, c] of Object.entries(Store.cases)) {
      if (c.doaFix === '1103' || !DOA_FIX[c.doa]) continue;
      Store.patch('cases', id, { doa: DOA_FIX[c.doa], doaFix: '1103' });
      n++;
    }
    const cfg = (d) => Store.meta[DECK_KEY(d)] || null;
    const merge = (a, b) => {
      if (!a) return b;
      if (!b) return a;
      return {
        ...b, ...a,
        order: [...(a.order || []), ...(b.order || []).filter((x) => !(a.order || []).includes(x))],
        extra: [...new Set([...(a.extra || []), ...(b.extra || [])])],
        skip: [...new Set([...(a.skip || []), ...(b.skip || [])])],
        labels: { ...(b.labels || {}), ...(a.labels || {}) },
        split: { ...(b.split || {}), ...(a.split || {}) },
        skipImg: { ...(b.skipImg || {}), ...(a.skipImg || {}) },
      };
    };
    const [d1, d2, d3] = [cfg('2026-11-01'), cfg('2026-11-02'), cfg('2026-11-03')];
    const ch = { doaFix1103: true };
    if (d2 || d1) ch[DECK_KEY('2026-11-01')] = merge(d1, d2);
    if (d2 || d3) ch[DECK_KEY('2026-11-02')] = d3 || null;
    if (d3) ch[DECK_KEY('2026-11-03')] = null;
    Store.setMeta(ch);
    if (n) toast(`Admission dates corrected for ${n} case(s): 02/11 → 01/11, 03/11 → 02/11`, 5000);
  }

  function onStoreChange() {
    const gateNeeded = Store.mode === 'firebase' && Store.status !== 'ok';
    if (gateNeeded !== (current?.view === Gate)) {
      current = null;
      return render();
    }
    if (!capsChecked && (Store.status === 'ok' || Store.mode === 'local') && Object.keys(Store.cases).length) {
      capsChecked = true;
      setTimeout(capsMigrate, 1500);
      setTimeout(doaFix, 2500);
    }
    if (!current) return render();
    if (!current.view.live && !current.loading) return updateSync();
    // Wait a tick: a save fired by leaving one box arrives while focus is still moving to the
    // next box. Re-rendering at that instant would destroy the box being tapped.
    setTimeout(() => {
      if (editing()) {
        deferred = true;
        return updateSync();
      }
      render();
    }, 0);
  }

  function start() {
    App.el = $('#view');
    // A post-op PG's phone opens on the post-op ward.
    if ((!location.hash || location.hash === '#/') && lsGet('wm.myWard') === 'post') location.replace('#/postward');
    Store.subscribe(onStoreChange);
    window.addEventListener('hashchange', () => {
      current = null;
      render();
    });
    document.addEventListener('focusout', () => {
      setTimeout(() => { if (deferred && !editing()) render(); }, 0);
    });
    render();
    Store.init();
  }

  return { start, el: null };
})();

App.start();
