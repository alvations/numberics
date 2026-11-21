# Design

## How 2048 works (what we kept)
4x4 grid. A move slides every tile as far as it goes. Equal neighbours merge into one tile of double
value, and a tile created by a merge cannot merge again in the same move. If the move changed anything,
one new tile (2 at 90%, 4 at 10%) appears in a random empty cell. Score adds the value of each merge.

## What we changed
1. **No ceiling.** Original ends at 2048 ("you win"). Here nothing happens at 2048 except a toast. Tiles are
   levels, labels switch to 2^n from 2^17 up, and the colour hue cycles so every level is distinct forever.
2. **Power-ups, earned.** Original has Undo only (in some ports). Here a new highest tile of 32+ pays out
   one random power-up, and you start with one Undo.
3. **Stuck is not over while you hold a power-up.** The board shows "Stuck", the run only ends when it is
   locked and no usable power-up remains.

## Power-ups
| Name | Does | Notes |
|---|---|---|
| Undo | rewind the last move | restores power stock too, so it cannot farm rewards; costs one charge |
| Smash | delete one tile | the escape hatch for a clogged board |
| Swap | exchange two cells (a tile and an empty cell is allowed) | repositions, never merges for you |
| Boost | double one tile | does not award a milestone power-up (prevents boost-to-reward loops) |

Tuning knobs live at the top of `two/engine.js`: `AWARD_FROM_LEVEL` (5), `POWER_CAP` (9), `REACH` (the tiers, below).

## Principles register (carried over from melon-eight)
| Principle | Origin | Guard |
|---|---|---|
| Core loop first, architecture second | melon-eight MAKING_OF 1 | this doc |
| No build step, pure engine, thin client | melon-eight stack | `tests/test.js` runs engine in Node |
| Prove it, do not assert it: test + screenshot in the same turn | melon-eight 6 | `tests/emulation.cjs` |
| A screenshot catches what tests cannot | numberics: tiles below 2^17 rendered blank until a screenshot showed it | emulation asserts every plain tile has text |
| localStorage always in try/catch | melon-eight, cleo-guide | `tests/test.js` |
| Guard async UI against state change | melon-eight rendering rules | `flush()` + `state.moves` check |
| Reduced motion honoured; opacity is not motion | melon-eight | emulation reduced-motion run |
| No design change unless asked | cleo-guide rule 8 | CLAUDE.md |
| Say no to the half of a suggestion that would defang the design | melon-eight 5b | stuck stays hard: locked + no power = over |

## Sudoku
- Generation: fill a grid by seeded randomised backtracking, then remove cells in random order, keeping a removal
  only if the puzzle still has exactly one solution (solver stops counting at 2).
- Difficulty is clue count only (easy 40, medium 32, hard exactly 26). It is a simple, honest knob; a
  technique-graded rating (naked pairs, X-wing) is a possible future refinement.
- Helpers are honest: red marks show rule conflicts only, never whether a digit is right. The Reveal power-up is
  the one way to learn the truth; pure and assisted best times are kept apart.

---

# The family: how each game stands now (after QA round 3)

This section is kept current (rewrite it, do not append). The plan is `docs/ROADMAP.md`; how each game got here is in
the round histories below and in `docs/reviews/` (four reviews and a triage per round). Every number is a seeded
measurement, reproducible with the tools named.

## Shared
- `shared/theme.css` (the family look, first drawn for Two), `kit.js` (seeded rng, storage with fallback, toast, two-step, swipe),
  `power.js` (stock, award with cap 9, tray that explains itself), `nav.js` (the games list in `games.json` order: the text
  row on game pages, the cards with CSS previews, progress tags and the Today card on the root, and the Games sheet).
  Order (O-7): Fibonacci, Two, Three, Four, Five, Six, Seven, Nine, Fifteen, Sudoku, the owner's proposal; the panel
  evaluates it each cycle (`docs/reviews/ORDER-BRIEF.md`) and a change is a one-line move in `games.json` plus the mirror.
  Two and Sudoku keep their own CSS and mirror shared changes.
- Family rules R1-R17 (`docs/reviews/TRIAGE1-3.md`): Undo never crosses a decided result; a power-up never earns one;
  information power-ups (Peek, Hint, Reveal, Check) stay spent and count as help; solved-game opponents lose to perfect
  play; quitting a live game counts as a loss; the result shows on the board for 1.5 s before the card, which offers
  "See the board"; one end-card pattern; the toast never covers an end card, a warning or a status-line change.
