import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { api, getToken } from '../lib/api.js';
import { useFirstGreenhouse } from '../hooks/useGreenhouse.jsx';

export default function Sales() {
  const { gh } = useFirstGreenhouse();
  const [sales, setSales] = useState([]);
  const [summary, setSummary] = useState(null);
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({ date: today, channel: '공판장', weight_kg: 20, unit_price: 18000, buyer: '' });

  const refresh = async () => {
    if (!gh) return;
    setSales(await api(`/sales/greenhouse/${gh.id}`));
    setSummary(await api(`/sales/greenhouse/${gh.id}/summary`));
  };
  useEffect(() => { refresh(); }, [gh?.id]);

  const add = async (e) => {
    e.preventDefault();
    await api(`/sales/greenhouse/${gh.id}`, { method: 'POST', body: JSON.stringify(form) });
    refresh();
  };

  const fmt = (n) => (n || 0).toLocaleString('ko-KR');
  const chartData = [...(summary?.monthly || [])].reverse();

  return (
    <>
      <h2>매출 관리</h2>

      {summary && (
        <div className="row">
          <div className="card ok">
            <h3>누적 매출</h3>
            <div className="value">{fmt(summary.total.total_revenue)}<span className="unit">원</span></div>
          </div>
          <div className="card ok">
            <h3>누적 출하량</h3>
            <div className="value">{fmt(Math.round(summary.total.total_kg))}<span className="unit">kg</span></div>
          </div>
          <div className="card ok">
            <h3>평균단가 (최근달)</h3>
            <div className="value">{fmt(Math.round(summary.monthly[0]?.avg_price || 0))}<span className="unit">원/kg</span></div>
          </div>
        </div>
      )}

      <div className="panel">
        <h2>월별 매출</h2>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={chartData}>
            <CartesianGrid stroke="#1f2630" strokeDasharray="3 3" />
            <XAxis dataKey="month" tick={{ fill: '#8a96a5', fontSize: 11 }} />
            <YAxis tick={{ fill: '#8a96a5', fontSize: 11 }} tickFormatter={(v) => `${(v/10000).toFixed(0)}만`} />
            <Tooltip contentStyle={{ background: '#0f141c', border: '1px solid #2a3340' }}
                     formatter={(v, n) => n === 'total_revenue' ? [`${fmt(v)}원`, '매출'] : [v, n]} />
            <Bar dataKey="total_revenue" fill="#6bdd9b" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="panel">
        <h2>판매 등록</h2>
        <form onSubmit={add} className="flex" style={{ flexWrap: 'wrap', gap: 8 }}>
          <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          <select value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })}>
            <option>공판장</option><option>직거래</option><option>온라인</option>
          </select>
          <input type="number" step="0.1" placeholder="kg" value={form.weight_kg} onChange={(e) => setForm({ ...form, weight_kg: Number(e.target.value) })} />
          <input type="number" placeholder="단가(원/kg)" value={form.unit_price} onChange={(e) => setForm({ ...form, unit_price: Number(e.target.value) })} />
          <input placeholder="구매자" value={form.buyer} onChange={(e) => setForm({ ...form, buyer: e.target.value })} />
          <button type="submit">저장</button>
          <span style={{ color: '#8a96a5', fontSize: 13 }}>
            예상매출: {fmt(Math.round(form.weight_kg * form.unit_price))}원
          </span>
        </form>
      </div>

      <div className="panel">
        <div className="flex" style={{ justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0 }}>판매 내역</h2>
          <a className="ghost" style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #2a3340', fontSize: 13 }}
             href={`/api/sales/greenhouse/${gh?.id}/export.csv?token=${getToken()}`}>CSV 내보내기</a>
        </div>
        <table>
          <thead><tr><th>날짜</th><th>채널</th><th>무게</th><th>단가</th><th>매출</th><th>구매자</th></tr></thead>
          <tbody>
            {sales.length === 0 && <tr><td colSpan="6" className="empty">판매 내역이 없습니다.</td></tr>}
            {sales.map((s) => (
              <tr key={s.id}>
                <td>{s.date}</td><td>{s.channel}</td><td>{s.weight_kg} kg</td>
                <td>{fmt(s.unit_price)}</td><td>{fmt(s.revenue)}원</td><td>{s.buyer}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
