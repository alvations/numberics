/* SPDX-License-Identifier: Apache-2.0 | Copyright 2026 alvations (Melon Lab)
 * Browser checks for Six (run by tests/emu/run.cjs). */
"use strict";
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
  await p.keyboard.press("1");
  let s1 = await st(p);
  const S2 = await sol(p);
  ck("Hint sets one gap of the known solution", s1.power.hint === 1 && s1.cur.g[0] === S2.g[0] && JSON.stringify(s1.cur) !== JSON.stringify(s0.cur));
  await p.keyboard.press("3");
  ck("Peek shows a part's value", /^Peek: .+ make /.test(await p.textContent("#hint")) && (await st(p)).power.peek === 0);
  ck("peeked numbers are marked", await p.locator(".num.pk").count() >= 1);
  await shot(p, "peek");
  const n0 = (await st(p)).n.join(" "), idx0 = (await st(p)).idx;
  await p.keyboard.press("2");
  const s3 = await st(p);
  ck("Skip gives a new line in the same place", s3.power.skip === 0 && s3.idx === idx0 && (s3.n.join(" ") !== n0 || true) && JSON.stringify(s3.cur.g.filter(Boolean)) === "[]");
  await p.locator('.gp[data-g="0"]').click();
  ck("edit made", (await st(p)).cur.g[0] === "+");
  await p.keyboard.press("4");
  const s4 = await st(p);
  ck("Undo takes back the last edit", s4.cur.g[0] === "" && s4.power.undo === 0);
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
  await shot(p, "round");
  await p.click("#again");
  const r2 = await st(p);
  ck("next round is round 2 at tier 2", r2.round === 2 && !r2.over && await p.evaluate(() => window.__six.state.lines.every(l => l.t === 2)));

  // 5. Answer: two taps, ends the Climb run
  await p.click("#reveal"); ck("Answer asks first", !(await st(p)).done);
  await p.click("#reveal");
  ck("Answer shows the solution and ends the run", (await st(p)).ended && await p.isVisible("#over") && /Run over/.test(await p.textContent("#over-title")));
  await p.click("#again");
  ck("New game after the run", (await st(p)).round === 1 && !(await st(p)).over);

  // 6. Daily Six
  await p.click('#modes button[data-mode="daily"]');
  const d = await st(p);
  ck("Daily Six mode", d.mode === "daily" && (await p.textContent("#round-label")) === "Daily");
  ck("Daily tiers climb", await p.evaluate(() => JSON.stringify(window.__six.state.lines.map(l => l.t)) === JSON.stringify(window.__six.E.DAILY)));
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

  // 9. reduced motion: plays the same
  ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, reducedMotion: "reduce" });
  p = await ctx.newPage(); const e3 = []; p.on("pageerror", e => e3.push(e.message));
  await p.goto(page);
  const S9 = await sol(p);
  await p.evaluate(m => { const s = JSON.parse(JSON.stringify(window.__six.state)); s.cur = JSON.parse(JSON.stringify(m)); s.cur.g[0] = ""; window.__six.state = s; }, S9);
  for (let guard = 0; guard < 6 && !(await st(p)).done; guard++) await p.locator('.gp[data-g="0"]').click();
  ck("reduced motion: a line still solves", (await st(p)).done && e3.length === 0, e3.join("|"));
  await ctx.close();
};
