/* SPDX-License-Identifier: Apache-2.0 | Copyright 2026 alvations (Melon Lab)
 * Numberics Nine: browser client. The engine (engine.js) owns every rule; this file only draws, listens
 * and remembers. */
(function () {
  "use strict";
  var N = window.NumbericsNine, K = window.NumbericsKit, P = window.NumbericsPower;
  var store = K.store("numberics_nine_v1");
  var CPU_MS = 650;               // the computer's think time: a pause, not motion, so reduced motion keeps it
  var HOLD_MS = 1500;             // R13: the last take stays on an undimmed board this long before the end card
  var DEFS = [
    { id: "undo", label: "Undo", desc: "Take back your last turn." },
    { id: "add", label: "Add", desc: "Add 1 to any tile (never past 9), then take as usual." },
    { id: "pass", label: "Pass", desc: "Skip your turn (once per round)." },
    { id: "peek", label: "Peek", desc: "Show one winning move, if there is one." },
  ];
  var EARN = "Win a round without Add or Pass to earn one.";
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
  var state = validState(saved.state) ? saved.state : N.newGame(K.freshSeed(), prefs);

  var sel = null, amount = 1, peekMark = null, targeting = null, timer = null, cpuMark = null, note = "", info = "", newBest = false;
  var hold = false, holdT = null, viewing = false; // R13: the finished board first, then the card; "See the board"
  var $ = function (id) { return document.getElementById(id); };
  var boardEl = $("board"), heapsEl = $("heaps");

  function bestKey(s) { return s.diff + (s.misere ? "-misere" : ""); }
  function persist() { store.save({ state: state, prefs: prefs, best: best, record: record }); }
  function live() { return !state.roundOver && !state.matchOver; }
  function myTurn() { return live() && state.turn === "you"; }

  // ---- drawing ----
  function rowsFor(n) { // balanced rows of at most three: 4 -> 2+2, 5 -> 3+2, 7 -> 3+2+2
    var rows = Math.ceil(n / 3), base = Math.floor(n / rows), extra = n % rows, out = [];
    for (var r = 0; r < rows; r++) out.push(base + (r < extra ? 1 : 0));
    return out;
  }
  function bin(v) { return ("000" + v.toString(2)).slice(-4); }
  function drawHeaps() {
    heapsEl.textContent = "";
    var learn = prefs.learn, i = 0;
    rowsFor(state.heaps.length).forEach(function (count) {
      var row = document.createElement("div"); row.className = "hrow";
      for (var c = 0; c < count; c++, i++) row.appendChild(heapEl(i, state.heaps[i], learn));
      heapsEl.appendChild(row);
    });
  }
  function heapEl(i, v, learn) {
    if (!v) {
      var g = document.createElement("div"); g.className = "heap gone"; g.setAttribute("aria-hidden", "true");
      // R13: once a round is decided, the tile taken last shows as a ghost of what was taken
      var l = state.last;
      if (!live() && l && l.kind === "take" && l.tile === i) {
        g.className += " ghost " + (l.who === "you" ? "by-you" : "by-cpu");
        var gn = document.createElement("b"); gn.className = "num"; gn.textContent = l.from; g.appendChild(gn);
        var gp = document.createElement("span"); gp.className = "pips";
        for (var q = 0; q < 9; q++) { var gi = document.createElement("i"); if (q < l.from) gi.className = "take"; gp.appendChild(gi); }
        g.appendChild(gp);
      }
      return g;
    }
    var b = document.createElement("button");
    b.type = "button"; b.className = "heap tile" + (v === 1 ? " lo" : v === 2 ? " lo2" : "") +
      (sel === i ? " sel" : "") + (peekMark === i ? " peek" : "") + (cpuMark === i ? " cpu new" : "");
    b.style.setProperty("--h", K.hue(v)); b.setAttribute("data-i", i);
    var num = document.createElement("b"); num.className = "num"; num.textContent = v; b.appendChild(num);
    var pips = document.createElement("span"); pips.className = "pips";
    for (var k = 0; k < 9; k++) {
      var p = document.createElement("i"); p.setAttribute("data-k", k);
      if (k < v) p.className = sel === i && k >= v - amount ? "take" : "on";
      pips.appendChild(p);
    }
    b.appendChild(pips);
    if (learn) { var bn = document.createElement("span"); bn.className = "bin"; bn.textContent = bin(v); b.appendChild(bn); }
    b.setAttribute("aria-label", "tile " + v + (sel === i ? ", taking " + amount : ""));
    return b;
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
    $("tiles").textContent = state.level;
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
  // End screens (R8): one-line headline, one summary line "<result> · <tally>", a note, a gold button.
  // A decided round or match is final: Undo never crosses it (R1), so no screen offers it.
  function drawOver() {
    var over = $("over"); over.hidden = live() || hold || viewing;
    if (live()) return;
    var sc = state.score.you + "-" + state.score.cpu;
    // the reward line: what paid, or why nothing did (R2: Add or Pass used; R15: every slot full)
    var aw = state.award && state.award.who === "you" ? "+" + NAME[state.award.name] :
      state.roundOver === "you" && state.noAward === "power" ? "No power-up: you used Add or Pass this round." :
      state.roundOver === "you" && state.noAward === "full" ? "Power-ups full." : "";
    var bv = best[bestKey(state)];
    $("over-best").hidden = !(state.matchOver === "you" && newBest);
    if (state.matchOver === "you") {
      $("over-title").textContent = "Match won";
      $("over-text").textContent = "Match won " + sc + " · " + state.level + " tiles";
      $("over-note").textContent = (aw ? aw + " " : "") + (state.level < N.MAX_TILES ? "Next match: " + (state.level + 1) + " tiles." : "Nine tiles again: the top level.");
      $("again").textContent = "Next match";
    } else if (state.matchOver === "cpu") {
      $("over-title").textContent = "Run over";
      $("over-text").textContent = "Match lost " + sc + " · " + state.level + " tiles";
      $("over-note").textContent = "Best: " + (bv ? bv + " tiles" : "none") + ".";
      $("again").textContent = "New game";
    } else {
      $("over-title").textContent = state.roundOver === "you" ? "Round won" : "Round lost";
      $("over-text").textContent = "You " + state.score.you + " : " + state.score.cpu + " Computer · first to " + N.WIN_ROUNDS;
      $("over-note").textContent = state.roundOver === "you" ? aw : moveText(state.last, "cpu");
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
      hold = true; var gen = state.ply;
      holdT = setTimeout(function () { holdT = null; if (state.ply === gen) { hold = false; render(); } }, HOLD_MS);
    }
    if (state.matchOver === "you" && prevState.matchOver !== "you") {
      var k = bestKey(state); newBest = state.level > (best[k] || 0); best[k] = Math.max(best[k] || 0, state.level);
      if (!prefs.unlocked) { prefs.unlocked = true; K.toast("Mis\u00e8re unlocked: the last take loses."); }
    }
    persist(); render(); schedule();
  }
  function schedule() {
    clearTimeout(timer); timer = null;
    if (!live() || state.turn !== "cpu") return;
    var gen = state.ply;
    timer = setTimeout(function () {
      timer = null;
      if (state.ply !== gen || state.turn !== "cpu" || !live()) return; // something changed meanwhile
      var before = state, beforeHeaps = state.heaps.slice();
      state = N.cpuTurn(state);
      cpuMark = null; note = "";
      for (var i = 0; i < beforeHeaps.length; i++) if (beforeHeaps[i] !== state.heaps[i]) cpuMark = i;
      // the computer's Pass or Add is announced in the hint line (moveText), one channel (R7, R14)
      after(before);
    }, CPU_MS);
  }
  function doTake() {
    if (!myTurn() || sel === null) return;
    var before = state, r = N.take(state, sel, amount);
    if (!r.ok) return;
    state = r.state; clearPick(); cpuMark = null; note = ""; targeting = null;
    after(before);
  }
  function select(i, amt) {
    if (!myTurn() || !state.heaps[i]) return;
    if (sel !== i) peekMark = null;
    info = "";
    sel = i; amount = Math.max(1, Math.min(state.heaps[i], amt || 1));
    render();
  }
  function step(d) { if (sel === null) return; amount = Math.max(1, Math.min(state.heaps[sel], amount + d)); render(); }

  // ---- power-ups ----
  function activate(name) {
    info = "";
    if (targeting === name) { targeting = null; return render(); }
    targeting = null;
    var before = state, r;
    if (name === "undo") {
      r = N.use(state, "undo"); if (!r.ok) return render();
      clearTimeout(timer); timer = null;
      state = r.state; clearPick(); cpuMark = null; note = "Rewound to the start of your turn.";
      return after(before); // one channel: the hint line says it (R7)
    }
    if (!myTurn() || !state.power.you[name]) return render();
    if (name === "add") { if (state.added) return render(); targeting = "add"; return render(); }
    if (name === "pass") {
      r = N.use(state, "pass"); if (!r.ok) return render(); // the tray explains why (Not right after a pass)
      state = r.state; clearPick(); note = ""; K.toast("Passed"); return after(before);
    }
    if (name === "peek") {
      r = N.use(state, "peek"); if (!r.ok) return render();
      state = r.state;
      if (r.move) {
        sel = r.move.tile; amount = state.heaps[sel] - r.move.to; peekMark = sel;
        note = "Peek: take " + amount + " from the " + state.heaps[sel] + ".";
      } else { clearPick(); note = "Peek: no winning move here. Add or Pass can change that."; }
      return after(before);
    }
  }
  function addTo(i) {
    var before = state, r = N.use(state, "add", i);
    if (!r.ok) { K.toast(state.heaps[i] >= N.MAX ? "Nine is the cap" : "Pick a live tile", "bad"); return; }
    state = r.state; targeting = null; clearPick(); cpuMark = i; note = "Added 1. Now take from any tile.";
    after(before);
  }

  // ---- input ----
  heapsEl.addEventListener("click", function (e) {
    if (!live()) return showCard();
    var h = e.target.closest ? e.target.closest(".heap[data-i]") : null; if (!h) return;
    var i = +h.getAttribute("data-i"), v = state.heaps[i];
    if (targeting === "add") return addTo(i);
    var pip = e.target.closest(".pips i");
    if (pip) { var k = +pip.getAttribute("data-k"); if (k < v) return select(i, v - k); }
    if (sel === i) return step(sel === i && amount >= v ? 1 - amount : 1); // tapping the chosen tile again takes one more (wraps)
    select(i, 1);
  });
  $("less").addEventListener("click", function () { step(-1); });
  $("more").addEventListener("click", function () { step(1); });
  $("take").addEventListener("click", doTake);
  $("again").addEventListener("click", proceed);
  $("over-view").addEventListener("click", function () { viewing = true; render(); boardEl.focus(); });
  // a tap on the board (or Enter) during the hold or while viewing brings the card back
  function showCard() { if (!hold && !viewing) return false; clearTimeout(holdT); holdT = null; hold = false; viewing = false; render(); return true; }
  boardEl.addEventListener("click", function (e) { if (!live() && !e.target.closest(".over")) showCard(); });
  function proceed() {
    var before = state;
    if (state.matchOver === "you") state = N.nextMatch(state);
    else if (state.matchOver === "cpu") state = N.newGame(K.freshSeed(), prefs);
    else if (state.roundOver) state = N.nextRound(state);
    else return;
    clearPick(); cpuMark = null; note = ""; targeting = null; after(before);
  }
  var kb = false; // a keyboard player sees "(Esc cancels)"; a touch player does not
  window.addEventListener("pointerdown", function () { kb = false; }, true);
  function liveIdx() { var o = []; state.heaps.forEach(function (v, i) { if (v) o.push(i); }); return o; }
  window.addEventListener("keydown", function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var tag = (e.target && e.target.tagName) || "";
    kb = true;
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
  function toggleLearn() { prefs.learn = !prefs.learn; persist(); render(); }
  $("learn-btn").addEventListener("click", toggleLearn);
  $("new").addEventListener("click", function () { confirmNew($("new"), restart); });

  prefs.diff = state.diff; prefs.misere = state.misere && prefs.unlocked;
  render(); schedule();

  // Screenshot hook (tools/shots.cjs): a fixed, representative mid-game. Not reachable from the UI.
  window.__demo = function () {
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
    set state(s) { clearTimeout(timer); timer = null; clearTimeout(holdT); holdT = null; hold = false; viewing = false; state = s; clearPick(); cpuMark = null; note = ""; info = ""; targeting = null; render(); schedule(); },
    get hold() { return hold; }, get viewing() { return viewing; }, get record() { return record; },
    get prefs() { return prefs; },
    render: render,
  };
})();
