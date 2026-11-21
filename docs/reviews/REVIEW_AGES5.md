<!-- SPDX-License-Identifier: Apache-2.0 -->
<!-- Copyright 2026 alvations (Melon Lab) -->

# Review round 5: the all-ages audience panel

Reviewer 5. Memory wiped: I read only PERSONAS.md (brief 5), ORDER-BRIEF.md and the O-6/O-9/O-10 rows of
OWNER-REQUESTS.md to know which defaults to judge. No earlier review, no source code.

**Method.** `python3 -m http.server 8075` from the repo root, Playwright Chromium, one fresh browser context per person
(empty storage). Audio was measured by counting Web Audio oscillator and buffer starts (an init script wraps
`AudioContext`), so "music played" below means notes were actually scheduled, not that a speaker was heard. Touch
swipes were sent as raw touch events. Robot clicks are far faster than people, so every "time to open" below is given
twice: the measured mechanical time, and a modelled human time (1.2 s to orient, 0.35 s per card name read before the
target, 0.9 s per screen scrolled, 0.6 s to tap, plus 0.8 s to find and press Games). The model is mine and stated so
it can be argued with.

| Person | Device | Settings |
|---|---|---|
| Maya, 9 | tablet 768x1024, touch | defaults |
| Sam, 34 | phone 390x844, touch, one hand | sound off (top-bar mute) |
| Priya, 52 | desktop 1280x860, keyboard only | defaults |
| Walter, 71 | small phone 375x667, touch | Larger text + High contrast |

No page error or console error on any page at any of the four sizes.

## Maya, 9, tablet

- **First impression of the games page.** Bright tile previews, ten cards in a 3-column grid, Today card on top. The
  previews are the fun part and they do sell each game. But the first card is a word she cannot say ("Fibonacci") with
  a blurb she cannot parse ("Join neighbours in the Fibonacci run."), and the second one assumes she knows 2048
  ("2048 with no top tile."). The blurbs are written for adults who already know the genre.
- **Finding and starting a game.** Tapped the Two card: 686 ms to Two's page. How to play opened by itself, three
  picture rows and one big Play button. Good for a slow reader: each row is one short sentence beside a picture.
- **Playing.** 60 swipes on Two: tiles really slide (0.11 s transform transitions caught mid-move), score 296, top tile
  32, one Smash earned. Felt like a proper game.
- **Replay value.** Trophies sheet after that run: "0 of 62 trophies. Nothing yet. Play any game to begin." She *did*
  play. "Hello, numbers: Finish your first game" does not fire for an endless game she has not lost yet, and the first
  Two trophy is a 128 tile. The sheet is a wall of grey dashed boxes. For a 9-year-old that reads as "you have done
  nothing".
- **Readability.** Smallest text on every game page is 12 px (stat labels "Score", "Round"); 11 px on Nine. Fine for
  labels, not for her.
- **Frustration.** On the tablet the 3-column grid leaves Sudoku alone on a fourth row below the fold (card top at
  945 px on a 1024 px screen, mostly hidden).

Score: **7/10**.

## Sam, 34, phone, one hand, sound off

- **First impression.** Clean, fast (530 ms to load), the Today card with three dailies is exactly his 3-minute hook.
- **Sound off.** The speaker button in the top bar (44x44) mutes sound *and* music in one tap; the icon changes to a
  crossed speaker and `aria-pressed` flips. Measured: zero notes scheduled afterwards on the games page and on Daily
  Seven after 40 drops. It persists across pages. This is the right default for him (O-6: on, silent until first tap,
  then one tap to kill it).
- **One hand.** Everything important is in the top bar (Games, mute, trophies, settings at y=12). With a thumb at the
  bottom of a 390x844 phone that is the far corner. Not a blocker, he scrolls the list instead.
- **Daily.** Tapped "Daily Seven" in the Today card: 664 ms to Seven with the Daily tab selected. **The button under
  the board reads "Play Classic"** while he is in the Daily (see finding 3). 40 drops gave 2,008 points and a trophy dot
  on the top bar, a nice little reward inside his session.
- **Replay value.** Dailies + streak line ("Start a streak today") + trophy dot is a good loop for him.

Score: **8/10**.

## Priya, 52, desktop, keyboard

- **First impression.** Calm, centred, readable. The order counts up and she noticed it from the names Two, Three,
  Four... before reading the lede. Fibonacci first made sense once she saw its preview "1 2 3 5".
- **Keyboard.** 18 Tabs from page load to the Sudoku card, with a clear amber focus ring on every card; Enter opens it
  (609 ms). Focus lands on the How to play sheet's Close button; Escape closes it. In Sudoku, arrows move the
  selection and digit keys fill, clashes go red at once. Tab order in Sudoku is sensible (top bar, difficulty, board,
  power-ups).
- **Frustration.** On a 1280x860 screen Sudoku, the game she came for, is the one card below the fold (top at 945 px).
  No skip-to-games link, so 18 Tabs every time.
