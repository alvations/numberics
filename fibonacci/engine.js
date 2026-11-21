/* SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 alvations (Melon Lab)
 *
 * Numberics Fibonacci: 2584 with no ceiling. The pure engine. No DOM, no storage, no clock.
 * It is the Endless slide-and-merge core (../two/engine.js, make(rules)) with the 2584 rule set:
 *   - tiles are Fibonacci numbers stored as INDICES: 1 shows 1, 2 shows 2, 3 shows 3, 4 shows 5,
 *     5 shows 8 ... (index i shows F(i+1) in the usual F(1) = F(2) = 1 numbering), so no overflow;
 *   - two tiles merge when they are consecutive in the sequence (|a - b| == 1), or both are 1;
 *     the result is the next Fibonacci number (max(a, b) + 1) and the score adds its value;
 *   - spawns are 1 (90%) and 2 (10%); there is no winning tile and no ceiling.
 * These are the well-known 2584 rules. The merge rule is confirmed by a published write-up; the
 * reference page (thereal23.github.io/2584) could not be reached from the build network, so the spawn
 * odds and scoring are assumed, not checked against it (docs/DESIGN.md, Fibonacci).
 * Power-ups are Endless's exactly; Boost moves a tile to the next Fibonacci number, and a NEW
 * highest tile from 55 up (index 9) awards one. The floor was 34 until round 2: with the same bot
 * Fibonacci paid more rewards per game than Endless, so it moved up one step (docs/ROADMAP.md 1, 0a).
 * R2 (a power-up never earns one, including the swipe right after it) lives in ../two/engine.js.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("../two/engine.js"));
  else root.NumbericsFibonacci = factory(root.Numberics);
})(typeof self !== "undefined" ? self : this, function (Endless) {
  "use strict";

  var AWARD_FROM_INDEX = 9; // index 9 shows 55: the first milestone that pays out
  var SUB = "₀₁₂₃₄₅₆₇₈₉";

  // value(i): index -> its Fibonacci number. Exact while it fits a double (index < 78), then a
  // close float, then Infinity (index > 1475), like 2^n in Endless. Cached, grows on demand.
  var vals = [0, 1, 2];
  function value(i) {
    if (!(i >= 0)) return 0;
    while (vals.length <= i) vals.push(vals[vals.length - 1] + vals[vals.length - 2]);
    return vals[i];
  }
  // The usual Fibonacci number of index i, for the subscript form: value(i) = F(i + 1).
  function fibIndex(i) { return i + 1; }

  // Digits while they fit in 6 characters (up to 832040), then F with a subscript index (F31 = 1346269).
  function label(i) {
    var v = value(i);
    if (v < 1e6) return String(v);
    return "F" + String(fibIndex(i)).replace(/[0-9]/g, function (d) { return SUB[+d]; });
  }

  var RULES = {
    canMerge: function (a, b) { return (a === 1 && b === 1) || Math.abs(a - b) === 1; },
    mergeResult: function (a, b) { return Math.max(a, b) + 1; },
    spawn: function (r) { return r < 0.9 ? 1 : 2; }, // 1 (90%) or 2 (10%)
    value: value,
    label: label,
    awardFrom: AWARD_FROM_INDEX,
  };

  var api = Endless.make(RULES);
  api.RULES = RULES;
  api.fibIndex = fibIndex;
  api.AWARD_FROM_INDEX = AWARD_FROM_INDEX;
  return api;
});
