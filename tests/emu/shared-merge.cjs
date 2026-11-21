/* SPDX-License-Identifier: Apache-2.0 | Copyright 2026 alvations (Melon Lab)
 * TRIAGE4 B2, frame by frame on the real pages of Two, Fibonacci and Three: during a merge the merged tile (and the
 * spawned tile) is invisible until the slide has landed, then pops; the moving partner slides all the way to the target
 * first. Every animation frame is sampled from the key press to the end of the beat (requestAnimationFrame).
 * Run: NODE_PATH=$(npm root -g) node tests/emu/run.cjs shared-merge */
"use strict";
module.exports = async function ({ browser, url, ck, shot }) {
  const SEEN = JSON.stringify({ v: 1, games: {}, howto: { two: true, fibonacci: true, three: true }, daily: {} });
  const GAMES = [
    { id: "two", path: "two/", api: "__numberics", grid: [1, 0, 0, 1], slide: 110 },
    { id: "fibonacci", path: "fibonacci/", api: "__fibonacci", grid: [2, 0, 0, 3], slide: 110 },
    { id: "three", path: "three/", api: "__three", grid: [1, 2, 0, 0], slide: 100 }
  ];
  for (const G of GAMES) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.addInitScript(s => { try { localStorage.setItem("numberics_progress_v1", s); } catch (e) { /* none */ } }, SEEN);
    const p = await ctx.newPage(), errs = []; p.on("pageerror", e => errs.push(e.message));
    await p.goto(url + G.path); await p.waitForFunction(a => !!window[a], G.api);
    for (let run = 0; run < 3; run++) {
      const r = await p.evaluate(async ({ api, grid }) => {
        const W = window[api], s = JSON.parse(JSON.stringify(W.state));
        s.grid = grid.concat(Array(16 - grid.length).fill(0)); s.over = false; s.prev = null;
        if ("next" in s) s.next = 1;
        W.state = s;
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        const L = document.getElementById("tiles"), frames = [], x = el => new DOMMatrix(getComputedStyle(el).transform).m41;
        const t0 = performance.now();
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
        const merged = L.querySelector(":scope > .tile.merged"), spawn = L.querySelector(":scope > .tile.new");
        const gone = [...L.querySelectorAll(":scope > .tile.gone")], target = merged ? x(merged) : 0;
        return new Promise(res => {
          (function f() {
            const now = performance.now() - t0, face = merged && merged.firstChild, st = face && getComputedStyle(face);
            frames.push({ t: Math.round(now), op: st ? +st.opacity : -1, sc: st ? new DOMMatrix(st.transform).a : 0,
              spawnOp: spawn ? +getComputedStyle(spawn.firstChild).opacity : 0,
              off: gone.map(g => g.isConnected ? Math.abs(x(g) - target) : 0) });
            if (now < 360) requestAnimationFrame(f); else res({ frames, merged: !!merged, gone: gone.length, spawn: !!spawn });
          })();
        });
      }, { api: G.api, grid: G.grid });
      const F = r.frames, landed = f => f.off.every(d => d < 0.5);
      const before = F.filter(f => !landed(f)), firstShown = F.find(f => f.op > 0.01);
      ck(G.id + " run " + run + ": a merge with its pair under it (merged node, two partners)", r.merged && r.gone === 2, JSON.stringify(r).slice(0, 300));
      ck(G.id + " run " + run + ": sampled every frame (" + F.length + " frames over 360 ms)", F.length >= 12, F.length);
      ck(G.id + " run " + run + ": the partner really slides (frames before it lands)", before.length >= 3, JSON.stringify(F.slice(0, 4)));
      ck(G.id + " run " + run + ": no merged face visible on any frame before the slide lands", before.every(f => f.op === 0),
        JSON.stringify(before.filter(f => f.op !== 0)));
      ck(G.id + " run " + run + ": the partner slides fully before the merged tile shows", !!firstShown && landed(firstShown), JSON.stringify(firstShown));
      ck(G.id + " run " + run + ": the merged tile shows only once the slide time is over", !!firstShown && firstShown.t >= G.slide - 17, JSON.stringify(firstShown));
      ck(G.id + " run " + run + ": then it pops (starts small, swells past 1, ends at 1 and fully shown)",
        !!firstShown && firstShown.sc < 1 && F.some(f => f.sc > 1.05) && F[F.length - 1].op === 1 && Math.abs(F[F.length - 1].sc - 1) < 0.01,
        JSON.stringify(F.filter(f => f.op > 0).slice(0, 8)));
      if (r.spawn) ck(G.id + " run " + run + ": the spawned tile is invisible until the slide lands", before.every(f => f.spawnOp === 0), JSON.stringify(before));
    }
    if (G.id === "two") { // a shot mid-merge: the pair still sliding, nothing new on top
      await p.evaluate(({ api, grid }) => { const W = window[api], s = JSON.parse(JSON.stringify(W.state));
        s.grid = grid.concat(Array(12).fill(0)); s.over = false; W.state = s; }, G);
      await p.waitForTimeout(50);
      await p.evaluate(() => {
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
        document.getAnimations().forEach(a => { a.pause(); a.currentTime = 55; }); // freeze the beat half-way through the slide
      });
      ck("two mid-merge: frozen half-way, the merged face is hidden", await p.evaluate(() => +getComputedStyle(document.querySelector("#tiles > .tile.merged").firstChild).opacity === 0));
      await shot(p, "two-mid-merge");
    }
    ck(G.id + ": no page errors", errs.length === 0, errs.join(" | "));
    await ctx.close();
  }
};
