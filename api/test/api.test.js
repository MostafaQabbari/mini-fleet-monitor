import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import request from 'supertest';

// these run against a real postgres (and redis, if it's up), e.g. the docker compose one.
// config reads the environment at import time, so fill in what it needs first
process.env.JWT_SECRET ??= 'test-secret-that-is-at-least-32-characters';
process.env.LOG_LEVEL ??= 'silent';
const DATABASE_URL = (process.env.DATABASE_URL ??= 'postgres://fleet:fleet@localhost:5432/fleet');

const EMAIL = 'admin@test.com';
const PASSWORD = 'test123';

// short timeout so a missing database means a skipped suite, not a hanging npm test
async function databaseReachable() {
  const client = new pg.Client({ connectionString: DATABASE_URL, connectionTimeoutMillis: 2000 });
  try {
    await client.connect();
    return true;
  } catch {
    return false;
  } finally {
    await client.end().catch(() => {});
  }
}

const reachable = await databaseReachable();
const skip = reachable
  ? false
  : `postgres not reachable at ${DATABASE_URL.replace(/\/\/[^@]*@/, '//')}; ` +
    'start it with "docker compose up -d db redis" or set DATABASE_URL';

describe('api', { skip }, () => {
  let app;
  let pool;
  let redis;
  let token;

  before(async () => {
    // imported here so nothing connects to postgres or redis when the suite is skipped
    ({ pool } = await import('../src/lib/db.js'));
    ({ redis } = await import('../src/lib/redis.js'));
    const { migrate } = await import('../src/db/migrate.js');
    const { seed } = await import('../src/db/seed.js');
    const { createApp } = await import('../src/app.js');

    // same as api startup, both are idempotent, so a fresh database works too
    await migrate();
    await seed();
    app = createApp();

    const res = await request(app).post('/auth/login').send({ email: EMAIL, password: PASSWORD });
    token = res.body.token;
  });

  after(async () => {
    // disconnect() also stops ioredis from retrying when redis isn't running
    redis?.disconnect();
    await pool?.end();
  });

  test('login with the demo account returns a token and the user', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'Admin@Test.com', password: PASSWORD })
      .expect(200);

    assert.equal(typeof res.body.token, 'string');
    assert.equal(res.body.user.email, EMAIL);
    const payload = JSON.parse(Buffer.from(res.body.token.split('.')[1], 'base64url'));
    assert.equal(payload.sub, String(res.body.user.id));
  });

  test('login with a wrong password is 401', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: EMAIL, password: 'wrong-password' })
      .expect(401);
    assert.equal(res.body.error, 'Invalid email or password');
  });

  test('login with an unknown email gives the same 401', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'nobody@test.com', password: PASSWORD })
      .expect(401);
    assert.equal(res.body.error, 'Invalid email or password');
  });

  test('GET /robots without a token is 401', async () => {
    const res = await request(app).get('/robots').expect(401);
    assert.equal(res.body.error, 'Missing bearer token');
  });

  test('GET /robots with a tampered token is 401', async () => {
    await request(app)
      .get('/robots')
      .set('Authorization', `Bearer ${token.slice(0, -2)}xx`)
      .expect(401);
  });

  test('GET /robots with a token returns the robots', async () => {
    const res = await request(app).get('/robots').set('Authorization', `Bearer ${token}`).expect(200);

    assert.ok(Array.isArray(res.body));
    assert.ok(res.body.length >= 5, `expected the 5 seeded robots, got ${res.body.length}`);
    assert.deepEqual(Object.keys(res.body[0]).sort(), [
      'id',
      'lat',
      'lon',
      'name',
      'status',
      'updated_at',
    ]);
  });
});
