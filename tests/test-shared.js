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
t("every games.json entry is well formed and paths are unique", () => {
  const games = JSON.parse(fs.readFileSync(path.join(root, "games.json"), "utf8"));
  const seen = new Set();
  games.forEach(g => { ok(g.id && g.name && typeof g.path === "string" && /^(live|planned)$/.test(g.status), g.id); ok(!seen.has(g.path), "dup " + g.path); seen.add(g.path); });
  games.filter(g => g.status === "live" && g.path).forEach(g => ok(fs.existsSync(path.join(root, g.path, "index.html")), g.id + " page"));
});
require("./conventions")(t, ok, ["shared/kit.js", "shared/power.js", "shared/nav.js", "shared/theme.css", "shared/boot.js",
  "shared/settings.js", "shared/motion.js", "shared/audio.js", "shared/trophies.js", "shared/progress.js", "shared/ui.js"]);
console.log(pass + " passed, " + fail + " failed"); process.exit(fail ? 1 : 0);
