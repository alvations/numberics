<!-- SPDX-License-Identifier: Apache-2.0 -->
<!-- Copyright 2026 alvations (Melon Lab) -->

# Cold first-time player, round 1

Someone handed me one link, http://127.0.0.1:8084/, and nothing else. I played mostly on a phone-sized
screen (390x844, touch) and checked a few pages at desktop size (1280x860). I only know what the pages
showed me. Everything below is in the order it happened.

## First contact: the link itself

I expected a home page. I got a 2048 board straight away, with a big gold "Numberics" at the top and
"Endless. There is no top tile." under it. So I assumed the site was a 2048 clone called Numberics.
Only after scrolling my eyes down past "New game" and the help text did I see a row of small underlined
links: Endless, Sudoku, Fibonacci, Seven, Three, Four, Five, Six, Fifteen, Nine. Ten games. Nothing on
the page told me that before I found the links.

1. [should-fix] The link opens a game, not the collection. "Numberics" reads as this game's name, and the
   other nine games are a line of small grey links under the help text. On desktop that line sits just
   above the fold; on Sudoku at 1280x860 it is below the fold entirely. A stranger can easily play Endless,
   leave, and never know there were nine more games.
2. [nit] The game names (Seven, Three, Four, Five, Six, Fifteen, Nine) tell me nothing about what each
   game is. I clicked them in order out of curiosity, not because any of them sounded fun.
3. [nit] Endless is titled "Numberics" while every other page is titled with its own name ("Sudoku",
   "Seven") and shows "Numberics" as a small link. Endless is the odd one out.

## Endless (the home page)

Within 10 seconds: yes. Two 2s on a 4x4 board, "Slide with arrow keys, WASD or a swipe". I swiped left,
the 2s slid, a new 2 appeared. I knew this game already.

What I tried first: swiping. It worked on touch and the page did not scroll under my finger. Keys worked
too. A few hundred moves in I had a 256, score 2,500, and the board locked. A gold line said "Stuck. Use a
power-up to keep going." That was good: it told me the next thing to do instead of just ending.

Power-ups: I had Smash, Swap and Boost by then, earned along the way (a toast said "New tile 256 +Smash").
I tapped Smash: "Tap a tile to smash it. (Esc cancels)", the board got a gold outline, I tapped a tile, it
vanished. Swap: "Tap two cells to swap them." Boost: "Tap a tile to double it." All three made sense
without any explanation, which is the best thing I can say about any power-up. Undo gave the Boost back,
so it is not a free farm. Tapping New game asked "Sure? This ends the run" instead of wiping my game. A
reload kept my board. All good.

