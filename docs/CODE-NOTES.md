<!-- SPDX-License-Identifier: Apache-2.0 | Copyright 2026 alvations (Melon Lab) -->
# Code notes

The long explanatory comments of the files every page loads, kept here word for word so each page ships fewer bytes
(the 250 KB page budget, tools/perf-budgets.json). Each file keeps its SPDX header, a short summary line and the short
comments beside the code; each block below names the file and the code it sat above. When a note changes, change it
here, and keep the one-line comment in the file in step.

## shared/audio.js

**File header**

```text
NumbericsAudio (docs/design/REDESIGN.md 6.4, 7): procedural Web Audio sounds and vibration. No files, no network.

One AudioContext, created and resumed only inside a user gesture (pointerdown / keydown / touchend / click,
capture listeners registered once on load), synchronously in the handler as melon-eight does, so iOS and iframes
unlock. Before the first gesture every sound is a silent no-op and no context exists.
Graph: voice gain -> master gain (volume * 0.5, 0 when Sound is off; changes ramp over 30 ms) ->
DynamicsCompressor (-18 dB, 4:1, 3 ms, 120 ms) -> destination. One call = one voice; at most 8 voices
(the oldest is cut with a 5 ms fade); the same sound at most once per 40 ms; nothing plays while the tab is hidden.
Every node is stopped and disconnected when its voice ends.
Settings come from NumbericsSettings.get() (safe fallback) and the window event "numberics:settings".
docs/design/MUSIC.md: the SFX gains, the key shift (numberics:music), dip(), musicBus() (one context) and the lazy
music loader at the end of this file (a stub NumbericsMusic now, shared/music.js after the first gesture on a game
page; the games page never loads it, TRIAGE5 S2).
Also require()-able: module.exports = { make, note, NAMES, BUZZ, lazyMusic } for the Node tests.
```

**Before `function wake(p) {`**

```text
The context starts a moment after resume() (a context made on a key that is not an activation, such as Escape,
or on any first tap where the browser starts it asynchronously). Sounds asked for within WAKE_MS of that resume
are booked on the waking clock, so the tap that wakes it is not silent; if the start comes later than that, those
voices are cut rather than played late.
```

**Before `function render(name, arg, o) {`**

```text
render(name, arg, o): the sound through the same graph in an OfflineAudioContext.
Resolves { peak, clipped, len } or null when OfflineAudioContext is missing. o.volume (0..1, default 1), o.key.
```

**Before `function gamePage() { if (q.game) return true; try { return !!d.queryS...`**

```text
the games page (no #games[data-current], O-9) plays no music: its taps keep their sounds, and music starts on a
game page only (TRIAGE5 S2: a tap there mostly navigates away, so its music was a cut-off fragment)
```

## shared/boot.js

**File header**

```text
Numberics boot (docs/design/REDESIGN.md 6.2). The first script in <head>, before any CSS, synchronous, so the page
paints in the right theme at once: reads numberics_settings_v1 (try/catch: sandboxes throw) and sets
<html data-theme data-text data-contrast data-motion> and meta[name=theme-color]. Unknown or malformed fields fall
back to the default one by one. Motion and theme "auto" follow the device, and keep following it while the page is open.
settings.js re-runs NumbericsBoot.apply() after a change.

The beta namespace (owner: build/v2 is deployed at /numberics/beta/, same origin as the stable site): under a path
with "/beta/", the shim below stores every localStorage key "numberics_*" as "numberics_beta_*", and key(), length
and clear() see only those, so every module (Memory Save, Load and Erase included) works unchanged and never reads
or writes the stable site's keys. Keys of other names pass through. Nothing changes anywhere else.
```

## shared/howto.js

**File header**

