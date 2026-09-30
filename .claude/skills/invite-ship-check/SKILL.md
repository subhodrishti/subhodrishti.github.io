---
name: invite-ship-check
description: The gate before the invitation link is shared or redeployed — JS syntax, backend unit tests, a Playwright smoke run at phone and desktop sizes in English and Bengali, reduced-motion and no-JS checks, content truth against timeline.json, Bengali review status, audio credits, RSVP endpoint round-trip, privacy sweep, and link-preview tags. Use before deploying, before sending the link to anyone, or before saying a change is done.
---

# Invitation ship check

Run the steps in order. Report each one as **pass**, **fail (with output)** or **skipped (with the reason)**.
Never report a step as passing if it didn't run.

## 1. Syntax

```bash
for f in js/*.js; do node --check "$f" || echo "FAIL $f"; done
```

## 2. Backend tests

```bash
npm test        # node tools/test_backend.js: runs the real Apps Script in a VM with fake Google services
```

## 3. Smoke run (phone 390px + desktop 1440px)

```bash
python -m http.server 5500 --bind 127.0.0.1 &   # if not already running
node tools/smoke.js                              # screenshots → .smoke/
```

`tools/smoke.js` needs the `playwright` package. Install it once with `npm i -D playwright` (it uses the
installed Chrome, so no browser download). Otherwise point `PLAYWRIGHT_MODULE` at an existing install.
It plays the endpoint with the Apps Script harness and fails on any page error, console error, failed request
or horizontal overflow, or if: sound doesn't start on the seal tap, a section is missing its living backdrop or the
light doesn't move (or moves under reduced motion), kantha stitches don't sew in, a hero outfit change doesn't run the pixel
transition (or the crossfade under reduced motion) or leaves effect nodes behind, the hero or events stage shows the wrong outfit, poll percentages don't match the seeded tally, the Bengali switch misses text, or the RSVP row isn't
stored. **Open the screenshots and look at them**: curtain, hero, each outfit change mid-swirl in its colours (`03-hero-<look>`), events stage, poll
result, the Bengali hero, events and RSVP, at both sizes.

## 4. Reduced motion and no-JS

- Run `node tools/smoke.js --reduced-motion`. The curtain must still open, with no petals or confetti canvas.
- Disable JavaScript: the curtain must not appear and the content must still be readable.

## 5. Content truth

- Compare `js/config.js → events` with `../wedding/inputs/timeline.json` (read only). Any difference → run
  the `sync-events` skill first.
- `grep -n "null" js/config.js`: list every "To be announced" field in the report so the family knows.
- Every `photos[]` entry has real `alt` text in both languages and `w`/`h`. Every file referenced exists.
- `_reviewedBy` in `js/strings.js` is filled for `bn`. **If it's empty, flag it**: the Bengali is still
  Claude's draft (`npm run translations` makes the review sheet).
- Event `look` pairings: confirm the family has approved them, or flag them.
- Audio: every file in `audio.tracks` exists, and the footer credit matches `assets/audio/CREDITS.md`.

## 6. RSVP endpoint (blocking)

- `rsvp.endpoint` in `js/config.js` must be a non-empty `https://script.google.com/macros/s/.../exec` URL.
  **If it's empty, stop: fail and don't deploy.** Replies would only reach the guest's own browser.
- Round-trip: only if the user says so in this conversation, submit a clearly fake reply named
  "TEST — delete me" and ask the user to confirm the row arrived and then delete it. Never test with a
  real guest's name or number.
- Apps Script `EVENT_IDS` equals the config's event ids.

## 7. Privacy sweep

```bash
grep -rnE "innerHTML|insertAdjacentHTML|document\.write" js/        # expect nothing
grep -rnE "gtag|analytics|pixel|hotjar|clarity" index.html js/     # expect nothing
```

No new third-party origins beyond fonts.googleapis.com, fonts.gstatic.com and google.com/maps (the embed
loads only when Directions is opened).

## 8. Link preview

`og:image` must be an **absolute** https URL on the deployed host (WhatsApp ignores relative ones). Title
≤ 60 characters, description ≤ 110. Check that `assets/og-image.jpg` exists (1200×628).

## Deploying (only when the user asks)

It's a static folder, so GitHub Pages, Netlify or Vercel all work. Publish `index.html`, `css/`, `js/`
and `assets/` only. Leave `references/`, `tools/`, `backend/`, `.claude/`, `.smoke/`, `package.json` and
`translations-review.csv` out of the published output.
Deploying makes the page public: confirm with the user before the first deploy and before changing the URL
guests already have.
