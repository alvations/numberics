/* SPDX-License-Identifier: Apache-2.0 | Copyright 2026 alvations (Melon Lab)
 * NumbericsMotion (docs/design/REDESIGN.md 5.2). A1 STUB: the timing and easing tables and fallMs are final; play, seq,
 * track and layer are safe no-ops with the spec's signatures until B2 fills them in. UMD so Node tests can require it. */
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
  function reduced() {
    try { return w.document.documentElement.dataset.motion === "reduced"; } catch (e) { return false; }
  }
  function ms(name) { return reduced() && !KEEP[name] ? 0 : (T[name] || 0); }
  function fallMs(rows) { return Math.round(T.fallBase + T.fallK * Math.sqrt(rows)); }
  function play(el, frames, opts, reducedFrames) { return null; }          // B2: el.animate wrapper
  function seq() { return { at: function (msec, fn) { return this; }, finish: function () {}, cancel: function () {} }; } // B2
  function track(ids, trace, spawned, nextId) { return { ids: ids, moves: [], merges: [], spawns: [] }; } // B2
  function layer(el, opts) { return { sync: function (tiles, fx) {}, finish: function () {}, busy: function () { return false; } }; } // B2
  return { T: T, E: E, reduced: reduced, ms: ms, fallMs: fallMs, play: play, seq: seq, track: track, layer: layer };
});
