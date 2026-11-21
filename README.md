# Numberics

**Play: https://alvations.github.io/numberics/**

Ten number games, no build step, no tracking. Open `index.html` for the games page: Today's three dailies and a card
for every game. Each game has its own page (Two is `two/`), and the **Games** button in the top bar leads to the rest.

**Two** is 2048 with the ceiling removed. Every tile is a power of two: join them past 2048 and keep going; there is no
winning tile, only how far you get before the board locks. (Two was called Endless; saved games carry over.)

Big joins, from 32 up, earn a **power-up**: **Undo**, **Smash** (delete a tile), **Swap**
(exchange two cells), **Boost** (double a tile). Use them to dig out of a jam and stay alive. Pick how often:
on **Hard** each new highest tile earns one, on **Medium** each join that makes a tile as big as your highest, on
**Easy** each join that makes a tile at least half your highest (about 2x and 3x Hard's rate; `docs/DESIGN.md`).
**Fibonacci** and **Three** have the same three tiers, spaced the same way: in Fibonacci, Medium and Easy also pay joins
that make your top tile or one or three numbers below it (from 55); in Three, Hard pays each Flush, and Medium and Easy
also pay a join as big as your top tile (from 18) or at least half of it (from 9).

## The games

From the smallest number to the biggest:

- **Fibonacci** (`/fibonacci/`): 2584 with no ceiling: merge neighbours in the Fibonacci sequence.
- **Two** (`/two/`): 2048 with no top tile, plus earned power-ups.
- **Three** (`/three/`): Count in threes: step merges and rainbow Flush runs.
- **Four** (`/four/`): Four in a row, or any four that sum to ten.
- **Five** (`/five/`): Add one tile onto another; at five it bursts. Beat the computer.
- **Six** (`/six/`): Make every line equal six, then 66, 6.6, 666.
- **Seven** (`/seven/`): Drop numbered discs; pop seven in one chain for luck.
- **Nine** (`/nine/`): Nim with number tiles up to nine: take from one, last take wins.
- **Fifteen** (`/fifteen/`): Tic-tac-toe in disguise: first to hold three numbers that sum to 15.
- **Sudoku** (`/sudoku/`): Classic 9x9, every puzzle has exactly one solution.

Every game shares one look, one power-up system (earned by play, never bought) and plays on phone and desktop.

## Screenshots

The games page (the root):

| **Phone** | **Desktop** |
|---|---|
| <img src="screenshots/home-mobile.png" width="260" alt="The games page on a phone"> | <img src="screenshots/home-desktop.png" width="520" alt="The games page on a desktop"> |

| **Fibonacci** | **Two** |
|---|---|
| <img src="screenshots/fibonacci-mobile.png" width="260" alt="Fibonacci on a phone"> | <img src="screenshots/two-mobile.png" width="260" alt="Two on a phone"> |

| **Three** | **Four** |
|---|---|
| <img src="screenshots/three-mobile.png" width="260" alt="Three on a phone"> | <img src="screenshots/four-mobile.png" width="260" alt="Four on a phone"> |

| **Five** | **Six** |
|---|---|
| <img src="screenshots/five-mobile.png" width="260" alt="Five on a phone"> | <img src="screenshots/six-mobile.png" width="260" alt="Six on a phone"> |

| **Seven** | **Nine** |
|---|---|
| <img src="screenshots/seven-mobile.png" width="260" alt="Seven on a phone"> | <img src="screenshots/nine-mobile.png" width="260" alt="Nine on a phone"> |

| **Fifteen** | **Sudoku** |
|---|---|
| <img src="screenshots/fifteen-mobile.png" width="260" alt="Fifteen on a phone"> | <img src="screenshots/sudoku-mobile.png" width="260" alt="Sudoku on a phone"> |

Desktop shots are in `screenshots/`. Regenerate with `npm run shots` (needs Playwright).

## Sudoku
Classic 9x9 with three difficulties, pencil notes, undo, hints and red conflict highlighting. Every puzzle is
generated from a seed and has exactly one solution. Keys: `1`-`9`, `Backspace`, `N` notes, `U` undo, `H` hint, arrows.

## Play
Open `index.html` and pick a game, or `npm start` and visit http://localhost:8070.
Arrow keys / WASD / swipe to slide. `1`-`4` or tap a power-up, then tap a target. `Esc` cancels.

## Develop
No build step and no dependencies.
```bash
npm test                                           # both engines + conventions
NODE_PATH=$(npm root -g) node tests/emulation.cjs  # optional, needs Playwright
```
See `CLAUDE.md` for the rules, `docs/DESIGN.md` for how it works and why.

Apache-2.0. Copyright 2026 alvations (Melon Lab).
