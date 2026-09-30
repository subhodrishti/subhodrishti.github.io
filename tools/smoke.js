/*
 * Smoke run of the whole guest journey at phone and desktop sizes, using the
 * installed Chrome through Playwright. Writes screenshots to .smoke/ and exits
 * non-zero on page errors, console errors, horizontal overflow or a broken
 * feature check.
 *
 *   python -m http.server 5500 --bind 127.0.0.1     (in another terminal)
 *   node tools/smoke.js [--reduced-motion] [--url http://127.0.0.1:5500/]
 *
 * The RSVP/poll endpoint is played by the real backend/google-apps-script.gs
 * running in tools/gas_harness.js, injected only into this test browser.
 * Needs `npm i -D playwright`, or PLAYWRIGHT_MODULE=/path/to/node_modules/playwright.
 */
const path = require("path");
const fs = require("fs");
const { load: loadBackend } = require("./gas_harness");

let chromium;
try {
  ({ chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright"));
} catch {
  console.error("Playwright not found. Run `npm i -D playwright` or set PLAYWRIGHT_MODULE.");
  process.exit(2);
}

const args = process.argv.slice(2);
const reduced = args.includes("--reduced-motion");
const urlArg = args.indexOf("--url");
const BASE = urlArg > -1 ? args[urlArg + 1] : "http://127.0.0.1:5500/";
const OUT = path.join(__dirname, "..", ".smoke");
const FAKE_ENDPOINT = "https://script.google.test/macros/s/smoke/exec";
fs.mkdirSync(OUT, { recursive: true });

const CURTAIN_MS = reduced ? 700 : 2600;
const WIPE_MS = reduced ? 500 : 1500; // the pixel transition is 1.9s; callers add slack

const sizes = [
  { name: "phone", viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  { name: "desktop", viewport: { width: 1440, height: 900 } },
];

/** Route the page's endpoint calls into the Apps Script harness. */
async function wireBackend(ctx, backend) {
  await ctx.route("**/js/config.js", async (route) => {
    const res = await route.fetch();
    const body = (await res.text()) + `\nwindow.INVITE.rsvp.endpoint = ${JSON.stringify(FAKE_ENDPOINT)};\n`;
    await route.fulfill({ response: res, body });
  });
  await ctx.route(`${FAKE_ENDPOINT}**`, async (route) => {
    const req = route.request();
    const cors = { "access-control-allow-origin": "*", "content-type": "application/json" };
    const out = req.method() === "POST"
      ? backend.post(JSON.parse(req.postData() || "{}"))
      : backend.get(Object.fromEntries(new URL(req.url()).searchParams));
    await route.fulfill({ status: 200, headers: cors, body: JSON.stringify(out) });
  });
}

(async () => {
  const browser = await chromium.launch({ channel: "chrome", args: ["--autoplay-policy=user-gesture-required"] });
  const problems = [];
  const check = (ok, msg) => { if (!ok) problems.push(msg); };

  for (const size of sizes) {
    const backend = loadBackend();
    // Other guests have already voted on the first question: 5 bride, 2 groom.
    ["bride", "bride", "bride", "bride", "bride", "groom", "groom"].forEach((pick, i) =>
      backend.post({ type: "poll", question: "ready", pick, device: `seed-device-${i}xx` }));

    const ctx = await browser.newContext({ ...size, reducedMotion: reduced ? "reduce" : "no-preference" });
    await wireBackend(ctx, backend);
    const page = await ctx.newPage();
    const tag = `${size.name}${reduced ? "-reduced" : ""}`;
    const shot = (n, opts = {}) => page.screenshot({ path: path.join(OUT, `${tag}-${n}.png`), ...opts });
    page.on("pageerror", (e) => problems.push(`${tag} pageerror: ${e.message}`));
    page.on("console", (m) => {
      // 404s are reported with their URL by the response listener below.
      if (/Failed to load resource/.test(m.text())) return;
      if (m.type() === "error" || m.type() === "warning") problems.push(`${tag} console.${m.type()}: ${m.text()}`);
    });
    page.on("response", (r) => { if (r.status() >= 400) problems.push(`${tag} HTTP ${r.status()}: ${r.url()}`); });
    const scrollTo = (sel, block = "start") => page.evaluate(([s, b]) => document.querySelector(s).scrollIntoView({ block: b, behavior: "instant" }), [sel, block]);
    const look = (sel) => page.$eval(sel, (el) => el.dataset.look);

    // 1 · Curtain → sound
    await page.goto(`${BASE}?guest=Test%20Guest`, { waitUntil: "networkidle" });
    await shot("01-curtain");
    await page.click("#open-invite");
    await page.waitForTimeout(CURTAIN_MS);
    const audio = await page.evaluate(() => window.Invite.audio.state());
    check(audio.started && audio.context === "running", `${tag}: sound did not start on the seal tap (${JSON.stringify(audio)})`);
    await shot("02-hero");

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check(overflow <= 0, `${tag}: page scrolls sideways by ${overflow}px`);

    // 1b · Living backdrop: every section has one, the conch answers a tap
    const amb = await page.evaluate(() => ({
      layers: document.querySelectorAll(".has-ambient > .ambient:not(.ambient--front)").length,
      motifs: document.querySelectorAll(".motif").length,
      conch: !!document.querySelector(".motif--action"),
      moving: document.querySelector(".hero .ambient__lens")?.style.transform || "",
    }));
    check(amb.layers === 5, `${tag}: expected 5 living backdrops, found ${amb.layers}`);
    check(amb.motifs >= 12, `${tag}: only ${amb.motifs} Bengal motifs placed`);
    check(amb.conch, `${tag}: the hero conch button is missing`);
    check(reduced ? amb.moving === "" : amb.moving.includes("translate3d"), `${tag}: backdrop light ${reduced ? "moved under reduced motion" : "is not moving"}`);
    await page.click(".motif--action", { force: true });
    await page.waitForTimeout(300);

    // 2 · Hero outfit changes: every ceremony look, pixel transition in its palette
    const heroLooks = await page.evaluate(() => window.INVITE.heroLooks);
    const start = await look("#hero-wardrobe");
    const want = reduced ? "fade" : "pixel";
    for (const id of [...heroLooks.filter((x) => x !== start), start]) {
      await page.click(`#look-chips [data-look="${id}"]`);
      await page.waitForTimeout(reduced ? 150 : 850); // mid-swirl, in the new palette
      await page.locator(".hero__stage").screenshot({ path: path.join(OUT, `${tag}-03-hero-${id}.png`) });
      await page.waitForTimeout(WIPE_MS + 700);
      const ran = await page.$eval("#hero-wardrobe", (el) => el.dataset.lastTransition);
      check((await look("#hero-wardrobe")) === id, `${tag}: hero did not change into the ${id} look`);
      check(ran === want, `${tag}: changing into ${id} ran "${ran}", expected "${want}"`);
      const leftovers = await page.$$eval("#hero-wardrobe .wardrobe__fx *", (els) => els.length);
      check(leftovers === 0, `${tag}: ${leftovers} effect nodes left behind after ${id}`);
    }
    await shot("04-hero-settled");

    // 3 · Events: the stage follows the card in the middle of the screen
    const expected = await page.evaluate(() => window.INVITE.events.map((e) => [e.id, e.look]));
    for (const [id, want] of expected) {
      await scrollTo(`.event[data-id="${id}"]`, "center");
      await page.waitForTimeout(WIPE_MS);
      const got = await look("#events-wardrobe");
      check(got === want, `${tag}: stage showed "${got}" at the ${id} card, expected "${want}"`);
      if (id === expected[1][0]) await shot("05-events-stage");
    }

    // 4 · Polls with live results
    await scrollTo("#polls");
    await page.click(".poll__opt--bride");
    await page.waitForSelector(".result.is-shown", { timeout: 4000 }).catch(() => {});
    await page.waitForTimeout(1000);
    const pct = await page.$eval(".poll__result", (el) => el.textContent).catch(() => "");
    check(/75%/.test(pct) && /25%/.test(pct), `${tag}: expected 75%/25% after voting bride (6 of 8), got "${pct}"`);
    await shot("06-poll-result");
    await page.click(".poll__next");
    await page.waitForTimeout(700);

    // 5 · Bengali
    await page.click('.topbar .lang-switch [lang="bn"]');
    await page.waitForTimeout(400);
    const bn = await page.evaluate(() => ({ lang: document.documentElement.lang, names: document.querySelector("#hero-title").textContent, days: document.querySelector('[data-unit="days"]').textContent }));
    check(bn.lang === "bn" && bn.names.includes("শুভ") && /[০-৯]/.test(bn.days), `${tag}: Bengali switch incomplete ${JSON.stringify(bn)}`);
    await scrollTo("#top");
    await page.waitForTimeout(300);
    await shot("07-bn-hero");
    await scrollTo(".event", "center");
    await page.waitForTimeout(500);
    await shot("08-bn-events");
    await scrollTo("#polls");
    await page.waitForTimeout(300);
    await shot("09-bn-poll");

    const stitched = await page.$$eval(".kantha.is-stitched", (els) => els.length);
    check(stitched >= 3 || reduced, `${tag}: kantha stitches did not sew in as sections scrolled by (${stitched})`);

    // 6 · RSVP (in Bengali): errors, then a yes with confetti
    await scrollTo("#rsvp");
    await page.click("#rsvp-submit");
    const err = await page.$eval("#e-phone", (el) => el.textContent);
    check(/[ঀ-৿]/.test(err), `${tag}: phone error not in Bengali: "${err}"`);
    await shot("10-bn-rsvp-errors");
    await page.fill("#f-phone", "+91 90000 00000");
    await page.check('input[name="attending"][value="yes"]', { force: true });
    await page.click("#rsvp-submit");
    await page.waitForTimeout(700);
    check(await page.locator("#rsvp-done").isVisible(), `${tag}: RSVP did not reach the thank-you state`);
    const stored = backend.sheets.get("RSVPs")?.rows[1];
    check(stored && stored[9] === "bn" && stored[1] === "Test Guest", `${tag}: RSVP row not stored as expected: ${JSON.stringify(stored)}`);
    if (reduced) check(!(await page.locator("canvas.confetti").count()), `${tag}: confetti ran under reduced motion`);
    await shot("11-bn-rsvp-done");

    // Back to English keeps the thank-you state
    await page.click('.topbar .lang-switch [lang="en"]');
    await page.waitForTimeout(300);
    const title = await page.$eval("#rsvp-done-title", (el) => el.textContent);
    check(/Thank you/.test(title), `${tag}: thank-you did not switch back to English: "${title}"`);

    // Mute
    await page.click("#music-toggle");
    await page.waitForTimeout(700);
    const muted = await page.evaluate(() => window.Invite.audio.state());
    check(!muted.on, `${tag}: music toggle did not mute`);

    await ctx.close();
  }
  await browser.close();

  console.log(`Screenshots in ${OUT}`);
  if (problems.length) {
    console.error(`FAIL\n- ${problems.join("\n- ")}`);
    process.exit(1);
  }
  console.log("PASS");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
