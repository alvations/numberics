/* SPDX-License-Identifier: Apache-2.0 | Copyright 2026 alvations (Melon Lab)
 * Trophies (REDESIGN.md 8): every registry test unlocks on its boundary and not one below, secrets stay out of the
 * sheet until earned, no counts, the store shape and the Daily streak. `node tests/test-trophies.js` */
"use strict";
const fs = require("fs"), path = require("path");
// a fake localStorage we can clear, inspect or block between cases
const LS = { m: {}, blocked: false,
  getItem(k) { if (this.blocked) throw new Error("blocked"); return k in this.m ? this.m[k] : null; },
  setItem(k, v) { if (this.blocked) throw new Error("blocked"); this.m[k] = String(v); },
  removeItem(k) { delete this.m[k]; } };
global.window = { localStorage: LS };
const T = require("../shared/trophies.js"), P = require("../shared/progress.js");
let pass = 0, fail = 0;
function t(n, f) { try { f(); pass++; } catch (e) { fail++; console.log("FAIL", n, "\n  ", e.message); } }
function ok(c, m) { if (!c) throw new Error(m || "assertion failed"); }
const root = path.join(__dirname, "..");
let clock = new Date(2026, 10, 20, 12, 0, 0);       // noon, so Night owl never fires by accident
P._clock(() => clock);
function at(y, mo, d, h) { clock = new Date(y, mo - 1, d, h == null ? 12 : h, 0, 0); }
// a clean slate: the kit keeps a memory mirror too, so write an empty record through it once
function fresh() {
  LS.blocked = false; LS.m = {}; LS.m[T.KEY] = '{"v":1}'; LS.m[P.KEY] = '{"v":1}'; at(2026, 11, 20);
  T.report("zzz", "noop", {}, { quiet: true });
}
const g16 = v => Array(16).fill(v);

