/* SPDX-License-Identifier: Apache-2.0 | Copyright 2026 alvations (Melon Lab)
 * The one How to play sheet (shared/howto.js, NumbericsUI.howto; TRIAGE4 D8), checked on every game's source: one
 * helper, the row's one label, no per-game copy of the sheet or of the first-visit rule. Its behaviour (the title
 * pattern, Play, the first-visit rule, keys blocked while open) is proven in a browser: tests/emu/shared-howto.cjs.
 * `node tests/test-howto.js` */
"use strict";
const fs = require("fs"), path = require("path"), root = path.join(__dirname, "..");
const read = f => fs.readFileSync(path.join(root, f), "utf8");
let pass = 0, fail = 0;
function t(n, f) { try { f(); pass++; } catch (e) { fail++; console.log("FAIL", n, "\n  ", e.message); } }
function ok(c, m) { if (!c) throw new Error(m || "assertion failed"); }
const games = JSON.parse(read("games.json")).filter(g => g.status === "live");
const page = g => (g.path || "") + "index.html", client = g => (g.path || "") + "game.js";

t("shared/howto.js: SPDX, no em-dash, no storage of its own, the label and the title pattern", () => {
  const s = read("shared/howto.js");
  ok(/SPDX-License-Identifier: Apache-2\.0/.test(s) && !/\u2014/.test(s) && !/localStorage|document\.write/.test(s));
  ok(/LABEL = "Show the three steps"/.test(s) && /"How to play" \+/.test(s) && /textContent = "Play"/.test(s));
  ok(/seenHowto/.test(s) && /markHowto/.test(s) && /opts\.saved/.test(s), "the first-visit rule lives here");
});
t("shared/ui.js exposes it as NumbericsUI.howto with one delegating line at the end", () => {
  const s = read("shared/ui.js").trim().split("\n");
  ok(/window\.NumbericsUI\.howto = function \(id, o\) \{ return window\.NumbericsHowto \? window\.NumbericsHowto\.howto\(id, o\) : null; \};$/.test(s[s.length - 1]), s[s.length - 1]);
});
games.forEach(g => t(g.name + ": loads the helper, one row button, migrated (no copy of the sheet)", () => {
  const h = read(page(g)), js = read(client(g));
  const pre = g.path ? "../" : "";
  ok(h.indexOf('<script src="' + pre + 'shared/howto.js"></script>') > 0, "howto.js loaded");
  ok(h.indexOf("shared/howto.js") < h.indexOf('<script src="game.js">'), "before game.js");
  const btns = h.match(/<button[^>]*data-howto[^>]*>([^<]*)<\/button>/g) || [];
  ok(btns.length === 1 && />Show the three steps<\/button>$/.test(btns[0]), "one row button, one label: " + btns.join());
  ok(new RegExp('\\.howto\\((ID|"' + g.id + '"), \\{ title: "' + g.name + '", steps: STEPS, saved: ').test(js), "calls the shared helper with its name");
  ok(js.indexOf('ID = "' + g.id + '"') >= 0 || js.indexOf('.howto("' + g.id + '"') >= 0, "its own id");
  ok(!/sheet\("howto"/.test(js) && !/seenHowto/.test(js) && !/class="howto"/.test(js), "no per-game sheet or first-visit copy"); // Three keeps one markHowto: an old save's dismissed explainer counts as seen
  ok((js.match(/\{ (picture|text): /g) || []).length >= 3, "its steps as {text, picture}");
}));

console.log(pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
