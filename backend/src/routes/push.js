import { Router } from 'express';
import { db } from '../db/index.js';
import { requireAuth } from '../services/auth.js';
import { validate, schemas } from '../services/validate.js';
import { VAPID, pushToUser } from '../services/push.js';

const router = Router();

router.get('/public-key', (req, res) => {
  res.json({ publicKey: VAPID.publicKey });
});

router.post('/subscribe', requireAuth, validate(schemas.pushSubscribe), (req, res) => {
  const { endpoint, keys } = req.body;
  const exists = db.prepare('SELECT id FROM push_subscriptions WHERE endpoint = ?').get(endpoint);
  if (exists) {
    db.prepare('UPDATE push_subscriptions SET user_id = ?, p256dh = ?, auth = ? WHERE endpoint = ?')
      .run(req.user.id, keys.p256dh, keys.auth, endpoint);
  } else {
    db.prepare('INSERT INTO push_subscriptions(user_id, endpoint, p256dh, auth) VALUES (?, ?, ?, ?)')
      .run(req.user.id, endpoint, keys.p256dh, keys.auth);
  }
  res.json({ ok: true });
});

router.post('/unsubscribe', requireAuth, (req, res) => {
  const { endpoint } = req.body || {};
  if (!endpoint) return res.status(400).json({ error: 'endpoint required' });
  db.prepare('DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?').run(req.user.id, endpoint);
  res.json({ ok: true });
});

router.post('/test', requireAuth, async (req, res) => {
  await pushToUser(req.user.id, {
    title: '🍓 스마트팜 테스트 알림',
    body: '푸시 알림이 정상 설정되었습니다',
    icon: '/icon.svg',
    data: { url: '/' },
  });
  res.json({ ok: true });
});

export default router;
