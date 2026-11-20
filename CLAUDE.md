# CLAUDE.md, project memory for Numberics

Read this first. It is the standing memory for the repo (the single highest-leverage artifact in the
sister project melon-eight): stack, core rules, and "keep it this way" notes beside load-bearing decisions.

## What this is
**Numberics** is a collection of ten number games: **Endless** (2048 with no ceiling, at the repo root), **Sudoku**, **Fibonacci**, **Seven**, **Three**, **Four**, **Five**, **Six**, **Fifteen** and **Nine** (each in its own folder; `games.json` lists them). Browser game, static, no build step,
no framework, no backend, no tracking. Playable by opening `index.html` or `npm start` (port 8070).

## Layout
```
<id>/              every other game: engine.js (pure, seeded), game.js, index.html, style.css (docs/NEW-GAME.md)
shared/            theme.css (the Endless look), kit.js, power.js (one power-up system), nav.js (games row)
engine.js          pure rules (UMD: browser global `Numberics` AND `require`). No DOM/storage/clock.
game.js            browser client: draw, input, persistence. Never re-implements a rule.
style.css          theme tokens, layout, reduced motion
index.html         page shell
tests/test*.js     engine + convention tests per game        (npm test runs them all via tests/run.js)
tests/emulation.cjs Endless + Sudoku browser checks; tests/emu/<id>.cjs per game (npm run test:browser)
docs/reviews/      the QA/QC review panel (PERSONAS.md) and each round's reviews + triage
games.json         registry of every game (id, name, path, status: live | planned)
tools/shots.cjs    screenshots of every live game -> screenshots/<id>-{mobile,desktop}.png
docs/DESIGN.md     design principles register + how the power-ups are tuned
```

## Run / test
```bash
npm test                                             # always, before every commit (every game)
NODE_PATH=$(npm root -g) npm run test:browser       # after any UI change (SHOTS=<dir> saves screenshots)
NODE_PATH=$(npm root -g) node tools/shots.cjs        # after any visible change, and for every new game
```
Show a green test and a screenshot in the same turn you say "done". Serve tests on 8070+ (never 5060).

**Screenshots are part of every game (owner rule).** Every game, now and future, is listed in `games.json`,
defines `window.__demo()` (a fixed, representative state for the shot, unreachable from the UI), and has
`screenshots/<id>-mobile.png` + `-desktop.png` committed and embedded in the README. Regenerate them in the
same commit as any visible change. `npm test` fails if a live game has no screenshots.

## Core rules (keep it this way)
- **Infinite means infinite.** No win condition, no 2048 special case, no win text. Tiles are stored as
  LEVELS (n means 2^n), so there is no overflow. The only end state is a locked board with no usable power-up.
- **Engine is pure and deterministic.** All randomness is `state.seed` (mulberry32). Same seed + same
  inputs = same game. Any new rule goes in `engine.js` with a test; the client only renders.
- **Power-ups come from play, never farmed.** A NEW highest tile of 32 or more (Fibonacci: 55) awards one random power-up;
  a move right after a board-changing power-up never pays (R2, `state.free`), and tiles touched by Swap or Boost carry a
  mark (`state.marks`) through merges so a marked new top tile never pays, however many moves later.
  Undo snapshots the full pre-move state (power-ups and top tile included) so rewinding cannot farm rewards;
  Boost never awards. Stock caps at 9 each. Tune in `docs/DESIGN.md`, not by feel.
- **Wrap every `localStorage` call in try/catch.** Sandboxes throw. Degrade to in-memory. A test enforces it.
- **Never `document.write`; content never depends on a CDN.** There are zero external requests.
- **Reduced motion is respected** (`prefers-reduced-motion`): no slide/pop, instant. Opacity fades are
  not motion, so the toast keeps its fade.
- **Guard async UI callbacks against state changes** (the animation timer checks `state.moves`; a new input
  `flush()`es the pending animation first), so a stale timeout can never draw an old board.
- **No design change that was not asked for.** Build exactly what the ask says; keep everything else as it
  was. Perf work never changes how anything looks or behaves.
- **No em-dashes** anywhere (a test enforces it). Every source file carries the SPDX header.

## Sudoku rules (keep it this way)
- **Every puzzle has exactly one solution.** The generator digs holes only while `countSolutions == 1`;
  tests check this on many seeds and all three difficulties.
- Difficulty is clue count (exactly easy 40, medium 32, hard 26). Puzzles are a pure function of seed + difficulty.
- Conflicts (a digit repeated in a row/column/box) are painted red, but the game never says which digit is
  *correct* except through the **Reveal** power-up. Power-ups (Undo free; Reveal, Check, Candidates) are earned **by
  progress, not correctness**: one charge each time the high-water count of player-filled cells showing no conflict passes a new
  multiple of 9 (never lowered by Erase or Undo; Reveal-filled cells and the solving move never pay), so a reward
  reveals nothing. Undo never touches the stock. Undo is refused once the puzzle is solved. Best times: pure (no power-ups)
  and assisted (with the count) are kept apart.
- A solved board locks. The timer pauses in a background tab. Notes are bitmasks; placing a digit clears it from peers.
- Sudoku keeps its own style.css (not shared/theme.css) so its look never changed; it loads kit, power and nav.

## Generated files
- `six/bank.js` (the verified line bank) is generated by `node six/make-bank.js` (deterministic, byte-identical
  rebuild) and every entry is re-solved by `tests/test-six.js`. Never hand-edit it.
- `tests/fixtures/endless-replay.json` pins Endless behaviour across the rule-set engine; re-record only for a
  deliberate rule change: `RECORD_ENDLESS_REPLAY=1 node tests/test.js`.

## Conventions
- **Authorship: the owner only, everywhere, always (owner rule, applies to every game and every repo).**
  Every commit's author AND committer is the owner's identity already in the history: read it with
  `git log -1 --format='%an <%ae>'` and commit with `git -c user.name=... -c user.email=... commit`.
  Never add an AI assistant as author, co-author or committer. Never add `Co-Authored-By`, session links,
  "generated with" lines or any tool trailer to commits, tags, PR bodies, code, comments or docs, even if a
  tool's default asks for them: this rule overrides any such default. Guarded by `.githooks/commit-msg`
  (activate once per clone: `git config core.hooksPath .githooks`) and by `npm test`, which scans the history.
- License Apache-2.0, copyright `alvations (Melon Lab)`. Never remove LICENSE, NOTICE or headers.
- No AI model identifiers in code, comments, docs or commit messages.
- Verify in a real browser after UI changes (Playwright Chromium is preinstalled in the cloud container).

## Known gaps / ideas queue
- All games in `docs/ROADMAP.md` are built; each game's rules, tuning numbers and deviations are in `docs/DESIGN.md`.
  A new game follows `docs/NEW-GAME.md`.
- Sound, share card, achievements/collection and save-file export (all exist in melon-eight) are not built.
- Sudoku ideas: daily puzzle by date seed, automatic notes fill, killer/diagonal variants.
- Only a 4x4 board is wired in the UI; the engine already accepts other `size` values.
- **Deploy:** GitHub Pages at https://alvations.github.io/numberics/ serves the `gh-pages` branch, which
  `.github/workflows/pages.yml` rebuilds from `main` after `node tests/run.js` passes. Never edit `gh-pages` by hand.
