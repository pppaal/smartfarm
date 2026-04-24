import { Router } from 'express';
import crypto from 'crypto';
import { db } from '../db/index.js';
import { hashPassword, verifyPassword, issueToken, requireAuth } from '../services/auth.js';
import { audit } from '../services/audit.js';
import { validate, schemas } from '../services/validate.js';
import { emailResetLink, emailMode } from '../services/email.js';
import {
  hashToken, isLocked, recordFailure, clearFailures, constantTimeVerify,
  issueRefreshToken, consumeRefreshToken, revokeAllRefreshTokens,
} from '../services/security.js';

const TERMS_VERSION = '2026-04-24';
const PRIVACY_VERSION = '2026-04-24';

const router = Router();

router.post('/register', validate(schemas.register), (req, res) => {
  const { email, password, name, terms, privacy, age_14, marketing } = req.body;

  if (!terms || !privacy || !age_14) {
    return res.status(400).json({ error: '필수 약관에 동의해야 가입할 수 있습니다 (이용약관·개인정보·14세이상)' });
  }

  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (exists) return res.status(409).json({ error: 'email already registered' });

  const info = db.prepare('INSERT INTO users(email, password_hash, name) VALUES (?, ?, ?)')
    .run(email, hashPassword(password), name);
  const userId = info.lastInsertRowid;

  db.prepare(`INSERT INTO consents(user_id, terms, privacy, marketing, age_14, terms_version, privacy_version)
              VALUES (?, 1, 1, ?, 1, ?, ?)`)
    .run(userId, marketing ? 1 : 0, TERMS_VERSION, PRIVACY_VERSION);

  const user = { id: userId, email, name };
  audit(userId, 'register', email, req);
  const accessToken = issueToken(user);
  const refreshToken = issueRefreshToken(userId);
  res.json({ user, token: accessToken, refresh_token: refreshToken });
});

router.post('/login', validate(schemas.login), (req, res) => {
  const { email, password } = req.body;

  if (isLocked(email)) {
    audit(null, 'login_locked', email, req);
    return res.status(423).json({ error: '로그인 시도 초과. 15분 후 다시 시도해주세요' });
  }

  const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  // 상수시간 검증 (사용자 존재 유무 노출 방지)
  const ok = constantTimeVerify(password, row?.password_hash);

  if (!row || !ok) {
    const r = recordFailure(email);
    audit(row?.id || null, 'login_failed', email, req);
    return res.status(401).json({ error: 'invalid credentials', attempts_left: Math.max(0, 5 - r.count) });
  }

  clearFailures(email);
  const user = { id: row.id, email: row.email, name: row.name };
  audit(user.id, 'login', null, req);
  res.json({
    user,
    token: issueToken(user),
    refresh_token: issueRefreshToken(user.id),
  });
});

router.post('/refresh', (req, res) => {
  const { refresh_token } = req.body || {};
  if (!refresh_token) return res.status(400).json({ error: 'refresh_token required' });
  const userId = consumeRefreshToken(refresh_token);
  if (!userId) return res.status(401).json({ error: 'invalid or expired refresh token' });
  const row = db.prepare('SELECT id, email, name FROM users WHERE id = ?').get(userId);
  if (!row) return res.status(401).json({ error: 'user not found' });
  res.json({
    token: issueToken(row),
    refresh_token: issueRefreshToken(row.id),
  });
});

router.post('/logout', requireAuth, (req, res) => {
  const { refresh_token } = req.body || {};
  if (refresh_token) {
    const tokenHash = hashToken(refresh_token);
    db.prepare('UPDATE refresh_tokens SET revoked = 1 WHERE token_hash = ?').run(tokenHash);
  }
  audit(req.user.id, 'logout', null, req);
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

router.post('/change-password', requireAuth, validate(schemas.changePassword), (req, res) => {
  const { current_password, new_password } = req.body;
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!verifyPassword(current_password, row.password_hash)) {
    return res.status(401).json({ error: 'current password incorrect' });
  }
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(new_password), req.user.id);
  revokeAllRefreshTokens(req.user.id);
  audit(req.user.id, 'change_password', null, req);
  res.json({ ok: true });
});

router.post('/request-reset', validate(schemas.requestReset), (req, res) => {
  const { email } = req.body;
  const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!row) return res.json({ ok: true });

  const rawToken = crypto.randomBytes(24).toString('hex');
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  db.prepare('INSERT INTO password_resets(token_hash, user_id, expires_at) VALUES (?, ?, ?)')
    .run(tokenHash, row.id, expiresAt);
  audit(row.id, 'request_reset', null, req);

  const baseUrl = process.env.PUBLIC_URL || 'http://localhost:5173';
  const resetUrl = `${baseUrl}/forgot?token=${rawToken}`;
  emailResetLink({ email, name: row.name, resetUrl }).catch((e) => console.warn('[reset-email]', e.message));

  if (emailMode() === 'smtp') return res.json({ ok: true });
  res.json({ ok: true, reset_url: resetUrl });
});

