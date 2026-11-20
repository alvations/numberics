<!-- SPDX-License-Identifier: Apache-2.0 -->
<!-- Copyright 2026 alvations (Melon Lab) -->

# Cold first-timer, round 3

Someone sent me one link: `http://127.0.0.1:8092/`. Nobody told me anything else. I played on a phone
(390 x 844, touch) most of the time and on a desktop browser for a few checks. Everything below happened
in the order I write it. Where I say "I played N games", I played them right then on the default level
unless I name another one.

## The home page

The first thing I saw was a 2048 board with "Numberics" over it and "Endless. There is no top tile.
Nine more games below." I got it in about two seconds: it is 2048. I swiped before I read anything else.

I had to scroll past the whole board and the rules to find the other nine games. They are cards in a
two-column grid: Sudoku, Fibonacci, Seven, Three, Four, Five, Six, Fifteen, Nine.

1. [should-fix] **Most of the game names don't tell me what the games are.** Sudoku and Fibonacci are
   fine. "Seven", "Three", "Four", "Five", "Six", "Fifteen" and "Nine" are numbers, and the one-line
   descriptions don't help much. "Drop discs; a number pops when it fits its line" and "Count in threes,
   line up rainbow flushes" meant nothing to me until I opened the games. "Four in a row, or four that
   make ten" was the only one that told me what kind of game it was (Connect Four). I picked games in
   grid order because I couldn't tell which ones I would like.
2. [should-fix] **The cards don't say which games are against the computer.** Four, Five, Fifteen and
   Nine are matches against the computer. The rest are solo score chasers or puzzles. That is the first
   thing I would want to know when choosing, and no card says it.
3. [nit] On a desktop the home page is a narrow column with a lot of empty space on both sides, and
   none of the nine cards show above the fold. "Nine more games below" is the only hint they exist.
4. [nit] The empty strip between the power-up row and the board (it is where messages appear) looks
   like a layout gap whenever there is no message.

Could I tell what each game was and pick one I wanted? For Endless, Sudoku, Fibonacci and Four, yes. For
the other six, no. I had to open each one to find out.

## Endless (home page) 8/10

Ten seconds: yes. It is 2048, and a swipe on the board just works.

- What I tried first: I swiped down and right over and over, the usual 2048 corner strategy. I got to
  128 and 1,420 points before I stalled.
- Delight: "New tile 32 +Swap" appears as a gold pill when I earn something. The Smash prompt is clear:
  the button gets a gold ring, the board gets a gold outline, and it says "Tap a tile to smash it. Tap
  Smash to cancel."
- Stuck state: "Stuck. Use a power-up to keep going." and a gold board outline. That is a good way to
  say it isn't over yet.

5. [should-fix] **My first tap on a power-up I had just earned did nothing.** I reproduced it twice with
   Swap. The move that earned it showed "New tile 64 +Swap", and I tapped Swap right away. The count
   stayed at 1, no prompt appeared, and the board just finished its move (two 32s became the 64). The
   tiles I tapped after that did nothing. A second tap on Swap armed it ("Tap two cells to swap them").
   It looks as if the first tap only finishes the animation. That is exactly when I want to use the new
   toy, and the game eats the tap without saying anything. When I waited 2.5 seconds before tapping
   Smash or Boost, they worked on the first tap.
6. [nit] A stranger won't know what "except on the move right after you use one" means until they hit it.

When would I quit? I wouldn't. I would play this one on the bus.

## Sudoku 8/10

Ten seconds: yes. It is a sudoku grid with a number pad, and Medium is preselected.

- What I tried first: I tapped an empty cell and then a digit that was already in the row. The digit
  turned red and so did the one it clashes with, and its row, column and box got a highlight. That is
  clear without being preachy.
- I solved the puzzle in full. The board dims, and "Solved / 0:10 on Medium · No power-ups used / New
  best." appears with a gold New puzzle button. The small counts under each digit on the pad (how many of
  that digit are left to place) are a nice touch.

