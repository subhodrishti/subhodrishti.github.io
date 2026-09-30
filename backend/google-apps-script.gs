/**
 * RSVP + poll collector for the Subh & Sneha invitation.
 *
 * Setup (once, about 5 minutes):
 *   1. Create a Google Sheet. Extensions → Apps Script. Paste this file.
 *   2. Deploy → New deployment → Web app.
 *        Execute as: Me.   Who has access: Anyone.
 *   3. Copy the /exec URL into js/config.js → rsvp.endpoint. Polls use the
 *      same URL unless polls.endpoint is set.
 *   4. After editing this script, Deploy → Manage deployments → edit →
 *      Version: New version. The URL stays the same.
 *
 * Tabs "RSVPs" and "Polls" are created on first write. Poll votes are keyed
 * by a random per-browser id, so changing a pick updates the row instead of
 * adding one. Guests only ever receive totals, never rows.
 *
 * Nothing here ever writes to wedding/inputs/guests.json; import from the
 * sheet with /rsvp-update in the Command Deck when you choose to.
 *
 * Tested locally by tools/test_backend.js; keep the two in step.
 */

const MAX = { name: 80, phone: 20, invitedAs: 60, diet: 30, dietNotes: 200, wishes: 500 };
const EVENT_IDS = ["sangeet", "haldi", "wedding", "reception"];
const LANGS = ["en", "bn"];
const RSVP_HEADERS = [
  "Received (IST)", "Name", "Phone", "Attending", "Guests", "Events",
  "Food", "Food notes", "Wishes", "Language", "Invited as", "Submitted (client)",
];
const POLL_HEADERS = ["Updated (IST)", "Device", "Question", "Pick"];
const TALLY_CACHE_KEY = "poll-tallies";
const TALLY_CACHE_SECONDS = 30;

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const data = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    if (data.type === "rsvp") return json(saveRsvp(data));
    if (data.type === "poll") return json(savePoll(data));
    return json({ ok: false, error: "Unknown type" });
  } catch (err) {
    return json({ ok: false, error: String((err && err.message) || err) });
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  const type = e && e.parameter && e.parameter.type;
  if (type === "tallies") return json({ ok: true, tallies: readTallies() });
  return json({ ok: true, service: "invite-rsvp" });
}

/* ---------- RSVPs ---------- */

function saveRsvp(d) {
  const name = clip(d.name, MAX.name);
  const phone = clip(d.phone, MAX.phone);
  if (!name || !phone) return { ok: false, error: "Name and phone are required" };
  if (d.website) return { ok: true }; // spam trap filled: pretend success, store nothing

  const attending = d.attending === "yes" ? "Yes" : "No";
  const events = (Array.isArray(d.events) ? d.events : []).filter((id) => EVENT_IDS.indexOf(id) !== -1);
  const guests = attending === "Yes" ? Math.max(1, Math.min(10, Number(d.guests) || 1)) : 0;
  const lang = LANGS.indexOf(d.lang) !== -1 ? d.lang : "en";

  sheet("RSVPs", RSVP_HEADERS).appendRow([
    istNow(), safe(name), safe(phone), attending, guests, events.join(", "),
    safe(clip(d.diet, MAX.diet)), safe(clip(d.dietNotes, MAX.dietNotes)),
    safe(clip(d.wishes, MAX.wishes)), lang, safe(clip(d.invitedAs, MAX.invitedAs)), clip(d.submittedAt, 40),
  ]);
  return { ok: true };
}

/* ---------- Polls ---------- */

function savePoll(d) {
  const pick = d.pick === "groom" || d.pick === "bride" ? d.pick : null;
  const question = String(d.question || "");
  const device = String(d.device || "");
  if (!pick) return { ok: false, error: "Bad pick" };
  if (!/^[a-z0-9_-]{1,40}$/.test(question)) return { ok: false, error: "Bad question" };
  if (!/^[A-Za-z0-9-]{8,64}$/.test(device)) return { ok: false, error: "Bad device" };

  const sh = sheet("Polls", POLL_HEADERS);
  const rows = sh.getDataRange().getValues(); // row 0 is the header
  const record = [istNow(), device, question, pick];
  let found = -1;
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][1] === device && rows[i][2] === question) { found = i; break; }
  }
  if (found > 0) {
    sh.getRange(found + 1, 1, 1, record.length).setValues([record]);
    rows[found] = record;
  } else {
    sh.appendRow(record);
    rows.push(record);
  }

  const tallies = countTallies(rows);
  CacheService.getScriptCache().put(TALLY_CACHE_KEY, JSON.stringify(tallies), TALLY_CACHE_SECONDS);
  return { ok: true, tally: tallies[question] || { groom: 0, bride: 0 } };
}

function readTallies() {
  const cache = CacheService.getScriptCache();
  const hit = cache.get(TALLY_CACHE_KEY);
  if (hit) return JSON.parse(hit);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName("Polls");
  const tallies = sh ? countTallies(sh.getDataRange().getValues()) : {};
  cache.put(TALLY_CACHE_KEY, JSON.stringify(tallies), TALLY_CACHE_SECONDS);
  return tallies;
}

/** { question: { groom: n, bride: n } } from Polls rows (header first). */
function countTallies(rows) {
  const out = {};
  for (let i = 1; i < rows.length; i++) {
    const q = rows[i][2], pick = rows[i][3];
    if (!q || (pick !== "groom" && pick !== "bride")) continue;
    out[q] = out[q] || { groom: 0, bride: 0 };
    out[q][pick]++;
  }
  return out;
}

/* ---------- helpers ---------- */

function sheet(name, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(headers);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, headers.length).setFontWeight("bold");
  }
  return sh;
}

function clip(v, n) {
  return v == null ? "" : String(v).trim().slice(0, n);
}

// Stop a guest's text being read as a spreadsheet formula.
function safe(v) {
  return /^[=+\-@]/.test(v) ? "'" + v : v;
}

function istNow() {
  return Utilities.formatDate(new Date(), "Asia/Kolkata", "yyyy-MM-dd HH:mm:ss");
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
