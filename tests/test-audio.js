/* SPDX-License-Identifier: Apache-2.0 | Copyright 2026 alvations (Melon Lab)
 * shared/audio.js against a recording mock of Web Audio (REDESIGN.md 6.4, 7, 11 B3). `node tests/test-audio.js`
 * The real rendering checks (OfflineAudioContext peaks, no context before a gesture) are in tests/emu/shared-audio.cjs. */
"use strict";
const A = require("../shared/audio.js");
let pass = 0, fail = 0;
function t(n, f) { try { f(); pass++; } catch (e) { fail++; console.log("FAIL", n, "\n  ", e.message); } }
function ok(c, m) { if (!c) throw new Error(m || "assertion failed"); }
const later = [];
const near = (a, b, e) => Math.abs(a - b) <= (e || 1e-6);

// ---- mock Web Audio: every node and param call is recorded; sources end when the clock passes their stop time ----
function mock() {
  const all = [];
  class Param { constructor(v) { this.value = v; this.calls = []; }
    setValueAtTime(v, t) { this.calls.push(["set", v, t]); this.value = v; }
    linearRampToValueAtTime(v, t) { this.calls.push(["lin", v, t]); }
    exponentialRampToValueAtTime(v, t) { ok(v > 0, "exponential ramp to a positive value"); this.calls.push(["exp", v, t]); }
    cancelScheduledValues(t) { this.calls.push(["cancel", t]); }
    cancelAndHoldAtTime(t) { this.calls.push(["hold", t]); } }
  class Node { constructor(c, kind) { this.ctx = c; this.kind = kind; this.outs = []; this.live = true; all.push(this); }
    connect(n) { this.outs.push(n); return n; } disconnect() { this.outs = []; this.live = false; } }
  class Src extends Node { constructor(c, kind) { super(c, kind); this.t0 = null; this.t1 = Infinity; this.onended = null; c.srcs.push(this); }
    start(t) { this.t0 = t; } stop(t) { this.t1 = Math.min(this.t1, t); } }
  class Ctx { constructor() { this.state = "suspended"; this.currentTime = 0; this.sampleRate = 44100; this.srcs = []; this.resumes = 0;
      this.destination = new Node(this, "dest"); Ctx.made.push(this); }
    resume() { this.resumes++; this.state = "running"; return Promise.resolve(); }
    createGain() { const n = new Node(this, "gain"); n.gain = new Param(1); return n; }
    createOscillator() { const n = new Src(this, "osc"); n.type = "sine"; n.frequency = new Param(440); n.detune = new Param(0); return n; }
    createBufferSource() { const n = new Src(this, "buf"); n.buffer = null; return n; }
    createBiquadFilter() { const n = new Node(this, "filter"); n.type = "lowpass"; n.frequency = new Param(350); n.Q = new Param(1); return n; }
    createDynamicsCompressor() { const n = new Node(this, "comp"); ["threshold", "knee", "ratio", "attack", "release"].forEach(k => n[k] = new Param(0)); return n; }
    createBuffer(ch, len) { const d = new Float32Array(len); return { length: len, getChannelData: () => d }; }
    advance(dt) { this.currentTime += dt; this.srcs.forEach(s => { if (s.t1 <= this.currentTime && s.onended) { const f = s.onended; s.onended = null; f(); } }); } }
  Ctx.made = [];
  return { Ctx, all };
}
// a window-like object: listeners, a clock, optional settings / navigator / document
function win(o) {
  o = o || {};
  const L = {}, m = mock(), clock = { ms: 1000 };
  const w = { addEventListener(n, f) { (L[n] = L[n] || []).push(f); },
    fire(n, detail) { (L[n] || []).forEach(f => f({ type: n, detail })); },
    document: o.document || { hidden: false, visibilityState: "visible" } };
  if (!o.noAudio) w.AudioContext = m.Ctx;
  if (o.settings !== undefined) w.NumbericsSettings = o.settings;
  if (o.navigator !== undefined) w.navigator = o.navigator;
  const api = A.make(w, { now: () => clock.ms });
  return { w, api, m, clock, L, ctx: () => m.Ctx.made[0] };
}
const settingsOf = s => ({ get: () => Object.assign({}, s) });

