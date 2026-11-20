<!-- SPDX-License-Identifier: Apache-2.0 -->
<!-- Copyright 2026 alvations (Melon Lab) -->

# Review round 2: the harsh but impartial critic

Scope: all ten live games in `games.json`, `shared/`, `tests/`, and the docs (CLAUDE.md, DESIGN, NEW-GAME, ROADMAP),
checked against my round-1 review (`REVIEW1.md`, 7/10) and the lead's decisions in `TRIAGE1.md` (R1-R11).

What I ran (20 Nov 2026, working tree clean at `aceb725`):
- `node tests/run.js`: 11 files, 426 checks, all green (round 1: 368).
- `NODE_PATH=$(npm root -g) npm run test:browser`: 58 + 567 checks, all green (round 1: 25 + 308).
- My own probes: Node scripts against every engine (constructed boards plus a fuzz that tries every power-up
  followed by every move), and Playwright against `python3 -m http.server 8085` at 1280x860, 390x844 and 320px.
- `git log`: every commit is authored and committed by the owner. No trailers.

## Situating this pass

Round 1 asked for three things: fix the three blockers, settle one Undo rule, and add family-wide property tests so
the next hole is caught by a test rather than by me. The first two are done, and done well. Every round-1 blocker is
fixed with a regression test whose body asserts the exact round-1 repro, so it would fail on the old code. R1 (Undo never crosses a result) now holds in every game, in
the engine and not only in the tray. The test count went up by 60% and the new tests are mostly the right ones.

The third request was only half done, and that is where this round's blocker lives. TRIAGE1 wrote R2 as a family
rule: **"A power-up never earns a power-up, including indirectly. A reward that becomes possible only because of a
board-changing power-up in the same turn or round does not pay."** It then listed only Three and Fifteen as the
games to fix. Those two were fixed properly (Three with a `free` flag and a property test, Fifteen with a per-round
`powered` flag). The other five games that have both a board-changing power-up and an earn rule were never
checked, and every one of them breaks R2. In Endless and Fibonacci the break is the exact "boost-to-reward loop"
that DESIGN.md says Boost prevents. I missed this in round 1 as well (I only probed Three), so the score drop below
is partly a correction of my own round-1 numbers, not only a regression.

Blockers: 1 family-wide (5 games). Should-fix: 9. Nits: 15.

---

## Round-1 follow-up

"Fixed" means the code changed and a test would catch a regression. "Fixed, no test" means the behaviour is right
but nothing guards it. Rows marked TRIAGE are the round-1 triage rules, checked across all games.

