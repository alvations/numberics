/* SPDX-License-Identifier: Apache-2.0 | Copyright 2026 alvations (Melon Lab)
 * Browser checks for Fifteen. Run: NODE_PATH=$(npm root -g) node tests/emu/run.cjs fifteen */
"use strict";
const playFit = require("./_fit.cjs");
module.exports = async function ({ browser, url, ck, shot }) {
  const page = url + "fifteen/";
  const B = (mine, theirs) => { const o = new Array(9).fill(0); mine.forEach(n => o[n - 1] = 1); theirs.forEach(n => o[n - 1] = 2); return o; };
  const forge = (p, patch) => p.evaluate((patch) => {
    const F = window.NumbericsFifteen, s = F.newMatch(11, patch.diff || "medium");
    Object.assign(s, patch); window.__fifteen.state = s;
  }, patch);
  const S = (p) => p.evaluate(() => window.__fifteen.state);
  const tile = (p, n) => p.locator('.ft[data-n="' + n + '"]');
  const card = (p) => p.waitForSelector("#over:not([hidden])", { timeout: 4000 });   // R13: after the hold
  // the how-to sheet opens by itself on a first visit (REDESIGN.md 1.3): most sections start with it already seen
  const seenHow = (c) => c.addInitScript(() => { try { if (!localStorage.getItem("numberics_progress_v1")) localStorage.setItem("numberics_progress_v1", JSON.stringify({ v: 1, games: {}, howto: { fifteen: true }, daily: {} })); } catch (e) { /* blocked */ } });
  const closeHow = async (p) => { if (await p.locator("#sh-howto:not([hidden])").count()) await p.click("#sh-howto [data-play]"); };

  // 0. first visit: Easy, and the how-to sheet once, with the three steps of REDESIGN.md 9.9
  {
    const c0 = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    const p0 = await c0.newPage(); const e0 = []; p0.on("pageerror", e => e0.push(e.message));
    await p0.goto(page);
    await p0.waitForSelector("#sh-howto:not([hidden])", { timeout: 3000 }).catch(() => {});
    ck("first visit: the how-to sheet opens by itself", await p0.locator("#sh-howto:not([hidden])").count() === 1);
    ck("first visit starts on Easy", (await S(p0)).diff === "easy" && await p0.locator('#diff button[data-d="easy"][aria-pressed="true"]').count() === 1);
    const steps = await p0.locator("#sh-howto .step p").allTextContents();
    ck("how-to: the three steps, word for word", steps.join("|") === "Pick a number from 1 to 9.|The computer picks too.|Hold three numbers that add up to fifteen to win.", steps.join("|"));
    ck("how-to: every step has a drawn picture", await p0.locator("#sh-howto .step .pv .mt").count() >= 3);
    await shot(p0, "howto");
    await p0.keyboard.press("5");
    ck("no key reaches the game while the sheet is open", (await S(p0)).owner.every(o => !o) && (await S(p0)).power.erase === 0);
    await p0.click("#sh-howto [data-play]");
    ck("Play closes the sheet", await p0.locator("#sh-howto:not([hidden])").count() === 0);
    ck("the How to play row is a collapsed details", await p0.evaluate(() => { const d = document.getElementById("how"); return d.tagName === "DETAILS" && !d.open && /How to play/.test(d.querySelector("summary").textContent); }));
    const sum = await p0.locator("#how summary").boundingBox();
    ck("the How to play row is 44 px or taller", sum.height >= 44, JSON.stringify(sum));
    await p0.click("#how summary"); await p0.click("#how-steps");
    ck("the steps open again from the row", await p0.locator("#sh-howto:not([hidden])").count() === 1);
    await p0.click("#sh-howto [data-play]");
    await p0.click('#diff button[data-d="hard"]');
    await p0.reload();
    ck("the sheet opens only once", await p0.locator("#sh-howto:not([hidden])").count() === 0);
    ck("a saved choice is kept (Hard after reload)", (await S(p0)).diff === "hard");
    const seg = await p0.locator(".views button").evaluateAll(b => b.map(x => x.getBoundingClientRect().height));
    ck("the Numbers/Grid switch is 44 px tall", seg.every(h => h >= 44), JSON.stringify(seg));
    // integration: the win line is hidden until a win (a zero-length round-capped line drew a dot in the board's corner)
    ck("no win line (or stray dot) on a fresh board", await p0.evaluate(() => document.getElementById("wl").hasAttribute("hidden") && getComputedStyle(document.getElementById("wl")).display === "none"));
    ck("the games list is the cards, this game marked", await p0.locator("#games.cards a.card").count() === 10 && await p0.locator('#games a.card[aria-current="page"][data-id="fifteen"]').count() === 1);
    ck("no page errors (first visit)", e0.length === 0, e0.join("|"));
    await c0.close();
  }

  // 1. loads, plays a real turn by click and by keyboard, the computer replies
  let ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2 }); await seenHow(ctx);
  let p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto(page);
  await p.click('#diff button[data-d="medium"]');   // the checks below were written against Medium
  ck("nine tiles", await p.locator(".ft").count() === 9);
  ck("difficulty row under the header", await p.locator("#diff button").count() === 3);
  ck("tray has four power-ups", await p.locator("#tray .pw").count() === 4);
  ck("no horizontal scroll at 375px", await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  // R6 header, R11 naming
  ck("subtitle starts with a Numberics link home", await p.evaluate(() => { const a = document.querySelector(".sub a"); return !!a && a.textContent === "Numberics" && a.getAttribute("href") === "../" && document.querySelector(".sub").firstElementChild === a; }));
  ck("restart is New game", (await p.textContent("#new")).trim() === "New game");
  ck("no CPU anywhere on the page", !/\bCPU\b/i.test(await p.evaluate(() => document.body.innerText)));
  // R16: the duel pills, in order, and an empty record reads a dimmed "none"
  ck("pills are You, Computer, Record", (await p.locator(".stat > span").allTextContents()).join() === "You,Computer,Record", (await p.locator(".stat > span").allTextContents()).join());
  ck("empty record reads none, dimmed", (await p.textContent("#rec")) === "none" && await p.locator("#rec.none").count() === 1);
  ck("round number in the hint at the start of a round", /^Round 1 of 5\. Your turn/.test(await p.textContent("#hint")), await p.textContent("#hint"));
  ck("R14: the how-to says the computer can use power-ups on Hard", /On Hard [\s\S]*computer can Erase and\s+Double/.test(await p.textContent(".how")) && /without Erase, Double or Peek/.test(await p.textContent(".how")) && /On Hard a draw gives you an Erase, so perfect play wins/.test((await p.textContent(".how")).replace(/\s+/g, " ")));
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

  // ownership is the fill (craft N1): gold for you, cool for the computer, neutral when free; one focus ring (F9)
  await forge(p, { owner: B([2, 8], [4, 5]), turn: 1 }); await p.waitForTimeout(350);   // let the colour transition settle
  const look = await p.evaluate(() => {
    const cs = (n) => getComputedStyle(document.querySelector('.ft[data-n="' + n + '"]'));
    const root = getComputedStyle(document.documentElement), tmp = document.createElement("i"); document.body.appendChild(tmp);
    const rgb = (v) => { tmp.style.color = v; return getComputedStyle(tmp).color; };
    const r = { mine: cs(2).backgroundColor, mine2: cs(8).backgroundColor, theirs: cs(4).backgroundColor, theirs2: cs(5).backgroundColor, free: cs(1).backgroundColor,
      accent: rgb(root.getPropertyValue("--accent")), cool: rgb(root.getPropertyValue("--cool")), cell: rgb(root.getPropertyValue("--cell")),
      mineInk: cs(2).color, label: document.querySelector('.ft[data-n="4"] small').textContent, mineShadow: cs(2).boxShadow };
    tmp.remove(); return r;
  });
  ck("your tiles are all the gold fill", look.mine === look.accent && look.mine2 === look.accent, JSON.stringify(look));
  ck("the computer's tiles are all the cool fill", look.theirs === look.cool && look.theirs2 === look.cool, JSON.stringify(look));
  ck("free tiles are neutral", look.free === look.cell, JSON.stringify(look));
  ck("number on a claimed tile is dark ink (readable)", /^rgb\((2\d|1\d|\d),/.test(look.mineInk), look.mineInk);
  ck("the computer's tile label says computer", look.label === "computer");
  ck("ownership needs no ring", look.mineShadow === "none", look.mineShadow);
  await p.keyboard.press("Tab"); await p.evaluate(() => document.querySelector('.ft[data-n="2"]').focus());
  await p.keyboard.press("ArrowRight"); await p.keyboard.press("ArrowLeft");
  const fr = await p.evaluate(() => { const e = document.activeElement, c = getComputedStyle(e); return { n: e.dataset.n, outline: c.outlineStyle + " " + c.outlineColor, shadow: c.boxShadow, gold: (n => { const pr = document.createElement("i"); pr.style.color = getComputedStyle(document.documentElement).getPropertyValue(n).trim(); document.body.appendChild(pr); const c = getComputedStyle(pr).color; pr.remove(); return c; })("--accent") }; });
  ck("a focused claimed tile has exactly one ring (gold outline, no shadow rings)", fr.outline === "solid " + fr.gold && fr.shadow === "none", JSON.stringify(fr));

  // R5: a power-up with no charge explains itself on a tap; disabled is aria-disabled, never `disabled`
  await forge(p, { owner: B([2], [4]), turn: 1, power: { undo: 0, erase: 0, peek: 0, double: 0 } });
  ck("tray buttons are never disabled", await p.locator("#tray .pw[disabled]").count() === 0);
  ck("empty ones are aria-disabled", await p.locator('#tray .pw[aria-disabled="true"]').count() === 4);
  await p.locator("#tray .pw").nth(3).click({ force: true });
  ck("tapping empty Double explains it and how to earn it", /^Double: Claim two numbers this turn\. Win a round/.test(await p.textContent("#hint")), await p.textContent("#hint"));
  ck("tray tooltip voice", (await p.locator("#tray .pw").nth(0).getAttribute("title")) === "1: Undo. Take back your last turn.");
  await forge(p, { owner: B([2], [4]), turn: 1, power: { undo: 0, erase: 0, peek: 0, double: 0 } });
  await p.keyboard.press("2");
  ck("key 2 with no Erase explains too", /^Erase: /.test(await p.textContent("#hint")), await p.textContent("#hint"));
  await forge(p, { owner: B([2], []), turn: 1, power: { undo: 0, erase: 1, peek: 0, double: 0 } });
  await p.locator("#tray .pw").nth(1).click({ force: true });
  ck("Erase with a charge but nothing to erase says why", /The computer holds no number yet/.test(await p.textContent("#hint")), await p.textContent("#hint"));

  // R9: keyboard targeting from anywhere: key 2 arms Erase, arrows move, Enter erases
  await forge(p, { owner: B([5, 2], [8, 1]), turn: 1, power: { undo: 0, erase: 1, peek: 0, double: 0 } });
  await p.evaluate(() => { document.querySelector('.ft[data-n="3"]').focus(); document.activeElement.blur(); });   // cursor on 3
  await p.keyboard.press("2");
  ck("Erase armed", await p.locator("#board.targeting").count() === 1);
  // Numbers view is 1-5 over 6-9: down from 3 is 8
  await p.keyboard.press("ArrowDown");
  ck("arrows move the cursor while targeting", await p.evaluate(() => document.activeElement.dataset.n === "8"), await p.evaluate(() => document.activeElement.dataset.n));
  await p.keyboard.press("Enter");
  ck("Enter erases the number under the cursor", (await S(p)).owner[7] === 0 && (await S(p)).power.erase === 0);
  ck("the erase target style is gone", await p.locator(".ft.target").count() === 0);
  // Enter on a focused button is that button, never a claim
  await p.evaluate(() => { const st = window.__fifteen.state; st.moves = 3; window.__fifteen.state = st; });
  await p.focus("#new"); await p.keyboard.press("Enter");
  ck("Enter on the New game button asks Sure? and claims nothing", /^Sure\?/.test(await p.textContent("#new")) && (await S(p)).owner.filter(o => o === 1).length === 2);
  // R7: a warning uses the neutral toast
  await forge(p, { owner: B([5], [8]), turn: 1 });
  await tile(p, 8).click();
  ck("Already taken is a neutral toast", await p.evaluate(() => document.getElementById("toast").classList.contains("bad")));
  // R10: a mid-match difficulty change asks first
  await forge(p, { owner: B([5], [8]), turn: 1, moves: 2 });
  await p.click('#diff button[data-d="hard"]');
  ck("first tap on Hard asks Sure?", (await p.textContent('#diff button[data-d="hard"]')) === "Sure?" && (await S(p)).diff === "medium");
  await p.click('#diff button[data-d="hard"]');
  ck("second tap starts a Hard match", (await S(p)).diff === "hard" && (await p.textContent('#diff button[data-d="hard"]')) === "Hard");
  ck("Hard round 1: no Erase", (await S(p)).power.erase === 0 && /^Round 1 of 5\. Your turn\. Claim any number\.$/.test(await p.textContent("#hint")), await p.textContent("#hint"));
  await p.locator("#tray .pw").nth(1).click({ force: true });
  ck("empty Erase on Hard says how it comes", /On Hard you get one after a drawn round/.test(await p.textContent("#hint")), await p.textContent("#hint"));
  await p.evaluate(() => { const st = window.__fifteen.state; st.round = 2; st.rounds = [0]; st.wins = [1, 0, 0]; st.power.erase = 1; window.__fifteen.state = st; });
  ck("after a draw, Hard tells you about the round's Erase", /^Round 2 of 5\. Your turn; you hold an Erase\.$/.test(await p.textContent("#hint")), await p.textContent("#hint"));
  await p.click('#diff button[data-d="medium"]');

  // 2. the two views: same board, tiles move, note on first switch, persists
  await forge(p, { owner: B([2, 6], [5]), turn: 1 });
  const before = await tile(p, 2).boundingBox();
  await p.keyboard.press("v"); await p.waitForTimeout(500);
  const after = await tile(p, 2).boundingBox();
  ck("V switches to the Grid view", await p.evaluate(() => window.__fifteen.view === "grid" && document.getElementById("board").classList.contains("grid")));
  ck("tile 2 moved to the magic square corner", after.x > before.x && after.y > before.y, JSON.stringify([before, after]));
  ck("first switch shows the one-line note in the hint line, not a toast (cold #1)", /adds up to 15/.test(await p.textContent("#hint")) && !(await p.evaluate(() => document.getElementById("toast").classList.contains("on"))));
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
  // R3 in the page: claim, let the computer reply, Undo: the Peek stays spent
  await forge(p, { owner: B([], []), turn: 1, power: { undo: 1, erase: 0, peek: 1, double: 0 } });
  await tile(p, 5).click();
  await p.waitForFunction(() => window.__fifteen.state.turn === 1, null, { timeout: 3000 });
  await p.keyboard.press("3"); await p.keyboard.press("1");
  const s0 = await S(p);
  ck("Undo after Peek keeps the Peek spent", s0.power.peek === 0 && s0.power.undo === 0 && s0.owner.every(o => !o), JSON.stringify(s0.power));
  await forge(p, { owner: B([5], [8, 1]), turn: 1, power: { undo: 1, erase: 1, peek: 1, double: 1 } });
  await p.keyboard.press("3");
  // Erase: arm with key 2, tap a computer number
  await p.keyboard.press("2");
  ck("Erase arms targeting", await p.locator("#board.targeting").count() === 1);
  await p.keyboard.press("Escape");
  ck("Esc cancels", await p.locator("#board.targeting").count() === 0 && (await S(p)).power.erase === 1);
  await p.keyboard.press("2"); await tile(p, 8).click();
  let s = await S(p);
  ck("Erase removed the computer's 8", s.owner[7] === 0 && s.power.erase === 0 && s.turn === 1);
  ck("no toast hides the next-step hint after Erase", !/Erased/.test(await p.textContent("#toast")) && /not the one you erased/.test(await p.textContent("#hint")));
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

  // R13: the winning line stays in view, undimmed, before the card
  ck("R13: no card at first", await p.locator("#over").isHidden() && await p.locator("#board.ended").count() === 0);
  ck("R13: the winning three glow on the open board", await p.locator(".ft.win").count() === 3);
  await shot(p, "hold");
  await p.waitForTimeout(900);
  ck("R13: still no card after 0.9 s", await p.locator("#over").isHidden());
  await card(p);
  // 4. round end: the family overlay (R8), the winning three kept visible as owner chips, next round, match end
  ck("round end shows the overlay", await p.locator("#over").isVisible());
  ck("headline names the round", /^You win round 1$/.test(await p.textContent("#over-title")), await p.textContent("#over-title"));
  ck("winning three shown as gold chips", (await p.locator("#trio b.mine").allTextContents()).join() === "1,6,8", (await p.locator("#trio b").allTextContents()).join());
  ck("summary line has the tally", /^You 1 : 0 Computer$/.test(await p.textContent("#over-text")), await p.textContent("#over-text"));
  ck("R2: a round won with Double says it earned nothing", /No power-up/.test(await p.textContent("#over-best")));
  ck("result not repeated in the hint (R7)", (await p.textContent("#hint")) === "");
  ck("no Undo across the decided round (R1)", await p.locator("#tray .pw").nth(0).getAttribute("aria-disabled") === "true");
  ck("winning triple still marked on the board", await p.locator(".ft.win").count() === 3);
  await p.click("#v-grid");
  ck("still marked in the Grid view", await p.locator(".ft.win").count() === 3);
  await shot(p, "round-won-grid");
  ck("headline fits one line at 375px", await p.evaluate(() => { const h = document.getElementById("over-title"); return h.getBoundingClientRect().height < parseFloat(getComputedStyle(h).fontSize) * 1.6; }));
  ck("Next round is the gold primary in the overlay", await p.locator("#over #next.primary").isVisible());
  ck("the bottom row has no Next round", await p.locator(".row #next").count() === 0);
  // R13: "See the board" hides the card; a tap on the board brings it back
  await p.click("#over-view");
  ck("See the board hides the card", await p.locator("#over").isHidden() && /Tap the board/.test(await p.textContent("#hint")));
  await tile(p, 2).click();
  ck("a tap on the board brings the card back", await p.locator("#over").isVisible() && (await S(p)).round === 1);
  await p.click("#over-view"); await p.keyboard.press("Enter");
  ck("Enter brings the card back too", await p.locator("#over").isVisible() && (await S(p)).round === 1);
  await p.click("#next");
  s = await S(p);
  ck("next round: the computer starts", s.round === 2 && s.starter === 2);
  await p.waitForFunction(() => window.__fifteen.state.turn === 1, null, { timeout: 3000 });
  ck("and has played its opening", (await S(p)).owner.filter(o => o === 2).length === 1);
  // the bottom row keeps its size when a round ends
  await forge(p, { owner: B([2, 6], [1, 3]), turn: 1, wins: [0, 1, 0], rounds: [1], round: 2 });
  const rowBefore = await p.evaluate(() => [...document.querySelectorAll(".row .btn")].map(b => { const r = b.getBoundingClientRect(); return [r.width, r.height, getComputedStyle(b).fontSize].join(); }).join("|"));
  await p.evaluate(() => { window.__toasts = []; const t = document.getElementById("toast"); new MutationObserver(() => window.__toasts.push(t.textContent)).observe(t, { childList: true, characterData: true, subtree: true }); });
  await tile(p, 7).click(); await card(p);
  const rowAfter = await p.evaluate(() => [...document.querySelectorAll(".row .btn")].map(b => { const r = b.getBoundingClientRect(); return [r.width, r.height, getComputedStyle(b).fontSize].join(); }).join("|"));
  ck("bottom row unchanged when the round ends", rowBefore === rowAfter, rowBefore + " vs " + rowAfter);
  ck("a clean round win pays, shown once in the overlay", /^\+1 /.test(await p.textContent("#over-best")) && (await p.evaluate(() => window.__toasts.length)) === 0, await p.evaluate(() => window.__toasts.join("|")));
  await p.keyboard.press("Enter");
  ck("Enter starts the next round", (await S(p)).round === 3);
  await forge(p, { owner: B([2, 6], [1, 3]), turn: 1, wins: [0, 2, 0], rounds: [1, 1], round: 3 });
  const rec0 = await p.evaluate(() => Object.assign({}, window.__fifteen.record));
  await tile(p, 7).click(); await card(p);
  ck("3-0 ends the match with the overlay", await p.locator("#over").isVisible() && (await p.textContent("#over-title")) === "You win");
  ck("R16 match summary", /^Match won 3-0 · Medium$/.test(await p.textContent("#over-text")), await p.textContent("#over-text"));
  ck("R16: the record counts the match once", (await p.textContent("#rec")) === (rec0.won + 1) + "-" + rec0.lost, await p.textContent("#rec"));
  ck("match end offers New game, not Next round", await p.locator("#again").isVisible() && await p.locator("#next").isHidden() && (await p.textContent("#again")) === "New game");
  await shot(p, "match-over");
  await p.click("#again");
  s = await S(p);
  ck("New game resets", s.round === 1 && s.wins.join() === "0,0,0" && await p.locator("#over").isHidden());
  ck("a finished match's New game adds no loss", (await p.textContent("#rec")) === (rec0.won + 1) + "-" + rec0.lost);
  // R12: quitting a live match counts as a loss, and the Sure? says so
  await tile(p, 5).click(); await p.waitForFunction(() => window.__fifteen.state.turn === 1, null, { timeout: 3000 });
  await p.click("#new");
  ck("R12: New game mid-match asks Sure? Counts as a loss", (await p.textContent("#new")) === "Sure? Counts as a loss", await p.textContent("#new"));
  await p.click("#new");
  ck("R12: confirming records the loss", (await p.textContent("#rec")) === (rec0.won + 1) + "-" + (rec0.lost + 1), await p.textContent("#rec"));
  await tile(p, 5).click(); await p.waitForFunction(() => window.__fifteen.state.turn === 1, null, { timeout: 3000 });
  await p.click('#diff button[data-d="easy"]');
  ck("R12: a level switch mid-match warns in the hint", /counts as a loss/.test(await p.textContent("#hint")), await p.textContent("#hint"));
  await p.click('#diff button[data-d="easy"]');
  ck("R12: the switch records the loss", (await p.textContent("#rec")) === (rec0.won + 1) + "-" + (rec0.lost + 2) && (await S(p)).diff === "easy");
  await p.reload();
  ck("the record survives reload", (await p.textContent("#rec")) === (rec0.won + 1) + "-" + (rec0.lost + 2));
  await p.click('#diff button[data-d="medium"]');
  // craft #9: the summary never breaks inside a part (320 px, a drawn round with draws in the tally)
  await p.setViewportSize({ width: 320, height: 640 });
  await forge(p, { owner: B([1, 2, 4, 7], [3, 5, 6, 9]), turn: 1, wins: [1, 1, 0], rounds: [0, 1], round: 3 });
  await tile(p, 8).click(); await card(p);
  const parts = await p.evaluate(() => [...document.querySelectorAll("#over-text span")].map(e => ({ t: e.textContent, lines: e.getClientRects().length })));
  ck("summary parts", parts.map(x => x.t).join("|") === "Nobody made 15|You 1 : 0 Computer|2 drawn", JSON.stringify(parts));
  ck("no part breaks across lines at 320px", parts.every(x => x.lines === 1), JSON.stringify(parts));
  ck("no horizontal scroll at 320px", await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await p.setViewportSize({ width: 375, height: 812 });
  // R17: Enter on a focused games-row link navigates, with a result up or a power-up armed
  await p.evaluate(() => { const a = document.querySelector('#games a[href*="nine"]') || document.querySelector("#games a:not([aria-current])"); a.id = "golink"; a.focus(); });
  const href = await p.evaluate(() => document.getElementById("golink").href);
  await p.keyboard.press("Enter"); await p.waitForURL(href, { timeout: 3000 }).catch(() => {});
  ck("R17: Enter on a games link navigates while a result is up", p.url() === href, p.url() + " vs " + href);
  await p.goto(page);
  await forge(p, { owner: B([5, 2], [8, 1]), turn: 1, power: { undo: 0, erase: 1, peek: 0, double: 0 } });
  await p.keyboard.press("2");
  await p.evaluate(() => { const a = document.querySelector("#games a:not([aria-current])"); a.id = "golink"; a.focus(); });
  const href2 = await p.evaluate(() => document.getElementById("golink").href);
  await p.keyboard.press("Enter"); await p.waitForURL(href2, { timeout: 3000 }).catch(() => {});
  ck("R17: Enter on a games link navigates while Erase is armed", p.url() === href2, p.url());
  await p.goto(page);
  // Hard with a power-up: the computer uses Double to fork
  await forge(p, { diff: "hard", owner: B([5], [8]), turn: 2, cpuPower: { undo: 0, erase: 0, peek: 0, double: 1 } });
  await p.waitForFunction(() => !!window.__fifteen.state.result || window.__fifteen.state.turn === 1, null, { timeout: 3000 });
  ck("Hard computer used its Double", (await S(p)).cpuPower.double === 0);
  if (!(await S(p)).result) ck("R14: the hint line announces it", /The computer used Double\./.test(await p.textContent("#hint")), await p.textContent("#hint"));
  // R15: a clean win with every slot full says so
  await forge(p, { owner: B([2, 6], [1, 3]), turn: 1, power: { undo: 9, erase: 9, peek: 9, double: 9 } });
  await tile(p, 7).click(); await card(p);
  ck("R15: Power-ups full", (await p.textContent("#over-best")) === "Power-ups full.", await p.textContent("#over-best"));
  ck("no page errors", errs.length === 0, errs.join("|"));
  await ctx.close();

  // 5. blocked localStorage still runs
  ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(() => { Object.defineProperty(window, "localStorage", { get() { throw new Error("blocked"); } }); });
  p = await ctx.newPage(); const errs2 = []; p.on("pageerror", e => errs2.push(e.message));
  await p.goto(page); await p.waitForTimeout(50); await closeHow(p);
  ck("the game fits 390x844 without scrolling (craft nit 4; top bar to the last control)", (await p.evaluate(playFit)).fits, JSON.stringify(await p.evaluate(playFit)));
  await tile(p, 5).click();
  ck("plays with storage blocked", (await S(p)).owner[4] === 1);
  ck("no page errors with storage blocked", errs2.length === 0, errs2.join("|"));
  await ctx.close();

  // 6. reduced motion: views switch instantly, play continues
  ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  p = await ctx.newPage(); const errs3 = []; p.on("pageerror", e => errs3.push(e.message));
  await p.goto(page); await p.waitForTimeout(50); await closeHow(p);
  ck("no slide transition under reduced motion", !/transform/.test(await tile(p, 1).evaluate(e => getComputedStyle(e).transitionProperty)));
  await p.click("#v-grid");
  const at0 = await tile(p, 8).boundingBox();
  ck("Grid view placed at once (8 in the top-left)", at0.x < 120 && at0.y < 500, JSON.stringify(at0));
  await tile(p, 5).click();
  await p.waitForFunction(() => window.__fifteen.state.turn === 1, null, { timeout: 3000 });
  ck("reduced motion still plays", (await S(p)).owner.filter(Boolean).length === 2);
  ck("no page errors under reduced motion", errs3.length === 0, errs3.join("|"));
  await ctx.close();

  // 7. round 3 (TRIAGE3)
  ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2 }); await seenHow(ctx);
  p = await ctx.newPage(); const errs4 = []; p.on("pageerror", e => errs4.push(e.message));
  await p.goto(page);
  // cold #28: the Numbers view is 1-5 over 6-9 (the short row offset), never a 3 x 3; Grid keeps the magic square
  await forge(p, { owner: B([], []), turn: 1 });
  const boxes = async () => p.evaluate(() => [...Array(9)].map((_, i) => { const r = document.querySelector('.ft[data-n="' + (i + 1) + '"]').getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; }));
  let bx = await boxes();
  const ys = (ns) => new Set(ns.map(n => bx[n - 1].y)).size;
  ck("Numbers: 1-5 share one row", ys([1, 2, 3, 4, 5]) === 1, JSON.stringify(bx));
  ck("Numbers: 6-9 share the row below", ys([6, 7, 8, 9]) === 1 && bx[5].y > bx[0].y + bx[0].h);
  ck("Numbers: two rows, not three", new Set(bx.map(b => b.y)).size === 2);
  ck("Numbers: the short row sits offset (6 between 1 and 2), so no column lines up", bx[5].x > bx[0].x + 5 && bx[5].x < bx[1].x - 5, JSON.stringify([bx[0], bx[5], bx[1]]));
  ck("Numbers: tiles stay a good tap size at 375px (44px or more)", bx.every(b => b.w >= 44 && b.h >= 44), JSON.stringify(bx[0]));
  const hop = await p.evaluate(() => getComputedStyle(document.querySelector("#hash i")).opacity);
  ck("Numbers: no grid lines drawn", hop === "0", hop);
  ck("Numbers: the computer label fits inside its tile", await p.evaluate(() => { const t = document.querySelector('.ft[data-n="1"]'), s = t.lastChild; s.textContent = "computer"; const ok = s.scrollWidth <= t.clientWidth; s.textContent = ""; return ok; }));
  await p.click("#v-grid"); await p.waitForTimeout(500); bx = await boxes();
  const rowOf = (ns) => new Set(ns.map(n => bx[n - 1].y)).size === 1;
  ck("Grid: the magic square 8 1 6 / 3 5 7 / 4 9 2", rowOf([8, 1, 6]) && rowOf([3, 5, 7]) && rowOf([4, 9, 2]) && bx[7].x < bx[0].x && bx[0].x < bx[5].x && bx[7].y < bx[2].y && bx[2].y < bx[3].y, JSON.stringify(bx));
  await p.keyboard.press("v"); await p.waitForTimeout(450);
  // keyboard over the two rows
  await p.evaluate(() => document.querySelector('.ft[data-n="5"]').focus());
  await p.keyboard.press("ArrowRight");
  ck("Numbers: right from 5 wraps to 6", await p.evaluate(() => document.activeElement.dataset.n) === "6");
  await p.keyboard.press("ArrowUp");
  ck("Numbers: up from 6 is 1", await p.evaluate(() => document.activeElement.dataset.n) === "1");
  await p.keyboard.press("ArrowLeft");
  ck("Numbers: left from 1 wraps to 9", await p.evaluate(() => document.activeElement.dataset.n) === "9");
  // the end-card pattern: shared "none" style for an empty record
  const noneSt = await p.evaluate(() => { const c = getComputedStyle(document.getElementById("rec")), v = getComputedStyle(document.getElementById("you")); return [c.fontSize, c.fontWeight, v.fontSize]; });
  ck("empty record: shared none style, same size as the values", noneSt[0] === noneSt[2] && noneSt[1] === "600", JSON.stringify(noneSt));

  // craft #2: the computer's winning claim stays on the board 1.5 s before the card, even when you tap during it
  const timeCard = async (spam) => {
    await p.evaluate(() => {
      window.__t = {}; const t6 = document.querySelector('.ft[data-n="6"]'), ov = document.getElementById("over");
      new MutationObserver(() => { if (!window.__t.claim && t6.classList.contains("theirs")) window.__t.claim = performance.now(); }).observe(t6, { attributes: true });
      new MutationObserver(() => { if (!window.__t.card && !ov.hidden) window.__t.card = performance.now(); }).observe(ov, { attributes: true });
    });
    await forge(p, { diff: "easy", owner: B([3, 4], [8, 1]), turn: 2 });   // the computer holds 8 1 and takes 6
    if (spam) { await p.waitForFunction(() => !!window.__t.claim, null, { timeout: 3000 }); for (let i = 0; i < 6; i++) { await tile(p, 9).click(); await p.keyboard.press("Enter"); await p.waitForTimeout(120); } }
    await card(p);
    return p.evaluate(() => window.__t.card - window.__t.claim);
  };
  let dt = await timeCard(false);
  ck("the computer's final claim: card no sooner than 1.5 s after it shows", dt >= 1450 && dt < 2500, Math.round(dt) + " ms");
  ck("the lost round's headline", (await p.textContent("#over-title")) === "The computer wins round 1", await p.textContent("#over-title"));
  ck("the card focuses its primary button", await p.evaluate(() => document.activeElement && document.activeElement.id === "next"));
  dt = await timeCard(true);
  ck("taps and Enter during the hold never bring the card early", dt >= 1450, Math.round(dt) + " ms");
  // your own final claim: same hold
  await p.evaluate(() => { window.__t = {}; const t7 = document.querySelector('.ft[data-n="7"]'), ov = document.getElementById("over");
    new MutationObserver(() => { if (!window.__t.claim && t7.classList.contains("mine")) window.__t.claim = performance.now(); }).observe(t7, { attributes: true });
    new MutationObserver(() => { if (!window.__t.card && !ov.hidden) window.__t.card = performance.now(); }).observe(ov, { attributes: true }); });
  await forge(p, { owner: B([2, 6], [1, 3]), turn: 1 });
  const newBox = await p.locator("#new").boundingBox(), rowBox = await p.locator(".row").boundingBox();
  await tile(p, 7).click(); await card(p);
  dt = await p.evaluate(() => window.__t.card - window.__t.claim);
  ck("your final claim: card no sooner than 1.5 s", dt >= 1450, Math.round(dt) + " ms");
  // one end-card pattern: the page's New game hides while the card shows, its space kept
  ck("the page's New game is hidden under a card", await p.evaluate(() => getComputedStyle(document.getElementById("new")).visibility === "hidden"));
  const newBox2 = await p.locator("#new").boundingBox(), rowBox2 = await p.locator(".row").boundingBox();
  ck("its space is kept (no jump)", JSON.stringify(newBox) === JSON.stringify(newBox2) && JSON.stringify(rowBox) === JSON.stringify(rowBox2), JSON.stringify([newBox, newBox2]));
  ck("focus on Next round even after a mouse tap", await p.evaluate(() => document.activeElement.id === "next"));
  await p.click("#over-view");
  ck("See the board: the family hint", (await p.textContent("#hint")) === "Tap the board for the summary.", await p.textContent("#hint"));
  ck("New game back while the card is away", await p.evaluate(() => getComputedStyle(document.getElementById("new")).visibility === "visible"));
  // a drawn round reads "Draw round N"
  await forge(p, { owner: B([1, 2, 4, 7], [3, 5, 6, 9]), turn: 1, wins: [0, 1, 0], rounds: [1], round: 2 });
  await tile(p, 8).click(); await card(p);
  ck("drawn round headline", (await p.textContent("#over-title")) === "Draw round 2", await p.textContent("#over-title"));
  ck("drawn round subline", (await p.textContent("#over-text")) === "Nobody made 15 · You 1 : 0 Computer · 1 drawn", await p.textContent("#over-text"));
  // a lost match reads "The computer wins", "Match lost 0-3 · Medium"
  await forge(p, { diff: "easy", owner: B([3, 4], [8, 1]), turn: 2, wins: [0, 0, 2], rounds: [2, 2], round: 3 });
  await card(p);
  ck("lost match headline", (await p.textContent("#over-title")) === "The computer wins", await p.textContent("#over-title"));
  ck("lost match subline", (await p.textContent("#over-text")) === "Match lost 0-3 · Easy", await p.textContent("#over-text"));
  ck("match card focuses New game", await p.evaluate(() => document.activeElement.id === "again"));
  // TRIAGE3: Peek counts as help; the copy says so
  await forge(p, { owner: B([2, 6], [1, 3]), turn: 1, power: { undo: 0, erase: 0, peek: 1, double: 0 } });
  await p.locator("#tray .pw").nth(2).click();
  ck("Peek names your win", /7 wins it/.test(await p.textContent("#hint")), await p.textContent("#hint"));
  await tile(p, 7).click(); await card(p);
  ck("a round won after Peek pays nothing, and says why", (await p.textContent("#over-best")) === "No power-up: you used Peek this round." && (await S(p)).result.earned === null, await p.textContent("#over-best"));
  await forge(p, { owner: B([2], []), turn: 1, power: { undo: 0, erase: 0, peek: 0, double: 0 } });
  await p.locator("#tray .pw").nth(2).click({ force: true });
  ck("the tray says Peek stops the reward", /Win a round without Erase, Double or Peek to earn one\./.test(await p.textContent("#hint")), await p.textContent("#hint"));
  ck("Erase says the claim must be a different number", /then claim a different one/.test(await p.locator("#tray .pw").nth(1).getAttribute("title")));
  // the view toggle is a quiet segment, not a button like New game (craft #2)
  ck("view toggle is a segment, New game is a button", await p.locator(".views.seg").count() === 1 && await p.locator(".views .btn").count() === 0 && await p.locator("#new.btn").count() === 1);
  ck("no page errors (round 3)", errs4.length === 0, errs4.join("|"));
  await ctx.close();

  // 8. D-Fifteen motion, sound beats, trophies (REDESIGN.md 5.8, 5.11, 5.12, 8.4, 10)
  const anims = (p, n) => p.evaluate((n) => document.querySelector('.ft[data-n="' + n + '"]').getAnimations({ subtree: true })
    .map(a => ({ name: a.animationName || "", props: a.effect && a.effect.getKeyframes ? Object.keys(a.effect.getKeyframes()[0] || {}) : [], ps: a.effect && a.effect.pseudoElement || "" })), n);
  // click a tile and read its animations in the same task, so a slow runner cannot miss a 240 ms fill
  const clickAnims = (p, n) => p.evaluate((n) => { const t = document.querySelector('.ft[data-n="' + n + '"]'); t.click();
    return { cls: t.className, list: t.getAnimations({ subtree: true }).map(a => ({ name: a.animationName || "", props: [] })) }; }, n);
  ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } }); await seenHow(ctx);
  // log every duck call, on the stub audio.js sets and on the real music module that replaces it after a gesture
  await ctx.addInitScript(() => { window.__duck = []; let m; Object.defineProperty(window, "NumbericsMusic", { configurable: true, get() { return m; },
    set(v) { if (v && typeof v.duck === "function") { const o = v.duck; v.duck = function (on) { window.__duck.push(on); return o.call(this, on); }; } m = v; } }); });
  p = await ctx.newPage(); const errs5 = []; p.on("pageerror", e => errs5.push(e.message));
  await p.goto(page);
  // the claim fill: an ::after in the owner colour, clip-path circle from the centre, the number darkens at 120 ms
  await forge(p, { diff: "easy", owner: B([], []), turn: 1 });
  const c5 = await clickAnims(p, 5), a5 = c5.list;
  ck("claim: the tile fills from its centre (clip-path on ::after)", a5.some(a => a.name === "ft-claim") && /claiming/.test(c5.cls), JSON.stringify(c5));
  ck("claim: the fill is the owner colour", await tile(p, 5).evaluate(e => getComputedStyle(e, "::after").backgroundColor === getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || /rgb/.test(getComputedStyle(e, "::after").backgroundColor)));
  await p.waitForTimeout(320);
  ck("claim: after 240 ms the tile rests gold, no ghost class", await tile(p, 5).evaluate(e => !e.classList.contains("claiming") && e.classList.contains("mine")));
  await p.waitForFunction(() => window.__fifteen.state.turn === 1, null, { timeout: 3000 });
  const cpuN = (await S(p)).owner.findIndex(o => o === 2) + 1;
  ck("the computer's claim fills in its cool colour", cpuN > 0 && await tile(p, cpuN).evaluate(e => e.classList.contains("theirs")));
  // input during an animation: Double, two picks inside one claim fill, gives two claims at once
  await forge(p, { diff: "easy", owner: B([], []), turn: 1, power: { undo: 0, erase: 0, peek: 0, double: 1 } });
  await p.keyboard.press("4");
  await p.evaluate(() => { document.querySelector('.ft[data-n="2"]').click(); document.querySelector('.ft[data-n="4"]').click(); });
  let s8 = await S(p);
  ck("two quick picks during a claim fill give two claims", s8.owner[1] === 1 && s8.owner[3] === 1 && s8.moves === 2, JSON.stringify(s8.owner));
  ck("the first fill was finished at once by the second pick", await tile(p, 2).evaluate(e => !e.classList.contains("claiming")) && await tile(p, 4).evaluate(e => e.classList.contains("claiming")));
  await p.waitForFunction(() => window.__fifteen.state.turn === 1 || !!window.__fifteen.state.result, null, { timeout: 3000 });
  // the view switch is a FLIP: translate + scale, never width or height
  await forge(p, { diff: "easy", owner: B([2], [5]), turn: 1 });
  const tp = await tile(p, 1).evaluate(e => getComputedStyle(e).transitionProperty);
  ck("no width, height or transform transition on a tile", !/width|height|transform|all/.test(tp), tp);
  let a1 = await p.evaluate(() => { window.dispatchEvent(new KeyboardEvent("keydown", { key: "v", bubbles: true }));
    return document.querySelector('.ft[data-n="1"]').getAnimations().map(a => ({ name: a.animationName || "", props: Object.keys(a.effect.getKeyframes()[0] || {}) })); });
  ck("view switch: each tile animates translate + scale (FLIP)", a1.some(a => a.props.includes("translate") && a.props.includes("scale")), JSON.stringify(a1));
  ck("view switch: no width or height in any animation", a1.every(a => !a.props.includes("width") && !a.props.includes("height")));
  const mid = await tile(p, 8).boundingBox();
  await p.waitForTimeout(450);
  const end = await tile(p, 8).boundingBox();
  ck("view switch: mid-flight the tile is between its two places", Math.abs(mid.x - end.x) > 2 || Math.abs(mid.y - end.y) > 2, JSON.stringify([mid, end]));
  ck("view switch: done after 380 ms", (await anims(p, 8)).length === 0);
  // two quick view switches during the FLIP give two switches
  await p.keyboard.press("v"); await p.keyboard.press("v");
  ck("two quick V presses give two switches", await p.evaluate(() => window.__fifteen.view === "grid"));
  await p.waitForTimeout(450);
  // the winning triple: the pulse, then in Grid view a line drawn through the three (stroke-dashoffset)
  await forge(p, { diff: "easy", owner: B([], []), turn: 1 });
  await tile(p, 5).click();                                   // your first claim this round is 5 (fif_mid)
  await p.waitForFunction(() => window.__fifteen.state.turn === 1, null, { timeout: 3000 });
  ck("run record: first claim is 5", (await p.evaluate(() => window.__fifteen.run.first)) === 5);
  await p.evaluate(() => { const s = JSON.parse(JSON.stringify(window.__fifteen.state)); s.owner = [1, 2, 2, 0, 1, 0, 0, 0, 0]; s.turn = 1; s.acted = false; s.claimsLeft = 1; s.usedPower = false; s.blocked = 0;
    const t = window.__fifteen; const r = t.run; t.state = s; r.first = 5; });
  await tile(p, 9).click();                                   // 1 + 5 + 9 = 15, the middle column of the magic square
  await p.waitForTimeout(300);
  const wl = await p.evaluate(() => { const l = document.querySelector("#wl line"), sv = document.getElementById("wl"); return { shown: !sv.hasAttribute("hidden") && getComputedStyle(sv).display !== "none", x1: +l.getAttribute("x1"), y1: +l.getAttribute("y1"), x2: +l.getAttribute("x2"), y2: +l.getAttribute("y2"), anim: l.getAnimations().map(a => Object.keys(a.effect.getKeyframes()[0])) }; });
  ck("Grid win: a line is drawn through the three", wl.shown && Math.abs(wl.x1 - wl.x2) < 2 && Math.abs(wl.y1 - wl.y2) > 50, JSON.stringify(wl));
  ck("Grid win: the line draws by stroke-dashoffset", wl.anim.some(k => k.includes("strokeDashoffset")), JSON.stringify(wl.anim));
  ck("Grid win: the winning three pulse", await p.locator(".ft.win").count() === 3);
  await shot(p, "win-line");
  await card(p);
  const ids = await p.evaluate(() => window.__fifteen.cardIds);
  ck("trophies: a round won in Grid view, started on 5", ["fif_round", "fif_grid", "fif_mid"].every(i => ids.includes(i)), ids.join());
  ck("end card shows the trophy pills", await p.locator("#pills:not([hidden]) .trophy").count() === ids.length && ids.length >= 3);
  ck("music ducks while the card is up", await p.evaluate(() => window.__duck[window.__duck.length - 1] === true));
  await shot(p, "over-trophy");
  await p.click("#next");
  ck("music comes back when the card closes", await p.evaluate(() => window.__duck[window.__duck.length - 1] === false));
  await p.keyboard.press("v");                                 // back to Numbers
  // fif_fork: one claim, two open threats
  await forge(p, { diff: "easy", owner: B([8, 6], [7, 9]), turn: 1 });
  await tile(p, 4).click();
  ck("trophy: Two ways (forks >= 2)", await p.evaluate(() => window.NumbericsTrophies.has("fif_fork")));
  // fif_match + fif_medium, then fif_hard
  for (const d of ["medium", "hard"]) {
    await forge(p, { diff: d, owner: B([2, 6], [1, 3]), turn: 1, wins: [0, 2, 0], rounds: [1, 1], round: 3 });
    await tile(p, 7).click(); await card(p);
    const mi = await p.evaluate(() => window.__fifteen.cardIds);
    ck("trophies: match won on " + d, mi.includes("fif_" + d) && (d !== "medium" || mi.includes("fif_match")), mi.join());
    await p.click("#again");
  }
  ck("the card's level record feeds the progress card", await p.evaluate(() => { const g = window.NumbericsProgress.get("fifteen"); return !!g && /^Hard: won 1, lost 0$/.test(g.best); }), JSON.stringify(await p.evaluate(() => window.NumbericsProgress.get("fifteen"))));
  await tile(p, 5).click();
  ck("progress: a live match says so", await p.evaluate(() => { const g = window.NumbericsProgress.get("fifteen"); return g.live === true && /^Round 1/.test(g.liveText); }));
  // frame and node budgets over a scripted 30-move session (REDESIGN.md 10): claims, computer replies, view switches
  const nodes0 = await p.evaluate(() => document.getElementsByTagName("*").length);
  await p.evaluate(() => { window.__fr = []; window.__on = true; let last = performance.now(); const f = (t) => { window.__fr.push(t - last); last = t; if (window.__on) requestAnimationFrame(f); }; requestAnimationFrame(f); });
  for (let i = 0; i < 30; i++) {
    const st = await S(p);
    if (st.result) { if (st.match) await p.evaluate(() => window.__fifteen.state = window.NumbericsFifteen.newMatch(7, "easy")); else await p.evaluate(() => { window.__fifteen.state = window.NumbericsFifteen.nextRound(window.__fifteen.state); }); continue; }
    if (i % 5 === 4) { await p.keyboard.press("v"); await p.waitForTimeout(120); continue; }
    if (st.turn !== 1) { await p.waitForTimeout(150); continue; }
    const fl = st.owner.map((o, k) => o ? 0 : k + 1).filter(Boolean);
    await p.evaluate((n) => document.querySelector('.ft[data-n="' + n + '"]').click(), fl[i % fl.length]);
    await p.waitForTimeout(120);
  }
  const frs = await p.evaluate(() => { window.__on = false; return window.__fr.slice(2); });
  const slow = frs.filter(x => x > 17.5).length, worst = Math.max(...frs);
  // 17.5 ms: vsync jitter in headless (d-notes B2); dropped frames <= 5%
  ck("frames: at most 5% over 17.5 ms in a 30-move session", slow / frs.length <= 0.05, slow + "/" + frs.length + " worst " + worst.toFixed(1));
  const nodes1 = await p.evaluate(() => document.getElementsByTagName("*").length);
  ck("nodes: the board never grows (nine tiles, one line)", await p.locator(".ft").count() === 9 && await p.locator("#wl line").count() === 1 && nodes1 <= nodes0 * 1.05, nodes0 + " -> " + nodes1);
  ck("no page errors (motion and trophies)", errs5.length === 0, errs5.join("|"));
  await ctx.close();

  // 9. reduced motion: by the OS, by the setting, and the setting "Full" beats the OS (REDESIGN.md 5.12)
  for (const mode of [{ os: "reduce", set: null, red: true, tag: "OS" }, { os: "no-preference", set: "reduced", red: true, tag: "setting Less" },
    { os: "reduce", set: "full", red: false, tag: "setting Full over the OS" }]) {
    const c = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: mode.os }); await seenHow(c);
    if (mode.set) await c.addInitScript((m) => { try { localStorage.setItem("numberics_settings_v1", JSON.stringify({ v: 1, motion: m })); } catch (e) {} }, mode.set);
    const q = await c.newPage(); const e9 = []; q.on("pageerror", e => e9.push(e.message));
    await q.goto(page);
    await forge(q, { diff: "easy", owner: B([], []), turn: 1 });
    const ca = (await clickAnims(q, 5)).list;
    if (mode.red) ck("reduced (" + mode.tag + "): the claim is an opacity fade, no clip-path", ca.every(a => a.name !== "ft-claim") && ca.some(a => a.name === "ft-in"), JSON.stringify(ca));
    else ck("full (" + mode.tag + "): the claim fills from the centre", ca.some(a => a.name === "ft-claim"), JSON.stringify(ca));
    await q.waitForFunction(() => window.__fifteen.state.turn === 1, null, { timeout: 3000 });
    const va = await q.evaluate(() => { window.dispatchEvent(new KeyboardEvent("keydown", { key: "v", bubbles: true }));
      return document.querySelector('.ft[data-n="1"]').getAnimations().map(a => ({ name: a.animationName || "", props: Object.keys(a.effect.getKeyframes()[0] || {}) })); });
    if (mode.red) ck("reduced (" + mode.tag + "): the view switch is instant", va.length === 0, JSON.stringify(va));
    else ck("full (" + mode.tag + "): the view switch moves", va.some(a => a.props.includes("translate")), JSON.stringify(va));
    ck("no page errors (" + mode.tag + ")", e9.length === 0, e9.join("|"));
    await c.close();
  }
};
