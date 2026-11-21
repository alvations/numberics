/* SPDX-License-Identifier: Apache-2.0 | Copyright 2026 alvations (Melon Lab)
 * Three's Easy / Medium / Hard tiers (O-13, Two's recipe): `node tests/test-three-tiers.js`
 * Hard is the rule before the tiers byte for byte (flushes only; replay hashes pinned from the engine before O-12).
 * Medium also pays each join that makes a tile as big as the top tile (from 18 up), Easy each join that makes at least
 * half the top tile (from 9 up). Every anti-farm rule holds on every tier: the swipe after Smash, Swap or Third pays
 * nothing (state.free), a power-up never pays, Undo restores the stock, the cap is 9. */
"use strict";
const fs = require("fs"), path = require("path"), crypto = require("crypto");
const T = require("../three/engine.js");
let pass = 0, fail = 0;
function t(n, f) { try { f(); pass++; } catch (e) { fail++; console.log("FAIL", n, "\n  ", e.message); } }
function ok(c, m) { if (!c) throw new Error(m || "assertion failed"); }
function eq(a, b, m) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || "") + " got " + JSON.stringify(a) + " want " + JSON.stringify(b)); }
const TIERS = ["easy", "medium", "hard"];
const P0 = (o) => Object.assign({ undo: 0, smash: 0, swap: 0, third: 0 }, o);
const tot = (s) => T.POWERS.reduce((a, p) => a + s.power[p], 0);
const E16 = () => new Array(16).fill(0);
// a state on a tier with a hand-made grid (bag and seed from a real game); the top tile is the grid's unless given
function at(grid, extra, tier) {
  const s = T.newGame(7, tier); s.grid = grid.slice(); s.top = Math.max(...grid); s.next = 1; s.power = P0();
  return Object.assign(s, extra || {});
}
const paid = (r) => (r.joins || []).filter(j => j.power).length;

// ---- Hard is the original rule ----
t("Hard is the default: no tier field, and newGame(seed, 'hard') is newGame(seed) exactly", () => {
  for (let sd = 1; sd <= 50; sd++) { eq(T.newGame(sd, "hard"), T.newGame(sd)); ok(!("tier" in T.newGame(sd))); }
  eq(T.tierOf(T.newGame(1)), "hard"); eq(T.tierOf({ tier: "nonsense" }), "hard"); eq(T.tierOf(T.newGame(1, "easy")), "easy");
  eq(T.TIERS, TIERS); eq(T.REACH, { easy: 2, medium: 0 }); eq(T.FLOOR, 18);
  eq(T.payFrom(T.newGame(1)), Infinity, "Hard: no join pays");
});
t("Hard replays the rules before the tiers: 1000 random swipes and power-ups hash as the pre-O-12 engine did", () => {
  // hashes recorded from three/engine.js at commit 9434c7d (before O-12 and O-13), the driver of tests/test.js
  const WANT = { 1: "e7852d201d781bf57ef12f51b9586d828760af4c93ae28b4f0ee044eee20496e", 2: "0339ea2db8924f180b8ba9e8c7fcf9287e41eb5a020f11d6a57e573e28ca49cd",
    3: "176a223814a64899b7d1dc682fb798372778eea8db24e45eea3170950f8ec4a8", 7: "b483491b80437b784af76c8f5206faf4a2fd24a4ae8f5b896f1f716f8e6254eb",
    42: "69d61cc68fbd4dad4b693ba363330ca88156ad0c0b6240b2d884ca3433eaaa65" };
  Object.keys(WANT).forEach(k => {
    const seed = +k, h = crypto.createHash("sha256");
    let s = T.newGame(seed, "hard"), d = seed * 7919 + 1, games = 1;
    const r = () => { const x = T.rand(d); d = x[1]; return x[0]; };
    for (let i = 0; i < 1000; i++) {
      if (s.over) { s = T.newGame(seed * 1000 + games++, "hard"); h.update(JSON.stringify(s)); continue; }
      const c = r(); let res;
      if (c < 0.9) res = T.move(s, T.DIRS[Math.floor(r() * 4)]);
      else {
        const name = T.POWERS[Math.floor(r() * 4)];
        if (s.power[name] < 1 && r() < 0.7) s = Object.assign({}, s, { power: Object.assign({}, s.power, { [name]: 1 }) });
        res = T.use(s, name, Math.floor(r() * 18) - 1, Math.floor(r() * 18) - 1);
      }
      h.update(JSON.stringify(res)); s = res.state;
    }
    eq(h.digest("hex"), WANT[k], "seed " + k);
  });
});
t("the tier only decides who pays: from the same board a swipe slides and joins the same tiles; Easy joins pay >= Medium's", () => {
  let steps = 0, more = 0, med = 0;
  for (let sd = 1; sd <= 40; sd++) {
    let s = T.newGame(sd);
    for (let i = 0; i < 300 && !s.over; i++) {
      const d = T.DIRS[(i * 7 + sd) % 4], r = TIERS.map(tr => T.move(tr === "hard" ? s : Object.assign({}, s, { tier: tr }), d));
      if (!r[2].moved) { if (!T.canMove(s)) break; continue; }
      r.forEach(x => { eq(x.trace, r[2].trace); eq(x.gained, r[2].gained); });
      ok(!("joins" in r[2]) && paid(r[1]) <= paid(r[0]), "ladder order");
      eq(r[0].state.tier, "easy"); eq(r[1].state.tier, "medium"); ok(!("tier" in r[2].state), "Hard stays without the field");
      if (paid(r[0]) > paid(r[1])) more++;
      if (paid(r[1])) med++;
      steps++; s = r[2].state;
    }
  }
  ok(steps > 2000 && more > 30 && med > 5, "steps " + steps + ", Easy paid more " + more + ", Medium paid " + med);
});

