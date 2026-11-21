<!-- SPDX-License-Identifier: Apache-2.0 -->
<!-- Copyright 2026 alvations (Melon Lab) -->

# Review round 4: the harsh but impartial critic

Scope: the redesign (O-6, O-7, O-8): Two (renamed from Endless), the new look, keyed motion in every game, the shared
settings sheet with Memory (Save, Load, Erase), sound, background music, trophies (secrets included), progress and the
Today card, and the perf gate. All ten live games in `games.json`, `shared/`, `tests/`, `tools/` and the design docs,
checked against my round-3 review (`REVIEW3.md`, 8/10, ship after listed fixes) and `TRIAGE3.md`.

What I ran (21 Nov 2026, branch `build/v2` at `a21637c`, working tree clean):
- `npm test`: 18 files, 818 checks, all green (round 3: 11 files, 495).
- `NODE_PATH=$(npm root -g) npm run test:browser`: 140 + 1,752 checks, all green (round 3: 68 + 740).
- `PERF_RUNS=1 PERF_PLAY_MS=8000 node tools/perf.cjs` (a quick look, not a gate run): 19 of 20 rows pass; Fifteen
  phone failed `cpuMovesMin` (2 computer moves seen, 3 needed), which I put down to my shortened play window (nit P4).
- Playwright against `python3 -m http.server 8094`, with my own scripts kept out of the repo: Memory Erase and Load on
  the Sudoku and Two pages; a sound spy on Two and Fibonacci at key gaps of 35, 60, 100 and 140 ms; a visit to all ten
  pages with no input (does anything earn a trophy?); and a 400-action random input fuzz (keys, taps, tray and card
  buttons) on every game at 390x844.
- `git log`: 118 commits, every one authored and committed by the owner; no trailers.

## Situating this pass

Round 3 had no blocker. Its three should-fixes are done and done properly: R2 now works by tile (`state.marks`), with a
counterfactual property test, which is the method I asked for. Every stock that fills up says "Power-ups full",
Three's included (`three/game.js:245`). The six stale DESIGN.md lines I listed are gone. That is the best follow-through
the panel has had.

This round is also a much bigger change than any before it: shared/ grew from three small modules to eleven (2,600
lines, music alone 746) and every client was rewritten for motion. The craft is high. The keyed tile layer (`shared/motion.js`) is a clean, small, honest copy of
the original 2048's model. The audio and music code obeys the gesture rules, shares one context and pauses when the
tab is hidden. The trophy registry is pure and tested in Node. The 400-action fuzz gave no page error in any game, left
no orphan tile node, and caused no sideways scroll. Rapid input never desynchronised the DOM from the state (tile nodes
equal filled cells after every burst I tried).

Three things pull the score down:

1. **A data-loss blocker in the new Memory feature.** On the Sudoku page, Load throws away the loaded Sudoku save, and
   Erase does not erase Sudoku. The cause is one interaction between two correct-looking pieces, and the test runs on
   another page.
2. **The perf gate passes because its budgets sit far above the spec's.** The spec's binding page weight is 110 to
   140 KB; the gate allows 250 to 300 KB. Pages weigh 189 to 243 KB, plus 48 KB of music that the gate leaves out of the
   weight on purpose. "Every cycle passes perf" (O-6) is true only of the relaxed gate.
3. **Sound under fast play is wrong in two opposite ways.** Two goes silent on joins; Fibonacci plays every join late.
   One spec line produced both behaviours.

Blockers: **1**. Should-fix: 7. Nits: 14.

---

## Round-3 follow-up

