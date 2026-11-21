<!-- SPDX-License-Identifier: Apache-2.0 -->
<!-- Copyright 2026 alvations (Melon Lab) -->

# Round 4: all-ages audience panel

Brief: PERSONAS.md #5 and ORDER-BRIEF.md. Memory wiped: no source, tests or earlier reviews were read. The site was
served on port 8098 and driven with headless Chromium (touch emulation for the three handheld players, keyboard for
the desktop player). Every screenshot named below was looked at. Clock in the session: Sat 21 Nov 2026, 02:2x UTC
(this matters once: see finding 14).

How the times were measured: for each named game, the real card positions were read from the rendered page at each
size, then a stranger was simulated who looks at the screen (1.0 s per screenful), swipes 70% of a screen (0.5 s per
swipe) until the card's name is fully on screen, then taps (0.5 s). The Games route adds 1.5 s to find and tap the
Games button. These are estimates from the real layout, not stopwatch times of a real person.

## 1. Maya, 9, tablet (768x1024, touch, reads slowly, wants bright and fun)

- **First impression.** The page opens with a "How to play Two" sheet over a dark board. Three picture rows (two 2
  tiles, 2 + 2 = 4, a purple 32), short sentences. She can read all three. Behind it the page is dark grey: not the
  bright, fun look she hoped for. The Two title is gold, the tiles are cream. (maya-land.png)
- **Finding a game.** She scrolls and finds the "Ten number games" cards. The coloured number previews (1 2 3 5,
  3 6 9, the dice-like Nine tiles) are the most kid-friendly part of the site: she picks by picture, not by name.
  On the tablet the grid is 3 wide and the cards read in rows of three.
- **How to play.** Clear for Two, Three, Five and Nine (picture + one line + a Play button on some). Seven's third
  line ("Grey eggs crack when a disc pops beside them") needs an adult. Six asks for brackets, roots and "!": far
  above a 9-year-old, and a red-outlined "Show answer" button sits right on the board, which she would press first.
  (priya-six.png shows the same layout)
- **Readability.** She found Larger text in Settings (the sun icon; she tapped it hoping it made the screen
  brighter, which is close). Larger text grows body text from 14 px to 16.6 px and tags from 12 px to 14.25 px: a
  small change she barely noticed. Then she found Theme: Light, and the site turned warm cream with bright
  coloured tiles (maya-light.png, maya-two-after.png). That is the look she wanted, but she only found it by luck.
- **Tap targets.** Comfortable everywhere on the tablet: power-up buttons 44 px tall, cards about 237 x 198 px.
- **Motion.** Tiles really slide in Two (a mid-move shot shows tiles between cells, maya-mid-anim.png), discs drop
  in Seven. It helps: she can see where things went. A small dot appeared on the trophy cup after a few moves, a
  nice "something happened" hint.
- **Settings she would change.** Light theme (could, after hunting), larger text (could, small effect).
- **Would return to.** Two (bright colours once in Light, the swiping), Five (big 1 and 2 tiles, the computer
  plays straight away so something is always happening, maya-five.png), Nine (dice-dot tiles). Not Six or Sudoku.
  Trophies she would chase if she could see a list of what to win; the sheet only shows what she already has.
- **Frustrations.** Dark by default on a light device. The Show answer button in Six. The Three board starts with
  pale grey tiles (maya-three.png): less colourful than the card picture promised.

## 2. Sam, 34, phone (390x844, one hand, sound off, 3-minute sessions)

- **First impression.** How-to sheet over Two; one tap on the close button (top right, the hardest corner for a
  right thumb on a tall phone; the sheet has a grab handle but closing by a downward drag was not offered as a hint).
  Board fills the screen width, score row is tidy. (sam-land.png, sam-closed-full.png)
- **Sound.** Sam's phone is on silent, but the site does not know that. A probe on the audio engine showed music
  starting on the very first tap, which was the tap that closed the How-to sheet: 14 sound oscillators within 3 s,
  25 by 7 s, before he had played a move. To turn it off he must open Settings (top right again) and switch off
  Sound and Music separately. There is no mute in the top bar.
