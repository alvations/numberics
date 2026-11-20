/* SPDX-License-Identifier: Apache-2.0 | Copyright 2026 alvations (Melon Lab)
 * NumbericsTrophies (docs/design/REDESIGN.md 8). A1 STUB: an empty registry, nothing is ever earned, open() does
 * nothing. B4 fills in the registry, the store and the Trophies sheet behind this same API. UMD (the registry is pure). */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.NumbericsTrophies = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  return {
    REG: [],
    report: function (gameId, event, data) { return []; },
    has: function (id) { return false; },
    earned: function () { return []; },
    open: function () {}
  };
});
