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
  var EARN = "Win a round without Erase, Double or Peek to earn one.";
  var DEFS = F.POWERS.map(function (p) {
    return { id: p, label: PW[p], earn: EARN, desc: {
      undo: "Take back your last turn.", erase: "Remove one of the computer's numbers, then claim a different one.",
      peek: "Show the number to block, or the one that wins.", double: "Claim two numbers this turn." }[p] };
  });
  var DIFF = { easy: "Easy", medium: "Medium", hard: "Hard" };
  var HOLD = 1500;                       // R13: the finished board stays in view this long before the card

  var saved = store.load() || {};
  var state = saved.state && F.valid(saved.state) ? saved.state : F.newMatch(K.freshSeed(), "medium");
  var view = saved.view === "grid" ? "grid" : "numbers";
  // R12/R16: matches won and lost on this device; a quit live match counts as lost
  var record = saved.record && typeof saved.record.won === "number" && typeof saved.record.lost === "number" ? saved.record : { won: 0, lost: 0 };
  var counted = !!saved.counted;         // this match's result is already in the record
  var seen = !!saved.seen;               // the one-line note on the first switch to Grid
  var armed = null;                      // "erase" | "double" while a power-up waits for a pick
  var peek = null;                       // last Peek result, shown until the next board action
  var fresh = {};                        // numbers claimed or erased by the last action (fade in)
  var timer = null, gen = 0, cur = 4, diffArmed = null;
  var note = "";                         // a tapped power-up's explanation, shown until the next action
  var cpuNote = "";                      // R14: what the computer's power-up just did, shown on your turn
  var holding = false, holdT = null;     // R13: a result just happened; the card waits HOLD ms
  var viewing = false;                   // R13: "See the board" hides the card again

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

  function tally() {                     // count a finished match once (a drawn match counts neither way)
    if (state.match && !counted) { counted = true; if (state.match.winner === 1) record.won++; else if (state.match.winner === 2) record.lost++; }
  }
  function persist() { tally(); store.save({ state: state, view: view, seen: seen, record: record, counted: counted }); }
  function live() { return !state.match && (state.moves > 0 || state.rounds.length > 0); }
  function cellOf(n) { return view === "grid" ? F.CELL_OF[n] : n - 1; }
  function numAt(cell) { for (var k = 1; k <= 9; k++) if (cellOf(k) === cell) return k; return 5; }
  function sumText(line) { return line.join(" + ") + " = 15"; }

  function render() {
    var res = state.result, line = res && res.line;
    tiles.forEach(function (el, i) {
      var n = i + 1, o = state.owner[i], c = cellOf(n);
      // Grid: the magic square, 3 x 3. Numbers: 1-5 over 6-9, the short row offset, so it never reads as a 3 x 3 (cold #28)
      if (view === "grid") { el.style.setProperty("--r", Math.floor(c / 3)); el.style.setProperty("--c", c % 3); }
      else { el.style.setProperty("--r", c < 5 ? 0 : 1); el.style.setProperty("--c", c < 5 ? c : c - 4.5); }
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
    var rec = $("rec"), none = !record.won && !record.lost;
    rec.textContent = none ? "none" : record.won + "-" + record.lost; rec.classList.toggle("none", none);
    Array.prototype.forEach.call($("diff").children, function (b) { b.setAttribute("aria-pressed", String(b.dataset.d === state.diff)); });
    DEFS[1].earn = state.diff === "hard" ? "On Hard you get one after a drawn round." : EARN;
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
  // R13: the card waits while the finished board shows (holding) and hides again on "See the board" (viewing)
  function renderOver() {
    var res = state.result, over = $("over"), was = !over.hidden, card = !!res && !holding && !viewing;
    over.hidden = !card; boardEl.classList.toggle("ended", card);
    // one end-card pattern (TRIAGE3): the page's New game hides while the card shows, its space kept
    $("new").style.visibility = card ? "hidden" : "";
    if (!card) return;
    var m = state.match, w = m ? m.winner : res.winner, a = state.wins[1], c = state.wins[2];
    // R16: rounds read "You 2 : 1 Computer", a match "Match won 3-1"; each part stays on one line (craft #9)
    var parts = [m ? (w === 1 ? "Match won " + a + "-" + c : w === 2 ? "Match lost " + a + "-" + c : "Match drawn " + a + "-" + c)
      : "You " + a + " : " + c + " Computer"];
    if (state.wins[0]) parts.push(state.wins[0] + " drawn");
    // the family headlines (TRIAGE3): "You win" / "The computer wins" / "Draw", plus " round N" for a round
    $("over-title").textContent = (w === 1 ? "You win" : w === 2 ? "The computer wins" : "Draw") + (m ? "" : " round " + state.round);
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
    if (!res.line) parts.unshift("Nobody made 15");
    if (m) parts.push(DIFF[state.diff]);
    var txt = $("over-text"); txt.textContent = "";
    parts.forEach(function (t, i) {
      if (i) txt.appendChild(document.createTextNode(" · "));
      var sp = document.createElement("span"); sp.textContent = t; txt.appendChild(sp);
    });
    var best = $("over-best"), msg = "", gold = false;
    if (m) msg = "";                       // a new game starts a fresh stock, so a last reward means nothing
    else if (res.winner === 1 && res.earned) { msg = "+1 " + PW[res.earned]; gold = true; }
    else if (res.winner === 1 && res.why === "full") msg = "Power-ups full.";            // R15
    else if (res.winner === 1 && res.why === "powered") msg = "No power-up: you used Erase or Double this round.";
    else if (res.winner === 1 && res.why === "peeked") msg = "No power-up: you used Peek this round.";   // Peek is help (TRIAGE3)
    else if (res.winner === 2 && res.earned) msg = "The computer earned a " + PW[res.earned] + ".";
    best.textContent = msg; best.hidden = !msg; best.className = gold ? "best" : "note";
    $("next").hidden = !!m; $("again").hidden = !m;
    // every card focuses its primary button when it appears (TRIAGE3, craft #8)
    if (!was) (m ? $("again") : $("next")).focus();
  }
  function cpuPending() { return F.playing(state) && state.turn === 2; }
  function hintText() {
    if (state.result) return viewing ? "Tap the board for the summary." : "";   // the card carries the result (R7)
    if (note) return note;
    if (cpuPending()) return "The computer is thinking.";
    var mine = state.owner.some(function (o) { return o === 1; });
    var lead = mine ? "" : "Round " + state.round + " of " + F.ROUNDS + ". ";
    if (armed === "erase") return "Tap a computer number to erase it (Esc cancels).";
    if (armed === "double") return "Double: pick your first number (Esc cancels).";
    if (state.acted && state.last.some(function (a) { return a.type === "double"; })) return "Double: pick your second number.";
    if (peek) return peek.text;
    if (state.blocked) return "Now claim a number (not the one you erased).";
    if (cpuNote) return lead + cpuNote + " Your turn.";
    // Hard hands you an Erase after a drawn round: say so where it matters, at the start of the round
    if (lead && state.diff === "hard" && state.power.erase) return lead + "Your turn; you hold an Erase.";
    return lead + (state.owner.every(function (o) { return !o; }) ? "Your turn. Claim any number." : "Your turn.");
  }

  // ---- turns ----
  function settle(prevOwner) {
    fresh = {};
    if (state.result && prevOwner) startHold();
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
      // R14: the computer's power-ups are announced in the hint line, on your turn
      cpuNote = r.actions.map(function (a) {
        return a.type === "double" ? "The computer used Double." : a.type === "erase" ? "The computer erased your " + a.n + "." : "";
      }).join(" ").replace(/\s+/g, " ").trim();
      settle(before);
    }, THINK);
  }
  function cancelCpu() { gen++; clearTimeout(timer); timer = null; }
  function startHold() {
    clearTimeout(holdT); holding = true; viewing = false;
    holdT = setTimeout(function () { holdT = null; if (holding) showCard(); }, HOLD);
  }
  function showCard() { clearTimeout(holdT); holdT = null; holding = false; viewing = false; render(); }
  function clearHold() { clearTimeout(holdT); holdT = null; holding = false; viewing = false; }

  function onTile(ev) { pick(+ev.currentTarget.dataset.n); }
  function pick(n) {
    cur = cellOf(n);
    if (state.result && holding) return;                           // the finished board holds its full 1.5 s (TRIAGE3)
    if (state.result && viewing) return showCard();                // a tap on the finished board brings the card back
    if (!F.playing(state) || state.turn !== 1) return;
    note = ""; cpuNote = "";
    var before = state.owner.slice(), r;
    if (armed === "erase") {
      r = F.use(state, "erase", n);
      if (!r.ok) { K.toast("Pick one of the computer's numbers", "bad"); return render(); }
      armed = null; state = r.state; peek = null; return settle(before);   // the hint says what comes next
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
    note = ""; cpuNote = "";
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
    // the one-line note goes in the hint line, so it covers nothing (cold #1)
    if (v === "grid" && !seen && !quiet) { seen = true; note = "Same board: every line adds up to 15."; }
    persist(); render();
  }

  // ---- match flow ----
  // R12: quitting a live match (New game or a level switch after the first move) records it as lost
  function startMatch(diff) {
    if (live()) record.lost++;
    cancelCpu(); clearHold(); armed = null; peek = null; fresh = {}; note = ""; cpuNote = "";
    state = F.newMatch(K.freshSeed(), diff || state.diff); counted = false; persist(); render();
    if (cpuPending()) schedule();
  }
  function nextRound() {
    if (!state.result || state.match) return;
    cancelCpu(); clearHold(); armed = null; peek = null; fresh = {}; note = ""; cpuNote = "";
    var back = $("over").contains(document.activeElement);
    state = F.nextRound(state); persist(); render();
    if (back) tiles[numAt(cur) - 1].focus();
    if (cpuPending()) schedule();
  }
  var diffT = null;
  function disarmDiff() {
    if (diffArmed && /counts as a loss/.test(note)) { note = ""; $("hint").textContent = hintText(); }
    clearTimeout(diffT); diffArmed = null;
    Array.prototype.forEach.call($("diff").children, function (x) { x.textContent = DIFF[x.dataset.d]; });
  }
  F.DIFFS.forEach(function (d) {
    var b = document.createElement("button"); b.type = "button"; b.dataset.d = d; b.textContent = DIFF[d];
    b.addEventListener("click", function () {
      if (d === state.diff && !state.match) return;
      // R10/R12: the same two-step "Sure?" as New game, and the hint says it counts as a loss
      if (live() && diffArmed !== d) {
        disarmDiff(); K.clearToast(); diffArmed = d; b.textContent = "Sure?";
        note = "Sure? Switching to " + DIFF[d] + " counts as a loss."; $("hint").textContent = note;
        diffT = setTimeout(disarmDiff, 3000); return;
      }
      disarmDiff(); startMatch(d);
    });
    $("diff").appendChild(b);
  });
  K.twoStep($("new"), live, function () { startMatch(); }, "Sure? Counts as a loss");
  $("again").addEventListener("click", function () { startMatch(); });
  $("next").addEventListener("click", nextRound);
  $("over-view").addEventListener("click", function () { viewing = true; render(); boardEl.focus(); });
  $("v-numbers").addEventListener("click", function () { setView("numbers"); });
  $("v-grid").addEventListener("click", function () { setView("grid"); });

  // ---- keyboard: arrows move over the 3x3 as drawn, Enter claims, V view, 1-4 power-ups, Esc cancels ----
  // R9: while Erase or Double waits for a pick, the arrows move the cursor from anywhere and Enter picks.
  // Enter or Space on a focused button (not a tile) is that button's own click, never a game action;
  // a focused link, input or select keeps every key to itself (R17: Enter on a games-row link navigates).
  window.addEventListener("keydown", function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var t = e.target && e.target.closest ? e.target.closest("a, input, select, textarea") : null;
    if (t) return;
    var ae = document.activeElement, onButton = ae && ae.tagName === "BUTTON" && !ae.classList.contains("ft");
    if ((e.key === "Enter" || e.key === " ") && onButton) return;
    if (state.result && (holding || viewing) && (e.key === "Enter" || e.key === " " || e.key === "Escape")) { e.preventDefault(); return holding ? undefined : showCard(); }
    if (e.key === "Escape") { if (armed) { armed = null; render(); } return; }
    var pi = ["1", "2", "3", "4"].indexOf(e.key);
    if (pi >= 0) { e.preventDefault(); return activate(F.POWERS[pi]); }
    if (e.key === "v" || e.key === "V") return setView(view === "grid" ? "numbers" : "grid");
    if (e.key === "Enter" && state.result && !state.match) { e.preventDefault(); return nextRound(); }
    if (e.key === "Enter" && armed && !boardEl.contains(ae)) { e.preventDefault(); return pick(numAt(cur)); }
    var d = K.arrowKey(e);
    if (d && (armed || ae === boardEl || boardEl.contains(ae))) {
      e.preventDefault();
      if (view === "grid") {
        var r = Math.floor(cur / 3), c = cur % 3;
        if (d === "left") c = (c + 2) % 3; if (d === "right") c = (c + 1) % 3;
        if (d === "up") r = (r + 2) % 3; if (d === "down") r = (r + 1) % 3;
        cur = r * 3 + c;
      } else {   // Numbers: left/right walk 1-9, up/down hop between the 1-5 row and the 6-9 row
        if (d === "left") cur = (cur + 8) % 9; else if (d === "right") cur = (cur + 1) % 9;
        else cur = cur < 5 ? Math.min(cur + 5, 8) : cur - 5;
      }
      render(); tiles[numAt(cur) - 1].focus();
    }
  });
  boardEl.addEventListener("focus", function () { tiles[numAt(cur) - 1].focus(); });

  render();
  if (cpuPending()) schedule();

  // Screenshot hook (tools/shots.cjs): a fixed, representative mid-match. Not reachable from the UI.
  window.__demo = function () {
    cancelCpu(); clearHold(); armed = null; fresh = {}; note = ""; cpuNote = ""; record = { won: 2, lost: 1 };
    var s = F.newMatch(2026, "medium");
    s.round = 3; s.wins = [1, 1, 0]; s.rounds = [1, 0];
    s.owner = [0, 1, 0, 2, 2, 0, 0, 1, 0];     // you 2 8, computer 4 5: you must block 6 (4+5+6)
    s.power = { undo: 1, erase: 1, peek: 1, double: 0 };
    state = s; peek = null; fresh = { 5: true }; render();
  };
  window.__fifteen = {
    get state() { return state; }, set state(s) { cancelCpu(); clearHold(); state = s; armed = null; peek = null; note = ""; cpuNote = ""; render(); if (cpuPending()) schedule(); },
    get view() { return view; }, render: render, get record() { return record; },
    get holding() { return holding; }, get viewing() { return viewing; }, HOLD: HOLD, THINK: THINK,
  };
})();