```text
NumbericsHowto (docs/design/REDESIGN.md 1.3, 3.6, 9; TRIAGE4 D8): the one How to play sheet every game uses,
exposed as NumbericsUI.howto (shared/ui.js delegates to it). One shape for all ten games:
  - the title is "How to play <Game>", the steps are a small picture and one sentence each, a Play button closes it;
  - the collapsed "How to play" row under the board has one button, labelled "Show the three steps";
  - first visit: it opens by itself once (NumbericsProgress seenHowto / markHowto), never on a page with a saved
    game, and never over a sheet that is already open. Keys never reach the game while it is open (shared/ui.js).

howto(gameId, opts) wires the row's button and makes the first-visit check; it returns { open(onClose), close(),
shown } (shown: it opened by itself). opts:
  title     the game's name ("Two"); a title that already starts with "How to play" is kept as it is
  steps     [{ text, picture(el) }]: picture fills the step's picture box (an HTML string is also accepted)
  saved     true when this page loaded a saved game: then it never opens by itself
  button    the row's button (an element or an id); default the [data-howto] button, else the button in details.how
  onOpen    called before every open (a game finishes its running animation here)
  onButton  called when the row's button is pressed, before the sheet opens (a game's tick sound); onPlay: on Play
  onClose   called after every close; onFirstClose: after the sheet that opened by itself closes
Without the sheet module the row itself is opened instead, so the rules are still one tap away.
```

## shared/kit.js

**Before `var PEND = {}, BASE = {}, pendN = 0, idleT = null, frozen = false, lea...`**

```text
storage: always try/catch, degrade to memory (sandboxes throw).
Writes are batched (TRIAGE4 D6): save() keeps the text at once (every store of the same key reads it back) and
one idle callback writes every pending key together, so a move costs no localStorage write. Nothing is lost on
leaving: pagehide and a hidden tab flush at once, and a save made while the page is going away writes at once.
Memory (shared/settings.js) calls freeze() before it writes a loaded save or erases, then reloads: from then on
saves stay in memory and pending ones are dropped, so no page's own pagehide save can undo it (TRIAGE4 B1).
Without page lifecycle events (Node tests, odd hosts) a flush on leaving cannot be promised, so saves write at once.
BASE holds what storage held when a key joined the batch: if anything else (Memory, another tab, a script) wrote
the key since, the flush drops ours, so a queued save never overwrites a newer value it did not see.
```

**Before `function toast(msg, kind, el) {`**

```text
toast(msg) is a reward (gold); toast(msg, "bad") is a warning or loss (neutral, red edge);
toast(msg, "info") is a plain explanation (neutral).
An element may still be passed as the second or third argument.
```

**Before `function place(el) {`**

```text
Sit just above the board, over the hint line while that line is empty (round 2: inside the board it hid the top
row; at the top of the screen it hid the title). The hint's text is never printed over (TRIAGE5 S1, craft #12):
when the line has text, the toast takes the top edge of the board instead.
```

**Before `var hintObs = null, shownAt = 0;`**

```text
The status line always wins: when the hint text changes (targeting instructions, "thinking", a result), any toast
over it clears at once (round 3 craft #1: the two were drawn over each other).
```

**Before `if (!el.classList.contains("on")) return;`**

```text
the same tick that raised the toast often redraws the hint: then the toast moves off the new text; a later
change hides it, and only when the toast sits on the line (in the board lane it stays)
```

**Before `el.addEventListener("touchmove", function (e) { if (on && e.cancelable...`**

```text
cancel the browser's own gesture while a swipe is in progress, otherwise it can swallow the next tap
(round 3: the first tap on a just-earned power-up was lost)
```

## shared/motion.js

**File header**

```text
NumbericsMotion (docs/design/REDESIGN.md 5.2, 5.11 to 5.13): the timing and easing tokens, the effective motion
setting, an el.animate wrapper, a generation-guarded timeline, the pure identity tracker and the keyed tile layer.
Like the original 2048, every tile keeps its element and slides by transform; a merged tile is invisible until the
slide lands, then pops on top, and a spawned tile appears after the slide. A new input calls finish() and is applied at once: nothing queues.
Only transform and opacity animate. Under reduced motion every change is instant or one opacity fade.
The CSS lives in shared/theme.css, in the block marked "B2 motion" (scoped under .nmm-layer, keyframes nmm-*).
Sounds follow one rule under fast play (sfx, buzz, seq().sound, TRIAGE4 D7): see seq below.
UMD: the pure parts (T, E, ms, fallMs, track, rekey, seq, sfx) also run under require() for the Node tests.
```

**Before `function reduced() {`**

