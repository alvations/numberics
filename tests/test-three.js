/* SPDX-License-Identifier: Apache-2.0 | Copyright 2026 alvations (Melon Lab)
 * `node tests/test-three.js` */
"use strict";
const T = require("../three/engine.js");
let pass = 0, fail = 0;
function t(n, f) { try { f(); pass++; } catch (e) { fail++; console.log("FAIL", n, "\n  ", e.message); } }
function ok(c, m) { if (!c) throw new Error(m || "assertion failed"); }
function eq(a, b, m) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || "") + " got " + JSON.stringify(a) + " want " + JSON.stringify(b)); }
// a state with a hand-made grid (bag and seed from a real game)
function at(grid, extra) { const s = T.newGame(7); s.grid = grid.slice(); s.top = Math.max(...grid); s.next = 3; return Object.assign(s, extra || {}); }
const E16 = () => new Array(16).fill(0);

t("1 + 2 = 3, but 1+1 and 2+2 never merge", () => {
  ok(T.canMerge(1, 2) && T.canMerge(2, 1)); ok(!T.canMerge(1, 1)); ok(!T.canMerge(2, 2));
  ok(!T.canMerge(1, 3) && !T.canMerge(2, 3), "a 1 or 2 never merges with a 3");
});
t("equal multiples of 3 merge; step merge joins neighbouring multiples only", () => {
  ok(T.canMerge(3, 3) && T.canMerge(12, 12)); ok(T.canMerge(3, 6) && T.canMerge(9, 6) && T.canMerge(18, 21));
  ok(!T.canMerge(3, 9), "3 and 9 are not neighbours"); ok(!T.canMerge(6, 12)); ok(!T.canMerge(0, 3));
});
t("a step merge is always a multiple of 3 (3k + 3(k+1))", () => {
  for (let k = 1; k < 40; k++) { const v = T.stepLine([3 * k, 3 * k + 3, 0, 0]).out[0]; eq(v, 6 * k + 3); ok(v % 3 === 0); }
});
t("one step per swipe: tiles move a single cell, gaps close one at a time", () => {
  eq(T.stepLine([0, 3, 0, 3]).out, [3, 0, 3, 0]);
  eq(T.stepLine([0, 0, 0, 6]).out, [0, 0, 6, 0]);
  eq(T.stepLine([3, 6, 9, 1]).out, [9, 9, 1, 0], "first mergeable pair merges, the rest follow one step");
  ok(!T.stepLine([3, 9, 3, 9]).moved, "a packed line with no merges does not move");
});
t("a line merges once per swipe (Threes rule)", () => {
  eq(T.stepLine([3, 3, 3, 3]).out, [6, 3, 3, 0]);
  eq(T.stepLine([1, 2, 1, 2]).out, [3, 1, 2, 0]);
  eq(T.stepLine([3, 9, 6, 2]).out, [3, 15, 2, 0]);
});
t("stepLine scores the merged value", () => { eq(T.stepLine([1, 2, 0, 0]).gained, 3); eq(T.stepLine([6, 9, 0, 0]).gained, 15); });

t("findRuns: straight runs of consecutive multiples in either direction", () => {
  const g = E16(); g[0] = 3; g[1] = 6; g[2] = 9; g[12] = 12; g[13] = 9; g[14] = 6; g[15] = 3;
  eq(T.findRuns(g), [[0, 1, 2], [12, 13, 14, 15]]);
  const v = E16(); v[1] = 9; v[5] = 6; v[9] = 3; eq(T.findRuns(v), [[1, 5, 9]], "vertical");
});
t("findRuns: two in a row, gaps, equals, 1s and mixed directions are not runs", () => {
  const g = E16(); g[0] = 3; g[1] = 6; g[4] = 3; g[6] = 9; g[8] = 6; g[9] = 6; g[10] = 9; g[12] = 3; g[13] = 6; g[14] = 3;
  eq(T.findRuns(g), []);
  const h = E16(); h[0] = 1; h[1] = 2; h[2] = 3; eq(T.findRuns(h), []);
});
t("findRuns: a zigzag splits into its monotonic pieces", () => {
  const g = E16(); g[0] = 3; g[1] = 6; g[2] = 9; g[3] = 6; eq(T.findRuns(g), [[0, 1, 2]]);
});

