/* The couple, changing outfits in place.
 *
 * Every look is cut out at the same size and floor line, each centred
 * (tools/cutout_avatars.py). The frame is laid out by the couple's core width
 * (js/avatar-frame.js) and wide hems overflow it, so all looks render at one
 * scale. Changes use the pixel transition in the incoming look's palette
 * (js/transitions.js); reduced motion crossfades.
 */
(function () {
  const { h, get, reducedMotion } = window.Invite;
  const FRAME = window.INVITE_AVATAR_FRAME || { width: 401, height: 737, coreWidth: 401 };

  function create(container, { initial, onChange } = {}) {
    const looks = get("avatars");
    const layers = new Map();
    let current = null;
    let running = null;
    let pending = 0;

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

    /** Stop whatever is running and put every layer back to its resting CSS. */
    function settle() {
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
      delete container.dataset.transition;
    }

    const kindFor = () => (reducedMotion.matches ? "fade" : "pixel");

    /** Change into a look. */
    function show(id, { instant = false } = {}) {
      if (!layers.has(id) || id === current) return;
      const next = layers.get(id);
      ensureSrc(next);
      const prevId = current;
      const prev = prevId && layers.get(prevId);
      settle();
      current = id;
      container.dataset.look = id;
      onChange?.(id);
      if (!prev || instant) { settle(); return; }

      const palette = looks.find((l) => l.id === id)?.palette;
      const ticket = ++pending;
      const run = () => {
        if (ticket !== pending || current !== id) return; // a newer change took over
        const kind = kindFor();
        container.dataset.transition = kind;
        container.dataset.lastTransition = kind; // read by tools/smoke.js
        prev.classList.add("is-moving");
        next.classList.add("is-moving", "is-active");
        const r = window.Invite.transitions[kind]({ container, fx, from: prev, to: next, palette });
        running = r;
        r.finished.then(() => { if (running === r) settle(); });
      };
      // Wait for the new outfit to decode so no transition reveals a blank.
      (next.decode ? next.decode() : Promise.resolve()).then(run, run);
    }

    /** Fetch the other outfits in the background once the page is calm. */
    function preload() {
      for (const img of layers.values()) ensureSrc(img);
    }

    const first = layers.has(initial) ? initial : looks[0].id;
    ensureSrc(layers.get(first));
    show(first, { instant: true });

    return {
      show, preload,
      get current() { return current; },
      get busy() { return !!running; },
    };
  }

  window.Invite.wardrobe = { create };
})();
