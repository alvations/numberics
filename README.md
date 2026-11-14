# Numberics

Number games, no build step: **Endless** (2048, no ceiling) at `/` and **Sudoku** at `/sudoku/`.

**Numberics Endless** is 2048 with the ceiling removed. Merge past 2048 and keep going: there is no winning
tile, only how far you get before the board locks.

Every new highest tile from 32 up earns a **power-up**: **Undo**, **Smash** (delete a tile), **Swap**
(exchange two cells), **Boost** (double a tile). Use them to dig out of a jam and stay alive.

## Sudoku
Classic 9x9 with three difficulties, pencil notes, undo, hints and red conflict highlighting. Every puzzle is
generated from a seed and has exactly one solution. Keys: `1`-`9`, `Backspace`, `N` notes, `U` undo, `H` hint, arrows.

## Play
Open `index.html`, or `npm start` and visit http://localhost:8070.
Arrow keys / WASD / swipe to slide. `1`-`4` or tap a power-up, then tap a target. `Esc` cancels.

## Develop
No build step and no dependencies.
```bash
npm test                                           # both engines + conventions
NODE_PATH=$(npm root -g) node tests/emulation.cjs  # optional, needs Playwright
```
See `CLAUDE.md` for the rules, `docs/DESIGN.md` for how it works and why.

Apache-2.0. Copyright 2026 alvations (Melon Lab).