- **Finding a game.** The Today card is the best thing on the page for him: three daily chips (Seven, Six, Sudoku)
  a short swipe below the board. He tapped Seven's chip and was in the Daily in under a second (771 ms navigation).
- **How to play / play.** Seven's Daily was clear enough; 30 one-handed taps took 18 s and scored 807 with a level-up,
  discs visibly dropping (sam-seven-anim.png, sam-seven-play.png). The board columns are about 50 px wide: fine for
  a thumb. The Undo/Smash/Hold/Crack row lights up gold when earned.
- **Readability.** Fine at default size.
- **Motion.** Drops are quick and readable; never in his way.
- **Would return to.** The three dailies, every day, if the chips told him how he did (every chip read "Not yet"; whether it
  shows a result after a finished daily was not checked; a streak count would make him come back; none was visible). Two for a quick run.
- **Frustrations.** Music on a train. Close buttons and Settings all in the top right corner. Daily Sudoku opens on
  a Medium puzzle (Saturday) with nothing saying so (finding 6).

## 3. Priya, 52, desktop (1280x860, keyboard, likes puzzles)

- **First impression.** Clean two-column layout: Two on the left, Today card and the game grid on the right
  (priya-land-closed.png). Calm, grown-up. She wants Sudoku.
- **Finding Sudoku.** The Today card's "Sudoku, Not yet" chip is on screen at once, top right. She clicked it and
  landed in the Daily, not a free puzzle. The Sudoku card itself is the last card and sits below the fold at
  1280x860 (top at 988 px), one scroll away.
- **How to play.** Sudoku's sheet is three good picture rows, but is titled just "How to play" while Two, Three,
  Five, Six, Nine and Fifteen say "How to play <Game>" (Four, Seven and Sudoku do not). Some sheets end in a Play
  button (Three, Five, Nine, Fifteen), others do not.
- **Keyboard.** Escape closes the sheet. Arrow keys play Two (40 presses, score 240, the page did not scroll).
  Sudoku: click a cell, type digits, arrows move, "n" toggles Notes (shown as "Notes: on"), clashes turn red
  (priya-sudoku-kb.png). Tab order is sensible: home, Games, Trophies, Settings, difficulty, board, power-ups.
  The number pad shows how many of each digit are left: a lovely touch.
- **Readability and targets.** All fine on desktop.
- **Motion.** Subtle. With reduced motion requested by the system, arrow-key play still worked (whether every slide was instant was not measured).
- **Would return to.** Sudoku (Daily plus the Easy/Medium/Hard tabs, separate best times), Six (a real puzzle
  climb: 6, then 66, 6.6, 666), Fifteen (the 3x3 number picture on its card reads as a magic square to a puzzler; not played to the end in this pass). Trophies: she earned
  "Night owl" on her first load (it was 02:20), and the sheet lists only earned trophies, so she has no goals to aim at.
- **Frustrations.** Daily chip versus card ambiguity for Sudoku; no difficulty shown on the Daily.

## 4. Walter, 71, small phone (375x667, larger text and high contrast, unsure with gestures)

- **First impression.** The How-to sheet covers most of the screen; he read it, found the X. He then looked for
  settings. The gear is drawn as a sun: he took it for "brightness", tapped it anyway, and found Larger text and
  High contrast near the bottom of the sheet (walter-settings.png, walter-settings2.png). Both switch at once and
  stick across pages. High contrast adds clear outlines to tiles and boxes (walter-hc.png). Good.
- **Finding a game.** On a 375x667 screen the board alone fills the first screen; the cards start two screens
  down. Sudoku, last in the list, needs four swipes: about 7.5 s by the page and 6.0 s by the Games sheet. Swiping
  inside a sheet is a gesture he is not sure of.
