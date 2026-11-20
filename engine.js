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
 *   make(rules) -> a full engine API. The default export is make(ENDLESS), unchanged
 *   in behaviour (tests/test.js replays a fixture recorded before this refactor).
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
        prev: s.prev,
      };
    }

    function snapshot(s) {
      return { grid: s.grid.slice(), score: s.score, top: s.top, moves: s.moves,
               seed: s.seed, power: Object.assign({}, s.power) };
    }

    function spawn(s) {
      var empty = [];
      for (var i = 0; i < s.grid.length; i++) if (!s.grid[i]) empty.push(i);
      if (!empty.length) return -1;
      var r = rand(s.seed); s.seed = r[1];
      var cell = empty[Math.floor(r[0] * empty.length)];
      r = rand(s.seed); s.seed = r[1];
      s.grid[cell] = rules.spawn(r[0]);
      if (s.grid[cell] > s.top) s.top = s.grid[cell];
      return cell;
    }

    function newGame(seed, size) {
      size = size || 4;
      var s = {
        size: size, grid: new Array(size * size).fill(0), score: 0, top: 0,
        moves: 0, seed: seed >>> 0, over: false,
        power: { undo: 1, smash: 0, swap: 0, boost: 0 }, prev: null,
      };
      spawn(s); spawn(s);
      return s;
    }

    // Slide one line toward index 0. Each tile merges at most once per move.
    // `idx` maps line positions to grid cells so callers can trace movement.
    function slideLine(levels, idx) {
      var out = [], mergedAt = [], trace = [], gained = 0, merges = [];
      for (var i = 0; i < levels.length; i++) {
        if (!levels[i]) continue;
        var last = out.length - 1;
        if (last >= 0 && !mergedAt[last] && rules.canMerge(out[last], levels[i])) {
          out[last] = rules.mergeResult(out[last], levels[i]); mergedAt[last] = true;
          gained += rules.value(out[last]); merges.push(out[last]);
          trace.push({ from: idx[i], to: idx[last], merge: true });
        } else {
          out.push(levels[i]); mergedAt[out.length - 1] = false;
          trace.push({ from: idx[i], to: idx[out.length - 1], merge: false });
        }
      }
      return { out: out, trace: trace, gained: gained, merges: merges };
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
      if (!open.length) return;
      var p = open[Math.floor(r[0] * open.length)];
      s.power[p]++;
      awarded.push({ power: p, level: level });
    }

    function move(state, dir) {
      var res = { state: state, moved: false, gained: 0, merges: [], trace: [],
                  spawned: -1, milestones: [], awarded: [] };
      if (DIRS.indexOf(dir) < 0 || state.over) return res;
      var s = clone(state), trace = [], any = false;
      lines(s.size, dir).forEach(function (idx) {
        var lv = idx.map(function (i) { return s.grid[i]; });
        var r = slideLine(lv, idx);
        idx.forEach(function (cell, j) { s.grid[cell] = j < r.out.length ? r.out[j] : 0; });
        r.trace.forEach(function (t) { if (t.from !== t.to || t.merge) any = true; trace.push(t); });
        res.gained += r.gained; res.merges = res.merges.concat(r.merges);
      });
      if (!any) return res;
      s.prev = snapshot(state);
      s.score += res.gained; s.moves++;
      // milestones: every NEW highest tile; the game never declares a win
      var fresh = res.merges.filter(function (l, i, a) { return l > s.top && a.indexOf(l) === i; })
                            .sort(function (a, b) { return a - b; });
      fresh.forEach(function (l) {
        res.milestones.push(l);
        if (l >= rules.awardFrom) award(s, l, res.awarded);
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
      var s = clone(state), g = s.grid, n = g.length;
      if (name === "undo") {
        if (!state.prev) return fail;
        var p = state.prev;
        s.grid = p.grid.slice(); s.score = p.score; s.top = p.top; s.moves = p.moves;
        s.seed = p.seed; s.power = Object.assign({}, p.power);
        s.power.undo = Math.max(0, s.power.undo - 1); // the rewind is paid for
        s.prev = null;
      } else {
        var snap = snapshot(state);
        if (name === "smash") {
          if (!(a >= 0 && a < n) || !g[a]) return fail;
          g[a] = 0;
        } else if (name === "boost") {
          if (!(a >= 0 && a < n) || !g[a]) return fail;
          g[a]++; if (g[a] > s.top) s.top = g[a]; // no reward: boosting must not farm rewards
        } else if (name === "swap") {
          if (!(a >= 0 && a < n && b >= 0 && b < n) || a === b || (!g[a] && !g[b])) return fail;
          var t = g[a]; g[a] = g[b]; g[b] = t;
        } else return fail;
        s.power[name]--; s.prev = snap;
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
