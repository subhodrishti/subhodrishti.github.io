/* Gallery: the couple's real photos in a masonry column list, with a
   lightbox. Until photos are added it shows a "coming soon" note. */
(function () {
  const { $, h, get, L, t } = window.Invite;

  function openLightbox({ src, alt, title }) {
    const img = $("#lb-img");
    img.src = src;
    img.alt = alt;
    $("#lb-title").textContent = title || "";
    $("#lb-caption").textContent = "";
    $("#lightbox").showModal();
  }

  function render() {
    const photos = get("photos") || [];
    const list = $("#photos");
    list.replaceChildren();
    $("#photos-empty").hidden = photos.length > 0;
    for (const p of photos) {
      const alt = L(p.alt);
      const caption = L(p.caption);
      list.append(h("li", {},
        h("figure", { style: "margin:0" },
          h("button", {
            type: "button", "aria-label": t("gallery.openLarger", { label: alt }),
            onclick: () => openLightbox({ src: p.src, alt, title: caption }),
          }, h("img", { src: p.src, alt, loading: "lazy", decoding: "async", width: p.w, height: p.h })),
          caption ? h("figcaption", {}, caption) : null,
        ),
      ));
    }
  }

  window.Invite.gallery = { init: render, render, openLightbox };
})();
