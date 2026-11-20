/* SPDX-License-Identifier: Apache-2.0 | Copyright 2026 alvations (Melon Lab)
 * Browser checks for Fifteen. Run: NODE_PATH=$(npm root -g) node tests/emu/run.cjs fifteen */
"use strict";
module.exports = async function ({ browser, url, ck, shot }) {
  const page = url + "fifteen/";
  const B = (mine, theirs) => { const o = new Array(9).fill(0); mine.forEach(n => o[n - 1] = 1); theirs.forEach(n => o[n - 1] = 2); return o; };
  const forge = (p, patch) => p.evaluate((patch) => {
    const F = window.NumbericsFifteen, s = F.newMatch(11, patch.diff || "medium");
    Object.assign(s, patch); window.__fifteen.state = s;
  }, patch);
  const S = (p) => p.evaluate(() => window.__fifteen.state);
  const tile = (p, n) => p.locator('.ft[data-n="' + n + '"]');

  // 1. loads, plays a real turn by click and by keyboard, the computer replies
  let ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2 });
  let p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto(page);
  ck("nine tiles", await p.locator(".ft").count() === 9);
  ck("difficulty row under the header", await p.locator("#diff button").count() === 3);
  ck("tray has four power-ups", await p.locator("#tray .pw").count() === 4);
  ck("no horizontal scroll at 375px", await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await forge(p, { diff: "easy" });
  await tile(p, 5).click();
  ck("click claims 5 for you", (await S(p)).owner[4] === 1);
  ck("tile shows it is yours", await tile(p, 5).evaluate(e => e.classList.contains("mine")));
  await p.waitForFunction(() => window.__fifteen.state.turn === 1, null, { timeout: 3000 });
  ck("the computer replied", (await S(p)).owner.filter(o => o === 2).length === 1);
  // keyboard: focus the board, arrows move, Enter claims a free number
  const free = (await S(p)).owner.map((o, i) => o ? 0 : i + 1).filter(Boolean)[0];
  await p.evaluate((n) => document.querySelector('.ft[data-n="' + n + '"]').focus(), free);
  await p.keyboard.press("ArrowRight"); await p.keyboard.press("ArrowLeft");
  await p.keyboard.press("Enter");
  ck("keyboard Enter claims the focused number", (await S(p)).owner[free - 1] === 1, "n=" + free);
  await p.waitForFunction(() => window.__fifteen.state.turn === 1 || !!window.__fifteen.state.result, null, { timeout: 3000 });

  // 2. the two views: same board, tiles move, note on first switch, persists
  await forge(p, { owner: B([2, 6], [5]), turn: 1 });
  const before = await tile(p, 2).boundingBox();
  await p.keyboard.press("v"); await p.waitForTimeout(500);
  const after = await tile(p, 2).boundingBox();
  ck("V switches to the Grid view", await p.evaluate(() => window.__fifteen.view === "grid" && document.getElementById("board").classList.contains("grid")));
  ck("tile 2 moved to the magic square corner", after.x > before.x && after.y > before.y, JSON.stringify([before, after]));
  ck("first switch shows the one-line note", /adds up to 15/.test(await p.textContent("#toast")));
  ck("ownership unchanged by the view", (await S(p)).owner.join() === B([2, 6], [5]).join());
  await p.reload();
  ck("view survives reload", await p.evaluate(() => window.__fifteen.view === "grid"));
  await p.click("#v-numbers");
  ck("Numbers button switches back", await p.evaluate(() => window.__fifteen.view === "numbers"));

  // 3. power-ups
  // Peek: shows the number you must block
  await forge(p, { owner: B([5], [8, 1]), turn: 1, power: { undo: 1, erase: 1, peek: 1, double: 1 } });
  await p.keyboard.press("3");
  ck("Peek names the block", /block 6/.test(await p.textContent("#hint")), await p.textContent("#hint"));
  ck("Peek marks tile 6", await tile(p, 6).evaluate(e => e.classList.contains("peek")));
  ck("Peek spent", (await S(p)).power.peek === 0);
  // Erase: arm with key 2, tap a computer number
  await p.keyboard.press("2");
  ck("Erase arms targeting", await p.locator("#board.targeting").count() === 1);
  await p.keyboard.press("Escape");
  ck("Esc cancels", await p.locator("#board.targeting").count() === 0 && (await S(p)).power.erase === 1);
  await p.keyboard.press("2"); await tile(p, 8).click();
  let s = await S(p);
  ck("Erase removed the computer's 8", s.owner[7] === 0 && s.power.erase === 0 && s.turn === 1);
  await tile(p, 8).click();
  ck("cannot reclaim the erased number this turn", (await S(p)).owner[7] === 0);
  await tile(p, 6).click();
  ck("then a normal claim", (await S(p)).owner[5] === 1);
  await p.waitForFunction(() => window.__fifteen.state.turn === 1 || !!window.__fifteen.state.result, null, { timeout: 3000 });
  // Undo: rewinds the turn and the reply
  s = await S(p);
  if (!s.result) {
    await p.keyboard.press("1");
    s = await S(p);
    ck("Undo rewound to before the Erase", s.owner.join() === B([5], [8, 1]).join() && s.power.undo === 0 && s.power.erase === 1, JSON.stringify(s.owner));
  } else ck("Undo (round ended early, skipped)", true);
  // Double: two claims in one turn, completing a 15
  await forge(p, { owner: B([8], [5, 3]), turn: 1, power: { undo: 0, erase: 0, peek: 0, double: 1 } });
  await p.keyboard.press("4");
  await tile(p, 1).click();
  s = await S(p);
  ck("Double: first claim keeps your turn", s.owner[0] === 1 && s.turn === 1 && s.claimsLeft === 1);
  ck("hint asks for the second number", /second number/.test(await p.textContent("#hint")));
  await tile(p, 6).click();
  s = await S(p);
  ck("Double: 8 + 1 + 6 wins the round", s.result && s.result.winner === 1 && s.result.earned === null);

  // 4. round end, winning triple in both views, next round, match end
  ck("round result in the hint", /8 \+ 1 \+ 6 = 15|1 \+ 6 \+ 8 = 15/.test(await p.textContent("#hint")), await p.textContent("#hint"));
  ck("winning triple lit", await p.locator(".ft.win").count() === 3);
  await p.click("#v-grid");
  ck("still lit in the Grid view", await p.locator(".ft.win").count() === 3);
  await shot(p, "round-won-grid");
  ck("Next round button shows", await p.locator("#next").isVisible());
  await p.click("#next");
  s = await S(p);
  ck("next round: the computer starts", s.round === 2 && s.starter === 2);
  await p.waitForFunction(() => window.__fifteen.state.turn === 1, null, { timeout: 3000 });
  ck("and has played its opening", (await S(p)).owner.filter(o => o === 2).length === 1);
  await forge(p, { owner: B([2, 6], [1, 3]), turn: 1, wins: [0, 2, 0], rounds: [1, 1], round: 3 });
  await tile(p, 7).click();
  ck("3-0 ends the match with the overlay", await p.locator("#over").isVisible() && /You win the match/.test(await p.textContent("#over-title")));
  await shot(p, "match-over");
  await p.click("#again");
  s = await S(p);
  ck("New match resets", s.round === 1 && s.wins.join() === "0,0,0" && await p.locator("#over").isHidden());
  // Hard with a power-up: the computer uses Double to fork
  await forge(p, { diff: "hard", owner: B([5], [8]), turn: 2, cpuPower: { undo: 0, erase: 0, peek: 0, double: 1 } });
  await p.waitForFunction(() => !!window.__fifteen.state.result || window.__fifteen.state.turn === 1, null, { timeout: 3000 });
  ck("Hard computer used its Double", (await S(p)).cpuPower.double === 0);
  ck("no page errors", errs.length === 0, errs.join("|"));
  await ctx.close();

  // 5. blocked localStorage still runs
  ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(() => { Object.defineProperty(window, "localStorage", { get() { throw new Error("blocked"); } }); });
  p = await ctx.newPage(); const errs2 = []; p.on("pageerror", e => errs2.push(e.message));
  await p.goto(page);
  await tile(p, 5).click();
  ck("plays with storage blocked", (await S(p)).owner[4] === 1);
  ck("no page errors with storage blocked", errs2.length === 0, errs2.join("|"));
  await ctx.close();

  // 6. reduced motion: views switch instantly, play continues
  ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  p = await ctx.newPage(); const errs3 = []; p.on("pageerror", e => errs3.push(e.message));
  await p.goto(page);
  ck("no slide transition under reduced motion", !/transform/.test(await tile(p, 1).evaluate(e => getComputedStyle(e).transitionProperty)));
  await p.click("#v-grid");
  const at0 = await tile(p, 8).boundingBox();
  ck("Grid view placed at once (8 in the top-left)", at0.x < 120 && at0.y < 500, JSON.stringify(at0));
  await tile(p, 5).click();
  await p.waitForFunction(() => window.__fifteen.state.turn === 1, null, { timeout: 3000 });
  ck("reduced motion still plays", (await S(p)).owner.filter(Boolean).length === 2);
  ck("no page errors under reduced motion", errs3.length === 0, errs3.join("|"));
  await ctx.close();
};