// ---- what each tier pays ----
t("payFrom: Medium the top tile, Easy half of it (two ladder rungs); the floor (18) moves with the reach", () => {
  const top = (v, tr) => T.payFrom(at([v], {}, tr));
  eq([top(36, "medium"), top(36, "easy")], [36, 18]);
  eq([top(48, "medium"), top(48, "easy")], [48, 24]);
  eq([top(72, "medium"), top(72, "easy")], [72, 36]);
  eq([top(12, "medium"), top(12, "easy")], [18, 9], "below the floor: 18 on Medium, 9 on Easy");
  eq([top(3, "medium"), top(3, "easy")], [18, 9]);
});
t("at top 36: 18 + 18 = 36 pays on Medium and Easy; 9 + 9 = 18 on Easy only; 6 + 6 = 12 never; Hard never pays a join", () => {
  const row = (a, b) => { const g = E16(); g[0] = a; g[1] = b; g[15] = 36; return g; };
  TIERS.forEach(tr => {
    const r = T.move(at(row(18, 18), {}, tr), "left");
    eq(r.state.grid[0], 36); eq(tot(r.state), tr === "hard" ? 0 : 1, tr + " 36");
    if (tr !== "hard") { eq(r.joins.length, 1); eq(r.joins[0].value, 36); eq(r.joins[0].at, 0); ok(r.joins[0].paid); }
    eq(tot(T.move(at(row(9, 9), {}, tr), "left").state), tr === "easy" ? 1 : 0, tr + " 18");
    eq(tot(T.move(at(row(6, 6), {}, tr), "left").state), 0, tr + " 12");
  });
});
t("the opening: before an 18, Medium pays nothing new; Easy pays 9s (3 + 6) and up", () => {
  const g = E16(); g[0] = 3; g[1] = 6; g[15] = 12;
  eq(tot(T.move(at(g, {}, "medium"), "left").state), 0); eq(tot(T.move(at(g, {}, "easy"), "left").state), 1);
  const h = E16(); h[0] = 3; h[1] = 3; h[15] = 12;
  TIERS.forEach(tr => eq(tot(T.move(at(h, {}, tr), "left").state), 0, tr + " a 6 never pays"));
  const k = E16(); k[0] = 9; k[1] = 9; k[15] = 12;
  TIERS.forEach(tr => eq(tot(T.move(at(k, {}, tr), "left").state), tr === "hard" ? 0 : 1, tr + " the first 18"));
});
t("every qualifying join in a swipe pays one; a join on a full stock is flagged full", () => {
  const g = E16(); g[0] = 18; g[1] = 18; g[4] = 18; g[5] = 18; g[15] = 36;
  eq(tot(T.move(at(g, {}, "medium"), "left").state), 2); eq(tot(T.move(at(g, {}, "hard"), "left").state), 0);
  const full = T.move(at(g, { power: { undo: 9, smash: 9, swap: 9, third: 9 } }, "easy"), "left");
  eq(full.joins.map(j => j.full), [true, true]); eq(tot(full.state), 36);
});
t("a join and a flush in one swipe both pay", () => {
  // row 0: 18 + 18 joins (top 36); row 2 reads 12, 9, _, 6 and the 6 steps left into 12-9-6: a flush on the same swipe
  const g = E16(); g[0] = 18; g[1] = 18; g[8] = 12; g[9] = 9; g[11] = 6; g[15] = 36;
  ["medium", "easy"].forEach(tr => {
    const r = T.move(at(g, {}, tr), "left");
    eq(r.flushes.length, 1, tr + " flush"); eq(paid(r), 1, tr + " join"); eq(tot(r.state), 2, tr + " two rewards");
  });
  eq(tot(T.move(at(g, {}, "hard"), "left").state), 1, "Hard: the flush only");
});
t("the tier survives swipes, power-ups and Undo", () => {
  ["easy", "medium"].forEach(tr => {
    let s = T.newGame(9, tr); s.power = P0({ undo: 3, smash: 3, swap: 3, third: 3 });
    const m = T.DIRS.map(d => T.move(s, d)).find(r => r.moved); s = m.state; eq(s.tier, tr, "move");
    const a = s.grid.findIndex(Boolean), small = s.grid.findIndex(v => v === 1 || v === 2);
    eq(T.use(s, "smash", a).state.tier, tr, "smash"); if (small >= 0) eq(T.use(s, "third", small).state.tier, tr, "third");
    eq(T.use(s, "undo").state.tier, tr, "undo");
  });
});

