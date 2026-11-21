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
| O-7 | 20 Nov 2026 | Order every games list "in increasing order": Fibonacci, Two, Three, Four, Five, Six, Seven, Nine, Fifteen, Sudoku. Two is the default game on the landing page (the root opens Two). The order is the owner's proposal: put it through the review panels each cycle and change it if their evidence supports a better one (record why); the owner stays the final gate. | Order: in progress. "The root opens Two": superseded by O-9 (the root is the games page; Two plays at `two/`) |

Decisions taken for O-6 under "iterate autonomously" (each goes to the review panel; the owner can reverse any):
sound and vibration on by default (silent until the first tap, volume 50%); first-time players start Sudoku, Four, Five
and Fifteen on Easy (saved choices kept); the new Daily Sudoku ramps Easy Mon-Thu, Medium Fri-Sat, Hard Sun.
| O-8 | 20 Nov 2026 | Background music (BGM) and SFX like melon-eight (procedural Web Audio), with selectable BGM styles: chill, epic, EDM, and styles evoking classic falling-block, monster-collecting and adventure games; decided with the panel, a music director and a producer. All music original (no copied melodies or names of other games in the product). | In progress |
| O-9 | 21 Nov 2026 | "The landing page is weird, we should just have the games and then Two has it's own page like the rest fix that on the beta." The root becomes the games list only (the side panel's Today card and game cards, nothing else); Two moves to `two/` with its own page like every other game. Beta first. Supersedes O-7's "the root opens Two". | In progress |
| O-10 | 21 Nov 2026 | "Check that the BGM and SFX is working properly also the 'Style' in settings is ambiguous call it 'Music Style'." Settings label renamed to "Music style" (sentence case like its neighbour "Music volume"); BGM and SFX verified in a real browser on every game. | In progress |
| O-11 | 21 Nov 2026 | (Said of "Five", meaning Fifteen's Numbers view, which is the game with Numbers and Grid.) "The 'you' and 'computer' word on the numbers ... reading words top down facing the side is weird, fix that, also the numbers are not aligned when it's computer vs 'you', the grid mode is fine. Also the line at the end of the grid mode, that's weird, skip that." Numbers labels now read across, pinned under the number, so every number is level; where "computer" does not fit a pillar at the 12 px floor it reads "cpu". The winning line in Grid view is removed. | Done |
| O-12 | 21 Nov 2026 | "The earn rate of the power-ups for 'Two' is a bit too slow, have the same easy, medium, hard mode, where the hard mode is the current version and then have a medium mode where the power-up is earned more frequently and then an easy mode where the power up is even more frequent but still make it 'earnable', come up with a mechanism to tier the difficulty properly." | In progress |
| O-13 | 21 Nov 2026 | "Make sure we use the same tier earn rate and difficulty level for 'Three' and 'Fibonacci' too, after we've settled the tier power-up earns for 'Two' and then see if we can add something to the trophy if needed, check against the panel and melon-eight replayability principles for the trophy addition for the difficulty level for 'Two', 'Three' and 'Fibonacci'." Order: settle Two (O-12), then the same tiers for Three and Fibonacci, then tier trophies only if the panel and melon-eight's replay principles support them. | Planned |
| O-14 | 21 Nov 2026 | "Make sure we don't overcrowd the space with text and options in the game, esp for small screens like iPhone 12 / 13 mini, it's not helpful." Every game at 375x812 (and 375x667 with Larger text): the board and its controls fit without scrolling, at most one line of hint text, explanations live in How to play. A family density pass with the panel, after the tier work. | Planned |
| O-15 | 21 Nov 2026 | "Make sure it works properly on the iPhone mini all the way up to iPad mini and iPhone 18 Pro Max and also properly on the desktop." A permanent device-matrix browser test for every page, at the area Safari really shows (screen minus browser bars, from the Playwright device list): iPhone 12/13 mini 375x629, the same with Larger text, Pro Max class 440x(about 800), iPad mini 768x1024 portrait and landscape, desktop 1280x800 and 1920x1080: no sideways scroll, board and its controls in view, 44 px targets, nothing cut off. | Planned |
| O-16 | 21 Nov 2026 | "And also Pixel phone, those must be part of our QC and QA tests." Pixel phones join the O-15 device matrix, and the matrix becomes part of every QA/QC round (the panel briefs in PERSONAS.md and the browser gate). | Planned |

Decisions from review round 4 (docs/reviews/TRIAGE4.md), each reversible by the owner: music stays ON at first visit
(panel vote 4-1) with a one-tap mute in the top bar; the default theme follows the device; trophies show not-yet-earned
non-secret goals (secrets stay hidden); the daily streak is always visible; the page weight budget stays 250 KB per game
(lazy music budgeted separately) with less work per move; the games order stays as the owner proposed (evidence split).
