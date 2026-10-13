import { ZodError } from 'zod';
import { HttpError } from '../lib/errors.js';

export function notFound(req, res) {
  res.status(404).json({ error: 'Not found', path: req.originalUrl });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: 'Validation failed', details: err.issues });
  }
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, details: err.details });
  }
  req.log?.error({ err }, 'Unhandled error');
  return res.status(500).json({ error: 'Internal server error' });
}
