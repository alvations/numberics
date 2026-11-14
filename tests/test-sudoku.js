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
t("hint reveals the true digit and is counted; no-op on a correct cell", () => {
  const s0 = S.newState(S.generate(8, "medium")), c = s0.puzzle.findIndex(v => !v);
  const s1 = S.hint(s0, c); eq(s1.grid[c], s0.solution[c]); eq(s1.hints, 1); ok(S.hint(s1, c) === s1);
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
console.log(pass + " passed, " + fail + " failed"); process.exit(fail ? 1 : 0);