// ---- anti-farm, on every tier ----
TIERS.forEach(tr => {
  t(tr + ": the swipe after Smash, Swap or Third pays nothing for its joins (state.free); the next one pays", () => {
    // Swap the 9 and the second 18: the swipe that joins 18 + 18 = 36 pays nothing
    const g = E16(); g[0] = 18; g[1] = 9; g[2] = 18; g[15] = 36;
    const u = T.use(at(g, { power: P0({ swap: 1 }) }, tr), "swap", 1, 2); ok(u.ok); ok(u.state.free);
    const m = T.move(u.state, "left"); eq(m.state.grid[0], 36); eq(tot(m.state), 0);
    if (tr !== "hard") { ok(m.free, "the result says why"); eq(m.joins[0].paid, false); }
    const again = E16(); again[0] = 18; again[1] = 18; again[15] = 36;
    eq(tot(T.move(at(again, {}, tr), "left").state), tr === "hard" ? 0 : 1);
  });
  t(tr + ": a power-up followed by any swipe never raises the total stock (random games)", () => {
    let checked = 0, honest = 0;
    for (let seed = 1; seed <= 80; seed++) {
      let s = T.newGame(seed, tr), x = seed;
      s.power = { undo: 2, smash: 3, swap: 3, third: 3 };
      for (let i = 0; i < 300 && !s.over; i++) {
        x = (x * 1103515245 + 12345) >>> 0;
        if (x % 5 === 0) {
          const name = T.POWERS[1 + (x >>> 3) % 3], a = (x >>> 5) % 16, b = a % 4 < 3 ? a + 1 : a + 4;
          const before = tot(s), u = T.use(s, name, a, b);
          if (u.ok) {
            ok(tot(u.state) === before - 1, "use pays nothing, seed " + seed);
            T.DIRS.forEach(d => { const r = T.move(u.state, d); if (r.moved) { ok(tot(r.state) < before, "swipe after " + name + ", seed " + seed); checked++; } });
            s = u.state; continue;
          }
        }
        const r = T.move(s, T.DIRS[(x >>> 7) % 4]); if (r.moved) { if (tot(r.state) > tot(s)) honest++; s = r.state; }
        else if (!T.canMove(s)) break;
      }
    }
    ok(checked > 200, "exercised " + checked); ok(honest > 20, "honest swipes still pay (" + honest + ")");
  });
  t(tr + ": Undo cycling never earns (swipe, Undo, swipe ... ends with no more stock than one honest swipe gives)", () => {
    let cycles = 0;
    for (let sd = 1; sd <= 60; sd++) {
      let s = T.newGame(sd, tr), x = sd;
      for (let i = 0; i < 200 && !s.over; i++) {
        x = (x * 1103515245 + 12345) >>> 0;
        const d = T.DIRS[(x >>> 7) % 4], r = T.move(s, d);
        if (!r.moved) { if (!T.canMove(s)) break; continue; }
        if (x % 3 === 0) {
          const base = Object.assign({}, s, { power: Object.assign({}, s.power, { undo: 9 }) }), t0 = tot(base);
          let v = base;
          for (let k = 0; k < 4; k++) {
            const m = T.move(v, d), u = T.use(m.state, "undo"); if (!u.ok) break;
            eq(u.state.grid, base.grid); ok(tot(u.state) === tot(v) - 1, "an Undo costs one and rewinds the reward"); v = u.state;
          }
          const last = T.move(v, d);
          ok(tot(last.state) <= t0 + (tot(r.state) - tot(s)), "cycling paid more than one swipe");
          cycles++;
        }
        s = r.state;
      }
    }
    ok(cycles > 500, "cycles " + cycles);
  });
  t(tr + ": no short loop back to the same board ever ends with more stock (no-progress loops)", () => {
    let loops = 0;
    for (let sd = 1; sd <= 50; sd++) {
      let s = T.newGame(sd, tr), x = sd * 40503;
      const rnd = () => { x = (x * 1103515245 + 12345) >>> 0; return x / 4294967296; };
      for (let i = 0; i < 150 && !s.over; i++) {
        const r = T.move(s, T.DIRS[Math.floor(rnd() * 4)]); if (r.moved) s = r.state; else if (!T.canMove(s)) break;
        if (i < 20) continue;
        for (let trial = 0; trial < 25; trial++) {
          // three more of each, in the state and in its Undo snapshot, so the snapshot keeps the stock it really had
          // before the last swipe (a swipe that paid two leaves the snapshot two lower, as in play)
          const more = (p) => ({ undo: p.undo + 3, smash: p.smash + 3, swap: p.swap + 3, third: p.third + 3 });
          let v = Object.assign({}, s, { power: more(s.power), prev: s.prev && Object.assign({}, s.prev, { power: more(s.prev.power) }) });
          const t0 = tot(v), len = 2 + Math.floor(rnd() * 5);
          for (let k = 0; k < len; k++) {
            const c = rnd();
            if (c < 0.45) { const m = T.move(v, T.DIRS[Math.floor(rnd() * 4)]); if (m.moved) v = m.state; }
            else {
              const name = c < 0.6 ? "undo" : c < 0.8 ? "smash" : c < 0.92 ? "swap" : "third";
              const a = Math.floor(rnd() * 16), b = a % 4 < 3 ? a + 1 : a - 4;
              const u = T.use(v, name, a, b); if (u.ok) v = u.state;
            }
            if (k > 0 && JSON.stringify(v.grid) === JSON.stringify(s.grid)) { loops++; ok(tot(v) <= t0, "a loop raised the stock: seed " + sd); }
          }
        }
      }
    }
    ok(loops > 300, "loops found " + loops);
  });
  t(tr + ": the stock never passes 9", () => {
    for (let sd = 1; sd <= 40; sd++) {
      let s = T.newGame(sd, tr); s.power = { undo: 8, smash: 9, swap: 9, third: 9 };
      for (let i = 0; i < 300 && !s.over; i++) {
        const r = T.DIRS.map(d => T.move(s, d)).find(x => x.moved); if (!r) break;
        s = r.state; T.POWERS.forEach(p => ok(s.power[p] <= T.CAP, "cap"));
      }
    }
  });
});

