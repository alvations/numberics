<!-- SPDX-License-Identifier: Apache-2.0 -->
<!-- Copyright 2026 alvations (Melon Lab) -->

# Review round 5: the harsh but impartial critic

Scope: every TRIAGE4 item and round-4 per-game fix (commits `3cc68a9`, `6f3b65a`, `ca1f640`), O-9 (the root is the games
page, Two moves to `two/`) and O-10 (sound verified, the `wake()` change in `shared/audio.js`, "Music style"), all in
`9434c7d`. All ten live games, the new games page, `shared/`, `tests/`, `tools/` and `.github/workflows/pages.yml`,
checked against my round-4 review (`REVIEW4.md`, 7.5/10, one blocker) and `TRIAGE4.md`.

What I ran (21 Nov 2026, branch `build/v2` at `9434c7d`, working tree clean):
- `npm test`: 20 files, 873 checks, all green (round 4: 18 files, 818).
- `NODE_PATH=$(npm root -g) npm run test:browser`: 148 + 2,482 checks, all green, no SKIP line printed (round 4:
  140 + 1,752). Four's frame check ran (idle p95 17.7 ms, under its 18 ms quiet-machine bar) and measured 18.6 ms.
- `PERF_RUNS=1 PERF_PLAY_MS=5000 node tools/perf.cjs root two fibonacci` (a quick look, not a gate run): PASS.
  Games page 153.6 KB / 11 requests; Two 220.9 KB / 16; Fibonacci 227.4 KB / 18; phone dropped frames 6.3% and 6.4%.
- My own Playwright probes against `python3 -m http.server 8071` (scripts kept out of the repo):
  1. a sound spy on Two and Fibonacci, 60 arrow keys at 60 ms and 100 ms gaps;
  2. Memory Load (a save file with a marker in every game key, with a batched save still pending) and Erase on all
     eleven pages (the games page and the ten games);
  3. a link crawl: every `a[href]` on every page and in every Games sheet, fetched;
  4. Larger text + High contrast at 320 and 375 px on all eleven pages (sideways scroll, top-bar button size);
  5. the deploy: `git archive` of `main` and `build/v2`, the workflow's own `assemble()` function extracted from each
     branch's copy of `pages.yml` and run, then the assembled site served under `/numberics/` and `/numberics/beta/`
     through a Playwright route.
- `git log a21637c..HEAD`: 12 commits, every one authored and committed by the owner; no trailers.

## Situating this pass

Round 4 ended "ship after listed fixes" with one blocker (Memory on Sudoku), four should-fixes for before the merge
(S2 sound, S3 Daily, S7 docs, the S6 skip) and two owner decisions (S1 weight, S4 music). Every one of them is closed,
and closed at the root rather than patched per page:

- B1 is fixed in the one place that can fix it for every page (`NumbericsKit.store` with `freeze()`), not by a flag
  each game must remember. My Load and Erase probe on all eleven pages lost nothing.
- The sound rule is one rule in `shared/motion.js` (`sfx`, `together`, `seq().sound`, `hurry`), and the five hush
  flags I listed are gone. My spy shows every join sounding with its own move, at 60 ms and at 100 ms.
- The Six Daily needs all six lines (`six/engine.js:616-618`), with the reason beside it.
- The memory file and the spec sections I quoted say true things now.

