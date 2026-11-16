# Numberics roadmap: six new games (plan only, nothing built yet)

Status: **planning, approved to build from the week of 23 Nov 2026.** Nothing in this file is implemented.
The owner reviews this plan first; open questions are marked **Q** and need an answer before that game starts.

The family after this plan (one-word names, number-led, one house style):

| Game | Inspired by | Our twist | Folder |
|---|---|---|---|
| **Endless** (live) | 2048 | no ceiling, earned power-ups | `/` |
| **Sudoku** (live) | Sudoku | unique-solution generator | `sudoku/` |
| **Fibonacci** | 2584 | no ceiling, same power-ups as Endless | `fibonacci/` |
| **Seven** | Drop7 | Endless palette, daily seeded sequence | `seven/` |
| **Three** | Threes | multiples of 3 are the stars: step merges + rainbow **Flush** runs | `three/` |
| **Four** | Connect Four | you vs the computer, three strengths | `four/` |
| **Five** | Chopsticks (finger game) | you vs the computer, solved AI, hand dies at 5+ | `five/` |
| **Six** | the "6s challenge" | longer and harder lines, two-digit numbers, targets 6 / 66 / 6.6 / 666 / 66.6 | `six/` |

---

## 0. Shared foundation (build first, about half a day)

**Goal: every new game looks and feels like Endless, without changing how Endless looks.**

- `shared/theme.css`: the tokens and components Endless already uses, lifted as-is: colours (`--bg`, `--panel`,
  `--cell`, `--ink`, `--mute`, `--accent`), the brand header (`h1` in accent + `.sub` line), stat pills, the 4-up
  button tray, the board panel, `.btn` / `.btn.primary`, the toast, the end-of-run overlay, the phone gutter and
  safe-area rules, and the reduced-motion block. Endless and Sudoku switch to it **only if** the before/after
  screenshots are pixel-identical (owner rule: no unasked design change; perf/refactor never changes the look).
- `shared/kit.js`: storage (try/catch + in-memory fallback), `freshSeed()`, mulberry32, toast, the two-step
  "New game / Sure?" button, `prefersReducedMotion`, and the `window.__demo` + `__<game>` test hooks pattern.
- `shared/tiles.js`: the endless hue formula (`(level*43+30) % 360`), the label rule (digits while short, then
  an exponent / index form), and container-query font sizing by label length. Fibonacci, Seven and Three reuse it.
- Each game keeps the Endless layout contract: header (title + stats) → tray (power-ups or tools) → hint line →
  square board → "New game" → one-line how-to → quiet links to the other games.
- **Q0 (navigation):** with 8 games the root page needs a decision. Option A (recommended): keep Endless at `/`
  exactly as it is and grow the quiet "More from Numberics" line into a row of all games from `games.json`.
  Option B: a hub page at `/` and Endless moves to `endless/` (changes the landing, so only if you ask for it).

Per-game checklist (every game, no exceptions): pure `engine.js` (UMD, seeded, no DOM) + `tests/test-<id>.js`,
`game.js` client, `index.html`, `window.__demo()`, `games.json` entry, `screenshots/<id>-{mobile,desktop}.png`
in the same commit, browser checks in `tests/emulation.cjs` (play, blocked storage, reduced motion), and a section
in `docs/DESIGN.md`. Commits authored by the owner only.

---

## 1. Fibonacci (2584, endless)

**Rules (2584):** 4x4 slide board like 2048, but tiles are Fibonacci numbers (1, 2, 3, 5, 8, 13, ...). Two tiles
merge when they are **consecutive** in the sequence (1+1=2, 1+2=3, 2+3=5, 3+5=8 ...), not when they are equal.
Spawns are 1 (90%) and 2 (10%). The original stops at 2584; ours never stops.
*To verify against https://thereal23.github.io/2584/ before building: spawn odds, whether 1+1 is the only equal
merge, and the score rule (we assume score += merged value, as in 2048).*

**Design:** store tiles as Fibonacci **indices** (1 means 1, 2 means 2, 3 means 3, 4 means 5 ...), so values are
`F(index)` and there is no overflow. Merge test: `|a - b| == 1`, or `a == b == 1`. Result: `max(a, b) + 1`.
Labels: digits up to 6 characters, then `F<sub>n</sub>`. Same four power-ups, same award rule (new highest tile at
index 8 = 34 or above, to be tuned), same anti-farming Undo, same "stuck is not over while you hold a power-up".

**Engine plan:** refactor `engine.js` to take a **rule set** (`canMerge`, `mergeResult`, `spawnTable`, `value`,
`label`) with Endless as the default. Endless behaviour must stay byte-identical: all 27 existing tests unchanged
and green, plus a replay test (same seed + 1,000 moves gives the same board before and after the refactor).

