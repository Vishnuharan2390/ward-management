// A small on-screen Tamil keyboard for correcting Tamil words (consent forms' name / implant / fracture boxes),
// for phones without a Tamil keyboard installed. TaKeys.attach(box, selector, toggleButton): the button opens
// the keyboard inside `box`; keys type into the last focused field matching `selector`, at the cursor.
const TaKeys = (() => {
  // vowels · consonants (2 rows) · vowel signs
  const ROWS = [
    ['அ', 'ஆ', 'இ', 'ஈ', 'உ', 'ஊ', 'எ', 'ஏ', 'ஐ', 'ஒ', 'ஓ', 'ஔ', 'ஃ'],
    ['க', 'ங', 'ச', 'ஞ', 'ட', 'ண', 'த', 'ந', 'ப', 'ம', 'ய', 'ர'],
    ['ல', 'வ', 'ழ', 'ள', 'ற', 'ன', 'ஜ', 'ஷ', 'ஸ', 'ஹ', 'க்ஷ', 'ஸ்ரீ'],
    ['்', 'ா', 'ி', 'ீ', 'ு', 'ூ', 'ெ', 'ே', 'ை', 'ொ', 'ோ', 'ௌ'],
  ];
  // vowel signs and the pulli are shown on a dotted circle so they can be seen
  const SIGNS = new Set(ROWS[3]);
  const face = (k) => (SIGNS.has(k) ? `◌${k}` : k);

  function attach(box, selector, toggle) {
    let target = null;
    let panel = null;
    const fields = () => [...box.querySelectorAll(selector)];
    box.addEventListener('focusin', (e) => {
      if (!e.target.matches?.(selector)) return;
      target = e.target;
      if (panel) setTimeout(() => target.scrollIntoView({ block: 'center' }), 0); // keep it above the keys
    });
    const type = (fn) => {
      const el = target && target.isConnected ? target : fields()[0];
      if (!el) return;
      const s = el.selectionStart ?? el.value.length;
      const t = el.selectionEnd ?? s;
      const [v, pos] = fn(el.value, s, t);
      el.value = v;
      el.setSelectionRange?.(pos, pos);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      target = el;
      el.focus({ preventScroll: true });
    };
    // a backspace removes one code point (a vowel sign or pulli on its own, or a letter)
    const back = (v, s, t) => {
      if (s !== t) return [v.slice(0, s) + v.slice(t), s];
      if (!s) return [v, 0];
      const before = [...v.slice(0, s)];
      before.pop();
      const head = before.join('');
      return [head + v.slice(s), head.length];
    };
    function open() {
      panel = document.createElement('div');
      panel.className = 'ta-keys';
      panel.innerHTML = `${ROWS.map((r) => `<div class="ta-row" style="grid-template-columns: repeat(${r.length}, minmax(0, 1fr))">${r.map((k) => `<button type="button" data-k="${k}">${face(k)}</button>`).join('')}</div>`).join('')}
        <div class="ta-row ta-ctl"><button type="button" data-c="left" aria-label="Cursor left">‹</button><button type="button" data-c="space" class="ta-space">space</button><button type="button" data-c="right" aria-label="Cursor right">›</button><button type="button" data-c="back" aria-label="Delete">⌫</button><button type="button" data-c="done" class="ta-done">Done</button></div>`;
      // the phone's own keyboard stays down while this one is open
      fields().forEach((f) => { f.dataset.imBefore = f.getAttribute('inputmode') || ''; f.setAttribute('inputmode', 'none'); });
      panel.addEventListener('pointerdown', (e) => {
        const b = e.target.closest('button');
        if (!b) return;
        e.preventDefault(); // keep the cursor in the field
        if (b.dataset.k) type((v, s, t) => [v.slice(0, s) + b.dataset.k + v.slice(t), s + b.dataset.k.length]);
        else if (b.dataset.c === 'space') type((v, s, t) => [`${v.slice(0, s)} ${v.slice(t)}`, s + 1]);
        else if (b.dataset.c === 'back') type(back);
        else if (b.dataset.c === 'left') type((v, s) => [v, Math.max(0, s - 1)]);
        else if (b.dataset.c === 'right') type((v, s, t) => [v, Math.min(v.length, t + 1)]);
        else if (b.dataset.c === 'done') close();
      });
      box.appendChild(panel);
      toggle.classList.add('on');
      const f = target || fields()[0];
      f?.focus({ preventScroll: true });
      f?.scrollIntoView({ block: 'center' }); // the box being corrected stays visible above the keys
    }
    function close() {
      panel?.remove();
      panel = null;
      fields().forEach((f) => { if (f.dataset.imBefore) f.setAttribute('inputmode', f.dataset.imBefore); else f.removeAttribute('inputmode'); });
      toggle.classList.remove('on');
    }
    toggle.addEventListener('click', () => (panel ? close() : open()));
    return { open, close };
  }
  return { attach };
})();
