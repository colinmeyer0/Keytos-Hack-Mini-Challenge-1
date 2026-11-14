# Exit Verification Challenge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A localhost web page where cancelling a fake "StreamVault+" subscription requires closing a flood of fake OS popup windows (hydras, traps, dodgers) before a 30s timer runs out.

**Architecture:** Pure game logic (`game.js`, `dodge.js`) is DOM-free, event-returning, and unit tested with `node --test`. A DOM renderer (`windows.js`) draws windows and reports clicks/drags. `main.js` wires screens, fullscreen, the `requestAnimationFrame` loop, and applies game events to the renderer and sound.

**Tech Stack:** Plain HTML/CSS/ES modules, no dependencies, no build. Node 24 built-in test runner. Served via `python3 -m http.server 8000`.

**Spec:** `docs/superpowers/specs/2026-11-13-popup-cancel-design.md`

## Global Constraints

- No npm dependencies, no bundler. Browser code is ES modules loaded via `<script type="module" src="js/main.js">`.
- All modules under `js/` must be importable in Node (no DOM access at import time) except `windows.js`, `sound.js`, `main.js`.
- Fake service name: **StreamVault+**. No real brands, no copied OS look (original 90s-style chrome), PG copy.
- Must remain winnable: dodgers tire after `DODGE_LIMIT`, open windows capped at `MAX_OPEN_WINDOWS`, fake hydra button glyph `✕` (U+2715) vs real `×` (U+00D7).
- All tunables live in `js/config.js`; no magic numbers elsewhere.
- Parallel implementers do **not** run `git commit`; the controller commits after review.

## Review Focus

1. **Small viewport (1366×768 laptop, or devtools open):** every spawned window must lie fully inside `[0, width-w] × [0, height-TASKBAR_HEIGHT-h]` — test in Task 3.
2. **Esc out of fullscreen mid-run:** run is voided, rAF loop stops, windows cleared, intro shown with a message; no ghost timer — check in Task 5 smoke test.
3. **Retry after a loss:** fresh game state, single rAF loop, no duplicated document listeners (timer must not run 2× speed) — check in Task 5 smoke test.
4. **Spamming a hydra's fake button:** open windows never exceed `MAX_OPEN_WINDOWS` — test in Task 3.
5. **Dodger in a corner:** still moves to a different position rather than sticking — test in Task 2.

---

### Task 1: Scaffold, config, and copy

**Files:**
- Create: `package.json`, `js/config.js`, `js/content.js`, `tests/content.test.mjs`

**Interfaces:**
- Produces:
  - `export const CONFIG` in `js/config.js`:
    ```js
    { TIME_LIMIT_MS: 30000, QUEUE_COUNTS: { normal: 8, hydra: 4, trap: 4, dodger: 4 },
      INITIAL_BURST: 6, SPAWN_INTERVAL_MS: 1000, HYDRA_SPAWN_COUNT: 3, TRAP_PENALTY_MS: 5000,
      MAX_OPEN_WINDOWS: 30, DODGE_RADIUS: 110, DODGE_DISTANCE: 160, DODGE_LIMIT: 3,
      WINDOW_WIDTH: 300, WINDOW_HEIGHT: 170, TASKBAR_HEIGHT: 40 }
    ```
  - `export const COPY` in `js/content.js`: `{ normal, hydra, trap, dodger }`, each an array of ≥5 `{ title: string, body: string }`.
  - `export function pickCopy(type: 'normal'|'hydra'|'trap'|'dodger', rng = Math.random): { title, body }` — `COPY[type][Math.floor(rng() * len)]`.

Copy tone: guilt-trip lines for normal/hydra/dodger ("Your playlists will be shredded.", "Mom subscribed you for a reason."). Trap copy must say, via double negatives, that closing this window keeps the subscription — readable if you slow down, e.g. title "Do Not Not Close", body "Closing this window will un-cancel your cancellation. Don't not leave it open."

- [ ] **Step 1:** Create `package.json`: `{ "name": "exit-verification", "private": true, "type": "module", "scripts": { "test": "node --test tests/", "serve": "python3 -m http.server 8000" } }`.
- [ ] **Step 2: Write failing test** `tests/content.test.mjs`:
  - `every COPY list has >= 5 entries with non-empty title and body`
  - `pickCopy('trap', () => 0) === COPY.trap[0]`
  - `pickCopy('normal', () => 0.9999) === COPY.normal[COPY.normal.length - 1]`
