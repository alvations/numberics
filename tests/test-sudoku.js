/* SPDX-License-Identifier: Apache-2.0 | Copyright 2026 alvations (Melon Lab)
 * `node tests/test-sudoku.js` */
"use strict";
const fs = require("fs"), path = require("path");
const S = require("../sudoku/engine.js");
let pass = 0, fail = 0;
function t(n, f) { try { f(); pass++; } catch (e) { fail++; console.log("FAIL", n, "\n  ", e.message); } }
function ok(c, m) { if (!c) throw new Error(m || "assertion failed"); }
function eq(a, b, m) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || "") + " got " + JSON.stringify(a) + " want " + JSON.stringify(b)); }
const valid = (g) => S.conflicts(g).length === 0 && g.every(Boolean);

t("generated solution is a complete valid grid", () => { ok(valid(S.generate(1, "easy").solution)); });
t("every difficulty yields a puzzle with exactly ONE solution", () => {
  for (const d of ["easy", "medium", "hard"]) for (const seed of [1, 2, 3, 99, 2026]) {
    const g = S.generate(seed, d);
    eq(S.countSolutions(g.puzzle, 2), 1, d + "/" + seed);
    ok(g.puzzle.every((v, i) => v === 0 || v === g.solution[i]), "puzzle disagrees with its solution");
  }
});
t("clue counts honour the difficulty ladder", () => {
  const c = (d) => S.generate(7, d).clues;
  ok(c("easy") > c("medium") && c("medium") >= c("hard"), c("easy") + "," + c("medium") + "," + c("hard"));
  ok(c("hard") <= 30);
});
t("deterministic: same seed, same puzzle; different seed, different puzzle", () => {
  eq(S.generate(5, "medium").puzzle, S.generate(5, "medium").puzzle);
  ok(JSON.stringify(S.generate(5, "medium").puzzle) !== JSON.stringify(S.generate(6, "medium").puzzle));
});
t("solver recovers the generated solution", () => { const g = S.generate(11, "hard"); eq(S.solve(g.puzzle), g.solution); });
t("solver rejects a board that already breaks a rule", () => {
  const g = S.generate(3, "easy"), p = g.puzzle.slice(); const a = p.findIndex(Boolean);
  const b = S.PEERS[a].find(k => !p[k]); p[b] = p[a];
  eq(S.countSolutions(p, 2), 0); eq(S.solve(p), null);
});
t("conflicts finds duplicates in row, column and box", () => {
  const g = new Array(81).fill(0); g[0] = 5; g[8] = 5; eq(S.conflicts(g).sort((x, y) => x - y), [0, 8]);
  const c = new Array(81).fill(0); c[0] = 5; c[72] = 5; eq(c.length, 81); eq(S.conflicts(c).length, 2);
  const x = new Array(81).fill(0); x[0] = 5; x[10] = 5; eq(S.conflicts(x).length, 2);
});
t("givens cannot be changed", () => {
  const s = S.newState(S.generate(1, "easy")), g = s.puzzle.findIndex(Boolean);
  ok(S.place(s, g, (s.puzzle[g] % 9) + 1) === s); ok(S.toggleNote(s, g, 1) === s);
});
t("place, erase and undo round-trip", () => {
  const s0 = S.newState(S.generate(2, "easy")), c = s0.puzzle.findIndex(v => !v);
  const s1 = S.place(s0, c, s0.solution[c]); eq(s1.grid[c], s0.solution[c]); eq(s1.moves, 1);
  eq(S.place(s1, c, 0).grid[c], 0);
  eq(S.undo(s1).grid, s0.grid); ok(S.undo(s0) === s0, "undo on empty history is a no-op");
});
t("placing a digit clears that note from its peers", () => {
  let s = S.newState(S.generate(4, "easy"));
  const empties = s.puzzle.map((v, i) => v ? -1 : i).filter(i => i >= 0);
  const c = empties[0], peer = S.PEERS[c].find(p => !s.grid[p]), d = s.solution[c];
  s = S.toggleNote(s, peer, d); ok(s.notes[peer] & (1 << d));
  s = S.place(s, c, d); ok(!(s.notes[peer] & (1 << d)));
});
t("notes toggle on and off and are refused on filled cells", () => {
  let s = S.newState(S.generate(4, "easy")); const c = s.puzzle.findIndex(v => !v);
  s = S.toggleNote(s, c, 3); eq(s.notes[c], 8); s = S.toggleNote(s, c, 3); eq(s.notes[c], 0);
  s = S.place(s, c, s.solution[c]); ok(S.toggleNote(s, c, 1) === s);
});
t("hint (now Reveal) reveals the true digit and is counted; no-op on a correct cell", () => {
  const s0 = S.newState(S.generate(8, "medium")), c = s0.puzzle.findIndex(v => !v);
  const s1 = S.hint(s0, c); eq(s1.grid[c], s0.solution[c]); eq(s1.hints, 1); ok(S.hint(s1, c) === s1);
});
// ---- power-ups ----
const emptiesOf = (s) => s.puzzle.map((v, i) => v ? -1 : i).filter(i => i >= 0);
const unitDone = (s, u) => S.UNIT[u].every(c => s.grid[c] === s.solution[c]);
// fill every empty cell of unit u except `leave` (correctly), returning the state
function fillUnit(s, u, leave) { S.UNIT[u].forEach(c => { if (c !== leave && !s.grid[c]) s = S.place(s, c, s.solution[c]); }); return s; }
function openUnit(s) { for (let u = 0; u < 27; u++) { const e = S.UNIT[u].filter(c => !s.grid[c]); if (e.length >= 2) return u; } }

