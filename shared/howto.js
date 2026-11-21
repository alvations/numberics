/* SPDX-License-Identifier: Apache-2.0 | Copyright 2026 alvations (Melon Lab)
 * NumbericsHowto (REDESIGN.md 1.3, 3.6, 9; TRIAGE4 D8): the one How to play sheet, as NumbericsUI.howto(gameId, opts).
 * Its shape, the first-visit rule and opts: docs/CODE-NOTES.md#sharedhowtojs */
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
