<!-- SPDX-License-Identifier: Apache-2.0 -->
<!-- Copyright 2026 alvations (Melon Lab) -->

# Review round 1: the harsh but impartial critic

Scope: all ten live games in `games.json`, `shared/`, `tests/`, and the docs (CLAUDE.md, ROADMAP, DESIGN, NEW-GAME).
This is round 1, so there are no earlier reviews or triage files to check against.

What I ran (20 Nov 2026, branch `build/games`, working tree clean):
- `node tests/run.js`: 11 files, 368 checks, all green.
- `NODE_PATH=$(npm root -g) npm run test:browser`: 25 + 308 checks, all green.
- My own probes: Node scripts against every engine, and Playwright against `python3 -m http.server 8081` at 375px,
  320px and 390x844, with and without `prefers-reduced-motion: reduce`.
- `git log`: every commit is authored and committed by the owner. There are no trailers and no AI identity.

## Overall verdict

The family is in good shape. Every game has a pure, seeded engine. Storage is guarded. Nothing is fetched from
outside. Reduced motion is honoured: under `reduce`, the only transitions left are background-colour, box-shadow and
opacity fades, which are not motion. At 375px no page scrolls sideways. Screenshot hooks exist and both test suites
pass. That is a better base than most first rounds get.

Green tests are not the same as correct rules, though. The suites check what each author thought of. They do not
check the cross-cutting promises that make this one family:
- **"A power-up never earns one."** Three breaks this: a Swap lines up a Flush and the next move pays for it.
- **"A spent information power-up stays spent through Undo."** Nine gets this right. Fifteen refunds Peek through
  Undo.
- **"A solved board locks."** In Sudoku, Undo unlocks a solved board and the timer stays stopped.

Each of these is a stated rule, quoted in CLAUDE.md or DESIGN.md, and each fails a five-line probe. There is also a
family-wide gap in keyboard play: Smash, Swap, Boost and Pop cannot be aimed without a pointer. Undo after a lost
round follows three different rules in three games. Keyboard handling on Six edits the wrong thing when a button has
focus.

Blockers: 3. Should-fix: 15. Nits: 26.

---

## Endless (root: `index.html`, `engine.js`, `game.js`, `style.css`)

1. **[should-fix] Power-ups that need a target cannot be used from the keyboard.** `game.js:137-165`. Pressing `2`
   arms Smash, but the only way to pick a target is a click on the board (`boardEl.addEventListener("click", pick)`,
   line 178). Repro: Tab to the board, press `2`, then try arrows or Enter. The arrows are blocked while targeting
   (`doMove` returns early, line 118) and nothing selects a cell. Expected: a keyboard cursor over the cells (arrows
   move it, Enter picks), as Sudoku and Five already have.
2. **[nit] The tray overflows at 320px.** `style.css:21-26`. Endless keeps its own tray rules, without the
   `@media (max-width:380px)` shrink and `white-space:nowrap` that `shared/theme.css:23-30` gives the other games.
   Measured: `scrollWidth` 335 at a 320px viewport, so the page scrolls sideways. 375px is fine, so this is a nit,
   but every game except Endless and Sudoku passes at 320.
3. **[nit] Tray buttons have no `aria-label` with the count.** `game.js:90-101` builds its own tray. A screen reader
   hears "Smash 2" from the text nodes, but not the description that `NumbericsPower.tray` gives the other nine games
   (`shared/power.js:35`). This is a family inconsistency.
4. **[nit] Saved-state validation is shallow.** `game.js:24-28` checks `grid`, `power` and `score` only. It does not
   check `moves`, `top`, `seed` or `prev`. A hand-edited or old save with a malformed `prev` throws inside `use()` at
   `engine.js:185` (`p.grid.slice`), so Undo dies silently. Fibonacci validates more fields (`fibonacci/game.js:12-16`).
   Expected: one validator for both.
5. **[nit] The tile at level 5 (32) has 3.45:1 contrast.** `#15151d` text on `hsl(245 62% 60%)`. That passes only
   because tile digits are large and bold. The same hue is used for small text elsewhere (the Seven `.mini` preview
   for a 5, the Nine tile 5 label). Every other level up to 12 is above 4.8:1.

