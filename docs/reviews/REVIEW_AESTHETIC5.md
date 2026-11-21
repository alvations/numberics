<!-- SPDX-License-Identifier: Apache-2.0 -->
<!-- Copyright 2026 alvations (Melon Lab) -->

# Round 5: Craft review (reviewer 3)

Player reviewer, memory wiped: I did not read earlier reviews or the source. Everything below comes from what I
saw on screen and from measured audio output.

**Setup.** `python3 -m http.server 8073` from the repo root, Playwright Chromium. I used 390x844 and 1280x860,
plus 320x640 with Larger text, in the default (light) theme, Dark, High contrast, and Dark plus High contrast.
To see motion I slowed CSS and Web Animations with the DevTools Animation playback rate (0.1x to 0.25x) and took
screenshots frame by frame. That covered Two merges and score pops, Four drops, Five adds and bursts, Nine takes,
Seven drops, the Fifteen Numbers/Grid switch, the Six solve, the Sudoku solve ripple, and the end cards.

For audio, I inserted an analyser between the page's Web Audio graph and the output and measured level and peak.
I started at the root, the new games page. I opened every game from its card, and Two at /two/.

**Overall.** The family is clearly one product now: the same top bar, cream and tan palette, stat pills,
power-up chips, frosted end cards and How to play sheets, and they work at every size I tried. There was no
horizontal overflow on any page at 320 wide with Larger text. Dark mode is handsome. The Fifteen Numbers/Grid
flight and the Sudoku solve ripple are the two best moments of motion in the set.

What still reads as unfinished:
- three overlay surfaces collide with text (the toast, the score pop, and the toast above sheets);
- the games page keeps a "Games" button that opens a copy of itself;
- each game phrases scores and rewards in its own way;
- a few low-contrast "money" lines: Six's "= 6", Five's "YOU", Nine's "+Peek".

## Findings

Severity: **High** = looks broken or hides key information; **Medium** = clearly unpolished or inconsistent
across the family; **Low** = polish.

### Games page (root) and top bar

