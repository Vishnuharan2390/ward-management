// Census page, part two: analytics from the data Callus already holds, for the chosen period (week / month / year)
// and the chosen units. Each section is a small table: { k, title, note, head, rows }. Shown on the page and put in
// the census PDF / PowerPoint. ctx = { operatedOn(c), unitLabel(key), today }.
const CensusMore = (() => {
  const U = (s) => String(s ?? '').toUpperCase().trim();
  const has = (s) => String(s ?? '').trim() !== '';
  const days = (a, b) => Math.round((new Date(b) - new Date(a)) / 864e5);
  const avg = (a) => (a.length ? Math.round((a.reduce((x, y) => x + y, 0) / a.length) * 10) / 10 : '—');
  const med = (a) => { if (!a.length) return '—'; const s = [...a].sort((x, y) => x - y); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  const pct = (n, d) => (d ? `${Math.round((n / d) * 100)}%` : '—');
  const count = (arr, keyOf) => { const m = new Map(); arr.forEach((x) => { const k = keyOf(x); if (k == null) return; m.set(k, (m.get(k) || 0) + 1); }); return [...m.entries()].sort((a, b) => b[1] - a[1]); };
  const names = (s) => String(s || '').split(/\s*,\s*|\s*\n\s*/).map((x) => U(x.replace(/^DR\.?\s*/i, 'DR. '))).filter(Boolean);
  const imgs = (c, kind) => Object.values(c.images || {}).filter((i) => i.kind === kind).length;
  const minHb = (c) => { let m = null; for (const e of allEntries(c)) { const v = parseFloat(e.v?.hb); if (!isNaN(v) && (m == null || v < m)) m = v; } return m; };
  const pos = (c, k, re) => re.test(String(latest(c, k)?.value || ''));
  const hip = (c) => /NECK\s+(OF\s+)?(THE\s+)?FEMUR|\bNOF\b|TROCHANTER/.test(U(c.diagnosis));
  const exitOp = (c) => /IMPLANT\s*(EXIT|REMOVAL)|REMOVAL\s+OF\s+(THE\s+)?(IMPLANT|PLATE|NAIL|K[\s-]?WIRE|SCREW|HARDWARE)/.test(U(`${c.plan} ${c.procedureDone}`));

  function sections(list, from, to, ctx) {
    const inR = (d) => !!d && d >= from && d <= to;
    const op = ctx.operatedOn;
    const end = (c) => (c.status === 'discharged' ? c.discharge?.dod || null : ctx.today);
    const active = list.filter((c) => c.doa && c.doa <= to && (end(c) || to) >= from);
    const adm = list.filter((c) => inR(c.doa));
    const ops = list.filter((c) => inR(op(c)));
    const dis = list.filter((c) => c.status === 'discharged' && inR(c.discharge?.dod));
    const delay = (c) => (c.doa && op(c) ? days(c.doa, op(c)) : null);
    const out = [];

    // 1. Delay to surgery
    {
      const d = ops.map(delay).filter((n) => n != null && n >= 0);
      const band = (lo, hi) => d.filter((n) => n >= lo && n <= hi).length;
      out.push({ k: 'delay', title: 'Delay to surgery', note: 'Days from admission to surgery, for the cases operated in this period.', head: ['', 'Cases'], rows: [
        ['Operated', ops.length], ['Average delay (days)', avg(d)], ['Median delay (days)', med(d)],
        ['0–1 day', band(0, 1)], ['2–3 days', band(2, 3)], ['4–7 days', band(4, 7)], ['8–14 days', band(8, 14)], ['More than 14 days', band(15, 9999)]] });
      const factors = [
        ['Cardiology opinion asked', (c) => Object.values(c.opinions || {}).some((o) => /CARDIO/i.test(o.dept))],
        ['Other opinion asked', (c) => Object.values(c.opinions || {}).some((o) => !/CARDIO/i.test(o.dept))],
        ['PAC works were pending', (c) => has(c.work?.anaesPending)],
        ['Known comorbidity (DM, HTN…)', (c) => has(c.comorbid) || Object.values(c.comorb || {}).some((x) => x?.on)],
        ['Hb below 10', (c) => { const h = minHb(c); return h != null && h < 10; }],
        ['Scheme not approved on the OT day', (c) => has(c.scheme) && c.scheme !== 'APPROVED'],
        ['Age above 60', (c) => ageYears(c) > 60],
      ];
      const withD = ops.filter((c) => delay(c) != null && delay(c) >= 0);
      out.push({ k: 'delayWhy', title: 'What slows surgery down', note: 'Average delay of operated cases with and without each factor.', head: ['Factor', 'Cases', 'Avg delay with', 'Avg delay without'],
        rows: factors.map(([l, f]) => { const yes = withD.filter(f); const no = withD.filter((c) => !f(c)); return [l, yes.length, avg(yes.map(delay)), avg(no.map(delay))]; }) });
    }

    // 2. OT efficiency
    {
      const posted = list.filter((c) => inR(c.otDate));
      const onDay = posted.filter((c) => op(c) === c.otDate).length;
      const later = posted.filter((c) => op(c) && op(c) > c.otDate).length;
      const notYet = posted.length - onDay - later;
      const perDay = count(ops, (c) => op(c));
      const busiest = perDay[0];
      out.push({ k: 'ot', title: 'OT efficiency', note: 'From each case\'s OT date (its latest posting) and its date of surgery.', head: ['', ''], rows: [
        ['Cases posted', posted.length], ['Done on the posted day', onDay], ['Done on a later day (postponed)', later], ['Not done yet / cancelled', notYet],
        ['Postponement rate', pct(later + notYet, posted.length)], ['OT days with surgery', perDay.length], ['Average cases per OT day', perDay.length ? avg(perDay.map((x) => x[1])) : '—'],
        ['Busiest OT day', busiest ? `${fmtDate(busiest[0])} (${busiest[1]})` : '—']] });
    }

    // 3. PG logbook
    {
      const m = new Map();
      const add = (n, k) => { const r = m.get(n) || { s: 0, a: 0 }; r[k]++; m.set(n, r); };
      ops.forEach((c) => { names(c.surgeon).forEach((n) => add(n, 's')); names(c.assistants).forEach((n) => add(n, 'a')); });
      const rows = [...m.entries()].sort((a, b) => (b[1].s + b[1].a) - (a[1].s + a[1].a)).map(([n, r]) => [n, r.s, r.a, r.s + r.a]);
      out.push({ k: 'logbook', title: 'Surgeon / PG logbook', note: rows.length ? 'From the surgeon and assistant names in Operative details. Download the full logbook (each case) as CSV.' : 'No surgeon / assistant names entered in Operative details for this period.', head: ['Name', 'As surgeon', 'As assistant', 'Total'], rows });
    }

    // 4. Implant usage
    {
      const keys = [];
      ops.forEach((c) => {
        const txt = c.implantsUsed || c.implants || '';
        const ks = typeof opnOtImplants === 'function' ? opnOtImplants(txt) : [];
        if (ks.length) ks.forEach((k) => keys.push(OPN_IMPLANTS[k]?.label || k));
        else if (has(txt)) keys.push('Other / not recognised');
        else keys.push('Not recorded');
      });
      out.push({ k: 'implants', title: 'Implant usage', note: 'Operations in this period, from "Implants used" (or the OT list implants).', head: ['Implant', 'Used'], rows: count(keys, (x) => x) });
    }

    // 5. Antibiogram
    {
      const iso = active.filter((c) => has(c.pus?.organism));
      const byOrg = new Map();
      iso.forEach((c) => {
        const org = U(c.pus.organism);
        const r = byOrg.get(org) || { n: 0, drugs: new Map() };
        r.n++;
        String(c.pus.sensitive || '').split(/[,;/]|\bAND\b/i).map(U).filter(Boolean).forEach((d) => r.drugs.set(d, (r.drugs.get(d) || 0) + 1));
        byOrg.set(org, r);
      });
      const rows = [...byOrg.entries()].sort((a, b) => b[1].n - a[1].n).map(([org, r]) => [org, r.n, [...r.drugs.entries()].sort((a, b) => b[1] - a[1]).map(([d, n]) => `${d} (${n}/${r.n})`).join(', ') || '—']);
      out.push({ k: 'abg', title: 'Antibiogram (pus C/S)', note: `${iso.length} culture${iso.length === 1 ? '' : 's'} with growth among patients under care in this period.`, head: ['Organism', 'Isolates', 'Sensitive to (isolates)'], rows });
    }

    // 6. Outcomes
    {
      const dispo = (c) => c.discharge?.disposition;
      const deaths = dis.filter((c) => dispo(c) === 'expired');
      const elderlyHip = adm.filter((c) => hip(c) && ageYears(c) > 60);
      const elderlyHipDead = list.filter((c) => hip(c) && ageYears(c) > 60 && dispo(c) === 'expired' && inR(c.discharge?.dod));
      const sores = active.filter((c) => Object.entries(c.bedsore || {}).some(([k, r]) => r?.status === 'present' && inR(`${k.slice(3, 7)}-${k.slice(7, 9)}-${k.slice(9, 11)}`)));
      const infected = active.filter((c) => has(c.pus?.organism));
      out.push({ k: 'outcomes', title: 'Outcomes', head: ['', 'Number', 'Rate'], rows: [
        ['Deaths', deaths.length, pct(deaths.length, dis.length) + ' of discharges'],
        ['  aged above 60', deaths.filter((c) => ageYears(c) > 60).length, ''],
        ['Elderly hip fractures admitted (above 60)', elderlyHip.length, ''],
        ['  of them died in this period', elderlyHipDead.length, pct(elderlyHipDead.length, elderlyHip.length)],
        ['AMA', dis.filter((c) => dispo(c) === 'ama').length, pct(dis.filter((c) => dispo(c) === 'ama').length, dis.length) + ' of discharges'],
        ['Absconded', dis.filter((c) => dispo(c) === 'absconded').length, ''],
        ['Bed sores found', sores.length, pct(sores.length, active.length) + ' of patients'],
        ['Infection (pus C/S grew an organism)', infected.length, pct(infected.length, active.length) + ' of patients'],
        ['Implant removal / exit operations', ops.filter(exitOp).length, '']] });
    }

    // 7. Scheme performance
    {
      const sch = (c) => U(c.scheme);
      const applied = ops.filter((c) => has(c.scheme) && sch(c) !== 'NO SCHEME');
      const ok = applied.filter((c) => sch(c) === 'APPROVED' || sch(c) === 'VALIDATION').length;
      out.push({ k: 'scheme', title: 'Scheme performance', note: 'Operations in this period, by their scheme status.', head: ['', 'Cases'], rows: [
        ['Applied for', applied.length], ['Approved', ops.filter((c) => sch(c) === 'APPROVED').length], ['Validation', ops.filter((c) => sch(c) === 'VALIDATION').length],
        ['Denied', ops.filter((c) => sch(c) === 'DENIED').length], ['No scheme', ops.filter((c) => sch(c) === 'NO SCHEME').length], ['Not recorded', ops.filter((c) => !has(c.scheme)).length],
        ['Approval rate (approved + validation / applied)', pct(ok, applied.length)],
        ...count(ops.filter((c) => ['NO SCHEME', 'DENIED'].includes(sch(c))), (c) => U(c.schemeReason) || 'REASON NOT GIVEN').map(([r, n]) => [`  Reason: ${r}`, n])] });
    }

    // 8. Epidemiology
    {
      const ag = (c) => { const a = ageYears(c); return isNaN(a) ? 'Age not recorded' : a < 15 ? 'Under 15' : a <= 40 ? '15–40' : a <= 60 ? '41–60' : 'Above 60'; };
      const mlc = adm.filter((c) => /^MLC/i.test(String(c.mode || ''))).length;
      const dow = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      out.push({ k: 'epi', title: 'Epidemiology (admissions)', head: ['', 'Admissions'], rows: [
        ...['Under 15', '15–40', '41–60', 'Above 60', 'Age not recorded'].map((g) => [g, adm.filter((c) => ag(c) === g).length]).filter(([g, n]) => n || g !== 'Age not recorded'),
        ['Male', adm.filter((c) => c.sex === 'M').length], ['Female', adm.filter((c) => c.sex === 'F').length],
        ['Medico-legal (MLC)', `${mlc} (${pct(mlc, adm.length)})`],
        ...count(adm, (c) => dow[new Date(`${c.doa}T12:00:00`).getDay()]).map(([d, n]) => [`Admitted on ${d}`, n])] });
      if (days(from, to) > 40) {
        const byMonth = count(adm, (c) => c.doa.slice(0, 7)).sort((a, b) => a[0].localeCompare(b[0]));
        out.push({ k: 'months', title: 'Admissions by month', head: ['Month', 'Admissions'], rows: byMonth.map(([m, n]) => [new Date(`${m}-01T12:00:00`).toLocaleString('en-GB', { month: 'long', year: 'numeric' }), n]) });
      }
    }

    // 9. Bed use
    {
      const nd = days(from, to) + 1;
      let bedDays = 0;
      active.forEach((c) => { const a = c.doa > from ? c.doa : from; const e0 = end(c) || to; const b = e0 < to ? e0 : to; if (b >= a) bedDays += days(a, b) + 1; });
      const longStay = list.filter((c) => c.doa && c.doa <= to && !(c.status === 'discharged' && c.discharge?.dod && c.discharge.dod <= to) && days(c.doa, to < ctx.today ? to : ctx.today) > 14);
      const losBySpec = count(dis, (c) => (specsOf(c)[0] ? SPECIALTIES[specsOf(c)[0]].label : 'Trauma / general')).map(([s]) => {
        const g = dis.filter((c) => (specsOf(c)[0] ? SPECIALTIES[specsOf(c)[0]].label : 'Trauma / general') === s && c.doa);
        return [`  Length of stay — ${s}`, `${avg(g.map((c) => days(c.doa, c.discharge.dod)))} days`];
      });
      out.push({ k: 'beds', title: 'Bed use', head: ['', ''], rows: [
        ['Bed-days', bedDays], ['Average patients per day', Math.round((bedDays / nd) * 10) / 10], ...losBySpec,
        ['Long stayers (past D14) at the end', longStay.length],
        ...longStay.slice(0, 8).map((c) => [`  ${U(c.name)} ${ageSex(c)}`, `D${days(c.doa, to < ctx.today ? to : ctx.today)} · ${ctx.unitLabel(c.unit)}`])] });
    }

    // 10. Comorbidity & labs
    {
      const cm = (c, k) => c.comorb?.[k]?.on || new RegExp(`\\b${k.replace('.', '\\.?')}\\b|${k === 'T2DM' ? 'DIABET|\\bDM\\b' : k === 'S.HTN' ? 'HYPERTENS|\\bHTN\\b' : '$^'}`, 'i').test(String(c.comorbid || ''));
      const anyCm = (c) => has(c.comorbid) || Object.values(c.comorb || {}).some((x) => x?.on);
      const opsD = ops.filter((c) => delay(c) != null && delay(c) >= 0);
      out.push({ k: 'labs', title: 'Comorbidity & labs (admissions)', head: ['', 'Number', ''], rows: [
        ['Diabetes', adm.filter((c) => cm(c, 'T2DM')).length, pct(adm.filter((c) => cm(c, 'T2DM')).length, adm.length)],
        ['Hypertension', adm.filter((c) => cm(c, 'S.HTN')).length, pct(adm.filter((c) => cm(c, 'S.HTN')).length, adm.length)],
        ['Any comorbidity', adm.filter(anyCm).length, pct(adm.filter(anyCm).length, adm.length)],
        ['Pre-op delay with a comorbidity (days)', avg(opsD.filter(anyCm).map(delay)), ''],
        ['Pre-op delay without (days)', avg(opsD.filter((c) => !anyCm(c)).map(delay)), ''],
        ['Hb below 10', adm.filter((c) => { const h = minHb(c); return h != null && h < 10; }).length, ''],
        ['Hb below 8 (likely transfusion)', adm.filter((c) => { const h = minHb(c); return h != null && h < 8; }).length, ''],
        ['HBsAg positive', adm.filter((c) => pos(c, 'hbsag', /^(pos|reac|\+)/i)).length, ''],
        ['HCV positive', adm.filter((c) => pos(c, 'hcv', /^(pos|reac|\+)/i)).length, ''],
        ['HIV reactive (PLHA)', adm.filter((c) => pos(c, 'hiv', /^(reac|pos|\+)/i)).length, '']] });
    }

    // 11. Documentation audit
    {
      const full = dis.filter((c) => !DISPOSITIONS[c.discharge?.disposition]?.quick);
      const r = (l, arr, f) => [l, `${arr.filter(f).length} / ${arr.length}`, pct(arr.filter(f).length, arr.length)];
      out.push({ k: 'audit', title: 'Documentation audit', head: ['', 'Done', ''], rows: [
        r('History of injury written (admissions)', adm, (c) => has(c.history)),
        r('Pre-op X-ray uploaded (operations)', ops, (c) => imgs(c, 'xray') > 0),
        r('OT notes written (operations)', ops, (c) => has(c.opNotes)),
        r('Implants used written (operations)', ops, (c) => has(c.implantsUsed)),
        r('Surgeon name entered (operations)', ops, (c) => has(c.surgeon)),
        r('Post-op X-ray uploaded (operations)', ops, (c) => imgs(c, 'poxray') > 0),
        r('Discharge summary written (discharges)', full, (c) => has(c.discharge?.course) || has(c.discharge?.advice))] });
    }
    return out;
  }

  // Each operation with the surgeon / assistants, for the PGs' logbooks
  function logbookCSV(list, from, to, ctx) {
    const inR = (d) => !!d && d >= from && d <= to;
    const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = [];
    list.filter((c) => inR(ctx.operatedOn(c))).sort((a, b) => ctx.operatedOn(a).localeCompare(ctx.operatedOn(b))).forEach((c) => {
      const base = [fmtDate(ctx.operatedOn(c)), ctx.unitLabel(c.unit), c.name, ageSex(c), c.ipNo, c.diagnosis, c.procedureDone || c.plan, c.implantsUsed || c.implants];
      names(c.surgeon).forEach((n) => rows.push([n, 'SURGEON', ...base]));
      names(c.assistants).forEach((n) => rows.push([n, 'ASSISTANT', ...base]));
      if (!names(c.surgeon).length && !names(c.assistants).length) rows.push(['(NOT ENTERED)', '', ...base]);
    });
    rows.sort((a, b) => a[0].localeCompare(b[0]));
    const head = ['NAME', 'ROLE', 'DATE OF SURGERY', 'UNIT', 'PATIENT', 'AGE/SEX', 'IP NO', 'DIAGNOSIS', 'PROCEDURE', 'IMPLANTS'];
    return '﻿' + [head, ...rows].map((r) => r.map(q).join(',')).join('\r\n');
  }

  return { sections, logbookCSV };
})();
