/* A compact, offline-friendly control panel that appears only on the wedding
   dates (or ?weddingDay=1 for family testing). It intentionally uses only
   local config and links, so it remains useful when venue signal is poor. */
(function () {
  const { h, get, L, t, fmtLong, formatTime, store } = window.Invite;
  let panel;

  function istDay(now = new Date()) { return now.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }); }
  function enabled() {
    const cfg = get("weddingDay");
    return new URLSearchParams(location.search).get("weddingDay") === "1" || (cfg && istDay() >= cfg.start && istDay() <= cfg.end);
  }
  function currentStatus() {
    const events = get("events");
    const today = istDay();
    const todays = events.filter((e) => e.date === today);
    if (!todays.length) return t("dayMode.happening", { event: t("dayMode.celebration") });
    const now = new Date();
    const current = todays.find((e) => !e.startTime || now < new Date(`${e.date}T${e.endTime || "23:59"}:00+05:30`)) || todays[todays.length - 1];
    const next = todays[todays.indexOf(current) + 1];
    const lagna = get("weddingDay.lagnaTime");
    const nextText = next ? t("dayMode.next", { event: L(next.name), time: next.id === "wedding" && !lagna ? t("dayMode.lagna") : (formatTime(next.startTime) || t("dayMode.timeSoon")) }) : "";
    return `${t("dayMode.happening", { event: L(current.name) })}${nextText ? ` · ${nextText}` : ""}`;
  }
  function render() {
    panel?.remove();
    if (!enabled()) return;
    const cfg = get("weddingDay");
    const contacts = cfg.contacts || [];
    const declined = store.get("rsvp")?.attending === "no";
    panel = h("aside", { class: "day-mode glass glass--dark", "aria-label": t("dayMode.label") },
      h("p", { class: "day-mode__kicker" }, t("dayMode.kicker")),
      h("p", { class: "day-mode__status", role: "status" }, currentStatus()),
      h("p", { class: "day-mode__date" }, fmtLong(new Date(`${istDay()}T12:00:00+05:30`))),
      h("div", { class: "day-mode__actions" },
        h("a", { class: "btn btn--gold", href: "#events" }, t("dayMode.map")),
        declined && cfg.livestream?.url ? h("a", { class: "btn btn--ghost", href: cfg.livestream.url, target: "_blank", rel: "noopener" }, L(cfg.livestream.label)) : null,
      ),
      contacts.length ? h("div", { class: "day-mode__contacts" }, h("strong", {}, t("dayMode.contacts")), ...contacts.map((c) =>
        h("a", { href: `tel:${c.phone.replace(/[^+\d]/g, "")}` }, `${c.name}${c.role ? ` · ${L(c.role)}` : ""}`),
      )) : h("p", { class: "day-mode__offline" }, t("dayMode.offline")),
    );
    document.body.append(panel);
  }
  function init() { render(); setInterval(() => { if (panel) panel.querySelector(".day-mode__status").textContent = currentStatus(); }, 60000); }
  window.Invite.weddingDay = { init, render };
})();
