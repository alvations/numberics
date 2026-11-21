<!-- SPDX-License-Identifier: Apache-2.0 -->
<!-- Copyright 2026 alvations (Melon Lab) -->

# Music: the background music (O-8)

All background music is **synthesised live** by `shared/music.js` (global `NumbericsMusic`) with the Web Audio API.
There are no audio files, no samples and no network requests. Every melody, chord progression and arrangement is
original to this repo. The styles evoke genres, never particular works, and no player-visible text, code or doc
names another game, franchise or composer (a test checks the text against a hashed list). The panel that chose
what ships, and why, is in [MUSIC-PANEL.md](MUSIC-PANEL.md).

## The styles (all seven ship)

| Id | Name | Feel | Tempo | Key | Form (bars) | One pass | Instruments |
|---|---|---|---|---|---|---|---|
| `chill` | Chill | warm, lazy, late evening | 84, swung 8ths (0.2) | F major, maj7/m7 chords | I4 A8 B8 C4 A2 8 B8 = 40 | 114 s | triangle keys with a soft 2nd partial and a dotted-8th echo, sine bass, triangle pad, rim, soft kick, ghosted hats |
| `drift` | Drift | still, floating, no drums | 66 | A lydian | A8 B8 A2 8 = 24 | 87 s | sine bells (3rd partial), long echo, slow triangle pad, sine bass, quiet arp |
| `pocket` | Pocket | bright little town tune on a pocket console | 116, light swing (0.1) | D major, with a V/V | A8 B8 A2 8 C4 B8 A8 = 44 | 91 s | 25% pulse lead, 12.5% pulse harmony, triangle bass, triangle arp, chip kick, noise snare and hats |
| `quest` | Quest | a march over open country | 132 | Bb major, borrowed bVII | I4 A8 B8 A2 8 C8 B8 = 44 | 80 s | square lead, 25% pulse harmony a third under, triangle bass, triangle pad, march snare with ghosts, toms |
| `blocks` | Blocks | a quick folk dance on an old handheld chip | 150 | G harmonic minor | A8 A2 8 B8 A8 C4 B8 A3 8 = 52 | 83 s | square lead, 25% pulse duet in thirds, oom-pah triangle bass, pulse chord stabs on the off-beats, chip drums |
| `pulse` | Pulse | club, four on the floor | 124 | A minor (iv VI i VII) | intro 8, build 8, drop 16, break 8, drop 16 = 56 | 108 s | detuned-saw lead and pad, the pad pumps on every beat, square offbeat bass, 16th square arp, kick, clap, open hats |
| `epic` | Epic | big drums and a long climb | 88 | D minor, harmonic V | I4 A8 B8 C8 A2 8 = 36 | 98 s | filtered-saw brass lead and horn line, wide supersaw pad, triangle bass, taiko toms, snare, cymbal swells |

Each pass is 60 to 120 s (a test enforces it). The loop is not exact: **odd passes** swap in each section's `alt`
(a harmony line, another arp, other drums), so two passes in a row differ on 29 to 80 % of their bars (`pass2` in the
render report). After the second pass the first returns, so a full cycle is 2.5 to 4 minutes before anything repeats.

### Writing rules every style follows
- **Original lines only.** Written note by note for this repo. `tests/test-music.js` also holds the interval shapes
  of a few very well-known openings (folk and game), as numbers only, and fails if any 5-interval window of any lead or
  harmony line, in any key, matches one. That guard caught three of our own lines during writing (a derived harmony in
  Epic, a hook in Pulse, a run in Pocket); each was rewritten, not excused.
- **No shrill top.** No pitched note above F#6 (MIDI 90, about 1.5 kHz). An octave-up repeat in Blocks reached A6
  and was removed after the panel (MUSIC-PANEL.md).
