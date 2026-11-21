<!-- SPDX-License-Identifier: Apache-2.0 -->
<!-- Copyright 2026 alvations (Melon Lab) -->

# Numberics redesign: the buildable spec

Owner's ask: "Endless is really not endless, let's call it Two. Have a creative designer and the UI/UX iterate on the
site and make it attractive to users of different age groups that play casual games. Front end and UI/UX: look into how
the tiles move instead of 'blipping'; look at how the original 2048 and other games do the animation. Like melon-eight,
have similar settings, achievements, replay value and secret achievements. Every cycle must pass QA, QC and perf tests."

Owner instruction O-7 (overrides the first draft of this brief): every games list is ordered **Fibonacci, Two, Three,
Four, Five, Six, Seven, Nine, Fifteen, Sudoku**, driven by the order of `games.json`; and **the root URL opens Two
itself, playable at once**, with an attractive way to reach the other nine on the same page. The order is the owner's
proposal and goes to the review panel (section 4.4).

Every visible change below traces to that ask (CLAUDE.md: no design change that was not asked for). Game rules do not
change anywhere in this spec: this is presentation, motion, sound, settings, trophies and onboarding.

Prototypes (self-contained HTML, open from disk, no requests). Look at these before building:

| File | Shows |
|---|---|
| `docs/design/proto/two.html` | the root page: Two on the new tokens, a working keyed tile layer (the motion of section 5.3), the games list in O-7 order, the Today card, and every shared sheet. Query string states: `?theme=light`, `?contrast=high`, `?text=large`, `?motion=reduced`, `?view=games\|settings\|trophies\|howto\|over`, `?fresh=1` |
| `docs/design/proto/four.html` | the gravity motion of section 5.5 (fall with acceleration, then squash and settle) on the new disc style |
| `proto/two-mobile.png`, `two-desktop.png` | phone 390x844 and desktop 1280x860 |
| `proto/two-light-mobile.png`, `two-light-desktop.png`, `two-contrast-mobile.png`, `two-over-large-mobile.png` | light theme, high contrast, end card with larger text |
| `proto/sheet-games-mobile.png`, `sheet-settings-mobile.png`, `sheet-trophies-desktop.png`, `sheet-howto-mobile.png` | the four shared sheets |
| `proto/four-fall-frames.png` | one drop sampled at 70, 140, 190, 240 and 400 ms |

Measured in the prototype (headless Chromium, 390x844): a slide runs over 110 ms on the ease-in-out curve (the tile
moved 263 -> 252 -> 215 -> 153 -> 83 -> 30 -> 4 -> 0 px on successive frames); with a new move every 45 ms (faster than
the animation) for 120 frames, the longest frame was 19.2 ms, none over 20 ms, and the tile layer held 15 nodes for 15
tiles (no leak).

---

## 1. Audience and voice

Casual players from about 8 years old to 80. Three groups pull in different directions; the rules below serve all three.

| Group | Needs | What we do |
|---|---|---|
| Kids (8 to 12) | big targets, bright colour, instant feedback, short words, no reading wall | 44 px minimum targets, sound and juicy motion on, how-to as three pictures with one sentence each, Easy first |
| Adults (casual) | start in one tap, come back daily, see progress | Two plays on the root with no menu; Today card; Continue on every card; trophies |
| Older players | larger type, strong contrast, calm motion, no time pressure | Larger text and High contrast settings, Motion "Less", 16 px minimum body text, no countdown timers anywhere |

### 1.1 Type, targets, contrast (binding)
- Root font size 16 px. Body copy never below `--fs-sm` (14 px); labels never below `--fs-xs` (12 px). Today the how-to
  copy is 13 px (`.82rem`); it moves to 14 px.
- Every tappable control is at least 44 x 44 CSS px (`--tap`); primary buttons and Today chips 52 px (`--tap-lg`).
  Power-up buttons, segment buttons and the games row links all meet this (today `.seg button` is about 36 px tall).
- Text contrast at least 4.5:1 on its background in both themes; UI edges at least 3:1. High contrast raises text to
  at least 7:1. A test checks the token pairs (section 10.3).
- Numbers on tiles are drawn dark on light (`--tile-ink`) on every hue; the tile lightness token keeps every hue at
  4.5:1 or better against `--tile-ink` (checked over levels 1 to 40 in the test).

### 1.2 Copy voice
- Plain words, reading age about 9: sentences of 14 words or fewer in how-to and hints; one idea per sentence.
- In new player-facing copy say "join" for merge ("Two tiles with the same number join into one"). Keep "power-up",
  "Undo", and the existing power-up names.
- Never blame: "No moves left", not "You lost" (vs-computer games keep "The computer won this round").
- No exclamation marks except in a trophy toast and the "Fifteen!" result line (both exist as rewards).
- No plain-language toggle: all copy is plain by default, so there is nothing to switch (decided; one less setting).
- No em-dashes (tests enforce it). No emoji in UI copy; glyphs are drawn SVG.

### 1.3 Difficulty defaults and onboarding
- A first visit (no saved state for that game) starts on **Easy** in Sudoku, Four, Five, Fifteen and Nine. A saved
  choice is always respected. (Today Sudoku, Four, Five and Fifteen open on Medium.)
- **How to play sheet** (section 3.6): opens by itself on the first visit to a game that has no saved state, once; it is
  always reachable from a "How to play" row under the board. Three steps, each a small drawn picture and one sentence.
  Two's root page never auto-opens it for a player who has `numberics_endless_v1` saved. One helper builds it for every
  game (`NumbericsUI.howto`, shared/howto.js; TRIAGE4 D8): the title "How to play <Game>", a Play button, the
  first-visit rule, and the row's one button "Show the three steps".
- The long `.how` paragraph under each board becomes the body of a `<details class="how">` "How to play" row (collapsed),
  which also holds the key list for desktop players. The full rules text is kept word for word inside it (no rule copy is
  lost), with the R2 explanations.

---

## 2. Visual direction and tokens

Keep the family: dark night-blue ground, gold accent for "you" and rewards, cool blue for the computer, hue-cycled number
tiles with dark numerals. Make it warmer and more tactile: a soft top glow on the page, raised panels with a hairline
highlight, tiles with a light-to-base gradient and a small bottom lip (they read as pieces you can push), rounder corners,
bolder numerals, and real depth on sheets and end cards.

### 2.1 Token set for `shared/theme.css`
Replace the `:root` block with this (names in use today are kept: `--bg --panel --cell --ink --mute --accent --line
--cool --bad --good --gap --anim --radius --tile-radius`). Copy exactly; the prototype uses these values.

```css
:root{
  /* colour: dark (default) */
  --bg:#12131a; --bg-glow:#1b1d2b; --panel:#1c1f2c; --panel-2:#242839; --cell:#2a2e41; --well:#161823;
  --board:#1c1f2c; --board-cell:#2a2e41;
  --line:#33384f; --line-2:#4a5070; --ink:#f2f1f7; --mute:#a5a7bd; --faint:#6f7290;
  --accent:#f5bd4f; --accent-2:#ffd27a; --accent-ink:#1d1a12; --accent-text:#f5bd4f;
  --cool:#74b9ff; --cool-2:#a6d2ff; --bad:#ff7a7a; --good:#62d6a0; --tile-ink:#16161e;
  --tile-s:66%; --tile-l:62%; --tile-lo:hsl(40 30% 90%); --tile-lo2:hsl(36 52% 82%);
  /* depth */
  --sh-1:0 1px 0 rgba(255,255,255,.05) inset, 0 1px 2px rgba(0,0,0,.35);
  --sh-2:0 1px 0 rgba(255,255,255,.06) inset, 0 8px 24px rgba(0,0,0,.35);
  --sh-tile:inset 0 -.55cqw 0 rgba(0,0,0,.20), 0 .5cqw 1.2cqw rgba(0,0,0,.28);
  /* shape */
  --r-xs:8px; --r-sm:12px; --r-md:16px; --r-lg:22px; --r-pill:999px;
  --radius:var(--r-lg); --tile-radius:var(--r-sm);
  --gap:10px; --tap:44px; --tap-lg:52px;
  /* type */
  --font:system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",sans-serif;
  --fs-xs:.75rem; --fs-sm:.875rem; --fs-md:1rem; --fs-lg:1.2rem; --fs-xl:1.6rem; --fs-2xl:2.25rem;
  /* motion (section 5) */
  --m-slide:110ms; --m-pop:180ms; --m-appear:170ms; --m-fade:160ms; --m-sheet:240ms; --anim:var(--m-slide);
  --e-slide:cubic-bezier(.45,0,.55,1); --e-out:cubic-bezier(.2,.8,.2,1); --e-pop:cubic-bezier(.3,1.5,.6,1);
  --e-fall:cubic-bezier(.55,0,1,.45);
  color-scheme:dark;
}
@media (max-width:520px){ :root{ --gap:8px; } }
:root[data-theme="light"]{
  --bg:#f5f1e8; --bg-glow:#fffaf0; --panel:#ffffff; --panel-2:#f3eee3; --cell:#e9e2d3; --well:#efe9dc;
  --board:#cdbfa6; --board-cell:#e2d8c5;
  --line:#ddd5c4; --line-2:#c4baa5; --ink:#1e1f29; --mute:#5b5d70; --faint:#8a8c9c;
  --accent:#f2b443; --accent-2:#f7c766; --accent-ink:#2a1f05; --accent-text:#8a5a00;
  --cool:#1f6fd1; --cool-2:#5b9be6; --bad:#c93a3a; --good:#1d8a57; --tile-l:58%;
  --sh-1:0 1px 2px rgba(60,40,10,.10); --sh-2:0 8px 24px rgba(60,40,10,.12);
  --sh-tile:inset 0 -.55cqw 0 rgba(0,0,0,.14), 0 .4cqw 1cqw rgba(60,40,10,.18);
  color-scheme:light;
}
:root[data-contrast="high"]{ --mute:#d6d7e4; --faint:#b5b7cc; --line:#6c7193; --line-2:#9aa0c4;
  --panel:#16182a; --cell:#2c3150; --board:#16182a; --board-cell:#2c3150; }
:root[data-theme="light"][data-contrast="high"]{ --mute:#2e3040; --faint:#444; --line:#7d7461; --line-2:#4d4636; --cell:#ddd3be; }
:root[data-text="large"]{ font-size:118.75%; }   /* 16 -> 19 px; boards and tiles size by the board, not by this */
```

