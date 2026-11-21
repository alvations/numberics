/* SPDX-License-Identifier: Apache-2.0 | Copyright 2026 alvations (Melon Lab)
 * Browser checks for Six (run by tests/emu/run.cjs). */
"use strict";
const playFit = require("./_fit.cjs");
module.exports = async function ({ browser, url, ck, shot }) {
  const page = url + "six/";
  // the how-to sheet opens by itself on a first visit; these checks play as a returning player (section 12 checks it)
  const SEEN = () => { try { const k = "numberics_progress_v1"; const d = JSON.parse(localStorage.getItem(k) || "null") || { v: 1, games: {}, howto: {}, daily: {} };
    d.howto = d.howto || {}; d.howto.six = true; localStorage.setItem(k, JSON.stringify(d)); } catch (e) { /* blocked storage */ } };
  const newCtx = async (o, fresh) => { const c = await browser.newContext(o); if (!fresh) await c.addInitScript(SEEN); return c; };
  // the line's known solution, read from the page's engine
  const sol = p => p.evaluate(() => { const s = window.__six.state; return s.lines[s.idx].sol; });
  const st = p => p.evaluate(() => { const s = window.__six.state; return { idx: s.idx, done: s.done, cur: s.cur, power: s.power, over: s.over, round: s.round, solved: s.solved, n: s.lines[s.idx].n, mode: s.mode, ended: !!s.ended }; });

  // 1. loads, plays a whole line by touch-style clicks and a drag
  let ctx = await newCtx({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2 });
  let p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto(page);
  ck("line drawn as tiles", await p.locator("#line .num").count() >= 3);
  ck("gold target shown", /^6/.test(await p.textContent("#target")));
  ck("unset gaps show ?", (await p.textContent("#val")).trim() === "= ?");
  ck("R6 header: Numberics link then a tagline", (await p.textContent(".sub")) === "Numberics · Every line makes six, then 66, 6.6, 666." && (await p.getAttribute(".sub a", "href")) === "../");
  ck("the first line needs only + - x /", await p.evaluate(() => window.__six.E.plain(window.__six.state.lines[0])));
  ck("a fresh board prompts the first move", /Tap a gap/.test(await p.textContent("#hint")));
  // force a known line with a bracket and a sign: 8 8 8 -> (sqrt(8 / 8 + 8))!
  await p.evaluate(() => {
    const E = window.__six.E, s = JSON.parse(JSON.stringify(window.__six.state));
    const id = E.BANK.findIndex(b => b.n === "8 8 8"), b = E.BANK[id];
    s.lines[0] = { id, t: 1, n: b.n.split(" "), g: b.g, d: b.d, sol: b.s }; s.idx = 0; s.cur = E.blank(3); s.done = false; s.edits = 0;
    window.__six.state = s;
  });
  const S = await sol(p);
  for (let k = 0; k < S.g.length; k++) {
    for (let guard = 0; guard < 6 && (await st(p)).cur.g[k] !== S.g[k]; guard++) await p.locator('.gp[data-g="' + k + '"]').click();
  }
  ck("gaps set by tapping", JSON.stringify((await st(p)).cur.g) === JSON.stringify(S.g));
  // drag from the first to the last number makes a bracket
  const a = await p.locator('.num[data-i="0"]').boundingBox(), z = await p.locator('.num[data-i="2"]').boundingBox();
  await p.mouse.move(a.x + a.width / 2, a.y + a.height / 2); await p.mouse.down();
  await p.mouse.move(z.x + z.width / 2, z.y + z.height / 2, { steps: 6 });
  ck("drag shows a bracket preview", await p.locator(".bar.ghost").count() === 1);
  await p.mouse.up();
  ck("drag placed a bracket", JSON.stringify((await st(p)).cur.b) === "[[0,2,0]]");
  await p.waitForTimeout(200); // the bar grows for 180 ms (Playwright waits for a still target and scrolls on retries)
  for (let guard = 0; guard < 6 && (await st(p)).cur.b[0][2] !== S.b[0][2]; guard++) await p.locator(".bar").first().click();
  ck("live value shows", /^= \d/.test((await p.textContent("#val")).trim()));
  ck("line turns gold on the target", await p.locator("#board.gold").count() === 1 && (await st(p)).done);
  ck("Next line shows", await p.isVisible("#next"));
  ck("R7: a made line is said once (hint line), no toast but the first-six trophy", /^Made 6\./.test(await p.textContent("#hint")) && !(await p.locator("#toast.on:not(.trophy)").count()) && /^(Trophy: Made six|\d trophies: )/.test(await p.textContent("#toast")), await p.textContent("#toast"));
  await shot(p, "solved");
  // tapping a number cycles its sign
  await p.click("#next"); await p.waitForTimeout(250); // the next line slides in for 220 ms
  const before = (await st(p)).cur.u[0];
  const t0 = await p.locator('.num[data-i="0"]').boundingBox();
  await p.mouse.click(t0.x + t0.width / 2, t0.y + t0.height / 2);
  ck("tap on a number cycles its sign", (await st(p)).cur.u[0] === (before + 1) % 5, before + " " + JSON.stringify((await st(p)).cur));
  ck("sign chip drawn", await p.locator('.num[data-i="0"] .sg').count() === 1);

  // 2. keyboard: type a whole solution
  await p.evaluate(() => {
    const E = window.__six.E, s = JSON.parse(JSON.stringify(window.__six.state));
    const id = E.BANK.findIndex(b => b.n === "0 0 0"), b = E.BANK[id];
    s.lines[s.idx] = { id, t: 1, n: b.n.split(" "), g: b.g, d: b.d, sol: b.s }; s.cur = E.blank(3); s.done = false;
    window.__six.state = s;
  });
  await p.focus("#board");
  // a value that is not exact states the rule
  await p.keyboard.press("+"); await p.keyboard.press("+"); await p.keyboard.press("ArrowLeft"); await p.keyboard.press("ArrowLeft"); await p.keyboard.press("ArrowLeft"); await p.keyboard.press("ArrowLeft");
  await p.keyboard.press("!"); await p.keyboard.press("!"); // (sqrt 0)! is 1, fine; now an inexact one
  await p.evaluate(() => { const s = JSON.parse(JSON.stringify(window.__six.state)); s.cur = { g: ["/", "+"], u: [0, 0, 0], b: [] }; window.__six.state = s; });
  ck("no exact value states the exactness rule", (await p.textContent("#val")).trim() === "= no exact value" && /whole number or a fraction/.test(await p.textContent("#hint")));
  await p.evaluate(() => { const s = JSON.parse(JSON.stringify(window.__six.state)); s.cur = window.__six.E.blank(3); window.__six.state = s; });
  await p.focus("#board");
  // (0! + 0! + 0!)!  : cursor on the 1st number
  for (const k of ["!", "+", "!", "+", "!"]) await p.keyboard.press(k);
  await p.keyboard.press("ArrowLeft"); await p.keyboard.press("ArrowLeft"); await p.keyboard.press("ArrowLeft"); await p.keyboard.press("ArrowLeft");
  await p.keyboard.press("("); await p.keyboard.press("ArrowRight"); await p.keyboard.press("ArrowRight"); await p.keyboard.press("ArrowRight"); await p.keyboard.press("ArrowRight");
  await p.keyboard.press(")"); await p.keyboard.press("b"); await p.keyboard.press("b");
  const ks = await st(p);
  ck("keyboard builds (0! + 0! + 0!)!", ks.done && (await p.textContent("#expr")) === "(0! + 0! + 0!)!", JSON.stringify(ks.cur) + " " + await p.textContent("#expr"));
  await p.keyboard.press("Enter");
  ck("Enter moves to the next line", !(await st(p)).done);

  // 3. power-ups
  await p.evaluate(() => { const s = JSON.parse(JSON.stringify(window.__six.state)); s.power = { hint: 2, skip: 1, peek: 1, undo: 1 }; window.__six.state = s; });
  let s0 = await st(p);
  ck("tray order is Undo, Hint, Skip, Peek (R5)", JSON.stringify(await p.$$eval("#tray .pw", bs => bs.map(b => b.firstChild.textContent))) === '["Undo","Hint","Skip","Peek"]');
  ck("tray tooltip voice", (await p.getAttribute("#tray .pw:first-child", "title")) === "1: Undo. Take back the last edit.");
  await p.keyboard.press("2");
  let s1 = await st(p);
  const S2 = await sol(p);
  ck("Hint sets one gap of the known solution", s1.power.hint === 1 && s1.cur.g[0] === S2.g[0] && JSON.stringify(s1.cur) !== JSON.stringify(s0.cur));
  await p.keyboard.press("4");
  ck("Peek shows a part's value", /^Peek: .+ make /.test(await p.textContent("#hint")) && (await st(p)).power.peek === 0);
  ck("peeked numbers are marked", await p.locator(".num.pk").count() >= 1);
  await shot(p, "peek");
  const n0 = (await st(p)).n.join(" "), idx0 = (await st(p)).idx;
  await p.keyboard.press("3");
  const s3 = await st(p);
  ck("Skip gives a new line in the same place", s3.power.skip === 0 && s3.idx === idx0 && s3.n.join(" ") !== n0 && JSON.stringify(s3.cur.g.filter(Boolean)) === "[]");
  await p.locator('.gp[data-g="0"]').click();
  ck("edit made", (await st(p)).cur.g[0] === "+");
  await p.keyboard.press("1");
  const s4 = await st(p);
  ck("Undo takes back the last edit", s4.cur.g[0] === "" && s4.power.undo === 0);
  // R5: a slot that cannot act explains itself on a tap (and on its key)
  await p.locator("#tray .pw").nth(0).click({ force: true }); // aria-disabled: a real tap still lands
  ck("empty Undo tap explains itself", /^Undo: Take back the last edit\. Three lines in a row made without help earn one\.$/.test(await p.textContent("#hint")), await p.textContent("#hint"));
  ck("empty slots are aria-disabled, never disabled", await p.locator("#tray .pw[aria-disabled=true]").count() >= 1 && await p.locator("#tray .pw:disabled").count() === 0);
  await p.keyboard.press("3");
  ck("key on an empty slot explains it too", /^Skip: /.test(await p.textContent("#hint")));
  // R9: Enter / Space on a focused button is that button's click, never an edit at the cursor
  const kb0 = await st(p);
  await p.focus('.gp[data-g="1"]'); await p.keyboard.press("Enter");
  const kb1 = await st(p);
  ck("Enter on a focused gap cycles that gap only", kb1.cur.g[1] !== kb0.cur.g[1] && JSON.stringify(kb1.cur.u) === JSON.stringify(kb0.cur.u) && kb1.cur.g[0] === kb0.cur.g[0], JSON.stringify(kb0.cur) + " " + JSON.stringify(kb1.cur));
  await p.keyboard.press(" ");
  const kb2 = await st(p);
  ck("Space on a focused gap cycles that gap only", kb2.cur.g[1] !== kb1.cur.g[1] && JSON.stringify(kb2.cur.u) === JSON.stringify(kb1.cur.u));
  await p.focus("#brk"); await p.keyboard.press("Enter");
  ck("Enter on Brackets toggles bracket mode, edits nothing", (await p.getAttribute("#brk", "aria-pressed")) === "true" && JSON.stringify((await st(p)).cur) === JSON.stringify(kb2.cur));
  await p.keyboard.press("Escape");
  ck("focus ring on a gap sits on its chip", await p.evaluate(() => { const g = document.querySelector('.gp[data-g="0"]'); g.focus(); const b = getComputedStyle(g.querySelector("b")); return b.outlineStyle === "solid" && getComputedStyle(g).outlineStyle === "none"; }));
  // Clear asks first (a stray c must not wipe a line)
  await p.focus("#board"); await p.keyboard.press("c");
  ck("c once only arms Clear", JSON.stringify((await st(p)).cur) === JSON.stringify(kb2.cur) && (await p.textContent("#clear")) === "Sure? Clear");
  await p.keyboard.press("c");
  ck("c twice clears", (await st(p)).cur.g.every(g => !g));
  await p.keyboard.press("Escape");

  // 4. round end, then the next round climbs a tier
  await p.evaluate(() => {
    const E = window.__six.E; let s = JSON.parse(JSON.stringify(window.__six.state));
    s.idx = 5; s.cur = E.blank(s.lines[5].n.length); s.done = false; window.__six.state = s;
  });
  const S5 = await sol(p);
  await p.evaluate(m => { const s = JSON.parse(JSON.stringify(window.__six.state)); s.cur = JSON.parse(JSON.stringify(m)); s.cur.g[0] = ""; window.__six.state = s; }, S5);
  await p.locator('.gp[data-g="0"]').click();
  for (let guard = 0; guard < 6 && !(await st(p)).done; guard++) await p.locator('.gp[data-g="0"]').click();
  await p.click("#next");
  ck("round end overlay", await p.isVisible("#over") && /Round 1 cleared/.test(await p.textContent("#over-title")));
  ck("R8 summary line", /^\d+ lines? made · \d+ power-ups? used$/.test(await p.textContent("#over-text")), await p.textContent("#over-text"));
  ck("first cleared round is a new best", await p.isVisible("#over-best"));
  await shot(p, "round");
  await p.click("#again");
  const r2 = await st(p);
  ck("next round is round 2 at tier 2", r2.round === 2 && !r2.over && await p.evaluate(() => window.__six.state.lines.every(l => l.t === 2)));

  // 5. Show answer: two taps, the first says it ends the run; the tools never wrap at 390px
  await p.setViewportSize({ width: 390, height: 844 });
  ck("Show answer label", (await p.textContent("#reveal")) === "Show answer");
  const row0 = (await p.locator("#board .tools").boundingBox()).height;
  await p.click("#reveal"); ck("Show answer asks first", !(await st(p)).done);
  ck("first tap says it ends the run", /ends the Climb run/.test(await p.textContent("#hint")) && /Ends run/.test(await p.textContent("#reveal")));
  const row1 = (await p.locator("#board .tools").boundingBox()).height;
  const oneLine = await p.$$eval("#board .tools .btn:not([hidden])", bs => bs.every(b => b.getBoundingClientRect().height < 50)); // one line at the 44px target (REDESIGN.md 1.1); two lines are 57px
  ck("tool row does not wrap or grow at 390px", row0 === row1 && oneLine, row0 + " " + row1);
  await shot(p, "armed");
  await p.click("#reveal");
  ck("Show answer ends the run", (await st(p)).ended && await p.isVisible("#over") && /Run over/.test(await p.textContent("#over-title")));
  const ans = await p.textContent("#over-answer");
  ck("Run over prints the answer it refers to", await p.isVisible("#over-answer") && ans === "The answer: " + (await p.textContent("#expr")) + " = " + (await p.textContent("#target")), ans);
  ck("Run over summary", /^Round \d+ · \d+ lines? made$/.test(await p.textContent("#over-text")));
  await shot(p, "runover");
  await p.setViewportSize({ width: 375, height: 812 });
  await p.click("#again");
  ck("New game after the run", (await st(p)).round === 1 && !(await st(p)).over);

  // 6. Daily Six
  await p.click('#modes button[data-mode="daily"]');
  const d = await st(p);
  ck("Daily Six mode", d.mode === "daily" && (await p.textContent("#round-label")) === "Made" && /^\d$/.test(await p.textContent("#round")));
  ck("Daily tiers climb", await p.evaluate(() => JSON.stringify(window.__six.state.lines.map(l => l.t)) === JSON.stringify(window.__six.E.DAILY)));
  await p.click("#reveal");
  ck("Daily: first tap says it gives up the line", /gives up the line/.test(await p.textContent("#hint")));
  await p.click('#modes button[data-mode="climb"]'); await p.click("#reveal");
  ck("an armed Show answer does not carry over to another mode", !(await st(p)).done && /Ends run/.test(await p.textContent("#reveal")));
  await p.locator('.gp[data-g="0"]').click(); await p.click("#clear");
  await p.click('#modes button[data-mode="daily"]');
  ck("switching mode disarms both two-steps", (await p.textContent("#reveal")) === "Show answer" && (await p.textContent("#clear")) === "Clear");
  await p.reload();
  ck("mode and state survive reload", (await st(p)).mode === "daily");
  await p.click('#modes button[data-mode="climb"]');

  // 7. a long line fits a phone: five two-digit numbers, no horizontal scroll
  await p.evaluate(() => {
    const E = window.__six.E, s = JSON.parse(JSON.stringify(window.__six.state));
    const id = E.BANK.findIndex(b => b.n === "74 74 74 74 74"), b = E.BANK[id];
    s.lines[s.idx] = { id, t: 5, n: b.n.split(" "), g: b.g, d: b.d, sol: b.s }; s.cur = JSON.parse(JSON.stringify(b.s)); s.cur.g[4 - 1] = ""; s.done = false;
    window.__six.state = s;
  });
  ck("no horizontal scroll at 375px", await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  const lb = await p.locator("#line").boundingBox(), bb = await p.locator("#board").boundingBox();
  ck("long line stays inside the board", lb.x >= bb.x && lb.x + lb.width <= bb.x + bb.width + 0.5);
  await shot(p, "long");
  ck("no page errors", errs.length === 0, errs.join("|"));
  await ctx.close();

  // 8. storage blocked: still runs
  ctx = await newCtx({ viewport: { width: 375, height: 812 } });
  p = await ctx.newPage(); const e2 = []; p.on("pageerror", e => e2.push(e.message));
  await p.addInitScript(() => { Object.defineProperty(window, "localStorage", { get() { throw new Error("blocked"); } }); });
  await p.goto(page); await p.waitForTimeout(50);
  ck("storage blocked: the how-to still opens on a first visit", await p.evaluate(() => window.NumbericsUI.current() === "howto"));
  await p.keyboard.press("Escape");
  await p.locator('.gp[data-g="0"]').click();
  ck("runs with storage blocked", e2.length === 0 && (await st(p)).cur.g[0] === "+", e2.join("|"));
  await ctx.close();

  // 10. round 2 fixes, on a fresh phone at 390x844
  ctx = await newCtx({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  p = await ctx.newPage(); const e4 = []; p.on("pageerror", e => e4.push(e.message));
  await p.goto(page);
  ck("BEST reads a dimmed none before any play", (await p.textContent("#best")) === "none" && await p.locator("#best.none").count() === 1);
  ck("the game fits 390x844 without scrolling (top bar to the last control)", (await p.evaluate(playFit)).fits, JSON.stringify(await p.evaluate(playFit)));
  ck("the target is shown once in the board panel (the tier label names tools, not the target)",
    !/make|\b6\b/i.test(await p.textContent("#tier")) && (await p.textContent("#board .goal")) === "make6" && await p.evaluate(() => (document.querySelector("#board").innerText.match(/\bmake\b/gi) || []).length === 1));
  ck("an empty gap looks live: gold ring, bold ?", await p.evaluate(() => { const b = getComputedStyle(document.querySelector(".gp.empty b")); const gold = (n => { const pr = document.createElement("i"); pr.style.color = getComputedStyle(document.documentElement).getPropertyValue(n).trim(); document.body.appendChild(pr); const c = getComputedStyle(pr).color; pr.remove(); return c; })("--accent"); return b.borderTopColor === gold && +b.fontWeight >= 700 && b.color === gold; }));
  ck("Show answer looks like a run-ender in Climb", await p.locator("#reveal.ender").count() === 1);
  // the mechanics repro: 3 ? 3 ? 3, drag 1-2, then 1-3 (add), then 1-3 again (remove): no "Maximum call stack size exceeded"
  await p.evaluate(() => {
    const E = window.__six.E, s = JSON.parse(JSON.stringify(window.__six.state));
    const id = E.BANK.findIndex(b => b.n === "3 3 3"), b = E.BANK[id];
    s.lines[s.idx] = { id, t: b.t, n: b.n.split(" "), g: b.g, d: b.d, h: b.h, sol: b.s }; s.cur = E.blank(3); s.done = false;
    window.__six.state = s;
  });
  const dragN = async (i, j) => {
    const a = await p.locator('.num[data-i="' + i + '"]').boundingBox(), z = await p.locator('.num[data-i="' + j + '"]').boundingBox();
    await p.mouse.move(a.x + a.width / 2, a.y + a.height / 2); await p.mouse.down();
    await p.mouse.move(z.x + z.width / 2, z.y + z.height / 2, { steps: 8 }); await p.mouse.up();
  };
  await dragN(0, 1); ck("drag 1-2 groups", (await p.textContent("#expr")) === "(3 ? 3) ? 3");
  await dragN(0, 2); ck("drag 1-3 adds the outer group", (await p.textContent("#expr")) === "((3 ? 3) ? 3)");
  await dragN(0, 2); ck("drag 1-3 again removes it", (await p.textContent("#expr")) === "(3 ? 3) ? 3");
  ck("bracket drags over an existing span throw nothing", e4.length === 0, e4.join("|"));
  ck("nested bars sit on two rows", await p.evaluate(() => { const s = window.__six.state; return s.cur.b.length === 1; }));
  await dragN(0, 2);
  ck("two nested bars draw on rows 1 and 2", JSON.stringify(await p.$$eval("#bars .bar", bs => bs.map(b => b.style.gridRow).sort())) === '["1","2"]');
  ck("the game fits 390x844 with two bracket rows", (await p.evaluate(playFit)).fits, JSON.stringify(await p.evaluate(playFit)));
  // the Climb-ending warning is never under a toast: Hint toasts, then Show answer arms
  await p.evaluate(() => { const s = JSON.parse(JSON.stringify(window.__six.state)); s.power.hint = 2; window.__six.state = s; });
  await p.focus("#board"); await p.keyboard.press("2");
  ck("Hint shows a neutral info toast", await p.locator("#toast.on.info").count() === 1);
  await p.click("#reveal");
  ck("arming Show answer clears the toast, the warning is readable", !(await p.locator("#toast.on").count()) && /ends the Climb run/.test(await p.textContent("#hint")));
  await p.locator('.gp[data-g="1"]').click();
  ck("an edit disarms Show answer (its warning never goes stale)", (await p.textContent("#reveal")) === "Show answer" && !/ends the Climb run/.test(await p.textContent("#hint")));
  // R17: Enter on a focused games-row link navigates
  await p.focus('#games a[href$="nine/"], #games a:not([aria-current])');
  const href = await p.evaluate(() => document.activeElement.getAttribute("href"));
  const before17 = JSON.stringify((await st(p)).cur);
  await Promise.all([p.waitForURL(u => !/\/six\/?$/.test(u.toString()), { timeout: 4000 }).catch(() => {}), p.keyboard.press("Enter")]);
  ck("R17: Enter on a games-row link navigates", !/\/six\/?$/.test(p.url()), href + " -> " + p.url());
  await p.goto(page);
  ck("and the line was not edited by that Enter", JSON.stringify((await st(p)).cur) === before17);
  ck("round 2 checks: no page errors", e4.length === 0, e4.join("|"));
  await ctx.close();

  // 9. reduced motion: plays the same
  ctx = await newCtx({ viewport: { width: 375, height: 812 }, reducedMotion: "reduce" });
  p = await ctx.newPage(); const e3 = []; p.on("pageerror", e => e3.push(e.message));
  await p.goto(page);
  const S9 = await sol(p);
  await p.evaluate(m => { const s = JSON.parse(JSON.stringify(window.__six.state)); s.cur = JSON.parse(JSON.stringify(m)); s.cur.g[0] = ""; window.__six.state = s; }, S9);
  for (let guard = 0; guard < 6 && !(await st(p)).done; guard++) await p.locator('.gp[data-g="0"]').click();
  ck("reduced motion: a line still solves", (await st(p)).done && e3.length === 0, e3.join("|"));
  await ctx.close();

  // 11. round 3: 40px tiles and gaps at 320px, the Tier 1 label, the bracket nudge, one end-card pattern
  ctx = await newCtx({ viewport: { width: 320, height: 568 }, deviceScaleFactor: 2 });
  p = await ctx.newPage(); const e5 = []; p.on("pageerror", e => e5.push(e.message));
  await p.goto(page);
  const setLine = (n, cur) => p.evaluate(([n, cur]) => {
    const E = window.__six.E, s = JSON.parse(JSON.stringify(window.__six.state));
    const id = E.BANK.findIndex(b => b.n === n), b = E.BANK[id];
    s.lines[s.idx] = { id, t: b.t, n: b.n.split(" "), g: b.g, d: b.d, h: b.h, sol: b.s };
    s.cur = cur || E.blank(s.lines[s.idx].n.length); s.done = false; s.over = false; s.ended = false; s.edits = 1;
    window.__six.state = s;
  }, [n, cur || null]);
  const sizes = () => p.evaluate(() => [...document.querySelectorAll("#line .num, #line .gp")].map(e => { const r = e.getBoundingClientRect(); return Math.min(r.width, r.height); }));
  for (const n of ["74 74 74 74 74", "9 9 9 9 9", "5 5 5 5", "3 3 3"]) {
    await setLine(n);
    const z = await sizes();
    ck("320px: every tile and gap of " + n + " is at least 40px", z.length === 2 * n.split(" ").length - 1 && z.every(x => x >= 40), z.map(Math.round).join(","));
    ck("320px: no horizontal scroll with " + n, await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    ck("320px: the ? ring never touches a tile (" + n + ")", await p.evaluate(() => {
      const t = [...document.querySelectorAll("#line .num")].map(e => e.getBoundingClientRect());
      return [...document.querySelectorAll("#line .gp b")].every(b => { const r = b.getBoundingClientRect(); return t.every(q => r.right <= q.left || r.left >= q.right || r.bottom <= q.top || r.top >= q.bottom); });
    }));
  }
  await setLine("9 9 9 9 9");
  await shot(p, "320-five");
  // a drag across the stacked line still groups, and the gaps still cycle
  { const a = await p.locator('.num[data-i="1"]').boundingBox(), z = await p.locator('.num[data-i="3"]').boundingBox();
    await p.mouse.move(a.x + a.width / 2, a.y + a.height / 2); await p.mouse.down(); await p.mouse.move(z.x + z.width / 2, z.y + z.height / 2, { steps: 6 }); await p.mouse.up();
    ck("320px stacked line: a drag groups", JSON.stringify((await st(p)).cur.b) === "[[1,3,0]]"); }
  await p.locator('.gp[data-g="3"]').click();
  ck("320px stacked line: a gap tap sets it", (await st(p)).cur.g[3] === "+");
  // the Tier 1 label lists brackets; a Tier 1 bracket line's Show answer says the line needs them
  await setLine("4 4 4 4");
  ck("Tier 1 label lists brackets", (await p.textContent("#tier")) === "Tier 1 · + − × ÷ and brackets", await p.textContent("#tier"));
  ck("the status band is never empty on a live line", (await p.textContent("#hint")) === "Make 6 with the numbers in order.", await p.textContent("#hint"));
  await p.click("#reveal");
  ck("Show answer on a bracket line nudges to Brackets first", /needs \( \) Brackets\. Tap again to end the run\./.test(await p.textContent("#hint")) && !(await st(p)).done, await p.textContent("#hint"));
  ck("the nudge does not wrap the status band at 320px", await p.evaluate(() => document.getElementById("hint").getBoundingClientRect().height < 50));
  await p.click("#reveal");
  ck("second tap still ends the run", (await st(p)).ended);
  // one end-card pattern
  await p.setViewportSize({ width: 375, height: 667 });
  const newBox0 = await p.locator("#new").boundingBox();
  ck("end card: page New game hidden, its space kept", await p.evaluate(() => getComputedStyle(document.getElementById("new")).visibility === "hidden") && newBox0 && newBox0.height > 30);
  ck("end card: Run over offers See the board", await p.isVisible("#over-view") && (await p.textContent("#over-view")) === "See the board");
  const boardY0 = (await p.locator("#board").boundingBox()).y;
  await p.click("#over-view");
  ck("See the board hides the card and shows the answered line", !(await p.isVisible("#over")) && /Tap the board for the summary/.test(await p.textContent("#hint")) && await p.locator("#line .num").count() === 4);
  ck("See the board: New game is back, nothing jumps", await p.isVisible("#new") && Math.abs((await p.locator("#board").boundingBox()).y - boardY0) < 1);
  await shot(p, "seeboard");
  await p.locator('.num[data-i="0"]').click();
  ck("a tap on the board brings the card back", await p.isVisible("#over"));
  ck("the card's primary button has focus", await p.evaluate(() => document.activeElement && document.activeElement.id === "again"));
  await p.click("#over-view"); await p.keyboard.press("Escape");
  ck("Escape brings the card back too", await p.isVisible("#over") && await p.evaluate(() => document.activeElement.id === "again"));
  await p.keyboard.press("Enter");
  ck("Enter on the focused primary starts a new run", (await st(p)).round === 1 && !(await st(p)).over);
  // a cleared round: card focus, See the board, then Next round
  await p.evaluate(() => { const s = JSON.parse(JSON.stringify(window.__six.state)); s.idx = 5; s.cur = JSON.parse(JSON.stringify(s.lines[5].sol)); s.done = true; window.__six.state = s; });
  await p.click("#next");
  ck("round cleared: card focused on Next round", await p.isVisible("#over") && await p.evaluate(() => document.activeElement.id === "again" && document.activeElement.textContent === "Next round"));
  ck("round cleared: See the board offered", await p.isVisible("#over-view"));
  await p.click("#over-view"); await p.locator("#board").click({ position: { x: 20, y: 20 } });
  ck("round cleared: board tap returns to the card", await p.isVisible("#over"));
  await p.click("#again");
  ck("Next round still climbs", (await st(p)).round === 2 && await p.evaluate(() => getComputedStyle(document.getElementById("new")).visibility === "visible"));
  // the page still fits 390x844 with a stacked five-number line
  await p.setViewportSize({ width: 390, height: 844 });
  await setLine("74 74 74 74 74");
  ck("390x844: a five-number line stacks its gaps and still fits", await p.locator("#line.stack").count() === 1 && (await p.evaluate(playFit)).fits, JSON.stringify(await p.evaluate(playFit)));
  ck("round 3 checks: no page errors", e5.length === 0, e5.join("|"));
  await ctx.close();

  // ---------- the redesign (REDESIGN.md 5.9, 8.4, 9.6, 10, 11 phase D) ----------
  const setL = (p, n, opt) => p.evaluate(([n, opt]) => {
    const E = window.__six.E, s = JSON.parse(JSON.stringify(window.__six.state));
    const id = E.BANK.findIndex(b => b.n === n && (!opt || !opt.t || b.t === opt.t)), b = E.BANK[id];
    s.idx = opt && opt.idx != null ? opt.idx : 0;
    s.lines[s.idx] = { id, t: b.t, n: b.n.split(" "), g: b.g, d: b.d, h: b.h, sol: b.s };
    s.cur = E.blank(s.lines[s.idx].n.length); s.done = false; s.over = false; s.ended = false; s.helped = false; s.peeks = []; s.edits = 1;
    if (opt && opt.round) s.round = opt.round;
    if (opt && opt.almost) { s.cur = JSON.parse(JSON.stringify(b.s)); s.cur.g[0] = ""; }
    window.__six.state = s;
  }, [n, opt || null]); // the test hook draws an injected state without motion
  // solve a line the way a player finishes it: everything but the first gap is set, then the gap is tapped round
  const solveL = async (p, n, opt) => {
    await setL(p, n, Object.assign({ almost: true }, opt || {}));
    for (let g = 0; g < 8 && !(await p.evaluate(() => window.__six.state.done)); g++) await p.locator('.gp[data-g="0"]').click();
    return p.evaluate(() => window.__six.state.done);
  };
  const waapi = p => p.evaluate(() => document.getAnimations().filter(a => a.constructor.name === "Animation" && a.playState === "running")
    .map(a => a.effect.getKeyframes().some(k => k.transform && k.transform !== "none")));
  const has = (p, id) => p.evaluate(id => window.NumbericsTrophies.has(id), id);

  // 12. first visit: the how-to opens by itself once, with the three steps; the row under the board holds the rules
  ctx = await newCtx({ viewport: { width: 390, height: 844 } }, true);
  p = await ctx.newPage(); const e6 = []; p.on("pageerror", e => e6.push(e.message));
  await p.goto(page); await p.waitForTimeout(100);
  ck("first visit: How to play opens by itself", await p.evaluate(() => window.NumbericsUI.current() === "howto"));
  ck("how-to: the three steps of 9.6", JSON.stringify(await p.$$eval(".howto .step p", ps => ps.map(x => x.textContent))) ===
    JSON.stringify(["Tap a gap to put a sign there.", "Make the line equal six.", "Use brackets, roots and ! when you need them."]));
  ck("how-to: each step has a picture", await p.locator(".howto .step .pv .mt").count() >= 6);
  await shot(p, "howto");
  await p.keyboard.press("Escape");
  await p.reload(); await p.waitForTimeout(100);
  ck("returning: How to play does not open again", await p.evaluate(() => window.NumbericsUI.current() === null));
  ck("the How to play row is collapsed and keeps the rules text", await p.evaluate(() => { const d = document.querySelector("details.how"); return d && !d.open && /Every step must be a whole number or a fraction/.test(d.textContent) && /Keys:/.test(d.textContent); }));
  await p.click("details.how summary"); await p.click("#howto-open");
  ck("the row opens the three steps again", await p.evaluate(() => window.NumbericsUI.current() === "howto"));
  await p.keyboard.press("Escape");
  ck("the games list is the cards, Six marked as playing", await p.locator("#games.cards a.card").count() === 10 && (await p.getAttribute('#games a[aria-current="page"]', "data-id")) === "six");
  ck("a key does nothing while a sheet is open", await (async () => { await p.evaluate(() => window.NumbericsUI.sheet("howto", () => {})); await p.keyboard.press("+"); const g = await p.evaluate(() => window.__six.state.cur.g.join("")); await p.keyboard.press("Escape"); return g === ""; })());
  // 44 px targets: every gap's hit box and every tool
  ck("every gap is a 44 px target", await p.evaluate(() => [...document.querySelectorAll("#line .gp")].every(g => { const r = g.getBoundingClientRect(), b = getComputedStyle(g, "::before"); return Math.max(r.width, parseFloat(b.width)) >= 44 && Math.max(r.height, parseFloat(b.height)) >= 44; })));
  ck("tools and modes are 44 px tall", await p.evaluate(() => [...document.querySelectorAll("#board .tools .btn:not([hidden]), #modes button")].every(b => b.getBoundingClientRect().height >= 44)));
  ck("a gap's hit box takes a tap just outside its chip", await (async () => {
    await setL(p, "1 1 1"); await p.locator("#line").scrollIntoViewIfNeeded(); const r = await p.locator('.gp[data-g="0"] b').boundingBox();
    const hit = await p.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return !!(e && e.closest(".gp")); }, [r.x + r.width / 2, r.y + r.height + 3]);
    return hit; })());
  ck("first visit checks: no page errors", e6.length === 0, e6.join("|"));
  await ctx.close();

  // 13. motion: sign flips, bars grow, the line turns gold; two quick inputs are two edits
  ctx = await newCtx({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  p = await ctx.newPage(); const e7 = []; p.on("pageerror", e => e7.push(e.message));
  await p.goto(page); await setL(p, "1 1 1");
  await p.locator('.gp[data-g="0"]').click();
  ck("a set sign flips in (rotateX)", await p.evaluate(() => document.getAnimations().some(a => a.effect && a.effect.target && a.effect.target.closest && a.effect.target.closest('.gp[data-g="0"]') && a.effect.getKeyframes().some(k => /rotateX\(90deg\)/.test(k.transform || "")))));
  await p.locator('.gp[data-g="0"]').click();
  ck("the old sign flips out as a ghost", await p.locator('.gp[data-g="0"] b.old').count() === 1);
  await p.waitForTimeout(300);
  ck("the ghost removes itself", await p.locator(".gp b.old").count() === 0);
  { const a = await p.locator('.num[data-i="0"]').boundingBox(), z = await p.locator('.num[data-i="2"]').boundingBox();
    await p.mouse.move(a.x + a.width / 2, a.y + a.height / 2); await p.mouse.down(); await p.mouse.move(z.x + z.width / 2, z.y + z.height / 2, { steps: 4 }); await p.mouse.up(); }
  ck("a bracket bar grows from its left end (scaleX)", await p.evaluate(() => document.getAnimations().some(a => a.effect && a.effect.target && a.effect.target.classList && a.effect.target.classList.contains("bar") && a.effect.getKeyframes().some(k => /scaleX\(0\)/.test(k.transform || ""))))
    && await p.evaluate(() => getComputedStyle(document.querySelector(".bar")).transformOrigin.startsWith("0px")));
  // two quick taps during an animation: both land
  await setL(p, "1 1 1");
  const g0 = await p.locator('.gp[data-g="0"]').boundingBox(), g1 = await p.locator('.gp[data-g="1"]').boundingBox();
  await p.mouse.click(g0.x + g0.width / 2, g0.y + g0.height / 2);
  const busy = (await waapi(p)).length > 0;
  await p.mouse.click(g1.x + g1.width / 2, g1.y + g1.height / 2);
  ck("two quick taps during an animation give two edits", busy && JSON.stringify(await p.evaluate(() => window.__six.state.cur.g)) === '["+","+"]', String(busy));
  await setL(p, "1 1 1"); await p.focus("#board");
  for (let i = 0; i < 4; i++) await p.keyboard.press("ArrowLeft");
  await p.keyboard.press("+"); const busyK = (await waapi(p)).length > 0; await p.keyboard.press("*");
  ck("two quick keys during an animation give two edits", busyK && JSON.stringify(await p.evaluate(() => window.__six.state.cur.g)) === '["+","*"]', busyK + " " + JSON.stringify(await p.evaluate(() => window.__six.state.cur.g)));
  // the line makes six: the target pops, then the sheen sweeps, then Next line slides the new line in
  await setL(p, "3 3 3", { almost: true });
  await p.locator('.gp[data-g="0"]').click({ noWaitAfter: true });
  for (let g = 0; g < 6 && !(await p.evaluate(() => window.__six.state.done)); g++) await p.locator('.gp[data-g="0"]').click();
  ck("on the target the line turns gold and the target pops", await p.locator("#board.gold").count() === 1 && await p.evaluate(() => document.getAnimations().some(a => a.effect && a.effect.target && a.effect.target.id === "target")));
  await p.waitForTimeout(260);
  await shot(p, "sheen-mid");
  if (process.env.SIX_MID) await p.screenshot({ path: process.env.SIX_MID });
  ck("then the gold sheen sweeps the line", await p.evaluate(() => document.getAnimations().some(a => a.effect && a.effect.target && a.effect.target.parentNode && a.effect.target.parentNode.classList && a.effect.target.parentNode.classList.contains("sheen") && a.effect.getKeyframes().some(k => /translateX\(-100%\)/.test(k.transform || "")))));
  await p.click("#next");
  ck("the next line slides in from the right", await p.evaluate(() => document.getAnimations().some(a => a.effect && a.effect.target && a.effect.target.id === "line" && a.effect.getKeyframes().some(k => /translateX\(24px\)/.test(k.transform || "")))));
  // budgets (REDESIGN.md 10): 60 edits, one every 45 ms; frames and nodes
  await setL(p, "1 1 1");
  await p.evaluate(() => { window.__fr = []; let t0 = performance.now(); const f = t => { window.__fr.push(t - t0); t0 = t; if (!window.__stop) requestAnimationFrame(f); }; requestAnimationFrame(f); });
  const nodes = () => p.evaluate(() => ({ all: document.getElementsByTagName("*").length, line: document.getElementById("line").querySelectorAll("*").length }));
  let n10 = null, worstLine = 0; const gp = [g0, g1];
  for (let i = 0; i < 60; i++) {
    const b = gp[i % 2]; await p.mouse.click(b.x + b.width / 2, b.y + b.height / 2); await p.waitForTimeout(45);
    if (i % 5 === 4) { const nn = await nodes(); worstLine = Math.max(worstLine, nn.line); if (i === 9) n10 = nn.all; }
  }
  const n60 = (await nodes()).all;
  const fr = await p.evaluate(() => { window.__stop = true; return window.__fr.slice(2); });
  const srt = fr.slice().sort((a, b) => a - b), p95 = srt[Math.floor(srt.length * 0.95)], mx = srt[srt.length - 1];
  // 17.5 ms: one 60 Hz frame plus headless vsync jitter (shared/motion.js notes); dropped frames (over 20 ms) <= 5 %
  const dropped = fr.filter(x => x > 20).length / fr.length;
  console.log("  six 60 edits: frames " + fr.length + ", p95 " + p95.toFixed(1) + " ms, max " + mx.toFixed(1) + " ms, dropped " + (100 * dropped).toFixed(1) + " %");
  ck("60 edits: p95 frame within 17.5 ms, dropped frames <= 5 %", p95 <= 17.5 && dropped <= 0.05, "p95 " + p95.toFixed(1) + " max " + mx.toFixed(1) + " dropped " + dropped);
  ck("60 edits: the line holds its nodes (+8 at most for ghosts)", worstLine <= 5 * 2 + 8 && Math.abs(n60 - n10) <= n10 * 0.05, worstLine + " " + n10 + " " + n60);
  ck("still the line edited, nothing lost", await p.evaluate(() => window.__six.state.edits > 60));
  ck("motion checks: no page errors", e7.length === 0, e7.join("|"));
  await ctx.close();

  // 14. reduced motion: through the OS, through the setting, and Full beats the OS
  for (const [name, opts, motion, wantTransform] of [["OS reduce", { reducedMotion: "reduce" }, null, false], ["setting Less", {}, "reduced", false], ["OS reduce + setting Full", { reducedMotion: "reduce" }, "full", true]]) {
    ctx = await newCtx(Object.assign({ viewport: { width: 390, height: 844 } }, opts));
    p = await ctx.newPage(); const er = []; p.on("pageerror", e => er.push(e.message));
    await p.goto(page);
    if (motion) await p.evaluate(m => window.NumbericsSettings.set({ motion: m }), motion);
    await setL(p, "1 1 1"); await p.locator('.gp[data-g="0"]').click();
    const k1 = await waapi(p);
    await solveL(p, "3 3 3"); const k2 = await waapi(p);
    await p.waitForTimeout(250); const k3 = await waapi(p); // the sheen (reduced: an opacity flash only)
    const all = k1.concat(k2, k3);
    ck(name + ": " + (wantTransform ? "motion plays" : "no transform animates, fades only"), all.length > 0 && (wantTransform ? all.some(x => x) : all.every(x => !x)), JSON.stringify([k1, k2, k3]));
    ck(name + ": the line still turns gold", await p.locator("#board.gold").count() === 1 && er.length === 0, er.join("|"));
    await ctx.close();
  }

  // 15. trophies on a scripted line, progress, the end card's pills and the music duck
  ctx = await newCtx({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  p = await ctx.newPage(); const e8 = []; p.on("pageerror", e => e8.push(e.message));
  await p.goto(page);
  // the music module may be swapped in after the first gesture, so the spy is put on right before each step
  const spyDuck = () => p.evaluate(() => { window.__duck = window.__duck || []; const m = window.NumbericsMusic || (window.NumbericsMusic = {}); if (m.duck && m.duck.__spy) return; const d = m.duck; m.duck = function (on) { window.__duck.push(on); return d ? d.apply(m, arguments) : undefined; }; m.duck.__spy = true; });
  ck("six_first: make a first six", await solveL(p, "3 3 3") && await has(p, "six_first"));
  ck("solve reports a real boolean helped and counts", await p.evaluate(() => { const s = window.__six.state; return s.helped === false; }));
  ck("fam played after the first edit", await p.evaluate(() => window.NumbericsTrophies.fam().played.six === 1));
  ck("six_tier3: a tier 3 line", !(await has(p, "six_tier3")) && await solveL(p, "81 81 81 81", { t: 3 }) && await has(p, "six_tier3"));
  ck("six_bang (secret): a ! in an unhelped line", await has(p, "six_bang"));
  ck("six_tier5: a tier 5 line", await solveL(p, "18 18 18 18", { t: 5 }) && await has(p, "six_tier5"));
  ck("six_roots (secret): two roots in an unhelped line", !(await has(p, "six_roots")) && await solveL(p, "16 16 16") && await has(p, "six_roots"));
  ck("six_climb: not before round 10", !(await has(p, "six_climb")));
  ck("six_climb: a line made in round 10", await solveL(p, "3 3 3", { round: 10 }) && await has(p, "six_climb"));
  ck("six_ten: not at five lines in a row", !(await has(p, "six_ten")));
  for (let i = 0; i < 5; i++) await solveL(p, "3 3 3");
  ck("six_ten: ten lines in a row without help", await has(p, "six_ten"));
  ck("the run record is saved with the game", await p.evaluate(() => JSON.parse(localStorage.getItem("numberics_six_v1")).runs.climb.streak === 10));
  ck("progress: the card summary is written on persist", await p.evaluate(() => { const g = window.NumbericsProgress.get("six"); return g && g.live === true && /^Round 10 · line 1\/6$/.test(g.liveText); }));
  // a helped line resets the streak and never pays the secrets
  await setL(p, "8 8 8", { almost: true });
  await p.evaluate(() => { const s = JSON.parse(JSON.stringify(window.__six.state)); s.helped = true; window.__six.state = s; });
  for (let g = 0; g < 8 && !(await p.evaluate(() => window.__six.state.done)); g++) await p.locator('.gp[data-g="0"]').click();
  ck("a helped line resets the run streak", await p.evaluate(() => JSON.parse(localStorage.getItem("numberics_six_v1")).runs.climb.streak === 0));
  // the Daily: its end card shows the trophy as a pill (no toast over the card), and the Today line is written
  await p.click('#modes button[data-mode="daily"]');
  await p.evaluate(() => { const s = JSON.parse(JSON.stringify(window.__six.state)); s.idx = 5; s.cur = JSON.parse(JSON.stringify(s.lines[5].sol)); s.done = true; s.solved = 4; window.__six.state = s; });
  await spyDuck(); await p.click("#next");
  ck("six_daily: finish the Daily Six", await has(p, "six_daily") && await has(p, "fam_daily"));
  ck("end card: the trophy is a pill on the card", await p.isVisible('#over-pills .trophy[data-trophy="six_daily"]'));
  ck("end card: no toast over it", !(await p.locator("#toast.on").count()));
  ck("Today: the Daily line is written", await p.evaluate(() => window.NumbericsProgress.today().six === "4 made"));
  ck("music ducks under the end card", await p.evaluate(() => window.__duck[window.__duck.length - 1] === true));
  await shot(p, "end-pill");
  if (process.env.SIX_PILL) await p.screenshot({ path: process.env.SIX_PILL });
  await spyDuck(); await p.click("#over-view");
  ck("music comes back when the card closes", await p.evaluate(() => window.__duck[window.__duck.length - 1] === false));
  // a Climb run that ends on Show answer reports end too
  await p.click('#modes button[data-mode="climb"]'); await setL(p, "1 1 1");
  await p.click("#reveal"); await p.click("#reveal");
  ck("Run over: the card shows, end reported (fam_first)", await p.isVisible("#over") && await has(p, "fam_first"));
  ck("trophy checks: no page errors", e8.length === 0, e8.join("|"));
  await ctx.close();
};
