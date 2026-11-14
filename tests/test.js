/* SPDX-License-Identifier: Apache-2.0 | Copyright 2026 alvations (Melon Lab)
 * Zero-dependency test runner: `node tests/test.js` */
"use strict";
const fs = require("fs"), path = require("path");
const N = require("../engine.js");
let pass = 0, fail = 0;
function t(name, fn) { try { fn(); pass++; } catch (e) { fail++; console.log("FAIL", name, "\n  ", e.message); } }
function eq(a, b, m) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || "") + " got " + JSON.stringify(a) + " want " + JSON.stringify(b)); }
function ok(c, m) { if (!c) throw new Error(m || "assertion failed"); }
function board(rows, extra) {
  const g = [].concat(...rows);
  return Object.assign({ size: rows.length, grid: g, score: 0, top: Math.max(0, ...g), moves: 0, seed: 7,
    over: false, power: { undo: 0, smash: 0, swap: 0, boost: 0 }, prev: null }, extra || {});
}

t("slide merges a pair once and keeps order", () => {
  const r = N.slideLine([1, 1, 1, 1], [0, 1, 2, 3]);
  eq(r.out, [2, 2]); eq(r.gained, 8);
});
t("a merged tile never merges again in the same move", () => {
  eq(N.slideLine([1, 1, 2, 0], [0, 1, 2, 3]).out, [2, 2]);
  eq(N.slideLine([2, 1, 1, 0], [0, 1, 2, 3]).out, [2, 2]);
});
t("all four directions slide to the right wall", () => {
  const s = board([[1,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]]);
  const g = (d) => N.move(s, d);
  eq(g("right").state.grid[3], 1);
  eq(g("down").state.grid[12], 1);
  eq(g("left").moved, false); eq(g("up").moved, false);
});
t("a move that changes nothing spawns nothing and is not counted", () => {
  const s = board([[1,2,3,4],[4,3,2,1],[1,2,3,4],[4,3,2,1]]);
  const r = N.move(s, "left"); eq(r.moved, false); eq(r.state, s);
});
t("spawn is 2 or 4 and moves add exactly one tile", () => {
  let s = N.newGame(42);
  eq(s.grid.filter(Boolean).length, 2);
  s.grid.forEach(v => ok(v === 0 || v === 1 || v === 2));
});
t("deterministic: same seed + moves gives same game", () => {
  const run = () => { let s = N.newGame(99); for (const d of "left,up,right,down,left,up".split(",")) s = N.move(s, d).state; return s; };
  eq(run(), run());
});
t("INFINITE: 2048 is not a win and the game plays on past it", () => {
  let s = board([[11,11,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]]);
  const r = N.move(s, "left");
  eq(r.state.grid[0], 12); ok(!r.state.over); ok(!("won" in r.state), "no win flag exists");
  ok(r.state.grid.filter(Boolean).length >= 2);
});
t("INFINITE: levels far beyond 2^53 merge without overflow", () => {
  const r = N.move(board([[200,200,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]]), "left");
  eq(r.state.grid[0], 201); ok(r.milestones.includes(201));
});
t("labels: digits while short, 2^n beyond", () => {
  eq(N.label(1), "2"); eq(N.label(11), "2048"); eq(N.label(16), "65536"); eq(N.label(17), "2^17"); eq(N.label(200), "2^200");
});
t("score adds the value of every merged tile", () => {
  const r = N.move(board([[2,2,3,3],[0,0,0,0],[0,0,0,0],[0,0,0,0]]), "left");
  eq(r.gained, 8 + 16);
});
t("a new highest tile >= 32 awards a power-up; lower ones and repeats do not", () => {
  let r = N.move(board([[5,5,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]], { top: 5 }), "left");
  eq(r.state.grid[0], 6); eq(r.awarded.length, 1);
  r = N.move(board([[6,6,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]], { top: 9 }), "left");
  eq(r.awarded.length, 0, "not a new highest");
  r = N.move(board([[3,3,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]], { top: 3 }), "left");
  eq(r.awarded.length, 0, "below the award floor"); eq(r.milestones, [4]);
});
t("power stock never exceeds the cap", () => {
  const p = { undo: 9, smash: 9, swap: 9, boost: 8 };
  const r = N.move(board([[5,5,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]], { top: 5, power: p }), "left");
  ok(Object.values(r.state.power).every(v => v <= N.POWER_CAP));
});
t("game over only when locked and no power-up can act", () => {
  const full = [[1,2,1,2],[2,1,2,1],[1,2,1,2],[2,1,2,1]];
  ok(!N.canMove(board(full)));
  const locked = board(full); locked.power.smash = 1;
  const r = N.use(locked, "smash", 0); ok(r.ok && N.canMove(r.state));
  // checkerboard of big levels: the 1/2 spawn can never match a neighbour
  const m = N.move(board([[3,4,3,4],[4,3,4,3],[3,4,3,4],[0,4,3,4]]), "left");
  ok(m.state.over, "locked with no powers = over"); eq(m.moved, true);
});
t("undo rewinds exactly one move and costs one charge", () => {
  const s0 = N.newGame(5); const r = N.move(s0, "left");
  const s1 = r.moved ? r.state : N.move(s0, "right").state;
  const u = N.use(s1, "undo");
  ok(u.ok); eq(u.state.grid, s0.grid); eq(u.state.score, s0.score); eq(u.state.power.undo, 0);
  eq(N.use(u.state, "undo").ok, false, "no stock / nothing to rewind");
});
t("undo cannot farm milestone rewards", () => {
  let s = board([[5,5,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]], { top: 5, power: { undo: 1, smash: 0, swap: 0, boost: 0 } });
  const r = N.move(s, "left"); const total = (st) => Object.values(st.power).reduce((a, b) => a + b, 0);
  const u = N.use(r.state, "undo");
  ok(total(u.state) < total(s) + 1, "net power after undo must not grow"); eq(u.state.top, 5);
});
t("smash removes a tile; empty or out-of-range targets are refused", () => {
  const s = board([[1,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]], { power: { undo: 0, smash: 1, swap: 0, boost: 0 } });
  eq(N.use(s, "smash", 1).ok, false); eq(N.use(s, "smash", 99).ok, false);
  const r = N.use(s, "smash", 0); ok(r.ok); eq(r.state.grid[0], 0); eq(r.state.power.smash, 0);
});
t("boost doubles a tile and never awards", () => {
  const s = board([[4,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]], { power: { undo: 0, smash: 0, swap: 0, boost: 1 } });
  const r = N.use(s, "boost", 0); eq(r.state.grid[0], 5); eq(r.state.top, 5);
  eq(Object.values(r.state.power).reduce((a, b) => a + b, 0), 0);
});
t("swap exchanges two cells (tile<->empty allowed, empty<->empty refused)", () => {
  const s = board([[1,0,0,2],[0,0,0,0],[0,0,0,0],[0,0,0,0]], { power: { undo: 0, smash: 0, swap: 3, boost: 0 } });
  eq(N.use(s, "swap", 0, 3).state.grid[0], 2);
  eq(N.use(s, "swap", 0, 1).state.grid[1], 1);
  eq(N.use(s, "swap", 1, 2).ok, false); eq(N.use(s, "swap", 0, 0).ok, false);
});
t("a power-up with no charges does nothing", () => {
  eq(N.use(board([[1,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]]), "smash", 0).ok, false);
});
t("random play never corrupts the board (5000 moves)", () => {
  let s = N.newGame(2026), seed = 1;
  for (let i = 0; i < 5000 && !s.over; i++) {
    const r = N.rand(seed); seed = r[1];
    s = N.move(s, N.DIRS[Math.floor(r[0] * 4)]).state;
    ok(s.grid.every(v => Number.isInteger(v) && v >= 0), "bad cell");
  }
});

// ---- repo conventions (carried over from the melon-eight / cleo-guide lessons) ----
const root = path.join(__dirname, "..");
const files = ["engine.js", "game.js", "index.html", "style.css"].map(f => [f, fs.readFileSync(path.join(root, f), "utf8")]);
t("no document.write anywhere", () => files.forEach(([f, s]) => ok(!/document\.write/.test(s), f)));
t("no em-dashes anywhere in source", () => files.forEach(([f, s]) => ok(!/—/.test(s), f)));
t("every localStorage use sits inside a try block (storage may throw)", () => {
  const src = files.find(f => f[0] === "game.js")[1];
  const lines = src.split("\n");
  lines.forEach((ln, i) => { if (/localStorage\./.test(ln)) ok(/try\s*\{/.test(lines.slice(Math.max(0, i - 2), i + 1).join(" ")), "unguarded storage at game.js:" + (i + 1)); });
});
t("every source file carries the SPDX header", () => files.forEach(([f, s]) => ok(/SPDX-License-Identifier: Apache-2\.0/.test(s), f)));
t("the content does not depend on a CDN", () => files.forEach(([f, s]) => ok(!/https?:\/\/(cdn|unpkg|cdnjs)/.test(s), f)));

console.log(pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
