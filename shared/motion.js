/* SPDX-License-Identifier: Apache-2.0 | Copyright 2026 alvations (Melon Lab)
 * NumbericsMotion (REDESIGN.md 5.2, 5.11 to 5.13): timing tokens, the effective motion, a guarded timeline, the identity
 * tracker and the keyed tile layer. Only transform and opacity animate. Notes: docs/CODE-NOTES.md#sharedmotionjs */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(root);
  else root.NumbericsMotion = factory(root);
})(typeof self !== "undefined" ? self : this, function (w) {
  "use strict";
  var T = { slide: 110, pop: 180, appear: 170, fade: 160, plus: 640, sheet: 240,
    step: 100,
    fallBase: 70, fallK: 60, settle: 160, waveGap: 60, popOut: 160,
    fly: 260, burst: 420, pipOut: 180, pipStagger: 30, claim: 240, line: 360, flip: 160,
    place: 140, unitSweep: 360, unitStagger: 40, solveStagger: 18, think: 0 };
  var E = { slide: "cubic-bezier(.45,0,.55,1)", out: "cubic-bezier(.2,.8,.2,1)", pop: "cubic-bezier(.3,1.5,.6,1)",
    fall: "cubic-bezier(.55,0,1,.45)", fly: "cubic-bezier(.3,.7,.2,1)" };
  var KEEP = { fade: 1, plus: 1, sheet: 1 }; // opacity only under reduced motion, so they keep their length
  var MOTION_PROPS = { transform: 1, translate: 1, scale: 1, rotate: 1, offsetDistance: 1, offsetPath: 1 };

  // ---- effective motion (5.12, 6.2): Settings first, then the device; read at each animation, never cached ----
  function reduced() {
    var m = null;
    try { if (w.NumbericsSettings && w.NumbericsSettings.get) m = w.NumbericsSettings.get().motion; } catch (e) { m = null; }
    if (m === "reduced") return true;
    if (m === "full") return false;
    var os = null, attr = null;
    try { if (w.matchMedia) os = !!w.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { os = null; }
    try { attr = w.document.documentElement.dataset.motion || null; } catch (e) { attr = null; } // set by boot.js
    if (m === "auto" && os !== null) return os;          // "Device": the OS, live
    if (attr === "reduced" || attr === "full") return attr === "reduced"; // no settings module: boot already resolved it
    return !!os;
  }
  function ms(name) { return reduced() && !KEEP[name] ? 0 : (T[name] || 0); }
  // gravity: the fall time grows with the square root of the distance. 1 row 130 ms, 6 rows 217 ms, 7 rows 229 ms.
  function fallMs(rows) { return Math.round(T.fallBase + T.fallK * Math.sqrt(Math.max(0, +rows || 0))); }

  // ---- play: el.animate, or under reduced motion the opacity-only frames (at most T.fade long), or nothing ----
  function opacityOnly(frames) {
    return frames.map(function (f) {
      var o = {}, k; for (k in f) if (!MOTION_PROPS[k]) o[k] = f[k]; return o;
    });
  }
  function play(el, frames, opts, reducedFrames) {
    if (!el || typeof el.animate !== "function") return null;
    var o = {}, k; opts = typeof opts === "number" ? { duration: opts } : (opts || {});
    for (k in opts) o[k] = opts[k];
    if (reduced()) {
      if (!reducedFrames) return null;
      frames = opacityOnly(reducedFrames);
      o.duration = Math.min(o.duration == null ? T.fade : o.duration, T.fade);
      o.easing = "linear";
    }
    try { return el.animate(frames, o); } catch (e) { return null; }
  }

  // ---- sounds (TRIAGE4 D7): a finish plays the pending sounds at once, one of each, never dropped ----
  var dedup = null; // the names played by the finish() that is running now, or null
  function audio(name, arg) {
    var A = (w && w.NumbericsAudio) || (typeof globalThis !== "undefined" && globalThis.NumbericsAudio) || null;
    if (!A || typeof A[name] !== "function") return;
    try { A[name](arg); } catch (e) { /* a sound is a nicety */ }
  }
  function sfx(name, arg) {
    if (dedup) { if (dedup[name]) return; dedup[name] = 1; }
    audio(name, arg);
  }
  function buzz(kind) {
    if (dedup) { if (dedup["buzz:" + kind]) return; dedup["buzz:" + kind] = 1; }
    audio("buzz", kind);
  }
  // together(fn, set): run fn with its sounds deduplicated by name as one group
  function together(fn, set) {
    if (dedup) return fn();
    dedup = set || {};
    try { return fn(); } finally { dedup = null; }
  }

  // ---- seq: a generation-guarded timeline: at(ms, fn), sound(ms, fn), finish(interrupted), cancel(), finishing().
  // The D7 sound rule in full: docs/CODE-NOTES.md#sharedmotionjs ----
  function seq() {
    var q = [], gen = 0, n = 0, running = false, fast = null, fastT = null; // fast: the at-once group, or null
    function fire(item) {
      var i = q.indexOf(item); if (i < 0) return;
      q.splice(i, 1); item.fn();
    }
    function hurry() { // fast play for the rest of this input's task: its sound steps play at once, one of each
      fast = {};
      if (fastT !== null) clearTimeout(fastT);
      fastT = setTimeout(function () { fast = null; fastT = null; }, 0);
    }
    var s = {
      at: function (msec, fn) {
        var item = { t: Math.max(0, +msec || 0), n: n++, fn: fn, g: gen }, me = this;
        q.push(item);
        if (!running) item.h = setTimeout(function () { if (item.g === gen) fire(item); }, item.t);
        return me;
      },
      sound: function (msec, fn) {
        if (fast && !running) { together(fn, fast); return this; }
        return this.at(msec, fn);
      },
      finish: function (interrupted) {
        var guard = 0, had = q.length > 0;
        running = true;
        try {
          together(function () {
            while (q.length && guard++ < 10000) {
              q.sort(function (a, b) { return a.t - b.t || a.n - b.n; });
              var item = q.shift(); if (item.h != null) clearTimeout(item.h); item.fn();
            }
          });
        } finally { running = false; gen++; q.length = 0; }
        if (had || interrupted === true) hurry();
        return this;
      },
      cancel: function () {
        q.forEach(function (it) { if (it.h != null) clearTimeout(it.h); }); q.length = 0; gen++; return this;
      },
      busy: function () { return q.length > 0; },
      finishing: function () { return running; },
      fast: function () { return !!fast; }
    };
    return s;
  }

  // ---- track (pure): an engine trace -> tile identities; a merge makes a NEW id ----
  function track(ids, trace, spawned, nextId) {
    ids = ids || []; trace = trace || [];
    var next = +nextId || 1, used = {}, i;
    for (i = 0; i < ids.length; i++) if (ids[i] && ids[i] >= next) next = ids[i] + 1;
    var out = ids.slice(), moves = [], merges = [], spawns = [], moved = {}, byTo = {};
    function idAt(cell) { if (!ids[cell]) { ids = ids.slice(); ids[cell] = next++; } return ids[cell]; }
    trace.forEach(function (t) { if (!used[t.from]) { used[t.from] = 1; idAt(t.from); } });
    trace.forEach(function (t) { out[t.from] = 0; });
    trace.forEach(function (t) {
      var id = ids[t.from];
      if (t.from !== t.to || t.merge) moves.push({ id: id, from: t.from, to: t.to });
      (byTo[t.to] = byTo[t.to] || []).push({ id: id, merge: !!t.merge });
      moved[t.to] = 1;
    });
    Object.keys(byTo).map(Number).sort(function (a, b) { return a - b; }).forEach(function (to) {
      var arr = byTo[to], m = arr.some(function (x) { return x.merge; });
      if (m) {
        var nid = next++; out[to] = nid;
        merges.push({ id: nid, to: to, from: arr.map(function (x) { return x.id; }) });
        arr.forEach(function (x) { moves.forEach(function (mv) { if (mv.id === x.id) mv.merge = true; }); });
      } else out[to] = arr[arr.length - 1].id;
    });
    var sp = Array.isArray(spawned) ? spawned : (spawned == null || spawned < 0 ? [] : [spawned]);
    sp.forEach(function (cell) { if (cell == null || cell < 0) return; var nid = next++; out[cell] = nid; spawns.push({ id: nid, cell: cell }); });
    return { ids: out, moves: moves, merges: merges, spawns: spawns, next: next };
  }
  // Undo, load, New game, Smash, Swap, Boost: give every filled cell a fresh id, so the layer swaps nodes without a slide.
  function rekey(cells, nextId) {
    var next = +nextId || 1, ids = [];
    for (var i = 0; i < cells.length; i++) ids[i] = cells[i] ? next++ : 0;
    return { ids: ids, next: next };
  }

  // ---- layer: the keyed tile layer (5.2). opts = { cols, rows, make(tile), paint(node, tile), slide, clip } ----
  function layer(el, opts) {
    opts = opts || {};
    if (!el || !el.classList) // no board (a page without one, or Node): an inert layer, so callers never need a guard
      return { sync: function () {}, finish: function () {}, busy: function () { return false; }, get: function () { return null; }, count: function () { return 0; } };
    var cols = opts.cols || 4, rows = opts.rows || cols, slide = opts.slide || T.slide;
    var doc = el.ownerDocument || w.document;
    var nodes = {}, last = {}, gone = [], anims = [], flagged = [], timer = null, gen = 0, moving = false;
    el.classList.add("nmm-layer");
    if (opts.clip) el.classList.add("nmm-clip");
    el.style.setProperty("--cols", cols); el.style.setProperty("--rows", rows);
    if (opts.slide) el.style.setProperty("--nmm-slide", slide + "ms");

    function cellOf(t) {
      if (t.r != null && t.c != null) return { r: t.r, c: t.c };
      return { r: Math.floor(t.cell / cols), c: t.cell % cols };
    }
    function face(node) { return node.querySelector(".face") || node; }
    function defMake() {
      var t = doc.createElement("div"), f = doc.createElement("div");
      f.className = "face"; t.appendChild(f); return t;
    }
    function defPaint(node, t) {
      face(node).textContent = t.label != null ? t.label : (t.v != null ? t.v : "");
      if (t.h != null) node.style.setProperty("--h", t.h);
    }
    var make = opts.make || defMake, paint = opts.paint || defPaint;
    function same(a, b) {
      if (!a) return false;
      var k; for (k in b) if (k !== "cell" && k !== "r" && k !== "c" && a[k] !== b[k]) return false;
      for (k in a) if (k !== "cell" && k !== "r" && k !== "c" && !(k in b)) return false;
      return true;
    }
    function place(node, rc) { // returns true when a placed node changes its cell (a slide, unless snapped or reduced)
      var ch = false;
      if (node._r !== rc.r) { ch = node._r != null; node.style.setProperty("--r", rc.r); node._r = rc.r; }
      if (node._c !== rc.c) { ch = ch || node._c != null; node.style.setProperty("--c", rc.c); node._c = rc.c; }
      return ch;
    }
    function flag(node, cls) { node.classList.add(cls); flagged.push([node, cls]); }
    function metrics() { // one read per sync, before any style write of that sync (5.13)
      var W = el.clientWidth, H = el.clientHeight, gap = 0;
      try { gap = parseFloat(w.getComputedStyle(el).getPropertyValue("--gap")) || 0; } catch (e) { gap = 0; }
      return { x: (W - (cols - 1) * gap) / cols + gap, y: (H - (rows - 1) * gap) / rows + gap };
    }
    function anim(node, frames, o) {
      if (typeof node.animate !== "function") return;
      try { anims.push(node.animate(frames, o)); } catch (e) { /* no WAAPI */ }
    }

    function finish() {
      if (timer !== null) { clearTimeout(timer); timer = null; }
      gen++; moving = false;
      for (var i = 0; i < gone.length; i++) if (gone[i].parentNode) gone[i].parentNode.removeChild(gone[i]);
      gone = [];
      for (i = 0; i < flagged.length; i++) flagged[i][0].classList.remove(flagged[i][1]);
      flagged = [];
      for (i = 0; i < anims.length; i++) { try { anims[i].finish(); } catch (e) { /* already gone */ } }
      for (i = 0; i < anims.length; i++) { try { anims[i].cancel(); } catch (e) { /* already gone */ } }
      anims = [];
      // in-flight slides are not snapped: a CSS transition retargets smoothly from where the tile is
    }

    // sync(tiles, fx): fx = { merges, spawns, enter, falls, out, pop, fade }, all optional (CODE-NOTES.md)
    function sync(tiles, fx) {
      fx = fx || {};
      var red = reduced(), i, k;
      var needM = !red && ((fx.falls && fx.falls.length) || (fx.enter && Object.keys(fx.enter).length)), mt = needM ? metrics() : null;
      finish();
      var g = gen;
      el.classList.toggle("nmm-reduced", red);
      var merged = {}, from = {}, spawn = {}, outs = {}, pops = {}, falls = {}, enter = fx.enter || {}, longest = 0;
      (fx.merges || []).forEach(function (m) { merged[m.id] = 1; (m.from || []).forEach(function (id) { from[id] = m.to; }); });
      (fx.spawns || []).forEach(function (s) { spawn[s.id] = 1; });
      (fx.out || []).forEach(function (id) { outs[id] = 1; });
      (fx.pop || []).forEach(function (id) { pops[id] = 1; });
      (fx.falls || []).forEach(function (f) { if (f.rows > 0) falls[f.id] = f.rows; });
      var frag = null, seen = {}, slid = false;
      for (i = 0; i < tiles.length; i++) {
        var t = tiles[i], id = t.id, node = nodes[id], rc = cellOf(t), fresh = !node;
        seen[id] = 1;
        if (fresh) {
          node = make(t); node.classList.add("tile"); node.setAttribute("data-id", id);
          nodes[id] = node; paint(node, t); last[id] = t;
        } else if (!same(last[id], t)) { paint(node, t); last[id] = t; }
        if (falls[id] && !fresh) flag(node, "nmm-snap"); // the slot changes at once; the face carries the fall
        if (place(node, rc) && !red && !falls[id]) slid = true;
        if (fresh) { if (!frag) frag = doc.createDocumentFragment(); frag.appendChild(node); }
        if (merged[id]) {
          flag(node, "merged");
          // B2: the merged tile stays invisible until the slide lands, then it pops
          if (!red) anim(face(node), [{ opacity: 0 }, { opacity: 0 }], { duration: slide, fill: "none" });
        }
        else if (falls[id]) {
          if (red) { if (fresh) flag(node, "nmm-fadein"); }
          else {
            var d = fallMs(falls[id]);
            anim(face(node), [{ transform: "translateY(" + (-falls[id] * mt.y) + "px)" }, { transform: "translateY(0)" }], { duration: d, easing: E.fall });
            anim(face(node), [{ transform: "scale(1,1)" }, { transform: "scale(1.08,.9) translateY(4%)", offset: 0.35 },
              { transform: "scale(.97,1.03)", offset: 0.7 }, { transform: "scale(1,1)" }],
              { duration: T.settle, delay: d, easing: E.out, composite: "add" });
            longest = Math.max(longest, d + T.settle);
          }
        } else if (enter[id] && fresh) {
          if (red) flag(node, "nmm-fadein");
          else {
            var e0 = enter[id], dx = (e0.c - rc.c) * mt.x, dy = (e0.r - rc.r) * mt.y;
            anim(face(node), [{ transform: "translate(" + dx + "px," + dy + "px)", opacity: 0 }, { opacity: 1, offset: 0.4 },
              { transform: "translate(0,0)", opacity: 1 }], { duration: slide, easing: E.slide });
          }
        } else if (spawn[id]) flag(node, "new");
        else if (pops[id]) flag(node, "nmm-bump");
        else if (fresh && fx.fade) flag(node, "nmm-fadein");
      }
      if (frag) el.appendChild(frag);
      for (k in nodes) {
        if (seen[k]) continue;
        var n = nodes[k];
        delete nodes[k]; delete last[k];
        if (!red && from[k] != null) { place(n, cellOf({ cell: from[k] })); n.classList.add("gone"); gone.push(n); }
        else if (outs[k]) { n.classList.add("gone", "nmm-out"); gone.push(n); }
        else if (n.parentNode) n.parentNode.removeChild(n);
      }
      // busy() is true only while something really moves or plays (a re-key with no fade shows the board at once)
      moving = slid || gone.length > 0 || anims.length > 0 || flagged.some(function (f) { return f[1] !== "nmm-snap"; });
      var wait = red ? T.fade : slide + Math.max(T.pop, T.appear) + 30; // 320 ms for Two's beats
      wait = Math.max(wait, longest + 30);
      timer = setTimeout(function () { if (g === gen) { timer = null; finish(); } }, wait);
    }
    return {
      sync: sync,
      finish: finish,
      busy: function () { return timer !== null && moving; },
      get: function (id) { return nodes[id] || null; },
      count: function () { return el.querySelectorAll(":scope > .tile").length; }
    };
  }

  return { T: T, E: E, reduced: reduced, ms: ms, fallMs: fallMs, play: play, seq: seq, sfx: sfx, buzz: buzz, together: together, track: track, rekey: rekey, layer: layer };
});
