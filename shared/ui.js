/* SPDX-License-Identifier: Apache-2.0 | Copyright 2026 alvations (Melon Lab)
 * NumbericsUI (docs/design/REDESIGN.md 3.2, 3.6). Builds the top bar into <div id="topbar" data-root="../"></div>:
 * the family mark (a link home) and the Games, Trophies and Settings buttons. A1: the sheet primitive is a STUB
 * (sheet() does nothing, open() is false); B1 fills it in. Until the Games sheet exists (C1), Games scrolls to the
 * games row at the bottom of the page. Loaded last, after nav.js. */
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
  function sheet(id, build) { return null; }   // B1: open the sheet `id`, built by build(el)
  function open() { return false; }            // B1: true while a sheet is open (games ignore their keys then)
  function close() {}
  w.NumbericsUI = { topbar: topbar, sheet: sheet, open: open, close: close, dot: dot };
  topbar();
})(typeof window !== "undefined" ? window : this);
