import { Router } from 'express';
import { isRunning, setRunning } from '../services/simulation.js';

export const simulationRouter = Router();

simulationRouter.get('/', async (_req, res) => {
  res.json({ running: await isRunning() });
});

simulationRouter.post('/start', async (_req, res) => {
  res.json({ running: await setRunning(true) });
});

simulationRouter.post('/stop', async (_req, res) => {
  res.json({ running: await setRunning(false) });
});
