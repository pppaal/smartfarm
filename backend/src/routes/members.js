import { Router } from 'express';
import { db } from '../db/index.js';
import { requireAuth } from '../services/auth.js';
import { checkGreenhouseAccess } from '../services/access.js';
import { audit } from '../services/audit.js';

const router = Router();
router.use(requireAuth);

router.get('/greenhouse/:id', (req, res) => {
  if (!checkGreenhouseAccess(req.user.id, req.params.id, 'viewer')) return res.status(404).json({ error: 'not found' });
  const owner = db.prepare(`
    SELECT u.id, u.email, u.name, 'owner' AS role FROM greenhouses g
    JOIN users u ON u.id = g.user_id WHERE g.id = ?
  `).get(req.params.id);
  const members = db.prepare(`
    SELECT u.id, u.email, u.name, m.role FROM greenhouse_members m
    JOIN users u ON u.id = m.user_id WHERE m.greenhouse_id = ?
  `).all(req.params.id);
  res.json([owner, ...members]);
});

router.post('/greenhouse/:id/invite', (req, res) => {
  const role = checkGreenhouseAccess(req.user.id, req.params.id, 'owner');
  if (role !== 'owner') return res.status(403).json({ error: 'owner 만 초대할 수 있습니다' });
  const { email, role: newRole = 'member' } = req.body || {};
  if (!['member', 'viewer'].includes(newRole)) return res.status(400).json({ error: 'role must be member|viewer' });
  const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (!user) return res.status(404).json({ error: '해당 이메일의 사용자가 없습니다' });
  const existing = db.prepare('SELECT 1 FROM greenhouse_members WHERE greenhouse_id = ? AND user_id = ?').get(req.params.id, user.id);
  if (existing) return res.status(409).json({ error: '이미 공유된 사용자입니다' });
  db.prepare('INSERT INTO greenhouse_members(greenhouse_id, user_id, role, invited_by) VALUES (?, ?, ?, ?)')
    .run(req.params.id, user.id, newRole, req.user.id);
  audit(req.user.id, 'invite_member', `gh=${req.params.id} user=${user.id} role=${newRole}`, req);
  res.json({ ok: true });
});

router.delete('/greenhouse/:id/members/:userId', (req, res) => {
  const role = checkGreenhouseAccess(req.user.id, req.params.id, 'owner');
  if (role !== 'owner') return res.status(403).json({ error: 'owner 만 제거할 수 있습니다' });
  db.prepare('DELETE FROM greenhouse_members WHERE greenhouse_id = ? AND user_id = ?')
    .run(req.params.id, req.params.userId);
  audit(req.user.id, 'remove_member', `gh=${req.params.id} user=${req.params.userId}`, req);
  res.json({ ok: true });
});

export default router;
