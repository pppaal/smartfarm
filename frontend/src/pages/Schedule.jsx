import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { useFirstGreenhouse } from '../hooks/useGreenhouse.jsx';
import { useToast } from '../lib/toast.jsx';

const ACTIONS = { irrigate: '관수', vent: '환기', heat: '난방', cool: '냉방' };

const PRESETS = [
  { name: '매일 새벽 6시', expr: '0 6 * * *' },
  { name: '매일 오후 3시', expr: '0 15 * * *' },
  { name: '매 2시간마다', expr: '0 */2 * * *' },
  { name: '평일 오전 9시', expr: '0 9 * * 1-5' },
];

export default function Schedule() {
  const { gh } = useFirstGreenhouse();
  const [list, setList] = useState([]);
  const [form, setForm] = useState({ name: '', cron_expr: '0 6 * * *', action: 'irrigate', duration_sec: 120 });
  const toast = useToast();

  const refresh = async () => { if (gh) setList(await api(`/schedules/greenhouse/${gh.id}`)); };
  useEffect(() => { refresh(); }, [gh?.id]);

  const add = async (e) => {
    e.preventDefault();
    try {
      await api(`/schedules/greenhouse/${gh.id}`, { method: 'POST', body: JSON.stringify(form) });
      toast.success('스케줄이 등록되었습니다');
      setForm({ name: '', cron_expr: '0 6 * * *', action: 'irrigate', duration_sec: 120 });
      refresh();
    } catch (e) { toast.error(e.message); }
  };

  const toggle = async (s) => {
    try {
      await api(`/schedules/${s.id}`, { method: 'PATCH', body: JSON.stringify({ enabled: s.enabled ? 0 : 1 }) });
      refresh();
    } catch (e) { toast.error(e.message); }
  };

  const remove = async (s) => {
    if (!window.confirm(`"${s.name}" 삭제?`)) return;
    try { await api(`/schedules/${s.id}`, { method: 'DELETE' }); refresh(); toast.info('삭제됨'); }
    catch (e) { toast.error(e.message); }
  };

  if (!gh) return <div className="empty">로딩중...</div>;

  return (
    <>
      <h2>⏰ 스케줄 자동제어</h2>
      <p style={{ color: '#8a96a5', fontSize: 13, marginTop: -8 }}>
        시간 기반 자동 동작. cron 표현식 (분 시 일 월 요일). Asia/Seoul 시간대.
      </p>

      <div className="panel">
        <h2>새 스케줄</h2>
        <form onSubmit={add} style={{ display: 'grid', gap: 8 }}>
          <input placeholder="이름 (예: 아침 정기관수)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <div className="flex" style={{ gap: 8, flexWrap: 'wrap' }}>
            <input placeholder="cron (0 6 * * *)" value={form.cron_expr} onChange={(e) => setForm({ ...form, cron_expr: e.target.value })} style={{ flex: 1 }} />
            <select value={form.action} onChange={(e) => setForm({ ...form, action: e.target.value })}>
              {Object.entries(ACTIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <input type="number" placeholder="지속(초)" value={form.duration_sec} onChange={(e) => setForm({ ...form, duration_sec: Number(e.target.value) })} style={{ width: 100 }} />
            <button type="submit">추가</button>
          </div>
          <div className="flex" style={{ gap: 6, flexWrap: 'wrap' }}>
            {PRESETS.map((p) => (
              <button key={p.expr} type="button" className="ghost" style={{ fontSize: 12, padding: '4px 8px' }}
                      onClick={() => setForm({ ...form, cron_expr: p.expr })}>
                {p.name}
              </button>
            ))}
          </div>
        </form>
      </div>

      <div className="panel">
        <h2>등록된 스케줄</h2>
        <table>
          <thead><tr><th>이름</th><th>cron</th><th>동작</th><th>지속</th><th>마지막 실행</th><th>상태</th><th></th></tr></thead>
          <tbody>
            {list.length === 0 && <tr><td colSpan="7" className="empty">스케줄이 없습니다</td></tr>}
            {list.map((s) => (
              <tr key={s.id}>
                <td>{s.name}</td>
                <td><code style={{ fontSize: 12 }}>{s.cron_expr}</code></td>
                <td>{ACTIONS[s.action]}</td>
                <td>{s.duration_sec}s</td>
                <td style={{ fontSize: 12, color: '#8a96a5' }}>{s.last_fired || '-'}</td>
                <td><span className={`badge ${s.enabled ? 'ok' : 'warn'}`}>{s.enabled ? 'ON' : 'OFF'}</span></td>
                <td>
                  <button className="ghost" onClick={() => toggle(s)} style={{ padding: '4px 10px', fontSize: 12 }}>{s.enabled ? '끄기' : '켜기'}</button>
                  <button className="ghost" onClick={() => remove(s)} style={{ padding: '4px 10px', fontSize: 12, marginLeft: 4 }}>삭제</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
