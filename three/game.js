/* SPDX-License-Identifier: Apache-2.0 | Copyright 2026 alvations (Melon Lab)
 * Numberics Three: browser client. The engine (engine.js) owns every rule;
 * this file only draws, listens, and remembers.
 * Motion (docs/design/REDESIGN.md 5.4): every tile keeps its element (NumbericsMotion.layer, keyed by identity) and
 * slides one cell over T.step; a merge pops on top after the slide; the dealt tile enters from outside the edge it was
 * swiped away from, with the slide; a Flush plays as the slide lands: the run leaves the board at once and its tiles,
 * now only leaving ghosts, swell and shrink away under the rainbow (about 400 ms in all, TRIAGE4).
 * The state is authoritative before any animation starts: a new input finishes the running timeline at once
 * (flush()) and is applied immediately, so no input is ever dropped or delayed (5.11). Sounds follow the family's one
 * rule (shared/motion.js, TRIAGE4 D7): the pending ones play at once, one of each, and the new input's own play with it. */
(function () {
  "use strict";
  var E = window.NumbericsThree, K = window.NumbericsKit, P = window.NumbericsPower, M = window.NumbericsMotion;
  var T = window.NumbericsTrophies, PR = window.NumbericsProgress;
  // shared/ui.js loads after this file (spec order): read it when used, never at load
  function ui() { return window.NumbericsUI || null; }
  function sheetOpen() { var u = ui(); return !!(u && u.open && u.open()); }
  var store = K.store("numberics_three_v1");
  var ID = "three";

  function valid(s) {
    return s && Array.isArray(s.grid) && s.grid.length === 16 &&
      s.grid.every(function (v) { return Number.isInteger(v) && v >= 0; }) &&
      Number.isInteger(s.next) && s.next > 0 && Array.isArray(s.bag) && typeof s.score === "number" &&
      s.power && E.POWERS.every(function (p) { return Number.isInteger(s.power[p]) && s.power[p] >= 0; }) &&
      (s.free === undefined || typeof s.free === "boolean");
  }

  var saved = store.load();
  var hadSave = !!(saved && valid(saved.state));
  // Tiers (O-13, as Two: three/engine.js payFrom): Easy, Medium, Hard differ only in which joins also earn a power-up
  // (Hard: flushes only). The tier is the state's own (state.tier; none = Hard), so a save from before the tiers loads
  // as Hard and nobody's game in progress changes rules. A first visit with no save starts on Medium. `tier` (the
  // choice for the next game) is saved with the game.
  var TIER_NAME = { easy: "Easy", medium: "Medium", hard: "Hard" };
  function okTier(t) { return E.TIERS.indexOf(t) >= 0; }
  var tier = saved && okTier(saved.tier) ? saved.tier : hadSave ? E.tierOf(saved.state) : "medium";
  var state = hadSave ? saved.state : E.newGame(K.freshSeed(), tier);
  tier = E.tierOf(state);
  // Best score per tier: bestScore / bestUsed (the old fields) stay Hard's, so an old save keeps its best on Hard;
  // Easy and Medium keep theirs in `bests`.
  var bests = { hard: { score: (saved && +saved.bestScore) || 0, used: (saved && +saved.bestUsed) || 0 } };
  ["easy", "medium"].forEach(function (t) {
    var b = saved && saved.bests && saved.bests[t];
    bests[t] = { score: (b && +b.score) || 0, used: (b && +b.used) || 0 };
  });
  var best = bests[tier];
  // the record when this run began, so the end screen can say "New best." (an old save has none: count it as 0
  // only if this run already holds the record)
  var base = saved && Number.isFinite(saved.base) ? saved.base : (best.score > state.score ? best.score : 0);
  var seen = !!(saved && saved.seen);  // the old first-run explainer was dismissed once: the how-to counts as seen
  // a flush was ever made on this device: until then the hint band says how to make one (cold #12)
  var flushed = !!(saved && (saved.flushed || (saved.state && saved.state.flushes > 0)));
  var desk = false;                // a mouse and keyboard: targeting copy adds the arrow keys
  try { desk = window.matchMedia("(hover: hover) and (pointer: fine)").matches; } catch (e) { desk = false; }
  var viewing = false;             // "See the board": the end card is hidden to look at the finished board
  var targeting = null;            // {name, picks:[], cur, kbd} while a power-up waits for a target
  var note = "";                   // a tray explanation in the hint line, until the next action
  var pills = [];                  // trophies earned by the run's last swipe and its end, shown on the end card
  var ended = !!state.over;        // the end of this run was reported (once per run)

  var $ = function (id) { return document.getElementById(id); };
  var boardEl = $("board"), tilesEl = $("tiles"), cellsEl = $("cells");
  for (var i = 0; i < 16; i++) cellsEl.appendChild(document.createElement("div"));

  // ---- sound and haptics: the shared calls (shared/motion.js), on their own timeline `sounds` (D7) ----
  var snd = M.sfx, buzz = M.buzz, atOnce = false; // atOnce: the final step runs inside flush(), its earlier steps skipped
  function duck(on) { try { if (window.NumbericsMusic) window.NumbericsMusic.duck(on); } catch (e) { /* no music */ } }

  function persist() {
    best = bests[E.tierOf(state)];
    if (state.score > best.score) { best.score = state.score; best.used = state.used; }
    store.save({ state: state, tier: tier, bestScore: bests.hard.score, bestUsed: bests.hard.used,
      bests: { easy: bests.easy, medium: bests.medium }, base: base, seen: seen, flushed: flushed });
    try { // the card summary: this tier's best
      if (PR) PR.put(ID, { best: best.score ? TIER_NAME[E.tierOf(state)] + " best " + K.fmt(best.score) : "", live: !state.over && state.moves > 0,
        liveText: "Score " + K.fmt(state.score) });
    } catch (e) { /* the card summary is a nicety */ }
  }

  // paint a tile's look onto an element (the board tile's face, the Next pill, a how-to picture)
  function paint(el, v) {
    var c = E.colour(v), s = String(v);
    el.classList.remove("one", "two", "three");
    el.classList.add(v === 1 ? "one" : v === 2 ? "two" : "three");
    if (c.band >= 0) { el.setAttribute("data-band", c.band); el.setAttribute("data-oct", Math.min(3, c.octave)); }
    else { el.removeAttribute("data-band"); el.removeAttribute("data-oct"); }
    el.textContent = s; el.setAttribute("data-len", String(Math.min(6, s.length)));
  }
  function label(v) {
    var c = E.colour(v);
    return "tile " + v + (c.band >= 0 ? ", " + c.name + (c.octave ? " octave " + (c.octave + 1) : "") : "");
  }

  // ---- the keyed tile layer ----
  var L = M.layer(tilesEl, {
    cols: 4, rows: 4, slide: M.T.step, clip: true,
    paint: function (node, t) {
      var f = node.querySelector(".face"); paint(f, t.v); node.setAttribute("aria-label", label(t.v));
    }
  });
  var ids = [], nextId = 1;
  function tilesOf(grid, map) {
    var out = [];
    for (var c = 0; c < 16; c++) if (grid[c]) out.push({ id: map[c], cell: c, v: grid[c] });
    return out;
  }
  function rekey() { var r = M.rekey(state.grid, nextId); ids = r.ids; nextId = r.next; }
  function node(cell) { return ids[cell] ? L.get(ids[cell]) : null; }

  // ---- the timeline: one per move; flush() ends it now: the final board, and the pending sounds at once (one of each) ----
  var tl = M.seq(), sounds = M.seq(), finalFn = null;
  function flush() {
    var running = tl.busy() || L.busy();
    M.together(function () {
      sounds.finish(running); tl.cancel();
      if (finalFn) { var f = finalFn; finalFn = null; atOnce = true; try { f(); } finally { atOnce = false; } }
    });
    L.finish();
  }
  function begin(fin) { finalFn = fin; }
  function done() { if (finalFn) { var f = finalFn; finalFn = null; f(); } }

  function same(a, b) { for (var k = 0; k < a.length; k++) if (a[k] !== b[k]) return false; return true; }
  function cleared(grid, f) { var g = grid.slice(); f.cells.forEach(function (c) { g[c] = 0; }); if (f.value) g[f.at] = f.value; return g; }

  // one flush beat (TRIAGE4, mechanics #2/#3, craft #27): at time t every run in `group` leaves the board in one sync, so
  // from that frame on the drawn tiles are the engine's board (an input then acts on what is shown). The run tiles stay
  // only as leaving ghosts (`gone`, theme.css): the rainbow sweeps them while they swell and shrink away, 20 ms apart,
  // in FLUSH_MS. Returns {t, map} after the beat: t is when its ghosts are gone.
  var FLUSH_MS = 300, FLUSH_GAP = 20;
  function beat(t, group, cur, map) {
    var red = M.reduced(), after = cur.slice(), m2 = map.slice(), outIds = [];
    group.forEach(function (f) {
      f.cells.forEach(function (c) { if (map[c] && outIds.indexOf(map[c]) < 0) outIds.push(map[c]); m2[c] = 0; });
      after = cleared(after, f);
      if (f.value) m2[f.at] = nextId++;
    });
    tl.at(t, function () {
      group.forEach(function (f) {
        f.cells.forEach(function (c, k) {
          var el = L.get(map[c]); if (!el) return;
          el.style.setProperty("--d", (red ? 0 : k * FLUSH_GAP) + "ms");
          el.classList.add("run"); el.classList.toggle("still", red);
        });
      });
      L.sync(tilesOf(after, m2), { out: outIds });
    });
    sounds.sound(t, function () { snd("pop", group.length); buzz("merge"); });
    return { t: t + (red ? M.T.fade : FLUSH_MS), map: m2 };
  }

  // the dealt tile: it starts one cell beyond the edge it was swiped away from and slides in (fx.enter)
  var ENTER = { left: [0, 1], right: [0, -1], up: [1, 0], down: [-1, 0] };
  function enterFx(cell, id, dir) {
    var e = {}, d = ENTER[dir] || [0, 0];
    e[id] = { r: Math.floor(cell / 4) + d[0], c: cell % 4 + d[1] };
    return e;
  }

  // ---- drawing the chrome (stats, tray, hint, end card) ----
  // how each tier earns, one short sentence each (the tray says it; How to play says the same; O-14)
  var EARNS = {
    hard: "Earn one with every Flush.",
    medium: "Earn one with every Flush, or a join as big as your top tile (18 up).",
    easy: "Earn one with every Flush, or a join half your top tile or more (9 up)."
  };
  var DEFS = [
    { id: "undo", label: "Undo", desc: "Take back the last move." },
    { id: "smash", label: "Smash", desc: "Remove one tile." },
    { id: "swap", label: "Swap", desc: "Trade two neighbouring tiles." },
    { id: "third", label: "Third", desc: "Turn a 1 or a 2 into a 3." },
  ];
  // the tray's defs with this tier's earn line (Undo: you start with one)
  function defs() {
    var e = EARNS[E.tierOf(state)];
    return DEFS.map(function (d) { return { id: d.id, label: d.label, desc: d.desc, earn: (d.id === "undo" ? "You start with one. " : "") + e }; });
  }
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
  var TIP = "Tip: line up 3, 6, 9 in a row or column for a rainbow flush.";
  function onlyUndo() { var can = E.POWERS.filter(function (p) { return E.usable(state, p); }); return can.length === 1 && can[0] === "undo"; }
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
    var d = defs()[E.POWERS.indexOf(id)];
    note = P.info(d, state.power, why(id), {}); chrome();
    snd("bad");
  }

  var shownNext = null;
  function chrome() {
    Array.prototype.forEach.call($("diff").children, function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-diff") === E.tierOf(state))); });
    $("score").textContent = K.fmt(state.score);
    var bv = Math.max(bests[E.tierOf(state)].score, state.score); // R11: an empty best is a dimmed "none", never 0
    $("best").textContent = bv ? K.fmt(bv) : "none"; $("best").classList.toggle("none", !bv);
    var nx = $("next");
    if (shownNext !== state.next) {
      paint(nx, state.next); nx.classList.add("mini"); nx.setAttribute("aria-label", "next tile " + state.next);
      if (shownNext !== null) M.play(nx, [{ opacity: 0 }, { opacity: 1 }], { duration: 120, easing: "linear" }, [{ opacity: 0 }, { opacity: 1 }]);
      shownNext = state.next;
    }
    P.tray($("tray"), defs(), state.power, {
      armed: targeting && targeting.name,
      disabled: why,
      onUse: activate,
      onInfo: function (id, text) { note = text; chrome(); },
    });
    // stuck with only Undo left: the run is over unless it is rewound, so it gets the end card too (cold #13), with Undo
    var stuck = !state.over && !E.canMove(state) && onlyUndo();
    $("hint").textContent = targeting ? targetHint()
      : tierArm && !state.over ? "Tap " + TIER_NAME[tierArm] + " again: this ends the run."
      : note ? note
      : state.over ? (viewing ? "Tap the board for the summary." : "")
      : stuck ? ""
      : !E.canMove(state) ? stuckHint()
      : !state.moves ? "Swipe to start: every tile moves one step."
      : !flushed && !state.flushes ? TIP : "";
    Array.prototype.forEach.call(cellsEl.children, function (c, k) {
      c.classList.toggle("sel", !!(targeting && targeting.picks.indexOf(k) >= 0));
      c.classList.toggle("cur", !!(targeting && targeting.kbd && targeting.cur === k));
    });
    for (var c = 0; c < 16; c++) {
      var el = node(c); if (!el) continue;
      el.classList.toggle("sel", !!(targeting && targeting.picks.indexOf(c) >= 0));
      el.classList.toggle("cur", !!(targeting && targeting.kbd && targeting.cur === c));
    }
    boardEl.classList.toggle("targeting", !!targeting);
    if (!state.over) viewing = false;
    // the end card waits for the last animation of the run (finalFn), then shows
    var wasShown = !$("over").hidden, wasStuck = $("over").classList.contains("stuck"), wasOver = wasShown && !wasStuck;
    var card = (!!state.over || stuck) && !viewing && !finalFn;
    $("over").hidden = !card;
    $("over").classList.toggle("stuck", stuck);
    $("over-view").hidden = stuck; $("over-undo").hidden = !stuck;
    // one end-card pattern (round 3): while the card shows, the page's New game is hidden with its space kept
    // (no gap jump, one New game on screen), and the card's primary button takes focus
    $("new").style.visibility = card ? "hidden" : "";
    if (card && (!wasShown || wasStuck !== stuck) && !sheetOpen()) $(stuck ? "over-undo" : "again").focus({ preventScroll: true });
    if (stuck) {
      $("over-text").textContent = "Undo the last move to keep going, or start a new game.";
      $("over-best").hidden = true; $("over-pills").hidden = true;
    } else if (state.over) {
      // "<detail> · <score>", the family's subline form; no-break spaces and hyphen keep each part whole at 320 px
      $("over-text").textContent = state.flushes + (state.flushes === 1 ? " flush" : " flushes") + " · " +
        (state.used ? state.used + " power‑up" + (state.used === 1 ? "" : "s") : "pure run") + " · score " + K.fmt(state.score);
      $("over-best").hidden = !(state.score > base && state.score > 0);
    }
    if (card && !wasOver && state.over) { duck(true); if (T) T.pills($("over-pills"), pills); }
  }
  // the whole board at once, no slide (load, New game, Undo: a cross-fade)
  function render(fade) { rekey(); L.sync(tilesOf(state.grid, ids), fade ? { fade: true } : {}); chrome(); }

  // ---- trophies (REDESIGN.md 8.4): swipe {flushes, top, grid, moves}, end {score, flushes}; run {used, flushes}.
  // The run record is the engine state's own used and flushes counts (Undo restores them with the snapshot). ----
  function run() { return { used: state.used, flushes: state.flushes }; }
  function report(ev, data) { try { return T ? T.report(ID, ev, data) : []; } catch (e) { return []; } }
  function reportEnd() {
    if (!state.over || ended) return;
    ended = true;
    pills = pills.concat(report("end", { score: state.score, flushes: state.flushes, run: run() }));
    if (T && !$("over").hidden) T.pills($("over-pills"), pills);
  }

  // one toast per flush event (a reward); a flush a power-up set up scores but pays no power-up (R2). The hint band then
  // says what the earned power-up does, until the next action (cold #12, #14: "Third" is not guessable from its name)
  function earned(list) {
    var got = []; list.forEach(function (f) { if (f.power && got.indexOf(f.power) < 0) got.push(f.power); }); // flushes and joins
    if (!got.length) return "";
    if (got.length > 1) return "Earned " + got.map(function (p) { return NAME[p]; }).join(" and ") + ". Tap one to see what it does.";
    var d = DEFS[E.POWERS.indexOf(got[0])];
    return "Earned " + (got[0] === "undo" ? "an " : "a ") + d.label + ": " + d.desc.charAt(0).toLowerCase() + d.desc.slice(1);
  }
  // joins (Easy, Medium: O-13) that reached the tier's bar: each pays "+1 Name" in the same toast as the swipe's flush
  function announce(list, joins) {
    joins = joins || [];
    var jp = joins.filter(function (j) { return j.power; }).map(function (j) { return " +1 " + NAME[j.power]; }).join("");
    if (!list.length) {
      if (!joins.length) return;
      var top = Math.max.apply(null, joins.map(function (j) { return j.value; })), made = "Made " + K.fmt(top);
      if (jp) K.toast(made + jp);
      else if (joins.some(function (j) { return j.full; })) K.toast(made + ". Power-ups full.", "info"); // R15
      else K.toast(made + ". No reward right after a power-up.", "info"); // R2: the swipe after Smash, Swap or Third
      note = earned(joins);
      return;
    }
    flushed = true;
    var f = list[0], tail = list.length > 1 ? "  (x" + list.length + " cascade)" : "";
    // R15: a flush on a full stock says so, never a silent missing reward
    var pays = f.power ? " +1 " + NAME[f.power] : f.full ? ". Power-ups full" : f.paid ? "" : " (no power-up)";
    K.toast("Rainbow flush " + f.values.join("-") + (f.value ? " = " + f.value : "") + ", +" + K.fmt(f.points) + pays + jp + tail);
    note = earned(joins.concat(list));
  }

  // the last step of every timeline: the authoritative board, the end card, and the run's end
  // swipe: this move's trophy event, reported once its animation has played (so the flush toast reads first, and on
  // the swipe that ends the run its trophies go on the end card as pills)
  function settle(newBest, swipe) {
    return function () {
      // finished at once by a new input: the intermediate steps never ran, so draw the final board now (an
      // in-flight slide is not snapped: the transition retargets from where the tile is)
      if (atOnce) L.sync(tilesOf(state.grid, ids), {});
      Array.prototype.forEach.call(tilesEl.querySelectorAll(".tile.run:not(.gone)"), function (el) { el.classList.remove("run", "still"); });
      chrome();
      if (swipe) { var got = report("swipe", swipe); if (state.over) { pills = got.slice(); if (T) T.pills($("over-pills"), pills); } }
      if (state.over) { snd("lose"); buzz("lose"); reportEnd(); }
      else if (newBest) snd("best");
    };
  }
  function ring() { var el = $("best").parentNode; el.classList.remove("gold"); void el.offsetWidth; el.classList.add("gold"); }

  function doMove(dir) {
    flush();
    if (sheetOpen()) return;
    if (targeting) return;
    var old = state, r = E.move(state, dir);
    if (!r.moved) return;
    note = "";
    state = r.state;
    // the board right after the one-step slide (before any flush or the dealt tile)
    var G = old.grid.slice();
    r.trace.forEach(function (t) { G[t.to] = t.merge ? G[t.to] + G[t.from] : G[t.from]; G[t.from] = 0; });
    // the tile a merge lands on stays put, so the engine's trace leaves it out: list it as staying (from = to) so the
    // pair waits under the new tile (`gone`) instead of the target vanishing as the slide starts
    var trace = [];
    r.trace.forEach(function (t) { if (t.merge) trace.push({ from: t.to, to: t.to, merge: true }); trace.push(t); });
    var tr = M.track(ids, trace, null, nextId), map = tr.ids; nextId = tr.next;
    // the flushes: runs on the board after the slide, and any the dealt tile completes. Clearing a run never moves a
    // tile, so every one of them is on the board at once when the slide lands (the dealt tile included: its cell is the
    // far end of a line that moved, always empty after the slide)
    var fl = r.flushes, sp = r.spawned, spId = sp >= 0 ? nextId++ : 0;
    var STEP = M.ms("step"), topMerge = 0;
    r.trace.forEach(function (t) { if (t.merge) topMerge = Math.max(topMerge, G[t.to]); });
    var newBest = base > 0 && old.score <= base && state.score > base;
    var prevTop = old.top;

    // t = 0: every tile slides one cell and the dealt tile slides in with them, so it shows from the first frames
    var tiles = tilesOf(G, map), fx = { merges: tr.merges }, shown = G;
    if (sp >= 0) { map = map.slice(); map[sp] = spId; shown = G.slice(); shown[sp] = old.next; tiles.push({ id: spId, cell: sp, v: old.next }); fx.enter = enterFx(sp, spId, dir); }
    L.sync(tiles, fx);
    snd("slide"); buzz("tap");
    if (topMerge) sounds.sound(STEP, function () { snd("merge", E.rung(topMerge)); buzz("merge"); });
    // t = STEP: the slide has landed; every run leaves in one beat (one pop sound for the lot)
    var end = Math.max(STEP, 1);
    if (fl.length) { var bt = beat(STEP, fl, shown, map); end = bt.t; map = bt.map; }
    ids = map;
    if (!same(ids.map(Boolean), state.grid.map(Boolean))) rekey(); // never expected: the board is the truth
    begin(settle(newBest, { flushes: fl.length, top: state.top, grid: state.grid.slice(), moves: state.moves, run: run() }));
    tl.at(end, done);

    var joins = r.joins || []; // Easy and Medium only
    announce(fl, joins);
    if (fl.some(function (f) { return f.power; }) || joins.some(function (j) { return j.power; })) sounds.sound(STEP, function () { snd("power"); });
    if (state.top > prevTop && state.top >= 96) buzz("big");
    if (newBest) ring();
    persist();
    chrome();
  }

  // ---- power-ups ----
  function activate(name, kbd) {
    flush();
    if (sheetOpen()) return;
    note = "";
    snd("tick");
    if (targeting && targeting.name === name) { targeting = null; return chrome(); }
    targeting = null;
    if (state.over || !E.usable(state, name)) { chrome(); return explain(name); }
    if (name === "undo") {
      var u = E.use(state, "undo");
      if (u.ok) { state = u.state; ended = false; pills = []; persist(); K.toast("Rewound one move"); }
      return render(true);
    }
    targeting = { name: name, picks: [], cur: -1, kbd: !!kbd };
    if (kbd) targeting.cur = firstTarget(name);
    chrome();
  }
  function firstTarget(name) {
    var g = state.grid;
    for (var c = 0; c < 16; c++) if (name === "third" ? (g[c] === 1 || g[c] === 2) : g[c]) return c;
    return 0;
  }
  // keyboard cursor: arrows move it one cell (clamped), Enter or Space picks
  function steer(dir) {
    if (!targeting.kbd) { targeting.kbd = true; if (targeting.cur < 0) { targeting.cur = targeting.picks.length ? targeting.picks[0] : firstTarget(targeting.name); return chrome(); } }
    var r = Math.floor(targeting.cur / 4), c = targeting.cur % 4;
    if (dir === "left") c = Math.max(0, c - 1); else if (dir === "right") c = Math.min(3, c + 1);
    else if (dir === "up") r = Math.max(0, r - 1); else r = Math.min(3, r + 1);
    targeting.cur = r * 4 + c; chrome();
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
    flush();
    if (targeting.picks[0] === cell) { targeting.picks = []; return chrome(); }
    targeting.picks.push(cell);
    var need = targeting.name === "swap" ? 2 : 1;
    if (targeting.picks.length < need) { snd("tick"); return chrome(); }
    var name = targeting.name, a = targeting.picks[0], b = targeting.picks[1], res = E.use(state, name, a, b);
    if (!res.ok) {
      targeting.picks = [];
      K.toast(name === "swap" ? "Pick two different neighbouring tiles" : name === "third" ? "Pick a 1 or a 2" : "Pick a tile", "bad");
      snd("bad");
      return chrome();
    }
    state = res.state; targeting = null; persist();
    // Smash fades the tile out, Swap slides the two tiles past each other, Third pops the tile
    var map = ids.slice(), fx = {};
    if (name === "smash") { fx.out = [map[a]]; map[a] = 0; }
    else if (name === "swap") { var t0 = map[a]; map[a] = map[b]; map[b] = t0; }
    else if (name === "third") { fx.pop = [map[a]]; }
    // the grid right after the power-up, before any flush it lined up
    var G = res.flushes.length ? res.flushes[0].before : state.grid;
    L.sync(tilesOf(G, map), fx);
    snd("place"); buzz("tap");
    if (res.flushes.length) {
      announce(res.flushes);
      // the runs a power-up lines up are all on the board at once: one beat once the power-up's own motion has played
      var o = beat(M.ms("step"), res.flushes, G, map);
      ids = o.map;
      if (!same(ids.map(Boolean), state.grid.map(Boolean))) rekey();
      begin(settle(false));
      tl.at(o.t, done);
      chrome();
    } else {
      ids = map;
      K.toast(NAME[name] + "!");
      chrome();
    }
  }

  // ---- input ----
  window.addEventListener("keydown", function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (sheetOpen()) return;   // a sheet is open: no key reaches the game
    // R17: Enter or Space on a focused link, button or field is that control's own action, never a game action
    var onButton = !!(e.target && /^(A|BUTTON|INPUT|SELECT|TEXTAREA|SUMMARY)$/.test(e.target.tagName));
    if (viewing && (e.key === "Escape" || ((e.key === "Enter" || e.key === " ") && !onButton))) { e.preventDefault(); return view(false); }
    if (e.key === "Escape") { targeting = null; return chrome(); }
    if (targeting && (e.key === "Enter" || e.key === " ") && !onButton) {
      e.preventDefault(); if (targeting.cur < 0) { targeting.kbd = true; targeting.cur = firstTarget(targeting.name); return chrome(); }
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
    viewing = on; note = ""; chrome();
    if (on) boardEl.focus({ preventScroll: true }); else $("again").focus({ preventScroll: true });
  }
  function startNew(t) {
    flush(); targeting = null; note = ""; viewing = false; pills = []; ended = false; disarmTiers();
    if (state.score > best.score) { best.score = state.score; best.used = state.used; }
    if (t) tier = t;
    best = bests[tier]; base = best.score;
    state = E.newGame(K.freshSeed(), tier); persist(); render(true);
    duck(false);
  }
  // ---- difficulty (the family's #diff row, as Two): a different tier starts a new game in it; while a run is going
  // the button first says "Sure?" for 3 s and the hint line says why (R10). The choice is saved. ----
  var tierArm = null, tierT = null;
  function disarmTiers() {
    clearTimeout(tierT); tierT = null; tierArm = null;
    Array.prototype.forEach.call($("diff").children, function (x) { x.textContent = TIER_NAME[x.getAttribute("data-diff")]; });
  }
  Array.prototype.forEach.call($("diff").children, function (b) {
    var t = b.getAttribute("data-diff");
    b.addEventListener("click", function () {
      snd("tick");
      if (t === E.tierOf(state)) return;
      if (state.moves > 0 && !state.over && tierArm !== t) {
        disarmTiers(); K.clearToast(); tierArm = t; b.textContent = "Sure?"; chrome();
        tierT = setTimeout(function () { disarmTiers(); chrome(); }, 3000); return;
      }
      startNew(t); K.toast(TIER_NAME[t] + ": new game");
    });
  });

  // ---- How to play: three steps in the family's one sheet (REDESIGN.md 1.3, 9.3; shared/howto.js, TRIAGE4 D8) ----
  function tiny(v) { var s = document.createElement("span"); s.className = "mt"; paint(s, v); return s.outerHTML; }
  var STEPS = [
    { picture: '<div class="mg" style="grid-template-columns:repeat(3,26px)">' + tiny(3) + '<span class="op">&rarr;</span><span class="mt hole"></span></div>',
      text: "Each swipe moves tiles one step." },
    { picture: '<div class="eq">' + tiny(1) + '<span class="op">+</span>' + tiny(2) + '<span class="op">=</span>' + tiny(3) + "</div>",
      text: "1 and 2 make 3. From 3 up, equal tiles join." },
    { picture: '<div class="eq">' + tiny(3) + tiny(6) + tiny(9) + "</div>", text: "Line up 3, 6, 9 in a row or column, either way round, for a rainbow flush and a power-up." }
  ];
  function markHowto() { try { if (PR) PR.markHowto(ID); } catch (e) { /* in memory */ } }
  var how = null;
  function openHowto() { if (how) how.open(); }
  // it opens by itself once on a first visit (no saved run, never seen), after ui.js has loaded
  document.addEventListener("DOMContentLoaded", function () {
    var U = ui(); if (!U || !U.howto) return;
    how = U.howto(ID, { title: "Three", steps: STEPS, saved: hadSave,
      onOpen: function () { flush(); targeting = null; chrome(); },
      onClose: function () { if (!seen) { seen = true; persist(); } } });
  });
  K.twoStep($("new"), function () { return state.moves > 0 && !state.over; }, function () { startNew(); });
  $("again").addEventListener("click", function () { snd("tick"); startNew(); });
  $("over-view").addEventListener("click", function () { view(true); });
  $("over-undo").addEventListener("click", function () { activate("undo"); boardEl.focus({ preventScroll: true }); });

  if (seen) markHowto();
  render(false);
  if (hadSave) persist(); // keeps the card summary current for a run saved before progress existed
  if (state.over) duck(true);
  // Screenshot hook (tools/shots.cjs): a fixed, representative mid-game. Not reachable from the UI.
  window.__demo = function () {
    flush(); targeting = null; note = ""; viewing = false; if (sheetOpen()) ui().close();
    var s = E.newGame(2026);
    s.grid = [3, 6, 1, 2,
              9, 12, 3, 0,
              2, 18, 24, 6,
              1, 3, 36, 48];
    s.next = 3; s.score = 1284; s.moves = 87; s.flushes = 4; s.top = 48;
    s.power = { undo: 1, smash: 2, swap: 1, third: 1 }; s.prev = null; s.over = false;
    state = s; render(false);
  };
  window.__three = { get state() { return state; }, set state(s) { flush(); state = s; ended = !!s.over; pills = []; render(false); },
    render: function () { render(false); }, settle: flush, busy: function () { return !!finalFn || L.busy(); },
    get ids() { return ids.slice(); }, get base() { return base; }, set base(v) { base = v; }, openHowto: openHowto,
    get viewing() { return viewing; }, set desk(v) { desk = !!v; chrome(); },
    get tier() { return tier; }, get best() { return best; } };
})();
