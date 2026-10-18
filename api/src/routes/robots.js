import { Router } from 'express';
import { query } from '../lib/db.js';

export const robotsRouter = Router();

robotsRouter.get('/', async (req, res) => {
  const { rows } = await query(
    'SELECT id, name, status, lat, lon, updated_at FROM robots ORDER BY id',
  );
  res.json(rows);
});