// UI: hash-routed views rendered from Store state.
const App = (() => {
  let current = null; // { live, render }
  let deferred = false;

  const opts = (list, sel) => list.map((v) => {
    const [val, label] = Array.isArray(v) ? v : [v, v];
    return `<option value="${esc(val)}"${val === sel ? ' selected' : ''}>${esc(label)}</option>`;
  }).join('');
  const datalist = (id, list) => `<datalist id="${id}">${list.map((v) => `<option value="${esc(v)}">`).join('')}</datalist>`;
  const caseList = () => Object.entries(Store.cases).map(([id, c]) => ({ id, ...c }));
  const statusBadge = (s) => `<span class="badge st-${esc(s || 'preop')}">${esc(CASE_STATUS[s] || 'Pre-op')}</span>`;

  // ---------------------------------------------------------------- Dashboard
  let dashFilter = sessionStorage.getItem('wm.filter') || 'active';
  let dashQuery = '';

  function filteredCases() {
    const q = dashQuery.toLowerCase();
    return caseList()
      .filter((c) => {
        if (dashFilter === 'active') return c.status === 'preop' || c.status === 'posted' || !c.status;
        if (dashFilter === 'all') return true;
        return c.status === dashFilter;
      })
      .filter((c) => !q || [c.name, c.ipNo, c.bed, c.diagnosis, c.plan].join(' ').toLowerCase().includes(q))
      .sort((a, b) => String(a.bed || '').localeCompare(String(b.bed || ''), undefined, { numeric: true }) || (a.doa || '').localeCompare(b.doa || ''));
  }

  const Dashboard = {
    live: true,
    render() {
      const all = caseList();
      const cnt = (s) => all.filter((c) => (c.status || 'preop') === s).length;
      const ready = all.filter((c) => (c.status || 'preop') === 'preop' && readiness(c).ready).length;
      const list = filteredCases();
      const filters = [['active', 'Active'], ['preop', 'Pre-op'], ['posted', 'Posted'], ['postop', 'Post-op'], ['discharged', 'Discharged'], ['all', 'All']];
      return `
        <div class="stats">
          <div><b>${cnt('preop')}</b><span>Pre-op</span></div>
          <div><b>${ready}</b><span>Fit for OT</span></div>
          <div><b>${cnt('posted')}</b><span>Posted</span></div>
          <div><b>${cnt('postop')}</b><span>Post-op</span></div>
        </div>
        <div class="toolbar">
          <input type="search" id="q" placeholder="Search name, IP, bed, diagnosis…" value="${esc(dashQuery)}">
          <a class="btn primary" href="#/new">+ New case</a>
        </div>
        <div class="chips">${filters.map(([k, l]) => `<button class="chip${dashFilter === k ? ' on' : ''}" data-filter="${k}">${l}</button>`).join('')}</div>
        <div class="cards">
          ${list.map(caseCard).join('') || `<div class="empty">No cases here. ${all.length ? 'Try another filter.' : 'Tap “+ New case” to add your first patient.'}</div>`}
        </div>`;
    },
    mount(el) {
      $('#q', el).addEventListener('input', (e) => {
        dashQuery = e.target.value;
        $('.cards', el).innerHTML = filteredCases().map(caseCard).join('') || '<div class="empty">No matches.</div>';
      });
      el.addEventListener('click', (e) => {
        const f = e.target.closest('[data-filter]');
        if (f) {
          dashFilter = f.dataset.filter;
          sessionStorage.setItem('wm.filter', dashFilter);
          render();
        }
      });
    },
  };

  function caseCard(c) {
    const r = readiness(c);
    const pend = pendingList(c);
    const pct = r.total ? Math.round((r.done / r.total) * 100) : 0;
    const d = daysSince(c.doa);
    return `
      <a class="card case-card" href="#/case/${c.id}">
        <div class="row-between">
          <div>
            <div class="cc-name">${c.bed ? `<span class="bed">${esc(c.bed)}</span>` : ''}${esc(c.name)} <span class="muted">${esc(ageSex(c))}</span></div>
            <div class="muted small">IP ${esc(c.ipNo || '—')} · DOA ${esc(fmtDate(c.doa))}${d != null ? ` (D${d})` : ''}${c.scheme ? ' · ' + esc(c.scheme) : ''}</div>
          </div>
          ${statusBadge(c.status)}
        </div>
        <div class="cc-dx">${esc(c.diagnosis)}</div>
        ${c.plan ? `<div class="cc-plan">▸ ${esc(c.plan)}</div>` : ''}
        <div class="progress" title="${r.done}/${r.total} done"><i style="width:${pct}%" class="${r.ready ? 'ok' : ''}"></i></div>
        <div class="pend">
          ${r.ready && !pend.length ? '<span class="tag ok">✓ All work-up complete</span>' : ''}
          ${pend.slice(0, 8).map((p) => `<span class="tag ${p.kind}">${esc(p.text)}</span>`).join('')}
          ${pend.length > 8 ? `<span class="tag">+${pend.length - 8} more</span>` : ''}
        </div>
      </a>`;
  }

  // ---------------------------------------------------------------- Ward board
  const Ward = {
    live: true,
    render() {
      const list = caseList().filter((c) => ['preop', 'posted', undefined, ''].includes(c.status))
        .sort((a, b) => String(a.bed || '').localeCompare(String(b.bed || ''), undefined, { numeric: true }));
      const cell = (c, k) => {
        const chk = CHECKS.find((x) => x.k === k);
        return `<td class="s-${effStatus(c, chk) || 'none'}">${esc(checkSummary(c, chk))}</td>`;
      };
      return `
        <div class="toolbar">
          <h2>Ward status <span class="muted small">${fmtDate(todayISO())}</span></h2>
          <button class="btn" id="print-ward">Print / PDF</button>
        </div>
        <div class="table-wrap">
          <table class="board">
            <thead><tr><th>Patient</th><th>Diagnosis / Plan</th><th>CBC</th><th>RFT</th><th>LFT</th><th>VM</th><th>VCTC</th><th>ECG</th><th>ECHO</th><th>Opinions</th><th>X-ray</th><th>CT</th><th>MRI</th><th>PAC</th><th>Pending works</th></tr></thead>
            <tbody>
              ${list.map((c) => `<tr data-go="${c.id}">
                <td><b>${esc(c.name)}</b><div class="muted small">${esc(ageSex(c))} · ${esc(c.ipNo)}${c.bed ? ' · Bed ' + esc(c.bed) : ''}</div></td>
                <td>${esc(c.diagnosis)}<div class="muted small">▸ ${esc(c.plan)}</div></td>
                ${['cbc', 'rft', 'lft', 'vm', 'vctc', 'ecg', 'echo'].map((k) => cell(c, k)).join('')}
                <td>${listOf(c.opinions).map((o) => `<div class="s-${o.s || 'pending'}">${esc(o.dept)}</div>`).join('')}</td>
                ${['xray', 'ct', 'mri', 'anaes'].map((k) => cell(c, k)).join('')}
                <td>${listOf(c.tasks).filter((t) => !t.done).map((t) => `<div>• ${esc(t.text)}</div>`).join('')}</td>
              </tr>`).join('') || '<tr><td colspan="15" class="empty">No active pre-op cases.</td></tr>'}
            </tbody>
          </table>
        </div>
        <p class="muted small">Tap a row to open the case. Green = done, amber = sent, red = pending.</p>`;
    },
    mount(el) {
      $('#print-ward', el).onclick = () => {
        const list = caseList().filter((c) => ['preop', 'posted', undefined, ''].includes(c.status))
          .sort((a, b) => String(a.bed || '').localeCompare(String(b.bed || ''), undefined, { numeric: true }));
        Print.wardBoard(list, Store.meta);
      };
      el.addEventListener('click', (e) => {
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
        const c = id ? Store.cases[id] : { doa: todayISO(), status: 'preop' };
        if (!c) return notFound();
        return `
          <h2>${id ? 'Edit case' : 'New case'}</h2>
          <form id="case-form" class="card form" autocomplete="off">
            <fieldset><legend>Patient</legend>
              <label class="span2">Name<input name="name" required value="${esc(c.name)}"></label>
              <label>Age<input name="age" inputmode="numeric" value="${esc(c.age)}"></label>
              <label>Sex<select name="sex">${opts([['', '—'], ['M', 'Male'], ['F', 'Female'], ['O', 'Other']], c.sex || '')}</select></label>
              <label>IP number<input name="ipNo" value="${esc(c.ipNo)}"></label>
              <label>Bed<input name="bed" value="${esc(c.bed)}"></label>
              <label>Date of admission<input type="date" name="doa" value="${esc(c.doa)}"></label>
              <label>Status<select name="status">${opts(Object.entries(CASE_STATUS), c.status || 'preop')}</select></label>
            </fieldset>
            <fieldset><legend>Diagnosis & plan</legend>
              <label class="span2">Diagnosis<textarea name="diagnosis" rows="2">${esc(c.diagnosis)}</textarea></label>
              <label>Side / level<input name="side" list="dl-sides" value="${esc(c.side)}"></label>
              <label>Comorbidities<input name="comorbid" value="${esc(c.comorbid)}" placeholder="DM, SHTN…"></label>
              <label class="span2">Plan (proposed surgery)<textarea name="plan" rows="2" placeholder="e.g. CRIF with PFN">${esc(c.plan)}</textarea></label>
              <label>Anaesthesia<input name="anaesthesia" list="dl-anaes" value="${esc(c.anaesthesia)}"></label>
              <label>Scheme status<input name="scheme" list="dl-schemes" value="${esc(c.scheme)}"></label>
              <label class="span2">Implants
                <textarea name="implants" rows="3" placeholder="Auto-filled from the implant database when you type the plan">${esc(c.implants)}</textarea>
                <span class="hint" id="impl-hint"></span>
              </label>
              <div class="span2"><button type="button" class="btn small" id="impl-fill">↻ Fill implants from database</button></div>
            </fieldset>
            <div class="form-actions">
              <button class="btn primary" type="submit">${id ? 'Save' : 'Add case'}</button>
              <a class="btn" href="${id ? '#/case/' + id : '#/'}">Cancel</a>
              ${id ? '<button class="btn danger right" type="button" id="del">Delete case</button>' : ''}
            </div>
          </form>
          ${datalist('dl-anaes', ANAESTHESIA)}${datalist('dl-schemes', SCHEMES)}${datalist('dl-sides', SIDES)}`;
      },
      mount(el) {
        const f = $('#case-form', el);
        if (!f) return;
        const impl = f.elements.implants;
        let touched = !!impl.value.trim();
        impl.addEventListener('input', () => { touched = true; });
        const hint = () => {
          const m = matchImplants(f.elements.plan.value, Store.implants);
          $('#impl-hint', el).textContent = m.length ? 'Matches: ' + m.map((r) => r.name).join(', ') : 'No implant database match for this plan.';
        };
        const fill = () => { impl.value = suggestImplants({ plan: f.elements.plan.value }, Store.implants); };
        f.elements.plan.addEventListener('input', () => {
          hint();
          if (!touched) fill();
        });
        $('#impl-fill', el).onclick = () => {
          fill();
          touched = true;
        };
        hint();
        f.onsubmit = (e) => {
          e.preventDefault();
          const data = Object.fromEntries(new FormData(f).entries());
          for (const k in data) data[k] = data[k].trim();
          if (id) {
            const before = Store.cases[id];
            const changed = Object.keys(data).filter((k) => (before[k] || '') !== data[k]);
            if (changed.length) Store.patch('cases', id, Object.fromEntries(changed.map((k) => [k, data[k]])), 'Edited ' + changed.join(', '));
            location.hash = '#/case/' + id;
          } else {
            const nid = uid();
            Store.create('cases', nid, { ...data, inv: {}, log: { [uid()]: { at: Date.now(), by: Store.who(), msg: 'Case created' } } });
            location.hash = '#/case/' + nid;
          }
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

        const checkRow = (chk) => {
          const v = c.inv?.[chk.k] || {};
          const s = effStatus(c, chk);
          const statusOpts = Object.entries(STATUS).filter(([k]) => k !== '' || !chk.req);
          return `
            <div class="chk s-${s || 'none'}">
              <div class="chk-top">
                <div class="chk-label" title="${esc(chk.long || chk.label)}">${esc(chk.long || chk.label)}</div>
                <select data-bind="inv.${chk.k}.s" data-label="${esc(chk.label)}" class="st">${opts(statusOpts, s)}</select>
              </div>
              ${chk.fields ? `<div class="chk-fields">${chk.fields.map(([f, l]) => `<label>${l}<input data-bind="inv.${chk.k}.${f}" data-label="${esc(chk.label)} ${l}" data-check="${chk.k}" value="${esc(v[f])}"></label>`).join('')}</div>` : ''}
              <input class="note" data-bind="inv.${chk.k}.note" data-label="${esc(chk.label)} note" value="${esc(v.note)}" placeholder="Note / result">
              ${chk.img ? `<div class="chk-img">
                <button class="btn small" data-gallery="${chk.k}" ${imgCount(chk.k) ? '' : 'disabled'}>View ${imgCount(chk.k) ? `(${imgCount(chk.k)})` : ''}</button>
                <label class="btn small">+ Upload<input type="file" accept="image/*" multiple data-upload="${chk.k}" hidden></label>
              </div>` : ''}
            </div>`;
        };

        const opinions = listOf(c.opinions);
        const tasks = listOf(c.tasks);
        const log = listOf(c.log).reverse().slice(0, 25);

        return `
          <div class="card case-head">
            <div class="row-between">
              <div>
                <h2>${c.bed ? `<span class="bed">${esc(c.bed)}</span>` : ''}${esc(c.name)} <span class="muted">${esc(ageSex(c))}</span></h2>
                <div class="muted">IP ${esc(c.ipNo || '—')} · DOA ${esc(fmtDate(c.doa))}${d != null ? ` (day ${d})` : ''}</div>
              </div>
              <select id="case-status" class="badge-select st-${esc(c.status || 'preop')}">${opts(Object.entries(CASE_STATUS), c.status || 'preop')}</select>
            </div>
            <dl class="kv">
              <dt>Diagnosis</dt><dd>${esc(c.diagnosis) || '—'}${c.side ? ` <span class="muted">(${esc(c.side)})</span>` : ''}</dd>
              <dt>Plan</dt><dd>${esc(c.plan) || '—'}</dd>
              ${c.comorbid ? `<dt>Comorbid</dt><dd>${esc(c.comorbid)}</dd>` : ''}
              <dt>Anaesthesia</dt><dd>${esc(c.anaesthesia) || '—'}</dd>
              <dt>Implants</dt><dd class="pre">${esc(c.implants) || '—'}</dd>
              <dt>Scheme</dt><dd>${esc(c.scheme) || '—'}</dd>
            </dl>
            <div class="actions">
              <a class="btn" href="#/case/${id}/edit">Edit details</a>
              <a class="btn" href="#/discharge/${id}">Discharge / transfer</a>
            </div>
          </div>

          <section class="card">
            <h3>Pre-op work-up <span class="pill ${r.ready ? 'ok' : ''}">${r.done}/${r.total}</span></h3>
            <div class="checks">
              ${CHECKS.slice(0, CHECKS_BEFORE_OPINIONS).map(checkRow).join('')}
              <div class="chk chk-wide">
                <div class="chk-label">Opinions</div>
                ${opinions.map((o) => `
                  <div class="op-row s-${o.s || 'pending'}">
                    <b>${esc(o.dept)}</b>
                    <select data-bind="opinions.${o.id}.s" data-label="${esc(o.dept)} opinion" class="st">${opts(Object.entries(STATUS).filter(([k]) => k), o.s || 'pending')}</select>
                    <input class="note" data-bind="opinions.${o.id}.note" data-label="${esc(o.dept)} opinion note" value="${esc(o.note)}" placeholder="Advice / remarks">
                    <button class="icon" data-del-op="${o.id}" title="Remove">✕</button>
                  </div>`).join('') || '<div class="muted small">No opinions sought.</div>'}
                <form class="inline-add" id="add-op">
                  <input name="dept" list="dl-depts" placeholder="Add opinion — department" required>
                  <button class="btn small">Add</button>
                </form>
              </div>
              ${CHECKS.slice(CHECKS_BEFORE_OPINIONS).map(checkRow).join('')}
            </div>
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
              <input name="text" placeholder="e.g. Send blood for cross-match, get PAC done" required>
              <select name="to"><option value="">Anyone</option>${opts(ROLES)}</select>
              <button class="btn small primary">Add</button>
            </form>
          </section>

          <section class="card">
            <h3>Imaging</h3>
            <div class="gallery">
              ${images.map((im) => `<button class="thumb" data-open="${im.id}"><img data-img="${im.id}" alt=""><span>${esc(im.kind.toUpperCase())}${im.caption ? ' · ' + esc(im.caption) : ''}</span></button>`).join('') || '<div class="muted small">No images yet — upload from the X-ray / CT / MRI rows above.</div>'}
            </div>
          </section>

          <section class="card">
            <h3>Activity</h3>
            <ul class="log">${log.map((l) => `<li><span class="muted small">${fmtTime(l.at)}</span> <b>${esc(l.by)}</b> — ${esc(l.msg)}</li>`).join('')}</ul>
          </section>
          ${datalist('dl-depts', OPINION_DEPTS)}`;
      },
      mount(el) {
        const c = Store.cases[id];
        if (!c) return;

        $$('img[data-img]', el).forEach((img) => {
          Store.getImage(img.dataset.img).then((src) => { if (src) img.src = src; });
        });

        $('#case-status', el).onchange = (e) => {
          Store.patch('cases', id, { status: e.target.value }, 'Status → ' + CASE_STATUS[e.target.value]);
        };

        el.addEventListener('change', async (e) => {
          const t = e.target;
          if (t.dataset.bind) {
            const val = t.value.trim();
            const ch = { [t.dataset.bind]: val };
            // Typing all values of a lab panel marks it done.
            const chk = t.dataset.check && CHECKS.find((x) => x.k === t.dataset.check);
            if (chk) {
              const cur = { ...(Store.cases[id].inv?.[chk.k] || {}), [t.dataset.bind.split('.').pop()]: val };
              if (chk.fields.every(([f]) => cur[f]) && cur.s !== 'done') ch[`inv.${chk.k}.s`] = 'done';
            }
            const label = t.tagName === 'SELECT' ? `${t.dataset.label} → ${t.selectedOptions[0].text}` : `${t.dataset.label}: ${val || '(cleared)'}`;
            Store.patch('cases', id, ch, label);
          } else if (t.dataset.task) {
            const task = Store.cases[id].tasks[t.dataset.task];
            Store.patch('cases', id, t.checked
              ? { [`tasks.${t.dataset.task}.done`]: true, [`tasks.${t.dataset.task}.doneBy`]: Store.who(), [`tasks.${t.dataset.task}.doneAt`]: Date.now() }
              : { [`tasks.${t.dataset.task}.done`]: false }, (t.checked ? 'Done: ' : 'Reopened: ') + task.text);
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
            Store.patch('cases', id, { ['opinions.' + b.dataset.delOp]: DELETE }, 'Removed ' + Store.cases[id].opinions[b.dataset.delOp].dept + ' opinion');
          } else if (b.dataset.delTask) {
            if (confirm('Delete this task?')) Store.patch('cases', id, { ['tasks.' + b.dataset.delTask]: DELETE }, 'Deleted task: ' + Store.cases[id].tasks[b.dataset.delTask].text);
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
          if (dept) Store.patch('cases', id, { ['opinions.' + uid()]: { dept, s: 'pending', note: '', at: Date.now() } }, `${dept} opinion requested`);
        };
        $('#add-task', el).onsubmit = (e) => {
          e.preventDefault();
          const text = e.target.elements.text.value.trim();
          const to = e.target.elements.to.value;
          if (text) Store.patch('cases', id, { ['tasks.' + uid()]: { text, to, done: false, by: Store.who(), at: Date.now() } }, 'Task added: ' + text);
        };
      },
    };
  }

  function openViewer(caseId, imgId, kind) {
    const m = $('#modal');
    const show = async (iid) => {
      const all = listOf(Store.cases[caseId]?.images).filter((i) => !kind || i.kind === kind);
      const idx = all.findIndex((i) => i.id === iid);
      const im = all[idx];
      if (!im) return close();
      m.innerHTML = `
        <div class="viewer">
          <div class="viewer-bar">
            <span>${esc(im.kind.toUpperCase())} ${idx + 1}/${all.length} · ${esc(im.caption)} <span class="muted small">${esc(im.by)} · ${fmtTime(im.at)}</span></span>
            <span>
              <button class="btn small" data-v="prev" ${idx ? '' : 'disabled'}>‹</button>
              <button class="btn small" data-v="next" ${idx < all.length - 1 ? '' : 'disabled'}>›</button>
              <button class="btn small danger" data-v="del">Delete</button>
              <button class="btn small" data-v="close">Close</button>
            </span>
          </div>
          <div class="viewer-img"><img alt=""></div>
        </div>`;
      $('img', m).src = (await Store.getImage(im.id)) || '';
      m.onclick = async (e) => {
        const v = e.target.dataset.v || (e.target === m || e.target.classList.contains('viewer-img') ? 'close' : '');
        if (v === 'prev') show(all[idx - 1].id);
        if (v === 'next') show(all[idx + 1].id);
        if (v === 'close') close();
        if (v === 'del' && confirm('Delete this image for everyone?')) {
          await Store.deleteImage(caseId, im.id);
          close();
        }
      };
    };
    const close = () => {
      m.hidden = true;
      m.innerHTML = '';
    };
    m.hidden = false;
    show(imgId);
  }

  // ---------------------------------------------------------------- OT builder
  const OT_KEY = 'wm.v1.otDraft';
  function otDraft() {
    let d;
    try { d = JSON.parse(localStorage.getItem(OT_KEY)); } catch { /* ignore */ }
    d ||= {};
    d.date ||= todayISO(1);
    d.day ||= dayName(d.date);
    d.selected ||= [];
    d.cols ||= { remarks: false };
    d.remarks ||= {};
    d.prof ??= Store.meta.lastProf || '';
    return d;
  }
  const saveDraft = (d) => localStorage.setItem(OT_KEY, JSON.stringify(d));

  const OT = {
    live: false,
    showAll: false,
    render() {
      const d = otDraft();
      d.selected = d.selected.filter((id) => Store.cases[id]);
      const pool = caseList()
        .filter((c) => OT.showAll || d.selected.includes(c.id) || ['preop', 'posted', undefined, ''].includes(c.status))
        .sort((a, b) => String(a.bed || '').localeCompare(String(b.bed || ''), undefined, { numeric: true }));
      const sel = d.selected.map((id) => ({ id, ...Store.cases[id] }));
      const profs = Store.meta.profs || [];
      return `
        <h2>OT list builder</h2>
        <div class="card form">
          <fieldset><legend>List details</legend>
            <label>Date<input type="date" id="ot-date" value="${esc(d.date)}"></label>
            <label>Day<input id="ot-day" value="${esc(d.day)}"></label>
            <label>Theatre / OT<input id="ot-theatre" value="${esc(d.theatre)}" placeholder="optional"></label>
            <label>Assistant Professor<input id="ot-prof" list="dl-profs" value="${esc(d.prof)}"></label>
          </fieldset>
        </div>

        <div class="card">
          <div class="row-between"><h3>1 · Pick cases</h3>
            <label class="small"><input type="checkbox" id="ot-all" ${OT.showAll ? 'checked' : ''}> show all statuses</label></div>
          <div class="picks">
            ${pool.map((c) => {
              const r = readiness(c);
              return `<label class="pick"><input type="checkbox" data-pick="${c.id}" ${d.selected.includes(c.id) ? 'checked' : ''}>
                <span><b>${esc(c.name)}</b> <span class="muted">${esc(ageSex(c))} · ${esc(c.ipNo)}</span><br>
                <span class="small">${esc(c.diagnosis)} ▸ ${esc(c.plan)}</span></span>
                <span class="pill ${r.ready ? 'ok' : ''}">${r.ready ? 'Fit' : `${r.done}/${r.total}`}</span></label>`;
            }).join('') || '<div class="empty">No pre-op cases.</div>'}
          </div>
        </div>

        <div class="card">
          <h3>2 · Order & confirm <span class="pill">${sel.length}</span></h3>
          <p class="muted small">Edits here are saved back to the case.</p>
          <div class="ot-rows">
            ${sel.map((c, i) => `
              <div class="ot-row" data-case="${c.id}">
                <div class="ot-row-head">
                  <b>${i + 1}. ${esc(c.name)}</b> <span class="muted">${esc(ageSex(c))} · IP ${esc(c.ipNo)}</span>
                  <span class="right">
                    <button class="icon" data-move="-1" ${i ? '' : 'disabled'}>↑</button>
                    <button class="icon" data-move="1" ${i < sel.length - 1 ? '' : 'disabled'}>↓</button>
                    <button class="icon" data-unpick>✕</button>
                  </span>
                </div>
                ${pendingList(c).filter((p) => p.kind !== 'task').length ? `<div class="warn small">⚠ Pending: ${esc(pendingList(c).filter((p) => p.kind !== 'task').map((p) => p.text).join(', '))}</div>` : ''}
                <div class="ot-fields">
                  <label>Diagnosis<textarea data-f="diagnosis" rows="2">${esc(c.diagnosis)}</textarea></label>
                  <label>Procedure<textarea data-f="plan" rows="2">${esc(c.plan)}</textarea></label>
                  <label>Side / level<input data-f="side" list="dl-sides" value="${esc(c.side)}"></label>
                  <label>Anaesthesia<input data-f="anaesthesia" list="dl-anaes" value="${esc(c.anaesthesia)}"></label>
                  <label>Scheme<input data-f="scheme" list="dl-schemes" value="${esc(c.scheme)}"></label>
                  <label class="span2">Implants <button type="button" class="link small" data-refill>↻ from database</button><textarea data-f="implants" rows="2">${esc(c.implants)}</textarea></label>
                  ${d.cols.remarks !== false ? `<label class="span2">Remarks (this list only)<input data-remark value="${esc(d.remarks[c.id])}"></label>` : ''}
                </div>
              </div>`).join('') || '<div class="empty">Tick cases above to add them.</div>'}
          </div>
        </div>

        <div class="card">
          <h3>3 · Columns & print</h3>
          <div class="chips">${Object.entries(Print.OT_COLUMNS).map(([k, l]) => `<label class="chip ${d.cols[k] !== false ? 'on' : ''}"><input type="checkbox" data-col="${k}" ${d.cols[k] !== false ? 'checked' : ''} hidden>${l}</label>`).join('')}</div>
          <label class="small"><input type="checkbox" id="ot-mark" checked> Mark these cases as “Posted”</label>
          <div class="form-actions"><button class="btn primary" id="ot-go" ${sel.length ? '' : 'disabled'}>Generate OT list PDF</button></div>
        </div>
        ${datalist('dl-profs', profs)}${datalist('dl-anaes', ANAESTHESIA)}${datalist('dl-schemes', SCHEMES)}${datalist('dl-sides', SIDES)}`;
    },
    mount(el) {
      const d = otDraft();
      const upd = (fn, rerender = true) => {
        fn(d);
        saveDraft(d);
        if (rerender) render();
      };
      $('#ot-date', el).onchange = (e) => upd((x) => { x.date = e.target.value; x.day = dayName(x.date); });
      $('#ot-day', el).onchange = (e) => upd((x) => { x.day = e.target.value; }, false);
      $('#ot-theatre', el).onchange = (e) => upd((x) => { x.theatre = e.target.value; }, false);
      $('#ot-prof', el).onchange = (e) => upd((x) => { x.prof = e.target.value.trim(); }, false);
      $('#ot-all', el).onchange = (e) => { OT.showAll = e.target.checked; render(); };

      el.addEventListener('change', (e) => {
        const t = e.target;
        if (t.dataset.pick) {
          upd((x) => {
            x.selected = x.selected.filter((i) => i !== t.dataset.pick);
            if (t.checked) x.selected.push(t.dataset.pick);
          });
        } else if (t.dataset.col) {
          upd((x) => { x.cols[t.dataset.col] = t.checked; });
        } else if (t.dataset.f) {
          const cid = t.closest('[data-case]').dataset.case;
          Store.patch('cases', cid, { [t.dataset.f]: t.value.trim() }, `OT list: edited ${t.dataset.f}`);
        } else if (t.dataset.remark !== undefined) {
          const cid = t.closest('[data-case]').dataset.case;
          upd((x) => { x.remarks[cid] = t.value; }, false);
        }
      });

      el.addEventListener('click', (e) => {
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
          const ta = $('[data-f="implants"]', row);
          ta.value = suggestImplants({ plan: $('[data-f="plan"]', row).value }, Store.implants);
          ta.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });

      $('#ot-go', el).onclick = () => {
        // Flush any field still focused.
        document.activeElement?.blur();
        const dd = otDraft();
        const cases = dd.selected.map((id) => ({ id, ...Store.cases[id] }));
        if (dd.prof) {
          const profs = new Set(Store.meta.profs || []);
          profs.add(dd.prof);
          Store.setMeta({ profs: [...profs], lastProf: dd.prof });
        }
        if ($('#ot-mark', el).checked) {
          cases.filter((c) => c.status !== 'posted').forEach((c) => Store.patch('cases', c.id, { status: 'posted', otDate: dd.date }, `Posted for OT on ${fmtDate(dd.date)}`));
        }
        Print.otList(cases, dd, Store.meta);
      };
    },
  };

  // ---------------------------------------------------------------- Discharge
  function investigationsText(c) {
    return CHECKS.map((chk) => {
      const d = c.inv?.[chk.k] || {};
      const vals = (chk.fields || []).filter(([f]) => d[f]).map(([f, l]) => (chk.fields.length > 1 ? `${l} ${d[f]}` : d[f]));
      const st = effStatus(c, chk);
      const text = [vals.join(', '), d.note].filter(Boolean).join(' · ') || (st === 'done' ? 'Done' : '');
      return text ? `${chk.long || chk.label}: ${text}` : '';
    }).filter(Boolean).join('\n');
  }

  function Discharge(id) {
    const FIELDS = [
      ['diagnosis', 'Diagnosis', 2], ['procedure', 'Procedure done', 2],
      ['history', 'H/O injury / illness', 3], ['past', 'Past history / treatment history', 2],
      ['exam', 'Examination findings', 3], ['investigations', 'Investigations', 3],
      ['treatment', 'Treatment / drugs given', 3], ['opNotes', 'Procedure / operative notes', 4],
      ['course', 'Course in hospital', 3], ['condition', 'Condition on discharge', 2],
      ['meds', 'Discharge medications', 4], ['advice', 'Discharge advice', 3], ['review', 'Review', 1],
    ];
    return {
      live: false,
      render() {
        const c = Store.cases[id];
        if (!c) return notFound();
        const d = {
          disposition: 'discharge',
          dod: todayISO(),
          dos: c.otDate || '',
          diagnosis: c.diagnosis,
          procedure: c.plan,
          investigations: investigationsText(c),
          preparedBy: Store.profile().name || '',
          signedBy: Store.meta.lastProf || '',
          ...(c.discharge || {}),
        };
        return `
          <h2>Discharge / transfer — ${esc(c.name)} <span class="muted small">${esc(ageSex(c))} · IP ${esc(c.ipNo)}</span></h2>
          <form id="dc-form" class="card form" autocomplete="off">
            <fieldset><legend>Disposition</legend>
              <div class="span2 radios">${Object.entries(DISPOSITIONS).map(([k, v]) => `<label class="chip ${d.disposition === k ? 'on' : ''}"><input type="radio" name="disposition" value="${k}" ${d.disposition === k ? 'checked' : ''} hidden>${v.label}</label>`).join('')}</div>
              <label>AR number<input name="arNo" value="${esc(d.arNo)}"></label>
              <label>Date of surgery<input type="date" name="dos" value="${esc(d.dos)}"></label>
              <label>Date of discharge / transfer<input type="date" name="dod" value="${esc(d.dod)}"></label>
            </fieldset>
            <fieldset><legend>Summary</legend>
              ${FIELDS.map(([k, l, rows]) => `<label class="span2">${l}${k === 'investigations' ? ' <button type="button" class="link small" id="inv-refill">↻ from checklist</button>' : ''}<textarea name="${k}" rows="${rows}">${esc(d[k])}</textarea></label>`).join('')}
              <label>Prepared by (PG)<input name="preparedBy" value="${esc(d.preparedBy)}"></label>
              <label>Assistant Professor<input name="signedBy" list="dl-profs" value="${esc(d.signedBy)}"></label>
            </fieldset>
            <div class="form-actions">
              <button class="btn" type="button" id="dc-save">Save draft</button>
              <button class="btn primary" type="submit">Save & generate PDF</button>
              <a class="btn" href="#/case/${id}">Back</a>
            </div>
            <label class="small"><input type="checkbox" id="dc-status" checked> Update case status (Transfer → Post-op, others → Discharged)</label>
          </form>
          ${datalist('dl-profs', Store.meta.profs || [])}`;
      },
      mount(el) {
        const f = $('#dc-form', el);
        if (!f) return;
        f.addEventListener('change', (e) => {
          if (e.target.name === 'disposition') $$('.radios .chip', f).forEach((l) => l.classList.toggle('on', l.querySelector('input').checked));
        });
        $('#inv-refill', el).onclick = () => { f.elements.investigations.value = investigationsText(Store.cases[id]); };
        const save = (msg) => {
          const data = Object.fromEntries(new FormData(f).entries());
          Store.patch('cases', id, { discharge: data }, msg);
          return data;
        };
        $('#dc-save', el).onclick = () => {
          save('Discharge summary draft saved');
          toast('Draft saved');
        };
        f.onsubmit = (e) => {
          e.preventDefault();
          const data = save('Discharge summary generated');
          if ($('#dc-status', el).checked) {
            const st = DISPOSITIONS[data.disposition].status;
            if (Store.cases[id].status !== st) Store.patch('cases', id, { status: st }, 'Status → ' + CASE_STATUS[st]);
          }
          Print.discharge(Store.cases[id], data, Store.meta);
        };
      },
    };
  }

  // ---------------------------------------------------------------- Implants
  const Implants = {
    live: true,
    render() {
      const rules = Object.entries(Store.implants).map(([id, r]) => ({ ...r, id })).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      return `
        <h2>Implant database</h2>
        <p class="muted small">When a case's <b>plan</b> contains any keyword below, its implants are filled in automatically. Keywords match whole words, case-insensitive.</p>
        <div class="card">
          <label class="block">Try a plan<input id="impl-test" placeholder="e.g. CRIF with PFN right"></label>
          <div id="impl-out" class="muted small"></div>
        </div>
        <div class="impl-list">
          ${rules.map((r) => `
            <div class="card impl" data-rule="${r.id}">
              <div class="impl-grid">
                <label>Procedure<input data-k="name" value="${esc(r.name)}"></label>
                <label>Keywords (comma separated)<input data-k="keywords" value="${esc((r.keywords || []).join(', '))}"></label>
                <label class="span2">Implants needed<textarea data-k="implants" rows="2">${esc(r.implants)}</textarea></label>
              </div>
              <button class="icon" data-del-rule title="Delete">✕</button>
            </div>`).join('')}
        </div>
        <form class="card form" id="impl-add">
          <fieldset><legend>Add procedure</legend>
            <label>Procedure<input name="name" required></label>
            <label>Keywords<input name="keywords" required placeholder="e.g. tens, titanium elastic nail"></label>
            <label class="span2">Implants needed<textarea name="implants" rows="2" required></textarea></label>
          </fieldset>
          <div class="form-actions"><button class="btn primary">Add</button></div>
        </form>`;
    },
    mount(el) {
      const test = $('#impl-test', el);
      test.oninput = () => {
        const m = matchImplants(test.value, Store.implants);
        $('#impl-out', el).innerHTML = m.length ? m.map((r) => `<div><b>${esc(r.name)}</b>: ${esc(r.implants)}</div>`).join('') : (test.value ? 'No match' : '');
      };
      el.addEventListener('change', (e) => {
        const k = e.target.dataset.k;
        const id = e.target.closest('[data-rule]')?.dataset.rule;
        if (!k || !id) return;
        const v = k === 'keywords' ? e.target.value.split(',').map((s) => s.trim()).filter(Boolean) : e.target.value.trim();
        Store.patch('implants', id, { [k]: v });
        toast('Saved');
      });
      el.addEventListener('click', (e) => {
        const b = e.target.closest('[data-del-rule]');
        if (!b) return;
        const id = b.closest('[data-rule]').dataset.rule;
        if (confirm(`Delete "${Store.implants[id].name}"?`)) Store.remove('implants', id);
      });
      $('#impl-add', el).onsubmit = (e) => {
        e.preventDefault();
        const f = e.target.elements;
        Store.create('implants', uid(), {
          name: f.name.value.trim(),
          keywords: f.keywords.value.split(',').map((s) => s.trim()).filter(Boolean),
          implants: f.implants.value.trim(),
        });
        e.target.reset();
      };
    },
  };

  // ---------------------------------------------------------------- Settings
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
          <p class="muted small span2">Shown in the activity log next to every update you make.</p>
        </form>

        <form class="card form" id="meta">
          <fieldset><legend>Letterhead (shared)</legend>
            <label class="span2">Institution<input name="institution" value="${esc(m.institution)}" placeholder="Government … Medical College Hospital"></label>
            <label>Department<input name="department" value="${esc(m.department || 'Department of Orthopaedics')}"></label>
            <label>Unit<input name="unit" value="${esc(m.unit || 'Unit I')}"></label>
            <label class="span2">Unit chief<input name="chief" value="${esc(m.chief)}"></label>
          </fieldset>
        </form>

        <div class="card">
          <h3>Sharing</h3>
          ${Store.mode === 'local'
            ? `<p>Running in <b>local mode</b>: data lives only in this browser. To share with your HS and senior PGs, connect Firebase — see <b>README.md</b> (≈10 minutes, free).</p>`
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
      $('#meta', el).onchange = (e) => Store.setMeta({ [e.target.name]: e.target.value.trim() });
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
        return `<div class="card gate"><h2>Pre-op Ward</h2><p>Sign in with the Google account your unit added to the team.</p><button class="btn primary" id="signin">Sign in with Google</button></div>`;
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
    [/^#\/ot$/, () => OT],
    [/^#\/discharge\/(\w+)$/, (id) => Discharge(id)],
    [/^#\/implants$/, () => Implants],
    [/^#\/settings$/, () => Settings],
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
    const m = (location.hash || '#/').match(/^#\/(ward|ot|implants|settings)\b/);
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

  function onStoreChange() {
    const gateNeeded = Store.mode === 'firebase' && Store.status !== 'ok';
    const viewIsGate = current?.view === Gate;
    if (gateNeeded !== viewIsGate) {
      current = null;
      return render();
    }
    if (!current) return render();
    if (!current.view.live && !current.loading) return updateSync();
    const a = document.activeElement;
    if (a && App.el?.contains(a) && /INPUT|TEXTAREA|SELECT/.test(a.tagName) && a.type !== 'checkbox' && a.type !== 'file') {
      deferred = true;
      updateSync();
      return;
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
      setTimeout(() => {
        const a = document.activeElement;
        if (deferred && !(a && App.el?.contains(a) && /INPUT|TEXTAREA|SELECT/.test(a.tagName))) render();
      }, 0);
    });
    render();
    Store.init();
  }

  return { start, el: null };
})();

App.start();
