<!-- SPDX-License-Identifier: Apache-2.0 -->
<!-- Copyright 2026 alvations (Melon Lab) -->

# Review round 3: the harsh but impartial critic

Scope: all ten live games in `games.json`, `shared/`, `tests/`, `tools/`, and the docs, checked against my round-1 and
round-2 reviews (`REVIEW1.md` 7/10, `REVIEW2.md` 7.5/10) and the lead's rules in `TRIAGE1.md` (R1-R11) and `TRIAGE2.md`
(R2 everywhere, R12-R17, won't-fixes).

What I ran (20 Nov 2026, branch `build/games` at `df6ff6c`, working tree clean):
- `node tests/run.js`: 11 files, 495 checks, all green (round 2: 426, round 1: 368).
- `NODE_PATH=$(npm root -g) npm run test:browser`: 68 + 740 checks, all green (round 2: 58 + 567).
- My own Node probes (scripts kept out of the repo): a two-move R2 fuzz for Endless, Fibonacci, Seven and Four (power-up,
  then an unrelated move, then the paying move, against the same moves without the power-up); a capped-stock probe for
  every engine; a ring-aware bot for Four (300 games each on Easy and Medium); a perfect-play-with-power-ups bot for Nine
  Hard (2,000 matches per setting, 300 full runs); a deliberately wrong but clash-free fill for Sudoku (10 puzzles per
  level).
- Playwright against `python3 -m http.server 8089`: every page at 320x568, 390x844 and 1280x860 (sideways scroll, page
  errors), Enter on a focused games-row link in every game, and a 700-action random input fuzz (keys, taps, drags) on
  every game at 390x844.
- `git log`: every commit is authored and committed by the owner; no trailers.
- Note: after my runs, uncommitted edits appeared in the tree from parallel round-3 work (`shared/kit.js`, `shared/theme.css`,
  `style.css`, `sudoku/style.css`, `tests/emulation.cjs`); with them `tests/test.js` fails "R8/F7: darker scrim" (the
  `.over` scrim alpha changed in `style.css` but the test still asks for `.95`). Everything below is about `df6ff6c`; that
  work must be green before it is committed. It also appears to address nit Shared 1 (a toast now clears when the hint changes).

## Situating this pass

Round 2 had one family blocker (F1: R2 held only in the games where it was listed) and nine should-fixes. The lead
answered with the right structural move: R2 everywhere, with a property test in every game, plus five new family rules
(R12-R17). I checked each claim in the code and then tried to break it with my own fuzz rather than the agents' tests.

The result is the best round so far. Every round-2 repro of F1 now pays nothing, in all five games, and each has a test
that would fail on the old code. Enter on a games-row link navigates in all ten games (I pressed it in each one). The
abandon dodge is closed in Four, Five, Fifteen and Nine. The 700-action input fuzz produced no page error in any game,
and no page scrolls sideways at 320px. The Six bracket-drag crash has a regression test.

Three things keep it from a clean sheet, and none is a blocker:

1. **R2 is one move deep, and a dummy move launders it.** This is the line TRIAGE2 drew on purpose ("including the next
   move after it") and I accepted the same line for Three in round 2, so I am not moving the goalposts to a blocker.
   But in Endless and Fibonacci the dummy move is free and deterministic, so the round-2 repro works again with one
   extra keypress, and the in-game copy ("Boosts earn no reward.") is false. The property tests check the flag, not the
   property.
2. **R15 was applied where it was listed (Seven) and in four other games, but not in Endless or Three.** Same pattern as
   round 2's F1, on a smaller rule: DESIGN.md says "A full stock says 'Power-ups full'" family-wide, and two games say
   nothing.
3. **DESIGN.md keeps growing by appending.** I asked in round 2 to replace a stale section, not append to it. Six per-game
   sections now contradict the round summaries below them.

Blockers: **0**. Should-fix: 6. Nits: 12.

---

## Round-2 follow-up

"Fixed" means the code changed and a test would catch a regression. "Fixed, my probe" means I confirmed it beyond the
agents' tests. Rows marked TRIAGE2 are the round-2 family rules checked across every game.

| Round-2 finding | Status | Evidence |
|---|---|---|
| F1 Endless [blocker]: Boost/Swap then swipe pays | Fixed (one move deep) | `engine.js:166,172,205` `state.free`; tests "R2 blocker repro" x2, "R2 property" (`tests/test.js:124-190`). Two-move bypass remains: new S1 |
| F1 Fibonacci [blocker]: Boost 21 to 34 beside 55 pays | Fixed (one move deep) | shared engine; `tests/test-fibonacci.js:176-214`. Same bypass: S1 |
| F1 Seven [blocker]: Smash then drop pays twice | Fixed (one move deep) | `seven/engine.js:235`, Hold and Crack also mark; `tests/test-seven.js:271`. Bypass rare (S1) |
| F1 Four [blocker]: Pop then drop earns "block" | Fixed (one move deep) | `four/engine.js:154`, Pop, Hold and Tune mark the side; `tests/test-four.js:314`. Bypass exists (S1) |
| F1 Nine [blocker]: round won after Add/Pass pays | Fixed | `nine/engine.js:121-135` per side per round (`powered`); `tests/test-nine.js:261`; my probe: no paying powered round |
| Endless 2: level-5 contrast | Won't-fix (TRIAGE2) | accepted: large bold text |
| Sudoku 1: DESIGN.md unit rule stale | **Partly** | the unit section is replaced; but `docs/DESIGN.md:42` still says "hard 26 or fewer" (the repo memory file: exactly 26) and `:44-45` "Reveal is the one way to learn the truth" ignores Check. See S3 |
| Sudoku 2: junk-fill front-loading | **Partly** | clash-free rule shipped; a wrong but clash-free fill still front-loads (new Sudoku 1) |
| Sudoku 3: tray info in the "bad" toast | Fixed | `sudoku/game.js:91` uses `"info"` |
| Sudoku 4: test cites R7 | Fixed | no longer in `tests/test-sudoku.js` |
| Sudoku 5: layout deviation undocumented | Fixed | `docs/DESIGN.md` "Sudoku power-ups" records it |
| Fibonacci 2: engine header vs DESIGN.md | Fixed | `fibonacci/engine.js:11-13` now agrees (merge rule confirmed, spawn odds assumed) |
| Seven 2: Enter on a link drops a disc | Fixed, my probe | `seven/game.js:339`; Playwright: Enter navigates |
| Seven 3: Daily re-deal | Won't-fix (TRIAGE2) | accepted |
| Seven 4: "(Esc cancels)" on phones | Fixed | shown only on a fine pointer |
| Three 1: one-swipe line undocumented | Fixed | `three/engine.js:15-20` states it; DESIGN.md round-2 summary says "Three one swipe deep" |
| Four 2: Enter on a link drops a disc | Fixed, my probe | `four/game.js:258` |
| Four 3: record farmed by abandoning | Fixed | `four/game.js:281-295` R12, "Sure? Counts as a loss"; Undo or Pop does not hide having played (`:280`) |
| Four 4: opener re-roll | Fixed | `four/game.js:289`: the opener alternates only after a counted game |
| Four 5: 3px sideways at 320px | Fixed, my probe | scrollWidth = 320 |
| Five 1: number keys silent on empty slots | Fixed | keys go through the tray slot (`five/game.js:283`) |
| Five 2: abandon dodge | Fixed | `N.played` / `touched`, `five/game.js:299-306` |
| Five 3: Enter on a link swallowed | Fixed, my probe | `five/game.js:276` |
| Five 4: level "Sure?" before you moved; two "Sure?" at once | Fixed | `touched` flag; one armed level at a time |
| Six 1: Daily re-deal, tier-5 size | Won't-fix (TRIAGE2) | accepted; tier 5 still 20 lines (tier 2 has only 17, see nit Six 1) |
| Fifteen 1: Enter on a link swallowed | Fixed, my probe | `fifteen/game.js:295-296` uses `closest()`, the most robust guard in the family |
| Fifteen 2: DESIGN.md omits Fifteen's Peek in R3 list | **Not fixed** | `docs/DESIGN.md:60` still lists Sudoku, Six and Nine only |
| Nine 2: R4 on Hard, copy | Fixed (copy) | `nine/index.html:66` "even perfect play can lose"; but see new Nine 1 |
| Nine 3: Enter on a link swallowed | Fixed, my probe | `nine/game.js:322` |
| Nine 4: R1 engine test | Fixed | `canUndo` tested in `tests/test-nine.js` |
| Shared 1: Enter on a link in four games | Fixed in all ten, my probe | ten separate guards, no shared helper (nit Shared 2) |
| Shared 2: shared R2 property helper | **Not done** | `tests/conventions.js` unchanged; ten per-game tests, all one move deep (S1) |
| Shared 3: dead `\|\| "./"`, storage window, silent git skip | **Partly** | storage guard rewritten (`tests/conventions.js:17-21`); git skip now prints SKIP (`tests/test.js:271`); `shared/nav.js:27` still has the dead `\|\| "./"` |
| Shared 4: package.json description | Fixed | names all ten games |
| Shared 5: SPDX on docs | **Not fixed, not decided** | DESIGN, ROADMAP, README and the repo memory file still without it |
| TRIAGE2 R2 everywhere | **Holds as defined; laundered by one dummy move** | S1 |
| TRIAGE2 R12 quitting counts as a loss | Holds | Four, Five, Fifteen, Nine; labels say "Counts as a loss" |
| TRIAGE2 R13 result before the card | Holds | browser tests in all five games; OVER_DELAY 1500 ms |
| TRIAGE2 R14 computer power-ups disclosed | Holds | how-to in Four, Fifteen, Nine; hint line announces |
| TRIAGE2 R15 full stock says so | **Broken in Endless and Three** | S2 |
| TRIAGE2 toasts never hide a warning | **Partly** | `twoStep` clears the toast; but the toast now sits on the hint line, which is where the warnings live (nit Shared 1) |
| TRIAGE2 R16 pills and wording | Holds | You / Computer / Record in all four opponent games |
| TRIAGE2 R17 Enter on a link navigates | Holds in all ten, my probe | |
| TRIAGE1 R1, R3-R11 | Hold | re-checked R1 and R3 in every engine that has them |

---

## Family findings

### S1 [should-fix]: R2 is one move deep, and a dummy move launders it (Endless, Fibonacci; weaker in Seven, Four)

The `free` flag is cleared by the next move whatever that move does (`engine.js:166-167`, `seven/engine.js:235`,
`four/engine.js:154`). A power-up that sets up a reward, followed by any move that leaves the setup alone, makes the
following move a normal, paying one.

- **Endless repro (Node):** row 0 = `64 32 _ _`, a lone 2 in row 3, top 64. `use(s, "boost", 1)` gives `64 64 _ _`
  (free). `move(.., "up")` moves only the 2 (pays nothing, clears the flag). `move(.., "left")` makes 128 and returns
  `awarded: [{power: "swap", level: 7}]`. The same two swipes without the Boost pay nothing. Fibonacci is the same
  engine. The test `tests/test.js:144` ("only the next move is unpaid; the move after it pays as usual") pins this
  behaviour as intended.
- **Seven:** Smash, a drop elsewhere, then the drop the Smash set up: my fuzz found 9 paying cases in 2,933 tries where
  the same drops without the Smash paid nothing (needs the right next disc, so it is rare).
- **Four:** Pop, a drop elsewhere, the computer's reply, then an earning drop: 26 cases in 798 tries (noisy, the reply
  differs between the two lines).

Why not a blocker: TRIAGE2 defined the depth explicitly, I accepted the same line for Three in round 2, and in
Endless/Fibonacci the reward is one award per new top level, so the bypass recovers the award R2 withholds rather than
creating new ones (no unbounded loop). Why it must still be fixed: the copy is false. `game.js:200` toasts "Boosts earn
no reward.", `fibonacci/game.js:245` "Boosted tiles earn no reward", `docs/DESIGN.md:22` "does not award a milestone
power-up (prevents boost-to-reward loops)", the repo memory file "Boost never awards". Either make it true (taint the tiles a
power-up touched: a merge that consumes a boosted or swapped tile pays nothing, however many moves later), or change
the copy to what the code does ("The next swipe earns no reward."). The property tests (`tests/test.js:166`,
`tests/test-seven.js:271` and the eight others) only assert the flag; a counterfactual test (power-up then k moves vs
the same k moves without it, k = 2) is what would have caught this.

