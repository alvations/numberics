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
t("overflow with no Undo: a rise that pushes a disc out of the top ends the run", () => {
  const rows = ["5......", "e......", "e......", "e......", "e......", "e......", "e......"];
  const r = S.drop(st(rows, 4, { left: 1, power: { undo: 0, smash: 0, hold: 0, crack: 0 } }), 3);
  ok(r.state.over); ok(r.trace.find(x => x.type === "rise").overflow);
  ok(!S.drop(r.state, 2).ok, "no drops after the end");
});
t("overflow leaves the well as the player saw it and names the discs pushed out (cold #10)", () => {
  const rows = ["5.....2", "e.....e", "e.....e", "e.....e", "e.....e", "e.....e", "e.....e"];
  const s = st(rows, 4, { left: 1, power: { undo: 0, smash: 0, hold: 0, crack: 0 } }); const level = s.level;
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
  const s = st(rows, 4, { left: 1, drops: 10, power: { undo: 0, smash: 0, hold: 0, crack: 0 } }); const r = S.drop(s, 3);
  ok(r.state.over); eq(r.state.drops, 11);
});
t("stuck is not over while Undo is in stock (TRIAGE3): an overflow with Undo is on the brink, not ended", () => {
  const rows = ["5.....2", "e.....e", "e.....e", "e.....e", "e.....e", "e.....e", "e.....e"];
  const s = st(rows, 4, { left: 1, score: 500, power: { undo: 2, smash: 1, hold: 1, crack: 1 } });
  const r = S.drop(s, 3), rise = r.trace.find(x => x.type === "rise");
  ok(!r.state.over, "not over: an Undo can still save the run"); eq(r.state.overflow, [0, 6], "names the columns");
  ok(rise.overflow && rise.pending, "the trace says the overflow is pending"); eq(rise.out, [0, 6]);
  eq(r.state.out, [], "nothing is pushed out yet");
  // on the brink nothing but Undo can act, and no disc drops
  ok(!S.drop(r.state, 2).ok, "no drop on the brink");
  ["smash", "hold", "crack"].forEach(n => ok(!S.use(r.state, n, at(6, 0)).ok, n + " refused on the brink"));
  // Undo the last drop: back to the well before it, one Undo spent, the run goes on
  const u = S.use(r.state, "undo"); ok(u.ok); eq(u.state.grid, s.grid); eq(u.state.power.undo, 1); ok(!u.state.overflow && !u.state.over);
  ok(S.drop(u.state, 2).ok, "play goes on after the Undo");
  // or end the run: over, the discs pushed out named, and then R1 holds (nothing at all can act)
  const e = S.end(r.state); ok(e.ok); ok(e.state.over); eq(e.state.out, [0, 6]); eq(e.state.overflow, null);
  eq(e.state.score, r.state.score, "ending keeps the score");
  ["undo", "smash", "hold", "crack"].forEach(n => ok(!S.use(e.state, n, at(6, 0)).ok, n + " refused once ended (R1)"));
  ok(!S.end(e.state).ok, "end only from the brink"); ok(!S.end(s).ok, "and never from a live run");
  // with no Undo left the same overflow ends the run at once
  const z = S.drop(st(rows, 4, { left: 1, power: { undo: 0, smash: 1, hold: 1, crack: 1 } }), 3);
  ok(z.state.over && !z.state.overflow); ok(!z.trace.find(x => x.type === "rise").pending);
});
t("the brink survives an Undo chain honestly: after the Undo the snapshot is gone, so a second overflow ends", () => {
  const rows = ["5......", "e......", "e......", "e......", "e......", "e......", "e......"];
  const r = S.drop(st(rows, 4, { left: 1, power: { undo: 1, smash: 0, hold: 0, crack: 0 } }), 3); ok(r.state.overflow);
  const u = S.use(r.state, "undo"); ok(u.ok); eq(u.state.power.undo, 0); eq(u.state.prev, null);
  const again = S.drop(u.state, 3); ok(again.state.over, "no Undo left: the same drop now ends the run");
});
t("Undo is not dealt once three are held (round 3 mechanics #2)", () => {
  const lucky = (undo, seed) => S.drop(st(["e......", "e......", "777777."], 7, { seed: seed, power: { undo: undo, smash: 0, hold: 0, crack: 0 } }), 6);
  let undos = 0;
  for (let seed = 1; seed <= 200; seed++) {
    const r = lucky(3, seed); ok(r.awarded.length >= 1);
    r.awarded.forEach(a => { ok(a.power !== "undo", "Undo dealt at 3, seed " + seed); });
    if (lucky(0, seed).awarded.some(a => a.power === "undo")) undos++;
  }
  ok(undos > 20, "below three, Undo is still dealt: " + undos);
  // with the other three at the cap, a reward at three Undos is reported as full (R15), not turned into a fourth Undo
  const f = S.drop(st(["e......", "e......", "777777."], 7, { power: { undo: 3, smash: 9, hold: 9, crack: 9 } }), 6);
  eq(f.awarded, []); ok(f.full.length >= 1); eq(f.state.power.undo, 3);
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
  const s = st(rows, 4, { left: 1, power: { undo: 3, smash: 2, hold: 2, crack: 2 } }); const b = S.drop(s, 3); ok(b.state.overflow);
  const r = { state: S.end(b.state).state }; ok(r.state.over, "the player ended the run");
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
      if (s.overflow) { s = (k % 2 ? S.use(s, "undo") : S.end(s)).state; continue; } // both ways off the brink
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
const tot = (s) => S.POWERS.reduce((a, n) => a + s.power[n], 0);
t("R2 blocker repro: Smash, then a drop, pays nothing (round-2 critic F1)", () => {
  let s = S.newGame(1, "classic"); s = S.drop(s, 0).state; s = S.drop(s, 1).state;
  s.power.smash = 1;
  const plain = S.drop(s, 5); eq(plain.awarded, [], "the plain drop pays nothing");
  const u = S.use(s, "smash", 45); ok(u.ok); ok(u.state.free, "the next drop is marked as power-up assisted");
  const r = S.drop(u.state, 5); ok(r.ok);
  eq(r.awarded, [], "no power-up after a Smash");
  ok(r.unpaid.length >= 1, "the chain the Smash set up would have paid: " + JSON.stringify(r.unpaid));
  eq(tot(r.state), tot(s) - 1, "stock = before minus the Smash");
  ok(!r.state.free, "only the one drop is unpaid");
  ok(r.state.score > u.state.score, "the chain still scores");
});
t("R2: the drop right after Hold or Crack pays no power-up, the drop after that pays again", () => {
  const lucky = (extra) => st(["e......", "e......", "777777."], 7, extra);
  const plain = S.drop(lucky(), 6); ok(plain.awarded.some(a => a.why === "lucky"), "the control pays");
  for (const name of ["hold", "crack", "smash"]) {
    const s = lucky({ free: true }); const r = S.drop(s, 6);
    ok(r.lucky, name + ": Lucky Seven still happens and scores"); eq(r.awarded, [], name); ok(r.unpaid.includes("lucky"));
    eq(r.state.score, plain.state.score, "same score as the paid drop");
    ok(!r.state.free); ok(S.drop(lucky({ free: false }), 6).awarded.length >= 1, "a natural drop pays again");
  }
  // Hold and Crack set the flag; Undo of the power-up restores the pre-power-up flag
  const h = S.use(st(["e......"], 4, { power: { undo: 1, smash: 0, hold: 1, crack: 0 } }), "hold"); ok(h.state.free, "hold");
  const c = S.use(st(["e3....."], 5, { power: { undo: 1, smash: 0, hold: 0, crack: 1 } }), "crack"); ok(c.ok && c.state.free, "crack");
  const sm = S.use(st(["e3....."], 5, { power: { undo: 1, smash: 1, hold: 0, crack: 0 } }), "smash", at(6, 1)); ok(sm.state.free);
  const un = S.use(sm.state, "undo"); ok(un.ok); ok(!un.state.free, "Undo rewinds the flag with the board");
  ok(!S.newGame(3).free, "a fresh run starts paid");
});
t("R2 property: a power-up followed by any drop never raises the total stock (random games)", () => {
  let checked = 0, blocked = 0;
  for (let seed = 1; seed <= 60; seed++) {
    let s = S.newGame(seed, seed % 4 ? "classic" : "blitz"), x = seed;
    s.power = { undo: 2, smash: 4, hold: 4, crack: 4 };
    for (let i = 0; i < 200 && !s.over; i++) {
      x = (x * 1103515245 + 12345) >>> 0;
      if (x % 3 === 0) {
        const name = S.POWERS[1 + (x >>> 3) % 3], filled = s.grid.map((v, k) => v ? k : -1).filter(k => k >= 0);
        const before = tot(s), u = S.use(s, name, filled[(x >>> 5) % Math.max(1, filled.length)]);
        if (u.ok) {
          ok(tot(u.state) === before - 1, "use pays nothing, seed " + seed);
          for (let c = 0; c < 7; c++) {
            const r = S.drop(u.state, c); if (!r.ok) continue;
            ok(tot(r.state) < before, name + " then drop " + c + " raised the stock, seed " + seed); checked++;
            if (r.unpaid.length) blocked++;
          }
          s = u.state; continue;
        }
      }
      const cols = [0, 1, 2, 3, 4, 5, 6].filter(c => S.landing(s.grid, c) >= 0); if (!cols.length) break;
      s = S.drop(s, cols[(x >>> 7) % cols.length]).state;
      if (tot(s) < 4) s.power = { undo: 2, smash: 4, hold: 4, crack: 4 };
    }
  }
  ok(checked > 1000, "exercised " + checked); ok(blocked > 20, "rewards actually blocked " + blocked);
});
t("R15: with every slot at the cap a reward is skipped and reported, never silently lost", () => {
  const full = { undo: 9, smash: 9, hold: 9, crack: 9 };
  const r = S.drop(st(["e......", "e......", "777777."], 7, { power: Object.assign({}, full) }), 6);
  ok(r.lucky); eq(r.awarded, []); ok(r.full.includes("lucky"), "reported as full"); eq(r.state.power, full);
  const one = S.drop(st(["e......", "e......", "777777."], 7, { power: { undo: 9, smash: 9, hold: 3, crack: 9 } }), 6);
  eq(one.awarded.map(a => a.power), ["hold"], "goes to the one slot under the cap"); eq(one.full, []);
});
t("danger: columns at the top and one disc from the top (the near-full warning)", () => {
  eq(S.danger(grid(["e......"])), { top: [], near: [] });
  const g = grid(["..3...5", "e.e..ee", "e.e..ee", "e.e..ee", "e.e..ee", "e.e..ee", "e.e..ee"]);
  eq(S.danger(g), { top: [2, 6], near: [0, 5] });
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
// ---- the client's redesign wiring (REDESIGN.md 5.5, 7.3, 8.4, 3.5): static checks on seven/game.js ----
const fs = require("fs"), path = require("path");
const G = fs.readFileSync(path.join(__dirname, "..", "seven", "game.js"), "utf8");
t("client: discs live on NumbericsMotion's keyed layer, never rebuilt per drop", () => {
  ok(/M\.layer\(discsEl/.test(G), "no keyed layer");
  ok(!/discsEl\.textContent\s*=\s*""/.test(G), "the well is emptied and redrawn");
  ok(!/K\.reducedMotion\(\)/.test(G) && /M\.reduced\(\)/.test(G), "reduced motion must be read at each drop, from NumbericsMotion");
  ok(/fallMs\(st\.row \+ 1\)/.test(G), "the dropped disc falls from one slot above the top row");
});
t("client: sounds are ones NumbericsAudio has, called through the timeline helper", () => {
  const A = require("../shared/audio.js"), used = [...G.matchAll(/sfx\("(\w+)"/g)].map(m => m[1]);
  ok(used.length >= 8, "too few sounds: " + used);
  used.forEach(n => ok(A.NAMES.includes(n), "unknown sound " + n));
  ["land", "pop", "slide", "power", "bad", "tick"].forEach(n => ok(used.includes(n), "missing sound " + n));
});
t("client: trophy events are exactly Seven's three (8.4)", () => {
  const evs = [...new Set([...G.matchAll(/trophy\("(\w+)"/g)].map(m => m[1]))].sort();
  eq(evs, ["drop", "end", "level"]);
  ok(/var daily = mode === "daily" && current\(\)/.test(G) && /daily: daily/.test(G), "end.daily must be a real boolean, and false for a Daily begun yesterday");
  ok(/PG\.put\("seven"/.test(G) && /PG\.daily\("seven"/.test(G), "progress put and the Daily record");
  ok(/U\.howto\("seven", \{ title: "Seven", steps: STEPS, saved: !!loaded/.test(G), "the shared how-to (D8)");
});
t("trophies: the client's event shapes unlock each Seven trophy on its boundary", () => {
  const TR = require("../shared/trophies.js");
  const drop = (d) => TR.report("seven", "drop", Object.assign({ waves: 1, popped: [1], sevens: 0, left: 5 }, d), { quiet: true });
  drop({ waves: 2 }); // the first event may earn a family trophy (first game, the hour of day): not Seven's
  ok(!TR.has("sev_three") && drop({ waves: 3 }).includes("sev_three"), "three waves");
  ok(!drop({ waves: 4 }).includes("sev_five") && drop({ waves: 5 }).includes("sev_five"), "five waves");
  ok(!drop({ sevens: 2, popped: [7, 7] }).includes("sev_sevens") && drop({ sevens: 3, popped: [7, 7, 7] }).includes("sev_sevens"), "three sevens");
  ok(!drop({ left: 1 }).includes("sev_clear") && drop({ left: 0 }).includes("sev_clear"), "an empty well");
  ok(!TR.report("seven", "level", { level: 5, mode: "blitz" }, { quiet: true }).includes("sev_level"), "level 5 counts in Classic only");
  ok(TR.report("seven", "level", { level: 5, mode: "classic" }, { quiet: true }).includes("sev_level"), "level 5 in Classic");
  const end = (d) => TR.report("seven", "end", Object.assign({ mode: "classic", score: 0, daily: false }, d), { quiet: true });
  ok(!end({ score: 6999 }).includes("sev_score") && end({ score: 7000 }).includes("sev_score"), "seven thousand");
  ok(!end({ mode: "blitz", score: 1999 }).includes("sev_blitz") && end({ mode: "blitz", score: 2000 }).includes("sev_blitz"), "blitz 2,000");
  ok(!end({ mode: "classic" }).includes("sev_daily") && end({ mode: "daily", daily: true, score: 10 }).includes("sev_daily"), "a Daily finished");
});
require("./conventions")(t, ok, ["seven/engine.js", "seven/game.js", "seven/index.html", "seven/style.css"]);
console.log(pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
