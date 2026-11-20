/* SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 alvations (Melon Lab)
 *
 * Numberics Fifteen: pure engine. No DOM, no storage, no clock.
 * Pick 15: two sides take turns claiming numbers 1-9; the first side holding three numbers that sum
 * to 15 wins the round. On the magic square 8 1 6 / 3 5 7 / 4 9 2 those triples are exactly the 8
 * rows, columns and diagonals, so it is tic-tac-toe. A match is best of five rounds; the starting side
 * alternates; winning a round earns a power-up (docs/ROADMAP.md 0a).
 *
 * Sides: 1 = you, 2 = the computer. owner[n-1] is 0 (free), 1 or 2.
 * Power-up rules (all enforced here, tested in tests/test-fifteen.js):
 * - At most ONE board-changing power-up (Erase or Double) per turn. Peek and Undo are free actions.
 * - Erase frees one opponent number; the eraser still claims one number this turn, but not the one it
 *   just erased (Erase removes, it never steals). Needs the opponent to hold a number.
 * - Double: claim two numbers this turn. Needs at least two free numbers. A win on the first claim ends
 *   the round at once.
 * - Only the side that just claimed can complete a 15, and the round ends the instant it does, so both
 *   sides can never hold a 15 at the same time (Erase only ever removes an opponent number).
 * - A round won by a side that used Erase or Double at any point in that round earns nothing (a power-up
 *   never earns a power-up, not even a turn later: family rule R2). Peek only shows information, so it
 *   does not stop a round from earning.
 * - Undo (you only) rewinds to the start of your last turn, the computer's reply included, restoring the
 *   whole snapshot (stock, score, round) minus the Undo charge spent, and a Peek spent since then stays
 *   spent (R3). It never crosses a decided round or match (R1), nor into a new round.
 * - On Hard you start each match with one Undo AND one Erase (perfect play is a draw; this breaks it,
 *   so a perfect player can always win a Hard match: tests/test-fifteen.js measures it).
 * - The computer earns power-ups only on Hard, by the same rule, only Erase or Double (the two it
 *   uses), starts with none, and uses Erase and Double only when they
 *   turn its solved result strictly better (a draw into a win, or a loss into a draw or win).
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.NumbericsFifteen = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var MAGIC = [8, 1, 6, 3, 5, 7, 4, 9, 2];          // grid cell -> number
  var ROUNDS = 5, CAP = 9;
  var POWERS = ["undo", "erase", "peek", "double"];
  var DIFFS = ["easy", "medium", "hard"];
  var CPU_POWERS = ["erase", "double"];

  // the 8 magic lines, as number triples (rows, columns, diagonals of MAGIC)
  var CELL_LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
  var LINES = CELL_LINES.map(function (l) { return l.map(function (c) { return MAGIC[c]; }); });
  var CELL_OF = {}; MAGIC.forEach(function (n, c) { CELL_OF[n] = c; });

  // every triple of distinct numbers 1-9 that sums to 15 (computed, not listed: the test compares)
  function triples15() {
    var out = [];
    for (var a = 1; a <= 9; a++) for (var b = a + 1; b <= 9; b++) for (var c = b + 1; c <= 9; c++) if (a + b + c === 15) out.push([a, b, c]);
    return out;
  }
  var TRIPLES = triples15();

  // mulberry32 step: rand(seed) -> [float, nextSeed]
  function rand(seed) {
    var a = (seed + 0x6d2b79f5) >>> 0, t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return [((t ^ (t >>> 14)) >>> 0) / 4294967296, a];
  }
  function roll(s) { var r = rand(s.seed); s.seed = r[1]; return r[0]; }
  function pickOne(s, arr) { return arr[Math.floor(roll(s) * arr.length)]; }

  // ---- pure board helpers (owner = array of 9) ----
  function held(owner, side) { var o = []; for (var n = 1; n <= 9; n++) if (owner[n - 1] === side) o.push(n); return o; }
  function free(owner) { return held(owner, 0); }
  // the 15-triple a side holds (by sum, over every triple), or null
  function sumWin(owner, side) {
    for (var i = 0; i < TRIPLES.length; i++) {
      var t = TRIPLES[i];
      if (owner[t[0] - 1] === side && owner[t[1] - 1] === side && owner[t[2] - 1] === side) return t.slice();
    }
    return null;
  }
  // the same question asked on the grid: three in a row of the magic square
  function gridWin(owner, side) {
    for (var i = 0; i < CELL_LINES.length; i++) {
      var l = CELL_LINES[i];
      if (l.every(function (c) { return owner[MAGIC[c] - 1] === side; })) return l.map(function (c) { return MAGIC[c]; }).sort(function (a, b) { return a - b; });
    }
    return null;
  }
  // numbers that would complete a 15 for `side` right now
  function threats(owner, side) {
    var out = [];
    free(owner).forEach(function (n) {
      var o = owner.slice(); o[n - 1] = side;
      if (sumWin(o, side)) out.push(n);
    });
    return out;
  }

  // ---- exact solver: negamax over (owner, side to move), memoised. 3^9 * 2 positions at most. ----
  // value for the side to move: >0 win (bigger = sooner), 0 draw, <0 loss. Power-ups are not in the tree.
  var memo = {};
  function code(owner, side) { var k = 0; for (var i = 0; i < 9; i++) k = k * 3 + owner[i]; return k * 2 + (side - 1); }
  function solve(owner, side) {
    var other = 3 - side, k = code(owner, side);
    if (memo[k] !== undefined) return memo[k];
    var f = free(owner), v;
    if (sumWin(owner, other)) v = -(f.length + 1);
    else if (sumWin(owner, side)) v = f.length + 1;       // only reachable through a forged state
    else if (!f.length) v = 0;
    else {
      v = -99;
      for (var i = 0; i < f.length; i++) {
        owner[f[i] - 1] = side; var c = -solve(owner, other); owner[f[i] - 1] = 0;
        if (c > v) v = c;
      }
    }
    memo[k] = v; return v;
  }
  // value of a position just after `side` finished its turn (opponent to move), from `side`'s view
  function after(owner, side) {
    if (sumWin(owner, side)) return free(owner).length + 1;
    return -solve(owner, 3 - side);
  }
  function scored(owner, side) {
    return free(owner).map(function (n) {
      var o = owner.slice(); o[n - 1] = side; return { n: n, v: after(o, side) };
    });
  }
  function bestMoves(owner, side) {
    var s = scored(owner, side), top = Math.max.apply(null, s.map(function (m) { return m.v; }));
    return s.filter(function (m) { return m.v === top; }).map(function (m) { return m.n; });
  }

  // ---- state ----
  function stock(start) { var s = {}; POWERS.forEach(function (p) { s[p] = 0; }); for (var k in start) s[k] = start[k]; return s; }
  function clone(s) { return JSON.parse(JSON.stringify(s)); }
  function newMatch(seed, diff) {
    return {
      seed: seed >>> 0, diff: DIFFS.indexOf(diff) >= 0 ? diff : "medium",
      round: 1, starter: 1, turn: 1, owner: [0, 0, 0, 0, 0, 0, 0, 0, 0],
      claimsLeft: 1, usedPower: false, blocked: 0, acted: false,
      powered: [false, false, false], // [unused, you, computer]: used Erase or Double this round (R2)
      wins: [0, 0, 0],           // [draws, your rounds, computer rounds]
      rounds: [],                // winner of each finished round (0 draw)
      result: null,              // {winner: 0|1|2, line: [a,b,c] | null, earned: name|null}
      match: null,               // {winner: 0|1|2} once the match is decided
      // Hard is a solved draw, so on Hard you start with one Erase to break it (the computer does not)
      power: stock(diff === "hard" ? { undo: 1, erase: 1 } : { undo: 1 }), cpuPower: stock({}),
      prev: null, moves: 0, last: [],
    };
  }
  function stockOf(s, side) { return side === 1 ? s.power : s.cpuPower; }
  function playing(s) { return !s.result && !s.match; }
  function earns(s, side) { return side === 1 || s.diff === "hard"; }

  function award(s, side) {
    // the computer only earns what it can use (Erase, Double), so no charge is wasted
    var st = stockOf(s, side), open = (side === 1 ? POWERS : CPU_POWERS).filter(function (p) { return st[p] < CAP; });
    if (!open.length) return null;
    var p = pickOne(s, open); st[p]++; return p;
  }
  function decided(s) {
    var left = ROUNDS - s.rounds.length;
    if (s.wins[1] > s.wins[2] + left || s.wins[2] > s.wins[1] + left || !left) {
      s.match = { winner: s.wins[1] > s.wins[2] ? 1 : s.wins[2] > s.wins[1] ? 2 : 0 };
    }
  }
  function endRound(s, winner, line) {
    var earned = null;
    if (winner && earns(s, winner) && !s.usedPower && !(s.powered && s.powered[winner])) earned = award(s, winner);
    s.result = { winner: winner, line: line, earned: earned };
    s.wins[winner]++; s.rounds.push(winner);
    decided(s);
  }
  // snapshot at the start of your turn (first action), for Undo
  // and `last` (what the side to move did this turn) restarts on the first board action of a turn
  function begin(s) {
    if (s.acted) return;
    if (s.turn === 1) { var p = clone(s); p.prev = null; s.prev = p; }
    s.acted = true; s.last = [];
  }
  function endTurn(s) { s.turn = 3 - s.turn; s.claimsLeft = 1; s.usedPower = false; s.blocked = 0; s.acted = false; }

  // claim a free number for the side to move
  function claim(state, n) {
    var fail = { ok: false, state: state };
    if (!playing(state) || !(n >= 1 && n <= 9) || state.owner[n - 1] !== 0 || n === state.blocked) return fail;
    var s = clone(state), side = s.turn;
    begin(s);
    s.owner[n - 1] = side; s.moves++; s.claimsLeft--; s.last.push({ side: side, type: "claim", n: n });
    var line = sumWin(s.owner, side);
    if (line) { endRound(s, side, line); return { ok: true, state: s }; }
    if (!free(s.owner).length) { endRound(s, 0, null); return { ok: true, state: s }; }
    if (s.claimsLeft <= 0) endTurn(s);
    return { ok: true, state: s };
  }

  // can the side to move use this power-up right now?
  function canUse(s, name, side) {
    side = side || s.turn;
    var st = stockOf(s, side);
    if (!st[name]) return false;
    if (name === "undo") return side === 1 && !!s.prev && !s.result && !s.match;   // R1
    if (!playing(s) || s.turn !== side) return false;
    if (name === "peek") return true;
    if (s.usedPower || s.claimsLeft !== 1) return false;
    if (name === "erase") return held(s.owner, 3 - side).length > 0;
    if (name === "double") return free(s.owner).length >= 2;
    return false;
  }
  function peekInfo(owner, side) {
    return { win: threats(owner, side), block: threats(owner, 3 - side), best: bestMoves(owner, side) };
  }
  // use(state, name, arg): erase takes the opponent number to remove
  function use(state, name, arg) {
    var fail = { ok: false, state: state };
    if (POWERS.indexOf(name) < 0) return fail;
    if (name === "undo") {
      if (!canUse(state, "undo", 1)) return fail;
      var r = clone(state.prev);
      r.power.undo = Math.max(0, r.power.undo - 1);   // the rewind is paid for
      // an information power-up spent since the snapshot stays spent (R3): what was seen cannot be unseen
      r.power.peek = Math.min(r.power.peek, state.power.peek);
      r.prev = null; r.last = [];
      return { ok: true, state: r };
    }
    var side = state.turn;
    if (!canUse(state, name, side)) return fail;
    if (name === "erase" && !(arg >= 1 && arg <= 9 && state.owner[arg - 1] === 3 - side)) return fail;
    var s = clone(state);
    if (name !== "peek") begin(s);   // Peek is a free look: it never moves the Undo snapshot
    stockOf(s, side)[name]--;
    if (name === "peek") return { ok: true, state: s, info: peekInfo(s.owner, side) };
    s.usedPower = true;
    if (!s.powered) s.powered = [false, false, false];
    s.powered[side] = true;
    if (name === "erase") { s.owner[arg - 1] = 0; s.blocked = arg; s.last.push({ side: side, type: "erase", n: arg }); }
    if (name === "double") { s.claimsLeft = 2; s.last.push({ side: side, type: "double" }); }
    return { ok: true, state: s };
  }

  // ---- the computer ----
  // Plans one whole turn for side 2. Returns a list of actions [{type:"erase"|"double"|"claim", n}].
  function plan(s) {
    var side = s.turn, owner = s.owner, f = free(owner), i, j;
    var win = threats(owner, side);
    if (s.diff === "easy") return [{ type: "claim", n: win.length ? pickOne(s, win) : pickOne(s, f) }];
    if (s.diff === "medium") {
      if (win.length) return [{ type: "claim", n: pickOne(s, win) }];
      var blk = threats(owner, 3 - side);
      return [{ type: "claim", n: blk.length ? pickOne(s, blk) : pickOne(s, f) }];
    }
    // hard: perfect play; a power-up only when it improves the solved result
    var base = scored(owner, side), top = Math.max.apply(null, base.map(function (m) { return m.v; }));
    var best = { v: top, acts: null }, st = stockOf(s, side);
    if (top <= 0 && canUse(s, "double", side)) {
      for (i = 0; i < f.length; i++) for (j = 0; j < f.length; j++) {
        if (i === j) continue;
        var o = owner.slice(); o[f[i] - 1] = side;
        var v = sumWin(o, side) ? 99 : (o[f[j] - 1] = side, after(o, side));
        if (v > best.v) best = { v: v, acts: [{ type: "double" }, { type: "claim", n: f[i] }, { type: "claim", n: f[j] }] };
      }
    }
    if (top <= 0 && st.erase && canUse(s, "erase", side)) {
      held(owner, 3 - side).forEach(function (e) {
        f.forEach(function (n) {
          var o = owner.slice(); o[e - 1] = 0; o[n - 1] = side;
          var v = after(o, side);
          if (v > best.v) best = { v: v, acts: [{ type: "erase", n: e }, { type: "claim", n: n }] };
        });
      });
    }
    if (best.acts) {
      if (best.acts.length === 3 && best.v === 99) best.acts.pop();   // the first claim already wins
      return best.acts;
    }
    var tops = base.filter(function (m) { return m.v === top; }).map(function (m) { return m.n; });
    return [{ type: "claim", n: pickOne(s, tops) }];
  }
  // play the computer's whole turn; the random choices advance state.seed
  function cpuTurn(state) {
    if (!playing(state) || state.turn !== 2) return { ok: false, state: state, actions: [] };
    var s = clone(state), acts = plan(s), out = [];
    for (var i = 0; i < acts.length && playing(s) && s.turn === 2; i++) {
      var a = acts[i], r = a.type === "claim" ? claim(s, a.n) : use(s, a.type, a.n);
      if (!r.ok) break;
      s = r.state; out.push(a);
    }
    // a plan must never leave the turn half-played (defensive: should not happen)
    while (playing(s) && s.turn === 2) {
      var f = free(s.owner).filter(function (n) { return n !== s.blocked; });
      s = claim(s, f[0]).state; out.push({ type: "claim", n: f[0] });
    }
    return { ok: true, state: s, actions: out };
  }

  function nextRound(state) {
    if (!state.result || state.match) return state;
    var s = clone(state);
    s.round++; s.starter = 3 - s.starter; s.turn = s.starter;
    s.owner = [0, 0, 0, 0, 0, 0, 0, 0, 0];
    s.claimsLeft = 1; s.usedPower = false; s.blocked = 0; s.acted = false; s.powered = [false, false, false];
    s.result = null; s.prev = null; s.last = [];
    return s;
  }
  // a fresh match keeps the difficulty, resets the stock (each run starts with one Undo)
  function setDiff(state, diff, seed) { return newMatch(seed === undefined ? state.seed : seed, diff); }

  function valid(s) {
    try {
      return !!s && Array.isArray(s.owner) && s.owner.length === 9 && s.owner.every(function (v) { return v === 0 || v === 1 || v === 2; }) &&
        DIFFS.indexOf(s.diff) >= 0 && (s.turn === 1 || s.turn === 2) && (s.starter === 1 || s.starter === 2) &&
        s.round >= 1 && s.round <= ROUNDS && Array.isArray(s.wins) && s.wins.length === 3 && Array.isArray(s.rounds) &&
        POWERS.every(function (p) { return Number.isInteger(s.power[p]) && s.power[p] >= 0 && s.power[p] <= CAP && Number.isInteger(s.cpuPower[p]); }) &&
        !(sumWin(s.owner, 1) && sumWin(s.owner, 2));
    } catch (e) { return false; }
  }

  return {
    MAGIC: MAGIC, LINES: LINES, CELL_LINES: CELL_LINES, CELL_OF: CELL_OF, TRIPLES: TRIPLES, ROUNDS: ROUNDS, CAP: CAP,
    POWERS: POWERS, CPU_POWERS: CPU_POWERS, DIFFS: DIFFS, triples15: triples15, held: held, free: free, sumWin: sumWin, gridWin: gridWin,
    threats: threats, solve: solve, bestMoves: bestMoves, peekInfo: peekInfo,
    newMatch: newMatch, claim: claim, use: use, canUse: canUse, plan: plan, cpuTurn: cpuTurn,
    nextRound: nextRound, setDiff: setDiff, valid: valid, playing: playing,
  };
});
