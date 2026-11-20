<!-- SPDX-License-Identifier: Apache-2.0 -->
<!-- Copyright 2026 alvations (Melon Lab) -->

# Craft review, round 1 (REVIEW_AESTHETIC1)

Reviewer brief #3 (craft): the felt experience. Memory wiped: no source, tests, design notes or earlier
reviews were read. Everything below comes from driving the ten live games in headless Chromium at
390x844 and 375x667 (phone) and 1280x860 (desktop), fresh, mid-game (`__demo()` state and real play),
targeting, toast, round-end and game-over states, keyboard focus, hover/press, and
`reducedMotion: 'reduce'`, then looking at every capture (2x for the close looks).

Tags: **[blocker]** hurts the core read of the game, **[should-fix]** visible flaw a player will notice,
**[nit]** polish. Every finding names game, size, and state.

## What already feels right (keep it)

- One palette, one type ramp: every page uses the same near-black ground, the same gold H1 at 32px/700,
  the same 13.6px grey subtitle, the same uppercase stat-pill labels and the same gold count badges in the
  power-up tray. At a glance all ten pages are obviously one family.
- The gold 2px focus ring (offset 2px) on buttons and boards is crisp and consistent.
- Reduced motion is honoured everywhere I could measure: with `reduce`, only opacity fades and short
  colour transitions remain (Five `five-fade`, Fifteen `ft-in` are opacity-only keyframes). No slides, no pops.
- Targeting states are clear and uniform: the board gets a gold outline and the status line says
  "Tap a tile to smash it. (Esc cancels)" (Endless, Fibonacci, Three).
- No console errors on any page, no horizontal scroll at any size.

---

## Family-wide (inconsistencies between games)

F1. **[should-fix] The header has four different shapes.** Phone 390x844, fresh:
- Endless: H1 is the family name "Numberics", the game name only appears as "Endless." in the subtitle.
  Every other page puts the game name in the H1.
- Back link: Sudoku, Seven, Three, Four, Five, Nine have "Numberics · ..." as an underlined link;
  Fibonacci, Six, Fifteen have no link at all (pure tagline).
- Subtitle content mixes taglines ("Every line makes six. Then 66, 6.6, 666."), live status
  ("Classic · Level 2", "Won 0 · Lost 0", "medium") and fragments ("count in threes", "at five it bursts.").
  Capitalisation and the closing full stop vary game to game ("at five it bursts." lower case with a stop,
  "count in threes" no stop, "Take the last tile." capitalised).
- Stat pills: on phone Sudoku keeps its pills to the right of the title; every other game stacks them under
  the subtitle. On desktop 1280 every game puts pills to the right except Fibonacci, whose pills sit on their
  own row under the subtitle (its subtitle is longer), so Fibonacci's board starts ~64px lower than Endless.
Pick one pattern (game name in H1, "Numberics" link + one short status in the subtitle, pills right on
desktop, below on phone) and apply it to all ten.

