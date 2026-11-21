/* SPDX-License-Identifier: Apache-2.0 | Copyright 2026 alvations (Melon Lab)
 * NumbericsUI (docs/design/REDESIGN.md 3.2, 3.6). Builds the top bar into <div id="topbar" data-root="../"></div>:
 * the family mark (a link home) and the Games, Trophies and Settings buttons; and the one sheet primitive (3.6) that
 * Games, Trophies, Settings and How to play open in. Games opens NumbericsNav.openSheet() (shared/nav.js: Today and
 * every game card in games.json order); without nav.js it scrolls to the games list. Loaded last, after nav.js.
 *
 * Sheets: sheet(id, build, opts) opens the sheet `id` (one at a time; opening another replaces it), empties its body
 * and calls build(body) to fill it; opts.title (default from the id) and opts.onClose. Focus moves to the close button
 * and back to the opener on close; Tab is trapped; Esc, the close button and a scrim tap close it; the page behind
 * does not scroll, and no key reaches the game while it is open (games also check open()). Fires `numberics:sheet`
 * on window with detail { id, open } on open and on close (Sudoku pauses its clock on it). */
(function (w) {
  "use strict";
  var doc = w.document;
  var MARK = '<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="2" y="2" width="13" height="13" rx="3.5" fill="#f5bd4f"/>' +
    '<rect x="17" y="2" width="13" height="13" rx="3.5" fill="hsl(159 66% 62%)"/><rect x="2" y="17" width="13" height="13" rx="3.5" fill="hsl(202 66% 62%)"/>' +
    '<rect x="17" y="17" width="13" height="13" rx="3.5" fill="hsl(330 66% 62%)"/></svg>';
  var ICON = {
    games: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="6.5" height="6.5" rx="1.6"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.6"/>' +
      '<rect x="4" y="13.5" width="6.5" height="6.5" rx="1.6"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.6"/></svg>',
    trophies: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4h8v5a4 4 0 01-8 0z"/><path d="M8 6H5a3 3 0 003 4M16 6h3a3 3 0 01-3 4"/><path d="M12 13v4M9 20h6M10 17h4"/></svg>',
    settings: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8"/></svg>'
  };
  function games() {
    if (w.NumbericsNav && typeof w.NumbericsNav.openSheet === "function") return w.NumbericsNav.openSheet();
    var row = doc.getElementById("games"); if (!row) return;
    try { row.scrollIntoView({ block: "center" }); } catch (e) { row.scrollIntoView(); }
    var a = row.querySelector("a"); if (a) a.focus({ preventScroll: true });
  }
  var ACT = {
    games: games,
    trophies: function () { if (w.NumbericsTrophies) w.NumbericsTrophies.open(); },
    settings: function () { if (w.NumbericsSettings && w.NumbericsSettings.open) w.NumbericsSettings.open(); }
  };
  function topbar() {
    var el = doc.getElementById("topbar"); if (!el) return null;
    var root = el.getAttribute("data-root") || "";
    el.innerHTML = '<a class="tb-home" href="' + (root || "./") + '" aria-label="Numberics home, play Two">' + MARK + "Numberics</a>" +
      '<span class="tb-sp"></span>' +
      '<button class="tb-btn tb-games" type="button" data-open="games">' + ICON.games + "Games</button>" +
      '<button class="tb-btn" type="button" data-open="trophies" aria-label="Trophies">' + ICON.trophies + '<span class="tb-dot" hidden></span></button>' +
      '<button class="tb-btn" type="button" data-open="settings" aria-label="Settings">' + ICON.settings + "</button>";
    Array.prototype.forEach.call(el.querySelectorAll("[data-open]"), function (b) {
      b.addEventListener("click", function () { ACT[b.getAttribute("data-open")](); });
    });
    return el;
  }
  // the unseen-trophy dot on the cup (B4 calls this)
  function dot(on) { var d = doc.querySelector("#topbar .tb-dot"); if (d) d.hidden = !on; }
  // ---- sheets (REDESIGN.md 3.6) ----
  var TITLES = { games: "Games", trophies: "Trophies", settings: "Settings", howto: "How to play" };
  var X_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  var cur = null, hooked = false; // cur = { id, scrim, sheet, opener, onClose, overflow }
  function fire(id, on) { try { w.dispatchEvent(new w.CustomEvent("numberics:sheet", { detail: { id: id, open: on } })); } catch (e) { /* no CustomEvent */ } }
  function focusables(root) {
    return Array.prototype.filter.call(root.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'),
      function (e) { return !e.disabled && e.type !== "file" && e.offsetParent !== null; });
  }
  function hook() {
    if (hooked) return; hooked = true;
    // capture on window: runs before any game listener. Esc closes, Tab is trapped, and a key aimed outside the
    // sheet (focus left on the page) never reaches the game.
    w.addEventListener("keydown", function (e) {
      if (!cur) return;
      var inside = !!(e.target && e.target.nodeType === 1 && cur.sheet.contains(e.target));
      if (e.key === "Escape" || e.key === "Esc") { e.preventDefault(); e.stopPropagation(); close(); return; }
      if (e.key === "Tab") {
        var f = focusables(cur.sheet); if (!f.length) { e.preventDefault(); return; }
        var first = f[0], last = f[f.length - 1], a = doc.activeElement;
        if (!inside || (e.shiftKey && a === first) || (!e.shiftKey && a === last)) {
          e.preventDefault(); (e.shiftKey ? last : first).focus();
        }
        return;
      }
      if (!inside) { e.preventDefault(); e.stopPropagation(); }
    }, true);
  }
  function make(id) {
    var scrim = doc.createElement("div"), hid = "sh-" + id + "-h";
    scrim.className = "scrim"; scrim.id = "sh-" + id; scrim.hidden = true;
    scrim.innerHTML = '<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="' + hid + '"><div class="grab"></div>' +
      '<div class="sh-head"><h2 id="' + hid + '"></h2><button class="tb-btn sh-x" type="button" aria-label="Close">' + X_ICON + "</button></div>" +
      '<div class="sh-body"></div></div>';
    scrim.addEventListener("click", function (e) { if (e.target === scrim) close(); });
    scrim.querySelector(".sh-x").addEventListener("click", function () { close(); });
    // keys typed inside the sheet stay in it (games listen on document or window, in the bubble phase)
    // (only while this sheet is the open one: a key that reaches a closed sheet's node is the page's)
    scrim.addEventListener("keydown", function (e) { if (cur && cur.scrim === scrim) e.stopPropagation(); });
    doc.body.appendChild(scrim);
    return scrim;
  }
  function sheet(id, build, opts) {
    opts = opts || {};
    if (!doc || !doc.createElement || !doc.body) return null;
    hook();
    var opener = cur ? cur.opener : doc.activeElement;
    if (cur) close(true);
    var scrim = doc.getElementById("sh-" + id) || make(id), sh = scrim.querySelector(".sheet"), body = scrim.querySelector(".sh-body");
    scrim.querySelector("h2").textContent = opts.title || TITLES[id] || id;
    body.innerHTML = "";
    var h = doc.documentElement, toast = doc.getElementById("toast");
    cur = { id: id, scrim: scrim, sheet: sh, opener: opener, onClose: opts.onClose, overflow: h.style.overflow };
    h.style.overflow = "hidden";                 // the page behind does not scroll
    if (toast) toast.style.zIndex = "30";        // a toast raised from a sheet shows above the scrim
    scrim.hidden = false;
    if (typeof build === "function") build(body);
    var x = scrim.querySelector(".sh-x");
    try { x.focus({ preventScroll: true }); } catch (e) { x.focus(); }
    fire(id, true);
    return body;
  }
  function open() { return !!cur; }
  function current() { return cur ? cur.id : null; }
  function close(swap) {
    if (!cur) return;
    var c = cur; cur = null;
    c.scrim.hidden = true;
    doc.documentElement.style.overflow = c.overflow;
    var toast = doc.getElementById("toast"); if (toast) toast.style.zIndex = "";
    if (typeof c.onClose === "function") { try { c.onClose(); } catch (e) { /* keep closing */ } }
    if (swap !== true && c.opener && c.opener.focus && doc.contains(c.opener)) {
      try { c.opener.focus({ preventScroll: true }); } catch (e) { c.opener.focus(); }
    }
    // focus never stays on a node of the hidden sheet: when the opener could not take it (the body, or a sheet that
    // opened by itself), let it go now, so the very next key reaches the game (the browser would only drop it at the
    // next frame)
    var a = doc.activeElement;
    if (swap !== true && a && a !== doc.body && c.scrim.contains(a) && a.blur) a.blur();
    fire(c.id, false);
  }
  w.NumbericsUI = { topbar: topbar, sheet: sheet, open: open, current: current, close: close, dot: dot };
  topbar();
})(typeof window !== "undefined" ? window : this);
