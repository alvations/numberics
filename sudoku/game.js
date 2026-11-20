/* SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 alvations (Melon Lab)
 * Numberics Sudoku: browser client. sudoku/engine.js owns every rule. */
(function () {
  "use strict";
  var S = window.NumbericsSudoku, Kit = window.NumbericsKit, Power = window.NumbericsPower;
  var LEVELS = ["easy", "medium", "hard"];
  // Same key and shape as before power-ups ({state, elapsed, best}); `assisted` is new and optional.
  var store = Kit.store("numberics_sudoku_v1");
  function save() { store.save({ state: state, elapsed: elapsed, best: bests, assisted: assisted }); }
  // Tray slots (keys U, H, C, F; digits 1-9 belong to the board). Undo is free; the rest are charged.
  var PW = [
    { id: "undo", label: "Undo", title: "Undo the last change. Free and unlimited (U)" },
    { id: "reveal", label: "Reveal", title: "Show the right digit for one cell (H)" },
    { id: "check", label: "Check", title: "Mark wrong digits, briefly (C)" },
    { id: "cands", label: "Candidates", title: "Fill the notes of one 3x3 box (F)" },
  ];
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
  var elapsed = state && saved.elapsed > 0 ? saved.elapsed : 0;
  var level = state ? state.difficulty : "medium";
  var sel = -1, notesMode = false, newArmed = null, tick = null;
  var armed = null;            // "reveal" | "cands" while a power-up waits for a cell
  var marks = null, marksT = null; // Check result: {state, cells} shown briefly, only on the state it checked

  var $ = function (id) { return document.getElementById(id); };
  var boardEl = $("board"), cells = [];
  for (var i = 0; i < 81; i++) {
    var c = document.createElement("div");
    c.className = "c"; c.setAttribute("role", "gridcell"); c.dataset.i = i; c.tabIndex = -1;
    boardEl.appendChild(c); cells.push(c);
  }

  function fresh(diff) {
    level = diff; sel = -1; elapsed = 0; armed = null; marks = null; $("win").hidden = true;
    state = S.newState(S.generate(freshSeed(), diff)); save(); startTimer(); render();
  }
  var fmt = Kit.clock;
  function startTimer() {
    clearInterval(tick);
    if (state.solved) return;
    tick = setInterval(function () {
      if (document.hidden || state.solved) return; // pause in a background tab
      elapsed++; $("time").textContent = fmt(elapsed); if (elapsed % 5 === 0) save();
    }, 1000);
  }
  function toast(m) { Kit.toast(m); }
  function plural(n, w) { return n + " " + w + (n === 1 ? "" : "s"); }

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
    });
    $("diff-label").textContent = state.difficulty;
    $("time").textContent = fmt(elapsed);
    var pure = bests[state.difficulty], helped = assisted[state.difficulty];
    $("best").textContent = pure ? fmt(pure) : helped ? fmt(helped.t) + " +" + helped.pw : "-";
    $("best").title = pure ? "Best pure solve, no power-ups" : helped ? "Best solve, with " + plural(helped.pw, "power-up") : "";
    Array.prototype.forEach.call($("levels").children, function (b) { b.setAttribute("aria-pressed", String(b.dataset.l === state.difficulty)); });
    var counts = new Array(10).fill(0); state.grid.forEach(function (v) { counts[v]++; });
    Array.prototype.forEach.call($("pad").children, function (b) {
      var d = +b.dataset.d; b.disabled = counts[d] >= 9; b.querySelector("small").textContent = 9 - counts[d] > 0 ? 9 - counts[d] : "";
    });
    $("notes").textContent = "Notes: " + (notesMode ? "on" : "off"); $("notes").setAttribute("aria-pressed", String(notesMode));
    renderTray();
    boardEl.classList.toggle("targeting", !!armed);
    $("win").hidden = !state.solved;
    if (state.solved) { var u = S.total(state.used); $("win-text").textContent = fmt(elapsed) + " on " + state.difficulty + (u ? " with " + plural(u, "power-up") : ", pure: no power-ups"); }
  }

  function renderTray() {
    var view = { undo: state.history.length ? 1 : 0 };
    S.KINDS.forEach(function (k) { view[k] = Math.max(0, state.stock[k]); });
    Power.tray($("tray"), PW, view, { armed: armed, disabled: function (id) { return state.solved && id !== "undo"; }, onUse: use });
    var u = $("tray").firstChild; // Undo is free: an infinity badge instead of a count
    u.querySelector("i").textContent = "\u221e"; u.setAttribute("aria-label", "Undo, free. " + PW[0].title);
    Array.prototype.forEach.call($("tray").children, function (b, i) { b.id = "pw-" + PW[i].id; b.title = PW[i].title; });
  }

  function commit(next) {
    if (next === state) return;
    var was = state.solved; state = next;
    if (state.solved && !was) {
      clearInterval(tick); armed = null;
      var d = state.difficulty, pw = S.total(state.used);
      if (!pw) { if (!bests[d] || elapsed < bests[d]) bests[d] = elapsed; } // a pure run: no power-ups at all
      else if (!assisted[d] || elapsed < assisted[d].t) assisted[d] = { t: elapsed, pw: pw };
    } else if (state.gain && state.gain.length) toast("Unit complete: +1 " + PW_NAME[state.gain[0]]);
    save(); render();
  }
  function use(id) {
    if (id === "undo") { armed = null; return commit(S.undo(state)); }
    if (state.solved) return;
    if (!(state.stock[id] > 0)) return toast("No " + PW_NAME[id] + " left. Finish a row, column or box to earn one");
    if (id === "check") {
      armed = null;
      var r = S.check(state);
      if (r.state === state) return toast("Place a digit first");
      commit(r.state);
      marks = { state: state, cells: r.wrong }; clearTimeout(marksT);
      var mine = marks;
      marksT = setTimeout(function () { if (marks === mine) { marks = null; render(); } }, 2500); // guarded: a newer Check or move wins
      toast(r.wrong.length ? plural(r.wrong.length, "wrong digit") + " marked" : "Every placed digit is right");
      return render();
    }
    if (armed === id) { armed = null; return render(); } // tapping an armed slot again cancels
    if (sel >= 0) return target(id, sel);
    armed = id; toast(PW_TARGET[id] + " (Esc cancels)"); render();
  }
  function target(id, c) {
    var n = id === "reveal" ? S.reveal(state, c) : S.fillBox(state, c);
    if (n === state) return toast(id === "reveal" ? "Nothing to reveal there" : "Nothing to fill in that box");
    armed = null; commit(n);
  }
  function enter(d) {
    if (sel < 0) return toast("Select a cell first");
    commit(notesMode && d ? S.toggleNote(state, sel, d) : S.place(state, sel, d));
  }
  function move(dr, dc) {
    var r = sel < 0 ? 4 : Math.max(0, Math.min(8, S.ROW[sel] + dr)), c = sel < 0 ? 4 : Math.max(0, Math.min(8, S.COL[sel] + dc));
    sel = r * 9 + c; render();
  }

  boardEl.addEventListener("click", function (e) {
    var t = e.target.closest(".c"); if (!t) return;
    sel = +t.dataset.i;
    if (armed) return target(armed, sel);
    render();
  });
  var padEl = $("pad");
  for (var d = 1; d <= 9; d++) {
    var b = document.createElement("button"); b.type = "button"; b.dataset.d = d; b.textContent = d;
    b.appendChild(document.createElement("small")); b.addEventListener("click", (function (dd) { return function () { enter(dd); }; })(d));
    padEl.appendChild(b);
  }
  LEVELS.forEach(function (l) {
    var b = document.createElement("button"); b.type = "button"; b.dataset.l = l; b.textContent = l[0].toUpperCase() + l.slice(1);
    b.addEventListener("click", function () { if (l !== state.difficulty || state.solved || !state.moves) fresh(l); else toast("Tap New puzzle to restart"); });
    $("levels").appendChild(b);
  });
  $("notes").addEventListener("click", function () { notesMode = !notesMode; render(); });
  $("erase").addEventListener("click", function () { enter(0); });
  $("new").addEventListener("click", function () {
    var b = $("new");
    if (state.moves > 0 && !state.solved && !newArmed) {
      b.textContent = "Sure? This ends the puzzle"; newArmed = setTimeout(function () { newArmed = null; b.textContent = "New puzzle"; }, 3000); return;
    }
    clearTimeout(newArmed); newArmed = null; b.textContent = "New puzzle"; fresh(state.difficulty);
  });
  $("again").addEventListener("click", function () { fresh(state.difficulty); });

  window.addEventListener("keydown", function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var k = e.key;
    if (k >= "1" && k <= "9") return enter(+k);
    if (k === "Backspace" || k === "Delete" || k === "0") { e.preventDefault(); return enter(0); }
    var arrows = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    if (arrows[k]) { e.preventDefault(); return move(arrows[k][0], arrows[k][1]); }
    if (k === "n" || k === "N") { notesMode = !notesMode; return render(); }
    if (k === "u" || k === "U") return use("undo");
    if (k === "h" || k === "H") return use("reveal");
    if (k === "c" || k === "C") return use("check");
    if (k === "f" || k === "F") return use("cands");
    if (k === "Escape") { if (armed) armed = null; else sel = -1; render(); }
  });
  document.addEventListener("visibilitychange", function () { if (!document.hidden) save(); });

  if (!state) { state = S.newState(S.generate(freshSeed(), level)); save(); }
  startTimer(); render();
  // Screenshot hook (tools/shots.cjs): a fixed puzzle with a few moves and notes. Not reachable from the UI.
  window.__demo = function () {
    var st = S.newState(S.generate(2026, "medium")), empt = st.puzzle.map(function (v, k) { return v ? -1 : k; }).filter(function (k) { return k >= 0; });
    for (var k = 0; k < 8; k++) st = S.place(st, empt[k], st.solution[empt[k]]);
    st = S.toggleNote(st, empt[10], 2); st = S.toggleNote(st, empt[10], 7); st = S.toggleNote(st, empt[11], 4);
    st.stock = { reveal: 1, check: 2, cands: 1 }; // what a player has earned by this point
    clearInterval(tick); state = st; elapsed = 134; sel = empt[8]; render();
  };
  window.__sudoku = { get state() { return state; }, set state(s) { state = S.upgrade(s); render(); }, select: function (i) { sel = i; render(); } };
})();