4. [should-fix] Before I own a power-up the buttons are just "Smash 0", "Swap 0", "Boost 0", dimmed, with no
   hint of what they do. On desktop the hover text is only "2: Smash" (every other game has a sentence
   there, e.g. Fibonacci's "Move a tile to the next Fibonacci number"). On a phone there is no hover at
   all. I only learned what they do by earning one and tapping it.
5. [nit] "(Esc cancels)" is shown on a phone where there is no Esc key.
6. [nit] The earn toast ("New tile 256 +Smash") sits low on the screen over the game links and was half
   faded by the time I looked at it.

Delight: power-ups arriving at 32, 64, 128 feel like a reward. Quit point: I would keep going for a while.
This is the strongest page on the site.

**Endless: 8/10.**

## Fibonacci

Within 10 seconds: mostly. Same 2048 layout, tiles 1 and 1, help says "1+1, 1+2, 2+3, 3+5 and on". I got
it after reading the help, not from the board. I played until stuck at 377, score 5,500.

7. [nit] Colour does not help me read the sequence: 3 is green, 8 is purple, 21 is pink, 233 is teal, with
   no visible order. In Endless I learned "warmer is bigger"; here I had to read every number.
8. [should-fix] Boost here means "move a tile to the next Fibonacci number", which is a different power
   from Endless's "double it" under the same name and icon slot. Fine once you know, but the only place
   that says so is the desktop hover text.

Felt like a clever variant, not a new game. **Fibonacci: 7/10.**

## Sudoku

Within 10 seconds: yes, it is Sudoku. Tap a cell, tap a digit on the pad. The little number under each
pad digit is how many of that digit are left; I worked that out after a few placements, it is never said.

What happened: I put a digit that was already in the row; it turned red. Clear. I then filled the whole
puzzle. Every finished row, column or box popped a toast like "Unit complete: +1 Check". By the end I had
Reveal 3, Check 9, Candidates 8. A "Solved" card said "0:09 on medium, pure: no power-ups".

9. [should-fix] Power-ups pile up far faster than you can use them. Completing units is what solving
   Sudoku *is*, so by the middle of the puzzle I had more Checks and Candidates than empty boxes. They stop
   meaning anything.
10. [should-fix] After "Solved", Undo (shown as infinite) is still live. I tapped it: the last digit
    disappeared, the Solved card vanished and the board was open again. I expected a solved puzzle to stay
    solved.
11. [nit] "Unit complete" is solver jargon. "Row done", "Box done" would read better.
12. [nit] The "Solved" card covers the middle of the finished grid, and the toast sits on top of the game
    links at the bottom, so both pop-ups hide something.
13. [nit] "pure: no power-ups" is odd wording for a congratulations.

**Sudoku: 7/10.**

## Seven

Within 10 seconds: no. A 7-wide well of dark circles, a few coloured numbered discs, a "NEXT" slot that
showed a plain grey disc. The help says "A disc pops when its number equals the length of its line across
or down". I had to read that twice. I just started tapping columns; discs popped and the score jumped, and
after ten or so drops I understood it.

What happened: In Classic I reached level 5 with 2,549 points before "The well overflowed". Second try:
level 7, 5,012. A translucent ghost disc shows where the next one will land, which helped a lot. Switching
to Blitz showed a toast "Blitz: eggs rise every 5 drops"; switching back to Classic restored my run. Good.

14. [should-fix] The game-over board looks wrong. Behind "The well overflowed" the discs sit in the top
    rows and the bottom rows are empty, as if everything fell upward. I could not tell how I actually
    lost.
15. [should-fix] The "NEXT" slot sometimes shows a blank grey disc. I did not know that meant an egg was
    coming, or what an egg's number would be.
16. [nit] Crack fires instantly when tapped, with no target and no confirm, unlike Smash in the same row.
    I spent one by accident while trying to see what it did.
17. [nit] Several times the BEST box showed a lower number than SCORE for a moment (score 3,965, best
    3,897) while pops were still animating.

Delight: a chain of pops is satisfying. Quit point: probably after the second overflow, once I
realised I didn't understand why eggs were filling my well. **Seven: 7/10.**

## Three

Within 10 seconds: no. Board of 1s, 2s and 3s; help says "every tile moves one step. 1 and 2 make 3; equal
or neighbouring multiples of 3 merge. Line up 3, 6, 9 to Flush it". I guessed it was Threes.

What happened: I swiped around for about 90 moves and got stuck at 951 points. Along the way tiles like
15, 18, 30 and then **123** appeared. At the end two tiles (123 and 30) had glowing borders and I have no
idea why.

18. [blocker] I could not work out the merge rule from play. "Neighbouring multiples of 3" is not
    something I can see on the board, and a 123 tile appearing made me think the game was broken. I
    never saw a "Flush" happen, so the headline mechanic never revealed itself to me.
19. [should-fix] Highlighted tiles (gold and white borders) are never explained.
20. [nit] Swap here is "trade two neighbouring tiles" and Third is "turn a 1 or 2 into a 3": both are
    only in the desktop hover text.

Quit point: around move 40, honestly. I kept going only because I was reviewing. **Three: 4/10.**

## Four

Within 10 seconds: half. Connect Four with numbered discs. The gold line says "Four of your colour, or any
four that sum to 10." I understood "four in a row". I did not understand how much the second rule would
matter.

What happened: Medium, I lost in 4 moves. "The computer wins. A ten-line after 6 discs." Then again in 4
moves. The computer finished a ten-line made mostly of *my* discs. On Easy I won 1 game out of 6, losing
most in 4 to 7 moves.

21. [blocker] The "any colours sum to 10" rule makes the opening a minefield for a newcomer: every disc
    I drop can be the third piece of a ten-line the computer completes. Losing on move 4 before I
    understand the rule felt unfair, even if it is technically fair. Easy should not punish this so fast.
22. [should-fix] The winning line is not highlighted. The board is dimmed behind the result card, so I had
    to add numbers myself to see which four made 10.
23. [should-fix] Mine vs the computer's is only a thin gold vs blue ring around each disc; the fill colour
    is the number. At a glance every disc looks the same colour family.
24. [nit] "A ten-line" is jargon the help text never uses.

**Four: 5/10.**

## Five

Within 10 seconds: no. Two tiles each, "Your turn: tap one of your tiles." By the time I looked, my tiles
were already 2 and 1: the computer had moved first. The help ends with "The computer always opens: the
solved game gives the second seat the win." I read that three times.

What happened: I tapped my tile, then a computer tile; their tile went up by my value. Then the computer
hit back and my tile burst at 5 and left a dashed empty slot. I got it after one round. On Medium I lost a
round quickly. On Easy, playing "burst theirs if I can, otherwise hit the big one", I lost the match 1-3.

25. [should-fix] "the solved game gives the second seat the win" is math-paper language. As a player I
    read "the computer is supposed to lose", and then I lost.
26. [should-fix] Easy still beat me 3-1 with a sensible greedy approach. I could not feel any difference
    in Easy.
27. [nit] The help says "best of five" while the result card says "first to 3". Same thing, two phrasings.
28. [nit] What Split, Shield and Nudge do is only in hover text ("move one point to your other tile", "a
    tile cannot be hit next turn", "+1 on their tile or -1 on yours"). These are the most interesting
    powers on the site and a phone player never sees what they do.

**Five: 4/10.**

## Six

Within 10 seconds: yes for the goal (a gold "make 6" and three numbers with "?" gaps), no for the method.

What happened: my first line was 9 ? 9 ? 9. I cycled through every + − × ÷ combination; none gives 6.
I needed a square root *and* brackets: (9 + 9) ÷ √9. Tapping a number added a tiny √ badge, and Brackets
then two taps grouped the first two numbers with a blue underline. The moment the sum hit 6 it said
"Made 6. Next line" by itself. That was a genuinely good feeling. Line 2, 6 ? 6 ? 6, was trivial. Line 3,
4 ? 4 ? 4, needed √ again; my one Hint said "the 1st gap is +".

29. [should-fix] Line one can need every tool (√ and brackets) at once. The very first line should be
    solvable with + − × ÷ only, so the tools are introduced one at a time. My puzzle changed on every
    reload, so some newcomers get 3 ? 3 ? 3 (easy) and some get 9 ? 9 ? 9 (hard).
30. [should-fix] The "Answer" button reads like "submit my answer". It actually gives up: "Sure? Ends the
    run". I nearly ended my run on line one.
31. [nit] The √ marker is a tiny white badge on the tile's corner; easy to miss.

**Six: 7/10.**

## Fifteen

Within 10 seconds: yes. Numbers 1 to 9, "Hold any three that add up to 15 to win the round". Tap a number,
it gets YOU; the computer replies instantly with CPU.

What happened: on Medium I played without blocking and lost 0-3; the computer's winning three (1 + 6 + 8)
lit up and mine dimmed, so I could see exactly why. On Easy, blocking when I had to, I won 3-0. On Hard
every round was a draw. Then I pressed Grid: the numbers rearranged into a 3x3 square and a toast said
"Same board: every line adds up to 15." It is tic-tac-toe. That reveal was the best moment of my whole
session.

32. [should-fix] On Hard a careful player draws every single round. Five draws in a row is a long, flat
    match with no way to win; I would have quit after round three.
33. [nit] In Grid view there are short stray line segments between the cells, like a grid that did not
    finish drawing.

**Fifteen: 8/10.**

## Nine

Within 10 seconds: yes. Three tiles with pips (3, 2, 9), "Take the last tile", tap a tile, + and - to set
how many, Take. Very clear controls.

What happened: playing "take one each time" on Hard, I lost 0-3 and got "Run over". Then I pressed Learn:
each tile showed a binary number and a line read "Nim-sum 0011 ^ 0101 ^ 1000 = 1110 (14)". I happen to know
Nim, so I played to make that sum zero. I won six rounds in a row, 3-0 on Easy and 3-0 on Hard, with 3
and 4 tiles. Every single round I was dealt a winning position.

34. [should-fix] Once you know the trick, Hard is a guaranteed sweep, because the deal always gives the
    player the winning side and Learn shows the exact number to aim for. There is no challenge left.
35. [should-fix] Learn assumes I read binary and know what "^" means. It shows the nim-sum but never says
    "make this zero". For someone who does not already know Nim, it explains nothing.
36. [nit] "Win a match to unlock Misere" teases a mode with a name most people cannot pronounce or
    explain.

**Nine: 6/10.**

## Things that held across every game

37. [should-fix] Power-up meanings live only in desktop hover text. On a phone (where swipes are
    advertised) nine of ten games show four mystery buttons labelled "0". The prompts that appear after
    tapping are great; the problem is before.
38. [nit] Toasts land on top of the game links at the bottom of the screen in most games.
39. Good: no errors in the console on any page, nothing broke when I reloaded, every destructive button I
    found (New game, Answer) asked first, and switching modes kept my runs.

## Verdict

| Game | Score |
|---|---|
| Endless | 8/10 |
| Fibonacci | 7/10 |
| Sudoku | 7/10 |
| Seven | 7/10 |
| Three | 4/10 |
| Four | 5/10 |
| Five | 4/10 |
| Six | 7/10 |
| Fifteen | 8/10 |
| Nine | 6/10 |

**Overall: 6/10.** It looks clean and consistent, and it never crashed. Endless, Fifteen and Six each gave
me a real "oh, nice" moment. But as a stranger I nearly missed that the other nine games exist. Three of
the ten (Three, Four, Five) lost me before I understood them. And the computer opponents are either
punishing (Four, Five) or beatable every time once you know the trick (Nine, and Fifteen drawn forever on
Hard).
