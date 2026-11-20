<!-- SPDX-License-Identifier: Apache-2.0 -->
<!-- Copyright 2026 alvations (Melon Lab) -->

# Mechanics review, round 3

Fresh reviewer, no memory of earlier rounds. I read only `docs/reviews/PERSONAS.md` and `games.json`.
Every game was served with `python3 -m http.server 8090` and driven headless from Node with scripted
players that read only the rendered DOM (tile text, aria-labels, the stat boxes, toasts) and pressed real
keys or clicked real elements. Reduced motion was on so every read saw a settled board. I looked at the
screenshots of every game's end states.

Players used:
- **random**: uniformly random legal move.
- **sensible**: what a casual but awake person does (take a win, block a loss, otherwise simple heuristics).
- **strong/perfect**: a real search. Sudoku: backtracking solver. Endless and Fibonacci: corner-weighted
  expectimax, depth 1. Seven: two-ply drop search over my own model of the pop rules. Three: one-ply
  greedy on my own model of the slide rules (matched the game on 1016 of 1041 checked moves). Four:
  depth-5 alpha-beta. Five and Fifteen: full game-tree solve (both games are tiny). Nine: xor (nim)
  strategy, and the correct misere endgame. Six: an exact-fraction expression search over + - x /,
  square root, factorial and one bracket group.

Scores at the end of each game section; summary table at the bottom.

---

## Endless

**Measured.** Random: 5 runs, 81 to 238 moves, top tile 64 to 256, 2 to 4 power-ups earned. Greedy:
3 runs, 409 to 847 moves, top 256 to 1024. Strong: 5 runs, 1162 to 1432 moves, all five reached 2048,
6 to 7 power-ups earned per run (the first award arrives around move 22 to 50, then roughly one per new
power of two). Undo is seeded: undoing a move and repeating it gives the identical spawn (tested twice),
so there is no spawn fishing. Reload mid-run keeps board, score and stock. Boosting the top tile itself
earns nothing ("Boosted to 64. Boosts earn no reward."). A locked board with power-ups left is not game
over; the "Stuck. Use a power-up to keep going." line is honest.

1. **[blocker] A power-up can earn a power-up: the "except on the move right after you use one" guard is
   one move long, so a one-move delay launders it.** Repro, seen three times by script:
   - Board with a 64 and a 32 in the same row, Boost in stock. Press 4, tap the 32 (it becomes 64). Press
     Up (a move that keeps the two 64s in line but does not merge them). Press Left: new tile 128, toast
     "New tile 128 +Swap".
   - Board with two 1024s not adjacent, Swap in stock. Press 3, tap one 1024, tap the cell next to the
     other 1024. Press Left (no merge). Press Up: "New tile 2048 +Swap". The Swap paid for itself.
   - In free play the same happened at moves 346/349 (Boost, then "New tile 1024 +Boost"), 414/417
     (Boost, then "+Boost") and 711/714 (Boost, then "New tile 2048 +Swap").
   Expected: a tile that a Boost or Swap made (or moved into place) never pays out, however many moves
   later it merges. Fibonacci already tags boosted tiles ("Boosted tiles earn no reward"); Endless should
   do the same for Boost and for Swap.
2. **[nit] The milestone schedule is very front-loaded and then sparse.** Strong runs earn 3 to 4
   power-ups in the first 150 moves and then 1 every 300 to 500 moves (1024 at ~350 to 560, 2048 at
   ~700 to 1400). Past 2048 the late game has almost no fresh tools, which is fine for "endless" but means
   the power-up row stops being part of the decision.

Fun: the corner game is intact, the rewards are visible and named in the toast, and stuck-with-tools is
handled well. Not fun: nothing new after 2048 except bigger numbers. **Score: 7/10** (8 once item 1 is
closed).

---

## Sudoku

**Measured.** 9 generated puzzles (3 per level): givens 40 / 32 / 26 exactly, and my solver found
exactly one solution for every one. Solved Hard in seconds by script; "Solved, 0:05 on Hard". Undo after
a solve does nothing, reload after a solve keeps the solved board. Power-up stock resets to Reveal 1 on
every new puzzle, so nothing carries over. Re-filling the same cells does not re-earn (the 9-cell count
is a high-water mark). A Revealed cell placed as the 9th fill does not earn (Reveal 1 -> 0, no award).
A clashing digit gets the red `bad` class immediately.