F2. **[should-fix] Toasts sit on top of the games row.** All games, all sizes. The gold pill toast is
fixed near the bottom edge and lands on the "Endless Sudoku ... Nine" links (phone: covers "Six Fifteen
Nine" and half of the first row; desktop 1280x860: covers "Nine"). Seen in Endless/Fibonacci
("New tile 377 +Undo"), Sudoku ("Unit complete: +1 Candidates"), Seven, Four, Five, Six. It should float
above the board area or sit in a reserved slot, never over tappable links.

F3. **[should-fix] Error and reward toasts look identical.** Seven "That column is full" uses the same
gold celebratory pill as "Chain of 4! +Undo". Four "The computer got there first" (a loss) is the same
gold pill as "Ten threat! +Hold". A neutral or muted style for warnings and losses would stop a bad
event from reading as a prize.

F4. **[should-fix] Messages are said twice.** Six: status line "Made 6. Next line (Enter)." plus toast
"Made 6!" at the same moment. Four: overlay "The computer wins" plus toast "The computer got there first",
and the toast is still visible over the overlay screen. Sudoku: the final move fires "Unit complete: +1
Check" while the "Solved" card is up, so the player is offered a power-up they can no longer use.
One channel per event.

F5. **[should-fix] No hover or press feedback on any button or link.** Desktop 1280x860, every game:
the New game button, the tray buttons and the games-row links keep the identical background, border
and colour on hover and on mouse-down (measured: `rgb(29,31,42)` / `rgb(51,54,74)` before, during
and after). Only the cursor changes. Clicks feel dead on desktop.

F6. **[should-fix] Game-over / round-end overlays differ in shape, colour and copy.**
- Endless, Fibonacci, Three, Seven, Four, Five, Six, Nine, Fifteen (match end): full-board scrim, white
  headline, gold primary.
- Sudoku: a small floating card in the middle of the grid with a gold headline ("Solved") and a drop
  shadow, the grid left undimmed around it.
- Fifteen: no overlay at round end at all; a gold "Next round" button appears inside the bottom row
  instead, while Five and Nine show a full overlay per round.
- Score formats in the overlay text: Five "Rounds 0-1 · first to 3", Nine "You 0 : 1 Computer.",
  Fifteen "0 to 3 on Medium.", Four "Four in a row after 8 discs." with the tally only in the subtitle.

F7. **[should-fix] The overlay scrim is too light; headline text collides with the board.** Desktop
1280x860 Endless game over: "No moves left" sits on a 256 tile and the gold button sits on the "128"
tile, both still readable through the scrim. Four (both sizes): the enlarged winning discs show through
under "The computer wins". Seven phone: discs "2", "4", "1" read through "The well overflowed", and the
summary line wraps to "best / chain 5". Five phone match end: the headline wraps to two lines
("The computer takes the / match") straight across the 4 and 3 tiles. A darker scrim (or a solid panel
behind the text) fixes all of them at once.

F8. **[should-fix] A new best is never celebrated.** Endless (phone and desktop), Fibonacci, Three,
Seven end screens all show SCORE equal to BEST (a new record) and the overlay says nothing about it.
Sudoku likewise sets BEST 0:03 silently. This is the one moment a player most wants acknowledged.

F9. **[should-fix] Focus rings are not consistent.** Keyboard Tab, phone, demo state:
- The "Numberics" link and every games-row link fall back to the browser default ring
  (`auto 1px`), a thin white double line, instead of the gold ring used on every button.
- Six: the operator gaps (÷, +) and the √( ) bracket chip also use the browser default ring, which
  draws a white box around the whole gap column, half over the neighbouring number tiles.
- Fifteen: a focused tile gets a white ring at offset 3px on top of its blue/gold owner ring and the
  glow: three rings stacked.
- Nine: the focus ring on a tile is the same gold as the selection border, so focused and selected
  cannot be told apart.

F10. **[should-fix] The power-up tray is not in the same order everywhere.** Undo is slot 1 (key 1)
in nine games and slot 4 (key 4) in Six ("Hint Skip Peek Undo"). A player moving between games hits
the wrong one.

F11. **[nit] Tray tooltips vary in voice.** Endless: "1: Undo" only (no description), Fibonacci "1: Rewind
the last move", Seven and Five lower-case ("1: take back the last drop"), Three repeats the name
("1: Undo: take back the last move", read as "Undo, 1 left. Undo: take back..."). One voice:
"1: Undo. Take back the last move."

F12. **[nit] Naming of the opponent and the restart button.** "CPU" in Four's pill and on Fifteen's tiles,
"Computer" in Five's and Fifteen's pills and in all copy. Restart is "New game" (seven games),
"New puzzle" (Sudoku), "New match" (Five, Fifteen), but Nine, also best-of-five matches, says "New game".

F13. **[nit] Difficulty default.** Sudoku, Four, Five, Fifteen open on Medium; Nine opens on Easy.

F14. **[nit] The empty band above the board.** Phone: Endless, Fibonacci, Three, Seven and Six reserve
a ~34px blank band between tray and board that is only filled when stuck or targeting; Four, Five,
Fifteen, Nine fill the same band with a gold prompt from the start. On the first group the gap reads as
a layout hole on a fresh board.

F15. **[nit] Phone page height almost fits.** 390x844 fresh: Sudoku 854px, Seven 853px, Five 858px,
so the page scrolls by 9 to 14px; every other game fits exactly. Desktop 1280x860: Sudoku 960px,
Fibonacci/Five 898px. Trimming a few px of vertical rhythm would make the main phone size scroll-free.

F16. **[nit] Games row orphan.** Desktop 1280: the ten links wrap with "Nine" alone on line two, centred.
Phone wraps 7 + 3. Either tighten the gap so ten fit on one desktop line or split 5 + 5.

F17. **[nit] Secondary "New ..." button size.** Sudoku's "New puzzle" is 13.6px text; the same button is
16px in every other game.

F18. **[nit] Empty values shown as a hyphen.** "BEST -" (Sudoku, Nine), "HELD -" (Four). A bare hyphen
looks like a glitch at pill size; "none" or a dimmed "0:00"/"0" reads as intended.

---

## Endless (`/`) - 7.5 / 10

The reference the family is measured against: clean grid, strong tile palette, crisp pills.

E1. **[should-fix]** Header: the H1 says "Numberics", not "Endless" (see F1). Every sibling page's
"Numberics" link points back here, and landing on a page whose title is the family name with the game
named only in grey makes it read like a hub, not a game.

E2. **[should-fix]** Game-over overlay, desktop 1280x860: headline and button sit on top of readable
tiles (F7), there are two "New game" buttons on screen (overlay primary + the page button under the
board), and a new best goes unmentioned (F8).

E3. **[nit]** Tray tooltips are the only ones without a description ("1: Undo", "2: Smash").

E4. **[nit]** The 32 tile (dark text on `rgb(100,90,216)`) is 3.45:1. It passes for large text but is the
weakest tile in the set; it is visibly duller than 16 and 128 next to it.

E5. **[nit]** The 2 (`rgb(232,227,217)`) and 4 tiles are almost the same cream; at a glance on phone the
two only differ by the digit.

## Sudoku (`sudoku/`) - 6.5 / 10

The densest page and the one that drifts furthest from the family look.

S1. **[should-fix]** Selected cell and same-digit highlight use an olive/brown fill on the blue-grey grid
(phone, demo state, row 2 col 6). It reads as a dirty cell rather than a highlight; every other game
selects with a gold outline on the normal fill.

S2. **[should-fix]** "Solved" is a small floating card with a gold headline and drop shadow over an
undimmed grid (phone, after a full solve), unlike every other end screen (F6). The copy
"0:03 on easy, pure: no power-ups" is awkward; "Solved in 0:03 on Easy. No power-ups used." reads better.
The toast "Unit complete: +1 Check" fires under the card at the same time (F4).

S3. **[should-fix]** Pencil notes are ~8px digits and the number-pad remaining counts are ~7px subscripts
(phone 390, notes mode with 1 5 9 in a cell). Too small to read on a phone without zooming.

S4. **[nit]** Header is the only one with stat pills beside the title on phone (F1), and "medium" in the
subtitle is lower case while the selected pill below says "Medium".

S5. **[nit]** "Undo ∞" shows the infinity badge while the button is disabled at the start.

S6. **[nit]** "Unit complete" is jargon; "Row done: +1 Candidates" (or Column / Box) tells the player what
they did.

S7. **[nit]** The grid cells are not in the Tab order (Tab goes Candidates -> Notes), so there is no
visible keyboard focus on the board even though arrows move the selection.

## Fibonacci (`fibonacci/`) - 7 / 10

Feels exactly like Endless, which is right, apart from the header.

B1. **[should-fix]** Desktop 1280: the only game whose stat pills are not on the right of the title (F1);
the whole board sits ~64px lower than Endless. No "Numberics" back link.

B2. **[should-fix]** Several sequence colours are near neighbours: 5 `rgb(90,170,216)` vs 233
`rgb(90,204,216)`; 8 (violet) vs 377 (blue-violet) side by side in the game-over board; 1 vs 2 cream vs
beige. In a game where adjacency is the whole rule, neighbouring values need clearly different hues.

B3. **[nit]** Subtitle "2584, and then some. There is no top tile." is two sentences and the longest in
the family; it is what pushes the pills onto their own row.

## Seven (`seven/`) - 7 / 10

Lively and readable; the drop column highlight and egg glyphs are nice.

V1. **[should-fix]** The row of ~20 gold dots under the well (all sizes) has no label or tooltip.
I had to infer it counts drops until the egg row rises.

V2. **[should-fix]** Game-over overlay (phone): discs read through the scrim, the summary
"Score 4,590 · level 5 · 74 drops · best chain 5" wraps with "chain 5" alone, and the new best (4,590 =
BEST) is not called out (F7, F8).

V3. **[should-fix]** "That column is full" uses the reward toast (F3).

V4. **[nit]** Hold with a held disc shows two round badges side by side ("Hold (7) (1)", demo state): the
held pink disc and the gold count look like the same kind of chip. A small disc outline or a
separator would tell them apart.

V5. **[nit]** NEXT pill at desktop fresh showed a plain grey disc with no number (an egg?) while phone
showed "6"; if eggs can be "next", a tiny egg glyph like the one in the well would explain it.

## Three (`three/`) - 7 / 10

V1 tiles and the hue cycle per multiple of three look good; the end summary is the best-written in
the family.

T1. **[should-fix]** 1 and 2 tiles are drawn as smaller inset faces while 3+ fill the cell (phone, fresh
and demo). Without an explanation it reads as a misalignment bug, especially in the fresh board where
the grey 2s look shrunken next to the red 3s.

T2. **[nit]** Some tiles carry a white inner border (24 in demo, 27/45/39 in later play) with no
explanation of what it marks.

T3. **[nit]** Copy: "Line up 3, 6, 9 to Flush it" capitalises Flush mid-sentence; the end summary then
says "0 flushes" in lower case.

T4. **[nit]** The 3 and the 24 share the exact red (`rgb(218,106,98)`); the hue cycle is fine, but a
lightness step per lap would help.

## Four (`four/`) - 6.5 / 10

T-shaped info is good (NEXT / HELD / CPU discs in the pills), but ownership is hard to read.

R1. **[should-fix]** Your discs and the computer's differ only by a thin ring colour (gold vs blue); the
fills are by number (cream 1, beige 2, green 3, blue 4) for both sides. On phone 390 the ring is ~2px,
so a column of cream 1s with mixed rings is hard to parse, and a blue 4 with a blue ring nearly loses its
ring.

R2. **[should-fix]** Winning line: the four discs scale up and overlap their neighbours (phone, computer
win, bottom row "2 1 1 1"), then stay enlarged under the overlay where they fight the headline (F7).

R3. **[should-fix]** Loss shows the gold reward toast "The computer got there first" on top of the
overlay "The computer wins" (F3, F4).

R4. **[nit]** The pills with discs are taller, so on desktop the NEXT/HELD/CPU labels sit 8px higher than
every other game's pill labels.

R5. **[nit]** The gold prompt "Four of your colour, or any four that sum to 10." disappears after the
first drop, leaving the blank band (F14).

## Five (`five/`) - 6.5 / 10

Big readable tiles; the target highlighting (gold on every legal target) is clear.

P1. **[should-fix]** Match-end overlay (phone): "The computer takes the match" wraps to two lines over
the tiles (F7). Shorter copy ("Computer wins the match") or a solid panel.

P2. **[should-fix]** Stats semantics: pills YOU / COMPUTER count rounds, MATCHES counts matches, but Nine's
MATCH pill counts rounds of the current match. Same word, different meaning across siblings.

P3. **[nit]** On first load the computer's opening move animates immediately (the first capture caught a
tile mid-flight with a ghost "1" stacked over it); a short beat before the computer moves would let the
player see the starting position.

