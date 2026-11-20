/* SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 alvations (Melon Lab)
 * Numberics Fibonacci: browser client, modelled on the Endless client (../game.js).
 * The engine (engine.js on top of ../engine.js) owns every rule; this file only draws, listens, remembers. */
(function () {
  "use strict";
  var N = window.NumbericsFibonacci, K = window.NumbericsKit, P = window.NumbericsPower;
  var store = K.store("numberics_fibonacci_v1");
  var ANIM = K.reducedMotion() ? 0 : 110;

  function int(v) { return Number.isInteger(v) && v >= 0; }
  function num(v) { return typeof v === "number" && isFinite(v) && v >= 0; }
  function validPower(p) { return !!p && N.POWERS.every(function (k) { return int(p[k]); }); }
  function validGrid(g) { return Array.isArray(g) && g.length === 16 && g.every(int); }
  // A saved snapshot for Undo: the same fields the engine's snapshot() writes.
  function validPrev(p) {
    return !!p && validGrid(p.grid) && validPower(p.power) && num(p.score) && int(p.top) && int(p.moves) && num(p.seed);
  }
  function valid(s) {
    if (!(!!s && s.size === 4 && validGrid(s.grid) && validPower(s.power) &&
      num(s.score) && int(s.top) && int(s.moves) && num(s.seed))) return false;
    if (s.prev != null && !validPrev(s.prev)) s.prev = null; // a broken snapshot costs one Undo, not the run
    s.over = !!s.over;
    return true;
  }

  var saved = store.load();
  var best = { score: num(saved && saved.bestScore) ? saved.bestScore : 0, top: int(saved && saved.bestTop) ? saved.bestTop : 0 };
  var state = saved && valid(saved.state) ? saved.state : N.newGame(K.freshSeed());
  // The best score before this run started, so the end card can say "New best." (R8).
  var runBest = saved && valid(saved.state) && num(saved.runBest) ? saved.runBest : best.score;
  var targeting = null;           // {name, picks:[], kbd} while a power-up waits for a target
  var cursor = 0;                 // keyboard cursor cell while targeting (R9)
  var note = "";                  // a tray explanation shown in the hint line until the next action (R5)
  var timer = null, pendingFx = null;
  var els = [];                   // cell index -> tile element

  var $ = function (id) { return document.getElementById(id); };
  var boardEl = $("board"), tilesEl = $("tiles"), cellsEl = $("cells"), marksEl = $("marks");
  for (var i = 0; i < 16; i++) cellsEl.appendChild(document.createElement("div"));

  function persist() {
    best.score = Math.max(best.score, state.score); best.top = Math.max(best.top, state.top);
    store.save({ state: state, bestScore: best.score, bestTop: best.top, runBest: runBest });
  }
  var fmt = K.fmt;

  // Big tiles read "F" with the Fibonacci index as a subscript (the engine label uses Unicode subscripts).
  function isSub(level) { return N.label(level).charAt(0) === "F"; }
  function spoken(level) { return isSub(level) ? "Fibonacci number " + N.fibIndex(level) : N.label(level); }
  function setLabel(el, level) {
    el.textContent = "";
    if (isSub(level)) {
      var idx = String(N.fibIndex(level));
      el.appendChild(document.createTextNode("F"));
      var sub = document.createElement("sub"); sub.textContent = idx; el.appendChild(sub);
      el.setAttribute("data-len", String(Math.min(6, 1 + idx.length)));
    } else { var l = N.label(level); el.textContent = l; el.setAttribute("data-len", String(l.length)); }
    el.setAttribute("aria-label", "tile " + spoken(level));
  }
  function place(el, cell) { el.style.setProperty("--r", Math.floor(cell / 4)); el.style.setProperty("--c", cell % 4); }

  function render(fx) {
    tilesEl.textContent = ""; els = [];
    state.grid.forEach(function (lv, cell) {
      if (!lv) return;
      var el = document.createElement("div");
      el.className = "tile" + (lv === 1 ? " lo" : "");
      el.style.setProperty("--h", hue(lv));
      place(el, cell); setLabel(el, lv);
      if (fx && fx.merged && fx.merged[cell]) el.classList.add("pop");
      if (fx && fx.spawned === cell) el.classList.add("new");
      tilesEl.appendChild(el); els[cell] = el;
    });
    $("score").textContent = fmt(state.score);
    $("best").textContent = fmt(Math.max(best.score, state.score));
    $("top").textContent = state.top ? N.label(state.top) : "none";
    $("top").classList.toggle("none", !state.top);
    renderTray();
    renderMarks();
    boardEl.classList.toggle("targeting", !!targeting);
    var over = $("over");
    over.hidden = !state.over;
    if (state.over) {
      // R8: one summary line, "<Result> · <score>", and a new best says so.
      $("over-text").textContent = "Top tile " + N.label(state.top) + " · " + fmt(state.score) + " points";
      $("over-best").hidden = !(state.score > runBest);
    }
  }
  // Picked cells (gold) and the keyboard cursor (dashed), drawn above the tiles so a tile never hides them.
  function renderMarks() {
    marksEl.textContent = "";
    if (!targeting) return;
    for (var k = 0; k < 16; k++) {
      var picked = targeting.picks.indexOf(k) >= 0, cur = targeting.kbd && k === cursor;
      if (!picked && !cur) continue;
      var m = document.createElement("div");
      m.className = "tile mark" + (picked ? " sel" : "") + (cur ? " cur" : "");
      place(m, k); marksEl.appendChild(m);
    }
  }
  // Sequence colours (craft B2): the family hue formula (K.hue: 43 degrees a level) put 5 next to 233 and 8
  // next to 377. Fibonacci steps 111 degrees a level instead, so neighbours in the sequence (the pairs that
  // merge) are 111 degrees apart and the nearest repeat among 2 to 610 is 27 degrees. The phase keeps dark text at
  // 4.8:1 or better from 2 to 89. 1 keeps the cream tile.
  function hue(level) { return (level * 111 + 120) % 360; }

  var PW = { undo: "Undo", smash: "Smash", swap: "Swap", boost: "Boost" };
  // R5: tooltip voice "1: Undo. Take back the last move.", and a tap on an unusable slot explains it.
  var EARN = "Earned by each new top tile from 34.";
  var DEFS = [
    { id: "undo", label: "Undo", desc: "Take back the last move.", earn: EARN },
    { id: "smash", label: "Smash", desc: "Remove one tile.", earn: EARN },
    { id: "swap", label: "Swap", desc: "Exchange two cells.", earn: EARN },
    { id: "boost", label: "Boost", desc: "Step a tile up one Fibonacci number (1 becomes 2).", earn: EARN },
  ];
  var PW_HINT = { smash: "Tap a tile to smash it.", boost: "Tap a tile to step it up (1 to 2).",
                  swap: "Tap two cells to swap them." };
  var touchOnly = (function () { try { return window.matchMedia("(hover: none) and (pointer: coarse)").matches; } catch (e) { return false; } })();
  function targetHint() {
    if (targeting.kbd) {
      // kept to one line at 375px so the board never jumps
      var what = targeting.name === "swap" ? (targeting.picks.length ? "the second cell." : "the first cell.")
        : "to " + targeting.name + ".";
      return "Arrows, then Enter " + what + " (Esc cancels)";
    }
    // cold #5: there is no Esc on a phone
    return PW_HINT[targeting.name] + (touchOnly ? " Tap " + PW[targeting.name] + " to cancel." : " (Esc cancels)");
  }
  function renderTray() {
    P.tray($("tray"), DEFS, state.power, {
      armed: targeting && targeting.name,
      disabled: function (id) {
        if (state.over) return "The game is over.";
        return id === "undo" && state.power.undo > 0 && !state.prev ? "Nothing to take back yet." : false;
      },
      onUse: activate,
      onInfo: function (id, text) { flush(); targeting = null; note = text; render(); },
    });
    $("hint").textContent = targeting ? targetHint() : note ? note
      : (!N.canMove(state) && !state.over ? "Stuck. Use a power-up to keep going." : "");
  }
  function toast(msg, kind) { K.toast(msg, kind); }

  // ---- animation: slide the old tiles, then redraw authoritatively ----
  function flush() { if (timer !== null) { clearTimeout(timer); timer = null; finalize(); } }
  function finalize() { var fx = pendingFx; pendingFx = null; render(fx); }

  function doMove(dir) {
    flush();
    if (targeting) return;
    var r = N.move(state, dir);
    if (!r.moved) return;
    note = "";
    var merged = {};
    r.trace.forEach(function (t) {
      var el = els[t.from]; if (el) place(el, t.to);
      if (t.merge) merged[t.to] = true;
    });
    state = r.state; pendingFx = { merged: merged, spawned: r.spawned };
    if (r.milestones.length && !state.over) { // R7: when the move ends the game, the end card is the only message
      var top = r.milestones[r.milestones.length - 1];
      toast("New tile " + N.label(top) + (r.awarded.length ? "  +" + PW[r.awarded[0].power] : ""));
    }
    persist();
    if (ANIM) { var gen = state.moves; timer = setTimeout(function () { if (state.moves === gen) { timer = null; finalize(); } }, ANIM); }
    else finalize();
  }

  // ---- power-ups ----
  function activate(name, kbd) {
    flush(); note = "";
    if (targeting && targeting.name === name) { targeting = null; return render(); }
    targeting = null;
    if (state.over) return render();
    if (name === "undo") {
      var u = N.use(state, "undo");
      if (u.ok) { state = u.state; persist(); toast("Rewound one move"); return render(); }
      return explain(name);
    }
    if (!state.power[name]) return explain(name);
    targeting = { name: name, picks: [], kbd: !!kbd };
    if (kbd) startCursor();
    render();
  }
  // A key (1 to 4, U) on a slot that cannot act explains it, like a tap does (R5).
  function explain(name) {
    var d = DEFS[N.POWERS.indexOf(name)];
    note = P.info(d, state.power, state.power[name] ? "Nothing to take back yet." : false, {}); return render();
  }
  // Keyboard targeting starts on the highest tile (the usual target).
  function startCursor() {
    var b = 0; state.grid.forEach(function (v, k) { if (v > state.grid[b]) b = k; }); cursor = b;
  }
  function moveCursor(dir) {
    var r = Math.floor(cursor / 4), c = cursor % 4;
    if (dir === "left") c = Math.max(0, c - 1); else if (dir === "right") c = Math.min(3, c + 1);
    else if (dir === "up") r = Math.max(0, r - 1); else r = Math.min(3, r + 1);
    cursor = r * 4 + c;
    if (!targeting.kbd) targeting.kbd = true;
    render();
  }
  function cellAt(ev) {
    var rect = boardEl.getBoundingClientRect(), x = ev.clientX - rect.left, y = ev.clientY - rect.top;
    var c = Math.floor(x / rect.width * 4), r = Math.floor(y / rect.height * 4);
    return (c < 0 || c > 3 || r < 0 || r > 3) ? -1 : r * 4 + c;
  }
  function pick(ev) {
    if (!targeting) return;
    var cell = cellAt(ev); if (cell < 0) return;
    targeting.kbd = false; pickCell(cell);
  }
  function pickCell(cell) {
    var picks = targeting.picks;
    if (picks.length && picks[0] === cell) { picks.length = 0; return render(); } // tap the first pick again to drop it
    picks.push(cell);
    var need = targeting.name === "swap" ? 2 : 1;
    if (picks.length < need) return render();
    var name = targeting.name, wasTop = state.top;
    var res = N.use(state, name, picks[0], picks[1]);
    if (res.ok) {
      state = res.state; targeting = null; persist();
      // gameplay nit: a Boost that makes a new highest tile pays nothing, so say why no reward came
      toast(name === "boost" && state.top > wasTop && state.top >= N.AWARD_FROM_INDEX
        ? "Boost! Boosted tiles earn no reward" : PW[name] + "!");
    } else {
      targeting.picks = [];
      toast(name === "swap" ? "Pick two cells, at least one with a tile" : "Pick a tile, not an empty cell", "bad");
    }
    render();
  }

  // ---- input ----
  window.addEventListener("keydown", function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var tag = e.target && e.target.tagName;
    // R9: Enter or Space on a focused button or link belongs to that control, never to the game
    if ((e.key === "Enter" || e.key === " ") && (tag === "BUTTON" || tag === "A")) return;
    if (e.key === "Escape") { targeting = null; return render(); }
    var pi = ["1", "2", "3", "4"].indexOf(e.key);
    if (pi >= 0) return activate(N.POWERS[pi], true);
    if (e.key === "u" || e.key === "U") return activate("undo", true);
    var d = K.arrowKey(e);
    if (targeting) {
      if (d) { e.preventDefault(); return moveCursor(d); }
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (!targeting.kbd) { targeting.kbd = true; startCursor(); return render(); }
        return pickCell(cursor);
      }
      return;
    }
    if (d) { e.preventDefault(); doMove(d); }
  });
  boardEl.addEventListener("click", pick);
  K.swipe(boardEl, doMove);

  // ---- new game: two-step instead of a blocking confirm() dialog ----
  function startNew() {
    flush(); targeting = null; note = "";
    best.score = Math.max(best.score, state.score); runBest = best.score;
    state = N.newGame(K.freshSeed()); persist(); render();
  }
  K.twoStep($("new"), function () { return state.moves > 0 && !state.over; }, startNew);
  $("again").addEventListener("click", startNew);

  render();
  // Screenshot hook (tools/shots.cjs): a fixed, representative mid-game. Not reachable from the UI.
  window.__demo = function () {
    flush(); targeting = null;
    var s = N.newGame(34), dirs = ["down", "left", "down", "right"];
    for (var k = 0; k < 600 && !s.over; k++) {
      var r = N.move(s, dirs[k % 4]);
      if (!r.moved) r = N.move(s, "up");
      s = r.state;
      if (s.top >= 12 && s.grid.filter(Boolean).length >= 11 && new Set(s.grid).size >= 9) break; // top 233, varied
    }
    s.power = { undo: 1, smash: 2, swap: 1, boost: 1 };
    state = s; note = ""; render();
  };
  window.__fibonacci = { get state() { return state; }, set state(s) { state = s; render(); }, render: render,
    get cursor() { return cursor; }, get targeting() { return targeting; }, hue: hue,
    get runBest() { return runBest; }, set runBest(v) { runBest = v; } };
})();
