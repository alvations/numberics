<!-- SPDX-License-Identifier: Apache-2.0 -->
<!-- Copyright 2026 alvations (Melon Lab) -->

# Round 4, mechanics review (fresh reviewer)

Played only through the rendered page: headless Chromium at 390x844, served on port 8095, every game on a fresh
profile unless a test needed saved progress. I read only `games.json` and `docs/reviews/PERSONAS.md` (brief 2).
Every number below comes from a scripted player reading the DOM (tile positions from `--r`/`--c`, labels,
counters, overlay text) and from screenshots I looked at. Scripts and logs: the reviewer scratchpad `qa4-mech/`.

How I tested the new layer:

- **Animation honesty.** For the slide games I kept my own model of the rules, pressed a key, read the board
  that the DOM claims (tiles without the `gone` class) at 0 ms, and compared it with the model plus exactly one
  spawn. I did this with 260 ms waits and with no wait at all (key spam, about one key every 10 to 20 ms). After
  each game I also compared every tile's on-screen box with its grid cell.
- **Input under spam.** Rapid key and tap bursts during slides, drops, chains and the computer's turn, then a
  count of what landed against what the game reports.
- **Opponents.** Scripted players at Easy, Medium and Hard: a random player, a sensible one-ply player (Four),
  and perfect solvers where the game is small enough (Five, Nine, Fifteen).
- **Daily, trophies, memory.** Playwright's clock moved across days and across midnight with a page open;
  Settings Save, Erase, Load round trip with real progress; a corrupt save file.

Where it says "Easy", that is the level a first visit selects in every vs game (checked: Four, Five, Nine and
Fifteen all open with Easy pressed).

---

## Two (Endless, the root page)

Measured: 2 fast-spam games (150 and 290 moves, top tiles 128 and 256) and 1 slow game to 128, plus a
power-up honesty run. **Zero** model mismatches, zero duplicate tiles, score delta always equal to the merge sum,
no misplaced or lingering ghost tiles after settling, no console errors.

1. [nit] Undo is honest, but the stock arithmetic is worth knowing. Repro: with Undo 1, make a move that creates
   the first 32 (stock shows Undo 2, the reward was an Undo), press `1`: the board returns and Undo shows 0, not 1.
   The reward is taken back and the Undo is spent. Redo the same move: same spawn, Undo 1 again. So undo cannot
   farm, and the seeded spawn means undo cannot re-roll either. Correct; it just reads as "I lost one" at a glance.
2. [nit] Smash leaves no mark, so only the single move right after it is unpaid. A Smash that opens a merge which
   you make two moves later can still pay. I did not see it happen in 40 post-Smash moves, so this is design
   intent to confirm, not a bug.

Fun: yes. The award ladder (32, 64, 128 ...) lands about every 50 to 100 moves, and "Stuck. Use a power-up"
instead of an instant game over is a good beat. **8.5/10**

## Fibonacci

Measured: 3 fast-spam games (374 to 477 moves, top tiles 144, 144, 233), one slow game to 610. Zero model
mismatches with the rule "neighbours in the run join, equal tiles do not except 1 and 1"; spawns are only 1 or 2.

1. [nit] Undo across an award behaves exactly as in Two (Undo 1 -> reward -> Undo -> 0 -> redo -> reward again).
   Honest.
2. [nit] Awards arrive at 55, 89, 144, 233, 377, 610: one per Fibonacci step, so the gap between rewards grows
   by about 1.6x each time while Two's doubles. Fine, but late Fibonacci feels stingier than late Two.

Fun: yes, more thinky than Two. **8/10**

## Three

Measured: 2 fast-spam games, 1 slow game, 3 flush probes, 33 normal moves checked against a one-step model
(33 match, 0 miss). Value sum is conserved on every normal move (sum after = sum before + the Next tile).

