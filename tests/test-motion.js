/* SPDX-License-Identifier: Apache-2.0 | Copyright 2026 alvations (Melon Lab)
 * shared/motion.js pure parts: track (slides, merges, spawns, chains of moves, Undo re-key), rekey, fallMs, ms, seq,
 * reduced (Settings tri-state, then the device). The keyed layer itself is proven in a browser: tests/emu/shared-motion.cjs.
 * `node tests/test-motion.js` */
"use strict";
const M = require("../shared/motion.js"), N = require("../engine.js"), F = require("../fibonacci/engine.js");
let pass = 0, fail = 0;
const later = [];
function t(n, f) { try { const r = f(); if (r && r.then) later.push(r.then(() => pass++, e => { fail++; console.log("FAIL", n, "\n  ", e.message); })); else pass++; } catch (e) { fail++; console.log("FAIL", n, "\n  ", e.message); } }
function ok(c, m) { if (!c) throw new Error(m || "assertion failed"); }
const J = JSON.stringify;

// The keyed board a client keeps: ids[cell] plus the engine grid. tilesOf is what layer.sync receives.
function keyed(grid) { const k = M.rekey(grid, 1); return { ids: k.ids, next: k.next }; }
function step(st, ids, next, dir, eng) {
  const r = (eng || N).move(st, dir); if (!r.moved) return null;
  const fx = M.track(ids, r.trace, r.spawned, next);
  return { r, fx };
}
// invariant: every filled cell has exactly one id, empty cells have none, ids are unique
function wellKeyed(grid, ids) {
  const seen = new Set();
  grid.forEach((l, c) => { if (l) { ok(ids[c] > 0, "cell " + c + " has no id"); ok(!seen.has(ids[c]), "duplicate id " + ids[c]); seen.add(ids[c]); } else ok(!ids[c], "empty cell " + c + " keeps id " + ids[c]); });
}

