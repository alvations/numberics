/* SPDX-License-Identifier: Apache-2.0 | Copyright 2026 alvations (Melon Lab)
 * shared/music.js: the style data, the notation, the scheduler math, the per-game map, the originality guards,
 * and the live API against a fake AudioContext (no browser). `node tests/test-music.js` */
"use strict";
const fs = require("fs"), path = require("path");
const M = require("../shared/music.js"), X = require("../tools/music-measure.cjs");
let pass = 0, fail = 0;
function t(n, f) { try { f(); pass++; } catch (e) { fail++; console.log("FAIL", n, "\n  ", e.message); } }
function ok(c, m) { if (!c) throw new Error(m || "assertion failed"); }
const root = path.join(__dirname, "..");
const IDS = Object.keys(M.STYLES);
const near = (a, b, e) => Math.abs(a - b) < (e || 1e-9);

// ---- the data ----
t("at least six styles, ORDER lists each once, names are single unique words", () => {
  ok(IDS.length >= 6, "styles " + IDS.length);
  ok(M.ORDER.length === IDS.length && M.ORDER.every(id => M.STYLES[id]) && new Set(M.ORDER).size === IDS.length, "ORDER");
  const names = IDS.map(id => M.STYLES[id].name);
  ok(new Set(names).size === names.length, "dup names");
  names.forEach(n => ok(/^[A-Z][a-z]+$/.test(n), n));
  IDS.forEach(id => ok(M.STYLES[id].blurb && M.STYLES[id].blurb.length < 70 && /\.$/.test(M.STYLES[id].blurb), id + " blurb"));
});
t("every style is well formed: tempo, mode, form, voices", () => IDS.forEach(id => {
  const st = M.STYLES[id];
  ok(st.bpm >= 60 && st.bpm <= 160, id + " bpm"); ok(M.MODES[st.mode], id + " mode"); ok(st.beats === 4, id + " beats");
  ok(st.swing >= 0 && st.swing < 0.5, id + " swing"); ok(st.root >= 55 && st.root <= 76, id + " root");
  ok(st.level > 0 && st.level < 4, id + " level"); ok(st.verb >= 0 && st.verb <= 0.5, id + " verb");
  ok(st.form.length >= 3 && st.form.every(s => st.sections[s]), id + " form");
  Object.keys(st.sections).forEach(s => ok(st.form.includes(s), id + " unused section " + s));
  const kinds = new Set(st.form.map(s => s.replace(/\d+$/, "")));
  ok(kinds.size >= 2, id + " needs at least an A and a B section");
  Object.values(st.voices).forEach(p => {
    ok(/^(sine|triangle|square|sawtooth|supersaw|pulse25|pulse12)$/.test(p.wave), id + " wave " + p.wave);
    ok(p.gain > 0 && p.gain <= 0.5 && p.a > 0 && p.d > 0 && p.s >= 0 && p.s <= 1 && p.r > 0, id + " envelope");
  });
  Object.values(st.sections).forEach(sec => {
    if (sec.lead) ok(st.voices.lead, id + " lead voice");
    if (sec.harm || sec.lead2 || (sec.alt && (sec.alt.harm || sec.alt.lead2))) ok(st.voices.lead2, id + " lead2 voice");
    if (sec.bass) ok(st.voices.bass, id + " bass voice"); if (sec.arp) ok(st.voices.arp, id + " arp voice"); if (sec.pad) ok(st.voices.pad, id + " pad voice");
    [sec.drums, sec.fill, sec.alt && sec.alt.drums].filter(Boolean).forEach(d => ok(st.drums[d], id + " drum pattern " + d));
  });
}));
t("one pass of every style lasts 60 to 120 s and matches bars * beats * 60 / bpm", () => IDS.forEach(id => {
  const st = M.STYLES[id], c = M.compile(st, 0), s = M.cycleSeconds(st);
  ok(s >= 60 && s <= 120, id + " " + s); ok(near(c.seconds, s, 1e-6), id + " compile seconds");
  ok(near(M.compile(st, 1).seconds, s, 1e-6), id + " variant length");
}));
t("notation: every token parses and every bar splits into whole ticks", () => IDS.forEach(id => {
  const st = M.STYLES[id], B = st.beats * M.TPB;
  const lines = [], rels = [];
  Object.values(st.sections).forEach(sec => [sec, sec.alt || {}].forEach(o => {
    ["lead", "lead2"].forEach(k => o[k] && lines.push(o[k])); ["bass", "arp"].forEach(k => o[k] && rels.push([k, o[k]]));
    if (o.chords) o.chords.split(/\s+/).forEach(c => c.split("/").forEach(p => ok(M.chord(st, p), id + " chord " + p)));
  }));
  lines.forEach(l => M.bars(l).forEach(bar => { ok(B % bar.length === 0, id + " bar of " + bar.length);
    bar.forEach(tk => ok(tk === "." || tk === "-" || M.degree(st, tk) !== null, id + " token " + tk)); }));
  rels.forEach(([k, l]) => M.bars(l).forEach(bar => { ok(B % bar.length === 0, id + " " + k + " bar");
    bar.forEach(tk => ok(k === "bass" ? /^[R358.7-]$/.test(tk) : /^[0-6c.-]$/.test(tk), id + " " + k + " token " + tk)); }));
  Object.values(st.drums).forEach(p => Object.entries(p).forEach(([k, s]) => {
    ok(/^[kshotc]$/.test(k), id + " drum " + k); ok(/^[xXg.]{1,16}$/.test(s), id + " drum steps " + s); ok(st.kit[k] > 0, id + " kit " + k); }));
}));
t("degree and chord math", () => {
  const st = { mode: "major" };
  ok(M.degree(st, "1") === 0 && M.degree(st, "5") === 7 && M.degree(st, "1'") === 12 && M.degree(st, "5,") === -5 && M.degree(st, "b7") === 10 && M.degree(st, "#4") === 6);
  ok(M.degree(st, "8") === null && M.degree(st, "x") === null);
  ok(JSON.stringify(M.chord(st, "1")) === "[0,4,7]" && JSON.stringify(M.chord(st, "6")) === "[9,12,16]" && JSON.stringify(M.chord(st, "17")) === "[0,4,7,11]");
  ok(JSON.stringify(M.chord(st, "57")) === "[7,11,14,17]", "V7 diatonic"); ok(JSON.stringify(M.chord(st, "b7")) === "[10,14,17]", "bVII");
  ok(JSON.stringify(M.chord({ mode: "minor" }, "5M")) === "[7,11,14]", "forced major V"); ok(JSON.stringify(M.chord(st, "2M7")) === "[2,6,9,12]", "V7/V");
  ok(JSON.stringify(M.chord({ mode: "harmonic" }, "5")) === "[7,11,14]", "harmonic minor V is major");
  ok(near(M.mtof(69), 440) && near(M.mtof(81), 880));
});
t("compiled events: sorted, finite, inside the pass, sensible ranges", () => IDS.forEach(id => [0, 1].forEach(v => {
  const st = M.STYLES[id], c = M.compile(st, v); let prev = -1;
  ok(c.events.length > 100, id + " events");
  c.events.forEach(e => {
    ok(e.t >= prev, id + " sorted"); prev = e.t;
    ok(e.d > 0 && e.t + e.d <= c.ticks && isFinite(e.s) && e.e > e.s && e.e <= c.seconds + 1e-9, id + " timing");
    ok(e.g > 0 && e.g <= 1, id + " velocity");
    if (st.voices[e.v]) ok(e.m >= 26 && e.m <= 90, id + " " + e.v + " midi " + e.m); // lead never above F#6 (about 1.5 kHz)
  });
})));
t("the second pass differs from the first (loop variation), and no style is a wall of repeats", () => IDS.forEach(id => {
  const s = X.score(id);
  ok(s.pass2Changed >= 0.2, id + " pass 2 changes only " + s.pass2Changed);
  ok(s.allRepeat <= 0.7, id + " repeat " + s.allRepeat); ok(s.uniqueBars >= 16, id + " unique bars " + s.uniqueBars);
}));
t("the written key is the key you hear (pitch-class profile)", () => IDS.forEach(id => {
  const st = M.STYLES[id], s = X.score(id), tonic = st.root % 12, k = X.detectKey(M.compile(st, 0).events);
  if (st.mode === "major") ok(k.tonic === tonic && k.mode === "major", id + " " + s.detected);
  if (st.mode === "minor" || st.mode === "harmonic") ok(k.tonic === tonic && k.mode === "minor", id + " " + s.detected);
  ok(k.r > 0.75, id + " key strength " + k.r);
}));

