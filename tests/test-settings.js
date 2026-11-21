/* SPDX-License-Identifier: Apache-2.0 | Copyright 2026 alvations (Melon Lab)
 * Settings and Memory (docs/design/REDESIGN.md 6, B1): shared/settings.js in a small fake window.
 * `node tests/test-settings.js` (the sheet, focus trap and file round-trip run in tests/emu/shared-settings.cjs) */
"use strict";
const fs = require("fs"), path = require("path"), vm = require("vm");
let pass = 0, fail = 0;
function t(n, f) { try { f(); pass++; } catch (e) { fail++; console.log("FAIL", n, "\n  ", e.message); } }
function ok(c, m) { if (!c) throw new Error(m || "assertion failed"); }
const root = path.join(__dirname, "..");
const read = f => fs.readFileSync(path.join(root, f), "utf8");

function storage(blocked) {
  const m = new Map();
  const no = () => { throw new Error("blocked"); };
  return blocked ? { getItem: no, setItem: no, removeItem: no, key: no, get length() { return no(); } } : {
    getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k),
    key: i => [...m.keys()][i] || null, get length() { return m.size; }, _m: m };
}
// a window with boot, kit and settings loaded; opts: { blocked, stored, osReduce, osLight }
function load(opts) {
  opts = opts || {};
  const ls = storage(opts.blocked);
  if (opts.stored) Object.keys(opts.stored).forEach(k => ls.setItem(k, opts.stored[k]));
  const events = [], mq = {}, listeners = {};
  const doc = { documentElement: { dataset: {}, style: {} }, querySelector() { return null; }, getElementById() { return null; }, addEventListener() {} };
  const win = {
    document: doc, localStorage: ls, events, reloads: 0,
    location: { reload() { win.reloads++; } },
    matchMedia: q => mq[q] || (mq[q] = { q, matches: /reduce/.test(q) ? !!opts.osReduce : !!opts.osLight, fns: [], addEventListener(_, f) { this.fns.push(f); } }),
    addEventListener(type, f) { (listeners[type] = listeners[type] || []).push(f); },
    dispatchEvent(e) { events.push(e); (listeners[e.type] || []).forEach(f => f(e)); },
    CustomEvent: function (type, init) { this.type = type; this.detail = init && init.detail; },
    btoa: s => Buffer.from(s, "binary").toString("base64"), atob: s => Buffer.from(s, "base64").toString("binary"),
    mq, listeners
  };
  win.window = win; win.self = win;
  const ctx = vm.createContext(Object.assign(win, { console, setTimeout, clearTimeout, Date, Math, JSON, unescape, escape, encodeURIComponent, decodeURIComponent }));
  ["shared/boot.js", "shared/kit.js", "shared/settings.js"].forEach(f => vm.runInContext(read(f), ctx, { filename: f }));
  return ctx;
}
const KEY = "numberics_settings_v1";

