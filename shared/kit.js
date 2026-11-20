/* SPDX-License-Identifier: Apache-2.0 | Copyright 2026 alvations (Melon Lab)
 * Numberics shared client kit (browser global NumbericsKit). Pure helpers are also exported for Node. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.NumbericsKit = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  // mulberry32 as a pure step: rand(seed) -> [float in [0,1), nextSeed]. Keep seeds in game state.
  function rand(seed) {
    var a = (seed + 0x6d2b79f5) >>> 0, t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return [((t ^ (t >>> 14)) >>> 0) / 4294967296, a];
  }
  // mulberry32 as a closure, for generators that run to completion inside one call.
  function rng(seed) { var s = seed >>> 0; return function () { var r = rand(s); s = r[1]; return r[0]; }; }
  function freshSeed() {
    try { var a = new Uint32Array(1); window.crypto.getRandomValues(a); return a[0]; } catch (e) { return Date.now() >>> 0; }
  }
  // date seed for Daily modes: same for everyone on the same local date
  function daySeed(d) { d = d || new Date(); return (d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate()) >>> 0; }

  // storage: always try/catch, degrade to memory (sandboxes throw)
  function store(key) {
    var mem = null;
    return {
      load: function () {
        try { var v = window.localStorage.getItem(key); if (v) return JSON.parse(v); } catch (e) { /* fall through */ }
        try { return mem ? JSON.parse(mem) : null; } catch (e) { return null; }
      },
      save: function (obj) {
        mem = JSON.stringify(obj);
        try { window.localStorage.setItem(key, mem); } catch (e) { /* in-memory only */ }
      },
    };
  }
  function reducedMotion() {
    try { return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch (e) { return false; }
  }
  var toastT = null;
  // toast(msg) is a reward (gold); toast(msg, "bad") is a warning or loss (neutral, red edge);
  // toast(msg, "info") is a plain explanation (neutral).
  // An element may still be passed as the second or third argument.
  function toast(msg, kind, el) {
    if (kind && typeof kind === "object") { el = kind; kind = null; }
    el = el || document.getElementById("toast"); if (!el) return;
    el.textContent = msg; el.classList.toggle("bad", kind === "bad"); el.classList.toggle("info", kind === "info");
    // sit just inside the top of the board: never over the title, the controls or the games row
    try {
      var b = document.querySelector("#board, .board"), r = b && b.getBoundingClientRect();
      if (r && r.height) el.style.top = Math.max(12, Math.min(window.innerHeight - 60, r.top + 10)) + "px";
    } catch (e) { /* keep the CSS position */ } el.classList.add("on");
    clearTimeout(toastT); toastT = setTimeout(function () { el.classList.remove("on"); }, 2200);
  }
  // Two-step destructive button ("New game" -> "Sure? ..."), no blocking confirm() dialog.
  function twoStep(btn, isRisky, onGo, sureLabel) {
    var label = btn.textContent, armed = null;
    btn.addEventListener("click", function () {
      if (isRisky() && !armed) {
        btn.textContent = sureLabel || "Sure? This ends the run";
        armed = setTimeout(function () { armed = null; btn.textContent = label; }, 3000); return;
      }
      clearTimeout(armed); armed = null; btn.textContent = label; onGo();
    });
  }
  // Swipe on an element: cb("left"|"right"|"up"|"down"); taps (<24px) are ignored.
  function swipe(el, cb) {
    var sx = 0, sy = 0, on = false;
    el.addEventListener("touchstart", function (e) { var t = e.changedTouches[0]; sx = t.clientX; sy = t.clientY; on = true; }, { passive: true });
    el.addEventListener("touchend", function (e) {
      if (!on) return; on = false;
      var t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
      cb(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up"));
    }, { passive: true });
  }
  var ARROWS = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down", a: "left", d: "right", w: "up", s: "down" };
  function arrowKey(e) { return ARROWS[e.key] || ARROWS[(e.key || "").toLowerCase()] || null; }
  // Endless palette: hue cycles forever so every level is distinct
  function hue(level) { return (level * 43 + 30) % 360; }
  function fmt(n) { return Number(n).toLocaleString("en-US"); }
  function clock(t) { return Math.floor(t / 60) + ":" + ("0" + (t % 60)).slice(-2); }
  return { rand: rand, rng: rng, freshSeed: freshSeed, daySeed: daySeed, store: store, reducedMotion: reducedMotion,
           toast: toast, twoStep: twoStep, swipe: swipe, arrowKey: arrowKey, hue: hue, fmt: fmt, clock: clock };
});
