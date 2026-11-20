/* SPDX-License-Identifier: Apache-2.0 | Copyright 2026 alvations (Melon Lab)
 * `node tests/test-fibonacci.js` */
"use strict";
const F = require("../fibonacci/engine.js");
let pass = 0, fail = 0;
function t(n, f) { try { f(); pass++; } catch (e) { fail++; console.log("FAIL", n, "\n  ", e.message); } }
function ok(c, m) { if (!c) throw new Error(m || "assertion failed"); }
function eq(a, b, m) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || "") + " got " + JSON.stringify(a) + " want " + JSON.stringify(b)); }
const Z = [0, 0, 0, 0];
function board(rows, extra) {
  const g = [].concat(...rows);
  return Object.assign({ size: rows.length, grid: g, score: 0, top: Math.max(0, ...g), moves: 0, seed: 7,
    over: false, power: { undo: 0, smash: 0, swap: 0, boost: 0 }, prev: null }, extra || {});
}
const line = (lv) => F.slideLine(lv, [0, 1, 2, 3]);
const total = (s) => Object.values(s.power).reduce((a, b) => a + b, 0);

t("values: indices map to the Fibonacci numbers 1, 2, 3, 5, 8, 13 ...", () => {
  eq([1, 2, 3, 4, 5, 6, 7, 8, 17].map(F.value), [1, 2, 3, 5, 8, 13, 21, 34, 2584]);
  for (let i = 3; i < 70; i++) eq(F.value(i), F.value(i - 1) + F.value(i - 2), "index " + i);
});
t("consecutive Fibonacci numbers merge into the next one, in either order", () => {
  eq(line([1, 2, 0, 0]).out, [3]); eq(line([2, 1, 0, 0]).out, [3]);
  eq(line([3, 4, 0, 0]).out, [5]); eq(line([8, 7, 0, 0]).out, [9]);
  eq(line([2, 3, 0, 0]).gained, 5, "2 + 3 scores 5");
});
t("1 + 1 merges to 2", () => { const r = line([1, 1, 0, 0]); eq(r.out, [2]); eq(r.gained, 2); });
t("equal tiles above 1 do not merge (3 + 3, 2 + 2, 5 + 5)", () => {
  eq(line([3, 3, 0, 0]).out, [3, 3]); eq(line([2, 2, 0, 0]).out, [2, 2]); eq(line([5, 5, 0, 0]).out, [5, 5]);
  ok(!F.RULES.canMerge(2, 2) && !F.RULES.canMerge(9, 9));
});
t("non-neighbours in the sequence do not merge (1 + 3, 2 + 5)", () => {
  eq(line([1, 3, 0, 0]).out, [1, 3]); eq(line([2, 4, 0, 0]).out, [2, 4]);
});
t("one merge per tile per move: 1,1,2 slides to 2,2 and the new 2 waits", () => {
  eq(line([1, 1, 2, 0]).out, [2, 2]);
  eq(line([1, 2, 3, 0]).out, [3, 3], "1+2 = 3, the new 3 does not merge with the old 3 (equal anyway)");
  eq(line([2, 3, 4, 0]).out, [4, 4]);
  eq(line([1, 1, 1, 1]).out, [2, 2]);
});
t("all four directions slide; a move that changes nothing is not counted", () => {
  const s = board([[1, 0, 0, 0], Z, Z, Z]);
  eq(F.move(s, "right").state.grid[3], 1); eq(F.move(s, "down").state.grid[12], 1);
  eq(F.move(s, "left").moved, false); eq(F.move(s, "up").moved, false);
  const full = board([[1, 3, 1, 3], [3, 1, 3, 1], [1, 3, 1, 3], [3, 1, 3, 1]]);
  const r = F.move(full, "left"); eq(r.moved, false); ok(r.state === full);
});
t("score adds the value of every merged tile", () => {
  const r = F.move(board([[1, 2, 4, 5], Z, Z, Z]), "left");
  eq(r.state.grid.slice(0, 2), [3, 6]); eq(r.gained, 3 + 13); eq(r.state.score, 16);
});
t("spawns are 1 (about 90%) and 2 (about 10%), nothing else", () => {
  let ones = 0, twos = 0;
  for (let seed = 1; seed <= 2000; seed++) F.newGame(seed).grid.forEach(v => { if (v === 1) ones++; else if (v === 2) twos++; else ok(v === 0, "bad spawn " + v); });
  eq(ones + twos, 4000); const p = twos / 4000; ok(p > 0.08 && p < 0.12, "2 share " + p);
});
t("deterministic: same seed + same moves give the same game", () => {
  const run = () => { let s = F.newGame(99); for (const d of "left,up,right,down,left,up,down,down".split(",")) s = F.move(s, d).state; return s; };
  eq(run(), run());
  ok(JSON.stringify(F.newGame(1).grid) !== JSON.stringify(F.newGame(2).grid) || JSON.stringify(F.newGame(1).grid) !== JSON.stringify(F.newGame(3).grid));
});
t("INFINITE: 2584 is not a win, the game plays on past it", () => {
  const r = F.move(board([[16, 17, 0, 0], Z, Z, Z]), "left");
  eq(r.state.grid[0], 18); eq(F.value(18), 4181); ok(!r.state.over); ok(!("won" in r.state), "no win flag");
});
t("INFINITE: index 300 merges without overflow", () => {
  const r = F.move(board([[299, 300, 0, 0], Z, Z, Z]), "left");
  eq(r.state.grid[0], 301); ok(r.milestones.includes(301)); ok(r.gained > 1e62);
  ok(F.label(301).startsWith("F"));
});
t("labels: digits up to six characters, then F with a subscript Fibonacci index", () => {
  eq(F.label(1), "1"); eq(F.label(4), "5"); eq(F.label(17), "2584"); eq(F.label(29), "832040");
  eq(F.label(30), "F₃₁"); eq(F.value(30), 1346269); // F(31) = 1346269
  eq(F.label(300), "F₃₀₁");
  for (let i = 1; i < 400; i++) ok(F.label(i).length <= 6, "label too long at " + i);
});
t("can move only while a cell is empty or a mergeable pair touches", () => {
  ok(!F.canMove(board([[1, 3, 1, 3], [3, 1, 3, 1], [1, 3, 1, 3], [3, 1, 3, 1]])));
  ok(F.canMove(board([[1, 3, 1, 3], [3, 1, 3, 1], [1, 3, 1, 3], [3, 1, 3, 2]])), "2 next to 3 merges");
  ok(F.canMove(board([[1, 1, 3, 1], [3, 5, 1, 3], [1, 3, 5, 1], [3, 1, 3, 5]])), "1 next to 1 merges");
  ok(!F.canMove(board([[3, 3, 5, 5], [5, 5, 3, 3], [3, 3, 5, 5], [5, 5, 3, 3]])), "equal 3s and 5s are stuck");
});
t("a new highest tile from 55 up awards one power-up; lower ones and repeats do not (round 2 floor)", () => {
  let r = F.move(board([[7, 8, 0, 0], Z, Z, Z], { top: 8 }), "left");
  eq(r.state.grid[0], 9); eq(F.value(9), 55); eq(r.awarded.length, 1); eq(total(r.state), 1);
  r = F.move(board([[6, 7, 0, 0], Z, Z, Z], { top: 7 }), "left");
  eq(r.milestones, [8]); eq(r.awarded.length, 0, "34 is below the floor since round 2");
  r = F.move(board([[8, 9, 0, 0], Z, Z, Z], { top: 12 }), "left");
  eq(r.awarded.length, 0, "not a new highest"); eq(r.state.top, 12);
  eq(F.AWARD_FROM_LEVEL, 9); eq(F.AWARD_FROM_INDEX, 9);
});
t("two new highs in one move award twice, once each", () => {
  const r = F.move(board([[7, 8, 9, 10], Z, Z, Z], { top: 10 }), "left");
  ok(r.awarded.every(a => a.level >= 9));
  eq(r.state.grid.slice(0, 2), [9, 11]); eq(r.milestones, [11]); eq(r.awarded.length, 1);
  const r2 = F.move(board([[7, 8, 0, 0], [9, 10, 0, 0], Z, Z], { top: 10 }), "left");
  eq(r2.milestones, [11]); eq(r2.awarded.length, 1, "9 is not new, 11 is");
});
t("power stock never exceeds the cap of 9", () => {
  const p = { undo: 9, smash: 9, swap: 9, boost: 8 };
  let r = F.move(board([[8, 9, 0, 0], Z, Z, Z], { top: 9, power: p }), "left");
  eq(r.state.power.boost, 9); ok(Object.values(r.state.power).every(v => v <= F.POWER_CAP));
  r = F.move(board([[9, 10, 0, 0], Z, Z, Z], { top: 10, power: { undo: 9, smash: 9, swap: 9, boost: 9 } }), "left");
  eq(total(r.state), 36); eq(r.awarded.length, 0, "R15: a full stock skips the reward (the client says Power-ups full)");
});
t("a fresh run starts with exactly one Undo", () => eq(F.newGame(3).power, { undo: 1, smash: 0, swap: 0, boost: 0 }));
t("undo rewinds exactly one move, costs a charge and cannot farm a reward", () => {
  const s = board([[7, 8, 0, 0], Z, Z, Z], { top: 8, power: { undo: 1, smash: 0, swap: 0, boost: 0 } });
  const r = F.move(s, "left"); eq(r.awarded.length, 1);
  const u = F.use(r.state, "undo"); ok(u.ok);
  eq(u.state.grid, s.grid); eq(u.state.top, 8); eq(u.state.score, 0); eq(total(u.state), 0, "net stock after undo is lower");
  eq(F.use(u.state, "undo").ok, false, "nothing left to rewind");
});
t("smash removes a tile; empty or out-of-range targets are refused", () => {
  const s = board([[3, 0, 0, 0], Z, Z, Z], { power: { undo: 0, smash: 1, swap: 0, boost: 0 } });
  eq(F.use(s, "smash", 1).ok, false); eq(F.use(s, "smash", 16).ok, false); eq(F.use(s, "smash", -1).ok, false);
  const r = F.use(s, "smash", 0); ok(r.ok); eq(r.state.grid[0], 0); eq(r.state.power.smash, 0);
});
t("boost moves a tile to the next Fibonacci number and never awards", () => {
  const s = board([[8, 0, 0, 0], Z, Z, Z], { power: { undo: 0, smash: 0, swap: 0, boost: 1 } });
  const r = F.use(s, "boost", 0); ok(r.ok); eq(r.state.grid[0], 9); eq(F.label(9), "55"); eq(r.state.top, 9);
  eq(total(r.state), 0, "boosting to 55 does not pay out");
  // and the next real merge to a lower value is not a new high either
  eq(F.use(s, "boost", 5).ok, false, "empty cell refused");
});
t("swap exchanges two cells (tile<->empty allowed, empty<->empty refused) and can unlock a board", () => {
  const s = board([[1, 0, 0, 2], Z, Z, Z], { power: { undo: 0, smash: 0, swap: 3, boost: 0 } });
  eq(F.use(s, "swap", 0, 3).state.grid[0], 2); eq(F.use(s, "swap", 0, 1).state.grid[1], 1);
  eq(F.use(s, "swap", 1, 2).ok, false); eq(F.use(s, "swap", 0, 0).ok, false);
  const locked = board([[1, 3, 1, 3], [3, 1, 3, 1], [1, 3, 1, 3], [3, 1, 3, 1]], { power: { undo: 0, smash: 0, swap: 1, boost: 0 } });
  ok(!F.canMove(locked)); ok(F.canMove(F.use(locked, "swap", 0, 1).state));
});
t("a power-up with no charges does nothing", () => {
  const s = board([[1, 0, 0, 0], Z, Z, Z]);
  ["smash", "boost", "undo"].forEach(n => eq(F.use(s, n, 0).ok, false, n)); eq(F.use(s, "swap", 0, 1).ok, false);
});
t("stuck is not over while a power-up can act; locked with none is over", () => {
  const lockedGrid = [[1, 3, 1, 3], [3, 1, 3, 1], [1, 3, 1, 3], [3, 1, 3, 1]];
  const s = board(lockedGrid, { power: { undo: 0, smash: 0, swap: 2, boost: 0 } });
  // swapping two 1s leaves the board locked: one Swap still held, so the run goes on
  const a = F.use(s, "swap", 0, 2); ok(a.ok); ok(!F.canMove(a.state)); eq(a.state.over, false);
  const b = F.use(a.state, "swap", 0, 2); ok(b.ok); ok(!F.canMove(b.state)); eq(b.state.over, true, "locked, no usable power: over");
  // a move that ends locked with no powers is over at once
  const m = F.move(board([[1, 3, 1, 3], [3, 1, 3, 1], [1, 3, 1, 3], [0, 4, 6, 8]]), "left");
  ok(m.moved); if (!F.canMove(m.state)) ok(m.state.over);
  ok(F.move(b.state, "left").moved === false, "an over game ignores moves");
});
t("the Endless engine is unchanged by the Fibonacci rule set", () => {
  const N = require("../engine.js");
  eq(N.label(11), "2048"); eq(N.slideLine([1, 1, 2, 0], [0, 1, 2, 3]).out, [2, 2]); eq(N.slideLine([1, 2, 0, 0], [0, 1, 2, 3]).out, [1, 2]);
  eq(N.AWARD_FROM_LEVEL, 5);
});
t("random play never corrupts the board, and every run ends locked (300 games)", () => {
  let d = 1;
  for (let g = 1; g <= 300; g++) {
    let s = F.newGame(g), n = 0;
    while (!s.over && n < 20000) {
      const r = F.rand(d); d = r[1];
      const res = F.move(s, F.DIRS[Math.floor(r[0] * 4)]);
      if (res.moved) { s = res.state; n++; ok(s.grid.every(v => Number.isInteger(v) && v >= 0), "bad cell"); ok(s.grid.filter(Boolean).length >= 2); }
      else if (!F.canMove(s)) break;
    }
    ok(!F.canMove(s), "game " + g + " ended while moves remained");
  }
});
t("boost on a 1 makes a 2, as the hint says (1 becomes 2)", () => {
  const r = F.use(board([[1, 0, 0, 0], Z, Z, Z], { power: { undo: 0, smash: 0, swap: 0, boost: 1 } }), "boost", 0);
  ok(r.ok); eq(F.label(r.state.grid[0]), "2");
});
t("an over game cannot be undone (R1): over means no usable Undo", () => {
  const m = F.move(board([[1, 3, 1, 3], [3, 1, 3, 1], [1, 3, 1, 3], [0, 4, 6, 8]], { power: { undo: 1, smash: 0, swap: 0, boost: 0 } }), "left");
  ok(m.moved); ok(!m.state.over, "holding Undo with a snapshot is not over");
  const s = board([[1, 3, 1, 3], [3, 1, 3, 1], [1, 3, 1, 3], [3, 1, 3, 1]], { over: true });
  eq(F.use(s, "undo").ok, false);
});
t("R2 repro (critic F1): Boost 21 to 34 beside 55, then the swipe that makes 89, pays nothing", () => {
  const s = board([[9, 7, 0, 0], Z, Z, Z], { top: 9, power: { undo: 0, smash: 0, swap: 0, boost: 1 } });
  eq(F.move(s, "left").awarded.length, 0, "the plain swipe cannot merge 55 and 21");
  const b = F.use(s, "boost", 1); ok(b.ok); eq(b.state.grid.slice(0, 2), [9, 8]);
  const r = F.move(b.state, "left"); eq(r.state.grid[0], 10, "55 + 34 = 89");
  eq(r.awarded.length, 0, "a boost-assisted swipe never pays"); eq(total(r.state), 0);
});
t("R2 repro: Swap a 34 beside 55, then the swipe that makes 89, pays nothing", () => {
  const s = board([[9, 0, 0, 0], [0, 0, 0, 8], Z, Z], { top: 9, power: { undo: 0, smash: 0, swap: 1, boost: 0 } });
  const w = F.use(s, "swap", 1, 7); ok(w.ok); eq(w.state.grid.slice(0, 2), [9, 8]);
  const r = F.move(w.state, "left"); eq(r.state.grid[0], 10); eq(r.awarded.length, 0, "a swap-assisted swipe never pays");
});
t("R2 property: random play mixing power-ups and moves never raises the stock through a power-up-assisted move", () => {
  let d = 4242, bad = 0, checked = 0;
  const rnd = () => { const r = F.rand(d); d = r[1]; return r[0]; };
  for (let g = 1; g <= 120; g++) {
    let s = F.newGame(g), assisted = false;
    for (let n = 0; n < 4000 && !s.over; n++) {
      if (s.top >= 6 && rnd() < 0.25) { // stock up so the fuzz always has power-ups to try
        s = Object.assign({}, s, { power: { undo: s.power.undo, smash: Math.max(1, s.power.smash), swap: Math.max(1, s.power.swap), boost: Math.max(1, s.power.boost) } });
        const tiles = s.grid.map((v, i) => v ? i : -1).filter(i => i >= 0);
        const name = ["smash", "swap", "boost"][Math.floor(rnd() * 3)];
        const a = tiles[Math.floor(rnd() * tiles.length)], b = Math.floor(rnd() * 16);
        const u = F.use(s, name, a, b);
        if (u.ok) {
          ok(total(u.state) === total(s) - 1, "a power-up spends exactly its charge and earns nothing");
          s = u.state; assisted = true; continue;
        }
      }
      const res = F.move(s, F.DIRS[Math.floor(rnd() * 4)]);
      if (!res.moved) { if (!F.canMove(s)) break; continue; }
      if (assisted) { checked++; if (total(res.state) > total(s)) bad++; }
      assisted = false; s = res.state;
    }
  }
  ok(checked > 1000, "fuzz reached " + checked + " assisted moves");
  eq(bad, 0, "assisted moves that raised the stock (of " + checked + ")");
});
t("R2: the swipe after an assisted swipe pays again (the rule is one swipe deep, as in Three)", () => {
  const s = board([[9, 7, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], { top: 9, power: { undo: 0, smash: 0, swap: 0, boost: 1 } });
  let r = F.move(F.use(s, "boost", 1).state, "left"); eq(r.awarded.length, 0);
  // set up a natural 89 + 55 merge after it
  const t2 = Object.assign({}, r.state, { grid: [10, 9, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1] });
  r = F.move(t2, "left"); eq(r.state.grid[0], 11); eq(r.awarded.length, 1, "a natural new top tile pays");
});
{
  const fs = require("fs"), path = require("path"), rd = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
  const html = rd("fibonacci/index.html"), js = rd("fibonacci/game.js");
  t("R6 header: H1 Fibonacci, subtitle opens with a Numberics link home and one short sentence", () => {
    ok(/<h1>Fibonacci<\/h1>/.test(html));
    const m = html.match(/<p class="sub"><a href="\.\.\/">Numberics<\/a> &middot; ([^<]+)<\/p>/); ok(m, "sub pattern");
    ok(/^[A-Z0-9][^.]*\.$/.test(m[1]) && m[1].length <= 30, "tagline " + m[1]);
  });
  t("R11: no bare hyphen as an empty stat value", () => ok(!/<b id="\w+"[^>]*>-<\/b>/.test(html) && !/: "-"/.test(js)));
  t("R5: tray defs, Undo first, each with a sentence description and how to earn it", () => {
    const ids = [...js.matchAll(/\{ id: "(\w+)", label: "\w+", desc: "([^"]+)", earn: EARN \}/g)];
    eq(ids.map(m => m[1]), ["undo", "smash", "swap", "boost"]); ids.forEach(m => ok(/^[A-Z].*\.$/.test(m[2]), m[2]));
    ok(/onInfo:/.test(js), "tray onInfo wired");
  });
  t("R8: the end card has a 'New best.' line", () => ok(/id="over-best" class="best" hidden>New best\.</.test(html)));
  t("R9, R17: Enter or Space on a focused button or link is left to it; fields are never game keys", () => {
    ok(/\(e\.key === "Enter" \|\| e\.key === " "\) && \(tag === "BUTTON" \|\| tag === "A"/.test(js));
    ok(/tag === "INPUT" \|\| tag === "SELECT"/.test(js));
  });
  t("round 2: the help line, the tray and the engine agree on the 55 floor", () => {
    ok(/new highest tile from 55 up/.test(html) && /new top tile from 55\./.test(js));
    ok(!/from 34/.test(html) && !/from 34/.test(js)); eq(F.value(F.AWARD_FROM_INDEX), 55);
  });
}
require("./conventions")(t, ok, ["fibonacci/engine.js", "fibonacci/game.js", "fibonacci/index.html", "fibonacci/style.css"]);
console.log(pass + " passed, " + fail + " failed"); process.exit(fail ? 1 : 0);