```text
---- effective motion (5.12, 6.2): the Settings tri-state first, then the device ----
Read at the time of each animation, never cached: "Less" is reduced, "Full" beats the OS, "Device" follows it.
```

**Before `var dedup = null; // the names played by the finish() that is running ...`**

```text
---- sounds (TRIAGE4 D7: one rule for sounds under fast play) ----
sfx(name, arg) and buzz(kind) play through NumbericsAudio (a missing module costs a sound, never the game). While a
timeline is being finished by a new input, its pending sounds play at once, deduplicated by name (at most one of
each): never dropped, never bunched into a pile of the same sound.
```

**Before `function together(fn, set) {`**

```text
together(fn, set): run fn with its sounds deduplicated by name as one group (joins a group already running).
A game whose finish also runs its own final step (Three's settle) wraps both in one together().
```

**Before `function seq() {`**

```text
---- seq: a generation-guarded timeline. s.at(ms, fn); s.finish() runs every pending fn now, in time order
(steps a step schedules run too, so a cascade of waves completes at once); s.cancel() drops them (a reset).
The sound rule (D7): s.sound(ms, fn) is a step that only makes sounds. finish(interrupted) is what a new input
calls; it runs the pending steps at once, and their sfx()/buzz() calls are deduplicated by name. When that finish
ended a running animation (a pending step, or interrupted: the caller's layer was still busy), the input is fast
play, so the sound steps the same input schedules play at once instead of waiting for the slide to land: under
quick play a join sounds with its own move, never on the next key and never dropped. s.finishing() is true while
finish() runs its steps (a step can skip its visuals then). ----
```

**Before `function track(ids, trace, spawned, nextId) {`**

```text
---- track (pure): an engine trace {from,to,merge}[] -> identities. ids[cell] is the client's id map (never in the
engine or the save). Each tile keeps its id as it slides; the two tiles of a merge both slide into the target and
a NEW id is made for the merged tile; spawned cells (a cell, an array of cells, or -1) get new ids. ----
```

**Before `function layer(el, opts) {`**

```text
---- layer: the keyed tile layer (5.2). opts = { cols, rows, make(tile) -> HTMLElement, paint(node, tile),
slide (ms, default T.slide; Three uses T.step), clip (true: tiles outside the layer are clipped) } ----
```

**Before `function sync(tiles, fx) {`**

```text
sync(tiles, fx): tiles = [{id, cell | r,c, ...}] (the authoritative board). fx (all optional):
  merges [{id, to, from:[id, id]}]  the merged-from ids slide to `to` and wait under the new tile as `gone`
  spawns [{id, cell}]               the new tile appears after the slide
  enter  {id: {r, c}}               the new tile slides in from that (off-board) cell (Three)
  falls  [{id, rows}]               the tile drops `rows` slots onto its cell with gravity, then settles (Seven, Four)
  out    [id]                       a removed tile fades and shrinks away (Smash); pop [id]: an existing tile pops (Boost)
  fade   true                       every new node fades in (Undo, load: a re-keyed board)
```

**Before `if (!red) anim(face(node), [{ opacity: 0 }, { opacity: 0 }], { duratio...`**

```text
B2 (the original 2048): the merged tile is invisible until the slide has landed, then it pops. The pop's CSS
keyframes start at scale .72 with a backwards fill through the slide-long delay; this hold keeps the face
at opacity 0 for exactly that delay, so nothing new shows before the pair meets. finish() ends it at once.
```

## shared/nav.js

**File header**

```text
NumbericsNav (docs/design/REDESIGN.md 3.3, 3.4): the games list, in games.json order (O-7), everywhere it shows.
  - <nav id="games" class="games" data-root="../" data-current="seven"> : the quiet text row (every game page)
  - <div id="games" class="cards" data-root="../" data-current="two">    : the game cards (every game page; the games
                                                                           page at the root has no data-current)
  - <section id="today" class="today">                                    : the Today card (the games page, the root)
  - NumbericsNav.openSheet() : the Games sheet (the top bar's Games button, shared/ui.js): Today, then every card
  - NumbericsNav.cards(el, {root, current}) and .today(el, {root}) draw into any element
Cards read NumbericsProgress (best, a live run, played) at draw time; nothing is sent anywhere.
LIVE mirrors the live entries of games.json, in its order (tests/test-shared.js keeps them identical). Static, so
it works from file://. Reordering the family is a one-line move in games.json plus this mirror.
```

