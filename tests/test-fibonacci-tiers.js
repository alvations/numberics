/* SPDX-License-Identifier: Apache-2.0 | Copyright 2026 alvations (Melon Lab)
 * Fibonacci's Easy / Medium / Hard tiers (O-13, Two's recipe): `node tests/test-fibonacci-tiers.js`
 * Hard is the rule before the tiers byte for byte (replay hashes pinned from the engines before O-12); Medium and Easy
 * pay more joins (reach 1 and 3 Fibonacci steps below the top tile, from 55), and every anti-farm rule holds on every
 * tier (R2 state.free, marks, Undo, Boost, the cap), checked by the same property tests as Two's. */
"use strict";
const fs = require("fs"), path = require("path"), crypto = require("crypto");
const N = require("../fibonacci/engine.js");
let pass = 0, fail = 0;
function t(name, fn) { try { fn(); pass++; } catch (e) { fail++; console.log("FAIL", name, "\n  ", e.message); } }
function eq(a, b, m) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || "") + " got " + JSON.stringify(a) + " want " + JSON.stringify(b)); }
function ok(c, m) { if (!c) throw new Error(m || "assertion failed"); }
const Z4 = [0, 0, 0, 0];
const P0 = (o) => Object.assign({ undo: 0, smash: 0, swap: 0, boost: 0 }, o);
const tot = (s) => N.POWERS.reduce((a, k) => a + s.power[k], 0);
function board(rows, extra, tier) {
  const g = [].concat(...rows);
  const s = Object.assign({ size: rows.length, grid: g, score: 0, top: Math.max(0, ...g), moves: 0, seed: 7,
    over: false, power: P0(), prev: null }, extra || {});
  if (tier && tier !== "hard") s.tier = tier;
  return s;
}
const TIERS = ["easy", "medium", "hard"];
const on = (tier) => Object.assign({}, N, { newGame: (seed) => N.newGame(seed, 4, tier) });

// ---- Hard is the original rule ----
t("Hard is the default: no tier field, and newGame(seed, 4, 'hard') is newGame(seed) exactly", () => {
  for (let sd = 1; sd <= 50; sd++) { eq(N.newGame(sd, 4, "hard"), N.newGame(sd)); ok(!("tier" in N.newGame(sd))); }
  eq(N.tierOf(N.newGame(1)), "hard"); eq(N.tierOf(N.newGame(1, 4, "easy")), "easy");
  eq(N.TIERS, TIERS); eq(N.REACH, { easy: 3, medium: 1, hard: -1 });
});
t("Hard replays the rules before the tiers: 1000 random moves and power-ups hash as the pre-O-12 engine did", () => {
  // hashes recorded from the engines at commit 9434c7d (before O-12 and O-13), the same driver as tests/test.js
  const WANT = { 1: "9c588bceb10b50ff18140ca952b6d08ae301d1ffd0a6d56444bc9be4a81333aa", 2: "4dc3bc0d23569daa5b0f672b302fd7a87f7e18e300a459e75f0c751da9eb08b9",
    3: "aff2b3ff6712013f44299a4a485e314a783c63ec5ac470afa8e679fdd9b309b9", 7: "ab7a3d0adc73105b87b157d14e14d74d4e2521e351c5669dafa7ef9b04b49a2e",
    42: "7110ed1a47476bb0ae900c76cf4467966052ced0ad9804da6388998982d4aca0" };
  Object.keys(WANT).forEach(k => {
    const seed = +k, h = crypto.createHash("sha256");
    let s = N.newGame(seed, 4, "hard"), d = seed * 7919 + 1, games = 1;
    const r = () => { const x = N.rand(d); d = x[1]; return x[0]; };
    for (let i = 0; i < 1000; i++) {
      if (s.over) { s = N.newGame(seed * 1000 + games++, 4, "hard"); h.update(JSON.stringify(s)); continue; }
      const c = r(); let res;
      if (c < 0.9) res = N.move(s, N.DIRS[Math.floor(r() * 4)]);
      else {
        const name = N.POWERS[Math.floor(r() * 4)];
        if (s.power[name] < 1 && r() < 0.7) s = Object.assign({}, s, { power: Object.assign({}, s.power, { [name]: 1 }) });
        res = N.use(s, name, Math.floor(r() * 18) - 1, Math.floor(r() * 18) - 1);
      }
      h.update(JSON.stringify(res)); s = res.state;
    }
    eq(h.digest("hex"), WANT[k], "seed " + k);
  });
});
t("the tier only decides who pays: from the same board a move joins the same tiles, and Hard <= Medium <= Easy in rewards", () => {
  let steps = 0, more = 0;
  for (let sd = 1; sd <= 40; sd++) {
    let s = N.newGame(sd);
    for (let i = 0; i < 400 && !s.over; i++) {
      const d = N.DIRS[(i * 7 + sd) % 4], r = TIERS.map(tr => N.move(tr === "hard" ? s : Object.assign({}, s, { tier: tr }), d));
      if (!r[2].moved) { if (!N.canMove(s)) break; continue; }
      r.forEach(x => { eq(x.merges, r[2].merges); eq(x.state.score, r[2].state.score); eq(x.milestones, r[2].milestones); eq(x.trace, r[2].trace); });
      ok(r[2].awarded.length <= r[1].awarded.length && r[1].awarded.length <= r[0].awarded.length, "ladder order");
      eq(r[0].state.tier, "easy"); eq(r[1].state.tier, "medium"); ok(!("tier" in r[2].state), "Hard stays without the field");
      if (r[0].awarded.length > r[1].awarded.length) more++;
      steps++; s = r[2].state;
    }
  }
  ok(steps > 3000 && more > 20, "steps " + steps + ", moves where Easy paid more than Medium " + more);
});

