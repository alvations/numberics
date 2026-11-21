/* SPDX-License-Identifier: Apache-2.0 | Copyright 2026 alvations (Melon Lab)
 * Browser checks for the round-5 shared fixes (docs/reviews/TRIAGE5.md): S1 a toast never prints over the hint line's
 * text (Two, Six, Five, also when the hint changes in the same tick) and never shows over an open sheet (a game toast is
 * hidden or dropped, a trophy waits until the sheet closes); S4 the Settings header (title and Close) stays on screen
 * after Larger text, the armed "Sure? Erase everything" keeps the buttons' height on one line at 390, the chosen Music
 * style's one line and a "Now playing" line; S5 a solved Daily Six line shows on the Today card ("1 of 6").
 * (S2, music on the games page, is in shared-audible; S3, the Games button on the games page, is in root.)
 * Run: NODE_PATH=$(npm root -g) node tests/emu/run.cjs shared-r5 */
"use strict";
const fs = require("fs"), path = require("path");
module.exports = async function ({ browser, url, ck, shot }) {
  const games = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "..", "games.json"), "utf8")).filter(g => g.status === "live");
  const HOWTO = JSON.stringify({ v: 1, games: {}, howto: Object.fromEntries(games.map(g => [g.id, true]).concat([["endless", true]])), daily: {} });
  const SEEN = h => { try { if (!localStorage.getItem("numberics_progress_v1")) localStorage.setItem("numberics_progress_v1", h); } catch (e) { /* blocked */ } };
  const closeSheets = p => p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => {
    if (window.NumbericsUI && NumbericsUI.open()) NumbericsUI.close(); r(); }))));
  const pathOf = id => games.find(g => g.id === id).path;
  // the toast and the hint line: rects, the hint's text, and whether they overlap vertically
  const geo = p => p.evaluate(() => {
    const t = document.getElementById("toast"), h = document.getElementById("hint"), a = t.getBoundingClientRect(), b = h.getBoundingClientRect();
    return { on: t.classList.contains("on"), t: [Math.round(a.top), Math.round(a.bottom)], h: [Math.round(b.top), Math.round(b.bottom)], text: h.textContent,
      overlap: t.classList.contains("on") && /\S/.test(h.textContent) && a.top < b.bottom && a.bottom > b.top };
  });

  // ---- S1: the toast's lane ----
  for (const id of ["two", "six", "five"]) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    await ctx.addInitScript(SEEN, HOWTO);
    const p = await ctx.newPage(), errs = []; p.on("pageerror", e => errs.push(e.message));
    await p.goto(url + pathOf(id)); await closeSheets(p);
    await p.evaluate(() => NumbericsKit.toast("New tile 64 +1 Swap"));
    await p.waitForTimeout(80);
    let g = await geo(p);
    ck(id + ": a toast never covers the hint line's text (" + JSON.stringify(g.text) + ")", g.on && !g.overlap, JSON.stringify(g));
    await shot(p, id + "-toast");
    // the hint changes in the same tick as the toast (Six: "Made 6. Next line" with "+1 Skip"): the toast moves off it
    await p.evaluate(() => { NumbericsKit.clearToast(); document.getElementById("hint").textContent = ""; });
    await p.evaluate(() => { NumbericsKit.toast("Three clean lines: +1 Skip"); document.getElementById("hint").textContent = "Made 6. Next line"; });
    await p.waitForTimeout(80);
    g = await geo(p);
    ck(id + ": the hint changing in the same tick: the toast stays and moves off the new text", g.on && !g.overlap && g.text === "Made 6. Next line", JSON.stringify(g));
    // S1 (craft #14): a sheet opens over a toast: the toast goes; a toast raised while a sheet is open never shows
    await p.evaluate(() => NumbericsKit.toast("New tile 128 +1 Undo"));
    await p.click('#topbar [data-open="trophies"]'); await p.waitForTimeout(150);
    ck(id + ": opening a sheet hides the toast", await p.evaluate(() => NumbericsUI.current() === "trophies" && !document.getElementById("toast").classList.contains("on")));
    await p.evaluate(() => NumbericsKit.toast("New tile 256 +1 Smash")); await p.waitForTimeout(100);
    ck(id + ": no toast shows while a sheet is open", await p.evaluate(() => !document.getElementById("toast").classList.contains("on")));
    // a trophy earned while a sheet is open waits for it to close (Keepsake: Save is pressed inside Settings)
    await p.keyboard.press("Escape"); await p.waitForTimeout(50);
    await p.click('#topbar [data-open="settings"]'); await p.waitForTimeout(150);
    await p.evaluate(() => { window.__got = NumbericsTrophies.report("fam", "saved", {}); }); await p.waitForTimeout(300);
    const held = await p.evaluate(() => ({ got: window.__got, on: document.getElementById("toast").classList.contains("on") }));
    ck(id + ": a trophy earned with a sheet open shows no toast over it", held.got.indexOf("fam_keep") >= 0 && !held.on, JSON.stringify(held));
    await p.keyboard.press("Escape");
    await p.waitForFunction(() => { const t = document.getElementById("toast"); return t.classList.contains("on") && /Keepsake/.test(t.textContent); }, null, { timeout: 5000 }).catch(() => {});
    ck(id + ": the held trophy toasts once the sheet is closed", await p.evaluate(() => /Trophy: Keepsake/.test(document.getElementById("toast").textContent) && document.getElementById("toast").classList.contains("on")));
    ck(id + ": no page errors (S1)", !errs.length, errs.join(" | "));
    await ctx.close();
  }

  // ---- S4: the Settings sheet ----
  {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 667 }, hasTouch: true, isMobile: true });
    await ctx.addInitScript(SEEN, HOWTO);
    const p = await ctx.newPage(), errs = []; p.on("pageerror", e => errs.push(e.message));
    await p.goto(url + pathOf("six")); await closeSheets(p);
    await p.tap('#topbar [data-open="settings"]'); await p.waitForTimeout(300);
    await p.locator("#sh-settings [data-sw=text]").scrollIntoViewIfNeeded();
    await p.tap("#sh-settings [data-sw=text]"); await p.waitForTimeout(300);
    const head = async () => p.evaluate(() => {
      const s = document.querySelector("#sh-settings .sheet"), x = s.querySelector(".sh-x"), h2 = s.querySelector("h2"), r = x.getBoundingClientRect(), sr = s.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return { st: Math.round(s.scrollTop), x: Math.round(r.top), sheet: Math.round(sr.top), hit: !!hit && x.contains(hit), h2: h2.getBoundingClientRect().top >= sr.top - 1 };
    });
    for (const where of ["middle", "end"]) {
      await p.evaluate(w => { const s = document.querySelector("#sh-settings .sheet"); s.scrollTop = w === "end" ? s.scrollHeight : s.scrollHeight / 2; }, where);
      await p.waitForTimeout(100);
      const h = await head();
      ck("Settings, Larger text at 375x667, scrolled to the " + where + ": the title and Close stay on screen and Close takes the tap", h.st > 0 && h.hit && h.h2 && h.x >= h.sheet - 1, JSON.stringify(h));
    }
    await shot(p, "settings-large-scrolled");
    await p.tap("#sh-settings [data-sw=text]"); await p.waitForTimeout(200); // back to normal text for the 390 check
    await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(200);
    const er = '#sh-settings [data-mem="erase"]';
    await p.locator(er).scrollIntoViewIfNeeded();
    const h0 = await p.evaluate(s => document.querySelector(s).getBoundingClientRect().height, er);
    await p.tap(er); await p.waitForTimeout(100);
    const arm = await p.evaluate(s => { const b = document.querySelector(s), r = b.getBoundingClientRect(), sh = document.querySelector("#sh-settings .sheet");
      return { text: b.textContent, h: Math.round(r.height), lines: Math.round(r.height / parseFloat(getComputedStyle(b).lineHeight || "20")), fits: b.scrollWidth <= b.clientWidth + 1,
        inSheet: r.bottom <= sh.getBoundingClientRect().bottom + 1 || sh.scrollTop + sh.clientHeight < sh.scrollHeight }; }, er);
    ck("Erase at 390: 'Sure? Erase everything' fits on one line at the buttons' height", arm.text === "Sure? Erase everything" && Math.abs(arm.h - h0) <= 2 && arm.fits, JSON.stringify({ h0, arm }));
    await shot(p, "settings-erase-armed");
    await p.waitForTimeout(3200);
    ck("Erase disarms: Save, Load and Erase are back in one row", await p.evaluate(() => [...document.querySelectorAll("#sh-settings .mem button")].every(b => !b.hidden && b.offsetParent !== null) &&
      document.querySelector('#sh-settings [data-mem="erase"]').textContent === "Erase"));
    // the Music style line and Now playing (a tap already happened, so the music runs on this game page)
    await p.locator('#sh-settings [data-seg=musicStyle][data-v="drift"]').scrollIntoViewIfNeeded();
    await p.tap('#sh-settings [data-seg=musicStyle][data-v="drift"]');
    await p.waitForFunction(() => /^Now playing: Drift$/.test((document.querySelector("#sh-settings [data-mnow]") || {}).textContent || ""), null, { timeout: 5000 }).catch(() => {});
    const ml = await p.evaluate(() => { const d = document.querySelector("#sh-settings [data-mdesc]"), n = document.querySelector("#sh-settings [data-mnow]");
      return { d: d && d.offsetParent !== null ? d.textContent : null, n: n && n.offsetParent !== null ? n.textContent : null }; });
    ck("Music style: the chosen style's one line shows under the row (no hover needed)", ml.d === "Drift: Soft bells and a slow pad, no drums.", JSON.stringify(ml));
    ck("Music style: picking one shows 'Now playing: Drift'", ml.n === "Now playing: Drift", JSON.stringify(ml));
    await p.tap('#sh-settings [data-seg=musicStyle][data-v="auto"]'); await p.waitForTimeout(200);
    ck("Music style: Auto says what it does", await p.evaluate(() => document.querySelector("#sh-settings [data-mdesc]").textContent === "Auto (per game): Each game picks its own."));
    await shot(p, "settings-music");
    ck("no page errors (S4)", !errs.length, errs.join(" | "));
    // the games page: no music there (S2), and the line says where it plays
    await p.goto(url); await p.tap('#topbar [data-open="settings"]'); await p.waitForTimeout(250);
    await p.tap('#sh-settings [data-seg=musicStyle][data-v="pulse"]'); await p.waitForTimeout(800);
    ck("games page: the music line says the music plays in the games", await p.evaluate(() => document.querySelector("#sh-settings [data-mnow]").textContent === "Music plays in the games, not on this page." &&
      document.querySelector("#sh-settings [data-mdesc]").textContent.indexOf("Pulse: ") === 0));
    await ctx.close();
  }

  // ---- S5: Daily Six progress on the Today card ----
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.addInitScript(SEEN, HOWTO);
    const p = await ctx.newPage(), errs = []; p.on("pageerror", e => errs.push(e.message));
    await p.goto(url);
    ck("Today: Daily Six reads Not yet before any line", await p.evaluate(() => document.querySelector('#today .chip[data-daily="six"] small:last-child').textContent === "Not yet"));
    await p.goto(url + pathOf("six") + "?mode=daily"); await closeSheets(p);
    // make the first Daily line the way a player finishes it: all but the first gap set, then the gap tapped round
    await p.evaluate(() => { const s = JSON.parse(JSON.stringify(window.__six.state)); const L = s.lines[s.idx]; s.cur = JSON.parse(JSON.stringify(L.sol)); s.cur.g[0] = ""; s.done = false; s.edits = 1; window.__six.state = s; });
    for (let g = 0; g < 8 && !(await p.evaluate(() => window.__six.state.done)); g++) await p.locator('.gp[data-g="0"]').click();
    const made = await p.evaluate(() => ({ mode: window.__six.state.mode, solved: window.__six.state.solved }));
    await p.goto(url); await p.waitForTimeout(100);
    const chip = await p.evaluate(() => { const c = document.querySelector('#today .chip[data-daily="six"]'); return { small: c.querySelector("small:last-child").textContent, done: c.classList.contains("done") }; });
    ck("Today: after a made Daily Six line the chip reads '1 of 6' (not 'Not yet'), not done", made.mode === "daily" && made.solved === 1 && chip.small === "1 of 6" && !chip.done, JSON.stringify({ made, chip }));
    await shot(p, "today-six-part");
    ck("no page errors (S5)", !errs.length, errs.join(" | "));
    await ctx.close();
  }
};
