// Crop (and rotate) a picture before it is added to a case. One screen per picture:
// drag the corners to crop, drag inside to move, ⟲ rotates 90°, Full resets, ✓ Use keeps it,
// Don't add leaves it out. cropAll(files) → the pictures to add, as JPEG files.
const ImageCrop = (() => {
  const PAD = 18; // room round the picture so the handles at its edges aren't cut off
  const MAX_SRC = 2400; // working copy (phone memory); the upload is shrunk to 1600 later anyway

  function load(file) {
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => res({ img, url });
      img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('not a picture')); };
      img.src = url;
    });
  }

  // The image turned by `rot` (0/90/180/270), at most MAX_SRC on its long side.
  function rotated(img, rot) {
    const s = Math.min(1, MAX_SRC / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * s);
    const h = Math.round(img.naturalHeight * s);
    const c = document.createElement('canvas');
    const side = rot % 180 !== 0;
    c.width = side ? h : w;
    c.height = side ? w : h;
    const g = c.getContext('2d');
    g.translate(c.width / 2, c.height / 2);
    g.rotate((rot * Math.PI) / 180);
    g.drawImage(img, -w / 2, -h / 2, w, h);
    return c;
  }

  function edit(file, n, total) {
    return load(file).then(({ img, url }) => new Promise((resolve) => {
      let rot = 0;
      let src = rotated(img, rot);
      const wrap = document.createElement('div');
      wrap.className = 'crop-wrap';
      wrap.setAttribute('role', 'dialog');
      wrap.setAttribute('aria-label', 'Crop picture');
      wrap.innerHTML = `
        <div class="crop-top"><b>Crop${total > 1 ? ` · ${n} of ${total}` : ''}</b><span>Drag across the part you want · then fine-tune a corner or side</span></div>
        <div class="crop-stage"><div class="crop-frame"><div class="crop-area"><canvas></canvas>
          <div class="crop-box"><i data-h="tl"></i><i data-h="tr"></i><i data-h="bl"></i><i data-h="br"></i><b data-e="t"></b><b data-e="b"></b><b data-e="l"></b><b data-e="r"></b></div></div></div></div>
        <div class="crop-bar">
          <button type="button" class="btn" data-c="rot" aria-label="Rotate">⟲</button>
          <button type="button" class="btn" data-c="full">Full</button>
          <button type="button" class="btn" data-c="skip">Don't add</button>
          <button type="button" class="btn primary" data-c="ok">✓ Use</button>
        </div>`;
      document.body.appendChild(wrap);
      const area = wrap.querySelector('.crop-area');
      const cv = wrap.querySelector('canvas');
      const box = wrap.querySelector('.crop-box');
      const stage = wrap.querySelector('.crop-stage');
      let W = 0;
      let H = 0;
      let r = null; // crop rectangle in display px: { x, y, w, h }

      function layout(keep) {
        const sw = stage.clientWidth - 16 - 2 * PAD;
        const sh = stage.clientHeight - 16 - 2 * PAD;
        const s = Math.min(sw / src.width, sh / src.height);
        const old = { W, H };
        W = Math.round(src.width * s);
        H = Math.round(src.height * s);
        const dpr = window.devicePixelRatio || 1;
        cv.width = Math.round(W * dpr);
        cv.height = Math.round(H * dpr);
        cv.style.width = W + 'px';
        cv.style.height = H + 'px';
        area.style.width = W + 'px';
        area.style.height = H + 'px';
        cv.getContext('2d').drawImage(src, 0, 0, cv.width, cv.height);
        // start a little inside the picture, so every corner and side is in easy reach
        const ix = Math.round(W * 0.06);
        const iy = Math.round(H * 0.06);
        r = keep && r && old.W ? { x: (r.x * W) / old.W, y: (r.y * H) / old.H, w: (r.w * W) / old.W, h: (r.h * H) / old.H } : { x: ix, y: iy, w: W - 2 * ix, h: H - 2 * iy };
        draw();
      }
      function draw() {
        Object.assign(box.style, { left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px' });
      }

      // Touch anywhere: near a corner (within GRAB px) resizes from it, near a side moves that side,
      // anywhere else draws a new crop from that point.
      const MIN = 40;
      const GRAB = 30;
      let drag = null;
      const at = (e) => {
        const b = area.getBoundingClientRect();
        return { x: Math.min(Math.max(0, e.clientX - b.left), W), y: Math.min(Math.max(0, e.clientY - b.top), H) };
      };
      function grab(p) {
        const nx = Math.abs(p.x - r.x) <= GRAB ? 'l' : Math.abs(p.x - (r.x + r.w)) <= GRAB ? 'r' : '';
        const ny = Math.abs(p.y - r.y) <= GRAB ? 't' : Math.abs(p.y - (r.y + r.h)) <= GRAB ? 'b' : '';
        const inX = p.x >= r.x - GRAB && p.x <= r.x + r.w + GRAB;
        const inY = p.y >= r.y - GRAB && p.y <= r.y + r.h + GRAB;
        if (nx && ny) return ny + nx; // corner
        if (nx && inY) return nx; // side
        if (ny && inX) return ny;
        return 'draw'; // anywhere else: draw the crop afresh
      }
      stage.addEventListener('pointerdown', (e) => {
        if (e.target.closest('.crop-bar')) return;
        e.preventDefault();
        stage.setPointerCapture(e.pointerId);
        const p = at(e);
        drag = { h: grab(p), p0: p, r0: { ...r } };
        box.dataset.active = drag.h;
      });
      stage.addEventListener('pointermove', (e) => {
        if (!drag) return;
        const p = at(e);
        const dx = p.x - drag.p0.x;
        const dy = p.y - drag.p0.y;
        const o = drag.r0;
        let { x, y, w, h } = o;
        if (drag.h === 'draw') {
          if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
          x = Math.min(drag.p0.x, p.x); y = Math.min(drag.p0.y, p.y);
          w = Math.max(MIN, Math.abs(dx)); h = Math.max(MIN, Math.abs(dy));
          x = Math.min(x, W - w); y = Math.min(y, H - h);
        } else if (drag.h === 'move') {
          x = Math.min(Math.max(0, o.x + dx), W - o.w);
          y = Math.min(Math.max(0, o.y + dy), H - o.h);
        } else {
          if (drag.h.includes('l')) { x = Math.min(Math.max(0, o.x + dx), o.x + o.w - MIN); w = o.x + o.w - x; }
          if (drag.h.includes('r')) w = Math.min(Math.max(MIN, o.w + dx), W - o.x);
          if (drag.h.includes('t')) { y = Math.min(Math.max(0, o.y + dy), o.y + o.h - MIN); h = o.y + o.h - y; }
          if (drag.h.includes('b')) h = Math.min(Math.max(MIN, o.h + dy), H - o.y);
        }
        r = { x, y, w, h };
        draw();
      });
      const end = () => { drag = null; delete box.dataset.active; };
      stage.addEventListener('pointerup', end);
      stage.addEventListener('pointercancel', end);
      const onResize = () => layout(true);
      window.addEventListener('resize', onResize);

      function finish(out) {
        window.removeEventListener('resize', onResize);
        wrap.remove();
        URL.revokeObjectURL(url);
        resolve(out);
      }
      wrap.addEventListener('click', (e) => {
        const c = e.target.closest('[data-c]')?.dataset.c;
        if (c === 'rot') { rot = (rot + 270) % 360; src = rotated(img, rot); layout(false); }
        else if (c === 'full') { r = { x: 0, y: 0, w: W, h: H }; draw(); }
        else if (c === 'skip') finish(null);
        else if (c === 'ok') {
          const s = src.width / W;
          const sx = Math.round(r.x * s);
          const sy = Math.round(r.y * s);
          const sw = Math.max(1, Math.round(r.w * s));
          const sh = Math.max(1, Math.round(r.h * s));
          const out = document.createElement('canvas');
          out.width = sw;
          out.height = sh;
          out.getContext('2d').drawImage(src, sx, sy, sw, sh, 0, 0, sw, sh);
          out.toBlob((b) => finish(b ? new File([b], (file.name || 'picture').replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' }) : file), 'image/jpeg', 0.92);
        }
      });
      requestAnimationFrame(() => layout(false));
    }));
  }

  // Crop each picture in turn. A picture the phone can't open goes through unchanged, so the
  // usual "couldn't be opened" message still appears for it.
  async function cropAll(files) {
    const out = [];
    const list = [...files];
    for (let i = 0; i < list.length; i++) {
      let f;
      try { f = await edit(list[i], i + 1, list.length); } catch { f = list[i]; }
      if (f) out.push(f);
    }
    return out;
  }

  return { edit, cropAll };
})();
const cropAll = (files) => ImageCrop.cropAll(files);
