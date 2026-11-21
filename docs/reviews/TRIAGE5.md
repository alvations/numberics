<!-- SPDX-License-Identifier: Apache-2.0 -->
<!-- Copyright 2026 alvations (Melon Lab) -->

# Triage, round 5 (redesign cycle 2)

Inputs: `REVIEW5.md` (critic 8, ship the beta, 0 blockers), `REVIEW_GAMEPLAY5.md` (mechanics 7.8),
`REVIEW_AESTHETIC5.md` (craft, 1 high, 13 medium), `REVIEW_COLD5.md` (first-timer 7.5, 1 blocker),
`REVIEW_AGES5.md` (all-ages 6-8). Owner asks since round 4: O-9 games page, O-10 sound, O-11 Fifteen labels and no
win line, O-12 Two tiers (in progress), O-13 the same tiers for Three and Fibonacci, then tier trophies.
Every finding below is fixed unless listed under won't-fix. Every visible change cites the reviewers who asked for it
(CLAUDE.md: no design change the owner or a panel read did not ask for).

## Blockers
- **B1 Sudoku: a row with no clues collapses to about 12 px** (cold #1). Today's shared Daily has an empty row. Rows
  must be equal height whatever their content; test with a puzzle that has an empty row at 390 and 320.

## Fixed already (this round)
- **Deploy workflow** (critic S1): every root file is published; a failing beta keeps the live beta; the publish
  message names each branch's own commit; `tests/test-deploy.js` runs the workflow's real assemble step. Same file on
  main and build/v2.

## Should-fix
### Family (shared)
- **S1 Toasts print over the status line** (craft #12 high) and **float above open sheets** (craft #14): a toast never
  overlaps the hint line's text and never shows while a sheet is open (it waits or drops). Test on Two, Six, Five.
- **S2 No music on the games page** (all-ages: measured 2-5 s fragments cut off by every card tap; critic S2: 48 KB
  loaded by a tap that navigates away). The games page keeps its tap and trophy sounds; music starts on game pages
  only. Reversible by the owner.
- **S3 The Games button on the games page** opens a copy of the page behind it (craft #1, all-ages): on the root it
  scrolls to the cards instead of opening the sheet (the button stays, same look).
- **S4 Settings sheet**: the title and Close stay reachable after Larger text (all-ages; keep the header pinned);
  "Sure? Erase everything" fits at 390 (craft #25); each Music style shows its one-line description under the row
  for the chosen style, readable on touch (all-ages, craft #26), and picking one gives a visible "Now playing" line.
- **S5 Today card** shows Daily Six progress after a solved line ("2 of 6" rather than "Not yet") (cold #4).
- **S6 Reward wording** is one pattern in every game's toast: "+1 Peek" (craft #8). Score pills keep each game's own
  format (round games read "won-lost").
- **S7 Stale docs from O-9/O-10** (critic S3): REDESIGN.md, MUSIC.md ("Music style"), NEW-GAME.md, the comments in
  two/style.css and home.css, O-7's "the root opens Two" marked superseded.
- **S8 Tests that can pass vacuously** (critic S4): shared-audible's card navigation must fail without the card; its
  `pathOf` must not fall back to the root for Two; Three's frame check counts SKIP like Four's under load.

### Rules (mechanics, measured)
- **S9 One Undo rule for the round games** (mechanics #2): a round won after an Undo pays no reward, in Nine and
  Fifteen as in Five. Measured: removes the Undo-to-reward conversion; win rates barely move.
- **S10 Fifteen Hard**: the after-draw Erase comes once per match (mechanics #3). Measured: perfect play still wins
  400/400 on Hard; the skilled sensible player drops from 48% to 23.5% (Medium 50%).
- **S11 Nine needs a middle step** (mechanics #4): tune the slips so Easy / Medium / Hard read beginner / learning /
  expert for the learner bots; keep perfect play winning every Easy and Medium match. Report the new table.
- **S12 Five's Undo button says it forfeits the rest of the round's rewards** before you use it (mechanics #7).

### Per game
- **S13 Seven: a stale second tab can replay today's Daily and lower saved bests** (mechanics #1, data loss): reload
  the saved run before a Daily drop and on visibility; every best is max(stored, current).
- **S14 Seven: no "Play Classic" button under the board during a Daily** (all-ages).
- **S15 Sudoku: changing difficulty during the Daily asks "Sure?"** and says the Daily is kept (cold #3); the Solved
  card gets the family card edge so digits do not show through (craft #9); the number pad counts are labelled for
  screen readers and say what they count (cold #11).
- **S16 Contrast**: Five's "YOU" label (craft #16, cold #9, all-ages: about 1:1, unchanged in High contrast) and Six's
  solved "= 6" (craft #15, cold #9) reach 4.5:1 in every theme; Five's "computer" label grows with Larger text.
- **S17 Five's round summary** lists each power-up once with a count ("earned 2 Split") (cold #7).
- **S18 Nine**: a tapped heap presets Take 1, not the whole heap (cold #2); the RECORD and BEST boxes say what they
  count (cold #10); the card art's third row of dots sits inside its tile (craft #2).
- **S19 Six**: no "(Enter)" keyboard hint on touch screens (craft #31).
- **S20 Two and Fibonacci "+N" score pop** stays inside the Score box (craft #13, cold #8). Done with the O-12/O-13 tier
  work so two/ and fibonacci/ are edited once.

## Won't-fix (with the reason)
- **Game order** (all-ages: Sudoku below the fold, two players expected it first): evidence, not a change; the owner's
  order stands (O-7) and is reported to the owner again.
- **Header layout differs by subtitle length** (craft #7): each game's header is the owner-approved round-3 design;
  no reviewer showed it hurts play.
- **Trophy total grows when a secret is found** (craft #29): by design (TRIAGE4 D3, secrets stay hidden).
- **Misère trophy wording** (craft #30): Misère is a Nine mode reached from its How to play; the craft reviewer did not
  open it. Copy stays.
- **Nine keeps power-ups across matches while Five and Fifteen reset** (mechanics #8): Nine's matches are short and
  its stock is small; reported to the owner as a possible family rule, not changed.
- **Four Hard close to Medium** (mechanics #5), **Nine Misère harder** (#6), **Seven Undo look-ahead** (#9),
  **Sudoku clash-free filler** (#10), **Six sign cycling** (#11): low, fair, not farmable; recorded.
- **Disc drops without a visible fall in Four and Seven** (craft #21), **cream tiles bright in Dark** (craft #19),
  **music quiet at default** (craft #28, O-10 sound check): taste calls reported to the owner, not changed.
- **Card blurbs assume adult knowledge** (all-ages): copy is owner-approved; reported.
