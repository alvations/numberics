/* SPDX-License-Identifier: Apache-2.0 | Copyright 2026 alvations (Melon Lab)
 * Numberics Four: browser client. four/engine.js owns every rule (and the computer);
 * this file only draws, listens, and remembers. */
(function () {
  "use strict";
  var F = window.NumbericsFour, K = window.NumbericsKit, P = window.NumbericsPower;
  var store = K.store("numberics_four_v1");
  var COLS = F.COLS, ROWS = F.ROWS;
  var THINK = 380, OVER_DELAY = 900;
  var DEFS = [
    { id: "undo", label: "Undo", title: "Take back your last move and the computer's reply" },
    { id: "pop", label: "Pop", title: "Remove any disc; the column drops" },
    { id: "hold", label: "Hold", title: "Swap your next disc with your held one" },
    { id: "tune", label: "Tune", title: "Set your next disc's number" },
  ];
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
  var cursor = 3, targeting = null;               // {name}
  var cpuTimer = null, overTimer = null, fx = null, fxUntil = 0, levelArmed = null;

  var $ = function (id) { return document.getElementById(id); };
  var boardEl = $("board"), gridEl = $("grid"), slots = [];
  // grid is drawn top row first; slots[cell] with cell = r*7+c, r = 0 the bottom
  for (var vr = ROWS - 1; vr >= 0; vr--) for (var c = 0; c < COLS; c++) {
    var d = document.createElement("div"); d.className = "slot"; gridEl.appendChild(d); slots[vr * COLS + c] = d;
  }

  function persist() { store.save({ state: state, level: level, rec: rec, counted: counted }); }
  function paint(el, n) {
    el.classList.remove("lo", "lo2");
    if (n === 1) el.classList.add("lo"); else if (n === 2) el.classList.add("lo2");
    el.style.setProperty("--h", K.hue(n));
  }
  function mini(el, n) {
    el.textContent = n ? String(n) : "-"; el.classList.toggle("none", !n);
    if (n) paint(el, n); else el.classList.remove("lo", "lo2");
  }
  function landing(col) { var h = F.height(state.own, col); return h < ROWS ? h * COLS + col : -1; }
  function myTurn() { return !state.over && state.turn === 1; }

  function render() {
    var over = state.over, winCells = {};
    if (over && over.line) over.line.forEach(function (x) { winCells[x] = 1; });
    var ghost = myTurn() && !targeting ? landing(cursor) : -1;
    slots.forEach(function (slot, cell) {
      slot.textContent = ""; slot.className = "slot";
      if (!targeting && myTurn() && cell % COLS === cursor) slot.classList.add("aim");
      var who = state.own[cell], n = state.num[cell];
      if (!who && cell !== ghost) return;
      var disc = document.createElement("div");
      if (who) {
        disc.className = "disc p" + who; paint(disc, n); disc.textContent = n;
        disc.setAttribute("aria-label", (who === 1 ? "your " : "computer ") + n);
        if (fx && fx.cell === cell && !K.reducedMotion()) { disc.classList.add("fall"); disc.style.setProperty("--drop", ROWS - Math.floor(cell / COLS)); }
        if (winCells[cell]) disc.classList.add("win");
        if (targeting && targeting.name === "pop" && F.canPop(state, cell)) slot.classList.add("pick");
      } else {
        disc.className = "disc p1 ghost"; paint(disc, state.next[0]); disc.textContent = state.next[0];
      }
      slot.appendChild(disc);
    });
    if (fx) fxUntil = Date.now() + 260;
    fx = null;
    mini($("next"), state.next[0]); mini($("held"), state.held[0]); mini($("cnext"), state.next[1]);
    var r = rec[level];
    $("rec").textContent = "Won " + r.w + " · Lost " + r.l + (r.d ? " · Drawn " + r.d : "");
    Array.prototype.forEach.call($("levels").children, function (b) {
      b.setAttribute("aria-pressed", String(b.getAttribute("data-level") === level));
    });
    P.tray($("tray"), DEFS, state.power[0], {
      armed: targeting && targeting.name,
      disabled: function (id) {
        if (id === "undo") return !state.prev || (!state.over && state.turn !== 1);
        return !myTurn();
      },
      onUse: activate,
    });
    boardEl.classList.toggle("targeting", !!targeting);
    renderHint();
    if (!over) { $("over").hidden = true; clearTimeout(overTimer); overTimer = null; }
  }

  function renderHint() {
    var h = $("hint"); h.textContent = "";
    if (targeting && targeting.name === "pop") { h.textContent = "Tap a disc to pop it. (Esc cancels)"; return; }
    if (targeting && targeting.name === "tune") {
      h.appendChild(document.createTextNode("Your next disc becomes:"));
      var box = document.createElement("span"); box.className = "pick";
      [1, 2, 3, 4].forEach(function (n) {
        var b = document.createElement("button"); b.type = "button"; b.textContent = n; paint(b, n);
        b.disabled = n === state.next[0]; b.setAttribute("aria-label", "Tune to " + n);
        b.addEventListener("click", function (e) { e.stopPropagation(); tune(n); });
        box.appendChild(b);
      });
      h.appendChild(box); return;
    }
    if (state.over) return;
    if (state.turn === 2) { h.textContent = "The computer is thinking..."; return; }
    h.textContent = state.moves < 2 ? "Four of your colour, or any four that sum to 10." : "";
  }

  function showOver() {
    var o = state.over; if (!o) return;
    var title = o.winner === 1 ? "You win" : o.winner === 2 ? "The computer wins" : "Draw";
    var how = o.type === "ten" ? "A ten-line" : o.type === "colour" ? "Four in a row" : "The board is full";
    $("over-title").textContent = title;
    var used = state.used[0];
    $("over-text").textContent = how + " after " + state.moves + " discs" +
      (used ? " \u00b7 " + used + " power-up" + (used > 1 ? "s" : "") + " used" : "") + ".";
    var gen = state.moves;
    clearTimeout(overTimer);
    overTimer = setTimeout(function () { overTimer = null; if (state.over && state.moves === gen) $("over").hidden = false; }, OVER_DELAY);
  }
  function finish() {
    if (!state.over || counted) return;
    var r = rec[state.level] || rec[level];
    if (state.over.winner === 1) r.w++; else if (state.over.winner === 2) r.l++; else r.d++;
    counted = true;
    K.toast(state.over.winner === 1 ? (state.over.type === "ten" ? "Ten!" : "Four in a row!") : state.over.winner === 2 ? "The computer got there first" : "A draw");
  }

  // ---- turns ----
  function drop(col) {
    if (!myTurn() || targeting) return;
    var r = F.drop(state, col);
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
    state = r.state; fx = { cell: r.drop.cell };
    if (used.length) K.toast("The computer used " + used.join(" and "));
    after();
  }
  function flushCpu() { if (cpuTimer !== null) { clearTimeout(cpuTimer); cpuTimer = null; if (state.turn === 2 && !state.over) cpuMove(); } }

  // ---- power-ups ----
  function activate(name) {
    flushCpu();
    if (targeting && targeting.name === name) { targeting = null; return render(); }
    targeting = null;
    if (name === "undo") {
      var u = F.use(state, "undo");
      if (u.ok) { state = u.state; counted = false; persist(); K.toast("Took back both moves"); }
      return render();
    }
    if (!myTurn() || !state.power[0][name]) return render();
    if (name === "hold") {
      var h = F.use(state, "hold");
      if (h.ok) { state = h.state; persist(); K.toast("Holding a " + state.held[0]); }
      return render();
    }
    targeting = { name: name }; render();
  }
  function tune(n) {
    var r = F.use(state, "tune", n);
    if (r.ok) { state = r.state; targeting = null; persist(); K.toast("Next disc: " + n); render(); }
  }
  function pop(cell) {
    var r = F.use(state, "pop", cell);
    if (r.ok) { state = r.state; targeting = null; persist(); K.toast("Pop!"); }
    else K.toast("That pop would complete a line");
    render();
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
    if (digit >= 0) { activate(F.POWERS[digit]); return; }
    if (e.key === "u" || e.key === "U") { activate("undo"); return; }
    if (targeting) return;
    var tag = (e.target && e.target.tagName) || "";
    if (e.key === "ArrowLeft" || e.key === "a") { e.preventDefault(); cursor = (cursor + COLS - 1) % COLS; render(); }
    else if (e.key === "ArrowRight" || e.key === "d") { e.preventDefault(); cursor = (cursor + 1) % COLS; render(); }
    else if (e.key === "ArrowDown" || e.key === "s" || ((e.key === "Enter" || e.key === " ") && tag !== "BUTTON")) { e.preventDefault(); drop(cursor); }
  });

  // ---- new game and difficulty ----
  function inProgress() { return state.moves > 0 && !state.over; }
  function startNew(lv) {
    clearTimeout(cpuTimer); cpuTimer = null; clearTimeout(overTimer); overTimer = null;
    targeting = null; level = lv || level; counted = false; cursor = 3;
    state = F.newGame(K.freshSeed(), { level: level }); persist(); render();
  }
  K.twoStep($("new"), inProgress, function () { startNew(); }, "Sure? This ends the game");
  $("again").addEventListener("click", function () { startNew(); });
  Array.prototype.forEach.call($("levels").children, function (b) {
    b.addEventListener("click", function () {
      var lv = b.getAttribute("data-level");
      if (lv === level && !state.over) return;
      if (inProgress() && levelArmed !== lv) {
        levelArmed = lv; K.toast("Tap " + LEVEL_NAMES[lv] + " again for a new game");
        setTimeout(function () { if (levelArmed === lv) levelArmed = null; }, 3000); return;
      }
      levelArmed = null; startNew(lv);
    });
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
