---
name: invite-design-system
description: Visual rules for the Subh & Sneha invitation — colour tokens, the Bodoni/Jost and Tiro Bangla/Hind Siliguri type systems, glass cards, arch shapes, alpana ornaments, the outfit-change wardrobe, sound controls, motion and reduced-motion behaviour, and phone layout. Use before adding or restyling any section, component, animation or image treatment on the invitation site.
---

# Invitation design system

## The idea

A royal Bengali wedding at night. The page is a **navy velvet stage** (curtain, hero, RSVP) that opens
onto **cream paper** (gallery, polls) and one **emerald band** (events). Gold is the thread that ties it
together: trims, hairlines, the alpana seal. The one thing people remember is the curtain held shut by a
gold alpana seal, and everything else stays quiet so that moment lands.

## Tokens (`css/styles.css :root`)

| Token | Hex | Use |
|---|---|---|
| `--navy` / `--navy-deep` / `--navy-ink` | #1b3b5f / #0f2440 / #0a1a2e | Stage surfaces, headings on cream, footer |
| `--gold` / `--gold-light` / `--gold-dark` | #d4af37 / #f1dc94 / #8f6d14 | Accents, primary buttons, trims. `--gold-dark` for gold text on cream (contrast) |
| `--emerald` / `--emerald-deep` | #0f5257 / #0a3a3e | Events band, #TeamBride |
| `--cream` / `--cream-2` | #fdfbf7 / #f5efe2 | Paper sections, modals |
| `--ink` / `--ink-soft` | #1d2a3a / #4c5a6b | Body text on cream |
| `--sindoor` | #b3262e | Reserved. Tiny doses only (a bindi-sized dot), never a fill |

Never write a raw hex in a new rule. If you need a new colour, add a token with a comment saying what it's for.

## Type

- **Bodoni Moda italic** (`--f-display`) for names, section titles, event names, poll questions. Weight 400–500.
  Big and sparse; never for paragraphs or labels.
- **Jost** (`--f-body`) for everything else. Labels are uppercase with 0.12–0.3em tracking at `--step--1`.
- **Tiro Bangla** (`--f-bn`) only for Bengali script (শুভ বিবাহ). Mark it `lang="bn"`.
- Use the fluid scale `--step--1` … `--step-hero`. Don't add one-off font sizes.
- The `&` in the monogram and names is gold, upright, 0.72em. In Bengali it becomes "ও".
- **Bengali** (`html:lang(bn)`): display switches to Tiro Bangla, body to Hind Siliguri, and all tracking and
  uppercase are removed (they break conjuncts). Headings get line-height 1.3 so vowel signs aren't clipped,
  and `font-synthesis: none` stops faux italics. The S&S monogram stays Bodoni (`--f-mono`) in both
  languages. Check any new text style in both languages.

## Surfaces and shapes

- **Glass**: `.glass` plus `.glass--dark` (on navy or emerald) or `.glass--light` (on cream). 1px gold edge at
  38% alpha, 16px blur. Don't nest glass in glass.
- **Arch** (`--arch`) for anything that frames the couple: gallery cards, the hero outline. It echoes a
  thakur-dalan / mandap arch. Rectangles with `--radius` for everything else.
- **Ornaments**: `#alpana-rule` above every section title; `#alpana-seal` inside `.seal__disc` with the S&S
  monogram.
- **Bengal motifs** (`#m-*` symbols in `index.html`): shankha, kulo, topor, mangal ghot, joda maach, sindoor
  kouto, shankha-pola, paan, pradip (animated flame), shehnai. The style is fine gold line art (stroke 2.4 on
  a 100 viewBox, round caps), `class="fill"` for solid gold dots and `class="sindoor"` / `sindoor-line` for
  bindi-sized vermilion accents. A new motif must be a real object from a Bengali wedding, drawn in the same
  hand, and previewed on navy before use. They live only in the living backdrop and the footer skyline,
  never inside cards or over text blocks.

## The wardrobe (outfit change in place)

- `Invite.wardrobe.create(el, { initial })` stacks every look; `show(id)` changes into it with the **pixel
  transition** (1.9s): the outfit breaks into ~2,400 pixels that swirl once around the couple in 3D, take on
  the incoming ceremony's `palette`, and settle into the new outfit. It is the only transition, by the
  family's choice; vary colour, not motion.

  | Look | Palette |
  |---|---|
  | Sangeet | lehenga pink, blush, gold |
  | Haldi | marigold, turmeric |
  | Biye | sindoor red, gold, shola white |
  | Reception | maroon, champagne, gold |