- **The key you write is the key you hear.** A pitch-class profile (Krumhansl) of every compiled pass must find the
  declared tonic and mode for the major and minor styles (Drift's lydian reads as a major key, as lydian does).
- **A and B at least**, a fill on the last bar of most sections, a breakdown or bridge somewhere.

## Notation (how a style is written)

A style is plain data in `STYLES` in `shared/music.js`:

```js
pocket: {
  name: "Pocket", blurb: "A bright little town tune on a pocket console.",
  bpm: 116, swing: 0.1, beats: 4, root: 74, mode: "major", level: 0.55, verb: 0.1,
  echo: { beats: 0.5, fb: 0.22, mix: 0.14 },
  voices: { lead: { wave: "pulse25", gain: 0.075, a: 0.003, d: 0.15, s: 0.6, r: 0.05, echo: 1 }, ... },
  kit: { k: 0.38, s: 0.11, h: 0.03, chip: 1 },
  drums: { main: { k: "x.......x.......", s: "....x.......x...", h: "x.x.x.x.x.x.x.x." }, ... },
  sections: { A: { bars: 8, chords: "1 4 5 1 6 2 5 1", bass: "R - 5 - 8 - 5 -", arp: "- 0 - 1 - 2 - 1",
                   drums: "main", fill: "fill", lead: "1 . 3 5 . 3 6 5 | 4 . 6 1' . 6 5 4 | ...", alt: { harm: 1 } }, ... },
  form: ["A", "B", "A2", "C", "B", "A"],
}
```

- **A bar** is space-separated tokens that split it evenly (1, 2, 3, 4, 6, 8, 12 or 16 tokens); `|` ends a bar. A line
  shorter than its section repeats.
- **Lead / lead2**: scale degree `1`-`7`, prefix `#` or `b`, suffix `'` (octave up) or `,` (octave down); `.` holds the
  previous note; `-` rests. `harm: 1` adds a harmony line a diatonic third under the lead on the `lead2` voice.
  `leadOct: 12` moves the lead up an octave.
- **Chords**, one per bar (`4/5` splits a bar): a degree builds the diatonic triad of the mode; `M`, `m`, `d` force
  major, minor, diminished; `7` adds the seventh (with `M`, a dominant seventh); `b7`, `b6` are borrowed major chords.
- **Bass** (relative to the chord): `R` root, `3`, `5`, `8` octave, `7` seventh. **Arp**: chord-tone index `0`-`6`
  (counting up through octaves), `c` the whole chord as a stab. **Pad**: `pad: 1` holds each chord.
- **Drums**: 16 steps a bar, `x` hit, `X` accent, `g` ghost. Rows: `k` kick, `s` snare (`kit.snare` "rim" or "clap"
  changes it), `h` hat, `o` open hat, `t` tom, `c` cymbal. `crash: 1` hits the cymbal on a section's first beat.
  `kit.chip` makes the kit a chip kit (triangle kick, short noise).
- **Voices**: `wave` sine, triangle, square, sawtooth, supersaw (two saws, +-9 cents), pulse25, pulse12 (PeriodicWave);
  `gain` peak; `a d s r` envelope (seconds, sustain as a fraction); `lp` a lowpass; `oct` octaves from `root`;
  `partial` and `pg` an extra sine at that ratio; `echo: 1` sends to the style's feedback echo.
- `pump` (0..1) ducks the pad on every beat (the club pump). `verb` is the reverb send.

`compile(style, variant)` turns this into one sorted list of `{ t, d, v, m, g, s, e }` events (tick, length, voice,
MIDI note, velocity, start and end seconds) for one pass. It is pure and tested in Node.

## How it plays (engine)

- **Clock.** 12 ticks a beat (16ths, 8ths and 8th triplets all land on whole ticks). Swing stretches the first half of
  each beat and squeezes the second, so whole beats never move (`tickTime`, tested).
- **Lookahead scheduler.** A 50 ms timer books every event due in the next 0.35 s on the audio clock, then sleeps. There
  is no per-frame work and no `requestAnimationFrame`. A late timer skips stale events instead of bunching them.
- **Voices.** Each note is one or two oscillators (plus a lowpass where the voice has one) into an envelope gain; each
  drum hit is a pitch-drop oscillator or a burst of a shared, seeded noise buffer through a filter. Every node is
  disconnected when its source ends. A busy style (Pulse) books about 11 notes and 8 drum hits a second.
- **Graph.** note -> style bus (`level`, fades) -> mix (`musicVolume * SCALE`, 0 when Music is off) -> duck -> output.
  The style bus also feeds one shared convolver (a seeded 2.2 s stereo impulse) and, per style, a feedback echo.
- **Crossfade.** A new style starts on its own bus at the next 60 ms and fades in over 2.0 s while the old bus fades
  out; the old style keeps booking until its fade ends, then is freed. The first start fades in over 2.5 s; `stop()`
  fades out over 0.8 s.
- **Gesture.** The music makes its own AudioContext only inside a trusted `pointerdown`, `keydown`, `touchend` or
  `click` (capture listeners, registered once), and only if a page asked for music and Music is on. Nothing is created
  on load or by untrusted events. Only the context is made inside the tap (that is what iOS needs); the impulse,
  the noise buffer and the first player are built in the next task.
- **Hidden tab.** On `visibilitychange` to hidden the music fades in 120 ms, stops booking and suspends its context
  200 ms later; on return it resumes, rewinds its cursor to where it paused and fades back in.
- **Duck.** `duck(true)` lowers the music to 35 % over 0.4 s (for end cards); `duck(false)` brings it back over 1.2 s.
  `dip()` is a 0.7 s, 6 dB dip for a big SFX.

### Performance (measured)
On headless Chromium (`tests/emu/shared-music.cjs`): no long task (over 50 ms) while the music starts, plays and
switches through every style. Compiling a style costs 0.3 to 5 ms, once per style and variant (cached). The one big cost on the first tap
is the browser's own `new AudioContext()` (about 21 ms here). With the shared context (below) the tap makes only the
SFX one; the music plugs into it.

**The first-tap long task (integration, 21 Nov).** At 4x CPU every game showed one 100 to 150 ms task about 100 ms after
the first tap. Profiled: the engine's buffers (the 2.2 s stereo reverb impulse and one second of noise, about 260 000
seeded samples, ~95 ms) and the browser preparing one 2.2 s `ConvolverNode` kernel (~75 ms, measured in isolation).
Now the live engine builds in short tasks: the samples in slices of 40 000 (`e.step`), then the reverb as four equal
parts, each its own un-normalised convolver fed through a delay of its offset (convolution is linear, so the sum is the
whole impulse), with the Web Audio normalisation of the whole impulse applied once (`irScale`), then the first player in
a task of its own. Every task is under 35 ms at 4x CPU; the music starts about 200 ms after the tap instead of about
150 ms, inside its 2.5 s fade-in. Same sound: the seeded samples are identical (`tests/test-music.js`), and the impulse
response through the parts matches one convolver of the whole impulse within 0.1 % of its peak and 0.01 dB
(`tests/emu/shared-music.cjs`). Offline render uses the same parts, built at once.

