/* SPDX-License-Identifier: Apache-2.0 | Copyright 2026 alvations (Melon Lab)
 * `node tests/test-four.js` : Four (Connect Four, counted) engine tests. */
"use strict";
const F = require("../four/engine.js");
let pass = 0, fail = 0;
function t(n, f) { try { f(); pass++; } catch (e) { fail++; console.log("FAIL", n, "\n  ", e.message); } }
function ok(c, m) { if (!c) throw new Error(m || "assertion failed"); }
function eq(a, b, m) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || "") + " got " + JSON.stringify(a) + " want " + JSON.stringify(b)); }

const C = F.COLS, at = (r, c) => r * C + c;
// a fresh game with a hand-built board: discs = [[row, col, owner, number], ...]
function board(discs, o) {
  o = o || {};
  const s = F.newGame(o.seed || 1, { level: o.level || "medium" });
  discs.forEach(([r, c, w, n]) => { s.own[at(r, c)] = w; s.num[at(r, c)] = n; });
  if (o.turn) s.turn = o.turn;
  if (o.next) s.next = o.next.slice();
  s.moves = discs.length;
  return s;
}
// fill a column bottom-up so a disc can rest at row r: alternating owners with number 1 (never a ten, never a colour four)
function stack(c, rows, start) { const d = []; for (let r = 0; r < rows; r++) d.push([r, c, ((r + (start || 0)) % 2) + 1, 1]); return d; }

// ---- setup ----
t("69 windows of four on a 7x6 board", () => { eq(F.WINDOWS.length, 69); ok(F.WINDOWS.every(w => w.length === 4)); });
t("new game: empty board, player first, one Undo, next numbers dealt for both sides", () => {
  const s = F.newGame(7);
  ok(s.own.every(v => v === 0)); eq(s.turn, 1); eq(s.power[0], { undo: 1, pop: 0, hold: 0, tune: 0 });
  eq(s.power[1], { undo: 0, pop: 0, hold: 0, tune: 0 });
  ok(s.next.every(n => n >= 1 && n <= 4)); eq(s.level, "medium");
  eq(F.newGame(7, { first: 2 }).turn, 2, "the computer can be set to start");
});
t("discs are dealt from a seeded bag: every 8 deals per side are a shuffle of the bag", () => {
  let s = F.newGame(42); const seen = [[], []];
  for (let k = 0; k < 32; k++) { seen[s.turn - 1].push(s.next[s.turn - 1]); s = F.drop(s, [0, 6, 1, 5, 2, 4][k % 6]).state; if (s.over) break; }
  const sorted = F.BAG.slice().sort().join();
  if (seen[0].length >= 8) eq(seen[0].slice(0, 8).sort().join(), sorted);
  if (seen[1].length >= 8) eq(seen[1].slice(0, 8).sort().join(), sorted);
});
t("deterministic: same seed and same drops give the same game", () => {
  const play = seed => { let s = F.newGame(seed); for (const c of [3, 3, 2, 4, 1, 5]) { if (s.over) break; s = F.drop(s, c).state; } return JSON.stringify(s); };
  eq(play(9), play(9)); ok(play(9) !== play(10));
});
t("a drop lands on the lowest free row and passes the turn", () => {
  let s = F.newGame(3); const n = s.next[0];
  const r = F.drop(s, 3); ok(r.ok); eq(r.cell, at(0, 3)); eq(r.state.own[at(0, 3)], 1); eq(r.state.num[at(0, 3)], n);
  eq(r.state.turn, 2); eq(F.drop(r.state, 3).cell, at(1, 3));
});
t("a full column and a finished game refuse drops", () => {
  const s = board(stack(0, 6));
  ok(!F.drop(s, 0).ok); ok(F.legal(s).indexOf(0) < 0);
  const done = Object.assign({}, F.newGame(1), { over: { winner: 1 } }); ok(!F.drop(done, 3).ok);
});