// ---- the ladder is spaced (a quick version of tools/sim-three.js tiers, NOPOW) ----
t("measured: on the same seeds Medium pays about 1.5x to 2.4x Hard, and Easy 1.5x to 2.5x Medium (human bot, no power-ups)", () => {
  const rate = {};
  TIERS.forEach(tr => {
    let m = 0, r = 0, rs = 12345;
    const rnd = () => { const q = T.rand(rs); rs = q[1]; return q[0]; };
    for (let sd = 0; sd < 200; sd++) {
      let s = T.newGame(1000 + sd, tr);
      while (!s.over && s.moves < 3000) {
        let best = null, bv = -1e9;
        for (const d of T.DIRS) {
          const q = T.move(s, d); if (!q.moved) continue;
          const v = 10 * q.trace.filter(x => x.merge).length + 5 * q.state.grid.filter(g => !g).length + 30 * q.flushes.length + 8 * rnd();
          if (v > bv) { bv = v; best = q; }
        }
        if (!best) break;
        r += best.flushes.filter(f => f.power).length + paid(best); s = best.state;
      }
      m += s.moves;
    }
    rate[tr] = r / m;
  });
  const mh = rate.medium / rate.hard, em = rate.easy / rate.medium;
  ok(mh > 1.5 && mh < 2.4, "Medium/Hard " + mh.toFixed(2)); ok(em > 1.5 && em < 2.5, "Easy/Medium " + em.toFixed(2));
});