t("new game stock: one Reveal, nothing else; nothing used; all-given units pre-paid", () => {
  const s = S.newState(S.generate(1, "easy"));
  eq(s.stock, { reveal: 1, check: 0, cands: 0 }); eq(s.used, { reveal: 0, check: 0, cands: 0 });
  for (let u = 0; u < 27; u++) eq(!!(s.paid & (1 << u)), unitDone(s, u), "unit " + u);
});
t("completing a correct unit pays exactly one charge, once", () => {
  let s = S.newState(S.generate(21, "medium")); const u = openUnit(s), last = S.UNIT[u].filter(c => !s.grid[c]).pop();
  s = fillUnit(s, u, last); const before = S.total(s.stock);
  const s1 = S.place(s, last, s.solution[last]);
  ok(s1.paid & (1 << u), "unit marked paid"); eq(S.total(s1.stock), before + 1); eq(s1.gain.length, 1);
  const again = S.place(S.place(s1, last, 0), last, s1.solution[last]); // erase and re-place: no second pay
  eq(S.total(again.stock), before + 1, "a unit pays only once");
});
t("one move pays at most one charge even when it finishes several units", () => {
  for (const seed of [3, 4, 5, 6]) {
    let s = S.newState(S.generate(seed, "easy")); const e = emptiesOf(s), c = e[0];
    e.forEach(k => { if (k !== c) s = S.place(s, k, s.solution[k]); });
    const t0 = S.total(s.stock), n = S.place(s, c, s.solution[c]);
    ok(n.solved); eq(S.total(n.stock) - t0, 1, "row+col+box at once still pays one");
  }
});
t("a complete but WRONG unit does not pay", () => {
  let s = S.newState(S.generate(22, "easy")); const u = openUnit(s), e = S.UNIT[u].filter(c => !s.grid[c]);
  const a = e[0], b = e[1];
  s = fillUnit(s, u, a); s = S.place(s, b, s.solution[a]); // b holds a's digit
  const t0 = S.total(s.stock); s = S.place(s, a, s.solution[b]); // unit full, digits swapped
  ok(!(s.paid & (1 << u))); eq(S.total(s.stock), t0);
});
t("a unit finished by Reveal does not pay, and Reveal spends its charge", () => {
  let s = S.newState(S.generate(23, "medium")); const u = openUnit(s), last = S.UNIT[u].filter(c => !s.grid[c]).pop();
  s = fillUnit(s, u, last); s.stock = Object.assign({}, s.stock, { reveal: 1 });
  const t0 = S.total(s.stock), n = S.reveal(s, last);
  eq(n.grid[last], s.solution[last]); ok(n.paid & (1 << u), "marked paid so it never pays later");
  eq(n.stock.reveal, 0); eq(n.used.reveal, 1); eq(S.total(n.stock), t0 - 1); eq(n.hints, 1);
  ok(S.reveal(n, emptiesOf(n).find(c => !n.grid[c])) === n, "no charge, no reveal");
});
t("Reveal is refused on givens and correct cells (no charge spent)", () => {
  const s = S.newState(S.generate(8, "medium")), g = s.puzzle.findIndex(Boolean), c = s.puzzle.findIndex(v => !v);
  ok(S.reveal(s, g) === s); const p = S.place(s, c, s.solution[c]); ok(S.reveal(p, c) === p);
  const w = S.place(s, c, (s.solution[c] % 9) + 1), r = S.reveal(w, c); eq(r.grid[c], s.solution[c], "fixes a wrong digit");
});
t("undo rewinds a reward (re-earning gives the same kind, net zero)", () => {
  let s = S.newState(S.generate(24, "medium")); const u = openUnit(s), last = S.UNIT[u].filter(c => !s.grid[c]).pop();
  s = fillUnit(s, u, last); const stock0 = s.stock;
  const s1 = S.place(s, last, s.solution[last]), u1 = S.undo(s1);
  eq(u1.stock, stock0); ok(!(u1.paid & (1 << u)));
  const s2 = S.place(u1, last, s.solution[last]); eq(s2.stock, s1.stock, "same reward, deterministic");
});
t("undo never refunds a spent charge, so nothing can be farmed", () => {
  let s = S.newState(S.generate(25, "medium")); const c = emptiesOf(s)[0];
  const r = S.reveal(s, c); eq(r.stock.reveal, 0);
  const back = S.undo(r); eq(back.grid[c], 0); eq(back.stock.reveal, 0, "reveal stays spent"); eq(back.used.reveal, 1);
  // earn -> spend -> undo both -> re-earn: still net zero (the debt is repaid)
  let a = S.newState(S.generate(26, "medium")); a.stock = { reveal: 0, check: 0, cands: 0 };
  const u = openUnit(a), last = S.UNIT[u].filter(k => !a.grid[k]).pop(); a = fillUnit(a, u, last);
  const steps = a.history.length, b = S.place(a, last, a.solution[last]), k = b.gain[0];
  let x = k === "check" ? S.check(b).state : k === "reveal" ? S.reveal(b, emptiesOf(b).find(q => !b.grid[q])) : S.fillBox(b, emptiesOf(b).find(q => !b.grid[q]));
  eq(x.stock[k], 0);
  while (x.history.length > steps) x = S.undo(x);
  ok(!(x.stock[k] > 0), "no usable charge after rewinding the reward");
  const y = S.place(x, last, x.solution[last]); eq(y.stock[k], 0, "re-earning repays the debt: " + JSON.stringify(y.stock));
});
t("the stock caps at 9 per kind and stays deterministic per seed", () => {
  const run = (seed) => { let s = S.newState(S.generate(seed, "easy")); emptiesOf(s).forEach(c => { s = S.place(s, c, s.solution[c]); }); return s.stock; };
  const a = run(31); eq(a, run(31)); S.KINDS.forEach(k => ok(a[k] <= 9, k));
  let s = S.newState(S.generate(32, "easy")); s.stock = { reveal: 9, check: 9, cands: 8 };
  const u = openUnit(s), last = S.UNIT[u].filter(c => !s.grid[c]).pop(); s = fillUnit(s, u, last);
  s.stock = { reveal: 9, check: 9, cands: 8 }; s = S.place(s, last, s.solution[last]); eq(s.stock, { reveal: 9, check: 9, cands: 9 });
});
t("Check marks exactly the wrong digits, spends once, leaves the board and history alone", () => {
  let s = S.newState(S.generate(27, "medium")); const e = emptiesOf(s);
  ok(S.check(Object.assign({}, s, { stock: { reveal: 1, check: 1, cands: 0 } })).wrong.length === 0);
  eq(S.check(Object.assign({}, s, { stock: { reveal: 1, check: 1, cands: 0 } })).state.used.check, 0, "refused with no placed digits");
  s = S.place(s, e[0], s.solution[e[0]]); s = S.place(s, e[1], (s.solution[e[1]] % 9) + 1);
  s.stock = Object.assign({}, s.stock, { check: 1 });
  const r = S.check(s); eq(r.wrong, [e[1]]); eq(r.state.stock.check, 0); eq(r.state.used.check, 1);
  eq(r.state.grid, s.grid); eq(r.state.history.length, s.history.length);
  ok(S.check(r.state).state === r.state, "no charge left");
});
t("Candidates fills the box from the board only and is undoable without refund", () => {
  let s = S.newState(S.generate(28, "hard")); s.stock = { reveal: 1, check: 0, cands: 1 };
  const c = emptiesOf(s)[0], n = S.fillBox(s, c), box = S.UNIT[18 + S.BOX[c]];
  box.forEach(k => {
    if (s.grid[k]) return eq(n.notes[k], 0);
    ok(n.notes[k] & (1 << s.solution[k]), "true digit is a candidate");
    S.PEERS[k].forEach(p => { if (s.grid[p]) ok(!(n.notes[k] & (1 << s.grid[p])), "no peer digit"); });
  });
  eq(n.stock.cands, 0); eq(n.used.cands, 1);
  ok(S.fillBox(n, c) === n, "no charge left"); const back = S.undo(n); eq(back.notes, s.notes); eq(back.stock.cands, 0);
  const again = Object.assign({}, n, { stock: { reveal: 1, check: 0, cands: 1 } }); ok(S.fillBox(again, c) === again, "already filled: refused, not spent");
});
t("solved board refuses every power-up", () => {
  let s = S.newState(S.generate(9, "easy")); emptiesOf(s).forEach(c => { s = S.place(s, c, s.solution[c]); });
  s.stock = { reveal: 3, check: 3, cands: 3 }; ok(s.solved);
  ok(S.check(s).state === s); ok(S.fillBox(s, 0) === s); ok(S.reveal(s, 0) === s);
});
t("old saves (before power-ups) upgrade cleanly and keep their progress", () => {
  let s = S.newState(S.generate(29, "easy")); const e = emptiesOf(s);
  s = S.place(s, e[0], s.solution[e[0]]);
  const old = JSON.parse(JSON.stringify(s)); delete old.stock; delete old.used; delete old.paid; delete old.gain; old.hints = 2;
  old.history = old.history.map(h => ({ grid: h.grid, notes: h.notes }));
  const u = S.upgrade(old);
  eq(u.grid, s.grid); eq(u.stock, S.START); eq(u.used, { reveal: 2, check: 0, cands: 0 }); eq(u.paid, S.unitMask(u.grid, u.solution));
  eq(S.undo(u).grid[e[0]], 0, "old history entries still undo");
  const bad = Object.assign({}, s, { stock: { reveal: 40, check: 0, cands: 0 } }); eq(S.upgrade(bad).stock.reveal, 9, "clamped to the cap");
});
t("uniqueness still holds across many seeds (power-ups never touch the generator)", () => {
  for (let seed = 100; seed < 112; seed++) eq(S.countSolutions(S.generate(seed, ["easy", "medium", "hard"][seed % 3]).puzzle, 2), 1);
});

