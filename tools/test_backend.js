/*
 * Runs backend/google-apps-script.gs in Node against in-memory fakes of the
 * Apps Script services it uses, so the RSVP and poll logic can be checked
 * without deploying.   node tools/test_backend.js
 */
const assert = require("assert");
const { load } = require("./gas_harness");

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

test("valid RSVP is stored with language and filtered events", () => {
  const b = load();
  const r = b.post({ type: "rsvp", name: "Test Guest", phone: "+91 90000 00000", attending: "yes", events: ["sangeet", "bogus"], guests: 3, diet: "Vegetarian", lang: "bn" });
  assert.deepStrictEqual(r, { ok: true });
  const row = b.sheets.get("RSVPs").rows[1];
  assert.strictEqual(row[3], "Yes");
  assert.strictEqual(row[4], 3);
  assert.strictEqual(row[5], "sangeet");
  assert.strictEqual(row[9], "bn");
  assert.strictEqual(row[2], "'+91 90000 00000", "phone starting with + is escaped so Sheets keeps it as text");
});

test("RSVP stores its invite code, and blanks a malformed one", () => {
  const b = load();
  b.post({ type: "rsvp", name: "A", phone: "9000000000", attending: "yes", invite: "t5fntb22" });
  b.post({ type: "rsvp", name: "B", phone: "9000000001", attending: "yes", invite: "=BAD CODE" });
  const rows = b.sheets.get("RSVPs").rows;
  assert.strictEqual(rows[0][12], "Invite");
  assert.strictEqual(rows[1][12], "t5fntb22");
  assert.strictEqual(rows[2][12], "");
});

test("RSVP without name or phone is rejected", () => {
  const b = load();
  assert.strictEqual(b.post({ type: "rsvp", name: "", phone: "123" }).ok, false);
  assert.strictEqual(b.sheets.get("RSVPs"), undefined);
});

test("formula injection in wishes is neutralised", () => {
  const b = load();
  b.post({ type: "rsvp", name: "=HYPERLINK(\"x\")", phone: "9000000000", attending: "no", wishes: "@SUM(A1)" });
  const row = b.sheets.get("RSVPs").rows[1];
  assert.ok(row[1].startsWith("'="));
  assert.ok(row[8].startsWith("'@"));
  assert.strictEqual(row[4], 0, "a decline stores zero guests");
});

test("spam trap stores nothing but reports success", () => {
  const b = load();
  assert.deepStrictEqual(b.post({ type: "rsvp", name: "Bot", phone: "9000000000", website: "spam" }), { ok: true });
  assert.strictEqual(b.sheets.get("RSVPs"), undefined);
});

test("poll votes are upserted per device and tallied", () => {
  const b = load();
  const d1 = "device-aaaaaaaa", d2 = "device-bbbbbbbb", d3 = "device-cccccccc";
  assert.deepStrictEqual(b.post({ type: "poll", question: "ready", pick: "bride", device: d1 }).tally, { groom: 0, bride: 1 });
  assert.deepStrictEqual(b.post({ type: "poll", question: "ready", pick: "groom", device: d2 }).tally, { groom: 1, bride: 1 });
  // d1 changes their mind: updated, not duplicated
  assert.deepStrictEqual(b.post({ type: "poll", question: "ready", pick: "groom", device: d1 }).tally, { groom: 2, bride: 0 });
  b.post({ type: "poll", question: "cook", pick: "bride", device: d3 });
  assert.strictEqual(b.sheets.get("Polls").rows.length, 1 + 3);
  const all = b.get({ type: "tallies" });
  assert.deepStrictEqual(all.tallies, { ready: { groom: 2, bride: 0 }, cook: { groom: 0, bride: 1 } });
});

test("tallies are served from the sheet when the cache is cold", () => {
  const b = load();
  b.post({ type: "poll", question: "dance", pick: "groom", device: "device-dddddddd" });
  b.clearCache();
  assert.deepStrictEqual(b.get({ type: "tallies" }).tallies, { dance: { groom: 1, bride: 0 } });
});

