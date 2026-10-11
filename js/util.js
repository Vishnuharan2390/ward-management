// Small helpers shared by every module.
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

const DELETE = Object.freeze({ __delete: true });

function getPath(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

function setPath(obj, path, val) {
  const keys = path.split('.');
  const last = keys.pop();
  let o = obj;
  for (const k of keys) {
    if (typeof o[k] !== 'object' || o[k] === null) o[k] = {};
    o = o[k];
  }
  if (val === DELETE) delete o[last];
  else o[last] = val;
}

const pad = (n) => String(n).padStart(2, '0');

function todayISO(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function fmtDate(iso) {
  if (!iso) return '';
  const [y, m, d] = String(iso).split('-');
  return d && m && y ? `${d}/${m}/${y}` : iso;
}

function fmtTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function dayName(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return isNaN(d) ? '' : d.toLocaleDateString('en-IN', { weekday: 'long' });
}

function daysSince(iso) {
  if (!iso) return null;
  const d = new Date(iso + 'T00:00:00');
  if (isNaN(d)) return null;
  return Math.floor((new Date(todayISO() + 'T00:00:00') - d) / 86400000);
}

function toast(msg, ms = 2200) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('show'), ms);
}

// Downscale a photo so it fits comfortably in a single database document.
async function compressImage(file, max = 1600, quality = 0.8) {
  const src = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error('Not an image'));
      i.src = src;
    });
    const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * s);
    c.height = Math.round(img.naturalHeight * s);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    let q = quality;
    let url = c.toDataURL('image/jpeg', q);
    while (url.length > 900000 && q > 0.3) {
      q -= 0.1;
      url = c.toDataURL('image/jpeg', q);
    }
    return url;
  } finally {
    URL.revokeObjectURL(src);
  }
}
