/* SPDX-License-Identifier: Apache-2.0 | Copyright 2026 alvations (Melon Lab)
 * `node tests/test-fifteen.js` */
"use strict";
const F = require("../fifteen/engine.js");
let pass = 0, fail = 0;
function t(n, f) { try { f(); pass++; } catch (e) { fail++; console.log("FAIL", n, "\n  ", e.message); } }
function ok(c, m) { if (!c) throw new Error(m || "assertion failed"); }
function eq(a, b, m) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || "") + " got " + JSON.stringify(a) + " want " + JSON.stringify(b)); }
const sortT = (ts) => ts.map(x => x.slice().sort((a, b) => a - b)).map(String).sort();
// a state with a forged board, side to move `turn`
function at(owner, turn, diff, extra) {
  const s = F.newMatch(7, diff || "hard"); s.owner = owner.slice(); s.turn = turn || 1;
  return Object.assign(s, extra || {});
}
const B = (mine, theirs) => { const o = new Array(9).fill(0); mine.forEach(n => o[n - 1] = 1); theirs.forEach(n => o[n - 1] = 2); return o; };
const must = (r, m) => { ok(r.ok, m || "action refused"); return r.state; };

// ---- the trick ----
t("the 8 magic lines are exactly the 15-sum triples of 1-9", () => {
  eq(F.LINES.length, 8); eq(F.triples15().length, 8);
  eq(sortT(F.LINES), sortT(F.triples15()));
  F.LINES.forEach(l => eq(l[0] + l[1] + l[2], 15));
  eq(F.MAGIC.slice().sort(), [1, 2, 3, 4, 5, 6, 7, 8, 9], "magic square uses each number once");
});
t("win by sum equals win by grid line, on every one of the 3^9 boards", () => {
  for (let k = 0; k < 19683; k++) {
    const o = []; let x = k; for (let i = 0; i < 9; i++) { o.push(x % 3); x = Math.floor(x / 3); }
    for (const side of [1, 2]) {
      const bySum = F.triples15().filter(tr => tr.every(n => o[n - 1] === side)).map(String).sort();
      const byGrid = F.CELL_LINES.filter(l => l.every(c => o[F.MAGIC[c] - 1] === side)).map(l => l.map(c => F.MAGIC[c]).sort((a, b) => a - b)).map(String).sort();
      eq(bySum, byGrid, "board " + o); eq(!!F.sumWin(o, side), !!F.gridWin(o, side));
    }
  }
});

// ---- play ----
t("claims alternate, a taken number is refused, out-of-range is refused", () => {
  let s = F.newMatch(1, "easy"); eq(s.turn, 1);
  s = must(F.claim(s, 5)); eq(s.turn, 2); eq(s.owner[4], 1);
  ok(!F.claim(s, 5).ok, "taken"); ok(!F.claim(s, 0).ok && !F.claim(s, 10).ok, "range");
  s = must(F.claim(s, 2)); eq(s.owner[1], 2); eq(s.turn, 1);
});
t("three numbers summing to 15 win the round; a non-15 triple does not", () => {
  let s = at(B([2, 6], [1, 3]), 1);
  ok(!must(F.claim(s, 8)).result, "2+6+8=16 is no win");
  s = must(F.claim(s, 7)); eq(s.result.winner, 1); eq(s.result.line, [2, 6, 7]); eq(s.wins, [0, 1, 0]);
  ok(!F.claim(s, 9).ok, "a finished round is locked");
});
t("a full board with no 15 is a draw", () => {
  // you 1 2 4 7, computer 3 5 6 9 (no 15 in either); you claim 8 and 1,2,4,7,8 still holds no 15
  let s = at(B([1, 2, 4, 7], [3, 5, 6, 9]), 1);
  ok(!F.sumWin(s.owner, 1) && !F.sumWin(s.owner, 2));
  s = must(F.claim(s, 8)); ok(!F.sumWin(s.owner, 1), "fixture"); eq(s.result.winner, 0); eq(s.wins, [1, 0, 0]);
});
t("perfect play from the empty board is a draw (solver)", () => {
  eq(F.solve(new Array(9).fill(0), 1), 0);
  eq(F.bestMoves(new Array(9).fill(0), 1).length, 9, "every opening holds the draw");
});
t("solver labels known positions: a fork wins, a forced block is found", () => {
  ok(F.solve(B([8, 6], [1, 3]), 1) > 0, "claiming 2 forks 5 and 7: you win");
  eq(F.bestMoves(B([5], [8, 1]), 1), [6], "the computer needs 6 (8+1+6): only 6 holds");
  ok(F.solve(B([5], [8, 1]), 1) === 0);
});

