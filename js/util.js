/* Small shared helpers. Everything hangs off window.Invite so the scripts
   work from file:// without a bundler or ES modules. */
(function () {
  const IST = "Asia/Kolkata";
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  /** Build an element. Children that are strings become text nodes, never HTML. */
  function h(tag, attrs = {}, ...children) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === "class") el.className = v;
      else if (k === "dataset") Object.assign(el.dataset, v);
      else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? "" : v);
    }
    for (const c of children.flat()) {
      if (c == null || c === false) continue;
      el.append(c instanceof Node ? c : document.createTextNode(String(c)));
    }
    return el;
  }

  /* ---------- Storage ---------- */
  const store = {
    get(key, fallback = null) {
      try {
        const raw = localStorage.getItem(`invite:${key}`);
        return raw == null ? fallback : JSON.parse(raw);
      } catch {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(`invite:${key}`, JSON.stringify(value));
      } catch {
        /* private mode or storage full: the page still works, it just forgets */
      }
    },
  };

  /* ---------- Language ---------- */
  const codes = () => window.INVITE.languages.map((l) => l.code);
  function initialLang() {
    const fromUrl = new URLSearchParams(location.search).get("lang");
    if (codes().includes(fromUrl)) return fromUrl;
    const saved = store.get("lang");
    return codes().includes(saved) ? saved : window.INVITE.defaultLang;
  }
  let current = initialLang();
  document.documentElement.lang = current;

  const lang = () => current;
  const locale = () => (current === "bn" ? "bn-IN" : "en-IN");

  /** Switch language, remember it, and tell every section to re-render. */
  function setLang(code) {
    if (!codes().includes(code) || code === current) return;
    current = code;
    store.set("lang", code);
    document.documentElement.lang = code;
    document.dispatchEvent(new CustomEvent("invite:lang", { detail: code }));
  }

  /** Localise a config value: { en, bn } → the current language's value. */
  function L(value) {
    if (value && typeof value === "object" && !Array.isArray(value) && ("en" in value || "bn" in value)) {
      return value[current] ?? value.en;
    }
    return value;
  }

  /** Interface string from js/strings.js with {placeholders} filled in. */
  function t(key, vars = {}) {
    const S = window.INVITE_STRINGS;
    let s = S[current]?.[key] ?? S.en[key] ?? key;
    for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
    return s;
  }

  /** Digits in the current script (Bengali numerals in bn). */
  function num(n, minDigits = 1) {
    return new Intl.NumberFormat(locale(), { minimumIntegerDigits: minDigits, useGrouping: false }).format(n);
  }

  /* ---------- Dates (always IST) ---------- */
  /** An event's start as a Date. Dates without a time start at 00:00 IST. */
  function eventStart(ev) {
    return new Date(`${ev.date}T${ev.startTime || "00:00"}:00+05:30`);
  }
  function eventEnd(ev) {
    if (ev.endTime) return new Date(`${ev.date}T${ev.endTime}:00+05:30`);
    return new Date(`${ev.date}T23:59:59+05:30`);
  }

  function fmt(date, opts) {
    return new Intl.DateTimeFormat(locale(), { timeZone: IST, ...opts }).format(date);
  }
  const fmtDay = (d) => fmt(d, { day: "numeric" });
  const fmtMonth = (d) => fmt(d, { month: current === "bn" ? "long" : "short" });
  const fmtWeekday = (d) => fmt(d, { weekday: "long" });
  const fmtLong = (d) => fmt(d, { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  function formatTime(hhmm) {
    if (!hhmm) return null;
    return fmt(new Date(`2026-01-01T${hhmm}:00+05:30`), { hour: "numeric", minute: "2-digit" });
  }

  /** Whole IST calendar days from today to the event's date. */
  function daysUntil(ev, now = new Date()) {
    const today = new Date(`${now.toLocaleDateString("en-CA", { timeZone: IST })}T00:00:00+05:30`);
    const day = new Date(`${ev.date}T00:00:00+05:30`);
    return Math.round((day - today) / 86400000);
  }

  /* ---------- Misc ---------- */
  /** The guest name from ?guest=…, trimmed and length-capped. */
  function guestName() {
    const raw = new URLSearchParams(location.search).get("guest") || "";
    return raw.replace(/\s+/g, " ").trim().slice(0, 60);
  }

  /** A random id for this browser, so a guest's poll vote can be changed, not duplicated. */
  function deviceId() {
    let id = store.get("device");
    if (!id) {
      id = (crypto.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`);
      store.set("device", id);
    }
    return id;
  }

  /** An Error whose `kind` says what went wrong: "offline", "timeout" or "server". */
  function sendError(kind, message) {
    return Object.assign(new Error(message), { kind });
  }

  /**
   * POST JSON to an Apps Script web app without a CORS preflight. Resolves only
   * when the script answers { ok: true }: Apps Script reports its own crashes,
   * permission prompts and timeouts as an HTML page with status 200, and those
   * must never read as a saved reply.
   */
  async function postJSON(url, payload, { timeout = 10000 } = {}) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeout);
    let res;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload),
        redirect: "follow",
        signal: ctrl.signal,
      });
    } catch (err) {
      if (err.name === "AbortError") throw sendError("timeout", `No answer in ${timeout} ms`);
      throw sendError(navigator.onLine === false ? "offline" : "server", err.message);
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) throw sendError("server", `HTTP ${res.status}`);
    const body = await res.json().catch(() => null);
    if (!body) throw sendError("server", "Answer was not JSON (an Apps Script error page?)");
    if (body.ok !== true) throw sendError("server", body.error || "Rejected");
    return body;
  }

  async function getJSON(url, params, { timeout = 8000 } = {}) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeout);
    try {
      const u = new URL(url);
      for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
      const res = await fetch(u, { redirect: "follow", signal: ctrl.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  }

  function get(path) {
    return path.split(".").reduce((o, k) => (o == null ? o : o[k]), window.INVITE);
  }

  /** Couple names in the current language, for t() placeholders. */
  function names() {
    const c = window.INVITE.couple;
    return { groom: L(c.groom), bride: L(c.bride) };
  }

  window.Invite = {
    IST, reducedMotion, $, $$, h, store,
    lang, locale, setLang, L, t, num, names,
    eventStart, eventEnd, fmtDay, fmtMonth, fmtWeekday, fmtLong, formatTime, daysUntil,
    guestName, deviceId, postJSON, getJSON, get,
  };
})();
