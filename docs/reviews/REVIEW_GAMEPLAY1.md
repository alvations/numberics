<!-- SPDX-License-Identifier: Apache-2.0 -->
<!-- Copyright 2026 alvations (Melon Lab) -->

# Gameplay review, round 1 (mechanics reviewer)

Scope: rules and play only. Are they honest, interesting and fair? Are the power-ups meaningful or
exploitable? Is each computer opponent beatable but not trivial? I played every game as a player, through
the page only, with no source, tests or design notes read. Most runs were driven by small scripted players
(a corner-strategy slider, a lookahead well player, a safe-move Four player, exact solvers for Five,
Fifteen and Nine, an expression search for Six). The scripted players read only the rendered page and the
visible numbers, the same information a person has.

Severity tags: [blocker] breaks a promise the game makes or makes the game pointless; [should-fix] a real
fairness, honesty or exploit problem; [nit] small.

Volume played (approximate): Endless 12 games, Sudoku 14 puzzles on all three levels, Fibonacci 8 games,
Seven 12 games across Classic, Blitz and Daily, Three 25 games, Four 32 games across all levels, Five 9
matches, Six 6 Climb runs and 2 Daily runs, Fifteen 30 rounds, Nine 6 matches plus 27 dealt positions.

---

## Endless

Findings

1. [nit] Undo shows a stock but is greyed out. Repro: play until a reward gives you Undo 2 or more, get
   stuck, press Undo once (it rewinds one move), then press Undo again. The button reads "Undo 2" but is
   disabled, because only one move of history is kept. A player reads "2 left" as "I can rewind twice".
   Either keep more history or say "one step back" on the button.
2. [nit] Boost spends a turn: it spawns a new tile, like a slide. Repro: earn Boost (often at the 64 tile),
   tap Boost, tap your highest tile. The tile doubles (64 to 128) and a new 2 appears on an empty cell.
   This is defensible, but the hint "Tap a tile to double it" does not say a tile will also spawn. When
   the board is nearly full, that spawn can lock it.
3. [nit] When Boost makes a new highest tile, no reward is given (64 to 128 gave nothing). That is honest
   and it stops farming, but the toast only says "Boost!". A short note such as "Boosted tiles do not earn
   rewards" would stop players thinking the game skipped a reward.

Checked and honest:
- Undo cannot farm rewards. Repro: make the move that first creates 32, which awards a power-up, then
  undo. The board, the top tile and the tray all go back, and the Undo you spent is gone. Redoing the same
  move gives the same reward (it is seeded), so undo cannot reroll the reward type either.
- The game stops with "Stuck. Use a power-up to keep going." while any power-up is left, and only then
  shows "No moves left". Smash, Swap (any two cells) and Boost all worked when stuck.
- Reloading mid-game restores the exact board, score and tray. Undo after a reload still works.
- Rapid key spam (3 ms apart, hundreds of moves) never desynced the board or threw an error.

What is fun: the reward on each new top tile gives a steady drip of goals. Undo as a reward is cheap but
useful. The "Stuck" state turns what would be a game over into a choice. What is not: by 256 to 512 the
tray is mostly Undo and Swap. Swap on any two cells is strong. Neither ruins the game.

Score: 7.5 / 10

---

## Sudoku

Findings

1. [should-fix] Undo reopens a solved board. Repro: solve any puzzle (the "Solved" card shows, the board
   locks). Press U or tap Undo. The last digit is removed, the overlay disappears and the board can be
   edited again. The timer stays frozen. Re-entering the digit shows "Solved" again. The game's own rule
   is that a solved board locks; Undo should be disabled once solved.
2. [should-fix] Reloading freezes the clock, so Best times can be faked. Repro: start a puzzle, place a
   digit, then reload the page every 3 to 4 seconds. After 22 seconds of wall time the clock still reads
   0:00, and the board persists between reloads. A single reload loses up to about 4 seconds (a clock at
   0:09 came back as 0:05). Save the elapsed time continuously, or on pagehide, so that a reload costs
   nothing and gains nothing.