// ---- what each tier pays (index 9 shows 55, 10 shows 89, 11 shows 144, 12 shows 233) ----
t("payFrom: the lowest index a join must make to pay (floor 55 on every tier)", () => {
  eq(N.payFrom(board([[12, 0, 0, 0], Z4, Z4, Z4], {}, "hard")), 13, "Hard: a new highest tile");
  eq(N.payFrom(board([[12, 0, 0, 0], Z4, Z4, Z4], {}, "medium")), 11, "Medium: the top tile or the number below it");
  eq(N.payFrom(board([[12, 0, 0, 0], Z4, Z4, Z4], {}, "easy")), 9, "Easy: the top tile or the three numbers below it");
  TIERS.forEach(tr => eq(N.payFrom(board([[6, 0, 0, 0], Z4, Z4, Z4], {}, tr)), 9, tr + " floor"));
  eq(N.payFrom(board([[10, 0, 0, 0], Z4, Z4, Z4], {}, "easy")), 9, "Easy at top 89 still needs 55");
});
t("another 233 (89 + 144) and a 144 (55 + 89) at top 233 pay on Medium and Easy, not on Hard", () => {
  TIERS.forEach(tr => {
    const r = N.move(board([[10, 11, 0, 0], Z4, Z4, [12, 0, 0, 0]], { top: 12 }, tr), "left");
    eq(r.state.grid[0], 12); eq(r.awarded.length, tr === "hard" ? 0 : 1, tr); eq(r.milestones, [], tr + ": not a new top tile");
    const q = N.move(board([[9, 10, 0, 0], Z4, Z4, [12, 0, 0, 0]], { top: 12 }, tr), "left");
    eq(q.state.grid[0], 11); eq(q.awarded.length, tr === "hard" ? 0 : 1, tr + " 144");
  });
});
t("a 55 or 89 at top 233 pays on Easy only; a 34 never pays", () => {
  TIERS.forEach(tr => {
    eq(N.move(board([[8, 9, 0, 0], Z4, Z4, [12, 0, 0, 0]], { top: 12 }, tr), "left").awarded.length, tr === "easy" ? 1 : 0, tr + " 89");
    eq(N.move(board([[7, 8, 0, 0], Z4, Z4, [12, 0, 0, 0]], { top: 12 }, tr), "left").awarded.length, tr === "easy" ? 1 : 0, tr + " 55");
    eq(N.move(board([[6, 7, 0, 0], Z4, Z4, [12, 0, 0, 0]], { top: 12 }, tr), "left").awarded.length, 0, tr + " 34");
  });
});
t("below 55 nothing pays on any tier; a new top tile from 55 pays on every tier", () => {
  TIERS.forEach(tr => {
    eq(N.move(board([[7, 6, 0, 0], Z4, Z4, Z4], { top: 7 }, tr), "left").awarded.length, 0, tr + " 34");
    eq(N.move(board([[8, 7, 0, 0], Z4, Z4, Z4], { top: 8 }, tr), "left").awarded.length, 1, tr + " 55");
  });
});
t("Medium and Easy pay every qualifying join in a move; Hard pays once per new level", () => {
  const rows = [[10, 11, 0, 0], [10, 11, 0, 0], Z4, Z4]; // two new 233s at top 144
  eq(N.move(board(rows, { top: 11 }, "hard"), "left").awarded.length, 1);
  eq(N.move(board(rows, { top: 11 }, "medium"), "left").awarded.length, 2);
  eq(N.move(board(rows, { top: 11 }, "easy"), "left").awarded.length, 2);
});
t("the tier survives moves, power-ups and Undo", () => {
  ["easy", "medium"].forEach(tr => {
    let s = N.newGame(9, 4, tr); s.power = P0({ undo: 3, smash: 3, swap: 3, boost: 3 });
    s = N.move(s, "left").moved ? N.move(s, "left").state : N.move(s, "right").state; eq(s.tier, tr, "move");
    const at = s.grid.findIndex(Boolean);
    eq(N.use(s, "boost", at).state.tier, tr, "boost"); eq(N.use(s, "smash", at).state.tier, tr, "smash");
    eq(N.use(s, "swap", at, (at + 1) % 16).state.tier, tr, "swap"); eq(N.use(s, "undo").state.tier, tr, "undo");
  });
});

