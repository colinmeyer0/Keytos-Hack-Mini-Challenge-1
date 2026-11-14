import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../js/config.js';
import {
  createGame, startGame, tick, closeWindow, dodgeWindow, moveWindow,
  timeRemainingMs, remainingCount,
} from '../js/game.js';

const VP = { width: 1366, height: 768 };

function mulberry32(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function make(overrides = {}, viewport = VP, rng = mulberry32(1)) {
  return createGame({ config: { ...CONFIG, ...overrides }, viewport, rng });
}

test('queue matches QUEUE_COUNTS', () => {
  const g = make();
  const total = Object.values(CONFIG.QUEUE_COUNTS).reduce((a, b) => a + b, 0);
  assert.equal(g.queue.length, total);
  assert.equal(g.queue.filter((t) => t === 'trap').length, CONFIG.QUEUE_COUNTS.trap);
  assert.equal(g.status, 'ready');
  assert.equal(g.nextId, 1);
});

test('startGame spawns INITIAL_BURST', () => {
  const g = make();
  const events = startGame(g);
  const total = Object.values(CONFIG.QUEUE_COUNTS).reduce((a, b) => a + b, 0);
  assert.equal(events.filter((e) => e.type === 'spawn').length, CONFIG.INITIAL_BURST);
  assert.equal(g.queue.length, total - CONFIG.INITIAL_BURST);
  assert.equal(g.status, 'running');
  assert.deepEqual(startGame(g), []);
});

test('tick spawns one window per interval', () => {
  const g = make();
  startGame(g);
  const events = tick(g, 2500);
  assert.equal(events.filter((e) => e.type === 'spawn').length, 2);
  assert.equal(g.sinceSpawnMs, 500);
  assert.equal(g.elapsedMs, 2500);
});

test('tick before start does nothing', () => {
  const g = make();
  assert.deepEqual(tick(g, 5000), []);
  assert.equal(g.elapsedMs, 0);
});

test('spawned windows fit inside a small viewport', () => {
  const vp = { width: 800, height: 500 };
  const cfg = { MAX_OPEN_WINDOWS: 1000, INITIAL_BURST: 20 };
  const draws = [0, 0.999999, 0.5];
  for (let seed = 0; seed < 50; seed++) {
    const base = mulberry32(seed);
    let n = 0;
    // mix extreme draws with seeded ones
    const rng = () => (seed % 3 === 0 ? draws[n++ % 3] : base());
    const g = make(cfg, vp, rng);
    startGame(g);
    for (const w of g.windows) {
      assert.ok(w.x >= 0 && w.y >= 0);
      assert.ok(w.x + w.width <= vp.width, `x overflow ${w.x}`);
      assert.ok(w.y + w.height <= vp.height - CONFIG.TASKBAR_HEIGHT, `y overflow ${w.y}`);
    }
  }
});

test('hydra fake spawns 3 normals and stays; real closes it', () => {
  const g = make({ QUEUE_COUNTS: { hydra: 1 }, INITIAL_BURST: 1 });
  startGame(g);
  const hydra = g.windows[0];
  assert.equal(hydra.type, 'hydra');
  assert.ok(hydra.fakeSide === 'left' || hydra.fakeSide === 'right');
  const events = closeWindow(g, hydra.id, 'fake');
  assert.equal(events.filter((e) => e.type === 'spawn').length, 3);
  assert.equal(g.windows.length, 4);
  assert.ok(g.windows.some((w) => w.id === hydra.id));
  for (const e of events) {
    assert.equal(e.window.type, 'normal');
    assert.ok(e.window.x >= 0 && e.window.x + e.window.width <= VP.width);
    assert.ok(e.window.y >= 0 && e.window.y + e.window.height <= VP.height - CONFIG.TASKBAR_HEIGHT);
  }
  const real = closeWindow(g, hydra.id, 'real');
  assert.deepEqual(real, [{ type: 'close', id: hydra.id }]);
  assert.equal(g.windows.length, 3);
});

test('hydra children spawn spread out, away from the hydra and each other', () => {
  const g = make({ QUEUE_COUNTS: { hydra: 1 }, INITIAL_BURST: 1 });
  startGame(g);
  const hydra = g.windows[0];
  const { maxX, maxY } = { maxX: VP.width - CONFIG.WINDOW_WIDTH, maxY: VP.height - CONFIG.TASKBAR_HEIGHT - CONFIG.WINDOW_HEIGHT };
  moveWindow(g, hydra.id, maxX / 2, maxY / 2);
  const kids = closeWindow(g, hydra.id, 'fake').map((e) => e.window);
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  for (const k of kids) assert.ok(dist(k, hydra) >= 200, `child too close to hydra: ${dist(k, hydra)}`);
  for (let i = 0; i < kids.length; i++) {
    for (let j = i + 1; j < kids.length; j++) {
      assert.ok(dist(kids[i], kids[j]) >= 200, `children too close: ${dist(kids[i], kids[j])}`);
    }
  }
});

test('hydra spam respects MAX_OPEN_WINDOWS', () => {
  const g = make({ QUEUE_COUNTS: { hydra: 1 }, INITIAL_BURST: 1, MAX_OPEN_WINDOWS: 5 });
  startGame(g);
  const hydra = g.windows[0];
  for (let i = 0; i < 5; i++) closeWindow(g, hydra.id, 'fake');
  assert.ok(g.windows.length <= 5);
  assert.equal(g.windows.length, 5);
});

test('closing a trap costs TRAP_PENALTY_MS', () => {
  const g = make({ QUEUE_COUNTS: { trap: 1, normal: 1 }, INITIAL_BURST: 2 });
  startGame(g);
  const trap = g.windows.find((w) => w.type === 'trap');
  const before = timeRemainingMs(g);
  const events = closeWindow(g, trap.id, 'real');
  assert.equal(before - timeRemainingMs(g), CONFIG.TRAP_PENALTY_MS);
  assert.deepEqual(events.map((e) => e.type), ['close', 'penalty']);
  assert.equal(events[1].ms, CONFIG.TRAP_PENALTY_MS);
  assert.equal(events[1].id, trap.id);
});

test('dodger dodges DODGE_LIMIT times then stops', () => {
  const g = make({ QUEUE_COUNTS: { dodger: 1 }, INITIAL_BURST: 1 });
  startGame(g);
  const d = g.windows[0];
  assert.equal(d.dodgesLeft, 3);
  assert.equal(dodgeWindow(g, d.id, 10, 20), true);
  assert.equal(dodgeWindow(g, d.id, 30, 40), true);
  assert.equal(dodgeWindow(g, d.id, 50, 60), true);
  assert.equal(dodgeWindow(g, d.id, 70, 80), false);
  assert.equal(d.x, 50);
  assert.equal(d.y, 60);
  moveWindow(g, d.id, 5, 6);
  assert.equal(d.x, 5);
  assert.equal(d.y, 6);
});

test('win when only traps remain', () => {
  const g = make({ QUEUE_COUNTS: { normal: 2, trap: 1 }, INITIAL_BURST: 3 });
  startGame(g);
  const normals = g.windows.filter((w) => w.type === 'normal');
  closeWindow(g, normals[0].id, 'real');
  assert.equal(g.status, 'running');
  const events = closeWindow(g, normals[1].id, 'real');
  assert.equal(events[events.length - 1].type, 'won');
  assert.equal(g.status, 'won');
});

test('lose when time runs out, once', () => {
  const g = make();
  startGame(g);
  const events = tick(g, 31000);
  assert.ok(events.some((e) => e.type === 'lost'));
  assert.equal(g.status, 'lost');
  assert.deepEqual(tick(g, 100), []);
});

test('remainingCount excludes traps', () => {
  const g = make({ QUEUE_COUNTS: { normal: 3, trap: 2 }, INITIAL_BURST: 3 });
  startGame(g);
  assert.equal(remainingCount(g), g.queue.filter((t) => t !== 'trap').length + g.windows.filter((w) => w.type !== 'trap').length);
  const g2 = make({ QUEUE_COUNTS: { trap: 2, normal: 1 }, INITIAL_BURST: 3 });
  startGame(g2);
  assert.equal(remainingCount(g2), 1);
});

test('remainingCount ignores queued traps (no HUD tell when a trap spawns)', () => {
  const g = make({ QUEUE_COUNTS: { normal: 2, trap: 3 }, INITIAL_BURST: 0 });
  startGame(g);
  assert.equal(g.queue.length, 5);
  assert.equal(remainingCount(g), 2);
  const before = remainingCount(g);
  // Force a queued trap to spawn: count must not change.
  g.queue = ['trap', 'normal', 'normal', 'trap', 'trap'];
  tick(g, g.config.SPAWN_INTERVAL_MS);
  assert.equal(g.windows.filter((w) => w.type === 'trap').length, 1);
  assert.equal(remainingCount(g), before);
});

test('capped timed spawn consumes interval without spinning and keeps queue', () => {
  const g = make({ QUEUE_COUNTS: { normal: 5 }, INITIAL_BURST: 2, MAX_OPEN_WINDOWS: 2 });
  startGame(g);
  const events = tick(g, 3500);
  assert.deepEqual(events, []);
  assert.equal(g.queue.length, 3);
  assert.ok(g.sinceSpawnMs < CONFIG.SPAWN_INTERVAL_MS);
});
