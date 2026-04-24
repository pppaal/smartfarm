import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { useFirstGreenhouse } from '../hooks/useGreenhouse.jsx';
import { useToast } from '../lib/toast.jsx';

const ROLE_LABEL = { owner: '소유자', member: '구성원', viewer: '뷰어' };

export default function Members() {
  const { gh } = useFirstGreenhouse();
  const [list, setList] = useState([]);
  const [form, setForm] = useState({ email: '', role: 'member' });
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const refresh = async () => {
    if (!gh) return;
    setList(await api(`/members/greenhouse/${gh.id}`));
  };
  useEffect(() => { refresh(); }, [gh?.id]);

  const invite = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api(`/members/greenhouse/${gh.id}/invite`, { method: 'POST', body: JSON.stringify(form) });
      toast.success(`${form.email} 을(를) 초대했습니다`);
      setForm({ email: '', role: 'member' });
      refresh();
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  };

  const remove = async (userId) => {
    if (!window.confirm('이 구성원을 제거하시겠어요?')) return;
    try {
      await api(`/members/greenhouse/${gh.id}/members/${userId}`, { method: 'DELETE' });
      toast.info('제거되었습니다');
      refresh();
    } catch (e) { toast.error(e.message); }
  };

  if (!gh) return <div className="empty">로딩중...</div>;

  return (
    <>
      <h2>👥 공유 구성원</h2>
      <p style={{ color: '#8a96a5', fontSize: 13, marginTop: -8 }}>
        가족·근로자를 초대해서 같이 하우스를 관리하세요. (구성원 = 기록·제어 가능 / 뷰어 = 조회만)
      </p>

      <div className="panel">
        <h2>초대 (이미 가입된 이메일만)</h2>
        <form onSubmit={invite} className="flex" style={{ gap: 8, flexWrap: 'wrap' }}>
          <input type="email" placeholder="초대할 이메일" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required style={{ flex: 1, minWidth: 200 }} />
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            <option value="member">구성원</option>
            <option value="viewer">뷰어</option>
          </select>
          <button type="submit" disabled={loading}>{loading ? '초대중...' : '초대'}</button>
        </form>
      </div>

      <div className="panel">
        <h2>현재 구성원</h2>
        <table>
          <thead><tr><th>이름</th><th>이메일</th><th>역할</th><th></th></tr></thead>
          <tbody>
            {list.map((m) => (
              <tr key={m.id}>
                <td>{m.name}</td>
                <td style={{ fontSize: 13, color: '#8a96a5' }}>{m.email}</td>
                <td><span className={`badge ${m.role === 'owner' ? 'ok' : 'warn'}`}>{ROLE_LABEL[m.role]}</span></td>
                <td>
                  {m.role !== 'owner' && <button className="ghost" onClick={() => remove(m.id)} style={{ padding: '4px 10px', fontSize: 12 }}>제거</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
