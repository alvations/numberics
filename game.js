/* SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 alvations (Melon Lab)
 * Numberics Endless: browser client. The engine (engine.js) owns every rule;
 * this file only draws, listens, and remembers. */
(function () {
  "use strict";
  var N = window.Numberics;
  var KEY = "numberics_endless_v1";
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var ANIM = reduce ? 0 : 110;

  // ---- storage: always try/catch, degrade to memory (sandboxes throw) ----
  var mem = {};
  function load() {
    try { var v = window.localStorage.getItem(KEY); if (v) return JSON.parse(v); } catch (e) { /* fall through */ }
    return mem[KEY] ? JSON.parse(mem[KEY]) : null;
  }
  function save(obj) {
    var json = JSON.stringify(obj);
    mem[KEY] = json;
    try { window.localStorage.setItem(KEY, json); } catch (e) { /* in-memory only */ }
  }

  function valid(s) {
    return s && s.size === 4 && Array.isArray(s.grid) && s.grid.length === 16 &&
      s.grid.every(function (v) { return Number.isInteger(v) && v >= 0; }) &&
      s.power && typeof s.score === "number";
  }
  function freshSeed() {
    try { var a = new Uint32Array(1); window.crypto.getRandomValues(a); return a[0]; } catch (e) { return (Date.now() >>> 0); }
  }

  var saved = load();
  var best = { score: (saved && saved.bestScore) || 0, top: (saved && saved.bestTop) || 0 };
  var state = saved && valid(saved.state) ? saved.state : N.newGame(freshSeed());
  var targeting = null;           // {name, picks:[]} while a power-up waits for a target
  var timer = null, pendingFx = null, newArmed = null;
  var els = [];                   // cell index -> tile element

  var $ = function (id) { return document.getElementById(id); };
  var boardEl = $("board"), tilesEl = $("tiles"), cellsEl = $("cells");
  for (var i = 0; i < 16; i++) cellsEl.appendChild(document.createElement("div"));

  function persist() {
    best.score = Math.max(best.score, state.score); best.top = Math.max(best.top, state.top);
    save({ state: state, bestScore: best.score, bestTop: best.top });
  }
  function fmt(n) { return n.toLocaleString("en-US"); }

  function setLabel(el, level) {
    var l = N.label(level);
    el.textContent = "";
    if (l.indexOf("2^") === 0) {
      el.appendChild(document.createTextNode("2"));
      var sup = document.createElement("sup"); sup.textContent = l.slice(2); el.appendChild(sup);
      el.setAttribute("data-len", String(Math.min(6, 1 + l.length - 1)));
    } else { el.textContent = l; el.setAttribute("data-len", String(l.length)); }
    el.setAttribute("aria-label", "tile " + (l.indexOf("2^") === 0 ? "2 to the " + l.slice(2) : l));
  }
  function place(el, cell) { el.style.setProperty("--r", Math.floor(cell / 4)); el.style.setProperty("--c", cell % 4); }

  function render(fx) {
    tilesEl.textContent = ""; els = [];
    state.grid.forEach(function (lv, cell) {
      if (!lv) return;
      var el = document.createElement("div");
      el.className = "tile" + (lv === 1 ? " lo" : lv === 2 ? " lo2" : "");
      el.style.setProperty("--h", ((lv * 43 + 30) % 360)); // endless palette: hue cycles forever
      place(el, cell); setLabel(el, lv);
      if (fx && fx.merged && fx.merged[cell]) el.classList.add("pop");
      if (fx && fx.spawned === cell) el.classList.add("new");
      tilesEl.appendChild(el); els[cell] = el;
    });
    $("score").textContent = fmt(state.score);
    $("best").textContent = fmt(Math.max(best.score, state.score));
    $("top").textContent = state.top ? N.label(state.top) : "-";
    renderTray();
    Array.prototype.forEach.call(cellsEl.children, function (c, i) {
      c.classList.toggle("sel", !!(targeting && targeting.picks.indexOf(i) >= 0));
    });
    boardEl.classList.toggle("targeting", !!targeting);
    var over = $("over");
    over.hidden = !state.over;
    if (state.over) $("over-text").textContent = "Top tile " + N.label(state.top) + " · score " + fmt(state.score);
  }

  var PW = { undo: "Undo", smash: "Smash", swap: "Swap", boost: "Boost" };
  var PW_HINT = { smash: "Tap a tile to smash it.", boost: "Tap a tile to double it.",
                  swap: "Tap two cells to swap them." };
  function renderTray() {
    var tray = $("tray"); tray.textContent = "";
    N.POWERS.forEach(function (p, i) {
      var b = document.createElement("button");
      b.type = "button"; b.className = "pw" + (targeting && targeting.name === p ? " armed" : "");
      b.disabled = !state.power[p] || (p === "undo" && !state.prev);
      b.appendChild(document.createTextNode(PW[p]));
      var n = document.createElement("i"); n.textContent = state.power[p]; b.appendChild(n);
      b.title = (i + 1) + ": " + PW[p];
      b.addEventListener("click", function () { activate(p); });
      tray.appendChild(b);
    });
    $("hint").textContent = targeting ? PW_HINT[targeting.name] + " (Esc cancels)"
      : (!N.canMove(state) && !state.over ? "Stuck. Use a power-up to keep going." : "");
  }

  var toastT = null;
  function toast(msg) {
    var t = $("toast"); t.textContent = msg; t.classList.add("on");
    clearTimeout(toastT); toastT = setTimeout(function () { t.classList.remove("on"); }, 2200);
  }

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
  var KEYS = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down", a: "left", d: "right", w: "up", s: "down" };
  window.addEventListener("keydown", function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === "Escape") { targeting = null; return render(); }
    var pi = ["1", "2", "3", "4"].indexOf(e.key);
    if (pi >= 0) return activate(N.POWERS[pi]);
    if (e.key === "u") return activate("undo");
    var d = KEYS[e.key] || KEYS[(e.key || "").toLowerCase()];
    if (d) { e.preventDefault(); doMove(d); }
  });
  boardEl.addEventListener("click", pick);
  var sx = 0, sy = 0, touching = false;
  boardEl.addEventListener("touchstart", function (e) { var t = e.changedTouches[0]; sx = t.clientX; sy = t.clientY; touching = true; }, { passive: true });
  boardEl.addEventListener("touchend", function (e) {
    if (!touching) return; touching = false;
    var t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return; // a tap, not a swipe
    doMove(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up"));
  }, { passive: true });

  // ---- new game: two-step instead of a blocking confirm() dialog ----
  function startNew() {
    flush(); targeting = null;
    state = N.newGame(freshSeed()); persist(); render();
  }
  $("new").addEventListener("click", function () {
    var b = $("new");
    if (state.moves > 0 && !state.over && !newArmed) {
      b.textContent = "Sure? This ends the run"; newArmed = setTimeout(function () { newArmed = null; b.textContent = "New game"; }, 3000); return;
    }
    clearTimeout(newArmed); newArmed = null; b.textContent = "New game"; startNew();
  });
  $("again").addEventListener("click", startNew);

  render();
  window.__numberics = { get state() { return state; }, set state(s) { state = s; render(); }, render: render };
})();
