# Avatar regeneration prompts

Prompts for re-rendering the couple's 3D avatars, one look per event, written for Gemini image
editing (the tool that made `references/subh_sneha*.png`). They also work in ChatGPT image editing.

The outfits are **suggestions for the family to confirm**, like every `events[].look`. If Sneha or
Subh already know what they'll wear, swap the colours and fabrics in the outfit block and keep
everything else.

## Why these constraints

| Constraint | Reason |
|---|---|
| Same pose, same camera, same place in frame for all four | The page swaps outfits in place with one shared crop box (`tools/cutout_avatars.py`). If the couple moves between renders, they jump on screen. |
| Keep the smooth blue studio backdrop | The cut-out script fits and removes that exact gradient. |
| No sky-blue, turquoise or cyan in the clothes | Those get keyed out with the backdrop and leave holes. |
| No navy, and no emerald or dark teal as the main garment colour | The avatars sit on navy (hero, gallery cards) and over the emerald events band. The old "Festive" look (navy suit and emerald anarkali) disappeared against both. Emerald trim is fine. |
| Veils and dupattas semi-opaque | A sheer fabric lets the blue show through, so it turns blue on the page or gets cut away. |
| Extra headroom above the heads | The groom's topor is tall. All four renders share one crop, so every look needs the same headroom. |
| Warm gold rim light from behind | It blends into the gold floor glow the page puts under the couple. |

## Workflow

1. Generate **Biye** first, attaching `references/subh_sneha.png` (for faces, bodies and pose).
2. Generate the other three, attaching **both** `references/subh_sneha.png` and your new Biye
   render. Use the Biye render for scale and position, and the original for the faces.
3. Put the four PNGs into `references/`, overlaid on the Biye render, and check that heads, hands and feet
   line up. Regenerate any that drift.
4. Ask Claude to re-tune `tools/cutout_avatars.py` (file map, `COUPLE_X`, `FLOOR_Y`, `LEGS_Y`),
   update the look ids and captions in `js/config.js` in both languages, and re-run the cut-out.

---

## Shared block (paste at the start of every prompt)

```
Edit the attached image. Keep the two characters exactly the same people: same faces, facial
features, skin tones, hairstyles, body proportions and heights. Keep the same pose: standing side
by side facing camera, groom on the left, bride on the right, her hand resting on his arm, their
hands clasped at the centre, both smiling warmly.

Camera and framing, identical for every version: full body from head to toe, straight-on at
chest height, 16:9 landscape, 1376x768. The couple is centred horizontally and occupies the
middle third of the width. Zoom out slightly from the original so there is clear empty backdrop
above the tallest headpiece (about 12% of the image height), and the feet sit just above the
bottom edge. Nothing is cropped.

Background: the same smooth, plain sky-blue studio gradient as the original, lighter towards the
floor, with no props, no floor pattern, no text, no logo, no sparkles or decorations.

Style and polish: premium Pixar-quality 3D character render. Soft key light from the front left,
gentle fill, and a warm golden rim light from behind that outlines the hair and shoulders. Rich
fabric detail: visible silk sheen, woven zari texture, crisp embroidery, jewellery with real
metallic reflections. Clean, well-defined silhouette edges; hair neat with no loose strands
floating into the background. Any veil or dupatta is semi-opaque, not see-through. The clothing
contains no blue, turquoise or cyan anywhere.
```

---

## 1. Biye (wedding) — `biye`

```
[Shared block]

Outfit — a traditional Bengali Hindu wedding (biye):

Bride: a classic red Banarasi silk saree with heavy gold zari buttis and a wide gold border,
draped in the Bengali style, with a matching red net veil (ghomta) with a gold border, draped
softly over the back of her head. A white shola mukut (Bengali bridal crown of pith) sits on her
head. Delicate white chandan (sandalwood) dots arch above her eyebrows in the traditional
pattern, with a small red bindi at the centre. Gold jewellery: a choker, a long layered sita haar,
jhumka earrings and a tikli on the forehead. On each wrist a white shankha and a red pola bangle
among gold bangles. Barefoot, with red alta on her feet and fingertips.

Groom: an ivory raw-silk panjabi (kurta) with a fine gold-embroidered placket, a cream pleated
Bengali dhoti, and a deep red silk uttoriyo (shawl) draped over one shoulder. On his head a white
conical shola topor (Bengali groom's headdress) with delicate cut-work. A few white chandan dots on
his forehead. Gold-embroidered ivory nagra shoes.

Mood: joyful and a little shy, the auspicious moment.
```

