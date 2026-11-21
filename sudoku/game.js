/* SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 alvations (Melon Lab)
 * Numberics Sudoku: browser client. sudoku/engine.js owns every rule.
 * Feedback (REDESIGN.md 5.10): a placed digit pops in, a clash flashes red and shakes, a finished row, column or box
 * gets a gold sweep, and the solve pulses every cell outward from the last one. Only transform and opacity animate,
 * through NumbericsMotion (reduced motion read at each animation: the Settings tri-state, then the device). Every
 * input first finishes the running feedback, then applies at once: nothing waits for an animation (5.11).
 * Daily Sudoku (9.10): one puzzle a day from NumbericsKit.daySeed(), kept beside the regular puzzle, so switching
 * between them never ends either one. */
(function () {
  "use strict";
  var S = window.NumbericsSudoku, Kit = window.NumbericsKit, Power = window.NumbericsPower;
  var M = window.NumbericsMotion || null;
  var TR = window.NumbericsTrophies || null, PR = window.NumbericsProgress || null;
  var LEVELS = ["easy", "medium", "hard"];
  var cap = function (l) { return l[0].toUpperCase() + l.slice(1); };
  // Same key and shape as before power-ups ({state, elapsed, best}); `assisted`, `note`, `run`, `mode` and `daily` are
  // newer and optional. The top-level state is always the regular puzzle; the Daily lives under `daily`.
  var store = Kit.store("numberics_sudoku_v1");
  // Tray slots (keys U, H, C, F; digits 1-9 belong to the board). Undo is free; the rest are charged.
  var PW = [
    { id: "undo", key: "U", label: "Undo", desc: "Take back the last change. Free and unlimited." },
    { id: "reveal", key: "H", label: "Reveal", desc: "Show the right digit for one cell." },
    { id: "check", key: "C", label: "Check", desc: "Mark wrong digits, briefly." },
    { id: "cands", key: "F", label: "Candidates", desc: "Fill the notes of one 3x3 box." },
  ];
  var EARN = "Earn one per 9 cells with no clash.";
  var PW_NAME = { reveal: "Reveal", check: "Check", cands: "Candidates" };
  var PW_TARGET = { reveal: "Tap a cell to reveal", cands: "Tap a cell in the box to fill" };
  function ok81(a) { return Array.isArray(a) && a.length === 81 && a.every(function (v) { return Number.isInteger(v) && v >= 0; }); }
  function validState(s) {
    return s && ok81(s.puzzle) && ok81(s.solution) && ok81(s.grid) && ok81(s.notes) && Array.isArray(s.history) && LEVELS.indexOf(s.difficulty) >= 0;
  }
  var freshSeed = Kit.freshSeed;

  // ---- small safe wrappers: a missing module costs a nicety, never the game ----
  function sfx(name, arg) { if (M && M.sfx) M.sfx(name, arg); } // the shared call (shared/motion.js, TRIAGE4 D7)
  function buzz(kind) { sfx("buzz", kind); }
  function report(ev, data, opts) { try { return (TR && TR.report("sudoku", ev, data, opts)) || []; } catch (e) { return []; } }
  function duck(on) { try { if (window.NumbericsMusic && window.NumbericsMusic.duck) window.NumbericsMusic.duck(on); } catch (e) { /* no music */ } }
  function sheetOpen() { try { return !!(window.NumbericsUI && window.NumbericsUI.open()); } catch (e) { return false; } }

  // ---- the Daily: the same puzzle for everyone today; Easy Monday to Thursday, Medium Friday and Saturday, Hard Sunday ----
  function dailyLevel(d) { var w = (d || new Date()).getDay(); return w === 0 ? "hard" : w >= 5 ? "medium" : "easy"; }
  function dailySeed() { return Kit.daySeed() >>> 0; }

  // ---- the run record (REDESIGN.md 8.1, 8.4): notes set by any pencil note, clean cleared by any placement that clashes.
  // It never changes a rule. Undo does not restore it: a slip that was taken back was still a slip. ----
  function blankRun() { return { notes: false, clean: true }; }
  function runOf(r, s) {
    if (r && typeof r.notes === "boolean" && typeof r.clean === "boolean") return { notes: r.notes, clean: r.clean };
    return s && s.moves > 0 ? { notes: true, clean: false } : blankRun(); // an older save: its history is unknown, so no claim
  }
  function slot(st, el, nt, rn) { return { state: st, elapsed: el > 0 ? +el : 0, note: nt && st && nt.seed === st.seed ? nt : null, run: runOf(rn, st) }; }

  var saved = store.load(), firstVisit = !saved;
  var bests = (saved && saved.best && typeof saved.best === "object") ? saved.best : {};   // pure solves: seconds
  var assisted = (saved && saved.assisted && typeof saved.assisted === "object") ? saved.assisted : {}; // {t, pw}
  var play = slot(saved && validState(saved.state) ? S.upgrade(saved.state) : null, saved && saved.elapsed, saved && saved.note, saved && saved.run);
  var sd = saved && saved.daily, daily = slot(null, 0, null, null);
  if (sd && validState(sd.state) && (sd.state.seed >>> 0) === dailySeed()) daily = slot(S.upgrade(sd.state), sd.elapsed, sd.note, sd.run);
  // ?mode=daily (the Today card) opens the Daily; nothing is lost, since the regular puzzle keeps its own slot
  var askDaily = false;
  try { askDaily = /(^|[?&])mode=daily(&|$)/.test(window.location.search); } catch (e) { askDaily = false; }
  var mode = askDaily || (saved && saved.mode === "daily" && daily.state) ? "daily" : "play";
  try { if (askDaily && window.history && history.replaceState) history.replaceState(null, "", window.location.pathname); } catch (e) { /* keep the URL */ }
  // a first visit starts on Easy (REDESIGN.md 1.3); a saved choice is kept
  var level = play.state ? play.state.difficulty : "easy";
  var state, elapsed, note, run; // the puzzle on screen: the fields of the current slot
  function cur() { return mode === "daily" ? daily : play; }
  function stash() { var s = cur(); s.state = state; s.elapsed = elapsed; s.note = note; s.run = run; }
  function unstash() { var s = cur(); state = s.state; elapsed = s.elapsed; note = s.note; run = s.run; }

  var sel = -1, notesMode = false, tick = null, last = null, sinceSave = 0, paused = false;
  var armed = null;            // "reveal" | "cands" while a power-up waits for a cell
  var marks = null, marksT = null; // Check result: {state, cells} shown briefly, only on the state it checked
  var levelArm = null, levelT = null; // a difficulty button waiting for its second tap
  // The finished grid shows bright and undimmed for HOLD ms before the card (TRIAGE3: the result before the card);
  // "See the board" hides the card again (viewing) and a tap on the board or Esc brings it back.
  var HOLD = 1500, hold = false, holdT = null, viewing = false;
  var cheer = null;            // what the card celebrates when it first shows: { best, trophies }
  var cardUp = false;          // the end card is showing (music ducks under it)

  var $ = function (id) { return document.getElementById(id); };
  var boardEl = $("board"), cells = [], vals = [], fxs = [], keys = [];
  for (var r = 0; r < 9; r++) {
    var row = document.createElement("div"); row.className = "r"; row.setAttribute("role", "row");
    for (var q = 0; q < 9; q++) {
      var c = document.createElement("div"), i = r * 9 + q, v = document.createElement("span"), f = document.createElement("i");
      c.className = "c"; c.setAttribute("role", "gridcell"); c.dataset.i = i; c.id = "c" + i;
      v.className = "v"; f.className = "fx"; f.setAttribute("aria-hidden", "true");
      c.appendChild(v); c.appendChild(f); row.appendChild(c); cells.push(c); vals.push(v); fxs.push(f); keys.push("");
    }
    boardEl.appendChild(row);
  }

  // ---- feedback (REDESIGN.md 5.10). Every animation is kept so the next input can finish it first (5.11). ----
  var anims = [];
  function keep(a) { if (a) anims.push(a); return a; }
  function finishFx() {
    var list = anims; anims = [];
    list.forEach(function (a) { try { a.finish(); } catch (e) { try { a.cancel(); } catch (x) { /* gone */ } } });
  }
  function tms(n) { return M ? M.T[n] : 0; }
  function ms(n) { return M ? M.ms(n) : 0; }
  function ease(n) { return M ? M.E[n] : "ease-out"; }
  function playFx(el, frames, opts, reducedFrames) { return M ? keep(M.play(el, frames, opts, reducedFrames)) : null; }
  // a colour wash on one cell's overlay: opacity 0 -> peak -> 0 (opacity only, so it stays under reduced motion)
  function wash(k, bad, dur, delay) {
    var f = fxs[k]; f.classList.toggle("bad", !!bad);
    var fr = [{ opacity: 0 }, { opacity: 0.35 }, { opacity: 0 }];
    return playFx(f, fr, { duration: dur, delay: delay || 0, easing: "linear" }, fr);
  }
  function placeFx(k) { // the digit scales .6 -> 1 with opacity .4 -> 1
    playFx(vals[k], [{ transform: "scale(.6)", opacity: 0.4 }, { transform: "scale(1)", opacity: 1 }],
      { duration: tms("place"), easing: ease("pop") }, [{ opacity: 0.4 }, { opacity: 1 }]);
  }
  function clashFx(k, d) { // the clashing cells flash red; the placed digit shakes twice, 3 px (motion only: none when reduced)
    var group = [k].concat(S.PEERS[k].filter(function (p) { return state.grid[p] === d; }));
    group.forEach(function (p) { wash(p, true, 300, 0); });
    playFx(vals[k], [{ transform: "translateX(0)" }, { transform: "translateX(3px)" }, { transform: "translateX(-3px)" },
      { transform: "translateX(3px)" }, { transform: "translateX(-3px)" }, { transform: "translateX(0)" }],
      { duration: 180, easing: "linear", composite: "add" }, null);
  }
  function unitFx(units) { // a gold sweep across each finished unit, one cell after another
    var gap = ms("unitStagger");
    units.forEach(function (u) { S.UNIT[u].forEach(function (p, n) { wash(p, false, tms("unitSweep"), n * gap); }); });
  }
  function solveFx(k) { // every cell pulses in order of distance from the last placed cell
    var gap = ms("solveStagger"), r0 = S.ROW[k], c0 = S.COL[k];
    var order = cells.map(function (_, p) { return p; }).sort(function (a, b) {
      var da = Math.pow(S.ROW[a] - r0, 2) + Math.pow(S.COL[a] - c0, 2), db = Math.pow(S.ROW[b] - r0, 2) + Math.pow(S.COL[b] - c0, 2);
      return da - db || a - b;
    });
    order.forEach(function (p, n) { wash(p, false, tms("unitSweep"), n * gap); });
  }
  // units of cell k that this change completed (all nine filled, no clash) and that were not complete before
  function doneUnits(prev, next, k) {
    var bad = {}; S.conflicts(next.grid).forEach(function (b) { bad[b] = true; });
    return S.UNITS_OF[k].filter(function (u) {
      var cs = S.UNIT[u];
      return cs.every(function (p) { return next.grid[p] && !bad[p]; }) && !cs.every(function (p) { return prev.grid[p]; });
    });
  }

  // ---- clock: real elapsed time while the tab is visible, no sheet is open and the puzzle is unsolved ----
  // bank() adds the time since the last bank. It runs every second, before every move, and when the page is
  // hidden or closed, so reloading neither stops the clock nor wins time (TRIAGE1 Sudoku, mechanics #2).
  function bank() {
    var now = Date.now();
    if (last !== null) elapsed += Math.min(2, Math.max(0, (now - last) / 1000)); // a sleeping machine adds at most 2 s
    last = (document.hidden || paused || !state || state.solved) ? null : now;
  }
  function secs() { return Math.floor(elapsed); }
  var fmt = Kit.clock;

  function save() {
    stash();
    var o = { state: play.state, elapsed: play.elapsed, best: bests, assisted: assisted, note: play.note, run: play.run, mode: mode };
    if (daily.state) o.daily = { state: daily.state, elapsed: daily.elapsed, note: daily.note, run: daily.run };
    store.save(o);
    putProgress();
  }
  // the card and Today summaries (REDESIGN.md 3.5): the best pure time on the regular puzzle's level, and a live run
  function putProgress() {
    if (!PR) return;
    try {
      var d = play.state ? play.state.difficulty : level, b = bests[d];
      var live = function (s) { return s.state && !s.state.solved && s.state.moves > 0; };
      var on = live(cur()) ? cur() : live(play) ? play : live(daily) ? daily : null;
      PR.put("sudoku", { best: typeof b === "number" ? "Best " + fmt(b) : "", live: !!on,
        liveText: on ? (on === daily ? "Daily" : cap(on.state.difficulty)) + " · " + fmt(Math.floor(on.elapsed)) : "" });
    } catch (e) { /* the summary is a nicety */ }
  }

  function resetView() {
    finishFx(); disarmLevel(); disarm(); sel = -1; marks = null; cheer = null;
    clearTimeout(holdT); hold = false; viewing = false;
  }
  function fresh(diff) { // a new regular puzzle
    resetView();
    if (mode !== "play") { bank(); stash(); mode = "play"; }
    level = diff; elapsed = 0; last = null; note = null; run = blankRun();
    state = S.newState(S.generate(freshSeed(), diff)); bank(); save(); startTimer(); render();
  }
  function ensureDaily() {
    if (!daily.state || (daily.state.seed >>> 0) !== dailySeed()) daily = slot(S.newState(S.generate(dailySeed(), dailyLevel())), 0, null, null);
  }
  function switchTo(m) { // between the regular puzzle and the Daily; neither ends
    resetView(); bank(); stash(); mode = m;
    if (m === "daily") ensureDaily();
    else if (!play.state) play = slot(S.newState(S.generate(freshSeed(), level)), 0, null, null);
    unstash(); last = null; bank(); save(); startTimer(); render();
  }
  function startTimer() {
    clearInterval(tick); bank();
    if (state.solved) return;
    tick = setInterval(function () {
      bank(); if (state.solved) return;
      $("time").textContent = fmt(secs());
      if (++sinceSave >= 5) { sinceSave = 0; save(); }
    }, 1000);
  }
  function toast(m, kind) { Kit.toast(m, kind); }
  function plural(n, w) { return n + " " + w + (n === 1 ? "" : "s"); }
  function nope(m) { sfx("bad"); toast(m, "bad"); } // a blocked action: the low tone and the warning toast

  // ---- tray: why a slot cannot act now (null = it can) ----
  function why(id) {
    if (id === "undo") return state.solved ? "Not after the puzzle is solved." : state.history.length ? null : "Nothing to undo yet.";
    if (state.solved) return "The puzzle is solved.";
    return null;
  }
  function trayView() {
    var view = { undo: S.canUndo(state) ? 1 : 0 };
    S.KINDS.forEach(function (k) { view[k] = Math.max(0, state.stock[k]); });
    return view;
  }
  function info(id, text) { toast(text, "info"); } // phones have no hover: the tap explains the slot (R5), in the neutral info toast (R7)
  function infoFor(id) {
    var d = PW.filter(function (x) { return x.id === id; })[0];
    info(id, Power.info(d, trayView(), why(id) || false, { earn: EARN }));
  }

  function drawCell(k, v, n) { // rebuilt only when the cell's value or notes change, so a running animation keeps its node
    var key = v ? "v" + v : n ? "n" + n : "";
    if (keys[k] === key) return;
    keys[k] = key; var el = vals[k];
    el.textContent = "";
    if (v) el.textContent = v;
    else if (n) {
      var box = document.createElement("div"); box.className = "notes";
      for (var d = 1; d <= 9; d++) { var m = document.createElement("i"); m.textContent = n & (1 << d) ? d : ""; box.appendChild(m); }
      el.appendChild(box);
    }
  }
  function render() {
    var bad = {}; S.conflicts(state.grid).forEach(function (b) { bad[b] = true; });
    var wrong = {}; if (marks && marks.state === state) marks.cells.forEach(function (b) { wrong[b] = true; });
    var selVal = sel >= 0 ? state.grid[sel] : 0;
    cells.forEach(function (el, k) {
      var v = state.grid[k];
      el.className = "c" + (S.isGiven(state, k) ? " given" : "") + (bad[k] ? " bad" : "") + (wrong[k] ? " wrong" : "") +
        (k === sel ? " sel" : (sel >= 0 && S.PEERS[sel].indexOf(k) >= 0 ? " peer" : "")) +
        (selVal && v === selVal && k !== sel ? " same" : "");
      drawCell(k, v, v ? 0 : state.notes[k]);
      el.setAttribute("aria-label", "row " + (S.ROW[k] + 1) + " column " + (S.COL[k] + 1) + (v ? " " + v : " empty"));
      el.setAttribute("aria-selected", String(k === sel));
    });
    if (sel >= 0) boardEl.setAttribute("aria-activedescendant", "c" + sel); else boardEl.removeAttribute("aria-activedescendant");
    $("time").textContent = fmt(secs());
    var best = $("best");
    if (mode === "daily") { // the Daily's best time is today's only
      var done = state.solved;
      best.textContent = done ? fmt(secs()) : "none"; best.classList.toggle("none", !done);
      best.title = done ? "Today's Daily time" : "Today's Daily is not solved yet";
    } else {
      var pure = bests[state.difficulty], helped = assisted[state.difficulty], hasPure = typeof pure === "number";
      // Best is the best pure solve (no power-ups); with none yet it says so (R11), and an assisted time is only a tooltip
      best.textContent = hasPure ? fmt(pure) : "none"; best.classList.toggle("none", !hasPure);
      best.title = hasPure ? "Best pure solve on " + cap(state.difficulty) + ", no power-ups" :
        helped ? "No pure solve yet. Best with power-ups: " + fmt(helped.t) : "No solve yet on " + cap(state.difficulty);
    }
    Array.prototype.forEach.call($("levels").children, function (b) {
      b.setAttribute("aria-pressed", String(b.dataset.l === "daily" ? mode === "daily" : mode === "play" && b.dataset.l === state.difficulty));
    });
    var counts = new Array(10).fill(0); state.grid.forEach(function (v) { counts[v]++; });
    Array.prototype.forEach.call($("pad").children, function (b) {
      var d = +b.dataset.d, left = 9 - counts[d];
      b.disabled = left <= 0; b.querySelector("small").textContent = left > 0 ? left : "";
      b.setAttribute("aria-label", d + ", " + (left > 0 ? left : "none") + " left");
    });
    $("notes").textContent = "Notes: " + (notesMode ? "on" : "off"); $("notes").setAttribute("aria-pressed", String(notesMode));
    renderTray();
    boardEl.classList.toggle("targeting", !!armed);
    var card = state.solved && !hold && !viewing;
    $("win").hidden = !card;
    // one end-card pattern: while the card shows, its primary replaces the page button, whose space is kept
    $("new").style.visibility = card ? "hidden" : "";
    if (state.solved) {
      var u = S.total(state.used);
      $("win-text").textContent = fmt(secs()) + " on " + (mode === "daily" ? "today's Daily (" + cap(state.difficulty) + ")" : cap(state.difficulty)) +
        " · " + (u ? plural(u, "power-up") + " used" : "No power-ups used");
      // a pure record is celebrated in gold; an assisted one is a plain fact, since Best counts only pure solves
      var isDaily = !!(note && note.daily), pure = isDaily || (note && (note.pure === true || note.text === "New best."));
      var said = isDaily || (note && (note.pure === true || note.pure === false || note.text === "New best."));
      $("win-best").hidden = !said;
      $("win-best").textContent = !said ? "" : isDaily ? "Today's Daily is done." : pure ? "New best." : ASSISTED;
      $("win-best").classList.toggle("best", !!pure);
      if (card && TR && TR.pills) { try { TR.pills($("win-pills"), (note && note.trophies) || []); } catch (e) { /* no pills */ } }
    }
    if (card !== cardUp) { cardUp = card; duck(card); }
  }

  function renderTray() {
    var view = trayView();
    Power.tray($("tray"), PW, view, { armed: armed, disabled: function (id) { return why(id) || false; }, earn: EARN, onUse: use, onInfo: info });
    Array.prototype.forEach.call($("tray").children, function (b, i) {
      var d = PW[i]; b.id = "pw-" + d.id; b.title = d.key + ": " + d.label + ". " + d.desc;
    });
    var u = $("pw-undo"), badge = u.querySelector("i"); // Undo is free: always an infinity badge (cold #8: a 1 then
    badge.textContent = "∞";                            // an infinity read as a limit); the slot dims when it cannot act
    u.setAttribute("aria-label", "Undo, free" + (view.undo ? "" : ", not available now") + ". " + PW[0].desc);
  }

  var ASSISTED = "Fastest with power-ups. Best counts only solves without them.";
  function record() { // a fresh solve: keep the best times, report the solve and say whether it is a record (R8)
    var d = state.difficulty, pw = S.total(state.used), t = secs(), isDaily = mode === "daily";
    note = { seed: state.seed };
    if (isDaily) { note.daily = true; try { if (PR) PR.daily("sudoku", fmt(t)); } catch (e) { /* no summary */ } }
    else if (!pw) { if (typeof bests[d] !== "number" || t < bests[d]) { bests[d] = t; note.pure = true; } }
    else if (!assisted[d] || t < assisted[d].t) { assisted[d] = { t: t, pw: pw }; note.pure = false; }
    // the trophies show as pills on the card (never a toast over the finished grid); the card plays their sound
    var ids = report("solve", { difficulty: d, seconds: t, daily: isDaily, notes: !!run.notes, clean: !!run.clean,
      used: { reveal: +state.used.reveal || 0, check: +state.used.check || 0, cands: +state.used.cands || 0 } }, { quiet: true });
    if (ids.length) note.trophies = ids;
    cheer = { best: note.pure === true, trophies: ids.length };
  }
  // the one place every change lands. fx: { kind: "place" | "reveal" | "note" | "erase" | "power" | "undo", cell, digit }
  function commit(next, fx) {
    if (next === state) return false;
    fx = fx || {};
    bank(); // the time up to this move belongs to the state before it
    var prev = state, was = state.solved; state = next;
    var k = fx.cell, placed = (fx.kind === "place" || fx.kind === "reveal") && k >= 0 && state.grid[k] && state.grid[k] !== prev.grid[k];
    var clash = placed && S.conflicts(state.grid).indexOf(k) >= 0;
    if (fx.kind === "place" && placed) { if (clash) run.clean = false; report("place", { conflict: !!clash }); }
    if (fx.kind === "note" || fx.kind === "cands") run.notes = true;
    var units = placed && !clash ? doneUnits(prev, state, k) : [];
    if (state.solved && !was) {
      bank(); clearInterval(tick); armed = null; record();
      $("toast").classList.remove("on"); // one channel per event: the end card speaks alone (R7)
      // the finished grid first, bright and plain (no selection), then the card
      sel = -1; marks = null; hold = true; viewing = false; clearTimeout(holdT);
      var solvedState = state;
      holdT = setTimeout(function () { if (state === solvedState && hold) showCard(); }, HOLD); // a newer puzzle wins
    } else if (state.gain && state.gain.length) { toast(state.high + " cells filled: +" + PW_NAME[state.gain[0]]); sfx("power"); }
    save(); render();
    // the feedback for this change, on the board that is now drawn (state is already final: input never waits)
    if (placed) { placeFx(k); if (clash) clashFx(k, state.grid[k]); }
    if (state.solved && !was) { solveFx(k >= 0 ? k : 40); sfx("win"); buzz("win"); }
    else if (units.length) { unitFx(units); sfx("pop", 1); buzz("merge"); }
    else if (placed) { sfx("place"); buzz("tap"); }
    else if (fx.kind === "note" || fx.kind === "erase" || fx.kind === "undo" || fx.kind === "power" || fx.kind === "cands") sfx("tick");
    return true;
  }
  function showCard() { // end the hold, or come back from "See the board"; focus goes to the card's primary
    clearTimeout(holdT); hold = false; viewing = false; render();
    if (cheer) { // the first showing of this solve: its trophies and record get their sound now, beside their pills
      var ch = cheer; cheer = null;
      if (ch.trophies) { sfx("trophy"); buzz("big"); try { if (window.NumbericsUI) window.NumbericsUI.dot(true); } catch (e) { /* no dot */ } }
      else if (ch.best) sfx("best");
    }
    try { $("again").focus({ preventScroll: true }); } catch (e) { /* focus is a nicety */ }
  }
  function seeBoard() {
    viewing = true; render();
    try { boardEl.focus({ preventScroll: true }); } catch (e) { /* focus is a nicety */ }
    toast("Tap the board for the summary.", "info");
  }
  function use(id) {
    finishFx();
    if (why(id) || (id !== "undo" && !(state.stock[id] > 0))) return infoFor(id);
    if (id === "undo") { disarm(); return commit(S.undo(state), { kind: "undo" }); }
    if (id === "check") {
      disarm();
      var r = S.check(state);
      if (r.state === state) return nope("Place a digit first");
      commit(r.state, { kind: "power" });
      marks = { state: state, cells: r.wrong }; clearTimeout(marksT);
      var mine = marks;
      marksT = setTimeout(function () { if (marks === mine) { marks = null; render(); } }, 2500); // guarded: a newer Check or move wins
      if (r.wrong.length) toast(plural(r.wrong.length, "wrong digit") + " marked", "bad"); else toast("Every placed digit is right");
      return render();
    }
    if (armed === id) { disarm(); return render(); } // tapping an armed slot again cancels
    if (sel >= 0) return target(id, sel);
    armed = id; render(); aimToast(PW_TARGET[id] + (finePointer() ? " (Esc cancels)" : ". Tap " + PW_NAME[id] + " again to cancel"));
  }
  // leaving aiming mode takes its instruction with it (craft #2: a stale "Tap a cell" toast stayed after Esc)
  function disarm() { if (armed) Kit.clearToast(); armed = null; }
  // The aiming instruction never sits on the cells it asks for (craft #1): the kit puts a toast just above the board,
  // and when the page is scrolled so that there is no room, this one moves just below the board instead.
  function aimToast(m) {
    Kit.toast(m);
    try {
      var t = $("toast"), b = boardEl.getBoundingClientRect(), r = t.getBoundingClientRect();
      if (r.bottom > b.top && r.top < b.bottom) t.style.top = Math.max(12, Math.min(window.innerHeight - r.height - 12, b.bottom + 6)) + "px";
    } catch (e) { /* keep the kit position */ }
  }
  function finePointer() { try { return window.matchMedia("(pointer: fine)").matches; } catch (e) { return true; } }
  function target(id, c) {
    var n = id === "reveal" ? S.reveal(state, c) : S.fillBox(state, c);
    if (n === state) return nope(id === "reveal" ? "Nothing to reveal there" : "Nothing to fill in that box");
    disarm(); commit(n, { kind: id === "reveal" ? "reveal" : "cands", cell: c });
    // every power-up says what it did (craft: Reveal was silent); the solving Reveal leaves the card to speak
    if (!state.solved) toast(id === "reveal" ? "Revealed: " + state.grid[c] : "Box notes filled");
  }
  function enter(d) {
    finishFx();
    if (state.solved) return;
    if (sel < 0) return nope("Select a cell first");
    if (notesMode && d) commit(S.toggleNote(state, sel, d), { kind: "note", cell: sel });
    else commit(S.place(state, sel, d), { kind: d ? "place" : "erase", cell: sel, digit: d });
  }
  function move(dr, dc) {
    finishFx();
    var r = sel < 0 ? 4 : Math.max(0, Math.min(8, S.ROW[sel] + dr)), c = sel < 0 ? 4 : Math.max(0, Math.min(8, S.COL[sel] + dc));
    sel = r * 9 + c; render();
  }

  boardEl.addEventListener("click", function (e) {
    finishFx();
    if (state.solved) { if (hold || viewing) showCard(); return; } // the finished board: a tap shows the summary
    var t = e.target.closest(".c"); if (!t) return;
    sel = +t.dataset.i;
    if (armed) return target(armed, sel);
    render();
  });
  // keyboard: the board is one tab stop; focusing it selects the centre cell so the arrows have somewhere to start
  boardEl.addEventListener("focus", function () { if (sel < 0 && !state.solved) { sel = 40; render(); } });
  var padEl = $("pad");
  for (var d = 1; d <= 9; d++) {
    var b = document.createElement("button"); b.type = "button"; b.dataset.d = d; b.textContent = d;
    b.appendChild(document.createElement("small")); b.addEventListener("click", (function (dd) { return function () { enter(dd); }; })(d));
    padEl.appendChild(b);
  }
  // Difficulty: switching away from a puzzle in progress takes a second tap, like New puzzle (R10). The Daily is a
  // fourth segment; going to it or back from it never ends a puzzle, so it never asks.
  var risky = function () { return state.moves > 0 && !state.solved; };
  var playRisky = function () { return !!(play.state && play.state.moves > 0 && !play.state.solved); };
  function disarmLevel() {
    clearTimeout(levelT); levelArm = null;
    Array.prototype.forEach.call($("levels").children, function (b) { b.textContent = b.dataset.l === "daily" ? "Daily" : cap(b.dataset.l); });
  }
  function pickLevel(l, b) {
    finishFx(); sfx("tick");
    if (mode === "daily") stash(); // the regular puzzle's slot is what a level button acts on
    var ps = mode === "daily" ? play.state : state, inPlay = mode === "play";
    if (!inPlay && ps && ps.difficulty === l && !ps.solved) return switchTo("play"); // back to the puzzle you left
    if (inPlay && l === state.difficulty && risky()) return toast("Tap New puzzle to restart", "bad");
    if ((inPlay ? risky() : playRisky()) && (inPlay ? l !== state.difficulty : true) && levelArm !== l) {
      disarmLevel(); levelArm = l; b.textContent = "Sure?";
      levelT = setTimeout(disarmLevel, 3000); return;
    }
    fresh(l);
  }
  LEVELS.concat(["daily"]).forEach(function (l) {
    var b = document.createElement("button"); b.type = "button"; b.dataset.l = l; b.textContent = l === "daily" ? "Daily" : cap(l);
    if (l === "daily") b.title = "Today's puzzle, the same for everyone: " + cap(dailyLevel());
    b.addEventListener("click", function () {
      if (l !== "daily") return pickLevel(l, b);
      finishFx(); sfx("tick"); disarmLevel();
      if (mode !== "daily") switchTo("daily");
    });
    $("levels").appendChild(b);
  });
  $("notes").addEventListener("click", function () { finishFx(); notesMode = !notesMode; sfx("tick"); render(); });
  $("erase").addEventListener("click", function () { enter(0); });
  // New puzzle: on the Daily it goes back to the regular puzzle (the Daily is one a day); there it asks first (R10)
  function another() {
    if (mode === "daily") { if (play.state && !play.state.solved) return switchTo("play"); return fresh(play.state ? play.state.difficulty : level); }
    fresh(state.difficulty);
  }
  Kit.twoStep($("new"), function () { return mode === "play" && risky(); }, function () { finishFx(); sfx("tick"); duck(false); another(); }, "Sure? This ends the puzzle");
  $("again").addEventListener("click", function () { sfx("tick"); another(); });
  $("win-view").addEventListener("click", seeBoard);

  // ---- How to play (REDESIGN.md 1.3, 9.10): three steps, each a small drawn picture and one sentence ----
  var STEPS = [
    { picture: '<div class="sq9"><span>5</span><span class="u">3</span><span>7</span><span class="u">6</span><span>1</span><span>9</span>' +
      '<span class="u">2</span><span>4</span><span>8</span></div>', text: "Fill every row, column and box with 1 to 9." },
    { picture: '<div class="hw"><div class="sq9"><span>5</span><span></span><span>7</span><span>6</span><span class="s"></span><span>9</span>' +
      '<span>2</span><span></span><span>8</span></div><span class="key">4</span></div>', text: "Tap a cell, then a number." },
    { picture: '<div class="sq9"><span>5</span><span class="n">1 4<br>8</span><span>7</span><span class="x">6</span><span></span><span>9</span>' +
      '<span>2</span><span class="x">6</span><span>8</span></div>', text: "Notes are pencil marks. Red shows a clash." }
  ];
  // the family's one sheet (shared/howto.js, TRIAGE4 D8): it opens by itself once, never with a saved game
  var how = null;
  function howto() { if (how) how.open(); else $("how").open = true; }
  document.addEventListener("DOMContentLoaded", function () {
    var UI = window.NumbericsUI; if (!UI || !UI.howto) return;
    how = UI.howto("sudoku", { title: "Sudoku", steps: STEPS, saved: !firstVisit, onButton: function () { sfx("tick"); } });
  });

  window.addEventListener("keydown", function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (sheetOpen()) return; // a sheet owns the keys (shared/ui.js also stops them)
    var k = e.key, tag = (e.target && e.target.tagName) || "";
    // R17: a focused link or form field keeps every key (Enter on a games-row link navigates); a focused button keeps
    // Enter and Space (they press it, R9). Digits and arrows still reach the board after a click on the pad.
    if (tag === "A" || tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
    if ((tag === "BUTTON" || tag === "SUMMARY") && (k === "Enter" || k === " ")) return;
    if (state.solved && (hold || viewing) && (k === "Escape" || k === "Enter" || k === " ")) { e.preventDefault(); return showCard(); }
    if (k >= "1" && k <= "9") return enter(+k);
    if (k === "Backspace" || k === "Delete" || k === "0") { e.preventDefault(); return enter(0); }
    var arrows = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    if (arrows[k]) { e.preventDefault(); return move(arrows[k][0], arrows[k][1]); }
    if (k === "n" || k === "N") { finishFx(); notesMode = !notesMode; sfx("tick"); return render(); }
    if (k === "u" || k === "U") return use("undo");
    if (k === "h" || k === "H") return use("reveal");
    if (k === "c" || k === "C") return use("check");
    if (k === "f" || k === "F") return use("cands");
    if (k === "Escape") { finishFx(); if (armed) disarm(); else sel = -1; render(); }
  });
  // save when the page is hidden or closed (a reload fires pagehide), and resume the clock when it is back
  document.addEventListener("visibilitychange", function () { bank(); save(); });
  window.addEventListener("pagehide", function () { bank(); save(); });
  // the clock pauses while a sheet (Games, Trophies, Settings, How to play) is open (REDESIGN.md 3.6)
  window.addEventListener("numberics:sheet", function () { bank(); paused = sheetOpen(); bank(); });

  if (mode === "daily") ensureDaily();
  else if (!play.state) play = slot(S.newState(S.generate(freshSeed(), level)), 0, null, null);
  unstash();
  if (!saved || askDaily) save();
  startTimer(); render();

  // Screenshot hook (tools/shots.cjs): a fixed puzzle with a few moves and notes. Not reachable from the UI.
  window.__demo = function () {
    try { if (window.NumbericsUI && window.NumbericsUI.open()) window.NumbericsUI.close(); } catch (e) { /* no sheet */ }
    resetView(); if (mode !== "play") { stash(); mode = "play"; }
    var st = S.newState(S.generate(2026, "medium")), empt = st.puzzle.map(function (v, k) { return v ? -1 : k; }).filter(function (k) { return k >= 0; });
    for (var k = 0; k < 8; k++) st = S.place(st, empt[k], st.solution[empt[k]]);
    st = S.toggleNote(st, empt[10], 2); st = S.toggleNote(st, empt[10], 7); st = S.toggleNote(st, empt[11], 4);
    st.stock = { reveal: 1, check: 2, cands: 1 }; // what a player has earned by this point
    clearInterval(tick); last = null; state = st; elapsed = 134; note = null; run = blankRun(); sel = empt[8]; render();
  };
  window.__sudoku = { get state() { return state; }, set state(s) { state = S.upgrade(s); render(); }, select: function (i) { sel = i; render(); },
                      get elapsed() { return elapsed; }, get mode() { return mode; }, get run() { return run; },
                      get note() { return note; }, anims: function () { return anims.length; }, dailyLevel: dailyLevel };
})();
