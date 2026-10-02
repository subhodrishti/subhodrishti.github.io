/* The opening curtain. Guests see it once per browser session; a link with
   ?open=1 skips it (handy for sharing a deep link like #rsvp).

   On a tap: the seal presses in, then cracks in two (each half carried off
   with its panel) as petals and khoi burst from the seam; the panels sweep up
   into tied-back swags, then fade at the wings. Shubho drishti follows: the
   paan leaves over the bride's face part. Timings are in ms after the crack;
   reduced motion keeps every step, faster and without travel (see styles.css). */
(function () {
  const { $, t, guestName, reducedMotion } = window.Invite;
  const behind = () => ["main", ".topbar", ".footer"].map((s) => $(s)).filter(Boolean);

  const STEPS = {
    motion: { press: 220, reveal: 500, parted: 1900, open: 2750, drishti: 2800 },
    reduced: { press: 0, reveal: 50, parted: 0, open: 450, drishti: 1200 },
  };

  function reveal() {
    window.Invite.revealed = true;
    document.body.classList.remove("is-locked");
    document.body.classList.add("is-revealed");
    behind().forEach((el) => (el.inert = false));
    if (window.Invite.petals.enabled()) window.Invite.petals.start();
    document.dispatchEvent(new Event("invite:revealed"));
  }

  /** Lay two clipped copies of the seal over it; CSS carries each half away. */
  function splitSeal(curtain, disc) {
    const r = disc.getBoundingClientRect();
    const svg = disc.querySelector("svg");
    const spin = svg ? getComputedStyle(svg).transform : "none"; // keep the pattern where it was
    for (const side of ["l", "r"]) {
      const half = disc.cloneNode(true);
      half.className = `seal__disc seal-half seal-half--${side}`;
      const s = half.querySelector("svg");
      if (s && spin !== "none") s.style.transform = spin;
      Object.assign(half.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px` });
      curtain.append(half);
    }
    disc.style.visibility = "hidden";
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  function render() {
    const name = guestName();
    $("#curtain-greeting").textContent = name ? t("curtain.greetingNamed", { name }) : t("curtain.greeting");
  }

  function init() {
    const curtain = $("#curtain");
    const button = $("#open-invite");
    render();

    let seen = false;
    try { seen = sessionStorage.getItem("invite:opened") === "1"; } catch { /* ignore */ }
    const skip = seen || new URLSearchParams(location.search).get("open") === "1";

    if (skip || !curtain) {
      curtain?.classList.add("is-open");
      reveal();
      return;
    }

    document.body.classList.add("is-locked");
    behind().forEach((el) => (el.inert = true));
    button.focus({ preventScroll: true });

    button.addEventListener("click", () => {
      if (curtain.classList.contains("is-pressing")) return;
      // First thing, while the tap still counts as a user gesture.
      window.Invite.audio.begin();
      window.Invite.ambient.requestTilt(); // iOS only shares phone tilt after a tap
      try { sessionStorage.setItem("invite:opened", "1"); } catch { /* ignore */ }

      const motion = !reducedMotion.matches;
      const step = motion ? STEPS.motion : STEPS.reduced;
      const body = document.body;
      curtain.classList.add("is-pressing");
      body.classList.add("is-drishti", "is-curtain-opening");

      setTimeout(() => {
        if (motion) {
          const at = splitSeal(curtain, button.querySelector(".seal__disc"));
          window.Invite.petals.burst(at.x, at.y);
        }
        curtain.classList.add("is-opening");
        // The hero starts rising while the fabric is still moving.
        setTimeout(reveal, step.reveal);
        setTimeout(() => curtain.classList.add("is-parted"), step.parted);
        setTimeout(() => {
          curtain.classList.add("is-open");
          curtain.querySelectorAll(".seal-half").forEach((el) => el.remove());
          body.classList.remove("is-curtain-opening");
          $("#hero-title")?.focus({ preventScroll: true });
        }, step.open);
        setTimeout(() => {
          body.classList.add("is-drishti-open");
          document.dispatchEvent(new Event("invite:drishti")); // the hero couple may start moving
        }, step.drishti);
      }, step.press);
    });
  }

  window.Invite.curtain = { init, render };
})();