Verdict: **8/10.** The engine is solid and the replay fixture is a model for the others. The client predates the
shared kit and shows it.

## Sudoku (`sudoku/`)

1. **[blocker] Undo unlocks a solved board, and the timer stays stopped.** `sudoku/engine.js:208-211`
   (`undo` sets `solved = false`), and `sudoku/game.js:98` and `:116`, where Undo stays enabled when solved.
   `commit()` clears the interval on solve (`game.js:108`) and nothing restarts it. Repro (Playwright): fill every
   empty cell with the solution, see "Solved", then press `U`. The overlay hides, the board is editable, and the
   clock does not move over the next 2 s. CLAUDE.md says: "A solved board locks." Expected: Undo is disabled once
   `state.solved` is true, both in the engine and in the tray.
2. **[should-fix] Changing difficulty throws away a puzzle in progress with one tap.** `sudoku/game.js:162`:
   `if (l !== state.difficulty || ...) fresh(l)`. Repro: place 50 digits on Medium, tap "Easy". Measured: moves went
   from 50 to 0 and the puzzle was replaced with no confirmation. "New puzzle" asks "Sure?" (`:167-173`), and Four,
   Five, Fifteen and Nine all ask for a second tap before a difficulty change. Expected: the same second tap here.
3. **[should-fix] Finishing a unit tells the player whether it is correct, and free Undo turns that into a guessing
   oracle.** `sudoku/engine.js:176-187` pays a unit only when all nine digits match the solution, and
   `game.js:112` toasts "Unit complete: +1 ...". Undo is free and unlimited, and it re-opens the paid bit
   (`engine.js:215`). So a player can fill a box with a guess, read whether a toast appears, undo, and try again,
   all without spending a power-up. Repro (Node, seed 3 medium, unit 19, two empty cells): the correct fill returns
   `gain: ["cands"]` and a wrong fill returns `gain: []`. Here the wrong fill also shows red conflicts, but that is
   not guaranteed when other cells in the peers are still empty. CLAUDE.md: "the game never says which digit is
   correct except through the Reveal power-up", and pure best times rely on that. Expected: either pay a unit when it
   is full and conflict-free (whether or not it is right), or decide at triage that this leak is acceptable and write
   it in DESIGN.md.
4. **[should-fix] Time is saved when the tab becomes visible, not when it is hidden.** `sudoku/game.js:190`:
   `if (!document.hidden) save()`. Up to 4 s of elapsed time is lost on every tab close (it saves every 5 s,
   `:54`). Expected: save on `hidden` and on `pagehide`.
5. **[nit] The tray overflows at 320px.** Same cause as Endless 2 (`sudoku/style.css`). `scrollWidth` is 338 at 320.
6. **[nit] The layout differs from the family contract.** The tray sits below the board and there is no hint line.
   This was allowed by ROADMAP section 8 ("the board, numpad and layout stay as they are"), but write it down as a
   deviation in DESIGN.md "Sudoku power-ups" so the next reviewer does not flag it again.
7. **[nit] `role="grid"` without `role="row"` children** (`index.html:28`, `game.js:40`) is invalid ARIA. Use
   `role="group"` with labelled cells, or add the rows.

Verdict: **6/10.** The generator and the power-up economy are careful work. The solved-board unlock and the
one-tap data loss are exactly the "fragile UI" this panel exists to catch.

## Fibonacci (`fibonacci/`)

1. **[should-fix] Smash, Swap and Boost cannot be aimed from the keyboard.** Same as Endless 1:
   `fibonacci/game.js:137-148`, with the click handler at `:160`.
2. **[nit] Saved-state validation does not check `prev`.** `fibonacci/game.js:12-16`. A malformed snapshot throws in
   Undo (`../engine.js:185`).
