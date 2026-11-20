/* SPDX-License-Identifier: Apache-2.0 | Copyright 2026 alvations (Melon Lab)
 * Numberics Five: browser client. The engine (engine.js) owns every rule and the computer's play;
 * this file only draws, listens, animates and remembers. */
(function () {
  "use strict";
  var N = window.NumbericsFive, K = window.NumbericsKit, P = window.NumbericsPower;
  var store = K.store("numberics_five_v1");
  var reduce = K.reducedMotion();
  var FLY = 200, BURST_MS = 320, THINK = reduce ? 250 : 520, HOLD = 1500; // R13: the result shows before the card

  function validState(s) {
    return s && Array.isArray(s.tiles) && s.tiles.length === 4 &&
      s.tiles.every(function (v) { return Number.isInteger(v) && v >= 0 && v < N.BURST; }) &&
      (s.turn === "p" || s.turn === "c") && N.LEVELS.indexOf(s.level) >= 0 && s.power && s.power.p && s.power.c &&
      s.wins && typeof s.wins.p === "number" && typeof s.moves === "number" && s.seen && typeof s.seen === "object";
  }
  var saved = store.load();
  var record = (saved && saved.record && typeof saved.record.won === "number") ? saved.record : { won: 0, lost: 0 };
  var level = saved && N.LEVELS.indexOf(saved.level) >= 0 ? saved.level : "medium";
  var state = saved && validState(saved.state) ? saved.state : N.newMatch(K.freshSeed(), level);
  level = state.level;

  var sel = -1, cur = 0, armed = null;   // selected tile, keyboard cursor, armed power-up
  var timer = null, busy = false, counted = !!state.matchOver, levelArm = null;
  var holding = false, viewing = false, keys = false; // R13 hold before the card, "See the board", keyboard in use

  var $ = function (id) { return document.getElementById(id); };
  var boardEl = $("board"), fxEl = $("fx");
  var slots = []; Array.prototype.forEach.call(document.querySelectorAll(".slot"), function (el) { slots[+el.getAttribute("data-i")] = el; });

  function persist() {
    if (state.matchOver && !counted) { counted = true; if (state.matchOver === "p") record.won++; else record.lost++; }
    if (!state.matchOver) counted = false;
    store.save({ state: state, level: level, record: record });
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

  function tileEl(v) {
    var t = document.createElement("div");
    t.className = "tile v" + v + (v === 1 ? " lo" : v === 2 ? " lo2" : "");
    t.style.setProperty("--h", K.hue(v)); t.textContent = v;
    return t;
  }
  function render() {
    var canTargets = {};
    if (myTurn() && sel >= 0 && !armed) N.legalMoves(state).forEach(function (m) { if (m.from === sel) canTargets[m.to] = 1; });
    slots.forEach(function (el, i) {
      var v = state.tiles[i];
      el.textContent = "";
      el.className = "slot" + (v ? "" : " dead") + (i === sel ? " sel" : "") + (canTargets[i] ? " can" : "") +
        (i === cur && boardEl.classList.contains("kb") ? " cur" : "") +
        (state.shield && state.shield.idx === i ? " shield" : "") +
        (state.roundOver && state.last && state.last.burst && state.last.to === i ? " hit" : "");
      if (v) el.appendChild(tileEl(v));
      var owner = i < 2 ? "your" : "computer";
      el.setAttribute("aria-label", owner + " tile " + (i % 2 ? "right" : "left") + ": " + (v ? v : "burst"));
    });
    $("you").textContent = state.wins.p; $("cpu").textContent = state.wins.c;
    var none = !record.won && !record.lost; // R16: Record reads a dimmed "none" until a match is decided
    $("matches").textContent = none ? "none" : record.won + "-" + record.lost; $("matches").classList.toggle("none", none);
    var pips = $("pips"); pips.textContent = "";
    var R = 2 * N.ROUNDS_TO_WIN - 1;
    for (var k = 0; k < R; k++) {
      var d = document.createElement("i");
      if (k < state.wins.p) d.className = "p"; else if (k >= R - state.wins.c) d.className = "c";
      pips.appendChild(d);
    }
    pips.setAttribute("aria-label", "Rounds: you " + state.wins.p + ", computer " + state.wins.c + ", first to 3");
    Array.prototype.forEach.call($("levels").children, function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-level") === level)); });
    P.tray($("tray"), DEFS, state.power.p, {
      armed: armed, earn: EARN, onUse: activate, disabled: whyNot,
      onInfo: function (id, text) { $("hint").textContent = text; },
    });
    boardEl.classList.toggle("targeting", !!armed);
    var hint = "";
    if (armed) hint = PW_HINT[armed] + (keys ? " (Esc cancels)" : "");
    else if (levelArm) hint = "Tap " + PW_LEVEL[levelArm] + " again to switch. This match counts as a loss.";
    else if (state.roundOver) hint = state.roundOver === "draw" ? "Drawn: the same position came up 3 times, or 40 turns passed without a burst."
      : (holding || viewing) ? lastWords() + (viewing ? " Tap the board for the summary." : "") : "";
    else if (state.turn === "c" || busy) hint = "The computer is thinking\u2026";
    else if (N.mustPass(state)) hint = "Nothing to hit this turn. Tap your tile to pass, or use a power-up.";
    else if (sel >= 0) hint = "Add " + state.tiles[sel] + " onto which tile? Your own other tile counts.";
    else hint = state.midTurn ? "Shield is up. Now make your move." : "Your turn: tap one of your tiles.";
    $("hint").textContent = hint;
    var over = $("over"), ttl = $("over-title");
    over.hidden = !state.roundOver || busy || holding || viewing;
    if (state.roundOver && !busy) {
      // R8: a white one-line headline, one summary line, the gold primary button.
      // R16: rounds read "You 2 : 1 Computer", matches "Match won 3-1" / "Match lost 1-3".
      var m = state.matchOver, rw = state.roundOver;
      ttl.textContent = m ? (m === "p" ? "Match to you" : "Match to the computer")
        : rw === "draw" ? "Round drawn" : rw === "p" ? "Round to you" : "Round to the computer";
      $("over-text").textContent = m ? (m === "p" ? "Match won " + state.wins.p + "-" + state.wins.c : "Match lost " + state.wins.p + "-" + state.wins.c)
        : "You " + state.wins.p + " : " + state.wins.c + " Computer" + (state.draws ? " · " + state.draws + " drawn" : "") + " · first to 3";
      $("again").textContent = m ? "New game" : "Next round";
    }
  }

  // what ended the round, for the hint line while the board shows (R13)
  function lastWords() {
    var l = state.last; if (!l || !l.burst) return "";
    var who = l.side === "p" ? "Your" : "The computer's", whose = N.side(l.to) === l.side ? (l.side === "p" ? "your" : "its") : (l.side === "p" ? "their" : "your");
    if (l.kind === "nudge") return "Nudge burst " + whose + " " + l.prevTo + ".";
    if (l.prevTo === undefined) return "";
    return who + " " + l.add + " onto " + whose + " " + l.prevTo + " made " + l.value + ": it burst.";
  }
  // R13: after the round-ending move, hold the board (undimmed) for a beat, then show the card
  function hold() {
    holding = true; viewing = false; render();
    timer = setTimeout(function () { timer = null; holding = false; render(); $("again").focus({ preventScroll: true }); }, HOLD);
  }
  function showCard() { // skip the hold, or come back from "See the board"
    if (timer !== null && holding) { clearTimeout(timer); timer = null; }
    holding = false; viewing = false; render(); $("again").focus({ preventScroll: true });
  }

  // ---- animation: a copy of the giving tile flies onto the target, then the board redraws; a burst leaves a ghost ----
  function rectIn(el) {
    var b = boardEl.getBoundingClientRect(), r = el.getBoundingClientRect();
    return { x: r.left - b.left, y: r.top - b.top, w: r.width, h: r.height };
  }
  function animate(prevTiles, last, done) {
    fxEl.textContent = "";
    var gen = state.moves;
    var finish = function () { if (state.moves !== gen) return; fxEl.textContent = ""; busy = false; render(); done(); };
    if (!last || (last.kind !== "add" && last.kind !== "nudge" && last.kind !== "split")) { busy = false; render(); return done(); }
    busy = true;
    var to = slots[last.to].getBoundingClientRect().width ? rectIn(slots[last.to]) : null;
    var burstGhost = function () {
      if (!last.burst || !to) return;
      var g = tileEl(Math.min(4, prevTiles[last.to])); g.classList.add("ghost");
      g.style.left = to.x + "px"; g.style.top = to.y + "px"; g.style.width = to.w + "px"; g.style.height = to.h + "px";
      g.textContent = last.kind === "nudge" ? "5" : String(last.value);
      fxEl.appendChild(g);
    };
    if (last.kind === "add" && to) {
      var from = rectIn(slots[last.from]), f = tileEl(prevTiles[last.from]); f.classList.add("fly");
      f.style.left = from.x + "px"; f.style.top = from.y + "px"; f.style.width = from.w + "px"; f.style.height = from.h + "px";
      fxEl.appendChild(f);
      void f.offsetWidth;
      if (!reduce) { f.style.translate = (to.x - from.x) + "px " + (to.y - from.y) + "px"; f.style.scale = ".55"; }
      f.style.opacity = "0";
      timer = setTimeout(function () {
        timer = null; if (state.moves !== gen) return;
        busy = false; render(); busy = true; burstGhost();
        if (last.burst) timer = setTimeout(function () { timer = null; finish(); }, BURST_MS); else finish();
      }, FLY);
    } else {
      busy = false; render(); busy = true;
      if (last.burst) { burstGhost(); timer = setTimeout(function () { timer = null; finish(); }, BURST_MS); }
      else {
        var t = slots[last.to].querySelector(".tile"); if (t && !reduce) t.classList.add("pop");
        if (last.kind === "split" && slots[last.from].querySelector(".tile") && !reduce) slots[last.from].querySelector(".tile").classList.add("pop");
        finish();
      }
    }
  }
  function flush() { // drop any pending animation or computer timer; the state is already authoritative
    if (timer !== null) { clearTimeout(timer); timer = null; }
    fxEl.textContent = ""; busy = false; holding = false; viewing = false;
  }
  // a tap or key while only an animation is pending on your turn lands at once (the state is already yours)
  function catchUp() { if (busy && state.turn === "p" && !state.roundOver) { flush(); render(); } }

  // commit a new state from an action, animate it, then pass the turn to the computer if needed
  function commit(res, who) {
    var before = state.tiles.slice();
    state = res.state; persist();
    // R7: a reward is a toast; a round result is the overlay alone (no "Burst!" note on the round-ending burst)
    if (res.awarded) K.toast("Burst! +" + PW[res.awarded]);
    else if (res.unpaid && !state.roundOver) K.toast("Burst! No reward after Shield.", "info"); // R2
    else if (res.burst && who === "p" && !state.roundOver) K.toast("Burst!");
    animate(before, state.last, afterTurn);
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
    var before = state.tiles.slice();
    state = res.state; persist();
    animate(before, state.last, function () {
      if (plan.length > 1 && !state.roundOver && state.turn === "c") {
        busy = true; var gen = state.moves;
        timer = setTimeout(function () { timer = null; if (state.moves === gen) runPlan(plan.slice(1)); }, reduce ? 120 : 300);
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
      if (!res.ok) { K.toast("Pick a valid tile", "bad"); return; }
      armed = null; sel = -1;
      K.toast(PW[name] + "!");
      return commit(res, "p");
    }
    if (N.mustPass(state)) { if (i < 2 && v) { sel = -1; commit(N.pass(state), "p"); } return; }
    if (sel < 0) { if (i < 2 && v) { sel = i; render(); } return; }
    if (i === sel) { sel = -1; return render(); }
    var r = N.play(state, sel, i);
    if (!r.ok) { if (state.shield && state.shield.idx === i) K.toast("That tile is shielded this turn", "bad"); return; }
    sel = -1; commit(r, "p");
  }
  function activate(name) {
    if (name === "undo") {
      if (!N.canUse(state, "undo")) return; // R1: never across a decided round, so a counted match stays counted
      flush(); armed = null; sel = -1; levelArm = null;
      state = N.use(state, "undo").state; persist(); K.toast("Took back your turn"); return render();
    }
    catchUp();
    if (!myTurn()) return;
    if (armed === name) { armed = null; return render(); }
    if (!state.power.p[name] || (name === "shield" && state.midTurn)) return;
    armed = name; sel = -1; render();
  }
  slots.forEach(function (el, i) { el.addEventListener("click", function (e) { e.stopPropagation(); keys = false; boardEl.classList.remove("kb"); cur = i; tap(i); }); });
  boardEl.addEventListener("click", function (e) { // R13: a tap anywhere on the shown board brings the summary back
    if (state.roundOver && !busy && (holding || viewing) && !(e.target.closest && e.target.closest(".over"))) showCard();
  });
  var GRID = { 0: { up: 2, right: 1 }, 1: { up: 3, left: 0 }, 2: { down: 0, right: 3 }, 3: { down: 1, left: 2 } };
  // a number key behaves exactly like tapping that tray slot (an unusable one explains itself, R5)
  function traySlot(k) { var b = $("tray").querySelectorAll("button")[k]; if (b) b.click(); }
  window.addEventListener("keydown", function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
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
    if (N.played(state)) record.lost++;
    flush(); armed = null; sel = -1; level = lv || level; levelArm = null;
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
      if (lv === level) return;
      if (inProgress() && levelArm !== lv) {
        disarmLevels(); // only one "Sure?" at a time
        K.clearToast(); levelArm = lv; b.textContent = "Sure?"; render();
        levelT = setTimeout(function () { disarmLevels(); render(); }, 3000); return;
      }
      disarmLevels(); startMatch(lv); K.toast(label + ": new game");
    });
  });
  $("over-view").addEventListener("click", function (e) { e.stopPropagation(); viewing = true; render(); boardEl.focus({ preventScroll: true }); });
  $("again").addEventListener("click", function () {
    flush();
    if (state.matchOver) return startMatch();
    state = N.nextRound(state); armed = null; sel = -1; persist(); render(); scheduleComputer();
  });

  render();
  scheduleComputer();

  // Screenshot hook (tools/shots.cjs): a fixed, representative mid-match. Not reachable from the UI.
  window.__demo = function () {
    flush(); armed = null;
    var s = N.newMatch(2026, "medium");
    s.tiles = [3, 1, 4, 2]; s.turn = "p"; s.round = 3; s.wins = { p: 1, c: 1 }; s.moves = 9;
    s.power.p = { undo: 1, split: 1, shield: 2, nudge: 0 };
    s.shield = { side: "c", idx: 3 };
    state = s; level = "medium"; sel = 0; cur = 0; render();
  };
  window.__five = {
    get state() { return state; }, set state(s) { flush(); armed = null; sel = -1; state = s; render(); },
    get busy() { return busy; }, get holding() { return holding; }, get viewing() { return viewing; },
    get record() { return record; }, render: render, tap: tap, flush: flush,
  };
})();
