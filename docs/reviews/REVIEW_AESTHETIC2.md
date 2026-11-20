<!-- SPDX-License-Identifier: Apache-2.0 -->
<!-- Copyright 2026 alvations (Melon Lab) -->

# Craft review, round 2

Fresh reviewer: I read only PERSONAS.md and games.json. Nothing else from the repo.

How I tested: I served the site on port 8087 and drove headless Chromium at 390x844, 375x667, 320x568 (all at
deviceScaleFactor 2) and at 1280x860. For each game I captured the fresh load and the `__demo()` state. I then
played random moves until toasts, power-up aiming, round ends and game overs appeared. I solved one Sudoku
with a solver that reads the given digits from the page. I also took Tab-focus and hover crops, measured the
computed font sizes and contrast, and recorded the running animations with `prefers-reduced-motion` set to
reduce and set to no-preference. I looked at every capture.

Overall: the family holds together well. Every game shares the dark slate background, the gold display title,
the "Numberics ·" link with a tagline, the stat pills, the four-chip power-up tray with gold count badges, the
rounded board panel, the outlined "New game" button, the centred help paragraph and the games row with the
current game in gold. Aiming mode is a real family convention: a gold ring on the board, a ring on the chosen
chip, and the instruction on the status line. Reduced motion holds in all ten games, since only opacity fades
run under `reduce`. The problems are in the details: where things sit, what the same thing is called in each
game, and toasts that cover the board.

## Family-wide

1. [should-fix] **The toast covers the top row of the board in every game, at every size.** At 390x844,
   Endless shows "New tile 4" over the very tile it announces. Fibonacci's "New tile 13" and Three's "Flush 9-6-3
   = 18, +54 +Undo" each cover two or three top-row tiles. Seven's "Chain of 5! +Hold" covers the drop marker and
   row 1. Five's "Burst! +Nudge" covers the COMPUTER label. In Sudoku aiming mode the toast hides cells 2 to 8
   of row 1 while it asks you to tap a cell (see Sudoku 1). Expected: the toast sits in the space above the
   board or below it, never on the playfield.
2. [should-fix] **Toasts stack on top of the round-end and game-over overlays and compete with the title.**
   Endless 390: "Boost!" sits above "No moves left". Five 390: "Burst! +Nudge" sits above "Round to you".
   Three 390: "Rewound one move" sits above "No moves left", and the two messages contradict each other.
   Fifteen 390 and 1280: an "Already taken" error toast shows over "Round 1 drawn". Expected: an open overlay
   dismisses or holds back any toast.
3. [should-fix] **The stat pills sit in different places in different games.** At 1280x860, Sudoku,
   Fibonacci, Seven, Five and Nine put the pills to the right of the title. Endless, Four, Six and Fifteen put
   them on a row under the title. Fibonacci, the closest sibling to Endless, lays its header out differently
   from Endless on desktop. At 390, only Sudoku puts the pills beside the title, and at 320 that pushes its
   tagline onto two lines ("One / answer only."). Choose one rule and use it in every game.
4. [should-fix] **The head-to-head games name the same things differently.** The match-score pill is
   "RECORD 0-0" in Four, "MATCHES 0-0" in Five and "ROUNDS 0-0" in Nine. Fifteen splits it into "YOU", "COMPUTER"
   and "ROUND 1/5". Round-end titles are "The computer wins" (Four), "Round to you" / "Round to the computer"
   (Five), "Computer wins round 1" / "Round 1 drawn" (Fifteen) and "Round won" / "Round lost" (Nine). Score
   lines are "won 0, lost 1" (Four), "1-0, first to 3" (Five), "You 0 : 1 Computer" (Fifteen) and "You 1-0
   Computer · first to 3" (Nine). One vocabulary and one score format would make these four read as a set.
5. [should-fix] **The keyboard focus ring is almost invisible on an empty power-up chip.** The `.pw.empty`
   chip has opacity 0.45, and the ring fades with it to a dull brown outline (Tab to "Undo 1" on a fresh board,
   390, in all ten games). Empty chips are still Tab stops, so keyboard players land on them often. Draw the ring
   at full opacity, or skip chips that cannot be used.
6. [should-fix] **The scrim behind overlays is a different strength in each game.** Five, Nine, Seven and
   Four dim the board nearly to black, so the overlay text is clean. Fifteen (390 and 1280), Six (390) and Three
   (390) leave large ghost digits showing, and these collide with the overlay subtitle. In Fifteen, "You 0 : 0
   Computer" sits on top of a ghost "5 YOU". Use one scrim value across the family.