| Round-1 finding | Status | Evidence |
|---|---|---|
| Endless 1: keyboard targeting | Fixed | `game.js:195-216`; emulation "arrows move the cursor", "Enter smashes", "Enter twice swaps", "Space boosts" |
| Endless 2: tray overflows at 320px | Fixed | emulation "tray fits at 320px"; my probe: 320/320 |
| Endless 3: tray aria-label | Fixed | shared tray; emulation "tray aria-label carries the count" |
| Endless 4: shallow save validation | Fixed | `game.js:17-23` validates `prev` with the same `core()`; emulation "malformed prev is rejected" |
| Endless 5: level-5 tile contrast 3.45:1 | **Not fixed** | `shared/theme.css:39` unchanged, not in won't-fix |
| Sudoku 1 [blocker]: Undo unlocks a solved board | Fixed | `sudoku/engine.js:206`; test "R1: Undo is refused on a solved board" |
| Sudoku 2: one-tap difficulty switch | Fixed | `sudoku/game.js:228-235`; emulation "an unanswered Sure? times out" |
| Sudoku 3: unit toast is a correctness oracle | Fixed | earn by progress, `sudoku/engine.js:178-186`; test "wrong digits earn exactly like right ones" |
| Sudoku 4: time saved on visible, not hidden | Fixed | `sudoku/game.js:258-259`; static test on pagehide |
| Sudoku 5: tray overflows at 320px | Fixed | probe 320/320 |
| Sudoku 6: layout deviation not in DESIGN.md | **Not fixed** | DESIGN.md has no Sudoku deviation note (tray below the board, no hint line) |
| Sudoku 7: `role="grid"` without rows | Fixed | `sudoku/game.js:44` adds `role="row"` |
| Fibonacci 1: keyboard targeting | Fixed | emulation "Enter smashes the cursor cell", "swap by keyboard" |
| Fibonacci 2: `prev` not validated | Fixed | `fibonacci/game.js:16-22` (a broken `prev` now costs the snapshot, not the run) |
| Fibonacci 3: rules unchecked | **Partly** | DESIGN.md says a write-up confirmed the merge rule; `fibonacci/engine.js:11-12` still says nothing was checked; ROADMAP "Resume here" step 2 still open |
| Seven 1: Undo not counted (swallowed line) | Fixed | `seven/engine.js:244`; tests "Undo is counted" and the `used` property test |
| Seven 2: Daily replay and best mixing days | **Partly** | best is per day now (`seven/game.js:27-31`); "New game" on Daily still re-deals the same well without limit |
| Seven 3: `today` fixed at load | Fixed, no test | `checkDay()`, `seven/game.js:37-41` |
| Seven 4: shallow save validation | Fixed | `seven/game.js:14-23` |
| Three 1 [blocker]: Swap builds a paid Flush | Fixed | `three/engine.js:241, 262-285`; tests "R2 blocker repro", "R2 indirect", "R2 property" |
| Three 2: keyboard targeting | Fixed | emulation "Enter smashes the tile under the cursor" |
| Three 3: 450 ms reduced-motion pause | Fixed | `three/game.js:9`, 250 ms |
| Four 1: record farming with Undo | Fixed | `four/engine.js:183`; tests "R1: Undo is refused after a win/loss". (A different dodge remains, new Four 3) |
| Four 2: Pop has no keyboard path | Fixed | emulation "R9: Enter pops the disc under the cursor" |
| Four 3: computer earns on Easy/Medium | Fixed | `four/engine.js:155`; test "earns nothing on Easy and Medium" |
| Four 4: three confirmation patterns | Fixed | every level row now says "Sure?" (Four via `K.twoStep`, Five/Fifteen/Nine by hand) |
| Five 1: Undo cancels a lost match | Fixed | `five/engine.js:213`; test "R1: Undo is refused once a round is decided" |
| Five 2: third confirmation pattern | Fixed | "Sure?" |
| Five 3: `aiPlan` writes the live seed | Fixed | `five/game.js:186-187` uses the engine's copy; test "aiPlan never touches the given state" |
| Six 1: Enter on a focused button edits the cursor | Fixed | `six/game.js:315-316`; emulation "Enter on a focused gap cycles that gap only" |
| Six 2: bare `c` wipes a line | Fixed | `six/game.js:362` goes through the two-step Clear |
| Six 3: Daily re-deal | **Not fixed** | `six/game.js:228` |
| Six 4: tier-5 gap on the roadmap with a size target | **Not fixed** | still only in DESIGN.md "Known gap", no target |
| Fifteen 1 [blocker]: Peek refunded by Undo | Fixed | `fifteen/engine.js:217`; test "R3: a Peek spent before Undo stays spent (the critic's repro)" |
| Fifteen 2: Undo after a lost round | Fixed | `fifteen/engine.js:198`; test "R1" |
| Fifteen 3: Peek still lets the round earn | Fixed | written in the how-to (`fifteen/index.html:54`) |
| Nine 1: Undo reverses a lost match | Fixed | `nine/engine.js:151`; emulation "undo after a lost round does nothing and says why" (no engine unit test) |
| Nine 2: computer award pool | Fixed | `CPU_POWERS`, test "the computer earns only what it plays" |
| Nine 3: undocumented `l` key | Fixed | how-to lists L |
| Shared 1: dead `\|\| "./"` in nav.js | **Not fixed** | `shared/nav.js:22` |
| Shared 2: family property tests in `conventions.js` | **Partly** | Three, Seven and Sudoku grew property tests; `tests/conventions.js` is unchanged and no other game has "a power-up followed by any move never raises the stock". That gap is exactly why the R2 blocker below survived |
| Shared 3: two-line storage-guard window | **Not fixed** | `tests/conventions.js:17-19`, `tests/test.js:137-140` |
| Shared 4: keyboard pass in browser suites | **Partly** | Enter on focused buttons is now tested in most games; Enter on a focused **link** is tested nowhere (new Shared 1) |
| Shared 5: history scan passes silently without git | **Not fixed** | `tests/test.js:180`, `catch (e) { return; }` |
| TRIAGE R1 Undo never crosses a result | Holds in all ten | engine-level in every game |
| TRIAGE R2 no indirect earning | **Broken in 5 games** | new F1 below |
| TRIAGE R3 information stays spent | Holds | Sudoku, Six, Fifteen, Nine |
| TRIAGE R4 perfect play always wins | **Not met on Nine Hard** | new Nine 2 |
| TRIAGE R5 unusable slot explains itself | Holds on tap; **keys silent in Five** | new Five 1 |
| TRIAGE R6 header | Holds | probed all ten |
| TRIAGE R7 one channel, neutral warnings | Holds, one misuse | new Sudoku 3 |
| TRIAGE R8 end card | Holds | |
| TRIAGE R9 keyboard does everything, Enter on a control is that control | **Broken for links** in Seven, Four, Five, Nine | new Shared 1 |
| TRIAGE R10 two-step switches | Holds | |
| TRIAGE R11 naming | Holds | no "CPU" or "-" in visible text |

