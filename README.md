# Numberics

**Numberics Endless** is 2048 with the ceiling removed. Merge past 2048 and keep going: there is no winning
tile, only how far you get before the board locks.

Every new highest tile from 32 up earns a **power-up**: **Undo**, **Smash** (delete a tile), **Swap**
(exchange two cells), **Boost** (double a tile). Use them to dig out of a jam and stay alive.

## Play
Open `index.html`, or `npm start` and visit http://localhost:8070.
Arrow keys / WASD / swipe to slide. `1`-`4` or tap a power-up, then tap a target. `Esc` cancels.

## Develop
No build step and no dependencies.
```bash
node tests/test.js                                 # engine + conventions
NODE_PATH=$(npm root -g) node tests/emulation.cjs  # optional, needs Playwright
```
See `CLAUDE.md` for the rules, `docs/DESIGN.md` for how it works and why.

Apache-2.0. Copyright 2026 alvations (Melon Lab).