P4. **[nit]** The "Shield" tag on a shielded tile is ~9px text on a dashed border; easy to miss.

P5. **[nit]** The "Burst! +Shield" toast was caught half-faded over the games row (F2).

## Six (`six/`) - 6 / 10

The most original screen, with good solved feedback (tiles and value turn gold). The tool row is fragile.

X1. **[should-fix]** "Answer" does not submit an answer: the first tap turns it into "Sure? Ends the run",
the second ends the whole run. The label invites the exact wrong tap. "Show answer" or "Give up" says
what it does.

X2. **[should-fix]** Phone 390: after the first tap, "( ) Brackets" and "Sure? Ends the run" both wrap
to two lines, the tool row grows, and the expression and value above it jump up by ~10px.

X3. **[should-fix]** "Run over" says "The answer is on the line." but the overlay's scrim and text sit
right over the line, so the answer (3 × 3 − 3 = 6) is barely visible behind "Reached round 1, 0 lines
made."

X4. **[should-fix]** Tray order puts Undo last (key 4) where every other game has it first (F10).

X5. **[nit]** Daily mode pill reads "DAILY / Six": a word in a slot where every other pill holds a number.

X6. **[nit]** The √ / ! marker chips above a number are ~16px circles with ~9px glyphs; fine on desktop,
fiddly on phone.

