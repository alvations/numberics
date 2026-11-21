/* SPDX-License-Identifier: Apache-2.0 | Copyright 2026 alvations (Melon Lab)
 * O-10 "Check that the BGM and SFX is working properly": the sound is measured, not inferred. An init script taps the
 * real graph with AnalyserNodes (the SFX master and the music bus where each joins the compressor, and the compressor's
 * output) and reads peak and RMS every 10 ms, so every check below is about signal that reaches the speakers.
 * Headless Chromium never enforces the autoplay policy for Web Audio (measured: a context made with no gesture runs,
 * whatever --autoplay-policy says), so the same script emulates the default policy: a context made or resumed before
 * the first real activating input (pointer, mouse, touch, or a key other than Escape) stays suspended.
 *   1. every game page: nothing before a gesture; a real move, drop, take or place sounds; music.js loads once and the
 *      game's mapped style (MUSIC.md, per-game map) is audible; no errors.
 *   2. one page in depth, through the real controls: Sound off, Volume, the top-bar mute (and back), Music off and on,
 *      Music volume, every style from the Settings sheet (no stacked loops, bounded voices), a hidden tab, navigation.
 *   3. a first key that is Escape (not an activation), storage that throws, and the /numberics/beta/ path.
 *   4. every style rendered offline: audible, peak <= -1 dBFS, no clipped sample. SOUND_SEAM=1 also renders each style
 *      across its loop seam (a full pass and more, slow) and checks for a gap or a click there.
 * Run: NODE_PATH=$(npm root -g) node tests/emu/run.cjs shared-audible */
"use strict";
const fs = require("fs"), path = require("path"), http = require("http");
const ROOT = path.join(__dirname, "..", "..");
// the per-game map, as MUSIC.md states it (the test's own copy, so a drift in music.js shows)
const MAP = { two: "chill", fibonacci: "quest", three: "pocket", four: "pulse", five: "epic", six: "drift", seven: "blocks", nine: "epic", fifteen: "pocket", sudoku: "drift" };
// one real action per game (k: a key, c: a click on a selector), and the sound names a real action may make
const ACT = {
  fibonacci: ["k:ArrowLeft", "k:ArrowDown", "k:ArrowRight", "k:ArrowUp", "k:ArrowLeft", "k:ArrowDown"],
  two: ["k:ArrowLeft", "k:ArrowDown", "k:ArrowRight", "k:ArrowUp", "k:ArrowLeft", "k:ArrowDown"],
  three: ["k:ArrowLeft", "k:ArrowDown", "k:ArrowRight", "k:ArrowUp"],
  four: ["k:ArrowLeft", "k:Enter"],
  five: ["k:ArrowDown", "k:ArrowLeft", "k:ArrowRight", "k:Enter", "k:ArrowUp", "k:Enter"],
  six: ["k:+", "k:ArrowLeft"],
  seven: ["k:ArrowRight", "k:Enter"],
  nine: ["k:ArrowRight", "k:ArrowDown", "k:Enter"],
  fifteen: ['c:.ft[data-n="5"]'],
  sudoku: ["c:.c:not(.given) >> nth=0", "k:5"],
};
// SFX peaks at the default volume sit near 0.05 to 0.12 on the SFX bus; the music bus at defaults near 0.003 to 0.015
const AUDIBLE = 0.005, MUSIC_AUDIBLE = 0.0005, SILENT = 1e-5;

