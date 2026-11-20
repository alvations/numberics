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
t("the clue ladder holds exactly: easy 40, medium 32, hard 26 on every seed (mechanics nit: one Hard had 27)", () => {
  for (let seed = 1; seed <= 150; seed++) for (const d of ["easy", "medium", "hard"]) {
    const g = S.generate(seed, d); eq(g.clues, S.CLUES[d], d + "/" + seed); eq(g.puzzle.filter(Boolean).length, g.clues);
  }
  for (const seed of [31, 121]) eq(S.countSolutions(S.generate(seed, "hard").puzzle, 2), 1, "a re-dug Hard puzzle (seed " + seed + " stopped at 27 before) is still unique");
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

t("new game stock: one Reveal, nothing else; nothing used; no progress yet", () => {
  const s = S.newState(S.generate(1, "easy"));
  eq(s.stock, { reveal: 1, check: 0, cands: 0 }); eq(s.used, { reveal: 0, check: 0, cands: 0 }); eq(s.high, 0); eq(S.filled(s), 0);
});
// fill n empty cells (in order) with `digit(c)`; returns the state
function fillN(s, n, digit) { const e = emptiesOf(s).filter(c => !s.grid[c]); for (let i = 0; i < n; i++) s = S.place(s, e[i], digit(s, e[i])); return s; }
const right = (s, c) => s.solution[c], wrongD = (s, c) => (s.solution[c] % 9) + 1;
t("progress pays one charge at every new multiple of 9 filled cells, and only there", () => {
  let s = S.newState(S.generate(21, "medium")), t0 = S.total(s.stock);
  for (let i = 1; i <= 27; i++) {
    s = fillN(s, 1, right);
    eq(S.total(s.stock) - t0, Math.floor(i / 9), "after " + i + " cells");
    eq(s.gain.length, i % 9 === 0 ? 1 : 0, "gain flag at " + i);
  }
});
// a wrong digit that clashes with nothing on the board (0 if the cell has none)
const quiet = (s, c) => { const m = S.candidates(s.grid, c) & ~(1 << s.solution[c]); for (let d = 1; d <= 9; d++) if (m & (1 << d)) return d; return 0; };
// place `n` quiet wrong digits, then the same cells right on a fresh copy; returns [wrongState, rightState]
function quietPair(seed, d, n) {
  let w = S.newState(S.generate(seed, d)), r = S.newState(S.generate(seed, d)); const used = [];
  for (const c of emptiesOf(w)) { if (used.length === n) break; const q = quiet(w, c); if (!q) continue; w = S.place(w, c, q); used.push(c); }
  used.forEach(c => { r = S.place(r, c, r.solution[c]); });
  return [w, r, used];
}
t("a reward reveals nothing: wrong digits that clash with nothing earn exactly like right ones", () => {
  for (const seed of [3, 7, 21]) {
    const [b, a, used] = quietPair(seed, "medium", 18); eq(used.length, 18, "enough quiet cells");
    eq(S.conflicts(b.grid), [], "no clash shown"); eq(S.total(a.stock), S.total(b.stock)); eq(a.stock, b.stock, "same kinds, same order");
  }
  // the old leak (mechanics #3): the last cell of a unit right or wrong. A wrong digit there always clashes, and the
  // clash is already painted red, so the only difference in pay is one the board already shows.
  let s = S.newState(S.generate(3, "medium")); const u = openUnit(s), last = S.UNIT[u].filter(c => !s.grid[c]).pop();
  s = fillUnit(s, u, last);
  const w = S.place(s, last, wrongD(s, last));
  ok(S.conflicts(w.grid).indexOf(last) >= 0, "the wrong last digit is shown red");
  eq(S.progress(w), emptiesOf(w).filter(c => w.grid[c] && S.conflicts(w.grid).indexOf(c) < 0).length, "progress is read off the visible board");
});
t("junk fill earns nothing (TRIAGE2 Sudoku, mechanics #2): only filled cells with no conflict count", () => {
  for (const d of ["easy", "medium", "hard"]) for (const seed of [1, 2, 3]) {
    let s = S.newState(S.generate(seed, d)); const t0 = S.total(s.stock);
    emptiesOf(s).forEach(c => { s = S.place(s, c, 1); }); // the repro: type 1 into every empty cell
    ok(S.total(s.stock) - t0 <= 1, d + "/" + seed + ": junk paid " + (S.total(s.stock) - t0));
    // the paid count matches what the board shows: cells filled and not red
    const shown = emptiesOf(s).filter(c => s.grid[c] && S.conflicts(s.grid).indexOf(c) < 0).length;
    eq(S.progress(s), shown, "progress is exactly the filled cells not painted red");
    emptiesOf(s).forEach(c => { s = S.place(s, c, 0); });
    ok(S.total(s.stock) - t0 <= 1, "erasing it all keeps at most the honest part");
  }
});
t("progress counts each digit only while it clashes with nothing; the mark keeps what was reached", () => {
  let s = S.newState(S.generate(41, "medium")); const e = emptiesOf(s);
  s = fillN(s, 8, right); eq(S.progress(s), 8); eq(s.high, 8);
  const c = e.find(k => !s.grid[k]), peer = S.PEERS[c].find(k => !s.grid[k]);
  const x = S.place(S.place(s, c, s.solution[c]), peer, s.solution[c]); // a clash: both cells turn red
  eq(S.progress(x), 8, "both clashing cells drop out (10 filled, 8 count)"); eq(x.high, 9, "the mark keeps 9"); eq(S.total(x.stock), S.total(s.stock) + 1);
  const y = S.place(x, peer, 0); eq(S.progress(y), 9, "erase the clash: the other cell counts again");
  const z = fillN(y, 1, right); eq(S.progress(z), 10); eq(z.high, 10); eq(S.total(z.stock), S.total(x.stock), "10: no new step");
});
t("the high-water mark never drops: Erase and Undo cannot farm a charge twice", () => {
  let s = S.newState(S.generate(24, "medium")); s = fillN(s, 8, right);
  const c = emptiesOf(s).find(k => !s.grid[k]), t0 = S.total(s.stock);
  const s1 = S.place(s, c, s.solution[c]); eq(S.total(s1.stock), t0 + 1);
  const u1 = S.undo(s1); eq(u1.grid[c], 0); eq(u1.stock, s1.stock, "Undo keeps an earned charge"); eq(u1.high, 9, "and the mark");
  const s2 = S.place(u1, c, s.solution[c]); eq(S.total(s2.stock), t0 + 1, "re-filling after Undo pays nothing");
  const e2 = S.place(S.place(s2, c, 0), c, s.solution[c]); eq(S.total(e2.stock), t0 + 1, "erase and re-fill pays nothing");
  // reach 18 only by filling 9 NEW cells above the mark
  let x = S.place(e2, c, 0); x = fillN(x, 9, right); eq(S.total(x.stock), t0 + 1, "back at 17 filled: no new step");
  x = fillN(x, 1, right); eq(S.total(x.stock), t0 + 2);
});
t("a cell filled by Reveal never counts and never pays (R2), and Reveal spends its charge", () => {
  let s = S.newState(S.generate(23, "medium")); s = fillN(s, 8, right);
  const c = emptiesOf(s).find(k => !s.grid[k]), t0 = S.total(s.stock);
  const n = S.reveal(s, c);
  eq(n.grid[c], s.solution[c]); eq(n.high, 8); eq(S.progress(n), 8); eq(n.revealed, [c]); eq(n.gain, []);
  eq(n.stock.reveal, s.stock.reveal - 1); eq(S.total(n.stock), t0 - 1); eq(n.hints, 1); eq(n.free, false, "an empty-cell Reveal cannot help a later move");
  ok(S.reveal(Object.assign({}, n, { stock: { reveal: 0, check: 0, cands: 0 } }), emptiesOf(n).find(k => !n.grid[k])).grid, "refused without a charge");
  // Reveal then Undo then type the shown digit: no reward (mechanics #4)
  const back = S.undo(n), typed = S.place(back, c, s.solution[c]);
  eq(typed.gain, []); eq(S.total(typed.stock), t0 - 1);
});
t("the move that solves the board never pays (a charge would be useless)", () => {
  for (const seed of [3, 4, 5, 6, 40, 41, 42]) for (const d of ["easy", "medium", "hard"]) {
    let s = S.newState(S.generate(seed, d)); const e = emptiesOf(s), c = e[e.length - 1];
    e.forEach(k => { if (k !== c) s = S.place(s, k, s.solution[k]); });
    const n = S.place(s, c, s.solution[c]); ok(n.solved); eq(n.gain, [], d + "/" + seed); eq(n.stock, s.stock);
  }
});
t("Reveal is refused on givens and correct cells (no charge spent)", () => {
  const s = S.newState(S.generate(8, "medium")), g = s.puzzle.findIndex(Boolean), c = s.puzzle.findIndex(v => !v);
  ok(S.reveal(s, g) === s); const p = S.place(s, c, s.solution[c]); ok(S.reveal(p, c) === p);
  const w = S.place(s, c, (s.solution[c] % 9) + 1), r = S.reveal(w, c); eq(r.grid[c], s.solution[c], "fixes a wrong digit");
});
t("undo never refunds a spent charge (R3)", () => {
  let s = S.newState(S.generate(25, "medium")); const c = emptiesOf(s)[0];
  const r = S.reveal(s, c); eq(r.stock.reveal, 0);
  const back = S.undo(r); eq(back.grid[c], 0); eq(back.stock.reveal, 0, "reveal stays spent"); eq(back.used.reveal, 1);
  let a = fillN(S.newState(S.generate(26, "medium")), 9, right); a.stock = { reveal: 0, check: 1, cands: 1 };
  const k = S.check(a).state; eq(S.undo(k).stock.check, 0, "Check is not an Undo step and stays spent");
  const f = S.fillBox(a, emptiesOf(a).find(q => !a.grid[q])); eq(S.undo(f).stock.cands, 0, "Candidates stays spent");
});
t("property: no sequence of moves, erases and undos earns more than one charge per 9 cells ever filled", () => {
  for (let seed = 1; seed <= 12; seed++) {
    let s = S.newState(S.generate(seed, ["easy", "medium", "hard"][seed % 3])), r = S.generate(seed, "easy").seed * 7 + 1;
    const rand = () => { r = (Math.imul(r, 1103515245) + 12345) >>> 0; return r / 4294967296; };
    const start = S.total(s.stock);
    for (let i = 0; i < 600 && !s.solved; i++) {
      const e = emptiesOf(s), c = e[Math.floor(rand() * e.length)], x = rand(), was = s;
      s = x < 0.15 ? S.undo(s) : x < 0.25 ? S.place(s, c, 0) : S.place(s, c, rand() < 0.7 ? s.solution[c] : 1 + Math.floor(rand() * 9));
      ok(S.total(s.stock) - start <= Math.floor(s.high / 9), "seed " + seed + " step " + i);
      if (x >= 0.25 && s !== was) ok(s.high >= S.progress(s), "after a digit, the mark is never below the board");
    }
  }
});
t("R2 property: a power-up never pays, and never helps the next digit pay (random games, every power-up)", () => {
  let uses = 0, paidAlone = 0, filledReveals = 0;
  for (let seed = 1; seed <= 30; seed++) {
    let s = S.newState(S.generate(seed, ["easy", "medium", "hard"][seed % 3])), r = seed * 2654435761 >>> 0;
    const rand = () => { r = (Math.imul(r, 1103515245) + 12345) >>> 0; return r / 4294967296; };
    for (let i = 0; i < 260 && !s.solved; i++) {
      const open = emptiesOf(s), c = open[Math.floor(rand() * open.length)], x = rand();
      if (x < 0.22) { // a power-up, with charges to spend
        const g = Object.assign({}, s, { stock: { reveal: 3, check: 3, cands: 3 } }), kind = rand();
        const u = kind < 0.6 ? S.reveal(g, c) : kind < 0.8 ? S.fillBox(g, c) : S.check(g).state;
        if (u === g) continue;
        uses++; if (kind < 0.6 && g.grid[c]) filledReveals++;
        ok(S.total(u.stock) === S.total(g.stock) - 1 && !u.gain.length, "a power-up pays nothing, seed " + seed + " step " + i);
        // every next digit, against the same digit without the power-up
        for (let k = 0; k < 40; k++) {
          const m = open[Math.floor(rand() * open.length)], d = 1 + Math.floor(rand() * 9);
          const g0 = S.total(S.place(g, m, d).stock) - S.total(g.stock), g1 = S.total(S.place(u, m, d).stock) - S.total(u.stock);
          if (g0 > 0) paidAlone++;
          ok(g1 <= g0, "digit " + d + " at " + m + " after a power-up paid where it alone does not, seed " + seed + " step " + i);
        }
        s = u; continue;
      }
      const v = rand();
      s = x < 0.3 ? S.undo(s) : x < 0.38 ? S.place(s, c, 0) :
        S.place(s, c, v < 0.6 ? s.solution[c] : v < 0.85 ? (quiet(s, c) || s.solution[c]) : 1 + Math.floor(rand() * 9));
    }
  }
  ok(uses > 300 && filledReveals > 30 && paidAlone > 30, "exercised " + uses + " uses, " + filledReveals + " reveals over a digit, " + paidAlone + " paying digits");
});
t("R2: a Reveal over a digit can clear a clash, so the next digit placed pays nothing", () => {
  // build: 7 counted cells, then a wrong digit at c that clashes with a typed digit at x, so neither counts
  let found = false;
  for (let seed = 60; seed < 90 && !found; seed++) {
    let s = S.newState(S.generate(seed, "medium")); const e = emptiesOf(s);
    for (const c of e) {
      const x = S.PEERS[c].find(k => !s.puzzle[k] && s.solution[k] !== s.solution[c]);
      if (x === undefined) continue;
      let t = S.place(s, x, s.solution[x]); t = S.place(t, c, s.solution[x]); // c clashes with x
      if (S.progress(t) !== 0) continue;
      const rest = e.filter(k => k !== c && k !== x && !S.PEERS[k].includes(c) && !S.PEERS[k].includes(x));
      if (rest.length < 9) continue;
      for (let i = 0; i < 7; i++) t = S.place(t, rest[i], t.solution[rest[i]]);
      if (S.progress(t) !== 7 || t.high !== 7) continue;
      t.stock = { reveal: 1, check: 0, cands: 0 };
      const rv = S.reveal(t, c); // x is free again: progress 8, absorbed by the mark, and `free` is set
      eq(S.progress(rv), 8); eq(rv.high, 8); ok(rv.free); eq(rv.gain, []);
      const next = S.place(rv, rest[7], t.solution[rest[7]]);
      eq(S.progress(next), 9); eq(next.gain, [], "the digit after the Reveal pays nothing"); ok(!next.free);
      eq(S.total(S.place(t, rest[7], t.solution[rest[7]]).stock), S.total(t.stock), "and alone it would not pay either");
      const after = S.place(next, rest[8], t.solution[rest[8]]); eq(after.gain, [], "10: below the next step");
      found = true; break;
    }
  }
  ok(found, "built the case");
});
t("R2: a revealed cell never counts, even after Erase and typing it again", () => {
  let s = S.newState(S.generate(43, "easy")); s = fillN(s, 8, right);
  const c = emptiesOf(s).find(k => !s.grid[k]), n = S.reveal(s, c);
  const again = S.place(S.place(n, c, 0), c, s.solution[c]); eq(S.progress(again), 8); eq(again.gain, []);
  const undone = S.place(S.undo(n), c, s.solution[c]); eq(S.progress(undone), 8, "Undo keeps the mark of a revealed cell"); eq(undone.revealed, [c]);
});
t("the stock caps at 9 per kind and stays deterministic per seed", () => {
  const run = (seed) => { let s = S.newState(S.generate(seed, "hard")); emptiesOf(s).forEach(c => { s = S.place(s, c, s.solution[c]); }); return s.stock; };
  const a = run(31); eq(a, run(31)); S.KINDS.forEach(k => ok(a[k] <= 9, k));
  let s = fillN(S.newState(S.generate(32, "easy")), 8, right); s.stock = { reveal: 9, check: 9, cands: 8 };
  s = fillN(s, 1, right); eq(s.stock, { reveal: 9, check: 9, cands: 9 });
  s = fillN(s, 9, right); eq(s.stock, { reveal: 9, check: 9, cands: 9 }, "all full: nothing more");
});
t("a full puzzle pays about 4 to 6 charges (easy 4, medium 5, hard 5 or 6)", () => {
  const want = { easy: [4, 4], medium: [5, 5], hard: [5, 6] };
  for (const d of ["easy", "medium", "hard"]) for (let seed = 50; seed < 56; seed++) {
    let s = S.newState(S.generate(seed, d)); const t0 = S.total(s.stock);
    emptiesOf(s).forEach(c => { s = S.place(s, c, s.solution[c]); });
    const got = S.total(s.stock) - t0; ok(got >= want[d][0] && got <= want[d][1], d + "/" + seed + ": " + got);
  }
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
t("R1: Undo is refused on a solved board, so a solved puzzle stays solved (blocker)", () => {
  for (const d of ["easy", "medium", "hard"]) {
    let s = S.newState(S.generate(12, d)); emptiesOf(s).forEach(c => { s = S.place(s, c, s.solution[c]); });
    ok(s.solved && s.history.length > 0); ok(!S.canUndo(s)); ok(S.undo(s) === s, d + ": undo returned a new state");
    ok(S.place(s, emptiesOf(s)[0], 0) === s, "erase refused too");
    ok(S.toggleNote(s, emptiesOf(s)[0], 1) === s);
  }
  const s0 = S.newState(S.generate(12, "easy")); ok(!S.canUndo(s0), "nothing to undo at the start");
  ok(S.canUndo(S.place(s0, emptiesOf(s0)[0], 1)));
});
t("old saves (before power-ups) upgrade cleanly and keep their progress", () => {
  let s = S.newState(S.generate(29, "easy")); const e = emptiesOf(s);
  s = S.place(s, e[0], s.solution[e[0]]);
  const old = JSON.parse(JSON.stringify(s)); delete old.stock; delete old.used; delete old.high; delete old.gain; old.hints = 2;
  const u = S.upgrade(old);
  eq(u.grid, s.grid); eq(u.stock, S.START); eq(u.used, { reveal: 2, check: 0, cands: 0 }); eq(u.high, 1, "progress so far pays nothing again");
  eq(S.undo(u).grid[e[0]], 0, "old history entries still undo");
  const bad = Object.assign({}, s, { stock: { reveal: 40, check: 0, cands: 0 } }); eq(S.upgrade(bad).stock.reveal, 9, "clamped to the cap");
  eq(u.revealed, [], "no revealed list in an old save"); eq(u.free, false);
});
t("saves from the unit-reward version (paid mask, stock in history, a debt) load and play on", () => {
  let s = S.newState(S.generate(30, "medium")); s = fillN(s, 12, right);
  const old = JSON.parse(JSON.stringify(s)); delete old.high; old.paid = 5;
  old.history = old.history.map(h => Object.assign({}, h, { stock: { reveal: 1, check: 0, cands: 0 }, used: { reveal: 0, check: 0, cands: 0 }, paid: 1 }));
  old.stock = { reveal: 2, check: -1, cands: 1 };
  const u = S.upgrade(old);
  ok(!("paid" in u)); eq(u.high, 12); eq(u.stock, { reveal: 2, check: 0, cands: 1 }, "a debt is forgiven, the rest kept");
  const back = S.undo(u); eq(back.stock, u.stock, "old history stock is ignored by Undo"); eq(S.filled(back), 11);
  let x = fillN(u, 5, right); eq(S.total(x.stock), S.total(u.stock), "16 filled: below the next step");
  x = fillN(x, 2, right); eq(S.total(x.stock), S.total(u.stock) + 1, "18 filled pays");
  const solvedOld = JSON.parse(JSON.stringify(old)); solvedOld.grid = solvedOld.solution.slice(); solvedOld.solved = true;
  ok(S.upgrade(solvedOld).solved && S.undo(S.upgrade(solvedOld)).solved, "an old solved save stays locked");
  // a save made under the any-digit rule with junk on the board keeps its mark and stock, and pays nothing more for it
  let j = S.newState(S.generate(31, "hard")); emptiesOf(j).forEach(c => { j = S.place(j, c, 1); });
  const junk = JSON.parse(JSON.stringify(j)); junk.high = S.filled(j); delete junk.revealed; delete junk.free;
  const ju = S.upgrade(junk); eq(ju.high, S.filled(j), "the old mark is never lowered"); eq(ju.stock, j.stock);
  const jp = S.place(S.place(ju, emptiesOf(ju)[0], 0), emptiesOf(ju)[0], ju.solution[emptiesOf(ju)[0]]); eq(jp.gain, []);
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
  const last = empties[empties.length - 1];
  empties.forEach(i => { if (i !== last) s = S.place(s, i, s.solution[i]); });
  ok(!s.solved); // one cell short, then fill it wrongly
  ok(!S.place(s, last, (s.solution[last] % 9) + 1).solved);
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
t("sudoku page loads the shared kit, power and nav scripts (the games row), but not theme.css (no look change)", () => {
  const h = files.find(f => f[0] === "sudoku/index.html")[1];
  ok(/shared\/kit\.js/.test(h) && /shared\/power\.js/.test(h)); ok(!/shared\/theme\.css/.test(h) && /shared\/nav\.js/.test(h) && /id="games"/.test(h));
  ok(/id="tray"/.test(h) && /id="notes"/.test(h) && /id="erase"/.test(h) && !/id="hint"/.test(h));
});
t("sudoku client: the clock is banked and saved on pagehide and when hidden (a reload cannot freeze it)", () => {
  const g = files.find(f => f[0] === "sudoku/game.js")[1];
  ok(/addEventListener\("pagehide",[^\n]*bank\(\);\s*save\(\)/.test(g), "pagehide");
  ok(/addEventListener\("visibilitychange",[^\n]*bank\(\);\s*save\(\)/.test(g) && !/if \(!document\.hidden\) save\(\)/.test(g), "hidden");
});
t("sudoku client: no hyphen as an empty value, no '-' Best (R11), no 'Unit complete' jargon (S6)", () => {
  const h = files.find(f => f[0] === "sudoku/index.html")[1], g = files.find(f => f[0] === "sudoku/game.js")[1];
  ok(!/<b id="best">-<\/b>/.test(h) && !/: "-"/.test(g)); ok(!/Unit complete/.test(g));
});
// theme.css would change the live look (owner rule), so the page check of conventions.js is skipped here
require("./conventions")(t, ok, ["sudoku/engine.js", "sudoku/game.js", "sudoku/style.css"]);
console.log(pass + " passed, " + fail + " failed"); process.exit(fail ? 1 : 0);