Rules that go with the tokens:
- **Gold for text** uses `--accent-text` (gold on dark, deep amber on light: gold on white fails contrast). Gold fills
  (badges, primary buttons, your discs) use `--accent` with `--accent-ink` on top.
- **Page**: `body{ background:radial-gradient(120% 60% at 50% -10%, var(--bg-glow), var(--bg) 60%) fixed; }`.
- **Panels** (stats, tray buttons, `.btn`, cards): `background:var(--panel); border:1px solid var(--line);
  border-radius:var(--r-sm); box-shadow:var(--sh-1)`. Sheets and boards use `--sh-2`.
- **Tiles**: an outer `.tile` (position, slides) and an inner `.face` (colour, number, pops). Face:
  `background:linear-gradient(180deg, hsl(var(--h) calc(var(--tile-s) + 6%) calc(var(--tile-l) + 7%)), hsl(var(--h)
  var(--tile-s) var(--tile-l))); box-shadow:var(--sh-tile); border-radius:var(--r-sm); font-weight:850;
  letter-spacing:-.02em`. Low tiles use `--tile-lo` / `--tile-lo2` gradients from `#fbf7ee` / `#f8e7c7`.
  High contrast adds `inset 0 0 0 2px rgba(0,0,0,.55)` and weight 900.
- **Board**: `background:var(--board)`, cells `var(--board-cell)` with `box-shadow:inset 0 2px 4px rgba(0,0,0,.18)`,
  `border-radius:var(--r-lg)`, `box-shadow:var(--sh-2), inset 0 0 0 1px var(--line)`. In light theme the board is a tan
  tray (like the original 2048), so cream 2 and 4 tiles stand clear of empty cells (checked in `two-light-mobile.png`).
- **Discs** (Seven, Four): `background:radial-gradient(circle at 35% 30%, var(--hi), var(--own) 62%)` with
  `box-shadow:inset 0 -1cqw 0 rgba(0,0,0,.2), 0 .6cqw 1.2cqw rgba(0,0,0,.35)`; empty holes `--board-cell` (dark well
  `#131520` in dark theme for drop games) with `inset 0 3px 6px rgba(0,0,0,.45)`. See `proto/four.html`.
- **Buttons**: `.btn` min-height `--tap`, padding `0 20px`, weight 650. `.btn.primary` is a gold gradient
  `linear-gradient(180deg,var(--accent-2),var(--accent))`, weight 800, `box-shadow:0 1px 0 rgba(255,255,255,.35) inset,
  0 4px 14px rgba(245,189,79,.25)`. `.btn.danger` text `--bad`.
- **Stats**: label `--fs-xs` weight 650 uppercase `letter-spacing:.07em`; value 1.2rem weight 800 tabular. An empty stat
  says "none" in `--faint`.
- **Toast**: unchanged behaviour (kit.js); radius `--r-pill`, weight 800, `box-shadow:0 8px 24px rgba(0,0,0,.35)`. New
  kind `"trophy"`: gold, with the trophy's glyph (18 px) before the text.
- **End card** (`.over`): `background:color-mix(in srgb, var(--bg) 92%, transparent); backdrop-filter:blur(3px)`; a
  56 px game glyph on top; h2 `--fs-xl`; then the result line, "New best." in `--accent-text` weight 800, then one pill
  per trophy earned in that run (glyph + "Trophy: name"), then the existing buttons. See `two-over-large-mobile.png`.
- **Focus**: `:focus-visible{ outline:3px solid var(--accent); outline-offset:2px }` everywhere (today 2 px).

### 2.2 Theme decision
Offer **Dark (default), Light, Device**. Dark stays the default, so a returning player sees the family look; Light is for
daylight phones and players who read better on paper tones. Root `<meta name="theme-color">` follows the effective theme
(boot.js sets it: `#12131a` or `#f5f1e8`).

### 2.3 Two's and Sudoku's own CSS
Two (root `style.css`) and Sudoku (`sudoku/style.css`) do not link the shared theme today. Keep that separation (CLAUDE.md:
Sudoku keeps its own look) but **both copy the token block of 2.1 verbatim** at the top, and a test asserts the three
`:root` blocks are identical text (section 10.3), so the family cannot drift.

---

## 3. The root page and the shared chrome

