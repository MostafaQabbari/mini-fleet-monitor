const MAX_STEP = 0.0005; // degrees, roughly 50 m
const MOVING_CHANCE = 0.7;

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

// pure and without imports so it can be tested without a database or redis;
// pass your own rand for deterministic tests
export function nextPosition({ lat, lon }, rand = Math.random) {
  if (rand() >= MOVING_CHANCE) return { lat, lon, status: 'idle' };

  // random direction and distance, so a step never exceeds MAX_STEP
  const angle = rand() * 2 * Math.PI;
  const dist = rand() * MAX_STEP;
  return {
    lat: clamp(lat + Math.sin(angle) * dist, -90, 90),
    lon: clamp(lon + Math.cos(angle) * dist, -180, 180),
    status: 'moving',
  };
}
