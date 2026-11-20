/* SPDX-License-Identifier: Apache-2.0 | Copyright 2026 alvations (Melon Lab)
 * Four difficulty measurement: two players against each level, no power-ups, the opener alternates.
 *   careful: plays only on what the page shows (round 3). Takes its own win; blocks a blue ring it can reach; never
 *            drops in a column the page marks (red dashed ring: the drop would let the computer win); otherwise a
 *            centre-leaning random column. Same as the cold reviewer's "block every visible threat" plus the marks.
 *   safe:    the round 1 safe-move player. Takes its own win; otherwise a uniformly random column after which the
 *            computer's shown disc has no immediate win; random legal if none is safe.
 * node tools/measure-four.js [games] [easy,medium,hard] [careful,safe]   TUNE=<json> overrides level settings. */
"use strict";
const F = require("../four/engine.js");
const C = F.COLS; if (process.env.TUNE) { const t = JSON.parse(process.env.TUNE); for (const k in t) Object.assign(F._LV[k], t[k]); }
const cellOf = (s, c) => F.height(s.own, c) * C + c;
function ownWin(s) { for (const c of F.legal(s)) if (F.linesAt(s.own, s.num, cellOf(s, c), 1, s.next[0]).length) return c; return -1; }
function pick(pool, rs, weights) {
  const w = pool.map(c => (weights ? weights[c] : 1)), tot = w.reduce((a, b) => a + b, 0), r = F.rand(rs);
  let x = r[0] * tot; for (let i = 0; i < pool.length; i++) { x -= w[i]; if (x < 0) return [pool[i], r[1]]; }
  return [pool[pool.length - 1], r[1]];
}
const CENTRE = [1, 2, 3, 4, 3, 2, 1];
function careful(s, rs) {
  const L = F.legal(s), win = ownWin(s); if (win >= 0) return [win, rs];
  const marks = F.opens(s), unmarked = L.filter(c => !marks[c]);
  const ring = F.threats(s).filter(x => L.some(c => cellOf(s, c) === x)).map(x => x % C); // reachable rings
  if (ring.length) { const good = ring.filter(c => !marks[c]); return [(good.length ? good : ring)[0], rs]; }
  return pick(unmarked.length ? unmarked : L, rs, CENTRE);
}
function safe(s, rs) {
  const L = F.legal(s), n = s.next[0], win = ownWin(s); if (win >= 0) return [win, rs];
  const ok = L.filter(c => { const own = s.own.slice(), num = s.num.slice(), h = F.height(own, c); own[h * C + c] = 1; num[h * C + c] = n;
    for (let k = 0; k < C; k++) { const hk = F.height(own, k); if (hk < 6 && F.linesAt(own, num, hk * C + k, 2, s.next[1]).length) return false; } return true; });
  return pick(ok.length ? ok : L, rs);
}
const BOTS = { careful, safe };
function measure(lv, bot, G) {
  let w = 0, l = 0, d = 0, ten = 0, len = 0, rs = 12345, worst = 0;
  for (let g = 0; g < G; g++) {
    let s = F.newGame(1000 + g, { level: lv, first: g % 2 ? 2 : 1 });
    while (!s.over) { if (s.turn === 1) { let c; [c, rs] = BOTS[bot](s, rs); s = F.drop(s, c).state; }
      else { const a = Date.now(); s = F.computerTurn(s).state; worst = Math.max(worst, Date.now() - a); } }
    if (s.over.winner === 1) w++; else if (s.over.winner === 2) l++; else d++;
    if (s.over.type === "ten") ten++; len += s.moves;
  }
  return { w, l, d, rate: w / G, ten: ten / G, len: len / G, worst };
}
if (require.main === module) {
  const G = +process.argv[2] || 100, levels = (process.argv[3] || "easy,medium,hard").split(","), bots = (process.argv[4] || "careful,safe").split(",");
  for (const lv of levels) for (const b of bots) {
    const t0 = Date.now(), r = measure(lv, b, G);
    console.log(lv, b, "won", r.w, "lost", r.l, "drawn", r.d, "win%", (100 * r.rate).toFixed(0), "ten%", (100 * r.ten).toFixed(0),
      "avg discs", r.len.toFixed(1), "worst ms", r.worst, "s", ((Date.now() - t0) / 1000).toFixed(0));
  }
}
module.exports = { careful, safe, measure };
