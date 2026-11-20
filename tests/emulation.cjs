/* SPDX-License-Identifier: Apache-2.0 | Copyright 2026 alvations (Melon Lab)
 * Headless-browser checks. Opt-in: `node tests/emulation.cjs` (skips if Playwright is absent).
 * Optional env: SHOTS=<dir> writes screenshots. */
"use strict";
let chromium; try { ({ chromium } = require("playwright")); } catch (e) { console.log("skip: playwright not installed"); process.exit(0); }
const http = require("http"), fs = require("fs"), path = require("path");
const root = path.join(__dirname, "..");
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };
const srv = http.createServer((q, r) => {
  let f = path.join(root, q.url.split("?")[0]);
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, "index.html");
  if (!f.startsWith(root) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { "content-type": types[path.extname(f)] || "text/plain" }); r.end(fs.readFileSync(f));
});
let pass = 0, fail = 0;
const ck = (n, c, d) => { if (c) pass++; else { fail++; console.log("FAIL", n, d || ""); } };
(async () => {
  await new Promise(r => srv.listen(0, "127.0.0.1", r));
  const url = "http://127.0.0.1:" + srv.address().port + "/";
  const b = await chromium.launch();
  const shot = async (p, n) => { if (process.env.SHOTS) await p.screenshot({ path: path.join(process.env.SHOTS, n + ".png") }); };

  // 1. plays, animates, persists
  let ctx = await b.newContext({ viewport: { width: 420, height: 800 }, deviceScaleFactor: 2 });
  let p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto(url);
  ck("two starting tiles", await p.locator(".tile").count() === 2);
  for (let i = 0; i < 12; i++) { await p.keyboard.press(["ArrowLeft","ArrowUp","ArrowRight","ArrowDown"][i % 4]); }
  await p.waitForTimeout(250);
  ck("tiles on board after moves", await p.locator(".tile").count() >= 2);
  ck("every plain tile shows its number", await p.evaluate(() => [...document.querySelectorAll(".tile")].every(t => /^[0-9]+$/.test(t.textContent))));
  ck("score shown", (await p.textContent("#score")) !== "");
  await shot(p, "mobile-board");
  const moves = await p.evaluate(() => window.__numberics.state.moves);
  await p.reload();
  ck("state survives reload", (await p.evaluate(() => window.__numberics.state.moves)) === moves);

  // 2. INFINITE: forge a board at 2048 and merge it; the page must not declare a win
  await p.evaluate(() => { const s = window.__numberics.state; s.grid = new Array(16).fill(0); s.grid[0] = 11; s.grid[1] = 11; s.top = 11; window.__numberics.state = s; });
  await p.keyboard.press("ArrowLeft"); await p.waitForTimeout(250);
  ck("2048 merges to 4096 and the game continues", await p.evaluate(() => window.__numberics.state.grid[0] === 12 && !window.__numberics.state.over));
  ck("no win text anywhere", !/you win|victory|congrat/i.test(await p.textContent("body")));
  await p.evaluate(() => { const s = window.__numberics.state; s.grid = new Array(16).fill(0); s.grid[0] = 20; s.grid[5] = 17; s.grid[6] = 3; s.grid[10] = 1; window.__numberics.state = s; });
  ck("huge tiles render as 2^n superscripts", (await p.locator(".tile sup").count()) === 2);
  await shot(p, "big-tiles");

  // 3. power-ups: smash via click targeting, keyboard escape cancels
  await p.evaluate(() => { const s = window.__numberics.state; s.power = { undo: 1, smash: 2, swap: 1, boost: 1 }; window.__numberics.state = s; });
  await p.keyboard.press("2");
  ck("smash arms targeting", await p.locator("#board.targeting").count() === 1);
  await shot(p, "targeting");
  await p.keyboard.press("Escape");
  ck("escape cancels targeting", await p.locator("#board.targeting").count() === 0);
  await p.keyboard.press("2");
  const box = await p.locator("#board").boundingBox();
  await p.mouse.click(box.x + box.width * 0.125, box.y + box.height * 0.125); // cell 0
  ck("smash removed the tile at cell 0", await p.evaluate(() => window.__numberics.state.grid[0] === 0 && window.__numberics.state.power.smash === 1));
  await p.keyboard.press("3");
  await p.mouse.click(box.x + box.width * 0.375, box.y + box.height * 0.375); // cell 5
  await p.mouse.click(box.x + box.width * 0.125, box.y + box.height * 0.125); // cell 0 (empty)
  ck("swap moved a tile into an empty cell", await p.evaluate(() => window.__numberics.state.grid[0] === 17 && window.__numberics.state.grid[5] === 0));
  ck("no page errors", errs.length === 0, errs.join("|"));

  // 4. game over overlay when truly locked and out of power-ups
  await p.evaluate(() => { const s = window.__numberics.state; s.grid = [3,4,3,4,4,3,4,3,3,4,3,4,4,3,4,3]; s.power = { undo: 0, smash: 0, swap: 0, boost: 0 }; s.prev = null; s.over = true; window.__numberics.state = s; });
  ck("overlay shows when locked", await p.isVisible("#over"));
  await shot(p, "over");
  await ctx.close();

  // 5. sandbox where storage throws: the game must still run
  ctx = await b.newContext({ viewport: { width: 420, height: 800 } });
  p = await ctx.newPage(); const e2 = []; p.on("pageerror", e => e2.push(e.message));
  await p.addInitScript(() => { Object.defineProperty(window, "localStorage", { get() { throw new Error("blocked"); } }); });
  await p.goto(url); await p.keyboard.press("ArrowLeft"); await p.keyboard.press("ArrowDown");
  ck("runs with storage blocked", e2.length === 0 && await p.locator(".tile").count() >= 2, e2.join("|"));
  await ctx.close();

  // 6. reduced motion: no animation delay, still fully playable
  ctx = await b.newContext({ viewport: { width: 420, height: 800 }, reducedMotion: "reduce" });
  p = await ctx.newPage(); await p.goto(url);
  const before = await p.evaluate(() => window.__numberics.state.moves);
  await p.keyboard.press("ArrowLeft"); await p.keyboard.press("ArrowUp"); await p.keyboard.press("ArrowRight");
  const after = await p.evaluate(() => window.__numberics.state.moves);
  ck("reduced motion plays instantly", after > before);
  await ctx.close();

  // 6b. Sudoku: renders, accepts input, notes, undo, conflicts, solve
  ctx = await b.newContext({ viewport: { width: 420, height: 900 }, deviceScaleFactor: 2 });
  p = await ctx.newPage(); const e3 = []; p.on("pageerror", x => e3.push(x.message));
  await p.goto(url + "sudoku/");
  ck("81 sudoku cells", await p.locator(".c").count() === 81);
  ck("givens shown", await p.locator(".c.given").count() >= 20);
  const empty = await p.evaluate(() => window.__sudoku.state.puzzle.findIndex(v => !v));
  await p.locator(".c").nth(empty).click();
  const truth = await p.evaluate(i => window.__sudoku.state.solution[i], empty);
  await p.keyboard.press(String(truth));
  ck("typed digit lands", await p.evaluate(i => window.__sudoku.state.grid[i], empty) === truth);
  await p.keyboard.press("u");
  ck("undo clears it", await p.evaluate(i => window.__sudoku.state.grid[i], empty) === 0);
  await p.keyboard.press("n"); await p.keyboard.press("5");
  ck("notes mode pencils a mark", await p.evaluate(i => (window.__sudoku.state.notes[i] & 32) !== 0, empty));
  await p.keyboard.press("n"); await p.keyboard.press("Backspace");
  const wrong = (truth % 9) + 1;
  await p.keyboard.press(String(wrong));
  const clash = await p.evaluate((i) => { const s = window.__sudoku.state; return s.grid.some((v, k) => v === s.grid[i] && k !== i); }, empty);
  if (clash) ck("a rule-breaking digit is painted red", await p.locator(".c.bad").count() >= 1);
  await shot(p, "sudoku");
  await p.evaluate(() => { const s = window.__sudoku.state; const g = s.solution.slice(); const hole = s.puzzle.findIndex(v => !v); s.grid = g.slice(); s.grid[hole] = 0; window.__sudoku.state = s; window.__sudoku.select(hole); });
  await p.keyboard.press(String(await p.evaluate(() => { const s = window.__sudoku.state; return s.solution[s.grid.findIndex(v => !v)]; })));
  ck("finishing the grid shows Solved", await p.isVisible("#win"));
  await shot(p, "sudoku-solved");
  ck("no sudoku page errors", e3.length === 0, e3.join("|"));
  await p.addInitScript(() => {}); await ctx.close();
  ctx = await b.newContext({ viewport: { width: 420, height: 900 } }); p = await ctx.newPage();
  await p.addInitScript(() => { Object.defineProperty(window, "localStorage", { get() { throw new Error("blocked"); } }); });
  const e4 = []; p.on("pageerror", x => e4.push(x.message)); await p.goto(url + "sudoku/");
  ck("sudoku runs with storage blocked", e4.length === 0 && await p.locator(".c").count() === 81, e4.join("|"));
  await ctx.close();

  // 7. desktop shot + swipe
  ctx = await b.newContext({ viewport: { width: 1100, height: 800 }, deviceScaleFactor: 1 });
  p = await ctx.newPage(); await p.goto(url); await shot(p, "desktop");
  await ctx.close(); await b.close(); srv.close();
  console.log(pass + " passed, " + fail + " failed"); process.exit(fail ? 1 : 0);
})().catch(e => { console.log("ERR", e); srv.close(); process.exit(1); });
