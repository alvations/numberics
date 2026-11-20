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
- Difficulty is clue count only (easy 40, medium 32, hard exactly 26). It is a simple, honest knob; a
  technique-graded rating (naked pairs, X-wing) is a possible future refinement.
- Helpers are honest: red marks show rule conflicts only, never whether a digit is right. The Reveal power-up is
  the one way to learn the truth; pure and assisted best times are kept apart.

---

# The family: how each game stands now (after QA round 3)

This section is kept current (rewrite it, do not append). The plan is `docs/ROADMAP.md`; how each game got here is in
the round histories below and in `docs/reviews/` (four reviews and a triage per round). Every number is a seeded
measurement, reproducible with the tools named.

## Shared
- `shared/theme.css` (the Endless look), `kit.js` (seeded rng, storage with fallback, toast, two-step, swipe),
  `power.js` (stock, award with cap 9, tray that explains itself), `nav.js` (games row; the home page shows each game
  with its description and a "vs computer" tag). Endless and Sudoku keep their own CSS and mirror shared changes.
- Family rules R1-R17 (`docs/reviews/TRIAGE1-3.md`): Undo never crosses a decided result; a power-up never earns one;
  information power-ups (Peek, Hint, Reveal, Check) stay spent and count as help; solved-game opponents lose to perfect
  play; quitting a live game counts as a loss; the result shows on the board for 1.5 s before the card, which offers
  "See the board"; one end-card pattern; the toast never covers an end card, a warning or a status-line change.
- R2 depth: tile games mark the tiles a power-up touched (Endless, Fibonacci); drop games make the next move unpaid
  (Seven, Four); round games pay nothing for a round won after a power-up, Peek included (Five, Fifteen, Nine); Sudoku
  and Six treat any help on the current line or cell as help.

## Endless and Fibonacci
- Rule-set engine (`engine.js`, `make(rules)`); Endless behaviour is pinned by `tests/fixtures/endless-replay.json`.
- Swapped and boosted tiles carry a mark through merges and never earn; Smash makes the next move unpaid.
- Fibonacci (2584 rules: merge consecutive numbers or 1 + 1; equal tiles do not merge): award floor 55; greedy bot
  149 moves per reward vs Endless 66; 111-degree hue step so neighbours differ. Merge rule confirmed by a published
  write-up; spawn odds (1: 90%, 2: 10%) assumed.