// ---- anti-farm, on every tier ----
TIERS.forEach(tr => {
  t(tr + ": the move after Smash, Swap or Boost pays nothing (state.free)", () => {
    // Smash opens a qualifying join (89 + 144 = 233 with top 233); the next swipe makes it and pays nothing
    const s = board([[10, 1, 11, 0], Z4, Z4, [12, 0, 0, 0]], { top: 12, power: P0({ smash: 1 }) }, tr);
    const u = N.use(s, "smash", 1), m = N.move(u.state, "left");
    eq(m.state.grid[0], 12); eq(m.awarded, []); ok(m.free); eq(tot(m.state), 0);
    // the move after that pays as usual on Medium and Easy
    const again = N.move(board([[10, 11, 0, 0], Z4, Z4, [12, 0, 0, 0]], { top: 12 }, tr), "left");
    eq(again.awarded.length, tr === "hard" ? 0 : 1);
  });
  t(tr + ": a join with a swapped or boosted tile pays nothing, however many moves later", () => {
    // Boost a 55 to 89 beside a 144 (top 233): a dummy swipe, then 144 + 89 = 233 is marked
    const s = board([[11, 9, 0, 0], Z4, Z4, [0, 0, 0, 12]], { top: 12, power: P0({ boost: 1 }) }, tr);
    const u = N.use(s, "boost", 1), m1 = N.move(u.state, "up"); ok(m1.moved); eq(m1.merges, []); eq(m1.state.grid.slice(0, 2), [11, 10]);
    const m2 = N.move(m1.state, "left"); eq(m2.state.grid[0], 12); eq(m2.awarded, []);
    if (tr !== "hard") ok(m2.marked, "the result says why");
  });
  t(tr + ": Boost and every power-up use never pay; the stock never passes 9", () => {
    for (let sd = 1; sd <= 60; sd++) {
      let s = N.newGame(sd, 4, tr), x = sd * 2654435761 >>> 0;
      s.power = P0({ undo: 9, smash: 9, swap: 9, boost: 9 });
      for (let i = 0; i < 300 && !s.over; i++) {
        x = (x * 1103515245 + 12345) >>> 0;
        if (x % 5 === 0) {
          const name = N.POWERS[(x >>> 3) % 4], u = N.use(s, name, (x >>> 5) % 16, (x >>> 9) % 16);
          if (u.ok) { ok(tot(u.state) === tot(s) - 1 || name === "undo", "a use pays nothing: " + name); ok(tot(u.state) <= tot(s), "never more"); s = u.state; continue; }
        }
        const r = N.move(s, N.DIRS[(x >>> 7) % 4]);
        if (r.moved) { s = r.state; N.POWERS.forEach(p => ok(s.power[p] <= N.POWER_CAP, "cap")); }
        else if (!N.canMove(s)) break;
      }
    }
  });
  t(tr + ": a power-up followed by any move never raises the total stock (random games)", () => {
    let checked = 0, paid = 0;
    for (let seed = 1; seed <= 80; seed++) {
      let s = N.newGame(seed, 4, tr), x = seed;
      s.power = { undo: 2, smash: 3, swap: 3, boost: 3 };
      for (let i = 0; i < 400 && !s.over; i++) {
        x = (x * 1103515245 + 12345) >>> 0;
        if (x % 4 === 0) {
          const name = N.POWERS[1 + (x >>> 3) % 3], before = tot(s), u = N.use(s, name, (x >>> 5) % 16, (x >>> 9) % 16);
          if (u.ok) {
            N.DIRS.forEach(d => { const r = N.move(u.state, d); if (r.moved) { ok(tot(r.state) === before - 1, name + " then " + d + ", seed " + seed); checked++; } });
            s = u.state; continue;
          }
        }
        const r = N.move(s, N.DIRS[(x >>> 7) % 4]);
        if (r.moved) { if (r.awarded.length) paid++; s = r.state; } else if (!N.canMove(s)) break;
      }
    }
    ok(checked > 700, "exercised " + checked); ok(paid > 5, "honest moves still pay (" + paid + ")");
  });
  t(tr + ": Undo cycling never earns (move, Undo, move ... ends with no more stock than one honest move gives)", () => {
    let cycles = 0, paying = 0;
    for (let sd = 1; sd <= 80; sd++) {
      let s = N.newGame(sd, 4, tr), x = sd;
      for (let i = 0; i < 250 && !s.over; i++) {
        x = (x * 1103515245 + 12345) >>> 0;
        const d = N.DIRS[(x >>> 7) % 4], r = N.move(s, d);
        if (!r.moved) { if (!N.canMove(s)) break; continue; }
        if (x % 3 === 0) {
          // cycle: from s, k times (move d, Undo); then the move once more
          const base = Object.assign({}, s, { power: Object.assign({}, s.power, { undo: 9 }) }), t0 = tot(base);
          let v = base;
          for (let k = 0; k < 4; k++) {
            const m = N.move(v, d), u = N.use(m.state, "undo"); ok(u.ok);
            eq(u.state.grid, base.grid); ok(tot(u.state) === tot(v) - 1, "an Undo costs one and rewinds the reward"); v = u.state;
          }
          const last = N.move(v, d); if (last.awarded.length) paying++;
          ok(tot(last.state) <= t0 - 4 + r.awarded.length, "cycling paid more than one move");
          cycles++;
        }
        s = r.state;
      }
    }
    ok(cycles > 1000, "cycles " + cycles); ok(paying > 5, "cycles that reached a paying move " + paying);
  });
  t(tr + ": no short loop back to the same board ever ends with more stock (no-progress loops)", () => {
    // random 2- to 6-action sequences of moves and power-ups from random mid-game boards; any that comes back to the
    // same grid (a loop that made no progress) must not have raised the stock
    let loops = 0, paid = 0;
    for (let sd = 1; sd <= 60; sd++) {
      let s = N.newGame(sd, 4, tr), x = sd * 40503;
      const rnd = () => { x = (x * 1103515245 + 12345) >>> 0; return x / 4294967296; };
      for (let i = 0; i < 200 && !s.over; i++) {
        const r = N.move(s, N.DIRS[Math.floor(rnd() * 4)]); if (r.moved) s = r.state; else if (!N.canMove(s)) break;
        if (i < 20) continue;
        for (let trial = 0; trial < 30; trial++) {
          let v = Object.assign({}, s, { power: P0({ undo: 3, smash: 3, swap: 3, boost: 3 }) });
          const t0 = tot(v), len = 2 + Math.floor(rnd() * 5);
          for (let k = 0; k < len; k++) {
            const c = rnd();
            if (c < 0.45) { const m = N.move(v, N.DIRS[Math.floor(rnd() * 4)]); if (m.moved) { v = m.state; paid += m.awarded.length; } }
            else {
              const name = c < 0.6 ? "undo" : c < 0.8 ? "smash" : c < 0.92 ? "swap" : "boost";
              const tiles = v.grid.map((g, j) => g ? j : -1).filter(j => j >= 0);
              const a = tiles[Math.floor(rnd() * tiles.length)], b = Math.floor(rnd() * 16);
              const u = N.use(v, name, a, b); if (u.ok) v = u.state;
            }
            if (k > 0 && JSON.stringify(v.grid) === JSON.stringify(s.grid)) { loops++; ok(tot(v) <= t0, "a loop raised the stock: seed " + sd); }
          }
        }
      }
    }
    ok(loops > 500, "loops found " + loops); ok(paid > 50, "the sequences did pay sometimes (" + paid + ")");
  });
});

