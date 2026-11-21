/* SPDX-License-Identifier: Apache-2.0 | Copyright 2026 alvations (Melon Lab)
 * The device matrix (O-14, O-15, O-16): every page (the games page and the ten games) on every phone, tablet and desktop
 * of the QA/QC matrix (docs/reviews/PERSONAS.md). One browser, one context per device. On each:
 *   - no sideways scroll;
 *   - the board and every control needed to play (the tier or mode row, the power-up tray, Nine's Take bar, Sudoku's
 *     tools and number pad, Fifteen's Numbers / Grid) are in view without scrolling (New game, How to play and More
 *     number games may sit below);
 *   - every visible tap target is at least 44 x 44 px;
 *   - no clipped text (a label wider than its box) and no overlapping blocks;
 *   - the hint line (and the room it keeps) is at most one line.
 * Run: NODE_PATH=$(npm root -g) node tests/emu/run.cjs devices
 * DEVICES_JSON=<file> writes the measurements; DEVICES_SHOTS=<dir> saves a screenshot of every page on every device. */
"use strict";
const fs = require("fs"), path = require("path");
let devices; try { ({ devices } = require("playwright")); } catch (e) { devices = null; }

// the matrix: Playwright descriptors (viewport = the area the browser really shows), always run in Chromium
const MATRIX = [
  ["iPhone 13 Mini", "mini"], ["iPhone 13 Mini", "mini-large", { text: "large" }], ["iPhone 17 Pro Max", "promax"],
  ["Pixel 4", "pixel4"], ["Pixel 10", "pixel10"], ["Pixel 8", "pixel8"], ["Pixel 10 Pro XL", "pixel10xl"],
  ["iPad Mini", "ipad"], ["iPad Mini landscape", "ipad-land"],
  [null, "desktop", null, { width: 1280, height: 800 }], [null, "desktop-hd", null, { width: 1920, height: 1080 }]
];
// DEVICES_LARGE=1 also runs every other device with Larger text (a deeper sweep than the gate)
if (process.env.DEVICES_LARGE) MATRIX.slice().forEach(m => { if (!m[2]) MATRIX.push([m[0], m[1] + "-large", { text: "large" }, m[3]]); });
// what must be in view to play each game (the board is always one)
const PLAY = {
  fibonacci: ["#diff", "#tray"], two: ["#diff", "#tray"], three: ["#diff", "#tray"], four: ["#levels", "#tray"],
  five: ["#levels", "#tray"], six: ["#modes", "#tray", "#board .tools"], seven: ["#modes", "#tray"],
  nine: ["#diff", "#tray", "#take", "#less", "#more"], fifteen: ["#diff", "#tray", ".views"],
  sudoku: ["#levels", "#tray", ".tools", "#pad"]
};
const SEEN = { v: 1, games: {}, howto: {}, daily: {} };
Object.keys(PLAY).forEach(id => { SEEN.howto[id] = true; });

