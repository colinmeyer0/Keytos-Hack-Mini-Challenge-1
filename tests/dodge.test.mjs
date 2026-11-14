import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeDodge } from '../js/dodge.js';

const viewport = { width: 1000, height: 800 };
const taskbarHeight = 40;
const radius = 110;
const distance = 160;
const size = { width: 300, height: 170 };

test('returns null when cursor is outside radius', () => {
  const rect = { x: 300, y: 300, ...size };
  const target = { x: 560, y: 320 };
  const cursor = { x: 560, y: 520 }; // 200px away, radius is 110
  const result = computeDodge({ rect, target, cursor, viewport, radius, distance, taskbarHeight });
  assert.equal(result, null);
});

test('cursor left of target moves window right', () => {
  const rect = { x: 300, y: 300, ...size };
  const target = { x: 560, y: 320 };
  const cursor = { x: 530, y: 320 }; // 30px left of target, inside radius
  const result = computeDodge({ rect, target, cursor, viewport, radius, distance, taskbarHeight });
  assert.ok(result !== null);
  assert.ok(result.x > rect.x, `expected x > ${rect.x}, got ${result.x}`);
  assert.equal(result.y, rect.y);
});

test('result stays inside viewport', () => {
  const rect = { x: 690, y: 580, ...size };
  const target = { x: 970, y: 600 }; // close button near top-right of rect
  const cursor = { x: 940, y: 600 }; // left of target, inside radius
  const result = computeDodge({ rect, target, cursor, viewport, radius, distance, taskbarHeight });
  assert.ok(result !== null);
  assert.ok(result.x <= 700 && result.y <= 590, `got ${JSON.stringify(result)}`);
  assert.ok(result.x >= 0 && result.y >= 0, `got ${JSON.stringify(result)}`);
});

test('cornered window still moves', () => {
  const rect = { x: 700, y: 590, ...size };
  const target = { x: 980, y: 610 }; // close button at top-right of rect
  const cursor = { x: 950, y: 580 }; // up-left of target, inside radius
  const result = computeDodge({ rect, target, cursor, viewport, radius, distance, taskbarHeight });
  assert.ok(result !== null);
  const dx = Math.abs(result.x - rect.x);
  const dy = Math.abs(result.y - rect.y);
  assert.ok(Math.max(dx, dy) > 20, `expected move > 20px, got dx=${dx} dy=${dy}`);
});
