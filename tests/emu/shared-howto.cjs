/* SPDX-License-Identifier: Apache-2.0 | Copyright 2026 alvations (Melon Lab)
 * TRIAGE4 D8, the one How to play sheet (shared/howto.js as NumbericsUI.howto) on every live game's page: the title
 * "How to play <Game>", three steps (a picture and one sentence each), a Play button that closes it, the first-visit
 * rule (opens by itself once, remembered; never with a saved game), the collapsed row's one button label "Show the
 * three steps", and no key reaches the game while it is open.
 * Run: NODE_PATH=$(npm root -g) node tests/emu/run.cjs shared-howto */
"use strict";
const fs = require("fs"), path = require("path");
module.exports = async function ({ browser, url, ck, shot }) {
  const games = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "..", "games.json"), "utf8")).filter(g => g.status === "live");
  const KEYS = ["ArrowLeft", "ArrowDown", "ArrowRight", "ArrowUp", "1", "2", "u", "n", "+", "5", "z", "d"];
  const snap = p => p.evaluate(() => { const m = document.querySelector("main") || document.body; return m.innerHTML.replace(/<div id="toast"[\s\S]*?<\/div>/, ""); });
  for (const g of games) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const p = await ctx.newPage(), errs = []; p.on("pageerror", e => errs.push(e.message));
    await p.goto(url + g.path);
    await p.waitForFunction(() => window.NumbericsUI && window.NumbericsUI.current && window.NumbericsUI.current() === "howto", null, { timeout: 4000 }).catch(() => {});
    const how = await p.evaluate(() => {
      const sc = document.getElementById("sh-howto"), q = s => sc ? sc.querySelectorAll(s) : [];
      return { open: !!sc && !sc.hidden, title: sc ? sc.querySelector("h2").textContent : "", steps: q(".howto .step").length,
        pics: q(".howto .step .pv").length, texts: [...q(".howto .step p")].map(e => e.textContent),
        play: [...q("button")].filter(b => b.textContent === "Play" && b.classList.contains("primary")).length };
    });
    ck(g.id + ": a first visit opens How to play by itself", how.open, JSON.stringify(how));
    ck(g.id + ": the title is \"How to play " + g.name + "\"", how.title === "How to play " + g.name, how.title);
    ck(g.id + ": three steps, each a picture and one sentence", how.steps === 3 && how.pics === 3 && how.texts.every(t => t.length > 5 && /\.$/.test(t)), JSON.stringify(how.texts));
    ck(g.id + ": one Play button", how.play === 1);
    ck(g.id + ": opening it remembers it (NumbericsProgress)", await p.evaluate(id => window.NumbericsProgress.seenHowto(id), g.id));
    if (g.id === "two") await shot(p, "two-howto");
    // keys never reach the game while it is open (focus on the sheet, and focus left on the page)
    await p.waitForTimeout(300);
    const s0 = await snap(p);
    for (const k of KEYS) await p.keyboard.press(k);
    await p.evaluate(() => { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); });
    for (const k of KEYS) await p.keyboard.press(k);
    await p.waitForTimeout(250);
    ck(g.id + ": no key reaches the game while it is open", (await snap(p)) === s0 && await p.evaluate(() => window.NumbericsUI.current() === "howto"));
    await p.click("#sh-howto [data-play]");
    ck(g.id + ": Play closes it", await p.evaluate(() => !window.NumbericsUI.open()));
    // the row: collapsed, one button with the one label, it reopens the same sheet
    const row = await p.evaluate(() => { const d = document.querySelector("details.how"), b = d && d.querySelectorAll("button");
      return { ok: !!d && !d.open && d.querySelector("summary").textContent === "How to play", n: b ? b.length : 0, label: b && b[0] ? b[0].textContent : "" }; });
    ck(g.id + ": the collapsed How to play row has one button, \"Show the three steps\"", row.ok && row.n === 1 && row.label === "Show the three steps", JSON.stringify(row));
    await p.click("details.how summary"); await p.click("details.how [data-howto]");
    ck(g.id + ": the row reopens it", await p.evaluate(g => window.NumbericsUI.current() === "howto" && document.querySelector("#sh-howto h2").textContent === "How to play " + g, g.name));
    await p.keyboard.press("Escape");
    // a returning player: it never opens by itself again
    await p.reload(); await p.waitForTimeout(400);
    ck(g.id + ": it opens only once", await p.evaluate(() => !window.NumbericsUI.open()));
    ck(g.id + ": no page errors", errs.length === 0, errs.join(" | "));
    await ctx.close();
  }
  // never on a page with a saved game: a Two and a Fibonacci save, the how-to never seen
  for (const g of games.filter(x => x.id === "two" || x.id === "fibonacci")) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const p = await ctx.newPage();
    await p.goto(url + g.path); await p.waitForTimeout(300);
    if (await p.evaluate(() => window.NumbericsUI.open())) await p.click("#sh-howto [data-play]");
    for (const k of ["ArrowLeft", "ArrowDown", "ArrowRight"]) { await p.keyboard.press(k); await p.waitForTimeout(150); }
    await p.reload(); await p.waitForTimeout(300); // the reload's pagehide writes the save
    await p.evaluate(() => { const k = "numberics_progress_v1", o = JSON.parse(localStorage.getItem(k)); o.howto = {}; localStorage.setItem(k, JSON.stringify(o)); });
    await p.reload(); await p.waitForTimeout(500);
    ck(g.id + ": with a saved game it never opens by itself", await p.evaluate(() => !window.NumbericsUI.open() && !window.NumbericsProgress.seenHowto(location.pathname.indexOf("fibonacci") >= 0 ? "fibonacci" : "two")));
    await ctx.close();
  }
};
