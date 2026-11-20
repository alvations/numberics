/* SPDX-License-Identifier: Apache-2.0 | Copyright 2026 alvations (Melon Lab)
 * Four difficulty measurement (safe-move bot vs each level).
 * node tools/measure-four.js [games] [easy,medium,hard]   TUNE=<json> overrides level settings. */
const F = require("../four/engine.js");
const C = F.COLS; if (process.env.TUNE) { const t = JSON.parse(process.env.TUNE); for (const k in t) Object.assign(F._LV[k], t[k]); }
// safe-move player: wins now if it can; else picks a column (seeded random, centre-weighted) after which the
// computer's shown disc has no immediate win; random legal if none is safe. No power-ups.
function winsAt(s, own, num, side, n) { for (const c of F.legal(s)) { const h = F.height(own, c); if (h < 6 && F.linesAt(own, num, h * C + c, side, n).length) return c; } return -1; }
function safeBot(s, rs) {
  const L = F.legal(s), n = s.next[0];
  for (const c of L) { const h = F.height(s.own, c); if (F.linesAt(s.own, s.num, h * C + c, 1, n).length) return [c, rs]; }
  const safe = L.filter(c => { const own = s.own.slice(), num = s.num.slice(), h = F.height(own, c); own[h * C + c] = 1; num[h * C + c] = n;
    for (let k = 0; k < C; k++) { const hk = F.height(own, k); if (hk < 6 && F.linesAt(own, num, hk * C + k, 2, s.next[1]).length) return false; } return true; });
  const pool = safe.length ? safe : L;
  const r = F.rand(rs); return [pool[Math.floor(r[0] * pool.length)], r[1]];
}
const G = +process.argv[2] || 100, levels = (process.argv[3] || "easy,medium,hard").split(",");
for (const lv of levels) {
  let w = 0, l = 0, d = 0, ten = 0, len = 0, rs = 12345, worst = 0, t0 = Date.now();
  for (let g = 0; g < G; g++) {
    let s = F.newGame(1000 + g, { level: lv, first: g % 2 ? 2 : 1 });
    while (!s.over) { if (s.turn === 1) { let c; [c, rs] = safeBot(s, rs); s = F.drop(s, c).state; }
      else { const a = Date.now(); s = F.computerTurn(s).state; worst = Math.max(worst, Date.now() - a); } }
    if (s.over.winner === 1) w++; else if (s.over.winner === 2) l++; else d++;
    if (s.over.type === "ten") ten++; len += s.moves;
  }
  console.log(lv, "bot won", w, "lost", l, "drawn", d, "win%", (100 * w / G).toFixed(0), "ten%", (100 * ten / G).toFixed(0), "avg discs", (len / G).toFixed(1), "worst ms", worst, "total s", ((Date.now() - t0) / 1000).toFixed(0));
}
