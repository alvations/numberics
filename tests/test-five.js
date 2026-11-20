/* SPDX-License-Identifier: Apache-2.0 | Copyright 2026 alvations (Melon Lab)
 * `node tests/test-five.js` */
"use strict";
const fs = require("fs"), path = require("path");
const F = require("../five/engine.js");
let pass = 0, fail = 0;
function t(n, f) { try { f(); pass++; } catch (e) { fail++; console.log("FAIL", n, "\n  ", e.message); } }
function ok(c, m) { if (!c) throw new Error(m || "assertion failed"); }
function eq(a, b, m) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || "") + " got " + JSON.stringify(a) + " want " + JSON.stringify(b)); }
const at = (tiles, turn, level, extra) => Object.assign(F.newMatch(7, level || "medium"), { tiles: tiles.slice(), turn: turn || "p" }, extra || {});
function playRound(s, levels) { // levels: {p, c}; returns the finished state
  let g = 0;
  while (!s.roundOver && g++ < 400) s = F.aiTurn(s, levels[s.turn]).state;
  return s;
}

function playMatch(seed, level, bot) { // the computer at `level` against a player bot; returns the finished state
  let s = F.newMatch(seed, level), g = 0;
  while (!s.matchOver && g++ < 3000) s = s.roundOver ? F.nextRound(s) : F.aiTurn(s, s.turn === "c" ? level : bot).state;
  return s;
}
const ALL = []; // every live position, as [a, b, c, d] in board order
for (let k = 0; k < 625; k++) {
  const t4 = [Math.floor(k / 125), Math.floor(k / 25) % 5, Math.floor(k / 5) % 5, k % 5];
  if ((t4[0] || t4[1]) && (t4[2] || t4[3])) ALL.push(t4);
}

// ---- rules ----
t("a new match: four tiles at 1, the computer opens, one Undo, best of five", () => {
  const s = F.newMatch(1, "easy");
  eq(s.tiles, [1, 1, 1, 1]); eq(s.turn, "c"); eq(s.starter, "c"); eq(s.power.p, { undo: 1, split: 0, shield: 0, nudge: 0 });
  eq(s.power.c, { undo: 0, split: 0, shield: 0, nudge: 0 }); eq(F.ROUNDS_TO_WIN, 3);
});
t("a move adds the source value onto the target; the source keeps its value", () => {
  const r = F.play(at([3, 1, 1, 2], "p"), 0, 3);
  ok(r.ok); eq(r.state.tiles, [3, 1, 1, 0 + 5 >= 5 ? 0 : 5]);
  const q = F.play(at([2, 1, 1, 1], "p"), 0, 2); eq(q.state.tiles, [2, 1, 3, 1]); eq(q.state.turn, "c");
});
t("adding onto your own other tile is legal and can burst it", () => {
  eq(F.play(at([2, 1, 1, 1], "p"), 0, 1).state.tiles, [2, 3, 1, 1]);
  eq(F.play(at([3, 2, 1, 1], "p"), 0, 1).state.tiles, [3, 0, 1, 1]);
});
t("a tile bursts at 5 or more (4+4 = 8 bursts too), and stays burst", () => {
  eq(F.play(at([4, 1, 4, 1], "p"), 0, 2).state.tiles, [4, 1, 0, 1]);
  eq(F.play(at([4, 1, 1, 1], "p"), 0, 2).state.tiles, [4, 1, 0, 1]);
  eq(F.play(at([3, 1, 1, 1], "p"), 0, 2).state.tiles, [3, 1, 4, 1]);
});
t("illegal moves are refused: dead source, dead target, the same tile, the other side's tile as source, wrong turn", () => {
  const s = at([0, 2, 0, 1], "p");
  ok(!F.play(s, 0, 3).ok); ok(!F.play(s, 1, 2).ok); ok(!F.play(s, 1, 1).ok); ok(!F.play(s, 3, 1).ok);
  ok(!F.play(at([1, 1, 1, 1], "c"), 0, 2).ok); ok(F.play(s, 1, 3).ok);
});
t("the last side with a live tile wins the round", () => {
  const r = F.play(at([1, 0, 0, 4], "p"), 0, 3);
  eq(r.state.roundOver, "p"); eq(r.state.wins, { p: 1, c: 0 }); eq(F.legalMoves(r.state), []);
});
t("first to three rounds takes the match; nextRound resets tiles and keeps the opener", () => {
  let s = at([1, 0, 0, 4], "p", "medium", { wins: { p: 2, c: 1 } });
  s = F.play(s, 0, 3).state; eq(s.matchOver, "p");
  let u = F.play(at([1, 0, 0, 4], "p"), 0, 3).state; u = F.nextRound(u);
  eq(u.tiles, [1, 1, 1, 1]); eq(u.turn, "c"); eq(u.round, 2); eq(u.roundOver, null); eq(u.prev, null);
});