7. [should-fix] **I earned a power-up by entering wrong answers.** The rules say "Every 9 cells with no
   clash earns a power-up." I typed 9 digits that broke no rule but were wrong (they are not in the
   solution), and Reveal went from 1 to 2. Then I erased all 9 and kept the Reveal. That is what the
   rule line says, and it probably keeps the reward from giving away which digits are right. As a
   player, though, it felt like being paid for junk: 9 fast guesses, erase them, and I have a Reveal,
   which fills a cell with the right answer. I didn't need to try that more than once.
8. [nit] Undo shows a 1 badge at the start and an infinity sign once I have placed a digit. I didn't know
   whether Undo was limited or not.
9. [nit] On the solved screen the dimmed grid is so dark that I couldn't admire my finished board behind
   the overlay.

When would I quit? Probably never: it is a good, clean sudoku.

## Fibonacci 6/10

Ten seconds: mostly. It is the Endless board with 1s, and "Neighbours in the sequence merge: 1+1, 1+2,
2+3, 3+5".

- What I tried first: the same corner swiping as in Endless. I got to 89 and 1,006 points.
- Where it went wrong: my game ended with a row of **13 13 13 13** and a pair of **2 2** side by side,
  and the game said "Stuck."

10. [should-fix] **Equal tiles don't merge here (except 1 + 1), and nothing on the board warns me.**
    After Endless, my hands assume that two of the same number merge. Four 13s in a row that can't
    merge, with "Stuck" underneath, felt like a bug until I reread the rules. The rules list the pairs
    that do merge. They never say that 2+2 or 13+13 won't.
11. [nit] BEST says "0" on a fresh page here and in Seven, but Endless and Sudoku say "none".
12. [nit] I earned two extra Undos (Undo 3 at the end) but never a Smash, Swap or Boost, so I hit
    "Stuck" with only Undo. Undo when stuck mostly takes me back to the same dead end.

When would I quit? At the first "Stuck" with four equal tiles in a row. That one felt unfair, even
though the rules allow it.

## Seven 7/10

Ten seconds: half. I saw a well of coloured numbered discs and a NEXT disc. "Tap a column" is clear.
"A disc pops when its number equals the length of its line across or down" took me two reads.

- What I tried first: I tapped columns almost at random. Discs popped, chains happened, and I scored
  3,006 on my first try and 7,447 on my second, at level 5. That was fun, but random taps shouldn't
  score that well.
- End: "The well overflowed / Score 7,447 · level 5 / New best." with See the well and New game. Clear.

13. [should-fix] **The game ended with 5 Undos, 2 Holds and 2 Cracks unused, and I couldn't undo the
    drop that lost.** All four power-up buttons go dead the moment the well overflows. If I am holding
    five Undos, the losing drop is the one I want back.
14. [should-fix] **The preview disc looks like a real disc.** The faded "6" (phone) or olive "1"
    (desktop) at the bottom of the aimed column looks like a disc already on the board. I counted it
    when I worked out line lengths, which is the one thing this game asks me to count.
15. [nit] In one game the "That column is full" toast sat on top of the status line and covered
    "Overflowed: the ringed discs are pushed out", so I read half of each.
16. [nit] Power-ups seem very generous: Undo went from 1 to 5 in one run of random tapping.

When would I quit? After a few games, because random play scores fine and I couldn't feel my own skill.

## Three 5/10

Ten seconds: no, but it tried. Unlike the other games, it opens with a "How Three works" card: 1 + 2 = 3,
3 + 3 = 6, 3 + 6 = 9, a "Flush" row, and a Play button. I liked that it showed me before it asked me.

- What I tried first: I swiped every way to see what moves. Every tile slides one step (Threes, not
  2048). I played about 100 moves twice, with 0 flushes both times. Both games ended with "Stuck. Use a
  power-up to keep going." and then "No moves left · Score 417 · 0 flushes · 1 power-up".

17. [should-fix] **The card contradicts itself.** It says "Equal tiles merge", and then it says 3 and 6
    are "the only pair that is not equal". 1 + 2 is also a pair that is not equal, and it is the first
    line on the same card. Then my boards locked with a **2 next to a 2** and **1 next to 1**, which the
    card says should merge. Equal 1s and 2s don't merge (that is how Threes works), and the card never
    says so.
