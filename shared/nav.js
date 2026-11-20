/* SPDX-License-Identifier: Apache-2.0 | Copyright 2026 alvations (Melon Lab)
 * The quiet "More from Numberics" row. Usage in any page:
 *   <nav id="games" class="games" data-root="../" data-current="seven" aria-label="Numberics games"></nav>
 * LIVE mirrors the live entries of games.json (a test keeps them in sync). Static, so it works from file://. */
(function () {
  "use strict";
  var LIVE = [
    ["endless", "Endless", ""], ["sudoku", "Sudoku", "sudoku/"]
  ];
  var el = document.getElementById("games"); if (!el) return;
  var root = el.getAttribute("data-root") || "", cur = el.getAttribute("data-current");
  LIVE.forEach(function (g) {
    var a = document.createElement("a"); a.href = root + g[2] || "./"; a.textContent = g[1];
    if (!g[2]) a.href = root || "./";
    if (g[0] === cur) a.setAttribute("aria-current", "page");
    el.appendChild(a);
  });
  if (typeof module === "object") module.exports = LIVE;
})();
