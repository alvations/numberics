/* SPDX-License-Identifier: Apache-2.0 | Copyright 2026 alvations (Melon Lab)
 * Numberics Three: browser client. The engine (engine.js) owns every rule;
 * this file only draws, listens, and remembers. */
(function () {
  "use strict";
  var E = window.NumbericsThree, K = window.NumbericsKit, P = window.NumbericsPower;
  var store = K.store("numberics_three_v1");
  var reduce = K.reducedMotion();
  var SLIDE = reduce ? 0 : 110, SWEEP = reduce ? 250 : 520; // reduced motion: a still outline, then the collapse

  function valid(s) {
    return s && Array.isArray(s.grid) && s.grid.length === 16 &&
      s.grid.every(function (v) { return Number.isInteger(v) && v >= 0; }) &&
      Number.isInteger(s.next) && s.next > 0 && Array.isArray(s.bag) && typeof s.score === "number" &&
      s.power && E.POWERS.every(function (p) { return Number.isInteger(s.power[p]) && s.power[p] >= 0; }) &&
      (s.free === undefined || typeof s.free === "boolean");
  }

  var saved = store.load();
  var best = { score: (saved && saved.bestScore) || 0, used: (saved && saved.bestUsed) || 0 };
  var state = saved && valid(saved.state) ? saved.state : E.newGame(K.freshSeed());
  // the record when this run began, so the end screen can say "New best." (an old save has none: count it as 0
  // only if this run already holds the record)
  var base = saved && Number.isFinite(saved.base) ? saved.base : (best.score > state.score ? best.score : 0);
  var seen = !!(saved && saved.seen);  // the first-run explainer was dismissed once
  var desk = false;                // a mouse and keyboard: targeting copy adds the arrow keys
  try { desk = window.matchMedia("(hover: hover) and (pointer: fine)").matches; } catch (e) { desk = false; }
  var viewing = false;             // "See the board": the end card is hidden to look at the finished board
  var targeting = null;            // {name, picks:[], cur, kbd} while a power-up waits for a target
  var note = "";                   // a tray explanation in the hint line, until the next action
  var timers = [], gen = 0, finalFx = null;
  var els = [];

  var $ = function (id) { return document.getElementById(id); };
  var boardEl = $("board"), tilesEl = $("tiles"), cellsEl = $("cells");
  for (var i = 0; i < 16; i++) cellsEl.appendChild(document.createElement("div"));

  function persist() {
    if (state.score > best.score) { best.score = state.score; best.used = state.used; }
    store.save({ state: state, bestScore: best.score, bestUsed: best.used, base: base, seen: seen });
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
      if (targeting && !fx.run) {
        if (targeting.picks.indexOf(cell) >= 0) el.classList.add("sel");
        if (targeting.kbd && targeting.cur === cell) el.classList.add("cur");
      }
      if (fx.flushed === cell) el.classList.add("flushed");
      if (fx.run && fx.run.indexOf(cell) >= 0) {
        el.classList.add("run"); if (reduce) el.classList.add("still");
        el.style.setProperty("--d", (fx.run.indexOf(cell) * 70) + "ms");
      }
      tilesEl.appendChild(el); els[cell] = el;
    });
  }

  var EARN = "Earn one with every Flush.";
  var DEFS = [
    { id: "undo", label: "Undo", desc: "Take back the last move.", earn: "You start with one. " + EARN },
    { id: "smash", label: "Smash", desc: "Remove one tile.", earn: EARN },
    { id: "swap", label: "Swap", desc: "Trade two neighbouring tiles.", earn: EARN },
    { id: "third", label: "Third", desc: "Turn a 1 or a 2 into a 3.", earn: EARN },
  ];
  var NAME = { undo: "Undo", smash: "Smash", swap: "Swap", third: "Third" };
  // targeting copy always says how to tap (phones aim by tapping); with a keyboard it adds arrows + Enter and Esc.
  // Every line fits on one line at 375 px, so the hint never pushes the board down (craft #11, #13).
  var HINT = { smash: "Tap a tile to smash it.", swap: "Tap two neighbours to swap.", third: "Tap a 1 or a 2 to make a 3." };
  var KHINT = { smash: "Tap a tile to smash it, or arrows + Enter.", swap: "Tap two neighbours, or arrows + Enter.",
                third: "Tap a 1 or a 2, or arrows + Enter." };
  function targetHint() {
    var keys = desk || targeting.kbd, n = targeting.name;
    if (n === "swap" && targeting.picks.length) return keys ? "Now tap a neighbour to swap with. Esc cancels." : "Now tap a neighbour. Tap Swap to cancel.";
    return keys ? KHINT[n] + " Esc cancels." : HINT[n] + " Tap " + NAME[n] + " to cancel.";
  }
  // stuck but not over: say what can still act (with only Undo left, say so plainly: gameplay #1, cold #19)
  function stuckHint() {
    var can = E.POWERS.filter(function (p) { return E.usable(state, p); });
    return can.length === 1 && can[0] === "undo" ? "Stuck. Undo a move, or start a new game." : "Stuck. Use a power-up to keep going.";
  }
  // why a charged power-up cannot act right now (false: it can, or it has no charge, so the tray says how to earn)
  function why(id) {
    if (state.over) return "The run is over.";
    if (!state.power[id] || E.usable(state, id)) return false;
    return { undo: "Nothing to take back yet.", smash: "The board is empty.",
             swap: "No two different tiles sit side by side.", third: "There is no 1 or 2 on the board." }[id];
  }
  function explain(id) {
    var d = DEFS[E.POWERS.indexOf(id)];
    note = P.info(d, state.power, why(id), {}); chrome();
  }

  function chrome() {
    $("score").textContent = K.fmt(state.score);
    var bv = Math.max(best.score, state.score); // R11: an empty best is a dimmed "none", never 0
    $("best").textContent = bv ? K.fmt(bv) : "none"; $("best").classList.toggle("none", !bv);
    var nx = $("next"); nx.className = "mini"; paint(nx, state.next); nx.setAttribute("aria-label", "next tile " + state.next);
    P.tray($("tray"), DEFS, state.power, {
      armed: targeting && targeting.name,
      disabled: why,
      onUse: activate,
      onInfo: function (id, text) { note = text; chrome(); },
    });
    $("hint").textContent = targeting ? targetHint()
      : note ? note
      : state.over ? (viewing ? "Tap the board for the summary." : "")
      : !E.canMove(state) ? stuckHint()
      : !state.moves ? "Swipe to start: every tile moves one step." : "";
    Array.prototype.forEach.call(cellsEl.children, function (c, k) {
      c.classList.toggle("sel", !!(targeting && targeting.picks.indexOf(k) >= 0));
      c.classList.toggle("cur", !!(targeting && targeting.kbd && targeting.cur === k));
    });
    boardEl.classList.toggle("targeting", !!targeting);
    if (!state.over) viewing = false;
    var wasOver = !$("over").hidden, card = !!state.over && !viewing;
    $("over").hidden = !card;
    // one end-card pattern (round 3): while the card shows, the page's New game is hidden with its space kept
    // (no gap jump, one New game on screen), and the card's primary button takes focus
    $("new").style.visibility = card ? "hidden" : "";
    if (card && !wasOver && !helpOpen()) $("again").focus({ preventScroll: true });
    if (state.over) {
      // "<detail> · <score>", the family's subline form; no-break spaces and hyphen keep each part whole at 320 px
      $("over-text").textContent = state.flushes + (state.flushes === 1 ? "\u00a0flush" : "\u00a0flushes") + "\u00a0· " +
        (state.used ? state.used + "\u00a0power\u2011up" + (state.used === 1 ? "" : "s") : "pure run") + "\u00a0· score\u00a0" + K.fmt(state.score);
      $("over-best").hidden = !(state.score > base && state.score > 0);
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

  // one toast per flush event (a reward); a flush a power-up set up scores but pays no power-up (R2)
  function announce(list) {
    if (!list.length) return;
    var f = list[0], tail = list.length > 1 ? "  (x" + list.length + " cascade)" : "";
    // R15: a flush on a full stock says so, never a silent missing reward
    var pays = f.power ? "  +" + NAME[f.power] : f.full ? ". Power-ups full" : f.paid ? "" : " (no power-up)";
    K.toast("Flush " + f.values.join("-") + (f.value ? " = " + f.value : "") + ", +" + K.fmt(f.points) + pays + tail);
  }
  function play(list) {
    if (list.length) runFlushes(list, 0); else { var fx = finalFx; finalFx = null; timers = []; render(fx); }
  }

  function doMove(dir) {
    settle();
    if (helpOpen()) return;
    if (targeting) return;
    var r = E.move(state, dir);
    if (!r.moved) return;
    note = "";
    var merged = {};
    r.trace.forEach(function (t) {
      var el = els[t.from]; if (el) place(el, t.to);
      if (t.merge) merged[t.to] = true;
    });
    state = r.state; gen++;
    var lastFlush = r.flushes.length ? r.flushes[r.flushes.length - 1].at : -1;
    finalFx = { merged: merged, spawned: r.spawned, flushed: lastFlush };
    announce(r.flushes);
    persist();
    chrome();
    var go = function () { play(r.flushes); };
    if (SLIDE) later(go, SLIDE); else go();
  }

  // ---- power-ups ----
  function activate(name, kbd) {
    settle();
    if (helpOpen()) return;
    note = "";
    if (targeting && targeting.name === name) { targeting = null; return render(); }
    targeting = null;
    if (state.over || !E.usable(state, name)) { render(); return explain(name); }
    if (name === "undo") {
      var u = E.use(state, "undo");
      if (u.ok) { state = u.state; persist(); K.toast("Rewound one move"); }
      return render();
    }
    targeting = { name: name, picks: [], cur: -1, kbd: !!kbd };
    if (kbd) targeting.cur = firstTarget(name);
    render();
  }
  function firstTarget(name) {
    var g = state.grid;
    for (var c = 0; c < 16; c++) if (name === "third" ? (g[c] === 1 || g[c] === 2) : g[c]) return c;
    return 0;
  }
  // keyboard cursor: arrows move it one cell (clamped), Enter or Space picks
  function steer(dir) {
    if (!targeting.kbd) { targeting.kbd = true; if (targeting.cur < 0) { targeting.cur = targeting.picks.length ? targeting.picks[0] : firstTarget(targeting.name); return render(); } }
    var r = Math.floor(targeting.cur / 4), c = targeting.cur % 4;
    if (dir === "left") c = Math.max(0, c - 1); else if (dir === "right") c = Math.min(3, c + 1);
    else if (dir === "up") r = Math.max(0, r - 1); else r = Math.min(3, r + 1);
    targeting.cur = r * 4 + c; render();
  }
  function cellAt(ev) {
    var rect = boardEl.getBoundingClientRect(), x = ev.clientX - rect.left, y = ev.clientY - rect.top;
    var c = Math.floor(x / rect.width * 4), r = Math.floor(y / rect.height * 4);
    return (c < 0 || c > 3 || r < 0 || r > 3) ? -1 : r * 4 + c;
  }
  function pick(ev) {
    if (ev.target && ev.target.closest && ev.target.closest("#over")) return; // the card's own buttons
    if (viewing) return view(false);
    if (!targeting) return;
    var cell = cellAt(ev); if (cell < 0) return;
    targeting.kbd = false; targeting.cur = cell;
    pickCell(cell);
  }
  function pickCell(cell) {
    if (targeting.picks[0] === cell) { targeting.picks = []; return render(); }
    targeting.picks.push(cell);
    var need = targeting.name === "swap" ? 2 : 1;
    if (targeting.picks.length < need) return render();
    var name = targeting.name, res = E.use(state, name, targeting.picks[0], targeting.picks[1]);
    if (!res.ok) {
      targeting.picks = [];
      K.toast(name === "swap" ? "Pick two different neighbouring tiles" : name === "third" ? "Pick a 1 or a 2" : "Pick a tile", "bad");
      return render();
    }
    state = res.state; targeting = null; persist();
    if (res.flushes.length) { announce(res.flushes); gen++; finalFx = { flushed: res.flushes[res.flushes.length - 1].at }; chrome(); play(res.flushes); }
    else { K.toast(NAME[name] + "!"); render(); }
  }

  // ---- input ----
  window.addEventListener("keydown", function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    // R17: Enter or Space on a focused link, button or field is that control's own action, never a game action
    var onButton = !!(e.target && /^(A|BUTTON|INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName));
    if (helpOpen()) {
      if (e.key === "Escape" || ((e.key === "Enter" || e.key === " ") && !onButton)) { e.preventDefault(); closeHelp(); }
      return;
    }
    if (viewing && (e.key === "Escape" || ((e.key === "Enter" || e.key === " ") && !onButton))) { e.preventDefault(); return view(false); }
    if (e.key === "Escape") { targeting = null; return render(); }
    if (targeting && (e.key === "Enter" || e.key === " ") && !onButton) {
      e.preventDefault(); if (targeting.cur < 0) { targeting.kbd = true; targeting.cur = firstTarget(targeting.name); return render(); }
      return pickCell(targeting.cur);
    }
    var pi = ["1", "2", "3", "4"].indexOf(e.key);
    if (pi >= 0) return activate(E.POWERS[pi], true);
    if (e.key === "u" || e.key === "U") return activate("undo", true);
    var d = K.arrowKey(e);
    if (d) { e.preventDefault(); if (targeting) steer(d); else doMove(d); }
  });
  boardEl.addEventListener("click", pick);
  K.swipe(boardEl, doMove);

  // "See the board" hides the card to look at the finished run; a tap on the board, Enter or Esc brings it back
  function view(on) {
    viewing = on; note = ""; render();
    if (on) boardEl.focus({ preventScroll: true }); else $("again").focus({ preventScroll: true });
  }
  function startNew() {
    settle(); targeting = null; note = ""; viewing = false;
    base = Math.max(best.score, state.score);
    state = E.newGame(K.freshSeed()); persist(); render();
  }

  // ---- first-run explainer: shown once (remembered), re-opened from "How it works" ----
  var helpEl = $("help"), helpBack = null;
  (function () {
    var tiles = helpEl.querySelectorAll("[data-v]");
    Array.prototype.forEach.call(tiles, function (el) { el.classList.add("tile"); paint(el, +el.getAttribute("data-v")); el.setAttribute("aria-hidden", "true"); });
  })();
  function helpOpen() { return !helpEl.hidden; }
  function openHelp() {
    settle(); targeting = null; render();
    helpBack = document.activeElement; showHelp();
  }
  // the card itself takes focus (Enter, Space or Esc closes it; Tab reaches Play), and it opens scrolled to its top
  function showHelp() { helpEl.hidden = false; helpEl.scrollTop = 0; $("help-card").focus({ preventScroll: true }); }
  function closeHelp() {
    helpEl.hidden = true;
    if (!seen) { seen = true; persist(); }
    (helpBack && helpBack !== document.body && helpBack.focus ? helpBack : boardEl).focus();
  }
  $("help-play").addEventListener("click", closeHelp);
  helpEl.addEventListener("click", function (e) { if (e.target === helpEl) closeHelp(); });
  $("help-open").addEventListener("click", function (e) { e.preventDefault(); openHelp(); });
  K.twoStep($("new"), function () { return state.moves > 0 && !state.over; }, startNew);
  $("again").addEventListener("click", startNew);
  $("over-view").addEventListener("click", function () { view(true); });

  render();
  if (!seen) { helpBack = boardEl; showHelp(); }
  // Screenshot hook (tools/shots.cjs): a fixed, representative mid-game. Not reachable from the UI.
  window.__demo = function () {
    settle(); targeting = null; note = ""; viewing = false; helpEl.hidden = true;
    var s = E.newGame(2026);
    s.grid = [3, 6, 1, 2,
              9, 12, 3, 0,
              2, 18, 24, 6,
              1, 3, 36, 48];
    s.next = 3; s.score = 1284; s.moves = 87; s.flushes = 4; s.top = 48;
    s.power = { undo: 1, smash: 2, swap: 1, third: 1 }; s.prev = null; s.over = false;
    state = s; render();
  };
  window.__three = { get state() { return state; }, set state(s) { settle(); state = s; render(); }, render: render, settle: settle,
    get base() { return base; }, set base(v) { base = v; }, openHelp: openHelp, closeHelp: closeHelp,
    get viewing() { return viewing; }, set desk(v) { desk = !!v; render(); } };
})();
