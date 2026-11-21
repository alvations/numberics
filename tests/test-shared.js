/* SPDX-License-Identifier: Apache-2.0 | Copyright 2026 alvations (Melon Lab)
 * Shared kit + power-up system + nav registry. `node tests/test-shared.js` */
"use strict";
const fs = require("fs"), path = require("path");
const K = require("../shared/kit.js"), P = require("../shared/power.js");
let pass = 0, fail = 0;
function t(n, f) { try { f(); pass++; } catch (e) { fail++; console.log("FAIL", n, "\n  ", e.message); } }
function ok(c, m) { if (!c) throw new Error(m || "assertion failed"); }
const root = path.join(__dirname, "..");
t("rand is a deterministic pure step in [0,1)", () => {
  const a = K.rand(42), b = K.rand(42); ok(a[0] === b[0] && a[1] === b[1]); ok(a[0] >= 0 && a[0] < 1);
  const r = K.rng(7), q = K.rng(7); for (let i = 0; i < 50; i++) ok(r() === q());
});
t("power stock: award respects the cap and skips full slots", () => {
  const s = P.stock(["undo", "a", "b", "c"], { undo: 1 });
  ok(s.undo === 1 && s.a === 0);
  s.a = 9; s.b = 9; s.c = 9; s.undo = 9; ok(P.award(s, ["undo", "a", "b", "c"], 0.5) === null);
  s.c = 3; ok(P.award(s, ["undo", "a", "b", "c"], 0.99) === "c" && s.c === 4);
  ok(P.spend(s, "c") && s.c === 3); s.a = 0; ok(!P.spend(s, "a"));
});
t("nav LIVE list matches the live games in games.json, in order", () => {
  const games = JSON.parse(fs.readFileSync(path.join(root, "games.json"), "utf8")).filter(g => g.status === "live");
  const src = fs.readFileSync(path.join(root, "shared/nav.js"), "utf8");
  const live = JSON.parse(src.match(/var LIVE = (\[[\s\S]*?\]);/)[1].replace(/'/g, '"'));
  ok(JSON.stringify(live) === JSON.stringify(games.map(g => [g.id, g.name, g.path, g.blurb].concat(g.vs ? [1] : []))), "nav: " + JSON.stringify(live));
});
t("O-7 order: every games list runs Fibonacci, Two, Three, Four, Five, Six, Seven, Nine, Fifteen, Sudoku (games.json drives it)", () => {
  const games = JSON.parse(fs.readFileSync(path.join(root, "games.json"), "utf8")).filter(g => g.status === "live");
  const O7 = ["fibonacci", "two", "three", "four", "five", "six", "seven", "nine", "fifteen", "sudoku"];
  ok(JSON.stringify(games.map(g => g.id)) === JSON.stringify(O7), "games.json: " + games.map(g => g.id).join());
  ok(JSON.stringify(require("../shared/nav.js").map(g => g[0])) === JSON.stringify(O7), "nav.js mirror");
  ok(games.find(g => g.id === "two").path === "two/", "Two has its own page in two/ (O-9)");
  ok(!games.some(g => g.id === "endless"), "the old id is gone from games.json (saves and trophies still accept it)");
});
t("C1 card copy (REDESIGN.md 3.3): names, blurbs and vs-computer flags as specified", () => {
  const want = { fibonacci: ["Fibonacci", "Join neighbours in the Fibonacci run."], two: ["Two", "2048 with no top tile."],
    three: ["Three", "Count in threes, make rainbow rows."], four: ["Four", "Four in a row, or four that make ten.", 1],
    five: ["Five", "Add tile onto tile; at five it bursts.", 1], six: ["Six", "Put signs between numbers to make six."],
    seven: ["Seven", "Drop discs; a number pops when it fits."], nine: ["Nine", "Take from the heaps. Take the last to win.", 1],
    fifteen: ["Fifteen", "Pick three numbers that make fifteen.", 1], sudoku: ["Sudoku", "The classic 9 by 9. One answer only."] };
  JSON.parse(fs.readFileSync(path.join(root, "games.json"), "utf8")).forEach(g => {
    const w = want[g.id]; ok(w && g.name === w[0] && g.blurb === w[1] && !!g.vs === !!w[2], g.id);
  });
});
t("nav.js draws a CSS-only preview for every game (no images, no requests)", () => {
  const src = fs.readFileSync(path.join(root, "shared/nav.js"), "utf8");
  const pv = src.slice(src.indexOf("var PV = {"), src.indexOf("function progress"));
  require("../shared/nav.js").forEach(g => ok(new RegExp("\\n    " + g[0] + ": ").test(pv), "preview " + g[0]));
  ok(!/<img|url\(|https?:/.test(pv), "CSS only");
});
t("every games.json entry is well formed and paths are unique", () => {
  const games = JSON.parse(fs.readFileSync(path.join(root, "games.json"), "utf8"));
  const seen = new Set();
  games.forEach(g => { ok(g.id && g.name && typeof g.path === "string" && /^(live|planned)$/.test(g.status), g.id); ok(!seen.has(g.path), "dup " + g.path); seen.add(g.path); });
  games.filter(g => g.status === "live").forEach(g => ok(/^[a-z]+\/$/.test(g.path) && fs.existsSync(path.join(root, g.path, "index.html")), g.id + " page"));
});
t("O-9: every games list links Two to two/ and the home link is the root, the games page", () => {
  const nav = require("../shared/nav.js"), ui = fs.readFileSync(path.join(root, "shared/ui.js"), "utf8");
  ok(nav.find(g => g[0] === "two")[2] === "two/", "nav.js mirror");
  ok(nav.every(g => g[2] && g[2] !== "./"), "no game is the root any more");
  ok(/class="tb-home" href="' \+ \(root \|\| "\.\/"\) \+ '" aria-label="Numberics home"/.test(ui), "the top bar mark goes to data-root, the games page");
  // no page or tool still points at Two's old root files
  const scan = d => fs.readdirSync(path.join(root, d), { withFileTypes: true }).flatMap(e => e.isDirectory() ? (/^(node_modules|screenshots|\.git)$/.test(e.name) ? [] : scan(path.join(d, e.name)))
    : /\.(html|js|cjs)$/.test(e.name) ? [path.join(d, e.name)] : []);
  const bad = scan(".").filter(f => !/^docs[\\/]/.test(f)).filter(f => /src="(\.\.\/)+engine\.js"|require\("(\.\.\/)+engine\.js"\)/.test(fs.readFileSync(path.join(root, f), "utf8")));
  ok(!bad.length, "still loads the old root engine.js: " + bad.join(", "));
});
require("./conventions")(t, ok, ["shared/kit.js", "shared/power.js", "shared/nav.js", "shared/theme.css", "shared/boot.js",
  "shared/settings.js", "shared/motion.js", "shared/audio.js", "shared/trophies.js", "shared/progress.js", "shared/ui.js"]);
console.log(pass + " passed, " + fail + " failed"); process.exit(fail ? 1 : 0);
