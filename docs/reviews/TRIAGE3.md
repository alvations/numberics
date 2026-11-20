<!-- SPDX-License-Identifier: Apache-2.0 -->
<!-- Copyright 2026 alvations (Melon Lab) -->

# Triage, round 3

Inputs: `REVIEW3.md` (critic 8, up from 7.5; no blockers; "ship after listed fixes"), `REVIEW_GAMEPLAY3.md` (mechanics
6.6; blockers: R2 bypass in Endless and Fibonacci), `REVIEW_AESTHETIC3.md` (craft, no blockers), `REVIEW_COLD3.md`
(first-timer 6.5; blocker: Four on Medium cannot be won by careful play). Rules R1-R17 still hold. This round closes
the remaining blockers and should-fixes; then the release goes to `main`.

## Decisions
- **R2 by tile, not by time (Endless, Fibonacci; mechanics blockers, critic S1).** A tile placed or changed by Swap or
  Boost is *marked*; a merge involving a marked tile yields a marked tile; a new top tile that is marked pays nothing.
  Smash keeps the one-move rule (it changes space, not a tile). The marks are saved and survive Undo correctly. The R2
  property test compares the same moves with and without the power-up (critic's method) over many seeds and gaps of
  0 to 5 neutral moves. The copy says exactly what is true ("Swapped and boosted tiles never earn a reward.").
- **Seven and Four keep the one-move rule** (the critic's weaker cases: 9 in 2,933 and 26 in 798 tries): documented
  as the deliberate depth for drop games, where a power-up changes the board's shape, not a tile's value.
- **Peek counts as help (mechanics #5):** in Nine and Fifteen a round won after that side used Peek pays nothing,
  like Six's Hint. Copy says so.
- **Stuck is not over while Undo is in stock (Seven, mechanics #6):** an overflow with Undo available shows
  "The well overflowed. Undo the last drop to keep going, or end the run." (two buttons); the run ends only when the
  player ends it or holds no Undo. Same principle as Endless.
- **Four (cold blocker, critic #5):** rings must warn about what your drop would open: on Easy and Medium, a column
  whose next cell would let the computer complete a line right after your drop is marked in the column's ghost
  ("Dropping here lets the computer win"), and two immediate threats are both ringed. Then retune so a player who
  blocks every visible threat wins Medium about 40-50% of games and Easy about 70%+ (measure with that bot and with the
  safe-move bot; report both). Pills: "Your next" / "Its next" (craft #6, no clash with "You" = rounds elsewhere).
- **The result shows before the card, every time (craft #2):** Four, Five, Fifteen, Nine and Sudoku's last digit must
  hold the finished board 1.5 s before the card (measure it in a browser test), including when the computer makes the
  final move.
- **One end-card pattern (craft #7, #4, #5):** while the card shows, the page's New game button is hidden and its
  space kept (no gap jump), focus moves to the card's primary button, and every card with a board offers "See the
  board". Win/loss headlines: "You win" / "The computer wins" / "Draw" (+ " round N" for rounds), sublines in the form
  "<detail> · <score or tally>". Empty stat values use one style (shared `.stat .none`, dimmed, same size as values).
- **Teaching (cold #3, #4, #9, #10):** Three's help copy is exact (1 + 2 and 3 + 6 are the unequal pairs); Fibonacci's
  how-to says "Equal tiles do not merge, except 1 + 1."; Fifteen's Numbers view is a single row (or 5 + 4) so it no
  longer looks like a tic-tac-toe grid; Nine's Learn opens with one plain sentence before any binary; Six's Tier 1 label
  lists brackets ("+ − × ÷ and brackets") and round 1 lines 1-3 never need brackets.
- **Home page (cold #6):** cards for games against the computer say so ("vs computer").
- **Five (mechanics #4):** the computer's opening move varies between equally good openings, so rounds are not
  identical; R4 (perfect play always wins) stays.
- **Endless first tap on a just-earned power-up is ignored (cold #2):** fix and add a browser test (tap Swap within
  50 ms of the move that earned it).
- **Small:** status text never pushes the board down (Four, Nine: reserve two lines or shorten); Six tiles and gaps are
  at least 40 px at 320 px wide; Fibonacci hues for values that sit together on a board are clearly distinct.

## Won't-fix (with reasons)
- Sudoku: wrong but clash-free digits earn (cold #8, mechanics #8): the decided rule is progress, not correctness;
  totals are capped at an honest solve's.
- Fifteen Hard draws without the Erase (mechanics #3): by design; the Erase is the way to win, and its win pays nothing (R2).
- Nine Easy/Medium always deal a winning start (mechanics #10): by design (R4); Hard deals at random.
- Three flushes rare for a player who does not aim (cold #3): measured at one per 22.6 swipes for a sensible player;
  the teaching fix above is the response.
- Nine default difficulty Easy (cold #10): measured in round 1.
