<!-- SPDX-License-Identifier: Apache-2.0 | Copyright 2026 alvations (Melon Lab) -->
# The PERF gate

Every change passes QA, QC and PERF. `tools/perf.cjs` is the PERF part: it loads and plays every live game in
`games.json` (by its `path`, so renamed or moved games follow automatically), plus the games page at the root
(id `root`; O-9 made it the games page, so it is no longer one of the games), in Chromium,
and checks the numbers against `tools/perf-budgets.json`. It exits 1 and prints each failed budget.

## Run
```bash
NODE_PATH=$(npm root -g) node tools/perf.cjs              # every live game + root, 3 runs each, about 50 minutes
NODE_PATH=$(npm root -g) node tools/perf.cjs four nine    # only these ids (the games page's id is "root"; an unknown id fails)
PERF_RUNS=1 PERF_PLAY_MS=5000 NODE_PATH=$(npm root -g) node tools/perf.cjs   # a quick look, not a gate run
```
Env: `PERF_OUT=<file>` (the JSON report; default `<os tmpdir>/numberics-perf-report.json`), `PERF_RUNS`
(default 3), `PERF_PLAY_MS` (default 20000), `PERF_VIEWS=phone` or `desktop` (default both). The server runs on a
random free port, so it never clashes with other agents or `npm start`. Run the gate on a quiet machine: other
heavy jobs on the same cores slow the throttled phone runs.

## What is measured
Two views: **phone** 390x844 (mobile, touch, DPR 3) with **4x CPU throttling** (CDP
`Emulation.setCPUThrottlingRate`), and **desktop** 1280x860 unthrottled. Each page and view runs `PERF_RUNS` times
in a fresh browser context (fresh storage). Timing metrics are the **median of the runs**; weight, request counts,
external requests and page errors are the **worst run**.

| Metric | What |
|---|---|
| `weightKB` | bytes of the page and every same-origin response (body + headers), load and play |
| `requests` | number of same-origin requests |
| `external` | requests to any other origin. They are blocked and counted; the budget is 0 |
| `pageErrors` | uncaught page errors during load and play |
| `fcpMs`, `dclMs` | first contentful paint, DOMContentLoaded end |
| `loadLongTaskMs` | the longest long task (PerformanceObserver `longtask`, 50 ms and up) up to 1.5 s after load |
| `loadCls` | layout shift during load |
| `playLongTaskMs` | the longest long task during play, outside the computer's move |
| `p95FrameMs`, `droppedPct` | requestAnimationFrame sampled with `performance.now()` during play: p95 frame time, and the share of 60 Hz frames missed |
| `cls` | layout shift during play, not counting shifts right after the player's input (the CLS rule) |
| `cpuMs`, `cpuLongTaskMs` | games against the computer: the worst engine call for the computer's move, and the longest long task overlapping one |
| `replyMs` | games against the computer: median time from the player's move to the computer's move on screen (two frames after the engine call returns). It includes each game's designed thinking pause |
| `cpuMovesMin` | games against the computer: the median run's count of computer moves must be at least this, so the reply budgets cannot pass by measuring nothing |

**Play.** After load the page's `window.__demo()` runs (the representative state the screenshots use), then
`PERF_PLAY_MS` of scripted input, one action every 140 to 260 ms: keys, and clicks on whatever is clickable outside
the header, the games row, the difficulty row, settings and New game (targets below the fold are scrolled into
view). End-card buttons are preferred when shown, so play continues across game ends; against the computer, 20 actions with no computer move count as stuck, and the script presses Escape and takes the end card's button. Small per-game hints live in
the `PLAY` map at the top of `tools/perf.cjs` (keys, click share, tap sequences such as Five's own tile then a
target); a game without an entry plays generically. The games page (`root`) has no game: its play opens the Games and
Trophies sheets from the top bar and closes them with Esc, since its cards and Today chips are links. Against the computer, the script waits while the hint line says
"thinking", like a player would, so each reply is timed from the move that caused it.

**The computer's move.** Every `Numberics*` global's functions named `cpu*`, `computer*` or `ai*` (for example
`NumbericsFour.computerTurn`, `NumbericsFive.aiPlan`, `NumbericsFifteen.cpuTurn`, `NumbericsNine.cpuTurn`) are
wrapped after load. Games call them through the engine object, so every computer move is seen. A new game against
the computer gets measured by naming its engine export that way and setting `"vs": true` in `games.json`.

## Budgets
`tools/perf-budgets.json` has `defaults` and per-game overrides in `games.<id>`. Each entry is
`{ "max": n }` for both views, or `{ "phone": n, "desktop": n }`, with a `"why"`. A game override replaces the
default for that metric only. A new game gets the defaults with no edit.

**Updating a budget.** A budget moves only with a reason: a deliberate feature that costs weight or time (say so in
the `why`, with the measured value), or a measurement fix. Run the full gate (3 runs) on a quiet machine first, set
the budget with headroom over the measured median (roughly 1.5x for timings, 25 to 30 percent for weight), and never
raise a budget to make an unexplained regression pass: find the regression. Lower budgets when a game gets lighter
or faster, so the headroom keeps catching regressions.

**Page weight.** Every page loads every shared module, so a byte in `shared/` costs every page. Long explanatory
comments of the shared modules (and of the heaviest game clients) live in `docs/CODE-NOTES.md`, word for word; the
files keep their SPDX header, a short summary with a pointer, and the short comments beside the code (21 Nov: this
took 15 KB off every page and brought Four, Five and Seven back under 250 KB with no change to any view).