// runs before any page script
const METER = () => {
  if (window.__meter) return;
  const M = window.__meter = { taps: [], ctxs: 0, early: 0, rej: [], act: false, music: [] };
  addEventListener("unhandledrejection", e => M.rej.push(String(e.reason && e.reason.message || e.reason)));
  addEventListener("numberics:music", e => M.music.push(e.detail && e.detail.style));
  const activate = e => { if (e.isTrusted && !(e.type === "keydown" && e.key === "Escape")) M.act = true; };
  ["pointerdown", "mousedown", "pointerup", "keydown", "touchend"].forEach(n => addEventListener(n, activate, { capture: true }));
  const AC = window.AudioContext; if (!AC) return;
  const conn = AudioNode.prototype.connect;
  const tap = (node, kind) => {
    const c = node.context, an = c.createAnalyser(), z = c.createGain();
    an.fftSize = 1024; z.gain.value = 0; conn.call(node, an); conn.call(an, z); conn.call(z, c.destination);
    M.taps.push({ kind, node, an, buf: new Float32Array(1024), peak: 0, sq: 0, n: 0 });
  };
  AudioNode.prototype.connect = function (dst) {
    const r = conn.apply(this, arguments);
    try {
      if (this.context instanceof AC) {
        if (dst instanceof DynamicsCompressorNode && this instanceof GainNode) { dst.__n = (dst.__n || 0) + 1; tap(this, dst.__n === 1 ? "sfx" : "music"); }
        else if (this instanceof DynamicsCompressorNode && dst === this.context.destination) tap(this, "out");
      }
    } catch (e) { /* the meter only */ }
    return r;
  };
  window.AudioContext = class extends AC {
    constructor(...a) { super(...a); M.ctxs++; if (!M.act) { M.early++; AC.prototype.suspend.call(this); } }
    resume() { if (!M.act) { M.early++; return Promise.resolve(); } return AC.prototype.resume.call(this); }
  };
  setInterval(() => {
    for (const t of M.taps) { t.an.getFloatTimeDomainData(t.buf); for (let i = 0; i < t.buf.length; i++) { const a = Math.abs(t.buf[i]); if (a > t.peak) t.peak = a; t.sq += a * a; } t.n += t.buf.length; }
  }, 10);
  // peak and RMS per tap kind since the last read (then reset)
  window.__read = () => {
    const o = { sfx: { peak: 0, rms: 0 }, music: { peak: 0, rms: 0 }, out: { peak: 0, rms: 0 } };
    for (const t of M.taps) { const v = { peak: t.peak, rms: t.n ? Math.sqrt(t.sq / t.n) : 0 }; if (v.peak >= o[t.kind].peak) o[t.kind] = v; t.peak = 0; t.sq = 0; t.n = 0; }
    return o;
  };
};
const setHidden = h => {
  Object.defineProperty(document, "hidden", { configurable: true, get: () => h });
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => (h ? "hidden" : "visible") });
  document.dispatchEvent(new Event("visibilitychange"));
};
const r4 = x => Math.round(x * 1e5) / 1e5;
const fmt = o => JSON.stringify(o, (k, v) => (typeof v === "number" ? r4(v) : v));