// ---- the solve ----
t("solve: every position labelled, no draws without power-ups", () => {
  const T = F.solve();
  eq(T.counts, { win: 432, lose: 144, draw: 0 });
  ok(F.reachable() > 400, "reachable " + F.reachable());
});
t("solve: the opener loses from 1 1 1 1 against perfect play, in 8 turns", () => {
  eq(F.lookup([1, 1, 1, 1], "c"), { result: "lose", dist: 8 });
  eq(F.lookup([1, 1, 1, 1], "p"), { result: "lose", dist: 8 });
});
t("solve: known small positions", () => {
  eq(F.lookup([1, 0, 0, 4], "p"), { result: "win", dist: 1 });     // 1 onto 4 bursts the last tile
  eq(F.lookup([1, 0, 0, 1], "p"), { result: "win", dist: 3 });      // 1 -> their 2, they make you 3, your 3 bursts their 2
  eq(F.lookup([2, 0, 0, 2], "p"), { result: "lose", dist: 2 });     // 2 -> their 4, their 4 bursts your 2
  eq(F.lookup([4, 0, 0, 1], "p"), { result: "win", dist: 1 });
  eq(F.lookup([0, 0, 1, 1], "p"), { result: "lose", dist: 0 });
});
t("solve agrees with a brute-force minimax on every position", () => {
  const memo = {};
  function mm(t4) { // mover's view; true if the mover wins
    const k = t4.join(""); if (k in memo) return memo[k];
    if (!t4[0] && !t4[1]) return (memo[k] = false);
    let win = false;
    for (let i = 0; i < 2 && !win; i++) if (t4[i]) for (let j = 0; j < 4 && !win; j++) if (j !== i && t4[j]) {
      const n = t4.slice(); n[j] += t4[i]; if (n[j] >= 5) n[j] = 0;
      if (!n[2] && !n[3]) win = true; else if (!mm([n[2], n[3], n[0], n[1]])) win = true;
    }
    return (memo[k] = win);
  }
  for (let k = 0; k < 625; k++) {
    const t4 = [Math.floor(k / 125), Math.floor(k / 25) % 5, Math.floor(k / 5) % 5, k % 5];
    if ((!t4[0] && !t4[1]) || (!t4[2] && !t4[3])) continue;
    eq(F.lookup(t4, "p").result === "win", mm(t4), "position " + t4.join(""));
  }
});

