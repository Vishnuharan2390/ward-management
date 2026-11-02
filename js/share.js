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

  // One case for WhatsApp: the identifying details, diagnosis, plan and procedure done (photos go with it).
  function caseText(c) {
    const row = (k, v) => (String(v ?? '').trim() ? `${k}: ${one(v)}\n` : '');
    return (`*${U(c.name)}*\n`
      + row('Age/Sex', U(ageSex(c)))
      + row('IP No', c.ipNo)
      + row('DOA', c.doa ? fmtDate(c.doa) : '')
      + row('Unit', `ORTHO UNIT ${unitOf(Store.meta.unitId).id}`)
      + row('Diagnosis', U(c.diagnosis))
      + row('Plan', U(c.plan))
      + row('Procedure done', U(c.procedureDone || c.discharge?.procedure))).trim();
  }

  // Phone: share sheet (WhatsApp, a group, anything). Computer: WhatsApp Web.
  async function send(text) {
    if (navigator.share && /iPhone|iPad|Android/i.test(navigator.userAgent)) {
      try { await navigator.share({ text }); return; } catch (e) { if (e.name === 'AbortError') return; }
    }
    window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank', 'noopener');
  }

  // Case photos as files for the share sheet: NAME_XRAY_1.jpg, NAME_WOUND_PIC_1.jpg…
  function dataUrlToFile(dataUrl, name) {
    const [head, b64] = dataUrl.split(',');
    const type = (head.match(/data:([^;]+)/) || [])[1] || 'image/jpeg';
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new File([bytes], name, { type });
  }
  function imageFiles(c, images) {
    const base = U(c.name).replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '') || 'PATIENT';
    const n = {};
    return images.map(({ kind, data }) => {
      const k = U(imageKind(kind).deck).replace(/[^A-Z0-9]+/g, '_');
      n[k] = (n[k] || 0) + 1;
      const ext = /^data:image\/png/.test(data) ? 'png' : 'jpg';
      return dataUrlToFile(data, `${base}_${k}_${n[k]}.${ext}`);
    });
  }

  // Text + photos together through the share sheet (pick WhatsApp → chat). Must run straight
  // from the tap (Safari refuses a share after waiting), so the files are prepared beforehand.
  // WhatsApp sometimes drops the text when photos are attached, so it's also copied to the
  // clipboard to paste as the caption.
  function sendWithFiles(text, files) {
    let ok = false;
    try { ok = !!(files.length && navigator.share && navigator.canShare && navigator.canShare({ files })); } catch { ok = false; }
    if (!ok) {
      if (files.length) toast('This browser can\'t share photos — sending the text only. Use the iPhone app (Safari) to send photos.', 5000);
      return send(text);
    }
    navigator.clipboard?.writeText(text).catch(() => {});
    navigator.share({ files, text }).then(() => toast('Shared. If the text is missing in WhatsApp, paste it as the caption — it\'s copied.', 5000))
      .catch((e) => { if (e.name !== 'AbortError') { toast('Couldn\'t share the photos — sending the text only.', 4000); send(text); } });
  }

  return { otText, wardText, pendingText, caseText, send, imageFiles, sendWithFiles };
})();
