/* SPDX-License-Identifier: Apache-2.0 | Copyright 2026 alvations (Melon Lab)
 * Three tuning simulation: node tools/sim-three.js [games=10000] [bot=greedy|flush|random]
 * Reproduces the variant table at the top of three/engine.js. */
"use strict";
const T = require("../three/engine.js");
const N = +process.argv[2] || 10000, CAPM = 3000, botKind = process.argv[3] || "greedy";
const VARIANTS = {
  A: { step: false, flushMin: 3, bag: "b123" },
  B: { step: true, flushMin: 3, bag: "b123" },
  C: { step: true, flushMin: 4, bag: "b123" },
  D: { step: true, flushMin: 3, bag: "b12" },
  E: { step: true, flushMin: 3, bag: "b123", bonus: true },
  F: { step: false, flushMin: 3, bag: "b12" },
  G: { step: true, flushMin: 3, bag: "b123", start: 6 },
  H: { step: true, flushMin: 3, bag: "b33" },
  I: { step: true, flushMin: 3, bag: "b36" },
  J: { step: true, flushMin: 3, bag: "b369" },
  K: { step: true, flushMin: 3, bag: "b3x" },
};
const only = process.argv[4] ? process.argv[4].split(",") : Object.keys(VARIANTS);
function evalS(E, s, r) {
  let e = 0, pairs = 0; const g = s.grid;
  for (let i = 0; i < 16; i++) { if (!g[i]) e++; if (i % 4 < 3 && E.canMerge(g[i], g[i + 1])) pairs++; if (i < 12 && E.canMerge(g[i], g[i + 4])) pairs++; }
  let near = 0;
  if (botKind === "seeker") for (let i = 0; i < 16; i++) { const a = g[i]; if (!E.isThree(a)) continue;
    if (i % 4 < 3 && E.isThree(g[i + 1]) && Math.abs(g[i + 1] - a) === 3) near++; if (i < 12 && E.isThree(g[i + 4]) && Math.abs(g[i + 4] - a) === 3) near++; }
  return r.gained + 6 * e + (botKind === "seeker" ? 120 : 40) * r.flushes.length + 2 * pairs + 8 * near;
}
let rs = 12345; const rnd = () => { const r = T.rand(rs); rs = r[1]; return r[0]; };
function play(E, seed) {
  let s = E.newGame(seed), fl = 0, pw = 0;
  while (!s.over && s.moves < CAPM) {
    let best = null, bv = -1e9;
    for (const d of E.DIRS) { const r = E.move(s, d); if (!r.moved) continue; const v = botKind === "random" ? rnd() : evalS(E, r.state, r) + rnd(); if (v > bv) { bv = v; best = r; } }
    if (best) { fl += best.flushes.length; s = best.state; continue; }
    // stuck: try power-ups (not undo), pick the one whose best follow-up is best
    let opt = null, ov = -1e9;
    const tryU = (name, a, b) => { const u = E.use(s, name, a, b); if (!u.ok) return; for (const d of E.DIRS) { const r = E.move(u.state, d); if (r.moved) { const v = evalS(E, r.state, r) - (name === "smash" ? 5 : 0); if (v > ov) { ov = v; opt = u.state; } } } };
    for (let a = 0; a < 16; a++) { if (s.power.smash) tryU("smash", a); if (s.power.third) tryU("third", a); if (s.power.swap) { if (a % 4 < 3) tryU("swap", a, a + 1); if (a < 12) tryU("swap", a, a + 4); } }
    if (!opt) break; s = opt; pw++;
  }
  return { moves: s.moves, fl, pw, score: s.score, top: s.top };
}
for (const k of only) {
  const E = T.create(VARIANTS[k]); const res = [];
  for (let i = 0; i < N; i++) res.push(play(E, 1000 + i));
  const m = res.map(r => r.moves).sort((a, b) => a - b), tm = m.reduce((a, b) => a + b, 0), tf = res.reduce((a, r) => a + r.fl, 0);
  const zero = res.filter(r => !r.fl).length / N, capped = res.filter(r => r.moves >= CAPM).length;
  const tops = res.map(r => r.top).sort((a, b) => a - b);
  console.log(k, JSON.stringify(VARIANTS[k]), "meanMoves", (tm / N).toFixed(0), "median", m[N >> 1], "p90", m[Math.floor(N * .9)], "mpf", (tm / Math.max(1, tf)).toFixed(1),
    "flush/game", (tf / N).toFixed(1), "zeroFlush", (zero * 100).toFixed(0) + "%", "capped", capped, "powUsed/game", (res.reduce((a, r) => a + r.pw, 0) / N).toFixed(1), "medTop", tops[N >> 1], "meanScore", (res.reduce((a, r) => a + r.score, 0) / N).toFixed(0));
}