t("move: Flush collapses the run onto its highest tile, scores sum x length, awards one power-up", () => {
  const g = E16(); g[0] = 3; g[4] = 6; g[9] = 9;           // the 9 steps left into column 0
  const s = at(g); const before = T.POWERS.reduce((a, p) => a + s.power[p], 0);
  const r = T.move(s, "left");
  ok(r.moved); eq(r.flushes.length, 1);
  const f = r.flushes[0]; eq(f.values, [3, 6, 9]); eq(f.value, 18); eq(f.points, 54); eq(f.at, 8);
  eq(r.state.grid[8], 18); eq(r.state.grid[0], 0); eq(r.state.grid[4], 0);
  eq(r.state.score, 54); eq(r.state.flushes, 1); eq(r.state.best, 54);
  eq(T.POWERS.reduce((a, p) => a + r.state.power[p], 0), before + 1, "exactly one charge");
  ok(T.POWERS.includes(f.power)); eq(f.before[9 - 1], 9, "before shows the run in place");
});
t("move: the next tile enters at the far edge of a line that moved", () => {
  const g = E16(); g[5] = 1;                               // only row 1 moves on "left"
  const s = at(g, { next: 2 }); const r = T.move(s, "left");
  eq(r.spawned, 7); eq(r.state.grid[4], 1); eq(r.state.grid[7], 2);
  const u = T.move(at(g, { next: 2 }), "up"); eq(u.spawned, 13, "up: enters at the bottom of column 1");
  const d = T.move(at(g, { next: 2 }), "down"); eq(d.spawned, 1); const rt = T.move(at(g, { next: 2 }), "right"); eq(rt.spawned, 4);
});
t("move: a swipe that moves nothing changes nothing", () => {
  const g = [3, 9, 3, 9, 9, 3, 9, 3, 3, 9, 3, 9, 9, 3, 9, 3]; const s = at(g); s.next = 1;
  T.DIRS.forEach(d => { const r = T.move(s, d); ok(!r.moved); ok(r.state === s); });
  ok(!T.canMove(s));
});
t("move: a merge scores and the preview is replaced from the bag", () => {
  const g = E16(); g[0] = 1; g[1] = 2; const s = at(g, { next: 3 });
  const r = T.move(s, "left"); eq(r.state.grid[0], 3); eq(r.state.score, 3); eq(r.state.moves, 1);
  eq(r.state.grid[r.spawned], 3, "the previewed tile is what arrives"); ok([1, 2, 3].includes(r.state.next));
});
t("cascade: a collapse that lines up a new run flushes again, and each flush pays", () => {
  // column 0 reads 3,6,9 once the 9 steps left; it collapses to 18 at cell 8, and row 2 then reads 18,21,24
  const g = E16(); g[0] = 3; g[4] = 6; g[9] = 9; g[10] = 21; g[11] = 24;
  const r = T.move(at(g), "left");
  ok(r.flushes.length >= 2, "flushes " + r.flushes.length);
  eq(r.flushes[1].values, [18, 21, 24]); eq(r.state.grid[10], 63); eq(r.state.flushes, 2);
});

t("newGame: nine tiles from the bag, one Undo, deterministic by seed", () => {
  const a = T.newGame(42), b = T.newGame(42), c = T.newGame(43);
  eq(a, b); ok(JSON.stringify(a) !== JSON.stringify(c));
  eq(a.grid.filter(Boolean).length, 9); ok(a.grid.every(v => [0, 1, 2, 3].includes(v)));
  eq(a.power, { undo: 1, smash: 0, swap: 0, third: 0 }); ok(!a.over); ok([1, 2, 3].includes(a.next));
});
t("the bag deals three 1s, three 2s and six 3s per twelve tiles", () => {
  eq(T.RULES.bag, "b33");
  let st = at([0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], { bag: [] });
  const seq = [];
  for (let i = 0; i < 12; i++) { seq.push(st.next === undefined ? 0 : 0); const r = T.move(st, "left"); st = at([0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], { bag: r.state.bag, seed: r.state.seed, next: r.state.next }); seq[i] = r.state.next; }
  const counts = { 1: 0, 2: 0, 3: 0 }; seq.forEach(v => counts[v]++);
  eq(counts, { 1: 3, 2: 3, 3: 6 }, "one full bag");
});
t("deterministic: same seed and swipes give the same game", () => {
  const play = (seed) => { let s = T.newGame(seed); for (let i = 0; i < 200 && !s.over; i++) { const r = T.move(s, T.DIRS[i % 4]); s = r.moved ? r.state : T.move(s, T.DIRS[(i + 1) % 4]).state; } return s; };
  eq(play(9), play(9));
});
t("invariant: every tile is 1, 2 or a multiple of 3 across many random games", () => {
  for (let seed = 1; seed <= 60; seed++) {
    let s = T.newGame(seed), x = seed;
    for (let i = 0; i < 400 && !s.over; i++) {
      const r = T.move(s, T.DIRS[(x = (x * 1103515245 + 12345) >>> 0) % 4]); if (r.moved) s = r.state;
      else if (!T.canMove(s)) { if (T.usable(s, "smash")) s = T.use(s, "smash", s.grid.findIndex(Boolean)).state; else break; }
      ok(s.grid.every(v => v === 0 || v === 1 || v === 2 || v % 3 === 0), "seed " + seed);
      ok(T.findRuns(s.grid).length === 0, "no run is left standing after a move");
    }
  }
});