---

## Family finding F1 [blocker]: R2 holds only where it was listed

The fuzz I used: for random mid-game states, try every power-up on every legal target, then every legal move, and
report a case where the move pays a power-up while the same move without the power-up does not. Three and Fifteen
come back clean. These do not:

- **Endless [blocker]: Boost, then a swipe, pays, and Boost can pay a Boost.** `engine.js:196` raises the boosted
  tile; `move()` (`engine.js:161-168`) has no notion of a power-up having set up the merge. Repro (Node):
  row 0 = `64 _ _ 32`, top 64, `use(s, "boost", 3)` gives `64 _ _ 64`, then `move(.., "left")` makes 128 and returns
  `awarded: [{power: "boost"}]`. The plain swipe on the same board pays nothing. Swap does the same (two 64s on
  different rows, swap one beside the other, swipe: paid). CLAUDE.md: "Boost never awards". DESIGN.md: Boost "does
  not award a milestone power-up (prevents boost-to-reward loops)". The toast even says "Boosts earn no reward."
  (`game.js:186`) one swipe before it earns one. Expected: the Three treatment (`state.free` set by Smash, Swap and
  Boost; the next move's milestones still count but do not award).
- **Fibonacci [blocker]: the same engine, the same loop.** Repro: row 0 = `55 21 _ _`, top 55, Boost 21 to 34, swipe
  left: 55 + 34 = 89, `awarded: [{power: "boost"}]`. The plain swipe cannot merge at all.
- **Seven [blocker]: Smash, then a drop, pays (here, twice).** `seven/engine.js:236-267` makes Smash's own chain
  unpaid (correct), but leaves nothing on the state, so the next `drop()` (`:221-224`, `chain(.., true)`) pays for
  the chain the Smash opened. Repro (Node): `newGame(1, "classic")`, drop in column 0, then column 1, give the state one
  Smash charge, Smash cell 45, drop in column 5: `awarded: [crack (lucky), crack (chain)]`. The same drop without
  the Smash: `awarded: []`. Power-ups do not use a turn in Seven, so this is "the same turn" in R2's words.
- **Four [blocker]: Pop or Tune, then the drop, pays.** `four/engine.js:180-203` spends the charge and returns; the
  drop that follows runs `earnReason` (`:154-155`) as if the board were natural. Repro (Node): `newGame(1, {level: "easy"})`, six plies
  (your drops in `legal(s)[(1 + k) % legal(s).length]`, the computer's replies), one Pop charge, Pop cell 2, then
  drop in column 2: `earned: "block"`, a power-up; the plain drop in column 2 earns
  nothing. Power-ups do not pass the turn here either (DESIGN.md, Four). The existing test "a power-up never earns
  a power-up" (`tests/test-four.js:275-279`) only checks that Tune and Hold themselves award nothing.
- **Nine [blocker]: a round won after Add or Pass pays, which is exactly the Fifteen case TRIAGE1 fixed.**
  `finishRound` (`nine/engine.js:112-121`) awards to the winner with no check for power-ups used in the round.
  Repro (Node): Medium, heaps `[1, 0, 0]`, you to move, Add on tile 0, take 2: `award: {who: "you", name: "peek"}`.
  Repro 2: Easy, heaps `[1, 1, 0]` (a lost position for you), Pass, the computer takes one, you take the last:
  paid. Pass is in the award pool, so Pass can pay a Pass. Fifteen says "A round you win earns a power-up, unless
  you used Erase or Double in it"; Nine should say and do the same (and then re-measure R4, see Nine 2).

Fix once: lift Three's "R2 property: a power-up followed by any move never raises the total stock" into
`tests/conventions.js` as a helper each engine test calls with its own move and power-up generators. That is the
test round 1 asked for in Shared 2, and it would have caught all five.

---

## New findings per game

### Endless
1. **[blocker]** F1 (Boost/Swap then swipe pays). `engine.js:161-168, 196`.
2. **[nit]** Level-5 contrast unchanged (round-1 Endless 5).

Verdict: **7.5/10** (round 1: 8). Every client finding is fixed with a browser test, and the keyboard aiming is the
best in the family. The engine keeps a reward loop its own docs say it does not have.

### Sudoku
1. **[should-fix] DESIGN.md still describes the superseded unit rule.** `docs/DESIGN.md:119-122` ("Units pay once
   each ... first charge at ~9% of cells") and `:44-45` ("Hint is the one way to learn the truth") contradict the
   code and CLAUDE.md (earn by progress; Reveal and Check both reveal truth). The "QA round 1" summary at the bottom
   is right, so the register now says two different things. Replace the section, do not append to it.
2. **[nit] Progress can be front-loaded with junk digits.** Any digit counts (by design) and Undo is free, so on Hard
   a player can type 54 throw-away digits, collect all 6 charges in under a minute, and Undo everything without
   losing them (`sudoku/engine.js:178-186`, `:207-212`). The total is the same as an honest solve, only the pacing
   is gone. Either accept it in DESIGN.md or count only digits that survive N moves.
3. **[nit] Tray explanations use the red-edged warning toast.** `sudoku/game.js:91`: `toast(text, "bad")`. R7 keeps
   "bad" for warnings and losses; the kit has an `"info"` kind for exactly this (`shared/kit.js:42`).
4. **[nit] A test cites the wrong rule.** `tests/test-sudoku.js`: "the move that solves the board never pays (R7: ...)";
   R7 is one channel per event.
5. **[nit]** Layout deviation still undocumented (round-1 Sudoku 6).

Verdict: **8/10** (round 1: 6). The blocker fix is clean, the progress rule really says nothing about correctness, and
the clock now survives reloads. The docs did not keep up.

### Fibonacci
1. **[blocker]** F1 (Boost 21 to 34 beside 55, swipe, +Boost).
2. **[nit] The engine header contradicts DESIGN.md.** `fibonacci/engine.js:11-12` says the rules were never checked;
   DESIGN.md says the merge rule was confirmed. ROADMAP "Resume here" step 2 is still open.

Verdict: **8/10** (round 1: 8.5).

### Seven
1. **[blocker]** F1 (Smash then drop pays two charges).
2. **[should-fix] Enter on a focused games-row link drops a disc and swallows the navigation.** `seven/game.js:307-315`
   guards `BUTTON` only. Repro (Playwright, 1280x860): focus the "Endless" link in the games row, press Enter. The
   URL stays `/seven/` and `state.drops` goes up by one. See Shared 1.
3. **[nit]** Daily re-deal without limit (round-1 Seven 2, half fixed).
4. **[nit] "(Esc cancels)" is shown on phones.** `seven/game.js:132`. Endless and Fibonacci only mention Esc on a fine
   pointer and say "Tap Smash to cancel" otherwise.

Verdict: **7.5/10** (round 1: 7.5). All four round-1 items are handled and the honest overflow ending is good work,
but the new blocker and the link bug cancel the gain.

### Three
1. **[nit] R2 is enforced one swipe deep.** `three/engine.js:241`: Smash can open a gap that a second swipe turns into a
   paid Flush. That is a reasonable line to draw; write it in DESIGN.md so the next reviewer does not re-open it.

Verdict: **8.5/10** (round 1: 6). The model fix of the round: a precise flag, a repro test, an indirect test and a
property test, and the re-measured flush spacing in the header. The other games should copy it.

### Four
1. **[blocker]** F1 (Pop then drop earns "block").
2. **[should-fix] Enter on a focused games-row link drops a disc.** `four/game.js:251`: `tag !== "BUTTON"` lets an `A`
   through. Same repro as Seven 2: URL stays `/four/`, the board changes.
3. **[should-fix] The won/lost record can still be farmed, by abandoning.** `four/game.js:256-263`: "New game" (two
   taps) or a level switch mid-game starts over with no loss recorded. A player who sees a loss coming quits, and the
   record only ever counts games they chose to finish. Five has the same hole (`five/game.js:255-258`). Expected:
   abandoning a game you have dropped in counts as a loss, and the Sure? label says so ("Sure? Counts as a loss").
4. **[nit] The opener can be re-rolled.** `inProgress()` (`four/game.js:255`) is false while only the computer has
   dropped, so New game is one tap and flips `nextFirst`. A player can always open.
5. **[nit] 3px of sideways scroll at 320px.** The stats row is 323px wide. 375px is fine.

Verdict: **7/10** (round 1: 7). The ten-line rule, the owner-filled discs and the measured levels are a real rework,
well tested. The R2 hole, the link bug and the abandon dodge keep it level.

### Five
1. **[should-fix] Number keys on an unusable slot do nothing.** `five/game.js:225-233` (`activate`) returns silently
   when the stock is 0 or Undo cannot act, and the keys call it directly (`:239-241`) instead of clicking the tray
   button as Endless and Four do. Repro: fresh match, press 3: no hint, no toast. Tapping the same button explains
   it. R5 and the Endless contract "a number key behaves exactly like tapping that tray slot".
2. **[should-fix]** Record farming by abandoning (see Four 3).
3. **[nit] Enter on a focused games-row link is swallowed** (`five/game.js:237, 248-251`); no move is made, but the
   link does not open.
4. **[nit] Level "Sure?" fires before you have moved.** `inProgress()` is `state.moves > 0`, and the computer always
   opens, so it is true from the first second. Four handles this with `state.first`. Also, arming Hard then Easy shows
   two "Sure?" buttons at once (the first timer is never cleared, `:265-267`).

Verdict: **8/10** (round 1: 7.5). R4 is met and proven by test on every level, and the computer no longer touches
power-ups. The client is a little behind the rest of the family on R5.

### Six
1. **[nit]** Daily re-deal (round-1 Six 3) and the tier-5 roadmap target (round-1 Six 4) are still open.

Verdict: **8/10** (round 1: 6.5). The keyboard layer that was the most fragile in round 1 is now one of the best
tested (Enter on gaps, Brackets and tray each assert "only that control acted").

### Fifteen
1. **[nit] Enter on a focused link is swallowed while a round result or a targeting power-up is up.**
   `fifteen/game.js:251-258` guards buttons only.
2. **[nit] DESIGN.md "Shared" (`:60`) lists the information power-ups that stay spent and omits Fifteen's Peek,**
   which now follows R3.

Verdict: **8.5/10** (round 1: 6.5). The blocker fix carries the exact repro as its test, R2 is per side and per round
with tests for both directions, and ownership is now readable.

### Nine
1. **[blocker]** F1 (Add or Pass, then a round win, pays).
2. **[should-fix] R4 is not met on Hard, and the copy does not say so.** TRIAGE1 R4: "perfect play by the player can
   always win the match, on every level, and the copy says so plainly". DESIGN.md: perfect play with power-ups wins
   about 66-73% of Hard matches, and a lost match ends the run. The how-to (`nine/index.html:60-61`) says only "Hard
   deals at random". Either the lead amends R4 for Nine Hard in TRIAGE2, or the copy says "On Hard even perfect play
   can lose a match". Note that fixing F1 here removes rewards a perfect player relies on, so the 66-73% must be
   re-measured after it.
3. **[nit] Enter on a focused games-row link is swallowed** (`nine/game.js:288, 299`).
4. **[nit] R1 for Nine is guarded only by the browser suite.** Add the engine test (`canUndo` false after a lost round
   and a lost match) beside the others in `tests/test-nine.js`.

Verdict: **7/10** (round 1: 8). Round 1 scored it high for getting R3 right first. This round it is the game that
does not have the R2 rule its closest sibling (Fifteen) was fixed for.

### Shared, tests and docs
1. **[should-fix] Enter on a focused link is a game action in four games.** Seven and Four make a move; Five and Nine
   eat the keypress; Fifteen sometimes. Endless, Fibonacci, Three and Six guard `tag === "A"`. Repro script: on each
   page, focus the "Endless" link in `#games`, press Enter, read the URL. Expected: one shared guard (for example
   `NumbericsKit.isControl(e)` covering BUTTON, A and INPUT) and one browser check per game that presses Enter on a
   games-row link.
2. **[should-fix]** No shared R2 property test (F1 and round-1 Shared 2).
3. **[nit]** `shared/nav.js:22` dead `|| "./"`; two-line storage-guard window; silent history-scan skip (round-1
   Shared 1, 3, 5, all still open).
4. **[nit] `package.json` still describes the project as "Endless ... and Sudoku".**
5. **[nit] DESIGN.md, ROADMAP.md, README.md and CLAUDE.md have no SPDX lines**, while NEW-GAME.md and every review do.
   Pick one rule for docs and apply it.

---

## Verdicts

| Game | Round 1 | Round 2 | Why it moved |
|---|---|---|---|
| Endless | 8 | 7.5 | client fixes complete; Boost reward loop (F1) |
| Sudoku | 6 | 8 | blocker and oracle fixed; DESIGN.md stale |
| Fibonacci | 8.5 | 8 | same Boost loop |
| Seven | 7.5 | 7.5 | fixes good; Smash-then-drop pays; Enter on a link drops |
| Three | 6 | 8.5 | model R2 fix with property test |
| Four | 7 | 7 | strong rework; Pop-then-drop pays, link bug, abandon dodge |
| Five | 7.5 | 8 | R4 proven; keys silent on empty slots |
| Six | 6.5 | 8 | keyboard layer fixed and tested |
| Fifteen | 6.5 | 8.5 | blocker fixed with the exact repro |
| Nine | 8 | 7 | Add/Pass round wins pay (the Fifteen case); R4 unmet on Hard |
| **Overall** | **7** | **7.5** | |

The round moved the family forward: every round-1 blocker is gone, R1 holds everywhere, and the tests now mostly
assert the rules rather than the authors' examples. It does not reach 8 because the one family rule that was
written as "including indirectly" was applied game by game instead of tested family-wide, and five games fail it.
Fix F1 with one shared property test, fix the link guard once in the kit, and close the abandon dodge, and round 3
should land at 8.5.
