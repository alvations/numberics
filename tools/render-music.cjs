/* SPDX-License-Identifier: Apache-2.0 | Copyright 2026 alvations (Melon Lab)
 * Renders every music style offline (OfflineAudioContext in headless Chromium, the same synth as the game) to WAV
 * files, and reports per-style loudness so the styles stay level-matched (docs/design/MUSIC.md, Levels).
 *   NODE_PATH=$(npm root -g) node tools/render-music.cjs [outDir] [--seconds N] [--styles a,b] [--raw] [--json file]
 * outDir defaults to <os tmp>/numberics-music (never the repo). --raw renders at level 1 and prints the `level` that
 * would hit the target (calibration). Checks, exit 1 on failure: integrated loudness within +-1 LU of TARGET_LUFS,
 * sample peak <= -1 dBFS, no clipping, and at default sliders the music peak sits >= 6 dB under the SFX peak. */
"use strict";
let chromium; try { ({ chromium } = require("playwright")); } catch (e) { console.log("skip: playwright not installed"); process.exit(0); }
const fs = require("fs"), path = require("path"), os = require("os");
const M = require("../shared/music.js"), X = require("./music-measure.cjs");
const args = process.argv.slice(2), flag = n => { const i = args.indexOf(n); return i >= 0 ? args.splice(i, 2)[1] : null; };
const raw = args.includes("--raw"); if (raw) args.splice(args.indexOf("--raw"), 1);
const secs = +flag("--seconds") || 0, only = flag("--styles"), jsonOut = flag("--json");
const out = args[0] || path.join(os.tmpdir(), "numberics-music");
const ids = only ? only.split(",") : M.ORDER;
fs.mkdirSync(out, { recursive: true });
const root = path.join(__dirname, "..");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent("<!doctype html><meta charset=utf-8><body></body>");
  for (const f of ["shared/settings.js", "shared/audio.js", "shared/music.js"]) await page.addScriptTag({ content: fs.readFileSync(path.join(root, f), "utf8") });
  // SFX reference peaks at the default SFX volume (0.5) through shared/audio.js's own offline render
  const sfx = await page.evaluate(async () => {
    const A = window.NumbericsAudio, r = {};
    if (!A || !A.render) return null;
    for (const [n, a] of [["merge", 4], ["merge", 9], ["best"], ["win"], ["place"], ["tick"], ["land"]]) {
      const x = await A.render(n, a, { volume: 0.5 }); if (x) r[n + (a != null ? a : "")] = x.peak;
    }
    return r;
  });
  const rows = []; let bad = 0;
  for (const id of ids) {
    const t0 = Date.now();
    const res = await page.evaluate(async ({ id, secs, raw }) => {
      const buf = await window.NumbericsMusic.render(id, { seconds: secs || undefined, raw });
      const chs = [buf.getChannelData(0), buf.getChannelData(1)];
      let pk = 0, clip = 0;
      for (const c of chs) for (let i = 0; i < c.length; i++) { const a = Math.abs(c[i]); if (a > pk) pk = a; if (a >= 1 || a !== a) clip++; }
      const b64 = c => { const u = new Uint8Array(c.buffer.slice(0)); let s = ""; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
      return { sr: buf.sampleRate, n: buf.length, pk, clip, ch: chs.map(b64) };
    }, { id, secs, raw });
    const chs = res.ch.map(s => { const b = Buffer.from(s, "base64"); return new Float32Array(b.buffer, b.byteOffset, b.length / 4); });
    const L = X.loudness(chs, res.sr), mono = new Float32Array(res.n);
    for (let i = 0; i < res.n; i++) mono[i] = (chs[0][i] + chs[1][i]) / 2;
    const cen = X.centroid(mono, res.sr), sc = X.score(id), st = M.STYLES[id];
    const file = path.join(out, id + (raw ? "-raw" : "") + ".wav"); fs.writeFileSync(file, X.wav(chs, res.sr));
    const lvl = raw ? 1 : st.level, suggest = +(lvl * Math.pow(10, (M.TARGET_LUFS - L.lufs) / 20)).toFixed(2);
    // shipped level at the default music volume
    const shipDb = 20 * Math.log10(M.DEF.musicVolume * M.SCALE);
    const row = Object.assign({}, sc, L, { centroid: cen, clipped: res.clip, file, level: lvl, suggestLevel: suggest,
      shipLufs: +(L.lufs + shipDb).toFixed(1), shipPeakDb: +(L.peakDb + shipDb).toFixed(1), renderMs: Date.now() - t0 });
    rows.push(row);
    const fails = [];
    if (!raw && Math.abs(L.lufs - M.TARGET_LUFS) > 1) fails.push("level " + L.lufs + " LUFS (target " + M.TARGET_LUFS + ")");
    if (!raw && L.peakDb > -1) fails.push("peak " + L.peakDb + " dBFS > -1");
    if (!raw && res.clip) fails.push(res.clip + " clipped samples");
    if (fails.length) { bad++; row.fail = fails; }
  }
  await browser.close();
  const sfxPeak = sfx ? Math.max(...Object.values(sfx)) : null, sfxMerge = sfx ? sfx.merge4 : null;
  const pad = (s, n) => String(s).padEnd(n);
  console.log(pad("style", 8) + pad("bpm", 5) + pad("key", 13) + pad("detected", 11) + pad("sec", 7) + pad("LUFS", 8) + pad("peak", 8) + pad("crest", 7) +
    pad("cent Hz", 9) + pad("lead/s", 8) + pad("notes/s", 9) + pad("repeat", 8) + pad("pass2", 7) + pad("ship LUFS", 11) + pad("ship pk", 9) + (raw ? "suggest level" : ""));
  rows.forEach(r => console.log(pad(r.id, 8) + pad(r.bpm, 5) + pad(r.declared, 13) + pad(r.detected, 11) + pad(r.seconds, 7) + pad(r.lufs, 8) + pad(r.peakDb, 8) +
    pad(r.crestDb, 7) + pad(r.centroid, 9) + pad(r.leadPerSec, 8) + pad(r.notesPerSec, 9) + pad(r.allRepeat, 8) + pad(r.pass2Changed, 7) +
    pad(r.shipLufs, 11) + pad(r.shipPeakDb, 9) + (raw ? r.suggestLevel : "") + (r.fail ? "  FAIL " + r.fail.join("; ") : "")));
  const spread = rows.length ? Math.max(...rows.map(r => r.lufs)) - Math.min(...rows.map(r => r.lufs)) : 0;
  console.log("level spread across styles: " + spread.toFixed(2) + " LU");
  if (sfx) {
    const sDb = 20 * Math.log10(sfxMerge), mPk = Math.max(...rows.map(r => r.shipPeakDb));
    console.log("SFX peaks at default volume (dBFS): " + Object.entries(sfx).map(([k, v]) => k + " " + (20 * Math.log10(v)).toFixed(1)).join(", "));
    console.log("loudest music peak at default sliders " + mPk + " dBFS vs merge(4) " + sDb.toFixed(1) + " dBFS: headroom " + (sDb - mPk).toFixed(1) + " dB (need >= 6)");
    console.log("SCALE that would give 6.5 dB of headroom with these SFX: " + (M.SCALE * Math.pow(10, (sDb - mPk - 6.5) / 20)).toFixed(4) + " (now " + M.SCALE + ")");
    if (!raw && sDb - mPk < 6) { bad++; console.log("FAIL music sits less than 6 dB under the SFX"); }
  }
  if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify({ target: M.TARGET_LUFS, scale: M.SCALE, defaults: M.DEF, sfx, rows: rows.map(r => Object.assign({}, r, { file: path.basename(r.file) })) }, null, 1));
  console.log("WAV files in " + out);
  process.exit(bad ? 1 : 0);
})().catch(e => { console.log(e); process.exit(1); });
