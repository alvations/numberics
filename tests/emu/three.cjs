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
  // 0. the how-to sheet (REDESIGN.md 1.3, 3.6, 9.3): opens by itself on a first visit, three steps, once; the full rules
  // live in the collapsed How to play row under the board
  await p.waitForSelector("#sh-howto:not([hidden])", { timeout: 3000 }).catch(() => {});
  ck("first visit opens the How to play sheet", await p.isVisible("#sh-howto") && await p.evaluate(() => NumbericsUI.current() === "howto"));
  ck("the sheet has three steps with the spec's words", await p.evaluate(() => [...document.querySelectorAll("#sh-howto .step p")].map(e => e.textContent).join("|")) ===
    "Each swipe moves tiles one step.|1 and 2 make 3. From 3 up, equal tiles join.|Line up 3, 6, 9 in a row or column, either way round, for a rainbow flush and a power-up.");
  ck("each step has a drawn picture (3, 6, 9 wear the board's colours)", await p.locator("#sh-howto .step .pv").count() === 3 &&
    await p.locator("#sh-howto .pv .mt.three[data-band='2']").count() === 1);
  await p.waitForTimeout(300);
  ck("the sheet fits at 375px", await p.evaluate(() => { const r = document.querySelector("#sh-howto .sheet").getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight + 1 && document.documentElement.scrollWidth <= innerWidth; }));
  await shot(p, "howto");
  await p.keyboard.press("ArrowLeft");
  ck("arrows do not play under the sheet", (await st(p)).moves === 0);
  // regression (integration): the sheet opened by itself, so its opener was the body; focus stayed on the hidden Play
  // button and the next key went to the closed sheet (which kept it) until the browser's next frame. Checked in the
  // same task as the click, before any frame can drop the focus.
  ck("Play: focus leaves the closed sheet at once", await p.evaluate(() => {
    document.getElementById("howto-play").focus(); document.getElementById("howto-play").click();
    const a = document.activeElement; return !(a && a.closest && a.closest("#sh-howto")); }));
  ck("Play closes the sheet", !(await p.isVisible("#sh-howto")) && await p.evaluate(() => !NumbericsUI.open()));
  ck("the how-to is remembered in progress", await p.evaluate(() => NumbericsProgress.seenHowto("three")));
  ck("fresh board hint fills the empty band", /Swipe to start/.test(await p.textContent("#hint")));
  ck("subtitle: a plain tagline with a full stop, no Numberics link (the top bar mark links home)", (await p.textContent(".sub")).trim() === "Count in threes." && await p.locator(".sub a").count() === 0);
  ck("the games list heading is the family's one label", (await p.textContent("#more")) === "More number games");
  ck("BEST is a dimmed none before any play (R11)", (await p.textContent("#best")) === "none" && await p.locator("#best.none").count() === 1);
  ck("craft #5: the empty value uses the shared .stat .none style (same size as values, weight 600, muted)", await p.evaluate(() => {
    const n = getComputedStyle(document.getElementById("best")), v = getComputedStyle(document.getElementById("score")),
      mute = getComputedStyle(document.documentElement).getPropertyValue("--mute").trim();
    const probe = document.createElement("i"); probe.style.color = mute; document.body.appendChild(probe); const mc = getComputedStyle(probe).color; probe.remove();
    return n.fontSize === v.fontSize && n.fontWeight === "600" && n.color === mc; }));
  ck("the How to play row is collapsed and holds the full rules word for word", await p.evaluate(() => {
    const d = document.getElementById("how"), t = d.textContent.replace(/\s+/g, " ");
    return d.tagName === "DETAILS" && !d.open && /from 3 up equal tiles merge/.test(t) && /1 \+ 2 and 3 \+ 6 are the only unequal pairs/.test(t) &&
      /Two 1s or two 2s never merge/.test(t) && /A flush uses only 3, 6, 9 and 12/.test(t) && /repeat with a ring/.test(t) && /Keys:/.test(t); }));
  ck("the How to play row is a 44 px target", await p.evaluate(() => document.querySelector("#how summary").getBoundingClientRect().height >= 44));
  await p.reload();
  ck("the sheet does not open again", !(await p.isVisible("#sh-howto")));
  await p.click("#how summary"); await p.click("#howto-open");
  ck("the row re-opens the steps", await p.isVisible("#sh-howto"));
  await p.keyboard.press("Escape");
  ck("Esc closes it", !(await p.isVisible("#sh-howto")));
  await p.click("#how summary");
  ck("the games list at the page foot is the cards, in games.json order, Three marked Playing", await p.evaluate(() => {
    const c = [...document.querySelectorAll("#games.cards a.card")].map(a => a.dataset.id);
    return c.join() === "fibonacci,two,three,four,five,six,seven,nine,fifteen,sudoku" &&
      document.querySelector('#games a.card[data-id="three"]').getAttribute("aria-current") === "page"; }));
  ck("nine starting tiles", await p.locator("#tiles .tile").count() === 9);
  ck("starting tiles are 1, 2 or 3", await p.evaluate(() => [...document.querySelectorAll("#tiles .tile")].every(t => /^[123]$/.test(t.textContent))));
  ck("starts with one Undo", JSON.stringify((await st(p)).power) === '{"undo":1,"smash":0,"swap":0,"third":0}');
  ck("tray has four slots", await p.locator("#tray .pw").count() === 4);
  ck("next tile is previewed", /^[123]$/.test(await p.textContent("#next")));
  for (let i = 0; i < 12; i++) await p.keyboard.press(["ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown"][i % 4]);
  await p.waitForTimeout(700);
  ck("moves were counted", (await st(p)).moves > 0);
  ck("every tile shows its number", await p.evaluate(() => [...document.querySelectorAll("#tiles .tile")].every(t => /^[0-9]+$/.test(t.textContent))));
  ck("multiples of 3 wear a rainbow band", await p.evaluate(() => [...document.querySelectorAll("#tiles .tile > .face")].every(t => (+t.textContent % 3 === 0) === t.hasAttribute("data-band"))));
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
  ck("drawn 9 is yellow (band 2)", await p.evaluate(() => [...document.querySelectorAll("#tiles .tile > .face")].some(t => t.textContent === "9" && t.dataset.band === "2")));

  // 3. Flush: the rainbow sweeps the run, then it collapses, scores and pays a power-up
  await set(p, FLUSH, { score: 0, power: { undo: 1, smash: 0, swap: 0, third: 0 } });
  await p.keyboard.press("ArrowLeft"); await p.waitForTimeout(180);
  ck("the run is marked while the rainbow sweeps", await p.locator("#tiles .tile.run").count() === 3);
  const flushToast = await p.textContent("#toast"); // a trophy earned by this swipe toasts after its animation
  await shot(p, "flush");
  await p.waitForTimeout(800);
  s = await st(p);
  ck("the run cleared from the board", !s.grid[8] && !s.grid[0] && !s.grid[4]);
  ck("flush scored sum x length = 54", s.score === 54);
  ck("flush earned one power-up", s.power.undo + s.power.smash + s.power.swap + s.power.third === 2);
  ck("toast announces the rainbow flush", /^Rainbow flush 3-6-9, \+54 \+1 (Undo|Smash|Swap|Third)$/.test(flushToast), flushToast);
  ck("cold #14: the hint band says what the earned power-up does", /^Earned an? (Undo: take back the last move|Smash: remove one tile|Swap: trade two neighbouring tiles|Third: turn a 1 or a 2 into a 3)\.$/.test(await p.textContent("#hint")), await p.textContent("#hint"));
  ck("then the trophy it earned toasts, once the flush has played", /^Trophy: First flush$/.test(await p.textContent("#toast")), await p.textContent("#toast"));
  ck("a flush toast is a reward (gold)", !(await p.evaluate(() => document.getElementById("toast").classList.contains("bad"))));
  ck("the run marks are gone after the collapse", await p.locator("#tiles .tile.run").count() === 0);
  ck("score pill updated", (await p.textContent("#score")) === "54");

  // 3b. R5: a tray button that cannot act explains itself in the hint line (phones have no hover)
  await set(p, [1, 3, 0, 0, 6, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 12], { moves: 3, power: { undo: 0, smash: 0, swap: 0, third: 0 } });
  ck("empty tray buttons are aria-disabled, never disabled", await p.evaluate(() => [...document.querySelectorAll("#tray .pw")].every(b => !b.disabled && b.getAttribute("aria-disabled") === "true")));
  await p.locator("#tray .pw").nth(1).click({ force: true });
  ck("tapping an empty Smash explains it and how to earn it (Medium, a first visit)", (await p.textContent("#hint")) === "Smash: Remove one tile. Earn one with every Flush, or a join as big as your top tile (18 up).", await p.textContent("#hint"));
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
  ck("swap-made run cleared and scored", !s.grid[0] && !s.grid[1] && !s.grid[2] && s.score === 54, JSON.stringify(s.grid));
  ck("swap-made flush paid no power-up", s.power.undo + s.power.smash + s.power.swap + s.power.third === 0);
  ck("toast says a power-up set it up", /\(no power-up\)/.test(await p.textContent("#toast")), await p.textContent("#toast"));
  await p.keyboard.press("ArrowDown"); await p.waitForTimeout(400); s = await st(p);
  ck("the next swipe pays nothing either", s.power.undo + s.power.smash + s.power.swap + s.power.third === 0);

  // 3d. R9: keyboard targeting (arrow cursor + Enter), and Enter on a focused button is that button only
  await set(p, [1, 3, 0, 0, 6, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 12], { moves: 3, power: { undo: 1, smash: 2, swap: 1, third: 1 } });
  await p.focus("#board");
  await p.keyboard.press("2");
  ck("keyboard arming shows a cursor on the first tile", await p.locator("#tiles .tile.cur").count() === 1 && /arrows \+ Enter/.test(await p.textContent("#hint")));
  ck("craft #13: keyboard targeting copy still says how to tap", /^Tap a tile to smash it, or arrows \+ Enter\. Esc cancels\.$/.test(await p.textContent("#hint")), await p.textContent("#hint"));
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

  // 4b. R15 (critic S2): a flush on a full stock says "Power-ups full"
  await set(p, FLUSH, { score: 0, moves: 3, free: false, power: { undo: 9, smash: 9, swap: 9, third: 9 } });
  await p.keyboard.press("ArrowLeft"); await p.waitForTimeout(150);
  ck("R15: a flush on a full stock says Power-ups full", (await p.textContent("#toast")) === "Rainbow flush 3-6-9, +54. Power-ups full" &&
    await p.evaluate(() => document.getElementById("toast").classList.contains("on")), await p.textContent("#toast"));
  await p.waitForTimeout(700);
  // craft #1: arming a power-up clears a toast that sat over the hint line
  await p.keyboard.press("2"); await p.waitForTimeout(80);
  ck("craft #1: arming a power-up clears the toast so the instruction reads in full", !(await p.evaluate(() => document.getElementById("toast").classList.contains("on"))));
  await p.keyboard.press("Escape");

  // 4c. craft #13 / #11: targeting copy names tapping, on phones and with a keyboard, and stays on one line at 375 px
  const lines = [];
  for (const desk of [false, true]) {
    await p.evaluate((d) => { window.__three.desk = d; }, desk);
    await set(p, [1, 3, 0, 0, 6, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 12], { moves: 3, power: { undo: 1, smash: 1, swap: 1, third: 1 } });
    for (const k of ["2", "3", "4"]) {
      await p.locator("#tray .pw").nth(+k - 1).click();
      lines.push(await p.evaluate(() => { const h = document.getElementById("hint"); return [h.textContent, h.getBoundingClientRect().height]; }));
      if (k === "3") { await tap(0); lines.push(await p.evaluate(() => { const h = document.getElementById("hint"); return [h.textContent, h.getBoundingClientRect().height]; })); }
      await p.locator("#tray .pw").nth(+k - 1).click(); // tapping the armed button cancels
    }
  }
  ck("every targeting line starts with Tap", lines.every(([t]) => /^(Tap|Now tap) /.test(t)), JSON.stringify(lines));
  ck("phone copy says how to cancel by tapping; keyboard copy adds arrows + Enter and Esc", lines.slice(0, 4).every(([t]) => /Tap (Smash|Swap|Third) to cancel\.$/.test(t)) &&
    lines.slice(4).every(([t]) => /Esc cancels\.$/.test(t)) && lines.slice(4).filter(([t]) => /arrows \+ Enter/.test(t)).length === 3, JSON.stringify(lines));
  ck("every targeting line fits the two-line hint band at 375 px (the board never moves)", lines.every(([, h]) => h < 45 && h === lines[0][1]), JSON.stringify(lines));
  ck("tapping the armed button cancels", await p.locator("#board.targeting").count() === 0);
  await p.evaluate(() => { window.__three.desk = matchMedia("(hover: hover) and (pointer: fine)").matches; });

  // 4d. gameplay #1 / cold #19: stuck with only Undo left says so plainly
  await set(p, [0, 3, 12, 3, 12, 3, 12, 3, 3, 12, 3, 12, 12, 3, 12, 3], { next: 12, power: { undo: 1, smash: 0, swap: 0, third: 0 } });
  await p.keyboard.press("ArrowLeft"); await p.waitForTimeout(300);
  ck("cold #13: stuck with only Undo left shows the end card (not over: Undo can rewind)", !(await st(p)).over && await p.isVisible("#over") &&
    (await p.textContent("#over h2")) === "No moves left" && (await p.textContent("#over-text")) === "Undo the last move to keep going, or start a new game.", await p.textContent("#over-text"));
  ck("the stuck card offers Undo (focused) and New game, not See the board; the hint band is clear", await p.isVisible("#over-undo") && !(await p.isVisible("#over-view")) &&
    await p.isVisible("#again") && await p.evaluate(() => document.activeElement.id === "over-undo") && (await p.textContent("#hint")) === "");
  ck("the stuck card has the game glyph and no trophy pills", await p.locator("#over > .glyph").count() === 1 && !(await p.isVisible("#over-pills")));
  await shot(p, "stuck");
  await p.click("#over-undo");
  ck("Undo on the stuck card rewinds and hides the card", !(await p.isVisible("#over")) && (await st(p)).power.undo === 0 && (await st(p)).grid[0] === 0);
  await set(p, [3, 12, 3, 12, 12, 3, 12, 3, 3, 12, 3, 12, 12, 3, 12, 3], { power: { undo: 0, smash: 1, swap: 0, third: 0 } });
  ck("stuck with another power-up: 'Use a power-up'", (await p.textContent("#hint")) === "Stuck. Use a power-up to keep going.", await p.textContent("#hint"));

  // 5. end of run: locked with an empty tray
  await p.evaluate(() => { window.__three.base = 1e9; });
  await set(p, [0, 3, 12, 3, 12, 3, 12, 3, 3, 12, 3, 12, 12, 3, 12, 3], { next: 12, used: 0, power: { undo: 0, smash: 0, swap: 0, third: 0 } });
  await p.keyboard.press("ArrowLeft"); await p.waitForTimeout(300);
  ck("overlay shows when locked with no usable power-up", await p.isVisible("#over"));
  ck("the end card shows the run's trophy as a pill (Hello, numbers)", await p.isVisible("#over-pills") &&
    /Trophy: Hello, numbers/.test(await p.textContent("#over-pills")), await p.textContent("#over-pills"));
  ck("no trophy toast over the end card (R7)", !(await p.evaluate(() => { const t = document.getElementById("toast"); return t.classList.contains("on") && /Trophy/.test(t.textContent); })));
  await shot(p, "over-pill");
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
  ck("craft #2: the end card takes focus, so no gold ring frames the finished board", await p.evaluate(() => document.activeElement.id === "again") &&
    await p.locator("#board.targeting").count() === 0);
  ck("craft #7: one New game on screen while the card shows; the page's button keeps its space", await p.evaluate(() => {
    const n = document.getElementById("new"); return getComputedStyle(n).visibility === "hidden" && n.getBoundingClientRect().height > 0; }));
  ck("subline reads '<detail> · score N'", (await p.textContent("#over-text")) === "12\u00a0flushes\u00a0· 7\u00a0power\u2011ups\u00a0· score\u00a012,345", await p.textContent("#over-text"));
  await shot(p, "over");
  await p.click("#over-view");
  ck("See the board hides the card and shows the finished board", !(await p.isVisible("#over")) && await p.locator("#tiles .tile").count() === 16);
  ck("See the board: the page's New game is back, and the hint says how to return", await p.evaluate(() => getComputedStyle(document.getElementById("new")).visibility === "visible") &&
    (await p.textContent("#hint")) === "Tap the board for the summary.");
  await p.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  ck("a tap on the board brings the card back, focus on its primary", await p.isVisible("#over") && await p.evaluate(() => document.activeElement.id === "again"));
  await p.click("#over-view"); await p.keyboard.press("Escape");
  ck("Esc brings the card back too", await p.isVisible("#over"));
  await p.click("#again");
  ck("New game from the overlay starts fresh", !(await st(p)).over && await p.locator("#tiles .tile").count() === 9);
  ck("no page errors", errs.length === 0, errs.join("|"));
  await ctx.close();

  // 5b. 320x568: the how-to sheet starts at its title and scrolls to Play; R17: Enter on a games-list card navigates
  ctx = await browser.newContext({ viewport: { width: 320, height: 568 } });
  p = await ctx.newPage();
  await p.goto(page); await p.waitForSelector("#sh-howto:not([hidden])");
  ck("320x568: the sheet title is on screen", await p.evaluate(() => { const r = document.querySelector("#sh-howto h2").getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }));
  ck("320x568: the words get more room than the pictures", await p.evaluate(() => { const st = document.querySelector("#sh-howto .step"); return st.children[1].getBoundingClientRect().width > st.children[0].getBoundingClientRect().width; }));
  ck("320x568: the sheet scrolls to Play", await p.evaluate(() => { const h = document.querySelector("#sh-howto .sheet"), b = document.getElementById("howto-play");
    h.scrollTop = h.scrollHeight; const r = b.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }));
  ck("320x568: no sideways scroll", await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await p.click("#howto-play");
  await p.focus("#games a.card:not([aria-current])");
  const href = await p.evaluate(() => document.activeElement.href);
  await Promise.all([p.waitForURL(u => String(u) === href, { timeout: 3000 }).catch(() => {}), p.keyboard.press("Enter")]);
  ck("R17: Enter on a focused games-list card navigates", p.url() === href, p.url() + " vs " + href);
  await ctx.close();

  // 6. storage that throws: still runs and plays
  ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
  p = await ctx.newPage(); const e2 = []; p.on("pageerror", e => e2.push(e.message));
  await p.addInitScript(() => { Object.defineProperty(window, "localStorage", { get() { throw new Error("blocked"); } }); });
  await p.goto(page);
  await p.waitForSelector("#sh-howto:not([hidden])"); await p.click("#howto-play");
  for (const k of ["ArrowLeft", "ArrowDown", "ArrowRight", "ArrowUp"]) await p.keyboard.press(k);
  await p.waitForTimeout(300);
  ck("runs with storage blocked", e2.length === 0 && (await st(p)).moves > 0, e2.join("|"));
  await ctx.close();

  // 7. reduced motion: instant moves; a flush shows a still rainbow outline, then collapses
  ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, reducedMotion: "reduce" });
  p = await ctx.newPage(); const e3 = []; p.on("pageerror", e => e3.push(e.message));
  await p.goto(page);
  await p.waitForSelector("#sh-howto:not([hidden])"); await p.click("#howto-play");
  await set(p, FLUSH, { score: 0 });
  await p.keyboard.press("ArrowLeft"); await p.waitForTimeout(60);
  ck("reduced motion: still outline on the run", await p.locator("#tiles .tile.run.still").count() === 3);
  ck("reduced motion: no transition on tiles", await p.evaluate(() => getComputedStyle(document.querySelector("#tiles .tile")).transitionDuration.split(",").every(d => parseFloat(d) === 0)));
  await p.waitForTimeout(700);
  ck("reduced motion: the run clears", !(await st(p)).grid[8] && !(await st(p)).grid[0] && await p.locator("#tiles .tile.run").count() === 0);
  // a swipe during the outline finishes the flush at once (no stale timer redraws an old board)
  await set(p, FLUSH, { score: 0 });
  await p.keyboard.press("ArrowLeft"); await p.keyboard.press("ArrowUp"); await p.waitForTimeout(700);
  const g2 = await p.evaluate(() => ({ dom: [...document.querySelectorAll("#tiles .tile")].length, eng: window.__three.state.grid.filter(Boolean).length }));
  ck("input during a flush settles it cleanly", g2.dom === g2.eng, JSON.stringify(g2));
  ck("no page errors under reduced motion", e3.length === 0, e3.join("|"));
  await ctx.close();

  // 8. motion (REDESIGN.md 5.4, 5.11): one-step slides, the dealt tile entering from the edge, merge pop, the flush
  // sweep then clear; input during an animation is applied at once; sounds sit on the visual beats
  ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  p = await ctx.newPage(); const e8 = []; p.on("pageerror", e => e8.push(e.message));
  await p.goto(page); await p.waitForSelector("#sh-howto:not([hidden])"); await p.click("#howto-play");
  await p.evaluate(() => NumbericsSettings.set({ motion: "full" }));
  // a probe: press a key from inside the page and sample, every frame for `ms`, the layer's nodes
  const probe = (key, ms, extra) => p.evaluate(([key, ms, extra]) => new Promise(res => {
    const box = document.getElementById("tiles").getBoundingClientRect(), snap = () => [...document.querySelectorAll("#tiles > .tile")].map(n => {
      const f = n.querySelector(".face"), r = f.getBoundingClientRect();
      return { id: n.dataset.id, v: f.textContent, x: r.x - box.x, y: r.y - box.y, w: r.width, nw: n.getBoundingClientRect().width, o: +getComputedStyle(f).opacity,
        c: +n.style.getPropertyValue("--c"), r: +n.style.getPropertyValue("--r"), cls: n.className, anims: f.getAnimations().length + n.getAnimations().length }; });
    const before = snap(), m0 = window.__three.state.moves, t0 = performance.now(), log = [];
    window.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
    const now = { moves: window.__three.state.moves, nodes: snap() };
    if (extra) setTimeout(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: extra, bubbles: true })), 30);
    (function f() { log.push({ t: performance.now() - t0, nodes: snap() }); if (performance.now() - t0 < ms) requestAnimationFrame(f);
      else res({ before, m0, now, log, moves: window.__three.state.moves, grid: window.__three.state.grid }); })();
  }), [key, ms, extra || null]);
  const cellW = await p.evaluate(() => { const b = document.getElementById("tiles"); return (b.clientWidth - 3 * parseFloat(getComputedStyle(b).getPropertyValue("--gap"))) / 4 + parseFloat(getComputedStyle(b).getPropertyValue("--gap")); });

  await set(p, [0, 0, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], { moves: 5, power: { undo: 1, smash: 1, swap: 1, third: 1 } });
  let pr = await probe("ArrowLeft", 260);
  const mover = pr.before[0].id, path = pr.log.map(l => l.nodes.find(n => n.id === mover)).filter(Boolean).map(n => Math.round(n.x));
  ck("the input is applied in the handler: the move counts and the new cell is written at once", pr.now.moves === pr.m0 + 1 && pr.now.nodes.find(n => n.id === mover).c === 1);
  ck("the tile slides one cell (frames between the two cells), not a blip", path.some(x => x < 2 * cellW - 3 && x > cellW + 3) && Math.abs(path[path.length - 1] - cellW) < 2, path.join(","));
  ck("the slide takes about T.step (100 ms): there by 160 ms", pr.log.filter(l => l.t > 160).every(l => Math.abs(l.nodes.find(n => n.id === mover).x - cellW) < 2));
  const dealt = pr.log[0].nodes.find(n => !pr.before.some(b => b.id === n.id));
  ck("the dealt tile is a new node at the far edge of the moved line", !!dealt && dealt.c === 3 && dealt.r === 0, JSON.stringify(dealt));
  const dpath = pr.log.map(l => l.nodes.find(n => n.id === dealt.id)).filter(Boolean);
  ck("it enters from outside the right edge (starts one cell further right, fading in)", dpath[0].x > 3 * cellW + cellW * 0.5 && dpath[0].o < 1 &&
    Math.abs(dpath[dpath.length - 1].x - 3 * cellW) < 2 && dpath[dpath.length - 1].o === 1, JSON.stringify(dpath.slice(0, 3).map(n => [Math.round(n.x), n.o])));
  ck("the board clips the entering tile at the cell area, never over the frame or its padding (craft #28)", await p.evaluate(() => {
    const t = document.getElementById("tiles"), a = t.getBoundingClientRect(), c = document.getElementById("cells").getBoundingClientRect();
    return getComputedStyle(t).overflow === "clip" && [["x", "x"], ["y", "y"], ["width", "width"], ["height", "height"]].every(([k]) => Math.abs(a[k] - c[k]) < 0.5); }));
  await set(p, [0, 0, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], { moves: 5 });
  pr = await probe("ArrowDown", 150);
  const dd = pr.log[0].nodes.find(n => !pr.before.some(b => b.id === n.id));
  ck("swiped down: the dealt tile enters from above the top edge", dd && dd.r === 0 && pr.log[0].nodes.find(n => n.id === dd.id).y < -cellW * 0.4, JSON.stringify(dd));

  await set(p, [3, 3, 0, 0, 1, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], { moves: 5 });
  pr = await probe("ArrowLeft", 420);
  const mergedNode = pr.now.nodes.find(n => /\bmerged\b/.test(n.cls));
  ck("a merge: the two tiles slide into one cell and a new tile pops on top", pr.now.nodes.filter(n => /\bmerged\b/.test(n.cls)).length === 2 &&
    pr.now.nodes.filter(n => /\bgone\b/.test(n.cls)).length === 4 && pr.now.nodes.filter(n => /\bmerged\b/.test(n.cls)).map(n => n.v).sort().join() === "3,6", JSON.stringify(pr.now.nodes.map(n => [n.v, n.cls])));
  const popW = pr.log.map(l => l.nodes.find(n => n.id === mergedNode.id)).filter(Boolean).map(n => n.w);
  ck("the pop swells past full size after the slide, then settles", Math.max(...popW) > popW[popW.length - 1] * 1.05 && Math.abs(popW[popW.length - 1] - pr.log[pr.log.length - 1].nodes.find(n => n.id === mergedNode.id).nw) < 2, popW.map(Math.round).join(","));
  ck("after the beats only the board's tiles remain", pr.log[pr.log.length - 1].nodes.length === pr.grid.filter(Boolean).length);

  // the flush (TRIAGE4 mechanics #2/#3, craft #27): the moment the 100 ms slide lands, the drawn board IS the engine's
  // board (the run's tiles are only leaving ghosts, the dealt tile is already in), the ghosts swell and shrink away under
  // the rainbow with no still frame, and the whole flush is over well under 500 ms. Frame by frame.
  const live = (l) => l.nodes.filter(n => !/\bgone\b/.test(n.cls));
  const drawn = (l) => { const g = new Array(16).fill(0); live(l).forEach(n => { g[n.r * 4 + n.c] = +n.v; }); return g; };
  await set(p, FLUSH, { moves: 5, score: 0, power: { undo: 1, smash: 0, swap: 0, third: 0 } });
  pr = await probe("ArrowLeft", 700);
  const eng = pr.grid.join();
  const honest = pr.log.filter(l => l.t >= 125);
  ck("from the first frame after the slide lands (125 ms), the drawn tiles are exactly the engine's board, dealt tile included",
    honest.length > 10 && honest.every(l => drawn(l).join() === eng), JSON.stringify(honest.filter(l => drawn(l).join() !== eng).slice(0, 2).map(l => [Math.round(l.t), drawn(l).join()])) + " eng " + eng);
  const dealtF = pr.now.nodes.find(n => !pr.before.some(b => b.id === n.id));
  ck("the dealt tile is in the layer from the input on, and fully visible by the slide's end", !!dealtF &&
    pr.log.filter(l => l.t >= 110).every(l => { const d = l.nodes.find(n => n.id === dealtF.id); return d && d.o === 1; }), JSON.stringify(dealtF));
  const ghosts = pr.log.map(l => ({ t: l.t, g: l.nodes.filter(n => /\brun\b/.test(n.cls) && /\bgone\b/.test(n.cls)) }));
  const gFirst = ghosts.find(x => x.g.length), gLast = ghosts.filter(x => x.g.length).pop();
  ck("the run leaves as three ghosts as soon as the slide lands (100 to 140 ms)", !!gFirst && gFirst.g.length === 3 && gFirst.t >= 90 && gFirst.t < 140, gFirst && gFirst.t);
  ck("the whole flush, slide included, is over in under 500 ms (no ghost left at 480 ms)", !!gLast && gLast.t < 480, gLast && gLast.t);
  // no idle pause: on every frame while the ghosts are there, at least one of them changes size or opacity
  let still = 0, prevG = null;
  // (a frame where every ghost is already invisible is the end, not a pause)
  ghosts.filter(x => x.g.some(n => n.o > 0.02 && n.w > 1)).forEach(x => { const sig = x.g.map(n => Math.round(n.w) + ":" + n.o.toFixed(2)).join(); if (prevG !== null && sig === prevG) still++; prevG = sig; });
  ck("no dead pause: the ghosts change on every frame until they are gone", still <= 1, still);
  ck("each ghost swells, then shrinks to nothing", [0, 1, 2].every(i => { const ws = ghosts.filter(x => x.g[i]).map(x => x.g[i].w); return Math.max(...ws) > cellW * 0.9 && Math.min(...ws) < cellW * 0.4; }),
    JSON.stringify(ghosts.filter(x => x.g.length).map(x => x.g.map(n => Math.round(n.w)))));
  ck("the busy flag clears by 500 ms", await p.evaluate(() => !window.__three.busy()));
  // mechanics #2: an input during the flush acts on the board on screen
  await set(p, FLUSH, { moves: 5, score: 0, power: { undo: 1, smash: 0, swap: 0, third: 0 } });
  const mid = await p.evaluate(() => new Promise(res => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft" }));
    setTimeout(() => {
      const g = new Array(16).fill(0);
      document.querySelectorAll("#tiles > .tile:not(.gone)").forEach(n => { g[+n.style.getPropertyValue("--r") * 4 + +n.style.getPropertyValue("--c")] = +n.querySelector(".face").textContent; });
      const s = JSON.parse(JSON.stringify(window.__three.state)), want = window.NumbericsThree.move(Object.assign({}, s, { grid: g }), "up").state.grid;
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp" }));
      res({ shown: g, engine: s.grid, want, got: window.__three.state.grid });
    }, 150);
  }));
  ck("a swipe 150 ms into a flush acts on the board on screen (mechanics #2)", mid.shown.join() === mid.engine.join() && mid.got.join() === mid.want.join(), JSON.stringify(mid));
  // two runs from one swipe leave together, in the same single beat, and the pop plays once on it
  await set(p, [3, 0, 3, 0, 6, 0, 6, 0, 9, 0, 9, 0, 0, 0, 0, 0], { moves: 5, score: 0, power: { undo: 1, smash: 0, swap: 0, third: 0 } });
  await p.evaluate(() => { window.__snd = []; const A = window.NumbericsAudio;
    ["slide", "merge", "pop", "power", "lose", "best"].forEach(n => { const o = A[n]; A[n] = function (x) { window.__snd.push([n, Math.round(performance.now() - window.__t0), x]); return o.apply(this, arguments); }; }); });
  await p.evaluate(() => { window.__t0 = performance.now(); });
  pr = await probe("ArrowLeft", 700);
  const runs = pr.log.map(l => ({ t: l.t, run: l.nodes.filter(n => /\brun\b/.test(n.cls)).map(n => n.id).sort().join() }));
  const phases = [...new Set(runs.map(r => r.run))].filter(Boolean);
  ck("two flushes from one swipe leave together in one beat", phases.length === 1 && phases[0].split(",").length === 6, JSON.stringify(phases));
  ck("the two runs are gone and the board matches the engine", pr.log[pr.log.length - 1].nodes.length === pr.grid.filter(Boolean).length && [0, 1, 4, 5, 8, 9].every(c => !pr.grid[c]),
    JSON.stringify(pr.log[pr.log.length - 1].nodes.map(n => [n.r, n.c, n.v, n.cls])) + " " + pr.grid);
  let snd = await p.evaluate(() => window.__snd);
  const sAt = (n) => snd.filter(x => x[0] === n).map(x => x[1]);
  ck("sounds on the beats: slide at the input, one pop(2) as the runs leave at the slide's end", sAt("slide")[0] < 40 && snd.filter(x => x[0] === "pop").map(x => x[2]).join() === "2" &&
    sAt("pop")[0] >= 90 && sAt("pop")[0] < 180, JSON.stringify(snd));
  // a new input finishes the timeline at once: final board, and the pending sounds play then, one of each (D7)
  await set(p, [3, 0, 3, 0, 6, 0, 6, 0, 9, 0, 9, 0, 0, 0, 0, 0], { moves: 5, score: 0 });
  await p.evaluate(() => { window.__snd = []; window.__t0 = performance.now(); });
  pr = await probe("ArrowLeft", 600, "ArrowDown");
  snd = await p.evaluate(() => window.__snd);
  ck("two quick inputs during an animation give two moves", pr.moves === pr.m0 + 2, pr.m0 + " -> " + pr.moves);
  const sl = snd.filter(x => x[0] === "slide"), pops = snd.filter(x => x[0] === "pop");
  ck("the second input played the flush's pending pop at once, once, before its own slide (D7)", pops.length === 1 && sl.length === 2 && pops[0][1] <= sl[1][1], JSON.stringify(snd));
  const last = pr.log[pr.log.length - 1].nodes;
  ck("after both, every node sits on its engine cell with its engine value", last.length === pr.grid.filter(Boolean).length &&
    last.every(n => String(pr.grid[n.r * 4 + n.c]) === n.v), JSON.stringify(last.map(n => [n.r, n.c, n.v])) + " " + pr.grid);
  ck("the Next preview cross-fades when it changes", await p.evaluate(() => { const n = document.getElementById("next"), s = window.__three.state;
    s.grid = [0, 0, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]; window.__three.state = s;
    const v = n.textContent; window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft" }));
    return n.textContent === String(window.__three.state.next) && (n.textContent === v || n.getAnimations().length === 1); }));
  // power-ups: Smash fades the tile out, Swap slides the pair past each other, Third pops; Undo cross-fades
  await set(p, [1, 3, 0, 0, 6, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 12], { moves: 3, power: { undo: 1, smash: 2, swap: 1, third: 1 } });
  const bb = await p.locator("#board").boundingBox();
  const tapc = (cell) => p.mouse.click(bb.x + bb.width * ((cell % 4) + 0.5) / 4, bb.y + bb.height * (Math.floor(cell / 4) + 0.5) / 4);
  let ids0 = await p.evaluate(() => window.__three.ids);
  await p.keyboard.press("3"); await tapc(0); await tapc(1);
  ck("Swap keeps both tiles' nodes and slides them to each other's cells", await p.evaluate((ids0) => { const a = document.querySelector('#tiles > .tile[data-id="' + ids0[0] + '"]'), b = document.querySelector('#tiles > .tile[data-id="' + ids0[1] + '"]');
    return a && b && a.style.getPropertyValue("--c") === "1" && b.style.getPropertyValue("--c") === "0"; }, ids0));
  ids0 = await p.evaluate(() => window.__three.ids);
  await p.keyboard.press("2"); await tapc(15);
  ck("Smash fades the tile out (kept as a leaving node until the fade ends)", await p.evaluate((id) => { const n = document.querySelector('#tiles > .tile[data-id="' + id + '"]'); return !!n && n.classList.contains("nmm-out"); }, ids0[15]));
  ck("no page errors in the motion checks", e8.length === 0, e8.join("|"));
  await ctx.close();

  // 9. reduced motion via the OS and via the in-app setting (5.12): Less beats Full devices, Full beats a reducing OS
  for (const [os, setting, want] of [["reduce", "auto", "reduced"], ["no-preference", "reduced", "reduced"], ["reduce", "full", "full"]]) {
    ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: os });
    p = await ctx.newPage(); const e9 = []; p.on("pageerror", e => e9.push(e.message));
    await p.goto(page); await p.waitForSelector("#sh-howto:not([hidden])"); await p.click("#howto-play");
    await p.evaluate((m) => NumbericsSettings.set({ motion: m }), setting);
    await set(p, [0, 0, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], { moves: 5 });
    const w = await p.evaluate(() => new Promise(res => {
      const n = document.querySelector("#tiles > .tile"), x0 = n.getBoundingClientRect().x;
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft" }));
      requestAnimationFrame(() => requestAnimationFrame(() => { const xs = n.getBoundingClientRect().x, fresh = [...document.querySelectorAll("#tiles > .tile")].find(t => t !== n);
        res({ x0, xs, moved: Math.abs(xs - x0), moving: n.getAnimations().length + (getComputedStyle(n).transitionDuration.split(",").some(d => parseFloat(d) > 0) ? 1 : 0),
          scale: fresh.querySelector(".face").getAnimations().some(a => a.effect.getKeyframes().some(k => k.transform && k.transform !== "none")) }); }));
    }));
    const tag = "OS " + os + " + setting " + setting + ": ";
    if (want === "reduced") ck(tag + "no slide, no scale: the move lands at once", w.moving === 0 && !w.scale && w.moved > 50, JSON.stringify(w));
    else ck(tag + "the slide plays (the in-app Full overrides the OS)", w.moving > 0 && w.scale, JSON.stringify(w));
    if (want === "reduced") {
      await set(p, FLUSH, { score: 0 });
      await p.keyboard.press("ArrowLeft"); await p.waitForTimeout(60);
      ck(tag + "the flush shows the still rainbow outline (colour, not motion)", await p.locator("#tiles .tile.run.still").count() === 3);
      await p.waitForTimeout(600);
      ck(tag + "then the run clears", await p.locator("#tiles .tile.run").count() === 0 && !(await st(p)).grid[8]);
    }
    ck(tag + "no page errors", e9.length === 0, e9.join("|"));
    await ctx.close();
  }

  // 10. trophies (REDESIGN.md 8.4): every Three trophy fires on a scripted line, with real booleans and numbers
  ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  p = await ctx.newPage(); const e10 = []; p.on("pageerror", e => e10.push(e.message));
  await p.goto(page); await p.waitForSelector("#sh-howto:not([hidden])"); await p.click("#howto-play");
  const has = (id) => p.evaluate((id) => NumbericsTrophies.has(id), id);
  const swipe = async (grid, extra, key) => { await set(p, grid, Object.assign({ moves: 5, power: { undo: 1, smash: 1, swap: 1, third: 1 } }, extra)); await p.keyboard.press(key || "ArrowLeft"); await p.evaluate(() => window.__three.settle()); };
  await p.evaluate(() => { const r = NumbericsTrophies.report; window.__rep = []; NumbericsTrophies.report = function (g, e, d) { window.__rep.push([g, e, JSON.parse(JSON.stringify(d))]); return r.apply(this, arguments); }; });
  ck("before play: no Three trophy", !(await has("thr_flush")) && !(await has("thr_96")));
  await swipe([0, 0, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  const rep = await p.evaluate(() => window.__rep.pop());
  ck("swipe event fields: flushes, top, grid, moves and run {used, flushes}", rep[0] === "three" && rep[1] === "swipe" && rep[2].flushes === 0 && typeof rep[2].top === "number" &&
    rep[2].grid.length === 16 && rep[2].moves === 6 && rep[2].run.used === 0 && typeof rep[2].run.flushes === "number", JSON.stringify(rep));
  ck("no trophy from a plain swipe", !(await has("thr_flush")));
  await swipe(FLUSH);
  ck("thr_flush: First flush", await has("thr_flush"));
  ck("thr_double: not from one flush", !(await has("thr_double")));
  await swipe([3, 0, 3, 0, 6, 0, 6, 0, 9, 0, 9, 0, 0, 0, 0, 0]);
  ck("thr_double: Double rainbow (two flushes from one swipe)", await has("thr_double"));
  await swipe([48, 48, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], { top: 0 });
  ck("thr_96: Ninety-six", await has("thr_96") && !(await has("thr_384")));
  await swipe([192, 192, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], { top: 0 });
  ck("thr_384: Big three", await has("thr_384"));
  await swipe(FLUSH, { flushes: 3 });
  ck("thr_five: not at four flushes in the run", !(await has("thr_five")));
  await swipe(FLUSH, { flushes: 4 });
  ck("thr_five: Rainbow run (five flushes in one game)", await has("thr_five"));
  await swipe([3, 0, 12, 24, 6, 12, 6, 12, 12, 6, 12, 6, 6, 12, 6, 12]);
  ck("thr_mono (secret): All grown up", await has("thr_mono"), JSON.stringify((await st(p)).grid));
  await swipe([0, 0, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], { moves: 298 });
  ck("thr_long (secret): not at 299 moves", !(await has("thr_long")));
  await swipe([0, 0, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], { moves: 299 });
  ck("thr_long (secret): Unhurried at 300 moves", await has("thr_long"));
  await p.evaluate(() => { window.__three.base = 1e9; });
  await swipe([0, 3, 12, 3, 12, 3, 12, 3, 3, 12, 3, 12, 12, 3, 12, 3], { next: 12, used: 2, flushes: 7, score: 500, power: { undo: 0, smash: 0, swap: 0, third: 0 } });
  const endRep = await p.evaluate(() => window.__rep.filter(r => r[1] === "end"));
  ck("end event once, with score, flushes and the run", endRep.length === 1 && endRep[0][2].score === 500 && endRep[0][2].flushes === 7 && endRep[0][2].run.used === 2, JSON.stringify(endRep));
  ck("the run's end earns Hello, numbers, shown as a pill on the end card", await p.isVisible("#over") && /Hello, numbers/.test(await p.textContent("#over-pills")));
  ck("progress summary: best, live and liveText on every persist", await p.evaluate(() => { const g = NumbericsProgress.get("three"); return g && /^Medium best /.test(g.best) && g.live === false && /^Score /.test(g.liveText); }));
  await p.click("#again");
  ck("New game: the progress shows no live run until the first move", await p.evaluate(() => NumbericsProgress.get("three").live === false));
  await p.keyboard.press("ArrowLeft"); await p.keyboard.press("ArrowUp");
  ck("after a move the run is live", await p.evaluate(() => NumbericsProgress.get("three").live === true && NumbericsProgress.get("three").liveText === "Score " + NumbericsKit.fmt(window.__three.state.score)));
  ck("no page errors in the trophy line", e10.length === 0, e10.join("|"));
  await ctx.close();

  // 10b. cold #12: until a first flush, the hint band says how to make one; after one, it never shows again
  ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  p = await ctx.newPage(); const e10b = []; p.on("pageerror", e => e10b.push(e.message));
  await p.goto(page); await p.waitForSelector("#sh-howto:not([hidden])"); await p.click("#howto-play");
  await set(p, [0, 0, 3, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], { moves: 0, flushes: 0 });
  await p.keyboard.press("ArrowLeft"); await p.evaluate(() => window.__three.settle());
  ck("before any flush, the hint band explains the rainbow flush", (await p.textContent("#hint")) === "Tip: line up 3, 6, 9 in a row or column for a rainbow flush.", await p.textContent("#hint"));
  ck("the tip fits the hint band (two lines at most) at 390", await p.evaluate(() => { const h = document.getElementById("hint"); return h.scrollHeight <= h.clientHeight + 1; }));
  await set(p, FLUSH, { moves: 5, score: 0 });
  await p.keyboard.press("ArrowLeft"); await p.evaluate(() => window.__three.settle());
  await p.keyboard.press("ArrowDown"); await p.evaluate(() => window.__three.settle());
  ck("after a flush the tip is gone", !/^Tip:/.test(await p.textContent("#hint")), await p.textContent("#hint"));
  await p.click("#new"); await p.click("#new").catch(() => {});
  await p.keyboard.press("ArrowLeft"); await p.keyboard.press("ArrowUp"); await p.evaluate(() => window.__three.settle());
  ck("and it stays gone in a new game (remembered)", !/^Tip:/.test(await p.textContent("#hint")), await p.textContent("#hint"));
  await p.evaluate(() => NumbericsKit.flush());
  await p.reload();
  ck("remembered across a reload", await p.evaluate(() => { try { return JSON.parse(localStorage.getItem("numberics_three_v1")).flushed === true; } catch (e) { return false; } }));
  ck("no page errors in the tip checks", e10b.length === 0, e10b.join("|"));
  await ctx.close();

  // 10c. B3 + Family: at 320 and 375 with Larger text, no sideways scroll and every label at least 12 px; Light theme shots
  for (const [W, H] of [[320, 568], [375, 667]]) {
    ctx = await browser.newContext({ viewport: { width: W, height: H } });
    p = await ctx.newPage(); const e10c = []; p.on("pageerror", e => e10c.push(e.message));
    await p.goto(page); await p.waitForSelector("#sh-howto:not([hidden])"); await p.click("#howto-play");
    await p.evaluate(() => NumbericsSettings.set({ text: "large" }));
    await p.evaluate(() => window.__demo()); await p.waitForTimeout(250);
    ck(W + "px Larger text: no sideways scroll", await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), await p.evaluate(() => document.documentElement.scrollWidth));
    const small = await p.evaluate(() => [...document.querySelectorAll("#app *")].filter(e => e.offsetParent && [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()) &&
      !e.closest("#games .pv, #tiles, .card .pv") && parseFloat(getComputedStyle(e).fontSize) < 12).map(e => (e.id || e.className || e.tagName) + ":" + getComputedStyle(e).fontSize));
    ck(W + "px Larger text: every label is at least 12 px", small.length === 0, JSON.stringify(small));
    if (W === 320) {
      await shot(p, "320-large");
      await set(p, [0, 3, 12, 3, 12, 3, 12, 3, 3, 12, 3, 12, 12, 3, 12, 3], { next: 12, used: 2, flushes: 7, score: 500, power: { undo: 0, smash: 0, swap: 0, third: 0 } });
      await p.keyboard.press("ArrowLeft"); await p.evaluate(() => window.__three.settle()); await p.waitForTimeout(300);
      ck("320px Larger text: the end card's buttons are on screen inside the board", await p.evaluate(() => { const b = document.getElementById("board").getBoundingClientRect();
        return ["again", "over-view"].every(id => { const r = document.getElementById(id).getBoundingClientRect(); return r.left >= b.left - 1 && r.right <= b.right + 1 && r.bottom <= b.bottom + 1; }); }));
      await shot(p, "320-large-over");
    }
    ck(W + "px: no page errors", e10c.length === 0, e10c.join("|"));
    await ctx.close();
  }
  ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: "light" });
  p = await ctx.newPage();
  await p.goto(page); await p.waitForSelector("#sh-howto:not([hidden])"); await p.click("#howto-play");
  await p.evaluate(() => window.__demo()); await p.waitForTimeout(250);
  await shot(p, "light");
  await ctx.close();

  // 11. budgets (REDESIGN.md 10): a scripted 60-move session, a move every 45 ms; frames and tile nodes
  ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  p = await ctx.newPage(); const e11 = []; p.on("pageerror", e => e11.push(e.message));
  await p.goto(page); await p.waitForSelector("#sh-howto:not([hidden])"); await p.click("#howto-play");
  await p.evaluate(() => NumbericsSettings.set({ motion: "full" }));
  // the same frame clock with no input first: on a machine busy with other work, the budget is judged against it
  const idle = await p.evaluate(() => new Promise(res => { const fr = []; let last = performance.now(); const t0 = last;
    (function f(t) { fr.push(t - last); last = t; if (t - t0 < 2700) requestAnimationFrame(f); else res(fr.slice(2)); })(performance.now()); }));
  const idleS = idle.slice().sort((a, b) => a - b), idleP95 = idleS[Math.floor(idleS.length * 0.95)], idleOver = idle.filter(x => x > 17.5).length / idle.length;
  const bud = await p.evaluate(() => new Promise(res => {
    const frames = [], nodes = [], keys = ["ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown"]; let last = performance.now(), n = 0, run = true, moves = 0;
    (function f(t) { frames.push(t - last); last = t; if (run) requestAnimationFrame(f); })(performance.now());
    const iv = setInterval(() => {
      const s = window.__three.state; if (s.over || !window.NumbericsThree.canMove(s)) { const g = window.NumbericsThree.newGame(n + 7); g.power = { undo: 9, smash: 9, swap: 9, third: 9 }; window.__three.state = g; }
      const m0 = window.__three.state.moves;
      window.dispatchEvent(new KeyboardEvent("keydown", { key: keys[n % 4] })); n++;
      if (window.__three.state.moves > m0) moves++;
      nodes.push([document.querySelectorAll("#tiles > .tile").length, window.__three.state.grid.filter(Boolean).length]);
      if (n >= 60) { clearInterval(iv); setTimeout(() => { run = false; window.__three.settle();
        res({ frames: frames.slice(2), nodes, moves, after: [document.querySelectorAll("#tiles > .tile").length, window.__three.state.grid.filter(Boolean).length] }); }, 700); }
    }, 45);
  }));
  const fr = bud.frames.slice().sort((a, b) => a - b), p95 = fr[Math.floor(fr.length * 0.95)], over = bud.frames.filter(x => x > 17.5).length / bud.frames.length;
  console.log("three budgets: moves " + bud.moves + ", frames " + fr.length + ", p95 " + p95.toFixed(1) + " ms, max " + fr[fr.length - 1].toFixed(1) + " ms, >17.5 ms " + (over * 100).toFixed(1) +
    "% (idle baseline: p95 " + idleP95.toFixed(1) + " ms, >17.5 ms " + (idleOver * 100).toFixed(1) + "%)");
  ck("60-move session: most inputs moved", bud.moves >= 40, bud.moves);
  // S6: fixed bars, not relative to the idle page (a busy machine must not raise the bar); needs a quiet machine. Four's
  // rule (TRIAGE5 S8): when the idle page itself misses frames (idle p95 over 18 ms, e.g. agents running in parallel) the
  // check says SKIP, never passes and never fails
  if (idleP95 <= 18) ck("frames (a quiet machine): p95 at most 20 ms and at most 10% of frames over 17.5 ms",
    p95 <= 20 && over <= 0.10, "p95 " + p95 + " over " + over + " idle " + idleP95 + "/" + idleOver);
  else console.log("  SKIP three: frames check needs a quiet machine (idle p95 " + idleP95.toFixed(2) + " ms > 18)");
  ck("tile nodes never exceed the board's tiles + 8", bud.nodes.every(([d, e]) => d <= e + 8), JSON.stringify(bud.nodes.filter(([d, e]) => d > e + 8)));
  ck("after the last move settles, one node per tile", bud.after[0] === bud.after[1], JSON.stringify(bud.after));
  ck("no page errors in the budget run", e11.length === 0, e11.join("|"));
  await ctx.close();

  // the tiers (O-13), O-14 at 375x812, as Two and Fibonacci (tests/emu/_tiers.cjs)
  const board3 = (a, b, tr) => async (p) => {
    await p.evaluate((x) => { const s = window.__three.state; if (x.tr === "hard") delete s.tier; else s.tier = x.tr;
      s.grid = new Array(16).fill(0); s.grid[0] = x.a; s.grid[1] = x.b; s.grid[15] = 36; s.top = 36; s.next = 1;
      s.power = { undo: 0, smash: 0, swap: 0, third: 0 }; s.prev = null; s.free = false; s.over = false; window.__three.state = s; }, { a, b, tr });
    await p.keyboard.press("ArrowLeft");
  };
  await require("./_tiers.cjs")({ browser, url, ck, shot }, {
    id: "three", api: "__three", key: "numberics_three_v1",
    rules: { medium: /or a join as big as your top tile \(18 up\)/, easy: /or a join half your top tile or more \(9 up\)/ },
    easy: (p, tr) => board3(9, 9, tr)(p), medium: (p, tr) => board3(18, 18, tr)(p),
    made: { easy: /^Made 18 \+1 (Undo|Smash|Swap|Third)$/, medium: /^Made 36 \+1 (Undo|Smash|Swap|Third)$/ },
    oldSave: { bestScore: 5000, bestUsed: 0, base: 5000, seen: true, flushed: true,
      state: { grid: [18, 18, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 36], next: 1, bag: [1, 2, 1, 2], score: 1200, top: 36, moves: 40,
        flushes: 2, best: 54, used: 0, seed: 99, over: false, free: false, power: { undo: 1, smash: 0, swap: 0, third: 0 }, prev: null } },
    oldSwipe: "ArrowLeft", oldBest: "5,000", pop: false
  });
};