X7. **[nit]** There is a ~50px empty gap between the number row and the expression line in a fresh line
(phone and desktop); the bracket bar lives there but is usually empty.

## Fifteen (`fifteen/`) - 6 / 10

The magic-square Grid view is a lovely reveal; the claiming states are the weakest read in the family.

N1. **[blocker]** Ownership is not legible. A claimed tile keeps a per-number colour fill (2 green, 4 blue,
5 purple, 8 orange in Numbers view; brown, olive, navy, dark green when dimmed in Grid view), and who owns
it is told only by a thin gold/blue ring plus an 11px "YOU"/"CPU" label at 75% opacity (3.45:1 on the
purple, far lower on the dimmed tiles, where "YOU" on the dark olive is nearly invisible). Since the
whole game is "which three are mine", ownership should be the fill (one colour for you, one for the
computer) and the number colour should go.

N2. **[should-fix]** Round end has no overlay; a gold "Next round" button appears in the bottom row and
the row reflows: Numbers / Grid / New match drop from 16px to ~13px text to fit four buttons (phone 390,
compare round-end vs match-end captures). "New match" (destructive) sits right next to the primary.

N3. **[should-fix]** The match-end dim is uneven: one claimed tile (2, lower right) stays bright through
the scrim while its neighbours are dimmed.