| Round-3 finding | Status | Evidence |
|---|---|---|
| S1 R2 one move deep, dummy move launders it | **Fixed** | `engine.js:15-17,61-65` marks; TRIAGE3 counterfactual property test; copy "Swapped and boosted tiles earn no reward" (`game.js:236`) is now true |
| S2 "Power-ups full" silent in Endless and Three | **Fixed** | `game.js:237` (`r.full`), `three/game.js:244-245` (`f.full`) |
| S3 DESIGN.md per-game sections stale | **Fixed** | none of the six quoted lines remain |
| Four rings miss most ambushes | TRIAGE3 retune | not re-measured this round (the mechanics reviewer should) |
| Sudoku junk fill front-loads | Won't-fix (TRIAGE3) | accepted |
| Nine Hard runs do not end | Open | no cap and no DESIGN.md line; still a nit |
| Shared 1: toast on the warning channel | **Fixed** | `shared/kit.js:83-93` clears a toast when the hint changes |
| Shared 2: ten R17 guards, no shared one | **Not done** | still ten guards in ten shapes (`game.js:340-345` etc.) |
| Shared 3: `nav.js` dead `\|\| "./"` | Now live | `shared/nav.js:29` serves the root page's empty path; withdrawn |
| SPDX lines on docs | Open, now a panel question | `CYCLE1-NOTES.md` item 1 |

---

## Family findings

### B1 [blocker]: Load and Erase on the Sudoku page are undone by Sudoku's own pagehide save

`sudoku/game.js:510-512` saves the puzzle (and calls `putProgress()`, which writes `numberics_progress_v1`) on
`visibilitychange` and `pagehide`. `shared/settings.js:177-192` writes the loaded keys (or wipes them) and then calls
`location.reload()`, and the reload fires `pagehide` first. So the Sudoku page writes its in-memory state back over
what Memory just did.

- **Load repro:** on `sudoku/`, build a save file whose `numberics_sudoku_v1` holds best times
  `{easy:123, medium:456, hard:789}` and call `NumbericsSettings.memory.loadText(file)` (the Load button runs the same
  path). After the reload, `numberics_sudoku_v1.best` is `{}` and the marker field I put in the file is gone. A player
  moving to a new phone who loads the file while the Sudoku page is open loses their Sudoku bests and puzzle, and is
  told nothing.
- **Erase repro:** on `sudoku/` (and only there), Settings, Erase, "Sure? Erase everything". Before:
  `numberics_sudoku_v1`, `numberics_progress_v1`. After the reload, both are still there. The same steps on the root
  page leave only a fresh progress key (the first-visit how-to mark), which is correct.
- **Why the tests missed it:** the Memory test (`tests/emu/shared-settings.cjs:195`) seeds a Sudoku key but runs on
  `fibonacci/`, where no pagehide handler exists.
- **Fix:** a module flag that Memory sets before it reloads (for example `NumbericsSettings.reloading`), which every
  pagehide or visibility save checks; or Memory saves its keys again from a `pagehide` listener it adds last. Then test
  Load and Erase on every game page, not on one. It is a blocker because the feature's whole purpose is moving data,
  and here it silently drops data. The fix is small.

### S1 [should-fix]: the perf gate's budgets are not the spec's budgets

`docs/design/REDESIGN.md:849-861` (section 10, "enforced by the perf tests") and `tools/perf-budgets.json` disagree on
almost every line:

| Budget | Spec (section 10) | Gate | Measured (my quick run) |
|---|---|---|---|
| Page weight | root 110 KB, Six 140, others 120 | 250, Six 300 | 189 to 213 KB, Six 243 |
| Requests | 14 | 24 | 15 to 17 |
| FCP desktop | 300 ms | 500 | 60 to 112 |
| Long tasks in play | none (50 ms+) | 200 phone, 100 desktop | 54 to 59 ms phone in Fibonacci, Two, Seven, Nine |
| Dropped frames | 5% | 10% phone | up to 5.9% (Four phone) |
| Computer move, 4x | p95 200 ms | 250 | 90 ms (Four) |

The budgets' own `why` lines are honest about what they measured, and `tools/PERF.md` sets a good rule ("never raise a
budget to make an unexplained regression pass"). But that rule was applied to the gate's own first numbers, not to the
spec. Each page is now about 3.5 times its pre-redesign weight (50 to 100 KB, spec section 10 baseline) and about 1.7
times the spec's limit. On top of that, `tools/perf.cjs:214-217` takes `shared/music.js` (48 KB, which every player
gets after the first tap, since Music is on by default) out of `weightKB` and gives it its own 60 KB budget, "so a tap
during play cannot push a game over its page budget". That keeps the page budget from seeing the music at all. With the
music, Six transfers about 290 KB against a spec of 140.