- R2 depth: tile games mark the tiles a power-up touched (Two, Fibonacci); drop games make the next move unpaid
  (Seven, Four); round games pay nothing for a round won after a power-up, Peek included (Five, Fifteen, Nine); Sudoku
  and Six treat any help on the current line or cell as help.

## Two and Fibonacci
- Two was called Endless (renamed for O-6: every tile is a power of two, and the family names games by number). The
  save key `numberics_endless_v1`, the `ENDLESS` rule set and the replay fixture keep the old name so saved games load.
- Rule-set engine (`engine.js`, `make(rules)`); Two's behaviour is pinned by `tests/fixtures/endless-replay.json`.
- Swapped and boosted tiles carry a mark through merges and never earn; Smash makes the next move unpaid.
- Fibonacci (2584 rules: merge consecutive numbers or 1 + 1; equal tiles do not merge): award floor 55; greedy bot
  149 moves per reward vs Two 66; 111-degree hue step so neighbours differ. Merge rule confirmed by a published
  write-up; spawn odds (1: 90%, 2: 10%) assumed.

## Two tiers: Easy, Medium, Hard (O-12)
The owner: Two earned power-ups too slowly; keep the current rule as Hard, and add a Medium and an Easy that earn more
often but are still earned. One number sets the tier, the **reach** (`REACH` in `two/engine.js`): an honest join pays when
the tile it makes is at least (top tile - reach) rungs high, and at least the game's floor (32 in Two).

| Tier | Reach | Rule (the How to play words) |
|---|---|---|
| Hard | -1 | each new highest tile from 32 up earns one (the old rule, byte for byte: the replay fixture is untouched) |
| Medium | 0 | each join that makes a tile as big as your biggest, from 32 up |
| Easy | 1 | each join that makes a tile at least half your biggest, from 32 up |

- Why this mechanism: each rung down roughly doubles the joins that qualify (two tiles of a rung make the next), so the
  tiers keep their spacing at every stage of a run, not only at the start. The bar moves with the top tile (state.top,
  the highest ever made, so Smash never lowers it), so a long run does not turn into a flood. It needs no new state
  (no meter to snapshot, mark or rewind), so every anti-farm rule carries over unchanged: the move after Smash, Swap or
  Boost pays nothing, a join with a marked tile pays nothing, Undo restores the full snapshot, Boost never awards, the
  stock caps at 9. Every paying join is built from spawned tiles; no loop pays without play.
