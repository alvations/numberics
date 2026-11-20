# Numberics roadmap: eight new games (plan only, nothing built yet)

Status: **built (20 Nov 2026).** Every game below is live; how each one ended up, with measurements and every
deviation from this plan, is in `docs/DESIGN.md`. This file stays as the original plan.

**Owner decisions (16 Nov 2026):** every game gets power-ups; the number twists and the power-ups per game are
the designer's call (made below); the finger game is re-imagined without fingers; the Six design is the
designer's call (made below). Tic-tac-toe was added to the list the same day (section 7, named Fifteen),
and Nim the same day (section 9, named Nine).
One question stays open: **Q0** (landing page), defaulted to "change nothing".

| Game | Inspired by | Our twist | Folder |
|---|---|---|---|
| **Endless** (live) | 2048 | no ceiling, earned power-ups | `/` |
| **Sudoku** (live) | Sudoku | unique-solution generator; power-ups added (section 8) | `sudoku/` |
| **Fibonacci** | 2584 | no ceiling, Endless power-ups | `fibonacci/` |
| **Seven** | Drop7 | Endless palette, Lucky Seven chains, daily sequence | `seven/` |
| **Three** | Threes | multiples of 3 are the stars: step merges + rainbow **Flush** runs | `three/` |
| **Four** | Connect Four | numbered discs: four of your colour OR any four that **sum to 10** | `four/` |
| **Five** | Chopsticks | number tiles, not fingers: add onto a tile, at 5 it **bursts** | `five/` |
| **Six** | the "6s challenge" | longer lines, two-digit numbers, targets 6 / 66 / 6.6 / 666 / 66.6 | `six/` |
| **Fifteen** | tic-tac-toe | it IS tic-tac-toe in disguise: claim numbers 1-9, first to hold three that sum to 15 wins | `fifteen/` |
| **Nine** | Nim | heaps are number tiles 1-9 (9 is the cap); take from one tile, last take wins | `nine/` |

---

## 0. Shared foundation (build first, about half a day)

**Goal: every new game looks and feels like Endless, without changing how Endless looks.**

- `shared/theme.css`: the tokens and components Endless already uses, lifted as-is: colours (`--bg`, `--panel`,
  `--cell`, `--ink`, `--mute`, `--accent`), the brand header, stat pills, the 4-up power-up tray, the board
  panel, `.btn` / `.btn.primary`, the toast, the end-of-run overlay, phone gutter + safe-area rules, and the
  reduced-motion block. Endless and Sudoku switch to it **only if** their before/after screenshots are
  pixel-identical (no unasked design change; a refactor never changes the look).
- `shared/kit.js`: storage (try/catch + in-memory fallback), `freshSeed()`, mulberry32, toast, the two-step
  "New game / Sure?" button, `prefersReducedMotion`, and the `window.__demo` hook pattern.
- `shared/tiles.js`: the endless hue formula (`(level*43+30) % 360`), the label rule (digits while short, then
  an exponent or index form), and container-query font sizing by label length. Every tile-based game reuses it.
- `shared/power.js`: **one power-up system for every game** (section 0a).
- Layout contract for every game: header (title + stats) -> power-up tray -> hint line -> board -> "New game"
  -> one-line how-to -> quiet links to the other games.
- **Q0 (open, defaulted):** the landing page stays exactly as it is (Endless at `/`); the quiet "More from
  Numberics" line grows into one row linking every live game from `games.json`. A hub page only if you ask.

### 0a. Power-ups for everyone (one system, per-game meaning)

Same rules everywhere, so a player learns them once:
- A 4-slot tray in the Endless style, counts shown as gold badges, keys `1`-`4`, `Esc` cancels targeting.
- You start each run with **one Undo**. Every other charge is **earned by playing well** (the earn rule is
  per game, below), never bought, never timed. Each power-up caps at 9.
- **Undo always snapshots the whole state, power-ups included**, so rewinding can never farm a reward, and a
  power-up never earns a power-up (the Boost rule from Endless).
