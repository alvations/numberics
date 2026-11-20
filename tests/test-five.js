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
t("Easy never hands over an immediate win when a safe move exists", () => {
  for (let seed = 1; seed <= 300; seed++) {
    let s = Object.assign(F.newMatch(seed, "easy"), { turn: "c" }), g = 0;
    while (!s.roundOver && g++ < 40) {
      if (s.turn === "c") {
        const safe = F.legalMoves(s).filter(m => { const r = F.play(s, m.from, m.to).state; return r.roundOver || !F.legalMoves(r).some(x => F.play(r, x.from, x.to).state.roundOver === "p"); });
        const r = F.aiTurn(s, "easy"); const next = r.state;
        if (safe.length && !next.roundOver) ok(!F.legalMoves(next).some(x => F.play(next, x.from, x.to).state.roundOver === "p"), "easy blundered at " + s.tiles);
        s = next;
      } else s = F.aiTurn(s, "random").state;
    }
  }
});
t("Medium takes a win in one when it has one", () => {
  const s = at([0, 2, 1, 4], "c"); // 4 onto 2 bursts the last player tile? 2+4 = 6 bursts it
  eq(F.aiTurn(s, "medium").state.roundOver, "c");
});
t("measured: stronger levels beat a random player more often", () => {
  const rate = (lv) => { let w = 0; for (let i = 0; i < 400; i++) { const s = F.newMatch(i * 7919 + 1, lv === "hard" ? "hard" : "easy"); if (playRound(s, { c: lv, p: "random" }).roundOver === "c") w++; } return w / 400; };
  const r = { easy: rate("easy"), medium: rate("medium"), hard: rate("hard") };
  ok(r.easy > 0.5 && r.medium > r.easy && r.hard > r.medium && r.hard > 0.9, JSON.stringify(r));
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
t("the computer earns only on Hard, and never an Undo", () => {
  const e = F.play(at([1, 2, 4, 1], "c", "medium"), 2, 1); ok(e.burst && !e.awarded);
  for (let seed = 0; seed < 50; seed++) {
    const h = F.play(Object.assign(at([1, 2, 4, 1], "c", "hard"), { seed }), 2, 1);
    ok(h.awarded && h.awarded !== "undo", "hard award " + h.awarded);
  }
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
t("Hard spends a power-up when it turns a lost position into a win", () => {
  // computer to move on [3, 1, 1, 1]: table says lose; a Nudge +1 on... check Hard finds a winning power play if one exists
  let found = 0;
  for (let k = 0; k < 625; k++) {
    const t4 = [Math.floor(k / 125), Math.floor(k / 25) % 5, Math.floor(k / 5) % 5, k % 5];
    if ((!t4[0] && !t4[1]) || (!t4[2] && !t4[3]) || F.lookup(t4, "c").result !== "lose") continue;
    const s = Object.assign(F.newMatch(k, "hard"), { tiles: t4.slice(), turn: "c" });
    s.power.c = { undo: 0, split: 1, shield: 1, nudge: 1 };
    const plan = F.aiPlan(s).plan;
    if (plan[0].type === "power") found++;
    const free = Object.assign(F.newMatch(k, "hard"), { tiles: t4.slice(), turn: "c" });
    ok(F.aiPlan(free).plan[0].type !== "power");
  }
  ok(found > 20, "power plays " + found);
  // and never wastes one when a free move already wins
  const w = Object.assign(F.newMatch(3, "hard"), { tiles: [0, 1, 4, 0], turn: "c" }); w.power.c = { undo: 0, split: 2, shield: 2, nudge: 2 };
  eq(F.aiPlan(w).plan[0].type, "move");
});
t("draw rule: a position repeated 3 times draws the round (only power-up play can cycle)", () => {
  const pw = { p: { undo: 0, split: 9, shield: 0, nudge: 0 }, c: { undo: 0, split: 9, shield: 0, nudge: 0 } };
  let s = at([3, 1, 3, 1], "p", "medium", { power: JSON.parse(JSON.stringify(pw)) }); s.seen = {}; s.seen[F.key(s)] = 1;
  const seq = [["p", 0], ["c", 2], ["p", 1], ["c", 3]]; // 31 31 -> 22 31 -> 22 22 -> 31 22 -> 31 31
  for (let i = 0; i < 8 && !s.roundOver; i++) { const [, a] = seq[i % 4]; s = F.use(s, "split", a).state; }
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

// ---- UI copy ----
t("the page never says hand or finger", () => {
  for (const f of ["five/index.html", "five/game.js"]) {
    const s = fs.readFileSync(path.join(__dirname, "..", f), "utf8");
    ok(!/\b(hand|hands|finger|fingers)\b/i.test(s), f);
  }
});
t("client never re-implements a rule (no burst arithmetic in game.js)", () => {
  const g = fs.readFileSync(path.join(__dirname, "..", "five/game.js"), "utf8");
  ok(!/>=\s*5\b|BURST\s*-|tiles\[[^\]]+\]\s*\+=/.test(g));
});

require("./conventions")(t, ok, ["five/engine.js", "five/game.js", "five/index.html", "five/style.css"]);
console.log(pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