t("note(): the pentatonic ladder from C4, capped at k = 14", () => {
  ok(near(A.note(0), 261.63, 1e-9), "C4"); ok(near(A.note(5), 523.26, 0.01), "C5"); ok(near(A.note(13), 1568, 1) && near(A.note(14), 1760, 1), "G6 at 13, A6 at 14 (the spec formula; its \"about 1568 Hz\" is k = 13)");
  ok(A.note(20) === A.note(14) && A.note(-3) === A.note(0) && A.note("x") === A.note(0), "clamped");
  const semis = [0, 1, 2, 3, 4].map(k => Math.round(12 * Math.log2(A.note(k) / A.note(0))));
  ok(JSON.stringify(semis) === "[0,2,4,7,9]", semis);
  for (let k = 1; k <= 14; k++) ok(A.note(k) > A.note(k - 1), "rising at " + k);
});
t("the API has every named sound from the spec, plus buzz", () => {
  const { api } = win();
  "tick slide merge land pop burst pip place best power trophy win lose bad buzz unlock render ready stats".split(" ")
    .forEach(n => ok(typeof api[n] === "function", n));
  ok(A.NAMES.length === 14);
});
t("no AudioContext exists until a gesture; sounds before it are silent no-ops", () => {
  const { api, m, L } = win();
  ok(m.Ctx.made.length === 0, "none on load");
  A.NAMES.forEach(n => ok(api[n](3) === false, n));
  ok(m.Ctx.made.length === 0 && !api.ready(), "a sound call never creates one");
  ["pointerdown", "keydown", "touchend", "click"].forEach(n => ok((L[n] || []).length === 1, n + " listener"));
});
t("the first gesture creates and resumes the context synchronously, once; it plays a silent unlock sample", () => {
  const { w, api, m, ctx } = win();
  w.fire("pointerdown");
  ok(m.Ctx.made.length === 1 && ctx().state === "running" && api.ready(), "running inside the handler");
  ok(ctx().srcs.some(s => s.kind === "buf" && s.buffer && s.buffer.length === 1 && s.t0 === 0), "1-sample unlock");
  w.fire("keydown"); w.fire("click");
  ok(m.Ctx.made.length === 1, "never a second context");
  ctx().state = "suspended"; w.fire("touchend");
  ok(ctx().state === "running" && m.Ctx.made.length === 1, "a later gesture resumes an interrupted context");
});
t("graph: master = volume * 0.5 into the compressor (-18 dB, 4:1, 3 ms, 120 ms) into the destination", () => {
  const { w, m } = win({ settings: settingsOf({ sound: true, volume: 0.5 }) });
  w.fire("pointerdown");
  const comp = m.all.find(n => n.kind === "comp"), master = m.all.find(n => n.kind === "gain" && n.outs[0] === comp);
  ok(comp && master, "master -> compressor");
  ok(comp.outs[0] === m.Ctx.made[0].destination, "compressor -> destination");
  ok(comp.threshold.value === -18 && comp.ratio.value === 4 && comp.attack.value === 0.003 && comp.release.value === 0.12, "compressor");
  ok(master.gain.value === 0.25, "master " + master.gain.value);
});
t("every sound plays after the gesture, each with attack-decay envelopes peaking at or under its table gain", () => {
  const PEAK = { tick: .05, slide: .04, merge: .08, land: .10, pop: .08, burst: .09, pip: .035, place: .05, best: .07, power: .05, trophy: .07, win: .08, lose: .05, bad: .04 };
  A.NAMES.forEach(n => {
    const { w, api, m } = win(); w.fire("pointerdown");
    const before = m.all.length;
    ok(api[n](2) === true, n + " plays");
    const made = m.all.slice(before), envs = made.filter(x => x.kind === "gain" && x.gain.calls.length >= 3 && x.gain.calls[0][0] === "set" && x.gain.calls[0][1] === 0);
    ok(envs.length >= 1, n + " has an envelope");
    envs.forEach(g => {
      const c = g.gain.calls; ok(c[1][0] === "lin" && c[2][0] === "exp" && near(c[2][1], 0.0001), n + " shape " + JSON.stringify(c));
      ok(c[1][1] <= PEAK[n] + 1e-9, n + " peak " + c[1][1]);
    });
    ok(Math.max(...envs.map(g => g.gain.calls[1][1])) >= PEAK[n] * 0.99, n + " reaches its table peak");
    made.filter(x => x.kind === "osc" || x.kind === "buf").forEach(s => ok(s.t0 != null && isFinite(s.t1), n + " source started and stopped"));
  });
});
t("merge pitch rises with the level; pop(w) is merge(4 + w); land falls 140 -> 90 Hz", () => {
  const freqOf = (n, k) => { const { w, api, m } = win(); w.fire("pointerdown"); const b = m.all.length; api[n](k);
    return m.all.slice(b).filter(x => x.kind === "osc" && x.type === "triangle")[0].frequency.calls[0][1]; };
  for (let k = 1; k <= 14; k++) ok(freqOf("merge", k) > freqOf("merge", k - 1), "merge " + k);
  ok(near(freqOf("pop", 1), A.note(5)) && near(freqOf("pop", 3), A.note(7)), "pop");
  const { w, api, m } = win(); w.fire("pointerdown"); const b = m.all.length; api.land();
  const o = m.all.slice(b).find(x => x.kind === "osc"); ok(o.frequency.calls[0][1] === 140 && o.frequency.calls.some(c => c[0] === "exp" && c[1] === 90), "land");
});
t("the same sound plays at most once per 40 ms; different sounds are not held back", () => {
  const { w, api, clock } = win(); w.fire("pointerdown");
  ok(api.tick() && !api.tick(), "second tick refused"); ok(api.place(), "another sound plays");
  clock.ms += 39; ok(!api.tick(), "39 ms"); clock.ms += 1; ok(api.tick(), "40 ms");
});
t("voice cap: at most 8 voices; the oldest is cut with a short fade and its sources stopped", () => {
  const { w, api, ctx, m } = win(); w.fire("pointerdown");
  const b = m.all.length;
  A.NAMES.forEach(n => ok(api[n](1), n));
  ok(api.stats().voices === 8, "voices " + api.stats().voices);
  const outs = m.all.slice(b).filter(x => x.kind === "gain" && x.gain.calls.some(c => c[0] === "lin" && c[1] === 0));
  ok(outs.length === A.NAMES.length - 8, "cut " + outs.length);
  ok(ctx().srcs.filter(s => s.t1 <= ctx().currentTime + 0.0101).length >= 6, "cut sources stopped within 10 ms");
});
t("every voice ends: nodes are disconnected and the voice count returns to 0", () => {
  const { w, api, ctx, m, clock } = win(); w.fire("pointerdown");
  const b = m.all.length;
  A.NAMES.forEach(n => api[n](4)); clock.ms += 100; api.tick();
  ctx().advance(2);
  ok(api.stats().voices === 0, "voices " + api.stats().voices);
  const left = m.all.slice(b).filter(x => x.live && x.kind !== "dest");
  ok(left.length === 0, "live nodes " + left.map(x => x.kind));
});
t("mute and volume ramp over 30 ms (no click), and a muted page creates no voices", () => {
  const S = { sound: true, volume: 0.5 }, { w, api, m, ctx } = win({ settings: settingsOf(S) }); w.fire("pointerdown");
  const comp = m.all.find(n => n.kind === "comp"), master = m.all.find(n => n.kind === "gain" && n.outs[0] === comp);
  ctx().currentTime = 1;
  S.sound = false; w.fire("numberics:settings");
  let c = master.gain.calls; ok(c[c.length - 3][0] === "cancel" && c[c.length - 2][0] === "set" && near(c[c.length - 2][1], 0.25) && c[c.length - 1][0] === "lin" && c[c.length - 1][1] === 0 && near(c[c.length - 1][2], 1.03), JSON.stringify(c));
  ok(api.stats().target === 0 && api.tick() === false, "muted: silent");
  const n0 = m.all.length; api.place(); ok(m.all.length === n0, "no nodes while muted");
  w.fire("numberics:settings", { sound: true, volume: 0.8 }); // the event detail wins over get()
  c = master.gain.calls; ok(c[c.length - 1][0] === "lin" && near(c[c.length - 1][1], 0.4) && near(c[c.length - 1][2], 1.03), "volume ramp");
  ok(api.tick() === true, "plays again");
  w.fire("numberics:settings", { sound: true, volume: 0 }); ok(api.place() === false, "volume 0 is silent");
});
t("settings are read safely: missing, throwing or malformed settings fall back to on, 50%", () => {
  [undefined, { get() { throw new Error("x"); } }, { get: () => ({ volume: "loud", sound: "yes" }) }, { get: () => null }, {}].forEach((s, i) => {
    const o = win({ settings: s, navigator: { vibrate: () => true } }); o.w.fire("pointerdown");
    const st = o.api.stats(); ok(st.target === 0.25, i + " target " + st.target); ok(o.api.tick() === true && o.api.buzz("tap") === true, i);
  });
  const o = win({ settings: settingsOf({ volume: 7 }) }); ok(o.api.stats().target === 0.5, "volume clamped to 1");
});
t("buzz: the spec patterns, throttled to one call per 50 ms, off with Haptics off, bad never vibrates", () => {
  const got = [], S = { haptics: true }, o = win({ settings: settingsOf(S), navigator: { vibrate: p => { got.push(p); return true; } } });
  ok(o.api.buzz("tap") && JSON.stringify(got) === "[6]", "tap 6 ms");
  ok(!o.api.buzz("merge") && got.length === 1, "throttled"); o.clock.ms += 49; ok(!o.api.buzz("big"), "49 ms");
  o.clock.ms += 1; ok(o.api.buzz("merge") && got[1] === 10, "merge 10 ms");
  [["big", 18], ["win", [20, 40, 20]], ["lose", [30]]].forEach(([k, p]) => { o.clock.ms += 50; ok(o.api.buzz(k), k); ok(JSON.stringify(got[got.length - 1]) === JSON.stringify(p), k + " pattern"); });
  o.clock.ms += 50; const n = got.length; ok(!o.api.buzz("bad") && !o.api.buzz("nope") && got.length === n, "bad / unknown: none");
  S.haptics = false; o.w.fire("numberics:settings"); o.clock.ms += 100; ok(!o.api.buzz("tap") && got.length === n, "haptics off");
  ok(o.m.Ctx.made.length === 0, "buzz never creates audio");
});
t("buzz is safe when vibrate is missing or throws", () => {
  ok(win({ navigator: {} }).api.buzz("tap") === false, "no vibrate");
  ok(win({ navigator: undefined }).api.buzz("win") === false, "no navigator");
  ok(win({ navigator: { vibrate() { throw new Error("blocked"); } } }).api.buzz("tap") === false, "throws");
});
t("everything is safe without Web Audio: gestures, every sound, render", () => {
  const o = win({ noAudio: true, navigator: {} }); o.w.fire("pointerdown"); o.w.fire("keydown");
  A.NAMES.forEach(n => ok(o.api[n](1) === false, n)); ok(o.api.unlock() === false && !o.api.ready());
  ok(o.api.stats().contexts === 0 && o.api.stats().state === "none");
  later.push(o.api.render("tick").then(x => t("render without OfflineAudioContext resolves null", () => ok(x === null))));
});
t("a context constructor that throws is survived", () => {
  const w = { addEventListener() {}, AudioContext: function () { throw new Error("NotAllowed"); } };
  const api = A.make(w); ok(api.unlock() === false && api.tick() === false);
});
t("nothing plays and nothing vibrates while the tab is hidden", () => {
  const doc = { hidden: false, visibilityState: "visible" }, got = [];
  const o = win({ document: doc, navigator: { vibrate: p => got.push(p) } }); o.w.fire("pointerdown");
  doc.hidden = true; doc.visibilityState = "hidden";
  ok(o.api.tick() === false && o.api.buzz("tap") === false && got.length === 0);
  doc.hidden = false; doc.visibilityState = "visible"; ok(o.api.tick() === true);
});
t("module footprint: no localStorage, no timers, no network", () => {
  const s = require("fs").readFileSync(require("path").join(__dirname, "../shared/audio.js"), "utf8");
  ok(!/localStorage|setTimeout|setInterval|fetch\(|XMLHttpRequest|new Audio\(/.test(s));
});
require("./conventions")(t, ok, ["shared/audio.js", "tests/fixtures/audio.html", "tests/emu/shared-audio.cjs", "tests/test-audio.js"]);
Promise.all(later).then(() => { console.log(pass + " passed, " + fail + " failed"); process.exit(fail ? 1 : 0); });