**Before `return '<span class="mt" style="width:30px;height:34px;line-height:1;p...`**

```text
line-height:1 and a 2 px foot (round 5, craft #2): at the body line height the digit pushed the third row of dots
out of the tile; now every dot clears the tile and its 2 px bottom edge
```

**Before `var FLAME = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 ...`**

```text
---- the Today card (3.4): the three Dailies, done (the day's best), under way (its progress) or not yet, and the daily streak, always shown
("Start a streak today" at 0, TRIAGE4 D4). Chips say "Daily" so they never read as the game cards (D9), and the
Daily Sudoku's chip shows its level. The card redraws at local midnight and when a tab comes back on a new day. ----
```

## shared/power.js

**Before `function info(d, s, why, opts) {`**

```text
Tray: defs = [{id, label, desc, earn?}] (exactly 4, Undo first). desc: "Take back the last move."
opts = {armed, disabled(id) -> bool | reason string, onUse(id), earn: "How to earn charges.", hint: element,
        onInfo(id, text)}. Buttons are never `disabled`: a button that cannot act now gets
        aria-disabled + class "empty", and a tap explains it instead (phones have no hover).
```

## shared/progress.js

**File header**

```text
NumbericsProgress (docs/design/REDESIGN.md 3.5, 8.5): the per-game summaries the cards and the Today card read.
One key, numberics_progress_v1, written by each game whenever it persists:
  { v:1, games:{ "<id>":{ best, live, liveText, at } }, howto:{ "<id>":true },
    daily:{ "YYYYMMDD":{ "<id>":"text" | { t:"text", s:score, low:bool } } }, part:{ "YYYYMMDD":{ "<id>":"text" } } }
Only today's daily entry is kept. daily(id, text, { score, low }) keeps the day's BEST result (TRIAGE4 D9): a later
result replaces it only when its score is higher (or lower, with low:true, as for a time); without a score the
latest text is kept. Writes are batched by NumbericsKit.store (one idle write, flushed on pagehide).
dailyLevel(date) is the Daily Sudoku's level (Easy Monday to Thursday, Medium Friday and Saturday, Hard Sunday): the
Today chip shows it; one rule, one place. Every read and write goes through NumbericsKit.store (try/catch, memory fallback);
nothing is ever sent anywhere. Also holds the pure local-day helpers and the Daily streak rule that
NumbericsTrophies uses (one rule, one place). UMD: the pure parts run in Node tests.
```

**Before `function dailyPart(id, txt) {`**

```text
a Daily under way (TRIAGE5 S5, cold #4): dailyPart(id, "2 of 6") is today's progress line for the Today chip until
the Daily is done (a done result wins); only today's entry is kept, like daily()
```

**Before `function todayCard() {`**

```text
everything the Today card draws: the local date line, the streak (always shown, TRIAGE4 D4), today's Daily
results (the day's best) and the Daily Sudoku's level
```

## shared/settings.js

**File header**

```text
NumbericsSettings (docs/design/REDESIGN.md 6): the one settings store, the Settings sheet and Memory (Save, Load,
Erase). Settings live in numberics_settings_v1 (try/catch, in-memory fallback when storage is blocked), are checked
field by field (a bad field falls back to its default alone), and apply live through NumbericsBoot.apply().
Every change fires `numberics:settings` on window (detail: the full settings) and calls the on("change") listeners
with (settings, changedKeys). Loaded right after kit.js; it makes NumbericsKit.reducedMotion() follow the in-app
Motion setting, which beats the OS (Motion "Full" plays motion even when the device asks for less).
Music fields: docs/design/MUSIC.md, Settings fields. Theme defaults to "auto" (the device; TRIAGE4 D5): a saved choice
is kept as it was. muted() / toggleMute() are the top bar's one-tap mute (TRIAGE4 D2): it turns Sound and Music off
together and remembers which were on (the `unmute` field), so the next tap brings back exactly those.
Memory never races a page's own save (TRIAGE4 B1): it flushes the batched writes before Save, and freezes the kit's
store (NumbericsKit.freeze) before Load or Erase writes, so no pagehide save during the reload can undo it.
```

