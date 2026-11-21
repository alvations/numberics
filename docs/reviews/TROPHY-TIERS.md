<!-- SPDX-License-Identifier: Apache-2.0 -->
<!-- Copyright 2026 alvations (Melon Lab) -->

# Trophies for the Easy / Medium / Hard tiers in Two, Three and Fibonacci (O-13)

Decision paper only. No code, test or other doc is changed by it. The implementer works from section 4.

## 1. The question

The owner (O-13, `docs/OWNER-REQUESTS.md:26`): "... then see if we can add something to the trophy if needed, check
against the panel and melon-eight replayability principles for the trophy addition for the difficulty level for 'Two',
'Three' and 'Fibonacci'."

So we have three questions. Do the new tiers cheapen any existing `two_*`, `fib_*` or `thr_*` trophy? Should any of
them need a tier? Should we add a tier trophy, and if so which one? The audience is casual players of all ages, so every
answer is weighed against Maya (9), Sam (34), Priya (52) and Walter (71) as well as against the strong player.

Today the registry (`shared/trophies.js:122-218`) holds 84 trophies: 7 family and 77 game trophies. Every game has 7 to
9, with exactly 2 secret each (spec `docs/design/REDESIGN.md:783`, guard `tests/test-trophies.js:100-107`). Two has 9,
Fibonacci 8 and Three 7. The sheet's "N of M" counts every non-secret trophy plus the earned secrets, so a new player
sees "0 of 62".

### 1.1 What the tiers change, measured

Every reward in the three tile games is a power-up, and power-ups only help a run you use them in. More power-ups mean
longer runs and bigger tiles. I counted how often each trophy's boundary is reached on each tier. The count uses the
repo's own bots: the `play()` functions of `tools/sim-two.js` and `tools/sim-fibonacci.js` (200 seeds, cap 5000 moves)
and of `tools/sim-three.js` (1,000 seeds, the human bot the rules are tuned on). Each seed is played on all three tiers.
The figures are the share of games that reach each boundary.

| Trophy (boundary) | Bot, power-up use | Hard | Medium | Easy |
|---|---|---|---|---|
| Two 512 (on the way to `two_pure`) | corner (strong), none | 21% | 23% | 19% |
| Two 1024 | corner, sensible | 36% | 65% | 82% |
| `two_2048` "The old finish line" | corner, sensible | 2% | 6% | 27% |
| `two_4096` / `two_8192` | corner, sensible | 0% / 0% | 0% / 0% | 1% / 0% |
| Two 1024 | greedy, sensible | 0% | 1% | 4% |
| Fibonacci 987 (`fib_pure` tile) | corner, none | 6% | 7% | 5% |
| Fibonacci 987 | corner, sensible | 42% | 42% | 50% |
| Fibonacci 1597 | corner, sensible | 11% | 13% | 16% |
| `fib_2584` "The old goal" | corner, sensible | 1% | 1% | 1% |
| `thr_96` "Ninety-six" | human | 27% | 35% | 36% |
| Three 192 / `thr_384` | human | 1% / 0% | 4% / 0% | 3% / 0% |
| `thr_five` "Rainbow run" (5 flushes) | human | 67% | 74% | 75% |
| Three, 10 flushes in one game | human | 38% | 49% | 48% |
| `thr_long` "Unhurried" (300 swipes) | human | 20% | 32% | 32% |

What this shows:

- **Two is the only game where the tiers change the tile trophies a lot.** `two_2048` is 13 times more common for the
  strong bot on Easy than on Hard (27% against 2%). `two_score` (20,000 points) rises with it, since that score comes
  with a 2048-sized run. `two_4096` and `two_8192` stay out of reach on every tier. `two_128` is free everywhere.
- **Fibonacci barely moves.** Easy adds about 8 points at 987 and nothing at 2584. That matches the mechanics review:
  power-ups add only 55 moves to a Fibonacci run (`REVIEW_GAMEPLAY5.md:176-178`).
- **Three moves modestly**: about 7 to 12 points on the flush and length trophies. Medium and Easy are the same here,
  because Three's tiers only add joins, and the human bot rarely makes a top-sized join.
- **Pattern and secret trophies are not tier trophies.** `two_chain`, `two_row`, `fib_chain`, `fib_run`, `thr_double`
  and `thr_mono` are about the board, and a Swap only nudges them. `two_comeback` and the two "long game" secrets get
  slightly more likely on easier tiers, which is fine for a secret.
