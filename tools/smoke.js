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
const WIPE_MS = reduced ? 500 : 1500; // the pixel transition is 1.9s (longer while it waits for a clip); callers add slack

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
  // Headless Chrome has no GPU: opt in to software WebGL for the couple's clips (js/alpha-video.js).
  const browser = await chromium.launch({ channel: "chrome", args: ["--autoplay-policy=user-gesture-required", "--enable-unsafe-swiftshader"] });
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
      // Software WebGL's performance notes about this GPU-less test machine, not the page.
      if (/GL Driver Message \(OpenGL, Performance/.test(m.text())) return;
      if (m.type() === "error" || m.type() === "warning") problems.push(`${tag} console.${m.type()}: ${m.text()}`);
    });
    page.on("response", (r) => { if (r.status() >= 400) problems.push(`${tag} HTTP ${r.status()}: ${r.url()}`); });
    const clipRequests = [];
    page.on("request", (r) => { if (/\.mp4(\?|$)/.test(r.url())) clipRequests.push(r.url()); });
    const scrollTo = (sel, block = "start") => page.evaluate(([s, b]) => document.querySelector(s).scrollIntoView({ block: b, behavior: "instant" }), [sel, block]);
    const look = (sel) => page.$eval(sel, (el) => el.dataset.look);
    // The still under a showing clip steps out, or it shows through wherever the couple moves.
    const stills = (sel) => page.$$eval(`${sel} .wardrobe__layer`, (els) => ({
      covered: els.filter((e) => e.classList.contains("is-covered")).length,
      activeOpacity: getComputedStyle(els.find((e) => e.classList.contains("is-active"))).opacity,
    }));
    const checkStills = async (sel, clip, what) => {
      await page.waitForTimeout(500); // the still's fade-out
      const st = await stills(sel);
      if (clip) check(st.covered === 1 && st.activeOpacity === "0", `${tag}: the still shows behind the clip on ${what} (${JSON.stringify(st)})`);
      else check(st.covered === 0 && st.activeOpacity === "1", `${tag}: the still is hidden with no clip on ${what} (${JSON.stringify(st)})`);
    };

    // 1 · Curtain → sound
    await page.goto(`${BASE}?guest=Test%20Guest`, { waitUntil: "networkidle" });
    await shot("01-curtain");
    await page.click("#open-invite");
    await page.waitForTimeout(CURTAIN_MS);
    const audio = await page.evaluate(() => window.Invite.audio.state());
    check(audio.started && audio.context === "running", `${tag}: sound did not start on the seal tap (${JSON.stringify(audio)})`);
    await shot("02-hero");

    // 1a · The hero couple loops as a clip once the paan leaves are lowered; a still where clips can't play
    const clips = await page.evaluate(() => window.Invite.alphaVideo.supported());
    const heroClip = await page.evaluate(() => !!window.INVITE.avatars.find((a) => a.id === document.querySelector("#hero-wardrobe").dataset.look)?.video);
    const clipTime = (sel) => page.$$eval(`${sel} video`, (vs) => vs.map((v) => v.currentTime));
    if (clips && heroClip) {
      const playing = await page.waitForSelector("#hero-wardrobe .wardrobe__motion.is-playing", { timeout: 8000 }).then(() => true, () => false);
      check(playing, `${tag}: the hero couple's clip did not start`);
      const t1 = await clipTime("#hero-wardrobe");
      await page.waitForTimeout(600);
      const t2 = await clipTime("#hero-wardrobe");
      check(t2.some((t, i) => t > t1[i]), `${tag}: the hero clip is not advancing (${t1} → ${t2})`);
      await checkStills("#hero-wardrobe", true, "the opening hero look");
      // Every look's clip is prefetched after the opening, one after another.
      const videos = await page.evaluate(() => window.INVITE.avatars.filter((a) => a.video).map((a) => a.video));
      const fetched = () => videos.filter((v) => clipRequests.some((u) => u.endsWith(v)));
      for (let i = 0; i < 40 && fetched().length < videos.length; i++) await page.waitForTimeout(250);
      check(fetched().length === videos.length, `${tag}: only ${fetched().length} of ${videos.length} clips were prefetched`);
      await shot("02-hero-clip");
    } else if (!clips) {
      check(!(await page.locator("video").count()), `${tag}: a clip was set up where clips can't play`);
    }

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
      await page.waitForFunction(() => !document.querySelector("#hero-wardrobe").dataset.transition, null, { timeout: WIPE_MS + 7000 }).catch(() => {});
      await page.waitForTimeout(150);
      const ran = await page.$eval("#hero-wardrobe", (el) => el.dataset.lastTransition);
      check((await look("#hero-wardrobe")) === id, `${tag}: hero did not change into the ${id} look`);
      check(ran === want, `${tag}: changing into ${id} ran "${ran}", expected "${want}"`);
      const leftovers = await page.$$eval("#hero-wardrobe .wardrobe__fx *", (els) => els.length);
      check(leftovers === 0, `${tag}: ${leftovers} effect nodes left behind after ${id}`);
      if (clips) {
        // One clip shows on a look that has one, none on a still look.
        const hasClip = await page.evaluate((x) => !!window.INVITE.avatars.find((a) => a.id === x)?.video, id);
        const want = hasClip ? 1 : 0;
        await page.waitForFunction(([w]) => document.querySelectorAll("#hero-wardrobe .wardrobe__motion.is-playing").length === w, [want], { timeout: 4000 }).catch(() => {});
        const shown = await page.$$eval("#hero-wardrobe .wardrobe__motion.is-playing", (els) => els.length);
        check(shown === want, `${tag}: ${shown} clips showing on the ${id} look, expected ${want}`);
        await checkStills("#hero-wardrobe", hasClip, `the ${id} look`);
      } else {
        await checkStills("#hero-wardrobe", false, `the ${id} look`);
      }
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
    if (clips) {
      const heroPaused = await page.$$eval("#hero-wardrobe video", (vs) => vs.every((v) => v.paused));
      check(heroPaused, `${tag}: the hero clip kept playing off-screen`);
      const withClip = await page.evaluate(() => window.INVITE.events.find((e) => window.INVITE.avatars.find((a) => a.id === e.look)?.video)?.id);
      if (withClip) {
        await scrollTo(`.event[data-id="${withClip}"]`, "center");
        const ok = await page.waitForSelector("#events-wardrobe .wardrobe__motion.is-playing", { timeout: 6000 }).then(() => true, () => false);
        check(ok, `${tag}: the events stage clip did not play at the ${withClip} card`);
        await shot("05-events-clip");
      }
    }
    if (reduced) check(!clipRequests.length, `${tag}: clips downloaded under reduced motion: ${clipRequests.join(", ")}`);

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

    // 5 · English only: no language switch; bride, "with", groom each on one line
    const en = await page.evaluate(() => {
      const h1 = document.querySelector("#hero-title");
      return { lang: document.documentElement.lang, switches: document.querySelectorAll(".lang-switch").length, lines: Math.max(...[...h1.children].map((s) => Math.round(s.getBoundingClientRect().height / parseFloat(getComputedStyle(s).lineHeight)))), label: document.querySelector("#countdown-label").textContent };
    });
    check(en.lang === "en" && en.switches === 0, `${tag}: page should be English only ${JSON.stringify(en)}`);
    check(en.lines <= 1, `${tag}: a couple name wraps onto ${en.lines} lines`);
    await scrollTo("#top");
    await page.waitForTimeout(300);
    await shot("07-hero");

    const stitched = await page.$$eval(".kantha.is-stitched", (els) => els.length);
    check(stitched >= 1 || reduced, `${tag}: kantha stitches did not sew in as sections scrolled by (${stitched})`);

    // 6 · RSVP: errors, then a yes with confetti
    await scrollTo("#rsvp");
    await page.click("#rsvp-submit");
    const err = await page.$eval("#e-phone", (el) => el.textContent);
    check(err.trim().length > 0, `${tag}: no phone error shown`);
    await shot("10-rsvp-errors");
    await page.fill("#f-phone", "+91 90000 00000");
    await page.check('input[name="attending"][value="yes"]', { force: true });
    await page.click("#rsvp-submit");
    await page.waitForTimeout(700);
    check(await page.locator("#rsvp-done").isVisible(), `${tag}: RSVP did not reach the thank-you state`);
    const stored = backend.sheets.get("RSVPs")?.rows[1];
    check(stored && stored[9] === "en" && stored[1] === "Test Guest", `${tag}: RSVP row not stored as expected: ${JSON.stringify(stored)}`);
    if (reduced) check(!(await page.locator("canvas.confetti").count()), `${tag}: confetti ran under reduced motion`);
    await shot("11-rsvp-done");

    const title = await page.$eval("#rsvp-done-title", (el) => el.textContent);
    check(/Thank you/.test(title), `${tag}: thank-you did not switch back to English: "${title}"`);

    // Contacts: hidden while config has only placeholders; with test contacts, the
    // top-bar button opens them and each number gets only the buttons it's flagged for.
    check(!(await page.locator("#contact-toggle").isVisible()), `${tag}: contact button shown with only placeholder numbers`);
    check(!(await page.locator("#rsvp-contact").isVisible()), `${tag}: RSVP contact card shown with only placeholder numbers`);
    await page.evaluate(() => {
      window.INVITE.contacts = [
        { name: "Test Groom Side", side: "groom", relation: { en: "Uncle", bn: "কাকা" }, numbers: [{ number: "+91 90000 00001", call: true, whatsapp: true }, { number: "9000000002", call: true }, { number: "+91…", call: true }] },
        { name: "Test Bride Side", side: "bride", numbers: [{ number: "+91 90000 00003", whatsapp: true }] },
        { name: "Placeholder Only", numbers: [{ number: "+91…", call: true, whatsapp: true }] },
      ];
      window.Invite.contact.render();
    });
    await page.click("#contact-toggle");
    await page.waitForTimeout(400);
    check(await page.locator("#contact-sheet").isVisible(), `${tag}: contact dialog did not open`);
    const hrefs = await page.$$eval("#contact-sheet .contact__btn", (els) => els.map((a) => a.getAttribute("href")));
    check(JSON.stringify(hrefs) === JSON.stringify(["tel:+919000000001", "https://wa.me/919000000001", "tel:+919000000002", "https://wa.me/919000000003"]),
      `${tag}: contact links wrong: ${JSON.stringify(hrefs)}`);
    check(!(await page.locator("#contact-sheet", { hasText: "Placeholder Only" }).count()), `${tag}: contact with only a placeholder number shown`);
    await shot("12-contact-sheet");
    await page.keyboard.press("Escape");
    check(await page.locator("#rsvp-contact .contact__btn").count() === 4, `${tag}: RSVP contact card not filled`);
    await page.locator("#rsvp-contact").scrollIntoViewIfNeeded();
    await shot("13-rsvp-contact");

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
