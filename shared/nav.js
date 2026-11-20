/* SPDX-License-Identifier: Apache-2.0 | Copyright 2026 alvations (Melon Lab)
 * The games row. Usage in any page (add data-detail on the home page for names with descriptions):
 *   <nav id="games" class="games" data-root="../" data-current="seven" aria-label="Numberics games"></nav>
 * LIVE mirrors the live entries of games.json (a test keeps them in sync). Static, so it works from file://. */
(function () {
  "use strict";
  var LIVE = [
    ["endless", "Endless", "", "2048 with no top tile."],
    ["sudoku", "Sudoku", "sudoku/", "Classic 9x9, one answer only."],
    ["fibonacci", "Fibonacci", "fibonacci/", "Merge neighbours in the Fibonacci run."],
    ["seven", "Seven", "seven/", "Drop discs; a number pops when it fits its line."],
    ["three", "Three", "three/", "Count in threes, line up rainbow flushes."],
    ["four", "Four", "four/", "Four in a row, or four that make ten."],
    ["five", "Five", "five/", "Add tiles onto tiles; at five they burst."],
    ["six", "Six", "six/", "Signs between numbers until they make six."],
    ["fifteen", "Fifteen", "fifteen/", "Claim three numbers that make fifteen."],
    ["nine", "Nine", "nine/", "Take from the heaps; take the last to win."]
  ];
  var el = document.getElementById("games"); if (!el) return;
  var root = el.getAttribute("data-root") || "", cur = el.getAttribute("data-current");
  // data-detail (the home page): every other game with its one-line description, so a stranger can tell
  // what "Seven" or "Four" is (round 2, cold #1). Elsewhere: the quiet row, with the description as a tooltip.
  var detail = el.hasAttribute("data-detail");
  if (detail) el.classList.add("detail");
  LIVE.forEach(function (g) {
    if (detail && g[0] === cur) return;
    var a = document.createElement("a"); a.href = g[2] ? root + g[2] : (root || "./"); a.title = g[3];
    if (detail) {
      var b = document.createElement("b"); b.textContent = g[1];
      var s = document.createElement("span"); s.textContent = g[3];
      a.appendChild(b); a.appendChild(s);
    } else a.textContent = g[1];
    if (g[0] === cur) a.setAttribute("aria-current", "page");
    el.appendChild(a);
  });
  if (typeof module === "object") module.exports = LIVE;
})();
