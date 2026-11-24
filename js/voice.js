// Dictation for text boxes, using the browser's own speech recognition
// (Chrome, Edge, Safari). Where it isn't available no button is shown and
// the phone keyboard's microphone still works.
const Voice = (() => {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let active = null; // { rec, ta, btn }

  function stop() {
    if (!active) return;
    const { rec } = active;
    active = null;
    try { rec.stop(); } catch { /* already stopped */ }
  }

  function start(ta, btn) {
    const rec = new SR();
    rec.lang = 'en-IN';
    rec.continuous = true;
    rec.interimResults = true;
    const base = ta.value;
    const sep = base && !/\s$/.test(base) ? (ta.tagName === 'TEXTAREA' ? '\n' : ' ') : '';
    let finalText = '';
    active = { rec, ta, btn };
    btn.classList.add('on');
    btn.setAttribute('aria-pressed', 'true');
    ta.focus();
    rec.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText += (finalText && !/\s$/.test(finalText) ? ' ' : '') + t.trim();
        else interim += t;
      }
      ta.value = base + sep + finalText + (interim ? (finalText ? ' ' : '') + interim : '');
      ta.dispatchEvent(new Event('input', { bubbles: true }));
    };
    rec.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') toast('Microphone permission is off for this site. Allow it in the browser settings, or use the keyboard’s microphone.', 5000);
      else if (e.error !== 'no-speech' && e.error !== 'aborted') toast('Dictation stopped: ' + e.error, 3500);
    };
    rec.onend = () => {
      btn.classList.remove('on');
      btn.setAttribute('aria-pressed', 'false');
      ta.value = base + sep + finalText;
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      ta.dispatchEvent(new Event('change', { bubbles: true })); // saves on the case page
      if (active && active.rec === rec) active = null;
    };
    try {
      rec.start();
    } catch (err) {
      btn.classList.remove('on');
      active = null;
      toast('Could not start dictation: ' + err.message, 3500);
    }
  }

  // Adds a 🎤 button to every text area under `root` (and one-line text boxes with { inputs: true }).
  function attach(root, { inputs = false } = {}) {
    if (!SR || !root) return;
    const sel = inputs ? 'textarea:not([data-novoice]), input:not([type]):not([data-novoice]), input[type=text]:not([data-novoice])' : 'textarea:not([data-novoice])';
    root.querySelectorAll(sel).forEach((ta) => {
      if (ta.disabled || ta.readOnly || ta.offsetWidth < 140) return;
      if (ta.dataset.voice) return;
      ta.dataset.voice = '1';
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'mic';
      btn.title = 'Dictate (tap again to stop)';
      btn.setAttribute('aria-label', 'Dictate into this box');
      btn.setAttribute('aria-pressed', 'false');
      btn.textContent = '🎤';
      ta.insertAdjacentElement('afterend', btn);
      ta.parentElement.classList.add('mic-host');
      if (ta.tagName === 'INPUT' || ta.offsetHeight < 70) {
        // one-line box: the 🎤 sits inside it, left of the clear ×
        ta.classList.add('mic-field');
        btn.classList.add('mic-in');
        btn.style.top = `${ta.offsetTop + (ta.offsetHeight - 30) / 2}px`;
        btn.style.bottom = 'auto';
      }
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const same = active && active.ta === ta;
        stop();
        if (!same) start(ta, btn);
      });
    });
  }

  return { attach, stop, supported: !!SR };
})();