3. [should-fix] Switching difficulty throws away a puzzle in progress with no warning. New puzzle asks
   first ("Sure? This ends the puzzle"). Repro: place a digit, tap Hard. The puzzle is replaced at once.
   Use the same "Sure?" check.
4. [nit] Reveal can be turned into a unit reward. Repro: fill a row except one cell. Reveal that cell (no
   reward, which is correct). Undo (Reveal is not refunded, the digit disappears). Type the digit you were
   just shown: "Unit complete: +1 Check". So one Reveal plus one Undo gives one random power-up, which can
   be another Reveal. It is small, but a reveal should not lead to a reward.
5. [nit] Rewards pile up and are wasted in the endgame. In a Hard solve I earned 21 unit rewards: about one
   per three placements by the middle, and the last ten cells gave 8 rewards. I ended with Reveal 4,
   Check 8, Candidates 9, all useless once the board is full. Rewards would mean more if each one was
   worth more and they came less often (for example only for boxes, or none for a unit finished by the
   last cell).
6. [nit] A hinted solve takes the Best slot. Repro: on a fresh profile, solve one Easy puzzle using one
   Reveal. Best shows "0:03 +1". The rule says best times count only hint-free solves. Annotating the time
   is honest, but it means the first "best" can be a hinted one. Keep Best empty until a pure solve, or
   show the two side by side.

Checked and honest:
- Every puzzle I tested (3 per level) had exactly one solution. Clue counts were exactly 40, 32 and 26.
- A row that is complete and free of conflicts but wrong (two digits swapped so that no row, column or box
  clashes) earns nothing. A unit finished with a Reveal earns nothing. Erasing and re-typing a digit does
  not earn the reward twice. Undoing the placement that earned a reward takes the reward back.
- Check reports "1 wrong digit marked" or "Every placed digit is right" and spends one charge either way.
  Candidates fills notes for a whole box.

What is fun: rewards for finishing units turn a solve into a run of small wins. Unlimited Undo removes
fear. What is not: the late flood of power-ups, and the ways the solved state and the clock can be
undone, which hurt the "best time" goal.

Score: 7 / 10

---

## Fibonacci

Findings

1. [nit] It is much more forgiving than Endless, and the rewards come faster. Every Fibonacci rung is only
   about 1.6 times the last, so new-top-tile rewards (from 34) arrive about twice as often. Any two
   neighbours in the sequence merge, so the board rarely locks. My simple corner player made 700 to 1,400
   moves per game and reached 233 to 610. That means 20 to 30 minutes of near-automatic sliding before the
   game asks for a decision. Consider starting rewards later (89) or adding a spawn of 2 or 3 to tighten
   the middle game.
2. [nit] Boost "steps a tile to the next Fibonacci number". For a 1 tile, "next" is ambiguous (1 or 2) and
   the hint does not say which. In my run a boosted 1 became 2. Say "1 becomes 2" in the hint.

Checked and honest: same as Endless. Undo after a reward takes it back and replays the same reward. A
boost to a new top tile awards nothing. The game reaches "No moves left" only when the tray is empty.

What is fun: the merge rule is a nice twist, and you have to watch for 3 next to 5, not 3 next to 3. What
is not: the long, low-tension middle game.

Score: 6.5 / 10

---

## Seven

Findings

1. [nit] The drop count in the final summary looks one lower than the drops made. Repro: play a game to
   overflow and count your drops. Four games all ended with the summary one below my count (106 made,
   "105 drops"; 120 made, "119 drops"; the same in Blitz and Daily). The overflowing drop seems not to be
   counted. Count it, or say "drops before the overflow".
2. [nit] Chain scoring outweighs everything else. One Chain of 9 scored about 6,500 points in a single drop,
   more than the rest of that game (10,570 total). That makes final scores mostly luck. A gentler chain
   multiplier would reward steady play.
3. [nit] Holding an egg is unclear. Repro: earn Hold while the next drop is an egg and press Hold. The toast
   says "Held the egg" but the Hold button then shows no held disc, because an egg has no number. The
   player cannot tell an egg is waiting. Show a small grey disc in the Hold slot.
4. [nit] Hold's first use takes the disc out of play until the next Hold is earned. Swapping it back costs
   another Hold, so the first Hold is a skip, not a store. The tooltip "keep the next disc for later"
   suggests you can bring it back. Say "swap with your held disc" after the first use.