- **Replay.** Daily Sudoku with a difficulty ramp and pure vs assisted best times is the right hook for her.

Score: **8/10**.

## Walter, 71, small phone, Larger text + High contrast

- **First impression.** With Larger text on, the games page holds the Today card and only the first two cards in the
  first screen. Sudoku, the one game he knows by name, is last: 1,321 px down, two full screens of scrolling.
- **Settings.** Found the gear. Both switches labelled plainly. But after tapping Larger text the sheet scrolls and its
  title and Close button scroll away with the content (finding 6); he has to scroll back up to leave.
- **Gestures.** Two, Three and Fibonacci need swipes; the hint says "Swipe or use the arrow keys" (no arrow keys on his
  phone, and no on-screen arrows). The swipe is forgiving, which helps a lot: a slow 30 px drag over 0.8 s moved the
  board, a 15 px nudge did not, a plain tap did nothing. The page never scrolled while swiping on the board.
- **Readability.** Larger text works everywhere except Five's board labels: "Computer" stays 12 px, and **"You" is
  amber (#F2B443) on the tan board, about 1:1 contrast, still with High contrast on** (finding 4). Seven's How to play
  is 14 px taller than the sheet at this size; Play is still visible.
- **Sudoku.** The grid fits; the number pad starts below the fold on 375x667, so every entry is a scroll down and up.

Score: **6/10**.

## Music on the games page (question from the lead)

Measured on a fresh 390x844 phone:

1. First tap anywhere on the games page (the heading, or the Settings gear) starts music there: 9 to 14 notes in the
   next 2 to 3 s.
2. Tapping a game card then navigates. The music **stops** with the page, and the game page is **silent until the next
   tap** (0 notes in 3 s untouched on Seven), then a different style starts from its beginning (Seven's Play: 70 notes
   in 3 s).
3. Tapping a card as the very first tap plays nothing on either page until a tap on the game page.

So games-page music is at best a 2 to 5 second fragment that is cut off and replaced. For Sam it is a surprise burst
from tapping the gear; for Walter, opening Settings to find Larger text starts music he did not ask for. **My
recommendation: no music on the games page.** Keep sound effects there if wanted, and let music start in the game,
where it can play for a whole session in the game's own style. Picking a style in Settings already previews it (Drift
16, Epic 33 notes in 3 s), so the games page does not need music to let people hear the styles.

**Is "Music style" clear?** The label is clear. The style names are not: Drift, Pocket, Quest, Blocks, Pulse say
nothing on their own. Each has a good one-line description ("Soft bells and a slow pad, no drums.") but only as a hover
`title`, which no touch user (Maya, Sam, Walter) can ever see. Tapping one plays it, which rescues it. "Auto (per
game)" wraps onto two lines in a fixed-width chip on phones.

**Can they mute?** Yes, everyone: the top-bar speaker is one tap on every page; Settings has separate Sound and Music
switches and volumes. Music off stops at once (1 note in 3 s, a click).

## ORDER-BRIEF.md answers

### 1. Findability (fresh load of `/`, card tapped, game page loaded)

| Size | Route | Game | Card top at load | Scroll needed | Mechanical | Modelled human |
|---|---|---|---|---|---|---|
| phone 390x844 | scroll root | Sudoku | 1302 px | 591 px | 281 ms | 5.8 s |
| phone | scroll root | Seven | 1065 px | 353 px | 207 ms | 4.8 s |
| phone | scroll root | Fibonacci | 379 px | 0 | 199 ms | 1.8 s |
| phone | Games button | Sudoku | 1325 px (in sheet) | 614 px | 606 ms | 6.6 s |
| phone | Games button | Seven | 1087 px | 376 px | 625 ms | 5.6 s |
| phone | Games button | Fibonacci | 402 px | 0 | 640 ms | 2.6 s |
| desktop 1280x860 | scroll root | Sudoku | 945 px | 204 px | 238 ms | 5.8 s |
| desktop | scroll root | Seven | 735 px | 0 | 362 ms | 3.9 s |
| desktop | scroll root | Fibonacci | 314 px | 0 | 303 ms | 1.8 s |
| desktop | Games button | Sudoku | 993 px | 252 px | 711 ms | 6.6 s |
| desktop | Games button | Seven | 755 px | 28 px | 719 ms | 5.6 s |
| desktop | Games button | Fibonacci | 307 px | 0 | 701 ms | 2.6 s |

Also measured: tablet 768x1024 Sudoku top 945 px; small phone 375x667 with Larger text, Sudoku top 1321 px.

- **Sudoku misses the 5 s bar by both routes at both sizes** in the model, because it is below the fold everywhere I
  tested, including desktop. Seven passes by scrolling, fails via Games. Fibonacci passes easily.
- **Hesitation seen:** the "Daily Sudoku" chip is in the first screen at every size. A stranger told "open Sudoku"
  will tap it (it is the only "Sudoku" visible) and lands in the Daily at the day's difficulty (Medium today), not
  Easy. That is a fast route but the wrong one for Walter.