### S2 [should-fix]: R15 "Power-ups full" is silent in Endless and Three

TRIAGE2 R15 and the DESIGN.md round-2 summary: "A full stock says 'Power-ups full'". Seven, Four, Fibonacci, Six,
Fifteen and Nine say it. Two games do not:

- **Endless:** all four slots at 9, row `32 32 _ _`, top 32, swipe left: `milestones: [7]`, `awarded: []`, no flag on
  the result (`engine.js:142` returns silently), and the client toasts plain "New tile 128" (`game.js:158`), so the
  reward vanishes without a word. Fibonacci, on the same engine, does say it (`fibonacci/game.js`), so the two clients
  now disagree about the same engine result.
- **Three:** all slots at 9, row `_ 3 6 9`, swipe left: the flush returns `{paid: true, power: null}`
  (`three/engine.js:190,197`) and the toast shows the points with no reward and no note (`three/game.js:150`: `f.paid`
  with no power prints nothing). This one matters: the round-2 tuning says a flush-seeking bot flushes every 18.8
  swipes and runs thousands of swipes (`three/engine.js:35-36`), so a good player sits at the cap for long stretches.

Five and Sudoku are also silent but cannot reach a full stock (fresh stock per match / per puzzle), so they are fine.

### S3 [should-fix]: DESIGN.md per-game sections contradict the round summaries below them

