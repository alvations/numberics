/* SPDX-License-Identifier: Apache-2.0 | Copyright 2026 alvations (Melon Lab)
 * NumbericsMusic (docs/design/MUSIC.md): procedural background music on Web Audio. No files, no network.
 *
 * A small sequencer: each style is DATA (tempo, key, mode, sections of chords, a written lead line, bass, arp, pad
 * and drum patterns, and a form that orders the sections). compile() turns a style into one flat, sorted list of
 * timed events for one pass of its form (60 to 120 s); odd passes swap in each section's `alt` so a loop never
 * repeats exactly. A lookahead scheduler (a 50 ms timer that books every event due in the next 0.35 s on the audio
 * clock) plays it, so there is no per-frame work and the main thread stays free. Every note and every melody is
 * original to this file.
 *
 * Graph: note -> style bus (level-match gain, fades) -> mix (musicVolume * SCALE, 0 when Music is off) -> duck ->
 * destination. The style bus also feeds a shared reverb (convolver, seeded impulse) and an optional feedback echo.
 * The music has its own AudioContext, created and resumed only inside a user gesture (as shared/audio.js does). If
 * NumbericsAudio ever exposes `musicBus()` -> { context, input } the music plugs into that instead (MUSIC.md, Merge).
 * Pauses while the tab is hidden; duck(true) lowers it under an end card. Settings: `music`, `musicVolume`,
 * `musicStyle` from NumbericsSettings (missing fields keep the defaults below) and the `numberics:settings` event.
 * Also require()-able (Node tests): module.exports = { STYLES, GAMES, MODES, TPB, compile, tickTime, ... }. */