t("Undo restores the whole snapshot, stock included, and is paid for", () => {
  const g = E16(); g[0] = 3; g[4] = 6; g[9] = 9; const s = at(g);
  const r = T.move(s, "left"); ok(r.flushes.length === 1);
  const u = T.use(r.state, "undo"); ok(u.ok);
  eq(u.state.grid, s.grid); eq(u.state.score, s.score); eq(u.state.seed, s.seed); eq(u.state.next, s.next);
  eq(u.state.power, Object.assign({}, s.power, { undo: 0 }), "the flush reward is gone with the rewind");
  ok(!T.use(u.state, "undo").ok, "one step of history"); eq(u.state.used, 1);
});
t("Undo needs history and a charge", () => {
  const s = T.newGame(3); ok(!T.use(s, "undo").ok, "no prev yet");
  const r = T.move(s, T.DIRS.find(d => T.move(s, d).moved)); r.state.power.undo = 0; ok(!T.use(r.state, "undo").ok);
});
t("Smash removes a tile; empty cells and empty stock are refused", () => {
  const g = E16(); g[3] = 9; const s = at(g, { power: { undo: 1, smash: 1, swap: 0, third: 0 } });
  ok(!T.use(s, "smash", 0).ok); const u = T.use(s, "smash", 3); ok(u.ok); eq(u.state.grid[3], 0); eq(u.state.power.smash, 0);
  ok(!T.use(u.state, "smash", 3).ok); ok(u.state.prev, "a power-up can be undone");
});
t("Swap trades two neighbouring, different tiles only", () => {
  const g = E16(); g[0] = 1; g[1] = 3; g[4] = 1; g[5] = 6; const s = at(g, { power: { undo: 1, smash: 0, swap: 2, third: 0 } });
  ok(!T.use(s, "swap", 0, 5).ok, "diagonal"); ok(!T.use(s, "swap", 0, 4).ok, "equal tiles"); ok(!T.use(s, "swap", 3, 4).ok, "row wrap");
  ok(!T.use(s, "swap", 1, 2).ok, "with an empty cell");
  const u = T.use(s, "swap", 1, 5); ok(u.ok); eq(u.state.grid[1], 6); eq(u.state.grid[5], 3); eq(u.state.power.swap, 1);
});
t("Third turns a 1 or 2 into a 3, nothing else", () => {
  const g = E16(); g[0] = 1; g[1] = 2; g[2] = 3; const s = at(g, { power: { undo: 1, smash: 0, swap: 0, third: 2 } });
  ok(!T.use(s, "third", 2).ok); ok(!T.use(s, "third", 5).ok);
  const u = T.use(s, "third", 0); ok(u.ok); eq(u.state.grid[0], 3); eq(T.use(u.state, "third", 1).state.grid[1], 3);
});
t("a power-up never earns a power-up, even when it lines up a run", () => {
  const g = E16(); g[0] = 3; g[1] = 6; g[2] = 2; const s = at(g, { power: { undo: 1, smash: 0, swap: 0, third: 1 } });
  // Third makes 3-6-3: not a run; and use() never resolves flushes at all
  const u = T.use(s, "third", 2); eq(u.state.flushes, 0); eq(u.state.power, { undo: 1, smash: 0, swap: 0, third: 0 });
  const g2 = E16(); g2[0] = 3; g2[1] = 9; g2[5] = 6; const s2 = at(g2, { power: { undo: 0, smash: 0, swap: 1, third: 0 } });
  const w = T.use(s2, "swap", 1, 5); ok(w.ok); eq(w.state.score, 0); eq(w.state.power, { undo: 0, smash: 0, swap: 0, third: 0 });
});
const tot = (s) => T.POWERS.reduce((a, p) => a + s.power[p], 0);
t("R2 blocker repro: Swap lines up 3-6-9, it collapses at once, scores, and pays no power-up", () => {
  const g = E16(); g[0] = 3; g[1] = 9; g[2] = 6; const s = at(g, { power: { undo: 0, smash: 0, swap: 1, third: 0 } });
  const u = T.use(s, "swap", 1, 2); ok(u.ok);
  eq(u.flushes.length, 1, "the run flushes inside use()"); eq(u.flushes[0].values, [3, 6, 9]); eq(u.flushes[0].power, null); eq(u.flushes[0].paid, false);
  eq(u.state.grid[2], 18); eq(u.state.score, 54, "points still score"); eq(u.state.flushes, 1);
  eq(u.state.power, { undo: 0, smash: 0, swap: 0, third: 0 }, "no power-up"); eq(T.findRuns(u.state.grid), [], "no run left standing");
  const m = T.move(u.state, "down"); ok(m.moved); eq(tot(m.state), 0, "the next swipe pays nothing either");
});
t("R2: Third that completes a run collapses it unpaid", () => {
  const g = E16(); g[4] = 2; g[5] = 6; g[6] = 9; const u = T.use(at(g, { power: { undo: 0, smash: 0, swap: 0, third: 1 } }), "third", 4);
  ok(u.ok); eq(u.state.grid[6], 18); eq(tot(u.state), 0);
});
t("R2 indirect: the swipe right after Smash opens a run, the flush scores but pays no power-up", () => {
  // column 0 reads 3, 6, 15 and row 2 is a packed 15 9; smash the 15 and the 9 steps left into 3-6-9
  const g = E16(); g[0] = 3; g[4] = 6; g[8] = 15; g[9] = 9; const s = at(g, { power: { undo: 0, smash: 1, swap: 0, third: 0 } });
  ok(!T.move(s, "left").flushes.length, "no flush without the power-up");
  const u = T.use(s, "smash", 8); ok(u.ok); ok(u.state.free, "the next swipe is marked unpaid"); eq(u.flushes.length, 0);
  const m = T.move(u.state, "left"); eq(m.flushes.length, 1); eq(m.flushes[0].power, null); eq(m.state.score, 54); eq(tot(m.state), 0);
  ok(!m.state.free, "the mark lasts one swipe");
  // the same board reached without the power-up pays
  const g2 = E16(); g2[0] = 3; g2[4] = 6; g2[9] = 9; const p = T.move(at(g2, { power: { undo: 0, smash: 0, swap: 0, third: 0 } }), "left");
  eq(p.flushes.length, 1); eq(tot(p.state), 1, "an honest flush pays");
});
t("R2 property: a power-up followed by any swipe never raises the total stock (random games)", () => {
  let checked = 0;
  for (let seed = 1; seed <= 80; seed++) {
    let s = T.newGame(seed), x = seed;
    s.power = { undo: 2, smash: 3, swap: 3, third: 3 };
    for (let i = 0; i < 300 && !s.over; i++) {
      x = (x * 1103515245 + 12345) >>> 0;
      if (x % 5 === 0) {
        const name = T.POWERS[1 + (x >>> 3) % 3], a = (x >>> 5) % 16, b = a % 4 < 3 ? a + 1 : a + 4;
        const before = tot(s), u = T.use(s, name, a, b);
        if (u.ok) {
          ok(tot(u.state) === before - 1, "use pays nothing, seed " + seed);
          T.DIRS.forEach(d => { const r = T.move(u.state, d); if (r.moved) { ok(tot(r.state) < before, "swipe after " + name + ", seed " + seed); checked++; } });
          s = u.state; continue;
        }
      }
      const r = T.move(s, T.DIRS[(x >>> 7) % 4]); if (r.moved) s = r.state;
      else if (!T.canMove(s)) break;
    }
  }
  ok(checked > 200, "exercised " + checked);
});
t("R1: Undo never crosses a finished run", () => {
  const s = at([0, 3, 12, 3, 12, 3, 12, 3, 3, 12, 3, 12, 12, 3, 12, 3], { power: { undo: 0, smash: 0, swap: 0, third: 0 }, next: 12 });
  const m = T.move(s, "left"); ok(m.state.over);
  const forced = Object.assign({}, m.state, { power: { undo: 1, smash: 0, swap: 0, third: 0 } });
  ok(!T.use(forced, "undo").ok, "an over state refuses Undo even with stock and history");
});
t("stock caps at 9: a full stock is skipped, a fully stocked tray earns nothing", () => {
  const g = E16(); g[0] = 3; g[4] = 6; g[9] = 9;
  const r = T.move(at(g, { power: { undo: 9, smash: 9, swap: 9, third: 8 } }), "left"); eq(r.state.power.third, 9); eq(r.flushes[0].power, "third");
  const f = T.move(at(g, { power: { undo: 9, smash: 9, swap: 9, third: 9 } }), "left"); eq(f.flushes[0].power, null);
  ok(T.POWERS.every(p => f.state.power[p] === 9));
});
t("the run ends only when locked AND no power-up can act", () => {
  const none = { undo: 0, smash: 0, swap: 0, third: 0 };
  const lockedAfterLeft = [0, 3, 12, 3, 12, 3, 12, 3, 3, 12, 3, 12, 12, 3, 12, 3]; // the dealt 12 completes a 3/12 checkerboard
  const m = T.move(at(lockedAfterLeft, { power: none, next: 12 }), "left");
  ok(m.moved); ok(!T.canMove(m.state)); ok(m.state.over, "locked with an empty tray");
  const m2 = T.move(at(lockedAfterLeft, { power: Object.assign({}, none, { smash: 1 }), next: 12 }), "left");
  ok(!m2.state.over, "a Smash keeps the run alive"); ok(!T.canMove(m2.state));
  const m3 = T.move(at(lockedAfterLeft, { power: Object.assign({}, none, { third: 1 }), next: 12 }), "left");
  ok(m3.state.over, "Third with no 1 or 2 on the board cannot act");
  ok(T.move(m.state, "right").state === m.state, "an over game ignores swipes");
  ok(!T.use(m.state, "undo").ok, "no undo stock");
});
t("Undo revives a run that just ended, when a charge is left", () => {
  const one = at([0, 3, 12, 3, 12, 3, 12, 3, 3, 12, 3, 12, 12, 3, 12, 3], { power: { undo: 1, smash: 0, swap: 0, third: 0 }, next: 12 });
  const m = T.move(one, "left"); ok(!m.state.over, "Undo with history is a usable power-up");
  const u = T.use(m.state, "undo"); ok(u.ok); ok(!u.state.over);
});

