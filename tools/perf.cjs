/* SPDX-License-Identifier: Apache-2.0 | Copyright 2026 alvations (Melon Lab)
 * The PERF gate: load and play every live game in games.json (plus the root page) in Chromium, at phone
 * (390x844, 4x CPU throttling) and desktop (1280x860, no throttling), and check tools/perf-budgets.json.
 *   NODE_PATH=$(npm root -g) node tools/perf.cjs [id ...]
 * Env: PERF_OUT=<file> (JSON report, default <os tmpdir>/numberics-perf-report.json), PERF_RUNS (default 3,
 * timing metrics are the median of the runs), PERF_PLAY_MS (default 20000), PERF_VIEWS=phone,desktop.
 * Exits 1 when any budget fails and prints each failure. Read tools/PERF.md before changing a budget. */
"use strict";
let chromium; try { ({ chromium } = require("playwright")); } catch (e) { console.log("perf: playwright not installed (NODE_PATH=$(npm root -g))"); process.exit(1); }
const http = require("http"), fs = require("fs"), path = require("path"), os = require("os");
const root = path.join(__dirname, "..");
const RUNS = Math.max(1, +process.env.PERF_RUNS || 3);
const PLAY_MS = Math.max(1000, +process.env.PERF_PLAY_MS || 20000);
const OUT = process.env.PERF_OUT || path.join(os.tmpdir(), "numberics-perf-report.json");
const VIEWS = [
  { tag: "phone", viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, cpu: 4 },
  { tag: "desktop", viewport: { width: 1280, height: 860 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false, cpu: 1 },
].filter(v => !process.env.PERF_VIEWS || process.env.PERF_VIEWS.split(",").includes(v.tag));

// Small, optional per-game play hints. Anything not listed plays generically: arrow keys, Enter and clicks on
// whatever is clickable outside the header, the games row, the difficulty row and New game.
// keys: keys pressed (repeat a key to weight it); click: share of actions that are clicks (0..1); sel: extra
// click targets; seq + seqP: tap sequences (one selector per tap) tried with probability seqP. Unknown ids (new games, renamed games) just play generically.
const PLAY = {
  endless: { keys: ["ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown"], click: 0.05 },
  two: { keys: ["ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown"], click: 0.05 },
  fibonacci: { keys: ["ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown"], click: 0.05 },
  three: { keys: ["ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown"], click: 0.1 },
  seven: { keys: ["ArrowLeft", "ArrowRight", "Enter", "Enter"], click: 0.2 },
  sudoku: { keys: ["ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown", "1", "2", "3", "4", "5", "6", "7", "8", "9"], click: 0.3 },
  four: { keys: ["ArrowLeft", "ArrowRight", "Enter", "Enter"], click: 0.5 },
  five: { keys: ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Enter", "Enter"], click: 0.5, seqP: 0.6,
    seq: [['.slot[data-i="0"], .slot[data-i="1"]', '.slot']] },
  fifteen: { keys: ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Enter", "Enter"], click: 0.5 },
  nine: { keys: ["ArrowLeft", "ArrowRight", "ArrowDown", "Enter", "Enter"], click: 0.4 },
  six: { keys: ["ArrowLeft", "ArrowRight", "Enter"], click: 0.8 },
};
const GENERIC = { keys: ["ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown", "Enter", " "], click: 0.5 };

const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png",
  ".svg": "image/svg+xml", ".ico": "image/x-icon", ".woff2": "font/woff2", ".webmanifest": "application/manifest+json", ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".wav": "audio/wav" };
const srv = http.createServer((q, r) => {
  let f = path.join(root, decodeURIComponent(q.url.split("?")[0]));
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, "index.html");
  if (!f.startsWith(root) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { "content-type": types[path.extname(f)] || "application/octet-stream" }); r.end(fs.readFileSync(f));
});

