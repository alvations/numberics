/* SPDX-License-Identifier: Apache-2.0 | Copyright 2026 alvations (Melon Lab)
 * Browser checks for Sudoku (tests/emu/run.cjs module): power-ups, earn by progress, the solved lock (R1),
 * the two-step difficulty switch (R10), the clock across reloads, tray info (R5), toasts (R7), the end card (R8). */
"use strict";
module.exports = async function ({ browser, url, ck, shot }) {
  const page = async (opts, init) => {
    const ctx = await browser.newContext(Object.assign({ viewport: { width: 375, height: 900 }, deviceScaleFactor: 2 }, opts || {}));
    const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
    if (init) await p.addInitScript(init);
    await p.goto(url + "sudoku/"); return { ctx, p, errs };
  };
  const st = (p) => p.evaluate(() => window.__sudoku.state);
  const tot = (x) => x.stock.reveal + x.stock.check + x.stock.cands;
  const empties = (p) => p.evaluate(() => { const s = window.__sudoku.state; return s.grid.map((v, i) => v ? -1 : i).filter(i => i >= 0); });
  const toastIs = async (p, re, bad) => {
    const t = await p.evaluate(() => { const e = document.getElementById("toast"); return { text: e.textContent, on: e.classList.contains("on"), bad: e.classList.contains("bad") }; });
    return t.on && re.test(t.text) && (bad === undefined || t.bad === bad);
  };

  // 1. tray, layout
  let { ctx, p, errs } = await page();
  ck("tray has 4 slots: Undo Reveal Check Candidates", (await p.locator("#tray .pw").allTextContents()).map(s => s.replace(/[0-9∞]+$/, "")).join(",") === "Undo,Reveal,Check,Candidates");
  ck("Notes and Erase stay plain tools", await p.locator(".tools #notes").count() === 1 && await p.locator(".tools #erase").count() === 1);
  ck("start stock: 1 Reveal, Check and Candidates empty", JSON.stringify((await st(p)).stock) === JSON.stringify({ reveal: 1, check: 0, cands: 0 }));
  ck("Undo shows no infinity badge while there is nothing to undo (S5)", await p.locator("#pw-undo i").isHidden() && (await p.getAttribute("#pw-undo", "aria-disabled")) === "true");
  ck("tray buttons are never disabled, only aria-disabled (R5)", await p.evaluate(() => [...document.querySelectorAll("#tray .pw")].every(b => !b.disabled)));
  ck("tray tooltips in the family voice", (await p.getAttribute("#pw-reveal", "title")) === "H: Reveal. Show the right digit for one cell.");
  ck("no horizontal scroll at 375px", await p.evaluate(() => document.documentElement.scrollWidth <= 375));
  ck("tray labels fit their buttons", await p.evaluate(() => [...document.querySelectorAll("#tray .pw")].every(b => b.scrollWidth <= b.clientWidth + 1)));
  ck("subtitle: Numberics link and a tagline, no live status (R6)", /^Numberics · [A-Z][^.]*\.$/.test((await p.textContent(".sub")).trim()) && await p.locator(".sub a[href='../']").count() === 1);
  ck("empty Best reads 'none', not a hyphen (R11)", (await p.textContent("#best")) === "none");
  ck("New puzzle button is 16px like the family (F17)", await p.evaluate(() => getComputedStyle(document.getElementById("new")).fontSize) === "16px");
  ck("board grid has role=row children (valid ARIA)", await p.locator("#board > [role=row]").count() === 9 && await p.locator("#board [role=row] > [role=gridcell]").count() === 81);

  // 2. tray info on a phone: tapping an empty slot explains it in a neutral toast
  await p.click("#pw-check");
  ck("tapping an empty Check explains it and how to earn it (R5)", await toastIs(p, /^Check: Mark wrong digits, briefly\. Earn one for every 9 cells you fill\.$/, true), await p.textContent("#toast"));
  ck("toast sits at the top, clear of the games row (F2)", await p.evaluate(() => document.getElementById("toast").getBoundingClientRect().top < 60));
  await p.click("#pw-undo");
  ck("tapping Undo with nothing to undo says so", await toastIs(p, /Nothing to undo yet/, true));

  // 3. earn by progress: 9 filled cells pay one charge whether right or wrong
  let e = await empties(p);
  const pre = tot(await st(p));
  for (let i = 0; i < 8; i++) { await p.locator(".c").nth(e[i]).click(); await p.keyboard.press(String(((await st(p)).solution[e[i]] % 9) + 1)); }
  ck("8 filled cells: nothing yet", tot(await st(p)) === pre);
  await p.locator(".c").nth(e[8]).click(); await p.keyboard.press(String(((await st(p)).solution[e[8]] % 9) + 1));
  let s = await st(p);
  ck("the 9th filled cell (wrong digits too) earns one charge", tot(s) === pre + 1 && s.high === 9, JSON.stringify(s.stock));
  ck("the earn toast says what the player did, in gold", await toastIs(p, /^9 cells filled: \+1 (Reveal|Check|Candidates)$/, false), await p.textContent("#toast"));
  ck("Undo now shows its infinity badge", (await p.textContent("#pw-undo i")) === "∞" && await p.locator("#pw-undo i").isVisible());
  await p.keyboard.press("u");
  s = await st(p);
  ck("Undo keeps the earned charge and the mark", tot(s) === pre + 1 && s.grid[e[8]] === 0 && s.high === 9);
  await p.keyboard.press(String((s.solution[e[8]] % 9) + 1));
  ck("re-filling after Undo pays nothing", tot(await st(p)) === pre + 1);
  for (let i = 0; i < 9; i++) { await p.evaluate(c => window.__sudoku.select(c), e[i]); await p.keyboard.press("Backspace"); }
  ck("clear the board again", (await st(p)).grid.filter((v, i) => v && !(s.puzzle[i])).length === 0);

  // 4. Reveal via keyboard on the selected cell
  const hole = e[0];
  await p.evaluate(i => window.__sudoku.select(i), hole);
  await p.keyboard.press("h");
  s = await st(p);
  ck("Reveal fills the selected cell with the true digit", s.grid[hole] === s.solution[hole] && s.stock.reveal === Math.max(0, s.stock.reveal) && s.used.reveal === 1);
  if (!s.stock.reveal) ck("Reveal slot is aria-disabled at zero", (await p.getAttribute("#pw-reveal", "aria-disabled")) === "true");

  // 5. Check: give charges, place a wrong digit, check by click
  await p.evaluate(() => { const s = window.__sudoku.state; s.stock = { reveal: 1, check: 1, cands: 1 }; window.__sudoku.state = s; });
  const h2 = (await st(p)).grid.findIndex(v => !v), truth = (await st(p)).solution[h2];
  await p.evaluate(i => window.__sudoku.select(i), h2); await p.keyboard.press(String((truth % 9) + 1));
  await p.click("#pw-check");
  ck("Check marks the wrong digit", await p.locator(".c.wrong").count() === 1 && await p.locator(".c").nth(h2).evaluate(e => e.classList.contains("wrong")));
  ck("bad news uses the neutral toast (R7)", await toastIs(p, /1 wrong digit marked/, true));
  await shot(p, "check");
  await p.waitForTimeout(2700);
  ck("Check marks fade after a moment", await p.locator(".c.wrong").count() === 0);
  await p.keyboard.press("Backspace");

  // 6. Candidates via targeting: arm with no selection, tap a cell, Esc cancels
  await p.keyboard.press("Escape"); // deselect
  await p.keyboard.press("f");
  ck("Candidates arms targeting with no cell selected", await p.locator("#board.targeting").count() === 1 && await p.locator("#pw-cands.armed").count() === 1);
  await p.keyboard.press("Escape");
  ck("Esc cancels targeting", await p.locator("#board.targeting").count() === 0 && (await st(p)).stock.cands === 1);
  await p.click("#pw-cands");
  const h3 = (await st(p)).grid.findIndex(v => !v);
  await p.locator(".c").nth(h3).click();
  s = await st(p);
  ck("Candidates fills notes in the tapped cell's box", s.notes[h3] !== 0 && (s.notes[h3] & (1 << s.solution[h3])) !== 0 && s.stock.cands === 0);
  ck("notes render in the box", await p.locator(".c .notes").count() >= 1);
  ck("pencil notes are readable on a phone (S3)", await p.evaluate(() => parseFloat(getComputedStyle(document.querySelector(".c .notes")).fontSize) >= 10.5));

  // 7. solve: end card, no reward toast, locked (R1), clock stopped
  await p.evaluate(() => { const s = window.__sudoku.state; const hole = s.grid.findIndex(v => !v); s.solution.forEach((v, k) => { if (k !== hole) s.grid[k] = v; }); window.__sudoku.state = s; window.__sudoku.select(hole); });
  await p.evaluate(() => document.getElementById("toast").classList.remove("on"));
  await p.keyboard.press(String(await p.evaluate(() => { const s = window.__sudoku.state; return s.solution[s.grid.findIndex(v => !v)]; })));
  const used = await p.evaluate(() => { const u = window.__sudoku.state.used; return u.reveal + u.check + u.cands; });
  ck("solving shows the end card: headline, summary line, primary", await p.isVisible("#win") && (await p.textContent("#win h2")) === "Solved" &&
    new RegExp("^\\d+:\\d\\d on Medium · " + used + " power-ups used$").test(await p.textContent("#win-text")), await p.textContent("#win-text"));
  ck("an assisted record is called out, the pure Best stays 'none'", (await p.textContent("#win-best")) === "New best with power-ups." && (await p.textContent("#best")) === "none");
  ck("the end card is a full-board scrim (R8)", await p.evaluate(() => { const a = document.getElementById("win").getBoundingClientRect(), b = document.getElementById("board").getBoundingClientRect(); return Math.abs(a.width - b.width) < 2 && Math.abs(a.height - b.height) < 2; }));
  ck("no toast with the end card: one channel per event (R7, F4)", !(await p.evaluate(() => document.getElementById("toast").classList.contains("on"))));
  const g0 = (await st(p)).grid.join(""), t0 = await p.evaluate(() => window.__sudoku.elapsed);
  await p.keyboard.press("u");
  ck("U on a solved board changes nothing (R1 blocker)", (await st(p)).solved && (await st(p)).grid.join("") === g0 && await p.isVisible("#win"));
  ck("Undo is shown unavailable once solved, with the reason", (await p.getAttribute("#pw-undo", "aria-disabled")) === "true" && await toastIs(p, /Not after the puzzle is solved/, true), await p.textContent("#toast"));
  await p.locator("#pw-undo").click({ force: true });
  ck("tapping Undo on a solved board changes nothing either", (await st(p)).solved && await p.isVisible("#win"));
  await p.waitForTimeout(1300);
  ck("the clock is stopped on a solved board", (await p.evaluate(() => window.__sudoku.elapsed)) === t0);
  await shot(p, "solved");
  await p.reload();
  ck("solved state survives reload and stays locked", (await st(p)).solved && await p.isVisible("#win") && (await p.textContent("#win-best")) === "New best with power-ups.");
  ck("no page errors", errs.length === 0, errs.join("|"));
  await ctx.close();

  // 8. a pure solve: Best fills in, "New best."
  ({ ctx, p, errs } = await page());
  await p.evaluate(() => { const s = window.__sudoku.state; const hole = s.grid.findIndex(v => !v); s.solution.forEach((v, k) => { if (k !== hole) s.grid[k] = v; }); s.moves = 5; window.__sudoku.state = s; window.__sudoku.select(hole); });
  await p.keyboard.press(String(await p.evaluate(() => { const s = window.__sudoku.state; return s.solution[s.grid.findIndex(v => !v)]; })));
  ck("a pure solve says New best. and fills the Best pill", (await p.textContent("#win-best")) === "New best." && /^\d+:\d\d$/.test(await p.textContent("#best")) && /No power-ups used$/.test(await p.textContent("#win-text")));
  await ctx.close();

  // 9. difficulty switch asks first (R10); an untouched puzzle switches at once
  ({ ctx, p, errs } = await page());
  await p.click("#levels button[data-l=hard]");
  ck("an untouched puzzle switches difficulty in one tap", (await st(p)).difficulty === "hard");
  e = await empties(p);
  await p.locator(".c").nth(e[0]).click(); await p.keyboard.press("5");
  const before = (await st(p)).puzzle.join("");
  await p.click("#levels button[data-l=easy]");
  ck("a puzzle in progress: the first tap only asks", (await p.textContent("#levels button[data-l=easy]")) === "Sure?" && (await st(p)).difficulty === "hard" && (await st(p)).moves === 1);
  await p.click("#levels button[data-l=easy]");
  ck("the second tap switches", (await st(p)).difficulty === "easy" && (await st(p)).moves === 0 && (await st(p)).puzzle.join("") !== before && (await p.textContent("#levels button[data-l=easy]")) === "Easy");
  e = await empties(p);
  await p.locator(".c").nth(e[0]).click(); await p.keyboard.press("5");
  await p.click("#levels button[data-l=medium]");
  await p.waitForTimeout(3200);
  ck("an unanswered Sure? times out and changes nothing", (await p.textContent("#levels button[data-l=medium]")) === "Medium" && (await st(p)).difficulty === "easy");
  await p.click("#levels button[data-l=medium]");
  ck("after the timeout it asks again", (await st(p)).difficulty === "easy");
  await ctx.close();

  // 10. reloading neither freezes the clock nor wins time (mechanics #2)
  ({ ctx, p, errs } = await page());
  e = await empties(p);
  await p.locator(".c").nth(e[0]).click(); await p.keyboard.press("5");
  const w0 = Date.now();
  for (let i = 0; i < 4; i++) { await p.waitForTimeout(900); await p.reload(); }
  await p.waitForTimeout(300);
  const el = await p.evaluate(() => window.__sudoku.elapsed), wall = (Date.now() - w0) / 1000;
  ck("the clock keeps counting through reloads", el >= wall * 0.6 && el <= wall + 1, "elapsed " + el.toFixed(2) + " of wall " + wall.toFixed(2));
  ck("no page errors across reloads", errs.length === 0, errs.join("|"));
  await ctx.close();

  // 11. keyboard: the board is a tab stop with a visible ring; Enter on a focused button runs that button (R9)
  ({ ctx, p, errs } = await page());
  await p.focus("#board");
  ck("focusing the board selects a cell for the arrows (S7)", await p.locator(".c.sel").count() === 1 && (await p.getAttribute("#board", "aria-activedescendant")) === "c40");
  await p.keyboard.press("ArrowRight");
  ck("arrows move the selection", (await p.getAttribute("#board", "aria-activedescendant")) === "c41");
  await p.keyboard.press("Tab"); await p.keyboard.press("Shift+Tab");
  ck("keyboard focus on the board shows the gold ring", await p.evaluate(() => document.activeElement.id === "board" && getComputedStyle(document.activeElement).outlineStyle === "solid"));
  const m0 = (await st(p)).moves;
  await p.focus("#notes"); await p.keyboard.press("Enter");
  ck("Enter on a focused button runs that button only", (await p.getAttribute("#notes", "aria-pressed")) === "true" && (await st(p)).moves === m0);
  await ctx.close();

  // 12. phone sizes: the main phone size does not scroll (F15); 320 does not scroll sideways
  ({ ctx, p, errs } = await page({ viewport: { width: 390, height: 844 } }));
  ck("390x844: the page fits without scrolling (F15)", await p.evaluate(() => document.documentElement.scrollHeight <= 844), await p.evaluate(() => document.documentElement.scrollHeight));
  await ctx.close();
  ({ ctx, p, errs } = await page({ viewport: { width: 320, height: 640 } }));
  await p.evaluate(() => window.__demo());
  ck("320px: no horizontal scroll, tray fits", await p.evaluate(() => document.documentElement.scrollWidth <= 320 && [...document.querySelectorAll("#tray .pw")].every(b => b.scrollWidth <= b.clientWidth + 1)));
  await ctx.close();

  // 13. an old save (before power-ups) still loads
  ({ ctx, p, errs } = await page({}, () => {
    const S = { puzzle: [], solution: [], grid: [], notes: [] };
    const base = [1,2,3,4,5,6,7,8,9, 4,5,6,7,8,9,1,2,3, 7,8,9,1,2,3,4,5,6, 2,3,4,5,6,7,8,9,1, 5,6,7,8,9,1,2,3,4, 8,9,1,2,3,4,5,6,7, 3,4,5,6,7,8,9,1,2, 6,7,8,9,1,2,3,4,5, 9,1,2,3,4,5,6,7,8];
    S.solution = base.slice(); S.puzzle = base.map((v, i) => i < 9 && i > 3 ? 0 : v); S.grid = S.puzzle.slice(); S.grid[4] = 5; S.notes = new Array(81).fill(0);
    const old = { state: Object.assign(S, { difficulty: "easy", seed: 1, moves: 1, hints: 1, history: [{ grid: S.puzzle.slice(), notes: new Array(81).fill(0) }], solved: false }), elapsed: 42, best: { easy: 300 } };
    try { if (!sessionStorage.getItem("seeded")) { localStorage.setItem("numberics_sudoku_v1", JSON.stringify(old)); sessionStorage.setItem("seeded", "1"); } } catch (e) { /* ignore */ }
  }));
  s = await st(p);
  ck("old save loads with its progress and a fresh stock", s.grid[4] === 5 && s.moves === 1 && s.stock.reveal === 1 && s.used.reveal === 1 && s.high === 1, JSON.stringify(s.stock));
  ck("old pure best still shows", (await p.textContent("#best")) === "5:00");
  ck("old elapsed time carries on", (await p.evaluate(() => window.__sudoku.elapsed)) >= 42);
  await p.keyboard.press("u");
  ck("old history still undoes", (await st(p)).grid[4] === 0);
  ck("no page errors on an old save", errs.length === 0, errs.join("|"));
  await ctx.close();

  // 14. storage blocked
  ({ ctx, p, errs } = await page({}, () => { Object.defineProperty(window, "localStorage", { get() { throw new Error("blocked"); } }); }));
  const e0 = await p.evaluate(() => window.__sudoku.state.grid.findIndex(v => !v));
  await p.locator(".c").nth(e0).click(); await p.keyboard.press("h");
  ck("runs and reveals with storage blocked", errs.length === 0 && (await st(p)).used.reveal === 1, errs.join("|"));
  await ctx.close();

  // 15. reduced motion
  ({ ctx, p, errs } = await page({ reducedMotion: "reduce" }));
  const e1 = await p.evaluate(() => window.__sudoku.state.grid.findIndex(v => !v));
  await p.locator(".c").nth(e1).click(); await p.keyboard.press("1");
  ck("reduced motion: plays", (await st(p)).moves === 1 && errs.length === 0);
  await ctx.close();
};
