---
name: add-gallery-media
description: Add real photos to the invitation's gallery, or a new or replacement 3D avatar look for a ceremony (shown in the hero and beside the events) — strips GPS/camera metadata, resizes to web WebP, cuts avatars out of their studio backdrop, and registers them in js/config.js with alt text and colours. Use when the user shares photos or new avatar renders for the invitation.
argument-hint: [path(s) to the image files]
---

# Add gallery media

## Real photos → the gallery

1. **Look at every image first** (Read it) before publishing anything. Skip or flag anything that shows
   people other than the couple who might not want to be on a public page, children, screenshots of
   chats, or documents.
2. Process them:
   ```bash
   python tools/add_photo.py path/to/one.jpg path/to/two.heic --prefix 2024-puja
   ```
   This applies the EXIF rotation, **drops all metadata (GPS, camera, timestamps)**, sizes the long edge to
   1600px, and writes `assets/photos/<prefix>-N.webp`. It prints a ready-made config line per photo with
   `w` and `h` filled in.
3. Paste the lines into `js/config.js → photos`. `alt` and `caption` are `{ en, bn }`. Write each `alt` from what you actually see
   ("Subh and Sneha laughing on a boat at Prinsep Ghat"). Name only Subh and Sneha. Ask the user for
   anyone else's name, the place, or the year. Never guess them. `caption` is optional and short.
4. Order the photos oldest to newest, unless the user asks otherwise.
5. Check: open the page, go to the gallery, and confirm the "on their way" note is gone and the lightbox opens.

## A 3D avatar look for a ceremony

The avatars appear only in the hero (outfit buttons) and beside the events. There is no avatar gallery.

1. Put the render in `references/`. The cut-out expects the same generator style as the existing ones:
   the couple centred on a smooth blue studio gradient, 1376×768. It handles the generator's cyan rim glow
   (`GLOW_PX`, `GLOW_LIFT`), sky pockets under arms and between shoulders, and wide hems up to x≈1000
   (`COUPLE_X`).
2. Add it to `LOOKS` in `tools/cutout_avatars.py` and run `python tools/cutout_avatars.py`. All looks are
   re-cut together at one size and floor line, each centred on its own couple (check the printed gaps:
   left and right should match).
3. **Check the cut-out.** Composite it on navy and emerald and Read the image. Look at the hair edges, under
   the arms, the feet and any sheer fabric. If the outfit is itself sky-blue or cyan, raise `LEGS_Y` (the
   strict cyan test) to knee height, 440, or it will eat the clothing.
4. Add an entry to `js/config.js → avatars` with `title` (1–2 words), `outfit` (≤ 6 words, describing only
   what is visibly worn), both `{ en, bn }`, and a four-colour `palette` from the outfit or the ceremony,
   which tints the pixel transition. Add its id to `heroLooks` for a hero button, and set the event's
   `look` to show it beside that event.
5. The script rewrites `js/avatar-frame.js`; commit it with the images.

## Don't

- Don't commit originals with metadata into `assets/`. Originals belong outside the repo or in `references/`.
- Don't hotlink photos from Google Photos, Drive or Instagram. They expire and they track.