## 2. Gaye holud (Haldi) — `holud`

```
[Shared block — attach the Biye render too and match its scale and position exactly]

Outfit — the Bengali gaye holud (turmeric blessing), bright and playful:

Bride: a turmeric-yellow cotton-silk saree with a red border (lal paar), draped Bengali style,
no veil. Flower jewellery (phooler gohona) instead of gold: a tiara, necklace, earrings and bangles
made of orange marigolds and white rajnigandha / jasmine buds. Hair in a loose low bun with
white flowers. A light smudge of turmeric paste on one cheek. Barefoot with a thin line of alta.

Groom: a mustard-yellow cotton panjabi with a small white chikan-style embroidery at the collar,
white pajama, a marigold garland around his neck, a light turmeric smudge on one cheek. Brown
leather kolhapuri sandals.

Mood: laughing, candid and warm, like a morning family ritual.
```

## 3. Sangeet — `sangeet`

```
[Shared block — attach the Biye render too and match its scale and position exactly]

Outfit — a glamorous evening of music and dance:

Bride: a rani-pink (deep magenta) silk lehenga with gold gota-patti and mirror work that catches
the light, a fitted matching blouse, and a semi-opaque pink dupatta with a gold border draped over
one shoulder. Statement gold chandbali earrings, a slim maang tikka and stacked glass and gold
bangles. Gold embroidered juttis.

Groom: an ivory silk kurta with churidar, under an antique-gold brocade Nehru jacket with a small
rani-pink pocket square that matches the bride. Ivory embroidered mojris.

Mood: festive and ready to dance, bright eyes, big smiles.
```

## 4. Reception (Bou bhaat / Reception) — `reception`

```
[Shared block — attach the Biye render too and match its scale and position exactly]

Outfit — an elegant evening reception, the newly married couple:

Bride: a champagne-gold tissue Banarasi silk saree with a broad deep-maroon and gold border, draped
Bengali style with the pallu over one arm, no veil. A thin line of sindoor in her hair parting and
a small red bindi. On her wrists the white shankha, red pola and a gold loha bangle among gold
bangles. A refined gold and uncut-diamond necklace with matching earrings. Hair in a low bun with
a string of white jasmine. Gold heeled sandals.

Groom: a deep maroon silk sherwani with fine tonal and gold embroidery at the collar and cuffs,
ivory churidar, and an ivory silk stole draped over one shoulder. Maroon and gold embroidered
mojris.

Mood: poised, radiant and relaxed, hosting their guests.
```

---

## If a result is off

Add one of these lines to the end of the prompt and regenerate:

- Faces changed: `Do not alter the faces at all; copy them exactly from the first attached image.`
- Moved or rescaled: `Match the second attached image pixel-for-pixel in the couple's position, height and pose; only the clothes change.`
- Blue showing through fabric: `Make the veil/dupatta fully opaque where it overlaps the background.`
- Too busy: `Simplify the jewellery; keep the silhouette clean.`
- Headpiece cropped: `Zoom out so the top of the topor has clear space above it.`

## Palette check (against `css/styles.css`)

| Look | Bride | Groom | On navy | On emerald |
|---|---|---|---|---|
| Biye | red + gold | ivory + red | ✓ | ✓ |
| Holud | yellow + red, flowers | mustard + white | ✓ | ✓ |
| Sangeet | rani pink + gold | ivory + antique gold | ✓ | ✓ |
| Reception | champagne gold + maroon | maroon + ivory | ✓ | ✓ |
