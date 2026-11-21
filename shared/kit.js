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

  // storage: always try/catch, degrade to memory. Writes are batched into one idle write, flushed on leaving; freeze()
  // is for Memory (TRIAGE4 D6, B1). Keep it this way: docs/CODE-NOTES.md#sharedkitjs
  var PEND = {}, BASE = {}, pendN = 0, idleT = null, frozen = false, leaving = true;
  function hasWin() { return typeof window !== "undefined" && window; }
  function writeNow(key, text) { try { window.localStorage.setItem(key, text); } catch (e) { /* in-memory only */ } }
  function peek(key) { try { return window.localStorage.getItem(key); } catch (e) { return null; } }
  function flush() {
    if (idleT !== null) { try { (window.cancelIdleCallback || clearTimeout)(idleT); } catch (e) { /* gone */ } idleT = null; }
    if (frozen || !pendN) return;
    var all = PEND, base = BASE; PEND = {}; BASE = {}; pendN = 0;
    for (var k in all) if (peek(k) === base[k]) writeNow(k, all[k]);
  }
  function schedule() {
    if (idleT !== null || !hasWin()) return;
    try {
      idleT = window.requestIdleCallback ? window.requestIdleCallback(function () { idleT = null; flush(); }, { timeout: 1000 })
        : setTimeout(function () { idleT = null; flush(); }, 300);
    } catch (e) { idleT = null; flush(); }
  }
  if (hasWin() && window.addEventListener) {
    try {
      leaving = document.visibilityState === "hidden";
      window.addEventListener("pagehide", function () { leaving = true; flush(); }, true);
      window.addEventListener("pageshow", function () { leaving = false; }, true);
      document.addEventListener("visibilitychange", function () {
        leaving = document.visibilityState === "hidden"; if (leaving) flush();
      }, true);
    } catch (e) { leaving = true; /* no events: every save is written at once */ }
  }
  function freeze() { frozen = true; PEND = {}; BASE = {}; pendN = 0; }
  function thaw() { frozen = false; }
  function store(key) {
    var mem = null;
    return {
      load: function () {
        if (Object.prototype.hasOwnProperty.call(PEND, key)) { try { return JSON.parse(PEND[key]); } catch (e) { /* fall through */ } }
        try { var v = window.localStorage.getItem(key); if (v) return JSON.parse(v); } catch (e) { /* fall through */ }
        try { return mem ? JSON.parse(mem) : null; } catch (e) { return null; }
      },
      save: function (obj) {
        mem = JSON.stringify(obj);
        if (frozen) return;                                // Memory is reloading the page: nothing may overwrite it
        if (leaving) { if (Object.prototype.hasOwnProperty.call(PEND, key)) { delete PEND[key]; delete BASE[key]; pendN--; } writeNow(key, mem); return; }
        if (!Object.prototype.hasOwnProperty.call(PEND, key)) { pendN++; BASE[key] = peek(key); }
        PEND[key] = mem; schedule();
      },
    };
  }
  function reducedMotion() {
    try { return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch (e) { return false; }
  }
  var toastT = null;
  // toast(msg): a reward (gold); kind "bad": a warning (red edge); "info": a plain note. An element may be passed too.
  function toast(msg, kind, el) {
    if (kind && typeof kind === "object") { el = kind; kind = null; }
    el = el || document.getElementById("toast"); if (!el) return;
    if (overlayUp() || sheetUp()) { el.classList.remove("on"); return; } // never on an end screen, never over a sheet (TRIAGE5 S1)
    el.textContent = msg; el.classList.toggle("bad", kind === "bad"); el.classList.toggle("info", kind === "info"); el.classList.toggle("trophy", kind === "trophy");
    place(el); el.classList.add("on");
    clearTimeout(toastT); toastT = setTimeout(function () { el.classList.remove("on"); }, 2200);
    shownAt = Date.now(); watchOverlay(el); watchHint(el);
  }
  // sit just above the board, over the hint line while it is empty; never over the hint's text (TRIAGE5 S1)
  function place(el) {
    try {
      var b = document.querySelector("#board, .board"), r = b && b.getBoundingClientRect();
      if (r && r.height) {
        var h = el.offsetHeight || 34, hint = document.getElementById("hint"), hr = hint && hint.getBoundingClientRect();
        var lane = hr && hr.height && hr.bottom <= r.top + 2, txt = hintText(hint);
        var top = lane && !txt ? hr.top + hr.height / 2 - h / 2 : lane ? r.top + 8 : r.top - h - 6;
        if (top < 12) top = r.top + 8;
        var tries = [top, r.top + 8, hr ? hr.bottom + 6 : top, hr ? hr.top - h - 6 : top], i, t = null;
        for (i = 0; i < tries.length; i++) {
          var c = Math.max(12, Math.min(window.innerHeight - h - 12, tries[i]));
          if (!txt || !hr || c + h <= hr.top || c >= hr.bottom) { t = c; break; }
        }
        el.style.top = (t == null ? Math.max(12, Math.min(window.innerHeight - h - 12, top)) : t) + "px";
      }
    } catch (e) { /* keep the CSS position */ }
  }
  // the hint line shows text (a visible #hint with anything but blanks)
  function hintText(hint) { return !!(hint && hint.offsetParent !== null && /\S/.test(hint.textContent || "")); }
  // a sheet (Games, Trophies, Settings, How to play) is open: no toast shows over it (TRIAGE5 S1, craft #14)
  function sheetUp() {
    try { if (window.NumbericsUI && typeof window.NumbericsUI.open === "function") return !!window.NumbericsUI.open(); } catch (e) { /* no ui */ }
    return false;
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
      if (overlayUp() || sheetUp()) { el.classList.remove("on"); clearInterval(watchT); }
    }, 60);
  }
  // the status line always wins: a change of the hint text clears a toast over it (round 3 craft #1)
  var hintObs = null, shownAt = 0;
  function watchHint(el) {
    if (hintObs || typeof MutationObserver === "undefined") return;
    var hint = document.getElementById("hint"); if (!hint) return;
    var last = hint.textContent;
    hintObs = new MutationObserver(function () {
      var now = hint.textContent; if (now === last) return; last = now;
      // the same tick: move off the new text; a later change: hide it, only when it sits on the line
      if (!el.classList.contains("on")) return;
      if (Date.now() - shownAt <= 150) { place(el); return; } // the same tick: move off the new text
      var a = el.getBoundingClientRect(), b = hint.getBoundingClientRect();
      if (!(a.bottom <= b.top || a.top >= b.bottom) && hintText(hint)) el.classList.remove("on");
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
    // cancel the browser's gesture during a swipe, or it can swallow the next tap (round 3)
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
  return { rand: rand, rng: rng, freshSeed: freshSeed, daySeed: daySeed, store: store, flush: flush, freeze: freeze, thaw: thaw,
           frozen: function () { return frozen; }, reducedMotion: reducedMotion,
           toast: toast, clearToast: clearToast, twoStep: twoStep, swipe: swipe, arrowKey: arrowKey, hue: hue, fmt: fmt, clock: clock };
});