// ---- the R2-by-tile property of tests/test.js, per tier ----
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
        if (rp.merges.some(l => l >= E.payFrom(p))) paying++;
        if (rp.awarded.length > rq.awarded.length && bad.length < 3) bad.push(name + " k=" + k + " " + d + " seed " + seed + " " + JSON.stringify(p.grid));
      }
    }
  }
  return { trials, paying, bad, gaps };
}
TIERS.forEach(tr => t(tr + ": Boost or Swap, 0 to 5 neutral moves, then any move never out-earns the same moves without it", () => {
  const r = r2Property(on(tr), 120);
  eq(r.bad, [], "the power-up earned a reward");
  ok(r.trials > 10000, "trials " + r.trials); ok(r.paying > 200, "power-up lines that reached a paying join: " + r.paying);
  r.gaps.forEach((n, k) => ok(n >= 5, "gap " + k + " exercised " + n + " times"));
}));

// ---- the R2-by-tile property of tests/test.js, per tier ----
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
        if (rp.merges.some(l => l >= E.payFrom(p))) paying++;
        if (rp.awarded.length > rq.awarded.length && bad.length < 3) bad.push(name + " k=" + k + " " + d + " seed " + seed + " " + JSON.stringify(p.grid));
      }
    }
  }
  return { trials, paying, bad, gaps };
}
TIERS.forEach(tr => t(tr + ": Boost or Swap, 0 to 5 neutral moves, then any move never out-earns the same moves without it", () => {
  const r = r2Property(on(tr), 120);
  eq(r.bad, [], "the power-up earned a reward");
  ok(r.trials > 10000, "trials " + r.trials); ok(r.paying > 200, "power-up lines that reached a paying join: " + r.paying);
  r.gaps.forEach((n, k) => ok(n >= 5, "gap " + k + " exercised " + n + " times"));
}));

