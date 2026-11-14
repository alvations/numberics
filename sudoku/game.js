/* SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 alvations (Melon Lab)
 * Numberics Sudoku: browser client. sudoku/engine.js owns every rule. */
(function () {
  "use strict";
  var S = window.NumbericsSudoku;
  var KEY = "numberics_sudoku_v1";
  var LEVELS = ["easy", "medium", "hard"];

  var mem = {};
  function load() {
    try { var v = window.localStorage.getItem(KEY); if (v) return JSON.parse(v); } catch (e) { /* fall through */ }
    return mem[KEY] ? JSON.parse(mem[KEY]) : null;
  }
  function save() {
    var json = JSON.stringify({ state: state, elapsed: elapsed, best: bests });
    mem[KEY] = json;
    try { window.localStorage.setItem(KEY, json); } catch (e) { /* in-memory only */ }
  }
  function ok81(a) { return Array.isArray(a) && a.length === 81 && a.every(function (v) { return Number.isInteger(v) && v >= 0; }); }
  function validState(s) {
    return s && ok81(s.puzzle) && ok81(s.solution) && ok81(s.grid) && ok81(s.notes) && Array.isArray(s.history) && LEVELS.indexOf(s.difficulty) >= 0;
  }
  function freshSeed() { try { var a = new Uint32Array(1); window.crypto.getRandomValues(a); return a[0]; } catch (e) { return Date.now() >>> 0; } }

  var saved = load();
  var bests = (saved && saved.best) || {};
  var state = saved && validState(saved.state) ? saved.state : null;
  var elapsed = state && saved.elapsed > 0 ? saved.elapsed : 0;
  var level = state ? state.difficulty : "medium";
  var sel = -1, notesMode = false, newArmed = null, tick = null, toastT = null;

  var $ = function (id) { return document.getElementById(id); };
  var boardEl = $("board"), cells = [];
  for (var i = 0; i < 81; i++) {
    var c = document.createElement("div");
    c.className = "c"; c.setAttribute("role", "gridcell"); c.dataset.i = i; c.tabIndex = -1;
    boardEl.appendChild(c); cells.push(c);
  }

  function fresh(diff) {
    level = diff; sel = -1; elapsed = 0; $("win").hidden = true;
    state = S.newState(S.generate(freshSeed(), diff)); save(); startTimer(); render();
  }
  function fmt(t) { return Math.floor(t / 60) + ":" + ("0" + (t % 60)).slice(-2); }
  function startTimer() {
    clearInterval(tick);
    if (state.solved) return;
    tick = setInterval(function () {
      if (document.hidden || state.solved) return; // pause in a background tab
      elapsed++; $("time").textContent = fmt(elapsed); if (elapsed % 5 === 0) save();
    }, 1000);
  }
  function toast(m) { var t = $("toast"); t.textContent = m; t.classList.add("on"); clearTimeout(toastT); toastT = setTimeout(function () { t.classList.remove("on"); }, 1800); }

  function render() {
    var bad = {}; S.conflicts(state.grid).forEach(function (b) { bad[b] = true; });
    var selVal = sel >= 0 ? state.grid[sel] : 0;
    cells.forEach(function (el, k) {
      var v = state.grid[k];
      el.className = "c" + (S.isGiven(state, k) ? " given" : "") + (bad[k] ? " bad" : "") +
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
    $("best").textContent = bests[state.difficulty] ? fmt(bests[state.difficulty]) : "-";
    Array.prototype.forEach.call($("levels").children, function (b) { b.setAttribute("aria-pressed", String(b.dataset.l === state.difficulty)); });
    var counts = new Array(10).fill(0); state.grid.forEach(function (v) { counts[v]++; });
    Array.prototype.forEach.call($("pad").children, function (b) {
      var d = +b.dataset.d; b.disabled = counts[d] >= 9; b.querySelector("small").textContent = 9 - counts[d] > 0 ? 9 - counts[d] : "";
    });
    $("notes").textContent = "Notes: " + (notesMode ? "on" : "off"); $("notes").setAttribute("aria-pressed", String(notesMode));
    $("undo").disabled = !state.history.length;
    $("win").hidden = !state.solved;
    if (state.solved) $("win-text").textContent = fmt(elapsed) + " on " + state.difficulty + (state.hints ? " with " + state.hints + " hint" + (state.hints > 1 ? "s" : "") : ", no hints");
  }

  function commit(next) {
    if (next === state) return;
    var was = state.solved; state = next;
    if (state.solved && !was) {
      clearInterval(tick);
      if (!state.hints && (!bests[state.difficulty] || elapsed < bests[state.difficulty])) bests[state.difficulty] = elapsed; // best times count only hint-free solves
    }
    save(); render();
  }
  function enter(d) {
    if (sel < 0) return toast("Select a cell first");
    commit(notesMode && d ? S.toggleNote(state, sel, d) : S.place(state, sel, d));
  }
  function move(dr, dc) {
    var r = sel < 0 ? 4 : Math.max(0, Math.min(8, S.ROW[sel] + dr)), c = sel < 0 ? 4 : Math.max(0, Math.min(8, S.COL[sel] + dc));
    sel = r * 9 + c; render();
  }

  boardEl.addEventListener("click", function (e) { var t = e.target.closest(".c"); if (t) { sel = +t.dataset.i; render(); } });
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
  $("undo").addEventListener("click", function () { commit(S.undo(state)); });
  $("erase").addEventListener("click", function () { enter(0); });
  $("hint").addEventListener("click", function () {
    if (sel < 0) return toast("Select a cell first");
    var n = S.hint(state, sel); if (n === state) return toast("Nothing to reveal there"); commit(n);
  });
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
    if (k === "u" || k === "U") return commit(S.undo(state));
    if (k === "h" || k === "H") { $("hint").click(); }
    if (k === "Escape") { sel = -1; render(); }
  });
  document.addEventListener("visibilitychange", function () { if (!document.hidden) save(); });

  if (!state) { state = S.newState(S.generate(freshSeed(), level)); save(); }
  startTimer(); render();
  window.__sudoku = { get state() { return state; }, set state(s) { state = s; render(); }, select: function (i) { sel = i; render(); } };
})();
