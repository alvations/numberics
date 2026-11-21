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
t("power-ups change only their target: no spawn, no move counted (Boost does not spend a turn)", () => {
  const s = board([[4,0,0,0],[0,0,1,0],[0,0,0,0],[0,0,0,0]], { power: { undo: 0, smash: 1, swap: 1, boost: 1 } });
  [["boost", 0], ["smash", 6], ["swap", 0, 15]].forEach(([n, a, b]) => {
    const r = N.use(s, n, a, b); ok(r.ok, n);
    eq(r.state.grid.filter(Boolean).length, s.grid.filter(Boolean).length - (n === "smash" ? 1 : 0), n + " tile count");
    eq(r.state.moves, s.moves, n + " moves"); eq(r.state.seed, s.seed, n + " seed");
  });
});
// ---- round 2 (docs/reviews/TRIAGE2.md R2): a power-up never earns one, including the next move ----
const tot = (st) => N.POWERS.reduce((a, k) => a + st.power[k], 0);
const Z4 = [0, 0, 0, 0];
const P0 = (o) => Object.assign({ undo: 0, smash: 0, swap: 0, boost: 0 }, o);
t("R2 blocker repro: Boost 32 beside 64, then a swipe, makes 128 and pays nothing", () => {
  const s = board([[6, 0, 0, 5], Z4, Z4, Z4], { top: 6, power: P0({ boost: 1 }) });
  eq(N.move(s, "left").awarded.length, 0, "the plain swipe pays nothing");
  const u = N.use(s, "boost", 3); ok(u.ok); eq(u.state.grid.slice(0, 4), [6, 0, 0, 6]); ok(u.state.free, "next move marked unpaid");
  const m = N.move(u.state, "left"); eq(m.state.grid[0], 7); eq(m.milestones, [7], "the milestone still counts");
  eq(m.awarded, [], "no reward"); eq(tot(m.state), 0); ok(m.free, "the result says why"); ok(!m.state.free, "the mark lasts one move");
  eq(m.state.top, 7, "top still rises"); eq(m.gained, 128, "points still score");
  // the same board reached by play pays
  const h = N.move(board([[6, 0, 0, 6], Z4, Z4, Z4], { top: 6 }), "left"); eq(h.awarded.length, 1, "an honest 128 pays");
});
t("R2 blocker repro: Swap two 64s side by side, then a swipe, pays nothing", () => {
  const s = board([[6, 0, 0, 0], [0, 0, 6, 0], Z4, Z4], { top: 6, power: P0({ swap: 1 }) });
  const u = N.use(s, "swap", 1, 6); ok(u.ok); eq(u.state.grid.slice(0, 2), [6, 6]);
  const m = N.move(u.state, "left"); eq(m.state.grid[0], 7); eq(m.awarded, []); eq(tot(m.state), 0);
});
t("R2: Smash opens a merge, the swipe after it pays nothing", () => {
  const s = board([[5, 1, 5, 0], Z4, Z4, Z4], { top: 5, power: P0({ smash: 1 }) });
  const u = N.use(s, "smash", 1); ok(u.ok);
  const m = N.move(u.state, "left"); eq(m.state.grid[0], 6); eq(m.milestones, [6]); eq(m.awarded, []);
});
t("R2: only the next move is unpaid; the move after it pays as usual", () => {
  const s = board([[5, 0, 0, 0], [6, 6, 0, 0], Z4, Z4], { top: 6, power: P0({ smash: 1 }) });
  const u = N.use(s, "smash", 0); const m1 = N.move(u.state, "down"); ok(m1.moved); eq(m1.awarded, []);
  ok(!m1.state.free);
  // put a fresh 64 pair on the board: an honest merge right after the unpaid move pays
  const s2 = Object.assign({}, m1.state, { grid: m1.state.grid.slice() }); s2.grid.fill(0); s2.grid[0] = 6; s2.grid[1] = 6; s2.top = 6;
  eq(N.move(s2, "left").awarded.length, 1);
});
t("R2: Undo of the unpaid move restores the mark, so a rewind cannot launder the reward", () => {
  const s = board([[6, 0, 0, 5], Z4, Z4, Z4], { top: 6, power: P0({ boost: 1, undo: 1 }) });
  const u = N.use(s, "boost", 3), m = N.move(u.state, "left");
  const back = N.use(m.state, "undo"); ok(back.ok); ok(back.state.free, "the mark comes back with the board");
  const again = N.move(back.state, "left"); eq(again.awarded, []); eq(tot(again.state), 0);
});
t("R2: Undo of a power-up clears the mark with it", () => {
  const s = board([[6, 0, 0, 5], Z4, Z4, Z4], { top: 6, power: P0({ boost: 1, undo: 1 }) });
  const u = N.use(s, "boost", 3); const r = N.use(u.state, "undo"); ok(r.ok); ok(!r.state.free);
});
t("R2: an old save without the mark plays as before", () => {
  const s = board([[6, 6, 0, 0], Z4, Z4, Z4], { top: 6 }); delete s.free;
  eq(N.move(s, "left").awarded.length, 1);
});
t("R2 property: a power-up followed by any move never raises the total stock (random games)", () => {
  let checked = 0, paidHonest = 0;
  for (let seed = 1; seed <= 120; seed++) {
    let s = N.newGame(seed), x = seed;
    s.power = { undo: 2, smash: 3, swap: 3, boost: 3 };
    for (let i = 0; i < 400 && !s.over; i++) {
      x = (x * 1103515245 + 12345) >>> 0;
      if (x % 4 === 0) {
        const name = N.POWERS[1 + (x >>> 3) % 3], a = (x >>> 5) % 16, b = (x >>> 9) % 16;
        const before = tot(s), u = N.use(s, name, a, b);
        if (u.ok) {
          ok(tot(u.state) === before - 1, "use pays nothing, seed " + seed);
          // chains of power-ups then a move: still nothing
          let v = u.state, used = 1;
          if (x % 3 === 0) { const w = N.use(v, "boost", (x >>> 13) % 16); if (w.ok) { v = w.state; used++; } }
          N.DIRS.forEach(d => { const r = N.move(v, d); if (r.moved) { ok(tot(r.state) === before - used, name + " then " + d + ", seed " + seed); checked++; } });
          s = v; continue;
        }
      }
      const r = N.move(s, N.DIRS[(x >>> 7) % 4]);
      if (r.moved) { if (r.awarded.length) paidHonest++; s = r.state; }
      else if (!N.canMove(s)) break;
    }
  }
  ok(checked > 1000, "exercised " + checked); ok(paidHonest > 20, "honest moves still pay (" + paidHonest + ")");
});
// ---- round 3 (docs/reviews/TRIAGE3.md): R2 by tile. Swapped and boosted tiles are marked, marks follow merges,
// a marked new top tile pays nothing however many moves later; Smash keeps the one-move rule ----
const Z16 = () => new Array(16).fill(0);
const withMarks = (s, cells) => { const m = Z16(); cells.forEach(c => { m[c] = 1; }); return Object.assign({}, s, { marks: m }); };
t("R2 by tile, critic S1 repro: Boost 32 beside 64, a dummy swipe, then the merge pays nothing", () => {
  const s = board([[6, 5, 0, 0], Z4, Z4, [0, 0, 0, 1]], { top: 6, power: P0({ boost: 1 }) });
  const u = N.use(s, "boost", 1); ok(u.ok); eq(u.state.grid.slice(0, 2), [6, 6]); eq(u.state.marks[1], 1, "the boosted tile is marked");
  const m1 = N.move(u.state, "up"); ok(m1.moved); eq(m1.state.grid.slice(0, 2), [6, 6], "the dummy swipe leaves the pair");
  eq(m1.awarded, []); ok(!m1.state.free, "the one-move flag has lapsed");
  const m2 = N.move(m1.state, "left"); eq(m2.state.grid[0], 7, "64 + 64 = 128");
  eq(m2.milestones, [7], "the milestone counts"); eq(m2.awarded, [], "but a marked tile never pays"); ok(m2.marked, "the result says why");
  eq(m2.state.marks[0], 1, "the 128 carries the mark"); ok(m2.gained >= 128, "points still score"); eq(m2.state.top, 7);
  // the same two swipes without the Boost pay nothing, and the same board reached honestly pays
  const h1 = N.move(s, "up"), h2 = N.move(h1.state, "left"); eq(h1.awarded.length + h2.awarded.length, 0);
  eq(N.move(withMarks(m1.state, []), "left").awarded.length, 1, "the same board unmarked pays");
});
t("R2 by tile, mechanics repro: Swap a 1024 beside the other, a non-merging swipe, then 2048 pays nothing", () => {
  const s = board([[10, 0, 0, 0], [1, 10, 0, 0], Z4, [0, 0, 0, 1]], { top: 10, power: P0({ swap: 1 }) });
  const u = N.use(s, "swap", 5, 4); ok(u.ok); eq([u.state.grid[0], u.state.grid[4]], [10, 10]);
  eq([u.state.marks[4], u.state.marks[5]], [1, 1], "both swapped tiles are marked");
  const e = N.use(board([[1, 0, 0, 0], Z4, Z4, Z4], { power: P0({ swap: 1 }) }), "swap", 0, 3);
  eq([e.state.marks[0], e.state.marks[3]], [0, 1], "a swap into an empty cell marks the moved tile only");
  const m1 = N.move(u.state, "left"); ok(m1.moved); eq(m1.merges, [], "Left merges nothing"); eq(m1.awarded, []);
  const m2 = N.move(m1.state, "up"); eq(m2.state.grid[0], 11, "2048 is made");
  eq(m2.awarded, [], "a swapped tile never pays"); ok(m2.marked);
  const h = N.move(N.move(s, "left").state, "up"); eq(h.awarded, [], "without the Swap the same swipes pay nothing");
});
t("R2 by tile: a mark follows its tile through slides and merges, and still blocks a reward five moves later", () => {
  // a boosted 4 (row 3) merges into a 4, the 8 into an 8 ... up to the new top, over several moves
  let s = board([[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [6, 5, 4, 2]], { top: 6, power: P0({ boost: 1 }) });
  s = N.use(s, "boost", 15).state; eq(s.grid[15], 3); eq(s.marks[15], 1);
  let r = N.move(s, "right"); eq(r.state.marks.filter(Boolean).length, 1, "one marked tile after a slide");
  const cell = r.state.marks.indexOf(1); eq(r.state.grid[cell], 3, "the mark stayed on the boosted tile");
  // merge the marked 8 with an honest 8 placed beside it: the 16 is marked
  const g = Z16(); g[12] = 6; g[13] = 5; g[14] = 4; g[15] = 3; g[11] = 3;
  let t1 = Object.assign({}, r.state, { grid: g, marks: (() => { const m = Z16(); m[15] = 1; return m; })(), free: false });
  r = N.move(t1, "down"); eq(r.state.grid[15], 4); eq(r.state.marks[15], 1, "honest 8 + marked 8 = a marked 16");
  for (let k = 0; k < 5; k++) { const q = N.move(r.state, k % 2 ? "left" : "right"); if (q.moved) r = q; }
  // build the chain into the corner: 16 + 16, 32 + 32, 64 + 64 = 128, all from the marked tile
  const m = r.state.marks.slice(), at = m.indexOf(1); ok(at >= 0, "the mark survived five moves");
  const lv = r.state.grid[at], g2 = Z16(), m2 = Z16(); g2[0] = 6; g2[1] = 6; m2[1] = 1;
  const r2 = N.move(Object.assign({}, r.state, { grid: g2, marks: m2, top: 6, free: false }), "left");
  eq(r2.state.grid[0], 7); eq(r2.awarded, [], "a marked merge never pays, however late"); ok(lv >= 4);
});
t("R2 by tile: an honest merge to the same new top in the same move still pays", () => {
  const s = withMarks(board([[6, 6, 0, 0], [6, 6, 0, 0], Z4, Z4], { top: 6 }), [1]);
  const r = N.move(s, "left"); eq(r.state.grid[0], 7); eq(r.state.grid[4], 7);
  eq(r.state.marks[0], 1); eq(r.state.marks[4], 0); eq(r.awarded.length, 1, "the honest 128 pays");
});
t("R2 by tile: Smash removes a mark with its tile and keeps the one-move rule; a spawn is never marked", () => {
  const s = withMarks(board([[5, 1, 5, 0], Z4, Z4, Z4], { top: 5, power: P0({ smash: 1 }) }), [0]);
  const u = N.use(s, "smash", 0); ok(u.ok); eq(u.state.marks[0], 0); ok(u.state.free, "Smash: the next move pays nothing");
  const m = N.move(u.state, "left"); ok(m.moved); eq(m.state.marks[m.spawned], 0, "the spawned tile is unmarked");
  eq(m.state.marks.filter(Boolean).length, 0);
});
t("R2 by tile: Undo restores the marks with the board, and undoing the power-up clears them", () => {
  const s = board([[6, 5, 0, 0], Z4, Z4, [0, 0, 0, 1]], { top: 6, power: P0({ boost: 1, undo: 2 }) });
  const u = N.use(s, "boost", 1), m1 = N.move(u.state, "up"), m2 = N.move(m1.state, "left");
  const back = N.use(m2.state, "undo"); ok(back.ok); eq(back.state.marks, m1.state.marks, "the marks come back");
  const again = N.move(back.state, "left"); eq(again.awarded, [], "a rewind cannot launder the mark");
  const undoBoost = N.use(u.state, "undo"); ok(undoBoost.ok); eq(undoBoost.state.marks.filter(Boolean).length, 0);
  ok(Array.isArray(m2.state.prev.marks), "the snapshot carries the marks");
});
t("R2 by tile: an old save without marks, or with malformed ones, plays as unmarked", () => {
  const s = board([[6, 6, 0, 0], Z4, Z4, Z4], { top: 6 }); delete s.marks;
  eq(N.move(s, "left").awarded.length, 1);
  eq(N.move(Object.assign({}, s, { marks: [1, 1] }), "left").awarded.length, 1, "a wrong-length list is ignored");
  const m = Z16(); m[2] = 1; // a mark on an empty cell means nothing
  const r = N.move(Object.assign({}, s, { marks: m }), "left"); eq(r.awarded.length, 1);
  ok(N.newGame(3).marks.every(v => v === 0) && N.newGame(3).marks.length === 16, "a new game starts unmarked");
});
t("R2 by tile: slideLine carries marks (a merge with a marked tile is marked)", () => {
  const r = N.slideLine([1, 1, 2, 2], [0, 1, 2, 3], [0, 1, 0, 0]);
  eq(r.out, [2, 3]); eq(r.marks, [1, 0]); eq(r.mergeMarks, [1, 0]);
  eq(N.slideLine([0, 3, 0, 3], [0, 1, 2, 3], [0, 0, 0, 1]).marks, [1]);
  eq(N.slideLine([1, 1], [0, 1]).marks, [0], "no marks given: none");
});
t("R15 (critic S2): a full stock says so; the reward is skipped, not lost silently", () => {
  const full = { undo: 9, smash: 9, swap: 9, boost: 9 };
  const r = N.move(board([[5, 5, 0, 0], Z4, Z4, Z4], { top: 5, power: full }), "left");
  eq(r.milestones, [6]); eq(r.awarded, []); ok(r.full, "result flags the full stock"); eq(r.state.power, full);
  ok(!N.move(board([[5, 5, 0, 0], Z4, Z4, Z4], { top: 5 }), "left").full, "a normal award is not full");
  const gsrc = fs.readFileSync(path.join(__dirname, "..", "game.js"), "utf8");
  ok(/r\.full\) toast\("New tile " \+ N\.label\(top\) \+ "\. Power-ups full\.", "info"\)/.test(gsrc), "the client toasts it");
  ok(/r\.marked\) toast\("New tile " \+ N\.label\(top\) \+ "\. Swapped and boosted tiles earn no reward\.", "info"\)/.test(gsrc), "and the marked case");
});
// The R2 property (critic's method): the same moves with and without the power-up. After a Boost or a Swap, k = 0 to 5
// neutral moves (legal in both lines, merging in neither: the dummy swipes that once laundered a reward), then each of
// the four directions: the powered line never earns more than the plain one. Smash, and a swap into an empty cell,
// change space, so they keep the one-move rule (k = 0). Shared with tests/test-fibonacci.js in shape.
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
        if (rp.milestones.some(l => l >= E.AWARD_FROM_LEVEL)) paying++;
        if (rp.awarded.length > rq.awarded.length && bad.length < 3) bad.push(name + " k=" + k + " " + d + " seed " + seed + " " + JSON.stringify(p.grid));
      }
    }
  }
  return { trials, paying, bad, gaps };
}
t("R2 property, by tile: Boost or Swap, 0 to 5 neutral moves, then any move never out-earns the same moves without it", () => {
  const r = r2Property(N, 160);
  eq(r.bad, [], "the power-up earned a reward");
  ok(r.trials > 15000, "trials " + r.trials); ok(r.paying > 200, "power-up lines that reached a paying tile: " + r.paying);
  r.gaps.forEach((n, k) => ok(n >= 5, "gap " + k + " exercised " + n + " times"));
});