1. **[should-fix] Wrong digits earn power-ups.** Repro: Hard puzzle, fill 9 empty cells with digits that
   do not clash with anything on the board but are not the solution digit. Toast "9 cells filled:
   +Candidates". The rule text says "Every 9 cells with no clash", so it is honest, but it rewards
   guessing: a player can scatter plausible-but-wrong digits, collect Candidates/Check, then erase. The
   award should count cells that are correct, or be paid when the cell is confirmed by later play.
2. **[nit] "New best with power-ups." while the BEST box still says "none".** Repro: Hard, use one
   Reveal, solve. The overlay says "0:05 on Hard - 1 power-up used / New best with power-ups." but the
   BEST stat reads "none". Either show the assisted best somewhere or say "Not a clean best".
3. **[nit] Power-ups earned on the final fills are dead on arrival.** The last 9-cell award lands on the
   solving move (Hard solve ended with Reveal 1, Check 1, Candidates 3 unused) and the stock is wiped by
   New puzzle. Harmless, but the toast celebrates something that can never be used.

Fun: honest unique puzzles, clear difficulty steps, the clash colouring never lies about which digit is
right. **Score: 8/10.**

---

## Fibonacci

**Measured.** Random: 4 runs, 172 to 328 moves, top 55 to 144. Greedy: 3 runs, 375 to 1214 moves, top 144
to 610. Strong: 5 runs, 2022 to 5987 moves, top 987 to 4181. Boosting the top tile earns nothing
("Boost! Boosted tiles earn no reward"), and in four Boost-then-merge attempts the boosted tile never paid
out, so the Boost guard here is the right design. Undo is seeded, as in Endless.

1. **[blocker] Swap can earn a power-up.** Repro (scripted, top tile 610, a 377 elsewhere, Swap in stock):
   press 3, tap the 377 at row 1 col 3, tap the cell next to the 610 (row 1 col 2). Press Up (no merge,
   the pair stays in line). Press Left: 377 + 610 = 987, toast "New tile 987 +Undo". Same class as
   Endless 1. The tagging that already protects boosted tiles should also cover swapped tiles.
2. **[should-fix] The rule line does not mention the guard at all.** Endless says "except on the move
   right after you use one"; Fibonacci's text says only "Every new highest tile from 55 up earns a
   power-up". A player cannot predict that a boosted tile pays nothing.
3. **[nit] Runs are very long for what they give.** A competent run is 2000 to 6000 moves to reach 987 to
   4181, with power-ups 300 to 1500 moves apart in the second half. Same corner strategy as Endless with a
   slower clock. The neighbour-merge rule is a nice twist early, but by move 1000 it plays like Endless
   in slow motion.

**Score: 6/10.**

---

## Seven

**Measured.** Classic: random 60, 77, 147 drops (levels 3 to 9, 3 to 11 power-ups); my two-ply player
120, 196, 221 drops (levels 7 to 19, 6 to 20 power-ups). Blitz: random 37, 42, 52 drops; my player 16,
31, 42 drops (Blitz is short and swingy: my "strong" player did worse than random here). Daily: 202 drops,
58,409, twice in a row with identical play and an identical result. Smash and Crack that set off pops
score but never earn (8 Smash-triggered and 6 Crack-triggered pop sequences checked, toasts plain
"Smash!" / "Crack!"). Earn-then-Undo is honest: "Chain of 6! +Undo" then Undo removes the reward and
spends the Undo; redoing the same drop re-earns it, as expected for a seeded game.

1. **[should-fix] Game over is declared while Undo is still in stock, and Undo then revives the game.**
   Repro: Classic, play until "The well overflowed" with Undo 1 or more (my Classic run ended with Undo 5,
   screenshot `seven-Classic-strong-1`). Press 1: the overlay disappears and the game continues with one
   fewer Undo. Endless treats a usable power-up as "not over yet"; Seven shows the final score, the "New
   best." line and the end overlay, then lets you play on. Either do not end while Undo can save the run,
   or put an Undo button on the overlay and do not record the result until it is dismissed.
2. **[should-fix] Undo stock piles up.** Undo is one of the four reward types and is never capped low:
   random play ended with Undo 8, my player with 5 to 7. Combined with item 1, a long Classic game has
   several free lives late on. Consider weighting rewards away from Undo once you hold 3.
