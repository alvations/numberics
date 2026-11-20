/* SPDX-License-Identifier: Apache-2.0 | Copyright 2026 alvations (Melon Lab)
 * Browser checks for Sudoku power-ups (tests/emu/run.cjs module). */
"use strict";
module.exports = async function ({ browser, url, ck, shot }) {
  const page = async (opts, init) => {
    const ctx = await browser.newContext(Object.assign({ viewport: { width: 375, height: 900 }, deviceScaleFactor: 2 }, opts || {}));
    const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
    if (init) await p.addInitScript(init);
    await p.goto(url + "sudoku/"); return { ctx, p, errs };
  };
  const st = (p) => p.evaluate(() => window.__sudoku.state);

  // 1. tray, play, earn
  let { ctx, p, errs } = await page();
  ck("tray has 4 slots: Undo Reveal Check Candidates", (await p.locator("#tray .pw").allTextContents()).map(s => s.replace(/[0-9∞]+$/, "")).join(",") === "Undo,Reveal,Check,Candidates");
  ck("Notes and Erase stay plain tools", await p.locator(".tools #notes").count() === 1 && await p.locator(".tools #erase").count() === 1);
  ck("start stock: 1 Reveal, Check and Candidates empty", JSON.stringify((await st(p)).stock) === JSON.stringify({ reveal: 1, check: 0, cands: 0 }));
  ck("Undo badge says free", (await p.textContent("#pw-undo i")) === "∞");
  ck("no horizontal scroll at 375px", await p.evaluate(() => document.documentElement.scrollWidth <= 375));
  ck("tray labels fit their buttons", await p.evaluate(() => [...document.querySelectorAll("#tray .pw")].every(b => b.scrollWidth <= b.clientWidth + 1)));
  // finish one unit by typing: earn a charge
  const plan = await p.evaluate(() => { const s = window.__sudoku.state;
    for (let u = 0; u < 27; u++) { const e = window.NumbericsSudoku.UNIT[u].filter(c => !s.grid[c]); if (e.length >= 2) return e.map(c => [c, s.solution[c]]); } });
  const tot = (x) => x.stock.reveal + x.stock.check + x.stock.cands;
  for (const [c, d] of plan.slice(0, -1)) { await p.locator(".c").nth(c).click(); await p.keyboard.press(String(d)); }
  const pre = tot(await st(p)), [lc, ld] = plan[plan.length - 1];
  await p.locator(".c").nth(lc).click(); await p.keyboard.press(String(ld));
  let s = await st(p);
  ck("completing a correct unit earns one charge", tot(s) === pre + 1, JSON.stringify(s.stock));
  ck("the earn toast shows", /Unit complete/.test(await p.textContent("#toast")));
  await p.keyboard.press("u");
  s = await st(p);
  ck("Undo (free) rewinds the reward", tot(s) === pre && s.grid[lc] === 0);

  // 2. Reveal via keyboard on the selected cell
  const hole = s.grid.findIndex(v => !v);
  await p.evaluate(i => window.__sudoku.select(i), hole);
  await p.keyboard.press("h");
  s = await st(p);
  ck("Reveal fills the selected cell with the true digit", s.grid[hole] === s.solution[hole] && s.stock.reveal === 0 && s.used.reveal === 1);
  ck("Reveal slot is disabled at zero", await p.locator("#pw-reveal").isDisabled());

  // 3. Check: give charges, place a wrong digit, check by click
  await p.evaluate(() => { const s = window.__sudoku.state; s.stock = { reveal: 1, check: 1, cands: 1 }; window.__sudoku.state = s; });
  const h2 = (await st(p)).grid.findIndex(v => !v), truth = (await st(p)).solution[h2];
  await p.evaluate(i => window.__sudoku.select(i), h2); await p.keyboard.press(String((truth % 9) + 1));
  await p.click("#pw-check");
  ck("Check marks the wrong digit", await p.locator(".c.wrong").count() === 1 && await p.locator(".c").nth(h2).evaluate(e => e.classList.contains("wrong")));
  await shot(p, "check");
  await p.waitForTimeout(2700);
  ck("Check marks fade after a moment", await p.locator(".c.wrong").count() === 0);
  await p.keyboard.press("Backspace");

  // 4. Candidates via targeting: arm with no selection, tap a cell, Esc cancels
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

  // 5. solve: overlay counts power-ups; best keeps them
  await p.evaluate(() => { const s = window.__sudoku.state; const hole = s.grid.findIndex(v => !v); s.solution.forEach((v, k) => { if (k !== hole) s.grid[k] = v; }); window.__sudoku.state = s; window.__sudoku.select(hole); });
  await p.keyboard.press(String(await p.evaluate(() => { const s = window.__sudoku.state; return s.solution[s.grid.findIndex(v => !v)]; })));
  ck("solving shows the overlay with the power-up count", await p.isVisible("#win") && /with 3 power-ups/.test(await p.textContent("#win-text")), await p.textContent("#win-text"));
  ck("an assisted best is shown with its count", /\+3$/.test(await p.textContent("#best")), await p.textContent("#best"));
  await p.reload();
  ck("state and assisted best survive reload", (await st(p)).solved && /\+3$/.test(await p.textContent("#best")));
  ck("no page errors", errs.length === 0, errs.join("|"));
  await ctx.close();

  // 6. an old save (before power-ups) still loads
  ({ ctx, p, errs } = await page({}, () => {
    const S = { puzzle: [], solution: [], grid: [], notes: [] };
    // a known valid grid; blank the first row's last 5 cells
    const base = [1,2,3,4,5,6,7,8,9, 4,5,6,7,8,9,1,2,3, 7,8,9,1,2,3,4,5,6, 2,3,4,5,6,7,8,9,1, 5,6,7,8,9,1,2,3,4, 8,9,1,2,3,4,5,6,7, 3,4,5,6,7,8,9,1,2, 6,7,8,9,1,2,3,4,5, 9,1,2,3,4,5,6,7,8];
    S.solution = base.slice(); S.puzzle = base.map((v, i) => i < 9 && i > 3 ? 0 : v); S.grid = S.puzzle.slice(); S.grid[4] = 5; S.notes = new Array(81).fill(0);
    const old = { state: Object.assign(S, { difficulty: "easy", seed: 1, moves: 1, hints: 1, history: [{ grid: S.puzzle.slice(), notes: new Array(81).fill(0) }], solved: false }), elapsed: 42, best: { easy: 300 } };
    try { localStorage.setItem("numberics_sudoku_v1", JSON.stringify(old)); } catch (e) { /* ignore */ }
  }));
  s = await st(p);
  ck("old save loads with its progress and a fresh stock", s.grid[4] === 5 && s.moves === 1 && s.stock.reveal === 1 && s.used.reveal === 1, JSON.stringify(s.stock));
  ck("old pure best still shows", (await p.textContent("#best")) === "5:00");
  await p.keyboard.press("u");
  ck("old history still undoes", (await st(p)).grid[4] === 0);
  ck("no page errors on an old save", errs.length === 0, errs.join("|"));
  await ctx.close();

  // 7. storage blocked
  ({ ctx, p, errs } = await page({}, () => { Object.defineProperty(window, "localStorage", { get() { throw new Error("blocked"); } }); }));
  const e0 = await p.evaluate(() => window.__sudoku.state.grid.findIndex(v => !v));
  await p.locator(".c").nth(e0).click(); await p.keyboard.press("h");
  ck("runs and reveals with storage blocked", errs.length === 0 && (await st(p)).used.reveal === 1, errs.join("|"));
  await ctx.close();

  // 8. reduced motion
  ({ ctx, p, errs } = await page({ reducedMotion: "reduce" }));
  const e1 = await p.evaluate(() => window.__sudoku.state.grid.findIndex(v => !v));
  await p.locator(".c").nth(e1).click(); await p.keyboard.press("1");
  ck("reduced motion: plays", (await st(p)).moves === 1 && errs.length === 0);
  await ctx.close();
};
