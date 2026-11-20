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
  // 0. the first-run explainer: shown once, blocks play while open, remembered, re-openable
  ck("first visit shows the explainer", await p.isVisible("#help"));
  ck("explainer teaches 1+2, equal, step, flush and rings", await p.locator("#help li").count() === 5 &&
    /1 and 2/.test(await p.textContent("#help")) && /Equal/.test(await p.textContent("#help")) &&
    /6 and 9 make 15/.test(await p.textContent("#help")) && /Flush/.test(await p.textContent("#help")) && /ring/.test(await p.textContent("#help")));
  ck("explainer example tiles are drawn like the board", await p.locator("#help .tile.three[data-oct='1']").count() === 1);
  ck("explainer fits at 375px", await p.evaluate(() => { const r = document.querySelector("#help .card").getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight && document.documentElement.scrollWidth <= innerWidth; }));
  await shot(p, "help");
  await p.keyboard.press("ArrowLeft");
  ck("arrows do not play under the explainer", (await st(p)).moves === 0);
  ck("Play has focus", await p.evaluate(() => document.activeElement.id === "help-play"));
  await p.keyboard.press("Enter");
  ck("Enter on Play closes the explainer", !(await p.isVisible("#help")));
  ck("fresh board hint fills the empty band", /Swipe to start/.test(await p.textContent("#hint")));
  ck("subtitle: Numberics link then a tagline with a full stop", /^Numberics · Count in threes\.$/.test((await p.textContent(".sub")).trim()));
  await p.reload();
  ck("explainer is remembered", !(await p.isVisible("#help")));
  await p.click("#help-open");
  ck("How it works re-opens it", await p.isVisible("#help"));
  await p.keyboard.press("Escape");
  ck("Esc closes it", !(await p.isVisible("#help")));
  ck("nine starting tiles", await p.locator("#tiles .tile").count() === 9);
  ck("starting tiles are 1, 2 or 3", await p.evaluate(() => [...document.querySelectorAll("#tiles .tile")].every(t => /^[123]$/.test(t.textContent))));
  ck("starts with one Undo", JSON.stringify((await st(p)).power) === '{"undo":1,"smash":0,"swap":0,"third":0}');
  ck("tray has four slots", await p.locator("#tray .pw").count() === 4);
  ck("next tile is previewed", /^[123]$/.test(await p.textContent("#next")));
  for (let i = 0; i < 12; i++) await p.keyboard.press(["ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown"][i % 4]);
  await p.waitForTimeout(700);
  ck("moves were counted", (await st(p)).moves > 0);
  ck("every tile shows its number", await p.evaluate(() => [...document.querySelectorAll("#tiles .tile")].every(t => /^[0-9]+$/.test(t.textContent))));
  ck("multiples of 3 wear a rainbow band", await p.evaluate(() => [...document.querySelectorAll("#tiles .tile")].every(t => (+t.textContent % 3 === 0) === t.hasAttribute("data-band"))));
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
  ck("drawn 9 is yellow (band 2)", await p.evaluate(() => [...document.querySelectorAll("#tiles .tile")].some(t => t.textContent === "9" && t.dataset.band === "2")));

  // 3. Flush: the rainbow sweeps the run, then it collapses, scores and pays a power-up
  await set(p, FLUSH, { score: 0, power: { undo: 1, smash: 0, swap: 0, third: 0 } });
  await p.keyboard.press("ArrowLeft"); await p.waitForTimeout(180);
  ck("the run is marked while the rainbow sweeps", await p.locator("#tiles .tile.run").count() === 3);
  await shot(p, "flush");
  await p.waitForTimeout(800);
  s = await st(p);
  ck("the run collapsed into 18 on its highest tile", s.grid[8] === 18 && !s.grid[0] && !s.grid[4]);
  ck("flush scored sum x length = 54", s.score === 54);
  ck("flush earned one power-up", s.power.undo + s.power.smash + s.power.swap + s.power.third === 2);
  ck("toast announces the flush", /Flush 3-6-9 = 18/.test(await p.textContent("#toast")));
  ck("a flush toast is a reward (gold)", !(await p.evaluate(() => document.getElementById("toast").classList.contains("bad"))));
  ck("the run marks are gone after the collapse", await p.locator("#tiles .tile.run").count() === 0);
  ck("score pill updated", (await p.textContent("#score")) === "54");

  // 3b. R5: a tray button that cannot act explains itself in the hint line (phones have no hover)
  await set(p, [1, 3, 0, 0, 6, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 12], { moves: 3, power: { undo: 0, smash: 0, swap: 0, third: 0 } });
  ck("empty tray buttons are aria-disabled, never disabled", await p.evaluate(() => [...document.querySelectorAll("#tray .pw")].every(b => !b.disabled && b.getAttribute("aria-disabled") === "true")));
  await p.locator("#tray .pw").nth(1).click({ force: true });
  ck("tapping an empty Smash explains it and how to earn it", (await p.textContent("#hint")) === "Smash: Remove one tile. Earn one with every Flush.", await p.textContent("#hint"));
  ck("an empty power-up does not arm", await p.locator("#board.targeting").count() === 0);
  await p.keyboard.press("1");
  ck("key 1 on an empty Undo explains it too", /^Undo: Take back the last move\. You start with one/.test(await p.textContent("#hint")), await p.textContent("#hint"));
  ck("tooltip voice: '2: Swap. Trade two neighbouring tiles.'", (await p.locator("#tray .pw").nth(2).getAttribute("title")) === "3: Swap. Trade two neighbouring tiles.");
  await set(p, [1, 3, 0, 0, 6, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 12], { moves: 3, power: { undo: 0, smash: 0, swap: 0, third: 1 } });
  await set(p, [3, 6, 0, 0, 9, 12, 0, 0, 0, 0, 0, 0, 0, 0, 0, 12], { moves: 3, power: { undo: 0, smash: 0, swap: 0, third: 1 } });
  await p.locator("#tray .pw").nth(3).click({ force: true });
  ck("a charged power-up that cannot act says why", /There is no 1 or 2/.test(await p.textContent("#hint")), await p.textContent("#hint"));

  // 3c. R2 blocker: Swap lines up 3-6-9; it flushes at once, scores, and pays no power-up, announced
  await set(p, [3, 9, 6, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1], { moves: 3, score: 0, power: { undo: 0, smash: 0, swap: 1, third: 0 } });
  let bx = await p.locator("#board").boundingBox();
  const tap = (cell) => p.mouse.click(bx.x + bx.width * ((cell % 4) + 0.5) / 4, bx.y + bx.height * (Math.floor(cell / 4) + 0.5) / 4);
  await p.keyboard.press("3"); await tap(1); await tap(2);
  await p.waitForTimeout(120);
  ck("a run made by Swap shows the flush rainbow", await p.locator("#tiles .tile.run").count() === 3);
  await p.waitForTimeout(800);
  s = await st(p);
  ck("swap-made run collapsed and scored", s.grid[2] === 18 && s.score === 54, JSON.stringify(s.grid));
  ck("swap-made flush paid no power-up", s.power.undo + s.power.smash + s.power.swap + s.power.third === 0);
  ck("toast says a power-up set it up", /no new one/.test(await p.textContent("#toast")), await p.textContent("#toast"));
  await p.keyboard.press("ArrowDown"); await p.waitForTimeout(400); s = await st(p);
  ck("the next swipe pays nothing either", s.power.undo + s.power.smash + s.power.swap + s.power.third === 0);

  // 3d. R9: keyboard targeting (arrow cursor + Enter), and Enter on a focused button is that button only
  await set(p, [1, 3, 0, 0, 6, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 12], { moves: 3, power: { undo: 1, smash: 2, swap: 1, third: 1 } });
  await p.focus("#board");
  await p.keyboard.press("2");
  ck("keyboard arming shows a cursor on the first tile", await p.locator("#tiles .tile.cur").count() === 1 && /Arrows/.test(await p.textContent("#hint")));
  await shot(p, "kbd-targeting");
  await p.keyboard.press("ArrowRight"); await p.keyboard.press("ArrowDown");
  ck("arrows move the cursor, not the tiles", (await st(p)).grid[5] === 2 && await p.evaluate(() => { const c = document.querySelector(".tile.cur"); return c && c.textContent === "2"; }));
  await p.keyboard.press("Enter");
  s = await st(p); ck("Enter smashes the tile under the cursor", s.grid[5] === 0 && s.power.smash === 1);
  await p.keyboard.press("3");
  await p.keyboard.press("Enter"); // picks the first tile (the 1 at cell 0)
  await p.keyboard.press("ArrowRight"); await p.keyboard.press("Enter");
  s = await st(p); ck("keyboard Swap picks two neighbours", s.grid[0] === 3 && s.grid[1] === 1 && s.power.swap === 0, JSON.stringify(s.grid));
  await p.keyboard.press("2");
  await p.focus("#new"); await p.keyboard.press("Enter");
  s = await st(p);
  ck("Enter on a focused button does not pick a target", s.power.smash === 1 && /Sure/.test(await p.textContent("#new")));
  await p.keyboard.press("Escape");
  await p.waitForTimeout(3100);

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
  await p.locator("#tray .pw").nth(0).click({ force: true });
  s = await st(p); ck("undo (tray click) rewinds the third, stock included", s.grid[5] === 2 && s.power.third === 1 && s.power.undo === 0);

  // 5. end of run: locked with an empty tray
  await p.evaluate(() => { window.__three.base = 1e9; });
  await set(p, [0, 3, 12, 3, 12, 3, 12, 3, 3, 12, 3, 12, 12, 3, 12, 3], { next: 12, used: 0, power: { undo: 0, smash: 0, swap: 0, third: 0 } });
  await p.keyboard.press("ArrowLeft"); await p.waitForTimeout(300);
  ck("overlay shows when locked with no usable power-up", await p.isVisible("#over"));
  ck("overlay says it was a pure run", /pure run/.test(await p.textContent("#over-text")));
  ck("no New best when the record stands", !(await p.isVisible("#over-best")));
  await p.locator("#tray .pw").nth(0).click({ force: true });
  ck("R1: Undo after the run ends says why", /The run is over/.test(await p.textContent("#hint")));
  await p.evaluate(() => { window.__three.base = 0; });
  await set(p, [0, 3, 12, 3, 12, 3, 12, 3, 3, 12, 3, 12, 12, 3, 12, 3], { next: 12, used: 7, flushes: 12, score: 12345, power: { undo: 0, smash: 0, swap: 0, third: 0 } });
  await p.keyboard.press("ArrowLeft"); await p.waitForTimeout(300);
  ck("R8: a new best says so", await p.isVisible("#over-best") && (await p.textContent("#over-best")) === "New best.");
  ck("R8: headline and summary each fit on one line at 375px", await p.evaluate(() => [["#over h2", 1], ["#over-text", 1]].every(([q]) => {
    const e = document.querySelector(q), lh = parseFloat(getComputedStyle(e).lineHeight) || 24; return e.getBoundingClientRect().height < lh * 1.6; })));
  ck("no win text anywhere", !/you win|victory|congrat/i.test(await p.textContent("body")));
  await shot(p, "over");
  await p.click("#again");
  ck("New game from the overlay starts fresh", !(await st(p)).over && await p.locator("#tiles .tile").count() === 9);
  ck("no page errors", errs.length === 0, errs.join("|"));
  await ctx.close();

  // 6. storage that throws: still runs and plays
  ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
  p = await ctx.newPage(); const e2 = []; p.on("pageerror", e => e2.push(e.message));
  await p.addInitScript(() => { Object.defineProperty(window, "localStorage", { get() { throw new Error("blocked"); } }); });
  await p.goto(page);
  await p.click("#help-play");
  for (const k of ["ArrowLeft", "ArrowDown", "ArrowRight", "ArrowUp"]) await p.keyboard.press(k);
  await p.waitForTimeout(300);
  ck("runs with storage blocked", e2.length === 0 && (await st(p)).moves > 0, e2.join("|"));
  await ctx.close();

  // 7. reduced motion: instant moves; a flush shows a still rainbow outline, then collapses
  ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, reducedMotion: "reduce" });
  p = await ctx.newPage(); const e3 = []; p.on("pageerror", e => e3.push(e.message));
  await p.goto(page);
  await p.click("#help-play");
  await set(p, FLUSH, { score: 0 });
  await p.keyboard.press("ArrowLeft"); await p.waitForTimeout(60);
  ck("reduced motion: still outline on the run", await p.locator("#tiles .tile.run.still").count() === 3);
  ck("reduced motion: no transition on tiles", await p.evaluate(() => getComputedStyle(document.querySelector("#tiles .tile")).transitionDuration.split(",").every(d => parseFloat(d) === 0)));
  await p.waitForTimeout(700);
  ck("reduced motion: the run collapses", (await st(p)).grid[8] === 18 && await p.locator("#tiles .tile.run").count() === 0);
  // a swipe during the outline finishes the flush at once (no stale timer redraws an old board)
  await set(p, FLUSH, { score: 0 });
  await p.keyboard.press("ArrowLeft"); await p.keyboard.press("ArrowUp"); await p.waitForTimeout(700);
  const g2 = await p.evaluate(() => ({ dom: [...document.querySelectorAll("#tiles .tile")].length, eng: window.__three.state.grid.filter(Boolean).length }));
  ck("input during a flush settles it cleanly", g2.dom === g2.eng, JSON.stringify(g2));
  ck("no page errors under reduced motion", e3.length === 0, e3.join("|"));
  await ctx.close();
};
