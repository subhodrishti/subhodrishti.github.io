/*
 * Every guest-facing line in English and Bengali, side by side, for a
 * Bengali-speaking family member to review in Excel or Google Sheets.
 *
 *   node tools/export_translations.js          → translations-review.csv
 *
 * Send the CSV to the reviewer; they fill "Corrected Bengali" and "Notes".
 * Then ask Claude to apply the corrections (it knows each row's "Where").
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const ctx = vm.createContext({ window: {} });
for (const f of ["js/config.js", "js/strings.js"]) vm.runInContext(fs.readFileSync(path.join(root, f), "utf8"), ctx);
const { INVITE, INVITE_STRINGS } = ctx.window;

const rows = [];
const add = (where, en, bn) => rows.push([where, en ?? "", bn ?? ""]);

// Interface strings
for (const [key, en] of Object.entries(INVITE_STRINGS.en)) {
  if (key.startsWith("_")) continue;
  add(`js/strings.js → ${key}`, en, INVITE_STRINGS.bn[key]);
}

// Bilingual config values, found wherever they sit
function walk(value, where) {
  if (Array.isArray(value)) return value.forEach((v, i) => walk(v, `${where}[${value[i]?.id ?? i}]`));
  if (!value || typeof value !== "object") return;
  if ("en" in value && "bn" in value) {
    const en = [].concat(value.en), bn = [].concat(value.bn);
    en.forEach((line, i) => add(`js/config.js → ${where}${en.length > 1 ? ` #${i + 1}` : ""}`, line, bn[i]));
    return;
  }
  for (const [k, v] of Object.entries(value)) walk(v, where ? `${where}.${k}` : k);
}
walk(INVITE, "");

const csv = (s) => `"${String(s).replace(/"/g, '""')}"`;
const lines = [["Where", "English", "Bengali (draft)", "Corrected Bengali", "Notes"].map(csv).join(",")];
for (const [where, en, bn] of rows) lines.push([where, en, bn, "", ""].map(csv).join(","));

const out = path.join(root, "translations-review.csv");
// BOM so Excel opens the Bengali as UTF-8
fs.writeFileSync(out, "﻿" + lines.join("\r\n"), "utf8");
const missing = rows.filter(([, , bn]) => !bn).map(([w]) => w);
console.log(`${rows.length} lines → ${path.relative(root, out)}`);
if (missing.length) console.log(`Missing Bengali:\n  ${missing.join("\n  ")}`);
