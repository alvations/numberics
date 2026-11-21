<!-- SPDX-License-Identifier: Apache-2.0 -->
<!-- Copyright 2026 alvations (Melon Lab) -->
# Craft review, round 4 (fresh reviewer)

Brief #3 in `docs/reviews/PERSONAS.md`. I read no earlier review, triage, source, test or `docs/DESIGN.md`. I read
`docs/design/REDESIGN.md` sections 1 to 3 and 5 and looked at every `docs/design/proto/*.png`.

How I looked: the site served on port 8096 and driven from Node with Playwright Chromium. Motion was recorded with the
browser's screencast, about one frame every 16 ms, during real input (not slowed), and laid out as labelled contact
sheets. I recorded slides, merges and spawns (Two, Fibonacci, Three), rapid input (four keys 45 ms apart), a Three flush,
drops, the computer's reply and a winning line (Four, Seven), flights and a burst (Five), pip takes (Nine), a claim and the
Numbers to Grid switch (Fifteen), a sign flip (Six), a placement and a clash (Sudoku), sheets opening, and the score "+N".
Each game was also shot in Dark, Light, High contrast, Light plus High contrast and Larger text, at 390x844, 375x667,
320x568 and 1280x860, with Motion set to Full, to Less, and to Device under an OS reduced-motion request. Target sizes,
the smallest font on each page and horizontal overflow were measured in the DOM.

Severity: [blocker] would make the owner say "that is not what I asked for" or locks someone out; [should-fix] a real
flaw a player feels; [nit] polish.

---

## Family-wide

### Motion

The headline result first: **tiles move.** Every slide is a real translate of about 100 to 110 ms, and a new key press
retargets tiles from wherever they are mid-flight. There are no snaps and no dropped input, which is the 2048 feel the
owner asked for. The gravity fall in Four and Seven accelerates and reads as a drop. Four's winning line draws in about
160 ms and the other discs dim behind it. Seven's pop-out swells and then shrinks. Under reduced motion the moves are
instant and the fades stay. One defect spoils the merge beat in three games, though, and it is the exact "blip" the owner
named.

1. [blocker] **The merge result shows on the first frame, before the pair arrives** (Two, Fibonacci, Three; every
   theme and size). On the first captured frame (about 20 ms after the key press) the merged tile is already drawn at
   about 72% scale on top of the tile that stays put. It reads as a small "4" framed inside a cream "2". For the whole
   110 ms slide, the moving tile slides under a result that is already showing, and only then does it swell to 1.14.
   Fibonacci makes this worse, because the result has a different hue from both parents: a pink 5 sits inside a red 2
   while the green 3 is still on its way. In the original 2048 the merged tile is invisible until the slide ends. Here
   the backwards fill of the pop's first keyframe (scale .72) shows during the delay. The fix keeps the .72 start for the
   swell but hides the face until the delay ends (opacity 0 until the slide has landed, or an opacity step in the first
   keyframe), so nothing new appears before the tiles meet.
2. [should-fix] **Spawned tiles read as grey at first** (Two, Fibonacci, Three, dark). The appear fade (opacity 0 to 1)
   on a dark board passes through a flat grey square at about 30 to 60% opacity, so the new 2 looks like a disabled
   tile for 2 to 3 frames (Two, 133 to 182 ms after the key press). It would read better with the opacity reaching 1
   within the first 40% of the keyframes while the scale finishes.
3. [should-fix] **The score "+N" is hard to see.** In Two the "+8" is about 11 px, faint gold, and it starts over the
   word "SCORE" before it rises out of the stat box. It is gone by about 300 ms. At 390x844 I needed the frame sheet to
   find it. It should start below the label, at the value's size or near it.
4. [should-fix] **End cards appear in a single frame.** On Four's last move the line draws, the board holds about a
   second, and then the card is fully there in one frame (no frames between 900 and 1903 ms). Everything else in the
   family fades or slides in, so this is the one hard cut a player sees on every game end.
5. [nit] **Rapid input is good, but merged results stack during a fast sequence.** With four keys 45 ms apart, a 64
   inside a 32 shows up over a 128 for about 30 ms (frames at 125 to 151 ms). It is the same cause as finding 1 and
   goes away with that fix.

### Look