## Sudoku
- Exactly 40 / 32 / 26 clues; every puzzle has one solution.
- Power-ups (Undo free; Reveal, Check, Candidates) earned by progress: each new multiple of 9 clash-free player cells
  on a high-water mark (honest solve 4 / 5 / 6; typing 1 everywhere 0). Revealed cells never count. Accepted: wrong but
  clash-free digits count (the rule rewards progress, and totals cap at an honest solve's).
- Layout deviation: no hint line (tray below the board), so explanations use the neutral info toast.

## Seven
- 16% eggs; rises every 20 drops in Classic (minus one per level, floor 5), Blitz 5; disc points 7 x wave^2.5.
- The drop after Smash, Hold or Crack pays nothing; rewards skip Undo once three are held (`RULES.undoKeep`).
- An overflow with Undo in stock offers "Undo the last drop" or "End the run".

## Three
- Bag: four 1s, four 2s, two 3s. 1 + 2 = 3; from 3 up equal tiles merge; the only other step merge is 3 + 6 = 9, so
  values stay on a pairable ladder and 15 never exists. A Flush (3, 6, 9 or 6, 9, 12 in a line) scores sum x length,
  pays a power-up and clears its run.
- Human-like bot: median 165 swipes, a flush every 22.6 (`tools/sim-three.js`). 14-rung colour ladder.

## Four
- Discs 1-4 from a bag of 1,1,1,1,2,2,3,4; win with four of your colour or a ten-line (four in a row summing to 10
  with at least two of the completer's discs).
- Easy and Medium mark danger: red ring on a column whose drop would let the computer win right after; blue ring on
  the cell a drop would open and on every immediate threat. Hard shows none.
- Careful bot (plays only on what the page shows): Easy 78%, Medium 44%, Hard 36%; safe-move bot 71 / 39 / 39%
  (`tools/measure-four.js`). Easy misses ten-line wins 40% of the time; Medium loose 0.75.

## Five
- Each side has two number tiles starting at 1; add one onto another; at 5 or more it bursts. The computer opens
  (the first mover loses from 1-1-1-1), its opening varies by seed (`OPEN_OWN` 0.5 / 0.5 / 0.25), it never uses
  power-ups, and perfect play wins 100% on every level. Greedy player: Easy 89%, Medium 35.5%, Hard 4.5%.

## Six
- Verified bank of 108 lines (`node six/make-bank.js`, byte-identical rebuild, re-solved by the tests). Tiers by
  measured tools needed: 1 = + − × ÷ and one bracket group, 2 = one root or factorial, 3 = more signs, 4 = join
  digits, 5 = all tools. Climb opens with three lines that need no brackets; deals vary by seed.
- Exact fractions; never `eval`. Undo, Hint, Skip, Peek; help on a line means that line pays nothing.

## Fifteen
- Tic-tac-toe as Pick 15; Numbers view 1-5 over 6-9, Grid view the magic square.
- On Hard the player gets an Erase only after a drawn round: perfect play wins every match 2-0. Sensible player:
  Easy 99%, Medium 52%, Hard 24.5%. A round won after Erase, Double or Peek pays nothing.

## Nine
- Nim with tiles up to nine; runs climb from 3 to 9 tiles; Misère unlocks after the first win; Easy is the default.
- Easy and Medium always deal a winning start; Hard deals a losing start 1 time in 5 and hides the live nim-sum.
  Hard, perfect play with power-ups: 88.5% of matches; a perfect Hard run effectively never ends (accepted).
- Pass once per round per side; a round won after Add, Pass or Peek pays nothing; deals never repeat.

## Known gaps
- Long power-up explanations can take three lines at 375 px and move the board down for a moment (family-wide;
  needs shorter copy or another place).
- Six tier 2 has 17 lines; tier 5 about 20 (content work).

---

# History

## QA round 1 (20 Nov 2026): what changed

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

---

## QA round 2 (20 Nov 2026): what changed

Reviews and decisions: `docs/reviews/REVIEW*2.md`, `TRIAGE2.md` (R2 everywhere with a property test per game, R12-R17).

- **Family:** the move right after a board-changing power-up never pays (Endless/Fibonacci `state.free` after Smash,
  Swap, Boost; Seven after Smash, Hold, Crack; Four after Pop, Hold, Tune; Five after Shield; Sudoku after a Reveal over a
  digit; Six after any help on a line; Three one swipe deep); round games pay nothing for a round won after Erase/Double
  (Fifteen) or Add/Pass (Nine). Quitting a live game counts as a loss (R12). The result shows on the board for 1.5 s
  before the card, which offers "See the board" (R13). The computer's power-ups are disclosed and announced in the hint
  line (R14). A full stock says "Power-ups full" (R15). Opponent games share You / Computer / Record pills (R16). Keys on
  a focused link, button or field belong to that control (R17). The home page lists every game with a description; the
  toast is compact, centred on the hint line, and never shows on an end card or over a "Sure?" warning.
- **Fibonacci:** award floor 55 (greedy bot 149 moves per reward, Endless 66). Endless replay fixture re-recorded for R2
  (200 seeds: only withheld post-power-up awards differ).
- **Sudoku:** progress counts only clash-free player cells (typing 1 everywhere earns 0; an honest solve 4/5/6); revealed
  cells never count; clue ladder exactly 40/32/26.
- **Three:** only 3 + 6 = 9 step-merges and a Flush clears its run; human-like bot median 100 -> 165 swipes, a flush every
  22.6; colours follow the 14-rung value ladder.
- **Four:** blue threat rings on Easy and Medium; difficulty unchanged at 68/44/29%.
- **Five:** greedy player wins Easy 84.9%, Medium 33.6%, Hard 0%; perfect play 100% everywhere.
- **Six:** tiers banded by measured tools needed (bank 111 lines); Climb deals vary by seed; bracket-drag crash fixed.
- **Fifteen:** on Hard the player gets an Erase only after a drawn round: perfect play wins every match 2-0; sensible
  player 28% on Hard vs 46% on Medium; random 0%.
- **Nine:** Pass once per round per side; deals never repeat; Hard: perfect play with power-ups wins 88.5%, with 15%
  mistakes about 14%.
