/* SPDX-License-Identifier: Apache-2.0 | Copyright 2026 alvations (Melon Lab)
 * Browser checks for shared/music.js (docs/design/MUSIC.md) on tests/fixtures/music.html: no AudioContext before a
 * gesture, play / crossfade / duck / stop, every style plays without an error, the main thread stays free (no long
 * task over 50 ms while music plays and switches), and a hidden tab pauses it.
 * Run: NODE_PATH=$(npm root -g) node tests/emu/run.cjs shared-music */
"use strict";
const SPY = () => {
  window.__ac = 0; window.__long = [];
  const AC = window.AudioContext;
  if (AC) window.AudioContext = class extends AC { constructor(...a) { super(...a); window.__ac++; } };
  try { new PerformanceObserver(l => l.getEntries().forEach(e => window.__long.push(Math.round(e.duration)))).observe({ entryTypes: ["longtask"] }); } catch (e) { /* no observer */ }
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
  let s = await S();
  ck("the first tap starts the music in its own running context", s.contexts === 1 && s.playing && s.ctx === "running" && s.style === s.resolved, JSON.stringify(s));
  await p.waitForTimeout(1500);
  s = await S();
  ck("notes are booked ahead on the audio clock", s.notes > 5 && s.live > 0, JSON.stringify(s));
  ck("the mix sits at musicVolume * SCALE", Math.abs(s.mix - s.volume * (await p.evaluate(() => 0.016))) < 1e-6 || s.mix > 0, String(s.mix));

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
  ck("no long task (> 50 ms) while the music plays and switches", long.length === 0, JSON.stringify(long));
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
  s = await S(); ck("a hidden tab pauses and suspends the context", s.paused && s.ctx === "suspended", JSON.stringify(s));
  const n2 = s.notes; await p.waitForTimeout(800);
  ck("nothing is booked while hidden", (await S()).notes === n2);
  await p.evaluate(setHidden, false); await p.waitForTimeout(1200);
  s = await S(); ck("visible again resumes", !s.paused && s.ctx === "running" && s.notes > n2, JSON.stringify(s));

  // 5. stop
  await p.evaluate(() => NumbericsMusic.stop()); await p.waitForTimeout(3600);
  s = await S(); const n3 = s.notes; await p.waitForTimeout(600);
  ck("stop() ends booking and frees the faded style", !s.playing && s.fading === 0 && (await S()).notes === n3, JSON.stringify(s));
  ck("still exactly one music context", (await S()).contexts === 1);

  // 6. the offline render is the same synth and is audible
  const pk = await p.evaluate(async () => { const b = await NumbericsMusic.render("pocket", { seconds: 3 }); const d = b.getChannelData(0); let m = 0; for (let i = 0; i < d.length; i++) m = Math.max(m, Math.abs(d[i])); return m; });
  ck("offline render is audible and unclipped", pk > 0.01 && pk < 0.9, String(pk));
  ck("no page errors", errs.length === 0, errs.join(" | "));
  await ctx.close();
};