t("fallMs: 1 row 130 ms, 6 rows 217 ms, 7 rows 229 ms; grows with the square root; 0 or junk is the base", () => {
  ok(M.fallMs(1) === 130 && M.fallMs(6) === 217 && M.fallMs(7) === 229, [1, 6, 7].map(M.fallMs).join());
  ok(M.fallMs(4) === 190 && M.fallMs(0) === 70 && M.fallMs(-3) === 70 && M.fallMs("x") === 70);
  for (let r = 1; r < 12; r++) ok(M.fallMs(r + 1) > M.fallMs(r) && M.fallMs(r + 1) - M.fallMs(r) <= M.fallMs(r) - M.fallMs(r - 1), "concave at " + r);
});
t("tokens: T and E are the spec's (5.2); ms() keeps fade, plus, sheet when reduced", () => {
  ok(M.T.slide === 110 && M.T.pop === 180 && M.T.appear === 170 && M.T.step === 100 && M.T.settle === 160 && M.T.waveGap === 60);
  ok(M.E.fall === "cubic-bezier(.55,0,1,.45)" && M.E.pop === "cubic-bezier(.3,1.5,.6,1)");
  ok(M.ms("slide") === 110 && M.ms("nope") === 0, "Node has no reduced preference");
});
t("track: a plain slide keeps every id and moves it", () => {
  // row 0: [2,0,0,2] -> left merge; row 1: [0,0,0,2] -> slides to cell 4
  const ids = [1, 0, 0, 2, 0, 0, 0, 3];
  const trace = [{ from: 0, to: 0, merge: false }, { from: 3, to: 0, merge: true }, { from: 7, to: 4, merge: false }];
  const fx = M.track(ids, trace, 5, 4);
  ok(fx.ids[4] === 3 && fx.ids[7] === 0, "slid tile keeps id 3 " + J(fx.ids));
  ok(J(fx.merges) === J([{ id: 4, to: 0, from: [1, 2] }]), J(fx.merges));
  ok(fx.ids[0] === 4 && fx.ids[3] === 0, "merged cell gets the NEW id");
  ok(J(fx.spawns) === J([{ id: 5, cell: 5 }]) && fx.ids[5] === 5 && fx.next === 6, J(fx));
  ok(fx.moves.some(m => m.id === 3 && m.from === 7 && m.to === 4 && !m.merge), "slide listed");
  ok(fx.moves.some(m => m.id === 2 && m.to === 0 && m.merge), "the sliding merge source is listed as moving into the target");
  ok(!fx.moves.some(m => m.id === 1 && m.from !== 0), "unmoved merge base stays at its cell");
  ok(J(ids) === J([1, 0, 0, 2, 0, 0, 0, 3]), "pure: the input id map is not changed");
});
t("track: a tile that does not move is not listed as a move and keeps its id", () => {
  const fx = M.track([7, 0, 0, 0], [{ from: 0, to: 0, merge: false }], -1, 8);
  ok(fx.moves.length === 0 && fx.ids[0] === 7 && fx.spawns.length === 0 && fx.next === 8, J(fx));
});
t("track: spawned may be -1, null, one cell or several cells (Three, Seven)", () => {
  ok(M.track([1], [], null, 2).spawns.length === 0);
  const fx = M.track([0, 0, 0], [], [0, 2], 10);
  ok(J(fx.spawns) === J([{ id: 10, cell: 0 }, { id: 11, cell: 2 }]) && fx.next === 12);
});
t("track: next never collides with an id already on the board, and unkeyed cells in the trace get one", () => {
  const fx = M.track([0, 9, 0, 0], [{ from: 1, to: 0, merge: false }], 3, 2);
  ok(fx.ids[0] === 9 && fx.spawns[0].id === 10, J(fx));
  const g = M.track([0, 0], [{ from: 1, to: 0, merge: false }], -1, 1);
  ok(g.ids[0] === 1 && g.next === 2, "an unkeyed tile gets a fresh id " + J(g));
});
t("track: two merges in one line (2 2 2 2 -> 4 4) make two new ids and four sources", () => {
  const s = N.newGame(1); s.grid = [1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]; s.marks = new Array(16).fill(0);
  const k = keyed(s.grid), st = step(s, k.ids, k.next, "left");
  ok(st.fx.merges.length === 2, J(st.fx.merges));
  ok(J(st.fx.merges.map(m => m.from)) === J([[1, 2], [3, 4]]) && J(st.fx.merges.map(m => m.to)) === J([0, 1]), J(st.fx.merges));
  wellKeyed(st.r.state.grid, st.fx.ids);
});
t("track: chains of moves on the real Two and Fibonacci engines keep ids consistent (200 moves each)", () => {
  [[N, 11], [F, 23]].forEach(([eng, seed]) => {
    let s = eng.newGame(seed), k = keyed(s.grid), ids = k.ids, next = k.next, made = 0, keptIds = 0;
    const dirs = ["left", "up", "right", "down"];
    for (let i = 0; i < 200 && !s.over; i++) {
      let st = null;
      for (let d = 0; d < 4 && !st; d++) st = step(s, ids, next, dirs[(i + d) % 4], eng);
      if (!st) break;
      const before = new Set(ids.filter(Boolean));
      wellKeyed(st.r.state.grid, st.fx.ids);
      // every surviving id came from the previous board; every new id is a merge or a spawn
      const fresh = st.fx.ids.filter(x => x && !before.has(x));
      ok(fresh.length === st.fx.merges.length + st.fx.spawns.length, "new ids = merges + spawns at move " + i);
      st.fx.merges.forEach(m => { ok(m.from.length === 2 && m.from.every(x => before.has(x)), "merge sources were on the board"); ok(st.fx.ids[m.to] === m.id); });
      st.fx.moves.forEach(m => ok(before.has(m.id) && ids[m.from] === m.id, "a move names a tile at its from cell"));
      ok(st.fx.next > Math.max(0, ...st.fx.ids), "next is above every id");
      keptIds += st.fx.ids.filter(x => x && before.has(x)).length;
      ids = st.fx.ids; next = st.fx.next; s = st.r.state; made++;
    }
    ok(made > 30 && keptIds > made, "played a real chain (" + made + " moves)");
  });
});
t("Undo re-key: after Undo the whole board gets fresh ids (no slide), and play continues without a collision", () => {
  let s = N.newGame(5), k = keyed(s.grid), ids = k.ids, next = k.next;
  let st = step(s, ids, next, "left") || step(s, ids, next, "right");
  const oldIds = new Set(st.fx.ids.filter(Boolean));
  const u = N.use(st.r.state, "undo"); ok(u.ok, "undo applied");
  const rk = M.rekey(u.state.grid, st.fx.next);
  wellKeyed(u.state.grid, rk.ids);
  ok(rk.ids.filter(Boolean).every(x => !oldIds.has(x)), "every id is new, so the layer swaps nodes instead of sliding them");
  ok(J(u.state.grid.map(Boolean)) === J(rk.ids.map(Boolean)));
  const again = step(u.state, rk.ids, rk.next, "up") || step(u.state, rk.ids, rk.next, "down") || step(u.state, rk.ids, rk.next, "left");
  ok(again, "a move after undo"); wellKeyed(again.r.state.grid, again.fx.ids);
  ok(again.fx.ids.filter(Boolean).every(x => !oldIds.has(x)), "no id from before the undo returns");
});
t("seq: steps run in time order; finish() runs every pending step now, cascades included; cancel() drops them", () => {
  const log = [], s = M.seq();
  s.at(50, () => log.push("b")).at(10, () => log.push("a")).at(50, () => { log.push("c"); s.at(5, () => log.push("d")); });
  ok(s.busy());
  s.finish();
  ok(log.join("") === "abcd", log.join("")); ok(!s.busy());
  const c = M.seq(), l2 = []; c.at(1, () => l2.push(1)); c.cancel(); c.finish(); ok(l2.length === 0 && !c.busy());
});
t("seq: timers fire on their own, and a finish() means a stale timer never runs a step twice", () => new Promise((res, rej) => {
  const s = M.seq(), log = [];
  s.at(5, () => log.push("x")).at(30, () => log.push("y"));
  setTimeout(() => { s.finish(); }, 15);
  setTimeout(() => { try { ok(log.join("") === "xy", log.join("")); res(); } catch (e) { rej(e); } }, 60);
}));
t("reduced(): Settings Less is reduced, Full beats a reducing OS, Device follows the OS; without settings the boot attribute", () => {
  const path = require.resolve("../shared/motion.js");
  function withWin(win) { const g = global; const keep = {}; ["NumbericsSettings", "matchMedia", "document"].forEach(k => { keep[k] = g[k]; delete g[k]; });
    Object.assign(g, win); delete require.cache[path];
    let r; try { r = require(path).reduced(); } finally { ["NumbericsSettings", "matchMedia", "document"].forEach(k => { delete g[k]; if (keep[k] !== undefined) g[k] = keep[k]; }); delete require.cache[path]; }
    return r; }
  // motion.js binds to `this` at load; under require that is module.exports, so emulate the browser global via self
  const os = q => ({ matchMedia: () => ({ matches: q }) });
  const S = m => ({ NumbericsSettings: { get: () => ({ motion: m }) } });
  const doc = m => ({ document: { documentElement: { dataset: { motion: m } } } });
  function R(win) { global.self = global; try { return withWin(win); } finally { delete global.self; } }
  ok(R(Object.assign(S("reduced"), os(false))) === true, "Less");
  ok(R(Object.assign(S("full"), os(true), doc("reduced"))) === false, "Full overrides the OS");
  ok(R(Object.assign(S("auto"), os(true))) === true && R(Object.assign(S("auto"), os(false))) === false, "Device");
  ok(R(Object.assign(doc("full"), os(true))) === false && R(Object.assign(doc("reduced"), os(false))) === true, "no settings module: boot attribute");
  ok(R({ NumbericsSettings: { get: () => { throw new Error("storage"); } } }) === false, "a throwing settings module never breaks motion");
});
t("play(): without an element or WAAPI it returns null; reduced keeps only opacity, at most T.fade, linear", () => {
  ok(M.play(null, [], {}) === null && M.play({}, [], {}) === null);
  const path = require.resolve("../shared/motion.js");
  global.self = global; global.NumbericsSettings = { get: () => ({ motion: "reduced" }) }; delete require.cache[path];
  try {
    const R = require(path); let got = null; const el = { animate: (f, o) => (got = { f, o }) };
    ok(R.play(el, [{ transform: "scale(0)" }, { transform: "scale(1)" }], { duration: 300 }) === null, "no reduced frames: skipped");
    R.play(el, [{ transform: "scale(0)" }], { duration: 300, delay: 20 }, [{ opacity: 0, transform: "scale(.5)" }, { opacity: 1, scale: 2 }]);
    ok(J(got.f) === J([{ opacity: 0 }, { opacity: 1 }]) && got.o.duration === 160 && got.o.easing === "linear" && got.o.delay === 20, J(got));
  } finally { delete global.self; delete global.NumbericsSettings; delete require.cache[path]; }
});
t("conventions for the motion module", () => {
  const fs = require("fs"), s = fs.readFileSync(require.resolve("../shared/motion.js"), "utf8");
  ok(/SPDX-License-Identifier: Apache-2\.0/.test(s) && !/\u2014/.test(s) && !/document\.write|localStorage/.test(s));
  const css = fs.readFileSync(require("path").join(__dirname, "../shared/theme.css"), "utf8");
  const blk = css.slice(css.indexOf("/* ===== B2 motion"), css.indexOf("/* ===== end B2 motion ===== */"));
  ok(blk.length > 200, "delimited block present");
  ok(!/@keyframes\s+(?!nmm-)/.test(blk), "every keyframe is nmm-*");
  blk.replace(/\/\*[\s\S]*?\*\//g, "").split("}").forEach(r => { const sel = r.split("{")[0].trim(); if (sel && !sel.startsWith("@keyframes") && !/^\d|^from|^to/.test(sel)) ok(sel.split(",").every(x => /^\.nmm-layer/.test(x.trim())), "scoped: " + sel); });
  ok(!/(transition|animation)[^;]*\b(width|height|top|left|margin|padding)\b/.test(blk), "transform and opacity only");
});

Promise.all(later).then(() => { console.log(pass + " passed, " + fail + " failed"); process.exit(fail ? 1 : 0); });
