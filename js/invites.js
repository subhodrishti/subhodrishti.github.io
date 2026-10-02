/* Invite codes. index.html?invite=<code> picks an entry from config `invites`
   and narrows the page to its events before anything renders: event cards, the
   outfit stage, RSVP choices, countdown and wedding-day panel all read
   get("events"), so they follow. A missing or unknown code shows the playful
   "invitation not found" page instead of the invitation. */
(function () {
  const I = window.Invite;
  const { $, h, t, IST } = I;
  const C = window.INVITE;

  function readCode() {
    const raw = (new URLSearchParams(location.search).get("invite") || "").trim().toLowerCase();
    return /^[a-z0-9-]{1,40}$/.test(raw) ? raw : null;
  }

  /** "13 December 2026", "10–13 December 2026", or "11 and 13 December 2026" for days with a gap. */
  function dateText(dates, loc) {
    const fmt = new Intl.DateTimeFormat(loc, { day: "numeric", month: "long", year: "numeric", timeZone: IST });
    const ds = dates.map((d) => new Date(`${d}T12:00:00+05:30`));
    const consecutive = ds.every((d, i) => i === 0 || d - ds[i - 1] === 86400000);
    let s;
    if (consecutive) s = ds.length === 1 ? fmt.format(ds[0]) : fmt.formatRange(ds[0], ds[ds.length - 1]);
    else {
      const list = new Intl.ListFormat(loc, { type: "conjunction" });
      if (!dates.every((d) => d.slice(0, 7) === dates[0].slice(0, 7))) s = list.format(ds.map((d) => fmt.format(d)));
      else {
        const day = new Intl.DateTimeFormat(loc, { day: "numeric", timeZone: IST });
        s = fmt.formatToParts(ds[ds.length - 1]).map((p) => (p.type === "day" ? list.format(ds.map((d) => day.format(d))) : p.value)).join("");
      }
    }
    return s.replace(/, (?=[০-৯]{4}$)/, " "); // "ডিসেম্বর ২০২৬", as in the card
  }

  /** The dates for these events, keeping the place from the full date line (" · Kolkata"). */
  function dateLine(events) {
    const dates = [...new Set(events.map((e) => e.date))].sort();
    const out = {};
    for (const [code, loc] of [["en", "en-IN"], ["bn", "bn-IN"]]) {
      const full = C.dateLine?.[code] || "";
      const place = full.includes(" · ") ? full.slice(full.lastIndexOf(" · ")) : "";
      out[code] = dateText(dates, loc) + place;
    }
    return out;
  }

  /** Narrow config to the invite's events; false when the code doesn't lead anywhere. */
  function apply(code) {
    const invite = code && Object.prototype.hasOwnProperty.call(C.invites || {}, code) ? C.invites[code] : null;
    if (!invite) return false;
    const known = new Set(C.events.map((e) => e.id));
    const ids = invite.events || [];
    ids.filter((id) => !known.has(id)).forEach((id) => console.warn(`[invite] invites.${code} lists unknown event "${id}"`));
    const events = C.events.filter((e) => ids.includes(e.id));
    if (!events.length) {
      console.error(`[invite] invites.${code} has no known events, so it shows "not found"`);
      return false;
    }
    all = events.length === C.events.length;
    C.events = events;
    const looks = events.map((e) => e.look).filter(Boolean);
    if (looks.length) {
      C.heroLooks = (C.heroLooks || C.avatars.map((a) => a.id)).filter((id) => looks.includes(id));
      if (!C.heroLooks.length) C.heroLooks = looks;
      if (!C.heroLooks.includes(C.heroAvatar)) C.heroAvatar = C.heroLooks[0];
    }
    if (invite.dateLine) C.dateLine = invite.dateLine;
    else if (!all) C.dateLine = dateLine(events); // the whole wedding keeps "10–13 December"
    return true;
  }

  let all = false; // the invite covers every event
  const code = readCode();
  const ok = apply(code);

  /* ---------- Invitation not found ---------- */
  function render() {
    if (ok) return;
    document.title = t("notFound.metaTitle", I.names());
    const person = I.contact.list()[0];
    const n = person?.numbers.map(I.contact.links).find((l) => l.whatsapp || l.call);
    const ask = $("#nf-ask");
    ask.hidden = !n;
    if (n) {
      ask.replaceChildren(h("a", {
        class: "btn btn--gold", href: n.whatsapp || n.call,
        target: n.whatsapp ? "_blank" : null, rel: n.whatsapp ? "noopener" : null,
      }, t(n.whatsapp ? "notFound.ask" : "notFound.call", { name: person.name })));
    }
  }

  function init() {
    if (ok) return;
    ["#curtain", ".topbar", "main", ".footer", "#petals"].forEach((s) => { const el = $(s); if (el) el.hidden = true; });
    $("#not-found").hidden = false;
    document.body.classList.add("is-not-found");
    render();
  }

  I.invite = { ok, all, code: ok ? code : null, init, render };
})();
