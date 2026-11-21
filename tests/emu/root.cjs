/* SPDX-License-Identifier: Apache-2.0 | Copyright 2026 alvations (Melon Lab)
 * Browser checks for O-9 (and C1, docs/design/REDESIGN.md 3.1, 3.3, 3.4, 4.2): the root is the games page (the top bar,
 * Today, the cards, the foot line; no board, nothing marked Playing), Two has its own page at /two/ like the other
 * games, a saved Endless game (numberics_endless_v1) loads there unchanged, the Games sheet and the cards list every
 * game in games.json order on every page, every list links Two to two/, cards read NumbericsProgress, and the home link
 * on every page reaches the games page.
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
  const cardsOf = (p, sel) => p.evaluate(s => [...document.querySelectorAll(s)].map(a => ({ id: a.dataset.id, href: a.getAttribute("href"),
    name: a.querySelector("b").textContent, pv: a.querySelector(".pv").children.length, tags: [...a.querySelectorAll(".tag")].map(t => t.textContent),
    cur: a.getAttribute("aria-current") })), sel);

  // 1. back-compat: a game saved under the old key (shape {state, bestScore, bestTop, bestBefore}) loads on /two/ unchanged
  const SAVED = { bestScore: 2400, bestTop: 9, bestBefore: 2400,
    state: { size: 4, grid: [1, 2, 3, 4, 5, 6, 7, 8, 0, 0, 0, 0, 1, 0, 0, 2], score: 1136, top: 8, moves: 40, seed: 12345,
      over: false, power: { undo: 1, smash: 2, swap: 0, boost: 1 }, prev: null, free: false, marks: new Array(16).fill(0) } };
  let ctx = await newCtx(browser, { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await ctx.addInitScript(s => { try { if (!sessionStorage.getItem("seeded")) { localStorage.clear(); localStorage.setItem("numberics_endless_v1", s); localStorage.setItem("numberics_progress_v1", '{"v":1,"games":{},"howto":{"fibonacci":true,"two":true,"three":true,"four":true,"five":true,"six":true,"seven":true,"nine":true,"fifteen":true,"sudoku":true},"daily":{}}'); sessionStorage.setItem("seeded", "1"); } } catch (e) { /* none */ } }, JSON.stringify(SAVED));
  let p = await ctx.newPage(); const errs = [], ext = [];
  p.on("pageerror", e => errs.push(e.message)); p.on("request", r => { if (!r.url().startsWith(url)) ext.push(r.url()); });
  await p.goto(url + "two/");
  const st = await p.evaluate(() => window.__numberics.state);
  ck("old key: the saved grid, score, moves and power-ups load unchanged on /two/",
    JSON.stringify(st.grid) === JSON.stringify(SAVED.state.grid) && st.score === 1136 && st.moves === 40 && st.seed === 12345 &&
    JSON.stringify(st.power) === JSON.stringify(SAVED.state.power), JSON.stringify(st));
  ck("old key: the saved best shows", (await p.textContent("#best")).replace(/\D/g, "") === "2400", await p.textContent("#best"));
  ck("old key: the saved tiles are on the board", await p.locator("#tiles .tile").count() === SAVED.state.grid.filter(Boolean).length);
  ck("/two/ is Two: title, H1, sub line", (await p.title()) === "Numberics Two" && (await p.textContent("h1")) === "Two" &&
    (await p.textContent(".sub")) === "Every tile is a power of two. No top tile.");
  ck("no Endless anywhere on Two's page", !/endless/i.test(await p.evaluate(() => document.body.innerText)));

  // 2. Two's page is a game page like the rest: More number games under the board, Two marked Playing with its best
  const tc = await cardsOf(p, "#games .card");
  ck("two: ten cards in games.json order under More number games", JSON.stringify(tc.map(c => c.id)) === JSON.stringify(ORDER) &&
    await p.evaluate(() => { const m = document.querySelector("section.more"); return !!m && m.querySelector("h2").textContent === "More number games" && m.contains(document.getElementById("games")); }), tc.map(c => c.id).join());
  ck("two: Two is marked Playing (aria-current) and shows the saved best", (() => { const t = tc.find(c => c.id === "two");
    return t && t.cur === "page" && t.tags[0] === "Playing" && t.tags.includes("Best 2,400"); })(), JSON.stringify(tc.find(c => c.id === "two")));
  ck("two: card links reach each game from two/", tc.every(c => c.href === "../" + games.find(g => g.id === c.id).path), JSON.stringify(tc.map(c => c.href)));
  ck("two: the cards sit below the board, no Today card, no side column", await p.evaluate(() => document.getElementById("games").getBoundingClientRect().top > document.getElementById("board").getBoundingClientRect().bottom &&
    !document.getElementById("today") && !document.querySelector(".side, .layout")));
  ck("two: the top bar's mark goes home, to the games page", await p.evaluate(() => document.querySelector("#topbar .tb-home").getAttribute("href") === "../"));
  // playing writes progress (a move updates Two's summary)
  await p.keyboard.press("ArrowLeft"); await p.keyboard.press("ArrowRight"); await p.waitForTimeout(250);
  const pr = await p.evaluate(() => NumbericsProgress.get("two"));
  ck("a move on Two writes its card summary to progress", pr && pr.live === true && /^Best /.test(pr.best) && /^Score /.test(pr.liveText), JSON.stringify(pr));
  await shot(p, "two-phone");

  // 3. the root is the games page: Today, the heading, ten cards, the foot line; no board; nothing marked Playing
  await Promise.all([p.waitForURL(u => new URL(String(u)).pathname === "/", { timeout: 5000 }).catch(() => null), p.click("#topbar .tb-home")]);
  ck("the home mark on Two reaches the root", new URL(p.url()).pathname === "/", p.url());
  ck("root: the games page title, and no game on it", (await p.title()) === "Numberics" &&
    await p.evaluate(() => !document.getElementById("board") && !document.getElementById("tray") && !document.getElementById("score") && !document.querySelector("details.how") && !window.__numberics));
  const cards = await cardsOf(p, "#games .card");
  ck("root: ten cards in games.json order", JSON.stringify(cards.map(c => c.id)) === JSON.stringify(ORDER), cards.map(c => c.id).join());
  ck("root: every card has a CSS preview and its name", cards.every((c, i) => c.pv > 0 && c.name === games[i].name));
  ck("root: nothing is marked Playing", cards.every(c => !c.cur && !c.tags.includes("Playing")) && await p.evaluate(() => !document.querySelector('[aria-current="page"], .tag.go')), JSON.stringify(cards));
  ck("root: Two's card shows the saved best and Continue (a live run)", (() => { const t = cards.find(c => c.id === "two");
    return t && t.tags.includes("Best 2,400") && t.tags.includes("Continue"); })(), JSON.stringify(cards.find(c => c.id === "two")));
  ck("root: vs-computer tag on Four, Five, Nine and Fifteen only", cards.every(c => c.tags.includes("vs computer") === !!games.find(g => g.id === c.id).vs));
  ck("root: unplayed games say New to you", cards.filter(c => c.id !== "two").every(c => c.tags.includes("New to you")), JSON.stringify(cards.map(c => c.tags)));
  ck("root: card links reach each game, Two at two/", cards.every(c => c.href === games.find(g => g.id === c.id).path) && cards.find(c => c.id === "two").href === "two/", JSON.stringify(cards.map(c => c.href)));
  const lay = await p.evaluate(() => { const r = s => document.querySelector(s).getBoundingClientRect();
    return { top: r("#topbar").bottom, today: r("#today").top, ord: r("#today").bottom <= r("#more").top && r("#more").top < r("#games").top && r("#games").bottom <= r(".foot-note").top,
      h: document.getElementById("more").textContent, lede: document.querySelector(".lede").textContent,
      foot: document.querySelector(".foot-note").textContent, w: r("#games").width, tw: r("#today").width }; });
  ck("phone: Today, the heading, the cards, then the foot line, in one column under the top bar", lay.today >= lay.top && lay.ord && Math.abs(lay.w - lay.tw) < 1, JSON.stringify(lay));
  ck("root: heading and lede", lay.h === "Ten number games" && lay.lede === "From the smallest number to the biggest. Free, no ads, saved on this device.", JSON.stringify(lay));
  ck("footer line", lay.foot === "Your scores and trophies stay on this device. Nothing is sent anywhere.");
  ck("phone 390: two card columns", await p.evaluate(() => getComputedStyle(document.getElementById("games")).gridTemplateColumns.split(" ").length === 2));
  const td = await p.evaluate(() => { const t = document.getElementById("today");
    return { when: t.querySelector(".when").textContent, h: t.querySelector("h3").textContent, chips: [...t.querySelectorAll(".chip")].map(c => [c.getAttribute("href"), c.textContent]) }; });
  // TRIAGE4 D4/D9: the streak line always shows, chips say "Daily", the Sudoku chip carries its level
  const lvl = await p.evaluate(() => { const l = NumbericsProgress.dailyLevel(); return l.charAt(0).toUpperCase() + l.slice(1); });
  ck("Today card: date line with 'Start a streak today', title and three Daily chips (Not yet; Sudoku's level)", /^Today · \S.*Start a streak today$/.test(td.when) && td.h === "Three dailies, the same for everyone" &&
    JSON.stringify(td.chips) === JSON.stringify([["seven/?mode=daily", "Daily SevenNot yet"], ["six/?mode=daily", "Daily SixNot yet"], ["sudoku/?mode=daily", "Daily Sudoku" + lvl + "Not yet"]]), JSON.stringify(td));
  ck("phone 390: no horizontal scroll", await noHScroll(p));
  await shot(p, "phone");

  // 4. a Daily done shows on the chip; another game's live run shows Continue
  await p.evaluate(() => { NumbericsProgress.put("seven", { best: "Best 579", live: true, liveText: "Score 12" }); NumbericsProgress.daily("seven", "1,204"); });
  await p.reload();
  const c2 = await p.evaluate(() => { const a = document.querySelector('#games .card[data-id="seven"]'); return [...a.querySelectorAll(".tag")].map(t => t.textContent); });
  ck("after playing Seven its card shows Continue and the best, not New to you", JSON.stringify(c2) === '["Continue","Best 579"]', JSON.stringify(c2));
  ck("a finished Daily shows Done on its chip", await p.evaluate(() => { const c = document.querySelector('#today .chip[href^="seven/"]'); return c.classList.contains("done") && c.textContent === "Daily SevenBest 1,204"; }));

  // 5. the Games sheet from the root's top bar: Today first, then every game in order, nothing Playing; Esc closes
  await p.click('#topbar [data-open="games"]'); await p.waitForTimeout(300);
  const sh = await p.evaluate(() => { const s = document.getElementById("sh-games"); if (!s || s.hidden) return null;
    const b = s.querySelector(".sh-body");
    return { first: b.firstElementChild.className, ids: [...b.querySelectorAll(".card")].map(a => a.dataset.id), pv: [...b.querySelectorAll(".card .pv")].filter(x => x.children.length).length,
      cur: b.querySelectorAll('[aria-current="page"]').length, two: b.querySelector('.card[data-id="two"]').getAttribute("href"),
      title: s.querySelector("h2").textContent, open: NumbericsUI.current(), fixed: getComputedStyle(s).position }; });
  ck("Games sheet opens from the top bar", sh && sh.open === "games" && sh.title === "Games" && sh.fixed === "fixed", JSON.stringify(sh));
  ck("Games sheet: Today first, then ten cards in games.json order with previews, none Playing, Two at two/", sh && sh.first.indexOf("today") >= 0 &&
    JSON.stringify(sh.ids) === JSON.stringify(ORDER) && sh.pv === 10 && sh.cur === 0 && sh.two === "two/", JSON.stringify(sh));
  ck("Games sheet: no horizontal scroll", await noHScroll(p));
  await shot(p, "sheet-games");
  await p.keyboard.press("Escape"); await p.waitForTimeout(50);
  ck("Games sheet: Esc closes it and focus returns to the Games button", await p.evaluate(() => !NumbericsUI.open() && document.activeElement && document.activeElement.getAttribute("data-open") === "games"));
  // the Settings and Trophies sheets and the mute work on the games page
  await p.click('#topbar [data-open="settings"]'); await p.waitForTimeout(200);
  ck("root: Settings opens", await p.evaluate(() => NumbericsUI.current() === "settings"));
  await p.keyboard.press("Escape"); await p.waitForTimeout(50);
  await p.click('#topbar [data-open="trophies"]'); await p.waitForTimeout(200);
  ck("root: Trophies opens", await p.evaluate(() => NumbericsUI.current() === "trophies"));
  await p.keyboard.press("Escape"); await p.waitForTimeout(50);
  await p.click('#topbar [data-open="mute"]');
  ck("root: the mute button mutes", await p.evaluate(() => NumbericsSettings.muted() && document.querySelector("#topbar .tb-mute").getAttribute("aria-pressed") === "true"));
  await p.click('#topbar [data-open="mute"]');
  // a card takes the player to the game: Two's card opens /two/ and Two plays
  await Promise.all([p.waitForURL(/\/two\/$/, { timeout: 5000 }).catch(() => null), p.click('#games .card[data-id="two"]')]);
  ck("root: Two's card opens /two/ and the saved game is there", /\/two\/$/.test(p.url()) && await p.evaluate(() => !!window.__numberics && window.__numberics.state.moves >= 40), p.url());
  ck("no page errors and no external requests on the root and /two/", errs.length === 0 && ext.length === 0, errs.concat(ext).join(" | "));
  await ctx.close();

  // 6. widths: no horizontal scroll at 375 and 320; desktop keeps one column (Today over the cards) and the 3-column grid
  for (const w of [375, 320]) {
    ctx = await newCtx(browser, { viewport: { width: w, height: 760 } }); p = await ctx.newPage();
    await p.goto(url);
    ck("phone " + w + ": no horizontal scroll, cards in two columns", await noHScroll(p) &&
      await p.evaluate(() => getComputedStyle(document.getElementById("games")).gridTemplateColumns.split(" ").length === 2));
    await shot(p, "phone-" + w);
    await ctx.close();
  }
  for (const [w, h] of [[1280, 860], [1000, 800]]) {
    ctx = await newCtx(browser, { viewport: { width: w, height: h } }); p = await ctx.newPage();
    await p.goto(url);
    const dk = await p.evaluate(() => { const r = s => document.querySelector(s).getBoundingClientRect(), t = r("#today"), g = r("#games");
      return { tl: t.left, gl: g.left, gw: g.width, tb: t.bottom, gt: g.top, mid: (g.left + g.right) / 2, vw: innerWidth,
        cols: getComputedStyle(document.getElementById("games")).gridTemplateColumns.split(" ").length }; });
    ck("desktop " + w + ": Today over the cards in one centred column, three card columns", Math.abs(dk.tl - dk.gl) < 1 && dk.tb < dk.gt &&
      Math.abs(dk.mid - dk.vw / 2) < 12 && dk.cols === 3 && dk.gw <= 760, JSON.stringify(dk));
    ck("desktop " + w + ": no horizontal scroll", await noHScroll(p));
    if (w === 1280) await shot(p, "desktop");
    await ctx.close();
  }

  // 7. every game page: the Games sheet lists the same games in the same order, marks this one, links Two to ../two/;
  // the cards at the foot do the same; the home mark goes to ../ (the games page)
  ctx = await newCtx(browser, { viewport: { width: 390, height: 844 } });
  for (const g of games) {
    p = await ctx.newPage(); const e2 = []; p.on("pageerror", e => e2.push(e.message));
    await p.goto(url + g.path);
    await closeSheets(p); // a first-visit how-to sheet (any game)
    await p.click('#topbar [data-open="games"]'); await p.waitForTimeout(80);
    const r = await p.evaluate(() => { const s = document.getElementById("sh-games"); if (!s || s.hidden) return null;
      return { ids: [...s.querySelectorAll(".card")].map(a => a.dataset.id), cur: (s.querySelector('.card[aria-current="page"]') || {}).dataset,
        two: s.querySelector('.card[data-id="two"]').getAttribute("href") }; });
    ck(g.id + ": the Games sheet lists every game in order, marks this one, links Two to ../two/", r && JSON.stringify(r.ids) === JSON.stringify(ORDER) && r.cur && r.cur.id === g.id && r.two === "../two/", JSON.stringify(r));
    // the foot of every page is the shared cards (REDESIGN.md 3.2: the old text row is removed): same order, this game current
    const foot = await p.evaluate(() => { const el = document.getElementById("games"); if (!el) return null;
      return { cards: el.classList.contains("cards"), ids: [...el.querySelectorAll(":scope > a.card")].map(a => a.dataset.id),
        cur: [...el.querySelectorAll(':scope > a.card[aria-current="page"]')].map(a => a.dataset.id),
        two: el.querySelector('a.card[data-id="two"]').getAttribute("href"), home: document.querySelector("#topbar .tb-home").getAttribute("href") }; });
    ck(g.id + ": the games cards at the foot run in the same order, mark this game, link Two to ../two/; home is ../", foot && foot.cards &&
      JSON.stringify(foot.ids) === JSON.stringify(ORDER) && JSON.stringify(foot.cur) === JSON.stringify([g.id]) && foot.two === "../two/" && foot.home === "../", JSON.stringify(foot));
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
  // integration: the Today card is drawn after the first paint; its empty box keeps the drawn height, so the desktop
  // games page does not shift on load (perf budget loadCls 0.05; it read 0.057 before)
  ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  await ctx.addInitScript(() => { window.__ls = 0; new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__ls += e.value; }).observe({ type: "layout-shift", buffered: true }); });
  p = await ctx.newPage(); await p.goto(url); await p.waitForTimeout(800);
  const ls = await p.evaluate(() => ({ cls: window.__ls, today: document.getElementById("today").getBoundingClientRect().height }));
  ck("desktop root: load layout shift under 0.05 (Today keeps its height)", ls.cls < 0.05 && ls.today >= 146, JSON.stringify(ls));
  await ctx.close();
  // integration: a game page's own CSS never changes the shared card previews (Five, Six and Seven's .pips rules once
  // ringed and squeezed the Nine card's dots). Two and Sudoku keep their own CSS copies (Sudoku's body line-height
  // differs by a pixel); they are compared like the rest and any card they change is reported.
  ctx = await newCtx(browser, { viewport: { width: 390, height: 844 } });
  const look = (pg) => pg.evaluate(() => { const out = {}; document.querySelectorAll("#games .card .pv").forEach(pv => {
    out[pv.parentElement.dataset.id] = [...pv.querySelectorAll("*")].map(e => { const c = getComputedStyle(e);
      return [c.width, c.height, c.borderTopWidth, c.backgroundColor, c.display, c.opacity, c.margin].join("/"); }).join(";"); }); return out; });
  p = await ctx.newPage(); await p.goto(url); const base = await look(p); await p.close();
  for (const g of games.filter(x => x.id !== "sudoku")) {
    p = await ctx.newPage(); await p.goto(url + g.path); const here = await look(p);
    const off = Object.keys(base).filter(k => k !== g.id && here[k] !== base[k]);
    ck(g.id + ": the other games' card previews look as on the games page", off.length === 0, off.join());
    await p.close();
  }
  await ctx.close();
};