- **How to play.** Fifteen's sheet with Larger text is lovely: big text, a big gold Play button
  (walter-fifteen-howto.png). Nine: "Tap a tile, then choose how many to take" worked first time; he won round 1 on
  Easy and got the trophy "Hello, numbers" with a clear "You win round 1" panel (walter-nine-play.png).
- **Tap targets.** With Larger text on, Trophies and Settings in the top bar shrink to 37 px wide (they are 44 px
  without it). The "Numberics" home link is 20 px tall. In Nine, the "Take" button sits on the bottom edge of the
  screen (y 622 to 667) and the minus/plus controls beside it are half off-screen until he scrolls. In Four, with
  Larger text, the score boxes wrap to two rows and the board starts below the fold (walter-four.png): he must
  scroll before every game. In Five his own tiles are below the fold (walter-five-2.png).
- **Motion.** Fine; nothing flashes. He did not need Motion: Less.
- **Would return to.** Nine and Fifteen (calm, turn-based, the computer waits for him), Sudoku if he can find it.
- **Frustrations.** Scrolling to reach the board in the vs-computer games; the sun icon; the tiny top-bar buttons
  with Larger text; music on by default (he did not know where it came from).

## Order (ORDER-BRIEF.md)

### Q1. Findability (estimated seconds from request to tap; bar is under 5 s)

| Size | Route | Fibonacci | Seven | Sudoku | Four (vs computer) |
|---|---|---|---|---|---|
| Phone 390x844 | Root page scroll | 3.0 | 4.5 | **6.0** | 3.0 |
| Phone 390x844 | Games sheet | 3.0 | 4.5 | 4.5 | 3.0 |
| Small phone 375x667 | Root page scroll | 4.5 | **6.0** | **7.5** | 4.5 |
| Small phone 375x667 | Games sheet | 3.0 | **6.0** | **6.0** | 4.5 |
| Tablet 768x1024 | Root page scroll | 3.0 | 3.0 | 4.5 | 3.0 |
| Tablet 768x1024 | Games sheet | 3.0 | 3.0 | 4.5 | 3.0 |
| Desktop 1280x860 | Root page scroll | 1.5 | 3.0 | 3.0 | 1.5 |
| Desktop 1280x860 | Games sheet | 3.0 | 4.5 | 4.5 | 3.0 |

- Every miss of the 5 s bar is Seven or Sudoku on a phone, and the worst is the smallest phone (Walter), Sudoku last.
- The hesitation every persona had for Sudoku and Seven: the **Today chip** with the same name appears first
  (phone: 2.5 s in, desktop: at once). All four tapped it. It opens the Daily (`?mode=daily`), which for Sudoku on a
  Saturday is a Medium puzzle. For Priya and Sam that was fine; for Walter it was a wrong turn he did not know he had
  taken. So the chip makes "find Sudoku" fast but "find a normal Sudoku" no faster.
- Fibonacci, first in the list, is found fastest everywhere. Two needs no finding (it is the page).

### Q2. Does "increasing order" read?

- Maya (9): yes, immediately and with pleasure: "Two, Three, Four, Five, Six, Seven... where is Eight?" The card
  previews help: 1 2 3 5, then 2 4 8 16, then 3 6 9. She asked why Nine comes before Fifteen and then said "oh,
  it's bigger". Fibonacci first did not puzzle her because its picture starts at 1.