7. [nit] **The empty-state value differs.** BEST reads "0" in Endless, Fibonacci, Seven and Three, but "none"
   in Sudoku and Nine. Four's HELD also reads "none". The lowercase "none" is set in the light weight, so it
   looks like a different font next to the bold numbers.
8. [nit] **The reward wording differs.** "+Undo" (Three, Four, Five and Seven toasts), "+1 Candidates" (Sudoku
   toast) and "+1 Peek." / "+1 Undo." (Nine overlay, with a full stop). Choose one form.
9. [nit] **The cancel hint is written five ways.** "Arrows + Enter aim, Esc cancels." (Endless), "(Esc
   cancels)" (Fibonacci, Three, Seven, Five), "Arrows, Enter; Esc cancels." (Four), "(Esc cancels)." with the
   full stop after the bracket (Fifteen, Nine), and "(Esc cancels)" inside a toast (Sudoku).
10. [nit] **Help is offered in three different ways.** Three opens a first-run modal and has a "How it works"
    link. Nine has a "Learn" button next to New game. The other eight have only the help paragraph.
11. [nit] **Some help paragraphs are long enough to push the games row below the fold on a phone.** Four, Six
    and Fifteen run to six lines at 390, while Endless uses three. At 390x844, Six and Fifteen already scroll
    (document height 876), and their games row starts at the bottom edge.
12. [nit] **A chip reads "Undo 1" but is greyed out before the first move** (Endless and the others). It looks
    broken until you have moved. Sudoku hides the badge until there is something to undo, which reads better.
    Sudoku's chips are also set at 12.48px where the other games use 13.6px.
13. [nit] **The hover state is faint.** It only lightens the border on "New game" and on the chips. The focus
    state (gold ring) is good and identical in every game.

## Endless (/) score 7.5/10

The reference look, and it is clean. The tiles read well and the colour ramp is bright and legible.

1. [should-fix] The toast covers the tile it announces (390x844, "New tile 4"). See Family 1.
2. [nit] Endless is the only game whose title is the brand ("Numberics") and not the game name. The games row
   calls it "Endless", so the page you are on and the gold link in the games row disagree.
3. [nit] When the game ends, the persistent "New game" button under the board disappears and leaves an empty
   band (390, "No moves left"). Seven, Four and Three keep theirs.
4. [nit] "New tile 4", "New tile 8", "New tile 16" all toast in the first minute. That is noise before the
   reward tiles (32 and up) arrive.
5. [nit] At 390x844 there is a 30px empty band between the tray and the board where the status line would
   be. It reads as a gap, not as space kept for a message.

## Sudoku score 7/10

The grid is crisp. Given digits and entered digits are clearly different, and the row, column and box
highlight is tasteful. The counts on the number pad are a good touch.

1. [should-fix] Aiming at a cell (Reveal) shows "Tap a cell to reveal (Esc cancels)" as a toast over row 1,
   and that hides the cells it asks you to tap (390x844). It is also the only game that puts the aiming
   instruction in a toast and not on the status line.
2. [should-fix] After Esc, the aiming toast stays on screen while you go on typing digits (390, captured with
   a digit already entered), so the instruction is stale.
3. [nit] At 320x568 the pills beside the title push the tagline onto two lines.
4. [nit] The note digits in a cell are tiny at 390 and hard to read.

## Fibonacci score 7/10

It shares Endless's skin, which is right for a sibling.

1. [should-fix] On desktop its header is laid out differently from Endless: pills beside the title here, under
   the title there (1280x860). See Family 3.
2. [nit] Like Endless, it toasts every new top tile from 2 upwards ("New tile 2", "New tile 3"), and the toast
   covers the top row.
3. [nit] At 390 a 1 tile and a 2 tile are both cream or pink depending on value, so the opening board reads
   as two near-identical creams.

## Seven score 7.5/10

The most characterful game. The disc colours are lively, the egg discs have a nice crack glyph, the
level-progress dots are a clear timer, and the "The well overflowed" overlay with "See the well" is the best
end screen in the family.

1. [should-fix] The chain toast covers the drop marker and the top row (390, "Chain of 5! +Hold").
2. [nit] The ghost preview disc (dark number on dark slate) is barely visible at 390. That may be the intent,
   but at a glance it reads as an empty cell.
3. [nit] The NEXT pill shows a grey egg disc with no number at 1280. At first sight it reads as a broken disc.

## Three score 7/10

The help modal is the best teaching moment in the family: tile chips with plus and equals signs, readable at
375 and up. The gold ring around the board during a flush is good feedback.