// Injected before any page script: long tasks, layout shifts, input times, and a hook for the computer's move.
const INIT = `(() => {
  const P = window.__perf = { lt: [], ls: [], input: [], cpu: [], frames: [], playStart: 0, playEnd: 0, hooked: [] };
  try { new PerformanceObserver(l => { for (const e of l.getEntries()) P.lt.push([e.startTime, e.duration]); }).observe({ type: "longtask", buffered: true }); } catch (e) {}
  try { new PerformanceObserver(l => { for (const e of l.getEntries()) P.ls.push([e.startTime, e.value, e.hadRecentInput]); }).observe({ type: "layout-shift", buffered: true }); } catch (e) {}
  for (const t of ["keydown", "pointerdown"]) addEventListener(t, e => { if (e.isTrusted) P.input.push(performance.now()); }, true);
  // Wrap the engines' computer-move functions (cpu*, computer*, ai*) on every Numberics* global. Games call them
  // through the engine object, so the wrapper sees each computer move: compute time, and time since the last input.
  let depth = 0;
  P.hook = () => {
    for (const k of Object.getOwnPropertyNames(window)) {
      if (!/^Numberics/.test(k)) continue;
      let o; try { o = window[k]; } catch (e) { continue; }
      if (!o || typeof o !== "object" || o.__perfHooked) continue;
      for (const f of Object.keys(o)) {
        if (typeof o[f] !== "function" || !/^(cpu|computer|ai)[A-Z_]/.test(f)) continue;
        const orig = o[f];
        try {
          o[f] = function () {
            if (depth) return orig.apply(this, arguments);
            depth++; const t0 = performance.now(), last = P.input.length ? P.input[P.input.length - 1] : -1;
            try { return orig.apply(this, arguments); }
            finally {
              depth--; const t1 = performance.now(), rec = { fn: k + "." + f, t0, ms: t1 - t0, since: last >= 0 ? t0 - last : -1, reply: -1 };
              P.cpu.push(rec); requestAnimationFrame(() => requestAnimationFrame(() => { if (last >= 0) rec.reply = performance.now() - last; }));
            }
          };
          P.hooked.push(k + "." + f);
        } catch (e) {}
      }
      try { Object.defineProperty(o, "__perfHooked", { value: true }); } catch (e) {}
    }
  };
  P.startFrames = () => {
    P.playStart = performance.now(); let prev = 0;
    // performance.now(), not the rAF timestamp: headless Chromium hands rAF an evenly spaced frame time that hides jank.
    const tick = () => { const t = performance.now(); if (prev) P.frames.push(t - prev); prev = t; if (!P.playEnd) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  };
})();`;

// Picks a click target in the page (fresh each time, so it follows re-renders). Returns viewport coordinates.
function pickTarget(opt) {
  const SKIP = "header, nav, footer, #games, .games, .seg, #levels, #diff, #new, a[href], [aria-haspopup], dialog, [data-perf-skip], " +
    "[id*=setting], [class*=setting], [id*=sound], [id*=audio], [id*=theme]";
  const sel = opt.only || "#board, #board *, button, [role=button], [data-i], [data-n], [data-g], .slot, .tile, .cell, .heap, .ft, .gp, .bar, .pw" + (opt.sel ? ", " + opt.sel : "");
  const vw = innerWidth, vh = innerHeight;
  const els = [...document.querySelectorAll(sel)].filter(el => {
    if (el.closest(SKIP)) return false;
    if (el.disabled) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return false;
    const cs = getComputedStyle(el); if (cs.visibility === "hidden" || cs.pointerEvents === "none" || +cs.opacity === 0) return false;
    return true;
  });
  // Buttons in an end card (Play again, Next round) win when present, so play keeps going after a game ends.
  const card = els.filter(el => el.tagName === "BUTTON" && el.closest(".over:not([hidden]), [role=dialog]"));
  const pool = !opt.only && card.length && Math.random() < 0.7 ? card : els;
  if (!pool.length) return null;
  const el = pool[Math.floor(Math.random() * pool.length)];
  // A target below the fold (the phone view) is scrolled into view first, like a player would. Scrolling is not a layout shift.
  let r = el.getBoundingClientRect();
  if (r.top < 0 || r.bottom > vh || r.left < 0 || r.right > vw) { el.scrollIntoView({ block: "nearest", inline: "nearest" }); r = el.getBoundingClientRect(); }
  const x = r.left + r.width / 2, y = r.top + r.height / 2, top = document.elementFromPoint(x, y);
  if (!top || top.closest(SKIP) || (top !== el && !el.contains(top) && !top.contains(el))) return null; // covered by something else
  return { x: r.left + r.width * (0.3 + Math.random() * 0.4), y: r.top + r.height * (0.3 + Math.random() * 0.4) };
}

// Is the computer thinking right now? Generic: the hint line says so, or the hook saw no reply yet.
function thinking() {
  const h = document.querySelector("#hint, [role=status]");
  return !!h && /thinking/i.test(h.textContent || "");
}