### One context, shared with `shared/audio.js` (built)
SFX and music share **one AudioContext**, owned by `audio.js`. Why: every `new AudioContext()` costs about 21 ms on
the tap that makes it (measured), so two contexts double the work of the first tap; one context is one audio thread
on low-end phones; and both outputs then go through the same compressor, so a loud SFX over the music can never clip.

The contract (`audio.js` side, about six lines):
- `NumbericsAudio.musicBus()` returns `null` until the SFX context exists, then `{ context, input }`, the same object
  every time. `input` is a GainNode (gain 1) made once and connected **straight to the compressor**, not through the
  SFX master, so the SFX volume and the Sound switch never move the music (Music has its own switch and volume).
- The context is still made only inside a gesture, by `unlock()`. In its own capture listener the music calls
  `NumbericsAudio.unlock()` and then `musicBus()`, so it never needs the two listeners to run in a given order.
- `audio.js` owns the context: it may suspend it on a hidden tab or not. The music never suspends or closes a context it
  does not own; on a hidden tab it fades out, stops booking and remembers where it was; on return it rewinds and fades in.

The music side is built and tested both ways: with `musicBus()` it makes no context of its own
(`tests/test-music.js` with a fake, and `tests/emu/shared-music.cjs` with a stand-in bus in a real browser); without it,
it owns one context and suspends it while hidden (the fallback, also tested, so a page that loads `music.js` without
`audio.js` still works).

