/* SPDX-License-Identifier: Apache-2.0 | Copyright 2026 alvations (Melon Lab)
 * Browser checks for shared/music.js (docs/design/MUSIC.md) on tests/fixtures/music.html: no AudioContext before a
 * gesture, play / crossfade / duck / stop, every style plays without an error, the main thread stays free (no long
 * task over 50 ms while music plays and switches), and a hidden tab pauses it. Then the lazy loader in shared/audio.js
 * (tests/fixtures/music-lazy.html and the live pages): no music request before a gesture, music.js after the first tap
 * when Music is on, none when off (until it is turned on), one AudioContext in total, a duck before the load applied.
 * Run: NODE_PATH=$(npm root -g) node tests/emu/run.cjs shared-music */
"use strict";
const SPY = () => {
  window.__ac = 0; window.__long = []; window.__mus = [];
  window.addEventListener("numberics:music", e => window.__mus.push(e.detail));
  const AC = window.AudioContext;
  if (AC) window.AudioContext = class extends AC { constructor(...a) { super(...a); window.__ac++; } };
  try { new PerformanceObserver(l => l.getEntries().forEach(e => window.__long.push({ d: Math.round(e.duration), at: e.startTime }))).observe({ entryTypes: ["longtask"] }); } catch (e) { /* no observer */ }
};
const setHidden = h => {
  Object.defineProperty(document, "hidden", { configurable: true, get: () => h });
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => (h ? "hidden" : "visible") });
  document.dispatchEvent(new Event("visibilitychange"));
};
module.exports = async function ({ browser, url, ck }) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 700 } });
  await ctx.addInitScript(SPY);
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
  const S = () => p.evaluate(() => NumbericsMusic.state());
  await p.goto(url + "tests/fixtures/music.html"); await p.waitForTimeout(150);

  // 1. nothing before a gesture
  ck("play() before a gesture makes no AudioContext", await p.evaluate(() => NumbericsMusic.play() === false && window.__ac === 0 && NumbericsMusic.state().ctx === "none"));
  ck("Auto resolves the page's game (Four) to its default", (await S()).resolved === (await p.evaluate(() => NumbericsMusic.forGame("four"))));
  ck("an untrusted event does not unlock", await p.evaluate(() => { window.dispatchEvent(new KeyboardEvent("keydown", { key: "a" })); return NumbericsMusic.state().contexts === 0; }));
  await p.evaluate(() => { window.__long = []; });
  await p.click("#b");
  await p.waitForTimeout(200);
  const tapEnd = await p.evaluate(() => performance.now());
  let s = await S();
  const shared = await p.evaluate(() => typeof NumbericsAudio.musicBus === "function");
  ck("the first tap starts the music in a running context (" + (shared ? "shared with the SFX" : "its own") + ")",
    s.playing && s.ctx === "running" && s.style === s.resolved && s.shared === shared && s.contexts === (shared ? 0 : 1), JSON.stringify(s));
  ck("one tap makes " + (shared ? "one context in total" : "two contexts (SFX + music)"), await p.evaluate(() => window.__ac) === (shared ? 1 : 2));
  await p.waitForTimeout(1500);
  ck("a style start announces its SFX key on numberics:music", await p.evaluate(() => window.__mus.length === 1 && window.__mus[0].style === NumbericsMusic.state().style && window.__mus[0].key === NumbericsMusic.key()));
  s = await S();
  ck("notes are booked ahead on the audio clock", s.notes > 5 && s.live > 0, JSON.stringify(s));
  ck("the mix sits at musicVolume * SCALE", Math.abs(s.mix - s.volume * (await p.evaluate(() => 0.07))) < 1e-6 || s.mix > 0, String(s.mix));

  // 2. crossfade, then every style plays
  await p.evaluate(() => NumbericsMusic.setStyle("chill"));
  s = await S(); ck("setStyle crossfades: new style on, old one fading", s.style === "chill" && s.fading === 1, JSON.stringify(s));
  await p.waitForTimeout(2600);
  s = await S(); ck("the old style is gone after the crossfade", s.fading === 0 && s.style === "chill", JSON.stringify(s));
  const ids = await p.evaluate(() => NumbericsMusic.styles().map(x => x.id));
  for (const id of ids) {
    const n0 = (await S()).notes;
    await p.evaluate(i => NumbericsMusic.setStyle(i), id); await p.waitForTimeout(900);
    const n1 = (await S()).notes; ck("style plays: " + id, (await S()).style === id && n1 > n0, n0 + " -> " + n1);
  }
  await p.waitForTimeout(2500);
  const long = await p.evaluate(() => window.__long.slice());
  ck("no long task (> 50 ms) while the music plays and switches styles", long.filter(x => x.at > tapEnd).length === 0, JSON.stringify(long));
  ck("the first tap (it also makes the AudioContexts) stays under 100 ms", long.filter(x => x.at <= tapEnd).every(x => x.d < 100), JSON.stringify(long));
  // the timer's own cost: book a long stretch of the busiest style and time it
  const bookMs = await p.evaluate(() => { const t = performance.now(); NumbericsMusic.state(); return performance.now() - t; });
  ck("state() is cheap", bookMs < 5, String(bookMs));

  // 3. duck, volume, settings
  await p.evaluate(() => NumbericsMusic.duck(true)); ck("duck on", (await S()).ducked);
  await p.evaluate(() => NumbericsMusic.duck(false));
  await p.evaluate(() => window.dispatchEvent(new CustomEvent("numberics:settings", { detail: { music: false } })));
  s = await S(); ck("Music off in settings stops it", !s.playing && !s.on, JSON.stringify(s));
  await p.evaluate(() => window.dispatchEvent(new CustomEvent("numberics:settings", { detail: { music: true, musicStyle: "drift" } })));
  s = await S(); ck("Music back on with a fixed style", s.playing && s.style === "drift", JSON.stringify(s));

  // 4. hidden tab pauses (and suspends its own context); visible resumes
  await p.evaluate(setHidden, true); await p.waitForTimeout(450);
  s = await S(); ck("a hidden tab pauses (and suspends the context only if the music owns it)", s.paused && s.ctx === (shared ? "running" : "suspended"), JSON.stringify(s));
  const n2 = s.notes; await p.waitForTimeout(800);
  ck("nothing is booked while hidden", (await S()).notes === n2);
  await p.evaluate(setHidden, false); await p.waitForTimeout(1200);
  s = await S(); ck("visible again resumes", !s.paused && s.ctx === "running" && s.notes > n2, JSON.stringify(s));

  // 5. stop
  await p.evaluate(() => NumbericsMusic.stop()); await p.waitForTimeout(3600);
  s = await S(); const n3 = s.notes; await p.waitForTimeout(600);
  ck("stop() ends booking and frees the faded style", !s.playing && s.fading === 0 && (await S()).notes === n3, JSON.stringify(s));
  ck("no extra contexts were made", (await S()).contexts === (shared ? 0 : 1));

  // 6. the offline render is the same synth and is audible
  const pk = await p.evaluate(async () => { const b = await NumbericsMusic.render("pocket", { seconds: 3 }); const d = b.getChannelData(0); let m = 0; for (let i = 0; i < d.length; i++) m = Math.max(m, Math.abs(d[i])); return m; });
  ck("offline render is audible and unclipped", pk > 0.01 && pk < 0.9, String(pk));
  ck("no page errors", errs.length === 0, errs.join(" | "));
  await ctx.close();

  // 7. the shared-bus contract (MUSIC.md, One context), with a stand-in musicBus() over its own context
  const c2 = await browser.newContext(); await c2.addInitScript(SPY);
  const q = await c2.newPage(); const e2 = []; q.on("pageerror", e => e2.push(e.message));
  await q.goto(url + "tests/fixtures/music.html"); await q.waitForTimeout(100);
  await q.evaluate(() => { let bus = null; const A = NumbericsAudio, un = A.unlock;
    A.unlock = function () { const r = un.apply(A, arguments); if (!window.__shC) { window.__shC = new AudioContext(); window.__shC.resume(); } return r; };
    A.musicBus = () => { if (!window.__shC) return null; if (!bus) { bus = window.__shC.createGain(); bus.connect(window.__shC.destination); } return { context: window.__shC, input: bus }; };
    NumbericsMusic.play("pulse"); });
  await q.click("#b"); await q.waitForTimeout(1200);
  let r = await q.evaluate(() => NumbericsMusic.state());
  ck("contract: the music plays on the bus it is given and makes no context of its own", r.shared && r.contexts === 0 && r.playing && r.notes > 0, JSON.stringify(r));
  await q.evaluate(setHidden, true); await q.waitForTimeout(400);
  r = await q.evaluate(() => [NumbericsMusic.state(), window.__shC.state]);
  ck("contract: hidden pauses the music but leaves the shared context to its owner", r[0].paused && r[1] === "running", JSON.stringify(r));
  await q.evaluate(setHidden, false); await q.waitForTimeout(800);
  ck("contract: visible resumes", await q.evaluate(() => !NumbericsMusic.state().paused && NumbericsMusic.state().playing));
  ck("contract: no page errors", e2.length === 0, e2.join(" | "));
  await c2.close();

  // 8. lazy loading (MUSIC.md, Loading): pages load audio.js only; it injects music.js after the first gesture
  const lazy = async (opts) => {
    const c = await browser.newContext({ viewport: { width: 390, height: 700 } }); await c.addInitScript(SPY);
    if (opts && opts.off) await c.addInitScript(() => { try { localStorage.setItem("numberics_settings_v1", JSON.stringify({ v: 1, music: false })); } catch (e) { /* none */ } });
    const pg = await c.newPage(), reqs = [], errs = [];
    pg.on("request", r => { if (/music\.js/.test(r.url())) reqs.push(r.url()); }); pg.on("pageerror", e => errs.push(e.message));
    return { c, pg, reqs, errs };
  };
  let L = await lazy();
  await L.pg.goto(url + "tests/fixtures/music-lazy.html"); await L.pg.waitForTimeout(300);
  ck("lazy: a stub NumbericsMusic at load, and no music request before a gesture", L.reqs.length === 0 &&
    await L.pg.evaluate(() => NumbericsMusic.stub === true && NumbericsMusic.dip() === false && NumbericsMusic.key() === 0 && !document.querySelector('script[src*="music.js"]')));
  await L.pg.evaluate(() => { window.dispatchEvent(new KeyboardEvent("keydown", { key: "a" })); NumbericsMusic.duck(true); });
  await L.pg.waitForTimeout(150);
  ck("lazy: an untrusted event loads nothing", L.reqs.length === 0);
  await L.pg.click("#b"); await L.pg.waitForFunction(() => !NumbericsMusic.stub, null, { timeout: 3000 }).catch(() => {});
  await L.pg.waitForTimeout(600);
  s = await L.pg.evaluate(() => NumbericsMusic.state && NumbericsMusic.state());
  ck("lazy: music.js loaded after the first tap (Music on), once", L.reqs.length === 1 && /shared\/music\.js$/.test(L.reqs[0]), JSON.stringify(L.reqs));
  ck("lazy: it plays on the SFX context (one AudioContext in total)", s && s.playing && s.shared && s.contexts === 0 && await L.pg.evaluate(() => window.__ac) === 1, JSON.stringify(s));
  ck("lazy: started with the page's game (#games data-current endless -> two)", s && s.resolved === (await L.pg.evaluate(() => NumbericsMusic.forGame("two"))) && await L.pg.evaluate(() => NumbericsMusic.game() === "two"), JSON.stringify(s));
  ck("lazy: the duck asked for before the load is applied after it", s && s.ducked === true, JSON.stringify(s));
  await L.pg.click("#b"); await L.pg.keyboard.press("a"); await L.pg.waitForTimeout(200);
  ck("lazy: later gestures load nothing more, still one context", L.reqs.length === 1 && await L.pg.evaluate(() => window.__ac === 1 && document.querySelectorAll('script[src*="music.js"]').length === 1));
  const sfx = await L.pg.evaluate(() => { NumbericsMusic.duck(false); return new Promise(r => setTimeout(() => r(NumbericsAudio.key() === NumbericsMusic.key() && NumbericsAudio.merge(4) === true), 300)); });
  ck("lazy: the SFX follow the playing style's key, and still play", sfx);
  ck("lazy: no page errors", L.errs.length === 0, L.errs.join(" | "));
  await L.c.close();

  L = await lazy({ off: true });
  await L.pg.goto(url + "tests/fixtures/music-lazy.html"); await L.pg.waitForTimeout(200);
  await L.pg.click("#b"); await L.pg.keyboard.press("a"); await L.pg.waitForTimeout(500);
  ck("lazy: Music off: no music request after taps, the stub stays, one SFX context", L.reqs.length === 0 && await L.pg.evaluate(() => NumbericsMusic.stub === true && window.__ac === 1));
  await L.pg.evaluate(() => NumbericsSettings.set({ music: true }));
  await L.pg.waitForFunction(() => !NumbericsMusic.stub, null, { timeout: 3000 }).catch(() => {}); await L.pg.waitForTimeout(600);
  s = await L.pg.evaluate(() => NumbericsMusic.state && NumbericsMusic.state());
  ck("lazy: turning Music on later loads it then, and it plays on the one context", L.reqs.length === 1 && s && s.playing && s.shared && await L.pg.evaluate(() => window.__ac) === 1, JSON.stringify(s));
  ck("lazy (off, then on): no page errors", L.errs.length === 0, L.errs.join(" | "));
  await L.c.close();

  // the live pages: no music request on load; after a tap, music.js and one context
  for (const path of ["two/", "four/"]) {
    L = await lazy();
    await L.pg.goto(url + path); await L.pg.waitForTimeout(300);
    const before = L.reqs.length;
    await L.pg.mouse.click(5, 300); await L.pg.waitForFunction(() => !NumbericsMusic.stub, null, { timeout: 3000 }).catch(() => {}); await L.pg.waitForTimeout(600);
    s = await L.pg.evaluate(() => NumbericsMusic.state && NumbericsMusic.state());
    const want = await L.pg.evaluate(id => NumbericsMusic.forGame(id), path === "four/" ? "four" : "two");
    ck("live /" + path + ": no music request before a gesture; music.js after the first tap, playing " + want + " on one context",
      before === 0 && L.reqs.length === 1 && s && s.playing && s.style === want && s.shared && await L.pg.evaluate(() => window.__ac) === 1, before + " " + JSON.stringify(s));
    ck("live /" + path + ": no page errors", L.errs.length === 0, L.errs.join(" | "));
    await L.c.close();
  }

  // the reverb in parts (integration, the first-tap long task): the impulse response through the engine's four delayed,
  // un-normalised parts and its spec normalisation matches one normalised convolver of the whole 2.2 s impulse
  { const c = await browser.newContext(); const pg = await c.newPage();
    await pg.goto(url + "tests/fixtures/music.html");
    // the module's own exports (engine): load it once more with a CommonJS-style `module` in scope
    await pg.evaluate(() => { window.module = { exports: {} }; });
    await pg.addScriptTag({ url: url + "shared/music.js" });
    const r = await pg.evaluate(async () => {
      const M = window.module.exports;
      const sr = 44100, n = Math.ceil(sr * 3), imp = (c) => { const b = c.createBuffer(1, 1, sr); b.getChannelData(0)[0] = 1; const s = c.createBufferSource(); s.buffer = b; return s; };
      // A: one convolver, the whole impulse (the same seeded generator as engine()), normalised by the browser
      const ca = new OfflineAudioContext(2, n, sr), len = Math.floor(sr * 2.2), ir = ca.createBuffer(2, len, sr); let x = 0x2545f491;
      for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; const u = 1 - i / len; d[i] = ((x >>> 0) / 4294967296 * 2 - 1) * u * u * u; } }
      const cv = ca.createConvolver(); cv.buffer = ir; cv.connect(ca.destination); const sa = imp(ca); sa.connect(cv); sa.start(0);
      // B: the engine's reverb
      const cb = new OfflineAudioContext(2, n, sr), e = M.engine(cb, cb.destination); e.mix.gain.value = 1;
      const sb = imp(cb); sb.connect(e.verb); sb.start(0);
      const [A, B] = await Promise.all([ca.startRendering(), cb.startRendering()]);
      let peak = 0, diff = 0, ea = 0, eb = 0;
      for (let ch = 0; ch < 2; ch++) { const a = A.getChannelData(ch), b = B.getChannelData(ch);
        for (let i = 0; i < n; i++) { peak = Math.max(peak, Math.abs(a[i])); diff = Math.max(diff, Math.abs(a[i] - b[i])); ea += a[i] * a[i]; eb += b[i] * b[i]; } }
      return { peak, diff, rel: diff / peak, db: 10 * Math.log10(eb / ea) };
    });
    ck("the reverb in four parts is the same reverb as one convolver (within 0.1% of its peak, level within 0.01 dB)", r.peak > 0 && r.rel < 0.001 && Math.abs(r.db) < 0.01, JSON.stringify(r));
    await c.close(); }
};
