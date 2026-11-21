<!-- SPDX-License-Identifier: Apache-2.0 -->
<!-- Copyright 2026 alvations (Melon Lab) -->
# Cold first-time player, round 4

I was handed one link, http://127.0.0.1:8097/, and nothing else. Mostly a phone (390x844, touch), some
desktop (1280x800). I acted only on what was on screen. Everything below is in the order it happened.
Screenshots of every step are in my scratch folder; the findings quote what was on screen.

## The link itself (landing)

What I saw first: not a menu. I landed inside a game called **Two** with a "How to play Two" sheet already
covering the bottom half. The brand "Numberics" is a small grey word in the corner. It took me a moment to
realise this is a collection: the games list is a long scroll below the board, or behind the "Games" button.

Ten seconds? Yes for Two: the sheet's three cards (swipe, 2+2=4, make 32 for a power-up) are clear and short.
The sheet helped rather than annoyed, and it did not come back on reload, which is right.

Finding the other games: easy. "Games" in the top bar opens a sheet with the three dailies and ten cards, and
the same cards sit under every game. Each card has a tiny animated-looking picture, one line, and badges
("vs computer", "New to you", "Playing"). That is good.

The order: Fibonacci, Two, Three, Four, Five, Six, Seven, Nine, Fifteen, Sudoku, under "From the smallest
number to the biggest". I read the names as numbers and it mostly works, but Fibonacci before Two made me
stop ("is Fibonacci 1?"), there is no Eight so the gap from Seven to Nine looks like a missing game, and
Sudoku at the end is not a number at all.

Sound and music: I could not hear them, but the Settings (the sun/gear icon, no label) show Sound ON and
Music ON by default, with eight music styles, vibration, motion, theme, larger text, high contrast, and
save/load. The panel is good. The problem is finding it: a stranger whose phone suddenly plays music after
their first swipe has to guess that an unlabelled sun icon is where the mute lives.

1. [should-fix] Music and sound are both on by default and the only way to stop them is an unlabelled icon. A
   stranger on a bus will hunt for a mute. Either a visible speaker toggle in the top bar, or a one-time
   "Music on, tap to mute" toast at the moment it starts.
2. [should-fix] The root link drops you into Two with a sheet, not into the collection. The collection is the
   product; the first screen should say so (even one line like "10 games, this is one of them").
3. [nit] The list order: Fibonacci first and Sudoku last read as arbitrary, and the missing Eight looks like a
   bug. Say why ("1, 2, 3 ... 15, then 9x9") or put Two first.
4. [nit] The list header differs per page: "Ten number games" on the hub and Three, "More number games" on
   Fibonacci, and no header at all under Four, Five, Six, Seven, Nine, Fifteen, Sudoku.
5. [should-fix] Trophies: the trophy panel says "Nothing yet. Play any game to begin." and after I earned some
   it lists only those. There is no list of trophies I have not got, no count like "3 of 40". So I never
   wanted more: I could not see what "more" was. Show locked trophies (greyed, with the hint).
6. [nit] "Night owl: Played well past bedtime" was awarded in my very first minute just because of the clock.
   It feels like a free sticker, not an achievement.

Landing: **7/10**.

## Two

First thing: two tiles, score/best/top tile, four power-ups (Undo 1, Smash 0, Swap 0, Boost 0). Clear.
Swipes worked first try, tiles slid and merged exactly as 2048 does. After about 110 swipes of lazy
zigzagging I got "Stuck. Use a power-up to keep going." with Smash lit. Tapping Smash said "Tap a tile to
smash it. Tap Smash to cancel." which is perfect. "Trophy: Warming up" popped at 128.

7. [nit] "Undo 1" is already lit before I made a single move; I did not know what it would undo.
8. [nit] Card says "2048 with no top tile", page says "Every tile is a power of two. No top tile." Fine, but
   "no top tile" means nothing to someone who never played 2048. "It never ends" is plainer.

