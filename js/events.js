/* Event itinerary cards, the sticky stage where the couple changes into each
   event's look as its card reaches the middle of the screen, and the
   directions modal (map + calendar file). */
(function () {
  const { $, h, get, L, t, num, names, eventStart, eventEnd, fmtDay, fmtMonth, fmtWeekday, fmtLong, formatTime, daysUntil } = window.Invite;

  let stage = null;      // wardrobe instance, or null when no event has a look
  let observer = null;
  let currentEv = null;  // event shown in the directions dialog
  let stageEventId = null;

  function timeText(ev) {
    if (!ev.startTime) return null;
    const start = formatTime(ev.startTime);
    return ev.endTime ? `${start} – ${formatTime(ev.endTime)}` : t("events.from", { time: start });
  }

  function mapQuery(ev) {
    if (!ev.venue) return get("city");
    return [ev.venue.name, ev.venue.address].filter(Boolean).join(", ");
  }

  function status(ev) {
    const now = new Date();
    if (now > eventEnd(ev)) return { text: t("events.done"), cls: "" };
    const d = daysUntil(ev, now);
    if (d <= 0) return { text: t("events.today"), cls: "event__status--today" };
    if (d === 1) return { text: t("events.tomorrow"), cls: "" };
    return { text: t("events.inDays", { n: num(d) }), cls: "" };
  }

  /* ---------- Calendar file (always English: calendars are shared) ---------- */
  function icsStamp(d) {
    return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  }
  function icsEscape(s) {
    return String(s).replace(/[\\;,]/g, (m) => `\\${m}`).replace(/\n/g, "\\n");
  }
  function downloadIcs(ev) {
    const c = get("couple");
    const name = ev.name.en ?? L(ev.name);
    const lines = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Subh and Sneha//Invitation//EN", "CALSCALE:GREGORIAN",
      "BEGIN:VEVENT",
      `UID:${ev.id}-2026@subh-sneha-invite`,
      `DTSTAMP:${icsStamp(new Date())}`,
    ];
    if (ev.startTime) {
      const end = ev.endTime ? eventEnd(ev) : new Date(eventStart(ev).getTime() + 4 * 3600e3);
      lines.push(`DTSTART:${icsStamp(eventStart(ev))}`, `DTEND:${icsStamp(end)}`);
    } else {
      const next = new Date(`${ev.date}T00:00:00Z`);
      next.setUTCDate(next.getUTCDate() + 1);
      lines.push(`DTSTART;VALUE=DATE:${ev.date.replace(/-/g, "")}`, `DTEND;VALUE=DATE:${next.toISOString().slice(0, 10).replace(/-/g, "")}`);
    }
    lines.push(
      `SUMMARY:${icsEscape(`${name} · ${c.groom.en} & ${c.bride.en}`)}`,
      `LOCATION:${icsEscape(mapQuery(ev))}`,
      `DESCRIPTION:${icsEscape(`${ev.gloss.en ?? L(ev.gloss)}. ${location.href.split("#")[0]}`)}`,
      "END:VEVENT", "END:VCALENDAR",
    );
    const blob = new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" });
    const a = h("a", { href: URL.createObjectURL(blob), download: `${ev.id}-${c.groom.en}-${c.bride.en}.ics`.toLowerCase() });
    document.body.append(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  /* ---------- Directions modal ---------- */
  function fillDirections(ev) {
    const q = mapQuery(ev);
    $("#dir-when").textContent = [fmtLong(eventStart(ev)), timeText(ev)].filter(Boolean).join(" · ");
    $("#dir-title").textContent = L(ev.name);
    $("#dir-venue").textContent = ev.venue ? q : t("events.venueSoon");
    const go = $("#dir-go");
    go.href = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}`;
    go.hidden = !ev.venue;
    const iframe = $("#dir-map iframe");
    if (iframe) iframe.title = t("events.mapOf", { place: q });
  }

  function openDirections(ev) {
    currentEv = ev;
    const q = mapQuery(ev);
    $("#dir-map").replaceChildren(h("iframe", {
      loading: "lazy", referrerpolicy: "no-referrer-when-downgrade",
      src: `https://www.google.com/maps?q=${encodeURIComponent(q)}&z=${ev.venue ? 15 : 11}&output=embed`,
    }));
    fillDirections(ev);
    $("#directions").showModal();
  }

  /* ---------- Stage ---------- */
  function setStage(ev) {
    if (!stage || !ev.look) return;
    stageEventId = ev.id;
    stage.show(ev.look);
    const look = get("avatars").find((a) => a.id === ev.look);
    $("#stage-title").textContent = L(look.title);
    $("#stage-outfit").textContent = L(look.outfit);
    document.querySelectorAll(".event").forEach((li) => li.classList.toggle("is-current", li.dataset.id === ev.id));
  }

  function initStage() {
    const events = get("events");
    const holder = $("#events-stage");
    if (!events.some((e) => e.look)) {
      holder.remove();
      $("#events").classList.add("events--no-stage");
      return;
    }
    stage = window.Invite.wardrobe.create($("#events-wardrobe"), { initial: events.find((e) => e.look).look });
    $("#events-stage").setAttribute("aria-label", t("hero.stageLabel", names()));
    // The card crossing the middle band of the screen is the current one.
    observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const ev = events.find((e) => e.id === entry.target.dataset.id);
        if (ev) setStage(ev);
      }
    }, { rootMargin: "-42% 0px -42% 0px" });
    // Warm up the other outfits once the guest heads towards this section.
    new IntersectionObserver(([e], io) => {
      if (e.isIntersecting) { stage.preload(); io.disconnect(); }
    }, { rootMargin: "600px 0px" }).observe($("#events"));
  }

  function render() {
    const list = $("#event-list");
    list.replaceChildren();
    observer?.disconnect();
    for (const ev of get("events")) {
      const start = eventStart(ev);
      const st = status(ev);
      const time = timeText(ev);
      const name = L(ev.name);
      const li = h("li", { class: "event", dataset: { id: ev.id } },
        h("span", { class: `event__status ${st.cls}` }, st.text),
        h("p", { class: "event__date" },
          h("span", { class: "event__day" }, fmtDay(start)),
          h("span", { class: "event__month" }, fmtMonth(start), h("br"), fmtWeekday(start)),
        ),
        h("h3", { class: "event__name" }, name),
        h("p", { class: "event__gloss" }, L(ev.gloss)),
        h("ul", { class: "event__meta" },
          h("li", {}, h("b", {}, t("events.time")), h("span", { class: time ? "" : "tba" }, time || t("events.tba"))),
          h("li", {}, h("b", {}, t("events.venue")), h("span", { class: ev.venue ? "" : "tba" }, ev.venue ? ev.venue.name : t("events.tba"))),
        ),
        h("div", { class: "event__actions" },
          h("button", { class: "btn btn--gold", type: "button", onclick: () => openDirections(ev) }, t("events.directions")),
          h("button", { class: "btn btn--ghost", type: "button", onclick: () => downloadIcs(ev), "aria-label": t("events.addAria", { event: name }) }, t("events.addToCalendar")),
        ),
      );
      list.append(li);
      observer?.observe(li);
    }
    if (stage) {
      const shown = get("events").find((e) => e.id === stageEventId) || get("events").find((e) => e.look);
      setStage(shown);
    }
    if (currentEv && $("#directions").open) fillDirections(currentEv);
  }

  function init() {
    initStage();
    render();
    $("#dir-ics").addEventListener("click", () => currentEv && downloadIcs(currentEv));
  }

  window.Invite.events = { init, render };
})();
