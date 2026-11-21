/* SPDX-License-Identifier: Apache-2.0 | Copyright 2026 alvations (Melon Lab)
 * NumbericsProgress (REDESIGN.md 3.5, 8.5): the per-game summaries the cards and the Today card read, in
 * numberics_progress_v1 through NumbericsKit.store; the day helpers and the Daily streak rule. Notes: docs/CODE-NOTES.md#sharedprogressjs */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(root);
  else root.NumbericsProgress = factory(root);
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";
  var KEY = "numberics_progress_v1", TWO_KEY = "numberics_endless_v1";
  function lib(name, file) {
    var g = (typeof window !== "undefined" && window) || root;
    if (g && g[name]) return g[name];
    try { if (typeof require === "function") return require(file); } catch (e) { /* not in Node */ }
    return null;
  }
  // a store that never throws, even without the kit (degrades to memory)
  function mkStore(key) {
    var K = lib("NumbericsKit", "./kit.js");
    if (K && K.store) return K.store(key);
    var mem = null;
    return { load: function () { try { return mem ? JSON.parse(mem) : null; } catch (e) { return null; } },
             save: function (o) { mem = JSON.stringify(o); } };
  }

  // ---- local days (pure). A day key is "YYYYMMDD" in local time. ----
  var clock = function () { return new Date(); };
  function now() { return clock(); }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function dayKey(d) { d = d || now(); return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()); }
  function parseDay(k) { k = String(k); return new Date(+k.slice(0, 4), +k.slice(4, 6) - 1, +k.slice(6, 8), 12); }
  function prevDay(k) { var d = parseDay(k); return dayKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1, 12)); }
  function isDay(k) { return typeof k === "string" && /^\d{8}$/.test(k) && dayKey(parseDay(k)) === k; }
  // the streak after a Daily is finished on `today`: the same day keeps it, the next day adds one, a gap restarts at 1
  function streakAfter(st, today) {
    st = st && typeof st === "object" ? st : {}; var n = +st.n > 0 ? Math.floor(+st.n) : 0, last = isDay(st.last) ? st.last : "";
    if (last === today) return { n: Math.max(1, n), last: today };
    return { n: last && last === prevDay(today) ? n + 1 : 1, last: today };
  }
  // the streak to show on `today`: alive while its last day is today or yesterday; a missed day reads 0 (quietly)
  function streakNow(st, today) {
    if (!st || !isDay(st.last) || !(+st.n > 0)) return 0;
    return st.last === today || st.last === prevDay(today) ? Math.floor(+st.n) : 0;
  }

  // ---- the store ----
  var store = mkStore(KEY), twoStore = null, twoMemo;
  function blank() { return { v: 1, games: {}, howto: {}, daily: {}, part: {} }; }
  function clean(o) {
    var d = blank(); if (!o || typeof o !== "object") return d;
    if (o.games && typeof o.games === "object") Object.keys(o.games).forEach(function (id) {
      var g = o.games[id]; if (!g || typeof g !== "object") return;
      d.games[id] = { best: typeof g.best === "string" ? g.best : "", live: !!g.live,
                      liveText: typeof g.liveText === "string" ? g.liveText : "", at: +g.at || 0 };
    });
    if (o.howto && typeof o.howto === "object") Object.keys(o.howto).forEach(function (id) { if (o.howto[id]) d.howto[id] = true; });
    var t = dayKey();
    if (o.daily && typeof o.daily === "object" && o.daily[t] && typeof o.daily[t] === "object") {
      d.daily[t] = {}; Object.keys(o.daily[t]).forEach(function (id) { var e = entry(o.daily[t][id]); if (e) d.daily[t][id] = e; });
    }
    if (o.part && typeof o.part === "object" && o.part[t] && typeof o.part[t] === "object") {
      d.part[t] = {}; Object.keys(o.part[t]).forEach(function (id) { if (typeof o.part[t][id] === "string") d.part[t][id] = o.part[t][id]; });
    }
    return d;
  }
  // a daily entry: plain text, or { t, s, low } when the game gave a score; anything else is dropped
  function entry(e) {
    if (typeof e === "string") return e;
    if (e && typeof e === "object" && typeof e.t === "string") {
      var o = { t: e.t }; if (typeof e.s === "number" && isFinite(e.s)) { o.s = e.s; if (e.low === true) o.low = true; } return o;
    }
    return null;
  }
  function text(e) { return typeof e === "string" ? e : e && typeof e.t === "string" ? e.t : ""; }
  function load() { return clean(store.load()); }
  function save(d) { store.save(d); }
  function norm(id) { return id === "endless" ? "two" : String(id); }
  function fmt(n) { return Number(n).toLocaleString("en-US"); }

  // Two's card on day one: derived once from its own save when progress has no entry yet
  function fromTwoSave() {
    if (twoMemo !== undefined) return twoMemo;
    twoStore = twoStore || mkStore(TWO_KEY);
    var s = twoStore.load(), r = null;
    if (s && typeof s === "object") {
      var st = s.state && typeof s.state === "object" ? s.state : null, bs = +s.bestScore || 0;
      var live = !!(st && !st.over && +st.moves > 0);
      if (bs > 0 || live) r = { best: bs > 0 ? "Best " + fmt(bs) : "", live: live, liveText: live ? "Score " + fmt(+st.score || 0) : "", at: 0 };
    }
    twoMemo = r; return r;
  }

  function put(id, sum) {
    id = norm(id); sum = sum || {}; var d = load(), g = d.games[id] || { best: "", live: false, liveText: "", at: 0 };
    if (typeof sum.best === "string") g.best = sum.best;
    if ("live" in sum) g.live = !!sum.live;
    if (typeof sum.liveText === "string") g.liveText = sum.liveText;
    else if (!g.live) g.liveText = "";
    g.at = now().getTime(); d.games[id] = g; save(d);
  }
  function get(id) {
    id = norm(id); var g = load().games[id];
    if (g) return { best: g.best, live: g.live, liveText: g.liveText, at: g.at };
    if (id === "two") { var t = fromTwoSave(); return t ? { best: t.best, live: t.live, liveText: t.liveText, at: t.at } : null; }
    return null;
  }
  function daily(id, txt, opts) {
    var d = load(), t = dayKey(), e = d.daily[t] || {}, k = norm(id), old = e[k], sc = opts && typeof opts.score === "number" && isFinite(opts.score) ? opts.score : null;
    var next = sc === null ? String(txt) : { t: String(txt), s: sc };
    if (sc !== null && opts.low === true) next.low = true;
    if (sc !== null && old && typeof old === "object" && typeof old.s === "number") {
      var lower = next.low === true; if (lower ? !(sc < old.s) : !(sc > old.s)) return false; // not better: keep the day's best
    }
    e[k] = next; d.daily = {}; d.daily[t] = e; save(d); return true;
  }
  function today() { var e = load().daily[dayKey()] || {}, o = {}; Object.keys(e).forEach(function (k) { o[k] = text(e[k]); }); return o; }
  // a Daily under way (TRIAGE5 S5): dailyPart(id, "2 of 6"), today's line for the Today chip until it is done
  function dailyPart(id, txt) {
    var d = load(), t = dayKey(), e = d.part[t] || {}; e[norm(id)] = String(txt); d.part = {}; d.part[t] = e; save(d); return true;
  }
  function parts() { var e = load().part[dayKey()] || {}, o = {}; Object.keys(e).forEach(function (k) { o[k] = e[k]; }); return o; }
  function dailyLevel(dt) { var w = (dt || now()).getDay(); return w === 0 ? "hard" : w >= 5 ? "medium" : "easy"; }
  function seenHowto(id) { return !!load().howto[norm(id)]; }
  function markHowto(id) { var d = load(); d.howto[norm(id)] = true; save(d); }
  // the family-wide record lives with the trophies (REDESIGN.md 8.1 fam); read it there
  function fam() { var T = lib("NumbericsTrophies", "./trophies.js"); return T && T.fam ? T.fam() : { played: {}, dailyDays: [], streak: { n: 0, last: "" } }; }
  function played(id) { id = norm(id); return !!(fam().played[id] || load().games[id] || (id === "two" && fromTwoSave())); }
  function streak() { return streakNow(fam().streak, dayKey()); }
  // everything the Today card draws
  function todayCard() {
    var d = now(), label = "";
    try { label = d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" }); } catch (e) { label = dayKey(d); }
    return { day: dayKey(d), label: label, streak: streak(), done: today(), part: parts(), levels: { sudoku: dailyLevel(d) } };
  }
  // ms from now until the next local midnight (the Today card redraws then)
  function msToMidnight() { var d = now(); return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 1).getTime() - d.getTime(); }
  return {
    KEY: KEY, put: put, get: get, daily: daily, dailyPart: dailyPart, parts: parts, today: today, seenHowto: seenHowto, markHowto: markHowto,
    played: played, streak: streak, todayCard: todayCard, dailyLevel: dailyLevel, msToMidnight: msToMidnight,
    // pure day helpers and the streak rule (NumbericsTrophies uses these)
    now: now, dayKey: dayKey, prevDay: prevDay, isDay: isDay, streakAfter: streakAfter, streakNow: streakNow,
    // tests only: pin the clock (a function returning a Date) and drop the memo of Two's save
    _clock: function (fn) { clock = fn || function () { return new Date(); }; },
    _reset: function () { twoMemo = undefined; }
  };
});