## Levels (keep it this way)

| Stage | Target | How it is kept |
|---|---|---|
| Each style at unity (mix 1) | **-20 LUFS integrated** (BS.1770, K-weighted, gated), within +-1 LU of each other | the per-style `level`, derived by `node tools/render-music.cjs --raw` (it prints the level that hits the target), checked by the render report |
| Peaks at unity | **<= -1 dBFS sample peak, no clipped samples** | render report |
| Shipped music | `unity * musicVolume * SCALE`, `SCALE = 0.07` | at the default sliders (music 0.5, SFX 0.5) the loudest music peak sits **at least 6 dB under the SFX `merge` peak** (the most frequent reward sound); the render report measures both and fails otherwise |

The rule comes from melon-eight's AUDIO.md lesson: SFX are transients that must peak clearly above a steady bed; never
RMS-match an SFX to the music. The SFX are the reference; the music is set under them.

Measured (`tools/render-music.cjs`, one full pass each, 44.1 kHz stereo; "shipped" = default sliders, music 0.5):

| Style | `level` | Unity LUFS | Unity peak dBFS | Crest dB | Centroid Hz | Shipped LUFS | Shipped peak dBFS |
|---|---|---|---|---|---|---|---|
| Chill | 0.39 | -20.06 | -6.99 | 15.1 | 679 | -49.2 | -36.1 |
| Drift | 0.49 | -20.06 | -10.99 | 10.8 | 340 | -49.2 | -40.1 |
| Pocket | 0.55 | -20.00 | -7.54 | 14.6 | 2548 | -49.1 | -36.7 |
| Quest | 0.40 | -19.93 | -7.58 | 14.4 | 1548 | -49.0 | -36.7 |
| Blocks | 0.55 | -19.99 | -6.04 | 15.8 | 3106 | -49.1 | -35.2 |
| Pulse | 0.72 | -20.05 | -4.86 | 17.2 | 1696 | -49.2 | -34.0 |
| Epic | 0.39 | -19.90 | -6.13 | 15.1 | 684 | -49.0 | -35.2 |

