/* The couple, changing outfits in place.
 *
 * Every look is cut out at the same size and floor line, each centred
 * (tools/cutout_avatars.py). The frame is laid out by the couple's core width
 * (js/avatar-frame.js) and wide hems overflow it, so all looks render at one
 * scale. Changes use the pixel transition in the incoming look's palette
 * (js/transitions.js); reduced motion crossfades.
 *
 * A look with a `video` loops as an animated cutout (js/alpha-video.js) once a
 * change into it settles, over its still, which stays as the fallback. The clip
 * loads the first time its look is shown on screen, pauses off-screen, in a
 * hidden tab and while held (hold()), and is what the swirl breaks apart when
 * the guest changes looks.
 */
(function () {
  const { h, get, reducedMotion, alphaVideo } = window.Invite;
  const FRAME = window.INVITE_AVATAR_FRAME || { width: 401, height: 737, coreWidth: 401 };

  function create(container, { initial, onChange } = {}) {
    const looks = get("avatars");
    const layers = new Map();
    const motions = new Map(); // look id -> looping clip, made the first time it plays
    let current = null;
    let running = null;
    let pending = 0;
    let changing = false;
    let held = false;
    let onScreen = false;

    container.classList.add("wardrobe");
    container.style.setProperty("--frame-w", FRAME.width);
    container.style.setProperty("--frame-h", FRAME.height);
    container.style.setProperty("--core-w", FRAME.coreWidth);

    for (const look of looks) {
      const img = h("img", {
        class: "wardrobe__layer", alt: "", width: FRAME.width, height: FRAME.height, decoding: "async",
        // Only the first look loads eagerly; the rest are warmed up by preload().
        "data-src": look.src,
      });
      layers.set(look.id, img);
      container.append(img);
    }
    const fx = h("div", { class: "wardrobe__fx", "aria-hidden": "true" });
    container.append(fx);

    function ensureSrc(img) {
      if (!img.getAttribute("src")) img.src = img.dataset.src;
    }

    /** Stop whatever is running and put every layer back to its resting CSS.
     *  Every clip is hidden except `keep`, the pose about to be swirled away. */
    function settle(keep = null) {
      const r = running;
      running = null;
      r?.cancel();
      fx.replaceChildren();
      for (const [id, img] of layers) {
        img.getAnimations().forEach((a) => a.cancel());
        img.removeAttribute("style");
        img.classList.remove("is-moving");
        img.classList.toggle("is-active", id === current);
      }
      for (const m of motions.values()) {
        m.canvas.getAnimations().forEach((a) => a.cancel());
        if (m !== keep) m.stop();
      }
      delete container.dataset.transition;
    }

    /** Loop the current look's clip, if it has one and may play now. */
    function play() {
      if (changing || held || !onScreen || document.hidden || !alphaVideo?.supported()) return;
      const look = looks.find((l) => l.id === current);
      if (!look?.video) return;
      let m = motions.get(current);
      if (!m) {
        m = alphaVideo.create({ src: look.video, width: FRAME.width, height: FRAME.height });
        container.insertBefore(m.canvas, fx);
        container.append(m.video);
        motions.set(current, m);
      }
      m.start();
    }

    function pauseMotion() {
      for (const m of motions.values()) m.pause();
    }

    const kindFor = () => (reducedMotion.matches ? "fade" : "pixel");

    /** Change into a look. */
    function show(id, { instant = false } = {}) {
      if (!layers.has(id) || id === current) return;
      const next = layers.get(id);
      ensureSrc(next);
      const prevId = current;
      const prev = prevId && layers.get(prevId);
      const prevMotion = prevId && motions.get(prevId);
      const keep = prevMotion?.showing && !instant ? prevMotion : null;
      keep?.pause();
      settle(keep);
      current = id;
      container.dataset.look = id;
      onChange?.(id);
      if (!prev || instant) { settle(); changing = false; play(); return; }
      changing = true;

      const palette = looks.find((l) => l.id === id)?.palette;
      const ticket = ++pending;
      const run = () => {
        if (ticket !== pending || current !== id) return; // a newer change took over
        const kind = kindFor();
        container.dataset.transition = kind;
        container.dataset.lastTransition = kind; // read by tools/smoke.js
        // Break apart the pose on screen: the clip's frame if it was playing.
        const from = keep?.showing ? keep.canvas : prev;
        if (from === prev) prev.classList.add("is-moving");
        else keep.snap(); // the transition reads the canvas right now
        next.classList.add("is-moving", "is-active");
        const r = window.Invite.transitions[kind]({ container, fx, from, to: next, palette });
        running = r;
        r.finished.then(() => {
          if (running !== r) return;
          settle();
          changing = false;
          play();
        });
      };
      // Wait for the new outfit to decode so no transition reveals a blank.
      (next.decode ? next.decode() : Promise.resolve()).then(run, run);
    }

    /** Fetch the other outfits in the background once the page is calm. */
    function preload() {
      for (const img of layers.values()) ensureSrc(img);
    }

    /** While held, the current look stays still (the hero holds Biye under the paan leaves). */
    function hold(on) {
      held = !!on;
      if (held) pauseMotion();
      else play();
    }

    if (looks.some((l) => l.video)) {
      new IntersectionObserver(([e]) => {
        onScreen = e.isIntersecting;
        if (onScreen) play();
        else pauseMotion();
      }).observe(container);
      document.addEventListener("visibilitychange", () => (document.hidden ? pauseMotion() : play()));
      reducedMotion.addEventListener?.("change", () => {
        if (reducedMotion.matches) motions.forEach((m) => m.stop());
        else play();
      });
    }

    const first = layers.has(initial) ? initial : looks[0].id;
    ensureSrc(layers.get(first));
    show(first, { instant: true });

    return {
      show, preload, hold,
      get current() { return current; },
      get busy() { return !!running; },
    };
  }

  window.Invite.wardrobe = { create };
})();
