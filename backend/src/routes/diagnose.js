import { Router } from 'express';
import { db } from '../db/index.js';
import { requireAuth } from '../services/auth.js';
import { diagnoseImage } from '../services/diagnose.js';

const router = Router();
router.use(requireAuth);

function ownsGreenhouse(userId, ghId) {
  return !!db.prepare('SELECT id FROM greenhouses WHERE id = ? AND user_id = ?').get(ghId, userId);
}

router.post('/greenhouse/:id', async (req, res) => {
  const ghId = Number(req.params.id);
  if (!ownsGreenhouse(req.user.id, ghId)) return res.status(404).json({ error: 'not found' });

  const { image_base64, mime = 'image/jpeg' } = req.body || {};
  if (!image_base64 || typeof image_base64 !== 'string') {
    return res.status(400).json({ error: 'image_base64 required' });
  }
  if (image_base64.length > 10 * 1024 * 1024) {
    return res.status(413).json({ error: 'image too large (max ~7.5MB)' });
  }

  const base64 = image_base64.replace(/^data:image\/[^;]+;base64,/, '');
  const result = await diagnoseImage({ base64, mime });

  const info = db.prepare(`
    INSERT INTO diagnoses(greenhouse_id, user_id, image_mime, disease, severity, confidence, recommendation, raw)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    ghId, req.user.id, mime,
    result.disease || null,
    result.severity || null,
    result.confidence ?? null,
    result.recommendation || null,
    result.raw || null,
  );

  res.json({ id: info.lastInsertRowid, ...result });
});

router.get('/greenhouse/:id', (req, res) => {
  if (!ownsGreenhouse(req.user.id, req.params.id)) return res.status(404).json({ error: 'not found' });
  const rows = db.prepare(`
    SELECT id, disease, severity, confidence, recommendation, ts
    FROM diagnoses WHERE greenhouse_id = ? ORDER BY ts DESC LIMIT 50
  `).all(req.params.id);
  res.json(rows);
});

export default router;
