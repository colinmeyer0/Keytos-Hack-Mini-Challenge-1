// Pure dodge math for "dodger" popup windows. No DOM access, no config import:
// every tunable is passed in by the caller.

const CORNERED_THRESHOLD_PX = 20;

// Returns the window's new {x, y} (page coords), or null if the cursor is
// farther than `radius` from the close-button `target`.
export function computeDodge({ rect, target, cursor, viewport, radius, distance, taskbarHeight }) {
  const dx = target.x - cursor.x;
  const dy = target.y - cursor.y;
  const gap = Math.hypot(dx, dy);
  if (gap > radius) return null;

  // Unit vector from cursor toward target. Exactly coincident points use {1, 0}.
  let ux = 1;
  let uy = 0;
  if (gap > 0) {
    ux = dx / gap;
    uy = dy / gap;
  }

  const maxX = Math.max(0, viewport.width - rect.width);
  const maxY = Math.max(0, viewport.height - taskbarHeight - rect.height);
  const clamp = (v, max) => Math.min(Math.max(v, 0), max);

  // Move `distance` along `sign * (ux, uy)` from the original position, clamped to the desktop.
  const moveBy = (sign) => ({
    x: clamp(rect.x + sign * ux * distance, maxX),
    y: clamp(rect.y + sign * uy * distance, maxY),
  });

  const primary = moveBy(1);
  const cornered =
    Math.abs(primary.x - rect.x) <= CORNERED_THRESHOLD_PX &&
    Math.abs(primary.y - rect.y) <= CORNERED_THRESHOLD_PX;

  // Window is pinned against an edge: slide away from the cursor instead.
  return cornered ? moveBy(-1) : primary;
}
