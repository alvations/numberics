/* SPDX-License-Identifier: Apache-2.0 | Copyright 2026 alvations (Melon Lab)
 * Numberics boot (docs/design/REDESIGN.md 6.2). The first script in <head>, before any CSS, synchronous, so the page
 * paints in the right theme at once: reads numberics_settings_v1 (try/catch: sandboxes throw) and sets
 * <html data-theme data-text data-contrast data-motion> and meta[name=theme-color]. Unknown or malformed fields fall
 * back to the default one by one. Motion and theme "auto" follow the device, and keep following it while the page is open.
 * settings.js re-runs NumbericsBoot.apply() after a change. */
(function (w) {
  "use strict";
  var KEY = "numberics_settings_v1", DEF = { motion: "auto", theme: "dark", text: "normal", contrast: "normal" };
  var OK = { motion: ["auto", "reduced", "full"], theme: ["dark", "light", "auto"], text: ["normal", "large"], contrast: ["normal", "high"] };
  var COLOR = { dark: "#12131a", light: "#f5f1e8" };
  function read() {
    var raw = null, out = {}, k;
    try { raw = JSON.parse(w.localStorage.getItem(KEY)); } catch (e) { raw = null; }
    if (!raw || typeof raw !== "object") raw = {};
    for (k in DEF) out[k] = OK[k].indexOf(raw[k]) >= 0 ? raw[k] : DEF[k];
    return out;
  }
  function query(q) { try { return w.matchMedia ? w.matchMedia(q) : null; } catch (e) { return null; } }
  function matches(q) { var m = query(q); return !!(m && m.matches); }
  var watching = false;
  function apply(s) {
    s = s || read();
    var doc = w.document, h = doc.documentElement, d = h.dataset;
    var theme = s.theme === "auto" ? (matches("(prefers-color-scheme: light)") ? "light" : "dark") : s.theme;
    var motion = s.motion === "auto" ? (matches("(prefers-reduced-motion: reduce)") ? "reduced" : "full") : s.motion;
    d.theme = theme; d.text = s.text; d.contrast = s.contrast; d.motion = motion;
    var meta = doc.querySelector && doc.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", COLOR[theme]);
    if (!watching && (s.theme === "auto" || s.motion === "auto")) {
      watching = true;
      ["(prefers-color-scheme: light)", "(prefers-reduced-motion: reduce)"].forEach(function (q) {
        var m = query(q);
        try { if (m && m.addEventListener) m.addEventListener("change", function () { apply(); }); } catch (e) { /* old browsers */ }
      });
    }
    return { theme: theme, motion: motion, text: s.text, contrast: s.contrast };
  }
  w.NumbericsBoot = { KEY: KEY, read: read, apply: apply };
  apply();
})(typeof window !== "undefined" ? window : this);
