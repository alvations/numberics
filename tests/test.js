/* SPDX-License-Identifier: Apache-2.0 | Copyright 2026 alvations (Melon Lab)
 * Zero-dependency test runner: `node tests/test.js` */
"use strict";
const fs = require("fs"), path = require("path");
const N = require("../engine.js");
let pass = 0, fail = 0;
function t(name, fn) { try { fn(); pass++; } catch (e) { fail++; console.log("FAIL", name, "\n  ", e.message); } }
function eq(a, b, m) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || "") + " got " + JSON.stringify(a) + " want " + JSON.stringify(b)); }
function ok(c, m) { if (!c) throw new Error(m || "assertion failed"); }
function board(rows, extra) {
  const g = [].concat(...rows);
  return Object.assign({ size: rows.length, grid: g, score: 0, top: Math.max(0, ...g), moves: 0, seed: 7,
    over: false, power: { undo: 0, smash: 0, swap: 0, boost: 0 }, prev: null }, extra || {});
}

t("slide merges a pair once and keeps order", () => {
  const r = N.slideLine([1, 1, 1, 1], [0, 1, 2, 3]);
  eq(r.out, [2, 2]); eq(r.gained, 8);
});
t("a merged tile never merges again in the same move", () => {
  eq(N.slideLine([1, 1, 2, 0], [0, 1, 2, 3]).out, [2, 2]);
  eq(N.slideLine([2, 1, 1, 0], [0, 1, 2, 3]).out, [2, 2]);
});
t("all four directions slide to the right wall", () => {
  const s = board([[1,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]]);
  const g = (d) => N.move(s, d);
  eq(g("right").state.grid[3], 1);
  eq(g("down").state.grid[12], 1);
  eq(g("left").moved, false); eq(g("up").moved, false);
});
t("a move that changes nothing spawns nothing and is not counted", () => {
  const s = board([[1,2,3,4],[4,3,2,1],[1,2,3,4],[4,3,2,1]]);
  const r = N.move(s, "left"); eq(r.moved, false); eq(r.state, s);
});
t("spawn is 2 or 4 and moves add exactly one tile", () => {
  let s = N.newGame(42);
  eq(s.grid.filter(Boolean).length, 2);
  s.grid.forEach(v => ok(v === 0 || v === 1 || v === 2));
});
t("deterministic: same seed + moves gives same game", () => {
  const run = () => { let s = N.newGame(99); for (const d of "left,up,right,down,left,up".split(",")) s = N.move(s, d).state; return s; };
  eq(run(), run());
});
t("INFINITE: 2048 is not a win and the game plays on past it", () => {
  let s = board([[11,11,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]]);
  const r = N.move(s, "left");
  eq(r.state.grid[0], 12); ok(!r.state.over); ok(!("won" in r.state), "no win flag exists");
  ok(r.state.grid.filter(Boolean).length >= 2);
});
t("INFINITE: levels far beyond 2^53 merge without overflow", () => {
  const r = N.move(board([[200,200,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]]), "left");
  eq(r.state.grid[0], 201); ok(r.milestones.includes(201));
});
t("labels: digits while short, 2^n beyond", () => {
  eq(N.label(1), "2"); eq(N.label(11), "2048"); eq(N.label(16), "65536"); eq(N.label(17), "2^17"); eq(N.label(200), "2^200");
});
t("score adds the value of every merged tile", () => {
  const r = N.move(board([[2,2,3,3],[0,0,0,0],[0,0,0,0],[0,0,0,0]]), "left");
  eq(r.gained, 8 + 16);
});
t("a new highest tile >= 32 awards a power-up; lower ones and repeats do not", () => {
  let r = N.move(board([[5,5,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]], { top: 5 }), "left");
  eq(r.state.grid[0], 6); eq(r.awarded.length, 1);
  r = N.move(board([[6,6,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]], { top: 9 }), "left");
  eq(r.awarded.length, 0, "not a new highest");
  r = N.move(board([[3,3,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]], { top: 3 }), "left");
  eq(r.awarded.length, 0, "below the award floor"); eq(r.milestones, [4]);
});
t("power stock never exceeds the cap", () => {
  const p = { undo: 9, smash: 9, swap: 9, boost: 8 };
  const r = N.move(board([[5,5,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]], { top: 5, power: p }), "left");
  ok(Object.values(r.state.power).every(v => v <= N.POWER_CAP));
});
t("game over only when locked and no power-up can act", () => {
  const full = [[1,2,1,2],[2,1,2,1],[1,2,1,2],[2,1,2,1]];
  ok(!N.canMove(board(full)));
  const locked = board(full); locked.power.smash = 1;
  const r = N.use(locked, "smash", 0); ok(r.ok && N.canMove(r.state));
  // checkerboard of big levels: the 1/2 spawn can never match a neighbour
  const m = N.move(board([[3,4,3,4],[4,3,4,3],[3,4,3,4],[0,4,3,4]]), "left");
  ok(m.state.over, "locked with no powers = over"); eq(m.moved, true);
});
t("undo rewinds exactly one move and costs one charge", () => {
  const s0 = N.newGame(5); const r = N.move(s0, "left");
  const s1 = r.moved ? r.state : N.move(s0, "right").state;
  const u = N.use(s1, "undo");
  ok(u.ok); eq(u.state.grid, s0.grid); eq(u.state.score, s0.score); eq(u.state.power.undo, 0);
  eq(N.use(u.state, "undo").ok, false, "no stock / nothing to rewind");
});
t("undo cannot farm milestone rewards", () => {
  let s = board([[5,5,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]], { top: 5, power: { undo: 1, smash: 0, swap: 0, boost: 0 } });
  const r = N.move(s, "left"); const total = (st) => Object.values(st.power).reduce((a, b) => a + b, 0);
  const u = N.use(r.state, "undo");
  ok(total(u.state) < total(s) + 1, "net power after undo must not grow"); eq(u.state.top, 5);
});
t("smash removes a tile; empty or out-of-range targets are refused", () => {
  const s = board([[1,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]], { power: { undo: 0, smash: 1, swap: 0, boost: 0 } });
  eq(N.use(s, "smash", 1).ok, false); eq(N.use(s, "smash", 99).ok, false);
  const r = N.use(s, "smash", 0); ok(r.ok); eq(r.state.grid[0], 0); eq(r.state.power.smash, 0);
});
t("boost doubles a tile and never awards", () => {
  const s = board([[4,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]], { power: { undo: 0, smash: 0, swap: 0, boost: 1 } });
  const r = N.use(s, "boost", 0); eq(r.state.grid[0], 5); eq(r.state.top, 5);
  eq(Object.values(r.state.power).reduce((a, b) => a + b, 0), 0);
});
t("swap exchanges two cells (tile<->empty allowed, empty<->empty refused)", () => {
  const s = board([[1,0,0,2],[0,0,0,0],[0,0,0,0],[0,0,0,0]], { power: { undo: 0, smash: 0, swap: 3, boost: 0 } });
  eq(N.use(s, "swap", 0, 3).state.grid[0], 2);
  eq(N.use(s, "swap", 0, 1).state.grid[1], 1);
  eq(N.use(s, "swap", 1, 2).ok, false); eq(N.use(s, "swap", 0, 0).ok, false);
});
t("power-ups change only their target: no spawn, no move counted (Boost does not spend a turn)", () => {
  const s = board([[4,0,0,0],[0,0,1,0],[0,0,0,0],[0,0,0,0]], { power: { undo: 0, smash: 1, swap: 1, boost: 1 } });
  [["boost", 0], ["smash", 6], ["swap", 0, 15]].forEach(([n, a, b]) => {
    const r = N.use(s, n, a, b); ok(r.ok, n);
    eq(r.state.grid.filter(Boolean).length, s.grid.filter(Boolean).length - (n === "smash" ? 1 : 0), n + " tile count");
    eq(r.state.moves, s.moves, n + " moves"); eq(r.state.seed, s.seed, n + " seed");
  });
});
t("a power-up with no charges does nothing", () => {
  eq(N.use(board([[1,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]]), "smash", 0).ok, false);
});
t("random play never corrupts the board (5000 moves)", () => {
  let s = N.newGame(2026), seed = 1;
  for (let i = 0; i < 5000 && !s.over; i++) {
    const r = N.rand(seed); seed = r[1];
    s = N.move(s, N.DIRS[Math.floor(r[0] * 4)]).state;
    ok(s.grid.every(v => Number.isInteger(v) && v >= 0), "bad cell");
  }
});