**Tests:** consecutive merges only; 3+3 does NOT merge; 1+1 does; one merge per tile per move (1,1,2 slides to
2,2, and the new 2 does not merge again in the same move); infinite to index 300; power-ups as Endless.

---

## 2. Seven (Drop7)

**Rules (Drop7):** 7x7 well. You drop one disc at a time into a column. Discs are numbers 1-7 or blank "eggs".
A numbered disc **pops** when its number equals the length of the unbroken run it sits in, counted along its row
**or** its column. A pop cracks each adjacent egg (egg -> cracked -> revealed random number). Gravity, then pops
again: each wave of a chain scores more (chain multiplier). Every N drops (N shrinks as levels rise) a full row
of eggs rises from the bottom; if a column overflows the top, the game ends.

**Our version:** numbers coloured with the Endless hue formula so 1-7 read as the same family; a "next disc"
preview; modes **Classic** (rising rows), **Blitz** (N fixed at 5), **Daily** (date-seeded sequence, the same
for everyone, no server). Optional power-ups reuse the Endless tray: **Smash** (remove one disc) and **Undo**.
**Q2:** keep power-ups in Seven, or keep it pure like Drop7?

**Engine:** board 7x7 ints (0 empty, 1-7 numbers, 8 egg, 9 cracked egg); `drop(state, col)` returns the full
wave-by-wave trace (pops, cracks, falls, score per wave) so the client animates each wave and the tests can
assert it. Tests: row-run and column-run pops, a disc that matches neither stays, egg -> cracked -> number,
multi-wave chain scoring, rising row and overflow game over, determinism by seed.

---

## 3. Three (Threes, with multiples of 3 as the stars)

**Base (Threes):** 4x4; a swipe moves every tile **one step**; 1 + 2 = 3; from 3 up, equal tiles merge (3+3=6,
6+6=12 ...); the next tile is previewed and enters from the edge you swiped away from.

**The problem the owner named:** in Threes, 3 is just the first doubling step, and the colours quickly matter
more than the numbers. **Our fix: make "multiple of 3" the whole game.**
1. **Step merge (new):** two tiles that are *neighbouring multiples* of 3 also merge into their sum:
   3+6=9, 6+9=15, 9+12=21. (Proof it stays in the family: 3k + 3(k+1) = 3(2k+1).) So 9, 15, 21 exist, not only
   3, 6, 12, 24, and you are always counting in threes.
2. **Flush (new):** after a move, any straight line of **3 or more adjacent tiles that run in consecutive
   multiples of 3** (3-6-9, 12-9-6, 6-9-12-15, either direction) **flushes**: the run collapses into one tile
   worth the run's sum (always a multiple of 3), with a bonus of `sum x run length`. Longer flushes are rarer and
   worth much more, like poker straights.
3. **Rainbow scale:** each multiple has a rainbow colour by `k = value / 3`: 3 red, 6 orange, 9 yellow,
   12 green, 15 blue, 18 indigo, 21 violet, then the spectrum repeats one "octave" up with a brighter ring
   (24 red+ring, 27 orange+ring ...). So a flush is literally a rainbow lined up in order, and it **sweeps** along
   the run when it fires (a colour pass, then the collapse; reduced motion shows a static rainbow outline).
   1 and 2 stay neutral grey: they are only halves of a 3.

**Q3a (controls):** you described "drag and merge, Candy Crush kind of". Two options:
- **A (recommended): swipe** like Threes (one step per swipe), flushes happen as a result. Familiar, works with
  the Endless keyboard + swipe code.
- **B: drag one tile** to an adjacent cell (match-3 style). If that makes a merge or a flush it commits; if not,
  it snaps back. More "Candy Crush", but a new input model.
**Q3b:** should the game end like Threes (board locked) or be endless with power-ups like Endless?
**Tuning plan:** before any UI, run 10,000 simulated games per rule variant (bots in Node, like melon-eight's
measurements) to check flushes happen often enough to matter (target: a flush every 15-30 moves) but not
constantly. Ship the variant the numbers support.

---

## 4. Four (Connect Four vs the computer)

**Rules:** 7 columns x 6 rows; drop discs; four in a row in any line wins; a full board is a draw.
**AI:** negamax with alpha-beta on bitboards, centre-first move ordering, a transposition table. Strengths:
**Easy** (depth 2 + some randomness), **Medium** (depth 6), **Hard** (depth 10+, near perfect). Classic Connect
Four is a first-player win with perfect play, so by default the player moves first and Hard plays the best reply.
**Style:** discs use the accent gold vs a cool hue from the Endless palette; the winning four pulse once.
**Q4:** plain Connect Four, or a Numberics twist (for example, discs carry 1-4 and a line must also sum to a
target)? Recommendation: ship plain first, twist as a later mode.
**Tests:** win detection in all four directions, draw, AI takes an immediate win, AI blocks an immediate loss,
determinism of Easy with a fixed seed.

