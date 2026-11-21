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
// O-10: a context made on a key that is not an activation (Escape) stays suspended; the next tap resumes it, and the
// browser starts it a moment later (asynchronously). The sound of that tap used to be dropped.
function waking() {
  const o = win(); let done = null;
  o.m.Ctx.prototype.resume = function () { this.resumes++; return new Promise(r => { done = () => { this.state = "running"; r(); }; }); };
  o.w.fire("keydown");
  return { o, c: o.ctx(), start: () => done() };
}
t("O-10: the tap that wakes a suspended context is heard; after the wake window nothing piles up", () => {
  const { o, c } = waking();
  ok(c.state === "suspended", "still suspended while it wakes");
  const before = c.srcs.length;
  ok(o.api.slide() === true && c.srcs.length > before, "the waking tap's sound is booked on the waking clock");
  o.clock.ms += 300;
  ok(o.api.merge(3) === false, "after the 250 ms window a context that has not started plays nothing");
});
{
  const a = waking(); a.o.api.slide(); a.o.clock.ms += 50; a.start();
  const b = waking(); b.o.api.slide(); b.o.clock.ms += 1300; b.start();
  later.push(new Promise(r => setTimeout(r, 0)).then(() => {
    t("O-10: a prompt start keeps the waking tap's voice", () => ok(a.o.api.stats().voices === 1 && a.c.state === "running", JSON.stringify(a.o.api.stats())));
    t("O-10: a late start cuts it instead of playing it late", () => ok(b.o.api.stats().voices === 0 && b.c.srcs.filter(s => s.kind !== "buf" || s.buffer.length !== 1).every(s => s.t1 <= 0.01), JSON.stringify(b.o.api.stats())));
  }));
}
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
  const PEAK = { tick: .21, slide: .35, merge: .36, land: .43, pop: .36, burst: .28, pip: .22, place: .21, best: .16, power: .27, trophy: .16, win: .18, lose: .11, bad: .20 }; // MUSIC.md, SFX notes
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
t("musicBus(): null before the context, then one { context, input } straight into the compressor", () => {
  const S = { sound: true, volume: 0.5 }, { w, api, m } = win({ settings: settingsOf(S) });
  ok(api.musicBus() === null, "null before a gesture");
  w.fire("pointerdown");
  const b = api.musicBus(), comp = m.all.find(n => n.kind === "comp"), master = m.all.find(n => n.kind === "gain" && n.outs[0] === comp && n !== b.input);
  ok(b && b.context === m.Ctx.made[0] && b.input.kind === "gain" && b.input.gain.value === 1, "context + gain 1");
  ok(b.input.outs.length === 1 && b.input.outs[0] === comp, "input -> compressor, not the SFX master");
  ok(api.musicBus() === b && m.Ctx.made.length === 1, "the same object, one context");
  S.sound = false; w.fire("numberics:settings"); ok(b.input.gain.value === 1 && master.gain.calls.length > 0, "Sound off moves the SFX master only");
});
t("SFX follow the music's key: numberics:music shifts the ladder and the fixed chords; taps never move", () => {
  const first = (api, m, n, k) => { const b = m.all.length; api[n](k); return m.all.slice(b).filter(x => x.kind === "osc").map(x => x.frequency.calls[0][1]); };
  const { w, api, m, clock } = win(); w.fire("pointerdown");
  const base = { merge: first(api, m, "merge", 3), best: first(api, m, "best"), win: first(api, m, "win"), lose: first(api, m, "lose"), tick: first(api, m, "tick"), trophy: (clock.ms += 100, first(api, m, "trophy")) };
  w.fire("numberics:music", { style: "quest", key: -2 }); ok(api.key() === -2, "key");
  clock.ms += 100; const r = Math.pow(2, -2 / 12);
  ["merge", "best", "win", "lose"].forEach(n => { const f = first(api, m, n, 3); ok(f.length === base[n].length && f.every((x, i) => near(x, base[n][i] * r, 1e-6)), n + " shifted " + f); });
  ok(near(first(api, m, "tick")[0], base.tick[0]), "tick stays");
  clock.ms += 100; const tr = first(api, m, "trophy"); ok(tr.length === 5 && tr.every((x, i) => near(x, base.trophy[i] * r, 1e-6)), "trophy arpeggio and held chord shifted " + tr);
  w.fire("numberics:music", { key: 9 }); ok(api.key() === 0, "out of range -> 0");
  w.fire("numberics:music", {}); ok(api.key() === 0, "missing -> 0");
});
t("the shifted ladder sits in every style's scale (one note off in harmonic minor at most)", () => {
  const M = require("../shared/music.js");
  M.ORDER.forEach(id => {
    const st = M.STYLES[id], k = M.sfxKey(st), scale = M.MODES[st.mode].map(x => (st.root + x) % 12);
    const off = [0, 2, 4, 7, 9].map(x => ((x + k) % 12 + 12) % 12).filter(pc => scale.indexOf(pc) < 0).length;
    ok(off <= (st.mode === "harmonic" ? 1 : 0), id + " key " + k + ": " + off + " off");
  });
});
t("best, power and trophy dip the music; nothing else does; a missing or throwing music is survived", () => {
  const { w, api, clock } = win(); w.fire("pointerdown");
  let dips = 0; w.NumbericsMusic = { dip() { dips++; return true; } };
  A.NAMES.forEach(n => { clock.ms += 100; api[n](2); });
  ok(dips === 3, "dips " + dips);
  w.NumbericsMusic = { dip() { throw new Error("x"); } }; clock.ms += 100; ok(api.best() === true, "throwing dip");
  delete w.NumbericsMusic; clock.ms += 100; ok(api.power() === true, "no music");
});
// a window with a document that records appended scripts, for the lazy loader
function lazyWin(o) {
  o = o || {};
  const L = {}, added = [], games = o.game === undefined ? { getAttribute: () => "four" } : o.game;
  const d = { currentScript: { src: "http://h/x/shared/audio.js?v=2" }, head: { appendChild(el) { added.push(el); } },
    createElement: tag => ({ tag }), querySelector: s => (s === "#games[data-current]" ? games : null) };
  const S = { music: o.music !== false };
  const w = { document: d, NumbericsSettings: { get: () => Object.assign({}, S) }, addEventListener(n, f) { (L[n] = L[n] || []).push(f); },
    fire(n, e) { (L[n] || []).forEach(f => f(e || {})); } };
  A.lazyMusic(w);
  // what music.js does when it runs: replace the stub with the real module (a recorder here)
  const real = () => { const calls = []; const m = {}; ["game", "duck", "start", "unlock", "play", "stop", "dip"].forEach(k => m[k] = (...a) => { calls.push([k].concat(a)); return true; }); w.NumbericsMusic = m; return calls; };
  return { w, S, added, real };
}
t("lazy music: a stub at load, nothing fetched before a trusted gesture, music.js injected after it", () => {
  const { w, added, real } = lazyWin();
  const st = w.NumbericsMusic; ok(st.stub && ["play", "start", "stop", "duck", "dip", "setStyle", "enable", "key"].every(k => typeof st[k] === "function"), "stub API");
  ok(st.dip() === false && st.key() === 0 && st.start("four") === false, "no-ops");
  ok(st.duck(true) === true && st.duck(false) === false && st.duck(true) === true, "the latest duck state is kept");
  w.fire("numberics:settings", { detail: { music: true } }); ok(added.length === 0, "settings before a gesture load nothing");
  w.fire("pointerdown", { isTrusted: false }); ok(added.length === 0, "untrusted");
  w.fire("pointerdown", { isTrusted: true }); ok(added.length === 1 && added[0].tag === "script", "one script element");
  ok(added[0].src === "http://h/x/shared/music.js" && added[0].async === true && typeof added[0].onload === "function" && typeof added[0].onerror === "function", added[0].src);
  w.fire("keydown", { isTrusted: true }); w.fire("click", { isTrusted: true }); ok(added.length === 1, "loaded once");
  const calls = real(); added[0].onload();
  const names = calls.map(c => c[0]);
  ok(JSON.stringify(calls.find(c => c[0] === "duck")) === '["duck",true]', "duck replayed " + JSON.stringify(calls));
  ok(JSON.stringify(calls.find(c => c[0] === "start")) === '["start","four"]' && names.indexOf("unlock") > names.indexOf("start"), "started with the page's game, then unlocked");
  ok(names.indexOf("duck") < names.indexOf("start"), "duck before start, so it starts ducked");
});
t("lazy music: Music off loads nothing; turning it on later loads it then; stop() before load keeps it quiet", () => {
  const o = lazyWin({ music: false });
  o.w.fire("pointerdown", { isTrusted: true }); ok(o.added.length === 0, "off: nothing");
  o.w.fire("numberics:settings", { detail: { music: false } }); ok(o.added.length === 0);
  o.S.music = true; o.w.fire("numberics:settings", { detail: { music: true } }); ok(o.added.length === 1, "on later: loads");
  const p = lazyWin(); p.w.NumbericsMusic.stop(); p.w.fire("click", { isTrusted: true });
  const calls = p.real(); p.added[0].onload(); ok(!calls.some(c => c[0] === "start"), "stopped: no start");
});
t("lazy music: the games page (no #games[data-current]) never loads music.js; a page's own start() still does (TRIAGE5 S2)", () => {
  const o = lazyWin({ game: null });
  ["pointerdown", "keydown", "touchend", "click"].forEach(k => o.w.fire(k, { isTrusted: true }));
  o.w.fire("numberics:settings", { detail: { music: true } });
  ok(o.added.length === 0, "games page: nothing fetched after taps and a Settings change");
  const g = lazyWin({ game: null }); g.w.NumbericsMusic.start("sudoku"); g.w.fire("click", { isTrusted: true });
  ok(g.added.length === 1, "a page that names its game loads it");
});
t("lazy music: game id from #games[data-current], endless -> two; a failed load is survived", () => {
  [[{ getAttribute: () => "endless" }, "two"], [{ getAttribute: () => "seven" }, "seven"]].forEach(([g, want]) => {
    const o = lazyWin({ game: g }); o.w.fire("touchend", { isTrusted: true }); const calls = o.real(); o.added[0].onload();
    ok(calls.find(c => c[0] === "start")[1] === want, want);
  });
  const o = lazyWin(); o.w.NumbericsMusic.start("sudoku"); o.w.fire("click", { isTrusted: true }); const calls = o.real(); o.added[0].onload();
  ok(calls.find(c => c[0] === "start")[1] === "sudoku", "a page's own start() id wins");
  const f = lazyWin(); f.w.fire("click", { isTrusted: true }); f.added[0].onerror(); f.w.fire("click", { isTrusted: true });
  ok(f.added.length === 1 && f.w.NumbericsMusic.stub && f.w.NumbericsMusic.duck(true), "error: the stub stays, no retry loop");
  const r = lazyWin(); r.real(); r.w.fire("click", { isTrusted: true }); ok(r.added.length === 0, "music.js already on the page: no second copy");
});
t("module footprint: no localStorage, no timers, no network", () => {
  const s = require("fs").readFileSync(require("path").join(__dirname, "../shared/audio.js"), "utf8");
  ok(!/localStorage|setTimeout|setInterval|fetch\(|XMLHttpRequest|new Audio\(/.test(s));
});
require("./conventions")(t, ok, ["shared/audio.js", "tests/fixtures/audio.html", "tests/emu/shared-audio.cjs", "tests/test-audio.js"]);
Promise.all(later).then(() => { console.log(pass + " passed, " + fail + " failed"); process.exit(fail ? 1 : 0); });
