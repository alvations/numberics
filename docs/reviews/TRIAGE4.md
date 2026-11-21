<!-- SPDX-License-Identifier: Apache-2.0 -->
<!-- Copyright 2026 alvations (Melon Lab) -->

# Triage, round 4 (redesign cycle 1)

Inputs: `REVIEW4.md` (critic 7.5, ship after listed fixes), `REVIEW_GAMEPLAY4.md` (mechanics 7.2),
`REVIEW_AESTHETIC4.md` (craft 7), `REVIEW_COLD4.md` (first-timer 7), `REVIEW_AGES4.md` (all-ages panel 6-8).
Rules R1-R17 hold. Every finding is fixed unless listed under won't-fix.

## Blockers
- **B1 Memory on Sudoku** (critic): Load and Erase must survive any page's own pagehide save. Fix in shared/settings.js
  (suppress game saves during a Memory reload, e.g. a session flag every game's save path honours via
  NumbericsKit.store, or write after the page is torn down); test Load and Erase on every game page.
- **B2 The merge "blip"** (craft): the merged tile must be invisible until the slide ends, then pop (the original 2048:
  the merged tile's pop animation has a delay with backwards fill so it starts at scale 0). Fix once in shared/motion.js;
  Two, Fibonacci, Three inherit; frame-by-frame browser test (no merged tile visible before slide end).
- **B3 Larger text at 320 px scrolls sideways** on every page (craft): fix the top bar and boards; test all pages at
  320 and 375 with Larger text, no sideways scroll, top-bar buttons stay 44x44.

## Decisions (with evidence)
- **D1 Game order: keep the owner's** (O-7). All-ages panel: the youngest noticed the counting and liked it, nobody
  wanted vs-computer grouping. The cold first-timer found it arbitrary. Evidence is split, so the owner's proposal
  stands. Small helps: the Fibonacci preview starts 1 1 2 3; Today chips say "Daily".
- **D2 Music stays on at first visit (panel vote 4-1), plus a one-tap mute** in the top bar (speaker icon, toggles Sound
  and Music together, remembers). Recorded in OWNER-REQUESTS (critic S4). The settings icon becomes a gear (not a sun).
- **D3 Trophies show goals** (all-ages, cold, mechanics): the sheet lists earned trophies first, then every NOT-yet-earned
  non-secret trophy dimmed with its description; secrets stay invisible until earned; a count of earned / visible
  (non-secret) trophies is shown. This changes the melon-eight "earned only" choice on panel evidence.
- **D4 Streak is visible**: the Today card always shows the daily streak (and "Start a streak today" at 0).
- **D5 Default theme follows the device** (light device -> Light), all-ages panel; dark stays the identity on dark devices.
- **D6 Page weight budget stays 250 KB** (critic S1): the spec's 110-140 KB assumed fewer shared modules; with no build
  step the shared modules are hand-written and lazy music is budgeted separately. Recorded in tools/perf-budgets.json
  "why" and OWNER-REQUESTS. Reduce work per move instead: batch the three localStorage writes to one idle write.
- **D7 One sound rule under fast play** (critic S2): when a new input finishes a running animation, its pending sounds
  play at once (deduplicated by name, at most one of each), never dropped and never late. Shared helper; every game.
- **D8 One shared how-to** (critic S5): `NumbericsUI.howto(gameId, steps)` with a consistent title "How to play <Game>",
  a Play button, first-visit rule, and the "Show the three steps" row label; all ten games migrate.
- **D9 Dailies are finished honestly** (critic S3, mechanics #4): a Daily counts as finished only when it is really
  completed (Six: all six lines made, Show answer lines do not count); Seven's Daily locks after one run like Sudoku's;
  the chip shows the day's best; Sudoku's Daily shows its level on the chip and the page.
- **D10 Six's Show answer** is styled neutral with its confirm, not loud red (all-ages, craft).

## Per game (also fix every other finding for your game in the five reviews)
- **Three**: the flush shows the real board quickly (total under 500 ms, no idle pause, the spawned tile visible as soon as
  the run clears; input during it acts on what is shown, mechanics #2/#3, craft #5); a clear end card when the run is
  over (cold); explain "Third" and the rainbow flush in play.
- **Five**: R2 hole: a round won after the player's Undo pays nothing (mechanics #6, property test); the fly/burst polish
  (craft #3: no "+1" over the target, no empty frame, visible shards); two score pairs read as one (cold).
- **Fifteen**: draws recorded in the record; verify Hard is winnable with the after-draw Erase (mechanics #5) and say so
  in the how-to; the Numbers to Grid switch moves tiles without squashing digits and staggered (craft #4); earned
  power-ups between matches explained; tiny labels at least 12 px.
- **Seven**: Daily lock (D9); explain eggs in NEXT; chain toast must not cover the level line.
- **Four**: Easy lets the centre vertical four through too easily: make Easy block an immediate vertical four.
- **Fibonacci**: subtitle plain ("Join neighbours in the Fibonacci run"); how-to picture 1 reads as a slide.
- **Nine**: Learn's first line stays plain; Medium keeps a little randomness (mechanics #7: measure, keep Easy > Medium > Hard).
- **Two**: focus ring on the board; "+N" sits above the SCORE label.
- **Sudoku**: number pad keys at least 44 px wide; stat labels at least 12 px; trophy toast never covers the level row.
- **Family**: end cards fade in with the game glyph, pills never clipped (craft #6, cold #3); labels at least 12 px;
  "Numberics ·" subtitle link removed (the top bar mark links home); one label for the games heading and the how-to
  button; Light theme: the 1 and 2 tiles visible on cream; Night owl is not awarded on page load; Load asks to confirm
  and says when a file is not a save; the Today label rolls over at midnight; docs that state false things fixed
  (CLAUDE.md "not built" list, REDESIGN 7.2/7.3).

## Won't-fix (with reasons)
- Five is solved and the computer opens from the losing seat (mechanics #1): rule R4 (perfect play can always win; the
  computer punishes mistakes) is the deliberate design since round 1.
- Nine Easy/Medium always deal a winning start: R4 by design; Hard deals at random.
- Seven's chains feel lucky to a random tapper: the Drop7 design; skill shows in scores over time.