1. [should-fix] **After a flush the board shows tiles that are no longer there, for 0.6 to 1 s.** Repro (seen 3
   times out of 3): make any flush, for example a column `9, 6, 3`. Immediately the score jumps (+54 plus bonus) and
   the toast says "Flush 9-6-3, +54 +Third", but the three flushed tiles stay drawn in their cells as normal
   tiles (no `gone` state) and the tile that the same swipe spawned is missing. Only at roughly 1000 ms do the flushed
   tiles vanish and the spawn appear. Example from the log: before `[[2,2,1,0],[2,9,1,6],[6,3,1,0],[3,2,3,0]]`,
   Right; at 0 to 600 ms the page shows `[[0,2,2,1],[2,9,1,6],[0,6,3,1],[0,3,2,3]]` (9, 6, 3 still in column 1, no
   spawn); at 1000 ms it shows `[[1,2,2,1],[2,0,1,6],[0,0,3,1],[0,0,2,3]]`.
2. [should-fix] **A swipe made inside that window is applied to the hidden board, not the one on screen.** Repro:
   flush, then press Up 150 ms later. The result is the Up move applied to the post-flush board (flushed column
   empty, the unseen spawn present); a player who aimed at the drawn tiles gets a different result. The input is
   not lost, which is good, but the screen lied when the decision was made. Either remove the flushed tiles at once
   (fade them, but mark them gone) or hold input until they are gone.
3. [nit] Flushes are rare for a careless player: about one per 50 swipes in my runs, and each pays one power-up,
   so in a 58-swipe game the tray barely moves. The flush is the whole hook; the How to play sheet could say
   "3, 6, 9 in a row or column, in either order" (I saw 9-6-3 count, which surprised me in a good way).

Fun: yes when a flush lands; the 1 s phantom board takes the shine off fast play. **6.5/10**

## Four (vs computer)

Measured (fresh profile each batch, first-visit level Easy):

| Level | Player | Won | Lost | Drawn | Avg plies |
|---|---|---|---|---|---|
| Easy | one-ply (win, block, avoid giving a win) | 16 + 8 | 4 + 0 | 0 | 5.3, 7.1 |
| Easy | random column | 4 + 1 | 16 + 7 | 0 | 6.8, 6.3 |
| Medium | one-ply | 6 | 6 | 0 | 7.0 |
| Hard | one-ply | 5 | 7 | 0 | 6.7 |

Every end screen matched the board (I recomputed every "four in a row" and every "a + b + c + d = 10" claim);
the disc I dropped always had the value shown in Your next; triple taps and triple Enter during the computer's
turn place exactly one disc. Easy is beatable by anyone who blocks, and punishes random play: a fair first level.

1. [should-fix] Easy often does not block a plain vertical three. My one-ply player favours the centre column, and
   in 5 of 20 Easy games it won with four of its own colour within 4 or 5 of its drops, mostly straight up
   column 4. Repro: Easy, keep dropping in column 4; the computer often answers elsewhere and lets the fourth disc in. Easy should still look
   like it is trying; a missed vertical three is the most visible miss in the genre.
2. [nit] A line of four that makes ten with two discs of each colour counts for whoever completes it. I saw it go
   both ways ("2 + 4 + 2 + 2 = 10" for me, "1 + 4 + 3 + 2 = 10" for the computer). Consistent, but nowhere says so;
   one line in How to play would stop "that was mine" arguments.
3. [nit] On Hard the computer's disc can differ from the Its next value shown before my move (shown 1, dropped 3),
   because it uses Tune. Correct per the rules, but say it in the hint when it happens ("It used Tune").
4. [nit] After the computer's winning drop the result overlay appears a beat later (over 250 ms). Taps in that
   beat are correctly ignored.

Fun: yes, the ten rule makes every column interesting. **8/10**

## Five (vs computer)

Measured: perfect solver (full game tree of "add one tile onto any other live tile; five or more bursts"),
random player, and an Undo test.