// runs in the page: every check, plus the numbers for the tables
function measure([need, vw]) {
  const W = innerWidth, H = innerHeight, out = { W, H, fail: [] };
  // a mobile page wider than the screen zooms out (the layout viewport grows): that is sideways overflow too
  if (vw && W !== vw) out.fail.push("the page is wider than the screen: laid out at " + W + " px for a " + vw + " px screen");
  const vis = e => !!e && (e.offsetParent !== null || getComputedStyle(e).position === "fixed") && e.getClientRects().length > 0 &&
    !e.closest("[hidden], details:not([open]) > :not(summary), .scrim, .over");
  const R = e => e.getBoundingClientRect();
  const name = e => (e.id ? "#" + e.id : e.tagName.toLowerCase() + (e.className && typeof e.className === "string" ? "." + e.className.trim().split(/\s+/).join(".") : "")) +
    (e.textContent.trim() ? " \"" + e.textContent.trim().slice(0, 18) + "\"" : "");
  const de = document.documentElement;
  out.scrollW = de.scrollWidth;
  if (de.scrollWidth > W) out.fail.push("sideways scroll " + de.scrollWidth + " > " + W);
  // in view
  const board = document.getElementById("board");
  if (board) { const b = R(board); out.board = Math.round(b.width) + "x" + Math.round(b.height); out.boardTop = Math.round(b.top); out.boardBottom = Math.round(b.bottom); }
  let bottom = 0;
  (board ? ["#board"].concat(need) : []).forEach(s => {
    const e = document.querySelector(s);
    if (!e || !vis(e)) { out.fail.push("missing " + s); return; }
    const r = R(e); bottom = Math.max(bottom, r.bottom);
    if (r.bottom > H + 0.5 || r.top < -0.5 || r.right > W + 0.5 || r.left < -0.5) out.fail.push(s + " out of view (bottom " + Math.round(r.bottom) + " of " + H + ")");
  });
  out.bottom = Math.round(bottom);
  // tap targets (a link inside running text is a text link, not a tap target)
  const taps = [...document.querySelectorAll("button, a[href], summary, input, select, [role=button]")].filter(e => vis(e) && !e.closest("p, li"));
  // Six's five-number line on a phone keeps its signs between the numbers with tiles narrower than square, never under
  // 26 px wide or 44 px tall (round 4, cold #25: six/game.js NARROW); those tiles are the one agreed exception
  const small = taps.filter(e => { const r = R(e); if (e.matches(".line.narrow .num") && r.width >= 26 && r.height >= 43.5) return false;
    return r.width < 43.5 || r.height < 43.5; });
  if (small.length) out.fail.push("small taps: " + small.slice(0, 6).map(e => name(e) + " " + Math.round(R(e).width) + "x" + Math.round(R(e).height)).join(", "));
  // clipped text: a label wider (or taller) than its box
  const txt = [...document.querySelectorAll("#app button, #topbar a, #topbar button, .stat, .stat > span, .stat b, h1, .sub, .hint, .pw, summary, .cards b, .blurb, .chip")].filter(vis);
  const clip = txt.filter(e => e.scrollWidth > e.clientWidth + 1 || (getComputedStyle(e).overflow !== "visible" && e.scrollHeight > e.clientHeight + 1));
  if (clip.length) out.fail.push("clipped: " + clip.slice(0, 6).map(name).join(", "));
  // overlapping: the blocks of the page stack, and the pieces of the top bar, header, stats, tray and tier row
  const hit = (a, b) => { const x = R(a), y = R(b); return x.left < y.right - 0.5 && y.left < x.right - 0.5 && x.top < y.bottom - 0.5 && y.top < x.bottom - 0.5; };
  const groups = [[...document.querySelectorAll("#topbar > *")], [...document.querySelectorAll("header > *")], [...document.querySelectorAll(".stats > .stat")],
    [...document.querySelectorAll("#tray > *")], [...document.querySelectorAll(".seg > button, .levels > button")]];
  const app = document.getElementById("app");
  if (app) groups.push([...app.children].filter(e => getComputedStyle(e).position === "static" || getComputedStyle(e).position === "relative"));
  const over = [];
  groups.forEach(g => { g = g.filter(vis); for (let i = 0; i < g.length; i++) for (let j = i + 1; j < g.length; j++) if (hit(g[i], g[j])) over.push(name(g[i]) + " / " + name(g[j])); });
  if (over.length) out.fail.push("overlap: " + over.slice(0, 4).join(", "));
  // the hint: at most one line, and the room it keeps is at most one line, on phones and on screens up to 860 px tall
  // (tall tablets and desktops keep the two-line room some games had, unchanged)
  const h = document.getElementById("hint");
  if (h && vis(h) && (W <= 520 || H <= 860)) {
    const lh = parseFloat(getComputedStyle(h).lineHeight) || parseFloat(getComputedStyle(h).fontSize) * 1.45, hr = R(h);
    out.hintLines = Math.round(hr.height / lh * 10) / 10;
    if (hr.height > lh * 1.5) out.fail.push("hint " + out.hintLines + " lines: \"" + h.textContent.slice(0, 40) + "\"");
  }
  // stacked blocks above the board (for the tables)
  if (board && app) out.above = [...app.children].filter(e => vis(e) && R(e).bottom <= R(board).top + 1 && R(e).height > 0).length;
  return out;
}

module.exports = async function ({ browser, url, ck }) {
  if (!devices) return;
  const games = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "..", "games.json"), "utf8")).filter(g => g.status === "live");
  const pages = [["home", ""]].concat(games.map(g => [g.id, g.path]));
  const shots = process.env.DEVICES_SHOTS, rows = [];
  if (shots) fs.mkdirSync(shots, { recursive: true });
  for (const [dev, key, settings, viewport] of MATRIX) {
    const d = dev ? devices[dev] : null;
    const opts = d ? { viewport: d.viewport, screen: d.screen, deviceScaleFactor: d.deviceScaleFactor, isMobile: d.isMobile, hasTouch: d.hasTouch, userAgent: d.userAgent }
      : { viewport, deviceScaleFactor: 1 };
    if (shots && opts.deviceScaleFactor > 2) opts.deviceScaleFactor = 2; // smaller files, same CSS layout
    const ctx = await browser.newContext(opts);
    await ctx.addInitScript(([seen, set]) => { try {
      localStorage.setItem("numberics_progress_v1", seen);
      if (set) localStorage.setItem("numberics_settings_v1", set);
    } catch (e) { /* storage blocked: the page still runs */ } }, [JSON.stringify(SEEN), settings ? JSON.stringify(settings) : ""]);
    const p = await ctx.newPage();
    for (const [id, rel] of pages) {
      await p.goto(url + rel, { waitUntil: "load" });
      await p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => { if (window.NumbericsUI && NumbericsUI.open()) NumbericsUI.close(); r(); }))));
      await p.waitForTimeout(60);
      const m = await p.evaluate(measure, [PLAY[id] || [], opts.viewport.width]);
      rows.push(Object.assign({ device: key, page: id }, m));
      ck(key + " " + m.W + "x" + m.H + " " + id + ": fits, no sideways scroll, 44 px taps, no clipping or overlap, one-line hint", !m.fail.length, m.fail.join("; "));
      if (shots) await p.screenshot({ path: path.join(shots, key + "-" + id + ".png") });
    }
    await ctx.close();
  }
  if (process.env.DEVICES_JSON) fs.writeFileSync(process.env.DEVICES_JSON, JSON.stringify(rows, null, 1));
};
module.exports.MATRIX = MATRIX;
