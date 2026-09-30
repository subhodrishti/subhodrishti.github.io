/*
 * Loads backend/google-apps-script.gs into a Node VM with in-memory fakes of
 * SpreadsheetApp, LockService, CacheService, ContentService and Utilities.
 * Used by tools/test_backend.js and, as a stand-in endpoint, tools/smoke.js.
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

function fakeServices() {
  const sheets = new Map();
  const cache = new Map();

  function makeSheet() {
    const rows = [];
    return {
      rows,
      appendRow: (r) => rows.push([...r]),
      setFrozenRows() {},
      getRange: (row, col, nr, nc) => ({
        setFontWeight() {},
        setValues: (vals) => { for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) rows[row - 1 + i][col - 1 + j] = vals[i][j]; },
      }),
      getDataRange: () => ({ getValues: () => rows.map((r) => [...r]) }),
    };
  }

  return {
    sheets,
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ({
        getSheetByName: (n) => sheets.get(n) || null,
        insertSheet: (n) => { const s = makeSheet(); sheets.set(n, s); return s; },
      }),
    },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    CacheService: {
      getScriptCache: () => ({ get: (k) => cache.get(k) ?? null, put: (k, v) => cache.set(k, v), remove: (k) => cache.delete(k) }),
    },
    ContentService: {
      MimeType: { JSON: "application/json" },
      createTextOutput: (text) => ({ text, setMimeType() { return this; } }),
    },
    Utilities: { formatDate: () => "2026-10-01 10:00:00" },
    clearCache: () => cache.clear(),
  };
}

function load() {
  const services = fakeServices();
  const ctx = vm.createContext({ ...services, JSON, Math, String, Number, Array, Date });
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "backend", "google-apps-script.gs"), "utf8"), ctx);
  const post = (body) => JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify(body) } }).text);
  const get = (params) => JSON.parse(ctx.doGet({ parameter: params }).text);
  return { ...services, post, get };
}

module.exports = { load };
