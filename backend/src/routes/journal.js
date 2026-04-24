import { Router } from 'express';
import { db } from '../db/index.js';
import { requireAuth } from '../services/auth.js';
import { checkGreenhouseAccess } from '../services/access.js';

const router = Router();
router.use(requireAuth);

router.get('/greenhouse/:id', (req, res) => {
  if (!checkGreenhouseAccess(req.user.id, req.params.id, 'viewer')) return res.status(404).json({ error: 'not found' });
  const rows = db.prepare(`
    SELECT id, date, category, title, body, photo_base64 IS NOT NULL AS has_photo, weather_snapshot, created_at
    FROM journal_entries WHERE greenhouse_id = ?
    ORDER BY date DESC, id DESC LIMIT 100
  `).all(req.params.id);
  res.json(rows);
});

router.get('/greenhouse/:ghId/:id', (req, res) => {
  if (!checkGreenhouseAccess(req.user.id, req.params.ghId, 'viewer')) return res.status(404).json({ error: 'not found' });
  const row = db.prepare('SELECT * FROM journal_entries WHERE id = ? AND greenhouse_id = ?').get(req.params.id, req.params.ghId);
  if (!row) return res.status(404).json({ error: 'not found' });
  res.json(row);
});

router.post('/greenhouse/:id', (req, res) => {
  if (!checkGreenhouseAccess(req.user.id, req.params.id, 'member')) return res.status(404).json({ error: 'not found' });
  const { date, category, title, body, photo_base64, weather_snapshot } = req.body || {};
  if (!date) return res.status(400).json({ error: 'date required' });
  if (photo_base64 && photo_base64.length > 8 * 1024 * 1024) return res.status(413).json({ error: 'photo too large' });
  const info = db.prepare(`
    INSERT INTO journal_entries(greenhouse_id, user_id, date, category, title, body, photo_base64, weather_snapshot)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    req.params.id, req.user.id, date, category || null, title || null, body || null,
    photo_base64 || null, weather_snapshot ? JSON.stringify(weather_snapshot) : null,
  );
  res.json({ id: info.lastInsertRowid });
});

router.delete('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM journal_entries WHERE id = ?').get(req.params.id);
  if (!row || !checkGreenhouseAccess(req.user.id, row.greenhouse_id, 'member')) return res.status(404).json({ error: 'not found' });
  db.prepare('DELETE FROM journal_entries WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

export default router;
