import cron from 'node-cron';
import { db } from '../db/index.js';
import { broadcast } from './ws.js';
import { pushForAlert } from './push.js';

const activeTasks = new Map(); // schedule_id → cron task

function cronIsValid(expr) {
  try { return cron.validate(expr); } catch { return false; }
}

function fireSchedule(schedule) {
  const reason = `스케줄 "${schedule.name}" (${schedule.cron_expr})`;
  db.prepare('UPDATE schedules SET last_fired = CURRENT_TIMESTAMP WHERE id = ?').run(schedule.id);
  db.prepare(`
    INSERT INTO actuations(greenhouse_id, rule_id, action, duration_sec, reason)
    VALUES (?, NULL, ?, ?, ?)
  `).run(schedule.greenhouse_id, schedule.action, schedule.duration_sec, reason);

  const alertMsg = `${schedule.name} 발동`;
  db.prepare('INSERT INTO alerts(greenhouse_id, level, metric, message) VALUES (?, ?, ?, ?)')
    .run(schedule.greenhouse_id, 'info', null, alertMsg);

  broadcast({
    type: 'actuation',
    data: { greenhouse_id: schedule.greenhouse_id, action: schedule.action, reason, duration_sec: schedule.duration_sec },
  });
  pushForAlert({ level: 'info', message: alertMsg }, schedule.greenhouse_id).catch(() => {});
}

export function registerSchedule(schedule) {
  if (activeTasks.has(schedule.id)) {
    activeTasks.get(schedule.id).stop();
    activeTasks.delete(schedule.id);
  }
  if (!schedule.enabled || !cronIsValid(schedule.cron_expr)) return;
  const task = cron.schedule(schedule.cron_expr, () => fireSchedule(schedule), { timezone: 'Asia/Seoul' });
  activeTasks.set(schedule.id, task);
}

export function unregisterSchedule(id) {
  const task = activeTasks.get(id);
  if (task) { task.stop(); activeTasks.delete(id); }
}

export function loadAllSchedules() {
  const rows = db.prepare('SELECT * FROM schedules WHERE enabled = 1').all();
  rows.forEach(registerSchedule);
  console.log(`[scheduler] ${rows.length} 개 스케줄 등록됨`);
}

export { cronIsValid };