3. **[nit] Daily can be replayed without limit.** Same seed, same sequence, so a player can learn the
   whole day's discs and replay for score. If Daily is meant as a one-shot daily challenge, lock the
   second attempt (or mark it "practice").

Fun: the pop/egg/chain loop is the most "number puzzle" of the arcade games and chains feel earned.
**Score: 7/10.**

---

## Three

**Measured.** Random: 26, 27, 108 moves (top tile 18 to 72). Greedy: 64 to 279 moves over 7 games (top
tile 18 to 144), 1 to 10 flushes per game, each flush paying one power-up ("Flush 3-6-9, +54 +Swap").
Power-up guards hold: 9 flushes I built with Swap and 8 built with Third all scored but toasted
"(no power-up)". Move model check: my model of the one-step slide agreed with the game on 1016 of 1041
moves; the 25 differences were all spawn-adjacent reads, not rule differences.

1. **[nit] "Stuck" with only Undo left is a near dead end that still asks you to "Use a power-up".** Repro:
   play until no swipe moves anything, with Undo 1 and the other three at 0. Message: "Stuck. Use a
   power-up to keep going." Undo takes one step back, the spawn is seeded, and most of the time every
   other direction leads back to a stuck board. It is honest but reads like a lifeline that is not one.
2. **[nit] Early runs die very fast under casual play.** 2 of 3 random runs ended by move 27 with a score
   near 120 and no power-up ever earned (flush needs a line of 3, 6, 9 which casual play rarely builds).
   The "How it works" sheet helps, but the first power-up arrives late for a new player.

Fun: the flush is a genuinely new idea in the slider family and the guard against power-up flushes is
right. **Score: 7/10.**

---

## Four

**Measured (10 games each, my record vs the computer).**

| Level | strong (depth 5) | sensible (depth 2) | random |
|---|---|---|---|
| Easy | 8-2 | 8-2 | 0-10 |
| Medium | 8-2, then 16-9 over 25 more | 7-3 | 0-10 |
| Hard | 5-5 | 5-5 | 0-10 |