// ---- the computer ----
t("Hard never loses from a position the table marks as a win (vs random, easy and medium)", () => {
  let n = 0;
  for (let k = 0; k < 625; k++) {
    const t4 = [Math.floor(k / 125), Math.floor(k / 25) % 5, Math.floor(k / 5) % 5, k % 5];
    if ((!t4[0] && !t4[1]) || (!t4[2] && !t4[3])) continue;
    if (F.lookup(t4, "c").result !== "win") continue;
    for (const opp of ["random", "easy", "medium"]) for (const seed of [1, 2]) {
      const s = Object.assign(F.newMatch(seed * 1000 + k, "easy"), { tiles: t4.slice(), turn: "c" });
      eq(playRound(s, { c: "hard", p: opp }).roundOver, "c", "lost " + t4 + " vs " + opp); n++;
    }
  }
  ok(n > 1000, "checked " + n);
});
t("Hard as the second seat wins every round from the start (power-up free)", () => {
  for (let seed = 1; seed <= 200; seed++) {
    const s = Object.assign(F.newMatch(seed, "easy"), { turn: "c" });
    eq(playRound(s, { c: "random", p: "hard" }).roundOver, "p", "seed " + seed);
  }
});
t("Medium takes a win in one when it has one", () => {
  for (let seed = 0; seed < 40; seed++) eq(F.aiTurn(Object.assign(at([0, 2, 1, 4], "c"), { seed }), "medium").state.roundOver, "c"); // 4 onto 2 = 6 bursts it
});
t("measured: stronger levels beat a random player more often", () => {
  const rate = (lv) => { let w = 0; for (let i = 0; i < 400; i++) { const s = F.newMatch(i * 7919 + 1, lv === "hard" ? "hard" : "easy"); if (playRound(s, { c: lv, p: "random" }).roundOver === "c") w++; } return w / 400; };
  const r = { easy: rate("easy"), medium: rate("medium"), hard: rate("hard") };
  ok(r.easy > 0.5 && r.medium > r.easy && r.hard > r.medium && r.hard > 0.9, JSON.stringify(r));
});
t("R4: perfect play by the player wins every match on every level, 3-0, with no power-ups", () => {
  for (const lv of F.LEVELS) for (let seed = 1; seed <= 150; seed++) {
    const s = playMatch(seed * 31 + 7, lv, "hard");
    eq(s.matchOver, "p", lv + " seed " + seed); eq(s.wins, { p: 3, c: 0 }, lv + " seed " + seed); eq(s.draws, 0);
  }
});
t("R4: the computer never plays a power-up on any level, even holding a full stock (an old save)", () => {
  const full = () => ({ undo: 9, split: 9, shield: 9, nudge: 9 });
  for (const lv of F.LEVELS) for (const t4 of ALL) {
    const s = Object.assign(F.newMatch(t4.join("") * 1, lv), { tiles: t4.slice(), turn: "c" }); s.power.c = full();
    const r = F.aiPlan(s);
    ok(r.plan.length === 1 && (r.plan[0].type === "move" || r.plan[0].type === "pass"), lv + " " + t4 + " " + JSON.stringify(r.plan));
    for (const name of ["split", "shield", "nudge"]) for (let i = 0; i < 4; i++) ok(!F.canUse(s, name, i, 1) && !F.use(s, name, i, 1).ok, "computer " + name);
  }
});
t("R4: the computer never earns a power-up, on any level", () => {
  for (const lv of F.LEVELS) for (let seed = 0; seed < 30; seed++) {
    const r = F.play(Object.assign(at([1, 2, 4, 1], "c", lv), { seed }), 2, 1);
    ok(r.burst && !r.awarded, lv); eq(r.state.power.c, { undo: 0, split: 0, shield: 0, nudge: 0 });
    let m = playMatch(seed + 99, lv, "random"); eq(m.power.c, { undo: 0, split: 0, shield: 0, nudge: 0 }, lv + " match");
  }
});
t("aiPlan never touches the given state; the advanced seed comes back in a copy", () => {
  const s = F.newMatch(5, "easy"), before = JSON.stringify(s), r = F.aiPlan(s);
  eq(JSON.stringify(s), before); ok(r.state && r.state !== s && r.state.seed === r.seed && r.seed !== s.seed);
  eq(F.apply(r.state, r.plan[0]).ok, true);
});
t("Easy takes a win in one when it has one, but does not always look for the player's reply", () => {
  for (let seed = 0; seed < 40; seed++) eq(F.aiTurn(Object.assign(at([0, 2, 1, 4], "c", "easy"), { seed }), "easy").state.roundOver, "c");
  let blunders = 0, chances = 0;
  for (const t4 of ALL) {
    const s = Object.assign(F.newMatch(t4.join("") * 3, "easy"), { tiles: t4.slice(), turn: "c" });
    const ms = F.legalMoves(s), handsWin = (m) => { const r = F.play(s, m.from, m.to).state; return !r.roundOver && F.legalMoves(r).some(x => F.play(r, x.from, x.to).state.roundOver === "p"); };
    if (!ms.some(handsWin) || ms.every(handsWin) || ms.some(m => F.play(s, m.from, m.to).state.roundOver === "c")) continue;
    chances++; const m = F.aiPlan(s).plan[0]; if (handsWin(m)) blunders++;
  }
  ok(chances > 50 && blunders / chances > 0.15 && blunders / chances < 0.8, blunders + "/" + chances);
});
t("Hard from a lost position sets a trap: it beats a greedy player every time and a random one almost always", () => {
  let gw = 0, rw = 0, rr = 0;
  for (let i = 0; i < 200; i++) {
    if (playMatch(i * 7919 + 13, "hard", "greedy").matchOver === "p") gw++;
    const m = playMatch(i * 7919 + 13, "hard", "random"); rw += m.wins.p; rr += m.wins.p + m.wins.c;
  }
  ok(gw <= 4, "greedy won " + gw + "/200"); ok(rw / rr < 0.08, "random rounds " + rw + "/" + rr);
});
t("measured: a greedy player wins most Easy matches and about a third of Medium; each level is harder than the one below", () => {
  const N = 400, rate = (lv, bot) => { let w = 0, r = 0, all = 0; for (let i = 0; i < N; i++) { const s = playMatch(i * 7919 + 13, lv, bot); if (s.matchOver === "p") w++; r += s.wins.p; all += s.wins.p + s.wins.c; } return { match: w / N, round: r / all }; };
  const g = { easy: rate("easy", "greedy"), medium: rate("medium", "greedy"), hard: rate("hard", "greedy") };
  ok(g.easy.match >= 0.75, "greedy vs easy " + JSON.stringify(g)); ok(g.medium.match < g.easy.match && g.hard.match <= g.medium.match, JSON.stringify(g));
  ok(g.medium.match >= 0.28 && g.medium.match <= 0.42, "greedy vs medium (the default) about 30-40% " + JSON.stringify(g.medium));
  const m = { easy: rate("easy", "lookahead"), medium: rate("medium", "lookahead"), hard: rate("hard", "lookahead") };
  ok(m.easy.round > m.medium.round && m.medium.round > m.hard.round && m.hard.round > 0.05, "lookahead bot " + JSON.stringify(m));
  ok(m.medium.match > g.medium.match + 0.3, "a stronger player wins Medium clearly more often " + JSON.stringify([m.medium, g.medium]));
});
t("deterministic: same seed, same match", () => {
  const run = () => { let s = F.newMatch(42, "hard"); for (let i = 0; i < 3; i++) { s = playRound(s, { c: "hard", p: "random" }); s = F.nextRound(s); } return JSON.stringify(s); };
  eq(run(), run());
});

