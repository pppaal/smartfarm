import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { db } from '../db/index.js';

const SECRET = process.env.JWT_SECRET || 'change-me-in-production';

export function hashPassword(password) {
  return bcrypt.hashSync(password, 10);
}

export function verifyPassword(password, hash) {
  return bcrypt.compareSync(password, hash);
}

export function issueToken(user) {
  return jwt.sign({ id: user.id, email: user.email }, SECRET, { expiresIn: '30d' });
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : (req.query.token || null);
  if (!token) return res.status(401).json({ error: 'no token' });
  try {
    const payload = jwt.verify(token, SECRET);
    const user = db.prepare('SELECT id, email, name FROM users WHERE id = ?').get(payload.id);
    if (!user) return res.status(401).json({ error: 'invalid user' });
    req.user = user;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'invalid token' });
  }
}