// One case per trophy: [setup(report) or null, game, event, data just below the boundary, data on the boundary].
// "below" is null where the trophy has no lower neighbour (any solve, any saved); the case then checks a near miss.
const CASES = {
  fam_first: ["two", "move", { top: 3 }, null, ["two", "end", { top: 3 }]],
  fam_five: [r => ["fibonacci", "three", "four", "five"].forEach(g => r(g, "x", {})), "six", "x", null, null],
  fam_all: [r => ["fibonacci", "two", "three", "four", "five", "six", "seven", "nine", "fifteen"].forEach(g => r(g, "x", {})), "sudoku", "x", null, null],
  fam_daily: ["seven", "end", { mode: "classic", daily: false }, { mode: "classic", daily: true }],
  fam_night: null, fam_week: null, fam_keep: ["fam", "load", {}, null, ["fam", "saved", {}]],
  fib_89: ["fibonacci", "move", { value: 55 }, { value: 89 }], fib_610: ["fibonacci", "move", { value: 377 }, { value: 610 }],
  fib_2584: ["fibonacci", "end", { value: 1597 }, { value: 2584 }], fib_10946: ["fibonacci", "move", { value: 6765 }, { value: 10946 }],
  fib_pure: ["fibonacci", "move", { value: 987, run: { used: 1 } }, { value: 987, run: { used: 0 } }],
  fib_chain: ["fibonacci", "move", { merges: 2 }, { merges: 3 }],
  fib_run: ["fibonacci", "move", { grid: [3, 5, 8, 13].concat(g16(0).slice(4)) }, { grid: [21, 13, 8, 5].concat(g16(0).slice(4)) }],
  fib_long: ["fibonacci", "move", { moves: 499 }, { moves: 500 }],
  two_128: ["two", "move", { top: 6 }, { top: 7 }], two_2048: ["two", "move", { top: 10 }, { top: 11 }],
  two_4096: ["two", "end", { top: 11 }, { top: 12 }], two_8192: ["two", "move", { top: 12 }, { top: 13 }],
  two_pure: ["two", "move", { top: 9, run: { used: 0 } }, { top: 10, run: { used: 0 } }],
  two_score: ["two", "end", { score: 19999 }, { score: 20000 }], two_chain: ["two", "move", { merges: 3 }, { merges: 4 }],
  two_comeback: ["two", "move", { moves: 149, run: { stuckUse: 100 } }, { moves: 150, run: { stuckUse: 100 } }],
  two_row: ["two", "move", { grid: [5, 4, 3, 2].concat(g16(0).slice(4)) }, { grid: [0, 0, 0, 3, 0, 0, 0, 4, 0, 0, 0, 5, 0, 0, 0, 6] }],
  thr_flush: ["three", "swipe", { flushes: 0 }, { flushes: 1 }], thr_96: ["three", "swipe", { top: 48 }, { top: 96 }],
  thr_384: ["three", "swipe", { top: 192 }, { top: 384 }], thr_five: ["three", "swipe", { run: { flushes: 4 } }, { run: { flushes: 5 } }],
  thr_double: ["three", "swipe", { flushes: 1 }, { flushes: 2 }],
  thr_mono: ["three", "swipe", { grid: g16(3).map((v, i) => i === 9 ? 2 : v) }, { grid: g16(3) }],
  thr_long: ["three", "swipe", { moves: 299 }, { moves: 300 }],
  four_win: ["four", "end", { won: false, level: "easy" }, { won: true, level: "easy", how: "colour" }],
  four_ten: ["four", "end", { won: true, how: "colour" }, { won: true, how: "ten" }],
  four_colour: ["four", "end", { won: true, how: "ten" }, { won: true, how: "colour" }],
  four_medium: ["four", "end", { won: true, level: "easy" }, { won: true, level: "medium" }],
  four_hard: ["four", "end", { won: false, level: "hard" }, { won: true, level: "hard" }],
  four_pure: ["four", "end", { won: true, level: "hard", used: 1 }, { won: true, level: "hard", used: 0 }],
  four_both: ["four", "end", { won: true, how: "ten" }, { won: true, how: "both" }],
  four_last: ["four", "end", { won: true, lastSlot: false }, { won: true, lastSlot: true }],
  five_round: ["five", "round", { won: false }, { won: true }], five_match: ["five", "match", { won: false }, { won: true }],
  five_medium: ["five", "match", { won: true, level: "easy" }, { won: true, level: "medium" }],
  five_hard: ["five", "match", { won: true, level: "medium" }, { won: true, level: "hard" }],
  five_sweep: ["five", "match", { won: true, p: 3, c: 1 }, { won: true, p: 3, c: 0 }],
  five_exact: ["five", "round", { won: true, burstAt: 6 }, { won: true, burstAt: 5 }],
  five_back: ["five", "match", { won: true, down02: false }, { won: true, down02: true }],
  six_first: ["six", "end", { mode: "climb", solved: 0 }, { tier: 1 }, ["six", "solve", { tier: 1 }]],
  six_tier3: ["six", "solve", { tier: 2 }, { tier: 3 }], six_tier5: ["six", "solve", { tier: 4 }, { tier: 5 }],
  six_climb: ["six", "solve", { mode: "climb", round: 9 }, { mode: "climb", round: 10 }],
  six_daily: ["six", "end", { mode: "climb" }, { mode: "daily" }], six_ten: ["six", "solve", { streak: 9 }, { streak: 10 }],
  six_bang: ["six", "solve", { helped: true, fact: 1 }, { helped: false, fact: 1 }],
  six_roots: ["six", "solve", { helped: false, sqrt: 1 }, { helped: false, sqrt: 2 }],
  sev_three: ["seven", "drop", { waves: 2 }, { waves: 3 }], sev_five: ["seven", "drop", { waves: 4 }, { waves: 5 }],
  sev_level: ["seven", "level", { mode: "classic", level: 4 }, { mode: "classic", level: 5 }],
  sev_score: ["seven", "end", { score: 6999 }, { score: 7000 }],
  sev_blitz: ["seven", "end", { mode: "blitz", score: 1999 }, { mode: "blitz", score: 2000 }],
  sev_daily: ["seven", "end", { mode: "daily", daily: false }, { mode: "daily", daily: true }],
  sev_clear: ["seven", "drop", { left: 1 }, { left: 0 }], sev_sevens: ["seven", "drop", { sevens: 2 }, { sevens: 3 }],
  nine_round: ["nine", "round", { won: false }, { won: true }], nine_match: ["nine", "match", { won: false }, { won: true }],
  nine_hard: ["nine", "match", { won: true, diff: "medium" }, { won: true, diff: "hard" }],
  nine_misere: ["nine", "match", { won: true, misere: false }, { won: true, misere: true }],
  nine_nine: ["nine", "match", { won: true, tiles: 8 }, { won: true, tiles: 9 }],
  nine_calm: ["nine", "take", { run: { zeroRun: 9 } }, { run: { zeroRun: 10 } }],
  nine_ones: ["nine", "round", { won: true, onlyOnes: false }, { won: true, onlyOnes: true }],
  fif_round: ["fifteen", "round", { won: false }, { won: true }], fif_match: ["fifteen", "match", { won: false }, { won: true }],
  fif_medium: ["fifteen", "match", { won: true, diff: "easy" }, { won: true, diff: "medium" }],
  fif_hard: ["fifteen", "match", { won: true, diff: "medium" }, { won: true, diff: "hard" }],
  fif_grid: ["fifteen", "round", { won: true, view: "numbers" }, { won: true, view: "grid" }],
  fif_fork: ["fifteen", "claim", { forks: 1 }, { forks: 2 }],
  fif_mid: ["fifteen", "round", { won: true, firstMid: false }, { won: true, firstMid: true }],
  sdk_first: ["sudoku", "place", { conflict: false }, null, ["sudoku", "solve", { difficulty: "easy" }]],
  sdk_medium: ["sudoku", "solve", { difficulty: "easy" }, { difficulty: "medium" }],
  sdk_hard: ["sudoku", "solve", { difficulty: "medium" }, { difficulty: "hard" }],
  sdk_pure: ["sudoku", "solve", { difficulty: "hard", used: { reveal: 0, check: 1, cands: 0 } }, { difficulty: "hard", used: { reveal: 0, check: 0, cands: 0 } }],
  sdk_quick: ["sudoku", "solve", { difficulty: "easy", seconds: 300 }, { difficulty: "easy", seconds: 299 }],
  sdk_daily: ["sudoku", "solve", { daily: false }, { daily: true }],
  sdk_nonotes: ["sudoku", "solve", { difficulty: "easy", notes: false }, { difficulty: "medium", notes: false }],
  sdk_clean: ["sudoku", "solve", { clean: false }, { clean: true }]
};

