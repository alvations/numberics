/* SPDX-License-Identifier: Apache-2.0 | Copyright 2026 alvations (Melon Lab)
 * Browser checks for B1, Settings + Memory and the sheet primitive (docs/design/REDESIGN.md 3.6, 6, 11).
 * Run: NODE_PATH=$(npm root -g) node tests/emu/run.cjs shared-settings */
"use strict";
const fs = require("fs"), os = require("os"), path = require("path");
const KEY = "numberics_settings_v1";
// a first-visit sheet (a game's how-to opens by itself once) is closed generically, whatever its id: wait two frames for
// a sheet a page opens after load, then close whichever is open
const closeSheets = (p) => p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => {
  if (window.NumbericsUI && NumbericsUI.open()) NumbericsUI.close(); r(); }))));
module.exports = async function ({ browser, url, ck, shot }) {
  const games = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "..", "games.json"), "utf8")).filter(g => g.status === "live");
  const FIB = url + "fibonacci/";
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "nm-b1-"));
  const html = p => p.evaluate(() => Object.assign({}, document.documentElement.dataset));
  const nmKeys = p => p.evaluate(() => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith("numberics_")) o[k] = localStorage.getItem(k); } return o; });
  // games open How to play on a first visit and write numberics_progress_v1: mark it seen for every game up front
  const HOWTO = JSON.stringify({ v: 1, games: {}, howto: Object.fromEntries(games.map(g => [g.id, true]).concat([["endless", true]])), daily: {} });
  const SEEN = h => { try { if (!localStorage.getItem("numberics_progress_v1")) localStorage.setItem("numberics_progress_v1", h); } catch (e) { /* blocked */ } };
  const newCtx = async o => { const c = await browser.newContext(o); await c.addInitScript(SEEN, HOWTO); return c; };
  const sw0 = (p, f) => p.click('#sh-settings [data-sw="' + f + '"]');
  // a game may open its How to play sheet on a first visit (Fibonacci, Three): close it, as a player would
  const settle = p => p.evaluate(() => { if (window.NumbericsUI && NumbericsUI.open() && NumbericsUI.current() !== "settings") NumbericsUI.close(); });
  const openSettings = async p => { await settle(p); await p.click('#topbar [data-open="settings"]'); await p.waitForSelector("#sh-settings:not([hidden])"); };

  // 1. the sheet primitive: dialog, focus, trap, Esc, scrim, scroll lock, keys never reach the game
  let ctx = await newCtx({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2 });
  let p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto(FIB); await settle(p);
  ck("closed at load: NumbericsUI.open() is false", await p.evaluate(() => NumbericsUI.open() === false && !document.querySelector(".scrim:not([hidden])")));
  // the listener is in place (awaited) before the click, so a loaded machine can never let the event slip past it
  await p.evaluate(() => { window.__ev = new Promise(r => addEventListener("numberics:sheet", e => r(e.detail), { once: true })); });
  const ev = p.evaluate(() => window.__ev);
  await openSettings(p);
  ck("numberics:sheet fires on open with { id, open }", JSON.stringify(await ev) === '{"id":"settings","open":true}');
  ck("open() is true and current() names the sheet", await p.evaluate(() => NumbericsUI.open() === true && NumbericsUI.current() === "settings"));
  ck("role=dialog, aria-modal, labelled by its title 'Settings'", await p.evaluate(() => {
    const d = document.querySelector("#sh-settings .sheet"); return d.getAttribute("role") === "dialog" && d.getAttribute("aria-modal") === "true" &&
      document.getElementById(d.getAttribute("aria-labelledby")).textContent === "Settings"; }));
  ck("focus moves to the close button", await p.evaluate(() => document.activeElement.classList.contains("sh-x")));
  const xr = await p.evaluate(() => { const r = document.querySelector("#sh-settings .sh-x").getBoundingClientRect(); return { w: r.width, h: r.height, cur: NumbericsUI.current() }; });
  ck("the close button is at least 44 x 44", Math.round(xr.w) >= 44 && Math.round(xr.h) >= 44, JSON.stringify(xr)); // sub-pixel while the sheet slides in
  ck("the page behind does not scroll", await p.evaluate(() => getComputedStyle(document.documentElement).overflow === "hidden"));
  ck("the sections are Sound and feel, Seeing, Memory, in order", (await p.$$eval("#sh-settings .sec", s => s.map(x => x.textContent))).join("|") === "Sound and feel|Seeing|Memory");
  ck("switches are button[role=switch][aria-checked], 52 x 32", await p.evaluate(() => [...document.querySelectorAll("#sh-settings .sw")].filter(b => b.offsetParent).every(b => {
    const r = b.getBoundingClientRect(); return b.tagName === "BUTTON" && b.getAttribute("role") === "switch" && b.hasAttribute("aria-checked") && Math.round(r.width) === 52 && Math.round(r.height) === 32; })));
  ck("segments are aria-pressed buttons 38 px high: music Style, Device / Less / Full and Dark / Light / Device", await p.evaluate(() => {
    const g = [...document.querySelectorAll("#sh-settings .seg3")].map(s => [...s.children].map(b => b.textContent.replace(/\u00a0/g, " ")).join("/"));
    return g.join("|") === "Auto (per game)/Chill/Drift/Pocket/Quest/Blocks/Pulse/Epic|Device/Less/Full|Dark/Light/Device" && [...document.querySelectorAll("#sh-settings .seg3 button")].every(b => b.getBoundingClientRect().height >= 38 && b.hasAttribute("aria-pressed")); }));
  ck("Vibration shows where navigator.vibrate exists", await p.isVisible('#sh-settings [data-sw="haptics"]'));
  ck("defaults shown: sound on, Motion Device, Theme Device (TRIAGE4 D5), volume 50", await p.evaluate(() =>
    document.querySelector('[data-sw="sound"]').getAttribute("aria-checked") === "true" && document.querySelector('[data-seg="motion"][data-v="auto"]').getAttribute("aria-pressed") === "true" &&
    document.querySelector('[data-seg="theme"][data-v="auto"]').getAttribute("aria-pressed") === "true" && document.querySelector("[data-vol]").value === "50"));
  // Music controls (docs/design/MUSIC.md, Settings fields)
  ck("Music sits right under Sound and Volume: Sound, Volume, Music, Music volume, Style, then Vibration", await p.evaluate(() =>
    [...document.querySelectorAll("#sh-settings [data-sw], #sh-settings [data-vol], #sh-settings [data-mvol], #sh-settings [data-mstyle]")]
      .map(e => e.getAttribute("data-sw") || (e.hasAttribute("data-vol") ? "vol" : e.hasAttribute("data-mvol") ? "mvol" : "style")).slice(0, 6).join() === "sound,vol,music,mvol,style,haptics"));
  ck("Music defaults: on ('Quiet tunes while you play'), music volume 50, Auto (per game) pressed", await p.evaluate(() =>
    document.querySelector('[data-sw="music"]').getAttribute("aria-checked") === "true" && /Quiet tunes while you play/.test(document.querySelector('[data-sw="music"]').parentNode.textContent) &&
    document.querySelector("[data-mvol]").value === "50" && !document.querySelector("[data-mvol]").disabled &&
    document.querySelector('[data-seg="musicStyle"][data-v="auto"]').getAttribute("aria-pressed") === "true"));
  ck("Style: eight buttons in two rows of four, each titled with its blurb", await p.evaluate(() => {
    const b = [...document.querySelectorAll('[data-seg="musicStyle"]')], top = b.map(x => Math.round(x.getBoundingClientRect().top));
    return b.length === 8 && top.slice(0, 4).every(t => t === top[0]) && top.slice(4).every(t => t === top[4]) && top[4] > top[0] && b.every(x => x.title.length > 5); }));
  await shot(p, "sheet-music");
  await sw0(p, "music");
  ck("Music off: switch unchecked, music volume disabled, Style hidden, saved", await p.evaluate(() =>
    document.querySelector('[data-sw="music"]').getAttribute("aria-checked") === "false" && document.querySelector("[data-mvol]").disabled &&
    !document.querySelector("[data-mstyle]").offsetParent && NumbericsSettings.get().music === false));
  await sw0(p, "music");
  await p.click('#sh-settings [data-seg="musicStyle"][data-v="pulse"]');
  await p.evaluate(() => { const v = document.querySelector("[data-mvol]"); v.value = "30"; v.dispatchEvent(new Event("input", { bubbles: true })); });
  ck("Music on again, Style Pulse and music volume 30 apply", await p.evaluate(() => { const s = NumbericsSettings.get();
    return s.music === true && s.musicStyle === "pulse" && s.musicVolume === 0.3 && document.querySelector("[data-mstyle]").offsetParent &&
      document.querySelector('[data-seg="musicStyle"][data-v="pulse"]').getAttribute("aria-pressed") === "true"; }));
  await p.click('#sh-settings [data-seg="musicStyle"][data-v="auto"]');
  await p.evaluate(() => NumbericsSettings.set({ musicVolume: 0.5 }));
  await shot(p, "sheet");
  const inside = () => p.evaluate(() => document.querySelector("#sh-settings .sheet").contains(document.activeElement));
  let trapped = true; for (let i = 0; i < 20; i++) { await p.keyboard.press("Tab"); if (!(await inside())) trapped = false; }
  ck("Tab is trapped in the sheet (20 presses)", trapped);
  await p.focus("#sh-settings .sh-x"); await p.keyboard.press("Shift+Tab");
  ck("Shift+Tab from the first control wraps to the last", await p.evaluate(() => document.activeElement.getAttribute("data-mem") === "erase"));
  const grid0 = await p.evaluate(() => JSON.stringify(window.__fibonacci.state.grid));
  for (const k of ["ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown"]) await p.keyboard.press(k);
  await p.evaluate(() => document.activeElement.blur()); // focus on the page behind
  for (const k of ["ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown", "u"]) await p.keyboard.press(k);
  ck("no game key reaches the board while a sheet is open", await p.evaluate(() => JSON.stringify(window.__fibonacci.state.grid)) === grid0);
  await p.keyboard.press("Tab");
  ck("Tab from outside the sheet comes back into it", await inside());
  await p.evaluate(() => { window.__evc = new Promise(r => addEventListener("numberics:sheet", e => r(e.detail), { once: true })); });
  const evc = p.evaluate(() => window.__evc);
  await p.keyboard.press("Escape");
  ck("Esc closes it, and fires numberics:sheet open:false", !(await p.isVisible("#sh-settings")) && JSON.stringify(await evc) === '{"id":"settings","open":false}');
  ck("focus returns to the Settings button", await p.evaluate(() => document.activeElement.getAttribute("data-open") === "settings"));
  ck("scrolling is restored", await p.evaluate(() => getComputedStyle(document.documentElement).overflow !== "hidden"));
  await p.keyboard.press("ArrowLeft"); await p.keyboard.press("ArrowUp");
  ck("game keys work again after closing", await p.evaluate(() => JSON.stringify(window.__fibonacci.state.grid)) !== grid0);
  await openSettings(p); await p.mouse.click(187, 20);
  ck("a scrim tap closes it", !(await p.isVisible("#sh-settings")));
  await openSettings(p); await p.click("#sh-settings .sh-x");
  ck("the close button closes it", !(await p.isVisible("#sh-settings")));
  await p.evaluate(() => NumbericsUI.sheet("howto", el => { el.innerHTML = "<p id=hx>x</p>"; }));
  ck("sheet(id, build) builds a titled sheet from the id ('How to play')", await p.isVisible("#hx") && (await p.textContent("#sh-howto h2")) === "How to play");
  await p.evaluate(() => NumbericsUI.sheet("settings", null));
  ck("opening another sheet replaces the first (one at a time)", !(await p.isVisible("#sh-howto")) && await p.isVisible("#sh-settings") && await p.evaluate(() => NumbericsUI.current() === "settings"));
  await p.keyboard.press("Escape");
  ck("after a swap, focus still returns to the original opener", await p.evaluate(() => document.activeElement === document.body || document.activeElement.getAttribute("data-open") === "settings"));
  ck("the sheet opens with translate+fade (motion on)", await p.evaluate(async () => { NumbericsUI.sheet("settings", null); const a = getComputedStyle(document.querySelector("#sh-settings .sheet")).animationName; NumbericsUI.close(); return a === "nm-sheet"; }));

  // 2. every control applies live and persists
  await openSettings(p);
  const sw = f => p.click('#sh-settings [data-sw="' + f + '"]'), seg = (f, v) => p.click('#sh-settings [data-seg="' + f + '"][data-v="' + v + '"]');
  const changes = await p.evaluate(() => { window.__ch = []; NumbericsSettings.on("change", (s, c) => window.__ch.push(c.join())); return true; });
  await seg("theme", "light");
  ck("Theme Light applies at once: data-theme and theme-color", (await html(p)).theme === "light" && await p.evaluate(() => document.querySelector('meta[name="theme-color"]').content === "#f5f1e8"));
  ck("the background follows the theme live", await p.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--bg").trim() === "#f5f1e8"));
  await sw("text"); ck("Larger text applies at once (root font 19px)", (await html(p)).text === "large" && await p.evaluate(() => getComputedStyle(document.documentElement).fontSize === "19px"));
  await sw("contrast"); ck("High contrast applies at once", (await html(p)).contrast === "high");
  await seg("motion", "reduced"); ck("Motion Less applies at once", (await html(p)).motion === "reduced" && await p.evaluate(() => NumbericsKit.reducedMotion() === true));
  await sw("sound"); await sw("haptics");
  await p.evaluate(() => { const v = document.querySelector("[data-vol]"); v.value = "75"; v.dispatchEvent(new Event("input", { bubbles: true })); });
  ck("the change listeners heard every control", changes && (await p.evaluate(() => window.__ch.join("|"))) === "theme|text|contrast|motion|sound|haptics|volume");
  ck("controls reflect the new state", await p.evaluate(() => document.querySelector('[data-sw="sound"]').getAttribute("aria-checked") === "false" &&
    document.querySelector('[data-sw="text"]').getAttribute("aria-checked") === "true" && document.querySelector('[data-seg="theme"][data-v="light"]').getAttribute("aria-pressed") === "true" &&
    document.querySelector('[data-seg="theme"][data-v="dark"]').getAttribute("aria-pressed") === "false"));
  await shot(p, "sheet-light-large");
  await p.reload(); await settle(p);
  const st = JSON.parse(await p.evaluate(k => localStorage.getItem(k), KEY));
  ck("everything persisted in numberics_settings_v1", st.theme === "light" && st.text === "large" && st.contrast === "high" && st.motion === "reduced" && st.sound === false && st.haptics === false && st.volume === 0.75, JSON.stringify(st));
  const d0 = await html(p);
  ck("after a reload the page paints with them (boot)", d0.theme === "light" && d0.text === "large" && d0.contrast === "high" && d0.motion === "reduced", JSON.stringify(d0));
  await openSettings(p);
  ck("the sheet opens with the saved state", await p.evaluate(() => document.querySelector("[data-vol]").value === "75" && document.querySelector('[data-seg="motion"][data-v="reduced"]').getAttribute("aria-pressed") === "true"));
  ck("reduced motion: the sheet only fades", await p.evaluate(() => getComputedStyle(document.querySelector("#sh-settings .sheet")).animationName === "nm-fadein"));
  await p.emulateMedia({ colorScheme: "dark" });
  await seg("theme", "auto"); ck("Theme Device follows the device (dark here)", (await html(p)).theme === "dark");
  await p.emulateMedia({ colorScheme: "light" }); await p.waitForTimeout(50);
  ck("Theme Device: a device switch to light applies live", (await html(p)).theme === "light");
  await p.emulateMedia({ colorScheme: "dark" });
  ck("errors: none on the settings page", errs.length === 0, errs.join(" | "));
  await ctx.close();

  // 3. Motion Full beats the OS reduce: tiles slide
  ctx = await newCtx({ viewport: { width: 375, height: 812 }, reducedMotion: "reduce" });
  p = await ctx.newPage();
  await p.goto(FIB); await settle(p);
  const slides = async () => { await p.evaluate(() => { const s = window.__fibonacci.state; s.grid = new Array(16).fill(0); s.grid[3] = 1; s.grid[15] = 2; window.__fibonacci.state = s; });
    await p.keyboard.press("ArrowLeft");
    return p.evaluate(() => document.getAnimations().some(a => a.transitionProperty === "transform") &&
      [...document.querySelectorAll(".tiles .tile")].some(t => parseFloat(getComputedStyle(t).transitionDuration) > 0)); };
  ck("OS reduce + Motion Device: effective reduced, tiles do not slide", (await html(p)).motion === "reduced" && !(await slides()));
  await openSettings(p); await p.click('#sh-settings [data-seg="motion"][data-v="full"]'); await p.keyboard.press("Escape");
  ck("Motion Full: data-motion full at once", (await html(p)).motion === "full" && await p.evaluate(() => NumbericsMotion.reduced() === false && NumbericsKit.reducedMotion() === false));
  await p.reload(); await settle(p);
  ck("OS reduce + Motion Full (after a reload): tiles slide", (await html(p)).motion === "full" && await slides());
  await ctx.close();

  // 4. blocked storage: the page and every control still work, in memory
  ctx = await newCtx({ viewport: { width: 375, height: 812 } });
  await ctx.addInitScript(() => { Object.defineProperty(window, "localStorage", { get() { throw new Error("blocked"); } });
    delete Navigator.prototype.vibrate; window.AudioContext = undefined; window.webkitAudioContext = undefined; });
  p = await ctx.newPage(); const errs2 = []; p.on("pageerror", e => errs2.push(e.message));
  await p.goto(FIB); await settle(p);
  await openSettings(p);
  await p.click('#sh-settings [data-seg="theme"][data-v="light"]'); await p.click('#sh-settings [data-sw="text"]');
  ck("no navigator.vibrate: the Vibration row is not shown", await p.locator('#sh-settings [data-sw="haptics"]').count() === 0 && !/Vibration/.test(await p.textContent("#sh-settings")));
  await p.click('#sh-settings [data-sw="sound"]'); await p.evaluate(() => { const v = document.querySelector("[data-vol]"); v.value = "20"; v.dispatchEvent(new Event("input", { bubbles: true })); });
  ck("no Web Audio: Sound and Volume still work", await p.evaluate(() => NumbericsSettings.get().sound === false && NumbericsSettings.get().volume === 0.2));
  ck("blocked storage: settings apply in memory", (await html(p)).theme === "light" && (await html(p)).text === "large" && await p.evaluate(() => NumbericsSettings.get().theme === "light"));
  const dl0 = p.waitForEvent("download"); await p.click('#sh-settings [data-mem="save"]'); const dlb = await dl0;
  ck("blocked storage: Save still downloads a file", /numberics-save\.json/.test(dlb.suggestedFilename()));
  ck("blocked storage: no page errors", errs2.length === 0, errs2.join(" | "));
  await ctx.close();

  // 5. Memory: Save -> Load round-trips every numberics_* key; corrupt files change nothing; Erase keeps settings
  const SEED = { numberics_endless_v1: JSON.stringify({ score: 1136, grid: [1, 2, 3] }), numberics_sudoku_v1: JSON.stringify({ name: "café 数" }),
    numberics_trophies_v1: JSON.stringify({ got: { fam_first: 1 } }), numberics_fibonacci_v1: JSON.stringify({ moves: 9 }),
    numberics_progress_v1: HOWTO,
    [KEY]: JSON.stringify({ v: 1, sound: true, volume: 0.4, haptics: true, motion: "auto", theme: "light", text: "normal", contrast: "high",
      music: false, musicVolume: 0.3, musicStyle: "quest", unmute: "both" }), other_site_key: "x" };
  ctx = await newCtx({ viewport: { width: 375, height: 812 }, acceptDownloads: true });
  p = await ctx.newPage(); const errs3 = []; p.on("pageerror", e => errs3.push(e.message));
  await p.goto(url + "seven/");
  await p.evaluate(s => { localStorage.clear(); for (const k in s) localStorage.setItem(k, s[k]); }, SEED);
  await p.reload();
  // the page's own saves are batched (TRIAGE4 D6): flush them so `before` is what Save will see
  const before = await p.evaluate(() => { NumbericsKit.flush(); return true; }).then(() => nmKeys(p));
  await p.evaluate(() => { window.__rep = []; const r = NumbericsTrophies.report; NumbericsTrophies.report = function (g, e) { window.__rep.push(g + ":" + e); return r.apply(this, arguments); }; });
  await openSettings(p);
  const dl = p.waitForEvent("download"); await p.click('#sh-settings [data-mem="save"]'); const d = await dl;
  const file = path.join(tmp, "save.json"); await d.saveAs(file);
  const text = fs.readFileSync(file, "utf8"), json = JSON.parse(text);
  ck("Save downloads numberics-save.json", d.suggestedFilename() === "numberics-save.json");
  ck("the file is { game, v, saved, data } and scrambled", json.game === "numberics" && json.v === 1 && /^\d{4}-\d\d-\d\d$/.test(json.saved) && !/1136|fam_first|endless/.test(text));
  ck("Save reports the fam_keep event (report('fam','saved'))", (await p.evaluate(() => window.__rep.join())) === "fam:saved");
  // load it into a different browser profile with other data
  const ctx2 = await newCtx({ viewport: { width: 375, height: 812 } });
  const q = await ctx2.newPage(); const errs4 = []; q.on("pageerror", e => errs4.push(e.message));
  await q.goto(url + "fibonacci/");
  await q.evaluate(() => { localStorage.clear(); localStorage.setItem("numberics_endless_v1", '{"score":2}'); localStorage.setItem("numberics_fifteen_v1", '{"keep":1}'); });
  await q.reload();
  await openSettings(q);
  const fc = q.waitForEvent("filechooser"); await q.click('#sh-settings [data-mem="load"]'); const chooser = await fc;
  ck("Load opens a .json file picker", /\.json/.test(await q.evaluate(() => document.querySelector("#sh-settings [data-file]").accept)));
  await chooser.setFiles(file); await q.waitForSelector('#sh-settings [data-mem="yes"]');
  ck("Load asks first (TRIAGE4 family): 'Load the save from <date>?'", /Load the save from \d{4}-\d\d-\d\d\?/.test(await q.textContent("#sh-settings [data-memst]")));
  const nav = q.waitForNavigation(); await q.click('#sh-settings [data-mem="yes"]'); await nav;
  const after = await nmKeys(q);
  ck("Load replaced every numberics_* key in the file, byte for byte", Object.keys(before).every(k => after[k] === before[k]), JSON.stringify(after).slice(0, 200));
  // the file holds every numberics_* key on the device at Save (the seeded ones plus any the page wrote itself), and no other
  const fileKeys = (await p.evaluate(t => Object.keys(NumbericsSettings.memory.unpack(t) || {}), text)).sort();
  ck("the save held exactly the numberics_* keys (not other_site_key)", fileKeys.every(k => k.startsWith("numberics_")) &&
    Object.keys(SEED).filter(k => k.startsWith("numberics_")).every(k => fileKeys.includes(k)) && JSON.stringify(fileKeys) === JSON.stringify(Object.keys(before).sort()), fileKeys.join());
  ck("keys the file does not hold are left alone", after.numberics_fifteen_v1 === '{"keep":1}');
  ck("the loaded settings apply after the reload", (await html(q)).theme === "light" && (await html(q)).contrast === "high");
  ck("the music settings travel with the save (Music off, 30, Quest)", await q.evaluate(() => { const s = NumbericsSettings.get(); return s.music === false && s.musicVolume === 0.3 && s.musicStyle === "quest"; }));
  // corrupt files
  const bad = path.join(tmp, "bad.json"); fs.writeFileSync(bad, JSON.stringify(Object.assign({}, json, { data: json.data.slice(0, 12) })));
  const notjson = path.join(tmp, "not.json"); fs.writeFileSync(notjson, "hello");
  for (const f of [bad, notjson]) {
    const snap = await nmKeys(q);
    await openSettings(q);
    const c2 = q.waitForEvent("filechooser"); await q.click('#sh-settings [data-mem="load"]'); await (await c2).setFiles(f);
    await q.waitForFunction(() => document.getElementById("toast").classList.contains("on"));
    ck("a bad file shows 'That file is not a Numberics save.' over the sheet (" + path.basename(f) + ")",
      (await q.textContent("#toast")) === "That file is not a Numberics save." && await q.evaluate(() => {
        const t = document.getElementById("toast"), r = t.getBoundingClientRect(), hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return +getComputedStyle(t).zIndex > +getComputedStyle(document.querySelector("#sh-settings")).zIndex || t.contains(hit); }));
    ck("a bad file changes nothing (" + path.basename(f) + ")", JSON.stringify(await nmKeys(q)) === JSON.stringify(snap));
    await q.keyboard.press("Escape");
  }
  await shot(q, "bad-file");
  // erase
  await openSettings(q);
  await q.click('#sh-settings [data-mem="erase"]');
  ck("Erase asks first: 'Sure? Erase everything'", (await q.textContent('#sh-settings [data-mem="erase"]')) === "Sure? Erase everything" && Object.keys(await nmKeys(q)).length > 1);
  const nav2 = q.waitForNavigation(); await q.click('#sh-settings [data-mem="erase"]'); await nav2;
  const left = await nmKeys(q);
  ck("Erase removes every numberics_* key except the settings (the page may write its fresh save after the reload)",
    left[KEY] === before[KEY] && !left.numberics_endless_v1 && !left.numberics_trophies_v1 && !left.numberics_sudoku_v1 && !left.numberics_fifteen_v1, Object.keys(left).join());
  ck("settings survive Erase and still apply", (await html(q)).theme === "light");
  ck("memory: no page errors", errs3.length === 0 && errs4.length === 0, errs3.concat(errs4).join(" | "));
  await ctx2.close(); await ctx.close();

  // 6. every page: the Settings button opens the sheet and a change applies live there
  ctx = await newCtx({ viewport: { width: 1280, height: 860 } });
  for (const g of [{ id: "home", path: "" }].concat(games)) { // the games page (O-9), then every game
    p = await ctx.newPage(); const e5 = []; p.on("pageerror", e => e5.push(e.message));
    await p.goto(url + g.path);
    await p.evaluate(() => { try { localStorage.removeItem("numberics_settings_v1"); } catch (e) { /* none */ } });
    await p.reload();
    await closeSheets(p); // a first-visit how-to sheet (any game)
    await openSettings(p);
    await p.click('#sh-settings [data-seg="theme"][data-v="light"]'); await p.click('#sh-settings [data-sw="contrast"]');
    const dd = await html(p);
    ck(g.id + ": the Settings sheet opens and applies live", dd.theme === "light" && dd.contrast === "high" && await p.evaluate(() => NumbericsUI.open()));
    ck(g.id + ": the sheet sits on screen over the page", await p.evaluate(() => {
      const s = document.querySelector("#sh-settings"), r = s.querySelector(".sheet").getBoundingClientRect();
      return getComputedStyle(s).position === "fixed" && r.top >= 0 && r.bottom <= innerHeight + 1; }));
    if (!g.path) await shot(p, "home-desktop");
    await p.keyboard.press("Escape");
    ck(g.id + ": Esc closes it, no page errors", !(await p.isVisible("#sh-settings")) && e5.length === 0, e5.join(" | "));
    await p.evaluate(() => { try { localStorage.removeItem("numberics_settings_v1"); } catch (e) { /* none */ } });
    await p.close();
  }
  await ctx.close();
  fs.rmSync(tmp, { recursive: true, force: true });
};
