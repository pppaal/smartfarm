import webpush from 'web-push';
import fs from 'fs';
import path from 'path';
import { db } from '../db/index.js';

const KEY_FILE = process.env.VAPID_KEY_FILE || path.join(process.cwd(), 'data', 'vapid.json');

function loadOrCreateKeys() {
  // ENV 우선
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    return { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY };
  }
  try {
    if (fs.existsSync(KEY_FILE)) {
      return JSON.parse(fs.readFileSync(KEY_FILE, 'utf-8'));
    }
  } catch {}
  const keys = webpush.generateVAPIDKeys();
  fs.mkdirSync(path.dirname(KEY_FILE), { recursive: true });
  fs.writeFileSync(KEY_FILE, JSON.stringify(keys, null, 2));
  console.log('[push] 새 VAPID 키 생성 →', KEY_FILE);
  return keys;
}

export const VAPID = loadOrCreateKeys();
webpush.setVapidDetails(
  process.env.VAPID_SUBJECT || 'mailto:admin@smartfarm.kr',
  VAPID.publicKey,
  VAPID.privateKey
);

export async function pushToUser(userId, payload) {
  const subs = db.prepare('SELECT * FROM push_subscriptions WHERE user_id = ?').all(userId);
  const body = JSON.stringify(payload);
  for (const s of subs) {
    try {
      await webpush.sendNotification({
        endpoint: s.endpoint,
        keys: { p256dh: s.p256dh, auth: s.auth },
      }, body);
    } catch (e) {
      // 410 Gone / 404 → 구독 정리
      if (e.statusCode === 410 || e.statusCode === 404) {
        db.prepare('DELETE FROM push_subscriptions WHERE id = ?').run(s.id);
      } else {
        console.warn('[push] fail', e.statusCode, e.body);
      }
    }
  }
}

// 알림 생성 시 소유자에게 push (critical/warn만)
export async function pushForAlert(alert, greenhouseId) {
  if (alert.level === 'info') return;
  const gh = db.prepare('SELECT user_id, name FROM greenhouses WHERE id = ?').get(greenhouseId);
  if (!gh) return;
  await pushToUser(gh.user_id, {
    title: `🍓 ${gh.name}`,
    body: alert.message,
    icon: '/icon.svg',
    tag: `alert-${greenhouseId}-${alert.level}`,
    data: { url: '/alerts' },
  });
}
