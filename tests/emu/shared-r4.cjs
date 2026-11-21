/* SPDX-License-Identifier: Apache-2.0 | Copyright 2026 alvations (Melon Lab)
 * Browser checks for the round-4 shared fixes (docs/reviews/TRIAGE4.md): B1 Memory Load and Erase are never undone by
 * any game page's own save (every page), B3 Larger text at 320 and 375 px (every page), D2 the one-tap mute, D4 and D9
 * the Today card (streak always, "Daily" chips, the day's best, the Sudoku level, the midnight rollover), D5 the device
 * theme, D6 one batched idle write per move that is never lost on leaving, the Load confirm and its "not a save" line,
 * Night owl never on a page load, the end-card glyph and fade, and the Light preview tiles.
 * Run: NODE_PATH=$(npm root -g) node tests/emu/run.cjs shared-r4 */
"use strict";
const fs = require("fs"), os = require("os"), path = require("path");
module.exports = async function ({ browser, url, ck, shot }) {
  const games = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "..", "games.json"), "utf8")).filter(g => g.status === "live");
  const HOWTO = JSON.stringify({ v: 1, games: {}, howto: Object.fromEntries(games.map(g => [g.id, true]).concat([["endless", true]])), daily: {} });
  const SEEN = h => { try { if (!localStorage.getItem("numberics_progress_v1")) localStorage.setItem("numberics_progress_v1", h); } catch (e) { /* blocked */ } };
  const closeSheets = p => p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => {
    if (window.NumbericsUI && NumbericsUI.open()) NumbericsUI.close(); r(); }))));
  const keyOf = id => id === "two" ? "numberics_endless_v1" : "numberics_" + id + "_v1";
  const nmKeys = p => p.evaluate(() => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith("numberics_")) o[k] = localStorage.getItem(k); } return o; });
  // every localStorage write and remove while window.__nmPhase is set, logged to sessionStorage (it survives the reload)
  const LOG = () => {
    const S = Storage.prototype, set = S.setItem, del = S.removeItem;
    const add = (op, k, v) => { try { const l = JSON.parse(sessionStorage.getItem("nmlog") || "[]"); l.push([op, k, v]); set.call(sessionStorage, "nmlog", JSON.stringify(l)); } catch (e) { /* none */ } };
    S.setItem = function (k, v) { if (this !== sessionStorage && window.__nmPhase && String(k).indexOf("numberics_") === 0) add("set", String(k), String(v)); return set.call(this, k, v); };
    S.removeItem = function (k) { if (this !== sessionStorage && window.__nmPhase && String(k).indexOf("numberics_") === 0) add("del", String(k)); return del.call(this, k); };
  };
  const readLog = p => p.evaluate(() => JSON.parse(sessionStorage.getItem("nmlog") || "[]"));
  // the old page tries hard to write while Memory reloads it: a pending batched save, and saves from pagehide and
  // visibilitychange (as Sudoku's own save does), through the kit's store, progress and trophies
  const DIRTY = (k, id) => {
    const dirty = () => { try { NumbericsKit.store(k).save({ zzDirty: 1 }); NumbericsProgress.put(id, { best: "DIRTY" }); NumbericsTrophies.report(id, "x", {}, { quiet: true }); } catch (e) { /* none */ } };
    if (window.__demo) { try { window.__demo(); } catch (e) { /* a demo is optional */ } }
    dirty(); addEventListener("pagehide", dirty); document.addEventListener("visibilitychange", dirty);
  };

  // ---- B1: Load and Erase on every game page ----
  for (const g of games) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.addInitScript(SEEN, HOWTO); await ctx.addInitScript(LOG);
    const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
    await p.goto(url + g.path); await closeSheets(p);
    const K = keyOf(g.id);
    const file = await p.evaluate(k => {
      const data = { [k]: JSON.stringify({ zzLoaded: "from the file" }), numberics_progress_v1: JSON.stringify({ v: 1, games: { seven: { best: "FILE", live: false, liveText: "", at: 1 } }, howto: {}, daily: {} }),
        numberics_trophies_v1: JSON.stringify({ v: 1, got: { fam_first: "20261120" }, unseen: [], fam: { played: { two: 1 }, dailyDays: [], streak: { n: 0, last: "" } } }) };
      return { data: data, text: JSON.stringify({ game: "numberics", v: 1, saved: "2026-11-20", data: NumbericsSettings.memory.enc(data) }) };
    }, K);
    await p.evaluate(src => { window.__dirtySrc = src; }, DIRTY.toString());
    await p.evaluate(([k, id]) => { const f = eval("(" + window.__dirtySrc + ")"); f(k, id); }, [K, g.id]);
    const nav = p.waitForNavigation();
    await p.evaluate(t => { window.__nmPhase = 1; NumbericsSettings.memory.loadText(t); }, file.text);
    await nav; await p.waitForTimeout(50);
    const log = await readLog(p), last = {};
    log.forEach(([op, k, v]) => { last[k] = op === "set" ? v : null; });
    const wrong = Object.keys(file.data).filter(k => last[k] !== file.data[k]).concat(Object.keys(last).filter(k => !(k in file.data) && k !== "numberics_settings_v1"));
    ck(g.id + ": Load: the old page writes nothing after Memory (every key ends as the file holds it)", wrong.length === 0, wrong.join() + " " + JSON.stringify(log).slice(0, 300));
    await p.evaluate(() => sessionStorage.removeItem("nmlog"));
    // Erase: seed marked keys, dirty the page again, Erase
    await p.evaluate(([k]) => { ["numberics_progress_v1", "numberics_trophies_v1", k].forEach(x => localStorage.setItem(x, JSON.stringify({ ZZMARK: 1 }))); }, [K]);
    await p.reload(); await closeSheets(p);
    await p.evaluate(src => { window.__dirtySrc = src; }, DIRTY.toString());
    await p.evaluate(([k, id]) => { const f = eval("(" + window.__dirtySrc + ")"); f(k, id); }, [K, g.id]);
    const nav2 = p.waitForNavigation();
    await p.evaluate(() => { window.__nmPhase = 1; NumbericsSettings.memory.erase(); });
    await nav2; await p.waitForTimeout(50);
    const log2 = await readLog(p), sets = log2.filter(([op, k]) => op === "set" && k !== "numberics_settings_v1");
    const left = await nmKeys(p);
    ck(g.id + ": Erase: the old page writes nothing after Memory, and no erased value comes back", sets.length === 0 && Object.values(left).every(v => v.indexOf("ZZMARK") < 0 && v.indexOf("zzDirty") < 0 && v.indexOf("DIRTY") < 0),
      JSON.stringify(sets).slice(0, 200) + " " + Object.keys(left).join());
    ck(g.id + ": Memory: no page errors", errs.length === 0, errs.join(" | "));
    await ctx.close();
  }

  // the reviewer's repro, end to end on Sudoku: loaded best times survive the page's own pagehide save
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } }); await ctx.addInitScript(SEEN, HOWTO);
    const p = await ctx.newPage(); await p.goto(url + "sudoku/"); await closeSheets(p);
    const text = await p.evaluate(() => {
      document.dispatchEvent(new Event("visibilitychange")); NumbericsKit.flush();
      const s = JSON.parse(localStorage.getItem("numberics_sudoku_v1")); s.best = { easy: 123, medium: 456, hard: 789 }; s.zzMarker = "kept";
      return JSON.stringify({ game: "numberics", v: 1, saved: "2026-11-20", data: NumbericsSettings.memory.enc({ numberics_sudoku_v1: JSON.stringify(s) }) });
    });
    await p.evaluate(() => window.__sudoku && window.__sudoku.select && window.__sudoku.select(0));
    const nav = p.waitForNavigation(); await p.evaluate(t => NumbericsSettings.memory.loadText(t), text); await nav;
    const got = await p.evaluate(() => { NumbericsKit.flush(); return JSON.parse(localStorage.getItem("numberics_sudoku_v1")); });
    ck("sudoku: a loaded save keeps its best times after the reload (round-4 B1 repro)", got && got.best && got.best.easy === 123 && got.best.medium === 456 && got.best.hard === 789, JSON.stringify(got && got.best));
    await ctx.close();
  }

  // ---- B3: Larger text at 320 and 375 (and 320 normal) never scrolls sideways; top-bar buttons stay 44 x 44 ----
  for (const [w, h, text] of [[320, 568, "large"], [375, 667, "large"], [320, 568, "normal"]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } }); await ctx.addInitScript(SEEN, HOWTO);
    await ctx.addInitScript(t => { try { if (!localStorage.getItem("numberics_settings_v1")) localStorage.setItem("numberics_settings_v1", JSON.stringify({ v: 1, text: t, theme: "dark" })); } catch (e) { /* none */ } }, text);
    for (const g of games) {
      const p = await ctx.newPage(); await p.goto(url + g.path); await closeSheets(p);
      const r = await p.evaluate(() => {
        const W = document.documentElement.clientWidth, b = [...document.querySelectorAll("#topbar .tb-btn")].map(x => x.getBoundingClientRect());
        return { sw: document.documentElement.scrollWidth, W, n: b.length, small: b.filter(x => x.width < 44 || x.height < 44).length, out: b.filter(x => x.right > W + 0.5 || x.left < 0).length };
      });
      ck(g.id + " " + w + " " + text + ": no sideways scroll, four top-bar buttons each at least 44 x 44 and on screen", r.sw <= r.W && r.n === 4 && !r.small && !r.out, JSON.stringify(r));
      if (g.id === "two" && w === 320 && text === "large") await shot(p, "topbar-320-large");
      await p.close();
    }
    await ctx.close();
  }

  // ---- D2: the one-tap mute, D5: the device theme ----
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: "light" }); await ctx.addInitScript(SEEN, HOWTO);
    const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
    await p.goto(url); await closeSheets(p);
    ck("D5: a fresh visit on a light device paints Light, and Settings shows Device", await p.evaluate(() => document.documentElement.dataset.theme === "light" && NumbericsSettings.get().theme === "auto"));
    const st = () => p.evaluate(() => { const b = document.querySelector("#topbar .tb-mute"), s = NumbericsSettings.get();
      return { pressed: b.getAttribute("aria-pressed"), sound: s.sound, music: s.music, label: b.getAttribute("aria-label"), off: getComputedStyle(b.querySelector(".tb-off")).display !== "none" }; });
    let s = await st();
    ck("D2: the speaker button is in the top bar, named, not pressed, Sound and Music on", s.pressed === "false" && s.sound && s.music && s.label === "Mute sound and music" && !s.off, JSON.stringify(s));
    await shot(p, "topbar-light-390");
    await p.click("#topbar .tb-mute"); s = await st();
    ck("D2: one tap mutes Sound and Music together and shows the struck speaker", s.pressed === "true" && !s.sound && !s.music && s.off, JSON.stringify(s));
    await p.reload(); await closeSheets(p); s = await st();
    ck("D2: muted is remembered after a reload", s.pressed === "true" && !s.sound && !s.music, JSON.stringify(s));
    await p.click("#topbar .tb-mute"); s = await st();
    ck("D2: the next tap brings both back", s.pressed === "false" && s.sound && s.music, JSON.stringify(s));
    await p.evaluate(() => NumbericsSettings.set({ music: false }));
    await p.click("#topbar .tb-mute"); s = await st();
    ck("D2: with Music already off, mute turns Sound off", s.pressed === "true" && !s.sound && !s.music, JSON.stringify(s));
    await p.click("#topbar .tb-mute"); s = await st();
    ck("D2: and unmute brings back only Sound (what was on)", s.pressed === "false" && s.sound && !s.music, JSON.stringify(s));
    await p.evaluate(() => NumbericsSettings.set({ sound: false }));
    ck("D2: the button follows a change made in Settings", (await st()).pressed === "true");
    ck("D2: the settings icon is a gear (a toothed outline and a hub), not rays", await p.evaluate(() => {
      const svg = document.querySelector('#topbar [data-open="settings"] svg'); return !!svg.querySelector("path[d^='M19 10.3']") && !!svg.querySelector("circle"); }));
    ck("D2, D5: no page errors", errs.length === 0, errs.join(" | "));
    await ctx.close();
    const c2 = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: "dark" }); await c2.addInitScript(SEEN, HOWTO);
    const q = await c2.newPage(); await q.goto(url);
    ck("D5: a fresh visit on a dark device paints Dark", await q.evaluate(() => document.documentElement.dataset.theme === "dark"));
    await c2.close();
    const c3 = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: "light" }); await c3.addInitScript(SEEN, HOWTO);
    await c3.addInitScript(() => { try { if (!sessionStorage.getItem("x")) { sessionStorage.setItem("x", 1); localStorage.setItem("numberics_settings_v1", JSON.stringify({ v: 1, theme: "dark" })); } } catch (e) { /* none */ } });
    const r = await c3.newPage(); await r.goto(url);
    ck("D5: a saved Dark choice is kept on a light device", await r.evaluate(() => document.documentElement.dataset.theme === "dark" && NumbericsSettings.get().theme === "dark"));
    await c3.close();
  }

  // ---- D4, D9: the Today card; the rollover at midnight ----
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: "dark" }); await ctx.addInitScript(SEEN, HOWTO);
    await ctx.clock.install({ time: new Date(2026, 10, 21, 12, 0) }); // a Saturday: the Daily Sudoku is Medium
    const p = await ctx.newPage(); await p.goto(url); await closeSheets(p);
    const card = () => p.evaluate(() => { const t = document.getElementById("today");
      return { streak: t.querySelector(".streak").textContent, chips: [...t.querySelectorAll(".chip")].map(c => c.childNodes[0].textContent + "|" + [...c.querySelectorAll("small")].map(x => x.textContent).join(" · ")), done: [...t.querySelectorAll(".chip.done")].length }; });
    let c = await card();
    ck("D4: a fresh Today card shows 'Start a streak today'", c.streak === "Start a streak today", JSON.stringify(c));
    ck("D9: the chips say Daily; Sudoku's shows its level (Medium on a Saturday)", c.chips.join() === "Daily Seven|Not yet,Daily Six|Not yet,Daily Sudoku|Medium · Not yet", c.chips.join());
    await p.evaluate(() => { NumbericsProgress.daily("seven", "807", { score: 807 }); NumbericsProgress.daily("seven", "300", { score: 300 });
      NumbericsProgress.daily("sudoku", "6:10", { score: 370, low: true }); NumbericsProgress.daily("sudoku", "4:12", { score: 252, low: true });
      NumbericsTrophies.report("seven", "end", { mode: "daily", daily: true, score: 807 }, { quiet: true }); NumbericsNav.draw(); });
    c = await card();
    ck("D9: a chip shows the day's best (a higher score, a lower time)", c.chips.join() === "Daily Seven|Best 807,Daily Six|Not yet,Daily Sudoku|Medium · Best 4:12" && c.done === 2, c.chips.join());
    ck("D4: one finished Daily reads '1 day'", c.streak === "1 day", c.streak);
    await p.evaluate(() => { NumbericsKit.flush(); const s = JSON.parse(localStorage.getItem("numberics_trophies_v1")); s.fam.streak = { n: 4, last: "20261121" }; localStorage.setItem("numberics_trophies_v1", JSON.stringify(s)); NumbericsNav.draw(); });
    ck("D4: a running streak reads 'N days'", (await card()).streak === "4 days");
    await shot(p, "today-dark-390");
    await ctx.close();
    // midnight with the page open
    const c2 = await browser.newContext({ viewport: { width: 390, height: 844 } }); await c2.addInitScript(SEEN, HOWTO);
    await c2.clock.install({ time: new Date(2026, 10, 25, 23, 59, 30) });
    const q = await c2.newPage(); await q.goto(url); await closeSheets(q);
    const lbl = () => q.evaluate(() => document.querySelector("#today .when span").textContent);
    const a = await lbl(); await q.clock.runFor(61000); const b = await lbl();
    ck("the Today label rolls over at midnight with the page open", /25/.test(a) && /26/.test(b) && a !== b, a + " -> " + b);
    await c2.close();
  }

  // ---- D6: no localStorage write inside the input handler; one batched idle write; nothing lost on leaving ----
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } }); await ctx.addInitScript(SEEN, HOWTO);
    await ctx.addInitScript(() => { const set = Storage.prototype.setItem; window.__w = []; Storage.prototype.setItem = function (k, v) { if (this === localStorage) window.__w.push(k); return set.call(this, k, v); }; });
    const p = await ctx.newPage(); await p.goto(url); await closeSheets(p);
    const r = await p.evaluate(() => new Promise(res => {
      window.__w.length = 0; const m0 = window.__numberics.state.moves;
      ["ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown", "ArrowLeft"].forEach(k => document.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true })));
      const sync = window.__w.length, moved = window.__numberics.state.moves - m0;
      setTimeout(() => res({ sync, moved, later: window.__w.slice() }), 1500);
    }));
    ck("D6: five moves write nothing to localStorage inside the input handlers", r.sync === 0 && r.moved >= 2, JSON.stringify(r));
    ck("D6: then one idle batch writes each key once (game save, progress, trophies)", r.later.length >= 1 && r.later.length <= 3 && new Set(r.later).size === r.later.length && r.later.indexOf("numberics_endless_v1") >= 0, r.later.join());
    const moves = await p.evaluate(() => { ["ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown"].forEach(k => document.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true }))); return window.__numberics.state.moves; });
    const nav = p.waitForNavigation(); await p.evaluate(() => location.reload()); await nav; await closeSheets(p);
    ck("D6: a move made just before leaving is saved (pagehide flushes the batch)", (await p.evaluate(() => window.__numberics.state.moves)) === moves, String(moves));
    await ctx.close();
  }

  // ---- the Load confirm and the "not a save" line, in the Settings sheet ----
  {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "nm-r4-"));
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: "dark" }); await ctx.addInitScript(SEEN, HOWTO);
    const p = await ctx.newPage(); await p.goto(url + "seven/"); await closeSheets(p);
    const text = await p.evaluate(() => JSON.stringify({ game: "numberics", v: 1, saved: "2026-11-20", data: NumbericsSettings.memory.enc({ numberics_seven_v1: JSON.stringify({ zz: "loaded" }) }) }));
    const good = path.join(tmp, "good.json"), bad = path.join(tmp, "bad.json");
    fs.writeFileSync(good, text); fs.writeFileSync(bad, JSON.stringify({ game: "numberics", v: 1, data: "garbage" }));
    await p.click('#topbar [data-open="settings"]');
    const pick = async f => { const fc = p.waitForEvent("filechooser"); await p.click('#sh-settings [data-mem="load"]'); await (await fc).setFiles(f); };
    await pick(bad);
    await p.waitForFunction(() => !document.querySelector("[data-memst]").hidden);
    ck("Load: a file that is not a save says so in the sheet, and nothing changes", /That file is not a Numberics save\. Nothing changed\./.test(await p.textContent("[data-memst]")));
    const before = await p.evaluate(() => localStorage.getItem("numberics_seven_v1"));
    await pick(good);
    await p.waitForSelector('#sh-settings [data-mem="yes"]');
    ck("Load: a real save asks first, naming its date ('Load it' / 'Cancel'), and has focus on Load it", /Load the save from 2026-11-20\?/.test(await p.textContent("[data-memst]")) &&
      await p.evaluate(() => document.activeElement.getAttribute("data-mem") === "yes" && !!document.querySelector('[data-mem="no"]')));
    await shot(p, "load-confirm");
    await p.click('#sh-settings [data-mem="no"]');
    ck("Load: Cancel changes nothing and closes the question", (await p.evaluate(() => localStorage.getItem("numberics_seven_v1"))) === before && await p.evaluate(() => document.querySelector("[data-memst]").hidden));
    await pick(good); await p.waitForSelector('#sh-settings [data-mem="yes"]');
    const nav = p.waitForNavigation(); await p.click('#sh-settings [data-mem="yes"]'); await nav;
    ck("Load: Load it loads the file and reloads", (await p.evaluate(() => localStorage.getItem("numberics_seven_v1"))) === JSON.stringify({ zz: "loaded" }) || /loaded/.test(await p.evaluate(() => localStorage.getItem("numberics_seven_v1") || "")));
    await ctx.close(); fs.rmSync(tmp, { recursive: true, force: true });
  }

  // ---- Night owl is never earned by opening a page late; the end-card glyph; Light preview tiles ----
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: "light" }); await ctx.addInitScript(SEEN, HOWTO);
    await ctx.clock.install({ time: new Date(2026, 10, 21, 2, 20) });
    for (const g of games) {
      const p = await ctx.newPage(); await p.goto(url + g.path); await closeSheets(p);
      await p.mouse.click(5, 300); await p.keyboard.press("ArrowLeft"); await p.clock.runFor(2500);
      const r = await p.evaluate(() => ({ owl: NumbericsTrophies.has("fam_night"), glyph: [...document.querySelectorAll(".over")].map(o => !!(o.firstElementChild && o.firstElementChild.matches("svg.glyph"))) }));
      ck(g.id + ": no Night owl from opening the page at 02:20 and a first tap", !r.owl);
      ck(g.id + ": every end card starts with the game's glyph", r.glyph.length >= 1 && r.glyph.every(Boolean), JSON.stringify(r.glyph));
      if (g.id === "four") {
        ck("four: the end card fades in (opacity only, kept under Less motion)", await p.evaluate(() => { const o = document.querySelector(".over"); o.hidden = false;
          const a = getComputedStyle(o).animationName; o.hidden = true; return a === "nm-fadein"; }));
      }
      await p.close();
    }
    const p = await ctx.newPage(); await p.goto(url); await closeSheets(p);
    ck("Light: the cream 1 and 2 preview tiles carry a visible edge on the cream well", await p.evaluate(() => [...document.querySelectorAll(".pv .mt.lo, .pv .mt.lo2")].length >= 3 &&
      [...document.querySelectorAll(".pv .mt.lo, .pv .mt.lo2")].every(e => /rgb\(185, 171, 144\) 0px 0px 0px 1px/.test(getComputedStyle(e).boxShadow))));
    await ctx.close();
  }
};