// ---- the computer ----
t("Easy takes a win when it has one", () => {
  for (let seed = 1; seed < 30; seed++) {
    const s = at(B([3, 4], [8, 1]), 2, "easy", { seed });
    eq(F.cpuTurn(s).state.result.winner, 2, "seed " + seed);
  }
});
t("Easy otherwise plays a seeded random number (deterministic)", () => {
  const s = at(B([5], []), 2, "easy");
  eq(F.cpuTurn(s).actions, F.cpuTurn(s).actions);
  const seen = new Set(); for (let seed = 1; seed < 60; seed++) seen.add(F.cpuTurn(at(B([5], []), 2, "easy", { seed })).actions[0].n);
  ok(seen.size >= 5, "random spread " + seen.size);
});
t("Medium blocks and takes wins", () => {
  for (let seed = 1; seed < 30; seed++) {
    eq(F.cpuTurn(at(B([8, 1], [5]), 2, "medium", { seed })).actions, [{ type: "claim", n: 6 }], "block");
    eq(F.cpuTurn(at(B([8, 1], [3, 5]), 2, "medium", { seed })).state.result.winner, 2, "win beats block");
  }
});
// exhaustive: every possible line of play by you against Hard, both starting sides
function everyGame(diff, seed, starter, fn) {
  const go = (s) => {
    if (s.result) return fn(s);
    if (s.turn === 2) return go(F.cpuTurn(s).state);
    F.free(s.owner).forEach(n => go(must(F.claim(s, n))));
  };
  const s = F.newMatch(seed, diff); s.starter = starter; s.turn = starter; go(s);
}
t("Hard never loses without power-ups in play (every line of play, both starters, many seeds)", () => {
  let games = 0, lost = 0, won = 0;
  for (const seed of [1, 2, 3, 42, 2026]) for (const st of [1, 2]) everyGame("hard", seed, st, (s) => { games++; if (s.result.winner === 1) lost++; if (s.result.winner === 2) won++; });
  eq(lost, 0, "Hard lost"); ok(games > 1000, "games " + games); ok(won > 0, "Hard punishes mistakes");
});
t("Medium can be beaten by a fork; Hard cannot", () => {
  let medLoss = 0; everyGame("medium", 5, 1, (s) => { if (s.result.winner === 1) medLoss++; });
  ok(medLoss > 0, "Medium never loses?");
});

