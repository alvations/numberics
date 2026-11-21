/* SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 alvations (Melon Lab)
 * Numberics Two: browser client. The engine (engine.js) owns every rule;
 * this file only draws, listens, and remembers.
 * Motion (docs/design/REDESIGN.md 5.3): like the original 2048, every tile keeps its element (NumbericsMotion.layer,
 * keyed by an id per cell that lives only here, never in the engine or the save) and slides by transform; a merged
 * tile pops on top after the slide, a spawned tile appears after it. A new input finishes the running animation and
 * is applied at once (5.11). Sounds follow the family's one rule (shared/motion.js, TRIAGE4 D7): a new input that ends
 * a running animation plays the pending sounds at once (one of each), and its own sounds play with it, never late. */
(function () {
  "use strict";
  var N = window.Numberics, K = window.NumbericsKit, P = window.NumbericsPower, M = window.NumbericsMotion;
  // optional modules: a missing one costs a nicety, never the game
  var A = M.sfx, buzz = M.buzz;   // the shared sound and haptic calls (shared/motion.js: one rule under fast play)
  function trophy(event, data) {
    try { var T = window.NumbericsTrophies; return T && T.report ? T.report("two", event, data) || [] : []; } catch (e) { return []; }
  }
  function duck(on) { try { if (window.NumbericsMusic) window.NumbericsMusic.duck(on); } catch (e) { /* no music */ } }
  // storage goes through NumbericsKit.store: every localStorage call is in try/catch, memory fallback
  // Two was called Endless; the key is kept so saved games load (REDESIGN.md 4.2). Never rename it.
  var store = K.store("numberics_endless_v1");
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
  // the run record (REDESIGN.md 8.2, 8.4): only lets trophies see how a run went, never changes a rule.
  // used: power-ups used this run; stuckUse: the move count when one was used while no move was possible.
  function freshRun() { return { used: 0, stuckUse: null }; }
  function validRun(r) {
    return r && typeof r === "object" && int(r.used) ? { used: r.used, stuckUse: int(r.stuckUse) ? r.stuckUse : null } : freshRun();
  }

  var saved = store.load();
  // Tiers (O-12, two/engine.js REACH): Easy, Medium, Hard differ only in which joins earn a power-up. The tier is the
  // state's own (state.tier; none = Hard), so a save from before the tiers (numberics_endless_v1, no tier) loads as Hard
  // and nobody's game in progress changes rules. A first visit with no save starts on Medium (the owner: Hard's rate
  // was too slow). `tier` (the choice for the next game) is saved with the game.
  var TIER_NAME = { easy: "Easy", medium: "Medium", hard: "Hard" };
  function okTier(t) { return N.TIERS.indexOf(t) >= 0; }
  var loaded = !!(saved && valid(saved.state));
  var tier = saved && okTier(saved.tier) ? saved.tier : loaded ? N.tierOf(saved.state) : "medium";
  var state = loaded ? saved.state : N.newGame(freshSeed(), 4, tier);
  tier = N.tierOf(state);
  // Best score and top tile per tier: bestScore / bestTop (the old fields) stay Hard's, so an old save keeps its best
  // on Hard; Easy and Medium keep theirs in `bests`.
  var bests = { hard: { score: (saved && +saved.bestScore) || 0, top: (saved && +saved.bestTop) || 0 } };
  ["easy", "medium"].forEach(function (t) {
    var b = saved && saved.bests && saved.bests[t];
    bests[t] = { score: (b && +b.score) || 0, top: (b && +b.top) || 0 };
  });
  var best = bests[tier];
  var run = loaded ? validRun(saved.run) : freshRun();
  // the best score before this run began, so the end screen can say "New best."
  var bestBefore = saved && typeof saved.bestBefore === "number" ? saved.bestBefore
    : (state.score > 0 && state.score >= best.score ? 0 : best.score);
  var bestRung = bestBefore > 0 && state.score > bestBefore; // the New best moment plays once per run (8.5)
  var targeting = null;           // {name, picks:[]} while a power-up waits for a target
  var cur = -1, kbd = false;      // keyboard aiming cursor (cell), shown once a key aims
  var note = "";                  // a tray explanation in the hint line, until the next action
  // TRIAGE4 (craft #12): the hint row is never blank on open; it says how to play until the first move on this page
  var OPEN_HINT = "Swipe or use the arrow keys.", opening = true;
  var newArmed = null, endIds = [];
  // Round 3 end-card pattern: the locked board shows undimmed for HOLD ms, then the card; "See the board" hides
  // the card again (a tap on the board, Esc or Enter brings it back). A run that loads already over shows the card.
  var HOLD = 1500, holding = false, holdT = null, viewing = false, wasOver = !!state.over, cardUp = false;

  var $ = function (id) { return document.getElementById(id); };
  var boardEl = $("board"), tilesEl = $("tiles"), cellsEl = $("cells");
  for (var i = 0; i < 16; i++) cellsEl.appendChild(document.createElement("div"));

  // ---- the keyed tile layer ----
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
  var layer = M.layer(tilesEl, {
    cols: 4, rows: 4,
    make: function () {
      var t = document.createElement("div"), f = document.createElement("div");
      f.className = "face"; t.appendChild(f); return t;
    },
    paint: function (node, t) {
      node.style.setProperty("--h", ((t.lv * 43 + 30) % 360)); // the palette: hue cycles forever
      node.classList.toggle("lo", t.lv === 1); node.classList.toggle("lo2", t.lv === 2);
      setLabel(node.firstChild, t.lv);
    }
  });
  var ids = [], nextId = 1;       // ids[cell]: the identity of the tile in that cell (client only)
  function tilesOf() {
    var out = [];
    state.grid.forEach(function (lv, cell) { if (lv) out.push({ id: ids[cell], cell: cell, lv: lv }); });
    return out;
  }
  // Undo, load, New game and a forced state: every tile gets a fresh id, so nodes swap without a slide
  function rekey(fx) {
    var rk = M.rekey(state.grid, nextId); ids = rk.ids; nextId = rk.next;
    layer.sync(tilesOf(), fx || {});
  }
  var snd = M.seq();              // the move's sounds, at their visual moment (D7: a new input plays what is pending)
  var ringNode = null, ringT = null;
  function clearRing() { clearTimeout(ringT); ringT = null; if (ringNode) ringNode.classList.remove("ring"); ringNode = null; }
  function ring(node) {
    clearRing(); if (!node) return;
    ringNode = node; node.classList.add("ring");
    ringT = setTimeout(clearRing, M.T.slide + M.T.pop + 420 + 40);
  }
  function plus(n) { // the score "+N" rises into the Score box and fades (640 ms; opacity only under reduced motion; S20)
    var box = $("score").parentNode, old = box.querySelector(".plus");
    if (old) box.removeChild(old);
    var p = document.createElement("span"); p.className = "plus"; p.setAttribute("aria-hidden", "true"); p.textContent = "+" + fmt(n);
    box.appendChild(p);
    setTimeout(function () { if (p.parentNode) p.parentNode.removeChild(p); }, M.T.plus + 40);
  }
  function bestMoment() { // a gold ring on the Best stat (opacity, 420 ms) and the best() chime, once per run
    var box = $("best").parentNode;
    box.classList.remove("rung"); void box.offsetWidth; box.classList.add("rung");
    setTimeout(function () { box.classList.remove("rung"); }, 460);
  }

  function persist() {
    best = bests[N.tierOf(state)];
    best.score = Math.max(best.score, state.score); best.top = Math.max(best.top, state.top);
    store.save({ state: state, tier: tier, bestScore: bests.hard.score, bestTop: bests.hard.top,
      bests: { easy: bests.easy, medium: bests.medium }, bestBefore: bestBefore, run: run });
    // the card summary (shared/progress.js): what the Games list and the cards on other pages show for Two (this tier's best)
    var NP = window.NumbericsProgress;
    if (NP) NP.put("two", { best: best.score > 0 ? TIER_NAME[N.tierOf(state)] + " best " + K.fmt(best.score) : "", live: !state.over && state.moves > 0,
      liveText: "Score " + K.fmt(state.score) });
  }
  var fmt = K.fmt;

  // render(): everything but the tiles (stats, tray, hint, aiming marks, the end card). The tiles are the layer's.
  function render() {
    Array.prototype.forEach.call($("diff").children, function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-diff") === N.tierOf(state))); });
    $("score").textContent = fmt(state.score);
    var bs = Math.max(bests[N.tierOf(state)].score, state.score), bestEl = $("best");
    bestEl.textContent = bs ? fmt(bs) : "none"; bestEl.classList.toggle("none", !bs); // R11: an empty stat says none
    renderTray();
    var aim = targeting && kbd ? cur : -1;
    Array.prototype.forEach.call(tilesEl.querySelectorAll(".tile.sel,.tile.cur"), function (n) { n.classList.remove("sel", "cur"); });
    Array.prototype.forEach.call(cellsEl.children, function (c, i) {
      var sel = !!(targeting && targeting.picks.indexOf(i) >= 0), node = state.grid[i] ? layer.get(ids[i]) : null;
      c.classList.toggle("sel", sel); c.classList.toggle("cur", i === aim);
      if (node) { node.classList.toggle("sel", sel); node.classList.toggle("cur", i === aim); }
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
      if (!over.hidden && !was) {
        var TR = window.NumbericsTrophies; if (TR && TR.pills) TR.pills($("over-pills"), endIds);
        try { $("again").focus({ preventScroll: true }); } catch (e) { /* focus is a nicety */ }
      }
    }
    if (cardUp !== !over.hidden) { cardUp = !over.hidden; duck(cardUp); } // the music steps back under the card
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
  // how each tier earns, one sentence each (the tray, the How to play row and its third step say the same)
  var EARNS = {
    hard: "Each new highest tile from 32 up earns a random power-up.",
    medium: "Each join that makes a tile as big as your biggest, from 32 up, earns a random power-up.",
    easy: "Each join that makes a tile at least half your biggest, from 32 up, earns a random power-up."
  };
  function earn() { return EARNS[N.tierOf(state)]; }
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
    var key = JSON.stringify([state.power, targeting && targeting.name, N.POWERS.map(trayWhy), N.tierOf(state)]);
    if (key !== trayKey) { trayKey = key; drawTray(); }
    $("hint").textContent = targeting ? targetHint() : state.over ? (viewing ? "Tap the board for the summary." : note)
      : tierArm ? "Tap " + TIER_NAME[tierArm] + " again: this ends the run."
      : note || (!N.canMove(state) ? "Stuck. Use a power-up to keep going." : opening ? OPEN_HINT : "");
  }
  function drawTray() {
    P.tray($("tray"), DEFS, state.power, {
      armed: targeting && targeting.name,
      earn: earn(),
      disabled: trayWhy,
      onUse: activate,
      onInfo: function (id, text) { flush(); targeting = null; note = text; if (!state.power[id]) A("bad"); render(); }
    });
  }

  function toast(msg, kind) { K.toast(msg, kind); }

  // ---- input during motion: end the running animation now (end state at once), then apply the new input ----
  function flush() { snd.finish(layer.busy()); layer.finish(); clearRing(); }

  // the run just ended on this action: report it and keep the trophies for the card's pills
  function ended(ids0) {
    endIds = (ids0 || []).concat(trophy("end", { score: state.score, top: state.top, tier: N.tierOf(state), run: run }));
    snd.sound(M.ms("slide") + M.ms("pop"), function () { A("lose"); buzz("lose"); });
  }

  function doMove(dir) {
    flush();
    if (targeting) return;
    var top0 = state.top, from = N.payFrom(state), r = N.move(state, dir);
    if (!r.moved) return;
    note = ""; opening = false;
    state = r.state;
    var fx = M.track(ids, r.trace, r.spawned, nextId); ids = fx.ids; nextId = fx.next;
    layer.sync(tilesOf(), { merges: fx.merges, spawns: fx.spawns });
    // only reward-sized tiles are news (round 2: "New tile 4, 8, 16" was noise before the rewards begin)
    var top = r.milestones.length ? r.milestones[r.milestones.length - 1] : 0;
    // Easy and Medium (O-12) also pay joins below a new top tile: the biggest join that reached the tier's bar
    var made = top >= N.AWARD_FROM_LEVEL ? 0 : Math.max.apply(null, [0].concat(r.merges.filter(function (l) { return l >= from; })));
    var news = top >= N.AWARD_FROM_LEVEL ? "New tile " + N.label(top) : made ? "Made " + N.label(made) : "";
    var plusText = r.awarded.map(function (a) { return "+1 " + PW[a.power]; }).join(" "); // TRIAGE5 S6: "+1 Name"
    // R7: when the move ends the run, the end card is the only message
    if (news && !state.over) {
      if (r.awarded.length) toast(news + " " + plusText);
      else if (r.free) toast(news + ". No reward right after a power-up.", "info");
      else if (r.marked) toast(news + ". Swapped and boosted tiles earn no reward.", "info"); // R2 by tile
      else if (r.full) toast(news + ". Power-ups full.", "info"); // R15
      else if (!made) toast(news);
    }
    renderTray(); // the tray and hint follow the move at once, so a quick tap meets the final buttons
    persist();
    render();
    // beats (5.3): the slide sound now, the join at the end of the slide, the ring and chime on a new highest tile
    if (r.gained) plus(r.gained);
    A("slide");
    var slide = M.ms("slide"), hi = r.merges.length ? Math.max.apply(null, r.merges) : 0;
    if (hi) snd.sound(slide, function () { A("merge", hi); buzz("merge"); });
    if (top >= N.AWARD_FROM_LEVEL && state.top > top0) {
      var m = fx.merges.filter(function (x) { return state.grid[x.to] === top; })[0];
      ring(m ? layer.get(m.id) : null);
      snd.sound(slide + M.ms("pop"), function () { A("best"); buzz("big"); });
      if (r.awarded.length) snd.sound(slide + M.ms("pop") + 240, function () { A("power"); });
    } else if (made && r.awarded.length) { // a paying join below a new top tile (Easy, Medium): ring it, the power chime
      var mm = fx.merges.filter(function (x) { return state.grid[x.to] === made; })[0];
      ring(mm ? layer.get(mm.id) : null);
      snd.sound(slide + M.ms("pop"), function () { A("power"); });
    }
    if (!bestRung && bestBefore > 0 && state.score > bestBefore) {
      bestRung = true; bestMoment();
      if (!(top >= N.AWARD_FROM_LEVEL)) snd.sound(slide, function () { A("best"); });
    }
    var got = trophy("move", { top: state.top, score: state.score, merges: r.merges.length, grid: state.grid.slice(),
      moves: state.moves, stuck: !N.canMove(state), tier: N.tierOf(state), run: run });
    if (state.over) ended(got);
  }

  // ---- power-ups ----
  function used(name, stuck) {
    run.used++; if (stuck) run.stuckUse = state.moves;
    trophy("power", { name: name, stuck: stuck, run: run });
  }
  function activate(name) {
    flush(); note = "";
    if (targeting && targeting.name === name) { targeting = null; return render(); }
    targeting = null;
    if (name === "undo") {
      var stuck0 = !N.canMove(state), u = N.use(state, "undo");
      if (u.ok) {
        state = u.state; used("undo", stuck0); persist();
        rekey({ fade: true }); // Undo cross-fades (opacity, 120 ms)
        toast("Rewound one move");
      }
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
    var name = targeting.name, top0 = state.top, a = targeting.picks[0], b = targeting.picks[1];
    var stuck0 = !N.canMove(state), res = N.use(state, name, a, b);
    if (res.ok) {
      state = res.state; targeting = null; used(name, stuck0); persist();
      // Smash fades the tile out; Swap slides both tiles to each other's cells; Boost pops the tile
      var fx = {};
      if (name === "smash") { fx.out = [ids[a]]; ids = ids.slice(); ids[a] = 0; }
      else if (name === "swap") { ids = ids.slice(); var t = ids[a]; ids[a] = ids[b]; ids[b] = t; }
      else if (name === "boost") fx.pop = [ids[a]];
      layer.sync(tilesOf(), fx);
      if (!state.over) toast(name === "boost" && state.top > top0 ? "Boosted to " + N.label(state.top) + ". Boosted tiles earn no reward." : PW[name] + "!");
      else ended([]);
    } else {
      targeting.picks = [];
      A("bad");
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
  function sheetOpen() { try { return !!(window.NumbericsUI && window.NumbericsUI.open && window.NumbericsUI.open()); } catch (e) { return false; } }
  var KEYS = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down", a: "left", d: "right", w: "up", s: "down" };
  window.addEventListener("keydown", function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (sheetOpen()) return; // a sheet (Games, Trophies, Settings, How to play) owns the keys while it is open
    var tag = e.target && e.target.tagName;
    // R17: a key typed into a field belongs to the field; Enter or Space on a focused button or link
    // activates that control (a link navigates), never a game action
    if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
    if ((e.key === "Enter" || e.key === " ") && (tag === "BUTTON" || tag === "A")) return;
    if (tag === "SUMMARY" && (e.key === "Enter" || e.key === " ")) return;
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
  function startNew(t) {
    flush(); targeting = null; note = ""; disarmTiers();
    if (t) tier = t;
    best = bests[tier];
    bestBefore = best.score; bestRung = false; run = freshRun(); endIds = [];
    state = N.newGame(freshSeed(), 4, tier); persist(); rekey(); render();
  }
  // ---- difficulty (the family's #diff row, as Five and Four): a different tier starts a new game in it; while a run
  // is going the button first says "Sure?" for 3 s and the hint line says why (R10). The choice is saved. ----
  var tierArm = null, tierT = null;
  function disarmTiers() {
    clearTimeout(tierT); tierT = null; tierArm = null;
    Array.prototype.forEach.call($("diff").children, function (x) { x.textContent = TIER_NAME[x.getAttribute("data-diff")]; });
  }
  Array.prototype.forEach.call($("diff").children, function (b) {
    var t = b.getAttribute("data-diff");
    b.addEventListener("click", function () {
      A("tick");
      if (t === N.tierOf(state)) return;
      if (state.moves > 0 && !state.over && tierArm !== t) {
        disarmTiers(); K.clearToast(); tierArm = t; b.textContent = "Sure?"; render();
        tierT = setTimeout(function () { disarmTiers(); render(); }, 3000); return;
      }
      startNew(t); toast(TIER_NAME[t] + ": new game");
    });
  });
  $("new").addEventListener("click", function () {
    var b = $("new");
    if (state.moves > 0 && !state.over && !newArmed) {
      b.textContent = "Sure? This ends the run"; newArmed = setTimeout(function () { newArmed = null; b.textContent = "New game"; }, 3000); return;
    }
    clearTimeout(newArmed); newArmed = null; b.textContent = "New game"; startNew();
  });
  $("again").addEventListener("click", function () { startNew(); });
  $("over-view").addEventListener("click", function () { view(true); });

  // ---- how to play (REDESIGN.md 1.3, 9.1; TRIAGE4 D8): three steps in the family's one sheet (shared/howto.js) ----
  var STEPS = [
    { picture: '<div class="mg" style="grid-template-columns:repeat(2,26px)"><span class="mt lo">2</span><span class="mt lo">2</span></div>',
      text: "Swipe, or press an arrow key. Every tile slides as far as it can." },
    { picture: '<div class="eq"><span class="mt lo">2</span><span class="op">+</span><span class="mt lo">2</span><span class="op">=</span><span class="mt lo2">4</span></div>',
      text: "Two tiles with the same number join into one." },
    { picture: '<span class="mt" style="--h:245;width:40px;height:40px;font-size:15px">32</span>',
      text: "" } // set from the tier when the sheet opens (stepThree)
  ];
  var STEP3 = {
    hard: "Make a new biggest tile from 32 up to earn a power-up. There is no top tile.",
    medium: "Make a tile as big as your biggest, from 32 up, to earn a power-up. There is no top tile.",
    easy: "Make a tile at least half your biggest, from 32 up, to earn a power-up. There is no top tile."
  };
  function stepThree() { STEPS[2].text = STEP3[N.tierOf(state)]; }
  stepThree();
  var how = null;
  function howto() { stepThree(); if (how) how.open(); }
  // it opens by itself once (NumbericsProgress), never for a player who has a Two save (numberics_endless_v1)
  document.addEventListener("DOMContentLoaded", function () {
    var UI = window.NumbericsUI;
    if (UI && UI.howto) how = UI.howto("two", { title: "Two", steps: STEPS, saved: !!saved || state.moves > 0, onOpen: stepThree });
  });

  rekey(); render();
  // Screenshot hook (tools/shots.cjs): a fixed, representative mid-game. Not reachable from the UI.
  window.__demo = function () {
    flush(); targeting = null; note = "";
    try { if (sheetOpen()) window.NumbericsUI.close(); } catch (e) { /* no sheet */ }
    var s = N.newGame(2026, 4, "medium"), dirs = ["left", "down", "right", "down"]; // the default tier
    for (var k = 0; k < 120 && !s.over; k++) s = N.move(s, dirs[k % 4]).state;
    s.power = { undo: 1, smash: 2, swap: 1, boost: 1 };
    state = s; rekey(); render();
  };
  window.__numberics = { get state() { return state; }, set state(s) { flush(); state = s; rekey(); render(); }, render: render,
    get targeting() { return targeting; }, get cursor() { return cur; }, get bestBefore() { return bestBefore; },
    get viewing() { return viewing; }, get holding() { return holding; }, get run() { return run; },
    get ids() { return ids.slice(); }, get layer() { return layer; }, howto: howto, showCard: function () { view(false); },
    get tier() { return tier; }, get best() { return best; } };
})();