1. [should-fix] **At 320x568 the top of the help modal cannot be reached.** The title "How Three works" sits at
   y = -36 with scrollTop 0, so it cannot be scrolled into view, and the Play button ends at y = 606, past the
   fold. The card is centred in a fixed scroller and overflows upward. At 375x667 it fits.
2. [should-fix] Game over at 390: the board keeps its gold ring, and "Rewound one move" stays over "No moves
   left". The ring is also wider than the board panel and comes within 12px of the page edge.
3. [nit] A new tile slides in from outside the board frame. For about 100ms it overlaps the gold border (390,
   mid-game capture).
4. [nit] The Play button in the modal draws a focus ring and a border together at 390, so it looks
   double-outlined.

## Four score 6.5/10

The discs look good. The landing preview (a dimmed gold disc) is a nice touch, and the end overlay showing
"4 + 4 + 1 + 1 = 10" explains the loss.

1. [should-fix] **Horizontal overflow at 320x568.** The four stat pills do not wrap, the RECORD pill runs past
   the right gutter, and the page scrolls sideways (scrollWidth 323).
2. [should-fix] The rule is stated three times in three wordings: the tagline ("four that make ten"), the
   status line ("a 10 with two of yours") and the help ("a ten-line"). This is the longest help text in the
   family.
3. [nit] The end overlay has only "New game". Seven lets you look at the board first ("See the well").
4. [nit] "The computer is thinking..." uses three full stops. The same holds in Five.

## Five score 7/10

Big cream tiles feel like Endless. The Shield label on a tile and the dashed outline are clear.

1. [should-fix] In aiming mode (Split) the status line wraps to two lines at 390 ("Tap your tile to move a
   point to your other. (Esc cancels)"), which pushes the board down a line. "your other" is also clumsy.
2. [should-fix] The toast covers the COMPUTER label and the computer's tiles, and it stays over the round
   overlay ("Burst! +Nudge" above "Round to you").
3. [nit] The 1 and 2 tiles are two very close creams (390). Here those are the values you most need to tell
   apart.
4. [nit] "Round to you" over "Round won · 1-0" says the same thing twice.
5. [nit] The five pips between the rows are never explained on screen.

## Six score 6/10

The concept is clear, and the bracket bar with its "√()" chip is a neat, legible piece of UI.

1. [should-fix] The board panel shows the target three times ("TIER 1 · MAKE 6", "make 6", then "6 ? 6 ? 6
   = ?" again), and there is about 100px of dead space between the tiles and the expression (390). At 390x844
   the page scrolls (876).
2. [should-fix] The "?" gap buttons are low-contrast grey circles on slate. They are the main thing you tap,
   but they read as disabled.
3. [nit] "Show answer" ends the run immediately with "Run over · 0 lines made". The button looks like a
   harmless helper next to Brackets and Clear. Style it as the run-ender it is.
4. [nit] At 390 the ghost board digits show through the "Run over" overlay. See Family 6.

## Fifteen score 6.5/10

The tiles are big, bold and easy to hit. Claimed numbers labelled YOU or COMPUTER are clear, and the winning
trio chips on the overlay are lovely.

1. [should-fix] The round overlay subtitle breaks in the middle of the score at 390: "Nobody made 15 · You 0 /
   : 0 Computer · 1 drawn". The ghost digits behind it collide with the text.
2. [nit] "You 0 : 0 Computer" puts a spaced colon where every other game uses a hyphen.
3. [nit] The Numbers/Grid toggle is a joined segmented control, while every other segmented choice in the
   family (Easy/Medium/Hard) is separate pills. The gold border of "Numbers" fights the shared edge.
4. [nit] The help paragraph is six lines at 390, and the games row falls below the fold.

## Nine score 6.5/10

The pip grids on the tiles are a lovely, readable idea, and the "- Take 3 from the 9 + Take" control row
reads well.

1. [should-fix] The board panel has a fixed height and only three tiles at the start, so about 110px of
   panel is empty above and below them (1280x860 and 390x844). The game looks unfinished.
2. [nit] Both 1 tiles are cream with one dark pip and eight light pips, which reads like a 9-grid with one
   checked. A 1 tile next to an 8 tile looks like the odd one out in the palette.
3. [nit] "Misere" lacks its accent (Misère).
4. [nit] "Learn" sits beside "New game" as an equal button. No other game has this.

## Scores

| Game | Score |
|---|---|
| Endless | 7.5 |
| Sudoku | 7 |
| Fibonacci | 7 |
| Seven | 7.5 |
| Three | 7 |
| Four | 6.5 |
| Five | 7 |
| Six | 6 |
| Fifteen | 6.5 |
| Nine | 6.5 |
