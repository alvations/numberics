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
  ck("R7: no toast for the round result (the overlay says it)", !(await p.evaluate(() => document.getElementById("toast").classList.contains("on") && /^Burst!$/.test(document.getElementById("toast").textContent))));
  await shot(p, "round");
  await p.click("#again");
  await idle(p);
  s = await st(p);
  ck("next round starts fresh with the computer opening", s.round === 2 && !s.roundOver && s.moves > 0);
  await forge(p, { tiles: [1, 0, 0, 4], wins: { p: 2, c: 1 } });
  await slot(p, 0).click(); await slot(p, 3).click();
  await idle(p);
  ck("match-over overlay shows", (await p.textContent("#over-title")) === "Match to you" && (await p.textContent("#again")) === "New game");
  ck("R8: summary line is '<Result> · <tally>'", (await p.textContent("#over-text")) === "Match won · 3-1", await p.textContent("#over-text"));
  ck("R8: the headline is white, not gold", await p.evaluate(() => getComputedStyle(document.getElementById("over-title")).color) === "rgb(236, 235, 241)");
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

  // 4b. R1, R4, R5, R6, R8, R9 at 375px
  ctx = await browser.newContext({ viewport: { width: 375, height: 667 } });
  p = await ctx.newPage(); const e4 = []; p.on("pageerror", e => e4.push(e.message));
  await p.goto(page); await idle(p);
  ck("R6: H1 is the game name, subtitle starts with the Numberics link", (await p.textContent("h1")) === "Five" && (await p.textContent(".sub a")) === "Numberics" && /^Numberics · [A-Z].*\.$/.test((await p.textContent(".sub")).trim()));
  ck("how-to has no jargon (seat, solved) and says perfect play wins", await p.evaluate(() => { const t = document.querySelector(".how").textContent; return !/seat|solved|opens/i.test(t) && /perfect play always wins/.test(t); }));
  ck("R11: restart says New game", (await p.textContent("#new")) === "New game");
  // R1: a lost round with a snapshot and Undo stock: Undo is aria-disabled and a tap explains why
  await forge(p, { tiles: [4, 0, 1, 2], power: { p: { undo: 2, split: 0, shield: 0, nudge: 0 }, c: { undo: 0, split: 0, shield: 0, nudge: 0 } }, wins: { p: 0, c: 2 } });
  await slot(p, 0).click(); await slot(p, 2).click(); // your 4 bursts their 1; the computer's 2 then bursts your 4
  await p.waitForFunction(() => window.__five.state.roundOver && !window.__five.busy, null, { timeout: 5000 });
  s = await st(p);
  ck("the computer took the match", s.matchOver === "c", JSON.stringify(s.tiles));
  const undoBtn = p.locator("#tray .pw").nth(0);
  ck("R1: Undo is aria-disabled after a lost match", (await undoBtn.getAttribute("aria-disabled")) === "true");
  await undoBtn.click();
  s = await st(p);
  ck("R1: tapping it changes nothing and says why", s.matchOver === "c" && s.power.p.undo === 2 && /Undo: Take back.*Not once a round is decided\./.test(await p.textContent("#hint")), await p.textContent("#hint"));
  ck("R8: the lost-match headline fits one line at 375px", await p.evaluate(() => { const h = document.getElementById("over-title"); return h.textContent === "Match to the computer" && h.getBoundingClientRect().height < parseFloat(getComputedStyle(h).lineHeight) * 1.5; }));
  ck("record counts the loss", (await p.textContent("#matches")) === "0-1");
  await shot(p, "lost-375");
  await p.click("#again"); await idle(p);
  // R5: an empty tray button explains itself in the hint line
  await forge(p, { tiles: [2, 1, 1, 1], power: { p: { undo: 1, split: 0, shield: 1, nudge: 1 }, c: { undo: 0, split: 0, shield: 0, nudge: 0 } } });
  await p.locator("#tray .pw").nth(1).click();
  ck("R5: empty Split explains what it does and how to earn it", /^Split: Move one point.*Burst a computer tile to earn one\./.test(await p.textContent("#hint")) && await p.locator("#board.targeting").count() === 0, await p.textContent("#hint"));
  ck("R5: tooltip voice '2: Split. ...'", /^2: Split\. Move one point/.test(await p.locator("#tray .pw").nth(1).getAttribute("title")));
  // R9: Enter on a focused tray button uses that button, not the board
  await p.locator("#tray .pw").nth(3).focus(); await p.keyboard.press("Enter");
  ck("R9: Enter on the focused Nudge button arms Nudge", await p.locator("#board.targeting").count() === 1 && (await st(p)).tiles.join("") === "2111");
  await shot(p, "target-375");
  // keyboard targeting: arrows to the computer's left tile, Enter nudges it
  await p.focus("#board");
  await p.keyboard.press("ArrowDown"); await p.keyboard.press("ArrowLeft"); await p.keyboard.press("ArrowUp"); await p.keyboard.press("Enter");
  s = await st(p);
  ck("R9: keyboard aims Nudge (+1 on the computer's left tile)", s.tiles[2] === 2 && s.power.p.nudge === 0, JSON.stringify(s.tiles));
  await idle(p);
  // a warning uses the neutral toast
  await forge(p, { tiles: [2, 1, 1, 1], power: { p: { undo: 0, split: 0, shield: 0, nudge: 1 }, c: { undo: 0, split: 0, shield: 0, nudge: 0 } } });
  await p.keyboard.press("4"); await slot(p, 0).click(); // a 1 cannot... your 2 goes down to 1: valid; try a dead target instead
  await idle(p);
  await forge(p, { tiles: [2, 1, 0, 1], power: { p: { undo: 0, split: 0, shield: 0, nudge: 1 }, c: { undo: 0, split: 0, shield: 0, nudge: 0 } } });
  await p.keyboard.press("4"); await slot(p, 2).click();
  ck("R7: 'Pick a valid tile' is the neutral toast", await p.evaluate(() => { const t = document.getElementById("toast"); return t.textContent === "Pick a valid tile" && t.classList.contains("bad"); }));
  await p.keyboard.press("Escape");
  // R4: on Hard the computer never plays a power-up, even holding stock from an old save
  const toasts = [];
  await p.exposeFunction("__toastSeen", (t) => toasts.push(t));
  await p.evaluate(() => { new MutationObserver(() => window.__toastSeen(document.getElementById("toast").textContent)).observe(document.getElementById("toast"), { childList: true, characterData: true, subtree: true }); });
  for (let k = 0; k < 4; k++) {
    await forge(p, { level: "hard", tiles: [1, 1, 1, 1], power: { p: { undo: 0, split: 0, shield: 0, nudge: 0 }, c: { undo: 0, split: 9, shield: 9, nudge: 9 } } });
    for (let g = 0; g < 10; g++) {
      s = await st(p); if (s.roundOver) break;
      const m = await p.evaluate(() => window.NumbericsFive.aiPlan(window.__five.state, "random").plan[0]);
      if (m.type === "pass") await slot(p, s.tiles[0] ? 0 : 1).click(); else { await slot(p, m.from).click(); await slot(p, m.to).click(); }
      await idle(p);
    }
    s = await st(p);
    ck("R4: the Hard computer kept its stock unused", s.power.c.split === 9 && s.power.c.shield === 9 && s.power.c.nudge === 9, JSON.stringify(s.power.c));
  }
  ck("R4: no 'Computer used' or 'Computer earned' toast", !toasts.some(t => /Computer (used|earned)/.test(t)), toasts.join("|"));
  ck("no page errors (375)", e4.length === 0, e4.join("|"));
  await ctx.close();

  // 4c. page height at 390x844 fits without scrolling
  ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  p = await ctx.newPage(); await p.goto(page); await idle(p);
  ck("page fits 390x844 without scrolling", await p.evaluate(() => document.documentElement.scrollHeight <= 844), String(await p.evaluate(() => document.documentElement.scrollHeight)));
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
