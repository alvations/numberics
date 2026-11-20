/* SPDX-License-Identifier: Apache-2.0 | Copyright 2026 alvations (Melon Lab)
 * Numberics Five: browser client. The engine (engine.js) owns every rule and the computer's play;
 * this file only draws, listens, animates and remembers. */
(function () {
  "use strict";
  var N = window.NumbericsFive, K = window.NumbericsKit, P = window.NumbericsPower;
  var store = K.store("numberics_five_v1");
  var reduce = K.reducedMotion();
  var FLY = 200, BURST_MS = 320, THINK = reduce ? 250 : 520;

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

  var $ = function (id) { return document.getElementById(id); };
  var boardEl = $("board"), fxEl = $("fx");
  var slots = []; Array.prototype.forEach.call(document.querySelectorAll(".slot"), function (el) { slots[+el.getAttribute("data-i")] = el; });

  function persist() {
    if (state.matchOver && !counted) { counted = true; if (state.matchOver === "p") record.won++; else record.lost++; }
    if (!state.matchOver) counted = false;
    store.save({ state: state, level: level, record: record });
  }

  var PW = { undo: "Undo", split: "Split", shield: "Shield", nudge: "Nudge" };
  var DEFS = N.POWERS.map(function (p) {
    return { id: p, label: PW[p], title: { undo: "take back your turn and the reply", split: "move one point to your other tile",
      shield: "a tile cannot be hit next turn", nudge: "+1 on their tile or -1 on yours" }[p] };
  });
  var PW_HINT = { split: "Tap your tile to move one point onto your other tile.",
    shield: "Tap your tile to shield it from the next hit, then move.",
    nudge: "Tap a tile: theirs goes up 1, yours goes down 1." };

  function myTurn() { return state.turn === "p" && !state.roundOver && !busy; }

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
        (state.shield && state.shield.idx === i ? " shield" : "");
      if (v) el.appendChild(tileEl(v));
      var owner = i < 2 ? "your" : "computer";
      el.setAttribute("aria-label", owner + " tile " + (i % 2 ? "right" : "left") + ": " + (v ? v : "burst"));
    });
    $("you").textContent = state.wins.p; $("cpu").textContent = state.wins.c;
    $("matches").textContent = record.won + "-" + record.lost;
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
      armed: armed,
      disabled: function (id) { return id === "undo" ? (busy || !N.canUse(state, "undo")) : !myTurn() || (id === "shield" && state.midTurn); },
      onUse: activate,
    });
    boardEl.classList.toggle("targeting", !!armed);
    var hint = "";
    if (armed) hint = PW_HINT[armed] + " (Esc cancels)";
    else if (state.roundOver) hint = "";
    else if (state.turn === "c" || busy) hint = "The computer is thinking...";
    else if (N.mustPass(state)) hint = "Nothing to hit this turn. Tap your tile to pass, or use a power-up.";
    else if (sel >= 0) hint = "Add " + state.tiles[sel] + " onto which tile? Your own other tile counts.";
    else hint = state.midTurn ? "Shield is up. Now make your move." : "Your turn: tap one of your tiles.";
    $("hint").textContent = hint;
    var over = $("over"), ttl = $("over-title");
    over.hidden = !state.roundOver || busy;
    if (state.roundOver && !busy) {
      var m = state.matchOver, rw = state.roundOver;
      ttl.textContent = m ? (m === "p" ? "You take the match" : "The computer takes the match")
        : rw === "draw" ? "Round drawn" : rw === "p" ? "Round to you" : "Round to the computer";
      ttl.className = (m || rw) === "p" ? "win" : "";
      $("over-text").textContent = "Rounds " + state.wins.p + "-" + state.wins.c + (state.draws ? " (" + state.draws + " drawn)" : "") +
        (m ? "" : " · first to 3") + (rw === "draw" && !m ? " · position repeated or 40 turns without a burst" : "");
      $("again").textContent = m ? "New match" : "Next round";
    }
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
    fxEl.textContent = ""; busy = false;
  }

  // commit a new state from an action, animate it, then pass the turn to the computer if needed
  function commit(res, who) {
    var before = state.tiles.slice();
    state = res.state; persist();
    if (res.awarded) K.toast((who === "p" ? "Burst! +" : "Computer earned ") + PW[res.awarded]);
    else if (res.burst && who === "p") K.toast("Burst!");
    animate(before, state.last, afterTurn);
  }
  function afterTurn() {
    if (state.roundOver) { $("again").focus({ preventScroll: true }); return; }
    if (state.turn === "c") scheduleComputer();
  }
  function scheduleComputer() {
    if (timer !== null || state.turn !== "c" || state.roundOver) return;
    busy = true; render();
    var gen = state.moves;
    timer = setTimeout(function () {
      timer = null; if (state.moves !== gen || state.turn !== "c") { busy = false; return render(); }
      var r = N.aiPlan(state);
      state.seed = r.seed;
      runPlan(r.plan);
    }, THINK);
  }
  function runPlan(plan) {
    if (!plan.length) { busy = false; return render(); }
    var a = plan[0], res = N.apply(state, a);
    if (!res.ok) { busy = false; return render(); }
    if (a.type === "power") K.toast("Computer used " + PW[a.name]);
    if (a.type === "pass") K.toast("Computer has nothing to hit: it passes");
    var before = state.tiles.slice();
    state = res.state; persist();
    if (res.awarded) K.toast("Computer earned " + PW[res.awarded]);
    animate(before, state.last, function () {
      if (plan.length > 1 && !state.roundOver && state.turn === "c") {
        busy = true; var gen = state.moves;
        timer = setTimeout(function () { timer = null; if (state.moves === gen) runPlan(plan.slice(1)); }, reduce ? 120 : 300);
      } else afterTurn();
    });
  }

  // ---- input ----
  function tap(i) {
    if (!myTurn()) return;
    var v = state.tiles[i];
    if (armed) {
      var name = armed, res = N.use(state, name, i);
      if (!res.ok) { K.toast("Pick a valid tile"); return; }
      armed = null; sel = -1;
      K.toast(PW[name] + "!");
      return commit(res, "p");
    }
    if (N.mustPass(state)) { if (i < 2 && v) { sel = -1; commit(N.pass(state), "p"); } return; }
    if (sel < 0) { if (i < 2 && v) { sel = i; render(); } return; }
    if (i === sel) { sel = -1; return render(); }
    var r = N.play(state, sel, i);
    if (!r.ok) { if (state.shield && state.shield.idx === i) K.toast("That tile is shielded this turn"); return; }
    sel = -1; commit(r, "p");
  }
  function activate(name) {
    if (name === "undo") {
      if (!N.canUse(state, "undo")) return;
      flush(); armed = null; sel = -1;
      if (state.matchOver && counted) { if (state.matchOver === "p") record.won--; else record.lost--; counted = false; }
      state = N.use(state, "undo").state; persist(); K.toast("Took back your turn"); return render();
    }
    if (!myTurn()) return;
    if (armed === name) { armed = null; return render(); }
    if (!state.power.p[name] || (name === "shield" && state.midTurn)) return;
    armed = name; sel = -1; render();
  }
  slots.forEach(function (el, i) { el.addEventListener("click", function () { boardEl.classList.remove("kb"); cur = i; tap(i); }); });
  var GRID = { 0: { up: 2, right: 1 }, 1: { up: 3, left: 0 }, 2: { down: 0, right: 3 }, 3: { down: 1, left: 2 } };
  window.addEventListener("keydown", function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target && e.target.closest && e.target.closest("button") && (e.key === "Enter" || e.key === " ")) return;
    if (e.key === "Escape") { armed = null; sel = -1; return render(); }
    var pi = ["1", "2", "3", "4"].indexOf(e.key);
    if (pi >= 0) return activate(N.POWERS[pi]);
    if (e.key === "u" || e.key === "U") return activate("undo");
    var d = K.arrowKey(e);
    if (d) {
      e.preventDefault(); boardEl.classList.add("kb");
      var n = GRID[cur][d]; if (n !== undefined) cur = n;
      return render();
    }
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (state.roundOver && !busy) return $("again").click();
      boardEl.classList.add("kb"); tap(cur);
    }
  });

  function startMatch(lv) {
    flush(); armed = null; sel = -1; level = lv || level;
    state = N.newMatch(K.freshSeed(), level); persist(); render(); scheduleComputer();
  }
  var inProgress = function () { return state.moves > 0 && !state.matchOver; };
  K.twoStep($("new"), inProgress, function () { startMatch(); }, "Sure? This ends the match");
  Array.prototype.forEach.call($("levels").children, function (b) {
    var label = b.textContent;
    b.addEventListener("click", function () {
      var lv = b.getAttribute("data-level"); if (lv === level) return;
      if (inProgress() && levelArm !== lv) {
        levelArm = lv; b.textContent = "Sure?";
        setTimeout(function () { if (levelArm === lv) levelArm = null; b.textContent = label; }, 3000); return;
      }
      levelArm = null; b.textContent = label; startMatch(lv); K.toast(label + ": new match");
    });
  });
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
    get busy() { return busy; }, render: render, tap: tap, flush: flush,
  };
})();
