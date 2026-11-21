/* SPDX-License-Identifier: Apache-2.0 | Copyright 2026 alvations (Melon Lab)
 * Fibonacci tier measurement (O-13): node tools/sim-fibonacci.js [games=400] [cap=5000] [easyReach] [mediumReach]
 * tools/sim-two.js with the Fibonacci engine (fibonacci/engine.js on the Two core). easyReach and mediumReach (optional)
 * play Easy and Medium with that reach instead of the shipped one, to compare (docs/DESIGN.md, Fibonacci tiers).
 * Plays the same seeds on Easy, Medium and Hard and prints, per bot and per tier:
 * moves per reward, rewards per 100 moves, rewards per game, mean moves, median top tile, and the rate in the first
 * 150 moves against the rate after it (the ladder should hold through a run, not only at the start).
 * Bots (seeded noise; the same seed list for every tier):
 *   random  = any legal swipe (a weak player)
 *   greedy  = 1-ply: points gained + 8 per empty cell (the bot the round-2 numbers used)
 *   corner  = 1-ply: 20 per empty cell + rows and columns kept in order + the big tile in a corner (a strong player)
 * Power-up use:
 *   none     = never uses one (rewards cannot change the game, so the tiers play the very same moves)
 *   sensible = when no swipe moves: Undo if it can, else Smash the smallest tile, else Swap two cells that then join,
 *              else Boost a tile to match a neighbour. Never uses one while a swipe is possible.
 * Rewards are counted from move results (r.awarded), so the cap of 9 and every R2 rule apply as in the game. */
"use strict";
const F = require("../fibonacci/engine.js"), Core = require("../two/engine.js");
const GAMES = +process.argv[2] || 400, CAP = +process.argv[3] || 5000, EARLY = 150, ER = process.argv[4], MR = process.argv[5];
const reach = Object.assign({}, F.REACH, ER ? { easy: +ER } : {}, MR ? { medium: +MR } : {});
const N = ER || MR ? Object.assign(Core.make(Object.assign({}, F.RULES, { reach })), { label: F.label }) : F;
console.log("Fibonacci, Easy reach " + N.REACH.easy + ", Medium " + N.REACH.medium + ", Hard " + N.REACH.hard);

function noise(seed) { let x = seed >>> 0; return () => { const r = N.rand(x); x = r[1]; return r[0]; }; }
function empties(g) { let e = 0; for (const v of g) if (!v) e++; return e; }
const BOTS = {
  random: (r, rnd) => rnd(),
  greedy: (r, rnd) => r.gained + 8 * empties(r.state.grid) + rnd(),
  corner: (r, rnd) => {
    const g = r.state.grid; let mono = 0;
    for (let a = 0; a < 4; a++) for (let b = 0; b < 3; b++) {
      const p = g[a * 4 + b], q = g[a * 4 + b + 1]; mono += p >= q ? p : -q;
      const u = g[b * 4 + a], v = g[b * 4 + a + 4]; mono += u >= v ? u : -v;
    }
    return 20 * empties(g) + 3 * mono + 10 * g[0] + rnd();
  },
};
function rescue(s) {
  const g = s.grid, n = 16;
  if (s.power.undo > 0 && s.prev) { const u = N.use(s, "undo"); if (u.ok) return u.state; }
  if (s.power.smash > 0) {
    let at = -1; for (let i = 0; i < n; i++) if (g[i] && (at < 0 || g[i] < g[at])) at = i;
    const u = N.use(s, "smash", at); if (u.ok) return u.state;
  }
  if (s.power.swap > 0) for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) {
    const u = N.use(s, "swap", a, b); if (u.ok && N.canMove(u.state)) return u.state;
  }
  if (s.power.boost > 0) for (let a = 0; a < n; a++) {
    const u = N.use(s, "boost", a); if (u.ok && N.canMove(u.state)) return u.state;
  }
  return null;
}
function play(tier, seed, bot, use) {
  const rnd = noise(seed * 31 + 7);
  let s = N.newGame(seed * 7919, 4, tier), rewards = 0, early = 0, uses = 0, lastUndoAt = -1;
  while (!s.over && s.moves < CAP) {
    let best = null, bv = -Infinity;
    for (const d of N.DIRS) { const r = N.move(s, d); if (!r.moved) continue; const v = BOTS[bot](r, rnd); if (v > bv) { bv = v; best = r; } }
    if (!best) {
      if (use !== "sensible") break;
      // an Undo of the stuck move would replay the same swipe: undo once per move count, then other power-ups
      const u = s.moves !== lastUndoAt ? rescue(s) : rescue(Object.assign({}, s, { prev: null }));
      if (!u) break;
      if (u.moves < s.moves) lastUndoAt = u.moves;
      s = u; uses++; continue;
    }
    rewards += best.awarded.length; if (s.moves < EARLY) early += best.awarded.length;
    s = best.state;
  }
  return { moves: s.moves, rewards, early, top: s.top, uses };
}
function median(a) { const b = a.slice().sort((x, y) => x - y); return b[b.length >> 1]; }
function run(bot, use) {
  console.log("\n" + bot + " bot, power-ups " + use + ", " + GAMES + " games");
  console.log("tier    moves/reward  per 100  per game  mean moves  median top  per 100 first " + EARLY + "  per 100 after");
  const out = {};
  for (const tier of ["hard", "medium", "easy"]) {
    let m = 0, r = 0, e = 0, em = 0, tops = [];
    for (let g = 1; g <= GAMES; g++) {
      const x = play(tier, g, bot, use); m += x.moves; r += x.rewards; e += x.early; em += Math.min(x.moves, EARLY); tops.push(x.top);
    }
    out[tier] = 100 * r / m;
    console.log(tier.padEnd(8) + (m / r).toFixed(1).padStart(12) + (100 * r / m).toFixed(2).padStart(9) + (r / GAMES).toFixed(1).padStart(10) +
      (m / GAMES).toFixed(0).padStart(12) + String(N.label(median(tops))).padStart(12) +
      (100 * e / em).toFixed(2).padStart(22) + (m > em ? (100 * (r - e) / (m - em)).toFixed(2) : "-").padStart(15));
  }
  console.log("ratios: Medium/Hard " + (out.medium / out.hard).toFixed(2) + ", Easy/Medium " + (out.easy / out.medium).toFixed(2) +
    ", Easy/Hard " + (out.easy / out.hard).toFixed(2));
}
for (const use of ["none", "sensible"]) for (const bot of ["random", "greedy", "corner"]) run(bot, use);
