/* SPDX-License-Identifier: Apache-2.0 | Copyright 2026 alvations (Melon Lab)
 * Browser checks for Nine. Run: NODE_PATH=$(npm root -g) node tests/emu/run.cjs nine */
"use strict";
module.exports = async function ({ browser, url, ck, shot }) {
  const page = url + "nine/";
  const S = (p) => p.evaluate(() => window.__nine.state);
  const forge = (p, o) => p.evaluate((o) => {
    const s = window.__nine.state;
    Object.assign(s, { roundOver: null, matchOver: null, runOver: false, turn: "you", added: false, acted: false, lastTurn: null, prev: null }, o.s || {});
    if (o.heaps) { s.heaps = o.heaps; s.level = o.heaps.length; }
    if (o.you) Object.assign(s.power.you, o.you);
    window.__nine.state = s;
  }, o);
  const cpuDone = (p) => p.waitForFunction(() => window.__nine.state.turn === "you" || window.__nine.state.roundOver, null, { timeout: 4000 });

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
  ck("restart says New game (R11)", (await p.textContent("#new")) === "New game");
  ck("disabled Take is the calm style, not gold", await p.evaluate(() => getComputedStyle(document.getElementById("take")).backgroundColor !== getComputedStyle(document.querySelector(".btn.primary:not(:disabled)") || document.body).backgroundColor && document.getElementById("take").disabled));
  // R5: an empty tray button explains itself in the hint line, by tap and by key
  await p.locator("#tray .pw").nth(1).click({ force: true });
  ck("tapping an empty power-up explains it (R5)", /^Add: Add 1 to any tile.*Win a round to earn one\.$/.test(await p.textContent("#hint")), await p.textContent("#hint"));
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
  await p.locator('.heap[data-i="2"] .pips i[data-k="4"]').click(); // pip 5 of 7: take 3, leaving 4
  ck("tapping a pip sets the amount", (await p.textContent("#amount")).includes("Take 3 from the 7"));
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
  await forge(p, { heaps: [1, 2, 3], you: { pass: 1, undo: 1 } });
  await p.keyboard.press("3");
  s = await S(p);
  ck("pass skips the turn", s.turn === "cpu" && s.power.you.pass === 0 && JSON.stringify(s.heaps) === "[1,2,3]");
  await cpuDone(p);
  await p.keyboard.press("1");
  s = await S(p);
  ck("undo rewinds the pass and the reply", s.turn === "you" && JSON.stringify(s.heaps) === "[1,2,3]" && s.power.you.pass === 1 && s.power.you.undo === 0);

  // R1: a lost round cannot be undone, and no screen offers it
  await forge(p, { heaps: [0, 0, 2], you: { undo: 1 } });
  await p.locator('.heap[data-i="2"]').click(); await p.click("#take"); // leaves 1: the computer takes the last
  await cpuDone(p);
  ck("round lost by the computer's last take", (await p.textContent("#over-title")) === "Round lost");
  ck("lost round card: summary line, no Undo offer", /^You 0-1 Computer · first to 3$/.test(await p.textContent("#over-text")) && !/Undo/.test(await p.textContent("#over")));
  await p.keyboard.press("1");
  s = await S(p);
  ck("undo after a lost round does nothing and says why (R1)", s.roundOver === "cpu" && s.power.you.undo === 1 && /Not after a round ends/.test(await p.textContent("#hint")));
  await p.click("#again");

  // 4. round end, match end, misere unlock, learn view
  await forge(p, { heaps: [0, 4, 0], s: { score: { you: 0, cpu: 0 }, round: 1 } });
  await p.locator('.heap[data-i="1"] .pips i[data-k="0"]').click(); await p.click("#take");
  ck("last take wins the round", await p.isVisible("#over") && (await p.textContent("#over-title")) === "Round won");
  await shot(p, "round");
  await p.click("#again");
  s = await S(p);
  ck("next round deals fresh tiles", s.round === 2 && !s.roundOver && s.heaps.every(v => v > 0));
  await forge(p, { heaps: [0, 0, 2], s: { score: { you: 2, cpu: 1 } } });
  await p.focus("#board"); await p.keyboard.press("ArrowRight"); await p.keyboard.press("ArrowDown"); await p.keyboard.press("Enter");
  ck("three rounds win the match", (await p.textContent("#over-title")) === "Match won");
  ck("match card: summary line and New best (R8)", /^Won 3-\d · 3 tiles$/.test(await p.textContent("#over-text")) && await p.isVisible("#over-best") && (await p.textContent("#over-best")) === "New best.");
  ck("headline fits one line at 375px", await p.evaluate(() => { const h = document.getElementById("over-title"); return h.getBoundingClientRect().height < parseFloat(getComputedStyle(h).fontSize) * 1.6; }));
  await shot(p, "match");
  ck("misere unlocks after the first win", await p.isVisible("#misere"));
  await p.click("#again");
  ck("a won match adds a tile", (await S(p)).heaps.length === 4 && (await p.textContent("#tiles")) === "4");
  await p.click("#misere"); await p.click("#misere");
  s = await S(p);
  ck("misere starts a new run", s.misere && s.level === 3 && /last take loses/.test(await p.textContent("#hint")));
  await forge(p, { heaps: [0, 1, 0] });
  await p.locator('.heap[data-i="1"]').click(); await p.click("#take");
  ck("misere: the last take loses", (await p.textContent("#over-title")) === "Round lost" && (await S(p)).score.cpu === 1);
  await p.click("#learn-btn");
  ck("learn view shows binary and the nim-sum", await p.isVisible("#learn") && /Nim-sum \d{4}/.test(await p.textContent("#learn")));
  ck("learn says the goal plainly: leave a nim-sum of 0", /leave a nim-sum of 0/.test(await p.textContent("#learn")));
  await forge(p, { heaps: [9, 8, 7, 6, 5, 4, 3, 2, 1] });
  ck("nine tiles fit with binary labels", await p.locator(".heap .bin").count() === 9 && await p.evaluate(() => document.documentElement.scrollWidth <= 375));
  await shot(p, "learn");
  await forge(p, { heaps: [0, 0, 1], s: { score: { you: 0, cpu: 2 } } });
  await p.locator('.heap[data-i="2"]').click(); await p.click("#take");
  ck("losing the match ends the run", (await p.textContent("#over-title")) === "Run over");
  ck("run over card: summary, New game, no Undo offer", /^Lost \d-3 · 3 tiles$/.test(await p.textContent("#over-text")) && (await p.textContent("#again")) === "New game" && !/Undo/.test(await p.textContent("#over")));
  await shot(p, "runover");
  await p.click("#again");
  ck("new run after a loss", (await S(p)).score.you === 0 && !(await S(p)).matchOver);
  await p.locator(".heap.tile").first().click(); await p.click("#take"); await cpuDone(p);
  await p.click('#diff button[data-diff="hard"]');
  ck("difficulty change is two-step mid-run, the button says Sure? (R10)", (await S(p)).diff !== "hard" && (await p.textContent('#diff button[data-diff="hard"]')) === "Sure?");
  await p.click('#diff button[data-diff="hard"]');
  ck("difficulty switches to hard", (await S(p)).diff === "hard" && (await p.textContent('#diff button[data-diff="hard"]')) === "Hard");
  ck("Hard Learn: no live nim-sum, and it says so (R4)", !/Nim-sum \d/.test(await p.textContent("#learn")) && /Hard shows no live nim-sum \(Easy and Medium do\)/.test(await p.textContent("#learn")) && await p.locator(".heap .bin").count() > 0);
  // F9: a focused tile and the selected tile look different
  await forge(p, { heaps: [3, 4, 5] });
  await p.locator('.heap[data-i="1"]').click();
  await p.focus("#board"); await p.keyboard.press("Tab"); // focus lands on tile 0, tile 1 stays selected
  const rings = await p.evaluate(() => { const a = document.querySelector(".heap.sel"), f = document.activeElement; const g = (e) => { const c = getComputedStyle(e); return c.outlineStyle + c.outlineColor + c.boxShadow; }; return { sel: g(a), foc: f && f.classList.contains("heap") && !f.classList.contains("sel") ? g(f) : null }; });
  ck("focus ring and selection ring differ (F9)", rings.foc && rings.foc !== rings.sel, JSON.stringify(rings));
  await p.keyboard.press("Escape");
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
