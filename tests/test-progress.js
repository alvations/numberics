/* SPDX-License-Identifier: Apache-2.0 | Copyright 2026 alvations (Melon Lab)
 * Progress (REDESIGN.md 3.5, 8.5): per-game summaries, how-to flags, today's Daily results, the streak rule across
 * days (mocked dates: a missed day, month and year ends), Two's day-one fallback, blocked storage. `node tests/test-progress.js` */
"use strict";
const LS = { m: {}, blocked: false,
  getItem(k) { if (this.blocked) throw new Error("blocked"); return k in this.m ? this.m[k] : null; },
  setItem(k, v) { if (this.blocked) throw new Error("blocked"); this.m[k] = String(v); } };
global.window = { localStorage: LS };
const P = require("../shared/progress.js"), T = require("../shared/trophies.js");
let pass = 0, fail = 0;
function t(n, f) { try { f(); pass++; } catch (e) { fail++; console.log("FAIL", n, "\n  ", e.message); } }
function ok(c, m) { if (!c) throw new Error(m || "assertion failed"); }
let clock = new Date(2026, 10, 20, 12);
P._clock(() => clock);
function at(y, mo, d, h) { clock = new Date(y, mo - 1, d, h == null ? 12 : h); }
function fresh() {
  LS.blocked = false; LS.m = {}; LS.m[P.KEY] = '{"v":1}'; LS.m[T.KEY] = '{"v":1}'; at(2026, 11, 20);
  P.markHowto("zzz"); T.report("zzz", "noop", {}, { quiet: true }); LS.m[P.KEY] = '{"v":1}'; P._reset();
}

