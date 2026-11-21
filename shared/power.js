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

  // Tray: defs = [{id, label, desc, earn?}] (exactly 4, Undo first). desc: "Take back the last move."
  // opts = {armed, disabled(id) -> bool | reason string, onUse(id), earn: "How to earn charges.", hint: element,
  //         onInfo(id, text)}. Buttons are never `disabled`: a button that cannot act now gets
  //         aria-disabled + class "empty", and a tap explains it instead (phones have no hover).
  function info(d, s, why, opts) {
    var t = d.label + ": " + (d.desc || d.title || "") + " ";
    if (typeof why === "string" && why) t += why;
    else if (!s[d.id]) t += (d.earn || opts.earn || "");
    return t.trim();
  }
  function tray(el, defs, s, opts) {
    opts = opts || {};
    el.textContent = "";
    defs.forEach(function (d, i) {
      var b = document.createElement("button");
      var why = opts.disabled ? opts.disabled(d.id) : false;
      var empty = !s[d.id] || !!why;
      b.type = "button"; b.className = "pw" + (opts.armed === d.id ? " armed" : "") + (empty ? " empty" : "");
      if (empty) b.setAttribute("aria-disabled", "true");
      b.appendChild(document.createTextNode(d.label));
      var n = document.createElement("i"); n.textContent = s[d.id] || 0; b.appendChild(n);
      b.title = (i + 1) + ": " + d.label + ". " + (d.desc || d.title || "");
      b.setAttribute("aria-label", d.label + ", " + (s[d.id] || 0) + " left. " + (d.desc || d.title || ""));
      b.addEventListener("click", function () {
        if (empty) {
          var t = info(d, s, why, opts);
          if (opts.onInfo) opts.onInfo(d.id, t); else if (opts.hint) opts.hint.textContent = t;
          return;
        }
        // arming or using a power-up clears any toast, so targeting instructions are never covered
        try { if (typeof NumbericsKit !== "undefined") NumbericsKit.clearToast(); } catch (e) { /* no kit */ }
        if (opts.onUse) opts.onUse(d.id);
      });
      el.appendChild(b);
    });
  }
  return { CAP: CAP, stock: stock, total: total, award: award, spend: spend, tray: tray, info: info };
});
