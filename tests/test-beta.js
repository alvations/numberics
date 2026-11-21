/* SPDX-License-Identifier: Apache-2.0 | Copyright 2026 alvations (Melon Lab)
 * The beta storage namespace (shared/boot.js): under a "/beta/" path every "numberics_*" localStorage key lives as
 * "numberics_beta_*", key()/length/clear() see only those, and nothing changes elsewhere. Memory runs unchanged on top.
 * `node tests/test-beta.js` (the browser check is tests/emu/shared-beta.cjs) */
"use strict";
const fs = require("fs"), path = require("path"), vm = require("vm");
let pass = 0, fail = 0;
function t(n, f) { try { f(); pass++; } catch (e) { fail++; console.log("FAIL", n, "\n  ", e.message); } }
function ok(c, m) { if (!c) throw new Error(m || "assertion failed"); }
const read = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");

// a small Web Storage: methods and the length getter on the prototype, like the browser's
function world(pathname, seed) {
  function Storage() { this._m = new Map(); }
  Storage.prototype.getItem = function (k) { k = String(k); return this._m.has(k) ? this._m.get(k) : null; };
  Storage.prototype.setItem = function (k, v) { this._m.set(String(k), String(v)); };
  Storage.prototype.removeItem = function (k) { this._m.delete(String(k)); };
  Storage.prototype.key = function (i) { const a = [...this._m.keys()]; return i < a.length ? a[i] : null; };
  Storage.prototype.clear = function () { this._m.clear(); };
  Object.defineProperty(Storage.prototype, "length", { configurable: true, enumerable: true, get() { return this._m.size; } });
  const ls = new Storage(), ss = new Storage(); Object.keys(seed || {}).forEach(k => ls._m.set(k, seed[k]));
  const doc = { documentElement: { dataset: {}, style: {} }, querySelector() { return null; }, getElementById() { return null; }, addEventListener() {} };
  const w = { Storage, localStorage: ls, sessionStorage: ss, document: doc, location: { pathname, reload() { w.reloads++; } }, reloads: 0,
    matchMedia: () => ({ matches: false, addEventListener() {} }), addEventListener() {}, dispatchEvent() {},
    CustomEvent: function () {}, btoa: s => Buffer.from(s, "binary").toString("base64"), atob: s => Buffer.from(s, "base64").toString("binary") };
  w.window = w; w.self = w;
  const ctx = vm.createContext(Object.assign(w, { console, setTimeout, clearTimeout, Date, Math, JSON, unescape, escape, encodeURIComponent, decodeURIComponent }));
  ["shared/boot.js", "shared/kit.js", "shared/settings.js"].forEach(f => vm.runInContext(read(f), ctx, { filename: f }));
  return ctx;
}
const STABLE = { numberics_endless_v1: '{"stable":1}', numberics_settings_v1: '{"theme":"light"}', other_app: "x" };

t("not under /beta/: nothing changes (keys, listing, length)", () => {
  const c = world("/numberics/four/", STABLE), ls = c.localStorage;
  ls.setItem("numberics_four_v1", "a");
  ok(ls._m.get("numberics_four_v1") === "a" && ls.getItem("numberics_endless_v1") === '{"stable":1}' && ls.length === 4 && !c.Storage.prototype.__nmBeta);
});
t("under /beta/: numberics_* keys live as numberics_beta_*, and stable keys are invisible", () => {
  const c = world("/numberics/beta/four/", STABLE), ls = c.localStorage;
  ok(ls.getItem("numberics_endless_v1") === null, "a stable save is not read");
  ls.setItem("numberics_four_v1", "b");
  ok(ls._m.get("numberics_beta_four_v1") === "b" && !ls._m.has("numberics_four_v1") && ls.getItem("numberics_four_v1") === "b");
  ok(ls.length === 1 && ls.key(0) === "numberics_four_v1" && ls.key(1) === null, "only beta keys are listed, by their plain names");
  ls.removeItem("numberics_four_v1"); ok(!ls._m.has("numberics_beta_four_v1"));
  ls.setItem("numberics_two_v1", "c"); ls.clear();
  ok(ls._m.get("numberics_endless_v1") === '{"stable":1}' && ls._m.get("other_app") === "x" && ls._m.size === 3, "clear() removes beta keys only");
  ok(ls.getItem("other_app") === "x", "other names pass through");
  c.sessionStorage.setItem("numberics_x", "s"); ok(c.sessionStorage._m.get("numberics_x") === "s", "sessionStorage is untouched");
});
t("under /beta/: Memory Save, Load and Erase see and touch only beta keys; the stable keys survive", () => {
  const c = world("/numberics/beta/", STABLE), ls = c.localStorage, M = c.NumbericsSettings.memory;
  ls.setItem("numberics_sudoku_v1", '{"beta":1}');
  const d = M.unpack(M.pack());
  ok(d.numberics_sudoku_v1 === '{"beta":1}' && !("numberics_endless_v1" in d) && JSON.parse(d.numberics_settings_v1).theme === "auto", JSON.stringify(d));
  M.loadText(M.pack()); M.erase();
  ok(ls._m.get("numberics_endless_v1") === '{"stable":1}' && ls._m.get("numberics_settings_v1") === '{"theme":"light"}', "stable keys untouched");
  ok(!ls._m.has("numberics_beta_sudoku_v1") && ls._m.has("numberics_beta_settings_v1"), "Erase cleared the beta game key, kept beta settings");
});
t("the boot reads beta settings, not the stable ones", () => {
  const c = world("/numberics/beta/", Object.assign({}, STABLE, { numberics_beta_settings_v1: '{"theme":"dark","text":"large"}' }));
  const d = c.document.documentElement.dataset; ok(d.theme === "dark" && d.text === "large", JSON.stringify(d));
});
require("./conventions")(t, ok, ["shared/boot.js"]);
console.log(pass + " passed, " + fail + " failed"); process.exit(fail ? 1 : 0);