// ---- scheduler math ----
t("tickTime: zero, whole beats on the grid at any swing, monotonic, swing moves the off-beat late", () => {
  ok(M.tickTime(0, 120, 0) === 0);
  [0, 0.1, 0.2, 0.4].forEach(sw => { for (let b = 0; b < 20; b++) ok(near(M.tickTime(b * M.TPB, 100, sw), b * 0.6), "beat " + b + " swing " + sw);
    let p = -1; for (let k = 0; k < 200; k++) { const x = M.tickTime(k, 100, sw); ok(x > p); p = x; } });
  ok(near(M.tickTime(M.TPB / 2, 60, 0), 0.5) && near(M.tickTime(M.TPB / 2, 60, 0.2), 0.6), "swung off-beat");
  ok(near(M.tickTime(3, 120, 0), 0.125), "16th at 120");
});
t("scheduler constants: lookahead covers a slipped timer tick, fades are sane", () => {
  const L = M.LEVELS; ok(L.LOOKAHEAD >= 3 * L.TICK_MS / 1000, "lookahead"); ok(L.TICK_MS >= 25 && L.TICK_MS <= 100);
  ok(L.XFADE >= 1 && L.XFADE <= 4 && L.FADE_IN >= 1 && L.STOP_FADE > 0 && L.DUCK > 0 && L.DUCK < 1);
  ok(M.SCALE > 0 && M.SCALE < 0.5 && M.TARGET_LUFS === -20);
  ok(M.DEF.musicVolume > 0 && M.DEF.musicVolume <= 1 && M.DEF.musicStyle === "auto" && typeof M.DEF.music === "boolean");
});