// ---- power-ups ----
t("bursting a computer tile earns the player one power-up; bursting your own does not", () => {
  const r = F.play(at([4, 1, 2, 1], "p"), 0, 2); ok(r.burst && r.awarded, "awarded"); ok(F.POWERS.includes(r.awarded));
  const total = (p) => p.undo + p.split + p.shield + p.nudge;
  eq(total(r.state.power.p), 2);
  const q = F.play(at([4, 1, 2, 1], "p"), 0, 1); ok(q.burst && !q.awarded); eq(total(q.state.power.p), 1);
});
t("stock caps at 9", () => {
  const s = at([4, 1, 2, 1], "p", "medium", { power: { p: { undo: 9, split: 9, shield: 9, nudge: 9 }, c: { undo: 0, split: 0, shield: 0, nudge: 0 } } });
  const r = F.play(s, 0, 2); eq(r.awarded, null); eq(r.state.power.p, { undo: 9, split: 9, shield: 9, nudge: 9 });
});
t("Undo takes back your turn and the computer's reply, restores the stock, and costs one Undo", () => {
  let s = at([4, 1, 2, 1], "p");
  s = F.play(s, 0, 2).state;               // burst, earns one
  s = F.aiTurn(s, "medium").state;          // computer replies
  ok(F.canUse(s, "undo"));
  const u = F.use(s, "undo"); ok(u.ok);
  eq(u.state.tiles, [4, 1, 2, 1]); eq(u.state.turn, "p"); eq(u.state.power.p, { undo: 0, split: 0, shield: 0, nudge: 0 });
  ok(!F.canUse(u.state, "undo"), "no second rewind without a snapshot");
});
t("Undo cannot farm: replaying the same burst after a rewind earns no more than once", () => {
  let s = at([4, 1, 2, 1], "p", "medium", { power: { p: { undo: 5, split: 0, shield: 0, nudge: 0 }, c: { undo: 0, split: 0, shield: 0, nudge: 0 } } });
  for (let i = 0; i < 4; i++) { s = F.play(s, 0, 2).state; s = F.use(s, "undo").state; }
  eq(s.power.p.undo, 1); eq(s.power.p.split + s.power.p.shield + s.power.p.nudge, 0);
});
t("Split moves one point onto your other tile, uses the turn, can revive a burst tile, never a no-op", () => {
  const pw = { p: { undo: 0, split: 3, shield: 0, nudge: 0 }, c: { undo: 0, split: 0, shield: 0, nudge: 0 } };
  const r = F.use(at([3, 1, 2, 2], "p", "medium", { power: pw }), "split", 0); ok(r.ok);
  eq(r.state.tiles, [2, 2, 2, 2]); eq(r.state.turn, "c"); eq(r.state.power.p.split, 2);
  eq(F.use(at([2, 0, 2, 2], "p", "medium", { power: pw }), "split", 0).state.tiles, [1, 1, 2, 2]);
  ok(!F.use(at([3, 2, 2, 2], "p", "medium", { power: pw }), "split", 0).ok, "3,2 -> 2,3 is a no-op");
  ok(!F.use(at([1, 4, 2, 2], "p", "medium", { power: pw }), "split", 0).ok, "cannot push a tile to 5");
  ok(!F.use(at([1, 1, 2, 2], "p", "medium", { power: pw }), "split", 2).ok, "not the other side's tile");
  ok(!F.use(at([3, 1, 2, 2], "p"), "split", 0).ok, "needs stock");
});
t("Shield: the guarded tile cannot be hit on the next turn, you still move, and it lapses after the reply", () => {
  const pw = { p: { undo: 0, split: 0, shield: 1, nudge: 0 }, c: { undo: 0, split: 0, shield: 0, nudge: 0 } };
  let s = at([1, 4, 2, 2], "p", "medium", { power: pw });
  const r = F.use(s, "shield", 1); ok(r.ok); s = r.state;
  eq(s.turn, "p"); ok(s.midTurn); ok(!F.canUse(s, "shield", 0));
  s = F.play(s, 0, 2).state; eq(s.turn, "c");
  ok(F.legalMoves(s).every(m => m.to !== 1), "computer cannot target the shielded tile");
  ok(!F.play(s, 2, 1).ok);
  s = F.play(s, 2, 0).state; eq(s.shield, null);
});
t("Shield on your last tile with the computer down to one tile: the computer must pass", () => {
  const pw = { p: { undo: 0, split: 0, shield: 1, nudge: 0 }, c: { undo: 0, split: 0, shield: 0, nudge: 0 } };
  let s = at([2, 0, 1, 1], "p", "medium", { power: pw });
  s = F.use(s, "shield", 0).state; s = F.play(s, 0, 2).state; // 1+2 = 3, computer keeps 3 and 1
  ok(!F.mustPass(s)); // the computer can still add onto its own tile
  let q = at([2, 0, 0, 1], "p", "medium", { power: pw });
  q = F.use(q, "shield", 0).state; q = F.play(q, 0, 3).state; // 1+2 = 3
  ok(F.mustPass(q)); const pq = F.pass(q); ok(pq.ok); eq(pq.state.turn, "p");
  eq(F.aiPlan(q, "hard").plan, [{ type: "pass" }]);
});
t("Nudge: +1 on their tile (a 4 bursts and does not earn), -1 on yours, never below 1", () => {
  const pw = () => ({ p: { undo: 0, split: 0, shield: 0, nudge: 2 }, c: { undo: 0, split: 0, shield: 0, nudge: 0 } });
  let r = F.use(at([1, 1, 4, 1], "p", "medium", { power: pw() }), "nudge", 2);
  ok(r.ok && r.burst); eq(r.state.tiles, [1, 1, 0, 1]); eq(r.state.power.p, { undo: 0, split: 0, shield: 0, nudge: 1 });
  r = F.use(at([3, 1, 4, 1], "p", "medium", { power: pw() }), "nudge", 0); eq(r.state.tiles, [2, 1, 4, 1]);
  r = F.use(at([1, 1, 4, 1], "p", "medium", { power: pw() }), "nudge", 0); eq(r.state.tiles, [2, 1, 4, 1], "a 1 can only go up");
  ok(!F.use(at([1, 1, 4, 1], "p", "medium", { power: pw() }), "nudge", 0, -1).ok);
  ok(!F.use(at([1, 1, 0, 1], "p", "medium", { power: pw() }), "nudge", 2).ok, "not a burst tile");
  eq(F.use(at([1, 1, 0, 4], "p", "medium", { power: pw() }), "nudge", 3).state.roundOver, "p");
});
t("R4: the burst that ends the match earns nothing (the stock would be thrown away)", () => {
  const r = F.play(at([4, 0, 0, 1], "p", "medium", { wins: { p: 2, c: 0 } }), 0, 3);
  ok(r.burst && r.state.matchOver === "p" && !r.awarded); eq(r.state.power.p, { undo: 1, split: 0, shield: 0, nudge: 0 });
  const k = F.play(at([4, 0, 0, 1], "p"), 0, 3); ok(k.state.roundOver === "p" && !k.state.matchOver && k.awarded, "a round win still pays");
});
t("R1: Undo is refused once a round is decided (won, lost, drawn), and after the next round starts", () => {
  const pw = { p: { undo: 5, split: 0, shield: 0, nudge: 0 }, c: { undo: 0, split: 0, shield: 0, nudge: 0 } };
  const won = F.play(at([1, 0, 0, 4], "p", "medium", { power: pw }), 0, 3).state; eq(won.roundOver, "p"); ok(won.prev, "a snapshot exists");
  ok(!F.canUse(won, "undo") && !F.use(won, "undo").ok, "won round");
  let lost = F.play(at([4, 0, 1, 2], "p", "medium", { power: pw }), 0, 2).state; // your 4 bursts their 1; their 2 bursts your 4
  lost = F.aiTurn(lost, "hard").state; eq(lost.roundOver, "c"); ok(lost.prev);
  ok(!F.canUse(lost, "undo") && !F.use(lost, "undo").ok, "lost round");
  let match = F.play(at([4, 0, 1, 2], "p", "medium", { power: pw, wins: { p: 0, c: 2 } }), 0, 2).state;
  match = F.aiTurn(match, "hard").state; eq(match.matchOver, "c"); ok(!F.canUse(match, "undo"), "lost match");
  const drawn = F.play(at([2, 1, 2, 1], "p", "medium", { power: pw, quiet: 39 }), 1, 0).state; eq(drawn.roundOver, "draw");
  ok(!F.canUse(drawn, "undo"), "drawn round");
  ok(!F.canUse(F.nextRound(lost), "undo"), "new round");
});
t("draw rule: a position repeated 3 times draws the round (only the player's power-ups can cycle)", () => {
  // your last tile is shielded and the computer has one tile, so it must pass; Shield + Nudge up and down repeats
  const pw = { p: { undo: 0, split: 0, shield: 9, nudge: 9 }, c: { undo: 0, split: 0, shield: 0, nudge: 0 } };
  let s = at([2, 0, 0, 1], "p", "medium", { power: pw }); s.seen = {}; s.seen[F.key(s)] = 1;
  for (let i = 0; i < 8 && !s.roundOver; i++) {
    if (s.turn === "p") { s = F.use(s, "shield", 0).state; s = F.use(s, "nudge", 0, i % 4 === 0 ? 1 : -1).state; }
    else { ok(F.mustPass(s)); s = F.pass(s).state; }
  }
  eq(s.roundOver, "draw"); eq(s.draws, 1); eq(s.wins, { p: 0, c: 0 });
});
t("draw rule: 40 turns without a burst", () => {
  let s = at([2, 1, 2, 1], "p"); s.quiet = 39;
  s = F.play(s, 1, 0).state; eq(s.roundOver, "draw");
});
t("a round with only normal moves always ends within 16 turns", () => {
  for (let seed = 0; seed < 300; seed++) {
    let s = F.newMatch(seed, "easy"), g = 0;
    while (!s.roundOver) { s = F.aiTurn(s, "random").state; g++; }
    ok(g <= 16 && s.roundOver !== "draw", "turns " + g);
  }
});

