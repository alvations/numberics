# Design

## How 2048 works (what we kept)
4x4 grid. A move slides every tile as far as it goes. Equal neighbours merge into one tile of double
value, and a tile created by a merge cannot merge again in the same move. If the move changed anything,
one new tile (2 at 90%, 4 at 10%) appears in a random empty cell. Score adds the value of each merge.

## What we changed
1. **No ceiling.** Original ends at 2048 ("you win"). Here nothing happens at 2048 except a toast. Tiles are
   levels, labels switch to 2^n from 2^17 up, and the colour hue cycles so every level is distinct forever.
2. **Power-ups, earned.** Original has Undo only (in some ports). Here a new highest tile of 32+ pays out
   one random power-up, and you start with one Undo.
3. **Stuck is not over while you hold a power-up.** The board shows "Stuck", the run only ends when it is
   locked and no usable power-up remains.

## Power-ups
| Name | Does | Notes |
|---|---|---|
| Undo | rewind the last move | restores power stock too, so it cannot farm rewards; costs one charge |
| Smash | delete one tile | the escape hatch for a clogged board |
| Swap | exchange two cells (a tile and an empty cell is allowed) | repositions, never merges for you |
| Boost | double one tile | does not award a milestone power-up (prevents boost-to-reward loops) |

Tuning knobs live at the top of `engine.js`: `AWARD_FROM_LEVEL` (5), `POWER_CAP` (9).

## Principles register (carried over from melon-eight)
| Principle | Origin | Guard |
|---|---|---|
| Core loop first, architecture second | melon-eight MAKING_OF 1 | this doc |
| No build step, pure engine, thin client | melon-eight stack | `tests/test.js` runs engine in Node |
| Prove it, do not assert it: test + screenshot in the same turn | melon-eight 6 | `tests/emulation.cjs` |
| A screenshot catches what tests cannot | numberics: tiles below 2^17 rendered blank until a screenshot showed it | emulation asserts every plain tile has text |
| localStorage always in try/catch | melon-eight, cleo-guide | `tests/test.js` |
| Guard async UI against state change | melon-eight rendering rules | `flush()` + `state.moves` check |
| Reduced motion honoured; opacity is not motion | melon-eight | emulation reduced-motion run |
| No design change unless asked | cleo-guide rule 8 | CLAUDE.md |
| Say no to the half of a suggestion that would defang the design | melon-eight 5b | stuck stays hard: locked + no power = over |

## Sudoku
- Generation: fill a grid by seeded randomised backtracking, then remove cells in random order, keeping a removal
  only if the puzzle still has exactly one solution (solver stops counting at 2).
- Difficulty is clue count only (easy 40, medium 32, hard 26 or fewer). It is a simple, honest knob; a
  technique-graded rating (naked pairs, X-wing) is a possible future refinement.
- Helpers are honest: red marks show rule conflicts only, never whether a digit is right. Hint is the one
  way to learn the truth and it disqualifies the best time.

---

# The family (built 20 Nov 2026)

The plan is `docs/ROADMAP.md`. This is what was built, the numbers behind every tuning choice, and every
deviation from the plan with its reason. All measurements are seeded Node bot runs (reproducible).

## Shared
- `shared/theme.css` is the Endless look as tokens and components; `kit.js` (seeded rng, storage with fallback,
  toast, two-step button, swipe), `power.js` (stock, award with cap 9, tray), `nav.js` (the games row, mirrored
  from `games.json` by a test).
- Endless and Sudoku keep their own CSS (so their look did not move); both now show the games row (plan Q0 default).
- **Undo and spent charges.** In the slide games (Endless, Fibonacci, Seven, Three) Undo restores the whole snapshot.
  Where a power-up *reveals information* (Sudoku Reveal/Check, Six Hint/Peek, Nine Peek), a spent charge stays
  spent through Undo; otherwise "reveal, then undo" would show answers free.

## Fibonacci
- Rules (2584, well known; the reference page could not be reached from the build network): merge consecutive
  Fibonacci numbers or 1+1, spawn 1 (90%) / 2 (10%), score += merged value, no ceiling.
- `engine.js` became a rule-set engine; Endless replays byte-identical (`tests/fixtures/endless-replay.json`, and
  0 differences on 200 further seeds).
- Award threshold kept at 34: greedy bot, Endless 71 moves per award, Fibonacci 132 (runs last ~3x longer);
  21 or 55 move that only to 114 / 158.

## Seven
- 16% eggs; rises every 20 drops in Classic, minus one per level down to 5; Blitz fixed at 5; 12 starting discs.
- Disc points 7 x wave^2.5; rise bonus 70 x level; Lucky Seven 777; cleared well 7000.
- Shape-playing bot, Classic: median 186 drops, 14 chains of 3+ waves and 1.25 Lucky Sevens per game, ~15 power-ups.
- Power-up chains score but never earn; an egg touching several pops cracks one step per wave.

## Three
- Step merges are essential: without them values stay 3 x 2^n, 9 never exists and no flush can form.
- Flush minimum 3 (a minimum of 4 effectively never fires).
- Bag of three 1s, three 2s, six 3s: a flush every 29.4 moves (greedy), 26.0 (flush-seeking), 1% of games
  without a flush. Threes' own bag gives one every ~41. Reproduce with `node tools/sim-three.js`.
- Rainbow by k = value / 3, octaves marked by rings; the flushed tile lands on the run's highest tile.

