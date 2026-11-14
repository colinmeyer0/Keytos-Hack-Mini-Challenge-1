import { CONFIG } from './config.js';
import { pickCopy } from './content.js';

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

function bounds(game) {
  const { config, viewport } = game;
  return {
    maxX: Math.max(0, viewport.width - config.WINDOW_WIDTH),
    maxY: Math.max(0, viewport.height - config.TASKBAR_HEIGHT - config.WINDOW_HEIGHT),
  };
}

function buildQueue(config, rng) {
  const queue = [];
  for (const [type, count] of Object.entries(config.QUEUE_COUNTS)) {
    for (let i = 0; i < count; i++) queue.push(type);
  }
  for (let i = queue.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [queue[i], queue[j]] = [queue[j], queue[i]];
  }
  return queue;
}

export function createGame({ config = CONFIG, viewport, rng = Math.random } = {}) {
  return {
    config,
    viewport,
    rng,
    windows: [],
    queue: buildQueue(config, rng),
    elapsedMs: 0,
    penaltyMs: 0,
    sinceSpawnMs: 0,
    status: 'ready',
    nextId: 1,
  };
}

function makeWindow(game, type, x, y) {
  const { config, rng } = game;
  const { title, body } = pickCopy(type, rng);
  const win = {
    id: game.nextId++,
    type,
    x,
    y,
    width: config.WINDOW_WIDTH,
    height: config.WINDOW_HEIGHT,
    title,
    body,
    fakeSide: type === 'hydra' ? (rng() < 0.5 ? 'left' : 'right') : null,
    dodgesLeft: type === 'dodger' ? config.DODGE_LIMIT : 0,
  };
  game.windows.push(win);
  return { type: 'spawn', window: win };
}

// Spawns at a uniformly random position; returns null if at the window cap.
function spawnRandom(game, type) {
  if (game.windows.length >= game.config.MAX_OPEN_WINDOWS) return null;
  const { maxX, maxY } = bounds(game);
  const x = game.rng() * maxX;
  const y = game.rng() * maxY;
  return makeWindow(game, type, x, y);
}

// Spawns on a ring around origin: slot i of n, evenly spaced from baseAngle.
function spawnAround(game, type, origin, i, n, baseAngle) {
  if (game.windows.length >= game.config.MAX_OPEN_WINDOWS) return null;
  const { maxX, maxY } = bounds(game);
  const angle = baseAngle + (i * 2 * Math.PI) / n;
  const r = game.config.HYDRA_SPAWN_DISTANCE;
  const x = clamp(origin.x + Math.cos(angle) * r, 0, maxX);
  const y = clamp(origin.y + Math.sin(angle) * r, 0, maxY);
  return makeWindow(game, type, x, y);
}

export function timeRemainingMs(game) {
  return Math.max(0, game.config.TIME_LIMIT_MS - game.elapsedMs - game.penaltyMs);
}

export function remainingCount(game) {
  return game.queue.filter((t) => t !== 'trap').length + game.windows.filter((w) => w.type !== 'trap').length;
}

function checkEnd(game, events) {
  if (game.status !== 'running') return;
  if (game.queue.length === 0 && game.windows.every((w) => w.type === 'trap')) {
    game.status = 'won';
    events.push({ type: 'won' });
  } else if (timeRemainingMs(game) === 0) {
    game.status = 'lost';
    events.push({ type: 'lost' });
  }
}

export function startGame(game) {
  if (game.status !== 'ready') return [];
  game.status = 'running';
  const events = [];
  for (let i = 0; i < game.config.INITIAL_BURST && game.queue.length > 0; i++) {
    const ev = spawnRandom(game, game.queue[0]);
    if (!ev) break;
    game.queue.shift();
    events.push(ev);
  }
  checkEnd(game, events);
  return events;
}

export function tick(game, dtMs) {
  if (game.status !== 'running') return [];
  const events = [];
  const interval = game.config.SPAWN_INTERVAL_MS;
  game.elapsedMs += dtMs;
  game.sinceSpawnMs += dtMs;
  while (game.sinceSpawnMs >= interval && game.queue.length > 0) {
    const ev = spawnRandom(game, game.queue[0]);
    if (!ev) {
      // At the window cap: drop the accumulated spawn time, keep the queue.
      game.sinceSpawnMs %= interval;
      break;
    }
    game.queue.shift();
    game.sinceSpawnMs -= interval;
    events.push(ev);
  }
  checkEnd(game, events);
  return events;
}

export function closeWindow(game, id, which) {
  if (game.status !== 'running') return [];
  const idx = game.windows.findIndex((w) => w.id === id);
  if (idx === -1) return [];
  const win = game.windows[idx];
  const events = [];
  if (win.type === 'hydra' && which === 'fake') {
    const n = game.config.HYDRA_SPAWN_COUNT;
    const baseAngle = game.rng() * 2 * Math.PI;
    for (let i = 0; i < n; i++) {
      const ev = spawnAround(game, 'normal', win, i, n, baseAngle);
      if (!ev) break;
      events.push(ev);
    }
  } else {
    game.windows.splice(idx, 1);
    events.push({ type: 'close', id });
    if (win.type === 'trap') {
      game.penaltyMs += game.config.TRAP_PENALTY_MS;
      events.push({ type: 'penalty', id, ms: game.config.TRAP_PENALTY_MS });
    }
  }
  checkEnd(game, events);
  return events;
}

export function dodgeWindow(game, id, x, y) {
  const win = game.windows.find((w) => w.id === id);
  if (!win || win.type !== 'dodger' || win.dodgesLeft <= 0) return false;
  win.x = x;
  win.y = y;
  win.dodgesLeft -= 1;
  return true;
}

export function moveWindow(game, id, x, y) {
  const win = game.windows.find((w) => w.id === id);
  if (!win) return;
  win.x = x;
  win.y = y;
}
