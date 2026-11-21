/* SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 alvations (Melon Lab)
 * Numberics Sudoku: browser client. sudoku/engine.js owns every rule. */
(function () {
  "use strict";
  var S = window.NumbericsSudoku, Kit = window.NumbericsKit, Power = window.NumbericsPower;
  var LEVELS = ["easy", "medium", "hard"];
  var cap = function (l) { return l[0].toUpperCase() + l.slice(1); };
  // Same key and shape as before power-ups ({state, elapsed, best}); `assisted` and `note` are newer and optional.
  var store = Kit.store("numberics_sudoku_v1");
  function save() { store.save({ state: state, elapsed: elapsed, best: bests, assisted: assisted, note: note }); }
  // Tray slots (keys U, H, C, F; digits 1-9 belong to the board). Undo is free; the rest are charged.
  var PW = [
    { id: "undo", key: "U", label: "Undo", desc: "Take back the last change. Free and unlimited." },
    { id: "reveal", key: "H", label: "Reveal", desc: "Show the right digit for one cell." },
    { id: "check", key: "C", label: "Check", desc: "Mark wrong digits, briefly." },
    { id: "cands", key: "F", label: "Candidates", desc: "Fill the notes of one 3x3 box." },
  ];
  var EARN = "Earn one per 9 cells with no clash.";
  var PW_NAME = { reveal: "Reveal", check: "Check", cands: "Candidates" };
  var PW_TARGET = { reveal: "Tap a cell to reveal", cands: "Tap a cell in the box to fill" };
  function ok81(a) { return Array.isArray(a) && a.length === 81 && a.every(function (v) { return Number.isInteger(v) && v >= 0; }); }
  function validState(s) {
    return s && ok81(s.puzzle) && ok81(s.solution) && ok81(s.grid) && ok81(s.notes) && Array.isArray(s.history) && LEVELS.indexOf(s.difficulty) >= 0;
  }
  var freshSeed = Kit.freshSeed;

  var saved = store.load();
  var bests = (saved && saved.best && typeof saved.best === "object") ? saved.best : {};   // pure solves: seconds
  var assisted = (saved && saved.assisted && typeof saved.assisted === "object") ? saved.assisted : {}; // {t, pw}
  var state = saved && validState(saved.state) ? S.upgrade(saved.state) : null;
  var elapsed = state && saved.elapsed > 0 ? +saved.elapsed : 0; // seconds, fractional: a reload loses nothing
  // what the end card says about records, kept with the puzzle it belongs to so a reload still shows it
  var note = saved && saved.note && state && saved.note.seed === state.seed ? saved.note : null;
  var level = state ? state.difficulty : "medium";
  var sel = -1, notesMode = false, tick = null, last = null, sinceSave = 0;
  var armed = null;            // "reveal" | "cands" while a power-up waits for a cell
  var marks = null, marksT = null; // Check result: {state, cells} shown briefly, only on the state it checked
  var levelArm = null, levelT = null; // a difficulty button waiting for its second tap
  // The finished grid shows bright and undimmed for HOLD ms before the card (TRIAGE3: the result before the card);
  // "See the board" hides the card again (viewing) and a tap on the board or Esc brings it back.
  var HOLD = 1500, hold = false, holdT = null, viewing = false;

  var $ = function (id) { return document.getElementById(id); };
  var boardEl = $("board"), cells = [];
  for (var r = 0; r < 9; r++) {
    var row = document.createElement("div"); row.className = "r"; row.setAttribute("role", "row");
    for (var q = 0; q < 9; q++) {
      var c = document.createElement("div"), i = r * 9 + q;
      c.className = "c"; c.setAttribute("role", "gridcell"); c.dataset.i = i; c.id = "c" + i;
      row.appendChild(c); cells.push(c);
    }
    boardEl.appendChild(row);
  }

  // ---- clock: real elapsed time while the tab is visible and the puzzle unsolved ----
  // bank() adds the time since the last bank. It runs every second, before every move, and when the page is
  // hidden or closed, so reloading neither stops the clock nor wins time (TRIAGE1 Sudoku, mechanics #2).
  function bank() {
    var now = Date.now();
    if (last !== null) elapsed += Math.min(2, Math.max(0, (now - last) / 1000)); // a sleeping machine adds at most 2 s
    last = (document.hidden || !state || state.solved) ? null : now;
  }
  function secs() { return Math.floor(elapsed); }
  function fresh(diff) {
    disarmLevel();
    disarm(); level = diff; sel = -1; elapsed = 0; last = null; marks = null; note = null;
    clearTimeout(holdT); hold = false; viewing = false;
    state = S.newState(S.generate(freshSeed(), diff)); bank(); save(); startTimer(); render();
  }
  var fmt = Kit.clock;
  function startTimer() {
    clearInterval(tick); bank();
    if (state.solved) return;
    tick = setInterval(function () {
      bank(); if (state.solved) return;
      $("time").textContent = fmt(secs());
      if (++sinceSave >= 5) { sinceSave = 0; save(); }
    }, 1000);
  }
  function toast(m, kind) { Kit.toast(m, kind); }
  function plural(n, w) { return n + " " + w + (n === 1 ? "" : "s"); }

  // ---- tray: why a slot cannot act now (null = it can) ----
  function why(id) {
    if (id === "undo") return state.solved ? "Not after the puzzle is solved." : state.history.length ? null : "Nothing to undo yet.";
    if (state.solved) return "The puzzle is solved.";
    return null;
  }
  function trayView() {
    var view = { undo: S.canUndo(state) ? 1 : 0 };
    S.KINDS.forEach(function (k) { view[k] = Math.max(0, state.stock[k]); });
    return view;
  }
  function info(id, text) { toast(text, "info"); } // phones have no hover: the tap explains the slot (R5), in the neutral info toast (R7)
  function infoFor(id) {
    var d = PW.filter(function (x) { return x.id === id; })[0];
    info(id, Power.info(d, trayView(), why(id) || false, { earn: EARN }));
  }

  function render() {
    var bad = {}; S.conflicts(state.grid).forEach(function (b) { bad[b] = true; });
    var wrong = {}; if (marks && marks.state === state) marks.cells.forEach(function (b) { wrong[b] = true; });
    var selVal = sel >= 0 ? state.grid[sel] : 0;
    cells.forEach(function (el, k) {
      var v = state.grid[k];
      el.className = "c" + (S.isGiven(state, k) ? " given" : "") + (bad[k] ? " bad" : "") + (wrong[k] ? " wrong" : "") +
        (k === sel ? " sel" : (sel >= 0 && S.PEERS[sel].indexOf(k) >= 0 ? " peer" : "")) +
        (selVal && v === selVal && k !== sel ? " same" : "");
      el.textContent = "";
      if (v) el.textContent = v;
      else if (state.notes[k]) {
        var n = document.createElement("div"); n.className = "notes";
        for (var d = 1; d <= 9; d++) { var m = document.createElement("i"); m.textContent = state.notes[k] & (1 << d) ? d : ""; n.appendChild(m); }
        el.appendChild(n);
      }
      el.setAttribute("aria-label", "row " + (S.ROW[k] + 1) + " column " + (S.COL[k] + 1) + (v ? " " + v : " empty"));
      el.setAttribute("aria-selected", String(k === sel));
    });
    if (sel >= 0) boardEl.setAttribute("aria-activedescendant", "c" + sel); else boardEl.removeAttribute("aria-activedescendant");
    $("time").textContent = fmt(secs());
    var pure = bests[state.difficulty], helped = assisted[state.difficulty], hasPure = typeof pure === "number";
    // Best is the best pure solve (no power-ups); with none yet it says so (R11), and an assisted time is only a tooltip
    $("best").textContent = hasPure ? fmt(pure) : "none"; $("best").classList.toggle("none", !hasPure);
    $("best").title = hasPure ? "Best pure solve on " + cap(state.difficulty) + ", no power-ups" :
      helped ? "No pure solve yet. Best with power-ups: " + fmt(helped.t) : "No solve yet on " + cap(state.difficulty);
    Array.prototype.forEach.call($("levels").children, function (b) { b.setAttribute("aria-pressed", String(b.dataset.l === state.difficulty)); });
    var counts = new Array(10).fill(0); state.grid.forEach(function (v) { counts[v]++; });
    Array.prototype.forEach.call($("pad").children, function (b) {
      var d = +b.dataset.d, left = 9 - counts[d];
      b.disabled = left <= 0; b.querySelector("small").textContent = left > 0 ? left : "";
      b.setAttribute("aria-label", d + ", " + (left > 0 ? left : "none") + " left");
    });
    $("notes").textContent = "Notes: " + (notesMode ? "on" : "off"); $("notes").setAttribute("aria-pressed", String(notesMode));
    renderTray();
    boardEl.classList.toggle("targeting", !!armed);
    var card = state.solved && !hold && !viewing;
    $("win").hidden = !card;
    // one end-card pattern: while the card shows, its primary replaces the page button, whose space is kept
    $("new").style.visibility = card ? "hidden" : "";
    if (state.solved) {
      var u = S.total(state.used);
      $("win-text").textContent = fmt(secs()) + " on " + cap(state.difficulty) + " · " + (u ? plural(u, "power-up") + " used" : "No power-ups used");
      // a pure record is celebrated in gold; an assisted one is a plain fact, since Best counts only pure solves
      var pure = note && (note.pure === true || note.text === "New best.");
      $("win-best").hidden = !note; $("win-best").textContent = note ? (pure ? "New best." : ASSISTED) : "";
      $("win-best").classList.toggle("best", !!pure);
    }
  }

  function renderTray() {
    var view = trayView();
    Power.tray($("tray"), PW, view, { armed: armed, disabled: function (id) { return why(id) || false; }, earn: EARN, onUse: use, onInfo: info });
    Array.prototype.forEach.call($("tray").children, function (b, i) {
      var d = PW[i]; b.id = "pw-" + d.id; b.title = d.key + ": " + d.label + ". " + d.desc;
    });
    var u = $("pw-undo"), badge = u.querySelector("i"); // Undo is free: always an infinity badge (cold #8: a 1 then
    badge.textContent = "∞";                            // an infinity read as a limit); the slot dims when it cannot act
    u.setAttribute("aria-label", "Undo, free" + (view.undo ? "" : ", not available now") + ". " + PW[0].desc);
  }

  var ASSISTED = "Fastest with power-ups. Best counts only solves without them.";
  function record() { // a fresh solve: keep the best times and say whether this one is a record (R8)
    var d = state.difficulty, pw = S.total(state.used), t = secs();
    note = null;
    if (!pw) { if (typeof bests[d] !== "number" || t < bests[d]) { bests[d] = t; note = { seed: state.seed, pure: true }; } }
    else if (!assisted[d] || t < assisted[d].t) {
      assisted[d] = { t: t, pw: pw };
      note = { seed: state.seed, pure: false };
    }
  }
  function commit(next) {
    if (next === state) return;
    bank(); // the time up to this move belongs to the state before it
    var was = state.solved; state = next;
    if (state.solved && !was) {
      bank(); clearInterval(tick); armed = null; record();
      $("toast").classList.remove("on"); // one channel per event: the end card speaks alone (R7)
      // the finished grid first, bright and plain (no selection), then the card
      sel = -1; marks = null; hold = true; viewing = false; clearTimeout(holdT);
      var solvedState = state;
      holdT = setTimeout(function () { if (state === solvedState && hold) showCard(); }, HOLD); // a newer puzzle wins
    } else if (state.gain && state.gain.length) toast(state.high + " cells filled: +" + PW_NAME[state.gain[0]]);
    save(); render();
  }
  function showCard() { // end the hold, or come back from "See the board"; focus goes to the card's primary
    clearTimeout(holdT); hold = false; viewing = false; render();
    try { $("again").focus({ preventScroll: true }); } catch (e) { /* focus is a nicety */ }
  }
  function seeBoard() {
    viewing = true; render();
    try { boardEl.focus({ preventScroll: true }); } catch (e) { /* focus is a nicety */ }
    toast("Tap the board for the summary.", "info");
  }
  function use(id) {
    if (why(id) || (id !== "undo" && !(state.stock[id] > 0))) return infoFor(id);
    if (id === "undo") { disarm(); return commit(S.undo(state)); }
    if (id === "check") {
      disarm();
      var r = S.check(state);
      if (r.state === state) return toast("Place a digit first", "bad");
      commit(r.state);
      marks = { state: state, cells: r.wrong }; clearTimeout(marksT);
      var mine = marks;
      marksT = setTimeout(function () { if (marks === mine) { marks = null; render(); } }, 2500); // guarded: a newer Check or move wins
      if (r.wrong.length) toast(plural(r.wrong.length, "wrong digit") + " marked", "bad"); else toast("Every placed digit is right");
      return render();
    }
    if (armed === id) { disarm(); return render(); } // tapping an armed slot again cancels
    if (sel >= 0) return target(id, sel);
    armed = id; render(); aimToast(PW_TARGET[id] + (finePointer() ? " (Esc cancels)" : ". Tap " + PW_NAME[id] + " again to cancel"));
  }
  // leaving aiming mode takes its instruction with it (craft #2: a stale "Tap a cell" toast stayed after Esc)
  function disarm() { if (armed) Kit.clearToast(); armed = null; }
  // The aiming instruction never sits on the cells it asks for (craft #1): the kit puts a toast just above the board,
  // and when the page is scrolled so that there is no room, this one moves just below the board instead.
  function aimToast(m) {
    Kit.toast(m);
    try {
      var t = $("toast"), b = boardEl.getBoundingClientRect(), r = t.getBoundingClientRect();
      if (r.bottom > b.top && r.top < b.bottom) t.style.top = Math.max(12, Math.min(window.innerHeight - r.height - 12, b.bottom + 6)) + "px";
    } catch (e) { /* keep the kit position */ }
  }
  function finePointer() { try { return window.matchMedia("(pointer: fine)").matches; } catch (e) { return true; } }
  function target(id, c) {
    var n = id === "reveal" ? S.reveal(state, c) : S.fillBox(state, c);
    if (n === state) return toast(id === "reveal" ? "Nothing to reveal there" : "Nothing to fill in that box", "bad");
    disarm(); commit(n);
    // every power-up says what it did (craft: Reveal was silent); the solving Reveal leaves the card to speak
    if (!state.solved) toast(id === "reveal" ? "Revealed: " + state.grid[c] : "Box notes filled");
  }
  function enter(d) {
    if (state.solved) return;
    if (sel < 0) return toast("Select a cell first", "bad");
    commit(notesMode && d ? S.toggleNote(state, sel, d) : S.place(state, sel, d));
  }
  function move(dr, dc) {
    var r = sel < 0 ? 4 : Math.max(0, Math.min(8, S.ROW[sel] + dr)), c = sel < 0 ? 4 : Math.max(0, Math.min(8, S.COL[sel] + dc));
    sel = r * 9 + c; render();
  }

  boardEl.addEventListener("click", function (e) {
    if (state.solved) { if (hold || viewing) showCard(); return; } // the finished board: a tap shows the summary
    var t = e.target.closest(".c"); if (!t) return;
    sel = +t.dataset.i;
    if (armed) return target(armed, sel);
    render();
  });
  // keyboard: the board is one tab stop; focusing it selects the centre cell so the arrows have somewhere to start
  boardEl.addEventListener("focus", function () { if (sel < 0 && !state.solved) { sel = 40; render(); } });
  var padEl = $("pad");
  for (var d = 1; d <= 9; d++) {
    var b = document.createElement("button"); b.type = "button"; b.dataset.d = d; b.textContent = d;
    b.appendChild(document.createElement("small")); b.addEventListener("click", (function (dd) { return function () { enter(dd); }; })(d));
    padEl.appendChild(b);
  }
  // Difficulty: switching away from a puzzle in progress takes a second tap, like New puzzle (R10)
  var risky = function () { return state.moves > 0 && !state.solved; };
  function disarmLevel() {
    clearTimeout(levelT); levelArm = null;
    Array.prototype.forEach.call($("levels").children, function (b) { b.textContent = cap(b.dataset.l); });
  }
  LEVELS.forEach(function (l) {
    var b = document.createElement("button"); b.type = "button"; b.dataset.l = l; b.textContent = cap(l);
    b.addEventListener("click", function () {
      if (l === state.difficulty && risky()) return toast("Tap New puzzle to restart", "bad");
      if (l !== state.difficulty && risky() && levelArm !== l) {
        disarmLevel(); levelArm = l; b.textContent = "Sure?";
        levelT = setTimeout(disarmLevel, 3000); return;
      }
      fresh(l);
    });
    $("levels").appendChild(b);
  });
  $("notes").addEventListener("click", function () { notesMode = !notesMode; render(); });
  $("erase").addEventListener("click", function () { enter(0); });
  Kit.twoStep($("new"), risky, function () { fresh(state.difficulty); }, "Sure? This ends the puzzle");
  $("again").addEventListener("click", function () { fresh(state.difficulty); });
  $("win-view").addEventListener("click", seeBoard);

  window.addEventListener("keydown", function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var k = e.key, tag = (e.target && e.target.tagName) || "";
    // R17: a focused link or form field keeps every key (Enter on a games-row link navigates); a focused button keeps
    // Enter and Space (they press it, R9). Digits and arrows still reach the board after a click on the pad.
    if (tag === "A" || tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
    if (tag === "BUTTON" && (k === "Enter" || k === " ")) return;
    if (state.solved && (hold || viewing) && (k === "Escape" || k === "Enter" || k === " ")) { e.preventDefault(); return showCard(); }
    if (k >= "1" && k <= "9") return enter(+k);
    if (k === "Backspace" || k === "Delete" || k === "0") { e.preventDefault(); return enter(0); }
    var arrows = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    if (arrows[k]) { e.preventDefault(); return move(arrows[k][0], arrows[k][1]); }
    if (k === "n" || k === "N") { notesMode = !notesMode; return render(); }
    if (k === "u" || k === "U") return use("undo");
    if (k === "h" || k === "H") return use("reveal");
    if (k === "c" || k === "C") return use("check");
    if (k === "f" || k === "F") return use("cands");
    if (k === "Escape") { if (armed) disarm(); else sel = -1; render(); }
  });
  // save when the page is hidden or closed (a reload fires pagehide), and resume the clock when it is back
  document.addEventListener("visibilitychange", function () { bank(); save(); });
  window.addEventListener("pagehide", function () { bank(); save(); });

  if (!state) { state = S.newState(S.generate(freshSeed(), level)); save(); }
  startTimer(); render();
  // Screenshot hook (tools/shots.cjs): a fixed puzzle with a few moves and notes. Not reachable from the UI.
  window.__demo = function () {
    var st = S.newState(S.generate(2026, "medium")), empt = st.puzzle.map(function (v, k) { return v ? -1 : k; }).filter(function (k) { return k >= 0; });
    for (var k = 0; k < 8; k++) st = S.place(st, empt[k], st.solution[empt[k]]);
    st = S.toggleNote(st, empt[10], 2); st = S.toggleNote(st, empt[10], 7); st = S.toggleNote(st, empt[11], 4);
    st.stock = { reveal: 1, check: 2, cands: 1 }; // what a player has earned by this point
    clearInterval(tick); last = null; state = st; elapsed = 134; sel = empt[8]; render();
  };
  window.__sudoku = { get state() { return state; }, set state(s) { state = S.upgrade(s); render(); }, select: function (i) { sel = i; render(); },
                      get elapsed() { return elapsed; } };
})();
