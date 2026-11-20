<!-- SPDX-License-Identifier: Apache-2.0 -->
<!-- Copyright 2026 alvations (Melon Lab) -->

# Panel brief: the order of the games list (O-7, REDESIGN.md 4.4)

The owner asked for every games list "in increasing order": **Fibonacci, Two, Three, Four, Five, Six, Seven, Nine,
Fifteen, Sudoku** (docs/OWNER-REQUESTS.md O-7). It is built as given (C1). It is the owner's proposal, not a closed
decision: the panel reports evidence on it every cycle, a change needs that evidence and a recorded reason, and the
owner stays the final gate. This brief is run alongside the usual round (PERSONAS.md); it adds questions, it does not
replace the four briefs.

## What the player sees

- **Root page** (`/`): Two, playable at once. Beside the board from 960 px, below it on phones: the Today card, then
  the heading "Ten number games", the line "From the smallest number to the biggest. Free, no ads, saved on this
  device.", then ten cards in the order above (preview, name, one-line blurb, tags: Playing, vs computer, Continue, the
  best, or New to you).
- **Games sheet**: the top bar's **Games** button on every page opens it: the Today card, then the same ten cards in the
  same order.
- **Game pages**: the text row at the foot of each page, same order (each page moves to the cards in its D package).
- One source drives all of it: `games.json` (mirrored in `shared/nav.js`; `tests/test-shared.js` keeps them identical
  and pins the order).

## Questions (each answer needs evidence: what you did, at which size, what happened, how long it took)

1. **Findability for strangers.** Cold first-timer, phone (390x844) and desktop (1280x860), no briefing: from a fresh
   load of `/`, how long until you open a named game? Run it for **Sudoku** (best known, last in the list), **Seven**
   (middle) and **Fibonacci** (first). Time each from the request to the tap, by both routes (scroll the root page,
   and the Games button). Note every hesitation and wrong tap. The bar is under 5 s per named game.
2. **Does "increasing order" read?** Without being told, do you notice that the list counts up? Does Fibonacci first
   ("1, 1, 2...") make sense before Two, or does it look like a mistake? Does the lede "From the smallest number to the
   biggest" help, puzzle, or go unread? Quote what you thought at first sight.
3. **Grouping of vs-computer games.** Four, Five, Nine and Fifteen are spread among the solo games. Does the "vs
   computer" tag carry the distinction, or did you want those four together? Would you have found "a game against the
   computer" quickly if you had wanted one?
4. **Anything else about the order** a player noticed unprompted (for example: "I expected Sudoku first", "Two is
   where I already am, why is it second").

## Who answers what

- **Cold first-timer** (wipes memory): questions 1 to 4, in that order, first impressions only. Timings with a
  stopwatch or the Playwright clock, at both sizes.
- **Craft reviewer**: questions 2 and 3 from the layout: does the order read in the 2-column phone grid and the
  2- and 3-column desktop grids? Screenshots of each.
- **Critic**: checks the order is identical everywhere (root cards, Games sheet, every game page's row, README) and
  that nothing hard-codes it outside `games.json` and its mirror.
- **Mechanics reviewer**: not asked (the order changes no rule).

## How a change is made

Write the finding in the round's review file with its evidence. The lead records it in `TRIAGE<N>.md` as a proposal
to the owner (keep, or a named alternative order with the reason). Only after the owner agrees: move the lines in
`games.json`, regenerate the mirror in `shared/nav.js`, update the order test in `tests/test-shared.js`, the README
list and screenshots table, and record the reason in docs/DESIGN.md. Nothing else changes.