// ---- the ladder is spaced (a quick version of tools/sim-fibonacci.js) ----
t("measured: on the same seeds Medium pays about 1.4x to 2.2x Hard, and Easy 1.4x to 2.3x Medium (greedy bot, no power-ups)", () => {
  const rate = {};
  TIERS.forEach(tr => {
    let m = 0, r = 0;
    for (let sd = 1; sd <= 80; sd++) {
      let s = N.newGame(sd * 7919, 4, tr), x = sd;
      while (!s.over && s.moves < 3000) {
        let best = null, bv = -Infinity;
        for (const d of N.DIRS) {
          const q = N.move(s, d); if (!q.moved) continue;
          x = (x * 1103515245 + 12345) >>> 0;
          const v = q.gained + 8 * q.state.grid.filter(g => !g).length + x / 4294967296;
          if (v > bv) { bv = v; best = q; }
        }
        if (!best) break;
        r += best.awarded.length; s = best.state;
      }
      m += s.moves;
    }
    rate[tr] = r / m;
  });
  const mh = rate.medium / rate.hard, em = rate.easy / rate.medium;
  ok(mh > 1.4 && mh < 2.2, "Medium/Hard " + mh.toFixed(2)); ok(em > 1.4 && em < 2.3, "Easy/Medium " + em.toFixed(2));
});

