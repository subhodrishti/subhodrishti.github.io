/* Live countdown to the first event, in IST, with digits in the guest's
   language. Once the first event starts it says the celebrations have begun;
   after the last event ends it thanks everyone. */
(function () {
  const { $, h, get, t, L, num, eventStart, eventEnd } = window.Invite;

  let root, labelEl, timer;

  function label(now) {
    const day = now.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    const live = get("weddingDay");
    if (live && day >= live.start && day <= live.end) {
      const today = get("events").filter((ev) => ev.date === day);
      if (today.length) {
        const current = today.find((ev) => now < eventEnd(ev)) || today[today.length - 1];
        const next = today[today.indexOf(current) + 1];
        const nextText = next ? t("dayMode.next", { event: L(next.name), time: next.id === "wedding" && !live.lagnaTime ? t("dayMode.lagna") : (live.lagnaTime || next.startTime || t("dayMode.timeSoon")) }) : "";
        return `${t("dayMode.happening", { event: L(current.name) })}${nextText ? ` · ${nextText}` : ""}`;
      }
    }
    const events = get("events");
    const first = events[0];
    if (now >= eventStart(first)) {
      return now > eventEnd(events[events.length - 1]) ? t("countdown.over") : t("countdown.begun");
    }
    return first.startTime ? t("countdown.untilEvent", { event: L(first.name) }) : t("countdown.untilStart");
  }

  /* Tear-off pads. Each unit's .pad__sheet always holds the live value (that is
     what screen readers and the smoke test read). When a value changes, the
     pad's one reusable .pad__tear sheet takes the old value and falls away
     over it. The animation restarts by flipping data-flip between two identical
     keyframe sets, so there is no forced reflow and never more than one falling
     node per pad. Language switches, the first paint, returning to a hidden tab
     and an off-screen countdown just swap the text. */
  const UNITS = ["days", "hours", "minutes", "seconds"];
  const calm = matchMedia("(prefers-reduced-motion: reduce)");
  let pads, onScreen = true;

  function makePad(unit) {
    const sheet = $(`[data-unit="${unit}"]`, root);
    const stack = sheet.parentElement;
    const tear = h("span", { class: "pad__tear", "aria-hidden": "true" });
    stack.append(
      h("span", { class: "pad__shade", "aria-hidden": "true" }),
      tear,
      h("span", { class: "pad__bind", "aria-hidden": "true" }),
    );
    return { sheet, tear, value: null, flip: 0 };
  }

  function set(unit, value, digits, animate) {
    const pad = pads[unit];
    const text = num(value, digits);
    if (animate && pad.value !== null && pad.value !== value) {
      pad.tear.textContent = pad.sheet.textContent;
      pad.tear.dataset.len = pad.sheet.dataset.len || "2";
      pad.flip ^= 1;
      pad.tear.dataset.flip = pad.flip;
      pad.sheet.parentElement.dataset.flip = pad.flip;
    } else if (!animate) {
      delete pad.tear.dataset.flip;
      delete pad.sheet.parentElement.dataset.flip;
    }
    pad.value = value;
    if (pad.sheet.textContent !== text) pad.sheet.textContent = text;
    pad.sheet.dataset.len = String(Math.max(2, text.length));
  }

  function tick(animate = true) {
    const now = new Date();
    const ms = eventStart(get("events")[0]) - now;
    labelEl.textContent = label(now);
    if (ms <= 0) {
      clearInterval(timer);
      timer = null;
      root.querySelector(".countdown__grid").hidden = true;
      return;
    }
    const s = Math.floor(ms / 1000);
    const go = animate && onScreen && !document.hidden && !calm.matches;
    set("days", Math.floor(s / 86400), 1, go);
    set("hours", Math.floor((s % 86400) / 3600), 2, go);
    set("minutes", Math.floor((s % 3600) / 60), 2, go);
    set("seconds", s % 60, 2, go);
  }

  function init() {
    root = $("#countdown");
    if (!root) return;
    labelEl = $("#countdown-label");
    pads = Object.fromEntries(UNITS.map((u) => [u, makePad(u)]));
    tick(false);
    timer = setInterval(tick, 1000);
    // Back from a hidden tab: jump straight to the right numbers, no burst of tears.
    document.addEventListener("visibilitychange", () => { if (!document.hidden && timer) tick(false); });
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; }).observe(root);
    }
  }

  window.Invite.countdown = { init, render: () => root && tick(false) };
})();