// ---- both win conditions, all four directions ----
const DIRS = { row: [0, 1], column: [1, 0], diagonal: [1, 1], antidiagonal: [1, -1] };
function lineCells(dir, r0, c0) { const d = DIRS[dir]; return [0, 1, 2, 3].map(k => [r0 + k * d[0], c0 + k * d[1]]); }
function support(cells) { // discs under every cell of the line so they can rest there (cpu, number 1 never sums to 10 alone)
  const need = {}; cells.forEach(([r, c]) => { need[c] = Math.max(need[c] || 0, r); });
  const d = []; Object.keys(need).forEach(c => { for (let r = 0; r < need[c]; r++) if (!cells.some(x => x[0] === r && x[1] === +c)) d.push([r, +c, (r % 2) + 1, 1]); });
  return d;
}
Object.keys(DIRS).forEach(dir => {
  t("colour four in a " + dir + " wins for the dropper", () => {
    const start = dir === "antidiagonal" ? [0, 4] : [0, 1], cells = lineCells(dir, start[0], start[1]);
    const last = cells[3], lowest = cells.reduce((a, b) => (b[0] < a[0] ? b : a));
    const drop = dir === "column" ? cells[3] : (dir === "row" ? last : last);
    const discs = support(cells).concat(cells.filter(x => x !== drop).map(([r, c]) => [r, c, 1, 1]));
    const s = board(discs, { turn: 1, next: [1, 1] });
    ok(lowest);
    const res = F.drop(s, drop[1]); ok(res.ok); eq(res.cell, at(drop[0], drop[1]), "lands at the line end");
    ok(res.state.over && res.state.over.winner === 1 && res.state.over.type === "colour", JSON.stringify(res.state.over));
    eq(res.state.over.line.slice().sort((a, b) => a - b), cells.map(([r, c]) => at(r, c)).sort((a, b) => a - b));
  });
  t("ten-line (mixed colours, sum exactly 10) in a " + dir + " wins for the dropper", () => {
    const start = dir === "antidiagonal" ? [0, 4] : [0, 1], cells = lineCells(dir, start[0], start[1]);
    const drop = cells[3], nums = [4, 1, 3], owners = [2, 1, 2];
    const discs = support(cells).concat(cells.slice(0, 3).map(([r, c], k) => [r, c, owners[k], nums[k]]));
    const s = board(discs, { turn: 1, next: [2, 1] });
    const res = F.drop(s, drop[1]); eq(res.cell, at(drop[0], drop[1]));
    ok(res.state.over && res.state.over.winner === 1 && res.state.over.type === "ten", JSON.stringify(res.state.over));
  });
});
t("a ten-line needs EXACTLY ten: 11 and 9 do not win", () => {
  const base = [[0, 0, 2, 4], [0, 1, 1, 1], [0, 2, 2, 3]];
  ok(!F.drop(board(base, { turn: 1, next: [3, 1] }), 3).state.over, "sum 11");
  ok(!F.drop(board(base, { turn: 1, next: [1, 1] }), 3).state.over, "sum 9");
});
t("a ten-line completed by the opponent's disc is theirs, not yours", () => {
  // two of the player's discs and one of the computer's sum to 7: the computer's 3 completes it with two of its own
  const s = board([[0, 0, 1, 2], [0, 1, 2, 2], [0, 2, 1, 3]], { turn: 2, next: [1, 3] });
  const r = F.drop(s, 3); ok(r.state.over); eq(r.state.over.winner, 2); eq(r.state.over.type, "ten");
});
// round 1 (cold blocker, mechanics #5): a ten-line must hold at least two discs of the side that completes it
t("ten-line rule: one disc of yours is not enough (the other side's three discs plus yours never win)", () => {
  const s = board([[0, 0, 1, 2], [0, 1, 1, 2], [0, 2, 1, 3]], { turn: 2, next: [1, 3] });
  const r = F.drop(s, 3); ok(r.ok); ok(!r.state.over, "the computer completed a 10 holding only one disc of it");
  eq(F.linesAt(s.own, s.num, at(0, 3), 2, 3), []); eq(F.linesAt(s.own, s.num, at(0, 3), 1, 3).length, 1, "the player's own 3 still wins");
  eq(F.MINE, 2);
});
t("ten-line rule: exactly two of yours is enough, in every direction", () => {
  for (const [cells, dropC] of [[[[0, 1], [0, 2], [0, 3]], 4], [[[0, 5], [1, 5], [2, 5]], 5]]) {
    const discs = [[cells[0][0], cells[0][1], 2, 4], [cells[1][0], cells[1][1], 1, 1], [cells[2][0], cells[2][1], 2, 3]];
    const s = board(discs, { turn: 1, next: [2, 1] });
    const r = F.drop(s, dropC); ok(r.state.over && r.state.over.type === "ten" && r.state.over.winner === 1, JSON.stringify(r.state.over));
  }
});
t("ten-line rule: the computer's search never counts a ten it holds only one disc of", () => {
  // the player's three discs sum to 7 and the computer holds a 3: no win in one for the computer
  const s = board([[0, 0, 1, 2], [0, 1, 1, 2], [0, 2, 1, 3]], { turn: 2, next: [1, 3], level: "hard" });
  const a = F.analyse(s, { depth: 1 }); ok(a.score < 1000000 - 64, "score " + a.score);
});
t("colour wins outrank ten-lines in the report when one drop makes both", () => {
  const s = board([[0, 0, 1, 1], [0, 1, 1, 2], [0, 2, 1, 3]], { turn: 1, next: [4, 1] });
  const o = F.drop(s, 3).state.over; eq(o.type, "colour"); eq(o.winner, 1);
});
t("a full board with no line is a draw", () => {
  // columns alternate owners in pairs of rows, all numbers 1: no colour four, no sum of 10 anywhere
  const pat = [1, 1, 2, 2, 1, 1], d = [];
  for (let c = 0; c < C; c++) for (let r = 0; r < 6; r++) {
    if (c === 6 && r === 5) continue;
    const w = ((c >> 1) % 2) ? 3 - pat[r] : pat[r]; d.push([r, c, w, 1]);
  }
  const s = board(d, { turn: 1, next: [1, 1] });
  ok(!s.over); const r = F.drop(s, 6); eq(r.state.over.winner, 0); eq(r.state.over.type, "draw");
});

