// Crop (and rotate) a picture before it is added to a case. One screen per picture:
// drag the corners to crop, drag inside to move, ⟲ rotates 90°, Full resets, ✓ Use keeps it,
// Don't add leaves it out. cropAll(files) → the pictures to add, as JPEG files.
const ImageCrop = (() => {
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
        <div class="crop-top"><b>Crop${total > 1 ? ` · ${n} of ${total}` : ''}</b><span>Drag the corners · drag inside to move</span></div>
        <div class="crop-stage"><div class="crop-area"><canvas></canvas>
          <div class="crop-box"><i data-h="tl"></i><i data-h="tr"></i><i data-h="bl"></i><i data-h="br"></i></div></div></div>
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
        const sw = stage.clientWidth - 16;
        const sh = stage.clientHeight - 16;
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
        r = keep && r && old.W ? { x: (r.x * W) / old.W, y: (r.y * H) / old.H, w: (r.w * W) / old.W, h: (r.h * H) / old.H } : { x: 0, y: 0, w: W, h: H };
        draw();
      }
      function draw() {
        Object.assign(box.style, { left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px' });
      }

      // dragging: a corner resizes, inside moves
      const MIN = 40;
      let drag = null;
      area.addEventListener('pointerdown', (e) => {
        const h = e.target.dataset?.h;
        if (!h && !e.target.closest('.crop-box')) return;
        e.preventDefault();
        area.setPointerCapture(e.pointerId);
        drag = { h: h || 'move', x0: e.clientX, y0: e.clientY, r0: { ...r } };
      });
      area.addEventListener('pointermove', (e) => {
        if (!drag) return;
        const dx = e.clientX - drag.x0;
        const dy = e.clientY - drag.y0;
        const o = drag.r0;
        let { x, y, w, h } = o;
        if (drag.h === 'move') {
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
      const end = () => { drag = null; };
      area.addEventListener('pointerup', end);
      area.addEventListener('pointercancel', end);
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