Round 2 asked: "Replace the section, do not append to it." The round-2 work appended again, so the register now says two
things about six games. Each line below is still in the per-game section and is false today:

- `docs/DESIGN.md:68` Fibonacci "Award threshold kept at 34" (now 55, `:173`).
- `docs/DESIGN.md:80-82` Three bag "three 1s, three 2s, six 3s", "Rainbow by k = value / 3", "the flushed tile lands on
  the run's highest tile" (now the b12 bag, a 14-rung ladder, and a flush clears).
- `docs/DESIGN.md:100-101` Six "101 lines", tier medians by the old measure (now 111 lines, banded by tools).
- `docs/DESIGN.md:108-110` Fifteen "starts each match with one Erase ... 100% of matches (4.24 rounds)" (now an Erase
  only after a drawn round, 2-0).
- `docs/DESIGN.md:113` Nine "Every dealt start has a non-zero nim-sum ... perfect play always wins" (false on Hard since
  round 1), and `:151` "~66-73% of Hard matches" vs `:180` "88.5%". Two different numbers for the same thing.
- `docs/DESIGN.md:42` Sudoku "hard 26 or fewer"; `:22` Boost (S1); `:60` the R3 list without Fifteen.

DESIGN.md is the register the repo memory file tells every agent to tune from ("Tune in docs/DESIGN.md, not by feel"). A stale
register is how the next agent re-tunes against the wrong numbers.

