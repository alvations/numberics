/* SPDX-License-Identifier: Apache-2.0 | Copyright 2026 alvations (Melon Lab)
 * `node tests/test-six.js` */
"use strict";
const fs = require("fs"), path = require("path");
const E = require("../six/engine.js");
let pass = 0, fail = 0;
function t(n, f) { try { f(); pass++; } catch (e) { fail++; console.log("FAIL", n, "\n  ", e.message); } }
function ok(c, m) { if (!c) throw new Error(m || "assertion failed"); }
function eq(a, b, m) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || "") + " got " + JSON.stringify(a) + " want " + JSON.stringify(b)); }
const v = (s) => E.show(E.calc(s));
const rep = (x, n) => Array(n).fill(String(x));

// ---- exact arithmetic ----
t("6.6 and 66.6 are exact fractions", () => {
  eq(E.literal("6.6"), [33, 5]); eq(E.literal("66.6"), [333, 5]); eq(E.literal("666"), [666, 1]);
  eq(E.calc("0.1 + 0.2"), E.literal("0.3")); eq(E.calc("1/3*3"), [1, 1]);
  eq(E.calc("3.3 + 3.3"), [33, 5]); eq(E.calc("5! * 5.55"), [666, 1]); eq(E.calc("1.1 * (1+1+1)!"), [33, 5]);
  eq(v("1/3"), "1/3"); eq(v("13/2"), "6.5"); eq(v("66.6"), "66.6");
});
t("square root only of perfect squares of rationals", () => {
  eq(E.sqrt([9, 4]), [3, 2]); eq(E.sqrt([2, 1]), null); eq(E.sqrt([-4, 1]), null); eq(E.sqrt([0, 1]), [0, 1]);
  eq(E.calc("sqrt(2)"), null); eq(E.calc("√(9/16)"), [3, 4]);
});
t("factorial only of whole numbers 0..10", () => {
  eq(E.fact([0, 1]), [1, 1]); eq(E.fact([10, 1]), [3628800, 1]); eq(E.fact([11, 1]), null);
  eq(E.fact([5, 2]), null); eq(E.fact([-1, 1]), null); eq(E.calc("(3!)!"), [720, 1]);
});
t("division by zero and overflow give no value, never Infinity", () => {
  eq(E.calc("6/(3-3)"), null); eq(E.calc("10!*10!"), null);
});

// ---- parser ----
t("parser: precedence and left associativity", () => {
  eq(v("2+3*4"), "14"); eq(v("2*3+4"), "10"); eq(v("8-4-2"), "2"); eq(v("8/4/2"), "1"); eq(v("2-3+4"), "3");
  eq(v("2 x 3"), "6"); eq(v("6 ÷ 4"), "1.5"); eq(v("7 − 7 ÷ 7"), "6");
});
t("parser: brackets override precedence, nest, and must balance", () => {
  eq(v("(2+3)*4"), "20"); eq(v("2*(3+4)"), "14"); eq(v("((2))"), "2"); eq(v("8-(4-2)"), "6"); eq(v("8/(4/2)"), "4");
  ["(2+3", "2+3)", "2+", "*2", "2 2", "()", "a", "2..2", "1.2.3"].forEach(s => { let threw = false; try { E.parse(s); } catch (e) { threw = true; } ok(threw, "should reject " + s); });
});
t("parser: sqrt prefix, factorial postfix (postfix binds tighter)", () => {
  eq(v("√9"), "3"); eq(v("√√16"), "2"); eq(v("(√9)!"), "6"); eq(v("3!"), "6"); eq(v("√(8+8)"), "4");
  eq(E.calc("√4!"), null); // sqrt of 24, not (sqrt 4)!
  eq(v("(0!+0!+0!)!"), "6"); eq(E.calc("√(10 - 10/10)!"), null); // sqrt of 9! is not exact eq(v("(√(10 - 10/10))!"), "6");
});
t("parser builds a tree with literal spans", () => {
  const tr = E.parse("8 - √√(8 + 8)");
  eq([tr.t, tr.op, tr.lo, tr.hi], ["b", "-", 0, 2]); eq([tr.b.t, tr.b.lo, tr.b.hi], ["s", 1, 2]);
});