- The frame is sized by the couple's **core width** (`js/avatar-frame.js`); each layer is the full frame,
  centred, so a long pallu overflows instead of shrinking the couple. `.wardrobe__layer` must keep
  `max-width: none`.
- Every look is cut out at the same size and floor line, each centred on its own couple. Re-run
  `tools/cutout_avatars.py` for all looks together.
- The hero has outfit buttons (`.chip`, `aria-pressed`). The events stage follows the card crossing the
  middle 16% of the screen: a sticky arch on desktop, and a strip pinned under the top bar on phones.

## The living backdrop (`js/ambient.js`)

- Hero, gallery, events, polls and RSVP each get layers behind their content: drifting **aurora** colour,
  a faint **alpana lattice** brightened inside a 560px **light** that follows the pointer (and wanders when
  nobody moves), and 4–10 **motifs** at depths 0.3–1.2 that shift with pointer, phone tilt and scroll,
  glow when the pointer is near, and breathe with the shehnai (`audio.level()`).
- Tones: `night` (navy), `emerald`, `paper` (cream, gold-dark ink at lower opacity).
- Placement is `LAYOUT` in `ambient.js`, in % of the section, with a sparser `phone` set pushed to the
  edges. Keep motifs in the margins: never behind a paragraph, form field or card.
- The hero conch is a button ("Blow the shankh"): tap to blow it, only if sound is on.
- Kantha running stitches sew themselves along section tops (`sindoor` thread on cream, `gold` on dark).
- Grain over the page (5%), a gold-foil sheen on the `&` and footer monogram, and gold buttons and chips
  that lean up to 8px towards the cursor.
- Footer: the Howrah Bridge over the Hooghly with twinkling lights.
- Performance: one rAF loop, only while a backdrop is on screen; everything moves by transform (the lens
  slides and its pattern counter-slides). Under reduced motion nothing moves, the light is hidden, and the
  stitches are simply there.

## Sound controls

- The curtain has a "With sound / Without sound" chip under the seal. The top bar has a 44px round
  speaker button (`#music-toggle`, `#i-sound` icon; the wave or cross shows via `aria-pressed`). Never put a
  floating button over content: it covered poll results on phones.

## Avatars and photos

- Avatar cut-outs are transparent WebPs with backdrop-spill removed from the edges. Place them on navy with a gold floor glow and a drop shadow
  (see `.hero__stage::after`, `.look__card`). Never put them on a busy background or crop off heads or feet.
- Size them by **height** (`height: 70%; width: auto`) inside fixed-aspect frames. The four looks have
  slightly different widths.
- Real photos sit on cream in a masonry column list, 18px radius, lazy-loaded with width and height set.

## Motion

- The **curtain** is the only choreographed sequence (1.7s). The hero lines rise in a 110ms stagger after it.
- Ambient: petals canvas (≤ 36 petals, DPR capped at 2, paused when the tab is hidden), the slow seal spin,
  and the living backdrop above (aurora 26–38s loops, motif bob ≤ 13px, parallax ≤ 24px).
- Micro: hover lifts ≤ 4px, card tilt ≤ 14°, 0.25–0.5s with `--ease-out`.
- Story: the pixel outfit change (hero buttons and events scroll) and poll result bars growing (0.9s).
- One-shot: confetti on an RSVP yes only.
- **Reduced motion**: every state change still happens, without travel. The curtain fades, there are no
  petals or confetti, the tilt is off and polls cross-fade. Add the matching rule to the reduced-motion
  block at the end of `styles.css` whenever you add movement.

## Layout

- Max content width 1180px. Side gutter `--gutter` (16px on phones). Sections pad `--section-y`.
- Check at **375px** and 1440px. No horizontal page scroll.
- Tap targets are at least 44px tall. Visible focus is a gold ring (navy on cream).
- At 860px and below the hero is one column: copy, then the couple, then countdown and buttons.

## Before you call it done

- [ ] Only tokens and existing type steps used
- [ ] Looked at it at 375px and 1440px, **in English and Bengali** (screenshots via `npm run smoke`)
- [ ] Reduced motion checked (DevTools → Rendering → prefers-reduced-motion)
- [ ] Nothing new sits above the curtain (z-index 100) or modals except confetti
- [ ] Removed one decoration you added but don't need
