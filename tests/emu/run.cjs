/* SPDX-License-Identifier: Apache-2.0 | Copyright 2026 alvations (Melon Lab)
 * Browser checks for every game module in tests/emu/<id>.cjs. Opt-in, self-skips without Playwright.
 *   node tests/emu/run.cjs [id ...]      SHOTS=<dir> also saves screenshots
 * A module exports: async function ({ browser, url, ck, shot }) where url = base URL of the site root
 * and ck(name, cond, detail) records a check. Each run uses a random free port (agents run in parallel). */
"use strict";
let chromium; try { ({ chromium } = require("playwright")); } catch (e) { console.log("skip: playwright not installed"); process.exit(0); }
const http = require("http"), fs = require("fs"), path = require("path");
const root = path.join(__dirname, "..", "..");
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml" };
const srv = http.createServer((q, r) => {
  let f = path.join(root, decodeURIComponent(q.url.split("?")[0]));
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, "index.html");
  if (!f.startsWith(root) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { "content-type": types[path.extname(f)] || "application/octet-stream" }); r.end(fs.readFileSync(f));
});
const ids = process.argv.slice(2);
const mods = fs.readdirSync(__dirname).filter(f => f.endsWith(".cjs") && f !== "run.cjs" && !f.startsWith("_")) // _name.cjs: shared helpers
  .map(f => f.replace(/\.cjs$/, "")).filter(id => !ids.length || ids.includes(id)).sort();
let pass = 0, fail = 0;
(async () => {
  await new Promise(r => srv.listen(0, "127.0.0.1", r));
  const url = "http://127.0.0.1:" + srv.address().port + "/";
  const browser = await chromium.launch();
  for (const id of mods) {
    const ck = (n, c, d) => { if (c) pass++; else { fail++; console.log("FAIL", id + ":", n, d || ""); } };
    const shot = async (p, n) => { if (process.env.SHOTS) await p.screenshot({ path: path.join(process.env.SHOTS, id + "-" + n + ".png") }); };
    try { await require(path.join(__dirname, id + ".cjs"))({ browser, url, ck, shot }); }
    catch (e) { fail++; console.log("FAIL", id + ": crashed", e && e.stack || e); }
  }
  await browser.close(); srv.close();
  console.log(pass + " passed, " + fail + " failed"); process.exit(fail ? 1 : 0);
})().catch(e => { console.log(e); srv.close(); process.exit(1); });
