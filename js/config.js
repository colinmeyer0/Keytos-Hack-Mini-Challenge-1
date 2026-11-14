export const CONFIG = {
  TIME_LIMIT_MS: 30000,
  QUEUE_COUNTS: { normal: 4, hydra: 3, trap: 3, dodger: 3 },
  INITIAL_BURST: 6,
  SPAWN_INTERVAL_MS: 1000,
  HYDRA_SPAWN_COUNT: 3,
  HYDRA_SPAWN_DISTANCE: 260,
  TRAP_PENALTY_MS: 3000,
  MAX_OPEN_WINDOWS: 30,
  DODGE_RADIUS: 110,
  DODGE_DISTANCE: 120,
  DODGE_LIMIT: 3,
  WINDOW_WIDTH: 340,
  WINDOW_HEIGHT: 190,
  TASKBAR_HEIGHT: 40,
  LOOP_FALLBACK_MS: 50, // setInterval fallback tick when requestAnimationFrame is throttled
  LOOP_STALE_MS: 100, // rAF counts as stalled after this long without a frame
  RAF_SETTLE_MAX_MS: 100, // max wait for a post-fullscreen rAF settle
};
