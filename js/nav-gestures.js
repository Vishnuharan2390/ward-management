// Phone niceties for the home-screen app (no browser bar there):
// - ‹ Back in the title bar: back through the pages opened in the app; from the first page, to the start page.
// - Pull down from the top of a page to refresh it.
(() => {
  // ---- Back -------------------------------------------------------------------------------
  const KEY = 'wm.navStack';
  const read = () => { try { return JSON.parse(sessionStorage.getItem(KEY)) || []; } catch { return []; } };
  const write = (s) => { try { sessionStorage.setItem(KEY, JSON.stringify(s.slice(-50))); } catch { /* private mode */ } };
  const here = () => location.hash || '#/home';
  function track() {
    const s = read();
    const h = here();
    if (s.at(-1) === h) return paint(s);
    if (s.at(-2) === h) s.pop(); // went back
    else s.push(h);
    write(s);
    paint(s);
  }
  function paint(s = read()) {
    const b = document.getElementById('back-btn');
    if (b) b.hidden = s.length <= 1 && /^#\/home$|^#?\/?$/.test(here());
  }
  function back() {
    const s = read();
    if (s.length > 1) history.back();
    else { write([]); location.hash = '#/home'; }
  }

  // ---- Pull to refresh -----------------------------------------------------------------------
  const PULL = 80;
  let y0 = null;
  let x0 = 0;
  let dy = 0;
  let ind;
  const blocked = (t) => document.body.classList.contains('rounds-mode') || !document.getElementById('modal')?.hidden
    || t.closest?.('textarea, select, input, [contenteditable], .sheet-wrap, #update-bar, .dthumbs, .rm-wrap');
  function indicator() {
    if (!ind) {
      ind = document.createElement('div');
      ind.id = 'ptr';
      ind.setAttribute('aria-hidden', 'true');
      document.body.appendChild(ind);
    }
    return ind;
  }
  function onStart(e) {
    if (e.touches.length !== 1 || window.scrollY > 0 || blocked(e.target)) { y0 = null; return; }
    y0 = e.touches[0].clientY;
    x0 = e.touches[0].clientX;
    dy = 0;
  }
  function onMove(e) {
    if (y0 == null) return;
    dy = e.touches[0].clientY - y0;
    if (dy <= 0 || Math.abs(e.touches[0].clientX - x0) > dy || window.scrollY > 0) { if (ind) ind.classList.remove('show'); return; }
    const el = indicator();
    const d = Math.min(dy, PULL * 1.6);
    el.classList.add('show');
    el.classList.toggle('ready', dy >= PULL);
    el.textContent = dy >= PULL ? '↻ Release to refresh' : '↓ Pull to refresh';
    el.style.transform = `translate(-50%, ${Math.round(d * 0.6)}px)`;
  }
  function onEnd() {
    if (y0 == null) return;
    y0 = null;
    if (!ind) return;
    if (dy >= PULL && ind.classList.contains('show')) {
      ind.textContent = '↻ Refreshing…';
      ind.classList.add('ready');
      setTimeout(() => location.reload(), 150);
      return;
    }
    ind.classList.remove('show', 'ready');
    ind.style.transform = '';
  }

  function start() {
    const b = document.getElementById('back-btn');
    if (b) b.onclick = back;
    window.addEventListener('hashchange', track);
    track();
    document.addEventListener('touchstart', onStart, { passive: true });
    document.addEventListener('touchmove', onMove, { passive: true });
    document.addEventListener('touchend', onEnd, { passive: true });
    document.addEventListener('touchcancel', onEnd, { passive: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
