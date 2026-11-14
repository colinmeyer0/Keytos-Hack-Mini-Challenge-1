import { CONFIG } from './config.js';
import {
  createGame,
  startGame,
  tick,
  closeWindow,
  dodgeWindow,
  moveWindow,
  timeRemainingMs,
  remainingCount,
} from './game.js';
import { computeDodge } from './dodge.js';
import { createRenderer } from './windows.js';
import { playSpawn, playClose, playError, playWin, playLose } from './sound.js';

const $ = (id) => document.getElementById(id);

const screens = {
  account: $('screen-account'),
  intro: $('screen-intro'),
  desktop: $('desktop'),
  result: $('screen-result'),
  cancelled: $('screen-cancelled'),
};
const el = {
  banner: $('account-banner'),
  introMessage: $('intro-message'),
  toast: $('toast'),
  timer: $('timer'),
  remaining: $('remaining'),
  clock: $('clock'),
  resultTitle: $('result-title'),
  resultBody: $('result-body'),
};

// Dodgers animate for ~150ms; ignore the cursor while a dodge is in flight so
// one sweep of the mouse cannot burn through all of a window's dodges.
const DODGE_COOLDOWN_MS = 200;
const FULLSCREEN_WAIT_MS = 2000;

let game = null;
let runActive = false;
let starting = false;
let enteredFullscreen = false;
let rafId = 0;
let fallbackId = 0;
let loopGen = 0;
let lastFrame = 0;
let toastTimer = 0;
const lastDodgeAt = new Map(); // window id -> performance.now() of last dodge

function show(name) {
  for (const [key, node] of Object.entries(screens)) {
    node.classList.toggle('hidden', key !== name);
  }
}

function showToast(text) {
  el.toast.textContent = text;
  el.toast.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.toast.classList.add('hidden'), 2000);
}

