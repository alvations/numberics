/* SPDX-License-Identifier: Apache-2.0 | Copyright 2026 alvations (Melon Lab)
 * Browser checks for Three. Run: NODE_PATH=$(npm root -g) node tests/emu/run.cjs three */
"use strict";
module.exports = async function ({ browser, url, ck, shot }) {
  const page = url + "three/";
  const set = (p, grid, extra) => p.evaluate(([g, x]) => {
    const s = window.__three.state; s.grid = g; s.top = Math.max(...g); s.next = 3; s.over = false; s.prev = null;
    Object.assign(s, x || {}); window.__three.state = s;
  }, [grid, extra || null]);
  const st = (p) => p.evaluate(() => window.__three.state);
  const FLUSH = [3, 0, 0, 0, 6, 0, 0, 0, 0, 9, 0, 0, 0, 0, 0, 0]; // the 9 steps left: column 0 reads 3-6-9

  // 1. loads, plays by keyboard, persists
  let ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2 });
  let p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto(page);
  ck("nine starting tiles", await p.locator(".tile").count() === 9);
  ck("starting tiles are 1, 2 or 3", await p.evaluate(() => [...document.querySelectorAll(".tile")].every(t => /^[123]$/.test(t.textContent))));
  ck("starts with one Undo", JSON.stringify((await st(p)).power) === '{"undo":1,"smash":0,"swap":0,"third":0}');
  ck("tray has four slots", await p.locator("#tray .pw").count() === 4);
  ck("next tile is previewed", /^[123]$/.test(await p.textContent("#next")));
  for (let i = 0; i < 12; i++) await p.keyboard.press(["ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown"][i % 4]);
  await p.waitForTimeout(700);
  ck("moves were counted", (await st(p)).moves > 0);
  ck("every tile shows its number", await p.evaluate(() => [...document.querySelectorAll(".tile")].every(t => /^[0-9]+$/.test(t.textContent))));
  ck("multiples of 3 wear a rainbow band", await p.evaluate(() => [...document.querySelectorAll(".tile")].every(t => (+t.textContent % 3 === 0) === t.hasAttribute("data-band"))));
  ck("no horizontal scroll at 375px", await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  const moves = (await st(p)).moves;
  await p.reload();
  ck("state survives reload", (await st(p)).moves === moves);

  // 2. the rules in the page: one step, 1 + 2, step merge
  await set(p, [0, 0, 0, 3, 1, 2, 0, 0, 3, 6, 0, 0, 3, 9, 0, 0]);
  await p.keyboard.press("ArrowLeft"); await p.waitForTimeout(300);
  let s = await st(p);
  ck("a swipe moves a tile one step only", s.grid[2] === 3 && !s.grid[1] && !s.grid[0]);
  ck("1 + 2 makes 3", s.grid[4] === 3);
  ck("3 + 6 step-merges into 9", s.grid[8] === 9);
  ck("3 and 9 stay apart", s.grid[12] === 3 && s.grid[13] === 9);
  ck("drawn 9 is yellow (band 2)", await p.evaluate(() => [...document.querySelectorAll(".tile")].some(t => t.textContent === "9" && t.dataset.band === "2")));

  // 3. Flush: the rainbow sweeps the run, then it collapses, scores and pays a power-up
  await set(p, FLUSH, { score: 0, power: { undo: 1, smash: 0, swap: 0, third: 0 } });
  await p.keyboard.press("ArrowLeft"); await p.waitForTimeout(180);
  ck("the run is marked while the rainbow sweeps", await p.locator(".tile.run").count() === 3);
  await shot(p, "flush");
  await p.waitForTimeout(800);
  s = await st(p);
  ck("the run collapsed into 18 on its highest tile", s.grid[8] === 18 && !s.grid[0] && !s.grid[4]);
  ck("flush scored sum x length = 54", s.score === 54);
  ck("flush earned one power-up", s.power.undo + s.power.smash + s.power.swap + s.power.third === 2);
  ck("toast announces the flush", /Flush 3-6-9 = 18/.test(await p.textContent("#toast")));
  ck("the run marks are gone after the collapse", await p.locator(".tile.run").count() === 0);
  ck("score pill updated", (await p.textContent("#score")) === "54");

  // 4. power-ups: Smash (Esc cancels), Swap neighbours, Third, Undo from the tray
  await set(p, [1, 3, 0, 0, 6, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 12], { power: { undo: 1, smash: 2, swap: 1, third: 1 } });
  const box = await p.locator("#board").boundingBox();
  const at = (cell) => p.mouse.click(box.x + box.width * ((cell % 4) + 0.5) / 4, box.y + box.height * (Math.floor(cell / 4) + 0.5) / 4);
  await p.keyboard.press("2");
  ck("smash arms targeting", await p.locator("#board.targeting").count() === 1);
  ck("hint explains the target", /smash/i.test(await p.textContent("#hint")));
  await shot(p, "targeting");
  await p.keyboard.press("Escape");
  ck("escape cancels targeting", await p.locator("#board.targeting").count() === 0);
  await p.keyboard.press("2"); await at(15);
  s = await st(p); ck("smash removed the 12", s.grid[15] === 0 && s.power.smash === 1);
  await p.keyboard.press("3"); await at(0); await at(5);
  s = await st(p); ck("swap refuses a diagonal pair", s.grid[0] === 1 && s.power.swap === 1);
  await at(0); await at(4);
  s = await st(p); ck("swap trades two neighbours", s.grid[0] === 6 && s.grid[4] === 1 && s.power.swap === 0);
  await p.keyboard.press("4"); await at(1);
  s = await st(p); ck("third refuses a 3", s.grid[1] === 3 && s.power.third === 1);
  await at(5);
  s = await st(p); ck("third turns the 2 into a 3", s.grid[5] === 3 && s.power.third === 0);
  await p.locator("#tray .pw").nth(0).click();
  s = await st(p); ck("undo (tray click) rewinds the third, stock included", s.grid[5] === 2 && s.power.third === 1 && s.power.undo === 0);

  // 5. end of run: locked with an empty tray
  await set(p, [0, 3, 12, 3, 12, 3, 12, 3, 3, 12, 3, 12, 12, 3, 12, 3], { next: 12, used: 0, power: { undo: 0, smash: 0, swap: 0, third: 0 } });
  await p.keyboard.press("ArrowLeft"); await p.waitForTimeout(300);
  ck("overlay shows when locked with no usable power-up", await p.isVisible("#over"));
  ck("overlay says it was a pure run", /pure run/.test(await p.textContent("#over-text")));
  ck("no win text anywhere", !/you win|victory|congrat/i.test(await p.textContent("body")));
  await shot(p, "over");
  await p.click("#again");
  ck("New game from the overlay starts fresh", !(await st(p)).over && await p.locator(".tile").count() === 9);
  ck("no page errors", errs.length === 0, errs.join("|"));
  await ctx.close();

  // 6. storage that throws: still runs and plays
  ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
  p = await ctx.newPage(); const e2 = []; p.on("pageerror", e => e2.push(e.message));
  await p.addInitScript(() => { Object.defineProperty(window, "localStorage", { get() { throw new Error("blocked"); } }); });
  await p.goto(page);
  for (const k of ["ArrowLeft", "ArrowDown", "ArrowRight", "ArrowUp"]) await p.keyboard.press(k);
  await p.waitForTimeout(300);
  ck("runs with storage blocked", e2.length === 0 && (await st(p)).moves > 0, e2.join("|"));
  await ctx.close();

  // 7. reduced motion: instant moves; a flush shows a still rainbow outline, then collapses
  ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, reducedMotion: "reduce" });
  p = await ctx.newPage(); const e3 = []; p.on("pageerror", e => e3.push(e.message));
  await p.goto(page);
  await set(p, FLUSH, { score: 0 });
  await p.keyboard.press("ArrowLeft"); await p.waitForTimeout(60);
  ck("reduced motion: still outline on the run", await p.locator(".tile.run.still").count() === 3);
  ck("reduced motion: no transition on tiles", await p.evaluate(() => getComputedStyle(document.querySelector(".tile")).transitionDuration.split(",").every(d => parseFloat(d) === 0)));
  await p.waitForTimeout(700);
  ck("reduced motion: the run collapses", (await st(p)).grid[8] === 18 && await p.locator(".tile.run").count() === 0);
  // a swipe during the outline finishes the flush at once (no stale timer redraws an old board)
  await set(p, FLUSH, { score: 0 });
  await p.keyboard.press("ArrowLeft"); await p.keyboard.press("ArrowUp"); await p.waitForTimeout(700);
  const g2 = await p.evaluate(() => ({ dom: [...document.querySelectorAll(".tile")].length, eng: window.__three.state.grid.filter(Boolean).length }));
  ck("input during a flush settles it cleanly", g2.dom === g2.eng, JSON.stringify(g2));
  ck("no page errors under reduced motion", e3.length === 0, e3.join("|"));
  await ctx.close();
};