t("rainbow scale: k = value/3 picks the band, each octave up adds a ring", () => {
  eq(T.colour(3), { band: 0, name: "red", octave: 0 }); eq(T.colour(6).name, "orange"); eq(T.colour(9).name, "yellow");
  eq(T.colour(12).name, "green"); eq(T.colour(15).name, "blue"); eq(T.colour(18).name, "indigo"); eq(T.colour(21).name, "violet");
  eq(T.colour(24), { band: 0, name: "red", octave: 1 }); eq(T.colour(27).name, "orange"); eq(T.colour(45).octave, 2);
  eq(T.colour(1).name, "grey"); eq(T.colour(2).band, -1);
});
t("tuned: a deliberate bot sees a flush about every 15-30 swipes (shipped variant)", () => {
  // the same greedy bot as the TUNING table, 150 games (the table used 10,000)
  let moves = 0, flushes = 0;
  const ev = (s, r) => { let e = 0, p = 0; const g = s.grid; for (let i = 0; i < 16; i++) { if (!g[i]) e++; if (i % 4 < 3 && T.canMerge(g[i], g[i + 1])) p++; if (i < 12 && T.canMerge(g[i], g[i + 4])) p++; } return r.gained + 6 * e + 40 * r.flushes.length + 2 * p; };
  for (let seed = 1000; seed < 1150; seed++) {
    let s = T.newGame(seed);
    while (!s.over && s.moves < 3000) {
      let best = null, bv = -Infinity;
      T.DIRS.forEach(d => { const r = T.move(s, d); if (r.moved) { const v = ev(r.state, r); if (v > bv) { bv = v; best = r; } } });
      if (best) { flushes += best.flushes.length; s = best.state; continue; }
      const c = s.grid.findIndex(Boolean); if (T.usable(s, "smash")) s = T.use(s, "smash", s.grid.indexOf(Math.min(...s.grid.filter(Boolean)))).state;
      else if (T.usable(s, "third")) s = T.use(s, "third", s.grid.findIndex(v => v === 1 || v === 2)).state; else break;
      if (c < 0) break;
    }
    moves += s.moves;
  }
  const mpf = moves / flushes, mean = moves / 150;
  ok(mpf >= 15 && mpf <= 35, "moves per flush " + mpf.toFixed(1)); ok(mean >= 150, "mean run " + mean.toFixed(0));
});

require("./conventions")(t, ok, ["three/engine.js", "three/game.js", "three/index.html", "three/style.css"]);
console.log(pass + " passed, " + fail + " failed"); process.exit(fail ? 1 : 0);
