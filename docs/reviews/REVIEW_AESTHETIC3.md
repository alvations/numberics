<!-- SPDX-License-Identifier: Apache-2.0 -->
<!-- Copyright 2026 alvations (Melon Lab) -->

# Craft review, round 3 (fresh reviewer)

Scope: the felt experience of all ten live games and the home page list, judged only from the running site
(served on 8091, headless Chromium). Sizes: 390x844, 375x667, 320x568 and 1280x860, deviceScaleFactor 2 for
close looks. States captured per game: fresh load, mid-game, power-up targeting, toast, the frames just before
the result card, round end, match or game over, and the "See the board" view. No earlier review, triage, source,
test or design doc was read.

Overall impression: the family is genuinely a family. Same dark ink, same gold title and accent, same 52 px stat
tiles, same 37 px power-up chips, same 42 px "New game" button, same 14 px board radius, same help paragraph and
link row. Phone layouts never scroll sideways at any size. Where it falls short is in the shared moments rather
than the shared chrome: the toast and the status line fight for one slot, the result card arrives before the
result can be seen, and every game words its win, its loss and its empty value a little differently.

---

## Family-wide

1. **[should-fix] The toast lands on top of the status line, hiding the instruction it should support.** Both
   live in the band between the power-up tray and the board. At 390x844: Endless with Smash armed reads
   "Tap a tile to sm[New tile 128 +Boost]n, Esc cancels."; Three reads "Arrows p[Flush 3-6-9, +54 +Smash]cancels)";
   Seven reads "Level [Chain of 3! +Crack]s rise.". Worst in Four (390x844, Medium, move 8): during the toast's fade-in
   frame "Ten threat! +Pop" and "The computer is thinking..." are drawn over each other at similar weight and both are
   illegible. Expected: the toast floats clear of the status line (over the board edge or below the tray), or the
   status line yields while a toast is up.