- [ ] **Step 3:** Run `npm test` — Expected: FAIL (module not found).
- [ ] **Step 4:** Implement `js/config.js` and `js/content.js` per Interfaces.
- [ ] **Step 5:** Run `npm test` — Expected: PASS.

---

### Task 2: Dodge math

**Files:**
- Create: `js/dodge.js`, `tests/dodge.test.mjs`

**Interfaces:**
- Produces: `export function computeDodge({ rect: {x, y, width, height}, target: {x, y}, cursor: {x, y}, viewport: {width, height}, radius, distance, taskbarHeight }): {x, y} | null`
  - `target` = close-button center (page coords). Returns `null` if `hypot(cursor - target) > radius`.
  - Otherwise moves the window by `distance` along the unit vector from cursor → target (if cursor === target use `{1, 0}`), clamped to `x ∈ [0, viewport.width - width]`, `y ∈ [0, viewport.height - taskbarHeight - height]` (floor at 0).
  - If the clamped position is within 20px of the original on both axes (cornered), move by `distance` in the opposite direction instead (also clamped).

- [ ] **Step 1: Write failing tests** `tests/dodge.test.mjs` (viewport 1000×800, taskbar 40, rect 300×170, radius 110, distance 160):
  - `returns null when cursor is outside radius`
  - `cursor left of target moves window right` → `result.x > rect.x`, `result.y === rect.y`
  - `result stays inside viewport` for rect at `{x: 690, y: 580}` with cursor left of target → `x <= 700 && y <= 590`
  - `cornered window still moves` — rect at `{x: 700, y: 590}`, target at its top-right, cursor up-left of target → result differs from rect by > 20px on at least one axis
- [ ] **Step 2:** Run `node --test tests/dodge.test.mjs` — Expected: FAIL.
- [ ] **Step 3:** Implement `computeDodge` in `js/dodge.js`.
- [ ] **Step 4:** Run `node --test tests/dodge.test.mjs` — Expected: PASS.

---

### Task 3: Game state machine

**Files:**
- Create: `js/game.js`, `tests/game.test.mjs`

**Interfaces:**
- Consumes: `CONFIG` (`js/config.js`), `pickCopy` (`js/content.js`).
- Produces (all in `js/game.js`):
  - `createGame({ config = CONFIG, viewport: {width, height}, rng = Math.random }): Game`
  - `Game = { config, viewport, rng, windows: Win[], queue: Type[], elapsedMs, penaltyMs, sinceSpawnMs, status: 'ready'|'running'|'won'|'lost', nextId }`
  - `Win = { id: number, type: Type, x, y, width, height, title, body, fakeSide: 'left'|'right'|null, dodgesLeft: number }` — `fakeSide` set (random) only for hydra; `dodgesLeft = DODGE_LIMIT` for dodger, else 0.
  - `Event = {type:'spawn', window: Win} | {type:'close', id} | {type:'penalty', id, ms} | {type:'won'} | {type:'lost'}`
  - `startGame(game): Event[]` — status → `'running'`, spawns `INITIAL_BURST` from the queue.
  - `tick(game, dtMs): Event[]` — `[]` unless running. Adds dt to `elapsedMs` and `sinceSpawnMs`; while `sinceSpawnMs >= SPAWN_INTERVAL_MS` and queue non-empty: spawn one, subtract interval. Then end check.
  - `closeWindow(game, id, which: 'real'|'fake'): Event[]` — `[]` unless running and id exists. Hydra + `'fake'`: spawn `HYDRA_SPAWN_COUNT` `normal` windows offset ±40px from the hydra (clamped), hydra stays. Trap: remove, `penaltyMs += TRAP_PENALTY_MS`, emit `close` then `penalty`. Otherwise remove and emit `close`. Then end check.
  - `dodgeWindow(game, id, x, y): boolean` — only for dodger with `dodgesLeft > 0`: set position, decrement, return true; else false.
  - `moveWindow(game, id, x, y): void`
  - `timeRemainingMs(game): number` — `max(0, TIME_LIMIT_MS - elapsedMs - penaltyMs)`
  - `remainingCount(game): number` — `queue.length` + open non-trap windows.
