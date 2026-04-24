import { Router } from 'express';
import { db } from '../db/index.js';
import { requireAuth } from '../services/auth.js';
import { checkGreenhouseAccess } from '../services/access.js';

const router = Router();

// 에너지 센서 ingest (device_key 인증)
router.post('/ingest', (req, res) => {
  const { device_key, power_w, energy_kwh, source } = req.body || {};
  if (!device_key) return res.status(400).json({ error: 'device_key required' });
  const device = db.prepare('SELECT * FROM devices WHERE device_key = ?').get(device_key);
  if (!device) return res.status(404).json({ error: 'device not found' });
  db.prepare(`INSERT INTO energy_readings(greenhouse_id, power_w, energy_kwh, source) VALUES (?, ?, ?, ?)`)
    .run(device.greenhouse_id, power_w || null, energy_kwh || null, source || 'total');
  res.json({ ok: true });
});

router.use(requireAuth);

router.get('/greenhouse/:id/summary', (req, res) => {
  if (!checkGreenhouseAccess(req.user.id, req.params.id, 'viewer')) return res.status(404).json({ error: 'not found' });
  // 최근 30일 일별 kWh + 비용 추정 (200원/kWh)
  const daily = db.prepare(`
    SELECT date(ts) AS day, COALESCE(SUM(energy_kwh), 0) AS kwh, source
    FROM energy_readings
    WHERE greenhouse_id = ? AND ts >= datetime('now', '-30 days')
    GROUP BY date(ts), source
    ORDER BY day DESC
  `).all(req.params.id);
  const total = db.prepare(`
    SELECT COALESCE(SUM(energy_kwh), 0) AS kwh
    FROM energy_readings WHERE greenhouse_id = ? AND ts >= datetime('now', '-30 days')
  `).get(req.params.id);
  const kwhPrice = Number(process.env.KWH_PRICE_KRW || 200);
  res.json({ daily, total_kwh: total.kwh, estimated_cost_krw: Math.round(total.kwh * kwhPrice), kwh_price: kwhPrice });
});

export default router;
