import { Router } from 'express';
import { db } from '../db/index.js';
import { sentryEnabled } from '../services/sentry.js';
import { emailMode } from '../services/email.js';
import { billingMode } from '../services/billing.js';

const router = Router();
const START_TIME = Date.now();

router.get('/', (req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

router.get('/deep', (req, res) => {
  let dbOk = false; let dbLatencyMs = null;
  try {
    const t0 = Date.now();
    db.prepare('SELECT 1').get();
    dbLatencyMs = Date.now() - t0;
    dbOk = true;
  } catch {}

  const users = db.prepare('SELECT COUNT(*) AS n FROM users').get();
  const devices = db.prepare('SELECT COUNT(*) AS n FROM devices').get();
  const onlineDevices = db.prepare('SELECT COUNT(*) AS n FROM devices WHERE online = 1').get();
  const readingsLastHour = db.prepare("SELECT COUNT(*) AS n FROM readings WHERE ts >= datetime('now', '-1 hour')").get();
  const uptimeSec = Math.round((Date.now() - START_TIME) / 1000);

  res.json({
    ok: dbOk,
    ts: new Date().toISOString(),
    uptime_sec: uptimeSec,
    node: process.version,
    memory_mb: Math.round(process.memoryUsage().rss / 1024 / 1024),
    db: { ok: dbOk, latency_ms: dbLatencyMs, users: users.n, devices: devices.n, online_devices: onlineDevices.n, readings_last_hour: readingsLastHour.n },
    integrations: {
      sentry: sentryEnabled(),
      email: emailMode(),
      billing: billingMode(),
      weather: !!process.env.KMA_API_KEY,
      claude: !!process.env.ANTHROPIC_API_KEY,
      kakao: !!process.env.KAKAO_ALIMTALK_API_KEY,
    },
  });
});

export default router;
