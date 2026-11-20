<!-- SPDX-License-Identifier: Apache-2.0 -->
<!-- Copyright 2026 alvations (Melon Lab) -->

# Mechanics review, round 2

Fresh reviewer, no memory of earlier rounds. I read only `games.json`, `docs/reviews/PERSONAS.md`, the rendered
pages and screenshots. Every game was driven by scripted players in a headless browser (desktop 1280 wide),
reading only the board from the page. Where a game is solvable from what is on screen I wrote a perfect player
(Five, Fifteen, Nine, Sudoku) or a strong one (2048-style expectimax for Endless and Fibonacci, lookahead for
Seven, Four and Three, an exact-fraction expression search for Six), plus a random player as a baseline.

Scores are for the rules and play only: honest, interesting, fair, power-ups meaningful, opponents beatable but
not trivial.

## Summary of measured results

| Game | Player | Measured |
| --- | --- | --- |
| Endless | expectimax bot + Smash/Undo when stuck | 1 deep game: 2,846 moves, top tile 4096, score 60,880, 8 power-ups earned |
| Fibonacci | same bot, Fibonacci merge rule | 1 deep game: 11,992 moves, top tile 10946, score 174,544, 13 power-ups earned |
| Sudoku | exact solver | 18/18 puzzles (6 per level) have exactly one solution; clues 40 / 32 / 26 (one Hard puzzle had 27) |
| Seven | 2-ply bot | Classic 200 to 211 drops (level 15 to 18), Blitz 41 to 46 drops (level 8 to 9), Daily 182 to 215 drops |
| Three | 2-ply bot | 83 to 166 moves, score 783 to 1,254, 1 to 2 Flushes per game |
| Four | 2.5-ply bot | Easy 13-2, Medium 12-3, Hard 8-7; random player on Easy 3-7 |
| Five | perfect player | 14-0, 15-0, 15-0 rounds (Easy/Medium/Hard), every match won; random player: Medium 4-12 rounds, Hard 0-12 |
| Six | expression search | Climb: Tiers 1 to 3 all solved (18 lines in a row, twice), stopped at Tier 4 join-digits lines |
| Fifteen | perfect player | Easy 9 wins 0 losses, Medium 8 wins 2 draws, Hard 15 draws 0 wins; Hard with Erase: 3 wins 12 draws (1 win per match) |
| Nine | perfect Nim player | Easy 9-0, Medium 9-0 (and Misere 12-0 on each), Hard 7-3 and 4-6 in two runs; random player: Easy 5-5, Medium 0-6, Hard 0-6 |

---

## Endless

What it is: 2048 with no ceiling and four earned power-ups (Undo, Smash, Swap, Boost).

Findings

1. [nit] Swap takes any two cells, including an empty one, so it is really a teleport: any tile can be moved to any
   empty square. Repro: load a board with a Swap, tap Swap, tap an empty cell, tap a tile across the board; the tile
   jumps there ("Swap!"). That is much stronger than Three's Swap ("Trade two neighbouring tiles"). Fine if
   intended, but the two siblings disagree on what "Swap" means.
2. [nit] Reward pacing is front-loaded by design: 8 power-ups by the 4096 tile, then the next one needs 8192. In my
   deep game the last reward came around move 2,500 and none followed. Late game the tray is mostly empty, which is
   honest ("from 32 up") but means the power-up system matters least exactly when runs are longest.
3. [nit] When stuck, the game waits ("Stuck. Use a power-up to keep going.") while any power-up is held. With only a
   Boost left it still waited; in my case a Boost could unstick the board (16 next to 32), so this was correct, but I
   could not confirm the game ends when a held Boost cannot help.

Checked and sound: Undo after a reward takes the reward back (Swap 1 -> 0 and score 140 -> 108); replaying the same
move gives the same reward type, so Undo cannot reroll rewards. Undo after a Boost refunds the Boost. Boost says
"Boosts earn no reward" and the top tile moves up, so it cannot be farmed. Reload restores the exact board, and
the same move after a reload spawns the same tile (no save-scumming). New game asks "Sure? This ends the run".

Fun: the classic loop is intact and the no-ceiling promise is kept. Not fun: nothing new happens after the last
reward. Score: 8/10

## Sudoku

Findings

1. [should-fix] The "every 9 cells you fill earns a power-up" reward counts any digit, even ones that break the
   rules. Repro: Hard, type 1 into every empty cell (55 cells, about 3 seconds). Tray goes from Reveal 1 to
   Reveal 1, Check 2, Candidates 4 ("54 cells filled: +1 Candidates"). Erase them all: the power-ups stay. You now
   start a Hard puzzle with 6 helpers. Refilling the same cells does not pay again (good), but the first junk pass
   does. Count only digits that do not conflict, or only correct ones.
