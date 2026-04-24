import { Router } from 'express';
import { db } from '../db/index.js';
import { requireAuth } from '../services/auth.js';
import { getHarvestForecast } from '../services/forecast.js';

const router = Router();
router.use(requireAuth);

function assertOwner(userId, greenhouseId) {
  return !!db.prepare('SELECT id FROM greenhouses WHERE id = ? AND user_id = ?').get(greenhouseId, userId);
}

router.get('/greenhouse/:id/forecast', (req, res) => {
  if (!assertOwner(req.user.id, req.params.id)) return res.status(404).json({ error: 'not found' });
  res.json(getHarvestForecast(Number(req.params.id)));
});

router.get('/greenhouse/:id', (req, res) => {
  if (!assertOwner(req.user.id, req.params.id)) return res.status(404).json({ error: 'not found' });
  const rows = db.prepare('SELECT * FROM harvests WHERE greenhouse_id = ? ORDER BY date DESC').all(req.params.id);
  res.json(rows);
});

router.post('/greenhouse/:id', (req, res) => {
  if (!assertOwner(req.user.id, req.params.id)) return res.status(404).json({ error: 'not found' });
  const { date, weight_kg, grade, notes } = req.body || {};
  if (!date || weight_kg == null) return res.status(400).json({ error: 'date, weight_kg required' });
  const info = db.prepare(`
    INSERT INTO harvests(greenhouse_id, date, weight_kg, grade, notes) VALUES (?, ?, ?, ?, ?)
  `).run(req.params.id, date, weight_kg, grade, notes);
  res.json(db.prepare('SELECT * FROM harvests WHERE id = ?').get(info.lastInsertRowid));
});

export default router;