// ---- solver ----
t("every digit 0-9 is solvable at tier 1 (three copies make 6)", () => {
  for (let d = 0; d <= 9; d++) { const r = E.solve(rep(d, 3), [6, 1]); ok(r.count > 0, "digit " + d); }
  const z = E.measure(rep(0, 3), "6", 1); eq(E.text(rep(0, 3), z.sol), "(0! + 0! + 0!)!");
});
t("solver uses numbers in order and only the tier's tools", () => {
  eq(E.solve(["6", "6", "6"], [666, 1]).count, 0); // 666 needs joining
  eq(E.solve(["1", "1", "1"], [111, 1]).count, 0);
  ok(E.solve(["1", "1", "1"], [111, 1], { join: true }).count > 0);
  eq(E.solve(["1", "2"], [21, 1], { join: true }).count, 0); // no reordering
  ok(E.solve(["1", "2"], [12, 1], { join: true }).count > 0);
});
t("solver witnesses evaluate to the target through the parser", () => {
  for (let d = 0; d <= 9; d++) for (const n of [3, 4, 5]) {
    const m = E.measure(rep(d, n), "6", n === 3 ? 1 : 2); ok(m, d + "x" + n);
    eq(E.value(rep(d, n), m.sol).v, [6, 1], d + "x" + n + " " + E.text(rep(d, n), m.sol));
  }
});

// ---- the bank: every line re-verified ----
const bankSrc = fs.readFileSync(path.join(__dirname, "../six/bank.js"), "utf8");
t("every bank line re-solves to the stored measurement, and its solution evaluates to the target", () => {
  ok(E.BANK.length >= 80, "bank size " + E.BANK.length);
  E.BANK.forEach((e, i) => {
    const n = e.n.split(" "), m = E.measure(n, e.g, e.t);
    ok(m, "unsolvable " + i);
    eq([m.count, m.cost, m.d], [e.k, e.c, e.d], "measure " + e.n + "=" + e.g);
    eq(E.value(n, e.s).v, E.literal(e.g), "solution of " + e.n);
    ok(!E.trivial(n, e.g), "trivial " + e.n);
  });
});
t("bank lines follow the tier table", () => {
  E.BANK.forEach(e => {
    const n = e.n.split(" "), same = n.every(x => x === n[0]), tools = e.s.g.join("");
    ok(same, "copies of one number " + e.n);
    if (e.t <= 3) { eq(e.g, "6"); ok(!/[j.]/.test(tools), "no joins below tier 4 " + e.n); }
    if (e.t === 1) ok(n.length === 3 && n[0].length === 1, e.n);
    if (e.t === 2) ok((n.length === 4 || n.length === 5) && n[0].length === 1, e.n);
    if (e.t === 3) ok(n[0].length === 2, e.n);
    if (e.t === 4) ok(["66", "6.6"].includes(e.g) && n[0].length === 1 && n.length >= 3 && n.length <= 5, e.n);
    if (e.t === 5) ok(["666", "66.6"].includes(e.g) && n.length >= 3 && n.length <= 5, e.n);
  });
  for (const tier of [1, 2, 3, 4, 5]) ok((E.POOL[tier] || []).length >= 10, "tier " + tier + " pool");
  eq(E.BANK.filter(e => e.t === 1).length, 10, "all ten digits at tier 1");
});
t("tiers are ordered by measured difficulty (median rises tier to tier)", () => {
  const med = [1, 2, 3, 4, 5].map(k => { const d = E.BANK.filter(e => e.t === k).map(e => e.d).sort((a, b) => a - b); return d[d.length >> 1]; });
  for (let k = 1; k < 5; k++) ok(med[k] >= med[k - 1], "medians " + med.join(","));
  ok(med[4] > med[0] + 4, "tier 5 clearly harder than tier 1: " + med.join(","));
});
t("bank is generated, not hand-written (header) and the builder re-creates it", () => {
  ok(/generated by six\/make-bank\.js/.test(bankSrc));
});

