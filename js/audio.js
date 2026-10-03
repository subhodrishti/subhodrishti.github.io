/* The background music, with an optional ulu, and the hero conch's shankh.
 *
 * Browsers only allow sound after the guest does something, so everything
 * starts inside the seal tap (or the floating music button). The short clips
 * are fetched early as bytes, then decoded into Web Audio buffers once the
 * AudioContext exists. The music loop streams through an <audio> element
 * routed into Web Audio, so its fade works on iPhones too (iOS ignores
 * audio.volume). Missing files are skipped silently.
 */
(function () {
  const { $, get, store, t } = window.Invite;

  let ctx = null, master = null, musicEl = null, musicGain = null, analyser = null, samples = null;
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
  function startMusic(delay) {
    const tr = tracks().music;
    if (!tr?.src || musicEl) return;
    musicEl = new Audio(tr.src);
    musicEl.loop = tr.loop !== false;
    musicEl.preload = "auto";
    try {
      musicGain = ctx.createGain();
      musicGain.gain.value = 0;
      ctx.createMediaElementSource(musicEl).connect(musicGain).connect(master);
      const t0 = ctx.currentTime + delay;
      musicGain.gain.setValueAtTime(0, t0);
      musicGain.gain.linearRampToValueAtTime(tr.volume ?? 0.3, t0 + 3);
    } catch {
      // e.g. file:// blocks routing; play unrouted rather than not at all.
      musicEl.volume = tr.volume ?? 0.3;
    }
    musicEl.play().catch(() => {});
  }

  /** The seal was tapped. Fade the music in (and the ulu, once recorded). */
  function begin() {
    if (!hasAny() || !wanted() || started || !ensureContext()) return;
    started = true;
    ctx.resume();
    const tr = tracks();
    startMusic(tr.music?.delay ?? 0.1);
    if (tr.ulu?.src) playClip("ulu", ctx.currentTime + (tr.ulu.delay ?? 1.1));
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
      if (!musicEl) { started = true; startMusic(0.1); } else musicEl.play().catch(() => {});
    } else if (ctx) {
      master.gain.setTargetAtTime(0, ctx.currentTime, 0.12);
      setTimeout(() => { if (!wanted()) { musicEl?.pause(); ctx.suspend(); } }, 500);
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
      if (document.hidden) { musicEl?.pause(); ctx.suspend(); }
      else if (wanted()) { ctx.resume(); musicEl?.play().catch(() => {}); }
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
