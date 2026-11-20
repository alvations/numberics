/* SPDX-License-Identifier: Apache-2.0 | Copyright 2026 alvations (Melon Lab)
 * NumbericsSettings (docs/design/REDESIGN.md 6). A1 STUB: get() reads the settings like boot.js does; set() only
 * re-applies them for this page (no save) and fires numberics:settings; open() does nothing. B1 fills in saving,
 * the Settings sheet and Save / Load / Erase. The API below is the one games and modules may call now. */
(function (w) {
  "use strict";
  var DEF = { v: 1, sound: true, volume: 0.5, haptics: true, motion: "auto", theme: "dark", text: "normal", contrast: "normal" };
  var cur = null;
  function get() {
    if (cur) return Object.assign({}, cur);
    var s = Object.assign({}, DEF), b = w.NumbericsBoot ? w.NumbericsBoot.read() : {}, k;
    for (k in b) s[k] = b[k];
    return s;
  }
  function set(patch) {
    cur = Object.assign(get(), patch || {});
    if (w.NumbericsBoot) w.NumbericsBoot.apply(cur);
    try { w.dispatchEvent(new w.CustomEvent("numberics:settings", { detail: get() })); } catch (e) { /* no CustomEvent */ }
    return get();
  }
  function reducedMotion() {
    try { return w.document.documentElement.dataset.motion === "reduced"; } catch (e) { return false; }
  }
  function open() { /* B1: the Settings sheet */ }
  w.NumbericsSettings = { DEFAULTS: DEF, get: get, set: set, reducedMotion: reducedMotion, open: open };
})(typeof window !== "undefined" ? window : this);