// ---- power-ups ----
t("a match starts with exactly one Undo", () => {
  const s = F.newMatch(1, "medium"); eq(s.power, { undo: 1, erase: 0, peek: 0, double: 0 });
});
t("on Hard you start with one Undo and one Erase; the computer starts with nothing", () => {
  eq(F.newMatch(1, "hard").power, { undo: 1, erase: 1, peek: 0, double: 0 });
  eq(F.newMatch(1, "hard").cpuPower, { undo: 0, erase: 0, peek: 0, double: 0 });
  eq(F.newMatch(1, "easy").power, { undo: 1, erase: 0, peek: 0, double: 0 });
  eq(F.setDiff(F.newMatch(1, "easy"), "hard").power.erase, 1, "switching to Hard starts a match with the Erase");
});
t("the computer only earns power-ups it uses (Erase, Double)", () => {
  const seen = new Set();
  for (let seed = 1; seed <= 300; seed++) {
    const s = F.cpuTurn(at(B([3, 4], [8, 1]), 2, "hard", { seed, cpuPower: { undo: 0, erase: 0, peek: 0, double: 0 } })).state;
    seen.add(s.result.earned);
  }
  eq([...seen].sort(), ["double", "erase"]);
  const full = at(B([3, 4], [8, 1]), 2, "hard"); full.cpuPower = { undo: 0, erase: 9, peek: 0, double: 9 };
  eq(F.cpuTurn(full).state.result.earned, null, "capped: nothing else is handed out instead");
});
t("Undo rewinds your last turn and the reply, paid for with one charge, nothing else returns", () => {
  let s = F.newMatch(3, "medium"); s.power.peek = 1;
  s = must(F.claim(s, 5)); s = F.cpuTurn(s).state;
  const before = JSON.stringify(s.owner);
  s = must(F.use(s, "peek")); s = must(F.claim(s, 2)); s = F.cpuTurn(s).state;
  s = must(F.use(s, "undo"));
  eq(JSON.stringify(s.owner), before); eq(s.turn, 1); eq(s.power.undo, 0); eq(s.power.peek, 0, "Peek is not refunded");
  ok(!F.use(s, "undo").ok, "no charge, no undo");
});
t("R1: Undo never crosses a decided round (won, lost or drawn), so a round win cannot be farmed", () => {
  let s = at(B([2, 6], [1, 3]), 1, "medium"); s.power.undo = 2;
  s = must(F.claim(s, 4)); s = F.cpuTurn(s).state;      // a quiet move first so a snapshot exists
  ok(!s.result, "fixture: the round goes on"); ok(F.canUse(s, "undo", 1), "fixture: undo is live mid-round");
  const w = F.threats(s.owner, 1); ok(w.length, "fixture: claiming 4 made threats the computer cannot all block");
  const s1 = must(F.claim(s, w[0])); ok(s1.result.winner === 1);
  ok(!F.canUse(s1, "undo", 1) && !F.use(s1, "undo").ok, "a won round is final");
  // a lost round is final too (it used to be undoable until the match was decided)
  let l = at(B([5, 2], [8, 1]), 1, "medium"); l.power.undo = 1;
  l = must(F.claim(l, 9)); l = F.cpuTurn(l).state; eq(l.result.winner, 2, "fixture: the computer completes 8+1+6");
  ok(!l.match, "fixture: the match goes on"); ok(!!l.prev, "fixture: a snapshot exists");
  ok(!F.canUse(l, "undo", 1) && !F.use(l, "undo").ok, "a lost round is final");
  let d = at(B([1, 2, 4], [3, 5, 6, 9]), 1, "medium"); d.power.undo = 1; d.prev = F.newMatch(1, "medium");
  d = must(F.claim(d, 7)); d = F.cpuTurn(d).state; eq(d.result.winner, 0, "fixture: a draw (the computer fills the board)");
  ok(!F.use(d, "undo").ok, "a drawn round is final");
});
t("R3: a Peek spent before Undo stays spent (the critic's repro: seed 5 Medium, peek 1, undo 2)", () => {
  let s = F.newMatch(5, "medium"); s.power.peek = 1; s.power.undo = 2;
  s = must(F.claim(s, 5)); s = F.cpuTurn(s).state; ok(!s.result);
  s = must(F.use(s, "peek")); eq(s.power.peek, 0);
  s = must(F.use(s, "undo"));
  eq(s.power.peek, 0, "Undo refunded the Peek"); eq(s.power.undo, 1);
  // a Peek bought back by replaying is impossible; a Peek earned before the snapshot is kept
  let k = F.newMatch(5, "medium"); k.power.peek = 2; k.power.undo = 1;
  k = must(F.claim(k, 5)); k = F.cpuTurn(k).state; k = must(F.use(k, "peek")); k = must(F.claim(k, F.free(k.owner)[0]));
  if (!k.result) { k = F.cpuTurn(k).state; if (!k.result) { k = must(F.use(k, "undo")); eq(k.power.peek, 1, "only the spent one stays spent"); } }
});
t("Undo never crosses into a new round", () => {
  let s = at(B([2, 6], [1, 3]), 1); s = must(F.claim(s, 7)); s = F.nextRound(s);
  ok(!F.canUse(s, "undo", 1)); ok(!F.use(s, "undo").ok);
});
t("Erase removes one opponent number; you still claim, but not the erased one", () => {
  let s = at(B([2], [8, 1]), 1); s.power.erase = 1;
  ok(!F.use(s, "erase", 2).ok, "cannot erase your own"); ok(!F.use(s, "erase", 5).ok, "cannot erase a free number");
  s = must(F.use(s, "erase", 8)); eq(s.owner[7], 0); eq(s.turn, 1, "still your turn"); eq(s.power.erase, 0);
  ok(!F.claim(s, 8).ok, "Erase removes, it never steals");
  ok(!F.canUse(Object.assign({}, s, { power: Object.assign({}, s.power, { double: 1 }) }), "double", 1), "one board power-up per turn");
  s = must(F.claim(s, 5)); eq(s.turn, 2); eq(s.blocked, 0);
  ok(F.claim(s, 8).ok, "the computer may take it back next turn");
});
t("Erase needs an opponent number", () => {
  const s = at(B([5], []), 1); s.power.erase = 1; ok(!F.canUse(s, "erase", 1));
});
t("Peek shows the number you must block, your winning number, and a best move", () => {
  let s = at(B([5], [8, 1]), 1); s.power.peek = 1;
  const r = F.use(s, "peek"); ok(r.ok); eq(r.info.block, [6]); eq(r.info.win, []); eq(r.info.best, [6]);
  eq(r.state.power.peek, 0); eq(r.state.owner, s.owner, "Peek changes nothing on the board"); eq(r.state.turn, 1);
  const w = F.use(Object.assign(at(B([4, 5], [8, 1]), 1), { power: { undo: 0, erase: 0, peek: 1, double: 0 } }), "peek").info;
  eq(w.win, [6]); eq(w.block, [6]);
  ok(!F.use(at(B([5], []), 1), "peek").ok, "no charge, no peek");
});
t("Double claims two numbers this turn, and a fork you could not finish becomes a win", () => {
  let s = at(B([8], [5, 1]), 1); s.power.double = 1;  // computer needs 9 to win (1+5+9)
  s = must(F.use(s, "double")); eq(s.claimsLeft, 2);
  s = must(F.claim(s, 9)); eq(s.turn, 1, "second claim still yours"); ok(!s.result);
  s = must(F.claim(s, 4)); eq(s.turn, 2);
});
t("Double: a win on the first claim ends the round at once, and earns nothing", () => {
  let s = at(B([8, 1], [5]), 1); s.power.double = 1;
  s = must(F.use(s, "double")); s = must(F.claim(s, 6));
  eq(s.result.winner, 1); eq(s.result.earned, null, "a power-up never earns a power-up");
  ok(!F.claim(s, 2).ok, "no second claim after the round ends");
});
t("R2: a round won after Erase in an EARLIER turn of the same round earns nothing", () => {
  // you 2, computer 8 and 1 (threatens 6): erase the 8 and claim 6, then win later with no power in that turn
  let s = at(B([2], [8, 1]), 1, "medium"); s.power.erase = 1; s.power.undo = 0;
  s = must(F.use(s, "erase", 8)); s = must(F.claim(s, 6));   // you 2 6, computer 1
  s.owner = B([2, 6], [1, 3]); s.turn = 1;                      // forge the computer's reply: 3
  ok(!s.usedPower, "fixture: this turn used no power-up");
  s = must(F.claim(s, 7)); eq(s.result.winner, 1); eq(s.result.earned, null, "Erase earlier in the round pays nothing");
  // control: the same win in a round with no power-up does earn
  const c = must(F.claim(at(B([2, 6], [1, 3]), 1, "medium"), 7)); ok(c.result.earned, "a clean round earns");
  // and the flag clears for the next round
  const n = F.nextRound(s); eq(n.powered, [false, false, false]);
});
t("R2: the computer's earlier Double in a round stops its own reward too (Hard)", () => {
  const s = at(B([5], [8]), 2, "hard"); s.cpuPower.double = 1;
  let x = F.cpuTurn(s).state; ok(x.powered[2], "the computer is marked");
  while (!x.result) x = x.turn === 2 ? F.cpuTurn(x).state : must(F.claim(x, F.free(x.owner)[0]));
  if (x.result.winner === 2) eq(x.result.earned, null);
});
t("R2: the computer using a power-up does not cost YOU your reward", () => {
  let s = at(B([2, 6], [1, 3]), 1, "medium"); s.powered = [false, false, true];
  s = must(F.claim(s, 7)); ok(s.result.earned, "your clean win still earns");
});
t("Double needs two free numbers", () => {
  const s = at(B([1, 5, 6, 8], [2, 3, 4]), 1); s.power.double = 1; // free: 7, 9
  ok(F.canUse(s, "double", 1)); s.owner[6] = 2; ok(!F.canUse(s, "double", 1), "one free number");
});
t("both sides at 15 at once cannot happen: fuzz every power-up for 3,000 random matches", () => {
  let rounds = 0;
  for (let seed = 1; seed <= 3000; seed++) {
    let s = F.newMatch(seed, ["easy", "medium", "hard"][seed % 3]);
    s.power = { undo: 2, erase: 3, peek: 2, double: 3 }; s.cpuPower = { undo: 0, erase: 2, peek: 0, double: 2 };
    let r = seed * 7919, guard = 0;
    const rnd = (n) => { r = (r * 1103515245 + 12345) >>> 0; return r % n; };
    while (!s.match && guard++ < 400) {
      ok(F.valid(s), "invalid state seed " + seed);
      ok(!(F.sumWin(s.owner, 1) && F.sumWin(s.owner, 2)), "both at 15");
      if (s.result) { rounds++; s = F.nextRound(s); continue; }
      if (s.turn === 2) { s = F.cpuTurn(s).state; continue; }
      const p = ["claim", "claim", "erase", "double", "peek", "undo"][rnd(6)];
      if (p === "claim") { const f = F.free(s.owner).filter(n => n !== s.blocked); s = must(F.claim(s, f[rnd(f.length)])); }
      else if (p === "erase") { const h = F.held(s.owner, 2); if (h.length && F.canUse(s, "erase", 1)) s = must(F.use(s, "erase", h[rnd(h.length)])); }
      else if (F.canUse(s, p, 1)) s = must(F.use(s, p));
      ok(F.free(s.owner).filter(n => n !== s.blocked).length > 0 || s.result, "the side to move always has a legal claim");
    }
    ok(s.match, "match " + seed + " never finished");
  }
  ok(rounds > 6000, "rounds " + rounds);
});
t("Hard spends a power-up only to improve its result", () => {
  // computer 8, you 5, computer to move: a dead draw, but Double (4 and 6) forks 3 and 1
  const s = at(B([5], [8]), 2, "hard"); eq(F.solve(s.owner, 2), 0, "fixture is a draw");
  s.cpuPower.double = 1;
  let r = F.cpuTurn(s); eq(r.actions[0].type, "double"); eq(r.state.cpuPower.double, 0);
  let x = r.state; while (!x.result) x = x.turn === 2 ? F.cpuTurn(x).state : must(F.claim(x, F.bestMoves(x.owner, 1)[0]));
  eq(x.result.winner, 2, "the Double wins against best defence");
  ok(r.state.result, "1 and 6 complete 8+1+6 on the Double turn itself");
  eq(r.state.result.earned, null, "a round won on a Double turn earns nothing");
  // a position already won: no power-up spent
  const q = at(B([5], [8, 4]), 2, "hard"); q.owner[0] = 1; q.cpuPower = { undo: 0, erase: 1, peek: 0, double: 1 };
  ok(F.cpuTurn(q).actions.every(a => a.type === "claim"));
});
t("Hard uses Erase to save a lost position", () => {
  // you hold 8, 4 and 6 is free... set a fork: you 8 and 2 (needs 5), you 8 and 4 (needs 3): computer cannot block both
  const s = at(B([8, 2, 4], [6, 9]), 2, "hard"); s.cpuPower.erase = 1;
  ok(F.threats(s.owner, 1).length >= 2, "fixture is a fork");
  const r = F.cpuTurn(s); eq(r.actions[0].type, "erase"); ok(!r.state.result || r.state.result.winner !== 1);
});
t("the computer earns power-ups only on Hard", () => {
  for (const d of ["easy", "medium", "hard"]) {
    const s = F.cpuTurn(at(B([3, 4], [8, 1]), 2, d)).state;
    eq(s.result.winner, 2); eq(!!s.result.earned, d === "hard", d);
  }
});
t("stock caps at 9", () => {
  let s = at(B([2, 6], [1, 3]), 1); s.power = { undo: 9, erase: 9, peek: 9, double: 9 };
  s = must(F.claim(s, 7)); eq(s.result.earned, null); eq(s.power.undo, 9);
});

