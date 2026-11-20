/* SPDX-License-Identifier: Apache-2.0 | Copyright 2026 alvations (Melon Lab)
 * The phone-fit rule (craft F15, nit 4) in the redesign: the game itself, from the top bar down to the last control
 * above the how-to text, fits the screen without scrolling. The how-to (a collapsed row after D) and the games list
 * (cards below the game after C1, REDESIGN.md 3.1) may sit below the fold. Pass to page.evaluate: returns
 * { bottom, height } in CSS px, where bottom is the lowest edge of the play area in page coordinates. */
module.exports = function playFit() {
  var kids = Array.prototype.slice.call(document.getElementById("app").children), end = kids.length;
  for (var i = 0; i < kids.length; i++) if (kids[i].matches(".how, #games")) { end = i; break; }
  var bottom = 0;
  kids.slice(0, end).forEach(function (e) { if (e.offsetParent) bottom = Math.max(bottom, e.getBoundingClientRect().bottom + scrollY); });
  return { bottom: Math.ceil(bottom), height: innerHeight, fits: Math.ceil(bottom) <= innerHeight };
};