t("defaults match REDESIGN.md 6.1", () => {
  const S = load().NumbericsSettings;
  ok(JSON.stringify(S.get()) === JSON.stringify({ v: 1, sound: true, volume: 0.5, haptics: true, motion: "auto", theme: "auto", text: "normal", contrast: "normal",
    music: true, musicVolume: 0.5, musicStyle: "auto", unmute: "both" }), "with the music fields of MUSIC.md; theme follows the device (TRIAGE4 D5)");
  ok(S.KEY === KEY);
});
t("malformed fields fall back to the default one by one", () => {
  const S = load({ stored: { [KEY]: JSON.stringify({ sound: "yes", volume: 7, haptics: false, motion: "full", theme: "purple", text: "large", contrast: 1 }) } }).NumbericsSettings;
  const s = S.get();
  ok(s.sound === true && s.volume === 1 && s.haptics === false && s.motion === "full" && s.theme === "auto" && s.text === "large" && s.contrast === "normal", JSON.stringify(s));
  ok(load({ stored: { [KEY]: "{not json" } }).NumbericsSettings.get().theme === "auto", "corrupt JSON -> defaults");
  ok(load({ stored: { [KEY]: JSON.stringify({ theme: "dark" }) } }).NumbericsSettings.get().theme === "dark", "a saved Dark is kept (D5 changes only the default)");
  ok(S.normalize({ volume: NaN }).volume === 0.5 && S.normalize({ volume: -1 }).volume === 0 && S.normalize(null).sound === true);
});
t("set() saves, re-applies the html attributes live, and returns the new settings", () => {
  const c = load(), S = c.NumbericsSettings, d = c.document.documentElement.dataset;
  const r = S.set({ theme: "light", text: "large", contrast: "high", motion: "reduced", volume: 0.35, sound: false, haptics: false });
  ok(r.theme === "light" && r.volume === 0.35);
  ok(d.theme === "light" && d.text === "large" && d.contrast === "high" && d.motion === "reduced", JSON.stringify(d));
  const saved = JSON.parse(c.localStorage.getItem(KEY));
  ok(saved.theme === "light" && saved.volume === 0.35 && saved.sound === false && saved.haptics === false && saved.v === 1, JSON.stringify(saved));
  ok(load({ stored: { [KEY]: c.localStorage.getItem(KEY) } }).NumbericsSettings.get().text === "large", "persists across a reload");
});
t("each control's field persists (sound, volume, haptics, motion, theme, text, contrast)", () => {
  const patches = { sound: false, volume: 0.8, haptics: false, motion: "full", theme: "auto", text: "large", contrast: "high" };
  Object.keys(patches).forEach(k => {
    const c = load(); c.NumbericsSettings.set({ [k]: patches[k] });
    const again = load({ stored: { [KEY]: c.localStorage.getItem(KEY) } }).NumbericsSettings.get();
    ok(again[k] === patches[k], k);
  });
});
t("a change fires numberics:settings on window and on('change') with the changed keys; no change, no event", () => {
  const c = load(), S = c.NumbericsSettings, seen = [];
  const off = S.on("change", (s, ch) => seen.push([s.theme, ch.join(",")]));
  S.set({ theme: "light" });
  ok(seen.length === 1 && seen[0][0] === "light" && seen[0][1] === "theme", JSON.stringify(seen));
  const ev = c.events.filter(e => e.type === "numberics:settings");
  ok(ev.length === 1 && ev[0].detail.theme === "light", "DOM event");
  S.set({ theme: "light" }); ok(seen.length === 1, "same value: no event");
  off(); S.set({ theme: "dark" }); ok(seen.length === 1, "off() unsubscribes");
  S.on("change", () => { throw new Error("bad listener"); }); const s2 = []; S.on("change", s => s2.push(s));
  S.set({ sound: false }); ok(s2.length === 1, "one throwing listener does not stop the rest");
});
t("blocked storage: every setting still works in memory for the page", () => {
  const c = load({ blocked: true }), S = c.NumbericsSettings;
  S.set({ theme: "light", volume: 0.2 });
  ok(S.get().theme === "light" && S.get().volume === 0.2 && c.document.documentElement.dataset.theme === "light");
  ok(S.reducedMotion() === false); S.set({ motion: "reduced" }); ok(S.reducedMotion() === true);
});
t("Motion: Full beats the OS, Less beats the OS, Device follows it; the kit's reducedMotion() follows the setting", () => {
  const c = load({ osReduce: true }), S = c.NumbericsSettings, K = c.NumbericsKit, d = c.document.documentElement.dataset;
  ok(d.motion === "reduced" && K.reducedMotion() === true, "device asks for less");
  S.set({ motion: "full" }); ok(d.motion === "full" && K.reducedMotion() === false && S.reducedMotion() === false, "Full overrides OS reduce");
  const c2 = load(); c2.NumbericsSettings.set({ motion: "reduced" });
  ok(c2.document.documentElement.dataset.motion === "reduced" && c2.NumbericsKit.reducedMotion() === true, "Less with an OS that allows motion");
});
t("Device theme or motion: an OS change re-applies and fires change", () => {
  const c = load(), S = c.NumbericsSettings, d = c.document.documentElement.dataset, seen = [];
  S.set({ theme: "auto" }); S.on("change", (s, ch) => seen.push(ch.join()));
  const m = c.mq["(prefers-color-scheme: light)"]; m.matches = true; m.fns.forEach(f => f());
  ok(d.theme === "light" && seen.includes("theme"), d.theme + " " + seen);
  S.set({ theme: "dark" }); seen.length = 0; m.fns.forEach(f => f());
  ok(d.theme === "dark" && !seen.includes("theme"), "a fixed theme ignores the device");
});
t("another tab saving the settings updates this page", () => {
  const c = load(), S = c.NumbericsSettings, seen = [];
  S.on("change", (s, ch) => seen.push(ch.join()));
  c.listeners.storage.forEach(f => f({ key: KEY, newValue: JSON.stringify({ v: 1, contrast: "high" }) }));
  ok(S.get().contrast === "high" && c.document.documentElement.dataset.contrast === "high" && seen[0] === "contrast");
  c.listeners.storage.forEach(f => f({ key: "numberics_other", newValue: "1" })); ok(seen.length === 1);
});