Would I quit? Only when bored, which for 2048 is a long time. Can I "win"? There is no win, by design, and
that is stated. **8/10**.

## Fibonacci

Subtitle: "2584 with no top tile." I have no idea what 2584 is. The sheet: "Swipe to slide every tile" with
a picture of 1 arrow 2, which looked like "1 becomes 2". Then "Neighbours in the run join: 1 and 1, 1 and 2,
2 and 3, 3 and 5" and "3 + 3 NO". Once I read it twice I understood: consecutive Fibonacci numbers join.
Playing blind with the same zigzag I lasted 400 swipes, top tile 233, score 2,850, never stuck. It is
forgiving, maybe too forgiving for a blind swiper.

9. [should-fix] "2584 with no top tile" is a riddle. Say "Join neighbours: 1+1, 1+2, 2+3, 3+5 ..." as the
   subtitle, which is what the hub card nearly says.
10. [nit] The first how-to picture (1 arrow 2) reads as a merge, not a slide. Use a single tile moving to a
    wall, as Two's picture does.
11. [nit] The "How to play" sheet has no Play button here (Two, Four, Six, Seven, Sudoku also lack it; Three,
    Five, Nine, Fifteen have one). Same family, two behaviours.

The board colours by number are lovely. I had to keep checking which numbers are neighbours past 34. **6.5/10**.

## Three

"Swipe to start: every tile moves one step." The sheet says 1 and 2 make 3, from 3 up equal tiles join, and
"Line up 3, 6, 9 for a rainbow flush." Swiping one step at a time is the Threes feel and it works. With my
lazy zigzag I was stuck after 66 swipes at 390 points: "Stuck. Undo a move, or start a new game." No big end
card, just that line in small yellow text.

12. [should-fix] "Rainbow flush" is never explained in play. I never saw one happen or knew if I made one.
    What does it pay? Show it the first time it is possible, or drop the phrase from the sheet.
