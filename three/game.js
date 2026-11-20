/* SPDX-License-Identifier: Apache-2.0 | Copyright 2026 alvations (Melon Lab)
 * Numberics Three: browser client. The engine (engine.js) owns every rule;
 * this file only draws, listens, and remembers. */
(function () {
  "use strict";
  var E = window.NumbericsThree, K = window.NumbericsKit, P = window.NumbericsPower;
  var store = K.store("numberics_three_v1");
  var reduce = K.reducedMotion();
  var SLIDE = reduce ? 0 : 110, SWEEP = reduce ? 450 : 520; // reduced motion: a still outline, then the collapse

  function valid(s) {
    return s && Array.isArray(s.grid) && s.grid.length === 16 &&
      s.grid.every(function (v) { return Number.isInteger(v) && v >= 0; }) &&
      Number.isInteger(s.next) && s.next > 0 && Array.isArray(s.bag) && typeof s.score === "number" &&
      s.power && E.POWERS.every(function (p) { return Number.isInteger(s.power[p]) && s.power[p] >= 0; });
  }

  var saved = store.load();
  var best = { score: (saved && saved.bestScore) || 0, used: (saved && saved.bestUsed) || 0 };
  var state = saved && valid(saved.state) ? saved.state : E.newGame(K.freshSeed());
  var targeting = null;            // {name, picks:[]} while a power-up waits for a target
  var timers = [], gen = 0, finalFx = null;
  var els = [];

  var $ = function (id) { return document.getElementById(id); };
  var boardEl = $("board"), tilesEl = $("tiles"), cellsEl = $("cells");
  for (var i = 0; i < 16; i++) cellsEl.appendChild(document.createElement("div"));

  function persist() {
    if (state.score > best.score) { best.score = state.score; best.used = state.used; }
    store.save({ state: state, bestScore: best.score, bestUsed: best.used });
  }

  function paint(el, v) {
    var c = E.colour(v), s = String(v);
    el.className = el.className.replace(/\b(one|two|three)\b/g, "").trim();
    el.classList.add(v === 1 ? "one" : v === 2 ? "two" : "three");
    if (c.band >= 0) { el.setAttribute("data-band", c.band); el.setAttribute("data-oct", Math.min(3, c.octave)); }
    else { el.removeAttribute("data-band"); el.removeAttribute("data-oct"); }
    el.textContent = s; el.setAttribute("data-len", String(Math.min(6, s.length)));
    el.setAttribute("aria-label", "tile " + s + (c.band >= 0 ? ", " + c.name + (c.octave ? " octave " + (c.octave + 1) : "") : ""));
  }
  function place(el, cell) { el.style.setProperty("--r", Math.floor(cell / 4)); el.style.setProperty("--c", cell % 4); }

  // draw a grid. fx: {spawned, merged:{cell}, run:{cells, order}, flushed:cell}
  function draw(grid, fx) {
    fx = fx || {};
    tilesEl.textContent = ""; els = [];
    grid.forEach(function (v, cell) {
      if (!v) return;
      var el = document.createElement("div");
      el.className = "tile"; paint(el, v); place(el, cell);
      if (fx.merged && fx.merged[cell]) el.classList.add("pop");
      if (fx.spawned === cell) el.classList.add("new");
      if (fx.flushed === cell) el.classList.add("flushed");
      if (fx.run && fx.run.indexOf(cell) >= 0) {
        el.classList.add("run"); if (reduce) el.classList.add("still");
        el.style.setProperty("--d", (fx.run.indexOf(cell) * 70) + "ms");
      }
      tilesEl.appendChild(el); els[cell] = el;
    });
  }

  var DEFS = [
    { id: "undo", label: "Undo", title: "Undo: take back the last move" },
    { id: "smash", label: "Smash", title: "Smash: remove a tile" },
    { id: "swap", label: "Swap", title: "Swap: trade two neighbouring tiles" },
    { id: "third", label: "Third", title: "Third: turn a 1 or 2 into a 3" },
  ];
  var NAME = { undo: "Undo", smash: "Smash", swap: "Swap", third: "Third" };
  var HINT = { smash: "Tap a tile to smash it.", swap: "Tap two neighbouring tiles to swap them.",
               third: "Tap a 1 or a 2 to make it a 3." };

  function chrome() {
    $("score").textContent = K.fmt(state.score);
    $("best").textContent = K.fmt(Math.max(best.score, state.score));
    var nx = $("next"); nx.className = "mini"; paint(nx, state.next); nx.setAttribute("aria-label", "next tile " + state.next);
    P.tray($("tray"), DEFS, state.power, {
      armed: targeting && targeting.name,
      disabled: function (id) { return !E.usable(state, id); },
      onUse: activate,
    });
    $("hint").textContent = targeting ? HINT[targeting.name] + " (Esc cancels)"
      : (!E.canMove(state) && !state.over ? "Stuck. Use a power-up to keep going." : "");
    Array.prototype.forEach.call(cellsEl.children, function (c, k) {
      c.classList.toggle("sel", !!(targeting && targeting.picks.indexOf(k) >= 0));
    });
    boardEl.classList.toggle("targeting", !!targeting);
    $("over").hidden = !state.over;
    if (state.over) {
      $("over-text").textContent = "Score " + K.fmt(state.score) + " · " + state.flushes + (state.flushes === 1 ? " flush" : " flushes") +
        " · " + (state.used ? state.used + " power-up" + (state.used === 1 ? "" : "s") + " used" : "pure run");
    }
  }
  function render(fx) { draw(state.grid, fx); chrome(); }

  // ---- animation: slide one step, then play each flush, then the authoritative board ----
  function later(fn, ms) { var g = gen; timers.push(setTimeout(function () { if (g === gen) fn(); }, ms)); }
  function settle() {
    if (!timers.length && !finalFx) return;
    timers.forEach(clearTimeout); timers = []; gen++;
    var fx = finalFx; finalFx = null; render(fx);
  }

  function runFlushes(list, k) {
    if (k >= list.length) { var fx = finalFx; finalFx = null; timers = []; return render(fx); }
    var f = list[k];
    draw(f.before, { run: f.cells });
    later(function () { runFlushes(list, k + 1); }, SWEEP);
  }

  function doMove(dir) {
    settle();
    if (targeting) return;
    var r = E.move(state, dir);
    if (!r.moved) return;
    var merged = {};
    r.trace.forEach(function (t) {
      var el = els[t.from]; if (el) place(el, t.to);
      if (t.merge) merged[t.to] = true;
    });
    state = r.state; gen++;
    var lastFlush = r.flushes.length ? r.flushes[r.flushes.length - 1].at : -1;
    finalFx = { merged: merged, spawned: r.spawned, flushed: lastFlush };
    if (r.flushes.length) {
      var f = r.flushes[0], tail = r.flushes.length > 1 ? "  (x" + r.flushes.length + " cascade)" : "";
      K.toast("Flush " + f.values.join("-") + " = " + f.value + ", +" + K.fmt(f.points) + (f.power ? "  +" + NAME[f.power] : "") + tail);
    }
    persist();
    chrome();
    var go = function () { if (r.flushes.length) runFlushes(r.flushes, 0); else { var fx = finalFx; finalFx = null; timers = []; render(fx); } };
    if (SLIDE) later(go, SLIDE); else go();
  }

  // ---- power-ups ----
  function activate(name) {
    settle();
    if (targeting && targeting.name === name) { targeting = null; return render(); }
    targeting = null;
    if (!E.usable(state, name)) return render();
    if (name === "undo") {
      var u = E.use(state, "undo");
      if (u.ok) { state = u.state; persist(); K.toast("Rewound one move"); }
      return render();
    }
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
    if (targeting.picks[0] === cell) { targeting.picks = []; return render(); }
    targeting.picks.push(cell);
    var need = targeting.name === "swap" ? 2 : 1;
    if (targeting.picks.length < need) return render();
    var name = targeting.name, res = E.use(state, name, targeting.picks[0], targeting.picks[1]);
    if (res.ok) { state = res.state; targeting = null; persist(); K.toast(NAME[name] + "!"); }
    else { targeting.picks = []; K.toast(name === "swap" ? "Pick two different neighbouring tiles" : name === "third" ? "Pick a 1 or a 2" : "Pick a tile"); }
    render();
  }

  // ---- input ----
  window.addEventListener("keydown", function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === "Escape") { targeting = null; return render(); }
    var pi = ["1", "2", "3", "4"].indexOf(e.key);
    if (pi >= 0) return activate(E.POWERS[pi]);
    if (e.key === "u" || e.key === "U") return activate("undo");
    var d = K.arrowKey(e);
    if (d) { e.preventDefault(); doMove(d); }
  });
  boardEl.addEventListener("click", pick);
  K.swipe(boardEl, doMove);

  function startNew() {
    settle(); targeting = null;
    state = E.newGame(K.freshSeed()); persist(); render();
  }
  K.twoStep($("new"), function () { return state.moves > 0 && !state.over; }, startNew);
  $("again").addEventListener("click", startNew);

  render();
  // Screenshot hook (tools/shots.cjs): a fixed, representative mid-game. Not reachable from the UI.
  window.__demo = function () {
    settle(); targeting = null;
    var s = E.newGame(2026);
    s.grid = [3, 6, 1, 2,
              9, 12, 3, 0,
              2, 15, 24, 6,
              1, 3, 18, 21];
    s.next = 3; s.score = 1284; s.moves = 87; s.flushes = 4; s.top = 24;
    s.power = { undo: 1, smash: 2, swap: 1, third: 1 }; s.prev = null; s.over = false;
    state = s; render();
  };
  window.__three = { get state() { return state; }, set state(s) { settle(); state = s; render(); }, render: render, settle: settle };
})();