None of this makes the game slow (FCP and frames are fine), so it is not a blocker. But O-6 says every cycle passes
perf, and the gate passes against numbers nobody chose. Either amend section 10 to the measured reality with a reason
(the owner's call: weight is a visible cost on slow phones), or cut weight (no build step, but the ten clients carry a
lot of duplicated chrome; see S5). Count music in the page weight.

### S2 [should-fix]: under fast play, Two drops its join sounds and Fibonacci plays them late

`REDESIGN.md` 7.3 says a `finish()` "drops pending sounds instead of bunching them", and 5.3 puts the merge sound at the
end of the 110 ms slide. The two clients read that the opposite ways:

- **Two** (`game.js:213`, `flush()` calls `snd.cancel()`; the merge is scheduled at `game.js:247`): any input sooner
  than about 110 ms after the last one cancels the join sound. Spy on `NumbericsAudio`, 60 arrow keys: at a 60 ms gap,
  57 slides and **1** merge sound; at 100 ms, 58 and 2; at 140 ms, 57 and 34. A keyboard player at eight keys a second
  hears only the slide noise, and never the rising pentatonic that is the main reward sound.
- **Fibonacci** (`fibonacci/game.js:112`, `settle()` calls `fx.finish()`, which runs every pending step, sounds
  included; the merge is at `:280`): the same 60 keys at 60 ms gave 59 slides and 45 merges, and **42 of the 45 fired
  within 3 ms of the next key's slide**. Each join sounds one move late, on top of the next move's noise. The file header
  (`fibonacci/game.js:8`) claims "finishing it drops nothing and bunches nothing".

The family now has three conventions for the same moment. Two and Four drop (`four/game.js:113` `sounds.cancel()`).
Fibonacci and Fifteen run the pending steps at once (`fifteen/game.js:54` `tl.finish()`, so a round's win or lose
sound plays early on the next tap). Seven, Five, Three, Nine and Six put a hush flag around `finish()`
(`seven/game.js:17` `skipping`, `five/game.js:60` `hush`, `three/game.js:49` `quiet`, `nine/game.js:133` `quiet`,
`six/game.js:95` `hushing`): five copies of the same idea under four names. Suggested rule: play the merge in the input handler when the previous move's
slide is still running (the slide is short, and the join is already decided). Or, simpler, always play the merge at
input time with a 0 to 110 ms delay capped by the next input. Then put the rule in `shared/motion.js` once, not in each
client.

### S3 [should-fix]: a Daily can be "finished" without playing it, and that feeds the streak