**Before `function toast(msg) { if (w.NumbericsKit && w.NumbericsKit.toast) w.Nu...`**

```text
a Memory message: the status line in the sheet says it (no toast shows over an open sheet, TRIAGE5 S1); the toast
is for the API path, with no sheet open
```

**Before `var armedRow = function () {`**

```text
the armed Erase is a confirm row: it takes the whole row on one line at the buttons' height, and Save and Load
step aside until it disarms (TRIAGE5 S4, craft #25: it wrapped to three lines and grew past the sheet at 390)
```

## shared/trophies.js

**File header**

```text
NumbericsTrophies (docs/design/REDESIGN.md 8): the registry of every trophy, the earned store, the unlock moment
and the Trophies sheet. UMD: the registry and report() are pure enough to run in Node tests.
  report(gameId, event, data[, opts])  -> the ids newly earned by this event (opts.quiet: no toast, no sound; the
    unseen dot still shows). A family trophy earned mid-play waits for the next idle moment for its toast.
  has(id), earned(), unseen(), fam(), find(id), glyph(name), pill(id), pills(el, ids), open(), html()
Store: numberics_trophies_v1 = { v:1, got:{ id:"YYYYMMDD" }, unseen:[id], fam:{ played, dailyDays, streak } },
always through NumbericsKit.store (try/catch, memory fallback). Nothing is ever sent anywhere.
The sheet (TRIAGE4 D3, on panel evidence over melon-eight's earned-only list) shows a count "N of M trophies" (M: every
non-secret trophy plus the secrets already earned), then the earned trophies, then every not-yet-earned NON-secret
trophy dimmed with its description, as goals. A secret is not in the DOM, nor counted, until earned.
```

**Before `function isDaily(event, d, game) {`**

```text
A Daily is finished by "end" in every game; "solve" finishes one only where a solve ends the puzzle (Sudoku).
Six sends "solve" per line, so a Six solve never counts as finishing its Daily (D-Six report, 21 Nov).
```

**Before `T("fam_night", "fam", "Night owl", "Played well past bedtime.", "moon"...`**

```text
Night owl needs real play: it is tested only when a game, round, match or puzzle ends between midnight and 4,
never on a page load or a first tap (TRIAGE4 family: it was a free trophy for opening the page late)
```

**Before `var later = END_EV[ev] ? [] : fresh.filter(function (id) { return BY[i...`**

```text
a family trophy earned mid-play (Night owl, High five: any event) waits for the next idle moment, so it
never covers the hint line or the game's own toast mid-move; the game's trophies keep their moment
```

**Before `var END_EV = { end: 1, round: 1, match: 1, solve: 1, saved: 1 }, IDLE_...`**

```text
---- the family queue: shown when the player has paused (no key or tap for IDLE_MS), with no sheet, end card or
other toast up, and the tab visible; re-checked until then (the trophy is already saved and the dot is on) ----
```

## shared/ui.js

**File header**

```text
NumbericsUI (docs/design/REDESIGN.md 3.2, 3.6). Builds the top bar into <div id="topbar" data-root="../"></div>:
the family mark (a link home) and the Games, Sound (one-tap mute), Trophies and Settings buttons; and the one sheet primitive (3.6) that
Games, Trophies, Settings and How to play open in. Games opens NumbericsNav.openSheet() (shared/nav.js: Today and
every game card in games.json order); on the games page, or without nav.js, it scrolls to the games list. Loaded last.

Sheets: sheet(id, build, opts) opens the sheet `id` (one at a time; opening another replaces it), empties its body
and calls build(body) to fill it; opts.title (default from the id) and opts.onClose. Focus moves to the close button
and back to the opener on close; Tab is trapped; Esc, the close button and a scrim tap close it; the page behind
does not scroll, and no key reaches the game while it is open (games also check open()). Fires `numberics:sheet`
on window with detail { id, open } on open and on close (Sudoku pauses its clock on it).
Narrow screens (TRIAGE4 B3): the "Numberics" word and then the "Games" word hide (theme.css), so every button stays
44 x 44 and the bar never scrolls sideways at 320 px, Larger text included; the words stay as accessible names.
The Sound button (TRIAGE4 D2) toggles Sound and Music together (NumbericsSettings.toggleMute) and shows the state.
```

