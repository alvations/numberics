/* SPDX-License-Identifier: Apache-2.0 | Copyright 2026 alvations (Melon Lab)
 *
 * Numberics Seven: pure engine (browser global NumbericsSeven, or require()). No DOM, storage or clock.
 * A 7x7 well, row-major, row 0 at the top. Cell values: 0 empty, 1-7 a number, 8 egg, 9 cracked egg.
 * A number pops when it equals the length of the unbroken run it sits in, along its row OR its column
 * (eggs count toward a run). A pop cracks each orthogonal egg one step (egg -> cracked -> a number).
 * Gravity, then pop again: each wave of a chain scores more. Every N drops a row of eggs rises from the
 * bottom; a disc pushed out of the top ends the run. Lucky Seven: a chain that pops exactly 7 discs in
 * total cracks every egg one step and earns a power-up. All randomness comes from state.seed.
 * A power-up never earns one (family rule R2): chains a power-up sets off pay nothing, and the drop right after
 * Smash, Hold or Crack (state.free) still scores its chains and Lucky Sevens but pays no power-up.
 * Stock is capped: when every slot is full an award is skipped and reported (res.full, rule R15).
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("../shared/kit.js"), require("../shared/power.js"));
  else root.NumbericsSeven = factory(root.NumbericsKit, root.NumbericsPower);
})(typeof self !== "undefined" ? self : this, function (Kit, Power) {
  "use strict";
  var W = 7, H = 7, EGG = 8, CRACKED = 9;
  var POWERS = ["undo", "smash", "hold", "crack"];
  var EARNED = ["smash", "hold", "crack", "undo"];
  var MODES = ["classic", "blitz", "daily"];
  // Tuned with the bot in tests/test-seven.js and docs (see the report): keep these together.
  var RULES = {
    eggChance: 0.16,        // a fresh disc is an egg this often, otherwise 1-7 uniformly
    startDiscs: 12,         // discs dropped (silently) into a new well
    firstN: 20,             // Classic: drops before the first rise; shrinks by one per level
    minN: 5,                // ... down to this
    blitzN: 5,              // Blitz: always this many
    discPoints: 7,          // a disc popped in wave w scores discPoints * w^wavePower
    wavePower: 2.5,         // 7, 40, 109, 224, 391, ... per disc (the Drop7 curve)
    levelBonus: 70,         // each rise scores levelBonus * level reached
    clearBonus: 7000,       // the well emptied by a chain
    luckyBonus: 777,        // a Lucky Seven
    chainEarn: 3,           // a chain of this many waves or more earns a power-up
  };

  function clone(s) { return JSON.parse(JSON.stringify(s)); }
  function next01(s) { var r = Kit.rand(s.seed); s.seed = r[1]; return r[0]; }
  function randNumber(s) { return 1 + Math.floor(next01(s) * 7); }
  function randDisc(s) { return next01(s) < RULES.eggChance ? EGG : randNumber(s); }
  function isNum(v) { return v >= 1 && v <= 7; }
  function isEgg(v) { return v === EGG || v === CRACKED; }
  function dropsFor(mode, level) {
    if (mode === "blitz") return RULES.blitzN;
    return Math.max(RULES.minN, RULES.firstN - (level - 1));
  }
  function landing(grid, col) { // row a disc lands on, or -1 when the column is full
    for (var r = H - 1; r >= 0; r--) if (!grid[r * W + col]) return r;
    return -1;
  }
  function wavePoints(w) { return Math.round(RULES.discPoints * Math.pow(w, RULES.wavePower)); }
  function hasRoom(grid) { for (var c = 0; c < W; c++) if (!grid[c]) return true; return false; }

  // which numbered cells pop on this grid
  function findPops(g) {
    var out = [], r, c, i;
    var rowLen = new Array(W * H).fill(0), colLen = new Array(W * H).fill(0);
    for (r = 0; r < H; r++) {
      c = 0;
      while (c < W) {
        if (!g[r * W + c]) { c++; continue; }
        var c2 = c; while (c2 < W && g[r * W + c2]) c2++;
        for (i = c; i < c2; i++) rowLen[r * W + i] = c2 - c;
        c = c2;
      }
    }
    for (c = 0; c < W; c++) {
      r = 0;
      while (r < H) {
        if (!g[r * W + c]) { r++; continue; }
        var r2 = r; while (r2 < H && g[r2 * W + c]) r2++;
        for (i = r; i < r2; i++) colLen[i * W + c] = r2 - r;
        r = r2;
      }
    }
    for (i = 0; i < W * H; i++) if (isNum(g[i]) && (g[i] === rowLen[i] || g[i] === colLen[i])) out.push(i);
    return out;
  }
  function gravity(g) { // returns [{from,to}] for every disc that moves
    var falls = [];
    for (var c = 0; c < W; c++) {
      var w = H - 1;
      for (var r = H - 1; r >= 0; r--) {
        var v = g[r * W + c]; if (!v) continue;
        if (r !== w) { g[w * W + c] = v; g[r * W + c] = 0; falls.push({ from: r * W + c, to: w * W + c }); }
        w--;
      }
    }
    return falls;
  }
  function crackCell(s, g, i) { var v = g[i]; g[i] = v === EGG ? CRACKED : randNumber(s); return g[i]; }

  // Resolve every wave on s.grid. Appends steps to trace. Returns {waves, popped}.
  // waveBase lets waves after a Lucky Seven keep counting up inside the same chain.
  function resolve(s, trace, waveBase) {
    var g = s.grid, wave = waveBase || 0, popped = 0;
    for (;;) {
      var pops = findPops(g); if (!pops.length) break;
      wave++;
      var hit = {}, cracks = [];
      pops.forEach(function (i) {
        g[i] = 0;
        var r = Math.floor(i / W), c = i % W;
        [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].forEach(function (p) {
          if (p[0] < 0 || p[0] >= H || p[1] < 0 || p[1] >= W) return;
          var k = p[0] * W + p[1];
          if (isEgg(g[k]) && !hit[k]) hit[k] = true;
        });
      });
      Object.keys(hit).map(Number).sort(function (a, b) { return a - b; }).forEach(function (k) {
        cracks.push({ cell: k, to: crackCell(s, g, k) });
      });
      var falls = gravity(g);
      var pts = pops.length * wavePoints(wave);
      s.score += pts; popped += pops.length;
      trace.push({ type: "wave", wave: wave, pops: pops, cracks: cracks, falls: falls, points: pts, grid: g.slice() });
    }
    return { waves: wave - (waveBase || 0), lastWave: wave, popped: popped };
  }
  function crackAll(s, g, onlyTouching) {
    var cracks = [];
    for (var i = 0; i < W * H; i++) {
      if (!isEgg(g[i])) continue;
      if (onlyTouching) {
        var r = Math.floor(i / W), c = i % W, touch = false;
        [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].forEach(function (p) {
          if (p[0] >= 0 && p[0] < H && p[1] >= 0 && p[1] < W && isNum(g[p[0] * W + p[1]])) touch = true;
        });
        if (!touch) continue;
      }
      cracks.push({ cell: i });
    }
    cracks.forEach(function (k) { k.to = crackCell(s, g, k.cell); });
    return cracks;
  }
  // pay=false (the drop right after a power-up): the reward is noted as unpaid, nothing is added.
  function awardOne(s, why, res, pay) {
    if (!pay) { res.unpaid.push(why); return; }
    var p = Power.award(s.power, EARNED, next01(s));
    if (p) res.awarded.push({ power: p, why: why }); else res.full.push(why);
  }
  // A full chain from the current grid: waves, then a Lucky Seven check (once), then more waves.
  // earn=false for chains started by a power-up (a power-up never earns one, and never scores Lucky).
  // pay=false keeps the scoring (Lucky included) but pays no power-up (the drop after a power-up, R2).
  function chain(s, trace, res, earn, pay) {
    var a = resolve(s, trace, 0), waves = a.waves, popped = a.popped, last = a.lastWave;
    if (earn && popped === 7) {
      var cracks = crackAll(s, s.grid, false);
      s.score += RULES.luckyBonus; s.luckies++; res.lucky = true;
      awardOne(s, "lucky", res, pay);
      trace.push({ type: "lucky", cracks: cracks, points: RULES.luckyBonus, grid: s.grid.slice() });
      var b = resolve(s, trace, last); waves += b.waves; popped += b.popped;
    }
    if (earn && waves >= RULES.chainEarn) awardOne(s, "chain", res, pay);
    if (popped && !s.grid.some(Boolean)) {
      s.score += RULES.clearBonus; trace.push({ type: "clear", points: RULES.clearBonus, grid: s.grid.slice() });
    }
    res.waves = Math.max(res.waves, waves); res.popped += popped;
    s.bestChain = Math.max(s.bestChain, waves);
    return waves;
  }
  function checkStuck(s) {
    if (!s.over && !hasRoom(s.grid) && !canUseAny(s)) s.over = true;
  }
  function canUseAny(s) {
    return (s.power.undo > 0 && !!s.prev) || (s.power.smash > 0 && s.grid.some(Boolean)) || (s.power.crack > 0 && crackable(s.grid));
  }
  // the eggs a Crack would crack: every egg touching a numbered disc (the client marks them before Crack fires)
  function crackTargets(g) {
    var out = [];
    for (var i = 0; i < W * H; i++) {
      if (!isEgg(g[i])) continue;
      var r = Math.floor(i / W), c = i % W;
      if ((r > 0 && isNum(g[i - W])) || (r < H - 1 && isNum(g[i + W])) || (c > 0 && isNum(g[i - 1])) || (c < W - 1 && isNum(g[i + 1]))) out.push(i);
    }
    return out;
  }
  function crackable(g) { return crackTargets(g).length > 0; }
  // How close the well is to overflowing: top = columns with a disc in the top row (the next rise pushes it out),
  // near = columns one disc from the top (the next disc there reaches the top row). The client warns with these.
  function danger(g) {
    var top = [], near = [];
    for (var c = 0; c < W; c++) { if (g[c]) top.push(c); else if (g[W + c]) near.push(c); }
    return { top: top, near: near };
  }
  function snapshot(s) { var c = clone(s); c.prev = null; return c; }

  function newGame(seed, mode) {
    mode = MODES.indexOf(mode) >= 0 ? mode : "classic";
    var s = {
      v: 1, mode: mode, seed: seed >>> 0, grid: new Array(W * H).fill(0), next: 0, held: 0,
      score: 0, drops: 0, level: 1, left: dropsFor(mode, 1), over: false,
      bestChain: 0, luckies: 0, used: 0, out: [], free: false,
      power: Power.stock(POWERS, { undo: 1 }), prev: null,
    };
    // a random start: drop discs silently, settle every chain, score nothing
    for (var k = 0; k < RULES.startDiscs; k++) {
      var col = Math.floor(next01(s) * W), r = landing(s.grid, col);
      if (r < 0) continue;
      s.grid[r * W + col] = randDisc(s);
      resolve(s, [], 0);
    }
    s.score = 0;
    s.next = randDisc(s);
    return s;
  }

  // Rising row: everything moves up one. If a disc sits in the top row the rise would push it out: the run ends
  // and the well is left exactly as the player last saw it, with s.out naming the discs that would go (honest end).
  function rise(s, trace) {
    var g = s.grid, lost = [];
    for (var c = 0; c < W; c++) if (g[c]) lost.push(c);
    if (lost.length) {
      s.over = true; s.out = lost;
      trace.push({ type: "rise", level: s.level, overflow: true, out: lost.slice(), points: 0, grid: g.slice() });
      return true;
    }
    for (var i = 0; i < W * (H - 1); i++) g[i] = g[i + W];
    for (var k = 0; k < W; k++) g[(H - 1) * W + k] = EGG;
    s.level++; s.left = dropsFor(s.mode, s.level);
    var pts = RULES.levelBonus * s.level; s.score += pts;
    trace.push({ type: "rise", level: s.level, overflow: false, points: pts, grid: g.slice() });
    return false;
  }

  // drop(state, col) -> {ok, state, trace, waves, popped, lucky, awarded, unpaid, full, rose}
  // unpaid: rewards this drop would have paid but did not (it follows a power-up); full: rewards skipped at the cap.
  // trace is the wave-by-wave story: drop, wave..., [lucky, wave...], [clear], [rise, wave...]
  function drop(state, col) {
    var res = { ok: false, state: state, trace: [], waves: 0, popped: 0, lucky: false, awarded: [], unpaid: [], full: [], rose: false };
    if (state.over || col < 0 || col >= W || (col | 0) !== col) return res;
    var row = landing(state.grid, col); if (row < 0) return res;
    var s = clone(state); s.prev = snapshot(state);
    var pay = !state.free; s.free = false; // the drop right after a power-up pays no power-up (R2)
    var disc = s.next; s.grid[row * W + col] = disc; s.drops++;
    s.next = randDisc(s);
    res.trace.push({ type: "drop", col: col, row: row, cell: row * W + col, disc: disc, grid: s.grid.slice() });
    chain(s, res.trace, res, true, pay);
    s.left--;
    if (s.left <= 0) {
      res.rose = true;
      if (!rise(s, res.trace)) chain(s, res.trace, res, true, pay);
    }
    checkStuck(s);
    res.ok = true; res.state = s; return res;
  }

  // use(state, name, cell) -> {ok, state, trace}. Undo restores the whole snapshot, stock included.
  // Undo never crosses a decided result (family rule R1): once the run is over, nothing is used.
  function use(state, name, cell) {
    var fail = { ok: false, state: state, trace: [] };
    if (POWERS.indexOf(name) < 0 || !state.power[name] || state.over) return fail;
    if (name === "undo") {
      if (!state.prev) return fail;
      var p = clone(state.prev);
      p.power.undo = Math.max(0, p.power.undo - 1); // the rewind is paid for
      p.prev = null;
      p.used = state.used + 1;                      // and counted as a power-up used
      return { ok: true, state: p, trace: [] };
    }
    var s = clone(state), trace = [], res = { waves: 0, popped: 0, awarded: [], unpaid: [], full: [] };
    s.prev = snapshot(state);
    if (name === "smash") {
      if (!(cell >= 0 && cell < W * H) || !s.grid[cell]) return fail;
      s.grid[cell] = 0;
      var falls = gravity(s.grid);
      trace.push({ type: "smash", cell: cell, falls: falls, grid: s.grid.slice() });
    } else if (name === "hold") {
      var was = s.held;
      s.held = s.next; s.next = was || randDisc(s);
      trace.push({ type: "hold", held: s.held, next: s.next });
    } else if (name === "crack") {
      if (!crackable(s.grid)) return fail;
      var cracks = crackAll(s, s.grid, true);
      trace.push({ type: "crack", cracks: cracks, grid: s.grid.slice() });
    }
    s.power[name]--; s.used++;
    s.free = true; // the next drop is power-up assisted: it scores but pays no power-up (R2)
    if (name !== "hold") chain(s, trace, res, false, false);
    checkStuck(s);
    return { ok: true, state: s, trace: trace };
  }

  return { W: W, H: H, EGG: EGG, CRACKED: CRACKED, POWERS: POWERS, MODES: MODES, RULES: RULES,
           newGame: newGame, drop: drop, use: use, findPops: findPops, landing: landing, hasRoom: hasRoom,
           dropsFor: dropsFor, wavePoints: wavePoints, crackable: crackable, crackTargets: crackTargets, canUseAny: canUseAny,
           danger: danger };
});