- Rejected (variants scored on the same bots, 200 to 300 games, no power-up use): a lower floor alone (a new highest
  tile from 16 or 8) only adds the one or two small new tiles of the opening (greedy: floor 16 is 1.3x Hard, floor 8
  1.6x, and the rate later in a run is Hard's); a merge-score meter needs its own state, rewinding and marks, and its
  rate is not tied to Hard's; Easy with reach 2 (a quarter of the top tile) is 1.8x to 3.2x Medium depending on the
  player, too uneven; Easy with reach 1 and a 16 floor pays a burst of 16s in the opening (2.5x to 2.7x Medium).
- Medium and Easy pay every qualifying join in a move (two pairs of 64 joining at top 64 pay two); Hard keeps one per new
  level. A Hard game has no `tier` field; Easy and Medium carry `state.tier`. The tier never changes inside a game.
- Measured (`node tools/sim-two.js 400`, the same 400 seeds on each tier, run cap 5000 moves). Rewards per 100 moves,
  moves per reward in brackets:

| Bot, power-up use | Hard | Medium | Easy | Medium / Hard | Easy / Medium |
|---|---|---|---|---|---|
| random, none | 2.15 (46.5) | 3.88 (25.8) | 5.88 (17.0) | 1.80 | 1.52 |
| greedy, none | 1.88 (53.3) | 3.39 (29.5) | 5.67 (17.6) | 1.81 | 1.67 |
| corner (strong), none | 1.25 (79.8) | 2.24 (44.7) | 4.32 (23.2) | 1.79 | 1.93 |
| random, sensible | 1.80 (55.6) | 3.06 (32.7) | 4.58 (21.8) | 1.70 | 1.50 |
| greedy, sensible | 1.54 (64.9) | 2.50 (40.0) | 3.95 (25.3) | 1.62 | 1.58 |
| corner (strong), sensible | 0.87 (115.5) | 1.36 (73.3) | 2.27 (44.0) | 1.58 | 1.66 |

  Rewards per game (greedy, sensible use): 3.6 / 6.9 / 12.3; strong player: 4.3 / 8.2 / 17.3, about 2x per step. Per 100
  moves the steps look smaller with power-up use because the easier tiers keep a run alive longer, into the slower part
  of a run; over the first 150 moves (the same stage on every tier) the strong player gets 2.11 / 3.62 / 6.54. Hard with
  sensible use is 65 moves per reward, the round-2 figure (66).
- Guards: `tests/test-two-tiers.js` (Hard replays the fixture; each tier's rule; per tier: the R2 move rule, marks, use
  never pays, the cap, Undo cycling, no short loop back to the same board raises the stock, and the R2-by-tile property),
  `tests/emu/two.cjs` (the row, Sure? mid-run, the saved choice, an old save loads as Hard, Easy pays sooner).
- Saves: an old save (no tier) loads as Hard and keeps its best on Hard (`bestScore`, `bestTop`); Easy and Medium keep
  their own best (`bests`). A first visit starts on Medium. The card on other pages says the tier's best ("Medium best").
  Trophies: a power-up-free run ("No help needed") has the same odds on every tier, because an unused power-up changes
  nothing, so it stays honest. Its tiles can fork after a reward one tier pays and another does not, since the reward
  draw uses the game's seed. The tile and score trophies can be helped by more power-ups on Easy. Decided with the
  panel (O-13, `docs/reviews/TROPHY-TIERS.md`): three Hard trophies are added beside the old ones (Two "The old way",
  Three "Colour storm", Fibonacci "Steep spiral"), and no existing trophy is gated to a tier.

### The tier recipe for the other tile games (O-13: done for Fibonacci and Three, below)
Express each tier relative to the game's own current award rule, never as a new mechanic: Hard = the current rule;
Medium and Easy widen the set of honest events that pay by one and two "rungs", where a rung is one step down the game's
own tile ladder, so each step about doubles the paying events. Measure with the game's own bots before shipping and aim
at Medium ~1.6x to 2x Hard and Easy ~1.5x to 2x Medium per 100 moves, and ~2x per step in rewards per game.
- **Fibonacci** (`fibonacci/engine.js` already gets `REACH`, `payFrom` and `state.tier` from `make()`): pass the tier to
  `newGame(seed, 4, tier)` and wire the client as Two. A rung down is the previous Fibonacci number (ratio ~1.618, not 2),
  so reach 1 may sit closer to Medium than in Two: measure reach 1 and reach 2 for Easy (floor 55 on every tier).
- **Three** (`three/engine.js`): its paying event is a Flush, not a top tile, so the reach applies to a second event:
  Hard = flushes only; Medium = flushes plus each join that makes a tile as big as the top tile; Easy = flushes plus each
  join that makes a tile at least one ladder rung below the top tile (Three's ladder 3, 6, 9, 12, 18, 24 ...), with a
  floor such as 24 so the opening is unchanged. Keep R2 (state.free, joins inside use()) for both events. Measure with
  `tools/sim-three.js human` (mpf, median run) per tier.

## Fibonacci tiers (O-13)
The owner: "the same tier earn rate and difficulty level" as Two. The mechanism is Two's (the core's `payFrom`, one reach
per tier, floor 55 on every tier, Hard = the old rule, every anti-farm rule the core's); only the reach differs, set by
the rule set (`RULES.reach` in `fibonacci/engine.js`, read by `make()` in `two/engine.js`).

| Tier | Reach | Rule (the tray words) |
|---|---|---|
| Hard | -1 | each new top tile from 55 (the old rule: replay hashes pinned from the engine before O-12) |
| Medium | 1 | each join that makes your top tile or the one below it (55 up) |
| Easy | 3 | each join that makes your top tile or one of the 3 below it (55 up) |

- Why not Two's reaches: in Fibonacci equal tiles do not join, so a second tile as big as the top tile is rare (the top
  tile is usually used at once to make the next one). Two's Medium (reach 0) paid only 1.07x to 1.12x Hard. A Fibonacci
  rung is 1.618x, so a step needs more rungs: reach 1 for Medium, and Easy measured at reach 2, 3 and 4 against it
  (Easy / Medium, no power-up use, random / greedy / corner bot): reach 2 1.20 / 1.35 / 1.41, reach 3 1.32 / 1.69 /
  1.83, reach 4 1.36 / 1.94 / 2.21. Reach 3 sits in the target for the greedy and strong players without overshooting.
- Measured (`node tools/sim-fibonacci.js 400`, the same 400 seeds on each tier, run cap 5000 moves). Rewards per 100
  moves, moves per reward in brackets:

| Bot, power-up use | Hard | Medium | Easy | Medium / Hard | Easy / Medium |
|---|---|---|---|---|---|
| random, none | 1.01 (98.8) | 1.53 (65.3) | 2.02 (49.4) | 1.51 | 1.32 |
| greedy, none | 0.82 (122.2) | 1.34 (74.5) | 2.27 (44.1) | 1.64 | 1.69 |
| corner (strong), none | 0.66 (151.4) | 1.17 (85.8) | 2.13 (47.0) | 1.77 | 1.83 |
| random, sensible | 0.84 (119.6) | 1.27 (78.9) | 1.76 (56.8) | 1.52 | 1.39 |
| greedy, sensible | 0.62 (162.2) | 0.95 (105.7) | 1.52 (65.8) | 1.54 | 1.61 |
| corner (strong), sensible | 0.51 (197.1) | 0.82 (121.4) | not finished (see below) | 1.62 | - |

  Rewards per game (greedy, sensible use): 5.1 / 9.1 / 16.9, about 1.8x per step. The strong player's Easy run with
  power-up use did not finish in this round (its runs approach the 5000-move cap; the 400-game run passed an hour of CPU);
  with no power-up use the strong player gets 5.0 / 8.7 / 16.1 per game.
  The weak random player gets the smallest steps (its runs rarely pass 233, where the 55 floor still binds Easy).
- Guards: `tests/test-fibonacci-tiers.js` (Hard replays hashes recorded from the engines at commit 9434c7d; each tier's
  rule; per tier the same anti-farm property tests as Two's: the R2 move rule, marks, use never pays, the cap, Undo
  cycling, no-progress loops, R2 by tile), `tests/emu/fibonacci.cjs` with the family checks in `tests/emu/_tiers.cjs`.
- Saves (as Two): an old save (no tier) loads as Hard and keeps its best on Hard (`bestScore`, `bestTop`); Easy and
  Medium keep their own (`bests`); a first visit starts on Medium; the card says "<Tier> best N".

## Three tiers (O-13)
Hard is Three's rule exactly: flushes only (replay hashes pinned from the engine before O-12; a Hard swipe result has no
new field). Medium and Easy add a second paying event, a JOIN that makes a big enough tile (`payFrom` in
`three/engine.js`), counted in rungs of Three's ladder 3, 6, 9, 12, 18, 24, 36, 48, 72 ... (two rungs halve a value).

