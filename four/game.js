/* SPDX-License-Identifier: Apache-2.0 | Copyright 2026 alvations (Melon Lab)
 * Numberics Four: browser client. four/engine.js owns every rule (and the computer); this file only draws, listens, and
 * remembers. Motion (REDESIGN.md 5.5) and the sound rule (TRIAGE4 D7): docs/CODE-NOTES.md#fourgamejs */
(function () {
  "use strict";
  var F = window.NumbericsFour, K = window.NumbericsKit, P = window.NumbericsPower, M = window.NumbericsMotion;
  var TR = window.NumbericsTrophies, NP = window.NumbericsProgress;
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
  var RULE = "Four in a row, or four that make ten."; // one line on every phone (O-14); How to play has the rest
  // round 3 (cold blocker, critic #1): what a drop would open, said in the hint line for the aimed column
  var MARK = { above: "Dropping here lets the computer win on top of it.", any: "Dropping here lets the computer win.",
               some: "Red dashed ring: dropping there lets the computer win.", two: "Two blue rings: the computer can win in two places." };
  var SHOW_THREATS = { easy: true, medium: true, hard: false }; // round 2 (cold #5): Hard keeps its ambushes
  var NAMES = { undo: "Undo", pop: "Pop", hold: "Hold", tune: "Tune" };
  var LEVEL_NAMES = { easy: "Easy", medium: "Medium", hard: "Hard" };

  // sounds and haptics never break the page (a missing module costs a nicety)
  var sfx = M.sfx; // the shared call (shared/motion.js)
  function duck(on) { try { if (window.NumbericsMusic) window.NumbericsMusic.duck(on); } catch (e) { /* silent */ } }
  function sheetOpen() { try { return !!(window.NumbericsUI && window.NumbericsUI.open()); } catch (e) { return false; } }

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
  // REDESIGN.md 1.3: a first visit (no saved state) starts on Easy; a saved choice is always kept
  var level = saved && F.LEVELS.indexOf(saved.level) >= 0 ? saved.level : "easy";
  var state = saved && valid(saved.state) ? saved.state : F.newGame(K.freshSeed(), { level: level });
  var counted = !!(saved && saved.counted);       // this game's result is already in the record
  var cursor = 3, targeting = null;               // {name}
  var popCur = -1, note = "";                     // Pop's keyboard cursor (a cell); a tray explanation (R5)
  var cpuTimer = null, overTimer = null;
  var viewing = false;                            // R13: the end card is hidden to look at the board
  var lineShown = !!state.over;                   // the winning line (ring, dim, SVG line) shows once the disc lands
  var troIds = [], troSaid = false;               // trophies earned by this game's end, shown as pills on the card

  var $ = function (id) { return document.getElementById(id); };
  var boardEl = $("board"), gridEl = $("grid"), discsEl = $("discs"), lineEl = $("winline"), slots = [];
  // grid is drawn top row first; slots[cell] with cell = r*7+c, r = 0 the bottom
  for (var vr = ROWS - 1; vr >= 0; vr--) for (var c = 0; c < COLS; c++) {
    var d = document.createElement("div"); d.className = "slot"; gridEl.appendChild(d); slots[vr * COLS + c] = d;
  }
  // the aimed column's preview disc: one node, moved between slots, never rebuilt
  var ghostEl = document.createElement("div"); ghostEl.className = "disc p1 ghost"; ghostEl.setAttribute("aria-hidden", "true");

  // ---- the keyed disc layer (NumbericsMotion). ids[cell] is the client's identity map, never in the save ----
  var ids = [], nextId = 1;
  var layer = M.layer(discsEl, {
    cols: COLS, rows: ROWS, // clipped at the top edge only (style.css), so rings on the outer discs show
    make: function () {
      var t = document.createElement("div"), f = document.createElement("div");
      f.className = "face"; t.appendChild(f); return t;
    },
    paint: function (node, t) {
      var f = node.firstChild;
      f.className = "face disc p" + t.who; f.textContent = t.n;
      f.setAttribute("aria-label", (t.who === 1 ? "your " : "computer ") + t.n);
    }
  });
  function tilesOf() {
    var out = [];
    for (var cell = 0; cell < COLS * ROWS; cell++) if (state.own[cell])
      out.push({ id: ids[cell], r: ROWS - 1 - Math.floor(cell / COLS), c: cell % COLS, who: state.own[cell], n: state.num[cell] });
    return out;
  }
  // every disc gets a fresh identity (New game, load, a forged state): the layer swaps nodes without a fall
  function rekey(fade) {
    ids = [];
    for (var cell = 0; cell < COLS * ROWS; cell++) if (state.own[cell]) ids[cell] = nextId++;
    layer.sync(tilesOf(), { fade: !!fade });
  }
  // the slots travelled: from one slot above the top row down to the landing row
  function rowsTo(cell) { return ROWS - Math.floor(cell / COLS); }
  // Pop at a cell: the popped disc fades out, every disc above it drops one slot. Returns the fx parts.
  function popIds(cell) {
    var col = cell % COLS, out = [], falls = [];
    if (ids[cell]) out.push(ids[cell]);
    for (var r = Math.floor(cell / COLS); r < ROWS; r++) {
      var up = r + 1 < ROWS ? ids[(r + 1) * COLS + col] : 0;
      ids[r * COLS + col] = up || 0;
      if (up) falls.push({ id: up, rows: 1 });
    }
    return { out: out, falls: falls };
  }

  // ---- timelines: `beats` holds visual steps, `sounds` holds sounds; a new input runs both now, the sounds one of each ----
  var beats = M.seq(), sounds = M.seq(), lineAnim = null;
  function settle() { // REDESIGN.md 5.11: the end state now, then the new input is applied
    var running = layer.busy() || beats.busy() || sounds.busy();
    layer.finish(); M.together(function () { beats.finish(); sounds.finish(running); });
    if (lineAnim) { try { lineAnim.finish(); } catch (e) { /* gone */ } lineAnim = null; }
  }
  // a disc lands after its fall: the land sound and tap at impact; the reward chime; the line for a winning drop
  function landed(rows, r) {
    var t = M.reduced() ? 0 : M.fallMs(rows);
    sounds.sound(t, function () { sfx("land"); sfx("buzz", "tap"); if (r.award) sfx("power"); });
    if (r.win || (state.over && state.over.winner === 0)) {
      lineShown = false;
      beats.at(t, function () {
        lineShown = true; renderBoard(); drawLine(true);
        if (state.over && state.over.winner === 1) { sfx("win"); sfx("buzz", "win"); }
        else if (state.over && state.over.winner === 2) { sfx("lose"); sfx("buzz", "lose"); }
      });
    }
  }

  // ---- the winning line: an SVG line through the four disc centres, drawn once the disc has landed ----
  function hideLine() { lineEl.setAttribute("hidden", ""); lineEl.textContent = ""; }
  function drawLine(animate) {
    var o = state.over;
    if (!o || !o.winner || !o.line || o.line.length < 2) return hideLine();
    // one measurement per line (REDESIGN.md 5.13): the grid, its gap and the board width
    var W = gridEl.clientWidth, H = gridEl.clientHeight, gap = parseFloat(getComputedStyle(gridEl).columnGap) || 0, B = boardEl.clientWidth;
    if (!W || !H) return hideLine();
    var sw = (W - (COLS - 1) * gap) / COLS, sh = (H - (ROWS - 1) * gap) / ROWS;
    var pts = o.line.map(function (cell) {
      var col = cell % COLS, vrow = ROWS - 1 - Math.floor(cell / COLS);
      return [col * (sw + gap) + sw / 2, vrow * (sh + gap) + sh / 2];
    });
    var a = pts[0], b = pts[pts.length - 1], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    lineEl.setAttribute("viewBox", "0 0 " + W + " " + H);
    lineEl.innerHTML = '<line x1="' + a[0] + '" y1="' + a[1] + '" x2="' + b[0] + '" y2="' + b[1] + '"/>';
    var ln = lineEl.firstChild;
    ln.style.strokeWidth = (B * 0.009).toFixed(2) + "px"; ln.style.strokeDasharray = len; ln.style.strokeDashoffset = "0";
    lineEl.removeAttribute("hidden");
    if (animate) lineAnim = M.play(ln, [{ strokeDashoffset: len }, { strokeDashoffset: 0 }], { duration: M.T.line, easing: M.E.out },
      [{ opacity: 0 }, { opacity: 1 }]);
  }

  function bestText() {
    var r = rec[level];
    return r.w || r.l || r.d ? LEVEL_NAMES[level] + " " + r.w + "-" + r.l + (r.d ? "-" + r.d : "") : "";
  }
  function persist() {
    store.save({ state: state, level: level, rec: rec, counted: counted, run: { used: state.used[0] } });
    try { if (NP) NP.put("four", { best: bestText(), live: inProgress(), liveText: LEVEL_NAMES[state.level] + " game" }); } catch (e) { /* progress is a nicety */ }
  }
  // discs are filled by owner (gold yours, cool the computer's); the number is printed on them
  function mini(el, n) { el.textContent = n ? String(n) : "none"; el.classList.toggle("none", !n); }
  function landing(col) { var h = F.height(state.own, col); return h < ROWS ? h * COLS + col : -1; }
  function myTurn() { return !state.over && state.turn === 1; }
  // the columns your drop would open for the computer (Easy and Medium, your turn, not while aiming a power-up)
  function warn() { return SHOW_THREATS[state.level] && myTurn() && !targeting ? F.opens(state) : {}; }
  function ringsInReach() {
    var th = F.threats(state); return th.filter(function (x) { return landing(x % COLS) === x; }).length;
  }

  // the board's marks: slot classes and the disc classes. Touches classes only; never creates a disc.
  function renderBoard() {
    var over = state.over, winCells = {};
    if (over && over.line) over.line.forEach(function (x) { winCells[x] = 1; });
    var ghost = myTurn() && !targeting ? landing(cursor) : -1, popping = targeting && targeting.name === "pop";
    var threat = {}, marks = warn(), risky = {}, opened = {};
    if (SHOW_THREATS[state.level] && !over) F.threats(state).forEach(function (x) { threat[x] = 1; });
    Object.keys(marks).forEach(function (c) { risky[landing(+c)] = 1; });
    if (ghost >= 0 && marks[cursor]) marks[cursor].cells.forEach(function (x) { opened[x] = 1; });
    var lit = lineShown && over;
    slots.forEach(function (slot, cell) {
      var cls = "slot" + (threat[cell] ? " threat" : "") + (risky[cell] ? " risky" : "") + (opened[cell] ? " opens" : "") +
        (!targeting && myTurn() && cell % COLS === cursor ? " aim" : "") + (popping && cell === popCur ? " cur" : "") +
        (popping && state.own[cell] && F.canPop(state, cell) ? " pick" : "");
      if (slot.className !== cls) slot.className = cls;
      var say = threat[cell] ? "the computer's next disc wins here" : risky[cell] ? "dropping here lets the computer win"
        : opened[cell] ? "your drop would let the computer win here" : "";
      if (say) slot.setAttribute("aria-label", say); else slot.removeAttribute("aria-label");
      var id = state.own[cell] && ids[cell], node = id ? layer.get(id) : null;
      if (node) {
        var f = node.firstChild;
        f.classList.toggle("win", !!(lit && winCells[cell]));
        f.classList.toggle("dim", !!(lit && over.winner && !winCells[cell]));
        f.classList.toggle("pick", !!(popping && slot.classList.contains("pick")));
      }
    });
    if (ghost >= 0) {
      ghostEl.textContent = state.next[0];
      if (ghostEl.parentNode !== slots[ghost]) slots[ghost].appendChild(ghostEl);
    } else if (ghostEl.parentNode) ghostEl.parentNode.removeChild(ghostEl);
  }

  function render() {
    var over = state.over;
    renderBoard();
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
      onInfo: function (id, text) { targeting = null; note = text; sfx("bad"); render(); },
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
      h.appendChild(document.createTextNode("Your next disc:"));
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
    if (state.turn === 2) { h.textContent = state.moves ? "The computer is thinking…" : "The computer opens this game."; return; }
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
    $("over-text").textContent = how + " · You " + r.w + " : " + r.l + " Computer" + (r.d ? " · " + r.d + " drawn" : "");
    try { if (TR) TR.pills($("tro"), troIds); } catch (e) { /* trophies are a nicety */ }
    var gen = state.moves;
    clearTimeout(overTimer);
    // R13: the winning line shows on the bare board first, then the card
    overTimer = setTimeout(function () { overTimer = null; if (state.over && state.moves === gen && !viewing) card(); }, OVER_DELAY);
  }
  function card() { // one end-card pattern: the card shows and its primary button takes the focus
    $("over").hidden = false; $("again").focus({ preventScroll: true });
    duck(true);
    if (troIds.length && !troSaid) { // the unlock moment, on the card (R7: never a toast over it)
      troSaid = true; sfx("trophy"); sfx("buzz", "big");
      try { if (window.NumbericsUI) window.NumbericsUI.dot(true); } catch (e) { /* silent */ }
    }
  }
  function view(on) { // R13: "See the board" hides the card; a tap on the board or Esc brings it back
    viewing = on; note = "";
    if (!on) { clearTimeout(overTimer); overTimer = null; }
    render();
    if (!on && state.over) card();
    else { duck(false); boardEl.focus(); }
  }
  // the game's result: counted once in the record, and reported once to the trophies (REDESIGN.md 8.4)
  function finish(r) {
    if (!state.over || counted) return;
    var o = state.over, rr = rec[state.level] || rec[level];
    if (o.winner === 1) rr.w++; else if (o.winner === 2) rr.l++; else rr.d++;
    counted = true; // R7: the result card is the one channel for the result (no toast)
    var how = r && r.win ? (r.win.both ? "both" : r.win.type) : (o.type === "ten" ? "ten" : "colour");
    try {
      troIds = TR ? TR.report("four", "end", { won: o.winner === 1, level: state.level, how: how,
        lastSlot: o.winner === 1 && state.own.every(Boolean), used: state.used[0] }, { quiet: true }) : [];
    } catch (e) { troIds = []; }
    troSaid = false;
  }

  // ---- turns ----
  function drop(col) {
    if (!myTurn() || targeting) return;
    var r = F.drop(state, col);
    note = "";
    if (!r.ok) { sfx("bad"); return; }
    settle();
    state = r.state; ids[r.cell] = nextId++;
    layer.sync(tilesOf(), { falls: [{ id: ids[r.cell], rows: rowsTo(r.cell) }] });
    landed(rowsTo(r.cell), r);
    var what = r.earned === "block" ? "Blocked! " : "Ten threat! ";
    if (r.award) K.toast(what + "+1 " + NAMES[r.award]);
    else if (r.free) K.toast(what + "No reward right after a power-up.", "info"); // R2
    else if (r.full) K.toast(what + "Power-ups full", "info"); // R15
    after(r);
  }
  function after(r) {
    if (state.over) { finish(r); persist(); render(); showOver(); return; }
    persist(); render();
    if (state.turn === 2) scheduleCpu();
  }
  function scheduleCpu() {
    clearTimeout(cpuTimer);
    var gen = state.moves, seed = state.seed;
    // the think pause is a pause, not motion: kept under reduced motion (REDESIGN.md 5.5)
    cpuTimer = setTimeout(function () {
      cpuTimer = null;
      if (state.turn !== 2 || state.over || state.moves !== gen || state.seed !== seed) return; // stale
      cpuMove();
    }, THINK);
  }
  function cpuMove() {
    var r = F.computerTurn(state);
    if (!r.actions.length) return;
    settle();
    var used = r.actions.filter(function (a) { return a.type !== "drop"; }).map(function (a) { return NAMES[a.type]; });
    var fx = { out: [], falls: [] };
    r.actions.forEach(function (a) { // Hard's computer may Pop first: its column drops, then its disc falls
      if (a.type !== "pop") return;
      var p = popIds(a.arg); fx.out = fx.out.concat(p.out); fx.falls = fx.falls.concat(p.falls);
    });
    state = r.state; ids[r.drop.cell] = nextId++;
    fx.falls.push({ id: ids[r.drop.cell], rows: rowsTo(r.drop.cell) });
    layer.sync(tilesOf(), fx);
    if (fx.out.length) sfx("pop", 1);
    landed(rowsTo(r.drop.cell), r.drop);
    note = used.length ? "The computer used " + used.join(" and ") + "." : ""; // R14: announced in the hint line
    after(r.drop);
  }
  function flushCpu() { if (cpuTimer !== null) { clearTimeout(cpuTimer); cpuTimer = null; if (state.turn === 2 && !state.over) cpuMove(); } }

  // ---- power-ups ----
  function activate(name) {
    flushCpu(); note = ""; sfx("tick");
    if (targeting && targeting.name === name) { targeting = null; return render(); }
    targeting = null;
    if (name === "undo") { // R1: the engine refuses Undo once the game has a result, so a result is counted once
      var u = F.use(state, "undo");
      if (u.ok) {
        settle();
        var old = state; state = u.state;
        // the discs that stay keep their nodes; the two taken back fade out
        var out = [];
        for (var cell = 0; cell < COLS * ROWS; cell++) {
          var keep = state.own[cell] && old.own[cell] === state.own[cell] && old.num[cell] === state.num[cell];
          if (ids[cell] && !keep) { out.push(ids[cell]); ids[cell] = 0; }
          if (state.own[cell] && !ids[cell]) ids[cell] = nextId++;
        }
        layer.sync(tilesOf(), { out: out, fade: true });
        persist(); K.toast("Took back both moves");
      }
      return render();
    }
    if (!myTurn() || !state.power[0][name]) return render();
    if (name === "hold") {
      var h = F.use(state, "hold");
      if (h.ok) { state = h.state; persist(); K.toast("Holding a " + state.held[0]); }
      return render();
    }
    targeting = { name: name }; K.clearToast(); // the aiming instruction is never under a toast (craft #1)
    if (name === "pop") { var hh = F.height(state.own, cursor); popCur = (hh ? hh - 1 : 0) * COLS + cursor; }
    render();
  }
  function tune(n) {
    var r = F.use(state, "tune", n);
    if (r.ok) { state = r.state; targeting = null; persist(); sfx("place"); K.toast("Next disc: " + n); render(); }
  }
  function pop(cell) {
    if (!state.own[cell]) return;
    var r = F.use(state, "pop", cell);
    if (r.ok) {
      settle();
      var p = popIds(cell);
      state = r.state; targeting = null;
      layer.sync(tilesOf(), { out: p.out, falls: p.falls }); // the popped disc fades; the column drops one slot
      sfx("pop", 1);
      if (p.falls.length) sounds.sound(M.reduced() ? 0 : M.fallMs(1), function () { sfx("land"); });
      persist(); K.toast("Pop!");
    } else { sfx("bad"); K.toast("That pop would complete a line", "bad"); }
    render();
  }
  function movePop(dc, dr) { // R9: the Pop cursor walks the cells; Enter pops the disc under it
    var c = (popCur % COLS + dc + COLS) % COLS, r = Math.max(0, Math.min(ROWS - 1, Math.floor(popCur / COLS) + dr));
    popCur = r * COLS + c; renderBoard();
  }
  function aim(col) { cursor = col; renderBoard(); renderHint(); } // the aim changes marks and the hint only

  // ---- input ----
  function where(ev) {
    var g = gridEl.getBoundingClientRect(), x = ev.clientX - g.left, y = ev.clientY - g.top;
    var c = Math.floor(x / g.width * COLS), vr = Math.floor(y / g.height * ROWS);
    if (c < 0 || c >= COLS) return null;
    return { col: c, cell: vr >= 0 && vr < ROWS ? (ROWS - 1 - vr) * COLS + c : -1 };
  }
  boardEl.addEventListener("click", function (ev) {
    if (ev.target.closest(".over")) return;
    if (state.over) { if (viewing) { sfx("tick"); view(false); } return; }
    var w = where(ev); if (!w) return;
    if (targeting && targeting.name === "pop") { if (w.cell >= 0) pop(w.cell); return; }
    if (targeting) return;
    cursor = w.col; drop(w.col);
  });
  boardEl.addEventListener("mousemove", function (ev) {
    if (targeting || !myTurn()) return;
    var w = where(ev); if (w && w.col !== cursor) aim(w.col);
  });
  window.addEventListener("keydown", function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (sheetOpen()) return; // no key reaches the game while a sheet is open
    var tag = (e.target && e.target.tagName) || "";
    if (e.key === "Escape") { if (targeting) { targeting = null; render(); } else if (viewing) view(false); return; }
    // R17: a key on a focused link or form control belongs to that control (Enter on a games-row link navigates)
    if (tag === "A" || tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA" || tag === "SUMMARY") return;
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
    if (e.key === "ArrowLeft" || e.key === "a") { e.preventDefault(); aim((cursor + COLS - 1) % COLS); }
    else if (e.key === "ArrowRight" || e.key === "d") { e.preventDefault(); aim((cursor + 1) % COLS); }
    else if (e.key === "ArrowDown" || e.key === "s" || ((e.key === "Enter" || e.key === " ") && tag !== "BUTTON")) { e.preventDefault(); drop(cursor); }
  });

  // ---- new game and difficulty ----
  function mine() { return state.own.some(function (v) { return v === 1; }); }
  // you have dropped a disc in this game (an Undo or a Pop that cleared it does not undo having played)
  function inProgress() { return !state.over && (mine() || !!state.prev || state.used[0] > 0); }
  function startNew(lv) {
    clearTimeout(cpuTimer); cpuTimer = null; clearTimeout(overTimer); overTimer = null;
    settle();
    // R12: quitting a live game you have dropped in counts as a loss (on the level it was played at)
    var quit = inProgress() && !counted;
    if (quit) { (rec[state.level] || rec[level]).l++; counted = true; }
    // the opener alternates only after a game that counted, so New game can never re-roll who opens
    var first = state.over || counted ? 3 - (state.first || 1) : (state.first || 1);
    targeting = null; note = ""; level = lv || level; counted = false; cursor = 3; viewing = false;
    troIds = []; troSaid = false; lineShown = false; hideLine(); duck(false);
    state = F.newGame(K.freshSeed(), { level: level, first: first });
    rekey(false);
    persist(); render();
    if (quit) K.toast("Counted as a loss", "bad");
    if (state.turn === 2) scheduleCpu();
  }
  var QUIT = "Sure? Counts as a loss";
  K.twoStep($("new"), inProgress, function () { sfx("tick"); startNew(); }, QUIT);
  $("again").addEventListener("click", function () { sfx("tick"); startNew(); });
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
      sfx("tick");
      if (lv === level && !state.over) return;
      startNew(lv);
    }, "Sure?");
  });
  $("over-view").addEventListener("click", function () { sfx("tick"); view(true); });

  // ---- how to play (REDESIGN.md 1.3, 9.4): three drawn steps in a sheet; opens by itself once on a first visit ----
  function md(n, who) { return '<span class="md" style="--h2:' + (who === 1 ? "var(--accent)" : who === 2 ? "var(--cool)" : "var(--cell)") + '">' + (n || "") + "</span>"; }
  function well(cells) { return '<div class="mg" style="grid-template-columns:repeat(5,20px)">' + cells.map(function (x) { return md(x[0], x[1]); }).join("") + "</div>"; }
  var STEPS = [
    { picture: well([[0, 0], [0, 0], [3, 1], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [2, 2], [1, 1], [0, 0], [0, 0]]),
      text: "Tap a column to drop your disc." },
    { picture: well([[0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [1, 2], [0, 0], [2, 2], [0, 0], [1, 1], [3, 1], [2, 1], [1, 1], [4, 2]]),
      text: "Win with four of your colour in a row." },
    { picture: well([[0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [1, 1], [0, 0], [0, 0], [0, 0], [4, 1], [1, 2], [2, 1], [3, 2]]),
      text: "Or four in a row that add up to ten, two of them yours." }
  ];
  // the family's one sheet (shared/howto.js, TRIAGE4 D8): it opens by itself once, never with a saved game
  var how = null;
  function howto() { if (how) how.open(); }
  document.addEventListener("DOMContentLoaded", function () {
    var U = window.NumbericsUI; if (!U || !U.howto) return;
    how = U.howto("four", { title: "Four", steps: STEPS, saved: !!saved, onButton: function () { sfx("tick"); } });
  });

  rekey(false);
  render();
  if (state.over) { lineShown = true; renderBoard(); drawLine(false); showOver(); clearTimeout(overTimer); overTimer = null; card(); }
  else if (state.turn === 2) scheduleCpu();

  // Screenshot hook (tools/shots.cjs): a fixed, representative mid-game. Not reachable from the UI.
  window.__demo = function () {
    try { if (window.NumbericsUI && window.NumbericsUI.open()) window.NumbericsUI.close(); } catch (e) { /* no sheet */ }
    clearTimeout(cpuTimer); cpuTimer = null; targeting = null; settle();
    var s = F.newGame(2051, { level: "medium" }), mine = [3, 1, 3, 4, 3, 6, 4]; // a seed whose whole line plays out
    for (var k = 0; k < mine.length && !s.over; k++) {
      var r = F.drop(s, mine[k]); if (!r.ok || r.state.over) break; s = r.state;
      if (s.turn === 2) { var t = F.computerTurn(s); if (t.state.over) break; s = t.state; }
    }
    s.power[0] = { undo: 1, pop: 1, hold: 1, tune: 2 }; s.held[0] = 4;
    state = s; level = "medium"; cursor = 5; lineShown = false; hideLine(); rekey(false); render();
  };
  window.__four = {
    get state() { return state; },
    set state(s) {
      clearTimeout(cpuTimer); cpuTimer = null; settle(); state = s; targeting = null;
      lineShown = !!s.over; rekey(false); hideLine(); render();
      if (!s.over && s.turn === 2) scheduleCpu();
    },
    render: render, cpu: flushCpu, get viewing() { return viewing; }, get rec() { return rec; },
    get trophies() { return troIds.slice(); }, layer: layer, get ids() { return ids.slice(); },
  };
})();
