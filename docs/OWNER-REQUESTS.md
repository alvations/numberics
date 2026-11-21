<!-- SPDX-License-Identifier: Apache-2.0 -->
<!-- Copyright 2026 alvations (Melon Lab) -->

# Owner requests

Every visible design change must trace to a line here (CLAUDE.md: no design change that was not asked for).

| Id | Date | Ask (owner's intent) | Status |
|---|---|---|---|
| O-1 | 14 Nov 2026 | Infinite 2048 with power-ups, built on melon-eight's learnings. | Done (Endless) |
| O-2 | 16 Nov 2026 | Sudoku; screenshots for every game; plan Fibonacci, Seven, Three, Four, Five, Six. | Done |
| O-3 | 16 Nov 2026 | Power-ups for every game; designer decides the number twists; Five without fingers; Six design. | Done |
| O-4 | 16 Nov 2026 | Add tic-tac-toe (Fifteen) and Nim to nine (Nine). | Done |
| O-5 | 20 Nov 2026 | Build all games, fan out agents, iterate QA/QC like melon-eight; deploy to GitHub Pages. | Done (live) |
| O-6 | 20 Nov 2026 | Endless is not really endless: rename it **Two**. A creative designer and UI/UX iterate on the site to make it attractive to casual players of all ages; tiles must move (no "blipping"), modelled on how the original 2048 and other games animate; settings, achievements, replay value and secret achievements like melon-eight; iterate the review panel; every cycle passes QA, QC and perf tests. Autonomous. | In progress (`docs/design/REDESIGN.md`) |
| O-7 | 20 Nov 2026 | Order every games list "in increasing order": Fibonacci, Two, Three, Four, Five, Six, Seven, Nine, Fifteen, Sudoku. Two is the default game on the landing page (the root opens Two). The order is the owner's proposal: put it through the review panels each cycle and change it if their evidence supports a better one (record why); the owner stays the final gate. | In progress |

Decisions taken for O-6 under "iterate autonomously" (each goes to the review panel; the owner can reverse any):
sound and vibration on by default (silent until the first tap, volume 50%); first-time players start Sudoku, Four, Five
and Fifteen on Easy (saved choices kept); the new Daily Sudoku ramps Easy Mon-Thu, Medium Fri-Sat, Hard Sun.
| O-8 | 20 Nov 2026 | Background music (BGM) and SFX like melon-eight (procedural Web Audio), with selectable BGM styles: chill, epic, EDM, and styles evoking classic falling-block, monster-collecting and adventure games; decided with the panel, a music director and a producer. All music original (no copied melodies or names of other games in the product). | In progress |
| O-9 | 21 Nov 2026 | "The landing page is weird, we should just have the games and then Two has it's own page like the rest fix that on the beta." The root becomes the games list only (the side panel's Today card and game cards, nothing else); Two moves to `two/` with its own page like every other game. Beta first. Supersedes O-7's "the root opens Two". | In progress |
| O-10 | 21 Nov 2026 | "Check that the BGM and SFX is working properly also the 'Style' in settings is ambiguous call it 'Music Style'." Settings label renamed to "Music style" (sentence case like its neighbour "Music volume"); BGM and SFX verified in a real browser on every game. | In progress |

Decisions from review round 4 (docs/reviews/TRIAGE4.md), each reversible by the owner: music stays ON at first visit
(panel vote 4-1) with a one-tap mute in the top bar; the default theme follows the device; trophies show not-yet-earned
non-secret goals (secrets stay hidden); the daily streak is always visible; the page weight budget stays 250 KB per game
(lazy music budgeted separately) with less work per move; the games order stays as the owner proposed (evidence split).
