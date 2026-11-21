/* SPDX-License-Identifier: Apache-2.0 | Copyright 2026 alvations (Melon Lab)
 * The deploy (.github/workflows/pages.yml, critic round 5 S1): runs the workflow's own `assemble` step on this tree and
 * checks every file each published page loads is published; a failing beta keeps the live beta; the publish message
 * names each branch's real commit. `node tests/test-deploy.js` */
"use strict";
const fs = require("fs"), path = require("path"), os = require("os"), { spawnSync } = require("child_process");
let pass = 0, fail = 0;
function t(n, f) { try { f(); pass++; } catch (e) { fail++; console.log("FAIL", n, "\n  ", e.message); } }
function ok(c, m) { if (!c) throw new Error(m || "assertion failed"); }
const ROOT = path.join(__dirname, ".."), yml = fs.readFileSync(path.join(ROOT, ".github/workflows/pages.yml"), "utf8");

// the assemble function exactly as the workflow has it (the YAML block's 10-space indent removed)
const fn = (() => {
  const lines = yml.split("\n"), i = lines.findIndex(l => /^\s*assemble \(\) \{/.test(l));
  const ind = lines[i].match(/^\s*/)[0].length, out = [];
  for (let k = i; k < lines.length; k++) { out.push(lines[k].slice(ind)); if (k > i && lines[k].slice(ind) === "}") break; }
  return out.join("\n");
})();

const site = fs.mkdtempSync(path.join(os.tmpdir(), "numberics-site-"));
const run = spawnSync("bash", ["-c", fn + '\nassemble "$1" "$2"', "x", ROOT, site], { encoding: "utf8" });

t("the workflow's assemble step runs on this tree", () => ok(run.status === 0 && fs.existsSync(path.join(site, "index.html")), run.stderr));

t("every local file a published page loads is published (no 404, whichever layout)", () => {
  const pages = [];
  (function walk(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (f.endsWith(".html")) pages.push(p); } })(site);
  ok(pages.length >= 10, "pages: " + pages.length);
  const missing = [];
  for (const p of pages) {
    const html = fs.readFileSync(p, "utf8").replace(/<!--[\s\S]*?-->/g, "");
    for (const m of html.matchAll(/(?:src|href)="([^"#?]+)"/g)) {
      const u = m[1];
      if (/^(https?:|data:|mailto:|\/\/)/.test(u)) continue;
      let f = path.resolve(path.dirname(p), u); if (u.endsWith("/")) f = path.join(f, "index.html");
      if (!fs.existsSync(f)) missing.push(path.relative(site, p) + " -> " + u);
    }
  }
  ok(missing.length === 0, missing.join(", "));
});

t("every live game in games.json is published, Two at two/", () => {
  const games = JSON.parse(fs.readFileSync(path.join(ROOT, "games.json"), "utf8")).filter(g => g.status === "live");
  ok(games.every(g => fs.existsSync(path.join(site, g.path, "index.html"))), "missing game page");
});

t("a failing beta keeps the published beta (never deletes it)", () =>
  ok(/--branch gh-pages[\s\S]*cp -r old\/beta _site\/beta/.test(yml), "no keep-beta step"));

t("the publish message names each branch's own commit, not the pushed one", () =>
  ok(/git -C stable rev-parse/.test(yml) && /git -C beta rev-parse/.test(yml) && !/GITHUB_SHA/.test(yml), "label"));

t("publishes as the owner only", () => ok(/user\.name=alvations -c user\.email=alvations@gmail\.com/.test(yml) && !/Co-Authored-By|noreply@anthropic|Claude-Session/i.test(yml)));

fs.rmSync(site, { recursive: true, force: true });
console.log(pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
