/* SPDX-License-Identifier: Apache-2.0 | Copyright 2026 alvations (Melon Lab)
 * Browser checks for Seven. Run: NODE_PATH=$(npm root -g) node tests/emu/run.cjs seven */
"use strict";
module.exports = async function ({ browser, url, ck, shot }) {
  const page = url + "seven/";
  const W = 7, at = (r, c) => r * W + c;
  // rows top to bottom: '.' empty, 1-7, 'e' egg
  const grid = (rows) => { while (rows.length < 7) rows.unshift("......."); return rows.join("").split("").map(ch => ch === "." ? 0 : ch === "e" ? 8 : +ch); };
  const setup = (p, rows, extra) => p.evaluate(([g, x]) => { const s = window.__seven.state; s.grid = g; s.left = 99; s.over = false; Object.assign(s, x); window.__seven.state = s; }, [grid(rows), extra || {}]);
  const st = (p) => p.evaluate(() => window.__seven.state);
  const idle = (p) => p.waitForFunction(() => !window.__seven.busy, null, { timeout: 5000 });

  // 1. loads, keyboard drop, animated trace, persists
  let ctx = await browser.newContext({ viewport: { width: 375, height: 800 }, deviceScaleFactor: 1 });
  let p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto(page);
  ck("49 well cells", await p.locator(".cells div").count() === 49);
  ck("discs drawn", await p.locator(".disc:not(.ghost)").count() > 0);
  ck("next disc preview", await p.locator("#next .mini").count() === 1);
  ck("no horizontal scroll at 375px", await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await setup(p, ["e......"], { next: 5 });
  await p.focus("#board");
  await p.keyboard.press("ArrowRight"); await p.keyboard.press("ArrowRight");
  ck("cursor moves with arrows", await p.evaluate(() => window.__seven.cursor) === 5);
  await p.keyboard.press("Enter"); await idle(p);
  let s = await st(p);
  ck("Enter drops into the cursor column", s.grid[at(6, 5)] === 5 && s.drops >= 1);
  // a row pop animates wave by wave and lands on the engine's grid
  await setup(p, ["e22...."], { next: 1 });
  await p.keyboard.press("ArrowLeft"); await p.keyboard.press("ArrowLeft"); await p.keyboard.press("ArrowLeft");
  await p.keyboard.press("ArrowDown");
  ck("animation is playing", await p.evaluate(() => window.__seven.busy));
  await idle(p);
  s = await st(p);
  ck("two-wave chain resolved", s.grid[at(6, 1)] === 0 && s.grid[at(6, 2)] === 0 && s.grid[at(6, 0)] === 9);
  ck("score shown matches state", (await p.textContent("#score")).replace(/,/g, "") === String(s.score));
  ck("drawn discs match the grid", await p.locator(".disc:not(.ghost)").count() === s.grid.filter(Boolean).length);
  // click a column
  const box = await p.locator("#discs").boundingBox();
  await setup(p, ["......."], { next: 4 });
  await p.mouse.click(box.x + box.width * (6.5 / 7), box.y + box.height * 0.3); await idle(p);
  ck("click drops into that column", (await st(p)).grid[at(6, 6)] === 4);
  const drops = (await st(p)).drops;
  await p.reload();
  ck("run survives reload", (await st(p)).drops === drops);

  // 2. Lucky Seven toast + award
  await setup(p, ["e......", "e......", "777777."], { next: 7, power: { undo: 1, smash: 0, hold: 0, crack: 0 } });
  await p.mouse.click(box.x + box.width * (6.5 / 7), box.y + box.height * 0.3);
  ck("Lucky Seven toast", /Lucky Seven/.test(await p.textContent("#toast")));
  await idle(p); s = await st(p);
  ck("Lucky Seven counted and a power-up earned", s.luckies === 1 && s.power.smash + s.power.hold + s.power.crack + s.power.undo >= 2);
  await shot(p, "lucky");

  // 3. power-ups: Undo (key 1), Smash (key 2 + click, Esc cancels), Hold (key 3), Crack (key 4)
  await p.keyboard.press("1"); s = await st(p);
  ck("Undo takes back the drop", s.luckies === 0 && s.grid[at(6, 0)] === 7);
  await setup(p, ["3......", "e22...."], { next: 6, held: 0, power: { undo: 1, smash: 2, hold: 2, crack: 1 } });
  await p.keyboard.press("2");
  ck("Smash arms targeting", await p.locator("#board.targeting").count() === 1);
  await p.keyboard.press("Escape");
  ck("Esc cancels", await p.locator("#board.targeting").count() === 0);
  await p.keyboard.press("2");
  await p.mouse.click(box.x + box.width * (0.5 / 7), box.y + box.height * (6.5 / 7)); await idle(p);
  s = await st(p);
  ck("Smash removed the egg and the fall set off a chain", s.power.smash === 1 && !s.grid.some(Boolean));
  await p.keyboard.press("3"); s = await st(p);
  ck("Hold keeps the next disc", s.held === 6 && s.power.hold === 1);
  ck("held disc shown on the Hold button", (await p.locator("#tray .pw").nth(2).locator(".mini").count()) === 1);
  await setup(p, ["e3....e", "eee...e"], { power: { undo: 1, smash: 0, hold: 0, crack: 1 } });
  await p.keyboard.press("4"); await idle(p); s = await st(p);
  ck("Crack cracks eggs touching a disc", s.power.crack === 0 && s.grid[at(5, 0)] === 9 && s.grid[at(6, 1)] === 9 && s.grid[at(6, 6)] === 8);

  // 4. rising row and the end screen with Undo
  await setup(p, ["5......", "e......", "e......", "e......", "e......", "e......", "e......"], { left: 1, next: 4, power: { undo: 1, smash: 0, hold: 0, crack: 0 } });
  await p.mouse.click(box.x + box.width * (3.5 / 7), box.y + box.height * 0.3); await idle(p);
  ck("overflow ends the run", (await st(p)).over && await p.isVisible("#over"));
  ck("end screen offers Undo", await p.isVisible("#over-undo"));
  await shot(p, "over");
  await p.click("#over-undo");
  ck("Undo from the end screen resumes", !(await st(p)).over && !(await p.isVisible("#over")));
  await setup(p, ["e......"], { left: 1, next: 5 });
  await p.mouse.click(box.x + box.width * (3.5 / 7), box.y + box.height * 0.3); await idle(p);
  s = await st(p);
  ck("eggs rise after N drops", s.level >= 2 && s.grid.slice(42).every(v => v === 8));
  await p.evaluate(() => { const s = window.__seven.state; s.over = true; s.power = { undo: 0, smash: 0, hold: 0, crack: 0 }; s.prev = null; window.__seven.state = s; });
  await p.click("#again");
  ck("New game from the end screen starts a fresh run", !(await st(p)).over && (await st(p)).drops === 0);

  // 5. modes keep their own runs; Daily is date-seeded
  await p.click('#modes [data-mode="blitz"]');
  s = await st(p); ck("Blitz: 5 drops per rise", s.mode === "blitz" && s.left === 5 && await p.locator(".pips i").count() === 5);
  await p.click('#modes [data-mode="daily"]');
  const d1 = await st(p);
  ck("Daily mode", d1.mode === "daily");
  await p.click('#modes [data-mode="classic"]');
  ck("back to the Classic run", (await st(p)).mode === "classic");
  ck("no page errors", errs.length === 0, errs.join("|"));
  await ctx.close();
  ctx = await browser.newContext(); p = await ctx.newPage(); await p.goto(page);
  await p.click('#modes [data-mode="daily"]');
  ck("Daily is the same well in a fresh browser", JSON.stringify((await st(p)).grid) === JSON.stringify(d1.grid) && (await st(p)).next === d1.next);
  await ctx.close();

  // 6. storage blocked
  ctx = await browser.newContext({ viewport: { width: 375, height: 800 } });
  p = await ctx.newPage(); const e2 = []; p.on("pageerror", e => e2.push(e.message));
  await p.addInitScript(() => { Object.defineProperty(window, "localStorage", { get() { throw new Error("blocked"); } }); });
  await p.goto(page); const d0 = (await st(p)).drops;
  await p.focus("#board"); await p.keyboard.press("Enter"); await idle(p);
  ck("runs with storage blocked", e2.length === 0 && (await st(p)).drops === d0 + 1, e2.join("|"));
  await ctx.close();

  // 7. reduced motion: instant, still plays
  ctx = await browser.newContext({ viewport: { width: 375, height: 800 }, reducedMotion: "reduce" });
  p = await ctx.newPage(); const e3 = []; p.on("pageerror", e => e3.push(e.message)); await p.goto(page);
  await setup(p, ["e22...."], { next: 1 });
  await p.focus("#board");
  await p.keyboard.press("ArrowLeft"); // column 3 -> 2
  await p.keyboard.press("Enter");
  ck("reduced motion resolves instantly", !(await p.evaluate(() => window.__seven.busy)) && (await st(p)).grid[at(6, 1)] === 0);
  ck("no errors under reduced motion", e3.length === 0, e3.join("|"));
  await ctx.close();
};