2. **[should-fix] The result card arrives before the result can be seen.** Time from the player's action to the
   card, measured at 390x844: Fifteen about 200 ms (the computer's winning claim and the card arrive together),
   Nine about 325 ms, Four about 345 ms, Endless at the instant of the locking move, Sudoku on the very keypress of
   the last digit, Five about 1.1 s but the decisive burst happens under the card (the frame at 926 ms still shows
   the computer's 3 lifting off; the next frame is the card). Players learn the outcome from text, not from the
   board. Expected: a short beat (roughly 600 to 900 ms) where the winning line, burst or last tile is shown lit on an
   undimmed board, then the card.

3. **[should-fix] Board digits ghost through the result card's heading.** The card has no surface of its own; it
   sits on the dimmed board, and dark tile numerals at about 15% show through the title. Endless "No moves left"
   over "32" and "4" (390x844); Fibonacci over "13" and "34"; Three over "18" and "12"; Fifteen "Computer wins round 1"
   over "2 YOU"; Five "Round to the computer" over the computer's "3". Expected: a solid or near-opaque card panel
   behind title and buttons, or a stronger scrim.

4. **[should-fix] The same moment is worded ten ways.** Round lost: Five "Round to the computer", Fifteen "Computer
   wins round 1", Nine "Round lost", Four "The computer wins". Match lost: Five "Match to the computer / Match lost
   0-3", Fifteen "The computer wins / Match lost 0-3 · Medium". Game-over subline: Endless "Top tile 32 · score 340",
   Fibonacci "Top tile 233 · 4,501 points", Three "Score 909 · 4 flushes · 5 power-ups", Seven "Score 1,209 · level 3"
   (lower-case "level" while the status line says "Level 2"). See-board hint: Four, Five and Nine "Tap the board for
   the summary.", Fifteen "Tap the board for the result.". Expected: one phrase set across the family
   ("Round won" / "Round lost" / "Match won 3-1" / "Score N · ..."), one see-board hint.

5. **[should-fix] The empty value is styled four ways.** Measured on fresh load at 390x844: Endless and Sudoku
   "none" 17.6 px weight 400; Three, Five, Six, Nine "none" 17.6 px weight 600; Fifteen "none" 15.2 px weight 700;
   Four "none" 13.6 px weight 400. Fibonacci and Seven show Best as "0" instead of "none". Side by side, the stat
   rows visibly disagree. Expected: one "none" style in every stat tile, and "none" for every never-set best.

6. **[should-fix] The same label means different things.** "YOU" is rounds won in Five, Fifteen and Nine, but your
   next disc value in Four (a gold disc showing "4"). "NEXT" is a coloured disc in Seven and a coloured tile in Three
   (fine), yet Four calls the same idea "YOU". Expected: Four's stat reads "NEXT" (or "YOURS") and rounds read "YOU".

7. **[should-fix] The end-state footer is inconsistent.** At game over Endless hides the lower "New game" and leaves
   a 100 px empty band between board and help (390x844). Fibonacci and Three keep it, so two "New game" buttons sit
   on screen at once. Six's "Run over" card has no "See the board" while Four, Five, Seven, Nine and Fifteen all offer
   one. Expected: one rule for the lower button and one card button set.

8. **[should-fix] Card focus differs.** Endless and Three move focus to the card's primary button (gold double ring
   visible); Fibonacci, Seven and Four do not, so a keyboard player must Tab hunt. Expected: every card focuses its
   primary action.

9. **[should-fix] Teaching is three patterns.** Three opens a "How Three works" modal on first visit; Nine has a
   "Learn" button beside New game; Three also has a "How it works" link in its help; the other seven teach only in
   the help paragraph. Expected: one pattern (for example a quiet "How to play" link in the same spot in every game).

10. **[should-fix] Desktop headers come in two layouts.** At 1280x860 Sudoku, Seven and Three put the stat tiles to
    the right of the title; Endless, Fibonacci, Four, Five, Six, Fifteen and Nine stack them under the title. On phones
    all stack (Sudoku excepted, which is right-aligned at every size). Expected: one header layout per breakpoint.

11. **[should-fix] Status lines that wrap shift the board.** The status band is one line (19 px) tall; when copy
    wraps it grows to 38 px and pushes the board down. Four fresh at 390x844: "Four of yours in a row, or four that
    make ten with two of / yours." puts the board at y=292 against 271 in its neighbours, and it jumps back when the
    copy shortens. Nine see-board at 390x844: "You took 7 from the 7, gone. Tap the board for the / summary." moves the
    board down 19 px. Expected: reserve two lines, or shorten copy so it never wraps at 375.

12. **[nit] Idle status band reads as a hole.** Endless and Fibonacci never use the band outside targeting, so a
    34 px empty strip sits between tray and board on every fresh screen (390x844 and 1280x860). Six blanks it after the
    first tap too.

13. **[nit] Targeting copy differs between the three sliding games.** Endless "Tap a tile to smash it. Arrows +
    Enter aim, Esc cancels."; Fibonacci "Arrows, then Enter to smash. (Esc cancels)"; Three "Arrows pick a tile, Enter
    smashes it. (Esc cancels)". Fibonacci and Three never mention tapping, which is how a phone player aims. The aim
    marker also differs: white dashed inset in Endless and Fibonacci, gold dashed outset in Three.

14. **[nit] Empty power-up chips are under contrast.** Chips at count 0 render at opacity 0.45: label text lands
    near 3.8:1 on the chip at 13.6 px, and the brown "0" badge lower still. Readable, but below 4.5:1 for small text.
    The stat labels (10.9 px caps, 6.0:1) are fine.

15. **[nit] Number colours are a language per game, not per family.** 2 is cream in Endless and Nine, pink in
    Fibonacci, green in Seven, grey in Three; 3 is mint in Seven, Five and Nine, lime in Fibonacci, red in Three. Each
    game is internally consistent; the family is not. Worth a decision either way.

16. **[nit] Home page list (Endless at /).** Nine identical grey cards in a two-column grid with an orphan "Nine"
    card at the end (390x844 and 1280x860). No colour or mark ties a card to its game, hover is only a faint border
    lift, and the card blurbs do not match the in-game subtitles (Fifteen card "Claim three numbers that make fifteen."
    vs page "Three numbers, fifteen exactly."; Five "Add tiles onto tiles; at five they burst." vs "At five or more it
    bursts."). At 1280 several blurbs leave one-word orphans ("ten.", "burst.", "fifteen."). Inside each game the same
    list is a row of underlined links that wraps "Six Fifteen Nine" onto a second line at 390, so the family nav has
    two looks.

17. **[nit] Endless is not titled Endless.** Every other page's H1 is the game name; Endless's is "Numberics" with
    "Endless." as subtitle. It doubles as the home page, but in the side by side it is the odd one out.

What works across the family: the 2px gold focus ring is consistent on every chip, segment, link and board
(Tab order is sensible everywhere checked); hover on buttons lifts background and border consistently; reduced
motion leaves only 120 ms colour transitions (no slides or drops), which is right; no horizontal scroll at 320.

---

## Endless (/)  7.5/10

1. [should-fix] Game over at 390x844: the lower "New game" disappears and leaves a 100 px blank band above the help
   paragraph; card digits ghost through "No moves left" (family 3, 7).
2. [should-fix] Smash targeting at 390x844: toast "New tile 128 +Boost" covers the middle of "Tap a tile to smash
   it..." (family 1).
3. [nit] 2 and 4 tiles are near twins (cream vs pale tan), hard to tell apart at a glance on 320x568.
4. [nit] 1280x860: the game list starts below the fold; the only cue is "Nine more games below." in the subtitle.
Strengths: the most finished feel in the set; toasts are short and celebratory ("New tile 32 +Smash"); the card's
"New best." in gold is a nice touch.

## Sudoku  7.5/10

1. [should-fix] Solve moment at 390x844: the card appears on the keypress of the last digit; the completed grid is
   never seen bright (family 2). "New best with power-ups." reads oddly as a celebration line.
2. [should-fix] Reveal gives no toast, while every other game's power-up says "Smash!" or similar. The revealed digit
   is only a slightly bluer numeral.
3. [nit] It departs from family chrome: chip text 12.5 px vs 13.6 px elsewhere, board radius 8 px vs 14 px, no status
   band, stats right-aligned beside the title at every size.
4. [nit] Conflict red digits on the blue same-digit highlight (r1c9 at 390x844) are the lowest-contrast red in the game.
Strengths: grid weight hierarchy (thick box lines) is crisp at 320; the digit pad remaining-counts are tidy; notes
sit in their keypad positions.

## Fibonacci  7/10

1. [should-fix] Best shows "0" on fresh load instead of "none" (family 5).
2. [should-fix] Close hues for different values: 3 (green) vs 13 (lime), 34 (magenta) vs 144 (violet), visible side by
   side in the 390x844 targeting shot.
3. [should-fix] Game over shows two "New game" buttons; card button not focused (family 7, 8).
4. [nit] Targeting copy omits tapping (family 13).

## Seven  7/10

1. [should-fix] Toast covers "Level 2 · N drops until the eggs rise." each chain (family 1).
2. [should-fix] Best shows "0" fresh (family 5). Card subline "level 3" lower-case vs "Level" in the status line.
3. [nit] Next stat "egg" label inside the grey disc is too small to read at 390x844.
4. [nit] 6 (magenta) and 7 (pink) discs are close hues when adjacent.
5. [nit] A mid-drop frame at 390x844 showed the falling disc about 12 px left of its column centre; worth a look.
6. [nit] At 375x667 and 320x568 the bottom of the well and "New game" are below the fold.
Strengths: the egg crack marks and the drop-count dot meter are lovely, readable feedback; "The well overflowed"
is the best-written end title in the set.

## Three  7.5/10

1. [should-fix] Smash targeting at 390x844: toast hides most of the instruction (family 1).
2. [should-fix] First-visit modal is the only one in the family (family 9). At 320x568 its icon column is wide and the
   text column narrow, wrapping to three or four words per line; the 24/48/96 chips float mid-paragraph. The Play
   button needs a scroll at 320x568 (Esc does close it).
3. [nit] Grey "2" vs light grey "1" tiles are distinguishable mostly by digit; inset style helps.
Strengths: the bevel on 3+ tiles and the 1/2 "half" tiles make the merge rule visible; flush toast copy is clear.

## Four  6.5/10

1. [should-fix] Medium, move 8 at 390x844: "Ten threat! +Pop" and "The computer is thinking..."
   overlap mid-fade, unreadable (family 1).
2. [should-fix] Fresh status wraps to two lines with an orphan "yours." and the board jumps 19 to 21 px when it
   changes (family 11).
3. [should-fix] Stat "YOU" means next disc here, rounds elsewhere; "HELD none" and "RECORD none" use a smaller,
   lighter "none" than any sibling (family 5, 6). At 320x568 the four stats wrap to two rows and RECORD sits alone.
4. [should-fix] Card at about 345 ms; the winning four are not seen lit before the scrim (family 2).
5. [nit] Long help paragraph (seven lines at 390) is the heaviest in the family.
Strengths: the blue "next win" ring and the ringed winning line in See the board are excellent signals.

## Five  7/10

1. [should-fix] The burst that ends a round happens under the card (frames at 593 and 926 ms show the computer's
   tile mid-lift, then the card at about 1.1 s) (family 2).
2. [nit] The lift animation shows a doubled numeral ("3" over "3") for a frame at 390x844, reading as a glitch.
3. [nit] Round-end copy "Round to the computer" vs siblings (family 4).
Strengths: big 100 px tiles, the dashed "Shield" frame and the five round pips are clear at every size.

## Six  7/10

1. [should-fix] 320x568 five-number lines: tiles 35 px and operator gaps 23 px wide, well under a comfortable tap
   target; the "?" rings touch the tile edges.
2. [should-fix] "Run over" card offers no See the board and the board's answer ghosts beneath it (family 3, 7).
3. [nit] The status band empties after the first tap, leaving a hole above the board.
4. [nit] "Show answer" in red outline is the only red button in the family; the two-tap "Sure? Ends run" confirm is
   good, keep it.
Strengths: live "2 - 2 + 2 = 2" readout under the line is great feedback; the √( ) bracket bar reads at once.

## Fifteen  7/10

1. [should-fix] Card at about 200 ms after your claim: the computer's winning claim is never seen before the card
   (family 2). The see-board glow on the winning three is good; it just comes after the text.
2. [should-fix] Bottom row mixes a view toggle ("Numbers" / "Grid", gold-outlined like the difficulty segment) with
   the "New game" action, same size, same row.
3. [nit] "none" at 15.2 px weight 700 (family 5); "Tap the board for the result." vs "summary" elsewhere.
Strengths: "YOU" / "COMPUTER" labels inside claimed tiles are clear without relying on colour alone.

## Nine  6.5/10

1. [should-fix] See-board status wraps and moves the board 19 px at 390x844 (family 11).
2. [should-fix] Round won at about 325 ms with the card straight away (family 2).
3. [nit] Only game that defaults to Easy on first load; every sibling opens on Medium.
4. [nit] Fresh 390x844: about 50 px of empty panel above the three tiles; at 320x568 BEST wraps to a second stat row.
5. [nit] "Learn" sits beside New game as an equal-weight button (family 9); the help paragraph is eight lines.
Strengths: the pip dots that hollow out as you set the take are the clearest "how many" control in the family.