`shared/trophies.js:107` counts a Daily as finished on any `end` with `daily:true`. In the Six Daily, "Show answer"
(two taps) gives up a line and moves on (`six/engine.js:603-609`, "in the Daily it moves on"), so tapping it on every
line ends the Daily with 0 made. `six/game.js:340-343` then reports `end` with `daily:true`. That earns "Daily six" ("Finish
the Daily Six."), "Same for everyone", a day in `fam.dailyDays` and a step of the streak toward "A week of dailies".
The Today card shows "Done · 0 made". Seven is fine: its Daily ends only on an overflow, which needs drops, so it is
played. The streak is the redesign's main replay hook (8.5), so it should mean what it says: a Six Daily counts only
with at least one line made without Show answer, or at least not with every line given up. Add a test.

### S4 [should-fix]: Music is on by default, and no owner line records that choice

`shared/settings.js:12-13` and `shared/music.js` `DEF` set `music:true`. My probe: one arrow key on a fresh root page,
and 1.5 s later the Chill style is playing (`NumbericsMusic.state().playing === true`). `MUSIC.md` decides it, but the
O-6 decision list in `docs/OWNER-REQUESTS.md:19` names only "sound and vibration on by default". Background music that
starts on the first tap is the most noticeable thing the redesign does to a casual player (O-6: all ages), and the repo memory
file says every visible change traces to an owner line. Add it to the decision list for the owner to confirm or reverse.
(The behaviour itself is well built: no context before a gesture, one shared context, a pause when hidden, a duck under
end cards.)

### S5 [should-fix]: the same client chrome is written ten times, in ten shapes

The redesign added the same surface to every client, and each client wrote its own copy:

- **How to play**: ten `howto()` functions (`game.js:396`, `fibonacci/game.js:428`, `four/game.js:508`,
  `five/game.js:485`, `six/game.js:545`, `seven/game.js:586`, `nine/game.js:566`, `fifteen/game.js:456`,
  `sudoku/game.js:478`, and Three's at `three/game.js:453`). Each has its own first-visit test (`!saved`, `fresh`,
  `seen`, `hadSave`), and they have already drifted: four of the ten sheets have a Play button (Three, Five, Nine,
  Fifteen) and six do not. `CYCLE1-NOTES.md` item 8 names the debt; I am raising it to a should-fix because the
  inconsistency is visible.
- **Optional-module wrappers**: an audio wrapper named `A` (Two), `sfx` (Fibonacci, Four, Five, Seven, Nine, Sudoku)
  or `snd` (Six, Three, Fifteen); a trophy wrapper named `trophy` or `report`; and ten `duck()` functions
  (`game.js:13-18`, `fibonacci/game.js:62-71`, ...). Some check that the module and the function exist, and
  some rely on a bare try/catch (`fifteen/game.js:55`).
- **The R13 end-card hold** (`HOLD = 1500`, `holding`, `viewing`, `holdT`), the two-step New game (Two has its own at
  `game.js:377-383` instead of `K.twoStep`), and the R17 key guard.

One `NumbericsKit.game(id)` helper (sound, buzz, report, duck, how-to sheet with an optional Play, first-visit rule,
end-card hold) would remove several hundred lines and stop the drift.

### S6 [should-fix]: three browser checks cannot fail on the machines where they matter

- `tests/emu/four.cjs:558`: "frame p95 <= 16.7 ms" passes when `p95 <= max(17.5, idle95 * 1.3)`. My run measured idle
  at 17.9 ms, so the bar was 23.3 ms. On a loaded or slow machine the bar rises with the load, so a real regression
  passes whenever the machine is busy. `tests/emu/three.cjs:495` does the same (`idleP95 + 0.5`).
  `CYCLE1-NOTES.md` item 9 left these to the perf reviewer; the quiet-machine numbers are in this run (four 18.2 ms,
  three 16.8 ms), so put fixed bars back (for example 20 ms) and mark the checks as needing a quiet machine.
- `tests/emu/three.cjs:344`: "the pop ... then settles" accepts a final width within `4 + cellW` of `cellW - 8`, which
  is any width from 0 to twice a cell. The settle half of the check is vacuous. Use a few pixels.
- `tests/emu/fifteen.cjs:204`: `ck("Undo (round ended early, skipped)", true)` counts a skipped check as a pass.
  Seed the round so it cannot end early, or print SKIP and do not count it.

### S7 [should-fix]: the memory file and the spec now say false things

- The repo memory file, line 94 (Known gaps): "Sound, share card, achievements/collection and save-file export ... are not built."
  Sound, trophies and save-file export are built. The repo calls this file its highest-leverage artifact; the next
  agent will believe it.
- `REDESIGN.md` 7.3's peak-gain column (tick .05, merge .08, ...) is stale: `shared/audio.js:70-107` uses the lifted
  gains (tick 0.21, merge 0.36) that `MUSIC.md` decided, and `MUSIC.md` says "change only the Peak gain column of 7.3",
  but nobody changed it. 7.2 says the ladder cap k = 14 is "about 1568 Hz"; it is 1760 Hz (`audio.js:19` has it
  right). Section 10 is S1.

---

## Nits (family)

1. **[nit]** `shared/trophies.js:238-253`: every event reads and writes the whole trophy store, and Two, Fibonacci and
   Three report on every move. With the game save and `NumbericsProgress.put` (`shared/progress.js:84`, also a full
   read and write), each move does three JSON stringifies and three `localStorage` writes inside the input handler.
   It is within budget today; batch the trophy store write to idle time.
2. **[nit]** `shared/theme.css:272-277` and `style.css:282-286`: the `@media (prefers-reduced-motion)` block is labelled
   "until settings.js drives html[data-motion] (B1)"; B1 shipped, and the `:root[data-motion]` rules at
   `theme.css:311-312` override it. Dead CSS that suggests the OS still decides.
3. **[nit]** `shared/nav.js:115-124`: the text-row `row()` is dead (every page uses the cards since I-3).
4. **[nit]** `shared/nav.js:13-24` (LIVE), `shared/trophies.js:17` (GAMES) and `games.json` are three copies of the
   order. A test checks `nav.js` against `games.json` (`tests/test-shared.js:21`); I found none for the trophy list.
5. **[nit]** `shared/trophies.js:119` "Hello, numbers: Finish your first game" fires on Six's first solved line and on
   the first round of Five, Nine or Fifteen, won or lost. Word it "Finish your first game or round", or fire it on
   whole games only.
6. **[nit]** `nine/style.css:12` sets `transition: opacity var(--anim)`, and `--anim` is 0 under reduced motion, so Nine
   drops an opacity fade that 5.12 says to keep ("opacity is not motion").
7. **[nit]** Memory Load (`shared/settings.js:154`) replaces only the keys the file holds, so loading an older save
   keeps trophies and games that are not in it. That is what 6.3 says, but the Settings line ("move them to another
   one") suggests a full replace. Say "adds and replaces" or replace all.
8. **[nit]** `shared/audio.js:204`: a sound requested before the context reports `running` is dropped. In Chromium the
   first-gesture context is running at once, so it is fine there; on iOS the first tap's sound may be lost. Accepted if
   measured on a device.

## New findings per game

### Fibonacci
1. **[should-fix]** S2: every join sounds one move late under quick play; the header comment says the opposite.
Verdict: **8/10** (round 3: 8). Motion, the end card, trophies and the R2 marks are right. The timeline design is the
outlier in the family.

### Two
1. **[should-fix]** S2: no join sounds under quick play.
2. **[nit]** `game.js:37-40`: the run record is not restored by Undo (8.2 says it is). That is the safe direction (Undo
   counts as a power-up used, so "No help needed" stays honest), so change the spec, not the code.
Verdict: **8/10** (round 3: 8, as Endless). The rename kept the save key (`game.js:21`), and the replay fixture still
pins the rules. Motion is exactly the original 2048's model: tile nodes equal filled cells after every rapid burst, and
there is no rebuild per move. Weight is 189 KB against a spec of 110 (S1).

### Three
1. **[nit]** S6: the vacuous settle tolerance (`tests/emu/three.cjs:344`) and the relative frame bar (`:495`).
2. **[nit]** Its how-to sheet has a Play button; Two's, Fibonacci's and six others do not (S5).
Verdict: **8.5/10** (round 3: 8.5). R15 is fixed, the run record is the engine's own state (so Undo restores it), and
the entering tile and the flush beats are tested frame by frame.

### Four
1. **[nit]** S6: the 30-drop frame check passes on a relative bar (`tests/emu/four.cjs:558`).
2. **[nit]** The quick perf run shows 5.9% dropped frames on the phone (spec 5%, gate 10%), the highest in the family.
Verdict: **8/10** (round 3: 8). The computer's timer is guarded by moves and seed (`four/game.js:325-331`), and the
gravity motion matches 5.5.

### Five
No new finding beyond S5. Verdict: **8.5/10** (round 3: 8.5). The music-duck test race (I-11) was fixed in the test,
not by loosening it.

### Six
1. **[should-fix]** S3: the Daily can be finished by giving up every line, and it counts for the streak.
2. **[nit]** Weight 243 KB (spec 140) with music excluded; the heaviest page.
Verdict: **8/10** (round 3: 8.5). Down half a point for S3: the redesign's one replay hook can be had for free here.

### Seven
No new finding. The overflow with Undo (TRIAGE3) has its two buttons, and the cascade plays on a guarded timeline with
a hush flag. Verdict: **8/10** (round 3: 8).

### Nine
1. **[nit]** The round-3 nit (Hard runs effectively never end) is still open, with no DESIGN.md line.
2. **[nit]** Nit 6 (opacity fade removed under reduced motion).
Verdict: **8/10** (round 3: 8).

### Fifteen
1. **[nit]** S6: a skipped Undo check is counted as a pass (`tests/emu/fifteen.cjs:204`).
2. **[nit]** P4: with a shorter play window the perf gate saw 2 computer moves on the phone and failed
   `cpuMovesMin`. Fine at the gate's 20 s, but the guard is close to its floor for this game.
3. **[nit]** I-13 was a real bug that the redesign brought in (the `<svg>` `hidden` property); it was found and tested in
   integration, which is how it should go.
Verdict: **8.5/10** (round 3: 8.5).

### Sudoku
1. **[blocker]** B1: Memory Load is overwritten and Erase is undone on this page.
Verdict: **7/10** (round 3: 8.5). The game itself is unchanged and solid. The score falls because the one page that
saves on hide breaks the shared feature the redesign added.

### Shared, perf and docs
- `shared/motion.js` **9/10**: small and pure where it can be, with every timer generation-guarded and transform and
  opacity only. `track()` is tested in Node. The best module in the repo.
- `shared/audio.js` and `shared/music.js` **8.5/10**: the gesture rules are right, there is one context and pauses
  are correct (I read every lifecycle path), and the reverb build is sliced to keep the first tap short. S2 and S4 are
  about how they are used, not how they are built.
- `shared/trophies.js` and `progress.js` **8/10**: a pure registry, secrets absent from the DOM until earned, the
  streak rule in one place and tested with mocked dates, and nothing earned by visiting pages (my probe: ten pages, no
  input, no trophy store written). S3 and nit 5 are rule gaps, not code bugs.
- `shared/settings.js` **6.5/10**: clean normalisation and live apply, but B1.
- Perf gate **6/10**: a well-built harness (medians, computer-move wrapping, a guard against measuring nothing) whose
  budgets are not the spec's (S1).

---

## Verdicts

| Game | R1 | R2 | R3 | R4 | Why it moved |
|---|---|---|---|---|---|
| Fibonacci | 8.5 | 8 | 8 | 8 | keyed motion right; joins sound one move late (S2) |
| Two | 8 | 7.5 | 8 | 8 | rename clean, motion exact; silent joins under quick play (S2) |
| Three | 6 | 8.5 | 8.5 | 8.5 | R15 fixed; two soft tests |
| Four | 7 | 7 | 8 | 8 | gravity motion and guards right; soft frame check |
| Five | 7.5 | 8 | 8.5 | 8.5 | no new defect |
| Six | 6.5 | 8 | 8.5 | 8 | Daily finished by giving up feeds the streak (S3) |
| Seven | 7.5 | 7.5 | 8 | 8 | no new defect |
| Nine | 8 | 7 | 8 | 8 | no new defect; Hard runs still endless |
| Fifteen | 6.5 | 8.5 | 8.5 | 8.5 | I-13 found and tested; one counted skip |
| Sudoku | 6 | 8 | 8.5 | 7 | Memory Load/Erase undone by its pagehide save (B1) |
| **Overall** | **7** | **7.5** | **8** | **7.5** | |

Overall 7.5, half a point under round 3. Most of the redesign is better engineered than anything before it. Motion,
audio and trophies are each one module with real tests, and the input layer survived my fuzz in every game. The half
point is lost on three things. A new shared feature loses data on one page, and its only test runs on another. The
perf gate certifies budgets twice the spec's. And the shared layer stops at the module boundary: every client
re-implemented how-to, sound wrappers, the hold and the hush in its own way, and that has already produced two
opposite sound behaviours and two kinds of how-to sheet.

**Release verdict: ship after listed fixes.** Before the merge to `main`: B1 (with Load and Erase tested on every game
page), S2 (one sound rule, in `shared/motion.js`), S3 (a Daily needs real play) and S7 (the memory file and 7.3). S1 and
S4 go to the owner as decisions (weight and default music), recorded in `OWNER-REQUESTS.md` either way; the gate's
budgets then follow the decision. S5 and S6 can follow in the next cycle, but S6's skipped-as-pass check is a
one-line fix and should go in now.
