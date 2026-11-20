/* SPDX-License-Identifier: Apache-2.0 | Copyright 2026 alvations (Melon Lab)
 * Browser checks for shared/audio.js (REDESIGN.md 7, 11 B3) on tests/fixtures/audio.html and the live pages.
 * Run: NODE_PATH=$(npm root -g) node tests/emu/run.cjs shared-audio */
"use strict";
// counts every AudioContext the page constructs and records vibrate calls, before any page script runs
const SPY = () => {
  window.__ac = 0; window.__vib = [];
  const AC = window.AudioContext;
  if (AC) window.AudioContext = class extends AC { constructor(...a) { super(...a); window.__ac++; } };
  try { Object.defineProperty(navigator, "vibrate", { configurable: true, value: p => { window.__vib.push(p); return true; } }); } catch (e) { /* read-only */ }
};
const BARE = () => {
  ["AudioContext", "webkitAudioContext", "OfflineAudioContext", "webkitOfflineAudioContext"].forEach(k => { try { delete window[k]; } catch (e) { /* */ } window[k] = undefined; });
  try { Object.defineProperty(Navigator.prototype, "vibrate", { configurable: true, value: undefined }); } catch (e) { /* */ }
};
module.exports = async function ({ browser, url, ck }) {
  const fixture = url + "tests/fixtures/audio.html";
  const ctx = await browser.newContext({ viewport: { width: 390, height: 700 } });
  await ctx.addInitScript(SPY);
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));

  // 1. no AudioContext before a gesture: on the fixture and on every live page
  const pages = [""].concat(require("../../games.json").filter(g => g.status === "live" && g.path).map(g => g.path));
  for (const path of pages) {
    await p.goto(url + path); await p.waitForTimeout(150);
    ck("no AudioContext on load: /" + path, await p.evaluate(() => window.__ac === 0 && typeof NumbericsAudio.tick === "function"));
  }
  await p.goto(fixture);
  ck("a sound before a gesture is a silent no-op", await p.evaluate(() => NumbericsAudio.tick() === false && NumbericsAudio.merge(5) === false && window.__ac === 0 && NumbericsAudio.stats().state === "none"));
  ck("a synthetic (untrusted) event never creates one", await p.evaluate(() => { window.dispatchEvent(new KeyboardEvent("keydown", { key: "a" })); return window.__ac === 0; }));
  await p.click("#b");
  ck("the first tap creates exactly one context and it runs", await p.evaluate(() => window.__ac === 1 && NumbericsAudio.ready() && NumbericsAudio.stats().state === "running"), await p.evaluate(() => JSON.stringify(NumbericsAudio.stats())));
  await p.keyboard.press("a"); await p.click("#b");
  ck("later gestures never make a second context", await p.evaluate(() => window.__ac === 1));

  // 2. each sound renders through the real graph (compressor included) in an OfflineAudioContext
  const R = await p.evaluate(async () => { const out = {};
    for (const n of NumbericsAudio.NAMES) out[n] = await NumbericsAudio.render(n, n === "merge" ? 14 : n === "pop" ? 9 : 3);
    out.merge0 = await NumbericsAudio.render("merge", 0); out.quiet = await NumbericsAudio.render("win", 0, { volume: 0.5 });
    return out; });
  for (const n of Object.keys(R)) {
    const r = R[n];
    ck("render " + n + ": audible, peak <= 0.5, no clipping", r && r.peak > 0.001 && r.peak <= 0.5 && !r.clipped, JSON.stringify(r));
  }
  ck("half volume renders quieter than full", R.quiet.peak < R.win.peak, R.quiet.peak + " vs " + R.win.peak);

  // 3. live play: voice cap 8, then every voice ends and frees its nodes within about 1 s
  const v = await p.evaluate(() => { const ok = NumbericsAudio.NAMES.map(n => NumbericsAudio[n](2)); return { ok, voices: NumbericsAudio.stats().voices }; });
  ck("all sounds play live after the gesture", v.ok.every(Boolean), JSON.stringify(v.ok));
  ck("voice cap: never more than 8 at once", v.voices === 8, v.voices);
  await p.waitForTimeout(1300);
  ck("voices return to 0 within about 1 s of the last sound", await p.evaluate(() => NumbericsAudio.stats().voices === 0));
  ck("the same sound twice inside 40 ms plays once", await p.evaluate(() => NumbericsAudio.place() === true && NumbericsAudio.place() === false));

  // 4. mute and volume ramp (not a jump) and follow NumbericsSettings; the exact 30 ms ramp calls are in tests/test-audio.js
  const m = await p.evaluate(async () => {
    const A = NumbericsAudio, wait = ms => new Promise(r => setTimeout(r, ms));
    // Chromium only updates AudioParam.value while the node is being pulled, so a long sound plays during each read
    NumbericsSettings.set({ sound: true, volume: 1 }); A.trophy(); await wait(150); const full = A.stats().master;
    NumbericsSettings.set({ sound: false }); const at0 = A.stats().master; await wait(150); const muted = A.stats().master;
    const silent = A.tick() === false;
    await wait(800); NumbericsSettings.set({ sound: true, volume: 0.5 }); A.trophy(); await wait(150); const half = A.stats().master;
    return { full, at0, muted, silent, half };
  });
  ck("volume 100% sets master 0.5", Math.abs(m.full - 0.5) < 0.01, JSON.stringify(m));
  ck("mute ramps: still sounding at the change, 0 after the ramp", m.at0 > 0.4 && m.muted < 0.001 && m.silent, JSON.stringify(m));
  ck("volume 50% sets master 0.25", Math.abs(m.half - 0.25) < 0.01, JSON.stringify(m));

  // 5. buzz: throttled, follows Haptics
  const b = await p.evaluate(async () => {
    const A = NumbericsAudio, wait = ms => new Promise(r => setTimeout(r, ms)); window.__vib = [];
    await wait(60); A.buzz("tap"); A.buzz("merge"); A.buzz("big"); const quick = window.__vib.length;
    await wait(60); A.buzz("win"); const later = JSON.stringify(window.__vib);
    NumbericsSettings.set({ haptics: false }); await wait(60); A.buzz("tap"); const off = window.__vib.length;
    NumbericsSettings.set({ haptics: true }); return { quick, later, off };
  });
  ck("buzz: three calls inside 50 ms vibrate once", b.quick === 1, JSON.stringify(b));
  ck("buzz: win pattern after the throttle", b.later === "[6,[20,40,20]]", b.later);
  ck("buzz: Haptics off never vibrates", b.off === 2, JSON.stringify(b));
  ck("no page errors (fixture)", !errs.length, errs.join(" | "));
  await ctx.close();

  // 6. no Web Audio and no vibrate: every call is safe
  const c2 = await browser.newContext(); await c2.addInitScript(BARE);
  const q = await c2.newPage(); const e2 = []; q.on("pageerror", e => e2.push(e.message));
  await q.goto(fixture); await q.click("#b"); await q.keyboard.press("Enter");
  const bare = await q.evaluate(async () => { const A = NumbericsAudio;
    const s = A.NAMES.map(n => A[n](1)), z = ["tap", "merge", "big", "win", "lose", "bad"].map(k => A.buzz(k));
    NumbericsSettings.set({ sound: false }); NumbericsSettings.set({ sound: true });
    return { s, z, r: await A.render("win"), st: A.stats(), ac: typeof window.AudioContext }; });
  ck("without Web Audio: every sound returns false, render null, no context", bare.s.every(x => x === false) && bare.r === null && bare.st.contexts === 0 && bare.ac === "undefined", JSON.stringify(bare));
  ck("without vibrate: buzz returns false", bare.z.every(x => x === false), JSON.stringify(bare.z));
  ck("no page errors without Web Audio or vibrate", !e2.length, e2.join(" | "));
  await q.goto(url); await q.click("body", { position: { x: 5, y: 5 } }); await q.keyboard.press("ArrowLeft"); await q.waitForTimeout(200);
  ck("the root page plays on without Web Audio or vibrate", !e2.length, e2.join(" | "));
  await c2.close();
};
