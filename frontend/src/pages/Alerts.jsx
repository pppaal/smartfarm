import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { useFirstGreenhouse } from '../hooks/useGreenhouse.jsx';

export default function Alerts() {
  const { gh } = useFirstGreenhouse();
  const [alerts, setAlerts] = useState([]);

  const refresh = async () => {
    if (!gh) return;
    setAlerts(await api(`/alerts/greenhouse/${gh.id}`));
  };
  useEffect(() => { refresh(); const t = setInterval(refresh, 15000); return () => clearInterval(t); }, [gh?.id]);

  const ack = async (a) => {
    await api(`/alerts/${a.id}/ack`, { method: 'POST' });
    refresh();
  };

  return (
    <>
      <h2>알림</h2>
      <div className="panel">
        <table>
          <thead><tr><th>시각</th><th>등급</th><th>측정</th><th>메시지</th><th></th></tr></thead>
          <tbody>
            {alerts.length === 0 && <tr><td colSpan="5" className="empty">알림이 없습니다.</td></tr>}
            {alerts.map((a) => (
              <tr key={a.id} style={{ opacity: a.acknowledged ? 0.5 : 1 }}>
                <td>{a.ts}</td>
                <td><span className={`badge ${a.level === 'critical' ? 'crit' : a.level === 'warn' ? 'warn' : 'ok'}`}>{a.level}</span></td>
                <td>{a.metric || '-'}</td>
                <td>{a.message}</td>
                <td>
                  {!a.acknowledged && <button className="ghost" onClick={() => ack(a)}>확인</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