t("registry: 84 trophies, unique ids, the spec's per-game counts, two secrets per game and two family-wide", () => {
  ok(T.REG.length === 84, "count " + T.REG.length);
  const ids = new Set(T.REG.map(x => x.id)); ok(ids.size === 84, "unique ids");
  const per = {}, sec = {}; T.REG.forEach(x => { per[x.game] = (per[x.game] || 0) + 1; sec[x.game] = (sec[x.game] || 0) + (x.secret ? 1 : 0); });
  ok(per.fam === 7 && sec.fam === 2, "family");
  T.GAMES.forEach(g => { ok(per[g] >= 7 && per[g] <= 9, g + " has " + per[g]); ok(sec[g] === 2, g + " secrets " + sec[g]); });
  ok(Object.keys(per).length === 11, "only known games");
});
t("registry: every entry has name, description <= 60 chars, an existing glyph, events and a test", () => T.REG.forEach(x => {
  ok(x.name && x.desc && x.desc.length <= 60, x.id + " desc");
  ok(/^(sq|disc):.{1,5}$/.test(x.glyph) || T.GLYPHS.indexOf(x.glyph) >= 0, x.id + " glyph " + x.glyph);
  ok((x.on === "*" || (Array.isArray(x.on) && x.on.length)) && typeof x.test === "function", x.id + " on/test");
  ok(!/—/.test(x.name + x.desc), x.id + " em-dash");
}));
// The reviewed spoiler list: words from each secret's test that its description must not give away.
const SPOIL = { fam_night: ["4", "hour", "midnight", "am"], fam_keep: ["save", "file", "settings"],
  fib_run: ["consecutive", "row", "column", "5"], fib_long: ["500", "moves"], two_comeback: ["stuck", "power", "50"],
  two_row: ["level", "3", "column"], thr_mono: ["16", "3"], thr_long: ["300", "moves"], four_both: ["ten", "colour"],
  four_last: ["slot 42", "full"], five_exact: ["burstAt"], five_back: ["0-2", "down"], six_bang: ["!", "factorial"],
  six_roots: ["sqrt", "root of", "square"], sev_clear: ["eggs", "discs", "0"], sev_sevens: ["drop 7"],
  nine_calm: ["nim", "zero", "10"], nine_ones: ["1", "ones"], fif_fork: ["fork"], fif_mid: ["5", "centre"],
  sdk_nonotes: ["pencil", "medium", "hard"], sdk_clean: ["clash", "conflict", "red"] };
