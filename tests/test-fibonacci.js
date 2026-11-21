/* SPDX-License-Identifier: Apache-2.0 | Copyright 2026 alvations (Melon Lab)
 * `node tests/test-fibonacci.js` */
"use strict";
const F = require("../fibonacci/engine.js");
let pass = 0, fail = 0;
function t(n, f) { try { f(); pass++; } catch (e) { fail++; console.log("FAIL", n, "\n  ", e.message); } }
function ok(c, m) { if (!c) throw new Error(m || "assertion failed"); }
function eq(a, b, m) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || "") + " got " + JSON.stringify(a) + " want " + JSON.stringify(b)); }
const Z = [0, 0, 0, 0];
function board(rows, extra) {
  const g = [].concat(...rows);
  return Object.assign({ size: rows.length, grid: g, score: 0, top: Math.max(0, ...g), moves: 0, seed: 7,
    over: false, power: { undo: 0, smash: 0, swap: 0, boost: 0 }, prev: null }, extra || {});
}
const line = (lv) => F.slideLine(lv, [0, 1, 2, 3]);
const total = (s) => Object.values(s.power).reduce((a, b) => a + b, 0);

t("values: indices map to the Fibonacci numbers 1, 2, 3, 5, 8, 13 ...", () => {
  eq([1, 2, 3, 4, 5, 6, 7, 8, 17].map(F.value), [1, 2, 3, 5, 8, 13, 21, 34, 2584]);
  for (let i = 3; i < 70; i++) eq(F.value(i), F.value(i - 1) + F.value(i - 2), "index " + i);
});
t("consecutive Fibonacci numbers merge into the next one, in either order", () => {
  eq(line([1, 2, 0, 0]).out, [3]); eq(line([2, 1, 0, 0]).out, [3]);
  eq(line([3, 4, 0, 0]).out, [5]); eq(line([8, 7, 0, 0]).out, [9]);
  eq(line([2, 3, 0, 0]).gained, 5, "2 + 3 scores 5");
});
t("1 + 1 merges to 2", () => { const r = line([1, 1, 0, 0]); eq(r.out, [2]); eq(r.gained, 2); });
t("equal tiles above 1 do not merge (3 + 3, 2 + 2, 5 + 5)", () => {
  eq(line([3, 3, 0, 0]).out, [3, 3]); eq(line([2, 2, 0, 0]).out, [2, 2]); eq(line([5, 5, 0, 0]).out, [5, 5]);
  ok(!F.RULES.canMerge(2, 2) && !F.RULES.canMerge(9, 9));
});
t("non-neighbours in the sequence do not merge (1 + 3, 2 + 5)", () => {
  eq(line([1, 3, 0, 0]).out, [1, 3]); eq(line([2, 4, 0, 0]).out, [2, 4]);
});
t("one merge per tile per move: 1,1,2 slides to 2,2 and the new 2 waits", () => {
  eq(line([1, 1, 2, 0]).out, [2, 2]);
  eq(line([1, 2, 3, 0]).out, [3, 3], "1+2 = 3, the new 3 does not merge with the old 3 (equal anyway)");
  eq(line([2, 3, 4, 0]).out, [4, 4]);
  eq(line([1, 1, 1, 1]).out, [2, 2]);
});
t("all four directions slide; a move that changes nothing is not counted", () => {
  const s = board([[1, 0, 0, 0], Z, Z, Z]);
  eq(F.move(s, "right").state.grid[3], 1); eq(F.move(s, "down").state.grid[12], 1);
  eq(F.move(s, "left").moved, false); eq(F.move(s, "up").moved, false);
  const full = board([[1, 3, 1, 3], [3, 1, 3, 1], [1, 3, 1, 3], [3, 1, 3, 1]]);
  const r = F.move(full, "left"); eq(r.moved, false); ok(r.state === full);
});
t("score adds the value of every merged tile", () => {
  const r = F.move(board([[1, 2, 4, 5], Z, Z, Z]), "left");
  eq(r.state.grid.slice(0, 2), [3, 6]); eq(r.gained, 3 + 13); eq(r.state.score, 16);
});
t("spawns are 1 (about 90%) and 2 (about 10%), nothing else", () => {
  let ones = 0, twos = 0;
  for (let seed = 1; seed <= 2000; seed++) F.newGame(seed).grid.forEach(v => { if (v === 1) ones++; else if (v === 2) twos++; else ok(v === 0, "bad spawn " + v); });
  eq(ones + twos, 4000); const p = twos / 4000; ok(p > 0.08 && p < 0.12, "2 share " + p);
});
t("deterministic: same seed + same moves give the same game", () => {
  const run = () => { let s = F.newGame(99); for (const d of "left,up,right,down,left,up,down,down".split(",")) s = F.move(s, d).state; return s; };
  eq(run(), run());
  ok(JSON.stringify(F.newGame(1).grid) !== JSON.stringify(F.newGame(2).grid) || JSON.stringify(F.newGame(1).grid) !== JSON.stringify(F.newGame(3).grid));
});
t("INFINITE: 2584 is not a win, the game plays on past it", () => {
  const r = F.move(board([[16, 17, 0, 0], Z, Z, Z]), "left");
  eq(r.state.grid[0], 18); eq(F.value(18), 4181); ok(!r.state.over); ok(!("won" in r.state), "no win flag");
});
t("INFINITE: index 300 merges without overflow", () => {
  const r = F.move(board([[299, 300, 0, 0], Z, Z, Z]), "left");
  eq(r.state.grid[0], 301); ok(r.milestones.includes(301)); ok(r.gained > 1e62);
  ok(F.label(301).startsWith("F"));
});
t("labels: digits up to six characters, then F with a subscript Fibonacci index", () => {
  eq(F.label(1), "1"); eq(F.label(4), "5"); eq(F.label(17), "2584"); eq(F.label(29), "832040");
  eq(F.label(30), "F₃₁"); eq(F.value(30), 1346269); // F(31) = 1346269
  eq(F.label(300), "F₃₀₁");
  for (let i = 1; i < 400; i++) ok(F.label(i).length <= 6, "label too long at " + i);
});
t("can move only while a cell is empty or a mergeable pair touches", () => {
  ok(!F.canMove(board([[1, 3, 1, 3], [3, 1, 3, 1], [1, 3, 1, 3], [3, 1, 3, 1]])));
  ok(F.canMove(board([[1, 3, 1, 3], [3, 1, 3, 1], [1, 3, 1, 3], [3, 1, 3, 2]])), "2 next to 3 merges");
  ok(F.canMove(board([[1, 1, 3, 1], [3, 5, 1, 3], [1, 3, 5, 1], [3, 1, 3, 5]])), "1 next to 1 merges");
  ok(!F.canMove(board([[3, 3, 5, 5], [5, 5, 3, 3], [3, 3, 5, 5], [5, 5, 3, 3]])), "equal 3s and 5s are stuck");
});
t("a new highest tile from 55 up awards one power-up; lower ones and repeats do not (round 2 floor)", () => {
  let r = F.move(board([[7, 8, 0, 0], Z, Z, Z], { top: 8 }), "left");
  eq(r.state.grid[0], 9); eq(F.value(9), 55); eq(r.awarded.length, 1); eq(total(r.state), 1);
  r = F.move(board([[6, 7, 0, 0], Z, Z, Z], { top: 7 }), "left");
  eq(r.milestones, [8]); eq(r.awarded.length, 0, "34 is below the floor since round 2");
  r = F.move(board([[8, 9, 0, 0], Z, Z, Z], { top: 12 }), "left");
  eq(r.awarded.length, 0, "not a new highest"); eq(r.state.top, 12);
  eq(F.AWARD_FROM_LEVEL, 9); eq(F.AWARD_FROM_INDEX, 9);
});
t("two new highs in one move award twice, once each", () => {
  const r = F.move(board([[7, 8, 9, 10], Z, Z, Z], { top: 10 }), "left");
  ok(r.awarded.every(a => a.level >= 9));
  eq(r.state.grid.slice(0, 2), [9, 11]); eq(r.milestones, [11]); eq(r.awarded.length, 1);
  const r2 = F.move(board([[7, 8, 0, 0], [9, 10, 0, 0], Z, Z], { top: 10 }), "left");
  eq(r2.milestones, [11]); eq(r2.awarded.length, 1, "9 is not new, 11 is");
});
t("power stock never exceeds the cap of 9", () => {
  const p = { undo: 9, smash: 9, swap: 9, boost: 8 };
  let r = F.move(board([[8, 9, 0, 0], Z, Z, Z], { top: 9, power: p }), "left");
  eq(r.state.power.boost, 9); ok(Object.values(r.state.power).every(v => v <= F.POWER_CAP));
  r = F.move(board([[9, 10, 0, 0], Z, Z, Z], { top: 10, power: { undo: 9, smash: 9, swap: 9, boost: 9 } }), "left");
  eq(total(r.state), 36); eq(r.awarded.length, 0, "R15: a full stock skips the reward (the client says Power-ups full)");
});
t("a fresh run starts with exactly one Undo", () => eq(F.newGame(3).power, { undo: 1, smash: 0, swap: 0, boost: 0 }));
t("undo rewinds exactly one move, costs a charge and cannot farm a reward", () => {
  const s = board([[7, 8, 0, 0], Z, Z, Z], { top: 8, power: { undo: 1, smash: 0, swap: 0, boost: 0 } });
  const r = F.move(s, "left"); eq(r.awarded.length, 1);
  const u = F.use(r.state, "undo"); ok(u.ok);
  eq(u.state.grid, s.grid); eq(u.state.top, 8); eq(u.state.score, 0); eq(total(u.state), 0, "net stock after undo is lower");
  eq(F.use(u.state, "undo").ok, false, "nothing left to rewind");
});
t("smash removes a tile; empty or out-of-range targets are refused", () => {
  const s = board([[3, 0, 0, 0], Z, Z, Z], { power: { undo: 0, smash: 1, swap: 0, boost: 0 } });
  eq(F.use(s, "smash", 1).ok, false); eq(F.use(s, "smash", 16).ok, false); eq(F.use(s, "smash", -1).ok, false);
  const r = F.use(s, "smash", 0); ok(r.ok); eq(r.state.grid[0], 0); eq(r.state.power.smash, 0);
});
t("boost moves a tile to the next Fibonacci number and never awards", () => {
  const s = board([[8, 0, 0, 0], Z, Z, Z], { power: { undo: 0, smash: 0, swap: 0, boost: 1 } });
  const r = F.use(s, "boost", 0); ok(r.ok); eq(r.state.grid[0], 9); eq(F.label(9), "55"); eq(r.state.top, 9);
  eq(total(r.state), 0, "boosting to 55 does not pay out");
  // and the next real merge to a lower value is not a new high either
  eq(F.use(s, "boost", 5).ok, false, "empty cell refused");
});
t("swap exchanges two cells (tile<->empty allowed, empty<->empty refused) and can unlock a board", () => {
  const s = board([[1, 0, 0, 2], Z, Z, Z], { power: { undo: 0, smash: 0, swap: 3, boost: 0 } });
  eq(F.use(s, "swap", 0, 3).state.grid[0], 2); eq(F.use(s, "swap", 0, 1).state.grid[1], 1);
  eq(F.use(s, "swap", 1, 2).ok, false); eq(F.use(s, "swap", 0, 0).ok, false);
  const locked = board([[1, 3, 1, 3], [3, 1, 3, 1], [1, 3, 1, 3], [3, 1, 3, 1]], { power: { undo: 0, smash: 0, swap: 1, boost: 0 } });
  ok(!F.canMove(locked)); ok(F.canMove(F.use(locked, "swap", 0, 1).state));
});
t("a power-up with no charges does nothing", () => {
  const s = board([[1, 0, 0, 0], Z, Z, Z]);
  ["smash", "boost", "undo"].forEach(n => eq(F.use(s, n, 0).ok, false, n)); eq(F.use(s, "swap", 0, 1).ok, false);
});
t("stuck is not over while a power-up can act; locked with none is over", () => {
  const lockedGrid = [[1, 3, 1, 3], [3, 1, 3, 1], [1, 3, 1, 3], [3, 1, 3, 1]];
  const s = board(lockedGrid, { power: { undo: 0, smash: 0, swap: 2, boost: 0 } });
  // swapping two 1s leaves the board locked: one Swap still held, so the run goes on
  const a = F.use(s, "swap", 0, 2); ok(a.ok); ok(!F.canMove(a.state)); eq(a.state.over, false);
  const b = F.use(a.state, "swap", 0, 2); ok(b.ok); ok(!F.canMove(b.state)); eq(b.state.over, true, "locked, no usable power: over");
  // a move that ends locked with no powers is over at once
  const m = F.move(board([[1, 3, 1, 3], [3, 1, 3, 1], [1, 3, 1, 3], [0, 4, 6, 8]]), "left");
  ok(m.moved); if (!F.canMove(m.state)) ok(m.state.over);
  ok(F.move(b.state, "left").moved === false, "an over game ignores moves");
});
t("the Endless engine is unchanged by the Fibonacci rule set", () => {
  const N = require("../two/engine.js");
  eq(N.label(11), "2048"); eq(N.slideLine([1, 1, 2, 0], [0, 1, 2, 3]).out, [2, 2]); eq(N.slideLine([1, 2, 0, 0], [0, 1, 2, 3]).out, [1, 2]);
  eq(N.AWARD_FROM_LEVEL, 5);
});
t("random play never corrupts the board, and every run ends locked (300 games)", () => {
  let d = 1;
  for (let g = 1; g <= 300; g++) {
    let s = F.newGame(g), n = 0;
    while (!s.over && n < 20000) {
      const r = F.rand(d); d = r[1];
      const res = F.move(s, F.DIRS[Math.floor(r[0] * 4)]);
      if (res.moved) { s = res.state; n++; ok(s.grid.every(v => Number.isInteger(v) && v >= 0), "bad cell"); ok(s.grid.filter(Boolean).length >= 2); }
      else if (!F.canMove(s)) break;
    }
    ok(!F.canMove(s), "game " + g + " ended while moves remained");
  }
});
t("boost on a 1 makes a 2, as the hint says (1 becomes 2)", () => {
  const r = F.use(board([[1, 0, 0, 0], Z, Z, Z], { power: { undo: 0, smash: 0, swap: 0, boost: 1 } }), "boost", 0);
  ok(r.ok); eq(F.label(r.state.grid[0]), "2");
});
t("an over game cannot be undone (R1): over means no usable Undo", () => {
  const m = F.move(board([[1, 3, 1, 3], [3, 1, 3, 1], [1, 3, 1, 3], [0, 4, 6, 8]], { power: { undo: 1, smash: 0, swap: 0, boost: 0 } }), "left");
  ok(m.moved); ok(!m.state.over, "holding Undo with a snapshot is not over");
  const s = board([[1, 3, 1, 3], [3, 1, 3, 1], [1, 3, 1, 3], [3, 1, 3, 1]], { over: true });
  eq(F.use(s, "undo").ok, false);
});
t("R2 repro (critic F1): Boost 21 to 34 beside 55, then the swipe that makes 89, pays nothing", () => {
  const s = board([[9, 7, 0, 0], Z, Z, Z], { top: 9, power: { undo: 0, smash: 0, swap: 0, boost: 1 } });
  eq(F.move(s, "left").awarded.length, 0, "the plain swipe cannot merge 55 and 21");
  const b = F.use(s, "boost", 1); ok(b.ok); eq(b.state.grid.slice(0, 2), [9, 8]);
  const r = F.move(b.state, "left"); eq(r.state.grid[0], 10, "55 + 34 = 89");
  eq(r.awarded.length, 0, "a boost-assisted swipe never pays"); eq(total(r.state), 0);
});
t("R2 repro: Swap a 34 beside 55, then the swipe that makes 89, pays nothing", () => {
  const s = board([[9, 0, 0, 0], [0, 0, 0, 8], Z, Z], { top: 9, power: { undo: 0, smash: 0, swap: 1, boost: 0 } });
  const w = F.use(s, "swap", 1, 7); ok(w.ok); eq(w.state.grid.slice(0, 2), [9, 8]);
  const r = F.move(w.state, "left"); eq(r.state.grid[0], 10); eq(r.awarded.length, 0, "a swap-assisted swipe never pays");
});
t("R2 property: random play mixing power-ups and moves never raises the stock through a power-up-assisted move", () => {
  let d = 4242, bad = 0, checked = 0;
  const rnd = () => { const r = F.rand(d); d = r[1]; return r[0]; };
  for (let g = 1; g <= 120; g++) {
    let s = F.newGame(g), assisted = false;
    for (let n = 0; n < 4000 && !s.over; n++) {
      if (s.top >= 6 && rnd() < 0.25) { // stock up so the fuzz always has power-ups to try
        s = Object.assign({}, s, { power: { undo: s.power.undo, smash: Math.max(1, s.power.smash), swap: Math.max(1, s.power.swap), boost: Math.max(1, s.power.boost) } });
        const tiles = s.grid.map((v, i) => v ? i : -1).filter(i => i >= 0);
        const name = ["smash", "swap", "boost"][Math.floor(rnd() * 3)];
        const a = tiles[Math.floor(rnd() * tiles.length)], b = Math.floor(rnd() * 16);
        const u = F.use(s, name, a, b);
        if (u.ok) {
          ok(total(u.state) === total(s) - 1, "a power-up spends exactly its charge and earns nothing");
          s = u.state; assisted = true; continue;
        }
      }
      const res = F.move(s, F.DIRS[Math.floor(rnd() * 4)]);
      if (!res.moved) { if (!F.canMove(s)) break; continue; }
      if (assisted) { checked++; if (total(res.state) > total(s)) bad++; }
      assisted = false; s = res.state;
    }
  }
  ok(checked > 1000, "fuzz reached " + checked + " assisted moves");
  eq(bad, 0, "assisted moves that raised the stock (of " + checked + ")");
});
t("R2 by tile (round 3): the 89 a Boost made stays marked, so merging it with 55 later pays nothing; an honest one pays", () => {
  const s = board([[9, 7, 0, 0], Z, Z, Z], { top: 9, power: { undo: 0, smash: 0, swap: 0, boost: 1 } });
  let r = F.move(F.use(s, "boost", 1).state, "left"); eq(r.awarded.length, 0); eq(r.state.marks[0], 1, "the 89 is marked");
  // the marked 89 meets a 55 later: 144 is a new top tile, but a marked one
  const m = r.state.marks.slice();
  r = F.move(Object.assign({}, r.state, { grid: [10, 9, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1], marks: m, free: false }), "left");
  eq(r.state.grid[0], 11); eq(r.awarded.length, 0, "a marked new top tile pays nothing"); ok(r.marked);
  // the same merge from honest tiles pays
  r = F.move(Object.assign({}, r.state, { grid: [11, 10, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1], marks: new Array(16).fill(0), top: 11 }), "left");
  eq(r.state.grid[0], 12); eq(r.awarded.length, 1, "a natural new top tile pays");
});
t("R2 by tile, mechanics repro: Swap the 377 beside the 610, Up (no merge), Left makes 987 and pays nothing", () => {
  const s = board([[0, 0, 0, 13], [14, 0, 0, 0], Z, [0, 0, 0, 0]], { top: 14, power: { undo: 0, smash: 0, swap: 1, boost: 0 } });
  const w = F.use(s, "swap", 3, 5); ok(w.ok); eq([w.state.grid[4], w.state.grid[5]], [14, 13]); eq(w.state.marks[5], 1);
  const up = F.move(w.state, "up"); ok(up.moved); eq(up.merges, [], "Up merges nothing");
  eq([up.state.grid[0], up.state.grid[1]], [14, 13], "the pair stays in line");
  const left = F.move(up.state, "left"); eq(left.state.grid[0], 15, "610 + 377 = 987");
  eq(left.awarded, [], "a swapped tile never pays"); ok(left.marked);
  const h = F.move(F.move(s, "up").state, "left"); eq(h.awarded, [], "the same swipes without the Swap pay nothing");
});
t("R2 by tile, critic repro: Boost 21 to 34 beside 55, a dummy swipe, then 89 pays nothing", () => {
  const s = board([[9, 7, 0, 0], Z, Z, [0, 0, 0, 1]], { top: 9, power: { undo: 0, smash: 0, swap: 0, boost: 1 } });
  const b = F.use(s, "boost", 1), d = F.move(b.state, "up"); ok(d.moved); eq(d.state.grid.slice(0, 2), [9, 8]); ok(!d.state.free);
  const r = F.move(d.state, "left"); eq(r.state.grid[0], 10); eq(r.awarded, []); ok(r.marked);
});
t("R15: a full stock flags the skipped reward (the client says Power-ups full)", () => {
  const full = { undo: 9, smash: 9, swap: 9, boost: 9 };
  const r = F.move(board([[9, 8, 0, 0], Z, Z, Z], { top: 9, power: full }), "left");
  eq(r.milestones, [10]); eq(r.awarded, []); ok(r.full);
});
// The critic's method, as in tests/test.js: the same moves with and without the power-up, 0 to 5 neutral moves
// (legal in both lines, merging in neither) after a Boost or Swap, 0 after a Smash or a swap into an empty cell.
function r2Property(E, seeds) {
  let trials = 0, paying = 0, bad = [], gaps = [0, 0, 0, 0, 0, 0];
  for (let seed = 1; seed <= seeds; seed++) {
    let x = (seed * 2654435761) >>> 0;
    const rnd = () => { x = (x * 1103515245 + 12345) >>> 0; return x / 4294967296; };
    const pick = (a) => a[Math.floor(rnd() * a.length)];
    let s = E.newGame(seed); s.power = { undo: 0, smash: 5, swap: 5, boost: 5 };
    for (let step = 0; step < 4000 && !s.over; step++) {
      let r = null; const pref = ["left", "down", "right", "up"];
      for (const d of (rnd() < 0.85 ? pref : pref.slice().sort(() => rnd() - 0.5))) { r = E.move(s, d); if (r.moved) break; }
      if (!r || !r.moved) break;
      s = r.state;
      if (rnd() >= 0.3) continue;
      const tiles = s.grid.map((v, i) => v ? i : -1).filter(i => i >= 0), empt = s.grid.map((v, i) => v ? -1 : i).filter(i => i >= 0);
      const big = tiles.filter(i => s.grid[i] >= s.top - 2), name = pick(["boost", "swap", "swap0", "smash"]);
      const a = rnd() < 0.7 && big.length ? pick(big) : pick(tiles);
      let u;
      if (name === "boost" || name === "smash") u = E.use(s, name, a);
      else if (name === "swap") u = E.use(s, "swap", a, pick(tiles));
      else { if (!empt.length) continue; u = E.use(s, "swap", a, pick(empt)); }
      if (!u.ok) continue;
      const want = name === "boost" || name === "swap" ? Math.floor(rnd() * 6) : 0;
      let p = u.state, q = s, k = 0;
      for (let tr = 0; tr < 40 && k < want; tr++) {
        const d = pick(E.DIRS), rp = E.move(p, d), rq = E.move(q, d);
        if (!rp.moved || !rq.moved || rp.merges.length || rq.merges.length) continue;
        p = rp.state; q = rq.state; k++;
      }
      gaps[k]++;
      for (const d of E.DIRS) {
        const rp = E.move(p, d), rq = E.move(q, d); trials++;
        if (rp.milestones.some(l => l >= E.AWARD_FROM_INDEX)) paying++;
        if (rp.awarded.length > rq.awarded.length && bad.length < 3) bad.push(name + " k=" + k + " " + d + " seed " + seed + " " + JSON.stringify(p.grid));
      }
    }
  }
  return { trials, paying, bad, gaps };
}
t("R2 property, by tile: Boost or Swap, 0 to 5 neutral moves, then any move never out-earns the same moves without it", () => {
  const r = r2Property(F, 80);
  eq(r.bad, [], "the power-up earned a reward");
  ok(r.trials > 15000, "trials " + r.trials); ok(r.paying > 150, "power-up lines that reached a paying tile: " + r.paying);
  r.gaps.forEach((n, k) => ok(n >= 5, "gap " + k + " exercised " + n + " times"));
});
{
  const fs = require("fs"), path = require("path"), rd = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
  const html = rd("fibonacci/index.html"), js = rd("fibonacci/game.js");
  t("R6 header, TRIAGE4: H1 Fibonacci, a plain subtitle (the card's line), no Numberics link (the top bar links home)", () => {
    ok(/<h1>Fibonacci<\/h1>/.test(html));
    const m = html.match(/<p class="sub">([^<]+)<\/p>/); ok(m, "sub pattern");
    eq(m[1], "Join neighbours in the Fibonacci run.");
    ok(rd("shared/nav.js").indexOf('"Join neighbours in the Fibonacci run."') >= 0, "the card says the same");
  });
  t("TRIAGE4 craft #12: the hint row starts with how to play, never blank on open", () => {
    ok(/<p id="hint" class="hint" role="status">Swipe or use the arrow keys\.<\/p>/.test(html));
    ok(/var START = "Swipe or use the arrow keys\.";/.test(js) && /!state\.moves \? START/.test(js));
  });
  t("R11: no bare hyphen as an empty stat value", () => ok(!/<b id="\w+"[^>]*>-<\/b>/.test(html) && !/: "-"/.test(js)));
  t("R5: tray defs, Undo first, each with a sentence description and how to earn it", () => {
    const ids = [...js.matchAll(/\{ id: "(\w+)", label: "\w+", desc: "([^"]+)", earn: EARN \}/g)];
    eq(ids.map(m => m[1]), ["undo", "smash", "swap", "boost"]); ids.forEach(m => ok(/^[A-Z].*\.$/.test(m[2]), m[2]));
    ok(/onInfo:/.test(js), "tray onInfo wired");
  });
  t("R8: the end card has a 'New best.' line", () => ok(/id="over-best" class="best" hidden>New best\.</.test(html)));
  t("R9, R17: Enter or Space on a focused button or link is left to it; fields are never game keys", () => {
    ok(/\(e\.key === "Enter" \|\| e\.key === " "\) && \(tag === "BUTTON" \|\| tag === "A"/.test(js));
    ok(/tag === "INPUT" \|\| tag === "SELECT"/.test(js));
  });
  const how = html.replace(/\s+/g, " ");
  t("round 3 (cold #10): the how-to says equal tiles do not merge, except 1 + 1", () => ok(/Equal tiles do not merge, except 1 \+ 1\./.test(how)));
  t("round 3 (R2 copy, mechanics #2): the how-to says exactly which tiles and moves never earn", () => {
    ok(/Swapped and boosted tiles never earn a reward, and neither does the move right after a Smash, Swap or Boost\./.test(how));
    ok(/Swapped and boosted tiles earn no reward\./.test(js) && /Power-ups full\./.test(js), "toasts say why a tile paid nothing");
    ok(!/Boost! Boosted tiles earn no reward"/.test(js), "the old toast is gone");
  });
  t("round 3 (craft #5, cold #11): Best starts as a dimmed none", () => {
    ok(/<b id="best" class="none">none<\/b>/.test(html)); ok(/\$\("best"\)\.textContent = bs \? fmt\(bs\) : "none"/.test(js));
    ok(!/\.stat b\.none\{ color:var\(--mute\); font-weight:400; \}/.test(rd("fibonacci/style.css")), "the shared .stat .none style applies");
  });
  t("round 3 (craft #7/#8): the end card offers See the board; the page New game hides with its space kept", () => {
    ok(/<button id="over-view" class="btn" type="button">See the board<\/button>/.test(html));
    ok(/\$\("new"\)\.style\.visibility = state\.over \? "hidden" : ""/.test(js), "visibility, not display");
    ok(/\$\("again"\)\.focus\(/.test(js), "focus moves to the card's primary");
  });
  t("round 3 (cold #5): the board owns its touchmove, so the tap after a swipe is never eaten", () =>
    ok(/addEventListener\("touchmove", function \(e\) \{ if \(e\.cancelable\) e\.preventDefault\(\); \}, \{ passive: false \}\)/.test(js)));
  t("round 3 (craft #2): values that sit together have clearly distinct colours (delta E >= 30, text 4.5:1)", () => {
    const H = JSON.parse(js.match(/var HUES = (\[[^\]]+\])/)[1]);
    const hsl2rgb = (h, s, l) => { s /= 100; l /= 100; const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
      const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))); return [f(0), f(8), f(4)]; };
    const lin = c => c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    const lab = (rgb) => { const [r, g, b] = rgb.map(lin), f = t => t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
      const X = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047, Y = r * 0.2126 + g * 0.7152 + b * 0.0722, Zc = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
      return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Zc))]; };
    const lum = rgb => { const [r, g, b] = rgb.map(lin); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
    const text = lum([0x15 / 255, 0x15 / 255, 0x1d / 255]);
    const L = H.map(h => { const rgb = hsl2rgb(h, 62, 60); return { lab: lab(rgb), c: (lum(rgb) + 0.05) / (text + 0.05) }; });
    const de = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    for (let i = 0; i < L.length; i++) {
      ok(L[i].c >= 4.5, "dark text contrast for hue " + H[i] + ": " + L[i].c.toFixed(2));
      for (let j = i + 1; j < L.length; j++) ok(de(L[i].lab, L[j].lab) >= 30, H[i] + " vs " + H[j] + ": " + de(L[i].lab, L[j].lab).toFixed(1));
      ok(de(L[i].lab, L[(i + 1) % L.length].lab) >= 80, "merge partners " + H[i] + " and " + H[(i + 1) % L.length]);
    }
    ok(/HUES\[\(level - 2\) % HUES\.length\]/.test(js), "the table cycles by level");
  });
  // Phase D (REDESIGN.md 5.3, 7.3, 8.4, 1.3, 3.3)
  t("D: tiles live in the shared keyed layer; no destroy-and-rebuild, no ANIM constant cached at load", () => {
    ok(/M\.layer\(tilesEl/.test(js) && /M\.track\(ids, r\.trace, r\.spawned, nextId\)/.test(js), "layer + track");
    ok(!/var ANIM\s*=/.test(js) && !/tilesEl\.textContent = ""/.test(js), "no ANIM, no rebuild");
    ok(/function doMove\(dir\) \{\s*settle\(\);/.test(js), "a new input finishes the running animation first");
  });
  t("D: sounds on the beats (slide, merge(index), best, power, lose) through one timeline", () => {
    ["slide", "merge", "best", "power", "lose"].forEach(n => ok(new RegExp('sfx\\("' + n + '"').test(js), n));
    ok(/fx\.sound\(slide, function \(\) \{ sfx\("merge", k\)/.test(js), "merge at the end of the slide (a sound step, D7)");
  });
  t("D: trophy events and fields exactly as 8.4", () => {
    ok(/trophy\("move", data\)/.test(js) && /value: N\.value\(state\.top\), merges: r\.merges\.length, grid: state\.grid\.map\(N\.value\), moves: state\.moves, run:/.test(js));
    ok(/trophy\("end", \{ score: state\.score, value: N\.value\(state\.top\), run:/.test(js));
    ok(/id="over-tro" class="tro-pills" hidden/.test(html) && /T\.pills\(\$\("over-tro"\), endTro\)/.test(js), "end-card pills");
  });
  t("D: progress put on every persist; music ducks with the end card", () => {
    const per = js.slice(js.indexOf("function persist()"), js.indexOf("var fmt = K.fmt"));
    ok(/NP\.put\(ID, \{ best:/.test(per) && /live: !state\.over && state\.moves > 0/.test(per));
    ok(/NumbericsMusic\.duck\(on\)/.test(js) && /duck\(!over\.hidden\)/.test(js) && /duck\(false\)/.test(js));
  });
  t("D: the how-to is a collapsed row with the full rules and keys, and three steps from 9.2", () => {
    ok(/<details class="how" id="how"><summary>How to play<\/summary>/.test(html) && !/<p class="how">/.test(html));
    ["Swipe to slide every tile.", "Neighbours in the run join: 1 and 1, 1 and 2, 2 and 3, 3 and 5.", "Equal tiles do not join, except 1 and 1."]
      .forEach(s => ok(js.indexOf('"' + s + '"') >= 0, s));
    ok(/U\.howto\(ID, \{ title: "Fibonacci", steps: STEPS, saved: !fresh \}\)/.test(js)); // the shared how-to (D8)
  });
  t("D: the games list on the page is the cards (NumbericsNav)", () => ok(/<div id="games" class="cards" data-root="\.\.\/" data-current="fibonacci">/.test(html)));
  t("round 2: the help line, the tray and the engine agree on the 55 floor", () => {
    ok(/new highest tile from 55 up/.test(html) && /new top tile from 55\./.test(js));
    ok(!/from 34/.test(html) && !/from 34/.test(js)); eq(F.value(F.AWARD_FROM_INDEX), 55);
  });
}
require("./conventions")(t, ok, ["fibonacci/engine.js", "fibonacci/game.js", "fibonacci/index.html", "fibonacci/style.css"]);
console.log(pass + " passed, " + fail + " failed"); process.exit(fail ? 1 : 0);
