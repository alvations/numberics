<!-- SPDX-License-Identifier: Apache-2.0 -->
<!-- Copyright 2026 alvations (Melon Lab) -->

# Triage, round 2

Inputs: `REVIEW2.md` (critic 7.5, up from 7), `REVIEW_GAMEPLAY2.md` (mechanics), `REVIEW_AESTHETIC2.md` (craft, no
blockers), `REVIEW_COLD2.md` (first-timer 7, up from 6). Round-1 rules R1-R11 (`TRIAGE1.md`) still hold. Every finding
is fixed unless listed under won't-fix. Fix agents record per finding: fixed / won't-fix (reason).

## New and sharpened family rules
- **R2 everywhere (critic blocker):** a power-up never earns one, *including the next move after it*. Any reward
  earned on a move that follows a board-changing power-up in the same turn, or (for round games) in a round in which
  that side used a board-changing power-up, does not pay. Each game gets a **property test**: random play mixing
  power-ups and moves never increases the total stock through a power-up-assisted move (Three's test is the model).
  Endless/Fibonacci (Boost/Swap/Smash then swipe), Seven (Smash then drop), Four (Pop then drop), Nine (a round won
  after Add or Pass pays nothing), and re-check Five, Six, Sudoku.
- **R12 Quitting a live game counts as a loss** wherever a won/lost record exists (Four, Five, Fifteen, Nine): New
  game, a level switch or a mode switch after the first move of a live game records the loss (the two-step "Sure?"
  says so: "Sure? Counts as a loss").
- **R13 See the result before the card:** where a game ends on a line or a burst (Four, Five, Fifteen, Seven, Nine),
  the winning line/burst stays visible for about 1.5 s with the board undimmed, then the end card appears, and the card
  offers "See the board" (Seven's pattern) to hide it again.
- **R14 The computer's power-ups are disclosed:** every game where the computer can use a power-up says so in the
  how-to ("On Hard the computer can also Pass and Add."), and the computer's use is announced in the hint line.
- **R15 Capped stock never silently loses a reward:** awards go to a slot under the cap (shared `award` already does);
  when every slot is full the reward is skipped and the toast says "Power-ups full".
- **Toasts never hide a warning:** any two-step "Sure?" prompt clears the toast (shared `twoStep`, done by the lead).

## Shared changes made by the lead
`kit.twoStep` clears the toast when it arms; empty power-up chips show a full-strength gold focus ring; DESIGN.md and
package.json updated; convention tests: the storage guard window and the authorship scan (skips loudly without git).

## Per game
- **Endless:** R2 (Boost/Swap/Smash then swipe never pays; the toast "Boosts earn no reward." must stay true); a
  power-up tap right after a swipe is never lost (flush the pending animation on any tray tap; cold #2).
- **Sudoku:** junk-fill farming (mechanics #2): the progress mark counts only filled cells that show **no conflict**
  (conflicts are already visible, so nothing new is revealed); tray info uses the neutral `info` toast; the aiming
  toast must not cover the cells it asks for and must clear on Esc (craft #2).
- **Fibonacci:** R2 as Endless; generosity (mechanics #10): raise the award floor from 34 to 55 and re-measure against
  Endless (report moves per award); the desktop header pills sit where Endless's do (craft #6).
- **Seven:** R2 (Smash then drop never pays); a near-full warning (hint line, e.g. "Column 3 is one disc from the top")
  and a nudge to use power-ups before the overflow (cold #9); "(Esc cancels)" only with a keyboard; R13; R15.
- **Three:** board locks early in real play (mechanics #8, cold #8): re-measure with a sensible human-like bot (not only
  greedy) and tune so a sensible player's median run is 150+ moves with a flush every 20-30 moves (consider limiting
  step merges to keep values pairable, or the spawn mix); distinct colours past 21 (cold #8); the help modal fits and
  scrolls at 320x568 (craft #4); R2 property test stays green.
- **Four:** R2 (Pop then drop never pays); R12; R13; the 320px pill row wraps, no sideways scroll (craft #5); ten-line
  ambushes (cold #5): on Easy and Medium, a cell where the computer's shown next disc would complete a line is marked
  as a threat; no re-rolling who opens (critic nit).
- **Five:** the first tap swallowed with one tile left (mechanics #7); how-to wording (cold #6: "a tile at 5 or more
  bursts", and say plainly that you can always win); R12; R13; number keys on an empty slot explain it (critic #10);
  Enter on a focused games-row link navigates (critic #6).
- **Six:** the bracket-drag stack overflow (mechanics #1, treat as blocker) with a regression test; Climb deals vary by
  seed (no fixed slots, mechanics #9); tier order measured so Tier 2 is never easier than Tier 1 and round 1 never jumps
  to factorial-on-a-bracket or nested roots before line 5 of round 2 (cold #7); the Climb-ending warning is never hidden
  (shared twoStep fix plus check); target shown once in the board panel, gap buttons look active (craft #10); BEST
  shows "none" before any play (cold #10); fits 390x844 without scrolling.
- **Fifteen:** *(as built: an Erase every round made Hard easier than Medium for a sensible player, 51% vs 47%;
  the Erase now comes only after a drawn round: perfect play wins every Hard match 2-0, sensible 28% on Hard vs
  46% on Medium, random 0%.)* Original line: Hard pacing (mechanics #5): on Hard the player gets one Erase at the start of **each round** (not each
  match); a round won using it still pays nothing (R2); perfect play then wins Hard matches 3-0 while imperfect play
  still loses; re-measure; R12; R13; pills and score wording per R16 below; subtitle never breaks mid-score (craft #9).
- **Nine:** R2; R14 (disclose the computer's Pass and Add on Hard); Pass at most once per round per side (mechanics #4);
  investigate the repeated losing deal after a loss (mechanics lead) and add a test that consecutive rounds use fresh
  deals; R12; R13; dead space above and below small boards (craft #10); Enter on a games-row link navigates.

- **R16 Opponent-game pills and wording (craft #7):** Four, Five, Fifteen and Nine use the same pills in the same
  order: "You" (rounds or games won this match), "Computer", "Record" (matches won-lost, dimmed "none" when empty).
  Round summaries read "You 2 : 1 Computer" everywhere; match summaries "Match won 3-1" / "Match lost 1-3".
- **R17 Enter on a focused link navigates** in every game (critic #6): key handlers ignore events whose target is a
  link, button, input or select.

## Won't-fix (with reasons)
- Nine default stays Easy (cold #10): measured, a beginner wins 2.5% on Medium vs 75.6% on Easy.
- Endless 32-tile contrast (critic): the palette is the identity; 32 passes for large bold text.
- Six and Seven Daily replay (critic): the same board for everyone and no shared leaderboard, so replay inflates nothing.
- Six tier-5 bank size (critic): content work, queued in CLAUDE.md ideas, not a bug.
