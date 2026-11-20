<!-- SPDX-License-Identifier: Apache-2.0 -->
<!-- Copyright 2026 alvations (Melon Lab) -->

# Music panel (O-8): which styles ship, and the defaults

The owner asked the panel to decide the music with the music director and the producer. Nobody on this panel can
listen, so every verdict below rests on **measurements of the rendered audio and of the written notes**, read
against what each persona needs. The owner is the final gate and can reverse any decision here.

## Method

1. Each style is rendered offline through the game's own synth (`tools/render-music.cjs`: OfflineAudioContext in
   headless Chromium, one full pass, 44.1 kHz stereo, WAVs written to the temp dir).
2. Measured from the audio: integrated loudness (BS.1770 K-weighted, gated, LUFS), sample peak, crest factor (peak
   over RMS: how much the hits jump out of the bed), spectral centroid (brightness).
3. Measured from the notes (`tools/music-measure.cjs`): tempo, declared key and the key a Krumhansl pitch-class
   profile hears, lead notes per second, all pitched notes per second, drum hits per second, **repetition** (share of
   bars that exactly repeat an earlier bar), **pass 2 change** (share of bars the odd pass changes), lead range.
4. Each persona states the measures that matter to them, with a threshold, then a verdict per style.
5. Decisions take a majority, with a dissent recorded; anything a persona flags as a hard problem is fixed and
   re-measured before the vote.

## The measures (after the fixes below)

| Style | Tempo | Key (declared / heard) | Pass s | Lead notes/s | Notes/s | Drums/s | Repeat | Pass 2 change | Lead range | Centroid Hz | Crest dB |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Chill | 84, swing .2 | F major / F major | 114 | 1.16 | 5.0 | 3.9 | 0.20 | 0.80 | F4-A5 | 679 | 15.1 |
| Drift | 66 | A lydian / B major * | 87 | 0.52 | 3.0 | 0 | 0.13 | 0.67 | B4-C#6 | 340 | 10.8 |
| Pocket | 116, swing .1 | D major / D major | 91 | 2.05 | 6.5 | 5.5 | 0.36 | 0.55 | A4-E6 | 2548 | 14.6 |
| Quest | 132 | Bb major / Bb major | 80 | 1.65 | 5.7 | 4.3 | 0.18 | 0.36 | Bb4-Eb6 | 1548 | 14.4 |
| Blocks | 150 | G harmonic minor / G minor | 83 | 3.37 | 14.1 | 5.3 | 0.44 | 0.46 | D4-C6 | 3106 | 15.8 |
| Pulse | 124 | A minor / A minor | 108 | 1.51 | 10.7 | 7.7 | 0.59 | 0.29 | B4-E6 | 1696 | 17.2 |
| Epic | 88 | D minor / D minor | 98 | 0.92 | 3.3 | 2.8 | 0.06 | 0.44 | D4-F5 | 684 | 15.1 |

\* Lydian has no key profile of its own; it reads as a major key built on one of its own notes, as expected.
All seven: integrated -20.0 +- 0.1 LUFS at unity (spread 0.16 LU), peak <= -4.9 dBFS, no clipping
(MUSIC.md, Levels). Shipped at default sliders: about -62 LUFS, loudest peak 7.5 dB under the `merge` SFX.

## Fixes made from the first read (before the vote)