- **The power-up-free trophies (`two_pure`, `fib_pure`) are tier-neutral.** With no power-ups used, the same bot reaches
  the same tiles at the same rates on every tier (the "none" rows: 21/23/19% and 6/7/5%, within noise).

One correction to the docs: `docs/DESIGN.md:124` says a power-up-free run "plays the same board on every tier". That is
not literally true. The reward draw uses the shared seed, so a run's tiles fork after the first reward one tier pays and
another does not. With fixed swipes and no power-ups, all 50 of 50 seeds diverged between Hard and Easy at moves 40
to 52. The honesty claim still holds in distribution, because an unused power-up changes the odds of nothing. The
sentence should say that instead (implementer, section 4.4).

### 1.2 Should an existing trophy require a tier? No.

- **It would be dishonest in the other direction.** "Make 2048, then keep going." is true on Easy: the player made the
  tile, and every power-up that helped was earned by play (`docs/DESIGN.md:92-96`: no loop pays without play).
- **It would split players.** Trophies already earned stay earned (`shared/trophies.js:233`), so a new gate would hold
  later players to a harder rule than earlier ones for the same name.
- **It works against the audience.** A first visit starts on Medium (`docs/DESIGN.md:123`). Gating 2048 to Hard would
  tell Maya and Walter that the tier they were handed does not count.
- **melon-eight does not gate either.** Hard is a separate, additive set of badges on top of the base ones (quoted in
  section 2.1, M3).

So we keep all 24 existing `two_*`, `fib_*` and `thr_*` trophies exactly as they are. The real cheapening is
`two_2048` on Easy. The answer is to add a Hard version beside it, not to raise the bar on the old one. Four, Five,
Fifteen and Sudoku already do this with their base win and Hard win trophies.

## 2. Running the panel

### 2.1 The melon-eight principles applied (quoted)

- **M1 Hard is open to all, and it earns its own badges.** "**Hard is open to all:** the client offers all three
  difficulties from the start (default **Normal**); no escape is required to unlock Hard. Four badges (`hard_<arc>` ×3,
  `hard_all`) reward hard escapes" (`melon-eight/CLAUDE.md:444-447`).
- **M2 Easy is for younger players, not a lesser trophy class.** "**Easy** leans toward "go on" with fewer changes but
  keeps a floor ... for younger players" (`melon-eight/CLAUDE.md:422-423`).
- **M3 Records are achievements: how a run was won.** "**Records are achievements.** How a run was won is folded into
  `ACHS`" (`melon-eight/CLAUDE.md:202`); "How a run was won is graded and **surfaced as achievements** on the board"
  (`melon-eight/docs/COLLECTION.md:88-89`).
- **M4 Mastery over attendance.** "The collection measures participation, not mastery ... Most badges are attendance
  ... Only "flawless" (a clean run) rewards *playing well*" (`melon-eight/docs/reviews/REVIEW_GAMEPLAY.md:110-113`).
- **M5 Restraint: the meta-game must not outgrow the game.** "This is restrained achievement design, not a Steam
  checklist" (`melon-eight/docs/reviews/REVIEW4.md:41-42`); "The meta-game is now more elaborate than the game"
  (`melon-eight/docs/reviews/REVIEW4.md:114`).
- **M6 Honest, legible descriptions.** "**Descriptions never spoil.** A badge names the feat, not the detail to watch."
  (`melon-eight/docs/COLLECTION.md:172`); "The badges are honest and legible" (`melon-eight/docs/reviews/REVIEW4.md:37`).
- **M7 A secret rewards noticing, not guessing or button-pressing.** "A secret that rewards guessing rather than
  noticing is at odds with a game whose whole skill is noticing" (`melon-eight/docs/reviews/REVIEW_GAMEPLAY.md:97-99`).

Not applied: melon-eight's "Only earned badges show, no count" (`COLLECTION.md:173-175`). Numberics overrode it on
panel evidence (TRIAGE4 D3, `docs/reviews/TRIAGE4.md:26-28`), so each new non-secret trophy shows as a goal and adds 1
to M.

