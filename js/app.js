// UI: hash-routed views rendered from Store state.
const App = (() => {
  let current = null; // { hash, view, loading }
  let deferred = false;

  const opts = (list, sel) => list.map((v) => {
    const [val, label] = Array.isArray(v) ? v : [v, v];
    return `<option value="${esc(val)}"${val === sel ? ' selected' : ''}>${esc(label)}</option>`;
  }).join('');
  const datalist = (id, list) => `<datalist id="${id}">${list.map((v) => `<option value="${esc(v)}">`).join('')}</datalist>`;
  const caseList = () => Object.entries(Store.cases).map(([id, c]) => ({ id, ...c }));
  const statusBadge = (s) => `<span class="badge st-${esc(s || 'preop')}">${esc(CASE_STATUS[s] || 'Pre-op')}</span>`;
  const levelOpts = (sel) => opts([['', '—'], ...LEVELS.map((l) => [l, l])], sel || '');
  const schemeOpts = (sel) => opts([['', '—'], ...SCHEMES.map((s) => [s, s])], sel || '');
  const isActive = (c) => ['preop', 'posted', undefined, ''].includes(c.status);
  const byWard = (a, b) => String(a.ward || '').localeCompare(String(b.ward || ''), undefined, { numeric: true }) || (a.doa || '').localeCompare(b.doa || '');
  const flagged = (text, f) => (f ? `<b class="flag">${esc(text)}${FLAG_MARK[f]}</b>` : esc(text));
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
      <input data-cn placeholder="Investigation">
      <input data-cv placeholder="Value" inputmode="decimal">
      <input data-cr placeholder="Normal range, e.g. 0.6 – 1.2">
      <input data-cu placeholder="Units">
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
    root.addEventListener('change', (e) => {
      const l = e.target.closest('[data-param]');
      if (l && e.target.tagName === 'SELECT') l.classList.toggle('is-flag', !!flagOf(e.target.value, params[l.dataset.param]));
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

  // ---------------------------------------------------------------- Dashboard
  let dashFilter = sessionStorage.getItem('wm.filter') || 'active';
  let dashQuery = '';

  function filteredCases() {
    const q = dashQuery.toLowerCase();
    return caseList()
      .filter((c) => (dashFilter === 'active' ? isActive(c) : dashFilter === 'all' || (c.status || 'preop') === dashFilter))
      .filter((c) => !q || [c.name, c.ipNo, c.ward, c.diagnosis, c.plan].join(' ').toLowerCase().includes(q))
      .sort(byWard);
  }

  const Dashboard = {
    live: true,
    render() {
      const all = caseList();
      const cnt = (s) => all.filter((c) => (c.status || 'preop') === s).length;
      const ready = all.filter((c) => (c.status || 'preop') === 'preop' && readiness(c).ready).length;
      const filters = [['active', 'Active'], ['preop', 'Pre-op'], ['posted', 'Posted'], ['postop', 'Post-op'], ['discharged', 'Discharged'], ['all', 'All']];
      return `
        <div class="stats">
          <div><b>${cnt('preop')}</b><span>Pre-op</span></div>
          <div><b>${ready}</b><span>Work-up complete</span></div>
          <div><b>${cnt('posted')}</b><span>Posted</span></div>
          <div><b>${cnt('postop')}</b><span>Post-op</span></div>
        </div>
        <div class="toolbar">
          <input type="search" id="q" placeholder="Search name, IP, ward, diagnosis…" value="${esc(dashQuery)}">
          <a class="btn primary" href="#/new">+ New case</a>
        </div>
        <div class="chips">${filters.map(([k, l]) => `<button class="chip${dashFilter === k ? ' on' : ''}" data-filter="${k}">${l}</button>`).join('')}</div>
        <div class="cards">${cardsHTML(all.length)}</div>`;
    },
    mount(el) {
      $('#q', el).addEventListener('input', (e) => {
        dashQuery = e.target.value;
        $('.cards', el).innerHTML = cardsHTML(1);
      });
      el.addEventListener('click', (e) => {
        const f = e.target.closest('[data-filter]');
        if (!f) return;
        dashFilter = f.dataset.filter;
        sessionStorage.setItem('wm.filter', dashFilter);
        render();
      });
    },
  };

  function cardsHTML(total) {
    const list = filteredCases();
    if (!list.length) return `<div class="empty">${total ? 'No cases match.' : 'No cases yet. Tap “+ New case” to add your first patient.'}</div>`;
    return list.map((c) => {
      const r = readiness(c);
      const pend = pendingList(c);
      const flags = abnormalList(c);
      const d = daysSince(c.doa);
      return `
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
            ${flags.map(tagHTML).join('')}
            ${r.ready && !pend.length ? '<span class="tag ok">✓ Work-up complete</span>' : ''}
            ${pend.slice(0, 8).map(tagHTML).join('')}${pend.length > 8 ? `<span class="tag">+${pend.length - 8} more</span>` : ''}
          </div>
        </a>`;
    }).join('');
  }

  // ---------------------------------------------------------------- Ward board
  const activeCases = () => caseList().filter(isActive).sort(byWard);

  function groupCell(c, g) {
    const parts = g.params.map((p) => {
      const l = latest(c, p.k);
      return l ? `${p.label} ${flagged(l.value, flagOf(l.value, p))}` : `<span class="miss">${p.label} –</span>`;
    });
    return `<td>${parts.join('<br>')}</td>`;
  }

  const Ward = {
    live: true,
    detailed: sessionStorage.getItem('wm.wardDetailed') === '1',
    render() {
      const list = activeCases();
      const work = (c, k) => (hasText(c.work?.[k]) ? `<td>${esc(c.work[k])}</td>` : '<td class="miss">Pending</td>');
      const notebook = `
        <table class="board nb-screen">
          <thead><tr><th>S.No</th><th>Name</th><th>Diagnosis</th><th>To do's</th><th>Assessment / Scheme</th></tr></thead>
          <tbody>
            ${list.map((c, i) => `<tr data-go="${c.id}">
              <td>${c.status === 'posted' ? '<span class="tag task">BOT</span><br>' : ''}${i + 1}</td>
              <td><b>${esc(c.name)}</b><div class="muted small">${esc(ageSex(c))} · ${esc(c.ipNo)}${c.ward ? ' · ' + esc(c.ward) : ''}</div></td>
              <td>${esc(c.diagnosis)}${c.plan ? `<div class="muted small">▸ ${esc(c.plan)}</div>` : ''}</td>
              <td>${[...abnormalList(c), ...pendingList(c)].map(tagHTML).join('') || '<span class="muted">—</span>'}</td>
              <td>${esc(assessmentScheme(c))}</td>
            </tr>`).join('') || '<tr><td colspan="5" class="empty">No active pre-op cases.</td></tr>'}
          </tbody>
        </table>`;
      const groups = LAB_GROUPS;
      const detailed = `
        <table class="board">
          <thead><tr><th>Patient</th><th>Diagnosis / Plan</th>${groups.map((g) => `<th>${esc(g.k === 'inflam' ? 'ESR / qCRP' : g.label)}</th>`).join('')}${WORKUP.map((w) => `<th>${esc(w.label)}</th>`).join('')}<th>Opinions</th><th>Pending works</th></tr></thead>
          <tbody>
            ${list.map((c) => `<tr data-go="${c.id}">
              <td><b>${esc(c.name)}</b><div class="muted small">${esc(ageSex(c))} · ${esc(c.ipNo)}${c.ward ? ' · ' + esc(c.ward) : ''}</div></td>
              <td>${esc(c.diagnosis)}<div class="muted small">▸ ${esc(c.plan)}</div></td>
              ${groups.map((g) => groupCell(c, g)).join('')}
              ${WORKUP.map((w) => work(c, w.k)).join('')}
              <td>${listOf(c.opinions).map((o) => `<div class="${hasText(o.note) ? '' : 'miss'}">${esc(o.dept)}${hasText(o.note) ? ': ' + esc(o.note) : ''}</div>`).join('')}</td>
              <td>${listOf(c.tasks).filter((t) => !t.done).map((t) => `<div>• ${esc(t.text)}</div>`).join('')}</td>
            </tr>`).join('') || '<tr><td colspan="20" class="empty">No active pre-op cases.</td></tr>'}
          </tbody>
        </table>`;
      return `
        <div class="toolbar">
          <h2>Ward status <span class="muted small">${fmtDate(todayISO())}</span></h2>
          <button class="btn" id="print-ward">Print / PDF</button>
        </div>
        <div class="chips">
          <button class="chip ${Ward.detailed ? '' : 'on'}" data-layout="0">Notebook</button>
          <button class="chip ${Ward.detailed ? 'on' : ''}" data-layout="1">Detailed</button>
        </div>
        <div class="table-wrap">${Ward.detailed ? detailed : notebook}</div>
        <p class="muted small">Tap a row to open the case. BOT = posted for OT. Red bold = outside the normal range. Any empty investigation except ESR, qCRP and pus C/S counts as pending.</p>`;
    },
    mount(el) {
      $('#print-ward', el).onclick = () => Print.wardBoard(activeCases(), Store.meta);
      el.addEventListener('click', (e) => {
        const l = e.target.closest('[data-layout]');
        if (l) {
          Ward.detailed = l.dataset.layout === '1';
          sessionStorage.setItem('wm.wardDetailed', l.dataset.layout);
          return render();
        }
        const tr = e.target.closest('[data-go]');
        if (tr) location.hash = '#/case/' + tr.dataset.go;
      });
    },
  };

  // ---------------------------------------------------------------- Case form
  function CaseForm(id) {
    return {
      live: false,
      render() {
        const c = id ? Store.cases[id] : { doa: todayISO() };
        if (!c) return notFound();
        return `
          <h2>${id ? 'Edit case' : 'New case'}</h2>
          <nav class="chips jump" aria-label="Sections">
            <a class="chip" href="#sec-patient" data-jump>Patient</a>
            <a class="chip" href="#sec-plan" data-jump>Diagnosis & plan</a>
            <a class="chip on" href="#sec-inv" data-jump>Investigations</a>
            ${id ? '' : '<a class="chip" href="#sec-work" data-jump>Work-up</a>'}
          </nav>
          <form id="case-form" class="form" autocomplete="off">
            <fieldset class="card" id="sec-patient"><legend>Patient</legend>
              <label class="span2">Name<input name="name" required value="${esc(c.name)}"></label>
              <label>Age<input name="age" inputmode="numeric" value="${esc(c.age)}"></label>
              <label>Sex<select name="sex">${opts([['', '—'], ['M', 'Male'], ['F', 'Female'], ['O', 'Other']], c.sex || '')}</select></label>
              <label>IP number<input name="ipNo" value="${esc(c.ipNo)}"></label>
              <label>Ward<input name="ward" value="${esc(c.ward)}" placeholder="e.g. 90A"></label>
              <label>Date of admission<input type="date" name="doa" value="${esc(c.doa)}"></label>
              <label>Attender<input name="attender" value="${esc(c.attender)}" placeholder="e.g. S/O BOMMU"></label>
              <label>Phone<input name="phone" type="tel" value="${esc(c.phone)}"></label>
              <label>Address<input name="address" value="${esc(c.address)}"></label>
            </fieldset>
 <fieldset class="card" id="sec-plan"><legend>Diagnosis & plan</legend>
              <label class="span2">Diagnosis<textarea name="diagnosis" rows="2">${esc(c.diagnosis)}</textarea></label>
              <label class="span2">Plan (proposed surgery)<textarea name="plan" rows="2" placeholder="e.g. CR/ORIF WITH SHORT PFN LEFT">${esc(c.plan)}</textarea></label>
              <label>Level<select name="level">${levelOpts(c.level)}</select><span class="hint" id="level-hint"></span></label>
              <label>Scheme status<select name="scheme">${schemeOpts(c.scheme)}</select></label>
              <label class="span2">Comorbidities<input name="comorbid" value="${esc(c.comorbid)}" placeholder="DM, SHTN…"></label>
              <label class="span2">Implants
                <textarea name="implants" rows="2" placeholder="Filled from the implant database when the plan matches">${esc(c.implants)}</textarea>
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
              <label>Pus C/S — organism<input name="pusOrganism" class="italic" placeholder="if sent"></label>
              <label>Sensitive to<input name="pusSensitive" placeholder="antibiotics"></label>
            </fieldset>
            <fieldset class="card" id="sec-work"><legend>Work-up</legend>
              ${WORKUP.map((w) => `<label>${esc(w.long || w.label)}<input name="w_${w.k}" placeholder="Result / remarks"></label>`).join('')}
            </fieldset>`}
            <div class="form-actions">
              <button class="btn primary" type="submit">${id ? 'Save' : 'Add case'}</button>
              <a class="btn" href="${id ? '#/case/' + id : '#/'}">Cancel</a>
              ${id ? '<button class="btn danger right" type="button" id="del">Delete case</button>' : ''}
            </div>
          </form>`;
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
          const m = matchImplants(plan, Store.implants);
          const lv = levelFor(plan, Store.levels);
          $('#impl-hint', el).textContent = m.length ? 'Implants from: ' + m.map((r) => r.name).join(', ') : (Object.keys(Store.implants).length ? 'No implant database match for this plan.' : 'Add procedures under Settings → Implant database to auto-fill implants.');
          $('#level-hint', el).textContent = lv.rule ? `Level ${lv.level}: ${lv.rule.name}` : (plan.trim() ? 'No level match — pick it manually.' : '');
        };
        const fill = (force) => {
          const plan = f.elements.plan.value;
          const sug = { implants: suggestFromPlan(plan, Store.implants).implants, level: levelFor(plan, Store.levels).level };
          auto.forEach((k) => { if (force || !touched[k]) f.elements[k].value = sug[k]; });
        };
        f.elements.plan.addEventListener('input', () => {
          hint();
          fill(false);
        });
        $('#impl-fill', el).onclick = () => fill(true);
        hint();

        const BASIC = ['name', 'age', 'sex', 'ipNo', 'ward', 'doa', 'attender', 'phone', 'address', 'diagnosis', 'plan', 'level', 'scheme', 'comorbid', 'implants'];
        f.onsubmit = (e) => {
          e.preventDefault();
          const data = Object.fromEntries(BASIC.map((k) => [k, f.elements[k].value.trim()]));
          if (id) {
            const before = Store.cases[id];
            const changed = BASIC.filter((k) => (before[k] || '') !== data[k]);
            if (changed.length) Store.patch('cases', id, Object.fromEntries(changed.map((k) => [k, data[k]])));
            location.hash = '#/case/' + id;
            return;
          }
          const nid = uid();
          const work = Object.fromEntries(WORKUP.map((w) => [w.k, f.elements['w_' + w.k].value.trim()]).filter(([, v]) => v));
          const doc = { ...data, status: 'preop', work, pus: { organism: f.elements.pusOrganism.value.trim(), sensitive: f.elements.pusSensitive.value.trim() } };
          for (const [path, val] of Object.entries(readLabForm(f) || {})) setPath(doc, path, val);
          Store.create('cases', nid, doc);
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
  function flowsheetHTML(c) {
    const sets = labSets(c);
    if (!sets.length) return '<div class="muted">No investigations entered yet.</div>';
    const row = (p, optional) => {
      const missing = !optional && !latest(c, p.k);
      return `<tr class="${missing ? 'missing' : ''}">
        <td class="pn">${esc(p.label)}${missing ? ' <span class="tag inv">pending</span>' : ''}<span class="rng">${esc(p.range)}${p.unit ? ' ' + esc(p.unit) : ''}</span></td>
        ${sets.map((s) => {
          const v = s.v?.[p.k];
          const f = flagOf(v, p);
          return `<td class="v${f ? ' flag' : ''}">${hasText(v) ? esc(v) + FLAG_MARK[f] : ''}</td>`;
        }).join('')}
      </tr>`;
    };
    const cols = sets.length + 1;
    const customs = customParams(c);
    return `
      <div class="table-wrap">
        <table class="flow">
          <thead><tr><th>Investigation <span class="rng">normal range</span></th>${sets.map((s) => `<th class="d">${esc(fmtDate(s.date)) || '—'}
            <span class="set-acts"><button class="icon" data-edit-set="${s.id}" title="Edit">✎</button><button class="icon" data-del-set="${s.id}" title="Delete">✕</button></span></th>`).join('')}</tr></thead>
          <tbody>
            ${LAB_GROUPS.map((g) => `<tr class="grp"><th colspan="${cols}">${esc(g.long || g.label)}${g.optional ? ' <span class="muted">(if needed)</span>' : ''}</th></tr>${g.params.map((p) => row(p, g.optional)).join('')}`).join('')}
            ${customs.length ? `<tr class="grp"><th colspan="${cols}">Other</th></tr>${customs.map((p) => row(p)).join('')}` : ''}
          </tbody>
        </table>
      </div>`;
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
        const imgCount = (k) => images.filter((i) => i.kind === k).length;
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
              <dt>Scheme</dt><dd>${esc(c.scheme) || '—'}</dd>
            </dl>
            <div class="actions">
              <a class="btn" href="#/case/${id}/edit">Edit details</a>
              <a class="btn" href="#/discharge/${id}">Discharge / transfer</a>
            </div>
          </div>

          <section class="card">
            <div class="row-between"><h3>Investigations <span class="pill ${r.ready ? 'ok' : ''}">${r.done}/${r.total}</span></h3>
              <button class="btn small primary" id="add-set">+ ${labSets(c).length ? 'Repeat investigations' : 'Enter investigations'}</button></div>
            ${flowsheetHTML(c)}
            <div class="pus">
              <label>Pus C/S — organism<input class="italic" data-bind="pus.organism" value="${esc(c.pus?.organism)}" placeholder="if sent"></label>
              <label>Sensitive to<input data-bind="pus.sensitive" value="${esc(c.pus?.sensitive)}" placeholder="antibiotics"></label>
            </div>
          </section>

          <section class="card">
            <h3>Work-up</h3>
            <div class="work">
              ${WORKUP.map((w) => `
                <div class="work-row ${hasText(c.work?.[w.k]) ? '' : 'missing'}">
                  <label>${esc(w.long || w.label)}<input data-bind="work.${w.k}" value="${esc(c.work?.[w.k])}" placeholder="Pending — type result"></label>
                  ${w.img ? `<div class="work-img">
                    <button class="btn small" data-gallery="${w.k}" ${imgCount(w.k) ? '' : 'disabled'}>View${imgCount(w.k) ? ` (${imgCount(w.k)})` : ''}</button>
                    <label class="btn small">+ Image<input type="file" accept="image/*" multiple data-upload="${w.k}" hidden></label>
                  </div>` : ''}
                </div>`).join('')}
            </div>
          </section>

          <section class="card">
            <h3>Opinions</h3>
            <div class="work">
              ${opinions.map((o) => `
                <div class="work-row ${hasText(o.note) ? '' : 'missing'}">
                  <label>${esc(o.dept)}<input data-bind="opinions.${o.id}.note" value="${esc(o.note)}" placeholder="Pending — type advice"></label>
                  <button class="icon" data-del-op="${o.id}" title="Remove">✕</button>
                </div>`).join('') || '<div class="muted small">No opinions sought.</div>'}
            </div>
            <form class="inline-add" id="add-op">
              <input name="dept" list="dl-depts" placeholder="Add opinion — department" required>
              <button class="btn small">Add</button>
            </form>
          </section>

          <section class="card">
            <h3>Pending works <span class="pill">${tasks.filter((t) => !t.done).length} open</span></h3>
            <ul class="tasks">
              ${tasks.map((t) => `
                <li class="${t.done ? 'done' : ''}">
                  <label><input type="checkbox" data-task="${t.id}" ${t.done ? 'checked' : ''}> <span>${esc(t.text)}</span></label>
                  ${t.to ? `<span class="tag">${esc(t.to)}</span>` : ''}
                  <div class="muted small">Added by ${esc(t.by)} · ${fmtTime(t.at)}${t.done ? ` — done by ${esc(t.doneBy)} · ${fmtTime(t.doneAt)}` : ''}</div>
                  <button class="icon" data-del-task="${t.id}" title="Delete">✕</button>
                </li>`).join('') || '<li class="muted small">Nothing pending. Add works for your HS / co-PGs below.</li>'}
            </ul>
            <form class="inline-add" id="add-task">
              <input name="text" placeholder="e.g. Send blood for cross-match" required>
              <select name="to"><option value="">Anyone</option>${opts(ROLES)}</select>
              <button class="btn small primary">Add</button>
            </form>
          </section>

          ${images.length ? `<section class="card">
            <h3>Imaging</h3>
            <div class="gallery">
              ${images.map((im) => `<button class="thumb" data-open="${im.id}"><img data-img="${im.id}" alt=""><span>${esc(im.kind.toUpperCase())}${im.caption ? ' · ' + esc(im.caption) : ''}</span></button>`).join('')}
            </div>
          </section>` : ''}
          ${datalist('dl-depts', OPINION_DEPTS)}`;
      },
      mount(el) {
        if (!Store.cases[id]) return;
        $$('img[data-img]', el).forEach((img) => {
          Store.getImage(img.dataset.img).then((src) => { if (src) img.src = src; });
        });
        $('#case-status', el).onchange = (e) => Store.patch('cases', id, { status: e.target.value });
        $('#add-set', el).onclick = () => openLabModal(id);

        el.addEventListener('change', async (e) => {
          const t = e.target;
          if (t.dataset.bind) {
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
          } else if (b.dataset.editSet) {
            openLabModal(id, b.dataset.editSet);
          } else if (b.dataset.delSet) {
            const s = Store.cases[id].labs[b.dataset.delSet];
            if (confirm(`Delete the investigations dated ${fmtDate(s.date) || '(no date)'}?`)) Store.patch('cases', id, { ['labs.' + b.dataset.delSet]: DELETE });
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
  const IMG_ORDER = ['xray', 'ct', 'mri'];
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
            <span><b>${esc(c?.name || '')}</b> · ${esc(im.kind === 'xray' ? 'X-RAY' : im.kind.toUpperCase())} · ${idx + 1} of ${all.length}${im.caption ? ' · ' + esc(im.caption) : ''}</span>
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
          <div class="viewer-strip">${all.map((x, i) => `<button class="v-dot${i === idx ? ' on' : ''}" data-go-img="${x.id}">${esc(x.kind === 'xray' ? 'X-ray' : x.kind.toUpperCase())} ${all.filter((y, j) => y.kind === x.kind && j <= i).length}</button>`).join('')}</div>
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
    live: false,
    showAll: false,
    render() {
      const d = otDraft();
      d.selected = d.selected.filter((id) => Store.cases[id]);
      const pool = caseList().filter((c) => OT.showAll || d.selected.includes(c.id) || isActive(c)).sort(byWard);
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
          <div class="table-wrap">
            <table class="board picker">
              <thead><tr><th></th><th>Name</th><th>Age/Sex</th><th>Diagnosis</th><th>Plan</th><th>DOA</th><th>Radiographs</th></tr></thead>
              <tbody>
                ${pool.map((c) => {
                  const n = listOf(c.images).length;
                  return `<tr class="${d.selected.includes(c.id) ? 'picked' : ''}" data-row="${c.id}">
                  <td><input type="checkbox" data-pick="${c.id}" ${d.selected.includes(c.id) ? 'checked' : ''} aria-label="Select ${esc(c.name)}"></td>
                  <td><b>${esc(c.name)}</b></td><td class="nowrap">${esc(ageSex(c))}</td>
                  <td>${esc(c.diagnosis)}</td><td>${esc(c.plan)}</td>
                  <td class="nowrap">${esc(fmtDate(c.doa))}</td>
                  <td class="nowrap">${n ? `<a href="#" class="img-link" data-imaging="${c.id}">View ${n} ›</a>` : '<span class="muted">None</span>'}</td>
                </tr>`;
                }).join('') || '<tr><td colspan="7" class="empty">No pre-op cases.</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>
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
                  <b>${i + 1}. ${esc(c.name)}</b> <span class="muted">${esc(ageSex(c))} · IP ${esc(c.ipNo)} · DOA ${esc(fmtDate(c.doa))}</span>
                  <span class="right">
                    <button class="icon" data-move="-1" ${i ? '' : 'disabled'} title="Move up">↑</button>
                    <button class="icon" data-move="1" ${i < sel.length - 1 ? '' : 'disabled'} title="Move down">↓</button>
                    <button class="icon" data-unpick title="Remove">✕</button>
                  </span>
                </div>
                <div class="ot-fields">
                  <label>Ward<input data-f="ward" value="${esc(c.ward)}"></label>
                  <label>Level<select data-f="level">${levelOpts(c.level)}</select></label>
                  <label>Scheme status<select data-f="scheme">${schemeOpts(c.scheme)}</select></label>
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
        if (t.dataset.pick) {
          upd((x) => {
            x.selected = x.selected.filter((i) => i !== t.dataset.pick);
            if (t.checked) x.selected.push(t.dataset.pick);
          });
        } else if (t.dataset.f) {
          Store.patch('cases', t.closest('[data-case]').dataset.case, { [t.dataset.f]: t.value.trim() });
        }
      });

      el.addEventListener('click', (e) => {
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
        if (pr && e.target.tagName !== 'INPUT') {
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
        } else if (b.dataset.unpick !== undefined) {
          upd((x) => { x.selected = x.selected.filter((i) => i !== cid); });
        } else if (b.dataset.refill !== undefined) {
          const sug = suggestFromPlan($('[data-f="plan"]', row).value, Store.implants);
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
        return [dd.selected.map((id) => ({ id, ...Store.cases[id] })), dd];
      };
      if (!$('#ot-go', el)) return;
      const generate = (twice) => {
        const [cases, dd] = build();
        if ($('#ot-mark', el).checked) {
          cases.filter((c) => c.status !== 'posted').forEach((c) => Store.patch('cases', c.id, { status: 'posted', otDate: dd.date }));
        }
        Print.otList(cases, dd, twice);
      };
      $('#ot-go', el).onclick = () => generate(false);
      $('#ot-go2', el).onclick = () => generate(true);
    },
  };

  // ---------------------------------------------------------------- Discharge
  function investigationsText(c) {
    const lines = [];
    for (const g of LAB_GROUPS) {
      const vals = g.params.map((p) => {
        const l = latest(c, p.k);
        // Shorthand like PLT 2.4 (lakhs) or WBC 8.4 (thousands) reads wrong with the full unit.
        const shorthand = p.scale && parseFloat(String(l?.value).replace(/,/g, '')) < 100;
        return l ? `${p.label} ${l.value}${p.unit && !p.options && !shorthand ? ' ' + p.unit : ''}` : '';
      }).filter(Boolean);
      if (vals.length) lines.push(`${g.k === 'inflam' ? '' : g.label + ': '}${vals.join(', ')}`);
    }
    const cust = customParams(c).map((p) => {
      const l = latest(c, p.k);
      return l ? `${p.label} ${l.value}${p.unit ? ' ' + p.unit : ''}` : '';
    }).filter(Boolean);
    if (cust.length) lines.push(cust.join(', '));
    if (hasText(c.pus?.organism)) lines.push(`PUS C/S: ${c.pus.organism}${hasText(c.pus.sensitive) ? ' — SENSITIVE TO ' + c.pus.sensitive : ''}`);
    for (const w of WORKUP) if (hasText(c.work?.[w.k])) lines.push(`${w.label}: ${c.work[w.k]}`);
    return lines.join('\n');
  }

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
      ['opNotes', 'Operative notes (optional)', 4],
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
          dos: c.otDate || '',
          consultant: unit,
          unitLine: unit,
          doctor: 'ORTHO ' + unit,
          attender: c.attender,
          phone: c.phone,
          address: c.address,
          diagnosis: c.diagnosis,
          procedure: c.plan,
          past: pastTemplate(c),
          exam: EXAM_TEMPLATE,
          condition: 'PATIENT VITALS STABLE',
          ...(c.discharge || {}),
        };
        if (d.disposition === 'lama') d.disposition = 'ama';
        if (!d.course) d.course = courseTemplate(c, d);
        const field = ([k, l, rows, btn]) => `<label class="span2">${l}${btn ? ` <button type="button" class="link small" data-tpl="${btn[0]}">${btn[1]}</button>` : ''}<textarea name="${k}" rows="${rows}">${esc(d[k])}</textarea></label>`;
        return `
          <h2>Discharge / transfer — ${esc(c.name)} <span class="muted small">${esc(ageSex(c))} · IP ${esc(c.ipNo)}</span></h2>
          <form id="dc-form" class="card form" autocomplete="off">
            <fieldset><legend>Disposition</legend>
              <div class="span2 radios">${Object.entries(DISPOSITIONS).map(([k, v]) => `<label class="chip ${d.disposition === k ? 'on' : ''}"><input type="radio" name="disposition" value="${k}" ${d.disposition === k ? 'checked' : ''} hidden>${v.label}</label>`).join('')}</div>
            </fieldset>
            <fieldset><legend>Patient box</legend>
              <label>AR number<input name="arNo" value="${esc(d.arNo)}"></label>
              <label>Consultant<input name="consultant" value="${esc(d.consultant)}"></label>
              <label>Date of surgery<input type="date" name="dos" value="${esc(d.dos)}"></label>
              <label>Date of discharge / transfer<input type="date" name="dod" value="${esc(d.dod)}"></label>
              <label>Time<input name="dodTime" value="${esc(d.dodTime)}" placeholder="e.g. 2 PM"></label>
              <label>Attender<input name="attender" value="${esc(d.attender)}" placeholder="S/O …"></label>
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
          </form>`;
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
        f.addEventListener('change', (e) => {
          if (e.target.name !== 'disposition') return;
          $$('.radios .chip', f).forEach((l) => l.classList.toggle('on', l.querySelector('input').checked));
          // Keep the closing line of the course in step with the disposition.
          const course = f.elements.course;
          const hit = Object.values(DISPOSITIONS).map((x) => x.course).find((x) => course.value.trim().endsWith(x));
          if (hit) course.value = course.value.trim().slice(0, -hit.length) + DISPOSITIONS[e.target.value].course;
        });
        f.addEventListener('click', (e) => {
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
            if (c().status !== st) Store.patch('cases', id, { status: st });
          }
          Print.discharge(c(), d, Store.meta);
        };
      },
    };
  }

  // ---------------------------------------------------------------- Settings
  function implantSection() {
    const rules = Object.entries(Store.implants).map(([id, r]) => ({ ...r, id })).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    return `
      <div class="card" id="implants">
        <h3>Implant database</h3>
        <p class="muted small">When a case's plan contains a procedure name below, its implants fill in automatically. Matching is by whole word and ignores case, so “SHORT PFN” matches “CR/ORIF WITH SHORT PFN LEFT”.</p>
        <div class="table-wrap">
          <table class="board impl-table">
            <thead><tr><th>Procedure</th><th>Implants</th><th></th></tr></thead>
            <tbody>
              ${rules.map((r) => `<tr data-rule="${r.id}">
                <td><input data-k="name" value="${esc(r.name)}" aria-label="Procedure"></td>
                <td><textarea data-k="implants" rows="2" aria-label="Implants">${esc(r.implants)}</textarea></td>
                <td><button class="icon" data-del-rule title="Delete">✕</button></td>
              </tr>`).join('') || '<tr><td colspan="3" class="empty">No procedures yet. Add the first one below.</td></tr>'}
            </tbody>
            <tfoot>
              <tr id="impl-add">
                <td><input name="name" placeholder="e.g. SHORT PFN" aria-label="New procedure"></td>
                <td><textarea name="implants" rows="2" placeholder="e.g. 9,10,11*250MM SHORT PFN, 6.2MM DEROTATION SCREW…" aria-label="New implants"></textarea></td>
                <td><button class="btn small primary" id="impl-add-btn">Add</button></td>
              </tr>
            </tfoot>
          </table>
        </div>
        <label class="block test">Test a plan<input id="impl-test" placeholder="e.g. CR/ORIF WITH SHORT PFN LEFT"></label>
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
                <td><input name="category" placeholder="e.g. Trauma" aria-label="New category"></td>
                <td><input name="name" placeholder="Procedure" aria-label="New procedure"></td>
                <td><input name="keywords" placeholder="e.g. tens, elastic nail" aria-label="New match words"></td>
                <td><button class="btn small primary" id="level-add-btn">Add</button></td>
              </tr>
            </tfoot>
          </table>
        </div>
        <label class="block test">Test a plan<input id="level-test" placeholder="e.g. CR/ORIF WITH SHORT PFN LEFT"></label>
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
            <label>Your name<input name="name" value="${esc(p.name)}" placeholder="Dr. …"></label>
            <label>Role<select name="role"><option value="">—</option>${opts(ROLES, p.role)}</select></label>
          </fieldset>
        </form>

        <form class="card form" id="meta">
          <fieldset><legend>Unit & letterhead (shared)</legend>
            <label>Unit<select name="unitId">${opts(UNITS.map((u) => [u.id, 'UNIT ' + u.id]), m.unitId)}</select></label>
            <label>Ortho OPD no.<input name="opd" value="${esc(m.opd)}"></label>
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
            ? '<p>Running in <b>local mode</b>: data lives only in this browser. To share with your HS and senior PGs, connect Firebase — see <b>README.md</b>.</p>'
            : `<p>Signed in as <b>${esc(Store.user?.email)}</b> · sync: ${esc(Store.status)} <button class="btn small" id="signout">Sign out</button></p>
               <h4>Team</h4>
               <ul class="members">${members.map((x) => `<li><b>${esc(x.name || x.email)}</b> <span class="muted">${esc(x.role)} · ${esc(x.email)}</span>${Store.isOwner() ? ` <button class="icon" data-rm="${esc(x.email)}">✕</button>` : ''}</li>`).join('') || '<li class="muted">Only owners so far.</li>'}</ul>
               ${Store.isOwner() ? `<form class="inline-add" id="add-member">
                 <input name="email" type="email" placeholder="Gmail of HS / PG" required>
                 <input name="name" placeholder="Name">
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
        const s = suggestFromPlan(test.value, Store.implants);
        $('#impl-out', el).innerHTML = s.matches.length
          ? s.matches.map((r) => `<div><b>${esc(r.name)}</b>: ${esc(r.implants)}</div>`).join('')
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
    return Store.status === 'connecting' ? '<div class="empty">Loading…</div>' : '<div class="empty">Case not found. <a href="#/">Back to cases</a></div>';
  }

  const Gate = {
    live: true,
    render() {
      const s = Store.status;
      if (s === 'denied') {
        return `<div class="card gate"><h2>No access yet</h2><p>You're signed in as <b>${esc(Store.user?.email)}</b>, but this email isn't on the team list. Ask the unit owner to add you under Settings → Team.</p><button class="btn" id="signout">Sign out</button></div>`;
      }
      if (s.startsWith('error')) return `<div class="card gate"><h2>Connection problem</h2><p>${esc(s)}</p><button class="btn" onclick="location.reload()">Retry</button></div>`;
      if (s === 'signed-out') {
        return '<div class="card gate"><h2>Pre-op Ward</h2><p>Sign in with the Google account your unit added to the team.</p><button class="btn primary" id="signin">Sign in with Google</button></div>';
      }
      return '<div class="empty">Connecting…</div>';
    },
    mount(el) {
      const si = $('#signin', el);
      if (si) si.onclick = () => Store.signIn().catch((e) => toast('Sign-in failed: ' + (e.code || e.message)));
      const so = $('#signout', el);
      if (so) so.onclick = () => Store.signOut();
    },
  };

  const ROUTES = [
    [/^#?\/?$/, () => Dashboard],
    [/^#\/ward$/, () => Ward],
    [/^#\/new$/, () => CaseForm()],
    [/^#\/case\/(\w+)$/, (id) => CaseDetail(id)],
    [/^#\/case\/(\w+)\/edit$/, (id) => CaseForm(id)],
    [/^#\/ot(\/list)?$/, () => OT],
    [/^#\/discharge\/(\w+)$/, (id) => Discharge(id)],
    [/^#\/(settings|implants)$/, () => Settings],
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
    const m = (location.hash || '#/').match(/^#\/(ward|ot|settings)\b/);
    return m ? '#/' + m[1] : '#/';
  }

  function render() {
    deferred = false;
    const y = window.scrollY;
    const same = current && current.hash === location.hash;
    if (!same) current = { hash: location.hash, view: resolve() };
    const v = current.view;
    // Swap in a fresh element so delegated listeners from the last render don't pile up.
    const fresh = document.createElement('main');
    fresh.id = 'view';
    fresh.innerHTML = v.render();
    App.el.replaceWith(fresh);
    App.el = fresh;
    v.mount?.(fresh);
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
    const a = document.activeElement;
    return a && App.el?.contains(a) && /INPUT|TEXTAREA|SELECT/.test(a.tagName) && a.type !== 'checkbox' && a.type !== 'file';
  };

  function onStoreChange() {
    const gateNeeded = Store.mode === 'firebase' && Store.status !== 'ok';
    if (gateNeeded !== (current?.view === Gate)) {
      current = null;
      return render();
    }
    if (!current) return render();
    if (!current.view.live && !current.loading) return updateSync();
    if (editing()) {
      deferred = true;
      return updateSync();
    }
    render();
  }

  function start() {
    App.el = $('#view');
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
