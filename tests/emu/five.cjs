/* SPDX-License-Identifier: Apache-2.0 | Copyright 2026 alvations (Melon Lab)
 * Browser checks for Five. Run: NODE_PATH=$(npm root -g) node tests/emu/run.cjs five */
"use strict";
module.exports = async function ({ browser, url, ck, shot }) {
  const page = url + "five/";
  const idle = (p) => p.waitForFunction(() => window.__five && !window.__five.busy && (window.__five.state.turn === "p" || window.__five.state.roundOver), null, { timeout: 5000 });
  const forge = (p, patch) => p.evaluate((patch) => {
    const s = JSON.parse(JSON.stringify(window.__five.state));
    Object.assign(s, { turn: "p", roundOver: null, matchOver: null, shield: null, midTurn: false, prev: null, seen: {}, quiet: 0 }, patch);
    window.__five.state = s;
  }, patch);
  const st = (p) => p.evaluate(() => window.__five.state);
  const slot = (p, i) => p.locator('.slot[data-i="' + i + '"]');

  // 1. loads, the computer opens, a real turn by clicks
  let ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2 });
  let p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto(page);
  ck("four tile slots", await p.locator(".slot").count() === 4);
  await idle(p);
  let s = await st(p);
  ck("the computer opened the round", s.moves >= 1 && s.tiles.reduce((a, b) => a + b, 0) !== 4 || s.roundOver, JSON.stringify(s.tiles));
  ck("no horizontal scroll at 375px", await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await forge(p, { tiles: [2, 1, 1, 1] });
  await slot(p, 0).click();
  ck("tapping your tile selects it", await p.locator(".slot.sel").count() === 1);
  await slot(p, 2).click();
  s = await st(p);
  ck("the add landed on the computer tile", s.tiles[2] === 3 && s.turn === "c", JSON.stringify(s.tiles));
  await idle(p);
  s = await st(p);
  ck("the computer replied", s.turn === "p" && s.moves >= 2);
  ck("the game never says hand or finger", !/\b(hand|finger)s?\b/i.test(await p.textContent("body")));
  await shot(p, "play");

  // 2. keyboard: arrows move the cursor, Enter picks
  await forge(p, { tiles: [1, 2, 1, 1] });
  await p.focus("#board");
  await p.keyboard.press("ArrowDown"); await p.keyboard.press("ArrowLeft"); // cursor home: your left tile
  await p.keyboard.press("ArrowRight");               // cursor on your right tile (2)
  await p.keyboard.press("Enter");
  await p.keyboard.press("ArrowUp");                  // computer right tile
  await p.keyboard.press("Enter");
  s = await st(p);
  ck("keyboard move: 2 added onto the computer's right tile", s.tiles[3] === 3, JSON.stringify(s.tiles));
  await idle(p);

  // 3. power-ups
  const stock = { p: { undo: 1, split: 1, shield: 1, nudge: 1 }, c: { undo: 0, split: 0, shield: 0, nudge: 0 } };
  await forge(p, { tiles: [3, 1, 2, 2], power: stock });
  await p.keyboard.press("2");
  ck("Split arms targeting", await p.locator("#board.targeting").count() === 1);
  await p.keyboard.press("Escape");
  ck("Esc cancels", await p.locator("#board.targeting").count() === 0);
  await p.keyboard.press("2"); await slot(p, 0).click();
  s = await st(p);
  ck("Split moved a point", s.tiles[0] === 2 && s.tiles[1] === 2 && s.power.p.split === 0, JSON.stringify(s.tiles));
  await idle(p);
  await forge(p, { tiles: [1, 4, 2, 2], power: JSON.parse(JSON.stringify(stock)) });
  await p.keyboard.press("3"); await slot(p, 1).click();
  ck("Shield marks the tile", await p.locator(".slot.shield").count() === 1);
  await slot(p, 0).click(); await slot(p, 2).click();
  await idle(p);
  s = await st(p);
  ck("the shielded 4 survived the computer's turn", s.tiles[1] === 4, JSON.stringify(s.tiles));
  await forge(p, { tiles: [1, 1, 4, 2], power: JSON.parse(JSON.stringify(stock)) });
  await p.keyboard.press("4"); await slot(p, 2).click();
  s = await st(p);
  ck("Nudge +1 burst the computer's 4", s.tiles[2] === 0 && s.power.p.nudge === 0, JSON.stringify(s.tiles));
  await shot(p, "nudge");
  await idle(p);
  s = await st(p);
  if (!s.roundOver) {
    await p.click("#tray .pw:nth-child(1)");
    s = await st(p);
    ck("Undo rewinds to before the Nudge, stock restored", s.tiles[2] === 4 && s.power.p.nudge === 1 && s.power.p.undo === 0, JSON.stringify(s));
  } else ck("round ended early (unexpected)", false);

  // 4. round end and match end
  await forge(p, { tiles: [1, 0, 0, 4], wins: { p: 0, c: 0 } });
  await slot(p, 0).click(); await slot(p, 3).click();
  await idle(p);
  ck("round-over overlay shows", await p.isVisible("#over") && /Round to you/.test(await p.textContent("#over-title")));
  await shot(p, "round");
  await p.click("#again");
  await idle(p);
  s = await st(p);
  ck("next round starts fresh with the computer opening", s.round === 2 && !s.roundOver && s.moves > 0);
  await forge(p, { tiles: [1, 0, 0, 4], wins: { p: 2, c: 1 } });
  await slot(p, 0).click(); await slot(p, 3).click();
  await idle(p);
  ck("match-over overlay shows", /take the match/.test(await p.textContent("#over-title")) && (await p.textContent("#again")) === "New match");
  ck("matches record counts the win", (await p.textContent("#matches")) === "1-0");
  await shot(p, "match");
  await p.reload(); await idle(p);
  ck("state survives reload", (await p.textContent("#matches")) === "1-0");
  // difficulty row
  await p.click("#again"); await idle(p);
  await p.click('#levels button[data-level="hard"]');
  await p.click('#levels button[data-level="hard"]');
  await idle(p);
  ck("difficulty switch starts a Hard match", (await st(p)).level === "hard");
  ck("no page errors", errs.length === 0, errs.join("|"));
  await ctx.close();

  // 5. storage blocked
  ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  p = await ctx.newPage(); const e2 = []; p.on("pageerror", e => e2.push(e.message));
  await p.addInitScript(() => { Object.defineProperty(window, "localStorage", { get() { throw new Error("blocked"); } }); });
  await p.goto(page); await idle(p);
  await forge(p, { tiles: [2, 1, 1, 1] });
  await slot(p, 0).click(); await slot(p, 2).click(); await idle(p);
  ck("runs with storage blocked", e2.length === 0 && (await st(p)).moves >= 2, e2.join("|"));
  await ctx.close();

  // 6. reduced motion: still plays, the burst is a fade
  ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  p = await ctx.newPage(); const e3 = []; p.on("pageerror", e => e3.push(e.message));
  await p.goto(page); await idle(p);
  await forge(p, { tiles: [4, 1, 2, 1] });
  await slot(p, 0).click(); await slot(p, 2).click();
  await p.waitForTimeout(60);
  const anim = await p.evaluate(() => { const g = document.querySelector(".ghost"); return g ? getComputedStyle(g).animationName : "none"; });
  ck("reduced motion: the burst fades, no scale", anim === "five-fade" || anim === "none", anim);
  await idle(p);
  const r = await st(p);
  ck("reduced motion plays the turn through", r.tiles[2] === 0 && r.moves >= 2 && e3.length === 0, JSON.stringify(r.tiles) + e3.join("|"));
  await ctx.close();
};
