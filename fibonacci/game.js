/* SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 alvations (Melon Lab)
 * Numberics Fibonacci: browser client, modelled on the Two client (../two/game.js).
 * The engine (engine.js on top of ../two/engine.js) owns every rule; this file only draws, listens, remembers.
 * Motion (docs/design/REDESIGN.md 5.3): tiles are kept by identity in the shared keyed layer (shared/motion.js), so every
 * tile slides from its old cell to its new one as in the original 2048; a joined tile pops on top after the slide and a
 * new tile appears after it. A new input finishes the running animation and is applied at once (5.11). Sounds, haptics
 * and the move's trophy check run on one timeline; sounds follow the family's one rule (shared/motion.js, TRIAGE4 D7):
 * an input that ends a running animation plays the pending sounds at once (one of each) and its own with it. */
(function () {
  "use strict";
  var N = window.NumbericsFibonacci, K = window.NumbericsKit, P = window.NumbericsPower, M = window.NumbericsMotion;
  var ID = "fibonacci";
  var store = K.store("numberics_fibonacci_v1");

  function int(v) { return Number.isInteger(v) && v >= 0; }
  function num(v) { return typeof v === "number" && isFinite(v) && v >= 0; }
  function validPower(p) { return !!p && N.POWERS.every(function (k) { return int(p[k]); }); }
  function validGrid(g) { return Array.isArray(g) && g.length === 16 && g.every(int); }
  // A saved snapshot for Undo: the same fields the engine's snapshot() writes.
  function validPrev(p) {
    return !!p && validGrid(p.grid) && validPower(p.power) && num(p.score) && int(p.top) && int(p.moves) && num(p.seed);
  }
  function valid(s) {
    if (!(!!s && s.size === 4 && validGrid(s.grid) && validPower(s.power) &&
      num(s.score) && int(s.top) && int(s.moves) && num(s.seed))) return false;
    if (s.prev != null && !validPrev(s.prev)) s.prev = null; // a broken snapshot costs one Undo, not the run
    s.over = !!s.over; s.free = !!s.free; // R2: a reload never turns a power-up-assisted swipe into a paid one
    return true;
  }

  var saved = store.load();
  var fresh = !saved; // a first visit: the how-to sheet opens once (REDESIGN.md 1.3)
  // Tiers (O-13, as Two: fibonacci/engine.js RULES.reach): Easy, Medium, Hard differ only in which joins earn a
  // power-up. The tier is the state's own (state.tier; none = Hard), so a save from before the tiers loads as Hard and
  // nobody's game in progress changes rules. A first visit with no save starts on Medium. `tier` (the choice for the
  // next game) is saved with the game.
  var TIER_NAME = { easy: "Easy", medium: "Medium", hard: "Hard" };
  function okTier(t) { return N.TIERS.indexOf(t) >= 0; }
  var loaded = !!(saved && valid(saved.state));
  var tier = saved && okTier(saved.tier) ? saved.tier : loaded ? N.tierOf(saved.state) : "medium";
  var state = loaded ? saved.state : N.newGame(K.freshSeed(), 4, tier);
  tier = N.tierOf(state);
  // Best score and top tile per tier: bestScore / bestTop (the old fields) stay Hard's, so an old save keeps its best
  // on Hard; Easy and Medium keep theirs in `bests`.
  var bests = { hard: { score: num(saved && saved.bestScore) ? saved.bestScore : 0, top: int(saved && saved.bestTop) ? saved.bestTop : 0 } };
  ["easy", "medium"].forEach(function (t) {
    var b = saved && saved.bests && saved.bests[t];
    bests[t] = { score: b && num(b.score) ? b.score : 0, top: b && int(b.top) ? b.top : 0 };
  });
  var best = bests[tier];
  // The best score before this run started, so the end card can say "New best." (R8).
  var runBest = loaded && num(saved.runBest) ? saved.runBest : best.score;
  // The run record (REDESIGN.md 8.2): only for trophies, never a rule. used = power-ups used this run.
  var run = saved && valid(saved.state) && saved.run && int(saved.run.used) ? { used: saved.run.used } : { used: 0 };
  // Trophies earned by the run's last move and its end, shown as pills on the end card (8.1).
  var endTro = saved && valid(saved.state) && state.over && Array.isArray(saved.endTro) ? saved.endTro.filter(function (x) { return typeof x === "string"; }) : [];
  var targeting = null;           // {name, picks:[], kbd} while a power-up waits for a target
  var cursor = 0;                 // keyboard cursor cell while targeting (R9)
  var note = "";                  // a tray explanation shown in the hint line until the next action (R5)
  // Round 3 end-card pattern (as Two): the locked board shows undimmed for HOLD ms, then the card; "See the
  // board" hides it again (a tap on the board, Esc or Enter brings it back). A run that loads already over shows the card.
  var HOLD = 1500, holding = false, holdT = null, viewing = false, wasOver = !!state.over, ducked = false;

  var $ = function (id) { return document.getElementById(id); };
  var boardEl = $("board"), tilesEl = $("tiles"), cellsEl = $("cells"), marksEl = $("marks");
  for (var i = 0; i < 16; i++) cellsEl.appendChild(document.createElement("div"));

  function persist() {
    best = bests[N.tierOf(state)];
    best.score = Math.max(best.score, state.score); best.top = Math.max(best.top, state.top);
    store.save({ state: state, tier: tier, bestScore: bests.hard.score, bestTop: bests.hard.top,
      bests: { easy: bests.easy, medium: bests.medium }, runBest: runBest, run: run, endTro: endTro });
    // the card summary (shared/progress.js): what the games list and the Games sheet show for Fibonacci (this tier's best)
    var NP = window.NumbericsProgress;
    if (NP) NP.put(ID, { best: best.score > 0 ? TIER_NAME[N.tierOf(state)] + " best " + fmt(best.score) : "", live: !state.over && state.moves > 0,
      liveText: "Score " + fmt(state.score) });
  }
  var fmt = K.fmt;
  // sounds and haptics (shared/audio.js through shared/motion.js); a missing module costs a sound, never the game
  var sfx = M.sfx, buzz = M.buzz;
  function trophy(event, data) {
    var T = window.NumbericsTrophies; if (!T || !T.report) return [];
    try { return T.report(ID, event, data) || []; } catch (e) { return []; }
  }
  function duck(on) {
    if (on === ducked) return; ducked = on;
    try { if (window.NumbericsMusic && window.NumbericsMusic.duck) window.NumbericsMusic.duck(on); } catch (e) { /* no music */ }
  }

  // Big tiles read "F" with the Fibonacci index as a subscript (the engine label uses Unicode subscripts).
  function isSub(level) { return N.label(level).charAt(0) === "F"; }
  function spoken(level) { return isSub(level) ? "Fibonacci number " + N.fibIndex(level) : N.label(level); }
  function setLabel(face, node, level) {
    face.textContent = "";
    if (isSub(level)) {
      var idx = String(N.fibIndex(level));
      face.appendChild(document.createTextNode("F"));
      var sub = document.createElement("sub"); sub.textContent = idx; face.appendChild(sub);
      node.setAttribute("data-len", String(Math.min(6, 1 + idx.length)));
    } else { var l = N.label(level); face.textContent = l; node.setAttribute("data-len", String(l.length)); }
    node.setAttribute("aria-label", "tile " + spoken(level));
  }
  function place(el, cell) { el.style.setProperty("--r", Math.floor(cell / 4)); el.style.setProperty("--c", cell % 4); }

  // ---- the keyed tile layer (REDESIGN.md 5.2, 5.3). ids[cell] is the client's identity map, never saved. ----
  var layer = M.layer(tilesEl, {
    cols: 4, rows: 4,
    paint: function (node, t) {
      var face = node.querySelector(".face");
      node.classList.toggle("lo", t.lv === 1);
      node.style.setProperty("--h", hue(t.lv));
      setLabel(face, node, t.lv);
    }
  });
  var fx = M.seq();               // the move's timeline: sounds, the ring, the trophy check
  var ids = [], nextId = 1;
  function rekey() { var k = M.rekey(state.grid, nextId); ids = k.ids; nextId = k.next; }
  function tiles() {
    var out = [];
    for (var c = 0; c < 16; c++) if (state.grid[c]) out.push({ id: ids[c], cell: c, lv: state.grid[c] });
    return out;
  }
  // draw the board: a re-key (load, New game, Undo, a test setting the state) or the effects of one move/power-up
  function board(f, again) {
    if (again) rekey();
    layer.sync(tiles(), f || {});
  }
  // Whatever is still animating ends now; its pending sounds play at once, one of each (5.11, D7).
  function settle() { fx.finish(layer.busy()); layer.finish(); }

  function render() {
    Array.prototype.forEach.call($("diff").children, function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-diff") === N.tierOf(state))); });
    $("score").textContent = fmt(state.score);
    var bs = Math.max(bests[N.tierOf(state)].score, state.score);
    $("best").textContent = bs ? fmt(bs) : "none"; $("best").classList.toggle("none", !bs); // R11: an empty best says none
    $("top").textContent = state.top ? N.label(state.top) : "none";
    $("top").classList.toggle("none", !state.top);
    renderTray();
    renderMarks();
    boardEl.classList.toggle("targeting", !!targeting);
    var over = $("over"), was = !over.hidden;
    if (state.over && !wasOver) { // the run just ended: hold the final board first
      holding = true; viewing = false; clearTimeout(holdT);
      var gen = state.moves;
      holdT = setTimeout(function () { holdT = null; if (holding && state.over && state.moves === gen) { holding = false; fx.finish(); render(); } }, HOLD);
      endTro = endTro.concat(trophy("end", { score: state.score, value: N.value(state.top), run: { used: run.used } }));
      persist();
    }
    if (!state.over) { holding = false; viewing = false; clearTimeout(holdT); holdT = null; }
    wasOver = !!state.over;
    over.hidden = !state.over || holding || viewing;
    duck(!over.hidden);
    // one "New game" on screen at a time: the card's primary replaces the page button, whose space is kept
    $("new").style.visibility = state.over ? "hidden" : "";
    if (state.over) {
      K.clearToast(); // the end card is the only message (round 2: a toast sat on it)
      // R8: one summary line, "<Result> · <score>", and a new best says so.
      $("over-text").textContent = "Top tile " + N.label(state.top) + " · Score " + fmt(state.score);
      var nb = state.score > runBest;
      $("over-best").hidden = !nb;
      var T = window.NumbericsTrophies; if (T && T.pills) T.pills($("over-tro"), endTro);
      if (!over.hidden && !was) {
        if (nb) { sfx("best"); glow($("best").parentNode); } // the new best moment (8.5)
        try { $("again").focus({ preventScroll: true }); } catch (e) { /* focus is a nicety */ }
      }
    }
  }
  // a one-shot gold ring (opacity only) on a stat box
  function glow(el) {
    if (!el) return;
    el.classList.remove("glow"); void el.offsetWidth; el.classList.add("glow");
    setTimeout(function () { el.classList.remove("glow"); }, 460);
  }
  // "See the board" hides the card; a tap on the board, Esc or Enter brings it back (or skips the hold)
  function view(on) {
    fx.finish();
    viewing = on; holding = false; note = ""; clearTimeout(holdT); holdT = null; render();
    if (on) { try { boardEl.focus({ preventScroll: true }); } catch (e) { /* focus is a nicety */ } }
  }
  // Picked cells (gold) and the keyboard cursor (dashed), drawn above the tiles so a tile never hides them.
  function renderMarks() {
    marksEl.textContent = "";
    if (!targeting) return;
    for (var k = 0; k < 16; k++) {
      var picked = targeting.picks.indexOf(k) >= 0, cur = targeting.kbd && k === cursor;
      if (!picked && !cur) continue;
      var m = document.createElement("div");
      m.className = "tile mark" + (picked ? " sel" : "") + (cur ? " cur" : "");
      place(m, k); marksEl.appendChild(m);
    }
  }
  // Sequence colours. Round 3 (craft #2): a 111-degree step put 3 (green) beside 13 (lime) and 34 beside 144, both
  // 27 degrees apart. Now a table of 11 hues, picked so that at the tile's own saturation and lightness any two of
  // them differ by at least 30 (CIELAB delta E) and dark text keeps 4.79:1 or better, and ordered so that the pairs
  // that merge (neighbours in the sequence) differ by 86 or more. Any 11 values in a row (2 to 233, 3 to 377 ...)
  // never share a colour. 1 keeps the cream tile.
  var HUES = [357, 178, 326, 151, 222, 45, 290, 22, 118, 203, 75];
  function hue(level) { return level < 2 ? 40 : HUES[(level - 2) % HUES.length]; }

  var PW = { undo: "Undo", smash: "Smash", swap: "Swap", boost: "Boost" };
  // R5: tooltip voice "1: Undo. Take back the last move.", and a tap on an unusable slot explains it.
  // How each tier earns, one sentence each (the tray and the How to play row say the same; O-14: one short line).
  var EARNS = {
    hard: "Earned by each new top tile from 55.",
    medium: "Earned by a join that makes your top tile or the one below it (55 up).",
    easy: "Earned by a join that makes your top tile or one of the 3 below it (55 up)."
  };
  function earn() { return EARNS[N.tierOf(state)]; }
  var DEFS = [
    { id: "undo", label: "Undo", desc: "Take back the last move." },
    { id: "smash", label: "Smash", desc: "Remove one tile." },
    { id: "swap", label: "Swap", desc: "Exchange two cells." },
    { id: "boost", label: "Boost", desc: "Step a tile up one Fibonacci number (1 becomes 2)." },
  ];
  var PW_HINT = { smash: "Tap a tile to smash it.", boost: "Tap a tile to step it up (1 to 2).",
                  swap: "Tap two cells to swap them." };
  // Milestone toasts start at 13 (round 2 craft nit: "New tile 2", "New tile 3" were noise every game).
  var TOAST_FROM = 6;
  var touchOnly = (function () { try { return window.matchMedia("(hover: none) and (pointer: coarse)").matches; } catch (e) { return false; } })();
  function targetHint() {
    if (targeting.kbd) {
      // kept to one line at 375px so the board never jumps; round 3 (craft #13): it also says tapping works
      var what = targeting.name === "swap" ? (targeting.picks.length ? "Tap the second cell" : "Tap the first cell")
        : targeting.name === "boost" ? "Tap a tile to step up" : "Tap a tile to smash";
      return what + ", or arrows + Enter. Esc cancels.";
    }
    // cold #5: there is no Esc on a phone
    return PW_HINT[targeting.name] + (touchOnly ? " Tap " + PW[targeting.name] + " to cancel." : " (Esc cancels)");
  }
  // The tray is rebuilt only when what it shows changes, and at once after a swipe, so a tap that lands
  // while the slide animates still hits a live button (cold #2: the animation's redraw swallowed it).
  var trayKey = "";
  function renderTray() {
    var key = JSON.stringify([state.power, targeting && targeting.name, state.over, !!state.prev, N.tierOf(state)]);
    if (key !== trayKey || !$("tray").firstChild) { trayKey = key; drawTray(); }
    renderHint();
  }
  function drawTray() {
    P.tray($("tray"), DEFS, state.power, {
      armed: targeting && targeting.name,
      earn: earn(),
      disabled: function (id) {
        if (state.over) return "The game is over.";
        return id === "undo" && state.power.undo > 0 && !state.prev ? "Nothing to take back yet." : false;
      },
      onUse: activate,
      onInfo: function (id, text) { settle(); targeting = null; note = text; sfx("bad"); render(); },
    });
  }
  var START = "Swipe or use the arrow keys.";
  function renderHint() {
    $("hint").textContent = targeting ? targetHint() : state.over ? (viewing ? "Tap the board for the summary." : note)
      : tierArm ? "Tap " + TIER_NAME[tierArm] + " again: this ends the run."
      : note ? note : !N.canMove(state) ? "Stuck. Use a power-up to keep going."
      : !state.moves ? START : ""; // craft #12: a new game says how to start, so the row is never blank on open
  }
  function toast(msg, kind) { K.toast(msg, kind); }

  // ---- the score float: "+N" rises 6 px into the Score box's label row and fades over 640 ms (opacity only under reduced
  // motion); it never leaves the box (TRIAGE5 S20) ----
  var plusEl = null, plusT = null;
  function plus(n) {
    if (plusEl && plusEl.parentNode) plusEl.parentNode.removeChild(plusEl);
    clearTimeout(plusT); plusEl = null;
    if (!(n > 0)) return;
    var el = document.createElement("span"); el.className = "plus"; el.setAttribute("aria-hidden", "true");
    el.textContent = "+" + fmt(n);
    $("score").parentNode.appendChild(el); plusEl = el;
    var f = [{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "translateY(0)", offset: 0.15 },
      { opacity: 1, transform: "translateY(0)", offset: 0.7 }, { opacity: 0, transform: "translateY(0)" }];
    M.play(el, f, { duration: M.T.plus, easing: M.E.out, fill: "forwards" }, [{ opacity: 1 }, { opacity: 0 }]);
    plusT = setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); if (plusEl === el) plusEl = null; }, M.T.plus + 40);
  }
  // ---- the gold ring on a new highest tile that pays (from 55): a span on the tile, CSS keyframes (style.css) ----
  function ring(id) {
    var node = layer.get(id); if (!node) return;
    var r = document.createElement("span"); r.className = "ring"; r.setAttribute("aria-hidden", "true");
    node.appendChild(r);
    return r;
  }

  // ---- a move: state first, then the layer slides every tile; stats, tray, toast and save in the same handler ----
  function doMove(dir) {
    settle();
    if (targeting) return;
    var from = N.payFrom(state), r = N.move(state, dir);
    if (!r.moved) return;
    note = "";
    var before = state, t = M.track(ids, r.trace, r.spawned, nextId);
    ids = t.ids; nextId = t.next;
    state = r.state;
    board(t);
    var top = r.milestones.length ? r.milestones[r.milestones.length - 1] : 0;
    // Easy and Medium (O-13) also pay joins below a new top tile: the biggest join that reached the tier's bar
    var made = top >= N.AWARD_FROM_INDEX ? 0 : Math.max.apply(null, [0].concat(r.merges.filter(function (l) { return l >= from; })));
    var plusText = r.awarded.map(function (a) { return "+1 " + PW[a.power]; }).join(" ");
    var full = r.full || N.POWERS.every(function (k) { return before.power[k] >= N.POWER_CAP; });
    if (top >= TOAST_FROM && !state.over) { // R7: when the move ends the game, the end card is the only message
      var why = "";
      if (r.awarded.length) why = " " + plusText;
      else if (top >= N.AWARD_FROM_INDEX) // a paying tile that paid nothing: say why (R2, R15)
        why = r.free ? ". No reward right after a power-up."
          : r.marked ? ". Swapped and boosted tiles earn no reward." // R2 by tile (round 3)
          : full ? ". Power-ups full." : "";
      toast("New tile " + N.label(top) + why, why && !r.awarded.length ? "info" : undefined);
    } else if (made && !state.over) { // a paying join below a new top tile (Easy, Medium), or why it paid nothing
      if (r.awarded.length) toast("Made " + N.label(made) + " " + plusText);
      else if (r.free) toast("Made " + N.label(made) + ". No reward right after a power-up.", "info");
      else if (r.marked) toast("Made " + N.label(made) + ". Swapped and boosted tiles earn no reward.", "info");
      else if (full) toast("Made " + N.label(made) + ". Power-ups full.", "info");
    }
    plus(state.score - before.score);
    persist(); render();
    // the timeline (REDESIGN.md 5.3, 7.3): slide now, the join sound as the slide ends, the ring and chimes after the pop
    var slide = M.ms("slide"), after = slide + M.ms("pop");
    sfx("slide");
    if (r.merges.length) {
      var k = Math.max.apply(null, r.merges);
      fx.sound(slide, function () { sfx("merge", k); buzz("merge"); });
    }
    var topId = top >= N.AWARD_FROM_INDEX ? ids[state.grid.indexOf(top)] : made && r.awarded.length ? ids[state.grid.indexOf(made)] : 0;
    var paid = r.awarded.length > 0;
    if (topId) {
      var rg = ring(topId);
      if (top >= N.AWARD_FROM_INDEX) fx.sound(after, function () { sfx("best"); buzz("big"); });
      fx.at(after + 420 + 20, function () { if (rg && rg.parentNode) rg.parentNode.removeChild(rg); });
    }
    if (paid) fx.sound(after + 140, function () { sfx("power"); });
    if (state.over) fx.sound(after, function () { sfx("lose"); buzz("lose"); });
    // the move's trophy check runs at the pop, so its toast and chime land with what it names (8.4)
    var data = { value: N.value(state.top), merges: r.merges.length, grid: state.grid.map(N.value), moves: state.moves, run: { used: run.used } };
    var ended = state.over;
    fx.at(after, function () {
      var got = trophy("move", data);
      if (ended && got.length) { endTro = endTro.concat(got); persist(); if (state.over) render(); }
    });
  }

  // ---- power-ups ----
  function activate(name, kbd) {
    settle(); note = "";
    if (targeting && targeting.name === name) { targeting = null; return render(); }
    targeting = null;
    if (state.over) return render();
    if (name === "undo") {
      var u = N.use(state, "undo");
      if (u.ok) { state = u.state; run.used++; persist(); board({ fade: true }, true); toast("Rewound one move"); return render(); }
      return explain(name);
    }
    if (!state.power[name]) return explain(name);
    targeting = { name: name, picks: [], kbd: !!kbd };
    K.clearToast(); // the toast sits over the hint line; the targeting hint must be readable
    if (kbd) startCursor();
    render();
  }
  // A key (1 to 4, U) on a slot that cannot act explains it, like a tap does (R5).
  function explain(name) {
    var d = DEFS[N.POWERS.indexOf(name)];
    sfx("bad");
    note = P.info(d, state.power, state.power[name] ? "Nothing to take back yet." : false, { earn: earn() }); return render();
  }
  // Keyboard targeting starts on the highest tile (the usual target).
  function startCursor() {
    var b = 0; state.grid.forEach(function (v, k) { if (v > state.grid[b]) b = k; }); cursor = b;
  }
  function moveCursor(dir) {
    var r = Math.floor(cursor / 4), c = cursor % 4;
    if (dir === "left") c = Math.max(0, c - 1); else if (dir === "right") c = Math.min(3, c + 1);
    else if (dir === "up") r = Math.max(0, r - 1); else r = Math.min(3, r + 1);
    cursor = r * 4 + c;
    if (!targeting.kbd) targeting.kbd = true;
    render();
  }
  function cellAt(ev) {
    var rect = boardEl.getBoundingClientRect(), x = ev.clientX - rect.left, y = ev.clientY - rect.top;
    var c = Math.floor(x / rect.width * 4), r = Math.floor(y / rect.height * 4);
    return (c < 0 || c > 3 || r < 0 || r > 3) ? -1 : r * 4 + c;
  }
  function pick(ev) {
    if (ev.target && ev.target.closest && ev.target.closest("#over")) return; // the card's own buttons
    if (state.over && (viewing || holding)) return view(false);
    if (!targeting) return;
    var cell = cellAt(ev); if (cell < 0) return;
    targeting.kbd = false; pickCell(cell);
  }
  function pickCell(cell) {
    settle();
    var picks = targeting.picks;
    if (picks.length && picks[0] === cell) { picks.length = 0; return render(); } // tap the first pick again to drop it
    picks.push(cell);
    var need = targeting.name === "swap" ? 2 : 1;
    if (picks.length < need) { sfx("tick"); return render(); }
    var name = targeting.name, wasTop = state.top, a = picks[0], b = picks[1];
    var res = N.use(state, name, a, b);
    if (res.ok) {
      state = res.state; targeting = null; run.used++; persist();
      // 5.3: Smash fades the tile out, Boost pops it, Swap slides the two tiles to each other's cells
      if (name === "smash") { var gone = ids[a]; ids[a] = 0; board({ out: [gone] }); }
      else if (name === "boost") board({ pop: [ids[a]] });
      else { var x = ids[a]; ids[a] = ids[b]; ids[b] = x; board({}); }
      sfx("place"); buzz("tap");
      // gameplay nit: a Boost that makes a new highest tile pays nothing, so say why no reward came
      if (!state.over) toast(name === "boost" && state.top > wasTop && state.top >= N.AWARD_FROM_INDEX
        ? "Boosted to " + N.label(state.top) + ". Boosted tiles earn no reward." : PW[name] + "!");
    } else {
      targeting.picks = [];
      sfx("bad");
      toast(name === "swap" ? "Pick two cells, at least one with a tile" : "Pick a tile, not an empty cell", "bad");
    }
    render();
  }

  // ---- input ----
  window.addEventListener("keydown", function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (window.NumbericsUI && window.NumbericsUI.open && window.NumbericsUI.open()) return; // a sheet owns the keys
    var tag = e.target && e.target.tagName;
    // R9, R17: Enter or Space on a focused control belongs to that control, never to the game; typing in a
    // field is never a game key
    if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
    if ((e.key === "Enter" || e.key === " ") && (tag === "BUTTON" || tag === "A" || tag === "SUMMARY")) return;
    if (state.over && (viewing || holding) && (e.key === "Escape" || e.key === "Enter" || e.key === " ")) { e.preventDefault(); return view(false); }
    if (e.key === "Escape") { targeting = null; return render(); }
    var pi = ["1", "2", "3", "4"].indexOf(e.key);
    if (pi >= 0) return activate(N.POWERS[pi], true);
    if (e.key === "u" || e.key === "U") return activate("undo", true);
    var d = K.arrowKey(e);
    if (targeting) {
      if (d) { e.preventDefault(); return moveCursor(d); }
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (!targeting.kbd) { targeting.kbd = true; startCursor(); return render(); }
        return pickCell(cursor);
      }
      return;
    }
    if (d) { e.preventDefault(); doMove(d); }
  });
  boardEl.addEventListener("click", pick);
  K.swipe(boardEl, doMove);
  // Round 3 (cold #5, as Two): without a non-passive touchmove the browser runs its own scroll gesture for a
  // swipe, and the next tap (on a power-up just earned) only stops it: no click. Owning the move keeps the tap.
  boardEl.addEventListener("touchmove", function (e) { if (e.cancelable) e.preventDefault(); }, { passive: false });

  // ---- new game: two-step instead of a blocking confirm() dialog ----
  function startNew(t) {
    settle(); targeting = null; note = ""; disarmTiers();
    best.score = Math.max(best.score, state.score);
    if (t) tier = t;
    best = bests[tier]; runBest = best.score;
    state = N.newGame(K.freshSeed(), 4, tier); run = { used: 0 }; endTro = [];
    persist(); board({}, true); render(); duck(false);
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
      sfx("tick");
      if (t === N.tierOf(state)) return;
      if (state.moves > 0 && !state.over && tierArm !== t) {
        disarmTiers(); K.clearToast(); tierArm = t; b.textContent = "Sure?"; render();
        tierT = setTimeout(function () { disarmTiers(); render(); }, 3000); return;
      }
      startNew(t); toast(TIER_NAME[t] + ": new game");
    });
  });
  K.twoStep($("new"), function () { return state.moves > 0 && !state.over; }, function () { startNew(); });
  $("again").addEventListener("click", function () { startNew(); });
  $("over-view").addEventListener("click", function () { view(true); });

  // ---- how to play (REDESIGN.md 1.3, 9.2): three steps, each a small drawn picture and one sentence ----
  function mt(lv) {
    return '<span class="mt' + (lv === 1 ? " lo" : "") + '" style="--h:' + hue(lv) + '">' + N.label(lv) + "</span>";
  }
  function cell(t) { return '<span class="mt cell" aria-hidden="true">' + t + "</span>"; }
  var STEPS = [
    // TRIAGE4 (cold): "1 arrow 2" read as "1 becomes 2". The picture is a slide: the same 3 before and after, in a row
    // of cells, and the cells it crossed show the way it went. No two different numbers, so it never reads as a join.
    { picture: '<div class="mg slide">' + mt(3) + cell("") + cell("") + cell("") +
        cell("&rsaquo;") + cell("&rsaquo;") + cell("&rsaquo;") + mt(3) + "</div>",
      text: "Swipe to slide every tile." },
    { picture: '<div class="eq">' + mt(2) + '<span class="op">+</span>' + mt(3) + '<span class="op">=</span>' + mt(4) + "</div>",
      text: "Neighbours in the run join: 1 and 1, 1 and 2, 2 and 3, 3 and 5." },
    { picture: '<div class="eq">' + mt(3) + '<span class="op">+</span>' + mt(3) + '<span class="op no">no</span></div>',
      text: "Equal tiles do not join, except 1 and 1." }
  ];
  var how = null;
  function howto() { if (how) how.open(); }
  // the shared sheet (shared/howto.js, TRIAGE4 D8): it opens by itself once, never with a saved game; ui.js loads last
  window.addEventListener("DOMContentLoaded", function () {
    var U = window.NumbericsUI; if (U && U.howto) how = U.howto(ID, { title: "Fibonacci", steps: STEPS, saved: !fresh });
  });

  board({}, true);
  render();
  // Screenshot hook (tools/shots.cjs): a fixed, representative mid-game. Not reachable from the UI.
  window.__demo = function () {
    settle(); targeting = null;
    if (window.NumbericsUI && window.NumbericsUI.open && window.NumbericsUI.open()) window.NumbericsUI.close();
    var s = N.newGame(34), dirs = ["down", "left", "down", "right"]; // Hard: the same fixed board as before the tiers
    for (var k = 0; k < 600 && !s.over; k++) {
      var r = N.move(s, dirs[k % 4]);
      if (!r.moved) r = N.move(s, "up");
      s = r.state;
      if (s.top >= 12 && s.grid.filter(Boolean).length >= 11 && new Set(s.grid).size >= 9) break; // top 233, varied
    }
    s.power = { undo: 1, smash: 2, swap: 1, boost: 1 };
    state = s; note = ""; board({}, true); render();
  };
  window.__fibonacci = { get state() { return state; }, set state(s) { settle(); state = s; board({}, true); render(); }, render: render,
    get cursor() { return cursor; }, get targeting() { return targeting; }, hue: hue,
    get runBest() { return runBest; }, set runBest(v) { runBest = v; },
    get run() { return run; }, get endTro() { return endTro; }, get ids() { return ids.slice(); },
    layer: layer, howto: howto,
    get viewing() { return viewing; }, get holding() { return holding; }, showCard: function () { view(false); },
    get tier() { return tier; }, get best() { return best; } };
})();