t("music fields (MUSIC.md): normalised one by one, saved, announced", () => {
  const S = load({ stored: { [KEY]: JSON.stringify({ music: "no", musicVolume: 3, musicStyle: "disco" }) } }).NumbericsSettings;
  let s = S.get(); ok(s.music === true && s.musicVolume === 1 && s.musicStyle === "auto", JSON.stringify(s));
  ok(S.normalize({ musicVolume: 0.333 }).musicVolume === 0.33 && S.normalize({ musicVolume: -2 }).musicVolume === 0 && S.normalize({ musicVolume: NaN }).musicVolume === 0.5);
  ["auto", "chill", "drift", "pocket", "quest", "blocks", "pulse", "epic"].forEach(id => ok(S.normalize({ musicStyle: id }).musicStyle === id, id));
  ok(S.normalize({ music: false }).music === false && S.normalize({ musicStyle: "Chill" }).musicStyle === "auto");
  const c = load(), T = c.NumbericsSettings, seen = [];
  T.on("change", (x, k) => seen.push(k.join(",")));
  T.set({ music: false, musicVolume: 0.8, musicStyle: "epic" });
  ok(seen[0] === "music,musicVolume,musicStyle", seen[0]);
  const ev = c.events[c.events.length - 1]; ok(ev.type === "numberics:settings" && ev.detail.music === false && ev.detail.musicStyle === "epic", "event carries them");
  const saved = JSON.parse(c.localStorage.getItem(KEY)); ok(saved.musicVolume === 0.8 && saved.musicStyle === "epic", "stored");
});
t("the style list in settings.js matches music.js (ids, names, blurbs, menu order)", () => {
  const M = require("../shared/music.js"), S = load().NumbericsSettings;
  ok(JSON.stringify(S.STYLES.map(x => x.id)) === JSON.stringify(M.ORDER), "order");
  S.STYLES.forEach(x => ok(M.STYLES[x.id].name === x.name && M.STYLES[x.id].blurb === x.blurb, x.id));
});

