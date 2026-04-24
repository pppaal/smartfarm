import { Router } from 'express';
import { db } from '../db/index.js';
import { requireAuth } from '../services/auth.js';
import { validate, schemas } from '../services/validate.js';
import crypto from 'crypto';

const router = Router();
router.use(requireAuth);

router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM greenhouses WHERE user_id = ? ORDER BY id').all(req.user.id);
  res.json(rows);
});

router.post('/', validate(schemas.createGreenhouse), (req, res) => {
  const { name, location, crop = 'strawberry', variety = '설향', planted_at, area_pyeong } = req.body;
  const info = db.prepare(`
    INSERT INTO greenhouses(user_id, name, location, crop, variety, planted_at, area_pyeong)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(req.user.id, name, location, crop, variety, planted_at, area_pyeong);
  res.json(db.prepare('SELECT * FROM greenhouses WHERE id = ?').get(info.lastInsertRowid));
});

router.get('/:id', (req, res) => {
  const gh = db.prepare('SELECT * FROM greenhouses WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!gh) return res.status(404).json({ error: 'not found' });
  const devices = db.prepare('SELECT * FROM devices WHERE greenhouse_id = ?').all(gh.id);
  res.json({ ...gh, devices });
});

router.patch('/:id', (req, res) => {
  const gh = db.prepare('SELECT * FROM greenhouses WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!gh) return res.status(404).json({ error: 'not found' });
  const fields = ['name', 'location', 'variety', 'planted_at', 'area_pyeong'];
  const sets = [], values = [];
  for (const f of fields) if (f in (req.body || {})) { sets.push(`${f} = ?`); values.push(req.body[f]); }
  if (sets.length) {
    values.push(gh.id);
    db.prepare(`UPDATE greenhouses SET ${sets.join(', ')} WHERE id = ?`).run(...values);
  }
  res.json(db.prepare('SELECT * FROM greenhouses WHERE id = ?').get(gh.id));
});

router.post('/:id/devices', (req, res) => {
  const gh = db.prepare('SELECT * FROM greenhouses WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!gh) return res.status(404).json({ error: 'not found' });
  const { name } = req.body || {};
  const device_key = crypto.randomBytes(12).toString('hex');
  const info = db.prepare('INSERT INTO devices(greenhouse_id, device_key, name) VALUES (?, ?, ?)')
    .run(gh.id, device_key, name || '기본 센서');
  res.json(db.prepare('SELECT * FROM devices WHERE id = ?').get(info.lastInsertRowid));
});

router.delete('/:ghId/devices/:devId', (req, res) => {
  const gh = db.prepare('SELECT * FROM greenhouses WHERE id = ? AND user_id = ?').get(req.params.ghId, req.user.id);
  if (!gh) return res.status(404).json({ error: 'not found' });
  const info = db.prepare('DELETE FROM devices WHERE id = ? AND greenhouse_id = ?').run(req.params.devId, gh.id);
  if (info.changes === 0) return res.status(404).json({ error: 'device not found' });
  res.json({ ok: true });
});

export default router;
