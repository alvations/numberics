/* SPDX-License-Identifier: Apache-2.0 | Copyright 2026 alvations (Melon Lab)
 * Browser checks for Nine. Run: NODE_PATH=$(npm root -g) node tests/emu/run.cjs nine */
"use strict";
module.exports = async function ({ browser, url, ck, shot }) {
  const page = url + "nine/";
  const S = (p) => p.evaluate(() => window.__nine.state);
  const forge = (p, o) => p.evaluate((o) => {
    const s = window.__nine.state;
    Object.assign(s, { roundOver: null, matchOver: null, runOver: false, turn: "you", added: false, acted: false, lastTurn: null, last: null, prev: null, powered: { you: false, cpu: false }, passed: { you: false, cpu: false } }, o.s || {});
    if (o.heaps) { s.heaps = o.heaps; s.level = o.heaps.length; }
    if (o.you) Object.assign(s.power.you, o.you);
    window.__nine.state = s;
  }, o);
  const cpuDone = (p) => p.waitForFunction(() => window.__nine.state.turn === "you" || window.__nine.state.roundOver, null, { timeout: 4000 });
  const card = (p) => p.waitForSelector("#over", { state: "visible", timeout: 4000 }); // R13: the card follows a 1.5 s look at the board

  // 1. loads, a real turn by keyboard, then the computer answers
  let ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2 });
  let p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto(page);
  ck("three tiles on a fresh run", await p.locator(".heap.tile").count() === 3);
  ck("every tile shows its number and its pips", await p.evaluate(() => [...document.querySelectorAll(".heap.tile")].every(t => +t.querySelector(".num").textContent === t.querySelectorAll(".pips i.on").length)));
  ck("no horizontal scroll at 375px", await p.evaluate(() => document.documentElement.scrollWidth <= 375));
  ck("dealt start has a non-zero nim-sum", await p.evaluate(() => window.NumbericsNine.nimSum(window.__nine.state.heaps) !== 0));
  ck("header: H1 Nine, subtitle is the Numberics link plus a tagline (R6)", (await p.textContent("h1")) === "Nine" &&
     /^Numberics · [A-Z][^.]*\.$/.test((await p.textContent(".sub")).trim()) && await p.locator(".sub a").count() === 1);
  ck("empty Best shows a dimmed none (R11)", (await p.textContent("#best")) === "none" && await p.locator("#best.none").count() === 1);
  ck("R16 pills: You, Computer, Record (dimmed none), then Best", JSON.stringify(await p.$$eval(".stat > span", a => a.map(x => x.textContent))) === '["You","Computer","Record","Best"]' &&
     (await p.textContent("#rec")) === "none" && await p.locator("#rec.none").count() === 1);
  ck("how-to discloses the computer's Pass and Add on Hard (R14) and the R2 rule", /On Hard the computer can also\s+Pass and Add\./.test(await p.textContent(".how")) && /unless you used Add, Pass or Peek\s+in it/.test(await p.textContent(".how")));
  ck("three tiles: the panel hugs its row (no 100px of dead space above and below)", await p.evaluate(() => { const b = document.getElementById("board").getBoundingClientRect(), t = document.querySelector(".heap.tile").getBoundingClientRect(); return t.top - b.top < 70 && b.height < b.width * 0.8; }));
  ck("restart says New game (R11)", (await p.textContent("#new")) === "New game");
  ck("disabled Take is the calm style, not gold", await p.evaluate(() => getComputedStyle(document.getElementById("take")).backgroundColor !== getComputedStyle(document.querySelector(".btn.primary:not(:disabled)") || document.body).backgroundColor && document.getElementById("take").disabled));
  // R5: an empty tray button explains itself in the hint line, by tap and by key
  await p.locator("#tray .pw").nth(1).click({ force: true });
  ck("tapping an empty power-up explains it (R5)", /^Add: Add 1 to a tile.*Win a round without Add, Pass or Peek to earn one\.$/.test(await p.textContent("#hint")), await p.textContent("#hint"));
  ck("empty tray buttons are aria-disabled, never disabled", await p.locator('#tray .pw[aria-disabled="true"]').count() >= 3 && await p.locator("#tray .pw:disabled").count() === 0);
  ck("tray tooltip voice: '1: Undo. Take back your last turn.'", (await p.locator("#tray .pw").first().getAttribute("title")) === "1: Undo. Take back your last turn.");
  await p.keyboard.press("1");
  ck("key 1 on an unusable Undo explains why", /^Undo: Take back your last turn\. Nothing to take back/.test(await p.textContent("#hint")), await p.textContent("#hint"));
  const h0 = (await S(p)).heaps;
  await p.focus("#board");
  await p.keyboard.press("ArrowRight"); await p.keyboard.press("ArrowDown");
  const sel = await p.evaluate(() => document.querySelector(".heap.sel") && +document.querySelector(".heap.sel").getAttribute("data-i"));
  await p.keyboard.press("Enter");
  let s = await S(p);
  const expect = h0[sel] >= 2 ? h0[sel] - 2 : 0;
  ck("keyboard take lowers the chosen tile", s.heaps[sel] === expect, JSON.stringify([h0, s.heaps, sel]));
  ck("turn passes to the computer", s.turn === "cpu" || !!s.roundOver);
  await cpuDone(p); s = await S(p);
  ck("the computer moved", s.last && (s.last.who === "cpu" || s.roundOver), JSON.stringify(s.last));
  ck("hint names the computer's move", /Computer|Round|Your/.test(await p.textContent("#hint") + await p.textContent("#over")));

  // 2. a click turn: tap a pip to choose the amount, then Take
  await forge(p, { heaps: [5, 3, 7] });
  await p.locator('.heap[data-i="2"] .pips i[data-k="4"]').click(); // first tap on a tile picks it, take 1 (cold #31)
  ck("the first tap on a tile picks it with a take of 1, even on a pip", (await p.textContent("#amount")).includes("Take 1 from the 7"));
  await p.locator('.heap[data-i="2"] .pips i[data-k="4"]').click(); // pip 5 of 7 on the chosen tile: take 3, leaving 4
  ck("tapping a pip on the chosen tile sets the amount", (await p.textContent("#amount")).includes("Take 3 from the 7"));
  await p.click("#more"); await p.click("#less");
  await p.click("#take");
  ck("click take lowers the tile", (await S(p)).heaps[2] === 4);
  await cpuDone(p);

  // 3. power-ups: Peek, Add, Pass, Undo
  await forge(p, { heaps: [3, 4, 5], you: { undo: 1, add: 1, pass: 1, peek: 1 } });
  await p.keyboard.press("4");
  s = await S(p);
  ck("peek spends a charge", s.power.you.peek === 0);
  ck("peek marks a winning move", await p.locator(".heap.peek.sel").count() === 1 && /Peek: take/.test(await p.textContent("#hint")));
  const pm = await p.evaluate(() => { const st = window.__nine.state, i = +document.querySelector(".heap.sel").getAttribute("data-i"); const h = st.heaps.slice(); const t = +document.querySelector("#amount b").textContent; h[i] -= t; return window.NumbericsNine.nimSum(h); });
  ck("peeked move leaves a zero nim-sum", pm === 0);
  await shot(p, "peek");
  await p.keyboard.press("2");
  ck("add arms targeting", await p.locator("#board.targeting").count() === 1);
  await shot(p, "targeting");
  await p.keyboard.press("Escape");
  ck("escape cancels targeting", await p.locator("#board.targeting").count() === 0);
  await p.keyboard.press("2");
  await p.locator('.heap[data-i="0"]').click();
  s = await S(p);
  ck("add raised the tile by one and kept the turn", s.heaps[0] === 4 && s.turn === "you" && s.power.you.add === 0);
  await forge(p, { heaps: [9, 1, 1], you: { add: 1 } });
  await p.keyboard.press("2"); await p.locator('.heap[data-i="0"]').click();
  ck("add never passes 9", (await S(p)).heaps[0] === 9 && (await S(p)).power.you.add === 1);
  await p.keyboard.press("Escape");
  await forge(p, { heaps: [1, 2, 3], you: { pass: 2, undo: 1 } });
  await p.keyboard.press("3");
  s = await S(p);
  ck("pass skips the turn", s.turn === "cpu" && s.power.you.pass === 1 && JSON.stringify(s.heaps) === "[1,2,3]");
  await cpuDone(p);
  await p.keyboard.press("3");
  ck("Pass is once per round: a second tap explains it", (await S(p)).turn === "you" && /^Pass: .*Once per round\.$/.test(await p.textContent("#hint")), await p.textContent("#hint"));
  await p.keyboard.press("1");
  s = await S(p);
  ck("undo rewinds the pass and the reply", s.turn === "you" && JSON.stringify(s.heaps) === "[1,2,3]" && s.power.you.pass === 2 && s.power.you.undo === 0);

  // R1: a lost round cannot be undone, and no screen offers it
  await forge(p, { heaps: [0, 0, 2], you: { undo: 1 } });
  await p.locator('.heap[data-i="2"]').click(); await p.click("#take"); // leaves 1: the computer takes the last
  await cpuDone(p);
  // R13: the finished board first, undimmed, with the last take as a ghost; then the card
  ck("R13: the card waits while the last take shows", !(await p.isVisible("#over")) && await p.locator(".heap.ghost.by-cpu").count() === 1 && /^Computer took 1 from the 1, gone\./.test(await p.textContent("#hint")), await p.textContent("#hint"));
  await shot(p, "hold");
  await card(p);
  ck("round lost by the computer's last take: 'The computer wins round 1'", (await p.textContent("#over-title")) === "The computer wins round 1", await p.textContent("#over-title"));
  ck("lost round card: '<detail> · <tally>', no Undo offer", (await p.textContent("#over-text")) === "The computer took the last tile · 0-1, first to 3" && !/Undo/.test(await p.textContent("#over")), await p.textContent("#over-text"));
  ck("one end-card pattern: focus on the card's primary button", await p.evaluate(() => document.activeElement && document.activeElement.id === "again"));
  ck("one end-card pattern: the page's New game is hidden, its space kept", await p.evaluate(() => { const n = document.getElementById("new"); return getComputedStyle(n).visibility === "hidden" && n.getBoundingClientRect().height > 20; }));
  await p.keyboard.press("1");
  s = await S(p);
  ck("undo after a lost round does nothing and says why (R1)", s.roundOver === "cpu" && s.power.you.undo === 1 && /Not after a round ends/.test(await p.textContent("#hint")));
  await p.click("#over-view");
  ck("R13: See the board hides the card and says how to get it back", !(await p.isVisible("#over")) && /Tap the board for the summary\./.test(await p.textContent("#hint")));
  await p.click("#board", { position: { x: 20, y: 20 } });
  ck("R13: a tap on the board brings the card back", await p.isVisible("#over"));
  ck("See the board shows New game again only while the card is away (card back: hidden)", await p.evaluate(() => getComputedStyle(document.getElementById("new")).visibility === "hidden"));
  await p.click("#again");

  // R2: a round won after Add pays nothing, and the card says why
  await forge(p, { heaps: [1, 0, 0], you: { add: 1, peek: 0, pass: 0 } });
  const tot0 = await p.evaluate(() => Object.values(window.__nine.state.power.you).reduce((a, b) => a + b, 0));
  await p.keyboard.press("2"); await p.locator('.heap[data-i="0"]').click();
  await p.locator('.heap[data-i="0"]').click(); await p.click("#more"); await p.click("#take"); await card(p);
  ck("R2: a round won after Add pays nothing and says so", /^You win round \d$/.test(await p.textContent("#over-title")) &&
     await p.evaluate(() => Object.values(window.__nine.state.power.you).reduce((a, b) => a + b, 0)) === tot0 - 1 &&
     (await p.textContent("#over-note")) === "No power-up: you used Add, Pass or Peek this round.", await p.textContent("#over-note"));
  await p.click("#again");
  ck("leaving the card shows New game again", await p.evaluate(() => getComputedStyle(document.getElementById("new")).visibility === "visible"));

  // R2 (round 3): Peek counts as help, and the card says so
  await forge(p, { heaps: [0, 2, 0], you: { peek: 1, add: 0, pass: 0 } });
  const tp = await p.evaluate(() => Object.values(window.__nine.state.power.you).reduce((a, b) => a + b, 0));
  await p.keyboard.press("4"); await p.click("#take"); await card(p);
  ck("R2: a round won after Peek pays nothing and says so", await p.evaluate(() => Object.values(window.__nine.state.power.you).reduce((a, b) => a + b, 0)) === tp - 1 &&
     (await p.textContent("#over-note")) === "No power-up: you used Add, Pass or Peek this round.", await p.textContent("#over-note"));
  await p.click("#again");

  // the result holds 1.5 s on the board before the card, when you take last and when the computer does
  const timeCard = (p) => p.evaluate(() => new Promise((res) => { const t0 = performance.now(), o = document.getElementById("over");
    const iv = setInterval(() => { if (!o.hidden) { clearInterval(iv); res(performance.now() - t0); } }, 20); }));
  await forge(p, { heaps: [0, 3, 0], s: { score: { you: 0, cpu: 0 } } });
  await p.locator('.heap[data-i="1"]').click(); await p.click("#more"); await p.click("#more");
  let tc = timeCard(p); await p.click("#take"); let ms = await tc;
  ck("your winning take: the board holds at least 1.5 s before the card", ms >= 1450 && ms < 2600, Math.round(ms) + " ms");
  await p.click("#again");
  await forge(p, { heaps: [0, 0, 2], s: { score: { you: 0, cpu: 0 } } });
  await p.locator('.heap[data-i="2"]').click(); // take 1, leaving 1: the computer takes the last
  let tcpu = p.evaluate(() => new Promise((res) => { const o = document.getElementById("over");
    const iv = setInterval(() => { const s = window.__nine.state; if (s.roundOver && !window.__t0) window.__t0 = performance.now(); if (!o.hidden) { clearInterval(iv); res(performance.now() - window.__t0); } }, 10); }));
  await p.click("#take"); ms = await tcpu;
  ck("the computer's winning take: the board holds at least 1.5 s before the card", ms >= 1450 && ms < 2600, Math.round(ms) + " ms");
  await p.evaluate(() => { delete window.__t0; });
  await p.click("#again");

  // craft #11: status text never pushes the board down (every hint the game can show, at 375 and at 320)
  for (const w of [375, 320]) {
    await p.setViewportSize({ width: w, height: 812 });
    const texts = ["", "Your turn: take from one tile.", "You took 7 from the 7, gone. Tap the board for the summary.",
      "Computer used Add (4 to 5), then took 5 from the 5, gone. Your turn.", "Peek: no winning move here. Add or Pass can change that.",
      "Add: Add 1 to a tile (up to 9), then take. Win a round without Add, Pass or Peek to earn one.",
      "Undo: Take back your last turn. Nothing to take back yet this round.", "Switching now counts as a loss. Tap again to switch.",
      "Pass: Skip your turn (once per round). Win a round without Add, Pass or Peek to earn one.",
      "Peek: Show one winning move, if there is one. Win a round without Add, Pass or Peek to earn one."];
    const tops = await p.evaluate((texts) => texts.map((t) => { document.getElementById("hint").textContent = t; return document.getElementById("board").getBoundingClientRect().top; }), texts);
    ck("status text never moves the board at " + w + "px", tops.every((t) => t === tops[0]), JSON.stringify(tops));
  }
  await p.setViewportSize({ width: 375, height: 812 }); await p.evaluate(() => window.__nine.render());

  // R14: the computer's Pass on Hard is announced in the hint line, not a toast
  await forge(p, { heaps: [1, 2, 3], s: { diff: "hard", turn: "cpu" } });
  await p.evaluate(() => { const s = window.__nine.state; s.power.cpu.pass = 1; window.__nine.state = s; });
  await cpuDone(p);
  ck("R14: the hint line says 'Computer used Pass.'", /^Computer used Pass\. Your turn\./.test(await p.textContent("#hint")) && !(await p.evaluate(() => document.getElementById("toast").classList.contains("on"))), await p.textContent("#hint"));
  await forge(p, { heaps: [1, 2, 3], s: { diff: "medium" } });

  // 4. round end, match end, misere unlock, learn view
  await forge(p, { heaps: [0, 4, 0], s: { score: { you: 0, cpu: 0 }, round: 1 } });
  await p.locator('.heap[data-i="1"]').click(); await p.locator('.heap[data-i="1"] .pips i[data-k="0"]').click(); await p.click("#take"); await card(p);
  ck("last take wins the round", await p.isVisible("#over") && (await p.textContent("#over-title")) === "You win round 1" && (await p.textContent("#over-text")) === "You took the last tile · 1-0, first to 3");
  await shot(p, "round");
  await p.click("#again");
  s = await S(p);
  ck("next round deals fresh tiles", s.round === 2 && !s.roundOver && s.heaps.every(v => v > 0));
  await forge(p, { heaps: [0, 0, 2], s: { score: { you: 2, cpu: 1 } } });
  await p.focus("#board"); await p.keyboard.press("ArrowRight"); await p.keyboard.press("ArrowDown"); await p.keyboard.press("Enter");
  await p.waitForTimeout(350); await p.keyboard.press("Enter"); // Enter during the R13 look shows the card at once (not the take's own Enter)
  ck("Enter during the look brings the card up", await p.isVisible("#over"));
  ck("three rounds win the match: 'You win'", (await p.textContent("#over-title")) === "You win");
  ck("match card: summary line and New best (R8)", /^Match won 3-\d · 3 tiles$/.test(await p.textContent("#over-text")) && await p.isVisible("#over-best") && (await p.textContent("#over-best")) === "New best.");
  ck("headline fits one line at 375px", await p.evaluate(() => { const h = document.getElementById("over-title"); return h.getBoundingClientRect().height < parseFloat(getComputedStyle(h).fontSize) * 1.6; }));
  await shot(p, "match");
  ck("misere unlocks after the first win", await p.isVisible("#misere"));
  await p.click("#again");
  ck("a won match adds a tile", (await S(p)).heaps.length === 4);
  ck("Record counts the won match (R16)", (await p.textContent("#rec")) === "1-0");
  await p.click("#misere"); await p.click("#misere");
  s = await S(p);
  ck("misere starts a new run", s.misere && s.level === 3 && /last take loses/.test(await p.textContent("#hint")));
  await forge(p, { heaps: [0, 1, 0] });
  await p.locator('.heap[data-i="1"]').click(); await p.click("#take"); await card(p);
  ck("misere: the last take loses", /^The computer wins round \d$/.test(await p.textContent("#over-title")) && /^You took the last tile · /.test(await p.textContent("#over-text")) && (await S(p)).score.cpu === 1);
  await p.click("#learn-btn");
  ck("learn view shows binary and the nim-sum", await p.isVisible("#learn") && /Nim-sum \d{4}/.test(await p.textContent("#learn")));
  ck("learn says the goal plainly: leave a nim-sum of 0", /leave a nim-sum of 0/.test(await p.textContent("#learn")));
  ck("learn opens with one plain sentence before any binary (cold #30)", await p.evaluate(() => { const f = document.querySelector("#learn > span"); return f.className === "plain" && /^Aim to leave the tiles balanced/.test(f.textContent) && !/binary|nim-sum|[01]{4}/i.test(f.textContent); }));
  await forge(p, { heaps: [9, 8, 7, 6, 5, 4, 3, 2, 1] });
  ck("nine tiles fit with binary labels", await p.locator(".heap .bin").count() === 9 && await p.evaluate(() => document.documentElement.scrollWidth <= 375));
  await shot(p, "learn");
  await forge(p, { heaps: [0, 0, 1], s: { score: { you: 0, cpu: 2 } } });
  await p.locator('.heap[data-i="2"]').click(); await p.click("#take"); await card(p);
  ck("losing the match ends the run: 'The computer wins' and the note says what a run is", (await p.textContent("#over-title")) === "The computer wins" && /^Run over: the next run starts again at 3 tiles\. Best: /.test(await p.textContent("#over-note")));
  ck("run over card: summary, New game, no Undo offer", /^Match lost \d-3 · 3 tiles$/.test(await p.textContent("#over-text")) && (await p.textContent("#again")) === "New game" && !/Undo/.test(await p.textContent("#over")));
  await shot(p, "runover");
  await p.click("#again");
  ck("new run after a loss", (await S(p)).score.you === 0 && !(await S(p)).matchOver);
  await p.locator(".heap.tile").first().click(); await p.click("#take"); await cpuDone(p);
  await p.click('#diff button[data-diff="hard"]');
  ck("difficulty change is two-step mid-run, the button says Sure? (R10) and the hint says it counts as a loss (R12)", (await S(p)).diff !== "hard" && (await p.textContent('#diff button[data-diff="hard"]')) === "Sure?" &&
     /counts as a loss/.test(await p.textContent("#hint")));
  const rec0 = await p.evaluate(() => window.__nine.record.lost);
  await p.click('#diff button[data-diff="hard"]');
  ck("R12: switching level after a move records a lost match", await p.evaluate(() => window.__nine.record.lost) === rec0 + 1);
  ck("difficulty switches to hard", (await S(p)).diff === "hard" && (await p.textContent('#diff button[data-diff="hard"]')) === "Hard");
  ck("Hard Learn: no live nim-sum, and it says so (R4)", !/Nim-sum \d/.test(await p.textContent("#learn")) && /Hard shows no live nim-sum \(Easy and Medium do\)/.test(await p.textContent("#learn")) && await p.locator(".heap .bin").count() > 0);
  // F9: a focused tile and the selected tile look different
  await forge(p, { heaps: [3, 4, 5] });
  await p.locator('.heap[data-i="1"]').click();
  await p.focus("#board"); await p.keyboard.press("Tab"); // focus lands on tile 0, tile 1 stays selected
  const rings = await p.evaluate(() => { const a = document.querySelector(".heap.sel"), f = document.activeElement; const g = (e) => { const c = getComputedStyle(e); return c.outlineStyle + c.outlineColor + c.boxShadow; }; return { sel: g(a), foc: f && f.classList.contains("heap") && !f.classList.contains("sel") ? g(f) : null }; });
  ck("focus ring and selection ring differ (F9)", rings.foc && rings.foc !== rings.sel, JSON.stringify(rings));
  await p.keyboard.press("Escape");
  // R12 on New game: the button says so, the loss is recorded; before any move nothing is recorded
  await p.locator(".heap.tile").first().click(); await p.click("#take"); await cpuDone(p);
  if (!(await S(p)).roundOver) {
    await p.click("#new");
    ck("R12: New game after a move says 'Sure? Counts as a loss'", (await p.textContent("#new")) === "Sure? Counts as a loss");
    const l0 = await p.evaluate(() => window.__nine.record.lost);
    await p.click("#new");
    ck("R12: confirming records the loss", await p.evaluate(() => window.__nine.record.lost) === l0 + 1 && (await p.textContent("#new")) === "New game");
    const l1 = await p.evaluate(() => window.__nine.record.lost);
    await p.click("#new");
    ck("R12: a fresh run quits without a loss or a prompt", await p.evaluate(() => window.__nine.record.lost) === l1 && (await p.textContent("#new")) === "New game");
  } else await p.click("#again");
  // R17: Enter on a focused games-row link navigates
  await p.focus('#games a[href]');
  const before = p.url();
  await Promise.all([p.waitForURL(u => u.toString() !== before, { timeout: 4000 }).catch(() => {}), p.keyboard.press("Enter")]);
  ck("R17: Enter on a focused games-row link navigates", p.url() !== before, p.url());
  await p.goto(page);
  const moves = (await S(p)).ply;
  await p.reload();
  ck("state survives reload", (await S(p)).ply === moves && (await S(p)).diff === "hard");
  ck("no page errors", errs.length === 0, errs.join("|"));
  await ctx.close();

  // 5. storage blocked: still plays
  ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
  p = await ctx.newPage(); const e2 = []; p.on("pageerror", e => e2.push(e.message));
  await p.addInitScript(() => { Object.defineProperty(window, "localStorage", { get() { throw new Error("blocked"); } }); });
  await p.goto(page);
  await p.locator(".heap.tile").first().click(); await p.click("#take");
  ck("runs with storage blocked", e2.length === 0 && (await S(p)).ply > 0, e2.join("|"));
  await ctx.close();

  // 6. reduced motion: still plays, the computer still answers
  ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, reducedMotion: "reduce" });
  p = await ctx.newPage(); const e3 = []; p.on("pageerror", e => e3.push(e.message));
  await p.goto(page);
  await p.focus("#board"); await p.keyboard.press("ArrowRight"); await p.keyboard.press("Enter");
  await cpuDone(p);
  ck("reduced motion plays a full turn", (await S(p)).ply >= 2 || !!(await S(p)).roundOver);
  ck("no animations under reduced motion", await p.evaluate(() => [...document.querySelectorAll(".heap")].every(h => getComputedStyle(h).animationName === "none")));
  ck("no page errors (reduced motion)", e3.length === 0, e3.join("|"));
  await ctx.close();
};