18. [should-fix] **I never saw a flush.** The flush is the headline feature ("line up rainbow flushes"
    on the home card). In two games and about 200 moves I didn't get one, and I couldn't see how to
    build one.
19. [nit] Undo when stuck took me back one move, but the only legal move from there led straight back
    to the same stuck board, so the Undo was wasted.

When would I quit? At my first "Stuck", about 90 moves in, still not sure what I did wrong.

## Four (against the computer, default Medium) 5/10

Ten seconds: yes. It is Connect Four with numbers, and the "four that make ten" twist is right in the
subtitle. YOU, HELD, COMPUTER and RECORD sit across the top, and the YOU disc shows my next number.

- What I tried first: I dropped in the centre. The computer answered in under half a second.
- Delight: the blue ring with "Blue ring: the computer's next disc would win there." is a great
  training wheel. The win screen spells out the sum ("4 + 3 + 1 + 2 = 10").
- I played carefully: I always took a win if I had one, always blocked any spot where the computer
  could win next, and never handed it a winning spot on top of my disc. **On Medium I lost 0-5. On Easy
  I went 2-2.**

20. [blocker] **I couldn't win on the default level.** The ten rule lets the computer use my discs: any
    four in a row that make ten, two of them its own. So threats show up on diagonals made of mixed
    colours, and I couldn't see them coming. The ring only marks a spot where the computer can win right
    now. It doesn't show a double threat being set up, and that is how I lost every game on Medium. A
    first-timer needs Easy as the default, or a Medium that doesn't spot ten-sum forks so well.
21. [should-fix] "Discs are mostly 1s", but my first discs were 3, 4 and 2, and the computer's were 4
    and 2. It didn't feel like "mostly 1s".
22. [nit] "YOU 3" here means my next disc. In Five, Fifteen and Nine the same "YOU" box is my round
    score. Same label, different meaning, in the same family.

Did the computer feel fair? It felt like it could see sums I couldn't. That is not unfair, but on the
default level it is too strong. When would I quit? After the third loss in a row.

## Five (against the computer, default Medium) 7/10

Ten seconds: no. "Tap your tile, then any tile to add its value onto it" made me wonder whose value
lands on what. Then I tapped my tile and the prompt said "Add 2 onto which tile? Your own other tile
counts." That cleared it up in one step. Good live help.

- What I tried first: I added my big tile onto the computer's big tile, to burst it fast. **Playing that
  way, I lost the match 1-3.** Once I slowed down and thought a few moves ahead, **I won 3-0.** "You can
  always win" is true, and getting there felt earned.
- The computer opens with "The computer is thinking..." before I can do anything. I would have missed
  its first move if I hadn't been watching.

23. [should-fix] **The computer's opening move happens before I know where to look.** I opened the
    page and the computer had already added 1 onto my tile. I would like a short beat, or a highlight
    of what it just did, on its first move of each round.
24. [nit] Shield 1 showed up after I lost round 1, and I don't know why. Nothing on the round screen
    said I earned it.

Did the computer feel fair? Yes. Could I win at the default level? Yes, once I thought ahead. When would
I quit? I wouldn't, soon. It is a good two-minute game.

## Six 6/10

Ten seconds: yes. "make 6", then 3 ? 3 ? 3, and the ? gaps cycle through + − × ÷ when I tap them.

- What I tried first: 3 × 3 − 3 = 6. The tiles turned gold, "= 6" lit up, and "Next line" appeared.
  Satisfying. The next three lines were also plain arithmetic.
- **Line 4 or 5 of round 1** was 7 ? 7 ? 7 ? 7 = 6 (in another run, 4 ? 4 ? 4 ? 4 = 6). No mix of
  + − × ÷ works without brackets.

25. [should-fix] **A brackets wall in the first round.** The header still says "TIER 1 · + − × ÷", so
    I assumed the four operators were enough and tried every combination. Brackets work in two steps:
    tap ( ) Brackets, tap the first number, then tap the last number. That flow is fine once found,
    but nothing told me this line needed it. Then I tapped a number inside my new group, hoping to "tap
    a group to give it a sign", and got √4 on that one number instead.
