/* One-shot confetti burst in the wedding palette. The canvas is created on
   demand and removed when the last piece has fallen. */
(function () {
  const COLORS = ["#d4af37", "#f1dc94", "#0f5257", "#1b3b5f", "#fdfbf7", "#f2a531"];

  function burst(origin) {
    if (window.Invite.reducedMotion.matches) return;
    const canvas = document.createElement("canvas");
    canvas.className = "confetti";
    canvas.setAttribute("aria-hidden", "true");
    document.body.append(canvas);
    const ctx = canvas.getContext("2d");
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = window.innerWidth, H = window.innerHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    const ox = origin?.x ?? W / 2;
    const oy = origin?.y ?? H * 0.6;
    const count = W < 600 ? 110 : 180;
    const pieces = Array.from({ length: count }, () => {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.9;
      const speed = 380 + Math.random() * 520;
      return {
        x: ox, y: oy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        w: 5 + Math.random() * 6,
        h: 8 + Math.random() * 8,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 12,
        tilt: Math.random() * Math.PI,
        round: Math.random() < 0.25,
        color: COLORS[(Math.random() * COLORS.length) | 0],
      };
    });

    let last = performance.now();
    const began = last;
    function frame(t) {
      const dt = Math.min(0.033, (t - last) / 1000);
      last = t;
      ctx.clearRect(0, 0, W, H);
      let alive = 0;
      const fade = Math.max(0, 1 - Math.max(0, t - began - 2600) / 1200);
      for (const p of pieces) {
        p.vy += 900 * dt;          // gravity
        p.vx *= 1 - 1.6 * dt;      // air drag
        p.vy *= 1 - 0.9 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        p.tilt += 8 * dt;
        if (p.y < H + 20) alive++;
        ctx.save();
        ctx.globalAlpha = fade;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        if (p.round) {
          ctx.beginPath();
          ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.scale(1, Math.cos(p.tilt));
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        }
        ctx.restore();
      }
      if (alive && fade > 0) requestAnimationFrame(frame);
      else canvas.remove();
    }
    requestAnimationFrame(frame);
  }

  window.Invite.confetti = { burst };
})();