N4. **[nit]** Focus on a tile stacks white focus ring + owner ring + glow (F9).

N5. **[nit]** "CPU" on tiles vs "COMPUTER" in the pill above (F12).

## Nine (`nine/`) - 6.5 / 10

The pip dots on each tile, with hollow pips showing what "Take 4 from the 5" will remove, are the best
piece of direct feedback in the family.

M1. **[should-fix]** The tiles nearly touch the board panel's left and right edges (phone 390, ~4px inset
vs ~8px in every other board) while the panel has 100px+ of empty space above and below them (phone and
desktop fresh, three tiles). The board looks unbalanced; centre the tile block vertically with a normal
inset, or shrink the panel to the content.

M2. **[should-fix]** Focus ring and selection border are the same gold (F9).

M3. **[should-fix]** MATCH pill counts rounds in the current match while Five's MATCHES counts matches
(P2); BEST "-" gives no hint of what is being bested.

M4. **[nit]** The disabled "Take" button is the gold primary at reduced opacity, which renders as a muddy
brown on the dark panel (phone fresh) and looks like an error state. The disabled tray style
(dark fill, dim text) would be calmer.

M5. **[nit]** Restart says "New game" though the unit is a best-of-five match (F12), and Nine opens on
Easy while siblings open on Medium (F13).

M6. **[nit]** The Learn line ("Nim-sum = 0000 (0)") switches to a monospace face; fine for binary, but it
is the only monospace text in the family and sits dim under the round overlay.

---

## Scores

| Game | Score |
|---|---|
| Endless | 7.5 |
| Sudoku | 6.5 |
| Fibonacci | 7 |
| Seven | 7 |
| Three | 7 |
| Four | 6.5 |
| Five | 6.5 |
| Six | 6 |
| Fifteen | 6 |
| Nine | 6.5 |

Family consistency on its own: 6 / 10. The visual tokens are shared well; the structure around them
(header, overlay, toast, tray order, focus, naming) is not yet.
