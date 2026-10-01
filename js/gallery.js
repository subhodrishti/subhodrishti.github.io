/* Gallery: the couple's real photos as a looping, phone-shaped story. The
   controls and pause-on-hover/focus keep the playful auto-advance optional. */
(function () {
  const { $, h, get, L, t, reducedMotion } = window.Invite;
  let index = 0, timer = 0, root;

  function openLightbox({ src, alt, title }) {
    const img = $("#lb-img");
    img.src = src;
    img.alt = alt;
    $("#lb-title").textContent = title || "";
    $("#lb-caption").textContent = "";
    $("#lightbox").showModal();
  }

  function stop() { clearTimeout(timer); timer = 0; }
  function schedule() {
    stop();
    if (!reducedMotion.matches && get("photos")?.length > 1) timer = setTimeout(() => show(index + 1), 5600);
  }

  function show(next) {
    const photos = get("photos") || [];
    if (!photos.length || !root) return;
    index = (next + photos.length) % photos.length;
    const photo = photos[index];
    const alt = L(photo.alt), caption = L(photo.caption);
    root.querySelector(".story-phone__photo").replaceChildren(h("img", { src: photo.src, alt, decoding: "async", width: photo.w, height: photo.h }));
    root.querySelector(".story-phone__caption").textContent = caption;
    root.querySelector(".story-phone__comment").textContent = L(photo.comment) || t("gallery.defaultComment");
    root.querySelector(".story-phone__photo").setAttribute("aria-label", t("gallery.openLarger", { label: alt }));
    root.querySelector(".story-phone__count").textContent = t("gallery.storyCount", { current: index + 1, total: photos.length });
    root.querySelectorAll(".story-phone__progress i").forEach((bar, i) => {
      bar.classList.toggle("is-done", i < index);
      bar.classList.toggle("is-active", i === index);
      // Restart the active bar's animation every time the story changes.
      if (i === index) { bar.style.animation = "none"; void bar.offsetWidth; bar.style.animation = ""; }
    });
    const heart = root.querySelector(".story-phone__heart");
    heart.classList.remove("is-popping"); void heart.offsetWidth; heart.classList.add("is-popping");
    schedule();
  }

  function render() {
    const photos = get("photos") || [];
    const list = $("#photos");
    stop(); list.replaceChildren(); root = null;
    $("#photos-empty").hidden = photos.length > 0;
    if (!photos.length) return;
    index %= photos.length;
    root = h("li", { class: "story-phone", onmouseenter: stop, onmouseleave: schedule, onfocusin: stop, onfocusout: schedule },
      h("div", { class: "story-phone__speaker", "aria-hidden": "true" }),
      h("div", { class: "story-phone__screen" },
        h("div", { class: "story-phone__progress", "aria-hidden": "true" }, ...photos.map(() => h("i"))),
        h("div", { class: "story-phone__topline" }, h("span", {}, "S & S"), h("span", { class: "story-phone__count" })),
        h("button", { class: "story-phone__photo", type: "button", onclick: () => openLightbox({ src: photos[index].src, alt: L(photos[index].alt), title: L(photos[index].caption) }), "aria-label": t("gallery.openLarger", { label: L(photos[index].alt) }) }),
        h("div", { class: "story-phone__meta" },
          h("button", { class: "story-phone__heart", type: "button", "aria-label": t("gallery.like"), onclick: (e) => e.currentTarget.classList.toggle("is-liked") }, "♥"),
          h("p", { class: "story-phone__caption" }),
          h("p", { class: "story-phone__comment" }),
        ),
        h("div", { class: "story-phone__nav" },
          h("button", { type: "button", "aria-label": t("gallery.previous"), onclick: () => show(index - 1) }, "‹"),
          h("button", { type: "button", "aria-label": t("gallery.next"), onclick: () => show(index + 1) }, "›"),
        ),
      ),
    );
    list.append(root); show(index);
  }

  window.Invite.gallery = { init: render, render, openLightbox };
})();
