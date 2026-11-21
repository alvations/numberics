/* SPDX-License-Identifier: Apache-2.0 | Copyright 2026 alvations (Melon Lab)
 * NumbericsNav (docs/design/REDESIGN.md 3.3, 3.4): the games list, in games.json order (O-7), everywhere it shows.
 *   - <nav id="games" class="games" data-root="../" data-current="seven"> : the quiet text row (every game page)
 *   - <div id="games" class="cards" data-root="" data-current="two">       : the game cards (the root page)
 *   - <section id="today" class="today">                                    : the Today card (the root page)
 *   - NumbericsNav.openSheet() : the Games sheet (the top bar's Games button, shared/ui.js): Today, then every card
 *   - NumbericsNav.cards(el, {root, current}) and .today(el, {root}) draw into any element
 * Cards read NumbericsProgress (best, a live run, played) at draw time; nothing is sent anywhere.
 * LIVE mirrors the live entries of games.json, in its order (tests/test-shared.js keeps them identical). Static, so
 * it works from file://. Reordering the family is a one-line move in games.json plus this mirror. */
(function (w) {
  "use strict";
  var LIVE = [
    ["fibonacci", "Fibonacci", "fibonacci/", "Join neighbours in the Fibonacci run."],
    ["two", "Two", "", "2048 with no top tile."],
    ["three", "Three", "three/", "Count in threes, make rainbow rows."],
    ["four", "Four", "four/", "Four in a row, or four that make ten.", 1],
    ["five", "Five", "five/", "Add tile onto tile; at five it bursts.", 1],
    ["six", "Six", "six/", "Put signs between numbers to make six."],
    ["seven", "Seven", "seven/", "Drop discs; a number pops when it fits."],
    ["nine", "Nine", "nine/", "Take from the heaps. Take the last to win.", 1],
    ["fifteen", "Fifteen", "fifteen/", "Pick three numbers that make fifteen.", 1],
    ["sudoku", "Sudoku", "sudoku/", "The classic 9 by 9. One answer only."]
  ];
  if (typeof module === "object" && module.exports) { module.exports = LIVE; return; }
  var doc = w.document;
  // Two was called Endless; a page or a save that still says "endless" means Two
  function norm(id) { return id === "endless" ? "two" : id; }
  function href(g, root) { return g[2] ? root + g[2] : (root || "./"); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  // ---- previews: CSS only (theme.css .pv rules), exact content of REDESIGN.md 3.3 ----
  function hue(l) { return (l * 43 + 30) % 360; }
  function mt(v, l) { return '<span class="mt' + (l === 1 ? " lo" : l === 2 ? " lo2" : "") + '" style="--h:' + hue(l) + '">' + v + "</span>"; }
  function md(v, c) { return '<span class="md" style="--h2:' + c + '">' + v + "</span>"; }
  function mds(list) { return list.map(function (d) { return md(d[0], d[1]); }).join(""); }
  var E = "var(--cell)", G = "var(--accent)", B = "var(--cool)", EGG = "#8b8d9e";
  var PV = {
    fibonacci: '<div class="mg" style="grid-template-columns:repeat(4,26px)">' + mt(1, 1) + mt(2, 2) +
      '<span class="mt" style="background:hsl(178 66% 62%)">3</span><span class="mt" style="background:hsl(320 66% 64%)">5</span></div>',
    two: '<div class="mg" style="grid-template-columns:repeat(2,26px)">' + mt(2, 1) + mt(4, 2) + mt(8, 3) + mt(16, 4) + "</div>",
    three: '<div class="mg" style="grid-template-columns:repeat(3,26px)"><span class="mt" style="background:hsl(4 70% 64%)">3</span>' +
      '<span class="mt" style="background:hsl(30 80% 62%)">6</span><span class="mt" style="background:hsl(50 80% 60%)">9</span></div>',
    four: '<div class="mg" style="grid-template-columns:repeat(5,20px)">' + mds([["", E], ["", E], ["", E], [4, G], ["", E],
      ["", E], [3, G], [2, B], [1, B], ["", E], [1, G], [2, B], [4, B], [1, G], [3, B]]) + "</div>",
    five: '<div class="eq"><span class="mt" style="background:hsl(205 70% 62%);width:30px;height:30px">2</span><span class="op">+</span>' +
      '<span class="mt" style="background:hsl(152 60% 58%);width:30px;height:30px">3</span><span class="op">=</span>' +
      '<span style="color:var(--accent-text);font-size:18px">5!</span></div>',
    six: '<div class="eq">' + [0, 1, 2].map(function () { return '<span class="mt" style="background:hsl(55 70% 60%)">2</span>'; }).join('<span class="op">+</span>') +
      '<span class="op">=</span><span class="mt" style="background:var(--accent)">6</span></div>',
    seven: '<div class="mg" style="grid-template-columns:repeat(5,20px)">' + mds([["", E], ["", E], [3, "hsl(160 60% 60%)"], ["", E], ["", E],
      ["", E], [7, "hsl(330 60% 66%)"], [2, "hsl(120 55% 55%)"], ["", E], [4, "hsl(205 70% 64%)"],
      ["", EGG], [6, "hsl(285 55% 66%)"], [1, "hsl(40 30% 88%)"], [5, "hsl(20 75% 64%)"], ["", EGG]]) + "</div>",
    nine: '<div class="mg" style="grid-template-columns:repeat(3,30px)">' + [7, 3, 5].map(function (n, i) {
      var p = ""; for (var k = 0; k < 9; k++) p += '<i style="opacity:' + (k < n ? 0.8 : 0.15) + '"></i>';
      return '<span class="mt" style="width:30px;height:34px;display:flex;flex-direction:column;align-items:center;justify-content:center;background:hsl(' +
        [330, 160, 250][i] + ' 60% 64%)">' + n + '<span class="pips">' + p + "</span></span>";
    }).join("") + "</div>",
    fifteen: '<div class="mg" style="grid-template-columns:repeat(3,22px)">' + [8, 1, 6, 3, 5, 7, 4, 9, 2].map(function (n, i) {
      var mine = [1, 4, 7].indexOf(i) >= 0, cpu = [0, 8].indexOf(i) >= 0;
      return '<span class="mt" style="width:22px;height:22px;font-size:12px;border-radius:5px;background:' + (mine ? G : cpu ? B : E) +
        ";color:" + (mine || cpu ? "var(--tile-ink)" : "var(--mute)") + '">' + n + "</span>";
    }).join("") + "</div>",
    sudoku: '<div class="sq9"><span>5</span><span class="c">3</span><span></span><span>6</span><span></span><span class="c">9</span>' +
      '<span></span><span>9</span><span class="c">8</span></div>'
  };

  function progress(id) {
    var P = w.NumbericsProgress, g = null, played = false;
    try { if (P) { g = P.get(id); played = P.played(id); } } catch (e) { g = null; }
    return { best: g && g.best || "", live: !!(g && g.live), played: played || !!(g && (g.best || g.live)) };
  }
  // one card: preview, name, blurb, then tags: Playing (this page), vs computer, Continue (a live run), the best, or New to you
  function card(g, root, cur) {
    var here = g[0] === cur, pr = progress(g[0]), tags = "";
    if (here) tags += '<span class="tag go">Playing</span>';
    if (g[4]) tags += '<span class="tag vs">vs computer</span>';
    if (pr.live && !here) tags += '<span class="tag cont">Continue</span>';
    if (pr.best) tags += '<span class="tag best">' + esc(pr.best) + "</span>";
    else if (!pr.played && !here) tags += '<span class="tag new">New to you</span>';
    return '<a class="card" href="' + href(g, root) + '" data-id="' + g[0] + '"' + (here ? ' aria-current="page"' : "") +
      '><div class="pv" aria-hidden="true">' + (PV[g[0]] || "") + '</div><div class="body"><b>' + esc(g[1]) +
      '</b><span class="blurb">' + esc(g[3]) + '</span><div class="foot">' + tags + "</div></div></a>";
  }
  function cards(el, opts) {
    if (!el) return; opts = opts || {};
    var root = opts.root || "", cur = norm(opts.current || "");
    el.classList.add("cards");
    el.innerHTML = LIVE.map(function (g) { return card(g, root, cur); }).join("");
  }

  // ---- the Today card (3.4): the three Dailies, done (the day's best) or not yet, and the daily streak, always shown
  // ("Start a streak today" at 0, TRIAGE4 D4). Chips say "Daily" so they never read as the game cards (D9), and the
  // Daily Sudoku's chip shows its level. The card redraws at local midnight and when a tab comes back on a new day. ----
  var FLAME = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3c1 4 5 5.5 5 10a5 5 0 01-10 0c0-2.4 1.2-3.6 2.4-4.6.3 1.6 1 2.6 2.1 3C11 9 11 6 12 3z"/></svg>';
  var DAILIES = [["seven", "Seven"], ["six", "Six"], ["sudoku", "Sudoku"]];
  function today(el, opts) {
    if (!el) return; opts = opts || {};
    var root = opts.root || "", P = w.NumbericsProgress, t = null;
    try { t = P && P.todayCard ? P.todayCard() : null; } catch (e) { t = null; }
    if (!t) {
      var d = new Date(), label = "";
      try { label = d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" }); } catch (e) { label = ""; }
      t = { label: label, streak: 0, done: {}, levels: {} };
    }
    var n = Math.max(0, Math.floor(+t.streak || 0)), lv = t.levels || {};
    el.classList.add("today"); el.setAttribute("data-day", t.day || "");
    el.innerHTML = '<div class="when"><span>Today · ' + esc(t.label) + "</span>" +
      (n >= 1 ? '<span class="streak">' + FLAME + n + (n === 1 ? " day" : " days") + "</span>"
        : '<span class="streak zero">' + FLAME + "Start a streak today</span>") + "</div>" +
      "<h3>Three dailies, the same for everyone</h3><div class=\"chips\">" + DAILIES.map(function (g) {
        var r = t.done && t.done[g[0]], l = lv[g[0]] ? '<small class="lv">' + esc(cap(lv[g[0]])) + "</small>" : "";
        return '<a class="chip' + (r ? " done" : "") + '" href="' + root + g[0] + '/?mode=daily" data-daily="' + g[0] + '"' +
          (r ? ' title="Done today"' : "") + ">Daily " + g[1] + l + "<small>" + (r ? "Best " + esc(r) : "Not yet") + "</small></a>";
      }).join("") + "</div>";
    armMidnight();
  }
  function cap(x) { x = String(x); return x.charAt(0).toUpperCase() + x.slice(1); }
  // the Today label rolls over at midnight with the page open (round-4 mechanics: it went stale until a reload)
  var midT = null;
  function armMidnight() {
    var P = w.NumbericsProgress; if (!P || !P.msToMidnight || midT !== null) return;
    var ms = 0; try { ms = P.msToMidnight(); } catch (e) { return; }
    midT = setTimeout(function () { midT = null; redrawToday(); }, Math.max(1000, Math.min(ms, 2147483000)));
  }
  function redrawToday() {
    var td = doc.getElementById("today"); if (td) today(td, here());
    var sh = doc.querySelector('#sh-games:not([hidden]) section[aria-label="Today"]'); if (sh) today(sh, here());
  }
  function stale() {
    var P = w.NumbericsProgress, td = doc.getElementById("today"); if (!P || !td) return false;
    try { return td.getAttribute("data-day") !== P.dayKey(); } catch (e) { return false; }
  }

  // ---- the quiet text row (every game page until its D package swaps in the cards) ----
  function row(el, root, cur) {
    LIVE.forEach(function (g) {
      var a = doc.createElement("a"); a.href = href(g, root); a.title = g[3] + (g[4] ? " (vs computer)" : "");
      a.textContent = g[1];
      if (g[0] === cur) a.setAttribute("aria-current", "page");
      el.appendChild(a);
    });
  }

  // where this page sits and which game it is (the games list or the top bar carries data-root; data-current names it)
  function here() {
    var el = doc.getElementById("games"), tb = doc.getElementById("topbar");
    var root = el && el.hasAttribute("data-root") ? el.getAttribute("data-root") : tb ? tb.getAttribute("data-root") || "" : "";
    return { root: root || "", current: norm(el ? el.getAttribute("data-current") || "" : "") };
  }
  function draw() {
    var h = here(), el = doc.getElementById("games"), td = doc.getElementById("today");
    if (el) { el.innerHTML = ""; if (el.classList.contains("cards")) cards(el, h); else row(el, h.root, h.current); }
    if (td) today(td, h);
  }
  // the Games sheet: Today at the top, then every game in order
  function openSheet() {
    var U = w.NumbericsUI; if (!U || !U.sheet) return null;
    var h = here();
    return U.sheet("games", function (body) {
      var t = doc.createElement("section"); t.setAttribute("aria-label", "Today"); body.appendChild(t); today(t, h);
      var c = doc.createElement("div"); c.setAttribute("aria-label", "Numberics games"); body.appendChild(c); cards(c, h);
    });
  }
  w.NumbericsNav = { LIVE: LIVE, cards: cards, today: today, redrawToday: redrawToday, openSheet: openSheet, draw: draw, preview: function (id) { return PV[norm(id)] || ""; } };
  draw();
  // a run saved in another tab, or a page restored from the back-forward cache: redraw so the tags are current
  w.addEventListener("pageshow", function (e) { if (e.persisted || stale()) draw(); });
  // a tab left open overnight (timers sleep in the background): redraw Today when it comes back on a new day
  doc.addEventListener("visibilitychange", function () { if (doc.visibilityState === "visible" && stale()) { clearTimeout(midT); midT = null; redrawToday(); } });
})(typeof window !== "undefined" ? window : this);
