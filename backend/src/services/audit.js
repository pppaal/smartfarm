import { db } from '../db/index.js';

export function audit(userId, action, detail = null, req = null) {
  const ip = req ? (req.ip || req.headers?.['x-forwarded-for'] || null) : null;
  db.prepare('INSERT INTO audit_logs(user_id, action, detail, ip) VALUES (?, ?, ?, ?)')
    .run(userId, action, detail, ip);
}