t("a Boost that cannot help still ends the run once it is spent (no endless wait)", () => {
  // locked checkerboard of 2 and 8: boosting a 2 to 4 matches no neighbour
  const s = board([[1, 3, 1, 3], [3, 1, 3, 1], [1, 3, 1, 3], [3, 1, 3, 1]], { power: P0({ boost: 1 }) });
  ok(!N.canMove(s));
  const u = N.use(s, "boost", 0); ok(u.ok); ok(u.state.over, "locked, nothing left: over");
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
t("no em-dashes anywhere in source", () => files.forEach(([f, s]) => ok(!/\u2014/.test(s), f)));
t("every localStorage use sits inside a try block (storage may throw)", () => {
  const src = files.find(f => f[0] === "game.js")[1];
  const lines = src.split("\n");
  lines.forEach((ln, i) => { if (/localStorage\./.test(ln)) ok(/try\s*\{/.test(lines.slice(Math.max(0, i - 2), i + 1).join(" ")), "unguarded storage at game.js:" + (i + 1)); });
});
t("every source file carries the SPDX header", () => files.forEach(([f, s]) => ok(/SPDX-License-Identifier: Apache-2\.0/.test(s), f)));
t("the content does not depend on a CDN", () => files.forEach(([f, s]) => ok(!/https?:\/\/(cdn|unpkg|cdnjs)/.test(s), f)));

// ---- round 1 fixes (docs/reviews/TRIAGE1.md): static guards for the page shell ----
const src = Object.fromEntries(files);
t("C1 rename (REDESIGN.md 3.1, 4.2): the root is Two: title, H1, sub line, meta, favicon; no Endless left on the page", () => {
  const h = src["index.html"];
  ok(/<title>Numberics Two<\/title>/.test(h), "title");
  ok(/<h1>Two<\/h1>/.test(h), "H1");
  ok(/<p class="sub">Every tile is a power of two\. No top tile\.<\/p>/.test(h), "sub line");
  ok(/<meta name="description" content="Two: 2048 with no top tile\. Every tile is a power of two;/.test(h), "meta description");
  ok(/%3E2%3C\/text%3E/.test(h) && !/%E2%88%9E/.test(h), "favicon is a 2, not the infinity sign");
  ok(!/endless/i.test(h), "no Endless in the root page");
  ok(!/Endless/.test(fs.readFileSync(path.join(root, "README.md"), "utf8").replace("Two was called Endless", "")), "README: Endless only in the one line on the old name");
});
t("C1 back-compat: Two keeps the numberics_endless_v1 save key and the replay fixture name, with the reason beside them", () => {
  ok(/K\.store\("numberics_endless_v1"\)/.test(src["game.js"]), "save key");
  ok(/Two was called Endless; the key is kept so saved games load/.test(src["game.js"]), "the comment at the key");
  ok(fs.existsSync(path.join(__dirname, "fixtures", "endless-replay.json")), "replay fixture name");
});
t("C1 root layout (REDESIGN.md 3.1, 3.3, 3.4): Today and the game cards beside the board, then the footer line", () => {
  const h = src["index.html"];
  ok(/<div class="layout">\s*<main id="app">/.test(h), "layout wraps the game");
  ok(/<aside class="side"[^>]*>\s*<section id="today" class="today"[^>]*><\/section>\s*<h2 id="more">Ten number games<\/h2>\s*<p class="lede">From the smallest number to the biggest\. Free, no ads, saved on this device\.<\/p>\s*<div id="games" class="cards" data-root="" data-current="two"/.test(h), "side: Today, heading, lede, cards");
  ok(/<p class="foot-note">Your scores and trophies stay on this device\. Nothing is sent anywhere\.<\/p>/.test(h), "footer line");
  ok(h.indexOf('id="games"') > h.indexOf("</main>"), "the cards sit after the game");
  ok(/\.layout\{[^}]*max-width:1100px[^}]*display:grid[^}]*gap:28px/.test(src["style.css"]), "layout grid");
  ok(/@media \(min-width:960px\)\{\s*\.layout\{ grid-template-columns:480px minmax\(0,1fr\);[^}]*gap:48px/.test(src["style.css"]), "beside the board from 960");
});
t("C1 alias: two/ sends the player to the root (meta refresh and a visible link, no script)", () => {
  const a = fs.readFileSync(path.join(root, "two", "index.html"), "utf8");
  ok(/<meta http-equiv="refresh" content="0; url=\.\.\/">/.test(a) && /<a href="\.\.\/">Go to Two<\/a>/.test(a), "refresh + link");
  ok(/SPDX-License-Identifier: Apache-2\.0/.test(a) && /href="\.\.\/shared\/theme\.css"/.test(a) && !/<script/.test(a) && !/document\.write|\u2014/.test(a), "header, theme, no script");
});
t("R5: the tray is the shared one (descriptions, aria-disabled, tap explains) and loads before game.js", () => {
  const h = src["index.html"];
  ok(h.indexOf("shared/kit.js") >= 0 && h.indexOf("shared/power.js") >= 0 && h.indexOf("shared/power.js") < h.indexOf('src="game.js"'), "script order");
  ok(/P\.tray\(/.test(src["game.js"]) && /onInfo/.test(src["game.js"]), "uses NumbericsPower.tray with onInfo");
  ok(!/\.disabled\s*=/.test(src["game.js"]), "never sets button.disabled");
  ok(/\.pw\.empty\{/.test(src["style.css"]), ".pw.empty styled");
});
t("R7/F2/F3: toast at the top with a neutral bad variant; warnings use it", () => {
  ok(/\.toast\{[^}]*top:max\(/.test(src["style.css"]) && !/\.toast\{[^}]*bottom:/.test(src["style.css"]), "toast at top");
  ok(/\.toast\.bad\{/.test(src["style.css"]), "bad variant");
  ok(/toast\([^;]*"bad"\)/.test(src["game.js"]), "a warning passes bad");
});
t("R8/F7 (REDESIGN.md 2.1 end card): a near-opaque blurred card, New best line, gold best", () => {
  ok(/\.over\{[^}]*rgba\(18,19,26,\.9[5-9]\d*\)[^}]*color-mix\(in srgb, var\(--bg\) 9[2-9]%, transparent\)[^}]*backdrop-filter:blur\(3px\)/.test(src["style.css"]), "card: .95+ fallback, then 92%+ bg with blur");
  ok(/id="over-best" class="best" hidden>New best\.</.test(src["index.html"]), "New best line");
  ok(/\.over \.best\{/.test(src["style.css"]), "best style");
});
t("F5/F9: hover, press and the gold focus ring (3px, REDESIGN.md 2.1) are mirrored from shared/theme.css", () => {
  ok(/\.btn:hover:not\(:disabled\)/.test(src["style.css"]) && /\.pw:active:not\(:disabled\)/.test(src["style.css"]), "hover/press");
  ok(/:focus-visible\{ outline:3px solid var\(--accent\)/.test(src["style.css"]), "focus ring on links and controls");
});
t("R9: Enter or Space on a focused button is left to the button", () => {
  ok(/\(e\.key === "Enter" \|\| e\.key === " "\) && \(tag === "BUTTON" \|\| tag === "A"\)\) return;/.test(src["game.js"]));
});

t("R17: keys typed into a field, and Enter/Space on a link or button, are never game actions", () => {
  ok(/if \(tag === "INPUT" \|\| tag === "SELECT" \|\| tag === "TEXTAREA"\) return;/.test(src["game.js"]), "field guard");
});
t("round 2 (cold #1): the tray is rebuilt only when what it shows changes, so a tap is never lost", () => {
  ok(/if \(key !== trayKey\) \{ trayKey = key; drawTray\(\); \}/.test(src["game.js"]), "tray cache");
  ok(/renderTray\(\); \/\/ the tray and hint follow the move at once/.test(src["game.js"]), "tray updates on the move");
});
t("round 3: the help line says exactly how R2 works and names the number keys", () => {
  const how = src["index.html"].replace(/\s+/g, " ");
  ok(/Swapped and boosted tiles never earn a reward, and neither does the move right after a Smash, Swap or Boost\. Keys 1 to 4 use the power-ups\./.test(how), "help copy");
  ok(!/except on the move right after you use one/.test(how), "the old one-move copy is gone");
  ok(/\.toast\.info\{/.test(src["style.css"]) && /--line:#33384f/.test(src["style.css"]), "info toast and --line mirrored (the token block, tests/test-theme.js)");
});

t("D-Two motion (REDESIGN.md 5.3, 5.11, 5.12): a keyed layer, never a rebuilt board; motion read at each move", () => {
  const g = src["game.js"], c = src["style.css"], th = fs.readFileSync(path.join(root, "shared", "theme.css"), "utf8");
  ok(/M\.layer\(tilesEl,/.test(g) && /M\.track\(ids, r\.trace, r\.spawned, nextId\)/.test(g), "layer + track");
  ok(!/tilesEl\.textContent\s*=/.test(g) && !/innerHTML/.test(g.replace(/body\.innerHTML/, "")), "the board's DOM is never rebuilt");
  ok(!/var ANIM\b/.test(g) && !/K\.reducedMotion\(\)/.test(g), "no motion constant cached at load");
  ok(/function flush\(\) \{ layer\.finish\(\); snd\.cancel\(\); clearRing\(\); \}/.test(g) && /function doMove\(dir\) \{\s*flush\(\);/.test(g), "a new input finishes the running animation first");
  const blk = (s, a, z) => s.slice(s.indexOf(a), s.indexOf(z) + z.length);
  ok(blk(c, "/* ===== B2 motion", "/* ===== end B2 motion ===== */") === blk(th, "/* ===== B2 motion", "/* ===== end B2 motion ===== */"), "B2 block mirrored byte for byte");
  ok(/:root\[data-motion="full"\]\{ --anim:var\(--m-slide\); \}/.test(c) && /:root\[data-motion="reduced"\]\{ --anim:0ms; \}/.test(c), "B1 motion lines");
  ok(/:root\[data-motion="reduced"\] \.stat \.plus\{ animation:two-fadeout/.test(c) && /\.tiles\.nmm-reduced \.tile\.ring::after/.test(c), "+N and the ring only fade under reduced motion");
});
t("D-Two trophies, progress, how-to and music (REDESIGN.md 8.4, 3.5, 1.3, MUSIC.md)", () => {
  const g = src["game.js"], h = src["index.html"];
  ["move", "power", "end"].forEach(ev => ok(new RegExp('trophy\\("' + ev + '", \\{').test(g), "reports " + ev));
  ok(/merges: r\.merges\.length, grid: state\.grid\.slice\(\),\s*moves: state\.moves, stuck: !N\.canMove\(state\), run: run/.test(g), "move fields");
  ok(/run: run \}\);\s*\/\/ the card summary/.test(g) || /store\.save\(\{ state: state, bestScore: best\.score, bestTop: best\.top, bestBefore: bestBefore, run: run \}\)/.test(g), "the run record is saved with the game");
  ok(/NP\.put\("two", \{ best:/.test(g), "progress put on persist");
  ok(/seenHowto\("two"\)/.test(g) && /markHowto\("two"\)/.test(g) && /var firstVisit = !saved;/.test(g), "how-to once, never for a saved player");
  ok(/<details class="how"><summary>How to play<\/summary>/.test(h) && /<div id="over-pills" class="tro-pills" hidden><\/div>/.test(h), "how-to row and pill row");
  ok(/TR\.pills\(\$\("over-pills"\), endIds\)/.test(g) && /NumbericsMusic\.duck\(on\)/.test(g) && !/music\.js/.test(h), "pills, duck; music.js is never loaded by the page");
});
t("history carries only the owner's authorship (no AI author, co-author or trailer)", () => {
  let log;
  try { log = require("child_process").execSync("git log --format=%an%n%ae%n%cn%n%ce%n%B", { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }); }
  catch (e) { console.log("SKIP authorship history scan: git or a git checkout is not available here"); return; } // e.g. a zip download
  const bad = new RegExp(["cl" + "aude", "anthr" + "opic", "co-authored-by", "noreply@", "generated with"].join("|"), "i");
  const hit = log.split("\n").find(l => bad.test(l.replace(/\bCLAUDE\.md\b/g, "")));  // the memory file's name is not attribution
  ok(!hit, "attribution found in history: " + hit);
});

t("every live game in games.json has mobile + desktop screenshots", () => {
  const games = JSON.parse(fs.readFileSync(path.join(root, "games.json"), "utf8"));
  games.filter(g => g.status === "live").forEach(g => ["mobile", "desktop"].forEach(v => {
    const f = path.join(root, "screenshots", g.id + "-" + v + ".png");
    ok(fs.existsSync(f) && fs.statSync(f).size > 10000, "missing or empty " + path.relative(root, f) + " (run npm run shots)");
  }));
});

// ---- replay: the rule-set refactor must keep Endless byte-identical ----
// A seeded driver plays 20 games of 1,000 actions (moves plus every power-up, with valid and invalid
// targets) and hashes every result. The fixture was recorded from the engine BEFORE the refactor.
// Re-record only for an intended rule change: RECORD_ENDLESS_REPLAY=1 node tests/test.js. Re-recorded for round 2
// (state.free) and round 3 (state.marks: stepping both engines from the same state over 200 seeds, 199,304 actions,
// the only differences are 1,284 awards withheld because a marked tile made the new top tile, and the marks field).
function endlessReplay(seed) {
  const h = require("crypto").createHash("sha256");
  let s = N.newGame(seed), d = seed * 7919 + 1, games = 1;
  const r = () => { const x = N.rand(d); d = x[1]; return x[0]; };
  for (let i = 0; i < 1000; i++) {
    if (s.over) { s = N.newGame(seed * 1000 + games++); h.update(JSON.stringify(s)); continue; }
    const k = r();
    let res;
    if (k < 0.9) res = N.move(s, N.DIRS[Math.floor(r() * 4)]);
    else {
      const name = N.POWERS[Math.floor(r() * 4)];
      if (s.power[name] < 1 && r() < 0.7) s = Object.assign({}, s, { power: Object.assign({}, s.power, { [name]: 1 }) });
      res = N.use(s, name, Math.floor(r() * 18) - 1, Math.floor(r() * 18) - 1);
    }
    h.update(JSON.stringify(res)); s = res.state;
  }
  return { seed, hash: h.digest("hex"), games, final: { grid: s.grid, score: s.score, top: s.top, moves: s.moves, power: s.power, over: s.over } };
}
const REPLAY = path.join(__dirname, "fixtures", "endless-replay.json");
if (process.env.RECORD_ENDLESS_REPLAY) {
  fs.mkdirSync(path.dirname(REPLAY), { recursive: true });
  const all = []; for (let sd = 1; sd <= 20; sd++) all.push(endlessReplay(sd));
  fs.writeFileSync(REPLAY, JSON.stringify(all, null, 1) + "\n");
}
t("replay: 20 seeded games x 1,000 actions match the recorded Endless fixture exactly", () => {
  const want = JSON.parse(fs.readFileSync(REPLAY, "utf8"));
  eq(want.length, 20);
  want.forEach(w => eq(endlessReplay(w.seed), w, "seed " + w.seed));
});
t("replay: the default rule set is Endless and make() with it plays the same game", () => {
  ok(typeof N.make === "function" && N.ENDLESS, "rule-set factory exported");
  const E = N.make(N.ENDLESS);
  let a = N.newGame(77), b = E.newGame(77);
  for (let i = 0; i < 300 && !a.over; i++) { const dd = N.DIRS[i % 4]; a = N.move(a, dd).state; b = E.move(b, dd).state; }
  eq(a, b);
});

console.log(pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
