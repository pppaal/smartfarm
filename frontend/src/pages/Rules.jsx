import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { useFirstGreenhouse } from '../hooks/useGreenhouse.jsx';

const METRICS = { temperature: '온도', humidity: '습도', soil_moisture: '토양수분', co2: 'CO₂' };
const ACTIONS = { irrigate: '관수', vent: '환기', heat: '난방', cool: '냉방' };

export default function Rules() {
  const { gh } = useFirstGreenhouse();
  const [rules, setRules] = useState([]);
  const [actuations, setActuations] = useState([]);
  const [form, setForm] = useState({ name: '', metric: 'soil_moisture', operator: '<', threshold: 30, action: 'irrigate', duration_sec: 120 });

  const refresh = async () => {
    if (!gh) return;
    setRules(await api(`/rules/greenhouse/${gh.id}`));
    setActuations(await api(`/rules/greenhouse/${gh.id}/actuations`));
  };

  useEffect(() => { refresh(); }, [gh?.id]);

  const add = async (e) => {
    e.preventDefault();
    await api(`/rules/greenhouse/${gh.id}`, { method: 'POST', body: JSON.stringify(form) });
    setForm({ ...form, name: '' });
    refresh();
  };

  const toggle = async (r) => {
    await api(`/rules/${r.id}`, { method: 'PATCH', body: JSON.stringify({ enabled: r.enabled ? 0 : 1 }) });
    refresh();
  };

  const remove = async (r) => {
    if (!confirm(`"${r.name}" 룰을 삭제하시겠어요?`)) return;
    await api(`/rules/${r.id}`, { method: 'DELETE' });
    refresh();
  };

  return (
    <>
      <h2>자동제어 룰</h2>
      <div className="panel">
        <table>
          <thead><tr>
            <th>이름</th><th>조건</th><th>동작</th><th>지속</th><th>상태</th><th></th>
          </tr></thead>
          <tbody>
            {rules.map((r) => (
              <tr key={r.id}>
                <td>{r.name}</td>
                <td>{METRICS[r.metric]} {r.operator} {r.threshold}</td>
                <td>{ACTIONS[r.action]}</td>
                <td>{r.duration_sec}s</td>
                <td><span className={`badge ${r.enabled ? 'ok' : 'warn'}`}>{r.enabled ? 'ON' : 'OFF'}</span></td>
                <td>
                  <button className="ghost" onClick={() => toggle(r)}>{r.enabled ? '끄기' : '켜기'}</button>
                  <button className="ghost" onClick={() => remove(r)} style={{ marginLeft: 4 }}>삭제</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="panel">
        <h2>새 룰 추가</h2>
        <form onSubmit={add} className="flex" style={{ flexWrap: 'wrap', gap: 8 }}>
          <input placeholder="이름 (예: 야간 관수)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <select value={form.metric} onChange={(e) => setForm({ ...form, metric: e.target.value })}>
            {Object.entries(METRICS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select value={form.operator} onChange={(e) => setForm({ ...form, operator: e.target.value })}>
            <option value="<">{'<'}</option><option value=">">{'>'}</option>
            <option value="<=">{'≤'}</option><option value=">=">{'≥'}</option>
          </select>
          <input type="number" step="0.1" value={form.threshold} onChange={(e) => setForm({ ...form, threshold: Number(e.target.value) })} />
          <select value={form.action} onChange={(e) => setForm({ ...form, action: e.target.value })}>
            {Object.entries(ACTIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <input type="number" placeholder="지속(초)" value={form.duration_sec} onChange={(e) => setForm({ ...form, duration_sec: Number(e.target.value) })} />
          <button type="submit">추가</button>
        </form>
      </div>

      <div className="panel">
        <h2>최근 제어 이력</h2>
        <table>
          <thead><tr><th>시각</th><th>룰</th><th>동작</th><th>지속</th><th>사유</th></tr></thead>
          <tbody>
            {actuations.length === 0 && <tr><td colSpan="5" className="empty">아직 제어 이력이 없습니다.</td></tr>}
            {actuations.map((a) => (
              <tr key={a.id}>
                <td>{a.ts}</td>
                <td>{a.rule_name || '-'}</td>
                <td>{ACTIONS[a.action]}</td>
                <td>{a.duration_sec}s</td>
                <td style={{ color: '#8a96a5' }}>{a.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