- Rules:
  - Queue = shuffled (Fisher–Yates with `rng`) list from `QUEUE_COUNTS`.
  - Any spawn is skipped if `windows.length >= MAX_OPEN_WINDOWS` (queue items stay queued; hydra extras are dropped).
  - Spawn position uniform in `[0, max(0, vw - WINDOW_WIDTH)] × [0, max(0, vh - TASKBAR_HEIGHT - WINDOW_HEIGHT)]`.
  - End check (win before loss): running, queue empty, and every open window is a trap → status `'won'`, emit `won`. Else if `timeRemainingMs === 0` → status `'lost'`, emit `lost`.

- [ ] **Step 1: Write failing tests** `tests/game.test.mjs` (viewport 1366×768 unless stated; use `cfg = {...CONFIG, ...overrides}`):
  - `queue matches QUEUE_COUNTS` — length 20, 4 traps
  - `startGame spawns INITIAL_BURST` — 6 spawn events, `queue.length === 14`, status running
  - `tick spawns one window per interval` — `tick(g, 2500)` → 2 spawns, `sinceSpawnMs === 500`
  - `tick before start does nothing` → `[]`
  - `spawned windows fit inside a small viewport` — viewport 800×500, 50 random rng draws: every window within bounds (Review Focus 1)
  - `hydra fake spawns 3 normals and stays; real closes it` — counts `{hydra: 1}`
  - `hydra spam respects MAX_OPEN_WINDOWS` — counts `{hydra: 1}`, `MAX_OPEN_WINDOWS: 5`, fake ×5 → `windows.length <= 5` (Review Focus 4)
  - `closing a trap costs TRAP_PENALTY_MS` — `timeRemainingMs` drops by 5000, events `close` + `penalty`
  - `dodger dodges DODGE_LIMIT times then stops` — 3× true, 4th false
  - `win when only traps remain` — counts `{normal: 2, trap: 1}`, burst 3: close both normals → last event `won`, status won
  - `lose when time runs out, once` — `tick(g, 31000)` includes `lost`; next `tick` returns `[]`
  - `remainingCount excludes traps`
- [ ] **Step 2:** Run `node --test tests/game.test.mjs` — Expected: FAIL.
- [ ] **Step 3:** Implement `js/game.js`.
- [ ] **Step 4:** Run `npm test` — Expected: all PASS.

---

### Task 4: Page shell, styles, window renderer, sound

**Files:**
- Create: `index.html`, `css/styles.css`, `js/windows.js`, `js/sound.js`