### 3.1 Root = Two (O-7)
**Superseded by O-9 (21 Nov, beta first):** the root is the games page (the top bar, the Today card, the "Ten number
games" heading and lede, the cards, the foot line; nothing marked Playing), and Two has its own page at `two/`
(`two/index.html`, `game.js`, `style.css`, `engine.js`) like every other game, with "More number games" under the board.
The save key and everything else below stay as they were. The text below records the C1 layout.

`/` stays Two, playable on load exactly as today (same files: `index.html`, `game.js`, `style.css`, `engine.js`), with:
1. The **top bar** (3.2) above the header.
2. The game: header (h1 "Two", sub "Every tile is a power of two. No top tile."), stats, tray, hint, board, New game,
   "How to play" row.
3. **Beside the board on desktop (>= 960 px), below it on phones**: the **Today card** (3.4) then the **games list** (3.3)
   under the heading "Ten number games" and the line "From the smallest number to the biggest. Free, no ads, saved on
   this device." Layout: `.layout{ max-width:1100px; display:grid; gap:28px }`; at `min-width:960px`
   `grid-template-columns:480px minmax(0,1fr); gap:48px`.
4. Footer line: "Your scores and trophies stay on this device. Nothing is sent anywhere."

The in-game `<nav id="games">` text row at the bottom of every other page is replaced by the Games button (3.2) plus a
compact list of cards at the bottom of the page (the same component, 2 columns on phones). The text row is removed.

**Back-compat**: the Two save key stays `numberics_endless_v1` forever (shape `{state, bestScore, bestTop, bestBefore}`);
`game.js` keeps reading it unchanged. Optional nice URL: `two/index.html` is a static page with
`<meta http-equiv="refresh" content="0; url=../">`, a visible link "Go to Two", SPDX header and theme link (no
`document.write`, no script needed). Canonical URL stays `/`.

### 3.2 Top bar (every page, `shared/ui.js` builds it into `<div id="topbar"></div>`)
Height 52 px, `max-width:1100px` centred. Left: the family mark (a 2x2 of tiles: gold, hsl(159 66% 62%), hsl(202 66% 62%),
hsl(330 66% 62%), 26 px) and "Numberics" (`--fs-sm`, weight 700, `--mute`), a link to the root (`href` from
`data-root`), `aria-label="Numberics home"` (the games page, O-9). Right: four 44 px icon buttons with 1px `--line` border:
- **Games** (2x2 squares glyph + the word "Games"): opens the Games sheet.
- **Sound** (speaker glyph, TRIAGE4 D2): one tap mutes Sound and Music together and the next tap brings back what was on
  (`NumbericsSettings.toggleMute`, remembered); pressed and struck through while muted.
- **Trophies** (cup glyph): opens the Trophies sheet. A 8 px gold dot sits on it while any trophy is unseen.
- **Settings** (gear glyph; the round-4 panel read the old sun-gear as "brightness"): opens the Settings sheet.
Nothing in the bar shrinks below 44 x 44 and it never scrolls sideways (TRIAGE4 B3): on narrow screens the "Numberics"
word hides first (below 420 px, 480 px with Larger text), then the "Games" word (below 340 px, 360 px with Larger text).
Glyph paths are in the prototype `two.html` (stroke 1.8, round caps, 22 px).

### 3.3 Games list and cards (one component: `NumbericsNav.cards(el, opts)` in `shared/nav.js`)
- Data: `NumbericsNav.LIVE` in **games.json order** (O-7). `games.json` is the single source; `nav.js` keeps its static
  mirror (file:// must work) and the existing sync test is tightened to assert **identical order** and identical names,
  paths, blurbs and `vs` flags. Reordering is a one-line move in `games.json` plus the mirror.
- New `games.json` order and copy (ids: `endless` becomes `two`; see 4.2):

| id | name | path | blurb (card) | vs |
|---|---|---|---|---|
| fibonacci | Fibonacci | fibonacci/ | Join neighbours in the Fibonacci run. | |
| two | Two | (root) | 2048 with no top tile. | |
| three | Three | three/ | Count in threes, make rainbow rows. | |
| four | Four | four/ | Four in a row, or four that make ten. | yes |
| five | Five | five/ | Add tile onto tile; at five it bursts. | yes |
| six | Six | six/ | Put signs between numbers to make six. | |
| seven | Seven | seven/ | Drop discs; a number pops when it fits. | |
| nine | Nine | nine/ | Take from the heaps. Take the last to win. | yes |
| fifteen | Fifteen | fifteen/ | Pick three numbers that make fifteen. | yes |
| sudoku | Sudoku | sudoku/ | The classic 9 by 9. One answer only. | |

- Card anatomy (`.card`, radius `--r-lg`): an 84 px preview (`.pv`, background `--well`) drawn with CSS only, then name
  (1.06rem, 800), blurb (`--fs-sm`, `--mute`, 2 lines), then tags: "Playing" (gold fill, current page,
  `aria-current="page"`), "vs computer" (`--cool` on 14% cool), "Continue" (gold outline, when a run is live), the best
  from progress (`--accent-text` on 14% gold), or "New to you" (`--good`) when never played. Columns: 2 under 640 px,
  3 from 640, 2 beside the board from 960, 3 from 1180.
- Previews (exact content, all in nav.js as small HTML strings, no images): Fibonacci tiles 1 2 3 5; Two a 2x2 of
  2 4 / 8 16; Three tiles 3 6 9 in red, orange, yellow; Four a 5x3 well with gold and blue numbered discs; Five
  "2 + 3 = 5!"; Six "2 + 2 + 2 = 6"; Seven a 5x3 well of numbered discs with two grey eggs; Nine three tiles 7 3 5 with
  pip grids; Fifteen the magic square 8 1 6 / 3 5 7 / 4 9 2 with gold and blue claims; Sudoku a 3x3 box with two blue
  given digits. See `two-desktop.png`.

### 3.4 Today card (root page, and at the top of the Games sheet)
Header: "Today · Fri 20 Nov" (local date, `toLocaleDateString(undefined,{weekday:"short",day:"numeric",month:"short"})`)
and always the daily streak (TRIAGE4 D4): a flame glyph + "N days" ("1 day"), or "Start a streak today" at 0. Title: "Three dailies, the same for everyone". Three
52 px chips linking to the Daily of **Seven** (exists), **Six** (exists) and **Sudoku** (new: section 9.10). Each chip
reads "Daily <Game>" (TRIAGE4 D9, so it never reads as the game card) and shows "Not yet", or "Best <score or time>"
(the day's best, `NumbericsProgress.daily(id, text, { score, low })`) with a `--good` edge; the Sudoku chip puts the
Daily's level first ("Medium · Not yet"). The card redraws at local midnight and when a tab returns on a new day. Links: `seven/?mode=daily`, `six/?mode=daily`,
`sudoku/?mode=daily` (each game honours `?mode=daily` on load by switching to its Daily, with the usual two-step if a
run is live).

### 3.5 Progress summaries (`shared/progress.js`, global `NumbericsProgress`)
One key, `numberics_progress_v1`, read by cards and Today, written by each game whenever it persists:
```js
{ v:1,
  games:{ "<id>":{ best:"Best 1,136", live:true, liveText:"Score 1,136", at:1763600000000 } },
  howto:{ "<id>":true },               // the how-to sheet has been seen (auto-open once)
  daily:{ "20261120":{ seven:"1,204", six:"4 made", sudoku:"6:12" } } }  // only today's entry is kept
```
API: `NumbericsProgress.put(id, {best, live, liveText})`, `.get(id)`, `.daily(id, text)`, `.today()`, `.seenHowto(id)`,
`.markHowto(id)`. Every write goes through `NumbericsKit.store`. Fallback for Two: when `games.two` is missing,
progress reads `numberics_endless_v1` once and derives `best` and `live` from it (so a returning player's card is right
on day one).

### 3.6 Sheets (`shared/ui.js`: `NumbericsUI.sheet(id, build)`)
One sheet primitive for Games, Trophies, Settings and How to play: a scrim `rgba(5,6,10,.55)`; the sheet is a bottom
sheet on phones (radius `--r-lg --r-lg 0 0`, max-height 88dvh, scrolls) and a centred dialog from 640 px; grab bar
40x5; title `--fs-xl`; a 44 px close button. `role="dialog" aria-modal="true"`, focus moves to the close button on open
and back to the opener on close, Esc and a scrim tap close, Tab is trapped. Opening: translateY(24px)+opacity 0 to 0/1
over `--m-sheet` 240 ms `--e-out`; reduced motion: opacity only, 160 ms. While a sheet is open, game keys are ignored
(the game's keydown handler checks `NumbericsUI.open()`), and a run's timers (Sudoku clock) pause.

---

## 4. Rename: Endless becomes Two

### 4.1 Why "Two"
Every tile is a power of two: 2, 4, 8 and on, with no last tile. The family names games by their number (Three, Four,
Five, Six, Seven, Nine, Fifteen); Two joins them. The sub line says it: "Every tile is a power of two. No top tile."

### 4.2 Where it changes
- User-facing: `<title>Numberics Two</title>`, h1 "Two" (today the h1 is "Numberics"), the sub line, meta description
  ("Two: 2048 with no top tile. Every tile is a power of two; join them past 2048 and keep going, with power-ups earned
  from every new highest tile."), the favicon (a gold "2" on `#12131a`, replacing the infinity sign), README, cards,
  how-to, trophies, docs/DESIGN.md headings ("Two and Fibonacci").
- Ids: `games.json` id `two`; `data-current="two"`; screenshots `screenshots/two-mobile.png`, `two-desktop.png`
  (old `endless-*` removed in the same commit; README embeds updated); tests and emu files that name the id.
- Kept for back-compat (do not rename): the storage key `numberics_endless_v1`; the engine globals
  (`window.Numberics`, `make(rules)`), the replay fixture `tests/fixtures/endless-replay.json` and its env var
  `RECORD_ENDLESS_REPLAY`; Fibonacci's engine parameter name. A comment at each says "Two was called Endless; the key is
  kept so saved games load".
- `.github/workflows/pages.yml` keeps copying `index.html engine.js game.js style.css` and adds `two/` (it has a path)
  and every new `shared/*` file (it copies `shared/` whole already).

### 4.3 CLAUDE.md and docs
CLAUDE.md "What this is" lists Two first by the O-7 order and explains the name in one clause; the "Infinite means
infinite" rule is unchanged (it describes Two). The Fibonacci copy "2584 with no top tile" stays.

### 4.4 What the review panel evaluates about the O-7 order
Build it as given. The panel (docs/reviews/PERSONAS.md) reports evidence on:
1. **Findability for strangers**: can a cold player find a named game ("open Sudoku") in under 5 s, on phone and desktop?
   Sudoku is the best-known game and sits last.
2. **Does "increasing order" read?** Do players notice the numeric order (Fibonacci as "1, 1, 2..." before Two)
   without being told? The lede "From the smallest number to the biggest" is the hint; does it help or puzzle?
3. **Grouping of vs-computer games**: Four, Five, Nine and Fifteen are spread among solo games; does the "vs computer"
   tag carry it, or do players want them together?
A panel-backed change is a one-line reorder in `games.json` (and the nav mirror); nothing else hard-codes order.

---

## 5. Motion system (the core front-end ask)

### 5.1 What the original 2048 does, and what we copy
gabrielecirulli/2048 positions every tile absolutely and keys it by identity, so each tile slides from its old cell to its
new one with a CSS `transform` transition of 100 ms ease-in-out. Two tiles that merge both slide into the target cell and
stay there; a new tile with the merged value is created on top with a "pop" (scale 0 to 1.2 to 1 over 200 ms, delayed
100 ms so it starts when the slide ends, `animation-fill-mode: backwards` so it is invisible during the delay). A spawned
tile "appears" (opacity 0 and scale 0 to full over 200 ms, also delayed 100 ms). The score shows a "+N" that floats up and
fades over 600 ms. Input is never blocked: a new move simply rebuilds positions from wherever tiles are.

Today's Two already slides, but at the end of every move it **destroys and recreates every tile element**
(`render()` empties `#tiles`), and its pop keyframe repeats the translate, so merges and spawns read as a blink rather
than a motion. Fixed by: persistent tile elements keyed by identity, a separate inner face for scale, and leaving the
merged-from tiles under the new one until the next move.

### 5.2 `shared/motion.js` (global `NumbericsMotion`, also `require()`-able for its pure helpers)
```js
NumbericsMotion = {
  T: { slide:110, pop:180, appear:170, fade:160, plus:640, sheet:240,
       step:100,                       // Three's one-cell slide
       fallBase:70, fallK:60, settle:160, waveGap:60, popOut:160,   // gravity games
       fly:260, burst:420, pipOut:180, pipStagger:30, claim:240, line:360, flip:160,
       place:140, unitSweep:360, unitStagger:40, solveStagger:18, think:0 },
  E: { slide:"cubic-bezier(.45,0,.55,1)", out:"cubic-bezier(.2,.8,.2,1)", pop:"cubic-bezier(.3,1.5,.6,1)",
       fall:"cubic-bezier(.55,0,1,.45)", fly:"cubic-bezier(.3,.7,.2,1)" },
  reduced(),            // effective motion: Settings tri-state, then the OS (section 6)
  ms(name),             // T[name], or 0 when reduced (fade, plus and sheet keep their length: opacity only)
  fallMs(rows),         // Math.round(T.fallBase + T.fallK * Math.sqrt(rows)): 1 row 130 ms, 6 rows 217 ms
  play(el, frames, opts, reducedFrames),  // el.animate wrapper; reduced -> reducedFrames (opacity) or skip; returns Animation|null
  seq(),                // generation-guarded timeline: s.at(ms, fn); s.finish() runs every pending fn now, in order; s.cancel()
                        // sound steps s.sound(ms, fn) and sfx/buzz/together follow the one sound rule (7.3, TRIAGE4 D7)
  track(ids, trace, spawned, nextId), // pure: engine trace {from,to,merge}[] -> {ids, moves:[{id,to}], merges:[{id,to,from:[id,id]}], spawns:[{id,cell}]}
  layer(el, opts)       // keyed tile layer, below
};
```
`layer(el, { cols, rows, make(tile) -> HTMLElement, paint(node, tile) })` returns:
- `sync(tiles, fx)`: `tiles` is `[{id, cell, ...}]` (the authoritative board). Existing ids move (set `--r`/`--c`,
  the CSS transition slides them); new ids are created; ids no longer present are removed, except merged-from ids listed
  in `fx.merges[].from`, which get class `gone` (z-index 0) and are removed by `finish()`. `fx.merges[].id` gets class
  `merged`, `fx.spawns[].id` gets class `new`; `fx.enter[id] = {r, c}` starts a tile off-board (Three). The merged and the
  spawned tile are invisible until the slide lands, then pop or appear (the original 2048; TRIAGE4 B2).
- `finish()`: removes `gone` nodes and the `merged`/`new` classes at once; in-flight slides are **not** snapped (a CSS
  transition retargets smoothly from where the tile is). Called at the start of every input and by a 320 ms settle timer.
- `busy()`: true while a settle timer is pending.

Tile DOM: `<div class="tile" data-id style="--r;--c;--h"><div class="face">128</div></div>`. CSS in theme.css:
```css
.tile{ position:absolute; left:0; top:0; width:calc((100% - (var(--cols) - 1)*var(--gap))/var(--cols)); aspect-ratio:1;
  transform:translate(calc(var(--c)*(100% + var(--gap))),calc(var(--r)*(100% + var(--gap))));
  transition:transform var(--m-slide) var(--e-slide); will-change:transform; }
.tile.merged{ z-index:2; } .tile.merged .face{ animation:nm-pop var(--m-pop) var(--e-pop) var(--m-slide) backwards; }
.tile.new .face{ animation:nm-appear var(--m-appear) var(--e-out) var(--m-slide) backwards; }
@keyframes nm-pop{ 0%{ transform:scale(.72) } 60%{ transform:scale(1.14) } 100%{ transform:scale(1) } }
@keyframes nm-appear{ 0%{ opacity:0; transform:scale(.35) } 100%{ opacity:1; transform:scale(1) } }
:root[data-motion="reduced"] .tile{ transition:none; }
:root[data-motion="reduced"] .tile.merged .face,
:root[data-motion="reduced"] .tile.new .face{ animation:nm-fade var(--m-fade) linear backwards; }
@keyframes nm-fade{ from{ opacity:0 } }
```
(The merged pop starts at .72, not 0 as in the original: the two merged-from tiles sit underneath, so a zero start
flashes the old pair; .72 reads as one tile swelling.)

### 5.3 Two and Fibonacci (reference: `proto/two.html`)
| Beat | Duration | Easing | Delay |
|---|---|---|---|
| every tile slides to its new cell | 110 ms | `--e-slide` | 0 |
| merged tile pops on top (scale .72 -> 1.14 -> 1) | 180 ms | `--e-pop` | 110 ms |
| spawned tile appears (opacity 0, scale .35 -> 1) | 170 ms | `--e-out` | 110 ms |
| score "+N" floats up 26 px and fades (`.plus` in the Score stat) | 640 ms | `--e-out` | 0 |
| new highest tile from 32 up: a 1-shot gold ring on that tile (box-shadow 0 0 0 0 -> 0 0 0 .8cqw `--accent`, opacity 1 -> 0) | 420 ms | `--e-out` | 290 ms |
Whole move settles in 290 ms. Client flow in `doMove(dir)`: `layer.finish()`; `r = N.move(state, dir)`; if moved,
`fx = M.track(ids, r.trace, r.spawned, nextId)`; `layer.sync(tilesOf(r.state, fx.ids), fx)`; update stats, tray, toast,
persist **in the same handler** (no deferred render). The id map lives in the client (`ids`, one per cell), never in the
engine or the save. Undo, Smash, Swap, Boost, New game and load re-key the whole board without animation except: Smash
fades the tile out (opacity 1 -> 0, scale 1 -> .6, 160 ms); Boost pops the tile; Swap slides both tiles to each other's
cells (110 ms); Undo cross-fades (opacity, 120 ms).

### 5.4 Three
One-cell slide `T.step` 100 ms `--e-slide`; merge pop as 5.3. The next tile **enters from outside the board edge** it
was swiped away from: it starts one cell beyond that edge with opacity 0 and slides in over 100 ms while fading to 1 in the
first 60 ms (`fx.enter`). A Flush plays after the slide: the run's tiles get the existing rainbow sweep (420 ms,
staggered 60 ms per tile along the run), then each run tile shrinks to 0 with opacity 0 (`T.popOut` 160 ms, `--e-out`,
staggered 40 ms); a second flush in the same swipe starts 80 ms after the first ends. The board `overflow:clip` so the
entering tile never draws over the frame.

### 5.5 Seven and Four (gravity; reference: `proto/four.html`)
- **Fall**: the disc starts one slot above the top row (clipped by the board edge) and falls with
  `fallMs(rows)` duration on `--e-fall` (accelerating), `rows` = slots travelled. 1 row 130 ms, 6 rows 217 ms, 7 rows
  229 ms. Pitch is measured once per drop: slot height + row gap.
- **Settle** on landing (WAAPI on the face, `composite:"add"`, delay = fall): scale(1,1) -> scale(1.08,.9)
  translateY(4%) at 35% -> scale(.97,1.03) at 70% -> scale(1,1); 160 ms `--e-out`. A landing sound (7.3) plays at
  impact.
- **Seven waves**: after the settle, every disc that pops this wave plays `pop-out` (scale 1 -> 1.18 at 40% -> .2 with
  opacity 0) 160 ms; eggs that crack swap to the cracked face with a 120 ms opacity cross-fade and a 1-shot 2% wobble.
  Then every disc above an emptied slot falls with `fallMs(gap)` (gap = slots it drops). The next wave starts
  `T.waveGap` 60 ms after the last fall settles. The merge sound rises one pentatonic step per wave. The rising row
  (eggs every N drops): the whole stack translates up one pitch over 180 ms `--e-out` and the new egg row fades in.
- **Four**: your disc and the computer's disc both fall and settle; the computer's think pause (`THINK` 380 ms) is a
  pause, kept under reduced motion. The winning line: an SVG line is drawn through the four disc centres
  (stroke `--ink` 0.9cqw, round caps, `stroke-dashoffset` from length to 0 over `T.line` 360 ms `--e-out`), then the
  existing ring stays; other discs dim to .3 opacity over 200 ms.

### 5.6 Five
The added tile's copy **flies** from the giving tile to the target: `T.fly` 260 ms on `--e-fly` along a slight arc
(translate plus a mid-flight scale 1.08 at 50%, and a `translateY(-6%)` lift at 50% via a second keyframe track). On
landing the target pops (5.3 pop, 180 ms) and its number changes at the landing instant. A **burst** (value 5 or more):
the target scales 1 -> 1.15 -> 0 with opacity 0 over 200 ms, and 8 shards (6% squares in the tile's hue, absolutely
placed in an overlay) fly out radially 30 to 45% of the tile size, rotating 90 to 180 degrees, fading, over `T.burst`
420 ms `--e-out`; the existing ghost outline then fades in over 160 ms. The computer's add uses the same flight; its
`THINK` 520 ms pause precedes it.

### 5.7 Nine
Taking N from a tile: the taken pips (the last N filled pips) leave one by one, `T.pipStagger` 30 ms apart, each
`opacity 1 -> 0, translateY(0 -> 30%), scale(1 -> .6)` over `T.pipOut` 180 ms `--e-out`; the tile's number counts down
in step (text changes with each pip). A tile taken to zero then shrinks (scale 1 -> .85, opacity -> .35 to its empty
look) over 220 ms. The computer's take: same, after its `CPU_MS` 650 ms pause, with a 1-shot `--cool` ring on the tile.
Under reduced motion the pips fade together (160 ms) and the number changes at once.

### 5.8 Fifteen
A claim fills the tile from its centre: an inner `::after` in the owner colour, `clip-path:circle(0% at 50% 50%)` ->
`circle(75% at 50% 50%)` over `T.claim` 240 ms `--e-out`, with the existing number colour change at 120 ms. The winning
triple: the three tiles pulse brightness twice (existing `ft-win`, kept) and in Grid view a line is drawn through them
(as Four, 360 ms). **View switch** (Numbers to Grid): replace today's `width`/`height` transitions with FLIP: measure
each tile's old and new rect once, apply the new layout, then animate `transform: translate + scale` from old to new over
380 ms `cubic-bezier(.3,.7,.2,1)` (same feel, no layout per frame).

### 5.9 Six
A sign set in a gap flips in: `rotateX(90deg) -> 0` with opacity 0 -> 1, `T.flip` 160 ms `--e-out` (old sign flips out
over the first 80 ms). A bracket bar grows from its left end: `scaleX(0) -> 1`, transform-origin left, 180 ms. The
running value line ("= 3") cross-fades 120 ms when it changes. When the line makes six: the target tile pops (5.3 pop),
then a gold sheen sweeps left to right across the line's tiles (an overlay gradient's `translateX(-100% -> 100%)`, 500 ms
`--e-out`), then the next line slides in from the right (translateX(24px) + opacity 0 -> 0/1, 220 ms) after 400 ms.

### 5.10 Sudoku
- Placing a digit: the digit scales .6 -> 1 with opacity .4 -> 1 over `T.place` 140 ms `--e-pop`.
- A conflict: the clashing cells flash `--bad` at 35% background mix for 300 ms (opacity, so kept under reduced motion)
  and the placed digit does one 2-cycle horizontal shake of 3 px over 180 ms (motion: removed under reduced).
- Completing a row, column or box (all nine cells filled, no clash): a gold overlay sweeps across that unit's cells,
  `T.unitStagger` 40 ms apart, each overlay opacity 0 -> .35 -> 0 over `T.unitSweep` 360 ms (opacity only: kept under
  reduced motion, without the stagger).
- Solve: every cell's overlay pulses in order of distance from the last placed cell, `T.solveStagger` 18 ms apart, then
  the R13 hold and end card as today.
- Notes appear without motion.

### 5.11 Input during motion (binding, every game)
- **Never drop and never lag input.** The state is already authoritative when an animation starts (engines are pure and
  the client updates state first). A new input first calls `layer.finish()` / `seq.finish()` (end-state now: removes
  ghosts, ends pops, runs pending steps) and then applies the new move and starts its animation. No queue is needed and
  no input waits for an animation.
- The tray, hint, stats and toast update in the same handler as the move (today's rule, kept).
- Exceptions that wait by design: the computer's turn (a think pause, input on the board during it shows the hint "The
  computer is thinking."), and the R13 1.5 s hold before an end card (a tap skips it, as today).
- Every timer is generation-guarded (`seq()` checks a generation counter; today's `state.moves` checks stay).

### 5.12 Reduced motion (binding)
Effective motion is **reduced** when Settings Motion is "Less", or "Device" and the OS asks for reduced motion
(section 6). Then: no translate, no scale, no rotate, no shake, no flying shards; state changes are instant or a single
opacity fade of at most 160 ms. Opacity is not motion (family principle), so fades, the toast, sweeps of colour and
the "+N" fade stay. Computer think pauses stay (they are pauses). `html[data-motion="reduced"]` drives the CSS (not the
media query), so the in-app setting is authoritative. Emulation tests run with Playwright `reducedMotion:"reduce"` and
with the setting forced to "Full" to prove the override (6.2).

### 5.13 Performance rules for motion (binding)
- Animate only `transform` and `opacity` (plus `clip-path` for Fifteen's claim and `stroke-dashoffset` on one SVG
  line). Never animate width, height, top, left, margin, box-shadow size or filter on more than one element at a time.
- No layout reads inside an animation or a per-frame loop. Measure once per move (pitch, rects) before writing styles.
- `will-change: transform` only on tiles and discs (at most 49 nodes, Seven's well); never on Sudoku's 81 cells.
- Create at most the new nodes of a move; never rebuild a board's DOM per move (Two, Fibonacci, Three, Seven, Four).
- 60 fps target: every frame during a move under 16.7 ms on desktop and under 33 ms with 4x CPU throttle (section 10).

---

## 6. Settings (one shared panel, like melon-eight)

### 6.1 Data
Key `numberics_settings_v1`, through `NumbericsKit.store` (try/catch, memory fallback):
```js
{ v:1, sound:true, volume:0.5, haptics:true,
  motion:"auto",      // "auto" (follow the device) | "reduced" ("Less") | "full" (beats the OS, as melon-eight h8_motion "0")
  theme:"auto",       // "dark" | "light" | "auto" (the device; TRIAGE4 D5, a saved choice is kept)
  text:"normal",      // "normal" | "large"
  contrast:"normal",  // "normal" | "high"
  unmute:"both" }     // what the top bar's Sound button brings back: "both" | "sound" | "music"
```
Defaults as shown. Unknown or malformed fields fall back to the default one by one. Sound defaults on (browsers stay
silent until a gesture anyway) at 50%; haptics on (only Android browsers vibrate; others ignore it).

### 6.2 Modules
- `shared/boot.js` (tiny, synchronous, the first thing in `<head>` before any CSS: no flash of the wrong theme): reads
  the key in try/catch and sets `<html data-theme data-text data-contrast data-motion>` (motion resolved to `"full"` or
  `"reduced"`; theme `"auto"` resolved by `prefers-color-scheme`), and `meta[name=theme-color]`. It listens for OS
  changes (`matchMedia(...).addEventListener("change")`) when motion or theme is `"auto"`.
- `shared/settings.js` (global `NumbericsSettings`): `get()`, `set(patch)` (saves, re-applies the html attributes, fires
  `numberics:settings` on `window`), `reducedMotion()`. `NumbericsKit.reducedMotion()` delegates to it when present.
  Games read motion through `NumbericsMotion.reduced()` **at the time of each animation**, never cached at load (today
  `var ANIM = K.reducedMotion() ? 0 : 110` is computed once; that goes).
- The Settings sheet (built by settings.js inside the 3.6 sheet), top to bottom (see `sheet-settings-mobile.png`):
  - "Sound and feel": **Sound** switch ("Soft clicks and chimes"); **Volume** slider 0 to 100 (step 5; moving it plays a
    tick at the new level); **Vibration** switch ("On phones that support it"; hidden when `navigator.vibrate` is absent).
  - "Seeing": **Motion** segmented Device / Less / Full; **Theme** Dark / Light / Device; **Larger text** switch;
    **High contrast** switch.
  - "Memory": the line "Your games, bests and trophies live on this device. Save them to a file to move them to another
    one." and three buttons: **Save**, **Load**, **Erase**.
  Switches are `button[role=switch][aria-checked]` 52x32; segments `button[aria-pressed]` 38 px high inside a 44 px row.
  Every change applies live.

### 6.3 Memory: Save, Load, Erase
- **Save** downloads `numberics-save.json`: `{ game:"numberics", v:1, saved:"2026-11-20", data:"<blob>" }` where `data`
  is every `localStorage` key starting `numberics_` (game saves, progress, trophies, settings) as JSON, passed through
  the melon-eight `encBlob` (FNV-1a seed of the phrase `numberics` -> xorshift keystream XOR -> base64). Light
  obfuscation, not secrecy: it keeps the trophy list from being read at a glance. Earns the secret trophy `fam_keep`.
- **Load** opens a file picker (`<input type=file accept=".json,application/json">`); a valid file replaces every
  `numberics_*` key it holds, then the page reloads. A wrong or corrupt file shows the info toast "That file is not a
  Numberics save." and changes nothing.
- **Erase** is a two-step (`NumbericsKit.twoStep`, label "Sure? Erase everything", armed 3 s): removes every
  `numberics_*` key **except** `numberics_settings_v1` (a player who needs large text keeps it), then reloads.

### 6.4 Haptics
`NumbericsAudio.buzz(kind)` calls `navigator.vibrate` in try/catch when haptics is on: `tap` 6 ms, `merge` 10 ms,
`big` (new highest tile, wave 3+, burst) 18 ms, `win` [20, 40, 20], `lose` [30], `bad` (blocked move) none. Never more
than one call per 50 ms.

---

## 7. Sound (`shared/audio.js`, global `NumbericsAudio`)

### 7.1 Engine
One lazily created `AudioContext`, created and resumed only inside the first `pointerdown` or `keydown` (a listener
registered once, `{capture:true}`), never on load. Graph: voice -> `master` gain (`volume * 0.5`, 0 when Sound is off) ->
`DynamicsCompressor` (threshold -18 dB, ratio 4, attack 3 ms, release 120 ms) -> destination. Each voice is a short
oscillator or noise burst with an attack-decay envelope (`setValueAtTime(0)`, `linearRampToValueAtTime(peak, t+attack)`,
`exponentialRampToValueAtTime(0.0001, t+attack+decay)`), stopped and disconnected after it ends. At most 8 voices at
once (the oldest is cut); the same sound at most once per 40 ms. Volume and mute changes ramp over 30 ms. Nothing plays
while the tab is hidden. No files, no network.

### 7.2 Notes
Pentatonic ladder `P = [0, 2, 4, 7, 9]` semitones; `note(k) = 261.63 * 2 ** ((P[k % 5] + 12 * Math.floor(k / 5)) / 12)`
(C4 upward), capped at k = 14 (A6, 1760 Hz; k = 13 is G6, 1568 Hz).

### 7.3 The sounds
| Name (call) | When | Recipe | Peak gain |
|---|---|---|---|
| `tick()` | any button, segment, switch, card tap | sine 880 Hz, attack 2 ms, decay 40 ms | .21 |
| `slide()` | a move that changed the board (Two, Fibonacci, Three) | white noise through bandpass 1200 Hz Q .8, attack 4 ms, decay 60 ms | .35 |
| `merge(k)` | the highest merge of a move; k = level (Two), index (Fibonacci), ladder rung (Three) | triangle `note(k)`, attack 5 ms, decay 180 ms, plus sine `2*note(k)` at a third of the gain | .36 |
| `land()` | a disc lands (Seven, Four), a tile lands (Five) | sine 140 -> 90 Hz exponential over 80 ms, attack 2 ms, decay 110 ms | .43 |
| `pop(w)` | a Seven wave w (1, 2, 3...), a Flush, a Sudoku unit complete (w = 1) | `merge(4 + w)` | .36 |
| `burst()` | Five burst | noise through lowpass 2400 -> 400 Hz over 200 ms, decay 220 ms, plus `merge(9)` | .28 (the `merge(9)` inside at .25) |
| `pip()` | each pip taken in Nine | sine 1046 Hz, decay 50 ms | .22 |
| `place()` | Sudoku digit, Fifteen claim, Six sign | sine 660 Hz, attack 3 ms, decay 90 ms | .21 |
| `best()` | "New best." or a new highest tile from 32 up | triangle arpeggio C5 E5 G5 (523, 659, 784 Hz), 70 ms apart, each decay 160 ms | .16 |
| `power()` | a power-up earned | two sines 1318 and 1976 Hz, attack 10 ms, decay 300 ms, 6 Hz vibrato 8 cents | .27 and .135 |
| `trophy()` | a trophy unlocked | `best()` then a held G5+C6 chord, decay 600 ms | .16, then the chord at .09 |
| `win()` | a round or match won, a puzzle solved, a Daily finished | triangle C5 E5 G5 C6, 90 ms apart, last decay 600 ms | .18 |
| `lose()` | a run over, a round or match lost | sine G4 then E4 (392, 330 Hz), 160 ms apart, decay 400 ms | .11 |
| `bad()` | a blocked action (illegal drop, a spent power-up tapped) | sine 180 Hz, decay 90 ms | .20 |
Games call these at the moment the event is shown (for animated events, at the visual moment: `merge` at the end of the
slide, `land` at impact), through the same `seq()` timeline. When a new input finishes a running animation, its pending
sounds play at once, deduplicated by name (at most one of each), never dropped and never late (TRIAGE4 D7). Peak gains
are the lifted ones `MUSIC.md` decided (sound sits above the music bed); `shared/audio.js` is the source of truth.

---

## 8. Trophies and replay value (`shared/trophies.js`, global `NumbericsTrophies`)

### 8.1 Behaviour (melon-eight's Memory overlay, adapted)
- The **Trophies sheet** (top bar cup, every page; TRIAGE4 D3 changed melon-eight's earned-only list on panel
  evidence) shows a count "N of M trophies" (M: every non-secret trophy plus the secrets already earned), then
  **Earned**, then **Still to find**: every not-yet-earned non-secret trophy, dimmed (dashed edge, grey glyph) with its
  description as a goal. Both lists are grouped by game in O-7 order with "Everywhere" first. With none earned the
  count is followed by "Nothing yet. Play any game to begin." See `sheet-trophies-desktop.png`.
- A trophy tile: a 30 px drawn line glyph in `--accent` (stroke 1.7, round caps and joins, no fill) + name (`--fs-sm`
  700) + description (`--fs-xs`, `--mute`). A **secret** trophy is not shown at all until earned; once earned its tile
  gets a gold edge and a small four-point star after the name, and it shows its real description (the earner already
  knows it).
- Descriptions never spoil a secret, and non-secret descriptions name the feat, not a strategy.
- Unlock moment: a `trophy` toast "Trophy: <name>" with the glyph (2.2 s), `trophy()` sound, `big` buzz, and the cup's
  unseen dot. If an end card is up (the toast never shows over one, R7), the trophy appears as a pill on the card
  instead. Several at once: one toast "2 trophies: <first name> and 1 more"; all pills on the card.
- Storage key `numberics_trophies_v1`:
```js
{ v:1,
  got:{ "<trophyId>":"20261120" },            // date earned (local)
  unseen:["<trophyId>"],                      // cleared when the sheet opens
  fam:{ played:{ "<gameId>":1 },              // a game counts as played after its first move
        dailyDays:["20261118","20261119"],    // local days with a Daily finished (last 14 kept)
        streak:{ n:2, last:"20261119" } } }
```
- Nothing is ever sent anywhere. All reads and writes through `NumbericsKit.store`.

### 8.2 API
```js
NumbericsTrophies.report(gameId, event, data)   // games call this; returns the list of newly earned ids
NumbericsTrophies.has(id), .earned(), .open()
NumbericsTrophies.REG  // [{ id, game, name, desc, glyph, secret, on, test(data, ctx) }]
```
`ctx = { fam, hour: new Date().getHours(), today: "YYYYMMDD" }`. `report` also updates `fam` (first event of a game
marks it played; an `end` with `daily:true` adds the day and advances the streak: `n+1` if `last` was yesterday, else 1).
Tests may call `NumbericsTrophies.report` directly (unit test runs the registry in Node: trophies.js is UMD; the
registry is pure).

Each game keeps a small client-side **run record** in its own save object, `run:{ used:0, ... }` (fields per game below),
reset by New game and restored by Undo with the snapshot. It never changes rules; it only lets trophies see how a run
went (melon-eight's `run` object). Old saves without `run` start one at `{used:0}`.

### 8.3 Glyph primitives (24 x 24, in trophies.js)
Glyphs are composed from these paths; a trophy names one (`glyph:"bolt"`) or a numbered square (`glyph:"sq:2048"`,
`"disc:7"`), drawn as a rounded square `rect x=3.5 y=3.5 w=17 h=17 rx=3.5` or circle `r=8.5` with the label as SVG text
(font-size 9 for 1-2 chars, 7.6 for 3, 6 for 4-5, weight 800, `fill:currentColor; stroke:none`).

| name | path(s) |
|---|---|
| star | `M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.5 6.7 19.4l1.2-6L3.4 9.3l6-.7z` |
| moon | `M16 4a8 8 0 100 16 6.5 6.5 0 010-16z` + `M18.5 8l.4 1.1 1.1.4-1.1.4-.4 1.1-.4-1.1-1.1-.4 1.1-.4z` |
| bolt | `M13 3L5 14h6l-1 7 8-11h-6z` |
| line | `M4 12h16M14 6l6 6-6 6` + `M4 7v10` (past the finish line) |
| waves | `M3 9c3-3 6 3 9 0s6 3 9 0M3 15c3-3 6 3 9 0s6 3 9 0` |
| flame | `M12 3c1 4 5 5.5 5 10a5 5 0 01-10 0c0-2.4 1.2-3.6 2.4-4.6.3 1.6 1 2.6 2.1 3C11 9 11 6 12 3z` |
| cal | `rect x=4 y=5 w=16 h=15 rx=2.5` + `M4 10h16M9 3v4M15 3v4` + `M9 15l2 2 4-4` |
| spiral | `M12 12a1.5 1.5 0 011.5 1.5 3 3 0 01-3 3 4.5 4.5 0 01-4.5-4.5 6 6 0 016-6 7.5 7.5 0 017.5 7.5` |
| crown | `M4 18h16M5 18l-1-10 5 4 3-6 3 6 5-4-1 10` |
| hands | `M7 20v-6l-2-4 2-1 2 3V5a1.5 1.5 0 013 0v6M12 11V4a1.5 1.5 0 013 0v7M15 11V6a1.5 1.5 0 013 0v8a6 6 0 01-6 6h-1` |
| check | `M5 12l4.5 4.5L19 7` |
| eye | `M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6z` + `circle 12 12 2.5` |
| fork | `M12 20v-8M12 12L6 5M12 12l6-7` + `circle 6 5 1.5`, `circle 18 5 1.5` |
| heart | `M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z` |
| grid | `rect 4 4 16 16 rx 2` + `M9.3 4v16M14.7 4v16M4 9.3h16M4 14.7h16` |
| rain | three short strokes `M6 4v5M12 6v5M18 4v5` over `M3 15h18` + `M6 19h12` (a full row) |
| key | `circle 8 15 4` + `M11 12l8-8M16 7l2 2M14 9l2 2` |
| target | `circle 12 12 8`, `circle 12 12 4`, `circle 12 12 1` |
| hourglass | `M7 3h10M7 21h10M8 3c0 5 8 5 8 9s-8 4-8 9M16 3c0 5-8 5-8 9s8 4 8 9` |
| leaf | `M5 19C5 10 11 5 19 5c0 8-5 14-14 14z` + `M5 19l8-8` |

### 8.4 The list
"Event" names the `report()` call; fields are what the game passes. Secret trophies marked S.

**Everywhere** (game `fam`; events from every game)
| id | name | description | test |
|---|---|---|---|
| fam_first | Hello, numbers | Finish your first game. | any `end`, `round` or `solve` event |
| fam_five | High five | Play five different games. | `Object.keys(fam.played).length >= 5` |
| fam_all | The whole set | Play all ten games. | `fam.played` holds all ten ids |
| fam_daily | Same for everyone | Finish a Daily. | `end`/`solve` with `daily:true` |
| fam_week | A week of dailies | Finish a Daily seven days in a row. | `fam.streak.n >= 7` |
| fam_night (S) | Night owl | Played well past bedtime. | a game, round, match or puzzle ends with `ctx.hour < 4` (never on a page load or a first tap, TRIAGE4) |
| fam_keep (S) | Keepsake | Kept a copy of everything. | Settings Save completed (`report("fam","saved")`) |

**Fibonacci** (events: `move {value, merges, grid:[values], moves}`, `end {score, value}`; run `{used}`)
| id | name | description | test |
|---|---|---|---|
| fib_89 | Golden start | Make an 89. | `move.value >= 89` (value of the top tile) |
| fib_610 | Unfolding | Make a 610. | `value >= 610` |
| fib_2584 | The old goal | Make 2584, then keep going. | `value >= 2584` |
| fib_10946 | Golden ratio | Make 10946. | `value >= 10946` |
| fib_pure | Unaided | Make a 987 without power-ups. | `value >= 987 && run.used === 0` |
| fib_chain | Domino | Three joins in one move. | `merges >= 3` |
| fib_run (S) | In sequence | Four neighbours in the run. | a full row or column whose four values are consecutive Fibonacci numbers in order (either direction), smallest at least 5 |
| fib_long (S) | Patient spiral | A very long game. | `moves >= 500` in one run |

**Two** (events: `move {top, score, merges, grid:[levels], moves, stuck}`, `power {name, stuck}`, `end {score, top}`;
run `{used, stuckUse}`: `stuckUse` = the move count when a power-up was used while no move was possible)
| id | name | description | test |
|---|---|---|---|
| two_128 | Warming up | Make a 128 tile. | `top >= 7` |
| two_2048 | The old finish line | Make 2048, then keep going. | `top >= 11` |
| two_4096 | Past the line | Make 4096. | `top >= 12` |
| two_8192 | Far beyond | Make 8192. | `top >= 13` |
| two_pure | No help needed | Make 1024 without power-ups. | `top >= 10 && run.used === 0` |
| two_score | Big number | Score 20,000 in one game. | `score >= 20000` |
| two_chain | Chain reaction | Four joins in one move. | `merges >= 4` |
| two_comeback (S) | Second wind | Got unstuck and kept going. | `run.stuckUse != null && moves - run.stuckUse >= 50` |
| two_row (S) | Staircase | A row that halves all the way. | a row or column of levels l, l-1, l-2, l-3 in order (either direction) with l-3 >= 3 |

**Three** (events: `swipe {flushes, top, grid, moves}`, `end {score, flushes}`; run `{used, flushes}`)
| id | name | description | test |
|---|---|---|---|
| thr_flush | First flush | Make a rainbow flush. | `swipe.flushes >= 1` |
| thr_96 | Ninety-six | Make a 96. | `top >= 96` |
| thr_384 | Big three | Make a 384. | `top >= 384` |
| thr_five | Rainbow run | Five flushes in one game. | `run.flushes >= 5` |
| thr_double | Double rainbow | Two flushes from one swipe. | `swipe.flushes >= 2` |
| thr_mono (S) | All grown up | A full board with no 1s or 2s. | all 16 cells filled and every value >= 3 |
| thr_long (S) | Unhurried | A very long game. | `moves >= 300` |

**Four** (events: `end {won, level, how:"colour"|"ten"|"both", lastSlot, used}`)
| id | name | description | test |
|---|---|---|---|
| four_win | First four | Beat the computer. | `won` |
| four_ten | Ten out of ten | Win with four that make ten. | `won && how !== "colour"` |
| four_colour | True colours | Win with four of your colour. | `won && how !== "ten"` |
| four_medium | Getting good | Win on Medium. | `won && level === "medium"` |
| four_hard | Hard won | Win on Hard. | `won && level === "hard"` |
| four_pure | Bare hands | Win on Hard without power-ups. | `won && level === "hard" && used === 0` |
| four_both (S) | Two at once | One disc, two kinds of win. | `won && how === "both"` |
| four_last (S) | Last slot | Won with the very last space. | `won && lastSlot` |

**Five** (events: `round {won, burstAt}`, `match {won, level, p, c, down02}`)
| id | name | description | test |
|---|---|---|---|
| five_round | First burst | Win a round. | `round.won` |
| five_match | Match point | Win a match. | `match.won` |
| five_medium | Steady hands | Win a match on Medium. | `won && level === "medium"` |
| five_hard | Hard five | Win a match on Hard. | `won && level === "hard"` |
| five_sweep | Clean sweep | Win a match three rounds to none. | `won && c === 0` |
| five_exact (S) | Right on five | Burst at exactly five to win a round. | `round.won && burstAt === 5` |
| five_back (S) | Turnaround | Won from far behind. | `match.won && down02` (the player was 0-2 down at some point) |

**Six** (events: `solve {tier, helped, sqrt, fact, mode, round, streak}`, `end {mode, solved, round}`)
| id | name | description | test |
|---|---|---|---|
| six_first | Made six | Make your first six. | any `solve` |
| six_tier3 | Signs of skill | Solve a tier 3 line. | `tier >= 3` |
| six_tier5 | Every tool | Solve a tier 5 line. | `tier >= 5` |
| six_climb | Climber | Reach round 10 in Climb. | `mode === "climb" && round >= 10` |
| six_daily | Daily six | Finish the Daily Six. | `end` with `mode === "daily"` |
| six_ten | No hints | Ten lines in a row without help. | `streak >= 10` (unhelped lines in a row, kept by the client in `run`) |
| six_bang (S) | Bang | Found an exciting way to six. | `!helped && fact >= 1` |
| six_roots (S) | Deep roots | Rooted twice in one line. | `!helped && sqrt >= 2` |

**Seven** (events: `drop {waves, popped:[values], sevens, left}`, `level {level, mode}`, `end {mode, score, daily}`)
| id | name | description | test |
|---|---|---|---|
| sev_three | Chain of three | One drop, three waves. | `waves >= 3` |
| sev_five | Cascade | One drop, five waves. | `waves >= 5` |
| sev_level | Rising | Reach level 5 in Classic. | `mode === "classic" && level >= 5` |
| sev_score | Seven thousand | Score 7,000 in one game. | `end.score >= 7000` |
| sev_blitz | Blitzed | Score 2,000 in Blitz. | `mode === "blitz" && score >= 2000` |
| sev_daily | Daily well | Finish a Daily. | `end.daily` |
| sev_clear (S) | Empty well | Left nothing behind. | `drop.left === 0` (no discs or eggs after the drop settles) |
| sev_sevens (S) | Lucky sevens | Three sevens in one drop. | `sevens >= 3` |

**Nine** (events: `take {amount, zeroAfter}`, `round {won, onlyOnes}`, `match {won, diff, misere, tiles}`;
`zeroAfter` = the nim-sum left after your take is 0, computed with the engine's own helper; the client counts
consecutive ones in `run.zeroRun`)
| id | name | description | test |
|---|---|---|---|
| nine_round | Last one's mine | Win a round. | `round.won` |
| nine_match | Best of five | Win a match. | `match.won` |
| nine_hard | Hard heap | Win a match on Hard. | `won && diff === "hard"` |
| nine_misere | Upside down | Win a Misere match. | `won && misere` |
| nine_nine | All nine | Win a match with nine tiles. | `won && tiles === 9` |
| nine_calm (S) | Perfect balance | A flawless stretch. | `run.zeroRun >= 10` |
| nine_ones (S) | One at a time | A patient round. | `round.won && onlyOnes` |

**Fifteen** (events: `claim {forks}`, `round {won, view, firstMid}`, `match {won, diff}`; `forks` = your open winning
threats right after your claim, from the engine's `threats`)
| id | name | description | test |
|---|---|---|---|
| fif_round | Fifteen! | Win a round. | `round.won` |
| fif_match | Match won | Win a match. | `match.won` |
| fif_medium | Sharp | Win a match on Medium. | `won && diff === "medium"` |
| fif_hard | Sharper | Win a match on Hard. | `won && diff === "hard"` |
| fif_grid | Magic square | Win a round in Grid view. | `round.won && view === "grid"` |
| fif_fork (S) | Two ways | One pick, two threats. | `forks >= 2` |
| fif_mid (S) | The middle way | Started in the middle and won. | `round.won && firstMid` (your first claim was 5) |

**Sudoku** (events: `place {conflict}`, `solve {difficulty, seconds, used:{reveal,check,cands}, daily, notes, clean}`;
run `{notes:false, clean:true}`: `notes` set by any pencil note, `clean` cleared by any placement that shows a clash)
| id | name | description | test |
|---|---|---|---|
| sdk_first | First grid | Solve a puzzle. | any `solve` |
| sdk_medium | Medium solved | Solve a Medium puzzle. | `difficulty === "medium"` |
| sdk_hard | Hard solved | Solve a Hard puzzle. | `difficulty === "hard"` |
| sdk_pure | Pen only | Solve a Hard puzzle without power-ups. | `hard && reveal + check + cands === 0` |
| sdk_quick | Quick pencil | Solve Easy in under five minutes. | `difficulty === "easy" && seconds < 300` |
| sdk_daily | Daily grid | Solve the Daily Sudoku. | `daily` |
| sdk_nonotes (S) | In your head | No notes needed. | `difficulty !== "easy" && !notes` |
| sdk_clean (S) | Not one slip | A spotless solve. | `clean` |

Totals: 7 family + 77 game trophies = 84; every game has 7 to 9, with 2 secret each, and 2 secret family-wide.

### 8.5 Replay hooks
- **Dailies**: Seven Daily and Six Daily (exist), Sudoku Daily (new, 9.10). The Today card (3.4) and the Daily streak
  (8.1 `fam.streak`). A streak shows from 2 days; a missed day resets it to 0 quietly (no guilt copy).
- **Personal bests per mode** (shown in stats and on cards): Two best score and top tile; Fibonacci the same; Three best
  score; Seven best per mode (Classic, Blitz, today's Daily: exists); Sudoku best pure and assisted time per difficulty
  (exists); Six best climb round and today's Daily count; Four, Five, Fifteen, Nine the win-loss record per level
  (cards show the current level's record).
- **Continue**: every card with a live run shows "Continue"; on the root the Two board is itself the continue.
- **New best moment**: `best()` sound, a gold ring on the Best stat (opacity, 420 ms), "New best." on the end card.

---

## 9. Per-game polish list

Every game gets: the top bar (3.2), tokens (2.1), how-to sheet with three steps (1.3), the cards list at the page foot
(3.3), sounds (7.3), haptics, trophies wiring (8.4) with its `run` record, a progress `put` on every persist (3.5),
reduced motion read live (5.12), 44 px targets, the `.how` paragraph moved into the How to play row, and `window.__demo()`
kept (screenshots). Specific items:

### 9.1 Two (root)
1. Keyed tile layer and motion 5.3 (replaces destroy-and-rebuild in `render()`); `.plus` score float; gold ring on a new
   highest tile from 32.
2. Rename (4.2); h1 "Two"; sub line; favicon "2".
3. Games list beside/below the board and Today card (3.1).
4. How-to steps: (1) "Swipe, or press an arrow key. Every tile slides as far as it can." (2) "Two tiles with the same
   number join into one." (3) "Make a new biggest tile from 32 up to earn a power-up. There is no top tile."
5. Run record `{used, stuckUse}`; events per 8.4.

### 9.2 Fibonacci
Same as Two (shared engine and client shape): keyed layer, `.plus`, sounds with `merge(index)`. How-to: (1) "Swipe to
slide every tile." (2) "Neighbours in the run join: 1 and 1, 1 and 2, 2 and 3, 3 and 5." (3) "Equal tiles do not join,
except 1 and 1."

### 9.3 Three
Motion 5.4 (one-step slide, entry from the edge, flush sweep then pop-out). The Next preview tile in the stats gets a
120 ms cross-fade when it changes. How-to: (1) "Each swipe moves tiles one step." (2) "1 and 2 make 3. From 3 up, equal
tiles join." (3) "Line up 3, 6, 9 for a rainbow flush."

### 9.4 Four
Disc style and gravity 5.5 (both sides); SVG win line; danger rings keep their colours on the new tokens (red dashed is
`--bad`, blue is `--cool`). Difficulty `.seg` buttons 44 px. First visit on Easy. How-to: (1) "Tap a column to drop your
disc." (2) "Win with four of your colour in a row." (3) "Or four in a row that add up to ten, two of them yours."

### 9.5 Five
Fly, pop and burst 5.6. The computer's tiles carry a small "Computer" label row as today; "You" label under yours.
First visit on Easy. How-to: (1) "Tap your tile, then a tile to add it onto." (2) "A tile at five or more bursts." (3)
"Burst both of the computer's tiles to win the round. First to three."

### 9.6 Six
Motion 5.9. The gap targets (signs) grow to 44 px tap areas (a transparent hit box around the visible chip). The bracket
drag keeps working on touch. How-to: (1) "Tap a gap to put a sign there." (2) "Make the line equal six." (3) "Use
brackets, roots and ! when you need them."

### 9.7 Seven
Gravity, waves and rising row 5.5; next-disc preview drops in from the top (it is the disc that will fall). The well
holes use the dark well token. Mode `.seg` 44 px. How-to: (1) "Tap a column to drop the Next disc." (2) "A disc pops when
its number equals how many discs are in its line." (3) "Grey eggs crack when a disc pops beside them."

### 9.8 Nine
Pip motion 5.7; the take control's minus and plus buttons 44 px; the "Take" button primary. First visit stays Easy
(already). How-to: (1) "Tap a tile, then choose how many to take." (2) "You and the computer take turns." (3) "Take the
very last one to win the round."

### 9.9 Fifteen
Claim fill and FLIP view switch 5.8; the Numbers/Grid switch 44 px. First visit on Easy. How-to: (1) "Pick a number from
1 to 9." (2) "The computer picks too." (3) "Hold three numbers that add up to fifteen to win."

### 9.10 Sudoku
Placement, conflict, unit and solve feedback 5.10; tokens copied into `sudoku/style.css` (2.3). Number pad keys 44 px
tall. First visit on Easy. **Daily Sudoku** (new mode, presentation of existing generation): a fourth segment "Daily";
`seed = NumbericsKit.daySeed()`, difficulty by local weekday: Monday to Thursday Easy, Friday and Saturday Medium,
Sunday Hard (the hub chip says which); its best time is today's only; finishing it reports `daily:true`. The clock pauses
while a sheet is open. How-to: (1) "Fill every row, column and box with 1 to 9." (2) "Tap a cell, then a number." (3)
"Notes are pencil marks. Red shows a clash."

---

## 10. Performance budgets (enforced by the perf tests in `tools/`)

The enforced budgets are `tools/perf-budgets.json` (read `tools/PERF.md`); the table below is the original spec. Page
weight stays at 250 KB per game (owner decision, TRIAGE4 D6, recorded in `docs/OWNER-REQUESTS.md`): with no build step the
shared modules are hand-written, and lazy music is budgeted separately. Work per move is cut instead: the game save,
progress and trophy writes are batched into one idle `localStorage` write (`NumbericsKit.store`).

Measured baseline today (headless Chromium, local server, all same-origin bytes uncompressed): Endless 50.6 KB / 7
requests, Sudoku 57.2, Fibonacci 56.6, Seven 67.5, Three 65.1, Four 73.1, Five 70.7, Six 100.9 / 9, Fifteen 67.7,
Nine 66.9. Shared modules add about 30 KB (boot 1.5, settings 7, motion 6, audio 5, trophies 12 with the registry, ui and
progress 6, nav cards and previews 4).

| Budget | Limit |
|---|---|
| Page weight, every same-origin byte on load, uncompressed | root (Two + list) <= 110 KB; Six <= 140 KB; every other game <= 120 KB |
| Requests on load | <= 14; zero external requests (unchanged rule) |
| First contentful paint, desktop headless, local server | <= 300 ms |
| Board interactive (the first key or tap moves) after `load` | <= 50 ms |
| Long tasks (> 50 ms) | none during play; at most one during load (Sudoku generation may be the one, <= 120 ms) |
| Frame time during a move or drop animation | every frame <= 16.7 ms desktop; <= 33 ms with 4x CPU throttle; dropped frames <= 5% |
| Input to first visual change | the transform is written inside the input handler: <= 1 frame (<= 20 ms measured) |
| Rapid input (a move every 45 ms for 2 s) | no frame > 20 ms desktop; tile nodes <= tiles on board + 8 at any time; zero after `finish()` beyond the board |
| Computer move compute (Four, Five, Fifteen, Nine) | median <= 30 ms, p95 <= 80 ms desktop; p95 <= 200 ms at 4x throttle (the think pause is separate and not counted) |
| Sudoku puzzle generation | <= 120 ms p95 desktop (Hard) |
| Audio | no `AudioContext` before a gesture; live audio nodes return to 0 within 1 s of the last sound |
| Memory | after 500 moves, DOM node count of the page within +5% of after 10 moves |
| Sheet open | first frame of the sheet within 1 frame of the tap; no layout of the board while a sheet opens |

### 10.3 Static checks (unit tests)
- The `:root` token block is byte-identical in `shared/theme.css`, root `style.css` and `sudoku/style.css`.
- Contrast pairs computed from the tokens: `--ink`/`--mute`/`--accent-text` on `--bg`, `--panel`, `--panel-2` >= 4.5:1 in
  dark and light; >= 7:1 for `--ink` and `--mute` under high contrast; `--tile-ink` on tile faces for levels 1 to 40
  >= 4.5:1.
- No `transition:` or `@keyframes` in any CSS animates `width|height|top|left|margin|padding` (regex check).
- Every page loads `shared/boot.js` first in `<head>` and links the top bar container; `games.json` and `nav.js` LIVE in
  identical order.
- Trophy registry: unique ids; every game has >= 2 secret; every description <= 60 chars and free of the words in its
  test that would spoil a secret (a reviewed list); every glyph name exists.

---

## 11. Build plan

Every package ends with the CLAUDE.md gate: `npm test`, `npm run test:browser`, `node tools/shots.cjs` (look at both
shots), the perf tests of section 10 for the pages it touched, and a QA + QC read against this spec. No package changes
a rule; engine files are untouched except where a package says so (none do). Owner authorship rules apply to every
commit.

### Phase A: foundation (one package, first, blocks everything)
**A1 Tokens, boot, top bar shell.** `shared/theme.css` token block (2.1) and component styles (buttons, stats, tray,
board, tile/face, toast kinds, end card, `.how` details, sheet, card); root `style.css` and `sudoku/style.css` copy the
token block; `shared/boot.js`; `<div id="topbar">` + `<script>` includes on all ten pages (boot first in head; new
scripts before `game.js`: `kit, settings, motion, audio, trophies, progress, power, engine(s), game, nav, ui`), with stub
modules that no-op so pages keep working. Acceptance: all existing tests green; every page renders with the new tokens
(screenshots of all ten, phone and desktop); token-identity and contrast tests (10.3) pass; no layout regressions at
375 px.

### Phase B: shared modules (four packages in parallel, after A1)
**B1 Settings + Memory** (`settings.js`, Settings sheet, `ui.js` sheet primitive). Acceptance: each control persists and
applies live on every page; Motion "Full" overrides OS reduce (emu test with `reducedMotion:"reduce"` + setting full ->
tiles slide); blocked storage still works in memory; Save/Load round-trips every `numberics_*` key (emu test with a
download and an upload); Erase keeps settings; sheet focus trap and Esc.
**B2 Motion** (`motion.js` with `layer`, `track`, `seq`, `play`, `fallMs`). Acceptance: Node unit tests for `track`
(merges, spawns, chains of moves, Undo re-key) and `fallMs`; emu probe on a test page: rapid-input frame budget and node
count (10); reduced path renders final state with no transform animation.
**B3 Audio + haptics** (`audio.js`). Acceptance: no AudioContext before a gesture (emu check); each sound renders in an
`OfflineAudioContext` with peak <= 0.5 and no clipping after the compressor; mute and volume ramp; voice cap 8; `buzz`
throttled; all calls safe when Web Audio or vibrate is missing.
**B4 Trophies + progress** (`trophies.js` registry of 8.4 and the sheet; `progress.js`). Acceptance: Node tests run every
registry test against crafted events (each trophy unlocks on its boundary and not one below); the sheet's count, earned
list and goals (TRIAGE4 D3), a secret hidden and uncounted until earned; unseen dot; streak logic across days (mocked dates, including a
missed day and a month boundary); end-card pill path.

### Phase C: root and family (after A1 and B4)
**C1 Root page, rename, order.** Rename (4.2), `games.json` new order and copy (3.3), nav mirror and order test, cards
with previews, Games sheet, Today card, footer line, README order and screenshots (`two-*.png`), `two/` alias page,
pages workflow note, CLAUDE.md and DESIGN.md wording. Acceptance: a saved `numberics_endless_v1` game loads on `/`
unchanged (emu test seeds the key); `/two/` reaches the root; cards show progress after playing; panel brief for 4.4
filed under `docs/reviews/`.

### Phase D: per game (ten packages in parallel, after B1 to B4; Two after C1)
One package per game: D-Two, D-Fibonacci, D-Three, D-Four, D-Five, D-Six, D-Seven, D-Nine, D-Fifteen, D-Sudoku. Each
does its section 9 list: motion (section 5 entry), sounds and haptics at the right beats, trophy events and run record,
how-to steps, progress `put`, first-visit Easy where listed, 44 px targets, `.how` into the row. Acceptance per game:
- its unit tests and emu tests green, plus new emu checks: an input during an animation is applied (state advances by
  two moves after two quick keys), reduced motion via both OS and setting, every trophy event fires on a scripted line
  (at least the non-secret ones reachable by `__demo`-style seeding), no page errors;
- frame and node budgets of section 10 for a scripted 60-move or 30-drop session;
- before and after screenshots, phone and desktop, looked at; the end card with a trophy pill;
- no rule or tuning number changed (the replay fixture for Two is unchanged, byte for byte).

### Phase E: review cycle
QA, QC and perf on the whole family (every cycle, the owner's ask): the panel personas play all ten on phone and
desktop, in dark, light, large text and high contrast, with motion Full and Less; the perf suite runs on all pages; the
order evaluation (4.4) is reported with evidence; triage follows the existing round format.

---

## 12. Decisions taken here (so builders do not ask)
- Dark stays the default theme; Light and Device are options.
- No plain-language toggle; all copy is plain.
- Sound and haptics default on (silent until a gesture); volume 50%.
- Erase keeps settings.
- Sudoku Daily difficulty rises through the week (Easy Mon to Thu, Medium Fri and Sat, Hard Sun).
- The root keeps Two's files where they are; `two/` is a redirect alias, not a move. (Superseded by O-9: Two's files
  moved to `two/`, and the root is the games page.)
- The storage key `numberics_endless_v1` and the replay fixture name are permanent.
- The merged pop starts at scale .72, not 0 (5.2).
- Trophy descriptions of secrets are shown after earning.
