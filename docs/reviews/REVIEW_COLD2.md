<!-- SPDX-License-Identifier: Apache-2.0 -->
<!-- Copyright 2026 alvations (Melon Lab) -->

# Cold first-timer, round 2

I was handed one link, http://127.0.0.1:8088/, and nothing else. I mostly played on a phone (390x844, touch)
and checked a few screens on a desktop (1280x860). Everything below is what I saw on screen, in the order it
happened. When I say I "won", I mean I worked out the right moves for that game the way a determined player
would, sometimes with pencil-and-paper style calculation on the side, and then played them on the page.

## First ten seconds on the link

The link drops me straight into a game. Big yellow "Numberics", a 4x4 board with two 2s, and a line under the
title: "Endless. There is no top tile. Nine more games below." I recognised 2048 immediately and swiped left
within two seconds. That part works.

What did not work: "Nine more games below" leads to a row of bare words at the bottom: Sudoku, Fibonacci,
Seven, Three, Four, Five, Six, Fifteen, Nine. Sudoku and Fibonacci mean something. The other seven are just
numbers. I had no idea which was a puzzle, which was a duel against the computer, or which was another
sliding game, so I clicked them in order. Every page then turned out to be a different kind of game (drop
discs, connect four, chopsticks, arithmetic, tic-tac-toe, nim). That was a nice surprise each time, but
nothing on the link told me it would be worth clicking.

## Endless (2048 with no ceiling)

What I tried first: swiped. Tiles slid, merged, score went up. Zero friction.

1. [should-fix] A power-up tap right after a swipe is sometimes lost. Steps: play until Boost shows 1, swipe
   down, then tap Boost within about a tenth of a second. Nothing arms. Tap again a moment later and it arms.
   It also happened to me once with Smash right after the board locked: the "Stuck. Use a power-up" line was
   up, I tapped Smash, nothing happened, and I thought the button was broken. On a phone you do swipe-then-tap
   fast, so this is the moment it matters most.
2. [should-fix] The reward toast sits on top of the power-up row. On desktop "New tile 32 +Smash" covered the
   Smash and Swap buttons for a second, exactly when I wanted to look at what I had just earned.
