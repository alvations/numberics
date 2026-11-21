/* SPDX-License-Identifier: Apache-2.0 | Copyright 2026 alvations (Melon Lab)
 * TRIAGE4 D7, one rule for sounds under fast play, on the real pages of Two and Fibonacci: real key presses 35, 60,
 * 100 and 140 ms apart. Every move that joins tiles plays exactly one join sound, while that move is still the
 * current one (never on the next key's move), never later than the end of its own slide, and never dropped.
 * Run: NODE_PATH=$(npm root -g) node tests/emu/run.cjs shared-sound */
"use strict";
module.exports = async function ({ browser, url, ck }) {
  const SEEN = JSON.stringify({ v: 1, games: {}, howto: { two: true, fibonacci: true }, daily: {} });
  const GAMES = [
    { id: "two", path: "", api: "__numberics", eng: "Numberics", slide: 110 },
    { id: "fibonacci", path: "fibonacci/", api: "__fibonacci", eng: "NumbericsFibonacci", slide: 110 }
  ];
  const KEYS = ["ArrowLeft", "ArrowDown", "ArrowRight", "ArrowDown"];
  for (const G of GAMES) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
    await ctx.addInitScript(s => { try { localStorage.setItem("numberics_progress_v1", s); } catch (e) { /* none */ } }, SEEN);
    const p = await ctx.newPage(), errs = []; p.on("pageerror", e => errs.push(e.message));
    await p.goto(url + G.path); await p.waitForFunction(a => !!window[a] && !!window.NumbericsAudio, G.api);
    // spies: the engine's move (which moves join) and the audio calls (which move is current when each plays)
    await p.evaluate(({ api, eng }) => {
      const W = window[api], E = window[eng], A = window.NumbericsAudio, mv = E.move;
      window.__log = { moves: {}, snd: [] };
      E.move = function (s, d) { const r = mv.apply(this, arguments); if (r.moved) window.__log.moves[r.state.moves] = { merges: r.merges.length, t: performance.now() }; return r; };
      ["slide", "merge"].forEach(n => { const f = A[n]; A[n] = function () { window.__log.snd.push({ n: n, m: W.state.moves, t: performance.now() }); try { return f.apply(A, arguments); } catch (e) { /* no sound */ } }; });
    }, { api: G.api, eng: G.eng });
    for (const gap of [35, 60, 100, 140]) {
      await p.evaluate(({ api, eng }) => { const W = window[api]; W.state = window[eng].newGame(2026); window.__log.moves = {}; window.__log.snd = []; }, { api: G.api, eng: G.eng });
      await p.waitForTimeout(400);
      for (let k = 0; k < 40; k++) {
        await p.keyboard.press(KEYS[k % 4]);
        await p.waitForTimeout(gap);
        if (await p.evaluate(a => window[a].state.over, G.api)) break;
      }
      await p.waitForTimeout(500);
      const L = await p.evaluate(() => window.__log);
      const joins = Object.keys(L.moves).map(Number).filter(m => L.moves[m].merges > 0);
      const merges = L.snd.filter(s => s.n === "merge"), slides = L.snd.filter(s => s.n === "slide");
      const per = m => merges.filter(s => s.m === m);
      const name = G.id + " at " + gap + " ms";
      ck(name + ": enough joins to judge (" + joins.length + " of " + Object.keys(L.moves).length + " moves)", joins.length >= 8, JSON.stringify(L.moves));
      ck(name + ": every join sounds, exactly once, while its own move is current (never dropped, never on the next key)",
        joins.every(m => per(m).length === 1), JSON.stringify(joins.filter(m => per(m).length !== 1).map(m => [m, per(m).length])));
      ck(name + ": no join sound for a move that joined nothing", merges.every(s => L.moves[s.m] && L.moves[s.m].merges > 0), JSON.stringify(merges));
      ck(name + ": never late: each join plays no later than its own slide's end", joins.every(m => {
        const sl = slides.find(s => s.m === m), j = per(m)[0]; return sl && j && j.t - sl.t <= G.slide + 25; }),
        JSON.stringify(joins.map(m => { const sl = slides.find(s => s.m === m), j = per(m)[0]; return sl && j ? Math.round(j.t - sl.t) : null; })));
      const sameKey = joins.filter(m => { const sl = slides.find(s => s.m === m), j = per(m)[0]; return sl && j && j.t - sl.t < 5; }).length;
      if (gap < G.slide) ck(name + ": under quick play the join sounds with its own key press (" + sameKey + " of " + joins.length + ")", sameKey >= joins.length - 2,
        sameKey + "/" + joins.length);
    }
    ck(G.id + ": no page errors", errs.length === 0, errs.join(" | "));
    await ctx.close();
  }
};
