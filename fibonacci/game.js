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
  function valid(s) {
    return !!s && s.size === 4 && Array.isArray(s.grid) && s.grid.length === 16 && s.grid.every(int) &&
      !!s.power && N.POWERS.every(function (p) { return int(s.power[p]); }) &&
      typeof s.score === "number" && int(s.top) && int(s.moves) && typeof s.seed === "number";
  }

  var saved = store.load();
  var best = { score: (saved && +saved.bestScore) || 0, top: (saved && +saved.bestTop) || 0 };
  var state = saved && valid(saved.state) ? saved.state : N.newGame(K.freshSeed());
  var targeting = null;           // {name, picks:[]} while a power-up waits for a target
  var timer = null, pendingFx = null;
  var els = [];                   // cell index -> tile element

  var $ = function (id) { return document.getElementById(id); };
  var boardEl = $("board"), tilesEl = $("tiles"), cellsEl = $("cells");
  for (var i = 0; i < 16; i++) cellsEl.appendChild(document.createElement("div"));

  function persist() {
    best.score = Math.max(best.score, state.score); best.top = Math.max(best.top, state.top);
    store.save({ state: state, bestScore: best.score, bestTop: best.top });
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
      el.className = "tile" + (lv === 1 ? " lo" : lv === 2 ? " lo2" : "");
      el.style.setProperty("--h", K.hue(lv)); // endless palette: hue cycles forever
      place(el, cell); setLabel(el, lv);
      if (fx && fx.merged && fx.merged[cell]) el.classList.add("pop");
      if (fx && fx.spawned === cell) el.classList.add("new");
      tilesEl.appendChild(el); els[cell] = el;
    });
    $("score").textContent = fmt(state.score);
    $("best").textContent = fmt(Math.max(best.score, state.score));
    $("top").textContent = state.top ? N.label(state.top) : "-";
    renderTray();
    Array.prototype.forEach.call(cellsEl.children, function (c, k) {
      c.classList.toggle("sel", !!(targeting && targeting.picks.indexOf(k) >= 0));
    });
    boardEl.classList.toggle("targeting", !!targeting);
    var over = $("over");
    over.hidden = !state.over;
    if (state.over) $("over-text").textContent = "Top tile " + N.label(state.top) + " · score " + fmt(state.score);
  }

  var PW = { undo: "Undo", smash: "Smash", swap: "Swap", boost: "Boost" };
  var DEFS = [
    { id: "undo", label: "Undo", title: "Rewind the last move" },
    { id: "smash", label: "Smash", title: "Remove one tile" },
    { id: "swap", label: "Swap", title: "Exchange two cells" },
    { id: "boost", label: "Boost", title: "Move a tile to the next Fibonacci number" },
  ];
  var PW_HINT = { smash: "Tap a tile to smash it.", boost: "Tap a tile to step it to the next Fibonacci number.",
                  swap: "Tap two cells to swap them." };
  function renderTray() {
    P.tray($("tray"), DEFS, state.power, {
      armed: targeting && targeting.name,
      disabled: function (id) { return id === "undo" && !state.prev; },
      onUse: activate,
    });
    $("hint").textContent = targeting ? PW_HINT[targeting.name] + " (Esc cancels)"
      : (!N.canMove(state) && !state.over ? "Stuck. Use a power-up to keep going." : "");
  }
  function toast(msg) { K.toast(msg); }

  // ---- animation: slide the old tiles, then redraw authoritatively ----
  function flush() { if (timer !== null) { clearTimeout(timer); timer = null; finalize(); } }
  function finalize() { var fx = pendingFx; pendingFx = null; render(fx); }

  function doMove(dir) {
    flush();
    if (targeting) return;
    var r = N.move(state, dir);
    if (!r.moved) return;
    var merged = {};
    r.trace.forEach(function (t) {
      var el = els[t.from]; if (el) place(el, t.to);
      if (t.merge) merged[t.to] = true;
    });
    state = r.state; pendingFx = { merged: merged, spawned: r.spawned };
    if (r.milestones.length) {
      var top = r.milestones[r.milestones.length - 1];
      toast("New tile " + N.label(top) + (r.awarded.length ? "  +" + PW[r.awarded[0].power] : ""));
    }
    persist();
    if (ANIM) { var gen = state.moves; timer = setTimeout(function () { if (state.moves === gen) { timer = null; finalize(); } }, ANIM); }
    else finalize();
  }

  // ---- power-ups ----
  function activate(name) {
    flush();
    if (targeting && targeting.name === name) { targeting = null; return render(); }
    targeting = null;
    if (name === "undo") {
      var u = N.use(state, "undo");
      if (u.ok) { state = u.state; persist(); toast("Rewound one move"); }
      return render();
    }
    if (!state.power[name]) return render();
    targeting = { name: name, picks: [] }; render();
  }
  function cellAt(ev) {
    var rect = boardEl.getBoundingClientRect(), x = ev.clientX - rect.left, y = ev.clientY - rect.top;
    var c = Math.floor(x / rect.width * 4), r = Math.floor(y / rect.height * 4);
    return (c < 0 || c > 3 || r < 0 || r > 3) ? -1 : r * 4 + c;
  }
  function pick(ev) {
    if (!targeting) return;
    var cell = cellAt(ev); if (cell < 0) return;
    targeting.picks.push(cell);
    var need = targeting.name === "swap" ? 2 : 1;
    if (targeting.picks.length < need) return render();
    var res = N.use(state, targeting.name, targeting.picks[0], targeting.picks[1]);
    var name = targeting.name;
    if (res.ok) { state = res.state; targeting = null; persist(); toast(PW[name] + "!"); }
    else { targeting.picks = []; toast("Pick a valid target"); }
    render();
  }

  // ---- input ----
  window.addEventListener("keydown", function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === "Escape") { targeting = null; return render(); }
    var pi = ["1", "2", "3", "4"].indexOf(e.key);
    if (pi >= 0) return activate(N.POWERS[pi]);
    if (e.key === "u") return activate("undo");
    var d = K.arrowKey(e);
    if (d) { e.preventDefault(); doMove(d); }
  });
  boardEl.addEventListener("click", pick);
  K.swipe(boardEl, doMove);

  // ---- new game: two-step instead of a blocking confirm() dialog ----
  function startNew() {
    flush(); targeting = null;
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
    state = s; render();
  };
  window.__fibonacci = { get state() { return state; }, set state(s) { state = s; render(); }, render: render };
})();