test("bad poll input is rejected", () => {
  const b = load();
  assert.strictEqual(b.post({ type: "poll", question: "ready", pick: "both", device: "device-aaaaaaaa" }).ok, false);
  assert.strictEqual(b.post({ type: "poll", question: "<script>", pick: "groom", device: "device-aaaaaaaa" }).ok, false);
  assert.strictEqual(b.post({ type: "poll", question: "ready", pick: "groom", device: "x" }).ok, false);
  assert.strictEqual(b.post({ type: "nope" }).ok, false);
});

test("empty tallies before any vote", () => {
  const b = load();
  assert.deepStrictEqual(b.get({ type: "tallies" }), { ok: true, tallies: {} });
  assert.deepStrictEqual(b.get({}), { ok: true, service: "invite-rsvp" });
});

test("submittedAt can't smuggle a formula into the sheet", () => {
  const b = load();
  b.post({ type: "rsvp", name: "A", phone: "9000000000", attending: "no", submittedAt: "=IMPORTXML(1)" });
  assert.strictEqual(b.sheets.get("RSVPs").rows[1][11], "'=IMPORTXML(1)");
});

test("each RSVP emails NOTIFY_EMAILS in plain text, unescaped, with the sheet link", () => {
  const b = load();
  b.props.set("NOTIFY_EMAILS", "a@example.com, b@example.com; not-an-address");
  const r = b.post({ type: "rsvp", name: "Rina\nMashi", phone: "+91 90000 00000", attending: "yes", guests: 2, events: ["wedding"], invite: "t5fntb22" });
  assert.deepStrictEqual(r, { ok: true }, "the saved row is not echoed back to the guest");
  assert.strictEqual(b.mail.length, 1);
  const m = b.mail[0];
  assert.strictEqual(m.to, "a@example.com,b@example.com");
  assert.strictEqual(m.subject, "RSVP: Rina Mashi is coming (2 guests)");
  assert.ok(m.body.includes("Phone: +91 90000 00000"), "email shows the phone without the sheet's ' escape");
  assert.ok(m.body.includes("Invite: t5fntb22"));
  assert.ok(m.body.includes("https://docs.google.com/spreadsheets/d/test"));
  assert.strictEqual(m.htmlBody, undefined);
});

test("a decline says so in the subject", () => {
  const b = load();
  b.props.set("NOTIFY_EMAILS", "a@example.com");
  b.post({ type: "rsvp", name: "Dadu", phone: "9000000000", attending: "no" });
  assert.strictEqual(b.mail[0].subject, "RSVP: Dadu can't come");
});

test("no email without recipients, for spam, for rejected RSVPs or for poll votes", () => {
  const b = load();
  b.post({ type: "rsvp", name: "A", phone: "9000000000", attending: "yes" });
  b.props.set("NOTIFY_EMAILS", "a@example.com");
  b.post({ type: "rsvp", name: "Bot", phone: "9000000000", website: "spam" });
  b.post({ type: "rsvp", name: "", phone: "9000000000" });
  b.post({ type: "poll", question: "ready", pick: "bride", device: "dev-aaaa-1111" });
  assert.strictEqual(b.mail.length, 0);
});

test("an email failure or empty quota never fails the RSVP", () => {
  const b = load();
  b.props.set("NOTIFY_EMAILS", "a@example.com,b@example.com");
  b.quota.fail = true;
  assert.deepStrictEqual(b.post({ type: "rsvp", name: "A", phone: "9000000000", attending: "yes" }), { ok: true });
  b.quota.fail = false;
  b.quota.left = 1;
  assert.deepStrictEqual(b.post({ type: "rsvp", name: "B", phone: "9000000001", attending: "yes" }), { ok: true });
  assert.strictEqual(b.mail.length, 0);
  assert.strictEqual(b.sheets.get("RSVPs").rows.length, 3);
});

let failed = 0;
for (const { name, fn } of tests) {
  try { fn(); console.log(`  ok  ${name}`); }
  catch (e) { failed++; console.log(`FAIL  ${name}\n      ${e.message}`); }
}
console.log(failed ? `\n${failed} failed` : `\nall ${tests.length} passed`);
process.exit(failed ? 1 : 0);
