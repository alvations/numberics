/* SPDX-License-Identifier: Apache-2.0 | Copyright 2026 alvations (Melon Lab)
 * Objective measures for the music panel (docs/design/MUSIC-PANEL.md), shared by tools/render-music.cjs and
 * tests/test-music.js. Pure Node, no dependencies.
 *   score(style)          from the compiled events: tempo, declared and detected key, note density, repetition, range
 *   loudness(chs, sr)     BS.1770 K-weighted gated integrated loudness (LUFS), sample peak, RMS, crest
 *   centroid(mono, sr)    mean spectral centroid in Hz over non-silent 2048-sample frames
 *   wav(chs, sr)          16-bit PCM WAV bytes */
"use strict";
const M = require("../shared/music.js");
const NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
// Krumhansl-Kessler key profiles
const MAJ = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MIN = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
const PITCHED = new Set(["lead", "lead2", "bass", "arp", "pad"]);

function corr(a, b) {
  const ma = a.reduce((x, y) => x + y) / 12, mb = b.reduce((x, y) => x + y) / 12;
  let n = 0, da = 0, db = 0;
  for (let i = 0; i < 12; i++) { n += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2; }
  return n / Math.sqrt(da * db || 1);
}
function detectKey(events) {
  const h = new Array(12).fill(0);
  events.forEach(e => { if (PITCHED.has(e.v)) h[((e.m % 12) + 12) % 12] += (e.e - e.s) * (e.v === "pad" ? 0.5 : 1); });
  let best = null;
  for (let k = 0; k < 12; k++) for (const [mode, prof] of [["major", MAJ], ["minor", MIN]]) {
    const r = corr(h, prof.map((_, i) => prof[(i - k + 12) % 12]));
    if (!best || r > best.r) best = { tonic: k, mode, r };
  }
  return { name: NAMES[best.tonic] + " " + best.mode, tonic: best.tonic, mode: best.mode, r: +best.r.toFixed(3) };
}
// a bar's content as a string relative to the bar start, per voice group
function barKeys(st, comp, voices) {
  const B = st.beats * M.TPB, keys = new Array(comp.bars).fill("");
  comp.events.forEach(e => { if (voices.has(e.v)) keys[Math.floor(e.t / B)] += e.v[0] + (e.t % B) + ":" + e.m + ":" + e.d + ";"; });
  return keys;
}
function repetition(keys) {
  const seen = new Set(); let rep = 0, nonEmpty = 0;
  keys.forEach(k => { if (!k) return; nonEmpty++; if (seen.has(k)) rep++; seen.add(k); });
  return { score: nonEmpty ? rep / nonEmpty : 0, unique: seen.size, bars: nonEmpty };
}
function score(id) {
  const st = M.STYLES[id], c0 = M.compile(st, 0), c1 = M.compile(st, 1);
  const lead = c0.events.filter(e => e.v === "lead"), pitched = c0.events.filter(e => PITCHED.has(e.v));
  const drums = c0.events.filter(e => !PITCHED.has(e.v) && e.v !== "pump");
  const declared = NAMES[st.root % 12] + " " + st.mode;
  const lk = repetition(barKeys(st, c0, new Set(["lead"])));
  const all = repetition(barKeys(st, c0, new Set(["lead", "lead2", "bass", "arp", "k", "s", "h", "o", "t"])));
  // how different the second pass is from the first (share of bars that change)
  const k0 = barKeys(st, c0, new Set(["lead", "lead2", "arp", "k", "s", "h"])), k1 = barKeys(st, c1, new Set(["lead", "lead2", "arp", "k", "s", "h"]));
  const changed = k0.filter((k, i) => k !== k1[i]).length / k0.length;
  const ms = lead.map(e => e.m);
  return {
    id, name: st.name, bpm: st.bpm, swing: st.swing, seconds: +c0.seconds.toFixed(1), bars: c0.bars, form: st.form.join(" "),
    declared, detected: detectKey(c0.events).name, keyR: detectKey(c0.events).r,
    leadPerSec: +(lead.length / c0.seconds).toFixed(2), notesPerSec: +(pitched.length / c0.seconds).toFixed(2),
    drumsPerSec: +(drums.length / c0.seconds).toFixed(2), leadRange: ms.length ? [Math.min(...ms), Math.max(...ms)] : null,
    leadRepeat: +lk.score.toFixed(2), allRepeat: +all.score.toFixed(2), uniqueBars: all.unique, pass2Changed: +changed.toFixed(2),
  };
}