3. **[nit] Rules not checked against the reference.** DESIGN.md admits the 2584 page was never reached. ROADMAP
   "Resume here" step 2 is still open. Spawn odds and scoring are assumed. Expected: either check them or move the
   assumption into the in-game how-to line.

Verdict: **8.5/10.** It is the cleanest reuse in the family: the rule-set refactor, the byte-identical replay, and
the correct labels for huge indices.

## Seven (`seven/`)

1. **[should-fix] Undo is not counted as a power-up used, because a comment swallowed the code.**
   `seven/engine.js:232`:
   `var p = clone(state.prev); p.power.undo = Math.max(0, p.power.undo - 1); // the rewind is paid for p.prev = null; p.used = state.used + 1;`.
   Everything after `//` is dead, so `used` reverts to the snapshot's value. Repro (Node): `newGame(5)`, drop in
   column 3, then Undo. `state.used` is 0 afterwards. The end screen ("power-ups used N", `seven/game.js:115`) then
   reports a run with Undo as pure. ROADMAP 0a: "Best times and high scores record how many power-ups were used."
   Three, Five, Six and Nine all do `used = state.used + 1`. The tests (`tests/test-seven.js:142-148`) never assert
   on `used`, which is why this got through.
2. **[nit] Daily can be replayed without limit, and its best score mixes days.** `seven/game.js:27`: "New game" on
   Daily re-deals `today`, so a player can retry the same well until it goes well. `best.daily` (`:24`, `:38`) is
   never reset when the day changes. Expected: a per-day best, or a label such as "best Daily ever".
3. **[nit] `today` is computed once at load** (`seven/game.js:20`). A tab left open past midnight keeps playing
   yesterday's Daily. Six has the same pattern but re-checks in `setMode` (`six/game.js:199`).
4. **[nit] Saved-state validation skips `left`, `level`, `held` and `prev`** (`seven/game.js:12-17`). A save missing
   `left` gives `NaN` pips and the eggs never rise.

Verdict: **7.5/10.** The wave-by-wave trace and its playback are the best animation code here. The swallowed line
is careless.

## Three (`three/`)

1. **[blocker] A power-up earns a power-up: Swap (or Smash, or Third) builds a Flush, and the next move pays for
   it.** `three/engine.js:253-273` (`use`) never resolves flushes, so a run the power-up creates waits on the board.
   The next `move()` then calls `resolveFlushes` (`:234`), which awards (`:182`). Repro (Node):
   - grid row 0 = `3 9 6 _`, then `use(s, "swap", 1, 2)`, which gives `3 6 9`. `findRuns` already sees the run.
   - `move(.., "down")`: the whole row steps down intact, the flush fires, and the result has `power: "smash"`.

   The engine's own header (`:17`) and CLAUDE.md say "a power-up never earns one", and Seven handles this case
   correctly with `earn=false` (`seven/engine.js:253`). Expected: resolve flushes inside `use()` with no award and no
   score bonus, or mark the cells a power-up touched so the next flush through them does not pay.
2. **[should-fix] Smash, Swap and Third cannot be aimed from the keyboard.** `three/game.js:153-164`, click only
   (`:176`).
3. **[nit] Reduced motion still holds a 450 ms pause per flush** (`three/game.js:9`). That is allowed, since a static
   outline is not motion. But a 3-flush cascade blocks input for about 1.4 s, and `settle()` on the next key
   short-circuits it anyway. Consider 250 ms.

Verdict: **6/10.** The tuning notes are excellent, the best in the repo. Blocker 1 breaks a rule the file states in
its own header.

## Four (`four/`)

1. **[should-fix] The won/lost record can be farmed with Undo after a win.** `four/game.js:133-139` counts a result
   once per `counted`, and Undo resets `counted = false` (`:181`) without taking the result back out. Repro
   (Playwright, Medium, a winning drop staged, 3 Undo charges): drop, Undo, drop, Undo, drop. The record reads
   `Won 1`, then `Won 2`, then `Won 3` for one game. After a loss, Undo then a win records both a loss and a win.
   Five does this correctly: it decrements the record on Undo (`five/game.js:212`). Expected: the same here.