| Found | By | Fix | Re-measured |
|---|---|---|---|
| Blocks' last section went an octave up: lead top A6 (1760 Hz) on a square wave | retired player (high square fatigue), commuter (headphones) | the section stays in the home octave, with the harmony duet instead | top C6; a test now caps every pitched note at F#6 |
| Chill's odd-pass variation went up an octave (top F6+, MIDI 91) | the same range rule, caught by the test | the variation changes the arp instead | top A5 |
| Pulse's kick: crest 18.0 dB, the highest; at low volume on headphones the kick is all that is left | commuter | kick 0.8 -> 0.62, level re-matched | crest 17.2 dB |
| Styles unmatched: 4.8 LU apart, Chill, Quest and Epic clipped | craft reviewer | per-style `level` from the raw render | 0.16 LU apart, no clipping |
| Three of our own lines matched the interval shape of well-known openings (a derived harmony in Epic, Pulse's hook, a run in Pocket) | chiptune fan's "it must sound like the genre, not like a tune" rule, the originality guard | each line rewritten | the guard passes on every lead and harmony line, both passes |

## Verdicts

### Mia, 10, casual player (tablet speaker, plays in short bursts)
Needs: a tune she can hum (repeat 0.3 to 0.6), some pace (100+ bpm), bright enough for a small speaker (centroid
1.5 kHz+); a small speaker cannot play much under 150 Hz, so the bass must be in the low mids.
- Pocket: "the happy one." Repeat 0.36, 116 bpm, 2.5 kHz bright, triangle bass from D3 up. Ship.
- Blocks: fastest (150) and busiest (14 notes/s), a hook that comes back (0.44). Ship; perfect for Seven.
- Pulse: most repeated (0.59) so it sticks; the drop after the build is the "big moment". Ship.
- Quest: marching, 132 bpm. Ship.
- Chill, Drift, Epic: "slow", centroids under 700 Hz, so they will sound dull on her speaker. Fine for the puzzles she
  does not play much. Ship.
- Defaults: Music **on**. "Games have music."

### Dev, 35, commuter (phone, earbuds, low volume, often switches apps)
Needs: no surprise peaks in the ears (crest under about 16 dB, nothing jumping out), every style at the same loudness
(spread 1 LU or less) so changing game never blasts, not tiring at length (centroid under 3 kHz, repetition under
0.6), the music stops when he switches apps, and the SFX stay on top.
- Spread 0.16 LU: passes. Hidden-tab pause: tested (fades in 120 ms, suspends). SFX headroom 7.5 dB: passes.
- Pulse: crest 17.2 dB is still the highest, even after the kick fix; acceptable for short Four matches, not as a
  default anywhere long. Ship.
- Blocks: centroid 3.1 kHz, the brightest; borderline for earbuds over a long session. Seven rounds are short. Ship.
- Chill and Drift: crest 15.1 and 10.8, dark and even; the best for a long Two run on the train. Ship.
- Concern (hard): at default sliders the music is about -62 LUFS because the SFX are quiet (merge -39 dBFS). "At low
  volume I will hear nothing." Not a music problem: the SFX lift in MUSIC.md (new gains, SCALE 0.07 with it) puts it
  near -49 LUFS. Votes **on**, conditional on that lift landing.

### Rosa, 68, retired player (laptop speakers or a tablet; hearing above about 4 kHz is weaker)
Needs: calm for the thinking games (60 to 90 bpm, under about 6 notes/s), nothing shrill (no high square leads),
melody in the range she hears best (under about 1.5 kHz), and no sudden sound when she starts a puzzle.
- Drift: 66 bpm, 3 notes/s, no drums, sine bells, centroid 340 Hz. "Exactly right for Sudoku." Ship; default for
  Sudoku and Six.
- Chill: 84 bpm, warm, 5 notes/s. Ship.
- Epic: slow (88) and sparse (3.3 notes/s) but big drums. Fine for Five and Nine. Ship.
- Blocks: she flagged the A6 square top; fixed (top C6). Still "busy". Ship, for Seven only.
- Pocket, Quest, Pulse: "not for me, but I will not play them with music." Ship.
- Defaults: she votes Music **off** for a first visit: "a tune I did not ask for, the first time I tap, is a fright."
  Her conditions if the panel goes the other way: a slow fade-in, quiet, calm styles on the calm games, and the Music
  switch easy to find. All four are adopted (2.5 s fade from silence, -62 LUFS today and about -49 after the SFX lift,
  Drift and Chill on Sudoku, Six and Two, Music right under Sound in Settings).

### Kai, chiptune fan (headphones, knows the hardware sounds)
Needs: the chip styles must use the chip palette: pulse leads at the classic duty widths (12.5, 25, 50 %), a triangle
bass, noise drums, arpeggiated or stabbed chords, little or no reverb; and they must sound like the genre, not like a
tune he knows.
- Blocks: 50 % square lead, 25 % pulse duet in thirds, triangle oom-pah bass, pulse chord stabs on the off-beats, chip
  kit, reverb send .08. Harmonic minor gives the folk-dance colour (the raised seventh). "Right genre, nobody's tune."
  Ship.
- Pocket: 25 % pulse lead with a 12.5 % pulse harmony, triangle bass and arp, chip kit, short echo, light swing.
  "Town music, yes." Ship.
- Quest: square and 25 % pulse, triangle bass, march snare; the soft triangle pad is not strictly chip, but it suits
  an overworld. Ship.
- Wants later (not blocking): vibrato on held lead notes, and a noise "tom" in Blocks' fills.
- Originality: asked for proof, not a promise. The test guard (interval shapes of well-known openings, numbers only)
  caught three of our lines; all rewritten.
- Defaults: Music **on**.

### The craft reviewer (docs/reviews/PERSONAS.md brief 3: the felt experience across the family)
Needs: one family sound (every style at one level, the same fades, the same quiet), nothing that fights the SFX,
motion-like care for audio (fades, no clicks, no bunching after a stall), and copy in the house voice.
- Levels 0.16 LU apart; crossfade 2.0 s; start fade 2.5 s; stop 0.8 s; duck 35 % under end cards; hidden-tab pause;
  late events skipped, never bunched. Passes.
- The music never quantises or delays an SFX; SFX key-follow (`numberics:music`) is proposed so merges sit in key.
- Blurbs are plain and short, one sentence, no reference to any other work. Names are one word each.
- Pulse repetition 0.59 is the highest; pass 2 changes only 29 % of its bars. Acceptable for a style that loops by
  design (club music repeats); keep it to Four's short matches.
- Every style ships; the Settings list order goes calm to loud: Chill, Drift, Pocket, Quest, Blocks, Pulse, Epic.
- Defaults: Music **on**, matching the O-6 decision "sound on by default (silent until the first tap)".

## Decisions

1. **All seven styles ship**: Chill, Drift, Pocket, Quest, Blocks, Pulse, Epic. No style failed a hard measure after
   the fixes; each is the clear best for at least one persona and one game.
2. **Music is ON for a first visit** (vote 4 to 1, Rosa against). Reasons: the owner asked for music like melon-eight,
   where it plays; browsers keep it silent until the first tap anyway; it fades in from silence over 2.5 s at a
   level 7.5 dB under the SFX peaks; the calm games default to the calm styles; one tap turns it off. The dissent's
   four conditions are all met. Condition from Dev: the SFX lift (MUSIC.md, SFX notes) lands with SCALE 0.07, so the
   music is audible at defaults. The owner can flip this default in one line (`DEF.music` in `shared/music.js` and
   `settings.js`).
3. **Music volume defaults to 50 %**, its own slider, separate from the SFX Volume. **Style defaults to "Auto (per
   game)"**.
