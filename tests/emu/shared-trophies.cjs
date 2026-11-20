/* SPDX-License-Identifier: Apache-2.0 | Copyright 2026 alvations (Melon Lab)
 * Browser checks for shared/trophies.js + shared/progress.js on tests/fixtures/trophies.html (REDESIGN.md 8.1, 11 B4):
 * the earned-only sheet (no padlocks, no counts, secrets absent from the DOM until earned), the unseen dot, the toast,
 * the end-card pill path, persistence, blocked storage, reduced motion, zero external requests.
 * Run: NODE_PATH=$(npm root -g) node tests/emu/run.cjs shared-trophies */
"use strict";
module.exports = async function ({ browser, url, ck, shot }) {
  const page = url + "tests/fixtures/trophies.html";
  const open = async p => { await p.click('#topbar [data-open="trophies"]'); await p.waitForTimeout(50); };
  const sheetText = p => p.evaluate(() => {
    const s = [...document.querySelectorAll(".scrim")].find(x => !x.hidden && (x.querySelector(".tro, .tro-none")));
    return s ? s.textContent : null;
  });
  const dotOn = p => p.evaluate(() => { const d = document.querySelector("#topbar .tb-dot"); return !!d && !d.hidden && d.offsetParent !== null; });
  const COUNT = /\d+\s*(of|\/)\s*\d+|\b84\b|total|locked|padlock/i;
  const SECRETS = await (async () => { const T = require("../../shared/trophies.js"); return T.REG.filter(x => x.secret).map(x => [x.id, x.name, x.desc]); })();

  // 1. a fresh visitor: no dot, the sheet says "Nothing yet", no counts, no secret anywhere in the page
  let ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  let p = await ctx.newPage(); const errs = [], ext = [];
  p.on("pageerror", e => errs.push(e.message));
  p.on("request", r => { if (!r.url().startsWith(url)) ext.push(r.url()); });
  await p.goto(page);
  ck("fresh: no unseen dot on the cup", !(await dotOn(p)));
  await open(p);
  let txt = await sheetText(p);
  ck("fresh: the sheet opens and says Nothing yet", txt !== null && /Nothing yet\. Play any game to begin\./.test(txt), txt);
  ck("fresh: no count, total or padlock in the sheet", txt !== null && !COUNT.test(txt), txt);
  let html = await p.content();
  ck("fresh: no secret trophy's name or description anywhere in the DOM", SECRETS.every(([id, n, d]) => html.indexOf(n) < 0 && html.indexOf(d) < 0 && html.indexOf(id) < 0));
  await p.keyboard.press("Escape"); await p.waitForTimeout(50);
  ck("Esc closes the sheet", (await sheetText(p)) === null);

  // 2. an unlock: toast with the glyph, the dot, then the sheet shows it and clears the dot
  const got = await p.evaluate(() => NumbericsTrophies.report("two", "move", { top: 11, merges: 1, moves: 30 }));
  ck("report returns the newly earned ids", JSON.stringify(got) === '["two_128","two_2048"]', JSON.stringify(got));
  const toast = await p.evaluate(() => { const t = document.getElementById("toast"); return { on: t.classList.contains("on"), tro: t.classList.contains("trophy"), svg: !!t.querySelector("svg"), text: [...t.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join("") }; });
  ck("several at once: one toast '2 trophies: <first> and 1 more' with a glyph", toast.on && toast.tro && toast.svg && toast.text === "2 trophies: Warming up and 1 more", JSON.stringify(toast));
  ck("the unseen dot shows on the cup", await dotOn(p));
  await shot(p, "toast");
  await p.evaluate(() => NumbericsKit.toast("Plain note.", "info"));
  ck("the next plain toast drops the trophy style", await p.evaluate(() => { const t = document.getElementById("toast"); return !t.classList.contains("trophy") && !t.querySelector("svg"); }));
  await open(p);
  txt = await sheetText(p);
  ck("the sheet lists the earned trophies under Two", /Two/.test(txt) && /Warming up/.test(txt) && /The old finish line/.test(txt), txt);
  ck("only earned ones are drawn", await p.evaluate(() => [...document.querySelectorAll("[data-trophy]")].map(e => e.getAttribute("data-trophy")).sort().join()) === "two_128,two_2048");
  ck("every tile has a drawn line glyph", await p.evaluate(() => [...document.querySelectorAll(".tr")].every(t => t.querySelector("svg path, svg rect, svg circle"))));
  ck("no count, total or padlock after earning", !COUNT.test(txt.replace(/\b(128|2048)\b/g, "")), txt);
  ck("opening the sheet clears the dot and the unseen list", !(await dotOn(p)) && (await p.evaluate(() => NumbericsTrophies.unseen().length)) === 0);
  await shot(p, "sheet");
  await p.keyboard.press("Escape"); await p.waitForTimeout(30);

  // 3. a secret: absent before, shown with its real description and the gold edge after
  html = await p.content();
  ck("secret Night owl not in the DOM before earning", html.indexOf("Night owl") < 0 && html.indexOf("fam_night") < 0);
  await p.evaluate(() => { NumbericsProgress._clock(() => new Date(2026, 10, 20, 3, 10)); NumbericsTrophies.report("two", "move", { top: 2 }); NumbericsProgress._clock(); });
  await open(p);
  ck("earned secret shows once earned, marked secret, with its description", await p.evaluate(() => {
    const e = document.querySelector('.tr.secret[data-trophy="fam_night"]'); return !!e && /Night owl/.test(e.textContent) && /Played well past bedtime\./.test(e.textContent); }));
  ck("Everywhere is the first group", await p.evaluate(() => document.querySelector(".tro-game").textContent === "Everywhere"));
  await p.keyboard.press("Escape"); await p.waitForTimeout(30);

  // 4. the end card is up: no toast over it; the card shows pills instead
  await p.evaluate(() => { NumbericsKit.clearToast(); document.getElementById("over").hidden = false; });
  const ids = await p.evaluate(() => NumbericsTrophies.report("two", "end", { top: 12, score: 20000 }));
  ck("end-card path: the event earns", ids.indexOf("two_4096") >= 0 && ids.indexOf("two_score") >= 0 && ids.indexOf("fam_first") >= 0, JSON.stringify(ids));
  ck("end-card path: no toast over the card", await p.evaluate(() => !document.getElementById("toast").classList.contains("on")));
  ck("end-card path: the dot still marks them unseen", await dotOn(p));
  await p.evaluate(ids => NumbericsTrophies.pills(document.getElementById("pills"), ids), ids);
  const pills = await p.evaluate(() => [...document.querySelectorAll("#over .trophy")].map(e => [...e.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join("")));
  ck("end-card path: one pill per trophy, 'Trophy: <name>' with a glyph", pills.length === ids.length && pills.indexOf("Trophy: Past the line") >= 0 &&
    await p.evaluate(() => [...document.querySelectorAll("#over .trophy")].every(e => e.querySelector("svg"))), JSON.stringify(pills));
  await shot(p, "endcard");
  await p.evaluate(() => NumbericsTrophies.pills(document.getElementById("pills"), []));
  ck("no pills: the row hides", await p.evaluate(() => document.getElementById("pills").hidden));
  await p.evaluate(() => { document.getElementById("over").hidden = true; });

  // 5. persistence across a reload; progress summaries and today's results
  await p.evaluate(() => { NumbericsProgress.put("seven", { best: "Best 579", live: true, liveText: "Score 12" }); NumbericsProgress.daily("seven", "1,204");
    NumbericsTrophies.report("seven", "end", { mode: "daily", daily: true, score: 1204 }); });
  await p.reload();
  ck("after a reload: earned trophies, unseen dot and progress are kept", await p.evaluate(() => NumbericsTrophies.has("two_2048") && NumbericsTrophies.has("sev_daily") &&
    NumbericsProgress.get("seven").best === "Best 579" && NumbericsProgress.today().seven === "1,204" && NumbericsProgress.todayCard().streak === 1) && await dotOn(p));
  const raw = await p.evaluate(() => { try { return JSON.parse(localStorage.getItem("numberics_trophies_v1")); } catch (e) { return null; } });
  ck("stored in the spec shape", raw && raw.v === 1 && typeof raw.got === "object" && Array.isArray(raw.unseen) && raw.fam && raw.fam.played.two === 1 && raw.fam.streak.n === 1, JSON.stringify(raw));

  // 6. the minimal fallback sheet (only while NumbericsUI.sheet is a stub): focus, Tab trap, Esc, focus back
  await p.evaluate(() => { window.__realSheet = NumbericsUI.sheet; NumbericsUI.sheet = function () { return null; }; });
  await p.focus('#topbar [data-open="trophies"]'); await p.keyboard.press("Enter"); await p.waitForTimeout(30);
  ck("fallback: opens a dialog with focus on its close button", await p.evaluate(() => { const f = document.getElementById("tro-sheet-fb");
    return !!f && !f.hidden && f.querySelector('[role="dialog"]') && document.activeElement === f.querySelector("[data-close]"); }));
  await p.keyboard.press("Tab");
  ck("fallback: Tab stays inside", await p.evaluate(() => document.getElementById("tro-sheet-fb").contains(document.activeElement)));
  await p.keyboard.press("Escape");
  ck("fallback: Esc closes and focus returns to the cup", await p.evaluate(() => document.getElementById("tro-sheet-fb").hidden &&
    document.activeElement && document.activeElement.getAttribute("data-open") === "trophies"));
  await p.evaluate(() => { NumbericsUI.sheet = window.__realSheet; });
  ck("no page errors", errs.length === 0, errs.join(" | "));
  ck("zero external requests", ext.length === 0, ext.join(" "));
  await ctx.close();

  // 7. blocked storage and reduced motion: everything still works in memory
  ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, reducedMotion: "reduce" });
  await ctx.addInitScript(() => {
    const no = () => { throw new Error("blocked"); };
    Object.defineProperty(window, "localStorage", { get: no, configurable: true });
  });
  p = await ctx.newPage(); const e2 = []; p.on("pageerror", e => e2.push(e.message));
  await p.goto(page);
  const r2 = await p.evaluate(() => { const a = NumbericsTrophies.report("sudoku", "solve", { difficulty: "hard", used: { reveal: 0, check: 0, cands: 0 }, notes: false, clean: true });
    NumbericsProgress.put("sudoku", { best: "Best 6:12" }); NumbericsProgress.markHowto("sudoku");
    return { a: a, has: NumbericsTrophies.has("sdk_pure"), best: NumbericsProgress.get("sudoku").best, how: NumbericsProgress.seenHowto("sudoku") }; });
  ck("blocked storage: trophies and progress work in memory", r2.has && r2.best === "Best 6:12" && r2.how && r2.a.indexOf("sdk_clean") >= 0, JSON.stringify(r2));
  await open(p);
  txt = await sheetText(p);
  ck("blocked storage: the sheet shows what was earned this visit", txt && /Pen only/.test(txt) && /Not one slip/.test(txt), txt);
  await shot(p, "sheet-desktop");
  ck("blocked storage: no page errors", e2.length === 0, e2.join(" | "));
  await ctx.close();
};