t("completing the grid correctly marks solved and locks the board", () => {
  let s = S.newState(S.generate(9, "easy"));
  s.grid.forEach((v, i) => { if (!v) s = S.place(s, i, s.solution[i]); });
  ok(s.solved); ok(S.place(s, s.puzzle.findIndex(v => !v), 1) === s, "solved board is locked");
});
t("a full but wrong grid is NOT solved", () => {
  let s = S.newState(S.generate(9, "easy")); const empties = s.puzzle.map((v, i) => v ? -1 : i).filter(i => i >= 0);
  empties.forEach(i => { s = S.place(s, i, s.solution[i]); });
  ok(s.solved);
  const bad = Object.assign({}, S.undo(s)); // one cell short, then fill it wrongly
  const last = empties[empties.length - 1], wrong = (s.solution[last] % 9) + 1;
  ok(!S.place(bad, last, wrong).solved);
});

const root = path.join(__dirname, "..");
const files = ["sudoku/engine.js", "sudoku/game.js", "sudoku/index.html", "sudoku/style.css"].map(f => [f, fs.readFileSync(path.join(root, f), "utf8")]);
t("sudoku: no document.write, no em-dashes, SPDX header, no CDN", () => files.forEach(([f, s]) => {
  ok(!/document\.write/.test(s), f); ok(!/—/.test(s), f); ok(/SPDX-License-Identifier: Apache-2\.0/.test(s), f);
  ok(!/https?:\/\/(cdn|unpkg|cdnjs)/.test(s), f);
}));
t("sudoku: every localStorage call is guarded by try", () => {
  const lines = files.find(f => f[0] === "sudoku/game.js")[1].split("\n");
  lines.forEach((ln, i) => { if (/localStorage\./.test(ln)) ok(/try\s*\{/.test(lines.slice(Math.max(0, i - 2), i + 1).join(" ")), "unguarded at line " + (i + 1)); });
});
t("sudoku page loads the shared kit and power scripts, but not theme.css or nav.js (no look change)", () => {
  const h = files.find(f => f[0] === "sudoku/index.html")[1];
  ok(/shared\/kit\.js/.test(h) && /shared\/power\.js/.test(h)); ok(!/shared\/theme\.css/.test(h) && !/shared\/nav\.js/.test(h));
  ok(/id="tray"/.test(h) && /id="notes"/.test(h) && /id="erase"/.test(h) && !/id="hint"/.test(h));
});
// theme.css/nav.js would change the live look (owner rule), so the page check of conventions.js is skipped here
require("./conventions")(t, ok, ["sudoku/engine.js", "sudoku/game.js", "sudoku/style.css"]);
console.log(pass + " passed, " + fail + " failed"); process.exit(fail ? 1 : 0);
