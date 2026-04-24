import { Router } from 'express';
import { db } from '../db/index.js';
import { requireAuth } from '../services/auth.js';
import { checkGreenhouseAccess } from '../services/access.js';
import { registerSchedule, unregisterSchedule, cronIsValid } from '../services/scheduler.js';

const router = Router();
router.use(requireAuth);

router.get('/greenhouse/:id', (req, res) => {
  if (!checkGreenhouseAccess(req.user.id, req.params.id, 'viewer')) return res.status(404).json({ error: 'not found' });
  const rows = db.prepare('SELECT * FROM schedules WHERE greenhouse_id = ? ORDER BY id').all(req.params.id);
  res.json(rows);
});

router.post('/greenhouse/:id', (req, res) => {
  if (!checkGreenhouseAccess(req.user.id, req.params.id, 'member')) return res.status(404).json({ error: 'not found' });
  const { name, cron_expr, action, duration_sec = 120 } = req.body || {};
  if (!name || !cron_expr || !action) return res.status(400).json({ error: 'name, cron_expr, action required' });
  if (!cronIsValid(cron_expr)) return res.status(400).json({ error: 'invalid cron expression (예: "0 6 * * *")' });
  if (!['irrigate', 'vent', 'heat', 'cool'].includes(action)) return res.status(400).json({ error: 'invalid action' });
  const info = db.prepare(`
    INSERT INTO schedules(greenhouse_id, name, cron_expr, action, duration_sec) VALUES (?, ?, ?, ?, ?)
  `).run(req.params.id, name, cron_expr, action, duration_sec);
  const row = db.prepare('SELECT * FROM schedules WHERE id = ?').get(info.lastInsertRowid);
  registerSchedule(row);
  res.json(row);
});

router.patch('/:id', (req, res) => {
  const sch = db.prepare('SELECT * FROM schedules WHERE id = ?').get(req.params.id);
  if (!sch || !checkGreenhouseAccess(req.user.id, sch.greenhouse_id, 'member')) return res.status(404).json({ error: 'not found' });
  const fields = ['name', 'cron_expr', 'action', 'duration_sec', 'enabled'];
  const sets = [], values = [];
  for (const f of fields) if (f in (req.body || {})) {
    if (f === 'cron_expr' && !cronIsValid(req.body[f])) return res.status(400).json({ error: 'invalid cron' });
    sets.push(`${f} = ?`); values.push(req.body[f]);
  }
  if (sets.length) {
    values.push(sch.id);
    db.prepare(`UPDATE schedules SET ${sets.join(', ')} WHERE id = ?`).run(...values);
  }
  const row = db.prepare('SELECT * FROM schedules WHERE id = ?').get(sch.id);
  registerSchedule(row);
  res.json(row);
});

router.delete('/:id', (req, res) => {
  const sch = db.prepare('SELECT * FROM schedules WHERE id = ?').get(req.params.id);
  if (!sch || !checkGreenhouseAccess(req.user.id, sch.greenhouse_id, 'member')) return res.status(404).json({ error: 'not found' });
  unregisterSchedule(sch.id);
  db.prepare('DELETE FROM schedules WHERE id = ?').run(sch.id);
  res.json({ ok: true });
});

export default router;