// ---- game ----
function solveLine(s) {
  const L = E.line(s), sol = L.sol;
  sol.g.forEach((op, i) => { s = E.edit(s, { k: "gap", i, op }).state; });
  sol.u.forEach((u, i) => { if (u) s = E.edit(s, { k: "un", i, u }).state; });
  sol.b.forEach(b => { s = E.edit(s, { k: "br", i: b[0], j: b[1] }).state; if (b[2]) { const x = s.cur.b.findIndex(c => c[0] === b[0] && c[1] === b[1]); s = E.edit(s, { k: "bu", x, u: b[2] }).state; } });
  return s;
}
t("a new game is deterministic by seed, six lines of one tier, easiest first", () => {
  const a = E.newGame(42, "climb"), b = E.newGame(42, "climb");
  eq(a, b); eq(a.lines.length, 6); ok(a.lines.every(l => l.t === 1));
  for (let k = 2; k < 6; k++) ok(a.lines[k].d >= a.lines[k - 1].d, "sorted after the plain first line");
  eq(new Set(a.lines.map(l => l.id)).size, 6, "distinct lines");
  eq(a.power, { hint: 1, skip: 0, peek: 0, undo: 1 });
});
t("Daily Six: same seed gives the same lines, tiers climb 1 to 5", () => {
  const d = E.newGame(20261120, "daily");
  eq(d.lines.map(l => l.t), E.DAILY); eq(E.newGame(20261120, "daily").lines, d.lines);
  ok(JSON.stringify(E.newGame(20261121, "daily").lines) !== JSON.stringify(d.lines));
});
t("gaps cycle the tier's operators; joining only from tier 4", () => {
  let s = E.newGame(1, "climb"); const seen = [];
  for (let k = 0; k < 5; k++) { s = E.edit(s, { k: "gap", i: 0 }).state; seen.push(s.cur.g[0]); }
  eq(seen, ["+", "-", "*", "/", "+"]);
  eq(E.edit(s, { k: "gap", i: 0, op: "j" }).ok, false);
  s.lines[0] = Object.assign({}, s.lines[0], { t: 4, n: ["3", "3", "3", "3"], g: "66" }); s.cur = E.blank(4);
  s = E.edit(s, { k: "gap", i: 0, op: "j" }).state; s = E.edit(s, { k: "gap", i: 1, op: "+" }).state;
  s = E.edit(s, { k: "gap", i: 2, op: "j" }).state;
  eq(E.text(s.lines[0].n, s.cur), "33 + 33"); ok(s.done, "33 + 33 makes 66");
});
t("an incomplete line has no value; the full line turns gold (done) only on the target", () => {
  let s = E.newGame(3, "climb");
  eq(E.current(s).why, "gap"); ok(!s.done);
  s = solveLine(s); ok(s.done && E.onTarget(s)); eq(s.solved, 1);
  eq(E.edit(s, { k: "gap", i: 0 }).ok, false, "a solved line locks");
});
t("brackets: drag adds, same span removes, crossing refused, sign cycles then removes", () => {
  let s = E.newGame(9, "climb");
  s.lines[0] = Object.assign({}, s.lines[0], { n: ["8", "8", "8", "8"], g: "6" }); s.cur = E.blank(4);
  s = E.edit(s, { k: "br", i: 2, j: 0 }).state; eq(s.cur.b, [[0, 2, 0]]);
  eq(E.edit(s, { k: "br", i: 1, j: 3 }).why, "cross");
  eq(E.edit(s, { k: "br", i: 1, j: 1 }).why, "one");
  s = E.edit(s, { k: "br", i: 1, j: 2 }).state; eq(s.cur.b, [[0, 2, 0], [1, 2, 0]]);
  for (let u = 1; u <= 4; u++) { s = E.edit(s, { k: "bu", x: 0 }).state; eq(s.cur.b[0][2], u); }
  s = E.edit(s, { k: "bu", x: 0 }).state; eq(s.cur.b, [[1, 2, 0]], "cycled past the last sign removes it");
  s = E.edit(s, { k: "br", i: 1, j: 2 }).state; eq(s.cur.b, []);
});
t("joining drops brackets and signs that no longer fit the literals", () => {
  let s = E.newGame(9, "climb");
  s.lines[0] = Object.assign({}, s.lines[0], { t: 4, n: ["2", "2", "2"], g: "66" }); s.cur = E.blank(3);
  s = E.edit(s, { k: "br", i: 0, j: 1 }).state; s = E.edit(s, { k: "un", i: 1, u: 1 }).state;
  s = E.edit(s, { k: "gap", i: 0, op: "j" }).state;
  eq(s.cur.b, []); eq(s.cur.u, [0, 0, 0]);
  s = E.edit(s, { k: "gap", i: 1, op: "." }).state; eq(E.text(s.lines[0].n, s.cur), "22.2");
  s = E.edit(s, { k: "gap", i: 0, op: "." }).state; eq(E.current(s).why, "dot");
});
t("Hint reveals a step of a real solution, and repeated hints solve every bank line", () => {
  E.BANK.forEach((e, id) => {
    let s = E.newGame(5, "climb");
    s.lines[0] = { id, t: e.t, n: e.n.split(" "), g: e.g, d: e.d, sol: e.s }; s.cur = E.blank(s.lines[0].n.length);
    let steps = 0;
    while (!s.done && steps < 40) {
      s.power.hint = 1;
      const before = JSON.stringify(s.cur), r = E.use(s, "hint");
      ok(r.ok, "hint usable on " + e.n); s = r.state; steps++;
      ok(JSON.stringify(s.cur) !== before, "hint changed the line");
      const st = r.step;
      if (st.kind === "gap") eq(s.cur.g[st.i], e.s.g[st.i]);
      if (st.kind === "un") eq(s.cur.u[st.i], e.s.u[st.i]);
    }
    ok(s.done && E.onTarget(s), "hints solved " + e.n + " = " + e.g);
    ok(s.helped && s.streak === 0, "hinted lines are helped");
  });
});
t("Peek shows the value of a real part of the solution", () => {
  let s = E.newGame(5, "climb"); const id = E.BANK.findIndex(e => e.n === "8 8 8");
  s.lines[0] = { id, t: 1, n: ["8", "8", "8"], g: "6", d: 0, sol: E.BANK[id].s }; s.cur = E.blank(3); s.power.peek = 2;
  const r = E.use(s, "peek"); ok(r.ok);
  const p = r.part, tx = E.text(["8", "8", "8"], E.BANK[id].s);
  ok(p.i <= p.j, "span"); ok(r.state.peeks.length === 1 && r.state.helped);
  eq(p, { i: 0, j: 2, v: "3" }, "inside of " + tx);
  eq(E.use(r.state, "peek").part, { i: 0, j: 2, v: "9" }, "then deeper");
  E.BANK.forEach(e => { E.parts(e.n.split(" "), e.s).forEach(q => ok(q.v !== "?", "part value of " + e.n)); });
});
t("three lines in a row without help earn one power-up; help resets the streak", () => {
  let s = E.newGame(11, "climb"); const before = s.power.hint + s.power.skip + s.power.peek + s.power.undo;
  for (let k = 0; k < 3; k++) { s = solveLine(s); if (k < 2) s = E.next(s).state; }
  const after = s.power.hint + s.power.skip + s.power.peek + s.power.undo;
  eq(after, before + 1); eq(s.streak, 0);
  s = E.next(s).state; s.power.peek = 1; s = E.use(s, "peek").state; s = solveLine(s); eq(s.streak, 0, "peeked line breaks the streak");
});
t("Undo rewinds the last edit; spent Hint stays spent", () => {
  let s = E.newGame(11, "climb"); s.power.undo = 2;
  const pre = JSON.parse(JSON.stringify(s));
  s = E.edit(s, { k: "gap", i: 0, op: "+" }).state;
  const u = E.use(s, "undo"); ok(u.ok); s = u.state;
  eq(s.cur, pre.cur); eq(s.power.undo, pre.power.undo - 1); eq(s.used, pre.used + 1, "Undo counts as a power-up used");
  eq(E.use(s, "undo").ok, false, "one level of undo");
  s = E.edit(s, { k: "gap", i: 0, op: "+" }).state;
  s.power.hint = 1; s = E.use(s, "hint").state; eq(s.prev, null); eq(E.useable(s, "undo"), false, "a hint cannot be undone");
});
t("R1: Undo is refused on a made line, an ended round and an ended run, with a reason", () => {
  let s = E.newGame(11, "climb"); s.power.undo = 3;
  const L = E.line(s);
  L.sol.g.slice(0, -1).forEach((op, i) => { s = E.edit(s, { k: "gap", i, op }).state; });
  L.sol.u.forEach((u, i) => { if (u) s = E.edit(s, { k: "un", i, u }).state; });
  L.sol.b.forEach(b => { s = E.edit(s, { k: "br", i: b[0], j: b[1] }).state; if (b[2]) { const x = s.cur.b.findIndex(c => c[0] === b[0] && c[1] === b[1]); s = E.edit(s, { k: "bu", x, u: b[2] }).state; } });
  const last = L.sol.g.length - 1; s = E.edit(s, { k: "gap", i: last, op: L.sol.g[last] }).state;
  ok(s.done && s.prev, "made, with a snapshot behind it");
  eq(E.useable(s, "undo"), false, "no Undo across a made line"); eq(E.use(s, "undo").ok, false);
  eq(E.why(s, "undo"), "A made line cannot be taken back.");
  eq(E.why(s, "hint"), "This line is already made.");
  for (let k = 0; k < 5; k++) { s = E.next(s).state; s = solveLine(s); }
  s = E.next(s).state; ok(s.over); eq(E.useable(s, "undo"), false); eq(E.why(s, "undo"), "The round is over.");
  let r = E.newGame(12, "climb"); r.power.undo = 1; r = E.edit(r, { k: "gap", i: 0 }).state; r = E.reveal(r).state;
  eq(E.useable(r, "undo"), false); eq(E.why(r, "undo"), "The game is over.");
  let f = E.newGame(13, "climb"); eq(E.why(f, "undo"), "Nothing to take back yet."); f.power.undo = 0; eq(E.why(f, "undo"), "", "no charge: the earn text explains it");
});
t("R2: a Hint that makes the line never pays a reward, even on a two-clean-lines streak", () => {
  let s = E.newGame(14, "climb"); s.streak = 2; s.power.hint = 9;
  const tot = p => p.hint + p.skip + p.peek + p.undo, before = tot(s.power);
  let spent = 0; while (!s.done) { const r = E.use(s, "hint"); ok(r.ok && !r.award, "no award"); s = r.state; spent++; }
  eq(tot(s.power), before - spent, "stock only went down"); eq(s.streak, 0);
});
t("used rises by exactly one per power-up, Undo included", () => {
  let s = E.newGame(15, "climb"); s.power = { hint: 2, skip: 2, peek: 2, undo: 2 };
  ["peek", "hint", "skip"].forEach(n => { const u0 = s.used; s = E.use(s, n).state; eq(s.used, u0 + 1, n); });
  s = E.edit(s, { k: "gap", i: 0 }).state; const u0 = s.used; s = E.use(s, "undo").state; eq(s.used, u0 + 1, "undo");
});
t("the first line of a run needs only + - x / (no signs, no brackets), on every seed and Daily", () => {
  for (let seed = 1; seed <= 400; seed++) {
    const a = E.newGame(seed, "climb"); ok(E.plain(a.lines[0]), "climb seed " + seed + " " + a.lines[0].n.join(" "));
    eq(a.lines[0].t, 1); for (let k = 2; k < 6; k++) ok(a.lines[k].d >= a.lines[k - 1].d, "rest sorted " + seed);
    eq(new Set(a.lines.map(l => l.id)).size, 6, "distinct " + seed);
    const v = E.value(a.lines[0].n, a.lines[0].sol).v; eq(v, E.literal(a.lines[0].g), "the plain solution works");
  }
  for (let day = 20261101; day <= 20261130; day++) {
    const d = E.newGame(day, "daily"); ok(E.plain(d.lines[0]), "daily " + day); eq(d.lines.map(l => l.t), E.DAILY);
  }
  ok(E.BANK.filter(e => e.t === 1 && e.c === 0 && !e.s.b.length).length >= 3, "enough plain tier-1 lines");
});
t("Peek says why it cannot act once every part is shown", () => {
  let s = E.newGame(5, "climb"); s.power.peek = 9;
  while (E.useable(s, "peek")) s = E.use(s, "peek").state;
  eq(E.why(s, "peek"), "Every part is already shown.");
});
t("Skip gives a new line in the same tier and resets the streak", () => {
  let s = E.newGame(21, "climb"); s.power.skip = 1; s.streak = 2;
  const old = E.line(s), r = E.use(s, "skip"); ok(r.ok);
  const nw = E.line(r.state); eq(nw.t, old.t); ok(nw.id !== old.id); eq(r.state.streak, 0); eq(r.state.power.skip, 0);
  ok(!r.state.lines.some((l, k) => k !== r.state.idx && l.id === nw.id), "not a line already in the round");
});
t("a round of six ends; Climb's next round climbs a tier; Daily does not continue", () => {
  let s = E.newGame(31, "climb");
  for (let r = 1; r <= 6; r++) {
    eq(s.round, r); ok(s.lines.every(l => l.t === (r <= 5 ? r : l.t)), "tier of round " + r);
    for (let k = 0; k < 6; k++) { s = solveLine(s); const n = E.next(s); ok(n.ok); s = n.state; }
    ok(s.over, "round over"); s = E.nextRound(s).state;
  }
  ok([3, 4, 5].includes(E.line(s).t), "after round 5 the climb mixes tiers 3-5");
  let d = E.newGame(20261120, "daily");
  for (let k = 0; k < 6; k++) { d = solveLine(d); d = E.next(d).state; }
  ok(d.over); eq(E.nextRound(d).ok, false);
});
t("Answer shows the known solution: it ends a Climb run, and moves the Daily on", () => {
  let s = E.newGame(51, "climb"); const r = E.reveal(s); ok(r.ok);
  s = r.state; ok(s.done && s.gave && s.over && s.ended && E.onTarget(s)); eq(s.solved, 0, "not counted as made");
  eq(E.nextRound(s).ok, false, "an ended run has no next round");
  let d = E.newGame(20261120, "daily"); d = E.reveal(d).state; ok(d.done && !d.over); d = E.next(d).state; eq(d.idx, 1); ok(!d.gave);
});
t("power-ups cap at 9", () => {
  let s = E.newGame(41, "climb"); s.power = { hint: 9, skip: 9, peek: 9, undo: 9 };
  for (let k = 0; k < 3; k++) { s = solveLine(s); if (k < 2) s = E.next(s).state; }
  eq(s.power, { hint: 9, skip: 9, peek: 9, undo: 9 });
});
t("engine and client never eval or build functions from strings", () => {
  ["six/engine.js", "six/game.js", "six/bank.js", "six/make-bank.js"].forEach(f => {
    const src = fs.readFileSync(path.join(__dirname, "..", f), "utf8");
    ok(!/\beval\s*\(|new\s+Function|Function\s*\(|setTimeout\s*\(\s*["']/.test(src), f);
  });
});
t("engine is pure: no DOM, storage or clock", () => {
  const src = fs.readFileSync(path.join(__dirname, "../six/engine.js"), "utf8");
  ok(!/document\.|window\.|localStorage|Date\.now|Math\.random|new Date/.test(src));
});

require("./conventions")(t, ok, ["six/engine.js", "six/game.js", "six/index.html", "six/style.css", "six/bank.js", "six/make-bank.js"]);
console.log(pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
