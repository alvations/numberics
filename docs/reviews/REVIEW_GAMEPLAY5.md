<!-- SPDX-License-Identifier: Apache-2.0 -->
<!-- Copyright 2026 alvations (Melon Lab) -->

# Review round 5: mechanics (rules only)

Reviewer 2 of the panel. I judged the rules: are they honest, interesting and fair, are the power-ups meaningful,
is the computer beatable but not trivial, and where can the rules be bent. I read the engines and `docs/DESIGN.md`
only to build bots; I did not read earlier reviews or triage. Every number below is a seeded bot run against the shipped
engine (Node), and the browser checks ran in headless Chromium against `python3 -m http.server 8072` at 390x844 and
1280x860. The bot scripts are throwaway (scratchpad); each finding says enough to rebuild the measurement.

Bots used:
- **Nine**: beginner (with two tiles left, makes them equal; otherwise a random take; takes a lone last tile), learner q
  (the winning move with chance q, else the beginner), perfect (always a winning move when one exists). "+powers" plays
  Pass, then Add, whenever it stands in a losing position.
- **Fifteen**: random; sensible (take a win, block a threat, else 5 half the time, else random); perfect (solver);
  "+erase" uses an Erase only when the solver says it wins; "naive eraser" erases a computer number only when the
  computer has a fork.
