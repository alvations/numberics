<!-- SPDX-License-Identifier: Apache-2.0 -->
<!-- Copyright 2026 alvations (Melon Lab) -->

# The review panel (QA / QC), and how to re-run it

Carried over from melon-eight. Every release of Numberics goes through rounds of this panel: **review ->
fix -> review again**, until the critic's verdict stops moving and no blocker is open. A reviewer is just a fresh
agent given one brief below; nothing to install.

## How to run a round

1. Serve the site: `python3 -m http.server 8070` from the repo root (use 8070+). Player reviewers drive it
   with headless Chromium (Playwright is preinstalled; see `tests/emu/run.cjs` for a launch recipe) on **the device
   matrix** below, and look at what they capture.
2. Spawn the four personas **in parallel**. Each reviews **every live game** in `games.json`.
3. Each writes a numbered file here: `REVIEW<N>.md`, `REVIEW_GAMEPLAY<N>.md`, `REVIEW_AESTHETIC<N>.md`,
   `REVIEW_COLD<N>.md` (N = round), starting with the two SPDX/Copyright comment lines.
4. The lead triages every finding into **blocker / should-fix / won't-fix (with the reason)** in
   `TRIAGE<N>.md`, fix agents work the blockers and should-fixes per game, and the next round starts.
5. House rules for every reviewer: no em-dashes, no AI model identifier, no attribution lines, concrete and
   reproducible findings (game, view, steps, what happened, what was expected).

## The device matrix (O-14, O-15, O-16: part of every QA and QC round)

Every player reviewer and the critic check every page (the games page and every live game) on these devices, using
the Playwright descriptor named (`require("playwright").devices[name]`: its viewport is the area the browser really
shows, with isMobile, hasTouch and deviceScaleFactor), in Chromium:

| Device | Descriptor | CSS px |
|---|---|---|
| iPhone 13 Mini | `iPhone 13 Mini` | 375x629 |
| iPhone 13 Mini, Larger text | `iPhone 13 Mini` + Settings, Larger text | 375x629 |
| iPhone 17 Pro Max (the Pro Max class) | `iPhone 17 Pro Max` | 440x763 |
| Pixel 4 (the narrowest) | `Pixel 4` | 353x745 |
| Pixel 10 | `Pixel 10` | 360x732 |
| Pixel 8 | `Pixel 8` | 412x839 |
| Pixel 10 Pro XL | `Pixel 10 Pro XL` | 448x921 |
| iPad Mini, portrait and landscape | `iPad Mini`, `iPad Mini landscape` | 768x1024, 1024x768 |
| Desktop | viewport only | 1280x800, 1920x1080 |

On each: no sideways scroll; the board and every control needed to play (the tier or mode row, the power-up tray,
Nine's Take bar, Sudoku's tools and number pad, Fifteen's Numbers / Grid) in view without scrolling (New game, How to
play and More number games may sit below); tap targets at least 44 px; no clipped or overlapping text; the hint at
most one line on phones and on screens up to 860 px tall. `tests/emu/devices.cjs` runs exactly these checks on every
device (`NODE_PATH=$(npm root -g) node tests/emu/run.cjs devices`; `DEVICES_SHOTS=<dir>` saves every page on every
device, `DEVICES_LARGE=1` adds Larger text on every device). Reviewers still look: the gate proves fit, not feel.

## The memory rule
- The **critic keeps memory** (reads earlier `REVIEW*.md` and `TRIAGE*.md`) and **reads the code and tests**.
- The **three player reviewers wipe memory**: they do not read earlier reviews or the source. First impressions
  only stay honest if they are first.

## The five briefs

1. **Harsh-impartial critic** (`REVIEW<N>.md`): recurring, harsh but fair. Reads code, tests and prior reviews.
   Situates this pass against prior verdicts, checks every prior finding was really fixed, hunts correctness
   bugs, rule violations (CLAUDE.md), dead code, inconsistency between games, and fragile UI. Quotes
   file:line. Ends with a verdict out of 10 per game and overall.
2. **Mechanics reviewer** (`REVIEW_GAMEPLAY<N>.md`): plays every game a lot (deep and shallow runs, every mode and
   difficulty). Judges only the rules: are they honest, interesting and fair, are the power-ups meaningful or
   broken, is the computer opponent beatable but not trivial, where is it exploitable, boring or unfair.
3. **Craft reviewer** (`REVIEW_AESTHETIC<N>.md`): the felt experience: typography, colour, spacing, motion,
   feedback, copy, consistency across the family (does every game feel like Endless?), phone and desktop.
4. **Cold first-timer** (`REVIEW_COLD<N>.md`): handed only the link, no briefing. Plays like a stranger and writes
   down what actually happened, in order: confusion, delight, where they would quit. Verdict out of 10.
5. **All-ages audience panel** (`REVIEW_AGES<N>.md`): wipes memory like the player reviewers. Plays as four people in
   turn, each on their own device: Maya, 9, tablet (768x1024, touch, reads slowly, wants bright and fun); Sam, 34,
   phone (390x844, one hand, sound off, 3-minute sessions; also the device matrix above); Priya, 52, desktop (1280x860, keyboard, likes puzzles);
   Walter, 71, small phone (375x667, Larger text and High contrast, unsure with gestures). For each: first impression,
   finding a game, How to play, readability, tap targets, motion, settings, replay value (trophies, dailies, streaks)
   and frustrations. Also answers ORDER-BRIEF.md with timings and judges the O-6 defaults. Ends with numbered
   findings and a score out of 10 per age group.