4. **The per-game map** (Auto):

| Game | Style | Who argued for it |
|---|---|---|
| Two | Chill | Dev (long runs on the train), Rosa (calm), craft (the flagship sets the family tone) |
| Fibonacci | Quest | Mia, craft (a spiral that keeps going: the journey) |
| Three | Pocket | Mia (bright, rainbow flushes) |
| Four | Pulse | Mia, Kai; Dev agreed because matches are short |
| Five | Epic | Rosa (sparse), craft (stack and burst: the build-up) |
| Six | Drift | Rosa (a thinking puzzle, no beat to rush you) |
| Seven | Blocks | Kai, Mia (discs fall into a well: the falling-block dance) |
| Nine | Epic | craft (a duel of heaps: weight and tension) |
| Fifteen | Pocket | Mia (a light, friendly duel) |
| Sudoku | Drift | Rosa, Dev (long sessions, no drums) |

5. **Sound and Music are separate switches.** Sound stays the SFX (and its label "Soft clicks and chimes"); Music has
   its own switch, volume and style. Someone who wants silence turns off both; someone who wants only feedback keeps
   Sound.
6. **End cards duck the music** (35 %); a new game restores it.

## How to re-run

```bash
node tests/test-music.js                                          # data, notation, range, key, originality, API
NODE_PATH=$(npm root -g) node tools/render-music.cjs out --json out/report.json
```
Then for each persona re-read their thresholds above against the new report, write the verdicts, and record any
change of decision here with its reason. A new style needs a verdict from all five before it ships.
