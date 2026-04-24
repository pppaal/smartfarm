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
  const rows = db.prepare('SELECT * FROM sales WHERE greenhouse_id = ? ORDER BY date DESC').all(req.params.id);
  res.json(rows);
});

router.post('/greenhouse/:id', (req, res) => {
  if (!assertOwner(req.user.id, req.params.id)) return res.status(404).json({ error: 'not found' });
  const { date, channel, weight_kg, unit_price, buyer } = req.body || {};
  if (!date || weight_kg == null || unit_price == null) {
    return res.status(400).json({ error: 'date, weight_kg, unit_price required' });
  }
  const revenue = Math.round(weight_kg * unit_price);
  const info = db.prepare(`
    INSERT INTO sales(greenhouse_id, date, channel, weight_kg, unit_price, revenue, buyer)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(req.params.id, date, channel, weight_kg, unit_price, revenue, buyer);
  res.json(db.prepare('SELECT * FROM sales WHERE id = ?').get(info.lastInsertRowid));
});

router.get('/greenhouse/:id/export.csv', (req, res) => {
  if (!assertOwner(req.user.id, req.params.id)) return res.status(404).json({ error: 'not found' });
  const rows = db.prepare('SELECT * FROM sales WHERE greenhouse_id = ? ORDER BY date DESC').all(req.params.id);
  const header = 'date,channel,weight_kg,unit_price,revenue,buyer\n';
  const body = rows.map((r) =>
    [r.date, r.channel || '', r.weight_kg, r.unit_price, r.revenue, (r.buyer || '').replace(/,/g, ' ')].join(',')
  ).join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="sales-${req.params.id}.csv"`);
  res.send('﻿' + header + body);
});

router.get('/greenhouse/:id/summary', (req, res) => {
  if (!assertOwner(req.user.id, req.params.id)) return res.status(404).json({ error: 'not found' });
  const monthly = db.prepare(`
    SELECT substr(date, 1, 7) AS month,
           SUM(weight_kg) AS total_kg,
           SUM(revenue) AS total_revenue,
           AVG(unit_price) AS avg_price
    FROM sales WHERE greenhouse_id = ?
    GROUP BY substr(date, 1, 7) ORDER BY month DESC LIMIT 12
  `).all(req.params.id);
  const total = db.prepare(`
    SELECT COALESCE(SUM(weight_kg), 0) AS total_kg,
           COALESCE(SUM(revenue), 0) AS total_revenue
    FROM sales WHERE greenhouse_id = ?
  `).get(req.params.id);
  res.json({ monthly, total });
});

export default router;