// ---- Memory ----
const SAVES = {
  numberics_endless_v1: JSON.stringify({ grid: [1, 2, 3], score: 1136, seed: 42 }),
  numberics_sudoku_v1: JSON.stringify({ best: { easy: 301 }, note: "café ✓ 数字" }),
  numberics_trophies_v1: JSON.stringify({ got: { fam_first: 20261120 } }),
  numberics_progress_v1: "{\"two\":{\"best\":\"Best 2048\"}}",
  [KEY]: JSON.stringify({ v: 1, sound: false, volume: 0.25, haptics: true, motion: "reduced", theme: "light", text: "large", contrast: "high",
    music: false, musicVolume: 0.3, musicStyle: "pulse", unmute: "both" })
};
t("the blob is the melon-eight keystream XOR (FNV-1a seed of 'numberics', xorshift) and round-trips UTF-8", () => {
  const M = load().NumbericsSettings.memory, obj = { a: "café 数", n: [1, 2, 3] };
  const b = M.enc(obj); ok(JSON.stringify(M.dec(b)) === JSON.stringify(obj));
  ok(!/caf|numberics|"a"/.test(Buffer.from(b, "base64").toString("binary")), "not readable at a glance");
  // reference implementation, written out separately from melon-eight's game.js
  function ks(seed, len) { let h = 2166136261 >>> 0; for (const ch of seed) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
    const o = []; let x = h || 1; for (let i = 0; i < len; i++) { x ^= x << 13; x >>>= 0; x ^= x >> 17; x ^= x << 5; x >>>= 0; o.push(x & 0xff); } return o; }
  const data = Buffer.from(JSON.stringify(obj), "utf8"), k = ks("numberics", data.length);
  ok(Buffer.from(data.map((v, i) => v ^ k[i])).toString("base64") === b, "matches the reference keystream");
});
t("Save -> Load round-trips every numberics_* key byte for byte, and only those", () => {
  const stored = Object.assign({ other_app: "keep me out" }, SAVES);
  const a = load({ stored }), text = a.NumbericsSettings.memory.pack(), f = JSON.parse(text);
  ok(f.game === "numberics" && f.v === 1 && /^\d{4}-\d\d-\d\d$/.test(f.saved) && typeof f.data === "string", text.slice(0, 80));
  ok(!/endless|1136|fam_first/.test(text), "the file is scrambled");
  const b = load({ stored: { numberics_endless_v1: "{\"old\":1}", numberics_six_v1: "{\"untouched\":1}" } });
  ok(b.NumbericsSettings.memory.loadText(text) === true && b.reloads === 1, "loads and reloads");
  Object.keys(SAVES).forEach(k => ok(b.localStorage.getItem(k) === SAVES[k], k));
  ok(b.localStorage.getItem("other_app") === null, "foreign keys are not saved");
  ok(b.localStorage.getItem("numberics_six_v1") === "{\"untouched\":1}", "keys the file does not hold are left alone");
  ok(b.NumbericsSettings.get().theme === "light" && b.NumbericsSettings.get().volume === 0.25, "settings come with the save");
  const g = b.NumbericsSettings.get(); ok(g.music === false && g.musicVolume === 0.3 && g.musicStyle === "pulse", "the music fields too " + JSON.stringify(g));
});
t("Save with storage blocked still carries the in-memory settings", () => {
  const c = load({ blocked: true }); c.NumbericsSettings.set({ text: "large" });
  const d = c.NumbericsSettings.memory.unpack(c.NumbericsSettings.memory.pack());
  ok(d && JSON.parse(d[KEY]).text === "large" && Object.keys(d).length === 1, JSON.stringify(d));
});
t("a wrong or corrupt file changes nothing and says so", () => {
  const c = load({ stored: SAVES }), M = c.NumbericsSettings.memory, good = JSON.parse(M.pack());
  const before = JSON.stringify([...c.localStorage._m]);
  const bad = ["", "hello", "{}", JSON.stringify({ game: "melon8", v: 1, data: good.data }), JSON.stringify(Object.assign({}, good, { v: 2 })),
    JSON.stringify(Object.assign({}, good, { data: good.data.slice(0, -8) + "AAAAAAAA" })), JSON.stringify(Object.assign({}, good, { data: "!!!" })),
    JSON.stringify(Object.assign({}, good, { data: M.enc({ evil_key: "x" }) })), JSON.stringify(Object.assign({}, good, { data: M.enc({ numberics_x: 5 }) })),
    JSON.stringify(Object.assign({}, good, { data: M.enc([1, 2]) }))];
  bad.forEach((txt, i) => { ok(M.unpack(txt) === null, "case " + i); ok(M.loadText(txt) === false, "load " + i); });
  ok(JSON.stringify([...c.localStorage._m]) === before && c.reloads === 0, "storage untouched, no reload");
  ok(M.BAD_FILE === "That file is not a Numberics save.");
});
t("Erase removes every numberics_* key except the settings, leaves other keys, then reloads", () => {
  const c = load({ stored: Object.assign({ other_app: "x" }, SAVES) });
  c.NumbericsSettings.memory.erase();
  const left = [...c.localStorage._m.keys()].sort();
  ok(JSON.stringify(left) === JSON.stringify([KEY, "other_app"]), left.join(","));
  ok(c.localStorage.getItem(KEY) === SAVES[KEY] && c.reloads === 1);
});
t("blocked storage: Save, Load and Erase never throw", () => {
  const c = load({ blocked: true }), M = c.NumbericsSettings.memory, text = load({ stored: SAVES }).NumbericsSettings.memory.pack();
  M.pack(); M.erase(); ok(M.loadText(text) === false && c.reloads === 1, "load refused (cannot store), erase still reloads");
});
t("the sheet entry points are safe without the UI module", () => {
  const S = load().NumbericsSettings; ok(S.open() === null);
});
t("settings.js never touches storage outside try/catch helpers and has no em-dash", () => {
  const s = read("shared/settings.js");
  ok(!/—/.test(s)); ok((s.match(/localStorage\./g) || []).length === (s.match(/try \{[^\n]*localStorage\./g) || []).length, "every localStorage use on a try line");
});
// ---- TRIAGE4 D2: the one-tap mute ----
t("toggleMute: mutes Sound and Music together and brings back exactly what was on", () => {
  const S = load().NumbericsSettings;
  ok(S.muted() === false);
  S.toggleMute(); ok(S.muted() && !S.get().sound && !S.get().music && S.get().unmute === "both", JSON.stringify(S.get()));
  S.toggleMute(); ok(!S.muted() && S.get().sound && S.get().music);
  S.set({ music: false }); S.toggleMute(); ok(S.muted() && S.get().unmute === "sound");
  S.toggleMute(); ok(S.get().sound === true && S.get().music === false, "only Sound comes back");
  S.set({ sound: false, music: true }); S.toggleMute(); S.toggleMute(); ok(S.get().sound === false && S.get().music === true, "only Music comes back");
  const c = load({ stored: { [KEY]: JSON.stringify({ sound: false, music: false, unmute: "music" }) } }).NumbericsSettings;
  ok(c.muted()); c.toggleMute(); ok(!c.get().sound && c.get().music, "remembered across a reload");
  ok(load({ stored: { [KEY]: JSON.stringify({ unmute: "nonsense" }) } }).NumbericsSettings.get().unmute === "both", "a bad unmute falls back");
});
// ---- TRIAGE4 D6 and B1: the kit's batched store and Memory's freeze ----
t("kit store: a save is kept at once and written once, in one batch, later; every store of the key reads it", () => {
  const c = load(), K = c.NumbericsKit, a = K.store("numberics_a_v1"), a2 = K.store("numberics_a_v1"), b = K.store("numberics_b_v1");
  a.save({ n: 1 }); a.save({ n: 2 }); b.save({ m: 1 });
  ok(c.localStorage.getItem("numberics_a_v1") === null && c.localStorage.getItem("numberics_b_v1") === null, "nothing written inside the call");
  ok(a.load().n === 2 && a2.load().n === 2 && b.load().m === 1, "pending saves read back, through any store of the key");
  K.flush();
  ok(c.localStorage.getItem("numberics_a_v1") === '{"n":2}' && c.localStorage.getItem("numberics_b_v1") === '{"m":1}', "one flush writes the latest of each");
});
t("kit store: pagehide flushes the batch, and a save made while leaving writes at once", () => {
  const c = load(), K = c.NumbericsKit, a = K.store("numberics_a_v1");
  a.save({ n: 1 });
  (c.listeners.pagehide || []).forEach(f => f({ type: "pagehide" }));
  ok(c.localStorage.getItem("numberics_a_v1") === '{"n":1}', "flushed on pagehide");
  a.save({ n: 2 }); ok(c.localStorage.getItem("numberics_a_v1") === '{"n":2}', "a pagehide save (Sudoku's) is written at once");
  (c.listeners.pageshow || []).forEach(f => f({ type: "pageshow" }));
  a.save({ n: 3 }); ok(c.localStorage.getItem("numberics_a_v1") === '{"n":2}', "back on the page: batched again");
});
t("kit store: a value written by anything else after the batch was queued is never overwritten by the flush", () => {
  const c = load(), K = c.NumbericsKit, a = K.store("numberics_a_v1");
  a.save({ n: 1 }); c.localStorage.setItem("numberics_a_v1", '{"other":1}');
  K.flush(); ok(c.localStorage.getItem("numberics_a_v1") === '{"other":1}', "the newer outside value wins");
  (c.listeners.pagehide || []).forEach(f => f({ type: "pagehide" })); ok(c.localStorage.getItem("numberics_a_v1") === '{"other":1}', "nor on pagehide");
  (c.listeners.pageshow || []).forEach(f => f({ type: "pageshow" }));
  a.save({ n: 2 }); K.flush(); ok(c.localStorage.getItem("numberics_a_v1") === '{"n":2}', "a save queued after it writes as usual");
});
t("Memory freezes the store: pending saves are dropped and no later save (pagehide included) overwrites a Load or an Erase", () => {
  const c = load({ stored: SAVES }), K = c.NumbericsKit, M = c.NumbericsSettings.memory, text = M.pack();
  const two = K.store("numberics_endless_v1"); two.save({ dirty: 1 });
  const d = load({ stored: SAVES }), K2 = d.NumbericsKit, st = K2.store("numberics_endless_v1");
  st.save({ pending: 1 });
  ok(d.NumbericsSettings.memory.loadText(text) === true && K2.frozen(), "Load freezes");
  st.save({ pagehide: 1 }); (d.listeners.pagehide || []).forEach(f => f({ type: "pagehide" })); st.save({ late: 1 }); K2.flush();
  ok(d.localStorage.getItem("numberics_endless_v1") === SAVES.numberics_endless_v1, d.localStorage.getItem("numberics_endless_v1"));
  const e = load({ stored: SAVES }), K3 = e.NumbericsKit, s3 = K3.store("numberics_sudoku_v1");
  s3.save({ pending: 1 }); e.NumbericsSettings.memory.erase();
  s3.save({ pagehide: 1 }); (e.listeners.pagehide || []).forEach(f => f({ type: "pagehide" })); K3.flush();
  ok(e.localStorage.getItem("numberics_sudoku_v1") === null, "Erase stays erased");
  ok(JSON.parse(c.NumbericsSettings.memory.unpack(c.NumbericsSettings.memory.pack()).numberics_endless_v1).dirty === 1, "Save flushes pending writes first, so the file holds them");
});
t("a Load the browser refuses thaws the store again (nothing reloads, play goes on saving)", () => {
  const c = load({ blocked: true }), text = load({ stored: SAVES }).NumbericsSettings.memory.pack();
  ok(c.NumbericsSettings.memory.loadText(text) === false && c.NumbericsKit.frozen() === false);
});
require("./conventions")(t, ok, ["shared/settings.js", "shared/ui.js"]);
console.log(pass + " passed, " + fail + " failed"); process.exit(fail ? 1 : 0);
