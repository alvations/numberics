/* SPDX-License-Identifier: Apache-2.0 | Copyright 2026 alvations (Melon Lab)
 * `node tests/test-nine.js` */
"use strict";
const N = require("../nine/engine.js");
let pass = 0, fail = 0;
function t(n, f) { try { f(); pass++; } catch (e) { fail++; console.log("FAIL", n, "\n  ", e.message); } }
function ok(c, m) { if (!c) throw new Error(m || "assertion failed"); }
function eq(a, b, m) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || "") + " got " + JSON.stringify(a) + " want " + JSON.stringify(b)); }
const SEEDS = Array.from({ length: 60 }, (_, i) => i * 7919 + 3);
const sum = (h) => h.reduce((a, b) => a + b, 0);

// Brute-force game-theory oracle (memoised), independent of the nim-sum shortcut.
function oracle(misere) {
  const memo = new Map();
  const win = (h) => {
    const k = h.slice().sort().join(",");
    if (memo.has(k)) return memo.get(k);
    let r;
    if (sum(h) === 0) r = !!misere;            // the previous player took last
    else {
      r = false;
      for (let i = 0; i < h.length && !r; i++) for (let to = 0; to < h[i] && !r; to++) {
        const n = h.slice(); n[i] = to; if (!win(n)) r = true;
      }
    }
    memo.set(k, r); return r;
  };
  return win;
}
function* positions(n, max) {
  const h = new Array(n).fill(0);
  while (true) {
    yield h.slice();
    let i = 0; while (i < n && h[i] === max) { h[i] = 0; i++; }
    if (i === n) return; h[i]++;
  }
}
// Force a state: heaps, turn, and stock.
function forge(o) {
  const s = N.newGame(o.seed || 1, { diff: o.diff || "hard", misere: !!o.misere, level: o.heaps.length });
  s.heaps = o.heaps.slice(); s.turn = o.turn || "you";
  if (o.you) Object.assign(s.power.you, o.you);
  if (o.cpu) Object.assign(s.power.cpu, o.cpu);
  return s;
}
// Play a whole round with two move functions; returns the round winner.
function playRound(s, youMove, cpu) {
  for (let k = 0; k < 400 && !s.roundOver; k++) {
    if (s.turn === "you") { const m = youMove(s); const r = N.take(s, m.tile, s.heaps[m.tile] - m.to); ok(r.ok, "player move illegal"); s = r.state; }
    else s = cpu(s);
  }
  ok(s.roundOver, "round did not end"); return s;
}
const perfect = (s) => N.peek(s.heaps, s.misere) || N.legalMoves(s.heaps)[0];

