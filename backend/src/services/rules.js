import { db } from '../db/index.js';
import { broadcast } from './ws.js';
import { pushForAlert } from './push.js';

// 딸기 재배 권장 기본값 (참고: 농촌진흥청 가이드)
// 주간 18~25℃, 야간 8~10℃, 습도 50~70%, 토양수분 70~80%, CO2 600~1000ppm
export const STRAWBERRY_DEFAULTS = [
  { name: '토양수분 부족 → 자동관수', metric: 'soil_moisture', operator: '<', threshold: 30, action: 'irrigate', duration_sec: 120, cooldown_sec: 1800 },
  { name: '고온 → 환기', metric: 'temperature', operator: '>', threshold: 28, action: 'vent', duration_sec: 300, cooldown_sec: 900 },
  { name: '저온 → 난방', metric: 'temperature', operator: '<', threshold: 5, action: 'heat', duration_sec: 600, cooldown_sec: 1200 },
  { name: '과습 → 환기', metric: 'humidity', operator: '>', threshold: 85, action: 'vent', duration_sec: 300, cooldown_sec: 900 },
];

export function seedDefaultRules(greenhouseId) {
  const stmt = db.prepare(`
    INSERT INTO rules(greenhouse_id, name, metric, operator, threshold, action, duration_sec, cooldown_sec)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const r of STRAWBERRY_DEFAULTS) {
    stmt.run(greenhouseId, r.name, r.metric, r.operator, r.threshold, r.action, r.duration_sec, r.cooldown_sec);
  }
}

function compare(value, op, threshold) {
  if (value == null) return false;
  switch (op) {
    case '<': return value < threshold;
    case '>': return value > threshold;
    case '<=': return value <= threshold;
    case '>=': return value >= threshold;
    default: return false;
  }
}

export function runRules(greenhouseId, reading) {
  const rules = db.prepare('SELECT * FROM rules WHERE greenhouse_id = ? AND enabled = 1').all(greenhouseId);
  const fired = [];
  const now = Date.now();
  for (const rule of rules) {
    const value = reading[rule.metric];
    if (!compare(value, rule.operator, rule.threshold)) continue;

    if (rule.last_fired) {
      // SQLite CURRENT_TIMESTAMP 포맷: "YYYY-MM-DD HH:MM:SS" (UTC). ISO로 변환 후 파싱.
      const last = new Date(rule.last_fired.replace(' ', 'T') + 'Z').getTime();
      if (Number.isFinite(last) && now - last < rule.cooldown_sec * 1000) continue;
    }

    const reason = `${rule.metric}=${value} ${rule.operator} ${rule.threshold}`;
    db.prepare('UPDATE rules SET last_fired = CURRENT_TIMESTAMP WHERE id = ?').run(rule.id);
    db.prepare(`
      INSERT INTO actuations(greenhouse_id, rule_id, action, duration_sec, reason)
      VALUES (?, ?, ?, ?, ?)
    `).run(greenhouseId, rule.id, rule.action, rule.duration_sec, reason);

    // 경고 등급 판단
    let level = 'info';
    if (rule.action === 'heat' || rule.action === 'cool') level = 'warn';
    const alertMsg = `${rule.name} 발동 (${reason})`;
    db.prepare('INSERT INTO alerts(greenhouse_id, level, metric, message) VALUES (?, ?, ?, ?)')
      .run(greenhouseId, level, rule.metric, alertMsg);

    broadcast({ type: 'actuation', data: { greenhouse_id: greenhouseId, action: rule.action, reason, duration_sec: rule.duration_sec } });
    pushForAlert({ level, message: alertMsg }, greenhouseId).catch(() => {});
    fired.push({ rule_id: rule.id, action: rule.action, reason });
  }
  return fired;
}
