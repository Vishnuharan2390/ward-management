// Share to WhatsApp: builds WhatsApp-formatted text (*bold*, _italic_) and hands it to
// the phone's share sheet (pick WhatsApp / a group), or WhatsApp Web on a computer.
// Nothing goes through any server of ours.
const Share = (() => {
  const U = (s) => String(s ?? '').trim().toUpperCase().replace(/\s+/g, ' ');
  const one = (s) => String(s ?? '').trim().replace(/\s*\n\s*/g, ', ');
  const line = (label, v) => (String(v ?? '').trim() ? `   ${label}: ${one(v)}\n` : '');
  const who = (c) => [U(c.name), ageSex(c), c.ipNo && `IP ${c.ipNo}`, c.ward && `W ${U(c.ward)}`].filter(Boolean).join(' · ');

  function otText(cases, draft) {
    const [t1, t2] = Print.otTitle(draft);
    let s = `*${t1}*\n${t2 ? `_${t2}_\n` : ''}\n`;
    cases.forEach((c, i) => {
      s += `*${i + 1}. ${who(c)}*\n` + line('Dx', U(c.diagnosis)) + line('Plan', U(c.plan)) + line('Level', c.level)
        + line('Implants', U(c.implants)) + line('Scheme', U(c.scheme)) + '\n';
    });
    if (draft.prof) s += `_${U(draft.prof)}_`;
    return s.trim();
  }

  function wardText(cases) {
    let s = `*WARD STATUS — ${fmtDate(todayISO())}*\n_${cases.length} active pre-op_\n\n`;
    cases.forEach((c, i) => {
      const ab = abnormalList(c).map((x) => x.text);
      const pend = pendingList(c).map((x) => x.text);
      s += `*${i + 1}. ${who(c)}*${c.status === 'posted' ? ' — *BOT*' : ''}\n` + line('Dx', U(c.diagnosis)) + line('Plan', U(c.plan))
        + (ab.length ? `   ⚠️ ${ab.join(', ')}\n` : '') + (pend.length ? `   ⏳ ${pend.join(', ')}\n` : '   ✅ Work-up complete\n') + '\n';
    });
    return s.trim();
  }

  function pendingText(cases) {
    const rows = cases.map((c) => [c, pendingList(c).map((x) => x.text)]).filter(([, p]) => p.length);
    let s = `*PENDING WORKS — ${fmtDate(todayISO())}*\n\n`;
    if (!rows.length) return s + 'Nothing pending 🎉';
    rows.forEach(([c, p], i) => { s += `*${i + 1}. ${U(c.name)}* ${ageSex(c)}${c.ward ? ` · W ${U(c.ward)}` : ''}\n` + `   ⏳ ${p.join(', ')}\n\n`; });
    return s.trim();
  }

  function caseText(c) {
    const ab = abnormalList(c).map((x) => x.text);
    const pend = pendingList(c).map((x) => x.text);
    return (`*${who(c)}*\n` + line('Dx', U(c.diagnosis)) + line('Plan', U(c.plan)) + line('Level', c.level) + line('Implants', U(c.implants))
      + line('Scheme', U(c.scheme)) + (ab.length ? `   ⚠️ ${ab.join(', ')}\n` : '') + (pend.length ? `   ⏳ ${pend.join(', ')}` : '   ✅ Work-up complete')).trim();
  }

  // Phone: share sheet (WhatsApp, a group, anything). Computer: WhatsApp Web.
  async function send(text) {
    if (navigator.share && /iPhone|iPad|Android/i.test(navigator.userAgent)) {
      try { await navigator.share({ text }); return; } catch (e) { if (e.name === 'AbortError') return; }
    }
    window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank', 'noopener');
  }

  return { otText, wardText, pendingText, caseText, send };
})();
