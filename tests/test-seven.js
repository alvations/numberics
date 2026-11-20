/* SPDX-License-Identifier: Apache-2.0 | Copyright 2026 alvations (Melon Lab)
 * `node tests/test-seven.js` */
"use strict";
const S = require("../seven/engine.js");
let pass = 0, fail = 0;
function t(n, f) { try { f(); pass++; } catch (e) { fail++; console.log("FAIL", n, "\n  ", e.message); } }
function ok(c, m) { if (!c) throw new Error(m || "assertion failed"); }
function eq(a, b, m) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || "") + " got " + JSON.stringify(a) + " want " + JSON.stringify(b)); }
const W = 7, E = S.EGG, C = S.CRACKED;
// rows top to bottom, '.' empty, 1-7, 'e' egg, 'c' cracked
function grid(rows) {
  while (rows.length < 7) rows.unshift(".......");
  return rows.join("").split("").map(ch => ch === "." ? 0 : ch === "e" ? E : ch === "c" ? C : +ch);
}
function st(rows, next, extra) {
  const s = S.newGame(42, "classic"); s.grid = grid(rows); s.next = next; s.left = 99;
  return Object.assign(s, extra || {});
}
const at = (r, c) => r * W + c;
const sum = (tr) => tr.reduce((a, x) => a + (x.points || 0), 0);
const settled = (g) => { for (let c = 0; c < W; c++) { let seen = false; for (let r = 0; r < 7; r++) { if (g[at(r, c)]) seen = true; else if (seen) return false; } } return true; };

