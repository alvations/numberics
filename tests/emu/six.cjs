/* SPDX-License-Identifier: Apache-2.0 | Copyright 2026 alvations (Melon Lab)
 * Browser checks for Six (run by tests/emu/run.cjs). */
"use strict";
const playFit = require("./_fit.cjs");
module.exports = async function ({ browser, url, ck, shot }) {
  const page = url + "six/";
  // the line's known solution, read from the page's engine
  const sol = p => p.evaluate(() => { const s = window.__six.state; return s.lines[s.idx].sol; });
  const st = p => p.evaluate(() => { const s = window.__six.state; return { idx: s.idx, done: s.done, cur: s.cur, power: s.power, over: s.over, round: s.round, solved: s.solved, n: s.lines[s.idx].n, mode: s.mode, ended: !!s.ended }; });

  // 1. loads, plays a whole line by touch-style clicks and a drag
  let ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2 });
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
  for (let guard = 0; guard < 6 && (await st(p)).cur.b[0][2] !== S.b[0][2]; guard++) await p.locator(".bar").first().click();
  ck("live value shows", /^= \d/.test((await p.textContent("#val")).trim()));
  ck("line turns gold on the target", await p.locator("#board.gold").count() === 1 && (await st(p)).done);
  ck("Next line shows", await p.isVisible("#next"));
  ck("R7: a made line is said once (hint line), no toast", /^Made 6\./.test(await p.textContent("#hint")) && !(await p.locator("#toast.on").count()));
  await shot(p, "solved");
  // tapping a number cycles its sign
  await p.click("#next");
  const before = (await st(p)).cur.u[0];
  const t0 = await p.locator('.num[data-i="0"]').boundingBox();
  await p.mouse.click(t0.x + t0.width / 2, t0.y + t0.height / 2);
  ck("tap on a number cycles its sign", (await st(p)).cur.u[0] === (before + 1) % 5);
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
  ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
  p = await ctx.newPage(); const e2 = []; p.on("pageerror", e => e2.push(e.message));
  await p.addInitScript(() => { Object.defineProperty(window, "localStorage", { get() { throw new Error("blocked"); } }); });
  await p.goto(page); await p.locator('.gp[data-g="0"]').click();
  ck("runs with storage blocked", e2.length === 0 && (await st(p)).cur.g[0] === "+", e2.join("|"));
  await ctx.close();

  // 10. round 2 fixes, on a fresh phone at 390x844
  ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
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
  ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, reducedMotion: "reduce" });
  p = await ctx.newPage(); const e3 = []; p.on("pageerror", e => e3.push(e.message));
  await p.goto(page);
  const S9 = await sol(p);
  await p.evaluate(m => { const s = JSON.parse(JSON.stringify(window.__six.state)); s.cur = JSON.parse(JSON.stringify(m)); s.cur.g[0] = ""; window.__six.state = s; }, S9);
  for (let guard = 0; guard < 6 && !(await st(p)).done; guard++) await p.locator('.gp[data-g="0"]').click();
  ck("reduced motion: a line still solves", (await st(p)).done && e3.length === 0, e3.join("|"));
  await ctx.close();

  // 11. round 3: 40px tiles and gaps at 320px, the Tier 1 label, the bracket nudge, one end-card pattern
  ctx = await browser.newContext({ viewport: { width: 320, height: 568 }, deviceScaleFactor: 2 });
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
};