t("winning() agrees with brute force, normal and misere (up to 4 tiles of 0..6)", () => {
  for (const mis of [false, true]) {
    const w = oracle(mis);
    for (const n of [1, 2, 3, 4]) for (const h of positions(n, 6)) eq(N.winning(h, mis), w(h), (mis ? "misere " : "") + h);
  }
});
t("nim-sum is the XOR of the tiles", () => { eq(N.nimSum([1, 2, 3]), 0); eq(N.nimSum([7, 5, 9]), 7 ^ 5 ^ 9); eq(N.nimSum([]), 0); });
t("legal moves: every tile, every amount from 1 to its value, nothing else", () => {
  const m = N.legalMoves([3, 0, 2]);
  eq(m.length, 5); ok(m.every(x => x.to >= 0 && x.to < [3, 0, 2][x.tile]));
  ok(!m.some(x => x.tile === 1), "an empty tile has no moves");
});
t("take refuses illegal moves (zero, too many, empty tile, bad index, after round end)", () => {
  const s = forge({ heaps: [3, 0, 5] });
  for (const [i, a] of [[0, 0], [0, 4], [1, 1], [5, 1], [-1, 1], [0, 1.5], [0, -1]]) { const r = N.take(s, i, a); ok(!r.ok && r.state === s, i + "," + a); }
  const end = N.take(forge({ heaps: [1, 0, 0] }), 0, 1).state; ok(end.roundOver);
  ok(!N.take(end, 0, 1).ok);
});
t("take lowers one tile, a tile at 0 is gone, the turn passes", () => {
  const s = N.take(forge({ heaps: [4, 2, 7] }), 2, 7).state;
  eq(s.heaps, [4, 2, 0]); eq(s.turn, "cpu"); eq(s.last, { who: "you", kind: "take", tile: 2, from: 7, to: 0, added: false });
});
t("normal play: the last take wins the round", () => {
  const s = N.take(forge({ heaps: [0, 5, 0] }), 1, 5).state; eq(s.roundOver, "you"); eq(s.score, { you: 1, cpu: 0 });
  const c = N.take(forge({ heaps: [0, 2, 0], turn: "cpu" }), 1, 2).state; eq(c.roundOver, "cpu");
});
t("misere: the last take loses the round", () => {
  const s = N.take(forge({ heaps: [0, 1, 0], misere: true }), 1, 1).state; eq(s.roundOver, "cpu"); eq(s.score, { you: 0, cpu: 1 });
  const c = N.take(forge({ heaps: [1, 0, 0], misere: true, turn: "cpu" }), 0, 1).state; eq(c.roundOver, "you");
});
t("Easy and Medium starts are always a win for the player, who always moves first (normal and misere, 3..9 tiles)", () => {
  for (const diff of ["easy", "medium"]) for (const mis of [false, true]) for (let lv = 3; lv <= 9; lv++) for (const seed of SEEDS) {
    const s = N.newGame(seed, { diff, level: lv, misere: mis });
    eq(s.heaps.length, lv); eq(s.turn, "you");
    ok(s.heaps.every(v => v >= 1 && v <= 9), "tile out of 1..9 " + s.heaps);
    ok(N.winning(s.heaps, mis), "losing deal " + s.heaps);
    if (!mis) ok(N.nimSum(s.heaps) !== 0, "zero nim-sum deal");
  }
});
t("Hard deals at random: about one start in five is a losing position, every tile 1..9, the player moves first", () => {
  for (const mis of [false, true]) {
    let lost = 0, n = 0;
    for (let lv = 3; lv <= 9; lv++) for (let i = 0; i < 200; i++) {
      let s = N.newGame(i * 7919 + lv, { diff: "hard", level: lv, misere: mis });
      eq(s.turn, "you"); ok(s.heaps.length === lv && s.heaps.every(v => v >= 1 && v <= 9), "bad deal " + s.heaps);
      n++; if (!N.winning(s.heaps, mis)) lost++;
      // later rounds deal the same way
      s.roundOver = "you"; s = N.nextRound(s); n++; if (!N.winning(s.heaps, mis)) lost++;
    }
    const rate = lost / n;
    ok(rate > 0.15 && rate < 0.25, (mis ? "misere " : "") + "losing-start rate " + rate.toFixed(3));
  }
  eq(N.HARD_LOSING, 0.2);
});
t("deterministic: same seed same deal; different seeds differ", () => {
  eq(N.newGame(5, { level: 6 }).heaps, N.newGame(5, { level: 6 }).heaps);
  ok(SEEDS.some(x => JSON.stringify(N.newGame(x, { level: 6 }).heaps) !== JSON.stringify(N.newGame(5, { level: 6 }).heaps)));
});
t("peek returns a move to a zero nim-sum in normal play, and null from a zero nim-sum", () => {
  for (const h of positions(3, 9)) {
    if (!sum(h)) continue;
    const m = N.peek(h, false);
    if (N.nimSum(h) === 0) eq(m, null, String(h));
    else { const a = h.slice(); a[m.tile] = m.to; eq(N.nimSum(a), 0, String(h)); ok(m.to < h[m.tile]); }
  }
});
t("peek is misere-correct: its move always leaves the opponent lost (brute force)", () => {
  const w = oracle(true);
  for (const h of positions(4, 5)) {
    if (!sum(h)) continue;
    const m = N.peek(h, true);
    if (!w(h)) eq(m, null, String(h));
    else { const a = h.slice(); a[m.tile] = m.to; ok(!w(a), "peek move does not win " + h + " -> " + a); }
  }
  // the classic misere trap: [1,1,3] must become [1,1,1], not [1,1,0]
  eq(N.peek([1, 1, 3], true), { tile: 2, to: 1 }); eq(N.peek([1, 1, 3], false), { tile: 2, to: 0 });
});
t("Hard always wins from a winning position, against random play and both modes", () => {
  for (const mis of [false, true]) for (const seed of SEEDS) {
    let s = N.newGame(seed, { diff: "hard", misere: mis, level: 3 + (seed % 7) });
    s.turn = "cpu";
    if (!N.winning(s.heaps, mis)) continue;
    let r = s; let q = { seed: seed ^ 0x55 };
    const rand = (st) => { const ms = N.legalMoves(st.heaps); q.seed = (q.seed * 1103515245 + 12345) >>> 0; return ms[q.seed % ms.length]; };
    r = playRound(r, rand, N.cpuTurn);
    eq(r.roundOver, "cpu", (mis ? "misere " : "") + "seed " + seed);
  }
});
t("Hard never wins from a lost position without power-ups (against perfect play)", () => {
  for (const mis of [false, true]) for (const seed of SEEDS) {
    const s = N.newGame(seed, { diff: "hard", misere: mis, level: 3 + (seed % 7) }); // player to move
    if (!N.winning(s.heaps, mis)) continue;
    eq(playRound(s, perfect, N.cpuTurn).roundOver, "you", "seed " + seed);
  }
});
t("Hard plays Pass or Add to turn a lost position around", () => {
  const p = N.cpuTurn(forge({ heaps: [1, 2, 3], turn: "cpu", cpu: { pass: 1 } }));
  eq(p.turn, "you"); eq(p.heaps, [1, 2, 3]); eq(p.power.cpu.pass, 0); eq(p.last.kind, "pass");
  const a = N.cpuTurn(forge({ heaps: [1, 2, 3], turn: "cpu", cpu: { add: 1 } }));
  eq(a.power.cpu.add, 0); ok(a.last.added, "add then take"); ok(!N.winning(a.heaps, false), "left the player lost " + a.heaps);
  const e = N.cpuTurn(forge({ heaps: [1, 2, 3], turn: "cpu", diff: "easy", cpu: { pass: 1, add: 1 } }));
  eq(e.power.cpu, Object.assign({}, e.power.cpu, { pass: 1, add: 1 }), "Easy never plays power-ups");
});
t("Medium plays perfectly once two tiles remain", () => {
  for (const seed of SEEDS) {
    const s = forge({ seed, heaps: [0, 4 + seed % 5, 0, 1 + seed % 3, 0], turn: "cpu", diff: "medium" });
    if (!N.winning(s.heaps, false)) continue;
    const r = N.cpuTurn(s); ok(!N.winning(r.heaps, false) || r.roundOver, "medium slipped " + s.heaps + " -> " + r.heaps);
  }
});
t("Easy only ever makes legal moves", () => {
  for (const seed of SEEDS) {
    const s = forge({ seed, heaps: [3, 9, 1, 6], turn: "cpu", diff: "easy" }), r = N.cpuTurn(s);
    const d = s.heaps.map((v, i) => v - r.heaps[i]); eq(d.filter(Boolean).length, 1); ok(d.every(x => x >= 0));
  }
});
t("Add: +1 to a live tile, never past 9, once per turn, then you still take", () => {
  const s = forge({ heaps: [9, 0, 4], you: { add: 3 } });
  ok(!N.use(s, "add", 0).ok, "9 cannot grow"); ok(!N.use(s, "add", 1).ok, "a gone tile stays gone");
  const a = N.use(s, "add", 2); ok(a.ok); eq(a.state.heaps, [9, 0, 5]); eq(a.state.turn, "you"); eq(a.state.power.you.add, 2);
  ok(!N.use(a.state, "add", 2).ok, "only one Add per turn");
  for (let v = 1; v <= 9; v++) { const r = N.use(forge({ heaps: [v, 1, 1], you: { add: 1 } }), "add", 0); ok(r.ok ? r.state.heaps[0] === v + 1 && v + 1 <= 9 : v === 9); }
  ok(!N.use(forge({ heaps: [2, 1, 1] }), "add", 0).ok, "no charge, no Add");
});
t("Pass: skips the turn, spends a charge, and cannot answer a pass", () => {
  const s = forge({ heaps: [1, 2, 3], you: { pass: 2 } });
  const p = N.use(s, "pass"); ok(p.ok); eq(p.state.turn, "cpu"); eq(p.state.heaps, [1, 2, 3]); eq(p.state.power.you.pass, 1);
  const c = forge({ heaps: [1, 2, 3], turn: "cpu", you: { pass: 1 }, cpu: { pass: 1 } });
  const back = N.cpuTurn(c); eq(back.last.kind, "pass"); ok(!N.canPass(back), "no pass-back"); ok(!N.use(back, "pass").ok);
  ok(!N.use(forge({ heaps: [1, 2, 3] }), "pass").ok, "no charge, no Pass");
});
t("Peek: spends a charge and returns the winning move (null when lost)", () => {
  const s = forge({ heaps: [3, 4, 5], you: { peek: 2 } });
  const r = N.use(s, "peek"); ok(r.ok); eq(r.state.power.you.peek, 1);
  const a = s.heaps.slice(); a[r.move.tile] = r.move.to; eq(N.nimSum(a), 0);
  const z = N.use(forge({ heaps: [1, 2, 3], you: { peek: 1 } }), "peek"); ok(z.ok); eq(z.move, null);
  ok(!N.use(forge({ heaps: [1, 2, 3] }), "peek").ok);
});
t("Undo restores the start of your last turn, stock included, and cannot farm", () => {
  // a won round cannot be undone, so its award can never be rewound and re-earned
  let w = forge({ heaps: [0, 0, 2], you: { undo: 1, add: 1 } });
  w = N.use(w, "add", 2).state; w = N.take(w, 2, 3).state; eq(w.roundOver, "you");
  ok(!N.canUndo(w) && !N.use(w, "undo").ok, "no undo after a won round");
  // R1: a lost round is final too: the computer's winning reply cannot be undone
  let s = forge({ heaps: [0, 1, 2], you: { undo: 1, add: 1 } });
  s = N.use(s, "add", 1).state; s = N.take(s, 2, 2).state; eq(s.heaps, [0, 2, 0]);
  s = N.cpuTurn(s); eq(s.roundOver, "cpu"); eq(s.score, { you: 0, cpu: 1 });
  ok(!N.canUndo(s) && !N.use(s, "undo").ok, "no undo after a lost round");
  // and a lost match (the run) is final
  let m = forge({ heaps: [0, 0, 2], you: { undo: 1 } }); m.score = { you: 2, cpu: 2 };
  m = N.take(m, 2, 1).state; m = N.cpuTurn(m); eq(m.matchOver, "cpu"); ok(m.runOver);
  ok(!N.canUndo(m) && !N.use(m, "undo").ok, "no undo after a lost match");
  // inside a live round: add, take, the computer replies; undo puts back the tiles and the Add, spends the Undo
  let v = forge({ heaps: [3, 5, 6], diff: "easy", you: { undo: 1, add: 1 } });
  v = N.use(v, "add", 0).state; v = N.take(v, 1, 1).state; v = N.cpuTurn(v); ok(!v.roundOver);
  const u = N.use(v, "undo"); ok(u.ok);
  eq(u.state.heaps, [3, 5, 6]); eq(u.state.turn, "you"); eq(u.state.power.you, { undo: 0, add: 1, pass: 0, peek: 0 }, "add back, undo spent");
  ok(!N.use(u.state, "undo").ok, "one level only");
  // undo after the computer's winning reply takes back both moves
  let c = forge({ heaps: [2, 2, 0], diff: "hard" }); c = N.take(c, 0, 1).state; c = N.cpuTurn(c);
  ok(!N.winning(c.heaps, false)); const back = N.use(c, "undo").state; eq(back.heaps, [2, 2, 0]); eq(back.turn, "you");
});
t("a Peek spent after your last move stays spent through Undo", () => {
  let s = forge({ heaps: [1, 2, 3, 5], diff: "easy", you: { undo: 1, peek: 1 } });
  s = N.take(s, 3, 1).state; s = N.cpuTurn(s);
  s = N.use(s, "peek").state; eq(s.power.you.peek, 0);
  const u = N.use(s, "undo").state; eq(u.power.you.peek, 0); eq(u.heaps, [1, 2, 3, 5]); eq(u.used, 2);
});
t("the computer earns only what it plays (Add, Pass), never Undo or Peek", () => {
  const got = {};
  for (const seed of SEEDS) { const c = N.take(forge({ seed, heaps: [0, 3, 0], turn: "cpu" }), 1, 3).state; got[c.award.name] = 1; }
  eq(Object.keys(got).sort(), ["add", "pass"]); eq(N.CPU_POWERS, ["add", "pass"]);
});
t("a power-up never earns a power-up, and the computer earns only on Hard", () => {
  const s = forge({ heaps: [1, 2, 3], you: { undo: 0, add: 1, pass: 1, peek: 1 } });
  const tot = (st) => Object.values(st.power.you).reduce((a, b) => a + b, 0);
  eq(tot(N.use(s, "add", 0).state), 2); eq(tot(N.use(s, "pass").state), 2); eq(tot(N.use(s, "peek").state), 2);
  for (const diff of ["easy", "medium", "hard"]) {
    const c = N.take(forge({ heaps: [0, 3, 0], turn: "cpu", diff }), 1, 3).state;
    eq(c.roundOver, "cpu"); eq(!!c.award, diff === "hard", diff);
  }
});
t("R2: a round won after Add pays nothing (the critic's repro, Medium [1,0,0])", () => {
  let s = forge({ heaps: [1, 0, 0], diff: "medium", you: { add: 1 } });
  s = N.use(s, "add", 0).state; s = N.take(s, 0, 2).state;
  eq(s.roundOver, "you"); eq(s.award, null); eq(s.noAward, "power"); eq(s.power.you, { undo: 1, add: 0, pass: 0, peek: 0 });
});
t("R2: a round won after Pass pays nothing (Easy [1,1,0], a lost start turned round)", () => {
  let s = forge({ heaps: [1, 1, 0], diff: "easy", you: { pass: 1 } });
  s = N.use(s, "pass").state; s = N.take(s, 0, 1).state; eq(s.turn, "you");
  s = N.take(s, 1, 1).state; eq(s.roundOver, "you"); eq(s.award, null); eq(s.noAward, "power");
  eq(s.power.you.pass, 0, "Pass can never pay a Pass");
});
t("R2 (round 3): Peek counts as help, so a round won after Peek pays nothing; the next round pays again", () => {
  let s = forge({ heaps: [0, 2, 0], diff: "medium", you: { peek: 1, add: 1 } });
  s = N.use(s, "peek").state; s = N.take(s, 1, 2).state;
  eq(s.roundOver, "you"); eq(s.award, null, "peek round pays nothing"); eq(s.noAward, "power");
  s = N.nextRound(s); eq(s.powered, { you: false, cpu: false }, "the flag is per round"); eq(s.peeked, { you: false, cpu: false });
  s.heaps = [0, 2, 0]; s = N.take(s, 1, 2).state; ok(s.award && s.award.who === "you", "a clean round pays");
});
t("R2: a Peek that found no winning move still counts as help", () => {
  let s = forge({ heaps: [1, 2, 3], diff: "easy", you: { peek: 1 } });
  const r = N.use(s, "peek"); eq(r.move, null); ok(r.state.powered.you && r.state.peeked.you);
});
t("R2: Peek then Undo cannot wash the round clean (the Peek stays spent and the round stays unpaid)", () => {
  // take, computer replies, Peek on the next turn, then Undo back to before the first take
  let s = forge({ heaps: [0, 3, 1], diff: "easy", you: { undo: 1, peek: 1 } });
  s = N.take(s, 2, 1).state; s = N.take(s, 1, 1).state; // the computer's reply, by hand: [0,2,0]
  s = N.use(s, "peek").state; ok(s.powered.you);
  const u = N.use(s, "undo").state; eq(u.heaps, [0, 3, 1]); eq(u.power.you.peek, 0); ok(u.powered.you && u.peeked.you, "still marked after Undo");
  let w = N.take(u, 1, 2).state; w = N.take(w, 1, 1).state; w = N.take(w, 2, 1).state;
  eq(w.roundOver, "you"); eq(w.award, null); eq(w.noAward, "power");
});
t("R2 counterfactual: the same moves with a Peek pay nothing, without it they pay (many seeds, Peek 0 to 5 turns before the win)", () => {
  let pairs = 0;
  for (const diff of ["easy", "medium", "hard"]) for (let seed = 1; seed <= 150; seed++) {
    const base = N.newGame(seed * 104729 + 7, { diff, level: 3 + seed % 5 });
    base.power.you = { undo: 0, add: 0, pass: 0, peek: 0 }; base.power.cpu = { undo: 0, add: 0, pass: 0, peek: 0 };
    // record one round of the player's perfect play against the computer (no power-ups on either side)
    let s = base, moves = [];
    for (let k = 0; k < 200 && !s.roundOver; k++) {
      if (s.turn === "you") { const m = perfect(s); moves.push(m); s = N.take(s, m.tile, s.heaps[m.tile] - m.to).state; }
      else s = N.cpuTurn(s);
    }
    if (s.roundOver !== "you") continue;
    ok(s.award && s.award.who === "you", diff + " seed " + seed + ": the clean line pays");
    for (let gap = 0; gap <= 5; gap++) {
      const at = moves.length - 1 - gap; if (at < 0) break;
      let p = JSON.parse(JSON.stringify(base)); p.power.you.peek = 1; let i = 0;
      for (let k = 0; k < 200 && !p.roundOver; k++) {
        if (p.turn === "you") { if (i === at) p = N.use(p, "peek").state; const m = moves[i++]; p = N.take(p, m.tile, p.heaps[m.tile] - m.to).state; }
        else p = N.cpuTurn(p);
      }
      eq(p.roundOver, "you", "same moves, same result"); eq(p.award, null, diff + " seed " + seed + " gap " + gap + ": peeked line paid"); eq(p.noAward, "power");
      pairs++;
    }
  }
  ok(pairs > 600, "pairs " + pairs);
});
t("R2: the computer's round won after its Pass or Add pays nothing either (Hard)", () => {
  let s = forge({ heaps: [1, 2, 3], turn: "cpu", diff: "hard", cpu: { pass: 1 } });
  s = N.cpuTurn(s); eq(s.last.kind, "pass"); ok(s.powered.cpu);
  s = N.take(s, 0, 1).state; // the player is now lost: nim-sum of [0,2,3] for the computer to move is not 0
  for (let k = 0; k < 40 && !s.roundOver; k++) s = s.turn === "cpu" ? N.cpuTurn(s) : N.take(s, s.heaps.findIndex(Boolean), 1).state;
  eq(s.roundOver, "cpu"); eq(s.award, null); eq(s.noAward, "power");
});
t("R2 property: in random play mixing power-ups and moves, a round won by a side that used Add, Pass or Peek never raises that side's stock", () => {
  const tot = (p) => Object.values(p).reduce((a, b) => a + b, 0);
  let checked = 0, paid = 0;
  for (const diff of ["easy", "medium", "hard"]) for (let seed = 1; seed <= 120; seed++) {
    let s = N.newGame(seed * 7919, { diff, level: 3 + seed % 4 }), x = seed;
    s.power.you = { undo: 2, add: 3, pass: 3, peek: 2 }; s.power.cpu = { undo: 1, add: 2, pass: 2, peek: 0 };
    // an independent tracker: did each side use Add or Pass this round, and its stock right after that use
    let trk = { you: null, cpu: null }, turnStart = null, peeked = false;
    for (let i = 0; i < 600 && !s.matchOver; i++) {
      if (s.roundOver) {
        const w = s.roundOver;
        if (w === "you" && peeked) { ok(!s.award && s.noAward === "power", diff + " seed " + seed + ": a peeked round paid"); checked++; }
        else if (trk[w] !== null) { ok(tot(s.power[w]) <= trk[w], diff + " seed " + seed + ": " + w + " earned after a power-up"); ok(!s.award, "no award"); checked++; }
        else if (s.award) paid++;
        s = N.nextRound(s); trk = { you: null, cpu: null }; turnStart = null; peeked = false; continue;
      }
      x = (x * 1103515245 + 12345) >>> 0;
      if (s.turn === "cpu") {
        const b = s.power.cpu, n = N.cpuTurn(s);
        if (n.power.cpu.add < b.add || n.power.cpu.pass < b.pass) trk.cpu = tot(n.power.cpu);
        s = n; continue;
      }
      // Undo goes back to the start of the player's last acted turn, so remember the tracker there
      const snap = s.acted ? null : JSON.parse(JSON.stringify(trk)), acted = () => { if (snap) turnStart = snap; };
      const pick = x % 9, tile = (x >>> 4) % s.heaps.length;
      if (pick === 0) { const r = N.use(s, "add", tile); if (r.ok) { acted(); s = r.state; trk.you = tot(s.power.you); continue; } }
      if (pick === 1) { const r = N.use(s, "pass"); if (r.ok) { acted(); s = r.state; trk.you = tot(s.power.you); continue; } }
      if (pick === 2) { const r = N.use(s, "peek"); if (r.ok) { s = r.state; peeked = true; if (trk.you !== null) trk.you--; continue; } }
      if (pick === 3) { const r = N.use(s, "undo"); if (r.ok) { s = r.state; trk = turnStart; if (trk.you !== null) trk.you = Math.min(trk.you, tot(s.power.you)); continue; } }
      const ms = N.legalMoves(s.heaps), m = pick < 6 && N.peek(s.heaps, s.misere) || ms[(x >>> 9) % ms.length];
      acted(); s = N.take(s, m.tile, s.heaps[m.tile] - m.to).state;
    }
  }
  ok(checked > 300 && paid > 150, "exercised " + checked + " power-up rounds, " + paid + " paid rounds");
});
t("Pass: at most once per round per side, restored by Undo, fresh next round", () => {
  let s = forge({ heaps: [3, 5, 6], diff: "easy", you: { pass: 3, undo: 1 } });
  s = N.use(s, "pass").state; s = N.cpuTurn(s); ok(!s.roundOver);
  ok(!N.canPass(s) && !N.use(s, "pass").ok, "a second Pass in the round is refused");
  const u = N.use(s, "undo").state; ok(N.canPass(u), "Undo gives the Pass back");
  let c = forge({ heaps: [1, 2, 3, 4, 5], turn: "cpu", diff: "hard", cpu: { pass: 3 }, you: { pass: 3 } });
  c = N.cpuTurn(c); eq(c.last.kind, "take", "the computer is winning here, so it takes");
  c.heaps = [1, 2, 3, 0, 0]; c.turn = "cpu"; c = N.cpuTurn(c); eq(c.last.kind, "pass");
  c = N.take(c, 0, 1).state; eq(c.heaps, [0, 2, 3, 0, 0]); c.heaps = [0, 2, 2, 0, 0];
  c = N.cpuTurn(c); eq(c.last.kind, "take", "no second computer Pass this round"); eq(c.power.cpu.pass, 2);
  s.roundOver = "you"; const nx = N.nextRound(s); ok(N.canPass(nx), "a new round allows a Pass again");
});
t("consecutive rounds use fresh deals: never the same start twice in a row (every level, every difficulty)", () => {
  let rounds = 0;
  for (const diff of N.DIFFS) for (const mis of [false, true]) for (let lv = 3; lv <= 9; lv++) for (let i = 0; i < 40; i++) {
    let s = N.newGame(i * 104729 + lv, { diff, level: lv, misere: mis });
    for (let r = 0; r < 6; r++) {
      const d = s.heaps.slice(); eq(s.dealt, d);
      s.roundOver = r % 2 ? "you" : "cpu"; s.matchOver = null; s = N.nextRound(s); rounds++;
      ok(s.heaps.join() !== d.join(), diff + " " + lv + " repeated deal " + d);
      ok(N.winning(s.heaps, mis) || diff === "hard", "Easy and Medium still deal winning starts");
    }
  }
  // the real flow too: a lost round, then the next deal (the mechanics lead: 4,3,7 then 4,3,7)
  for (let seed = 1; seed <= 400; seed++) {
    let s = N.newGame(seed, { diff: "hard" }); const d = s.heaps.slice();
    s = playRound(s, (st) => N.legalMoves(st.heaps)[0], N.cpuTurn);
    if (!s.matchOver) ok(N.nextRound(s).heaps.join() !== d.join(), "seed " + seed);
  }
  ok(rounds > 5000);
});
t("R12: started() is false before the first move of a match and true after it", () => {
  let s = N.newGame(3, { diff: "easy" }); ok(!N.started(s));
  ok(!N.started(N.use(forge({ heaps: [1, 2, 4], you: { peek: 1 } }), "peek").state), "a Peek is not a move");
  ok(N.started(N.take(s, 0, 1).state));
  ok(N.started(N.use(forge({ heaps: [1, 2, 4], you: { add: 1 } }), "add", 0).state), "an Add starts it");
  let w = forge({ heaps: [0, 0, 1] }); w = N.take(w, 2, 1).state; ok(N.started(w), "a decided round"); w = N.nextRound(w); ok(N.started(w), "round 2");
  let m = forge({ heaps: [0, 0, 1] }); m.score = { you: 2, cpu: 0 }; m = N.take(m, 2, 1).state; ok(!N.started(m), "a decided match is not live");
  ok(!N.started(N.nextMatch(m)), "the next match before its first move");
});
t("R14: the computer's Add is recorded on its move (which tile, from what), so the hint line can announce it", () => {
  const c = N.cpuTurn(forge({ heaps: [1, 2, 3], turn: "cpu", cpu: { add: 1 } }));
  ok(c.last.added && c.last.addAt && Number.isInteger(c.last.addAt.tile), JSON.stringify(c.last));
  eq(c.power.cpu.add, 0); ok(!N.winning(c.heaps, false), "the Add turned the position round");
});
t("R15: a full stock skips the reward and says so (noAward: full)", () => {
  const s = N.take(forge({ heaps: [0, 1, 0], you: { undo: 9, add: 9, pass: 9, peek: 9 } }), 1, 1).state;
  eq(s.award, null); eq(s.noAward, "full");
});
t("stock caps at 9", () => {
  let s = forge({ heaps: [0, 1, 0], you: { undo: 9, add: 9, pass: 9, peek: 8 } });
  s = N.take(s, 1, 1).state; eq(s.power.you.peek, 9); eq(s.award.name, "peek");
  s = N.nextRound(s); s.heaps = [0, 1, 0]; s = N.take(s, 1, 1).state; eq(s.award, null); ok(Object.values(s.power.you).every(v => v === 9));
});
t("best of five: first to three rounds takes the match; a won match adds a tile; a lost one ends the run", () => {
  let s = N.newGame(9, { level: 3 });
  for (let r = 0; r < 3; r++) { s = playRound(s, perfect, N.cpuTurn); eq(s.roundOver, "you"); if (r < 2) { ok(!s.matchOver); s = N.nextRound(s); eq(s.round, r + 2); } }
  eq(s.matchOver, "you"); eq(s.score, { you: 3, cpu: 0 }); eq(s.wonMatches, 1); ok(!s.runOver);
  eq(N.nextRound(s), s, "no fourth round after the match");
  const m = N.nextMatch(s); eq(m.level, 4); eq(m.heaps.length, 4); eq(m.score, { you: 0, cpu: 0 }); eq(m.round, 1);
  eq(m.power.you, s.power.you, "the player keeps the stock across the run");
  let l = N.newGame(3, { level: 5 }); l.score = { you: 2, cpu: 2 }; l.heaps = [0, 0, 0, 4, 0]; l.turn = "cpu";
  l = N.take(l, 3, 4).state; eq(l.matchOver, "cpu"); ok(l.runOver); eq(N.nextMatch(l), l, "no next match after a loss");
  let top = N.newGame(1, { level: 9 }); top.matchOver = "you"; eq(N.nextMatch(top).level, 9, "nine tiles is the top level");
});
t("perfect play wins every match on every level on Easy and Medium", () => {
  for (const diff of ["easy", "medium"]) for (const mis of [false, true]) for (let lv = 3; lv <= 9; lv++) {
    let s = N.newGame(lv * 31 + mis, { diff, misere: mis, level: lv });
    while (!s.matchOver) { s = playRound(s, perfect, N.cpuTurn); if (!s.matchOver) s = N.nextRound(s); }
    eq(s.matchOver, "you", diff + " " + lv + (mis ? " misere" : ""));
  }
});
// The R4 measurement for Hard: a perfect player who uses Pass and Add when dealt a losing start.
function perfectPow(s) {
  if (N.winning(s.heaps, s.misere)) { const m = N.peek(s.heaps, s.misere); return N.take(s, m.tile, s.heaps[m.tile] - m.to).state; }
  if (N.canPass(s)) return N.use(s, "pass").state;
  if (!s.added) for (let i = 0; i < s.heaps.length; i++) if (N.canAdd(s, i)) {
    const h = s.heaps.slice(); h[i]++;
    if (N.winning(h, s.misere)) { const a = N.use(s, "add", i).state, m = N.peek(a.heaps, a.misere); return N.take(a, m.tile, a.heaps[m.tile] - m.to).state; }
  }
  const i = s.heaps.findIndex(Boolean); return N.take(s, i, 1).state;
}
function hardMatches(player, count, mis) {
  let won = 0;
  for (let i = 0; i < count; i++) {
    let s = N.newGame(i * 7919 + 1, { diff: "hard", misere: mis, level: 3 + (i % 4) });
    while (!s.matchOver) {
      for (let k = 0; k < 500 && !s.roundOver; k++) s = s.turn === "you" ? player(s) : N.cpuTurn(s);
      ok(s.roundOver, "round did not end"); if (!s.matchOver) s = N.nextRound(s);
    }
    if (s.matchOver === "you") won++;
  }
  return won / count;
}
t("Hard is clearly winnable, not guaranteed: perfect play with Pass and Add wins most matches (round 2, after R2 and Pass once)", () => {
  for (const mis of [false, true]) {
    const r = hardMatches((s) => perfectPow(s), 400, mis);
    if (process.env.NINE_REPORT) console.log("Hard perfect+power-ups", mis ? "misere" : "normal", r.toFixed(3));
    ok(r >= 0.75 && r <= 0.95, (mis ? "misere " : "") + "perfect+power-ups Hard match win rate " + r.toFixed(3));
  }
  const plain = hardMatches((s) => { const m = N.peek(s.heaps, s.misere); if (m) return N.take(s, m.tile, s.heaps[m.tile] - m.to).state; const i = s.heaps.findIndex(Boolean); return N.take(s, i, 1).state; }, 400, false);
  if (process.env.NINE_REPORT) console.log("Hard perfect, no power-ups", plain.toFixed(3));
  ok(plain > 0.5 && plain < hardMatches((s) => perfectPow(s), 400, false), "power-ups must matter on Hard: " + plain.toFixed(3));
});
t("state is plain JSON (saveable)", () => {
  let s = N.newGame(4, { level: 5 }); s = N.take(s, 0, 1).state; s = N.cpuTurn(s);
  eq(JSON.parse(JSON.stringify(s)), s);
});