// ---- the computer ----
t("the computer takes an immediate colour win", () => {
  const s = board([[0, 0, 2, 1], [0, 1, 2, 1], [0, 2, 2, 1], [1, 0, 1, 1], [1, 1, 1, 1]], { turn: 2, next: [1, 1] });
  for (const lv of ["easy", "medium", "hard"]) { s.level = lv; const r = F.computerTurn(s); eq(r.state.over && r.state.over.winner, 2, lv); }
});
t("the computer takes an immediate ten-line", () => {
  const s = board([[0, 1, 1, 4], [0, 2, 2, 2], [0, 3, 1, 1]], { turn: 2, next: [1, 3] });
  for (const lv of ["easy", "medium", "hard"]) { s.level = lv; const r = F.computerTurn(s); eq(r.state.over && r.state.over.type, "ten", lv); eq(r.state.over.winner, 2); }
});
// blocks: Hard unless it blunders (a rare loose turn, tuned); Easy and Medium play loose turns (tuned), so they are measured over seeds
function blockRate(s, lv, col) {
  let n = 0; for (let k = 0; k < 100; k++) { const x = JSON.parse(JSON.stringify(s)); x.level = lv; x.aiSeed = k * 7919 + 1;
    const r = F.computerTurn(x); if (r.actions[r.actions.length - 1].arg === col) n++; }
  return n / 100;
}
t("the computer blocks an immediate colour loss (Hard nearly always, Medium mostly, Easy often)", () => {
  const s = board([[0, 0, 1, 1], [1, 0, 1, 1], [2, 0, 1, 1], [0, 3, 2, 1], [0, 4, 2, 2]], { turn: 2, next: [1, 1] });
  ok(blockRate(s, "hard", 0) >= 0.9, "hard"); ok(blockRate(s, "medium", 0) >= 0.75, "medium"); ok(blockRate(s, "easy", 0) >= 0.4, "easy");
});
t("the computer blocks an immediate ten-line loss (the player holds the 3 it needs)", () => {
  // (0,1..3) = 4 2 1 needs a 3 at (0,4); (0,0) is filled so that is the only hole; two of them are the player's
  const s = board([[0, 0, 2, 1], [0, 1, 1, 4], [0, 2, 2, 2], [0, 3, 1, 1]], { turn: 2, next: [3, 1] });
  ok(blockRate(s, "hard", 4) >= 0.9, "hard"); ok(blockRate(s, "medium", 4) >= 0.75, "medium"); ok(blockRate(s, "easy", 4) >= 0.4, "easy");
});
t("Easy is deterministic by seed", () => {
  const run = seed => { let s = F.newGame(seed, { level: "easy" }), cols = [];
    for (let k = 0; k < 10 && !s.over; k++) { if (s.turn === 1) s = F.drop(s, [3, 2, 4, 1, 5][k % 5]).state; else { const r = F.computerTurn(s); cols.push(r.actions[0].arg); s = r.state; } }
    return cols.join(); };
  eq(run(11), run(11)); eq(run(12), run(12));
});
t("fair play: the computer reads the bag's contents, never its hidden order", () => {
  let s = F.newGame(5, { level: "medium" }); s = F.drop(s, 3).state; s = F.drop(s, 3).state; s = F.drop(s, 2).state;
  const a = F.computerTurn(s).actions, t2 = JSON.parse(JSON.stringify(s)); t2.bag[1].reverse(); t2.bag[0].reverse();
  eq(F.computerTurn(t2).actions[0], a[0]);
});
t("Hard spends Tune to win when its own number would not", () => {
  const s = board([[0, 1, 1, 4], [0, 2, 2, 2], [0, 3, 1, 1]], { turn: 2, next: [1, 1], level: "hard" });
  s.board = null; s.own[at(0, 0)] = 2; s.num[at(0, 0)] = 2; // close the left hole: only (0,4) needs a 3
  s.power[1].tune = 1;
  let r; for (let k = 0; k < 20; k++) { s.aiSeed = k + 1; r = F.computerTurn(s); if (r.actions[0].type === "tune") break; } // past a loose turn
  eq(r.actions[0], { type: "tune", arg: 3 }); eq(r.state.over.winner, 2); eq(r.state.over.type, "ten");
});
t("Medium and Easy never use power-ups", () => {
  const s = board([[0, 1, 1, 4], [0, 2, 1, 2], [0, 3, 1, 1], [0, 0, 2, 2]], { turn: 2, next: [1, 1] });
  s.power[1] = { undo: 0, pop: 3, hold: 3, tune: 3 };
  for (const lv of ["easy", "medium"]) { s.level = lv; eq(F.computerTurn(s).actions.length, 1, lv); }
});
t("the computer is fast enough for a phone (Hard under 250 ms per move in Node)", () => {
  let worst = 0;
  for (let g = 0; g < 3; g++) { let s = F.newGame(300 + g, { level: "hard" }); s.power[1] = { undo: 0, pop: 2, hold: 2, tune: 2 };
    while (!s.over) { if (s.turn === 1) s = F.drop(s, F.bestMove(s, { level: "easy" })).state;
      else { const t0 = Date.now(); s = F.computerTurn(s).state; worst = Math.max(worst, Date.now() - t0); } } }
  ok(worst < 250, "worst " + worst + " ms");
});

