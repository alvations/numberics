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