function hideToast() {
  clearTimeout(toastTimer);
  el.toast.classList.add('hidden');
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function updateHud() {
  if (!game) return;
  el.timer.textContent = (timeRemainingMs(game) / 1000).toFixed(1);
  el.remaining.textContent = String(remainingCount(game));
  const now = new Date();
  el.clock.textContent = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
}

function stopLoop() {
  if (rafId) cancelAnimationFrame(rafId);
  rafId = 0;
  if (fallbackId) clearInterval(fallbackId);
  fallbackId = 0;
  loopGen += 1; // invalidate any frame callback already in flight
}

function startLoop() {
  stopLoop();
  const gen = loopGen;
  lastFrame = performance.now();
  rafId = requestAnimationFrame((now) => rafFrame(gen, now));
  // Fallback driver: when rAF is throttled or never fires (embedded or occluded
  // windows), advance the same step from a timer. It only acts when no frame has
  // run recently, so it never double-ticks alongside a healthy rAF loop.
  fallbackId = setInterval(() => {
    if (gen !== loopGen) return;
    const now = performance.now();
    if (now - lastFrame > CONFIG.LOOP_STALE_MS) step(now);
  }, CONFIG.LOOP_FALLBACK_MS);
}

function rafFrame(gen, now) {
  if (gen !== loopGen) return;
  rafId = 0;
  step(now);
  if (gen === loopGen && runActive) {
    rafId = requestAnimationFrame((t) => rafFrame(gen, t));
  }
}

// One simulation step, shared by the rAF and fallback drivers.
function step(now) {
  if (!runActive || !game) return;
  const dt = Math.min(250, Math.max(0, now - lastFrame));
  lastFrame = now;
  apply(tick(game, dt));
  if (runActive) updateHud();
}

const renderer = createRenderer($('windows'), {
  onClose(id, which) {
    if (!runActive) return;
    apply(closeWindow(game, id, which));
  },
  onMove(id, x, y) {
    if (!runActive) return;
    moveWindow(game, id, x, y);
  },
});

function apply(events) {
  for (const ev of events) {
    if (!runActive) return;
    switch (ev.type) {
      case 'spawn':
        renderer.add(ev.window);
        playSpawn();
        break;
      case 'close':
        renderer.remove(ev.id);
        lastDodgeAt.delete(ev.id);
        playClose();
        break;
      case 'penalty':
        playError();
        showToast(`−${ev.ms / 1000}s: that window said NOT to close it`);
        break;
      case 'won':
        endRun(true);
        break;
      case 'lost':
        endRun(false);
        break;
    }
  }
  updateHud();
}

function teardownRun() {
  runActive = false;
  stopLoop();
  renderer.clear();
  lastDodgeAt.clear();
  hideToast();
}

function exitFullscreenIfActive() {
  if (document.fullscreenElement) {
    const p = document.exitFullscreen();
    if (p && p.catch) p.catch(() => {});
  }
}

function endRun(won) {
  if (!runActive) return;
  teardownRun();
  exitFullscreenIfActive();
  if (won) {
    playWin();
    show('cancelled');
  } else {
    playLose();
    el.resultTitle.textContent = 'Verification failed.';
    el.resultBody.textContent = 'Your subscription has been renewed for your convenience.';
    show('result');
  }
}

async function beginRun() {
  if (starting || runActive) return;
  starting = true;
  try {
    enteredFullscreen = false;
    try {
      // Race a timeout so a request that never settles cannot strand the player on the intro.
      await Promise.race([
        document.documentElement.requestFullscreen(),
        new Promise((resolve) => setTimeout(resolve, FULLSCREEN_WAIT_MS)),
      ]);
      enteredFullscreen = !!document.fullscreenElement;
    } catch (err) {
      enteredFullscreen = false;
    }
    if (enteredFullscreen) {
      // Let the browser settle the new viewport size before measuring it.
      // Raced with a timeout: rAF may never fire in occluded or embedded windows.
      await new Promise((resolve) => {
        setTimeout(resolve, CONFIG.RAF_SETTLE_MAX_MS);
        requestAnimationFrame(() => resolve());
      });
    }
    teardownRun();
    show('desktop');
    game = createGame({ viewport: { width: window.innerWidth, height: window.innerHeight } });
    runActive = true;
    apply(startGame(game));
    if (runActive) {
      updateHud();
      startLoop();
    }
  } finally {
    starting = false;
  }
}

// ---- Screen wiring (registered once at load) ----

$('btn-cancel').addEventListener('click', (e) => {
  e.preventDefault();
  el.introMessage.textContent = '';
  show('intro');
});

$('btn-begin').addEventListener('click', beginRun);
$('btn-retry').addEventListener('click', beginRun);

$('btn-cancelled-back').addEventListener('click', (e) => {
  e.preventDefault();
  el.banner.classList.add('hidden');
  el.banner.textContent = '';
  show('account');
});

$('btn-keep').addEventListener('click', () => {
  el.banner.textContent = 'Thanks for staying! We knew you would.';
  el.banner.classList.remove('hidden');
  show('account');
});

document.addEventListener('mousemove', (e) => {
  if (!runActive || !game || game.status !== 'running') return;
  const cursor = { clientX: e.clientX, clientY: e.clientY };
  const now = performance.now();
  // #windows sits at the viewport origin (#desktop is fixed inset:0), so game
  // coordinates and client coordinates are the same space.
  for (const win of game.windows) {
    if (win.type !== 'dodger' || win.dodgesLeft <= 0) continue;
    if (now - (lastDodgeAt.get(win.id) ?? -Infinity) < DODGE_COOLDOWN_MS) continue;
    const target = renderer.closeButtonCenter(win.id);
    if (!target) continue;
    const pos = computeDodge({
      rect: { x: win.x, y: win.y, width: win.width, height: win.height },
      target,
      cursor: { x: cursor.clientX, y: cursor.clientY },
      viewport: game.viewport,
      radius: CONFIG.DODGE_RADIUS,
      distance: CONFIG.DODGE_DISTANCE,
      taskbarHeight: CONFIG.TASKBAR_HEIGHT,
    });
    if (pos && dodgeWindow(game, win.id, pos.x, pos.y)) {
      lastDodgeAt.set(win.id, now);
      renderer.move(win.id, pos.x, pos.y, true);
    }
  }
});

document.addEventListener('fullscreenchange', () => {
  if (document.fullscreenElement) {
    if (runActive) enteredFullscreen = true; // fullscreen arrived after the wait timed out
    return;
  }
  if (runActive && enteredFullscreen && !document.fullscreenElement) {
    teardownRun();
    el.introMessage.textContent = 'Exiting fullscreen voids your verification. Please start over.';
    show('intro');
  }
});

show('account');
