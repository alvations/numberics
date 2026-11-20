<!-- SPDX-License-Identifier: Apache-2.0 -->
<!-- Copyright 2026 alvations (Melon Lab) -->

# Triage, round 1

Inputs: `REVIEW1.md` (critic 7/10), `REVIEW_GAMEPLAY1.md` (mechanics), `REVIEW_AESTHETIC1.md` (craft),
`REVIEW_COLD1.md` (first-timer 6/10). Every finding is fixed unless listed under won't-fix below. Design changes
here are allowed because the panel proves readers want them (CLAUDE.md: no unasked design change), and each one
cites its finding. Fix agents record per finding: fixed / won't-fix (reason).

## Family rules decided this round (apply to every game)

- **R1 Undo never crosses a decided result.** Once a game, round, match or puzzle is won, lost, drawn or solved,
  Undo is unavailable (button disabled with a reason in the hint line). Fixes: Sudoku undo-after-solved (critic
  blocker, mechanics, cold), Four record farming (critic, mechanics), Five/Nine undoing a lost match, Fifteen
  inconsistency (critic #10).
- **R2 A power-up never earns a power-up, including indirectly.** A reward that becomes possible only because of a
  board-changing power-up in the same turn or round does not pay (Three swap-then-flush, critic blocker; Fifteen
  round won after Erase/Double pays nothing, mechanics #9).
- **R3 A spent information power-up stays spent through Undo** (Peek, Hint, Reveal, Check). Fifteen Peek+Undo
  refund is a blocker (critic).
- **R4 Solved-game opponents (Five, Nine, Fifteen): perfect play by the player can always win the match, on every
  level, and the copy says so plainly; the computer's job is to punish mistakes.** Five: the computer never uses
  power-ups (mechanics blocker). Nine: on Hard only, the dealt start is random (it can be a losing position) and the
  Learn view's live nim-sum is available on Easy and Medium only, so Hard is not a free sweep (mechanics #6/#7, cold
  #8); a perfect player with power-ups (Add, Pass) must still be able to win a Hard match (measure it). Fifteen keeps
  its starting Erase on Hard plus R2.
- **R5 Every power-up explains itself on a phone.** Tapping any tray button that cannot act (0 left or not usable
  now) shows "<Name>: <what it does>. <How to earn it>." in the hint line instead of doing nothing (cold #4). Tray
  tooltip voice: "1: Undo. Take back the last move." (craft F11). **Undo is slot 1 in every game**, so Six becomes
  Undo, Hint, Skip, Peek (craft F10).
- **R6 Header pattern** (craft F1, cold #3): H1 is the game name, except Endless, whose H1 stays "Numberics" (it is
  the home page); the subtitle starts with a "Numberics" link to the home page (Endless: no link) and then one short
  tagline in sentence case with a full stop. Live status (level, record, difficulty) goes in stat pills or the hint
  line, not the subtitle. Endless adds "Nine more games below." as a link to `#games` in its subtitle (cold #3).
- **R7 One channel per event** (craft F4): a toast is for a reward or a passing note; an overlay or the hint line is
  for the result of a game or round. Never both for the same event. Warnings and losses use the neutral toast
  (`NumbericsKit.toast(msg, "bad")`), never the gold one (craft F3).
- **R8 End screens** (craft F6/F7/F8): full-board scrim (shared `.over`, now darker), white headline that fits on one
  line at 375px, one summary line in the form "<Result> · <score or tally>", gold primary button. A new best says so
  ("New best."). Sudoku moves to this pattern too.
- **R9 Keyboard can do everything**: targeting power-ups (Smash, Swap, Boost, Pop, Erase...) get an arrow-key cursor
  plus Enter, in every game (critic #9). Enter/Space on a focused button activates that button, never a game action
  (Six, critic #7).
- **R10 Destructive switches ask first**: changing difficulty or mode mid-game uses the same two-step "Sure?" as New
  game (Sudoku, critic #6, mechanics #10).
- **R11 Naming** (craft F12): "Computer" (never "CPU"); restart is "New game" everywhere except Sudoku's "New puzzle";
  empty stat values show a dimmed "none" or "0:00", never "-" (F18).

## Shared changes made by the lead (already in `shared/`)
Toast moved to the top of the screen (never over the games row, F2) with a neutral "bad" variant; darker overlay
scrim; hover and press states on buttons, tray, segments and links (F5); gold focus ring on links (F9); tighter games
row (F16); `NumbericsPower.tray` gains `desc`, `earn` and an `onInfo` path for R5 (buttons are never `disabled`;
an unusable one gets `aria-disabled="true"` and class `empty`).

## Per-game blockers and key fixes (agents also work every other finding for their game in all four reviews)
- **Endless**: R5, R8 (new best, darker scrim), R9 keyboard targeting; mirror the shared toast/hover/focus changes in
  its own style.css without changing anything else about its look.
- **Sudoku**: undo after solved (R1, blocker); difficulty switch two-step (R10); reload-to-freeze the clock (save
  elapsed often and on pagehide, mechanics #3); power-ups flood and the unit toast leaks correctness: **earn by
  progress, not correctness**: one charge each time the count of filled cells passes a new multiple of 9 above the
  puzzle's high-water mark (never lowered by Erase or Undo), so it pays about 4 to 6 per puzzle and reveals nothing
  (critic #8, cold #6, mechanics nit); R8 end card.
- **Fibonacci**: as Endless.
- **Seven**: Undo counted as a power-up used (critic #4); the game-over board must show the final board honestly
  (cold #10); explain the egg (grey disc) in the how-to.
- **Three**: swap-then-flush earns (R2, blocker); the rules are not learnable (cold blocker): add a short first-run
  explainer (dismissable, shown once, remembered) that teaches 1+2=3, equal merge, step merge, and Flush with the
  rainbow, and make sure flushes are visible and announced; explain the rings (octaves).
- **Four**: ten-lines are unseeable forks (cold blocker, mechanics #5): **a ten-line must contain at least two discs
  of the side that completes it**, re-measure, and tune Easy so a sensible player wins most games (target: a
  safe-move bot beats Easy >= 65%, Medium 40-55%, Hard 20-35%); the winning line must be clearly highlighted (cold);
  record farming via R1.
- **Five**: R4 (no computer power-ups), Easy too strong (cold #9: a greedy player should beat Easy most of the time),
  replace jargon in the how-to (cold #9).
- **Six**: rename "Answer" to "Show answer" with copy that says it ends the run (cold #7, craft #8); state the
  exactness rule plainly where the "no exact value" message appears (mechanics #8); Undo to slot 1 (R5); Enter on
  buttons (R9); the Run over overlay must not hide the answer it refers to.
- **Fifteen**: ownership must be obvious (craft blocker): fill claimed tiles by owner (gold family for you, cool for
  the computer) with the number still readable, not by number hue; Peek refund (R3, blocker); R2; round-end overlay
  per R8; focus rings (F9).
- **Nine**: R4 changes; focus vs selection rings distinguishable (F9); default difficulty Medium like the others
  only if measurements support it (F13), else keep Easy and say why.

## Won't-fix (with reasons)
- Six irrational intermediate steps (mechanics #8): exact arithmetic is the design; the fix is a clear rule message.
- A full hub/landing page (cold #3): owner decision Q0 keeps Endless as home; R6's link to the games row is the fix.
