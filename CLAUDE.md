# Subh & Sneha — interactive wedding invitation

A single-page, static invitation site for the 10–13 December 2026 Kolkata wedding: a velvet curtain
that opens to the family's background music, falling petals, a couple whose 3D avatars change into each
ceremony's outfit through a swirl of pixels in that ceremony's colours and then loop as animated cutouts, a gallery of real photos, event cards with a live countdown and directions, #TeamGroom vs
#TeamBride polls with live results, and an RSVP form that writes to a Google Sheet. English and Bengali.

Guests are family and friends aged 8 to 85, mostly on a phone, opening a link someone forwarded on WhatsApp.

## Stack and how to run it

- Plain HTML, CSS and JavaScript. **No build step, no framework, no runtime dependencies.** Scripts are
  classic `defer` scripts that hang off `window.Invite`, so `index.html` also works opened straight from disk
  (sound is limited there).
- `npm run serve` (or `python -m http.server 5500`), then open http://127.0.0.1:5500.
- Every link needs an invite code: `?invite=t5fntb22` (all events), `?invite=246w64vb` (Haldi and Wedding)
  (codes in `config.js → invites`). No code, or an unknown one, shows the "invitation not found" page.
  The smoke test adds its own `smoke-*` codes in the test browser only.
- Test links: `?invite=t5fntb22&guest=Rina%20Mashi` (personal greeting, prefilled name), `&lang=bn` (open in Bengali),
  `&open=1` (skip the curtain). The curtain stays open for the rest of a browser session once opened.
- Tests: `npm test` (the Apps Script backend, in a Node VM with fake Google services) and `npm run smoke`
  / `npm run smoke:reduced` (Playwright + installed Chrome; the backend harness plays the endpoint).
  `npm i -D playwright` once, or set `PLAYWRIGHT_MODULE` to an existing install.

## Where things live

