/* SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 alvations (Melon Lab)
 * Numberics Two: browser client. The engine (engine.js) owns every rule;
 * this file only draws, listens, and remembers. */
(function () {
  "use strict";
  var N = window.Numberics, K = window.NumbericsKit, P = window.NumbericsPower;
  // storage goes through NumbericsKit.store: every localStorage call is in try/catch, memory fallback
  // Two was called Endless; the key is kept so saved games load (REDESIGN.md 4.2). Never rename it.
  var store = K.store("numberics_endless_v1");
  var ANIM = K.reducedMotion() ? 0 : 110;
  var freshSeed = K.freshSeed;
  // a fine pointer with hover means a keyboard is likely: only then mention Esc and the arrow keys
  var desk = false;
  try { desk = window.matchMedia("(hover: hover) and (pointer: fine)").matches; } catch (e) { desk = false; }

  // One validator for a saved state and its undo snapshot: a malformed save starts a fresh game.
  function int(v) { return Number.isInteger(v) && v >= 0; }
  function core(s) {
    return !!s && typeof s === "object" && Array.isArray(s.grid) && s.grid.length === 16 && s.grid.every(int) &&
      !!s.power && N.POWERS.every(function (p) { return int(s.power[p]); }) &&
      typeof s.score === "number" && isFinite(s.score) && int(s.top) && int(s.moves) && typeof s.seed === "number";
  }
  function valid(s) { return core(s) && s.size === 4 && (s.prev == null || core(s.prev)); }

  var saved = store.load();
  var best = { score: (saved && +saved.bestScore) || 0, top: (saved && +saved.bestTop) || 0 };
  var state = saved && valid(saved.state) ? saved.state : N.newGame(freshSeed());
  // the best score before this run began, so the end screen can say "New best."
  var bestBefore = saved && typeof saved.bestBefore === "number" ? saved.bestBefore
    : (state.score > 0 && state.score >= best.score ? 0 : best.score);
  var targeting = null;           // {name, picks:[]} while a power-up waits for a target
  var cur = -1, kbd = false;      // keyboard aiming cursor (cell), shown once a key aims
  var note = "";                  // a tray explanation in the hint line, until the next action
  var timer = null, pendingFx = null, newArmed = null;
  // Round 3 end-card pattern: the locked board shows undimmed for HOLD ms, then the card; "See the board" hides
  // the card again (a tap on the board, Esc or Enter brings it back). A run that loads already over shows the card.
  var HOLD = 1500, holding = false, holdT = null, viewing = false, wasOver = !!state.over;
  var els = [];                   // cell index -> tile element

  var $ = function (id) { return document.getElementById(id); };
  var boardEl = $("board"), tilesEl = $("tiles"), cellsEl = $("cells");
  for (var i = 0; i < 16; i++) cellsEl.appendChild(document.createElement("div"));

  function persist() {
    best.score = Math.max(best.score, state.score); best.top = Math.max(best.top, state.top);
    store.save({ state: state, bestScore: best.score, bestTop: best.top, bestBefore: bestBefore });
    // the card summary (shared/progress.js): what the Games list and the cards on other pages show for Two
    var NP = window.NumbericsProgress;
    if (NP) NP.put("two", { best: best.score > 0 ? "Best " + K.fmt(best.score) : "", live: !state.over && state.moves > 0,
      liveText: "Score " + K.fmt(state.score) });
  }
  var fmt = K.fmt;

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
    var bs = Math.max(best.score, state.score), bestEl = $("best");
    bestEl.textContent = bs ? fmt(bs) : "none"; bestEl.classList.toggle("none", !bs); // R11: an empty stat says none
    renderTray();
    var aim = targeting && kbd ? cur : -1;
    Array.prototype.forEach.call(cellsEl.children, function (c, i) {
      var sel = !!(targeting && targeting.picks.indexOf(i) >= 0);
      c.classList.toggle("sel", sel); c.classList.toggle("cur", i === aim);
      if (els[i]) { els[i].classList.toggle("sel", sel); els[i].classList.toggle("cur", i === aim); }
    });
    boardEl.classList.toggle("targeting", !!targeting);
    var topEl = $("top");
    topEl.textContent = state.top ? N.label(state.top) : "none"; topEl.classList.toggle("none", !state.top);
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
      $("over-text").textContent = "Top tile " + N.label(state.top) + " · Score " + fmt(state.score);
      $("over-best").hidden = !(state.score > 0 && state.score > bestBefore);
      if (!over.hidden && !was) { try { $("again").focus({ preventScroll: true }); } catch (e) { /* focus is a nicety */ } }
    }
  }
  // "See the board" hides the card; a tap on the board, Esc or Enter brings it back (or skips the hold)
  function view(on) {
    viewing = on; holding = false; note = ""; clearTimeout(holdT); holdT = null; render();
    if (on) { try { boardEl.focus({ preventScroll: true }); } catch (e) { /* focus is a nicety */ } }
  }

  var PW = { undo: "Undo", smash: "Smash", swap: "Swap", boost: "Boost" };
  var DEFS = [
    { id: "undo", label: "Undo", desc: "Take back the last move." },
    { id: "smash", label: "Smash", desc: "Remove one tile." },
    { id: "swap", label: "Swap", desc: "Swap any two cells." },
    { id: "boost", label: "Boost", desc: "Double one tile. Boosted tiles never earn a reward." }
  ];
  var EARN = "Each new highest tile from 32 up earns a random power-up.";
  var PW_HINT = { smash: "Tap a tile to smash it.", boost: "Tap a tile to double it.",
                  swap: "Tap two cells to swap them." };
  function targetHint() {
    var t = targeting.name === "swap" && targeting.picks.length ? "Now tap the cell to swap it with." : PW_HINT[targeting.name];
    return t + (desk ? " Arrows + Enter aim, Esc cancels." : " Tap " + PW[targeting.name] + " to cancel.");
  }
  // The tray is rebuilt only when what it shows changes. Rebuilding it on every redraw (the animation's
  // final draw lands ~110 ms after a swipe) replaced the button under a finger mid-tap, so the tap was
  // lost (round 2, cold #1).
  var trayKey = "";
  function trayWhy(id) {
    if (state.over) return "The run is over.";
    if (id === "undo" && state.power.undo && !state.prev) return "Undo goes back one move at a time. Make a move first.";
    return false;
  }
  function renderTray() {
    var key = JSON.stringify([state.power, targeting && targeting.name, N.POWERS.map(trayWhy)]);
    if (key !== trayKey) { trayKey = key; drawTray(); }
    $("hint").textContent = targeting ? targetHint() : state.over ? (viewing ? "Tap the board for the summary." : note)
      : note || (!N.canMove(state) ? "Stuck. Use a power-up to keep going." : "");
  }
  function drawTray() {
    P.tray($("tray"), DEFS, state.power, {
      armed: targeting && targeting.name,
      earn: EARN,
      disabled: trayWhy,
      onUse: activate,
      onInfo: function (id, text) { flush(); targeting = null; note = text; render(); }
    });
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
    // only reward-sized tiles are news (round 2: "New tile 4, 8, 16" was noise before the rewards begin)
    var top = r.milestones.length ? r.milestones[r.milestones.length - 1] : 0;
    // R7: when the move ends the run, the end card is the only message
    if (top >= N.AWARD_FROM_LEVEL && !state.over) {
      if (r.awarded.length) toast("New tile " + N.label(top) + "  +" + PW[r.awarded[0].power]);
      else if (r.free) toast("New tile " + N.label(top) + ". No reward right after a power-up.", "info");
      else if (r.marked) toast("New tile " + N.label(top) + ". Swapped and boosted tiles earn no reward.", "info"); // R2 by tile
      else if (r.full) toast("New tile " + N.label(top) + ". Power-ups full.", "info"); // R15
      else toast("New tile " + N.label(top));
    }
    renderTray(); // the tray and hint follow the move at once, so a quick tap meets the final buttons
    persist();
    if (ANIM) { var gen = state.moves; timer = setTimeout(function () { if (state.moves === gen) { timer = null; finalize(); } }, ANIM); }
    else finalize();
  }

  // ---- power-ups ----
  function activate(name) {
    flush(); note = "";
    if (targeting && targeting.name === name) { targeting = null; return render(); }
    targeting = null;
    if (name === "undo") {
      var u = N.use(state, "undo");
      if (u.ok) { state = u.state; persist(); toast("Rewound one move"); }
      return render();
    }
    if (!state.power[name] || state.over) return render();
    targeting = { name: name, picks: [] };
    if (cur < 0 || cur > 15) cur = Math.max(0, state.grid.indexOf(state.top));
    render();
    // aim from the board, so Enter picks a cell instead of re-pressing the tray button
    try { boardEl.focus({ preventScroll: true }); } catch (e) { /* focus is a nicety */ }
  }
  function cellAt(ev) {
    var rect = boardEl.getBoundingClientRect(), x = ev.clientX - rect.left, y = ev.clientY - rect.top;
    var c = Math.floor(x / rect.width * 4), r = Math.floor(y / rect.height * 4);
    return (c < 0 || c > 3 || r < 0 || r > 3) ? -1 : r * 4 + c;
  }
  function pickCell(cell) {
    if (!targeting || cell < 0 || cell > 15) return;
    flush();
    var at = targeting.picks.indexOf(cell);
    if (at >= 0) { targeting.picks.splice(at, 1); return render(); } // picking a picked cell un-picks it
    targeting.picks.push(cell);
    var need = targeting.name === "swap" ? 2 : 1;
    if (targeting.picks.length < need) return render();
    var name = targeting.name, top0 = state.top;
    var res = N.use(state, name, targeting.picks[0], targeting.picks[1]);
    if (res.ok) {
      state = res.state; targeting = null; persist();
      if (!state.over) toast(name === "boost" && state.top > top0 ? "Boosted to " + N.label(state.top) + ". Boosted tiles earn no reward." : PW[name] + "!");
    } else {
      targeting.picks = [];
      toast(name === "swap" ? "Pick two cells, at least one with a tile." : "Pick a tile, not an empty cell.", "bad");
    }
    render();
  }
  function pick(ev) {
    if (ev.target && ev.target.closest && ev.target.closest("#over")) return; // the card's own buttons
    if (state.over && (viewing || holding)) return view(false);
    if (!targeting) return; kbd = false; pickCell(cellAt(ev));
  }
  var STEP = { left: -1, right: 1, up: -4, down: 4 };
  function aim(dir) {
    if (!kbd) { kbd = true; return render(); } // the first key shows the cursor where it is
    var r = Math.floor(cur / 4), c = cur % 4;
    if (dir === "left") c = Math.max(0, c - 1); else if (dir === "right") c = Math.min(3, c + 1);
    else if (dir === "up") r = Math.max(0, r - 1); else r = Math.min(3, r + 1);
    cur = r * 4 + c; render();
  }

  // ---- input ----
  var KEYS = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down", a: "left", d: "right", w: "up", s: "down" };
  window.addEventListener("keydown", function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var tag = e.target && e.target.tagName;
    // R17: a key typed into a field belongs to the field; Enter or Space on a focused button or link
    // activates that control (a link navigates), never a game action
    if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
    if ((e.key === "Enter" || e.key === " ") && (tag === "BUTTON" || tag === "A")) return;
    if (state.over && (viewing || holding) && (e.key === "Escape" || e.key === "Enter" || e.key === " ")) { e.preventDefault(); return view(false); }
    if (e.key === "Escape") { if (targeting) { targeting = null; render(); } return; }
    var pi = ["1", "2", "3", "4"].indexOf(e.key);
    if (pi >= 0) { kbd = true; return pressTray(N.POWERS[pi]); }
    if (e.key === "u") { kbd = true; return pressTray("undo"); }
    if (targeting && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); kbd = true; return pickCell(cur); }
    var d = KEYS[e.key] || KEYS[(e.key || "").toLowerCase()];
    if (d) { e.preventDefault(); if (targeting) aim(d); else doMove(d); }
  });
  // a number key behaves exactly like tapping that tray slot (an unusable slot explains itself)
  function pressTray(name) { var b = $("tray").children[N.POWERS.indexOf(name)]; if (b) b.click(); }
  window.addEventListener("pointerdown", function () { kbd = false; }, true);
  boardEl.addEventListener("click", pick);
  var sx = 0, sy = 0, touching = false;
  boardEl.addEventListener("touchstart", function (e) { var t = e.changedTouches[0]; sx = t.clientX; sy = t.clientY; touching = true; }, { passive: true });
  // Round 3 (cold #5): without a non-passive touchmove the browser still runs its own scroll gesture for a swipe,
  // and the next tap (on a power-up just earned) only stops that gesture: no click. Owning the move keeps the tap.
  boardEl.addEventListener("touchmove", function (e) { if (e.cancelable) e.preventDefault(); }, { passive: false });
  boardEl.addEventListener("touchend", function (e) {
    if (!touching) return; touching = false;
    var t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return; // a tap, not a swipe
    doMove(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up"));
  }, { passive: true });

  // ---- new game: two-step instead of a blocking confirm() dialog ----
  function startNew() {
    flush(); targeting = null; note = "";
    bestBefore = best.score;
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
  $("over-view").addEventListener("click", function () { view(true); });

  render();
  // Screenshot hook (tools/shots.cjs): a fixed, representative mid-game. Not reachable from the UI.
  window.__demo = function () {
    flush(); targeting = null; note = "";
    var s = N.newGame(2026), dirs = ["left", "down", "right", "down"];
    for (var k = 0; k < 120 && !s.over; k++) s = N.move(s, dirs[k % 4]).state;
    s.power = { undo: 1, smash: 2, swap: 1, boost: 1 };
    state = s; render();
  };
  window.__numberics = { get state() { return state; }, set state(s) { state = s; render(); }, render: render,
    get targeting() { return targeting; }, get cursor() { return cur; }, get bestBefore() { return bestBefore; },
    get viewing() { return viewing; }, get holding() { return holding; }, showCard: function () { view(false); } };
})();
