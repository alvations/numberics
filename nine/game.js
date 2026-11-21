/* SPDX-License-Identifier: Apache-2.0 | Copyright 2026 alvations (Melon Lab)
 * Numberics Nine: browser client. The engine (engine.js) owns every rule; this file only draws, listens
 * and remembers. */
(function () {
  "use strict";
  var N = window.NumbericsNine, K = window.NumbericsKit, P = window.NumbericsPower;
  var M = window.NumbericsMotion, A = window.NumbericsAudio, TR = window.NumbericsTrophies, PR = window.NumbericsProgress;
  var store = K.store("numberics_nine_v1");
  var CPU_MS = 650;               // the computer's think time: a pause, not motion, so reduced motion keeps it
  var HOLD_MS = 1500;             // R13: the last take stays on an undimmed board this long before the end card
  var DEFS = [
    { id: "undo", label: "Undo", desc: "Take back your last turn." },
    { id: "add", label: "Add", desc: "Add 1 to a tile (up to 9), then take." },
    { id: "pass", label: "Pass", desc: "Skip your turn (once per round)." },
    { id: "peek", label: "Peek", desc: "Show one winning move, if there is one." },
  ];
  var EARN = "Win a round without Add, Pass or Peek to earn one.";
  var NAME = { undo: "Undo", add: "Add", pass: "Pass", peek: "Peek" };

  // ---- load and validate ----
  function validState(s) {
    var okPow = function (p) { return p && N.POWERS.every(function (k) { return Number.isInteger(p[k]) && p[k] >= 0 && p[k] <= P.CAP; }); };
    return s && s.v === 1 && Array.isArray(s.heaps) && s.heaps.length >= N.MIN_TILES && s.heaps.length <= N.MAX_TILES &&
      s.heaps.every(function (v) { return Number.isInteger(v) && v >= 0 && v <= N.MAX; }) && s.heaps.length === s.level &&
      N.DIFFS.indexOf(s.diff) >= 0 && (s.turn === "you" || s.turn === "cpu") && s.score &&
      Number.isInteger(s.score.you) && Number.isInteger(s.score.cpu) && s.power && okPow(s.power.you) && okPow(s.power.cpu) &&
      typeof s.seed === "number" && Number.isInteger(s.ply);
  }
  var saved = store.load() || {};
  var prefs = saved.prefs && typeof saved.prefs === "object" ? saved.prefs : {};
  prefs = { diff: N.DIFFS.indexOf(prefs.diff) >= 0 ? prefs.diff : "easy", misere: !!prefs.misere && !!prefs.unlocked,
            learn: !!prefs.learn, unlocked: !!prefs.unlocked };
  var best = saved.best && typeof saved.best === "object" ? saved.best : {};
  // Record (R16): matches won-lost across runs. Quitting a started match counts as a loss (R12).
  var record = saved.record && Number.isInteger(saved.record.won) && Number.isInteger(saved.record.lost) ? saved.record : { won: 0, lost: 0 };
  var firstVisit = !validState(saved.state);
  var state = validState(saved.state) ? saved.state : N.newGame(K.freshSeed(), prefs);
  // run record (8.2), for trophies only: zeroRun = your takes in a row leaving nim-sum 0; takes, big = this round.
  // runPrev = the record at the start of your turn (Undo restores it).
  function freshRun() { return { used: 0, zeroRun: 0, takes: 0, big: false }; }
  function okRun(r) { return r && ["used", "zeroRun", "takes"].every(function (k) { return Number.isInteger(r[k]); }) && typeof r.big === "boolean" ? r : null; }
  var run = okRun(saved.run) || freshRun(), runPrev = okRun(saved.runPrev);
  var pillIds = []; // trophies earned by the move that ended the round, shown as pills on the end card

  var sel = null, amount = 1, peekMark = null, targeting = null, timer = null, cpuMark = null, note = "", info = "", newBest = false;
  var hold = false, holdT = null, viewing = false; // R13: the finished board first, then the card; "See the board"
  var holdAt = 0;      // when the hold began: the tap that ended the round never also skips it
  var cardWas = false; // the card just appeared: focus its primary button (round 3, one end-card pattern)
  var $ = function (id) { return document.getElementById(id); };
  var boardEl = $("board"), heapsEl = $("heaps");

  function bestKey(s) { return s.diff + (s.misere ? "-misere" : ""); }
  function persist() {
    store.save({ state: state, prefs: prefs, best: best, record: record, run: run, runPrev: runPrev });
    try {
      PR.put("nine", { best: record.won + record.lost ? "Won " + record.won + ", lost " + record.lost : "", live: N.started(state),
                       liveText: "Match " + state.score.you + "-" + state.score.cpu + " · " + state.level + " tiles" });
    } catch (e) { /* progress is a nicety */ }
  }
  function report(ev, data) { try { return TR.report("nine", ev, data) || []; } catch (e) { return []; } }
  function copyRun() { return JSON.parse(JSON.stringify(run)); }
  function live() { return !state.roundOver && !state.matchOver; }
  function myTurn() { return live() && state.turn === "you"; }

  // ---- drawing ----
  function rowsFor(n) { // balanced rows of at most three: 4 -> 2+2, 5 -> 3+2, 7 -> 3+2+2
    var rows = Math.ceil(n / 3), base = Math.floor(n / rows), extra = n % rows, out = [];
    for (var r = 0; r < rows; r++) out.push(base + (r < extra ? 1 : 0));
    return out;
  }
  function bin(v) { return ("000" + v.toString(2)).slice(-4); }
  // tiles keep their elements (5.13): live = button, empty = div; rows rebuild only when the tile count changes
  var shape = "", nodes = [];
  function blankNode(v) {
    if (!v) return document.createElement("div");
    var b = document.createElement("button"); b.type = "button";
    var num = document.createElement("b"); num.className = "num"; b.appendChild(num);
    var pips = document.createElement("span"); pips.className = "pips";
    for (var k = 0; k < 9; k++) { var p = document.createElement("i"); p.setAttribute("data-k", k); pips.appendChild(p); }
    b.appendChild(pips);
    return b;
  }
  function drawHeaps() {
    var n = state.heaps.length, rows = rowsFor(n), sh = rows.join(","), i;
    if (sh !== shape) {
      shape = sh; nodes = []; heapsEl.textContent = ""; i = 0;
      rows.forEach(function (count) {
        var row = document.createElement("div"); row.className = "hrow";
        for (var c = 0; c < count; c++, i++) { nodes[i] = blankNode(state.heaps[i]); row.appendChild(nodes[i]); }
        heapsEl.appendChild(row);
      });
    }
    for (i = 0; i < n; i++) {
      var v = state.heaps[i], node = nodes[i];
      if (node.tagName !== (v ? "BUTTON" : "DIV")) { var nn = blankNode(v); node.parentNode.replaceChild(nn, node); nodes[i] = node = nn; }
      if (v) paintTile(node, i, v, prefs.learn); else paintGone(node, i);
    }
  }
  function paintGone(g, i) {
    // R13: once a round is decided, the tile taken last shows as a ghost of what was taken
    var l = state.last, ghost = !live() && l && l.kind === "take" && l.tile === i;
    g.className = "heap gone" + (ghost ? " ghost " + (l.who === "you" ? "by-you" : "by-cpu") : "");
    g.setAttribute("aria-hidden", "true");
    var key = ghost ? l.who + l.from : "";
    if (g.getAttribute("data-g") === key) return;
    g.setAttribute("data-g", key);
    Array.prototype.slice.call(g.children).forEach(function (c) { if (!c.classList.contains("fx")) g.removeChild(c); });
    if (!ghost) return;
    var gn = document.createElement("b"); gn.className = "num"; gn.textContent = l.from; g.appendChild(gn);
    var gp = document.createElement("span"); gp.className = "pips";
    for (var q = 0; q < 9; q++) { var gi = document.createElement("i"); if (q < l.from) gi.className = "take"; gp.appendChild(gi); }
    g.appendChild(gp);
  }
  function paintTile(b, i, v, learn) {
    b.className = "heap tile" + (v === 1 ? " lo" : v === 2 ? " lo2" : "") +
      (sel === i ? " sel" : "") + (peekMark === i ? " peek" : "") + (cpuMark === i ? " cpu" : "");
    b.style.setProperty("--h", K.hue(v)); b.setAttribute("data-i", i);
    b.querySelector(".num").textContent = v;
    var pips = b.querySelector(".pips").children;
    for (var k = 0; k < 9; k++) {
      var c = k < v ? (sel === i && k >= v - amount ? "take" : "on") : "";
      if (pips[k].className !== c) pips[k].className = c;
    }
    var bn = b.querySelector(".bin");
    if (learn) { if (!bn) { bn = document.createElement("span"); bn.className = "bin"; b.appendChild(bn); } bn.textContent = bin(v); }
    else if (bn) b.removeChild(bn);
    b.setAttribute("aria-label", "tile " + v + (sel === i ? ", taking " + amount : ""));
  }

  // ---- motion (REDESIGN.md 5.7, 5.11, 5.12) ----
  // the state is final before motion starts; every input calls fxFinish() first (ends it, drops pending sounds)
  var tl = M ? M.seq() : null, anims = [], fxNodes = [], quiet = false;
  function sfx(name, arg) { if (!quiet) try { A[name](arg); } catch (e) { /* sound is a nicety */ } }
  function buzz(kind) { sfx("buzz", kind); }
  function at(ms, fn) { if (tl && ms > 0) tl.at(ms, fn); else fn(); }
  function anim(el, frames, opts, red) { var a = M.play(el, frames, opts, red); if (a) anims.push(a); }
  function drop(n) { if (n && n.parentNode) n.parentNode.removeChild(n); }
  function fxFinish() {
    quiet = true;
    try { if (tl) tl.finish(); } finally { quiet = false; }
    anims.forEach(function (a) { try { a.cancel(); } catch (e) { /* done */ } }); anims = [];
    fxNodes.forEach(drop); fxNodes = [];
    nodes.forEach(function (n, i) { var nm = state.heaps[i] && n.querySelector(".num"); if (nm) nm.textContent = state.heaps[i]; });
  }
  function ring(host) {
    var r = document.createElement("span"); r.className = "ring"; r.setAttribute("aria-hidden", "true");
    host.appendChild(r); fxNodes.push(r);
    anim(r, [{ opacity: 0, transform: "scale(.94)" }, { opacity: 1, offset: 0.3 }, { opacity: 0, transform: "scale(1.06)" }],
      { duration: 420, easing: M.E.out, fill: "both" }, [{ opacity: 0 }, { opacity: 1, offset: 0.3 }, { opacity: 0 }]);
    at(420, function () { drop(r); });
  }
  // the added pip appears (Add, yours or the computer's)
  function animateAdd(i, from) {
    var p = M && nodes[i] && nodes[i].querySelector('.pips i[data-k="' + from + '"]');
    if (p) anim(p, [{ opacity: 0, transform: "scale(.4)" }, { opacity: 0.78, transform: "scale(1)" }], { duration: M.T.appear, easing: M.E.pop, fill: "backwards" }, [{ opacity: 0 }, { opacity: 0.78 }]);
  }
  // old: the tile's element before the take (replaced by render when the tile went to zero)
  function animateTake(l, old) {
    if (!l || l.kind !== "take" || !M) return endBeat(0);
    var red = M.reduced(), n = l.from - l.to, i = l.tile, host = nodes[i], el = host, zero = l.to === 0;
    if (!host) return endBeat(0);
    if (zero) {
      if (!old || old.tagName !== "BUTTON") return endBeat(0);
      el = old; // the old tile stays on top of the empty slot until it has faded to it
      el.className = "heap tile fx" + (l.from === 1 ? " lo" : l.from === 2 ? " lo2" : "");
      el.removeAttribute("data-i"); el.setAttribute("aria-hidden", "true"); el.tabIndex = -1;
      el.style.setProperty("--h", K.hue(l.from));
      Array.prototype.forEach.call(el.querySelectorAll(".ring"), drop);
      Array.prototype.forEach.call(el.querySelectorAll(".pips i"), function (p, k) { p.className = k < l.from ? "on" : ""; });
      host.appendChild(el); fxNodes.push(el);
    }
    var num = el.querySelector(".num"), pips = el.querySelectorAll(".pips i"), stag = red ? 0 : M.T.pipStagger, out = M.T.pipOut;
    num.textContent = red && !zero ? l.to : l.from;
    for (var j = 0; j < n; j++) {
      var p = pips[l.from - 1 - j];
      if (p) anim(p, [{ opacity: 0.78, transform: "none" }, { opacity: 0, transform: "translateY(30%) scale(.6)" }],
        { duration: out, delay: j * stag, easing: M.E.out, fill: zero ? "both" : "backwards" }, [{ opacity: 0.78 }, { opacity: 0 }]);
      (function (left) { at(j * stag, function () { if (!red && !(zero && left === 0)) num.textContent = left; sfx("pip"); }); })(l.from - 1 - j);
    }
    var end = red ? Math.min(out, M.T.fade) : (n - 1) * stag + out;
    if (zero) {
      at(red ? 0 : end, function () {
        anim(el, [{ transform: "scale(1)", opacity: 1 }, { transform: "scale(.85)", opacity: 0.35, offset: 0.79 }, { transform: "scale(.85)", opacity: 0 }],
          { duration: 280, easing: M.E.out, fill: "both" }, [{ opacity: 1 }, { opacity: 0 }]);
      });
      end = red ? M.T.fade : end + 280;
      at(end, function () { drop(el); });
    }
    if (l.who === "cpu") ring(zero ? el : host);
    endBeat(end);
  }
  // the round's result sound comes once the last pip has gone
  function endBeat(ms) {
    if (live()) return;
    var w = state.roundOver === "you" ? "win" : "lose", paid = state.award && state.award.who === "you";
    at(ms, function () { sfx(w); buzz(w); if (paid) at(320, function () { sfx("power"); }); });
  }

  // The computer's power-ups are announced here, in the hint line (R14): "Computer used Pass."
  function moveText(last, who) {
    if (!last) return "";
    who = last.who || who;
    var cpu = who === "cpu", w = cpu ? "Computer" : "You";
    if (last.kind === "pass") return cpu ? "Computer used Pass." : "You passed.";
    var s = "took " + (last.from - last.to) + " from the " + last.from + (last.to ? "." : ", gone.");
    if (!last.added) return w + " " + s;
    var a = last.addAt ? " (" + last.addAt.from + " to " + (last.addAt.from + 1) + ")" : "";
    return cpu ? "Computer used Add" + a + ", then " + s : "You added 1, then " + s;
  }
  function hintText() {
    if (info) return info;  // a tap on a tray button that cannot act explains it (R5)
    if (targeting) return "Tap a tile to add 1" + (kb ? " (Esc cancels)." : ".");
    if (!live()) return hold || viewing ? moveText(state.last) + (viewing ? " Tap the board for the summary." : "") : "";
    if (state.turn === "cpu") return "Computer is thinking...";
    if (note) return note;
    if (state.last && state.last.who === "cpu") return moveText(state.last, "cpu") + " Your turn.";
    return state.misere ? "Your turn. Mis\u00e8re: the last take loses." : "Your turn: take from one tile.";
  }
  // Why a tray button cannot act now (shown on tap); false when it can, or when it is just empty (then the
  // tray says how to earn one).
  function why(id) {
    if (!state.power.you[id]) return false;
    if (!live()) return "Not after a round ends.";
    if (id === "undo") return N.canUndo(state) ? false : "Nothing to take back yet this round.";
    if (state.turn !== "you") return "Wait for your turn.";
    if (id === "pass" && state.passed && state.passed.you) return "Once per round.";
    if (id === "pass" && !N.canPass(state)) return "Not right after the computer passes.";
    if (id === "add" && state.added) return "Once per turn.";
    return false;
  }
  function render() {
    drawHeaps();
    $("you").textContent = state.score.you; $("cpu").textContent = state.score.cpu;
    var rc = $("rec"), any = record.won + record.lost > 0;
    rc.textContent = any ? record.won + "-" + record.lost : "none"; rc.classList.toggle("none", !any);
    var bv = best[bestKey(state)], be = $("best");
    be.textContent = bv || "none"; be.classList.toggle("none", !bv);
    Array.prototype.forEach.call(document.querySelectorAll("#diff button"), function (b) {
      b.setAttribute("aria-pressed", String(b.getAttribute("data-diff") === state.diff));
    });
    P.tray($("tray"), DEFS, state.power.you, {
      armed: targeting, earn: EARN, disabled: why, onUse: activate,
      onInfo: function (id, t) { info = t; $("hint").textContent = info; },
    });
    $("hint").textContent = hintText();
    boardEl.classList.toggle("targeting", !!targeting);
    // take bar
    var can = myTurn() && sel !== null && state.heaps[sel] > 0;
    $("less").disabled = !can || amount <= 1; $("more").disabled = !can || amount >= state.heaps[sel];
    $("take").disabled = !can;
    var am = $("amount"); am.textContent = "";
    if (can) {
      am.appendChild(document.createTextNode("Take ")); var bb = document.createElement("b"); bb.textContent = amount; am.appendChild(bb);
      am.appendChild(document.createTextNode(" from the " + state.heaps[sel]));
    } else am.textContent = myTurn() ? "Pick a tile" : "Wait";
    // learn line
    // Learn: the goal in plain words, then the live nim-sum, which Easy and Medium show and Hard does not
    var ln = $("learn"); ln.hidden = !prefs.learn; ln.textContent = "";
    if (prefs.learn) {
      // round 3 (cold #30): one plain sentence first, before any binary
      var plain = document.createElement("span"); plain.className = "plain";
      plain.textContent = "Aim to leave the tiles balanced (two equal tiles are balanced): the Learn numbers show how.";
      ln.appendChild(plain);
      var goal = document.createElement("span"); goal.className = "goal";
      goal.textContent = "To win, leave a nim-sum of 0 after your move" + (state.misere ? " (Mis\u00e8re: once every tile is 1 or gone, leave an odd number of 1s)" : "") +
        ". Nim-sum: add the binary columns, dropping every carry.";
      ln.appendChild(goal);
      var sum = document.createElement("span"); sum.className = "sum";
      if (state.diff === "hard") {
        sum.className += " off"; sum.textContent = "Hard shows no live nim-sum (Easy and Medium do). Work it out from the binary.";
      } else {
        var x = N.nimSum(state.heaps);
        sum.appendChild(document.createTextNode("Nim-sum " + (state.heaps.filter(Boolean).map(bin).join(" ^ ") || bin(0)) + " = "));
        var xb = document.createElement("b"); xb.textContent = bin(x) + " (" + x + ")"; sum.appendChild(xb);
      }
      ln.appendChild(sum);
    }
    $("learn-btn").setAttribute("aria-pressed", String(prefs.learn));
    var mb = $("misere"); mb.hidden = !prefs.unlocked;
    mb.setAttribute("aria-pressed", String(state.misere));
    drawOver();
  }
  // End screens (R8, round 3 one end-card pattern): headline "You win" / "The computer wins" (+ " round N"), one
  // subline "<detail> · <tally>", a note, See the board and a gold primary. While the card shows, the page's New game
  // is hidden with its space kept, and focus moves to the card's primary button.
  // A decided round or match is final: Undo never crosses it (R1), so no screen offers it.
  function drawOver() {
    var over = $("over"), up = !live() && !hold && !viewing; over.hidden = !up;
    $("new").style.visibility = up ? "hidden" : "";
    var was = cardWas; cardWas = up;
    if (up !== was) { try { if (window.NumbericsMusic) window.NumbericsMusic.duck(up); } catch (e) { /* no music */ } }
    var pl = $("over-pills");
    if (pl) { if (TR && TR.pills) TR.pills(pl, up ? pillIds : []); else pl.hidden = true; }
    if (up && !was && state.matchOver === "you" && newBest) sfx("best");
    if (up && !was) setTimeout(function () { if (cardWas) { try { $("again").focus({ preventScroll: true }); } catch (e) { /* a nicety */ } } }, 0);
    if (live()) return;
    var sc = state.score.you + "-" + state.score.cpu;
    // the reward line: what paid, or why nothing did (R2: Add or Pass used; R15: every slot full)
    var aw = state.award && state.award.who === "you" ? "+" + NAME[state.award.name] :
      state.roundOver === "you" && state.noAward === "power" ? "No power-up: you used Add, Pass or Peek this round." :
      state.roundOver === "you" && state.noAward === "full" ? "Power-ups full." : "";
    var bv = best[bestKey(state)];
    $("over-best").hidden = !(state.matchOver === "you" && newBest);
    if (state.matchOver === "you") {
      $("over-title").textContent = "You win";
      $("over-text").textContent = "Match won " + sc + " · " + state.level + " tiles";
      $("over-note").textContent = (aw ? aw + (/\.$/.test(aw) ? " " : ". ") : "") + (state.level < N.MAX_TILES ? "Next match: " + (state.level + 1) + " tiles." : "Nine tiles again: the top level.");
      $("again").textContent = "Next match";
    } else if (state.matchOver === "cpu") {
      $("over-title").textContent = "The computer wins";
      $("over-text").textContent = "Match lost " + sc + " · " + state.level + " tiles";
      // cold #32: say what a run is when it ends
      $("over-note").textContent = "Run over: the next run starts again at " + N.MIN_TILES + " tiles. Best: " + (bv ? bv + " tiles" : "none") + ".";
      $("again").textContent = "New game";
    } else {
      $("over-title").textContent = (state.roundOver === "you" ? "You win" : "The computer wins") + " round " + state.round;
      var lastBy = state.last && state.last.who === "you" ? "You" : "The computer";
      $("over-text").textContent = lastBy + " took the last tile · " + sc + ", first to " + N.WIN_ROUNDS;
      $("over-note").textContent = state.roundOver === "you" ? aw : "";
      $("again").textContent = "Next round";
    }
  }

  // ---- turns ----
  function clearPick() { sel = null; amount = 1; peekMark = null; }
  function after(prevState) {
    // bookkeeping after any state change: rounds won, best level, unlocks, the computer's turn
    info = "";
    if (!state.matchOver) newBest = false;
    if (state.matchOver && !prevState.matchOver) { if (state.matchOver === "you") record.won++; else record.lost++; }
    clearTimeout(holdT); holdT = null; viewing = false; hold = false;
    if (!live() && !prevState.roundOver && !prevState.matchOver) { // R13: a round just ended: show the board first
      roundEnded(); hold = true; holdAt = Date.now(); var gen = state.ply;
      holdT = setTimeout(function () { holdT = null; if (state.ply === gen) { hold = false; render(); } }, HOLD_MS);
    }
    if (state.matchOver === "you" && prevState.matchOver !== "you") {
      var k = bestKey(state); newBest = state.level > (best[k] || 0); best[k] = Math.max(best[k] || 0, state.level);
      if (!prefs.unlocked) { prefs.unlocked = true; K.toast("Mis\u00e8re unlocked: the last take loses."); }
    }
    persist(); render(); schedule();
  }
  // round and match trophy events (8.4); their ids become the card's pills
  function roundEnded() {
    var won = state.roundOver === "you";
    pillIds = pillIds.concat(report("round", { won: won, onlyOnes: won && run.takes > 0 && !run.big }));
    if (state.matchOver) pillIds = pillIds.concat(report("match", { won: state.matchOver === "you", diff: state.diff, misere: !!state.misere, tiles: state.level }));
    run.takes = 0; run.big = false; runPrev = null; // the next round starts its own count; Undo never crosses a result (R1)
  }
  function schedule() {
    clearTimeout(timer); timer = null;
    if (!live() || state.turn !== "cpu") return;
    var gen = state.ply;
    timer = setTimeout(function () {
      timer = null;
      if (state.ply !== gen || state.turn !== "cpu" || !live()) return; // something changed meanwhile
      fxFinish();
      var before = state, beforeHeaps = state.heaps.slice(), old = nodes.slice();
      state = N.cpuTurn(state);
      cpuMark = null; note = ""; pillIds = [];
      for (var i = 0; i < beforeHeaps.length; i++) if (beforeHeaps[i] !== state.heaps[i]) cpuMark = i;
      // the computer's Pass or Add is announced in the hint line (moveText), one channel (R7, R14)
      after(before);
      var l = state.last;
      if (l && l.addAt && l.addAt.tile !== l.tile) animateAdd(l.addAt.tile, l.addAt.from);
      if (l && l.kind === "take" && l.who === "cpu") animateTake(l, old[l.tile]);
    }, CPU_MS);
  }
  function doTake() {
    if (!myTurn() || sel === null) return;
    var before = state, took = amount, r = N.take(state, sel, amount);
    if (!r.ok) return;
    var old = nodes.slice();
    if (!before.acted) runPrev = copyRun();
    state = r.state; clearPick(); cpuMark = null; note = ""; targeting = null; pillIds = [];
    var zeroAfter = N.nimSum(state.heaps) === 0;
    run.zeroRun = zeroAfter ? run.zeroRun + 1 : 0; run.takes++; if (took > 1) run.big = true;
    var got = report("take", { amount: took, zeroAfter: zeroAfter, run: copyRun() });
    buzz("tap");
    after(before);
    if (!live()) pillIds = got.concat(pillIds); // a trophy earned by the winning take shows on the card too
    animateTake(state.last, old[state.last.tile]);
  }
  function select(i, amt) {
    if (!myTurn() || !state.heaps[i]) return;
    if (sel !== i) peekMark = null;
    info = ""; if (sel !== i || amt) sfx("tick");
    sel = i; amount = Math.max(1, Math.min(state.heaps[i], amt || 1));
    render();
  }
  function step(d) {
    if (sel === null) return;
    var a = Math.max(1, Math.min(state.heaps[sel], amount + d));
    if (a !== amount) sfx("tick");
    amount = a; render();
  }

  // ---- power-ups ----
  function activate(name) {
    fxFinish();
    info = "";
    if (targeting === name) { targeting = null; return render(); }
    targeting = null;
    var before = state, r;
    if (name === "undo") {
      r = N.use(state, "undo"); if (!r.ok) { sfx("bad"); return render(); }
      clearTimeout(timer); timer = null;
      if (runPrev) run = runPrev; runPrev = null; run.used++; sfx("tick");
      state = r.state; clearPick(); cpuMark = null; note = "Rewound to the start of your turn.";
      return after(before); // one channel: the hint line says it (R7)
    }
    if (!myTurn() || !state.power.you[name]) { if (state.power.you[name]) sfx("bad"); return render(); }
    if (name === "add") { if (state.added) { sfx("bad"); return render(); } sfx("tick"); targeting = "add"; return render(); }
    var fresh = !state.acted;
    if (name === "pass") {
      r = N.use(state, "pass"); if (!r.ok) { sfx("bad"); return render(); } // the tray explains why (Not right after a pass)
      if (fresh) runPrev = copyRun(); run.used++; sfx("tick");
      state = r.state; clearPick(); note = ""; K.toast("Passed"); return after(before);
    }
    if (name === "peek") {
      r = N.use(state, "peek"); if (!r.ok) { sfx("bad"); return render(); }
      run.used++; sfx("tick");
      state = r.state;
      if (r.move) {
        sel = r.move.tile; amount = state.heaps[sel] - r.move.to; peekMark = sel;
        note = "Peek: take " + amount + " from the " + state.heaps[sel] + ".";
      } else { clearPick(); note = "Peek: no winning move here. Add or Pass can change that."; }
      return after(before);
    }
  }
  function addTo(i) {
    fxFinish();
    var before = state, r = N.use(state, "add", i);
    if (!r.ok) { sfx("bad"); K.toast(state.heaps[i] >= N.MAX ? "Nine is the cap" : "Pick a live tile", "bad"); return; }
    if (!before.acted) runPrev = copyRun();
    run.used++; sfx("tick");
    state = r.state; targeting = null; clearPick(); cpuMark = i; note = "Added 1. Now take from any tile.";
    after(before);
    animateAdd(i, before.heaps[i]);
  }

  // ---- input ----
  heapsEl.addEventListener("click", function (e) {
    fxFinish();
    if (!live()) return showCard();
    var h = e.target.closest ? e.target.closest(".heap[data-i]") : null; if (!h) return;
    var i = +h.getAttribute("data-i"), v = state.heaps[i];
    if (targeting === "add") return addTo(i);
    // a pip sets the take only on the chosen tile; the first tap on a tile picks it with a take of 1 (cold #31:
    // a first tap that landed on a pip took 7 from an 8 by accident)
    var pip = e.target.closest(".pips i");
    if (pip && sel === i) { var k = +pip.getAttribute("data-k"); if (k < v) return select(i, v - k); }
    if (sel === i) return step(sel === i && amount >= v ? 1 - amount : 1); // tapping the chosen tile again takes one more (wraps)
    select(i, 1);
  });
  $("less").addEventListener("click", function () { fxFinish(); step(-1); });
  $("more").addEventListener("click", function () { fxFinish(); step(1); });
  $("take").addEventListener("click", function () { fxFinish(); doTake(); });
  $("again").addEventListener("click", function () { sfx("tick"); proceed(); });
  $("over-view").addEventListener("click", function () { sfx("tick"); viewing = true; info = ""; render(); boardEl.focus(); });
  // a tap on the board (or Enter) during the hold or while viewing brings the card back
  function showCard() {
    if (!hold && !viewing) return false;
    if (hold && Date.now() - holdAt < 300) return true; // round 3 craft #2: the Take click bubbled here and cut the hold
    clearTimeout(holdT); holdT = null; hold = false; viewing = false; render(); return true; }
  boardEl.addEventListener("click", function (e) { if (!live() && !e.target.closest(".over") && !e.target.closest(".bar")) showCard(); });
  function proceed() {
    fxFinish();
    var before = state;
    if (state.matchOver === "you") state = N.nextMatch(state);
    else if (state.matchOver === "cpu") state = N.newGame(K.freshSeed(), prefs);
    else if (state.roundOver) state = N.nextRound(state);
    else return;
    var fromCard = $("over").contains(document.activeElement);
    if (state.matchOver !== before.matchOver && before.matchOver === "cpu") { run = freshRun(); runPrev = null; } // a lost match ends the run
    clearPick(); cpuMark = null; note = ""; targeting = null; pillIds = []; after(before);
    if (fromCard) { try { boardEl.focus({ preventScroll: true }); } catch (e) { /* a nicety */ } }
  }
  var kb = false; // a keyboard player sees "(Esc cancels)"; a touch player does not
  window.addEventListener("pointerdown", function () { kb = false; }, true);
  function liveIdx() { var o = []; state.heaps.forEach(function (v, i) { if (v) o.push(i); }); return o; }
  window.addEventListener("keydown", function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var tag = (e.target && e.target.tagName) || "";
    if (window.NumbericsUI && window.NumbericsUI.open && window.NumbericsUI.open()) return; // a sheet has the keys
    kb = true;
    fxFinish();
    // R17: Enter or Space on a focused link or control is that control (a games-row link navigates)
    if ((e.key === "Enter" || e.key === " ") && /^(A|INPUT|SELECT|TEXTAREA)$/.test(tag)) return;
    if (e.key === "Escape") { targeting = null; info = ""; clearPick(); if (viewing) viewing = false; return render(); }
    var pi = ["1", "2", "3", "4"].indexOf(e.key);
    if (e.key === "u" || e.key === "U") pi = 0;
    if (pi >= 0) { var tb = $("tray").children[pi]; if (tb) tb.click(); return; } // same path as a tap (R5)
    if (e.key === "l" || e.key === "L") return toggleLearn();
    if (!live()) { if ((e.key === "Enter" || e.key === " ") && tag !== "BUTTON") { e.preventDefault(); if (!showCard()) proceed(); } return; }
    var ix = liveIdx(); if (!ix.length) return;
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      var p = ix.indexOf(sel);
      var nx = p < 0 ? (e.key === "ArrowRight" ? 0 : ix.length - 1) : (p + (e.key === "ArrowRight" ? 1 : -1) + ix.length) % ix.length;
      return select(ix[nx], 1);
    }
    if (e.key === "ArrowDown") { e.preventDefault(); if (sel === null) return select(ix[0], 1); return step(1); }
    if (e.key === "ArrowUp") { e.preventDefault(); return step(-1); }
    if (e.key === "Enter" || e.key === " ") {
      if (tag === "BUTTON" && e.target !== boardEl) return; // let a focused button click itself
      e.preventDefault();
      if (targeting === "add" && sel !== null) return addTo(sel);
      doTake();
    }
  });

  // ---- settings: difficulty, misere, learn, new game ----
  // Destructive switches ask first with the same two-step "Sure?" as New game (R10): the button itself says it.
  // R12: once the match has a move, quitting it counts as a loss, and the "Sure?" says so. The row buttons say it
  // on the button; the narrow difficulty buttons say "Sure?" and the hint line carries the rest.
  var armed = null;
  function disarm() { if (armed) { clearTimeout(armed.t); armed.btn.textContent = armed.label; armed = null; info = ""; $("hint").textContent = hintText(); } }
  function confirmNew(btn, go, short) {
    fxFinish(); sfx("tick");
    var risky = !state.matchOver && (state.ply > 0 || state.level > N.MIN_TILES || state.round > 1);
    if (risky && !(armed && armed.btn === btn)) {
      disarm(); K.clearToast(); // a toast never hides the warning
      var loss = N.started(state);
      armed = { btn: btn, label: btn.textContent, t: setTimeout(disarm, 3000) };
      btn.textContent = loss ? (short ? "Sure?" : "Sure? Counts as a loss") : short ? "Sure?" : "Sure? This ends the run";
      if (short) { info = loss ? "Switching now counts as a loss. Tap again to switch." : "Switching ends the run. Tap again to switch."; $("hint").textContent = info; }
      return;
    }
    disarm(); go();
  }
  function restart() {
    fxFinish(); run = freshRun(); runPrev = null; pillIds = [];
    clearTimeout(timer); timer = null; clearTimeout(holdT); holdT = null; hold = false; viewing = false;
    clearPick(); cpuMark = null; note = ""; targeting = null;
    if (N.started(state)) record.lost++; // R12: quitting a started match is a lost match
    var before = state; state = N.newGame(K.freshSeed(), prefs); after(before);
  }
  Array.prototype.forEach.call(document.querySelectorAll("#diff button"), function (b) {
    b.addEventListener("click", function () {
      var d = b.getAttribute("data-diff"); if (d === state.diff) return;
      confirmNew(b, function () { prefs.diff = d; restart(); }, true);
    });
  });
  $("misere").addEventListener("click", function () {
    if (!prefs.unlocked) return;
    var want = !state.misere;
    confirmNew($("misere"), function () { prefs.misere = want; restart(); });
  });
  function toggleLearn() { fxFinish(); sfx("tick"); prefs.learn = !prefs.learn; persist(); render(); }
  $("learn-btn").addEventListener("click", toggleLearn);
  $("new").addEventListener("click", function () { confirmNew($("new"), restart); });

  // ---- How to play (1.3, 9.8): opens once by itself on a first visit; the row under the board reaches it ----
  // a picture tile: n pips, the last `take` hollow; ring "y" (you) or "c" (the computer)
  function pv(n, h, take, ring) {
    var p = "";
    for (var k = 0; k < 9; k++) p += "<i" + (k >= n ? ' class="e"' : k >= n - (take || 0) ? ' class="t"' : "") + "></i>";
    return '<span class="mt nt' + (n === 1 ? " lo" : "") + (ring ? " r" + ring : "") + '" style="--h:' + h + '">' + n + '<span class="pips">' + p + "</span></span>";
  }
  var EMPTY = '<span class="mt nt e"></span>';
  var STEPS = [
    ['<div class="nrow">' + pv(7, 330, 2, "y") + pv(3, 160) + "</div>", "Tap a tile, then choose how many to take."],
    ['<div class="nrow">' + pv(5, 250, 0, "y") + pv(4, 200, 0, "c") + "</div>", "You and the computer take turns."],
    ['<div class="nrow">' + EMPTY + pv(1, 0, 1, "y") + EMPTY + "</div>", "Take the very last one to win the round."],
  ];
  function howto() {
    var U = window.NumbericsUI; if (!U || !U.sheet) return;
    fxFinish();
    try { PR.markHowto("nine"); } catch (e) { /* a nicety */ }
    U.sheet("howto", function (body) {
      body.innerHTML = '<div class="howto">' + STEPS.map(function (st) { return '<div class="step"><div class="pv" aria-hidden="true">' + st[0] + "</div><p>" + st[1] + "</p></div>"; }).join("") +
        '</div><div class="row"><button type="button" class="btn primary">Play</button></div>';
      body.querySelector(".btn").addEventListener("click", function () { U.close(); });
    }, { title: "How to play Nine" });
  }
  $("howto").addEventListener("click", function () { sfx("tick"); howto(); });
  function autoHowto() {
    var seen = true; try { seen = PR.seenHowto("nine"); } catch (e) { /* no progress module: never auto-open */ }
    if (firstVisit && !seen) howto();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", autoHowto); else setTimeout(autoHowto, 0);

  prefs.diff = state.diff; prefs.misere = state.misere && prefs.unlocked;
  render(); schedule();

  // Screenshot hook (tools/shots.cjs): a fixed, representative mid-game. Not reachable from the UI.
  window.__demo = function () {
    if (window.NumbericsUI && window.NumbericsUI.current && window.NumbericsUI.current() === "howto") window.NumbericsUI.close();
    fxFinish();
    clearTimeout(timer); timer = null; targeting = null; note = ""; info = ""; hold = false; viewing = false;
    var s = N.newGame(2026, { diff: "medium", level: 7 });
    s.heaps = [7, 0, 5, 9, 3, 6, 2]; s.round = 3; s.score = { you: 1, cpu: 1 }; s.ply = 14;
    s.power.you = { undo: 1, add: 1, pass: 0, peek: 2 };
    s.last = { who: "cpu", kind: "take", tile: 1, from: 4, to: 0, added: false }; s.lastTurn = { who: "cpu", kind: "take" };
    s.prev = JSON.parse(JSON.stringify(s)); s.prev.prev = null; s.acted = false;
    state = s; cpuMark = null; peekMark = null; sel = 3; amount = 3; render();
  };
  window.__nine = {
    get state() { return state; },
    set state(s) { fxFinish(); pillIds = []; clearTimeout(timer); timer = null; clearTimeout(holdT); holdT = null; hold = false; viewing = false; state = s; clearPick(); cpuMark = null; note = ""; info = ""; targeting = null; render(); schedule(); },
    get hold() { return hold; }, get viewing() { return viewing; }, get record() { return record; },
    get prefs() { return prefs; }, get run() { return run; }, get pills() { return pillIds.slice(); },
    finish: function () { fxFinish(); }, howto: howto,
    render: render,
  };
})();
