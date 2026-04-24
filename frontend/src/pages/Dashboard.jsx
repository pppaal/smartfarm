import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { api, openSocket } from '../lib/api.js';
import { useFirstGreenhouse } from '../hooks/useGreenhouse.jsx';

// 딸기 권장범위
const RANGES = {
  temperature:   { min: 18, max: 25, unit: '°C',  label: '온도' },
  humidity:      { min: 50, max: 75, unit: '%',   label: '습도' },
  soil_moisture: { min: 30, max: 70, unit: '%',   label: '토양수분' },
  co2:           { min: 400, max: 1200, unit: 'ppm', label: 'CO₂' },
  light:         { min: 5000, max: 40000, unit: 'lx', label: '조도' },
};

function StatusCard({ metric, value }) {
  const range = RANGES[metric];
  if (value == null) return <div className="card"><h3>{range.label}</h3><div className="value">--</div></div>;
  const cls = value < range.min || value > range.max ? 'warn' : 'ok';
  return (
    <div className={`card ${cls}`}>
      <h3>{range.label}</h3>
      <div className="value">
        {typeof value === 'number' ? value.toFixed(1) : value}
        <span className="unit">{range.unit}</span>
      </div>
      <div style={{ fontSize: 12, color: '#8a96a5', marginTop: 4 }}>
        권장 {range.min}~{range.max}{range.unit}
      </div>
    </div>
  );
}

const ACTION_LABEL = { irrigate: '관수', vent: '환기', heat: '난방', cool: '냉방' };