t("sfxKey moves the C pentatonic SFX ladder into each style's key", () => {
  const PENT = [0, 2, 4, 7, 9];
  IDS.forEach(id => {
    const st = M.STYLES[id], k = M.sfxKey(st), scale = M.MODES[st.mode].map(x => (x + st.root) % 12);
    ok(k >= -6 && k <= 5, id + " fold");
    const out = PENT.filter(p => !scale.includes(((p + k) % 12 + 12) % 12));
    ok(out.length <= 1, id + " ladder notes outside the key: " + out.length); // harmonic minor keeps one (its lowered 7th)
  });
});

// ---- the per-game map ----
t("per-game map covers every live game in games.json (and Two by both ids) with a real style", () => {
  const games = JSON.parse(fs.readFileSync(path.join(root, "games.json"), "utf8")).filter(g => g.status === "live");
  games.forEach(g => ok(M.STYLES[M.GAMES[g.id]], "no style for " + g.id));
  ok(M.GAMES.two && M.GAMES.endless === M.GAMES.two, "Two alias");
  Object.values(M.GAMES).forEach(s => ok(M.STYLES[s], s));
  ok(M.styleFor("seven", "auto") === M.GAMES.seven && M.styleFor("seven", "epic") === "epic" && M.styleFor("nope", "auto") === "chill" && M.styleFor("four", "bogus") === M.GAMES.four);
  const used = new Set(Object.values(M.GAMES)); ok(used.size >= 5, "the map should use most styles: " + [...used]);
});

// ---- originality ----
// Names of other works are kept here only as FNV-1a hashes of lowercase words and word pairs, so no title ever
// appears in the repo. A hit means a player-visible or source text names another game, franchise or composer.
const BAN1 = new Set([679042920, 1821658341, 2082623414, 817898526, 3298217274, 3473247979, 2692686076, 3581587211, 1435889680, 2783497579, 536233787, 1498040325, 3440259439, 1385804191, 125391006, 153747053, 879813784, 1890618769, 1842540828, 3366080637, 3615056524, 2704678631, 3613923152, 975158294, 1796020153, 2506926520]);
const BAN2 = new Set([2708981093, 2018153108, 1825702373, 530270355, 4255431911, 2896317320]);
const fnv = s => { let h = 0x811c9dc5; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 0x01000193) >>> 0; } return h; };
const SCAN = ["shared/music.js", "tools/render-music.cjs", "tools/music-measure.cjs", "tests/emu/shared-music.cjs", "tests/fixtures/music.html",
  "docs/design/MUSIC.md", "docs/design/MUSIC-PANEL.md"];