The root page and the sheets match the prototypes closely: the same top bar, cards, Today card, tile gradients with the
lip, and the tan tray in Light. Typography is confident (heavy numerals, tabular stats). The colour system holds across
the ten games.

6. [blocker] **Larger text at 320 px scrolls sideways on every page.** At 320x568 with Larger text, `scrollWidth`
   is greater than the viewport on all ten games. The top bar runs to 333 px and the header to 339 px. The Settings
   button sits half off-screen, the subtitle is cut ("No top tile" loses its full stop), the Boost tray button is cut,
   and the Two board's right column is cut off. Larger text exists for the oldest players, and they are the ones on old
   small phones. At 375x667 with Larger text, Sudoku also scrolls sideways (the number pad, 381 px).
7. [should-fix] **The top bar crushes its icon buttons at 320 px.** At 320x568 (normal text) the Trophies and Settings
   buttons measure 24x44 and turn into narrow capsules. At 375 with Larger text they measure 37x44. Both are below the
   44 px rule, and they look broken next to the 98 px Games button. One fix: at narrow widths, drop the "Games" word or
   the "Numberics" word mark and keep three 44 px squares.
8. [should-fix] **Labels below the 12 px floor** (REDESIGN 1.1). Measured at 390x844: Fifteen's "you" and "computer"
   on claimed tiles are 8.9 px (they are hard to read even on desktop), Five's "Computer" and "You" side labels are
   10.7 px, Sudoku's "Time" and "Best" stat labels are 10.9 px, and Six's root-sign label is 11.5 px. The card previews
   are 11 px too, but those are decorative numerals, so I leave them out.
9. [should-fix] **Small targets in two games.** Sudoku's number pad is 34x50 at 390 and 27x50 at 320 (and 33x55 at
   375 with Larger text). Six's gap buttons are 40 to 41 px wide. Both are main inputs, tapped hundreds of times.
10. [should-fix] **In Light, low tiles vanish on the preview well.** On the cards and in the how-to sheet, the cream
    1, 2 and 2 tiles sit on a cream `--well` with no edge, so only the numerals show (Fibonacci card, Two card, Two
    how-to steps 1 and 2). The board does this right with the tan tray, but the wells do not.
11. [nit] **"Numberics ·" in every subtitle except Two.** Nine games start their subtitle with an underlined link
    "Numberics" that repeats the top bar's home link. It looks like a leftover from before the top bar, and Two has no
    such link.
12. [nit] **Two and Fibonacci have an empty hint row on load.** About 50 px of blank space sits between the tray and
    the board at every size. The prototype fills it with "Swipe or use the arrow keys." in gold, as Three does.
13. [nit] **The press state is hard to tell from hover.** On `.btn` the press looks almost the same as the hover lift
    (`hover-btn` against `press-btn`). For kids it helps when a tap visibly pushes the button in (a 1 px translate or a
    darker fill).
14. [nit] **High contrast does little for the drop wells.** In HC Dark, Four's empty holes are barely separable from
    the board, just as in plain Dark. HC raises text contrast but not the edges of the holes, so the 3:1 edge rule is
    doubtful there.

### Sheets, toasts, end cards

15. [should-fix] **End cards clip their trophy pills.** At 320x568 a Four loss with two trophies shows one pill; the
    second is cut (card scrollHeight 265 against 247 visible) and the New game button's focus ring is clipped. At
    390x844 a first-ever Four win earned four trophies, and the fourth pill is cut in half with no sign that more is
    there. The cards also lack the 56 px game glyph from the spec and from `two-over-large-mobile.png`, so the reward
    moment is plainer than designed.
16. [should-fix] **The toast covers controls.** In Sudoku at 390x844, the "Trophy: Night owl" toast lies over the
    Medium and Hard segment buttons. In Two it sits in the hint row, which is fine. The trophy toast is the reward and
    should never hide something you might tap.
17. [nit] **Focus ring on the auto-opened how-to.** On a first visit the how-to sheet opens by itself and its close
    button shows the full 3 px gold focus ring, even on touch. It reads as a selected, warning-like button on the very
    first screen. The focus move is right, but the ring should appear only after keyboard input (`:focus-visible`
    heuristics are defeated by the programmatic focus).
