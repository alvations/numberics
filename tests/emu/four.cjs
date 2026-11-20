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
  ck("R11: the opponent is 'Computer', never 'CPU'", !/\bCPU\b/.test(await p.textContent("body")) && /Computer/.test(await p.textContent("header")));
  ck("R11: an empty Held reads 'none'", (await p.textContent("#held")) === "none");
  ck("R6: H1 is the game name, subtitle is the Numberics link and a tagline", (await p.textContent("h1")) === "Four" &&
     /^Numberics · .+\.$/.test((await p.textContent(".sub")).trim()) && await p.locator(".sub a[href='../']").count() === 1);
  ck("the rule stays in the hint line", /two of yours/.test(await p.textContent("#hint")));
  await p.locator("#tray button").nth(1).click({ force: true });
  ck("R5: tapping an empty power-up explains it and how to earn it", /^Pop: Remove any disc.*Earn charges/.test(await p.textContent("#hint")),
     await p.textContent("#hint"));
  ck("R5: unusable tray buttons are aria-disabled, never disabled", await p.locator("#tray button[aria-disabled='true']").count() === 4 &&
     await p.locator("#tray button[disabled]").count() === 0);
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
  ck("keyboard drop in column 1", s.moves === before + 1 && s.last % 7 === 1 && s.own[s.last] === 1, JSON.stringify(s.own.slice(0, 14)));
  await myTurn(p);

  // 3. power-ups
  const stock = [{ undo: 1, pop: 1, hold: 1, tune: 1 }, { undo: 0, pop: 0, hold: 0, tune: 0 }];
  // the computer holds a 4: no line of any kind is open to it after your next drop, so the reply cannot end the game
  await forge(p, [[0, 2, 1, 1], [1, 2, 2, 3], [2, 2, 1, 2], [0, 4, 2, 2]], { power: stock, next: [1, 4], held: [0, 0] });
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
  ck("drop and reply happened", s.moves >= 6 && !!s.prev, JSON.stringify({ over: s.over, own: s.own, num: s.num }));
  const own0 = (await p.evaluate(() => JSON.stringify(window.__four.state.prev.own)));
  await p.keyboard.press("1");
  s = await st(p);
  ck("Undo took back both moves", JSON.stringify(s.own) === own0 && s.power[0].undo === 0 && s.turn === 1, JSON.stringify({ u: s.power[0], t: s.turn, over: s.over, hint: await p.textContent("#hint"), m: s.moves }));
  await shot(p, "powers");
  // R9: Pop aimed from the keyboard (arrow cursor + Enter); Enter on a focused button is that button, never a drop
  await forge(p, [[0, 2, 1, 1], [1, 2, 2, 3], [0, 4, 2, 2]], { power: stock, next: [1, 2], held: [0, 0] });
  await p.focus("#board");
  await p.evaluate(() => { document.querySelector("#board").dispatchEvent(new MouseEvent("mousemove", { clientX: -1 })); });
  await p.keyboard.press("2");
  ck("R9: Pop shows a keyboard cursor", await p.locator(".slot.cur").count() === 1);
  // walk the cursor to column 2, bottom row
  for (let k = 0; k < 7; k++) {
    const at = await p.evaluate(() => [...document.querySelectorAll(".slot")].indexOf(document.querySelector(".slot.cur")));
    if (at % 7 === 2) break; await p.keyboard.press("ArrowRight");
  }
  for (let k = 0; k < 6; k++) await p.keyboard.press("ArrowDown");
  await shot(p, "pop-target");
  await p.keyboard.press("Enter");
  s = await st(p);
  ck("R9: Enter pops the disc under the cursor", s.own[2] === 2 && s.num[2] === 3 && s.own[9] === 0 && s.power[0].pop === 0, JSON.stringify(s.own.slice(0, 14)));
  const mv0 = s.moves;
  await p.locator("#tray button").nth(2).focus(); await p.keyboard.press("Enter");
  s = await st(p);
  ck("R9: Enter on a focused tray button uses it and drops nothing", s.moves === mv0 && s.held[0] === 1, JSON.stringify({ m: s.moves, h: s.held }));

  // 4. game end: a ten-line by your drop, line pulses, overlay shows
  await forge(p, [[0, 0, 2, 4], [0, 1, 1, 1], [0, 2, 2, 2]], { next: [3, 1], power: stock });
  [x, y] = await colX(p, 3, 0); await p.mouse.click(x, y);
  s = await st(p);
  ck("the ten-line wins", s.over && s.over.winner === 1 && s.over.type === "ten");
  ck("the winning line is marked", await p.locator(".disc.win").count() === 4);
  ck("the other discs step back so the line stands out", await p.locator(".disc.dim").count() === 0 || await p.locator(".disc.dim").count() === (s.own.filter(Boolean).length - 4));
  ck("the winning line does not grow over its neighbours", await p.evaluate(() => { const d = document.querySelector(".disc.win");
    return getComputedStyle(d).animationName === "none" && getComputedStyle(d).scale === "none"; }));
  ck("R7: no result toast (the card is the one channel)", !/Ten!|Four in a row!|got there|draw/i.test(await p.textContent("#toast")), await p.textContent("#toast"));
  ck("R1: Undo is unavailable after a win", await p.locator("#tray button").first().getAttribute("aria-disabled") === "true");
  await p.keyboard.press("1");
  s = await st(p);
  ck("R1: pressing Undo after a win changes nothing and says why", s.over && s.over.winner === 1 && /Not after a result/.test(await p.textContent("#hint")));
  await p.waitForSelector("#over:not([hidden])", { timeout: 3000 });
  ck("result overlay shows", /You win/.test(await p.textContent("#over")));
  ck("R8: the summary spells out the ten and the tally", /4 \+ 1 \+ 2 \+ 3 = 10 · won 1, lost 0/.test(await p.textContent("#over-text")), await p.textContent("#over-text"));
  ck("the record counts the win once", (await p.textContent("#rec")) === "1-0");
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
  ck("R7: no gold toast for the loss", !(await p.locator("#toast.on:not(.bad)").count()));
  await p.keyboard.press("1");
  ck("R1: no Undo after a loss, the record keeps the loss", (await st(p)).over && (await p.textContent("#rec")) === "1-1");
  await shot(p, "lost");
  // difficulty switch
  await p.click("#again");
  s = await st(p);
  ck("the opener alternates: the computer opens the next game", s.first === 2);
  await myTurn(p);
  ck("the computer dropped first", (await st(p)).moves === 1);
  await p.click('#levels button[data-level="easy"]');
  ck("a level switch before your first disc needs no confirmation", (await st(p)).level === "easy");
  [x, y] = await colX(p, 0); await p.mouse.click(x, y); await myTurn(p);
  await p.click('#levels button[data-level="hard"]');
  s = await st(p);
  ck("R10: a level switch mid-game asks 'Sure?' first", s.level === "easy" && (await p.textContent('#levels button[data-level="hard"]')) === "Sure?");
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
