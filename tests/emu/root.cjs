/* SPDX-License-Identifier: Apache-2.0 | Copyright 2026 alvations (Melon Lab)
 * Browser checks for C1 (docs/design/REDESIGN.md 3.1, 3.3, 3.4, 4.2): the root page is Two, a saved Endless game
 * (numberics_endless_v1) loads unchanged, the cards and the Today card sit beside or below the board, the Games sheet
 * lists every game in games.json order on every page, cards read NumbericsProgress, and /two/ reaches the root.
 * Run: NODE_PATH=$(npm root -g) node tests/emu/run.cjs root */
"use strict";
const fs = require("fs"), path = require("path");
const SEEN = JSON.stringify({ v: 1, games: {}, howto: { fibonacci: true, two: true, three: true, four: true, five: true, six: true, seven: true, nine: true, fifteen: true, sudoku: true }, daily: {} });
// first-visit how-to sheets would cover the page: these checks start as a returning player
async function newCtx(browser, opts) {
  const c = await browser["newContext"](opts);
  await c.addInitScript(seen => { try { if (!localStorage.getItem("numberics_progress_v1")) localStorage.setItem("numberics_progress_v1", seen); } catch (e) { /* none */ } }, SEEN);
  return c;
}
// a first-visit sheet (a game's how-to opens by itself once) is closed generically, whatever its id: wait two frames for
// a sheet a page opens after load, then close whichever is open
const closeSheets = (p) => p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => {
  if (window.NumbericsUI && NumbericsUI.open()) NumbericsUI.close(); r(); }))));