module.exports = async function ({ browser, url, ck }) {
  const games = JSON.parse(fs.readFileSync(path.join(ROOT, "games.json"), "utf8")).filter(g => g.status === "live");
  const HOWTO = JSON.stringify({ v: 1, games: {}, howto: Object.fromEntries(games.map(g => [g.id, true]).concat([["endless", true]])), daily: {} });
  // Two moves from the root to two/ (games.json path); fall back to the root while the move is in flight
  const pathOf = id => { const g = games.find(x => x.id === id); return g && g.path != null ? g.path : id === "two" ? "" : id + "/"; };

  async function open(base, where, o) {
    o = o || {};
    const c = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await c.addInitScript(METER);
    if (o.throwing) await c.addInitScript(() => { Object.defineProperty(window, "localStorage", { configurable: true, get() { throw new DOMException("denied", "SecurityError"); } }); });
    else await c.addInitScript(s => { try { if (!localStorage.getItem("numberics_progress_v1")) localStorage.setItem("numberics_progress_v1", s); } catch (e) { /* none */ } }, HOWTO);
    const p = await c.newPage(), errs = [], reqs = [];
    p.on("pageerror", e => errs.push("pageerror: " + e.message));
    p.on("console", m => { if (m.type() === "error" && !/favicon/.test(m.text())) errs.push("console: " + m.text()); });
    p.on("request", r => { if (/music\.js/.test(r.url())) reqs.push(r.url()); });
    p.on("requestfailed", r => { if (/music\.js|audio\.js/.test(r.url())) errs.push("failed: " + r.url()); });
    await p.goto(base + where); await p.waitForTimeout(250);
    const errors = async () => errs.concat((await p.evaluate(() => window.__meter.rej)).map(x => "rejection: " + x));
    return { c, p, errs, reqs, errors };
  }
  const measure = async (p, ms) => { await p.evaluate(() => window.__read()); await p.waitForTimeout(ms); return p.evaluate(() => window.__read()); };
  const spy = p => p.evaluate(() => {
    const A = window.NumbericsAudio; window.__calls = [];
    A.NAMES.forEach(n => { const f = A[n]; A[n] = function () { const r = f.apply(A, arguments); window.__calls.push(r ? n : n + "(x)"); return r; }; });
  });
  const act = async (p, list) => { for (const a of list) { if (a[0] === "k") await p.keyboard.press(a.slice(2)); else await p.locator(a.slice(2)).click(); await p.waitForTimeout(220); } };
  const musicUp = p => p.waitForFunction(() => window.NumbericsMusic && !window.NumbericsMusic.stub && window.NumbericsMusic.state().playing, null, { timeout: 5000 }).then(() => true, () => false);
  const st = p => p.evaluate(() => window.NumbericsMusic.state());
  const taps = p => p.evaluate(() => window.__meter.taps.map(t => t.kind).sort().join(","));

  // ---- 1. every game page ----
  const table = [];
  const onePage = async id => {
    const where = pathOf(id), { c, p, reqs, errors } = await open(url, where);
    const pre = await p.evaluate(() => ({ ctx: window.__meter.ctxs, stub: !!(window.NumbericsMusic && window.NumbericsMusic.stub), r: window.__read() }));
    ck(id + ": before a gesture: no AudioContext, music.js not loaded, no signal", pre.ctx === 0 && pre.stub && reqs.length === 0, fmt(pre));
    await spy(p); await p.evaluate(() => window.__read());
    await act(p, ACT[id]); await p.waitForTimeout(250);
    const a = await p.evaluate(() => ({ calls: window.__calls, m: window.__read(), early: window.__meter.early }));
    const played = a.calls.filter(n => !/\(x\)$/.test(n)), real = played.filter(n => n !== "tick");
    ck(id + ": a real action plays its sound (" + [...new Set(played)].join(" ") + "), audible at the output", real.length > 0 && a.m.sfx.peak > AUDIBLE && a.m.out.peak > AUDIBLE, fmt(a));
    ck(id + ": no context was made or resumed before the first real gesture", a.early === 0, String(a.early));
    const up = await musicUp(p); await p.waitForTimeout(1900); // past most of the 2.5 s fade-in
    const m = await measure(p, 1200), s = await st(p);
    ck(id + ": BGM: music.js loaded once, Auto plays the mapped style (" + MAP[id] + "), audible", up && reqs.length === 1 && s.style === MAP[id] && s.shared && m.music.peak > MUSIC_AUDIBLE, fmt({ reqs, s, m }));
    ck(id + ": one AudioContext, one SFX bus, one music bus", await p.evaluate(() => window.__meter.ctxs) === 1 && await taps(p) === "music,out,sfx", await taps(p));
    const e = await errors(); ck(id + ": no errors or rejections", !e.length, e.join(" | "));
    table.push(id + " " + [...new Set(real)].join("/") + " sfx " + r4(a.m.sfx.peak) + " music " + s.style + " " + r4(m.music.peak));
    await c.close();
  };
  const ids10 = Object.keys(MAP);
  for (let i = 0; i < ids10.length; i += 5) await Promise.all(ids10.slice(i, i + 5).map(onePage)); // five pages at a time
  if (process.env.SOUND_REPORT) console.log(table.join("\n"));

  // ---- 2. one page in depth, through the real controls ----
  {
    const { c, p, errors } = await open(url, pathOf("two"));
    const settings = async () => { if (!(await p.locator("[data-sw=sound]").isVisible().catch(() => false))) await p.click('#topbar [data-open="settings"]'); await p.waitForSelector("[data-sw=sound]"); };
    const closeSheet = async () => { await p.keyboard.press("Escape"); await p.waitForTimeout(150); };
    const move = async () => { await p.evaluate(() => window.__read()); await act(p, ["k:ArrowLeft", "k:ArrowDown", "k:ArrowRight", "k:ArrowUp"]); return p.evaluate(() => window.__read()); };
    await p.keyboard.press("ArrowLeft"); await musicUp(p); await p.waitForTimeout(2300);
    await settings();
    const labels = await p.locator(".lbl b").allTextContents();
    ck("Settings: the style row is labelled Music style, and no row is a bare Style", labels.includes("Music style") && !labels.includes("Style"), labels.join("|"));

    // Sound off (the Settings switch): SFX silent, music plays on; back on: audible again
    await p.click("[data-sw=sound]"); await closeSheet();
    let m = await move();
    ck("Sound off: a move makes no SFX signal, the music plays on", m.sfx.peak < SILENT && m.music.peak > MUSIC_AUDIBLE, fmt(m));
    await settings(); await p.click("[data-sw=sound]"); await closeSheet();
    m = await move(); ck("Sound back on: moves are audible again", m.sfx.peak > AUDIBLE, fmt(m));

    // Volume (the slider): the same sound at 100 and 25 differs by the slider's ratio (master = volume * 0.5)
    const lvl = async v => { await settings(); await p.locator("[data-vol]").fill(String(v)); await p.waitForTimeout(150); await p.evaluate(() => window.__read());
      await p.evaluate(() => window.NumbericsAudio.place()); await p.waitForTimeout(200); return (await p.evaluate(() => window.__read())).sfx.peak; };
    const hi = await lvl(100), lo = await lvl(25); await p.locator("[data-vol]").fill("50");
    ck("Volume: 25 plays the same sound a quarter as loud as 100 (12 dB)", hi > AUDIBLE && Math.abs(hi / lo - 4) < 0.4, r4(hi) + " / " + r4(lo));

    // Music volume (the slider): the music bus follows it (musicVolume * 0.07), and the level heard follows too
    await p.locator("[data-mvol]").fill("100"); await p.waitForTimeout(300);
    const mHi = await measure(p, 1500), mixHi = (await st(p)).mix;
    await p.locator("[data-mvol]").fill("20"); await p.waitForTimeout(300);
    const mLo = await measure(p, 1500), mixLo = (await st(p)).mix;
    await p.locator("[data-mvol]").fill("50");
    ck("Music volume: 100 and 20 set the mix to 0.07 and 0.014, and the music heard is clearly quieter at 20",
      Math.abs(mixHi - 0.07) < 1e-4 && Math.abs(mixLo - 0.014) < 1e-4 && mHi.music.rms > 2.5 * mLo.music.rms && mLo.music.peak > SILENT * 10, fmt({ mHi, mLo, mixHi, mixLo }));

    // Music off and on (the Settings switch)
    await p.click("[data-sw=music]"); await p.waitForTimeout(500);
    m = await measure(p, 600); let s = await st(p);
    ck("Music off: the music stops and is silent; the style row hides", !s.playing && m.music.peak < SILENT && await p.locator("[data-mstyle]").isHidden(), fmt({ s, m }));
    await p.click("[data-sw=music]"); await p.waitForTimeout(2200);
    m = await measure(p, 800); s = await st(p);
    ck("Music on again: it plays and is audible", s.playing && m.music.peak > MUSIC_AUDIBLE, fmt({ s, m }));

    // every style from the sheet: what plays switches, the signal continues, no stacked loops, voices stay bounded
    await p.evaluate(() => { window.__live = []; window.__lt = setInterval(() => { const s = window.NumbericsMusic.state(); window.__live.push([s.live, s.fading]); }, 250); });
    const ids = ["auto"].concat(await p.evaluate(() => window.NumbericsSettings.STYLES.map(x => x.id)));
    const per = []; let prev = (await st(p)).style;
    for (const sid of ids) {
      const ev0 = await p.evaluate(() => window.__meter.music.length);
      await p.click('[data-seg=musicStyle][data-v="' + sid + '"]'); await p.waitForTimeout(900);
      m = await measure(p, 1100); s = await st(p);
      const want = sid === "auto" ? MAP.two : sid, ev = await p.evaluate(() => window.__meter.music.slice());
      const pressed = await p.getAttribute('[data-seg=musicStyle][data-v="' + sid + '"]', "aria-pressed");
      ck("style " + sid + ": the button is pressed, " + want + " plays, it is audible through the crossfade", pressed === "true" && s.style === want && s.playing && s.fading <= 1 && m.music.peak > MUSIC_AUDIBLE, fmt({ s, m }));
      const changed = want !== prev; prev = want;
      ck("style " + sid + ": numberics:music announces " + (changed ? "the new style once" : "nothing (the same style plays on)"), ev.length === ev0 + (changed ? 1 : 0) && ev[ev.length - 1] === want, JSON.stringify(ev));
      per.push(want + " " + r4(m.music.peak) + " live " + s.live);
    }
    await p.click('[data-seg=musicStyle][data-v="auto"]');
    await p.waitForTimeout(3200);
    const L = await p.evaluate(() => { clearInterval(window.__lt); return window.__live; }); s = await st(p);
    const maxLive = Math.max(...L.map(x => x[0])), maxFade = Math.max(...L.map(x => x[1]));
    ck("styles: over " + (L.length / 4).toFixed(0) + " s of switching, at most two styles at once (one fading) and live voices bounded (max " + maxLive + ")",
      maxFade <= 1 && maxLive < 160, JSON.stringify(L));
    ck("styles: after the last crossfade one style plays, nothing is fading, one music bus", s.playing && s.fading === 0 && s.style === MAP.two && await taps(p) === "music,out,sfx", fmt(s));
    if (process.env.SOUND_REPORT) console.log(per.join("\n"));
    await closeSheet();

    // the top-bar mute: silences SFX and music; the next tap brings both back
    await p.click("#topbar .tb-mute"); await p.waitForTimeout(500);
    m = await move(); s = await st(p);
    ck("Mute: the button reads pressed; moves and music are silent", await p.getAttribute("#topbar .tb-mute", "aria-pressed") === "true" && m.sfx.peak < SILENT && m.music.peak < SILENT && !s.playing, fmt({ m, s }));
    await p.evaluate(() => window.__read());
    await p.click("#topbar .tb-mute"); await p.waitForTimeout(120);
    const back = await p.evaluate(() => window.__read());
    ck("Unmute: the tap itself ticks (audible)", back.sfx.peak > AUDIBLE, fmt(back));
    m = await move(); ck("Unmute: moves sound again", m.sfx.peak > AUDIBLE, fmt(m));
    await p.waitForTimeout(1800); m = await measure(p, 800); s = await st(p);
    ck("Unmute: the music comes back, audible", s.playing && m.music.peak > MUSIC_AUDIBLE && await p.getAttribute("#topbar .tb-mute", "aria-pressed") === "false", fmt({ m, s }));

    // a hidden tab: the music fades out and stops booking; visible again: it resumes
    await p.evaluate(setHidden, true); await p.waitForTimeout(350);
    const n0 = (await st(p)).notes; m = await measure(p, 700); s = await st(p);
    const sfxHidden = await p.evaluate(() => window.NumbericsAudio.place());
    ck("hidden tab: music silent, nothing booked, no SFX", s.paused && m.music.peak < SILENT && s.notes === n0 && sfxHidden === false, fmt({ s, m, n0 }));
    await p.evaluate(setHidden, false); await p.waitForTimeout(700);
    m = await measure(p, 900); s = await st(p);
    ck("visible again: the music resumes, audible", !s.paused && s.playing && s.notes > n0 && m.music.peak > MUSIC_AUDIBLE, fmt({ s, m }));

    // navigation: to another game by its card, then back
    const fibHref = await p.evaluate(() => { const a = document.querySelector('#games a[data-id="fibonacci"]'); return a ? a.getAttribute("href") : null; });
    if (fibHref) await p.click('#games a[data-id="fibonacci"]'); else await p.goto(url + pathOf("fibonacci"));
    await p.waitForFunction(() => !!window.__meter && !!window.NumbericsAudio, null, { timeout: 5000 });
    await p.waitForTimeout(200);
    const fresh = await p.evaluate(() => ({ ctx: window.__meter.ctxs, stub: window.NumbericsMusic.stub === true }));
    await p.keyboard.press("ArrowLeft"); await musicUp(p); await p.waitForTimeout(2200);
    m = await measure(p, 900); s = await st(p);
    ck("navigate to Fibonacci by its card: silent until a tap, then one context and its own style (quest), audible",
      fresh.ctx === 0 && fresh.stub && s.style === MAP.fibonacci && m.music.peak > MUSIC_AUDIBLE && await p.evaluate(() => window.__meter.ctxs) === 1 && await taps(p) === "music,out,sfx", fmt({ fresh, s, m }));
    await p.goBack(); await p.waitForFunction(() => !!window.NumbericsAudio, null, { timeout: 5000 }); await p.waitForTimeout(300);
    await p.keyboard.press("ArrowDown"); await musicUp(p); await p.waitForTimeout(2200);
    m = await measure(p, 900); s = await st(p);
    const after = await p.evaluate(() => ({ ctxs: window.__meter.ctxs, taps: window.__meter.taps.map(t => t.kind).sort().join(","), live: window.NumbericsMusic.state().live }));
    ck("back to Two: plays Chill again, audible, not doubled (one context, one music bus)", s.style === MAP.two && s.playing && m.music.peak > MUSIC_AUDIBLE && after.ctxs === 1 && after.taps === "music,out,sfx", fmt({ s, m, after }));
    const e = await errors(); ck("in depth: no errors or rejections", !e.length, e.join(" | "));
    await c.close();
  }

  // ---- 3. the edges ----
  // a first key that is Escape (no activation: Chrome refuses to start audio on it); the next real key must sound
  {
    const { c, p, errors } = await open(url, pathOf("fibonacci"));
    await spy(p); await p.keyboard.press("Escape"); await p.waitForTimeout(300);
    await p.evaluate(() => window.__read());
    await act(p, ["k:ArrowLeft", "k:ArrowDown", "k:ArrowRight", "k:ArrowUp"]);
    const m = await p.evaluate(() => window.__read()), calls = await p.evaluate(() => window.__calls);
    ck("Escape first (no activation), then moves: the moves are audible", m.sfx.peak > AUDIBLE, fmt({ m, calls }));
    ck("Escape first, then moves: the very first move after it is not dropped", calls[0] && !/\(x\)$/.test(calls[0]), JSON.stringify(calls));
    await musicUp(p); await p.waitForTimeout(2300);
    const mm = await measure(p, 900);
    ck("Escape first: the music still starts and is audible", mm.music.peak > MUSIC_AUDIBLE, fmt(mm));
    const e = await errors(); ck("Escape first: no errors or rejections", !e.length, e.join(" | "));
    await c.close();
  }
  // the top-bar mute as the very first tap (it is also the gesture that loads music.js): silent, then unmute plays both
  {
    const { c, p, errors } = await open(url, pathOf("two"));
    await p.click("#topbar .tb-mute"); await p.waitForTimeout(1200);
    const m0 = await measure(p, 500), s0 = await p.evaluate(() => window.NumbericsMusic.state && window.NumbericsMusic.state());
    await p.evaluate(() => window.__read()); await p.click("#topbar .tb-mute"); await p.waitForTimeout(150);
    const tick = await p.evaluate(() => window.__read());
    await musicUp(p); await p.waitForTimeout(2300);
    const m1 = await measure(p, 900), s1 = await st(p);
    ck("mute as the first tap: silent, music not playing; unmute ticks and starts the music, audible",
      m0.sfx.peak < SILENT && m0.music.peak < SILENT && (!s0 || !s0.playing) && tick.sfx.peak > AUDIBLE && s1.playing && m1.music.peak > MUSIC_AUDIBLE, fmt({ m0, s0, tick, m1, s1 }));
    const e = await errors(); ck("mute as the first tap: no errors or rejections", !e.length, e.join(" | "));
    await c.close();
  }
  // the games page at the root (O-9: no game of its own): a tap there loads the music as MUSIC.md says (no
  // #games[data-current]: Two's style), one context, no errors
  {
    const { c, p, reqs, errors } = await open(url, "");
    await p.mouse.click(5, 300); const up = await musicUp(p); await p.waitForTimeout(2200);
    const m = await measure(p, 900), s = up ? await st(p) : null;
    ck("games page: a tap starts the music (Chill, MUSIC.md Loading), audible, one context", up && reqs.length === 1 && s.style === MAP.two && m.music.peak > MUSIC_AUDIBLE && await p.evaluate(() => window.__meter.ctxs) === 1, fmt({ s, m }));
    const e = await errors(); ck("games page: no errors or rejections", !e.length, e.join(" | "));
    await c.close();
  }
  // storage that throws on every access: the how-to opens (no saved progress), its button is a real tap
  {
    const { c, p, errors } = await open(url, pathOf("four"), { throwing: true });
    await p.waitForTimeout(300);
    const how = p.locator("#sh-howto [data-play], #sh-howto .btn.primary");
    if (await how.count()) await how.first().click(); else await p.mouse.click(5, 400);
    await p.waitForTimeout(250); await p.evaluate(() => window.__read());
    await act(p, ACT.four); await p.waitForTimeout(200);
    const m = await p.evaluate(() => window.__read());
    const up = await musicUp(p); await p.waitForTimeout(2200);
    const mm = await measure(p, 900), s = up ? await st(p) : null;
    ck("storage throws: a drop is audible and the music plays its style (pulse)", m.sfx.peak > AUDIBLE && up && s.style === MAP.four && mm.music.peak > MUSIC_AUDIBLE, fmt({ m, mm, s }));
    const e = await errors(); ck("storage throws: no errors or rejections", !e.length, e.join(" | "));
    await c.close();
  }
  // the beta path: /numberics/beta/ on the same origin as the stable site (as on GitHub Pages)
  {
    const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml" };
    const srv = http.createServer((q, r) => {
      const mm = /^\/numberics(?:\/beta)?(\/.*)$/.exec(decodeURIComponent(q.url.split("?")[0]));
      let f = mm ? path.join(ROOT, mm[1]) : "";
      if (f && fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, "index.html");
      if (!f || !f.startsWith(ROOT) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); }
      r.writeHead(200, { "content-type": types[path.extname(f)] || "application/octet-stream" }); r.end(fs.readFileSync(f));
    });
    await new Promise(r => srv.listen(0, "127.0.0.1", r));
    try {
      const beta = "http://127.0.0.1:" + srv.address().port + "/numberics/beta/";
      const { c, p, reqs, errors } = await open(beta, pathOf("sudoku"));
      await p.evaluate(s => { try { localStorage.setItem("numberics_progress_v1", s); } catch (e) { /* none */ } }, HOWTO);
      await p.reload(); await p.waitForTimeout(250); reqs.length = 0;
      await p.evaluate(() => window.__read());
      await act(p, ACT.sudoku); await p.waitForTimeout(200);
      const m = await p.evaluate(() => window.__read());
      const up = await musicUp(p); await p.waitForTimeout(2200);
      const mm = await measure(p, 900), s = up ? await st(p) : null;
      ck("beta path: a placed digit is audible; music.js comes from /numberics/beta/ and Drift plays",
        m.sfx.peak > AUDIBLE && up && reqs.length === 1 && /\/numberics\/beta\/shared\/music\.js$/.test(reqs[0]) && s.style === MAP.sudoku && mm.music.peak > MUSIC_AUDIBLE, fmt({ m, mm, s, reqs }));
      const e = await errors(); ck("beta path: no errors or rejections", !e.length, e.join(" | "));
      await c.close();
    } finally { srv.close(); }
  }

  // ---- 4. every style offline: audible, peak <= -1 dBFS (0.891), no clipped sample; optional loop-seam check ----
  {
    const c = await browser.newContext(), p = await c.newPage(), errs = []; p.on("pageerror", e => errs.push(e.message));
    await p.goto(url + "tests/fixtures/music.html");
    const R = await p.evaluate(async () => {
      const M = window.NumbericsMusic, ids = M.styles().map(x => x.id);
      return Promise.all(ids.map(async id => {
        const b = await M.render(id, { seconds: 8, rate: 22050 }); let pk = 0, clip = 0, sq = 0, n = 0;
        for (let ch = 0; ch < b.numberOfChannels; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < d.length; i++) { const a = Math.abs(d[i]); if (a > pk) pk = a; if (a >= 1 || a !== a) clip++; sq += a * a; n++; } }
        return { id, peak: pk, clip, rms: Math.sqrt(sq / n) };
      }));
    });
    for (const r of R) ck("render " + r.id + " (8 s): audible, peak <= -1 dBFS, no clipped sample", r.rms > 0.01 && r.peak <= 0.891 && r.clip === 0, fmt(r));
    if (process.env.SOUND_SEAM) {
      // the module's own exports (cycleSeconds): load it once more with a CommonJS-style `module` in scope
      await p.evaluate(() => { window.module = { exports: {} }; }); await p.addScriptTag({ url: url + "shared/music.js" });
      const Z = await p.evaluate(async ids => Promise.all(ids.map(async id => { // in parallel: about a minute in all
        const M = window.NumbericsMusic, X = window.module.exports, sr = 22050, pass = X.cycleSeconds(X.STYLES[id]);
        const b = await M.render(id, { seconds: pass + 4, rate: sr }), d = b.getChannelData(0);
        // the seam: the player starts at 0.02 s; 50 ms RMS windows from 2 s before it to 2 s after
        const at = 0.02 + pass, w = Math.round(0.05 * sr), rms = [];
        for (let k = 0; k < 80; k++) { let q = 0; const i0 = Math.round((at - 2 + k * 0.05) * sr); for (let i = i0; i < i0 + w; i++) q += d[i] * d[i]; rms.push(Math.sqrt(q / w)); }
        let jump = 0, base = 0; const i0 = Math.round((at - 2) * sr), i1 = Math.round((at + 2) * sr), s0 = Math.round(at * sr);
        for (let i = i0 + 1; i < i1; i++) { const j = Math.abs(d[i] - d[i - 1]); if (Math.abs(i - s0) < sr * 0.05) jump = Math.max(jump, j); else base = Math.max(base, j); }
        const med = rms.slice().sort((x, y) => x - y)[40];
        // rms[40] is the 50 ms that starts at the seam: the next pass must start on time (the last bar before it may be a
        // quiet fill, as in Pocket and Blocks: that is the writing, not a gap)
        return { id, start: rms[40], next: rms[41], med, jump, base };
      })), R.map(r => r.id)).catch(e => [{ id: "all", err: String(e) }]);
      for (const z of Z) ck("seam " + z.id + ": the next pass starts on time (no gap) and no click (no sample step above the music's own)",
        !z.err && z.start > 0.25 * z.med && z.next > 0.25 * z.med && z.jump <= z.base * 1.05, fmt(z));
    }
    ck("offline renders: no page errors", !errs.length, errs.join(" | "));
    await c.close();
  }
};
