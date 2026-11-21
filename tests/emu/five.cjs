/* SPDX-License-Identifier: Apache-2.0 | Copyright 2026 alvations (Melon Lab)
 * Browser checks for Five. Run: NODE_PATH=$(npm root -g) node tests/emu/run.cjs five */
"use strict";
const playFit = require("./_fit.cjs");
module.exports = async function ({ browser, url, ck, shot }) {
  const page = url + "five/";
  const idle = (p) => p.waitForFunction(() => window.__five && !window.__five.busy && (window.__five.state.turn === "p" || window.__five.state.roundOver), null, { timeout: 5000 });
  const forge = (p, patch) => p.evaluate((patch) => {
    const s = JSON.parse(JSON.stringify(window.__five.state));
    Object.assign(s, { turn: "p", roundOver: null, matchOver: null, shield: null, midTurn: false, prev: null, seen: {}, quiet: 0 }, patch);
    window.__five.state = s;
  }, patch);
  const st = (p) => p.evaluate(() => window.__five.state);
  const card = (p) => p.waitForFunction(() => window.__five.state.roundOver && !window.__five.busy && !window.__five.holding, null, { timeout: 5000 });
  const slot = (p, i) => p.locator('.slot[data-i="' + i + '"]');
  // a first visit opens the How to play steps once (REDESIGN.md 1.3); Play closes them and the computer opens
  const go = async (p, u) => {
    await p.goto(u || page);
    await p.waitForFunction(() => window.NumbericsUI && (window.NumbericsUI.open() || document.readyState === "complete"), null, { timeout: 5000 });
    await p.waitForTimeout(30);
    if (await p.evaluate(() => window.NumbericsUI.current() === "howto")) await p.click("#sh-howto [data-play]");
  };

  // 1. loads, the computer opens, a real turn by clicks
  let ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2 });
  let p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
  await go(p);
  ck("four tile slots", await p.locator(".slot").count() === 4);
  await idle(p);
  let s = await st(p);
  ck("the computer opened the round", s.moves >= 1 && s.tiles.reduce((a, b) => a + b, 0) !== 4 || s.roundOver, JSON.stringify(s.tiles));
  ck("no horizontal scroll at 375px", await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  ck("R16: pills are You, Computer, Record; an empty Record reads a dimmed none", (await p.locator(".stat span").allTextContents()).join(",") === "You,Computer,Record" &&
    (await p.textContent("#matches")) === "none" && await p.locator("#matches.none").count() === 1);
  ck("R12: Level switch before your first move is one tap (the computer's opener is not you)", await p.evaluate(() => !window.NumbericsFive.played(window.__five.state)));
  await forge(p, { tiles: [2, 1, 1, 1] });
  await slot(p, 0).click();
  ck("tapping your tile selects it", await p.locator(".slot.sel").count() === 1);
  await slot(p, 2).click();
  s = await st(p);
  ck("the add landed on the computer tile", s.tiles[2] === 3 && s.turn === "c", JSON.stringify(s.tiles));
  await idle(p);
  s = await st(p);
  ck("the computer replied", s.turn === "p" && s.moves >= 2);
  // cold #23: on your turn the computer's last move is ringed and said in one line
  ck("cold #23: the tile the computer just hit is marked", s.last.side !== "c" || s.last.kind !== "add" || await p.locator('.slot.last[data-i="' + s.last.to + '"]').count() === 1, JSON.stringify(s.last));
  ck("cold #23: the hint says what it did, on one line", /^(It added \d onto (your|its own) \d\.|It burst (your|its own) \d\.) Tap one of your tiles\.$/.test(await p.textContent("#hint")) &&
    await p.evaluate(() => { const h = document.getElementById("hint"); return h.getBoundingClientRect().height < parseFloat(getComputedStyle(h).lineHeight) * 1.5; }), await p.textContent("#hint"));
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
  // R13: the burst stays on an undimmed board for about 1.5 s, then the card
  ck("R13: the board shows first, no card yet", await p.evaluate(() => window.__five.holding) && !(await p.isVisible("#over")) && await p.locator('.slot.hit[data-i="3"]').count() === 1);
  ck("round 3: no reward toast over the hold's hint (the card says what the round paid)", await p.evaluate(() => { const t = document.getElementById("toast"); return !(t.classList.contains("on") && /^Burst/.test(t.textContent)); }), await p.evaluate(() => document.getElementById("toast").textContent));
  ck("R13: the hint says what burst", /^Your 1 onto their 4 made 5: burst\.$/.test(await p.textContent("#hint")), await p.textContent("#hint"));
  await shot(p, "hold");
  const t0 = Date.now(); await card(p); const held = Date.now() - t0;
  ck("R13: the card follows after the hold", held > 900 && held < 2500, String(held));
  ck("round 3: round won reads 'You win round 1'", await p.isVisible("#over") && (await p.textContent("#over-title")) === "You win round 1", await p.textContent("#over-title"));
  ck("round 3: subline '<what burst> · You 1 : 0 Computer', plus what the round paid (cold #24)", /^Your 1 onto their 4 made 5 · You 1 : 0 Computer · earned (Undo|Split|Shield|Nudge)(, (Undo|Split|Shield|Nudge))*$/.test((await p.textContent("#over-text")).replace(/\u00a0/g, " ")), await p.textContent("#over-text"));
  ck("round 3: focus is on the card's primary button", await p.evaluate(() => document.activeElement && document.activeElement.id === "again"));
  ck("round 3: the lower New game is hidden while the card shows, its space kept", await p.evaluate(() => { const n = document.getElementById("new"); return getComputedStyle(n).visibility === "hidden" && n.getBoundingClientRect().height > 30; }));
  await p.click("#over-view");
  ck("R13: See the board hides the card and says how to get it back", !(await p.isVisible("#over")) && (await p.textContent("#hint")) === "Tap the board for the summary." && await p.locator('.slot.hit[data-i="3"]').count() === 1);
  await slot(p, 2).click();
  ck("R13: a tap on the board brings the card back", await p.isVisible("#over"));
  ck("round 3: See the board shows the lower New game again", await p.evaluate(() => getComputedStyle(document.getElementById("new")).visibility === "hidden"));
  ck("R7: no toast for the round result (the overlay says it)", !(await p.evaluate(() => document.getElementById("toast").classList.contains("on") && /^Burst!$/.test(document.getElementById("toast").textContent))));
  await shot(p, "round");
  await p.click("#again");
  await idle(p);
  s = await st(p);
  ck("next round starts fresh with the computer opening", s.round === 2 && !s.roundOver && s.moves > 0);
  await forge(p, { tiles: [1, 0, 0, 4], wins: { p: 2, c: 1 } });
  await slot(p, 0).click(); await slot(p, 3).click();
  await card(p);
  ck("round 3: match won reads 'You win'", (await p.textContent("#over-title")) === "You win" && (await p.textContent("#again")) === "New game", await p.textContent("#over-title"));
  ck("round 3: match summary 'Match won 3-1 · Easy' (a first visit plays Easy)", (await p.textContent("#over-text")) === "Match won 3-1 · Easy", await p.textContent("#over-text"));
  ck("R8: the headline is white (--ink), not gold", await p.evaluate(() => getComputedStyle(document.getElementById("over-title")).color === (n => { const pr = document.createElement("i"); pr.style.color = getComputedStyle(document.documentElement).getPropertyValue(n).trim(); document.body.appendChild(pr); const c = getComputedStyle(pr).color; pr.remove(); return c; })("--ink")));
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
  await go(p); await idle(p);
  ck("R6: H1 is the game name, subtitle starts with the Numberics link", (await p.textContent("h1")) === "Five" && (await p.textContent(".sub a")) === "Numberics" && /^Numberics · [A-Z].*\.$/.test((await p.textContent(".sub")).trim()));
  ck("how-to has no jargon, says 'at 5 or more' and 'you can always win'", await p.evaluate(() => { const t = document.querySelector(".how").textContent; return !/seat|solved|opens|perfect play/i.test(t) && /5 or more bursts/.test(t) && /you can always win/.test(t); }));
  ck("R11: restart says New game", (await p.textContent("#new")) === "New game");
  // R1: a lost round with a snapshot and Undo stock: Undo is aria-disabled and a tap explains why
  await forge(p, { tiles: [4, 0, 1, 2], power: { p: { undo: 2, split: 0, shield: 0, nudge: 0 }, c: { undo: 0, split: 0, shield: 0, nudge: 0 } }, wins: { p: 0, c: 2 } });
  await slot(p, 0).click(); await slot(p, 2).click(); // your 4 bursts their 1; the computer's 2 then bursts your 4
  await card(p);
  s = await st(p);
  ck("the computer took the match", s.matchOver === "c", JSON.stringify(s.tiles));
  ck("R7: the reward toast from your burst is not left over the lost-match card", await p.evaluate(() => !document.getElementById("toast").classList.contains("on")));
  const undoBtn = p.locator("#tray .pw").nth(0);
  ck("R1: Undo is aria-disabled after a lost match", (await undoBtn.getAttribute("aria-disabled")) === "true");
  const undoLeft = s.power.p.undo;
  await undoBtn.click({ force: true }); // aria-disabled: a real tap still lands and explains
  s = await st(p);
  ck("R1: tapping it changes nothing and says why", s.matchOver === "c" && s.power.p.undo === undoLeft && undoLeft >= 2 && /Undo: Take back.*Not once a round is decided\./.test(await p.textContent("#hint")), await p.textContent("#hint"));
  ck("R8: the lost-match headline fits one line at 375px", await p.evaluate(() => { const h = document.getElementById("over-title"); return h.textContent === "The computer wins" && h.getBoundingClientRect().height < parseFloat(getComputedStyle(h).lineHeight) * 1.5; }));
  ck("record counts the loss", (await p.textContent("#matches")) === "0-1");
  ck("round 3: match lost summary 'Match lost 0-3 · Easy'", (await p.textContent("#over-text")) === "Match lost 0-3 · Easy", await p.textContent("#over-text"));
  await shot(p, "lost-375");
  await p.click("#again"); await idle(p);
  // R5: an empty tray button explains itself in the hint line
  await forge(p, { tiles: [2, 1, 1, 1], power: { p: { undo: 1, split: 0, shield: 1, nudge: 1 }, c: { undo: 0, split: 0, shield: 0, nudge: 0 } } });
  await p.locator("#tray .pw").nth(1).click({ force: true });
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
  await forge(p, { tiles: [2, 1, 0, 1], power: { p: { undo: 0, split: 0, shield: 0, nudge: 1 }, c: { undo: 0, split: 0, shield: 0, nudge: 0 } } });
  await p.keyboard.press("4"); await slot(p, 2).click(); // a burst tile is not a valid target
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

  // 4d. round 2: R12, R5 keys, R17, the swallowed tap, the Esc hint, R2 toast
  ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
  p = await ctx.newPage(); const e5 = []; p.on("pageerror", e => e5.push(e.message));
  await go(p); await idle(p);
  // the first tap after the computer's burst is never swallowed (mechanics #7): one tile left, tap during the ghost
  await forge(p, { level: "hard", tiles: [1, 4, 2, 2] });
  await slot(p, 0).click(); await slot(p, 2).click();
  await p.waitForFunction(() => window.__five.state.turn === "p" && !window.__five.state.roundOver, null, { timeout: 5000 });
  s = await st(p);
  const left = s.tiles[0] ? 0 : 1;
  const wasBusy = await p.evaluate(() => window.__five.busy);
  await slot(p, left).click();
  ck("the first tap with one tile left selects it, even mid-animation", await p.locator('.slot.sel[data-i="' + left + '"]').count() === 1, "busy at tap: " + wasBusy + " " + JSON.stringify(s.tiles));
  const tgt = s.tiles[2] ? 2 : 3; await slot(p, tgt).click();
  ck("and the second tap makes the move", (await st(p)).turn !== "p" || (await st(p)).roundOver, JSON.stringify((await st(p)).tiles));
  await p.waitForFunction(() => !window.__five.busy && !window.__five.holding, null, { timeout: 5000 });
  if ((await st(p)).roundOver) { await p.click("#again"); }
  await idle(p);
  // R5: a number key on an empty slot explains it, exactly like a tap
  await forge(p, { tiles: [2, 1, 1, 1], power: { p: { undo: 0, split: 0, shield: 0, nudge: 0 }, c: { undo: 0, split: 0, shield: 0, nudge: 0 } } });
  await p.focus("#board"); await p.keyboard.press("3");
  ck("R5: key 3 on an empty Shield explains it", /^Shield: Your tile cannot be hit.*Burst a computer tile to earn one\./.test(await p.textContent("#hint")), await p.textContent("#hint"));
  await p.keyboard.press("u");
  ck("R5: u on an empty Undo explains it", /^Undo: Take back/.test(await p.textContent("#hint")), await p.textContent("#hint"));
  // the Esc hint shows with a keyboard only
  await forge(p, { tiles: [2, 1, 1, 1], power: { p: { undo: 0, split: 1, shield: 0, nudge: 0 }, c: { undo: 0, split: 0, shield: 0, nudge: 0 } } });
  await p.locator("#tray .pw").nth(1).click();
  ck("tap-armed Split: a short hint, no Esc", (await p.textContent("#hint")) === "Tap the tile to take 1 from.", await p.textContent("#hint"));
  await shot(p, "split-375");
  ck("the Split hint fits one line at 375px", await p.evaluate(() => { const h = document.getElementById("hint"); return h.getBoundingClientRect().height < parseFloat(getComputedStyle(h).lineHeight) * 1.5; }));
  await p.keyboard.press("Escape"); await p.keyboard.press("2");
  ck("key-armed Split mentions Esc", / \(Esc cancels\)$/.test(await p.textContent("#hint")), await p.textContent("#hint"));
  await p.keyboard.press("Escape");
  // R2: Shield, then a burst on the same turn: the burst happens, no reward, a neutral note
  await forge(p, { tiles: [2, 1, 3, 2], power: { p: { undo: 0, split: 0, shield: 1, nudge: 0 }, c: { undo: 0, split: 0, shield: 0, nudge: 0 } } });
  await p.locator("#tray .pw").nth(2).click(); await slot(p, 1).click();
  await slot(p, 0).click(); await slot(p, 2).click();
  s = await st(p);
  ck("R2: the burst after Shield pays nothing", s.tiles[2] === 0 && Object.values(s.power.p).every(v => v === 0), JSON.stringify(s.power.p));
  ck("R2: and says so in a neutral toast", await p.evaluate(() => { const t = document.getElementById("toast"); return t.textContent === "Burst! No reward after Shield." && t.classList.contains("info"); }));
  await idle(p);
  // R12: after your first move, New game and a level switch ask "Sure? Counts as a loss" and record the loss
  await p.waitForFunction(() => !window.__five.holding, null, { timeout: 5000 });
  if ((await st(p)).roundOver) { await p.click("#again"); await idle(p); }
  ck("R12: played after your move", await p.evaluate(() => window.NumbericsFive.played(window.__five.state)));
  const lost0 = await p.evaluate(() => window.__five.record.lost);
  await p.click("#new");
  ck("R12: New game says it counts as a loss", (await p.textContent("#new")) === "Sure? Counts as a loss");
  await p.click("#new"); await idle(p);
  ck("R12: quitting recorded a loss", await p.evaluate(() => window.__five.record.lost) === lost0 + 1 && (await p.textContent("#matches")) === "0-" + (lost0 + 1));
  ck("R12: the fresh match is not 'played' yet, so a level switch is one tap", !(await p.evaluate(() => window.NumbericsFive.played(window.__five.state))));
  await p.click('#levels button[data-level="easy"]'); await idle(p);
  ck("one tap switched to Easy with no loss", (await st(p)).level === "easy" && await p.evaluate(() => window.__five.record.lost) === lost0 + 1);
  s = await st(p); { const m = await p.evaluate(() => window.NumbericsFive.legalMoves(window.__five.state)[0]); await slot(p, m.from).click(); await slot(p, m.to).click(); }
  await idle(p);
  if (!(await st(p)).roundOver) {
    await p.click('#levels button[data-level="hard"]'); await p.click('#levels button[data-level="medium"]');
    ck("only one level button says Sure? at a time", (await p.locator('#levels button').allTextContents()).join(",") === "Easy,Sure?,Hard", (await p.locator('#levels button').allTextContents()).join(","));
    ck("the hint says the switch counts as a loss", /^Tap Medium again: it counts as a loss\.$/.test(await p.textContent("#hint")), await p.textContent("#hint"));
    await p.click('#levels button[data-level="medium"]'); await idle(p);
    ck("R12: the level switch recorded the loss", (await st(p)).level === "medium" && await p.evaluate(() => window.__five.record.lost) === lost0 + 2);
  } else ck("round ended early (unexpected)", false);
  // R17: Enter on a focused games-row link navigates
  await p.locator("#games a").first().focus();
  const href = await p.locator("#games a").first().getAttribute("href");
  await Promise.all([p.waitForURL(u => !/\/five\/?$/.test(u.pathname), { timeout: 3000 }).catch(() => {}), p.keyboard.press("Enter")]);
  ck("R17: Enter on a games-row link opens it", !/\/five\/?$/.test(new URL(p.url()).pathname), p.url() + " " + href);
  ck("no page errors (round 2)", e5.length === 0, e5.join("|"));
  await ctx.close();

  // 4e. round 3 (craft #2): the deciding burst is on the undimmed board for 1.5 s before the card, measured from the
  // moment the tile bursts, whether you or the computer makes it; the card never flashes up in between
  ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
  p = await ctx.newPage(); const e6 = []; p.on("pageerror", e => e6.push(e.message));
  await go(p); await idle(p);
  const watch = (p) => p.evaluate(() => {
    window.__t = { burst: 0, card: 0, flash: false, ghost: 0, fly: "" };
    const over = document.getElementById("over");
    const tick = () => {
      const now = performance.now(), T = window.__t, s = window.__five.state;
      const g = document.querySelector(".ghost.final"), f = document.querySelector(".fly");
      if (f && !T.fly) T.fly = f.textContent;
      if (!T.burst && g) T.burst = now;
      if (T.burst && g && !over.hidden) T.flash = true;
      if (g && !T.card && now - T.burst > 1000 && over.hidden && parseFloat(getComputedStyle(g).opacity) > 0.8) T.ghost = now - T.burst;
      if (!over.hidden && s.roundOver) { if (!T.card) T.card = now; if (!T.burst) T.flash = true; return; }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  const timing = (p) => p.waitForFunction(() => window.__t.card, null, { timeout: 6000 }).then(() => p.evaluate(() => window.__t));
  await forge(p, { tiles: [1, 0, 0, 4], wins: { p: 0, c: 0 } });
  await watch(p);
  await slot(p, 0).click(); await slot(p, 3).click();
  let T = await timing(p);
  ck("craft #2: your deciding burst shows 1.5 s before the card", T.burst > 0 && T.card - T.burst >= 1450 && T.card - T.burst < 2200 && !T.flash, JSON.stringify(T));
  ck("craft #2: the burst is still lit after 1 s on the undimmed board", T.ghost >= 1000, JSON.stringify(T));
  ck("craft nit: the flying copy reads +1, not a second numeral", T.fly === "+1", T.fly);
  await p.click("#again"); await idle(p);
  // the computer's deciding burst: your 1 onto its 1 leaves 1 . 2 4; Hard's 4 onto your 1 makes 5 and ends the round
  await forge(p, { level: "hard", tiles: [1, 0, 1, 4], wins: { p: 0, c: 1 } });
  await watch(p);
  await slot(p, 0).click(); await slot(p, 2).click();
  T = await timing(p);
  s = await st(p);
  ck("craft #2: the computer won the round with a burst", s.roundOver === "c" && s.last.side === "c" && s.last.burst, JSON.stringify(s.last));
  ck("craft #2: the computer's deciding burst shows 1.5 s before the card", T.burst > 0 && T.card - T.burst >= 1450 && T.card - T.burst < 2200 && !T.flash, JSON.stringify(T));
  ck("craft #2: its burst is still lit after 1 s", T.ghost >= 1000, JSON.stringify(T));
  ck("round 3: round lost reads 'The computer wins round N'", (await p.textContent("#over-title")) === "The computer wins round " + s.round, await p.textContent("#over-title"));
  ck("round 3: lost-round subline", /^Computer's 4 onto your 1 made 5 · You 0 : 2 Computer/.test((await p.textContent("#over-text")).replace(/\u00a0/g, " ")), await p.textContent("#over-text"));
  ck("round 3: focus moved to Next round", await p.evaluate(() => document.activeElement && document.activeElement.id === "again"));
  await shot(p, "lost-round-375");
  ck("no page errors (timing)", e6.length === 0, e6.join("|"));
  await ctx.close();

  // 4c. page height at 390x844 fits without scrolling
  ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  p = await ctx.newPage(); await go(p); await idle(p);
  ck("the game fits 390x844 without scrolling (top bar to the New game row)", (await p.evaluate(playFit)).fits, JSON.stringify(await p.evaluate(playFit)));
  await ctx.close();

  // 5. storage blocked
  ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  p = await ctx.newPage(); const e2 = []; p.on("pageerror", e => e2.push(e.message));
  await p.addInitScript(() => { Object.defineProperty(window, "localStorage", { get() { throw new Error("blocked"); } }); });
  await go(p); await idle(p);
  await forge(p, { tiles: [2, 1, 1, 1] });
  await slot(p, 0).click(); await slot(p, 2).click(); await idle(p);
  ck("runs with storage blocked", e2.length === 0 && (await st(p)).moves >= 2, e2.join("|"));
  await ctx.close();

  // 6. reduced motion: still plays, the burst is a fade
  ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  p = await ctx.newPage(); const e3 = []; p.on("pageerror", e => e3.push(e.message));
  await go(p); await idle(p);
  await forge(p, { tiles: [4, 1, 2, 1] });
  await slot(p, 0).click(); await slot(p, 2).click();
  await p.waitForTimeout(60);
  const anim = await p.evaluate(() => { const g = document.querySelector(".ghost"); return g ? getComputedStyle(g).animationName : "none"; });
  ck("reduced motion: the burst fades, no scale", anim === "five-fade" || anim === "none", anim);
  await idle(p);
  const r = await st(p);
  ck("reduced motion plays the turn through", r.tiles[2] === 0 && r.moves >= 2 && e3.length === 0, JSON.stringify(r.tiles) + e3.join("|"));
  await ctx.close();

  // ===== phase D (REDESIGN.md 5.6, 7.3, 8.4, 9.5, 10, 12) =====
  // 7. first visit: Easy, the three How to play steps open once, the computer opens when they close; a saved choice is kept
  ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  p = await ctx.newPage(); const e7 = []; p.on("pageerror", e => e7.push(e.message));
  await p.goto(page);
  await p.waitForFunction(() => window.NumbericsUI && window.NumbericsUI.current() === "howto", null, { timeout: 3000 }).catch(() => {});
  const how = await p.evaluate(() => ({ open: window.NumbericsUI.current(), title: document.querySelector("#sh-howto h2").textContent,
    steps: [...document.querySelectorAll("#sh-howto .step p")].map(e => e.textContent), pics: document.querySelectorAll("#sh-howto .step .pv").length,
    level: window.__five.state.level, moves: window.__five.state.moves }));
  ck("first visit: the How to play sheet opens by itself", how.open === "howto" && how.title === "How to play Five", JSON.stringify(how));
  ck("first visit: three steps, one sentence each, as 9.5 words them", JSON.stringify(how.steps) === JSON.stringify(["Tap your tile, then a tile to add it onto.",
    "A tile at five or more bursts.", "Burst both of the computer's tiles to win the round. First to three."]) && how.pics === 3, JSON.stringify(how.steps));
  ck("first visit: the match is on Easy", how.level === "easy");
  await p.waitForTimeout(1300);
  ck("first visit: the computer waits while the steps are open", (await st(p)).moves === 0);
  await shot(p, "howto");
  await p.click("#sh-howto [data-play]");
  ck("Play closes the sheet", await p.evaluate(() => !window.NumbericsUI.open()));
  await idle(p);
  ck("then the computer opens the round", (await st(p)).moves >= 1);
  ck("the How to play row is collapsed under the board and holds the full rules", await p.evaluate(() => { const d = document.querySelector("details.how");
    return d && !d.open && d.querySelector("summary").textContent === "How to play" && /you can always win/.test(d.textContent) && /Esc cancels/.test(d.textContent); }));
  await p.click('#levels button[data-level="hard"]'); await idle(p);
  await p.reload(); await p.waitForTimeout(150);
  ck("the steps open only once (seen is remembered)", await p.evaluate(() => !window.NumbericsUI.open()));
  ck("a saved choice is kept: Hard after reload", (await st(p)).level === "hard");
  await p.click("details.how summary"); await p.click("#howto-open");
  ck("the steps are always reachable from the How to play row", await p.evaluate(() => window.NumbericsUI.current() === "howto"));
  await p.keyboard.press("Escape");
  ck("44 px targets: tray, levels, New game, the row and its button", await p.evaluate(() => [...document.querySelectorAll("#tray button, #levels button, #new, details.how summary, #howto-open")]
    .every(b => { const r = b.getBoundingClientRect(); return r.height >= 44 && r.width >= 44; })));
  ck("the games list on the page is the cards, in games.json order, Five marked Playing", await p.evaluate(() => {
    const c = [...document.querySelectorAll("#games.cards > a.card")]; return c.length === 10 && c[4].getAttribute("aria-current") === "page" && c[0].dataset.id === "fibonacci" && c[9].dataset.id === "sudoku"; }));
  ck("no page errors (first visit)", e7.length === 0, e7.join("|"));
  await ctx.close();

  // 8. motion: the flight, the landing, the pop, the burst; and input during an animation
  const seen = async (q) => { const c = await browser.newContext(Object.assign({ viewport: { width: 390, height: 844 } }, q || {})); const pg = await c.newPage(); return [c, pg]; };
  [ctx, p] = await seen(); const e8 = []; p.on("pageerror", e => e8.push(e.message));
  await go(p); await idle(p);
  await p.evaluate(() => { // spy on the music, the sounds and the trophy reports (the real calls still run)
    window.__calls = { duck: [], sfx: [], rep: [] };
    window.NumbericsMusic = Object.assign(window.NumbericsMusic || {}, { duck: v => window.__calls.duck.push(v) });
    const A = window.NumbericsAudio;
    ["land", "burst", "win", "lose", "trophy", "power", "tick", "bad"].forEach(n => { const f = A[n]; A[n] = a => { window.__calls.sfx.push(n); return f(a); }; });
    const T = window.NumbericsTrophies, r = T.report; T.report = function (g, e, d, o) { const out = r.apply(T, arguments); window.__calls.rep.push([g, e, JSON.parse(JSON.stringify(d)), out]); return out; };
  });
  await forge(p, { tiles: [2, 1, 1, 1] });
  const fl = await p.evaluate(() => {
    const before = document.querySelector('.slot[data-i="2"] .tile');
    window.__five.tap(0); window.__five.tap(2);
    const f = document.querySelector("#fx .fly"), an = f ? f.getAnimations() : [];
    return { fly: !!f, text: f && f.textContent, n: an.length, dur: an.map(a => a.effect.getTiming().duration), ease: an[0] && an[0].effect.getTiming().easing,
      comp: an[1] && an[1].effect.composite, lift: an[1] && an[1].effect.getKeyframes()[1].transform,
      shown: document.querySelector('.slot[data-i="2"] .tile').textContent, same: document.querySelector('.slot[data-i="2"] .tile') === before, state: window.__five.state.tiles[2] };
  });
  ck("5.6: the added tile's copy flies (two tracks, 260 ms, --e-fly, an added lift and swell)", fl.fly && fl.text === "+2" && fl.n === 2 && fl.dur.every(d => d === 260) &&
    fl.ease === "cubic-bezier(0.3, 0.7, 0.2, 1)" && fl.comp === "add" && /translateY\(-6%\) scale\(1\.08\)/.test(fl.lift), JSON.stringify(fl));
  ck("5.6: while it flies the target still shows its old number (the state is already 3)", fl.shown === "1" && fl.state === 3 && fl.same, JSON.stringify(fl));
  await p.waitForTimeout(120); await shot(p, "mid-flight");
  await p.waitForTimeout(170);
  const ld = await p.evaluate(() => { const t = document.querySelector('.slot[data-i="2"] .tile'), a = t.getAnimations();
    return { text: t.textContent, pop: a.some(x => x.effect.getKeyframes()[0].transform === "scale(0.72)" && x.effect.getTiming().duration === 180), fly: document.querySelectorAll("#fx .fly").length }; });
  ck("5.6: on landing the number changes and the target pops (.72 to 1.14 to 1, 180 ms)", ld.text === "3" && ld.pop && ld.fly === 0, JSON.stringify(ld));
  ck("7.3: land() at impact", await p.evaluate(() => window.__calls.sfx.includes("land")));
  // input during the computer's flight: two quick taps are applied at once (the flight ends, the move is made)
  await p.waitForFunction(() => window.__five.anim && window.__five.state.turn === "p", null, { timeout: 4000, polling: 5 });
  const two = await p.evaluate(() => {
    const m0 = window.__five.state.moves, mv = window.NumbericsFive.legalMoves(window.__five.state)[0];
    window.__five.tap(mv.from); window.__five.tap(mv.to);
    return { m0, m1: window.__five.state.moves, turn: window.__five.state.turn, over: window.__five.state.roundOver };
  });
  ck("5.11: two quick inputs during the computer's flight make a move at once (no wait, no drop)", two.m1 === two.m0 + 1 && (two.turn === "c" || two.over), JSON.stringify(two));
  await p.waitForFunction(() => !window.__five.busy && !window.__five.holding, null, { timeout: 5000 });
  if ((await st(p)).roundOver) { await p.click("#again"); }
  await idle(p);
  // a burst (not the deciding one): 1 -> 1.15 -> 0 over 200 ms, 8 shards over 420 ms, then the outline fades in
  await forge(p, { tiles: [4, 1, 2, 1] });
  await p.evaluate(() => { window.__five.tap(0); window.__five.tap(2); });
  await p.waitForTimeout(285);
  const bu = await p.evaluate(() => {
    const g = document.querySelector("#fx .ghost"), ga = g ? g.getAnimations() : [], sh = [...document.querySelectorAll("#fx .shard")];
    const sa = sh.map(s => s.getAnimations()[0]).filter(Boolean), out = document.getAnimations().filter(a => a.effect.pseudoElement === "::after");
    return { ghost: !!g, gd: ga[0] && ga[0].effect.getTiming().duration, gk: ga[0] && ga[0].effect.getKeyframes().map(k => k.transform).join(" "),
      shards: sh.length, sd: sa.length && sa[0].effect.getTiming().duration, outline: out.length, burstSfx: window.__calls.sfx.includes("burst") };
  });
  ck("5.6: the burst tile scales 1 to 1.15 to 0 over 200 ms", bu.ghost && bu.gd === 200 && /scale\(1\.15\).*scale\(0\)/.test(bu.gk), JSON.stringify(bu));
  ck("5.6: 8 shards fly out over 420 ms; the empty outline fades in", bu.shards === 8 && bu.sd === 420 && bu.outline >= 1, JSON.stringify(bu));
  ck("7.3: burst() at the burst", bu.burstSfx);
  await shot(p, "burst");
  await p.waitForTimeout(500);
  ck("the shards and the ghost clean themselves up", await p.evaluate(() => document.querySelectorAll("#fx .shard, #fx .ghost:not(.final)").length === 0));
  ck("no page errors (motion)", e8.length === 0, e8.join("|"));

  // 9. trophies on a scripted line, the end-card pills, the music duck, progress
  await idle(p);
  const win = async (patch) => { await forge(p, Object.assign({ tiles: [1, 0, 0, 4] }, patch)); await slot(p, 0).click(); await slot(p, 3).click(); await card(p); };
  await win({ wins: { p: 0, c: 0 }, level: "easy" });
  let cardT = await p.evaluate(() => [...document.querySelectorAll("#over .tro-pills .trophy")].map(e => e.dataset.trophy));
  ck("8.4: a round won at exactly five: five_round and the secret five_exact, as pills on the card", cardT.includes("five_round") && cardT.includes("five_exact"), JSON.stringify(cardT));
  ck("8.1: the trophy sound plays as the card shows (no toast over the card)", await p.evaluate(() => window.__calls.sfx.includes("trophy") && window.__calls.sfx.includes("win") && !document.getElementById("toast").classList.contains("on")));
  ck("music ducks while the end card shows", await p.evaluate(() => window.__calls.duck[window.__calls.duck.length - 1] === true));
  await shot(p, "card-trophy");
  await p.click("#again"); await idle(p);
  ck("music comes back when the card closes", await p.evaluate(() => window.__calls.duck[window.__calls.duck.length - 1] === false));
  // 3-0 on Medium: five_match, five_medium, five_sweep
  await win({ wins: { p: 2, c: 0 }, level: "medium" });
  cardT = await p.evaluate(() => [...document.querySelectorAll("#over .tro-pills .trophy")].map(e => e.dataset.trophy));
  ck("8.4: a 3-0 match on Medium: five_match, five_medium, five_sweep", ["five_match", "five_medium", "five_sweep"].every(id => cardT.includes(id)), JSON.stringify(cardT));
  await p.click("#again"); await idle(p);
  // 0-2 down, then won on Hard: five_hard and the secret five_back
  await forge(p, { tiles: [2, 1, 1, 1], wins: { p: 0, c: 2 }, level: "hard" });
  await slot(p, 0).click(); await slot(p, 2).click(); await idle(p);
  await win({ wins: { p: 2, c: 2 }, level: "hard" });
  cardT = await p.evaluate(() => [...document.querySelectorAll("#over .tro-pills .trophy")].map(e => e.dataset.trophy));
  ck("8.4: won on Hard from 0-2 down: five_hard and five_back", cardT.includes("five_hard") && cardT.includes("five_back") && !cardT.includes("five_sweep"), JSON.stringify(cardT));
  const reps = await p.evaluate(() => window.__calls.rep.filter(r => r[0] === "five"));
  ck("8.4: events are round {won, burstAt} and match {won, level, p, c, down02}, with real booleans", reps.length >= 5 && reps.every(r =>
    r[1] === "move" || (r[1] === "round" && typeof r[2].won === "boolean" && (r[2].burstAt === null || typeof r[2].burstAt === "number")) ||
    (r[1] === "match" && typeof r[2].won === "boolean" && typeof r[2].down02 === "boolean" && /^(easy|medium|hard)$/.test(r[2].level) && typeof r[2].p === "number" && typeof r[2].c === "number")), JSON.stringify(reps));
  ck("8.4: every Five trophy is earned on this line", await p.evaluate(() => ["five_round", "five_match", "five_medium", "five_hard", "five_sweep", "five_exact", "five_back"].every(id => window.NumbericsTrophies.has(id))));
  const pr = await p.evaluate(() => ({ g: window.NumbericsProgress.get("five"), r: window.__five.byLevel }));
  ck("3.5: progress put: Won/lost per level kept (Medium 1-0, Hard 1-0), no live run after the match", pr.g && pr.g.live === false &&
    pr.r.medium.won === 1 && pr.r.hard.won === 1 && pr.g.best === (pr.r.easy.won || pr.r.easy.lost ? "Won " + pr.r.easy.won + ", lost " + pr.r.easy.lost : ""), JSON.stringify(pr));
  await p.click("#again"); await idle(p);
  await forge(p, { tiles: [2, 1, 1, 1] }); await slot(p, 0).click(); await slot(p, 2).click(); await idle(p);
  const pr2 = await p.evaluate(() => window.NumbericsProgress.get("five"));
  ck("3.5: a match you have played in is live, with a short line", pr2.live === true && /^Round \d+, \d-\d$/.test(pr2.liveText), JSON.stringify(pr2));
  ck("no page errors (trophies)", e8.length === 0, e8.join("|"));
  await ctx.close();

  // 10. reduced motion: via the OS, via the setting; and Full beats the OS
  const probe = (p) => p.evaluate(async () => {
    window.__five.state = Object.assign(JSON.parse(JSON.stringify(window.__five.state)), { tiles: [4, 1, 2, 1], turn: "p", roundOver: null, matchOver: null, shield: null, midTurn: false, prev: null, seen: {}, quiet: 0 });
    window.__five.tap(0); window.__five.tap(2);
    const fly = document.querySelectorAll("#fx .fly").length;
    await new Promise(r => setTimeout(r, 40));
    const g = document.querySelector("#fx .ghost"), ga = g ? g.getAnimations() : [];
    const moving = document.getAnimations().filter(a => a.effect && a.effect.getKeyframes().some(k => k.transform && k.transform !== "none"))
      .map(a => (a.effect.target && a.effect.target.className) + ":" + (a.animationName || a.transitionProperty || "waapi")).join(",");
    return { fly, shards: document.querySelectorAll("#fx .shard").length, moving, gfade: ga.length ? ga[0].effect.getTiming().duration : -1, tiles: window.__five.state.tiles };
  });
  [ctx, p] = await seen({ reducedMotion: "reduce" }); const e10 = []; p.on("pageerror", e => e10.push(e.message));
  await go(p); await idle(p);
  let rm = await probe(p);
  ck("reduced via the OS: no flight, no shards, no transform; the burst is one fade <= 160 ms", rm.fly === 0 && rm.shards === 0 && !rm.moving && rm.gfade > 0 && rm.gfade <= 160 && rm.tiles[2] === 0, JSON.stringify(rm));
  await idle(p);
  await p.evaluate(() => window.NumbericsSettings.set({ motion: "full" }));
  rm = await probe(p);
  ck("Motion Full beats the OS: the copy flies", rm.fly === 1, JSON.stringify(rm));
  ck("no page errors (reduced OS)", e10.length === 0, e10.join("|"));
  await ctx.close();
  [ctx, p] = await seen(); const e11 = []; p.on("pageerror", e => e11.push(e.message));
  await go(p); await idle(p);
  await p.evaluate(() => window.NumbericsSettings.set({ motion: "reduced" }));
  rm = await probe(p);
  ck("reduced via the setting (Motion Less): no flight, no shards, no transform", rm.fly === 0 && rm.shards === 0 && !rm.moving && rm.tiles[2] === 0, JSON.stringify(rm));
  ck("no page errors (reduced setting)", e11.length === 0, e11.join("|"));
  await ctx.close();

  // 11. budgets (REDESIGN.md 10) over a scripted 60-move session: frames, effect nodes, memory
  [ctx, p] = await seen({ viewport: { width: 1280, height: 900 } }); const e12 = []; p.on("pageerror", e => e12.push(e.message));
  await go(p); await idle(p);
  const sess = await p.evaluate(async () => {
    const F = window.__five, sleep = ms => new Promise(r => setTimeout(r, ms));
    const frames = []; let last = performance.now(), stop = false, maxExtra = 0, maxFx = 0;
    const live = () => F.state.tiles.filter(v => v > 0).length;
    function raf(t) {
      frames.push(t - last); last = t;
      maxExtra = Math.max(maxExtra, document.querySelectorAll("#board .tile").length - live());
      maxFx = Math.max(maxFx, document.getElementById("fx").children.length);
      if (!stop) requestAnimationFrame(raf);
    }
    let made = 0, nodes10 = 0, guard = 0;
    const t0 = performance.now(); requestAnimationFrame(raf);
    while (made < 60 && guard++ < 4000) {
      const s = F.state;
      if (s.roundOver) {
        if (F.holding || F.viewing) F.tap(0);
        else if (!F.busy) document.getElementById("again").click();
        await sleep(30); continue;
      }
      if (s.turn === "p" && !F.busy) {
        const m0 = s.moves, ms = window.NumbericsFive.legalMoves(s);
        if (!ms.length) F.tap(s.tiles[0] ? 0 : 1); else { const mv = ms[made % ms.length]; F.tap(mv.from); F.tap(mv.to); }
        if (F.state.moves > m0) made++;
        if (made === 10) nodes10 = document.getElementsByTagName("*").length;
      }
      await sleep(25);
    }
    await sleep(700); stop = true;
    const fr = frames.slice(3).sort((a, b) => a - b);
    return { made, ms: Math.round(performance.now() - t0), n: fr.length, p95: fr[Math.floor(fr.length * 0.95)], worst: fr[fr.length - 1], over20: fr.filter(x => x > 20).length,
      maxExtra, maxFx, nodes10, nodesEnd: document.getElementsByTagName("*").length, fxEnd: document.getElementById("fx").children.length };
  });
  console.log("  five session: " + sess.made + " player moves in " + sess.ms + " ms, " + sess.n + " frames, p95 " + (sess.p95 || 0).toFixed(2) + " ms, worst " + (sess.worst || 0).toFixed(1) +
    " ms, >20 ms: " + sess.over20 + ", max extra tile nodes " + sess.maxExtra + ", max fx nodes " + sess.maxFx + ", DOM " + sess.nodes10 + " -> " + sess.nodesEnd);
  ck("10: a 60-move session plays through", sess.made >= 60, JSON.stringify(sess));
  ck("10: frame p95 <= 16.7 ms desktop (0.8 ms vsync jitter allowed, as the motion probe)", sess.p95 <= 17.5, JSON.stringify(sess));
  ck("10: frames over 20 ms at most 2%", sess.over20 <= Math.ceil(sess.n * 0.02), JSON.stringify(sess));
  ck("10: tile nodes <= tiles on board + 8 at every frame (the copy and the ghost)", sess.maxExtra <= 8, JSON.stringify(sess));
  ck("10: effect nodes bounded (copy + ghost + 8 shards) and cleaned up", sess.maxFx <= 10 && sess.fxEnd <= 1, JSON.stringify(sess));
  ck("10: DOM nodes after the session within +5% of after 10 moves", sess.nodesEnd <= sess.nodes10 * 1.05, JSON.stringify(sess));
  ck("no page errors (session)", e12.length === 0, e12.join("|"));
  await ctx.close();
};