The Numberics side: the owner's founding ask was "Like melon-eight, have similar settings, achievements, replay value
and secret achievements" (`docs/design/REDESIGN.md:8-9`). Every other game with a difficulty already has a Hard trophy:
`four_hard`, `five_hard`, `nine_hard`, `fif_hard` and `sdk_hard`, with `four_pure` and `sdk_pure` for Hard without help.

### 2.2 The candidates

- **A.** One "on Hard" trophy per game (Two, Three, Fibonacci), non-secret.
- **B.** A family trophy for "Hard in all three tile games" (like melon-eight's `hard_all`).
- **C.** A secret trophy for a power-up-free run on Hard.
- **D.** A gentle "try Easy" onboarding trophy.
- **E.** Gate the existing tile trophies to a tier.
- **F.** Add nothing.

### 2.3 Verdicts (a desk read by each brief, using the round-5 evidence; not a fresh round)

**1. Harsh-impartial critic.**
- A is the consistency fix. Five of the seven games with a difficulty have a Hard trophy, and the three tiered tile
  games would be the odd ones out (M1, REDESIGN.md:9). But Two already has 9 trophies, so A breaks the "7 to 9" spec
  (REDESIGN.md:783, `tests/test-trophies.js:105`). Either amend that cap in the same commit, with the reason, or leave
  Two out. Leaving Two out is wrong, because Two is the one game where the data says the tier matters.
- B needs new cross-game state, or a trophy that reads other trophies. That is machinery for a three-way checklist (M5).
  Reject.
- C would make 3 secrets in a game, and the test pins exactly 2 (`tests/test-trophies.js:105`). It also duplicates
  `two_pure` and `fib_pure`, which are already tier-neutral (section 1.1). Reject.
- E: reject, as in section 1.2.
- An event with no `tier` field must never pay a tier trophy (fail closed).
- Verdict: A, with the cap amended to 10.

**2. Mechanics reviewer.**
- A is only worth it where Hard is a different game. In Two it plainly is: 2048 at 2% on Hard against 27% on Easy for a
  strong player. In Three, Hard means flushes are the only reward, so a flush-count trophy on Hard measures the exact
  skill the tier isolates. Ten flushes: 38% on Hard against 49% on Medium for the tuning bot.
- In Fibonacci, Hard and Medium are nearly the same for tile reach (987: 42% against 42%). A Fibonacci Hard trophy
  therefore measures the tier choice more than the play. I accept it for consistency only if it sits above `fib_pure`'s
  987 and below the near-impossible 2584. That means 1597: 11% on Hard for the strong bot with sensible use.
- Pick each tile from the data, and never one where Hard and Easy are both near 0 or both near 100.
- C adds nothing a pure run does not already prove (M4: pure is the real mastery signal, and it is tier-free).
- D rewards a menu tap, not play (M4). Reject.
- Verdict: A, with thresholds Two 2048, Three 10 flushes and Fibonacci 1597, and Fibonacci flagged as the weakest of
  the three.

**3. Craft reviewer.**
- New non-secret trophies move the "N of M" total once, from 62 to 65 (`REVIEW_AESTHETIC5.md:207-214` disliked a
  moving total). That is a one-time step at release, not an in-play jump, which is acceptable.
- Names should be plain, and descriptions must use the same words as the difficulty row ("on Hard"), so the goal reads
  in one glance (M6).
- Glyphs: Hard is a crown in Four, Five, Nine and Sudoku, so use the crown where it is free in the game. Two already
  uses the crown for 8192 (`shared/trophies.js:155`), so Two's Hard trophy shows its tile, `sq:2048`.
- Keep to three trophies (M5).
- Verdict: A, as long as it adds no new visual pattern.

**4. Cold first-timer.**
- I see "Make 2048 on Hard" in the Still-to-find list and I now know there is a Hard mode worth trying. That is a goal
  I can read with no briefing (`REVIEW_COLD5.md:46`: the sheet "gives me goals").
- D would feel like a participation sticker.
- B is invisible until it is nearly done.
- Verdict: A.

**5. All-ages panel.**
- Maya (9) plays on Medium, which is the default. A seems harmless to her, because nothing she has is taken away (M2).
  Her real gap is unrelated to tiers: "Nothing yet" after 60 moves and a first Two trophy at 128
  (`REVIEW_AGES5.md:36-39,183-185`). D does not fix that; it would teach her to collect lowering the difficulty. Route
  her gap to the next triage as copy and early-trophy work, not to this decision.
- Sam (34, 3-minute sessions) cares about Three. Ten flushes on Hard is a session-length goal, and the human bot's
  median Hard run is 172 swipes.
- Priya (52) wants the Hard goals; they are her replay hook (`REVIEW_AGES5.md:73` on Sudoku's Hard and pure bests).
- Walter (71) will not chase Hard. Under E he would lose goals he can reach; under A he loses nothing.
- Verdict: A, never E, and not D.

## 3. Recommendation: add three trophies, change none

| id | Game | Name | Description | Glyph | Secret | Events | Test |
|---|---|---|---|---|---|---|---|
| `two_hard` | two | The old way | Make 2048 on Hard. | `sq:2048` | no | `["move", "end"]` (MOVE_END) | `d.tier === "hard" && num(d.top) >= 11` |
| `thr_hard` | three | Colour storm | Ten flushes in one game on Hard. | `crown` | no | `["swipe", "end"]` | `d.tier === "hard" && num(run(d).flushes) >= 10` |
| `fib_hard` | fibonacci | Steep spiral | Make 1597 on Hard. | `crown` | no | `["move", "end"]` (MOVE_END) | `d.tier === "hard" && num(d.value) >= 1597` |

In the shape `shared/trophies.js` uses. Place each line after its game's last non-secret trophy:

```js
T("fib_hard", "fibonacci", "Steep spiral", "Make 1597 on Hard.", "crown", 0, MOVE_END, function (d) { return d.tier === "hard" && num(d.value) >= 1597; });
T("two_hard", "two", "The old way", "Make 2048 on Hard.", "sq:2048", 0, MOVE_END, function (d) { return d.tier === "hard" && num(d.top) >= 11; });
T("thr_hard", "three", "Colour storm", "Ten flushes in one game on Hard.", "crown", 0, ["swipe", "end"], function (d) { return d.tier === "hard" && num(run(d).flushes) >= 10; });
```

- **Why these.**
  - Two: Hard is the old rule byte for byte (`docs/DESIGN.md:86`), so "The old way" is the old finish line on the old
    rules. It sits beside `two_2048` the way `four_hard` sits beside `four_win`.
  - Three: on Hard, flushes are the only reward, so the trophy counts the very thing the tier isolates. It doubles
    `thr_five` without repeating it.
  - Fibonacci: 1597 fills the gap between 987 (`fib_pure`) and 2584 (`fib_2584`). It is the weakest case on the
    mechanics read (Hard is about Medium here), and it is kept for family consistency.
  - Each is a clear goal, open from the first visit (M1), names the feat in the difficulty row's own word (M6), and is a
    "how the run was won" record (M3).
- **Honesty.** A game's tier never changes inside a game (`docs/DESIGN.md:102`), so the `tier` an event reports is the
  tier the whole run was played on. Undo restores the same tier. A missing or unknown `tier` never pays.
- **The events must carry the tier.** Today they do not. Add `tier: N.tierOf(state)` (the engine's own `tierOf`, so an
  old Hard save with no `tier` field reports `"hard"`) to:
  - Two's `move` and `end` reports (`two/game.js:244,293`);
  - Fibonacci's `move` and `end` reports (`fibonacci/game.js`, the calls through `report` at line 66);
  - Three's `swipe` and `end` reports (`three/game.js:251,327`, through `settle()`).
  Update the payload comments at `shared/trophies.js:129,140,151` to list `tier`.
- **Not retroactive, and that is honest.** Trophies are earned at the event. An old save (it loads as Hard) with a live
  run already past 2048 earns `two_hard` on its next move, because that run really was played on Hard. Nobody gets one
  from history.
- **Change none.** All 24 existing `two_*`, `fib_*` and `thr_*` trophies keep their ids, names, descriptions and tests
  (section 1.2).
- **Reject the rest.**
  - B (family "Hard in all three"): new machinery (M5), and a long grind in Fibonacci, where runs take 1,500 to 2,000
    moves.
  - C (secret pure Hard run): duplicates the tier-neutral pure trophies, and would make 3 secrets in a game.
  - D (try Easy): attendance for a menu tap (M4, M7).
  - E (gate existing trophies): dishonest and splits players.

## 4. For the implementer

### 4.1 Tests to add or change (`tests/test-trophies.js`)

1. **CASES** (one per new id, below then on the boundary):
   - `two_hard: ["two", "move", { top: 10, tier: "hard" }, { top: 11, tier: "hard" }]`
   - `fib_hard: ["fibonacci", "end", { value: 987, tier: "hard" }, { value: 1597, tier: "hard" }]`
   - `thr_hard: ["three", "swipe", { tier: "hard", run: { flushes: 9 } }, { tier: "hard", run: { flushes: 10 } }]`
2. **New test, "tier trophies pay on Hard only".** For each of the three ids, the boundary data with `tier` set to
   `"medium"`, to `"easy"`, missing, and set to an unknown value such as `"HARD"` earns nothing. The same data with
   `tier: "hard"` earns it. Also check that `two_2048`, `fib_2584` and `thr_five` still pay on every tier (no gate was
   added to the old ones).
3. **Registry test** (`tests/test-trophies.js:100-107`): `T.REG.length === 87` and `ids.size === 87`. Change the
   per-game bound from `per[g] <= 9` to `per[g] <= 10`. `sec[g] === 2` and `per.fam === 7 && sec.fam === 2` stay. Rename
   the test title from "84 trophies" to "87 trophies".
4. **Nothing to add** to the description, glyph or em-dash checks (`tests/test-trophies.js:108-113`): they cover the new
   entries automatically. Every description is at most 60 characters ("Ten flushes in one game on Hard." is 32), and
   `sq:2048` matches the numbered-square pattern. The spoiler list does not change, because none of the three is secret.
5. **Engine-side guard, one per game.** In `tests/test-two-tiers.js` and in the Three and Fibonacci tier tests, assert
   that the tier never changes inside a game and that Undo restores it. Two's file already covers this. Add it where the
   Three and Fibonacci tier work did not.
6. **Browser checks**, one per game (`tests/emu/two.cjs`, `tests/emu/fibonacci.cjs`, `tests/emu/three.cjs`): load a
   Hard state one join or one flush short of the boundary, play the move, and assert
   `NumbericsTrophies.has("<id>")`. The same state on Medium must not award it. This proves the client really sends
   `tier`.

### 4.2 Counts

- The registry goes from **84 to 87**: 7 family + 80 game trophies.
- Per game: Two 9 to 10, Fibonacci 8 to 9, Three 7 to 8. The secrets stay at 2 per game and 2 family-wide.
- The sheet's "N of M": M goes from **62 to 65** for a new player, because the three new trophies are non-secret. Every
  existing player's M also rises by 3, once, on the release that ships them. Their earned N does not change.

### 4.3 Specs to update in the same commit

- `docs/design/REDESIGN.md:783`: change the totals line to "7 family + 80 game trophies = 87; every game has 7 to 10".
  Add the three rows to the per-game tables in section 8.4.
- `tests/test-trophies.js:105`: the bound, as above.

### 4.4 Other docs

- `docs/DESIGN.md:124-125`: replace "plays the same board on every tier" with the measured statement. A power-up-free
  run has the same odds on every tier (an unused power-up changes nothing). Its tiles can fork after a reward one tier
  pays and another does not, because the draw uses the game's seed. Then record this decision: three Hard trophies,
  none gated, with a pointer to this file.
- Regenerate screenshots only if a shot shows the Trophies sheet or its count (`tools/shots.cjs`). The game boards do
  not change.

## 5. Summary

- **Add three trophies, all non-secret, and change none:**
  - `two_hard` "The old way": Make 2048 on Hard (`sq:2048`);
  - `thr_hard` "Colour storm": Ten flushes in one game on Hard (`crown`);
  - `fib_hard` "Steep spiral": Make 1597 on Hard (`crown`).
- Each tests `d.tier === "hard"` and fails closed. The game clients must add `tier: N.tierOf(state)` to their
  move/swipe/end reports.
- **Counts:** 84 to 87 trophies, M from 62 to 65, the per-game cap from 9 to 10 (for Two).
- **Why:**
  - It matches melon-eight's additive Hard badges with Hard open to all.
  - It matches this family's own Hard trophy in every other game with a difficulty.
  - Only Two's tile trophies are really cheapened on Easy (2048: 2% on Hard, 27% on Easy for the strong bot), and the
    honest answer is a Hard goal beside the old one, not a gate.
  - Fibonacci's tiers barely change tile reach, so `fib_hard` is the weakest of the three. It is kept for consistency.