| Level | Player | Rounds won |
|---|---|---|
| Easy | solver | 6 / 6 |
| Easy | random | 5 / 15 |
| Medium | solver | 12 / 12 |
| Medium | random | 4 / 15 |
| Hard | solver | 12 / 12 (3.4 plies a round) |
| Hard | random | 1 / 15 |

1. [blocker] **Five is solved and the computer always takes the losing side.** From `1 1 | 1 1` the player who
   moves first loses with perfect play (my solver: value -1 for the mover), and in every round I played (more than
   45) the computer moved first. After any of its four possible openings the player has 2 to 6 winning replies, and a
   memorised line wins every round on Hard in about 3 to 4 plies. Repro: Hard, every round: if it added onto its
   own tile, add your 1 onto its 2 (or onto your own tile); if it added onto your tile, add your 2 onto one of its 1s;
   then keep answering with the solver's move. The difficulty only decides how fast a
   non-expert loses (random player: 33% of rounds on Easy, 7% on Hard). Suggest alternating who opens, a random
   start, or a rule change (for example a roll-over burst or splits as a normal move) so the start is not a known
   loss for the opener.
2. [should-fix] Undo still pays out in full. Repro: Hard, make a blunder, let the computer reply, press Undo, then
   win the round: "earned Shield, Shield" (or "Undo, Nudge"). Two power-ups per round won, Undo included, so
   Undo -> win -> +Undo is a loop where a power-up earns a power-up. Nine already says "No power-up: you used Add,
   Pass or Peek this round"; Five should treat Undo the same way, or pay one power-up, not two.

Fun: the arithmetic is cute for three rounds, then it is a memory test. **4.5/10**

## Six

Measured: 14 Climb lines, both daily days; the live `= value` checked against a standard evaluator for random
sign choices (fractions shown exactly, for example `= 4/3`; `4 + 4 + 4 ÷ 4 ÷ 4 = 8.25` correct).

1. [nit] A line is accepted the instant any intermediate state equals the target, even while you are still cycling
   other gaps (`6 ÷ 6 × 6` with the third gap untouched counted on line 1; `3 × 3 − 3` too). Correct maths and
   friendly, but it means cycling signs at random solves many tier-1 lines without thought.
2. [nit] "Show answer" on a line that needs brackets says "This line needs ( ) Brackets. Tap again to end the run."
   It is a run-ender behind a second tap, which is good; the first tap should say "ends the run" before the hint
   about brackets, so the warning comes first.
3. [nit] Daily Six is the same on reload and different the next day (checked 21 and 22 Nov). I did not finish a
   Daily Six, so I cannot speak to its completion and chip.

Fun: yes, the best "aha" game of the set. **7.5/10**

## Seven

Measured: Classic 4 games (34 to 49 drops, scores 788 to 3629), Blitz 2 games (14 and 26 drops), Daily 4 runs.
After every drop I waited for the well to settle and checked: no floating discs, and no disc showing a number
equal to its column count or its row run. No lasting violations. During a chain a still-poppable disc can stay
on screen for more than 600 ms between steps; that is the chain being shown step by step, not a lie.

1. [should-fix] **Daily can be replayed the same day, and the home chip keeps the last run, not the first or the
   best.** Repro (clock at 21 Nov 12:00): Daily, play to the end, End the run: chip "Seven Done · 3,307". Daily again
   (a fresh Level 1 board with the identical seed), drop everything in one column: chip "Done · 164". Again: "Done ·
   2,710". Sudoku's Daily locks after one solve ("Today's Daily is done"); Seven's should either lock, or keep the
   first score as the day's result and call replays practice.
2. [nit] Rapid taps are all honoured: five taps 0 to 120 ms apart took the counter from "20 drops" to "15 drops"
   every time, and the discs land in the tapped columns. Good, but spamming during a chain means drops land on a
   board you have not seen settle. A short input lock during chains would be kinder; not a bug.