// ---- the page: the family's difficulty row, the save, the copy (as Two) ----
const root = path.join(__dirname, "..");
const page = fs.readFileSync(path.join(root, "fibonacci", "index.html"), "utf8"), game = fs.readFileSync(path.join(root, "fibonacci", "game.js"), "utf8");
t("page: the family's #diff row (Easy, Medium, Hard) sits between the header and the tray, as on Two", () => {
  const row = page.indexOf('<div id="diff" class="seg" role="group" aria-label="Difficulty">');
  ok(row > page.indexOf("</header>") && row < page.indexOf('<section id="tray"'), "placement");
  ok(/data-diff="easy">Easy<\/button>\s*<button type="button" data-diff="medium">Medium<\/button>\s*<button type="button" data-diff="hard">Hard<\/button>/.test(page), "order");
});
t("save: an old save (no tier) loads as Hard, a first visit starts on Medium, the choice and a best per tier are saved", () => {
  ok(/var tier = saved && okTier\(saved\.tier\) \? saved\.tier : loaded \? N\.tierOf\(saved\.state\) : "medium";/.test(game), "tier on load");
  ok(/tier = N\.tierOf\(state\);/.test(game), "the loaded game's own tier wins");
  ok(/store\.save\(\{ state: state, tier: tier, bestScore: bests\.hard\.score, bestTop: bests\.hard\.top,\s*bests: \{ easy: bests\.easy, medium: bests\.medium \}/.test(game), "save fields");
  ok(/var store = K\.store\("numberics_fibonacci_v1"\);/.test(game) && !/localStorage\.setItem/.test(game), "the same key, through NumbericsKit.store");
  ok(/TIER_NAME\[N\.tierOf\(state\)\] \+ " best "/.test(game), "the card says the tier's best");
});
t("switching: a different tier starts a new game in it; mid-run it asks Sure? first (as Two)", () => {
  ok(/if \(state\.moves > 0 && !state\.over && tierArm !== t\) \{/.test(game) && /b\.textContent = "Sure\?"/.test(game), "Sure? mid-run");
  ok(/startNew\(t\); toast\(TIER_NAME\[t\] \+ ": new game"\);/.test(game), "new game in the tier");
  ok(/"Tap " \+ TIER_NAME\[tierArm\] \+ " again: this ends the run\."/.test(game), "the hint line says why");
});
t("copy: the How to play row and the tray say how each tier earns, from 55 up; rewards read \"+1 Name\"", () => {
  const how = page.replace(/\s+/g, " ");
  ok(/from 55 up: on Hard, each new highest tile earns one; on Medium, each join that makes your top tile or the number below it; on Easy, each join that makes your top tile or one of the three numbers below it\./.test(how), "how-to row");
  ok(/hard: "Earned by each new top tile from 55\."/.test(game) && /medium: "Earned by a join that makes your top tile or the one below it \(55 up\)\."/.test(game) &&
     /easy: "Earned by a join that makes your top tile or one of the 3 below it \(55 up\)\."/.test(game), "tray earn line");
  ok(/"\+1 " \+ PW\[a\.power\]/.test(game) && /toast\("Made " \+ N\.label\(made\) \+ " " \+ plusText\)/.test(game), "+1 Name, Made N");
  [page, game, fs.readFileSync(path.join(root, "tools", "sim-fibonacci.js"), "utf8"), fs.readFileSync(__filename, "utf8")].forEach(s => {
    ok(!/\u2014/.test(s), "no em-dash"); ok(/SPDX-License-Identifier: Apache-2\.0/.test(s), "SPDX");
  });
});

console.log(pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
