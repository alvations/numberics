# Adding a game to Numberics

Every game follows the same contract, so it looks and plays like Two (the root game). Read `CLAUDE.md` and
`docs/ROADMAP.md` (your game's section and section 0a, power-ups) first.

## Files (all in `<id>/`, except the tests)
| File | What |
|---|---|
| `<id>/engine.js` | **pure** rules, UMD: browser global `Numberics<Name>` and `require()`. No DOM, storage or clock. All randomness from a seed in the state (`NumbericsKit.rand`-style mulberry32 copied in, or `require("../shared/kit.js")` in Node and the global in the browser). State is plain JSON so it can be saved. |
| `<id>/game.js` | client: draw, input, persistence. Never re-implements a rule. Defines `window.__demo()` (a fixed representative state for screenshots) and `window.__<id>` (get/set state, for tests). |
| `<id>/index.html` | the page (template below) |
| `<id>/style.css` | only what the shared theme does not cover |
| `tests/test-<id>.js` | zero-dependency engine tests + `require("./conventions")(...)` on the four files |
| `tests/emu/<id>.cjs` | browser checks: plays, power-ups, blocked storage, reduced motion, no page errors |

## Page template
```html
<!doctype html>
<!-- SPDX-License-Identifier: Apache-2.0 | Copyright 2026 alvations (Melon Lab) -->
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Numberics Seven</title>
<meta name="description" content="One sentence.">
<meta name="theme-color" content="#14151c">
<link rel="icon" href="data:image/svg+xml,...a 7 in accent gold on #14151c, like the Two icon...">
<link rel="stylesheet" href="../shared/theme.css">
<link rel="stylesheet" href="style.css">
</head>
<body>
<main id="app">
  <header>
    <div class="brand"><h1>Seven</h1><p class="sub">One short line in the Two voice.</p></div>
    <div class="stats"><div class="stat"><span>Score</span><b id="score">0</b></div> ...</div>
  </header>
  <section id="tray" class="tray" aria-label="Power-ups"></section>
  <p id="hint" class="hint" role="status"></p>
  <div id="board" class="board" tabindex="0" aria-label="..."> ... <div id="over" class="over" hidden>...</div></div>
  <div class="row"><button id="new" class="btn" type="button">New game</button></div>
  <p class="how">One or two lines: controls and the goal. Never spoil strategy.</p>
  <nav id="games" class="games" data-root="../" data-current="seven" aria-label="Numberics games"></nav>
  <div id="toast" class="toast" role="status" aria-live="polite"></div>
</main>
<script src="../shared/kit.js"></script>
<script src="../shared/power.js"></script>
<script src="engine.js"></script>
<script src="game.js"></script>
<script src="../shared/nav.js"></script>
</body>
</html>
```
Layout order is fixed: header (title + stats) -> power-up tray -> hint line -> board -> New game -> how-to ->
games row. Turn-based games against the computer put the difficulty `.seg` row under the header.

## Rules that every game keeps
- Power-ups (section 0a): `NumbericsPower.tray(...)` for the tray, `stock/award/spend` in the engine; start with
  one Undo; earn by play only; cap 9; Undo restores the whole snapshot including the stock; a power-up never
  earns one. Keys `1`-`4` use slots, `Esc` cancels targeting.
- Storage only through `NumbericsKit.store(key)` (key `numberics_<id>_v1`), validate what you load.
- Reduced motion: no movement animation (opacity fades are fine). Respect it via CSS and `NumbericsKit.reducedMotion()`.
- Guard every async UI callback (timers, animation ends) against a state change in between.
- Phone first: works at 375px wide with a 16px gutter, no horizontal scroll; keyboard and touch both work.
- No em-dashes, SPDX header on every file, no `eval`/`Function`, no external requests, no new fonts.
- Colours only from theme tokens and `NumbericsKit.hue(level)`; the accent gold marks the player / success.
- Screenshots: `NODE_PATH=$(npm root -g) node tools/shots.cjs <id>` and look at both images.
