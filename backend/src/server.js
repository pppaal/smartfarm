import 'dotenv/config';
import './services/sentry.js';        // DSN 있으면 먼저 초기화
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import http from 'http';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import pinoHttp from 'pino-http';
import { Sentry } from './services/sentry.js';
import { logger } from './services/logger.js';
import { db } from './db/index.js';
import { hashPassword } from './services/auth.js';
import { attachWs } from './services/ws.js';
import { seedDefaultRules } from './services/rules.js';
import { startHealthMonitor } from './services/health.js';
import { loadAllSchedules } from './services/scheduler.js';
import './services/push.js';

import authRoutes from './routes/auth.js';
import greenhouseRoutes from './routes/greenhouses.js';
import readingRoutes from './routes/readings.js';
import ruleRoutes from './routes/rules.js';
import harvestRoutes from './routes/harvest.js';
import saleRoutes from './routes/sales.js';
import alertRoutes from './routes/alerts.js';
import pushRoutes from './routes/push.js';
import weatherRoutes from './routes/weather.js';
import diagnoseRoutes from './routes/diagnose.js';
import billingRoutes from './routes/billing.js';
import healthRoutes from './routes/health.js';
import journalRoutes from './routes/journal.js';
import memberRoutes from './routes/members.js';
import scheduleRoutes from './routes/schedules.js';
import energyRoutes from './routes/energy.js';

const app = express();
app.set('trust proxy', 1);

// Security: helmet — API 응답 기본 보호
app.use(helmet({
  contentSecurityPolicy: false,  // 프론트엔드(nginx)에서 관리
  crossOriginResourcePolicy: { policy: 'cross-origin' },  // 이미지/아이콘용
}));

// CORS allowlist
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:8080').split(',').map((s) => s.trim());
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);  // curl/서버사이드
    if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error('CORS 차단: ' + origin));
  },
  credentials: true,
}));

// Request ID + 구조화 로그
app.use((req, res, next) => {
  req.id = req.headers['x-request-id'] || crypto.randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
});
app.use(pinoHttp({
  logger,
  genReqId: (req) => req.id,
  serializers: {
    req: (req) => ({ id: req.id, method: req.method, url: req.url }),
    res: (res) => ({ statusCode: res.statusCode }),
  },
  customLogLevel: (req, res, err) => (err || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info'),
}));

app.use(express.json({ limit: '12mb' }));

// Rate limits — 각 경로별 독립 카운터
// loginLimiter 는 실패한 로그인만 카운트 (정상 로그인은 제외)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 20, skipSuccessfulRequests: true,
  message: { error: 'too many login attempts' }, standardHeaders: 'draft-7', legacyHeaders: false,
});
const registerLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 20, message: { error: 'too many registrations' }, standardHeaders: 'draft-7', legacyHeaders: false });
const resetLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 10, message: { error: 'too many reset requests' } });
const refreshLimiter = rateLimit({ windowMs: 60 * 1000, limit: 60, message: { error: 'refresh rate limit' } });
const ingestLimiter = rateLimit({ windowMs: 60 * 1000, limit: 120, message: { error: 'ingest rate limit' } });
const apiLimiter = rateLimit({ windowMs: 60 * 1000, limit: 500, standardHeaders: 'draft-7', legacyHeaders: false });

// 데모 시드
function seed() {
  if (process.env.SEED_DEMO === 'false') return;
  const row = db.prepare('SELECT COUNT(*) AS n FROM users').get();
  if (row.n > 0) return;
  logger.info('데모 계정 생성중...');

  const info = db.prepare('INSERT INTO users(email, password_hash, name) VALUES (?, ?, ?)')
    .run('demo@smartfarm.kr', hashPassword('demo1234'), '데모농장주');
  const userId = info.lastInsertRowid;

  const plantedAt = new Date(Date.now() - 80 * 86400000).toISOString().slice(0, 10);
  const ghInfo = db.prepare(`
    INSERT INTO greenhouses(user_id, name, location, crop, variety, planted_at, area_pyeong)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(userId, '제1하우스', '충청남도 논산', 'strawberry', '설향', plantedAt, 300);
  const ghId = ghInfo.lastInsertRowid;

  db.prepare('INSERT INTO devices(greenhouse_id, device_key, name) VALUES (?, ?, ?)')
    .run(ghId, 'demo-device-key-0001', '중앙 센서');

  seedDefaultRules(ghId);

  db.prepare('INSERT INTO consents(user_id, terms, privacy, marketing, age_14) VALUES (?, 1, 1, 0, 1)').run(userId);

  for (let i = 30; i >= 1; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    if (i % 3 !== 0) continue;
    const weight = 15 + Math.random() * 10;
    const price = 15000 + Math.floor(Math.random() * 5000);
    db.prepare(`INSERT INTO sales(greenhouse_id, date, channel, weight_kg, unit_price, revenue, buyer) VALUES (?,?,?,?,?,?,?)`)
      .run(ghId, d, i % 2 ? '공판장' : '직거래', weight, price, Math.round(weight * price), '논산원예농협');
  }
  logger.info('시드 완료: demo@smartfarm.kr / demo1234');
}
seed();

// Routes
app.use('/api/health', healthRoutes);
app.use('/api/auth/login', loginLimiter);
app.use('/api/auth/register', registerLimiter);
app.use('/api/auth/request-reset', resetLimiter);
app.use('/api/auth/reset-password', resetLimiter);
app.use('/api/auth/refresh', refreshLimiter);
app.use('/api/readings/ingest', ingestLimiter);
app.use('/api/energy/ingest', ingestLimiter);
app.use('/api', apiLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/greenhouses', greenhouseRoutes);
app.use('/api/readings', readingRoutes);
app.use('/api/rules', ruleRoutes);
app.use('/api/harvests', harvestRoutes);
app.use('/api/sales', saleRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/push', pushRoutes);
app.use('/api/weather', weatherRoutes);
app.use('/api/diagnose', diagnoseRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/journal', journalRoutes);
app.use('/api/members', memberRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/energy', energyRoutes);

// Sentry error capture
app.use((err, req, res, next) => {
  logger.error({ err, reqId: req.id }, 'unhandled error');
  if (Sentry?.captureException) Sentry.captureException(err);
  if (err.message?.startsWith('CORS 차단')) return res.status(403).json({ error: err.message });
  res.status(500).json({ error: 'internal error', request_id: req.id });
});

const PORT = process.env.PORT || 4000;
const server = http.createServer(app);
attachWs(server);
startHealthMonitor();
loadAllSchedules();
server.listen(PORT, () => {
  logger.info({ port: PORT }, `smartfarm API listening`);
});

// Graceful shutdown
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    logger.info({ sig }, 'shutting down');
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 5000);
  });
}