26. [should-fix] **"Show answer" asks "Sure? Ends run".** That is honest, but I reached for it exactly
    at the brackets wall, where a nudge ("this one needs brackets") would have kept me playing.
27. [nit] √ and ! are available in Tier 1 even though the tier label only lists + − × ÷.

When would I quit? At that first brackets line, if I didn't happen to find the Brackets flow.

## Fifteen (against the computer, default Medium) 7/10

Ten seconds: yes. "Claim three numbers that make fifteen" on a 3 x 3 pad of 1 to 9.

- What I tried first: I claimed 5, then grabbed numbers that blocked the computer's obvious sums.
  **Playing like that (win if I can, block if I must, otherwise anything), I lost 0-3.**
- Then I pressed "Grid". The pad rearranged into a magic square with "Same board: every line adds up to
  15." It is tic-tac-toe in disguise. That reveal was the best moment of my whole session. After that,
  with real tic-tac-toe sense, **I won the match 3-0 (one draw)** on Medium.

28. [should-fix] **The Numbers view looks like a tic-tac-toe board, but its lines are not the winning
    lines.** It is a 3 x 3 grid of 1 to 9, so 1-2-3 looks like a row. I tried to "line up three" before
    I realised that lines on this pad mean nothing. The twist is great, but the first view actively
    misleads.
29. [nit] It's best of five, and with a draw a match can take six rounds. That is a long match for a phone.

Did the computer feel fair? Yes, once I understood the game. Could I win at the default level? Yes,
after the Grid reveal.

## Nine (against the computer, default Easy) 6/10

Ten seconds: no. Three tiles (1, 8, 2), each with a grid of pips, a − / Pick a tile / + bar and a Take
button. "Take the last tile to win" is clear. How to set how many to take was not, until I tapped a tile
and the bar said "taking 7".

- Easy is the default here, while every other match game defaults to Medium.
- What I tried first: take half of the biggest tile. **On Medium, playing like that, I lost 0-3, then
  1-2.** The "Learn" button explains the trick: binary columns and "leave a nim-sum of 0". With that, I
  won 3-0 on Easy and 3-0 on Hard.

30. [should-fix] **"Learn" is a binary-arithmetic lesson.** "Nim-sum: add the binary columns, dropping
    every carry" is correct, and a casual player will bounce off it. Without it the computer seems to
    win by magic. I would like a plainer hint, for example "make two equal piles" for the two-tile
    case, before the binary maths.
31. [nit] Selecting a tile pre-sets an odd amount (8 was set to "taking 7"). I took 7 by accident once.
32. [nit] After I lost a match the screen said "Run over / Best: none". I didn't know a run was a thing
    until it ended.

Did the computer feel fair? Yes. Easy deals me a winning start. Could I win at the default level? Yes,
once I knew the trick. Before that, no.

## Power-ups across the family

They make sense in Endless, Sudoku and Five, where the prompt tells me what to tap next. Every game has a
different set of four (Smash, Swap, Boost, Hold, Crack, Third, Pop, Tune, Split, Shield, Nudge, Erase,
Peek, Double, Add, Pass, Hint, Skip, Candidates, Check, Reveal), so I learn a new vocabulary in every
game. The hover titles explain each one, but a phone has no hover. Things I noticed:

33. [should-fix] **On a phone, a power-up's meaning is only in its tooltip.** On touch I only found out
    what Crack, Third, Tune and Nudge do by tapping them. That sometimes armed one I didn't want, or
    showed a line of help instead.

## Scores

| Game | Score |
|---|---|
| Home page (choosing a game) | 6 |
| Endless | 8 |
| Sudoku | 8 |
| Fibonacci | 6 |
| Seven | 7 |
| Three | 5 |
| Four | 5 |
| Five | 7 |
| Six | 6 |
| Fifteen | 7 |
| Nine | 6 |
| **Overall** | **6.5** |

It is a tidy, consistent family: same dark theme, same gold accents, same power-up row, same overlay on
game over. Nothing crashed, and there were no errors in the page console in any game. Endless and Sudoku
I would keep coming back to. Five and Fifteen won me over once they clicked. Four is too strong on its
default level, Three's own help card contradicts the board, and on the home page I couldn't tell six of
the ten games apart by name.