// ---- the page: the family's difficulty row, the save, the copy (as Two) ----
const root = path.join(__dirname, "..");
const page = fs.readFileSync(path.join(root, "three", "index.html"), "utf8"), game = fs.readFileSync(path.join(root, "three", "game.js"), "utf8");
t("page: the family's #diff row (Easy, Medium, Hard) sits between the header and the tray, as on Two", () => {
  const row = page.indexOf('<div id="diff" class="seg" role="group" aria-label="Difficulty">');
  ok(row > page.indexOf("</header>") && row < page.indexOf('<section id="tray"'), "placement");
  ok(/data-diff="easy">Easy<\/button>\s*<button type="button" data-diff="medium">Medium<\/button>\s*<button type="button" data-diff="hard">Hard<\/button>/.test(page), "order");
});
t("save: an old save (no tier) loads as Hard, a first visit starts on Medium, the choice and a best per tier are saved", () => {
  ok(/var tier = saved && okTier\(saved\.tier\) \? saved\.tier : hadSave \? E\.tierOf\(saved\.state\) : "medium";/.test(game), "tier on load");
  ok(/tier = E\.tierOf\(state\);/.test(game), "the loaded game's own tier wins");
  ok(/store\.save\(\{ state: state, tier: tier, bestScore: bests\.hard\.score, bestUsed: bests\.hard\.used,\s*bests: \{ easy: bests\.easy, medium: bests\.medium \}/.test(game), "save fields");
  ok(/var store = K\.store\("numberics_three_v1"\);/.test(game) && !/localStorage\.setItem/.test(game), "the same key, through NumbericsKit.store");
  ok(/TIER_NAME\[E\.tierOf\(state\)\] \+ " best "/.test(game), "the card says the tier's best");
});
t("switching: a different tier starts a new game in it; mid-run it asks Sure? first (as Two)", () => {
  ok(/if \(state\.moves > 0 && !state\.over && tierArm !== t\) \{/.test(game) && /b\.textContent = "Sure\?"/.test(game), "Sure? mid-run");
  ok(/startNew\(t\); K\.toast\(TIER_NAME\[t\] \+ ": new game"\);/.test(game), "new game in the tier");
  ok(/"Tap " \+ TIER_NAME\[tierArm\] \+ " again: this ends the run\."/.test(game), "the hint line says why");
});
t("copy: the How to play text and the tray say how each tier earns; rewards read \"+1 Name\"", () => {
  const how = page.replace(/\s+/g, " ");
  ok(/On Medium, a join that makes a tile as big as your top tile, from 18 up, earns one too; on Easy, a join that makes at least half your top tile, from 9 up\. Hard pays flushes only\./.test(how), "how-to");
  ok(/hard: "Earn one with every Flush\."/.test(game) && /medium: "Earn one with every Flush, or a join as big as your top tile \(18 up\)\."/.test(game) &&
     /easy: "Earn one with every Flush, or a join half your top tile or more \(9 up\)\."/.test(game), "tray earn line");
  ok(/" \+1 " \+ NAME\[j\.power\]/.test(game) && /" \+1 " \+ NAME\[f\.power\]/.test(game) && /"Made " \+ K\.fmt\(top\)/.test(game), "+1 Name, Made N");
  [page, game, fs.readFileSync(path.join(root, "tools", "sim-three.js"), "utf8"), fs.readFileSync(__filename, "utf8")].forEach(s => {
    ok(!/\u2014/.test(s), "no em-dash"); ok(/SPDX-License-Identifier: Apache-2\.0/.test(s), "SPDX");
  });
});

console.log(pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
