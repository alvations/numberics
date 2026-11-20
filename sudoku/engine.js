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

  // A dig that stops above the clue target (about 2% of Hard grids cannot go below 27) tries a fresh grid from the
  // same random stream, so the stated ladder holds; every puzzle that met its target first time is unchanged.
  function generate(seed, difficulty) {
    var target = CLUES[difficulty] || CLUES.medium, r = rng(seed), best = null;
    for (var a = 0; a < 12; a++) {
      var g = dig(r, target);
      if (!best || g.clues < best.clues) best = g;
      if (best.clues <= target) break;
    }
    return { puzzle: best.puzzle, solution: best.solution, clues: best.clues, difficulty: difficulty, seed: seed >>> 0 };
  }
  function dig(r, target) {
    var o = {}; search(new Array(81).fill(0), 1, r, o);
    var solution = o.sol, puzzle = solution.slice(), clues = 81;
    var order = shuffle(Array.from({ length: 81 }, function (_, k) { return k; }), r);
    for (var n = 0; n < 81 && clues > target; n++) {
      var cell = order[n], keep = puzzle[cell];
      puzzle[cell] = 0;
      if (countSolutions(puzzle, 2) !== 1) puzzle[cell] = keep; else clues--;
    }
    return { puzzle: puzzle, solution: solution, clues: clues };
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

  // ---- units: 0-8 rows, 9-17 columns, 18-26 boxes. UNIT[u] = its 9 cells; UNITS_OF[c] = the 3 units of cell c ----
  var UNIT = [], UNITS_OF = [];
  for (var u = 0; u < 27; u++) UNIT[u] = [];
  for (i = 0; i < 81; i++) {
    UNITS_OF[i] = [ROW[i], 9 + COL[i], 18 + BOX[i]];
    UNITS_OF[i].forEach(function (uu) { UNIT[uu].push(i); });
  }

  // ---- power-ups (docs/ROADMAP.md section 0a, Sudoku row; rule from docs/reviews/TRIAGE1.md) ----
  // Undo is free and unlimited, so it has no stock. The three charged power-ups:
  //   reveal: the true digit for one cell (the old Hint), check: marks wrong digits once,
  //   cands: fills the pencil notes of one 3x3 box from the digits already on the board.
  // Earned by PROGRESS, never by correctness: `progress` counts the cells the player has filled that show NO
  // conflict (givens and revealed cells not counted). Conflicts are already painted red, so a reward says nothing
  // new about the answer, and typing junk into every cell earns nothing (TRIAGE2 Sudoku, mechanics #2).
  // `high` is the most progress ever reached in this puzzle. It never goes down (Erase and Undo leave it), and
  // each time it reaches a new multiple of 9 one charge is paid, so rewinding cannot farm (about 4 easy, 5 medium,
  // 6 hard per puzzle). A wrong digit that clashes with nothing counts as much as a right one.
  // A power-up never earns one (R2): Reveal never pays, a revealed cell never counts toward progress (even if it
  // is erased and typed again), and when Reveal replaced one of the player's digits (which can clear a clash)
  // the next digit placed pays nothing either (`free`). A Reveal into an empty cell can only add clashes, so it
  // can never help a later move pay. Candidates and Check do not change any digit. The move that solves the
  // board never pays (a charge would be useless). Spending is permanent: Undo never refunds.
  var KINDS = ["reveal", "check", "cands"], CAP = 9, STEP = 9;
  var START = { reveal: 1, check: 0, cands: 0 };
  // Reveal is the strongest (it hands over an answer), so it is the rarest reward.
  var WEIGHT = { reveal: 1, check: 2, cands: 3 };

  function filled(s) { // cells the player has filled (givens excluded)
    var n = 0; for (var c = 0; c < 81; c++) if (s.grid[c] && !s.puzzle[c]) n++; return n;
  }
  // cells that count toward rewards: filled by the player (not given, never revealed) and showing no conflict
  function progress(s) {
    var rev = {}; (s.revealed || []).forEach(function (c) { rev[c] = true; });
    var n = 0;
    for (var c = 0; c < 81; c++) {
      if (!s.grid[c] || s.puzzle[c] || rev[c]) continue;
      var clash = false;
      for (var p = 0; p < PEERS[c].length; p++) if (s.grid[PEERS[c][p]] === s.grid[c]) { clash = true; break; }
      if (!clash) n++;
    }
    return n;
  }
  // Which power-up the k-th progress step pays: a pure function of the puzzle seed and k. Full kinds are skipped.
  function awardKind(seed, k, stock) {
    var open = KINDS.filter(function (x) { return stock[x] < CAP; });
    if (!open.length) return null;
    var w = open.reduce(function (a, x) { return a + WEIGHT[x]; }, 0);
    var r = rng(((seed >>> 0) ^ Math.imul(k + 1, 0x9e3779b1)) >>> 0)() * w;
    for (var x = 0; x < open.length; x++) { r -= WEIGHT[open[x]]; if (r < 0) return open[x]; }
    return open[open.length - 1];
  }
  function total(o) { return KINDS.reduce(function (a, k) { return a + (o[k] || 0); }, 0); }

  // ---- game state: { puzzle, solution, grid, notes[81] (bitmask), moves, hints, stock, used, high, history[] } ----
  function newState(gen) {
    return { puzzle: gen.puzzle.slice(), solution: gen.solution.slice(), grid: gen.puzzle.slice(),
             notes: new Array(81).fill(0), difficulty: gen.difficulty, seed: gen.seed,
             moves: 0, hints: 0, history: [], solved: false,
             stock: Object.assign({}, START), used: { reveal: 0, check: 0, cands: 0 }, high: 0, gain: [],
             revealed: [], free: false };
  }
  // Brings an older save (before power-ups, or from the unit-reward version) up to date. Old saves keep loading.
  function upgrade(s) {
    var n = cloneState(s), ok = function (o) { return o && KINDS.every(function (k) { return Number.isInteger(o[k]); }); };
    if (!ok(n.stock)) n.stock = Object.assign({}, START); else n.stock = Object.assign({}, n.stock);
    if (!ok(n.used)) n.used = { reveal: s.hints || 0, check: 0, cands: 0 }; else n.used = Object.assign({}, n.used);
    // a debt left by the old Undo rule (stock below zero) is forgiven: Undo no longer touches the stock
    KINDS.forEach(function (k) { n.stock[k] = Math.max(0, Math.min(CAP, n.stock[k])); n.used[k] = Math.max(0, n.used[k]); });
    // revealed cells and the R2 flag are newer: an older save has none (its earlier Reveals already raised `high`)
    n.revealed = Array.isArray(s.revealed) ? s.revealed.filter(function (c) { return Number.isInteger(c) && c >= 0 && c < 81; }) : [];
    n.free = s.free === true;
    // progress made before this rule pays nothing again; a mark set by the old any-digit rule is kept (never lowered)
    if (!Number.isInteger(n.high) || n.high < 0) n.high = filled(n);
    n.high = Math.min(81, Math.max(n.high, progress(n)));
    delete n.paid; // the old per-unit mask
    if (!Number.isInteger(n.hints)) n.hints = n.used.reveal;
    n.solved = isComplete(n.grid);
    n.gain = [];
    return n;
  }
  function isGiven(s, c) { return s.puzzle[c] !== 0; }
  function cloneState(s) {
    var n = Object.assign({}, s);
    n.grid = s.grid.slice(); n.notes = s.notes.slice(); n.history = s.history.slice();
    if (s.stock) n.stock = Object.assign({}, s.stock);
    if (s.used) n.used = Object.assign({}, s.used);
    n.revealed = (s.revealed || []).slice();
    n.gain = [];
    return n;
  }
  function remember(n, s) { // Undo restores the board only: the stock and `high` never move backwards
    n.history.push({ grid: s.grid.slice(), notes: s.notes.slice() });
    if (n.history.length > 500) n.history.shift();
  }
  // After a digit lands: raise the high-water mark and pay a new multiple of 9, unless `pays` is false.
  function settle(n, pays) {
    var f = progress(n);
    if (f <= n.high) return;
    var step = Math.floor(f / STEP) > Math.floor(n.high / STEP);
    n.high = f;
    if (!step || !pays || n.solved) return;
    var k = awardKind(n.seed, f / STEP, n.stock);
    if (k) { n.stock[k]++; n.gain.push(k); }
  }

  function put(s, c, d, pays, revealed) {
    var n = cloneState(s); remember(n, s);
    if (revealed && n.revealed.indexOf(c) < 0) n.revealed.push(c); // before settle: a revealed cell never counts
    n.grid[c] = d; n.notes[c] = 0; n.moves++;
    if (d) PEERS[c].forEach(function (p) { n.notes[p] &= ~(1 << d); }); // a placed digit removes that pencil mark from peers
    n.solved = isComplete(n.grid);
    if (d) { settle(n, pays && !s.free); n.free = false; } // the first digit after a Reveal that replaced one pays nothing (R2)
    return n;
  }
  // Returns a NEW state; an illegal action returns the same object (callers can compare by identity).
  function place(s, c, d) { // d: 1..9 sets, 0 clears
    if (s.solved || isGiven(s, c) || d < 0 || d > 9 || s.grid[c] === d) return s;
    return put(s, c, d, true);
  }
  function toggleNote(s, c, d) {
    if (s.solved || isGiven(s, c) || s.grid[c] || d < 1 || d > 9) return s;
    var n = cloneState(s); remember(n, s); n.notes[c] ^= (1 << d); return n;
  }
  // A solved board is a decided result: Undo is refused (family rule R1), so a solved puzzle stays solved.
  function canUndo(s) { return !s.solved && s.history.length > 0; }
  function undo(s) {
    if (!canUndo(s)) return s;
    var n = cloneState(s), h = n.history.pop();
    n.grid = h.grid; n.notes = h.notes; n.solved = false;
    return n;
  }
  function has(s, k) { return !s.solved && s.stock && s.stock[k] > 0; }
  function spend(n, k) { n.stock[k]--; n.used[k]++; }

  // Reveal: the true digit for cell c. Costs one reveal, never pays, and the cell never counts toward progress.
  function reveal(s, c) {
    if (!has(s, "reveal") || isGiven(s, c) || s.grid[c] === s.solution[c]) return s;
    var n = put(s, c, s.solution[c], false, true); spend(n, "reveal"); n.hints = s.hints + 1;
    n.free = s.free || !!s.grid[c]; // it replaced a digit: a clash may be gone, so the next digit placed pays nothing (R2)
    return n;
  }
  // Check: which placed digits are wrong (compared with the one solution). Returns { state, wrong }.
  // The board is unchanged, so it is not an Undo step; the charge is spent even when nothing is wrong.
  function check(s) {
    var mine = s.grid.some(function (v, c) { return v && !isGiven(s, c); });
    if (!has(s, "check") || !mine) return { state: s, wrong: [] };
    var n = cloneState(s); spend(n, "check");
    var wrong = []; s.grid.forEach(function (v, c) { if (v && v !== s.solution[c]) wrong.push(c); });
    return { state: n, wrong: wrong };
  }
  // Pencil candidates the board allows for an empty cell (digits not already in its row, column or box).
  function candidates(grid, c) {
    if (grid[c]) return 0;
    var m = 0x3fe; PEERS[c].forEach(function (p) { if (grid[p]) m &= ~(1 << grid[p]); }); return m;
  }
  // Candidates: fill the notes of every empty cell in the box of c. Uses only the board, never the solution.
  function fillBox(s, c) {
    if (!has(s, "cands")) return s;
    var cells = UNIT[18 + BOX[c]].filter(function (k) { return !s.grid[k]; });
    if (!cells.length || cells.every(function (k) { return s.notes[k] === candidates(s.grid, k); })) return s;
    var n = cloneState(s); remember(n, s);
    cells.forEach(function (k) { n.notes[k] = candidates(s.grid, k); });
    spend(n, "cands"); return n;
  }
  function hint(s, c) { return reveal(s, c); } // the old name, kept for callers of the pre-power-up engine

  return { CLUES: CLUES, generate: generate, solve: solve, countSolutions: countSolutions, conflicts: conflicts,
           isComplete: isComplete, newState: newState, place: place, toggleNote: toggleNote, undo: undo,
           hint: hint, reveal: reveal, check: check, fillBox: fillBox, candidates: candidates, upgrade: upgrade,
           canUndo: canUndo, filled: filled, progress: progress, total: total, KINDS: KINDS, START: START, CAP: CAP, STEP: STEP,
           isGiven: isGiven, PEERS: PEERS, ROW: ROW, COL: COL, BOX: BOX, UNIT: UNIT, UNITS_OF: UNITS_OF };
});
