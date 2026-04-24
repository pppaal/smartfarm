import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { db } from '../db/index.js';

// 토큰 해시 (SHA-256) — DB에 평문 저장하지 않기
export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// 계정 잠금 정책
const MAX_FAILS = 5;
const LOCK_MINUTES = 15;

export function isLocked(email) {
  const row = db.prepare('SELECT locked_until FROM login_attempts WHERE email = ?').get(email);
  if (!row?.locked_until) return false;
  // ISO 형식 (toISOString) 은 그대로 파싱 가능. SQLite CURRENT_TIMESTAMP 형식("YYYY-MM-DD HH:MM:SS") 은 ' '→'T' 치환 + 'Z' 추가.
  const s = row.locked_until;
  const normalized = s.includes('T') ? s : s.replace(' ', 'T') + 'Z';
  const until = new Date(normalized).getTime();
  return Number.isFinite(until) && until > Date.now();
}

export function recordFailure(email) {
  const row = db.prepare('SELECT * FROM login_attempts WHERE email = ?').get(email);
  const count = (row?.fail_count || 0) + 1;
  let lockedUntil = null;
  if (count >= MAX_FAILS) {
    lockedUntil = new Date(Date.now() + LOCK_MINUTES * 60 * 1000).toISOString();
  }
  if (row) {
    db.prepare('UPDATE login_attempts SET fail_count=?, locked_until=?, last_failed_at=CURRENT_TIMESTAMP WHERE email=?')
      .run(count, lockedUntil, email);
  } else {
    db.prepare('INSERT INTO login_attempts(email, fail_count, locked_until, last_failed_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)')
      .run(email, count, lockedUntil);
  }
  return { count, lockedUntil };
}

export function clearFailures(email) {
  db.prepare('DELETE FROM login_attempts WHERE email = ?').run(email);
}

// 타이밍 공격 방어: 존재하지 않는 이메일에도 bcrypt 돌려서 응답시간 일정화
const DUMMY_HASH = bcrypt.hashSync('dummy-never-matches-anything-at-all', 10);
export function constantTimeVerify(password, maybeHash) {
  const target = maybeHash || DUMMY_HASH;
  return bcrypt.compareSync(password, target);
}

// 리프레시 토큰 발급/검증
const REFRESH_DAYS = 30;
export function issueRefreshToken(userId) {
  const raw = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(raw);
  const expiresAt = new Date(Date.now() + REFRESH_DAYS * 86400000).toISOString();
  db.prepare('INSERT INTO refresh_tokens(token_hash, user_id, expires_at) VALUES (?, ?, ?)')
    .run(tokenHash, userId, expiresAt);
  return raw;
}

export function consumeRefreshToken(raw) {
  const tokenHash = hashToken(raw);
  const row = db.prepare('SELECT * FROM refresh_tokens WHERE token_hash = ? AND revoked = 0').get(tokenHash);
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) return null;
  // 토큰 로테이션: 사용 즉시 revoke + 새 토큰 발급
  db.prepare('UPDATE refresh_tokens SET revoked = 1 WHERE token_hash = ?').run(tokenHash);
  return row.user_id;
}

export function revokeAllRefreshTokens(userId) {
  db.prepare('UPDATE refresh_tokens SET revoked = 1 WHERE user_id = ?').run(userId);
}