| Tier | Reach | Rule (the tray words) |
|---|---|---|
| Hard | none | every Flush |
| Medium | 0 | every Flush, or a join as big as your top tile (18 up) |
| Easy | 2 | every Flush, or a join half your top tile or more (9 up) |

- Deviation from the recipe, measured: a floor of 24 shared by both tiers (the recipe's "opening unchanged") left Easy
  within 1.0x to 1.2x of Medium, because Three's runs live near the floor (the human bot's median top tile is 36) and
  the 3 x 2^n side of the ladder (12, 24, 48) is rare next to the 9 x 2^n side (9, 18, 36, 72). So the floor moves with
  the reach: the bar is `reach` rungs below the top tile or below 18, whichever is higher. Medium's opening is unchanged
  (nothing new pays before an 18); Easy pays 9s (3 + 6) from the start. Variants (human bot, Medium / Hard and Easy /
  Medium per 100 swipes, no power-up use, then with): one floor 24, Easy reach 1: 1.45 / 1.01, 1.33 / 1.01; one floor
  12, Easy reach 2: 1.97 / 1.26, 1.54 / 1.20; moving floor 24, Easy reach 2: 1.45 / 1.71, 1.33 / 1.38; moving floor 18,
  Easy reach 1: 1.87 / 1.14; moving floor 18, Easy reach 2 (shipped): 1.84 / 2.15, 1.51 / 1.39.
- Measured (`node tools/sim-three.js 2000 <bot> tiers`, NOPOW=1 for no power-up use; the same 2000 seeds on each
  tier, run cap 3000 swipes). Rewards per 100 swipes, swipes per reward in brackets, rewards per game after the bar:

