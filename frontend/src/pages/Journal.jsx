import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import { useFirstGreenhouse } from '../hooks/useGreenhouse.jsx';
import { useToast } from '../lib/toast.jsx';

const CATEGORIES = ['작업', '관찰', '방제', '영양', '기타'];

export default function Journal() {
  const { gh } = useFirstGreenhouse();
  const [entries, setEntries] = useState([]);
  const [detail, setDetail] = useState(null);
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({ date: today, category: '관찰', title: '', body: '' });
  const [photo, setPhoto] = useState(null);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef(null);
  const toast = useToast();

  const refresh = async () => {
    if (!gh) return;
    setEntries(await api(`/journal/greenhouse/${gh.id}`));
  };
  useEffect(() => { refresh(); }, [gh?.id]);

  const onFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 6 * 1024 * 1024) { toast.error('사진 최대 6MB'); return; }
    const reader = new FileReader();
    reader.onload = () => setPhoto(reader.result);
    reader.readAsDataURL(f);
  };

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api(`/journal/greenhouse/${gh.id}`, {
        method: 'POST',
        body: JSON.stringify({ ...form, photo_base64: photo }),
      });
      setForm({ date: today, category: '관찰', title: '', body: '' });
      setPhoto(null);
      if (fileRef.current) fileRef.current.value = '';
      toast.success('일지가 저장되었습니다');
      refresh();
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  };

  const loadDetail = async (id) => {
    setDetail(await api(`/journal/greenhouse/${gh.id}/${id}`));
  };

  const remove = async (id) => {
    if (!window.confirm('삭제하시겠어요?')) return;
    await api(`/journal/${id}`, { method: 'DELETE' });
    toast.info('삭제됨');
    setDetail(null);
    refresh();
  };

  if (!gh) return <div className="empty">로딩중...</div>;

  return (
    <>
      <h2>📘 영농일지</h2>
      <p style={{ color: '#8a96a5', fontSize: 13, marginTop: -8 }}>
        작업·관찰·방제 내역을 기록하세요. 정부 지원 사업 신청 시 증빙 자료로 활용 가능합니다.
      </p>

      <div className="panel">
        <h2>새 기록</h2>
        <form onSubmit={submit} style={{ display: 'grid', gap: 8 }}>
          <div className="flex" style={{ gap: 8, flexWrap: 'wrap' }}>
            <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <input placeholder="제목 (예: 잿빛곰팡이 예방 방제)" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <textarea rows={4} placeholder="상세 내용" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })}
                    style={{ background: '#0f141c', color: '#e6e8eb', border: '1px solid #2a3340', padding: 10, borderRadius: 8, fontFamily: 'inherit' }} />
          <input ref={fileRef} type="file" accept="image/*" onChange={onFile} />
          {photo && <img src={photo} alt="preview" style={{ maxWidth: 200, borderRadius: 8 }} />}
          <button type="submit" disabled={loading}>{loading ? '저장중...' : '기록 저장'}</button>
        </form>
      </div>

      <div className="panel">
        <h2>최근 기록</h2>
        {entries.length === 0 && <div className="empty">아직 기록이 없습니다</div>}
        <table>
          <thead><tr><th>날짜</th><th>분류</th><th>제목</th><th>사진</th><th></th></tr></thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id}>
                <td>{e.date}</td>
                <td><span className="badge ok">{e.category || '-'}</span></td>
                <td style={{ cursor: 'pointer' }} onClick={() => loadDetail(e.id)}>{e.title || '(제목 없음)'}</td>
                <td>{e.has_photo ? '📷' : ''}</td>
                <td><button className="ghost" onClick={() => remove(e.id)} style={{ padding: '4px 10px', fontSize: 12 }}>삭제</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {detail && (
        <div className="panel">
          <div className="flex" style={{ justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 12, color: '#8a96a5' }}>{detail.date} · {detail.category}</div>
              <h3 style={{ margin: '4px 0' }}>{detail.title}</h3>
            </div>
            <button className="ghost" onClick={() => setDetail(null)}>닫기</button>
          </div>
          <div style={{ whiteSpace: 'pre-wrap', marginTop: 10 }}>{detail.body}</div>
          {detail.photo_base64 && <img src={detail.photo_base64} alt="" style={{ maxWidth: '100%', marginTop: 14, borderRadius: 8 }} />}
        </div>
      )}
    </>
  );
}
