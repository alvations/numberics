/* SPDX-License-Identifier: Apache-2.0 | Copyright 2026 alvations (Melon Lab)
 *
 * Numberics Five: the pure game engine. No DOM, no storage, no clock.
 * Each side owns two number tiles (tiles[0..1] are yours at the bottom, tiles[2..3] the computer's at the top),
 * all starting at 1; 0 means the tile has burst. A turn adds one of your live tiles onto any other live tile
 * (the computer's, or your own other one). A tile that reaches 5 or more bursts. The last side with a live tile
 * wins the round; a match is best of five rounds.
 *
 * The game is SOLVED here by retrograde analysis over every position (see solve()). Result, measured by
 * tests/test-five.js: the side that moves first from 1 1 1 1 loses against perfect play, in 8 turns. So the
 * computer opens every round and you always hold the winning seat; alternating the opener would hand the
 * computer the winning seat in half the rounds, which is not fair, so the opener never alternates.
 * Without power-ups every move makes a tile bigger or bursts it, so play cannot cycle and there are no draws.
 * Split and Nudge can undo progress, so a safety draw rule exists (same position 3 times, or 40 turns without
 * a burst); it can only ever trigger in power-up play.
 *
 * All randomness comes from state.seed (mulberry32), so a match is a pure function of its seed and inputs.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("../shared/power.js"));
  else root.NumbericsFive = factory(root.NumbericsPower);
})(typeof self !== "undefined" ? self : this, function (Power) {
  "use strict";

  var BURST = 5, ROUNDS_TO_WIN = 3, REPEAT_DRAW = 3, QUIET_DRAW = 40;
  var POWERS = ["undo", "split", "shield", "nudge"];
  var CPU_POWERS = ["split", "shield", "nudge"]; // the computer never rewinds, so it is never handed an Undo
  var LEVELS = ["easy", "medium", "hard"];
  var OWN = { p: [0, 1], c: [2, 3] };
  var OTHER = { p: "c", c: "p" };

  function rand(seed) {
    var a = (seed + 0x6d2b79f5) >>> 0, t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return [((t ^ (t >>> 14)) >>> 0) / 4294967296, a];
  }
  function side(i) { return i < 2 ? "p" : "c"; }
  function live(s, who) { return OWN[who].filter(function (i) { return s.tiles[i] > 0; }); }

  // ---- the solve: retrograde analysis over every position, seen from the side to move ----
  // index = a*125 + b*25 + c*5 + d, where (a, b) are the mover's tiles and (c, d) the other side's (0 = burst).
  var TABLE = null;
  function pidx(a, b, c, d) { return a * 125 + b * 25 + c * 5 + d; }
  function rawMoves(t) { // t = [a, b, c, d] from the mover's view; returns the resulting [a, b, c, d]
    var out = [];
    for (var i = 0; i < 2; i++) {
      if (!t[i]) continue;
      for (var j = 0; j < 4; j++) {
        if (j === i || !t[j]) continue;
        var n = t.slice(); n[j] += t[i]; if (n[j] >= BURST) n[j] = 0; out.push(n);
      }
    }
    return out;
  }
  function solve() {
    if (TABLE) return TABLE;
    var N = 625, label = new Int8Array(N), dist = new Int16Array(N), left = new Int16Array(N), preds = [], q = [];
    var k, a, b, c, d;
    for (k = 0; k < N; k++) preds.push([]);
    for (a = 0; a < 5; a++) for (b = 0; b < 5; b++) for (c = 0; c < 5; c++) for (d = 0; d < 5; d++) {
      k = pidx(a, b, c, d);
      if (!a && !b) { label[k] = -1; q.push(k); continue; }   // mover has nothing left: the other side just won
      if (!c && !d) { label[k] = 2; continue; }                // unreachable (the game ended a turn ago)
      var ms = rawMoves([a, b, c, d]); left[k] = ms.length;
      ms.forEach(function (n) { preds[pidx(n[2], n[3], n[0], n[1])].push(k); });
    }
    // propagate: a child that is lost for its mover makes the parent a win; a parent whose children are all wins
    // for their movers is a loss. Unlabelled at the end = draw (there are none without power-ups).
    for (var h = 0; h < q.length; h++) {
      var ch = q[h];
      preds[ch].forEach(function (p) {
        if (label[p]) return;
        if (label[ch] === -1) { label[p] = 1; dist[p] = dist[ch] + 1; q.push(p); }
        else if (--left[p] === 0) { label[p] = -1; dist[p] = dist[ch] + 1; q.push(p); }
      });
    }
    // distances (turns to the end): a win takes the fastest finish, a loss the longest defence.
    // Labels came from the propagation above; the distance pass recurses over the (acyclic) normal-move graph.
    var done = new Int8Array(N);
    function depth(x) {
      if (done[x] || label[x] === 2) return dist[x];
      var t = [Math.floor(x / 125), Math.floor(x / 25) % 5, Math.floor(x / 5) % 5, x % 5], best = label[x] === 1 ? 1e9 : 0;
      done[x] = 1; dist[x] = 0;
      rawMoves(t).forEach(function (n) {
        var y = pidx(n[2], n[3], n[0], n[1]), dy = depth(y) + 1;
        if (label[x] === 1) { if (label[y] === -1 && dy < best) best = dy; } else if (label[x] === -1 && dy > best) best = dy;
      });
      if (label[x] === 0) best = 0;
      dist[x] = best; return best;
    }
    for (k = 0; k < N; k++) depth(k);
    var counts = { win: 0, lose: 0, draw: 0 };
    for (a = 0; a < 5; a++) for (b = 0; b < 5; b++) for (c = 0; c < 5; c++) for (d = 0; d < 5; d++) {
      if ((!a && !b) || (!c && !d)) continue;
      k = pidx(a, b, c, d);
      counts[label[k] === 1 ? "win" : label[k] === -1 ? "lose" : "draw"]++;
    }
    TABLE = { label: label, dist: dist, counts: counts };
    return TABLE;
  }
  // label for the side `who` to move, given tiles in board order
  function lookup(tiles, who) {
    var T = solve(), t = who === "p" ? [tiles[0], tiles[1], tiles[2], tiles[3]] : [tiles[2], tiles[3], tiles[0], tiles[1]];
    var k = pidx(t[0], t[1], t[2], t[3]), l = T.label[k];
    return { result: l === 1 ? "win" : l === -1 ? "lose" : "draw", dist: T.dist[k] };
  }
  function reachable() { // positions reachable from the start with normal moves (both seats)
    var seen = {}, st = [[1, 1, 1, 1]], n = 0;
    while (st.length) {
      var t = st.pop(), k = t.join("");
      if (seen[k]) continue; seen[k] = 1;
      if (!t[0] && !t[1]) continue;
      n++;
      rawMoves(t).forEach(function (m) { st.push([m[2], m[3], m[0], m[1]]); });
    }
    return n;
  }

  // ---- state ----
  function freshPower(who) { return who === "p" ? Power.stock(POWERS, { undo: 1 }) : Power.stock(POWERS, {}); }
  function newMatch(seed, level) {
    var s = {
      seed: seed >>> 0, level: LEVELS.indexOf(level) >= 0 ? level : "medium",
      tiles: [1, 1, 1, 1], turn: "c", starter: "c", round: 1, wins: { p: 0, c: 0 }, draws: 0,
      power: { p: freshPower("p"), c: freshPower("c") }, shield: null, quiet: 0, seen: {},
      roundOver: null, matchOver: null, prev: null, midTurn: false, moves: 0, last: null,
    };
    s.seen[key(s)] = 1;
    return s;
  }
  function clone(s) { return JSON.parse(JSON.stringify(s)); }
  function snap(s) { var c = clone(s); c.prev = null; return c; }
  function key(s) { return s.tiles.join("") + s.turn; }
  function nextRound(state) {
    if (!state.roundOver || state.matchOver) return state;
    var s = clone(state);
    s.tiles = [1, 1, 1, 1]; s.turn = s.starter; s.round++; s.shield = null; s.quiet = 0; s.seen = {};
    s.roundOver = null; s.prev = null; s.midTurn = false; s.last = null; s.moves++;
    s.seen[key(s)] = 1;
    return s;
  }

  // ---- moves ----
  function shielded(s, who, j) { return !!(s.shield && s.shield.idx === j && s.shield.side !== who); }
  function movesFor(s, who) {
    var out = [];
    OWN[who].forEach(function (i) {
      if (!s.tiles[i]) return;
      for (var j = 0; j < 4; j++) if (j !== i && s.tiles[j] && !shielded(s, who, j)) out.push({ from: i, to: j });
    });
    return out;
  }
  function legalMoves(s) { return s.roundOver ? [] : movesFor(s, s.turn); }
  function mustPass(s) { return !s.roundOver && legalMoves(s).length === 0; }

  // end of a turn: clear the shield that guarded against this side, switch, check the round
  function endTurn(s, who, burst) {
    if (s.shield && s.shield.side !== who) s.shield = null;
    s.midTurn = false; s.moves++;
    var opp = OTHER[who];
    if (!live(s, opp).length) return finishRound(s, who);
    if (!live(s, who).length) return finishRound(s, opp);
    s.turn = opp;
    if (burst) { s.quiet = 0; s.seen = {}; } else s.quiet++;
    var k = key(s); s.seen[k] = (s.seen[k] || 0) + 1;
    if (s.seen[k] >= REPEAT_DRAW || s.quiet >= QUIET_DRAW) finishRound(s, "draw");
  }
  function finishRound(s, winner) {
    s.roundOver = winner; s.shield = null;
    if (winner === "draw") s.draws++; else s.wins[winner]++;
    if (s.wins.p >= ROUNDS_TO_WIN) s.matchOver = "p"; else if (s.wins.c >= ROUNDS_TO_WIN) s.matchOver = "c";
  }
  function earns(s, who) { return who === "p" || s.level === "hard"; }
  function award(s, who) {
    var r = rand(s.seed); s.seed = r[1];
    return Power.award(s.power[who], who === "p" ? POWERS : CPU_POWERS, r[0]);
  }
  function fail(state, why) { return { ok: false, state: state, why: why }; }

  // play(s, from, to): the side to move adds tile `from` onto tile `to`
  function play(state, from, to) {
    if (state.roundOver) return fail(state, "over");
    var who = state.turn, ok = legalMoves(state).some(function (m) { return m.from === from && m.to === to; });
    if (!ok) return fail(state, "illegal");
    var s = clone(state);
    if (who === "p" && !s.midTurn) s.prev = snap(state);
    var v = s.tiles[to] + s.tiles[from], burst = v >= BURST, awarded = null;
    s.tiles[to] = burst ? 0 : v;
    if (burst && side(to) !== who && earns(s, who)) awarded = award(s, who);
    s.last = { kind: "add", side: who, from: from, to: to, burst: burst, value: v };
    endTurn(s, who, burst);
    return { ok: true, state: s, burst: burst, awarded: awarded };
  }
  // no legal move (every target is shielded): the turn passes
  function pass(state) {
    if (!mustPass(state)) return fail(state, "has moves");
    var s = clone(state), who = s.turn;
    if (who === "p" && !s.midTurn) s.prev = snap(state);
    s.last = { kind: "pass", side: who };
    endTurn(s, who, false);
    return { ok: true, state: s };
  }

  // ---- power-ups (section 0a). Split and Nudge ARE the turn; Shield goes with the turn (then you still move);
  // Undo (yours only) takes back your last turn and the computer's reply. A power-up never earns one.
  function canUse(s, name, arg, dir) {
    var who = s.turn;
    if (name === "undo") return !!s.prev && s.power.p.undo > 0 && s.roundOver !== "p";
    if (s.roundOver || !s.power[who][name]) return false;
    var mine = OWN[who];
    if (name === "split") {
      if (mine.indexOf(arg) < 0 || !s.tiles[arg]) return false;
      var other = mine[0] === arg ? mine[1] : mine[0];
      if (s.tiles[other] >= BURST - 1) return false;
      return !(s.tiles[arg] - 1 === s.tiles[other]); // 3,2 -> 2,3 would change nothing
    }
    if (name === "shield") return !s.midTurn && mine.indexOf(arg) >= 0 && s.tiles[arg] > 0;
    if (name === "nudge") {
      if (arg < 0 || arg > 3 || !s.tiles[arg] || shielded(s, who, arg)) return false;
      if (dir !== 1 && dir !== -1) return false;
      return !(dir === -1 && s.tiles[arg] === 1);
    }
    return false;
  }
  // natural Nudge direction for a tap: the other side's tile goes up, your own goes down (a 1 can only go up)
  function nudgeDir(s, idx) { return side(idx) !== s.turn || s.tiles[idx] === 1 ? 1 : -1; }
  function use(state, name, arg, dir) {
    if (name === "nudge" && dir === undefined && arg >= 0 && arg < 4) dir = nudgeDir(state, arg);
    if (!canUse(state, name, arg, dir)) return fail(state, "cannot");
    var who = name === "undo" ? "p" : state.turn;
    if (name === "undo") {
      var u = clone(state.prev);
      u.power.p.undo = Math.max(0, u.power.p.undo - 1); u.prev = null; u.moves = state.moves + 1;
      u.last = { kind: "undo", side: "p" };
      return { ok: true, state: u };
    }
    var s = clone(state);
    if (who === "p" && !s.midTurn) s.prev = snap(state);
    Power.spend(s.power[who], name);
    if (name === "shield") {
      s.shield = { side: who, idx: arg }; s.midTurn = true; s.moves++;
      s.last = { kind: "shield", side: who, to: arg };
      return { ok: true, state: s };
    }
    var burst = false;
    if (name === "split") {
      var mine = OWN[who], other = mine[0] === arg ? mine[1] : mine[0];
      s.tiles[arg]--; s.tiles[other]++;
      s.last = { kind: "split", side: who, from: arg, to: other };
    } else {
      var v = s.tiles[arg] + dir; burst = v >= BURST;
      s.tiles[arg] = burst ? 0 : v;
      s.last = { kind: "nudge", side: who, to: arg, dir: dir, burst: burst };
    }
    endTurn(s, who, burst);
    return { ok: true, state: s, burst: burst };
  }

  // ---- the computer ----
  function randomPick(s, list) { var r = rand(s.seed); s.seed = r[1]; return list[Math.floor(r[0] * list.length)]; }
  function after(s, m) { var t = s.tiles.slice(), v = t[m.to] + t[m.from]; t[m.to] = v >= BURST ? 0 : v; return t; }
  function deadSide(t, who) { return OWN[who].every(function (i) { return !t[i]; }); }
  function winsNow(t, who) { // can `who` (to move on tiles t, no shield) end the round at once?
    var s = { tiles: t, shield: null };
    return movesFor(s, who).some(function (m) { return deadSide(after(s, m), OTHER[who]); });
  }
  // Easy: a random legal move that does not let the other side win straight away (if one exists)
  function easyMove(s, who) {
    var ms = movesFor(s, who), opp = OTHER[who];
    var safe = ms.filter(function (m) { var t = after(s, m); return deadSide(t, opp) || !winsNow(t, opp); });
    return { list: safe.length ? safe : ms };
  }
  // Medium: 3 turns ahead (negamax), a simple count of live points at the horizon
  function heur(t, who) {
    var opp = OTHER[who], sc = 0;
    OWN[who].forEach(function (i) { if (t[i]) sc += 10; });
    OWN[opp].forEach(function (i) { if (t[i]) sc -= 10; });
    return sc;
  }
  function nega(t, who, depth, sh) {
    var s = { tiles: t, shield: sh }, ms = movesFor(s, who), best = -Infinity;
    if (!ms.length) return depth ? -nega(t, OTHER[who], depth - 1, null) : heur(t, who);
    for (var i = 0; i < ms.length; i++) {
      var n = after(s, ms[i]), v;
      if (deadSide(n, OTHER[who])) v = 1000 + depth;
      else v = depth ? -nega(n, OTHER[who], depth - 1, null) : heur(n, who);
      if (v > best) best = v;
    }
    return best;
  }
  function mediumMove(s, who) {
    var ms = movesFor(s, who), best = -Infinity, out = [];
    ms.forEach(function (m) {
      var n = after(s, m);
      var v = deadSide(n, OTHER[who]) ? 2000 : -nega(n, OTHER[who], 2, null);
      if (v > best) { best = v; out = [m]; } else if (v === best) out.push(m);
    });
    return { list: out };
  }
  // value of tiles t with `who` to move next, for `me`, from the table: higher is better for me
  function tval(t, toMove, me) {
    if (deadSide(t, OTHER[me])) return 1000;
    if (deadSide(t, me)) return -1000;
    var l = lookup(t, toMove), v = l.result === "win" ? 1000 - l.dist : l.result === "lose" ? -1000 + l.dist : 0;
    return toMove === me ? v : -v;
  }
  // value after `me` finishes a turn on tiles t, with an optional shield of mine guarding against the reply
  function afterTurn(t, me, sh) {
    if (deadSide(t, OTHER[me])) return 1000;
    if (!sh) return tval(t, OTHER[me], me);
    var opp = OTHER[me], s = { tiles: t, shield: sh }, ms = movesFor(s, opp);
    if (!ms.length) return tval(t, me, me) - 1; // the reply must pass
    var worst = Infinity;
    ms.forEach(function (m) { worst = Math.min(worst, tval(after(s, m), me, me)); });
    return worst;
  }
  // Hard: perfect play from the solved table; spends a power-up only when it turns the result around
  function hardPlan(s, who) {
    var opts = [], st = s.power[who];
    movesFor(s, who).forEach(function (m) { opts.push({ v: afterTurn(after(s, m), who, null), plan: [{ type: "move", from: m.from, to: m.to }], cost: 0 }); });
    if (earns(s, who)) {
      OWN[who].forEach(function (i) {
        if (st.split && canUse(s, "split", i)) {
          var t = s.tiles.slice(), o = OWN[who][0] === i ? OWN[who][1] : OWN[who][0]; t[i]--; t[o]++;
          opts.push({ v: afterTurn(t, who, null), plan: [{ type: "power", name: "split", arg: i }], cost: 1 });
        }
        if (st.shield && canUse(s, "shield", i)) {
          var sh = { side: who, idx: i };
          movesFor(s, who).forEach(function (m) {
            opts.push({ v: afterTurn(after(s, m), who, sh), plan: [{ type: "power", name: "shield", arg: i }, { type: "move", from: m.from, to: m.to }], cost: 1 });
          });
        }
      });
      if (st.nudge) for (var j = 0; j < 4; j++) [1, -1].forEach(function (d) {
        if (!canUse(s, "nudge", j, d)) return;
        var t = s.tiles.slice(), v = t[j] + d; t[j] = v >= BURST ? 0 : v;
        opts.push({ v: afterTurn(t, who, null), plan: [{ type: "power", name: "nudge", arg: j, dir: d }], cost: 1 });
      });
    }
    if (!movesFor(s, who).length) opts.push({ v: tval(s.tiles, OTHER[who], who), plan: [{ type: "pass" }], cost: 0 });
    var cat = function (v) { return v > 0 ? 1 : v < 0 ? -1 : 0; };
    var bestFree = -Infinity; opts.forEach(function (o) { if (!o.cost) bestFree = Math.max(bestFree, o.v); });
    var pool = opts.filter(function (o) { return !o.cost || cat(o.v) > cat(bestFree); });
    var top = -Infinity; pool.forEach(function (o) { top = Math.max(top, o.v); });
    pool = pool.filter(function (o) { return o.v === top; });
    var free = pool.filter(function (o) { return !o.cost; });
    return randomPick(s, free.length ? free : pool).plan;
  }
  // aiPlan(s): the actions the side to move takes this turn, as [{type:"move",from,to} | {type:"power",...} | {type:"pass"}].
  // It reads the seed but returns plans only; apply them with apply(). `level` overrides s.level (for bots).
  function aiPlan(state, level) {
    var s = clone(state), who = s.turn; level = level || s.level;
    if (s.roundOver) return { plan: [], seed: s.seed };
    if (level === "hard") { var p = hardPlan(s, who); return { plan: p, seed: s.seed }; }
    if (!movesFor(s, who).length) return { plan: [{ type: "pass" }], seed: s.seed };
    var pick = level === "random" ? { list: movesFor(s, who) } : level === "easy" ? easyMove(s, who) : mediumMove(s, who);
    var m = randomPick(s, pick.list);
    return { plan: [{ type: "move", from: m.from, to: m.to }], seed: s.seed };
  }
  function apply(state, a) {
    if (a.type === "move") return play(state, a.from, a.to);
    if (a.type === "pass") return pass(state);
    return use(state, a.name, a.arg, a.dir);
  }
  // one whole computer (or bot) turn
  function aiTurn(state, level) {
    var r = aiPlan(state, level), s = clone(state); s.seed = r.seed;
    var steps = [];
    for (var i = 0; i < r.plan.length; i++) {
      var res = apply(s, r.plan[i]); if (!res.ok) break;
      s = res.state; steps.push({ action: r.plan[i], state: s, awarded: res.awarded || null, burst: !!res.burst });
    }
    return { state: s, steps: steps };
  }

  return {
    BURST: BURST, POWERS: POWERS, CPU_POWERS: CPU_POWERS, LEVELS: LEVELS, ROUNDS_TO_WIN: ROUNDS_TO_WIN,
    REPEAT_DRAW: REPEAT_DRAW, QUIET_DRAW: QUIET_DRAW,
    solve: solve, lookup: lookup, reachable: reachable,
    newMatch: newMatch, nextRound: nextRound, legalMoves: legalMoves, mustPass: mustPass, play: play, pass: pass,
    canUse: canUse, use: use, nudgeDir: nudgeDir, aiPlan: aiPlan, aiTurn: aiTurn, apply: apply, key: key, side: side,
  };
});
