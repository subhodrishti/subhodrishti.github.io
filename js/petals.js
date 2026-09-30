/* Falling marigold and rose petals on a single fixed canvas.
   Density scales with screen area and is capped; the loop pauses when the
   tab is hidden, and never starts for people who prefer reduced motion. */
(function () {
  const { reducedMotion, store } = window.Invite;

  // Marigold, deep marigold, blush rose, gold, and the odd emerald leaf.
  const KINDS = [
    { color: "#f2a531", shade: "#d9801a", w: 1, weight: 4 },
    { color: "#e8892a", shade: "#c2651a", w: 1, weight: 2 },
    { color: "#f4d3c4", shade: "#e2aa98", w: 1.25, weight: 3 },
    { color: "#e7c65a", shade: "#b8911f", w: 0.9, weight: 2 },
    { color: "#1f7a70", shade: "#0f5257", w: 0.8, weight: 1, leaf: true },
  ];
  const BAG = KINDS.flatMap((k) => Array(k.weight).fill(k));

  let canvas, ctx, petals = [], raf = 0, running = false, last = 0;
  let W = 0, H = 0, dpr = 1;

  function rand(a, b) { return a + Math.random() * (b - a); }

  function spawn(atTop) {
    const kind = BAG[(Math.random() * BAG.length) | 0];
    const size = rand(7, 13) * kind.w;
    return {
      kind, size,
      x: rand(-20, W + 20),
      y: atTop ? rand(-60, -10) : rand(-H, H),
      vy: rand(22, 48),            // px per second
      sway: rand(18, 42),          // horizontal drift amplitude
      swaySpeed: rand(0.4, 1.1),
      phase: rand(0, Math.PI * 2),
      rot: rand(0, Math.PI * 2),
      vr: rand(-1.2, 1.2),
      flip: rand(0, Math.PI * 2),  // 3D tumble, faked with scaleY
      vf: rand(1.2, 3),
    };
  }

  function drawPetal(p) {
    const { size, kind } = p;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.scale(1, Math.max(0.15, Math.abs(Math.cos(p.flip))));
    const grad = ctx.createLinearGradient(0, -size, 0, size);
    grad.addColorStop(0, kind.color);
    grad.addColorStop(1, kind.shade);
    ctx.fillStyle = grad;
    ctx.beginPath();
    if (kind.leaf) {
      ctx.moveTo(0, -size);
      ctx.quadraticCurveTo(size * 0.55, 0, 0, size);
      ctx.quadraticCurveTo(-size * 0.55, 0, 0, -size);
    } else {
      // Rounded teardrop with a notch at the tip, like a torn marigold petal.
      ctx.moveTo(0, size);
      ctx.bezierCurveTo(size * 0.9, size * 0.4, size * 0.7, -size * 0.8, size * 0.15, -size);
      ctx.lineTo(0, -size * 0.8);
      ctx.lineTo(-size * 0.15, -size);
      ctx.bezierCurveTo(-size * 0.7, -size * 0.8, -size * 0.9, size * 0.4, 0, size);
    }
    ctx.fill();
    ctx.restore();
  }

  function frame(t) {
    const dt = Math.min(0.05, (t - last) / 1000 || 0.016);
    last = t;
    ctx.clearRect(0, 0, W, H);
    ctx.globalAlpha = 0.9;
    for (const p of petals) {
      p.phase += p.swaySpeed * dt;
      p.y += p.vy * dt;
      p.x += Math.sin(p.phase) * p.sway * dt;
      p.rot += p.vr * dt;
      p.flip += p.vf * dt;
      if (p.y > H + 30) Object.assign(p, spawn(true));
      drawPetal(p);
    }
    raf = requestAnimationFrame(frame);
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const target = Math.max(12, Math.min(36, Math.round((W * H) / 42000)));
    while (petals.length < target) petals.push(spawn(false));
    petals.length = target;
  }

  function start() {
    if (running || reducedMotion.matches || !canvas) return;
    running = true;
    canvas.hidden = false;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }

  function stop(clear = true) {
    running = false;
    cancelAnimationFrame(raf);
    if (clear && ctx) ctx.clearRect(0, 0, W, H);
  }

  function enabled() { return store.get("petals", true) && !reducedMotion.matches; }

  function init() {
    canvas = document.getElementById("petals");
    if (!canvas) return;
    ctx = canvas.getContext("2d");
    resize();
    let t;
    window.addEventListener("resize", () => { clearTimeout(t); t = setTimeout(resize, 150); });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) stop(false);
      else if (enabled() && window.Invite.revealed) start();
    });
    reducedMotion.addEventListener?.("change", () => (enabled() ? start() : stop()));
  }

  function setEnabled(on) {
    store.set("petals", on);
    on ? start() : stop();
  }

  window.Invite.petals = { init, start, stop, enabled, setEnabled };
})();
