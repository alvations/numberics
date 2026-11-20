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
  var DEFS = F.POWERS.map(function (p) {
    return { id: p, label: PW[p], title: {
      undo: "Take back your last turn", erase: "Remove one of the computer's numbers",
      peek: "Show the number you must block", double: "Claim two numbers this turn" }[p] };
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

  var $ = function (id) { return document.getElementById(id); };
  var boardEl = $("board"), tilesEl = $("tiles"), tiles = [];
  for (var n = 1; n <= 9; n++) {
    var b = document.createElement("button");
    b.type = "button"; b.className = "ft"; b.dataset.n = n; b.tabIndex = -1;
    b.style.setProperty("--h", K.hue(n));
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
      el.lastChild.textContent = o === 1 ? "you" : o === 2 ? "cpu" : "";
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
      armed: armed,
      disabled: function (id) { return cpuPending() || !F.canUse(state, id, 1); },
      onUse: activate,
    });
    $("next").hidden = !(res && !state.match);
    $("hint").textContent = hintText();
    var over = $("over"); over.hidden = !state.match;
    if (state.match) {
      var w = state.match.winner;
      $("over-title").textContent = w === 1 ? "You win the match" : w === 2 ? "The computer wins" : "Match drawn";
      $("over-text").textContent = state.wins[1] + " to " + state.wins[2] + (state.wins[0] ? ", " + state.wins[0] + " drawn" : "") + " on " + DIFF[state.diff] + ".";
    }
  }
  function cpuPending() { return F.playing(state) && state.turn === 2; }
  function hintText() {
    var res = state.result;
    if (state.match) return "";
    if (res) {
      var r = "Round " + state.round + ": ";
      if (res.winner === 1) return r + "you made " + sumText(res.line) + (res.earned ? ". +" + PW[res.earned] : ".");
      if (res.winner === 2) return r + "the computer made " + sumText(res.line) + ".";
      return r + "a draw. Nobody made 15.";
    }
    if (cpuPending()) return "The computer is thinking.";
    if (armed === "erase") return "Tap one of the computer's numbers to erase it (Esc cancels).";
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
        if (a.type === "double") K.toast("The computer used Double");
        if (a.type === "erase") K.toast("The computer erased your " + a.n);
      });
      settle(before);
    }, THINK);
  }
  function cancelCpu() { gen++; clearTimeout(timer); timer = null; }

  function onTile(ev) {
    var n = +ev.currentTarget.dataset.n;
    cur = cellOf(n);
    if (!F.playing(state) || state.turn !== 1) return;
    var before = state.owner.slice(), r;
    if (armed === "erase") {
      r = F.use(state, "erase", n);
      if (!r.ok) { K.toast("Pick one of the computer's numbers"); return; }
      armed = null; state = r.state; peek = null; K.toast("Erased " + n); return settle(before);
    }
    if (armed === "double") {
      if (state.owner[n - 1]) { K.toast("Pick a free number"); return; }
      r = F.use(state, "double"); if (!r.ok) { armed = null; return render(); }
      state = r.state; armed = null;
    }
    r = F.claim(state, n);
    if (!r.ok) { K.toast(n === state.blocked ? "You just erased that one" : "Already taken"); return render(); }
    state = r.state; peek = null;
    if (state.result && state.result.winner === 1 && state.result.earned) K.toast("Round won  +" + PW[state.result.earned]);
    settle(before);
  }

  function activate(id) {
    if (armed === id) { armed = null; return render(); }
    armed = null;
    if (id === "undo") {
      if (!F.canUse(state, "undo", 1)) return;
      cancelCpu(); var before = state.owner.slice(), u = F.use(state, "undo");
      if (u.ok) { state = u.state; peek = null; K.toast("Rewound your last turn"); }
      return settle(before);
    }
    if (cpuPending() || !F.canUse(state, id, 1)) return render();
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
    cancelCpu(); armed = null; peek = null; fresh = {};
    state = F.newMatch(K.freshSeed(), diff || state.diff); persist(); render();
  }
  function nextRound() {
    if (!state.result || state.match) return;
    cancelCpu(); armed = null; peek = null; fresh = {};
    state = F.nextRound(state); persist(); render();
    if (cpuPending()) schedule();
  }
  F.DIFFS.forEach(function (d) {
    var b = document.createElement("button"); b.type = "button"; b.dataset.d = d; b.textContent = DIFF[d];
    b.addEventListener("click", function () {
      if (d === state.diff && !state.match) return;
      var midMatch = !state.match && (state.moves > 0 || state.rounds.length > 0);
      if (midMatch && diffArmed !== d) {
        diffArmed = d; K.toast("Tap " + DIFF[d] + " again for a new match");
        setTimeout(function () { if (diffArmed === d) diffArmed = null; }, 3000); return;
      }
      diffArmed = null; startMatch(d);
    });
    $("diff").appendChild(b);
  });
  K.twoStep($("new"), function () { return !state.match && (state.moves > 0 || state.rounds.length > 0); }, function () { startMatch(); }, "Sure? This ends the match");
  $("again").addEventListener("click", function () { startMatch(); });
  $("next").addEventListener("click", nextRound);
  $("v-numbers").addEventListener("click", function () { setView("numbers"); });
  $("v-grid").addEventListener("click", function () { setView("grid"); });

  // ---- keyboard: arrows move over the 3x3 as drawn, Enter claims, V view, 1-4 power-ups, Esc cancels ----
  window.addEventListener("keydown", function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === "Escape") { armed = null; return render(); }
    var pi = ["1", "2", "3", "4"].indexOf(e.key);
    if (pi >= 0) { e.preventDefault(); return activate(F.POWERS[pi]); }
    if (e.key === "v" || e.key === "V") return setView(view === "grid" ? "numbers" : "grid");
    if (e.key === "Enter" && state.result && !state.match) { e.preventDefault(); return nextRound(); }
    var d = K.arrowKey(e);
    if (d && (document.activeElement === boardEl || boardEl.contains(document.activeElement))) {
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
