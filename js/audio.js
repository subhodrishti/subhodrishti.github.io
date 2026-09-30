/* Shankh, ulu and shehnai.
 *
 * Browsers only allow sound after the guest does something, so everything
 * starts inside the seal tap (or the floating music button). The short clips
 * are fetched early as bytes, then decoded into Web Audio buffers once the
 * AudioContext exists. The shehnai loop streams through an <audio> element
 * routed into Web Audio, so its fade works on iPhones too (iOS ignores
 * audio.volume). Missing files are skipped silently.
 */
(function () {
  const { $, get, store, t } = window.Invite;

  let ctx = null, master = null, shehnaiEl = null, shehnaiGain = null, analyser = null, samples = null;
  let started = false;
  const bytes = {}; // name → Promise<ArrayBuffer|null>

  const tracks = () => get("audio.tracks") || {};
  const hasAny = () => Object.values(tracks()).some((tr) => tr && tr.src);
  const wanted = () => store.get("sound", get("audio.onByDefault") !== false);

  /** Start downloading the short clips so the conch sounds the moment the seal is tapped. */
  function prefetch() {
    for (const name of ["shankh", "ulu"]) {
      const tr = tracks()[name];
      if (!tr?.src || bytes[name]) continue;
      bytes[name] = fetch(tr.src).then((r) => (r.ok ? r.arrayBuffer() : null)).catch(() => null);
    }
  }

  function ensureContext() {
    if (ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    // The backdrop reads the music's loudness to breathe with it.
    analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    samples = new Uint8Array(analyser.fftSize);
    master.connect(analyser);
    analyser.connect(ctx.destination);
    return true;
  }

  async function playClip(name, at) {
    const tr = tracks()[name];
    const buf = await bytes[name];
    if (!buf || !ctx) return;
    try {
      const audio = await ctx.decodeAudioData(buf.slice(0));
      const src = ctx.createBufferSource();
      const g = ctx.createGain();
      g.gain.value = tr.volume ?? 1;
      src.buffer = audio;
      src.connect(g).connect(master);
      src.start(Math.max(ctx.currentTime, at));
    } catch { /* undecodable file: skip */ }
  }

  /** Must run synchronously inside a tap so the browser lets it play. */
  function startShehnai(delay) {
    const tr = tracks().shehnai;
    if (!tr?.src || shehnaiEl) return;
    shehnaiEl = new Audio(tr.src);
    shehnaiEl.loop = tr.loop !== false;
    shehnaiEl.preload = "auto";
    try {
      shehnaiGain = ctx.createGain();
      shehnaiGain.gain.value = 0;
      ctx.createMediaElementSource(shehnaiEl).connect(shehnaiGain).connect(master);
      const t0 = ctx.currentTime + delay;
      shehnaiGain.gain.setValueAtTime(0, t0);
      shehnaiGain.gain.linearRampToValueAtTime(tr.volume ?? 0.3, t0 + 3);
    } catch {
      // e.g. file:// blocks routing; play unrouted rather than not at all.
      shehnaiEl.volume = tr.volume ?? 0.3;
    }
    shehnaiEl.play().catch(() => {});
  }

  /** The seal was tapped. Blow the shankh, ulu, then let the shehnai in. */
  function begin() {
    if (!hasAny() || !wanted() || started || !ensureContext()) return;
    started = true;
    ctx.resume();
    const now = ctx.currentTime;
    const tr = tracks();
    startShehnai(tr.shehnai?.delay ?? 3.5);
    playClip("shankh", now + 0.05);
    if (tr.ulu?.src) playClip("ulu", now + (tr.ulu.delay ?? 1.1));
    syncButton();
  }

  function setOn(on) {
    store.set("sound", on);
    if (on) {
      // A tap on the music button is also a gesture, so starting here is allowed.
      if (!ensureContext()) return;
      ctx.resume();
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setTargetAtTime(1, ctx.currentTime, 0.15);
      if (!shehnaiEl) { started = true; startShehnai(0.1); } else shehnaiEl.play().catch(() => {});
    } else if (ctx) {
      master.gain.setTargetAtTime(0, ctx.currentTime, 0.12);
      setTimeout(() => { if (!wanted()) { shehnaiEl?.pause(); ctx.suspend(); } }, 500);
    }
    syncButton();
    syncChip();
  }

  /** Loudness of what is playing, 0–1 (0 when muted or silent). */
  function level() {
    if (!analyser || !started || !wanted() || ctx.state !== "running") return 0;
    analyser.getByteTimeDomainData(samples);
    let sum = 0;
    for (let i = 0; i < samples.length; i++) { const v = (samples[i] - 128) / 128; sum += v * v; }
    return Math.min(1, Math.sqrt(sum / samples.length) * 4);
  }

  /** The hero's conch was tapped: blow the shankh (only if sound is on). */
  function blow() {
    if (!tracks().shankh?.src || !wanted() || !ensureContext()) return false;
    ctx.resume();
    if (!bytes.shankh) prefetch();
    playClip("shankh", ctx.currentTime + 0.02);
    return true;
  }

  /* ---------- Controls ---------- */
  function syncChip() {
    const chip = $("#sound-chip");
    if (!chip) return;
    const on = wanted();
    chip.setAttribute("aria-pressed", String(on));
    chip.querySelector("span").textContent = t(on ? "sound.withSound" : "sound.withoutSound");
  }

  function syncButton() {
    const btn = $("#music-toggle");
    if (!btn) return;
    const playing = wanted() && started;
    btn.setAttribute("aria-pressed", String(playing));
    btn.setAttribute("aria-label", t(playing ? "sound.mute" : "sound.unmute"));
    btn.title = btn.getAttribute("aria-label");
  }

  function init() {
    const chip = $("#sound-chip");
    const btn = $("#music-toggle");
    const credit = $("#audio-credit");
    if (!hasAny()) {
      chip?.remove();
      btn?.remove();
      credit?.remove();
      return;
    }
    prefetch();
    chip?.addEventListener("click", () => { store.set("sound", !wanted()); syncChip(); });
    btn?.addEventListener("click", () => setOn(!(wanted() && started)));
    document.addEventListener("visibilitychange", () => {
      if (!ctx || !started) return;
      if (document.hidden) { shehnaiEl?.pause(); ctx.suspend(); }
      else if (wanted()) { ctx.resume(); shehnaiEl?.play().catch(() => {}); }
    });
    syncChip();
    syncButton();
  }

  function render() {
    syncChip();
    syncButton();
    const credit = $("#audio-credit");
    if (credit) credit.textContent = window.Invite.L(get("audio.credits")) || "";
  }

  window.Invite.audio = {
    init, begin, render, setOn, level, blow,
    state: () => ({ started, on: wanted(), context: ctx?.state ?? "none" }),
  };
})();