Checked and honest:
- Daily is the same well for two fresh profiles: the same starting board, the same 8-disc sequence and
  the same board after 8 identical drops.
- Undo restores the board, the next disc and the egg timer exactly, so it cannot reroll the next disc.
- Crack is disabled when no egg touches a disc. Smash, Hold and Crack each did what their tooltip says.
- "Undo" on the overflow screen spends a real Undo and disappears at 0, so it cannot be farmed.
- Blitz ("eggs rise every 5 drops") ended in 36 to 51 drops, a real sprint that feels different from
  Classic.

What is fun: this is the strongest game in the set. The rule "a disc pops when its number equals the length
of its line" makes every drop a small sum, and the chains are a delight. Rewards for chains of 3 or more
come at a good rate (4 to 8 a game). What is not: the score is too swingy.

Score: 8 / 10

---

## Three

Findings

1. [should-fix] Early deaths come fast, and a new player gets little help. A naive move order died at 52 to
   73 moves (scores of 260 to 510) in every game. Even reasonable play lands in a full board with no
   pairs by about 60 moves. The rule "neighbouring multiples of 3 merge" (3+6=9, 15+18=33) lets values
   drift apart quickly. Once a 21 sits beside a 66 the board locks. The rules line does not explain what
   neighbouring multiples make, so a player cannot plan for it. Spell out the sums once ("3 and 6 make 9,
   6 and 9 make 15") and consider a gentler spawn mix early on.
2. [nit] The Flush reward is the main source of power-ups and is very frequent. "Flush 9-6-3 = 18, +54"
   came 1 to 2 times in most short games, often by accident. That is fine, but it makes the reward feel
   unearned. A Flush of a longer run (3-6-9-12) could pay more.
3. [nit] Swap only works on neighbouring tiles and says so only after you try two tiles that are not
   neighbours ("Pick two different neighbouring tiles"). Put "neighbouring" in the Swap tooltip. This is
   honest, but undiscoverable.

Checked and honest: spawns appear on the edge you moved away from, as in the original. Merges and the
"Next" preview matched what landed every time I logged them. A Flush resolves the line and pays once. Third
turned a 1 or 2 into 3 as stated. Undo rewinds one move.

What is fun: the 3-6-9 Flush is a genuinely new idea and makes you look at lines, not just pairs. What is
not: it is the hardest game here to survive in, with the least explanation.

Score: 6.5 / 10

---

## Four

Findings

1. [should-fix] Undo after a loss resumes the game but keeps the loss on the record. Repro: Hard, drop
   discs in columns 0 and 6 until the computer wins ("The computer wins. Four in a row after 8 discs.",
   record "Won 0 · Lost 1"). Press 1. The overlay closes, the last two discs are removed, play continues
   and the record still says Lost 1. Winning from there would count one game as a loss and a win. Either
   forbid Undo once the game is over, or remove the loss when it is undone.
2. [should-fix] The ten-line rule makes early losses feel like luck. With discs numbered 1 to 4, almost any
   three in a row can become a ten. The computer's next disc is shown, but only one ahead. Repro, seen on
   Hard: after your disc, the bottom row reads "_ Y1 Y4 c1 _" (sum 6, both ends open) and the computer's
   next disc turns out to be 4. That is two winning cells at once, and the game is lost at disc 6. My
   safe-move player (never leaves an immediate ten or four for the computer's shown disc) went 4-2 on Easy,
   1-5 on Medium and 2-8 on Hard. Most losses came at 8 to 14 discs, from double threats created the move
   before the computer's next number was known. Options: show two upcoming computer discs, or limit discs to
   1 to 3 near the start, so that a careful player can see a fork coming.
3. [nit] You always drop first. In connect-four style games the first player has an edge. Alternating the
   opener per game (as Fifteen does) would be fairer and would teach both sides of the position.

Checked and honest: in 20 logged Hard games, every computer disc matched the "CPU" preview. The "Blocked!"
and "Ten threat!" rewards fired when I blocked a three or set up a ten. A Pop that completes a line counts
for whoever made it.

What is fun: "any four that sum to 10, any colours" is a great twist. Your own discs can win for the
computer, and every column is arithmetic. What is not: with the current numbers the game is decided by a
fork you could not see, too often and too early.

Score: 6 / 10

---

## Five

Findings

1. [blocker] On Hard the computer secretly uses power-ups, which breaks the stated rule. The rules text says
   "The computer always opens: the solved game gives the second seat the win" and "Bursting a computer tile
   earns a power-up", which implies power-ups are yours. On Hard the computer earns and plays them. Toasts
   seen in one match: "Computer earned Shield" (3 times), "Computer earned Split" (2), "Computer used
   Shield" (2). Repro: Hard, play the solved winning line (I used an exact solver: from 2-1 vs 1-1, play
   your 1 onto the computer's 1, and so on). On your second or third move a Shield appears, your planned
   burst is refused with "That tile is shielded this turn", and the solved win is gone. In one match my
   solver-perfect play lost a round on Hard. Either keep the computer power-up free (the game is then a
   fair, solved puzzle the player can master) or say plainly in the rules that the Hard computer has
   power-ups too.
2. [should-fix] Easy and Medium are trivially beaten once the trick is known, and do not teach it. Playing
   the solved line won every round 3-0 on Easy and Medium, and the computer never got a single round. Since
   the opener always gives the player a won position, these levels only test whether the player knows the
   line. Let the computer open with a varied move, or let a lost position happen (for example on alternate
   rounds, give the player the first move, which the text admits is a loss with best play), so that the
   player has to defend.
3. [nit] A shielded tile is only revealed when you try to hit it. After "Computer used Shield" the tile
   looks the same until you tap it. Mark shielded tiles.
4. [nit] Undo on the round-over card does nothing after a round you won (no message). It is fine that it is
   blocked, but disable the button there so it does not look broken.

Checked and honest: the arithmetic (sum, burst at 5 or more, own tile allowed as a target) matched my model
in every logged move. Nudge's +1 can burst a 4 with no reward (no farming), and it does not end your turn.
Split ends your turn; Shield does not. The game-theory claim itself is true: I solved it and the second seat
wins from every opening.

What is fun: very quick, very readable, a nice "aha" when you see the forcing line. What is not: once seen,
Easy and Medium are solved forever, and Hard is decided by hidden extras.

Score: 5.5 / 10

---

## Six

Findings

1. [should-fix] Exact answers are rejected as "no exact value" with no rule stated. Repro (Daily Six today,
   line 4, numbers 18 18 18, make 6): enter √(18 + √18 × √18). That is √(18 + 18) = 6 exactly, but the
   line shows "= no exact value" and is not accepted. The game's own answer is √(√(18 × 18) + 18). Another
   example (Climb, Tier 4, 6 6 6, make 66): √(6 + 6!) × √6 = √4356 = 66 is refused the same way. The
   evaluator rejects any irrational intermediate value even when the result is exact. That may be a
   reasonable house rule, but it is not in the rules text, and a player who finds a correct solution is
   told it has no value. State the rule ("every step must be a whole number or a fraction") or accept
   products of roots that come out exact.
2. [should-fix] Answer ends the whole Climb run. Repro: Climb, on any line tap Answer twice. "Run over.
   Reached round 3, 16 lines made." The rest of the run is lost for one hard line, while Skip (which gives a
   new line) is a rare power-up. A Climb with no way to fail except giving up is fine, but Answer should
   say on its first tap that it ends the run, or it should cost a life rather than the run.
3. [nit] Power-ups pile up. Every three clean lines pays one, so a clean round of six pays two. By round 3
   I held Skip 5 in one run and Hint 2, Skip 1, Peek 2 in another. Skip at 5 removes most of the challenge.
   Consider a cap per type, or one reward per clean round.
4. [nit] Some lines need nested brackets (round 3, 35 35 35 35, answer ((35 + 35 + 35) ÷ 35)!). The rules
   line only mentions dragging to group numbers. Say that groups can be nested.

Checked and honest: Daily Six gives the same lines to two fresh profiles. The value preview updates live.
The tap cycles (+ − × ÷ on gaps; √, !, √√, (√)! on numbers; √, !, √√ on a bracket) are consistent. Undo
takes back exactly one edit.

What is fun: the best "aha" puzzle in the set. 8 8 8 = 8 − √√(8 + 8) and 0 0 0 0 = (0! + 0! + 0!)! are
lovely, and the tier ramp (longer lines, two-digit numbers, joined digits) is well paced. What is not:
correct answers being refused, and losing the run to one stubborn line.

Score: 7 / 10

---

## Fifteen

Findings

1. [should-fix] Hard is unbeatable without power-ups, and a power-up win pays for the next power-up.
   Perfect play against Hard drew 3 of 3 rounds (Hard never erred in 30 positions I checked against a full
   solve). You start with one Erase. Repro: Hard, round 1, when the computer holds two numbers, Erase its
   better one, then play correctly. "Round 1: you made 3 + 5 + 7 = 15. +Erase". The reward was another
   Erase, so the same trick is ready for round 2. With well-timed Erases a player can chain round wins
   against a perfect computer. Either make Erase never the reward for a round won with Erase, or allow at
   most one power-up per round.
2. [nit] A match against Hard is mostly draws. Five draws gives a 0-0 match, which feels like nothing
   happened. Count a draw as half a point, or end the match early when the result is settled.

Checked and honest: Easy and Medium both make real mistakes (3 of 8 and 3 of 12 of their moves gave away a
draw or a win), so they are beatable with care. A random player lost to Easy 1-3. Erase says "not the one
you erased", which closes the obvious re-claim trick. The opener alternates between rounds.

What is fun: the reveal that it is tic-tac-toe is charming, and the Grid view is a nice teaching switch. What
is not: Hard is a draw machine.

Score: 7 / 10

---

## Nine

Findings

1. [should-fix] The player is always dealt a winning start, so Hard is a guaranteed win once the trick is
   known. I logged 27 starting positions across all three levels and match sizes of 3, 4 and 5 tiles. Every
   one had a non-zero nim-sum (for example 6 3 1, 4 8 3, 7 9 6 9), and the player always moves first. With
   the standard nim-sum move my player won every round on Hard, 9-0 over three matches, and the computer
   never got a turn in a winning position. Deal losing positions some of the time on Hard (or let the
   computer open some rounds) so that the player has to survive a bad start.
2. [should-fix] The Learn button shows the solution live, for free. Repro: tap Learn. It shows "Nim-sum 0101
   ^ 0001 ^ 0101 = 0001 (1)" for the current tiles. A non-zero sum means the right move is to make it zero.
   Together with finding 1, Learn turns Hard into reading a number off the screen. Make Learn a one-time
   lesson, or a counted help like Peek, and leave it out of Hard.
3. [nit] "Undo can take your last turn" on the lost-round card lets you undo a loss. That is honest because
   it is announced, but together with Undo being a round reward it softens Hard further.

Checked and honest: random play loses to Hard 0 out of 8 rounds, to Medium 1 out of 7, and wins against
Easy about two thirds of the time, a good spread for a player who does not know the trick. The computer's
move text ("Computer took 1 from the 7") always matched the tiles. Reloading mid-round keeps the position.
Misere unlocks after the first match win, as promised.

What is fun: the pip display makes Nim tactile, and growing the tile count per match is a nice ladder. What
is not: as soon as Learn is opened, the challenge is gone.

Score: 6 / 10

---

## Across the set

- The best rules are in Seven and Six, then Sudoku. The weakest balance is in Five (solved levels plus a
  hidden-power-up Hard) and Nine (solved by an always-available hint).
- Undo after an ending is inconsistent across games. In Endless there is no Undo once over. In Seven it is
  offered and costs a charge. In Four it reopens a counted loss. In Sudoku it reopens a solved board. In
  Nine it is announced on the loss card. Pick one rule ("Undo is allowed after a loss and removes the loss;
  never after a win") and apply it everywhere.
- Rewards that can pay for themselves (Fifteen's Erase, Sudoku's Reveal then undo) are the main exploit
  pattern. Most other reward paths are well guarded: undo takes rewards back and Boost, Nudge and Reveal
  never award.
