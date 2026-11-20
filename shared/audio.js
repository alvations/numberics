/* SPDX-License-Identifier: Apache-2.0 | Copyright 2026 alvations (Melon Lab)
 * NumbericsAudio (docs/design/REDESIGN.md 6.4, 7): procedural Web Audio sounds and vibration. No files, no network.
 *
 * One AudioContext, created and resumed only inside a user gesture (pointerdown / keydown / touchend / click,
 * capture listeners registered once on load), synchronously in the handler as melon-eight does, so iOS and iframes
 * unlock. Before the first gesture every sound is a silent no-op and no context exists.
 * Graph: voice gain -> master gain (volume * 0.5, 0 when Sound is off; changes ramp over 30 ms) ->
 * DynamicsCompressor (-18 dB, 4:1, 3 ms, 120 ms) -> destination. One call = one voice; at most 8 voices
 * (the oldest is cut with a 5 ms fade); the same sound at most once per 40 ms; nothing plays while the tab is hidden.
 * Every node is stopped and disconnected when its voice ends.
 * Settings come from NumbericsSettings.get() (safe fallback) and the window event "numberics:settings".
 * Also require()-able: module.exports = { make, note, NAMES, BUZZ } for the Node tests. */
(function (root) {
  "use strict";
  var NAMES = "tick slide merge land pop burst pip place best power trophy win lose bad".split(" ");
  var P = [0, 2, 4, 7, 9];
  // C4 upward on a pentatonic ladder, capped at k = 14 (about 1568 Hz)
  function note(k) {
    k = Math.max(0, Math.min(14, Math.floor(+k) || 0));
    return 261.63 * Math.pow(2, (P[k % 5] + 12 * Math.floor(k / 5)) / 12);
  }
  var C5 = note(5), E5 = note(6), G5 = note(7), C6 = note(10), E4 = note(2), G4 = note(3);
  var BUZZ = { tap: 6, merge: 10, big: 18, win: [20, 40, 20], lose: [30], bad: 0 };
  var MAX_VOICES = 8, SAME_MS = 40, BUZZ_MS = 50, RAMP = 0.03;
  var COMP = { threshold: -18, knee: 6, ratio: 4, attack: 0.003, release: 0.12 };

  // ---- recipes: (v, t) where v = { c, out, src(node) } ; return the voice length in seconds ----
  function env(v, g, t, a, d, peak) {
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
    g.gain.setValueAtTime(0, t + a + d + 0.005);
    return a + d + 0.01;
  }
  function tone(v, type, f, t, a, d, peak) {
    var c = v.c, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    o.connect(g); g.connect(v.out);
    var len = env(v, g, t, a, d, peak);
    v.src(o, t, t + len, g); return { o: o, end: t + len };
  }
  function noiseBuf(c) {
    if (c.__nmNoise) return c.__nmNoise;
    var n = Math.floor(c.sampleRate * 0.5), b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0), s = 0x9e3779b9;
    for (var i = 0; i < n; i++) { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; d[i] = ((s >>> 0) / 4294967296) * 2 - 1; } // seeded, so renders repeat
    try { c.__nmNoise = b; } catch (e) { /* frozen host object */ }
    return b;
  }
  function noise(v, filter, f, q, t, a, d, peak) {
    var c = v.c, s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
    s.buffer = noiseBuf(c); s.loop = true;
    fl.type = filter; fl.frequency.setValueAtTime(f, t); if (q != null) fl.Q.setValueAtTime(q, t);
    s.connect(fl); fl.connect(g); g.connect(v.out);
    var len = env(v, g, t, a, d, peak);
    v.src(s, t, t + len, fl, g); return { s: s, f: fl, end: t + len };
  }
  function mergeAt(v, k, t, peak) {
    var f = note(k), a = tone(v, "triangle", f, t, 0.005, 0.18, peak);
    tone(v, "sine", 2 * f, t, 0.005, 0.18, peak / 3);
    return a.end - t;
  }
  function arp(v, fs, t, gap, d, peak, lastD) {
    var end = t;
    fs.forEach(function (f, i) { end = Math.max(end, tone(v, "triangle", f, t + i * gap, 0.005, i === fs.length - 1 && lastD ? lastD : d, peak).end); });
    return end - t;
  }
  var R = {
    tick: function (v, t) { return tone(v, "sine", 880, t, 0.002, 0.04, 0.05).end - t; },
    slide: function (v, t) { return noise(v, "bandpass", 1200, 0.8, t, 0.004, 0.06, 0.04).end - t; },
    merge: function (v, t, k) { return mergeAt(v, k, t, 0.08); },
    land: function (v, t) {
      var r = tone(v, "sine", 140, t, 0.002, 0.11, 0.1);
      r.o.frequency.exponentialRampToValueAtTime(90, t + 0.08);
      return r.end - t;
    },
    pop: function (v, t, w) { return mergeAt(v, 4 + Math.max(1, Math.floor(+w) || 1), t, 0.08); },
    burst: function (v, t) {
      var r = noise(v, "lowpass", 2400, 0.7, t, 0.004, 0.22, 0.09);
      r.f.frequency.exponentialRampToValueAtTime(400, t + 0.2);
      return Math.max(r.end - t, mergeAt(v, 9, t, 0.08));
    },
    pip: function (v, t) { return tone(v, "sine", 1046, t, 0.002, 0.05, 0.035).end - t; },
    place: function (v, t) { return tone(v, "sine", 660, t, 0.003, 0.09, 0.05).end - t; },
    best: function (v, t) { return arp(v, [C5, E5, G5], t, 0.07, 0.16, 0.07); },
    power: function (v, t) {
      var c = v.c, lfo = c.createOscillator(), depth = c.createGain(), end = t;
      lfo.type = "sine"; lfo.frequency.setValueAtTime(6, t); depth.gain.setValueAtTime(8, t); // 6 Hz, 8 cents
      lfo.connect(depth);
      [[1318, 0.05], [1976, 0.025]].forEach(function (p) {
        var r = tone(v, "sine", p[0], t, 0.01, 0.3, p[1]);
        depth.connect(r.o.detune); end = Math.max(end, r.end);
      });
      v.src(lfo, t, end, depth); return end - t;
    },
    trophy: function (v, t) {
      var a = R.best(v, t), at = t + 0.21, end = t + a;
      [G5, C6].forEach(function (f) { end = Math.max(end, tone(v, "triangle", f, at, 0.01, 0.6, 0.04).end); });
      return end - t;
    },
    win: function (v, t) { return arp(v, [C5, E5, G5, C6], t, 0.09, 0.16, 0.08, 0.6); },
    lose: function (v, t) {
      var a = tone(v, "sine", G4, t, 0.005, 0.4, 0.05), b = tone(v, "sine", E4, t + 0.16, 0.005, 0.4, 0.05);
      return Math.max(a.end, b.end) - t;
    },
    bad: function (v, t) { return tone(v, "sine", 180, t, 0.003, 0.09, 0.04).end - t; },
  };

  function graph(c, dest) {
    var m = c.createGain(), k = c.createDynamicsCompressor();
    k.threshold.value = COMP.threshold; k.knee.value = COMP.knee; k.ratio.value = COMP.ratio;
    k.attack.value = COMP.attack; k.release.value = COMP.release;
    m.connect(k); k.connect(dest || c.destination);
    return { c: c, master: m, comp: k };
  }

  // make(w, opt): the API bound to window-like object w. opt.now() (ms clock) is for tests.
  function make(w, opt) {
    w = w || {}; opt = opt || {};
    var now = opt.now || function () { try { return w.performance.now(); } catch (e) { return Date.now(); } };
    var AC = null; try { AC = w.AudioContext || w.webkitAudioContext || null; } catch (e) { AC = null; }
    var eng = null, voices = [], last = {}, lastBuzz = -1e9, cfg = null, made = 0;

    function readCfg(d) {
      var s = d;
      if (!s) { try { s = w.NumbericsSettings && w.NumbericsSettings.get ? w.NumbericsSettings.get() : null; } catch (e) { s = null; } }
      s = s || {};
      var vol = typeof s.volume === "number" && isFinite(s.volume) ? Math.max(0, Math.min(1, s.volume)) : 0.5;
      return { sound: s.sound !== false, volume: vol, haptics: s.haptics !== false };
    }
    function conf() { return cfg || (cfg = readCfg()); }
    function target() { var s = conf(); return s.sound ? s.volume * 0.5 : 0; }
    function hidden() { try { return !!(w.document && (w.document.hidden || w.document.visibilityState === "hidden")); } catch (e) { return false; } }

    // Inside a gesture: create (once) and resume, synchronously, then play one silent sample (the iOS unlock).
    function unlock() {
      if (!AC) return false;
      try {
        if (!eng) {
          var c = new AC(); made++;
          eng = graph(c); eng.master.gain.value = target();
          var b = c.createBuffer(1, 1, c.sampleRate || 44100), s = c.createBufferSource();
          s.buffer = b; s.connect(c.destination); s.start(0);
          s.onended = function () { try { s.disconnect(); } catch (e) { /* gone */ } };
        }
        if (eng.c.state !== "running" && eng.c.resume) { var p = eng.c.resume(); if (p && p.catch) p.catch(function () {}); }
      } catch (e) { return false; }
      return true;
    }
    function onGesture(e) { if (e && e.isTrusted === false) return; unlock(); }
    try { ["pointerdown", "keydown", "touchend", "click"].forEach(function (n) { w.addEventListener(n, onGesture, { capture: true }); }); } catch (e) { /* no events */ }

    function rampMaster() {
      if (!eng) return;
      try {
        var g = eng.master.gain, t = eng.c.currentTime;
        if (g.cancelAndHoldAtTime) g.cancelAndHoldAtTime(t); else { var cur = g.value; g.cancelScheduledValues(t); g.setValueAtTime(cur, t); }
        g.linearRampToValueAtTime(target(), t + RAMP);
      } catch (e) { /* closed context */ }
    }
    try {
      w.addEventListener("numberics:settings", function (e) { cfg = readCfg(e && e.detail); rampMaster(); });
    } catch (e) { /* no events */ }

    function drop(v) { var i = voices.indexOf(v); if (i >= 0) voices.splice(i, 1); }
    function cleanup(v) {
      if (v.done) return; v.done = true; drop(v);
      v.nodes.forEach(function (n) { try { n.disconnect(); } catch (e) { /* gone */ } });
      try { v.out.disconnect(); } catch (e) { /* gone */ }
    }
    function cut(v) {
      drop(v);
      try {
        var t = eng.c.currentTime, g = v.out.gain;
        g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(0, t + 0.005);
        v.srcs.forEach(function (s) { try { s.stop(t + 0.01); } catch (e) { /* already stopped */ } });
      } catch (e) { cleanup(v); }
    }
    // build one voice of a recipe on engine e at time t (shared by live play and render)
    function voice(e, name, arg, t, track) {
      var c = e.c, out = c.createGain(), v = { c: c, out: out, srcs: [], nodes: [], left: 0, done: false };
      out.gain.value = 1; out.connect(e.master);
      v.src = function (s, t0, t1) {
        v.srcs.push(s); v.left++;
        for (var i = 1; i < arguments.length; i++) if (arguments[i] && typeof arguments[i] === "object") v.nodes.push(arguments[i]);
        v.nodes.push(s);
        s.onended = function () { if (--v.left <= 0) cleanup(v); };
        s.start(t0); s.stop(t1);
      };
      v.end = t + R[name](v, t, arg);
      if (track) voices.push(v);
      return v;
    }
    function prune() {
      var t = eng.c.currentTime;
      for (var i = voices.length - 1; i >= 0; i--) if (voices[i].end + 0.05 < t) cleanup(voices[i]);
    }
    function play(name, arg) {
      if (!eng || !conf().sound || target() <= 0 || hidden()) return false;
      try {
        if (eng.c.state !== "running") return false;
        var ms = now();
        if (last[name] != null && ms - last[name] < SAME_MS) return false;
        last[name] = ms;
        prune();
        while (voices.length >= MAX_VOICES) cut(voices[0]);
        voice(eng, name, arg, eng.c.currentTime + 0.005, true);
        return true;
      } catch (e) { return false; }
    }

    function buzz(kind) {
      var pat = BUZZ[kind];
      if (!pat || !conf().haptics || hidden()) return false;
      var nav = null; try { nav = w.navigator; } catch (e) { nav = null; }
      if (!nav || typeof nav.vibrate !== "function") return false;
      var ms = now(); if (ms - lastBuzz < BUZZ_MS) return false;
      lastBuzz = ms;
      try { return nav.vibrate(pat) !== false; } catch (e) { return false; }
    }

    // render(name, arg, o): the sound through the same graph in an OfflineAudioContext.
    // Resolves { peak, clipped, len } or null when OfflineAudioContext is missing. o.volume (0..1, default 1).
    function render(name, arg, o) {
      o = o || {};
      var OAC = null; try { OAC = w.OfflineAudioContext || w.webkitOfflineAudioContext || null; } catch (e) { OAC = null; }
      if (!OAC || !R[name]) return Promise.resolve(null);
      try {
        var sr = 44100, c = new OAC(1, Math.ceil(sr * (o.seconds || 1.5)), sr), e = graph(c);
        e.master.gain.value = (o.volume == null ? 1 : o.volume) * 0.5;
        voice(e, name, arg, 0, false);
        return c.startRendering().then(function (buf) {
          var d = buf.getChannelData(0), pk = 0, clip = false, i, a;
          for (i = 0; i < d.length; i++) { a = Math.abs(d[i]); if (a > pk) pk = a; if (a >= 1 || a !== a) clip = true; }
          return { peak: pk, clipped: clip, len: d.length };
        });
      } catch (e) { return Promise.resolve(null); }
    }

    var A = {
      NAMES: NAMES.slice(), note: note, unlock: unlock, buzz: buzz, render: render,
      ready: function () { return !!(eng && eng.c.state === "running"); },
      stats: function () {
        if (eng) try { prune(); } catch (e) { /* closed */ }
        return { contexts: made, state: eng ? eng.c.state : "none", voices: voices.length,
          master: eng ? eng.master.gain.value : 0, target: target() };
      },
    };
    NAMES.forEach(function (n) { A[n] = function (arg) { return play(n, arg); }; });
    return A;
  }

  if (typeof module === "object" && module.exports) module.exports = { make: make, note: note, NAMES: NAMES, BUZZ: BUZZ };
  if (typeof window !== "undefined" && root === window) window.NumbericsAudio = make(window);
})(typeof window !== "undefined" ? window : this);
