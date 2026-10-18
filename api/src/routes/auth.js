import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { query } from '../lib/db.js';
import { HttpError } from '../lib/errors.js';
import { signToken } from '../middleware/auth.js';

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// compared against when the email is unknown, so that a wrong email takes
// as long as a wrong password and nobody can probe which accounts exist
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

authRouter.post('/login', async (req, res) => {
  const { email, password } = loginSchema.parse(req.body);

  const { rows } = await query(
    'SELECT id, email, password_hash FROM users WHERE email = $1',
    [email.toLowerCase()],
  );
  const user = rows[0];

  const ok = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);
  if (!user || !ok) throw new HttpError(401, 'Invalid email or password');

  res.json({
    token: signToken(user),
    user: { id: user.id, email: user.email },
  });
});