| Bot, power-up use | Hard | Medium | Easy | Medium / Hard | Easy / Medium |
|---|---|---|---|---|---|
| human (the tuning bot), none | 3.98 (25.2) 4.5 | 7.30 (13.7) 8.2 | 15.68 (6.4) 17.6 | 1.84 | 2.15 |
| human, when stuck | 3.75 (26.7) 7.4 | 5.64 (17.7) 15.5 | 7.83 (12.8) 35.8 | 1.51 | 1.39 |
| greedy, none | 3.90 (25.6) 13.1 | 5.98 (16.7) 20.5 | 8.87 (11.3) 30.0 | 1.53 | 1.48 |
| greedy, when stuck | 3.35 (29.8) 60.0 | 3.66 (27.3) 81.4 | 3.88 (25.8) 93.7 | 1.09 | 1.06 |
| random, none | 2.39 (41.9) 1.5 | 6.37 (15.7) 4.0 | 18.38 (5.4) 11.6 | 2.67 | 2.89 |
| random, when stuck | 2.37 (42.1) 2.0 | 5.50 (18.2) 6.8 | 9.63 (10.4) 22.5 | 2.32 | 1.75 |

  Rewards per game for the human bot with power-ups: 7.4 / 15.5 / 35.8 (2.1x, 2.3x); median run 170 / 249 / 420 swipes.
  A strong player who uses power-ups (greedy, when stuck) plays runs of 1,700 to 2,700 swipes, where the top tile is
  far above every join it makes, so per 100 swipes its tiers meet the flush rate (1.09, 1.06); over the first 100
  swipes it gets 3.8 / 8.2 / 17.4. The ladder holds for the player the rules are tuned on; for the very strong player
  the tiers differ mostly early in a run (a decision for the owner, below).
- R2 for joins is the Flush's line, one swipe deep: the swipe right after Smash, Swap or Third pays nothing for its
  joins or flushes (`state.free`, `res.free`), a power-up never joins tiles, Undo restores the snapshot with the stock.
  Three has no tile marks, so a join the second swipe after a Swap or Third can pay (cost one power-up, pays at most
  the joins it makes); Two and Fibonacci mark such tiles. Guards: `tests/test-three-tiers.js` (per tier: the swipe after
  a power-up, a power-up then any swipe never raises the stock, Undo cycling, no-progress loops, the cap),
  `tests/emu/three.cjs` with `tests/emu/_tiers.cjs`.
- Saves (as Two): an old save (no tier) loads as Hard with its best (`bestScore`, `bestUsed`); Easy and Medium keep
  their own (`bests`); a first visit starts on Medium; the card says "<Tier> best N".

### Trophies on the tiers (O-13; none added, the panel decides next)
Unchanged and still honest: a power-up-free trophy (`fib_pure`) needs no rewards at all, so the tier does not help it;
the move-shape trophies (`fib_chain`, `fib_run`, `thr_double`, `thr_mono`, `thr_flush`) are about the board, not the
stock. Easier on Easy (more power-ups keep a run alive longer): the tile trophies (`fib_89` to `fib_10946`, `thr_96`,
`thr_384`), the long-game ones (`fib_long`, `thr_long`) and `thr_five` (five flushes in a game: longer runs flush more).

