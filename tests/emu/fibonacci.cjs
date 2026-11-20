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
  ck("arming a power-up clears the toast so the hint is readable", await p.evaluate(() => !document.getElementById("toast").classList.contains("on")));
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

  // 4b. R9 keyboard targeting: a key arms with a cursor on the highest tile, arrows move it, Enter picks
  await p.evaluate(() => { const s = window.__fibonacci.state; s.grid = new Array(16).fill(0); s.grid[5] = 9; s.grid[6] = 3; s.grid[0] = 2; s.top = 9; s.over = false; s.power = { undo: 0, smash: 1, swap: 1, boost: 1 }; window.__fibonacci.state = s; });
  await p.locator("#board").focus();
  await p.keyboard.press("2");
  ck("key 2 arms Smash with the cursor on the highest tile", await p.evaluate(() => window.__fibonacci.cursor === 5 && window.__fibonacci.targeting.kbd));
  ck("the cursor is drawn above the tiles", await p.locator("#marks .mark.cur").count() === 1);
  ck("keyboard hint says how to pick, by tap or by keys (round 3, craft #13)", /^Tap a tile to smash, or arrows \+ Enter\. Esc cancels\.$/.test(await p.textContent("#hint")));
  ck("the keyboard hint fits on one line at 375px", await p.evaluate(() => { const e = document.getElementById("hint"); return e.offsetHeight < 2 * parseFloat(getComputedStyle(e).lineHeight); }));
  await shot(p, "kbd-target");
  await p.keyboard.press("ArrowRight");
  ck("arrows move the cursor, not the tiles", await p.evaluate(() => window.__fibonacci.cursor === 6 && window.__fibonacci.state.grid[5] === 9));
  await p.keyboard.press("Enter");
  ck("Enter smashes the cursor cell", await p.evaluate(() => window.__fibonacci.state.grid[6] === 0 && window.__fibonacci.state.power.smash === 0 && !window.__fibonacci.targeting));
  await p.keyboard.press("3"); await p.keyboard.press("Enter");
  ck("swap: the first pick is marked above its tile", await p.locator("#marks .mark.sel").count() === 1);
  await p.keyboard.press("ArrowUp"); await p.keyboard.press("ArrowLeft"); await p.keyboard.press("Enter");
  ck("swap by keyboard exchanges the two cells", await p.evaluate(() => window.__fibonacci.state.grid[0] === 9 && window.__fibonacci.state.grid[5] === 2));
  await p.keyboard.press("4"); await p.keyboard.press("Enter");
  ck("boost by keyboard steps the cursor tile up", await p.evaluate(() => window.__fibonacci.state.grid[0] === 10 && window.__fibonacci.state.power.boost === 0));
  ck("a boost to a new top tile says it earns nothing", /earn no reward/.test(await p.textContent("#toast")));
  // R9: Enter on a focused button is that button's, not a game action
  await p.evaluate(() => { const s = window.__fibonacci.state; s.power.smash = 1; window.__fibonacci.state = s; });
  await p.keyboard.press("2"); await p.locator("#new").focus(); await p.keyboard.press("Enter");
  ck("Enter on a focused button does not pick a target", await p.evaluate(() => window.__fibonacci.state.power.smash === 1));
  await p.keyboard.press("Escape"); await p.waitForTimeout(3100);
  // invalid target: the neutral toast, never the gold one (R7)
  await p.locator("#tray .pw").nth(1).click(); await at(15);
  ck("an empty-cell pick warns with the neutral toast", await p.evaluate(() => document.getElementById("toast").classList.contains("bad")) && /Pick a tile/.test(await p.textContent("#toast")));
  await p.keyboard.press("Escape");

  // 4c. R5: an unusable slot explains itself on tap; tooltips use one voice
  await p.evaluate(() => { const s = window.__fibonacci.state; s.power = { undo: 0, smash: 0, swap: 0, boost: 0 }; s.prev = null; window.__fibonacci.state = s; });
  ck("empty slots are aria-disabled, never disabled", await p.evaluate(() => [...document.querySelectorAll("#tray .pw")].every(b => !b.disabled && b.getAttribute("aria-disabled") === "true")));
  await p.locator("#tray .pw").nth(3).click({ force: true });
  ck("tapping an empty Boost explains it and how to earn it", /^Boost: Step a tile up one Fibonacci number \(1 becomes 2\)\. Earned by each new top tile from 55\.$/.test(await p.textContent("#hint")));
  ck("no targeting from an empty slot", await p.locator("#board.targeting").count() === 0);
  await p.keyboard.press("1");
  ck("key 1 on an empty Undo explains it too", /^Undo: Take back the last move\./.test(await p.textContent("#hint")));
  ck("tooltip voice is '1: Undo. Take back the last move.'", (await p.locator("#tray .pw").nth(0).getAttribute("title")) === "1: Undo. Take back the last move.");
  await shot(p, "info");

  // 4d. craft B2: neighbours in the sequence (the pairs that merge) get clearly different hues; no near repeat 2..610
  // round 3 (craft #2): 3 vs 13 and 34 vs 144 were 27 degrees apart; any 11 values in a row now differ (delta E >= 30, tested in Node)
  ck("merge neighbours differ by 40 degrees or more, and any 11 values in a row never share a hue", await p.evaluate(() => { const h = window.__fibonacci.hue, d = (a, b) => { const x = Math.abs(h(a) - h(b)) % 360; return Math.min(x, 360 - x); };
    for (let i = 2; i < 40; i++) if (d(i, i + 1) < 40) return false; for (let i = 2; i <= 30; i++) for (let j = i + 1; j <= i + 10; j++) if (d(i, j) < 15) return false; return true; }));
  ck("3 and 13, 34 and 144 now look clearly different", await p.evaluate(() => { const h = window.__fibonacci.hue, d = (a, b) => { const x = Math.abs(h(a) - h(b)) % 360; return Math.min(x, 360 - x); }; return d(3, 6) >= 40 && d(8, 11) >= 40; }));
  ck("1 and 2 look different (cream vs a hue)", await p.evaluate(() => { const s = window.__fibonacci.state; s.grid = new Array(16).fill(0); s.grid[0] = 1; s.grid[1] = 2; window.__fibonacci.state = s;
    const t = [...document.querySelectorAll(".tiles .tile")]; return getComputedStyle(t[0]).backgroundImage !== getComputedStyle(t[1]).backgroundImage && !t[1].classList.contains("lo2"); }));

  // 5. award toast on a new highest tile of 55 (round 2 floor); 34 no longer pays
  const sum = () => p.evaluate(() => Object.values(window.__fibonacci.state.power).reduce((a, b) => a + b, 0));
  const setup = (grid, top, power, free) => p.evaluate(([g, t, pw, f]) => { const s = window.__fibonacci.state; s.grid = g; s.top = t; s.power = pw; s.prev = null; s.over = false; s.free = !!f; s.marks = new Array(16).fill(0); window.__fibonacci.state = s; }, [grid, top, power, free]);
  const row = (a) => a.concat(new Array(16 - a.length).fill(0));
  const none = { undo: 0, smash: 0, swap: 0, boost: 0 };
  await p.evaluate(() => window.NumbericsKit.clearToast());
  await setup(row([6, 7]), 7, none);
  await p.keyboard.press("ArrowLeft"); await p.waitForTimeout(250);
  ck("a new 34 pays nothing since round 2", (await sum()) === 0);
  ck("a new 34 still toasts its tile", /^New tile 34$/.test(await p.textContent("#toast")));
  await setup(row([7, 8]), 8, none);
  await p.keyboard.press("ArrowLeft"); await p.waitForTimeout(250);
  ck("new 55 awards a power-up", (await sum()) === 1);
  ck("toast names the tile and the reward", /New tile 55 +\+/.test(await p.textContent("#toast")));
  // craft nit 2: small new tiles (2, 3, 5, 8) do not toast
  await p.evaluate(() => window.NumbericsKit.clearToast());
  await setup(row([3, 4]), 4, none);
  await p.keyboard.press("ArrowLeft"); await p.waitForTimeout(250);
  ck("a new top tile of 8 does not toast", await p.evaluate(() => window.__fibonacci.state.top === 5 && !document.getElementById("toast").classList.contains("on")));
  // R2 in the page: Boost 21 to 34 beside 55, swipe: 89 is made, nothing paid, and the toast says why
  await setup(row([9, 7]), 9, { undo: 0, smash: 0, swap: 0, boost: 1 });
  await p.keyboard.press("4"); await p.keyboard.press("ArrowRight"); await p.keyboard.press("Enter");
  ck("boost stepped 21 to 34", await p.evaluate(() => window.__fibonacci.state.grid[1] === 8));
  await p.reload(); // R2 survives a reload between the power-up and the swipe
  await p.keyboard.press("ArrowLeft"); await p.waitForTimeout(250);
  ck("R2: the boost-assisted 89 pays nothing, even across a reload", await p.evaluate(() => window.__fibonacci.state.grid[0] === 10) && (await sum()) === 0);
  ck("R2: the toast says no reward right after a power-up", /^New tile 89\. No reward right after a power-up\.$/.test(await p.textContent("#toast")));
  // R15: a full stock says so instead of paying silently nothing
  await setup(row([10, 11]), 11, { undo: 9, smash: 9, swap: 9, boost: 9 });
  await p.keyboard.press("ArrowLeft"); await p.waitForTimeout(250);
  ck("R15: a full stock toasts 'Power-ups full'", /^New tile 233\. Power-ups full\.$/.test(await p.textContent("#toast")) && (await sum()) === 36);
  // cold #2: a tray tap that lands while the slide animates is never lost
  await setup(row([1, 0, 0, 0, 2]), 2, { undo: 0, smash: 1, swap: 0, boost: 0 });
  await p.waitForTimeout(50);
  const smashBox = await p.locator("#tray .pw").nth(1).boundingBox();
  await p.keyboard.press("ArrowRight");
  await p.mouse.move(smashBox.x + smashBox.width / 2, smashBox.y + smashBox.height / 2);
  await p.mouse.down(); await p.waitForTimeout(160); await p.mouse.up(); // spans the 110 ms redraw
  ck("a tray tap during the slide animation still arms the power-up", await p.evaluate(() => window.__fibonacci.targeting && window.__fibonacci.targeting.name === "smash"));
  await p.keyboard.press("Escape");

  // 6. stuck while holding a power-up, then the end overlay
  await p.evaluate(() => { const s = window.__fibonacci.state; s.grid = [1,3,1,3,3,1,3,1,1,3,1,3,3,1,3,1]; s.power = { undo: 0, smash: 1, swap: 0, boost: 0 }; s.prev = null; s.over = false; window.__fibonacci.state = s; });
  ck("stuck with a power-up says so, no overlay", /Stuck/.test(await p.textContent("#hint")) && !(await p.isVisible("#over")));
  await p.evaluate(() => { window.__fibonacci.runBest = 1e9; const s = window.__fibonacci.state; s.power = { undo: 0, smash: 0, swap: 0, boost: 0 }; s.over = true; window.__fibonacci.state = s; });
  const tOver = Date.now();
  ck("the locked board shows first, card hidden (round 3)", await p.evaluate(() => document.getElementById("over").hidden && window.__fibonacci.holding));
  ck("overlay shows when locked, about 1.5 s later", await p.waitForSelector("#over", { state: "visible", timeout: 3000 }).then(() => true, () => false) && Date.now() - tOver >= 1300, Date.now() - tOver);
  ck("focus moves to the card's New game (craft #8)", await p.evaluate(() => document.activeElement && document.activeElement.id === "again"));
  ck("one New game on screen: the page button hides and keeps its space (craft #7)", await p.evaluate(() => getComputedStyle(document.getElementById("new")).visibility === "hidden"));
  ck("no toast sits on the end card", await p.evaluate(() => !document.getElementById("toast").classList.contains("on")));
  ck("overlay summary is '<Result> · <score>'", /^Top tile \d[\d,]* · Score [\d,]+$/.test(await p.textContent("#over-text")));
  ck("no new best when the score did not beat it", !(await p.isVisible("#over-best")));
  await p.evaluate(() => { window.__fibonacci.runBest = 10; const s = window.__fibonacci.state; s.score = 5500; s.top = 13; window.__fibonacci.state = s; });
  ck("a new best says so (R8)", await p.isVisible("#over-best") && (await p.textContent("#over-best")) === "New best.");
  ck("end headline fits on one line at 375px", await p.evaluate(() => { const h = document.querySelector("#over h2"); return h.getClientRects().length && h.offsetHeight < 1.6 * parseFloat(getComputedStyle(h).lineHeight || 40) && h.scrollWidth <= h.clientWidth; }));
  ck("tray says why nothing works when over", await (async () => { await p.locator("#tray .pw").nth(1).click({ force: true }); return /The game is over/.test(await p.textContent("#hint")); })());
  await shot(p, "over");
  await p.click("#over-view");
  ck("See the board hides the card and says how to come back", await p.evaluate(() => document.getElementById("over").hidden && window.__fibonacci.viewing) && (await p.textContent("#hint")) === "Tap the board for the summary.");
  await p.locator("#board").click({ position: { x: 20, y: 20 } });
  ck("a tap on the board brings the card back", await p.isVisible("#over"));
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

  // 7b. a save with a malformed Undo snapshot keeps the run and Undo fails quietly (critic nit 2)
  ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
  p = await ctx.newPage(); const e4 = []; p.on("pageerror", e => e4.push(e.message));
  await p.addInitScript(() => { try { if (!sessionStorage.getItem("seeded")) { sessionStorage.setItem("seeded", "1"); localStorage.setItem("numberics_fibonacci_v1", JSON.stringify({ bestScore: 7, bestTop: 3,
    state: { size: 4, grid: [1,2,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,3], score: 7, top: 3, moves: 4, seed: 9, over: false, power: { undo: 2, smash: 0, swap: 0, boost: 0 }, prev: { grid: "broken" } } })); } } catch (e) {} });
  await p.goto(page);
  ck("the run survives a broken snapshot", await p.evaluate(() => window.__fibonacci.state.moves === 4 && window.__fibonacci.state.prev === null));
  await p.keyboard.press("1");
  ck("Undo with no snapshot explains instead of throwing", e4.length === 0 && /Nothing to take back yet/.test(await p.textContent("#hint")), e4.join("|"));
  await ctx.close();

  // 7d. phone: targeting hints never mention Esc (cold #5) and stay on one line, so the board does not jump
  ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  p = await ctx.newPage(); await p.goto(page);
  for (const [i, n] of [[1, "smash"], [2, "swap"], [3, "boost"]]) {
    await p.evaluate(() => { const s = window.__fibonacci.state; s.power = { undo: 0, smash: 1, swap: 1, boost: 1 }; window.__fibonacci.state = s; });
    await p.locator("#tray .pw").nth(i).tap();
    const hint = await p.textContent("#hint");
    ck("phone " + n + " hint: no Esc, says how to cancel, one line", !/Esc/.test(hint) && /to cancel\.$/.test(hint) &&
      await p.evaluate(() => { const e = document.getElementById("hint"); return e.offsetHeight < 2 * parseFloat(getComputedStyle(e).lineHeight); }), hint);
    await p.locator("#tray .pw").nth(i).tap();
    ck("phone: tapping " + n + " again cancels", await p.locator("#board.targeting").count() === 0);
  }
  // round 3 (cold #5): a tap on a power-up within 50 ms of the swipe that earned it arms it on the first tap
  await p.evaluate(() => { const s = window.__fibonacci.state; s.grid = new Array(16).fill(0); s.grid[8] = 8; s.grid[9] = 7; s.grid[15] = 1; s.top = 8;
    s.power = { undo: 9, smash: 9, swap: 0, boost: 9 }; s.prev = null; s.free = false; s.over = false; s.marks = new Array(16).fill(0); window.__fibonacci.state = s; });
  const cdp = await ctx.newCDPSession(p);
  const fb = await p.locator("#board").boundingBox(), sw = await p.locator("#tray .pw").nth(2).boundingBox(), fy = fb.y + fb.height * 0.6;
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: fb.x + fb.width * 0.8, y: fy }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: fb.x + fb.width * 0.2, y: fy }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  const t0 = Date.now();
  await p.touchscreen.tap(sw.x + sw.width / 2, sw.y + sw.height / 2);
  const ms = Date.now() - t0;
  ck("cold #5: the swipe earned Swap", await p.evaluate(() => window.__fibonacci.state.power.swap === 1 && window.__fibonacci.state.grid[8] === 9));
  ck("cold #5: the first tap on Swap, " + ms + " ms after the swipe, arms it", ms <= 50 && await p.evaluate(() => !!window.__fibonacci.targeting && window.__fibonacci.targeting.name === "swap"), ms);
  await ctx.close();

  // 7c. R6 header at desktop: H1 is the game, subtitle links home, pills sit right of the title (board not pushed down)
  ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  p = await ctx.newPage(); await p.goto(page);
  ck("H1 is Fibonacci", (await p.textContent("h1")) === "Fibonacci");
  ck("subtitle starts with a Numberics link home", await p.evaluate(() => { const a = document.querySelector(".sub a"); return a && a.textContent === "Numberics" && a.getAttribute("href") === "../" && document.querySelector(".sub").firstElementChild === a; }));
  ck("subtitle tagline is one sentence with a full stop", /^Numberics · [A-Z0-9][^.]*\.$/.test((await p.textContent(".sub")).trim()));
  // craft #6: the pills sit under the title, where Endless's are
  const pills = (q) => q.evaluate(() => { const b = document.querySelector(".brand").getBoundingClientRect(), s = document.querySelector(".stats").getBoundingClientRect(), t = document.getElementById("tray").getBoundingClientRect();
    return { under: s.top >= b.bottom, left: Math.round(s.left - b.left), top: Math.round(s.top), tray: Math.round(t.top) }; });
  const fp = await pills(p), ep2 = await ctx.newPage(); await ep2.goto(url); const ep = await pills(ep2); await ep2.close();
  ck("pills sit under the title at 1280, as in Endless", fp.under && ep.under && fp.left === ep.left && Math.abs(fp.top - ep.top) <= 2 && Math.abs(fp.tray - ep.tray) <= 2, JSON.stringify([fp, ep]));
  // R17: Enter on a focused games-row link navigates and is never a game move
  const m0 = await p.evaluate(() => window.__fibonacci.state.moves);
  const link = p.locator("#games a[href]").first(), href = await link.getAttribute("href");
  await link.focus();
  await Promise.all([p.waitForURL(u => !/\/fibonacci\/$/.test(u.toString()), { timeout: 3000 }).catch(() => {}), p.keyboard.press("Enter")]);
  ck("R17: Enter on a focused games-row link navigates", !/\/fibonacci\/$/.test(p.url()), p.url() + " " + href + " moves " + m0);
  await p.goto(page);
  ck("empty top tile reads 'none', never '-'", await p.evaluate(() => { const s = window.__fibonacci.state; s.top = 0; window.__fibonacci.state = s; return document.getElementById("top").textContent === "none"; }));
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
