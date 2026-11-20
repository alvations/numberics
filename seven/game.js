/* SPDX-License-Identifier: Apache-2.0 | Copyright 2026 alvations (Melon Lab)
 * Numberics Seven: browser client. engine.js owns every rule; this file draws, listens and remembers.
 * A drop returns a wave-by-wave trace; the client plays it one step at a time (instantly under reduced motion). */
(function () {
  "use strict";
  var N = window.NumbericsSeven, K = window.NumbericsKit, P = window.NumbericsPower;
  var W = N.W, H = N.H;
  var store = K.store("numberics_seven_v1");
  var STEP = K.reducedMotion() ? 0 : 170;

  // ---- saved data: one run per mode, best score per mode ----
  function validState(s) {
    return !!s && typeof s === "object" && N.MODES.indexOf(s.mode) >= 0 && Array.isArray(s.grid) && s.grid.length === W * H &&
      s.grid.every(function (v) { return Number.isInteger(v) && v >= 0 && v <= 9; }) &&
      Number.isInteger(s.next) && s.next >= 1 && s.next <= 9 && typeof s.score === "number" && s.power &&
      N.POWERS.every(function (p) { return Number.isInteger(s.power[p]) && s.power[p] >= 0 && s.power[p] <= P.CAP; });
  }
  var saved = store.load() || {};
  var runs = {}, best = { classic: 0, blitz: 0, daily: 0 };
  var today = K.daySeed();
  N.MODES.forEach(function (m) {
    var r = saved.runs && saved.runs[m];
    if (validState(r) && r.mode === m && (m !== "daily" || saved.day === today)) runs[m] = r;
    var b = saved.best && saved.best[m]; if (typeof b === "number" && b >= 0) best[m] = b;
  });
  var mode = N.MODES.indexOf(saved.mode) >= 0 ? saved.mode : "classic";
  function fresh(m) { return N.newGame(m === "daily" ? today : K.freshSeed(), m); }
  var state = runs[mode] || fresh(mode);
  var cursor = 3, targeting = null;
  var timers = [], busy = false, gen = 0, shownScore = state.score;

  var $ = function (id) { return document.getElementById(id); };
  var boardEl = $("board"), discsEl = $("discs"), cellsEl = $("cells");
  for (var i = 0; i < W * H; i++) { var d = document.createElement("div"); if (i < W) d.className = "top"; cellsEl.appendChild(d); }
  var els = {};

  function persist() {
    runs[mode] = state; best[mode] = Math.max(best[mode], state.score);
    store.save({ mode: mode, runs: runs, best: best, day: today });
  }

  // ---- drawing ----
  function paint(el, v) {
    el.classList.remove("egg", "cracked", "tile");
    el.textContent = "";
    if (v === N.EGG) { el.classList.add("egg"); el.setAttribute("aria-label", "egg"); }
    else if (v === N.CRACKED) { el.classList.add("cracked"); el.setAttribute("aria-label", "cracked egg"); }
    else { el.classList.add("tile"); el.style.setProperty("--h", K.hue(v)); el.textContent = String(v); el.setAttribute("aria-label", "disc " + v); }
  }
  function place(el, cell) { el.style.setProperty("--r", Math.floor(cell / W)); el.style.setProperty("--c", cell % W); }
  function makeDisc(v, cell, cls) {
    var el = document.createElement("div"); el.className = "disc" + (cls ? " " + cls : "");
    paint(el, v); place(el, cell); discsEl.appendChild(el); return el;
  }
  function mini(v) {
    var m = document.createElement("em"); m.className = "mini" + (v === N.EGG ? " egg" : v === N.CRACKED ? " cracked" : "");
    if (v >= 1 && v <= 7) { m.style.setProperty("--h", K.hue(v)); m.textContent = String(v); }
    m.setAttribute("aria-label", v === N.EGG ? "egg" : "disc " + v);
    return m;
  }
  function drawGrid(grid) {
    discsEl.textContent = ""; els = {};
    grid.forEach(function (v, cell) { if (v) els[cell] = makeDisc(v, cell); });
  }
  function drawGhost() {
    var old = discsEl.querySelector(".ghost"); if (old) old.remove();
    if (state.over || targeting || busy) return;
    var r = N.landing(state.grid, cursor); if (r < 0) return;
    var g = makeDisc(state.next, r * W + cursor, "ghost"); g.setAttribute("aria-hidden", "true");
  }
  function drawCursor() {
    Array.prototype.forEach.call(cellsEl.children, function (c, i) { c.classList.toggle("col", !targeting && !state.over && i % W === cursor); });
  }
  var DEFS = [
    { id: "undo", label: "Undo", title: "take back the last drop" },
    { id: "smash", label: "Smash", title: "remove one disc" },
    { id: "hold", label: "Hold", title: "keep the next disc for later" },
    { id: "crack", label: "Crack", title: "crack every egg touching a disc" },
  ];
  var HINT = { smash: "Tap a disc to smash it, or Enter for the top of this column." };
  function usable(id) {
    if (id === "undo") return !!state.prev;
    if (state.over) return false;
    if (id === "crack") return N.crackable(state.grid);
    if (id === "smash") return state.grid.some(Boolean);
    return true;
  }
  function renderTray() {
    P.tray($("tray"), DEFS, state.power, {
      armed: targeting, disabled: function (id) { return !usable(id); }, onUse: activate,
    });
    if (state.held) $("tray").children[2].insertBefore(mini(state.held), $("tray").children[2].lastChild);
  }
  function renderChrome() {
    $("score").textContent = K.fmt(shownScore);
    $("best").textContent = K.fmt(Math.max(best[mode], state.score));
    var nx = $("next"); nx.textContent = ""; nx.appendChild(mini(state.next));
    $("level").textContent = (mode === "daily" ? "Daily" : mode === "blitz" ? "Blitz" : "Classic") + " · Level " + state.level;
    var pips = $("pips"), total = N.dropsFor(state.mode, state.level); pips.textContent = "";
    for (var k = 0; k < total; k++) { var p = document.createElement("i"); if (k >= state.left) p.className = "used"; pips.appendChild(p); }
    pips.title = state.left + " drops until the eggs rise";
    Array.prototype.forEach.call($("modes").children, function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-mode") === mode)); });
    renderTray();
    $("hint").textContent = targeting ? HINT[targeting] + " (Esc cancels)"
      : state.over ? "" : !N.hasRoom(state.grid) ? "The well is full. Use a power-up to make room."
      : state.left === 1 ? "Eggs rise after this drop." : "";
    boardEl.classList.toggle("targeting", !!targeting);
    drawCursor(); drawGhost();
    var over = $("over"); over.hidden = !state.over;
    if (state.over) {
      $("over-title").textContent = N.hasRoom(state.grid) ? "The well overflowed" : "No room left";
      $("over-text").textContent = "Score " + K.fmt(state.score) + " · level " + state.level + " · " + state.drops + " drops" +
        (state.bestChain > 1 ? " · best chain " + state.bestChain : "") +
        (state.luckies ? " · Lucky Sevens " + state.luckies : "") +
        (state.used ? " · power-ups used " + state.used : "");
      $("over-undo").hidden = !(state.power.undo > 0 && state.prev);
    }
  }
  function render() { drawGrid(state.grid); shownScore = state.score; renderChrome(); }

  // ---- playing a trace, one step at a time; every timer checks its generation ----
  function flush() {
    if (!busy) return;
    timers.forEach(clearTimeout); timers = []; busy = false; gen++; render();
  }
  function moveFalls(falls) {
    var next = {};
    Object.keys(els).forEach(function (k) { next[k] = els[k]; });
    falls.forEach(function (f) { delete next[f.from]; });
    falls.forEach(function (f) { var el = els[f.from]; if (el) { next[f.to] = el; place(el, f.to); } });
    els = next;
  }
  function applyCracks(cracks) {
    cracks.forEach(function (c) { var el = els[c.cell]; if (el) { paint(el, c.to); el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash"); } });
  }
  function stepIn(step) {
    shownScore += step.points || 0; $("score").textContent = K.fmt(shownScore);
    if (step.type === "drop") { els[step.cell] = makeDisc(step.disc, step.cell, "new"); }
    else if (step.type === "wave") {
      step.pops.forEach(function (c) { if (els[c]) els[c].classList.add("popping"); });
      applyCracks(step.cracks);
      return function () {
        step.pops.forEach(function (c) { if (els[c]) { els[c].remove(); delete els[c]; } });
        moveFalls(step.falls);
      };
    }
    else if (step.type === "lucky" || step.type === "crack") applyCracks(step.cracks);
    else if (step.type === "smash") { if (els[step.cell]) { els[step.cell].remove(); delete els[step.cell]; } moveFalls(step.falls); }
    else if (step.type === "rise") {
      var next = {};
      Object.keys(els).forEach(function (k) {
        var el = els[k], to = +k - W;
        if (to < 0) { el.classList.add("gone"); return; }
        next[to] = el; place(el, to);
      });
      for (var c = 0; c < W; c++) next[(H - 1) * W + c] = makeDisc(N.EGG, (H - 1) * W + c, "new");
      els = next;
    }
    return null;
  }
  function play(trace, done) {
    var g = ++gen, queue = trace.slice(), half = Math.round(STEP * 0.55);
    if (!STEP) { done(); return; }
    busy = true;
    var old = discsEl.querySelector(".ghost"); if (old) old.remove();
    function next() {
      if (g !== gen) return;
      if (!queue.length) { busy = false; timers = []; done(); return; }
      var finish = stepIn(queue.shift());
      if (finish) timers.push(setTimeout(function () { if (g !== gen) return; finish(); timers.push(setTimeout(next, STEP - half)); }, half));
      else timers.push(setTimeout(next, STEP));
    }
    next();
  }
  function announce(res) {
    var parts = [];
    if (res.lucky) parts.push("Lucky Seven!");
    else if (res.waves >= 3) parts.push("Chain of " + res.waves + "!");
    res.awarded.forEach(function (a) { parts.push("+" + DEFS[N.POWERS.indexOf(a.power)].label); });
    if (res.trace.some(function (t) { return t.type === "clear"; })) parts.unshift("Well cleared!");
    if (parts.length) K.toast(parts.join("  "));
  }

  // ---- actions ----
  function doDrop(col) {
    flush();
    if (targeting || state.over) return;
    cursor = col;
    var res = N.drop(state, col);
    if (!res.ok) { K.toast("That column is full"); return renderChrome(); }
    var before = state.score;
    state = res.state; persist();
    shownScore = before;
    announce(res);
    play(res.trace, render);
  }
  function activate(id) {
    flush();
    if (targeting === id) { targeting = null; return renderChrome(); }
    targeting = null;
    if (!state.power[id] || !usable(id)) return renderChrome();
    if (id === "smash") { targeting = "smash"; return renderChrome(); }
    var before = state.score, u = N.use(state, id);
    if (!u.ok) return renderChrome();
    state = u.state; persist();
    if (id === "undo") { K.toast("Took back one drop"); return render(); }
    if (id === "hold") { K.toast("Held " + (state.held >= 1 && state.held <= 7 ? state.held : "the egg")); return renderChrome(); }
    K.toast("Crack!"); shownScore = before; play(u.trace, render);
  }
  function smashAt(cell) {
    var before = state.score, u = N.use(state, "smash", cell);
    if (!u.ok) { K.toast("Pick a disc"); return; }
    targeting = null; state = u.state; persist(); K.toast("Smash!");
    shownScore = before; renderChrome(); play(u.trace, render);
  }
  function cellAt(ev) {
    var rect = discsEl.getBoundingClientRect(), x = ev.clientX - rect.left, y = ev.clientY - rect.top;
    var c = Math.floor(x / rect.width * W), r = Math.floor(y / rect.height * H);
    return { c: Math.max(0, Math.min(W - 1, c)), r: Math.max(0, Math.min(H - 1, r)) };
  }
  function topOf(col) { for (var r = 0; r < H; r++) if (state.grid[r * W + col]) return r * W + col; return -1; }

  // ---- input ----
  boardEl.addEventListener("click", function (ev) {
    if (ev.target.closest && ev.target.closest(".over")) return;
    var p = cellAt(ev);
    if (targeting === "smash") { flush(); smashAt(p.r * W + p.c); return; }
    doDrop(p.c);
  });
  boardEl.addEventListener("mousemove", function (ev) {
    if (busy || targeting) return;
    var c = cellAt(ev).c; if (c !== cursor) { cursor = c; drawCursor(); drawGhost(); }
  });
  window.addEventListener("keydown", function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var tag = (e.target && e.target.tagName) || "";
    if (e.key === "Escape") { targeting = null; return renderChrome(); }
    var pi = ["1", "2", "3", "4"].indexOf(e.key);
    if (pi >= 0) { e.preventDefault(); return activate(N.POWERS[pi]); }
    if (e.key === "u" || e.key === "U") return activate("undo");
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      cursor = Math.max(0, Math.min(W - 1, cursor + (e.key === "ArrowLeft" ? -1 : 1)));
      if (!busy) { drawCursor(); drawGhost(); }
      return;
    }
    var go = e.key === "Enter" || e.key === " " || e.key === "ArrowDown";
    if (!go) return;
    if (tag === "BUTTON" && e.key !== "ArrowDown") return; // let a focused button handle its own Enter/Space
    e.preventDefault();
    if (targeting === "smash") { flush(); var t = topOf(cursor); if (t >= 0) smashAt(t); else K.toast("Pick a disc"); return; }
    doDrop(cursor);
  });

  function startNew() {
    flush(); targeting = null;
    state = fresh(mode); persist(); render();
  }
  K.twoStep($("new"), function () { return state.drops > 0 && !state.over; }, startNew);
  $("again").addEventListener("click", startNew);
  $("over-undo").addEventListener("click", function () { activate("undo"); });
  Array.prototype.forEach.call($("modes").children, function (b) {
    b.addEventListener("click", function () {
      var m = b.getAttribute("data-mode"); if (m === mode) return;
      flush(); targeting = null; persist();
      mode = m; state = runs[m] || fresh(m); persist(); render();
      K.toast(m === "daily" ? "Daily: the same well for everyone today" : m === "blitz" ? "Blitz: eggs rise every 5 drops" : "Classic");
    });
  });

  render();

  // Screenshot hook (tools/shots.cjs): a fixed, representative mid-game. Not reachable from the UI.
  window.__demo = function () {
    flush(); targeting = null;
    var s = N.newGame(2026, "classic");
    for (var k = 0; k < 34 && !s.over; k++) {
      var bestC = -1, bv = -1e9;
      for (var c = 0; c < W; c++) {
        var r = N.drop(s, c); if (!r.ok) continue;
        var v = r.state.score - s.score - r.state.grid.filter(Boolean).length * 30 + ((c * 7 + k) % 5);
        if (v > bv) { bv = v; bestC = c; }
      }
      if (bestC < 0) break; s = N.drop(s, bestC).state;
    }
    s.power = { undo: 1, smash: 2, hold: 1, crack: 1 }; s.held = 7; s.prev = null; s.over = false;
    mode = "classic"; state = s; cursor = 3; best.classic = Math.max(best.classic, 0);
    render();
  };
  window.__seven = {
    get state() { return state; }, set state(s) { flush(); state = s; render(); },
    get mode() { return mode; }, get cursor() { return cursor; }, get busy() { return busy; },
    render: render, flush: flush,
  };
})();