---

## New findings per game

### Endless
1. **[should-fix]** S1 (Boost, dummy swipe, merge pays; copy says it cannot).
2. **[should-fix]** S2 (full stock loses the reward silently).

Verdict: **8/10** (round 2: 7.5). The R2 fix is precise and well tested, the replay fixture was re-recorded with a
stated reason (only withheld awards differ), and the client is the most thoroughly tested in the family. What remains is
the copy and one silent path.

### Sudoku
1. **[nit] Junk fill still front-loads charges.** The clash-free rule (`sudoku/engine.js:147-156`) stops "type 1
   everywhere", but a fill of deliberately wrong digits that avoid clashes is easy. My probe places, for each empty
   cell, the smallest candidate that is not the solution: Easy earns 2 of an honest solve's 4 charges (22 wrong digits),
   Medium 3 of 5 (30), Hard 3.9 of 6 (39), and Undo-ing every digit keeps them. The total per puzzle is still capped at
   the honest total, so this is pacing, not farming. Record it in DESIGN.md as accepted, or count a cell only once it
   has survived a Check.
2. **[nit]** DESIGN.md "hard 26 or fewer" (S3).

Verdict: **8.5/10** (round 2: 8). Every round-2 item is fixed and the R2 case (a Reveal over a digit) is handled more
carefully than the triage asked.

