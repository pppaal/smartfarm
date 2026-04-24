import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useGreenhouses } from '../hooks/useGreenhouse.jsx';

export default function GreenhouseSwitcher() {
  const { list, activeId, setActive, refresh } = useGreenhouses();
  const [adding, setAdding] = useState(false);
  const navigate = useNavigate();

  const onChange = (e) => {
    const v = e.target.value;
    if (v === '__new__') { setAdding(true); return; }
    setActive(Number(v));
  };

  if (adding) return <AddGreenhouseInline onDone={async (newGh) => {
    setAdding(false);
    if (newGh) {
      await refresh();
      setActive(newGh.id);
      navigate('/');
    }
  }} />;

  if (list.length === 0) return null;

  return (
    <select value={activeId || ''} onChange={onChange} style={{ width: '100%', marginBottom: 8 }}>
      {list.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
      <option value="__new__">+ 새 하우스 추가</option>
    </select>
  );
}

function AddGreenhouseInline({ onDone }) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({ name: '', location: '', variety: '설향', planted_at: today, area_pyeong: 200 });
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const gh = await api('/greenhouses', { method: 'POST', body: JSON.stringify({ ...form, crop: 'strawberry' }) });
      await api(`/greenhouses/${gh.id}/devices`, { method: 'POST', body: JSON.stringify({ name: '중앙 센서' }) });
      await api(`/rules/greenhouse/${gh.id}/seed-defaults`, { method: 'POST' });
      onDone(gh);
    } finally { setLoading(false); }
  };

  return (
    <form onSubmit={submit} style={{ display: 'grid', gap: 6, marginBottom: 8 }}>
      <input placeholder="하우스 이름" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      <input placeholder="위치" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
      <input type="date" value={form.planted_at} onChange={(e) => setForm({ ...form, planted_at: e.target.value })} />
      <div className="flex" style={{ gap: 4 }}>
        <button type="submit" disabled={loading} style={{ flex: 1, fontSize: 12, padding: '6px 10px' }}>{loading ? '생성중' : '생성'}</button>
        <button type="button" className="ghost" onClick={() => onDone(null)} style={{ fontSize: 12, padding: '6px 10px' }}>취소</button>
      </div>
    </form>
  );
}