// ---- R4: a perfect player wins every Hard round with that round's Erase, and those wins pay nothing (R2) ----
// the exact perfect player: the move (claim, or Erase then claim) with the best solved value against ANY reply
function perfectTurn(s) {
  let best = null, bv = -1e9;
  const cands = F.free(s.owner).map(n => [0, n]);
  if (F.canUse(s, "erase", 1)) F.held(s.owner, 2).forEach(e => F.free(s.owner).forEach(n => cands.push([e, n])));
  for (const [e, n] of cands) {
    const r = F.claim(e ? must(F.use(s, "erase", e)) : s, n); if (!r.ok) continue;
    const t = r.state, v = t.result ? (t.result.winner === 1 ? 100 : 0) : -F.solve(t.owner, 2, t.power.erase);
    if (v > bv) { bv = v; best = t; }
  }
  return best;
}
t("R4: with one Erase you force a round win against any defence, whoever starts; without it Hard is a draw", () => {
  const z = () => new Array(9).fill(0);
  ok(F.solve(z(), 1, 1) > 0, "you start, holding an Erase");
  ok(F.solve(z(), 2, 1) < 0, "the computer starts, you hold an Erase: every opening loses for it");
  eq(F.solve(z(), 1, 0), 0); eq(F.solve(z(), 2, 0), 0);
});
t("Hard: every round starts you with an Erase (topped up, not stacked); other levels do not", () => {
  let s = F.newMatch(3, "hard"); eq(s.power.erase, 1);
  s.owner = B([2, 6], [1, 3]); s.power.erase = 0; s = must(F.claim(s, 7));
  eq(F.nextRound(s).power.erase, 1, "spent last round: a fresh one");
  s.power.erase = 3; eq(F.nextRound(s).power.erase, 3, "earned ones are kept, nothing is added on top");
  let m = F.newMatch(3, "medium"); m.owner = B([2, 6], [1, 3]); m = must(F.claim(m, 7)); eq(F.nextRound(m).power.erase, 0);
});
t("R4 + R2: perfect play wins every Hard match 3-0, and no Erase round pays (60 seeds, both starters)", () => {
  for (let seed = 1; seed <= 60; seed++) {
    let s = F.newMatch(seed, "hard"); if (seed % 2) { s.starter = 2; s.turn = 2; }
    while (!s.match) {
      if (s.result) { eq(s.result.winner, 1, "seed " + seed + " round " + s.round); eq(s.result.earned, null, "the Erase round earned"); s = F.nextRound(s); continue; }
      s = s.turn === 2 ? F.cpuTurn(s).state : perfectTurn(s);
    }
    eq(s.match.winner, 1, "seed " + seed); eq(s.wins, [0, 3, 0], "seed " + seed);
  }
});
t("Hard plays against the Erase you hold: imperfect play still loses most matches (random player, 200 seeds)", () => {
  let lost = 0, won = 0;
  for (let seed = 1; seed <= 200; seed++) {
    let s = F.newMatch(seed, "hard"), r = seed * 2654435761 >>> 0;
    const rnd = (n) => { r = (r * 1103515245 + 12345) >>> 0; return (r >>> 8) % n; };
    while (!s.match) {
      if (s.result) { s = F.nextRound(s); continue; }
      if (s.turn === 2) { s = F.cpuTurn(s).state; continue; }
      if (F.canUse(s, "erase", 1) && rnd(3) === 0) { const h = F.held(s.owner, 2); s = must(F.use(s, "erase", h[rnd(h.length)])); }
      const f = F.free(s.owner).filter(n => n !== s.blocked); s = must(F.claim(s, f[rnd(f.length)]));
    }
    if (s.match.winner === 2) lost++; if (s.match.winner === 1) won++;
  }
  ok(lost >= 180, "random play lost only " + lost + " of 200"); ok(won <= 5, "random play won " + won);
});
t("Hard never walks into your Erase: from a position it can hold against the Erase, it holds it", () => {
  // after you open 5 holding an Erase, the computer's reply keeps the best value it can get against the Erase
  for (let seed = 1; seed <= 20; seed++) {
    const s = at(B([5], []), 2, "hard", { seed }); s.power.erase = 1;
    const vals = F.free(s.owner).map(n => { const o = s.owner.slice(); o[n - 1] = 2; return -F.solve(o, 1, 1); });
    const a = F.cpuTurn(s).actions[0], o = s.owner.slice(); o[a.n - 1] = 2;
    ok(-F.solve(o, 1, 1) === Math.max(...vals) || F.solve(o, 1, 0) === 0, "seed " + seed);
  }
});