// ---- power-ups ----
t("Undo takes back both moves and is paid for from the restored stock", () => {
  let s = F.newGame(8, { level: "easy" }); const before = JSON.stringify(s);
  s = F.drop(s, 3).state; s = F.computerTurn(s).state; eq(s.turn, 1);
  const u = F.use(s, "undo"); ok(u.ok);
  const b = JSON.parse(before); eq(u.state.own, b.own); eq(u.state.next, b.next); eq(u.state.turn, 1);
  eq(u.state.power[0].undo, 0); ok(!F.use(u.state, "undo").ok, "no snapshot left");
});
t("Undo cannot farm: a power-up earned in the undone turn is gone", () => {
  // the player blocks a computer line of three (earns), then undoes
  const s = board([[0, 0, 2, 1], [0, 1, 2, 1], [0, 2, 2, 1]], { turn: 1, next: [1, 1] });
  const r0 = F.drop(s, 3); eq(r0.earned, "block"); ok(r0.award);
  const r = { state: F.computerTurn(r0.state).state }; ok(!r.state.over);
  const total = p => p.undo + p.pop + p.hold + p.tune;
  eq(total(r.state.power[0]), 2);
  const u = F.use(r.state, "undo"); ok(u.ok); eq(total(u.state.power[0]), 0);
});
t("Undo is refused with no snapshot, on the computer's turn and with no charge", () => {
  const s = F.newGame(1); ok(!F.use(s, "undo").ok);
  const s2 = F.drop(s, 3).state; ok(!F.use(s2, "undo").ok, "computer to move");
  const s3 = F.computerTurn(s2).state; s3.power[0].undo = 0; ok(!F.use(s3, "undo").ok);
});
// R1 (round 1: critic Four 1, mechanics Four 1): Undo never crosses a decided result, so a record cannot be farmed
t("R1: Undo is refused after a loss", () => {
  const s = board([[0, 0, 2, 1], [0, 1, 2, 1], [0, 2, 2, 1], [1, 0, 1, 1]], { turn: 1, next: [1, 1], level: "hard" });
  s.power[0].undo = 3;
  let x = F.drop(s, 6).state; x = F.computerTurn(x).state; ok(x.over && x.over.winner === 2);
  ok(x.prev, "a snapshot exists"); ok(!F.use(x, "undo").ok, "undo after a loss");
});
t("R1: Undo is refused after a win, so one game can be won only once", () => {
  const s = board([[0, 0, 2, 4], [0, 1, 1, 1], [0, 2, 2, 2]], { turn: 1, next: [3, 1] }); s.power[0].undo = 3;
  const w = F.drop(s, 3).state; ok(w.over && w.over.winner === 1); ok(!F.use(w, "undo").ok, "undo after a win");
  const d = Object.assign(JSON.parse(JSON.stringify(w)), { over: { winner: 0, type: "draw", line: [], cells: [] } });
  ok(!F.use(d, "undo").ok, "undo after a draw");
});
t("Pop removes any disc and the column drops", () => {
  const s = board([[0, 2, 1, 1], [1, 2, 2, 3], [2, 2, 1, 2]], { turn: 1 }); s.power[0].pop = 1;
  const r = F.use(s, "pop", at(0, 2)); ok(r.ok);
  eq([r.state.own[at(0, 2)], r.state.num[at(0, 2)]], [2, 3]); eq([r.state.own[at(1, 2)], r.state.num[at(1, 2)]], [1, 2]);
  eq(r.state.own[at(2, 2)], 0); eq(r.state.power[0].pop, 0); eq(r.state.turn, 1, "a power-up does not pass the turn");
  ok(!F.use(s, "pop", at(3, 2)).ok, "an empty cell"); ok(!F.use(r.state, "pop", at(0, 2)).ok, "no charge left");
});
t("Pop is refused when the fall would complete a line (only a dropped disc completes one)", () => {
  // row 1: P P P _ with an opponent disc beside; popping under (1,3)'s neighbour column would drop a P into place
  const s = board([[0, 0, 2, 1], [0, 1, 2, 1], [0, 2, 1, 1], [0, 3, 2, 1], [1, 0, 1, 1], [1, 1, 1, 1], [1, 2, 2, 1], [1, 3, 1, 1], [2, 2, 1, 1]], { turn: 1 });
  s.power[0].pop = 1;
  ok(!F.canPop(s, at(1, 2)), "row 1 would become P P P P"); ok(F.canPop(s, at(0, 0)));
});
t("Hold stashes your next disc, then swaps it back", () => {
  const s = F.newGame(4); s.power[0].hold = 2; const n0 = s.next[0];
  const a = F.use(s, "hold"); ok(a.ok); eq(a.state.held[0], n0); ok(a.state.next[0] >= 1);
  const n1 = a.state.next[0], b = F.use(a.state, "hold"); eq(b.state.next[0], n0); eq(b.state.held[0], n1); eq(b.state.power[0].hold, 0);
});
t("Tune sets your next number; same number or out of range is refused", () => {
  const s = F.newGame(4); s.power[0].tune = 1; const other = s.next[0] === 4 ? 1 : 4;
  ok(!F.use(s, "tune", s.next[0]).ok); ok(!F.use(s, "tune", 5).ok); ok(!F.use(s, "tune", 0).ok);
  const r = F.use(s, "tune", other); ok(r.ok); eq(r.state.next[0], other); eq(r.state.power[0].tune, 0); eq(r.state.used[0], 1);
});
t("earn: blocking a line of three earns one power-up", () => {
  const r = F.drop(board([[0, 0, 2, 1], [0, 1, 2, 1], [0, 2, 2, 1]], { turn: 1, next: [1, 1] }), 3);
  eq(r.earned, "block"); ok(F.POWERS.indexOf(r.award) >= 0);
});
t("earn: making a ten-line threat that only your next number completes", () => {
  const s = board([[0, 0, 2, 4], [0, 1, 2, 1]], { turn: 1, next: [2, 2] });
  s.bag[0] = [3]; // the next number dealt to the player will be 3, the computer holds a 2
  const r = F.drop(s, 2); ok(!r.state.over); eq(r.state.next[0], 3); eq(r.earned, "threat");
  const s2 = board([[0, 0, 2, 4], [0, 1, 2, 1]], { turn: 1, next: [2, 3] }); s2.bag[0] = [3];
  eq(F.drop(s2, 2).earned, null, "no threat if the opponent's next number would also complete it");
});
t("earn: Hard's computer earns by the same rules, never Undo", () => {
  for (let k = 0; k < 30; k++) {
    const r = F.drop(board([[0, 0, 1, 1], [0, 1, 1, 1], [0, 2, 1, 1]], { turn: 2, next: [1, 1], seed: k, level: "hard" }), 3);
    eq(r.earned, "block"); ok(r.award && r.award !== "undo", r.award);
  }
});
t("earn: the computer earns nothing on Easy and Medium (only Hard spends power-ups; critic Four 3)", () => {
  for (const lv of ["easy", "medium"]) {
    const r = F.drop(board([[0, 0, 1, 1], [0, 1, 1, 1], [0, 2, 1, 1]], { turn: 2, next: [1, 1], level: lv }), 3);
    eq(r.earned, null, lv); eq(r.state.power[1], { undo: 0, pop: 0, hold: 0, tune: 0 }, lv);
  }
});
t("earn: a threat counts when the opponent's equal number could not complete it (it lacks a disc there)", () => {
  // player discs 4 and 1 at (0,0),(0,1); the player drops at (0,2): needs 3 more, the computer also holds a 3
  // but has no disc in that line, so only the player can ever complete it
  const s = board([[0, 0, 1, 4], [0, 1, 1, 1]], { turn: 1, next: [2, 3] }); s.bag[0] = [3];
  eq(F.drop(s, 2).earned, "threat");
});
t("the stock caps at 9", () => {
  const s = board([[0, 0, 2, 1], [0, 1, 2, 1], [0, 2, 2, 1]], { turn: 1, next: [1, 1] });
  s.power[0] = { undo: 9, pop: 9, hold: 9, tune: 9 };
  const r = F.drop(s, 3); eq(r.earned, "block"); eq(r.award, null); eq(r.state.power[0], { undo: 9, pop: 9, hold: 9, tune: 9 });
});
t("a power-up never earns a power-up", () => {
  const s = board([[0, 0, 2, 1], [0, 1, 2, 1], [0, 2, 2, 1]], { turn: 1, next: [1, 1] }); s.power[0] = { undo: 0, pop: 1, hold: 1, tune: 1 };
  const a = F.use(s, "tune", 2).state, b = F.use(a, "hold").state;
  const tot = p => p.undo + p.pop + p.hold + p.tune; eq(tot(b.power[0]), 1);
});
t("state is plain JSON (saves and loads)", () => {
  let s = F.newGame(2); s = F.drop(s, 3).state; s = F.computerTurn(s).state;
  const back = JSON.parse(JSON.stringify(s)); eq(F.drop(back, 2).state.own, F.drop(s, 2).state.own);
});

