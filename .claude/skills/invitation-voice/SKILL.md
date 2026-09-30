---
name: invitation-voice
description: Tone and wording rules, in English and Bengali, for everything a guest reads on the Subh & Sneha invitation site — curtain greeting, hero lines, event glosses, look names, poll questions and reactions, RSVP labels, errors, thank-you messages, link-preview text and WhatsApp share messages. Use when writing, translating or reviewing any guest-facing copy.
argument-hint: [what you're writing — e.g. "poll questions", "thank-you message", "whatsapp share text"]
---

# Invitation voice

## Who is reading

Guests aged about 8 to 85, family and friends of Subh and Sneha, many reading English as a second language,
nearly all on a phone. Some will have a grandchild read it to them. The invitation comes from **the family**,
not from a website.

## Tone

- **Warm, then clear.** Welcome and blessing first, then say plainly what you need and by when.
- **Personal.** The `?guest=` name appears in the curtain greeting, the hero ("Dear …,") and prefills the form.
  Write so every line also works when there's no name.
- **Respectful across generations.** No slang, no irony, no emoji on the page.
- **Culturally grounded.** Spell ceremonies as `timeline.json` does (Sangeet, Haldi, Wedding, Reception).
  Bengali terms such as Biye, gaye holud, lagna, Ashirbad and Bou Bhaat are welcome in glosses, with a light
  gloss where a non-Bengali guest might not know them.
- **Never pressure.** Declining is a normal answer. "Let us know either way", never "Don't miss out!".

## Two languages, every line

- Every guest-facing line exists in English **and** Bengali: interface words in `js/strings.js` (same keys in
  `en` and `bn`), content in `js/config.js` as `{ en, bn }`. Never add one without the other.
- Bengali register: warm and respectful (আপনি, never তুমি), the way a family invitation card reads. Classic
  invitation phrases are welcome ("শুভ বিবাহে আপনার উপস্থিতি একান্ত কাম্য"). Avoid machine-translation
  stiffness: write the Bengali a mashi would say, not a word-for-word copy of the English.
- Ceremony names in Bengali: সঙ্গীত, গায়ে হলুদ, বিয়ে, প্রীতিভোজ, unless the family prefers others.
  Keep #TeamGroom and #TeamBride in Latin script in both languages; they're hashtags.
- Numbers and dates are formatted by the code (Bengali digits via `Invite.num`, dates via `Intl` bn-IN), so
  write `{n}` and `{date}` placeholders, not digits.
- Names inside a Bengali sentence may be in Latin script (they come from `?guest=`). Phrase greetings so no
  case ending is glued to the name: "প্রিয় {name}," works, "{name}-এর" often doesn't.
- **Claude's Bengali is a draft.** After any Bengali change, run `npm run translations` and tell the user
  that `translations-review.csv` needs a Bengali-speaking family member's review before guests see it.

## Polls (#TeamGroom vs #TeamBride)

- Light, affectionate, and never embarrassing to the couple or anyone else. Nothing about money, weight,
  exes, drinking or family politics.
- A question has two sensible answers: Subh or Sneha. Keep it under about 60 characters.
- Reactions are generic cheers for a side ("The bride's side is cheering."). Never write a result or tally
  into copy. Live percentages come only from the sheet, and the code renders them.

## Buttons, errors and states

- Buttons are verbs that say what happens: "Open invitation", "Send my reply", "Add to calendar",
  "Change my reply". Keep the same verb through the flow (the button "Send my reply" pairs with the
  error "…press Send my reply again").
- Errors say what to do next: "Enter your name so we know who's replying." No apologies, no "invalid".
- Empty states invite action or say when to come back ("Look again closer to December.").
- Unknown facts read "To be announced". Never fill a gap with a guess.

## Channel limits

| Where | Field | Limit |
|---|---|---|
| Curtain | `strings.js → curtain.greeting` / `curtain.greetingNamed` | ≤ 6 words, `{name}` placeholder |
| Curtain button | `strings.js → curtain.open` | 2–3 words, a verb |
| Event gloss | `config.js → events[].gloss` | ≤ 8 words |
| Poll question | `polls.questions[].text` | ≤ 60 characters |
| Look name / outfit | `avatars[].title` / `.outfit` | 1–2 words / ≤ 6 words, describing only what is visibly worn. Never phrase it as a dress code |
| Link preview | `<title>` and `og:*` in `index.html` | Title ≤ 60 characters. Description ≤ 110, still makes sense cut at 65 |
| WhatsApp share (drafted for the family to send) | not stored | 60–90 words, link on its own line, at most 1–2 emoji |

## Before handing a draft back

- [ ] Read it aloud at the pace of someone's grandmother
- [ ] One call to action; deadline stated only if the family has set one
- [ ] Works with and without a guest name
- [ ] Bengali written for both, and the review CSV regenerated
- [ ] Promises nothing the site doesn't do (there is no confirmation email or SMS)
- [ ] Say where each line goes (`js/strings.js` key or `js/config.js` path)