const median = a => { const s = a.filter(x => x != null && isFinite(x)).sort((x, y) => x - y); if (!s.length) return null; const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const pct = (a, p) => { const s = a.slice().sort((x, y) => x - y); if (!s.length) return null; return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const r1 = x => x == null ? null : Math.round(x * 10) / 10;
const r3 = x => x == null ? null : Math.round(x * 1000) / 1000;

async function runOnce(browser, base, page, view) {
  const ctx = await browser.newContext({ viewport: view.viewport, deviceScaleFactor: view.deviceScaleFactor, isMobile: view.isMobile, hasTouch: view.hasTouch });
  const origin = new URL(base).origin, external = [], reqs = new Map(), errors = [];
  await ctx.route("**/*", route => {
    const u = route.request().url();
    if (u.startsWith("data:") || u.startsWith("blob:") || u.startsWith(origin + "/")) return route.continue();
    external.push(u); return route.abort();
  });
  await ctx.addInitScript(INIT);
  const p = await ctx.newPage();
  p.on("pageerror", e => errors.push(String(e.message || e)));
  p.on("dialog", d => d.dismiss().catch(() => {}));
  p.on("requestfinished", async q => {
    if (!q.url().startsWith(origin)) return;
    try { const s = await q.sizes(); reqs.set(q.url() + "#" + reqs.size, s.responseBodySize + s.responseHeadersSize); } catch (e) { reqs.set(q.url() + "#" + reqs.size, 0); }
  });
  const cdp = await ctx.newCDPSession(p);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: view.cpu });
  await p.goto(base + page.path, { waitUntil: "load" });
  await p.waitForTimeout(1500); // let late paints and the computer's opening move land
  const load = await p.evaluate(() => {
    const n = performance.getEntriesByType("navigation")[0] || {}, f = performance.getEntriesByName("first-contentful-paint")[0];
    const P = window.__perf;
    return { fcp: f ? f.startTime : null, dcl: n.domContentLoadedEventEnd || null, loadEnd: n.loadEventEnd || null,
      lt: P.lt.slice(), cls: P.ls.filter(s => !s[2]).reduce((a, s) => a + s[1], 0) };
  });
  const urlBefore = p.url();
  // Play: the game's demo state, then scripted input for PLAY_MS.
  await p.evaluate(() => { try { if (typeof window.__demo === "function") window.__demo(); } catch (e) {} window.__perf.hook(); });
  await p.waitForTimeout(300);
  await p.evaluate(() => window.__perf.startFrames());
  const plan = PLAY[page.id] || GENERIC, vs = !!page.vs;
  const t0 = Date.now(); let actions = 0, navigated = false, lastCpu = -1, idle = 0;
  try { await p.focus("#board"); } catch (e) { /* not every page has a board */ }
  while (Date.now() - t0 < PLAY_MS) {
    if (p.url() !== urlBefore) { navigated = true; break; }
    const nCpu = vs ? await p.evaluate(() => window.__perf.cpu.length) : 0;
    // Against the computer, a run with no computer move for 20 actions is stuck (an end card, a targeting mode):
    // cancel with Escape and take the end card's continue button, like a player would.
    if (vs) { if (nCpu !== lastCpu) { lastCpu = nCpu; idle = 0; } else if (++idle >= 20) {
      idle = 0; await p.keyboard.press("Escape").catch(() => {});
      const t = await p.evaluate(pickTarget, { only: ".over:not([hidden]) button.primary, .over:not([hidden]) button, [role=dialog] button.primary" }).catch(() => null);
      if (t) await p.mouse.click(t.x, t.y).catch(() => {});
    } }
    if (plan.seq && Math.random() < plan.seqP) {
      // A short tap sequence (pick a tile, then its target), each step a random visible match of its selector.
      for (const only of plan.seq[Math.floor(Math.random() * plan.seq.length)]) {
        const t = await p.evaluate(pickTarget, { only }).catch(() => null);
        if (t) await p.mouse.click(t.x, t.y).catch(() => {});
        await p.waitForTimeout(120);
      }
    } else if (Math.random() < plan.click) {
      const t = await p.evaluate(pickTarget, { sel: plan.sel || "" }).catch(() => null);
      if (t) await p.mouse.click(t.x, t.y).catch(() => {});
    } else {
      // A player's keys go to the board, not to the last button they tapped (Enter would press that button again).
      await p.evaluate(() => { const a = document.activeElement, b = document.getElementById("board");
        if (a && /^(A|BUTTON|INPUT|SELECT|TEXTAREA)$/.test(a.tagName)) { a.blur(); if (b) b.focus({ preventScroll: true }); } }).catch(() => {});
      await p.keyboard.press(plan.keys[Math.floor(Math.random() * plan.keys.length)]).catch(() => {});
    }
    actions++;
    await p.waitForTimeout(140 + Math.floor(Math.random() * 120));
    // Against the computer, wait for its reply like a player would, so the reply time is measured cleanly.
    if (vs && await p.evaluate(thinking).catch(() => false)) {
      const until = Date.now() + 5000;
      while (Date.now() < until && await p.evaluate(n => window.__perf.cpu.length <= n, nCpu).catch(() => false)) await p.waitForTimeout(50);
      await p.waitForTimeout(150);
    }
  }
  await p.waitForTimeout(400);
  const play = navigated ? null : await p.evaluate(() => {
    const P = window.__perf; P.playEnd = performance.now();
    const inPlay = P.lt.filter(t => t[0] >= P.playStart);
    const cpuWin = P.cpu.map(c => [c.t0 - 5, c.t0 + c.ms + 5]);
    const overlaps = t => cpuWin.some(w => t[0] < w[1] && t[0] + t[1] > w[0]);
    return { frames: P.frames.slice(), lt: inPlay.filter(t => !overlaps(t)).map(t => t[1]), cpuLt: inPlay.filter(overlaps).map(t => t[1]),
      cls: P.ls.filter(s => s[0] >= P.playStart && !s[2]).reduce((a, s) => a + s[1], 0),
      cpu: P.cpu.map(c => ({ fn: c.fn, ms: c.ms, since: c.since, reply: c.reply })), hooked: P.hooked.slice() };
  }).catch(() => null);
  await ctx.close();
  const kb = [...reqs.values()].reduce((a, b) => a + b, 0) / 1024;
  const out = { weightKB: kb, requests: reqs.size, external: external.length, externalUrls: [...new Set(external)], pageErrors: errors.length, errors,
    fcpMs: load.fcp, dclMs: load.dcl, loadLongTaskMs: load.lt.reduce((a, t) => Math.max(a, t[1]), 0), loadCls: load.cls, actions, navigated };
  if (play) {
    const F = play.frames, FR = 1000 / 60;
    const expected = F.reduce((a, d) => a + Math.max(1, Math.round(d / FR)), 0);
    out.frames = F.length; out.p95FrameMs = pct(F, 0.95);
    out.droppedPct = expected ? 100 * F.reduce((a, d) => a + Math.max(0, Math.round(d / FR) - 1), 0) / expected : 0;
    out.playLongTaskMs = play.lt.reduce((a, b) => Math.max(a, b), 0); out.playLongTasks = play.lt.length;
    out.cls = play.cls;
    // Computer moves: the engine call itself (cpuMs, worst), and the player's move to the computer's move on
    // screen (replyMs, median; it includes each game's designed thinking pause).
    const moves = play.cpu.filter(c => c.since >= 0 && c.since < 5000);
    out.cpuMoves = play.cpu.length; out.hooked = play.hooked;
    if (play.cpu.length) {
      out.cpuMs = play.cpu.reduce((a, c) => Math.max(a, c.ms), 0);
      out.cpuLongTaskMs = play.cpuLt.reduce((a, b) => Math.max(a, b), 0);
      out.replyMs = median(moves.map(c => c.reply).filter(x => x >= 0));
    }
  }
  return out;
}