export default function Dashboard() {
  const { gh } = useFirstGreenhouse();
  const [latest, setLatest] = useState(null);
  const [series, setSeries] = useState([]);
  const [forecast, setForecast] = useState(null);
  const [actuations, setActuations] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [weather, setWeather] = useState(null);

  useEffect(() => {
    if (!gh) return;
    const refresh = async () => {
      try {
        const [l, s, f, a, al, w] = await Promise.all([
          api(`/readings/greenhouse/${gh.id}/latest`),
          api(`/readings/greenhouse/${gh.id}/series?hours=12`),
          api(`/harvests/greenhouse/${gh.id}/forecast`),
          api(`/rules/greenhouse/${gh.id}/actuations`),
          api(`/alerts/greenhouse/${gh.id}`),
          api(`/weather/greenhouse/${gh.id}`).catch(() => null),
        ]);
        setLatest(l); setSeries(s); setForecast(f); setWeather(w);
        setActuations(a.slice(0, 5));
        setAlerts(al.filter((x) => !x.acknowledged).slice(0, 5));
      } catch {}
    };
    refresh();
    const t = setInterval(refresh, 15000);

    const ws = openSocket((msg) => {
      if (msg.type === 'reading') {
        setLatest((prev) => ({ ...(prev || {}), ...msg.data }));
        setSeries((prev) => [...prev.slice(-200), msg.data]);
      }
      if (msg.type === 'actuation') refresh();
    });

    return () => { clearInterval(t); ws.close(); };
  }, [gh?.id]);

  if (!gh) return <div className="empty">하우스가 없습니다.</div>;

  return (
    <>
      <h2 style={{ margin: '0 0 16px' }}>{gh.name} · {gh.variety} · {gh.location}</h2>

      {weather && weather.mode === 'live' && weather.current && (
        <div className="panel" style={{ marginTop: 0, marginBottom: 16 }}>
          <div className="flex" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 12, color: '#8a96a5' }}>🌤 {weather.location} 외기</div>
              <div style={{ fontSize: 22, fontWeight: 600 }}>{weather.current.temp}°C · 습도 {weather.current.humidity}%</div>
              <div style={{ fontSize: 12, color: '#8a96a5', marginTop: 4 }}>
                {weather.minTemp != null && weather.maxTemp != null
                  ? `앞으로 최저 ${Math.round(weather.minTemp)}°C / 최고 ${Math.round(weather.maxTemp)}°C`
                  : '예보 데이터 수신중'}
                {weather.willRain && <span style={{ color: '#7cc4ff', marginLeft: 8 }}>· ☔ 강수 예상</span>}
              </div>
            </div>
            {weather.minTemp != null && weather.minTemp < 3 && (
              <div style={{ background: '#c24a4a33', border: '1px solid #c24a4a', padding: 10, borderRadius: 8, color: '#ff8f8f', fontSize: 13 }}>
                ❄ 저온 경보 · 난방 룰 확인하세요
              </div>
            )}
          </div>
        </div>
      )}
      {weather && weather.mode === 'degraded' && (
        <div style={{ fontSize: 12, color: '#8a96a5', marginBottom: 12 }}>
          🌤 외기 정보 비활성 — KMA_API_KEY 미설정 (기상청 공공데이터 신청: data.go.kr)
        </div>
      )}

      <div className="row">
        <StatusCard metric="temperature" value={latest?.temperature} />
        <StatusCard metric="humidity" value={latest?.humidity} />
        <StatusCard metric="soil_moisture" value={latest?.soil_moisture} />
        <StatusCard metric="co2" value={latest?.co2} />
        <StatusCard metric="light" value={latest?.light} />
      </div>

      <div className="grid2" style={{ marginTop: 16 }}>
        <div className="panel">
          <h2>온·습도 추이 (12시간)</h2>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={series}>
              <CartesianGrid stroke="#1f2630" strokeDasharray="3 3" />
              <XAxis dataKey="ts" tick={{ fill: '#8a96a5', fontSize: 11 }} tickFormatter={(v) => v?.slice(11, 16)} />
              <YAxis tick={{ fill: '#8a96a5', fontSize: 11 }} />
              <Tooltip contentStyle={{ background: '#0f141c', border: '1px solid #2a3340' }} />
              <Line type="monotone" dataKey="temperature" stroke="#ff7a7a" dot={false} name="온도(°C)" />
              <Line type="monotone" dataKey="humidity" stroke="#7cc4ff" dot={false} name="습도(%)" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="panel">
          <h2>토양수분 & CO₂</h2>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={series}>
              <CartesianGrid stroke="#1f2630" strokeDasharray="3 3" />
              <XAxis dataKey="ts" tick={{ fill: '#8a96a5', fontSize: 11 }} tickFormatter={(v) => v?.slice(11, 16)} />
              <YAxis yAxisId="left" tick={{ fill: '#8a96a5', fontSize: 11 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fill: '#8a96a5', fontSize: 11 }} />
              <Tooltip contentStyle={{ background: '#0f141c', border: '1px solid #2a3340' }} />
              <Line yAxisId="left" type="monotone" dataKey="soil_moisture" stroke="#6bdd9b" dot={false} name="수분(%)" />
              <Line yAxisId="right" type="monotone" dataKey="co2" stroke="#e6b66b" dot={false} name="CO₂(ppm)" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid2" style={{ marginTop: 16 }}>
        <div className="panel">
          <h2>최근 자동제어</h2>
          {actuations.length === 0 && <div className="empty">아직 발동된 제어가 없습니다</div>}
          {actuations.map((a) => (
            <div key={a.id} className="flex" style={{ justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #1f2630' }}>
              <div>
                <span className="badge ok" style={{ marginRight: 8 }}>{ACTION_LABEL[a.action] || a.action}</span>
                <span style={{ fontSize: 13 }}>{a.rule_name || a.reason}</span>
              </div>
              <span style={{ fontSize: 12, color: '#8a96a5' }}>{a.ts?.slice(5, 16)}</span>
            </div>
          ))}
        </div>

        <div className="panel">
          <h2>미확인 알림</h2>
          {alerts.length === 0 && <div className="empty">확인되지 않은 알림이 없습니다</div>}
          {alerts.map((a) => (
            <div key={a.id} className="flex" style={{ justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #1f2630' }}>
              <div>
                <span className={`badge ${a.level === 'critical' ? 'crit' : a.level === 'warn' ? 'warn' : 'ok'}`} style={{ marginRight: 8 }}>{a.level}</span>
                <span style={{ fontSize: 13 }}>{a.message}</span>
              </div>
              <span style={{ fontSize: 12, color: '#8a96a5' }}>{a.ts?.slice(5, 16)}</span>
            </div>
          ))}
        </div>
      </div>

      {forecast && !forecast.error && (
        <div className="panel" style={{ marginTop: 16 }}>
          <h2>수확 예측</h2>
          <div className="flex" style={{ justifyContent: 'space-between' }}>
            <div>
              <div className="stage">{forecast.stage}</div>
              <div style={{ marginTop: 10, fontSize: 14, color: '#8a96a5' }}>
                정식일 {forecast.planted_at} · 누적 GDD {forecast.accumulated_gdd}/{forecast.target_gdd} ({forecast.progress_pct}%)
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 13, color: '#8a96a5' }}>예상 수확일</div>
              <div style={{ fontSize: 22, fontWeight: 600 }}>{forecast.estimated_harvest_date || '—'}</div>
              {forecast.days_to_harvest != null && (
                <div style={{ fontSize: 13, color: '#8a96a5' }}>약 {forecast.days_to_harvest}일 남음</div>
              )}
            </div>
          </div>
          <div style={{ marginTop: 12, height: 8, background: '#0f141c', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ width: `${forecast.progress_pct}%`, height: '100%', background: '#6bdd9b' }} />
          </div>
        </div>
      )}
    </>
  );
}
