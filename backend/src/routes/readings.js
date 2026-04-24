import { Router } from 'express';
import { db } from '../db/index.js';
import { requireAuth } from '../services/auth.js';
import { runRules } from '../services/rules.js';
import { broadcast } from '../services/ws.js';
import { validate, schemas } from '../services/validate.js';

const router = Router();

// 디바이스에서 측정값 업로드 (device_key 인증)
router.post('/ingest', validate(schemas.ingest), (req, res) => {
  const { device_key, temperature, humidity, soil_moisture, co2, light } = req.body;
  const device = db.prepare('SELECT * FROM devices WHERE device_key = ?').get(device_key);
  if (!device) return res.status(404).json({ error: 'device not found' });

  db.prepare(`
    INSERT INTO readings(device_id, temperature, humidity, soil_moisture, co2, light)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(device.id, temperature, humidity, soil_moisture, co2, light);

  db.prepare('UPDATE devices SET last_seen = CURRENT_TIMESTAMP, online = 1 WHERE id = ?').run(device.id);

  const reading = { device_id: device.id, greenhouse_id: device.greenhouse_id, temperature, humidity, soil_moisture, co2, light, ts: new Date().toISOString() };
  broadcast({ type: 'reading', data: reading });

  const fired = runRules(device.greenhouse_id, { temperature, humidity, soil_moisture, co2, light });
  res.json({ ok: true, fired });
});

// 최근 측정값 조회
router.get('/greenhouse/:id/latest', requireAuth, (req, res) => {
  const gh = db.prepare('SELECT id FROM greenhouses WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!gh) return res.status(404).json({ error: 'not found' });
  const row = db.prepare(`
    SELECT r.* FROM readings r
    JOIN devices d ON d.id = r.device_id
    WHERE d.greenhouse_id = ?
    ORDER BY r.ts DESC LIMIT 1
  `).get(gh.id);
  res.json(row || null);
});

router.get('/greenhouse/:id/series', requireAuth, (req, res) => {
  const gh = db.prepare('SELECT id FROM greenhouses WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!gh) return res.status(404).json({ error: 'not found' });
  const hours = Math.min(parseInt(req.query.hours || '24'), 24 * 30);
  const rows = db.prepare(`
    SELECT r.ts, r.temperature, r.humidity, r.soil_moisture, r.co2, r.light
    FROM readings r JOIN devices d ON d.id = r.device_id
    WHERE d.greenhouse_id = ? AND r.ts >= datetime('now', ?)
    ORDER BY r.ts ASC
  `).all(gh.id, `-${hours} hours`);
  res.json(rows);
});

export default router;
