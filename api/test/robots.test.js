import { test } from 'node:test';
import assert from 'node:assert/strict';

// services/robots.js pulls in config, which exits without a JWT_SECRET
process.env.JWT_SECRET ??= 'test-secret-that-is-at-least-32-characters';
const { nextPosition } = await import('../src/services/robots.js');

// returns the given values in order, so each test controls every random draw
const seq = (...values) => () => values.shift();

test('idle robots keep their position', () => {
  const pos = { lat: 51.34, lon: 12.37 };
  assert.deepEqual(nextPosition(pos, seq(0.9)), { ...pos, status: 'idle' });
});

test('moving robots step at most 0.0005 degrees', () => {
  for (let i = 0; i < 1000; i++) {
    const next = nextPosition({ lat: 51.34, lon: 12.37 });
    const dist = Math.hypot(next.lat - 51.34, next.lon - 12.37);
    assert.ok(dist <= 0.0005 + 1e-12, `step was ${dist}`);
    if (next.status === 'idle') assert.equal(dist, 0);
  }
});

test('full step in a fixed direction', () => {
  // moving, angle 0 (due east), full distance
  const next = nextPosition({ lat: 0, lon: 0 }, seq(0, 0, 1));
  assert.equal(next.status, 'moving');
  assert.equal(next.lat, 0);
  assert.equal(next.lon, 0.0005);
});

test('clamps to valid coordinates at the edges', () => {
  // angle pi/2 is due north, angle 0 is due east
  assert.equal(nextPosition({ lat: 90, lon: 0 }, seq(0, 0.25, 1)).lat, 90);
  assert.equal(nextPosition({ lat: 0, lon: 180 }, seq(0, 0, 1)).lon, 180);
});
