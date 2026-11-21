/* SPDX-License-Identifier: Apache-2.0 | Copyright 2026 alvations (Melon Lab)
 * NumbericsTrophies (docs/design/REDESIGN.md 8): the registry of every trophy, the earned store, the unlock moment
 * and the Trophies sheet. UMD: the registry and report() are pure enough to run in Node tests.
 *   report(gameId, event, data[, opts])  -> the ids newly earned by this event (opts.quiet: no toast, no sound; the
 *     unseen dot still shows). A family trophy earned mid-play waits for the next idle moment for its toast.
 *   has(id), earned(), unseen(), fam(), find(id), glyph(name), pill(id), pills(el, ids), open(), html()
 * Store: numberics_trophies_v1 = { v:1, got:{ id:"YYYYMMDD" }, unseen:[id], fam:{ played, dailyDays, streak } },
 * always through NumbericsKit.store (try/catch, memory fallback). Nothing is ever sent anywhere.
 * The sheet (TRIAGE4 D3, on panel evidence over melon-eight's earned-only list) shows a count "N of M trophies" (M: every
 * non-secret trophy plus the secrets already earned), then the earned trophies, then every not-yet-earned NON-secret
 * trophy dimmed with its description, as goals. A secret is not in the DOM, nor counted, until earned. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(root);
  else root.NumbericsTrophies = factory(root);
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";
  var KEY = "numberics_trophies_v1";
  // the ten games in O-7 order (games.json drives the sheet when nav.js exposes it); Everywhere comes first
  var GAMES = ["fibonacci", "two", "three", "four", "five", "six", "seven", "nine", "fifteen", "sudoku"];
  var NAMES = { fam: "Everywhere", fibonacci: "Fibonacci", two: "Two", three: "Three", four: "Four", five: "Five",
                six: "Six", seven: "Seven", nine: "Nine", fifteen: "Fifteen", sudoku: "Sudoku" };
  function lib(name, file) {
    var g = (typeof window !== "undefined" && window) || root;
    if (g && g[name]) return g[name];
    try { if (typeof require === "function" && file) return require(file); } catch (e) { /* not in Node */ }
    return null;
  }
  function norm(id) { return id === "endless" ? "two" : String(id); }

  // ---- glyph primitives (REDESIGN.md 8.3), 24 x 24, line only ----
  function c(x, y, r) { return '<circle cx="' + x + '" cy="' + y + '" r="' + r + '"/>'; }
  function p(d) { return '<path d="' + d + '"/>'; }
  var GLYPHS = {
    star: p("M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.5 6.7 19.4l1.2-6L3.4 9.3l6-.7z"),
    moon: p("M16 4a8 8 0 100 16 6.5 6.5 0 010-16z") + p("M18.5 8l.4 1.1 1.1.4-1.1.4-.4 1.1-.4-1.1-1.1-.4 1.1-.4z"),
    bolt: p("M13 3L5 14h6l-1 7 8-11h-6z"),
    line: p("M4 12h16M14 6l6 6-6 6") + p("M4 7v10"),
    waves: p("M3 9c3-3 6 3 9 0s6 3 9 0M3 15c3-3 6 3 9 0s6 3 9 0"),
    flame: p("M12 3c1 4 5 5.5 5 10a5 5 0 01-10 0c0-2.4 1.2-3.6 2.4-4.6.3 1.6 1 2.6 2.1 3C11 9 11 6 12 3z"),
    cal: '<rect x="4" y="5" width="16" height="15" rx="2.5"/>' + p("M4 10h16M9 3v4M15 3v4") + p("M9 15l2 2 4-4"),
    spiral: p("M12 12a1.5 1.5 0 011.5 1.5 3 3 0 01-3 3 4.5 4.5 0 01-4.5-4.5 6 6 0 016-6 7.5 7.5 0 017.5 7.5"),
    crown: p("M4 18h16M5 18l-1-10 5 4 3-6 3 6 5-4-1 10"),
    hands: p("M7 20v-6l-2-4 2-1 2 3V5a1.5 1.5 0 013 0v6M12 11V4a1.5 1.5 0 013 0v7M15 11V6a1.5 1.5 0 013 0v8a6 6 0 01-6 6h-1"),
    check: p("M5 12l4.5 4.5L19 7"),
    eye: p("M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6z") + c(12, 12, 2.5),
    fork: p("M12 20v-8M12 12L6 5M12 12l6-7") + c(6, 5, 1.5) + c(18, 5, 1.5),
    heart: p("M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z"),
    grid: '<rect x="4" y="4" width="16" height="16" rx="2"/>' + p("M9.3 4v16M14.7 4v16M4 9.3h16M4 14.7h16"),
    rain: p("M6 4v5M12 6v5M18 4v5") + p("M3 15h18") + p("M6 19h12"),
    key: c(8, 15, 4) + p("M11 12l8-8M16 7l2 2M14 9l2 2"),
    target: c(12, 12, 8) + c(12, 12, 4) + c(12, 12, 1),
    hourglass: p("M7 3h10M7 21h10M8 3c0 5 8 5 8 9s-8 4-8 9M16 3c0 5-8 5-8 9s8 4 8 9"),
    leaf: p("M5 19C5 10 11 5 19 5c0 8-5 14-14 14z") + p("M5 19l8-8")
  };
  function esc(s) { return String(s).replace(/[&<>"]/g, function (ch) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]; }); }
  // "star", or a numbered square "sq:2048" / disc "disc:7" with the label as text
  function glyphInner(name) {
    var m = /^(sq|disc):(.{1,5})$/.exec(name || "");
    if (!m) return GLYPHS[name] || "";
    var t = m[2], fs = t.length <= 2 ? 9 : t.length === 3 ? 7.6 : 6, y = Math.round((12 + fs * 0.42) * 10) / 10;
    return (m[1] === "sq" ? '<rect x="3.5" y="3.5" width="17" height="17" rx="3.5"/>' : c(12, 12, 8.5)) +
      '<text x="12" y="' + y + '" text-anchor="middle" font-size="' + fs + '" font-weight="800" fill="currentColor" stroke="none"' +
      ' font-family="system-ui,sans-serif">' + esc(t) + "</text>";
  }
  function glyph(name) { return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + glyphInner(name) + "</svg>"; }

  // ---- pure board readers for the line trophies ----
  function lines(grid) {
    var out = []; if (!grid || !grid.length) return out;
    var n = Math.round(Math.sqrt(grid.length)); if (n * n !== grid.length) return out;
    for (var i = 0; i < n; i++) {
      var r = [], col = [];
      for (var j = 0; j < n; j++) { r.push(+grid[i * n + j] || 0); col.push(+grid[j * n + i] || 0); }
      out.push(r, col);
    }
    return out;
  }
  function eitherWay(line, f) { return f(line) || f(line.slice().reverse()); }
  var FIB = [5, 8]; while (FIB[FIB.length - 1] < 1e15) FIB.push(FIB[FIB.length - 1] + FIB[FIB.length - 2]);
  // a full line of consecutive Fibonacci numbers in order (either direction), smallest at least 5
  function fibRun(grid) {
    return lines(grid).some(function (ln) {
      return eitherWay(ln, function (l) {
        var k = FIB.indexOf(l[0]); if (k < 0) return false;
        for (var i = 1; i < l.length; i++) if (FIB[k + i] !== l[i]) return false;
        return true;
      });
    });
  }
  // a full line of levels l, l-1, l-2, l-3 (either direction) whose smallest is at least 3
  function stair(grid) {
    return lines(grid).some(function (ln) {
      return eitherWay(ln, function (l) {
        for (var i = 1; i < l.length; i++) if (l[i] !== l[0] - i) return false;
        return l[l.length - 1] >= 3;
      });
    });
  }
  // every cell filled and nothing below 3
  function grownUp(grid) {
    if (!grid || grid.length < 16) return false;
    for (var i = 0; i < grid.length; i++) if (!(+grid[i] >= 3)) return false;
    return true;
  }
  function run(d) { return d && d.run && typeof d.run === "object" ? d.run : {}; }
  function num(v) { return typeof v === "number" && isFinite(v) ? v : NaN; }
  // A Daily is finished by "end" in every game; "solve" finishes one only where a solve ends the puzzle (Sudoku).
  // Six sends "solve" per line, so a Six solve never counts as finishing its Daily (D-Six report, 21 Nov).
  function isDaily(event, d, game) {
    if (!d || !(d.daily === true || d.mode === "daily")) return false;
    return event === "end" || (event === "solve" && game !== "six");
  }

  // ---- the registry (REDESIGN.md 8.4). on: the events that test it ("*" any); test(data, ctx) ----
  var REG = [];
  function T(id, game, name, desc, glyph, secret, on, test) {
    REG.push({ id: id, game: game, name: name, desc: desc, glyph: glyph, secret: !!secret, on: on, test: test });
  }
  var ANY = "*", MOVE_END = ["move", "end"];
  // Everywhere (events from every game)
  T("fam_first", "fam", "Hello, numbers", "Finish your first game.", "star", 0, ["end", "round", "solve"], function () { return true; });
  T("fam_five", "fam", "High five", "Play five different games.", "hands", 0, ANY, function (d, x) { return Object.keys(x.fam.played).length >= 5; });
  T("fam_all", "fam", "The whole set", "Play all ten games.", "grid", 0, ANY, function (d, x) { return GAMES.every(function (g) { return !!x.fam.played[g]; }); });
  T("fam_daily", "fam", "Same for everyone", "Finish a Daily.", "cal", 0, ["end", "solve"], function (d, x, e) { return isDaily(e, d, x.game); });
  T("fam_week", "fam", "A week of dailies", "Finish a Daily seven days in a row.", "flame", 0, ["end", "solve"], function (d, x) { return x.fam.streak.n >= 7; });
  // Night owl needs real play: it is tested only when a game, round, match or puzzle ends between midnight and 4,
  // never on a page load or a first tap (TRIAGE4 family: it was a free trophy for opening the page late)
  T("fam_night", "fam", "Night owl", "Played well past bedtime.", "moon", 1, ["end", "round", "match", "solve"], function (d, x) { return x.hour < 4; });
  T("fam_keep", "fam", "Keepsake", "Kept a copy of everything.", "key", 1, ["saved"], function () { return true; });
  // Fibonacci: move {value, merges, grid, moves}, end {score, value}; run {used}
  T("fib_89", "fibonacci", "Golden start", "Make an 89.", "sq:89", 0, MOVE_END, function (d) { return num(d.value) >= 89; });
  T("fib_610", "fibonacci", "Unfolding", "Make a 610.", "sq:610", 0, MOVE_END, function (d) { return num(d.value) >= 610; });
  T("fib_2584", "fibonacci", "The old goal", "Make 2584, then keep going.", "line", 0, MOVE_END, function (d) { return num(d.value) >= 2584; });
  T("fib_10946", "fibonacci", "Golden ratio", "Make 10946.", "spiral", 0, MOVE_END, function (d) { return num(d.value) >= 10946; });
  T("fib_pure", "fibonacci", "Unaided", "Make a 987 without power-ups.", "leaf", 0, MOVE_END, function (d) { return num(d.value) >= 987 && run(d).used === 0; });
  T("fib_chain", "fibonacci", "Domino", "Three joins in one move.", "bolt", 0, ["move"], function (d) { return num(d.merges) >= 3; });
  T("fib_run", "fibonacci", "In sequence", "Four neighbours in the run.", "rain", 1, ["move"], function (d) { return fibRun(d.grid); });
  T("fib_long", "fibonacci", "Patient spiral", "A very long game.", "hourglass", 1, ["move"], function (d) { return num(d.moves) >= 500; });
  // Two: move {top, score, merges, grid:[levels], moves, stuck}, power {name, stuck}, end {score, top}; run {used, stuckUse}
  T("two_128", "two", "Warming up", "Make a 128 tile.", "sq:128", 0, MOVE_END, function (d) { return num(d.top) >= 7; });
  T("two_2048", "two", "The old finish line", "Make 2048, then keep going.", "line", 0, MOVE_END, function (d) { return num(d.top) >= 11; });
  T("two_4096", "two", "Past the line", "Make 4096.", "sq:4096", 0, MOVE_END, function (d) { return num(d.top) >= 12; });
  T("two_8192", "two", "Far beyond", "Make 8192.", "crown", 0, MOVE_END, function (d) { return num(d.top) >= 13; });
  T("two_pure", "two", "No help needed", "Make 1024 without power-ups.", "leaf", 0, MOVE_END, function (d) { return num(d.top) >= 10 && run(d).used === 0; });
  T("two_score", "two", "Big number", "Score 20,000 in one game.", "target", 0, MOVE_END, function (d) { return num(d.score) >= 20000; });
  T("two_chain", "two", "Chain reaction", "Four joins in one move.", "bolt", 0, ["move"], function (d) { return num(d.merges) >= 4; });
  T("two_comeback", "two", "Second wind", "Got unstuck and kept going.", "heart", 1, ["move"], function (d) {
    var s = run(d).stuckUse; return typeof s === "number" && num(d.moves) - s >= 50; });
  T("two_row", "two", "Staircase", "A row that halves all the way.", "fork", 1, ["move"], function (d) { return stair(d.grid); });
  // Three: swipe {flushes, top, grid, moves}, end {score, flushes}; run {used, flushes}
  T("thr_flush", "three", "First flush", "Make a rainbow flush.", "rain", 0, ["swipe"], function (d) { return num(d.flushes) >= 1; });
  T("thr_96", "three", "Ninety-six", "Make a 96.", "sq:96", 0, ["swipe"], function (d) { return num(d.top) >= 96; });
  T("thr_384", "three", "Big three", "Make a 384.", "sq:384", 0, ["swipe"], function (d) { return num(d.top) >= 384; });
  T("thr_five", "three", "Rainbow run", "Five flushes in one game.", "star", 0, ["swipe", "end"], function (d) { return num(run(d).flushes) >= 5; });
  T("thr_double", "three", "Double rainbow", "Two flushes from one swipe.", "waves", 0, ["swipe"], function (d) { return num(d.flushes) >= 2; });
  T("thr_mono", "three", "All grown up", "A full board with no 1s or 2s.", "grid", 1, ["swipe"], function (d) { return grownUp(d.grid); });
  T("thr_long", "three", "Unhurried", "A very long game.", "hourglass", 1, ["swipe"], function (d) { return num(d.moves) >= 300; });
  // Four: end {won, level, how:"colour"|"ten"|"both", lastSlot, used}
  T("four_win", "four", "First four", "Beat the computer.", "disc:4", 0, ["end"], function (d) { return d.won === true; });
  T("four_ten", "four", "Ten out of ten", "Win with four that make ten.", "sq:10", 0, ["end"], function (d) { return d.won === true && (d.how === "ten" || d.how === "both"); });
  T("four_colour", "four", "True colours", "Win with four of your colour.", "target", 0, ["end"], function (d) { return d.won === true && (d.how === "colour" || d.how === "both"); });
  T("four_medium", "four", "Getting good", "Win on Medium.", "star", 0, ["end"], function (d) { return d.won === true && d.level === "medium"; });
  T("four_hard", "four", "Hard won", "Win on Hard.", "crown", 0, ["end"], function (d) { return d.won === true && d.level === "hard"; });
  T("four_pure", "four", "Bare hands", "Win on Hard without power-ups.", "hands", 0, ["end"], function (d) { return d.won === true && d.level === "hard" && d.used === 0; });
  T("four_both", "four", "Two at once", "One disc, two kinds of win.", "fork", 1, ["end"], function (d) { return d.won === true && d.how === "both"; });
  T("four_last", "four", "Last slot", "Won with the very last space.", "hourglass", 1, ["end"], function (d) { return d.won === true && d.lastSlot === true; });
  // Five: round {won, burstAt}, match {won, level, p, c, down02}
  T("five_round", "five", "First burst", "Win a round.", "sq:5", 0, ["round"], function (d) { return d.won === true; });
  T("five_match", "five", "Match point", "Win a match.", "check", 0, ["match"], function (d) { return d.won === true; });
  T("five_medium", "five", "Steady hands", "Win a match on Medium.", "star", 0, ["match"], function (d) { return d.won === true && d.level === "medium"; });
  T("five_hard", "five", "Hard five", "Win a match on Hard.", "crown", 0, ["match"], function (d) { return d.won === true && d.level === "hard"; });
  T("five_sweep", "five", "Clean sweep", "Win a match three rounds to none.", "leaf", 0, ["match"], function (d) { return d.won === true && d.c === 0; });
  T("five_exact", "five", "Right on five", "Burst at exactly five to win a round.", "target", 1, ["round"], function (d) { return d.won === true && d.burstAt === 5; });
  T("five_back", "five", "Turnaround", "Won from far behind.", "heart", 1, ["match"], function (d) { return d.won === true && d.down02 === true; });
  // Six: solve {tier, helped, sqrt, fact, mode, round, streak}, end {mode, solved, round}
  T("six_first", "six", "Made six", "Make your first six.", "sq:6", 0, ["solve"], function () { return true; });
  T("six_tier3", "six", "Signs of skill", "Solve a tier 3 line.", "star", 0, ["solve"], function (d) { return num(d.tier) >= 3; });
  T("six_tier5", "six", "Every tool", "Solve a tier 5 line.", "crown", 0, ["solve"], function (d) { return num(d.tier) >= 5; });
  T("six_climb", "six", "Climber", "Reach round 10 in Climb.", "line", 0, ["solve", "end"], function (d) { return d.mode === "climb" && num(d.round) >= 10; });
  T("six_daily", "six", "Daily six", "Finish the Daily Six.", "cal", 0, ["end"], function (d) { return d.mode === "daily"; });
  T("six_ten", "six", "No hints", "Ten lines in a row without help.", "check", 0, ["solve"], function (d) { return num(d.streak) >= 10; });
  T("six_bang", "six", "Bang", "Found an exciting way to six.", "bolt", 1, ["solve"], function (d) { return !d.helped && num(d.fact) >= 1; });
  T("six_roots", "six", "Deep roots", "Rooted twice in one line.", "leaf", 1, ["solve"], function (d) { return !d.helped && num(d.sqrt) >= 2; });
  // Seven: drop {waves, popped, sevens, left}, level {level, mode}, end {mode, score, daily}
  T("sev_three", "seven", "Chain of three", "One drop, three waves.", "waves", 0, ["drop"], function (d) { return num(d.waves) >= 3; });
  T("sev_five", "seven", "Cascade", "One drop, five waves.", "bolt", 0, ["drop"], function (d) { return num(d.waves) >= 5; });
  T("sev_level", "seven", "Rising", "Reach level 5 in Classic.", "line", 0, ["level"], function (d) { return d.mode === "classic" && num(d.level) >= 5; });
  T("sev_score", "seven", "Seven thousand", "Score 7,000 in one game.", "disc:7", 0, ["end"], function (d) { return num(d.score) >= 7000; });
  T("sev_blitz", "seven", "Blitzed", "Score 2,000 in Blitz.", "hourglass", 0, ["end"], function (d) { return d.mode === "blitz" && num(d.score) >= 2000; });
  T("sev_daily", "seven", "Daily well", "Finish a Daily.", "cal", 0, ["end"], function (d) { return d.daily === true; });
  T("sev_clear", "seven", "Empty well", "Left nothing behind.", "check", 1, ["drop"], function (d) { return d.left === 0; });
  T("sev_sevens", "seven", "Lucky sevens", "Three sevens in one drop.", "star", 1, ["drop"], function (d) { return num(d.sevens) >= 3; });
  // Nine: take {amount, zeroAfter}, round {won, onlyOnes}, match {won, diff, misere, tiles}; run {zeroRun}
  T("nine_round", "nine", "Last one's mine", "Win a round.", "check", 0, ["round"], function (d) { return d.won === true; });
  T("nine_match", "nine", "Best of five", "Win a match.", "sq:9", 0, ["match"], function (d) { return d.won === true; });
  T("nine_hard", "nine", "Hard heap", "Win a match on Hard.", "crown", 0, ["match"], function (d) { return d.won === true && d.diff === "hard"; });
  T("nine_misere", "nine", "Upside down", "Win a Misere match.", "fork", 0, ["match"], function (d) { return d.won === true && d.misere === true; });
  T("nine_nine", "nine", "All nine", "Win a match with nine tiles.", "grid", 0, ["match"], function (d) { return d.won === true && d.tiles === 9; });
  T("nine_calm", "nine", "Perfect balance", "A flawless stretch.", "target", 1, ["take"], function (d) { return num(run(d).zeroRun) >= 10; });
  T("nine_ones", "nine", "One at a time", "A patient round.", "disc:1", 1, ["round"], function (d) { return d.won === true && d.onlyOnes === true; });
  // Fifteen: claim {forks}, round {won, view, firstMid}, match {won, diff}
  T("fif_round", "fifteen", "Fifteen!", "Win a round.", "sq:15", 0, ["round"], function (d) { return d.won === true; });
  T("fif_match", "fifteen", "Match won", "Win a match.", "crown", 0, ["match"], function (d) { return d.won === true; });
  T("fif_medium", "fifteen", "Sharp", "Win a match on Medium.", "star", 0, ["match"], function (d) { return d.won === true && d.diff === "medium"; });
  T("fif_hard", "fifteen", "Sharper", "Win a match on Hard.", "bolt", 0, ["match"], function (d) { return d.won === true && d.diff === "hard"; });
  T("fif_grid", "fifteen", "Magic square", "Win a round in Grid view.", "grid", 0, ["round"], function (d) { return d.won === true && d.view === "grid"; });
  T("fif_fork", "fifteen", "Two ways", "One pick, two threats.", "fork", 1, ["claim"], function (d) { return num(d.forks) >= 2; });
  T("fif_mid", "fifteen", "The middle way", "Started in the middle and won.", "target", 1, ["round"], function (d) { return d.won === true && d.firstMid === true; });
  // Sudoku: place {conflict}, solve {difficulty, seconds, used:{reveal,check,cands}, daily, notes, clean}
  function usedSum(d) { var u = d.used && typeof d.used === "object" ? d.used : null; return u ? (+u.reveal || 0) + (+u.check || 0) + (+u.cands || 0) : NaN; }
  T("sdk_first", "sudoku", "First grid", "Solve a puzzle.", "grid", 0, ["solve"], function () { return true; });
  T("sdk_medium", "sudoku", "Medium solved", "Solve a Medium puzzle.", "check", 0, ["solve"], function (d) { return d.difficulty === "medium"; });
  T("sdk_hard", "sudoku", "Hard solved", "Solve a Hard puzzle.", "crown", 0, ["solve"], function (d) { return d.difficulty === "hard"; });
  T("sdk_pure", "sudoku", "Pen only", "Solve a Hard puzzle without power-ups.", "hands", 0, ["solve"], function (d) { return d.difficulty === "hard" && usedSum(d) === 0; });
  T("sdk_quick", "sudoku", "Quick pencil", "Solve Easy in under five minutes.", "hourglass", 0, ["solve"], function (d) { return d.difficulty === "easy" && num(d.seconds) < 300; });
  T("sdk_daily", "sudoku", "Daily grid", "Solve the Daily Sudoku.", "cal", 0, ["solve"], function (d) { return d.daily === true; });
  T("sdk_nonotes", "sudoku", "In your head", "No notes needed.", "eye", 1, ["solve"], function (d) { return (d.difficulty === "medium" || d.difficulty === "hard") && d.notes === false; });
  T("sdk_clean", "sudoku", "Not one slip", "A spotless solve.", "star", 1, ["solve"], function (d) { return d.clean === true; });
  var BY = {}; REG.forEach(function (t) { BY[t.id] = t; });

  // ---- the store ----
  function P() { return lib("NumbericsProgress", "./progress.js"); }
  function mkStore() {
    var K = lib("NumbericsKit", "./kit.js"); if (K && K.store) return K.store(KEY);
    var mem = null;
    return { load: function () { try { return mem ? JSON.parse(mem) : null; } catch (e) { return null; } }, save: function (o) { mem = JSON.stringify(o); } };
  }
  var store = mkStore();
  function blank() { return { v: 1, got: {}, unseen: [], fam: { played: {}, dailyDays: [], streak: { n: 0, last: "" } } }; }
  function load() {
    var o = store.load(), d = blank(), pr = P(); if (!o || typeof o !== "object") return d;
    var isDay = pr ? pr.isDay : function (k) { return /^\d{8}$/.test(k); };
    if (o.got && typeof o.got === "object") Object.keys(o.got).forEach(function (id) { if (BY[id] && isDay(o.got[id])) d.got[id] = o.got[id]; });
    if (Array.isArray(o.unseen)) o.unseen.forEach(function (id) { if (d.got[id] && d.unseen.indexOf(id) < 0) d.unseen.push(id); });
    var f = o.fam && typeof o.fam === "object" ? o.fam : {};
    if (f.played && typeof f.played === "object") GAMES.forEach(function (g) { if (f.played[g] || (g === "two" && f.played.endless)) d.fam.played[g] = 1; });
    if (Array.isArray(f.dailyDays)) d.fam.dailyDays = f.dailyDays.filter(function (k, i, a) { return isDay(k) && a.indexOf(k) === i; }).sort().slice(-14);
    if (f.streak && typeof f.streak === "object" && isDay(f.streak.last) && +f.streak.n > 0) d.fam.streak = { n: Math.floor(+f.streak.n), last: f.streak.last };
    return d;
  }

  function report(gameId, event, data, opts) {
    var g = norm(gameId), ev = String(event), d0 = data && typeof data === "object" ? data : {};
    var pr = P(), now = pr ? pr.now() : new Date(), today = pr ? pr.dayKey(now) : "", s = load();
    if (GAMES.indexOf(g) >= 0) s.fam.played[g] = 1;               // a game counts as played from its first event
    if (isDaily(ev, d0, g) && today) {
      if (s.fam.dailyDays.indexOf(today) < 0) s.fam.dailyDays = s.fam.dailyDays.concat([today]).sort().slice(-14);
      s.fam.streak = pr.streakAfter(s.fam.streak, today);
    }
    var ctx = { fam: s.fam, hour: now.getHours(), today: today, game: g }, fresh = [];
    REG.forEach(function (t) {
      if (s.got[t.id] || (t.game !== g && t.game !== "fam")) return;
      if (t.on !== ANY && t.on.indexOf(ev) < 0) return;
      var hit = false; try { hit = !!t.test(d0, ctx, ev); } catch (e) { hit = false; }
      if (hit) { s.got[t.id] = today; s.unseen.push(t.id); fresh.push(t.id); }
    });
    store.save(s);
    if (fresh.length) {
      call(lib("NumbericsUI"), "dot", true);                     // quiet or not, the cup marks them unseen
      if (!(opts && opts.quiet)) {
        // a family trophy earned mid-play (Night owl, High five: any event) waits for the next idle moment, so it
        // never covers the hint line or the game's own toast mid-move; the game's trophies keep their moment
        var later = END_EV[ev] ? [] : fresh.filter(function (id) { return BY[id].game === "fam"; });
        var nowIds = fresh.filter(function (id) { return later.indexOf(id) < 0; });
        if (nowIds.length) announce(nowIds);
        if (later.length) famLater(later);
      }
    }
    return fresh;
  }
  // ---- the family queue: shown when the player has paused (no key or tap for IDLE_MS), with no sheet, end card or
  // other toast up, and the tab visible; re-checked until then (the trophy is already saved and the dot is on) ----
  var END_EV = { end: 1, round: 1, match: 1, solve: 1, saved: 1 }, IDLE_MS = 1600;
  var famQ = [], famT = null, lastIn = 0, hooked = false;
  function ms() { return Date.now(); }
  function famLater(ids) {
    var doc = dom(); if (!doc || typeof setTimeout !== "function") return; // Node: nothing to show
    if (!hooked && typeof window !== "undefined" && window.addEventListener) {
      hooked = true;
      ["keydown", "pointerdown", "touchstart"].forEach(function (n) {
        window.addEventListener(n, function () { lastIn = ms(); }, { capture: true, passive: true });
      });
    }
    ids.forEach(function (id) { if (famQ.indexOf(id) < 0) famQ.push(id); });
    lastIn = ms(); arm(IDLE_MS);
  }
  function arm(t) { clearTimeout(famT); famT = setTimeout(famTry, t); }
  function famTry() {
    famT = null; var doc = dom(); if (!famQ.length || !doc) return;
    var wait = IDLE_MS - (ms() - lastIn); if (wait > 0) return arm(wait);
    var U = lib("NumbericsUI"), el = doc.getElementById("toast");
    if ((U && typeof U.open === "function" && U.open()) || (el && el.classList.contains("on")) || cardUp(doc) || doc.hidden) return arm(500);
    var ids = famQ; famQ = []; announce(ids);
  }
  function has(id) { return !!load().got[id]; }
  function earned() { var g = load().got; return REG.filter(function (t) { return g[t.id]; }).map(function (t) { return t.id; }); }
  function unseen() { return load().unseen.slice(); }
  function fam() { return JSON.parse(JSON.stringify(load().fam)); }
  function find(id) { return BY[id] || null; }

  // ---- browser: the unlock moment, the end-card pill, the sheet ----
  function dom() { return typeof document !== "undefined" && document && typeof document.createElement === "function" ? document : null; }
  function call(obj, fn, a) { try { if (obj && typeof obj[fn] === "function") obj[fn](a); } catch (e) { /* a missing module costs a nicety */ } }
  function cardUp(doc) {
    var o = doc.querySelectorAll ? doc.querySelectorAll(".over") : [];
    for (var i = 0; i < o.length; i++) if (!o[i].hidden && o[i].offsetParent !== null) return true;
    return false;
  }
  function announce(ids) {
    var doc = dom(); if (!doc) return;
    call(lib("NumbericsAudio"), "trophy"); call(lib("NumbericsAudio"), "buzz", "big"); call(lib("NumbericsUI"), "dot", true);
    if (cardUp(doc)) return;                                    // R7: never over an end card; the card shows pills
    var K = lib("NumbericsKit"), el = doc.getElementById("toast"); if (!K || !K.toast || !el) return;
    var first = BY[ids[0]].name, msg = ids.length === 1 ? "Trophy: " + first : ids.length + " trophies: " + first + " and " + (ids.length - 1) + " more";
    K.toast(msg, el);
    if (el.classList.contains("on") && el.textContent === msg) {
      el.classList.add("trophy"); el.insertAdjacentHTML("afterbegin", glyph(BY[ids[0]].glyph));
      // the next plain toast drops the glyph style again
      if (typeof MutationObserver !== "undefined") {
        var mo = new MutationObserver(function () { if (!el.querySelector("svg")) { el.classList.remove("trophy"); mo.disconnect(); } });
        mo.observe(el, { childList: true, characterData: true, subtree: true });
      }
    }
  }
  // the end-card pill: <div class="trophy"><svg/>Trophy: name</div>; pills(el, ids) fills a container on the card
  function pill(id) { var t = BY[id]; return t ? '<div class="trophy" data-trophy="' + t.id + '">' + glyph(t.glyph) + "Trophy: " + esc(t.name) + "</div>" : ""; }
  function pills(el, ids) {
    if (!el) return; ids = (ids || []).filter(function (id) { return BY[id]; });
    el.innerHTML = ids.map(pill).join(""); el.hidden = !ids.length;
  }
  function order() {
    var N = lib("NumbericsNav"), live = N && N.LIVE, out = [];
    if (Array.isArray(live)) live.forEach(function (g) { var id = norm(Array.isArray(g) ? g[0] : g && g.id); if (GAMES.indexOf(id) >= 0 && out.indexOf(id) < 0) out.push(id); });
    GAMES.forEach(function (id) { if (out.indexOf(id) < 0) out.push(id); });
    return ["fam"].concat(out);
  }
  // the counts the sheet shows: earned, and visible (every non-secret trophy plus the earned secrets)
  function counts() {
    var got = load().got, e = 0, v = 0;
    REG.forEach(function (t) { if (got[t.id]) { e++; v++; } else if (!t.secret) v++; });
    return { earned: e, visible: v };
  }
  // one group per game (Everywhere first, then games order) of the trophies that pass `keep`
  function groups(keep, locked) {
    var out = "";
    order().forEach(function (g) {
      var mine = REG.filter(function (t) { return t.game === g && keep(t); }); if (!mine.length) return;
      out += '<div class="tro-game">' + esc(NAMES[g]) + '</div><div class="tro">' + mine.map(function (t) {
        return '<div class="tr' + (t.secret ? " secret" : "") + (locked ? " locked" : "") + '" data-trophy="' + t.id + '"' +
          (locked ? ' data-locked="1"' : "") + ">" + glyph(t.glyph) + "<div><b>" + esc(t.name) + "</b><small>" + esc(t.desc) +
          (locked ? '<span class="vh"> Not earned yet.</span>' : "") + "</small></div></div>";
      }).join("") + "</div>";
    });
    return out;
  }
  // the sheet body: the count, the earned trophies, then the goals (not-yet-earned, non-secret, dimmed)
  function html() {
    var got = load().got, n = counts();
    var out = '<p class="tro-count" data-count="' + n.earned + "/" + n.visible + '">' + n.earned + " of " + n.visible + " trophies</p>" +
      (n.earned ? "" : '<p class="tro-none">Nothing yet. Play any game to begin.</p>');
    if (n.earned) out += '<div class="sec">Earned</div>' + groups(function (t) { return !!got[t.id]; }, false);
    var todo = groups(function (t) { return !got[t.id] && !t.secret; }, true);
    if (todo) out += '<div class="sec">Still to find</div>' + todo;
    return out;
  }
  function build(el) { if (el) el.innerHTML = html(); }
  function clearUnseen() { var s = load(); if (s.unseen.length) { s.unseen = []; store.save(s); } call(lib("NumbericsUI"), "dot", false); }

  // A minimal sheet of our own, used only while NumbericsUI.sheet is the A1 stub (B1 owns the real primitive)
  var fb = null, fbFrom = null;
  function fbClose() {
    if (!fb || fb.hidden) return; fb.hidden = true;
    try { if (fbFrom && fbFrom.focus) fbFrom.focus({ preventScroll: true }); } catch (e) { /* focus is a nicety */ }
  }
  function fallback(doc) {
    if (!fb) {
      fb = doc.createElement("div"); fb.className = "scrim"; fb.id = "tro-sheet-fb"; fb.hidden = true;
      fb.innerHTML = '<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="tro-sheet-fb-h"><div class="grab"></div>' +
        '<div class="sh-head"><h2 id="tro-sheet-fb-h">Trophies</h2><button class="tb-btn" type="button" data-close aria-label="Close">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div><div class="sh-body"></div></div>';
      fb.addEventListener("click", function (e) { if (e.target === fb || (e.target.closest && e.target.closest("[data-close]"))) fbClose(); });
      fb.addEventListener("keydown", function (e) {
        if (e.key === "Escape") { e.preventDefault(); fbClose(); }
        else if (e.key === "Tab") { e.preventDefault(); fb.querySelector("[data-close]").focus(); } // one control: Tab stays on it
      });
      doc.body.appendChild(fb);
    }
    fbFrom = doc.activeElement; build(fb.querySelector(".sh-body")); fb.hidden = false;
    try { fb.querySelector("[data-close]").focus({ preventScroll: true }); } catch (e) { /* focus is a nicety */ }
    return fb;
  }
  function open() {
    var doc = dom(); if (!doc) return null;
    clearUnseen();
    var U = lib("NumbericsUI"), r = null;
    try { if (U && U.sheet) r = U.sheet("trophies", build, { title: "Trophies" }); } catch (e) { r = null; }
    if (U && typeof U.open === "function" && U.open()) return r;   // B1's sheet is up
    return doc.body ? fallback(doc) : null;
  }
  // the unseen dot on the cup after the top bar is built (ui.js loads last)
  (function () {
    var doc = dom(); if (!doc || !doc.addEventListener) return;
    function go() { if (load().unseen.length) call(lib("NumbericsUI"), "dot", true); }
    if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", go); else setTimeout(go, 0);
  })();

  return {
    KEY: KEY, GAMES: GAMES, REG: REG, GLYPHS: Object.keys(GLYPHS),
    report: report, has: has, earned: earned, unseen: unseen, fam: fam, find: find, counts: counts,
    glyph: glyph, pill: pill, pills: pills, html: html, build: build, open: open, close: fbClose,
    // pure board readers, exported for the tests
    _lines: { fibRun: fibRun, stair: stair, grownUp: grownUp }
  };
});
