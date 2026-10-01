/* "Our families": the bride's and the groom's side, as on the family's card.
   Each side is a portrait in an arch, then the name, parents and home town. */
(function () {
  const { $, h, get, L, t, reducedMotion } = window.Invite;

  const SVG_NS = "http://www.w3.org/2000/svg";

  // Until the family's portrait arrives, the S&S seal stands in the arch.
  function seal() {
    const svg = document.createElementNS(SVG_NS, "svg");
    const use = document.createElementNS(SVG_NS, "use");
    use.setAttribute("href", "#alpana-seal");
    svg.append(use);
    return h("span", { class: "seal__disc seal__disc--sm family__seal", "aria-hidden": "true" },
      svg, h("span", { class: "seal__mono" }, "S", h("i", {}, "&"), "S"));
  }

  function portrait(p) {
    if (!p) return seal();
    return h("img", {
      class: "family__img", src: p.src, width: p.w, height: p.h,
      alt: L(p.alt), loading: "lazy", decoding: "async",
    });
  }

  function side(f) {
    return h("article", { class: `family family--${f.side}` },
      h("div", { class: "family__frame" }, portrait(f.portrait)),
      h("p", { class: "family__role" }, t(`families.${f.side}`)),
      h("h3", { class: "family__name" }, L(f.name)),
      h("p", { class: "family__parents" }, L(f.parents)),
      f.place && h("p", { class: "family__place" }, L(f.place)),
    );
  }

  function render() {
    const section = $("#families");
    const list = $("#family-list");
    const families = get("families");
    section.hidden = !families?.length;
    if (section.hidden) return;
    const [first, ...rest] = families.map(side);
    list.replaceChildren(first, ...rest.flatMap((el) => [
      h("span", { class: "families__amp", "aria-hidden": "true" }, t("families.joiner")),
      el,
    ]));
    if (reducedMotion.matches) return list.querySelectorAll(".family").forEach((el) => el.classList.add("is-visible"));
    const observer = new IntersectionObserver((entries, obs) => entries.forEach((entry) => {
      if (entry.isIntersecting) { entry.target.classList.add("is-visible"); obs.unobserve(entry.target); }
    }), { threshold: 0.2 });
    list.querySelectorAll(".family").forEach((el) => observer.observe(el));
  }

  function init() { render(); }
  window.Invite.families = { init, render };
})();
