/* SPDX-License-Identifier: Apache-2.0 | Copyright 2026 alvations (Melon Lab)
 * Numberics Seven: browser client. engine.js owns every rule; this file draws, listens and remembers.
 * A drop returns a wave-by-wave trace; the client plays it on NumbericsMotion's keyed layer (REDESIGN.md 5.5): the disc
 * falls with gravity and settles, each wave pops, cracks its eggs and lets the column above fall, the rising row slides
 * up. Every disc keeps its node (identity-keyed, never rebuilt per drop). A new input finishes the running animation
 * (end state at once, pending sounds dropped) and is applied at once. Under reduced motion (Settings, then the OS, read
 * at each drop) the settled well shows at once and new discs fade in. */
(function () {
  "use strict";
  var N = window.NumbericsSeven, K = window.NumbericsKit, P = window.NumbericsPower, M = window.NumbericsMotion;
  var A = window.NumbericsAudio, TR = window.NumbericsTrophies, PG = window.NumbericsProgress;
  var W = N.W, H = N.H, T = M.T, E = M.E;
  var store = K.store("numberics_seven_v1");
  // sounds and haptics (REDESIGN.md 6.4, 7.3), called at the visual moment from inside the motion timeline; while
  // finish() runs the pending steps at once, `skipping` drops their sounds instead of bunching them
  var skipping = false;
  function sfx(name, arg) { if (skipping || !A || typeof A[name] !== "function") return; try { A[name](arg); } catch (e) { /* silent */ } }
  function buzz(kind) { if (skipping || !A || typeof A.buzz !== "function") return; try { A.buzz(kind); } catch (e) { /* silent */ } }
  function duck(on) { try { if (window.NumbericsMusic && window.NumbericsMusic.duck) window.NumbericsMusic.duck(on); } catch (e) { /* silent */ } }
  function trophy(ev, data) {
    if (!TR || !TR.report) return [];
    try { var got = TR.report("seven", ev, data) || []; got.forEach(function (id) { if (runTro[mode].indexOf(id) < 0) runTro[mode].push(id); }); return got; }
    catch (e) { return []; }
  }
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
  var loaded = store.load(), saved = loaded || {};
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
  // the Today card's chip links here with ?mode=daily (REDESIGN.md 3.4): open the Daily (every mode keeps its own run)
  try { if (/(^|[?&])mode=daily(&|$)/.test(window.location.search)) mode = "daily"; } catch (e) { /* no location */ }
  // the trophies earned in each mode's current run, shown as pills on its end card (8.1)
  var runTro = { classic: [], blitz: [], daily: [] };
  N.MODES.forEach(function (m) {
    var a = saved.tro && saved.tro[m];
    if (Array.isArray(a) && runs[m]) runTro[m] = a.filter(function (id) { return typeof id === "string"; }).slice(0, 20);
  });
  function fresh(m) { return N.newGame(m === "daily" ? today : K.freshSeed(), m); }
  // a tab left open past midnight: the next Daily is today's, with today's best
  function checkDay() {
    var d = K.daySeed(); if (d === today) return;
    today = d; delete runs.daily; best.daily = 0; start.daily = 0;
  }
  function newRun(m) { if (m === "daily") checkDay(); start[m] = best[m]; runTro[m] = []; return fresh(m); }
  var state = runs[mode] || newRun(mode);
  var cursor = 3, targeting = null, aim = -1, viewing = false, note = "", revealing = false, revealT = null, carded = false;
  var seq = M.seq(), gen = 0, fxAnims = [], shownScore = state.score, shownBest = Math.max(best[mode], state.score), shownNext = null, ducked = false;
  function busy() { return seq.busy(); }

  var $ = function (id) { return document.getElementById(id); };
  var boardEl = $("board"), discsEl = $("discs"), cellsEl = $("cells");
  for (var i = 0; i < W * H; i++) { var d = document.createElement("div"); if (i < W) d.className = "top"; cellsEl.appendChild(d); }

  function persist() {
    runs[mode] = state;
    if (!state.overflow) best[mode] = Math.max(best[mode], state.score); // a run on the brink is not a result yet
    store.save({ mode: mode, runs: runs, best: best, start: start, day: today, tro: runTro });
    // the card summary (REDESIGN.md 3.5): the best of Classic and Blitz (the Daily best is only today's), and this run
    var b = Math.max(best.classic, best.blitz), live = state.drops > 0 && !state.over;
    try { if (PG && PG.put) PG.put("seven", { best: b ? "Best " + K.fmt(b) : "", live: live, liveText: live ? "Score " + K.fmt(state.score) : "" }); }
    catch (e) { /* the card is a nicety */ }
  }

  // ---- drawing ----
  // a ghost or aim mark: a plain node in the layer (not a disc: the layer never touches it)
  function paint(el, v) {
    el.classList.remove("egg", "cracked");
    el.textContent = "";
    if (v === N.EGG) el.classList.add("egg");
    else if (v === N.CRACKED) el.classList.add("cracked");
    else { el.style.setProperty("--h", K.hue(v)); el.textContent = String(v); }
  }
  function place(el, cell) { el.style.setProperty("--r", Math.floor(cell / W)); el.style.setProperty("--c", cell % W); }
  function makeDisc(v, cell, cls) {
    var el = document.createElement("div"); el.className = "disc" + (cls ? " " + cls : "");
    paint(el, v); place(el, cell); discsEl.appendChild(el); return el;
  }
  // ---- the discs: NumbericsMotion's keyed layer. ids[cell] is the client's identity map (never in the save) ----
  function makeNode() {
    var n = document.createElement("div"), f = document.createElement("div");
    n.className = "disc"; f.className = "face"; n.appendChild(f); return n;
  }
  function paintNode(n, t) {
    var v = t.v, f = n.firstChild;
    n.classList.toggle("egg", v === N.EGG); n.classList.toggle("cracked", v === N.CRACKED);
    if (v >= 1 && v <= 7) { n.style.setProperty("--h", K.hue(v)); f.textContent = String(v); n.setAttribute("aria-label", "disc " + v); }
    else { f.textContent = ""; n.setAttribute("aria-label", v === N.EGG ? "egg" : "cracked egg"); }
  }
  var layer = M.layer(discsEl, { cols: W, rows: H, clip: true, make: makeNode, paint: paintNode });
  var ids = [], nextId = 1;
  function tilesOf(grid, map) { var out = []; for (var c = 0; c < W * H; c++) if (grid[c]) out.push({ id: map[c], cell: c, v: grid[c] }); return out; }
  function rekey(grid) { var r = M.rekey(grid, nextId); ids = r.ids; nextId = r.next; }
  function keyed(grid) { for (var c = 0; c < W * H; c++) if (!grid[c] !== !ids[c]) return false; return true; }
  var drawn = "";
  // while finish() runs the steps left, each lands without motion (no pitch read, no animation made and then cancelled)
  function syncLayer(grid, fx) { drawn = grid.join(","); layer.sync(tilesOf(grid, ids), skipping ? {} : fx); }
  function nodeAt(cell) { return ids[cell] ? layer.get(ids[cell]) : null; }
  function mini(v, cls) {
    var m = document.createElement("em"); m.className = "mini" + (v === N.EGG ? " egg" : v === N.CRACKED ? " cracked" : "") + (cls ? " " + cls : "");
    if (v >= 1 && v <= 7) { m.style.setProperty("--h", K.hue(v)); m.textContent = String(v); }
    else if (v === N.EGG && cls === "label") m.textContent = "egg"; // the Next pill names an egg, so it never reads as a blank disc
    m.setAttribute("aria-label", v === N.EGG ? "egg" : "disc " + v);
    return m;
  }
  // the settled well, without motion (fade: a re-keyed well cross-fades in, as after Undo or a New game)
  function drawGrid(grid, fade) {
    var same = !fade && keyed(grid) && drawn === grid.join(",");
    if (fade || !keyed(grid)) rekey(grid);
    Array.prototype.forEach.call(discsEl.querySelectorAll(".disc.out"), function (e) { e.classList.remove("out"); });
    if (!same) syncLayer(grid, fade ? { fade: true } : {}); // an unchanged well keeps its nodes and their motion
    markOut(state.over ? state.out : state.overflow);
  }
  // the discs the rising eggs would push out of the top: ringed red on the final board
  function markOut(out) {
    (out || []).forEach(function (c) {
      var el = nodeAt(c); if (!el || el.classList.contains("out")) return;
      el.classList.add("out"); el.setAttribute("aria-label", el.getAttribute("aria-label") + ", pushed out");
    });
  }
  // targeting marks: the Smash aim (arrow keys) or the eggs a Crack would crack
  function drawAim() {
    Array.prototype.forEach.call(discsEl.querySelectorAll(".aim"), function (e) { e.remove(); });
    var cells = targeting === "smash" && aim >= 0 ? [aim] : targeting === "crack" ? N.crackTargets(state.grid) : [];
    cells.forEach(function (c) { var a = document.createElement("div"); a.className = "disc aim"; a.setAttribute("aria-hidden", "true"); place(a, c); discsEl.appendChild(a); });
  }
  function drawGhost() {
    var old = discsEl.querySelector(".ghost"); if (old) old.remove();
    if (state.over || state.overflow || targeting || busy()) return;
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
      armed: targeting, disabled: why, onUse: function (id, k) { sfx("tick"); activate(id, k); }, onInfo: function (id, t) { say(t); },
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
    var nx = $("next");
    if (shownNext !== state.next || !nx.firstChild) {
      var dropIn = shownNext !== null; shownNext = state.next;
      nx.textContent = ""; var mn = mini(state.next, "label"); nx.appendChild(mn);
      // the preview drops in from the top: it is the disc that will fall (9.7); reduced motion: a fade
      if (dropIn) M.play(mn, [{ transform: "translateY(-120%)", opacity: 0 }, { transform: "translateY(0)", opacity: 1 }],
        { duration: M.fallMs(1), easing: E.fall }, [{ opacity: 0 }, { opacity: 1 }]);
    }
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
    over.hidden = !(brink || (state.over && !viewing)) || revealing || busy(); // the well settles before any card
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
    // one pill per trophy earned in this run (8.1), on the end card only
    if (TR && TR.pills) TR.pills($("over-pills"), state.over ? runTro[mode] : []); else $("over-pills").hidden = true;
    if (!over.hidden && !carded) {
      try { $(brink ? "over-undo" : "again").focus({ preventScroll: true }); } catch (e) { /* a nicety */ }
      if (state.over) { // the end card's moment: a new best, a Daily finished, or the run over (7.3)
        if (state.score > start[mode]) { sfx("best"); buzz("win"); }
        else if (mode === "daily") { sfx("win"); buzz("win"); }
        else { sfx("lose"); buzz("lose"); }
      }
    }
    carded = !over.hidden;
    var duckNow = carded && !!state.over; // the music steps back while the end card shows
    if (duckNow !== ducked) { ducked = duckNow; duck(duckNow); }
  }
  function render(fade) { drawGrid(state.grid, fade); shownScore = state.score; shownBest = Math.max(best[mode], state.score); renderChrome(); }

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

  // ---- playing a trace on the keyed layer (REDESIGN.md 5.5). plan() is pure: it walks the engine's trace and gives
  // each step the identity map before and after it, so the timeline only syncs the layer; finish() runs the steps
  // left at once, in order, and the well lands on the engine's grid. ----
  function plan(trace, from) {
    var cur = from.slice(), out = [];
    trace.forEach(function (step) {
      var prev = cur, map = prev.slice(), extra = {};
      if (step.type === "drop") { map[step.cell] = nextId++; extra.id = map[step.cell]; }
      else if (step.type === "wave" || step.type === "smash") {
        var gone = step.type === "wave" ? step.pops : [step.cell];
        extra.gone = gone.map(function (c) { return prev[c]; });
        if (step.cracks) extra.cracks = step.cracks.map(function (k) { return { id: prev[k.cell], v: k.to }; });
        gone.forEach(function (c) { map[c] = 0; });
        var moved = step.falls.map(function (f) { return { id: map[f.from], from: f.from, to: f.to }; });
        moved.forEach(function (f) { map[f.from] = 0; });
        moved.forEach(function (f) { map[f.to] = f.id; });
        extra.falls = moved.map(function (f) { return { id: f.id, rows: Math.round((f.to - f.from) / W) }; });
      } else if (step.type === "lucky" || step.type === "crack") {
        extra.cracks = step.cracks.map(function (k) { return { id: prev[k.cell], v: k.to }; });
      } else if (step.type === "rise" && !step.overflow) {
        map = []; for (var c = 0; c < W * H; c++) map[c] = c < W * (H - 1) ? prev[c + W] : nextId++;
      }
      cur = map; out.push({ step: step, prev: prev, ids: map, x: extra });
    });
    return out;
  }
  // an egg cracking: the cracked face cross-fades in over 120 ms with a 1-shot 2% wobble (reduced: the fade only)
  function crackFx(list) {
    list.forEach(function (k) {
      var n = layer.get(k.id); if (!n) return;
      paintNode(n, { v: k.v });
      var a = M.play(n.firstChild, [{ opacity: 0.35 }, { opacity: 1 }], { duration: 120, easing: "linear" }, [{ opacity: 0.35 }, { opacity: 1 }]);
      var b = M.play(n.firstChild, [{ transform: "translateX(0)" }, { transform: "translateX(2%) rotate(2deg)", offset: 0.3 },
        { transform: "translateX(-2%) rotate(-2deg)", offset: 0.65 }, { transform: "translateX(0)" }], { duration: 180, easing: E.out, composite: "add" });
      if (a) fxAnims.push(a); if (b) fxAnims.push(b);
    });
  }
  function popFx(idsGone) {
    idsGone.forEach(function (id) {
      var n = layer.get(id); if (!n) return;
      var a = M.play(n.firstChild, [{ transform: "scale(1)", opacity: 1 }, { transform: "scale(1.18)", opacity: 1, offset: 0.4 },
        { transform: "scale(.2)", opacity: 0 }], { duration: T.popOut, easing: E.out, fill: "forwards" }, [{ opacity: 1 }, { opacity: 0 }]);
      if (a) fxAnims.push(a);
    });
  }
  function maxRows(falls) { return falls.reduce(function (m, f) { return Math.max(m, f.rows); }, 0); }
  function clearFx() {
    fxAnims.forEach(function (a) { try { a.cancel(); } catch (e) { /* gone */ } }); fxAnims = [];
    discsEl.classList.remove("rising");
  }
  // a new input: the running animation ends now (every pending step runs, its sounds dropped), then the input applies
  function flush() {
    if (!busy()) return;
    skipping = true;
    try { seq.finish(); } finally { skipping = false; }
    clearFx(); layer.finish();
  }
  function play(trace, done) {
    var steps = plan(trace, ids), at = 0; gen++;
    var old = discsEl.querySelector(".ghost"); if (old) old.remove();
    if (M.reduced()) { // the settled well at once: new discs fade in, popped ones go, the score lands in one step
      var last = steps.length ? steps[steps.length - 1] : null, top = 0, any = false;
      steps.forEach(function (s) {
        shownScore += s.step.points || 0;
        if (s.step.type === "wave") top = Math.max(top, s.step.wave);
        if (s.step.type === "drop" || (s.x.falls && s.x.falls.length)) any = true;
      });
      if (last) { ids = last.ids; syncLayer(last.step.grid || state.grid, { fade: true }); }
      if (any) sfx("land");
      if (top) { sfx("pop", top); buzz(top >= 3 ? "big" : "merge"); } else if (any) buzz("tap");
      showScore(); done(); return;
    }
    function score(s) { shownScore += s.step.points || 0; showScore(); }
    // the first beat is written inside the input handler (REDESIGN.md 10: input to first visual change <= 1 frame)
    var seqAt = function (t, fn) { if (t === 0) fn(); else seq.at(t, fn); };
    steps.forEach(function (s) {
      var st = s.step, x = s.x, t0 = at;
      if (st.type === "drop") {
        var d = M.fallMs(st.row + 1);
        seqAt(t0, function () { clearFx(); ids = s.ids; syncLayer(st.grid, { falls: [{ id: x.id, rows: st.row + 1 }] }); score(s); });
        seqAt(t0 + d, function () { sfx("land"); buzz("tap"); });
        at = t0 + d + T.settle;
      } else if (st.type === "wave" || st.type === "smash") {
        var fall = maxRows(x.falls), fd = fall ? M.fallMs(fall) : 0, out = st.type === "wave" ? T.popOut : T.fade;
        seqAt(t0, function () {
          clearFx();
          if (st.type === "wave") { popFx(x.gone); sfx("pop", st.wave); buzz(st.wave >= 3 ? "big" : "merge"); }
          if (x.cracks) crackFx(x.cracks);
          score(s);
          if (st.type === "smash") { ids = s.ids; syncLayer(st.grid, { out: x.gone, falls: x.falls }); }
        });
        if (st.type === "wave") seqAt(t0 + out, function () { ids = s.ids; syncLayer(st.grid, { falls: x.falls }); });
        var landAt = (st.type === "wave" ? t0 + out : t0) + fd;
        if (fall) seqAt(landAt, function () { sfx("land"); });
        at = Math.max(t0 + out, landAt + (fall ? T.settle : 0)) + T.waveGap;
      } else if (st.type === "lucky" || st.type === "crack") {
        seqAt(t0, function () { clearFx(); crackFx(x.cracks); score(s); if (st.type === "lucky") buzz("big"); });
        seqAt(t0 + 120, function () { ids = s.ids; syncLayer(st.grid, {}); });
        at = t0 + 180 + T.waveGap;
      } else if (st.type === "rise" && st.overflow) {
        seqAt(t0, function () { clearFx(); markOut(st.out); score(s); buzz("lose"); });
      } else if (st.type === "rise") {
        // the whole stack moves up one pitch over 180 ms and the new egg row fades in (5.5)
        seqAt(t0, function () {
          clearFx(); discsEl.classList.add("rising"); ids = s.ids;
          syncLayer(st.grid, { fade: true }); score(s); sfx("slide");
        });
        seqAt(t0 + 180, function () { discsEl.classList.remove("rising"); });
        at = t0 + 180 + T.waveGap;
      } else seqAt(t0, function () { score(s); });
    });
    seq.at(at, function () { clearFx(); done(); });
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
    if (res.awarded.length) sfx("power");
  }

  // ---- actions ----
  // before a state change that plays a trace: the shown numbers start from where they were
  function commit(next) {
    var before = state.score, b = Math.max(best[mode], before);
    state = next; persist(); shownScore = before; shownBest = b;
  }
  // ---- trophies (REDESIGN.md 8.4): reported when the drop has settled on screen, so a toast never beats the well ----
  function dropEvent(res) {
    var popped = [], g = null;
    res.trace.forEach(function (st) {
      if (st.type === "wave" && g) st.pops.forEach(function (c) { popped.push(g[c]); });
      if (st.grid) g = st.grid;
    });
    return { waves: res.waves, popped: popped, sevens: popped.filter(function (v) { return v === 7; }).length,
      left: res.state.grid.filter(Boolean).length };
  }
  function finishRun() { // the run just ended: the end event, and today's Daily for the Today card
    trophy("end", { mode: mode, score: state.score, daily: mode === "daily" });
    if (mode === "daily") { try { if (PG && PG.daily) PG.daily("seven", K.fmt(state.score)); } catch (e) { /* a nicety */ } }
  }
  function settled(res, wasOver) {
    return function () {
      if (res && res.trace[0] && res.trace[0].type === "drop") {
        trophy("drop", dropEvent(res));
        if (res.trace.some(function (st) { return st.type === "rise" && !st.overflow; })) trophy("level", { level: state.level, mode: mode });
      }
      if (!wasOver && state.over) finishRun();
      persist(); settle();
    };
  }
  function doDrop(col) {
    flush(); note = "";
    if (targeting || state.over) return;
    if (state.overflow) { endReveal(); return; } // on the brink a drop is refused: the card asks Undo or End
    cursor = col;
    var res = N.drop(state, col);
    if (!res.ok) { K.toast("That column is full", "bad"); sfx("bad"); return renderChrome(); }
    var was = state.over;
    commit(res.state);
    announce(res);
    play(res.trace, settled(res, was));
    if (busy()) renderChrome(); // the tray, hint and stats update in the same handler as the drop (5.11)
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
    if (id === "undo") { K.toast("Took back one drop"); return render(true); }
    K.toast("Held " + (state.held >= 1 && state.held <= 7 ? state.held : "the egg")); renderChrome();
  }
  function crackNow() {
    var u = N.use(state, "crack"); targeting = null;
    if (!u.ok) return renderChrome();
    var was = state.over;
    commit(u.state); K.toast("Crack!"); play(u.trace, settled(null, was)); if (busy()) renderChrome();
  }
  function smashAt(cell) {
    var u = N.use(state, "smash", cell);
    if (!u.ok) { K.toast("Pick a disc", "bad"); return; }
    var was = state.over;
    targeting = null; commit(u.state); K.toast("Smash!");
    play(u.trace, settled(null, was)); if (busy()) renderChrome();
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
    if (state.over || state.overflow) { if (busy()) return flush(); if (endReveal()) return; if (viewing) { viewing = false; note = ""; renderChrome(); } return; }
    var p = cellAt(ev);
    if (targeting === "smash") { flush(); note = ""; smashAt(p.r * W + p.c); return; }
    if (targeting === "crack") { flush(); note = ""; crackNow(); return; }
    doDrop(p.c);
  });
  boardEl.addEventListener("mousemove", function (ev) {
    if (busy() || targeting) return;
    var c = cellAt(ev).c; if (c !== cursor) { cursor = c; drawCursor(); drawGhost(); }
  });
  window.addEventListener("keydown", function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (window.NumbericsUI && window.NumbericsUI.open && window.NumbericsUI.open()) return; // a sheet is open: no game keys
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
      if (!busy()) { drawCursor(); drawGhost(); }
      return;
    }
    var go = e.key === "Enter" || e.key === " " || e.key === "ArrowDown";
    if (!go) return;
    e.preventDefault();
    if (state.over || state.overflow) { if (busy()) return flush(); if (endReveal()) return; if (viewing) { viewing = false; renderChrome(); } return; }
    note = "";
    if (targeting === "smash") { flush(); if (aim >= 0 && state.grid[aim]) smashAt(aim); else K.toast("Pick a disc", "bad"); return; }
    if (targeting === "crack") { flush(); return crackNow(); }
    doDrop(cursor);
  });

  function startNew() {
    flush(); endReveal(); targeting = null; viewing = false; note = "";
    state = newRun(mode); persist(); render(true);
  }
  K.twoStep($("new"), function () { return state.drops > 0 && !state.over; }, startNew);
  $("again").addEventListener("click", function () { sfx("tick"); startNew(); });
  $("over-undo").addEventListener("click", function () {
    activate("undo"); try { boardEl.focus({ preventScroll: true }); } catch (e) { /* a nicety */ } // its button is gone
  });
  $("over-end").addEventListener("click", function () {
    var r = N.end(state); if (!r.ok) return renderChrome();
    flush(); endReveal(); note = ""; state = r.state; finishRun(); persist(); carded = false; render();
  });
  $("over-view").addEventListener("click", function () { viewing = true; note = ""; renderChrome(); boardEl.focus(); });
  Array.prototype.forEach.call($("modes").children, function (b) {
    b.addEventListener("click", function () {
      var m = b.getAttribute("data-mode"); if (m === mode) return;
      sfx("tick");
      flush(); endReveal(); targeting = null; viewing = false; note = ""; persist();
      if (m === "daily") checkDay();
      mode = m; state = runs[m] || newRun(m); persist(); render(true);
      K.toast(m === "daily" ? "Daily: the same well for everyone today" : m === "blitz" ? "Blitz: eggs rise every 5 drops" : "Classic");
    });
  });

  render();

  // ---- how to play (REDESIGN.md 1.3, 9.7): three steps, each a small drawn well and one sentence, in the shared sheet.
  // It opens by itself once, on a first visit with nothing saved; the How to play row under the board always has it. ----
  function md(v, cls) {
    var n = v >= 1 && v <= 7;
    return '<span class="md' + (cls ? " " + cls : "") + '"' + (n ? ' style="--h2:hsl(' + K.hue(v) + ' 62% 60%)"' : "") + ">" + (n ? v : "") + "</span>";
  }
  function well(cols, cells) { return '<div class="mg" style="grid-template-columns:repeat(' + cols + ',20px)">' + cells.join("") + "</div>"; }
  var STEPS = [
    { t: "Tap a column to drop the Next disc.", pv: well(5, [md(0), md(0), md(4, "ring"), md(0), md(0), md(0), md(0), md(0, "col"), md(0), md(0),
      md(2), md(0), md(0, "col"), md(6), md(5)]) },
    { t: "A disc pops when its number equals how many discs are in its line.", pv: well(5, [md(0), md(0), md(0), md(0), md(0),
      md(0), md(0), md(0), md(0), md(0), md(0), md(2), md(3, "ring"), md(5), md(0)]) },
    { t: "Grey eggs crack when a disc pops beside them.", pv: '<div class="mg" style="grid-template-columns:repeat(5,20px);align-items:center">' +
      md(0, "egg") + md(2, "ring") + md(0) + '<span class="to">&#8594;</span>' + md(0, "cracked") + "</div>" },
  ];
  function howto() {
    var U = window.NumbericsUI;
    try { if (PG && PG.markHowto) PG.markHowto("seven"); } catch (e) { /* a nicety */ }
    if (!U || !U.sheet) { $("how").open = true; return; }
    U.sheet("howto", function (body) {
      body.innerHTML = '<div class="howto">' + STEPS.map(function (s) {
        return '<div class="step"><div class="pv" aria-hidden="true">' + s.pv + "</div><p>" + s.t + "</p></div>";
      }).join("") + "</div>";
    });
  }
  $("how-steps").addEventListener("click", function () { sfx("tick"); howto(); });
  var seen = true; try { seen = !PG || !PG.seenHowto || PG.seenHowto("seven"); } catch (e) { seen = true; }
  if (!loaded && !seen) window.addEventListener("load", function () { if (!window.NumbericsUI || !window.NumbericsUI.open()) howto(); });

  // Screenshot hook (tools/shots.cjs): a fixed, representative mid-game. Not reachable from the UI.
  window.__demo = function () {
    try { if (window.NumbericsUI && window.NumbericsUI.open()) window.NumbericsUI.close(); } catch (e) { /* no sheet */ }
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
    render(true); layer.finish();
  };
  window.__seven = {
    get state() { return state; }, set state(s) { flush(); endReveal(); targeting = null; viewing = false; note = ""; state = s; render(true); },
    get mode() { return mode; }, get cursor() { return cursor; }, get busy() { return busy(); },
    get targeting() { return targeting; }, get aim() { return aim; }, get viewing() { return viewing; }, get revealing() { return revealing; },
    render: render, flush: flush, layer: layer, get ids() { return ids.slice(); }, get drawnCount() { return drawn ? drawn.split(",").filter(function (v) { return v !== "0"; }).length : 0; }, howto: howto,
  };
})();