**Before `function games() {`**

```text
On the games page (no #games[data-current], O-9) the button scrolls to the cards instead of opening a sheet that
repeats the page (TRIAGE5 S3); on a game page it opens the Games sheet
```

**Before `var GLYPH = { fibonacci: "spiral", two: "sq:2", endless: "sq:2", three...`**

```text
---- end cards (REDESIGN.md 2.2, TRIAGE4 family): every .over card on the page gets its game's 56 px glyph on top,
once, so all ten cards match without each game drawing it ----
```

**Before `var more = function () { o.classList.toggle("over-more", o.scrollTop +...`**

```text
a card too tall for a small board scrolls with its buttons pinned (theme.css); .over-more draws the edge above the
buttons while anything is hidden under them, so the player sees there is more
```

**Before `w.addEventListener("keydown", function (e) {`**

```text
capture on window: runs before any game listener. Esc closes, Tab is trapped, and a key aimed outside the
sheet (focus left on the page) never reaches the game.
```

**Before `scrim.addEventListener("keydown", function (e) { if (cur && cur.scrim ...`**

```text
keys typed inside the sheet stay in it (games listen on document or window, in the bubble phase)
(only while this sheet is the open one: a key that reaches a closed sheet's node is the page's)
```

**Before `var a = doc.activeElement;`**

```text
focus never stays on a node of the hidden sheet: when the opener could not take it (the body, or a sheet that
opened by itself), let it go now, so the very next key reaches the game (the browser would only drop it at the
next frame)
```

## seven/game.js

**File header**

```text
Numberics Seven: browser client. engine.js owns every rule; this file draws, listens and remembers.
A drop returns a wave-by-wave trace; the client plays it on NumbericsMotion's keyed layer (REDESIGN.md 5.5): the disc
falls with gravity and settles, each wave pops, cracks its eggs and lets the column above fall, the rising row slides
up. Every disc keeps its node (identity-keyed, never rebuilt per drop). A new input finishes the running animation
(end state at once, the pending sounds at once, one of each: TRIAGE4 D7) and is applied at once. Under reduced motion (Settings, then the OS, read
at each drop) the settled well shows at once and new discs fade in.
```

**Before `var sfx = M.sfx, buzz = M.buzz;`**

```text
sounds and haptics (REDESIGN.md 6.4, 7.3), called at the visual moment from inside the motion timeline; the
family's one rule (shared/motion.js, TRIAGE4 D7): while finish() runs the pending steps at once, their sounds play
then, one of each (a chain's pops sound once), never dropped
```

**Before `function nat(v, min) { return Number.isInteger(v) && v >= (min || 0); ...`**

```text
---- saved data: one run per mode, best score per mode ----
Every field the client or engine reads is checked, and prev (the Undo snapshot) is checked the same way. A run that
has ended or sits on the brink has 0 drops left, and must load as it is (else the finished Daily came back fresh).
```

**Before `function current() { return today === K.daySeed(); }`**

```text
TRIAGE4 D9: today's Daily is one run. Once it has ended it stays on screen, finished, until the day changes; a run
started before midnight is yesterday's (today is the day the run began) and never counts for the new day.
```

**Before `function storedRun(s, m) {`**

```text
---- two tabs (TRIAGE5 S13): storage is shared, a tab's memory is not. Every save keeps each mode's higher best
(stored or this tab's) and takes the runs of the modes this tab is not playing as another tab left them, and today's
finished Daily is never replaced by an unfinished one. Before a Daily drop or power-up, and when the tab shows
again, the stored Daily is read back, so a stale tab can neither replay today's Daily nor lower a saved best. ----
```

**Before `var seen = JSON.stringify(runs.daily || null);`**

```text
the stored Daily replaces this tab's when another tab wrote it since this tab last saved or read it (seen): true
when the screen must redraw
```

**Before `var brink = !!state.overflow, over = $("over");`**

