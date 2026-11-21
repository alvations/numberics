/* SPDX-License-Identifier: Apache-2.0 | Copyright 2026 alvations (Melon Lab)
 * Numberics Nine: pure rules (UMD: browser global NumbericsNine AND require). No DOM, storage or clock.
 * Nim with number tiles 1 to 9. Take any amount from one tile; whoever takes last wins (Misere: loses).
 * A run climbs levels: a match is best of five rounds on N tiles (3 up to 9); win the match to add a tile.
 * All randomness comes from state.seed (mulberry32 via NumbericsKit.rand), so a seed replays exactly. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("../shared/kit.js"), require("../shared/power.js"));
  else root.NumbericsNine = factory(root.NumbericsKit, root.NumbericsPower);
})(typeof self !== "undefined" ? self : this, function (Kit, Power) {
  "use strict";
  var POWERS = ["undo", "add", "pass", "peek"];
  var CPU_POWERS = ["add", "pass"]; // the computer only earns what it plays (it never undoes or peeks)
  var MAX = 9, MIN_TILES = 3, MAX_TILES = 9, WIN_ROUNDS = 3; // best of five: first to three
  var DIFFS = ["easy", "medium", "hard"];

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function rnd(s) { var r = Kit.rand(s.seed); s.seed = r[1]; return r[0]; }
  function pickIn(s, arr) { return arr[Math.floor(rnd(s) * arr.length)]; }
  function other(who) { return who === "you" ? "cpu" : "you"; }

  // ---- pure Nim theory ----
  function nimSum(h) { return h.reduce(function (a, v) { return a ^ v; }, 0); }
  function total(h) { return h.reduce(function (a, v) { return a + v; }, 0); }
  // Is the side to move winning? Normal play: nim-sum != 0. Misere (last take loses): the same, except when
  // every tile is 0 or 1, where the mover wins exactly when the count of 1s is even. An empty row means the
  // previous player took last: the mover has lost in normal play and has won in Misere.
  function winning(h, misere) {
    if (!misere) return nimSum(h) !== 0;
    var big = h.some(function (v) { return v > 1; });
    if (big) return nimSum(h) !== 0;
    return total(h) % 2 === 0;
  }
  function legalMoves(h) {
    var out = [];
    h.forEach(function (v, i) { for (var to = v - 1; to >= 0; to--) out.push({ tile: i, to: to }); });
    return out;
  }
  function after(h, m) { var n = h.slice(); n[m.tile] = m.to; return n; }
  // Every move that leaves the opponent in a losing position (empty list when the mover is losing).
  function winningMoves(h, misere) {
    return legalMoves(h).filter(function (m) { return !winning(after(h, m), misere); });
  }
  // Peek: one winning move, or null. Prefers the smallest take (it teaches the idea, not a shortcut).
  function peek(h, misere) {
    var w = winningMoves(h, misere);
    if (!w.length) return null;
    w.sort(function (a, b) { return (h[a.tile] - a.to) - (h[b.tile] - b.to) || a.tile - b.tile; });
    return w[0];
  }

  // ---- dealing ----
  // Easy and Medium: every start is a win for the player, who moves first, so perfect play always wins.
  // Hard: the start is random. One round in five (HARD_LOSING) deals the player a losing position, so a perfect
  // player must sometimes turn a bad start around with Pass or Add (docs/DESIGN.md, Nine).
  var HARD_LOSING = 0.2; // measured: a perfect player using Add and Pass wins about two Hard matches in three
  function dealWhere(s, n, want) {
    for (var k = 0; k < 2000; k++) {
      var h = [];
      for (var i = 0; i < n; i++) h.push(1 + Math.floor(rnd(s) * MAX));
      if (winning(h, s.misere) === want) return h;
    }
    // never reached in practice (either kind is at least 1 deal in 20); a fixed search keeps it total
    for (var a = 1; a <= MAX; a++) for (var b = 1; b <= MAX; b++) {
      var f = []; for (var j = 0; j < n; j++) f.push(j === 0 ? a : j === 1 ? b : 1);
      if (winning(f, s.misere) === want) return f;
    }
    return f;
  }
  // Every round gets a fresh deal: never the same start as the round before (round 2 lead: a losing Hard deal
  // seemed to repeat after a loss; measured, that was chance, about 1 in 250 on three tiles, but a repeat
  // reads as a bug, so it is ruled out).
  function deal(s, n) {
    var want = s.diff === "hard" ? rnd(s) >= HARD_LOSING : true, h;
    for (var k = 0; k < 50; k++) {
      h = dealWhere(s, n, want);
      if (!s.dealt || h.join() !== s.dealt.join()) break;
    }
    return h;
  }

  function opts(o) {
    o = o || {};
    return { diff: DIFFS.indexOf(o.diff) >= 0 ? o.diff : "medium", misere: !!o.misere,
             level: Math.max(MIN_TILES, Math.min(MAX_TILES, o.level | 0 || MIN_TILES)) };
  }
  function freshRound(s) {
    s.heaps = deal(s, s.level); s.dealt = s.heaps.slice(); s.turn = "you"; s.acted = false; s.added = false;
    // R2: a side that used Add, Pass or Peek this round earns nothing for winning it (round 3: Peek counts as help,
    // like Six's Hint); Pass is once per round per side. s.peeked survives Undo, so Peek + Undo cannot clear it.
    s.powered = { you: false, cpu: false }; s.passed = { you: false, cpu: false }; s.peeked = { you: false, cpu: false };
    // R2 for Undo (round 5, S9, as Five): once you Undo in a round, winning it pays nothing; the mark survives later rewinds
    s.undone = false;
    s.lastTurn = null; s.last = null; s.prev = null; s.roundOver = null; s.award = null;
  }
  // A new run: level 3 (or o.level), round 1 of a best of five, one Undo each side.
  function newGame(seed, o) {
    o = opts(o);
    var s = { v: 1, seed: seed >>> 0, diff: o.diff, misere: o.misere, level: o.level, round: 1,
              score: { you: 0, cpu: 0 }, power: { you: Power.stock(POWERS, { undo: 1 }), cpu: Power.stock(POWERS, { undo: 1 }) },
              used: 0, cpuUsed: 0, ply: 0, matchOver: null, runOver: false, wonMatches: 0 };
    freshRound(s);
    return s;
  }
  // After a round ends (and the match goes on): deal the next round.
  function nextRound(s0) {
    if (!s0.roundOver || s0.matchOver) return s0;
    var s = clone(s0); s.round++; s.ply++; freshRound(s); return s;
  }
  // After a match the player won: one more tile (cap 9), the player keeps the stock, the computer starts over.
  function nextMatch(s0) {
    if (s0.matchOver !== "you") return s0;
    var s = clone(s0);
    s.level = Math.min(MAX_TILES, s.level + 1); s.round = 1; s.score = { you: 0, cpu: 0 };
    s.power.cpu = Power.stock(POWERS, { undo: 1 }); s.cpuUsed = 0; s.matchOver = null; s.ply++;
    freshRound(s); return s;
  }

  function snapshot(s) { var c = clone(s); c.prev = null; return c; }
  function endTurn(s, kind) {
    s.lastTurn = { who: s.turn, kind: kind };
    s.turn = other(s.turn); s.added = false; s.ply++;
    if (s.turn === "you") s.acted = false;
  }
  function finishRound(s, taker) {
    var winner = s.misere ? other(taker) : taker;
    s.roundOver = winner; s.score[winner]++;
    // Winning a round earns one power-up, unless the winner used Add, Pass or Peek in it (R2: a power-up never earns
    // one). The computer earns too, on Hard only (it only plays them on Hard). s.noAward says why nothing paid:
    // "power" (Add, Pass or Peek used), "undo" (you used Undo this round, S9) or "full" (every slot at the cap, R15).
    s.award = null; s.noAward = null;
    if (winner === "you" || s.diff === "hard") {
      if (s.powered && s.powered[winner]) s.noAward = "power";
      else if (winner === "you" && s.undone) s.noAward = "undo";
      else {
        var name = Power.award(s.power[winner], winner === "you" ? POWERS : CPU_POWERS, rnd(s));
        if (name) s.award = { who: winner, name: name }; else s.noAward = "full";
      }
    }
    if (s.score[winner] >= WIN_ROUNDS) {
      s.matchOver = winner;
      if (winner === "you") s.wonMatches++; else s.runOver = true;
    }
  }
  function live(s) { return !s.roundOver && !s.matchOver; }
  function markPowered(s, who) {
    if (!s.powered) s.powered = { you: false, cpu: false };
    if (!s.passed) s.passed = { you: false, cpu: false };
    s.powered[who] = true;
  }
  // R12: has this match seen a move? Then quitting it (New game, a level or mode switch) counts as a loss.
  function started(s) { return !s.matchOver && (s.round > 1 || !!s.roundOver || !!s.lastTurn || !!s.added); }

  // The side to move lowers tile i by `amount` (1 up to its value). Illegal input returns {ok:false}.
  function take(s0, tile, amount) {
    if (!live(s0)) return { ok: false, state: s0 };
    var v = s0.heaps[tile];
    if (!Number.isInteger(tile) || !Number.isInteger(amount) || v === undefined || amount < 1 || amount > v) return { ok: false, state: s0 };
    var s = clone(s0);
    if (s.turn === "you" && !s.acted) { s.prev = snapshot(s0); s.acted = true; }
    s.heaps[tile] = v - amount;
    s.last = { who: s.turn, kind: "take", tile: tile, from: v, to: v - amount, added: s.added };
    if (s.added && s.addAt) s.last.addAt = s.addAt; // which tile the Add raised, for the hint line
    var taker = s.turn;
    endTurn(s, "take");
    if (total(s.heaps) === 0) finishRound(s, taker);
    return { ok: true, state: s };
  }

  // Pass: once per round per side, never straight back after the other side passed, and needs a charge.
  function canPass(s) {
    return live(s) && !(s.passed && s.passed[s.turn]) && !(s.lastTurn && s.lastTurn.kind === "pass") && (s.power[s.turn].pass || 0) > 0;
  }
  function canAdd(s, tile) {
    var v = s.heaps[tile];
    return live(s) && !s.added && (s.power[s.turn].add || 0) > 0 && Number.isInteger(v) && v >= 1 && v < MAX;
  }
  // Undo is for taking back a mistake inside a round: it never crosses a decided result (round or match, won
  // or lost), so a loss stays a loss and a won round's award can never be rewound and re-earned.
  function canUndo(s) { return !!s.prev && (s.power.you.undo || 0) > 0 && live(s); }

  // Power-ups for the side to move (the player calls this with s.turn === "you"; undo is the player's only).
  //   undo        restores the start of the player's last turn, stock included (no farming); spent Peeks stay spent;
  //               the round no longer pays you (s.undone, S9)
  //   add, tile   +1 to one live tile, never past 9; once per turn; you still take after it
  //   pass        skip this turn; once per round per side, and not right after the other side passed
  //   peek        spends a charge and returns one winning move in .move (null when there is none); the round no longer pays
  function use(s0, name, tile) {
    var fail = { ok: false, state: s0 };
    if (name === "undo") {
      if (!canUndo(s0)) return fail;
      var u = clone(s0.prev); u.power.you.undo--; u.used = s0.used + 1; u.ply = s0.ply + 1;
      // Peek is information: a spent Peek stays spent after Undo, so Peek + Undo never shows a move for free.
      u.power.you.peek = Math.min(u.power.you.peek, s0.power.you.peek);
      // ...and a round with a Peek in it stays unpaid (R2): Undo never clears what the Peek showed
      if (s0.peeked && s0.peeked.you) { markPowered(u, "you"); u.peeked = u.peeked || { you: false, cpu: false }; u.peeked.you = true; }
      u.undone = true; // R2 (S9): a round won after an Undo pays nothing, in all three round games
      return { ok: true, state: u };
    }
    if (!live(s0)) return fail;
    var who = s0.turn, s;
    if (name === "add") {
      if (!canAdd(s0, tile)) return fail;
      s = clone(s0);
      if (who === "you" && !s.acted) { s.prev = snapshot(s0); s.acted = true; }
      Power.spend(s.power[who], "add"); s.heaps[tile]++; s.added = true; s.addAt = { tile: tile, from: s0.heaps[tile] }; s.ply++; markPowered(s, who);
      s.last = { who: who, kind: "add", tile: tile, from: s0.heaps[tile], to: s.heaps[tile] };
      if (who === "you") s.used++; else s.cpuUsed++;
      return { ok: true, state: s };
    }
    if (name === "pass") {
      if (!canPass(s0)) return fail;
      s = clone(s0);
      if (who === "you" && !s.acted) { s.prev = snapshot(s0); s.acted = true; }
      Power.spend(s.power[who], "pass"); markPowered(s, who); s.passed[who] = true;
      if (who === "you") s.used++; else s.cpuUsed++;
      s.last = { who: who, kind: "pass" };
      endTurn(s, "pass");
      return { ok: true, state: s };
    }
    if (name === "peek") {
      if (!(s0.power[who].peek > 0)) return fail;
      s = clone(s0); Power.spend(s.power[who], "peek"); s.ply++; markPowered(s, who);
      if (!s.peeked) s.peeked = { you: false, cpu: false };
      s.peeked[who] = true;
      if (who === "you") s.used++; else s.cpuUsed++;
      return { ok: true, state: s, move: peek(s.heaps, s.misere) };
    }
    return fail;
  }

  // ---- the computer ----
  // S11: Medium plays the winning reply but slips MEDIUM_SLIP of the time at any tile count; a lone last tile is always
  // taken; Hard never slips. Perfect play still wins every Easy and Medium match. Table: docs/DESIGN.md, Nine.
  var MEDIUM_SLIP = 0.25;
  function randomMove(s) { return pickIn(s, legalMoves(s.heaps)); }
  function liveCount(h) { return h.filter(Boolean).length; }
  // Decide the computer's move on s (mutates s.seed only). Returns {tile, to}.
  function chooseMove(s) {
    var h = s.heaps, best = peek(h, s.misere), n = liveCount(h);
    if (s.diff === "easy") return randomMove(s);
    if (s.diff === "medium") {
      if (best && (n === 1 || rnd(s) >= MEDIUM_SLIP)) return best;
      return randomMove(s);
    }
    if (best) return pickIn(s, winningMoves(h, s.misere));
    // Hard, losing: stall with the smallest take so a slip by the player can still be punished.
    var live1 = []; h.forEach(function (v, i) { if (v) live1.push(i); });
    var t = pickIn(s, live1); return { tile: t, to: h[t] - 1 };
  }
  // The computer's whole turn. Hard turns a lost position around with Pass or Add when it holds one (and, like
  // the player, earns nothing for a round won that way).
  function cpuTurn(s0) {
    if (!live(s0) || s0.turn !== "cpu") return s0;
    var s = clone(s0), r;
    if (s.diff === "hard" && !winning(s.heaps, s.misere)) {
      if (canPass(s)) { r = use(s, "pass"); if (r.ok) return r.state; }
      if (s.power.cpu.add > 0 && !s.added) {
        var adds = [];
        s.heaps.forEach(function (v, i) { if (canAdd(s, i)) { var h = s.heaps.slice(); h[i]++; if (winning(h, s.misere)) adds.push(i); } });
        if (adds.length) s = use(s, "add", pickIn(s, adds)).state;
      }
    }
    var m = chooseMove(s);
    return take(s, m.tile, s.heaps[m.tile] - m.to).state;
  }

  return { POWERS: POWERS, CPU_POWERS: CPU_POWERS, HARD_LOSING: HARD_LOSING, MEDIUM_SLIP: MEDIUM_SLIP, MAX: MAX, MIN_TILES: MIN_TILES, MAX_TILES: MAX_TILES, WIN_ROUNDS: WIN_ROUNDS, DIFFS: DIFFS,
           nimSum: nimSum, winning: winning, legalMoves: legalMoves, winningMoves: winningMoves, peek: peek,
           newGame: newGame, nextRound: nextRound, nextMatch: nextMatch, take: take, use: use,
           canPass: canPass, canAdd: canAdd, canUndo: canUndo, started: started, chooseMove: chooseMove, cpuTurn: cpuTurn };
});