// ---- R2 property and reward bookkeeping ----
const total = (st) => Object.keys(st).reduce((a, k) => a + st[k], 0);
t("R2 property: random play mixing power-ups and claims never raises a side's stock in a powered round", () => {
  let checked = 0, paid = 0;
  for (let seed = 1; seed <= 1500; seed++) {
    let s = F.newMatch(seed, F.DIFFS[seed % 3]);
    s.power = { undo: 2, erase: 2, peek: 1, double: 2 }; s.cpuPower = { undo: 0, erase: 1, peek: 0, double: 1 };
    let r = seed * 40503, guard = 0;
    const rnd = (n) => { r = (r * 1103515245 + 12345) >>> 0; return (r >>> 8) % n; };
    while (!s.match && guard++ < 400) {
      if (s.result) { s = F.nextRound(s); continue; }
      const side = s.turn, before = total(side === 1 ? s.power : s.cpuPower), pre = s.powered[side];
      let next;
      if (side === 2) next = F.cpuTurn(s).state;
      else {
        const p = ["claim", "claim", "erase", "double", "peek", "undo"][rnd(6)];
        if (p === "erase" && F.canUse(s, "erase", 1)) { const h = F.held(s.owner, 2); next = must(F.use(s, "erase", h[rnd(h.length)])); }
        else if (p !== "claim" && p !== "erase" && F.canUse(s, p, 1)) next = must(F.use(s, p));
        else { const f = F.free(s.owner).filter(n => n !== s.blocked); next = must(F.claim(s, f[rnd(f.length)])); }
      }
      const after = total(side === 1 ? next.power : next.cpuPower);
      // a power-up use never raises the stock (Undo only rewinds), and a powered round never pays
      if (next.powered[side] || pre || (next.result && next.result.why === "powered")) { checked++; ok(after <= before, "seed " + seed + ": stock rose in a powered round " + before + " -> " + after); }
      if (next.result && next.result.earned) { paid++; ok(!next.powered[next.result.winner], "a powered winner was paid"); }
      s = next;
    }
  }
  ok(checked > 2000 && paid > 100, "coverage: powered steps " + checked + ", paid rounds " + paid);
});
t("the round that decides the match pays nothing (a new match starts a fresh stock)", () => {
  let s = F.newMatch(1, "medium"); s.wins = [0, 2, 0]; s.rounds = [1, 1]; s.round = 3; s.owner = B([2, 6], [1, 3]);
  s = must(F.claim(s, 7)); ok(s.match); eq(s.result.earned, null); eq(s.result.why, "match");
});
t("R15: a reward skipped because every slot is full says so", () => {
  let s = at(B([2, 6], [1, 3]), 1, "medium"); s.power = { undo: 9, erase: 9, peek: 9, double: 9 };
  s = must(F.claim(s, 7)); eq(s.result.earned, null); eq(s.result.why, "full");
  let c = must(F.claim(at(B([2, 6], [1, 3]), 1, "medium"), 7)); eq(c.result.why, null); ok(c.result.earned);
});

