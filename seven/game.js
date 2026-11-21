/* SPDX-License-Identifier: Apache-2.0 | Copyright 2026 alvations (Melon Lab)
 * Numberics Seven: browser client. engine.js owns every rule; this file draws, listens and remembers.
 * A drop returns a wave-by-wave trace; the client plays it one step at a time (instantly under reduced motion). */
(function () {
  "use strict";
  var N = window.NumbericsSeven, K = window.NumbericsKit, P = window.NumbericsPower;
  var W = N.W, H = N.H;
  var store = K.store("numberics_seven_v1");
  var STEP = K.reducedMotion() ? 0 : 170;
  var REVEAL = 1500; // R13: the final well stays in view, undimmed, this long before the end card
  // a fine pointer with hover means a keyboard is likely: only then mention Esc and the arrow keys
  var desk = false;
  try { desk = window.matchMedia("(hover: hover) and (pointer: fine)").matches; } catch (e) { desk = false; }
  var kbd = false; // the last power-up was armed from the keyboard

  // ---- saved data: one run per mode, best score per mode ----
  // Every field the client or engine reads is checked, and prev (the Undo snapshot) is checked the same way.
  function nat(v, min) { return Number.isInteger(v) && v >= (min || 0); }
  function validState(s, inner) {
    return !!s && typeof s === "object" && N.MODES.indexOf(s.mode) >= 0 && Array.isArray(s.grid) && s.grid.length === W * H &&
      s.grid.every(function (v) { return Number.isInteger(v) && v >= 0 && v <= 9; }) &&
      Number.isInteger(s.next) && s.next >= 1 && s.next <= N.EGG && Number.isInteger(s.held) && s.held >= 0 && s.held <= N.EGG &&
      typeof s.score === "number" && s.score >= 0 && nat(s.seed) && nat(s.drops) && nat(s.level, 1) && nat(s.left, 1) &&
      nat(s.bestChain) && nat(s.luckies) && nat(s.used) && typeof s.over === "boolean" &&
      (s.free === undefined || typeof s.free === "boolean") &&
      (s.out === undefined || (Array.isArray(s.out) && s.out.every(function (c) { return nat(c) && c < W; }))) &&
      (s.overflow === undefined || s.overflow === null || (Array.isArray(s.overflow) && s.overflow.length > 0 &&
        s.overflow.every(function (c) { return nat(c) && c < W; }) && !s.over)) &&
      !!s.power && N.POWERS.every(function (p) { return Number.isInteger(s.power[p]) && s.power[p] >= 0 && s.power[p] <= P.CAP; }) &&
      (s.prev === null || s.prev === undefined || (!inner && validState(s.prev, true)));
  }
  var saved = store.load() || {};
  var runs = {}, best = { classic: 0, blitz: 0, daily: 0 }, start = {};
  var today = K.daySeed();
  var sameDay = saved.day === today; // the Daily best is today's best: a new day starts it at 0
  N.MODES.forEach(function (m) {
    var r = saved.runs && saved.runs[m];
    if (validState(r) && r.mode === m && (m !== "daily" || sameDay)) runs[m] = r;
    var b = saved.best && saved.best[m]; if (typeof b === "number" && b >= 0 && (m !== "daily" || sameDay)) best[m] = b;
    var a = saved.start && saved.start[m]; start[m] = typeof a === "number" && a >= 0 && a <= best[m] ? a : best[m];
  });
  var mode = N.MODES.indexOf(saved.mode) >= 0 ? saved.mode : "classic";
  function fresh(m) { return N.newGame(m === "daily" ? today : K.freshSeed(), m); }
  // a tab left open past midnight: the next Daily is today's, with today's best
  function checkDay() {
    var d = K.daySeed(); if (d === today) return;
    today = d; delete runs.daily; best.daily = 0; start.daily = 0;
  }
  function newRun(m) { if (m === "daily") checkDay(); start[m] = best[m]; return fresh(m); }
  var state = runs[mode] || newRun(mode);
  var cursor = 3, targeting = null, aim = -1, viewing = false, note = "", revealing = false, revealT = null, carded = false;
  var timers = [], busy = false, gen = 0, shownScore = state.score, shownBest = Math.max(best[mode], state.score);

  var $ = function (id) { return document.getElementById(id); };
  var boardEl = $("board"), discsEl = $("discs"), cellsEl = $("cells");
  for (var i = 0; i < W * H; i++) { var d = document.createElement("div"); if (i < W) d.className = "top"; cellsEl.appendChild(d); }
  var els = {};

  function persist() {
    runs[mode] = state;
    if (!state.overflow) best[mode] = Math.max(best[mode], state.score); // a run on the brink is not a result yet
    store.save({ mode: mode, runs: runs, best: best, start: start, day: today });
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
  function mini(v, cls) {
    var m = document.createElement("em"); m.className = "mini" + (v === N.EGG ? " egg" : v === N.CRACKED ? " cracked" : "") + (cls ? " " + cls : "");
    if (v >= 1 && v <= 7) { m.style.setProperty("--h", K.hue(v)); m.textContent = String(v); }
    else if (v === N.EGG && cls === "label") m.textContent = "egg"; // the Next pill names an egg, so it never reads as a blank disc
    m.setAttribute("aria-label", v === N.EGG ? "egg" : "disc " + v);
    return m;
  }
  function drawGrid(grid) {
    discsEl.textContent = ""; els = {};
    grid.forEach(function (v, cell) { if (v) els[cell] = makeDisc(v, cell); });
    markOut(state.over ? state.out : state.overflow);
  }
  // the discs the rising eggs would push out of the top: ringed red on the final board
  function markOut(out) {
    (out || []).forEach(function (c) { if (els[c]) { els[c].classList.add("out"); els[c].setAttribute("aria-label", els[c].getAttribute("aria-label") + ", pushed out"); } });
  }
  // targeting marks: the Smash aim (arrow keys) or the eggs a Crack would crack
  function drawAim() {
    Array.prototype.forEach.call(discsEl.querySelectorAll(".aim"), function (e) { e.remove(); });
    var cells = targeting === "smash" && aim >= 0 ? [aim] : targeting === "crack" ? N.crackTargets(state.grid) : [];
    cells.forEach(function (c) { var a = document.createElement("div"); a.className = "disc aim"; a.setAttribute("aria-hidden", "true"); place(a, c); discsEl.appendChild(a); });
  }
  function drawGhost() {
    var old = discsEl.querySelector(".ghost"); if (old) old.remove();
    if (state.over || state.overflow || targeting || busy) return;
    var r = N.landing(state.grid, cursor); if (r < 0) return;
    var g = makeDisc(state.next, r * W + cursor, "ghost"); g.setAttribute("aria-hidden", "true");
  }
  function drawCursor() {
    Array.prototype.forEach.call(cellsEl.children, function (c, i) { c.classList.toggle("col", !targeting && !state.over && !state.overflow && i % W === cursor); });
  }
  var EARN = "Earn one with a chain of 3 waves or a Lucky Seven, not on the drop right after a power-up.";
  var DEFS = [
    { id: "undo", label: "Undo", desc: "Take back the last drop.", earn: EARN },
    { id: "smash", label: "Smash", desc: "Remove one disc.", earn: EARN },
    { id: "hold", label: "Hold", desc: "Set the next disc aside. Hold again to swap it back.", earn: EARN },
    { id: "crack", label: "Crack", desc: "Crack every egg touching a disc.", earn: EARN },
  ];
  // the cancel hint names Esc and the keys only when a keyboard is likely (critic nit 4)
  var HINT = { smash: "Tap a disc to smash it. Tap Smash to cancel.", crack: "Tap the well to crack. Tap Crack to cancel." };
  var KHINT = { smash: "Tap a disc, or arrows + Enter. Esc cancels.", crack: "Tap the well, or Enter. Esc cancels." };
  function targetHint() { return (desk || kbd ? KHINT : HINT)[targeting]; }
  // near-full warning and a nudge toward the power-ups before the overflow (cold #9); "" when the well is safe
  function colName(cs) {
    var n = cs.map(function (c) { return c + 1; });
    return n.length === 1 ? "Column " + n[0] : "Columns " + n.slice(0, -1).join(", ") + " and " + n[n.length - 1];
  }
  function warnText() {
    var d = N.danger(state.grid), is = function (cs) { return cs.length === 1 ? " is" : " are"; };
    if (d.top.length) {
      return colName(d.top) + is(d.top) + " at the top: " + (state.power.smash > 0 ? "Smash before the eggs rise."
        : N.canUseAny(state) ? "a power-up may help." : "the next rise ends the run.");
    }
    if (d.near.length) return colName(d.near) + is(d.near) + " one disc from the top.";
    return "";
  }
  // why a power-up cannot act now (a reason string), or "" when it can (the count is checked by the tray)
  function why(id) {
    if (state.over) return "The run is over.";
    if (state.overflow && id !== "undo") return "The well overflowed: Undo the last drop, or end the run.";
    if (id === "undo" && !state.prev) return "Nothing to take back yet.";
    if (id === "crack" && !N.crackable(state.grid)) return "No egg touches a disc right now.";
    if (id === "smash" && !state.grid.some(Boolean)) return "The well is empty.";
    return "";
  }
  function renderTray() {
    P.tray($("tray"), DEFS, state.power, {
      armed: targeting, disabled: why, onUse: activate, onInfo: function (id, t) { say(t); },
    });
    var hb = $("tray").children[2];
    if (state.held) hb.insertBefore(mini(state.held, "held"), hb.firstChild);
  }
  function say(t) { note = t; $("hint").textContent = t; }
  function showScore() {
    shownBest = Math.max(shownBest, shownScore); // BEST never trails SCORE, even mid-animation
    var b = $("best"); $("score").textContent = K.fmt(shownScore);
    b.textContent = shownBest ? K.fmt(shownBest) : "none"; b.classList.toggle("none", !shownBest); // R11: empty says none
  }
  function hintText() {
    if (note) return note;
    if (targeting) return targetHint();
    if (state.overflow) return revealing ? "Overflowed: the ringed discs would be pushed out." : "";
    if (state.over) {
      if (revealing) return N.hasRoom(state.grid) ? "Overflowed: the ringed discs are pushed out." : "No room left, and no power-up can act.";
      return !viewing ? "" : N.hasRoom(state.grid) ? "Ringed discs were pushed out. Tap for the summary."
        : "Full, and no power-up can act. Tap for the summary.";
    }
    if (!N.hasRoom(state.grid)) return "The well is full. Use a power-up to make room.";
    var warn = warnText(); if (warn) return warn;
    return "Level " + state.level + " · " + (state.left === 1 ? "eggs rise after this drop." : state.left + " drops until the eggs rise.");
  }
  function renderChrome() {
    showScore();
    var nx = $("next"); nx.textContent = ""; nx.appendChild(mini(state.next, "label"));
    var pips = $("pips"), total = N.dropsFor(state.mode, state.level); pips.textContent = "";
    for (var k = 0; k < total; k++) { var p = document.createElement("i"); if (k >= state.left) p.className = "used"; pips.appendChild(p); }
    pips.title = state.left + " drops until the eggs rise";
    pips.setAttribute("aria-label", pips.title);
    Array.prototype.forEach.call($("modes").children, function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-mode") === mode)); });
    renderTray();
    $("hint").textContent = hintText();
    boardEl.classList.toggle("targeting", !!targeting);
    drawCursor(); drawGhost(); drawAim();
    // one end-card pattern (TRIAGE3): while a card shows, the page's New game is hidden with its space kept, and
    // focus moves to the card's primary button. On the brink (TRIAGE3 stuck-not-over) the card offers Undo or End.
    var brink = !!state.overflow, over = $("over");
    over.hidden = !(brink || (state.over && !viewing)) || revealing;
    $("new").style.visibility = over.hidden ? "" : "hidden";
    $("over-undo").hidden = $("over-end").hidden = !brink;
    $("over-view").hidden = $("again").hidden = brink;
    if (brink) {
      $("over-title").textContent = "The well overflowed";
      $("over-text").textContent = "Undo the last drop to keep going, or end the run.";
      $("over-best").hidden = true;
    } else if (state.over) {
      $("over-title").textContent = N.hasRoom(state.grid) ? "The well overflowed" : "No room left";
      var u = state.used;
      $("over-text").textContent = "Level " + state.level + (u ? " · " + u + (u === 1 ? " power-up" : " power-ups") : "") +
        " · score " + K.fmt(state.score);
      $("over-best").hidden = !(state.score > start[mode]);
    }
    if (!over.hidden && !carded) { try { $(brink ? "over-undo" : "again").focus({ preventScroll: true }); } catch (e) { /* a nicety */ } }
    carded = !over.hidden;
  }
  function render() { drawGrid(state.grid); shownScore = state.score; shownBest = Math.max(best[mode], state.score); renderChrome(); }

  // ---- R13: a run that ends keeps the final well in view for REVEAL ms, then the end card shows ----
  function endReveal() {
    clearTimeout(revealT); revealT = null;
    if (!revealing) return false;
    revealing = false; renderChrome(); return true;
  }
  // the done callback of every trace: draw the settled well, and if the run just ended (or overflowed with an Undo
  // in stock), hold it in view first
  function settle() {
    render();
    if (!state.over && !state.overflow) return;
    revealing = true; renderChrome();
    var g = gen; clearTimeout(revealT);
    revealT = setTimeout(function () { if (g !== gen) return; endReveal(); }, REVEAL);
  }

  // ---- playing a trace, one step at a time; every timer checks its generation ----
  function flush() {
    if (!busy) return;
    timers.forEach(clearTimeout); timers = []; busy = false; gen++; settle(); // a skipped ending still holds the well in view
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
    shownScore += step.points || 0; showScore();
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
    else if (step.type === "rise" && step.overflow) markOut(step.out);
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
    // R2 and R15 say why a reward did not pay, in the neutral toast, never the gold one
    var plain = !res.awarded.length && (res.unpaid.length || res.full.length);
    if (res.unpaid.length) parts.push("No reward after a power-up.");
    else if (res.full.length) parts.push("Power-ups full.");
    if (parts.length) K.toast(parts.join("  "), plain ? "info" : undefined);
  }

  // ---- actions ----
  // before a state change that plays a trace: the shown numbers start from where they were
  function commit(next) {
    var before = state.score, b = Math.max(best[mode], before);
    state = next; persist(); shownScore = before; shownBest = b;
  }
  function doDrop(col) {
    flush(); note = "";
    if (targeting || state.over) return;
    if (state.overflow) { endReveal(); return; } // on the brink a drop is refused: the card asks Undo or End
    cursor = col;
    var res = N.drop(state, col);
    if (!res.ok) { K.toast("That column is full", "bad"); return renderChrome(); }
    commit(res.state);
    announce(res);
    play(res.trace, settle);
  }
  function activate(id, fromKey) {
    flush(); endReveal(); note = ""; kbd = !!fromKey;
    if (targeting === id) { targeting = null; return renderChrome(); }
    targeting = null;
    var d = DEFS[N.POWERS.indexOf(id)], w = why(id);
    if (!state.power[id] || w) { renderChrome(); return say(P.info(d, state.power, w, {})); } // a key press explains, like a tap
    if (id === "smash") { targeting = "smash"; aim = topOf(cursor); if (aim < 0) aim = state.grid.findIndex(Boolean); return renderChrome(); }
    if (id === "crack") { targeting = "crack"; return renderChrome(); }
    var u = N.use(state, id);
    if (!u.ok) return renderChrome();
    state = u.state; persist();
    if (id === "undo") { K.toast("Took back one drop"); return render(); }
    K.toast("Held " + (state.held >= 1 && state.held <= 7 ? state.held : "the egg")); renderChrome();
  }
  function crackNow() {
    var u = N.use(state, "crack"); targeting = null;
    if (!u.ok) return renderChrome();
    commit(u.state); K.toast("Crack!"); renderChrome(); play(u.trace, settle);
  }
  function smashAt(cell) {
    var u = N.use(state, "smash", cell);
    if (!u.ok) { K.toast("Pick a disc", "bad"); return; }
    targeting = null; commit(u.state); K.toast("Smash!");
    renderChrome(); play(u.trace, settle);
  }
  function moveAim(dc, dr) {
    if (aim < 0) aim = cursor;
    var r = Math.max(0, Math.min(H - 1, Math.floor(aim / W) + dr)), c = Math.max(0, Math.min(W - 1, aim % W + dc));
    aim = r * W + c; cursor = c; drawAim();
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
    if (state.over || state.overflow) { if (busy) return flush(); if (endReveal()) return; if (viewing) { viewing = false; note = ""; renderChrome(); } return; }
    var p = cellAt(ev);
    if (targeting === "smash") { flush(); note = ""; smashAt(p.r * W + p.c); return; }
    if (targeting === "crack") { flush(); note = ""; crackNow(); return; }
    doDrop(p.c);
  });
  boardEl.addEventListener("mousemove", function (ev) {
    if (busy || targeting) return;
    var c = cellAt(ev).c; if (c !== cursor) { cursor = c; drawCursor(); drawGhost(); }
  });
  window.addEventListener("keydown", function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var tag = (e.target && e.target.tagName) || "";
    // R17: Enter or Space on a focused link, button or field is that control's own action, never a drop
    if ((e.key === "Enter" || e.key === " ") && /^(A|BUTTON|INPUT|SELECT|TEXTAREA)$/.test(tag)) return;
    if (e.key === "Escape") { targeting = null; note = ""; if (viewing) viewing = false; endReveal(); return renderChrome(); }
    var pi = ["1", "2", "3", "4"].indexOf(e.key);
    if (pi >= 0) { e.preventDefault(); return activate(N.POWERS[pi], true); }
    if (e.key === "u" || e.key === "U") return activate("undo", true);
    if (targeting === "smash" && /^Arrow/.test(e.key)) {
      e.preventDefault();
      return moveAim(e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : 0, e.key === "ArrowUp" ? -1 : e.key === "ArrowDown" ? 1 : 0);
    }
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      cursor = Math.max(0, Math.min(W - 1, cursor + (e.key === "ArrowLeft" ? -1 : 1)));
      if (!busy) { drawCursor(); drawGhost(); }
      return;
    }
    var go = e.key === "Enter" || e.key === " " || e.key === "ArrowDown";
    if (!go) return;
    e.preventDefault();
    if (state.over || state.overflow) { if (busy) return flush(); if (endReveal()) return; if (viewing) { viewing = false; renderChrome(); } return; }
    note = "";
    if (targeting === "smash") { flush(); if (aim >= 0 && state.grid[aim]) smashAt(aim); else K.toast("Pick a disc", "bad"); return; }
    if (targeting === "crack") { flush(); return crackNow(); }
    doDrop(cursor);
  });

  function startNew() {
    flush(); endReveal(); targeting = null; viewing = false; note = "";
    state = newRun(mode); persist(); render();
  }
  K.twoStep($("new"), function () { return state.drops > 0 && !state.over; }, startNew);
  $("again").addEventListener("click", startNew);
  $("over-undo").addEventListener("click", function () {
    activate("undo"); try { boardEl.focus({ preventScroll: true }); } catch (e) { /* a nicety */ } // its button is gone
  });
  $("over-end").addEventListener("click", function () {
    var r = N.end(state); if (!r.ok) return renderChrome();
    flush(); endReveal(); note = ""; state = r.state; persist(); carded = false; render();
  });
  $("over-view").addEventListener("click", function () { viewing = true; note = ""; renderChrome(); boardEl.focus(); });
  Array.prototype.forEach.call($("modes").children, function (b) {
    b.addEventListener("click", function () {
      var m = b.getAttribute("data-mode"); if (m === mode) return;
      flush(); endReveal(); targeting = null; viewing = false; note = ""; persist();
      if (m === "daily") checkDay();
      mode = m; state = runs[m] || newRun(m); persist(); render();
      K.toast(m === "daily" ? "Daily: the same well for everyone today" : m === "blitz" ? "Blitz: eggs rise every 5 drops" : "Classic");
    });
  });

  render();

  // Screenshot hook (tools/shots.cjs): a fixed, representative mid-game. Not reachable from the UI.
  window.__demo = function () {
    flush(); endReveal(); targeting = null;
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
    mode = "classic"; state = s; cursor = 3; viewing = false; note = ""; best.classic = Math.max(best.classic, 0);
    render();
  };
  window.__seven = {
    get state() { return state; }, set state(s) { flush(); endReveal(); targeting = null; viewing = false; note = ""; state = s; render(); },
    get mode() { return mode; }, get cursor() { return cursor; }, get busy() { return busy; },
    get targeting() { return targeting; }, get aim() { return aim; }, get viewing() { return viewing; }, get revealing() { return revealing; },
    render: render, flush: flush,
  };
})();
