import { Router } from 'express';
import { db } from '../db/index.js';
import { requireAuth } from '../services/auth.js';
import { seedDefaultRules } from '../services/rules.js';

const router = Router();
router.use(requireAuth);

function assertOwner(userId, greenhouseId) {
  const gh = db.prepare('SELECT id FROM greenhouses WHERE id = ? AND user_id = ?').get(greenhouseId, userId);
  return !!gh;
}

router.get('/greenhouse/:id', (req, res) => {
  if (!assertOwner(req.user.id, req.params.id)) return res.status(404).json({ error: 'not found' });
  const rows = db.prepare('SELECT * FROM rules WHERE greenhouse_id = ?').all(req.params.id);
  res.json(rows);
});

router.post('/greenhouse/:id', (req, res) => {
  if (!assertOwner(req.user.id, req.params.id)) return res.status(404).json({ error: 'not found' });
  const { name, metric, operator, threshold, action, duration_sec = 60, cooldown_sec = 600 } = req.body || {};
  const info = db.prepare(`
    INSERT INTO rules(greenhouse_id, name, metric, operator, threshold, action, duration_sec, cooldown_sec)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(req.params.id, name, metric, operator, threshold, action, duration_sec, cooldown_sec);
  res.json(db.prepare('SELECT * FROM rules WHERE id = ?').get(info.lastInsertRowid));
});

router.post('/greenhouse/:id/seed-defaults', (req, res) => {
  if (!assertOwner(req.user.id, req.params.id)) return res.status(404).json({ error: 'not found' });
  const existing = db.prepare('SELECT COUNT(*) AS n FROM rules WHERE greenhouse_id = ?').get(req.params.id);
  if (existing.n > 0) return res.json({ ok: true, skipped: true });
  seedDefaultRules(Number(req.params.id));
  res.json({ ok: true });
});

router.patch('/:id', (req, res) => {
  const rule = db.prepare('SELECT * FROM rules WHERE id = ?').get(req.params.id);
  if (!rule || !assertOwner(req.user.id, rule.greenhouse_id)) return res.status(404).json({ error: 'not found' });
  const fields = ['name', 'metric', 'operator', 'threshold', 'action', 'duration_sec', 'cooldown_sec', 'enabled'];
  const sets = [], values = [];
  for (const f of fields) if (f in (req.body || {})) { sets.push(`${f} = ?`); values.push(req.body[f]); }
  if (sets.length) {
    values.push(rule.id);
    db.prepare(`UPDATE rules SET ${sets.join(', ')} WHERE id = ?`).run(...values);
  }
  res.json(db.prepare('SELECT * FROM rules WHERE id = ?').get(rule.id));
});

router.delete('/:id', (req, res) => {
  const rule = db.prepare('SELECT * FROM rules WHERE id = ?').get(req.params.id);
  if (!rule || !assertOwner(req.user.id, rule.greenhouse_id)) return res.status(404).json({ error: 'not found' });
  db.prepare('DELETE FROM rules WHERE id = ?').run(rule.id);
  res.json({ ok: true });
});

router.get('/greenhouse/:id/actuations', (req, res) => {
  if (!assertOwner(req.user.id, req.params.id)) return res.status(404).json({ error: 'not found' });
  const rows = db.prepare(`
    SELECT a.*, r.name AS rule_name FROM actuations a
    LEFT JOIN rules r ON r.id = a.rule_id
    WHERE a.greenhouse_id = ? ORDER BY a.ts DESC LIMIT 100
  `).all(req.params.id);
  res.json(rows);
});

export default router;
