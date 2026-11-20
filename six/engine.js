/* SPDX-License-Identifier: Apache-2.0 | Copyright 2026 alvations (Melon Lab)
 * Numberics Six: pure rules (UMD: browser global NumbericsSix, and require()). No DOM, storage or clock.
 * The 6s challenge, expanded: put operators between the numbers of a line, in order, so it equals the target.
 * Exact rational arithmetic only: sqrt only of perfect squares of rationals, factorial only of whole 0..10.
 * Never eval: a small recursive-descent parser builds the expression tree. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./bank.js"), require("../shared/kit.js"), require("../shared/power.js"));
  else root.NumbericsSix = factory(root.NumbericsSixBank, root.NumbericsKit, root.NumbericsPower);
})(typeof self !== "undefined" ? self : this, function (BANK, Kit, Power) {
  "use strict";

  // ---------- exact fractions [n, d], d > 0, reduced, |n| and d bounded so every product stays a safe integer ----------
  var LIM = 1e7;
  function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { var t = a % b; a = b; b = t; } return a; }
  function fr(n, d) {
    if (d === undefined) d = 1;
    if (!d) return null;
    if (d < 0) { n = -n; d = -d; }
    var g = gcd(n, d) || 1; n /= g; d /= g;
    if (Math.abs(n) > LIM || d > LIM) return null;
    return [n === 0 ? 0 : n, d];
  }
  function add(a, b) { return fr(a[0] * b[1] + b[0] * a[1], a[1] * b[1]); }
  function sub(a, b) { return fr(a[0] * b[1] - b[0] * a[1], a[1] * b[1]); }
  function mul(a, b) { return fr(a[0] * b[0], a[1] * b[1]); }
  function div(a, b) { return b[0] === 0 ? null : fr(a[0] * b[1], a[1] * b[0]); }
  function isqrt(n) { if (n < 0) return -1; var r = Math.round(Math.sqrt(n)); return r * r === n ? r : -1; }
  function sqrt(a) { if (a[0] < 0) return null; var p = isqrt(a[0]), q = isqrt(a[1]); return p < 0 || q < 0 ? null : [p, q]; }
  var FACT = [1, 1, 2, 6, 24, 120, 720, 5040, 40320, 362880, 3628800];
  function fact(a) { return a[1] === 1 && a[0] >= 0 && a[0] <= 10 ? [FACT[a[0]], 1] : null; }
  function same(a, b) { return !!a && !!b && a[0] === b[0] && a[1] === b[1]; }
  function key(a) { return a[0] + "/" + a[1]; }
  function binop(op, a, b) { return op === "+" ? add(a, b) : op === "-" ? sub(a, b) : op === "*" ? mul(a, b) : div(a, b); }
  // a literal's digits: "12", "2.25" -> exact fraction
  function literal(s) {
    var i = s.indexOf(".");
    if (i < 0) return fr(parseInt(s, 10), 1);
    var dec = s.length - i - 1; if (!dec) return null;
    return fr(parseInt(s.replace(".", ""), 10), Math.pow(10, dec));
  }
  function show(a) {
    if (!a) return "?";
    if (a[1] === 1) return String(a[0]);
    var d = a[1], k = 0; while (d % 2 === 0) { d /= 2; k++; } while (d % 5 === 0) { d /= 5; k++; }
    if (d === 1 && k <= 4) return (a[0] / a[1]).toFixed(k).replace(/\.?0+$/, "") === "" ? "0" : String(+(a[0] / a[1]).toFixed(k));
    return a[0] + "/" + a[1];
  }

  // ---------- unary signs: one choice per number or bracket group (tap cycles through them) ----------
  // 0 none, 1 sqrt, 2 factorial, 3 sqrt of sqrt, 4 factorial of the sqrt
  var UN = [[], ["s"], ["f"], ["s", "s"], ["s", "f"]];
  var UN_COST = [0, 1, 1, 2, 2];
  function unary(u, a) {
    var steps = UN[u], v = a;
    for (var i = 0; i < steps.length && v; i++) v = steps[i] === "s" ? sqrt(v) : fact(v);
    return v;
  }

  // ---------- the solver: interval DP over the line, numbers used in order ----------
  // tokens: ["8","8","8"]; target: fraction; join: whether digits may be joined / take a decimal point (tier 4+).
  // Each interval maps value -> {v, c (cheapest cost), n (number of distinct trees, capped), w (cheapest witness)}.
  // Cost = unary signs + joins/decimal points used. A unary sign that changes nothing (2!, sqrt 1) is pruned:
  // it never reaches a value that is not reachable more cheaply without it.
  var CAP = 1e9;
  function solve(tokens, target, opts) {
    opts = opts || {};
    var n = tokens.length, join = !!opts.join, T = [];
    // ties on cost go to the plainer witness: fewer right-nested groups (a - (b - c)) reads better
    function put(map, v, c, cnt, w, c2) {
      var k = key(v), e = map.get(k);
      if (!e) { map.set(k, { v: v, c: c, c2: c2 || 0, n: Math.min(CAP, cnt), w: w }); return; }
      e.n = Math.min(CAP, e.n + cnt);
      if (c < e.c || (c === e.c && (c2 || 0) < e.c2)) { e.c = c; e.c2 = c2 || 0; e.w = w; }
    }
    function withUnary(map, v, c, cnt, wf, c2) {
      for (var u = 0; u < UN.length; u++) {
        var x = u ? unary(u, v) : v;
        if (!x || (u && same(x, v))) continue;
        if (u === 4 && same(x, unary(2, v))) continue;
        if (u === 3 && same(x, unary(1, v))) continue;
        put(map, x, c + UN_COST[u], cnt, wf(u), c2);
      }
    }
    for (var len = 1; len <= n; len++) {
      for (var i = 0; i + len <= n; i++) {
        var j = i + len - 1, map = new Map(), top = len === n;
        // a literal: one number, or (tier 4+) several joined, optionally with one decimal point at an inner gap
        if (len === 1 || join) {
          var digits = tokens.slice(i, j + 1).join("");
          var forms = [{ s: digits, dot: -1 }];
          if (join) for (var g = i; g < j; g++) {
            var pos = tokens.slice(i, g + 1).join("").length;
            forms.push({ s: digits.slice(0, pos) + "." + digits.slice(pos), dot: g });
          }
          forms.forEach(function (f) {
            var v = literal(f.s); if (!v) return;
            var c = (j - i) + 0; // joins and the decimal point each fill one gap
            withUnary(map, v, c, 1, function (u) { return { t: "L", i: i, j: j, dot: f.dot, u: u }; });
          });
        }
        for (var k = i; k < j; k++) {
          var L = T[i][k], R = T[k + 1][j];
          L.forEach(function (a) {
            R.forEach(function (b) {
              for (var o = 0; o < 4; o++) {
                var op = "+-*/"[o], v = binop(op, a.v, b.v); if (!v) continue;
                var c = a.c + b.c, cnt = Math.min(CAP, a.n * b.n), c2 = a.c2 + b.c2 + (b.w.t === "B" ? 1 : 0);
                if (top && !opts.all) {
                  // the whole line: only values that land on the target (after one optional sign) matter
                  for (var u = 0; u < UN.length; u++) {
                    var x = u ? unary(u, v) : v;
                    if (x && same(x, target) && !(u && same(x, v))) put(map, x, c + UN_COST[u], cnt, { t: "B", op: op, k: k, a: a.w, b: b.w, u: u, i: i, j: j }, c2);
                  }
                  continue;
                }
                withUnary(map, v, c, cnt, (function (op, k, a, b) { return function (u) { return { t: "B", op: op, k: k, a: a.w, b: b.w, u: u, i: i, j: j }; }; })(op, k, a, b), c2);
              }
            });
          });
        }
        (T[i] = T[i] || [])[j] = map;
      }
    }
    var e = T[0][n - 1].get(key(target));
    return e ? { count: e.n, cost: e.c, tree: e.w } : { count: 0, cost: -1, tree: null };
  }


  // ---------- the parser: text -> expression tree (never eval) ----------
  // expr := term (('+'|'-') term)* ; term := factor (('*'|'/') factor)* ; factor := sqrt factor | post ;
  // post := primary '!'* ; primary := number | '(' expr ')'. Postfix ! binds tighter than prefix sqrt.
  function tokenize(str) {
    var out = [], i = 0, s = String(str);
    while (i < s.length) {
      var ch = s[i];
      if (/\s/.test(ch)) { i++; continue; }
      if (/[0-9.]/.test(ch)) {
        var j = i; while (j < s.length && /[0-9.]/.test(s[j])) j++;
        var lit = s.slice(i, j);
        if (!/^\d+(\.\d+)?$/.test(lit)) throw new Error("bad number " + lit);
        out.push({ t: "n", s: lit }); i = j; continue;
      }
      if (s.slice(i, i + 4).toLowerCase() === "sqrt") { out.push({ t: "r" }); i += 4; continue; }
      if (ch === "√") { out.push({ t: "r" }); i++; continue; }
      if ("+-*/".indexOf(ch) >= 0) { out.push({ t: "o", v: ch }); i++; continue; }
      if (ch === "−") { out.push({ t: "o", v: "-" }); i++; continue; }
      if (ch === "x" || ch === "X" || ch === "×" || ch === "·") { out.push({ t: "o", v: "*" }); i++; continue; }
      if (ch === "÷") { out.push({ t: "o", v: "/" }); i++; continue; }
      if (ch === "(" || ch === ")" || ch === "!") { out.push({ t: ch }); i++; continue; }
      throw new Error("unexpected " + ch);
    }
    return out;
  }
  function parse(str) {
    var tk = tokenize(str), p = 0, ord = 0;
    function peek() { return tk[p]; }
    function expr() {
      var a = term();
      while (peek() && peek().t === "o" && (peek().v === "+" || peek().v === "-")) { var op = tk[p++].v; a = bin(op, a, term()); }
      return a;
    }
    function term() {
      var a = factor();
      while (peek() && peek().t === "o" && (peek().v === "*" || peek().v === "/")) { var op = tk[p++].v; a = bin(op, a, factor()); }
      return a;
    }
    function bin(op, a, b) { return { t: "b", op: op, a: a, b: b, lo: a.lo, hi: b.hi }; }
    function factor() {
      if (peek() && peek().t === "r") { p++; var a = factor(); return { t: "s", a: a, lo: a.lo, hi: a.hi }; }
      var x = primary();
      while (peek() && peek().t === "!") { p++; x = { t: "f", a: x, lo: x.lo, hi: x.hi }; }
      return x;
    }
    function primary() {
      var k = tk[p++];
      if (!k) throw new Error("unexpected end");
      if (k.t === "n") { var o = ord++; return { t: "n", s: k.s, lo: o, hi: o }; }
      if (k.t === "(") { var e = expr(); if (!peek() || peek().t !== ")") throw new Error("missing )"); p++; return e; }
      throw new Error("unexpected " + (k.v || k.t));
    }
    var tree = expr();
    if (p !== tk.length) throw new Error("unexpected " + (tk[p].v || tk[p].t));
    return tree;
  }
  function evaluate(t) {
    if (!t) return null;
    if (t.t === "n") return literal(t.s);
    if (t.t === "s") { var a = evaluate(t.a); return a && sqrt(a); }
    if (t.t === "f") { var b = evaluate(t.a); return b && fact(b); }
    var x = evaluate(t.a), y = evaluate(t.b);
    return x && y ? binop(t.op, x, y) : null;
  }
  function calc(str) { try { return evaluate(parse(str)); } catch (e) { return null; } }

  // ---------- the line model: what the player edits ----------
  // tokens: the numbers in order. m = { g: gap ops ("" unset, + - * /, "j" join, "." decimal point),
  //   u: a unary sign per number (only the first number of a joined literal counts),
  //   b: bracket groups [first token, last token, unary sign] }.
  var OPS = ["+", "-", "*", "/"], JOPS = ["+", "-", "*", "/", "j", "."];
  var SYM = { "+": "+", "-": "−", "*": "×", "/": "÷" };
  function blank(n) { return { g: new Array(n - 1).fill(""), u: new Array(n).fill(0), b: [] }; }
  function copyM(m) { return { g: m.g.slice(), u: m.u.slice(), b: m.b.map(function (x) { return x.slice(); }) }; }
  // literals: [{i, j, dot (gap index or -1), s}] or null when one literal has two decimal points
  function literals(tokens, g) {
    var out = [], i = 0;
    while (i < tokens.length) {
      var j = i, dot = -1;
      while (j < tokens.length - 1 && (g[j] === "j" || g[j] === ".")) { if (g[j] === ".") { if (dot >= 0) return null; dot = j; } j++; }
      var s = "";
      for (var k = i; k <= j; k++) s += tokens[k] + (k === dot ? "." : "");
      out.push({ i: i, j: j, dot: dot, s: s }); i = j + 1;
    }
    return out;
  }
  function crosses(a, b) { return (a[0] < b[0] && b[0] <= a[1] && a[1] < b[1]) || (b[0] < a[0] && a[0] <= b[1] && b[1] < a[1]); }
  // drop signs on non-first digits of a literal and brackets that no longer sit on literal edges
  function normalize(tokens, m) {
    var L = literals(tokens, m.g); if (!L) return m;
    var starts = {}, ends = {};
    L.forEach(function (l) { starts[l.i] = true; ends[l.j] = true; });
    m.u = m.u.map(function (u, i) { return starts[i] ? u : 0; });
    var seen = {};
    m.b = m.b.filter(function (b) {
      var k = b[0] + ":" + b[1], ok = starts[b[0]] && ends[b[1]] && !seen[k] && !L.some(function (l) { return l.i === b[0] && l.j === b[1]; });
      seen[k] = true; return ok; // a bracket must sit on literal edges and group two literals or more
    }).sort(function (x, y) { return x[0] - y[0] || y[1] - x[1]; });
    return m;
  }
  var PRE = ["(", "√(", "(", "√√(", "(√("], POST = [")", ")", ")!", ")", "))!"];
  function litText(s, u) { return ["", "√", "", "√√", "(√"][u] + s + ["", "", "!", "", ")!"][u]; }
  // the expression as text; unset gaps show as "?" (and make the text unparseable on purpose)
  function text(tokens, m) {
    var L = literals(tokens, m.g); if (!L) return null;
    var out = "";
    L.forEach(function (l, n) {
      m.b.filter(function (b) { return b[0] === l.i; }).sort(function (x, y) { return y[1] - x[1]; })
        .forEach(function (b) { out += PRE[b[2]]; });
      out += litText(l.s, m.u[l.i]);
      m.b.filter(function (b) { return b[1] === l.j; }).sort(function (x, y) { return x[0] - y[0]; }).reverse()
        .forEach(function (b) { out += POST[b[2]]; });
      if (n < L.length - 1) out += " " + (SYM[m.g[l.j]] || "?") + " ";
    });
    return out;
  }
  // value of the line: {v} when complete and exact, otherwise {v:null, why}
  function value(tokens, m) {
    if (m.g.some(function (g) { return !g; })) return { v: null, why: "gap" };
    var t = text(tokens, m); if (t === null) return { v: null, why: "dot" };
    var v = calc(t);
    return v ? { v: v } : { v: null, why: "math" };
  }
  function prec(op) { return op === "+" || op === "-" ? 1 : 2; }
  // a solver witness -> the model the player would build (brackets only where needed)
  function treeToModel(n, w) {
    var m = blank(n);
    (function rec(node, parent, side) {
      if (node.t === "L") {
        for (var k = node.i; k < node.j; k++) m.g[k] = k === node.dot ? "." : "j";
        m.u[node.i] = node.u; return;
      }
      m.g[node.k] = node.op;
      rec(node.a, node, "l"); rec(node.b, node, "r");
      var need = node.u !== 0 || (parent && (prec(node.op) < prec(parent.op) ||
        (side === "r" && prec(node.op) === prec(parent.op) && (parent.op === "-" || parent.op === "/"))));
      if (need) m.b.push([node.i, node.j, node.u]);
    })(w, null, null);
    return normalize(Array(n).fill("1"), m);
  }
  function sameM(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

  // ---------- lines, tiers, difficulty ----------
  var TIERS = {
    1: { join: false, label: "Tier 1", what: "make 6" },
    2: { join: false, label: "Tier 2", what: "longer lines" },
    3: { join: false, label: "Tier 3", what: "two-digit numbers" },
    4: { join: true, label: "Tier 4", what: "join digits" },
    5: { join: true, label: "Tier 5", what: "all tools" },
  };
  var CAT = [1, 1, 2, 5, 14, 42, 132];
  // difficulty: log10 of (expressions the line allows / expressions that hit the target) + the shortest
  // solution's extra signs. Fewer solutions and longer shortest solutions both make a line harder.
  function difficulty(n, join, count, cost) {
    var space = CAT[n - 1] * Math.pow(join ? 6 : 4, n - 1) * Math.pow(UN.length, 2 * n - 1);
    return Math.round((Math.log(space / count) / Math.LN10 + cost) * 10) / 10;
  }
  // full measurement of a line (used to build and to re-verify the bank)
  function measure(tokens, target, tier) {
    var join = TIERS[tier].join, t = literal(target), r = solve(tokens, t, { join: join });
    if (!r.count) return null;
    return { count: r.count, cost: r.cost, d: difficulty(tokens.length, join, r.count, r.cost), sol: treeToModel(tokens.length, r.tree) };
  }
  // a line that is just its digits joined (6 6 6 -> 666, or 66.6) is no puzzle
  function trivial(tokens, target) {
    var t = literal(target), all = tokens.join("");
    if (same(literal(all), t)) return true;
    for (var p = 1; p < all.length; p++) if (same(literal(all.slice(0, p) + "." + all.slice(p)), t)) return true;
    return false;
  }
  var POOL = {};
  (BANK || []).forEach(function (e, id) { (POOL[e.t] = POOL[e.t] || []).push(id); });
  function entry(id) {
    var e = BANK[id];
    return { id: id, t: e.t, n: e.n.split(" "), g: e.g, d: e.d, sol: e.s };
  }

  // ---------- game state ----------
  var POWERS = ["hint", "skip", "peek", "undo"];
  var DAILY = [1, 2, 3, 3, 4, 5];   // tiers of the six Daily lines
  var STREAK = 3;                    // lines in a row without help that earn one power-up
  function rnd(s) { var r = Kit.rand(s.seed); s.seed = r[1]; return r[0]; }
  function climbTier(s) { return s.round <= 5 ? s.round : [3, 4, 5][Math.floor(rnd(s) * 3)]; }
  function draw(s, tier, avoid) {
    var pool = POOL[tier].filter(function (id) { return avoid.indexOf(id) < 0; });
    if (!pool.length) pool = POOL[tier].slice();
    return pool[Math.floor(rnd(s) * pool.length)];
  }
  function deal(s) {
    var t = s.mode === "daily" ? 0 : climbTier(s);
    var tiers = s.mode === "daily" ? DAILY : [t, t, t, t, t, t];
    var ids = [];
    tiers.forEach(function (t) { ids.push(draw(s, t, ids.concat(s.recent))); });
    var lines = ids.map(entry).sort(function (a, b) { return a.t - b.t || a.d - b.d; });
    s.lines = lines; s.idx = 0; s.recent = s.recent.concat(ids).slice(-24);
    startLine(s);
  }
  function startLine(s) {
    var L = s.lines[s.idx];
    s.cur = blank(L.n.length); s.done = false; s.gave = false; s.helped = false; s.peeks = []; s.prev = null;
  }
  function newGame(seed, mode) {
    var s = { v: 1, mode: mode === "daily" ? "daily" : "climb", seed: seed >>> 0, start: seed >>> 0, round: 1, idx: 0,
              lines: [], cur: null, done: false, helped: false, peeks: [], streak: 0, solved: 0, used: 0, edits: 0,
              power: Power.stock(POWERS, { hint: 1, undo: 1 }), prev: null, over: false, recent: [] };
    deal(s); return s;
  }
  function clone(s) { return JSON.parse(JSON.stringify(s)); }
  function line(s) { return s.lines[s.idx]; }
  function tierOf(s) { return line(s).t; }
  function target(s) { return literal(line(s).g); }
  function current(s) { return value(line(s).n, s.cur); }
  function onTarget(s) { var v = current(s).v; return !!v && same(v, target(s)); }
  function canJoin(s) { return TIERS[tierOf(s)].join; }

  // after any change to the line: solved? streak, award
  function settle(s, out) {
    if (!onTarget(s)) return out;
    s.done = true; s.solved++; out.solved = true;
    if (s.helped) s.streak = 0;
    else if (++s.streak >= STREAK) {
      s.streak = 0;
      var got = Power.award(s.power, POWERS, rnd(s)); if (got) out.award = got;
    }
    return out;
  }
  function locked(s) { return s.over || s.done; }
  function cycle(list, cur, dir) { var i = list.indexOf(cur); return list[(i + (dir || 1) + list.length * 2) % list.length]; }

  // edit(state, act) -> {ok, state, solved?, award?, why?}. Every edit is undoable (the snapshot is the whole state).
  //   {k:"gap", i, op?}   set gap i (op) or cycle it          {k:"un", i, u?}  set or cycle the sign on number i
  //   {k:"br", i, j}      add a bracket from number i to j, or remove that same bracket
  //   {k:"bu", x, u?}     set or cycle bracket x's sign; cycling past the last sign removes the bracket
  //   {k:"clear"}         reset the line
  function edit(state, act) {
    if (locked(state) || !act) return { ok: false, state: state, why: "locked" };
    var s = clone(state), L = line(s), n = L.n.length, m = s.cur;
    if (act.k === "gap") {
      if (!(act.i >= 0 && act.i < n - 1)) return { ok: false, state: state, why: "range" };
      var ops = canJoin(s) ? JOPS : OPS;
      var op = act.op !== undefined ? act.op : cycle(ops, m.g[act.i], act.dir);
      if (ops.indexOf(op) < 0 && op !== "") return { ok: false, state: state, why: "tool" };
      m.g[act.i] = op;
    } else if (act.k === "un" || act.k === "br") {
      var Ls = literals(L.n, m.g); if (!Ls) return { ok: false, state: state, why: "dot" };
      var at = function (i) { return Ls.filter(function (l) { return l.i <= i && i <= l.j; })[0]; };
      if (act.k === "un") {
        var l = at(act.i); if (!l) return { ok: false, state: state, why: "range" };
        m.u[l.i] = act.u !== undefined ? act.u : (m.u[l.i] + (act.dir || 1) + UN.length) % UN.length;
      } else {
        var a = at(Math.min(act.i, act.j)), b = at(Math.max(act.i, act.j));
        if (!a || !b) return { ok: false, state: state, why: "range" };
        if (a === b) return { ok: false, state: state, why: "one" }; // one number needs no brackets
        var nb = [a.i, b.j, 0];
        var ex = m.b.findIndex(function (x) { return x[0] === nb[0] && x[1] === nb[1]; });
        if (ex >= 0) m.b.splice(ex, 1);
        else {
          if (m.b.some(function (x) { return crosses(x, nb); })) return { ok: false, state: state, why: "cross" };
          if (m.b.length >= n) return { ok: false, state: state, why: "many" };
          m.b.push(nb);
        }
      }
    } else if (act.k === "bu") {
      var br = m.b[act.x]; if (!br) return { ok: false, state: state, why: "range" };
      if (act.u !== undefined) br[2] = act.u;
      else if (br[2] === UN.length - 1) m.b.splice(act.x, 1);
      else br[2]++;
    } else if (act.k === "clear") {
      s.cur = blank(n);
    } else return { ok: false, state: state, why: "unknown" };
    normalize(L.n, s.cur);
    if (sameM(s.cur, state.cur)) return { ok: false, state: state, why: "same" };
    s.prev = snapshot(state); s.edits++;
    return settle(s, { ok: true, state: s });
  }
  function snapshot(s) { var c = clone(s); c.prev = null; return c; }

  // the next unrevealed step of the known solution, as an edit that makes cur one step closer to it
  function hintStep(tokens, cur, sol) {
    for (var k = 0; k < sol.g.length; k++) if (cur.g[k] !== sol.g[k]) return { act: { k: "gap", i: k, op: sol.g[k] }, kind: "gap", i: k };
    var Ls = literals(tokens, sol.g);
    for (var q = 0; q < Ls.length; q++) { var i = Ls[q].i; if (cur.u[i] !== sol.u[i]) return { act: { k: "un", i: i, u: sol.u[i] }, kind: "un", i: i }; }
    var key = function (b) { return b[0] + ":" + b[1]; };
    for (var x = 0; x < sol.b.length; x++) {
      var sb = sol.b[x], ci = cur.b.findIndex(function (b) { return key(b) === key(sb); });
      if (ci < 0) return { act: { k: "brs", b: sb }, kind: "br", b: sb };
      if (cur.b[ci][2] !== sb[2]) return { act: { k: "bu", x: ci, u: sb[2] }, kind: "bu", b: sb };
    }
    for (var y = 0; y < cur.b.length; y++) if (!sol.b.some(function (b) { return key(b) === key(cur.b[y]); })) return { act: { k: "brx", x: y }, kind: "brx", b: cur.b[y] };
    return null;
  }
  // parts of the known solution a Peek can show: sub-expressions (biggest first) with their values
  function parts(tokens, sol) {
    var Ls = literals(tokens, sol.g), tree = parse(text(tokens, sol)), out = [], seen = {}, q = [];
    var kids = function (nd) { return nd.t === "b" ? [nd.a, nd.b] : nd.t === "n" ? [] : [nd.a]; };
    q.push.apply(q, kids(tree));
    while (q.length) {
      var nd = q.shift();
      if (nd.hi > nd.lo || nd.t !== "n") {
        var i = Ls[nd.lo].i, j = Ls[nd.hi].j, v = evaluate(nd), k = i + ":" + j + ":" + key(v);
        if (!seen[k]) { seen[k] = true; out.push({ i: i, j: j, v: show(v) }); }
      }
      q.push.apply(q, kids(nd));
    }
    return out;
  }

  function useable(s, name) {
    if (!s.power[name]) return false;
    if (name === "undo") return !!s.prev;
    if (s.over) return false;
    if (name === "skip") return !s.done;
    if (s.done) return false;
    if (name === "peek") return s.peeks.length < parts(line(s).n, line(s).sol).length;
    return true;
  }
  // use(state, name) -> {ok, state, ...}: hint {step}, peek {part}, skip, undo.
  // Undo rewinds the last edit and restores that whole snapshot (stock included), so a reward earned by the
  // edit goes away with it.
  function use(state, name) {
    if (!useable(state, name)) return { ok: false, state: state };
    if (name === "undo") {
      var r = clone(state.prev); r.power.undo = Math.max(0, r.power.undo - 1); r.prev = null; r.used = state.used + 1;
      return { ok: true, state: r };
    }
    var s = clone(state), out = { ok: true, state: s };
    s.power[name]--; s.used++;
    if (name === "hint") {
      var L = line(s), st = hintStep(L.n, s.cur, L.sol);
      if (!st) return { ok: false, state: state };
      var a = st.act;
      if (a.k === "brs") { s.cur.b = s.cur.b.filter(function (b) { return !crosses(b, a.b); }); s.cur.b.push(a.b.slice()); }
      else if (a.k === "brx") s.cur.b.splice(a.x, 1);
      else if (a.k === "gap") s.cur.g[a.i] = a.op;
      else if (a.k === "un") s.cur.u[a.i] = a.u;
      else if (a.k === "bu") s.cur.b[a.x][2] = a.u;
      normalize(L.n, s.cur);
      s.helped = true; out.step = st;
      settle(s, out);
    } else if (name === "peek") {
      var P = parts(line(s).n, line(s).sol), part = P[s.peeks.length];
      s.peeks.push(part); s.helped = true; out.part = part;
    } else if (name === "skip") {
      var cur = line(s), others = s.lines.map(function (l) { return l.id; });
      var id = draw(s, cur.t, others.concat(s.recent));
      s.lines[s.idx] = entry(id); s.recent = s.recent.concat([id]).slice(-24); s.streak = 0;
      startLine(s);
    }
    // a spent Hint, Peek or Skip stays spent: they cannot be undone (else Hint + Undo reveals for free)
    s.prev = null;
    return out;
  }
  // after a solved line: move on (or finish the round)
  function next(state) {
    if (!state.done || state.over) return { ok: false, state: state };
    var s = clone(state);
    if (s.idx === s.lines.length - 1) { s.over = true; s.prev = null; return { ok: true, state: s, round: true }; }
    s.idx++; startLine(s); return { ok: true, state: s };
  }
  // give up on the line: the known solution is shown. In Climb that ends the run; in the Daily it moves on.
  function reveal(state) {
    if (locked(state)) return { ok: false, state: state };
    var s = clone(state);
    s.cur = JSON.parse(JSON.stringify(line(s).sol)); s.done = true; s.gave = true; s.helped = true; s.streak = 0; s.prev = null;
    s.revealed = (s.revealed || 0) + 1;
    if (s.mode === "climb") { s.over = true; s.ended = true; }
    return { ok: true, state: s };
  }
  function nextRound(state) {
    if (!state.over || state.mode === "daily" || state.ended) return { ok: false, state: state };
    var s = clone(state); s.round++; s.over = false; deal(s); return { ok: true, state: s };
  }

  return { fr: fr, add: add, sub: sub, mul: mul, div: div, sqrt: sqrt, fact: fact, same: same, show: show, literal: literal,
           UN: UN, unary: unary, solve: solve, tokenize: tokenize, parse: parse, evaluate: evaluate, calc: calc,
           OPS: OPS, JOPS: JOPS, SYM: SYM, blank: blank, literals: literals, normalize: normalize, text: text, value: value,
           treeToModel: treeToModel, TIERS: TIERS, difficulty: difficulty, measure: measure, trivial: trivial,
           BANK: BANK, POOL: POOL, POWERS: POWERS, DAILY: DAILY, STREAK: STREAK,
           newGame: newGame, line: line, target: target, current: current, onTarget: onTarget, canJoin: canJoin,
           edit: edit, use: use, useable: useable, next: next, nextRound: nextRound, reveal: reveal, hintStep: hintStep, parts: parts };
});