13. [should-fix] The end of a run is a one-line status, while every other game has a card ("The well
    overflowed", "Run over", "Solved"). I missed that the game had ended and kept swiping.
14. [nit] The fourth power-up is called "Third". I could not guess what it does from the name.
15. [nit] 1s and 2s are both grey-white; on a phone at a glance 1 and 2 look the same colour family as the
    empty cells.

I would quit here first of all the sliding games: I lost fast and was not told why. **6/10**.

## Four

Board of 7 columns, "Easy/Medium/Hard", top bar says YOUR NEXT 4, HELD none, ITS NEXT 1, RECORD none. The
sheet: drop discs, four of your colour in a row, or four in a row that add to ten with two of yours. The
ten rule is the interesting bit. Then "Blue ring: the computer's next disc would win there." That warning is
excellent; it taught me to block.

Tapping without thinking, I lost 1-4 on Easy (computer won twice by four in a row and twice by sums to ten
like "1 + 3 + 4 + 2 = 10"). When I tapped New game mid-game it asked "Sure? Counts as a loss", which is fair.

16. [should-fix] On a win/loss card the trophy chips overflow: on my win ("4 + 1 + 3 + 2 = 10") the fourth
    trophy chip is cut off behind the "See the board / New game" buttons. Same clipping in Five, Nine and
    Fifteen when two or more trophies arrive.
17. [nit] "ITS NEXT" reads oddly. "Computer next" fits the "Computer" wording used elsewhere.
18. [nit] The sheet title is just "How to play" here (also Seven and Sudoku) while the others say "How to
    play Five" etc.
19. [nit] Easy is beatable but only once you take the blue ring seriously; a lazy tapper loses most games.
    That is fine, but the very first match could be kinder.

**6.5/10**. The "make ten" twist is clever; the hint ring saved it for me.

## Five

Four big tiles, all 1s, computer on top, me at the bottom. "Tap your tile, then a tile to add it onto." I got
it in seconds. Adding my 2 onto their 3 made 5 and burst it. I won my first match 3-0, then 3-2, then 3-0 on
Easy with a simple "aim for five" plan. Rewards pour in: nearly every round "earned Nudge, Shield".

20. [should-fix] Two scores side by side mean different things: YOU 3 / COMPUTER 0 is rounds, RECORD 1-0 is
    matches. After a 3-0 match the board read "3 ... 0 ... 1-0" and I had to work out which was which.
21. [nit] The sheet says "Burst both of the computer's tiles to win the round", but rounds often ended after a
    single burst I made. Either the rule or the copy is off from what I saw.
22. [nit] The round card's text wraps as "made 5 · You 1 : 0 Computer · earned Nudge, Shield" across three
    lines starting with a dot.
23. [nit] Power-ups come almost every round; by match two I had Shield 2, Nudge 2 and never needed them.

Delight: the burst. Easy to win, quick to understand. **7/10**.

## Six

"make 6" with a row of numbers and "?" gaps. "Tap a gap for + − × ÷, a number for √ or !." Tapping a gap
cycles the sign, the bottom shows the live sum ("= 4.0625"). Line 1 was 3 ? 3 ? 3 and I got 3 × 3 − 3 = 6;
"Next line (Enter)". Line 2 was five 4s, which stumped me for a while (the answer exists, I just did not see
it). Hint (1) gave me the first sign. "Show answer" is a red button right next to Clear; tapping it once said
"This ends the Climb run. Tap again to show it." Good guard.

24. [should-fix] Line 2 of tier 1 can already be 4 4 4 4 4, which needs a non-obvious trick. The first two
    lines of a first visit should be gentle; I nearly quit there.
25. [nit] With five numbers the signs move under the tiles instead of between them; the row looks broken.
26. [nit] "Every line makes six, then 66, 6.6, 666" in the subtitle promised me a climb I never reached and do
    not understand ("6.6"?).
27. [nit] When I tapped a number by mistake it put a √ on it with no clear way to remove it except Clear.

When it clicks it is the most satisfying puzzle here. **7.5/10**.

## Seven

Seven by seven well, NEXT 4, Classic/Blitz/Daily. Sheet: tap a column to drop, a disc pops when its number
equals how many discs are in its line, grey eggs crack when a disc pops beside them. I tapped columns half at
random and still scored 5,043 with a "Chain of 5! +Undo" toast, then "The well overflowed. Undo the last
drop to keep going, or end the run." That end card is clear and kind.

28. [should-fix] Random tapping scored big because chains fire by themselves. I never felt I caused the
    chains, so the score felt like luck. Highlighting which disc is about to pop (or showing the line count)
    would let me plan.
29. [should-fix] NEXT sometimes shows "egg". I did not know if I was dropping an egg or if eggs drop
    themselves. The sheet never says I drop eggs.
30. [nit] The "Chain of 5! +Undo" toast sits on top of the level line and hides "Level ... drops until the
    eggs rise".
31. [nit] "Line" in "how many discs are in its line" means row or column; a stranger reads it as row only.
32. [nit] "Level 1 · 20 drops until the eggs rise": I did not know what rising eggs would do to me until a
    whole grey row appeared.

**6.5/10**. Pretty and lively, but I could not tell skill from luck.

## Nine

Three big tiles with dot pips (7, 2, 8). "Tap a tile, then choose how many to take", a minus/plus stepper,
"Take 3 from the 6", Take. Very clear. On Easy I won my first match 3-2 even taking half of the biggest pile
each time. "New best ... Next match: 4 tiles", so it grows. Then I tapped "Learn".

33. [should-fix] "Learn" shows "nim-sum", binary like 1001 ^ 0011 ^ 0111 = 1101 (13), and "dropping every
    carry". That is a maths lecture, not a hint. A stranger wants "take 3 from the 6" as a suggested move,
    with the why tucked away.
34. [nit] The "+" stepper button stayed with a teal square highlight after tapping, looking like a stuck
    focus box.
35. [nit] The subtitle says "Take the last tile to win" but the pips mean you take dots, not tiles. Tile
    versus pip versus "take" mixed me up for a moment.

**7/10**. Easy is winnable, the controls are the clearest of the vs games.

## Fifteen

Nine tall cards 1 to 9, "Round 1 of 5. Your turn. Claim any number." I pick, the computer picks, my cards
turn yellow with YOU, its cards blue with COMPUTER. Win with three of mine adding to fifteen. I won 3-2 on
Easy. Then I found the Grid toggle: "Same board: every line adds up to 15", a magic square. That was the
best moment of the whole session; it is tic-tac-toe in disguise.

36. [should-fix] The Grid view is the "aha" and it is hidden behind a small toggle under the board. Mention
    it in the how-to or flash it after the first round.
37. [nit] In Numbers view the YOU/COMPUTER labels on the cards are tiny; I had to squint to add up my own
    three.
38. [nit] "Round 1 of 5" plus "first to 3" says the same thing twice in two different ways.
39. [nit] Trophy chips clipped on the round card (see 16).

**7.5/10**.

## Sudoku

The classic grid with a timer, Easy/Medium/Hard/Daily, a number pad with how many of each are left (small
digits), Notes, Erase, and power-ups Undo (infinite), Reveal 1, Check 0, Candidates 0. A wrong digit painted
both clashing 2s red at once, which is exactly what I want. Filling cells earned Candidates ("18 cells
filled: +Candidates"). Solved card: "Solved 0:05 on Easy · No power-ups used. New best." Daily from the hub
opens straight into Daily.

40. [nit] The "18 cells filled" toast covers the difficulty buttons for a moment.
41. [nit] "Undo ∞" as a tiny infinity glyph in a badge is easy to misread as "oo".
42. [nit] Remaining-count digits on the pad are very small on a phone.

Most familiar, most polished. **8.5/10**.

## Desktop

The same layout centres nicely; on Two the arrow keys work. The how-to sheet becomes a centred card that
covers the mode buttons (Seven: Classic/Blitz/Daily) until closed. No console errors anywhere in my session.

## Could I win at the default level?

Two, Fibonacci, Three, Seven: no win by design, the end states are stated (Three's is too quiet). Four: yes,
but only after I started blocking the blue ring. Five, Nine, Fifteen: yes on Easy, first try. Six: first
line yes, second line needed the hint. Sudoku Easy: yes.

## Top findings

1. [should-fix] Music and sound on by default, mute only behind an unlabelled icon (1).
2. [should-fix] Trophies show only what you earned; nothing to chase (5).
3. [should-fix] Trophy chips cut off behind the buttons on win cards in Four, Five, Nine, Fifteen (16).
4. [should-fix] Three's run ends with a single quiet line; "rainbow flush" never explained (12, 13).
5. [should-fix] Nine's "Learn" is binary nim-sum jargon (33).
6. [should-fix] Six's second line can be the hard five-4s puzzle (24).
7. [should-fix] Seven's chains feel like luck; NEXT "egg" unexplained (28, 29).
8. [should-fix] Five's two score pairs (rounds vs matches) read as one (20).
9. [should-fix] Fibonacci's "2584 with no top tile" subtitle is a riddle (9).
10. [should-fix] Fifteen's magic-square Grid view, the best idea here, is hidden (36).

## Verdicts

| Game | Score |
|---|---|
| Landing / collection | 7 |
| Two | 8 |
| Fibonacci | 6.5 |
| Three | 6 |
| Four | 6.5 |
| Five | 7 |
| Six | 7.5 |
| Seven | 6.5 |
| Nine | 7 |
| Fifteen | 7.5 |
| Sudoku | 8.5 |
| **Overall** | **7/10** |

No blockers. Nothing broke, nothing threw an error, every game was understandable within a minute. What is
missing is the pull to come back: a visible list of trophies to chase, a quieter first minute (mute), and
end screens that tell me what happened.
