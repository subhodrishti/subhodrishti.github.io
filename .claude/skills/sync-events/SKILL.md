---
name: sync-events
description: Copy event dates, times and venues from the Command Deck's ../wedding/inputs/timeline.json into js/config.js so the invitation's event cards, countdown, calendar files and directions stay correct. Read-only on the source. Use when timeline.json changes, when someone says a time or venue is confirmed, or before sharing the invitation.
---

# Sync events from the wedding timeline

`../wedding/inputs/timeline.json` is the family's source of truth, maintained by hand through
`wedding-tracker.xlsx`. The invitation keeps its own copy in `js/config.js → events`, so it can be deployed
on its own. This skill moves facts **one way only**: timeline → config.

## Hard rules

- **Never write to anything under `../wedding/`.** Not timeline.json, not guests.json, not data/*.json.
  If the source looks wrong, tell the user and stop.
- Copy facts; don't invent them. A `null` in the source stays `null` in the config.
- Keep each config event's `gloss` (`{ en, bn }`) and `look`. They're invitation copy, not timeline data.

## Field mapping

| timeline.json `events[]` | config.js `events[]` | Notes |
|---|---|---|
| `event_id` | `id` | Must match `EVENT_IDS` in `backend/google-apps-script.gs` |
| `name` | `name.en` | Spelling exactly as in the source. `name.bn` is invitation copy: keep it, or draft one for a new event |
| `date` (YYYY-MM-DD) | `date` | IST calendar date |
| `start_time` / `end_time` | `startTime` / `endTime` | 24-hour `"HH:MM"` in IST. Convert "6:30 PM" → `"18:30"` |
| `venue` (string) | `venue: { name, address }` | Put the venue's name in `name`. If the string has a street address after the name, split it into `address`. `null` stays `null` |
| `notes` | not copied | Internal notes stay internal |

Also keep `dateLine` ("10–13 December 2026 · Kolkata") consistent with `wedding_window`.

## Steps

1. Read `../wedding/inputs/timeline.json` and `js/config.js`.
2. Build a table of differences per event: field, config value, timeline value.
3. If an event was **added or removed**:
   - Add or remove it in `config.js` in date order (same-day events keep timeline order).
   - Update `EVENT_IDS` in `backend/google-apps-script.gs` and remind the user to redeploy the Apps Script
     as a new version.
   - Ask the `invite-copywriter` agent, or follow `invitation-voice`, for `name.bn` and a gloss in both
     languages, 8 words or fewer. Set `look` to `null` unless the family has paired an outfit with it.
   - Keep the section heading "Four days in Kolkata" in `index.html` true, or flag it.
4. Apply the edits to `js/config.js` only.
5. Run `node --check js/config.js`, then open the page (or run `node tools/smoke.js`) and look at the Events
   section and the countdown label.
6. Report the difference table, what you changed, and anything left "To be announced".
