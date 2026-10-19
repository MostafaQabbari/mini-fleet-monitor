import { Router } from 'express';
import { z } from 'zod';
import { query } from '../lib/db.js';
import { HttpError } from '../lib/errors.js';
import { getJson, setJson, del } from '../lib/cache.js';
import { ROBOT_COLUMNS as COLUMNS, moveRobot } from '../services/robots.js';

export const robotsRouter = Router();

const CACHE_KEY = 'robots:all';
const CACHE_TTL = 10; // seconds

const createSchema = z.object({
  name: z.string().trim().min(1).max(50),
  lat: z.number().min(-90).max(90).optional(),
  lon: z.number().min(-180).max(180).optional(),
});

// upper bound is postgres' integer max, anything larger would be a 500 instead of a 404
const idParams = z.object({
  id: z.coerce.number().int().positive().max(2147483647),
});

const historyQuery = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(50),
});

// robots created without a position start somewhere in Leipzig city centre
const LEIPZIG = { lat: 51.34, lon: 12.37 };
const jitter = () => (Math.random() * 2 - 1) * 0.01;

robotsRouter.get('/', async (req, res) => {
  const cached = await getJson(CACHE_KEY);
  if (cached) {
    req.log.debug('robots from cache');
    return res.json(cached);
  }

  const { rows } = await query(`SELECT ${COLUMNS} FROM robots ORDER BY id`);
  await setJson(CACHE_KEY, rows, CACHE_TTL);
  res.json(rows);
});

robotsRouter.post('/', async (req, res) => {
  const { name, lat, lon } = createSchema.parse(req.body);

  let robot;
  try {
    const { rows } = await query(
      `INSERT INTO robots (name, lat, lon) VALUES ($1, $2, $3) RETURNING ${COLUMNS}`,
      [name, lat ?? LEIPZIG.lat + jitter(), lon ?? LEIPZIG.lon + jitter()],
    );
    robot = rows[0];
  } catch (err) {
    if (err.code === '23505') throw new HttpError(409, 'Robot name already exists');
    throw err;
  }

  await del(CACHE_KEY);
  res.status(201).json(robot);
});

robotsRouter.post('/:id/move', async (req, res) => {
  const { id } = idParams.parse(req.params);

  const robot = await moveRobot(id);
  if (!robot) throw new HttpError(404, 'Robot not found');

  res.json(robot);
});

robotsRouter.get('/:id/positions', async (req, res) => {
  const { id } = idParams.parse(req.params);
  const { limit } = historyQuery.parse(req.query);

  // separate lookup so a robot without history is [] and a missing robot is a 404
  const { rowCount } = await query('SELECT 1 FROM robots WHERE id = $1', [id]);
  if (!rowCount) throw new HttpError(404, 'Robot not found');

  const { rows } = await query(
    `SELECT lat, lon, status, recorded_at FROM robot_positions
     WHERE robot_id = $1 ORDER BY recorded_at DESC, id DESC LIMIT $2`,
    [id, limit],
  );
  res.json(rows);
});