router.post('/reset-password', validate(schemas.resetPassword), (req, res) => {
  const { token, new_password } = req.body;
  const tokenHash = hashToken(token);
  const row = db.prepare('SELECT * FROM password_resets WHERE token_hash = ? AND used = 0').get(tokenHash);
  if (!row) return res.status(400).json({ error: 'invalid or used token' });
  if (new Date(row.expires_at).getTime() < Date.now()) {
    return res.status(400).json({ error: 'token expired' });
  }
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(new_password), row.user_id);
  db.prepare('UPDATE password_resets SET used = 1 WHERE token_hash = ?').run(tokenHash);
  revokeAllRefreshTokens(row.user_id);
  audit(row.user_id, 'reset_password', null, req);
  res.json({ ok: true });
});

router.post('/delete-account', requireAuth, (req, res) => {
  const uid = req.user.id;
  const gh = db.prepare('SELECT id FROM greenhouses WHERE user_id = ?').all(uid).map((r) => r.id);
  const del = db.transaction(() => {
    for (const id of gh) {
      db.prepare('DELETE FROM readings WHERE device_id IN (SELECT id FROM devices WHERE greenhouse_id = ?)').run(id);
      db.prepare('DELETE FROM devices WHERE greenhouse_id = ?').run(id);
      db.prepare('DELETE FROM rules WHERE greenhouse_id = ?').run(id);
      db.prepare('DELETE FROM schedules WHERE greenhouse_id = ?').run(id);
      db.prepare('DELETE FROM actuations WHERE greenhouse_id = ?').run(id);
      db.prepare('DELETE FROM alerts WHERE greenhouse_id = ?').run(id);
      db.prepare('DELETE FROM harvests WHERE greenhouse_id = ?').run(id);
      db.prepare('DELETE FROM sales WHERE greenhouse_id = ?').run(id);
      db.prepare('DELETE FROM diagnoses WHERE greenhouse_id = ?').run(id);
      db.prepare('DELETE FROM journal_entries WHERE greenhouse_id = ?').run(id);
      db.prepare('DELETE FROM greenhouse_members WHERE greenhouse_id = ?').run(id);
      db.prepare('DELETE FROM energy_readings WHERE greenhouse_id = ?').run(id);
    }
    db.prepare('DELETE FROM greenhouses WHERE user_id = ?').run(uid);
    db.prepare('DELETE FROM push_subscriptions WHERE user_id = ?').run(uid);
    db.prepare('DELETE FROM password_resets WHERE user_id = ?').run(uid);
    db.prepare('DELETE FROM refresh_tokens WHERE user_id = ?').run(uid);
    db.prepare('DELETE FROM consents WHERE user_id = ?').run(uid);
    db.prepare('DELETE FROM subscriptions WHERE user_id = ?').run(uid);
    db.prepare('DELETE FROM invoices WHERE user_id = ?').run(uid);
    db.prepare('DELETE FROM users WHERE id = ?').run(uid);
  });
  del();
  audit(uid, 'delete_account', null, req);
  res.json({ ok: true });
});

// GDPR/개인정보보호법 — 전체 개인정보 내보내기 (JSON)
router.get('/export', requireAuth, (req, res) => {
  const uid = req.user.id;
  const user = db.prepare('SELECT id, email, name, created_at FROM users WHERE id = ?').get(uid);
  const consents = db.prepare('SELECT * FROM consents WHERE user_id = ?').all(uid);
  const greenhouses = db.prepare('SELECT * FROM greenhouses WHERE user_id = ?').all(uid);
  const ghIds = greenhouses.map((g) => g.id);
  const q = (sql) => ghIds.length ? db.prepare(sql.replace('IN_IDS', `IN (${ghIds.map(() => '?').join(',')})`)).all(...ghIds) : [];

  const data = {
    exported_at: new Date().toISOString(),
    user, consents, greenhouses,
    devices: q('SELECT * FROM devices WHERE greenhouse_id IN_IDS'),
    rules: q('SELECT * FROM rules WHERE greenhouse_id IN_IDS'),
    schedules: q('SELECT * FROM schedules WHERE greenhouse_id IN_IDS'),
    harvests: q('SELECT * FROM harvests WHERE greenhouse_id IN_IDS'),
    sales: q('SELECT * FROM sales WHERE greenhouse_id IN_IDS'),
    alerts: q('SELECT * FROM alerts WHERE greenhouse_id IN_IDS'),
    actuations: q('SELECT * FROM actuations WHERE greenhouse_id IN_IDS'),
    diagnoses: q('SELECT * FROM diagnoses WHERE greenhouse_id IN_IDS'),
    journal: q('SELECT * FROM journal_entries WHERE greenhouse_id IN_IDS'),
    energy: q('SELECT * FROM energy_readings WHERE greenhouse_id IN_IDS'),
  };
  audit(uid, 'data_export', null, req);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="smartfarm-export-${uid}.json"`);
  res.send(JSON.stringify(data, null, 2));
});

router.get('/legal-versions', (req, res) => {
  res.json({ terms: TERMS_VERSION, privacy: PRIVACY_VERSION });
});

export default router;
