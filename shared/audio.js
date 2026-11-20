/* SPDX-License-Identifier: Apache-2.0 | Copyright 2026 alvations (Melon Lab)
 * NumbericsAudio (docs/design/REDESIGN.md 6.4, 7). A1 STUB: every sound and buzz is a silent no-op, and no
 * AudioContext is ever created. B3 fills in the Web Audio voices and haptics behind this same API. */
(function (w) {
  "use strict";
  function none() {}
  var A = { buzz: function (kind) {} };
  "tick slide merge land pop burst pip place best power trophy win lose bad".split(" ").forEach(function (n) { A[n] = none; });
  w.NumbericsAudio = A;
})(typeof window !== "undefined" ? window : this);
