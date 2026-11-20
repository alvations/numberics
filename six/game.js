/* SPDX-License-Identifier: Apache-2.0 | Copyright 2026 alvations (Melon Lab)
 * Numberics Six: browser client. six/engine.js owns every rule (and the solver); this file only draws,
 * listens and remembers. */
(function () {
  "use strict";
  var E = window.NumbericsSix, K = window.NumbericsKit, P = window.NumbericsPower;
  var store = K.store("numberics_six_v1");
  var $ = function (id) { return document.getElementById(id); };

  // Undo is slot 1 in every Numberics game (R5); keys 1-4 follow this order
  var PW = [{ id: "undo", label: "Undo", desc: "Take back the last edit." },
            { id: "hint", label: "Hint", desc: "Reveal one step of a solution." },
            { id: "skip", label: "Skip", desc: "Get a new line in the same tier." },
            { id: "peek", label: "Peek", desc: "Show the value of one part of a solution." }];
  var EARN = "Three lines in a row made without help earn one.";
  var NAME = { hint: "Hint", skip: "Skip", peek: "Peek", undo: "Undo" };
  var SIGN = ["", "√", "!", "√√", "(√)!"];

  function validLine(l) { return l && Array.isArray(l.n) && l.n.length >= 3 && l.n.length <= 6 && typeof l.g === "string" && l.sol && Array.isArray(l.sol.g); }
  function valid(s) {
    if (!s || s.v !== 1 || !Array.isArray(s.lines) || s.lines.length !== 6 || !s.lines.every(validLine)) return false;
    if (!(s.idx >= 0 && s.idx < 6) || !s.cur || !Array.isArray(s.cur.g) || !Array.isArray(s.cur.u) || !Array.isArray(s.cur.b)) return false;
    var n = s.lines[s.idx].n.length;
    return s.cur.g.length === n - 1 && s.cur.u.length === n && s.power && E.POWERS.every(function (p) { return Number.isInteger(s.power[p]) && s.power[p] >= 0; });
  }
  var saved = store.load() || {};
  var today = K.daySeed();
  var games = {
    climb: valid(saved.climb) && saved.climb.mode === "climb" ? saved.climb : E.newGame(K.freshSeed(), "climb"),
    daily: valid(saved.daily) && saved.daily.mode === "daily" && saved.daily.start === today ? saved.daily : E.newGame(today, "daily"),
  };
  var mode = saved.mode === "daily" ? "daily" : "climb";
  // Best: the most Climb rounds cleared in one run, "none" before any (round 2: it read 1 before any play).
  // Older saves kept the round reached, so a reached round 3 means 2 cleared.
  var best = saved.cleared >= 0 ? saved.cleared | 0 : Math.max(0, (saved.best | 0) - 1);
  // the best before this Climb run began, so the round-cleared card can say "New best."
  var runBest = saved.runCleared >= 0 ? Math.min(saved.runCleared | 0, best) : best;
  var state = games[mode];
  var cursor = 0, anchor = -1, bracketMode = false, drag = null, kbd = false; // kbd: show the cursor only for keyboard play
  var note = ""; // a one-off hint line message (a power-up explaining itself, a confirm), cleared by the next action

  function persist() {
    games[mode] = state;
    if (state.mode === "climb") best = Math.max(best, cleared(state));
    store.save({ climb: games.climb, daily: games.daily, mode: mode, cleared: best, runCleared: runBest });
  }
  function cleared(s) { return s.round - 1 + (s.over && !s.ended ? 1 : 0); } // Climb rounds cleared in this run
  function toast(m, kind) { K.toast(m, kind); }
  function level(tok) { return (parseInt(tok, 10) % 11) + 1; }
  function ord(k) { return ["1st", "2nd", "3rd", "4th", "5th", "6th"][k] || (k + 1) + "th"; }

  // ---------- drawing ----------
  var boardEl = $("board"), lineEl = $("line"), barsEl = $("bars");
  function cols(n) {
    var c = []; for (var k = 0; k < n; k++) { c.push("minmax(0,3fr)"); if (k < n - 1) c.push("minmax(0,2fr)"); }
    return c.join(" ");
  }
  function render() {
    var L = E.line(state), n = L.n.length, cur = state.cur, lits = E.literals(L.n, cur.g) || L.n.map(function (t, i) { return { i: i, j: i }; });
    var startOf = []; lits.forEach(function (l) { for (var k = l.i; k <= l.j; k++) startOf[k] = l.i; });
    var long = L.n.some(function (t) { return t.length > 1; }) && n >= 4;
    var width = n * 68 + (n - 1) * 44;
    [lineEl, barsEl].forEach(function (el) { el.style.gridTemplateColumns = cols(n); el.style.maxWidth = width + "px"; });
    lineEl.className = "line n" + n + (long ? " long" : "");
    var gold = E.onTarget(state);
    boardEl.classList.toggle("gold", gold);
    var peekOn = {}; state.peeks.forEach(function (p) { for (var k = p.i; k <= p.j; k++) peekOn[k] = true; });

    lineEl.textContent = "";
    L.n.forEach(function (tok, k) {
      var t = document.createElement("div"), lv = level(tok);
      t.className = "tile num" + (lv === 1 ? " lo" : lv === 2 ? " lo2" : "");
      t.style.setProperty("--h", K.hue(lv));
      t.dataset.i = k; t.textContent = tok;
      t.setAttribute("role", "button");
      var u = cur.u[startOf[k]];
      if (k > 0 && (cur.g[k - 1] === "j" || cur.g[k - 1] === ".")) t.classList.add("jl");
      if (k < n - 1 && (cur.g[k] === "j" || cur.g[k] === ".")) t.classList.add("jr");
      if (startOf[k] === k && u) { var sg = document.createElement("span"); sg.className = "sg"; sg.textContent = SIGN[u]; t.appendChild(sg); }
      t.setAttribute("aria-label", "number " + tok + (u ? ", sign " + ["", "square root", "factorial", "square root twice", "factorial of the square root"][u] : ""));
      if (kbd && cursor === 2 * k) t.classList.add("cur");
      if (anchor === k) t.classList.add("anchor");
      if (peekOn[k]) t.classList.add("pk");
      lineEl.appendChild(t);
      if (k < n - 1) {
        var g = document.createElement("button"), op = cur.g[k];
        g.type = "button"; g.className = "gp" + (!op ? " empty" : op === "j" ? " j" : op === "." ? " dot" : "");
        g.dataset.g = k;
        var b = document.createElement("b"); b.textContent = !op ? "?" : op === "j" ? "·" : op === "." ? "." : E.SYM[op];
        g.appendChild(b);
        g.setAttribute("aria-label", "gap " + (k + 1) + ": " + (!op ? "empty" : op === "j" ? "joined" : op === "." ? "decimal point" : op));
        if (kbd && cursor === 2 * k + 1) g.classList.add("cur");
        lineEl.appendChild(g);
      }
    });

    barsEl.textContent = "";
    var bars = cur.b.slice(), rows = 1;
    // the drag preview; over an existing bracket of the same span (dropping there removes it) none is added
    var gl = drag && drag.to >= 0 && drag.to !== drag.from ? [Math.min(drag.from, drag.to), Math.max(drag.from, drag.to), 0, "ghost"] : null;
    if (gl && !bars.some(function (b) { return b[0] === gl[0] && b[1] === gl[1]; })) bars.push(gl);
    var depth = E.depths(bars);
    bars.forEach(function (br, x) {
      var el = document.createElement(br[3] ? "div" : "button"), d = depth[x];
      rows = Math.max(rows, d);
      el.className = "bar" + (br[3] ? " ghost" : "");
      if (!br[3]) { el.type = "button"; el.dataset.x = x; el.setAttribute("aria-label", "bracket over numbers " + (br[0] + 1) + " to " + (br[1] + 1) + (br[2] ? ", sign " + SIGN[br[2]] : "") + ". Tap to change its sign."); }
      el.style.gridColumn = (2 * br[0] + 1) + " / " + (2 * br[1] + 2);
      el.style.gridRow = String(d);
      if (br[2]) { var i = document.createElement("i"); i.textContent = SIGN[br[2]] + "( )"; if (br[2] === 2) i.textContent = "( )!"; if (br[2] === 4) i.textContent = "(√( ))!"; el.appendChild(i); }
      barsEl.appendChild(el);
    });
    barsEl.style.minHeight = (rows * 18) + "px";

    var txt = E.text(L.n, cur), val = E.current(state);
    $("expr").textContent = txt === null ? "One number takes one decimal point" : txt;
    var tv = $("val");
    if (val.v) tv.textContent = "= " + E.show(val.v);
    else tv.textContent = val.why === "gap" ? "= ?" : val.why === "dot" ? "= ?" : "= no exact value";
    $("target").textContent = L.g;
    $("tier").textContent = E.TIERS[L.t].label + " · " + E.TIERS[L.t].what;
    var pips = $("pips"); pips.textContent = "";
    state.lines.forEach(function (l, k) {
      var i = document.createElement("i");
      if (k < state.idx || (k === state.idx && state.done)) i.className = "on"; else if (k === state.idx) i.className = "cur";
      pips.appendChild(i);
    });

    $("round-label").textContent = state.mode === "daily" ? "Made" : "Round";
    $("round").textContent = state.mode === "daily" ? String(state.solved) : String(state.round);
    $("lineno").textContent = (state.idx + 1) + "/6";
    var bv = state.mode === "climb" ? Math.max(best, cleared(state)) : best;
    $("best").textContent = bv ? String(bv) : "none"; $("best").classList.toggle("none", !bv);
    Array.prototype.forEach.call($("modes").children, function (b) { b.setAttribute("aria-pressed", String(b.dataset.mode === mode)); });

    $("next").hidden = !state.done || state.over;
    $("brk").hidden = state.done; $("clear").hidden = state.done; $("reveal").hidden = state.done;
    $("reveal").classList.toggle("ender", state.mode === "climb"); // in Climb it ends the run: styled as such
    $("brk").setAttribute("aria-pressed", String(bracketMode));
    P.tray($("tray"), PW, state.power, { disabled: function (id) { return E.why(state, id) || !E.useable(state, id); },
      onUse: activate, earn: EARN, onInfo: function (id, t) { note = t; render(); } });

    var h = "";
    if (note) h = note;
    else if (state.done && !state.over) h = state.gave ? "One answer, shown. Next line (Enter)." : "Made " + L.g + ". Next line (Enter).";
    else if (bracketMode) h = anchor < 0 ? "Tap the first number to group (Esc cancels)." : "Now tap the last number of the group.";
    else if (anchor >= 0) h = "Bracket opened at number " + (anchor + 1) + ". Move and press ) to close.";
    else if (state.peeks.length) h = "Peek: " + state.peeks.map(function (p) { return L.n.slice(p.i, p.j + 1).join(" ") + " make " + p.v; }).join(" · ");
    else if (val.why === "math") h = "Each step must be a whole number or a fraction.";
    else if (!state.edits && !state.done && state.idx === 0 && state.round === 1) h = "Tap a gap for + − × ÷, a number for √ or !.";
    $("hint").textContent = h;

    // end screens (R8): headline, one summary line "<result> · <tally>", the answer when one was shown, New best
    var over = $("over"); over.hidden = !state.over;
    var pw = state.used + " power-up" + (state.used === 1 ? "" : "s") + " used";
    var made = state.solved + " line" + (state.solved === 1 ? "" : "s") + " made";
    $("over-answer").hidden = true; $("over-best").hidden = true;
    if (state.over) {
      if (state.mode === "daily") {
        $("over-title").textContent = "Daily Six done";
        $("over-text").textContent = state.solved + " of 6 made · " + pw;
        $("again").textContent = "Play Climb";
      } else if (state.ended) {
        $("over-title").textContent = "Run over";
        $("over-text").textContent = "Round " + state.round + " · " + made;
        // the overlay covers the line, so the answer it ends on is printed here
        $("over-answer").textContent = "The answer: " + txt + " = " + L.g;
        $("over-answer").hidden = false;
        $("again").textContent = "New game";
      } else {
        $("over-title").textContent = "Round " + state.round + " cleared";
        $("over-text").textContent = made + " · " + pw;
        $("over-best").hidden = !(state.round > runBest);
        $("again").textContent = "Next round";
      }
    }
  }

  // ---------- actions ----------
  function apply(r, quiet) {
    if (!r.ok) {
      if (!quiet && revealArmed && /cross|one|dot/.test(r.why)) disarmReveal(); // its warning never sits under a toast
      if (!quiet && r.why === "cross") toast("Brackets cannot cross", "bad");
      else if (!quiet && r.why === "one") toast("Group two numbers or more", "bad");
      else if (!quiet && r.why === "dot") toast("One number takes one decimal point", "bad");
      return false;
    }
    state = r.state; note = ""; disarmReveal();
    // a made line is said once, in the hint line (R7); only a reward gets the toast
    if (r.award) toast("Three clean lines: +" + NAME[r.award]);
    else if (r.full) toast("Three clean lines. Power-ups full", "info"); // R15: a skipped reward is said
    persist(); render(); return true;
  }
  function doEdit(act, quiet) { return apply(E.edit(state, act), quiet); }
  function activate(id) {
    if (!E.useable(state, id)) { // a slot that cannot act explains itself (R5), the same for keys 1-4 and taps
      var d = PW.filter(function (x) { return x.id === id; })[0];
      note = P.info(d, state.power, E.why(state, id), { earn: EARN }); render(); return;
    }
    var r = E.use(state, id);
    if (!r.ok) return;
    disarmReveal(); state = r.state; anchor = -1; bracketMode = false; note = "";
    if (id === "hint" && r.step) {
      var st = r.step, sol = E.line(state).sol;
      toast(st.kind === "gap" ? "Hint: the " + ord(st.i) + " gap is " + (sol.g[st.i] === "j" ? "joined" : sol.g[st.i] === "." ? "a decimal point" : E.SYM[sol.g[st.i]])
        : st.kind === "un" ? "Hint: the " + ord(st.i) + " number takes " + (SIGN[sol.u[st.i]] || "no sign")
        : st.kind === "brx" ? "Hint: that bracket is not needed" : "Hint: group numbers " + (st.b[0] + 1) + " to " + (st.b[1] + 1), "info");
    } else if (id === "skip") { toast("New line", "info"); cursor = 0; disarm(); }
    else if (id === "undo") toast("Took back the last edit", "info"); // gold is for rewards only (R7)
    persist(); render();
  }
  // an armed two-step never carries over to another line, mode or game
  function disarm() { disarmReveal(); disarmClear(); }
  function nextLine() {
    var r = E.next(state); if (!r.ok) return; disarm();
    state = r.state; cursor = 0; anchor = -1; bracketMode = false; note = ""; persist(); render();
  }
  function again() {
    if (!state.over) return;
    if (state.mode === "daily") return setMode("climb");
    if (state.ended) return startNew();
    disarm();
    state = E.nextRound(state).state; cursor = 0; note = ""; persist(); render();
  }
  function setMode(m) {
    if (m === mode) return;
    disarm(); games[mode] = state; mode = m;
    if (m === "daily" && games.daily.start !== K.daySeed()) games.daily = E.newGame(K.daySeed(), "daily");
    state = games[m]; cursor = 0; anchor = -1; bracketMode = false; drag = null; note = ""; persist(); render();
  }
  function startNew() {
    disarm();
    state = mode === "daily" ? E.newGame(K.daySeed(), "daily") : E.newGame(K.freshSeed(), "climb");
    if (mode === "climb") runBest = best;
    cursor = 0; anchor = -1; bracketMode = false; note = ""; persist(); render();
  }
  function pickTile(k) {
    if (state.done) return;
    if (anchor < 0) { anchor = k; render(); return; }
    var a = anchor; anchor = -1; bracketMode = false;
    if (a === k) { render(); return; }
    if (!doEdit({ k: "br", i: a, j: k })) render();
  }

  // ---------- pointer: tap a gap or number, drag across numbers for a bracket, tap a bracket ----------
  function tileAt(x, y) {
    var el = document.elementFromPoint(x, y);
    while (el && el !== boardEl && !(el.dataset && el.dataset.i !== undefined && el.classList.contains("num"))) el = el.parentElement;
    return el && el !== boardEl ? +el.dataset.i : -1;
  }
  lineEl.addEventListener("pointerdown", function (e) {
    var k = tileAt(e.clientX, e.clientY); if (k < 0 || state.done) return;
    kbd = false; drag = { from: k, to: k, id: e.pointerId };
    e.preventDefault();
  });
  window.addEventListener("pointermove", function (e) {
    if (!drag || e.pointerId !== drag.id) return;
    var k = tileAt(e.clientX, e.clientY);
    if (k >= 0 && k !== drag.to) { drag.to = k; render(); }
  });
  window.addEventListener("pointerup", function (e) {
    if (!drag || e.pointerId !== drag.id) return;
    var d = drag; drag = null;
    var k = tileAt(e.clientX, e.clientY); if (k < 0) k = d.to;
    cursor = 2 * k;
    if (k !== d.from) { if (!doEdit({ k: "br", i: d.from, j: k })) render(); return; }
    if (bracketMode || anchor >= 0) return pickTile(k);
    if (!doEdit({ k: "un", i: k }, true)) render();
  });
  window.addEventListener("pointercancel", function () { if (drag) { drag = null; render(); } });
  lineEl.addEventListener("click", function (e) {
    var g = e.target.closest && e.target.closest(".gp"); if (!g) return;
    cursor = 2 * +g.dataset.g + 1; kbd = false;
    if (!doEdit({ k: "gap", i: +g.dataset.g }, true)) render();
  });
  barsEl.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest(".bar"); if (!b || b.dataset.x === undefined) return;
    doEdit({ k: "bu", x: +b.dataset.x });
  });
  $("brk").addEventListener("click", function () { bracketMode = !bracketMode; anchor = -1; note = ""; render(); });
  // Clear asks first once the line has something on it: getting it back would cost an Undo charge
  var clearArmed = null;
  function disarmClear() { if (clearArmed) clearTimeout(clearArmed); clearArmed = null; $("clear").textContent = "Clear"; }
  $("clear").addEventListener("click", function () {
    if (state.done || E.sameM(state.cur, E.blank(state.cur.u.length))) return disarmClear();
    if (!clearArmed) { K.clearToast(); $("clear").textContent = "Sure? Clear"; clearArmed = setTimeout(disarmClear, 3000); return; }
    disarmClear(); anchor = -1; bracketMode = false; doEdit({ k: "clear" }, true);
  });
  $("next").addEventListener("click", nextLine);
  // Show answer: two taps (it ends a Climb run), no blocking confirm() dialog; the first tap says what it costs
  var revealArmed = null;
  function disarmReveal() {
    if (revealArmed) { clearTimeout(revealArmed); note = ""; }
    revealArmed = null; $("reveal").textContent = "Show answer";
  }
  $("reveal").addEventListener("click", function () {
    var b = $("reveal");
    if (!revealArmed) {
      var climb = state.mode === "climb";
      K.clearToast(); // a toast must never hide this warning (round 2: a Hint toast covered it and a run was lost)
      b.textContent = climb ? "Sure? Ends run" : "Sure? Show it";
      note = climb ? "This ends the Climb run. Tap again to show it." : "This gives up the line. Tap again to show it.";
      render();
      var asked = note;
      revealArmed = setTimeout(function () { revealArmed = null; b.textContent = "Show answer"; if (note === asked) { note = ""; render(); } }, 3000); return;
    }
    disarmReveal(); note = "";
    var r = E.reveal(state); if (!r.ok) return;
    state = r.state; anchor = -1; bracketMode = false; persist(); render();
  });
  $("again").addEventListener("click", again);
  Array.prototype.forEach.call($("modes").children, function (b) { b.addEventListener("click", function () { setMode(b.dataset.mode); }); });
  K.twoStep($("new"), function () { return state.edits > 0 && !state.over; }, startNew);

  // ---------- keyboard: arrows move, Space/Up/Down cycle, type + - x / j . r ! ( ) ----------
  var OPKEY = { "+": "+", "-": "-", "*": "*", "x": "*", "X": "*", "/": "/", "j": "j", ".": "." };
  window.addEventListener("keydown", function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var n = E.line(state).n.length, max = 2 * n - 2, key = e.key;
    // Enter or Space on a focused button or link is that control's own click, never a game action (R9, R17);
    // a focused link or form field keeps every key (the gaps are buttons, so typing on them still edits)
    var tag = e.target && e.target.tagName;
    if (tag === "A" || tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
    if ((key === "Enter" || key === " ") && tag === "BUTTON") return;
    kbd = true;
    var pi = ["1", "2", "3", "4"].indexOf(key);
    if (pi >= 0) { activate(PW[pi].id); return; }
    if (key === "Escape") { anchor = -1; bracketMode = false; note = ""; render(); return; }
    if (state.over) { if (key === "Enter") { e.preventDefault(); again(); } return; }
    if (state.done) { if (key === "Enter" || key === " ") { e.preventDefault(); nextLine(); } return; }
    var onGap = cursor % 2 === 1, k = Math.floor(cursor / 2);
    if (key === "ArrowLeft" || key === "ArrowRight") { e.preventDefault(); cursor = Math.max(0, Math.min(max, cursor + (key === "ArrowLeft" ? -1 : 1))); render(); return; }
    if (key === " " || key === "Enter" || key === "ArrowUp" || key === "ArrowDown") {
      e.preventDefault(); var dir = key === "ArrowDown" ? -1 : 1;
      if (onGap) doEdit({ k: "gap", i: k, dir: dir }, true); else if (anchor >= 0 || bracketMode) pickTile(k); else doEdit({ k: "un", i: k, dir: dir }, true);
      return;
    }
    if (OPKEY[key]) {
      if ((key === "j" || key === ".") && !E.canJoin(state)) { disarmReveal(); toast("Joining digits arrives at Tier 4", "bad"); return; }
      e.preventDefault();
      var gi = onGap ? k : Math.min(k, n - 2);
      doEdit({ k: "gap", i: gi, op: OPKEY[key] }, true);
      cursor = Math.min(max, 2 * gi + 2); render();
      return;
    }
    var t = k, cu = state.cur.u[t];
    if (key === "r" || key === "s") { doEdit({ k: "un", i: t, u: cu === 0 ? 1 : cu === 1 ? 3 : cu === 2 ? 4 : cu === 3 ? 0 : 2 }, true); return; }
    if (key === "!") { doEdit({ k: "un", i: t, u: [2, 4, 0, 4, 1][cu] }, true); return; }
    if (key === "(") { anchor = t; render(); return; }
    if (key === ")") { if (anchor >= 0) pickTile(t); return; }
    if (key === "Backspace" || key === "Delete") {
      e.preventDefault();
      if (onGap) doEdit({ k: "gap", i: k, op: "" }, true);
      else {
        var inner = state.cur.b.map(function (b, x) { return [b, x]; }).filter(function (p) { return p[0][0] <= t && t <= p[0][1]; })
          .sort(function (a, b) { return (a[0][1] - a[0][0]) - (b[0][1] - b[0][0]); })[0];
        if (cu) doEdit({ k: "un", i: t, u: 0 }, true); else if (inner) doEdit({ k: "br", i: inner[0][0], j: inner[0][1] }, true);
      }
      return;
    }
    if (key === "b") { // cycle the sign of the innermost bracket around the cursor
      var inb = state.cur.b.map(function (b, x) { return [b, x]; }).filter(function (p) { return p[0][0] <= t && t <= p[0][1]; })
        .sort(function (a, b) { return (a[0][1] - a[0][0]) - (b[0][1] - b[0][0]); })[0];
      if (inb) doEdit({ k: "bu", x: inb[1] }, true);
      return;
    }
    if (key === "c") $("clear").click(); // the same two-step as the button
  });

  render();
  // Screenshot hook (tools/shots.cjs): a fixed mid-round state, not reachable from the UI.
  window.__demo = function () {
    var s = E.newGame(2026, "climb");
    var pick = function (n) { var id = E.BANK.findIndex(function (b) { return b.t === 1 && b.n === n; }); var b = E.BANK[id]; return { id: id, t: b.t, n: b.n.split(" "), g: b.g, d: b.d, sol: b.s }; };
    s.lines = ["3 3 3", "2 2 2", "7 7 7", "8 8 8", "1 1 1", "0 0 0"].map(pick);
    s.idx = 3; s.solved = 3; s.edits = 9; s.streak = 0;
    s.cur = { g: ["/", "+"], u: [0, 0, 0], b: [[0, 2, 1]] };
    s.power = { hint: 1, skip: 1, peek: 2, undo: 1 };
    mode = "climb"; drag = null; anchor = -1; bracketMode = false; cursor = 0; state = s; render();
  };
  window.__six = { get state() { return state; }, set state(s) { state = s; render(); }, render: render, E: E,
                   setMode: setMode };
})();
