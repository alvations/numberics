/* SPDX-License-Identifier: Apache-2.0 | Copyright 2026 alvations (Melon Lab)
 *
 * Numberics Three: the pure game engine (browser global NumbericsThree, or require()).
 * No DOM, no storage, no clock. All randomness is state.seed (mulberry32); state is plain JSON.
 *
 * Rules (docs/ROADMAP.md section 3):
 * - 4x4. A swipe moves every movable tile ONE step toward the wall (Threes style).
 * - 1 + 2 = 3. From 3 up, equal tiles merge (3+3=6) and so do NEIGHBOURING multiples of 3
 *   (step merge: 3+6=9, 6+9=15), so the sum is always a multiple of 3.
 * - FLUSH: after a move, any straight line of FLUSH_MIN or more adjacent tiles in consecutive
 *   multiples of 3 (3-6-9, 12-9-6, either direction) collapses into one tile worth the sum, on the
 *   cell of its highest tile. It scores sum x run length and earns one random power-up. A collapse
 *   that lines up a new run flushes again (a cascade); every flush pays.
 * - The next tile is previewed and enters from the edge swiped away from, in a line that moved.
 * - Endless: the run ends only when no swipe moves anything and no power-up can act.
 * - Power-ups: Undo, Smash (remove a tile), Swap (two neighbouring tiles), Third (a 1 or 2 becomes a 3).
 *   Start with one Undo, cap 9, earned only by a Flush; Undo restores the whole snapshot.
 *
 * TUNING (tools: a Node sim in tests/test-three.js style, 10,000 games per variant, run 20 Nov 2026).
 * Bot = greedy 1-ply (score gained + 6 per empty cell + 40 per flush + 2 per mergeable pair), uses
 * Smash/Swap/Third only when stuck, never Undo. Cap 3000 moves. "mpf" = moves per flush.
 *   variant                               mean moves  median  mpf (mean)  flush/game  games w/ 0 flush
 *   A step=off flush>=3 bag 1,2,3              74        66      51.7         1.4          41%
 *   B step=on  flush>=3 bag 1,2,3             197       168      21.4         9.2           3%
 *   C step=on  flush>=4 bag 1,2,3              88        78     117.6         0.7          55%
 *   D step=on  flush>=3 bag 1,2 + few 3s      248       209      18.9        13.1           1%
 *   E step=on  flush>=3 bag 1,2,3 + 6 bonus   206       176      19.3        10.7           2%
 *   F step=off flush>=3 bag 1,2 + few 3s       61        55      58.0         1.0          48%
 * (random-move bot on B: 41 moves, mpf 33.)
 * Shipped: B (step merge on, flush from 3, Threes bag of four 1s, four 2s, four 3s). Flushes land
 * every ~21 moves (inside the 15-30 target), almost every run sees one, and a greedy run lasts ~200
 * swipes. D is longer but the hand-dealt 3s are what make early flushes readable; B keeps Threes' bag.
 * Without step merge (A, F) flushes are too rare (one every 50+ moves); flush>=4 (C) almost never fires.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.NumbericsThree = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var DIRS = ["left", "right", "up", "down"];
  var POWERS = ["undo", "smash", "swap", "third"];
  var CAP = 9, SIZE = 4;
  var BAGS = {
    b123: [1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3],
    b12: [1, 1, 1, 1, 2, 2, 2, 2, 3, 3],
    b33: [1, 1, 1, 2, 2, 2, 3, 3, 3, 3, 3, 3],
    b36: [1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 6],
    b369: [1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 6, 9],
    b3x: [1, 1, 1, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3],
  };
  var DEFAULT = { step: true, flushMin: 3, bag: "b123", bonus: false, start: 9 };

  function rand(seed) {
    var a = (seed + 0x6d2b79f5) >>> 0, t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return [((t ^ (t >>> 14)) >>> 0) / 4294967296, a];
  }
  function roll(s) { var r = rand(s.seed); s.seed = r[1]; return r[0]; }

  function create(rules) {
    var R = Object.assign({}, DEFAULT, rules || {});

    function isThree(v) { return v >= 3 && v % 3 === 0; }
    function canMerge(a, b) {
      if (!a || !b) return false;
      if (a + b === 3) return true;                       // 1 + 2
      if (!isThree(a) || !isThree(b)) return false;
      return a === b || (R.step && Math.abs(a - b) === 3);  // equal, or neighbouring multiples
    }

    function clone(s) {
      return { grid: s.grid.slice(), next: s.next, bag: s.bag.slice(), score: s.score, top: s.top,
               moves: s.moves, flushes: s.flushes, best: s.best, used: s.used, seed: s.seed, over: s.over,
               power: Object.assign({}, s.power), prev: s.prev };
    }
    function snapshot(s) { var c = clone(s); c.prev = null; return c; }

    // draw the next tile from the bag (refilled and shuffled by seed when empty)
    function draw(s) {
      var top = s.top;
      if (R.bonus && top >= 24 && roll(s) < 1 / 21) {
        var opts = []; for (var v = 6; v <= top / 4; v += 3) opts.push(v);
        if (opts.length) return opts[Math.floor(roll(s) * opts.length)];
      }
      if (!s.bag.length) {
        var b = BAGS[R.bag].slice();
        for (var i = b.length - 1; i > 0; i--) { var j = Math.floor(roll(s) * (i + 1)), t = b[i]; b[i] = b[j]; b[j] = t; }
        s.bag = b;
      }
      return s.bag.pop();
    }

    function newGame(seed) {
      var s = { grid: new Array(SIZE * SIZE).fill(0), next: 0, bag: [], score: 0, top: 0, moves: 0, flushes: 0,
                best: 0, used: 0, seed: seed >>> 0, over: false, power: { undo: 1, smash: 0, swap: 0, third: 0 }, prev: null };
      var cells = []; for (var i = 0; i < SIZE * SIZE; i++) cells.push(i);
      for (var k = 0; k < R.start; k++) {
        var pick = Math.floor(roll(s) * cells.length), c = cells.splice(pick, 1)[0];
        s.grid[c] = draw(s);
      }
      s.top = Math.max.apply(null, s.grid);
      s.next = draw(s);
      return s;
    }

    // each line: grid indices ordered from the wall the tiles move toward
    function lines(dir) {
      var res = [];
      for (var a = 0; a < SIZE; a++) {
        var line = [];
        for (var b = 0; b < SIZE; b++) {
          if (dir === "left") line.push(a * SIZE + b);
          else if (dir === "right") line.push(a * SIZE + (SIZE - 1 - b));
          else if (dir === "up") line.push(b * SIZE + a);
          else line.push((SIZE - 1 - b) * SIZE + a);
        }
        res.push(line);
      }
      return res;
    }

    // One step for one line (values ordered from the wall). Returns {out, steps:[{from,to,merge}], gained}
    function stepLine(v) {
      var out = v.slice(), steps = [], gained = 0;
      for (var i = 1; i < v.length; i++) {
        if (!v[i]) continue;
        // out[i-1] is empty (vacated or always empty) or holds a tile that stayed put
        if (!out[i - 1]) { out[i - 1] = v[i]; out[i] = 0; steps.push({ from: i, to: i - 1, merge: false }); }
        else if (canMerge(out[i - 1], v[i])) {
          out[i - 1] += v[i]; out[i] = 0; gained += out[i - 1]; steps.push({ from: i, to: i - 1, merge: true });
        }
      }
      return { out: out, steps: steps, gained: gained, moved: steps.length > 0 };
    }

    // all maximal straight runs of consecutive multiples of 3 (step +3 or -3), length >= flushMin
    function findRuns(g) {
      var runs = [];
      function scan(cells) {
        var i = 0;
        while (i < cells.length - 1) {
          var a = g[cells[i]], b = g[cells[i + 1]];
          if (isThree(a) && isThree(b) && Math.abs(b - a) === 3) {
            var d = b - a, j = i + 1;
            while (j + 1 < cells.length && isThree(g[cells[j + 1]]) && g[cells[j + 1]] - g[cells[j]] === d) j++;
            if (j - i + 1 >= R.flushMin) runs.push(cells.slice(i, j + 1));
            i = j;
          } else i++;
        }
      }
      for (var r = 0; r < SIZE; r++) { var row = []; for (var c = 0; c < SIZE; c++) row.push(r * SIZE + c); scan(row); }
      for (var c2 = 0; c2 < SIZE; c2++) { var col = []; for (var r2 = 0; r2 < SIZE; r2++) col.push(r2 * SIZE + c2); scan(col); }
      return runs;
    }

    // resolve flushes one at a time (longest, then biggest sum, then first found) until none remain
    function resolveFlushes(s, out) {
      for (var guard = 0; guard < 16; guard++) {
        var runs = findRuns(s.grid);
        if (!runs.length) return;
        var sum = function (run) { return run.reduce(function (a, c) { return a + s.grid[c]; }, 0); };
        runs.sort(function (x, y) { return (y.length - x.length) || (sum(y) - sum(x)); });
        var run = runs[0], total = sum(run), at = run[0];
        run.forEach(function (c) { if (s.grid[c] > s.grid[at]) at = c; });
        var values = run.map(function (c) { return s.grid[c]; });
        run.forEach(function (c) { s.grid[c] = 0; });
        s.grid[at] = total;
        var pts = total * run.length;
        s.score += pts; s.flushes++;
        if (pts > s.best) s.best = pts;
        if (total > s.top) s.top = total;
        var got = award(s);
        out.push({ cells: run, values: values, at: at, value: total, points: pts, power: got });
      }
    }

    function award(s) {
      var open = POWERS.filter(function (p) { return s.power[p] < CAP; });
      if (!open.length) return null;
      var p = open[Math.floor(roll(s) * open.length)];
      s.power[p]++; return p;
    }

    function slides(s, dir) {
      var any = false;
      lines(dir).forEach(function (idx) { if (stepLine(idx.map(function (i) { return s.grid[i]; })).moved) any = true; });
      return any;
    }
    function canMove(s) { return DIRS.some(function (d) { return slides(s, d); }); }

    function hasPair(g) {
      for (var i = 0; i < g.length; i++) {
        if (!g[i]) continue;
        if (i % SIZE < SIZE - 1 && g[i + 1] && g[i + 1] !== g[i]) return true;
        if (i + SIZE < g.length && g[i + SIZE] && g[i + SIZE] !== g[i]) return true;
      }
      return false;
    }
    function usable(s, name) {
      if (!s.power[name]) return false;
      if (name === "undo") return !!s.prev;
      if (name === "smash") return s.grid.some(Boolean);
      if (name === "swap") return hasPair(s.grid);
      if (name === "third") return s.grid.some(function (v) { return v === 1 || v === 2; });
      return false;
    }
    function refreshOver(s) { s.over = !canMove(s) && !POWERS.some(function (p) { return usable(s, p); }); }

    function move(state, dir) {
      var res = { state: state, moved: false, gained: 0, trace: [], spawned: -1, flushes: [] };
      if (DIRS.indexOf(dir) < 0 || state.over) return res;
      var s = clone(state), movedLines = [];
      lines(dir).forEach(function (idx) {
        var r = stepLine(idx.map(function (i) { return s.grid[i]; }));
        if (!r.moved) return;
        idx.forEach(function (cell, j) { s.grid[cell] = r.out[j]; });
        r.steps.forEach(function (st) { res.trace.push({ from: idx[st.from], to: idx[st.to], merge: st.merge }); });
        res.gained += r.gained; movedLines.push(idx);
      });
      if (!movedLines.length) return res;
      s.prev = snapshot(state);
      s.score += res.gained; s.moves++;
      s.grid.forEach(function (v) { if (v > s.top) s.top = v; });
      resolveFlushes(s, res.flushes);
      // the next tile enters at the far edge of one moved line (the edge swiped away from)
      var entries = movedLines.map(function (idx) { return idx[SIZE - 1]; }).filter(function (c) { return !s.grid[c]; });
      if (entries.length) {
        var cell = entries[Math.floor(roll(s) * entries.length)];
        s.grid[cell] = s.next; res.spawned = cell;
        if (s.next > s.top) s.top = s.next;
        s.next = draw(s);
        resolveFlushes(s, res.flushes); // a dealt tile can complete a run too
      }
      refreshOver(s);
      res.state = s; res.moved = true;
      return res;
    }

    // power-ups: return {state, ok}; a bad target changes nothing. A power-up never earns one.
    function adjacent(a, b) {
      return (Math.abs(a - b) === SIZE) || (Math.abs(a - b) === 1 && Math.floor(a / SIZE) === Math.floor(b / SIZE));
    }
    function use(state, name, a, b) {
      var fail = { state: state, ok: false };
      if (POWERS.indexOf(name) < 0 || !state.power[name] || state.over && name !== "undo") return fail;
      var s, n = SIZE * SIZE;
      if (name === "undo") {
        if (!state.prev) return fail;
        s = clone(state.prev); s.prev = null;
        s.power.undo = Math.max(0, s.power.undo - 1); s.used = state.used + 1;
      } else {
        s = clone(state); var g = s.grid;
        if (name === "smash") { if (!(a >= 0 && a < n) || !g[a]) return fail; g[a] = 0; }
        else if (name === "third") { if (!(a >= 0 && a < n) || (g[a] !== 1 && g[a] !== 2)) return fail; g[a] = 3; if (s.top < 3) s.top = 3; }
        else if (name === "swap") {
          if (!(a >= 0 && a < n && b >= 0 && b < n) || !adjacent(a, b) || !g[a] || !g[b] || g[a] === g[b]) return fail;
          var t = g[a]; g[a] = g[b]; g[b] = t;
        }
        s.power[name]--; s.used++; s.prev = snapshot(state);
      }
      refreshOver(s);
      return { state: s, ok: true };
    }

    return { DIRS: DIRS, POWERS: POWERS, CAP: CAP, SIZE: SIZE, RULES: R, newGame: newGame, move: move, use: use,
             canMove: canMove, usable: usable, canMerge: canMerge, stepLine: stepLine, findRuns: findRuns,
             isThree: isThree, adjacent: adjacent };
  }

  var api = create(DEFAULT);
  // Rainbow scale: k = value / 3. 3 red .. 21 violet, then one octave up with a brighter ring.
  var RAINBOW = ["red", "orange", "yellow", "green", "blue", "indigo", "violet"];
  api.colour = function (v) {
    if (!(v >= 3 && v % 3 === 0)) return { band: -1, name: "grey", octave: 0 };
    var k = v / 3 - 1;
    return { band: k % 7, name: RAINBOW[k % 7], octave: Math.floor(k / 7) };
  };
  api.RAINBOW = RAINBOW;
  api.create = create;
  api.rand = rand;
  api.DEFAULT = DEFAULT;
  return api;
});
