/* SPDX-License-Identifier: Apache-2.0 | Copyright 2026 alvations (Melon Lab)
 * Browser checks for shared/motion.js on tests/fixtures/motion-probe.html (the real Two engine through the keyed layer):
 * identity-keyed slides, merge pop and spawn after the slide, input during an animation, rapid-input frame budget and
 * node count (REDESIGN.md 10), Undo re-key, gravity fall + settle and edge entry, reduced motion via the OS and via
 * the setting, Full beating the OS, blocked storage. Run: NODE_PATH=$(npm root -g) node tests/emu/run.cjs shared-motion */
"use strict";
module.exports = async function ({ browser, url, ck, shot }) {
  const page = url + "tests/fixtures/motion-probe.html";
  const settings = m => "try { localStorage.setItem('numberics_settings_v1', JSON.stringify({ v: 1, motion: '" + m + "' })); } catch (e) {}";
  async function open(o) {
    const ctx = await browser.newContext(Object.assign({ viewport: { width: 1280, height: 860 } }, o && o.ctx));
    if (o && o.init) await ctx.addInitScript(o.init);
    const p = await ctx.newPage(), errs = []; p.on("pageerror", e => errs.push(e.message));
    await p.goto(page + (o && o.q || "")); await p.waitForFunction(() => !!window.__probe);
    return { ctx, p, errs };
  }
  // one move on the fixed demo board (2 2 . 4 / ... / 8 in the corner), everything read in the same task as the move
  const demoMove = p => p.evaluate(() => {
    const P = window.__probe; P.demo();
    const L = document.getElementById("tiles"), before = P.ids, four = L.querySelector('[data-id="' + before[3] + '"]');
    window.__four = four; void getComputedStyle(four).transform; // the board has been on screen: a frame's style exists
    P.move("left");
    const tiles = [...L.children], cls = c => tiles.filter(t => t.classList.contains(c));
    const merged = cls("merged")[0], spawn = cls("new")[0];
    const anims = document.getAnimations().map(a => ({ type: a.constructor.name, name: a.animationName || a.transitionProperty || "",
      keys: a.effect.getKeyframes().flatMap(k => Object.keys(k).filter(x => !/^(offset|easing|composite|computedOffset)$/.test(x))),
      dur: a.effect.getTiming().duration, delay: a.effect.getTiming().delay }));
    return {
      count: tiles.length, board: P.onBoard(), gone: cls("gone").length,
      goneAt: cls("gone").map(t => t.style.getPropertyValue("--c") + "," + t.style.getPropertyValue("--r")),
      mergedFace: merged && getComputedStyle(merged.firstChild).animationName, mergedDelay: merged && getComputedStyle(merged.firstChild).animationDelay,
      spawnFace: spawn && getComputedStyle(spawn.firstChild).animationName,
      sameFour: L.contains(four) && four.style.getPropertyValue("--c") === "1",
      trans: getComputedStyle(four).transitionDuration, reducedCls: L.classList.contains("nmm-reduced"), anims
    };
  });
  const after = p => p.evaluate(() => { const P = window.__probe, L = document.getElementById("tiles"); P.layer.finish();
    return { count: L.children.length, board: P.onBoard(), flagged: L.querySelectorAll(".gone,.merged,.new").length, four: L.contains(window.__four) }; });

  // 1. full motion: identity-keyed slide, merge pop and spawn after the slide
  let { ctx, p, errs } = await open();
  ck("probe loads with the two starting tiles as two nodes", await p.evaluate(() => document.querySelectorAll("#tiles > .tile").length === 2 && window.__probe.onBoard() === 2));
  let d = await demoMove(p);
  ck("the 4 keeps its element and slides (same node, new --c, transform transition 110 ms)", d.sameFour && d.trans === "0.11s", JSON.stringify(d));
  ck("the slide is a CSS transform transition, retargetable", d.anims.some(a => a.type === "CSSTransition" && a.name === "transform"), JSON.stringify(d.anims));
  ck("both merged-from tiles stay under the new tile as gone, at the target cell", d.gone === 2 && d.goneAt.every(x => x === "0,0"), JSON.stringify(d.goneAt));
  ck("the merged tile pops after the slide (nmm-pop, delay 110 ms)", d.mergedFace === "nmm-pop" && d.mergedDelay === "0.11s", d.mergedFace + " " + d.mergedDelay);
  ck("the spawned tile appears after the slide (nmm-appear)", d.spawnFace === "nmm-appear");
  ck("node count during the move = board + gone", d.count === d.board + 2, d.count + " vs " + d.board);
  ck("only transform and opacity animate", d.anims.every(a => a.keys.every(k => k === "transform" || k === "opacity")), JSON.stringify(d.anims));
  let f = await after(p);
  ck("finish() leaves exactly the board's tiles, no flags, the 4 still the same node", f.count === f.board && f.flagged === 0 && f.four, JSON.stringify(f));
  await p.evaluate(() => window.__probe.move("right"));
  await p.waitForTimeout(450);
  ck("the settle timer cleans up on its own (busy() false, nodes = board)", await p.evaluate(() => !window.__probe.layer.busy() && document.querySelectorAll("#tiles > .tile").length === window.__probe.onBoard()));
  await shot(p, "probe");

  // 2. input during an animation is applied at once (two quick keys = two moves)
  const m0 = await p.evaluate(() => { const P = window.__probe; P.demo(); return P.state.moves; });
  await p.keyboard.press("ArrowLeft"); await p.keyboard.press("ArrowRight");
  ck("two quick keys during the animation advance the state by two moves", await p.evaluate(() => window.__probe.state.moves) === m0 + 2);

  // 3. rapid input: a move every 45 ms for 2 s; frame times, handler time and node count sampled every frame
  const rapidRun = () => p.evaluate(() => new Promise(res => {
    const P = window.__probe, L = document.getElementById("tiles"), dirs = ["left", "up", "right", "down"];
    P.demo(); P.handlerMs.length = 0;
    const frames = [], over = []; let last = performance.now(), i = 0, stop = false, maxOver = 0;
    function raf(t) { frames.push(t - last); last = t; const n = L.children.length - P.onBoard(); maxOver = Math.max(maxOver, n); if (!stop) requestAnimationFrame(raf); }
    requestAnimationFrame(t => { last = t; requestAnimationFrame(raf); });
    const iv = setInterval(() => {
      let moved = false; for (let k = 0; k < 4 && !moved; k++) moved = P.move(dirs[(i + k) % 4]);
      if (!moved) P.demo(); // a locked board starts again
      i++; over.push(L.children.length - P.onBoard());
    }, 45);
    setTimeout(() => { clearInterval(iv); stop = true;
      setTimeout(() => res({ frames: frames.slice(2), over, maxOver, handler: P.handlerMs.slice(), count: L.children.length, board: P.onBoard() }), 450);
    }, 2000);
  }));
  const pct = (a, q) => { const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * q))] || 0; };
  const report = (tag, r) => console.log("  motion probe " + tag + ": " + r.over.length + " inputs, " + r.frames.length + " frames, frame p95 " +
    pct(r.frames, .95).toFixed(2) + " ms, worst " + Math.max(...r.frames).toFixed(2) + " ms, handler p95 " + pct(r.handler, .95).toFixed(2) + " ms, max extra nodes " + r.maxOver);
  const rapid = await rapidRun(); report("desktop", rapid);
  const fr = rapid.frames, p95 = pct(fr, .95), h95 = pct(rapid.handler, .95);
  ck("rapid input: about 44 inputs were applied", rapid.over.length >= 40, rapid.over.length);
  ck("rapid input: frame p95 <= 16.7 ms (rAF interval at 60 Hz; 0.8 ms vsync jitter allowed)", p95 <= 17.5, p95.toFixed(2));
  ck("rapid input: no frame > 20 ms is the norm (at most 2% over)", fr.filter(x => x > 20).length <= Math.ceil(fr.length * 0.02), fr.filter(x => x > 20).map(x => x.toFixed(1)).join(","));
  ck("rapid input: the input handler (finish + move + sync) p95 <= 4 ms", h95 <= 4, h95.toFixed(2));
  ck("rapid input: tile nodes stay <= tiles on board + 8 at every frame and input", rapid.maxOver <= 8 && Math.max(...rapid.over) <= 8, rapid.maxOver);
  ck("rapid input: after the settle, nodes = board exactly", rapid.count === rapid.board, rapid.count + " vs " + rapid.board);
  // the same at 4x CPU throttle (REDESIGN.md 10: every frame <= 33 ms)
  const cdp = await ctx.newCDPSession(p); await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  const slow = await rapidRun(); report("4x CPU", slow);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  ck("4x CPU throttle: frame p95 <= 33 ms, nodes bounded, settles to the board", pct(slow.frames, .95) <= 33 && slow.maxOver <= 8 && slow.count === slow.board, pct(slow.frames, .95).toFixed(2));

  // 4. Undo re-keys the board: every node is new and fades in (opacity only), nothing slides
  const u = await p.evaluate(() => { const P = window.__probe, L = document.getElementById("tiles"); P.demo(); P.layer.finish(); P.move("left"); P.layer.finish();
    const old = [...L.children]; const okU = P.undo();
    const now = [...L.children];
    return { okU, fresh: now.every(n => !old.includes(n)), fade: now.every(n => n.classList.contains("nmm-fadein")),
      face: getComputedStyle(now[0].firstChild).animationName, count: now.length, board: P.onBoard(),
      anyTrans: document.getAnimations().some(a => a.constructor.name === "CSSTransition") }; });
  ck("Undo re-key: every node is new, fades in with nmm-fade, no slide", u.okU && u.fresh && u.fade && u.face === "nmm-fade" && !u.anyTrans && u.count === u.board, JSON.stringify(u));

  // 5. gravity fall + settle and edge entry, on a second layer (Seven, Four, Three use these)
  const fall = await p.evaluate(() => {
    const M = window.NumbericsMotion, el = document.createElement("div"); document.getElementById("board").appendChild(el);
    const L = M.layer(el, { cols: 7, rows: 6, clip: true });
    L.sync([{ id: 1, cell: 35, label: "1" }, { id: 2, cell: 28, label: "2" }]);
    L.sync([{ id: 1, cell: 35, label: "1" }, { id: 2, cell: 28, label: "2" }, { id: 3, cell: 21, label: "3" }], { falls: [{ id: 3, rows: 4 }] });
    const face = L.get(3).firstChild, a = face.getAnimations(), k0 = a[0] && a[0].effect.getKeyframes()[0].transform;
    const pitch = el.clientHeight / 6;
    const out = { n: a.length, dur: a[0] && a[0].effect.getTiming().duration, ease: a[0] && a[0].effect.getTiming().easing, k0,
      dy: k0 && -parseFloat(k0.match(/translateY\((-?[\d.]+)px/)[1]), pitch,
      settleDelay: a[1] && a[1].effect.getTiming().delay, comp: a[1] && a[1].effect.composite, clip: getComputedStyle(el).overflow };
    // Three: a tile enters from beyond the right edge
    const T3 = document.createElement("div"); document.getElementById("board").appendChild(T3);
    const E = M.layer(T3, { cols: 4, rows: 4, slide: M.T.step, clip: true });
    E.sync([{ id: 9, cell: 3, label: "1" }], { enter: { 9: { r: 0, c: 4 } } });
    const ea = E.get(9).firstChild.getAnimations()[0];
    out.enter = ea && { dur: ea.effect.getTiming().duration, k0: ea.effect.getKeyframes()[0].transform, op: ea.effect.getKeyframes()[0].opacity };
    out.slideVar = getComputedStyle(E.get(9)).transitionDuration;
    L.finish(); E.finish(); out.left = face.getAnimations().length;
    el.remove(); T3.remove();
    return out;
  });
  ck("fall: the disc drops 4 rows over fallMs(4) = 190 ms on the gravity ease", fall.n === 2 && fall.dur === 190 && fall.ease === "cubic-bezier(0.55, 0, 1, 0.45)", JSON.stringify(fall));
  ck("fall: the drop distance is 4 pitches, measured once", Math.abs(fall.dy - 4 * fall.pitch) < 4 * 2, fall.dy + " vs " + 4 * fall.pitch);
  ck("fall: the settle squash starts at landing and adds to the fall", fall.settleDelay === 190 && fall.comp === "add", JSON.stringify(fall));
  ck("fall: clip option clips the off-board start", fall.clip === "clip");
  ck("enter (Three): the new tile starts one cell beyond the edge, transparent, and slides in over T.step", fall.enter && fall.enter.dur === 100 && /^translate\(\d/.test(fall.enter.k0) && +fall.enter.op === 0 && fall.slideVar === "0.1s", JSON.stringify(fall.enter) + " " + fall.slideVar);
  ck("finish() ends the fall at once", fall.left === 0);
  ck("no page errors (full motion)", errs.length === 0, errs.join("|"));
  await ctx.close();

  // 6. reduced motion via the OS (setting Device): final states with opacity only, nothing lingers
  const reducedChecks = async (label, o) => {
    ({ ctx, p, errs } = await open(o));
    d = await demoMove(p);
    ck(label + ": the layer is reduced", d.reducedCls);
    ck(label + ": tiles do not transition (0s), nothing is a transform animation", d.trans === "0s" && d.anims.every(a => a.keys.every(k => k === "opacity")) && !d.anims.some(a => a.type === "CSSTransition"), JSON.stringify(d.anims) + d.trans);
    ck(label + ": merged-from tiles are gone at once (nodes = board)", d.count === d.board && d.gone === 0, d.count + "/" + d.board);
    ck(label + ": merged and spawned tiles fade in (nmm-fade)", d.mergedFace === "nmm-fade" && d.spawnFace === "nmm-fade", d.mergedFace + " " + d.spawnFace);
    const fl = await p.evaluate(() => { const M = window.NumbericsMotion, el = document.createElement("div"); document.getElementById("board").appendChild(el);
      const L = M.layer(el, { cols: 7, rows: 6 }); L.sync([{ id: 3, cell: 21, label: "3" }], { falls: [{ id: 3, rows: 4 }], spawns: [] });
      const r = { anims: L.get(3).firstChild.getAnimations().filter(a => a.effect.getKeyframes().some(k => k.transform)).length, name: getComputedStyle(L.get(3).firstChild).animationName,
        play: M.play(el, [{ transform: "scale(0)" }, { transform: "none" }], 300) === null,
        playR: (a => a && a.effect.getTiming().duration)(M.play(el, [{ transform: "scale(0)" }], 300, [{ opacity: 0, transform: "scale(0)" }, { opacity: 1 }])) };
      el.remove(); return r; });
    ck(label + ": a falling disc lands at once and fades in, no translate", fl.anims === 0 && fl.name === "nmm-fade", JSON.stringify(fl));
    ck(label + ": play() skips motion frames and clamps the opacity fade to 160 ms", fl.play && fl.playR === 160, JSON.stringify(fl));
    ck(label + ": quick keys still apply every move", await (async () => { const m = await p.evaluate(() => window.__probe.state.moves);
      await p.keyboard.press("ArrowRight"); await p.keyboard.press("ArrowLeft"); return (await p.evaluate(() => window.__probe.state.moves)) === m + 2; })());
    ck(label + ": no page errors", errs.length === 0, errs.join("|"));
    await shot(p, label.replace(/\W+/g, "-"));
    await ctx.close();
  };
  await reducedChecks("OS reduce, setting Device", { ctx: { reducedMotion: "reduce" } });
  await reducedChecks("setting Less, OS no preference", { ctx: { reducedMotion: "no-preference" }, init: settings("reduced") });

  // 7. setting Full beats a reducing OS
  ({ ctx, p, errs } = await open({ ctx: { reducedMotion: "reduce" }, init: settings("full") }));
  d = await demoMove(p);
  ck("setting Full + OS reduce: tiles slide (110 ms) and the merged tile pops", !d.reducedCls && d.trans === "0.11s" && d.mergedFace === "nmm-pop", JSON.stringify(d));
  ck("no page errors (Full over OS reduce)", errs.length === 0, errs.join("|"));
  await ctx.close();

  // 8. blocked storage: motion still works (settings degrade to defaults)
  ({ ctx, p, errs } = await open({ init: "Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } });" }));
  d = await demoMove(p);
  ck("blocked storage: the move animates and nothing throws", d.sameFour && d.mergedFace === "nmm-pop" && errs.length === 0, errs.join("|"));
  await ctx.close();
};
