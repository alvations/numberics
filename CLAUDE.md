# CLAUDE.md, project memory for Numberics

Read this first. It is the standing memory for the repo (the single highest-leverage artifact in the
sister project melon-eight): stack, core rules, and "keep it this way" notes beside load-bearing decisions.

## What this is
**Numberics Endless**: 2048 with no ceiling, plus earned power-ups. Browser game, static, no build step,
no framework, no backend, no tracking. Playable by opening `index.html` or `npm start` (port 8070).

## Layout
```
engine.js          pure rules (UMD: browser global `Numberics` AND `require`). No DOM/storage/clock.
game.js            browser client: draw, input, persistence. Never re-implements a rule.
style.css          theme tokens, layout, reduced motion
index.html         page shell
tests/test.js      zero-dependency engine + convention tests   (npm test)
tests/emulation.cjs headless-Chromium checks, opt-in, self-skips (npm run test:browser)
docs/DESIGN.md     design principles register + how the power-ups are tuned
```

## Run / test
```bash
node tests/test.js                                   # always, before every commit
NODE_PATH=$(npm root -g) node tests/emulation.cjs    # after any UI change (SHOTS=<dir> saves screenshots)
```
Show a green test and a screenshot in the same turn you say "done". Serve tests on 8070+ (never 5060).

## Core rules (keep it this way)
- **Infinite means infinite.** No win condition, no 2048 special case, no win text. Tiles are stored as
  LEVELS (n means 2^n), so there is no overflow. The only end state is a locked board with no usable power-up.
- **Engine is pure and deterministic.** All randomness is `state.seed` (mulberry32). Same seed + same
  inputs = same game. Any new rule goes in `engine.js` with a test; the client only renders.
- **Power-ups come from play, never farmed.** A NEW highest tile of 32 or more awards one random power-up.
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

## Conventions
- License Apache-2.0, copyright `alvations (Melon Lab)`. Never remove LICENSE, NOTICE or headers.
- No AI model identifiers in code, comments, docs or commit messages.
- Verify in a real browser after UI changes (Playwright Chromium is preinstalled in the cloud container).

## Known gaps / ideas queue
- Sound, share card, achievements/collection and save-file export (all exist in melon-eight) are not built.
- Only a 4x4 board is wired in the UI; the engine already accepts other `size` values.
- Deploy target not chosen (GitHub Pages from `main` / root would work as is).
