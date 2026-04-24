// 기상청 단기예보(동네예보) API 통합
// 데이터: data.go.kr → 기상청_단기예보 ((구)_초단기예보조회서비스)
// 무료 가입 후 KMA_API_KEY 로 환경변수 설정.
// 미설정 시 degraded 응답 (null).

const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map(); // `${nx},${ny}` → { ts, data }

// LCC DFS 격자 변환 (기상청 공식 C 코드를 JS로 포팅)
// 위경도 → nx, ny 격자좌표
export function toGrid(lat, lon) {
  const RE = 6371.00877, GRID = 5.0;
  const SLAT1 = 30.0, SLAT2 = 60.0;
  const OLON = 126.0, OLAT = 38.0;
  const XO = 43, YO = 136;
  const DEGRAD = Math.PI / 180.0;

  const re = RE / GRID;
  const slat1 = SLAT1 * DEGRAD, slat2 = SLAT2 * DEGRAD;
  const olon = OLON * DEGRAD, olat = OLAT * DEGRAD;

  let sn = Math.tan(Math.PI * 0.25 + slat2 * 0.5) / Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sn = Math.log(Math.cos(slat1) / Math.cos(slat2)) / Math.log(sn);
  let sf = Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sf = (Math.pow(sf, sn) * Math.cos(slat1)) / sn;
  let ro = Math.tan(Math.PI * 0.25 + olat * 0.5);
  ro = (re * sf) / Math.pow(ro, sn);

  const ra_raw = Math.tan(Math.PI * 0.25 + lat * DEGRAD * 0.5);
  const ra = (re * sf) / Math.pow(ra_raw, sn);
  let theta = lon * DEGRAD - olon;
  if (theta > Math.PI) theta -= 2 * Math.PI;
  if (theta < -Math.PI) theta += 2 * Math.PI;
  theta *= sn;

  const nx = Math.floor(ra * Math.sin(theta) + XO + 0.5);
  const ny = Math.floor(ro - ra * Math.cos(theta) + YO + 0.5);
  return { nx, ny };
}

function kmaBaseTime(d = new Date()) {
  // 초단기예보: 매시 45분 이후 발표 (30, 60 min 유예 권장)
  const base = new Date(d.getTime() - 45 * 60 * 1000);
  const yyyy = base.getFullYear();
  const mm = String(base.getMonth() + 1).padStart(2, '0');
  const dd = String(base.getDate()).padStart(2, '0');
  const hh = String(base.getHours()).padStart(2, '0');
  return { baseDate: `${yyyy}${mm}${dd}`, baseTime: `${hh}30` };
}

// 단기예보 (최대 3일, TMN/TMX 최저최고 포함) — base_time 은 02,05,08,11,14,17,20,23
function villageFcstBaseTime(d = new Date()) {
  const hours = [23, 20, 17, 14, 11, 8, 5, 2];
  const nowH = d.getHours();
  let baseHour = hours.find((h) => h <= nowH - 1);  // 10분 여유
  const baseDate = new Date(d);
  if (baseHour == null) {
    baseHour = 23;
    baseDate.setDate(baseDate.getDate() - 1);
  }
  const yyyy = baseDate.getFullYear();
  const mm = String(baseDate.getMonth() + 1).padStart(2, '0');
  const dd = String(baseDate.getDate()).padStart(2, '0');
  return { baseDate: `${yyyy}${mm}${dd}`, baseTime: String(baseHour).padStart(2, '0') + '00' };
}

