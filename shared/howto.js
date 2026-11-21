/* SPDX-License-Identifier: Apache-2.0 | Copyright 2026 alvations (Melon Lab)
 * NumbericsHowto (docs/design/REDESIGN.md 1.3, 3.6, 9; TRIAGE4 D8): the one How to play sheet every game uses,
 * exposed as NumbericsUI.howto (shared/ui.js delegates to it). One shape for all ten games:
 *   - the title is "How to play <Game>", the steps are a small picture and one sentence each, a Play button closes it;
 *   - the collapsed "How to play" row under the board has one button, labelled "Show the three steps";
 *   - first visit: it opens by itself once (NumbericsProgress seenHowto / markHowto), never on a page with a saved
 *     game, and never over a sheet that is already open. Keys never reach the game while it is open (shared/ui.js).
 *
 * howto(gameId, opts) wires the row's button and makes the first-visit check; it returns { open(onClose), close(),
 * shown } (shown: it opened by itself). opts:
 *   title     the game's name ("Two"); a title that already starts with "How to play" is kept as it is
 *   steps     [{ text, picture(el) }]: picture fills the step's picture box (an HTML string is also accepted)
 *   saved     true when this page loaded a saved game: then it never opens by itself
 *   button    the row's button (an element or an id); default the [data-howto] button, else the button in details.how
 *   onOpen    called before every open (a game finishes its running animation here)
 *   onButton  called when the row's button is pressed, before the sheet opens (a game's tick sound); onPlay: on Play
 *   onClose   called after every close; onFirstClose: after the sheet that opened by itself closes
 * Without the sheet module the row itself is opened instead, so the rules are still one tap away. */
(function (w) {
  "use strict";
  var doc = w.document, LABEL = "Show the three steps";
  function UI() { return w.NumbericsUI && typeof w.NumbericsUI.sheet === "function" ? w.NumbericsUI : null; }
  function progress() { return w.NumbericsProgress || null; }
  function seen(id) { var P = progress(); try { return P && P.seenHowto ? !!P.seenHowto(id) : true; } catch (e) { return true; } }
  function mark(id) { var P = progress(); try { if (P && P.markHowto) P.markHowto(id); } catch (e) { /* remembered in memory only */ } }
  function call(fn) { if (typeof fn === "function") { try { fn(); } catch (e) { /* a nicety never breaks the sheet */ } } }
  function titleOf(t) { t = String(t || ""); return /^How to play/.test(t) ? t : "How to play" + (t ? " " + t : ""); }
  function rowButton(b) {
    if (b && b.nodeType === 1) return b;
    if (typeof b === "string") return doc.getElementById(b);
    return doc.querySelector("[data-howto]") || doc.querySelector("details.how button");
  }
  function ready(fn) {
    if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", fn); else w.setTimeout(fn, 0);
  }

  function howto(gameId, opts) {
    opts = opts || {};
    var steps = opts.steps || [], btn = rowButton(opts.button), off = false;
    var h = { shown: false, open: open, close: close, cancelAuto: function () { off = true; } };
    function build(body) {
      var wrap = doc.createElement("div"); wrap.className = "howto";
      steps.forEach(function (s) {
        var st = doc.createElement("div"), pv = doc.createElement("div"), p = doc.createElement("p");
        st.className = "step"; pv.className = "pv"; pv.setAttribute("aria-hidden", "true");
        if (typeof s.picture === "function") { try { s.picture(pv); } catch (e) { /* the sentence still reads */ } }
        else if (s.picture != null) pv.innerHTML = String(s.picture);
        p.textContent = s.text || "";
        st.appendChild(pv); st.appendChild(p); wrap.appendChild(st);
      });
      body.appendChild(wrap);
      var row = doc.createElement("div"), play = doc.createElement("button");
      row.className = "row"; play.className = "btn primary"; play.type = "button"; play.id = "howto-play";
      play.setAttribute("data-play", ""); play.textContent = "Play";
      play.addEventListener("click", function () { call(opts.onPlay); var U = UI(); if (U) U.close(); });
      row.appendChild(play); body.appendChild(row);
    }
    function open(onClose) {
      var U = UI();
      call(opts.onOpen);
      mark(gameId);
      if (!U) { var d = btn && btn.closest ? btn.closest("details") : doc.querySelector("details.how"); if (d) d.open = true; call(onClose); return null; }
      return U.sheet("howto", build, { title: titleOf(opts.title), onClose: function () { call(opts.onClose); call(onClose); } });
    }
    function close() { var U = UI(); if (U && U.current && U.current() === "howto") U.close(); }
    if (btn) {
      btn.textContent = LABEL;
      btn.addEventListener("click", function (e) { if (e && e.preventDefault) e.preventDefault(); call(opts.onButton); open(); });
    }
    // the first visit: once, never with a saved game, never over an open sheet (scripts after this one have run)
    function auto() {
      var U = UI();
      if (off || opts.saved || seen(gameId) || (U && U.open && U.open())) return;
      h.shown = true; open(opts.onFirstClose);
    }
    if (doc.readyState === "loading") ready(auto);
    else auto();
    return h;
  }

  w.NumbericsHowto = { howto: howto, LABEL: LABEL, title: titleOf };
})(typeof window !== "undefined" ? window : this);
