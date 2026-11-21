<!-- SPDX-License-Identifier: Apache-2.0 -->
<!-- Copyright 2026 alvations (Melon Lab) -->

# Review cycle 1: notes from integration (21 Nov 2026)

Open questions and judgement calls left for the panel (QA, QC, craft, perf) after the integration pass that followed
the shared modules (B1 to B4), the root (C1) and the ten per-game packages (D). Each item says what was found, what was
done (if anything) and what the panel should decide. Nothing here changed a rule or a tuning number.

## Fixed in integration (defects, each with a test)

| # | Found | Cause | Fix | Guard |
|---|---|---|---|---|
| I-1 | Three: keys did nothing right after the first-visit how-to closed (storage blocked, reduced motion, trophies: 4 browser failures) | The how-to opens by itself, so its opener is the body, which cannot take focus back: focus stayed on the hidden Play button, and the closed sheet's own keydown guard kept the next key from the game until the browser's next frame | `shared/ui.js`: the sheet's guard acts only while that sheet is the open one; on close, focus left inside the hidden sheet is released at once | `tests/emu/three.cjs` "Play: focus leaves the closed sheet at once" (fails on the old ui.js) |
| I-2 | Root emu: "the games row at the foot" (8 failures) | Stale test: every game page now uses the cards (REDESIGN.md 3.2) | Test checks the cards' order and the one current card on every page | `tests/emu/root.cjs` |
| I-3 | Seven still had the old text row at its foot | D-Seven did not swap in the cards (3.2 says the text row is removed) | `seven/index.html` uses `class="cards"`, with the row's old 10 px gap; Seven's blitz pip check now targets `#pips` (the Nine card preview has pips too) | root emu (cards on every page) |
| I-4 | One 100 to 150 ms long task about 100 ms after the first tap, every game, 4x CPU | `shared/music.js` building its buffers (260 000 seeded samples) and the browser preparing a 2.2 s convolver kernel, all in one task | Built in slices, the reverb as four delayed parts with the whole impulse's normalisation, the first player in its own task (docs/design/MUSIC.md, Performance). Same samples, same impulse response within 0.1 % | `tests/test-music.js` (identical samples), `tests/emu/shared-music.cjs` (impulse response) |
| I-5 | Many trophy pills pushed the end card's title and buttons outside the board | No shared rule (only Sudoku's `#win` had one) | `shared/theme.css` and root `style.css`: the pill row scrolls inside the card; a row that fits is unchanged (min height = one pill) | `tests/emu/shared-trophies.cjs` section 9, every game at 375 and 320 |
| I-6 | `report(..., {quiet:true})` left the cup's unseen dot off | `announce()` was the only place that set it | `report()` sets the dot whenever something is earned; Fifteen's own call after its quiet report removed (Four, Five and Sudoku keep theirs, at the card's moment) | `tests/emu/shared-trophies.cjs` section 8 |
| I-7 | Night owl (and High five, The whole set) toasted over the hint line mid-move | Family trophies fire on any event, so on a move | Family trophies earned mid-play wait for an idle moment: 1.6 s with no key or tap, no sheet, card or other toast up, tab visible. The game's own trophies keep their moment; end, round, match, solve and saved events are unchanged | `tests/emu/shared-trophies.cjs` section 8 |
| I-8 | Four and Nine: the last stat pill wrapped alone at 375 and 390 px on a fresh start ("none" values) | Four pills plus gaps were 369 px in a 343 to 358 px row | `shared/theme.css`: rows of four pills, 361 to 420 px only, side padding 12 to 8 px and gap 8 to 6 px | `tests/emu/root.cjs` "stat pills sit on one row", every game at 375 and 390 |
| I-9 | The Nine card's preview dots had rings on Five, Six and Seven pages, and were squeezed on Seven | Those games' own `.pips` / `.pips i` rules reached the shared preview | `.pv .pips i{border:0}` and `.pv .pips{min-height:auto}` in theme.css, root style.css and sudoku/style.css | `tests/emu/root.cjs` "card previews look as on the root page" |
| I-10 | shared-settings and root emu skipped a first-visit sheet only when it was `#help` (gone) | Stale guard | Close whichever sheet is open, generically, after two frames | both emu files |
| I-11 | Five emu "music ducks" failed once in a full run | Race in the test: its spy on the music stub was lost when the lazy loader swapped in the real module after a tap | The spy wraps whatever object becomes `NumbericsMusic` (a setter), and the real duck still runs | `tests/emu/five.cjs` |
| I-12 | Perf gate: root (Two) desktop load CLS 0.057 > 0.05, every run | The Today card is in the markup empty and drawn by nav.js after the first paint, pushing the heading and lede down 116 px | root `style.css`: `#today.today:empty{min-height:146px}` (its drawn height); measured 0.017 after, perf PASS | `tests/emu/root.cjs` "desktop root: load layout shift under 0.05" |
| I-13 | Fifteen: a white dot in the board's top-left corner (both screenshots) | The win line is an `<svg>`, which has no `hidden` property: `wl.hidden = true` set a plain JS field, so the zero-length round-capped line always drew, and was never hidden after a win | `fifteen/index.html` starts it `hidden`; `fifteen/game.js` sets and removes the attribute | `tests/emu/fifteen.cjs`: hidden on a fresh board; the Grid-win check now tests real visibility |

## For the panel

1. **SPDX and Copyright comment lines.** Docs carry two comment lines (`SPDX-License-Identifier: Apache-2.0`, then
   `Copyright 2026 alvations (Melon Lab)`); pages and code carry one (`SPDX ... | Copyright ...`). 21 of 33 page and doc
   headers have the SPDX line without the copyright on the same line (the copyright is the next line). Both pass the
   convention test. Panel: keep both forms, or settle on one (a mechanical change, no visible effect)?
2. **Space above the games cards at the page foot** is not one value: 0 px under the How to play row on Five, Six,
   Nine and Fifteen (the cards touch the row's panel), 10 px Seven, 18 px Sudoku, 22 px Four; Fibonacci and Three put a
   "More number games" / "Ten number games" heading over them. Not changed here (design). Panel: one treatment for all.
3. **I-8 is a visible change** on Four and Nine between 361 and 420 px (a little less padding in the four pills). It
   fixes a layout regression at 375 (REDESIGN.md 11, A1 acceptance), but the panel should confirm the look.
4. **I-7 idle delay** is 1.6 s with no input. Tune if it reads late; a player who never pauses sees the toast at the
   next pause after the game (the trophy is saved and the cup's dot shows at once either way).
5. **The cup dot after a quiet report** now shows at the report (I-6). On Four the report is at the end of the move,
   during the short hold before the card, so the dot can appear a moment before the card. Panel: fine, or hold it?
6. **The first tap is still one 55 to 60 ms task on Two and Three at 4x CPU**: the browser's own `new AudioContext()`
   (about 25 ms, must run inside the gesture for iOS) plus the game's first move (25 to 50 ms, first-run compile of the
   move path). Within the play budget (200 ms phone). Further cuts would mean moving game work out of the input handler,
   which the input-to-visual budget forbids.
7. **Sudoku's copied CSS** gives the Five and Six card previews a one-pixel shorter line (its own body line-height).
   Kept: Sudoku keeps its own CSS by rule. Panel: copy the preview line-height into sudoku/style.css?
8. **No shared how-to helper**: each game builds its own three-step sheet (the TODO list). Not a blocker; consider
   consolidating after the cycle.
9. **Relaxed emu frame thresholds** (idle x1.3 and similar) were set under machine load. The integration run on a quiet
   machine is green with them; re-tightening each is left to the perf reviewer with the numbers from that run.
10. **One flake seen once under load**: shared-settings "the close button is at least 44 x 44" failed in one full run
    while another job shared the machine, then passed alone and in the next full run. The sheet's open animation is
    translate only, so the cause is not found; QA should watch for it.
11. **shared-motion p95 at 4x CPU** read 33.3 ms against 33 under load earlier; see the perf table of this cycle's
    run for the quiet-machine value.
