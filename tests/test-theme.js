/* SPDX-License-Identifier: Apache-2.0 | Copyright 2026 alvations (Melon Lab)
 * Design tokens, boot and the top bar shell (docs/design/REDESIGN.md 2.1, 6.2, 10.3). `node tests/test-theme.js` */
"use strict";
const fs = require("fs"), path = require("path");
let pass = 0, fail = 0;
function t(n, f) { try { f(); pass++; } catch (e) { fail++; console.log("FAIL", n, "\n  ", e.message); } }
function ok(c, m) { if (!c) throw new Error(m || "assertion failed"); }
const root = path.join(__dirname, "..");
const read = f => fs.readFileSync(path.join(root, f), "utf8");
const BEGIN = "/* tokens: REDESIGN.md 2.1", END = "/* end tokens */";
function block(src, f) {
  const a = src.indexOf(BEGIN), b = src.indexOf(END);
  ok(a >= 0 && b > a, f + ": token block markers");
  return src.slice(a, b + END.length);
}
const CSS = ["shared/theme.css", "two/style.css", "sudoku/style.css"];
const tokens = block(read(CSS[0]), CSS[0]);

t("the token block is byte-identical in shared/theme.css, two/style.css and sudoku/style.css", () => {
  CSS.slice(1).forEach(f => ok(block(read(f), f) === tokens, f + " differs from shared/theme.css"));
});
t("the R4 shared block (top bar at 320 px, mute, end cards, trophy goals, Today, Memory) is byte-identical in all three", () => {
  const A = "/* ===== R4 shared (TRIAGE4;", Z = "/* ===== end R4 shared ===== */";
  const get = f => { const s = read(f), a = s.indexOf(A), b = s.indexOf(Z); ok(a >= 0 && b > a, f + ": R4 markers"); return s.slice(a, b + Z.length); };
  const r = get(CSS[0]); CSS.slice(1).forEach(f => ok(get(f) === r, f + " differs from shared/theme.css"));
  ok(/\.tb-btn\{ min-width:var\(--tap\); flex:none; \}/.test(r) && /\.tb-word\{ display:none; \}/.test(r), "the top bar never shrinks a button");
});
t("the top bar: four 44 px buttons (Games, Sound, Trophies, Settings), the Settings icon a gear, the words hideable", () => {
  const u = read("shared/ui.js");
  ok(/data-open="games"[\s\S]*data-open="mute"[\s\S]*data-open="trophies"[\s\S]*data-open="settings"/.test(u), "order");
  ok(/class="tb-word">Numberics</.test(u) && /class="tb-lbl">Games</.test(u) && /aria-label="Games"/.test(u), "words in spans, names kept");
  ok(!/M12 3v2\.5M12 18\.5V21/.test(u), "the old sun rays are gone");
});
t("the token block comes first in each file (nothing above it but the SPDX comment)", () => {
  CSS.forEach(f => { const s = read(f); ok(!/[{}]/.test(s.slice(0, s.indexOf(BEGIN)).replace(/\/\*[\s\S]*?\*\//g, "")), f); });
});
t("every token name in use before the redesign is kept", () => {
  "--bg --panel --cell --ink --mute --accent --line --cool --bad --good --gap --anim --radius --tile-radius".split(" ")
    .forEach(n => ok(tokens.includes(n + ":"), n));
});

// ---- a tiny cascade over the token block: selector -> declarations, applied in source order ----
function rules(css) {
  const out = []; css = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const re = /([^{}]+)\{([^{}]*)\}/g; let m;
  while ((m = re.exec(css))) {
    const sel = m[1].trim(), decl = {};
    m[2].split(";").forEach(d => { const i = d.indexOf(":"); if (i > 0) decl[d.slice(0, i).trim()] = d.slice(i + 1).trim(); });
    out.push({ sel, decl });
  }
  return out;
}
const R = rules(tokens.replace(/@media[^{]*\{([^{}]*\{[^{}]*\})\s*\}/g, "")); // media rules hold only --gap
function mode(theme, contrast) {
  const v = {};
  R.forEach(r => {
    const s = r.sel, th = /data-theme="light"/.test(s), hc = /data-contrast="high"/.test(s), other = /data-(text|motion)/.test(s);
    if (other || (th && theme !== "light") || (hc && contrast !== "high")) return;
    if (s !== ":root" && !th && !hc) return;
    Object.assign(v, r.decl);
  });
  return v;
}
function rgb(c) {
  c = c.trim(); let m;
  if ((m = c.match(/^#([0-9a-f]{3})$/i))) return m[1].split("").map(x => parseInt(x + x, 16));
  if ((m = c.match(/^#([0-9a-f]{6})$/i))) return [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16));
  if ((m = c.match(/^hsl\(\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%\s*\)$/))) return hsl(+m[1], +m[2], +m[3]);
  throw new Error("colour " + c);
}
function hsl(h, s, l) {
  s /= 100; l /= 100;
  const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)].map(x => Math.round(x * 255));
}
function lum(c) { return c.map(x => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }).reduce((a, x, i) => a + x * [0.2126, 0.7152, 0.0722][i], 0); }
function ratio(a, b) { const x = lum(rgb(a)), y = lum(rgb(b)); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
const MODES = [["dark", "normal"], ["light", "normal"], ["dark", "high"], ["light", "high"]];

t("contrast: --ink, --mute and --accent-text on --bg, --panel and --panel-2 reach 4.5:1 in every theme", () => {
  const bad = [];
  MODES.forEach(([th, hc]) => { const v = mode(th, hc);
    ["--ink", "--mute", "--accent-text"].forEach(fg => ["--bg", "--panel", "--panel-2"].forEach(bg => {
      const r = ratio(v[fg], v[bg]); if (r < 4.5) bad.push(th + "/" + hc + " " + fg + " on " + bg + " " + r.toFixed(2)); })); });
  ok(!bad.length, bad.join("; "));
});
t("contrast: high contrast raises --ink and --mute to 7:1 on every surface", () => {
  const bad = [];
  [["dark", "high"], ["light", "high"]].forEach(([th, hc]) => { const v = mode(th, hc);
    ["--ink", "--mute"].forEach(fg => ["--bg", "--panel", "--panel-2"].forEach(bg => {
      const r = ratio(v[fg], v[bg]); if (r < 7) bad.push(th + " " + fg + " on " + bg + " " + r.toFixed(2)); })); });
  ok(!bad.length, bad.join("; "));
});
t("contrast: the accent fill carries --accent-ink at 4.5:1 (badges, primary buttons, gold toast)", () => {
  MODES.forEach(([th, hc]) => { const v = mode(th, hc); ok(ratio(v["--accent-ink"], v["--accent"]) >= 4.5, th + "/" + hc); });
});

// Tile faces: the hue cycle of NumbericsKit.hue, the face's base (darkest) colour, with the hue lift from theme.css.
const theme = read("shared/theme.css"), LIFT = /--tl:calc\(var\(--tile-l\) \+ ([\d.]+)% \+ ([\d.]+)% \* max\(0, cos\(\(var\(--h,40\) - (\d+)\) \* ([\d.]+)deg\)\)\)/;
t("contrast: --tile-ink on tile faces, levels 1 to 40, 4.5:1 in every theme", () => {
  const m = theme.match(LIFT); ok(m, "hue lift rule in shared/theme.css");
  ok(read("two/style.css").includes(m[0]), "two/style.css uses the same hue lift");
  const K = require("../shared/kit.js"), bad = [];
  MODES.forEach(([th, hc]) => { const v = mode(th, hc), S = parseFloat(v["--tile-s"]), L = parseFloat(v["--tile-l"]);
    for (let lv = 1; lv <= 40; lv++) {
      const h = K.hue(lv), lift = +m[1] + +m[2] * Math.max(0, Math.cos((h - +m[3]) * +m[4] * Math.PI / 180));
      const face = lv === 1 ? v["--tile-lo"] : lv === 2 ? v["--tile-lo2"] : "hsl(" + h + " " + S + "% " + (L + lift) + "%)";
      const r = ratio(v["--tile-ink"], face); if (r < 4.5) bad.push(th + "/" + hc + " level " + lv + " hue " + h + " " + r.toFixed(2));
    } });
  ok(!bad.length, bad.join("; "));
});

// ---- pages: boot first, top bar container, script order (REDESIGN.md 11, A1) ----
// the games page at the root (O-9) plus every game page; GAMES are the game pages only (the root plays no game)
const GAMES = JSON.parse(read("games.json")).filter(g => g.status === "live").map(g => g.path + "index.html");
const PAGES = ["index.html"].concat(GAMES);
const ORDER = ["shared/kit.js", "shared/settings.js", "shared/motion.js", "shared/audio.js", "shared/trophies.js", "shared/progress.js", "shared/power.js"];
t("every page loads shared/boot.js first in <head>, before any stylesheet or other script", () => PAGES.forEach(f => {
  const s = read(f), head = s.slice(0, s.indexOf("</head>")), b = head.indexOf("shared/boot.js");
  ok(b > 0, f + " boot"); ok(head.indexOf("<script") === head.lastIndexOf("<script", b), f + " boot is the first script");
  ok(head.indexOf('rel="stylesheet"') > b, f + " boot before CSS");
  ok(head.indexOf('name="theme-color"') < b, f + " theme-color meta exists when boot runs");
}));
t("every page has the top bar container before the game, with its root link", () => PAGES.forEach(f => {
  const s = read(f), m = s.match(/<div id="topbar" class="topbar" data-root="([^"]*)"><\/div>/);
  ok(m, f + " #topbar"); ok(m[1] === (f === "index.html" ? "" : "../"), f + " data-root " + m[1]);
  ok(s.indexOf('id="topbar"') < s.indexOf('<main id="app"'), f + " before main");
}));
t("every game page includes the scripts in the spec order: kit, settings, motion, audio, trophies, progress, power, engine(s), game, nav, ui", () => GAMES.forEach(f => {
  const s = read(f), body = s.slice(s.indexOf("<body"));
  const src = [...body.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1].replace(/^(\.\.\/)+/, ""));
  ok(JSON.stringify(src.slice(0, ORDER.length)) === JSON.stringify(ORDER), f + " head of list " + src.join(","));
  ok(src[src.length - 1] === "shared/ui.js" && src[src.length - 2] === "shared/nav.js", f + " ends with nav, ui");
  ok(src[src.length - 3] === "game.js" || /\/game\.js$/.test(src[src.length - 3]), f + " game before nav");
}));

t("O-9: the games page loads only what the top bar, Settings, Trophies, mute, Today and the cards need, in the spec order", () => {
  const s = read("index.html"), src = [...s.slice(s.indexOf("<body")).matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
  ok(JSON.stringify(src) === JSON.stringify(["shared/kit.js", "shared/settings.js", "shared/audio.js", "shared/trophies.js", "shared/progress.js",
    "shared/nav.js", "shared/ui.js"]), "root scripts " + src.join(","));
  const css = [...s.matchAll(/<link rel="stylesheet" href="([^"]+)">/g)].map(m => m[1]);
  ok(JSON.stringify(css) === JSON.stringify(["shared/theme.css", "home.css"]), "root CSS " + css.join(","));
});

// ---- stub modules: the globals exist with the spec's API, and every call is safe (B1 to B4 fill them) ----
const vm = require("vm");
function load(files) {
  const doc = { documentElement: { dataset: {}, setAttribute() {}, getAttribute() { return null; } },
    getElementById() { return null; }, querySelector() { return null; }, addEventListener() {}, readyState: "complete" };
  const win = { document: doc, addEventListener() {}, dispatchEvent() {}, matchMedia: () => ({ matches: false, addEventListener() {} }) };
  win.window = win; win.self = win; win.localStorage = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); } };
  const ctx = vm.createContext(Object.assign(win, { console, setTimeout, clearTimeout, Date, Math, JSON }));
  files.forEach(f => vm.runInContext(read(f), ctx, { filename: f }));
  return ctx;
}
const MODS = ["shared/kit.js", "shared/settings.js", "shared/motion.js", "shared/audio.js", "shared/trophies.js", "shared/progress.js", "shared/ui.js"];
t("stub modules define their globals with the spec API, and every call is safe with storage blocked", () => {
  const c = load(["shared/boot.js"].concat(MODS));
  const S = c.NumbericsSettings, M = c.NumbericsMotion, A = c.NumbericsAudio, T = c.NumbericsTrophies, P = c.NumbericsProgress, U = c.NumbericsUI;
  ok(S && M && A && T && P && U, "globals");
  const s = S.get(); ok(s.v === 1 && s.theme === "auto" && s.motion === "auto" && s.volume === 0.5 && s.sound === true, "settings defaults");
  S.set({ theme: "light" }); ok(typeof S.reducedMotion() === "boolean");
  ok(M.T.slide === 110 && M.T.pop === 180 && M.E.slide === "cubic-bezier(.45,0,.55,1)", "motion T/E");
  ok(M.fallMs(1) === 130 && M.fallMs(6) === 217, "fallMs");
  ok(typeof M.reduced() === "boolean" && M.ms("slide") >= 0 && M.play(null, [], {}) === null);
  const q = M.seq(); q.at(10, () => {}); q.finish(); q.cancel();
  const tr = M.track([1], [], null, 2); ok(Array.isArray(tr.moves) && Array.isArray(tr.merges) && Array.isArray(tr.spawns));
  const L = M.layer(null, {}); L.sync([], {}); L.finish(); ok(L.busy() === false);
  "tick slide merge land pop burst pip place best power trophy win lose bad buzz".split(" ").forEach(n => { ok(typeof A[n] === "function", "audio " + n); A[n](1); });
  ok(Array.isArray(T.report("two", "move", {})) && T.has("x") === false && Array.isArray(T.earned()) && Array.isArray(T.REG)); T.open();
  P.put("two", { best: "Best 1" }); P.daily("six", "4 made"); P.markHowto("two");
  ok(P.get("nope") === null && typeof P.today() === "object" && typeof P.seenHowto("two") === "boolean");
  ok(U.open() === false); U.sheet("games", () => {}); U.topbar();
});
t("the motion, trophies and progress stubs are require()-able (their pure parts get Node tests later)", () => {
  ["../shared/motion.js", "../shared/trophies.js", "../shared/progress.js"].forEach(f => ok(typeof require(f) === "object", f));
});
t("boot applies stored settings and falls back to defaults with storage blocked", () => {
  const c = load(["shared/boot.js"]), d = c.document.documentElement.dataset;
  ok(d.theme === "dark" && d.text === "normal" && d.contrast === "normal" && d.motion === "full", JSON.stringify(d));
  const doc = { documentElement: { dataset: {} }, querySelector() { return null; }, addEventListener() {} };
  const w = { document: doc, matchMedia: q => ({ matches: /light|reduce/.test(q), addEventListener() {} }),
    localStorage: { getItem: () => JSON.stringify({ v: 1, theme: "auto", text: "large", contrast: "high", motion: "auto" }) } };
  w.window = w; vm.runInContext(read("shared/boot.js"), vm.createContext(w));
  const e = doc.documentElement.dataset;
  ok(e.theme === "light" && e.text === "large" && e.contrast === "high" && e.motion === "reduced", JSON.stringify(e));
  const doc2 = { documentElement: { dataset: {} }, querySelector() { return null; }, addEventListener() {} };
  const w2 = { document: doc2, matchMedia: () => ({ matches: true, addEventListener() {} }),
    localStorage: { getItem: () => JSON.stringify({ theme: "purple", text: 3, motion: "full" }) } };
  w2.window = w2; vm.runInContext(read("shared/boot.js"), vm.createContext(w2));
  const g = doc2.documentElement.dataset;
  ok(g.theme === "light" && g.text === "normal" && g.motion === "full", "malformed fields fall back one by one (theme to Device, light here), Full beats the OS " + JSON.stringify(g));
});
require("./conventions")(t, ok, ["two/style.css", "sudoku/style.css", "home.css", "index.html"]); // the shared modules are checked in test-shared.js
console.log(pass + " passed, " + fail + " failed"); process.exit(fail ? 1 : 0);
