/* Family contacts: a phone button in the top bar opens them in a dialog, and
   the same list sits under the RSVP form. Each number shows a Call and/or a
   WhatsApp button, as `contacts[].numbers[]` says. Numbers still written as a
   placeholder ("+91…") are skipped, and with nobody left to show, both stay hidden. */
(function () {
  const { $, h, get, L, t } = window.Invite;

  const SVG_NS = "http://www.w3.org/2000/svg";
  const SIDES = ["groom", "bride"];

  function icon(id) {
    const svg = document.createElementNS(SVG_NS, "svg");
    const use = document.createElementNS(SVG_NS, "use");
    svg.setAttribute("aria-hidden", "true");
    use.setAttribute("href", `#${id}`);
    svg.append(use);
    return svg;
  }

  /** tel: and wa.me links for one number; null where that number doesn't take it. */
  function links(n) {
    const digits = String(n.number || "").replace(/\D/g, "");
    if (digits.length < 7) return { call: null, whatsapp: null }; // still a placeholder
    const intl = digits.length === 10 ? `91${digits}` : digits; // a bare Indian mobile number
    const plus = String(n.number).trim().startsWith("+") || intl !== digits;
    return {
      call: n.call ? `tel:${plus ? "+" : ""}${intl}` : null,
      whatsapp: n.whatsapp ? `https://wa.me/${intl}` : null,
    };
  }

  function usable(c) {
    return (c.numbers || []).filter((n) => { const l = links(n); return l.call || l.whatsapp; });
  }

  /** Contacts with at least one number that can be called or messaged. */
  function list() {
    return (get("contacts") || []).filter((c) => c.name && usable(c).length);
  }

  function number(c, n) {
    const { call, whatsapp } = links(n);
    const vars = { name: c.name, number: n.number };
    return h("li", { class: "contact__number" },
      h("span", { class: "contact__digits", dir: "ltr" }, n.number),
      h("span", { class: "contact__actions" },
        call ? h("a", { class: "contact__btn contact__btn--call", href: call, "aria-label": t("contact.call", vars) }, icon("i-phone")) : null,
        whatsapp ? h("a", { class: "contact__btn contact__btn--whatsapp", href: whatsapp, target: "_blank", rel: "noopener", "aria-label": t("contact.whatsapp", vars) }, icon("i-whatsapp")) : null,
      ),
    );
  }

  function person(c) {
    return h("li", { class: "contact__person" },
      h("p", { class: "contact__name" }, c.name, c.relation ? h("span", { class: "contact__relation" }, L(c.relation)) : null),
      h("ul", { class: "contact__numbers" }, ...usable(c).map((n) => number(c, n))),
    );
  }

  /** The whole list, grouped under the groom's and the bride's side when sides are given. */
  function card() {
    const contacts = list();
    const sided = contacts.some((c) => SIDES.includes(c.side));
    const groups = sided
      ? [...SIDES.map((s) => [s, contacts.filter((c) => c.side === s)]), [null, contacts.filter((c) => !SIDES.includes(c.side))]]
      : [[null, contacts]];
    return h("div", { class: "contact" }, ...groups.filter(([, people]) => people.length).map(([side, people]) =>
      h("div", { class: "contact__group" },
        side ? h("p", { class: "contact__side" }, t(`contact.${side}`)) : null,
        h("ul", { class: "contact__people" }, ...people.map(person)),
      ),
    ));
  }

  function render() {
    const has = list().length > 0;
    $("#contact-toggle").hidden = !has;
    $("#rsvp-contact").hidden = !has;
    if (!has) return;
    $("#contact-sheet-body").replaceChildren(card());
    $("#rsvp-contact-body").replaceChildren(card());
  }

  function init() {
    $("#contact-toggle").addEventListener("click", () => $("#contact-sheet").showModal());
    render();
  }

  window.Invite.contact = { init, render, links, list };
})();
