/* SPDX-License-Identifier: Apache-2.0 | Copyright 2026 alvations (Melon Lab)
 * Numberics Four: browser client. four/engine.js owns every rule (and the computer);
 * this file only draws, listens, and remembers. */
(function () {
  "use strict";
  var F = window.NumbericsFour, K = window.NumbericsKit, P = window.NumbericsPower;
  var store = K.store("numberics_four_v1");
  var COLS = F.COLS, ROWS = F.ROWS;
  var THINK = 380, OVER_DELAY = 1500; // the winning line stays in view before the result card
  var EARN = "Earn charges by blocking a line of three or setting up a ten.";
  var DEFS = [
    { id: "undo", label: "Undo", desc: "Take back your last disc and the computer's reply." },
    { id: "pop", label: "Pop", desc: "Remove any disc; the discs above it drop." },
    { id: "hold", label: "Hold", desc: "Put your next disc aside, or swap it back." },
    { id: "tune", label: "Tune", desc: "Choose your next disc's number." },
  ];
  var RULE = "Four of your colour in a row, or any four in a row that sum to 10 with two of yours.";
  var NAMES = { undo: "Undo", pop: "Pop", hold: "Hold", tune: "Tune" };
  var LEVEL_NAMES = { easy: "Easy", medium: "Medium", hard: "Hard" };

  function okArr(a, max) { return Array.isArray(a) && a.length === COLS * ROWS && a.every(function (v) { return Number.isInteger(v) && v >= 0 && v <= max; }); }
  function okStock(p) { return p && F.POWERS.every(function (n) { return Number.isInteger(p[n]) && p[n] >= 0 && p[n] <= F.CAP; }); }
  function valid(s) {
    return s && okArr(s.own, 2) && okArr(s.num, 4) && (s.turn === 1 || s.turn === 2) && F.LEVELS.indexOf(s.level) >= 0 &&
      Array.isArray(s.next) && Array.isArray(s.held) && Array.isArray(s.bag) && s.bag.length === 2 &&
      Array.isArray(s.power) && okStock(s.power[0]) && okStock(s.power[1]) && Number.isInteger(s.seed);
  }
  function okRec(r) {
    var out = {};
    F.LEVELS.forEach(function (l) { var x = r && r[l]; out[l] = { w: (x && x.w) | 0, l: (x && x.l) | 0, d: (x && x.d) | 0 }; });
    return out;
  }

  var saved = store.load();
  var rec = okRec(saved && saved.rec);
  var level = saved && F.LEVELS.indexOf(saved.level) >= 0 ? saved.level : "medium";
  var state = saved && valid(saved.state) ? saved.state : F.newGame(K.freshSeed(), { level: level });
  var counted = !!(saved && saved.counted);       // this game's result is already in the record
  var nextFirst = saved && saved.nextFirst === 2 ? 2 : 1; // who opens the next game: alternates every game
  var cursor = 3, targeting = null;               // {name}
  var popCur = -1, note = "";                     // Pop's keyboard cursor (a cell); a tray explanation (R5)
  var cpuTimer = null, overTimer = null, fx = null, fxUntil = 0;

  var $ = function (id) { return document.getElementById(id); };
  var boardEl = $("board"), gridEl = $("grid"), slots = [];
  // grid is drawn top row first; slots[cell] with cell = r*7+c, r = 0 the bottom
  for (var vr = ROWS - 1; vr >= 0; vr--) for (var c = 0; c < COLS; c++) {
    var d = document.createElement("div"); d.className = "slot"; gridEl.appendChild(d); slots[vr * COLS + c] = d;
  }

  function persist() { store.save({ state: state, level: level, rec: rec, counted: counted, nextFirst: nextFirst }); }
  // discs are filled by owner (gold yours, cool the computer's); the number is printed on them
  function mini(el, n) { el.textContent = n ? String(n) : "none"; el.classList.toggle("none", !n); }
  function landing(col) { var h = F.height(state.own, col); return h < ROWS ? h * COLS + col : -1; }
  function myTurn() { return !state.over && state.turn === 1; }

  function render() {
    var over = state.over, winCells = {};
    if (over && over.line) over.line.forEach(function (x) { winCells[x] = 1; });
    var ghost = myTurn() && !targeting ? landing(cursor) : -1, popping = targeting && targeting.name === "pop";
    slots.forEach(function (slot, cell) {
      slot.textContent = ""; slot.className = "slot";
      if (!targeting && myTurn() && cell % COLS === cursor) slot.classList.add("aim");
      if (popping && cell === popCur) slot.classList.add("cur");
      var who = state.own[cell], n = state.num[cell];
      if (!who && cell !== ghost) return;
      var disc = document.createElement("div");
      if (who) {
        disc.className = "disc p" + who; disc.textContent = n;
        disc.setAttribute("aria-label", (who === 1 ? "your " : "computer ") + n);
        if (fx && fx.cell === cell && !K.reducedMotion()) { disc.classList.add("fall"); disc.style.setProperty("--drop", ROWS - Math.floor(cell / COLS)); }
        if (winCells[cell]) disc.classList.add("win"); else if (over && over.winner) disc.classList.add("dim");
        if (popping && F.canPop(state, cell)) slot.classList.add("pick");
      } else {
        disc.className = "disc p1 ghost"; disc.textContent = state.next[0];
      }
      slot.appendChild(disc);
    });
    if (fx) fxUntil = Date.now() + 260;
    fx = null;
    mini($("next"), state.next[0]); mini($("held"), state.held[0]); mini($("cnext"), state.next[1]);
    var r = rec[level];
    $("rec").textContent = r.w + "-" + r.l + (r.d ? "-" + r.d : "");
    $("rec").setAttribute("aria-label", LEVEL_NAMES[level] + ": won " + r.w + ", lost " + r.l + ", drawn " + r.d);
    Array.prototype.forEach.call($("levels").children, function (b) {
      b.setAttribute("aria-pressed", String(b.getAttribute("data-level") === level));
    });
    P.tray($("tray"), DEFS, state.power[0], {
      armed: targeting && targeting.name, earn: EARN,
      disabled: function (id) { // R5: a reason, shown in the hint line when the button is tapped
        if (state.over) return id === "undo" ? "Not after a result. Start a new game." : "The game is over.";
        if (state.turn !== 1) return "Wait for the computer's disc.";
        if (id === "undo" && !state.prev) return "Nothing to take back yet.";
        return false;
      },
      onUse: activate,
      onInfo: function (id, text) { targeting = null; note = text; render(); },
    });
    boardEl.classList.toggle("targeting", !!targeting);
    renderHint();
    if (!over) { $("over").hidden = true; clearTimeout(overTimer); overTimer = null; }
  }

  function renderHint() {
    var h = $("hint"); h.textContent = "";
    if (note) { h.textContent = note; return; }
    if (targeting && targeting.name === "pop") { h.textContent = "Tap a disc to pop it, or arrows and Enter. (Esc cancels)"; return; }
    if (targeting && targeting.name === "tune") {
      h.appendChild(document.createTextNode("Your next disc becomes:"));
      var box = document.createElement("span"); box.className = "pick";
      [1, 2, 3, 4].forEach(function (n) {
        var b = document.createElement("button"); b.type = "button"; b.textContent = n;
        b.disabled = n === state.next[0]; b.setAttribute("aria-label", "Tune to " + n);
        b.addEventListener("click", function (e) { e.stopPropagation(); tune(n); });
        box.appendChild(b);
      });
      h.appendChild(box); return;
    }
    if (state.over) return;
    if (state.turn === 2) { h.textContent = state.moves ? "The computer is thinking..." : "The computer opens this game."; return; }
    h.textContent = RULE;
  }

  function showOver() {
    var o = state.over; if (!o) return;
    var title = o.winner === 1 ? "You win" : o.winner === 2 ? "The computer wins" : "Draw";
    // R8: "<Result> · <tally>"; a ten-line spells out its sum so nobody has to add it up
    var how = o.type === "ten" ? o.line.map(function (x) { return state.num[x]; }).join(" + ") + " = 10"
      : o.type === "colour" ? "Four in a row" : "Board full";
    var r = rec[state.level] || rec[level];
    $("over-title").textContent = title;
    $("over-text").textContent = how + " \u00b7 won " + r.w + ", lost " + r.l + (r.d ? ", drawn " + r.d : "");
    var gen = state.moves;
    clearTimeout(overTimer);
    overTimer = setTimeout(function () { overTimer = null; if (state.over && state.moves === gen) $("over").hidden = false; }, OVER_DELAY);
  }
  function finish() {
    if (!state.over || counted) return;
    var r = rec[state.level] || rec[level];
    if (state.over.winner === 1) r.w++; else if (state.over.winner === 2) r.l++; else r.d++;
    counted = true; // R7: the result card is the one channel for the result (no toast)
  }

  // ---- turns ----
  function drop(col) {
    if (!myTurn() || targeting) return;
    var r = F.drop(state, col);
    note = "";
    if (!r.ok) return;
    state = r.state; fx = { cell: r.cell };
    if (r.award) K.toast((r.earned === "block" ? "Blocked! " : "Ten threat! ") + "+" + NAMES[r.award]);
    after();
  }
  function after() {
    if (state.over) { finish(); persist(); render(); showOver(); return; }
    persist(); render();
    if (state.turn === 2) scheduleCpu();
  }
  function scheduleCpu() {
    clearTimeout(cpuTimer);
    var gen = state.moves, seed = state.seed;
    cpuTimer = setTimeout(function () {
      cpuTimer = null;
      if (state.turn !== 2 || state.over || state.moves !== gen || state.seed !== seed) return; // stale
      cpuMove();
    }, THINK);
  }
  function cpuMove() {
    var r = F.computerTurn(state);
    if (!r.actions.length) return;
    var used = r.actions.filter(function (a) { return a.type !== "drop"; }).map(function (a) { return NAMES[a.type]; });
    state = r.state; fx = { cell: r.drop.cell }; note = "";
    if (used.length) K.toast("The computer used " + used.join(" and "), "bad");
    after();
  }
  function flushCpu() { if (cpuTimer !== null) { clearTimeout(cpuTimer); cpuTimer = null; if (state.turn === 2 && !state.over) cpuMove(); } }

  // ---- power-ups ----
  function activate(name) {
    flushCpu(); note = "";
    if (targeting && targeting.name === name) { targeting = null; return render(); }
    targeting = null;
    if (name === "undo") { // R1: the engine refuses Undo once the game has a result, so a result is counted once
      var u = F.use(state, "undo");
      if (u.ok) { state = u.state; persist(); K.toast("Took back both moves"); }
      return render();
    }
    if (!myTurn() || !state.power[0][name]) return render();
    if (name === "hold") {
      var h = F.use(state, "hold");
      if (h.ok) { state = h.state; persist(); K.toast("Holding a " + state.held[0]); }
      return render();
    }
    targeting = { name: name };
    if (name === "pop") { var h = F.height(state.own, cursor); popCur = (h ? h - 1 : 0) * COLS + cursor; }
    render();
  }
  function tune(n) {
    var r = F.use(state, "tune", n);
    if (r.ok) { state = r.state; targeting = null; persist(); K.toast("Next disc: " + n); render(); }
  }
  function pop(cell) {
    if (!state.own[cell]) return;
    var r = F.use(state, "pop", cell);
    if (r.ok) { state = r.state; targeting = null; persist(); K.toast("Pop!"); }
    else K.toast("That pop would complete a line", "bad");
    render();
  }
  function movePop(dc, dr) { // R9: the Pop cursor walks the cells; Enter pops the disc under it
    var c = (popCur % COLS + dc + COLS) % COLS, r = Math.max(0, Math.min(ROWS - 1, Math.floor(popCur / COLS) + dr));
    popCur = r * COLS + c; render();
  }

  // ---- input ----
  function where(ev) {
    var g = gridEl.getBoundingClientRect(), x = ev.clientX - g.left, y = ev.clientY - g.top;
    var c = Math.floor(x / g.width * COLS), vr = Math.floor(y / g.height * ROWS);
    if (c < 0 || c >= COLS) return null;
    return { col: c, cell: vr >= 0 && vr < ROWS ? (ROWS - 1 - vr) * COLS + c : -1 };
  }
  boardEl.addEventListener("click", function (ev) {
    if (ev.target.closest(".over")) return;
    var w = where(ev); if (!w) return;
    if (targeting && targeting.name === "pop") { if (w.cell >= 0) pop(w.cell); return; }
    if (targeting) return;
    cursor = w.col; drop(w.col);
  });
  boardEl.addEventListener("mousemove", function (ev) {
    if (targeting || !myTurn() || Date.now() < fxUntil) return; // never restart a falling disc
    var w = where(ev); if (w && w.col !== cursor) { cursor = w.col; render(); }
  });
  window.addEventListener("keydown", function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === "Escape") { if (targeting) { targeting = null; render(); } return; }
    var digit = ["1", "2", "3", "4"].indexOf(e.key);
    if (targeting && targeting.name === "tune" && digit >= 0) { tune(digit + 1); return; }
    if (digit >= 0 || e.key === "u" || e.key === "U") { // keys act like a tap: an unusable slot explains itself
      var id = digit >= 0 ? F.POWERS[digit] : "undo", b = $("tray").children[F.POWERS.indexOf(id)];
      if (b) b.click(); return;
    }
    var tag = (e.target && e.target.tagName) || "";
    if (targeting && targeting.name === "pop") {
      var mv = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[e.key];
      if (mv) { e.preventDefault(); movePop(mv[0], mv[1]); }
      else if ((e.key === "Enter" || e.key === " ") && tag !== "BUTTON") { e.preventDefault(); pop(popCur); }
      return;
    }
    if (targeting) return;
    if (e.key === "ArrowLeft" || e.key === "a") { e.preventDefault(); cursor = (cursor + COLS - 1) % COLS; render(); }
    else if (e.key === "ArrowRight" || e.key === "d") { e.preventDefault(); cursor = (cursor + 1) % COLS; render(); }
    else if (e.key === "ArrowDown" || e.key === "s" || ((e.key === "Enter" || e.key === " ") && tag !== "BUTTON")) { e.preventDefault(); drop(cursor); }
  });

  // ---- new game and difficulty ----
  function inProgress() { return state.moves > 0 && !state.over; }
  function startNew(lv) {
    clearTimeout(cpuTimer); cpuTimer = null; clearTimeout(overTimer); overTimer = null;
    targeting = null; note = ""; level = lv || level; counted = false; cursor = 3;
    state = F.newGame(K.freshSeed(), { level: level, first: nextFirst });
    nextFirst = 3 - nextFirst; // the opener alternates game to game
    persist(); render();
    if (state.turn === 2) scheduleCpu();
  }
  K.twoStep($("new"), inProgress, function () { startNew(); }, "Sure? This ends the game");
  $("again").addEventListener("click", function () { startNew(); });
  // R10: a level switch mid-game uses the same two-step "Sure?" as New game
  Array.prototype.forEach.call($("levels").children, function (b) {
    var lv = b.getAttribute("data-level");
    K.twoStep(b, function () { return lv !== level && inProgress(); }, function () {
      if (lv === level && !state.over) return;
      startNew(lv);
    }, "Sure?");
  });

  render();
  if (state.over) { $("over").hidden = false; showOver(); }
  else if (state.turn === 2) scheduleCpu();

  // Screenshot hook (tools/shots.cjs): a fixed, representative mid-game. Not reachable from the UI.
  window.__demo = function () {
    clearTimeout(cpuTimer); cpuTimer = null; targeting = null;
    var s = F.newGame(2046, { level: "medium" }), mine = [3, 1, 3, 4, 3, 6, 4];
    for (var k = 0; k < mine.length && !s.over; k++) {
      var r = F.drop(s, mine[k]); if (!r.ok || r.state.over) break; s = r.state;
      if (s.turn === 2) { var t = F.computerTurn(s); if (t.state.over) break; s = t.state; }
    }
    s.power[0] = { undo: 1, pop: 1, hold: 1, tune: 2 }; s.held[0] = 4;
    state = s; level = "medium"; cursor = 5; render();
  };
  window.__four = {
    get state() { return state; },
    set state(s) { clearTimeout(cpuTimer); cpuTimer = null; state = s; targeting = null; render(); if (!s.over && s.turn === 2) scheduleCpu(); },
    render: render, cpu: flushCpu,
  };
})();
