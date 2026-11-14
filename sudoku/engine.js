/* SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 alvations (Melon Lab)
 *
 * Numberics Sudoku: pure engine. No DOM, no storage, no clock. A board is an
 * array of 81 ints (0 = empty). Puzzles are generated from a seed and always
 * have exactly ONE solution (checked by counting solutions up to 2).
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.NumbericsSudoku = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var CLUES = { easy: 40, medium: 32, hard: 26 };

  function rng(seed) { // mulberry32 closure
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffle(arr, r) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(r() * (i + 1)), t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  var ROW = [], COL = [], BOX = [];
  for (var i = 0; i < 81; i++) {
    ROW[i] = Math.floor(i / 9); COL[i] = i % 9;
    BOX[i] = Math.floor(ROW[i] / 3) * 3 + Math.floor(COL[i] / 3);
  }
  var PEERS = [];
  for (i = 0; i < 81; i++) {
    PEERS[i] = [];
    for (var j = 0; j < 81; j++)
      if (j !== i && (ROW[j] === ROW[i] || COL[j] === COL[i] || BOX[j] === BOX[i])) PEERS[i].push(j);
  }

  // Backtracking with most-constrained-cell choice over bitmasks.
  // `limit` stops counting early; `r` (optional) randomises digit order for generation.
  function search(grid, limit, r, out) {
    var rows = new Array(9).fill(0), cols = new Array(9).fill(0), boxes = new Array(9).fill(0);
    var g = grid.slice(), c;
    for (c = 0; c < 81; c++) if (g[c]) {
      var bit = 1 << g[c];
      if ((rows[ROW[c]] | cols[COL[c]] | boxes[BOX[c]]) & bit) return 0; // given board already breaks a rule
      rows[ROW[c]] |= bit; cols[COL[c]] |= bit; boxes[BOX[c]] |= bit;
    }
    var count = 0;
    function rec() {
      var best = -1, bestMask = 0, bestN = 10;
      for (var k = 0; k < 81; k++) if (!g[k]) {
        var used = rows[ROW[k]] | cols[COL[k]] | boxes[BOX[k]], n = 0;
        for (var d = 1; d <= 9; d++) if (!(used & (1 << d))) n++;
        if (n < bestN) { bestN = n; best = k; bestMask = used; if (n === 0) return; }
      }
      if (best < 0) { count++; if (out && !out.sol) out.sol = g.slice(); return; }
      var digits = [1, 2, 3, 4, 5, 6, 7, 8, 9];
      if (r) shuffle(digits, r);
      for (var x = 0; x < 9 && count < limit; x++) {
        var dd = digits[x], b = 1 << dd;
        if (bestMask & b) continue;
        g[best] = dd; rows[ROW[best]] |= b; cols[COL[best]] |= b; boxes[BOX[best]] |= b;
        rec();
        g[best] = 0; rows[ROW[best]] &= ~b; cols[COL[best]] &= ~b; boxes[BOX[best]] &= ~b;
      }
    }
    rec();
    return count;
  }

  function countSolutions(grid, limit) { return search(grid, limit || 2, null, null); }
  function solve(grid) { var o = {}; search(grid, 1, null, o); return o.sol || null; }

  function generate(seed, difficulty) {
    var target = CLUES[difficulty] || CLUES.medium, r = rng(seed);
    var o = {}; search(new Array(81).fill(0), 1, r, o);
    var solution = o.sol, puzzle = solution.slice(), clues = 81;
    var order = shuffle(Array.from({ length: 81 }, function (_, k) { return k; }), r);
    for (var n = 0; n < 81 && clues > target; n++) {
      var cell = order[n], keep = puzzle[cell];
      puzzle[cell] = 0;
      if (countSolutions(puzzle, 2) !== 1) puzzle[cell] = keep; else clues--;
    }
    return { puzzle: puzzle, solution: solution, clues: clues, difficulty: difficulty, seed: seed >>> 0 };
  }

  // Cells that share a digit with a peer: what the UI paints red.
  function conflicts(grid) {
    var bad = [];
    for (var c = 0; c < 81; c++) {
      if (!grid[c]) continue;
      for (var p = 0; p < PEERS[c].length; p++) if (grid[PEERS[c][p]] === grid[c]) { bad.push(c); break; }
    }
    return bad;
  }
  function isComplete(grid) { return grid.every(Boolean) && conflicts(grid).length === 0; }

  // ---- game state: { puzzle, solution, grid, notes[81] (bitmask), given[81], moves, hints, history[] } ----
  function newState(gen) {
    return { puzzle: gen.puzzle.slice(), solution: gen.solution.slice(), grid: gen.puzzle.slice(),
             notes: new Array(81).fill(0), difficulty: gen.difficulty, seed: gen.seed,
             moves: 0, hints: 0, history: [], solved: false };
  }
  function isGiven(s, c) { return s.puzzle[c] !== 0; }
  function cloneState(s) {
    var n = Object.assign({}, s);
    n.grid = s.grid.slice(); n.notes = s.notes.slice(); n.history = s.history.slice();
    return n;
  }
  function remember(n, s) { n.history.push({ grid: s.grid.slice(), notes: s.notes.slice() }); if (n.history.length > 500) n.history.shift(); }

  // Returns a NEW state; an illegal action returns the same object (callers can compare by identity).
  function place(s, c, d) { // d: 1..9 sets, 0 clears
    if (s.solved || isGiven(s, c) || d < 0 || d > 9 || s.grid[c] === d) return s;
    var n = cloneState(s); remember(n, s);
    n.grid[c] = d; n.notes[c] = 0; n.moves++;
    if (d) { // a placed digit removes that pencil mark from every peer
      PEERS[c].forEach(function (p) { n.notes[p] &= ~(1 << d); });
    }
    n.solved = isComplete(n.grid);
    return n;
  }
  function toggleNote(s, c, d) {
    if (s.solved || isGiven(s, c) || s.grid[c] || d < 1 || d > 9) return s;
    var n = cloneState(s); remember(n, s); n.notes[c] ^= (1 << d); return n;
  }
  function undo(s) {
    if (!s.history.length) return s;
    var n = cloneState(s), h = n.history.pop();
    n.grid = h.grid; n.notes = h.notes; n.solved = false; return n;
  }
  function hint(s, c) { // reveals the true digit for cell c; counted
    if (s.solved || isGiven(s, c) || s.grid[c] === s.solution[c]) return s;
    var n = place(s, c, s.solution[c]); n.hints = s.hints + 1; return n;
  }

  return { CLUES: CLUES, generate: generate, solve: solve, countSolutions: countSolutions, conflicts: conflicts,
           isComplete: isComplete, newState: newState, place: place, toggleNote: toggleNote, undo: undo,
           hint: hint, isGiven: isGiven, PEERS: PEERS, ROW: ROW, COL: COL, BOX: BOX };
});
