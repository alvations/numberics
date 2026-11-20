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
t("dealt starts are always a win for the player, who always moves first (normal and misere, 3..9 tiles)", () => {
  for (const mis of [false, true]) for (let lv = 3; lv <= 9; lv++) for (const seed of SEEDS) {
    const s = N.newGame(seed, { level: lv, misere: mis });
    eq(s.heaps.length, lv); eq(s.turn, "you");
    ok(s.heaps.every(v => v >= 1 && v <= 9), "tile out of 1..9 " + s.heaps);
    ok(N.winning(s.heaps, mis), "losing deal " + s.heaps);
    if (!mis) ok(N.nimSum(s.heaps) !== 0, "zero nim-sum deal");
  }
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
    const s = N.newGame(seed, { diff: "hard", misere: mis, level: 3 + (seed % 7) }); // player to move, winning
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
  // add, take, the computer wins: undo puts back the tiles, the Add, the score, and spends the Undo
  let s = forge({ heaps: [0, 1, 2], you: { undo: 1, add: 1 } });
  s = N.use(s, "add", 1).state; s = N.take(s, 2, 2).state; eq(s.heaps, [0, 2, 0]);
  s = N.cpuTurn(s); eq(s.roundOver, "cpu"); eq(s.score, { you: 0, cpu: 1 });
  const u = N.use(s, "undo"); ok(u.ok);
  eq(u.state.heaps, [0, 1, 2]); eq(u.state.roundOver, null); eq(u.state.score, { you: 0, cpu: 0 }); eq(u.state.turn, "you");
  eq(u.state.power.you, { undo: 0, add: 1, pass: 0, peek: 0 }, "add back, undo spent");
  eq(u.state.power.cpu, s.prev.power.cpu, "the computer's award is rewound too");
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
t("a power-up never earns a power-up, and the computer earns only on Hard", () => {
  const s = forge({ heaps: [1, 2, 3], you: { undo: 0, add: 1, pass: 1, peek: 1 } });
  const tot = (st) => Object.values(st.power.you).reduce((a, b) => a + b, 0);
  eq(tot(N.use(s, "add", 0).state), 2); eq(tot(N.use(s, "pass").state), 2); eq(tot(N.use(s, "peek").state), 2);
  for (const diff of ["easy", "medium", "hard"]) {
    const c = N.take(forge({ heaps: [0, 3, 0], turn: "cpu", diff }), 1, 3).state;
    eq(c.roundOver, "cpu"); eq(!!c.award, diff === "hard", diff);
  }
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
t("perfect play wins every match on every level and difficulty", () => {
  for (const diff of N.DIFFS) for (const mis of [false, true]) for (let lv = 3; lv <= 9; lv++) {
    let s = N.newGame(lv * 31 + mis, { diff, misere: mis, level: lv });
    while (!s.matchOver) { s = playRound(s, perfect, N.cpuTurn); if (!s.matchOver) s = N.nextRound(s); }
    eq(s.matchOver, "you", diff + " " + lv + (mis ? " misere" : ""));
  }
});
t("state is plain JSON (saveable)", () => {
  let s = N.newGame(4, { level: 5 }); s = N.take(s, 0, 1).state; s = N.cpuTurn(s);
  eq(JSON.parse(JSON.stringify(s)), s);
});

require("./conventions")(t, ok, ["nine/engine.js", "nine/game.js", "nine/index.html", "nine/style.css"]);
console.log(pass + " passed, " + fail + " failed"); process.exit(fail ? 1 : 0);