## Four
- Even 1-4 bag: ten-lines decided ~72% of games (too dominant). Shipped bag 1,1,1,1,2,2,3,4: ten-lines decide
  46% (random play) to 62-64% (between levels), so both win paths matter.
- AI sees only public information (both next numbers, held discs, remaining bag counts). Deterministic node
  budgets; Hard's slowest move ~93 ms in Node.
- vs random: Easy 94%, Medium 97%, Hard 98%. Hard beats Medium 55% (luck from unknown numbers caps skill).
- Pop cannot complete a line; power-ups do not pass the turn; the computer never earns Undo.

## Five
- Solve: 576 live positions, 432 wins / 144 losses / 0 draws for the side to move. **The first mover loses from
  1-1-1-1**, so the computer always opens and the player holds the winning seat (no alternation).
- Plain play cannot loop (tiles only grow), so rounds last at most 16 turns; the draw rule only guards power-up play.
- vs random (rounds / matches): Easy 61.8% / 67.2%, Medium 87.1% / 98.4%, Hard 95.0% / 100%.
- Split is a power-up, not a basic move.

## Six
- Verified bank of 101 lines (`six/bank.js`, rebuilt by `node six/make-bank.js`, every line re-solved by tests).
- Difficulty = log10(expressions / solutions) + extra signs in the shortest solution; tier medians 4.1, 5.9, 5.9,
  9.3, 12.0 (a test requires them never to fall).
- Starts with Undo + one Hint (lifts the weakest 10% of bot players past round 1). Answer button for stuck lines.
- Known gap: only ~20 tier-5 lines, so long Climb runs repeat (the last 24 are avoided).

## Fifteen
- The 8 magic lines are exactly the 15-sum triples of 1-9 (tested on all 19,683 boards).
- Hard is perfect, so a perfect player could only ever draw and never earned a power-up. Decision: on Hard the
  player starts each match with one Erase. Result: perfect play beats Hard in 100% of matches (4.24 rounds on
  average); a takes-wins-and-blocks player still loses 95%. The computer earns only Erase and Double.

## Nine
- Every dealt start has a non-zero nim-sum and the player moves first, so perfect play always wins.
- Hard vs a player who finds the winning move 95% of the time: player wins 79% at 3 tiles, 24% at 9.
- First visit defaults to Easy (on Medium a random player wins only 2% at 3 tiles).
- Add does not use the turn (otherwise it could never turn a lost position); no pass-back; Undo never crosses a
  won round.

## Sudoku power-ups
- Start: 1 Reveal (keeps the old Hint's job). Units pay once each, at most one charge per move, odds weighted
  Reveal 1 : Check 2 : Candidates 3 (equal odds and one per unit filled every slot to the cap).
- Hard, easiest-cells-first solver: first charge at ~9% of cells, ~1.8 / 2.3 / 3.2 in stock at half way.

---

# QA round 1 (20 Nov 2026): what changed

Reviews and decisions: `docs/reviews/REVIEW*1.md`, `TRIAGE1.md` (family rules R1-R11). Highlights, with numbers:

- **Family:** Undo never crosses a decided result (R1); a power-up never earns one, even indirectly (R2); spent
  information power-ups stay spent (R3); solved-game opponents lose to perfect play (R4); power-up buttons explain
  themselves on tap (R5) and Undo is slot 1 everywhere; one header pattern (R6); one channel per event and neutral
  warning toasts (R7); family end card with "New best." (R8); keyboard targeting everywhere (R9); two-step switches
  (R10); naming (R11). The toast sits just inside the top of the board (never over the title or the games row).
- **Sudoku:** earn by progress (each new multiple of 9 filled cells on a high-water mark): 4 / 5 / 6 charges per
  Easy / Medium / Hard puzzle, revealing nothing about correctness; clock survives reloads.
- **Fibonacci:** 111-degree hue step so merge neighbours differ; merge rule confirmed by a published write-up (spawn
  odds still assumed). Award floor stays 34 (per move it already pays half as often as Endless).
- **Seven:** overflow leaves the last well and rings the discs pushed out; Crack arms before firing; Undo counted.
- **Three:** first-run explainer; a run made by a power-up collapses without paying, and so does the swipe after
  Smash/Swap/Third; flush spacing unchanged (29.5 moves greedy, `tools/sim-three.js`).
- **Four:** a ten-line needs at least two discs of the side completing it (`MINE = 2`); discs filled by owner; the
  opener alternates; safe-move bot wins Easy 68%, Medium 44%, Hard 29% (`tools/measure-four.js`); ten-lines decide
  51-59% of games; the computer earns power-ups only on Hard.
- **Five:** the computer never uses power-ups; perfect play wins 100% on every level; Hard sets traps from lost
  positions; greedy player wins Easy 86%, Medium 35%, Hard 0% (`EASY_CARE`, `MEDIUM_CARE = 0.4`).
- **Six:** tray Undo, Hint, Skip, Peek; Show answer (ends the run, two-step); plain first line on every seed and Daily;
  the exactness rule stated where it bites.
- **Fifteen:** tiles filled by owner; a round won after Erase or Double (by that side) pays nothing; perfect play with
  the starting Erase wins every Hard match; family round-end overlay keeps the winning triple.
- **Nine:** Hard deals a losing start 1 time in 5 (`HARD_LOSING = 0.2`) and hides the live nim-sum; perfect play with
  power-ups wins ~66-73% of Hard matches; Easy stays the default (beginner wins 75.6% on Easy, 2.5% on Medium); the
  computer earns only Add and Pass.