// ---- audio measures ----
function biquad(x, b0, b1, b2, a0, a1, a2) {
  const y = new Float64Array(x.length); b0 /= a0; b1 /= a0; b2 /= a0; a1 /= a0; a2 /= a0;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) { const v = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v; }
  return y;
}
function kweight(x, sr) {
  let G = 3.99984385397, Q = 0.7071752369554193, fc = 1681.9744509555319;
  let A = Math.pow(10, G / 40), w0 = 2 * Math.PI * fc / sr, al = Math.sin(w0) / (2 * Q), cs = Math.cos(w0), sA = Math.sqrt(A);
  const y = biquad(x, A * ((A + 1) + (A - 1) * cs + 2 * sA * al), -2 * A * ((A - 1) + (A + 1) * cs), A * ((A + 1) + (A - 1) * cs - 2 * sA * al),
    (A + 1) - (A - 1) * cs + 2 * sA * al, 2 * ((A - 1) - (A + 1) * cs), (A + 1) - (A - 1) * cs - 2 * sA * al);
  Q = 0.5003270373253953; fc = 38.13547087613982; w0 = 2 * Math.PI * fc / sr; al = Math.sin(w0) / (2 * Q); cs = Math.cos(w0);
  return biquad(y, (1 + cs) / 2, -(1 + cs), (1 + cs) / 2, 1 + al, -2 * cs, 1 - al);
}
const db = v => v > 0 ? 20 * Math.log10(v) : -Infinity;
function loudness(chs, sr) {
  const kw = chs.map(c => kweight(c, sr)), n = chs[0].length, blk = Math.round(0.4 * sr), hop = Math.round(0.1 * sr), z = [];
  for (let s = 0; s + blk <= n; s += hop) {
    let sum = 0;
    for (const c of kw) { let a = 0; for (let i = s; i < s + blk; i++) a += c[i] * c[i]; sum += a / blk; }
    z.push(sum);
  }
  const L = v => -0.691 + 10 * Math.log10(v);
  const g1 = z.filter(v => L(v) > -70), m1 = g1.reduce((a, b) => a + b, 0) / (g1.length || 1);
  const g2 = g1.filter(v => L(v) > L(m1) - 10), lufs = g2.length ? L(g2.reduce((a, b) => a + b, 0) / g2.length) : -Infinity;
  let pk = 0, sq = 0;
  for (const c of chs) for (let i = 0; i < n; i++) { const a = Math.abs(c[i]); if (a > pk) pk = a; sq += c[i] * c[i]; }
  const rms = Math.sqrt(sq / (n * chs.length));
  // short-term (3 s) max, for "does any passage jump out"
  let stMax = -Infinity; const per = Math.round(3 / 0.1);
  for (let i = 0; i + per <= z.length; i += 5) { const m = z.slice(i, i + per).reduce((a, b) => a + b, 0) / per; stMax = Math.max(stMax, L(m)); }
  return { lufs: +lufs.toFixed(2), peakDb: +db(pk).toFixed(2), rmsDb: +db(rms).toFixed(2), crestDb: +(db(pk) - db(rms)).toFixed(2), shortMax: +stMax.toFixed(2) };
}
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) { let b = n >> 1; for (; j & b; b >>= 1) j ^= b; j ^= b; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
  for (let len = 2; len <= n; len <<= 1) {
    const a = -2 * Math.PI / len, wr = Math.cos(a), wi = Math.sin(a);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let j = 0; j < len / 2; j++) {
        const ur = re[i + j], ui = im[i + j], vr = re[i + j + len / 2] * cr - im[i + j + len / 2] * ci, vi = re[i + j + len / 2] * ci + im[i + j + len / 2] * cr;
        re[i + j] = ur + vr; im[i + j] = ui + vi; re[i + j + len / 2] = ur - vr; im[i + j + len / 2] = ui - vi;
        const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
      }
    }
  }
}
function centroid(mono, sr) {
  const N = 2048; let num = 0, den = 0;
  for (let s = 0; s + N <= mono.length; s += N * 4) {
    const re = new Float64Array(N), im = new Float64Array(N); let e = 0;
    for (let i = 0; i < N; i++) { const w = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (N - 1)); re[i] = mono[s + i] * w; e += mono[s + i] ** 2; }
    if (e / N < 1e-8) continue;
    fft(re, im); let fn = 0, fd = 0;
    for (let k = 1; k < N / 2; k++) { const m = Math.hypot(re[k], im[k]); fn += m * k * sr / N; fd += m; }
    if (fd > 0) { num += fn / fd; den++; }
  }
  return den ? Math.round(num / den) : 0;
}
function wav(chs, sr) {
  const n = chs[0].length, nc = chs.length, buf = Buffer.alloc(44 + n * nc * 2);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + n * nc * 2, 4); buf.write("WAVE", 8); buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(nc, 22); buf.writeUInt32LE(sr, 24);
  buf.writeUInt32LE(sr * nc * 2, 28); buf.writeUInt16LE(nc * 2, 32); buf.writeUInt16LE(16, 34); buf.write("data", 36); buf.writeUInt32LE(n * nc * 2, 40);
  let o = 44;
  for (let i = 0; i < n; i++) for (let c = 0; c < nc; c++) { const v = Math.max(-1, Math.min(1, chs[c][i])); buf.writeInt16LE(Math.round(v * 32767), o); o += 2; }
  return buf;
}
module.exports = { score, detectKey, repetition, loudness, centroid, wav, kweight, NAMES };