// ---- round 2 ----
const tot = (s) => Object.values(s.power.p).reduce((a, b) => a + b, 0);
t("R2: a burst on the move after Shield (same turn) pays nothing; the same burst without Shield pays", () => {
  const stock = { undo: 0, split: 0, shield: 1, nudge: 0 };
  const plain = F.play(at([2, 1, 3, 2], "p", "medium", { power: { p: Object.assign({}, stock), c: { undo: 0, split: 0, shield: 0, nudge: 0 } } }), 0, 2);
  ok(plain.burst && plain.awarded, "an honest burst pays"); eq(tot(plain.state), 2);
  const sh = F.use(at([2, 1, 3, 2], "p", "medium", { power: { p: Object.assign({}, stock), c: { undo: 0, split: 0, shield: 0, nudge: 0 } } }), "shield", 1);
  ok(sh.ok && sh.state.midTurn && tot(sh.state) === 0);
  const m = F.play(sh.state, 0, 2);
  ok(m.ok && m.burst, "the burst still happens"); eq(m.awarded, null, "but pays nothing"); ok(m.unpaid, "and says so"); eq(tot(m.state), 0);
  // the next turn is a fresh turn: an honest burst there pays again
  let s = m.state; while (s.turn === "c" && !s.roundOver) s = F.aiTurn(s, "easy").state;
  ok(!s.midTurn, "the Shield mark lasts one turn");
});
t("R2 property: a power-up and the rest of its turn never raise the total stock (random matches)", () => {
  let checked = 0, shieldMoves = 0;
  for (let seed = 1; seed <= 120; seed++) {
    let s = F.newMatch(seed, F.LEVELS[seed % 3]), x = (seed * 2654435761 >>> 0) || 1;
    s.power.p = { undo: 2, split: 3, shield: 3, nudge: 3 };
    for (let g = 0; g < 400 && !s.matchOver; g++) {
      if (s.roundOver) { s = F.nextRound(s); continue; }
      if (s.turn === "c") { s = F.aiTurn(s).state; continue; }
      x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; // xorshift32
      if (x % 3 === 0) {
        const name = F.POWERS[(x >>> 4) % 4], arg = (x >>> 7) % 4, before = tot(s), u = F.use(s, name, arg);
        if (u.ok) {
          checked++;
          if (name === "undo") ok(tot(u.state) <= tot(s.prev), "undo returns at most the snapshot's stock, seed " + seed);
          else ok(tot(u.state) === before - 1, name + " itself pays nothing, seed " + seed);
          if (name === "undo") { // Undo rewinds to your last turn: a move there pays exactly what it paid from that turn
            F.legalMoves(u.state).forEach(m => { const r = F.play(u.state, m.from, m.to), o = F.play(s.prev, m.from, m.to);
              ok(tot(r.state) <= tot(o.state) && !!r.awarded === !!o.awarded, "move after undo pays as from the snapshot, seed " + seed); });
          } else if (u.state.turn === "p" && !u.state.roundOver) { // Shield: you still move this turn
            F.legalMoves(u.state).forEach(m => { const r = F.play(u.state, m.from, m.to); ok(tot(r.state) < before, "move after " + name + ", seed " + seed); shieldMoves++; });
          }
          s = u.state; continue;
        }
      }
      const ms = F.legalMoves(s);
      s = ms.length ? F.play(s, ms[(x >>> 9) % ms.length].from, ms[(x >>> 9) % ms.length].to).state : F.pass(s).state;
    }
  }
  ok(checked > 300 && shieldMoves > 100, "exercised " + checked + " power-ups, " + shieldMoves + " moves after Shield");
});
t("R12: the match counts as played only once YOU move (the computer's opener is not you), until it is decided", () => {
  let s = F.newMatch(3, "medium"); ok(!F.played(s), "fresh");
  s = F.aiTurn(s).state; ok(s.turn === "p" && !F.played(s), "after the computer's opener");
  const m = F.legalMoves(s)[0]; let p = F.play(s, m.from, m.to).state; ok(F.played(p), "after your move");
  const u = F.use(p, "undo"); ok(u.ok && F.played(u.state), "Undo does not make a played match unplayed");
  const sh = F.use(Object.assign(F.clone ? F.clone(s) : JSON.parse(JSON.stringify(s)), { power: { p: { undo: 0, split: 0, shield: 1, nudge: 0 }, c: s.power.c } }), "shield", 0);
  ok(sh.ok && F.played(sh.state), "a power-up is playing too");
  const pa = F.pass(Object.assign(JSON.parse(JSON.stringify(s)), { tiles: [1, 0, 0, 1], shield: { side: "c", idx: 3 } }));
  ok(pa.ok && F.played(pa.state), "a forced pass is playing too");
  // it carries across rounds and ends with the match
  let r = Object.assign(JSON.parse(JSON.stringify(p)), { tiles: [1, 0, 0, 4], turn: "p" });
  r = F.play(r, 0, 3).state; ok(r.roundOver === "p" && F.played(r)); r = F.nextRound(r); ok(F.played(r), "next round of the same match");
  const done = Object.assign(JSON.parse(JSON.stringify(r)), { matchOver: "p" }); ok(!F.played(done), "a decided match is not live");
  ok(F.played(Object.assign(JSON.parse(JSON.stringify(s)), { touched: undefined, moves: 3 })), "old save past the opener");
  ok(!F.played(Object.assign(JSON.parse(JSON.stringify(s)), { touched: undefined, moves: 1, round: 1 })), "old save at the opener");
});
t("R13: the round-ending move is described on the state (what was added onto what)", () => {
  const r = F.play(at([3, 0, 0, 2], "p"), 0, 3);
  ok(r.state.roundOver === "p"); eq([r.state.last.add, r.state.last.prevTo, r.state.last.value, r.state.last.to], [3, 2, 5, 3]);
  const n = F.use(at([1, 0, 0, 4], "p", "medium", { power: { p: { undo: 0, split: 0, shield: 0, nudge: 1 }, c: { undo: 0, split: 0, shield: 0, nudge: 0 } } }), "nudge", 3);
  ok(n.ok && n.state.roundOver === "p" && n.state.last.prevTo === 4);
});