(function (root) {
  "use strict";
  var TPB = 12; // ticks per beat: 16ths (3), eighths (6), eighth triplets (4) all land on whole ticks
  var MODES = {
    major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], harmonic: [0, 2, 3, 5, 7, 8, 11],
    dorian: [0, 2, 3, 5, 7, 9, 10], mixolydian: [0, 2, 4, 5, 7, 9, 10], lydian: [0, 2, 4, 6, 7, 9, 11],
  };
  // Levels (MUSIC.md, Levels). Every style is matched by its `level` to TARGET_LUFS at unity (mix = 1), measured by
  // tools/render-music.cjs. Shipped level = unity * musicVolume * SCALE, which keeps the music peak at least 6 dB
  // under the SFX peak at default sliders (the render report checks it).
  var TARGET_LUFS = -20, SCALE = 0.016;
  var DEF = { music: true, musicVolume: 0.5, musicStyle: "auto" };
  var FADE_IN = 2.5, XFADE = 2.0, STOP_FADE = 0.8, DUCK = 0.35, LOOKAHEAD = 0.35, TICK_MS = 50;

  // ---------------------------------------------------------------------------------------------------------------
  // The styles. Notation (MUSIC.md, Notation): a bar is space-separated tokens that split it evenly; "|" ends a bar.
  // Lead: scale degree 1-7, prefix # or b, suffix ' (octave up) or , (octave down); "." holds; "-" rests.
  // Chords (one per bar, "4/5" splits a bar): degree, then M m d to force a quality, then 7 for a seventh.
  // Bass: R root, 3 third, 5 fifth, 8 octave, 7 seventh. Arp: chord-tone index 0-6, or c for the whole chord.
  // Drums: 16 steps a bar: x hit, X accent, g ghost. k kick, s snare, h hat, o open hat, t tom, c cymbal.
  // ---------------------------------------------------------------------------------------------------------------
  var STYLES = {
    chill: {
      name: "Chill", blurb: "Slow warm keys and a lazy beat.",
      bpm: 84, swing: 0.2, beats: 4, root: 65, mode: "major", level: 0.39, verb: 0.24,
      echo: { beats: 0.75, fb: 0.3, mix: 0.22 },
      voices: {
        lead: { wave: "triangle", gain: 0.3, a: 0.006, d: 0.6, s: 0.22, r: 0.35, echo: 1, partial: 2, pg: 0.18 },
        lead2: { wave: "sine", gain: 0.12, a: 0.01, d: 0.5, s: 0.3, r: 0.3 },
        bass: { wave: "sine", gain: 0.4, a: 0.01, d: 0.35, s: 0.55, r: 0.12, oct: -2 },
        pad: { wave: "triangle", gain: 0.045, a: 0.7, d: 1, s: 0.8, r: 0.9, oct: -1, lp: 1500 },
        arp: { wave: "triangle", gain: 0.07, a: 0.004, d: 0.3, s: 0, r: 0.12 },
      },
      kit: { k: 0.42, s: 0.12, h: 0.035, snare: "rim" },
      drums: {
        main: { k: "x......x..x.....", s: "....x.......x...", h: "x.g.x.g.x.g.x.g." },
        fill: { k: "x......x..x.....", s: "....x.......x.xg", h: "x.g.x.g.x.g....." },
        hats: { h: "x.g.x.g.x.g.x.g." },
      },
      sections: {
        I: { bars: 4, chords: "17 67 27 57", pad: 1, bass: "R . . . - - - -", arp: "- 0 - 2 - 3 - 2" },
        A: { bars: 8, chords: "17 67 27 57", pad: 1, bass: "R . . 5 - 8 5 .", arp: "- - 2 - - 3 - -", drums: "main", fill: "fill",
          lead: "- 3 5 6 5 . 3 . | - 1' 7 6 5 . . - | - 4 6 1' 7 6 4 . | 5 . . . - - 2 3 | - 3 5 6 1' . 6 5 | 6 . 5 3 . . 1 2 | 4 . 3 2 . 1 2 . | 1 . . . - - - -",
          alt: { arp: "- 1 - 2 - 3 - 4" } },
        B: { bars: 8, chords: "47 37 67 17 47 37 27 5", pad: 1, bass: "R . . 5 - 8 5 .", arp: "- - 2 - - 3 - -", drums: "main", fill: "fill",
          lead: "1' . . 7 6 . 5 . | 7 . 5 . 3 . . - | - 1' 2' 1' 7 6 5 . | 3 . . . - - - - | 1' . . 7 6 . 5 6 | 7 . 1' . 2' . 3' . | 2' . 1' 6 . 4 . 5 | 5 . . . - - - -",
          alt: { harm: 1 } },
        C: { bars: 4, chords: "47 37 27 5", pad: 1, bass: "R . . . . . . .", arp: "0 2 3 4 3 2 1 2", drums: "hats" },
        A2: { bars: 8, chords: "17 67 27 57", pad: 1, bass: "R . . 5 - 8 5 .", arp: "- - 2 - - 3 - -", drums: "main", fill: "fill", harm: 1,
          lead: "- 3 5 6 5 3 2 3 | - 1' 7 6 5 . 3 5 | 6 . 4 6 1' . 2' 1' | 7 . . . - - 5 6 | 1' . 6 5 3 . 5 6 | 1' . 2' 1' 6 . 5 . | 4 . 6 5 . 3 2 . | 1 . . . - - - -",
          alt: { harm: 0, arp: "- 1 - 2 - 3 - 4" } },
      },
      form: ["I", "A", "B", "C", "A2", "B"],
    },

    epic: {
      name: "Epic", blurb: "Big drums, brass and a long climb.",
      bpm: 88, swing: 0, beats: 4, root: 62, mode: "minor", level: 0.39, verb: 0.34,
      voices: {
        lead: { wave: "sawtooth", gain: 0.13, a: 0.04, d: 0.4, s: 0.75, r: 0.25, lp: 2200 },
        lead2: { wave: "sawtooth", gain: 0.08, a: 0.12, d: 0.5, s: 0.8, r: 0.4, lp: 1300 },
        bass: { wave: "triangle", gain: 0.45, a: 0.01, d: 0.4, s: 0.7, r: 0.15, oct: -2 },
        pad: { wave: "supersaw", gain: 0.04, a: 0.9, d: 1, s: 0.85, r: 1.0, oct: -1, lp: 950 },
      },
      kit: { k: 0.6, s: 0.22, h: 0.03, t: 0.55, c: 0.06 },
      drums: {
        main: { k: "x.......x.......", t: "x.....x.x.......", s: "....x.......x..." },
        low: { k: "x...............", t: "x.....x.x......." },
        fill: { k: "x.......", t: "x.x.x.x.xxxxxxxx", s: "............xxxx" },
        roll: { t: "x...x...x.x.xxxx", s: "........gggggxxx" },
      },
      sections: {
        I: { bars: 4, chords: "1 6 3 7", pad: 1, bass: "R . . . . . . .", drums: "low", fill: "roll" },
        A: { bars: 8, chords: "1 6 3 7", pad: 1, bass: "R . . R 5 . R .", drums: "main", fill: "fill", crash: 1,
          lead: "5 . . . 4 3 4 5 | 6 . . . 5 . 4 . | 3 . 5 . 1' . . . | 7 . . 6 7 . . . | 5 . . . 4 3 4 5 | 6 . . . 1' . 6 . | 5 . 3 . 1 . 3 . | 2 . . . . . - -" },
        B: { bars: 8, chords: "4 6 1 5M 4 6 3 5M", pad: 1, bass: "R . R . 5 . R .", drums: "main", fill: "fill", crash: 1,
          lead: "4 . . 5 6 . 4 . | 1' . . . 7 . 6 . | 5 . . 6 5 . 3 . | #7 . . . 5 . . . | 4 . . 5 6 . 1' . | 3' . . . 2' . 1' . | 1' . 7 . 6 . 5 . | 5 . . . . . #7 .",
          alt: { harm: 1 } },
        C: { bars: 8, chords: "6 7 1 1 6 7 5M 5M", pad: 1, bass: "R . . . . . . .", drums: "low", fill: "roll",
          lead: "3 . . . | 4 . 2 . | 5 . . . | - - - - | 1' . . . | 2' . 7 . | #7 . . . | - - 4 5",
          lead2: "1 . . . | 2 . . . | 3 . . . | 3 . . . | 6, . . . | 7, . . . | #7, . . . | #7, . . ." },
        A2: { bars: 8, chords: "1 6 3 7", pad: 1, bass: "R . . R 5 . R .", drums: "main", fill: "fill", crash: 1,
          lead2: "3 . . . | 1 . . . | 3 . . . | 2 . . . | 3 . . . | 4 . . . | 5 . 3 . | 2 . . .",
          lead: "5 . . . 4 3 4 5 | 6 . . . 5 . 4 . | 3 . 5 . 1' . . . | 7 . . 6 7 . . . | 5 . . . 4 3 4 5 | 6 . . . 1' . 6 . | 5 . 3 . 1 . 3 . | 1 . . . . . - -",
          alt: { lead2: "5 . . . | 6 . . . | 5 . . . | 4 . . . | 5 . . . | 6 . . . | 7 . 5 . | 4 . . ." } },
      },
      form: ["I", "A", "B", "C", "A2"],
    },

    pulse: {
      name: "Pulse", blurb: "Four on the floor, a pumping pad and a bright hook.",
      bpm: 124, swing: 0, beats: 4, root: 69, mode: "minor", level: 0.67, verb: 0.16, pump: 0.65,
      echo: { beats: 0.75, fb: 0.32, mix: 0.2 },
      voices: {
        lead: { wave: "supersaw", gain: 0.085, a: 0.005, d: 0.2, s: 0.6, r: 0.12, lp: 3200, echo: 1 },
        lead2: { wave: "square", gain: 0.05, a: 0.2, d: 0.5, s: 0.8, r: 0.6, lp: 1600, echo: 1 },
        bass: { wave: "square", gain: 0.24, a: 0.003, d: 0.15, s: 0.5, r: 0.05, oct: -2, lp: 520 },
        pad: { wave: "supersaw", gain: 0.04, a: 0.3, d: 0.6, s: 0.85, r: 0.5, oct: -1, lp: 1700 },
        arp: { wave: "square", gain: 0.035, a: 0.002, d: 0.09, s: 0, r: 0.03, lp: 2600, echo: 1, oct: -1 },
      },
      kit: { k: 0.8, s: 0.26, h: 0.035, o: 0.05, c: 0.06, snare: "clap" },
      drums: {
        intro: { k: "x...x...x...x...", o: "..x...x...x...x." },
        build: { k: "x...x...x...x...", s: "....x.......x...", h: "xgxgxgxgxgxgxgxg" },
        roll: { s: "x.x.x.x.xxxxxxxx", h: "xxxxxxxxxxxxxxxx" },
        drop: { k: "x...x...x...x...", s: "....x.......x...", o: "..x...x...x...x.", h: "g.g.g.g.g.g.g.g." },
        dfill: { k: "x...x...x...x...", s: "....x.......x.xx", o: "..x...x...x....." },
      },
      sections: {
        I: { bars: 8, chords: "4 6 1 7", pad: 1, drums: "intro" },
        U: { bars: 8, chords: "4 6 1 7", pad: 1, bass: "R - - - R - - -", arp: "0 1 2 4 2 1 0 1 2 4 5 4 2 1 0 2", drums: "build", fill: "roll" },
        D: { bars: 16, chords: "4 6 1 7", pad: 1, bass: "- R - R - 8 - R", arp: "0 1 2 4 2 1 0 1 2 4 5 4 2 1 0 2", drums: "drop", fill: "dfill", crash: 1,
          lead: "6 - 6 1' - 6 5 4 | 5 - 5 3 - 5 6 7 | 1' - 7 5 - 3 5 . | 7 . . 5 . . 2 . | 6 - 6 1' - 6 5 4 | 5 - 5 3 - 5 6 7 | 1' - 2' 3' - 2' 1' 7 | 5 . . . 7 . 2' ." },
        K: { bars: 8, chords: "4 6 1 7", pad: 1, arp: "0 - - - 2 - - - 4 - - - 2 - - -", fill: "roll",
          lead2: "1' . . . | 1' . . . | 3' . . . | 2' . 7 ." },
        D2: { bars: 16, chords: "4 6 1 7", pad: 1, bass: "- R - R - 8 - R", arp: "0 1 2 4 2 1 0 1 2 4 5 4 2 1 0 2", drums: "drop", fill: "dfill", crash: 1,
          lead: "6 - 6 1' - 6 5 4 | 5 - 5 3 - 5 6 7 | 1' - 7 5 - 3 5 . | 7 . . 5 . . 2 . | 4' - 3' 2' - 1' 2' 3' | 1' - 7 1' - 5 6 7 | 1' - 2' 3' - 5' 3' 2' | 1' . . . 7 . 5 .",
          alt: { harm: 1 } },
      },
      form: ["I", "U", "D", "K", "D2"],
    },

    blocks: {
      name: "Blocks", blurb: "A quick folk dance on an old handheld chip.",
      bpm: 150, swing: 0, beats: 4, root: 67, mode: "harmonic", level: 0.55, verb: 0.08,
      voices: {
        lead: { wave: "square", gain: 0.085, a: 0.002, d: 0.12, s: 0.55, r: 0.04 },
        lead2: { wave: "pulse25", gain: 0.05, a: 0.002, d: 0.12, s: 0.5, r: 0.04 },
        bass: { wave: "triangle", gain: 0.48, a: 0.002, d: 0.1, s: 0.6, r: 0.03, oct: -2 },
        arp: { wave: "pulse25", gain: 0.03, a: 0.002, d: 0.06, s: 0, r: 0.02, oct: -1 },
      },
      kit: { k: 0.5, s: 0.16, h: 0.035, chip: 1 },
      drums: {
        main: { k: "x.......x.......", s: "....x.......x...", h: "..x...x...x...x." },
        fill: { k: "x.......x.......", s: "....x...x.x.xxxx" },
        brk: { k: "x.......x.x.....", s: "....x.......x...", h: "x.x.x.x.x.x.x.x." },
      },
      sections: {
        A: { bars: 8, chords: "1 4 5 1", bass: "R - 5 - R - 5 -", arp: "- c - c - c - c", drums: "main", fill: "fill",
          lead: "5 - 5 6 5 4 3 4 | 6 - 6 1' 6 5 4 5 | 4 3 2 7, 2 - 5, - | 3 2 1 - 5, - 1 - | 5 - 5 6 5 4 3 4 | 6 - 6 1' 6 5 4 5 | 7 1' 2' 1' 7 6 5 4 | 5 . 4 3 1 - - -" },
        A2: { bars: 8, chords: "1 4 5 1", bass: "R - 5 - R - 5 -", arp: "- c - c - c - c", drums: "main", fill: "fill", harm: 1,
          lead: "5 6 5 6 5 4 3 4 | 6 5 6 1' 6 5 4 5 | 4 3 2 7, 2 4 5 7 | 1' . 5 . 3 . 1 . | 5 6 5 6 5 4 3 4 | 6 5 6 1' 2' 1' 6 5 | 7 1' 2' 3' 2' 1' 7 6 | 1' . 5 . 1 - - -" },
        B: { bars: 8, chords: "6 4 5 1 6 4 5 5", bass: "R - 5 - R - 5 -", arp: "- c - c - c - c", drums: "main", fill: "fill",
          lead: "3' . 2' 1' 6 . 1' . | 1' . 7 6 4 . 6 . | 7 . 5 . 2' . 7 . | 1' 7 1' 2' 3' . . - | 3' . 2' 1' 6 . 1' . | 4' . 3' 2' 1' . 6 . | 5 6 7 1' 2' . 7 . | 5 . . . . - - -",
          alt: { harm: 1 } },
        C: { bars: 4, chords: "1 1 5 5", bass: "R - R - 5 - 5 -", drums: "brk", fill: "fill" },
        A3: { bars: 8, chords: "1 4 5 1", bass: "R - 5 - R - 5 -", arp: "- c - c - c - c", drums: "brk", fill: "fill", harm: 1,
          lead: "5 - 5 6 5 4 3 4 | 6 - 6 1' 6 5 4 5 | 4 3 2 7, 2 - 5, - | 3 2 1 - 5, - 1 - | 5 - 5 6 5 4 3 4 | 6 - 6 1' 6 5 4 5 | 7 1' 2' 1' 7 6 5 4 | 5 . 4 3 1 - - -",
          alt: { harm: 0, drums: "main" } },
      },
      form: ["A", "A2", "B", "A", "C", "B", "A3"],
    },

    pocket: {
      name: "Pocket", blurb: "A bright little town tune on a pocket console.",
      bpm: 116, swing: 0.1, beats: 4, root: 74, mode: "major", level: 0.55, verb: 0.1,
      echo: { beats: 0.5, fb: 0.22, mix: 0.14 },
      voices: {
        lead: { wave: "pulse25", gain: 0.075, a: 0.003, d: 0.15, s: 0.6, r: 0.05, echo: 1 },
        lead2: { wave: "pulse12", gain: 0.045, a: 0.003, d: 0.15, s: 0.55, r: 0.05 },
        bass: { wave: "triangle", gain: 0.46, a: 0.003, d: 0.12, s: 0.6, r: 0.04, oct: -2 },
        arp: { wave: "triangle", gain: 0.08, a: 0.003, d: 0.12, s: 0, r: 0.04, oct: -1 },
      },
      kit: { k: 0.38, s: 0.11, h: 0.03, chip: 1 },
      drums: {
        main: { k: "x.......x.......", s: "....x.......x...", h: "x.x.x.x.x.x.x.x." },
        fill: { k: "x.......x.......", s: "....x.....x.x.xx", h: "x.x.x.x.x.x....." },
        soft: { h: "x...x...x...x..." },
      },
      sections: {
        A: { bars: 8, chords: "1 4 5 1 6 2 5 1", bass: "R - 5 - 8 - 5 -", arp: "- 0 - 1 - 2 - 1", drums: "main", fill: "fill",
          lead: "1 . 3 5 . 3 6 5 | 4 . 6 1' . 6 5 4 | 5 . 2 5 7 . 6 5 | 3 . 1 . 5, . - - | 6 . 1' 6 5 . 3 . | 2 . 4 2 1 . 7, . | 5 . 4 3 2 . 3 4 | 1 . . . - - - -",
          alt: { harm: 1 } },
        B: { bars: 8, chords: "4 4 1 1 2M7 2M7 5 5", bass: "R - 3 - 5 - 3 -", arp: "- 0 - 1 - 2 - 1", drums: "main", fill: "fill",
          lead: "1' . 2' 1' 7 . 6 . | 1' . 6 . 4 . 6 . | 7 . 6 5 3 . 5 . | 6 . . . - - 5 6 | #4 . 6 2' . 6 #4 . | 5 . #4 . 6 . 2' . | 1' . 7 . 6 . 5 . | 2' . . . 7 . 5 ." },
        A2: { bars: 8, chords: "1 4 5 1 6 2 5 1", bass: "R - 5 - 8 - 5 -", arp: "- 0 - 1 - 2 - 1", drums: "main", fill: "fill", harm: 1,
          lead: "1 3 5 1' . 6 5 3 | 4 6 1' 2' . 1' 6 4 | 5 . 2 5 7 6 5 4 | 3 . 1 . 5, . 1 2 | 3 . 1' 6 5 . 3 . | 2 . 4 2 1 . 7, . | 5 4 3 4 2 . 3 4 | 1 . . . - - 5, -",
          alt: { harm: 0 } },
        C: { bars: 4, chords: "4 1 2 5", bass: "R . . . . . . .", arp: "0 1 2 3 4 3 2 1", drums: "soft" },
      },
      form: ["A", "B", "A2", "C", "B", "A"],
    },

    quest: {
      name: "Quest", blurb: "A march over open country, bound for somewhere far.",
      bpm: 132, swing: 0, beats: 4, root: 70, mode: "major", level: 0.4, verb: 0.14,
      voices: {
        lead: { wave: "square", gain: 0.075, a: 0.004, d: 0.2, s: 0.7, r: 0.06 },
        lead2: { wave: "pulse25", gain: 0.045, a: 0.004, d: 0.2, s: 0.65, r: 0.06 },
        bass: { wave: "triangle", gain: 0.46, a: 0.003, d: 0.15, s: 0.65, r: 0.05, oct: -2 },
        pad: { wave: "triangle", gain: 0.04, a: 0.4, d: 0.8, s: 0.8, r: 0.6, oct: -1, lp: 2000 },
      },
      kit: { k: 0.5, s: 0.2, h: 0.03, t: 0.35, c: 0.06 },
      drums: {
        march: { k: "x.......x.......", s: "....x..g....x.gg" },
        intro: { k: "x.......x.......", s: "x..x..x.x.x.x..x" },
        fill: { k: "x.......x.......", s: "x.xxx.xxx.xxxxxx", t: "............x.x." },
        half: { k: "x...............", s: "........x......." },
      },
      sections: {
        I: { bars: 4, chords: "1 b7 4 1", pad: 1, bass: "R . R . R . 5 .", drums: "intro", fill: "fill" },
        A: { bars: 8, chords: "1 b7 4 1 1 b7 4 5", pad: 1, bass: "R . 5 . 8 . 5 .", drums: "march", fill: "fill", crash: 1,
          lead: "3 . . 2 3 . 5 . | 4 . . 2 4 . b7 . | 6 . 5 4 5 . 1' . | 1' . . . - - 5 6 | 2' . . 1' 2' . 3' . | 1' . . b7 1' . 2' . | 4' . 3' 2' 1' . 6 . | 5 . . . . . - -" },
        B: { bars: 8, chords: "6 4 1 5 6 4 2 5", pad: 1, bass: "R . 5 . 8 . 5 .", drums: "march", fill: "fill", crash: 1,
          lead: "6 . . 5 6 . 1' . | 5 . . 4 3 . 1 . | 3 . 4 . 5 . 1' . | 2' . . . 1' . 7 . | 6 . . 5 6 . 2' . | 1' . . 7 6 . 5 . | 4 . 5 . 6 . 2' . | 1' . . . 7 . . .",
          alt: { harm: 1 } },
        A2: { bars: 8, chords: "1 b7 4 1 1 b7 4 5", pad: 1, bass: "R . 5 . 8 . 5 .", drums: "march", fill: "fill", crash: 1, harm: 1,
          lead: "3 . . 2 3 . 5 . | 4 . . 2 4 . b7 . | 6 . 5 4 5 . 1' . | 1' . . . - - 5 6 | 2' . . 1' 2' . 3' . | 1' . . b7 1' . 2' . | 4' . 3' 2' 1' . 6 . | 5 . . . . . - -" },
        C: { bars: 8, chords: "6 3 4 1 6 3 2 5", pad: 1, bass: "R . . . 5 . . .", drums: "half", fill: "fill",
          lead: "1' . 6 . | 5 . 3 . | 4 . 5 . | 3 . . . | 1' . 2' . | 3' . 2' . | 6 . 1' . | 2' . . ." },
      },
      form: ["I", "A", "B", "A2", "C", "B"],
    },

    drift: {
      name: "Drift", blurb: "Soft bells and a slow pad, no drums.",
      bpm: 66, swing: 0, beats: 4, root: 69, mode: "lydian", level: 0.49, verb: 0.42,
      echo: { beats: 1, fb: 0.38, mix: 0.28 },
      voices: {
        lead: { wave: "sine", gain: 0.15, a: 0.004, d: 1.6, s: 0, r: 1.0, partial: 3, pg: 0.12, echo: 1 },
        lead2: { wave: "sine", gain: 0.07, a: 0.004, d: 1.4, s: 0, r: 0.9, partial: 2, pg: 0.1 },
        bass: { wave: "sine", gain: 0.3, a: 0.4, d: 1, s: 0.7, r: 1.2, oct: -2 },
        pad: { wave: "triangle", gain: 0.06, a: 1.5, d: 1.5, s: 0.85, r: 1.5, oct: -1, lp: 1100 },
        arp: { wave: "triangle", gain: 0.045, a: 0.01, d: 0.8, s: 0, r: 0.5, echo: 1 },
      },
      kit: {},
      drums: {},
      sections: {
        A: { bars: 8, chords: "17 2 67 2 17 2 57 2", pad: 1, bass: "R . . . . . . .", arp: "0 - 2 - 4 - 3 -",
          lead: "- 5 . 3' | 2' . . - | - 6 1' 3' | 2' . . - | - 3 5 7 | 6 . . - | - 7 6 5 | 2 . . ." },
        B: { bars: 8, chords: "67 37 57 2 67 37 2 2", pad: 1, bass: "R . . . . . . .", arp: "0 - 2 - 4 - 3 -",
          lead: "- 1' . 7 | 6 . . - | - 5 7 2' | 2' . . - | - 3' 2' 1' | 7 . . - | - 4 5 6 | 6 . . .",
          alt: { harm: 1 } },
        A2: { bars: 8, chords: "17 2 67 2 17 2 57 2", pad: 1, bass: "R . . . . . . .", arp: "0 - 2 - 4 - 3 -", harm: 1,
          lead: "- 5 . 3' | 2' . . - | - 6 1' 3' | 2' . . - | - 3 5 7 | 6 . . - | - 7 6 5 | 2 . . .",
          alt: { harm: 0, arp: "0 2 4 3" } },
      },
      form: ["A", "B", "A2"],
    },
  };
  var ORDER = ["chill", "drift", "pocket", "quest", "blocks", "pulse", "epic"];

  // "Auto (per game)": the style each game plays unless the player picks one (MUSIC-PANEL.md, Decisions).
  // "endless" is the id Two had before the rename; both are kept so either games.json works.
  var GAMES = { two: "chill", endless: "chill", sudoku: "drift", fibonacci: "quest", seven: "blocks", three: "pocket",
    four: "pulse", five: "epic", six: "drift", fifteen: "pocket", nine: "epic" };

  // ---------------------------------------------------------------------------------------------------------------
  // Pure parts (tested in Node)
  // ---------------------------------------------------------------------------------------------------------------
  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function bars(str) { return String(str).split("|").map(function (b) { return b.trim().split(/\s+/).filter(Boolean); }); }
  var DEG = /^([#b]?)([1-7])([',]*)$/, CHD = /^([#b]?)([1-7])([Mmd]?)(7?)$/;
  // scale degree token -> semitones above the style root (null for "-" or ".")
  function degree(st, tok) {
    var m = DEG.exec(tok); if (!m) return null;
    var sc = MODES[st.mode], s = sc[+m[2] - 1] + (m[1] === "#" ? 1 : m[1] === "b" ? -1 : 0);
    for (var i = 0; i < m[3].length; i++) s += m[3][i] === "'" ? 12 : -12;
    return s;
  }
  // chord token -> chord tones as semitones above the style root, root first, ascending
  function chord(st, tok) {
    var m = CHD.exec(tok); if (!m) return null;
    var sc = MODES[st.mode], d = +m[2] - 1, acc = m[1] === "#" ? 1 : m[1] === "b" ? -1 : 0, r = sc[d] + acc, t;
    var Q = { M: [0, 4, 7], m: [0, 3, 7], d: [0, 3, 6] };
    if (m[3] || acc) {
      t = (Q[m[3] || "M"]).slice();
      if (m[4]) t.push(m[3] === "d" ? 9 : m[3] === "m" ? 10 : 10);
      return t.map(function (x) { return r + x; });
    }
    t = [0, 2, 4].concat(m[4] ? [6] : []).map(function (k) { var j = d + k; return sc[j % 7] + 12 * Math.floor(j / 7) + acc; });
    return t;
  }
  // swung time: 0..TPB/2 is stretched to 0..TPB/2*(1+swing), the rest squeezed, so whole beats stay on the grid
  function tickTime(tick, bpm, swing) {
    var beat = Math.floor(tick / TPB), f = tick - beat * TPB, h = TPB / 2, sw = h * (1 + (swing || 0));
    var f2 = f <= h ? f * sw / h : sw + (f - h) * (TPB - sw) / h;
    return (beat * TPB + f2) * 60 / (bpm * TPB);
  }
  function barTicks(st) { return (st.beats || 4) * TPB; }
  function formBars(st) { return st.form.reduce(function (n, id) { return n + st.sections[id].bars; }, 0); }
  function cycleSeconds(st) { return formBars(st) * (st.beats || 4) * 60 / st.bpm; }
  function pick(list, i) { return list[i % list.length]; }

  // one style -> { events, ticks, seconds, bars } for one pass of the form; variant 1 applies each section's `alt`
  function compile(st, variant) {
    var B = barTicks(st), ev = [], bar0 = 0;
    function push(t, d, v, m, g) { ev.push({ t: t, d: d, v: v, m: m, g: g }); }
    st.form.forEach(function (sid) {
      var sec = st.sections[sid], o = {}, k;
      for (k in sec) o[k] = sec[k];
      if (variant && sec.alt) for (k in sec.alt) o[k] = sec.alt[k];
      var start = bar0 * B, chords = o.chords.split(/\s+/);
      var segs = []; // [tick, tones] chord segments across the section
      for (var b = 0; b < o.bars; b++) {
        var parts = pick(chords, b).split("/"), len = B / parts.length;
        parts.forEach(function (p, j) { segs.push({ t: start + b * B + j * len, d: len, tones: chord(st, p) }); });
      }
      function chordAt(t) { for (var i = segs.length - 1; i >= 0; i--) if (segs[i].t <= t) return segs[i]; return segs[0]; }
      // melodic lines: lead, lead2 and the derived harmony (a diatonic third under the lead)
      function line(str, voice, oct, g, harm) {
        var bl = bars(str), last = null;
        for (var b = 0; b < o.bars; b++) {
          var toks = pick(bl, b), step = B / toks.length;
          toks.forEach(function (tk, j) {
            var t = start + b * B + j * step;
            if (tk === ".") { if (last && last.t + last.d === t) last.d += step; return; }
            if (tk === "-") { last = null; return; }
            var x = tk;
            if (harm) { var m = DEG.exec(tk), dd = +m[2] - 2; x = (dd < 1 ? String(dd + 7) + m[3] + "," : String(dd) + m[3]); }
            var s = degree(st, x); last = { t: t, d: step, v: voice, m: st.root + s + oct, g: g }; ev.push(last);
          });
        }
      }
      var lo = o.leadOct || 0;
      if (o.lead) line(o.lead, "lead", lo, 1, false);
      if (o.lead && o.harm) line(o.lead, "lead2", lo, 0.8, true);
      if (o.lead2) line(o.lead2, "lead2", 0, 0.9, false);
      var V = st.voices;
      function rel(voice, str) {
        var bl = bars(str), oct = 12 * ((V[voice] && V[voice].oct) || 0), last = null;
        for (var b = 0; b < o.bars; b++) {
          var toks = pick(bl, b), step = B / toks.length;
          toks.forEach(function (tk, j) {
            var t = start + b * B + j * step, c = chordAt(t).tones, r = c[0] % 12;
            if (tk === ".") { if (last && last.t + last.d === t) last.d += step; return; }
            if (tk === "-") { last = null; return; }
            if (voice === "arp" && tk === "c") { c.forEach(function (x) { push(t, step, "arp", st.root + x + oct, 0.7); }); last = null; return; }
            var n;
            if (voice === "bass") n = { R: r, 3: r + (c[1] - c[0]), 5: r + (c[2] - c[0]), 8: r + 12, 7: r + ((c[3] || c[0] + 10) - c[0]) }[tk];
            else { var i = +tk; n = c[i % c.length] + 12 * Math.floor(i / c.length); }
            last = { t: t, d: step, v: voice, m: st.root + n + oct, g: 1 }; ev.push(last);
          });
        }
      }
      if (o.bass && V.bass) rel("bass", o.bass);
      if (o.arp && V.arp) rel("arp", o.arp);
      if (o.pad && V.pad) segs.forEach(function (sg) {
        sg.tones.forEach(function (x) { push(sg.t, sg.d, "pad", st.root + x + 12 * (V.pad.oct || 0), 1); });
      });
      // drums
      for (var bd = 0; bd < o.bars; bd++) {
        var name = bd === o.bars - 1 && o.fill ? o.fill : o.drums, pat = name && st.drums[name];
        if (!pat) continue;
        Object.keys(pat).forEach(function (kd) {
          var p = pat[kd], step = B / 16;
          for (var i = 0; i < p.length; i++) {
            var ch = p[i], g = ch === "X" ? 1 : ch === "x" ? 0.8 : ch === "g" ? 0.35 : 0;
            if (g) push(start + bd * B + i * step, step, kd, 0, g);
          }
        });
      }
      if (o.crash && st.kit.c) push(start, B, "c", 0, 0.8);
      if (st.pump && o.pad) for (var q = 0; q < o.bars * (st.beats || 4); q++) push(start + q * TPB, TPB, "pump", 0, 1);
      bar0 += o.bars;
    });
    ev.sort(function (a, b) { return a.t - b.t || (a.v < b.v ? -1 : a.v > b.v ? 1 : 0); });
    ev.forEach(function (e) { e.s = tickTime(e.t, st.bpm, st.swing); e.e = tickTime(e.t + e.d, st.bpm, st.swing); });
    return { events: ev, ticks: bar0 * B, bars: bar0, seconds: tickTime(bar0 * B, st.bpm, st.swing) };
  }

  function styleFor(game, choice) {
    if (choice && choice !== "auto" && STYLES[choice]) return choice;
    return GAMES[game] || "chill";
  }

  // ---------------------------------------------------------------------------------------------------------------
  // Synthesis (shared by live play and offline render)
  // ---------------------------------------------------------------------------------------------------------------
  function engine(c, dest) {
    var e = { c: c, waves: {}, mix: c.createGain(), duck: c.createGain(), verb: c.createConvolver(), n: 0, live: 0 };
    e.mix.connect(e.duck); e.duck.connect(dest);
    // seeded stereo impulse (2.2 s), so renders repeat exactly
    var sr = c.sampleRate, len = Math.floor(sr * 2.2), ir = c.createBuffer(2, len, sr), s = 0x2545f491;
    for (var ch = 0; ch < 2; ch++) {
      var d = ir.getChannelData(ch);
      for (var i = 0; i < len; i++) { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; d[i] = ((s >>> 0) / 4294967296 * 2 - 1) * Math.pow(1 - i / len, 3); }
    }
    e.verb.buffer = ir; e.verb.connect(e.mix);
    var nb = c.createBuffer(1, sr, sr), nd = nb.getChannelData(0);
    for (var j = 0; j < sr; j++) { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; nd[j] = (s >>> 0) / 4294967296 * 2 - 1; }
    e.noise = nb;
    return e;
  }
  function wave(e, o, w) {
    var duty = w === "pulse25" ? 0.25 : w === "pulse12" ? 0.125 : 0;
    if (!duty) { o.type = w === "supersaw" ? "sawtooth" : w; return; }
    if (!e.waves[w]) {
      var N = 40, re = new Float32Array(N), im = new Float32Array(N);
      for (var n = 1; n < N; n++) re[n] = 2 / (n * Math.PI) * Math.sin(n * Math.PI * duty);
      e.waves[w] = e.c.createPeriodicWave(re, im);
    }
    o.setPeriodicWave(e.waves[w]);
  }
  function done(nodes, e) {
    return function () { e.live--; nodes.forEach(function (n) { try { n.disconnect(); } catch (x) { /* gone */ } }); };
  }
  // one pitched note; returns nothing, cleans itself up when it ends
  function note(e, pl, p, midi, t, dur, vel) {
    var c = e.c, g = c.createGain(), f = mtof(midi), nodes = [g], oscs = [];
    var peak = p.gain * vel, a = p.a, d = p.d, sus = Math.max(peak * p.s, 0.0001), end = Math.max(t + a + d, t + dur);
    function osc(freq, detune) { var o = c.createOscillator(); wave(e, o, p.wave); o.frequency.value = freq; if (detune) o.detune.value = detune; oscs.push(o); nodes.push(o); return o; }
    var into = g;
    if (p.lp) { var lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = p.lp; lp.Q.value = 0.5; lp.connect(g); nodes.push(lp); into = lp; }
    if (p.wave === "supersaw") { osc(f, -9).connect(into); osc(f, 9).connect(into); }
    else osc(f, 0).connect(into);
    if (p.partial) { var pg = c.createGain(); pg.gain.value = p.pg; osc(f * p.partial, 0).connect(pg); pg.connect(into); nodes.push(pg); }
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(sus, t + a + d);
    g.gain.setValueAtTime(sus, end);
    g.gain.exponentialRampToValueAtTime(0.0001, end + p.r);
    g.connect(pl.dest(p));
    if (p.echo && pl.echoIn) g.connect(pl.echoIn);
    e.n++; e.live++;
    oscs[0].onended = done(nodes, e);
    oscs.forEach(function (o) { o.start(t); o.stop(end + p.r + 0.02); });
  }
  function noiseHit(e, out, t, type, freq, q, peak, dec) {
    var c = e.c, s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
    s.buffer = e.noise; s.loop = true; fl.type = type; fl.frequency.value = freq; fl.Q.value = q;
    s.connect(fl); fl.connect(g); g.connect(out);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + dec);
    e.n++; e.live++; s.onended = done([s, fl, g], e);
    s.start(t, (e.n * 0.137) % 0.7); s.stop(t + dec + 0.02);
  }
  function drop(e, out, t, type, f0, f1, fall, peak, dec) {
    var c = e.c, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + fall);
    o.connect(g); g.connect(out);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t + dec);
    e.n++; e.live++; o.onended = done([o, g], e);
    o.start(t); o.stop(t + dec + 0.02);
  }
  function drum(e, pl, kit, kd, t, vel) {
    var out = pl.bus, v = (kit[kd] || 0) * vel, chip = kit.chip;
    if (!v) return;
    if (kd === "k") drop(e, out, t, chip ? "triangle" : "sine", chip ? 180 : 150, 45, chip ? 0.06 : 0.12, v, chip ? 0.12 : 0.28);
    else if (kd === "s") {
      if (kit.snare === "rim") { noiseHit(e, out, t, "bandpass", 3200, 1.2, v, 0.05); drop(e, out, t, "triangle", 900, 700, 0.02, v * 0.5, 0.03); }
      else if (kit.snare === "clap") { noiseHit(e, out, t, "bandpass", 1500, 0.8, v, 0.14); noiseHit(e, out, t + 0.012, "bandpass", 1500, 0.8, v * 0.7, 0.12); }
      else { noiseHit(e, out, t, chip ? "highpass" : "bandpass", chip ? 1200 : 1800, 0.7, v, chip ? 0.08 : 0.16); drop(e, out, t, "triangle", 200, 160, 0.05, v * 0.6, 0.08); }
    }
    else if (kd === "h") noiseHit(e, out, t, "highpass", 7000, 0.7, v, chip ? 0.03 : 0.04);
    else if (kd === "o") noiseHit(e, out, t, "highpass", 6500, 0.7, v, 0.18);
    else if (kd === "t") { drop(e, out, t, "sine", 110, 55, 0.3, v, 0.55); noiseHit(e, out, t, "lowpass", 300, 0.7, v * 0.5, 0.08); }
    else if (kd === "c") noiseHit(e, out, t, "highpass", 5000, 0.5, v, 1.4);
  }

  // A player: one style on its own bus. start() at ctx time t0; book(until) books every event due before `until`.
  var cache = {};
  function compiled(id, variant) { var k = id + ":" + (variant ? 1 : 0); return cache[k] || (cache[k] = compile(STYLES[id], variant)); }
  function player(e, id, t0, fadeIn, levelOverride) {
    var st = STYLES[id], c = e.c, bus = c.createGain(), lv = levelOverride == null ? st.level : levelOverride;
    var pl = { id: id, st: st, bus: bus, cycle: 0, i: 0, anchor: t0, nodes: [bus], endAt: 0 };
    bus.connect(e.mix);
    if (fadeIn > 0) { bus.gain.setValueAtTime(0.0001, t0); bus.gain.exponentialRampToValueAtTime(lv, t0 + fadeIn); } else bus.gain.value = lv;
    var send = c.createGain(); send.gain.value = st.verb || 0; bus.connect(send); send.connect(e.verb); pl.nodes.push(send);
    if (st.echo) {
      var dl = c.createDelay(2), fb = c.createGain(), lp = c.createBiquadFilter(), wet = c.createGain(), inn = c.createGain();
      dl.delayTime.value = st.echo.beats * 60 / st.bpm; fb.gain.value = st.echo.fb; lp.type = "lowpass"; lp.frequency.value = 2400;
      wet.gain.value = st.echo.mix; inn.connect(dl); dl.connect(lp); lp.connect(fb); fb.connect(dl); lp.connect(wet); wet.connect(bus);
      pl.echoIn = inn; pl.nodes.push(dl, fb, lp, wet, inn);
    }
    if (st.pump) { pl.pumpG = c.createGain(); pl.pumpG.connect(bus); pl.nodes.push(pl.pumpG); }
    pl.dest = function (p) { return p === st.voices.pad && pl.pumpG ? pl.pumpG : bus; };
    pl.data = compiled(id, 0);
    pl.book = function (until) {
      var n = 0;
      while (true) {
        var evs = pl.data.events;
        if (pl.i >= evs.length) { pl.anchor += pl.data.seconds; pl.cycle++; pl.i = 0; pl.data = compiled(id, pl.cycle % 2); continue; }
        var ev = evs[pl.i], t = pl.anchor + ev.s;
        if (t >= until || (pl.endAt && t >= pl.endAt)) break;
        pl.i++; n++;
        if (t < c.currentTime - 0.01) continue; // late (a stalled timer): skip rather than bunch
        var dur = ev.e - ev.s, p = st.voices[ev.v];
        if (p) note(e, pl, p, ev.m, t, dur, ev.g);
        else if (ev.v === "pump") {
          var gg = pl.pumpG.gain; gg.setValueAtTime(1 - st.pump, t); gg.linearRampToValueAtTime(1, t + dur * 0.6);
        } else drum(e, pl, st.kit, ev.v, t, ev.g);
      }
      return n;
    };
    // roll the cursor back to the first event at or after time t (used after a pause)
    pl.seek = function (t) { var evs = pl.data.events, i = 0; while (i < evs.length && pl.anchor + evs[i].s < t) i++; pl.i = i; };
    pl.stop = function (fade) {
      if (pl.endAt) return fade + LOOKAHEAD + 2;
      pl.endAt = c.currentTime + fade;
      try {
        var t = c.currentTime, g = bus.gain;
        g.cancelScheduledValues(t); g.setValueAtTime(Math.max(g.value, 0.0001), t); g.exponentialRampToValueAtTime(0.0001, t + fade);
      } catch (x) { /* closed */ }
      return fade + LOOKAHEAD + 2;
    };
    pl.free = function () { pl.nodes.forEach(function (n) { try { n.disconnect(); } catch (x) { /* gone */ } }); };
    return pl;
  }

  // ---------------------------------------------------------------------------------------------------------------
  // The live API bound to a window-like object
  // ---------------------------------------------------------------------------------------------------------------
  function make(w, opt) {
    w = w || {}; opt = opt || {};
    var AC = null; try { AC = w.AudioContext || w.webkitAudioContext || null; } catch (x) { AC = null; }
    var setT = opt.setTimeout || (w.setTimeout ? w.setTimeout.bind(w) : setTimeout);
    var clearT = opt.clearTimeout || (w.clearTimeout ? w.clearTimeout.bind(w) : clearTimeout);
    var eng = null, own = false, made = 0, cur = null, old = [], timer = null, wanted = false, want = null;
    var game = null, cfg = null, gestured = false, paused = false, pausedAt = 0, ducked = false, susp = null;

    function readCfg(s, prev) {
      if (!s) { try { s = w.NumbericsSettings && w.NumbericsSettings.get ? w.NumbericsSettings.get() : null; } catch (x) { s = null; } }
      s = s || {}; prev = prev || cfg;
      return {
        on: typeof s.music === "boolean" ? s.music : prev.on != null ? prev.on : DEF.music,
        vol: typeof s.musicVolume === "number" && isFinite(s.musicVolume) ? Math.max(0, Math.min(1, s.musicVolume)) : prev.vol != null ? prev.vol : DEF.musicVolume,
        style: s.musicStyle === "auto" || STYLES[s.musicStyle] ? s.musicStyle : prev.style || DEF.musicStyle,
      };
    }
    cfg = readCfg(null, { on: DEF.music, vol: DEF.musicVolume, style: DEF.musicStyle });
    function hidden() { try { return !!(w.document && (w.document.hidden || w.document.visibilityState === "hidden")); } catch (x) { return false; } }
    function currentGame() {
      if (game) return game;
      try { var d = w.document, el = d && (d.querySelector("[data-current]")); if (el) return el.getAttribute("data-current"); } catch (x) { /* no DOM */ }
      return "two";
    }
    function resolve() { return want && want !== "auto" && STYLES[want] ? want : styleFor(currentGame(), cfg.style); }
    function mixTarget() { return cfg.on ? cfg.vol * SCALE : 0; }
    function ramp(param, v, secs) {
      try { var t = eng.c.currentTime; param.cancelScheduledValues(t); param.setValueAtTime(param.value, t); param.linearRampToValueAtTime(v, t + secs); } catch (x) { /* closed */ }
    }

    // Create (once) and resume the context: only from a gesture, or after one has happened (sticky activation).
    function ensure() {
      if (eng) { if (own && eng.c.state === "suspended" && !paused) { try { var p = eng.c.resume(); if (p && p.catch) p.catch(function () {}); } catch (x) { /* blocked */ } } return true; }
      var sh = null;
      try { sh = w.NumbericsAudio && typeof w.NumbericsAudio.musicBus === "function" ? w.NumbericsAudio.musicBus() : null; } catch (x) { sh = null; }
      try {
        if (sh && sh.context && sh.input) { eng = engine(sh.context, sh.input); own = false; }
        else {
          if (!AC) return false;
          var c = new AC(); made++; own = true;
          eng = engine(c, c.destination);
          if (c.state !== "running" && c.resume) { var q = c.resume(); if (q && q.catch) q.catch(function () {}); }
        }
        eng.mix.gain.value = 0; eng.duck.gain.value = ducked ? DUCK : 1;
      } catch (x) { eng = null; return false; }
      return true;
    }
    function loop() {
      timer = null;
      if (!eng || paused) return;
      var until = eng.c.currentTime + LOOKAHEAD;
      if (cur) cur.book(until);
      old.forEach(function (p) { p.book(until); });
      timer = setT(loop, TICK_MS);
    }
    function startLoop() { if (!timer && !paused) loop(); }
    function retire(p, fade) { var secs = p.stop(fade); setT(function () { p.free(); var i = old.indexOf(p); if (i >= 0) old.splice(i, 1); }, secs * 1000); old.push(p); }
    // start or switch to the resolved style, crossfading from whatever plays
    function go() {
      if (!wanted || !cfg.on || !activated() || hidden()) return false;
      if (!ensure()) return false;
      var id = resolve();
      ramp(eng.mix.gain, mixTarget(), 0.08);
      if (cur && cur.id === id) { startLoop(); return true; }
      var t0 = eng.c.currentTime + 0.06;
      if (cur) { var prev = cur; cur = null; retire(prev, XFADE); }
      cur = player(eng, id, t0, old.length ? XFADE : FADE_IN);
      startLoop();
      return true;
    }
    // stop booking; fade out what plays (wanted stays as it was)
    function halt(fade) {
      if (cur) { var p = cur; cur = null; retire(p, fade); }
    }

    function onGesture(e) { if (e && e.isTrusted === false) return; gestured = true; if (wanted && !cur) go(); else if (eng && own && eng.c.state === "suspended" && !paused) ensure(); }
    try { ["pointerdown", "keydown", "touchend", "click"].forEach(function (n) { w.addEventListener(n, onGesture, { capture: true }); }); } catch (x) { /* no events */ }
    function activated() {
      if (gestured) return true;
      try { return !!(w.navigator && w.navigator.userActivation && w.navigator.userActivation.hasBeenActive); } catch (x) { return false; }
    }

    function pause() {
      if (paused || !eng) return; paused = true; pausedAt = eng.c.currentTime;
      if (timer) { clearT(timer); timer = null; }
      ramp(eng.duck.gain, 0, 0.12);
      if (own) susp = setT(function () { susp = null; if (paused) try { var p = eng.c.suspend(); if (p && p.catch) p.catch(function () {}); } catch (x) { /* closed */ } }, 200);
    }
    function resume() {
      if (!paused || !eng) return;
      paused = false; if (susp) { clearT(susp); susp = null; }
      function back() {
        var now = eng.c.currentTime, shift = now + 0.1 - pausedAt;
        [cur].concat(old).forEach(function (p) { if (p) { p.seek(pausedAt + 0.12); p.anchor += shift; } });
        ramp(eng.duck.gain, ducked ? DUCK : 1, 0.4);
        if (cur || old.length) startLoop(); else go();
      }
      if (own && eng.c.state !== "running") { try { var p = eng.c.resume(); if (p && p.then) p.then(back, back); else back(); } catch (x) { back(); } }
      else back();
    }
    try {
      w.document.addEventListener("visibilitychange", function () { if (hidden()) pause(); else resume(); });
    } catch (x) { /* no DOM */ }
    try {
      w.addEventListener("numberics:settings", function (e) {
        var before = resolve(), wasOn = cfg.on;
        cfg = readCfg(e && e.detail, cfg);
        if (e && e.detail && "musicStyle" in e.detail) want = null; // a saved choice beats an earlier setStyle()
        if (!cfg.on) { if (eng) ramp(eng.mix.gain, 0, 0.3); if (wasOn) halt(0.3); return; }
        if (eng) ramp(eng.mix.gain, mixTarget(), 0.08);
        if (wanted && (!cur || !wasOn || resolve() !== before)) go();
      });
    } catch (x) { /* no events */ }

    var M = {
      STYLES: STYLES, GAMES: GAMES, ORDER: ORDER.slice(),
      // play(style): "auto" (or nothing) follows the player's choice, then the game's default. Starts at the next gesture.
      play: function (style) { wanted = true; if (style !== undefined) want = style; return go(); },
      // start(gameId): the per-game entry point a page calls once on load
      start: function (gameId) { if (gameId) game = gameId; wanted = true; return go(); },
      stop: function () { wanted = false; halt(STOP_FADE); return true; },
      setStyle: function (style) { want = style; return wanted ? go() : false; },
      game: function (id) { if (id) game = id; return currentGame(); },
      forGame: function (id) { return styleFor(id, "auto"); },
      styles: function () { return ORDER.map(function (id) { var s = STYLES[id]; return { id: id, name: s.name, blurb: s.blurb, bpm: s.bpm, seconds: Math.round(cycleSeconds(s)) }; }); },
      volume: function (v) {
        if (typeof v === "number" && isFinite(v)) { cfg.vol = Math.max(0, Math.min(1, v)); if (eng) ramp(eng.mix.gain, mixTarget(), 0.08); }
        return cfg.vol;
      },
      enable: function (on) { cfg.on = !!on; if (!cfg.on) { if (eng) ramp(eng.mix.gain, 0, 0.3); halt(0.3); } else if (wanted) go(); return cfg.on; },
      duck: function (on) { ducked = !!on; if (eng && !paused) ramp(eng.duck.gain, ducked ? DUCK : 1, ducked ? 0.4 : 1.2); return ducked; },
      unlock: function () { gestured = true; return wanted ? go() : ensure(); },
      state: function () {
        return { contexts: made, ctx: eng ? eng.c.state : "none", shared: !!(eng && !own), playing: !!cur, style: cur ? cur.id : null,
          resolved: resolve(), fading: old.length, paused: paused, ducked: ducked, on: cfg.on, volume: cfg.vol, cycle: cur ? cur.cycle : 0,
          notes: eng ? eng.n : 0, live: eng ? eng.live : 0, mix: eng ? eng.mix.gain.value : 0 };
      },
      // render(style, o): the style through the same synth in an OfflineAudioContext. o.seconds (default one full
      // pass), o.raw (level 1, to calibrate), o.gain (the mix gain, default 1 = unity). Resolves an AudioBuffer.
      render: function (style, o) {
        o = o || {};
        var OAC = null; try { OAC = w.OfflineAudioContext || w.webkitOfflineAudioContext || null; } catch (x) { OAC = null; }
        if (!OAC || !STYLES[style]) return Promise.resolve(null);
        var sr = o.rate || 44100, secs = o.seconds || Math.ceil(cycleSeconds(STYLES[style]) + 2);
        var c = new OAC(2, Math.ceil(sr * secs), sr), e = engine(c, c.destination);
        e.mix.gain.value = o.gain == null ? 1 : o.gain;
        var p = player(e, style, 0.02, 0, o.raw ? 1 : null);
        p.book(secs);
        return c.startRendering();
      },
    };
    return M;
  }

  var API = { STYLES: STYLES, GAMES: GAMES, MODES: MODES, ORDER: ORDER, TPB: TPB, DEF: DEF, SCALE: SCALE, TARGET_LUFS: TARGET_LUFS,
    compile: compile, tickTime: tickTime, cycleSeconds: cycleSeconds, formBars: formBars, degree: degree, chord: chord, bars: bars,
    mtof: mtof, styleFor: styleFor, make: make, LEVELS: { FADE_IN: FADE_IN, XFADE: XFADE, STOP_FADE: STOP_FADE, DUCK: DUCK, LOOKAHEAD: LOOKAHEAD, TICK_MS: TICK_MS } };
  if (typeof module === "object" && module.exports) module.exports = API;
  if (typeof window !== "undefined" && root === window) window.NumbericsMusic = make(window);
})(typeof window !== "undefined" ? window : this);