O-9 is a clean move inside the repo: `git mv` with zero content change for `two/engine.js`, `two/game.js` and
`two/style.css`, every link I crawled returns 200, the old save key loads at `/two/` (`tests/emu/root.cjs:39-43`), and a
unit test refuses any page that still loads the old root `engine.js` (`tests/test-shared.js:57-67`). O-10's `wake()`
is a real fix for a real bug (a first tap's sound dropped while the browser starts the context asynchronously), with a
measured browser test that taps the real graph with AnalyserNodes. That test is the best sound test the panel has seen.

What pulls the score down is outside the pages: **the deploy workflow**. It exists in two copies (one per branch), the
copy on `main` does not know about O-9, the publish message labels the wrong commit, and a failing beta deletes the live
beta instead of keeping it. None of this shows in any test, because nothing tests the workflow.

Blockers: **0**. Should-fix: 4. Nits: 13.

---

## Round-4 and TRIAGE4 follow-up

| Item | Status | Evidence |
|---|---|---|
| B1 Memory Load/Erase undone by a page's pagehide save | **Fixed** | `shared/kit.js:27-32,59,71` (`freeze()` drops pending writes; `save()` is a no-op while frozen); `shared/settings.js:168-179` freezes before writing. My probe: on all eleven pages, with a save still pending, every loaded key held my marker after the reload (the only "changed" keys were `numberics_progress_v1` rewritten by the *new* page from my deliberately malformed marker, and `numberics_trophies_v1`, which my file did not hold). Erase on `sudoku/` leaves a key, but it is a fresh puzzle (seed 1562164069 before, 1696268663 after), written by the reloaded page: correct. |
| B2 merge blip | Fixed (tests) | `tests/emu/shared-merge.cjs` frame-by-frame; I did not re-measure |
| B3 Larger text at 320 px | **Fixed** | my probe: 320 and 375 px, Larger text + High contrast, eleven pages: no sideways scroll, every top-bar button at least 44 px tall |
| S1 perf budgets vs spec | Owner decision recorded | `tools/perf-budgets.json` `weightKB.why`, `OWNER-REQUESTS.md:25-28`. See nit 1: weight grew 15% this round |
| S2 sound under fast play | **Fixed** | `shared/motion.js:62-114`. My spy, 60 keys: Two at 60 ms 60 slides / 42 merges, Fibonacci 60 / 43, and every merge within 3 ms of its own move's slide; the same at 100 ms. Round 4 was Two 57 / 1 and Fibonacci 42 of 45 a move late |
| S3 Daily finished by giving up | **Fixed** | `six/engine.js:616-618` `dailyDone`, `six/game.js:290-291,351-353` |
| S4 music on by default | Owner decision recorded | `OWNER-REQUESTS.md:25` |
| S5 the same chrome ten times | Partly | D8 done: one `shared/howto.js`, all ten pages call `U.howto(id, {title, steps, saved, ...})` and every page has the same "How to play" summary and "Show the three steps" button. The audio/trophy wrappers, `duck()` and the end-card hold are still per client (not in TRIAGE4; carried as nit 9) |
| S6 soft browser checks | **Fixed**, one new inconsistency | `tests/emu/four.cjs:607-610` fixed 20 ms bar, prints SKIP on a busy machine and does not count it; `tests/emu/three.cjs:355` settle within 2 px; `tests/emu/fifteen.cjs:204-207` the fixture cannot end early and says why. But see S4 below: Three's fixed bar never skips |
| S7 false docs | **Fixed** | CLAUDE.md "Known gaps" is true; REDESIGN 7.2/7.3 updated. New stale lines from O-9 are S3 below |
| D1-D10 | Done | D2 mute button and gear (`shared/ui.js`), D3 goals, D4 streak (`shared/nav.js:93-110`, root.cjs:90), D5 device theme, D7 above, D8 above, D9 Seven lock and day's best (`seven/game.js:48-72`), Sudoku chip level, D10 Six's neutral Show answer |
| Per-game (TRIAGE4) | Done, spot-checked | Four Easy blocks a stack of three (`four/engine.js:451-453`, `verticalThreat`); Five's Undo hole (`state.undone`, `five/engine.js`); Nine `MEDIUM_SLIP`; Fifteen W-L-D and the 400/400 Hard claim in DESIGN.md; Two's board focus ring (`two/style.css:105`); Night owl only on an end (`shared/trophies.js:126-128`); Today label at midnight (`shared/nav.js:95,120`, `shared/progress.js:136`); Load confirm and "not a Numberics save" (`shared/settings.js:201-235`) |
| Round-4 nits 2, 3, 4, 5 | Open | see nits 10-12 |

---

## Should-fix

### S1 [should-fix]: the deploy workflow publishes a broken beta from `main`, labels the wrong commit, and deletes the beta when it fails

`.github/workflows/pages.yml` runs on a push to either branch, and GitHub runs **the copy of the workflow in the branch
that was pushed** (and, for "Run workflow", the copy on the default branch, `main`). So there are two deployers, and
they disagree:

1. **`main`'s copy does not copy `home.css`.** `main:.github/workflows/pages.yml:52` copies
   `index.html engine.js game.js style.css games.json .nojekyll LICENSE NOTICE`; only `build/v2`'s copy (line 53) adds
   `home.css`. Repro: `git archive main` and `git archive build/v2` into two folders, extract `assemble()` from
   `main`'s workflow, run `assemble stable site; assemble beta site/beta`. The only file difference from the same run
   with `build/v2`'s workflow is `beta/home.css`. Serving that site, `/numberics/beta/` requests `home.css` twice and
   gets 404s, and the games page falls back to the 480 px game column (`#app` max-width 480 px instead of 760 px):
   on a desktop the O-9 page is a narrow strip. This happens on any push to `main` (a stable hotfix) or any manual run,
   until `build/v2` is merged. Fix: land the `build/v2` workflow on `main` now (it is layout-agnostic: it copies root
   files only when they exist), or better, have the assemble step copy whatever the branch's own `index.html`
   references, so neither copy needs a list.
2. **The publish message labels the wrong commit.** Line 69:
   `"Publish Numberics: stable from main ${GITHUB_SHA::7}, beta from build/v2"`. `GITHUB_SHA` is the commit that
   triggered the run. On a push to `build/v2` it is a `build/v2` commit, so the message reads "stable from main
   9434c7d", and `9434c7d` is not on `main` at all. The beta never gets a SHA. When the two sites disagree this is the
   one line that says what was published, and it lies on every beta push. Fix:
   `stable from main $(git -C ../stable rev-parse --short HEAD), beta from build/v2 $(git -C ../beta rev-parse --short HEAD)`
   (and "beta not published" when the beta step failed).
3. **A failing beta deletes the live beta.** Lines 41-43 and 63 say "a failing beta never blocks stable; it is just not
   published", but the publish step builds `gh-pages` from scratch (`git init`, `push -f`, lines 66-70). When the beta
   tests fail, the new `gh-pages` has no `beta/` at all, so every beta tester gets a 404 instead of the last good beta.
   That is the opposite of what the step name promises. Fix: when the beta step fails, copy `beta/` from the current
   `gh-pages` (a `fetch-depth: 1` checkout of `gh-pages`) into `_site/beta`, and say so in the message.
4. **No test covers any of this.** A unit test could run the workflow's `assemble()` on the working tree and check that
   every file any published page loads (`src=`, `href=` to a same-origin file) is in the assembled folder. That alone
   would have caught (1). It would also catch the next root file someone adds.

Also: `CLAUDE.md:106-107` still says `gh-pages` is rebuilt "from `main`". It is rebuilt from both branches. And the site
copies `screenshots/` (6.5 MB) into both `/` and `/beta/`, though no page loads a screenshot (they are for the README).
That is harmless, but it adds 13 MB to every publish.

### S2 [should-fix]: the games page fetches 48 KB of music on the tap that leaves it

The games page has no game, and nearly every tap on it is on a card or a Daily chip, which navigates away. But the
first tap still creates the AudioContext and loads `shared/music.js` (48 KB), which starts Chill
(`tests/emu/shared-audible.cjs:275-283` asserts exactly this: "a tap starts the music"). So a player's tap on the Two card
costs a context and a 48 KB fetch, and then a page unload tears both down a few hundred milliseconds later. The browser cache
softens the fetch for the next page, but the context and the 2.5 s fade-in are pure waste. Music on a page that is only a
menu is also a product choice nobody made: O-9 says "just have the games". Either do not start music on the games page
(it has no `#games[data-current]`, so `music.js` can tell), or keep it and record it in OWNER-REQUESTS like the round-4 S4
music default. Note that the perf gate does not see this: the root's play script (`tools/perf.cjs` `PLAY.root`) only
opens sheets and presses Escape.

### S3 [should-fix]: O-9 left stale lines in the spec and the guides

The memory file was updated well. The guides it points to were not:

- `docs/design/REDESIGN.md:12` ("the root URL opens Two"), `:44` ("Two plays on the root with no menu"), `:71` ("Two's
  root page never auto-opens it"), `:169` ("Two (root `style.css`)"), `:223` (the games table: Two's path "(root)"),
  `:791` ("on the root the Two board is itself the continue"), `:803` ("9.1 Two (root)"), and `:875` (the weight row
  "root (Two + list) <= 110 KB"). Only 3.1 and one line of 11 carry the "Superseded by O-9" note.
- `docs/design/MUSIC.md:243` still names the row **Style** (O-10 renamed it "Music style").
- `docs/NEW-GAME.md:42` still tells a new game to use `<nav id="games" class="games">`, the text row that no page uses
  any more (every page has the cards, `docs/reviews/REVIEW4.md` nit 3).
- `two/style.css:154`: "the games row on each game page (the root shows the cards below ...)". `home.css:4`: "the old
  root's .side rules".
- `docs/OWNER-REQUESTS.md:16` (O-7) still says "the root opens Two" with no pointer to O-9, which supersedes it.

A note in each section, or a one-line "superseded by O-9" pointer, is enough. The spec is what the next agent builds
from.

### S4 [should-fix]: the new sound test has two checks that cannot fail the way they are named, and Three's frame check fails where Four's skips

- `tests/emu/shared-audible.cjs:227-228`: "navigate to Fibonacci **by its card**" falls back to `p.goto()` when the card
  is missing, so a page with no Fibonacci card passes the check that names the card. Drop the fallback: a missing card
  should fail.
- `tests/emu/shared-audible.cjs:87-88`: `pathOf` keeps "fall back to the root while the move is in flight" (`id ===
  "two" ? ""`). The move is done. With that branch, a `games.json` that lost Two's path would send every Two check to the
  games page, where several of them (Escape, mute, music) would still pass. Remove it.
- `tests/emu/three.cjs:590-592`: round 4's fix replaced the relative bar with a fixed one, which is right, but the check
  is labelled "needs a quiet machine" and is still counted on a busy machine. `tests/emu/four.cjs:607-610` checks the
  idle p95 and prints SKIP instead. On a loaded CI runner Three fails and Four skips. The same suite should not use two
  rules, and a check that fails because of load teaches people to ignore red. Use Four's pattern in Three.

---

## Nits (family)

1. **[nit]** Page weight grew 15% in one round. Shared modules without music: 197 KB at `a21637c`, 230 KB at `9434c7d`
   (`git ls-tree -l`). Two went from 189 KB (round 4) to 221 KB, and Fibonacci to 227 KB, against the 250 KB budget the
   owner set, so 23 KB of headroom is left. The games page alone weighs 154 KB and plays nothing. The budget held, but
   at this rate it lasts one more round. `shared/theme.css` (+63 lines) and `motion.js` (+104) grew most.
2. **[nit]** Phone dropped frames in my quick run: Two 6.3%, Fibonacci 6.4% (spec 5%, gate 10%).
3. **[nit]** `shared/audio.js:157-162`: voices booked while waking all sit at the frozen `currentTime + 0.005`, so up to
   250 ms of sounds start together when the context starts. And when the start is late, `settle()` runs as a microtask
   *after* the context is running, so the voices it cuts may sound for a few milliseconds first (cut ramps 5 ms). Both
   are inaudible in practice. A comment at `WAKE_MS` saying so would stop the next reader from "fixing" it.
4. **[nit]** The games page shows a **Games** button whose sheet repeats the page underneath it (Today and the same ten
   cards). It is harmless, but on the one page that *is* the games list, the button does nothing new.
5. **[nit]** `tools/perf.cjs:28` keeps a `PLAY.endless` entry; no page has that id since the rename.
6. **[nit]** The games page is id `root` in the perf gate (`tools/perf.cjs:269`) and id `home` in the screenshots
   (`tools/shots.cjs:26`, `screenshots/home-*.png`). Pick one.
7. **[nit]** The games page's heading is `<h1 id="more">Ten number games</h1>` (`index.html:21`). The id is a leftover
   from the game pages' "More number games" section; `#more` on the games page is not "more".
8. **[nit]** Opening `index.html` from disk (CLAUDE.md: "Playable by opening `index.html`") now lands on a page whose
   every link is a folder (`two/`), and on `file://` that opens a directory listing, not the game. That was already true
   of nine games; O-9 makes it true of the first click too. Say "serve it (`npm start`)" in CLAUDE.md and the README.
9. **[nit]** Round-4 S5 remainder: the audio wrapper is still `sfx`, `snd` or `A` depending on the game, and each client
   has its own `duck()` and end-card hold.
10. **[nit]** Round-4 nit 2 open: `shared/theme.css:272` and `two/style.css:267` still say "the OS query until settings.js
    drives html[data-motion] (B1)".
11. **[nit]** Round-4 nit 3 open: `shared/nav.js:137` `row()` (the text row) is dead code.
12. **[nit]** Round-4 nits 4 and 5 open: `shared/trophies.js:19` is a third copy of the games order with no test against
    `games.json`, and "Hello, numbers: Finish your first game." (`shared/trophies.js:121`) fires on a round or a solved
    line.
13. **[nit]** DESIGN.md "QA round 4" lists Five, Nine, Fifteen and Seven, but not the Four, Two, Three, Six, Fibonacci and
    Sudoku fixes from `ca1f640` (Four's Easy vertical block is a rules change and belongs there with its reason).

## Per game

### Fibonacci
No new finding. S2 fixed: joins sound with their own move. It still loads `../two/engine.js`
(`fibonacci/index.html:72`, `fibonacci/engine.js:20`), and the deploy copies `two/` explicitly
(`pages.yml:57`), so this works. A test that Fibonacci loads on the assembled site would pin it (S1.4).
Verdict: **8.5/10** (round 4: 8).

### Two
1. **[nit]** O-9 moved the files with no content change, and the old key loads at `/two/` (root.cjs:39-43, and my crawl).
   Stable players keep their save when `main` takes the move, because `localStorage` is per origin, not per path. That
   is worth a line in OWNER-REQUESTS O-9, since "will my game survive" is the first question a returning player asks.
Verdict: **8.5/10** (round 4: 8). The joins sound again under quick play, and the page is now a game page like the others.

### Three
1. **[should-fix]** S4: the fixed frame bar fails on a busy machine instead of skipping.
Verdict: **8.5/10** (round 4: 8.5).

### Four
No new finding. Easy now blocks a stack of three (`four/engine.js:451-453`), and only that, so Easy stays loose
elsewhere, which is the right size of fix. The frame check is a fixed bar with an honest SKIP.
Verdict: **8.5/10** (round 4: 8).

### Five
No new finding. The Undo hole is closed with `state.undone`, and the restored snapshot carries the flag.
Verdict: **8.5/10** (round 4: 8.5).

### Six
No new finding. A Daily given up line by line now ends "daily-open" and earns nothing.
Verdict: **8.5/10** (round 4: 8).

### Seven
No new finding. The Daily locks after one run and the chip keeps the day's best (root.cjs:99-100).
Verdict: **8/10** (round 4: 8).

### Nine
1. **[nit]** Undo is still not on the no-pay list (DESIGN.md "Open for round 5"). Five closed the same hole this round, so
   the two games now treat Undo differently.
Verdict: **8/10** (round 4: 8).

### Fifteen
No new finding. The skipped-as-pass check is gone, and the 400-of-400 Hard claim is in DESIGN.md with its condition.
Verdict: **8.5/10** (round 4: 8.5).

### Sudoku
No new finding. B1 is fixed at the store, so the page that once lost data needed no change of its own.
Verdict: **8.5/10** (round 4: 7).

### The games page (new, O-9)
Exactly what the ask says, and nothing else: top bar, Today, heading, cards, foot line, nothing marked Playing
(root.cjs:67-92, my crawl). It passes 320 px Larger text. S2 (music on a menu page) and nits 4, 6 and 7 apply.
Verdict: **8/10**.

### Shared, deploy and docs
- `shared/kit.js` store **9/10**: batching, the `BASE` check (a queued save never overwrites a newer value it did not
  see) and `freeze()` form one small, correct design that fixed B1 and D6 together.
- `shared/audio.js` **8.5/10**: `wake()` is a real fix with Node and browser tests; nit 3.
- `shared/settings.js` **8.5/10** (round 4: 6.5).
- `tests/emu/shared-audible.cjs` **8.5/10**: it measures signal at the speakers and emulates the autoplay policy that
  headless Chromium does not enforce. Two of its fallbacks are soft (S4).
- Deploy workflow **5/10**: S1.

---

## Verdicts

| Game | R1 | R2 | R3 | R4 | R5 | Why it moved |
|---|---|---|---|---|---|---|
| Fibonacci | 8.5 | 8 | 8 | 8 | 8.5 | joins sound on time (S2 fixed) |
| Two | 8 | 7.5 | 8 | 8 | 8.5 | clean move to two/, saves load, joins audible |
| Three | 6 | 8.5 | 8.5 | 8.5 | 8.5 | soft checks fixed; the frame check fails under load (S4) |
| Four | 7 | 7 | 8 | 8 | 8.5 | Easy blocks the vertical four; honest frame check |
| Five | 7.5 | 8 | 8.5 | 8.5 | 8.5 | Undo hole closed |
| Six | 6.5 | 8 | 8.5 | 8 | 8.5 | Daily needs real play |
| Seven | 7.5 | 7.5 | 8 | 8 | 8 | Daily lock; no new defect |
| Nine | 8 | 7 | 8 | 8 | 8 | Undo still pays, unlike Five |
| Fifteen | 6.5 | 8.5 | 8.5 | 8.5 | 8.5 | skipped-as-pass gone |
| Sudoku | 6 | 8 | 8.5 | 7 | 8.5 | B1 fixed at the store |
| **Overall** | **7** | **7.5** | **8** | **7.5** | **8** | |

Overall 8, half a point up on round 4. Every round-4 finding that went to triage is closed, and closed in the shared layer.
The pages, the tests (873 + 2,630 checks, all green) and my own probes (Memory on eleven pages, sound under fast play,
a link crawl, Larger text at 320 px) found no defect in the games. The O-9 move is clean in the repo. The half point
that keeps it from 8.5 is the deploy. The workflow is the one piece of the release that no test runs. Its `main` copy would
publish the O-9 beta without its stylesheet. Its message names a commit that is not on `main`. And a failing beta
removes the beta instead of keeping the last good one. Each fix is small.

**Release verdict: ship the beta; fix S1 before the next push to either branch** (S1.1 before any push to `main`), then
S3 and S4 with it. S2 is an owner question (music on the games page): ask it, record the answer either way. The nits can
follow in the next cycle.
