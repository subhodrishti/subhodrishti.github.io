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

## An avatar look for a ceremony

The avatars appear only in the hero (outfit buttons) and beside the events. There is no avatar gallery.

1. Put the render in `references/`. The existing looks are illustrated, 848×1258 portrait, on dark
   backgrounds; the cut-out uses an ML matting model (`pip install "rembg[cpu]"`, BiRefNet, ~1 GB on first
   run, masks cached in `tools/.cache/`), so busy backgrounds, curtains and floor mats are fine.
2. Add it to `LOOKS` in `tools/cutout_avatars.py` and run `python tools/cutout_avatars.py`. Set its `scale`
   so the couple's heads match Biye's, `sparkle` if Gemini's watermark sits on the couple, and a `stool`-style
   box for any prop the model drops but the look needs. All looks are re-cut together on one floor line,
   each centred on its own couple.
3. **Check the cut-out.** Composite it on navy and emerald and Read the image, alongside the other looks.
   Look at the hair edges, under the arms, the feet, any sheer fabric, and that faces are the same size.
4. Add an entry to `js/config.js → avatars` with `title` (1–2 words), `outfit` (≤ 6 words, describing only
   what is visibly worn), both `{ en, bn }`, and a four-colour `palette` from the outfit or the ceremony,
   which tints the pixel transition. Add its id to `heroLooks` for a hero button, and set the event's
   `look` to show it beside that event.
5. The script rewrites `js/avatar-frame.js`; commit it with the images.

### A looping clip for a look

1. Make the clip from the look's padded start frame: `python tools/cutout_videos.py --start-frames`
   writes `tools/.cache/video/start/<look>.png` (the still on black, 9:16, room around the couple). Use the
   prompt in `tools/avatar-prompts.md` → Looping clips. Reject clips that cut to scenery, add petals or
   sparkles, or change the outfit or pose: they can't be cut out cleanly.
2. Save it as `references/motion/<look>.mp4`, add it to `CLIPS` in `tools/cutout_videos.py` (`loop: "native"`
   if it ends where it began, else `"pingpong"`; `watermark` box around Grok's mark), and run
   `python tools/cutout_videos.py <look>`. BiRefNet needs ~8 GB of RAM and ~25 s a frame on a CPU, so a
   6 s clip takes about an hour the first time; masks are cached.
3. **Check the previews** in `tools/.cache/video/preview/`: the clip on navy and emerald, a contact sheet
   and the loop seam. Look for shimmer on hair, clipped hands, a jump at the seam, and that frame 0 sits
   on the still.
4. Set `video: "assets/avatars/<look>.mp4"` on its `avatars` entry. Keep each clip ≤ ~1.5 MB per 6 s (the
   script raises CRF until it fits).

## Don't

- Don't commit originals with metadata into `assets/`. Originals belong outside the repo or in `references/`.
- Don't hotlink photos from Google Photos, Drive or Instagram. They expire and they track.