Games last 13 to 17 of my turns. Power-ups are scarce: 0.3 to 0.7 earned per game. A completed ten with
two of each colour is won by whoever places the last disc ("2 + 3 + 4 + 1 = 10" with two of mine and two
of the computer's went to the computer when it completed it), which matches the rule text. Undo on the
loss overlay is refused (record stays 0-1), New game mid-game records a loss (0-1), reload during
"thinking" resumes and the computer still moves. Tune offers only 1 to 4; I used Tune four times to
raise my open ten-threats (0 -> 3, 1 -> 5, 2 -> 5, 3 -> 5 by my count) and none of those earned a
power-up, so I found no Tune chain.

1. **[should-fix] Easy and Medium are the same strength to anyone who blocks threes.** 8-2 vs 8-2 for the
   strong player, 8-2 vs 7-3 for the sensible one. Hard is clearly harder (5-5). Medium needs its own
   identity (deeper search, or the ring hint only on Easy).
2. **[should-fix] Easy beats a random player 10-0.** Random play is a poor proxy for a child, but the
   computer on Easy never lost a single game to it in 10. An Easy that occasionally misses a ten would
   give a new player a first win.
3. **[nit] Discs are "mostly 1s" but the sum-ten wins I lost were all built from 1 to 4 discs the
   computer placed; I never saw the Hard computer use Pop, Hold or Tune in 10 games** (no toast or board
   change that looked like one). Either it is rare or it is not visible; if it happens it should be
   announced.

**Score: 7/10.**

---

## Five

**Measured (6 matches each, rounds in brackets).** Perfect play (full game-tree solve): Easy 6-0 (18-0),
Medium 6-0 (18-0), Hard 6-0 (18-0). Sensible: Easy 6-0 (18-1), Medium 3-3 (14-13), Hard 3-3 (13-14).
Random: Easy 1-5 (10-16), Medium 1-5 (8-17), Hard 0-6 (0-18). Rounds last 2.6 to 4 of my turns. The solve
confirms the claim "you can always win": from 1,1,1,1 with the computer to move, the computer is lost, and
every start I was handed was a won position for me (88 of 88). The Hard computer never made a losing
move (0 blunders in 83 replies); Easy and Medium blunder (17 of 61 and 11 of 57 replies against random).
Each burst of a computer tile earns a power-up ("Burst! +Shield"). Nudge that bursts a computer tile
does not earn (3 checks, plain "Burst!"), so no Nudge chain.

1. **[should-fix] Hard is the same game every round.** Over 12 Hard rounds the start was always 2,1,1,1 or
   its mirror 1,2,1,1 (the computer always plays the same opener). The winning reply is unique up to
   symmetry: add your 1 onto a computer tile (2,1,2,1 or 2,1,1,2); every other reply loses. Once a player
   finds that, Hard is a fixed 4-move script that wins 18-0. Medium at least varies (I saw 1112 and 1121
   openers). Hard needs varied opening values, or a choice of who starts.
2. **[should-fix] The rule text never says how power-ups are earned.** It explains tapping, bursting and
   "first to 3"; the only way to learn that bursting a computer tile pays is to see the toast.
3. **[nit] The game is fully solved by a ten-line search, so the power-ups (Split, Shield, Nudge) are
   never needed by a player who knows the line**, and are a crutch for one who does not. That is fine on
   Easy; on Hard it removes the reason to earn them.

**Score: 5/10.**

---

## Six

**Measured.** Climb with my solver (single bracket group only): 5 runs made 5, 10, 14, 14, 14 lines
(reaching round 3 line 3 three times). Each loss was a line my solver could not express, so the Show
answer text was recorded and checked by hand; every answer shown evaluated to the target. Daily Six:
4 of 6 made by my solver, the other two needed nested brackets ("((37 + 37 + 37) / 37)! = 6") and joined
digits ("sqrt((7474 - 74) x 74) - 74 = 666"). Skip resets the clean streak: I used Skip after 5 clean
lines and the next award came 3 solves later ("Three clean lines: +Hint"), so Skip cannot launder a
reward. Hint shows one step ("Hint: the 1st gap is +").

1. **[should-fix] Round 1 line 6 under the banner "TIER 1 - + - x /" needs two bracket groups.** Repro:
   Climb, new game, solve lines 1 to 5; line 6 was 13 13 13 13 13 -> 6 in one run and 11 11 11 11 11 -> 6
   in another. Shown answers: "(13 x 13 - 13) / (13 + 13) = 6" and "(11 x 11 + 11) / (11 + 11) = 6".
   Two of five Climb runs ended there. That is the hardest line of round 1, labelled with the easiest
   tier, at the point where Show answer ends the whole run. Either label brackets as part of tier 1, or
   keep the boss line inside what tier 1 teaches.
2. **[nit] Clear needs two presses when a bracket group exists.** Repro: drag across the first two numbers
   (expression "(3 + 3) ? 3 ? 3"), press Clear: the expression is unchanged; press Clear again: it clears.
3. **[nit] Daily Six can be replayed with the same lines.** Two sessions gave the identical six lines.

Fun: the best puzzle in the set; the tiers teach real ideas (roots, factorials, joining digits) and the
shown answers are elegant. **Score: 7/10.**

---

## Fifteen

**Measured (6 matches each, rounds W-L-D).**

| Level | perfect | sensible | random |
|---|---|---|---|
| Easy | 18-0-1, matches 6-0 | 18-1-2, 6-0 | 4-17-4, 0-5 (1 drawn) |
| Medium | 17-0-5, 6-0 | 8-3-17, 3-0 (3 drawn) | 0-18-4, 0-6 |
| Hard | 0-0-30, every match "Match drawn 0-0 - 5 drawn" | 0-8-20 | 0-18-5 |

A win without Erase or Double earns one power-up (12 earned in 6 Easy matches). Abandoning a match with
New game records a loss. The Hard computer never beat the perfect player in 30 rounds.

1. **[should-fix] Hard cannot be won by play, and it never pays the power-ups that are the only way to win
   it.** Fifteen is tic-tac-toe in disguise, so perfect play on both sides draws; 30 of 30 Hard rounds were
   drawn, 6 of 6 matches ended 0-0 with five draws. The only wins I got on Hard came from the Erase the
   game hands you ("Your turn; you hold an Erase."): 3 wins in 3 matches using it, and "Win a round without
   Erase or Double to earn a power-up" means Hard then never awards anything. The Hard economy is closed:
   one gifted Erase per match decides the match. Hard needs a real edge for the player (first move, a
   power-up that can be earned by a draw, or a computer that sometimes takes a risk).
2. **[should-fix] Medium is barely harder than Easy for a perfect player** (17-0-5 vs 18-0-1) and much
   harder for a casual one (random 0-18 vs 4-17). The step that matters for the people who need it is
   real, so this is the softer half of item 1.
3. **[nit] Erase's follow-up rule is only in the prompt.** After Erase the hint says "Now claim a number
   (not the one you erased)", which I learned by trying to re-claim it; the power-up label says only
   "Remove one of the computer's numbers, then claim one."

**Score: 5/10.**

---

## Nine

**Measured (5 matches each, rounds).** Perfect (xor): Easy 15-0, Medium 15-0, Hard 14-5 (matches 4-1;
4 of 19 Hard deals were losing starts, as the text promises). Sensible: Easy 15-4, Medium 15-5, Hard 1-15.
Random: Easy 8-11, Medium 1-15, Hard 0-15. Every Easy and Medium deal was a winning start (35 of 35). A
match win adds a tile (3 -> 4 -> 5 -> 6 -> 7 heaps over five matches), which lengthens rounds from ~4 to
~10 turns. Misere unlocks after the first match win; toggling it starts a fresh 3-tile match and perfect
misere play won 9-0. One round lost from a winning start on Hard is consistent with the Hard computer's
Pass and Add.

1. **[should-fix] Peek leads straight to an earned power-up.** Repro: Hard, any won-position deal, hold a
   Peek. Press Peek: "Peek: take 6 from the 9." Follow it and play on; the round ends "Round won ... +Pass".
   The rule excludes only Add and Pass, so a Peek bought the win that paid the next power-up (and the
   reward can be Peek again). Either exclude Peek like Add and Pass, or show it does not count.
2. **[should-fix] Easy and Medium are solved by one rule.** Every deal is a won position, so a player who
   learns "make the xor zero" wins 100% forever; only Hard has any tension. Medium could deal a losing
   start now and then (with the computer allowed to slip), so the strategy has to be applied, not just known.
3. **[nit] The Learn panel and Peek both teach the xor trick**, which is great for teaching, but combined
   with item 2 it means the game teaches you to stop needing it within a few matches.

**Score: 7/10.**

---

## Cross-game notes

- **Abandoning is honest everywhere I tried it:** New game mid-match records a loss in Four, Five, Fifteen
  and Nine (record 0-1 after one move and quit). Reload during "The computer is thinking" resumes cleanly in
  all four.
- **Undo is honest everywhere I tried it:** seeded (no spawn fishing in Endless, Fibonacci, Seven), and it
  removes a reward it rewinds past (Seven: "+Undo" earned then undone leaves Undo 0).
- **The power-up chain question, per game:** Endless (Boost, Swap) and Fibonacci (Swap) can earn a
  power-up; Nine's Peek can buy a win that earns one. Sudoku (Reveal), Seven (Smash, Crack), Three (Swap,
  Third), Five (Nudge), Six (Skip) and Four (Tune, as far as I could test) are guarded.

