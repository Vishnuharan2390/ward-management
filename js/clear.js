// A small × at the right edge of every text box (shown when it has something in it): one tap empties it.
// Works on whatever any page draws: boxes are marked after each redraw, and the tap is caught on the document.
// Clearing fires the box's own input + change events, so each page saves the empty value the usual way.
(() => {
  const TYPES = new Set(['', 'text', 'email', 'tel', 'url', 'number']);
  const eligible = (el) => {
    if (el.disabled || el.readOnly || el.hidden || el.dataset.noClear != null) return false;
    if (el.tagName === 'TEXTAREA') return true;
    return el.tagName === 'INPUT' && TYPES.has((el.getAttribute('type') || '').toLowerCase());
  };
  const filled = (el) => el.classList.toggle('filled', String(el.value || '') !== '');

  function mark() {
    document.querySelectorAll('input, textarea').forEach((el) => {
      if (!el.classList.contains('has-clr')) {
        if (!eligible(el) || el.offsetWidth < 90) return; // too narrow (lab values, ages) — the × would cover the text
        el.classList.add('has-clr');
      }
      filled(el);
    });
  }
  let queued = false;
  const later = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; mark(); });
  };
  new MutationObserver(later).observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('input', (e) => { if (e.target.classList?.contains('has-clr')) filled(e.target); }, true);
  window.addEventListener('resize', later);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', later); else later();

  // The × lives in the box's right padding (top right for a big box).
  const HIT = 30;
  const onX = (el, e) => {
    const r = el.getBoundingClientRect();
    if (e.clientX < r.right - HIT || e.clientX > r.right) return false;
    return el.tagName === 'TEXTAREA' ? e.clientY - r.top <= HIT + 4 : true;
  };
  function clear(e) {
    const el = e.target;
    if (!el.classList?.contains('has-clr') || !el.classList.contains('filled') || !onX(el, e)) return;
    e.preventDefault();
    el.value = '';
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    filled(el);
    el.focus();
  }
  document.addEventListener('click', clear, true);
})();
