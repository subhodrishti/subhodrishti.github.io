/* Wires the page together: fills [data-i18n] text in the current language,
   runs the language switch and the hero's outfit buttons, and starts each
   section. On a language change every section re-renders in place. */
(function () {
  const I = window.Invite;
  const { $, $$, h, get, L, t, names, lang, guestName } = I;

  let heroWardrobe = null;

  /* ---------- Static text ---------- */
  function applyStatic() {
    const vars = names();
    $$("[data-i18n]").forEach((el) => { el.textContent = t(el.dataset.i18n, vars); });
    // data-i18n-attr="aria-label:nav.top; placeholder:rsvp.phonePlaceholder"
    $$("[data-i18n-attr]").forEach((el) => {
      for (const pair of el.dataset.i18nAttr.split(";")) {
        const [attr, key] = pair.split(":").map((s) => s.trim());
        if (attr && key) el.setAttribute(attr, t(key, vars));
      }
    });
    $$("[data-bind]").forEach((el) => {
      const v = L(get(el.dataset.bind));
      if (typeof v === "string") el.textContent = v;
    });
    document.title = t("meta.title", vars);
    const name = guestName();
    const dear = $("#hero-dear");
    dear.hidden = !name;
    if (name) dear.textContent = t("hero.dear", { name });
  }

  /* ---------- Language switch ---------- */
  function renderLangSwitches() {
    // Rebuilding the buttons would drop keyboard focus; put it back where it was.
    const focused = document.activeElement?.closest?.(".lang-switch") ? document.activeElement : null;
    const focusedWrap = focused?.parentElement;
    const focusedCode = focused?.getAttribute("lang");
    $$(".lang-switch").forEach((wrap) => {
      queueMicrotask(() => { if (wrap === focusedWrap) wrap.querySelector(`[lang="${focusedCode}"]`)?.focus(); });
      wrap.replaceChildren(...get("languages").map((l) =>
        h("button", {
          type: "button", lang: l.code, "aria-pressed": String(l.code === lang()),
          "aria-label": l.label, onclick: () => I.setLang(l.code),
        }, l.short),
      ));
    });
  }

  /* ---------- Hero outfits ---------- */
  function heroLooks() {
    const ids = get("heroLooks") || get("avatars").map((a) => a.id);
    return ids.map((id) => get("avatars").find((a) => a.id === id)).filter(Boolean);
  }

  function renderLookChips() {
    const wrap = $("#look-chips");
    wrap.replaceChildren(...heroLooks().map((look) =>
      h("button", {
        type: "button", class: "chip", dataset: { look: look.id },
        "aria-pressed": String(heroWardrobe?.current === look.id),
        onclick: () => heroWardrobe.show(look.id),
      }, L(look.title)),
    ));
  }

  function initHeroWardrobe() {
    heroWardrobe = I.wardrobe.create($("#hero-wardrobe"), {
      initial: get("heroAvatar"),
      onChange: (id) => $$("#look-chips .chip").forEach((c) => c.setAttribute("aria-pressed", String(c.dataset.look === id))),
    });
    renderLookChips();
    // Fetch the other outfits after the opening, when the network is quiet.
    document.addEventListener("invite:revealed", () => setTimeout(() => heroWardrobe.preload(), 1200), { once: true });
  }

  function staggerHero() {
    $$(".hero__copy > *").forEach((el, i) => {
      el.dataset.rise = "";
      el.style.setProperty("--i", i);
    });
    $("#hero-title").tabIndex = -1;
  }

  /* ---------- Chrome ---------- */
  function initTopbar() {
    const bar = $("#topbar");
    new IntersectionObserver(([entry]) => bar.classList.toggle("is-solid", !entry.isIntersecting), {
      rootMargin: "-64px 0px 0px 0px",
    }).observe($(".hero"));
  }

  function initDialogs() {
    $$("dialog").forEach((dlg) => {
      dlg.addEventListener("click", (e) => {
        // A click on the backdrop lands on the <dialog> itself.
        if (e.target === dlg || e.target.closest("[data-close]")) dlg.close();
      });
      dlg.addEventListener("close", () => {
        const map = $("#dir-map", dlg);
        if (map) map.replaceChildren(); // stop the map iframe
      });
    });
  }

  function syncPetalToggle() {
    const btn = $("#petal-toggle");
    const on = I.petals.enabled();
    btn.textContent = t(on ? "footer.petalsOff" : "footer.petalsOn");
    btn.setAttribute("aria-pressed", String(on));
  }

  function initPetalToggle() {
    const btn = $("#petal-toggle");
    if (I.reducedMotion.matches) { btn.hidden = true; return; }
    btn.addEventListener("click", () => { I.petals.setEnabled(!I.petals.enabled()); syncPetalToggle(); });
    syncPetalToggle();
  }

  /* ---------- Language change ---------- */
  function rerender() {
    applyStatic();
    renderLangSwitches();
    renderLookChips();
    I.curtain.render();
    I.countdown.render();
    I.gallery.render();
    I.events.render();
    I.polls.render();
    I.rsvp.render();
    I.audio.render();
    I.ambient.render();
    if (!$("#petal-toggle").hidden) syncPetalToggle();
  }

  function start() {
    applyStatic();
    renderLangSwitches();
    staggerHero();
    initHeroWardrobe();
    I.petals.init();
    I.ambient.init();
    I.audio.init();
    I.audio.render();
    I.countdown.init();
    I.gallery.init();
    I.events.init();
    I.polls.init();
    I.rsvp.init();
    initTopbar();
    initDialogs();
    initPetalToggle();
    document.addEventListener("invite:lang", rerender);
    I.curtain.init(); // last: it decides when everything becomes visible
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