1. **Medium. Games page, top bar: the "Games" button opens a copy of the page you are on.**
   Steps: open `/`, tap **Games**.
   What happened: a sheet slides up holding the same Today card and the same ten cards as the page behind it
   (captured at 1280: the sheet and the page show identical content side by side).
   Expected: on the games page itself the button is hidden or shown as current/disabled, or it scrolls to the list.
   Now that the root *is* the games list (the owner's ask), this button is the one thing that still treats the
   root like a game page.

2. **Medium. Games page, Nine card art: the dot grid spills out of the tiles.**
   Steps: open `/` at 390 or 1280 and look at the Nine card.
   What happened: under the 7, 3 and 5 tiles the third row of dots hangs below the tile's bottom edge, onto the
   tan background (clear at 3x zoom). In the game itself the dots fit inside the tiles.
   Expected: the dots sit inside the tile, as they do in play.

3. **Low. Games page, phone: no name or one-line identity above the fold.**
   Steps: open `/` at 390.
   What happened: the first things on screen are the logo mark (no wordmark at phone width) and the Today card
   ("Three dailies, the same for everyone"). The words "Numberics" and "Ten number games" only come after the
   dailies. At 1280 the wordmark shows.
   Expected: as a first screen, something says what this is before asking you to do today's dailies. For example,
   keep the wordmark at phone width, or put the "Ten number games" heading first.

4. **Low. Games page, desktop: the last row has a lone Sudoku card.**
   Steps: open `/` at 1280.
   What happened: the three-column grid of ten leaves Sudoku alone at the bottom left, under two empty slots.
   Expected: a layout that balances ten (for example 5+5 at wide widths, or a centred last row).

5. **Low. Games page, Today card at 390: the three daily tiles have different heights and internal layouts.**
   "Daily Sudoku" wraps to two lines and carries an extra "Medium" line, so its tile is taller and its text is
   top-aligned, while the other two tiles are vertically centred. This happens in every theme.

6. **Low. Card pills change order.**
   On the in-game "More number games" list, a vs-computer game you are playing shows "Playing" *before*
   "vs computer" (Fifteen, Four, Five, Nine). Everywhere else "vs computer" comes first.

### Family consistency (game pages)

7. **Medium. All games, header: the stat pills jump between two layouts depending on the subtitle length.**
   Steps: open the games one after another at 390.
   What happened:
   - In Three ("Count in threes."), Five and Sudoku the stat pills sit to the right of the title.
   - In Fibonacci, Two, Four, Six, Seven, Nine and Fifteen they drop below the subtitle.
   - Three and Fibonacci both have three stats (SCORE, BEST, NEXT or TOP TILE), yet they lay out differently.

   Expected: one header layout for the family, so the board starts at the same height and switching games does
   not jolt.

8. **Medium. Round and match end cards: score and reward wording differs in every game.**
   Steps: win a round in Four, Five, Nine and Fifteen, and earn a power-up from play in Two, Six and Sudoku.
   What happened:

   | Where | Score | Reward |
   |---|---|---|
   | Four | "You 0 : 1 Computer" (its RECORD pill says "0-1") | none |
   | Five | "You 2 : 2 Computer" | "earned Nudge, Undo" |
   | Nine | "1-0, first to 3" | "+Peek", small and pale gold |
   | Fifteen | "You 1 : 0 Computer" | "+1 Peek", bold gold |
   | Two (toast) | n/a | "New tile 32 +Smash" |
   | Six (toast) | n/a | "Three clean lines: +Skip" |
   | Sudoku (toast) | n/a | "36 cells filled: +Check" |

   Expected: one score form (for example "You 1 : 0 Computer", also in the RECORD pill) and one reward form (for
   example "+1 Peek") across the family.

9. **Medium. End cards: the frame and the secondary button differ between games.**
   - Four, Five, Nine, Fifteen and Seven use a defined frosted card with an edge and a shadow.
   - Sudoku's "Solved" card has no visible edge. The solved digits show through behind "Solved" and the trophy
     chips, which makes the card the least legible in the set.
   - Seven's overflow card has a circled "7" icon; no other card has an icon.
   - The secondary button ("See the board" or "See the well") is white in Four, Five and Nine, but beige-filled
     in Fifteen, Seven and Sudoku.

   Expected: one end-card shell, with the same treatment for the secondary button.

10. **Low. Button names and the position of the mode control.**
    - Sudoku says "New puzzle" (a beige-filled button) where every other game says "New game" (white).
    - Fifteen puts its Numbers/Grid toggle under the board, on the same row as "New game". The three buttons look
      like one segmented control, so "New game" reads as a third view. Every other game keeps its mode control
      above the board.
    - Sudoku's difficulty chips use regular weight; the other games use bold.

11. **Low. Nine: "Learn" is left alone, off-centre, while a round card is showing.**
    Steps: win a round in Nine.
    What happened: "New game" hides and "Learn" sits by itself to the right of centre under the card.
    Expected: centre it, or hide it with "New game".

### Overlays colliding with content

12. **High. Two, Fibonacci, Six, Sudoku, Five: the toast covers the status/hint line.**
    Steps: in Two, make a new top tile of 32. In Five, burst a tile. In Six, solve three lines cleanly.
    What happened: the pill toast ("New tile 32 +Smash", "Burst!", "Three clean lines: +Skip") lands exactly
    on the gold status line. That produces garbled overprinted text, for example
    "Stuck. Us[New tile 64 +Swap]p going." and "The comp[Burst!]thinking...". In Six it hides the
    "Made 6. Next line" message in the same instant it matters.
    Expected: the toast has its own lane (over the board, or below the top bar) and never overlaps live text.

13. **Medium. Two, Fibonacci: the "+N" score pop floats up through the subtitle.**
    Steps: in Two, merge 8+8.
    What happened: "+16" rises out of the SCORE pill and sits on top of "Every tile is a power of two",
    overprinting it for most of its life (seen in every frame of a 0.15x capture, and in normal-speed shots).
    Expected: the pop stays inside or beside the pill, or fades before it reaches the text above.

14. **Medium. Toasts appear above open sheets.**
    Steps: in Two, play until a power-up toast fires, then open Trophies.
    What happened: "New tile 64 +Undo" floats on top of the Trophies sheet, over the "Two" heading.
    Expected: game toasts are suppressed or queued while a sheet is open, or they sit under the scrim.

### Contrast and legibility

15. **Medium. Six, solved line: the "= 6" result is gold on the tan board, close to invisible.**
    Steps: solve a line in Six (for example 2 x 2 x 2 - 2).
    What happened: the tiles turn gold (nice), but the "= 6" readout, the proof that you did it, becomes pale
    gold on tan. In the unsolved state "= ?" is dark grey and readable.
    Expected: the solved readout is at least as strong as the unsolved one.

16. **Medium. Five, light theme: the "YOU" label under your tiles is pale gold on tan and barely readable.**
    "COMPUTER" above is grey and fine. Both labels should read alike.

17. **Low. Nine end card: "+Peek" is small, pale gold text on the frosted card.**
    It is the weakest line on the card. Fifteen's "+1 Peek" is bold and clear.

18. **Low. Seven: the landing preview ring after a drop (a dashed numbered circle) is faint pale green on cream.**
    At phone size it is hard to see where the next disc will land.

19. **Low. Dark theme: the cream "1" and "2" tiles in Fibonacci, Two and Five stay full bright on a near-black board.**
    In Five, four 120px cream tiles are the brightest thing on screen and glare. Three's light grey tiles in dark
    are softer and read better. Consider a slightly dimmed cream in dark.

20. **Low. Three: the 1 and 2 tiles look recessed.**
    They have an inset frame, a grey fill and a lighter border, which is the visual language of empty slots.
    Next to the bright 3+ tiles they read as holes in the board rather than tiles, especially the light grey 1.

### Motion

21. **Low. Four and Seven: the disc drop is close to a cut.**
    Even at 0.2x the disc goes from above the column straight to the landing cell, in one or two frames. There is
    no visible fall through the rows. The rest of the family (Two's slide, Five's "+3" flight, Fifteen's
    rearrange) shows its motion.

22. **Low. Fifteen, Numbers to Grid: tiles overlap and clip each other in flight.**
    For the first few frames the top row moves as one strip, wider than the board, then breaks up. Digits clip
    behind neighbours ("1" half hidden under "2"). It still reads as a satisfying shuffle. A stagger or a fixed
    z-order would clean it up.

23. **Low. Five, burst: the confetti is tan/brown whatever the tile colour, and it lingers over the green tile.**
    It sits there for a long time after the burst, so the burst tile looks dirty rather than exploded.

24. **Low. Two: the new spawned tile appears while the slide is still mid-flight.**
    In a 0.1x capture the spawn shows in frame 4 of a 12-frame slide. Most 2048s spawn as the slide lands.

### Settings, Trophies, copy

25. **Medium. Settings, Memory: "Erase" turns into "Sure? Erase everything" and wraps to three lines.**
    The Erase button grows taller than Save and Load and pushes past the bottom of the sheet at 390.
    Expected: shorter confirm copy ("Erase all?") or a confirm row that keeps the button height.

26. **Low. Settings, "Music style": eight bare names with no character, and no feedback on pick.**
    - "Auto (per game)" wraps inside its pill, so the 4x2 grid has one cramped cell.
    - "Chill, Drift, Pocket, Quest, Blocks, Pulse, Epic" say nothing about how each sounds.
    - Picking one only moves the outline. There is no subtitle ("Pulse: steady synth beat"), no "now playing"
      line, and no short preview.

    Measured: the styles do produce different output (mean RMS ranges from 0.0031 to 0.0061 across Auto, Chill,
    Epic, Pulse and Blocks), so the feature works. It is just invisible.

27. **Low. Settings: the "Device" option is first in Motion (Device, Less, Full) but last in Theme (Dark, Light, Device).**

28. **Low, worth checking. Audio level: at the default volume (50%) the music peaks around 0.03 of full scale.**
    That is about -30 dBFS. Sound effects measured about 0.007 RMS. On a phone at a normal media volume this is
    likely to sound very quiet next to other apps. I measured digital output only, not with speakers.

29. **Low. Trophies: the total changes when you find a secret trophy, and secrets are not hinted.**
    Steps: open Trophies ("1 of 62 trophies"), then win a Fifteen round in Grid view.
    What happened:
    - The count becomes "4 of 63". "The middle way" appears, but it was never listed.
    - Five's end card awarded "Right on five", which is not listed under Five.

    Expected: a fixed total, plus a "secret" placeholder per game (for example "? Secret trophy"), so the number
    is not a moving target.

30. **Low. Trophies, copy.**
    - "Upside down: Win a Misere match": I could not find a Misere mode anywhere on Nine's page, and the word
      appears nowhere else.
    - Number formatting is mixed: "Make 10946", "Make 8192", but "Score 20,000", "Score 7,000".

31. **Low. Six status copy on a phone: "Made 6. Next line (Enter)."**
    "(Enter)" means nothing on touch. Show it only after keyboard use, as other games do with arrows.

32. **Low. Desktop: the How to play and Settings dialogs keep the bottom-sheet drag handle while centred.**
    At 1280 they show as centred dialogs, but the grey drag handle is still drawn at the top, inviting a drag that
    does nothing.

## What is good (keep it)

- **Family look.** Every game has the same top bar, pills, chips, sheets and frosted cards. How to play is
  three illustrated rows plus a gold Play button in all ten games. This is the most consistent the set has felt.
- **Robust layout.** No horizontal overflow on any page at 320 with Larger text. Dark mode is complete across
  all ten games and the games page. High contrast adds real borders, and in dark it switches to a navy board
  that still reads.
- **End cards.** They say what happened in the game's own terms ("Your 3 onto their 2 made 5", "3 + 4 + 1 + 2 =
  10", "The well overflowed"), list the trophies as chips, and always offer "See the board".
- **Motion highlights.** Fifteen's Numbers/Grid rearrange (despite #22), the Sudoku solve ripple through the
  last row and box, Five's "+3" flight onto the target, and Six turning the solved tiles gold.
- **Nine.** "Take 1 from the 7" between the minus and plus buttons is exemplary control copy, and Learn's
  "copy each take" hint is genuinely teaching.

## Priority for the fix pass

1. #12 and #14 (toast lane and z-order), then #13 (score pop).
2. #1 (Games button on the games page) and #2 (Nine card art).
3. #8 and #9 (one end-card shell, one score and reward vocabulary).
4. #15 and #16 (contrast of Six "= 6" and Five "YOU").
5. #7 (one header layout).