- Sam (34): did not notice the order; he used the Today card.
- Priya (52): noticed on the 3-column desktop grid on the second look ("1 2 3 5, then 2, 3 / 4, 5, 6 / 7, 9, 15
  ... and Sudoku, 9 by 9"). She read the lede "From the smallest number to the biggest" after noticing, and it
  confirmed it. She wondered why Sudoku, which she sees as the main game, is last.
- Walter (71): did not notice; on a 2-column phone grid the counting is broken across rows and the first row is
  "Fibonacci, Two", which he read as "the odd one, then the one I'm on". He did not read the lede.
- Fibonacci first: nobody thought it was a mistake, but nobody connected it to "1, 1, 2" either. The preview shows
  1 2 3 5, not 1 1 2 3, so the reason it comes before Two is not visible.
- The lede helps the two people who noticed the pattern on their own; it does not create the noticing.

### Q3. Grouping of vs-computer games

- The blue "vs computer" tag is readable on all sizes (12 px, 14.25 px with Larger text) and sits on every one of
  the four cards. Walter, asked to "find a game against the computer", tapped Four (the first tagged card) in
  about 4.5 s on the small phone. Priya found all four at a glance on desktop (rows 2 and 3).
- Nobody asked for them to be grouped. Walter and Maya would play all four, and spreading them means a computer
  game is never more than one row away. Grouping would break the counting order for little gain.

### Q4. Unprompted remarks

- "Two is where I already am, why is it second?" (Sam, once he noticed the gold Playing card). Harmless.
- "Where is Eight?" (Maya). A fun question, not a problem.
- "I expected Sudoku near the top" (Priya, Walter). The Today chip mostly answers this.

### Recommendation (the owner decides)

**Keep the owner's order.** It reads as counting for the youngest player, who is the one it delights, it costs at
most one extra swipe on the tablet and desktop, the vs-computer tag carries the grouping, and the Today card already
lifts Sudoku and Seven to the top on most days. The only real cost is Sudoku on the smallest phones (6.0 to 7.5 s).
Two small changes that do not touch the order would fix most of it: make the Fibonacci preview start 1 1 2 3 so the
first card visibly starts counting at one (finding 9), and fix the small-phone layout so the card grid is reached
sooner (finding 5). If the owner prefers findability for older players over the counting idea, the named
alternative is "Sudoku, then the owner's order" (Sudoku first, Fibonacci to Fifteen after), but this panel does not
recommend it: it was the only change asked for by two of four players, and both of them found Sudoku through the
Today chip anyway.

## Defaults (O-6)

- **Music on at first visit: change it.** Music starts on the first tap anywhere, including closing the How-to
  sheet, before any move. Sam (public transport) and Walter (did not know where it came from) both wanted it off and
  had to open Settings and switch two separate toggles. Maya loved it. Verdict: keep sound effects on, and either
  start music off at first visit (offer it once, for example in the How-to sheet), or put a one-tap mute in the
  top bar. Either answer is fine; music on with no visible mute is not.
- **First-visit Easy: keep.** Every vs-computer game opened on Easy. Walter won his first round of Nine on Easy
  and earned a trophy; Maya's first Five round on Easy opened with a gentle computer move (1 onto 1) that she could follow; the round was not played to the end. This is the right first experience for both ends of the age
  range, and the Medium and Hard tabs are one tap away.
- **Daily Sudoku weekly ramp (Easy Mon-Thu, Medium Fri-Sat, Hard Sun): keep the ramp, but say it.** Today
  (Saturday) the Daily was Medium (32 clues). Nothing on the chip or the page said "Medium" or "Saturday": the Daily
  tab is highlighted and the Easy/Medium/Hard tabs are all unselected (sam-sudoku-daily.png). A first-timer who
  arrives on a Sunday meets a Hard puzzle as their first Sudoku here, through the most prominent link on the page.
  Label the difficulty on the Today chip and on the Daily view.

## Findings

1. [should-fix] **Music starts on the first tap with no visible mute.** Root, phone. Steps: fresh load, tap the
   How-to close button. Observed: audio engine running and 14 oscillators within 3 s, 25 by 7 s. Expected: either
   music off until chosen, or a one-tap mute in the top bar. (Defaults above.)
2. [should-fix] **Daily Sudoku hides its difficulty.** Root Today chip "Sudoku, Not yet" and `sudoku/?mode=daily`.
   Saturday gives Medium (32 clues), Sunday will give Hard, and neither the chip nor the page says so. Expected: "Daily,
   Medium" (or the weekday rule) shown on the chip and above the board.
3. [should-fix] **Today chips and game cards share names but go to different places.** Asked for "Sudoku", all four
   players tapped the Today chip first and landed in the Daily, not a free puzzle. Expected: the chip reads as a
   daily ("Daily Sudoku", or a calendar mark), so a stranger can tell the two apart.
4. [should-fix] **Theme defaults to Dark even on a light device.** Tablet with a light system preference: page is
   dark and Settings shows Theme: Dark selected, not Device. Light looks far more inviting for children
   (maya-light.png). Expected: Device as the first-visit theme.
5. [should-fix] **Small phone with Larger text: the board or the controls start below the fold.** 375x667, Larger
   text on. Four: score boxes wrap to two rows, board starts below the screen (walter-four.png). Five: the player's
   own tiles are off-screen (walter-five-2.png). Nine: "Take" sits on the bottom edge and the minus/plus controls
   are cut. Expected: the board and its main button visible without scrolling.
6. [should-fix] **Top-bar Trophies and Settings shrink to 37 px wide with Larger text.** 375x667, Larger text on.
   Measured 37 x 44 px (44 x 44 without it). Expected: at least 44 x 44 in every text size; the setting meant for
   older players makes their targets smaller.
7. [should-fix] **Trophies sheet shows only earned trophies.** Desktop, fresh profile: the sheet lists one card
   ("Night owl"). Children and returning players need goals; show locked trophies as silhouettes (keeping secret
   ones as "?"), as melon-eight does.
8. [should-fix] **Six has a red "Show answer" button on the board from the first line.** A child presses it first
   (priya-six.png). Expected: tucked behind a confirm or shown only after a few tries.
9. [nit] **Fibonacci preview shows 1 2 3 5, so the order's logic is hidden.** Showing 1 1 2 3 would make "it starts
   at one, then Two" visible without words (Order Q2).
10. [nit] **The settings icon is a sun.** Walter and Maya both read it as brightness. A gear, or the word Settings on
    wider screens, would read at once.
11. [nit] **How-to sheets are not uniform.** Four, Seven and Sudoku are titled "How to play"; the others say "How to
    play <Game>". Three, Five, Nine and Fifteen end with a Play button; Two, Fibonacci, Four, Six, Seven and Sudoku
    do not.
12. [nit] **Close is always in the top right corner.** One-handed on a tall phone, the How-to close, sheet close and
    Settings are the hardest reach. A tap outside or a swipe down closing the sheet would help (the grab handle hints
    at it but nothing says so).
13. [nit] **Larger text is a small step** (14 px to 16.6 px, +19%). For a 71-year-old it is helpful but modest;
    the board numbers were already large, the labels and tags remain the smallest text on screen.
14. [nit] **Night owl is awarded on first page load** in the small hours, before any move. Correct by its rule, but
    a first trophy for doing nothing feels odd; awarding it after a first move would feel earned.
15. [nit] **Copy differences between pages.** Fibonacci's subtitle is "2584 with no top tile" while its card says
    "Join neighbours in the Fibonacci run"; the list heading under the Fibonacci game reads "More number games",
    under Three it reads "Ten number games".
16. [nit] **No streak or daily history is visible.** Sam would come back every day for a streak count on the Today
    card; none was seen in a first session.

## Scores by age group (out of 10)

- **Children (Maya, 9): 7.** Bright and fun once in Light theme, real sliding motion, picture-first cards and easy
  computer opponents. Loses points for the dark default, Six's Show answer button and not being able to see which
  trophies exist.
- **Adults on the go (Sam, 34): 7.** Fast to start, excellent Today card, one-handed play works. Loses points for
  music on the first tap with no quick mute, everything important in the top right corner, and no streak.
- **Middle-aged puzzlers (Priya, 52): 8.** Keyboard support is complete, Sudoku is polished, Six and Fifteen are
  real puzzles. Loses points for the hidden Daily difficulty and the chip versus card confusion.
- **Older players (Walter, 71): 6.** Larger text and high contrast exist and work, turn-based games are calm and
  winnable on Easy. Loses points for boards below the fold on a small phone, shrinking top-bar targets, the sun icon,
  surprise music, and Sudoku being the hardest game to reach on his screen.