// ---- measurements (documented in the report; kept as loose guards so tuning cannot silently regress) ----
t("measure: ten-lines and colour lines both decide games (random play, 300 games)", () => {
  let ten = 0, colour = 0, rs = 1;
  for (let g = 0; g < 300; g++) { let s = F.newGame(g + 1);
    while (!s.over) { const L = F.legal(s), r = F.rand(rs); rs = r[1]; s = F.drop(s, L[Math.floor(r[0] * L.length)]).state; }
    if (s.over.type === "ten") ten++; else if (s.over.type === "colour") colour++; }
  const share = ten / (ten + colour); ok(share > 0.3 && share < 0.75, "ten share " + share.toFixed(2));
});
t("measure: Medium beats a random player almost always", () => {
  let w = 0, rs = 9;
  for (let g = 0; g < 30; g++) { let s = F.newGame(700 + g, { level: "medium", first: g % 2 ? 2 : 1 });
    while (!s.over) { if (s.turn === 1) { const L = F.legal(s), r = F.rand(rs); rs = r[1]; s = F.drop(s, L[Math.floor(r[0] * L.length)]).state; } else s = F.computerTurn(s).state; }
    if (s.over.winner === 2) w++; }
  ok(w >= 26, "medium won " + w + "/30");
});

// Round 1 tuning target (TRIAGE1): a safe-move player (wins in one when it can, otherwise a random column that leaves
// the computer no immediate line for its shown disc; no power-ups; the opener alternates) beats Easy >= 65%, Medium
// 40-55%, Hard 20-35%. Measured over 400 games each (see the round 1 report); these are loose, fast guards.
function safeBot(s, rs) {
  const L = F.legal(s), n = s.next[0];
  for (const c of L) if (F.linesAt(s.own, s.num, F.height(s.own, c) * C + c, 1, n).length) return [c, rs];
  const safe = L.filter(c => { const own = s.own.slice(), num = s.num.slice(), h = F.height(own, c); own[h * C + c] = 1; num[h * C + c] = n;
    for (let k = 0; k < C; k++) { const hk = F.height(own, k); if (hk < 6 && F.linesAt(own, num, hk * C + k, 2, s.next[1]).length) return false; } return true; });
  const pool = safe.length ? safe : L, r = F.rand(rs); return [pool[Math.floor(r[0] * pool.length)], r[1]];
}
function botRate(lv, games) {
  let w = 0, rs = 12345;
  for (let g = 0; g < games; g++) { let s = F.newGame(1000 + g, { level: lv, first: g % 2 ? 2 : 1 });
    while (!s.over) { if (s.turn === 1) { let c; [c, rs] = safeBot(s, rs); s = F.drop(s, c).state; } else s = F.computerTurn(s).state; }
    if (s.over.winner === 1) w++; }
  return w / games;
}
t("balance: a safe-move player beats Easy most of the time (target >= 65%)", () => { const r = botRate("easy", 200); ok(r >= 0.6, "easy " + r); });
t("balance: a safe-move player beats Medium about half the time (target 40-55%)", () => { const r = botRate("medium", 60); ok(r >= 0.28 && r <= 0.65, "medium " + r); });

require("./conventions")(t, ok, ["four/engine.js", "four/game.js", "four/index.html", "four/style.css"]);
console.log(pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