export async function getVillageForecast({ lat, lon }) {
  const { nx, ny } = toGrid(lat, lon);
  const apiKey = process.env.KMA_API_KEY;
  if (!apiKey) return { mode: 'degraded', reason: 'KMA_API_KEY 미설정', grid: { nx, ny }, days: [] };

  const { baseDate, baseTime } = villageFcstBaseTime();
  const url = new URL('https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst');
  url.searchParams.set('serviceKey', apiKey);
  url.searchParams.set('numOfRows', '800');
  url.searchParams.set('pageNo', '1');
  url.searchParams.set('dataType', 'JSON');
  url.searchParams.set('base_date', baseDate);
  url.searchParams.set('base_time', baseTime);
  url.searchParams.set('nx', String(nx));
  url.searchParams.set('ny', String(ny));

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`KMA ${res.status}`);
    const json = await res.json();
    const items = json?.response?.body?.items?.item || [];
    const byDate = {};
    for (const it of items) {
      byDate[it.fcstDate] ||= { date: it.fcstDate };
      const d = byDate[it.fcstDate];
      if (it.category === 'TMN') d.tmin = Number(it.fcstValue);
      if (it.category === 'TMX') d.tmax = Number(it.fcstValue);
      if (it.category === 'SKY') d.sky = (d.sky || []).concat(Number(it.fcstValue));
      if (it.category === 'POP') d.pop = Math.max(d.pop || 0, Number(it.fcstValue));
    }
    const days = Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 3);
    return { mode: 'live', grid: { nx, ny }, days };
  } catch (e) {
    return { mode: 'error', reason: e.message, grid: { nx, ny }, days: [] };
  }
}

export async function getForecast({ lat, lon }) {
  const { nx, ny } = toGrid(lat, lon);
  const key = `${nx},${ny}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.data;

  const apiKey = process.env.KMA_API_KEY;
  if (!apiKey) {
    return { mode: 'degraded', reason: 'KMA_API_KEY 미설정', grid: { nx, ny }, items: [] };
  }

  const { baseDate, baseTime } = kmaBaseTime();
  const url = new URL('https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtFcst');
  url.searchParams.set('serviceKey', apiKey);
  url.searchParams.set('numOfRows', '60');
  url.searchParams.set('pageNo', '1');
  url.searchParams.set('dataType', 'JSON');
  url.searchParams.set('base_date', baseDate);
  url.searchParams.set('base_time', baseTime);
  url.searchParams.set('nx', String(nx));
  url.searchParams.set('ny', String(ny));

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`KMA ${res.status}`);
    const json = await res.json();
    const items = json?.response?.body?.items?.item || [];
    const parsed = parseItems(items);
    cache.set(key, { ts: Date.now(), data: { mode: 'live', grid: { nx, ny }, ...parsed } });
    return cache.get(key).data;
  } catch (e) {
    return { mode: 'error', reason: e.message, grid: { nx, ny }, items: [] };
  }
}

function parseItems(items) {
  // 시간별로 그룹화
  const byTime = {};
  for (const it of items) {
    const t = `${it.fcstDate} ${it.fcstTime}`;
    byTime[t] ||= { date: it.fcstDate, time: it.fcstTime };
    if (it.category === 'T1H') byTime[t].temp = Number(it.fcstValue);
    if (it.category === 'REH') byTime[t].humidity = Number(it.fcstValue);
    if (it.category === 'PTY') byTime[t].precipType = Number(it.fcstValue); // 0없음 1비 2비눈 3눈 5빗방울 6빗방울눈날림 7눈날림
    if (it.category === 'RN1') byTime[t].rain1h = it.fcstValue;
    if (it.category === 'WSD') byTime[t].wind = Number(it.fcstValue);
  }
  const hours = Object.values(byTime).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const current = hours[0] || null;
  const validTemps = hours.map((h) => h.temp).filter(Number.isFinite);
  const minTemp = validTemps.length ? Math.min(...validTemps) : null;
  const maxTemp = validTemps.length ? Math.max(...validTemps) : null;
  const willRain = hours.some((h) => h.precipType > 0);
  return { current, hours, minTemp, maxTemp, willRain };
}

// 동결 경고 (최저 < 3℃) — 룰엔진이 참조
export function frostRisk(forecast) {
  if (!forecast || forecast.mode !== 'live') return false;
  return forecast.minTemp < 3;
}
