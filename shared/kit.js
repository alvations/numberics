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
    if (overlayUp()) { el.classList.remove("on"); return; } // never on an end screen
    el.textContent = msg; el.classList.toggle("bad", kind === "bad"); el.classList.toggle("info", kind === "info"); el.classList.toggle("trophy", kind === "trophy");
    // Sit just above the board, over the hint line (round 2: inside the board it hid the top row;
    // at the top of the screen it hid the title). Fall back to inside the board when there is no room.
    try {
      var b = document.querySelector("#board, .board"), r = b && b.getBoundingClientRect();
      if (r && r.height) {
        // centre on the hint line when there is one (it sits between the tray and the board), else just above
        var h = el.offsetHeight || 34, hint = document.getElementById("hint"), hr = hint && hint.getBoundingClientRect();
        var top = (hr && hr.height && hr.bottom <= r.top + 2) ? hr.top + hr.height / 2 - h / 2 : r.top - h - 6;
        if (top < 12) top = r.top + 8;
        el.style.top = Math.max(12, Math.min(window.innerHeight - h - 12, top)) + "px";
      }
    } catch (e) { /* keep the CSS position */ } el.classList.add("on");
    clearTimeout(toastT); toastT = setTimeout(function () { el.classList.remove("on"); }, 2200);
    shownAt = Date.now(); watchOverlay(el); watchHint(el);
  }
  // A toast never sits on an end screen: while one shows, any visible .over overlay hides it at once.
  var watchT = null;
  function overlayUp() {
    var o = document.querySelectorAll(".over");
    for (var i = 0; i < o.length; i++) if (!o[i].hidden && o[i].offsetParent !== null) return true;
    return false;
  }
  function watchOverlay(el) {
    clearInterval(watchT);
    watchT = setInterval(function () {
      if (!el.classList.contains("on")) { clearInterval(watchT); return; }
      if (overlayUp()) { el.classList.remove("on"); clearInterval(watchT); }
    }, 60);
  }
  // The status line always wins: when the hint text changes (targeting instructions, "thinking", a result), any toast
  // over it clears at once (round 3 craft #1: the two were drawn over each other).
  var hintObs = null, shownAt = 0;
  function watchHint(el) {
    if (hintObs || typeof MutationObserver === "undefined") return;
    var hint = document.getElementById("hint"); if (!hint) return;
    var last = hint.textContent;
    hintObs = new MutationObserver(function () {
      var now = hint.textContent; if (now === last) return; last = now;
      // the same tick that raised the toast often redraws the hint: only a later change hides it
      if (Date.now() - shownAt > 150) el.classList.remove("on");
    });
    hintObs.observe(hint, { childList: true, characterData: true, subtree: true });
  }
  function clearToast(el) { el = el || document.getElementById("toast"); if (el) el.classList.remove("on"); }
  // Two-step destructive button ("New game" -> "Sure? ..."), no blocking confirm() dialog.
  function twoStep(btn, isRisky, onGo, sureLabel) {
    var label = btn.textContent, armed = null;
    btn.addEventListener("click", function () {
      if (isRisky() && !armed) {
        clearToast(); // a toast must never hide the warning
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
    // cancel the browser's own gesture while a swipe is in progress, otherwise it can swallow the next tap
    // (round 3: the first tap on a just-earned power-up was lost)
    el.addEventListener("touchmove", function (e) { if (on && e.cancelable) e.preventDefault(); }, { passive: false });
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
           toast: toast, clearToast: clearToast, twoStep: twoStep, swipe: swipe, arrowKey: arrowKey, hue: hue, fmt: fmt, clock: clock };
});