// D-Nine (REDESIGN.md 5.7, 8.4, 9.8): static checks on the client and the page
const fs = require("fs"), path = require("path");
const G = fs.readFileSync(path.join(__dirname, "..", "nine", "game.js"), "utf8");
const H = fs.readFileSync(path.join(__dirname, "..", "nine", "index.html"), "utf8");
const C = fs.readFileSync(path.join(__dirname, "..", "nine", "style.css"), "utf8");
t("D-Nine: trophy events are exactly take, round and match with the 8.4 fields", () => {
  const evs = [...G.matchAll(/report\("(\w+)", \{([^}]*)\}/g)].map(m => [m[1], m[2].match(/(\w+):/g).map(x => x.slice(0, -1))]);
  eq(evs.map(e => e[0]).sort(), ["match", "round", "take"]);
  eq(evs.find(e => e[0] === "take")[1], ["amount", "zeroAfter", "run"]);
  eq(evs.find(e => e[0] === "round")[1], ["won", "onlyOnes"]);
  eq(evs.find(e => e[0] === "match")[1], ["won", "diff", "misere", "tiles"]);
  ok(/zeroAfter = N\.nimSum\(state\.heaps\) === 0/.test(G), "zeroAfter from the engine's own nim-sum helper");
});
t("D-Nine: motion uses the shared tokens (pipOut, pipStagger), every input finishes the running motion first", () => {
  ok(/M\.T\.pipOut/.test(G) && /M\.T\.pipStagger/.test(G) && /M\.reduced\(\)/.test(G), "tokens and the live reduced read");
  ok(!/K\.reducedMotion\(\)\s*\?\s*0/.test(G) && !/ANIM\s*=/.test(G), "no cached ANIM constant");
  const handlers = (G.match(/fxFinish\(\)/g) || []).length; ok(handlers >= 10, "fxFinish calls: " + handlers);
  ok(!/"\s*cpu new"/.test(G), "the computer's tile no longer uses the old CSS appear class");
});
t("D-Nine: how-to row, the three steps, end-card pills, cards, music duck, progress", () => {
  ok(/<details class="how"[^>]*><summary>How to play<\/summary>/.test(H), "collapsed How to play row");
  ok(/On Hard the computer can also Pass and Add\./.test(H.replace(/\s+/g, " ")), "rules text kept word for word");
  ["Tap a tile, then choose how many to take.", "You and the computer take turns.", "Take the very last one to win the round."].forEach(x => ok(G.includes(x), x));
  ok(/<div id="over-pills" class="tro-pills" hidden><\/div>/.test(H) && /class="over"[\s\S]*over-pills/.test(H), "pills inside the end card");
  ok(/id="games" class="cards"/.test(H), "the games cards at the page foot");
  ok(/NumbericsMusic\.duck\(up\)/.test(G) && !/music\.js/.test(H), "music ducks with the card; music.js is never loaded here");
  ok(/PR\.put\("nine"/.test(G) && /U\.howto\("nine", \{ title: "Nine", steps: STEPS, saved: !firstVisit/.test(G), "progress and the shared how-to (D8)");
});
t("D-Nine: the style animates nothing but transform and opacity", () => {
  ok(!/transition:[^;}]*(width|height|top|left|margin|padding)/.test(C) && !/@keyframes/.test(C), "no layout transitions or keyframes");
});

require("./conventions")(t, ok, ["nine/engine.js", "nine/game.js", "nine/index.html", "nine/style.css"]);
console.log(pass + " passed, " + fail + " failed"); process.exit(fail ? 1 : 0);