const TIMING = ["fcpMs", "dclMs", "loadLongTaskMs", "loadCls", "p95FrameMs", "droppedPct", "playLongTaskMs", "cls", "cpuMs", "cpuLongTaskMs", "replyMs"];
const WORST = ["weightKB", "requests", "external", "pageErrors"];
function combine(runs) {
  const o = {};
  for (const k of TIMING) o[k] = median(runs.map(r => r[k]));
  for (const k of WORST) o[k] = Math.max(...runs.map(r => r[k] || 0));
  o.cpuMoves = median(runs.map(r => r.cpuMoves || 0)); // median, so one unlucky random run is not a failure
  o.actions = median(runs.map(r => r.actions)); o.frames = median(runs.map(r => r.frames));
  o.navigated = runs.some(r => r.navigated);
  o.externalUrls = [...new Set(runs.flatMap(r => r.externalUrls))]; o.errors = [...new Set(runs.flatMap(r => r.errors))];
  o.hooked = runs.find(r => r.hooked) ? runs.find(r => r.hooked).hooked : [];
  o.runs = runs.map(r => { const c = Object.assign({}, r); delete c.errors; delete c.externalUrls; delete c.hooked; return c; });
  return o;
}

function budgetFor(B, id, metric, view) {
  const d = (B.defaults || {})[metric], g = ((B.games || {})[id] || {})[metric];
  const pick = e => e == null ? undefined : (e[view] != null ? e[view] : e.max);
  const v = pick(g); return v !== undefined ? v : pick(d);
}