t("registry: secrets' descriptions never spoil the feat (reviewed word list)", () => T.REG.filter(x => x.secret).forEach(x => {
  ok(SPOIL[x.id], "no review row for " + x.id);
  SPOIL[x.id].forEach(w => ok(!(new RegExp("(^|\\W)" + w.replace(/[.*+?^${}()|[\]\\!]/g, "\\$&") + "($|\\W)", "i")).test(x.desc), x.id + " spoils '" + w + "'"));
}));
t("every trophy has a boundary case (the test table covers the whole registry)", () => T.REG.forEach(x => ok(x.id in CASES, x.id)));

T.REG.forEach(x => {
  const cs = CASES[x.id]; if (!cs) return;
  t("boundary: " + x.id + " unlocks on its boundary and not one below", () => {
    fresh();
    let game, ev, below, on, hit;
    if (typeof cs[0] === "function") { cs[0](T.report); [, game, ev] = cs; below = null; on = {}; }
    else [game, ev, below, on] = cs;
    if (below !== null) { const r = T.report(game, ev, below, { quiet: true }); ok(r.indexOf(x.id) < 0 && !T.has(x.id), "earned below: " + JSON.stringify(below)); }
    if (cs[4]) { [game, ev, on] = cs[4]; }
    else if (typeof cs[0] === "function") ok(!T.has(x.id), "earned during setup");
    hit = T.report(game, ev, on, { quiet: true });
    ok(hit.indexOf(x.id) >= 0 && T.has(x.id), "not earned on: " + game + " " + ev + " " + JSON.stringify(on));
    ok(T.report(game, ev, on, { quiet: true }).indexOf(x.id) < 0, "earned twice");
  });
});
t("boundary: fam_night at 3 o'clock, not at 4", () => {
  fresh(); at(2026, 11, 20, 4); ok(T.report("two", "move", {}).indexOf("fam_night") < 0);
  at(2026, 11, 20, 3); ok(T.report("two", "move", {}).indexOf("fam_night") >= 0 && T.has("fam_night"));
});
t("boundary: fam_week on the seventh Daily day in a row (across a month end), not the sixth", () => {
  fresh();
  for (let d = 25; d <= 30; d++) { at(2026, 11, d); ok(T.report("sudoku", "solve", { daily: true }).indexOf("fam_week") < 0, "day " + d); }
  ok(T.fam().streak.n === 6 && T.fam().streak.last === "20261130", JSON.stringify(T.fam().streak));
  at(2026, 12, 1); ok(T.report("six", "end", { mode: "daily" }).indexOf("fam_week") >= 0, "Dec 1 makes seven");
  ok(T.fam().streak.n === 7);
});
t("trophies from one game never fire on another game's events; unknown events earn nothing of a game", () => {
  fresh(); const r = T.report("seven", "move", { top: 20, value: 99999, merges: 9 });
  ok(!r.some(id => /^(two|fib)_/.test(id)), r.join());
  ok(T.report("two", "power", { name: "smash", stuck: true, top: 20 }).every(id => id.indexOf("fam_") === 0));
});
t("'endless' reports as Two (old id), and is counted once as played", () => {
  fresh(); ok(T.report("endless", "move", { top: 7 }).indexOf("two_128") >= 0);
  T.report("two", "move", {}); ok(Object.keys(T.fam().played).join() === "two");
});
t("fam: a game counts as played from its first event; 'fam' itself is not a game", () => {
  fresh(); T.report("fam", "saved"); ok(Object.keys(T.fam().played).length === 0);
  T.report("nine", "take", { amount: 1 }); ok(T.fam().played.nine === 1);
});

