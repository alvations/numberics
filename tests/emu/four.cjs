/* SPDX-License-Identifier: Apache-2.0 | Copyright 2026 alvations (Melon Lab)
 * Browser checks for Four. Run: NODE_PATH=$(npm root -g) node tests/emu/run.cjs four */
"use strict";
module.exports = async function ({ browser, url, ck, shot }) {
  const page = url + "four/";
  const st = (p) => p.evaluate(() => window.__four.state);
  const myTurn = (p) => p.waitForFunction(() => window.__four.state.turn === 1 || window.__four.state.over, null, { timeout: 6000 });
  // forge a board: discs = [[row, col, owner, number]], row 0 at the bottom
  const forge = (p, discs, patch) => p.evaluate(([discs, patch]) => {
    const s = JSON.parse(JSON.stringify(window.__four.state));
    s.own = new Array(42).fill(0); s.num = new Array(42).fill(0);
    discs.forEach(([r, c, w, n]) => { s.own[r * 7 + c] = w; s.num[r * 7 + c] = n; });
    Object.assign(s, { turn: 1, over: null, prev: null, moves: discs.length, last: -1 }, patch || {});
    window.__four.state = s;
  }, [discs, patch]);
  const colX = async (p, c, row) => { // centre of a grid cell (row 0 = bottom)
    const g = await p.locator("#grid").boundingBox();
    return [g.x + g.width * (c + 0.5) / 7, g.y + g.height * (5 - (row || 0) + 0.5) / 6];
  };

  // 1. loads, plays a real turn by click, the computer replies
  let ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2 });
  let p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto(page);
  ck("42 slots", await p.locator(".slot").count() === 42);
  ck("next numbers shown for both sides", /^[1-4]$/.test(await p.textContent("#next")) && /^[1-4]$/.test(await p.textContent("#cnext")));
  ck("difficulty row with one level pressed", await p.locator('#levels button[aria-pressed="true"]').count() === 1);
  ck("no horizontal scroll at 375px", await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  const n0 = Number(await p.textContent("#next"));
  let [x, y] = await colX(p, 3, 2);
  await p.mouse.click(x, y);
  let s = await st(p);
  ck("a click drops your disc to the bottom of the column", s.own[3] === 1 && s.num[3] === n0, JSON.stringify(s.own.slice(0, 7)));
  await myTurn(p);
  s = await st(p);
  ck("the computer replied", s.own.filter(v => v === 2).length === 1 && s.moves === 2);
  await shot(p, "play");

  // 2. keyboard: arrows aim, Enter drops
  await p.focus("#board");
  const before = (await st(p)).moves;
  await p.keyboard.press("ArrowLeft"); await p.keyboard.press("ArrowLeft"); await p.keyboard.press("Enter");
  s = await st(p);
  ck("keyboard drop in column 1", s.moves === before + 1 && s.own[1] === 1, JSON.stringify(s.own.slice(0, 7)));
  await myTurn(p);

  // 3. power-ups
  const stock = [{ undo: 1, pop: 1, hold: 1, tune: 1 }, { undo: 0, pop: 0, hold: 0, tune: 0 }];
  await forge(p, [[0, 2, 1, 1], [1, 2, 2, 3], [2, 2, 1, 2], [0, 4, 2, 2]], { power: stock, next: [1, 2], held: [0, 0] });
  await p.keyboard.press("2");
  ck("Pop arms targeting", await p.locator("#board.targeting").count() === 1);
  await p.keyboard.press("Escape");
  ck("Esc cancels", await p.locator("#board.targeting").count() === 0);
  await p.keyboard.press("2");
  [x, y] = await colX(p, 2, 0); await p.mouse.click(x, y);
  s = await st(p);
  ck("Pop removed the bottom disc and the column dropped", s.own[2] === 2 && s.num[2] === 3 && s.own[16] === 0 && s.power[0].pop === 0 && s.turn === 1);
  await p.keyboard.press("3");
  s = await st(p);
  ck("Hold stashed the next disc", s.held[0] === 1 && s.power[0].hold === 0 && (await p.textContent("#held")) === "1");
  await p.keyboard.press("4");
  ck("Tune shows the number choice", await p.locator(".hint .pick button").count() === 4);
  const tuneTo = s.next[0] === 4 ? 3 : 4;
  await p.locator(".hint .pick button").nth(tuneTo - 1).click();
  s = await st(p);
  ck("Tune set the next number", s.next[0] === tuneTo && s.power[0].tune === 0 && (await p.textContent("#next")) === String(tuneTo));
  await p.keyboard.press("ArrowRight"); await p.keyboard.press("Enter");
  await myTurn(p);
  s = await st(p);
  ck("drop and reply happened", s.moves >= 6 && !!s.prev);
  const own0 = (await p.evaluate(() => JSON.stringify(window.__four.state.prev.own)));
  await p.keyboard.press("1");
  s = await st(p);
  ck("Undo took back both moves", JSON.stringify(s.own) === own0 && s.power[0].undo === 0 && s.turn === 1);
  await shot(p, "powers");

  // 4. game end: a ten-line by your drop, line pulses, overlay shows
  await forge(p, [[0, 0, 2, 4], [0, 1, 1, 1], [0, 2, 2, 2]], { next: [3, 1], power: stock });
  [x, y] = await colX(p, 3, 0); await p.mouse.click(x, y);
  s = await st(p);
  ck("the ten-line wins", s.over && s.over.winner === 1 && s.over.type === "ten");
  ck("the winning line is marked", await p.locator(".disc.win").count() === 4);
  await p.waitForSelector("#over:not([hidden])", { timeout: 3000 });
  ck("result overlay shows", /You win/.test(await p.textContent("#over")));
  ck("the record counts the win", /Won 1/.test(await p.textContent("#rec")));
  await shot(p, "won");
  await p.click("#again");
  s = await st(p);
  ck("New game from the overlay", !s.over && s.moves === 0 && await p.isHidden("#over"));
  // the computer can win too
  await forge(p, [[0, 0, 2, 1], [0, 1, 2, 1], [0, 2, 2, 1], [1, 0, 1, 1], [1, 1, 1, 1]], { next: [1, 1] });
  [x, y] = await colX(p, 6, 0); await p.mouse.click(x, y);
  await myTurn(p);
  s = await st(p);
  ck("the computer takes its win", s.over && s.over.winner === 2);
  await p.waitForSelector("#over:not([hidden])", { timeout: 3000 });
  ck("loss overlay", /computer/i.test(await p.textContent("#over")));
  // difficulty switch
  await p.click("#again");
  await p.click('#levels button[data-level="hard"]');
  s = await st(p);
  ck("Hard starts a Hard game", s.level === "hard" && await p.locator('#levels button[data-level="hard"][aria-pressed="true"]').count() === 1);
  await p.reload();
  ck("level survives reload", (await st(p)).level === "hard");
  ck("no page errors", errs.length === 0, errs.join("|"));
  await ctx.close();

  // 5. storage blocked
  ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
  p = await ctx.newPage(); const e2 = []; p.on("pageerror", e => e2.push(e.message));
  await p.addInitScript(() => { Object.defineProperty(window, "localStorage", { get() { throw new Error("blocked"); } }); });
  await p.goto(page);
  [x, y] = await colX(p, 3); await p.mouse.click(x, y);
  await myTurn(p);
  ck("runs with storage blocked", e2.length === 0 && (await st(p)).moves === 2, e2.join("|"));
  await ctx.close();

  // 6. reduced motion: plays, no animations on discs
  ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, reducedMotion: "reduce" });
  p = await ctx.newPage(); const e3 = []; p.on("pageerror", e => e3.push(e.message));
  await p.goto(page);
  await p.focus("#board"); await p.keyboard.press("Enter");
  ck("reduced motion: a drop lands", (await st(p)).moves >= 1);
  ck("reduced motion: discs do not animate", await p.evaluate(() => [...document.querySelectorAll(".disc")].every(d => getComputedStyle(d).animationName === "none")));
  await forge(p, [[0, 0, 1, 1], [0, 1, 1, 1], [0, 2, 1, 1]], { next: [1, 1] });
  await p.keyboard.press("ArrowRight"); await p.keyboard.press("ArrowRight"); await p.keyboard.press("ArrowRight");
  const cur = await p.evaluate(() => document.querySelector(".slot.aim") ? [...document.querySelectorAll(".slot")].indexOf(document.querySelector(".slot.aim")) % 7 : -1);
  for (let k = 0; k < 7 && (await p.evaluate(() => [...document.querySelectorAll(".slot")].indexOf(document.querySelector(".slot.aim")) % 7)) !== 3; k++) await p.keyboard.press("ArrowRight");
  await p.keyboard.press("Enter");
  s = await st(p);
  ck("reduced motion: the win shows a static highlight", s.over && s.over.winner === 1 && await p.locator(".disc.win").count() === 4 &&
     await p.evaluate(() => getComputedStyle(document.querySelector(".disc.win")).animationName === "none"), "cursor " + cur);
  await shot(p, "desktop-reduced");
  ck("no page errors (reduced motion)", e3.length === 0, e3.join("|"));
  await ctx.close();
};