3. [nit] Undo starts at 1, the others at 0 and greyed. I understood "earn them" from the help line ("Every new
   highest tile from 32 up earns a power-up"), and the toast "+Swap" made the link click. Good.
4. [nit] Boost armed state is clear (gold ring on the button and the board, "Tap a tile to double it. Tap Boost
   to cancel."). Swap and Smash say what they do in a tooltip only; on a phone I never see the tooltip, so I
   had to arm them to find out. The status line then explains, which is fine.
5. [nit] The number-key shortcuts (the tooltips say "3: Swap", "4: Boost") are not in the help text, so a
   desktop player never learns them.
6. Delight: when the board locked I got a calm "Stuck. Use a power-up to keep going." instead of a game-over
   wall, and Boost on a 2 next to a 4 got me unstuck. That is the best moment in the whole site.

Could I win? There is no win; that is the point. My best run reached a 512 tile (6,924 points) before I was
stuck for good. I would come back to this one.

**Endless: 8/10.**

## Sudoku

Ten-second test: passed. A puzzle, Medium preselected, a number pad with "how many left" counters under each
digit. I tapped a cell, tapped a digit, it went in.

1. [nit] A wrong digit that does not clash with anything shows no red. That is fair (the help says Check is a
   power-up), but on the first wrong entry I was not sure if the game had noticed. One word in the help line
   ("only clashes show red") would settle it.
2. [nit] Undo shows an infinity badge while the other three show counts. Fine once you get it, but it looks like
   a different kind of button.
3. Delight: the "Solved. 0:07 on Medium, No power-ups used. New best." card. Clear and proud. The board under it
   is dimmed but readable.
4. [nit] Power-ups earned while solving (Reveal went 1, 2, 3; Check 0 to 1; Candidates 0 to 2) never got used,
   because I did not need them. Fine.

Could I win? Yes, solved a Medium puzzle. Reload kept my puzzle and entries.

**Sudoku: 8.5/10.**

## Fibonacci

Looks identical to Endless with different numbers. The help line explains it: "Neighbours in the sequence
merge: 1+1, 1+2, 2+3, 3+5".

1. [nit] Two 13s next to each other do not merge. The rule says so, but my thumb kept expecting it. It took
   me about thirty moves to stop trying.
2. [nit] The "New tile 13" toast covers the top row of the board for a moment, and once covered a tile that was
   still sliding in.
3. I played 600 moves without getting stuck and reached 377. Feels gentler than Endless.

Could I win? No win state; I stopped at 377 because nothing was changing. Fine but samey after Endless.

**Fibonacci: 7/10.**

## Seven

Ten-second test: half. A 7x7 well with coloured numbered discs and grey ones, a ghost circle over the middle
column, "NEXT 4". The help line is good: "A disc pops when its number equals the length of its line across or
down. A grey disc is an egg: two pops beside it open it into a number." I had to read it twice, then it
clicked and the first chain was a real "oh!" moment.

1. [should-fix] My game ended "The well overflowed" with Hold 4, Smash 1, Crack 1 unused. There is no warning
   that the well is nearly full and nothing nudges me toward the power-ups I am hoarding. Endless says "Stuck.
   Use a power-up"; Seven just ends.
2. [nit] Cracked eggs show a small zig-zag mark. I worked out it means "cracked once" only by watching it.
3. [nit] In Blitz the NEXT box shows a grey egg at the start. I first thought the box was empty or broken.
4. Delight: "Chain of 4! +Crack". Popping chains feels great, and the level dots under the board make the
   rising eggs feel fair.

Could I win? No win state. I reached level 9, 16,143 points, with a careful "best pop" strategy.

**Seven: 7.5/10.**

## Three

The only game that greets me with a rules card ("How Three works") and a Play button. The card is good
(1 + 2 = 3, 3 + 3 = 6, 3 + 6 = 9, flush 3-6-9), but it is a lot to hold in my head before the first swipe.

1. [should-fix] I died fast. 61 moves, 501 points, stuck with only Undo in stock. The "neighbouring multiples
   merge" rule means the numbers stop following any pattern I can predict (15, 30, 33), and I could not plan.
2. [should-fix] The colour laps hurt reading. 30 is the same yellow as 9, and 33 is green with a white ring.
   At a glance I kept reading the board by colour and getting it wrong. The card warns about this ("Past 21
   the colours start again with a ring") but warning me does not make it readable.
3. [nit] Tiles move only one step per swipe, unlike the two games I had just played. The card says so, and I
   still swiped expecting a full slide the first few times.

Could I win? No win state. My best was 501 before I was stuck. This is where I would quit first.

**Three: 6/10.**

## Four (vs the computer, Medium by default)

Ten-second test: half. It looks like Connect Four, which I know. Then the subtitle: "Four in a row, or four
that make ten." The status line shortens it to "Four of yours in a row, or a 10 with two of yours", which I
did not understand until I read the long help text.

1. [should-fix] When the game ends, the overlay dims the board so heavily that I cannot see the winning line.
   The text says "3 + 4 + 1 + 2 = 10" but I could not find those four discs on the faded board. When I lose, I
   want to see how.
2. [should-fix] Ten-lines feel like ambushes. Any four in a row of any colour can count for the computer if two
   are its own, so my own discs help it. I played carefully: always took a win, always blocked a computer win
   I could see one disc ahead, using the "COMPUTER" box that shows its next number. Result on Medium: won 1,
   lost 2, both losses to ten-lines. Beatable, but the losses felt like I had missed something invisible rather
   than been outplayed.
3. [nit] The ghost disc in the column I am aiming at shows my next number. Nice. But "HELD none" and "Tune" mean
   nothing until I earn them.

Could I win? Yes, once in three games on Medium.

**Four: 6.5/10.**

## Five (vs the computer, Medium)

Ten-second test: half. Four tiles showing 1, "The computer is thinking...", then one of my tiles became a 2.
I did not know what had happened until I read "Tap your tile, then any tile to add its value onto it". This
is the old chopsticks hand game. Once I tapped my 2, the status line said "Add 2 onto which tile? Your own
other tile counts." That prompt is excellent.

1. [should-fix] "At 5 it bursts" is not the whole rule. A 4 plus a 3 also bursts. I assumed it had to land on
   exactly 5 and planned around that for my first round. "At 5 or more" would have saved me.
2. [should-fix] "The computer goes first, so perfect play always wins." I read this as "the computer always
   wins" and nearly left. It means I can always win as second player. Say "you can always win" outright.
3. [should-fix] The end-of-round overlay hides the final board. I lost my first two rounds and could not see
   which tile went over.
4. Fairness: playing naively on Medium (always hit their biggest tile with my biggest) I split two matches,
   one won 3-2 and one lost 0-3. Playing it out properly I won three matches in a row, all 3-0. So Medium punishes careless play and rewards thinking. That is fair.

Could I win? Yes, after I worked out the counting.

**Five: 7/10.**

## Six (make the target from three numbers)

Ten-second test: passed. "make 6" in gold, three 3s with "?" gaps between them. Tap a gap: +. Tap again: −.
I made 3 x 3 − 3 = 6 in about fifteen seconds and felt clever.

1. [should-fix] The difficulty wall arrives in round 1. Lines 1 to 4 were 3 3 3, 2 2 2, 5 5 5, 7 7 7, all
   gentle. Line 5 was 1 1 1, which needs (1 + 1 + 1)! with a bracket and a factorial on the bracket, and line 6
   was 8 8 8, which needs a square root of a square root. A newcomer meets nested roots before finishing the
   first tier. I used my one Hint ("the 1st gap is +") and was still stuck.
2. [should-fix] The hint toast covered the status line. The line underneath said "This ends the Climb run. Tap
   again to show it." and I only saw half of it, then tapped "Show answer" again and lost my run.
3. [nit] BEST shows 1 before I have played anything.
4. Delight: the Brackets tool is guided ("Tap the first number to group", "Now tap the last number of the
   group"), and tapping the bracket bar to put a √ on the whole group is lovely once found. "= no exact value"
   is a polite way to say "not like that".

Could I win? No. I cleared 4 of 6 lines of tier 1 and stalled on 1 1 1.

**Six: 6.5/10.**

## Fifteen (vs the computer, Medium)

Ten-second test: passed. Nine big numbers, "Your turn. Claim any number." Claimed tiles get a "YOU" or
"COMPUTER" label. Then I tapped Grid and the numbers rearranged into a magic square with the toast "Same
board: every line adds up to 15." That was the best "aha" on the site: it is tic-tac-toe in disguise.

1. [should-fix] That toast also lands on top of the power-up row and status line.
2. [nit] Medium felt soft. It answered my opening 1 with a 3 and let me win three rounds of four (one draw). I
   won the match 3-0.
3. [nit] The help text is long (five lines on a phone) and includes "Hard never slips, so you start with an
   Erase there". Good info, wrong moment.

Could I win? Yes, 3-0 with one draw.

**Fifteen: 7.5/10.**

## Nine (take the last tile, vs the computer)

Ten-second test: half. Three coloured tiles (4, 3, 9) with dot pips, "Your turn: lower one tile." I tapped the
9 and the bar said "Take 8 from the 9". I had expected it to start at 1.

1. [should-fix] Nine starts on Easy, every other duel starts on Medium. When I moved on from Fifteen the
   difficulty silently dropped.
2. [nit] Default take is "all but one". Hollow pips for what is taken and filled pips for what stays is clear
   once I saw it.
3. [nit] "Take the last tile to win" in the subtitle vs "lower one tile" in the status: two ways of saying the
   same thing, and I wondered if lowering and taking were different actions.
4. Delight: Learn shows the binary trick (nim-sum) right on the tiles. It basically hands me the strategy,
   which is generous.
5. Fairness: random moves on Easy still won a match 3-2. With the trick I won 3-0 twice and the match grew to
   four tiles.

Could I win? Yes.

**Nine: 7/10.**

## Across the whole site

1. [should-fix] Game names say nothing. Seven of the ten are just numbers. A one-line tag next to each link
   (or the subtitle each game already has, like "Four in a row, or four that make ten") would have told me
   where to go.
2. [should-fix] Toasts cover controls everywhere: Endless (desktop, power-up row), Fibonacci (top board row),
   Six (status line), Fifteen and Seven Blitz (power-up row and status).
3. [should-fix] End-of-game overlays in the duels (Four, Five) hide the board I just lost on.
4. [nit] Every game is consistent: same header, same four power-up slots, same link row. Once I learned one,
   the layout of the others was free. That consistency is the site's quiet strength.
5. [nit] On desktop each game sits in a narrow column in the middle of a wide screen. Fine, just empty.
6. No errors in the console on any page I opened.

Where I would quit: Three (died fast and could not read the colours), then Six at the 1 1 1 line. Where I
would come back: Endless, Sudoku, Seven, Fifteen.

| Game | Score |
|---|---|
| Endless | 8 |
| Sudoku | 8.5 |
| Fibonacci | 7 |
| Seven | 7.5 |
| Three | 6 |
| Four | 6.5 |
| Five | 7 |
| Six | 6.5 |
| Fifteen | 7.5 |
| Nine | 7 |
| **Overall** | **7** |
