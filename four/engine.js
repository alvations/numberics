/* SPDX-License-Identifier: Apache-2.0 | Copyright 2026 alvations (Melon Lab)
 * Numberics Four: pure rules (browser global NumbericsFour, and require()). No DOM, storage or clock.
 * Connect Four on 7 columns x 6 rows where every disc carries a number 1-4 dealt from a seeded bag.
 * A drop wins for the side that dropped it when it completes four of its colour in a row, or a
 * ten-line: any four in a row, any colours, whose numbers sum to exactly 10 and that hold at least TWO discs
 * of the side completing it (the new disc counts). A full board is a draw.
 * Cells are r*7+c with r = 0 the BOTTOM row. own: 0 empty, 1 player, 2 computer. num: 1-4 (0 empty).
 * R2: a power-up never earns a power-up, including the next drop after it. Pop, Hold and Tune mark the side
 * (state.free[side]); that side's next drop still reports what it would have earned but pays nothing. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.NumbericsFour = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  var COLS = 7, ROWS = 6, N = COLS * ROWS, TEN = 10, CAP = 9, MINE = 2; // MINE: own discs a ten-line needs
  var POWERS = ["undo", "pop", "hold", "tune"];
  var CPU_POWERS = ["pop", "hold", "tune"]; // the computer never rewinds, so Undo is not in its pool
  // The bag every side deals from (reshuffled when empty). Ones-heavy by measurement: with 1-4 evenly, ten-lines
  // decided ~75% of games in ~10 discs; this bag keeps both wins in play and games longer (see the report).
  var BAG = [1, 1, 1, 1, 2, 2, 3, 4];
  var ORDER = [3, 2, 4, 1, 5, 0, 6]; // centre first
  var LEVELS = ["easy", "medium", "hard"];

  function rand(seed) { // mulberry32 step: [float, nextSeed]
    var a = (seed + 0x6d2b79f5) >>> 0, t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return [((t ^ (t >>> 14)) >>> 0) / 4294967296, a];
  }

  // ---- the 69 windows of four, and which windows touch each cell ----
  var WIN = [], BY_CELL = [];
  for (var i0 = 0; i0 < N; i0++) BY_CELL.push([]);
  [[0, 1], [1, 0], [1, 1], [1, -1]].forEach(function (d) {
    for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) {
      var er = r + 3 * d[0], ec = c + 3 * d[1];
      if (er < 0 || er >= ROWS || ec < 0 || ec >= COLS) continue;
      var w = [];
      for (var k = 0; k < 4; k++) w.push((r + k * d[0]) * COLS + c + k * d[1]);
      WIN.push(w);
      w.forEach(function (cell) { BY_CELL[cell].push(WIN.length - 1); });
    }
  });

  // ---- state ----
  function snapshot(s) { var c = clone(s); c.prev = null; return c; }
  function clone(s) {
    return {
      v: 1, level: s.level, first: s.first, seed: s.seed, aiSeed: s.aiSeed,
      own: s.own.slice(), num: s.num.slice(), turn: s.turn,
      bag: [s.bag[0].slice(), s.bag[1].slice()], next: s.next.slice(), held: s.held.slice(),
      power: [Object.assign({}, s.power[0]), Object.assign({}, s.power[1])], used: s.used.slice(),
      free: s.free ? [s.free[0] ? 1 : 0, s.free[1] ? 1 : 0] : [0, 0],
      moves: s.moves, last: s.last, over: s.over ? JSON.parse(JSON.stringify(s.over)) : null, prev: s.prev,
    };
  }
  function deal(s, side) {
    if (!s.bag[side].length) {
      var b = BAG.slice();
      for (var i = b.length - 1; i > 0; i--) {
        var r = rand(s.seed); s.seed = r[1];
        var j = Math.floor(r[0] * (i + 1)), t = b[i]; b[i] = b[j]; b[j] = t;
      }
      s.bag[side] = b;
    }
    return s.bag[side].pop();
  }
  function newGame(seed, opts) {
    opts = opts || {};
    var s = {
      v: 1, level: LEVELS.indexOf(opts.level) >= 0 ? opts.level : "medium", first: opts.first === 2 ? 2 : 1,
      seed: seed >>> 0, aiSeed: (seed ^ 0x9e3779b9) >>> 0,
      own: new Array(N).fill(0), num: new Array(N).fill(0), turn: 0,
      bag: [[], []], next: [0, 0], held: [0, 0],
      power: [{ undo: 1, pop: 0, hold: 0, tune: 0 }, { undo: 0, pop: 0, hold: 0, tune: 0 }], used: [0, 0], free: [0, 0],
      moves: 0, last: -1, over: null, prev: null,
    };
    s.turn = s.first;
    s.next[0] = deal(s, 0); s.next[1] = deal(s, 1);
    return s;
  }
  function height(own, c) { var h = 0; while (h < ROWS && own[h * COLS + c]) h++; return h; }
  function legal(s) {
    if (s.over) return [];
    return ORDER.filter(function (c) { return !s.own[(ROWS - 1) * COLS + c]; });
  }

  // Lines through `cell` that a disc of side p with number n completes there (the cell may be empty).
  // Returns [{type:"colour"|"ten", cells:[...]}]
  function linesAt(own, num, cell, p, n) {
    var out = [];
    BY_CELL[cell].forEach(function (wi) {
      var w = WIN[wi], same = 0, sum = 0, full = 0;
      for (var k = 0; k < 4; k++) {
        var x = w[k];
        if (x === cell) { same++; sum += n; full++; continue; }
        if (own[x] === p) same++;
        if (own[x]) { full++; sum += num[x]; }
      }
      if (same === 4) out.push({ type: "colour", cells: w.slice() });
      else if (full === 4 && sum === TEN && same >= MINE) out.push({ type: "ten", cells: w.slice() });
    });
    return out;
  }
  function winOf(lines) {
    if (!lines.length) return null;
    var col = lines.filter(function (l) { return l.type === "colour"; });
    var pick = col.length ? col[0] : lines[0], cells = {};
    lines.forEach(function (l) { l.cells.forEach(function (c) { cells[c] = 1; }); });
    return { type: pick.type, line: pick.cells, cells: Object.keys(cells).map(Number).sort(function (a, b) { return a - b; }),
             both: col.length > 0 && col.length < lines.length };
  }

  // Earn rule: a drop (not a win) that BLOCKS an opponent colour line of three, or makes a ten-line THREAT:
  // a line through the new disc with three discs and one empty cell, needing exactly the mover's next number
  // when the opponent's next number would not complete it.
  function earnReason(s, cell, side) {
    var p = side + 1, o = 3 - p, block = false, threat = false;
    BY_CELL[cell].forEach(function (wi) {
      var w = WIN[wi], opp = 0, filled = 0, sum = 0;
      for (var k = 0; k < 4; k++) {
        var x = w[k];
        if (x !== cell && s.own[x] === o) opp++;
        if (s.own[x]) { filled++; sum += s.num[x]; }
      }
      if (opp === 3) block = true;
      if (filled === 3) { // the new disc is the mover's, so the mover always has the two discs a ten-line needs
        var need = TEN - sum, oppCan = need === s.next[1 - side] && opp + 1 >= MINE;
        if (need === s.next[side] && !oppCan) threat = true;
      }
    });
    return block ? "block" : threat ? "threat" : null;
  }
  function award(s, side) {
    var pool = (side === 0 ? POWERS : CPU_POWERS).filter(function (n) { return s.power[side][n] < CAP; });
    if (!pool.length) return null;
    var r = rand(s.seed); s.seed = r[1];
    var name = pool[Math.floor(r[0] * pool.length)];
    s.power[side][name]++;
    return name;
  }

  // Drop the side-to-move's next disc into column c.
  function drop(state, c) {
    var fail = { ok: false, state: state };
    if (state.over || c < 0 || c >= COLS || !Number.isInteger(c)) return fail;
    var h = height(state.own, c); if (h >= ROWS) return fail;
    var s = clone(state), side = s.turn - 1, cell = h * COLS + c, n = s.next[side];
    if (side === 0) s.prev = snapshot(state); // Undo takes back this drop AND the computer's reply
    var win = winOf(linesAt(s.own, s.num, cell, s.turn, n));
    s.own[cell] = s.turn; s.num[cell] = n;
    s.next[side] = deal(s, side);
    s.moves++; s.last = cell;
    var free = !!s.free[side]; s.free[side] = 0; // R2: the drop right after this side's power-up pays nothing
    var res = { ok: true, state: s, cell: cell, num: n, side: s.turn, win: win, earned: null, award: null, free: false, full: false };
    if (win) { s.over = { winner: s.turn, type: win.type, line: win.line, cells: win.cells }; return res; }
    if (s.own.every(Boolean)) { s.over = { winner: 0, type: "draw", line: [], cells: [] }; return res; }
    var why = earnReason(s, cell, side);
    if (why && (side === 0 || s.level === "hard")) { // only Hard's computer spends, so only it earns
      res.earned = why;
      if (free) res.free = true;
      else { res.award = award(s, side); res.full = !res.award; } // R15: every slot full, the reward is skipped
    }
    s.turn = 3 - s.turn;
    return res;
  }

  // Pop: remove a disc, the discs above it drop one row. Refused if the fall would complete a line
  // (only a dropped disc ever completes a line).
  function popResult(own, num, cell) {
    if (!own[cell]) return null;
    var o = own.slice(), m = num.slice(), c = cell % COLS;
    for (var r = Math.floor(cell / COLS); r < ROWS; r++) {
      var i = r * COLS + c, up = (r + 1) * COLS + c;
      o[i] = r + 1 < ROWS ? o[up] : 0; m[i] = r + 1 < ROWS ? m[up] : 0;
    }
    for (var r2 = Math.floor(cell / COLS); r2 < ROWS; r2++) {
      var x = r2 * COLS + c; if (!o[x]) break;
      var hold = o[x], hn = m[x]; o[x] = 0; m[x] = 0;
      var bad = linesAt(o, m, x, hold, hn).length > 0;
      o[x] = hold; m[x] = hn;
      if (bad) return null;
    }
    return { own: o, num: m };
  }
  function canPop(s, cell) { return !s.over && !!popResult(s.own, s.num, cell); }
  // Every empty cell (playable now or not) where the computer's SHOWN next disc would complete a line if it
  // landed there. The client rings these on Easy and Medium so a ten-line is never an ambush (round 2, cold #5).
  function threats(s) {
    if (s.over) return [];
    var out = [], n = s.next[1];
    for (var cell = 0; cell < N; cell++) if (!s.own[cell] && linesAt(s.own, s.num, cell, 2, n).length) out.push(cell);
    return out;
  }

  // Round 3 (cold blocker, critic #1): what YOUR drop would open. For each column you can drop in now, the cells
  // where the computer's shown disc would complete a line right after your drop that it could not use before
  // (a hole your disc fills under, or a line your number adds to). Columns with nothing new are left out, and so is a
  // column whose drop wins for you. Returns { col: { cells: [...], above: bool } }; above = it wins on top of your disc.
  function playableWins(own, num, n) {
    var out = {};
    for (var c = 0; c < COLS; c++) { var h = height(own, c); if (h < ROWS && linesAt(own, num, h * COLS + c, 2, n).length) out[h * COLS + c] = 1; }
    return out;
  }
  function opens(s) {
    var res = {};
    if (s.over || s.turn !== 1) return res;
    var n = s.next[0], m = s.next[1], before = playableWins(s.own, s.num, m);
    legal(s).forEach(function (c) {
      var cell = height(s.own, c) * COLS + c;
      if (linesAt(s.own, s.num, cell, 1, n).length) return; // your drop wins: nothing to warn about
      var own = s.own.slice(), num = s.num.slice(); own[cell] = 1; num[cell] = n;
      if (own.every(Boolean)) return; // the board is full: a draw
      var after = playableWins(own, num, m), fresh = Object.keys(after).map(Number).filter(function (x) { return !before[x]; });
      if (fresh.length) res[c] = { cells: fresh.sort(function (a, b) { return a - b; }), above: fresh.indexOf(cell + COLS) >= 0 };
    });
    return res;
  }

  function use(state, name, arg) {
    var fail = { ok: false, state: state }, side = state.turn - 1;
    if (name === "undo") {
      if (state.over || !state.prev || !state.power[0].undo || state.turn !== 1) return fail; // R1: never crosses a result
      var u = clone(state.prev); u.prev = null;
      u.power[0].undo = Math.max(0, u.power[0].undo - 1); u.used[0]++; // the rewind is paid for
      return { ok: true, state: u };
    }
    if (state.over || POWERS.indexOf(name) < 0 || !state.power[side][name]) return fail;
    var s = clone(state);
    if (name === "pop") {
      var pr = Number.isInteger(arg) && arg >= 0 && arg < N ? popResult(s.own, s.num, arg) : null;
      if (!pr) return fail;
      s.own = pr.own; s.num = pr.num; if (s.last === arg) s.last = -1;
    } else if (name === "hold") {
      if (s.held[side]) { var t = s.held[side]; s.held[side] = s.next[side]; s.next[side] = t; }
      else { s.held[side] = s.next[side]; s.next[side] = deal(s, side); }
    } else if (name === "tune") {
      if (!(arg >= 1 && arg <= 4) || arg === s.next[side] || !Number.isInteger(arg)) return fail;
      s.next[side] = arg;
    }
    s.power[side][name]--; s.used[side]++; s.free[side] = 1;
    return { ok: true, state: s };
  }

  // ================= the computer =================
  // Negamax with alpha-beta, iterative deepening and a transposition table, over BOTH win conditions.
  // Fair knowledge: it knows exactly what the player sees (both next numbers, the held discs, the stock).
  // Discs deeper than the first two plies are of unknown number (0): they count for colour lines only.
  var Z1 = [], Z2 = [], ZM = [];
  (function () {
    var sd = 0x5eed4;
    function nx() { var r = rand(sd); sd = r[1]; return (r[0] * 4294967296) >>> 0; }
    for (var i = 0; i < N * 15; i++) { Z1.push(nx()); Z2.push(nx()); }
    for (var j = 0; j < 64; j++) ZM.push(nx());
  })();
  var WINF = 1000000, PBAG = [0, 0, 0, 0, 0];
  function setBag(b) { BAG = b.slice(); PBAG = [0, 0, 0, 0, 0]; BAG.forEach(function (n) { PBAG[n] += 1 / BAG.length; }); }
  setBag(BAG);
  // Strength per level. loose: chance a turn picks at random among the columns the search does not see losing;
  // blunder: chance a loose turn ignores even that (any legal column). A win in one is always taken.
  // Tuned against a safe-move player (never leaves the computer an immediate line for its shown disc), see tests.
  var LV = { easy: { depth: 2, nodes: 3000, loose: 1, blunder: 0.5 }, medium: { depth: 6, nodes: 20000, loose: 0.85, blunder: 0.2 },
             hard: { depth: 14, nodes: 40000, loose: 0.5, blunder: 0.15 } };

  function Search(own, num, toMove, masks, budget) {
    this.own = Int8Array.from(own); this.num = Int8Array.from(num);
    this.h = new Int8Array(COLS); for (var c = 0; c < COLS; c++) this.h[c] = height(own, c);
    this.count = 0; for (var i = 0; i < N; i++) if (own[i]) this.count++;
    this.masks = masks; this.root = toMove; this.budget = budget; this.nodes = 0; this.abort = false;
    this.tt = new Map(); this.h1 = 0; this.h2 = 0;
    for (var k = 0; k < N; k++) if (own[k]) { var z = k * 15 + own[k] * 5 + num[k]; this.h1 ^= Z1[z]; this.h2 ^= Z2[z]; }
  }
  // does side p, dropping at cell with number mask m (bit n set = number n allowed), win?
  Search.prototype.wins = function (cell, p, m) {
    var own = this.own, num = this.num, ws = BY_CELL[cell];
    for (var a = 0; a < ws.length; a++) {
      var w = WIN[ws[a]], same = 1, sum = 0, known = 1;
      for (var k = 0; k < 4; k++) {
        var x = w[k]; if (x === cell) continue;
        if (own[x] === p) same++;
        if (!own[x] || !num[x]) known = 0; else sum += num[x];
      }
      if (same === 4) return true;
      if (known && m && same >= MINE) { var need = TEN - sum; if (need >= 1 && need <= 4 && (m & (1 << need))) return true; }
    }
    return false;
  };
  Search.prototype.play = function (c, p, n) {
    var cell = this.h[c] * COLS + c; this.own[cell] = p; this.num[cell] = n; this.h[c]++; this.count++;
    var z = cell * 15 + p * 5 + n; this.h1 ^= Z1[z]; this.h2 ^= Z2[z]; return cell;
  };
  Search.prototype.unplay = function (c) {
    this.h[c]--; var cell = this.h[c] * COLS + c, z = cell * 15 + this.own[cell] * 5 + this.num[cell];
    this.h1 ^= Z1[z]; this.h2 ^= Z2[z]; this.own[cell] = 0; this.num[cell] = 0; this.count--;
  };
  var WT = [0, 1, 6, 40];
  Search.prototype.evaluate = function (p) {
    var own = this.own, sc = 0;
    for (var i = 0; i < WIN.length; i++) {
      var w = WIN[i], a = 0, b = 0;
      for (var k = 0; k < 4; k++) {
        var x = w[k], v = own[x];
        if (v === p) a++; else if (v) b++;
      }
      if (!b && a) sc += WT[a]; else if (!a && b) sc -= WT[b];
    }
    for (var r = 0; r < ROWS; r++) { var v3 = own[r * COLS + 3]; if (v3 === p) sc += 3; else if (v3) sc -= 3; }
    return sc;
  };
  Search.prototype.single = function (m) { return m === 2 ? 1 : m === 4 ? 2 : m === 8 ? 3 : m === 16 ? 4 : 0; };
  // Chance that the side to move, holding a disc of unknown number, can complete an open ten-line now:
  // the bag share of every number that some playable hole needs.
  Search.prototype.chance = function (p) {
    var own = this.own, num = this.num, need = 0;
    for (var c = 0; c < COLS; c++) {
      if (this.h[c] >= ROWS) continue;
      var cell = this.h[c] * COLS + c, ws = BY_CELL[cell];
      for (var a = 0; a < ws.length; a++) {
        var w = WIN[ws[a]], sum = 0, ok = 1, mine = 1;
        for (var k = 0; k < 4; k++) { var x = w[k]; if (x === cell) continue; if (!own[x] || !num[x]) { ok = 0; break; } sum += num[x]; if (own[x] === p) mine++; }
        if (ok && mine >= MINE && sum >= 6 && sum <= 9) need |= 1 << (TEN - sum);
      }
    }
    if (!need) return 0;
    var pr = 0, pb = this.pbag[p]; for (var n = 1; n <= 4; n++) if (need & (1 << n)) pr += pb[n];
    return pr;
  };
  var LUCK = 4000; // value of a ten-line that only lands if the right number is dealt (times its chance)
  Search.prototype.negamax = function (depth, alpha, beta, ply, p) {
    if (++this.nodes > this.budget) { this.abort = true; return 0; }
    var m = ply < this.masks.length ? this.masks[ply] : 0, c, i;
    for (i = 0; i < 7; i++) { c = ORDER[i]; if (this.h[c] < ROWS && this.wins(this.h[c] * COLS + c, p, m)) return WINF - ply; }
    if (this.count >= N - 1) return 0; // the last disc cannot win (checked above), so a draw
    var pr = m ? 0 : this.chance(p);
    if (pr >= 1) return LUCK;
    if (pr > 0) { // expectation: pr * LUCK + (1 - pr) * (the game if the number does not fit)
      var g = pr * LUCK, q = 1 - pr;
      return g + q * this.body(depth, (alpha - g) / q, (beta - g) / q, ply, p, m);
    }
    return this.body(depth, alpha, beta, ply, p, m);
  };
  Search.prototype.body = function (depth, alpha, beta, ply, p, m) {
    if (depth <= 0) return this.evaluate(p);
    var c, i;
    var key = (this.h1 ^ ZM[(ply < 2 ? m : 0) + (p === 1 ? 32 : 0)]) * 2097152 + (this.h2 & 0x1fffff);
    var e = this.tt.get(key), best = -Infinity, bestC = -1, a0 = alpha;
    if (e && e.d >= depth) {
      if (e.f === 0) return e.v;
      if (e.f === 1 && e.v > alpha) alpha = e.v; else if (e.f === 2 && e.v < beta) beta = e.v;
      if (alpha >= beta) return e.v;
    }
    var order = ORDER;
    if (e && e.m >= 0) { order = [e.m].concat(ORDER.filter(function (x) { return x !== e.m; })); }
    var n = this.single(m);
    for (i = 0; i < 7; i++) {
      c = order[i]; if (this.h[c] >= ROWS) continue;
      this.play(c, p, n);
      var v = -this.negamax(depth - 1, -beta, -alpha, ply + 1, 3 - p);
      this.unplay(c);
      if (this.abort) return 0;
      if (v > best) { best = v; bestC = c; }
      if (v > alpha) alpha = v;
      if (alpha >= beta) break;
    }
    if (this.tt.size > 400000) this.tt.clear();
    this.tt.set(key, { d: depth, v: best, f: best <= a0 ? 2 : best >= beta ? 1 : 0, m: bestC });
    return best;
  };
  // Root: scores for every legal column at the deepest fully finished depth.
  Search.prototype.rootScores = function (maxDepth) {
    var p = this.root, m = this.masks[0], n = this.single(m), done = null, depthDone = 0;
    var cols = ORDER.filter(function (c) { return this.h[c] < ROWS; }, this);
    for (var d = 1; d <= maxDepth; d++) {
      var sc = {}, alpha = -Infinity, prevBest = done ? done.best : -1, ord = cols;
      if (prevBest >= 0) ord = [prevBest].concat(cols.filter(function (x) { return x !== prevBest; }));
      var bestC = -1, best = -Infinity;
      for (var i = 0; i < ord.length; i++) {
        var c = ord[i], cell = this.h[c] * COLS + c, v;
        if (this.wins(cell, p, m)) v = WINF;
        else {
          this.play(c, p, n);
          // full window at the root keeps every column's score exact (Easy and the power logic read them)
          v = -this.negamax(d - 1, -Infinity, Infinity, 1, 3 - p);
          this.unplay(c);
        }
        if (this.abort) break;
        sc[c] = v; if (v > best) { best = v; bestC = c; }
        alpha = Math.max(alpha, v);
      }
      if (this.abort) break;
      done = { best: bestC, score: best, scores: sc, depth: d }; depthDone = d;
      if (best >= WINF - 64 || best <= -WINF + 64) break; // forced result found
    }
    return done;
  };

  function dist(bag) {
    if (!bag.length) return PBAG;
    var d = [0, 0, 0, 0, 0]; bag.forEach(function (n) { d[n] += 1 / bag.length; }); return d;
  }
  function bit(n) { return n ? 1 << n : 0; }
  // what the side to move after `side` could drop next (Hard models the opponent's Hold and Tune too)
  function oppMask(s, side, smart) {
    var o = 1 - side, m = bit(s.next[o]);
    if (smart && s.power[o].tune) m = 30;
    if (smart && s.power[o].hold && s.held[o]) m |= bit(s.held[o]); // a Hold with nothing held deals blind
    return m;
  }
  function analyse(s, opts) {
    opts = opts || {};
    var side = s.turn - 1, lv = LV[opts.level || s.level] || LV.medium;
    var own = opts.own || s.own, num = opts.num || s.num;
    var masks = [bit(opts.n || s.next[side]), oppMask(s, side, (opts.level || s.level) === "hard")];
    var se = new Search(own, num, s.turn, masks, opts.nodes || lv.nodes);
    se.pbag = [null, dist(s.bag[0]), dist(s.bag[1])]; // the public odds of each side's following number
    var r = se.rootScores(opts.depth || lv.depth);
    if (r) r.nodes = se.nodes;
    return r;
  }
  function bestMove(s, opts) { var r = analyse(s, opts); return r ? r.best : legal(s)[0]; }

  // The computer's whole turn: optional power-ups, then a drop. Pure: returns the new state and the actions.
  function computerTurn(state) {
    if (state.over || state.turn !== 2) return { state: state, actions: [] };
    var s = clone(state), lvName = s.level, side = 1, actions = [];
    function act(name, arg) { var u = use(s, name, arg); if (u.ok) { s = u.state; actions.push({ type: name, arg: arg }); } return u.ok; }
    var col, lp = LV[lvName] || LV.medium, loose = false;
    if (lp.loose) { var rr = rand(s.aiSeed); s.aiSeed = rr[1]; loose = rr[0] < lp.loose; }
    if (lvName === "hard" && !loose) col = hardPowers(s, act);
    if (col === undefined || col === null) {
      var r = analyse(s, {});
      col = r ? r.best : legal(s)[0];
      var won = r && r.score >= WINF - 64;
      var rest = won && lp.missTen ? missTens(s, r.scores) : null;
      if (rest) { // Easy sometimes misses a ten-line it could finish, so a new player can win one (gameplay #9)
        var rm = rand(s.aiSeed); s.aiSeed = rm[1];
        if (rm[0] < lp.missTen) { won = false; loose = true; r = { scores: rest, score: 0 }; }
      }
      if (loose && r && !won) {
        // a loose turn: a found win is always played, otherwise a random column the search does not see losing
        // (or, on a blunder, any legal column)
        var all = Object.keys(r.scores).map(Number);
        var ok = all.filter(function (c) { return r.scores[c] > -WINF + 64; });
        var r3 = rand(s.aiSeed); s.aiSeed = r3[1];
        if (!ok.length || r3[0] < lp.blunder) ok = all;
        var r2 = rand(s.aiSeed); s.aiSeed = r2[1];
        col = ok[Math.floor(r2[0] * ok.length)];
      }
    }
    var d = drop(s, col);
    actions.push({ type: "drop", arg: col, cell: d.cell });
    return { state: d.state, actions: actions, drop: d };
  }
  // the immediate wins open to the side to move: { c: "colour" | "ten" }
  function winsNow(s) {
    var out = {}, n = s.next[s.turn - 1];
    legal(s).forEach(function (c) {
      var ls = linesAt(s.own, s.num, height(s.own, c) * COLS + c, s.turn, n);
      if (ls.length) out[c] = ls.some(function (l) { return l.type === "colour"; }) ? "colour" : "ten";
    });
    return out;
  }
  // Easy's miss: when its only wins in one are ten-lines, the scores without those columns (a colour four is never missed)
  function missTens(s, scores) {
    var w = winsNow(s), cols = Object.keys(w);
    if (!cols.length || cols.some(function (c) { return w[c] === "colour"; })) return null;
    var out = {}, any = false;
    Object.keys(scores).forEach(function (k) { if (!w[k]) { out[k] = scores[k]; any = true; } });
    return any ? out : null;
  }
  function immediateWin(s, n, own, num) {
    own = own || s.own; num = num || s.num;
    for (var i = 0; i < 7; i++) {
      var c = ORDER[i], h = height(own, c); if (h >= ROWS) continue;
      if (linesAt(own, num, h * COLS + c, s.turn, n).length) return c;
    }
    return -1;
  }
  function hardPowers(s, act) {
    var side = 1, pw = s.power[side], n = s.next[side], c;
    if ((c = immediateWin(s, n)) >= 0) return c;
    if (pw.tune) for (var k = 1; k <= 4; k++) if (k !== n && (c = immediateWin(s, k)) >= 0) { act("tune", k); return c; }
    if (pw.hold && s.held[side] && (c = immediateWin(s, s.held[side])) >= 0) { act("hold"); return c; }
    if (pw.pop) for (var cell = 0; cell < N; cell++) {
      if (!s.own[cell]) continue;
      var pr = popResult(s.own, s.num, cell);
      if (pr && immediateWin(s, n, pr.own, pr.num) >= 0) { act("pop", cell); return immediateWin(s, n); }
    }
    // in trouble? try each power-up and keep the one that saves the most
    var base = analyse(s, {});
    if (!base || base.score > -WINF + 64) return base ? base.best : null;
    var bestS = base.score, plan = null;
    if (pw.tune) for (var t = 1; t <= 4; t++) if (t !== n) {
      var rt = analyse(s, { n: t, nodes: 5000, depth: 8 });
      if (rt && rt.score > bestS) { bestS = rt.score; plan = ["tune", t]; }
    }
    if (pw.hold && s.held[side]) {
      var rh = analyse(s, { n: s.held[side], nodes: 5000, depth: 8 });
      if (rh && rh.score > bestS) { bestS = rh.score; plan = ["hold"]; }
    }
    if (pw.pop) for (var pc = 0; pc < N; pc++) {
      if (s.own[pc] !== 1) continue;
      var pp = popResult(s.own, s.num, pc); if (!pp) continue;
      var rp = analyse(s, { own: pp.own, num: pp.num, nodes: 1500, depth: 4 });
      if (rp && rp.score > bestS) { bestS = rp.score; plan = ["pop", pc]; }
    }
    if (!plan) return base.best;
    act(plan[0], plan[1]);
    var again = analyse(s, {});
    return again ? again.best : legal(s)[0];
  }

  return { COLS: COLS, ROWS: ROWS, TEN: TEN, CAP: CAP, MINE: MINE, BAG: BAG, POWERS: POWERS, LEVELS: LEVELS, WINDOWS: WIN,
           newGame: newGame, drop: drop, use: use, legal: legal, height: height, canPop: canPop, threats: threats, opens: opens,
           linesAt: linesAt, computerTurn: computerTurn, bestMove: bestMove, analyse: analyse, rand: rand,
           _setBag: setBag, _LV: LV };
});