t("no style, copy, code or doc names another game, franchise or composer", () => SCAN.forEach(f => {
  const p = path.join(root, f); if (!fs.existsSync(p)) throw new Error("missing " + f);
  const w = fs.readFileSync(p, "utf8").toLowerCase().split(/[^a-zà-ÿ]+/).filter(Boolean);
  w.forEach((x, i) => { ok(!BAN1.has(fnv(x)), f + ": banned word at " + i); if (i) ok(!BAN2.has(fnv(w[i - 1] + " " + x)), f + ": banned pair at " + i); });
}));
// Interval shapes (semitones between consecutive notes) of a few very well-known openings, folk and game, stored
// as numbers only. No lead line of ours may contain any 5-interval window of them, in any key.
const GUARD = [[-5, 1, 2, -2, -1, -2, 0, 3, 4, -2, -2, -1], [1, 2, 2, -4, -3, 0], [0, 0, -4, 4, 3, -12], [-5, 5, 0, 2, 2, 1, 2],
  [2, 2, 3, 5, 2, 2, 3, 5], [0, 1, 2, 0, -2, -1, -2], [0, 7, 0, 2, 0, -2]];
t("originality: no lead line follows the contour of a well-known opening", () => {
  const grams = new Set();
  GUARD.forEach(g => { for (let i = 0; i + 5 <= g.length; i++) grams.add(g.slice(i, i + 5).join(",")); });
  IDS.forEach(id => [0, 1].forEach(v => ["lead", "lead2"].forEach(voice => {
    const ms = M.compile(M.STYLES[id], v).events.filter(e => e.v === voice).map(e => e.m);
    for (let i = 0; i + 6 <= ms.length; i++) {
      const g = []; for (let j = 0; j < 5; j++) g.push(ms[i + j + 1] - ms[i + j]);
      ok(!grams.has(g.join(",")), id + " " + voice + " pass " + v + " matches a guarded contour at note " + i + ": " + g);
    }
  })));
});

// ---- the live API on a fake AudioContext ----
function fakeWorld() {
  let clock = 0; const q = [], L = {}, D = {};
  const P = v => ({ value: v, setValueAtTime(x) { this.value = x; }, linearRampToValueAtTime(x) { this.value = x; }, exponentialRampToValueAtTime(x) { this.value = x; }, cancelScheduledValues() {} });
  const node = () => ({ connect: n => n, disconnect() {} });
  const src = () => Object.assign(node(), { start() {}, stop() {} });
  class AC {
    constructor() { AC.n++; this.state = "running"; this.sampleRate = 4000; this.destination = node(); }
    get currentTime() { return clock / 1000; }
    createGain() { return Object.assign(node(), { gain: P(1) }); }
    createOscillator() { return Object.assign(src(), { frequency: P(0), detune: P(0), setPeriodicWave() {} }); }
    createBiquadFilter() { return Object.assign(node(), { frequency: P(0), Q: P(0) }); }
    createConvolver() { return node(); }
    createDelay() { return Object.assign(node(), { delayTime: P(0) }); }
    createBufferSource() { return src(); }
    createBuffer(ch, n) { const d = []; for (let i = 0; i < ch; i++) d.push(new Float32Array(n)); return { getChannelData: i => d[i] }; }
    createPeriodicWave() { return {}; }
    resume() { this.state = "running"; return Promise.resolve(); }
    suspend() { this.state = "suspended"; return Promise.resolve(); }
  }
  AC.n = 0;
  const doc = { hidden: false, visibilityState: "visible", addEventListener(n, f) { (D[n] = D[n] || []).push(f); }, querySelector: () => null };
  const w = { AudioContext: AC, document: doc, addEventListener(n, f) { (L[n] = L[n] || []).push(f); },
    fire(n, e) { (L[n] || []).forEach(f => f(e)); }, vis(h) { doc.hidden = h; doc.visibilityState = h ? "hidden" : "visible"; (D.visibilitychange || []).forEach(f => f()); } };
  const opt = { setTimeout(f, ms) { const o = { f, at: clock + (ms || 0) }; q.push(o); return o; }, clearTimeout(o) { const i = q.indexOf(o); if (i >= 0) q.splice(i, 1); } };
  const run = ms => { const end = clock + ms; for (;;) { q.sort((a, b) => a.at - b.at); if (!q.length || q[0].at > end) break; const o = q.shift(); clock = o.at; o.f(); } clock = end; };
  return { w, opt, AC, run };
}
t("live: no AudioContext before a gesture; untrusted events do not unlock", () => {
  const F = fakeWorld(), m = M.make(F.w, F.opt);
  ok(m.play("chill") === false && F.AC.n === 0, "context before gesture");
  F.fire = null; F.w.fire("pointerdown", { isTrusted: false }); ok(F.AC.n === 0, "untrusted");
  F.w.fire("pointerdown", { isTrusted: true }); ok(F.AC.n === 1, "gesture creates one context");
  ok(!m.state().playing, "buffers and the player are built in the next task, not inside the tap"); F.run(1);
  F.w.fire("keydown", { isTrusted: true }); ok(F.AC.n === 1, "only one");
  const s = m.state(); ok(s.playing && s.style === "chill" && s.contexts === 1, JSON.stringify(s));
});
t("live: no context at all when nobody asked for music", () => {
  const F = fakeWorld(), m = M.make(F.w, F.opt); F.w.fire("pointerdown", { isTrusted: true }); ok(F.AC.n === 0 && !m.state().playing);
});
t("live: books notes ahead, crossfades, ducks, follows settings, pauses when hidden, stops", () => {
  const F = fakeWorld(), m = M.make(F.w, F.opt); m.start("seven");
  F.w.fire("click", { isTrusted: true }); F.run(1);
  ok(m.state().style === "blocks", "per-game default " + m.state().style);
  F.run(3000); const n1 = m.state().notes; ok(n1 > 20, "notes booked " + n1);
  ok(near(m.state().mix, M.DEF.musicVolume * M.SCALE, 1e-9), "mix level");
  m.setStyle("pulse"); ok(m.state().style === "pulse" && m.state().fading === 1, "crossfade starts");
  F.run(500); ok(m.state().fading === 1, "old style keeps playing through the fade");
  F.run(M.LEVELS.XFADE * 1000 + 3000); ok(m.state().fading === 0, "old style freed");
  ok(m.key() === M.sfxKey(M.STYLES.pulse) && m.dip() === true, "key and dip");
  m.duck(true); ok(m.state().ducked && m.dip() === false, "no dip while ducked"); m.duck(false);
  m.volume(1); ok(near(m.state().mix, M.SCALE), "volume");
  F.w.fire("numberics:settings", { detail: { music: false } }); ok(!m.state().playing && m.state().mix === 0, "music off");
  F.w.fire("numberics:settings", { detail: { music: true, musicStyle: "epic" } }); ok(m.state().playing && m.state().style === "epic", "music back, fixed style");
  F.w.fire("numberics:settings", { detail: { sound: false } }); ok(m.state().playing && m.state().volume === 1, "fields it does not carry keep their value");
  F.w.vis(true); F.run(400); ok(m.state().paused && m.state().ctx === "suspended", "hidden pauses " + JSON.stringify(m.state()));
  const n2 = m.state().notes; F.run(3000); ok(m.state().notes === n2, "nothing booked while hidden");
  F.w.vis(false); return Promise.resolve().then(() => 0);
});
t("live: stop() fades out and nothing more is booked", () => {
  const F = fakeWorld(), m = M.make(F.w, F.opt); m.play("drift"); F.w.fire("pointerdown", { isTrusted: true }); F.run(2000);
  m.stop(); ok(!m.state().playing); F.run(4000); const n = m.state().notes; F.run(4000); ok(m.state().notes === n && m.state().fading === 0);
  ok(m.styles().length === IDS.length && m.styles().every(s => s.seconds >= 60 && s.seconds <= 120));
});

