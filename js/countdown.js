/* Live countdown to the first event, in IST, with digits in the guest's
   language. Once the first event starts it says the celebrations have begun;
   after the last event ends it thanks everyone. */
(function () {
  const { $, get, t, L, num, eventStart, eventEnd } = window.Invite;

  let root, cells, labelEl, timer;

  function label(now) {
    const events = get("events");
    const first = events[0];
    if (now >= eventStart(first)) {
      return now > eventEnd(events[events.length - 1]) ? t("countdown.over") : t("countdown.begun");
    }
    return first.startTime ? t("countdown.untilEvent", { event: L(first.name) }) : t("countdown.untilStart");
  }

  function tick() {
    const now = new Date();
    const ms = eventStart(get("events")[0]) - now;
    labelEl.textContent = label(now);
    if (ms <= 0) {
      clearInterval(timer);
      root.querySelector(".countdown__grid").hidden = true;
      return;
    }
    const s = Math.floor(ms / 1000);
    cells.days.textContent = num(Math.floor(s / 86400));
    cells.hours.textContent = num(Math.floor((s % 86400) / 3600), 2);
    cells.minutes.textContent = num(Math.floor((s % 3600) / 60), 2);
    cells.seconds.textContent = num(s % 60, 2);
  }

  function init() {
    root = $("#countdown");
    if (!root) return;
    labelEl = $("#countdown-label");
    cells = Object.fromEntries(["days", "hours", "minutes", "seconds"].map((u) => [u, $(`[data-unit="${u}"]`, root)]));
    tick();
    timer = setInterval(tick, 1000);
  }

  window.Invite.countdown = { init, render: () => root && tick() };
})();