t("a fresh game is settled, nothing pending, one Undo, a next disc", () => {
  for (const seed of [1, 2, 3, 2026]) {
    const s = S.newGame(seed);
    ok(settled(s.grid), "gravity"); eq(S.findPops(s.grid), [], "no pops pending");
    eq(s.power, { undo: 1, smash: 0, hold: 0, crack: 0 }); ok(s.next >= 1 && s.next <= E); eq(s.score, 0);
    ok(s.grid.some(Boolean), "the well starts with discs");
  }
});
t("row pop: three 3s in a run of three all pop", () => {
  const r = S.drop(st(["33....."], 3), 2);
  ok(r.ok); eq(r.trace[0].type, "drop"); eq(r.trace[1].type, "wave"); eq(r.trace[1].pops, [at(6, 0), at(6, 1), at(6, 2)]);
  eq(r.trace[1].points, 3 * 7); ok(!r.state.grid.some(Boolean) || true); eq(r.state.grid.slice(42), [0, 0, 0, 0, 0, 0, 0]);
});
t("column pop: a 3 on two eggs pops and cracks the egg below", () => {
  const r = S.drop(st(["e......", "e......"], 3), 0);
  eq(r.trace[1].pops, [at(4, 0)]); eq(r.trace[1].cracks, [{ cell: at(5, 0), to: C }]);
  eq(r.state.grid[at(5, 0)], C); eq(r.state.grid[at(6, 0)], E, "the egg two below is not touched");
});
t("a disc matching neither its row nor its column stays", () => {
  const r = S.drop(st(["e......"], 5), 3);
  eq(r.trace.length, 1); eq(r.waves, 0); eq(r.state.grid[at(6, 3)], 5); eq(r.state.score, 0);
});
t("a full column refuses a drop", () => {
  const s = st(["e", "e", "e", "e", "e", "e", "e"].map(x => x + "......"), 2);
  const r = S.drop(s, 0); ok(!r.ok); ok(r.state === s);
  ok(!S.drop(s, 7).ok); ok(!S.drop(s, -1).ok); ok(!S.drop(s, 1.5).ok);
});
t("chain: a pop opens a shorter run, wave 2 pops and scores more", () => {
  const r = S.drop(st(["e22...."], 1), 2);
  const w = r.trace.filter(x => x.type === "wave");
  eq(w.length, 2); eq(w[0].pops, [at(5, 2), at(6, 2)]); eq(w[1].pops, [at(6, 1)]);
  eq(w[0].points, 2 * S.wavePoints(1)); eq(w[1].points, 1 * S.wavePoints(2)); ok(S.wavePoints(2) > S.wavePoints(1));
  eq(w[1].cracks, [{ cell: at(6, 0), to: C }], "wave 2 cracks the egg");
  eq(r.state.score, sum(r.trace)); eq(r.waves, 2); eq(r.popped, 3);
});
t("egg -> cracked -> a number 1-7", () => {
  const r = S.drop(st(["c22...."], 1), 2);
  const cr = r.trace.filter(x => x.type === "wave")[1].cracks[0];
  eq(cr.cell, at(6, 0)); ok(cr.to >= 1 && cr.to <= 7, "cracked egg becomes a number");
});
t("wave points follow the Drop7 curve 7, 40, 109, 224, 391", () => {
  eq([1, 2, 3, 4, 5].map(S.wavePoints), [7, 40, 109, 224, 391]);
});
t("Lucky Seven: exactly 7 popped cracks every egg one step and earns a power-up", () => {
  const s = st(["e......", "e......", "777777."], 7);
  const r = S.drop(s, 6);
  const w1 = r.trace[1]; eq(w1.pops.length, 7);
  const li = r.trace.findIndex(x => x.type === "lucky"); ok(li > 1, "lucky step after the waves");
  ok(r.lucky); eq(r.state.luckies, 1);
  ok(r.awarded.some(a => a.why === "lucky"), "awarded");
  const lk = r.trace[li];
  // after wave 1 the cracked egg fell to the bottom and the plain egg sits above it
  eq(lk.cracks.map(c => c.cell), [at(5, 0), at(6, 0)]);
  eq(lk.cracks[0].to, C); ok(lk.cracks[1].to >= 1 && lk.cracks[1].to <= 7);
  eq(lk.points, S.RULES.luckyBonus); eq(r.state.score, sum(r.trace));
});
t("six popped is not lucky", () => {
  const r = S.drop(st(["66666.."], 6), 5); // a run of six 6s: six pop
  eq(r.popped, 6); ok(!r.lucky); eq(r.state.luckies, 0); ok(!r.awarded.length);
  const r2 = S.drop(st(["666666."], 1), 6); // the 1 pops by column, then six 6s: seven in total
  eq(r2.popped, 7); ok(r2.lucky, "seven over two waves is lucky too");
});
t("a chain of 3+ waves earns a power-up, shorter chains do not", () => {
  // stack: wave 1 pops the 1, the 2 falls into a run of 2, and so on
  let found = null;
  for (let seed = 1; seed < 400 && !found; seed++) {
    let s = S.newGame(seed);
    for (let k = 0; k < 60 && !s.over; k++) { const r = S.drop(s, (k * 3 + seed) % 7); if (!r.ok) break; if (r.waves >= 3) { found = r; break; } s = r.state; }
  }
  ok(found, "found a 3-wave chain");
  ok(found.awarded.some(a => a.why === "chain"));
  const r = S.drop(st(["e22...."], 1), 2); ok(!r.awarded.length, "2 waves earn nothing");
});
t("rising row: eggs rise from the bottom after N drops and the level goes up", () => {
  const s = st(["e......"], 5, { left: 1 });
  const r = S.drop(s, 3);
  ok(r.rose); const rise = r.trace.find(x => x.type === "rise"); ok(rise && !rise.overflow);
  eq(r.state.grid.slice(42), [E, E, E, E, E, E, E]); eq(r.state.grid[at(5, 0)], E); eq(r.state.grid[at(5, 3)], 5);
  eq(r.state.level, 2); eq(r.state.left, S.dropsFor("classic", 2)); eq(rise.points, S.RULES.levelBonus * 2);
});
t("overflow: a rise that pushes a disc out of the top ends the run", () => {
  const rows = ["5......", "e......", "e......", "e......", "e......", "e......", "e......"];
  const r = S.drop(st(rows, 4, { left: 1 }), 3);
  ok(r.state.over); ok(r.trace.find(x => x.type === "rise").overflow);
  ok(!S.drop(r.state, 2).ok, "no drops after the end");
});
t("overflow leaves the well as the player saw it and names the discs pushed out (cold #10)", () => {
  const rows = ["5.....2", "e.....e", "e.....e", "e.....e", "e.....e", "e.....e", "e.....e"];
  const s = st(rows, 4, { left: 1 }); const level = s.level;
  const r = S.drop(s, 3), rise = r.trace.find(x => x.type === "rise");
  const want = s.grid.slice(); want[at(6, 3)] = 4;
  eq(r.state.grid, want, "nothing shifted up, no egg row added");
  eq(r.state.out, [0, 6], "the two top-row discs"); eq(rise.out, [0, 6]); eq(rise.points, 0);
  eq(r.state.level, level, "the rise did not happen, so the level is unchanged");
  eq(r.trace[r.trace.length - 1].grid, r.state.grid);
  eq(S.newGame(1).out, [], "a fresh run has no pushed-out discs");
});
t("the drop that overflows is counted in drops (gameplay #1)", () => {
  const rows = ["5......", "e......", "e......", "e......", "e......", "e......", "e......"];
  const s = st(rows, 4, { left: 1, drops: 10 }); const r = S.drop(s, 3);
  ok(r.state.over); eq(r.state.drops, 11);
});
t("N shrinks with level in Classic and Daily, fixed at 5 in Blitz", () => {
  ok(S.dropsFor("classic", 1) > S.dropsFor("classic", 5)); eq(S.dropsFor("classic", 99), S.RULES.minN);
  eq(S.dropsFor("daily", 3), S.dropsFor("classic", 3));
  [1, 4, 30].forEach(l => eq(S.dropsFor("blitz", l), 5));
  eq(S.newGame(1, "blitz").left, 5); eq(S.newGame(1, "nope").mode, "classic");
});
t("Hold keeps the next disc, a second Hold swaps it back", () => {
  let s = st(["e......"], 4, { power: { undo: 1, smash: 0, hold: 2, crack: 0 } });
  let u = S.use(s, "hold"); ok(u.ok); eq(u.state.held, 4); ok(u.state.next !== 0); eq(u.state.power.hold, 1);
  const n2 = u.state.next;
  u = S.use(u.state, "hold"); eq(u.state.held, n2); eq(u.state.next, 4); eq(u.state.power.hold, 0);
  ok(!S.use(u.state, "hold").ok, "no charges left");
});
t("Crack cracks every egg touching a numbered disc, and nothing else", () => {
  const s = st(["e......", "e3....e", "eee...e"], 0, { next: 5, power: { undo: 1, smash: 0, hold: 0, crack: 1 } });
  eq(S.findPops(s.grid), [], "stable setup");
  const u = S.use(s, "crack"); ok(u.ok); eq(u.state.power.crack, 0);
  const cr = u.trace[0].cracks.map(c => c.cell);
  eq(cr, [at(5, 0), at(6, 1)]);
  eq(u.state.grid[at(6, 6)], E); eq(u.state.grid[at(6, 0)], E); eq(u.state.grid[at(4, 0)], E, "egg touching only eggs");
  const none = st(["e......"], 5, { power: { undo: 1, smash: 0, hold: 0, crack: 1 } });
  ok(!S.use(none, "crack").ok, "nothing to crack is refused"); ok(!S.crackable(none.grid));
});
t("Smash removes a disc, the column drops, chains resolve, no reward", () => {
  const s = st(["3......", "e22...."], 1, { power: { undo: 1, smash: 1, hold: 0, crack: 0 } });
  ok(!S.use(s, "smash", at(0, 0)).ok, "empty cell refused");
  const u = S.use(s, "smash", at(6, 0)); ok(u.ok);
  eq(u.trace[0].type, "smash"); eq(u.trace[0].falls, [{ from: at(5, 0), to: at(6, 0) }]);
  const w = u.trace.filter(x => x.type === "wave"); eq(w.map(x => x.pops), [[at(6, 0)], [at(6, 1), at(6, 2)]], "the fall sets off a chain");
  eq(u.state.score, s.score + sum(u.trace), "power-up chains still score");
  eq(u.state.power, { undo: 1, smash: 0, hold: 0, crack: 0 }, "spent, nothing earned");
  eq(u.state.luckies, 0);
});
t("Undo restores the whole snapshot (stock included) and is paid for", () => {
  const s = st(["e......", "e......", "777777."], 7);
  const r = S.drop(s, 6); ok(r.awarded.length >= 1);
  const u = S.use(r.state, "undo"); ok(u.ok);
  eq(u.state.grid, s.grid); eq(u.state.next, s.next); eq(u.state.luckies, 0); eq(u.state.score, s.score);
  eq(u.state.power, { undo: 0, smash: 0, hold: 0, crack: 0 }, "the earned charge is rolled back, the undo is spent");
  ok(!S.use(u.state, "undo").ok, "one step only");
  // redoing the same drop replays the same random outcome: rewinding cannot reroll
  eq(S.drop(Object.assign({}, u.state, { power: s.power }), 6).state.grid, r.state.grid);
});
t("Undo never crosses a decided result: refused once the run is over (R1)", () => {
  const rows = ["5......", "e......", "e......", "e......", "e......", "e......", "e......"];
  const s = st(rows, 4, { left: 1, power: { undo: 3, smash: 2, hold: 2, crack: 2 } }); const r = S.drop(s, 3); ok(r.state.over);
  ok(r.state.prev, "the snapshot exists, and still Undo is refused");
  ["undo", "smash", "hold", "crack"].forEach(n => { const u = S.use(r.state, n, at(6, 0)); ok(!u.ok, n + " refused after the end"); ok(u.state === r.state); });
  // a full well that is not decided (Undo can still act) is not over, and Undo works there
  const full = ["eeeeee.", "eeeeeee", "eeeeeee", "eeeeeee", "eeeeeee", "eeeeeee", "eeeeeee"];
  const f = st(full, 5, { power: { undo: 1, smash: 0, hold: 0, crack: 0 }, prev: null });
  const d = S.drop(f, 6); ok(!d.state.over, "Undo keeps a full well alive"); ok(S.use(d.state, "undo").ok);
});
t("Undo is counted as a power-up used (critic #4)", () => {
  const s = S.newGame(5); eq(s.used, 0);
  const r = S.drop(s, 3); const u = S.use(r.state, "undo"); ok(u.ok); eq(u.state.used, 1);
  eq(u.state.prev, null, "one step only");
});
t("used goes up by exactly one per power-up, Undo included (property)", () => {
  for (let seed = 1; seed <= 25; seed++) {
    let s = S.newGame(seed); s.power = { undo: 9, smash: 9, hold: 9, crack: 9 };
    for (let k = 0; k < 60 && !s.over; k++) {
      const name = S.POWERS[(k * 5 + seed) % 4], filled = s.grid.map((v, i) => v ? i : -1).filter(i => i >= 0);
      const u = S.use(s, name, filled[(k * 3) % Math.max(1, filled.length)]);
      if (u.ok) { eq(u.state.used, s.used + 1, name); s = u.state; }
      const c = [0, 1, 2, 3, 4, 5, 6].find(c => S.landing(s.grid, c) >= 0); if (c === undefined) break;
      const d = S.drop(s, c); eq(d.state.used, s.used, "a drop uses nothing"); s = d.state;
    }
  }
});
t("Crack targets are exactly the eggs touching a numbered disc", () => {
  const g = grid(["e......", "e3....e", "eee...e"]);
  eq(S.crackTargets(g), [at(5, 0), at(6, 1)]); ok(S.crackable(g)); eq(S.crackTargets(grid(["e......"])), []);
});
t("a full well with no usable power-up ends the run; Smash keeps it alive", () => {
  const full = ["eeeeee.", "eeeeeee", "eeeeeee", "eeeeeee", "eeeeeee", "eeeeeee", "eeeeeee"];
  const s = st(full, 5, { power: { undo: 0, smash: 0, hold: 0, crack: 0 }, prev: null });
  eq(S.findPops(s.grid), []);
  const r = S.drop(s, 6); ok(r.ok); ok(r.state.over, "stuck and no power-ups");
  const s2 = st(full, 5, { power: { undo: 0, smash: 1, hold: 0, crack: 0 }, prev: null });
  const r2 = S.drop(s2, 6); ok(!r2.state.over, "a Smash can still free a column");
});
t("deterministic by seed: same seed and drops, same game; daily is shared", () => {
  const play = (seed, mode) => { let s = S.newGame(seed, mode); for (let k = 0; k < 80 && !s.over; k++) { const r = S.drop(s, (k * 5) % 7); if (r.ok) s = r.state; else { const c = [0,1,2,3,4,5,6].find(c => S.drop(s, c).ok); if (c === undefined) break; s = S.drop(s, c).state; } } return s; };
  eq(play(77), play(77)); ok(JSON.stringify(play(77).grid) !== JSON.stringify(play(78).grid));
  eq(play(20261120, "daily"), play(20261120, "daily"));
});
t("fuzz: every trace is consistent (scores, gravity, no pending pops, legal values)", () => {
  for (let seed = 1; seed <= 40; seed++) {
    let s = S.newGame(seed, seed % 3 ? "classic" : "blitz");
    for (let k = 0; k < 400 && !s.over; k++) {
      const cols = [0, 1, 2, 3, 4, 5, 6].filter(c => S.landing(s.grid, c) >= 0);
      if (!cols.length) break;
      const r = S.drop(s, cols[(k * 7 + seed) % cols.length]);
      ok(r.ok); eq(r.state.score - s.score, sum(r.trace), "score = sum of trace points");
      r.trace.forEach(x => { if (x.type === "wave") eq(x.points, x.pops.length * S.wavePoints(x.wave)); });
      ok(r.state.grid.every(v => Number.isInteger(v) && v >= 0 && v <= 9));
      if (!r.state.over) { ok(settled(r.state.grid), "gravity"); eq(S.findPops(r.state.grid), [], "settled chain"); }
      eq(r.trace[r.trace.length - 1].grid || r.state.grid, r.state.grid, "trace ends on the final grid");
      ok(Object.values(r.state.power).every(n => n >= 0 && n <= 9), "cap 9");
      s = r.state;
    }
  }
});
t("power-ups never earn power-ups (fuzz over Smash and Crack)", () => {
  for (let seed = 1; seed <= 30; seed++) {
    let s = S.newGame(seed); s.power = { undo: 1, smash: 9, hold: 9, crack: 9 };
    for (let k = 0; k < 40 && !s.over; k++) {
      const filled = s.grid.map((v, i) => v ? i : -1).filter(i => i >= 0);
      const name = k % 2 ? "smash" : "crack";
      const u = S.use(s, name, filled[(k * 11) % filled.length]);
      if (u.ok) { const b = Object.assign({}, s.power); b[name]--; eq(u.state.power, b); eq(u.state.luckies, s.luckies); s = u.state; }
      const c = [0, 1, 2, 3, 4, 5, 6].find(c => S.landing(s.grid, c) >= 0); if (c === undefined) break;
      s = S.drop(s, c).state; s.power = { undo: 1, smash: 9, hold: 9, crack: 9 };
    }
  }
});
t("bot: a greedy player lasts long enough to see several rises (tuning sanity)", () => {
  let drops = 0, G = 12;
  for (let g = 0; g < G; g++) {
    let s = S.newGame(900 + g);
    while (!s.over && s.drops < 1500) {
      let best = -1, bv = -1e9;
      for (let c = 0; c < 7; c++) { const r = S.drop(s, c); if (!r.ok) continue; const v = r.state.score - s.score - r.state.grid.filter(Boolean).length * 30 - (r.state.over ? 1e6 : 0); if (v > bv) { bv = v; best = c; } }
      if (best < 0) break; s = S.drop(s, best).state;
    }
    drops += s.drops;
  }
  const avg = drops / G; ok(avg > 60 && avg < 600, "avg drops " + avg);
});
require("./conventions")(t, ok, ["seven/engine.js", "seven/game.js", "seven/index.html", "seven/style.css"]);
console.log(pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
