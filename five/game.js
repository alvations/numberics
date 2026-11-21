/* SPDX-License-Identifier: Apache-2.0 | Copyright 2026 alvations (Melon Lab)
 * Numberics Five: browser client. The engine (engine.js) owns every rule and the computer's play;
 * this file only draws, listens, animates and remembers. */
(function () {
  "use strict";
  var N = window.NumbericsFive, K = window.NumbericsKit, P = window.NumbericsPower;
  var M = window.NumbericsMotion, A = window.NumbericsAudio, TR = window.NumbericsTrophies, NP = window.NumbericsProgress;
  var store = K.store("numberics_five_v1");
  // Motion (REDESIGN.md 5.6) reads M.reduced() / M.ms() at the time of each animation (never cached at load).
  // THINK and HOLD are pauses, not motion: they keep their length under reduced motion (5.12).
  var THINK = 520, HOLD = 1500; // R13: the result shows before the card
  var OUT_MS = 200, OUTLINE_MS = 160; // 5.6: the burst tile scales out over 200 ms, then the empty outline fades in

  function validState(s) {
    return s && Array.isArray(s.tiles) && s.tiles.length === 4 &&
      s.tiles.every(function (v) { return Number.isInteger(v) && v >= 0 && v < N.BURST; }) &&
      (s.turn === "p" || s.turn === "c") && N.LEVELS.indexOf(s.level) >= 0 && s.power && s.power.p && s.power.c &&
      s.wins && typeof s.wins.p === "number" && typeof s.moves === "number" && s.seen && typeof s.seen === "object";
  }
  var saved = store.load();
  var record = (saved && saved.record && typeof saved.record.won === "number") ? saved.record : { won: 0, lost: 0 };
  // the win-loss record per level (REDESIGN.md 8.5: the cards show the current level's record)
  var byLevel = { easy: { won: 0, lost: 0 }, medium: { won: 0, lost: 0 }, hard: { won: 0, lost: 0 } };
  if (saved && saved.byLevel) N.LEVELS.forEach(function (l) {
    var r = saved.byLevel[l]; if (r && typeof r.won === "number" && typeof r.lost === "number") byLevel[l] = { won: r.won, lost: r.lost };
  });
  // a first visit (no saved state) starts on Easy (REDESIGN.md 1.3); a saved choice is always kept
  var level = saved && N.LEVELS.indexOf(saved.level) >= 0 ? saved.level : "easy";
  var state = saved && validState(saved.state) ? saved.state : N.newMatch(K.freshSeed(), level);
  level = state.level;
  // the run record (REDESIGN.md 8.2): how this match went, for the trophies only; it never changes a rule
  var run = saved && saved.run && typeof saved.run.used === "number" ? { used: saved.run.used, down02: saved.run.down02 === true } : { used: 0, down02: false };
  var cardTro = [], troNew = false, firstMove = false; // trophy pills for the end card; the trophy sound is still to play

  var sel = -1, cur = 0, armed = null;   // selected tile, keyboard cursor, armed power-up
  var timer = null, busy = false, counted = !!state.matchOver, levelArm = null;
  var holding = false, viewing = false, keys = false, anim = false; // anim: a move is still being drawn // R13 hold before the card, "See the board", keyboard in use

  var $ = function (id) { return document.getElementById(id); };
  var boardEl = $("board"), fxEl = $("fx");
  var slots = []; Array.prototype.forEach.call(document.querySelectorAll(".slot"), function (el) { slots[+el.getAttribute("data-i")] = el; });

  function lose1(lv) { record.lost++; if (byLevel[lv]) byLevel[lv].lost++; }
  function persist() {
    if (state.matchOver && !counted) {
      counted = true;
      if (state.matchOver === "p") { record.won++; byLevel[state.level].won++; } else lose1(state.level);
    }
    if (!state.matchOver) counted = false;
    if (state.wins.p === 0 && state.wins.c >= 2) run.down02 = true; // the player was 0-2 down at some point (five_back)
    store.save({ state: state, level: level, record: record, byLevel: byLevel, run: run });
    // the card summary (shared/progress.js): the current level's record, and a live match to continue
    if (NP) {
      var r = byLevel[level] || { won: 0, lost: 0 };
      NP.put("five", { best: r.won || r.lost ? "Won " + r.won + ", lost " + r.lost : "",
        live: N.played(state) && !state.matchOver, liveText: "Round " + state.round + ", " + state.wins.p + "-" + state.wins.c });
    }
  }
  // sounds and haptics: called at the visual moment, inside the seq() timeline, so a finish() drops pending sounds
  // instead of bunching them (REDESIGN.md 7.3)
  var hush = false;
  function sfx(name, arg) { if (hush || !A || typeof A[name] !== "function") return; try { A[name](arg); } catch (e) { /* a sound is a nicety */ } }
  function buzz(kind) { if (hush || !A || typeof A.buzz !== "function") return; try { A.buzz(kind); } catch (e) { /* no vibrate */ } }
  function duck(on) { try { if (window.NumbericsMusic) window.NumbericsMusic.duck(on); } catch (e) { /* no music */ } }
  // trophies (REDESIGN.md 8.4): reported quietly when a round ends; the card shows them as pills, with the sound
  function report(ev, data) {
    if (!TR) return [];
    try { return TR.report("five", ev, data, { quiet: true }) || []; } catch (e) { return []; }
  }
  function roundEnded() {
    var l = state.last || {}, won = state.roundOver === "p";
    var burstAt = l.burst ? (l.kind === "nudge" ? l.prevTo + l.dir : l.value) : null;
    cardTro = report("round", { won: won, burstAt: burstAt });
    if (state.matchOver) cardTro = cardTro.concat(report("match", { won: state.matchOver === "p", level: state.level,
      p: state.wins.p, c: state.wins.c, down02: run.down02 === true }));
    troNew = cardTro.length > 0;
    persist();
  }

  var PW_LEVEL = { easy: "Easy", medium: "Medium", hard: "Hard" };
  var PW = { undo: "Undo", split: "Split", shield: "Shield", nudge: "Nudge" };
  var DESC = { undo: "Take back your turn and the computer's reply.", split: "Move one point from your tile onto your other tile.",
    shield: "Your tile cannot be hit on the computer's next turn. You still move.", nudge: "Add 1 to a computer tile or take 1 off yours." };
  var DEFS = N.POWERS.map(function (p) { return { id: p, label: PW[p], desc: DESC[p] }; });
  var EARN = "Burst a computer tile to earn one. Only you have power-ups.";
  var PW_HINT = { split: "Tap the tile to take 1 from.",
    shield: "Tap your tile to shield it, then move.",
    nudge: "Tap a tile: theirs +1, yours -1." };

  function myTurn() { return state.turn === "p" && !state.roundOver && !busy; }
  // why a tray button cannot act right now (a reason string), or false when it can (R5: a tap explains it)
  function whyNot(id) {
    if (!state.power.p[id]) return false; // the tray says how to earn one
    if (state.roundOver) return id === "undo" ? "Not once a round is decided." : "Wait for the next round.";
    if (busy || state.turn !== "p") return "Wait for your turn.";
    if (id === "undo") return N.canUse(state, "undo") ? false : "Nothing to take back yet this round.";
    if (id === "shield" && state.midTurn) return "Shield is already up. Now make your move.";
    return false;
  }

  function tileCls(v) { return "tile v" + v + (v === 1 ? " lo" : v === 2 ? " lo2" : ""); }
  function tileEl(v) {
    var t = document.createElement("div");
    t.className = tileCls(v);
    t.style.setProperty("--h", K.hue(v)); t.textContent = v;
    return t;
  }
  // each slot keeps its tile element (identity is the slot: tiles never move in Five), so a pop or a raised
  // selection that is still playing is never cut by the next redraw ("no blipping", REDESIGN.md 5.1)
  function paintTile(el, v) {
    var t = el.firstElementChild;
    if (!v) { if (t) el.removeChild(t); return; }
    if (!t) { t = tileEl(v); el.appendChild(t); return; }
    var c = tileCls(v); if (t.className !== c) t.className = c;
    var h = String(K.hue(v)); if (t.style.getPropertyValue("--h") !== h) t.style.setProperty("--h", h);
    if (t.textContent !== String(v)) t.textContent = v;
  }
  var shown = null; // the tiles on screen while a flight is in the air (the target changes when the copy lands)
  var cardUp = false, trayKey = "";
  function render() {
    var canTargets = {}, tiles = shown || state.tiles;
    if (myTurn() && sel >= 0 && !armed) N.legalMoves(state).forEach(function (m) { if (m.from === sel) canTargets[m.to] = 1; });
    slots.forEach(function (el, i) {
      var v = tiles[i];
      el.className = "slot" + (v ? "" : " dead") + (i === sel ? " sel" : "") + (canTargets[i] ? " can" : "") +
        (i === cur && boardEl.classList.contains("kb") ? " cur" : "") +
        (state.shield && state.shield.idx === i ? " shield" : "") +
        (state.roundOver && state.last && state.last.burst && state.last.to === i ? " hit" : "") +
        (!state.roundOver && !armed && sel < 0 && state.turn === "p" && state.last && state.last.side === "c" && state.last.kind === "add" && state.last.to === i ? " last" : "");
      paintTile(el, v);
      var owner = i < 2 ? "your" : "computer";
      el.setAttribute("aria-label", owner + " tile " + (i % 2 ? "right" : "left") + ": " + (v ? v : "burst"));
    });
    $("you").textContent = state.wins.p; $("cpu").textContent = state.wins.c;
    var none = !record.won && !record.lost; // R16: Record reads a dimmed "none" until a match is decided
    $("matches").textContent = none ? "none" : record.won + "-" + record.lost; $("matches").classList.toggle("none", none);
    // the pips and the tray are rebuilt only when what they show changes (a move redraws several times)
    var pips = $("pips"), R = 2 * N.ROUNDS_TO_WIN - 1, pk = state.wins.p + ":" + state.wins.c;
    if (pips.getAttribute("data-k") !== pk) pips.textContent = "";
    pips.setAttribute("data-k", pk);
    for (var k = pips.children.length; k < R; k++) {
      var d = document.createElement("i");
      if (k < state.wins.p) d.className = "p"; else if (k >= R - state.wins.c) d.className = "c";
      pips.appendChild(d);
    }
    pips.setAttribute("aria-label", "Rounds: you " + state.wins.p + ", computer " + state.wins.c + ", first to 3");
    Array.prototype.forEach.call($("levels").children, function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-level") === level)); });
    var tk = JSON.stringify([state.power.p, armed, DEFS.map(function (d) { return whyNot(d.id); })]);
    if (tk !== trayKey) {
      trayKey = tk;
      P.tray($("tray"), DEFS, state.power.p, {
        armed: armed, earn: EARN, onUse: activate, disabled: whyNot,
        onInfo: function (id, text) { $("hint").textContent = text; },
      });
    }
    boardEl.classList.toggle("targeting", !!armed);
    var hint = "";
    if (armed) hint = PW_HINT[armed] + (keys ? " (Esc cancels)" : "");
    else if (levelArm) hint = "Tap " + PW_LEVEL[levelArm] + " again: it counts as a loss.";
    else if (state.roundOver) hint = viewing ? "Tap the board for the summary." : holding || anim ? (state.roundOver === "draw" ? "Drawn: " + drawWhy() + "." : lastWords()) : "";
    else if (state.turn === "c" || busy) hint = "The computer is thinking\u2026";
    else if (N.mustPass(state)) hint = "Nothing to hit: tap your tile to pass.";
    else if (sel >= 0) hint = "Add " + state.tiles[sel] + " onto which tile? Your own other tile counts.";
    else hint = state.midTurn ? "Shield is up. Now make your move." : (itsMove() ? itsMove() + "Tap one of your tiles." : "Your turn: tap one of your tiles.");
    $("hint").textContent = hint;
    var over = $("over"), ttl = $("over-title"), wasHidden = over.hidden;
    over.hidden = !state.roundOver || busy || anim || holding || viewing;
    // one end-card pattern (round 3): while the card shows, the lower New game is hidden and keeps its space
    $("new").style.visibility = over.hidden ? "" : "hidden";
    if (state.roundOver && !busy) {
      // R8: a white one-line headline, one summary line, the gold primary button.
      // Round 3 wording: "You win round N" / "The computer wins round N" / "Draw in round N"; a match reads
      // "You win" / "The computer wins". Sublines are "<detail> · <score>".
      var m = state.matchOver, rw = state.roundOver, n = " round " + state.round;
      ttl.textContent = m ? (m === "p" ? "You win" : "The computer wins")
        : rw === "draw" ? "Draw in" + n : rw === "p" ? "You win" + n : "The computer wins" + n;
      var got = (state.earned || []).map(function (id) { return PW[id]; });
      $("over-text").textContent = m ? (m === "p" ? "Match won " : "Match lost ") + state.wins.p + "-" + state.wins.c + " \u00b7 " + PW_LEVEL[state.level]
        : (rw === "draw" ? cap(drawWhy()) : cardWords()) + " \u00b7 " + ("You " + state.wins.p + " : " + state.wins.c + " Computer").replace(/ /g, "\u00a0") + // the tally never breaks
          (state.draws ? " \u00b7 " + state.draws + "\u00a0drawn" : "") + (got.length ? " \u00b7 earned\u00a0" + got.join(", ") : "");
      $("again").textContent = m ? "New game" : "Next round";
    }
    if (!over.hidden && wasHidden) $("again").focus({ preventScroll: true }); // focus goes to the card's primary button
    if (TR && TR.pills) TR.pills($("over-pills"), state.roundOver ? cardTro : []);
    if (!over.hidden !== cardUp) {
      cardUp = !over.hidden; duck(cardUp); // music steps back while the end card shows
      if (cardUp && troNew) {
        troNew = false; sfx("trophy"); buzz("big");
        try { if (window.NumbericsUI) window.NumbericsUI.dot(true); } catch (e) { /* no top bar */ }
      }
    }
  }
  function cap(t) { return t.charAt(0).toUpperCase() + t.slice(1); }
  function drawWhy() { return state.quiet >= N.QUIET_DRAW ? "40 turns without a burst" : "the same position came up 3 times"; }
  // the computer's last move, said on your turn (cold #23: its move happened before you knew where to look)
  function itsMove() {
    var l = state.last; if (!l || l.side !== "c") return "";
    if (l.kind === "pass") return "It had nothing to hit. ";
    if (l.kind !== "add") return "";
    var whose = N.side(l.to) === "c" ? "its own " : "your ";
    return (l.burst ? "It burst " + whose : "It added " + l.add + " onto " + whose) + l.prevTo + ". ";
  }

  // what ended the round, for the hint line while the board shows (R13), and the card's detail
  function lastWords() { var w = cardWords(); return w ? w + ": burst." : ""; }
  function cardWords() {
    var l = state.last; if (!l || !l.burst) return "";
    var who = l.side === "p" ? "Your" : "Computer's", whose = N.side(l.to) === l.side ? (l.side === "p" ? "your" : "its") : (l.side === "p" ? "their" : "your");
    if (l.kind === "nudge") return "Nudge burst " + whose + " " + l.prevTo;
    if (l.prevTo === undefined) return "";
    return who + " " + l.add + " onto " + whose + " " + l.prevTo + " made " + l.value;
  }
  // R13: after the round-ending move, hold the board (undimmed) for a beat, then show the card
  function hold() {
    holding = true; viewing = false; render();
    var rw = state.roundOver; // the result sound just after the burst (a finish() drops it)
    if (rw !== "draw") seq.at(320, function () { sfx(rw === "p" ? "win" : "lose"); buzz(rw === "p" ? "win" : "lose"); });
    timer = setTimeout(function () { timer = null; holding = false; fxEl.textContent = ""; render(); }, HOLD);
  }
  function showCard() { // skip the hold, or come back from "See the board"
    if (timer !== null && holding) { clearTimeout(timer); timer = null; }
    holding = false; viewing = false; fxEl.textContent = ""; render(); $("again").focus({ preventScroll: true });
  }

  // ---- motion (REDESIGN.md 5.6): a copy of the giving tile flies onto the target along a slight arc; on landing the
  // target's number changes and it pops; at five or more it bursts into shards and its empty outline fades in.
  // Every step is on one generation-guarded timeline (M.seq), so a new input runs it to its end state at once.
  var seq = M.seq();
  var running = []; // pops and outline fades still playing on the board's own nodes
  function keep(a) { if (a) running.push(a); return a; }
  function settle() { // end state now: pending steps run (their sounds dropped), pops and fades jump to their end
    hush = true; try { seq.finish(); } finally { hush = false; }
    running.forEach(function (a) { try { a.finish(); } catch (e) { /* already gone */ } }); running = [];
  }
  function rectIn(el, b) {
    var r = el.getBoundingClientRect();
    return { x: r.left - b.left, y: r.top - b.top, w: r.width, h: r.height };
  }
  function place(el, r) { el.style.left = r.x + "px"; el.style.top = r.y + "px"; el.style.width = r.w + "px"; el.style.height = r.h + "px"; }
  function gone(el, a) { // remove an effect node when its animation ends (at once when nothing animates)
    if (a) a.onfinish = function () { if (el.parentNode) el.parentNode.removeChild(el); };
    else if (el.parentNode) el.parentNode.removeChild(el);
  }
  var POP = [{ transform: "scale(.72)" }, { transform: "scale(1.14)", offset: 0.6 }, { transform: "scale(1)" }];
  function bump(i) {
    var t = slots[i].firstElementChild; if (!t) return;
    keep(M.play(t, POP, { duration: M.T.pop, easing: M.E.pop }, [{ opacity: 0.55 }, { opacity: 1 }]));
  }
  // 8 shards, 6% squares in the tile's hue, out 30 to 45% of the tile, turning 90 to 180 degrees (fixed, not random)
  var SHARD_D = [0.30, 0.42, 0.36, 0.45, 0.33, 0.40, 0.38, 0.31], SHARD_R = [90, 150, 120, 180, 105, 165, 135, 95];
  function shards(r, v) {
    if (M.reduced()) return; // no flying shards under reduced motion (5.12)
    var s = Math.max(4, r.w * 0.06), cx = r.x + r.w / 2 - s / 2, cy = r.y + r.h / 2 - s / 2;
    for (var k = 0; k < 8; k++) {
      var d = document.createElement("i"), ang = (k * 45 + (k % 2 ? 12 : -8)) * Math.PI / 180, dist = SHARD_D[k] * r.w;
      d.className = "shard" + (v === 1 ? " lo" : v === 2 ? " lo2" : ""); d.style.setProperty("--h", K.hue(v));
      d.style.left = cx + "px"; d.style.top = cy + "px"; d.style.width = s + "px"; d.style.height = s + "px";
      fxEl.appendChild(d);
      gone(d, M.play(d, [{ transform: "translate(0px,0px) rotate(0deg)", opacity: 1 },
        { transform: "translate(" + (Math.cos(ang) * dist).toFixed(1) + "px," + (Math.sin(ang) * dist).toFixed(1) + "px) rotate(" + (k % 2 ? -SHARD_R[k] : SHARD_R[k]) + "deg)", opacity: 0 }],
        { duration: M.T.burst, easing: M.E.out, fill: "forwards" }));
    }
  }
  function burstFx(last, prev, to, final) {
    sfx("burst"); buzz("merge");
    if (!to || !to.w) return;
    var hv = Math.min(4, prev[last.to]);
    var g = tileEl(hv); g.classList.add("ghost"); if (final) g.classList.add("final");
    place(g, to); g.textContent = last.kind === "nudge" ? "5" : String(last.value);
    fxEl.appendChild(g);
    // the burst that decides a round stays lit through the whole hold (round 3, craft #2; CSS .ghost.final);
    // any other burst scales 1 -> 1.15 -> 0 and fades over 200 ms
    if (!final) gone(g, M.play(g, [{ transform: "scale(1)", opacity: 1 }, { transform: "scale(1.15)", opacity: 1, offset: 0.35 }, { transform: "scale(0)", opacity: 0 }],
      { duration: OUT_MS, easing: M.E.out, fill: "forwards" }, [{ opacity: 1 }, { opacity: 0 }]));
    shards(to, hv);
    // the empty outline fades in once the tile is gone (opacity: kept under reduced motion)
    keep(M.play(slots[last.to], [{ opacity: 0 }, { opacity: 0, offset: OUT_MS / (OUT_MS + OUTLINE_MS) }, { opacity: 1 }],
      { duration: OUT_MS + OUTLINE_MS, pseudoElement: "::after" }, [{ opacity: 0 }, { opacity: 1 }]));
  }
  function animate(prev, last, done) {
    settle(); fxEl.textContent = ""; // the last move's shards end with it: effect nodes stay bounded
    var kind = last && last.kind;
    if (kind !== "add" && kind !== "nudge" && kind !== "split") { shown = null; busy = false; anim = false; render(); return done(); }
    busy = true; anim = true; // the card never shows mid-animation (it once flashed up under the deciding burst)
    // the burst that decides a round stays lit on the board through the whole hold: the hold starts the moment the
    // tile bursts, and the lit ghost is cleared only when the card shows
    var final = !!(last.burst && state.roundOver);
    var b = boardEl.getBoundingClientRect(), to = rectIn(slots[last.to], b), fly = 0; // one layout read per move (5.13)
    if (kind === "add" && to.w) {
      var from = rectIn(slots[last.from], b), f = tileEl(prev[last.from]);
      fly = M.ms("fly");
      if (fly) {
        // the flying copy reads "+3", not a second "3" over the tile that stays (craft nit: a doubled numeral)
        f.classList.add("fly"); f.textContent = "+" + prev[last.from]; place(f, from); fxEl.appendChild(f);
        var dx = (to.x - from.x).toFixed(1), dy = (to.y - from.y).toFixed(1);
        M.play(f, [{ transform: "translate(0px,0px)" }, { transform: "translate(" + dx + "px," + dy + "px)" }], { duration: fly, easing: M.E.fly, fill: "forwards" });
        // the arc: a lift of 6% and a 1.08 swell at mid-flight, on a second track added to the first
        M.play(f, [{ transform: "translateY(0%) scale(1)" }, { transform: "translateY(-6%) scale(1.08)", offset: 0.5 }, { transform: "translateY(0%) scale(1)" }],
          { duration: fly, easing: "ease-in-out", composite: "add", fill: "forwards" });
        seq.at(fly, function () { gone(f, null); });
      }
    }
    shown = prev.slice(); render();
    seq.at(fly, function () { // the landing: the number changes now
      shown = null; busy = false; anim = false; render();
      if (last.burst) burstFx(last, prev, to, final);
      else {
        bump(last.to); if (kind === "split") bump(last.from);
        sfx("land"); buzz("tap");
      }
      done();
    });
  }
  function flush() { // drop any pending animation or computer timer; the state is already authoritative
    if (timer !== null) { clearTimeout(timer); timer = null; }
    seq.cancel(); shown = null;
    running.forEach(function (a) { try { a.finish(); } catch (e) { /* already gone */ } }); running = [];
    fxEl.textContent = ""; busy = false; anim = false; holding = false; viewing = false;
  }
  // a tap or key while only an animation is pending on your turn lands at once (the state is already yours):
  // the running animation goes to its end state and the input is applied in the same handler (REDESIGN.md 5.11)
  function catchUp() {
    if (busy && state.turn === "p" && !state.roundOver) {
      settle(); if (timer !== null) { clearTimeout(timer); timer = null; }
      fxEl.textContent = ""; busy = false; anim = false; render();
    }
  }

  // commit a new state from an action, animate it, then pass the turn to the computer if needed
  function commit(res, who) {
    var before = state.tiles.slice(), wasOver = !!state.roundOver;
    state = res.state; persist();
    if (who === "p" && !firstMove) { firstMove = true; report("move", {}); } // a game counts as played after its first move
    if (state.roundOver && !wasOver) roundEnded();
    // R7: a reward is a toast; a round result is the overlay alone (no "Burst!" note on the round-ending burst)
    // a reward on the round-ending burst is said on the card ("earned Shield"), never in a toast over the hold's hint
    if (res.awarded && !state.roundOver) K.toast("Burst! +" + PW[res.awarded]);
    else if (res.unpaid && !state.roundOver) K.toast("Burst! No reward after Shield.", "info"); // R2
    else if (res.burst && who === "p" && !state.roundOver) K.toast("Burst!");
    animate(before, state.last, afterTurn);
    if (res.awarded) seq.at(M.ms("fly") + 140, function () { sfx("power"); }); // after the burst it paid for
  }
  function afterTurn() {
    if (state.matchOver === "c") { // no reward toast over a lost match (R7): hide it at once, no fade
      var t = $("toast");
      if (t && t.classList.contains("on")) {
        t.style.transition = "none"; t.classList.remove("on"); void t.offsetWidth; t.style.transition = "";
      }
    }
    if (state.roundOver) return hold();
    if (state.turn === "c") scheduleComputer();
  }
  function scheduleComputer() {
    if (timer !== null || state.turn !== "c" || state.roundOver) return;
    busy = true; render();
    var gen = state.moves, opening = !state.last; // a beat longer on a fresh round, so the start is seen first
    timer = setTimeout(function () {
      timer = null; if (state.moves !== gen || state.turn !== "c") { busy = false; return render(); }
      var r = N.aiPlan(state);
      state = r.state; // the engine's copy with the seed advanced; the plan applies to it
      runPlan(r.plan);
    }, opening ? THINK + 500 : THINK);
  }
  function runPlan(plan) {
    if (!plan.length) { busy = false; return render(); }
    var a = plan[0], res = N.apply(state, a);
    if (!res.ok) { busy = false; return render(); }
    if (a.type === "pass") K.toast("Computer has nothing to hit: it passes");
    var before = state.tiles.slice(), wasOver = !!state.roundOver;
    state = res.state; persist();
    if (state.roundOver && !wasOver) roundEnded();
    animate(before, state.last, function () {
      if (plan.length > 1 && !state.roundOver && state.turn === "c") {
        busy = true; var gen = state.moves;
        timer = setTimeout(function () { timer = null; if (state.moves === gen) runPlan(plan.slice(1)); }, 300);
      } else afterTurn();
    });
  }

  // ---- input ----
  function tap(i) {
    if (state.roundOver && !busy) { if (holding || viewing) showCard(); return; }
    catchUp();
    if (!myTurn()) return;
    var v = state.tiles[i];
    if (armed) {
      var name = armed, res = N.use(state, name, i);
      if (!res.ok) { K.toast("Pick a valid tile", "bad"); sfx("bad"); return; }
      armed = null; sel = -1; run.used++;
      K.toast(PW[name] + "!");
      return commit(res, "p");
    }
    if (N.mustPass(state)) { if (i < 2 && v) { sel = -1; commit(N.pass(state), "p"); } return; }
    if (sel < 0) { if (i < 2 && v) { sel = i; sfx("tick"); render(); } return; }
    if (i === sel) { sel = -1; return render(); }
    var r = N.play(state, sel, i);
    if (!r.ok) { if (state.shield && state.shield.idx === i) { K.toast("That tile is shielded this turn", "bad"); sfx("bad"); } return; }
    sel = -1; commit(r, "p");
  }
  function activate(name) {
    if (name === "undo") {
      if (!N.canUse(state, "undo")) return; // R1: never across a decided round, so a counted match stays counted
      flush(); armed = null; sel = -1; levelArm = null; run.used++; sfx("tick");
      state = N.use(state, "undo").state; persist(); K.toast("Took back your turn"); return render();
    }
    catchUp();
    if (!myTurn()) return;
    if (armed === name) { armed = null; return render(); }
    if (!state.power.p[name] || (name === "shield" && state.midTurn)) return;
    armed = name; sel = -1; sfx("tick"); render();
  }
  window.addEventListener("pointerdown", function () { keys = false; }, true); // "(Esc cancels)" is for keyboard players
  slots.forEach(function (el, i) { el.addEventListener("click", function (e) { e.stopPropagation(); boardEl.classList.remove("kb"); cur = i; tap(i); }); });
  boardEl.addEventListener("click", function (e) { // R13: a tap anywhere on the shown board brings the summary back
    if (state.roundOver && !busy && (holding || viewing) && !(e.target.closest && e.target.closest(".over"))) showCard();
  });
  var GRID = { 0: { up: 2, right: 1 }, 1: { up: 3, left: 0 }, 2: { down: 0, right: 3 }, 3: { down: 1, left: 2 } };
  // a number key behaves exactly like tapping that tray slot (an unusable one explains itself, R5)
  function traySlot(k) { var b = $("tray").querySelectorAll("button")[k]; if (b) b.click(); }
  window.addEventListener("keydown", function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (window.NumbericsUI && window.NumbericsUI.open()) return; // a sheet is open: no key reaches the game
    var tg = e.target && e.target.closest ? e.target : null;
    if (tg && tg.closest("input, select, textarea")) return;
    // R17: Enter or Space on a focused link or button is that control (a games-row link navigates)
    if (tg && tg.closest("a, button") && (e.key === "Enter" || e.key === " ")) return;
    keys = true;
    if (e.key === "Escape") {
      if (state.roundOver && viewing) return showCard();
      armed = null; sel = -1; return render();
    }
    var pi = ["1", "2", "3", "4"].indexOf(e.key);
    if (pi >= 0) return traySlot(pi);
    if (e.key === "u" || e.key === "U") return traySlot(0);
    var d = K.arrowKey(e);
    if (d) {
      e.preventDefault(); boardEl.classList.add("kb");
      var n = GRID[cur][d]; if (n !== undefined) cur = n;
      return render();
    }
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (state.roundOver && !busy) return (holding || viewing) ? showCard() : $("again").click();
      boardEl.classList.add("kb"); tap(cur);
    }
  });

  function startMatch(lv) {
    // R12: quitting a match you have played in counts as a loss
    if (N.played(state)) lose1(state.level);
    flush(); armed = null; sel = -1; level = lv || level; levelArm = null; cardTro = []; troNew = false;
    run = { used: 0, down02: false }; // a new match starts a new run record
    state = N.newMatch(K.freshSeed(), level); persist(); render(); scheduleComputer();
  }
  // R12: "after the first move" means your first move: the computer always opens, which is not you playing
  var inProgress = function () { return N.played(state); };
  K.twoStep($("new"), inProgress, function () { startMatch(); }, "Sure? Counts as a loss");
  var levelT = null;
  function disarmLevels() {
    clearTimeout(levelT); levelT = null; levelArm = null;
    Array.prototype.forEach.call($("levels").children, function (x) { x.textContent = PW_LEVEL[x.getAttribute("data-level")]; });
  }
  Array.prototype.forEach.call($("levels").children, function (b) {
    var lv = b.getAttribute("data-level"), label = PW_LEVEL[lv];
    b.addEventListener("click", function () {
      sfx("tick");
      if (lv === level) return;
      if (inProgress() && levelArm !== lv) {
        disarmLevels(); // only one "Sure?" at a time
        K.clearToast(); levelArm = lv; b.textContent = "Sure?"; render();
        levelT = setTimeout(function () { disarmLevels(); render(); }, 3000); return;
      }
      disarmLevels(); startMatch(lv); K.toast(label + ": new game");
    });
  });
  $("new").addEventListener("click", function () { sfx("tick"); });
  $("over-view").addEventListener("click", function (e) { e.stopPropagation(); sfx("tick"); viewing = true; render(); boardEl.focus({ preventScroll: true }); });
  $("again").addEventListener("click", function () {
    sfx("tick"); flush();
    if (state.matchOver) return startMatch();
    cardTro = []; troNew = false;
    state = N.nextRound(state); armed = null; sel = -1; persist(); render(); scheduleComputer();
  });

  // ---- how to play (REDESIGN.md 1.3, 9.5): three steps, each a small drawn picture and one sentence ----
  function mt(v, bg) { return '<span class="mt" style="background:' + bg + '">' + v + "</span>"; }
  var BLUE = "hsl(205 70% 62%)", GREEN = "hsl(152 60% 58%)";
  var STEPS = [
    ['<div class="eq">' + mt(2, BLUE) + '<span class="op">\u2192</span>' + mt(3, GREEN) + "</div>", "Tap your tile, then a tile to add it onto."],
    ['<div class="eq">' + mt(2, BLUE) + '<span class="op">+</span>' + mt(3, GREEN) + '<span class="op">=</span><span class="five-burst">5!</span></div>', "A tile at five or more bursts."],
    ['<div class="five-pv3"><span class="five-out"></span><span class="five-out"></span><span class="five-pips"><i></i><i></i><i></i></span></div>',
      "Burst both of the computer's tiles to win the round. First to three."]
  ];
  function howto(onClose) {
    var U = window.NumbericsUI; if (!U || !U.sheet) { if (onClose) onClose(); return; }
    U.sheet("howto", function (body) {
      body.innerHTML = '<div class="howto">' + STEPS.map(function (s) {
        return '<div class="step"><div class="pv" aria-hidden="true">' + s[0] + "</div><p>" + s[1] + "</p></div>";
      }).join("") + '</div><div class="row"><button class="btn primary" type="button" data-play>Play</button></div>';
      body.querySelector("[data-play]").addEventListener("click", function () { sfx("tick"); U.close(); });
    }, { title: "How to play Five", onClose: onClose });
    try { if (NP) NP.markHowto("five"); } catch (e) { /* storage is a nicety */ }
  }
  $("howto-open").addEventListener("click", function () { sfx("tick"); howto(); });

  render();
  // the first visit to Five (no saved game) opens the steps once; the computer opens the round when they close
  var firstVisit = !saved && NP && !NP.seenHowto("five");
  // (after this file: ui.js loads last, so the sheet opens once every script has run)
  if (firstVisit) setTimeout(function () { howto(function () { scheduleComputer(); }); }, 0); else scheduleComputer();

  // Screenshot hook (tools/shots.cjs): a fixed, representative mid-match. Not reachable from the UI.
  window.__demo = function () {
    try { if (window.NumbericsUI && window.NumbericsUI.current() === "howto") window.NumbericsUI.close(); } catch (e) { /* no sheet */ }
    flush(); armed = null;
    var s = N.newMatch(2026, "medium");
    s.tiles = [3, 1, 4, 2]; s.turn = "p"; s.round = 3; s.wins = { p: 1, c: 1 }; s.moves = 9;
    s.power.p = { undo: 1, split: 1, shield: 2, nudge: 0 };
    s.shield = { side: "c", idx: 3 };
    state = s; level = "medium"; sel = 0; cur = 0; render();
  };
  window.__five = {
    get state() { return state; }, set state(s) { flush(); armed = null; sel = -1; state = s; render(); },
    get busy() { return busy; }, get anim() { return anim; }, get holding() { return holding; }, get viewing() { return viewing; },
    get record() { return record; }, get byLevel() { return byLevel; }, get run() { return run; }, get pills() { return cardTro.slice(); },
    render: render, tap: tap, flush: flush, howto: howto,
  };
})();