18. [should-fix] **No focus ring on the board.** Tabbing from the tray to Two's board (the 9th tab stop at 1280x860)
    shows no ring at all (`outline-style: none`, and no substitute is visible). A keyboard player cannot see that the
    board is the thing now taking arrow keys. Sudoku's board does show a gold ring, so the family is split on this.
19. [nit] **The empty Trophies sheet is one line.** "Nothing yet. Play any game to begin." A child gets nothing to aim
    for. Once earned, the sheet matches `sheet-trophies-desktop.png`. One oddity: of four trophies earned in the same
    Four run, only "Night owl" carries the new sparkle.
20. [nit] **Settings at 390:** "Auto (per game)" wraps to two lines inside its segment. In Light, the off toggles have a
    heavy dark knob that reads as "on" at a glance. Sound and Music are both on by default (I could not judge loudness
    headless; I flag the default for the owner, since music on a first tap surprises people).
21. [nit] **Copy is inconsistent across the family.** The cards heading says "More number games" on Fibonacci and
    "Ten number games" elsewhere. The how-to button says "Show the three steps" (7 games), "See the three steps" (Six,
    Sudoku) or "Show the steps" (Seven). The sheet title is "How to play Two" and so on, but plain "How to play" in Four,
    Seven and Sudoku.

### Themes and sizes summary

- Dark: the best theme, close to the prototypes.
- Light: warm and clean; the tan tray works; finding 10 is the one real problem.
- High contrast: tiles get the dark keyline and text is clearly stronger; finding 14.
- Larger text: works at 390 and 375 apart from wraps (Four's Record stat drops to its own row; Nine's "Take 3 from
  the..." is truncated with an ellipsis); breaks at 320 (finding 6).
- 1280x860: Two's two-column root is very close to `two-desktop.png`. The other nine games are a 375 px phone column
  centred on a wide dark page, with the board pushing New game below the fold. That follows the spec (3.1), so it is
  not a finding, but it is the least attractive view in the family.

### Reduced motion

Motion "Less" (with the OS at no preference) and "Device" (with the OS asking for reduced motion) behave the same.
Two's tiles jump instantly with only the spawn fading. Five's add is a 150 ms cross-fade with no flight. Four's disc
appears in place. Computer think pauses are kept. With "Full" chosen while the OS asks for reduced motion, the full
motion plays, so the in-app setting does win. Sheets open with opacity only. I found no defect here. **This is the
best-executed part of the motion system.**

---

## Per game

### Two (root) : 7/10
22. [blocker] Finding 1: on every merge a framed small result shows on the first frame.
23. [nit] The empty hint row (finding 12), and the "+N" (finding 3).
The slides themselves are crisp and quick. The root page (Today card, cards, footer line) is the most finished screen
in the family.

### Fibonacci : 6.5/10
24. [blocker] Finding 1 at its most visible: the result hue differs from both parents, so the pink-in-red frame flashes.
25. [nit] Its subtitle reads "2584 with no top tile.", while its card says "Join neighbours in the Fibonacci run." A
    newcomer will not read 2584 as "Fibonacci". Its cards heading is "More number games" (finding 21).

### Three : 6.5/10
26. [blocker] Finding 1 (for example, a 36 shows framed inside an 18 while the 18 is still sliding).
27. [should-fix] **The flush is slow and has a dead pause.** Measured on a real "Flush 3-6-9": slide 0 to 100 ms,
    rainbow sweep 130 to 450 ms, **nothing moves 460 to 660 ms**, tiles shrink out 676 to 790 ms, then the board sits
    with an empty bottom row until the next tile enters at about 900 ms. The flush is a reward, but at about 1 s with a
    200 ms hold in the middle it feels like a hitch, not a celebration. Tighten the gap after the sweep and bring the
    entering tile in while the pop-out ends.
28. [nit] The entering tile is drawn for a frame or two over the board's frame and padding (the clip is at the outer
    edge, not the cell area); visible at 47 ms on the top edge and at 924 ms on the bottom edge.
29. [nit] The rainbow sweep tints tiles to pale pastels that look washed out rather than bright.

### Four : 8/10
Drop, computer reply (think pause, then the same fall), the winning line and the dimming all read clearly; the board at
390 matches `four-mobile.png`.
30. [should-fix] End card: pills clip (finding 15), no glyph, hard cut in (finding 4).
31. [nit] The aim ghost (a dim brown disc numbered with your next value) sits in the aim column right above real discs
    and can be taken for a played disc in Dark.
