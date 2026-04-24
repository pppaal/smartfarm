import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { useFirstGreenhouse } from '../hooks/useGreenhouse.jsx';

export default function Harvest() {
  const { gh } = useFirstGreenhouse();
  const [forecast, setForecast] = useState(null);
  const [harvests, setHarvests] = useState([]);
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({ date: today, weight_kg: 10, grade: '특', notes: '' });

  const refresh = async () => {
    if (!gh) return;
    setForecast(await api(`/harvests/greenhouse/${gh.id}/forecast`));
    setHarvests(await api(`/harvests/greenhouse/${gh.id}`));
  };
  useEffect(() => { refresh(); }, [gh?.id]);

  const add = async (e) => {
    e.preventDefault();
    await api(`/harvests/greenhouse/${gh.id}`, { method: 'POST', body: JSON.stringify(form) });
    refresh();
  };

  const total = harvests.reduce((s, h) => s + h.weight_kg, 0);

  return (
    <>
      <h2>수확 예측 · 기록</h2>

      {forecast && !forecast.error && (
        <div className="panel">
          <div className="flex" style={{ justifyContent: 'space-between' }}>
            <div>
              <div className="stage">{forecast.stage}</div>
              <div style={{ marginTop: 8, fontSize: 13, color: '#8a96a5' }}>
                정식일 {forecast.planted_at} · 일평균 GDD {forecast.avg_daily_gdd}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 13, color: '#8a96a5' }}>예상 수확일</div>
              <div style={{ fontSize: 24, fontWeight: 600 }}>{forecast.estimated_harvest_date || '—'}</div>
            </div>
          </div>
          <div style={{ marginTop: 12, height: 10, background: '#0f141c', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ width: `${forecast.progress_pct}%`, height: '100%', background: '#6bdd9b' }} />
          </div>
          <div style={{ marginTop: 6, fontSize: 12, color: '#8a96a5' }}>
            누적 GDD {forecast.accumulated_gdd} / {forecast.target_gdd} ({forecast.progress_pct}%)
          </div>
        </div>
      )}

      <div className="panel">
        <h2>수확 기록 추가</h2>
        <form onSubmit={add} className="flex" style={{ flexWrap: 'wrap', gap: 8 }}>
          <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          <input type="number" step="0.1" placeholder="무게(kg)" value={form.weight_kg} onChange={(e) => setForm({ ...form, weight_kg: Number(e.target.value) })} />
          <select value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })}>
            <option value="특">특</option><option value="상">상</option><option value="중">중</option>
          </select>
          <input placeholder="메모" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <button type="submit">기록</button>
        </form>
      </div>

      <div className="panel">
        <h2>수확 기록 (누적 {total.toFixed(1)}kg)</h2>
        <table>
          <thead><tr><th>날짜</th><th>무게</th><th>등급</th><th>메모</th></tr></thead>
          <tbody>
            {harvests.length === 0 && <tr><td colSpan="4" className="empty">수확 기록이 없습니다.</td></tr>}
            {harvests.map((h) => (
              <tr key={h.id}>
                <td>{h.date}</td><td>{h.weight_kg} kg</td><td>{h.grade || '-'}</td><td>{h.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
