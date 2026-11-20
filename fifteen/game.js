/* SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 alvations (Melon Lab)
 * Numberics Fifteen: browser client. fifteen/engine.js owns every rule;
 * this file only draws, listens, and remembers. */
(function () {
  "use strict";
  var F = window.NumbericsFifteen, K = window.NumbericsKit, P = window.NumbericsPower;
  var store = K.store("numberics_fifteen_v1");
  var THINK = 520;                       // the computer's pause (a delay, not motion)
  var PW = { undo: "Undo", erase: "Erase", peek: "Peek", double: "Double" };
  // R5: every power-up explains itself on a tap, even when it cannot act
  var EARN = "Win a round without Erase or Double to earn one.";
  var DEFS = F.POWERS.map(function (p) {
    return { id: p, label: PW[p], earn: EARN, desc: {
      undo: "Take back your last turn.", erase: "Remove one of the computer's numbers.",
      peek: "Show the number to block, or the one that wins.", double: "Claim two numbers this turn." }[p] };
  });
  var DIFF = { easy: "Easy", medium: "Medium", hard: "Hard" };

  var saved = store.load() || {};
  var state = saved.state && F.valid(saved.state) ? saved.state : F.newMatch(K.freshSeed(), "medium");
  var view = saved.view === "grid" ? "grid" : "numbers";
  var seen = !!saved.seen;               // the one-line note on the first switch to Grid
  var armed = null;                      // "erase" | "double" while a power-up waits for a pick
  var peek = null;                       // last Peek result, shown until the next board action
  var fresh = {};                        // numbers claimed or erased by the last action (fade in)
  var timer = null, gen = 0, cur = 4, diffArmed = null;
  var note = "";                         // a tapped power-up's explanation, shown until the next action

  var $ = function (id) { return document.getElementById(id); };
  var boardEl = $("board"), tilesEl = $("tiles"), tiles = [];
  for (var n = 1; n <= 9; n++) {
    var b = document.createElement("button");
    b.type = "button"; b.className = "ft"; b.dataset.n = n; b.tabIndex = -1;
    var num = document.createElement("b"); num.textContent = n; b.appendChild(num);
    var tag = document.createElement("small"); b.appendChild(tag);
    b.addEventListener("click", onTile);
    b.addEventListener("focus", function (e) { cur = cellOf(+e.currentTarget.dataset.n); });
    tilesEl.appendChild(b); tiles.push(b);
  }

  function persist() { store.save({ state: state, view: view, seen: seen }); }
  function cellOf(n) { return view === "grid" ? F.CELL_OF[n] : n - 1; }
  function numAt(cell) { for (var k = 1; k <= 9; k++) if (cellOf(k) === cell) return k; return 5; }
  function sumText(line) { return line.join(" + ") + " = 15"; }

  function render() {
    var res = state.result, line = res && res.line;
    tiles.forEach(function (el, i) {
      var n = i + 1, o = state.owner[i], c = cellOf(n);
      el.style.setProperty("--r", Math.floor(c / 3)); el.style.setProperty("--c", c % 3);
      el.className = "ft" + (o === 1 ? " mine" : o === 2 ? " theirs" : "") +
        (line && line.indexOf(n) >= 0 ? " win" : line ? " dim" : "") +
        (fresh[n] ? " fresh" : "") +
        (peek && peek.mark.indexOf(n) >= 0 ? " peek" : "") +
        (n === state.blocked ? " blocked" : "") +
        (armed === "erase" && o === 2 ? " target" : "");
      el.lastChild.textContent = o === 1 ? "you" : o === 2 ? "computer" : "";
      el.setAttribute("aria-label", n + (o === 1 ? ", yours" : o === 2 ? ", the computer's" : ", free"));
      el.tabIndex = c === cur ? 0 : -1;
    });
    boardEl.classList.toggle("grid", view === "grid");
    boardEl.classList.toggle("targeting", !!armed);
    $("v-numbers").setAttribute("aria-pressed", String(view === "numbers"));
    $("v-grid").setAttribute("aria-pressed", String(view === "grid"));
    $("you").textContent = state.wins[1]; $("cpu").textContent = state.wins[2];
    $("round").textContent = Math.min(state.round, F.ROUNDS) + "/" + F.ROUNDS;
    Array.prototype.forEach.call($("diff").children, function (b) { b.setAttribute("aria-pressed", String(b.dataset.d === state.diff)); });
    P.tray($("tray"), DEFS, state.power, {
      armed: armed, disabled: whyNot, onUse: activate,
      onInfo: function (id, text) { note = text; $("hint").textContent = note; },
    });
    $("hint").textContent = hintText();
    renderOver();
  }
  // false when you can use it now; otherwise the reason (with charges) or true (no charges: the tray says how to earn)
  function whyNot(id) {
    if (!state.power[id]) return true;
    if (F.canUse(state, id, 1)) return cpuPending() && id !== "undo" ? "Wait for the computer." : false;
    if (state.result || state.match) return id === "undo" ? "A finished round cannot be taken back." : "The round is over.";
    if (cpuPending()) return "Wait for the computer.";
    if (id === "undo") return "Nothing to take back yet.";
    if (state.usedPower || state.claimsLeft !== 1) return "One Erase or Double per turn.";
    if (id === "erase") return "The computer holds no number yet.";
    if (id === "double") return "Needs two free numbers.";
    return "Not now.";
  }
  // R8: one overlay for a round end and for the match end; the winning three stay visible as chips
  function renderOver() {
    var res = state.result, over = $("over"), was = !over.hidden;
    over.hidden = !res; boardEl.classList.toggle("ended", !!res);
    if (!res) return;
    var m = state.match, w = m ? m.winner : res.winner, tally = "You " + state.wins[1] + " : " + state.wins[2] + " Computer" +
      (state.wins[0] ? " · " + state.wins[0] + " drawn" : "");
    $("over-title").textContent = m ? (w === 1 ? "You win the match" : w === 2 ? "The computer wins" : "Match drawn")
      : (w === 1 ? "You win round " : w === 2 ? "Computer wins round " : "Round " + state.round + " drawn").replace(/round $/, "round " + state.round);
    var trio = $("trio"); trio.textContent = "";
    if (res.line) {
      res.line.forEach(function (n, i) {
        if (i) trio.appendChild(document.createTextNode("+"));
        var c = document.createElement("b"); c.className = res.winner === 1 ? "mine" : "theirs"; c.textContent = n; trio.appendChild(c);
      });
      trio.appendChild(document.createTextNode("= 15"));
      trio.setAttribute("aria-label", sumText(res.line));
    } else trio.setAttribute("aria-label", "");
    trio.hidden = !res.line;
    $("over-text").textContent = (res.line ? "" : "Nobody made 15 · ") + tally + (m ? " · " + DIFF[state.diff] : "");
    var best = $("over-best"), msg = "", gold = false;
    if (m) msg = "";                       // a new game starts a fresh stock, so a last reward means nothing
    else if (res.winner === 1 && res.earned) { msg = "+1 " + PW[res.earned]; gold = true; }
    else if (res.winner === 1 && !m) msg = "No power-up: you used Erase or Double this round.";
    else if (res.winner === 2 && res.earned) msg = "The computer earned a " + PW[res.earned] + ".";
    best.textContent = msg; best.hidden = !msg; best.className = gold ? "best" : "note";
    $("next").hidden = !!m; $("again").hidden = !m;
    // keyboard players keep their place: a result reached from the board moves focus to the overlay's button
    if (!was && boardEl.contains(document.activeElement)) (m ? $("again") : $("next")).focus();
  }
  function cpuPending() { return F.playing(state) && state.turn === 2; }
  function hintText() {
    if (state.result) return "";             // the overlay carries the result (R7: one channel per event)
    if (note) return note;
    if (cpuPending()) return "The computer is thinking.";
    if (armed === "erase") return "Tap a computer number to erase it (Esc cancels).";
    if (armed === "double") return "Double: pick your first number (Esc cancels).";
    if (state.acted && state.last.some(function (a) { return a.type === "double"; })) return "Double: pick your second number.";
    if (peek) return peek.text;
    if (state.blocked) return "Now claim a number (not the one you erased).";
    return state.owner.every(function (o) { return !o; }) ? "Your turn. Claim any number." : "Your turn.";
  }

  // ---- turns ----
  function settle(prevOwner) {
    fresh = {};
    if (prevOwner) for (var i = 0; i < 9; i++) if (prevOwner[i] !== state.owner[i]) fresh[i + 1] = true;
    persist(); render();
    if (cpuPending()) schedule();
  }
  function schedule() {
    clearTimeout(timer); var g = ++gen;
    timer = setTimeout(function () {
      if (g !== gen || !cpuPending()) return;        // a stale timer never plays an old board
      timer = null; var before = state.owner.slice(), r = F.cpuTurn(state);
      state = r.state; peek = null;
      r.actions.forEach(function (a) {
        if (a.type === "double") K.toast("The computer used Double", "bad");
        if (a.type === "erase") K.toast("The computer erased your " + a.n, "bad");
      });
      settle(before);
    }, THINK);
  }
  function cancelCpu() { gen++; clearTimeout(timer); timer = null; }

  function onTile(ev) { pick(+ev.currentTarget.dataset.n); }
  function pick(n) {
    cur = cellOf(n);
    if (!F.playing(state) || state.turn !== 1) return;
    note = "";
    var before = state.owner.slice(), r;
    if (armed === "erase") {
      r = F.use(state, "erase", n);
      if (!r.ok) { K.toast("Pick one of the computer's numbers", "bad"); return render(); }
      armed = null; state = r.state; peek = null; K.toast("Erased " + n); return settle(before);
    }
    if (armed === "double") {
      if (state.owner[n - 1]) { K.toast("Pick a free number", "bad"); return render(); }
      r = F.use(state, "double"); if (!r.ok) { armed = null; return render(); }
      state = r.state; armed = null;
    }
    r = F.claim(state, n);
    if (!r.ok) { K.toast(n === state.blocked ? "You just erased that one" : "Already taken", "bad"); return render(); }
    state = r.state; peek = null;
    settle(before);   // a round won shows in the overlay, its reward included (R7)
  }

  function activate(id) {
    note = "";
    if (armed === id) { armed = null; return render(); }
    armed = null;
    if (id === "undo") {
      if (!F.canUse(state, "undo", 1)) { note = P.info(DEFS[0], state.power, whyNot("undo"), {}); return render(); }
      cancelCpu(); var before = state.owner.slice(), u = F.use(state, "undo");
      if (u.ok) { state = u.state; peek = null; K.toast("Rewound your last turn"); }
      return settle(before);
    }
    if (cpuPending() || !F.canUse(state, id, 1)) {    // keys 1-4 explain too, like a tap (R5)
      var why = whyNot(id), d = DEFS[F.POWERS.indexOf(id)];
      if (why) { note = P.info(d, state.power, why, {}); }
      return render();
    }
    if (id === "peek") {
      var r = F.use(state, "peek"), i = r.info; state = r.state;
      peek = i.win.length ? { mark: i.win, text: "Peek: " + i.win.join(" or ") + " wins it for you." }
        : i.block.length > 1 ? { mark: i.block, text: "Peek: the computer has two ways in (" + i.block.join(" and ") + "). Block one." }
        : i.block.length ? { mark: i.block, text: "Peek: block " + i.block[0] + "." }
        : { mark: i.best, text: "Peek: nothing to block. Strongest: " + i.best.join(", ") + "." };
      persist(); return render();
    }
    armed = id; render();
  }

  function setView(v, quiet) {
    if (v === view) return;
    var keep = numAt(cur); view = v; cur = cellOf(keep);   // the cursor stays on the same number
    if (v === "grid" && !seen && !quiet) { seen = true; K.toast("Same board: every line adds up to 15."); }
    persist(); render();
  }

  // ---- match flow ----
  function startMatch(diff) {
    cancelCpu(); armed = null; peek = null; fresh = {}; note = "";
    state = F.newMatch(K.freshSeed(), diff || state.diff); persist(); render();
  }
  function nextRound() {
    if (!state.result || state.match) return;
    cancelCpu(); armed = null; peek = null; fresh = {}; note = "";
    var back = $("over").contains(document.activeElement);
    state = F.nextRound(state); persist(); render();
    if (back) tiles[numAt(cur) - 1].focus();
    if (cpuPending()) schedule();
  }
  var diffT = null;
  function disarmDiff() {
    clearTimeout(diffT); diffArmed = null;
    Array.prototype.forEach.call($("diff").children, function (x) { x.textContent = DIFF[x.dataset.d]; });
  }
  F.DIFFS.forEach(function (d) {
    var b = document.createElement("button"); b.type = "button"; b.dataset.d = d; b.textContent = DIFF[d];
    b.addEventListener("click", function () {
      if (d === state.diff && !state.match) return;
      // R10: the same two-step "Sure?" as New game
      var midMatch = !state.match && (state.moves > 0 || state.rounds.length > 0);
      if (midMatch && diffArmed !== d) {
        disarmDiff(); diffArmed = d; b.textContent = "Sure?";
        diffT = setTimeout(disarmDiff, 3000); return;
      }
      disarmDiff(); startMatch(d);
    });
    $("diff").appendChild(b);
  });
  K.twoStep($("new"), function () { return !state.match && (state.moves > 0 || state.rounds.length > 0); }, function () { startMatch(); }, "Sure? This ends the match");
  $("again").addEventListener("click", function () { startMatch(); });
  $("next").addEventListener("click", nextRound);
  $("v-numbers").addEventListener("click", function () { setView("numbers"); });
  $("v-grid").addEventListener("click", function () { setView("grid"); });

  // ---- keyboard: arrows move over the 3x3 as drawn, Enter claims, V view, 1-4 power-ups, Esc cancels ----
  // R9: while Erase or Double waits for a pick, the arrows move the cursor from anywhere and Enter picks.
  // Enter or Space on a focused button (not a tile) is that button's own click, never a game action.
  window.addEventListener("keydown", function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var ae = document.activeElement, onButton = ae && ae.tagName === "BUTTON" && !ae.classList.contains("ft");
    if ((e.key === "Enter" || e.key === " ") && onButton) return;
    if (e.key === "Escape") { if (armed) { armed = null; render(); } return; }
    var pi = ["1", "2", "3", "4"].indexOf(e.key);
    if (pi >= 0) { e.preventDefault(); return activate(F.POWERS[pi]); }
    if (e.key === "v" || e.key === "V") return setView(view === "grid" ? "numbers" : "grid");
    if (e.key === "Enter" && state.result && !state.match) { e.preventDefault(); return nextRound(); }
    if (e.key === "Enter" && armed && !boardEl.contains(ae)) { e.preventDefault(); return pick(numAt(cur)); }
    var d = K.arrowKey(e);
    if (d && (armed || ae === boardEl || boardEl.contains(ae))) {
      e.preventDefault();
      var r = Math.floor(cur / 3), c = cur % 3;
      if (d === "left") c = (c + 2) % 3; if (d === "right") c = (c + 1) % 3;
      if (d === "up") r = (r + 2) % 3; if (d === "down") r = (r + 1) % 3;
      cur = r * 3 + c; render(); tiles[numAt(cur) - 1].focus();
    }
  });
  boardEl.addEventListener("focus", function () { tiles[numAt(cur) - 1].focus(); });

  render();
  if (cpuPending()) schedule();

  // Screenshot hook (tools/shots.cjs): a fixed, representative mid-match. Not reachable from the UI.
  window.__demo = function () {
    cancelCpu(); armed = null; fresh = {};
    var s = F.newMatch(2026, "medium");
    s.round = 3; s.wins = [1, 1, 0]; s.rounds = [1, 0];
    s.owner = [0, 1, 0, 2, 2, 0, 0, 1, 0];     // you 2 8, computer 4 5: you must block 6 (4+5+6)
    s.power = { undo: 1, erase: 1, peek: 1, double: 0 };
    state = s; peek = null; fresh = { 5: true }; render();
  };
  window.__fifteen = {
    get state() { return state; }, set state(s) { cancelCpu(); state = s; armed = null; peek = null; render(); if (cpuPending()) schedule(); },
    get view() { return view; }, render: render,
  };
})();
