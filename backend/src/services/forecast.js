import { db } from '../db/index.js';

// 딸기 적산온도 기반 수확 예측
// 설향 기준: 개화 후 약 600 GDD (base 5℃) 누적 시 수확 시작
// 정식(planted_at) 이후 일평균 기온으로 근사
const BASE_TEMP = 5;
const TARGET_GDD_BLOOM = 400;       // 정식 → 개화
const TARGET_GDD_HARVEST = 600;     // 개화 → 수확
const TARGET_GDD_TOTAL = TARGET_GDD_BLOOM + TARGET_GDD_HARVEST;

export function getHarvestForecast(greenhouseId) {
  const gh = db.prepare('SELECT * FROM greenhouses WHERE id = ?').get(greenhouseId);
  if (!gh || !gh.planted_at) {
    return { error: 'planted_at 이 설정되지 않음' };
  }

  const daily = db.prepare(`
    SELECT date(r.ts) AS day,
           AVG(r.temperature) AS tavg,
           MIN(r.temperature) AS tmin,
           MAX(r.temperature) AS tmax
    FROM readings r
    JOIN devices d ON d.id = r.device_id
    WHERE d.greenhouse_id = ? AND date(r.ts) >= date(?)
    GROUP BY date(r.ts)
    ORDER BY day ASC
  `).all(greenhouseId, gh.planted_at);

  let accumulated = 0;
  for (const d of daily) {
    const gdd = Math.max(0, ((d.tmin + d.tmax) / 2) - BASE_TEMP);
    accumulated += gdd;
  }

  // 최근 평균 GDD를 가지고 남은 일수 예측
  const recent = daily.slice(-7);
  const avgDailyGdd = recent.length
    ? recent.reduce((s, d) => s + Math.max(0, ((d.tmin + d.tmax) / 2) - BASE_TEMP), 0) / recent.length
    : 10;

  const remaining = Math.max(0, TARGET_GDD_TOTAL - accumulated);
  const daysLeft = avgDailyGdd > 0 ? Math.ceil(remaining / avgDailyGdd) : null;

  const today = new Date();
  const eta = daysLeft != null ? new Date(today.getTime() + daysLeft * 86400000) : null;

  const progress = Math.min(1, accumulated / TARGET_GDD_TOTAL);
  let stage = '영양생장';
  if (accumulated >= TARGET_GDD_BLOOM) stage = '개화/착과';
  if (accumulated >= TARGET_GDD_TOTAL) stage = '수확기';

  return {
    planted_at: gh.planted_at,
    accumulated_gdd: Math.round(accumulated),
    target_gdd: TARGET_GDD_TOTAL,
    progress_pct: Math.round(progress * 100),
    stage,
    avg_daily_gdd: Math.round(avgDailyGdd * 10) / 10,
    estimated_harvest_date: eta ? eta.toISOString().slice(0, 10) : null,
    days_to_harvest: daysLeft,
  };
}