32. [nit] On the computer's win the card says "The computer wins"; REDESIGN 1.2 gives "The computer won this round".

### Five : 6.5/10
33. [should-fix] **The landing dwells, then blinks.** The "+1" copy lands on the target at about 170 ms and then
    covers it, reading "+1", until about 290 ms. Then the target goes empty (a dark slot) for a frame and the new value
    grows from a small inset square. The spec says the number changes at the landing instant. As built, the player sees
    a "+1" tile, then a hole, then the answer.
34. [should-fix] **The burst is weak.** The shards are tiny, dark blue-grey dots on the dark board. They are visible
    only on the frame sheet, and at phone size the 5 just shrinks away. This is the game's payoff ("at five it
    bursts"); the shards need the tile's own bright hue, larger size, or a light flash.
35. [nit] After the computer's flight lands, a "+1" ghost flashes on its source tile for one frame (1072 ms).
36. [nit] The page opens with the hint "The computer is thinking..." before the player has done anything, which is an
    odd first line for a newcomer.

### Six : 7/10
37. [should-fix] Gap buttons 40 to 41 px wide (finding 9).
38. [nit] "Show answer" has a red outline and red text, the loudest button on the card. To a child it reads as "you
    did something wrong", and it pulls the eye away from the puzzle. A quiet style would suit giving up.
39. [nit] The text line "3 + 3 ? 3" under the tiles repeats the tiles at small size and adds clutter.
The sign flip is quick and clean; the dashed gold "?" gaps are inviting.

### Seven : 8/10
Drops accelerate, the settle is visible, and the pop-out (swell, then shrink) reads well. The eggs (grey with a crack
zigzag) are charming. The pause between landing and pop (about 180 ms) gives the eye time.
40. [nit] The row of tiny dots under the well (drops until the eggs rise) looks like a dotted rule, not a counter, at
    390 px.
41. [nit] How-to sheet title "How to play" without the game name, and the button reads "Show the steps" (finding 21).

### Nine : 7/10
The pips leave one by one and the number counts down in step, and the computer's ring marks its take. It is honest but
small at 390.
42. [nit] A tile's hue snaps to the new count's colour each step (green 3 to cream 1 in one frame), so the colour jumps
    while the pips glide.
43. [nit] Larger text at 390 truncates the amount line to "Take 3 from the..." (finding in Themes summary).

### Fifteen : 6/10
44. [should-fix] **The Numbers to Grid switch distorts the numerals.** The FLIP scales each tile non-uniformly from a
    tall pillar to a square, so the digits squash and stretch mid-flight. All nine tiles also cross through the middle
    at once (frames 70 to 200 ms show a pile of overlapping, deformed tiles). The idea, showing where each number goes,
    is good. Scale the label back (counter-scale) or cross-fade the face, and consider a small stagger.
45. [should-fix] "you" and "computer" on claimed tiles are 8.9 px (finding 8).
46. [nit] At 390 the Numbers view is nine tall pillars of 62x167. They are striking but they push the view switch and New
    game far down. The circular claim fill shows as a lens shape on a pillar while it grows.

### Sudoku : 7/10
47. [should-fix] Number pad 34x50 at 390, 27x50 at 320, and sideways scroll at 375 with Larger text (findings 6 and
    9).
48. [should-fix] Toast over the difficulty segment (finding 16).
49. [nit] Tray labels and segment text are lighter and smaller than in the other nine games (by design it keeps its own
    CSS), so it reads as a cousin rather than a sibling. The stat labels are 10.9 px (finding 8).
Placing and clashing read well: the clash paints the digit red and the matching digits are highlighted.

---

## Scores

| Game | Score |
|---|---|
| Two | 7 |
| Fibonacci | 6.5 |
| Three | 6.5 |
| Four | 8 |
| Five | 6.5 |
| Six | 7 |
| Seven | 8 |
| Nine | 7 |
| Fifteen | 6 |
| Sudoku | 7 |

Family: 7/10. The look and the reduced-motion work are near the prototypes. The motion system is close, held back by one
shared merge defect (finding 1), two weak or slow reward beats (Five's burst, Three's flush), the Fifteen view switch,
and the 320 px and Larger text breakage.
