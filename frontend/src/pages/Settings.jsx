import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { useFirstGreenhouse } from '../hooks/useGreenhouse.jsx';

export default function Settings() {
  const { gh } = useFirstGreenhouse();
  const [detail, setDetail] = useState(null);
  const [form, setForm] = useState(null);
  const [deviceName, setDeviceName] = useState('');
  const [saved, setSaved] = useState(false);
  const [copiedKey, setCopiedKey] = useState(null);

  const refresh = async () => {
    if (!gh) return;
    const d = await api(`/greenhouses/${gh.id}`);
    setDetail(d);
    setForm({
      name: d.name, location: d.location || '', variety: d.variety || '',
      planted_at: d.planted_at || '', area_pyeong: d.area_pyeong || 0,
    });
  };
  useEffect(() => { refresh(); }, [gh?.id]);

  const save = async (e) => {
    e.preventDefault();
    await api(`/greenhouses/${gh.id}`, { method: 'PATCH', body: JSON.stringify(form) });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    refresh();
  };

  const addDevice = async (e) => {
    e.preventDefault();
    if (!deviceName.trim()) return;
    await api(`/greenhouses/${gh.id}/devices`, { method: 'POST', body: JSON.stringify({ name: deviceName }) });
    setDeviceName('');
    refresh();
  };

  const removeDevice = async (d) => {
    if (!confirm(`"${d.name}" 디바이스를 삭제하시겠어요?`)) return;
    await api(`/greenhouses/${gh.id}/devices/${d.id}`, { method: 'DELETE' });
    refresh();
  };

  const copyKey = (key) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  if (!gh || !form) return <div className="empty">로딩중...</div>;

  const online = (d) => {
    if (!d.last_seen) return false;
    const ageMs = Date.now() - new Date(d.last_seen + 'Z').getTime();
    return ageMs < 60_000;
  };

  return (
    <>
      <h2>설정</h2>

      <div className="panel">
        <h2>하우스 정보</h2>
        <form onSubmit={save} style={{ display: 'grid', gap: 10, maxWidth: 500 }}>
          <div><label style={{ fontSize: 12, color: '#8a96a5' }}>이름</label>
            <input style={{ width: '100%' }} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><label style={{ fontSize: 12, color: '#8a96a5' }}>위치</label>
            <input style={{ width: '100%' }} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
          <div><label style={{ fontSize: 12, color: '#8a96a5' }}>품종</label>
            <input style={{ width: '100%' }} value={form.variety} onChange={(e) => setForm({ ...form, variety: e.target.value })} /></div>
          <div><label style={{ fontSize: 12, color: '#8a96a5' }}>정식일</label>
            <input type="date" style={{ width: '100%' }} value={form.planted_at} onChange={(e) => setForm({ ...form, planted_at: e.target.value })} /></div>
          <div><label style={{ fontSize: 12, color: '#8a96a5' }}>면적 (평)</label>
            <input type="number" style={{ width: '100%' }} value={form.area_pyeong} onChange={(e) => setForm({ ...form, area_pyeong: Number(e.target.value) })} /></div>
          <div className="flex" style={{ marginTop: 6 }}>
            <button type="submit">저장</button>
            {saved && <span style={{ color: '#6bdd9b', fontSize: 13 }}>저장되었습니다</span>}
          </div>
        </form>
      </div>

      <div className="panel">
        <h2>디바이스 (센서)</h2>
        <table>
          <thead><tr><th>이름</th><th>Device Key</th><th>상태</th><th>마지막 수신</th><th></th></tr></thead>
          <tbody>
            {detail.devices.length === 0 && <tr><td colSpan="5" className="empty">디바이스가 없습니다</td></tr>}
            {detail.devices.map((d) => (
              <tr key={d.id}>
                <td>{d.name}</td>
                <td>
                  <code style={{ fontSize: 12, background: '#0f141c', padding: '3px 6px', borderRadius: 4 }}>{d.device_key}</code>
                  <button className="ghost" style={{ marginLeft: 6, padding: '4px 8px', fontSize: 12 }} onClick={() => copyKey(d.device_key)}>
                    {copiedKey === d.device_key ? '복사됨' : '복사'}
                  </button>
                </td>
                <td><span className={`badge ${online(d) ? 'ok' : 'warn'}`}>{online(d) ? '● 온라인' : '○ 오프라인'}</span></td>
                <td style={{ fontSize: 12, color: '#8a96a5' }}>{d.last_seen || '없음'}</td>
                <td><button className="ghost" onClick={() => removeDevice(d)}>삭제</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <form onSubmit={addDevice} className="flex" style={{ marginTop: 14 }}>
          <input placeholder="디바이스 이름 (예: 북동쪽 센서)" value={deviceName} onChange={(e) => setDeviceName(e.target.value)} style={{ flex: 1 }} />
          <button type="submit">추가</button>
        </form>
        <p style={{ fontSize: 12, color: '#8a96a5', marginTop: 10 }}>
          디바이스 추가 후 Device Key 를 복사해서 ESP32 펌웨어에 붙여넣거나 시뮬레이터 <code>--device</code> 인자로 전달하세요.
        </p>
      </div>
    </>
  );
}
