/* SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 alvations (Melon Lab)
 *
 * Numberics Endless: the pure game engine. No DOM, no storage, no clock.
 * Tiles are stored as LEVELS (level n shows 2^n), so there is no overflow and
 * no ceiling: the game has no winning tile, it only ends when the board locks.
 * All randomness comes from state.seed (mulberry32), so a game is a pure
 * function of its seed plus the moves and power-ups applied to it.
 *
 * The slide-and-merge core takes a RULE SET, so sibling games (fibonacci/) reuse it:
 *   make(rules) -> a full engine API. The default export is make(ENDLESS); tests/test.js
 *   replays a pinned fixture (re-recorded for the round-2 R2 rule, state.free, and for the
 *   round-3 rule, state.marks).
 * R2 (a power-up never earns one), round 3, by tile: a tile that Swap or Boost placed or changed is
 *   MARKED (state.marks, one 0/1 per cell); a merge with a marked tile makes a marked tile, and a new
 *   highest tile pays only when an unmarked merge made it, however many moves later. Smash changes
 *   space, not a tile, so it keeps the one-move rule (state.free: the next move pays nothing); Swap and
 *   Boost set it too, since a swap into an empty cell, or a boosted tile that merges away, also opens space.
 * A rule set is { canMerge(a, b), mergeResult(a, b), spawn(r), value(level),
 *   label(level), awardFrom }, all on stored levels; r is a float in [0,1).
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.Numberics = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var DIRS = ["left", "right", "up", "down"];
  var POWERS = ["undo", "smash", "swap", "boost"];
  var AWARD_FROM_LEVEL = 5; // first milestone that pays out is 32
  var POWER_CAP = 9;

  // Endless: equal levels merge one level up, a merge scores 2^level.
  var ENDLESS = {
    canMerge: function (a, b) { return a === b; },
    mergeResult: function (a) { return a + 1; },
    spawn: function (r) { return r < 0.9 ? 1 : 2; }, // 2 (90%) or 4 (10%)
    value: function (level) { return Math.pow(2, level); },
    // Display: full digits while short, then 2^n so it is readable at any height.
    label: function (level) { return level < 17 ? String(Math.pow(2, level)) : "2^" + level; },
    awardFrom: AWARD_FROM_LEVEL,
  };

  function rand(seed) {
    // mulberry32: returns [float in [0,1), next seed]
    var a = (seed + 0x6d2b79f5) >>> 0;
    var t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return [((t ^ (t >>> 14)) >>> 0) / 4294967296, a];
  }

  function make(rules) {
    function clone(s) {
      return {
        size: s.size, grid: s.grid.slice(), score: s.score, top: s.top,
        moves: s.moves, seed: s.seed, over: s.over,
        power: { undo: s.power.undo, smash: s.power.smash, swap: s.power.swap, boost: s.power.boost },
        prev: s.prev, free: !!s.free, marks: marksOf(s),
      };
    }
    // An old save has no marks: every tile is unmarked. A malformed list is read as no marks.
    function marksOf(s) {
      var n = s.grid.length, m = s.marks;
      if (!Array.isArray(m) || m.length !== n) return new Array(n).fill(0);
      return m.map(function (v, i) { return v && s.grid[i] ? 1 : 0; });
    }

    function snapshot(s) {
      return { grid: s.grid.slice(), score: s.score, top: s.top, moves: s.moves,
               seed: s.seed, power: Object.assign({}, s.power), free: !!s.free, marks: marksOf(s) };
    }

    function spawn(s) {
      var empty = [];
      for (var i = 0; i < s.grid.length; i++) if (!s.grid[i]) empty.push(i);
      if (!empty.length) return -1;
      var r = rand(s.seed); s.seed = r[1];
      var cell = empty[Math.floor(r[0] * empty.length)];
      r = rand(s.seed); s.seed = r[1];
      s.grid[cell] = rules.spawn(r[0]); s.marks[cell] = 0; // a spawned tile is honest
      if (s.grid[cell] > s.top) s.top = s.grid[cell];
      return cell;
    }

    function newGame(seed, size) {
      size = size || 4;
      var s = {
        size: size, grid: new Array(size * size).fill(0), score: 0, top: 0,
        moves: 0, seed: seed >>> 0, over: false,
        power: { undo: 1, smash: 0, swap: 0, boost: 0 }, prev: null, free: false,
        marks: new Array(size * size).fill(0),
      };
      spawn(s); spawn(s);
      return s;
    }

    // Slide one line toward index 0. Each tile merges at most once per move.
    // `idx` maps line positions to grid cells so callers can trace movement. `mk` (optional) holds the
    // line's marks: a tile keeps its mark as it slides, and a merge with a marked tile is marked.
    function slideLine(levels, idx, mk) {
      var out = [], om = [], mergedAt = [], trace = [], gained = 0, merges = [], mergeMarks = [];
      for (var i = 0; i < levels.length; i++) {
        if (!levels[i]) continue;
        var last = out.length - 1, m = mk && mk[i] ? 1 : 0;
        if (last >= 0 && !mergedAt[last] && rules.canMerge(out[last], levels[i])) {
          out[last] = rules.mergeResult(out[last], levels[i]); mergedAt[last] = true; om[last] = om[last] || m;
          gained += rules.value(out[last]); merges.push(out[last]); mergeMarks.push(om[last]);
          trace.push({ from: idx[i], to: idx[last], merge: true });
        } else {
          out.push(levels[i]); om.push(m); mergedAt[out.length - 1] = false;
          trace.push({ from: idx[i], to: idx[out.length - 1], merge: false });
        }
      }
      return { out: out, marks: om, trace: trace, gained: gained, merges: merges, mergeMarks: mergeMarks };
    }

    function lines(size, dir) {
      // each line is a list of grid indices ordered from the wall we slide toward
      var res = [];
      for (var a = 0; a < size; a++) {
        var line = [];
        for (var b = 0; b < size; b++) {
          if (dir === "left") line.push(a * size + b);
          else if (dir === "right") line.push(a * size + (size - 1 - b));
          else if (dir === "up") line.push(b * size + a);
          else line.push((size - 1 - b) * size + a);
        }
        res.push(line);
      }
      return res;
    }

    function canMove(s) {
      var n = s.size, g = s.grid;
      for (var i = 0; i < g.length; i++) {
        if (!g[i]) return true;
        var r = Math.floor(i / n), c = i % n;
        if (c + 1 < n && g[i + 1] && rules.canMerge(g[i], g[i + 1])) return true;
        if (r + 1 < n && g[i + n] && rules.canMerge(g[i], g[i + n])) return true;
      }
      return false;
    }

    function usablePower(s) {
      var p = s.power;
      return (p.undo > 0 && !!s.prev) || p.smash > 0 || p.swap > 0 || p.boost > 0;
    }

    function refreshOver(s) { s.over = !canMove(s) && !usablePower(s); }

    function award(s, level, awarded) {
      var r = rand(s.seed); s.seed = r[1];
      // pick among powers still under the cap, so a full stock never wastes a reward
      var open = POWERS.filter(function (p) { return s.power[p] < POWER_CAP; });
      if (!open.length) return false;
      var p = open[Math.floor(r[0] * open.length)];
      s.power[p]++;
      awarded.push({ power: p, level: level });
      return true;
    }

    function move(state, dir) {
      var res = { state: state, moved: false, gained: 0, merges: [], trace: [],
                  spawned: -1, milestones: [], awarded: [] };
      if (DIRS.indexOf(dir) < 0 || state.over) return res;
      var s = clone(state), trace = [], any = false, honest = {};
      lines(s.size, dir).forEach(function (idx) {
        var lv = idx.map(function (i) { return s.grid[i]; });
        var r = slideLine(lv, idx, idx.map(function (i) { return s.marks[i]; }));
        idx.forEach(function (cell, j) {
          s.grid[cell] = j < r.out.length ? r.out[j] : 0; s.marks[cell] = j < r.out.length ? r.marks[j] : 0;
        });
        r.trace.forEach(function (t) { if (t.from !== t.to || t.merge) any = true; trace.push(t); });
        res.gained += r.gained; res.merges = res.merges.concat(r.merges);
        r.merges.forEach(function (l, j) { if (!r.mergeMarks[j]) honest[l] = true; });
      });
      if (!any) return res;
      s.prev = snapshot(state);
      s.score += res.gained; s.moves++;
      // milestones: every NEW highest tile; the game never declares a win.
      // R2: the move right after a board-changing power-up (Smash, Swap, Boost) still counts its
      // milestones but pays nothing (state.free), and a new highest tile that only a merge with a
      // marked (swapped or boosted) tile made pays nothing either (res.marked). Both still score.
      if (state.free) res.free = true;
      s.free = false;
      var fresh = res.merges.filter(function (l, i, a) { return l > s.top && a.indexOf(l) === i; })
                            .sort(function (a, b) { return a - b; });
      fresh.forEach(function (l) {
        res.milestones.push(l);
        if (l < rules.awardFrom || res.free) return;
        if (!honest[l]) { res.marked = true; return; }
        if (!award(s, l, res.awarded)) res.full = true; // R15: the client says "Power-ups full"
      });
      if (fresh.length) s.top = fresh[fresh.length - 1];
      res.spawned = spawn(s);
      refreshOver(s);
      res.state = s; res.moved = true; res.trace = trace;
      return res;
    }

    // ---- power-ups. Each returns {state, ok}; a bad target changes nothing. ----
    function use(state, name, a, b) {
      var fail = { state: state, ok: false };
      if (!state.power[name] || state.power[name] < 1) return fail;
      var s = clone(state), g = s.grid, n = g.length, mk = s.marks;
      if (name === "undo") {
        if (!state.prev) return fail;
        var p = state.prev;
        s.grid = p.grid.slice(); s.score = p.score; s.top = p.top; s.moves = p.moves;
        s.seed = p.seed; s.power = Object.assign({}, p.power); s.free = !!p.free; s.marks = marksOf(p);
        s.power.undo = Math.max(0, s.power.undo - 1); // the rewind is paid for
        s.prev = null;
      } else {
        var snap = snapshot(state);
        if (name === "smash") {
          if (!(a >= 0 && a < n) || !g[a]) return fail;
          g[a] = 0; mk[a] = 0;
        } else if (name === "boost") {
          if (!(a >= 0 && a < n) || !g[a]) return fail;
          g[a]++; mk[a] = 1; if (g[a] > s.top) s.top = g[a]; // no reward: boosting must not farm rewards
        } else if (name === "swap") {
          if (!(a >= 0 && a < n && b >= 0 && b < n) || a === b || (!g[a] && !g[b])) return fail;
          var t = g[a]; g[a] = g[b]; g[b] = t;
          mk[a] = g[a] ? 1 : 0; mk[b] = g[b] ? 1 : 0; // both swapped tiles are marked
        } else return fail;
        s.power[name]--; s.prev = snap; s.free = true; // R2: the next move pays no reward
      }
      if (name === "undo") s.over = false;
      refreshOver(s);
      return { state: s, ok: true };
    }

    return { DIRS: DIRS, POWERS: POWERS, newGame: newGame, move: move, use: use,
             canMove: canMove, label: rules.label, value: rules.value, slideLine: slideLine, rand: rand,
             AWARD_FROM_LEVEL: rules.awardFrom, POWER_CAP: POWER_CAP, rules: rules };
  }

  var api = make(ENDLESS);
  api.make = make; api.ENDLESS = ENDLESS;
  return api;
});