// ---- the Daily streak through report() (mocked dates) ----
t("streak: consecutive days add one, the same day twice counts once, a missed day restarts at 1", () => {
  fresh();
  at(2026, 11, 18); T.report("seven", "end", { daily: true, mode: "daily" }); ok(T.fam().streak.n === 1);
  T.report("six", "end", { mode: "daily" }); ok(T.fam().streak.n === 1, "same day");
  at(2026, 11, 19); T.report("sudoku", "solve", { daily: true }); ok(T.fam().streak.n === 2);
  at(2026, 11, 20); T.report("seven", "end", { mode: "classic", daily: false }); ok(T.fam().streak.n === 2, "a non-daily end changes nothing");
  ok(P.streak() === 2, "shown today (last was yesterday)");
  at(2026, 11, 21); ok(P.streak() === 0, "a missed day reads 0, quietly");
  at(2026, 11, 22); T.report("seven", "end", { daily: true }); ok(T.fam().streak.n === 1 && T.fam().streak.last === "20261122", "restarts at 1");
  ok(T.fam().dailyDays.join() === "20261118,20261119,20261122", T.fam().dailyDays.join());
});
t("streak: across a month and a year boundary; dailyDays keeps only the last 14", () => {
  fresh();
  at(2026, 12, 30); T.report("seven", "end", { daily: true }); at(2026, 12, 31); T.report("seven", "end", { daily: true });
  at(2027, 1, 1); T.report("seven", "end", { daily: true }); ok(T.fam().streak.n === 3 && T.fam().streak.last === "20270101");
  at(2027, 3, 1); T.report("seven", "end", { daily: true }); ok(T.fam().streak.n === 1, "Feb 28 was missed, Mar 1 restarts");
  fresh(); for (let d = 1; d <= 20; d++) { at(2026, 2, d); T.report("six", "end", { mode: "daily" }); }
  ok(T.fam().dailyDays.length === 14 && T.fam().dailyDays[0] === "20260207", T.fam().dailyDays.join());
  at(2026, 3, 1); T.report("six", "end", { mode: "daily" }); ok(T.fam().streak.n === 1, "2026 has no Feb 29");
  fresh(); at(2028, 2, 28); T.report("six", "end", { mode: "daily" }); at(2028, 2, 29); T.report("six", "end", { mode: "daily" });
  at(2028, 3, 1); T.report("six", "end", { mode: "daily" }); ok(T.fam().streak.n === 3, "leap year");
});

