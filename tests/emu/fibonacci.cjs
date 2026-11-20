/* SPDX-License-Identifier: Apache-2.0 | Copyright 2026 alvations (Melon Lab)
 * Browser checks for Fibonacci. Run: NODE_PATH=$(npm root -g) node tests/emu/run.cjs fibonacci */
"use strict";
module.exports = async function ({ browser, url, ck, shot }) {
  const page = url + "fibonacci/";
  // 1. loads, plays by keyboard, animates, persists
  let ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2 });
  let p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto(page);
  ck("two starting tiles", await p.locator(".tile").count() === 2);
  ck("starting tiles are 1 or 2", await p.evaluate(() => [...document.querySelectorAll(".tile")].every(t => /^[12]$/.test(t.textContent))));
  ck("starts with one Undo", await p.evaluate(() => JSON.stringify(window.__fibonacci.state.power) === '{"undo":1,"smash":0,"swap":0,"boost":0}'));
  ck("tray has four slots", await p.locator("#tray .pw").count() === 4);
  for (let i = 0; i < 12; i++) await p.keyboard.press(["ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown"][i % 4]);
  await p.waitForTimeout(250);
  ck("moves were counted", await p.evaluate(() => window.__fibonacci.state.moves) > 0);
  ck("every tile shows its number", await p.evaluate(() => [...document.querySelectorAll(".tile")].every(t => /^[0-9]+$/.test(t.textContent))));
  ck("no horizontal scroll at 375px", await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  const moves = await p.evaluate(() => window.__fibonacci.state.moves);
  await p.reload();
  ck("state survives reload", (await p.evaluate(() => window.__fibonacci.state.moves)) === moves);

  // 2. the merge rule in the page: 2 + 3 makes 5, 3 + 3 stays apart
  await p.evaluate(() => { const s = window.__fibonacci.state; s.grid = new Array(16).fill(0); s.grid[0] = 2; s.grid[1] = 3; s.grid[4] = 3; s.grid[5] = 3; s.top = 3; window.__fibonacci.state = s; });
  await p.keyboard.press("ArrowLeft"); await p.waitForTimeout(250);
  ck("2 + 3 merges to 5", await p.evaluate(() => window.__fibonacci.state.grid[0] === 4));
  ck("3 + 3 does not merge", await p.evaluate(() => window.__fibonacci.state.grid[4] === 3 && window.__fibonacci.state.grid[5] === 3));
  ck("5 drawn on the board", await p.evaluate(() => [...document.querySelectorAll(".tile")].some(t => t.textContent === "5")));

  // 3. INFINITE: past 2584, then the subscript form
  await p.evaluate(() => { const s = window.__fibonacci.state; s.grid = new Array(16).fill(0); s.grid[0] = 16; s.grid[1] = 17; s.top = 17; window.__fibonacci.state = s; });
  await p.keyboard.press("ArrowLeft"); await p.waitForTimeout(250);
  ck("1597 + 2584 makes 4181 and the game continues", await p.evaluate(() => window.__fibonacci.state.grid[0] === 18 && !window.__fibonacci.state.over));
  ck("no win text anywhere", !/you win|victory|congrat/i.test(await p.textContent("body")));
  await p.evaluate(() => { const s = window.__fibonacci.state; s.grid = new Array(16).fill(0); s.grid[0] = 40; s.grid[5] = 30; s.grid[6] = 29; s.grid[10] = 1; s.top = 40; window.__fibonacci.state = s; });
  ck("huge tiles render as F with a subscript", (await p.locator(".tile sub").count()) === 2);
  ck("832040 still shows its digits", await p.evaluate(() => [...document.querySelectorAll(".tile")].some(t => t.textContent === "832040")));
  ck("F31 is 1346269", await p.evaluate(() => [...document.querySelectorAll(".tile")].some(t => t.textContent === "F31")));
  await shot(p, "big-tiles");

  // 4. power-ups: Smash (click targeting, Esc cancels), Swap, Boost, Undo
  await p.evaluate(() => { const s = window.__fibonacci.state; s.power = { undo: 1, smash: 2, swap: 1, boost: 1 }; window.__fibonacci.state = s; });
  await p.keyboard.press("2");
  ck("smash arms targeting", await p.locator("#board.targeting").count() === 1);
  ck("hint explains the target", /smash/i.test(await p.textContent("#hint")));
  await shot(p, "targeting");
  await p.keyboard.press("Escape");
  ck("escape cancels targeting", await p.locator("#board.targeting").count() === 0);
  const box = await p.locator("#board").boundingBox();
  const at = (cell) => p.mouse.click(box.x + box.width * ((cell % 4) + 0.5) / 4, box.y + box.height * (Math.floor(cell / 4) + 0.5) / 4);
  await p.keyboard.press("2"); await at(0);
  ck("smash removed the tile at cell 0", await p.evaluate(() => window.__fibonacci.state.grid[0] === 0 && window.__fibonacci.state.power.smash === 1));
  await p.keyboard.press("3"); await at(5); await at(0);
  ck("swap moved a tile into an empty cell", await p.evaluate(() => window.__fibonacci.state.grid[0] === 30 && window.__fibonacci.state.grid[5] === 0));
  await p.keyboard.press("4"); await at(10);
  ck("boost steps 1 to 2 (the next Fibonacci number)", await p.evaluate(() => window.__fibonacci.state.grid[10] === 2 && window.__fibonacci.state.power.boost === 0));
  await p.locator("#tray .pw").nth(0).click();
  ck("undo (tray click) rewinds the boost", await p.evaluate(() => window.__fibonacci.state.grid[10] === 1 && window.__fibonacci.state.power.boost === 1 && window.__fibonacci.state.power.undo === 0));

  // 5. award toast on a new highest tile of 34
  await p.evaluate(() => { const s = window.__fibonacci.state; s.grid = new Array(16).fill(0); s.grid[0] = 6; s.grid[1] = 7; s.top = 7; s.power = { undo: 0, smash: 0, swap: 0, boost: 0 }; s.prev = null; window.__fibonacci.state = s; });
  await p.keyboard.press("ArrowLeft"); await p.waitForTimeout(250);
  ck("new 34 awards a power-up", await p.evaluate(() => Object.values(window.__fibonacci.state.power).reduce((a, b) => a + b, 0) === 1));
  ck("toast names the tile and the reward", /New tile 34 +\+/.test(await p.textContent("#toast")));

  // 6. stuck while holding a power-up, then the end overlay
  await p.evaluate(() => { const s = window.__fibonacci.state; s.grid = [1,3,1,3,3,1,3,1,1,3,1,3,3,1,3,1]; s.power = { undo: 0, smash: 1, swap: 0, boost: 0 }; s.prev = null; s.over = false; window.__fibonacci.state = s; });
  ck("stuck with a power-up says so, no overlay", /Stuck/.test(await p.textContent("#hint")) && !(await p.isVisible("#over")));
  await p.evaluate(() => { const s = window.__fibonacci.state; s.power = { undo: 0, smash: 0, swap: 0, boost: 0 }; s.over = true; window.__fibonacci.state = s; });
  ck("overlay shows when locked", await p.isVisible("#over"));
  ck("overlay names the top tile", /Top tile/.test(await p.textContent("#over-text")));
  await shot(p, "over");
  await p.click("#again");
  ck("New game from the overlay starts fresh", await p.evaluate(() => window.__fibonacci.state.moves === 0 && !window.__fibonacci.state.over) && !(await p.isVisible("#over")));

  // 7. two-step New game
  for (let i = 0; i < 4; i++) await p.keyboard.press(["ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown"][i]);
  await p.waitForTimeout(200);
  const m1 = await p.evaluate(() => window.__fibonacci.state.moves);
  await p.click("#new");
  ck("first New game click asks first", /Sure/.test(await p.textContent("#new")) && (await p.evaluate(() => window.__fibonacci.state.moves)) === m1);
  await p.click("#new");
  ck("second click starts a new game", (await p.evaluate(() => window.__fibonacci.state.moves)) === 0);
  ck("nav marks Fibonacci as current or lists the live games", (await p.locator("#games a").count()) >= 1);
  ck("no page errors", errs.length === 0, errs.join("|"));
  await ctx.close();

  // 8. storage blocked: the game must still run
  ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
  p = await ctx.newPage(); const e2 = []; p.on("pageerror", e => e2.push(e.message));
  await p.addInitScript(() => { Object.defineProperty(window, "localStorage", { get() { throw new Error("blocked"); } }); });
  await p.goto(page); await p.keyboard.press("ArrowLeft"); await p.keyboard.press("ArrowDown"); await p.keyboard.press("ArrowRight");
  ck("runs with storage blocked", e2.length === 0 && await p.locator(".tile").count() >= 2 && (await p.evaluate(() => window.__fibonacci.state.moves)) >= 1, e2.join("|"));
  await ctx.close();

  // 9. reduced motion: no animation delay, still fully playable
  ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, reducedMotion: "reduce" });
  p = await ctx.newPage(); const e3 = []; p.on("pageerror", e => e3.push(e.message));
  await p.goto(page);
  const before = await p.evaluate(() => window.__fibonacci.state.moves);
  for (const k of ["ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown"]) await p.keyboard.press(k);
  const after = await p.evaluate(() => window.__fibonacci.state.moves);
  ck("reduced motion plays instantly", after > before);
  ck("reduced motion: tiles do not transition", await p.evaluate(() => getComputedStyle(document.querySelector(".tiles .tile")).transitionDuration === "0s"));
  await p.evaluate(() => window.__demo());
  ck("demo state renders a mid-game", (await p.locator(".tile").count()) >= 8);
  ck("no page errors (reduced motion, demo)", e3.length === 0, e3.join("|"));
  await ctx.close();
};
