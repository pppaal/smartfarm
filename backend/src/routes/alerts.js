import { Router } from 'express';
import { db } from '../db/index.js';
import { requireAuth } from '../services/auth.js';

const router = Router();
router.use(requireAuth);

function assertOwner(userId, greenhouseId) {
  return !!db.prepare('SELECT id FROM greenhouses WHERE id = ? AND user_id = ?').get(greenhouseId, userId);
}

router.get('/greenhouse/:id', (req, res) => {
  if (!assertOwner(req.user.id, req.params.id)) return res.status(404).json({ error: 'not found' });
  const rows = db.prepare('SELECT * FROM alerts WHERE greenhouse_id = ? ORDER BY ts DESC LIMIT 100').all(req.params.id);
  res.json(rows);
});

router.post('/:id/ack', (req, res) => {
  const alert = db.prepare('SELECT * FROM alerts WHERE id = ?').get(req.params.id);
  if (!alert || !assertOwner(req.user.id, alert.greenhouse_id)) return res.status(404).json({ error: 'not found' });
  db.prepare('UPDATE alerts SET acknowledged = 1 WHERE id = ?').run(alert.id);
  res.json({ ok: true });
});

export default router;