## Scores

| Game | Score |
|---|---|
| Endless | 7 |
| Sudoku | 8 |
| Fibonacci | 6 |
| Seven | 7 |
| Three | 7 |
| Four | 7 |
| Five | 5 |
| Six | 7 |
| Fifteen | 5 |
| Nine | 7 |
| **Family** | **6.6** |

## Top findings

1. [blocker] Endless: Boost or Swap, one neutral move, then the merge earns a power-up ("New tile 2048 +Swap").
2. [blocker] Fibonacci: Swap a tile next to the top, one neutral move, merge: "New tile 987 +Undo".
3. [should-fix] Fifteen Hard: 30 of 30 perfect rounds drawn; only the gifted Erase wins, and Hard then never awards.
4. [should-fix] Five Hard: same opener every round, one winning reply, perfect play 18-0 at every level.
5. [should-fix] Nine: Peek shows the winning move and the resulting won round still earns a power-up.
6. [should-fix] Seven: "The well overflowed" shows with Undo in stock; Undo then revives the game.
7. [should-fix] Six: round 1 line 6, labelled tier 1, needs two bracket groups and ends 2 of 5 Climb runs.
8. [should-fix] Sudoku: 9 wrong-but-non-clashing digits earn a power-up.
9. [should-fix] Four: Easy and Medium play the same for a decent player (8-2 and 8-2); Easy beats random 10-0.
10. [should-fix] Nine Easy and Medium always deal a won start, so one xor rule wins 100% forever.
