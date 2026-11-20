/* SPDX-License-Identifier: Apache-2.0 | Copyright 2026 alvations (Melon Lab)
 * NumbericsProgress (docs/design/REDESIGN.md 3.5). A1 STUB: nothing is stored yet; reads return empty. B4 fills in
 * the numberics_progress_v1 store behind this same API. UMD so Node tests can require it. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.NumbericsProgress = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  return {
    put: function (id, summary) {},          // summary: { best, live, liveText }
    get: function (id) { return null; },
    daily: function (id, text) {},
    today: function () { return {}; },       // today's daily entry: { seven:"1,204", ... }
    seenHowto: function (id) { return false; },
    markHowto: function (id) {}
  };
});
