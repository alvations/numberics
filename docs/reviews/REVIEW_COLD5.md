<!-- SPDX-License-Identifier: Apache-2.0 -->
<!-- Copyright 2026 alvations (Melon Lab) -->

# Round 5, cold first-timer review

Reviewer 4 (cold first-timer). I was handed only the link (http://localhost:8074/), with no briefing, and I
did not read the code, the docs or earlier reviews. Device: Chromium at phone size 390x844, touch, sound on
(not muted). Every session started with fresh storage. Screenshots were taken and looked at as I went.

## What happened, in order

1. **First screen (home).** It looks warm and tidy, with no ads and no sign-up. The top card reads "Today, Sat,
   Nov 21. Three dailies, the same for everyone", with Daily Seven, Daily Six and Daily Sudoku buttons, each
   "Not yet". Under that come "Ten number games" as a two-column grid of cards. Each card has a little picture
   made of tiles, a one-line pitch and a green "New to you" pill. The "vs computer" pill helps. I understood
   within seconds that this is a collection of small number games. The footer line "Nothing is sent anywhere"
   reassured me. No confusion yet.
2. **Two** (I picked it because "2048 with no top tile" is something I know). A "How to play Two" sheet slid up
   with three illustrated rows and a big Play button. It is short and clear. After I tapped Play, swipes worked
   at once and tiles slid and merged. After about 40 moves I had a 64 tile and "Boost 2". Tapping Boost said
   "Tap a tile to double it. Tap Boost to cancel." That was clear, and it worked. Around 1,300 points the board
   locked and showed "Stuck. Use a power-up to keep going." The trophy button got an orange dot. This is a
   pleasant, familiar game. Audio: music and clicks start on the first tap (Play), not before, which is right.
3. **Fibonacci.** The how-to has a good "3 + 3 NO" card for the one surprising rule. I reached 55 and got
   stuck at 839 points. It is harder to read at a glance than Two because which tiles join is not obvious,
   but the how-to covered it.
4. **Five** (vs computer). The how-to says "Tap your tile, then a tile to add it onto." I was unsure whether
   "a tile" meant mine or theirs. The status line later answered that ("Your own other tile counts"). It is
   like the finger game Chopsticks. The computer moves first and says what it did ("It added 3 onto your 1"),
   which I liked. I won round 1 on Easy in five turns, and a celebration panel came up with "You win round 1",
   two trophies and "See the board" / "Next round". That was a delightful moment.
5. **Nine** (Nim with dots). Tiles show both a digit and a 3x3 dot pattern, which is lovely. When I selected
   the 7 tile, the stepper preset to "Take **7** from the 7", so the whole heap. One more tap on Take would
   have emptied it. I won round 1 against Easy in two moves, because the computer took 1 from a 1 and left me
   the last heap.
6. **Daily Sudoku** (from the Today card). This is where I hit the one real problem. The fourth row of the grid
   was a sliver about 12 px tall (finding 1). As a stranger I thought the board had eight rows and a seam.
7. **Daily Six.** This was my favourite discovery. The line was 7 ? 7 ? 7 = 6. Tapping a gap cycles + − × ÷,
   and the running "= -42" result taught me as I went. I made 7 − 7 ÷ 7 = 6 and got "Made 6. Next line". Line
   2 was 25 ? 25 ? 25. Tapping a number cycles √ and !, and √25 + √25 ÷ √25 = 6 felt clever. "Show answer"
   asks "Sure? Show it" before it gives up the line. That is a good guard.
8. **Four, Seven, Fifteen** (shorter looks). In Four, the hint "Blue ring: the computer's next disc would win
   there" is excellent coaching for a newcomer. In Seven, I dropped discs semi-randomly and scored 243 without
   understanding why things popped, which felt like a slot machine (finding 6). In Fifteen, I picked 5, 2 and 8
   and won round 1 against Easy, with a nice "2 + 5 + 8 = 15" summary.
9. **Chrome.** The Trophies sheet ("2 of 62 trophies", earned and still-to-find lists) gives me goals. Settings
   is complete: sound, music style, vibration, motion, theme, larger text, high contrast and save/load. The
   mute button switches to a crossed speaker, and sound stopped. The Games sheet repeats the home grid with
   the Today card.

## Numbered findings

1. **Blocker. Sudoku: a row with no digits collapses to about 12 px (Daily Sudoku, 21 Nov, phone).** Steps:
   home > Daily Sudoku > Play. Row 4 of today's daily has no clues, and it renders as a thin strip. Every other
   row is 41 px tall; that one is 12 px (measured at both 390x844 and 430x932). A player sees eight rows and a
   seam, and the nine cells of that row are almost impossible to tap with a thumb. I managed to hit the strip
   at its left edge and enter a 1. After that the row expanded and every row became an even 38 px. So the
   height seems to depend on the row having content. Expected: nine equal rows whatever the clues. It hits
   every player of today's shared daily, the most visible puzzle on the site.
2. **Should-fix. Nine: the take stepper defaults to the whole heap.** Steps: Nine > Play > tap the 7 tile. The
   label reads "Take 7 from the 7", and one tap on Take empties the heap. A newcomer who taps a tile and then
   Take loses the heap by accident. Expected: start at 1, or at least not preselect the maximum.
3. **Should-fix. Sudoku: switching difficulty silently throws away the daily in progress.** Steps: Daily
   Sudoku > enter a digit > tap Easy. A new Easy board replaces the daily at once, with no "leave this puzzle?"
   check. Other places in the site do ask ("Sure? Show it" in Six). I did not test whether Daily restores the
   progress, but I was not told either way.
4. **Should-fix. Daily progress is not reflected on the Today card.** After I made line 1 of Daily Six (LINE
   showed 2/6), the home Today card still said "Daily Six, Not yet". A "1 of 6" or "In progress" would pull me
   back.
5. **Minor. "New to you" pills are inconsistent after a visit.** After I opened Three and closed it without
   moving, its card on home lost its pill (neither "New to you" nor "Playing"). Four, Seven and Fifteen were
   opened the same way and kept "New to you". Two showed "Playing" in the in-page list after real moves.
6. **Minor. Seven is the hardest to understand from the how-to.** "A disc pops when its number equals how many
   discs are in its line" is accurate, but in play discs popped and eggs cracked and the score climbed to 243
   while I could not predict any of it. A first-drop nudge ("this 2 would pop here") would help, like Four's
   blue ring does.
7. **Minor copy. Five's round summary says "earned Split, Split".** "earned 2 Split" or "earned Split x2" would
   read better.
8. **Minor visual. Two: the "+12" score pop floats over the subtitle.** It overlapped "Every tile is a power of
   two" mid-animation (screenshot taken about 200 ms after a merge). It is brief, but it looks like a glitch.
9. **Minor contrast.** The "YOU" label under the board in Five is pale yellow on tan and barely readable. Six's
   solved "= 6" is yellow on tan too.
10. **Minor clarity. Nine shows four stat boxes, YOU / COMPUTER / RECORD / BEST.** As a stranger I could not
    tell RECORD from BEST before playing.
11. **Minor. The Sudoku number pad shows small subscript digits (6, 5, 5...) with no label.** I worked out that
    it is how many of each digit are left, but a first-timer may read them as notes.
12. **Delight (keep).** The how-to sheets are short and illustrated and end in a big Play. Every vs-computer
    game narrates the computer's move. The round-win panels with trophies, Four's danger ring, Six's operator
    cycling with a live result, and the "Sure?" guard on giving up are all good. Sound starts only after my
    first tap, and mute is obvious.

## Where I would quit, and would I come back

- I would have quit Daily Sudoku at finding 1: it looks broken, and I came to it from the most prominent card.
- I would not quit Two, Six, Five or Four. Six is the game I would tell a friend about.
- **Tomorrow?** Yes. Three dailies "the same for everyone", the "Start a streak today" prompt and 62 trophies
  give me reasons to return, and the 3-minute games fit a phone break. The Today card needs to show my
  progress (finding 4) to make that pull stronger.

## Verdict

**7.5 / 10.** It is a charming, coherent, ad-free collection with excellent onboarding and several genuinely
fun games (Six, Five, Two). Finding 1 is the only thing that made it look broken, and it sits on today's Daily
Sudoku. With that fixed and the Nine default changed, this would be an 8.5.
