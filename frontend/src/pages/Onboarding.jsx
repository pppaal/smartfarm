import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';

export default function Onboarding() {
  const navigate = useNavigate();
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    name: '제1하우스', location: '충청남도 논산', variety: '설향',
    planted_at: today, area_pyeong: 300,
  });
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api('/greenhouses').then((list) => {
      if (list.length > 0) navigate('/');
    }).catch(() => {});
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setErr(''); setLoading(true);
    try {
      const gh = await api('/greenhouses', { method: 'POST', body: JSON.stringify({ ...form, crop: 'strawberry' }) });
      await api(`/greenhouses/${gh.id}/devices`, { method: 'POST', body: JSON.stringify({ name: '중앙 센서' }) });
      await api(`/rules/greenhouse/${gh.id}/seed-defaults`, { method: 'POST' });
      navigate('/');
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ maxWidth: 480, margin: '60px auto', padding: '0 20px' }}>
      <h1 style={{ textAlign: 'center' }}>🍓 하우스 등록</h1>
      <p style={{ color: '#8a96a5', textAlign: 'center', marginBottom: 20 }}>
        첫 하우스를 등록하면 기본 딸기 재배 룰이 자동으로 설정됩니다.
      </p>
      <form onSubmit={submit} className="panel">
        <label style={{ fontSize: 12, color: '#8a96a5' }}>하우스 이름</label>
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required style={{ width: '100%', marginBottom: 12 }} />

        <label style={{ fontSize: 12, color: '#8a96a5' }}>위치</label>
        <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} style={{ width: '100%', marginBottom: 12 }} />

        <label style={{ fontSize: 12, color: '#8a96a5' }}>품종</label>
        <select value={form.variety} onChange={(e) => setForm({ ...form, variety: e.target.value })} style={{ width: '100%', marginBottom: 12 }}>
          <option>설향</option><option>금실</option><option>킹스베리</option><option>매향</option><option>아리향</option>
        </select>

        <label style={{ fontSize: 12, color: '#8a96a5' }}>정식일</label>
        <input type="date" value={form.planted_at} onChange={(e) => setForm({ ...form, planted_at: e.target.value })} style={{ width: '100%', marginBottom: 12 }} />

        <label style={{ fontSize: 12, color: '#8a96a5' }}>면적 (평)</label>
        <input type="number" value={form.area_pyeong} onChange={(e) => setForm({ ...form, area_pyeong: Number(e.target.value) })} style={{ width: '100%', marginBottom: 16 }} />

        <button type="submit" disabled={loading} style={{ width: '100%' }}>
          {loading ? '생성중...' : '하우스 등록하고 시작하기'}
        </button>
        {err && <p style={{ color: '#ff8f8f', marginTop: 10 }}>{err}</p>}
      </form>
    </div>
  );
}
