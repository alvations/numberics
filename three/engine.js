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
 * - A power-up never earns one, not even indirectly (family rule R2). A run that Swap or Third lines up
 *   collapses at once inside use(), scoring its points but paying no power-up; and the swipe right after
 *   Smash, Swap or Third (state.free) pays no power-up for its flushes either, so a power-up cannot
 *   open the way for a paid Flush. Undo restores the snapshot, flag included.
 * - The next tile is previewed and enters from the edge swiped away from, in a line that moved.
 * - Endless: the run ends only when no swipe moves anything and no power-up can act.
 * - Power-ups: Undo, Smash (remove a tile), Swap (two neighbouring tiles), Third (a 1 or 2 becomes a 3).
 *   Start with one Undo, cap 9, earned only by a Flush; Undo restores the whole snapshot.
 *
 * TUNING (Node bots, 10,000 seeded games per variant per bot, 20 Nov 2026; run cap 3000 moves, never hit).
 * greedy = 1-ply: score gained + 6/empty cell + 40/flush + 2/mergeable pair; seeker = greedy with 120/flush
 * and +8 per adjacent consecutive-multiple pair; random = any legal swipe. Bots use Smash/Swap/Third only
 * when stuck, never Undo. mpf = moves per flush. Bags: b123 = four each of 1,2,3 (Threes); b12 = four 1s,
 * four 2s, two 3s; b33 = three 1s, three 2s, six 3s; b3x = three 1s, three 2s, eight 3s; b36/b369 add a 6/9.
 *   variant (greedy bot)                    mean moves  median  mpf    flushes/game  runs with 0 flush
 *   A step off, flush>=3, b123                  183       181     none    0.0          100%
 *   F step off, flush>=3, b12                   201       199     none    0.0          100%
 *   C step on,  flush>=4, b123                  178       172     43333   0.0          100%
 *   B step on,  flush>=3, b123                  280       271     40.9    6.9            2%
 *   D step on,  flush>=3, b12                   285       276     55.1    5.2            4%
 *   E step on,  flush>=3, b123 + bonus tiles    191       189     42.8    4.5            4%
 *   G step on,  flush>=3, b123, 6 start tiles   285       276     41.1    6.9            2%
 *   I step on,  flush>=3, b36                   209       203     45.9    4.6            5%
 *   J step on,  flush>=3, b369                  179       175     45.4    4.0            6%
 *   H step on,  flush>=3, b33   (SHIPPED)       289       278     29.4    9.8            1%
 *   K step on,  flush>=3, b3x                   293       283     25.9   11.3            0%
 *   seeker bot: B 297 moves / mpf 35.7, H 313 / 26.0, K 321 / 23.2.  random bot: B 67 / 65.9, H 70 / 48.6, K 73 / 42.2.
 * Findings: without step merge a flush is impossible (values stay 3 x 2^n, so 9 never exists); runs of 4
 * are practically unreachable, so flush>=4 never fires. Dealing more 3s is what brings flushes into the
 * 15-30 move window. H puts a deliberate player at one flush every 26-29 swipes over ~290-310 swipe runs
 * (median top tile 141 to 180) while keeping half the deal as 1s and 2s, so 1 + 2 = 3 still matters.
 * K is slightly more generous (23-26) but only 6 of 14 dealt tiles are 1s or 2s. Shipped: H.
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
  var DEFAULT = { step: true, flushMin: 3, bag: "b33", bonus: false, start: 9 }; // variant H, see TUNING

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
               free: !!s.free, power: Object.assign({}, s.power), prev: s.prev };
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
                best: 0, used: 0, seed: seed >>> 0, over: false, free: false, power: { undo: 1, smash: 0, swap: 0, third: 0 }, prev: null };
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

    // resolve flushes one at a time (longest, then biggest sum, then first found) until none remain.
    // pay=false: a power-up made this run possible, so it scores but earns no power-up (R2).
    function resolveFlushes(s, out, pay) {
      for (var guard = 0; guard < 16; guard++) {
        var runs = findRuns(s.grid);
        if (!runs.length) return;
        var sum = function (run) { return run.reduce(function (a, c) { return a + s.grid[c]; }, 0); };
        runs.sort(function (x, y) { return (y.length - x.length) || (sum(y) - sum(x)); });
        var run = runs[0], total = sum(run), at = run[0];
        run.forEach(function (c) { if (s.grid[c] > s.grid[at]) at = c; });
        var values = run.map(function (c) { return s.grid[c]; }), before = s.grid.slice();
        run.forEach(function (c) { s.grid[c] = 0; });
        s.grid[at] = total;
        var pts = total * run.length;
        s.score += pts; s.flushes++;
        if (pts > s.best) s.best = pts;
        if (total > s.top) s.top = total;
        var got = pay ? award(s) : null;
        out.push({ cells: run, values: values, at: at, value: total, points: pts, power: got, paid: !!pay, before: before });
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
      var pay = !state.free; s.free = false; // the swipe right after a board-changing power-up pays no power-up
      resolveFlushes(s, res.flushes, pay);
      // the next tile enters at the far edge of one moved line (the edge swiped away from)
      var entries = movedLines.map(function (idx) { return idx[SIZE - 1]; }).filter(function (c) { return !s.grid[c]; });
      if (entries.length) {
        var cell = entries[Math.floor(roll(s) * entries.length)];
        s.grid[cell] = s.next; res.spawned = cell;
        if (s.next > s.top) s.top = s.next;
        s.next = draw(s);
        resolveFlushes(s, res.flushes, pay); // a dealt tile can complete a run too
      }
      refreshOver(s);
      res.state = s; res.moved = true;
      return res;
    }

    // power-ups: return {state, ok, flushes}; a bad target changes nothing. A power-up never earns one:
    // a run it lines up collapses here unpaid, and it marks the next swipe as unpaid (s.free).
    function adjacent(a, b) {
      return (Math.abs(a - b) === SIZE) || (Math.abs(a - b) === 1 && Math.floor(a / SIZE) === Math.floor(b / SIZE));
    }
    function use(state, name, a, b) {
      var fail = { state: state, ok: false, flushes: [] };
      // R1: nothing, Undo included, crosses a finished run
      if (POWERS.indexOf(name) < 0 || !state.power[name] || state.over) return fail;
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
        s.free = true;
        var flushes = [];
        resolveFlushes(s, flushes, false);
      }
      refreshOver(s);
      return { state: s, ok: true, flushes: flushes || [] };
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
