import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { HttpError } from '../lib/errors.js';

export function signToken(user) {
  return jwt.sign({ email: user.email }, config.jwt.secret, {
    subject: String(user.id),
    expiresIn: config.jwt.expiresIn,
  });
}

// also used by the websocket server, so it lives outside the middleware
export function verifyToken(token) {
  const payload = jwt.verify(token, config.jwt.secret, { algorithms: ['HS256'] });
  return { id: Number(payload.sub), email: payload.email, exp: payload.exp };
}

export function requireAuth(req, res, next) {
  const [scheme, token] = (req.headers.authorization || '').split(' ');

  if (scheme !== 'Bearer' || !token) {
    return next(new HttpError(401, 'Missing bearer token'));
  }

  try {
    req.user = verifyToken(token);
    next();
  } catch (err) {
    const msg = err.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token';
    next(new HttpError(401, msg));
  }
}