## Sudoku
- Exactly 40 / 32 / 26 clues; every puzzle has one solution.
- Power-ups (Undo free; Reveal, Check, Candidates) earned by progress: each new multiple of 9 clash-free player cells
  on a high-water mark (honest solve 4 / 5 / 6; typing 1 everywhere 0). Revealed cells never count. Accepted: wrong but
  clash-free digits count (the rule rewards progress, and totals cap at an honest solve's).
- Layout deviation: no hint line (tray below the board), so explanations use the neutral info toast.

## Seven
- 16% eggs; rises every 20 drops in Classic (minus one per level, floor 5), Blitz 5; disc points 7 x wave^2.5.
- The drop after Smash, Hold or Crack pays nothing; rewards skip Undo once three are held (`RULES.undoKeep`).
- An overflow with Undo in stock offers "Undo the last drop" or "End the run".

## Three
- Bag: four 1s, four 2s, two 3s. 1 + 2 = 3; from 3 up equal tiles merge; the only other step merge is 3 + 6 = 9, so
  values stay on a pairable ladder and 15 never exists. A Flush (3, 6, 9 or 6, 9, 12 in a line) scores sum x length,
  pays a power-up and clears its run.
- Human-like bot: median 165 swipes, a flush every 22.6 (`tools/sim-three.js`). 14-rung colour ladder.
- Easy, Medium, Hard: see "Three tiers (O-13)" above (Hard is this section's rule exactly).

## Four
- Discs 1-4 from a bag of 1,1,1,1,2,2,3,4; win with four of your colour or a ten-line (four in a row summing to 10
  with at least two of the completer's discs).
- Easy and Medium mark danger: red ring on a column whose drop would let the computer win right after; blue ring on
  the cell a drop would open and on every immediate threat. Hard shows none.
- Careful bot (plays only on what the page shows): Easy 78%, Medium 44%, Hard 36%; safe-move bot 71 / 39 / 39%
  (`tools/measure-four.js`). Easy misses ten-line wins 40% of the time; Medium loose 0.75.

## Five
- Each side has two number tiles starting at 1; add one onto another; at 5 or more it bursts. The computer opens
  (the first mover loses from 1-1-1-1), its opening varies by seed (`OPEN_OWN` 0.5 / 0.5 / 0.25), it never uses
  power-ups, and perfect play wins 100% on every level. Greedy player: Easy 89%, Medium 35.5%, Hard 4.5%.

## Six
- Verified bank of 108 lines (`node six/make-bank.js`, byte-identical rebuild, re-solved by the tests). Tiers by
  measured tools needed: 1 = + − × ÷ and one bracket group, 2 = one root or factorial, 3 = more signs, 4 = join
  digits, 5 = all tools. Climb opens with three lines that need no brackets; deals vary by seed.
- Exact fractions; never `eval`. Undo, Hint, Skip, Peek; help on a line means that line pays nothing.

## Fifteen
- Tic-tac-toe as Pick 15; Numbers view 1-5 over 6-9, Grid view the magic square.
- On Hard the player gets an Erase only after the match's FIRST drawn round, once per match (round 5, S10; it used to
  come after every draw, and a player who spent it where the solver says it wins took Hard about as often as Medium).
  Perfect play still wins every Hard match, now 1-0 with four draws (400 of 400). Measured, 400 matches, both starters
  (W-L-D): sensible player (win, block, else 5 half the time) Easy 391-2-7, Medium 169-133-98 (42%), Hard 0-358-42;
  the same player spending the Erase wherever the solver says it wins: Medium 180-124-96 (45%), Hard 101-260-39 (25%)
  before, 16-355-29 (4%) after. The test suite's own sensible player (Double or Erase out of a fork, Peek) with that
  Erase: Medium 52.5%, Hard 43% before, 5% after (tests/test-fifteen.js, S10).
- A round won after Erase, Double, Peek or Undo pays nothing (Undo: round 5, S9, the one Undo rule of the round games,
  as Five: `state.undone` survives later rewinds, `result.why` "undo", the card says "No power-up after Undo this
  round", and Undo's tray line says "No rewards for the rest of this round" up front).

## Nine
- Nim with tiles up to nine; runs climb from 3 to 9 tiles; Misère unlocks after the first win; Easy is the default.
- Easy and Medium always deal a winning start; Hard deals a losing start 1 time in 5 and hides the live nim-sum.
  Hard, perfect play with power-ups: 88.5% of matches; a perfect Hard run effectively never ends (accepted).
- Pass once per round per side; a round won after Add, Pass, Peek or Undo pays nothing (Undo: round 5, S9, the one Undo
  rule of the round games, as Five: `state.undone` survives later rewinds, `noAward` "undo", the card says "No
  power-up after Undo this round"); deals never repeat.
- The ladder (round 5, S11): Easy plays at random; Medium plays the winning reply when it has one but slips
  `MEDIUM_SLIP = 0.25` of the time at ANY tile count (round 4 slipped only with two tiles and played at random with
  three or more, so Medium was Easy for anyone past beginner); Hard never slips. A lone last tile is always taken.
  First match won, 2,000 matches a cell, Easy / Medium / Hard (bots as REVIEW_GAMEPLAY5 finding 4: beginner evens two
  tiles else takes at random; learner q plays a winning move with chance q, else the beginner; perfect, no power-ups):

  | Bot | 3 tiles | 5 tiles | 7 tiles | 9 tiles |
  |---|---|---|---|---|
  | beginner | 98.0 / 16.6 / 0.0 | 90.2 / 6.0 / 0.0 | 83.0 / 4.4 / 0.0 | 76.1 / 3.4 / 0.0 |
  | learner 50 | 99.8 / 65.7 / 4.6 | 98.0 / 34.3 / 0.0 | 97.0 / 24.7 / 0.0 | 95.1 / 21.6 / 0.0 |
  | learner 80 | 100 / 95.5 / 31.9 | 99.7 / 81.0 / 3.9 | 99.5 / 69.7 / 0.5 | 99.5 / 68.1 / 0.1 |
  | perfect | 100 / 100 / 76.6 | 100 / 100 / 74.9 | 100 / 100 / 76.0 | 100 / 100 / 74.8 |

  Before (round 4): learner 50 at 3 tiles 99.8 / 92.9 / 5.4, learner 80 at 5 tiles 99.8 / 99.5 / 3.4, beginner at 3
  tiles 98.0 / 63.9 / 0.0. Why 0.25 everywhere: one number, and it puts learner 50 on 3 tiles at 66% of Medium matches
  (target 60-75) and learner 80 on 5 tiles at 81% (finding 4's target 70-80); 0.2 gave 63% / 75% but a beginner only
  14%, 0.3 gave 68% / 86%. A Hard slip was measured and left out: learner 50 already wins under 15% of Hard matches
  on 3 tiles without one; a 10-20% slip with three or more tiles lifted learner 80 on 5 tiles to 17-34% but also lifted
  perfect play to 80-99% (the dealt losing start stopped mattering) and broke "Hard never errs from a winning position".

## Known gaps
- Long power-up explanations can take three lines at 375 px and move the board down for a moment (family-wide;
  needs shorter copy or another place).
- Six tier 2 has 17 lines; tier 5 about 20 (content work).

---

# History

## QA round 1 (20 Nov 2026): what changed

Reviews and decisions: `docs/reviews/REVIEW*1.md`, `TRIAGE1.md` (family rules R1-R11). Highlights, with numbers:

- **Family:** Undo never crosses a decided result (R1); a power-up never earns one, even indirectly (R2); spent
  information power-ups stay spent (R3); solved-game opponents lose to perfect play (R4); power-up buttons explain
  themselves on tap (R5) and Undo is slot 1 everywhere; one header pattern (R6); one channel per event and neutral
  warning toasts (R7); family end card with "New best." (R8); keyboard targeting everywhere (R9); two-step switches
  (R10); naming (R11). The toast sits just inside the top of the board (never over the title or the games row).
- **Sudoku:** earn by progress (each new multiple of 9 filled cells on a high-water mark): 4 / 5 / 6 charges per
  Easy / Medium / Hard puzzle, revealing nothing about correctness; clock survives reloads.
- **Fibonacci:** 111-degree hue step so merge neighbours differ; merge rule confirmed by a published write-up (spawn
  odds still assumed). Award floor stays 34 (per move it already pays half as often as Two).
- **Seven:** overflow leaves the last well and rings the discs pushed out; Crack arms before firing; Undo counted.
- **Three:** first-run explainer; a run made by a power-up collapses without paying, and so does the swipe after
  Smash/Swap/Third; flush spacing unchanged (29.5 moves greedy, `tools/sim-three.js`).
- **Four:** a ten-line needs at least two discs of the side completing it (`MINE = 2`); discs filled by owner; the
  opener alternates; safe-move bot wins Easy 68%, Medium 44%, Hard 29% (`tools/measure-four.js`); ten-lines decide
  51-59% of games; the computer earns power-ups only on Hard.
- **Five:** the computer never uses power-ups; perfect play wins 100% on every level; Hard sets traps from lost
  positions; greedy player wins Easy 86%, Medium 35%, Hard 0% (`EASY_CARE`, `MEDIUM_CARE = 0.4`).
- **Six:** tray Undo, Hint, Skip, Peek; Show answer (ends the run, two-step); plain first line on every seed and Daily;
  the exactness rule stated where it bites.
- **Fifteen:** tiles filled by owner; a round won after Erase or Double (by that side) pays nothing; perfect play with
  the starting Erase wins every Hard match; family round-end overlay keeps the winning triple.
- **Nine:** Hard deals a losing start 1 time in 5 (`HARD_LOSING = 0.2`) and hides the live nim-sum; perfect play with
  power-ups wins ~66-73% of Hard matches; Easy stays the default (beginner wins 75.6% on Easy, 2.5% on Medium); the
  computer earns only Add and Pass.

---

## QA round 2 (20 Nov 2026): what changed

Reviews and decisions: `docs/reviews/REVIEW*2.md`, `TRIAGE2.md` (R2 everywhere with a property test per game, R12-R17).

- **Family:** the move right after a board-changing power-up never pays (Two/Fibonacci `state.free` after Smash,
  Swap, Boost; Seven after Smash, Hold, Crack; Four after Pop, Hold, Tune; Five after Shield; Sudoku after a Reveal over a
  digit; Six after any help on a line; Three one swipe deep); round games pay nothing for a round won after Erase/Double
  (Fifteen) or Add/Pass (Nine). Quitting a live game counts as a loss (R12). The result shows on the board for 1.5 s
  before the card, which offers "See the board" (R13). The computer's power-ups are disclosed and announced in the hint
  line (R14). A full stock says "Power-ups full" (R15). Opponent games share You / Computer / Record pills (R16). Keys on
  a focused link, button or field belong to that control (R17). The home page lists every game with a description; the
  toast is compact, centred on the hint line, and never shows on an end card or over a "Sure?" warning.
- **Fibonacci:** award floor 55 (greedy bot 149 moves per reward, Two 66). Two's replay fixture re-recorded for R2
  (200 seeds: only withheld post-power-up awards differ).
- **Sudoku:** progress counts only clash-free player cells (typing 1 everywhere earns 0; an honest solve 4/5/6); revealed
  cells never count; clue ladder exactly 40/32/26.
- **Three:** only 3 + 6 = 9 step-merges and a Flush clears its run; human-like bot median 100 -> 165 swipes, a flush every
  22.6; colours follow the 14-rung value ladder.
- **Four:** blue threat rings on Easy and Medium; difficulty unchanged at 68/44/29%.
- **Five:** greedy player wins Easy 84.9%, Medium 33.6%, Hard 0%; perfect play 100% everywhere.
- **Six:** tiers banded by measured tools needed (bank 111 lines); Climb deals vary by seed; bracket-drag crash fixed.
- **Fifteen:** on Hard the player gets an Erase only after a drawn round: perfect play wins every match 2-0; sensible
  player 28% on Hard vs 46% on Medium; random 0%.
- **Nine:** Pass once per round per side; deals never repeat; Hard: perfect play with power-ups wins 88.5%, with 15%
  mistakes about 14%.

## QA round 4 (21 Nov 2026): what changed

Reviews and decisions: `docs/reviews/REVIEW*4.md`, `REVIEW_AGES4.md`, `TRIAGE4.md`.

- **Family:** Memory Load and Erase freeze the store before they write (B1); saves are batched into one idle write and
  flushed on pagehide (D6); narrow screens keep 44 px top-bar buttons with no sideways scroll (B3); one-tap mute in the
  top bar (D2); Trophies show earned and still-to-find goals, secrets hidden (D3); the Today card always shows the streak
  and each Daily's best (D4, D9); theme follows the device (D5). Night owl fires only on an end between 0:00 and 4:00.
  Every text label is at least 12 px. The merged tile stays hidden until the slide ends (no blip).
- **Five:** after an Undo, no burst pays for the rest of that round (closes the R2 hole; earlier awards in the snapshot
  stay). The "+N" copy fades before it covers 45% of its target; the number changes on visual arrival. Shards are 12% of
  the tile and fly out 45 to 70% (REDESIGN 5.6 spec was 6% and 30 to 45%); the landing pop goes 1 to 1.14 to 1.
- **Nine:** `MEDIUM_SLIP = 0.25`: with two tiles left Medium misses the winning reply a quarter of the time. Beginner bot,
  3 tiles: Easy 98%, Medium 66% (was 43%), Hard 1.5% of matches; perfect play still wins every Easy and Medium match.
  Hard runs never end by design. Learn opens with one plain sentence; the binary is behind "Show the binary".
- **Fifteen:** the record counts draws (W-L-D). Hard is winnable: a perfect player who uses the after-draw Erase won
  400 of 400 Hard matches; one who never uses it draws all 400. Power-ups last one match. A one-time Grid tip.
- **Seven:** the Daily locks after one run; the Today chip keeps the day's best.
- **Open for round 5:** Undo on Nine's no-pay list (as Five); a family-wide tap-highlight fix; Fifteen's vertical
  labels in Numbers view; Nine's nim-sum colour in Light.