**Interfaces:**
- Consumes: `Win` shape from Task 3.
- Produces:
  - DOM IDs in `index.html` (toggle visibility with class `.hidden`):
    - `#screen-account` — StreamVault+ account page; plan, fake benefits, big green "Upgrade" CTA, and a tiny grey `#btn-cancel` "cancel subscription" link at the bottom. `#account-banner` (hidden by default) for messages.
    - `#screen-intro` — modal: "Exit Verification Challenge™", rules text ("Close all popups within 30 seconds to prove you really want to leave."), `#intro-message` (empty, for warnings), `#btn-begin`.
    - `#desktop` — full-viewport fake OS desktop (original gradient wallpaper); contains `#windows` (absolute layer) and `#taskbar` (height 40px, bottom) with `#timer`, `#remaining`, `#clock`. `#toast` element for brief messages.
    - `#screen-result` — fail dialog: `#result-title`, `#result-body`, `#btn-retry` (small, grey), `#btn-keep` (huge green "Keep my subscription").
    - `#screen-cancelled` — win page: "Your subscription has been cancelled." with a sad-but-PG farewell.
    - `<script type="module" src="js/main.js">` (main.js is Task 5; page must not error if it is absent).
  - `js/windows.js`: `export function createRenderer(layerEl, { onClose(id, which), onMove(id, x, y) })` returning:
    - `add(win)` — builds `.win[data-id][data-type]` absolutely positioned at `win.x/y`, size `win.width/height`; `.win-titlebar` (`.win-title` + `.win-buttons`); `.win-body` with text and an "OK" button that only shakes the window (class `.shake`, ~400ms). Close button(s): `<button class="win-close" data-close="real">×</button>`; hydra additionally gets `data-close="fake"` with `✕`, ordered by `fakeSide`.
    - `remove(id)`, `clear()`, `move(id, x, y, animate = false)` (animate → `.dodging` class with ~150ms left/top transition), `closeButtonCenter(id): {x, y} | null` (real button's center from `getBoundingClientRect`), `shake(id)`.
    - Pointerdown anywhere on a window raises it (incrementing z-index). Pointer-drag on the title bar (not on buttons) moves it, clamped to the layer; calls `onMove` on release.
  - `js/sound.js`: `playSpawn()`, `playClose()`, `playError()`, `playWin()`, `playLose()` — WebAudio oscillator blips, lazily created `AudioContext`, all errors swallowed.

- [ ] **Step 1:** Write `index.html` and `css/styles.css`. Retro but original: beveled grey windows, gradient title bars, pixel-ish system font stack (`Tahoma, Verdana, sans-serif`). Account page looks like a slick modern SaaS page (contrast with the desktop).
- [ ] **Step 2:** Implement `js/windows.js` and `js/sound.js` per Interfaces.
- [ ] **Step 3: Verify** — `python3 -m http.server 8000` and load `http://localhost:8000/` with a temporary inline script (or devtools) that calls `createRenderer(document.getElementById('windows'), {...})` and `add()`s one window of each type, unhiding `#desktop`. Expected: windows render, hydra shows two close buttons, drag works, clicking a close button calls `onClose` with the right `which`. Remove the temporary script.

---

### Task 5: Wire it together

**Files:**
- Create: `js/main.js`

**Interfaces:**
- Consumes: everything above.

Behavior:
- On load: show `#screen-account` only.
- `#btn-cancel` → show `#screen-intro` (clear `#intro-message`).
- `#btn-begin` / `#btn-retry` → `beginRun()`: `await document.documentElement.requestFullscreen()` in try/catch (record `enteredFullscreen`), hide other screens, show `#desktop`, `renderer.clear()`, `game = createGame({ viewport: {width: innerWidth, height: innerHeight} })`, apply `startGame(game)`, start a single rAF loop (cancel any previous one first).
- Loop: `dt = now - last` (cap at 250ms), apply `tick(game, dt)`, update `#timer` (`(ms/1000).toFixed(1)`), `#remaining`, `#clock`.
- `apply(events)`: spawn → `renderer.add` + `playSpawn`; close → `renderer.remove` + `playClose`; penalty → `playError`, toast "−5s: that window said NOT to close it"; won → `endRun(true)`; lost → `endRun(false)`.
- Renderer handlers: `onClose(id, which) → apply(closeWindow(game, id, which))`; `onMove → moveWindow`.
- One document `mousemove` listener (registered once at load): if running, for each dodger with `dodgesLeft > 0`, `computeDodge` with `renderer.closeButtonCenter(id)` and config values; if a position comes back and `dodgeWindow(...)` returns true, `renderer.move(id, x, y, true)`.
- One `fullscreenchange` listener (registered once): if running, `enteredFullscreen`, and `!document.fullscreenElement` → stop loop, `renderer.clear()`, hide desktop, show intro with `#intro-message` = "Exiting fullscreen voids your verification. Please start over."
- `endRun(won)`: stop loop, `renderer.clear()`, exit fullscreen if active, hide desktop. Won → `playWin`, show `#screen-cancelled`. Lost → `playLose`, show `#screen-result` with guilt copy ("Verification failed. Your subscription has been renewed for your convenience.").
- `#btn-keep` → show `#screen-account` with `#account-banner` "Thanks for staying! We knew you would."

- [ ] **Step 1:** Implement `js/main.js`.
- [ ] **Step 2:** Run `npm test` — Expected: PASS (unchanged).
- [ ] **Step 3: Smoke test in a browser** at `http://localhost:8000/`: full flow account → intro → run; close windows; hydra fake spawns more; trap costs 5s; dodgers move then stop; let timer expire → fail screen; retry → timer runs at normal speed (Review Focus 3); Esc mid-run → intro with void message (Review Focus 2); win a run (temporarily raise `TIME_LIMIT_MS` if needed, then restore) → cancelled screen.