Spread across styles 0.16 LU; no clipped samples; loudest shipped music peak -34.0 dBFS against the `merge` SFX at
-26.5 dBFS: **7.5 dB of headroom** (need 6; the tool's SCALE for 6.5 dB is 0.0784, so 0.07 keeps a margin).
Unmatched (every `level` 1) the styles spread 4.8 LU and Chill, Quest and Epic clipped, which is why `level` exists.

**The SFX lift (applied).** Before it, at the default volume the `merge` SFX peaked at -39 dBFS and `tick` at -45 dBFS,
and the music sat under that at about -62 LUFS (`SCALE = 0.016`): the right balance, but faint on a phone speaker.
The SFX notes below set new gains (merge +13.3 dB), and the same change set `SCALE = 0.07`: the music now plays at
about -49 LUFS at defaults with its loudest peak 7.5 dB under the lifted merge. SFX peaks at the default volume after
the lift (render report): merge -26.5, land -26.1, place -32.0, tick -32.2, best -21.1, win -20.2 dBFS.

Reproduce:
```bash
NODE_PATH=$(npm root -g) node tools/render-music.cjs                 # all styles -> <tmp>/numberics-music/*.wav + report
NODE_PATH=$(npm root -g) node tools/render-music.cjs out --styles pulse,epic --seconds 30
NODE_PATH=$(npm root -g) node tools/render-music.cjs out --raw        # calibrate: prints the level per style
```
The WAVs go to the folder given (default under the OS temp dir), never into the repo. Rendering runs at roughly 2x
real time on four cores because the reverb is a real convolution.

## The per-game map ("Auto (per game)")

| Game | Style | Why (panel, MUSIC-PANEL.md) |
|---|---|---|
| Two | Chill | the flagship, long sessions; warm and unhurried |
| Fibonacci | Quest | a spiral that keeps going; the journey feel |
| Three | Pocket | bright, playful, rainbow flushes |
| Four | Pulse | a quick duel with a beat |
| Five | Epic | tiles stack and burst; the build-up suits it |
| Six | Drift | a thinking puzzle; nothing on the beat to rush you |
| Seven | Blocks | discs drop into a well; the falling-block dance |
| Nine | Epic | a duel of heaps; weight and tension |
| Fifteen | Pocket | a light duel; friendly |
| Sudoku | Drift | long thinking sessions; no drums |

`GAMES` in `music.js` holds it (Two under both `two` and `endless`, the id before the rename). A test fails if a live
game in `games.json` has no style.

## API (`window.NumbericsMusic`)

| Call | Does |
|---|---|
| `start(gameId)` | the page entry point: remember the game, ask for music; it starts at the first tap (if Music is on) |
| `play(style)` | ask for music; `style` is an id, or `"auto"`/nothing for the saved choice, then the game's default |
| `setStyle(style)` | switch (crossfade) to a style, or `"auto"` |
| `stop()` | fade out and stop asking |
| `styles()` | `[{ id, name, blurb, bpm, seconds }]` in menu order (for the Settings list) |
| `forGame(id)` | the game's default style |
| `volume(v)` | set (0..1) or read the music volume; ramps over 80 ms |
| `enable(on)` | Music on or off for this page (Settings does this through its event) |
| `duck(on)` | lower to 35 % under an end card, or restore |
| `dip()` | a short 6 dB dip under a big SFX |
| `key()` | the semitone shift (-6..5) that puts the C pentatonic SFX ladder in the playing style's key |
| `state()` | `{ contexts, ctx, playing, style, resolved, fading, paused, ducked, on, volume, cycle, notes, live, mix }` for tests |
| `render(style, { seconds, raw, gain })` | the same synth in an OfflineAudioContext; resolves an AudioBuffer |

Events: it listens for `numberics:settings` (fields `music`, `musicVolume`, `musicStyle`; a missing field keeps its
value) and fires `numberics:music` (`{ style, key }`) whenever a style starts.

### Loading (lazy, built into `shared/audio.js`)
Pages do **not** load `music.js` (46 KB) and need no script tag or `start()` call. `shared/audio.js`, which every page
already loads, sets a small stub `window.NumbericsMusic` at load: `play`, `start`, `stop`, `duck`, `dip`, `setStyle`,
`enable` and `key` (0) are no-ops; it keeps the latest `duck` state, a `start(id)` game id and a `stop()`.
`NumbericsMusic.stub` is true until the real module replaces it. After the first trusted `pointerdown`, `keydown`,
`touchend` or `click`, if Music is on, it appends one same-origin script element for `music.js` (next to `audio.js`,
`onload` / `onerror`, nothing written into the document stream); on load it sets the game (`start(id)` if a page called it, else
`#games[data-current]`, `endless` read as `two`), replays the duck, starts the music and calls
`unlock()` (the gesture already happened), so the music plays on the SFX context. **The games page plays no music**
(TRIAGE5 S2, all-ages panel and critic S2; reversible by the owner): a page with no `#games[data-current]` and no
`start(id)` call (the root, O-9) never loads `music.js`, so its taps keep their sounds (ticks, the trophy chime) and the
music starts on a game page only. Measured before the change: games-page music was a 2 to 5 s fragment cut off by the
card tap that left the page, and a 48 KB fetch for it. With Music off nothing loads; turning
it on later in Settings (a `numberics:settings` event with `music: true`) loads it then. A failed load leaves the stub
(no retry loop). A page that does load `music.js` itself (the test fixture) gets the real module, and the loader stays out.
Initial page weight: about +2 KB (the loader, the key shift and the Settings controls), measured with `tools/perf.cjs`.

### Wiring a page
Nothing to add for the music to play. When an end card shows: `NumbericsMusic.duck(true)`; when it closes or a new game
starts: `duck(false)`. Call it as `window.NumbericsMusic && NumbericsMusic.duck(true)`; it works before and after the
module loads (the stub keeps the state).

## Settings fields (for `shared/settings.js`)

Add to `DEF`, `FIELDS` and `normalize()` in `numberics_settings_v1`:

| Field | Type, default | Normalise | Sheet control ("Sound and feel", after Volume) |
|---|---|---|---|
| `music` | boolean, `true` | boolean else default | **Music** switch, sub line "Quiet tunes while you play" |
| `musicVolume` | number 0..1, `0.5` | clamp to 0..1, round to 0.01 | **Music volume** slider 0 to 100, step 5; disabled while Music is off; no preview tick (the music itself is the preview) |
| `musicStyle` | `"auto"` or a style id, `"auto"` | one of `auto chill drift pocket quest blocks pulse epic`, else `"auto"` | **Music style** (O-10): "Auto (per game)" first, then the seven names in that order as `button[aria-pressed]` segments in two rows (each with its blurb as `title`), hidden while Music is off. Under the rows (TRIAGE5 S4): the chosen style's one line ("Drift: Soft bells and a slow pad, no drums.", Auto: "Each game picks its own."), readable on touch, and a status line "Now playing: <name>" while the music plays (refreshed on `numberics:music` and after a pick); on the games page it says "Music plays in the games, not on this page." |

Keep the list of ids in `settings.js` itself (do not read it from `music.js`, which may load later). The **Sound**
switch stays the SFX switch; Music has its own. Erase keeps these (they live in the settings key).

## SFX notes (for `shared/audio.js`): recommended gains (applied)

The lead measured the SFX peaks at **100 % volume** with the spec's gains (REDESIGN.md 7.3). They span 27 dB (slide
-48 to win -21 dBFS), and the everyday sounds sit near -38 dBFS: under any music they would vanish first, and on a phone
speaker they are hard to hear at all. The new gains below bring every sound up to a band by its job, keep the order of
importance, and leave the -18 dB compressor touching only the big moments. Change only the "Peak gain" column of 7.3;
the recipes (waves, envelopes, notes) stay as they are.