module.exports = async function ({ browser, url, ck, shot }) {
  const games = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "..", "games.json"), "utf8")).filter(g => g.status === "live");
  const ORDER = games.map(g => g.id);
  const noHScroll = p => p.evaluate(() => document.documentElement.scrollWidth <= innerWidth);

  // 1. back-compat: a game saved under the old key (shape {state, bestScore, bestTop, bestBefore}) loads on / unchanged
  const SAVED = { bestScore: 2400, bestTop: 9, bestBefore: 2400,
    state: { size: 4, grid: [1, 2, 3, 4, 5, 6, 7, 8, 0, 0, 0, 0, 1, 0, 0, 2], score: 1136, top: 8, moves: 40, seed: 12345,
      over: false, power: { undo: 1, smash: 2, swap: 0, boost: 1 }, prev: null, free: false, marks: new Array(16).fill(0) } };
  let ctx = await newCtx(browser, { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await ctx.addInitScript(s => { try { if (!sessionStorage.getItem("seeded")) { localStorage.clear(); localStorage.setItem("numberics_endless_v1", s); localStorage.setItem("numberics_progress_v1", '{"v":1,"games":{},"howto":{"fibonacci":true,"two":true,"three":true,"four":true,"five":true,"six":true,"seven":true,"nine":true,"fifteen":true,"sudoku":true},"daily":{}}'); sessionStorage.setItem("seeded", "1"); } } catch (e) { /* none */ } }, JSON.stringify(SAVED));
  let p = await ctx.newPage(); const errs = [], ext = [];
  p.on("pageerror", e => errs.push(e.message)); p.on("request", r => { if (!r.url().startsWith(url)) ext.push(r.url()); });
  await p.goto(url);
  const st = await p.evaluate(() => window.__numberics.state);
  ck("old key: the saved grid, score, moves and power-ups load unchanged on /",
    JSON.stringify(st.grid) === JSON.stringify(SAVED.state.grid) && st.score === 1136 && st.moves === 40 && st.seed === 12345 &&
    JSON.stringify(st.power) === JSON.stringify(SAVED.state.power), JSON.stringify(st));
  ck("old key: the saved best shows", (await p.textContent("#best")).replace(/\D/g, "") === "2400", await p.textContent("#best"));
  ck("old key: the saved tiles are on the board", await p.locator("#tiles .tile").count() === SAVED.state.grid.filter(Boolean).length);
  ck("the page is Two: title, H1, sub line", (await p.title()) === "Numberics Two" && (await p.textContent("h1")) === "Two" &&
    (await p.textContent(".sub")) === "Every tile is a power of two. No top tile.");
  ck("no Endless anywhere on the page", !/endless/i.test(await p.evaluate(() => document.body.innerText)));

  // 2. the cards below the board on a phone, in games.json order, with previews and tags from progress
  const cards = await p.evaluate(() => [...document.querySelectorAll("#games .card")].map(a => ({ id: a.dataset.id, href: a.getAttribute("href"),
    name: a.querySelector("b").textContent, pv: a.querySelector(".pv").children.length, tags: [...a.querySelectorAll(".tag")].map(t => t.textContent),
    cur: a.getAttribute("aria-current") })));
  ck("root: ten cards in games.json order", JSON.stringify(cards.map(c => c.id)) === JSON.stringify(ORDER), cards.map(c => c.id).join());
  ck("root: every card has a CSS preview and its name", cards.every((c, i) => c.pv > 0 && c.name === games[i].name));
  ck("root: Two is marked Playing (aria-current) and shows the saved best", (() => { const t = cards.find(c => c.id === "two");
    return t && t.cur === "page" && t.tags[0] === "Playing" && t.tags.includes("Best 2,400"); })(), JSON.stringify(cards.find(c => c.id === "two")));
  ck("root: vs-computer tag on Four, Five, Nine and Fifteen only", cards.every(c => c.tags.includes("vs computer") === !!games.find(g => g.id === c.id).vs));
  ck("root: unplayed games say New to you", cards.filter(c => c.id !== "two").every(c => c.tags.includes("New to you")), JSON.stringify(cards.map(c => c.tags)));
  ck("root: card links reach each game", cards.every(c => c.href === (games.find(g => g.id === c.id).path || "./")));
  const lay = await p.evaluate(() => { const r = s => document.querySelector(s).getBoundingClientRect();
    return { board: r("#board").bottom, today: r("#today").top, cards: r("#games").top, ord: r("#today").top < r("#more").top && r("#more").top < r("#games").top,
      foot: document.querySelector(".foot-note").textContent, w: r("#games").width, vw: innerWidth }; });
  ck("phone: Today then the games list sit below the board", lay.today > lay.board && lay.ord, JSON.stringify(lay));
  ck("footer line", lay.foot === "Your scores and trophies stay on this device. Nothing is sent anywhere.");
  ck("phone 390: two card columns", await p.evaluate(() => getComputedStyle(document.getElementById("games")).gridTemplateColumns.split(" ").length === 2));
  const td = await p.evaluate(() => { const t = document.getElementById("today");
    return { when: t.querySelector(".when").textContent, h: t.querySelector("h3").textContent, chips: [...t.querySelectorAll(".chip")].map(c => [c.getAttribute("href"), c.textContent]) }; });
  ck("Today card: date line, title and three Daily chips (Not yet)", /^Today · \S/.test(td.when) && td.h === "Three dailies, the same for everyone" &&
    JSON.stringify(td.chips) === JSON.stringify([["seven/?mode=daily", "SevenNot yet"], ["six/?mode=daily", "SixNot yet"], ["sudoku/?mode=daily", "SudokuNot yet"]]), JSON.stringify(td));
  ck("phone 390: no horizontal scroll", await noHScroll(p));
  await p.evaluate(() => document.getElementById("today").scrollIntoView()); await p.waitForTimeout(100);
  await shot(p, "phone-scrolled");

  // 3. playing writes progress (a move updates Two's summary); a Daily done shows on the chip; a streak shows from 2
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.keyboard.press("ArrowLeft"); await p.keyboard.press("ArrowRight"); await p.waitForTimeout(250);
  const pr = await p.evaluate(() => NumbericsProgress.get("two"));
  ck("a move on Two writes its card summary to progress", pr && pr.live === true && /^Best /.test(pr.best) && /^Score /.test(pr.liveText), JSON.stringify(pr));
  await p.evaluate(() => { NumbericsProgress.put("seven", { best: "Best 579", live: true, liveText: "Score 12" }); NumbericsProgress.daily("seven", "1,204"); });
  await p.reload();
  const c2 = await p.evaluate(() => { const a = document.querySelector('#games .card[data-id="seven"]'); return [...a.querySelectorAll(".tag")].map(t => t.textContent); });
  ck("after playing Seven its card shows Continue and the best, not New to you", JSON.stringify(c2) === '["Continue","Best 579"]', JSON.stringify(c2));
  ck("a finished Daily shows Done on its chip", await p.evaluate(() => { const c = document.querySelector('#today .chip[href^="seven/"]'); return c.classList.contains("done") && c.textContent === "SevenDone · 1,204"; }));

  // 4. the Games sheet from the top bar: Today first, then every game in order; Esc closes and focus returns
  await p.click('#topbar [data-open="games"]'); await p.waitForTimeout(300);
  const sh = await p.evaluate(() => { const s = document.getElementById("sh-games"); if (!s || s.hidden) return null;
    const b = s.querySelector(".sh-body"), r = s.querySelector(".sheet").getBoundingClientRect();
    return { first: b.firstElementChild.className, ids: [...b.querySelectorAll(".card")].map(a => a.dataset.id), pv: [...b.querySelectorAll(".card .pv")].filter(x => x.children.length).length,
      title: s.querySelector("h2").textContent, open: NumbericsUI.current(), fixed: getComputedStyle(s).position, top: r.top, bottom: r.bottom }; });
  ck("Games sheet opens from the top bar", sh && sh.open === "games" && sh.title === "Games" && sh.fixed === "fixed", JSON.stringify(sh));
  ck("Games sheet: Today first, then ten cards in games.json order with previews", sh && sh.first.indexOf("today") >= 0 && JSON.stringify(sh.ids) === JSON.stringify(ORDER) && sh.pv === 10, JSON.stringify(sh));
  ck("Games sheet: no horizontal scroll", await noHScroll(p));
  await shot(p, "sheet-games");
  const mv = await p.evaluate(() => window.__numberics.state.moves);
  await p.keyboard.press("ArrowUp");
  ck("Games sheet: arrow keys do not move tiles while it is open", await p.evaluate(m => window.__numberics.state.moves === m, mv));
  await p.keyboard.press("Escape"); await p.waitForTimeout(50);
  ck("Games sheet: Esc closes it and focus returns to the Games button", await p.evaluate(() => !NumbericsUI.open() && document.activeElement && document.activeElement.getAttribute("data-open") === "games"));
  ck("no page errors and no external requests on /", errs.length === 0 && ext.length === 0, errs.concat(ext).join(" | "));
  await ctx.close();

  // 5. widths: no horizontal scroll at 375 and 320; desktop puts Today and the cards beside the board
  for (const w of [375, 320]) {
    ctx = await newCtx(browser, { viewport: { width: w, height: 760 } }); p = await ctx.newPage();
    await p.goto(url);
    ck("phone " + w + ": no horizontal scroll, cards in two columns", await noHScroll(p) &&
      await p.evaluate(() => getComputedStyle(document.getElementById("games")).gridTemplateColumns.split(" ").length === 2));
    await p.evaluate(() => document.getElementById("today").scrollIntoView()); await shot(p, "phone-" + w);
    await ctx.close();
  }
  ctx = await newCtx(browser, { viewport: { width: 1280, height: 860 } }); p = await ctx.newPage();
  await p.goto(url);
  const dk = await p.evaluate(() => { const r = s => document.querySelector(s).getBoundingClientRect();
    return { board: r("#board"), today: r("#today"), games: r("#games"), cols: getComputedStyle(document.getElementById("games")).gridTemplateColumns.split(" ").length }; });
  ck("desktop 1280: Today and the cards sit beside the board, three columns", dk.today.left >= dk.board.right + 40 && dk.today.top < dk.board.bottom && dk.cols === 3, JSON.stringify(dk));
  ck("desktop 1280: no horizontal scroll", await noHScroll(p));
  await shot(p, "desktop");
  await ctx.close();
  ctx = await newCtx(browser, { viewport: { width: 1000, height: 800 } }); p = await ctx.newPage();
  await p.goto(url);
  ck("desktop 1000: the cards beside the board run two columns", await p.evaluate(() => getComputedStyle(document.getElementById("games")).gridTemplateColumns.split(" ").length === 2));
  await ctx.close();

  // 6. the Games sheet on every other page lists the same games in the same order; /two/ reaches the root
  ctx = await newCtx(browser, { viewport: { width: 390, height: 844 } });
  for (const g of games.filter(x => x.path)) {
    p = await ctx.newPage(); const e2 = []; p.on("pageerror", e => e2.push(e.message));
    await p.goto(url + g.path);
    await closeSheets(p); // a first-visit how-to sheet (any game)
    await p.click('#topbar [data-open="games"]'); await p.waitForTimeout(80);
    const r = await p.evaluate(() => { const s = document.getElementById("sh-games"); if (!s || s.hidden) return null;
      return { ids: [...s.querySelectorAll(".card")].map(a => a.dataset.id), cur: (s.querySelector('.card[aria-current="page"]') || {}).dataset,
        two: s.querySelector('.card[data-id="two"]').getAttribute("href") }; });
    ck(g.id + ": the Games sheet lists every game in order and marks this one", r && JSON.stringify(r.ids) === JSON.stringify(ORDER) && r.cur && r.cur.id === g.id && r.two === "../", JSON.stringify(r));
    // the foot of every page is the shared cards (REDESIGN.md 3.2: the old text row is removed): same order, this game current
    const foot = await p.evaluate(() => { const el = document.getElementById("games"); if (!el) return null;
      return { cards: el.classList.contains("cards"), ids: [...el.querySelectorAll(":scope > a.card")].map(a => a.dataset.id),
        cur: [...el.querySelectorAll(':scope > a.card[aria-current="page"]')].map(a => a.dataset.id) }; });
    ck(g.id + ": the games cards at the foot run in the same order and mark this game", foot && foot.cards &&
      JSON.stringify(foot.ids) === JSON.stringify(ORDER) && JSON.stringify(foot.cur) === JSON.stringify([g.id]), JSON.stringify(foot));
    await p.keyboard.press("Escape");
    ck(g.id + ": no page errors", e2.length === 0, e2.join(" | "));
    await p.close();
  }
  await ctx.close();
  // integration: on a fresh start (empty values read "none") the stat pills keep one row at 375 and 390 px, every game
  // (Four and Nine wrapped their last pill alone)
  for (const width of [375, 390]) {
    ctx = await newCtx(browser, { viewport: { width, height: 812 } });
    for (const g of games.filter(x => x.status !== "planned")) {
      p = await ctx.newPage(); await p.goto(url + g.path);
      const rows = await p.evaluate(() => { const st = document.querySelector(".stats"); if (!st) return 1;
        return new Set([...st.children].filter(k => k.offsetParent !== null).map(k => Math.round(k.getBoundingClientRect().top))).size; });
      ck(g.id + " " + width + ": the stat pills sit on one row", rows === 1, rows + " rows");
      await p.close();
    }
    await ctx.close();
  }
  // integration: a game page's own CSS never changes the shared card previews (Five, Six and Seven's .pips rules once
  // ringed and squeezed the Nine card's dots). Sudoku keeps its own CSS copy (its body line-height differs by a pixel).
  // integration: the Today card is drawn after the first paint; its empty box keeps the drawn height, so the desktop
  // root does not shift on load (perf budget loadCls 0.05; it read 0.057 before)
  ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  await ctx.addInitScript(() => { window.__ls = 0; new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__ls += e.value; }).observe({ type: "layout-shift", buffered: true }); });
  p = await ctx.newPage(); await p.goto(url); await p.waitForTimeout(800);
  const ls = await p.evaluate(() => ({ cls: window.__ls, today: document.getElementById("today").getBoundingClientRect().height }));
  ck("desktop root: load layout shift under 0.05 (Today keeps its height)", ls.cls < 0.05 && ls.today >= 146, JSON.stringify(ls));
  await ctx.close();
  ctx = await newCtx(browser, { viewport: { width: 390, height: 844 } });
  const look = (pg) => pg.evaluate(() => { const out = {}; document.querySelectorAll("#games .card .pv").forEach(pv => {
    out[pv.parentElement.dataset.id] = [...pv.querySelectorAll("*")].map(e => { const c = getComputedStyle(e);
      return [c.width, c.height, c.borderTopWidth, c.backgroundColor, c.display, c.opacity, c.margin].join("/"); }).join(";"); }); return out; });
  p = await ctx.newPage(); await p.goto(url); const base = await look(p); await p.close();
  for (const g of games.filter(x => x.path && x.id !== "sudoku")) {
    p = await ctx.newPage(); await p.goto(url + g.path); const here = await look(p);
    const off = Object.keys(base).filter(k => k !== g.id && k !== "two" && here[k] !== base[k]);
    ck(g.id + ": the other games' card previews look as on the root page", off.length === 0, off.join());
    await p.close();
  }
  p = await ctx.newPage();
  await p.goto(url + "two/"); await p.waitForURL(u => !/\/two\/$/.test(u.pathname || String(u)), { timeout: 5000 }).catch(() => null);
  ck("/two/ reaches the root and Two loads", new URL(p.url()).pathname === "/" && (await p.textContent("h1")) === "Two", p.url());
  await ctx.close();
};
