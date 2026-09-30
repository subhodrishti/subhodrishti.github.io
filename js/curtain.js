/* The opening curtain. Guests see it once per browser session; a link with
   ?open=1 skips it (handy for sharing a deep link like #rsvp). */
(function () {
  const { $, t, guestName, reducedMotion } = window.Invite;
  const behind = () => ["main", ".topbar", ".footer"].map((s) => $(s)).filter(Boolean);

  function reveal() {
    window.Invite.revealed = true;
    document.body.classList.remove("is-locked");
    document.body.classList.add("is-revealed");
    behind().forEach((el) => (el.inert = false));
    if (window.Invite.petals.enabled()) window.Invite.petals.start();
    document.dispatchEvent(new Event("invite:revealed"));
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
      if (curtain.classList.contains("is-opening")) return;
      // First thing, while the tap still counts as a user gesture.
      window.Invite.audio.begin();
      window.Invite.ambient.requestTilt(); // iOS only shares phone tilt after a tap
      try { sessionStorage.setItem("invite:opened", "1"); } catch { /* ignore */ }
      curtain.classList.add("is-opening");
      // Petals and the hero start while the fabric is still moving.
      setTimeout(reveal, reducedMotion.matches ? 50 : 700);
      setTimeout(() => {
        curtain.classList.add("is-open");
        $("#hero-title")?.focus({ preventScroll: true });
      }, reducedMotion.matches ? 450 : 1900);
    });
  }

  window.Invite.curtain = { init, render };
})();
