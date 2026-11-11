// Getting a new release onto the phone without closing and reopening the app.
// - "Reload" in the menu bar: throws away the offline copy (service worker + its cache)
//   and loads the site fresh from the server.
// - On opening / coming back to the app (and every 30 min), the live index.html is checked;
//   if its version is newer than the one running, a bar offers the reload.
const Updater = (() => {
  const running = () => ($('.ver')?.textContent.match(/v(\d+)/) || [])[1];

  async function hardReload() {
    if (!navigator.onLine) return toast('You’re offline — connect to the internet, then reload', 4000);
    toast('Getting the latest version…', 8000);
    try {
      const regs = (await navigator.serviceWorker?.getRegistrations()) || [];
      await Promise.all(regs.map((r) => r.unregister()));
    } catch { /* no service worker */ }
    try {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith('preop-ward-')).map((k) => caches.delete(k)));
    } catch { /* no cache storage */ }
    // A fresh query string so neither the browser nor GitHub's cache hands back the old page.
    location.replace(`${location.pathname}?r=${Date.now()}${location.hash}`);
  }

  async function latest() {
    try {
      const res = await fetch(`index.html?check=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) return null;
      return ((await res.text()).match(/class="ver"[^>]*>\s*v(\d+)/) || [])[1] || null;
    } catch { return null; }
  }

  function offer(v) {
    if ($('#update-bar')) return;
    const bar = document.createElement('div');
    bar.id = 'update-bar';
    bar.setAttribute('role', 'status');
    bar.innerHTML = `<span>New version <b>v${esc(v)}</b> is ready</span><button class="btn primary" type="button">Reload now</button><button class="btn" type="button" aria-label="Later">✕</button>`;
    const [go, later] = bar.querySelectorAll('button');
    go.onclick = hardReload;
    later.onclick = () => bar.remove();
    document.body.appendChild(bar);
  }

  async function check() {
    const now = running();
    const v = await latest();
    if (now && v && +v > +now) offer(v);
  }

  function start() {
    const btn = $('#reload');
    if (btn) btn.onclick = hardReload;
    // The ?r=… from a reload has done its job: tidy the address bar.
    if (/[?&]r=\d+/.test(location.search)) history.replaceState(null, '', location.pathname + location.hash);
    setTimeout(check, 3000);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
    setInterval(check, 30 * 60e3);
  }

  return { start, check, hardReload };
})();
Updater.start();
