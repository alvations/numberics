/* SPDX-License-Identifier: Apache-2.0 | Copyright 2026 alvations (Melon Lab)
 * Shared browser checks for the tile games' Easy / Medium / Hard tiers (O-12 Two, O-13 Fibonacci and Three), so the
 * three pages behave as one family: the first visit is Medium, the row, Sure? mid-run, the saved choice, an old save
 * loads as Hard with its best, a best per tier, "<Tier> best N" on the card. Also O-14 (375x812: the whole board and
 * the tray in view, the hint at most one line) and, where the game has one, TRIAGE5 S20 (the "+N" score pop stays
 * inside the Score box). A file whose name starts with "_" is a helper, not a module (tests/emu/run.cjs).
 * cfg: { id, api (the page's window.__ hook), key (the save key), rules: { easy, medium } (tray text regexes),
 *        easy(p, tier) / medium(p, tier) (set a board where that tier pays and Hard does not; press the swipe),
 *        made: { easy, medium } (toast regexes), oldSave (the saved object), oldSwipe (a key that would pay on Medium),
 *        oldBest (its best as shown), pop (true when the page has a "+N" score pop), popBoard(p) (set a board that
 *        joins on ArrowLeft) } */
"use strict";
module.exports = async function ({ browser, url, ck, shot }, cfg) {
  const page = url + cfg.id + "/", id = cfg.id, api = cfg.api;
  const seen = (c) => c.addInitScript((g) => { try { const k = "numberics_progress_v1";
    const o = JSON.parse(localStorage.getItem(k) || "null") || { v: 1, games: {}, howto: {}, daily: {} };
    o.howto = o.howto || {}; o.howto[g] = true; localStorage.setItem(k, JSON.stringify(o)); } catch (e) { /* storage blocked */ } }, id);
  const pressed = (p) => p.evaluate(() => [...document.querySelectorAll("#diff button")].filter(b => b.getAttribute("aria-pressed") === "true").map(b => b.dataset.diff).join());
  const flushSave = (p) => p.evaluate(() => window.dispatchEvent(new Event("pagehide")));
  const st = (p, fn) => p.evaluate(new Function("return (" + fn + ")(window." + api + ".state)"));
  const tierOf = (p) => st(p, "s => s.tier || 'hard'");
  const stock = (p) => st(p, "s => Object.values(s.power).reduce((a, b) => a + b, 0)");
  // the hint's text in lines as laid out (a Range over its text: one rect per line box)
  const hintLines = (p) => p.evaluate(() => {
    const h = document.getElementById("hint"); if (!h.textContent.trim()) return 0;
    const r = document.createRange(); r.selectNodeContents(h);
    return new Set([...r.getClientRects()].filter(x => x.width > 0).map(x => Math.round(x.top))).size;
  });
  const fold = (p) => p.evaluate(() => {
    const b = document.getElementById("board").getBoundingClientRect(), t = document.getElementById("tray").getBoundingClientRect();
    return { board: Math.round(b.bottom), trayTop: Math.round(t.top), vh: innerHeight, sy: scrollY };
  });
  const record = (p) => p.evaluate(() => { const K = window.NumbericsKit; window.__toasts = []; if (!K.__orig) K.__orig = K.toast;
    K.toast = function (m) { window.__toasts.push(m); return K.__orig.apply(this, arguments); }; });
  const toasts = (p) => p.evaluate(() => window.__toasts.filter(x => !/^Trophy/.test(x)).join("|"));

  // 1. a first visit starts on Medium; the row is pressed and the tray's earn line says Medium's rule
  let ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2 }); await seen(ctx);
  let p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto(page);
  ck("tiers: first visit is Medium", await tierOf(p) === "medium" && await p.evaluate(new Function("return window." + api + ".tier")) === "medium");
  ck("tiers: Medium is pressed", await pressed(p) === "medium");
  ck("tiers: the row sits above the tray", await p.evaluate(() => { const d = document.getElementById("diff").getBoundingClientRect(), t = document.getElementById("tray").getBoundingClientRect(); return d.bottom <= t.top + 1; }));
  ck("tiers: no horizontal scroll at 375px", await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  // O-14: at 375x812 (iPhone 12/13 mini) the whole board and the tray are in view without scrolling; the hint is one line
  const f = await fold(p);
  ck("O-14: the whole board and the tray in view at 375x812 (board bottom " + f.board + ")", f.sy === 0 && f.trayTop >= 0 && f.board <= f.vh, JSON.stringify(f));
  ck("O-14: the opening hint is at most one line", await hintLines(p) <= 1);
  await shot(p, "tiers-medium");
  await p.click("#tray .pw:nth-child(2)", { force: true }); // an empty slot explains how to earn
  ck("tiers: the tray says Medium's rule", cfg.rules.medium.test(await p.textContent("#hint")), await p.textContent("#hint"));

  // 2. no run yet: Easy starts a new Easy game at once; the choice survives a reload
  await p.click('#diff button[data-diff="easy"]');
  ck("tiers: Easy at once with no run", await tierOf(p) === "easy" && await pressed(p) === "easy");
  await p.click("#tray .pw:nth-child(2)", { force: true });
  ck("tiers: the tray says Easy's rule", cfg.rules.easy.test(await p.textContent("#hint")), await p.textContent("#hint"));
  for (let i = 0; i < 6; i++) await p.keyboard.press(["ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown"][i % 4]);
  await p.waitForTimeout(450); await flushSave(p);
  const mv = await st(p, "s => s.moves");
  await p.reload();
  ck("tiers: Easy and the run survive a reload", mv > 0 && await tierOf(p) === "easy" && await st(p, "s => s.moves") === mv && await pressed(p) === "easy");

  // 3. mid-run: Hard asks Sure? first, the hint says why (one line); the second tap starts a Hard game
  await p.click('#diff button[data-diff="hard"]');
  ck("tiers: mid-run Sure? on the button", (await p.textContent('#diff button[data-diff="hard"]')) === "Sure?");
  ck("tiers: mid-run the hint says it ends the run", /Tap Hard again: this ends the run\./.test(await p.textContent("#hint")));
  ck("O-14: the Sure? hint is one line", await hintLines(p) === 1);
  ck("tiers: still Easy after one tap", await tierOf(p) === "easy" && await st(p, "s => s.moves") > 0);
  await p.click('#diff button[data-diff="hard"]');
  ck("tiers: second tap, a new Hard game", await st(p, "s => !('tier' in s) && s.moves === 0") && await pressed(p) === "hard");
  ck("tiers: the label is back", (await p.textContent('#diff button[data-diff="hard"]')) === "Hard");
  for (let i = 0; i < 4; i++) await p.keyboard.press(["ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown"][i % 4]);
  await p.waitForTimeout(450);
  await p.click('#diff button[data-diff="medium"]'); await p.waitForTimeout(3200);
  ck("tiers: an unanswered Sure? lapses", (await p.textContent('#diff button[data-diff="medium"]')) === "Medium" && await tierOf(p) === "hard");

  // 4. a reward arrives sooner on an easier tier: the same board on each tier, with the toast "Made N +1 Name"
  await record(p);
  for (const tier of ["easy", "medium"]) {
    const got = {};
    for (const tr of ["easy", "medium", "hard"]) {
      await p.evaluate(() => { window.__toasts = []; });
      await cfg[tier](p, tr); await p.waitForTimeout(500);
      got[tr] = { n: await stock(p), toast: await toasts(p) };
    }
    const easier = tier === "easy" ? ["easy"] : ["easy", "medium"];
    ck("tiers: the " + tier + " board pays on " + easier.join(" and ") + " only, with its toast",
      easier.every(tr => got[tr].n === 1 && cfg.made[tier].test(got[tr].toast)) &&
      ["easy", "medium", "hard"].filter(tr => easier.indexOf(tr) < 0).every(tr => got[tr].n === 0 && !/\+1 /.test(got[tr].toast)), JSON.stringify(got));
  }

  // 5. TRIAGE5 S20: the "+N" score pop stays inside the Score box and never sits on the subtitle
  if (cfg.pop) {
    await cfg.popBoard(p);
    const box = await p.evaluate(async () => {
      await new Promise(r => setTimeout(r, 60));
      const pl = document.querySelector(".stat .plus, #score ~ .plus, .plus"); if (!pl) return null;
      const r = (e) => { const b = e.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom }; };
      return { plus: r(pl), stat: r(document.getElementById("score").parentNode), sub: r(document.querySelector(".sub")) };
    });
    ck("S20: the score pop shows", !!box);
    if (box) {
      const inside = box.plus.t >= box.stat.t - 0.5 && box.plus.b <= box.stat.b + 0.5 && box.plus.l >= box.stat.l - 0.5 && box.plus.r <= box.stat.r + 0.5;
      const onSub = !(box.plus.r <= box.sub.l || box.plus.l >= box.sub.r || box.plus.b <= box.sub.t || box.plus.t >= box.sub.b);
      ck("S20: the score pop is inside the Score box", inside, JSON.stringify(box));
      ck("S20: the score pop never overlaps the subtitle", !onSub, JSON.stringify(box));
    }
    await shot(p, "score-pop");
  }
  ck("tiers: no page errors (first visit)", errs.length === 0, errs.join(" | "));
  await ctx.close();

  // 6. an old save (no tier field) loads as Hard, keeps its best, and keeps playing on Hard
  ctx = await browser.newContext({ viewport: { width: 375, height: 812 } }); await seen(ctx);
  await ctx.addInitScript((a) => { try { if (!sessionStorage.getItem("seeded")) { sessionStorage.setItem("seeded", "1");
    localStorage.setItem(a.key, JSON.stringify(a.save)); } } catch (e) { /* blocked */ } }, { key: cfg.key, save: cfg.oldSave });
  p = await ctx.newPage(); const errs2 = []; p.on("pageerror", x => errs2.push(x.message));
  await p.goto(page);
  ck("old save: Hard, the same game", await st(p, "s => !('tier' in s) && s.moves === 40") && await p.evaluate(new Function("return window." + api + ".tier")) === "hard" && await pressed(p) === "hard");
  ck("old save: its best shows on Hard", (await p.textContent("#best")) === cfg.oldBest);
  const before = await stock(p);
  await p.keyboard.press(cfg.oldSwipe); await p.waitForTimeout(500);
  ck("old save: a join that pays on Medium pays nothing (Hard's rule)", await stock(p) === before && await st(p, "s => s.moves") === 41);
  await flushSave(p);
  ck("old save: the tier is now saved as Hard, the old best fields kept", await p.evaluate((k) => { const o = JSON.parse(localStorage.getItem(k)); return o.tier === "hard" && o.bestScore === 5000 && o.bests && o.bests.medium.score === 0; }, cfg.key));
  await p.click('#diff button[data-diff="medium"]'); await p.click('#diff button[data-diff="medium"]');
  ck("old save: Medium keeps its own best", (await p.textContent("#best")) === "none" && await pressed(p) === "medium");
  await p.keyboard.press("ArrowLeft"); await p.keyboard.press("ArrowDown"); await p.waitForTimeout(450); await flushSave(p);
  ck("old save: the card summary names the tier", await p.evaluate((g) => { const P = window.NumbericsProgress; const x = P && P.get(g); return !x || !x.best || /^Medium best /.test(x.best); }, id));
  await p.click('#diff button[data-diff="hard"]'); await p.click('#diff button[data-diff="hard"]');
  ck("old save: back on Hard the old best shows again", (await p.textContent("#best")) === cfg.oldBest);
  ck("tiers: no page errors (old save)", errs2.length === 0, errs2.join(" | "));
  await ctx.close();
};
