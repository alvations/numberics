/* SPDX-License-Identifier: Apache-2.0 | Copyright 2026 alvations (Melon Lab)
 * One power-up system for every Numberics game (docs/ROADMAP.md section 0a).
 * Pure stock helpers (engines use these, Node-testable) + a tray renderer (clients use this).
 * Rules: 4 slots; a run starts with one Undo (games may override); charges are earned by play, capped at 9;
 * Undo restores the whole snapshot INCLUDING the stock, so rewinding never farms; a power-up never earns one. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.NumbericsPower = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  var CAP = 9;
  function stock(names, start) {
    var s = {}; names.forEach(function (n) { s[n] = 0; });
    Object.keys(start || {}).forEach(function (n) { s[n] = start[n]; });
    return s;
  }
  function total(s) { return Object.keys(s).reduce(function (a, k) { return a + s[k]; }, 0); }
  // Award one charge chosen by r in [0,1) among `names` still under the cap. Returns the name, or null.
  function award(s, names, r) {
    var open = names.filter(function (n) { return (s[n] || 0) < CAP; });
    if (!open.length) return null;
    var n = open[Math.floor(r * open.length)]; s[n] = (s[n] || 0) + 1; return n;
  }
  function spend(s, name) { if (!s[name]) return false; s[name]--; return true; }

  // Tray: defs = [{id, label, title}] (exactly 4). opts = {armed, disabled(id) -> bool, onUse(id)}
  function tray(el, defs, s, opts) {
    opts = opts || {};
    el.textContent = "";
    defs.forEach(function (d, i) {
      var b = document.createElement("button");
      b.type = "button"; b.className = "pw" + (opts.armed === d.id ? " armed" : "");
      b.disabled = !s[d.id] || !!(opts.disabled && opts.disabled(d.id));
      b.appendChild(document.createTextNode(d.label));
      var n = document.createElement("i"); n.textContent = s[d.id] || 0; b.appendChild(n);
      b.title = (i + 1) + ": " + (d.title || d.label);
      b.setAttribute("aria-label", d.label + ", " + (s[d.id] || 0) + " left. " + (d.title || ""));
      b.addEventListener("click", function () { if (opts.onUse) opts.onUse(d.id); });
      el.appendChild(b);
    });
  }
  return { CAP: CAP, stock: stock, total: total, award: award, spend: spend, tray: tray };
});
