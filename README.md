# Subh & Sneha — wedding invitation

A static, phone-first invitation for 10–13 December 2026, Kolkata, in English and Bengali. Guests
open a velvet curtain to the family's background music, watch the couple's 3D avatars change into each ceremony's outfit,
see the Sangeet, Haldi, Wedding and Reception with directions and a live countdown, play #TeamGroom vs
#TeamBride with live results, and send an RSVP.

## Run it

```bash
npm run serve          # or: python -m http.server 5500
# open http://127.0.0.1:5500/?guest=Rina%20Mashi   (add &lang=bn for Bengali)
npm test               # backend logic
npm run smoke          # full guest journey in Chrome (needs: npm i -D playwright)
```

Opening `index.html` directly from disk also works.

## Before sharing the link

1. **RSVP collection**: follow the steps at the top of `backend/google-apps-script.gs` (about 5 minutes), then
   paste the web-app URL into `js/config.js → rsvp.endpoint`.
2. **Event details**: times and venues are `null` ("To be announced") until confirmed in
   `../wedding/inputs/timeline.json`. Copy them over with `/sync-events`.
3. **Photos**: add real photos with `python tools/add_photo.py …` (removes GPS data), then list them in
   `js/config.js → photos`.
4. **Bengali review**: `npm run translations` writes `translations-review.csv`. A Bengali-speaking family
   member fills in corrections, then Claude applies them.
5. **Look pairings**: confirm which outfit shows beside each event (`events[].look` in `js/config.js`), or
   set them to `null`.
6. **Ulu**: record the family's own ulu and drop it in (see `assets/audio/CREDITS.md`).
7. **Link preview**: after deploying, make `og:image` in `index.html` an absolute URL.
8. Run the checks in `.claude/skills/invite-ship-check/SKILL.md`.

Personal links: add `?guest=Name` to greet a guest by name and prefill their RSVP.

## Everything that changes lives in `js/config.js`

Names, date line, events, avatar looks, photos, poll questions, sound and the RSVP endpoint, each in
English and Bengali. The page's own button and label wording is in `js/strings.js`.