```text
one end-card pattern (TRIAGE3): while a card shows, the page's New game is hidden with its space kept, and
focus moves to the card's primary button. On the brink (TRIAGE3 stuck-not-over) the card offers Undo or End.
```

**Before `$("new").style.visibility = over.hidden && !(dailyLocked() && !state.o...`**

```text
while today's Daily is being played there is nothing to start (TRIAGE5 S14): the page's button is hidden, space
kept, and the mode switch above the well is the way back to Classic; once it is done the button offers Classic
```

**Before `function settle() {`**

```text
the done callback of every trace: draw the settled well, and if the run just ended (or overflowed with an Undo
in stock), hold it in view first
```

**Before `function plan(trace, from) {`**

```text
---- playing a trace on the keyed layer (REDESIGN.md 5.5). plan() is pure: it walks the engine's trace and gives
each step the identity map before and after it, so the timeline only syncs the layer; finish() runs the steps
left at once, in order, and the well lands on the engine's grid. ----
```

**Before `function liftToast() {`**

```text
---- the toast never covers the level line (cold #30). The shared toast centres on the hint line, and in Seven that
line is the level and drops count, read on every drop; so here a toast (a chain, a power-up, a trophy) sits over
the title instead, which nobody taps. When the title is scrolled out of view the shared place stays. ----
On a wide screen the stats share the title's row: the toast then starts at the title's left edge and must end
before the stats (the score counts up during a chain), or it stays in the shared place.
```

**Before `function md(v, cls) {`**

```text
---- how to play (REDESIGN.md 1.3, 9.7): three steps, each a small drawn well and one sentence, in the shared sheet.
It opens by itself once, on a first visit with nothing saved; the How to play row under the board always has it. ----
```

## five/game.js

**Before `var m = state.matchOver, rw = state.roundOver, n = " round " + state.r...`**

```text
R8: a white one-line headline, one summary line, the gold primary button.
Round 3 wording: "You win round N" / "The computer wins round N" / "Draw in round N"; a match reads
"You win" / "The computer wins". Sublines are "<detail> · <score>".
```

**Before `var SHARD_D = [0.48, 0.64, 0.56, 0.70, 0.52, 0.66, 0.60, 0.46], SHARD_...`**

```text
8 shards (craft #3: clearly visible): 12% squares in the tile's own hue made bright, every other one gold, with a
glow; out 45 to 70% of the tile, turning 90 to 180 degrees (a fixed table)
```

**Before `var FLY_C = (String(M.E.fly).match(/-?\d*\.?\d+/g) || []).map(Number);`**

```text
craft #3: where the flying copy must be gone. The copy fades from 10% overlap with the target to 45% (before it would
reach the target's number at half); the landing is at 45%. Offsets are in the flight's eased progress (WAAPI keyframe
offsets follow the effect easing); t is the landing as a share of the flight time, from the --e-fly curve.
```

**Before `f.classList.add("fly"); f.textContent = "+" + prev[last.from]; place(f...`**

```text
the copy reads "+3", not a second "3" (craft nit). Craft #3 (round 4): it fades out as it reaches the target,
gone before it covers half of it, and the number changes at that landing instant (land), so "+3" never sits
on the target and the target never waits under it. Its own (unanimated) opacity is 0, so a dropped fill
can never flash the copy back on its source.
```

**Before `if (!state.undone && armed !== "undo") {`**

```text
S12: the Undo that starts the no-reward rest of the round asks first (the family's two-step "Sure?": the button
lights as armed and the hint line says the cost; the ask lapses after 3 s). Once a round is unpaid, Undo is free.
```

## four/game.js

**File header**

```text
Numberics Four: browser client. four/engine.js owns every rule (and the computer);
this file only draws, listens, and remembers.
Motion (docs/design/REDESIGN.md 5.5): every disc is a keyed node in a NumbericsMotion layer. A dropped disc (yours
or the computer's) falls from one slot above the board with gravity and settles; Pop drops the discs above by one
slot; the winning line is drawn through the four centres. A new input finishes the running animation first and is
applied at once; sounds sit on their own timeline and follow the family's one rule (shared/motion.js, TRIAGE4 D7):
a new input plays the pending ones at once, one of each, never dropped.
```