// ---- store shape ----
t("store: the spec shape, JSON round-trip, dates are local day keys", () => {
  fresh(); at(2026, 11, 20); T.report("two", "move", { top: 7 });
  const raw = JSON.parse(LS.m[T.KEY]);
  ok(raw.v === 1 && raw.got.two_128 === "20261120" && Array.isArray(raw.unseen) && raw.unseen.indexOf("two_128") >= 0, JSON.stringify(raw));
  ok(raw.fam.played.two === 1 && Array.isArray(raw.fam.dailyDays) && raw.fam.streak.n === 0, JSON.stringify(raw.fam));
  LS.m[T.KEY] = JSON.stringify(JSON.parse(LS.m[T.KEY]));       // save + load through a file (Settings Memory) keeps it
  ok(T.has("two_128") && T.earned().join() === T.earned().join());
});
t("store: junk and unknown ids are dropped one by one, never thrown", () => {
  fresh(); LS.m[T.KEY] = "{not json"; ok(T.earned().length === 0 && T.report("two", "move", {}).length >= 0);
  LS.m[T.KEY] = JSON.stringify({ v: 1, got: { two_128: "20261120", nope: "20261120", two_2048: 7 }, unseen: ["nope", "two_128", "two_128"],
    fam: { played: { endless: 1, zzz: 1 }, dailyDays: ["x", "20261120", "20261120"], streak: { n: "3", last: "bad" } } });
  ok(T.earned().join() === "two_128" && T.unseen().join() === "two_128", T.earned().join() + "|" + T.unseen().join());
  const f = T.fam(); ok(Object.keys(f.played).join() === "two" && f.dailyDays.join() === "20261120" && f.streak.n === 0, JSON.stringify(f));
});
t("store: blocked storage still earns in memory and never throws", () => {
  fresh(); LS.blocked = true;
  ok(T.report("two", "move", { top: 11 }).indexOf("two_2048") >= 0 && T.has("two_2048"), "memory");
  ok(T.report("two", "move", { top: 11 }).indexOf("two_2048") < 0, "once");
  LS.blocked = false;
});
t("earned() lists ids in registry order; unseen keeps order of earning", () => {
  fresh(); T.report("two", "move", { top: 11, merges: 4 }, { quiet: true });
  const e = T.earned(); ok(e.indexOf("two_128") < e.indexOf("two_2048") && e.indexOf("two_chain") > e.indexOf("two_2048"), e.join());
});

