/* SPDX-License-Identifier: Apache-2.0 | Copyright 2026 alvations (Melon Lab)
 * NumbericsUI (REDESIGN.md 3.2, 3.6): the top bar (home, Games, Sound, Trophies, Settings) and the one sheet primitive
 * that Games, Trophies, Settings and How to play open in. Loaded last. Notes: docs/CODE-NOTES.md#shareduijs */
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
    // a gear (TRIAGE4 D2: the old rays read as a sun, "brightness")
    settings: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 10.3L21.5 10.6L21.5 13.4L19 13.7L18.2 15.7L19.7 17.7L17.7 19.7L15.7 18.2L13.7 19L13.4 21.5' +
      'L10.6 21.5L10.3 19L8.3 18.2L6.3 19.7L4.3 17.7L5.8 15.7L5 13.7L2.5 13.4L2.5 10.6L5 10.3L5.8 8.3L4.3 6.3L6.3 4.3L8.3 5.8L10.3 5L10.6 2.5L13.4 2.5L13.7 5' +
      'L15.7 5.8L17.7 4.3L19.7 6.3L18.2 8.3z"/><circle cx="12" cy="12" r="3"/></svg>',
    sound: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path class="tb-on" d="M15.5 9.2a4 4 0 010 5.6M18 6.7a7.5 7.5 0 010 10.6"/>' +
      '<path class="tb-off" d="M16 9.5l5 5M21 9.5l-5 5"/></svg>'
  };
  function S() { return w.NumbericsSettings || null; }
  function isMuted() { try { return !!(S() && S().muted && S().muted()); } catch (e) { return false; } }
  // the Sound button shows the state: pressed = muted; its name says what a tap does
  function syncMute() {
    var b = doc.querySelector("#topbar .tb-mute"); if (!b) return;
    var m = isMuted();
    b.setAttribute("aria-pressed", String(m)); b.classList.toggle("muted", m);
    b.setAttribute("aria-label", "Mute sound and music");
    b.title = m ? "Sound and music are off" : "Sound and music are on";
  }
  function mute() {
    try { if (S() && S().toggleMute) S().toggleMute(); } catch (e) { /* settings are optional */ }
    syncMute();
    try { if (!isMuted() && w.NumbericsAudio && w.NumbericsAudio.tick) w.NumbericsAudio.tick(); } catch (e) { /* silent */ }
  }
  // on the games page it scrolls to the cards (TRIAGE5 S3); on a game page it opens the Games sheet
  function games() {
    var row = doc.getElementById("games"), home = !!(row && !row.getAttribute("data-current"));
    if (!home && w.NumbericsNav && typeof w.NumbericsNav.openSheet === "function") return w.NumbericsNav.openSheet();
    if (!row) return;
    var to = (home && doc.getElementById("more")) || row;
    try { to.scrollIntoView({ block: home ? "start" : "center" }); } catch (e) { to.scrollIntoView(); }
    var a = row.querySelector("a"); if (a) a.focus({ preventScroll: true });
  }
  var ACT = {
    games: games,
    mute: mute,
    trophies: function () { if (w.NumbericsTrophies) w.NumbericsTrophies.open(); },
    settings: function () { if (w.NumbericsSettings && w.NumbericsSettings.open) w.NumbericsSettings.open(); }
  };
  function topbar() {
    var el = doc.getElementById("topbar"); if (!el) return null;
    var root = el.getAttribute("data-root") || "";
    el.innerHTML = '<a class="tb-home" href="' + (root || "./") + '" aria-label="Numberics home">' + MARK + '<span class="tb-word">Numberics</span></a>' +
      '<span class="tb-sp"></span>' +
      '<button class="tb-btn tb-games" type="button" data-open="games" aria-label="Games">' + ICON.games + '<span class="tb-lbl">Games</span></button>' +
      '<button class="tb-btn tb-mute" type="button" data-open="mute" aria-pressed="false" aria-label="Mute sound and music">' + ICON.sound + "</button>" +
      '<button class="tb-btn" type="button" data-open="trophies" aria-label="Trophies">' + ICON.trophies + '<span class="tb-dot" hidden></span></button>' +
      '<button class="tb-btn" type="button" data-open="settings" aria-label="Settings">' + ICON.settings + "</button>";
    Array.prototype.forEach.call(el.querySelectorAll("[data-open]"), function (b) {
      b.addEventListener("click", function () { ACT[b.getAttribute("data-open")](); });
    });
    syncMute();
    if (!hookedMute) {
      hookedMute = true;
      try { if (S() && S().on) S().on("change", function (s, ch) { if (ch.indexOf("sound") >= 0 || ch.indexOf("music") >= 0) syncMute(); }); } catch (e) { /* no settings */ }
    }
    return el;
  }
  var hookedMute = false;
  // ---- end cards (REDESIGN.md 2.2): every .over card gets its game's glyph on top, once ----
  var GLYPH = { fibonacci: "spiral", two: "sq:2", endless: "sq:2", three: "sq:3", four: "disc:4", five: "sq:5", six: "sq:6",
    seven: "disc:7", nine: "sq:9", fifteen: "sq:15", sudoku: "grid" };
  function gameId() { var g = doc.getElementById("games"); return g ? g.getAttribute("data-current") || "" : ""; }
  function cardGlyphs(id) {
    var T = w.NumbericsTrophies, name = GLYPH[id || gameId()];
    if (!name || !T || typeof T.glyph !== "function" || !doc.querySelectorAll) return 0;
    var n = 0;
    Array.prototype.forEach.call(doc.querySelectorAll(".over"), function (o) {
      if (o.querySelector(":scope > .glyph")) return;
      o.insertAdjacentHTML("afterbegin", T.glyph(name).replace("<svg ", '<svg class="glyph" '));
      n++;
      // a card too tall scrolls with its buttons pinned; .over-more shows there is more
      var more = function () { o.classList.toggle("over-more", o.scrollTop + o.clientHeight < o.scrollHeight - 2); };
      o.addEventListener("scroll", more, { passive: true }); o.addEventListener("animationstart", more);
      o.addEventListener("animationend", more);
    });
    return n;
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
    // capture on window, before any game: Esc closes, Tab is trapped, a key outside the sheet never reaches the game
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
    // keys typed inside the open sheet stay in it
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
    if (toast) toast.classList.remove("on");     // no toast floats over a sheet (TRIAGE5 S1); the kit drops new ones
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
    if (typeof c.onClose === "function") { try { c.onClose(); } catch (e) { /* keep closing */ } }
    if (swap !== true && c.opener && c.opener.focus && doc.contains(c.opener)) {
      try { c.opener.focus({ preventScroll: true }); } catch (e) { c.opener.focus(); }
    }
    // focus never stays on the hidden sheet, so the very next key reaches the game
    var a = doc.activeElement;
    if (swap !== true && a && a !== doc.body && c.scrim.contains(a) && a.blur) a.blur();
    fire(c.id, false);
  }
  w.NumbericsUI = { topbar: topbar, sheet: sheet, open: open, current: current, close: close, dot: dot, cardGlyphs: cardGlyphs, syncMute: syncMute };
  topbar();
  cardGlyphs();
})(typeof window !== "undefined" ? window : this);
// D8: the one How to play sheet (shared/howto.js, loaded before game.js) is NumbericsUI.howto
if (typeof window !== "undefined" && window.NumbericsUI) window.NumbericsUI.howto = function (id, o) { return window.NumbericsHowto ? window.NumbericsHowto.howto(id, o) : null; };
