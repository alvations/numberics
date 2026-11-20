/* SPDX-License-Identifier: Apache-2.0 | Copyright 2026 alvations (Melon Lab)
 * Three tuning simulation: node tools/sim-three.js [games=10000] [bot=human|greedy|seeker|random] [variants=L,H,...]
 * Reproduces the variant table at the top of three/engine.js.
 * Bots (all use Smash, Swap or Third only when stuck, never Undo):
 *   human  = a sensible player, one move ahead: 10 per merge + 5 per empty cell + 30 per flush, plus a little noise.
 *            It does not chase points; it merges what it can and keeps space. This is the bot the rules are tuned on.
 *   greedy = score gained + 6 per empty cell + 40 per flush + 2 per mergeable pair (the round-1 bot).
 *   seeker = greedy with 120 per flush and +8 per adjacent consecutive-multiple pair.
 *   random = any legal swipe. */
"use strict";
const T = require("../three/engine.js");
const N = +process.argv[2] || 10000, CAPM = 3000, botKind = process.argv[3] || "human";
const OLD = { stepMax: Infinity, flushTo: "sum" }; // the round-1 rules: any neighbouring multiples merge, a flush leaves its sum
const VARIANTS = {
  A: Object.assign({}, OLD, { step: false, bag: "b123" }),
  B: Object.assign({}, OLD, { bag: "b123" }),
  H: Object.assign({}, OLD, { bag: "b33" }),               // shipped in round 1
  K: Object.assign({}, OLD, { bag: "b3x" }),
  M: { stepMax: 6, flushTo: "sum", bag: "b33" },          // step merge only 3+6, a flush still leaves its sum
  N: { stepMax: Infinity, flushTo: "clear", bag: "b33" }, // any step merge, a flush clears
  O: { stepMax: 9, flushTo: "clear", bag: "b33" },
  P: { stepMax: 6, flushTo: "clear", bag: "b33" },
  Q: { stepMax: 6, flushTo: "clear", bag: "b123" },
  L: { stepMax: 6, flushTo: "clear", bag: "b12" },          // shipped in round 2
};
const only = process.argv[4] ? process.argv[4].split(",") : Object.keys(VARIANTS);
let rs = 12345; const rnd = () => { const r = T.rand(rs); rs = r[1]; return r[0]; };
function evalS(E, s, r) {
  const g = s.grid; let e = 0;
  for (let i = 0; i < 16; i++) if (!g[i]) e++;
  if (botKind === "human") return 10 * r.trace.filter(t => t.merge).length + 5 * e + 30 * r.flushes.length + 8 * rnd();
  let pairs = 0, near = 0;
  for (let i = 0; i < 16; i++) { if (i % 4 < 3 && E.canMerge(g[i], g[i + 1])) pairs++; if (i < 12 && E.canMerge(g[i], g[i + 4])) pairs++; }
  if (botKind === "seeker") for (let i = 0; i < 16; i++) { const a = g[i]; if (!E.isThree(a)) continue;
    if (i % 4 < 3 && E.isThree(g[i + 1]) && Math.abs(g[i + 1] - a) === 3) near++; if (i < 12 && E.isThree(g[i + 4]) && Math.abs(g[i + 4] - a) === 3) near++; }
  return r.gained + 6 * e + (botKind === "seeker" ? 120 : 40) * r.flushes.length + 2 * pairs + 8 * near + rnd();
}
function play(E, seed) {
  let s = E.newGame(seed), fl = 0, pw = 0;
  while (!s.over && s.moves < CAPM) {
    let best = null, bv = -1e9;
    for (const d of E.DIRS) { const r = E.move(s, d); if (!r.moved) continue; const v = botKind === "random" ? rnd() : evalS(E, r.state, r); if (v > bv) { bv = v; best = r; } }
    if (best) { fl += best.flushes.length; s = best.state; continue; }
    // stuck: try power-ups (not undo), pick the one whose best follow-up is best
    let opt = null, ov = -1e9;
    const tryU = (name, a, b) => { const u = E.use(s, name, a, b); if (!u.ok) return; for (const d of E.DIRS) { const r = E.move(u.state, d); if (r.moved) { const v = evalS(E, r.state, r) - (name === "smash" ? 5 : 0); if (v > ov) { ov = v; opt = u.state; } } } };
    for (let a = 0; a < 16; a++) { if (s.power.smash) tryU("smash", a); if (s.power.third) tryU("third", a); if (s.power.swap) { if (a % 4 < 3) tryU("swap", a, a + 1); if (a < 12) tryU("swap", a, a + 4); } }
    if (!opt) break; s = opt; pw++;
  }
  return { moves: s.moves, fl, pw, score: s.score, top: s.top, kinds: new Set(s.grid.filter(v => v > 2)).size };
}
for (const k of only) {
  const E = T.create(VARIANTS[k]); const res = [];
  for (let i = 0; i < N; i++) res.push(play(E, 1000 + i));
  const m = res.map(r => r.moves).sort((a, b) => a - b), tm = m.reduce((a, b) => a + b, 0), tf = res.reduce((a, r) => a + r.fl, 0);
  const zero = res.filter(r => !r.fl).length / N, capped = res.filter(r => r.moves >= CAPM).length;
  const tops = res.map(r => r.top).sort((a, b) => a - b), kinds = res.map(r => r.kinds).sort((a, b) => a - b);
  console.log(k, botKind, JSON.stringify(VARIANTS[k]), "meanMoves", (tm / N).toFixed(0), "median", m[N >> 1], "p10", m[Math.floor(N * .1)], "p90", m[Math.floor(N * .9)],
    "mpf", (tm / Math.max(1, tf)).toFixed(1), "flush/game", (tf / N).toFixed(1), "zeroFlush", (zero * 100).toFixed(0) + "%", "capped", capped,
    "powUsed/game", (res.reduce((a, r) => a + r.pw, 0) / N).toFixed(1), "medTop", tops[N >> 1], "p99Top", tops[Math.floor(N * .99)],
    "p90values", kinds[Math.floor(N * .9)], "meanScore", (res.reduce((a, r) => a + r.score, 0) / N).toFixed(0));
}