// ---- best of five ----
t("starting side alternates each round", () => {
  let s = F.newMatch(9, "hard"), starters = [];
  while (!s.match) {
    starters.push(s.starter); eq(s.turn, s.starter);
    while (!s.result) s = s.turn === 2 ? F.cpuTurn(s).state : must(F.claim(s, F.bestMoves(s.owner, 1)[0]));
    s = F.nextRound(s);
  }
  eq(starters, [1, 2, 1, 2, 1]);
  eq(s.wins, [5, 0, 0], "perfect against perfect draws every round"); eq(s.match.winner, 0);
});
t("best of five: the match ends early once a side cannot be caught, and scores add up", () => {
  let s = F.newMatch(1, "medium");
  s.wins = [0, 2, 0]; s.rounds = [1, 1]; s.round = 3; s.owner = B([2, 6], [1, 3]);
  s = must(F.claim(s, 7)); eq(s.wins, [0, 3, 0]); eq(s.match, { winner: 1 }, "3-0 with two to play is decided");
  ok(F.nextRound(s) === s, "no round after the match");
  let d = F.newMatch(1, "medium"); d.wins = [2, 1, 1]; d.rounds = [0, 1, 2, 0]; d.round = 5; d.owner = B([1, 2, 4, 7], [3, 5, 6, 9]);
  d = must(F.claim(d, 8)); eq(d.match, { winner: 0 }, "level after five is a drawn match");
  let c = F.newMatch(1, "medium"); c.wins = [1, 1, 1]; c.rounds = [0, 1, 2]; c.round = 4; c.owner = B([1, 2, 4, 7], [3, 5, 6, 9]);
  c = must(F.claim(c, 8)); eq(c.match, null, "1-1 with one to play is open");
});
t("deterministic: same seed and inputs give the same match", () => {
  const run = () => { let s = F.newMatch(77, "easy"); const log = []; while (!s.match) { if (s.result) { s = F.nextRound(s); continue; }
    if (s.turn === 2) { const r = F.cpuTurn(s); log.push(r.actions); s = r.state; } else s = must(F.claim(s, F.free(s.owner)[0])); } return JSON.stringify([log, s.wins]); };
  eq(run(), run());
});
t("valid() rejects broken saves", () => {
  ok(F.valid(F.newMatch(1, "easy"))); ok(!F.valid(null)); ok(!F.valid({}));
  const s = F.newMatch(1, "easy"); s.owner = B([2, 6, 7], [1, 5, 9]); ok(!F.valid(s), "both at 15");
  const b = F.newMatch(1, "easy"); b.diff = "nightmare"; ok(!F.valid(b));
});

require("./conventions")(t, ok, ["fifteen/engine.js", "fifteen/game.js", "fifteen/index.html", "fifteen/style.css"]);
console.log(pass + " passed, " + fail + " failed"); process.exit(fail ? 1 : 0);