// ---- UI copy ----
t("the page never says hand or finger", () => {
  for (const f of ["five/index.html", "five/game.js"]) {
    const s = fs.readFileSync(path.join(__dirname, "..", f), "utf8");
    ok(!/\b(hand|hands|finger|fingers)\b/i.test(s), f);
  }
});
t("R5/R17 client: number keys click the tray slot; Enter on a link or button is never a game action", () => {
  const g = fs.readFileSync(path.join(__dirname, "..", "five/game.js"), "utf8");
  ok(/if \(pi >= 0\) return traySlot\(pi\)/.test(g), "keys go through the tray button");
  ok(/closest\("a, button"\)/.test(g), "link and button guard");
});
t("how-to copy: 'at 5 or more' and 'you can always win', no jargon", () => {
  const h = fs.readFileSync(path.join(__dirname, "..", "five/index.html"), "utf8"), how = h.match(/<p class="how">([\s\S]*?)<\/p>/)[1];
  ok(/5 or more bursts/.test(how) && /you can always win/.test(how) && !/seat|solved|perfect play/i.test(how), how);
  ok(/<span>Record<\/span>/.test(h) && !/Matches/.test(h), "R16 pill names");
});
t("client never re-implements a rule (no burst arithmetic in game.js)", () => {
  const g = fs.readFileSync(path.join(__dirname, "..", "five/game.js"), "utf8");
  ok(!/>=\s*5\b|BURST\s*-|tiles\[[^\]]+\]\s*\+=/.test(g));
});

require("./conventions")(t, ok, ["five/engine.js", "five/game.js", "five/index.html", "five/style.css"]);
console.log(pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