2. **[should-fix] Pop cannot be aimed from the keyboard.** `four/game.js:213` is click only, and the keydown handler
   returns while targeting (`:228`). Tune got a keyboard path (digits); Pop needs one too, for example the arrow
   cursor and Enter to pop the top disc of the column, the way Seven aims Smash.
3. **[nit] The computer earns power-ups on Easy and Medium and never spends them.** `four/engine.js:153-154` awards
   for both sides at every level, while only `hardPowers` (`:383`) uses them. ROADMAP 0a says the computer gets them
   "on Hard". It is harmless today, but the saved state carries a growing stock that means nothing. Five
   (`earns()`, `five/engine.js:174`) and Fifteen gate this correctly.
4. **[nit] Changing difficulty is confirmed by a toast here, by a "Sure?" label in Five, and not at all in Sudoku.**
   Pick one pattern (`K.twoStep` already exists) and use it everywhere.

Verdict: **7/10.** The search is strong and honest about hidden information. The client bookkeeping is weaker.

## Five (`five/`)

1. **[should-fix] Undo can cancel a lost round and even a lost match.** `five/engine.js:209`: `canUse` for Undo
   only refuses when `roundOver === "p"`. After the computer wins the deciding round, Undo brings the match back, and
   the client even decrements `record.lost` (`five/game.js:212`). Nine allows the same (`nine/engine.js:137`).
   Fifteen refuses once the match is decided (`fifteen/engine.js:194`). Three different rules for one family
   ("learn it once", ROADMAP 0a). Expected: one rule, written in DESIGN.md "Shared". My suggestion is that Undo never
   crosses a decided round in either direction.
2. **[nit] Level change uses a third confirmation pattern** (button text turns "Sure?", `five/game.js:252-256`).
   See Four 4.
3. **[nit] `aiPlan` returns a seed and the client writes it straight into the live state** (`five/game.js:169`,
   `state.seed = r.seed`) before `runPlan` applies the plan. This mutates the state object outside the engine.
   It is harmless today, but it breaks "the client only renders".

Verdict: **7.5/10.** The retrograde solve and the decision about who moves first are exemplary. The Undo rule is
not.

## Six (`six/`)

1. **[should-fix] Enter or Space on a focused button also edits whatever the keyboard cursor is on.** The
   `six/game.js:270-284` keydown handler has no `tag === "BUTTON"` guard (Seven `:249`, Four `:232` and Nine `:274`
   have one) and calls `preventDefault`, which also cancels the button's own click. Repro (Playwright): load Six,
   focus the second gap button (`.gp[data-g="1"]`), press Enter. The gap stays empty and number 1 gets a square root
   (`u: [0,0,0]` became `u: [1,0,0]`). A keyboard user who tabs to a gap edits the wrong element. The same applies to
   the "Answer", "Bracket" and tray buttons.
2. **[should-fix] A bare `c` key clears the whole line, and getting it back costs an Undo charge.**
   `six/game.js:315`. One stray keypress wipes a long line, and Undo is a scarce, earned power-up here (it starts
   with 1). Expected: a confirmation like "Answer" has, or make Clear free to undo.
3. **[nit] "New game" on Daily re-deals the same Daily** (`six/game.js:203`), so it can be retried without limit.
   See Seven 2.
4. **[nit] Known gap carried, not fixed:** about 20 tier-5 lines, so long Climb runs repeat (DESIGN.md "Six").
   This is a content gap rather than a bug, but it belongs on the roadmap with a size target.

Verdict: **6.5/10.** The exact-arithmetic solver, the parser that never calls `eval`, and the verified bank are the
most impressive engineering in the repo. The keyboard layer on top is the most fragile.

## Fifteen (`fifteen/`)

