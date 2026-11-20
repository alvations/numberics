/* SPDX-License-Identifier: Apache-2.0 | Copyright 2026 alvations (Melon Lab)
 * Screenshots of every live game in games.json -> screenshots/<id>-{mobile,desktop}.png
 * Run: NODE_PATH=$(npm root -g) node tools/shots.cjs [id ...]   (npm run shots)
 * With ids, shoots exactly those games whatever their status (use it while building a planned game).
 * A game opts into a representative state by defining window.__demo(); otherwise its fresh page is shot. */
"use strict";
const { chromium } = require("playwright");
const http = require("http"), fs = require("fs"), path = require("path");
const root = path.join(__dirname, ".."), out = path.join(root, "screenshots");
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json" };
const srv = http.createServer((q, r) => {
  let f = path.join(root, decodeURIComponent(q.url.split("?")[0]));
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, "index.html");
  if (!f.startsWith(root) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { "content-type": types[path.extname(f)] || "application/octet-stream" }); r.end(fs.readFileSync(f));
});
const VIEWS = [
  { tag: "mobile", viewport: { width: 390, height: 844 } },
  { tag: "desktop", viewport: { width: 1280, height: 860 } },
];
(async () => {
  fs.mkdirSync(out, { recursive: true });
  await new Promise(r => srv.listen(0, "127.0.0.1", r));
  const port = srv.address().port, ids = process.argv.slice(2);
  const games = JSON.parse(fs.readFileSync(path.join(root, "games.json"), "utf8")).filter(g => ids.length ? ids.includes(g.id) : g.status === "live");
  const b = await chromium.launch();
  let bad = 0;
  for (const g of games) for (const v of VIEWS) {
    const ctx = await b.newContext({ viewport: v.viewport, deviceScaleFactor: 2, reducedMotion: "reduce" });
    const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
    await p.goto("http://127.0.0.1:" + port + "/" + g.path);
    await p.evaluate(() => { if (typeof window.__demo === "function") window.__demo(); });
    await p.waitForTimeout(400);
    const file = path.join(out, g.id + "-" + v.tag + ".png");
    await p.screenshot({ path: file });
    if (errs.length) { bad++; console.log("ERR", g.id, errs.join("|")); }
    console.log("wrote", path.relative(root, file));
    await ctx.close();
  }
  await b.close(); srv.close(); process.exit(bad ? 1 : 0);
})().catch(e => { console.log(e); srv.close(); process.exit(1); });
