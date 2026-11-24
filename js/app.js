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
  // Ward: pick from the hospital's wards; an older free-typed ward stays as its own option.
  const wardOpts = (v) => {
    const cur = String(v || '').trim().toUpperCase();
    const list = cur && !WARDS.includes(cur) ? [cur, ...WARDS] : WARDS;
    return `<option value="">—</option>${list.map((w) => `<option${w === cur ? ' selected' : ''}>${esc(w)}</option>`).join('')}`;
  };
  const levelOpts = (sel) => opts([['', '—'], ...LEVELS.map((l) => [l, l])], sel || '');
  const schemeOpts = (sel) => opts([['', '—'], ...SCHEMES.map((s) => [s, s])], sel || '');
  const isActive = (c) => ['preop', 'posted', undefined, ''].includes(c.status);
  const byWard = (a, b) => String(a.ward || '').localeCompare(String(b.ward || ''), undefined, { numeric: true }) || (a.doa || '').localeCompare(b.doa || '');
  const flagged = (text, f) => (f ? `<b class="flag">${esc(text)}${FLAG_MARK[f]}</b>` : esc(text));
  const metaLine = (c) => [ageSex(c), c.ipNo, c.ward].filter(Boolean).join(' · ');
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
      if (ch) {
        Store.patch('cases', caseId, ch);
        const set = Object.entries(ch).find(([k]) => k.startsWith('labs.'))?.[1];
        if (set?.v) {
          const params = [...ALL_PARAMS, ...customParams(Store.cases[caseId])];
          logUpdate(caseId, `Investigations ${fmtDate(set.date)}: ${Object.entries(set.v).map(([k, v]) => `${params.find((p) => p.k === k)?.label || k} ${v}`).join(', ')}`);
        }
      }
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
        <div class="pac-pending"${pend ? '' : ' hidden'}>
          <label>Works to get assessed <span class="hint">one per line${form ? '' : ' — tick each below when done'}</span>
            <textarea ${attr('anaesPending')} rows="2">${esc(work.anaesPending)}</textarea></label>
          ${!form && c ? pacChecklistHTML(c) : ''}
        </div>
      </div>`;
  }

  // Each PAC work as a row: a tick for done, and a box for what was done / the orders given.
  function pacChecklistHTML(c) {
    const lines = pacLines(c);
    if (!lines.length) return '';
    const done = lines.filter((l) => c.work?.pacDone?.[pacKey(l)]?.done).length;
    return `<div class="pac-list">
      <div class="pac-head"><span>Done / orders</span><span class="pill${done === lines.length ? ' ok' : ''}">${done}/${lines.length}</span></div>
      ${lines.map((l) => {
        const k = pacKey(l);
        const st = c.work?.pacDone?.[k] || {};
        return `<div class="pac-item${st.done ? ' done' : ''}">
          <label class="pac-chk"><input type="checkbox" data-pac-done="${k}" ${st.done ? 'checked' : ''}><span>${esc(l)}</span></label>
          <input class="pac-note" data-pac-note="${k}" value="${esc(st.note || '')}" placeholder="What was done / orders given" aria-label="Notes for ${esc(l)}">
        </div>`;
      }).join('')}
      ${c.work?.anaes === 'Provisionally assessed' ? '<p class="muted small">When every work is ticked, PAC turns to <b>Assessed</b> by itself.</p>' : ''}
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
  const backTo = (c) => (TRANSFER_DEPTS[c.status]?.backToWard && c[c.status]?.from === 'postop' ? 'postop' : 'preop');
  function backIn(id) {
    const c = Store.cases[id];
    const to = backTo(c);
    Store.patch('cases', id, { status: to, ...closeStay(c, c.status, to) });
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
    const dest = backTo(c) === 'postop' ? 'post-op ward' : 'pre-op ward';
    if (!confirm(`${T.backQ(c.name || 'this case')}\n\nIt goes into the ${dest}.`)) return false;
    backIn(id);
    toast(`${c.name || 'Case'} is back in the ${dest}`);
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
    posted: { label: 'Posted', test: (c) => c.status === 'posted' },
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
      const preWard = activeCases(); // pre-op + posted patients — all still in the pre-op ward
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
          ${[['ward', preWard.length, 'Pre-op ward'], ['ready', ready, 'Work-up complete'], ['posted', cnt('posted'), 'Posted'],
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
              <label>IP no.<input data-i="${i}" data-f="ipNo" inputmode="numeric" value="${esc(c.ipNo)}"></label>
              <label>Ward<select data-i="${i}" data-f="ward">${wardOpts(c.ward)}</select></label>
              <label>Mode<input data-i="${i}" data-f="mode" list="dl-mode" value="${esc(c.mode)}"></label>
              <label>DOA<input type="date" data-i="${i}" data-f="doa" value="${esc(c.doa)}"></label>
              <label class="span2">Diagnosis<textarea data-i="${i}" data-f="diagnosis" rows="2">${esc(c.diagnosis)}</textarea></label>
              <label class="span2">Plan<input data-i="${i}" data-f="plan" value="${esc(c.plan)}"></label>
              ${c.phone != null || c.address != null ? `<label>Phone<input data-i="${i}" data-f="phone" inputmode="tel" value="${esc(c.phone || '')}"></label>
              <label>Address<input data-i="${i}" data-f="address" value="${esc(c.address || '')}"></label>` : ''}
              ${c.treatment != null ? `<label class="span2">Treatment<textarea data-i="${i}" data-f="treatment" rows="2">${esc(c.treatment)}</textarea></label>` : ''}
              ${c.writtenBy != null ? `<label class="span2">Case sheet written by<input data-i="${i}" data-f="writtenBy" value="${esc(c.writtenBy || '')}"></label>` : ''}
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
      Import.titles = cases.titles || {};
      Import.otherDay = false;
      Import.markDay();
      Import.applyDoa();
      Import.busy = '';
      render();
    },
    async readChat(f) {
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
      if (file) file.onchange = () => { if (file.files[0]) Import.readChat(file.files[0]); };
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
          const next = { ...cfg, order: ordered };
          const tt = Import.source === 'wa' ? Import.titles?.[Import.doa] : null;
          if (tt?.professor && !cfg.professor) next.professor = tt.professor;
          if (tt?.daos && !cfg.daos) next.daos = tt.daos;
          // consolidation: counted from the cases (left alone if someone already typed it in)
          if (!Object.values(cfg.cons || {}).some((v) => String(v ?? '').trim())) next.cons = countCons(deckState(Import.doa, next));
          saveDeckCfg(Import.doa, next);
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

  // Post-op ward: every post-op case. There is no "incoming / receive" step any more — a transfer
  // lands in the post-op ward at once, and cases still marked "not received" from before count as in.
  const isIncoming = () => false;
  const postWardCases = () => inOrder(caseList().filter((c) => c.status === 'postop' && !isIncoming(c)));
  const podOf = (c) => { const d = c.surgeryDate || c.otDate; return d ? daysSince(d) : null; };
  // Ward order (shared with the team, per ward): the bed list arranged on the ward page first, then
  // everyone else in admission order. Bed numbers aren't kept. The e-case sheet and OT list keep
  // their own (DOA) order.
  const wardOrderKey = (W) => 'wardOrder_' + W.kind;
  function wardCases(W) {
    const list = W.kind === 'post' ? postWardCases() : activeCases();
    const pos = new Map((Store.meta[wardOrderKey(W)] || []).map((id, i) => [id, i]));
    const base = new Map(list.map((c, i) => [c.id, i]));
    return [...list].sort((a, b) => {
      const pa = pos.has(a.id);
      const pb = pos.has(b.id);
      if (pa && pb) return pos.get(a.id) - pos.get(b.id);
      if (pa !== pb) return pa ? -1 : 1;
      return base.get(a.id) - base.get(b.id);
    });
  }
  // After a drag on the ward page: the shown rows take their new places in the ward order.
  function setWardOrder(W, shown) {
    const full = wardCases(W).map((c) => c.id);
    const set = new Set(shown);
    const slots = full.map((id, i) => (set.has(id) ? i : -1)).filter((i) => i >= 0);
    slots.forEach((slot, k) => { full[slot] = shown[k]; });
    Store.setMeta({ [wardOrderKey(W)]: full });
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
  // ---- Rounds: bed-sore check (spine / pelvis / hip cases), once a day per patient.
  const bsSkipped = new Set(); // "Not now" for this session
  function bedsoreHTML(c) {
    if (!bedsoreRisk(c) || c.bedsore?.[bedsoreKey()] || bsSkipped.has(c.id)) return '';
    return `<div class="sug-back bs-pop" data-bs-case="${c.id}">
      <div class="sug-box card" role="dialog" aria-label="Bed sore check">
        <h3>Bed sore check — ${esc(c.name)}</h3>
        <p class="muted small">${esc(c.diagnosis)}. Look at the sacrum, both heels, trochanters, scapulae and occiput.</p>
        <div class="form-actions"><button type="button" class="btn primary" data-bs="none">✓ No bed sore</button><button type="button" class="btn" data-bs="present">Bed sore present</button></div>
        <div class="bs-detail" hidden>
          <div class="bs-sites">${BEDSORE_SITES.map((s) => `<label class="chip"><input type="checkbox" data-bs-site="${esc(s)}"> ${esc(s[0] + s.slice(1).toLowerCase())}</label>`).join('')}</div>
          <label class="bs-grade">Grade<select data-bs-grade>${['I', 'II', 'III', 'IV'].map((g) => `<option>${g}</option>`).join('')}</select></label>
          <div class="form-actions"><button type="button" class="btn primary" data-bs="save">Save</button></div>
        </div>
        <div class="form-actions"><button type="button" class="link small" data-bs="skip">Not now</button></div>
      </div></div>`;
  }
  // Today's result as a line on the rounds card.
  function bedsoreLine(c) {
    if (!bedsoreRisk(c)) return '';
    const r = c.bedsore?.[bedsoreKey()];
    if (!r) return '<div class="rd-bs muted small">Bed sore check: not done today</div>';
    return r.status === 'present'
      ? `<div class="rd-bs bad">Bed sore: ${esc((r.sites || []).join(', ').toLowerCase())} — grade ${esc(r.grade || '')}</div>`
      : '<div class="rd-bs ok">Bed sore check today: none ✓</div>';
  }

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

  // Pre-op ward: an operated patient can carry "procedure done". Shown only when entered; otherwise
  // a quiet "+ Procedure done" opens a box to add it. Same field as the e-case sheet's Operative details.
  function doneHTML(c) {
    const has = hasText(c.procedureDone);
    return `<details class="nb-done${has ? ' has' : ''}" data-keep="done-${c.id}">
      <summary>${has ? `✓ ${esc(c.procedureDone)}` : '+ Procedure done'}</summary>
      <textarea data-nb="procedureDone" rows="2" placeholder="Procedure done (leave empty if not operated)">${esc(c.procedureDone || '')}</textarea>
    </details>`;
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
        ${where === 'top' ? `<select id="rd-jump" aria-label="Go to patient">${list.map((x, j) => `<option value="${x.id}"${j === i ? ' selected' : ''}>${j + 1}. ${esc(x.name)}${derangedList(x).length ? ' ⚠' : ''}</option>`).join('')}</select>` : `<span class="muted small">${i + 1} of ${list.length}</span>`}
        <button class="btn primary rd-btn" data-rd="1" ${i < list.length - 1 ? '' : 'disabled'}>Next ›</button>
      </div>`;
    return `<div class="rounds" data-nbcase="${c.id}">
      ${nav('top')}
      <div class="card rd-card${W.flip ? ` flip-${W.flip > 0 ? 'next' : 'prev'}` : ''}">
        <div class="rd-head">
          <div class="rd-who"><div class="rd-name">${esc(c.name)} <span class="muted">${esc(ageSex(c))}</span>${c.status === 'posted' ? ' <span class="posted-mark">(POSTED)</span>' : ''}</div>
            <div class="muted small">${esc([c.ipNo && 'IP ' + c.ipNo, c.ward && 'Ward ' + c.ward, c.doa && 'DOA ' + fmtDate(c.doa), post && podOf(c) != null && 'POD ' + podOf(c)].filter(Boolean).join(' · '))}</div></div>
          <div class="rd-head-acts">
            <a class="btn small" href="#/case/${c.id}">e-Case sheet</a>
            ${caseImages(c.id).length ? `<button type="button" class="btn small" data-rd-imgs="${c.id}">🖼 Images (${caseImages(c.id).length})</button>` : '<span class="muted small">No images</span>'}
          </div>
        </div>
        <div class="rd-dx">${esc(c.diagnosis)}</div>${bedsoreLine(c)}${c.comorbid ? `<div class="rd-cm">K/C/O ${esc(c.comorbid)}</div>` : ''}${post ? (c.procedureDone || c.plan ? `<div class="rd-plan">✓ ${esc(c.procedureDone || c.plan)}</div>` : '') : `${c.plan ? `<div class="rd-plan">▸ ${esc(c.plan)}</div>` : ''}${doneHTML(c)}`}
        ${derangedHTML(c)}
        ${reviewHTML(c)}
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
      ${bedsoreHTML(c) || suggestHTML(c)}
    </div>`;
  }

  // ---- Rounds: the latest values that are out of range, so nobody has to read through every result.
  function derangedHTML(c) {
    const d = derangedList(c);
    if (!d.length) return '';
    const asked = String(invTodoText(c) || '').toUpperCase();
    const reps = [...new Set(d.map((x) => x.repeat))].filter((r) => !asked.includes(r));
    const ago = (date) => {
      if (!date) return '';
      const n = Math.round((new Date(todayISO()) - new Date(date)) / 864e5);
      return n <= 0 ? 'today' : n === 1 ? 'yesterday' : `${n} days ago`;
    };
    return `<div class="rd-der" role="note">
        <div class="rd-der-h">⚠ Deranged <span class="pill bad">${d.length}</span></div>
        <ul>${d.map((x) => `<li class="${x.flag}"><b>${esc(x.text)}</b>${x.date ? ` <span class="muted small">${esc(ago(x.date))}</span>` : ''}</li>`).join('')}</ul>
        ${reps.length ? `<div class="rd-chips">${reps.map((r) => `<button type="button" class="chip" data-add="inv" data-text="${esc(r)}">+ Repeat ${esc(r)}</button>`).join('')}</div>` : ''}
      </div>`;
  }

  // ---- Rounds: "From earlier rounds" — yesterday's investigations, opinions and to-dos, with a place
  // for the result: values (into today's investigation set), a report, the opinion's orders, or done.
  const rvOpen = new Set(); // forms left open across redraws: `${caseId}|${key}`
  function reviewHTML(c) {
    const items = earlierTodos(c);
    if (!items.length) return '';
    return `<details class="rd-review" data-keep="rv-${c.id}" open>
        <summary>From earlier rounds <span class="pill">${items.length}</span></summary>
        ${reviewRows(c, items)}
      </details>`;
  }
  function reviewRows(c, items) {
    const when = (at) => {
      if (!at) return '<span class="muted small">earlier</span>';
      const d = new Date(at).toISOString().slice(0, 10);
      return `<span class="muted small">asked ${d === todayISO() ? 'today' : esc(fmtDate(d))}</span>`;
    };
    const row = (x) => {
      const id = `${c.id}|${x.key}`;
      const open = rvOpen.has(id);
      const btn = x.kind === 'task' || x.kind === 'pac'
        ? `<button type="button" class="btn small primary" data-rv-done>Done ✓</button>`
        : `${x.img ? `<label class="btn small primary icon-btn" title="Take a photo (${esc(imageKind(x.img).label)})" aria-label="Take a photo">📷<input type="file" accept="image/*" capture="environment" data-rv-img="${x.img}" hidden></label><label class="btn small icon-btn" title="From the gallery (${esc(imageKind(x.img).label)})" aria-label="Pick from the gallery">🖼<input type="file" accept="image/*" multiple data-rv-img="${x.img}" hidden></label>` : ''}<button type="button" class="btn small${open || x.img ? '' : ' primary'}" data-rv-open>${x.kind === 'op' ? 'Enter orders' : x.params ? 'Enter values' : 'Enter report'}</button>`;
      const form = x.kind === 'task' || x.kind === 'pac' ? '' : `<div class="rv-form"${open ? '' : ' hidden'}>
          ${x.params ? `<div class="lab-grid">${x.params.map((p) => paramInput(p, '')).join('')}</div>`
            : `<textarea data-rv-text rows="2" placeholder="${x.kind === 'op' ? 'Orders given (drugs, investigations, advice)' : 'Report / result'}"></textarea>`}
          <div class="form-actions"><button type="button" class="btn small primary" data-rv-save>Save</button>${x.kind === 'op' ? '<button type="button" class="btn small" data-rv-seen>Seen — no fresh orders</button>' : ''}</div>
        </div>`;
      return `<div class="rv-item" data-rv-kind="${x.kind}" data-rv-key="${esc(x.key)}">
          <div class="rv-line"><span class="rv-what"><b>${esc(x.line)}</b> ${when(x.at)}</span><span class="rv-acts">${btn}</span></div>${form}</div>`;
    };
    return items.map(row).join('');
  }
  // Rounds and the to-do page share these: open a result form / save it / mark done; pictures.
  function reviewClick(e) {
    const rv = e.target.closest('[data-rv-open],[data-rv-save],[data-rv-done],[data-rv-seen]');
    if (!rv) return false;
    const item = rv.closest('[data-rv-key]');
    const cid = rv.closest('[data-nbcase]').dataset.nbcase;
    const { rvKind, rvKey } = item.dataset;
    if (rv.dataset.rvOpen !== undefined) {
      const form = $('.rv-form', item);
      form.hidden = !form.hidden;
      if (form.hidden) rvOpen.delete(`${cid}|${rvKey}`); else { rvOpen.add(`${cid}|${rvKey}`); $('input,select,textarea', form)?.focus(); }
      return true;
    }
    reviewSave(cid, rvKind, rvKey, item, rv.dataset.rvSeen !== undefined);
    return true;
  }
  function reviewChange(e) {
    const t = e.target;
    if (!t.dataset.rvImg) return false;
    const item = t.closest('[data-rv-key]');
    reviewImages(t.closest('[data-nbcase]').dataset.nbcase, item.dataset.rvKey, t.dataset.rvImg, [...t.files], item);
    return true;
  }

  // ---- The updates log: what was entered / done, for the PGs' "HS updates" tab.
  function logUpdate(caseId, text) {
    const c = Store.cases[caseId];
    if (!c || !text) return;
    Store.create('updates', uid(), { caseId, name: c.name || '', text: String(text).slice(0, 400), by: Store.who(), email: Store.myEmail || '', role: viewRole(), at: Date.now() });
  }
  // Which view this phone shows: house surgeon, AP / chief, or everything. Owners and unit admins
  // can look at the others' views on their own phone (Settings → View the app as).
  const previewAs = () => { try { return sessionStorage.getItem('wm.viewAs') || ''; } catch { return ''; } };
  function viewRole() {
    const p = previewAs();
    if (p && (Store.mode === 'local' || Store.isOwner() || Store.canManageTeam())) return p;
    if (Store.mode === 'local' || Store.isOwner()) return 'full';
    return viewOfRole(Store.myRole);
  }
  // Save one item. Values go into today's set (one per day: labs.rv_YYYYMMDD) so the e-case sheet's
  // investigation table shows them; the line then leaves the Investigation box.
  function reviewSave(caseId, kind, key, box, seen) {
    const c = Store.cases[caseId];
    if (!c) return;
    const now = Date.now();
    const who = Store.who();
    const ch = {};
    let said = '';
    if (kind === 'task') {
      Object.assign(ch, { [`tasks.${key}.done`]: true, [`tasks.${key}.doneBy`]: who, [`tasks.${key}.doneAt`]: now });
      said = `${taskLine(c.tasks?.[key] || {})} — done`;
    } else if (kind === 'pac') {
      const base = `work.pacDone.${key}`;
      Object.assign(ch, { [`${base}.done`]: true, [`${base}.by`]: who, [`${base}.at`]: now });
      const line = pacLines(c).find((l) => pacKey(l) === key) || key;
      said = `PAC: ${line.toUpperCase()} — done`;
      if (c.work?.anaes === 'Provisionally assessed' && pacOpen(c).every((l) => pacKey(l) === key)) { ch['work.anaes'] = 'Assessed'; said += ' (all PAC works done — Assessed)'; }
    } else if (kind === 'op') {
      const note = seen ? 'SEEN, NO FRESH ORDERS' : $('[data-rv-text]', box).value.trim().toUpperCase();
      if (!note) return toast('Type the orders given (or tap Seen — no fresh orders)', 3000);
      Object.assign(ch, { [`opinions.${key}.note`]: note, [`opinions.${key}.noteAt`]: now, [`opinions.${key}.noteBy`]: who });
      said = `${opLine(c.opinions?.[key] || {})} — ${note}`;
    } else {
      const set = 'rv_' + todayISO().replace(/-/g, '');
      const v = {};
      const params = invParams(key);
      if (params) {
        $$('[name^="p_"]', box).forEach((el) => { if (el.value.trim()) v[el.name.slice(2)] = el.value.trim(); });
        if (!Object.keys(v).length) return toast('Type at least one value', 2500);
        said = `${key}: ${params.filter((p) => v[p.k]).map((p) => `${p.label} ${v[p.k]}`).join(', ')}`;
      } else {
        const text = $('[data-rv-text]', box).value.trim().toUpperCase();
        if (!text) return toast('Type the report', 2500);
        said = `${key}: ${text}`;
        if (/\bECHO\b/.test(key)) ch['work.echo'] = text;
        if (/\bECG\b/.test(key)) ch['work.ecg'] = 'Taken';
        // a written result becomes a row of the investigation table, named after the line
        let cp = listOf(c.custom).find((x) => String(x.label).toUpperCase() === key);
        if (!cp) { cp = { id: uid() }; ch[`custom.${cp.id}`] = { label: key, range: '', unit: '', at: now }; }
        v['x_' + cp.id] = text;
      }
      if (!c.labs?.[set]) ch[`labs.${set}`] = { date: todayISO(), at: now, by: who, v };
      else for (const [k, val] of Object.entries(v)) ch[`labs.${set}.v.${k}`] = val;
      const rest = invLines(c).filter((l) => l !== key);
      ch.invTodo = rest.join('\n');
      ch.invAsked = Object.fromEntries(Object.entries(c.invAsked || {}).filter(([l]) => l !== key));
    }
    rvOpen.delete(`${caseId}|${key}`);
    Store.patch('cases', caseId, ch);
    logUpdate(caseId, said);
    toast(kind === 'task' || kind === 'pac' ? 'Done ✓' : kind === 'op' ? 'Orders saved to the opinion' : 'Saved to the investigations', 2500);
  }

  // Pictures for an imaging line (X-ray / CT / MRI / wound pic): saved to the case like the e-case
  // sheet's uploads (OT list viewer, PPTs); a report typed in the open form goes too. The line is then done.
  async function reviewImages(caseId, key, kind, files, item) {
    files = await cropAll(files);
    if (!files.length) return;
    toast(`Saving ${files.length} picture${files.length === 1 ? '' : 's'}…`, 15000);
    let n = 0;
    for (const file of files) {
      try { await Store.addImage(caseId, kind, await compressImage(file), key); n++; } catch { toast(`"${file.name}" couldn't be opened as a picture`, 4000); }
    }
    if (!n) return;
    const c = Store.cases[caseId];
    const ch = {
      invTodo: invLines(c).filter((l) => l !== key).join('\n'),
      invAsked: Object.fromEntries(Object.entries(c.invAsked || {}).filter(([l]) => l !== key)),
    };
    const text = $('[data-rv-text]', item)?.value.trim().toUpperCase();
    if (text) {
      let cp = listOf(c.custom).find((x) => String(x.label).toUpperCase() === key);
      if (!cp) { cp = { id: uid() }; ch[`custom.${cp.id}`] = { label: key, range: '', unit: '', at: Date.now() }; }
      const set = 'rv_' + todayISO().replace(/-/g, '');
      if (!c.labs?.[set]) ch[`labs.${set}`] = { date: todayISO(), at: Date.now(), by: Store.who(), v: { ['x_' + cp.id]: text } };
      else ch[`labs.${set}.v.x_${cp.id}`] = text;
    }
    rvOpen.delete(`${caseId}|${key}`);
    Store.patch('cases', caseId, ch);
    logUpdate(caseId, `${key} — ${n} ${imageKind(kind).label}${n === 1 ? '' : 's'} added${text ? `: ${text}` : ''}`);
    toast(`✓ ${n} ${imageKind(kind).label}${n === 1 ? '' : 's'} added to ${c.name}`, 3000);
  }

  function makeWard(kind) {
  const post = kind === 'post';
  const K = post ? 'wm.postWard' : 'wm.ward'; // per-ward settings on this phone
  const W = {
    live: true,
    kind,
    layout: sessionStorage.getItem(K + 'Layout') || (!post && sessionStorage.getItem('wm.wardDetailed') === '1' ? '1' : '0'), // 0 notebook · 1 detailed · 2 rounds
    get detailed() { return this.layout === '1'; },
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
        <table class="board nb-screen nb-edit by-bed">
          <thead><tr><th>S.No</th><th>Name</th><th>${post ? 'Diagnosis / procedure' : 'Diagnosis'}</th><th>To do's</th><th>${post ? 'Scheme' : 'Assessment / Scheme'}</th></tr></thead>
          <tbody>
            ${list.map((c, i) => `<tr class="${c.status === 'posted' ? 'is-posted' : ''}" data-go="${c.id}" data-nbcase="${c.id}" data-q="${esc([c.name, c.ipNo, c.ward, c.diagnosis, c.plan].join(' ').toUpperCase())}">
              <td class="nb-sno"><button class="drag-handle" data-drag aria-label="Drag to reorder" title="Drag to reorder">⠿</button><span class="nb-num">${i + 1}</span></td>
              <td class="nb-name"><b>${esc(c.name)}</b>${c.status === 'posted' ? ' <span class="posted-mark">(POSTED)</span>' : ''} ${imgIcon(c)}<div class="muted small">${esc([ageSex(c), c.ipNo, c.ward].filter(Boolean).join(' · '))}</div></td>
              <td class="nb-dx">${esc(c.diagnosis)}${post
                ? `${c.procedureDone || c.plan ? `<div class="muted small">✓ ${esc(c.procedureDone || c.plan)}</div>` : ''}${podOf(c) != null ? `<span class="tag task">POD ${podOf(c)}</span>` : ''}`
                : `${c.plan ? `<div class="muted small">▸ ${esc(c.plan)}</div>` : ''}${doneHTML(c)}`}</td>
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
          <span class="muted small">${(Store.meta[wardOrderKey(W)] || []).length ? 'Order: your bed list, then the rest by date of admission' : 'Order: by date of admission — arrange it by your bed list below'}</span>
          ${(Store.meta[wardOrderKey(W)] || []).length ? '<button class="btn small" id="ward-order-reset">Clear bed order</button>' : ''}
        </div>
        <details class="arrange" data-keep="arrange-${kind}">
          <summary>Arrange by bed list</summary>
          <div class="arrange-body">
            <p class="muted small">One patient per line in bed order — the name (or IP number), e.g. <b>RAVI</b>, <b>SELVI</b>; “3 RAVI” or “BED 4 SELVI” works too. The ward is then numbered 1, 2, 3… in that order.
              ${Voice.supported ? 'Tap 🎤 and say it: “bed one Ravi, bed two Selvi…”.' : 'To dictate, use the 🎤 on your keyboard.'}</p>
            <div class="arr-box"><textarea id="arr-text" rows="6" placeholder="3 RAVI&#10;4 SELVI&#10;5 MURUGAN">${esc(W.arrText || '')}</textarea></div>
            <div class="form-actions"><button class="btn primary" id="arr-go">Rearrange</button><button class="btn" id="arr-clear">Clear</button></div>
            ${W.arrResult || ''}
          </div>
        </details>
        <div class="table-wrap">${W.detailed ? detailed : notebook}</div>
        <details class="help" data-keep="ward-help"><summary>How this page works</summary><p class="muted small">Tap a name or diagnosis to open the case. Patients posted for OT show (POSTED) and a lightly shaded row. In the notebook, type straight into the boxes: <b>Investigation</b> (what to send or repeat) and <b>Opinion / To-do</b> — one per line; a line with “OPINION” or a department name becomes an opinion on the e-case sheet, any other line a pending work; delete a line once it’s done. Assessment and scheme are the same as on the e-case sheet and OT list. Red bold = outside the normal range. Detailed shows the most recent value of each investigation (hover or long-press for its date). Any empty investigation except ESR, qCRP and pus C/S counts as pending.</p></details>`;
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
        const ids = wardCases(W).map((c) => c.id);
        W.flip = Math.sign(ids.indexOf(id) - ids.indexOf(W.roundId)); // the card flips forward / back
        W.roundId = id;
        render();
        W.flip = 0; // a teammate's edit redrawing the card doesn't flip it again
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
        const wi = e.target.closest('[data-imaging]');
        if (wi) { e.preventDefault(); return openViewer(wi.dataset.imaging); }
        // Rounds: this patient's X-rays, CT, MRI and pictures in the full-screen viewer.
        const ri = e.target.closest('[data-rd-imgs]');
        if (ri) return openViewer(ri.dataset.rdImgs);
        const rd = e.target.closest('[data-rd]');
        if (rd) return step(+rd.dataset.rd);
        // Bed-sore check
        const bs = e.target.closest('[data-bs]');
        if (bs) {
          const pop = bs.closest('[data-bs-case]');
          const cid = pop.dataset.bsCase;
          const k = bs.dataset.bs;
          if (k === 'present') { $('.bs-detail', pop).hidden = false; bs.closest('.form-actions').hidden = true; return; }
          if (k === 'skip') { bsSkipped.add(cid); return render(); }
          const at = { by: Store.who(), at: Date.now() };
          if (k === 'none') {
            Store.patch('cases', cid, { [`bedsore.${bedsoreKey()}`]: { status: 'none', ...at } });
            toast('No bed sore — noted for today');
            return;
          }
          // save: record it, and add the dressing (and a plastic surgery opinion for grade III / IV)
          const sites = $$('[data-bs-site]', pop).filter((x) => x.checked).map((x) => x.dataset.bsSite);
          if (!sites.length) return toast('Tick where the bed sore is', 2500);
          const grade = $('[data-bs-grade]', pop).value;
          const ch = { [`bedsore.${bedsoreKey()}`]: { status: 'present', sites, grade, ...at } };
          const text = `BED SORE DRESSING - ${sites.join(', ')}, GRADE ${grade}`;
          const cur = Store.cases[cid];
          if (!listOf(cur.tasks).some((t) => !t.done && t.text === text)) ch[`tasks.${uid()}`] = { text, to: '', done: false, by: Store.who(), at: Date.now() };
          if (['III', 'IV'].includes(grade) && !listOf(cur.opinions).some((o) => /PLASTIC/i.test(o.dept) && !hasText(o.note))) ch[`opinions.${uid()}`] = { dept: 'PLASTIC SURGERY', note: '', at: Date.now() };
          Store.patch('cases', cid, ch);
          toast(`Bed sore noted — dressing added${['III', 'IV'].includes(grade) ? ' + plastic surgery opinion' : ''}`, 3500);
          return;
        }
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
        // From earlier rounds: open a result form / save it / mark done
        if (reviewClick(e)) return;
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
        if (e.target.closest('textarea, input, select, label, button, details')) return;
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
            setWardOrder(W, after);
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
      // Bed list → ward order
      const arr = $('#arr-text', el);
      if (arr) {
        arr.addEventListener('input', () => { W.arrText = arr.value; });
        Voice.attach(arr.parentElement);
        $('#arr-clear', el).onclick = () => { W.arrText = ''; W.arrResult = ''; arr.value = ''; render(); };
        $('#arr-go', el).onclick = () => {
          Voice.stop();
          W.arrText = arr.value;
          const lines = BedArrange.parse(arr.value);
          if (!lines.length) return toast('Type or dictate the patients in bed order first', 3500);
          const cases = W.kind === 'post' ? postWardCases() : activeCases();
          const r = BedArrange.match(lines, cases);
          if (!r.order.length) {
            W.arrResult = '<p class="arr-res bad">None of those lines matched a patient in this ward.</p>';
            return render();
          }
          Store.setMeta({ [wardOrderKey(W)]: r.order });
          const nm = (c) => esc(c.name);
          W.arrResult = `<div class="arr-res"><p><b>Arranged ${r.order.length} of ${cases.length}.</b></p>
            ${r.unmatched.length ? `<p class="bad">Couldn’t match: ${r.unmatched.map(esc).join(' · ')}</p>` : ''}
            ${r.missing.length ? `<p class="muted">Not in your list (placed after, by date of admission): ${r.missing.map(nm).join(', ')}</p>` : ''}</div>`;
          toast(`Ward arranged: ${r.order.length} of ${cases.length}`);
          render();
        };
      }
      const wReset = $('#ward-order-reset', el);
      if (wReset) wReset.onclick = () => { Store.setMeta({ [wardOrderKey(W)]: [] }); W.arrResult = ''; toast('Bed order cleared'); };
      filter();
      el.addEventListener('change', (e) => {
        const t = e.target;
        if (reviewChange(e)) return;
        const id = t.closest('[data-nbcase]')?.dataset.nbcase;
        const f = t.dataset.nb;
        if (!id || !f || !Store.cases[id]) return;
        const c = { id, ...Store.cases[id] };
        if (f === 'inv') Store.patch('cases', id, { invTodo: t.value.trim().toUpperCase(), invAsked: invAskedNext(c, t.value) });
        else if (f === 'bed') Store.patch('cases', id, { bed: t.value.trim().toUpperCase() });
        else if (f === 'procedureDone') Store.patch('cases', id, { procedureDone: t.value.trim().toUpperCase() });
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
              <div><b>${esc(c.name)}</b> <span class="muted">${esc(ageSex(c))}${c.ipNo ? ' · IP ' + esc(c.ipNo) : ''}</span></div>
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
            ${id ? '' : '<a class="chip on" href="#sec-inv" data-jump>Investigations</a><a class="chip" href="#sec-img" data-jump>Images</a>'}
          </nav>
          <form id="case-form" class="form" autocomplete="off">
            <fieldset class="card" id="sec-patient"><legend>Patient</legend>
              <label class="span2">Name<input name="name" required value="${esc(c.name)}"></label>
              <label>Age<input name="age" inputmode="numeric" value="${esc(c.age)}"></label>
              <label>Sex<select name="sex">${opts([['', '—'], ['M', 'Male'], ['F', 'Female'], ['O', 'Other']], c.sex || '')}</select></label>
              <label>IP number<input name="ipNo" inputmode="numeric" value="${esc(c.ipNo)}"></label>
              <label>Ward<select name="ward">${wardOpts(c.ward)}</select></label>
              <label>Date of admission<input type="date" name="doa" value="${esc(c.doa)}"></label>
              <label>Attender<input name="attender" value="${esc(c.attender)}"></label>
              <label>Phone<input name="phone" type="tel" inputmode="tel" value="${esc(c.phone)}"></label>
              <label>Address<input name="address" value="${esc(c.address)}"></label>
            </fieldset>
 <fieldset class="card" id="sec-plan"><legend>Diagnosis & plan</legend>
              <label class="span2">Diagnosis<textarea name="diagnosis" rows="2">${esc(c.diagnosis)}</textarea></label>
              <label class="span2">Plan (proposed surgery)<textarea name="plan" rows="2">${esc(c.plan)}</textarea></label>
              <label>Level<select name="level">${levelOpts(c.level)}</select><span class="hint" id="level-hint"></span></label>
              ${id ? '' : `<label class="span2">Comorbidities<input name="comorbid" value="${esc(c.comorbid)}"></label>`}
              <label>Mode<input name="mode" list="dl-mode" value="${esc(c.mode)}"></label>
              <label class="span2">Implants
                <textarea name="implants" rows="2">${esc(c.implants)}</textarea>
                <span class="hint" id="impl-hint"></span>
              </label>
              <div class="span2"><button type="button" class="btn small" id="impl-fill">↻ Fill implants & level from database</button></div>
            </fieldset>
            ${id ? '' : `
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

        // Scheme is set from rounds / the OT list; treatment and written-by aren't asked here (the admission
        // deck still has them). None of the three is in this form, so saving leaves them as they are.
        const BASIC = ['name', 'age', 'sex', 'ipNo', 'ward', 'doa', 'attender', 'phone', 'address', 'diagnosis', 'plan', 'level', 'comorbid', 'implants', 'mode'];

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
          for (const file of await cropAll(files)) {
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
        f.onsubmit = async (e) => {
          e.preventDefault();
          // only what's on the form (editing a case has no comorbidities box: they live on the e-case sheet)
          const data = Object.fromEntries(BASIC.filter((k) => f.elements[k]).map((k) => [k, f.elements[k].value.trim()]));
          if (id) {
            const before = Store.cases[id];
            const changed = Object.keys(data).filter((k) => (before[k] || '') !== data[k]);
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
          const doc = { ...data, treatment: STANDARD_TREATMENT.join('\n'), status: 'preop', work, pus: { organism: f.elements.pusOrganism.value.trim(), sensitive: f.elements.pusSensitive.value.trim() } };
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
        const images = caseImages(id);
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
              ${c.mode ? `<dt>Mode</dt><dd>${esc(c.mode)}</dd>` : ''}
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
          if (t.dataset.pacDone || t.dataset.pacNote) {
            const k = t.dataset.pacDone || t.dataset.pacNote;
            const base = `work.pacDone.${k}`;
            if (t.dataset.pacNote) {
              Store.patch('cases', id, { [`${base}.note`]: t.value.trim().toUpperCase() });
              return;
            }
            Store.patch('cases', id, { [`${base}.done`]: t.checked, [`${base}.by`]: Store.who(), [`${base}.at`]: Date.now() });
            if (t.checked) logUpdate(id, `PAC: ${(pacLines(Store.cases[id]).find((l) => pacKey(l) === k) || '').toUpperCase()} — done`);
            const cur = Store.cases[id];
            if (t.checked && cur.work?.anaes === 'Provisionally assessed' && pacLines(cur).length && !pacOpen(cur).length) {
              Store.patch('cases', id, { 'work.anaes': 'Assessed' });
              toast('All PAC works done — marked Assessed', 3500);
            }
            return;
          }
          if (t.dataset.lab) {
            const base = `labs.${t.dataset.lab}`;
            const cur = Store.cases[id].labs?.[t.dataset.lab]?.v?.[t.dataset.lk] ?? '';
            const val = t.value.trim();
            if (val === String(cur).trim()) return;
            Store.patch('cases', id, { [`${base}.v.${t.dataset.lk}`]: val || DELETE, [`${base}.by`]: Store.who() });
            if (val) {
              const p = [...ALL_PARAMS, ...customParams(Store.cases[id])].find((x) => x.k === t.dataset.lk);
              logUpdate(id, `${p?.label || t.dataset.lk} ${val}`);
            }
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
            const op = /^opinions\.(\w+)\.note$/.exec(t.dataset.bind);
            if (op && t.value.trim()) logUpdate(id, `${opLine(Store.cases[id].opinions?.[op[1]] || {})} — ${t.value.trim().toUpperCase()}`);
          } else if (t.dataset.task) {
            const k = 'tasks.' + t.dataset.task;
            Store.patch('cases', id, t.checked
              ? { [k + '.done']: true, [k + '.doneBy']: Store.who(), [k + '.doneAt']: Date.now() }
              : { [k + '.done']: false });
            if (t.checked) logUpdate(id, `${taskLine(Store.cases[id].tasks?.[t.dataset.task] || {})} — done`);
          } else if (t.dataset.upload) {
            const files = [...t.files];
            t.value = '';
            for (const file of await cropAll(files)) {
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
    .filter((i) => (kind ? i.kind === kind : i.kind !== 'dcpdf'))
    .sort((a, b) => IMG_ORDER.indexOf(a.kind) - IMG_ORDER.indexOf(b.kind) || (a.at || 0) - (b.at || 0));

  // Small picture icon + count beside a name; opens this patient's images in the viewer.
  const IMG_SVG = '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><rect x="3" y="4.5" width="18" height="15" rx="2.5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="8.5" cy="9.5" r="1.8" fill="currentColor"/><path d="M4 18l5.2-5.2 3.3 3.3 2.6-2.6L20 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>';
  function imgIcon(c) {
    const n = caseImages(c.id).length;
    return n ? `<button type="button" class="img-ico" data-imaging="${c.id}" title="Radiographs & pictures (${n})" aria-label="Open ${n} image${n === 1 ? '' : 's'} of ${esc(c.name)}">${IMG_SVG}<span>${n}</span></button>` : '';
  }

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
              ${viewRole() === 'consultant' ? '' : '<button class="btn small danger" data-v="del">Delete</button>'}
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
      {
        const src = await Store.getImage(im.id);
        if (cur !== iid) return;
        if (src) $('img', m).src = src;
        else $('img', m).insertAdjacentHTML('afterend', `<div class="viewer-msg">This picture isn't saved on this phone yet and the network isn't reaching the server. It will open once you have signal${navigator.onLine ? ' — try again in a moment' : ''}.</div>`);
      }
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

  // OT list contacts for the WhatsApp bot (Settings): 10-digit numbers get 91 in front.
  const otWaNumbers = () => [...new Set(String(Store.meta.otWaNumbers || '').split(/[,;\n]+/).map((p) => {
    let d = p.replace(/\D/g, '');
    if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
    return d.length === 10 ? '91' + d : d;
  }).filter((d) => d.length >= 11 && d.length <= 15))];
  const otWaReady = () => Store.mode === 'firebase' && /^https:\/\//.test(String(Store.meta.waBotUrl || '')) && otWaNumbers().length > 0;

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
          <label class="btn small" title="An OT list made outside the app (Word or PDF): its scheme status goes to Unit VI's scheme report">⬆ Upload OT list<input type="file" id="ot-upload" accept=".docx,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" hidden></label>
          <a class="btn primary" href="#/ot/list" ${sel.length ? '' : 'aria-disabled="true"'} id="ot-next">Next (${sel.length}) →</a>
        </div>
        <div class="card">
          <p class="offline-line small" id="offline-line">${offlineLine()}</p>
          <div class="row-between"><p class="muted small">Tap a row to add it to the list. Radiographs open in a viewer; use → to step through X-ray, CT and MRI.</p>
            <label class="small nowrap"><input type="checkbox" id="ot-all" ${OT.showAll ? 'checked' : ''}> show all statuses</label></div>
          <div class="order-bar">
            <span class="muted small">${Store.meta.caseOrder?.length ? 'Your own order (same as the Cases page)' : 'Earliest admitted first'}</span>
            ${Store.meta.caseOrder?.length ? '<button class="btn small" id="ot-order-reset">Back to DOA order</button>' : ''}
          </div>
          <div class="table-wrap">
            <table class="board picker">
              <thead><tr><th title="Change the order">Order</th><th></th><th>Name</th><th>Age/Sex</th><th>Diagnosis</th><th>Plan</th><th>DOA</th><th>Anaesthesia</th><th>Scheme</th><th class="ot-rg">Radiographs</th><th></th></tr></thead>
              <tbody>
                ${pool.map((c, pi) => {
                  const n = caseImages(c.id).length;
                  return `<tr class="${d.selected.includes(c.id) ? 'picked' : ''}" data-row="${c.id}" data-case="${c.id}">
                  <td class="ot-move"><button class="icon" data-omove="-1" ${pi ? '' : 'disabled'} aria-label="Move up" title="Move up">↑</button><button class="icon" data-omove="1" ${pi < pool.length - 1 ? '' : 'disabled'} aria-label="Move down" title="Move down">↓</button></td>
                  <td><input type="checkbox" data-pick="${c.id}" ${d.selected.includes(c.id) ? 'checked' : ''} aria-label="Select ${esc(c.name)}"></td>
                  <td><b>${esc(c.name)}</b> ${imgIcon(c)}${c.otOnly ? '<br><span class="tag task">OT only</span>' : ''}</td><td class="nowrap">${esc(ageSex(c))}</td>
                  <td>${esc(c.diagnosis)}</td><td>${esc(c.plan)}</td>
                  <td class="nowrap">${esc(fmtDate(c.doa))}</td>
                  <td><select class="ot-sel" data-f="work.anaes" aria-label="Anaesthesia assessment"><option value="">—</option>${opts(PAC_OPTIONS, c.work?.anaes || '')}</select></td>
                  <td><select class="ot-sel" data-f="scheme" aria-label="Scheme status">${schemeOpts(c.scheme)}</select></td>
                  <td class="nowrap ot-rg">${n ? `<a href="#" class="img-link" data-imaging="${c.id}">View ${n} ›</a>` : '<span class="muted">None</span>'}</td>
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
            <label>IP no.<input name="ipNo" inputmode="numeric"></label>
            <label>Ward<select name="ward">${wardOpts('')}</select></label>
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
        <p class="offline-line small" id="offline-line">${offlineLine()}</p>
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
                  <b>${i + 1}. ${esc(c.name)}</b>${d.standby.includes(c.id) ? ' <span class="tag task">(STANDBY)</span>' : ''} ${imgIcon(c)} <span class="muted">${esc(ageSex(c))} · IP ${esc(c.ipNo)} · DOA ${esc(fmtDate(c.doa))}</span>
                  <span class="right">
                    <button class="btn small${d.standby.includes(c.id) ? ' primary' : ''}" data-standby title="Print “(STANDBY)” under the name">Standby</button>
                    <button class="icon" data-move="-1" ${i ? '' : 'disabled'} title="Move up">↑</button>
                    <button class="icon" data-move="1" ${i < sel.length - 1 ? '' : 'disabled'} title="Move down">↓</button>
                    <button class="icon" data-unpick title="Remove">✕</button>
                  </span>
                </div>
                <div class="ot-fields">
                  <label>Ward<select data-f="ward">${wardOpts(c.ward)}</select></label>
                  <label>Level<select data-f="level">${levelOpts(c.level)}</select></label>
                  <label>Scheme status<select data-f="scheme">${schemeOpts(c.scheme)}</select></label>
                  ${['NO SCHEME', 'DENIED'].includes(c.scheme) ? `<label class="span2">No-scheme reason<input data-f="schemeReason" list="dl-noscheme" value="${esc(c.schemeReason || '')}" placeholder="Why no scheme (for Unit VI's report)"></label>` : ''}
                  <label>Anaesthesia assessment<select data-f="work.anaes"><option value="">—</option>${opts(PAC_OPTIONS, c.work?.anaes || '')}</select></label>
                  <label class="span3">Diagnosis<textarea data-f="diagnosis" rows="2">${esc(c.diagnosis)}</textarea></label>
                  <label class="span3">Plan<textarea data-f="plan" rows="2">${esc(c.plan)}</textarea></label>
                  <label class="span3">Implants <button type="button" class="link small" data-refill>↻ implants & level from database</button><textarea data-f="implants" rows="2">${esc(c.implants)}</textarea></label>
                </div>
              </div>`).join('') || '<div class="empty">Tick cases above to add them.</div>'}
          </div>
        </div>

        <div class="card print-card">
          <label class="small"><input type="checkbox" id="ot-mark" checked> Mark these cases as “Posted”</label>
          <div class="form-actions">
            <button class="btn primary" id="ot-go" ${sel.length ? '' : 'disabled'}>Generate OT list PDF</button>
            <button class="btn primary" id="ot-go2" ${sel.length ? '' : 'disabled'}>Generate OT list print PDF</button>
            <button class="btn wa" id="ot-wa" ${sel.length ? '' : 'disabled'}>WhatsApp OT list PDF</button>
            ${otWaReady() ? `<button class="btn wa" id="ot-wa-bot" ${sel.length ? '' : 'disabled'} title="${esc(otWaNumbers().join(', '))}">WhatsApp group + OT contacts (${otWaNumbers().length})</button>` : ''}
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
      // An OT list made outside the app: read it, check it, send its scheme status to Unit VI.
      const otUp = $('#ot-upload', el);
      if (otUp) otUp.onchange = async () => {
        const file = otUp.files[0];
        otUp.value = '';
        if (!file) return;
        toast('Reading the OT list…', 8000);
        let r;
        try { r = await OtImport.read(file); } catch (err) { console.error(err); return toast(`Couldn't read that file: ${err.message}`, 6000); }
        if (!r.rows.length) return toast("No patients found — the table needs a NAME column (and SCHEME STATUS). Send me the file if it's in another layout.", 7000);
        const norm = (s) => String(s || '').replace(/\W/g, '').toUpperCase();
        const match = (row) => allCases().find((c) => (row.ipNo && norm(c.ipNo) === norm(row.ipNo)) || (!row.ipNo && norm(c.name) === norm(row.name)));
        const SCH = ['', ...SCHEMES];
        $('.otup-pop')?.remove();
        const pop = document.createElement('div');
        pop.className = 'sug-back otup-pop';
        pop.innerHTML = `<div class="sug-box card" role="dialog" aria-label="Uploaded OT list">
            <h3>${esc(file.name)}</h3>
            ${r.title ? `<p class="muted small">${esc(r.title)}</p>` : ''}
            <label>OT date<input type="date" id="otup-date" value="${esc(r.date)}"></label>
            <p class="muted small">${r.rows.length} patient${r.rows.length === 1 ? '' : 's'} found. Check the scheme status; it goes to Unit VI's scheme report for Unit ${esc(Store.meta.unitId)}.</p>
            <div class="otup-rows">${r.rows.map((x, i) => { const m = match(x); return `<div class="otup-row" data-i="${i}">
                <label class="otup-name"><input type="checkbox" data-in checked> <b>${esc(x.name)}</b> <span class="muted small">${esc([x.ageSex, x.ipNo && 'IP ' + x.ipNo].filter(Boolean).join(' · '))}</span>${m ? ' <span class="tag" title="Matched to the e-case sheet">in app</span>' : ''}</label>
                <div class="muted small">${esc(x.procedure || x.diagnosis)}</div>
                <div class="otup-sel"><select data-sch>${opts(SCH.map((s) => [s, s || '— not given —']), x.scheme)}</select>
                  <label class="small"><input type="checkbox" data-sb ${x.standby ? 'checked' : ''}> standby</label></div>
                <input data-rs list="dl-noscheme" placeholder="No-scheme reason" value="${esc(x.reason)}" ${['NO SCHEME', 'DENIED'].includes(x.scheme) ? '' : 'hidden'}>
                ${x.schemeText && !x.scheme ? `<div class="warn-text small">Couldn't tell the status from “${esc(x.schemeText)}” — pick it.</div>` : ''}
              </div>`; }).join('')}</div>
            <div class="form-actions">
              <button type="button" class="btn primary" data-otup="send">Send to scheme report</button>
              <button type="button" class="btn" data-otup="cancel">Cancel</button>
            </div>
          </div>`;
        pop.addEventListener('change', (ev) => {
          const sel = ev.target.closest('[data-sch]');
          if (sel) $('[data-rs]', sel.closest('.otup-row')).hidden = !['NO SCHEME', 'DENIED'].includes(sel.value);
        });
        pop.addEventListener('click', async (ev) => {
          const go = ev.target.closest('[data-otup]')?.dataset.otup;
          if (!go) return;
          if (go === 'cancel') { pop.remove(); return; }
          const date = $('#otup-date', pop).value;
          if (!date) { toast('Pick the OT date', 2500); return; }
          const cases = $$('.otup-row', pop).filter((row) => $('[data-in]', row).checked).map((row) => {
            const x = r.rows[+row.dataset.i];
            const m = match(x);
            const sch = $('[data-sch]', row).value;
            return {
              id: m?.id || `up_${norm(x.ipNo) || norm(x.name)}`, name: x.name, ageSex: x.ageSex, ipNo: x.ipNo, diagnosis: x.diagnosis, procedure: x.procedure,
              scheme: sch, reason: ['NO SCHEME', 'DENIED'].includes(sch) ? $('[data-rs]', row).value.trim().toUpperCase() : '', standby: $('[data-sb]', row).checked, uploaded: true,
            };
          });
          pop.remove();
          try {
            await Store.saveSchemeReport({ date, unitId: Store.meta.unitId, cases, file: file.name });
            schemeMine = null;
            toast(`Scheme status of ${cases.length} patient${cases.length === 1 ? '' : 's'} (${fmtDate(date)}) sent to Unit VI`, 4000);
          } catch (err) { toast(`Couldn't send: ${err.code || err.message}`, 5000); }
        });
        document.body.appendChild(pop);
      };

      el.addEventListener('change', (e) => {
        const t = e.target;
        if (t.dataset.otXray) {
          const cid = t.dataset.otXray;
          const files = [...t.files];
          t.value = '';
          (async () => {
            let n = 0;
            for (const file of await cropAll(files)) {
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
          for (const file of await cropAll(files)) {
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
        sendScheme(cases, dd);
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
      $('#ot-wa', el).onclick = () => { const [cases, dd] = build(); sendScheme(cases, dd); SharePdf.ot(cases, dd); };
      // The unit's WhatsApp bot sends the PDF to the OT contacts in Settings.
      const waBot = $('#ot-wa-bot', el);
      // One tap: the share sheet first (iPhone only opens it straight from a tap) to pick the group,
      // then the bot sends the same PDF to the OT contacts.
      if (waBot) waBot.onclick = async () => {
        const nums = otWaNumbers();
        const [cases, dd] = build();
        sendScheme(cases, dd);
        const file = SharePdf.otPdf(cases, dd);
        await SharePdf.share(file);
        if (!confirm(`Also send it from the unit's WhatsApp bot to the ${nums.length} OT contact${nums.length === 1 ? '' : 's'}?\n\n${nums.join('\n')}`)) return;
        waBot.disabled = true;
        toast('Sending to the OT contacts…', 15000);
        try {
          const pdf = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(file); });
          const token = await Store.idToken();
          if (!token) throw new Error('Sign in first');
          const r = await fetch(Store.meta.waBotUrl.replace(/\/+$/, '') + '/send-ot', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ pdf, filename: file.name, title: file.name.replace(/\.pdf$/i, ''), unit: Store.unitKey }),
          });
          const j = await r.json().catch(() => ({}));
          if (!r.ok) throw new Error(j.error || `the bot answered ${r.status}`);
          const bad = (j.results || []).filter((x) => !x.ok);
          toast(bad.length ? `Sent to ${j.sent} of ${j.total}. Not sent: ${bad.map((x) => `${x.to} (${x.error})`).join('; ')}` : `✓ OT list sent on WhatsApp to ${j.sent} contact${j.sent === 1 ? '' : 's'}`, bad.length ? 9000 : 4000);
        } catch (e) {
          toast(`Couldn't send on WhatsApp: ${e.message}${navigator.onLine ? '' : ' (no network)'}`, 7000);
        }
        waBot.disabled = false;
      };
      $('#ot-mail', el).onclick = () => {
        const to = String(Store.meta.otEmail || '').trim();
        if (!to) return toast('Add the OT list email address in Settings first', 4000);
        const [cases, dd] = build();
        sendScheme(cases, dd);
        SharePdf.otEmail(cases, dd, to);
      };
      // Phones get a real PDF file (window.print is unreliable there); computers keep the print dialog.
      // Consent forms: a quick check first (form, Tamil name, implant words), then the pages.
      $('#ot-consent', el).onclick = () => {
        const [cases] = build();
        $('.cf-pop')?.remove();
        const pop = document.createElement('div');
        pop.className = 'sug-back cf-pop';
        const g = (c) => ({
          name: ConsentForm.nameTa({ ...c, nameTa: '' }),
          imp: (ConsentForm.isExit(c) ? ConsentForm.exitImplant : ConsentForm.procImplant)({ ...c, consentImplant: '', exitImplant: '' }),
          bone: ConsentForm.fracture({ ...c, exitBone: '' }),
        });
        pop.innerHTML = `<div class="sug-box card" role="dialog" aria-label="Check consent forms">
            <h3>Check before printing</h3>
            <p class="muted small">Tamil spelling is a guess from the English name — correct anything wrong. Changes are kept for this patient.</p>
            ${cases.map((c) => { const x = g(c); return `<div class="cf-row" data-cf="${c.id}">
              <div><b>${esc(c.name)}</b> <span class="muted small">${esc(c.diagnosis || '')}</span></div>
              <label>Form<select data-cfk="consentTpl"><option value="">Auto (${esc(ConsentForm.label({ ...c, consentTpl: '' }))})</option>${opts(Object.entries(CONSENT_TPLS).map(([k, t]) => [k, t.label]), c.consentTpl || '')}</select></label>
              <label>பெயர்<input data-cfk="nameTa" data-guess="${esc(x.name)}" value="${esc(c.nameTa || x.name)}"></label>
              <label>${ConsentForm.isExit(c) ? 'பொருத்திய உலோகம்' : 'உலோகம்'}<input data-cfk="consentImplant" data-guess="${esc(x.imp)}" value="${esc(c.consentImplant || c.exitImplant || x.imp)}"></label>
              ${ConsentForm.isExit(c) ? `<label>எலும்பு முறிவு<input data-cfk="exitBone" data-guess="${esc(x.bone)}" value="${esc(c.exitBone || x.bone)}"></label>` : ''}
            </div>`; }).join('')}
            <div class="form-actions"><button type="button" class="btn primary" data-cf-go>Make consent forms</button><button type="button" class="btn" data-cf-cancel>Cancel</button></div>
          </div>`;
        pop.addEventListener('click', (ev) => {
          if (ev.target.closest('[data-cf-cancel]') || ev.target === pop) { pop.remove(); return; }
          if (!ev.target.closest('[data-cf-go]')) return;
          // keep only what differs from the guess, so a better guess later still applies
          $$('[data-cf]', pop).forEach((row) => {
            const id = row.dataset.cf;
            const cur = Store.cases[id] || {};
            const ch = {};
            $$('[data-cfk]', row).forEach((f) => {
              const k = f.dataset.cfk;
              const v = f.value.trim();
              const keep = f.dataset.guess !== undefined && v === f.dataset.guess ? '' : v;
              if ((cur[k] || '') !== keep) ch[k] = keep;
            });
            if (cur.exitImplant && ch.consentImplant !== undefined) ch.exitImplant = '';
            if (Object.keys(ch).length) Store.patch('cases', id, ch);
          });
          pop.remove();
          const [fresh, dd] = build();
          if (PhonePdf.isPhone()) PhonePdf.consents(fresh, dd); else Print.consents(fresh, dd);
        });
        document.body.appendChild(pop);
      };
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
        id: c.id, status: c.deckStatus || '', name: c.name, ageSex: ageSex(c), mode: c.mode, diagnosis: c.diagnosis,
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
                <label>Status<select data-cf="deckStatus"><option value="">No status</option>${opts(DeckEngine.STATUSES, cc.deckStatus || '')}</select></label>
                <label>Mode<input data-cf="mode" list="dl-mode" value="${esc(cc.mode)}"></label>
                <label class="span2">Diagnosis<textarea data-cf="diagnosis" rows="2">${esc(cc.diagnosis)}</textarea></label>
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
            <label class="btn wa">📎 Add exported WhatsApp chat<input type="file" id="deck-wa" accept=".zip,.txt,application/zip,text/plain" hidden></label>
            <a class="btn" href="#/import/deck/${esc(date)}">From PowerPoint</a>
            ${others.length ? `<select id="deck-add" aria-label="Add an existing case"><option value="">or add an existing case…</option>${others.map((c) => `<option value="${c.id}">${esc(c.name)} — DOA ${esc(fmtDate(c.doa))}</option>`).join('')}</select>` : ''}
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
      const wa = $('#deck-wa', el);
      if (wa) wa.onchange = () => {
        const f = wa.files[0];
        if (!f) return;
        Import.items = null;
        Import.usePosted = false;
        location.hash = `#/import/deck/${date}`;
        setTimeout(() => Import.readChat(f), 0);
      };
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
          let files = [...t.files];
          let kind = t.dataset.dupload;
          t.value = '';
          // Custom: a new slide group per upload, with its own editable title.
          if (kind === 'custom') {
            const n = Math.max(0, ...caseImages(cid).map((im) => (/^custom-(\d+)$/.exec(im.kind) || [0, 0])[1] * 1));
            kind = 'custom-' + (n + 1);
          }
          (async () => {
            files = await cropAll(files);
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
      ['condition', 'Condition on discharge', 10, ['cond', '↻ auto-write']],
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
          // written from the diagnosis: immobilisation + local examination (spine: power table)
          condition: dcConditionText(dcRegions(c, { dos: c.surgeryDate || c.otDate })),
          ...(() => { const adv = dcUsualAdvice(c, { dos: c.surgeryDate || c.otDate }); return { advice: adv.map((a) => a[0]).join('\n'), adviceTa: adv.map((a) => a[1]).join('\n') }; })(),
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
        // Condition on discharge: the immobilisation for each injured part, and the power grid for spine cases.
        const regs = dcRegions(c, d);
        const condHelp = `<div class="span2 dc-cond">
            ${regs.length ? `<div class="dc-splints">${regs.map((r, i) => `<label>${esc(r.part === 'pelvis' ? 'Pelvis' : `${r.side ? r.side[0] + r.side.slice(1).toLowerCase() + ' ' : ''}${r.limb.toLowerCase()}`)}<select name="splint_${i}" data-splint>${opts(Object.keys(DC_SPLINTS), d[`splint_${i}`] || r.splint)}</select></label>`).join('')}</div>`
              : '<p class="muted small">No limb, spine or pelvis found in the diagnosis — type the local examination below.</p>'}
            ${regs.some((r) => r.part === 'spine') ? `<div class="dc-power"><div class="dc-power-h"><b>Power</b> <span class="muted small">type the grade (0-5); blank stays “-/5”</span></div>
              <table><thead><tr><th></th><th>RT</th><th>LT</th></tr></thead><tbody>${DC_POWER_LEVELS.map((lvl) => `<tr><th>${lvl}</th>${['R', 'L'].map((sd) => `<td><input name="pw_${lvl}${sd}" data-pw="${lvl}" value="${esc(d[`pw_${lvl}${sd}`] || '')}" inputmode="numeric" maxlength="2" aria-label="${lvl} ${sd === 'R' ? 'right' : 'left'} power"></td>`).join('')}</tr>`).join('')}</tbody></table></div>` : ''}
          </div>`;
        const field = ([k, l, rows, btn]) => `${k === 'condition' ? condHelp : ''}<label class="span2">${l}${btn ? ` <button type="button" class="link small" data-tpl="${btn[0]}">${btn[1]}</button>` : ''}<textarea name="${k}" rows="${rows}">${esc(d[k])}</textarea></label>${k === 'treatment' ? drugBtns : ''}`;
        return `
          <h2>Discharge / transfer — ${esc(c.name)} <span class="muted small">${esc(ageSex(c))} · IP ${esc(c.ipNo)}</span></h2>
          <div class="card dc-upload">
            <div><b>Typed the summary yourself?</b> <span class="muted small">Upload the PDF — its details fill in below and you can dispose the patient. Your PDF is kept as the discharge summary.</span></div>
            <div class="dc-upload-row">
              <label class="btn primary">📄 Upload discharge summary PDF<input type="file" accept="application/pdf,.pdf" id="dc-pdf" hidden></label>
              ${caseImages(id, 'dcpdf').length ? `<button type="button" class="btn" id="dc-pdf-open">Open the uploaded summary</button>` : ''}
            </div>
          </div>
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
              <label>Ph. no<input name="phone" type="tel" inputmode="tel" value="${esc(d.phone)}"></label>
              <label>Contact no (optional)<input name="contact" type="tel" inputmode="tel" value="${esc(d.contact)}"></label>
              <label class="span2">Address<input name="address" value="${esc(d.address)}"></label>
            </fieldset>
            <fieldset><legend>Summary</legend>
              ${FIELDS.map(field).join('')}
            </fieldset>
            <fieldset><legend>Discharge advice</legend>
              <div class="span2 dc-adv-btns">
                <button type="button" class="btn small primary" data-adv="usual">✦ Usual advice</button>
                <button type="button" class="chip${sp ? ' suggest' : ''}" data-adv="spine">+ Spine / pelvis advice${sp ? ' (suggested)' : ''}</button>
                ${dcComorbidities(c, d).length ? '<button type="button" class="chip suggest" data-adv="comorb">+ Comorbidity advice</button>' : ''}
              </div>
              <div class="span2 chips">${ADVICE_PHRASES.map(([en], i) => `<button type="button" class="chip" data-phrase="${i}">+ ${esc(en)}</button>`).join('')}</div>
              <div class="span2 review-row">
                <span>Review after</span>
                <input id="rv-weeks" type="number" min="1" value="2" inputmode="numeric">
                <span>weeks on</span>
                <select id="rv-day">${opts(EN_DAYS.slice(1), 'MONDAY')}</select>
                <span>OPD</span><input id="rv-opd" value="${esc(m.opd || '')}">
                <button type="button" class="btn small" id="rv-add">+ Add review</button>
              </div>
              <label class="span2">Advice (English)<textarea name="advice" rows="4">${esc(d.advice)}</textarea></label>
              <label class="span2">Advice (Tamil — printed below, one line each) <button type="button" class="link small" id="ta-from-en">↻ from the English advice</button><textarea name="adviceTa" rows="4" lang="ta">${esc(d.adviceTa)}</textarea></label>
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
        Voice.attach(f, { inputs: true }); // 🎤 dictation in every discharge summary box
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
        // Condition on discharge: re-written from the chosen immobilisation; power grades go into their lines.
        const splintsNow = () => dcRegions(c(), data()).map((r, i) => f.elements[`splint_${i}`]?.value || r.splint);
        const writeCondition = () => { f.elements.condition.value = dcConditionText(dcRegions(c(), data()), splintsNow(), data()); };
        f.addEventListener('change', (e) => { if (e.target.matches('[data-splint]')) writeCondition(); });
        f.addEventListener('input', (e) => {
          const lvl = e.target.dataset.pw;
          if (!lvl) return;
          const ta = f.elements.condition;
          ta.value = ta.value.split('\n').map((l) => (new RegExp(`^${lvl}\\s`).test(l) ? dcPowerLine(lvl, data()) : l)).join('\n');
        });
        // Comorbidities: continue their drugs (or the general line) and review at the right OPD.
        const comorbPopup = () => {
          $('.cm-pop', el)?.remove();
          const items = dcComorbidities(c(), data());
          if (!items.length) return;
          const pop = document.createElement('div');
          pop.className = 'sug-back cm-pop';
          pop.innerHTML = `<div class="sug-box card" role="dialog" aria-label="Comorbidity medications">
              <h3>Continue comorbidity medications?</h3>
              <p class="muted small">Known ${esc(items.map((x) => x.k === 'OTHER' ? x.label : x.k).join(', '))}. Ticked ones go into the advice with a review at their OPD.</p>
              ${items.map((x, i) => `<div class="sug-row cm-pop-row">
                <input type="checkbox" data-cmi="${i}" checked aria-label="${esc(x.label)}">
                <span><b>${esc(x.k === 'OTHER' ? x.label : `${x.k} · ${x.label}`)}</b>
                  <span class="muted small">${x.drugs.length ? `Continue ${esc(x.drugs.join(', '))}` : esc(x.generic[0].toLowerCase().replace(/^continue/, 'Continue'))}</span>
                  <span class="cm-pop-rv">Review at <select data-cmd="${i}">${opts(DC_DEPTS.includes(x.dept) ? DC_DEPTS : [x.dept, ...DC_DEPTS], x.dept)}</select> OPD after
                    <input data-cmw="${i}" type="number" min="1" value="1" inputmode="numeric"> wk</span></span>
              </div>`).join('')}
              <div class="form-actions"><button type="button" class="btn primary" data-cm-add>Add to advice</button><button type="button" class="btn" data-cm-skip>Not now</button></div>
            </div>`;
          pop.addEventListener('click', (ev) => {
            if (ev.target.closest('[data-cm-skip]') || ev.target === pop) return pop.remove();
            if (!ev.target.closest('[data-cm-add]')) return;
            const chosen = items.map((x, i) => ({ ...x, dept: $(`[data-cmd="${i}"]`, pop).value, weeks: $(`[data-cmw="${i}"]`, pop).value }))
              .filter((x, i) => $(`[data-cmi="${i}"]`, pop).checked);
            dcComorbAdvice(chosen).forEach(([en, ta]) => { addLine('advice', en); addLine('adviceTa', ta); });
            pop.remove();
            if (chosen.length) toast(`Added: continue ${chosen.length === 1 ? 'the medication' : 'medications'} + review`);
          });
          el.appendChild(pop);
        };
        // Ask once when the page opens, unless the advice already covers them.
        {
          const items = dcComorbidities(c(), data());
          const adv = f.elements.advice.value.toUpperCase();
          const covered = items.length && items.every((x) => adv.includes(`REVIEW AT ${x.dept} OPD`));
          if (items.length && !covered) setTimeout(comorbPopup, 300);
        }
        f.addEventListener('click', (e) => {
          const adv = e.target.closest('[data-adv]');
          if (adv && adv.dataset.adv === 'comorb') return comorbPopup();
          if (adv) {
            (adv.dataset.adv === 'spine' ? DC_SPINE_ADVICE : dcUsualAdvice(c(), data(), splintsNow())).forEach(([en, ta]) => { addLine('advice', en); addLine('adviceTa', ta); });
            return;
          }
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
          else if (t.dataset.tpl === 'cond') writeCondition();
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
        $('#ta-from-en', el).onclick = (e) => {
          e.preventDefault();
          const [ta, missing] = adviceTamil(f.elements.advice.value, c(), data());
          f.elements.adviceTa.value = ta.join('\n');
          toast(missing.length ? `Tamil written for ${ta.length} line${ta.length === 1 ? '' : 's'}. No Tamil phrase for: ${missing.join('; ')} — type those yourself.` : 'Tamil written from the English advice', missing.length ? 8000 : 3000);
        };

        // ---- A summary typed elsewhere: read the PDF, show what was found, fill the form (and dispose).
        const SECT_LABEL = { ...DcImport.LABEL, adviceTa: 'ADVICE (TAMIL)' };
        const FIELD_LABEL = { arNo: 'AR no', dos: 'Date of surgery', dod: 'Date of discharge', dodTime: 'Time', consultant: 'Consultant', attender: 'Attender', phone: 'Ph. no', contact: 'Contact no', address: 'Address' };
        const fillForm = (r, pick) => {
          const set = (name, v) => { if (f.elements[name] && hasText(v)) f.elements[name].value = v; };
          for (const k of Object.keys(FIELD_LABEL)) if (pick.has('f:' + k)) set(k, r.fields[k]);
          for (const [k, v] of Object.entries(r.sections)) {
            if (!pick.has('s:' + k)) continue;
            if (k === 'opNotes') { opNotes = v; continue; }
            set(k, v);
          }
          const radio = [...f.querySelectorAll('[name=disposition]')].find((x) => x.value === r.disposition);
          if (radio && !radio.checked) { radio.checked = true; radio.dispatchEvent(new Event('change', { bubbles: true })); }
        };
        let opNotes = '';
        const keepPdf = async (file) => {
          const url = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(file); });
          if (url.length > 950000) { toast('Your PDF is too large to keep with the case (over ~700 KB) — the details were still filled in.', 6000); return false; }
          for (const old of caseImages(id, 'dcpdf')) await Store.deleteImage(id, old.id);
          await Store.addImage(id, 'dcpdf', url.replace(/^data:[^;,]*/, 'data:application/pdf'), file.name.replace(/\.[^.]+$/, ''));
          return true;
        };
        $('#dc-pdf', el).onchange = async (e) => {
          const file = e.target.files[0];
          e.target.value = '';
          if (!file) return;
          toast('Reading the PDF…', 8000);
          let r;
          try { r = await DcImport.read(file); } catch (err) { console.error(err); return toast(`Couldn't read that PDF: ${err.message}`, 6000); }
          const cc = c();
          if (!r.lines.length) return toast('That PDF has no text in it (a scan or a photo?). Save the summary from Word / Pages as a PDF and upload that.', 7000);
          let taNote = '';
          if (r.sections.advice && (!r.sections.adviceTa || tamilGarbled(r.sections.adviceTa))) {
            const garbled = !!r.sections.adviceTa;
            const [ta, missing] = adviceTamil(r.sections.advice, cc, {});
            if (ta.length) r.sections.adviceTa = ta.join('\n'); else delete r.sections.adviceTa;
            taNote = `${garbled ? "The Tamil in the PDF couldn't be read (the font scrambles it), so it" : 'The Tamil advice'} is written from the English advice${missing.length ? `; no Tamil phrase for: ${missing.join('; ')}` : ''}.`;
          }
          const ipPdf = String(r.fields.ipNo || '').replace(/\W/g, '');
          const ipCase = String(cc.ipNo || '').replace(/\W/g, '');
          const other = ipPdf && ipCase && ipPdf !== ipCase;
          const rows = [
            ...Object.keys(FIELD_LABEL).filter((k) => hasText(r.fields[k])).map((k) => ['f:' + k, FIELD_LABEL[k], k === 'dos' || k === 'dod' ? fmtDate(r.fields[k]) : r.fields[k]]),
            ...Object.entries(r.sections).map(([k, v]) => ['s:' + k, SECT_LABEL[k] || k, v]),
          ];
          const pop = document.createElement('div');
          pop.className = 'sug-back dc-imp-pop';
          pop.innerHTML = `<div class="sug-box card" role="dialog" aria-label="Discharge summary read">
              <h3>From ${esc(file.name)}</h3>
              ${other ? `<p class="notice">⚠ This PDF says IP no. <b>${esc(r.fields.ipNo)}</b>, but this patient is IP <b>${esc(cc.ipNo)}</b>${r.fields.name ? ` (${esc(r.fields.name)} in the PDF)` : ''}. Check it's the right patient.</p>` : ''}
              <label>Disposition<select id="imp-disp">${opts(Object.entries(DISPOSITIONS).map(([k, v]) => [k, v.label]), r.disposition)}</select></label>
              <p class="muted small">${rows.length ? 'Untick anything you don\'t want copied in.' : 'No headings or labelled fields were recognised — the PDF can still be kept as the discharge summary.'}</p>
              ${taNote ? `<p class="muted small">ⓘ ${esc(taNote)}</p>` : ''}
              <div class="imp-rows">${rows.map(([key, label, v]) => `<label class="imp-row"><input type="checkbox" data-imp="${key}" checked><span><b>${esc(label)}</b><span class="muted small">${esc(String(v).replace(/\n/g, ' · ').slice(0, 140))}${String(v).length > 140 ? '…' : ''}</span></span></label>`).join('')}</div>
              <label class="small"><input type="checkbox" id="imp-keep" checked> Keep this PDF as the discharge summary</label>
              <div class="form-actions">
                <button type="button" class="btn primary" data-imp-go="dispose">Fill &amp; dispose</button>
                <button type="button" class="btn" data-imp-go="fill">Fill the form only</button>
                <button type="button" class="btn" data-imp-go="cancel">Cancel</button>
              </div>
            </div>`;
          pop.addEventListener('click', async (ev) => {
            const go = ev.target.closest('[data-imp-go]')?.dataset.impGo;
            if (!go) return;
            if (go === 'cancel') { pop.remove(); return; }
            const pick = new Set($$('[data-imp]', pop).filter((x) => x.checked).map((x) => x.dataset.imp));
            r.disposition = $('#imp-disp', pop).value;
            const keep = $('#imp-keep', pop).checked;
            pop.remove();
            fillForm(r, pick);
            const d = data();
            if (opNotes) d.opNotes = opNotes;
            d.fromPdf = file.name;
            Store.patch('cases', id, { discharge: d });
            if (keep) await keepPdf(file);
            if (go === 'fill') { toast('Filled in from your PDF — check it, then Save', 4000); return; }
            const st = DISPOSITIONS[d.disposition].status;
            if (st === 'postop' && c().status !== 'postop') transferToPostop(id);
            else if (c().status !== st) Store.patch('cases', id, { status: st });
            toast(`${c().name || 'Case'} disposed — ${DISPOSITIONS[d.disposition].label}`, 4000);
            location.hash = '#/case/' + id;
          });
          document.body.appendChild(pop);
        };
        const pdfOpen = $('#dc-pdf-open', el);
        if (pdfOpen) pdfOpen.onclick = async () => {
          const im = caseImages(id, 'dcpdf').at(-1);
          const url = im && await Store.getImage(im.id);
          if (!url) return toast("Couldn't load the summary (no network?)", 4000);
          const blob = await (await fetch(url)).blob();
          offerFile(new File([blob], `${(im.caption || 'DISCHARGE SUMMARY').replace(/[\\/:*?"<>|]+/g, ' ')}.pdf`, { type: 'application/pdf' }));
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
          for (const file of await cropAll(files)) {
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
            // the discharge summary, a page per slide, at the end — your uploaded PDF if there is one
            const up = caseImages(id, 'dcpdf').at(-1);
            const upUrl = up && await Store.getImage(up.id);
            if (upUrl) {
              const doc = await DcImport.open(await (await fetch(upUrl)).blob());
              const pages = await DcImport.pageImages(doc);
              st.pages = pages.map((p) => p.data);
              st.pageAspect = pages[0]?.aspect || DcPages.ASPECT;
            } else {
              st.pages = await DcPages.render(cc, d, Store.meta);
              st.pageAspect = DcPages.ASPECT;
            }
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
            ${Store.mode !== 'firebase'
              ? `<label>Unit<select name="unitId">${opts(UNITS.map((u) => [u.id, 'UNIT ' + u.id]), m.unitId)}</select></label>`
              : Store.isOwner()
                ? `<label>Unit (you can open every unit)<select id="unit-switch">${opts(Store.unitKeys.map((k, i) => [k, 'UNIT ' + UNITS[i].id]), Store.unitKey)}</select></label>`
                : `<label>Unit<input value="UNIT ${esc(m.unitId)}" disabled></label>`}
            <label>Ortho OPD no.<input name="opd" value="${esc(m.opd)}"></label>
            <label class="span2" data-nocaps>Email the OT list to<input type="email" name="otEmail" value="${esc(m.otEmail)}" placeholder="name@example.com" autocomplete="off"></label>
            <label class="span2" data-nocaps>WhatsApp the OT list to (sent from the unit's WhatsApp bot)<textarea name="otWaNumbers" rows="2" placeholder="98765 43210, 98123 45678" autocomplete="off">${esc(m.otWaNumbers || '')}</textarea></label>
            <label class="span2" data-nocaps>WhatsApp bot address<input type="url" name="waBotUrl" value="${esc(m.waBotUrl || '')}" placeholder="https://ward-whatsapp-bot.….workers.dev" autocomplete="off"></label>
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

        ${Store.mode === 'local' || Store.isOwner() || Store.canManageTeam() ? `<div class="card">
          <h3>Views</h3>
          <p class="muted small">Each person sees the view of their role on the team list: <b>House Surgeon</b> — To-do and e-case sheets; <b>Assistant Professor / Professor</b> — case sheets in folders (basics, imaging, opinions); everyone else — the whole app. PGs get an <b>HS updates</b> tab.</p>
          <label>View the app as (this phone only, to check)<select id="view-as">${opts([['', 'My own view'], ['full', 'PG (whole app)'], ['hs', 'House surgeon'], ['consultant', 'Assistant Professor / Chief']], previewAs())}</select></label>
        </div>` : ''}
        <div class="card">
          <h3>Sharing</h3>
          ${Store.guest ? '<p><b>Guest demo.</b> These are sample patients, on this phone only. <button class="btn small" data-guest-exit>Leave the demo</button></p>' : Store.mode === 'local'
            ? (window.WARD_CONFIG?.firebase
              ? '<p>This copy was opened as a file, so it runs in <b>local mode</b>: data stays in this browser only. For live sharing, open <b>https://callus-madurai.pages.dev/</b> (or <b>https://vishnuharan2390.github.io/ward-management/</b>) instead.</p>'
              : '<p>Running in <b>local mode</b>: data lives only in this browser. To share with your HS and senior PGs, connect Firebase — see <b>README.md</b>.</p>')
            : `<p>Signed in as <b>${esc(Store.user?.email)}</b> · sync: ${esc(Store.status)} <button class="btn small" id="signout">Sign out</button></p>
               ${Store.localCaseCount() ? `<p class="notice">This device has <b>${Store.localCaseCount()}</b> case(s) saved before sharing was switched on. <button class="btn small primary" id="upload-local">Copy them to the shared database</button></p>` : ''}
               <h4>Unit ${esc(m.unitId)} team</h4>
               <ul class="members">${members.map((x) => `<li><b>${esc(x.name || x.email)}</b> ${Store.canManageTeam() ? ` <select class="role-pick" data-role-of="${esc(x.email)}" aria-label="Role of ${esc(x.name || x.email)}">${opts(ROLES.includes(x.role) || !x.role ? ROLES : [x.role, ...ROLES], x.role || 'PG')}</select> <span class="muted">${esc(x.email)}</span>` : `<span class="muted">${esc(x.role)} · ${esc(x.email)}</span>`}${x.admin ? ' <span class="tag">unit admin</span>' : ''}${Store.isOwner() ? ` <button class="btn small" data-admin="${esc(x.email)}" data-on="${x.admin ? '' : '1'}">${x.admin ? 'Remove admin' : 'Make admin'}</button>` : ''}${Store.canManageTeam() && (Store.isOwner() || x.email !== Store.user?.email?.toLowerCase()) ? ` <button class="icon" data-rm="${esc(x.email)}">✕</button>` : ''}</li>`).join('') || '<li class="muted">No one yet.</li>'}</ul>
               ${Store.canManageTeam() ? `<form class="inline-add" id="add-member">
                 <label class="mini-lab">Gmail of HS / PG<input name="email" type="email" required></label>
                 <label class="mini-lab">Name<input name="name"></label>
                 <select name="role">${opts(ROLES, 'PG')}</select>
                 <button class="btn small primary">Add</button></form>
                 <p class="muted small">Each person can be on one unit's team only. Someone on another unit's team has to be removed there first.</p>` : '<p class="muted small">Ask your unit\'s admin to add people.</p>'}`}
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
      const va = $('#view-as', el);
      if (va) va.onchange = () => {
        try { if (va.value) sessionStorage.setItem('wm.viewAs', va.value); else sessionStorage.removeItem('wm.viewAs'); } catch { /* ignore */ }
        location.hash = va.value === 'consultant' || va.value === 'hs' ? '#/' : '#/settings';
        current = null;
        render();
        toast(va.value ? `Showing the ${va.options[va.selectedIndex].text} view — Settings → Views to go back` : 'Back to your own view', 4000);
      };
      el.addEventListener('change', (e) => {
        const r = e.target.closest('[data-role-of]');
        if (r) { Store.setRole(r.dataset.roleOf, r.value); toast(`${r.dataset.roleOf}: ${r.value}`); }
      });
      const us = $('#unit-switch', el);
      if (us) us.onchange = (e) => { e.stopPropagation(); Store.switchUnit(e.target.value); toast(`Opened UNIT ${UNITS[Store.unitKeys.indexOf(e.target.value)].id}`); };
      $('#meta', el).onchange = async (e) => {
        if (e.target.id === 'unit-switch') return;
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
          Store.addMember(f.email.value, f.name.value.trim(), f.role.value).then((ok) => { if (ok) e.target.reset(); });
        };
      }
      el.addEventListener('click', (e) => {
        const b = e.target.closest('[data-rm]');
        if (b && confirm('Remove ' + b.dataset.rm + '?')) Store.removeMember(b.dataset.rm);
        const ad = e.target.closest('[data-admin]');
        if (ad) Store.setAdmin(ad.dataset.admin, !!ad.dataset.on);
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
        return `<div class="card gate"><h2>No access yet</h2><p>You're signed in as <b>${esc(Store.user?.email)}</b>, but this email isn't on the team list. Ask your unit's admin to add it under Settings → Team, then tap Try again.</p>
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
          <h2>Callus</h2>
          <p class="muted">${m === 'up' ? 'Create your account with the email your unit added to the team.' : m === 'reset' ? 'We will email you a link to set a new password.' : 'Sign in with the email your unit added to the team.'}</p>
          <form id="email-form" class="gate-form" autocomplete="on" method="post" action="#">
            <label>Email<input id="username" name="email" type="email" autocomplete="username" autocapitalize="off" spellcheck="false" required></label>
            ${m === 'reset' ? '' : `<label>Password<input id="password" name="password" type="password" autocomplete="${m === 'up' ? 'new-password' : 'current-password'}" minlength="6" required></label>
            <label class="small gate-keep"><input type="checkbox" name="keep" checked> Keep me signed in on this phone</label>`}
            <button class="btn primary">${m === 'up' ? 'Create account' : m === 'reset' ? 'Send reset link' : 'Sign in'}</button>
          </form>
          <div class="gate-links">
            ${m !== 'in' ? '<button class="link" data-mode="in">Sign in</button>' : '<button class="link" data-mode="up">New here? Create account</button><button class="link" data-mode="reset">Forgot password</button>'}
          </div>
          <div class="gate-or"><span>or</span></div>
          <button class="btn" id="signin">Sign in with Google</button>
          <div class="gate-or"><span>just looking?</span></div>
          <button class="btn" id="guest">👀 Look around as a guest</button>
          <p class="muted small">Sample patients only, on this phone — none of the unit's patients.</p>
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
      const gu = $('#guest', el);
      if (gu) gu.onclick = () => { try { localStorage.setItem('wm.guest', '1'); } catch { /* ignore */ } location.hash = '#/home'; location.reload(); };
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
              await Store.signInEmail(mail, f.elements.password.value, f.elements.keep ? f.elements.keep.checked : true);
              // Chrome / Android: offer to save the password (Safari offers it when the form is submitted)
              try { if (window.PasswordCredential) navigator.credentials.store(new PasswordCredential(f)); } catch { /* not supported */ }
            }
          } catch (err) {
            fail(err);
          }
        };
      }
    },
  };

  // ================================================================ Views by role
  // ---- House surgeons: everything open, patient by patient, with a place to enter the result.
  const Todo = {
    live: true,
    filter: 'all',
    render() {
      const cs = allCases().filter((c) => isActive(c) || c.status === 'postop')
        .filter((c) => Todo.filter === 'all' || (Todo.filter === 'post') === (c.status === 'postop'))
        .sort((a, b) => (a.status === 'postop') - (b.status === 'postop') || String(a.doa || '').localeCompare(String(b.doa || '')));
      const rows = cs.map((c) => ({ c, items: allTodos(c) })).filter((x) => x.items.length);
      const total = rows.reduce((n, x) => n + x.items.length, 0);
      return `
        <div class="toolbar"><h2>To-do <span class="pill">${total}</span></h2></div>
        <div class="chips">${[['all', 'All'], ['pre', 'Pre-op ward'], ['post', 'Post-op ward']].map(([k, l]) => `<button type="button" class="chip${Todo.filter === k ? ' on' : ''}" data-tf="${k}">${l}</button>`).join('')}</div>
        <p class="muted small">Enter the result, the opinion's orders, add the picture, or mark the work done. The PGs see each one as soon as you save it.</p>
        ${rows.map(({ c, items }) => `<div class="card todo-case" data-nbcase="${c.id}">
            <div class="todo-head"><div><b>${esc(c.name)}</b> <span class="muted">${esc(ageSex(c))}</span>
              <span class="tag">${c.status === 'postop' ? 'Post-op' : 'Pre-op'}</span>${c.ward ? ` <span class="muted small">Ward ${esc(c.ward)}</span>` : ''}
              <div class="muted small">${esc(c.diagnosis || '')}</div></div>
              <a class="btn small" href="#/case/${c.id}">e-Case sheet</a></div>
            ${reviewRows(c, items)}
          </div>`).join('') || '<div class="card empty">Nothing pending. 🎉</div>'}`;
    },
    mount(el) {
      el.addEventListener('click', (e) => {
        const f = e.target.closest('[data-tf]');
        if (f) { Todo.filter = f.dataset.tf; render(); return; }
        reviewClick(e);
      });
      el.addEventListener('change', reviewChange);
    },
  };

  // ---- PGs: what the house surgeons saved, live.
  const upSeenKey = () => `wm.upSeen.${Store.unitKey || 'local'}`;
  const hsUpdates = (all = false) => listOf(Store.updates).filter((u) => all || u.role === 'hs').sort((a, b) => (b.at || 0) - (a.at || 0));
  const unseenUpdates = () => {
    let seen = 0;
    try { seen = +localStorage.getItem(upSeenKey()) || 0; } catch { /* ignore */ }
    return hsUpdates().filter((u) => u.at > seen && u.email !== Store.myEmail).length;
  };
  const Updates = {
    live: true,
    all: false,
    render() {
      const ups = hsUpdates(Updates.all).slice(0, 300);
      const byDay = {};
      for (const u of ups) (byDay[new Date(u.at).toISOString().slice(0, 10)] ||= []).push(u);
      const day = (d) => (d === todayISO() ? 'Today' : d === todayISO(-1) ? 'Yesterday' : fmtDate(d));
      const hm = (at) => new Date(at).toTimeString().slice(0, 5);
      return `
        <div class="toolbar"><h2>${Updates.all ? 'Updates' : 'House surgeon updates'}</h2>
          <label class="small nowrap"><input type="checkbox" id="up-all" ${Updates.all ? 'checked' : ''}> everyone's</label></div>
        <p class="muted small">Live: each result, opinion's orders or finished work appears here the moment it's saved.</p>
        ${Object.entries(byDay).map(([d, list]) => `<div class="card"><h4>${esc(day(d))}</h4><ul class="updates">${list.map((u) => `
            <li><span class="up-time">${esc(hm(u.at))}</span>
              <span><a href="#/case/${esc(u.caseId)}"><b>${esc(u.name)}</b></a> — ${esc(u.text)}
              <span class="muted small">· ${esc(u.by)}</span></span></li>`).join('')}</ul></div>`).join('')
          || `<div class="card empty">No ${Updates.all ? '' : 'house surgeon '}updates yet.</div>`}`;
    },
    mount(el) {
      try { localStorage.setItem(upSeenKey(), String(Date.now())); } catch { /* ignore */ }
      const a = $('#up-all', el);
      if (a) a.onchange = () => { Updates.all = a.checked; render(); };
    },
  };

  // ---- APs and chiefs: case sheets in folders — the basics, imaging and opinions, nothing to edit.
  const FOLDERS = [
    ['preop', 'Pre-op', (c) => isActive(c)],
    ['postop', 'Post-op', (c) => c.status === 'postop'],
    ...Object.entries(TRANSFER_DEPTS).map(([k, D]) => [k, D.folder || D.short, (c) => c.status === k]),
  ];
  const Folders = {
    live: true,
    f: 'preop',
    render() {
      const all = allCases();
      const [, label, test] = FOLDERS.find((x) => x[0] === Folders.f) || FOLDERS[0];
      const list = all.filter(test).sort((a, b) => String(a.doa || '').localeCompare(String(b.doa || '')));
      return `
        <div class="toolbar"><h2>Case sheets</h2></div>
        <div class="folders">${FOLDERS.map(([k, l, t]) => { const n = all.filter(t).length; return `<button type="button" class="folder${Folders.f === k ? ' on' : ''}" data-folder="${k}"><span class="folder-ico" aria-hidden="true">📁</span><span>${esc(l)}</span><span class="pill">${n}</span></button>`; }).join('')}</div>
        <h3>${esc(label)} <span class="muted small">${list.length} case${list.length === 1 ? '' : 's'}</span></h3>
        <div class="fold-list">${list.map((c) => {
          const n = caseImages(c.id).length;
          const ops = listOf(c.opinions).length;
          return `<a class="card fold-case" href="#/c/${c.id}">
            <div><b>${esc(c.name)}</b> <span class="muted">${esc(ageSex(c))}</span>${c.ipNo ? ` <span class="muted small">IP ${esc(c.ipNo)}</span>` : ''}</div>
            <div class="small">${esc(c.diagnosis || '')}</div>
            <div class="muted small">${esc([c.procedureDone ? '✓ ' + c.procedureDone : c.plan ? '▸ ' + c.plan : '', c.doa && 'DOA ' + fmtDate(c.doa), (c.surgeryDate || c.otDate) && c.status === 'postop' && 'DOS ' + fmtDate(c.surgeryDate || c.otDate)].filter(Boolean).join(' · '))}</div>
            <div class="muted small">${n ? `🖼 ${n} image${n === 1 ? '' : 's'}` : 'No images'}${ops ? ` · ${ops} opinion${ops === 1 ? '' : 's'}` : ''}</div>
          </a>`;
        }).join('') || '<div class="card empty">No cases in this folder.</div>'}</div>`;
    },
    mount(el) {
      el.addEventListener('click', (e) => {
        const b = e.target.closest('[data-folder]');
        if (b) { Folders.f = b.dataset.folder; render(); }
      });
    },
  };
  function ConsultCase(id) {
    return {
      live: true,
      render() {
        const c = Store.cases[id];
        if (!c) return notFound();
        const folder = FOLDERS.find(([, , t]) => t({ id, ...c }))?.[1] || '';
        const rows = [
          ['Name', c.name], ['Age / Sex', ageSex(c)], ['IP no.', c.ipNo], ['Ward', c.ward], ['DOA', c.doa && fmtDate(c.doa)],
          ['Diagnosis', c.diagnosis], ['Comorbidities', c.comorbid], ['Plan', c.plan], ['Procedure done', c.procedureDone],
          ['Date of surgery', (c.surgeryDate || c.otDate) && c.status === 'postop' ? fmtDate(c.surgeryDate || c.otDate) : ''], ['Surgeon', c.surgeon],
        ].filter(([, v]) => hasText(v));
        const imgs = caseImages(id);
        const kinds = [...new Set(imgs.map((im) => im.kind))];
        const ops = listOf(c.opinions);
        return `
          <div class="toolbar"><a class="btn" href="#/">← Case sheets</a>${folder ? `<span class="tag">${esc(folder)}</span>` : ''}</div>
          <div class="card"><h2>${esc(c.name)} <span class="muted">${esc(ageSex(c))}</span></h2>
            <dl class="kv">${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl></div>
          <div class="card"><h3>Imaging <span class="pill">${imgs.length}</span></h3>
            ${kinds.map((k) => `<h4>${esc(imageKind(k).label)}</h4><div class="thumbs">${caseImages(id, k).map((im) => `<button type="button" class="thumb" data-open="${im.id}" data-kind="${esc(k)}"><img data-img="${im.id}" alt=""><span>${esc(im.caption || imageKind(k).label)}</span></button>`).join('')}</div>`).join('') || '<p class="muted">No images yet.</p>'}</div>
          <div class="card"><h3>Opinions <span class="pill">${ops.length}</span></h3>
            ${ops.map((o) => `<div class="op-row"><b>${esc(String(o.dept || '').toUpperCase())}</b>${o.at ? ` <span class="muted small">asked ${esc(fmtDate(new Date(o.at).toISOString().slice(0, 10)))}</span>` : ''}
              <div>${hasText(o.note) ? esc(o.note) : '<span class="muted">Awaited</span>'}</div></div>`).join('') || '<p class="muted">No opinions sought.</p>'}</div>`;
      },
      mount(el) {
        $$('img[data-img]', el).forEach((img) => { Store.getImage(img.dataset.img).then((src) => { if (src) img.src = src; }); });
        el.addEventListener('click', (e) => {
          const t = e.target.closest('[data-open]');
          if (t) openViewer(id, t.dataset.open, t.dataset.kind);
        });
      },
    };
  }


  // ---- Unit VI: the weekly scheme report, from every unit's OT lists (Mon–Sun by OT date).
  const SchemeTab = {
    live: false,
    week: '',
    reps: null,
    loadedWeek: '',
    async load() {
      const mon = SchemeTab.week;
      SchemeTab.loading = true;
      try { SchemeTab.reps = await Store.schemeReports(mon, addDays(mon, 6)); SchemeTab.err = ''; } catch (e) { SchemeTab.reps = []; SchemeTab.err = e.code || e.message; }
      SchemeTab.loading = false;
      SchemeTab.loadedWeek = mon + '|' + Store.unitKey;
      if (/^#\/scheme/.test(location.hash)) { current = null; render(); }
    },
    // The unit-wise table of the department's scheme report. Each case once (its latest OT list that
    // week); standby cases left out. `scheme` = on the OT day, `now` = today (sent back by the unit).
    summary() {
      const byUnit = {};
      for (const r of [...(SchemeTab.reps || [])].sort((a, b) => (a.date + a.at).localeCompare(b.date + b.at))) {
        const u = (byUnit[r.unit] ||= { lists: new Set(), cases: new Map() });
        u.lists.add(r.date);
        for (const c of r.cases || []) u.cases.set(c.id || c.ipNo || c.name, { ...c, date: r.date });
      }
      const keys = Store.mode === 'firebase' ? Store.unitKeys : ['local'];
      return keys.map((k) => {
        const u = byUnit[k] || { lists: new Set(), cases: new Map() };
        const all = [...u.cases.values()];
        const done = all.filter((c) => !c.standby);
        const nowOf = (c) => c.now || c.scheme || '';
        const noScheme = done.filter((c) => nowOf(c) === 'NO SCHEME');
        const r = {
          key: k, label: k === 'local' ? Store.meta.unitId : UNITS[Store.unitKeys.indexOf(k)]?.id || '?', lists: u.lists.size,
          total: done.length,
          approved: done.filter((c) => c.scheme === 'APPROVED').length,
          valDos: done.filter((c) => c.scheme === 'VALIDATION').length,
          valLater: done.filter((c) => c.scheme === 'VALIDATION' && nowOf(c) === 'APPROVED').length,
          denied: done.filter((c) => nowOf(c) === 'DENIED').length,
          noScheme,
          days: [...u.lists],
        };
        r.applied = r.total - noScheme.length;
        r.pending = done.filter((c) => !['APPROVED', 'VALIDATION', 'DENIED', 'NO SCHEME'].includes(c.scheme) && nowOf(c) !== 'DENIED' && nowOf(c) !== 'NO SCHEME');
        return r;
      });
    },
    // "09/11/26 TO 14/11/26": Monday to Saturday, or Sunday if a unit had a Sunday list
    title(rows) {
      const mon = SchemeTab.week;
      const sun = addDays(mon, 6);
      const end = rows.some((r) => r.days.includes(sun)) ? sun : addDays(mon, 5);
      const yy = (iso) => fmtDate(iso).replace(/\/(\d{2})(\d{2})$/, '/$2');
      return `OPERATED CASES SCHEME STATUS UNIT WISE – ${yy(mon)} TO ${yy(end)}`;
    },
    // the NO SCHEME cell: count when none, else the numbered patients as in the department's model
    noSchemeLines(r) {
      if (!r.noScheme.length) return ['0'];
      return r.noScheme.flatMap((c, i) => [...(i ? [''] : []), `${i + 1}. ${DeckEngine.up(c.name)} ${c.ageSex || ''}`.trim(), DeckEngine.up(c.diagnosis), DeckEngine.up(c.procedure), `REASON: ${DeckEngine.up(c.reason) || '—'}`].filter((x, j) => x !== undefined && (x !== '' || j === 0)));
    },
    HEAD: ['UNIT NO', 'TOTAL CASES OPERATED', 'SCHEME APPLIED FOR', 'APPROVED', 'VALIDATION ON DAY OF SURGERY', 'VALIDATION LATER APPROVED', 'DENIED', 'NO SCHEME'],
    tableRows(rows) {
      const tot = (k) => rows.reduce((n, r) => n + r[k], 0);
      return [
        ...rows.map((r) => [r.label, r.total, r.applied, r.approved, r.valDos, r.valLater, r.denied, SchemeTab.noSchemeLines(r)]),
        ['TOTAL', tot('total'), tot('applied'), tot('approved'), tot('valDos'), tot('valLater'), tot('denied'), [String(rows.reduce((n, r) => n + r.noScheme.length, 0))]],
      ];
    },
    render() {
      SchemeTab.week ||= addDays(mondayOf(todayISO()), -7);
      const mon = SchemeTab.week;
      const sun = addDays(mon, 6);
      if (SchemeTab.loadedWeek !== mon + '|' + Store.unitKey && !SchemeTab.loading) setTimeout(SchemeTab.load, 0);
      const rows = SchemeTab.reps ? SchemeTab.summary() : [];
      const body = SchemeTab.tableRows(rows);
      const notes = [
        ...rows.filter((r) => !r.lists).map((r) => `No OT list from Unit ${r.label} yet this week.`),
        ...rows.filter((r) => r.pending.length).map((r) => `Unit ${r.label}: ${r.pending.length} case(s) applied but not yet approved / validated (${r.pending.map((c) => c.name).join(', ')}).`),
        ...rows.flatMap((r) => r.noScheme.filter((c) => !c.reason).map((c) => `Unit ${r.label}: no reason given for ${c.name}.`)),
      ];
      return `
        <div class="toolbar"><h2>Scheme report <span class="muted small">all units</span></h2><button class="btn small" id="sch-refresh">⟳ Refresh</button></div>
        ${SchemeTab.err ? `<p class="notice small">Couldn't read the units' OT lists (${esc(SchemeTab.err)}) — no network, or the database rules haven't been published yet.</p>` : ''}
        <div class="card">
          <div class="week-pick"><button class="btn small" data-wk="-7" aria-label="Week before">‹</button>
            <b>${esc(fmtDate(mon))} – ${esc(fmtDate(sun))}</b>
            <button class="btn small" data-wk="7" aria-label="Week after" ${addDays(mon, 7) > todayISO() ? 'disabled' : ''}>›</button></div>
          ${SchemeTab.loading && !SchemeTab.reps ? '<p class="muted">Loading…</p>' : `
          <p class="sch-title">${esc(SchemeTab.title(rows))}</p>
          <div class="table-wrap"><table class="board sch-table">
            <thead><tr>${SchemeTab.HEAD.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead>
            <tbody>${body.map((cells, i) => `<tr class="${i === body.length - 1 ? 'sch-total' : rows[i].lists ? '' : 'muted'}">${cells.map((v, j) => (j === 7 ? `<td class="sch-ns">${v.map((l) => esc(l)).join('<br>')}</td>` : j === 0 ? `<th>${esc(v)}</th>` : `<td>${esc(v)}</td>`)).join('')}</tr>`).join('')}</tbody>
          </table></div>
          ${notes.length ? `<ul class="sch-notes small">${notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}
          <p class="muted small">From the OT lists each unit generated that week (by OT date). A case on two lists counts once; standby cases aren't counted. "Validation later approved" fills in when the unit marks the case Approved.</p>
          <div class="form-actions">
            <button class="btn primary" id="sch-docx" ${rows.some((r) => r.lists) ? '' : 'disabled'}>Download Word (.docx)</button>
            <button class="btn" id="sch-pdf" ${rows.some((r) => r.lists) ? '' : 'disabled'}>Download PDF</button>
          </div>`}
        </div>`;
    },
    fileName(ext) {
      const mon = SchemeTab.week;
      return `SCHEME REPORT ${fmtDate(mon).replace(/\//g, '-')} TO ${fmtDate(addDays(mon, 6)).replace(/\//g, '-')}.${ext}`;
    },
    pdf() {
      const rows = SchemeTab.summary();
      const { jsPDF } = window.jspdf;
      const d = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      d.setFont('helvetica', 'bold');
      d.setFontSize(12);
      d.text(SchemeTab.title(rows).replace('–', '-'), 148.5, 18, { align: 'center' });
      d.autoTable({
        startY: 25, margin: { left: 25.4, right: 25.4 }, theme: 'grid',
        styles: { fontSize: 10, halign: 'center', valign: 'middle', lineColor: 0, lineWidth: 0.2, textColor: 0, cellPadding: 1.8 },
        headStyles: { fillColor: [255, 255, 255], textColor: 0, fontStyle: 'bold' },
        columnStyles: { 7: { halign: 'left', cellWidth: 82 } },
        head: [SchemeTab.HEAD],
        body: SchemeTab.tableRows(rows).map((cells) => cells.map((v, j) => (j === 7 ? v.join('\n') : String(v)))),
        didParseCell: (h) => { if (h.section === 'body' && h.row.index === rows.length) h.cell.styles.fontStyle = 'bold'; },
      });
      SharePdf.share(new File([d.output('blob')], SchemeTab.fileName('pdf'), { type: 'application/pdf' }));
    },
    // A Word file in the department's layout: landscape A4, the title in the page header, one table.
    async docx() {
      const rows = SchemeTab.summary();
      const x = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const run = (t, bold) => `<w:r><w:rPr>${bold ? '<w:b/>' : ''}<w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr><w:t xml:space="preserve">${x(t)}</w:t></w:r>`;
      const para = (t, { bold, center } = {}) => `<w:p><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/>${center ? '<w:jc w:val="center"/>' : ''}</w:pPr>${run(t, bold)}</w:p>`;
      const W = [1000, 1600, 1500, 1300, 1800, 1800, 1100, 3858];
      const cell = (lines, w, opts) => `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/><w:vAlign w:val="center"/></w:tcPr>${(Array.isArray(lines) ? lines : [lines]).map((l) => para(l, opts)).join('')}</w:tc>`;
      const B = '<w:top w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:left w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:right w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:insideH w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:insideV w:val="single" w:sz="4" w:space="0" w:color="000000"/>';
      const body = SchemeTab.tableRows(rows);
      const table = `<w:tbl><w:tblPr><w:tblW w:w="${W.reduce((a, b) => a + b, 0)}" w:type="dxa"/><w:tblBorders>${B}</w:tblBorders><w:tblLayout w:type="fixed"/></w:tblPr>
        <w:tblGrid>${W.map((w) => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>
        <w:tr>${SchemeTab.HEAD.map((h, j) => cell(h, W[j], { center: true })).join('')}</w:tr>
        ${body.map((cells, i) => `<w:tr>${cells.map((v, j) => cell(j === 7 ? v : String(v), W[j], { center: j !== 7, bold: i === body.length - 1 })).join('')}</w:tr>`).join('')}</w:tbl>`;
      const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
      const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${NS}><w:body>${table}${para('')}
        <w:sectPr><w:headerReference w:type="default" r:id="rIdH"/><w:pgSz w:w="16838" w:h="11906" w:orient="landscape"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>`;
      const header = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr ${NS}>${para(SchemeTab.title(rows), { bold: true, center: true })}</w:hdr>`;
      const z = new window.JSZip();
      z.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/></Types>', { createFolders: false });
      z.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>', { createFolders: false });
      z.file('word/_rels/document.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdH" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/></Relationships>', { createFolders: false });
      z.file('word/document.xml', doc, { createFolders: false });
      z.file('word/header1.xml', header, { createFolders: false });
      const blob = await z.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
      offerFile(new File([blob], SchemeTab.fileName('docx'), { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }));
    },
    mount(el) {
      $('#sch-refresh', el)?.addEventListener('click', () => { SchemeTab.reps = null; SchemeTab.load(); render(); });
      el.addEventListener('click', (e) => {
        const w = e.target.closest('[data-wk]');
        if (w) { SchemeTab.week = addDays(SchemeTab.week, +w.dataset.wk); SchemeTab.reps = null; render(); }
      });
      const p = $('#sch-pdf', el);
      if (p) p.onclick = () => SchemeTab.pdf();
      const w = $('#sch-docx', el);
      if (w) w.onclick = () => SchemeTab.docx().catch((err) => toast('Could not make the Word file: ' + err.message, 5000));
    },
  };
  // Each unit keeps its OT lists' scheme status up to date for Unit VI: a case marked Approved after its
  // OT day ("validation later approved"), denied, etc. Its own last four weeks of lists, compared on sync.
  let schemeMine = null;
  let schemeTimer = 0;
  function syncSchemeNow() {
    clearTimeout(schemeTimer);
    schemeTimer = setTimeout(async () => {
      if (!Store.synced) return;
      try { schemeMine ||= await Store.mySchemeReports(todayISO(-28)); } catch { return; }
      for (const rep of schemeMine) {
        let changed = false;
        for (const c of rep.cases || []) {
          const cur = Store.cases[c.id];
          if (!cur) continue;
          const now = cur.scheme || '';
          const reason = ['NO SCHEME', 'DENIED'].includes(now) ? (cur.schemeReason || '') : (c.reason || '');
          if ((c.now ?? c.scheme) !== now || (c.reason || '') !== reason) { c.now = now; c.reason = reason; changed = true; }
        }
        if (changed) Store.saveSchemeReport(rep, true).catch(() => {});
      }
    }, 5000);
  }
  // When a unit makes its OT list, its scheme status goes to Unit VI's report.
  function sendScheme(cases, dd) {
    if (!dd?.date || !cases.length) return;
    Store.saveSchemeReport({
      date: dd.date,
      unitId: Store.meta.unitId,
      cases: cases.map((c) => ({
        id: c.id, name: c.name || '', ageSex: ageSex(c), ipNo: c.ipNo || '', diagnosis: c.diagnosis || '', procedure: c.plan || '',
        scheme: c.scheme || '', reason: ['NO SCHEME', 'DENIED'].includes(c.scheme) ? (c.schemeReason || '') : '', standby: !!c.standby,
      })),
    }).then(() => { schemeMine = null; toast('Scheme status sent to Unit VI', 2500); }).catch((e) => { console.warn('scheme report', e); });
  }

  // ---- Specialty tab: this unit's specialty, from all six units, and the weekly report (Mon–Sun).
  const unitLabel = (key) => (key ? 'UNIT ' + (UNITS[Store.unitKeys.indexOf(key)]?.id || '?') : 'UNIT ' + Store.meta.unitId);
  const mondayOf = (iso) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.toISOString().slice(0, 10); };
  const addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
  const operatedOn = (c) => c.surgeryDate || (['postop', 'discharged'].includes(c.status) || TRANSFER_DEPTS[c.status] ? c.otDate || '' : '');
  const statusWord = (c) => (c.status === 'postop' ? 'Post-op' : c.status === 'posted' ? 'Posted' : c.status === 'discharged' ? 'Discharged' : TRANSFER_DEPTS[c.status] ? TRANSFER_DEPTS[c.status].folder : 'Pre-op');
  const SpecTab = {
    live: false,
    data: null,
    loadedFor: '',
    week: '',
    spec: () => specOfUnit(Store.meta.unitId),
    async load() {
      const spec = SpecTab.spec();
      SpecTab.loading = true;
      let list;
      try { list = await Store.specCases(spec); } catch (e) { list = []; list.failed = ['all']; }
      // this unit's own cases straight from the phone (their tags may not be saved yet)
      const mine = Object.entries(Store.cases).filter(([, c]) => specsOf(c).includes(spec)).map(([id, c]) => ({ id, unit: Store.unitKey, ...c }));
      SpecTab.data = [...list.filter((c) => c.unit !== Store.unitKey && c.unit !== ''), ...mine];
      SpecTab.data.failed = list.failed;
      SpecTab.loading = false;
      SpecTab.loadedFor = spec + '|' + Store.unitKey;
      if (/^#\/spec/.test(location.hash)) { current = null; render(); }
    },
    render() {
      const spec = SpecTab.spec();
      const S = SPECIALTIES[spec];
      if (!S) return '<div class="card empty">This unit has no specialty tab.</div>';
      if (SpecTab.loadedFor !== spec + '|' + Store.unitKey && !SpecTab.loading) setTimeout(SpecTab.load, 0);
      const list = SpecTab.data || [];
      // the last full week by default (the report is sent on Monday for the week before)
      SpecTab.week ||= addDays(mondayOf(todayISO()), -7);
      const mon = SpecTab.week;
      const sun = addDays(mon, 6);
      const inWards = list.filter((c) => c.status !== 'discharged').sort((a, b) => String(a.doa || '').localeCompare(String(b.doa || '')));
      const done = list.filter((c) => { const d = operatedOn(c); return d && d >= mon && d <= sun; }).sort((a, b) => operatedOn(a).localeCompare(operatedOn(b)));
      const row = (c, week) => {
        const pre = (c.images ? Object.values(c.images) : []).filter((i) => i.kind === 'xray').length;
        const post = (c.images ? Object.values(c.images) : []).filter((i) => i.kind === 'poxray').length;
        return `<div class="spec-row">
          <span class="tag">${esc(unitLabel(c.unit))}</span>
          <div class="spec-main"><b>${esc(c.name)}</b> <span class="muted">${esc(ageSex(c))}</span>
            <div class="small">${esc(c.diagnosis || '')}</div>
            <div class="muted small">${esc([c.procedureDone ? '✓ ' + c.procedureDone : c.plan ? '▸ ' + c.plan : '', week ? 'DOS ' + fmtDate(operatedOn(c)) : statusWord(c), !week && c.doa ? 'DOA ' + fmtDate(c.doa) : ''].filter(Boolean).join(' · '))}</div>
            ${week ? `<div class="small ${pre && post ? 'muted' : 'warn-text'}">${pre ? `✓ pre-op X-ray (${pre})` : '✗ no pre-op X-ray'} · ${post ? `✓ post-op X-ray (${post})` : '✗ no post-op X-ray'}${hasText(c.implantsUsed || c.implants) ? '' : ' · no implants written'}</div>` : ''}
          </div>
          ${c.unit === Store.unitKey || !c.unit ? `<a class="btn small" href="#/case/${esc(c.id)}">Open</a>` : ''}
        </div>`;
      };
      const failed = list.failed?.length ? `<p class="notice small">Couldn't read ${list.failed.includes('all') ? 'the other units' : list.failed.map(unitLabel).join(', ')} — no network, or the database rules haven't been published yet.</p>` : '';
      return `
        <div class="toolbar"><h2>${esc(S.label)} cases <span class="muted small">all units</span></h2><button class="btn small" id="spec-refresh">⟳ Refresh</button></div>
        ${failed}
        ${SpecTab.loading && !SpecTab.data ? '<div class="card empty">Loading the cases from all units…</div>' : `
        <div class="card">
          <h3>Weekly report</h3>
          <div class="week-pick"><button class="btn small" data-wk="-7" aria-label="Week before">‹</button>
            <b>${esc(fmtDate(mon))} – ${esc(fmtDate(sun))}</b>
            <button class="btn small" data-wk="7" aria-label="Week after" ${addDays(mon, 7) > todayISO() ? 'disabled' : ''}>›</button></div>
          <p class="muted small">${done.length} ${S.label.toLowerCase()} case${done.length === 1 ? '' : 's'} operated in all units that week. One slide per case — name, age, sex, unit, diagnosis, procedure, implants — then the pre-op and post-op radiographs.</p>
          ${done.map((c) => row(c, true)).join('')}
          <div class="form-actions"><button class="btn primary" id="spec-ppt" ${done.length ? '' : 'disabled'}>Download PowerPoint</button></div>
        </div>
        <div class="card">
          <h3>In the wards now <span class="pill">${inWards.length}</span></h3>
          ${inWards.map((c) => row(c, false)).join('') || `<p class="muted">No ${S.label.toLowerCase()} cases in any unit right now.</p>`}
        </div>`}`;
    },
    mount(el) {
      $('#spec-refresh', el)?.addEventListener('click', () => { SpecTab.data = null; SpecTab.load(); render(); });
      el.addEventListener('click', (e) => {
        const w = e.target.closest('[data-wk]');
        if (w) { SpecTab.week = addDays(SpecTab.week, +w.dataset.wk); render(); }
      });
      const btn = $('#spec-ppt', el);
      if (btn) btn.onclick = async () => {
        const S = SPECIALTIES[SpecTab.spec()];
        const mon = SpecTab.week;
        const sun = addDays(mon, 6);
        const done = (SpecTab.data || []).filter((c) => { const d = operatedOn(c); return d && d >= mon && d <= sun; }).sort((a, b) => operatedOn(a).localeCompare(operatedOn(b)));
        const imgsOf = (c, kind) => Object.entries(c.images || {}).filter(([, i]) => i.kind === kind).sort((a, b) => (a[1].at || 0) - (b[1].at || 0)).map(([iid]) => iid);
        const st = {
          noCover: true,
          unit: Store.meta.unitId,
          date: sun,
          cons: {},
          cases: done.map((c) => ({
            id: `${c.unit}:${c.id}`,
            title: `${S.label.toUpperCase()} CASES ${fmtDate(mon)} – ${fmtDate(sun)}`,
            status: '',
            rows: [
              { k: 'NAME', v: DeckEngine.up(c.name), kb: true, vb: true },
              { k: 'AGE / SEX', v: DeckEngine.up(ageSex(c)), vb: true },
              { k: 'UNIT', v: unitLabel(c.unit) },
              { k: 'DIAGNOSIS', v: DeckEngine.up(c.diagnosis), vb: true, diag: true },
              { k: 'PROCEDURE DONE', v: DeckEngine.up(c.procedureDone || c.plan) },
              { k: 'IMPLANTS USED', v: DeckEngine.up(c.implantsUsed || c.implants || '—') },
              { k: 'DATE OF SURGERY', v: fmtDate(operatedOn(c)) },
            ],
            slides: [['xray', 'PRE-OP X-RAY'], ['poxray', 'POST-OP X-RAY']].map(([k, label]) => ({ id: `${c.unit}:${c.id}:${k}`, label, images: imgsOf(c, k) })).filter((x) => x.images.length),
          })),
        };
        btn.disabled = true;
        btn.textContent = 'Building…';
        try {
          const imgs = {};
          let missing = 0;
          for (const c of done) {
            for (const iid of [...imgsOf(c, 'xray'), ...imgsOf(c, 'poxray')]) {
              const data = await Store.getImage(iid, c.unit || undefined);
              if (!data) { missing++; continue; }
              const img = await new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = data; });
              if (img) imgs[iid] = { data, w: img.naturalWidth, h: img.naturalHeight, url: data };
            }
          }
          const pres = DeckEngine.buildPptx(window.PptxGenJS, st, imgs);
          const blob = await pres.write({ outputType: 'blob' });
          offerFile(new File([blob], `${S.label.toUpperCase()} CASES ${fmtDate(mon).replace(/\//g, '-')} TO ${fmtDate(sun).replace(/\//g, '-')}.pptx`, { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' }));
          if (missing) toast(`${missing} radiograph(s) couldn't be loaded (no network?) — the rest are in.`, 5000);
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

  // ---- Start page: the app opens here and asks which ward.
  const Home = {
    live: true,
    unitPicked: false, // owners: chosen on this opening of the app
    render() {
      if (Store.mode === 'firebase' && Store.isOwner() && !Home.unitPicked) {
        return `
        <div class="home">
          <h2>Which unit?</h2>
          <div class="home-units">${Store.unitKeys.map((k, i) => {
            const u = UNITS[i];
            const sp = SPECIALTIES[specOfUnit(u.id)]?.label || UNIT_NAMES[u.id] || '';
            return `<button type="button" class="home-unit" data-unit="${k}"><b>Unit ${esc(u.id)}</b>${sp ? `<span class="muted small">${esc(sp)}</span>` : ''}</button>`;
          }).join('')}</div>
        </div>`;
      }
      const cs = allCases();
      const pre = cs.filter((c) => isActive(c)).length;
      const posted = cs.filter((c) => c.status === 'posted').length;
      const post = cs.filter((c) => c.status === 'postop').length;
      const S = SPECIALTIES[specOfUnit(Store.meta.unitId)];
      const extra = S ? ['#/spec', `${S.label} cases`] : Store.meta.unitId === SCHEME_UNIT ? ['#/scheme', 'Scheme report'] : null;
      const who = String(Store.profile().name || Store.user?.displayName || '').trim();
      const h = new Date().getHours();
      return `
        <div class="home">
          <p class="home-hi">${h < 12 ? 'Good morning' : h < 16 ? 'Good afternoon' : 'Good evening'}${who ? `, ${esc(who.split(' ')[0])}` : ''}</p>
          <p class="home-unit-now">Ortho Unit ${esc(Store.meta.unitId)}${UNIT_NAMES[Store.meta.unitId] ? ` · ${esc(UNIT_NAMES[Store.meta.unitId])}` : ''}${Store.mode === 'firebase' && Store.isOwner() ? ' · <button type="button" class="link" data-unit-change>change unit</button>' : ''}</p>
          <h2>Which ward?</h2>
          <div class="home-wards">
            <a class="home-ward" href="#/ward"><span class="home-ico" aria-hidden="true">🛏</span><b>Pre-op ward</b><span class="muted">${pre} patient${pre === 1 ? '' : 's'}${posted ? ` · ${posted} posted` : ''}</span></a>
            <a class="home-ward" href="#/postward"><span class="home-ico" aria-hidden="true">🩹</span><b>Post-op ward</b><span class="muted">${post} patient${post === 1 ? '' : 's'}</span></a>
          </div>
          <div class="home-more">
            <a class="btn" href="#/">e-Case sheets</a>
            <a class="btn" href="#/ot">OT list</a>
            <a class="btn" href="#/deck">Admission day PPT</a>
            ${extra ? `<a class="btn" href="${extra[0]}">${esc(extra[1])}</a>` : ''}
          </div>
        </div>`;
    },
    mount(el) {
      el.addEventListener('click', (e) => {
        const u = e.target.closest('[data-unit]');
        if (u) {
          Home.unitPicked = true;
          if (u.dataset.unit !== Store.unitKey) Store.switchUnit(u.dataset.unit);
          current = null;
          render();
          return;
        }
        if (e.target.closest('[data-unit-change]')) { Home.unitPicked = false; render(); }
      });
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
    const view = viewRole();
    let m;
    // APs and chiefs: the folders and the case sheets in them (and Settings) — nothing else.
    if (view === 'consultant') {
      if ((m = h.match(/^#\/c\/(\w+)$/))) return ConsultCase(m[1]);
      if (/^#\/settings$/.test(h)) return Settings;
      return Folders;
    }
    // House surgeons: their to-do and the e-case sheets; not the wards' rounds, OT list or PPTs.
    if (view === 'hs' && (/^#?\/?$/.test(h) || /^#\/(home|ward|postward|ot(\/list)?|deck|postop|updates|import(\/.*)?|folders)$/.test(h))) return Todo;
    if (h === '#/home') return Home;
    if (h === '#/todo') return Todo;
    if (h === '#/updates') return Updates;
    if (h === '#/spec') return Store.meta.unitId === SCHEME_UNIT ? SchemeTab : SpecTab;
    if (h === '#/scheme') return Store.meta.unitId === SCHEME_UNIT ? SchemeTab : Home;
    if (h === '#/cases') return Dashboard;
    if (h === '#/folders') return Folders;
    if ((m = h.match(/^#\/c\/(\w+)$/))) return ConsultCase(m[1]);
    for (const [re, mk] of ROUTES) {
      const m = h.match(re);
      if (m) return mk(m[1]);
    }
    return Dashboard;
  }

  function section() {
    const h = location.hash || '#/';
    const view = viewRole();
    if (view === 'consultant') return /^#\/settings/.test(h) ? '#/settings' : '#/';
    if (view === 'hs' && /^#\/(case|cases|new|discharge)\b/.test(h)) return '#/cases';
    if (view === 'hs' && /^#?\/?$/.test(h)) return '#/todo';
    const m = h.match(/^#\/(ward|postward|ot|deck|postop|settings|todo|updates|cases|spec|scheme|home)\b/);
    return m ? '#/' + m[1] : '#/';
  }
  // The tabs this view has, which one is open, and the PGs' count of new HS updates.
  function paintNav() {
    const view = viewRole();
    const sec = section();
    $$('#nav a').forEach((a) => {
      a.hidden = !(a.dataset.v || 'full').split(' ').includes(view);
      a.classList.toggle('on', a.getAttribute('href') === sec);
    });
    const up = $('#nav a[href="#/updates"]');
    if (up) {
      const n = view === 'full' ? unseenUpdates() : 0;
      up.innerHTML = `HS updates${n ? ` <span class="pill new">${n}</span>` : ''}`;
    }
    const sp = $('#nav a[href="#/spec"]');
    if (sp) {
      const S = SPECIALTIES[specOfUnit(Store.meta.unitId)];
      if (S) sp.textContent = `${S.label} cases`;
      if (!S) sp.hidden = true;
    }
    const sch = $('#nav a[href="#/scheme"]');
    if (sch && Store.meta.unitId !== SCHEME_UNIT) sch.hidden = true;
    document.documentElement.dataset.view = view;
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
    // the page is chosen again when the address changes, or when the role becomes known / changes
    // (the team list can arrive a moment after the first draw)
    const role = viewRole();
    const same = current && current.hash === location.hash && current.role === role;
    if (!same) current = { hash: location.hash, view: resolve(), role };
    const v = current.view;
    const bs = $('.brand-sub');
    const choosingUnit = current.view === Home && Store.mode === 'firebase' && Store.isOwner() && !Home.unitPicked;
    if (bs) bs.textContent = Store.unitKnown && current.view !== Gate && !choosingUnit ? `· Ortho Unit ${Store.meta.unitId}` : '';
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
    paintNav();
    updateSync();
    if (Store.guest && !$('#guest-bar')) {
      $('header.top').insertAdjacentHTML('afterend', '<div id="guest-bar">Guest demo — sample patients only · <button type="button" class="link" data-guest-exit>Leave</button></div>');
    }
  }
  document.addEventListener('click', (e) => {
    if (!e.target.closest('[data-guest-exit]')) return;
    try { localStorage.removeItem('wm.guest'); } catch { /* ignore */ }
    location.hash = '#/home';
    location.reload();
  });

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

  // ---- Radiographs kept on this phone, so the OT list and rounds work in a room with no signal.
  // Every case still on the lists (not discharged) is saved in the background; the OT list's cases first.
  const offline = { running: false, again: false, saved: 0, total: 0, failed: 0, timer: 0 };
  const offlineIds = () => {
    const sel = new Set(otDraft().selected);
    const cs = allCases().filter((c) => c.status !== 'discharged' || sel.has(c.id))
      .sort((a, b) => (sel.has(b.id) ? 1 : 0) - (sel.has(a.id) ? 1 : 0));
    return cs.flatMap((c) => listOf(c.images).map((im) => im.id));
  };
  function offlineLine() {
    if (Store.mode !== 'firebase') return '';
    // On the OT list: that list's radiographs. On the picker: everything on the lists.
    const list = /^#\/ot\/list/.test(location.hash)
      ? otDraft().selected.flatMap((cid) => listOf(Store.cases[cid]?.images).map((im) => im.id))
      : offlineIds();
    if (!list.length) return '';
    const n = list.filter((id) => Store.isSaved(id)).length;
    if (n === list.length) return `<span class="ok">✓ All ${n} radiograph${n === 1 ? '' : 's'} saved on this phone — they open without network.</span>`;
    return `<span class="warn">⏳ ${n} of ${list.length} radiographs saved on this phone${offline.running ? ' — saving the rest…' : navigator.onLine ? '' : ' — the rest will save when you have signal'}.</span>`;
  }
  const paintOffline = () => { const p = $('#offline-line'); if (p) p.innerHTML = offlineLine(); };
  async function saveImagesOffline() {
    if (Store.mode !== 'firebase' || !Store.synced) return;
    if (offline.running) { offline.again = true; return; }
    offline.running = true;
    try {
      await Store.loadSaved();
      const ids = [...new Set(offlineIds())];
      paintOffline();
      const r = await Store.saveOffline(ids, paintOffline);
      Object.assign(offline, r);
      await Store.pruneOffline(ids);
    } catch (e) { console.error(e); }
    offline.running = false;
    paintOffline();
    if (offline.again) { offline.again = false; queueOffline(); }
  }
  function queueOffline(ms = 4000) {
    clearTimeout(offline.timer);
    offline.timer = setTimeout(saveImagesOffline, ms);
  }
  window.addEventListener('online', () => queueOffline(1000));

  let upToastAt = Date.now();
  let upPruned = false;
  function updatesChanged() {
    if (viewRole() !== 'full') return;
    paintNav();
    const fresh = hsUpdates().filter((u) => u.at > upToastAt && u.email !== Store.myEmail);
    if (fresh.length && !/^#\/updates/.test(location.hash)) {
      const u = fresh[0];
      toast(`HS update · ${u.name}: ${u.text}${fresh.length > 1 ? ` (+${fresh.length - 1} more)` : ''}`, 5000);
    }
    if (fresh.length) upToastAt = Math.max(...fresh.map((u) => u.at));
    // keep a week
    if (!upPruned && Store.synced) {
      upPruned = true;
      const old = Date.now() - 7 * 864e5;
      listOf(Store.updates).filter((u) => (u.at || 0) < old).forEach((u) => Store.remove('updates', u.id));
    }
  }

  let specTimer = 0;
  function tagSpecs() {
    clearTimeout(specTimer);
    specTimer = setTimeout(() => {
      if (!Store.synced) return;
      for (const [id, c] of Object.entries(Store.cases)) {
        const want = specsOf(c);
        if (JSON.stringify(want) !== JSON.stringify(c.specs || [])) Store.patch('cases', id, { specs: want });
        // viral markers positive → (HBsAg+/HCV+/PLHA) in the diagnosis (letter case aside: typing makes it capitals)
        const dx = diagnosisWithViral(c);
        if (dx.toUpperCase() !== String(c.diagnosis || '').trim().toUpperCase()) Store.patch('cases', id, { diagnosis: dx });
      }
    }, 2500);
  }

  function onStoreChange() {
    if (Store.synced) { queueOffline(); tagSpecs(); syncSchemeNow(); }
    updatesChanged();
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
    if (current.role !== viewRole() && !editing()) return render(); // role arrived / changed: that view's pages
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
    // Opening the app: the start page, which asks which ward.
    // (only when opened fresh — the home-screen icon opens the bare address; a reload keeps its page)
    if (!location.hash || location.hash === '#') location.replace('#/home');
    Store.subscribe(onStoreChange);
    window.addEventListener('hashchange', () => {
      current = null;
      render();
    });
    document.addEventListener('focusout', () => {
      setTimeout(() => { if (deferred && !editing()) render(); }, 0);
    });
    $('#dl-noscheme').innerHTML = NO_SCHEME_REASONS.map((r) => `<option value="${esc(r)}">`).join('');
    render();
    Store.init();
    if (Store.guest && !Object.keys(Store.cases).length) Demo.seed().then(() => render());
    // Ask the phone not to clear the saved radiographs when space runs low.
    try { navigator.storage?.persist?.(); } catch { /* not supported */ }
    Store.loadSaved?.().then(paintOffline);
  }

  return { start, el: null };
})();

App.start();
