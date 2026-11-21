/* SPDX-License-Identifier: Apache-2.0 | Copyright 2026 alvations (Melon Lab)
 * Browser check for the beta storage namespace (shared/boot.js; the owner deploys build/v2 at /numberics/beta/ on the
 * same origin as the stable site). Its own server maps /numberics/* and /numberics/beta/* to the repo root, so the two
 * share one origin and one localStorage, as on GitHub Pages. Play, Save, Load and Erase on beta pages must leave every
 * stable key byte for byte, and the stable page must never see a beta key as its own.
 * Run: NODE_PATH=$(npm root -g) node tests/emu/run.cjs shared-beta */
"use strict";
const http = require("http"), fs = require("fs"), path = require("path");
module.exports = async function ({ browser, ck, shot }) {
  const root = path.join(__dirname, "..", "..");
  const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml" };
  const srv = http.createServer((q, r) => {
    const m = /^\/numberics(?:\/beta)?(\/.*)$/.exec(decodeURIComponent(q.url.split("?")[0]));
    let f = m ? path.join(root, m[1]) : "";
    if (f && fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, "index.html");
    if (!f || !f.startsWith(root) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); }
    r.writeHead(200, { "content-type": types[path.extname(f)] || "application/octet-stream" }); r.end(fs.readFileSync(f));
  });
  await new Promise(r => srv.listen(0, "127.0.0.1", r));
  const base = "http://127.0.0.1:" + srv.address().port + "/numberics/", beta = base + "beta/";
  try {
    const games = JSON.parse(fs.readFileSync(path.join(root, "games.json"), "utf8")).filter(g => g.status === "live");
    const HOWTO = JSON.stringify({ v: 1, games: {}, howto: Object.fromEntries(games.map(g => [g.id, true]).concat([["endless", true]])), daily: {} });
    const STABLE = { numberics_endless_v1: JSON.stringify({ stable: "two save" }), numberics_sudoku_v1: JSON.stringify({ stable: "sudoku save" }),
      numberics_trophies_v1: JSON.stringify({ v: 1, got: { fam_first: "20261120" }, unseen: [] }), numberics_progress_v1: HOWTO,
      numberics_settings_v1: JSON.stringify({ v: 1, theme: "light", text: "large" }) };
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: "dark" });
    const st = await ctx.newPage(); const errs = []; st.on("pageerror", e => errs.push(e.message));
    await st.goto(base);
    await st.evaluate(s => { localStorage.clear(); for (const k in s) localStorage.setItem(k, s[k]); localStorage.setItem("numberics_beta_progress_v1", s.numberics_progress_v1); }, STABLE);
    // the raw store, read from a stable page (no shim there: it lists every key by its real name)
    const raw = () => st.evaluate(() => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); o[k] = localStorage.getItem(k); } return o; });
    const stableSame = async () => { const r = await raw(); return Object.keys(STABLE).filter(k => r[k] !== STABLE[k]); };

    const p = await ctx.newPage(); p.on("pageerror", e => errs.push(e.message));
    await p.goto(beta + "two/"); // Two has its own page (O-9)
    ck("beta: the page does not see the stable settings (Theme Light, Larger text)", await p.evaluate(() => NumbericsSettings.get().theme === "auto" && document.documentElement.dataset.text === "normal"));
    ck("beta: the page does not see the stable save or trophies", await p.evaluate(() => localStorage.getItem("numberics_endless_v1") === null && !NumbericsTrophies.has("fam_first")));
    for (const k of ["ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"]) await p.keyboard.press(k);
    await p.evaluate(() => { NumbericsSettings.set({ theme: "dark" }); NumbericsKit.flush(); });
    let r = await raw();
    ck("beta play: the game, progress and settings are written as numberics_beta_*", !!r.numberics_beta_endless_v1 && !!r.numberics_beta_settings_v1 && JSON.parse(r.numberics_beta_settings_v1).theme === "dark", Object.keys(r).join());
    ck("beta play: every stable key is untouched", (await stableSame()).length === 0, (await stableSame()).join());
    const keys = await p.evaluate(() => { const o = []; for (let i = 0; i < localStorage.length; i++) o.push(localStorage.key(i)); return o; });
    ck("beta: the page lists only its own keys, by their plain names", keys.length >= 2 && keys.every(k => k.indexOf("numberics_") === 0 && k.indexOf("numberics_beta_") !== 0), keys.join());
    // Save
    const file = await p.evaluate(() => NumbericsSettings.memory.pack());
    const held = await p.evaluate(t => Object.keys(NumbericsSettings.memory.unpack(t)), file);
    ck("beta Save: the file holds the beta data under plain names, nothing stable", held.includes("numberics_endless_v1") &&
      (await p.evaluate(t => JSON.parse(NumbericsSettings.memory.unpack(t).numberics_endless_v1).stable === undefined, file)), held.join());
    // Load (on a beta game page with its own pagehide save)
    const q = await ctx.newPage(); q.on("pageerror", e => errs.push(e.message));
    await q.goto(beta + "sudoku/");
    const nav = q.waitForNavigation(); await q.evaluate(t => NumbericsSettings.memory.loadText(t), file); await nav;
    r = await raw();
    ck("beta Load: the file lands in beta keys", r.numberics_beta_endless_v1 && JSON.parse(r.numberics_beta_settings_v1).theme === "dark");
    ck("beta Load: every stable key is untouched", (await stableSame()).length === 0, (await stableSame()).join());
    // Erase
    const nav2 = q.waitForNavigation(); await q.evaluate(() => NumbericsSettings.memory.erase()); await nav2;
    r = await raw();
    ck("beta Erase: the beta game keys are gone", !r.numberics_beta_endless_v1, Object.keys(r).join());
    ck("beta Erase: every stable key is untouched", (await stableSame()).length === 0, (await stableSame()).join());
    await st.reload();
    ck("stable: the page reads its own settings and save, never a beta key", await st.evaluate(() => NumbericsSettings.get().theme === "light" &&
      JSON.parse(localStorage.getItem("numberics_endless_v1")).stable === "two save" && !Storage.prototype.__nmBeta));
    await shot(p, "beta-two");
    ck("beta: no page errors", errs.length === 0, errs.join(" | "));
    await ctx.close();
  } finally { srv.close(); }
};