3. [nit] A Daily left open across midnight keeps the old seed (drop counter carries on from 20 to 19). A fresh
   load after midnight gets the new board. Acceptable, but the run should not count as the new day's daily.
4. [nit] Random play earns "Chain of three", "Lucky sevens" and "Cascade" in the first run. Honest (the chains did
   happen) but they are free; they will mean little to a real player.

Fun: yes, the chains are the best spectacle in the collection. **7/10**

## Nine (vs computer)

Measured: nim-sum player and random player, normal rules, three levels, 12 rounds each; a power-up reward test.

| Level | Player | Rounds won | Starts that were already lost for me (nim 0) |
|---|---|---|---|
| Easy | nim-sum | 12 / 12 | 0 / 12 |
| Easy | random | 8 / 12 | 0 |
| Medium | nim-sum | 12 / 12 | 0 / 12 |
| Medium | random | 0 / 12 | 0 |
| Hard | nim-sum | 8 / 12 | 3 / 12 |

Every computer reply was one legal take (or a Pass on Hard, announced "Computer used Pass").

1. [should-fix] The step from Easy to Medium is a cliff. Easy lets a random player win two thirds of the rounds;
   Medium never let a random player win a single round (0 of 12, four matches lost 0-3). Medium looks like perfect
   play from a position that is a win for the player. Something between (a mistake rate of 20 to 30%) would keep
   Medium a learning level.
2. [should-fix] Easy and Medium always hand the player a winning start (0 of 24 starts had nim-sum 0). A player
   who learns the xor trick wins every round on both, forever. Hard is honest about it (3 of 12 starts are lost and
   the computer can Pass).
3. [nit] Power-up rewards are honest: a round won after using Pass or Peek says "No power-up: you used Add, Pass or
   Peek this round" and pays nothing (checked 3 times). Undo is not on that list; in Nine it cannot rescue a lost
   position against perfect play, so it does not matter much here.

Fun: yes for one session; the growing tile count per match is a nice ladder. **7.5/10**

## Fifteen (vs computer)

Measured: perfect minimax player and random player, 10 to 14 rounds per level, plus reward checks.

| Level | Player | Won | Lost | Drawn |
|---|---|---|---|---|
| Easy | perfect | 5 + 10 | 0 | 0 + 2 |
| Easy | random | 4 | 8 | 0 |
| Medium | perfect | 3 | 0 | 7 |
| Medium | random | 1 | 8 | 3 |
| Hard | perfect | 0 | 0 | 10 |
| Hard | random | 0 | 11 | 1 |

All win claims matched the numbers held; triple taps claim exactly one number per turn.

1. [should-fix] **Hard cannot be won, and draws are not recorded.** Hard plays perfectly, so perfect play can only
   draw (10 of 10), and power-ups (Erase, Peek, Double) are only earned by winning rounds (draws paid nothing in
   every case), so a Hard player never gets the tools that could break a draw. After two full drawn matches the
   Record still reads "none". Repro: Hard, play the centre and mirror: "Draw | Nobody made 15 · Match drawn 0-0 ·
   5 drawn · Hard", Record none. Either let Hard make a rare slip, or pay a power-up for a drawn round on Hard, and
   record draws.
2. [nit] When the last round of a won match is a draw the overlay reads "You win" over "Nobody made 15 · Match won
   1-0 · 4 drawn". Say "Match won" in the heading so the draw and the win do not share one line.
3. [nit] Earned power-ups do not carry from one match to the next, with no message. Repro: Easy, end match 2 with
   stock Undo 1, Erase 2; after round 1 of match 3 the tray shows Undo 2, Erase 0. If this is intended, tell the player
   at match end ("Power-ups reset").

Fun: Easy is a gentle intro to the magic square; Hard is a draw machine. **6.5/10**

## Sudoku

Measured: 3 Dailies on three simulated days (21, 22, 25 Nov) solved by a script, 1 Easy, all through cell and
number-pad taps.