t("day keys are local YYYYMMDD; prevDay crosses month, year and leap-day ends", () => {
  ok(P.dayKey(new Date(2026, 10, 20, 0, 5)) === "20261120" && P.dayKey(new Date(2026, 10, 20, 23, 59)) === "20261120");
  ok(P.prevDay("20261201") === "20261130" && P.prevDay("20270101") === "20261231");
  ok(P.prevDay("20260301") === "20260228" && P.prevDay("20280301") === "20280229");
  ok(P.isDay("20261120") && !P.isDay("20261131") && !P.isDay("2026112") && !P.isDay(20261120));
});
t("streak rule: next day +1, same day unchanged, a gap restarts at 1; shown only while today or yesterday", () => {
  let s = P.streakAfter(null, "20261129"); ok(s.n === 1 && s.last === "20261129");
  s = P.streakAfter(s, "20261129"); ok(s.n === 1, "same day");
  s = P.streakAfter(s, "20261130"); s = P.streakAfter(s, "20261201"); ok(s.n === 3 && s.last === "20261201", "month end");
  ok(P.streakNow(s, "20261201") === 3 && P.streakNow(s, "20261202") === 3, "alive today and tomorrow");
  ok(P.streakNow(s, "20261203") === 0, "a missed day shows 0");
  ok(P.streakAfter(s, "20261203").n === 1, "and the next Daily restarts at 1");
  ok(P.streakNow({ n: "x", last: "20261201" }, "20261201") === 0 && P.streakNow(null, "20261201") === 0, "junk reads 0");
});
t("put / get: the spec shape, merged field by field, stamped with the time", () => {
  fresh(); at(2026, 11, 20, 9);
  P.put("seven", { best: "Best 579", live: true, liveText: "Score 120" });
  let g = P.get("seven"); ok(g.best === "Best 579" && g.live === true && g.liveText === "Score 120" && g.at === clock.getTime(), JSON.stringify(g));
  P.put("seven", { live: false }); g = P.get("seven"); ok(g.best === "Best 579" && g.live === false && g.liveText === "", JSON.stringify(g));
  ok(P.get("nine") === null);
  const raw = JSON.parse(LS.m[P.KEY]); ok(raw.v === 1 && raw.games.seven && raw.howto && raw.daily, JSON.stringify(raw));
});
t("how-to seen flags", () => {
  fresh(); ok(P.seenHowto("four") === false); P.markHowto("four"); ok(P.seenHowto("four") === true && P.seenHowto("five") === false);
  P.markHowto("endless"); ok(P.seenHowto("two"), "old id maps to Two");
});
t("daily: today's results only; yesterday's entry is dropped on the next write and never read", () => {
  fresh(); at(2026, 11, 30);
  P.daily("seven", "1,204"); P.daily("six", "4 made");
  ok(JSON.stringify(P.today()) === JSON.stringify({ seven: "1,204", six: "4 made" }), JSON.stringify(P.today()));
  at(2026, 12, 1); ok(JSON.stringify(P.today()) === "{}", "a new day starts empty");
  P.daily("sudoku", "6:12"); const raw = JSON.parse(LS.m[P.KEY]);
  ok(Object.keys(raw.daily).join() === "20261201" && raw.daily["20261201"].sudoku === "6:12", JSON.stringify(raw.daily));
});
t("Today card data: date label, streak from the trophies record, today's results", () => {
  fresh(); at(2026, 11, 19); T.report("seven", "end", { daily: true }, { quiet: true });
  at(2026, 11, 20); T.report("sudoku", "solve", { daily: true }, { quiet: true }); P.daily("sudoku", "6:12");
  const c = P.todayCard(); ok(c.day === "20261120" && c.streak === 2 && c.done.sudoku === "6:12" && typeof c.label === "string" && c.label.length > 0, JSON.stringify(c));
  at(2026, 11, 22); ok(P.todayCard().streak === 0 && JSON.stringify(P.todayCard().done) === "{}", "missed day: 0, quietly");
});
t("played: from the trophies record (first event), a summary, or Two's own save", () => {
  fresh(); ok(!P.played("nine")); T.report("nine", "take", { amount: 1 }, { quiet: true }); ok(P.played("nine"));
  ok(!P.played("four")); P.put("four", { best: "Won 1, lost 0" }); ok(P.played("four"));
});
t("Two's day-one fallback: derived once from numberics_endless_v1 when progress has no entry", () => {
  fresh(); LS.m.numberics_endless_v1 = JSON.stringify({ state: { over: false, moves: 40, score: 1136 }, bestScore: 2400, bestTop: 8, bestBefore: 0 });
  P._reset(); let g = P.get("two");
  ok(g && g.best === "Best 2,400" && g.live === true && g.liveText === "Score 1,136", JSON.stringify(g));
  ok(JSON.stringify(P.get("endless")) === JSON.stringify(g) && P.played("two"));
  P.put("two", { best: "Best 3,000", live: false }); g = P.get("two"); ok(g.best === "Best 3,000" && !g.live, "the game's own put wins");
  fresh(); LS.m.numberics_endless_v1 = JSON.stringify({ state: { over: true, moves: 90, score: 500 }, bestScore: 500 }); P._reset();
  g = P.get("two"); ok(g.best === "Best 500" && g.live === false, JSON.stringify(g));
  fresh(); LS.m.numberics_endless_v1 = JSON.stringify({ state: { over: false, moves: 0, score: 0 }, bestScore: 0 }); P._reset();
  ok(P.get("two") === null, "a fresh untouched board is not a run");
});
t("junk records are cleaned field by field and never throw", () => {
  fresh(); LS.m[P.KEY] = JSON.stringify({ v: 1, games: { a: 5, b: { best: 3, live: "y", at: "x" } }, howto: { c: 1, d: 0 }, daily: { "20261120": { six: 4, seven: "9" }, x: 1 } });
  ok(P.get("a") === null && P.get("b").best === "" && P.get("b").live === true && P.get("b").at === 0);
  ok(P.seenHowto("c") && !P.seenHowto("d") && JSON.stringify(P.today()) === '{"seven":"9"}', JSON.stringify(P.today()));
  LS.m[P.KEY] = "nope{"; P.put("x", {}); ok(P.get("x") !== null);
});
t("blocked storage: every call works in memory and never throws", () => {
  fresh(); LS.blocked = true;
  P.put("six", { best: "Best round 3" }); ok(P.get("six").best === "Best round 3");
  P.daily("six", "4 made"); ok(P.today().six === "4 made"); P.markHowto("six"); ok(P.seenHowto("six"));
  ok(typeof P.todayCard().streak === "number" && P.played("six"));
  LS.blocked = false;
});
t("the record is plain JSON (Settings Save/Load round-trips it)", () => {
  fresh(); P.put("three", { best: "Best 1,284", live: true, liveText: "Score 30" }); P.daily("seven", "88"); P.markHowto("three");
  const s = LS.m[P.KEY]; LS.m[P.KEY] = JSON.stringify(JSON.parse(s));
  ok(LS.m[P.KEY] === s && P.get("three").liveText === "Score 30" && P.today().seven === "88" && P.seenHowto("three"));
});
console.log(pass + " passed, " + fail + " failed"); process.exit(fail ? 1 : 0);
