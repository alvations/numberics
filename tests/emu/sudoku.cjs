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
    const t = await p.evaluate(() => { const e = document.getElementById("toast"); return { text: e.textContent, on: e.classList.contains("on"), bad: e.classList.contains("bad"), info: e.classList.contains("info") }; });
    return t.on && re.test(t.text) && (bad === undefined || (bad === "info" ? t.info && !t.bad : t.bad === bad && !t.info));
  };

  // 1. tray, layout
  let { ctx, p, errs } = await page();
  ck("tray has 4 slots: Undo Reveal Check Candidates", (await p.locator("#tray .pw").allTextContents()).map(s => s.replace(/[0-9∞]+$/, "")).join(",") === "Undo,Reveal,Check,Candidates");
  ck("Notes and Erase stay plain tools", await p.locator(".tools #notes").count() === 1 && await p.locator(".tools #erase").count() === 1);
  ck("start stock: 1 Reveal, Check and Candidates empty", JSON.stringify((await st(p)).stock) === JSON.stringify({ reveal: 1, check: 0, cands: 0 }));
  ck("Undo always shows its infinity badge, dimmed while there is nothing to undo (cold #8: no 1 then infinity)", (await p.textContent("#pw-undo i")) === "∞" && await p.locator("#pw-undo i").isVisible() && (await p.getAttribute("#pw-undo", "aria-disabled")) === "true");
  ck("tray buttons are never disabled, only aria-disabled (R5)", await p.evaluate(() => [...document.querySelectorAll("#tray .pw")].every(b => !b.disabled)));
  ck("tray tooltips in the family voice", (await p.getAttribute("#pw-reveal", "title")) === "H: Reveal. Show the right digit for one cell.");
  ck("no horizontal scroll at 375px", await p.evaluate(() => document.documentElement.scrollWidth <= 375));
  ck("tray labels fit their buttons", await p.evaluate(() => [...document.querySelectorAll("#tray .pw")].every(b => b.scrollWidth <= b.clientWidth + 1)));
  ck("subtitle: Numberics link and a tagline, no live status (R6)", /^Numberics · [A-Z][^.]*\.$/.test((await p.textContent(".sub")).trim()) && await p.locator(".sub a[href='../']").count() === 1);
  ck("empty Best reads 'none', not a hyphen (R11)", (await p.textContent("#best")) === "none");
  ck("empty Best uses the family's one empty style: dimmed, weight 600, same size as values (TRIAGE3)", await p.evaluate(() => {
    const b = getComputedStyle(document.getElementById("best")), t = getComputedStyle(document.getElementById("time"));
    return b.fontWeight === "600" && b.fontSize === t.fontSize && b.color === "rgb(154, 155, 176)"; }));
  ck("New puzzle button is 16px like the family (F17)", await p.evaluate(() => getComputedStyle(document.getElementById("new")).fontSize) === "16px");
  ck("board grid has role=row children (valid ARIA)", await p.locator("#board > [role=row]").count() === 9 && await p.locator("#board [role=row] > [role=gridcell]").count() === 81);

  // 2. tray info on a phone: tapping an empty slot explains it in a neutral toast
  await p.click("#pw-check", { force: true });
  ck("tapping an empty Check explains it in the neutral info toast (R5, R7: not the red-edged warning)", await toastIs(p, /^Check: Mark wrong digits, briefly\. Earn one per 9 cells with no clash\.$/, "info"), await p.textContent("#toast"));
  ck("the info toast is neutral: no red edge", await p.evaluate(() => { const c = getComputedStyle(document.getElementById("toast")); return c.borderTopColor !== "rgb(255, 107, 107)" && c.backgroundColor !== "rgb(242, 184, 75)"; }));
  ck("toast is clear of the title and the games row (F2)", await p.evaluate(() => { const t = document.getElementById("toast").getBoundingClientRect(), h = document.querySelector("h1").getBoundingClientRect(), g = document.getElementById("games").getBoundingClientRect(); return t.top >= h.bottom && t.bottom <= g.top; }));
  await p.click("#pw-undo", { force: true });
  ck("tapping Undo with nothing to undo says so", await toastIs(p, /Nothing to undo yet/, "info"));

  // 3. earn by progress: 9 filled cells that clash with nothing pay one charge whether right or wrong
  // 9 cells with a digit each that clashes with nothing, wrong where possible (planned greedily on a copy of the board)
  const plan = await p.evaluate(() => {
    const S = window.NumbericsSudoku, s = window.__sudoku.state, g = s.grid.slice(), out = [];
    for (let c = 0; c < 81 && out.length < 9; c++) {
      if (g[c]) continue;
      const m = S.candidates(g, c); if (!m) continue;
      let d = 0; for (let x = 1; x <= 9; x++) if ((m & (1 << x)) && (!d || x !== s.solution[c])) { d = x; if (x !== s.solution[c]) break; }
      g[c] = d; out.push([c, d]);
    }
    return out;
  });
  let e = plan.map(x => x[0]);
  const quietDigit = async (c) => plan.find(x => x[0] === c)[1];
  const pre = tot(await st(p));
  for (let i = 0; i < 8; i++) { await p.locator(".c").nth(e[i]).click(); await p.keyboard.press(String(await quietDigit(e[i]))); }
  ck("8 filled cells: nothing yet", tot(await st(p)) === pre && await p.locator(".c.bad").count() === 0);
  await p.locator(".c").nth(e[8]).click(); await p.keyboard.press(String(await quietDigit(e[8])));
  let s = await st(p);
  ck("the 9th filled cell with no clash (wrong digits too) earns one charge", tot(s) === pre + 1 && s.high === 9, JSON.stringify(s.stock));
  ck("the earn toast says what the player did, in gold, in the family form", await toastIs(p, /^9 cells filled: \+(Reveal|Check|Candidates)$/, false), await p.textContent("#toast"));
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
  ck("Reveal says what it did in a toast, like every power-up (craft #2)", await toastIs(p, new RegExp("^Revealed: " + s.solution[hole] + "$"), false), await p.textContent("#toast"));
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
  ck("Candidates says what it did in a toast (craft #2)", await toastIs(p, /^Box notes filled$/, false), await p.textContent("#toast"));
  ck("notes render in the box", await p.locator(".c .notes").count() >= 1);
  ck("pencil notes are readable on a phone (S3)", await p.evaluate(() => parseFloat(getComputedStyle(document.querySelector(".c .notes")).fontSize) >= 10.5));

  // 7. solve: end card, no reward toast, locked (R1), clock stopped
  await p.evaluate(() => { const s = window.__sudoku.state; const hole = s.grid.findIndex(v => !v); s.solution.forEach((v, k) => { if (k !== hole) s.grid[k] = v; }); window.__sudoku.state = s; window.__sudoku.select(hole); });
  await p.evaluate(() => document.getElementById("toast").classList.remove("on"));
  const newTop = await p.evaluate(() => document.getElementById("new").getBoundingClientRect().top);
  const lastDigit = String(await p.evaluate(() => { const s = window.__sudoku.state; return s.solution[s.grid.findIndex(v => !v)]; }));
  // TRIAGE3: the finished grid is seen, undimmed, for 1.5 s before the card. Measured in the page from the keypress.
  await p.evaluate(() => {
    window.__seen = null; window.__pressT = null;
    addEventListener("keydown", () => { window.__pressT = performance.now(); }, { once: true, capture: true });
    const w = document.getElementById("win");
    new MutationObserver(() => { if (!w.hidden && window.__seen === null) window.__seen = performance.now() - window.__pressT; }).observe(w, { attributes: true });
  });
  await p.keyboard.press(lastDigit);
  ck("the last digit: the board shows bright first, no card, no dim, no selection", (await st(p)).solved && await p.locator("#win").isHidden() && await p.locator(".c.sel, .c.peer, .c.same").count() === 0);
  await shot(p, "solve-moment");
  await p.waitForFunction(() => window.__seen !== null, null, { timeout: 4000 }).catch(() => null);
  const seen = await p.evaluate(() => window.__seen);
  ck("the card arrives 1.5 s after the last digit (measured " + Math.round(seen) + " ms)", seen >= 1450 && seen <= 1900, String(seen));
  ck("the card's primary has the focus (one end-card pattern)", await p.evaluate(() => document.activeElement && document.activeElement.id === "again"));
  ck("the page's New puzzle is hidden while the card shows, its space kept (no gap jump)", await p.evaluate((t) => {
    const n = document.getElementById("new"); return getComputedStyle(n).visibility === "hidden" && Math.abs(n.getBoundingClientRect().top - t) < 1; }, newTop));
  ck("the card offers See the board beside its primary", (await p.textContent("#win-view")) === "See the board" && await p.locator("#win .row #again").count() === 1);
  const used = await p.evaluate(() => { const u = window.__sudoku.state.used; return u.reveal + u.check + u.cands; });
  ck("solving shows the end card: headline, summary line, primary", await p.isVisible("#win") && (await p.textContent("#win h2")) === "Solved" &&
    new RegExp("^\\d+:\\d\\d on Medium · " + used + " power-ups used$").test(await p.textContent("#win-text")), await p.textContent("#win-text"));
  ck("an assisted record is a plain fact that explains the empty Best (mechanics #2, craft #1)", (await p.textContent("#win-best")) === "Fastest with power-ups. Best counts only solves without them." &&
    (await p.textContent("#best")) === "none" && !(await p.evaluate(() => document.getElementById("win-best").classList.contains("best"))));
  ck("the end card is a full-board scrim (R8)", await p.evaluate(() => { const a = document.getElementById("win").getBoundingClientRect(), b = document.getElementById("board").getBoundingClientRect(); return Math.abs(a.width - b.width) < 2 && Math.abs(a.height - b.height) < 2; }));
  ck("no toast with the end card: one channel per event (R7, F4)", !(await p.evaluate(() => document.getElementById("toast").classList.contains("on"))));
  const g0 = (await st(p)).grid.join(""), t0 = await p.evaluate(() => window.__sudoku.elapsed);
  await p.keyboard.press("u");
  ck("U on a solved board changes nothing (R1 blocker)", (await st(p)).solved && (await st(p)).grid.join("") === g0 && await p.isVisible("#win"));
  // a toast never sits on the end card (shared kit), so the card speaks alone; the slot is marked unavailable
  ck("Undo is shown unavailable once solved", (await p.getAttribute("#pw-undo", "aria-disabled")) === "true" && /not available now/.test(await p.getAttribute("#pw-undo", "aria-label")));
  await p.waitForTimeout(150);
  ck("no toast over the end card", !(await p.evaluate(() => document.getElementById("toast").classList.contains("on"))));
  await p.locator("#pw-undo").click({ force: true });
  ck("tapping Undo on a solved board changes nothing either", (await st(p)).solved && await p.isVisible("#win"));
  await p.waitForTimeout(1300);
  ck("the clock is stopped on a solved board", (await p.evaluate(() => window.__sudoku.elapsed)) === t0);
  await shot(p, "solved");
  // See the board: the card hides, the finished grid shows undimmed; a tap on the board brings the card back
  await p.click("#win-view");
  ck("See the board hides the card and shows the page's New puzzle again", await p.locator("#win").isHidden() && await p.evaluate(() => getComputedStyle(document.getElementById("new")).visibility === "visible"));
  ck("See the board says how to get back", await toastIs(p, /^Tap the board for the summary\.$/, "info"), await p.textContent("#toast"));
  await shot(p, "see-board");
  await p.locator(".c").nth(40).click();
  ck("a tap on the board brings the card back, focus on its primary", await p.isVisible("#win") && await p.evaluate(() => document.activeElement.id === "again") && (await st(p)).grid.join("") === g0);
  await p.click("#win-view"); await p.keyboard.press("Escape");
  ck("Esc brings the card back too", await p.isVisible("#win"));
  await p.reload();
  ck("solved state survives reload and stays locked", (await st(p)).solved && await p.isVisible("#win") && /^Fastest with power-ups\./.test(await p.textContent("#win-best")));
  ck("no page errors", errs.length === 0, errs.join("|"));
  await ctx.close();

  // 8. a pure solve: Best fills in, "New best."
  ({ ctx, p, errs } = await page());
  await p.evaluate(() => { const s = window.__sudoku.state; const hole = s.grid.findIndex(v => !v); s.solution.forEach((v, k) => { if (k !== hole) s.grid[k] = v; }); s.moves = 5; window.__sudoku.state = s; window.__sudoku.select(hole); });
  await p.keyboard.press(String(await p.evaluate(() => { const s = window.__sudoku.state; return s.solution[s.grid.findIndex(v => !v)]; })));
  await p.locator(".c").nth(0).click(); // a tap on the finished board skips the rest of the hold
  ck("a tap during the hold shows the card at once", await p.isVisible("#win"));
  ck("a pure record is celebrated in gold", await p.evaluate(() => document.getElementById("win-best").classList.contains("best")));
  ck("a pure solve says New best. and fills the Best pill", (await p.textContent("#win-best")) === "New best." && /^\d+:\d\d$/.test(await p.textContent("#best")) && /No power-ups used$/.test(await p.textContent("#win-text")));
    // a new puzzle during the hold: the old card never appears over it (the timer is guarded)
  await p.click("#again");
  await p.evaluate(() => { const s = window.__sudoku.state; const hole = s.grid.findIndex(v => !v); s.solution.forEach((v, k) => { if (k !== hole) s.grid[k] = v; }); s.moves = 5; window.__sudoku.state = s; window.__sudoku.select(hole); });
  await p.keyboard.press(String(await p.evaluate(() => { const s = window.__sudoku.state; return s.solution[s.grid.findIndex(v => !v)]; })));
  await p.click("#new");
  await p.waitForTimeout(1800);
  ck("New puzzle during the hold: a fresh unsolved board, no stale card", !(await st(p)).solved && await p.locator("#win").isHidden());
  // a clash on the blue same-digit fill stays readable (craft nit 4)
  ck("a red clash digit on the same-digit fill keeps 4.5:1", await p.evaluate(() => {
    const s = window.__sudoku.state, c = s.grid.findIndex(v => !v), peer = window.NumbericsSudoku.PEERS[c].find(k => s.grid[k]);
    const d = s.grid[peer]; s.grid[c] = d; window.__sudoku.state = s;
    const other = s.grid.findIndex((v, k) => v === d && k !== c && k !== peer); window.__sudoku.select(other);
    const el = document.querySelectorAll(".c")[c];
    if (!el.classList.contains("bad") || !el.classList.contains("same")) return false;
    const L = (rgb) => { const v = rgb.match(/\d+/g).slice(0, 3).map(x => { x = x / 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
    const cs = getComputedStyle(el), a = L(cs.color), b = L(cs.backgroundColor);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) >= 4.5; }));
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

  // 12b. junk fill (TRIAGE2 Sudoku, mechanics #2): type 1 into every empty cell of a Hard puzzle, then erase it all
  ({ ctx, p, errs } = await page());
  await p.click("#levels button[data-l=hard]");
  e = await empties(p);
  const j0 = tot(await st(p));
  for (const c of e) { await p.evaluate(i => window.__sudoku.select(i), c); await p.keyboard.press("1"); }
  s = await st(p);
  ck("junk fill: 1 in every empty cell pays at most one charge", tot(s) - j0 <= 1, (tot(s) - j0) + " paid, mark " + s.high);
  ck("junk fill: the red cells are exactly the ones that do not count", await p.evaluate(() => { const S = window.NumbericsSudoku, s = window.__sudoku.state;
    return S.progress(s) === [...document.querySelectorAll(".c:not(.given)")].filter(c => c.textContent && !c.classList.contains("bad")).length; }));
  for (const c of e) { await p.evaluate(i => window.__sudoku.select(i), c); await p.keyboard.press("Backspace"); }
  ck("junk fill: erasing it all leaves a Hard puzzle with the starting stock or one more", tot(await st(p)) - j0 <= 1);
  await ctx.close();

  // 12c. aiming (craft #1, #2): the instruction never covers the board, Esc clears it, tapping the slot again clears it
  for (const vp of [{ width: 375, height: 667 }, { width: 390, height: 844 }, { width: 1280, height: 860 }]) {
    ({ ctx, p, errs } = await page({ viewport: vp }));
    await p.evaluate(() => { const s = window.__sudoku.state; s.stock = { reveal: 1, check: 0, cands: 1 }; window.__sudoku.state = s; });
    await p.keyboard.press("Escape"); await p.click("#pw-reveal");
    const clear = () => p.evaluate(() => { const t = document.getElementById("toast").getBoundingClientRect(), b = document.getElementById("board").getBoundingClientRect();
      return document.getElementById("toast").classList.contains("on") && (t.bottom <= b.top || t.top >= b.bottom); });
    ck(vp.width + ": the aiming toast is on and clear of every cell", await p.locator("#board.targeting").count() === 1 && await clear(), await p.textContent("#toast"));
    if (vp.width === 375) await shot(p, "aiming-375");
    await p.keyboard.press("Escape");
    ck(vp.width + ": Esc cancels aiming and clears its instruction", await p.locator("#board.targeting").count() === 0 && !(await p.evaluate(() => document.getElementById("toast").classList.contains("on"))));
    await p.click("#pw-cands"); await p.click("#pw-cands");
    ck(vp.width + ": tapping the armed slot again clears it too", await p.locator("#board.targeting").count() === 0 && !(await p.evaluate(() => document.getElementById("toast").classList.contains("on"))));
    if (vp.width === 375) { // scrolled so the board touches the top: the instruction moves below the board, never onto it
      await p.evaluate(() => { document.body.style.paddingBottom = "900px"; window.scrollTo(0, document.getElementById("board").getBoundingClientRect().top + window.scrollY - 4); });
      await p.click("#pw-reveal");
      ck("375 scrolled: the aiming toast still clears the board", await clear(), JSON.stringify(await p.evaluate(() => [document.getElementById("toast").getBoundingClientRect().top, document.getElementById("board").getBoundingClientRect().bottom])));
      await p.keyboard.press("Escape");
    }
    ck(vp.width + ": no page errors while aiming", errs.length === 0, errs.join("|"));
    await ctx.close();
  }

  // 12d. R17: Enter on a focused games-row link navigates, and a digit there places nothing
  ({ ctx, p, errs } = await page());
  e = await empties(p); await p.evaluate(i => window.__sudoku.select(i), e[0]);
  await p.focus("#games a[href]:not([aria-current])");
  await p.keyboard.press("5");
  ck("a digit typed on a focused link places nothing (R17)", (await st(p)).moves === 0);
  const target = await p.evaluate(() => document.activeElement.href);
  await Promise.all([p.waitForURL(u => u.toString() !== url + "sudoku/", { timeout: 5000 }).catch(() => null), p.keyboard.press("Enter")]);
  ck("Enter on a focused games-row link navigates (R17)", p.url() === target, p.url() + " vs " + target);
  await ctx.close();

  // 12e. 320 wide: the tagline keeps one line (craft #3)
  ({ ctx, p, errs } = await page({ viewport: { width: 320, height: 568 } }));
  ck("320px: the tagline fits on one line", await p.evaluate(() => { const s = document.querySelector(".sub"); return s.getClientRects().length && s.getBoundingClientRect().height < parseFloat(getComputedStyle(s).fontSize) * 2; }));
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