| Sound | Peak now (100 %) | dBFS now | Job | Target peak (100 %) | **New peak gain** (was) |
|---|---|---|---|---|---|
| `tick` | .012 | -38.4 | tap | .05 (-26) | **.21** (.05) |
| `place` | .012 | -38.4 | tap | .05 (-26) | **.21** (.05) |
| `pip` | .008 | -41.9 | tap | .05 (-26) | **.22** (.035) |
| `bad` | .009 | -40.9 | tap, refused | .045 (-27) | **.20** (.04) |
| `slide` | .004 | -48.0 | texture | .035 (-29) | **.35** (.04) |
| `merge` | .022 | -33.2 | reward | .10 (-20) | **.36** (.08) |
| `pop` | .022 | -33.2 | reward | .10 (-20) | **.36** (its merge, .08) |
| `land` | .023 | -32.8 | reward | .10 (-20) | **.43** (.10) |
| `burst` | .032 | -29.9 | reward | .10 (-20) | **.28** (.09) |
| `power` | .030 | -30.5 | event | .16 (-16) | **.27** (.05) |
| `best` | .078 | -22.2 | event | .18 (-15) | **.16** (.07) |
| `lose` | .060 | -24.4 | end, soft | .13 (-18) | **.11** (.05) |
| `trophy` | .087 | -21.2 | big | .20 (-14) | **.16** (.07) |
| `win` | .088 | -21.1 | big | .20 (-14) | **.18** (.08) |

