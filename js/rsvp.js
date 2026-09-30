/* RSVP form: validation, guest-count stepper, submission to the Apps Script
   endpoint, confetti on a yes, and a "you replied" state on return visits.
   Switching language relabels the form in place; typed answers are kept. */
(function () {
  const { $, $$, h, get, L, t, num, lang, store, postJSON, guestName, fmtLong } = window.Invite;

  let form, submitBtn, statusEl, sending = false;
  const errors = {}; // field → strings.js key, so errors can be re-translated
  // form.name would be the form's own name attribute, so always go through elements.
  const field = (n) => form.elements.namedItem(n);

  function setError(name, key) {
    errors[name] = key || null;
    const err = $(`#e-${name}`);
    if (err) err.textContent = key ? t(key) : "";
    const input = field(name);
    if (input && !(input instanceof RadioNodeList) && input.type !== "checkbox") {
      input.setAttribute("aria-invalid", key ? "true" : "false");
      if (key) input.setAttribute("aria-describedby", `e-${name}`);
    }
  }

  function readForm() {
    const fd = new FormData(form);
    const attending = fd.get("attending");
    const yes = attending === "yes";
    return {
      type: "rsvp",
      name: String(fd.get("name") || "").trim(),
      phone: String(fd.get("phone") || "").trim(),
      attending,
      events: yes ? fd.getAll("events") : [],
      guests: yes ? Math.max(1, Math.min(get("rsvp.maxGuests"), Number(fd.get("guests")) || 1)) : 0,
      diet: yes ? fd.get("diet") || "" : "",
      dietNotes: yes ? String(fd.get("dietNotes") || "").trim() : "",
      wishes: String(fd.get("wishes") || "").trim(),
      website: String(fd.get("website") || ""),
      lang: lang(),
      invitedAs: guestName() || null,
      submittedAt: new Date().toISOString(),
    };
  }

  function validate(data) {
    let firstBad = null;
    const fail = (name, key) => { setError(name, key); firstBad ||= name; };
    ["name", "phone", "attending", "events"].forEach((f) => setError(f, null));

    if (!data.name) fail("name", "rsvp.errName");
    const digits = data.phone.replace(/\D/g, "");
    if (digits.length < 7 || digits.length > 15) fail("phone", "rsvp.errPhone");
    if (!data.attending) fail("attending", "rsvp.errAttending");
    if (data.attending === "yes" && data.events.length === 0) fail("events", "rsvp.errEvents");

    if (firstBad) form.querySelector(`[name="${firstBad}"]`)?.focus();
    return !firstBad;
  }

  function fillDone(data) {
    const first = data.name.split(" ")[0];
    const yes = data.attending === "yes";
    const date = data.submittedAt ? fmtLong(new Date(data.submittedAt)) : "";
    $("#rsvp-done-title").textContent = t(yes ? "rsvp.thanksYes" : "rsvp.thanksNo", { name: first });
    $("#rsvp-done-body").textContent = !yes
      ? t("rsvp.missed", { date })
      : data.guests === 1
        ? t("rsvp.savedOne", { date })
        : t("rsvp.savedMany", { n: num(data.guests), date });
  }

  function showDone(data, { celebrate = false, focus = true } = {}) {
    fillDone(data);
    form.hidden = true;
    const done = $("#rsvp-done");
    done.hidden = false;
    if (focus) {
      done.focus({ preventScroll: true });
      done.scrollIntoView({ block: "center" });
    }
    if (celebrate && data.attending === "yes") {
      const r = done.getBoundingClientRect();
      window.Invite.confetti.burst({ x: r.left + r.width / 2, y: r.top + 60 });
    }
  }

  function fill(data) {
    field("name").value = data.name || "";
    field("phone").value = data.phone || "";
    $$('input[name="attending"]', form).forEach((r) => (r.checked = r.value === data.attending));
    $$('input[name="events"]', form).forEach((c) => (c.checked = (data.events || []).includes(c.value)));
    field("guests").value = data.guests || 1;
    $$('input[name="diet"]', form).forEach((r) => (r.checked = r.value === data.diet));
    field("dietNotes").value = data.dietNotes || "";
    field("wishes").value = data.wishes || "";
    toggleMore();
  }

  function toggleMore() {
    const yes = form.querySelector('input[name="attending"]:checked')?.value === "yes";
    $("#rsvp-more").hidden = !yes;
  }

  function setSendLabel() {
    submitBtn.textContent = t(sending ? "rsvp.sending" : "rsvp.send");
  }

  async function onSubmit(e) {
    e.preventDefault();
    const data = readForm();
    if (!validate(data)) return;
    if (data.website) { showDone(data); return; } // bot filled the trap

    sending = true;
    submitBtn.disabled = true;
    setSendLabel();
    statusEl.textContent = "";
    statusEl.classList.remove("is-error");

    const endpoint = get("rsvp.endpoint");
    try {
      delete data.website;
      if (endpoint) {
        await postJSON(endpoint, data);
      } else {
        console.warn("[invite] rsvp.endpoint is empty in js/config.js; this reply was kept on this device only.");
      }
      store.set("rsvp", data);
      showDone(data, { celebrate: true });
    } catch (err) {
      console.error("[invite] RSVP failed", err);
      statusEl.textContent = t("rsvp.errSend");
      statusEl.classList.add("is-error");
    } finally {
      sending = false;
      submitBtn.disabled = false;
      setSendLabel();
    }
  }

  /** Event and diet choices: built once, relabelled on language change. */
  function buildChoices() {
    const evWrap = $("#f-events");
    for (const ev of get("events")) {
      evWrap.append(h("label", {}, h("input", { type: "checkbox", name: "events", value: ev.id, checked: true }), h("span", { dataset: { event: ev.id } })));
    }
    const dietWrap = $("#f-diet");
    get("rsvp.diets").forEach((d, i) => {
      dietWrap.append(h("label", {}, h("input", { type: "radio", name: "diet", value: d.id, checked: i === 0 }), h("span", { dataset: { diet: d.id } })));
    });
  }

  function render() {
    for (const ev of get("events")) $(`[data-event="${ev.id}"]`, form).textContent = L(ev.name);
    for (const d of get("rsvp.diets")) $(`[data-diet="${d.id}"]`, form).textContent = L(d.label);
    const deadline = get("rsvp.deadline");
    $("#rsvp-deadline").textContent = deadline
      ? t("rsvp.deadline", { date: fmtLong(new Date(`${deadline}T12:00:00+05:30`)) })
      : t("rsvp.intro");
    for (const [name, key] of Object.entries(errors)) if (key) $(`#e-${name}`).textContent = t(key);
    if (statusEl.classList.contains("is-error")) statusEl.textContent = t("rsvp.errSend");
    setSendLabel();
    if (!$("#rsvp-done").hidden) fillDone(store.get("rsvp", readForm()));
  }

  function initStepper() {
    const input = $("#f-guests");
    const max = get("rsvp.maxGuests");
    input.max = max;
    $$(".stepper button").forEach((b) =>
      b.addEventListener("click", () => {
        const next = (Number(input.value) || 1) + Number(b.dataset.step);
        input.value = Math.max(1, Math.min(max, next));
      }),
    );
  }

  function init() {
    form = $("#rsvp-form");
    submitBtn = $("#rsvp-submit");
    statusEl = $("#rsvp-status");

    buildChoices();
    initStepper();
    render();
    const name = guestName();
    if (name) field("name").value = name;

    form.addEventListener("change", (e) => {
      if (e.target.name === "attending") toggleMore();
      if (e.target.name === "attending" || e.target.name === "events") setError(e.target.name, null);
    });
    // Clear a field's error as soon as the guest starts fixing it.
    form.addEventListener("input", (e) => {
      if (e.target.getAttribute("aria-invalid") === "true") setError(e.target.name, null);
    });
    form.addEventListener("submit", onSubmit);
    $("#rsvp-edit").addEventListener("click", () => {
      $("#rsvp-done").hidden = true;
      form.hidden = false;
      fill(store.get("rsvp", {}));
      field("name").focus();
    });

    const saved = store.get("rsvp");
    if (saved) {
      fill(saved);
      showDone(saved, { focus: false });
    }
  }

  window.Invite.rsvp = { init, render };
})();
