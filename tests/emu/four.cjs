/* SPDX-License-Identifier: Apache-2.0 | Copyright 2026 alvations (Melon Lab)
 * Browser checks for Four. Run: NODE_PATH=$(npm root -g) node tests/emu/run.cjs four */
"use strict";
module.exports = async function ({ browser, url, ck, shot }) {
  const page = url + "four/";
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
  let ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2 });
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
  ck("R6: H1 is the game name, subtitle is the Numberics link and a tagline", (await p.textContent("h1")) === "Four" &&
     /^Numberics · .+\.$/.test((await p.textContent(".sub")).trim()) && await p.locator(".sub a[href='../']").count() === 1);
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
  ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2 });
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
  ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2 });
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
  ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2 });
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
  const lit = await p.locator(".disc.win").count();
  tCard = await p.evaluate(() => new Promise(res => { const f = () => document.getElementById("over").hidden ? requestAnimationFrame(f) : res(performance.now()); f(); }));
  ck("the computer's final drop: its line is lit and held about 1.5 s before the card", lit === 4 && tCard - t0 >= 1400, lit + " lit, " + Math.round(tCard - t0) + " ms");
  await ctx.close();

  // 320px (craft #5): the pills wrap, no sideways scroll, even with the long "Sure?" armed
  ctx = await browser.newContext({ viewport: { width: 320, height: 568 }, deviceScaleFactor: 2 });
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

  // 5. storage blocked
  ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
  p = await ctx.newPage(); const e2 = []; p.on("pageerror", e => e2.push(e.message));
  await p.addInitScript(() => { Object.defineProperty(window, "localStorage", { get() { throw new Error("blocked"); } }); });
  await p.goto(page);
  [x, y] = await colX(p, 3); await p.mouse.click(x, y);
  await myTurn(p);
  ck("runs with storage blocked", e2.length === 0 && (await st(p)).moves === 2, e2.join("|"));
  await ctx.close();

  // 6. reduced motion: plays, no animations on discs
  ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, reducedMotion: "reduce" });
  p = await ctx.newPage(); const e3 = []; p.on("pageerror", e => e3.push(e.message));
  await p.goto(page);
  await p.focus("#board"); await p.keyboard.press("Enter");
  ck("reduced motion: a drop lands", (await st(p)).moves >= 1);
  ck("reduced motion: discs do not animate", await p.evaluate(() => [...document.querySelectorAll(".disc")].every(d => getComputedStyle(d).animationName === "none")));
  await forge(p, [[0, 0, 1, 1], [0, 1, 1, 1], [0, 2, 1, 1]], { next: [1, 1] });
  await p.keyboard.press("ArrowRight"); await p.keyboard.press("ArrowRight"); await p.keyboard.press("ArrowRight");
  const cur = await p.evaluate(() => document.querySelector(".slot.aim") ? [...document.querySelectorAll(".slot")].indexOf(document.querySelector(".slot.aim")) % 7 : -1);
  for (let k = 0; k < 7 && (await p.evaluate(() => [...document.querySelectorAll(".slot")].indexOf(document.querySelector(".slot.aim")) % 7)) !== 3; k++) await p.keyboard.press("ArrowRight");
  await p.keyboard.press("Enter");
  s = await st(p);
  ck("reduced motion: the win shows a static highlight", s.over && s.over.winner === 1 && await p.locator(".disc.win").count() === 4 &&
     await p.evaluate(() => getComputedStyle(document.querySelector(".disc.win")).animationName === "none"), "cursor " + cur);
  await shot(p, "desktop-reduced");
  ck("no page errors (reduced motion)", e3.length === 0, e3.join("|"));
  await ctx.close();
};