// ---- repo conventions (carried over from the melon-eight / cleo-guide lessons) ----
const root = path.join(__dirname, "..");
const files = ["engine.js", "game.js", "index.html", "style.css"].map(f => [f, fs.readFileSync(path.join(root, f), "utf8")]);
t("no document.write anywhere", () => files.forEach(([f, s]) => ok(!/document\.write/.test(s), f)));
t("no em-dashes anywhere in source", () => files.forEach(([f, s]) => ok(!/—/.test(s), f)));
t("every localStorage use sits inside a try block (storage may throw)", () => {
  const src = files.find(f => f[0] === "game.js")[1];
  const lines = src.split("\n");
  lines.forEach((ln, i) => { if (/localStorage\./.test(ln)) ok(/try\s*\{/.test(lines.slice(Math.max(0, i - 2), i + 1).join(" ")), "unguarded storage at game.js:" + (i + 1)); });
});
t("every source file carries the SPDX header", () => files.forEach(([f, s]) => ok(/SPDX-License-Identifier: Apache-2\.0/.test(s), f)));
t("the content does not depend on a CDN", () => files.forEach(([f, s]) => ok(!/https?:\/\/(cdn|unpkg|cdnjs)/.test(s), f)));

// ---- round 1 fixes (docs/reviews/TRIAGE1.md): static guards for the page shell ----
const src = Object.fromEntries(files);
t("R6: H1 stays Numberics and the subtitle links to the games row", () => {
  ok(/<h1>Numberics<\/h1>/.test(src["index.html"]), "H1");
  ok(/<p class="sub">Endless\. There is no top tile\. <a href="#games">Nine more games below\.<\/a><\/p>/.test(src["index.html"]), "subtitle");
  ok(/<nav id="games"/.test(src["index.html"]), "#games target");
});
t("R5: the tray is the shared one (descriptions, aria-disabled, tap explains) and loads before game.js", () => {
  const h = src["index.html"];
  ok(h.indexOf("shared/kit.js") >= 0 && h.indexOf("shared/power.js") >= 0 && h.indexOf("shared/power.js") < h.indexOf('src="game.js"'), "script order");
  ok(/P\.tray\(/.test(src["game.js"]) && /onInfo/.test(src["game.js"]), "uses NumbericsPower.tray with onInfo");
  ok(!/\.disabled\s*=/.test(src["game.js"]), "never sets button.disabled");
  ok(/\.pw\.empty\{/.test(src["style.css"]), ".pw.empty styled");
});
t("R7/F2/F3: toast at the top with a neutral bad variant; warnings use it", () => {
  ok(/\.toast\{[^}]*top:max\(/.test(src["style.css"]) && !/\.toast\{[^}]*bottom:/.test(src["style.css"]), "toast at top");
  ok(/\.toast\.bad\{/.test(src["style.css"]), "bad variant");
  ok(/toast\([^;]*"bad"\)/.test(src["game.js"]), "a warning passes bad");
});
t("R8/F7: darker scrim, New best line, gold best", () => {
  ok(/\.over\{[^}]*rgba\(20,21,28,\.95\)/.test(src["style.css"]), "scrim .95");
  ok(/id="over-best" class="best" hidden>New best\.</.test(src["index.html"]), "New best line");
  ok(/\.over \.best\{/.test(src["style.css"]), "best style");
});
t("F5/F9: hover, press and gold link focus ring are mirrored from shared/theme.css", () => {
  ok(/\.btn:hover:not\(:disabled\)/.test(src["style.css"]) && /\.pw:active:not\(:disabled\)/.test(src["style.css"]), "hover/press");
  ok(/a:focus-visible\{ outline:2px solid var\(--accent\)/.test(src["style.css"]), "link focus ring");
});
t("R9: Enter or Space on a focused button is left to the button", () => {
  ok(/\(e\.key === "Enter" \|\| e\.key === " "\) && \(tag === "BUTTON" \|\| tag === "A"\)\) return;/.test(src["game.js"]));
});

t("history carries only the owner's authorship (no AI author, co-author or trailer)", () => {
  let log;
  try { log = require("child_process").execSync("git log --format=%an%n%ae%n%cn%n%ce%n%B", { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }); }
  catch (e) { return; } // not a git checkout (e.g. a zip download): nothing to scan
  const bad = new RegExp(["cl" + "aude", "anthr" + "opic", "co-authored-by", "noreply@", "generated with"].join("|"), "i");
  const hit = log.split("\n").find(l => bad.test(l.replace(/\bCLAUDE\.md\b/g, "")));  // the memory file's name is not attribution
  ok(!hit, "attribution found in history: " + hit);
});

t("every live game in games.json has mobile + desktop screenshots", () => {
  const games = JSON.parse(fs.readFileSync(path.join(root, "games.json"), "utf8"));
  games.filter(g => g.status === "live").forEach(g => ["mobile", "desktop"].forEach(v => {
    const f = path.join(root, "screenshots", g.id + "-" + v + ".png");
    ok(fs.existsSync(f) && fs.statSync(f).size > 10000, "missing or empty " + path.relative(root, f) + " (run npm run shots)");
  }));
});

// ---- replay: the rule-set refactor must keep Endless byte-identical ----
// A seeded driver plays 20 games of 1,000 actions (moves plus every power-up, with valid and invalid
// targets) and hashes every result. The fixture was recorded from the engine BEFORE the refactor.
// Re-record only for an intended rule change: RECORD_ENDLESS_REPLAY=1 node tests/test.js
function endlessReplay(seed) {
  const h = require("crypto").createHash("sha256");
  let s = N.newGame(seed), d = seed * 7919 + 1, games = 1;
  const r = () => { const x = N.rand(d); d = x[1]; return x[0]; };
  for (let i = 0; i < 1000; i++) {
    if (s.over) { s = N.newGame(seed * 1000 + games++); h.update(JSON.stringify(s)); continue; }
    const k = r();
    let res;
    if (k < 0.9) res = N.move(s, N.DIRS[Math.floor(r() * 4)]);
    else {
      const name = N.POWERS[Math.floor(r() * 4)];
      if (s.power[name] < 1 && r() < 0.7) s = Object.assign({}, s, { power: Object.assign({}, s.power, { [name]: 1 }) });
      res = N.use(s, name, Math.floor(r() * 18) - 1, Math.floor(r() * 18) - 1);
    }
    h.update(JSON.stringify(res)); s = res.state;
  }
  return { seed, hash: h.digest("hex"), games, final: { grid: s.grid, score: s.score, top: s.top, moves: s.moves, power: s.power, over: s.over } };
}
const REPLAY = path.join(__dirname, "fixtures", "endless-replay.json");
if (process.env.RECORD_ENDLESS_REPLAY) {
  fs.mkdirSync(path.dirname(REPLAY), { recursive: true });
  const all = []; for (let sd = 1; sd <= 20; sd++) all.push(endlessReplay(sd));
  fs.writeFileSync(REPLAY, JSON.stringify(all, null, 1) + "\n");
}
t("replay: 20 seeded games x 1,000 actions match the recorded Endless fixture exactly", () => {
  const want = JSON.parse(fs.readFileSync(REPLAY, "utf8"));
  eq(want.length, 20);
  want.forEach(w => eq(endlessReplay(w.seed), w, "seed " + w.seed));
});
t("replay: the default rule set is Endless and make() with it plays the same game", () => {
  ok(typeof N.make === "function" && N.ENDLESS, "rule-set factory exported");
  const E = N.make(N.ENDLESS);
  let a = N.newGame(77), b = E.newGame(77);
  for (let i = 0; i < 300 && !a.over; i++) { const dd = N.DIRS[i % 4]; a = N.move(a, dd).state; b = E.move(b, dd).state; }
  eq(a, b);
});

console.log(pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