2. [nit] Rewards arrive late and die with the puzzle. On Easy (41 empty) the 4th reward lands at 36 filled, with 5
   cells left, and the tray resets to Reveal 1 on the next puzzle. Typical end-of-solve trays were Reveal 2, Check 1,
   Candidates 2, all unused.
3. [nit] One Hard puzzle in 12 had 27 givens, the rest 26. Harmless, but the stated rule is 26.
4. [nit] Difficulty by clue count mostly works but Hard varies a lot: of 12 Hard puzzles, 0 fall to naked singles,
   5 to singles, 9 to singles plus pairs and pointing, 3 need more. Medium: 11 of 12 fall to singles. Easy: all.

Checked and sound: 18 of 18 sampled puzzles have exactly one solution. Undo after the solve is refused ("Not after
the puzzle is solved"). A solve with Reveal or Candidates shows no best time; a clean solve sets one ("No
power-ups used", "New best."). Reload keeps the solved state and the best.

Fun: honest, one-answer puzzles, good helper set. Not fun: the junk-fill trick turns the helper economy into a
3-second chore. Score: 7/10

## Fibonacci

Findings

1. [should-fix] Much easier and much more generous than Endless with the same bot: top tile 10946 vs 4096,
   11,992 moves vs 2,846, 13 rewards vs 8. Fibonacci steps are about 1.6x, so a reward "every new highest tile from
   34" pays about 45 percent more often than Endless, and neighbour merges (1+2, 2+3, 3+5) rarely lock the board.
   The run ended with Swap 6 and Boost 4 unused, each of which would have bought more turns. Suggest starting rewards
   higher, or paying every second Fibonacci step.
2. [nit] Same teleport Swap as Endless (any two cells, including empty).

Checked and sound: Undo after "New tile 34 +Swap" removes the Swap; replaying gives the same reward. Reload keeps
the board and seeded spawns.

Fun: merging along the sequence is a nice twist and genuinely different to plan. Not fun: sessions become very long
and power-ups pile up. Score: 7/10

## Seven

What it is: a drop-the-disc well; a disc pops when its number equals its line length; eggs crack after two pops
beside them; eggs rise on a drop timer.

Findings

1. [should-fix] Power-ups overflow. One power-up per chain of 3 (two for "Lucky Seven") means about one per 10
   drops; in a 211-drop Classic game I earned 21. Undo and Hold sat at the cap of 9 in several runs (Classic with
   power-ups: Undo 9, Hold 9 at the end; Daily: Undo 9 twice), so further awards were silently wasted. Either
   lower the rate, or say "Undo full" when an award is lost.
2. [nit] Blitz is very short: eggs every 5 drops, my bot lasted 41 and 46 drops (level 8 to 9). It reads as a
   different, harsher game rather than a faster Classic.
3. [nit] The drop interval falls one per level (20, 19, 18 ... about 8 by level 14). Every Classic run, with or
   without power-ups, ended between level 15 and 18 at about 200 drops, so skill moves the score but barely moves
   the length.

Checked and sound: the Next disc and the ghost disc match what drops; reload restores the well and the Next disc
exactly; Daily says "the same well for everyone today"; Smash, Crack and Hold do what their titles say.

Fun: chains are satisfying, eggs give real decisions. Not fun: late game is a timer you cannot beat. Score: 7/10

## Three

What it is: Threes-like one-step slides; 1+2=3, equal or neighbouring multiples of 3 merge (3+6=9, 6+9=15);
3-6-9 runs Flush for points and a power-up.

Findings

1. [should-fix] Power-ups are scarce: Flush is the only source and my bot saw 1 to 2 Flushes per game (always the
   first 3-6-9 / 9-6-3 run, "+54"), so a game earns 1 to 2 power-ups in 83 to 166 moves. In Endless the same
   number of moves earns 4 to 5. The tray rarely matters.
2. [should-fix] The neighbouring-multiples rule fragments big tiles. After 155 moves the board held 27, 33, 39, 63,
   69: each can only meet a partner exactly 3 apart or equal, so mid-sized tiles almost never pair and the board
   clogs. Repro: play any game past 100 moves and look at the top row. Games ended with "No moves left" at 83 to
   166 moves, far shorter than Endless. Consider limiting the neighbour merge to small tiles, or making Flush
   easier to form.
3. [nit] The end state keeps the board up while any power-up is held ("Stuck. Use a power-up to keep going."),
   which is good, but with only Undo left the only real option is to step back one move and get stuck again.

Checked and sound: Undo after a Flush reward rewinds score and power-up (84 -> 21, Smash 1 -> 0); the same move
replays the same reward. The Next tile matched the tile that entered in every case I could check. Reload restores
the board.

Fun: the help card is clear and the first Flush feels great. Not fun: the board locks quickly and the reward
system barely shows up. Score: 6/10

## Four

What it is: connect four with numbered discs; four of yours in a row, or any four in a row that sum to 10 with
at least two of yours.

Findings

1. [should-fix] Abandoning a game records nothing, so the record can be padded. Repro: Medium, drop two discs,
   tap New game, tap "Sure? This ends the game": the record stays "Medium: won 0, lost 0, drawn 0". Same when you
   switch level mid-game and come back. Count an abandoned live game as a loss (or at least show it).
2. [nit] Games are short: my bot's games lasted 5 to 15 of its own drops, median 7. Wins split evenly between
   "Four in a row" (22) and ten-lines (23), so both rules matter, which is good; shared ten-lines (two of each
   colour) go to whoever completes them, which makes the middle column a hot potato. That is interesting, but
   worth one line in the rules.
3. [nit] Disc numbers are weighted toward 1 (seen: 1 about 50 percent, 2 about 25, 3 about 13, 4 about 11). The
   Next and Computer chips show both numbers, so it is fair, just not stated.

Win rates: 2.5-ply bot Easy 13-2, Medium 12-3, Hard 8-7; random player on Easy 3-7. Clear ladder, Hard is a real
opponent and still beatable.

Checked and sound: Undo after a result is refused ("Not after a result. Start a new game."). Reload keeps the
board and both Next numbers (no rerolling your number).

Fun: the ten rule adds real arithmetic to connect four and both win types happen. Score: 8/10

## Five

What it is: two tiles each; add one of your tiles onto any tile; at 5 or more it bursts; burst both computer tiles.

Findings

1. [should-fix] With one tile left, your first tap is swallowed. Repro: reach a position where your left tile has
   burst (for example you 0 and 2, computer 0 and 3). Tap your 2, then tap the computer's 3: nothing happens, hint
   still "Your turn: tap one of your tiles." Tap the 3 again and the move goes through. It looks like the lone tile
   is pre-selected and the first tap deselects it. My scripts hit this 61 times across 8 sessions, every time with
   one tile left (once also with 2,2 vs 2,0).
2. [nit] The game is solved and says so ("perfect play always wins"). I confirmed it by full search: from
   1,1,1,1 the first mover loses, and every opening the computer used (it adds onto your left or right tile, or
   onto its own) is a win for you. My perfect player won 44 of 44 rounds across all levels; Hard never blundered
   (0 of 55 moves), Easy blundered often. The winning strategy is not trivial (186 positions, 28 of them with only
   one winning move out of six), so "beatable but not trivial" holds, but once learned every level plays the same.
   A Hard mode where you sometimes move first, or the computer gets one Shield, would keep it alive.
3. [nit] A burst at 5 also happens on overflow (4 + 4 bursts), which matches "at 5 it bursts" only if read as
   "at 5 or more". One word in the rules.

Checked and sound: Undo after a decided round is refused. Shield does not use your turn ("Shield is up. Now make
your move."). Split refuses a move that would burst your own tile ("Pick a valid tile").

Fun: tiny, tense, and honest. Score: 7/10

## Six

What it is: insert + - × ÷, √, ! and brackets so each line makes the gold target.

Findings

1. [should-fix] A page error fires when a bracket over the whole line is added or removed while another bracket
   exists. Repro: line "3 ? 3 ? 3", drag across numbers 1 to 2 (shows "(3 ? 3) ? 3"), then drag across 1 to 3: the
   page throws "Maximum call stack size exceeded" (shows "((3 ? 3) ? 3)"). Dragging 1 to 3 again to remove it throws
   again. 4 errors in 9 drags. Play carried on, but a recursion error in the evaluator is a correctness risk.
2. [should-fix] Replay value of Climb is low. Every line I saw is one number repeated (3,3,3 / 4,4,4,4 /
   49,49,49,49), Tier 1 is the ten classic digit puzzles, and the same lines came back in the same slots across runs
   (round 2 line 1 was 4,4,4,4 both times; 37,37,37 and 49,49,49,49 at 3/3 and 3/4 both times). Tier 2 longer lines
   are easier than Tier 1, not harder: 6,6,6,6 is 6 + 6 × (6 − 6) and 5,5,5,5,5 is 5 − 5 ÷ (5 − (5 + 5)), while
   Tier 1 holds the genuinely hard 0,0,0 ((0! + 0! + 0!)!) and 8,8,8 ((√(8 ÷ 8 + 8))!).
3. [nit] Skip can fish for easy lines: on the demo board Skip turned 8,8,8 (hard) into 5,5,5 (easy). That is what
   Skip is for, just note the effect on Climb scores.

Checked and sound: "Three clean lines" paid a power-up every third clean line. Show answer in Climb asks twice
and ends the run ("Run over ... The answer: (1 + 1 + 1)! = 6"); in Daily it gives up only the line. Hint names one
gap ("the 1st gap is ÷"), Peek one part ("5 5 make 1"). Every line I could not solve did have a valid answer when
revealed.

Fun: the best puzzle in the set when the line is hard; the grammar (signs on numbers and on brackets) is rich and
works. Not fun: tiers do not ramp, content repeats. Score: 7/10

## Fifteen

What it is: pick numbers 1 to 9; any three of yours summing to 15 wins (tic-tac-toe on the magic square).

Findings

1. [should-fix] Hard is a script. Without power-ups a perfect player draws every round: 15 of 15 draws, 0 matches
   won. With the one Erase it starts with, I proved by search that a perfect player always wins the round it is
   used in (from an empty board and after any computer opening), and in play I won 3 of 3 matches, each 1-0 with
   four forced draws. Those four rounds are dead time, and because "a round you win earns a power-up, unless you
   used Erase", Hard never pays a single power-up. Suggest one Erase per round, or ending the match once the result
   is fixed, or a reward for a clean draw.
2. [nit] Power-ups reset every match, so the round that wins the match pays a power-up you can never use
   ("You win the match ... +1 Peek", next match starts at Undo 1).
3. [nit] Erase is a double move (remove a computer number, then claim one, "not the one you erased"). Strong, and
   it is what makes Hard winnable, but the title only says "Remove one of the computer's numbers".

Win rates: perfect player Easy 9 wins 0 draws, Medium 8 wins 2 draws, Hard 0 wins 15 draws. Random player: Easy 3
wins 9 losses, Medium 0 wins 9 losses, Hard 0 wins 9 losses. Easy and Medium are a good ladder.

Checked and sound: Undo after a decided match is refused. Erase cannot be used to retake the erased number.

Fun: the Grid view reveal is lovely and Easy/Medium are winnable by thinking. Not fun: Hard. Score: 6/10

## Nine

What it is: Nim with heaps up to 9; best of five; each match won adds a heap; Misere unlocks.

Findings

1. [should-fix] On Hard the computer uses power-ups and the rules never say so. Repro seen: Hard, deal 2,5,5 (a
   win for you), you take the 2 leaving 0,5,5 (nim-sum 0, a lost position for the mover), toast "Computer used
   Pass", and now you are the one facing 0,5,5. I lost that round with perfect play. A separate Hard run showed
   "Computer used Add". The how-to text says only "Hard deals at random". Either show the computer's tray or state
   it in the rules.
2. [should-fix] Pass breaks Nim. One Pass turns any lost position (nim-sum 0) into a won one, because the computer
   then has to move from it. Pass is earned by winning rounds and stacks within a match (Pass 4 to 7 by the 5th
   match in my runs), so on Easy and Medium the Pass stock is pure surplus and on Hard it decides rounds. Consider
   capping Pass at 1, or making a Pass cost the round's reward.
3. [nit] Hard deals looked fair at round 1 (4 of 60 sampled deals were losing for you, about 7 percent, the same as
   uniform random), but twice I saw the identical losing deal repeat in the next round after a loss (4,3,7 then
   4,3,7; 4,2,6 then 4,2,6). I could not reproduce it on demand in a 23-round run, so treat it as a lead.
4. [nit] The Misere button only takes effect from the match-won overlay. Clicked at the start of the next match it
   does nothing (aria-pressed stays false, no message). Clicked on the overlay it switches on and starts the match
   ("Misere unlocked: the last take loses.").

Win rates: perfect player Easy 9-0, Medium 9-0, Misere Easy and Medium 12-0 each (winning deals as promised),
Hard 7-3 and 4-6. Random player: Easy 5-5, Medium 0-6, Hard 0-6.

Checked and sound: Undo after a round ends is refused. Reload keeps the heaps. Each match won adds a tile
("Next match: 4 tiles") as stated.

Fun: Learn mode plus a growing heap count is a good teaching ramp. Not fun: Pass makes the maths optional.
Score: 7/10

---

## Scores

| Game | Score |
| --- | --- |
| Endless | 8 |
| Sudoku | 7 |
| Fibonacci | 7 |
| Seven | 7 |
| Three | 6 |
| Four | 8 |
| Five | 7 |
| Six | 7 |
| Fifteen | 6 |
| Nine | 7 |

## Cross-game notes

- Undo after a result is refused in every game I tried (Four, Five, Nine, Fifteen, Sudoku), and Undo rewinds
  rewards correctly in Endless, Fibonacci and Three. Reload never rerolls anything. These are the strongest parts
  of the family.
- New game and level switches ask "Sure?" in most games. Four is the one where abandoning a live game also skips
  the record (finding Four 1).
- "Swap" means two different things in Endless/Fibonacci (any two cells) and Three (neighbours only).
