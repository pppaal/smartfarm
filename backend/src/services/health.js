import { db } from '../db/index.js';
import { broadcast } from './ws.js';
import { pushForAlert } from './push.js';

const OFFLINE_THRESHOLD_MS = 90_000;

// 센서 수신 끊김 감지 + 알림 생성 (1분마다 실행)
export function startHealthMonitor() {
  setInterval(() => {
    const devices = db.prepare('SELECT * FROM devices').all();
    for (const d of devices) {
      const last = d.last_seen ? new Date(d.last_seen + 'Z').getTime() : 0;
      const isOnline = Date.now() - last < OFFLINE_THRESHOLD_MS;
      if (d.online && !isOnline) {
        db.prepare('UPDATE devices SET online = 0 WHERE id = ?').run(d.id);
        const msg = `센서 "${d.name}" 통신 끊김 감지`;
        db.prepare('INSERT INTO alerts(greenhouse_id, level, metric, message) VALUES (?, ?, ?, ?)')
          .run(d.greenhouse_id, 'warn', null, msg);
        broadcast({ type: 'device_offline', data: { device_id: d.id, greenhouse_id: d.greenhouse_id } });
        pushForAlert({ level: 'warn', message: msg }, d.greenhouse_id).catch(() => {});
      }
    }
  }, 60_000);
}
