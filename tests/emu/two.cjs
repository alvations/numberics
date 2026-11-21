/* SPDX-License-Identifier: Apache-2.0 | Copyright 2026 alvations (Melon Lab)
 * Browser checks for Two's Easy / Medium / Hard tiers (O-12). Run: NODE_PATH=$(npm root -g) node tests/emu/run.cjs two
 * (Two's other browser checks are in tests/emulation.cjs.) */
"use strict";
module.exports = async function ({ browser, url, ck, shot }) {
  const page = url + "two/";
  const seen = (c) => c.addInitScript(() => { try { const k = "numberics_progress_v1";
    const o = JSON.parse(localStorage.getItem(k) || "null") || { v: 1, games: {}, howto: {}, daily: {} };
    o.howto = o.howto || {}; o.howto.two = true; localStorage.setItem(k, JSON.stringify(o)); } catch (e) { /* storage blocked */ } });
  const pressed = (p) => p.evaluate(() => [...document.querySelectorAll("#diff button")].filter(b => b.getAttribute("aria-pressed") === "true").map(b => b.dataset.diff).join());
  const flushSave = (p) => p.evaluate(() => window.dispatchEvent(new Event("pagehide")));

  // 1. a first visit starts on Medium; the row is pressed and the tray's earn line says Medium's rule
  let ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2 }); await seen(ctx);
  let p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto(page);
  ck("first visit is Medium", await p.evaluate(() => window.__numberics.state.tier === "medium" && window.__numberics.tier === "medium"));
  ck("Medium is pressed", await pressed(p) === "medium");
  ck("the row sits above the tray", await p.evaluate(() => { const d = document.getElementById("diff").getBoundingClientRect(), t = document.getElementById("tray").getBoundingClientRect(); return d.bottom <= t.top + 1; }));
  ck("no horizontal scroll at 375px", await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await p.click("#tray .pw:nth-child(2)", { force: true }); // an empty Smash slot explains how to earn
  ck("the tray says Medium's rule", /as big as your biggest, from 32 up/.test(await p.textContent("#hint")));

  // 2. no run yet: Easy starts a new Easy game at once; the choice survives a reload
  await p.click('#diff button[data-diff="easy"]');
  ck("Easy at once with no run", await p.evaluate(() => window.__numberics.state.tier === "easy") && await pressed(p) === "easy");
  await p.click("#tray .pw:nth-child(2)", { force: true });
  ck("the tray says Easy's rule", /at least half your biggest/.test(await p.textContent("#hint")));
  for (let i = 0; i < 6; i++) await p.keyboard.press(["ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown"][i % 4]);
  await p.waitForTimeout(250); await flushSave(p);
  const mv = await p.evaluate(() => window.__numberics.state.moves);
  await p.reload();
  ck("Easy and the run survive a reload", await p.evaluate(() => window.__numberics.state.tier === "easy") && await p.evaluate(() => window.__numberics.state.moves) === mv && await pressed(p) === "easy");

  // 3. mid-run: Hard asks Sure? first, the hint says why; the second tap starts a Hard game
  await p.click('#diff button[data-diff="hard"]');
  ck("mid-run: Sure? on the button", (await p.textContent('#diff button[data-diff="hard"]')) === "Sure?");
  ck("mid-run: the hint says it ends the run", /Tap Hard again: this ends the run\./.test(await p.textContent("#hint")));
  ck("mid-run: still Easy after one tap", await p.evaluate(() => window.__numberics.state.tier === "easy" && window.__numberics.state.moves > 0));
  await p.click('#diff button[data-diff="hard"]');
  ck("second tap: a new Hard game", await p.evaluate(() => { const s = window.__numberics.state; return !("tier" in s) && s.moves === 0; }) && await pressed(p) === "hard");
  ck("the label is back", (await p.textContent('#diff button[data-diff="hard"]')) === "Hard");
  await p.waitForTimeout(3100);
  // the Sure? lapses after 3 s
  for (let i = 0; i < 4; i++) await p.keyboard.press(["ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown"][i % 4]);
  await p.waitForTimeout(250);
  await p.click('#diff button[data-diff="medium"]'); await p.waitForTimeout(3200);
  ck("an unanswered Sure? lapses", (await p.textContent('#diff button[data-diff="medium"]')) === "Medium" && await p.evaluate(() => !window.__numberics.state.tier));
  await shot(p, "tiers-hard");

  // 4. a reward arrives sooner on Easy: the same board, a second 64 when the top is 128 (half the top tile)
  const run = async (tier) => {
    await p.evaluate((t) => { const s = window.__numberics.state; if (t === "hard") delete s.tier; else s.tier = t;
      s.grid = new Array(16).fill(0); s.grid[0] = 5; s.grid[1] = 5; s.grid[15] = 7; s.top = 7; s.power = { undo: 0, smash: 0, swap: 0, boost: 0 };
      s.prev = null; s.free = false; s.marks = new Array(16).fill(0); s.over = false; window.__numberics.state = s; }, tier);
    // record the game's own toasts (a trophy toast for the 128 may follow and replace it on screen)
    await p.evaluate(() => { const K = window.NumbericsKit; window.__toasts = []; if (!K.__orig) K.__orig = K.toast;
      K.toast = function (m, k) { window.__toasts.push(m); return K.__orig.apply(this, arguments); }; });
    await p.keyboard.press("ArrowLeft"); await p.waitForTimeout(300);
    return p.evaluate(() => ({ got: Object.values(window.__numberics.state.power).reduce((a, b) => a + b, 0), toast: window.__toasts.filter(x => !/^Trophy/.test(x)).join("|") }));
  };
  const e = await run("easy"), m = await run("medium"), h = await run("hard");
  ck("Easy pays a join half the top tile, with its toast", e.got === 1 && /^Made 64 \+1 (Undo|Smash|Swap|Boost)$/.test(e.toast), JSON.stringify(e));
  ck("Medium and Hard do not, and say nothing", m.got === 0 && h.got === 0 && !m.toast && !h.toast, JSON.stringify([m, h]));
  // Medium pays a second tile as big as the top tile
  await p.evaluate(() => { window.__toasts = []; const s = window.__numberics.state; s.tier = "medium";
    s.grid = new Array(16).fill(0); s.grid[0] = 6; s.grid[1] = 6; s.grid[15] = 7; s.top = 7; s.power = { undo: 0, smash: 0, swap: 0, boost: 0 };
    s.prev = null; s.free = false; s.marks = new Array(16).fill(0); window.__numberics.state = s; });
  await p.keyboard.press("ArrowLeft"); await p.waitForTimeout(300);
  ck("Medium pays a second 128", await p.evaluate(() => Object.values(window.__numberics.state.power).reduce((a, b) => a + b, 0)) === 1 && /^Made 128 \+1 /.test(await p.evaluate(() => window.__toasts[0] || "")));
  // scripted run: the same seed and swipes on each tier; the first reward comes no later on Easy than on Medium, nor on Medium than on Hard
  const firstReward = (tier) => p.evaluate((t) => {
    const N = window.Numberics; let s = N.newGame(4242, 4, t);
    const order = ["left", "down", "right", "up"];
    for (let i = 0; i < 3000 && !s.over; i++) {
      let r = null; for (const d of order) { r = N.move(s, d); if (r.moved) break; }
      if (!r || !r.moved) break;
      if (r.awarded.length) return s.moves + 1;
      s = r.state;
    }
    return 1e9;
  }, tier);
  const fe = await firstReward("easy"), fm = await firstReward("medium"), fh = await firstReward("hard");
  const count = (tier) => p.evaluate((t) => {
    const N = window.Numberics, order = ["left", "down", "right", "up"]; let n = 0;
    for (let sd = 1; sd <= 40; sd++) {
      let s = N.newGame(sd, 4, t);
      for (let i = 0; i < 400 && !s.over; i++) { let r = null; for (const d of order) { r = N.move(s, d); if (r.moved) break; } if (!r || !r.moved) break; n += r.awarded.length; s = r.state; }
    }
    return n;
  }, tier);
  const ce = await count("easy"), cm = await count("medium"), ch = await count("hard");
  ck("scripted runs (40 seeds): more rewards on Easy than Medium than Hard", ce > cm && cm > ch, [ce, cm, ch].join());
  ck("scripted run: the first reward is no later on an easier tier", fe <= fm && fm <= fh, [fe, fm, fh].join());
  await ctx.close();

  // 5. an old save (numberics_endless_v1, no tier field) loads as Hard, keeps its best, and keeps playing on Hard
  ctx = await browser.newContext({ viewport: { width: 375, height: 812 } }); await seen(ctx);
  await ctx.addInitScript(() => { try { if (!sessionStorage.getItem("seeded")) { sessionStorage.setItem("seeded", "1");
    const g = new Array(16).fill(0); g[0] = 6; g[1] = 6; g[4] = 2; g[15] = 7;
    localStorage.setItem("numberics_endless_v1", JSON.stringify({ bestScore: 5000, bestTop: 9, bestBefore: 5000,
      state: { size: 4, grid: g, score: 1200, top: 7, moves: 40, seed: 99, over: false, power: { undo: 1, smash: 0, swap: 0, boost: 0 }, prev: null, free: false } })); } } catch (e) { /* blocked */ } });
  p = await ctx.newPage(); p.on("pageerror", x => errs.push(x.message));
  await p.goto(page);
  ck("old save: Hard, the same game", await p.evaluate(() => !("tier" in window.__numberics.state) && window.__numberics.state.moves === 40 && window.__numberics.tier === "hard") && await pressed(p) === "hard");
  ck("old save: its best shows on Hard", (await p.textContent("#best")) === "5,000");
  await p.keyboard.press("ArrowLeft"); await p.waitForTimeout(300);
  ck("old save: a second 128 pays nothing (Hard's rule)", await p.evaluate(() => window.__numberics.state.power.smash + window.__numberics.state.power.swap + window.__numberics.state.power.boost) === 0);
  await flushSave(p);
  ck("old save: the tier is now saved as Hard, the old best fields kept", await p.evaluate(() => { const o = JSON.parse(localStorage.getItem("numberics_endless_v1")); return o.tier === "hard" && o.bestScore === 5000 && o.bests && o.bests.medium.score === 0; }));
  // switching to Medium (mid-run: two taps) shows Medium's own best (none yet)
  await p.click('#diff button[data-diff="medium"]'); await p.click('#diff button[data-diff="medium"]');
  ck("Medium keeps its own best", (await p.textContent("#best")) === "none" && await pressed(p) === "medium");
  await flushSave(p);
  ck("the card summary names the tier", await p.evaluate(() => { const P = window.NumbericsProgress; const g = P && P.get("two"); return !g || !g.best || /^Medium best /.test(g.best); }));
  await p.click('#diff button[data-diff="hard"]');
  ck("back on Hard the old best shows again", (await p.textContent("#best")) === "5,000");
  ck("no page errors", errs.length === 0, errs.join(" | "));
  await ctx.close();

  // 6. O-14 at 375x812 (the board and the tray in view, the hint one line) and TRIAGE5 S20 (the "+N" score pop stays
  // inside the Score box, never on the subtitle)
  ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2 }); await seen(ctx);
  p = await ctx.newPage(); const e6 = []; p.on("pageerror", x => e6.push(x.message));
  await p.goto(page);
  const f = await p.evaluate(() => { const b = document.getElementById("board").getBoundingClientRect(), t = document.getElementById("tray").getBoundingClientRect();
    const h = document.getElementById("hint"), r = document.createRange(); r.selectNodeContents(h);
    return { board: Math.round(b.bottom), trayTop: Math.round(t.top), vh: innerHeight, sy: scrollY,
      lines: new Set([...r.getClientRects()].filter(x => x.width > 0).map(x => Math.round(x.top))).size }; });
  ck("O-14: the whole board and the tray in view at 375x812 (board bottom " + f.board + ")", f.sy === 0 && f.trayTop >= 0 && f.board <= f.vh, JSON.stringify(f));
  ck("O-14: the opening hint is at most one line", f.lines <= 1, JSON.stringify(f));
  await p.evaluate(() => { const s = window.__numberics.state; s.grid = new Array(16).fill(0); s.grid[0] = 3; s.grid[1] = 3; s.top = 3;
    s.prev = null; s.over = false; s.marks = new Array(16).fill(0); window.__numberics.state = s; });
  await p.keyboard.press("ArrowLeft");
  const box = await p.evaluate(async () => { await new Promise(r => setTimeout(r, 60));
    const pl = document.querySelector(".stat .plus"); if (!pl) return null;
    const r = (e) => { const b = e.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom }; };
    return { plus: r(pl), stat: r(document.getElementById("score").parentNode), sub: r(document.querySelector(".sub")) }; });
  ck("S20: the score pop shows", !!box);
  if (box) {
    ck("S20: the score pop is inside the Score box", box.plus.t >= box.stat.t - 0.5 && box.plus.b <= box.stat.b + 0.5 && box.plus.l >= box.stat.l - 0.5 && box.plus.r <= box.stat.r + 0.5, JSON.stringify(box));
    ck("S20: the score pop never overlaps the subtitle", box.plus.r <= box.sub.l || box.plus.l >= box.sub.r || box.plus.b <= box.sub.t || box.plus.t >= box.sub.b, JSON.stringify(box));
  }
  await shot(p, "score-pop");
  ck("no page errors (O-14, S20)", e6.length === 0, e6.join(" | "));
  await ctx.close();

  // 7. the Hard trophy (O-13, docs/reviews/TROPHY-TIERS.md): the client sends the tier. A forged board one join short of
  // 2048 earns "The old way" on Hard; the same board on Medium earns "The old finish line" but not the Hard trophy
  for (const tier of ["hard", "medium"]) {
    const seenT = (c, g) => c.addInitScript((id) => { try { const k = "numberics_progress_v1";
      const o = JSON.parse(localStorage.getItem(k) || "null") || { v: 1, games: {}, howto: {}, daily: {} };
      o.howto = o.howto || {}; o.howto[id] = true; localStorage.setItem(k, JSON.stringify(o)); } catch (e) { /* storage blocked */ } }, g);
    const c7 = await browser.newContext({ viewport: { width: 375, height: 812 } }); await seenT(c7, "two");
    const p7 = await c7.newPage(), e7 = []; p7.on("pageerror", e => e7.push(e.message));
    await p7.goto(page);
    await p7.evaluate((t) => { const s = window.__numberics.state; if (t === "hard") delete s.tier; else s.tier = t;
      s.grid = new Array(16).fill(0); s.grid[0] = 10; s.grid[1] = 10; s.grid[15] = 2; s.top = 10; s.power = { undo: 0, smash: 0, swap: 0, boost: 0 };
      s.prev = null; s.free = false; s.marks = new Array(16).fill(0); s.over = false; window.__numberics.state = s; }, tier);
    await p7.keyboard.press("ArrowLeft"); await p7.waitForTimeout(400);
    const r7 = await p7.evaluate(() => ({ top: window.__numberics.state.top, hard: window.NumbericsTrophies.has("two_hard"), old: window.NumbericsTrophies.has("two_2048") }));
    ck("Hard trophy (" + tier + "): the join made 2048", r7.top === 11, JSON.stringify(r7));
    ck("Hard trophy (" + tier + "): The old finish line pays on every tier", r7.old === true, JSON.stringify(r7));
    ck("Hard trophy (" + tier + "): The old way " + (tier === "hard" ? "is earned" : "is not earned"), r7.hard === (tier === "hard"), JSON.stringify(r7));
    ck("Hard trophy (" + tier + "): no page errors", e7.length === 0, e7.join(" | "));
    await c7.close();
  }
};
