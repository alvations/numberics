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
    s.over = !!s.over; s.free = !!s.free; // R2: a reload never turns a power-up-assisted swipe into a paid one
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
  // Round 3 end-card pattern (as Endless): the locked board shows undimmed for HOLD ms, then the card; "See the
  // board" hides it again (a tap on the board, Esc or Enter brings it back). A run that loads already over shows the card.
  var HOLD = 1500, holding = false, holdT = null, viewing = false, wasOver = !!state.over;
  // a fine pointer with hover means a keyboard is likely: only then mention Esc and the arrow keys
  var desk = false;
  try { desk = window.matchMedia("(hover: hover) and (pointer: fine)").matches; } catch (e) { desk = false; }
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
    var bs = Math.max(best.score, state.score);
    $("best").textContent = bs ? fmt(bs) : "none"; $("best").classList.toggle("none", !bs); // R11: an empty best says none
    $("top").textContent = state.top ? N.label(state.top) : "none";
    $("top").classList.toggle("none", !state.top);
    renderTray();
    renderMarks();
    boardEl.classList.toggle("targeting", !!targeting);
    var over = $("over"), was = !over.hidden;
    if (state.over && !wasOver) { // the run just ended: hold the final board first
      holding = true; viewing = false; clearTimeout(holdT);
      var gen = state.moves;
      holdT = setTimeout(function () { holdT = null; if (holding && state.over && state.moves === gen) { holding = false; render(); } }, HOLD);
    }
    if (!state.over) { holding = false; viewing = false; clearTimeout(holdT); holdT = null; }
    wasOver = !!state.over;
    over.hidden = !state.over || holding || viewing;
    // one "New game" on screen at a time: the card's primary replaces the page button, whose space is kept
    $("new").style.visibility = state.over ? "hidden" : "";
    if (state.over) {
      K.clearToast(); // the end card is the only message (round 2: a toast sat on it)
      // R8: one summary line, "<Result> · <score>", and a new best says so.
      $("over-text").textContent = "Top tile " + N.label(state.top) + " · Score " + fmt(state.score);
      $("over-best").hidden = !(state.score > runBest);
      if (!over.hidden && !was) { try { $("again").focus({ preventScroll: true }); } catch (e) { /* focus is a nicety */ } }
    }
  }
  // "See the board" hides the card; a tap on the board, Esc or Enter brings it back (or skips the hold)
  function view(on) {
    viewing = on; holding = false; clearTimeout(holdT); holdT = null; render();
    if (on) { try { boardEl.focus({ preventScroll: true }); } catch (e) { /* focus is a nicety */ } }
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
  // Sequence colours. Round 3 (craft #2): a 111-degree step put 3 (green) beside 13 (lime) and 34 beside 144, both
  // 27 degrees apart. Now a table of 11 hues, picked so that at the tile's own saturation and lightness any two of
  // them differ by at least 30 (CIELAB delta E) and dark text keeps 4.79:1 or better, and ordered so that the pairs
  // that merge (neighbours in the sequence) differ by 86 or more. Any 11 values in a row (2 to 233, 3 to 377 ...)
  // never share a colour. 1 keeps the cream tile.
  var HUES = [357, 178, 326, 151, 222, 45, 290, 22, 118, 203, 75];
  function hue(level) { return level < 2 ? 40 : HUES[(level - 2) % HUES.length]; }

  var PW = { undo: "Undo", smash: "Smash", swap: "Swap", boost: "Boost" };
  // R5: tooltip voice "1: Undo. Take back the last move.", and a tap on an unusable slot explains it.
  var EARN = "Earned by each new top tile from 55.";
  var DEFS = [
    { id: "undo", label: "Undo", desc: "Take back the last move.", earn: EARN },
    { id: "smash", label: "Smash", desc: "Remove one tile.", earn: EARN },
    { id: "swap", label: "Swap", desc: "Exchange two cells.", earn: EARN },
    { id: "boost", label: "Boost", desc: "Step a tile up one Fibonacci number (1 becomes 2).", earn: EARN },
  ];
  var PW_HINT = { smash: "Tap a tile to smash it.", boost: "Tap a tile to step it up (1 to 2).",
                  swap: "Tap two cells to swap them." };
  // Milestone toasts start at 13 (round 2 craft nit: "New tile 2", "New tile 3" were noise every game).
  var TOAST_FROM = 6;
  // Round 3 (craft #13): the same targeting copy as Endless, which always says how to aim by tap; the keys and Esc
  // only where a keyboard is likely, and a phone is told how to cancel.
  function targetHint() {
    var t = targeting.name === "swap" && targeting.picks.length ? "Now tap the cell to swap it with." : PW_HINT[targeting.name];
    return t + (desk ? " Arrows + Enter aim, Esc cancels." : " Tap " + PW[targeting.name] + " to cancel.");
  }
  // The tray is rebuilt only when what it shows changes, and at once after a swipe, so a tap that lands
  // while the slide animates still hits a live button (cold #2: the animation's redraw swallowed it).
  var trayKey = "";
  function renderTray() {
    var key = JSON.stringify([state.power, targeting && targeting.name, state.over, !!state.prev]);
    if (key !== trayKey || !$("tray").firstChild) { trayKey = key; drawTray(); }
    renderHint();
  }
  function drawTray() {
    P.tray($("tray"), DEFS, state.power, {
      armed: targeting && targeting.name,
      disabled: function (id) {
        if (state.over) return "The game is over.";
        return id === "undo" && state.power.undo > 0 && !state.prev ? "Nothing to take back yet." : false;
      },
      onUse: activate,
      onInfo: function (id, text) { flush(); targeting = null; note = text; render(); },
    });
  }
  function renderHint() {
    $("hint").textContent = targeting ? targetHint() : state.over ? (viewing ? "Tap the board for the summary." : "")
      : note ? note : (!N.canMove(state) ? "Stuck. Use a power-up to keep going." : "");
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
    var before = state;
    state = r.state; pendingFx = { merged: merged, spawned: r.spawned };
    var top = r.milestones.length ? r.milestones[r.milestones.length - 1] : 0;
    if (top >= TOAST_FROM && !state.over) { // R7: when the move ends the game, the end card is the only message
      var why = "";
      if (r.awarded.length) why = "  +" + PW[r.awarded[0].power];
      else if (top >= N.AWARD_FROM_INDEX) // a paying tile that paid nothing: say why (R2, R15)
        why = r.free ? ". No reward right after a power-up."
          : r.marked ? ". Swapped and boosted tiles earn no reward." // R2 by tile (round 3)
          : r.full || N.POWERS.every(function (k) { return before.power[k] >= N.POWER_CAP; }) ? ". Power-ups full." : "";
      toast("New tile " + N.label(top) + why, why && !r.awarded.length ? "info" : undefined);
    }
    persist(); renderTray();
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
    K.clearToast(); // the toast sits over the hint line; the targeting hint must be readable
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
    if (ev.target && ev.target.closest && ev.target.closest("#over")) return; // the card's own buttons
    if (state.over && (viewing || holding)) return view(false);
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
      if (!state.over) toast(name === "boost" && state.top > wasTop && state.top >= N.AWARD_FROM_INDEX
        ? "Boosted to " + N.label(state.top) + ". Boosted tiles earn no reward." : PW[name] + "!");
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
    // R9, R17: Enter or Space on a focused control belongs to that control, never to the game; typing in a
    // field is never a game key
    if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
    if ((e.key === "Enter" || e.key === " ") && (tag === "BUTTON" || tag === "A" || tag === "SUMMARY")) return;
    if (state.over && (viewing || holding) && (e.key === "Escape" || e.key === "Enter" || e.key === " ")) { e.preventDefault(); return view(false); }
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
  // Round 3 (cold #5, as Endless): without a non-passive touchmove the browser runs its own scroll gesture for a
  // swipe, and the next tap (on a power-up just earned) only stops it: no click. Owning the move keeps the tap.
  boardEl.addEventListener("touchmove", function (e) { if (e.cancelable) e.preventDefault(); }, { passive: false });

  // ---- new game: two-step instead of a blocking confirm() dialog ----
  function startNew() {
    flush(); targeting = null; note = "";
    best.score = Math.max(best.score, state.score); runBest = best.score;
    state = N.newGame(K.freshSeed()); persist(); render();
  }
  K.twoStep($("new"), function () { return state.moves > 0 && !state.over; }, startNew);
  $("again").addEventListener("click", startNew);
  $("over-view").addEventListener("click", function () { view(true); });

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
    get runBest() { return runBest; }, set runBest(v) { runBest = v; },
    get viewing() { return viewing; }, get holding() { return holding; }, showCard: function () { view(false); } };
})();