Applied in `shared/audio.js` as listed; the second partials keep their ratios (power's 1976 Hz sine .135, trophy's held
chord .09, burst's `merge(9)` .25 so burst lands at its target, measured -20.3 dBFS at 100 %). Measured at 100 % after
the change: tick -26.1, slide -29.5, merge -20.5, land -20.3, burst -20.3, pip -25.9, place -26.0, best -15.1,
power -16.9, trophy -14.2, win -14.2, lose -17.8, bad -26.7 dBFS. Notes 1, 3 and 4 below are built; note 5 is not.

New gain = old gain x target / measured peak (each sound scales linearly; the compressor only acts above -18 dBFS, so
the big three land a little under their targets, which is the point). Spread after: 15 dB (slide to win) instead of 27.
At the default volume (50 %) every peak is 6 dB lower: merge -26, win -20 dBFS.

**Apply together with the music:** the music is set under the SFX (Levels), so the same commit sets `SCALE = 0.07` in
`shared/music.js` (+13.3 dB, the same lift `merge` gets: -39.3 -> -26.0 dBFS at defaults). Then run
`node tools/render-music.cjs`: its headroom line must read 6 dB or more, and it prints the exact SCALE for 6.5 dB.

Other notes, in order of value:
1. **Play in the music's key.** The ladder is C pentatonic; most styles are not in C, so a merge over Blocks (G
   harmonic minor) or Quest (Bb) clashes. Listen for `numberics:music` and shift the ladder: `note(k) * 2 ** (key / 12)`
   (key -6..5, also `NumbericsMusic.key()`; minor styles use the relative major, whose pentatonic is the minor
   pentatonic). Shift the fixed chords (best, win, trophy, lose) by the same amount. With no music, key 0 (as today).
   A test checks the shifted ladder sits in every style's scale (one note off in harmonic minor at most).
2. **Never quantise SFX to the beat.** Feedback must land on the action; the music adapts, the SFX do not wait.
3. **Dip under the big ones.** In `best`, `power` and `trophy`, call `window.NumbericsMusic && NumbericsMusic.dip()`;
   end cards (`win`, `lose`) use `duck(true)` from the page instead.
4. **`musicBus()`** as specified above (one context).
5. **Two small additions** that fit the same synth: `whoosh(dir)` (filtered noise sweep, up when a sheet opens, down
   when it closes or on Undo, target peak .035) and `deal()` (two soft rising triangle notes a fifth apart on a new
   game, target peak .05).

## Adding a style

1. Write it in `STYLES` (notation above): a new id, a one-word `name`, a `blurb` under 70 characters with no
   reference to another work, a form of 60 to 120 s with at least an A and a B, and `alt`s for the odd passes.
   Write every line yourself; do not transcribe or adapt a tune you know.
2. Add the id to `ORDER` (menu order), and to the `musicStyle` list in `settings.js`.
3. `node tests/test-music.js`: well formed, range, key, variation, originality guard, names.
4. `NODE_PATH=$(npm root -g) node tools/render-music.cjs out --styles <id> --raw`, set `level` to the printed value,
   re-run without `--raw` (within 1 LU, peak <= -1 dBFS, 6 dB under the SFX). Listen to the WAV.
5. Run the panel for it (MUSIC-PANEL.md, How to re-run) and record the verdicts before it ships.