// ---- the sheet markup (pure html()) ----
t("sheet: nothing earned says so; no padlocks and no counts", () => {
  fresh(); const h = T.html(); ok(/Nothing yet\. Play any game to begin\./.test(h), h);
  ok(!/lock|\d+\s*(of|\/)\s*\d+|84|total/i.test(h), h);
});
t("sheet: earned only, grouped Everywhere first then O-7 order; secrets absent until earned, then marked", () => {
  fresh(); T.report("seven", "drop", { waves: 3 }); T.report("two", "move", { top: 7 }); T.report("fibonacci", "move", { value: 89 });
  let h = T.html();
  const heads = [...h.matchAll(/class="tro-game">([^<]+)</g)].map(m => m[1]);
  ok(heads.join() === "Fibonacci,Two,Seven", heads.join());
  T.REG.filter(x => x.secret).forEach(x => ok(h.indexOf(x.name) < 0 && h.indexOf(x.desc) < 0 && h.indexOf(x.id) < 0, x.id + " leaked"));
  T.REG.filter(x => !T.has(x.id)).forEach(x => ok(h.indexOf('data-trophy="' + x.id + '"') < 0, x.id + " not earned but shown"));
  at(2026, 11, 20, 2); T.report("five", "round", { won: true, burstAt: 5 }); h = T.html();
  const g = [...h.matchAll(/class="tro-game">([^<]+)</g)].map(m => m[1]); ok(g[0] === "Everywhere" && g.indexOf("Five") === 3, g.join());
  ok(/class="tr secret" data-trophy="five_exact"[\s\S]*?Right on five[\s\S]*?Burst at exactly five/.test(h), "earned secret shows its real description");
  ok(/class="tr secret" data-trophy="fam_night"/.test(h) && /class="tr" data-trophy="fam_first"/.test(h));
  ok(!/\d+\s*(of|\/)\s*\d+|lock|total/i.test(h.replace(/<svg[\s\S]*?<\/svg>/g, "")), "no counts");
});
t("glyphs: named paths and numbered squares and discs with the spec's font sizes", () => {
  ok(/<path d="M13 3L5 14h6l-1 7 8-11h-6z"\/>/.test(T.glyph("bolt")));
  ok(/<rect x="3.5" y="3.5" width="17" height="17" rx="3.5"\/>[\s\S]*font-size="7.6"[\s\S]*>128</.test(T.glyph("sq:128")));
  ok(/<circle cx="12" cy="12" r="8.5"\/>[\s\S]*font-size="9"[\s\S]*>7</.test(T.glyph("disc:7")));
  ok(/font-size="6"/.test(T.glyph("sq:4096")) && /font-size="9"/.test(T.glyph("sq:15")));
  T.REG.forEach(x => ok(/<(path|rect|circle)/.test(T.glyph(x.glyph)), x.id));
});
t("end-card pill: 'Trophy: <name>' with the glyph", () => {
  const h = T.pill("two_2048"); ok(/^<div class="trophy" data-trophy="two_2048"><svg[\s\S]*<\/svg>Trophy: The old finish line<\/div>$/.test(h), h);
  ok(T.pill("nope") === "");
});
t("board readers: Fibonacci run, staircase and the grown-up board", () => {
  const L = T._lines;
  ok(L.fibRun([5, 8, 13, 21].concat(g16(0).slice(4))) && L.fibRun([0, 34, 0, 0, 0, 21, 0, 0, 0, 13, 0, 0, 0, 8, 0, 0]));
  ok(!L.fibRun([5, 8, 13, 20].concat(g16(0).slice(4))) && !L.fibRun([1, 2, 3, 5].concat(g16(0).slice(4))) && !L.fibRun([8, 5, 13, 21].concat(g16(0).slice(4))));
  ok(L.stair([6, 5, 4, 3].concat(g16(0).slice(4))) && !L.stair([5, 4, 3, 2].concat(g16(0).slice(4))) && !L.stair([6, 5, 3, 4].concat(g16(0).slice(4))));
  ok(L.grownUp(g16(3)) && !L.grownUp(g16(3).map((v, i) => i ? v : 0)) && !L.grownUp(null));
});
t("report never throws on missing or odd data", () => {
  fresh(); ["move", "end", "solve", "round", "match", "drop", "swipe", "take", "claim", "level", "place", "power"].forEach(ev =>
    ["two", "fibonacci", "three", "four", "five", "six", "seven", "nine", "fifteen", "sudoku", "fam", "zzz"].forEach(g => {
      ok(Array.isArray(T.report(g, ev))); ok(Array.isArray(T.report(g, ev, { grid: "x", run: 5, used: null })));
    }));
});
t("Node: open(), pills() and the announce path are safe without a DOM", () => { ok(T.open() === null); T.pills(null, ["two_128"]); T.close(); });
require("./conventions")(t, ok, ["shared/trophies.js", "shared/progress.js"]);
t("trophies.js and progress.js make no network calls and never touch localStorage directly", () => ["shared/trophies.js", "shared/progress.js"].forEach(f => {
  const s = fs.readFileSync(path.join(root, f), "utf8");
  ok(!/fetch\(|XMLHttpRequest|sendBeacon|WebSocket|navigator\.send|https?:\/\//.test(s), f + " network");
  ok(!/localStorage/.test(s), f + " storage goes through NumbericsKit.store");
}));
console.log(pass + " passed, " + fail + " failed"); process.exit(fail ? 1 : 0);