1. [should-fix] **There is no daily streak to test.** The home "Today" strip shows "Not yet" or "Done · time" per day
   and nothing else; skipping 23 and 24 Nov changed nothing visible. If streaks are meant to be part of this round,
   they are not there for any of the three dailies.
2. [nit] Daily difficulty changes by day (Medium, Hard, Easy on my three days). Good variety, but the Daily's Best
   time is per day, so "Best 0:04" on Hard and "Best 0:03" on Easy sit in the same slot.
3. [nit] Trophies here fired honestly: Medium solved, Hard solved, Pen only (Hard without power-ups), Quick pencil
   (Easy under five minutes, earned by the Daily Easy), Daily grid, and the two marked secret ones (In your head, Not
   one slip) all fired on the solves that earned them, and only then.
4. [nit] A three-second scripted solve is accepted and earns Quick pencil. No anti-bot is needed in a local game;
   noting it only because times this short land in Best.

Fun: a clean, fair Sudoku. **8/10**

---

## Across the collection

### Trophies
1. [should-fix] **The Trophies sheet lists only what you have already earned.** On a fresh profile it says "Nothing
   yet. Play any game to begin." and never shows a locked trophy, so a player cannot see a goal to aim for. Secret
   trophies (the ones with the sparkle, for example "In your head", "Not one slip") are found by play, which is
   right; the plain ones should be visible while locked.
2. [nit] "Night owl: Played well past bedtime." fired during my first Four game at 02:22 local time. Honest, but
   it is a free trophy for anyone in a late time zone.
3. Every other trophy I saw ("Hello, numbers", "Same for everyone", "Daily well", "Fifteen!", "Match won",
   "The middle way", "First flush", Sudoku's set) fired on the action its text names and not before.

### Daily and day change
1. [nit] **The home "Today" label goes stale across midnight.** Repro: set the clock to 25 Nov 23:59:30, load the
   home page ("Today · Wed, Nov 25"), let 60 s pass: it still says Wed, Nov 25. A reload shows the new day.
2. Sudoku, Seven and Six dailies are identical on reload and different the next day (checked 21, 22, 25 Nov).

### Settings memory (Save, Load, Erase)
1. Round trip works. With an Easy Sudoku solved, a Two game in progress (score 184, top tile 32) and five trophies:
   Save downloaded `numberics-save.json` (about 22 KB); Erase asks "Sure? Erase everything" and then wipes bests,
   the board in progress, the "Best" badges on the cards and the trophies; Load of the saved file restored all of it,
   including the Two board tile for tile.
2. [nit] Loading a corrupt file (`{"game":"numberics","v":1,"data":"garbage"}`) does nothing and says nothing.
   It should say "That file could not be read".
3. [nit] Load replaces everything at once with no "Replace your current progress?" step, while Erase has one.

### Can a power-up still earn a power-up?
- Two, Fibonacci: no. Undo takes the reward back; the move after Smash, Swap or Boost does not pay.
- Three: not tested directly (I could not engineer a power-up-made flush on demand).
- Five: **yes**, through Undo (see Five 2).
- Nine: no for Add, Pass, Peek (the end screen says so). Undo is not suppressed.
- Fifteen: no power-up use observed paying; draws never pay.
- Seven, Four, Six, Sudoku: no case found.

### Input under spam
- Two, Fibonacci: thousands of keys at about 50 per second, zero dropped or misapplied moves.
- Three: normal moves are honest; the flush window is not (Three 1 and 2).
- Seven: every tap counted.
- Four, Five, Nine, Fifteen: no double moves, no input accepted during the computer's turn.

---

## Scores

| Game | Score |
|---|---|
| Two | 8.5 |
| Fibonacci | 8 |
| Three | 6.5 |
| Four | 8 |
| Five | 4.5 |
| Six | 7.5 |
| Seven | 7 |
| Nine | 7.5 |
| Fifteen | 6.5 |
| Sudoku | 8 |
| **Collection** | **7.2** |
