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
  var RULE = "Four of yours in a row, or four that make ten with two of yours."; // the hint band holds two lines
  // round 3 (cold blocker, critic #1): what a drop would open, said in the hint line for the aimed column
  var MARK = { above: "Dropping here lets the computer win on top of it.", any: "Dropping here lets the computer win.",
               some: "Red dashed ring: dropping there lets the computer win.", two: "Two blue rings: the computer can win in two places." };
  var SHOW_THREATS = { easy: true, medium: true, hard: false }; // round 2 (cold #5): Hard keeps its ambushes
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
  var popCur = -1, note = "";                     // Pop's keyboard cursor (a cell); a tray explanation (R5)
  var cpuTimer = null, overTimer = null, fx = null, fxUntil = 0;
  var viewing = false;                            // R13: the end card is hidden to look at the board

  var $ = function (id) { return document.getElementById(id); };
  var boardEl = $("board"), gridEl = $("grid"), slots = [];
  // grid is drawn top row first; slots[cell] with cell = r*7+c, r = 0 the bottom
  for (var vr = ROWS - 1; vr >= 0; vr--) for (var c = 0; c < COLS; c++) {
    var d = document.createElement("div"); d.className = "slot"; gridEl.appendChild(d); slots[vr * COLS + c] = d;
  }

  function persist() { store.save({ state: state, level: level, rec: rec, counted: counted }); }
  // discs are filled by owner (gold yours, cool the computer's); the number is printed on them
  function mini(el, n) { el.textContent = n ? String(n) : "none"; el.classList.toggle("none", !n); }
  function landing(col) { var h = F.height(state.own, col); return h < ROWS ? h * COLS + col : -1; }
  function myTurn() { return !state.over && state.turn === 1; }
  // the columns your drop would open for the computer (Easy and Medium, your turn, not while aiming a power-up)
  function warn() { return SHOW_THREATS[state.level] && myTurn() && !targeting ? F.opens(state) : {}; }
  function ringsInReach() {
    var th = F.threats(state); return th.filter(function (x) { return landing(x % COLS) === x; }).length;
  }

  function render() {
    var over = state.over, winCells = {};
    if (over && over.line) over.line.forEach(function (x) { winCells[x] = 1; });
    var ghost = myTurn() && !targeting ? landing(cursor) : -1, popping = targeting && targeting.name === "pop";
    var threat = {}, marks = warn(), risky = {}, opened = {};
    if (SHOW_THREATS[state.level] && !over) F.threats(state).forEach(function (x) { threat[x] = 1; });
    Object.keys(marks).forEach(function (c) { risky[landing(+c)] = 1; });
    if (ghost >= 0 && marks[cursor]) marks[cursor].cells.forEach(function (x) { opened[x] = 1; });
    slots.forEach(function (slot, cell) {
      slot.textContent = ""; slot.className = "slot";
      if (threat[cell]) { slot.classList.add("threat"); slot.setAttribute("aria-label", "the computer's next disc wins here"); }
      else if (risky[cell]) { slot.classList.add("risky"); slot.setAttribute("aria-label", "dropping here lets the computer win"); }
      else if (opened[cell]) { slot.classList.add("opens"); slot.setAttribute("aria-label", "your drop would let the computer win here"); }
      else slot.removeAttribute("aria-label");
      if (threat[cell] && opened[cell]) slot.classList.add("opens");
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
    var r = rec[level], none = !(r.w || r.l || r.d);
    $("rec").textContent = none ? "none" : r.w + "-" + r.l + (r.d ? "-" + r.d : "");
    $("rec").classList.toggle("none", none); // R11/R16: an empty record is a dimmed "none"
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
    $("new").style.visibility = over ? "hidden" : ""; // the card's New game is the one; the space is kept
    renderHint();
    if (!over) { viewing = false; $("over").hidden = true; clearTimeout(overTimer); overTimer = null; }
    else if (viewing) $("over").hidden = true;
  }

  function renderHint() {
    var h = $("hint"); h.textContent = "";
    if (note) { h.textContent = note; return; }
    if (targeting && targeting.name === "pop") { h.textContent = "Tap a disc to pop it (Esc cancels)"; return; }
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
    if (state.over) { if (viewing) h.textContent = "Tap the board for the summary."; return; }
    if (state.turn === 2) { h.textContent = state.moves ? "The computer is thinking\u2026" : "The computer opens this game."; return; }
    if (!SHOW_THREATS[state.level]) { h.textContent = RULE; return; }
    var marks = warn(), m = marks[cursor], reach = ringsInReach();
    h.textContent = m ? (m.above ? MARK.above : MARK.any) : reach >= 2 ? MARK.two
      : F.threats(state).length ? "Blue ring: the computer's next disc would win there."
      : Object.keys(marks).length ? MARK.some : RULE;
  }

  function showOver() {
    var o = state.over; if (!o) return;
    var title = o.winner === 1 ? "You win" : o.winner === 2 ? "The computer wins" : "Draw";
    viewing = false;
    // R8: "<Result> · <tally>"; a ten-line spells out its sum so nobody has to add it up
    var how = o.type === "ten" ? o.line.map(function (x) { return state.num[x]; }).join(" + ") + " = 10"
      : o.type === "colour" ? "Four in a row" : "Board full";
    var r = rec[state.level] || rec[level];
    $("over-title").textContent = title;
    // R16: the tally reads "You 2 : 1 Computer" (this level's record)
    $("over-text").textContent = how + " \u00b7 You " + r.w + " : " + r.l + " Computer" + (r.d ? " \u00b7 " + r.d + " drawn" : "");
    var gen = state.moves;
    clearTimeout(overTimer);
    // R13: the winning line shows on the bare board first, then the card
    overTimer = setTimeout(function () { overTimer = null; if (state.over && state.moves === gen && !viewing) card(); }, OVER_DELAY);
  }
  function card() { // one end-card pattern: the card shows and its primary button takes the focus
    $("over").hidden = false; $("again").focus({ preventScroll: true });
  }
  function view(on) { // R13: "See the board" hides the card; a tap on the board or Esc brings it back
    viewing = on; note = "";
    if (!on) { clearTimeout(overTimer); overTimer = null; }
    render();
    if (!on && state.over) card();
    else boardEl.focus();
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
    var what = r.earned === "block" ? "Blocked! " : "Ten threat! ";
    if (r.award) K.toast(what + "+" + NAMES[r.award]);
    else if (r.free) K.toast(what + "No reward right after a power-up.", "info"); // R2
    else if (r.full) K.toast(what + "Power-ups full", "info"); // R15
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
    note = used.length ? "The computer used " + used.join(" and ") + "." : ""; // R14: announced in the hint line
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
    if (state.over) { if (viewing) view(false); return; }
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
    var tag = (e.target && e.target.tagName) || "";
    if (e.key === "Escape") { if (targeting) { targeting = null; render(); } else if (viewing) view(false); return; }
    // R17: a key on a focused link or form control belongs to that control (Enter on a games-row link navigates)
    if (tag === "A" || tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
    if (viewing && (e.key === "Enter" || e.key === " ") && tag !== "BUTTON") { e.preventDefault(); view(false); return; }
    var digit = ["1", "2", "3", "4"].indexOf(e.key);
    if (targeting && targeting.name === "tune" && digit >= 0) { tune(digit + 1); return; }
    if (digit >= 0 || e.key === "u" || e.key === "U") { // keys act like a tap: an unusable slot explains itself
      var id = digit >= 0 ? F.POWERS[digit] : "undo", b = $("tray").children[F.POWERS.indexOf(id)];
      if (b) b.click(); return;
    }
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
  function mine() { return state.own.some(function (v) { return v === 1; }); }
  // you have dropped a disc in this game (an Undo or a Pop that cleared it does not undo having played)
  function inProgress() { return !state.over && (mine() || !!state.prev || state.used[0] > 0); }
  function startNew(lv) {
    clearTimeout(cpuTimer); cpuTimer = null; clearTimeout(overTimer); overTimer = null;
    // R12: quitting a live game you have dropped in counts as a loss (on the level it was played at)
    var quit = inProgress() && !counted;
    if (quit) { (rec[state.level] || rec[level]).l++; counted = true; }
    // the opener alternates only after a game that counted, so New game can never re-roll who opens
    var first = state.over || counted ? 3 - (state.first || 1) : (state.first || 1);
    targeting = null; note = ""; level = lv || level; counted = false; cursor = 3; viewing = false;
    state = F.newGame(K.freshSeed(), { level: level, first: first });
    persist(); render();
    if (quit) K.toast("Counted as a loss", "bad");
    if (state.turn === 2) scheduleCpu();
  }
  var QUIT = "Sure? Counts as a loss";
  K.twoStep($("new"), inProgress, function () { startNew(); }, QUIT);
  $("again").addEventListener("click", function () { startNew(); });
  // R10/R12: a level switch mid-game uses the same two-step "Sure?" as New game. The level button is too narrow
  // for the whole warning at 320px, so it says "Sure?" and the hint line says what it costs.
  var LEVEL_QUIT = "Sure? Switching level counts this game as a loss.", levelNoteT = null;
  Array.prototype.forEach.call($("levels").children, function (b) {
    var lv = b.getAttribute("data-level");
    K.twoStep(b, function () {
      var risky = lv !== level && inProgress();
      if (risky) {
        note = LEVEL_QUIT; renderHint(); clearTimeout(levelNoteT);
        levelNoteT = setTimeout(function () { if (note === LEVEL_QUIT) { note = ""; renderHint(); } }, 3000); // as the button disarms
      }
      return risky;
    }, function () {
      if (lv === level && !state.over) return;
      startNew(lv);
    }, "Sure?");
  });
  $("over-view").addEventListener("click", function () { view(true); });

  render();
  if (state.over) { showOver(); clearTimeout(overTimer); overTimer = null; card(); }
  else if (state.turn === 2) scheduleCpu();

  // Screenshot hook (tools/shots.cjs): a fixed, representative mid-game. Not reachable from the UI.
  window.__demo = function () {
    clearTimeout(cpuTimer); cpuTimer = null; targeting = null;
    var s = F.newGame(2051, { level: "medium" }), mine = [3, 1, 3, 4, 3, 6, 4]; // a seed whose whole line plays out
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
    render: render, cpu: flushCpu, get viewing() { return viewing; }, get rec() { return rec; },
  };
})();