1. **[blocker] Undo refunds a spent Peek.** `fifteen/engine.js:209-214` restores `state.prev` wholesale, and Peek
   deliberately does not move the snapshot (`:220`). So if you Peek at the start of a turn, the snapshot is the
   start of your previous turn, taken before the Peek was spent. Repro (Node): seed 5 Medium, `peek=1`, `undo=2`.
   Claim 5, let the computer reply, Peek (peek now 0, and you see the best moves), then Undo. Result: `peek` is back
   to 1. Replay the same claim (the computer is seeded, so its reply is the same) and you hold the information plus
   the charge. DESIGN.md "Shared": "Where a power-up reveals information ... a spent charge stays spent through Undo."
   Nine does exactly this (`nine/engine.js:150`), and the comment at `fifteen/engine.js:212` ("nothing else comes
   back") is false. Expected: `r.power.peek = Math.min(r.power.peek, state.power.peek)`, with a test.
2. **[should-fix] Undo after a lost round is allowed (until the match is decided).** See Five 1 for the family
   inconsistency. `fifteen/engine.js:194`.
3. **[nit] Peek is a power-up whose use still lets the round earn.** `usedPower` is set for Erase and Double only
   (`:223`). That is defensible, since Peek only shows information, but write it in DESIGN.md.

Verdict: **6.5/10.** The solver and the "same game" reveal are lovely. Blocker 1 is the rule Nine got right one
folder over.

## Nine (`nine/`)

1. **[should-fix] Undo can reverse a lost match ("Run over").** `nine/engine.js:137` refuses only after a round
   *won*. The over screen even advertises it (`nine/game.js:139`, `:148`). See Five 1 for why the family needs one
   rule.
2. **[nit] The computer's award pool includes Undo and Peek, which it never uses.** `nine/engine.js:106` draws from
   `POWERS`. On Hard, half the computer's earned charges are dead. Fifteen limits the computer to what it uses
   (`CPU_POWERS`). Expected: the same here, since it changes how strong Hard is.
3. **[nit] The `l` key toggles the Learn view from anywhere** (`nine/game.js:262`), and the how-to line does not
   mention it. Either document the key or drop it.

Verdict: **8/10.** It has the clearest rules, a correct Peek-through-Undo guard, and good fairness reasoning.

## Shared (`shared/`) and tests

1. **[nit] `shared/nav.js:22`: `a.href = root + g[2] || "./";`.** By operator precedence the `||` never applies.
   Line 23 papers over it. That is dead logic: remove the `|| "./"`.
2. **[should-fix] The tests do not guard the family-wide promises.** All three blockers and Seven 1 pass every suite.
   Add one shared property test per game:
   - "no power-up followed by any move ever increases total stock",
   - "Undo after an information power-up never increases its stock",
   - "Undo is refused on a solved or decided board",
   - "`used` increases by exactly one per power-up, Undo included".

   `tests/conventions.js` is the natural home for these.
3. **[nit] The storage guard is a two-line text window** (`tests/conventions.js:17-19`, `tests/test.js:129-133`). A
   `localStorage` call three lines inside a `try` fails it, and a call outside a `try` but within two lines of an
   unrelated `try {` passes. All the code now goes through `NumbericsKit.store` (except Endless), so instead assert
   "no `localStorage` outside `shared/kit.js` and the root `game.js`".
4. **[nit] The browser suites never press Enter or Space on a focused button**, which is how Six 1 got through. Add
   one keyboard pass per game: Tab to each control, press Enter, and assert that only that control's action happened.
5. **[nit] The history scan passes silently when `git` is missing** (`tests/test.js:139-140`, `catch (e) { return; }`).
   That is the right call for a zip download. Print "skipped" so a CI without git does not look green on this check.

## Verdict per game

| Game | Score |
|---|---|
| Endless | 8 |
| Sudoku | 6 |
| Fibonacci | 8.5 |
| Seven | 7.5 |
| Three | 6 |
| Four | 7 |
| Five | 7.5 |
| Six | 6.5 |
| Fifteen | 6.5 |
| Nine | 8 |
| **Overall** | **7/10** |

Fix the three blockers (Three power-up-to-Flush, Fifteen Peek refund, Sudoku solved-board unlock) and the Seven
`used` line. Settle one Undo-after-loss rule for the family and add the property tests in Shared 2. With that done,
the next round should start at 8 or better.