t("live: shared-bus contract: unlock() then musicBus(); no own context; hidden pauses without suspending it", () => {
  const F = fakeWorld(); let unlocked = 0, shared = null;
  F.w.NumbericsAudio = { unlock() { unlocked++; if (!shared) shared = { context: new F.AC(), input: { connect: n => n, disconnect() {} } }; return true; },
    musicBus() { return shared; } };
  const m = M.make(F.w, F.opt); m.start("sudoku");
  ok(F.AC.n === 0 && unlocked === 0, "nothing before a gesture");
  F.w.fire("pointerdown", { isTrusted: true }); F.run(1);
  const s = m.state(); ok(unlocked >= 1 && F.AC.n === 1 && s.contexts === 0 && s.shared && s.playing && s.style === "drift", JSON.stringify(s));
  F.run(2000); ok(m.state().notes > 0, "books on the shared clock");
  F.w.vis(true); F.run(400); ok(m.state().paused && shared.context.state === "running", "music never suspends a context it does not own");
  const n = m.state().notes; F.run(2000); ok(m.state().notes === n, "nothing booked while hidden");
  F.w.vis(false); F.run(10); ok(!m.state().paused, "resumes");
});

require("./conventions")(t, ok, ["shared/music.js", "tools/render-music.cjs", "tools/music-measure.cjs", "tests/emu/shared-music.cjs", "tests/fixtures/music.html",
  "docs/design/MUSIC.md", "docs/design/MUSIC-PANEL.md"]);
console.log(pass + " passed, " + fail + " failed"); process.exit(fail ? 1 : 0);