(async () => {
  const B = JSON.parse(fs.readFileSync(path.join(__dirname, "perf-budgets.json"), "utf8"));
  const ids = process.argv.slice(2);
  const games = JSON.parse(fs.readFileSync(path.join(root, "games.json"), "utf8")).filter(g => g.status === "live");
  const pages = games.map(g => ({ id: g.id, path: g.path || "", vs: !!g.vs }));
  if (!pages.some(g => g.path === "" || g.path === "./")) pages.unshift({ id: "root", path: "", vs: false });
  const todo = pages.filter(g => !ids.length || ids.includes(g.id));
  await new Promise(r => srv.listen(0, "127.0.0.1", r));
  const base = "http://127.0.0.1:" + srv.address().port + "/";
  const browser = await chromium.launch();
  const report = { when: new Date().toISOString(), runs: RUNS, playMs: PLAY_MS, results: {} }, fails = [];
  for (const g of todo) for (const v of VIEWS) {
    const runs = [];
    for (let i = 0; i < RUNS; i++) runs.push(await runOnce(browser, base, g, v));
    const m = combine(runs); m.vs = g.vs;
    const checks = [];
    const metrics = ["weightKB", "requests", "external", "pageErrors", "fcpMs", "dclMs", "loadLongTaskMs", "loadCls", "playLongTaskMs", "p95FrameMs", "droppedPct", "cls"];
    if (g.vs || m.cpuMoves) metrics.push("cpuMs", "cpuLongTaskMs", "replyMs");
    for (const k of metrics) {
      const lim = budgetFor(B, g.id, k, v.tag); if (lim == null) continue;
      const val = m[k]; const ok = val != null && val <= lim;
      checks.push({ metric: k, value: val, max: lim, ok });
      if (!ok) fails.push(g.id + " " + v.tag + ": " + k + " = " + (val == null ? "not measured" : r1(val)) + " > budget " + lim);
    }
    const minMoves = budgetFor(B, g.id, "cpuMovesMin", v.tag);
    if (g.vs && minMoves != null) {
      const ok = m.cpuMoves >= minMoves; checks.push({ metric: "cpuMoves", value: m.cpuMoves, min: minMoves, ok });
      if (!ok) fails.push(g.id + " " + v.tag + ": only " + m.cpuMoves + " computer moves observed in play (need " + minMoves + "; is the computer-move function still an engine export named cpu*/computer*/ai*?)");
    }
    if (m.navigated) fails.push(g.id + " " + v.tag + ": scripted play navigated away from the page (a click target escaped the skip list)");
    m.checks = checks;
    report.results[g.id] = report.results[g.id] || {}; report.results[g.id][v.tag] = m;
    const bad = checks.filter(c => !c.ok).map(c => c.metric);
    console.log((bad.length ? "FAIL " : "ok   ") + g.id.padEnd(10) + v.tag.padEnd(8) + (bad.length ? bad.join(",") : ""));
  }
  await browser.close(); srv.close();
  report.failures = fails; report.pass = !fails.length;
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
  // Readable table.
  const cols = [["game", 10], ["view", 8], ["KB", 7], ["req", 4], ["ext", 4], ["FCP", 6], ["DCL", 6], ["LTld", 6], ["LTply", 6], ["p95f", 6], ["drop%", 6], ["CLS", 6], ["cpu", 6], ["reply", 6], ["moves", 6]];
  const line = a => a.map((x, i) => String(x == null ? "-" : x).padStart(cols[i][1])).join(" ");
  console.log("\n" + line(cols.map(c => c[0])));
  for (const id of Object.keys(report.results)) for (const tag of Object.keys(report.results[id])) {
    const m = report.results[id][tag];
    console.log(line([id, tag, r1(m.weightKB), m.requests, m.external, Math.round(m.fcpMs), Math.round(m.dclMs), Math.round(m.loadLongTaskMs), Math.round(m.playLongTaskMs),
      r1(m.p95FrameMs), r1(m.droppedPct), r3(m.cls), m.cpuMs == null ? null : r1(m.cpuMs), m.replyMs == null ? null : Math.round(m.replyMs), m.vs ? m.cpuMoves : null]));
  }
  console.log("\n(median of " + RUNS + " runs; ms; LTld/LTply = longest long task at load / in play outside the computer's move; cpu = worst engine call for the computer's move; reply = median player move to computer move on screen, designed pause included)");
  console.log("report: " + OUT);
  if (fails.length) { console.log("\nPERF FAIL (" + fails.length + "):"); for (const f of fails) console.log("  " + f); process.exit(1); }
  console.log("PERF PASS"); process.exit(0);
})().catch(e => { console.log(e); srv.close(); process.exit(1); });