- Computer opponents (Four, Five, Fifteen, Nine) **also get power-ups on Hard**, under the same earn rules, so they stay fair.

| Game | Slot 1 | Slot 2 | Slot 3 | Slot 4 | Earned by |
|---|---|---|---|---|---|
| Endless | Undo | Smash (remove a tile) | Swap (two cells) | Boost (double a tile) | new highest tile from 32 |
| Fibonacci | Undo | Smash | Swap | Boost (tile -> next Fibonacci) | new highest tile from 34 |
| Seven | Undo | Smash (remove a disc) | Hold (keep the next disc for later) | Crack (crack every egg touching a disc) | a chain of 3+ waves, or a Lucky Seven |
| Three | Undo | Smash | Swap (two neighbours) | Third (turn a 1 or 2 into a 3) | every Flush |
| Four | Undo (takes back both moves) | Pop (remove any disc, the column drops) | Hold (swap your next disc with a held one) | Tune (set your next disc's number) | blocking a line of three, or making a ten-line threat |
| Five | Undo | Split (move points between your own two tiles) | Shield (a tile cannot be hit next turn) | Nudge (+1 or -1 on any tile) | bursting an opponent's tile |
| Six | Hint (reveals one operator) | Skip (a new line, same tier) | Peek (shows the value of one part) | Undo (last edit) | 3 lines in a row without help |
| Fifteen | Undo | Erase (remove one opponent number) | Peek (shows the number you must block) | Double (claim two numbers this turn) | winning a round of a best-of-five |
| Nine | Undo | Add (+1 to any tile, never past 9) | Pass (skip your turn once) | Peek (shows one winning move, if one exists) | winning a round of a best-of-five |
| Sudoku | Undo (stays free and unlimited) | Reveal (the old Hint) | Check (marks wrong digits once) | Candidates (fills notes for one box) | each correct row, column or box completed |

Best times and high scores record **how many power-ups were used**, so a pure run still shows as pure.

Per-game checklist (every game): pure `engine.js` (UMD, seeded, no DOM) + `tests/test-<id>.js`, `game.js`,
`index.html`, `window.__demo()`, a `games.json` entry, `screenshots/<id>-{mobile,desktop}.png` in the same
commit, browser checks in `tests/emulation.cjs` (play, power-ups, blocked storage, reduced motion), a section in
`docs/DESIGN.md`. Commits authored by the owner only.

---

## 1. Fibonacci (2584, endless)

**Rules (2584):** a 4x4 slide board like 2048, but tiles are Fibonacci numbers (1, 2, 3, 5, 8, 13, ...). Two
tiles merge when they are **consecutive** in the sequence (1+1=2, 1+2=3, 2+3=5, 3+5=8 ...), not when equal.
Spawns are 1 (90%) and 2 (10%). The original stops at 2584; ours never stops.
*Check against https://thereal23.github.io/2584/ before building: spawn odds, whether 1+1 is the only equal
merge, and the score rule (assumed: score += merged value).*

**Design:** tiles stored as Fibonacci **indices** (1 means 1, 2 means 2, 3 means 3, 4 means 5 ...), values
`F(index)`, no overflow. Merge if `|a - b| == 1` or `a == b == 1`; result `max(a, b) + 1`. Labels: digits up
to 6 characters, then `F` with the index as a subscript. Power-ups and "stuck is not over while you hold one"
exactly as Endless.

**Engine:** refactor `engine.js` to take a **rule set** (`canMerge`, `mergeResult`, `spawnTable`, `value`,
`label`, `awardFrom`) with Endless as the default. Endless must stay byte-identical: all existing tests
unchanged and green, plus a replay test (same seed + 1,000 moves gives the same board before and after).

**Tests:** consecutive merges only; 3+3 does not merge; 1+1 does; one merge per tile per move (1,1,2 slides to
2,2, and the new 2 does not merge again in the same move); infinite to index 300; power-ups as Endless.

---

## 2. Seven (Drop7)

**Rules (Drop7):** a 7x7 well. Drop one disc at a time into a column. Discs are numbers 1-7 or blank eggs. A
numbered disc **pops** when its number equals the length of the unbroken run it sits in, along its row **or**
its column. A pop cracks each adjacent egg (egg -> cracked -> a random number). Gravity, then pop again: each
wave of a chain scores more. Every N drops (N shrinks with level) a row of eggs rises from the bottom; if a
column overflows, the run ends.

**Number twist: Lucky Seven.** When one chain pops **exactly 7 discs in total**, every egg on the board cracks
one step and you earn a power-up. It rewards counting, not just stacking.
**Our version:** numbers coloured with the Endless hue formula; a "next disc" preview; modes **Classic**,
**Blitz** (N fixed at 5) and **Daily** (date-seeded, the same for everyone, no server). Power-ups per 0a.

**Engine:** 7x7 ints (0 empty, 1-7 numbers, 8 egg, 9 cracked); `drop(state, col)` returns the full wave-by-wave
trace (pops, cracks, falls, score per wave) so the client animates each wave and tests can assert it.
**Tests:** row and column pops, a disc matching neither stays, egg -> cracked -> number, chain scoring, Lucky
Seven, the rising row and overflow, Hold and Crack, determinism by seed.

---

## 3. Three (Threes, with multiples of 3 as the stars)

**Base (Threes):** 4x4; a swipe moves every tile **one step**; 1 + 2 = 3; from 3 up, equal tiles merge (3+3=6,
6+6=12 ...); the next tile is previewed and enters from the edge you swiped away from.

**The fix for "3 becomes irrelevant": make "multiple of 3" the whole game.**
1. **Step merge:** neighbouring multiples of 3 also merge into their sum: 3+6=9, 6+9=15, 9+12=21
   (3k + 3(k+1) = 3(2k+1), so it stays a multiple of 3). Every multiple exists, and you always count in threes.
2. **Flush:** after a move, any straight line of **3 or more adjacent tiles in consecutive multiples of 3**
   (3-6-9, 12-9-6, 6-9-12-15, either direction) **flushes**: the run collapses into one tile worth its sum
   (always a multiple of 3), scoring `sum x run length`, and earns a power-up. Longer flushes are rarer and
   worth much more, like poker straights.
3. **Rainbow scale:** each multiple has a colour by `k = value / 3`: 3 red, 6 orange, 9 yellow, 12 green,
   15 blue, 18 indigo, 21 violet, then the spectrum repeats one octave up with a brighter ring (24 red+ring,
   27 orange+ring ...). A flush is a rainbow lined up in order, and it **sweeps** along the run when it fires
   (reduced motion: a static rainbow outline, then the collapse). 1 and 2 stay neutral grey: halves of a 3.

**Decided:** controls are **swipe** (one step per swipe, keyboard and swipe code from Endless). The run is
**endless with power-ups**: it ends only when the board is locked and no power-up can act, like Endless.
**Tuning first:** before any UI, 10,000 simulated games per rule variant (Node bots) to check flushes land
every 15-30 moves; ship the variant the numbers support and record the numbers in `docs/DESIGN.md`.

---

## 4. Four (Connect Four, counted)

**Rules:** 7 columns x 6 rows; drop discs in turn; a full board is a draw.
**Number twist: every disc carries a number 1-4** (dealt from a seeded bag, your next number is shown). You win
with either:
- **Four in a row of your colour** (classic), or
- a **ten-line**: any four in a row, **any colours**, whose numbers **sum to exactly 10**, completed by your
  disc. (10 = 1+2+3+4, the "count to four" line, but 4+4+1+1 and 3+3+2+2 count too.)
So every disc you drop also arms lines for your opponent: you read colour and arithmetic at once.
**AI:** negamax with alpha-beta and a transposition table over both win conditions; centre-first ordering.
Strengths **Easy** (depth 2 + randomness), **Medium** (depth 6), **Hard** (depth 8+, uses power-ups). The
player moves first by default.
**Tests:** both win types in all four directions, a ten-line completed by the opponent's disc does not win for
you, draw, AI takes an immediate win, AI blocks an immediate loss, Pop and Tune, Easy determinism by seed.

---

## 5. Five (Chopsticks, re-imagined without fingers)

**Theme:** no hands, no fingers. Each side owns **two number tiles** in the Endless tile style, both starting at
**1**. The board is four tiles: yours at the bottom, the computer's at the top.
**Rules:** on your turn, pick one of your live tiles and **add its value onto any other live tile** (one of the
computer's, or your own other tile). A tile that reaches **5 or more bursts** and is gone. The side with the
last live tile wins. The tile colours walk the Endless palette 1 -> 4, so a 4 visibly "glows" one step from
bursting; a burst is a short pop (a fade under reduced motion).
**AI:** at most 625 positions x 2 turns, so the game is **solved** by retrograde analysis (every position
labelled win / lose / draw). **Easy**: a random legal move that does not lose at once. **Medium**: 3 moves
ahead. **Hard**: perfect play from the table, with power-ups.
**Fairness:** the solver runs first. If the starting side can force a win, the player always starts; if the
start is a forced draw, a draw rule applies (same position 3 times, or 40 moves without a burst) and the how-to
line says so.
**Split** (moving points between your own two tiles, the classic finger-game move) is a **power-up**, not a
basic move.
**Tests:** every move rule, burst at 5+, win detection, solver labels known positions correctly, Hard never
loses from a position the table marks as a win, Shield and Nudge.

---

## 6. Six (the 6s challenge, expanded)

**Classic:** each line gives three identical digits (2 2 2, 5 5 5 ...). Insert +, -, x, /, square root,
factorial and brackets so it equals 6. (Every digit 0-9 works: 0 0 0 is (0! + 0! + 0!)!.)

**Design (decided):**
- **A run is six lines.** Solve all six to clear a round; rounds climb the tiers. A **Daily Six** (date
  seeded, the same for everyone) and an endless **Climb** mode.
- **Tiers, always landing on sixes:**

| Tier | Line | Target | Tools |
|---|---|---|---|
| 1 | three copies of one digit, 0-9 | 6 | + - x / sqrt ! ( ) |
| 2 | four or five copies | 6 | same |
| 3 | two-digit numbers (10 10 10, 12 12 12 ...) | 6 | same |
| 4 | three to five copies | 66 or 6.6 | + joining digits (2 2 -> 22) and the decimal point |
| 5 | mixed lengths and two-digit numbers | 666 or 66.6 | all tools |

  Joining digits and decimals only arrive at Tier 4, because 66 and 6.6 need them; tiers 1-3 stay pure
  operators, as in the classic puzzle.
- **Every line is proven solvable before it is shown.** A solver searches expressions over the line in order
  with **exact fraction arithmetic** (6.6 is exactly 33/5), square root only of perfect squares, factorial only
  of whole numbers up to 10. Difficulty = how few solutions exist and how many operators the shortest one
  needs, so tiers are ordered by measurement, not guesswork.
- **Input:** tap a gap between numbers to cycle operators, tap a number for sqrt or !, tap twice to place
  brackets; the running value shows live; the line turns gold when it hits the target. **Never `eval`**: a small
  parser builds the expression tree. Number tiles use the Endless colours; the target 6s are in gold.
- **Power-ups** per 0a: Hint, Skip, Peek, Undo.
**Tests:** every digit 0-9 solvable at Tier 1; parser precedence and brackets; exact arithmetic for decimal
targets; every generated line verified by the solver; no `eval` or `Function` in the source.

---

## 7. Fifteen (tic-tac-toe, the number way)

**The trick:** tic-tac-toe and the old "Pick 15" game are the same game. Lay 1-9 on a 3x3 **magic square**
(8 1 6 / 3 5 7 / 4 9 2): every row, column and diagonal sums to 15, and those 8 lines are the only triples
of 1-9 that do. So "three in a row" and "three numbers that sum to 15" are one rule.
**Play:** you and the computer take turns claiming numbers (tiles in the Endless style, yours gold-edged, the
computer's cool-edged). The first side holding **three numbers that add up to 15** wins. Two views of one
board, switchable any time: **Numbers** (a row of 1-9, pure arithmetic) and **Grid** (the magic square, where
it reads as tic-tac-toe). The reveal that they are the same game is the fun of it.
**Rounds:** perfect play is a draw, so a match is **best of five**; winning a round earns a power-up (0a), and
power-ups are what break the deadlock. The side that starts alternates each round.
**AI:** the full game tree is tiny (under 9! positions), so it is solved exactly. **Easy** random but takes a
win, **Medium** blocks and takes wins, **Hard** perfect play plus power-ups.
**Tests:** the 8 magic lines are exactly the 15-sum triples of 1-9; win by sum equals win by grid line; draw
detection; Hard never loses without power-ups in play; Erase, Peek, Double; best-of-five scoring.
**Name:** Fifteen (in the family style). Rename if you prefer another.

---

## 8. Sudoku gets power-ups (a change to a live game, asked for on 16 Nov)

Undo stays free. The current Hint becomes the **Reveal** power-up; **Check** and **Candidates** are added;
charges are earned by completing a correct row, column or box (section 0a). The board, numpad and layout stay
as they are; only the tools row becomes the Endless-style power-up tray. Before/after screenshots ship with it.

---

## 9. Nine (Nim, up to nine)

**Rules:** a row of **heaps, each a number tile from 1 to 9** (drawn as the number plus up to nine pips, in the
Endless colours). On your turn, pick one tile and **lower it by any amount** (1 up to its value); a tile at 0
is gone. Whoever makes the **last take wins**. Nine is the base: no tile ever starts above 9 or grows past it.
**Levels:** the run climbs from 3 tiles to 4, 5 and up to **9 tiles**, so the opening "9" grows from the tile
values to the board itself. A **Misere** mode (last take loses) unlocks after the first win.
**AI:** Nim is solved by the nim-sum (the XOR of the tiles). **Easy** random, **Medium** perfect only when
two tiles remain, **Hard** perfect with power-ups. Fairness: every dealt start is a winning position for the
side to move (nim-sum not zero) and the player moves first, so a perfect player can always win: the computer can
only punish a mistake. That makes Nine a skill you can learn, and Peek teaches it.
**Learn view:** an optional toggle shows each tile in binary and the running nim-sum, so the strategy is
discoverable, not a secret.
**Rounds and power-ups:** best of five; winning a round earns a power-up (0a). Add (+1, capped at 9) and Pass
are the deadlock breakers, because each one changes who is winning.
**Tests:** legal moves only; last take wins (and loses in Misere); Hard always wins from a non-zero nim-sum
and never wins from zero without power-ups; dealt starts always have a non-zero nim-sum; Add never exceeds 9;
Peek returns a move that leaves a zero nim-sum.

---

## Build order and estimates

1. Shared foundation incl. `shared/power.js` (0.5-1 day), then the Endless/Sudoku pixel-identical check.
2. **Fibonacci** (0.5 day): closest to Endless, proves the rule-set refactor.
3. **Seven** (1 day). 4. **Four** (1-1.5 days). 5. **Five** (0.5-1 day, solver first).
6. **Three** (1-2 days, simulations decide the rules). 7. **Six** (1.5-2 days, solver and parser first).
8. **Fifteen** (0.5 day, solver first). 9. **Nine** (0.5 day). 10. **Sudoku power-ups** (0.5 day).

Every game ships with its screenshots, tests and design notes in the same commit, pushed as it goes.

## Resume here (next session)

1. Read `CLAUDE.md`, then this file. Only **Q0** is open, and it defaults to "change nothing".
2. Check the Fibonacci rules against https://thereal23.github.io/2584/ (the planning session could not open it).
3. Build in the order above, each game on its own branch, merged to `main` when tests and screenshots are green.
4. Authorship: owner only (see `CLAUDE.md`, Conventions). Activate the hook: `git config core.hooksPath .githooks`.
