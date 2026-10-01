/* The living backdrop.
 *
 * Behind the hero, gallery, events, polls and RSVP sections: slowly drifting
 * aurora colour, an alpana lattice revealed by a soft light that follows the
 * pointer (and wanders on its own when nobody is moving), and gold line-art
 * objects from a Bengali wedding floating at different depths. They shift
 * with the pointer, the phone's tilt and the scroll, glow when the pointer
 * comes near, and breathe with the shehnai while it plays. A kantha running
 * stitch sews itself along section edges as they scroll into view, and gold
 * buttons lean towards the cursor.
 *
 * One requestAnimationFrame loop drives everything, only while a backdrop is
 * on screen and the tab is visible. Movement uses transforms (the lens trick
 * below keeps the light and lattice off the paint path). Under reduced motion
 * everything is placed once and stays still.
 */
(function () {
  const { $$, h, t, reducedMotion } = window.Invite;
  const SVG_NS = "http://www.w3.org/2000/svg";
  const LENS = 560; // px diameter of the light that follows the pointer

  /*
   * Where the objects sit, per section, in % of the section box.
   *   [motif, x, y, size px, depth]   depth: 0.3 far … 1.2 near (moves more)
   * `phone` lists the few that stay on narrow screens, pushed to the edges.
   * The hero's conch is a button: tap it to blow the shankh.
   */
  const LAYOUT = {
    hero: {
      tone: "night",
      stitch: null,
      desk: [
        ["shankha", 57, 20, 72, 0.7, "shankh"], ["topor", 94, 17, 60, 0.9, "story:topor"], ["shehnai", 6, 15, 66, 0.6],
        ["kulo", 5, 58, 76, 0.5], ["fish", 57, 72, 66, 0.8], ["pradip", 95, 55, 50, 1.1],
        ["paan", 94, 86, 50, 1.0, "story:paan"], ["bangles", 8, 88, 54, 0.7], ["kouto", 3, 36, 42, 1.2], ["ghot", 97, 36, 50, 0.4],
      ],
      phone: [
        ["shankha", 88, 6, 54, 0.7, "shankh"], ["topor", 9, 9, 44, 0.9, "story:topor"], ["fish", 92, 30, 46, 0.8],
        ["kulo", 7, 42, 50, 0.5], ["pradip", 93, 60, 38, 1.1], ["paan", 6, 72, 38, 1.0, "story:paan"], ["bangles", 92, 88, 40, 0.7],
      ],
    },
    gallery: {
      tone: "paper", stitch: "sindoor",
      desk: [["topor", 12, 46, 64, 0.6], ["ghot", 88, 40, 66, 0.8], ["paan", 22, 82, 40, 1.0], ["fish", 78, 84, 50, 0.5]],
      phone: [["topor", 8, 14, 40, 0.6], ["ghot", 92, 14, 42, 0.8]],
    },
    events: {
      tone: "emerald", stitch: "gold",
      desk: [
        ["fish", 5, 8, 60, 0.7], ["kulo", 95, 14, 64, 0.5], ["paan", 4, 55, 44, 1.0],
        ["pradip", 96, 62, 44, 1.1], ["topor", 95, 92, 50, 0.6], ["bangles", 5, 90, 46, 0.8],
      ],
      phone: [["fish", 90, 1.5, 40, 0.7], ["kulo", 9, 1.5, 40, 0.5]],
    },
    polls: {
      tone: "paper", stitch: "sindoor",
      desk: [["kulo", 12, 42, 70, 0.6], ["shehnai", 88, 34, 66, 0.8], ["fish", 86, 80, 50, 1.0], ["kouto", 14, 82, 44, 0.9]],
      phone: [["kulo", 8, 8, 40, 0.6], ["shehnai", 92, 8, 42, 0.8]],
    },
    rsvp: {
      tone: "night", stitch: "gold",
      desk: [
        ["kouto", 15, 30, 64, 0.8], ["bangles", 85, 24, 72, 0.7], ["pradip", 12, 76, 52, 1.1],
        ["shankha", 88, 72, 64, 0.6], ["paan", 22, 52, 44, 1.0], ["ghot", 80, 50, 56, 0.4],
      ],
      phone: [["kouto", 90, 3, 40, 0.8], ["bangles", 10, 3, 42, 0.7]],
    },
  };
  const SECTION = { hero: ".hero", gallery: "#gallery", events: "#events", polls: "#polls", rsvp: "#rsvp" };

  const narrow = window.matchMedia("(max-width: 720px)");
  const finePointer = window.matchMedia("(pointer: fine)");
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  let backdrops = [];
  let raf = 0;
  const pointer = { x: 0, y: 0, cx: -9999, cy: -9999, active: false, last: -1e9 };
  const eased = { x: 0, y: 0 };
  const tilt = { x: 0, y: 0, on: false };
  let pulse = 0;

  /** Copy a motif <symbol> into its own inline <svg>, so each copy can animate (the lamp flame). */
  function motifSvg(id) {
    const sym = document.getElementById(`m-${id}`);
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", sym.getAttribute("viewBox"));
    svg.setAttribute("class", "motif__art");
    svg.setAttribute("aria-hidden", "true");
    for (const node of sym.children) svg.append(node.cloneNode(true));
    return svg;
  }

  function makeMotif(spec, front) {
    const [id, x, y, size, depth, action] = spec;
    const el = action
      ? h("button", { class: "motif motif--action", type: "button", dataset: { action }, "aria-label": action === "shankh" ? t("ambient.shankh") : t("ambient.openStory") })
      : h("span", { class: "motif" });
    el.style.setProperty("--s", `${size}px`);
    el.style.left = `${x}%`;
    el.style.top = `${y}%`;
    el.append(motifSvg(id));
    if (action === "shankh") {
      el.addEventListener("click", () => {
        el.classList.remove("is-ringing");
        void el.offsetWidth;
        el.classList.add("is-ringing");
        window.Invite.audio.blow?.();
      });
    }
    if (action?.startsWith("story:")) el.addEventListener("click", () => window.Invite.rituals?.openStory(action.slice(6)));
    (action ? front : null)?.append(el);
    return { el, x, y, depth, action, phase: rand(0, Math.PI * 2), speed: rand(0.6, 1.1), rot: rand(-14, 14), near: 0 };
  }

  function kantha(kind) {
    // A running stitch along a gentle wave, drawn left to right as it scrolls in.
    let d = "M0 12";
    for (let x = 0; x < 1200; x += 100) d += ` Q${x + 25} 3 ${x + 50} 12 T${x + 100} 12`;
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("class", `kantha kantha--${kind}`);
    svg.setAttribute("viewBox", "0 0 1200 24");
    svg.setAttribute("preserveAspectRatio", "none");
    svg.setAttribute("aria-hidden", "true");
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", d);
    path.setAttribute("vector-effect", "non-scaling-stroke");
    svg.append(path);
    return svg;
  }

  function place(bd) {
    // (Re)build the motif set for the current screen width.
    bd.back.replaceChildren();
    bd.front.replaceChildren();
    const specs = narrow.matches ? bd.cfg.phone : bd.cfg.desk;
    bd.motifs = specs.map((spec) => {
      const m = makeMotif(spec, bd.front);
      if (!m.action) bd.back.append(m.el);
      return m;
    });
    sizeLens(bd);
  }

  function sizeLens(bd) {
    const r = bd.section.getBoundingClientRect();
    bd.w = r.width;
    bd.h = r.height;
    bd.pattern.style.width = `${r.width}px`;
    bd.pattern.style.height = `${r.height}px`;
  }

  function build() {
    for (const [key, cfg] of Object.entries(LAYOUT)) {
      const section = document.querySelector(SECTION[key]);
      if (!section) continue;
      const pattern = h("div", { class: "ambient__pattern" });
      const glow = h("div", { class: "ambient__glow" });
      const lens = h("div", { class: "ambient__lens" }, glow, pattern);
      const back = h("div", { class: "ambient__motifs" });
      const layer = h("div", { class: `ambient ambient--${cfg.tone}`, "aria-hidden": "true" },
        h("div", { class: "ambient__aurora" }, h("span"), h("span"), h("span")),
        h("div", { class: "ambient__lattice" }),
        lens, back,
      );
      const front = h("div", { class: `ambient ambient--front ambient--${cfg.tone}` });
      section.classList.add("has-ambient");
      section.prepend(layer);
      section.append(front);
      if (cfg.stitch) section.append(kantha(cfg.stitch));
      const bd = {
        key, cfg, section, layer, front, back, lens, pattern, motifs: [], visible: false,
        seed: rand(0, 10), lx: 0, ly: 0, w: 0, h: 0,
      };
      place(bd);
      backdrops.push(bd);
    }
  }

  /* ---------------------------------------------------------------- loop */
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const idle = now - pointer.last > 4000;
    const tx = tilt.on ? tilt.x : idle ? 0 : pointer.x;
    const ty = tilt.on ? tilt.y : idle ? 0 : pointer.y;
    eased.x += (tx - eased.x) * 0.05;
    eased.y += (ty - eased.y) * 0.05;
    const level = window.Invite.audio.level?.() || 0;
    pulse += (level - pulse) * 0.15;
    const vh = window.innerHeight;
    for (const bd of backdrops) if (bd.visible) step(bd, now, idle, vh);
  }

  function step(bd, now, idle, vh) {
    const r = bd.section.getBoundingClientRect();
    const s = now / 1000;
    // The light: under the pointer, or wandering through the visible part.
    let lx, ly;
    if (!idle && pointer.active && pointer.cy > r.top && pointer.cy < r.bottom) {
      lx = pointer.cx - r.left;
      ly = pointer.cy - r.top;
    } else {
      lx = r.width * (0.5 + 0.36 * Math.sin(s / 5.2 + bd.seed));
      ly = clamp(-r.top, 0, r.height) + vh * (0.45 + 0.25 * Math.cos(s / 6.3 + bd.seed));
    }
    bd.lx += (lx - bd.lx) * 0.07;
    bd.ly += (ly - bd.ly) * 0.07;
    bd.lens.style.transform = `translate3d(${bd.lx - LENS / 2}px, ${bd.ly - LENS / 2}px, 0) scale(${1 + pulse * 0.25})`;
    bd.pattern.style.transform = `translate3d(${LENS / 2 - bd.lx}px, ${LENS / 2 - bd.ly}px, 0)`;

    const scroll = r.top + r.height / 2 - vh / 2;
    for (const m of bd.motifs) {
      const d = m.depth;
      const bob = Math.sin(s * m.speed + m.phase) * (5 + pulse * 8) * d;
      const sway = Math.sin(s * 0.7 * m.speed + m.phase) * 4;
      const px = -eased.x * 24 * d;
      const py = -eased.y * 18 * d - scroll * 0.05 * d;
      // Glow when the pointer comes near.
      const cx = r.left + (r.width * m.x) / 100;
      const cy = r.top + (r.height * m.y) / 100;
      const dist = Math.hypot(pointer.cx - cx, pointer.cy - cy);
      const near = pointer.active && !idle ? clamp(1 - dist / 220, 0, 1) : 0;
      m.near += (Math.max(near, pulse * 0.5) - m.near) * 0.12;
      m.el.style.transform = `translate3d(${px}px, ${py + bob}px, 0) rotate(${m.rot + sway}deg) scale(${1 + m.near * 0.16})`;
      m.el.style.setProperty("--near", m.near.toFixed(3));
    }
  }

  function start() {
    if (raf || reducedMotion.matches || document.hidden) return;
    if (!backdrops.some((b) => b.visible)) return;
    raf = requestAnimationFrame(frame);
  }
  function stop() {
    cancelAnimationFrame(raf);
    raf = 0;
  }

  /* ------------------------------------------------------------- inputs */
  function onPointer(e) {
    pointer.cx = e.clientX;
    pointer.cy = e.clientY;
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
    pointer.active = true;
    pointer.last = performance.now();
  }

  function onTilt(e) {
    if (e.gamma == null || e.beta == null || finePointer.matches) return;
    tilt.on = true;
    tilt.x = clamp(e.gamma / 30, -1, 1);
    tilt.y = clamp((e.beta - 45) / 30, -1, 1);
  }

  /** iOS asks before sharing tilt; the request must come from a tap (the seal). */
  function requestTilt() {
    const DOE = window.DeviceOrientationEvent;
    if (DOE && typeof DOE.requestPermission === "function") {
      DOE.requestPermission().then((s) => { if (s === "granted") addEventListener("deviceorientation", onTilt); }).catch(() => {});
    }
  }

  /** Gold buttons lean a little towards the cursor. */
  function magnetic() {
    if (!finePointer.matches || reducedMotion.matches) return;
    document.addEventListener("pointermove", (e) => {
      const btn = e.target.closest?.(".btn--gold, .chip");
      $$(".is-magnet").forEach((b) => { if (b !== btn) { b.classList.remove("is-magnet"); b.style.removeProperty("--mx"); b.style.removeProperty("--my"); } });
      if (!btn) return;
      const r = btn.getBoundingClientRect();
      btn.classList.add("is-magnet");
      btn.style.setProperty("--mx", `${((e.clientX - r.left) / r.width - 0.5) * 8}px`);
      btn.style.setProperty("--my", `${((e.clientY - r.top) / r.height - 0.5) * 6}px`);
    }, { passive: true });
  }

  function init() {
    build();
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const bd = backdrops.find((b) => b.section === entry.target);
        if (bd) bd.visible = entry.isIntersecting;
      }
      backdrops.some((b) => b.visible) ? start() : stop();
    }, { rootMargin: "120px 0px" });
    backdrops.forEach((b) => io.observe(b.section));

    // Stitch each kantha line once, as its section arrives.
    const sew = new IntersectionObserver((entries, obs) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.querySelector(":scope > .kantha")?.classList.add("is-stitched");
        obs.unobserve(entry.target);
      }
    }, { threshold: 0.08 });
    backdrops.forEach((b) => sew.observe(b.section));

    addEventListener("pointermove", onPointer, { passive: true });
    document.documentElement.addEventListener("pointerleave", () => { pointer.active = false; });
    addEventListener("deviceorientation", onTilt);
    let resize;
    addEventListener("resize", () => { clearTimeout(resize); resize = setTimeout(() => backdrops.forEach(sizeLens), 150); });
    narrow.addEventListener?.("change", () => backdrops.forEach(place));
    document.addEventListener("visibilitychange", () => (document.hidden ? stop() : start()));
    reducedMotion.addEventListener?.("change", () => (reducedMotion.matches ? stop() : start()));
    magnetic();
  }

  function render() {
    // Only the conch button has words; keep its label in the current language.
    $$(".motif--action").forEach((b) => b.setAttribute("aria-label", b.dataset.action === "shankh" ? t("ambient.shankh") : t("ambient.openStory")));
  }

  window.Invite.ambient = { init, render, requestTilt };
})();