- **Five**: random, greedy (the engine's own greedy), learner 50 (perfect half the time, else greedy), perfect (table).
- **Seven**: one-ply greedy (score gained minus 40 per stack height, minus 300 per top-row column), Undo on the brink;
  "+powers" also Smashes a top-row disc and Cracks when the well is tall.
- **Two / Fibonacci**: empty cells + smoothness + corner bot, Smash / Undo / Swap / Boost only when locked.
- **Three, Four**: the repo's own `tools/sim-three.js` (human bot) and `tools/measure-four.js` (careful bot).

## Headline numbers

| Game | Measurement | Result |
|---|---|---|
| Nine, normal, first match | beginner, 3 tiles: Easy / Medium / Hard match wins | 98.6% / 65.6% / 0.0% |
| | learner 50, 3 tiles | 99.8% / 93.4% / 5.1% |
| | learner 80, 5 tiles | 99.8% / 99.0% / 2.9% |
| | perfect, no power-ups, any size | 100% / 100% / 73-76% |
| Nine, 40-match runs, 3 tiles up | perfect + powers on Hard | 99.2% of matches, median run 40 (cap) |
| Fifteen, 400 matches | sensible: Easy / Medium / Hard W-L-D | 398-0-2 / 191-84-125 / 0-305-95 |
| | sensible who uses the after-draw Erase well | 399-0-1 / 201-82-117 / **192-167-41** |
| | naive eraser (1,000 matches): Medium / Hard | 519-214-267 / 271-341-388 |
| | perfect, no Erase / with Erase, Hard | 0-0-400 / 400-0-0 |
| Five, 600 matches | greedy: Easy / Medium / Hard | 88.0% / 33.8% / 6.0% |
| | learner 50 / learner 50 using Undo as an oracle | Hard 70.8% / 95.7% |
| Seven, 150 runs | Classic greedy (Undo only / + Smash, Crack): median drops | 155 / 201; 7-8 power-ups per 100 drops |
| | Blitz | 40 / 45 drops; 11 per 100 drops |
| Four, 120 games | careful bot: Easy / Medium / Hard | 72% / 46% / 38% |
| Three, 800 games | human bot | median 172 swipes, a flush every 22.2, 6% of games with no flush |
| Two / Fibonacci, 60 runs | median moves (no powers / with) | Two 523 / 731, Fibonacci 1499 / 1966 |
| | moves per reward | Two 108-145, Fibonacci 243-297 |
| Sudoku, 30 puzzles each | clash-free garbage fill vs honest solve, charges | Easy 3.0 vs 4, Medium 3.8 vs 5, Hard 4.1 vs 6 |

## Round-4 changes, checked

- **Five, no reward after Undo for the rest of the round: works and is honest.** A learner who uses Undo as an oracle
  forfeits 0.4 / 1.2 / 1.5 bursts' rewards per match (Easy / Medium / Hard), so Undo now costs more in rewards than it
  could ever earn; awards per match fall from 5.2 to 4.0 on Medium. The round card says "no power-up after Undo" and the
  burst toast says "No reward after Undo this round". One gap: finding 7.
- **Nine, Medium slips 25% with two tiles: the order Easy > Medium > Hard holds for every player I built, at every
  size** (beginner 98.6 / 65.6 / 0.0 at 3 tiles, 77.1 / 56.7 / 0.0 at 9 tiles). The beginner's Medium match rate is
  65.6% (the engine comment says "about 59% of Medium rounds": I measured 58.3% of rounds, so both are right; DESIGN's
  66% of matches matches). Perfect play still wins every Easy and Medium match. But Medium and Easy are the same game for
  anyone past beginner, and Hard is a wall: finding 4.
- **Fifteen, draws in the record: works.** A full Hard match driven through the UI went Draw, Erase win, Draw, Erase
  win: "Match won 2-0 · 2 drawn · Hard", Record 1-0 (a drawn match shows as a third number, W-L-D). Each drawn round
  hands an Erase at the next round ("erase=1" in state), the round won with it pays nothing and says why in the hint
  line. **Hard is winnable via the after-draw Erase**: perfect + Erase 400 of 400. But see finding 3.
- **Fifteen, power-ups last one match: works** (`newMatch` resets the stock). See finding 8 for the family picture.
- **Seven, Daily locks after one run: works in one tab** (end card "Today's Daily is done.", the buttons read Play
  Classic, a reload and `?mode=daily` both reopen the finished run). It does not hold across two tabs: finding 1.

## Findings

### 1. Seven: a second tab replays today's Daily, and its lower score overwrites the stored best (should-fix, medium)
Steps (one browser profile, phone size): open `seven/?mode=daily` in tab A and in tab B. Finish the Daily in tab A
(score 900): A shows "Today's Daily is done.", storage has `best.daily = 900`, the Today chip has 900. Tab B still holds
the fresh Daily from its load: it accepts drops (`drops` 0 to 1), so today's well can be played a second time, with
full knowledge of it. When B's run ends at 120, B's save replaces A's: storage `best.daily = 120`, run score 120, and a
fresh tab now shows Best 120 and the 120 run as today's Daily. The Today chip keeps 900, so the two disagree.
Expected: one Daily per day, and a result is never lost. The same stale-tab write also lowers the Classic and Blitz bests
(each tab writes `best` from its own memory). Suggested rule: before a Daily drop and on `visibilitychange`, reload the
stored run; if today's Daily is over in storage, lock this tab too; and merge `best` with the stored value (max) on
every save. (The lock can of course be reset by Memory, Erase or a private window; that is fine, it is a client game.)

### 2. Should Undo in Nine stop paying, as in Five? Yes, and Fifteen too (should-fix, low; recommendation)
Measured on Nine (3 tiles up, 40-match runs, 400 runs a row; powers on; Undo used after the computer's reply, then the
best move replayed; "signal" = Undo only when the computer just left two equal tiles, which a player can see;
"oracle" = Undo whenever the position is lost, an upper bound):

| Player, level | Undo use | Match win | Power-ups per match | Undo per match | Undo stock at the end |
|---|---|---|---|---|---|
| learner 50, Hard | none | 9.5% | 0.49 | 0 | 1.16 |
| | signal, pays (now) | 18.0% | 0.73 | 1.04 | 0.00 |
| | signal, no pay | 16.7% | 0.53 | 0.98 | 0.00 |
| | oracle, pays (now) | 25.8% | 1.03 | 1.04 | 0.00 |
| | oracle, no pay | 20.8% | 0.56 | 0.95 | 0.00 |
| learner 80, Hard | none / signal pays / signal no pay | 39.3 / 47.3 / 45.3% | 1.20 / 1.36 / 1.19 | 0 / 0.91 / 0.88 | 1.54 / 0.01 / 0.01 |
| learner 50, Medium | none / signal pays / signal no pay | 98.4 / 99.6 / 99.3% | 1.93 / 2.07 / 1.79 | 0 / 0.47 / 0.45 | 7.78 / 5.21 / 2.94 |

What this says:
- Undo is **not a farm** in Nine: every Undo costs a charge, a rescued round pays one random charge of four, so the Undo
  stock drains to 0 on Hard and falls on Medium. There is no loop to close.
- But Undo **is a conversion**: on Hard, an Undo user's power-up income rises by half (0.49 to 0.73, signal) or doubles
  (0.49 to 1.03, oracle), because a round turned around by taking a move back pays exactly like an honest win. That is
  the hole Five closed (R2: a power-up never earns one). With the rule, income falls back to 0.53 / 0.56, near the
  no-Undo level, while Undo keeps nearly all of its real value (match win 16.7% vs 18.0%; 20.8% vs 25.8%).
- The cost to an honest player is small: a misclick taken back costs that round's one reward, nothing else.
- Fifteen has the same shape: `use(state, "undo")` restores the snapshot and sets no flag, so a round saved by Undo
  (a blundered fork taken back on Easy or Medium) pays in full. Nine, Fifteen and Five are the family's three round games.
Recommendation: one family rule for the round games: **a round won after an Undo pays nothing** (Nine: add Undo to
`powered`, keep the existing "power" reason; Fifteen: set `peeked`-style mark `undone` that survives the rewind and pays
`why: "undo"`; Five already does it). Say it on the Undo button in all three (finding 7).

### 3. Fifteen: for a player who uses the after-draw Erase well, Hard is no harder than Medium (should-fix, medium)
Sensible player, 400 matches: Medium 201-82-117 (50% won) against Hard 192-167-41 (48%) once that player spends the
Erase where the solver says it wins (a second run of the same bot gave 206-150-44, 51.5%). A naive Erase user stays well
below Medium (27.1% vs 51.9%, 1,000 matches), so the order holds only for players who are bad with the Erase; the better
you get, the more Hard collapses into Medium. The cause: an Erase is handed out after **every** drawn round, and a
sensible player draws a lot against perfect play (Hard sensible without Erase: 1,139 of 1,800 rounds drawn).
Measured fix: **one after-draw Erase per match** (the first draw grants it, later draws do not). Perfect + Erase still
wins 400 of 400 Hard matches (draw, win, then draws: 1-0), so R4 holds; the skilled sensible player falls to 94-251-55
(23.5%), well under Medium. Alternatively keep the rule and change DESIGN's claim ("Hard stays harder than Medium for a
sensible player") to say it holds only without a well-timed Erase.

### 4. Nine: Medium is Easy for anyone who has learned anything, and Hard is a wall (should-fix, medium)
First match, learner 50: Easy 99.8%, Medium 93.4%, Hard 5.1% (3 tiles); at 5 tiles 98.8 / 92.3 / 0.0%. Learner 80:
Easy 100%, Medium 99.7%, Hard 30.2% at 3 tiles, 2.9% at 5, 0.2% at 7. Even with perfect Pass and Add, learner 80 wins
39% of Hard matches at 3 tiles and its runs end at the first match (median 0). Medium's only slip is with two tiles
left, which is exactly the endgame a learner already plays right, so Medium stops being a step the moment the player
knows "leave two equal tiles". And Hard's computer never errs, so a player who gets one move in five wrong loses almost
everything past 4 tiles. There is no level for the player who is learning nim-sum. Suggestion: give Hard a small slip
too (for example 10% with three or more tiles, never with two), or make Medium's slip apply with three tiles and Hard's
with two, so the ladder reads beginner / learning / expert. Measure with the learner 50 and 80 bots; target roughly
Medium 70-80% and Hard 25-40% for learner 80 at 5 tiles.

### 5. Four: Medium and Hard are close (should-fix, low)
Careful bot, 120 games a level: Easy 72%, Medium 46%, Hard 38% (DESIGN: 78 / 44 / 36). The Medium-Hard gap is about 8
points while Easy-Medium is 26, and Hard also removes the danger rings, so most of Hard's difficulty is the missing marks
rather than a stronger opponent. A careful player who reads the board for themselves wins Hard nearly as often as
Medium. Either sharpen Hard (Medium is "loose 0.75"; Hard could look one ply deeper for ten-lines) or accept and say so.

### 6. Nine Misere is far harder than normal play at the same level (low)
Learner 50, first match: Misere Easy 57.4% / Medium 46.8% / Hard 0.4% at 3 tiles, against 99.8 / 93.4 / 5.1% in normal
play. Easy and Medium still deal a winning start and perfect play still wins every match (100%), so it is fair; but
"Easy" in Misere is a coin flip for a learner. Misere only unlocks after a win and is the advanced mode, so this is
acceptable; the Learn sentence for Misere already explains the twist. Consider saying "harder" on the Misere button.

### 7. Five: the cost of Undo is told only after it is paid (should-fix, low)
The tray says "Undo: Take back your turn and the computer's reply." Nothing says that the rest of the round will pay no
reward; the player learns it from the next burst toast. Since Undo now costs on average 1.2 to 1.5 rewards per match on
Medium and Hard (measured above), say it up front: "Take back your turn and the computer's reply. No rewards for the rest
of this round." If finding 2 is taken, the same words go on Nine's and Fifteen's Undo.

### 8. Round games disagree on whether power-ups outlive a match (low, consistency)
Nine keeps the player's stock from match to match (and a long Easy run fills every slot to 9: Pass and Add sit unused);
Five and Fifteen start every match with one Undo. Five pays about five rewards a match (greedy Easy 5.4, learner Medium
5.2), most of which vanish at the match end, so on Five the rewards are mostly cosmetic for anyone who wins quickly. Both
choices are defensible; the family should pick one, or the tray should say "Power-ups last this match" in Five and
Fifteen (Fifteen's Hard text already explains its Erase).

### 9. Seven: Undo is also a two-disc lookahead (low, accept)
Undo restores the seed, and the next disc is drawn before the chain resolves, so drop, read the new Next, Undo, and the
same new Next will follow whatever column you pick. One charge buys a look two discs ahead. It costs a charge and Undo
stops being dealt at three held, so it is not farmable; just noting it, no change needed. Power-up income: 6.9 to 7.8
per 100 drops in Classic, about 11 in Blitz; Lucky Seven happens 0.4 to 0.8 times per 100 drops, rare enough to feel
special. The free-drop rule after Smash and Crack withheld 179 rewards over 150 Classic runs, so it bites.

### 10. Sudoku: a no-thought clash-free fill earns most of an honest solve's charges (low, known)
Filling every empty cell in random order with any digit that shows no clash earns 3.0 / 3.8 / 4.1 charges (Easy /
Medium / Hard) against 4 / 5 / 6 for a real solve, with 11 / 19 / 27 of the digits wrong. Those charges include Check
and Reveal. DESIGN accepts this (wrong but clash-free digits count; totals cap at an honest solve's), and pure and
assisted times are kept apart, so the record stays honest. Still, 68-75% of the income for zero thought is a lot. If it
ever matters: pay only when the new high-water cells also leave every peer with at least one candidate.

### 11. Six: most opening lines can be found by cycling the gaps (low, accept)
14 of the 23 tier-1 lines are solvable with + - x / alone, at most 256 combinations (4 gaps), so a player can tap through
gaps until the target turns up and still earn the clean-line streak. It is the nature of the puzzle, the opening is
meant to be gentle, and tiers 2 to 5 have 0, 0, 1 and 1 such lines. No change.

### 12. Two and Fibonacci: sound (no finding)
Greedy runs: Two median 523 moves to a 512 top tile without power-ups, 731 moves to 1024 with them (power-ups add a
median 135 moves). Fibonacci 1499 moves to 987, 1966 with power-ups (they add only 55). A reward every 108-145 moves in
Two and 243-297 in Fibonacci, about 5 to 7 rewards per run in both, because Fibonacci runs are three times longer. Undo
cannot reroll a spawn (the seed is restored, so the same move gives the same tile). Marks and the free move after a
power-up hold.

### 13. Three: sound (no finding)
Human bot, 800 games: median 172 swipes (p10 64, p90 382), a Flush every 22.2 swipes, 9.1 per game, 6% of games
without one, 5.6 power-ups used per game. Rewards come from Flushes, which need planning, so they feel earned.

## Verdict per game (rules only, out of 10)

| Game | Score | Why |
|---|---|---|
| Fibonacci | 8 | Honest, slow-burning; power-ups matter less than in Two (55 extra moves), which suits a longer game. |
| Two | 8.5 | Tight: marks, free move, no reroll. Nothing to exploit. |
| Three | 8 | Flush economy works; runs vary a lot (p10 64, p90 382), which is fine for a short game. |
| Four | 7 | Fair, beatable; Hard is mostly Medium without marks (finding 5). |
| Five | 8.5 | Solved and honest; the Undo rule closes the last hole; tell the cost up front (7). |
| Six | 8 | Verified bank, strict help rule; gentle start is brute-forceable by design. |
| Seven | 7.5 | Good economy and risk; the Daily lock leaks across tabs and can lose a best (1). |
| Nine | 7 | Fair and solved, but the ladder has no middle step (4); Undo should stop paying (2). |
| Fifteen | 7 | Draws and Hard work as intended; the after-draw Erase on every draw flattens Hard into Medium for good players (3); Undo pays (2). |
| Sudoku | 8 | One solution, honest helpers; garbage fill earns too well (10), known and contained. |

Overall: 7.8. Nothing is broken or farmable. The open work is calibration (Nine's middle, Fifteen's Hard, Four's Hard),
one family rule (no reward after Undo in every round game), and one data-loss bug in Seven's Daily.