| Path | What |
|---|---|
| `js/config.js` | **All content**: names, events (with each event's `look`), avatar looks, photos, poll questions, audio tracks and credits, RSVP endpoint. Guest-facing values are `{ en, bn }` |
| `js/strings.js` | The page's own interface words in `en` and `bn`, filled by `Invite.t(key, vars)` and `[data-i18n]` |
| `index.html` | Page skeleton, SVG ornaments (`#alpana-seal`, `#alpana-rule`, `#i-sound`), dialogs |
| `css/styles.css` | Tokens at the top, then one block per section in page order, then wardrobe, language and sound, poll results, Bengali overrides, and reduced motion last |
| `js/invites.js` | Reads `?invite=`, narrows `INVITE.events`, hero looks and date line to that invite before anything renders; otherwise shows `#not-found` |
| `js/util.js` | `h()`, language (`lang`, `setLang`, `L`, `t`, `num`), IST date formatters, `store`, `postJSON`/`getJSON`, `deviceId` |
| `js/wardrobe.js` | Outfit change in place: stacks the looks, runs the transition in the incoming look's `palette`, settles cleanly when interrupted. Used by the hero and the events stage |
| `js/transitions.js` | `pixel` (the outfit breaks into pixels that swirl in 3D on a canvas and re-form; given a `ready` promise it keeps swirling until it settles, up to `maxWait`) and `fade` (reduced motion, or when pixels can't be read on `file://`) |
| `js/alpha-video.js` | A look's looping clip: one H.264 MP4 with colour and alpha side by side, recombined by a small WebGL shader on a canvas over the still, which is hidden while the clip shows. `prepare()` downloads ahead of play. Any failure (no WebGL or codec, autoplay refused, `file://`) brings the still back |
| `js/avatar-frame.js` | **Generated** by `tools/cutout_avatars.py`: the frame size and the couple's core width |
| `js/audio.js` | Background music (plus the ulu once recorded), started inside the seal tap; mute button in the top bar; `level()` for the backdrop, `blow()` for the hero conch |
| `js/ambient.js` | The living backdrop: aurora, pointer-lit alpana lattice, floating Bengal motifs (`#m-*` in `index.html`) reacting to pointer, tilt, scroll and music; kantha stitches; lean-in gold buttons. Layout per section in `LAYOUT` |
| `js/curtain.js` `petals.js` `countdown.js` `families.js` `gallery.js` `events.js` `polls.js` `rsvp.js` `confetti.js` | One file per feature, each exposing `init()` and `render()` on `window.Invite` |
| `js/main.js` | Boot order, language switch, hero outfit buttons. On `invite:lang` it calls every `render()` |
| `backend/google-apps-script.gs` | RSVP rows and poll votes (one per browser per question), tallies via `?type=tallies` |
| `assets/avatars/*.webp` | The four ceremony looks, cut out by `tools/cutout_avatars.py` (rembg/BiRefNet, dev only) from the illustrated `references/{sangeet,haldi,wedding,Reception}.png`: evened to one scale, same floor line, **each centred on its own couple**, with a soft gold rim glow baked in. (`wedding-couple*.png` and `subh_sneha*.png` are earlier 3D renders, kept as source art, not shown) |
| `assets/avatars/*.mp4` | The looks as looping animated cutouts (`avatars[].video`), cut by `tools/cutout_videos.py` from the family's Grok clips in `references/motion/`: the same matting, glow and frame as the stills, placed once per clip so frame 0 lands on the still. Colour premultiplied on the left, alpha on the right, ≤ ~1.5 MB per 6 s |
| `assets/audio/` | `background-audio.mp3` (the family's track, made from `background-audio.mpeg`; loops from the seal tap), `shankh.mp3` (CC BY, hero conch tap only, credited in the footer). `shehnai.mp3` is no longer played. `CREDITS.md` has sources and how to add a family-recorded `ulu.mp3` |
| `assets/families/` | Waist-up bride and groom portraits for "Our families", cut from `references/families/` by `tools/cutout_portraits.py` (same scale, same window, each centred on its own figure) |
| `assets/photos/` | Real photos, added only through `tools/add_photo.py` (strips GPS and camera metadata) |
| `assets/decor/` | Painted decorations (marigold toran and thread, shola chandmala, terracotta arch, torn paper, alpana corners), made by `tools/prepare_decorations.py`. Where each goes: `invite-design-system` → Decorations |
| `references/` | Original 3D renders, `motion/` (the Grok clips behind `assets/avatars/*.mp4`), and `decorations/` (the generated art behind `assets/decor/`). Source art: don't serve, edit or delete |
| `tools/` | `cutout_avatars.py`, `cutout_videos.py`, `cutout_portraits.py`, `prepare_decorations.py`, `add_photo.py`, `gas_harness.js`, `test_backend.js`, `smoke.js`, `export_translations.js` |

## Rules

- **Never invent wedding facts.** Times, venues, dress codes, RSVP deadline, hashtags and family names are
  unknown until the family says so. Leave them `null` in `config.js`; the page shows "To be announced".
- **Event data comes from `../wedding/inputs/timeline.json`** (the Command Deck's source of truth). Copy it in
  with the `sync-events` skill. Never write to anything under `../wedding/` from this project. In particular
  only `/rsvp-update`, invoked directly by Subhadip, may write `../wedding/inputs/guests.json`.
- **Invite codes pick the events.** `config.js → invites` maps a code to event ids. Every renderer reads
  `get("events")`, so narrow there, never per section. The saved reply is kept per code (`invite:rsvp:<code>`).
  Codes are readable in the page source: a convenience, not access control. The RSVP endpoint still accepts any event.
- **Event `id`s are a contract.** RSVP rows store them and the Apps Script validates against `EVENT_IDS`.
- **Event looks are the couple's own outfits**, from the family's themed renders (`sangeet`, `haldi`, `biye`,
  `reception`). The page never tells guests what to wear; setting every `look` to `null` removes the events stage.
- **One transition, coloured per ceremony.** Every look change is the pixel swirl; `avatars[].palette`
  (four hex colours) tints it for that ceremony. The family chose this over several different transitions,
  so don't add more; change colours instead. Reduced motion crossfades.
- **Looks may loop, the still stays underneath.** A look with `avatars[].video` plays its clip over the still once a
  change into it settles, and the still steps out (`is-covered`) so it can't show through; the swirl breaks apart the
  frame on screen. Every clip is prefetched by `wardrobe.preload()` after the opening, and a change into a look whose
  clip hasn't arrived keeps swirling for up to 5 s (`CLIP_WAIT`) so the pixels land into the moving couple. Clips
  pause off-screen, in hidden tabs and while the paan leaves cover the bride, and never play under reduced
  motion, Save-Data or `file://`. New clips must stay on plain black the whole time (no scenery, petals or
  outfit change) and start from `python tools/cutout_videos.py --start-frames` so Grok doesn't crop the couple;
  prompts are in `tools/avatar-prompts.md`.
- **The gallery is real photos only.** The 3D avatar section was removed at the family's request; the
  avatars appear only in the hero and beside the events.
- **Wardrobe images must not be capped** by the base `img { max-width: 100% }`: `.wardrobe__layer` sets
  `max-width: none`, or the couple is squeezed and pushed off-centre.
- **Every guest-facing string exists in both languages.** New text goes in `strings.js` (interface) or as
  `{ en, bn }` in `config.js` (content), and every renderer re-renders on `invite:lang`. The Bengali is
  Claude's draft until a Bengali-speaking family member reviews it: run `npm run translations`, send them
  `translations-review.csv`, apply their corrections, and set `_reviewedBy` in `strings.js`.
- **Sound only after a tap**, always with a visible off switch (curtain chip + top-bar button), and credited
  in the footer while CC BY clips are used. Don't autoplay on load.
- **Poll numbers must be real.** Percentages appear only from the endpoint's tally, and as counts below
  `polls.minVotesForPercent`. Without an endpoint, no numbers are shown.
- **Guest text is never HTML.** Build DOM with `Invite.h()` or `textContent`; no `innerHTML` with config or
  user data. The Apps Script prefixes cells starting with `= + - @` so they can't run as formulas.
- **No trackers.** No analytics or third-party scripts beyond Google Fonts and the Maps embed that loads only
  when a guest opens Directions. The poll `device` id is a random string, not a fingerprint.
- **Don't ship with an empty `rsvp.endpoint`.** `invite-ship-check` blocks on it.
- **Design system**: tokens in `css/styles.css :root`; follow `invite-design-system`. One light theme on purpose.
- **The backdrop stays behind.** Motifs sit in margins, never over text or cards; new objects must be real
  Bengali wedding things in the same gold line style (see `invite-design-system`). It must stay cheap: one
  rAF loop, transforms only, paused off-screen and in hidden tabs.
- **Motion has an off switch.** Everything animated degrades under `prefers-reduced-motion` (the wardrobe
  crossfades and shows stills, no petals or confetti), and petals can be paused from the footer.

## Relationship to the other wedding projects

`../wedding-command-deck` (Next.js + Supabase) has its own token-gated RSVP invitation at `app/rsvp/[token]`
with per-guest `events_invited` and `invited_count`. This site doesn't read those yet, so any guest can tick
every event. Connecting to the deck's `rsvp_*` functions is the planned next step; until then don't sync
RSVPs between the two silently.

## Skills and agents in this repo

- Skills: `invite-design-system`, `invitation-voice`, `sync-events`, `add-gallery-media`, `invite-ship-check`
- Agents: `invite-frontend` (builds UI), `invite-copywriter` (guest-facing words in both languages, drafts
  only), `invite-qa` (read-only review before anything is shared)
