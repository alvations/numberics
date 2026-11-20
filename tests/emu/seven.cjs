/* SPDX-License-Identifier: Apache-2.0 | Copyright 2026 alvations (Melon Lab)
 * Browser checks for Seven. Run: NODE_PATH=$(npm root -g) node tests/emu/run.cjs seven */
"use strict";
const playFit = require("./_fit.cjs");
module.exports = async function ({ browser, url, ck, shot }) {
  const page = url + "seven/";
  const W = 7, at = (r, c) => r * W + c;
  // rows top to bottom: '.' empty, 1-7, 'e' egg
  const grid = (rows) => { while (rows.length < 7) rows.unshift("......."); return rows.join("").split("").map(ch => ch === "." ? 0 : ch === "e" ? 8 : +ch); };
  const setup = (p, rows, extra) => p.evaluate(([g, x]) => { const s = window.__seven.state; s.grid = g; s.left = 99; s.over = false; s.overflow = null; Object.assign(s, x); window.__seven.state = s; }, [grid(rows), extra || {}]);
  const st = (p) => p.evaluate(() => window.__seven.state);
  const idle = (p) => p.waitForFunction(() => !window.__seven.busy, null, { timeout: 5000 });

  // 1. loads, keyboard drop, animated trace, persists
  let ctx = await browser.newContext({ viewport: { width: 375, height: 800 }, deviceScaleFactor: 1 });
  let p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto(page);
  ck("49 well cells", await p.locator(".cells div").count() === 49);
  ck("header: game name, Numberics link, tagline with a full stop (R6)", (await p.textContent("h1")) === "Seven" && /^Numberics · .+\.$/.test((await p.textContent(".sub")).trim()) && await p.locator(".sub a").count() === 1);
  ck("level is in the hint line", /^Level 1 · /.test(await p.textContent("#hint")));
  ck("discs drawn", await p.locator(".disc:not(.ghost)").count() > 0);
  ck("next disc preview", await p.locator("#next .mini").count() === 1);
  ck("a fresh Best reads none in the shared empty style (R11, craft #5)", (await p.textContent("#best")) === "none" && await p.locator("#best.none").count() === 1);
  // the preview in the aimed column is a dashed outline, never a filled disc (cold #14)
  ck("the preview disc is an outline, not a disc", await p.evaluate(() => { const g = document.querySelector(".disc.ghost"); if (!g) return false; const cs = getComputedStyle(g);
    return cs.backgroundColor === "rgba(0, 0, 0, 0)" && cs.backgroundImage === "none" && cs.borderTopStyle === "dashed"; }));
  ck("no horizontal scroll at 375px", await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await setup(p, ["e......"], { next: 5 });
  await p.focus("#board");
  await p.keyboard.press("ArrowRight"); await p.keyboard.press("ArrowRight");
  ck("cursor moves with arrows", await p.evaluate(() => window.__seven.cursor) === 5);
  await p.keyboard.press("Enter"); await idle(p);
  let s = await st(p);
  ck("Enter drops into the cursor column", s.grid[at(6, 5)] === 5 && s.drops >= 1);
  // a new disc appears in its own cell: the appear scale never shifts it toward the top left (craft nit 5)
  await setup(p, ["e......"], { next: 5 });
  ck("a new disc is centred on its column while it appears", await p.evaluate(() => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    const d = document.querySelector(".disc.new"), s = window.__seven.state; if (!d) return false;
    const cell = document.querySelectorAll(".cells div")[s.grid.findIndex((v, i) => v === 5 && i >= 42 && i % 7 === 5)];
    const a = d.getBoundingClientRect(), b = cell.getBoundingClientRect();
    return Math.abs((a.left + a.right) / 2 - (b.left + b.right) / 2) < 2 && Math.abs((a.top + a.bottom) / 2 - (b.top + b.bottom) / 2) < 2;
  }));
  await idle(p);
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
  ck("Lucky Seven toast", /Lucky Seven/.test(await p.textContent("#toast")) && await p.locator("#toast.bad").count() === 0);
  ck("BEST never trails SCORE mid-animation", await p.evaluate(() => +document.getElementById("best").textContent.replace(/,/g, "") >= +document.getElementById("score").textContent.replace(/,/g, "")));
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
  // R9: Smash aimed from the keyboard, with a visible aim ring
  await setup(p, ["4......", "3......", "e......"], { next: 6, held: 0, power: { undo: 1, smash: 1, hold: 2, crack: 0 } });
  await p.focus("#board");
  for (let k = 0; k < 6; k++) await p.keyboard.press("ArrowLeft");
  await p.keyboard.press("2");
  ck("Smash aims at the top disc of the cursor column", await p.evaluate(() => window.__seven.aim) === at(4, 0) && await p.locator(".disc.aim").count() === 1);
  await p.keyboard.press("ArrowDown"); await p.keyboard.press("ArrowDown");
  ck("arrows move the aim, not drop", await p.evaluate(() => window.__seven.aim) === at(6, 0) && (await st(p)).power.smash === 1);
  await p.keyboard.press("Enter"); await idle(p); s = await st(p);
  ck("Enter smashes the aimed disc", s.power.smash === 0 && s.grid[at(6, 0)] === 3 && s.grid[at(5, 0)] === 4);
  await p.keyboard.press("3"); s = await st(p);
  ck("Hold keeps the next disc", s.held === 6 && s.power.hold === 1);
  ck("held disc sits before the label, apart from the count badge", await p.locator("#tray .pw").nth(2).evaluate(b => b.firstChild.classList.contains("mini")));
  ck("held disc shown on the Hold button", (await p.locator("#tray .pw").nth(2).locator(".mini").count()) === 1);
  await setup(p, ["e3....e", "eee...e"], { power: { undo: 1, smash: 0, hold: 0, crack: 1 } });
  await p.keyboard.press("4"); s = await st(p); await shot(p, "crack-target");
  ck("Crack first marks the eggs it would crack, spending nothing (cold #16)", s.power.crack === 1 && s.grid[at(5, 0)] === 8 && await p.locator(".disc.aim").count() === 2 && (await p.textContent("#hint")) === "Tap the well, or Enter. Esc cancels.");
  await p.keyboard.press("Escape");
  ck("targeting hint fits one line at 375px", await p.evaluate(() => document.getElementById("hint").getBoundingClientRect().height < 24));
  ck("Esc cancels Crack", (await st(p)).power.crack === 1 && await p.locator(".disc.aim").count() === 0);
  await p.keyboard.press("4"); await p.keyboard.press("Enter"); await idle(p); s = await st(p);
  ck("Crack cracks eggs touching a disc", s.power.crack === 0 && s.grid[at(5, 0)] === 9 && s.grid[at(6, 1)] === 9 && s.grid[at(6, 6)] === 8);
  // R5: a power-up that cannot act explains itself on tap and on its key
  await setup(p, ["e......"], { prev: null, power: { undo: 1, smash: 0, hold: 0, crack: 0 } });
  ck("unusable tray buttons are aria-disabled, never disabled", await p.locator("#tray .pw[aria-disabled=true]").count() === 4 && await p.locator("#tray .pw:disabled").count() === 0);
  await p.locator("#tray .pw").nth(1).click({ force: true });
  ck("tapping an empty power-up explains it", /^Smash: Remove one disc\. Earn one with/.test(await p.textContent("#hint")));
  await p.keyboard.press("1");
  ck("its key explains why it cannot act", /^Undo: Take back the last drop\. Nothing to take back yet\./.test(await p.textContent("#hint")));
  ck("tray tooltip voice", await p.locator("#tray .pw").nth(0).getAttribute("title") === "1: Undo. Take back the last drop.");
  // R7: a full column is a neutral warning, not the gold reward toast
  await setup(p, ["e......", "e......", "e......", "e......", "e......", "e......", "e......"], { next: 3 });
  await p.mouse.click(box.x + box.width * (0.5 / 7), box.y + box.height * 0.3);
  ck("full column uses the neutral toast", /column is full/.test(await p.textContent("#toast")) && await p.locator("#toast.bad").count() === 1);
  // the idle hint labels the gold dots (craft V1)
  await setup(p, ["e......"], { left: 7 });
  ck("hint says how many drops until the eggs rise", (await p.textContent("#hint")) === "Level 1 · 7 drops until the eggs rise.");
  // near-full warning (cold #9): one disc from the top, then at the top with a Smash nudge; each fits one line
  await setup(p, ["e......", "e......", "e......", "e......", "e......", "e......"], { left: 7, power: { undo: 1, smash: 0, hold: 0, crack: 0 }, prev: null });
  ck("warns a column is one disc from the top", (await p.textContent("#hint")) === "Column 1 is one disc from the top.", await p.textContent("#hint"));
  await setup(p, ["..5....", "..e....", "..e....", "..e....", "..e....", "..e....", "..e...."], { left: 7, power: { undo: 1, smash: 1, hold: 0, crack: 0 } });
  ck("at the top with a Smash in stock: nudges Smash", (await p.textContent("#hint")) === "Column 3 is at the top: Smash before the eggs rise.", await p.textContent("#hint"));
  ck("the warning fits one line at 375px", await p.evaluate(() => document.getElementById("hint").getBoundingClientRect().height < 24));
  // R2: the drop after a power-up scores but pays nothing, and says so in the neutral toast
  await setup(p, ["e......", "e......", "777777."], { next: 7, free: true, power: { undo: 1, smash: 0, hold: 0, crack: 0 } });
  await p.mouse.click(box.x + box.width * (6.5 / 7), box.y + box.height * 0.3);
  ck("R2: the drop after a power-up says it pays no reward", /Lucky Seven!.*No reward after a power-up\./.test(await p.textContent("#toast")) && await p.locator("#toast.info").count() === 1, await p.textContent("#toast"));
  await idle(p); s = await st(p);
  ck("R2: nothing earned, Lucky still counted", s.luckies === 1 && s.power.smash + s.power.hold + s.power.crack === 0 && s.power.undo === 1 && !s.free);
  // R15: every slot full: the toast says so
  await setup(p, ["e......", "e......", "777777."], { next: 7, free: false, power: { undo: 9, smash: 9, hold: 9, crack: 9 } });
  await p.mouse.click(box.x + box.width * (6.5 / 7), box.y + box.height * 0.3);
  ck("R15: a reward at the cap says Power-ups full", /Power-ups full\./.test(await p.textContent("#toast")), await p.textContent("#toast"));
  await idle(p);
  // R2 in the client: Smash then drop
  await setup(p, ["e......", "e......", "777777.", "......3"], { next: 7, free: false, power: { undo: 1, smash: 1, hold: 0, crack: 0 } });
  await p.keyboard.press("2"); await p.mouse.click(box.x + box.width * (6.5 / 7), box.y + box.height * (6.5 / 7)); await idle(p);
  ck("Smash marks the next drop as unpaid", (await st(p)).free === true && (await st(p)).power.smash === 0);

  // 4a. stuck is not over while Undo is in stock (TRIAGE3): the overflow card offers Undo the last drop or End the run
  const brinkRows = ["5......", "e......", "e......", "e......", "e......", "e......", "e......"];
  await setup(p, brinkRows, { left: 1, next: 4, score: 100, prev: null, power: { undo: 1, smash: 1, hold: 0, crack: 0 } });
  let pre = await st(p);
  await p.mouse.click(box.x + box.width * (3.5 / 7), box.y + box.height * 0.3); await idle(p);
  s = await st(p);
  ck("brink: an overflow with Undo in stock is not over", !s.over && Array.isArray(s.overflow) && s.overflow[0] === 0);
  ck("brink: the overflow is held in view first (R13)", !(await p.isVisible("#over")) && /^Overflowed: /.test(await p.textContent("#hint")), await p.textContent("#hint"));
  ck("brink: the hold hint fits one line at 375px", await p.evaluate(() => document.getElementById("hint").getBoundingClientRect().height < 24));
  await p.waitForSelector("#over", { state: "visible", timeout: 2500 });
  ck("brink card: title and the two choices", (await p.textContent("#over-title")) === "The well overflowed" &&
    (await p.textContent("#over-text")) === "Undo the last drop to keep going, or end the run." &&
    await p.isVisible("#over-undo") && await p.isVisible("#over-end") && !(await p.isVisible("#again")) && !(await p.isVisible("#over-view")) && !(await p.isVisible("#over-best")));
  ck("brink card: focus is on its primary button (Undo)", await p.evaluate(() => document.activeElement && document.activeElement.id === "over-undo"));
  ck("brink card: the page's New game is hidden with its space kept", await p.evaluate(() => { const b = document.getElementById("new"); return getComputedStyle(b).visibility === "hidden" && b.getBoundingClientRect().height > 20; }));
  ck("brink: the discs that would go are ringed", await p.locator(".disc.out").count() === 1);
  await shot(p, "brink");
  ck("brink: Smash cannot act, a drop does nothing", await (async () => { await p.keyboard.press("2"); const x = await st(p); return x.power.smash === 1 && !(await p.evaluate(() => window.__seven.targeting)) && /Undo the last drop, or end the run/.test(await p.textContent("#hint")); })());
  await p.keyboard.press("Enter"); // focus is on the Undo button: Enter is that button's own action (R17)
  s = await st(p);
  ck("brink: Undo the last drop takes it back and play goes on", !s.over && !s.overflow && s.power.undo === 0 && JSON.stringify(s.grid) === JSON.stringify(pre.grid) && !(await p.isVisible("#over")));
  ck("brink: after Undo the page's New game is back", await p.evaluate(() => getComputedStyle(document.getElementById("new")).visibility === "visible"));
  // the same overflow again, now ended by the player
  await setup(p, brinkRows, { left: 1, next: 4, score: 9000, used: 2, prev: null, power: { undo: 1, smash: 0, hold: 0, crack: 0 } });
  await p.mouse.click(box.x + box.width * (3.5 / 7), box.y + box.height * 0.3); await idle(p);
  await p.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.5); // a tap skips the hold
  ck("brink: a tap during the hold shows the card at once", await p.isVisible("#over-end"));
  await p.click("#over-end");
  s = await st(p);
  ck("End the run: over, no brink, R1 card", s.over && !s.overflow && await p.isVisible("#again") && await p.isVisible("#over-view") && !(await p.isVisible("#over-undo")));
  ck("End the run: focus moves to New game", await p.evaluate(() => document.activeElement && document.activeElement.id === "again"));
  ck("End the run: the summary and a new best", (await p.textContent("#over-text")) === "Level 1 · 2 power-ups · score 9,000" && await p.isVisible("#over-best"), await p.textContent("#over-text"));
  ck("End the run: Undo is refused now (R1)", await (async () => { await p.keyboard.press("1"); const x = await st(p); return x.over && x.power.undo === 1; })());

  // 4. rising row and the end screen with no Undo in stock: the run ends (R1), an honest final board (cold #10), a new best (R8)
  await setup(p, ["5......", "e......", "e......", "e......", "e......", "e......", "e......"], { left: 1, next: 4, score: 9000, used: 2, power: { undo: 0, smash: 0, hold: 0, crack: 0 } });
  ck("near-full warning names the column at the top and nudges Smash or a power-up (cold #9)",
    /^Column 1 is at the top: (a power-up may help|the next rise ends the run)\.$/.test(await p.textContent("#hint")), await p.textContent("#hint"));
  const before = (await st(p)).grid;
  await p.mouse.click(box.x + box.width * (3.5 / 7), box.y + box.height * 0.3); await idle(p);
  s = await st(p);
  // R13: the final well stays in view, undimmed, before the end card
  ck("R13: right after the end the card is held back and the board is undimmed", s.over && !(await p.isVisible("#over")) && await p.evaluate(() => window.__seven.revealing) && /Overflowed/.test(await p.textContent("#hint")));
  await shot(p, "over-reveal");
  await p.waitForTimeout(800);
  ck("R13: still in view after 0.8 s", !(await p.isVisible("#over")));
  ck("R13: the hold hint fits one line at 375px", await p.evaluate(() => document.getElementById("hint").getBoundingClientRect().height < 24));
  await p.waitForSelector("#over", { state: "visible", timeout: 2000 });
  ck("overflow ends the run", s.over && await p.isVisible("#over"));
  ck("the end screen offers no Undo (R1)", await p.locator("#over button:visible").count() === 2 && !(await p.locator("#over-undo").isVisible()) && !(await p.locator("#over-text").textContent()).includes("Undo"));
  ck("the end card focuses New game, and the page's New game is hidden with its space kept", await p.evaluate(() => document.activeElement.id === "again" && getComputedStyle(document.getElementById("new")).visibility === "hidden"));
  ck("Undo key after the end does nothing but explain", await (async () => { await p.keyboard.press("1"); const x = await st(p); return x.over && x.power.undo === 0 && /run is over/.test(await p.textContent("#hint")); })());
  ck("summary is one line: detail, then score (one card pattern)", (await p.textContent("#over-text")) === "Level 1 · 2 power-ups · score 9,000", await p.textContent("#over-text"));
  ck("a new best says so", await p.isVisible("#over-best") && (await p.textContent("#over-best")) === "New best.");
  ck("final well is the well the player saw (no shift up)", s.grid.every((v, i) => i === at(6, 3) ? v === 4 : v === before[i]));
  ck("the pushed-out disc is ringed", await p.locator(".disc.out").count() === 1);
  await shot(p, "over");
  await p.click("#over-view");
  await shot(p, "over-well");
  ck("See the well hides the summary and explains the loss", !(await p.isVisible("#over")) && /Ringed discs were pushed out/.test(await p.textContent("#hint")));
  await p.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.5);
  ck("tapping the well brings the summary back", await p.isVisible("#over") && (await st(p)).over);
  // headline and summary each fit on one line at 375px
  await setup(p, ["5......"], { over: true, out: [0], score: 123456, level: 12, used: 3 });
  ck("end text fits on one line at 375px", await p.evaluate(() => ["over-title", "over-text"].every(id => { const e = document.getElementById(id); const r = document.createRange(); r.selectNodeContents(e); return r.getClientRects().length === 1; })));
  await setup(p, ["5......"], { over: true, out: [0], score: 0 });
  ck("no new best for a run below the best", !(await p.isVisible("#over-best")));
  // R13: a tap during the hold shows the card at once
  await setup(p, ["5......", "e......", "e......", "e......", "e......", "e......", "e......"], { left: 1, next: 4, power: { undo: 0, smash: 0, hold: 0, crack: 0 } });
  await p.mouse.click(box.x + box.width * (3.5 / 7), box.y + box.height * 0.3); await idle(p);
  ck("R13: held, then a tap brings the card", !(await p.isVisible("#over")) && await (async () => { await p.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.5); return p.isVisible("#over"); })());
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
  // R17: Enter on a focused games-row link navigates and drops nothing
  const d17 = (await st(p)).drops;
  await p.focus("#games a[href]");
  const href = await p.evaluate(() => document.activeElement.href);
  await Promise.all([p.waitForURL(href, { timeout: 5000 }).catch(() => {}), p.keyboard.press("Enter")]);
  ck("R17: Enter on a games-row link navigates", p.url() === href, p.url());
  await p.goto(page);
  ck("R17: and no disc was dropped", (await st(p)).drops === d17);
  await ctx.close();
  // phones: no keyboard is likely, so the targeting hint says how to cancel by tap, never Esc (critic nit 4)
  ctx = await browser.newContext({ viewport: { width: 375, height: 800 }, hasTouch: true, isMobile: true });
  p = await ctx.newPage(); await p.goto(page);
  await setup(p, ["e3....e", "eee...e"], { power: { undo: 1, smash: 1, hold: 0, crack: 1 } });
  await p.locator("#tray .pw").nth(1).tap();
  ck("phone: Smash hint has no Esc", (await p.textContent("#hint")) === "Tap a disc to smash it. Tap Smash to cancel.", await p.textContent("#hint"));
  await shot(p, "smash-target-phone");
  await p.locator("#tray .pw").nth(1).tap();
  ck("phone: tapping Smash again cancels", !(await p.evaluate(() => window.__seven.targeting)));
  await p.locator("#tray .pw").nth(3).tap();
  ck("phone: Crack hint has no Esc", (await p.textContent("#hint")) === "Tap the well to crack. Tap Crack to cancel.");
  ck("phone: hints fit one line", await p.evaluate(() => document.getElementById("hint").getBoundingClientRect().height < 24));
  ck("the Next pill names an egg", await p.evaluate(() => { const s = window.__seven.state; s.next = 8; window.__seven.state = s; return document.querySelector("#next .mini").textContent === "egg"; }));
  await ctx.close();
  // page height: the main phone size does not scroll (craft F15)
  ctx = await browser.newContext({ viewport: { width: 390, height: 844 } }); p = await ctx.newPage(); await p.goto(page);
  ck("the game fits 390x844 without scrolling (top bar to the New game row)", (await p.evaluate(playFit)).fits, JSON.stringify(await p.evaluate(playFit)));
  // a saved run with a broken field is not loaded (critic #4)
  await p.evaluate(() => { const s = JSON.parse(JSON.stringify(window.__seven.state)); delete s.left; localStorage.setItem("numberics_seven_v1", JSON.stringify({ mode: "classic", runs: { classic: s }, best: {}, day: 0 })); });
  await p.reload();
  ck("a save missing left is replaced by a fresh run", Number.isInteger((await st(p)).left) && (await st(p)).drops === 0);
  // the Daily best is per day (critic #2)
  await p.evaluate(() => localStorage.setItem("numberics_seven_v1", JSON.stringify({ mode: "daily", runs: {}, best: { classic: 50, blitz: 0, daily: 999 }, day: 1 })));
  await p.reload();
  ck("yesterday's Daily best does not carry over", (await p.textContent("#best")) === "none" && (await st(p)).mode === "daily");
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
