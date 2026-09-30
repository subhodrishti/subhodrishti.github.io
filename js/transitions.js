/* Transitions between the couple's looks.
 *
 * One transition everywhere: the outgoing outfit breaks into pixels that
 * swirl around the couple in 3D, take on the incoming ceremony's colours
 * (avatars[].palette in js/config.js), then settle into the new outfit.
 * Reduced motion gets a plain crossfade.
 *
 * Each takes { container, fx, from, to, palette } — the wardrobe box, an
 * overlay for effects, the outgoing and incoming <img> layers and the colours —
 * and returns { finished, cancel }. Cancelling mid-way leaves clean CSS state.
 */
(function () {
  const { h } = window.Invite;

  const DURATION = 1900;
  const FALLBACK_PALETTE = ["#f2a531", "#e8892a", "#f7c948", "#d9531e"];

  /** Bundle animations into one handle; cancel also removes temporary nodes. */
  function group(anims, nodes = [], onCancel) {
    let done = false;
    const cleanup = () => { if (!done) { done = true; nodes.forEach((n) => n.remove()); } };
    return {
      finished: Promise.all(anims.map((a) => a.finished)).then(cleanup, cleanup),
      cancel() { anims.forEach((a) => a.cancel()); onCancel?.(); cleanup(); },
    };
  }

  /* ------------------------------------------------------------------ fade */
  function fade({ from, to }) {
    const o = { duration: 320, easing: "ease", fill: "both" };
    return group([
      from.animate([{ opacity: 1 }, { opacity: 0 }], o),
      to.animate([{ opacity: 0 }, { opacity: 1 }], o),
    ]);
  }

  /* ----------------------------------------------------------------- pixel */
  const rand = (a, b) => a + Math.random() * (b - a);

  function toRgb(hex) {
    const n = parseInt(hex.replace("#", ""), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function sample(img, w, hgt, step) {
    const c = document.createElement("canvas");
    c.width = w; c.height = hgt;
    const g = c.getContext("2d", { willReadFrequently: true });
    g.drawImage(img, 0, 0, w, hgt);
    const data = g.getImageData(0, 0, w, hgt).data; // throws on file:// (tainted)
    const pts = [];
    for (let y = 0; y < hgt; y += step) {
      for (let x = 0; x < w; x += step) {
        const i = (y * w + x) * 4;
        if (data[i + 3] > 140) pts.push({ x, y, r: data[i], g: data[i + 1], b: data[i + 2] });
      }
    }
    return pts;
  }

  function pixel(args) {
    const { container, fx, from, to } = args;
    const palette = (args.palette?.length ? args.palette : FALLBACK_PALETTE).map(toRgb);
    const box = to.getBoundingClientRect();
    const base = container.getBoundingClientRect();
    const w = Math.round(box.width), hgt = Math.round(box.height);
    if (w < 2 || hgt < 2) return fade(args);
    // About 2,400 pixels whatever the frame size; never finer than 2px.
    const step = Math.max(2, Math.round(Math.sqrt((w * hgt * 0.4) / 2400)));
    let src, dst;
    try {
      src = sample(from, w, hgt, step);
      dst = sample(to, w, hgt, step);
    } catch {
      return fade(args); // pixels unreadable (e.g. opened from file://)
    }
    if (!src.length || !dst.length) return fade(args);

    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const canvas = h("canvas", { class: "fx-canvas" });
    canvas.width = w * dpr; canvas.height = hgt * dpr;
    Object.assign(canvas.style, { left: `${box.left - base.left}px`, top: `${box.top - base.top}px`, width: `${w}px`, height: `${hgt}px` });
    fx.append(canvas);
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);

    // Pair every pixel with a source and a target, top-to-bottom, so they
    // travel roughly the way the outfits are laid out.
    const n = Math.max(src.length, dst.length);
    const cx = w / 2, cy = hgt * 0.5, f = w * 1.8;
    const parts = new Array(n);
    for (let i = 0; i < n; i++) {
      const s = src[Math.floor((i * src.length) / n)];
      const d = dst[Math.floor((i * dst.length) / n)];
      const a = rand(0, Math.PI * 2), rr = Math.sqrt(Math.random());
      parts[i] = {
        s, d, m: palette[i % palette.length],
        // a point in a swirling ellipsoid around the couple
        mx: cx + Math.cos(a) * rr * w * 0.42,
        my: cy + rand(-0.42, 0.38) * hgt,
        mz: Math.sin(a) * rr * w * 0.42,
        k: rand(0.8, 1.6), // size factor mid-flight
      };
    }

    const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    const out = (t) => 1 - Math.pow(1 - t, 3);
    const mix = (a, b, t) => a + (b - a) * t;

    let raf = 0, t0 = 0, resolve;
    const finished = new Promise((r) => (resolve = r));
    const o = { duration: DURATION, fill: "both" };
    const anims = [
      from.animate([{ opacity: 1 }, { opacity: 0, offset: 0.16 }, { opacity: 0 }], o),
      to.animate([{ opacity: 0 }, { opacity: 0, offset: 0.8 }, { opacity: 1 }], o),
    ];

    function frame(now) {
      if (!t0) t0 = now;
      const p = Math.min(1, (now - t0) / DURATION);
      const th = Math.PI * 2 * ease(p); // one full turn of the cloud
      const cos = Math.cos(th), sin = Math.sin(th);
      ctx.clearRect(0, 0, w, hgt);
      ctx.globalAlpha = p < 0.85 ? 1 : 1 - (p - 0.85) / 0.15;
      for (const q of parts) {
        let x, y, z, cr, cg, cb, size;
        if (p < 0.5) {
          const e = out(p / 0.5), c = Math.min(1, p / 0.3);
          x = mix(q.s.x, q.mx, e); y = mix(q.s.y, q.my, e); z = q.mz * e;
          cr = mix(q.s.r, q.m[0], c); cg = mix(q.s.g, q.m[1], c); cb = mix(q.s.b, q.m[2], c);
          size = step * mix(1, q.k, e);
        } else {
          const e = ease((p - 0.5) / 0.5), c = Math.max(0, Math.min(1, (p - 0.6) / 0.35));
          x = mix(q.mx, q.d.x, e); y = mix(q.my, q.d.y, e); z = q.mz * (1 - e);
          cr = mix(q.m[0], q.d.r, c); cg = mix(q.m[1], q.d.g, c); cb = mix(q.m[2], q.d.b, c);
          size = step * mix(q.k, 1, e);
        }
        const dx = x - cx;
        const rx = dx * cos - z * sin, rz = dx * sin + z * cos;
        const sc = f / (f + rz);
        const sz = size * sc;
        ctx.fillStyle = `rgb(${cr | 0},${cg | 0},${cb | 0})`;
        ctx.fillRect(cx + rx * sc - sz / 2, cy + (y - cy) * sc - sz / 2, sz, sz);
      }
      if (p < 1) raf = requestAnimationFrame(frame);
      else { canvas.remove(); resolve(); }
    }
    raf = requestAnimationFrame(frame);

    const g = group(anims, [canvas], () => { cancelAnimationFrame(raf); resolve(); });
    return { finished: Promise.all([finished, g.finished]), cancel: g.cancel };
  }

  window.Invite.transitions = { fade, pixel };
})();