### Fibonacci
1. **[should-fix]** S1, with the same copy problem ("Boost! Boosted tiles earn no reward", `fibonacci/game.js:245`).
2. **[nit]** DESIGN.md Fibonacci section (S3). The floor moved to 55 and the summary says 149 moves per reward vs
   Endless 66, so Fibonacci now pays 2.3 times less often per move; that is a defensible choice (per game it is closer),
   but the section above still argues for 34.

Verdict: **8/10** (round 2: 8). Fixed what was asked; inherits S1.

### Seven
1. **[nit]** S1, rare (needs a lucky next disc; Hold can supply it).
2. **[nit]** The near-full warning lives in the hint line, and the toast now sits on the hint line (`shared/kit.js:56`),
   so a chain toast hides "Column 3 is one disc from the top" for 2.2 s on exactly the drops where the well is filling.

Verdict: **8/10** (round 2: 7.5). R2, R13, R15, R17 and the near-full nudge are all in and tested.

### Three
1. **[should-fix]** S2 (silent full stock; reachable for a good player).
2. **[nit] The flush can now only use 3, 6, 9 and 12.** With step merges capped at 6 (`three/engine.js:84`), the ladder
   is 3, 6, 9, 12, 18, 24 ... so 15 never exists and no run can go past 12. That is consistent with the help ("3, 6, 9
   or 6, 9, 12") and is why the colours were re-done; it is a real narrowing of the game's idea ("count in threes") and
   belongs in the DESIGN.md Three section in plain words, which still describes the round-1 rules (S3).

Verdict: **8.5/10** (round 2: 8.5). The retune is measured with a human-like bot, the table of nine variants is the
best tuning record in the repo, and R2 stayed green through a rules rewrite. The register did not follow it.

### Four
1. **[should-fix] The threat rings miss two thirds of the ambushes, because they only describe the board, not your
   move.** `threats()` (`four/engine.js:189`) rings cells where the computer's shown disc wins on the current board, and
   the client draws it before your drop (`four/game.js:63`). Most ten-line losses are created by the player's own drop
   adding the third disc to a window. Measured (my ring-aware bot: takes its own win, blocks a playable ring, never
   drops under a ring, otherwise random; 300 games per level): Easy, 86 ten-line losses, 59 at a cell that was not
   ringed before the player's last drop; Medium, 130 and 86. Example (seed 1002, both levels): bottom row `4 2 _ 3`
   after your 2 lands on cell 1, the computer holds a 1 and wins at cell 2; nothing was ringed when you aimed. The
   ring appears for 380 ms (`THINK`) and then the computer plays. The ask (cold #5) was delivered literally; the
   ambush is mostly still there. Suggested (owner decision, it is visible): while aiming, ring the cells your drop in
   that column would open for the computer.
2. **[nit] The Four and Nine round-2 work has no closing commit.** It landed only in WIP snapshots (`11699c9`,
   `6e06035`); every other game has a "round 2 fixes" commit. Seven WIP snapshot commits will go to `main` as they are
   unless the merge squashes them.

Verdict: **8/10** (round 2: 7). R2, R12 (with the clever "Undo or Pop does not hide having played"), R13, R17 and the
opener fix are all correct and tested. The rings are a half-measure.

### Five
No new finding beyond S1's note that Nudge and Split are whole turns, so R2's "same turn" boundary is the reply; that
is the rule as written.

Verdict: **8.5/10** (round 2: 8). The client caught up with the family on R5, R12 and R17.

### Six
1. **[nit] Tier 2 holds only 17 lines** (tier counts 26 / 17 / 22 / 26 / 20 after the re-banding), so the
   "avoid the last 24" rule cannot hold in tier 2 and a second Climb sees tier-2 repeats sooner than tier 5. The
   won't-fix covers tier 5; tier 2 shrank this round and is not mentioned anywhere.

Verdict: **8.5/10** (round 2: 8). The stack overflow has a regression test, the tiers are banded by a measured
property (tools needed) with a test that every tier needs more than the one below, and the page fits 390x844.

### Fifteen
1. **[nit] The Hard rule is not in the how-to.** `fifteen/index.html:56-57` never says that on Hard you get an Erase
   after a drawn round, or that perfect play can always win (R4: "the copy says so plainly"). The tray's earn text
   (`fifteen/game.js:81`) and a round-start note say it, so it is findable, but not before you play.
2. **[nit]** DESIGN.md Fifteen section (S3).

Verdict: **8.5/10** (round 2: 8.5). The agent deviated from the triage's "Erase every round" after measuring that it made
Hard easier than Medium (51% vs 47%), wrote the deviation into TRIAGE2 with the numbers, and tested the replacement.
That is exactly how a deviation should be handled.

### Nine
1. **[nit] A perfect Hard run effectively never ends.** Stock carries across matches (`nine/engine.js:107-113`), Pass
   flips any losing deal once per round, and won rounds keep paying. My bot (winning move when there is one; otherwise
   Pass, else a winning Add): 82.8-85.0% per fresh match at 3, 5 and 9 tiles, normal and Misere, but 77% of 300 Hard
   runs were still going after 60 won matches (median: never lost). "Even perfect play can lose" is true for the first
   match or two only. Not a bug; DESIGN.md should say it, and the mechanics reviewer may want a cap.
2. **[nit]** DESIGN.md `:113` and `:151` vs `:180` (S3).

Verdict: **8/10** (round 2: 7). R2 is per side and per round with a property test, Pass is limited, the computer's
power-ups are disclosed and announced, and deals never repeat.

### Shared, tests and docs
1. **[nit] The toast now sits on the warning channel.** `shared/kit.js:56` centres every toast on the hint line, and the
   hint line is where R13/R14 announcements, Four's ring note, Seven's near-full warning and Nine's computer moves live.
   `twoStep` clears the toast for "Sure?", but nothing stops a reward toast covering a warning that appears on the same
   move. Cheap fix: do not show a reward toast while the hint holds a warning, or lift the toast above the hint.
2. **[nit] Ten R17 guards, no shared one.** `game.js:225`, `fibonacci/game.js:260`, `seven/game.js:339`,
   `four/game.js:258`, `five/game.js:274-276`, `six/game.js:323`, `fifteen/game.js:295`, `nine/game.js:322`,
   `sudoku/game.js:259`, `three/game.js:240`: five different shapes (tag lists, regexes, `closest`). All pass today.
   One `NumbericsKit.isControl(e)` would keep them passing.
3. **[nit]** `shared/nav.js:27` dead `|| "./"` (third round); docs without SPDX lines (no decision recorded either way).

---

## Verdicts

| Game | Round 1 | Round 2 | Round 3 | Why it moved |
|---|---|---|---|---|
| Endless | 8 | 7.5 | 8 | R2 fixed and tested; dummy-swipe bypass with false copy; silent full stock |
| Sudoku | 6 | 8 | 8.5 | every round-2 item fixed; clash-free junk fill is a nit |
| Fibonacci | 8.5 | 8 | 8 | R2 fixed; same bypass and copy |
| Seven | 7.5 | 7.5 | 8 | R2, link, near-full, R13, R15 all in |
| Three | 6 | 8.5 | 8.5 | measured retune; silent full stock; register stale |
| Four | 7 | 7 | 8 | R2, R12, R13, R17, opener; rings miss most ambushes |
| Five | 7.5 | 8 | 8.5 | client caught up (R5 keys, R12, R17) |
| Six | 6.5 | 8 | 8.5 | crash fixed with a test; tiers banded by measurement |
| Fifteen | 6.5 | 8.5 | 8.5 | measured, documented deviation on Hard |
| Nine | 8 | 7 | 8 | R2 per round, Pass limit, R14; Hard runs do not end |
| **Overall** | **7** | **7.5** | **8** | |

This is the first round with no blocker. The family rules now hold in the engines, not only in the clients, and the
input layer survived my fuzz in every game. It stops at 8 rather than 8.5 because the round repeated round 2's
pattern on a smaller scale: a family rule (R15) was applied where it was listed, a property test (R2) checks the
mechanism rather than the property, and the design register was appended to instead of corrected. None of the three
needs a new round to fix.

**Release verdict: ship after listed fixes.** No blocker remains, so merging to `main` would not ship a broken rule. Before
the merge: S2 (two "Power-ups full" toasts), the S1 copy (change the Endless and Fibonacci Boost toasts and the DESIGN.md
Boost row to what the code does, or taint boosted tiles), and S3 (rewrite the six stale DESIGN.md sections). Four's rings
can follow, since that one is a visible change for the owner to decide.