---

## 5. Five (Chopsticks vs the computer)

**Rules (as asked):** each side has two hands, each starting with 1 finger. On your turn, tap one of your living
hands onto **any other living hand** (an opponent's hand, or your own other hand): that hand gains the tapping
hand's fingers. A hand that reaches **5 or more dies** (it does not wrap around). The side with the last living
hand wins.
**AI:** the whole game is tiny (each hand is 0-4, so at most 625 positions x 2 turns), so we **solve it**
completely by retrograde analysis: every position is labelled win / lose / draw. Strengths: **Easy** (random
legal move that does not lose at once), **Medium** (looks 3 moves ahead), **Hard** (perfect play from the
solved table).
**Fairness check before building:** the solver tells us whether the first player can force a win. If yes, the
player always moves first; if the start is a forced draw, we add a draw rule (same position 3 times, or 40
moves without a hand dying) and say so in the how-to line.
**Q5:** include the classic "split" move (move fingers between your own two hands)? Recommendation: not at
first; "add to your own hand" already gives a self-move.
**Style:** hands drawn as simple line glyphs with 0-4 raised fingers (in the noir line style of melon-eight
badges), finger counts as big numbers in the Endless tile colours; a dying hand fades out.
**Tests:** every move rule, death at 5+, win detection, solver labels known positions correctly, Hard never
loses from a position the table marks as a win.

---

## 6. Six (the 6s challenge, expanded)

**Classic:** each line gives three identical digits (2 2 2, 5 5 5 ...). Insert +, -, x, /, square root,
factorial and brackets so the line equals 6. (Every digit 0-9 works: 0 0 0 is (0! + 0! + 0!)!.)

**Ours, as asked: longer, harder lines that always land on sixes.** Levels climb in tiers:
| Tier | Line | Target |
|---|---|---|
| 1 | three copies of one digit, 0-9 | 6 |
| 2 | four or five copies | 6 |
| 3 | two-digit numbers (10 10 10, 12 12 12 ...) | 6 |
| 4 | three to five copies | 66 or 6.6 |
| 5 | mixed lengths and two-digit numbers | 666 or 66.6 |
Allowed tools grow by tier: Tier 1 has + - x / sqrt ! and brackets; later tiers may add the decimal point and
joining digits (2 2 -> 22) if the solver shows they are needed. **Q6:** are joining digits and decimals allowed,
or only operators?

**Every line is proven solvable before it is shown.** A solver searches expressions over the line in order with
**exact fraction arithmetic** (no floating point, so 6.6 is exactly 33/5), square root only of perfect squares,
factorial only of whole numbers up to 10. Difficulty = how few solutions exist and how many operators the
shortest one needs, so tiers are ordered by measurement, not guesswork.
**Input:** tap the gaps between numbers to cycle operators, tap a number for sqrt / !, tap twice to place
brackets; the running value is shown live; the line locks gold when it hits the target. **Never `eval`**: a
small parser builds the expression tree. A counted **Hint** reveals one operator of a known solution.
**Tests:** every digit 0-9 solvable at Tier 1; the parser respects precedence and brackets; exact arithmetic for
decimal targets; every generated puzzle verified by the solver; no `eval` / `Function` in the source.

---

## Build order and estimates

1. Shared foundation (0.5 day), then Endless/Sudoku pixel-identical check.
2. **Fibonacci** (0.5 day): closest to Endless, proves the rule-set refactor.
3. **Seven** (1 day). 4. **Four** (1 day). 5. **Five** (0.5-1 day, solver first).
6. **Three** (1-2 days, simulations decide the rules). 7. **Six** (1.5-2 days, solver and parser first).

Every game ships with its screenshots, tests and design notes in the same commit, pushed as it goes (a stopped
session must lose nothing).

## Resume here (next session)

1. Read `CLAUDE.md`, then this file. Get the owner's answers to **Q0, Q2, Q3a, Q3b, Q4, Q5, Q6**.
2. Check the Fibonacci rules against https://thereal23.github.io/2584/ (the planning session could not open it).
3. Build in the order above, one game per commit series on its own branch, merged to `main` when green.
4. Authorship: owner only (see `CLAUDE.md`, Conventions). Activate the hook: `git config core.hooksPath .githooks`.
