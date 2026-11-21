/* SPDX-License-Identifier: Apache-2.0 | Copyright 2026 alvations (Melon Lab)
 * Browser checks for Four. Run: NODE_PATH=$(npm root -g) node tests/emu/run.cjs four */
"use strict";
module.exports = async function ({ browser, url, ck, shot }) {
  const page = url + "four/";
  // every context but the first-visit check has already seen the how-to sheet (it opens by itself once, REDESIGN.md 1.3)
  const SEEN = () => { try { if (!localStorage.getItem("numberics_progress_v1")) localStorage.setItem("numberics_progress_v1", JSON.stringify({ v: 1, games: {}, howto: { four: true }, daily: {} })); } catch (e) {} };
  const newCtx = async (o) => { const c = await browser.newContext(o); await c.addInitScript(SEEN); return c; };
  const st = (p) => p.evaluate(() => window.__four.state);
  const myTurn = (p) => p.waitForFunction(() => window.__four.state.turn === 1 || window.__four.state.over, null, { timeout: 6000 });
  // forge a board: discs = [[row, col, owner, number]], row 0 at the bottom
  const forge = (p, discs, patch) => p.evaluate(([discs, patch]) => {
    const s = JSON.parse(JSON.stringify(window.__four.state));
    s.own = new Array(42).fill(0); s.num = new Array(42).fill(0);
    discs.forEach(([r, c, w, n]) => { s.own[r * 7 + c] = w; s.num[r * 7 + c] = n; });
    Object.assign(s, { turn: 1, over: null, prev: null, moves: discs.length, last: -1 }, patch || {});
    window.__four.state = s;
  }, [discs, patch]);
  const colX = async (p, c, row) => { // centre of a grid cell (row 0 = bottom)
    const g = await p.locator("#grid").boundingBox();
    return [g.x + g.width * (c + 0.5) / 7, g.y + g.height * (5 - (row || 0) + 0.5) / 6];
  };

  // 1. loads, plays a real turn by click, the computer replies
  let ctx = await newCtx({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2 });
  let p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto(page);
  ck("42 slots", await p.locator(".slot").count() === 42);
  ck("next numbers shown for both sides", /^[1-4]$/.test(await p.textContent("#next")) && /^[1-4]$/.test(await p.textContent("#cnext")));
  ck("difficulty row with one level pressed", await p.locator('#levels button[aria-pressed="true"]').count() === 1);
  ck("no horizontal scroll at 375px", await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  ck("R11: the opponent is 'the computer', never 'CPU'", !/\bCPU\b/.test(await p.textContent("body")) && /computer/.test(await p.textContent(".how")));
  ck("R11: an empty Held reads 'none'", (await p.textContent("#held")) === "none");
  ck("round 3 (craft #6): pills are Your next, Held, Its next, Record", JSON.stringify(await p.$$eval(".stat > span", e => e.map(x => x.textContent))) ===
     JSON.stringify(["Your next", "Held", "Its next", "Record"]));
  ck("round 3 (craft #3): an empty value is the shared .stat .none style, the same size as a value", await p.evaluate(() => {
    const a = getComputedStyle(document.getElementById("held")), b = getComputedStyle(document.getElementById("rec"));
    const tmp = document.createElement("b"); document.querySelector(".stat").appendChild(tmp); tmp.textContent = "1-0";
    const v = getComputedStyle(tmp).fontSize; tmp.remove();
    return a.fontSize === v && b.fontSize === v && a.fontWeight === "600" && b.fontWeight === "600";
  }));
  ck("R11/R16: an empty Record is a dimmed 'none'", (await p.textContent("#rec")) === "none" && await p.locator("#rec.none").count() === 1);
  ck("R6: H1 is the game name, the subtitle a plain tagline (TRIAGE4: no Numberics link)", (await p.textContent("h1")) === "Four" &&
     /^Four in a row.+\.$/.test((await p.textContent(".sub")).trim()) && await p.locator(".sub a").count() === 0);
  ck("the rule stays in the hint line", /with two of yours/.test(await p.textContent("#hint")));
  await p.locator("#tray button").nth(1).click({ force: true });
  ck("R5: tapping an empty power-up explains it and how to earn it", /^Pop: Remove any disc.*Earn charges/.test(await p.textContent("#hint")),
     await p.textContent("#hint"));
  ck("R5: unusable tray buttons are aria-disabled, never disabled", await p.locator("#tray button[aria-disabled='true']").count() === 4 &&
     await p.locator("#tray button[disabled]").count() === 0);
  const n0 = Number(await p.textContent("#next"));
  let [x, y] = await colX(p, 3, 2);
  await p.mouse.click(x, y);
  let s = await st(p);
  ck("a click drops your disc to the bottom of the column", s.own[3] === 1 && s.num[3] === n0, JSON.stringify(s.own.slice(0, 7)));
  await myTurn(p);
  s = await st(p);
  ck("the computer replied", s.own.filter(v => v === 2).length === 1 && s.moves === 2);
  await shot(p, "play");

  // 2. keyboard: arrows aim, Enter drops
  await p.focus("#board");
  const before = (await st(p)).moves;
  await p.keyboard.press("ArrowLeft"); await p.keyboard.press("ArrowLeft"); await p.keyboard.press("Enter");
  s = await st(p);
  ck("keyboard drop in column 1", s.moves === before + 1 && s.last % 7 === 1 && s.own[s.last] === 1, JSON.stringify(s.own.slice(0, 14)));
  await myTurn(p);

  // 3. power-ups
  const stock = [{ undo: 1, pop: 1, hold: 1, tune: 1 }, { undo: 0, pop: 0, hold: 0, tune: 0 }];
  // the computer holds a 4: no line of any kind is open to it after your next drop, so the reply cannot end the game
  await forge(p, [[0, 2, 1, 1], [1, 2, 2, 3], [2, 2, 1, 2], [0, 4, 2, 2]], { power: stock, next: [1, 4], held: [0, 0] });
  await p.keyboard.press("2");
  ck("Pop arms targeting", await p.locator("#board.targeting").count() === 1);
  await p.keyboard.press("Escape");
  ck("Esc cancels", await p.locator("#board.targeting").count() === 0);
  await p.keyboard.press("2");
  [x, y] = await colX(p, 2, 0); await p.mouse.click(x, y);
  s = await st(p);
  ck("Pop removed the bottom disc and the column dropped", s.own[2] === 2 && s.num[2] === 3 && s.own[16] === 0 && s.power[0].pop === 0 && s.turn === 1);
  await p.keyboard.press("3");
  s = await st(p);
  ck("Hold stashed the next disc", s.held[0] === 1 && s.power[0].hold === 0 && (await p.textContent("#held")) === "1");
  await p.keyboard.press("4");
  ck("Tune shows the number choice", await p.locator(".hint .pick button").count() === 4);
  const tuneTo = s.next[0] === 4 ? 3 : 4;
  await p.locator(".hint .pick button").nth(tuneTo - 1).click();
  s = await st(p);
  ck("Tune set the next number", s.next[0] === tuneTo && s.power[0].tune === 0 && (await p.textContent("#next")) === String(tuneTo));
  await p.keyboard.press("ArrowRight"); await p.keyboard.press("Enter");
  await myTurn(p);
  s = await st(p);
  ck("drop and reply happened", s.moves >= 6 && !!s.prev, JSON.stringify({ over: s.over, own: s.own, num: s.num }));
  const own0 = (await p.evaluate(() => JSON.stringify(window.__four.state.prev.own)));
  await p.keyboard.press("1");
  s = await st(p);
  ck("Undo took back both moves", JSON.stringify(s.own) === own0 && s.power[0].undo === 0 && s.turn === 1, JSON.stringify({ u: s.power[0], t: s.turn, over: s.over, hint: await p.textContent("#hint"), m: s.moves }));
  await shot(p, "powers");
  // R9: Pop aimed from the keyboard (arrow cursor + Enter); Enter on a focused button is that button, never a drop
  await forge(p, [[0, 2, 1, 1], [1, 2, 2, 3], [0, 4, 2, 2]], { power: stock, next: [1, 2], held: [0, 0] });
  await p.focus("#board");
  await p.evaluate(() => { document.querySelector("#board").dispatchEvent(new MouseEvent("mousemove", { clientX: -1 })); });
  await p.keyboard.press("2");
  ck("R9: Pop shows a keyboard cursor", await p.locator(".slot.cur").count() === 1);
  ck("craft #1: arming Pop clears a toast so the instruction reads", !(await p.locator("#toast.on").count()));
  // walk the cursor to column 2, bottom row
  for (let k = 0; k < 7; k++) {
    const at = await p.evaluate(() => [...document.querySelectorAll(".slot")].indexOf(document.querySelector(".slot.cur")));
    if (at % 7 === 2) break; await p.keyboard.press("ArrowRight");
  }
  for (let k = 0; k < 6; k++) await p.keyboard.press("ArrowDown");
  await shot(p, "pop-target");
  await p.keyboard.press("Enter");
  s = await st(p);
  ck("R9: Enter pops the disc under the cursor", s.own[2] === 2 && s.num[2] === 3 && s.own[9] === 0 && s.power[0].pop === 0, JSON.stringify(s.own.slice(0, 14)));
  const mv0 = s.moves;
  await p.locator("#tray button").nth(2).focus(); await p.keyboard.press("Enter");
  s = await st(p);
  ck("R9: Enter on a focused tray button uses it and drops nothing", s.moves === mv0 && s.held[0] === 1, JSON.stringify({ m: s.moves, h: s.held }));

  // 4. game end: a ten-line by your drop, line pulses, overlay shows
  await forge(p, [[0, 0, 2, 4], [0, 1, 1, 1], [0, 2, 2, 2]], { next: [3, 1], power: stock });
  [x, y] = await colX(p, 3, 0); await p.mouse.click(x, y);
  s = await st(p);
  ck("the ten-line wins", s.over && s.over.winner === 1 && s.over.type === "ten");
  ck("motion: the ring waits for the disc to land", await p.locator(".disc.win").count() === 0);
  await p.waitForFunction(() => document.querySelectorAll(".disc.win").length === 4, null, { timeout: 2000 });
  ck("the winning line is marked", await p.locator(".disc.win").count() === 4);
  ck("the other discs step back so the line stands out", await p.locator(".disc.dim").count() === 0 || await p.locator(".disc.dim").count() === (s.own.filter(Boolean).length - 4));
  ck("the winning line does not grow over its neighbours", await p.evaluate(() => { const d = document.querySelector(".disc.win");
    return getComputedStyle(d).animationName === "none" && getComputedStyle(d).scale === "none"; }));
  ck("R7: no result toast (the card is the one channel)", !/Ten!|Four in a row!|got there|draw/i.test(await p.textContent("#toast")), await p.textContent("#toast"));
  ck("R1: Undo is unavailable after a win", await p.locator("#tray button").first().getAttribute("aria-disabled") === "true");
  await p.keyboard.press("1");
  s = await st(p);
  ck("R1: pressing Undo after a win changes nothing and says why", s.over && s.over.winner === 1 && /Not after a result/.test(await p.textContent("#hint")));
  ck("R13: the winning line shows on the bare board before the card", await p.isHidden("#over"));
  await p.waitForSelector("#over:not([hidden])", { timeout: 3000 });
  ck("R13: the card offers See the board", await p.isVisible("#over-view") && (await p.textContent("#over-view")) === "See the board");
  await p.click("#over-view");
  ck("R13: See the board hides the card and keeps the line marked", await p.isHidden("#over") && await p.locator(".disc.win").count() === 4 &&
     /Tap the board for the summary/.test(await p.textContent("#hint")));
  await shot(p, "see-board");
  [x, y] = await colX(p, 5, 3); await p.mouse.click(x, y);
  ck("R13: a tap on the board brings the card back, and drops nothing", await p.isVisible("#over") && (await st(p)).over.winner === 1);
  await p.click("#over-view"); await p.keyboard.press("Escape");
  ck("R13: Esc brings the card back too", await p.isVisible("#over"));
  ck("result overlay shows", /You win/.test(await p.textContent("#over")));
  ck("R8/R16: the summary spells out the ten and the tally", /^4 \+ 1 \+ 2 \+ 3 = 10 · You 1 : 0 Computer$/.test(await p.textContent("#over-text")), await p.textContent("#over-text"));
  ck("the record counts the win once", (await p.textContent("#rec")) === "1-0");
  await shot(p, "won");
  await p.click("#again");
  s = await st(p);
  ck("New game from the overlay", !s.over && s.moves === 0 && await p.isHidden("#over"));
  // the computer can win too
  await forge(p, [[0, 0, 2, 1], [0, 1, 2, 1], [0, 2, 2, 1], [1, 0, 1, 1], [1, 1, 1, 1]], { next: [1, 1] });
  [x, y] = await colX(p, 6, 0); await p.mouse.click(x, y);
  await myTurn(p);
  s = await st(p);
  ck("the computer takes its win", s.over && s.over.winner === 2);
  await p.waitForSelector("#over:not([hidden])", { timeout: 3000 });
  ck("loss overlay", /computer/i.test(await p.textContent("#over")));
  ck("R7: no gold toast for the loss", !(await p.locator("#toast.on:not(.bad)").count()));
  await p.keyboard.press("1");
  ck("R1: no Undo after a loss, the record keeps the loss", (await st(p)).over && (await p.textContent("#rec")) === "1-1");
  await shot(p, "lost");
  // difficulty switch
  const firstB = (await st(p)).first;
  await p.click("#again");
  s = await st(p);
  ck("the opener alternates after a finished game", s.first === 3 - firstB, firstB + " then " + s.first);
  if (s.first !== 2) { // play to a game the computer opens: a quick forged win, then New game from the card
    await forge(p, [[0, 0, 2, 4], [0, 1, 1, 1], [0, 2, 2, 2]], { next: [3, 1], first: 1 });
    [x, y] = await colX(p, 3, 0); await p.mouse.click(x, y);
    await p.waitForSelector("#over:not([hidden])", { timeout: 3000 }); await p.click("#again");
  }
  // no re-rolling who opens (critic nit): New game before your first disc keeps the same opener, and costs nothing
  await myTurn(p);
  const recBefore = await p.textContent("#rec");
  await p.click("#new");
  s = await st(p);
  ck("no re-roll: New game before your first disc is one tap and the computer still opens", s.first === 2 && (await p.textContent("#new")) === "New game");
  ck("no re-roll: and it records nothing", (await p.textContent("#rec")) === recBefore);
  await myTurn(p);
  ck("the computer dropped first", (await st(p)).moves === 1);
  await p.click('#levels button[data-level="easy"]');
  ck("a level switch before your first disc needs no confirmation", (await st(p)).level === "easy");
  await myTurn(p);
  ck("a level switch before your first disc keeps the opener (the computer opens again)", (await st(p)).first === 2);
  [x, y] = await colX(p, 0); await p.mouse.click(x, y); await myTurn(p);
  await p.click('#levels button[data-level="hard"]');
  s = await st(p);
  ck("R10/R12: a level switch mid-game asks first and says it counts as a loss", s.level === "easy" &&
     (await p.textContent('#levels button[data-level="hard"]')) === "Sure?" && /counts this game as a loss/.test(await p.textContent("#hint")));
  const easyLost = await p.evaluate(() => window.__four.rec.easy.l);
  await p.click('#levels button[data-level="hard"]');
  s = await st(p);
  ck("Hard starts a Hard game", s.level === "hard" && await p.locator('#levels button[data-level="hard"][aria-pressed="true"]').count() === 1);
  ck("R12: the abandoned Easy game is a loss on Easy", await p.evaluate(() => window.__four.rec.easy.l) === easyLost + 1);
  // R12: New game mid-game: "Sure? Counts as a loss", then the loss is recorded
  await myTurn(p);
  if ((await st(p)).turn === 1) { [x, y] = await colX(p, 6); await p.mouse.click(x, y); await myTurn(p); }
  const hardRec = await p.evaluate(() => JSON.stringify(window.__four.rec.hard));
  await p.click("#new");
  ck("R12: New game mid-game warns 'Sure? Counts as a loss'", (await p.textContent("#new")) === "Sure? Counts as a loss");
  ck("R12: the warning is not covered by a toast", !(await p.locator("#toast.on").count()));
  await p.click("#new");
  ck("R12: quitting counts as a loss", await p.evaluate(() => window.__four.rec.hard.l) === JSON.parse(hardRec).l + 1 &&
     (await p.textContent("#rec")) === "0-" + (JSON.parse(hardRec).l + 1), await p.textContent("#rec"));
  await p.reload();
  ck("level survives reload", (await st(p)).level === "hard");
  ck("no page errors", errs.length === 0, errs.join("|"));
  await ctx.close();

  // threat marks (round 2, cold #5): Easy and Medium ring a hole where the computer's shown next disc wins
  ctx = await newCtx({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2 });
  p = await ctx.newPage(); await p.goto(page);
  const threatBoard = [[0, 0, 2, 2], [0, 1, 1, 4], [0, 2, 2, 2], [0, 3, 1, 1], [1, 3, 2, 1], [0, 5, 1, 1], [0, 6, 1, 1], [1, 5, 2, 1], [1, 6, 2, 1]];
  for (const lv of ["easy", "medium", "hard"]) {
    await forge(p, threatBoard, { level: lv, next: [1, 3] });
    const marked = await p.evaluate(() => [...document.querySelectorAll(".slot")].map((e, i) => e.classList.contains("threat") ? i : -1).filter(i => i >= 0));
    const cells = await p.evaluate(() => window.NumbericsFour.threats(window.__four.state).sort());
    if (lv === "hard") ck("threat marks: Hard shows none", marked.length === 0, JSON.stringify(marked));
    else {
      // slots are drawn top row first, so the n-th .slot is cell (5 - floor(n/7))*7 + n%7
      const asCells = marked.map(i => (5 - Math.floor(i / 7)) * 7 + i % 7).sort();
      ck("threat marks: " + lv + " rings the ten-line hole (0,4) and the floating colour hole (1,4)",
         cells.includes(4) && cells.includes(11) && JSON.stringify(asCells) === JSON.stringify(cells), JSON.stringify({ asCells, cells }));
      ck("threat marks: " + lv + " says what the ring means", /Blue ring/.test(await p.textContent("#hint")));
    }
  }
  await forge(p, threatBoard, { level: "medium", next: [1, 3] });
  await shot(p, "threats");
  // R17: Enter on a focused games-row link navigates and never drops a disc
  await forge(p, [], { level: "medium" });
  await p.focus("#games a");
  const href = await p.getAttribute("#games a", "href");
  await Promise.all([p.waitForNavigation({ timeout: 5000 }).catch(() => null), p.keyboard.press("Enter")]);
  ck("R17: Enter on a games-row link navigates", !/\/four\/$/.test(p.url()), p.url() + " (" + href + ")");
  await ctx.close();

  // round 3 (cold blocker, critic #1): marks for what your drop would open, both rings of a double threat
  const slotOf = cell => (5 - Math.floor(cell / 7)) * 7 + cell % 7;
  const cls = (cell, c) => p.evaluate(([i, c]) => document.querySelectorAll(".slot")[i].classList.contains(c), [slotOf(cell), c]);
  ctx = await newCtx({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2 });
  p = await ctx.newPage(); await p.goto(page);
  await myTurn(p);
  const ambush = [[0, 0, 2, 4], [0, 3, 2, 3]];
  for (const lv of ["easy", "medium", "hard"]) {
    await forge(p, ambush, { level: lv, next: [2, 1] });
    const risky = await p.locator(".slot.risky").count();
    if (lv === "hard") ck("marks: Hard shows none", risky === 0);
    else ck("marks: " + lv + " marks the landing cell of the column that opens 4 2 _ 3", await cls(1, "risky") && risky >= 1, risky);
  }
  await forge(p, ambush, { level: "medium", next: [2, 1] });
  await p.focus("#board");
  for (let k = 0; k < 7 && await p.evaluate(() => [...document.querySelectorAll(".slot")].indexOf(document.querySelector(".slot.aim")) % 7) !== 1; k++) await p.keyboard.press("ArrowLeft");
  ck("marks: aiming the marked column says why and rings the cell it opens", /^Dropping here lets the computer win\.$/.test(await p.textContent("#hint")) &&
     await cls(2, "opens") && await p.locator(".disc.ghost").count() === 1, await p.textContent("#hint"));
  await shot(p, "marks");
  await p.keyboard.press("ArrowRight"); await p.keyboard.press("ArrowRight");
  ck("marks: elsewhere the hint says what the red ring means", /Red dashed ring/.test(await p.textContent("#hint")) && !(await cls(2, "opens")), await p.textContent("#hint"));
  await forge(p, [[0, 0, 2, 1], [0, 1, 1, 2], [0, 2, 1, 1], [1, 0, 2, 1], [1, 1, 2, 1], [1, 2, 2, 1]], { level: "medium", next: [2, 1] });
  for (let k = 0; k < 7 && await p.evaluate(() => [...document.querySelectorAll(".slot")].indexOf(document.querySelector(".slot.aim")) % 7) !== 3; k++) await p.keyboard.press("ArrowRight");
  ck("marks: a drop under the computer's hole says 'on top of it'", /on top of it/.test(await p.textContent("#hint")) && await cls(3, "risky") && await cls(10, "opens"), await p.textContent("#hint"));
  await forge(p, [[0, 1, 2, 1], [0, 2, 2, 1], [0, 3, 2, 1]], { level: "medium", next: [2, 1] });
  ck("double threat: both holes ringed and the hint says so", await cls(0, "threat") && await cls(4, "threat") && /Two blue rings/.test(await p.textContent("#hint")));
  await shot(p, "double");
  // craft #2: the status band never pushes the board down (two lines reserved), at 375 and 320
  for (const w of [375, 320]) {
    await p.setViewportSize({ width: w, height: 760 });
    const tops = {}, top = async n => { tops[n] = await p.evaluate(() => Math.round(document.getElementById("board").getBoundingClientRect().top)); };
    await forge(p, [], { level: "medium" }); await top("rule");
    await forge(p, threatBoard, { level: "medium", next: [1, 3] }); await top("ring");
    await forge(p, ambush, { level: "medium", next: [2, 1] }); await top("mark");
    await forge(p, [], { level: "medium", power: stock }); await p.keyboard.press("4"); await top("tune"); await p.keyboard.press("Escape");
    await p.locator("#tray button").nth(2).click(); await top("info");
    await forge(p, [], { level: "medium", turn: 2, moves: 3 }); await top("thinking"); await myTurn(p);
    const v = Object.values(tops);
    ck("status never pushes the board down at " + w + "px", v.every(x => x === v[0]), JSON.stringify(tops));
  }
  await ctx.close();

  // round 3 (craft #2/#4/#7/#8): the finished board is held 1.5 s before the card, even when the computer moves last;
  // then New game below the board is hidden (its space kept) and the card's New game has the focus
  ctx = await newCtx({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2 });
  p = await ctx.newPage(); await p.goto(page); await myTurn(p);
  const newBox = await p.locator("#new").boundingBox();
  await forge(p, [[0, 0, 2, 4], [0, 1, 1, 1], [0, 2, 2, 2]], { next: [3, 1], level: "medium" });
  [x, y] = await colX(p, 3, 0);
  let t0 = await p.evaluate(() => performance.now()); await p.mouse.click(x, y);
  let tCard = await p.evaluate(() => new Promise(res => { const f = () => document.getElementById("over").hidden ? requestAnimationFrame(f) : res(performance.now()); f(); }));
  ck("your final drop: the board is held at least 1.5 s before the card", tCard - t0 >= 1450, Math.round(tCard - t0) + " ms");
  ck("end card: the card's New game has the focus", await p.evaluate(() => document.activeElement && document.activeElement.id === "again"));
  const nb = await p.locator("#new").boundingBox();
  ck("end card: the lower New game is hidden and its space kept", await p.evaluate(() => getComputedStyle(document.getElementById("new")).visibility === "hidden") &&
     nb && Math.abs(nb.y - newBox.y) < 1 && Math.abs(nb.height - newBox.height) < 1, JSON.stringify([newBox, nb]));
  await p.keyboard.press("Enter");
  ck("end card: Enter on the focused New game starts a new game", !(await st(p)).over && await p.evaluate(() => getComputedStyle(document.getElementById("new")).visibility === "visible"));
  await myTurn(p);
  await forge(p, [[0, 0, 2, 1], [0, 1, 2, 1], [0, 2, 2, 1], [1, 0, 1, 1], [1, 1, 1, 1]], { next: [1, 1], level: "medium" });
  [x, y] = await colX(p, 6, 0); await p.mouse.click(x, y);
  await p.waitForFunction(() => window.__four.state.over, null, { timeout: 4000 });
  t0 = await p.evaluate(() => performance.now());
  await p.waitForFunction(() => document.querySelectorAll(".disc.win").length === 4, null, { timeout: 2000 }).catch(() => null);
  const lit = await p.locator(".disc.win").count();
  tCard = await p.evaluate(() => new Promise(res => { const f = () => document.getElementById("over").hidden ? requestAnimationFrame(f) : res(performance.now()); f(); }));
  ck("the computer's final drop: its line is lit and held about 1.5 s before the card", lit === 4 && tCard - t0 >= 1400, lit + " lit, " + Math.round(tCard - t0) + " ms");
  await ctx.close();

  // 320px (craft #5): the pills wrap, no sideways scroll, even with the long "Sure?" armed
  ctx = await newCtx({ viewport: { width: 320, height: 568 }, deviceScaleFactor: 2 });
  p = await ctx.newPage(); await p.goto(page);
  ck("320px (craft #3): the four pills sit on one row", await p.evaluate(() => new Set([...document.querySelectorAll(".stat")].map(e => Math.round(e.getBoundingClientRect().top))).size === 1));
  ck("320px: no horizontal scroll", await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
     await p.evaluate(() => document.documentElement.scrollWidth));
  await myTurn(p);
  await p.focus("#board"); await p.keyboard.press("Enter"); await myTurn(p);
  await p.click('#levels button[data-level="hard"]'); await p.click("#new");
  ck("320px: both warnings armed", (await p.textContent("#new")) === "Sure? Counts as a loss" &&
     (await p.textContent('#levels button[data-level="hard"]')) === "Sure?" && /counts this game as a loss/.test(await p.textContent("#hint")));
  await p.evaluate(() => scrollTo(0, 0));
  ck("320px: no horizontal scroll with Sure? armed", await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
     await p.evaluate(() => document.documentElement.scrollWidth));
  await shot(p, "320-sure");
  await ctx.close();

  // round 4 (TRIAGE4 Family, craft #8/#11/#14/#15/#31, all-ages #5): the subtitle has no "Numberics" link, the cards
  // sit under "More number games", the pills share one row at 320 and 375 with Larger text and every label is >= 12 px,
  // the end card fades in with the game glyph and every trophy pill can be seen, the aim ghost is a hollow ring
  for (const [w, hgt, text] of [[320, 568, "normal"], [320, 568, "large"], [375, 667, "large"], [390, 844, "normal"]]) {
    ctx = await newCtx({ viewport: { width: w, height: hgt }, deviceScaleFactor: 2 });
    await ctx.addInitScript(t => { try { localStorage.setItem("numberics_settings_v1", JSON.stringify({ text: t, sound: false, music: false })); } catch (e) {} }, text);
    p = await ctx.newPage(); const e9 = []; p.on("pageerror", e => e9.push(e.message));
    await p.goto(page); await myTurn(p);
    const tag = w + "x" + hgt + " " + text + ": ";
    const lay = await p.evaluate(() => ({
      rows: new Set([...document.querySelectorAll(".stat")].map(e => Math.round(e.getBoundingClientRect().top))).size,
      lab: Math.min(...[...document.querySelectorAll(".stat > span")].map(e => parseFloat(getComputedStyle(e).fontSize))),
      sw: document.documentElement.scrollWidth, link: !!document.querySelector(".sub a"), sub: document.querySelector(".sub").textContent,
      head: (document.querySelector("section.more > h2#more") || {}).textContent,
      cards: !!document.querySelector("section.more > #games.cards") }));
    ck(tag + "the four pills share one row (Record never drops to its own row)", lay.rows === 1, JSON.stringify(lay));
    ck(tag + "every pill label is at least 12 px", lay.lab >= 12, String(lay.lab));
    ck(tag + "no sideways scroll", lay.sw <= w, String(lay.sw));
    ck(tag + "the subtitle is plain (the top bar mark links home)", !lay.link && lay.sub === "Four in a row, or four that make ten.", lay.sub);
    ck(tag + "the cards sit under the one heading, More number games", lay.head === "More number games" && lay.cards, String(lay.head));
    if (text === "normal" && w === 390) {
      const gh = await p.evaluate(() => { const g = document.querySelector(".disc.ghost"); if (!g) return null; const cs = getComputedStyle(g); return { bg: cs.backgroundImage, sh: cs.boxShadow }; });
      ck(tag + "the aim ghost is a hollow ring, never a filled disc (craft #31)", gh && gh.bg === "none" && /inset/.test(gh.sh), JSON.stringify(gh));
      await p.evaluate(() => document.documentElement.setAttribute("data-contrast", "high"));
      const edge = await p.evaluate(() => getComputedStyle(document.querySelector(".slot")).boxShadow);
      ck(tag + "High contrast: every hole has an edge (craft #14)", (edge.match(/inset/g) || []).length === 2, edge);
      await p.evaluate(() => document.documentElement.removeAttribute("data-contrast"));
    }
    if (w === 375) await shot(p, "375-large");
    // a first win with four trophies: the card fades in with the glyph, and every pill can be scrolled clear of the buttons
    await forge(p, [[0, 0, 1, 1], [0, 1, 1, 1], [0, 2, 1, 1], [1, 0, 2, 2], [1, 1, 2, 2]], { level: "easy", next: [1, 1] });
    await p.evaluate(() => document.getElementById("board").scrollIntoView({ block: "center" }));
    let [cx, cy] = await colX(p, 3, 0); await p.mouse.click(cx, cy);
    await p.waitForSelector("#over:not([hidden])", { timeout: 4000 });
    await p.evaluate(() => NumbericsTrophies.pills(document.getElementById("tro"), ["four_win", "four_colour", "four_ten", "fam_first"]));
    const card = await p.evaluate(() => { const o = document.getElementById("over"), cs = getComputedStyle(o);
      return { anim: cs.animationName, glyph: !!o.querySelector(":scope > svg.glyph"), last: o.lastElementChild.classList.contains("row") }; });
    ck(tag + "the end card fades in, carries the game glyph, buttons last", card.anim === "nm-fadein" && card.glyph && card.last, JSON.stringify(card));
    const seen = await p.evaluate(() => { // some scroll position shows each pill whole, between the card's top and its buttons
      const o = document.getElementById("over"), btns = o.lastElementChild, pills = [...document.querySelectorAll("#tro .trophy")], ok = pills.map(() => false);
      for (let y = 0; y <= o.scrollHeight; y += 4) { o.scrollTop = y; const ob = o.getBoundingClientRect(), b = btns.getBoundingClientRect();
        pills.forEach((t, i) => { const r = t.getBoundingClientRect(); if (r.height > 0 && r.top >= ob.top - 1 && r.bottom <= b.top + 1) ok[i] = true; }); }
      o.scrollTop = 0; return ok; });
    ck(tag + "every trophy pill can be seen in full (craft #15, cold #16)", seen.length === 4 && seen.every(Boolean), JSON.stringify(seen));
    if (w === 320 && text === "large") { await p.evaluate(() => { document.getElementById("over").scrollTop = 0; }); await shot(p, "320-large-card"); }
    ck(tag + "no page errors", e9.length === 0, e9.join("|"));
    await ctx.close();
  }

  // 5. storage blocked
  ctx = await newCtx({ viewport: { width: 375, height: 812 } });
  p = await ctx.newPage(); const e2 = []; p.on("pageerror", e => e2.push(e.message));
  await p.addInitScript(() => { Object.defineProperty(window, "localStorage", { get() { throw new Error("blocked"); } }); });
  await p.goto(page);
  await p.waitForSelector(".scrim:not([hidden])", { timeout: 1500 }).catch(() => null);
  ck("storage blocked: a first visit in memory still shows the how-to", await p.locator(".scrim:not([hidden]) .howto").count() === 1);
  await p.keyboard.press("Escape");
  [x, y] = await colX(p, 3); await p.mouse.click(x, y);
  await myTurn(p);
  ck("runs with storage blocked", e2.length === 0 && (await st(p)).moves === 2, e2.join("|"));
  await ctx.close();

  // 6. reduced motion: plays, no animations on discs
  ctx = await newCtx({ viewport: { width: 1280, height: 860 }, reducedMotion: "reduce" });
  p = await ctx.newPage(); const e3 = []; p.on("pageerror", e => e3.push(e.message));
  await p.goto(page);
  await p.focus("#board"); await p.keyboard.press("Enter");
  ck("reduced motion: a drop lands", (await st(p)).moves >= 1);
  ck("reduced motion: discs do not move (at most an opacity fade)", await p.evaluate(() => [...document.querySelectorAll(".disc")].every(d =>
    /^(none|nmm-fade)$/.test(getComputedStyle(d).animationName) && d.getAnimations().every(a => !a.effect.getKeyframes || a.effect.getKeyframes().every(k => !k.transform)))));
  await forge(p, [[0, 0, 1, 1], [0, 1, 1, 1], [0, 2, 1, 1]], { next: [1, 1] });
  await p.keyboard.press("ArrowRight"); await p.keyboard.press("ArrowRight"); await p.keyboard.press("ArrowRight");
  const cur = await p.evaluate(() => document.querySelector(".slot.aim") ? [...document.querySelectorAll(".slot")].indexOf(document.querySelector(".slot.aim")) % 7 : -1);
  for (let k = 0; k < 7 && (await p.evaluate(() => [...document.querySelectorAll(".slot")].indexOf(document.querySelector(".slot.aim")) % 7)) !== 3; k++) await p.keyboard.press("ArrowRight");
  await p.keyboard.press("Enter");
  await p.waitForFunction(() => document.querySelectorAll(".disc.win").length === 4, null, { timeout: 1000 }).catch(() => null);
  s = await st(p);
  ck("reduced motion: the win shows a static highlight", s.over && s.over.winner === 1 && await p.locator(".disc.win").count() === 4 &&
     await p.evaluate(() => getComputedStyle(document.querySelector(".disc.win")).animationName === "none"), "cursor " + cur);
  await shot(p, "desktop-reduced");
  ck("no page errors (reduced motion)", e3.length === 0, e3.join("|"));
  await ctx.close();
  // ===== Redesign D-Four (REDESIGN.md 1.3, 5.5, 5.11, 5.12, 8.4, 9.4, 10) =====
  const settingsInit = m => "try { localStorage.setItem('numberics_settings_v1', JSON.stringify({ v: 1, motion: '" + m + "' })); } catch (e) {}";
  // the motion read off a disc's face right after an input: its transform animations (fall, settle) and their timings
  const faceAnims = (p, cell) => p.evaluate((cell) => {
    const id = window.__four.ids[cell], node = id && window.__four.layer.get(id);
    if (!node) return null;
    return node.firstChild.getAnimations().map(a => ({ d: a.effect.getTiming().duration, delay: a.effect.getTiming().delay,
      comp: a.effect.composite, k0: (a.effect.getKeyframes()[0] || {}).transform || null,
      move: a.effect.getKeyframes().some(k => k.transform) }));
  }, cell);

  // first visit: Easy, the how-to sheet opens once, the How to play row stays reachable; a saved choice is kept
  ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2 });
  p = await ctx.newPage(); const e4 = []; p.on("pageerror", e => e4.push(e.message));
  await p.goto(page);
  await p.waitForSelector(".scrim:not([hidden]) .howto", { timeout: 3000 }).catch(() => null);
  ck("first visit: starts on Easy", (await st(p)).level === "easy" && await p.locator('#levels button[data-level="easy"][aria-pressed="true"]').count() === 1);
  ck("first visit: the how-to sheet opens by itself with three steps", await p.locator(".scrim:not([hidden]) .howto .step").count() === 3 &&
     /Tap a column to drop your disc\./.test(await p.textContent(".howto")) && /four of your colour in a row/.test(await p.textContent(".howto")) &&
     /add up to ten, two of them yours/.test(await p.textContent(".howto")));
  await shot(p, "howto");
  await p.keyboard.press("Escape");
  ck("how-to: Esc closes it, no disc dropped", !(await p.locator(".scrim:not([hidden])").count()) && (await st(p)).own.filter(v => v === 1).length === 0);
  ck("how-to: the How to play row is collapsed and keeps the rules word for word", await p.evaluate(() => {
    const d = document.querySelector("details.how"); return !!d && !d.open && /Half the discs are 1s\./.test(d.textContent) && /Esc cancels/.test(d.textContent);
  }));
  await p.click("details.how summary"); await p.click("#howto-open");
  ck("how-to: reachable from the row", await p.locator(".scrim:not([hidden]) .howto .step").count() === 3);
  await p.keyboard.press("Escape");
  ck("44 px: level buttons, power-ups, New game and the how-to row", await p.evaluate(() =>
    [...document.querySelectorAll("#levels button, #tray button, #new, details.how summary")].every(b => b.getBoundingClientRect().height >= 44)));
  ck("the games list at the page foot is the cards, in order, Four current", await p.locator("#games.cards a.card").count() === 10 &&
     await p.getAttribute("#games a.card[aria-current='page']", "data-id") === "four");
  await myTurn(p);
  await p.click('#levels button[data-level="medium"]'); await myTurn(p);
  await p.reload(); await p.waitForTimeout(100);
  ck("a saved choice is kept, and the sheet opens only once", (await st(p)).level === "medium" && !(await p.locator(".scrim:not([hidden])").count()));
  ck("no page errors (first visit)", e4.length === 0, e4.join("|"));
  await ctx.close();

  // motion: your disc and the computer's fall with gravity and settle; Pop drops the column; input never waits
  ctx = await newCtx({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2 });
  p = await ctx.newPage(); const e5 = []; p.on("pageerror", e => e5.push(e.message));
  await p.goto(page); await myTurn(p);
  await forge(p, [[0, 0, 2, 2], [1, 0, 2, 1], [0, 6, 1, 1]], { level: "medium", next: [1, 1] });
  const fallMs = rows => Math.round(70 + 60 * Math.sqrt(rows));
  await p.focus("#board");
  for (let k = 0; k < 7 && (await p.evaluate(() => [...document.querySelectorAll(".slot")].indexOf(document.querySelector(".slot.aim")) % 7)) !== 3; k++) await p.keyboard.press("ArrowRight");
  const nodes0 = await p.locator("#discs > .tile").count();
  await p.keyboard.press("Enter");
  let an = await faceAnims(p, 3);
  ck("your disc falls six slots in fallMs(6) = 217 ms, from one slot above the board", an && an.some(a => a.move && a.d === fallMs(6) && /translateY\(-/.test(a.k0)), JSON.stringify(an));
  ck("then settles (160 ms, additive, after the fall)", an && an.some(a => a.d === 160 && a.delay === fallMs(6) && a.comp === "add"), JSON.stringify(an));
  ck("one new node for one new disc (the board is never rebuilt)", await p.locator("#discs > .tile").count() === nodes0 + 1);
  await shot(p, "mid-fall");
  // the computer's reply falls too
  const cpuCell = await p.evaluate(() => new Promise(res => {
    const m0 = window.__four.state.moves; const f = () => window.__four.state.moves > m0 ? res(window.__four.state.last) : requestAnimationFrame(f); f();
  }));
  an = await faceAnims(p, cpuCell);
  const cpuRows = 6 - Math.floor(cpuCell / 7);
  ck("the computer's disc falls with gravity too", an && an.some(a => a.move && a.d === fallMs(cpuRows)), JSON.stringify({ cpuCell, an }));
  // two quick inputs: the computer's disc is still falling; your drop is applied at once, and the next one after the reply
  await p.waitForFunction(() => window.__four.state.turn === 1, null, { timeout: 3000 });
  const m1 = (await st(p)).moves;
  await p.keyboard.press("ArrowLeft"); await p.keyboard.press("Enter");
  const quick = await p.evaluate(() => { window.__four.cpu(); const a = window.__four.state.moves; document.getElementById("board").dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })); return [a, window.__four.state.moves]; });
  const sNow = await st(p);
  ck("input during an animation: two quick drops are two moves (plus the computer's reply between)", quick[0] === m1 + 2 && (sNow.over || quick[1] === m1 + 3), JSON.stringify({ m1, quick, over: !!sNow.over }));
  await p.waitForTimeout(450);
  ck("after the animations settle, one node per disc on the board", await p.evaluate(() => document.querySelectorAll("#discs > .tile").length === window.__four.state.own.filter(Boolean).length));
  // the computer's think pause: a tap on the board waits and says so
  await forge(p, [[0, 0, 2, 2]], { level: "medium", next: [1, 1], turn: 2, moves: 3 });
  [x, y] = await colX(p, 5, 0); await p.mouse.click(x, y);
  ck("during the think pause a tap drops nothing and the hint says the computer is thinking", (await st(p)).own[5] === 0 && /computer is thinking/.test(await p.textContent("#hint")));
  await myTurn(p);
  // Pop drops the column: the popped disc fades, the discs above fall one slot, keeping their nodes
  await forge(p, [[0, 2, 1, 1], [1, 2, 2, 3], [2, 2, 1, 2], [0, 4, 2, 2]], { power: stock, next: [1, 4], held: [0, 0], level: "medium" });
  const before2 = await p.evaluate(() => [window.__four.ids[9], window.__four.ids[16], window.__four.ids[2]]);
  await p.keyboard.press("2");
  [x, y] = await colX(p, 2, 0); await p.mouse.click(x, y);
  const popped = await p.evaluate(([a, b, gone]) => {
    const ids = window.__four.ids, L = window.__four.layer, f = id => L.get(id) && L.get(id).firstChild.getAnimations().filter(x => x.effect.getKeyframes().some(k => k.transform)).map(x => x.effect.getTiming().duration);
    const goneNode = document.querySelector('#discs > .tile[data-id="' + gone + '"]');
    return { kept: ids[2] === a && ids[9] === b, fa: f(a), fb: f(b), out: !!goneNode && goneNode.classList.contains("nmm-out") };
  }, before2);
  ck("Pop: the discs above keep their nodes and fall one slot (130 ms)", popped.kept && popped.fa.includes(130) && popped.fb.includes(130), JSON.stringify(popped));
  ck("Pop: the popped disc fades and shrinks away", popped.out, JSON.stringify(popped));
  await p.waitForTimeout(400);
  ck("Pop: the faded node is gone after it settles", await p.evaluate(() => document.querySelectorAll("#discs > .tile").length === window.__four.state.own.filter(Boolean).length));
  // the winning line: an SVG line through the four centres, drawn after the landing
  await forge(p, [[0, 0, 1, 1], [0, 1, 1, 1], [0, 2, 1, 1], [1, 0, 2, 2], [1, 1, 2, 2]], { next: [1, 1], level: "medium", power: [{ undo: 0, pop: 0, hold: 0, tune: 0 }, { undo: 0, pop: 0, hold: 0, tune: 0 }] });
  [x, y] = await colX(p, 3, 0); await p.mouse.click(x, y);
  ck("the line waits for the landing", await p.evaluate(() => document.getElementById("winline").hasAttribute("hidden")));
  await p.waitForFunction(() => !document.getElementById("winline").hasAttribute("hidden"), null, { timeout: 2000 });
  const ln = await p.evaluate(() => { const l = document.querySelector("#winline line"), a = l.getAnimations()[0];
    return { y1: +l.getAttribute("y1"), y2: +l.getAttribute("y2"), x1: +l.getAttribute("x1"), x2: +l.getAttribute("x2"),
      dur: a && a.effect.getTiming().duration, k: a && a.effect.getKeyframes().map(k => k.strokeDashoffset), cap: getComputedStyle(l).strokeLinecap }; });
  ck("the winning line is drawn through the four centres (360 ms, from its length to 0, round caps)", ln.y1 === ln.y2 && ln.x2 > ln.x1 && ln.dur === 360 &&
     ln.cap === "round" && ln.k && ln.k[ln.k.length - 1] === "0", JSON.stringify(ln));
  await shot(p, "line");
  ck("no page errors (motion)", e5.length === 0, e5.join("|"));
  await ctx.close();

  // reduced motion via the in-app setting (no OS ask), and Full beating the OS
  for (const [label, o] of [["setting Less", { init: settingsInit("reduced"), ctx: {} }], ["OS reduce + setting Full", { init: settingsInit("full"), ctx: { reducedMotion: "reduce" } }]]) {
    ctx = await newCtx(Object.assign({ viewport: { width: 1280, height: 860 } }, o.ctx));
    await ctx.addInitScript(o.init);
    p = await ctx.newPage(); const e6 = []; p.on("pageerror", e => e6.push(e.message));
    await p.goto(page); await myTurn(p);
    await forge(p, [], { level: "medium", next: [1, 1] });
    await p.focus("#board"); await p.keyboard.press("Enter");
    an = await faceAnims(p, 3);
    const moves = !!(an && an.some(a => a.move));
    if (label === "setting Less") ck("reduced motion (" + label + "): the disc does not fall, it fades in", !moves, JSON.stringify(an));
    else ck("motion (" + label + "): the disc falls", moves, JSON.stringify(an));
    ck("no page errors (" + label + ")", e6.length === 0, e6.join("|"));
    await ctx.close();
  }

  // trophies (REDESIGN.md 8.4): every Four trophy fires on a scripted line; the end card shows the pills
  const NONE = [{ undo: 0, pop: 0, hold: 0, tune: 0 }, { undo: 0, pop: 0, hold: 0, tune: 0 }];
  const COLOUR = [[0, 0, 1, 1], [0, 1, 1, 1], [0, 2, 1, 1], [1, 0, 2, 2], [1, 1, 2, 2]];
  const TEN = [[0, 0, 2, 4], [0, 1, 1, 1], [0, 2, 2, 2]];
  const BOTH = [[0, 0, 1, 1], [0, 1, 1, 1], [0, 2, 1, 1], [0, 4, 2, 1], [0, 5, 1, 2], [0, 6, 2, 1], [1, 4, 2, 4], [1, 5, 2, 2], [1, 6, 1, 2], [2, 5, 1, 3], [2, 6, 2, 1], [3, 6, 2, 2]];
  const LASTO = [1, 2, 2, 1, 2, 2, 1, 1, 1, 2, 2, 2, 1, 1, 1, 2, 1, 1, 2, 2, 2, 2, 2, 1, 2, 1, 1, 1, 1, 1, 2, 2, 1, 1, 2, 2, 1, 1, 2, 2, 2];
  const LAST = LASTO.map((w, i) => [Math.floor(i / 7), i % 7, w, 1]);
  const lines = [
    ["easy colour win", COLOUR, 3, { level: "easy", next: [1, 1] }, ["four_win", "four_colour"]],
    ["easy ten win", TEN, 3, { level: "easy", next: [3, 1] }, ["four_ten"]],
    ["medium win", COLOUR, 3, { level: "medium", next: [1, 1] }, ["four_medium"]],
    ["hard win, no power-ups", COLOUR, 3, { level: "hard", next: [1, 1] }, ["four_hard", "four_pure"]],
    ["one disc, both kinds", BOTH, 3, { level: "medium", next: [1, 1] }, ["four_both"]],
    ["the very last slot", LAST, 6, { level: "medium", next: [1, 1] }, ["four_last"]],
  ];
  ctx = await newCtx({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2 });
  p = await ctx.newPage(); const e7 = []; p.on("pageerror", e => e7.push(e.message));
  await p.goto(page); await myTurn(p);
  for (const [name, discs, col, patch, want] of lines) {
    await forge(p, discs, Object.assign({ power: NONE, used: [0, 0] }, patch));
    [x, y] = await colX(p, col, 0); await p.mouse.click(x, y);
    const got = await p.evaluate(() => window.__four.trophies);
    ck("trophies: " + name + " earns " + want.join(", "), want.every(id => got.includes(id)) && got.filter(id => /^four_/.test(id)).length === want.length, JSON.stringify(got));
    await p.waitForSelector("#over:not([hidden])", { timeout: 3000 });
    const pills = await p.$$eval("#tro .trophy", e => e.map(x => x.getAttribute("data-trophy")));
    ck("trophies: " + name + ": the end card shows its pills", JSON.stringify(pills) === JSON.stringify(got), JSON.stringify(pills));
    if (name === "easy colour win") await shot(p, "card-trophy");
    await p.click("#again"); await myTurn(p);
  }
  // a loss reports won:false (no trophy) and a used power-up keeps Hard from being bare-handed
  await forge(p, COLOUR, { level: "hard", next: [1, 1], power: NONE, used: [1, 0] });
  [x, y] = await colX(p, 3, 0); await p.mouse.click(x, y);
  ck("trophies: nothing new for a second Hard win with a power-up used", (await p.evaluate(() => window.__four.trophies)).filter(id => /^four_/.test(id)).length === 0);
  const earned = await p.evaluate(() => NumbericsTrophies.earned().filter(id => /^four_/.test(id)).sort());
  ck("trophies: all eight Four trophies earned on the scripted lines", earned.length === 8, JSON.stringify(earned));
  const prog = await p.evaluate(() => NumbericsProgress.get("four"));
  ck("progress: the card summary is this level's record", prog && /^(Easy|Medium|Hard) \d+-\d+/.test(prog.best), JSON.stringify(prog));
  ck("no page errors (trophies)", e7.length === 0, e7.join("|"));
  await ctx.close();

  // budgets (REDESIGN.md 10): a 30-drop session, a drop every 60 ms where the turn allows; frames and disc nodes
  ctx = await newCtx({ viewport: { width: 1280, height: 860 } });
  p = await ctx.newPage(); const e8 = []; p.on("pageerror", e => e8.push(e.message));
  await p.goto(page); await myTurn(p);
  // the same page idle for 1 s: on a loaded machine (parallel agents, CI) headless frames are slow with nothing moving,
  // so the bar is 17.5 ms or the idle p95 x 1.3, whichever is higher (both are printed; on a quiet machine idle is
  // 16.7 and the bar is 17.5). Measured 20 Nov under load 10 on 4 cores: animation-only frames match idle frames.
  const idle95 = await p.evaluate(() => new Promise(res => { const f = []; let l = performance.now(); const t0 = l;
    (function raf() { const n = performance.now(); f.push(n - l); l = n; if (n - t0 < 1000) requestAnimationFrame(raf); else { f.sort((a, b) => a - b); res(f[Math.floor(f.length * .95)]); } })(); }));
  const bud = await p.evaluate(() => new Promise(res => {
    const frames = [], extra = [], cpu = [], hand = []; let last = performance.now(), stop = false, drops = 0, col = 0;
    const onBoard = () => window.__four.state.own.filter(Boolean).length;
    const L = document.getElementById("discs");
    (function raf(t) { const n = performance.now(); if (!cpu.some(c => c[1] > last && c[0] < n)) frames.push(n - last); last = n; extra.push(L.children.length - onBoard()); if (!stop) requestAnimationFrame(raf); })();
    const step = () => {
      const s = window.__four.state;
      if (s.over) document.getElementById("again").click();
      else if (s.turn === 2) { const t0 = performance.now(); window.__four.cpu(); cpu.push([t0, performance.now()]); }
      else {
        const h = c => { let k = 0; while (k < 6 && s.own[k * 7 + c]) k++; return k; };
        for (let k = 0; k < 7 && h(col) >= 6; k++) col = (col + 1) % 7;
        const b = document.getElementById("board").getBoundingClientRect(), g = document.getElementById("grid").getBoundingClientRect();
        const t0 = performance.now();
        document.getElementById("board").dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: g.left + g.width * (col + .5) / 7, clientY: g.top + 5 }));
        hand.push(performance.now() - t0);
        drops++; col = (col + 3) % 7;
      }
      if (drops < 30) setTimeout(step, 60);
      else setTimeout(() => { stop = true; res({ frames: frames.slice(3), extra, hand: hand.sort((a, b) => a - b), cpu: cpu.map(c => c[1] - c[0]).sort((a, b) => a - b), drops, count: L.children.length, board: onBoard() }); }, 500);
    };
    step();
  }));
  const fs2 = bud.frames.slice().sort((a, b) => a - b), p95f = fs2[Math.floor(fs2.length * .95)];
  console.log("  four budgets: " + bud.drops + " drops, " + bud.frames.length + " frames, p95 " + p95f.toFixed(2) + " ms, worst " + fs2[fs2.length - 1].toFixed(2) + " ms, max extra nodes " + Math.max(...bud.extra) +
    ", drop handler p95 " + bud.hand[Math.floor(bud.hand.length * .95)].toFixed(2) + " ms, computer move median " + bud.cpu[bud.cpu.length >> 1].toFixed(1) + " ms (separate budget; its frames are left out)");
  ck("30 drops: the drop handler writes the frame in under 20 ms (p95)", bud.hand[Math.floor(bud.hand.length * .95)] <= 20);
  console.log("  four budgets: idle p95 " + idle95.toFixed(2) + " ms");
  // round 4 (critic S6): a fixed bar that a regression cannot slip under. It needs a quiet machine: when the idle page
  // itself misses frames (idle p95 over 18 ms, e.g. agents running in parallel) the check says it was skipped, never passes
  if (idle95 <= 18) ck("30 drops: frame p95 <= 20 ms (a quiet machine)", p95f <= 20, p95f.toFixed(2) + " vs idle " + idle95.toFixed(2));
  else console.log("  SKIP four: 30 drops frame p95 check needs a quiet machine (idle p95 " + idle95.toFixed(2) + " ms > 18)");
  ck("30 drops: disc nodes <= discs on board + 8 at every frame, and equal once settled", Math.max(...bud.extra) <= 8 && bud.count === bud.board, JSON.stringify([Math.max(...bud.extra), bud.count, bud.board]));
  ck("no page errors (budgets)", e8.length === 0, e8.join("|"));
  await ctx.close();
};