- **On the games page the Games button is pointless**: it opens a sheet that repeats the page (Today card, same ten
  cards), adding about 0.8 s and a layer. It earns its keep only on game pages.

### 2. Does "increasing order" read?
- Priya: yes, from the names ("Two, Three, Four, so it counts"). The lede helped confirm it.
- Sam: did not notice and did not care; he went to the Today card.
- Maya: noticed the previews go 1 2 3 5, 2 4 8 16, 3 6 9, liked that. Fibonacci first did not look like a mistake but
  looked like a hard word to start on.
- Walter: did not notice; looked for Sudoku. "From the smallest number to the biggest" read as a description of the
  games, not of the order, until he reached Fifteen.

### 3. Vs-computer grouping
The blue "vs computer" pill is distinct from the green "New to you" and was enough for Priya and Sam to spot the four.
Nobody asked for them grouped. Looking for "a game against the computer", the first one (Four) is in the first screen
on desktop and tablet, second screen on phones. Fine as is.

### 4. Anything else unprompted
- "I expected Sudoku first" (Walter, Priya). It is the only household name in the list and it is last and below the
  fold at every size. Evidence for the owner, not a change request: if the order stays, Sudoku will always cost a
  scroll.
- On tablet and desktop the 3-column grid leaves Sudoku alone on the last row.
- On every game page the "More number games" list includes the current game, tagged "Playing" (seen on Two).

## Numbered findings

1. **Music on the games page is a cut-off fragment** (all sizes). Steps: fresh load `/`, tap the heading or the gear,
   then a card. Music plays 2 to 5 s, stops on navigation, the game is silent until a tap, then another style starts.
   Expected: no music on the games page; music starts in the game. Should-fix.
2. **Sudoku is below the fold everywhere** and misses the 5 s findability bar (table above). Evidence for the order
   proposal; no change asked.
3. **Daily Seven shows "Play Classic" under the board** (390x844, Today card, Daily Seven). With the Daily tab active
   the main button invites Sam out of the Daily. Expected: the button names the current mode, or does not invite a
   mode switch. Should-fix.
4. **Five: the "You" label is amber on the tan board, about 1:1 contrast**, unchanged by High contrast; "Computer"
   stays 12 px with Larger text (375x667, HC + Larger text). Should-fix (Walter cannot see whose tiles are his).
5. **Music style descriptions are hover-only** (`title`), invisible on touch. Show the one-liner under the chips, or
   on selection. Should-fix.
6. **Settings sheet title and Close scroll away** (375x667, Larger text): after toggling Larger text the sheet is
   scrolled and no close control is on screen. Expected: the header stays put. Should-fix.
7. **Trophies sheet after a first session says "Nothing yet. Play any game to begin."** after 60 moves of Two (tablet).
   The copy contradicts what the child just did; "Finish your first game" never fires in an endless game that has
   not ended. Consider wording that fits endless games. Should-fix (copy).
8. **Blurbs assume adult knowledge** ("Join neighbours in the Fibonacci run.", "2048 with no top tile."). Maya could
   not tell what either game is. Copy, for the lead to weigh.
9. **No tap alternative to swiping** in Two, Three and Fibonacci, and the phone hint mentions arrow keys. The swipe is
   forgiving (30 px works), which mostly covers Walter. Won't-fix is defensible; the hint could drop "arrow keys" on
   touch devices.
10. **Games button on the games page repeats the page** as a sheet. Harmless, but it is a dead end that adds a layer
    to the slowest route.
11. **Small text**: stat labels 12 px on every game (11 px on Nine at tablet size); the games page footer "Your scores
    and trophies stay on this device" is 2.95:1 at 12 px without High contrast; "New to you" pill is 4.35:1, just
    under 4.5. Minor.
12. **Sudoku on 375x667**: the number pad sits below the fold, so each entry needs a scroll. Minor.
13. **Good, keep:** tiles slide (0.11 s) and go instant with reduced motion (`data-motion=reduced` under
    `prefers-reduced-motion`); one-tap mute that persists; picture How to play sheets with one Play button; clear
    keyboard focus ring; forgiving swipes; Easy default on the vs-computer games; dailies on the first screen.

## O-6 defaults
- Sound and vibration on, silent until first tap, 50% volume: right for Maya and Priya, harmless for Sam because the
  mute is one tap and sticks. Keep.
- Easy first for Sudoku, Four, Five, Fifteen: confirmed on Five (Easy selected on first open). Keep.
- Daily Sudoku ramp: today (Saturday) is Medium, and the Today chip says so in amber. Walter, who taps it as "the
  Sudoku", gets Medium on his first ever puzzle (see order Q1). Keep the ramp; the chip label is honest.

## Scores
| Age group | Score |
|---|---|
| Child (Maya, 9) | 7/10 |
| Adult casual (Sam, 34) | 8/10 |
| Adult puzzler (Priya, 52) | 8/10 |
| Older adult (Walter, 71) | 6/10 |
