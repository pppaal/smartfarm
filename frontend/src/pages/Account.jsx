import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, clearToken } from '../lib/api.js';
import { getPushStatus, subscribePush, unsubscribePush, sendTestPush } from '../lib/push.js';
import { useToast } from '../lib/toast.jsx';

export default function Account() {
  const navigate = useNavigate();
  const toast = useToast();
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [push, setPush] = useState({ supported: false, subscribed: false, permission: 'default' });
  const [pushBusy, setPushBusy] = useState(false);

  const exportData = async () => {
    try {
      const res = await fetch('/api/auth/export', { headers: { Authorization: `Bearer ${localStorage.getItem('smartfarm_token')}` } });
      if (!res.ok) throw new Error('export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `smartfarm-export-${new Date().toISOString().slice(0,10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('개인정보 전체를 다운로드했습니다');
    } catch (e) { toast.error(e.message); }
  };

  const refreshPush = async () => setPush(await getPushStatus());
  useEffect(() => { refreshPush(); }, []);

  const togglePush = async () => {
    setPushBusy(true);
    try {
      if (push.subscribed) await unsubscribePush();
      else await subscribePush();
      await refreshPush();
    } catch (e) { alert(e.message); }
    finally { setPushBusy(false); }
  };

  const changePw = async (e) => {
    e.preventDefault();
    setMsg(''); setErr('');
    try {
      await api('/auth/change-password', { method: 'POST', body: JSON.stringify({ current_password: cur, new_password: next }) });
      setMsg('비밀번호가 변경되었습니다'); setCur(''); setNext('');
    } catch (e) { setErr(e.message); }
  };

  const deleteAccount = async () => {
    const t = prompt('정말 탈퇴하시겠습니까? 모든 하우스·센서·매출 데이터가 영구 삭제됩니다.\n확인하시려면 "탈퇴" 라고 입력하세요.');
    if (t !== '탈퇴') return;
    try {
      await api('/auth/delete-account', { method: 'POST' });
      clearToken();
      navigate('/login');
    } catch (e) { alert(e.message); }
  };

  return (
    <>
      <h2>계정 설정</h2>
      <div className="panel">
        <h2>비밀번호 변경</h2>
        <form onSubmit={changePw} style={{ display: 'grid', gap: 8, maxWidth: 360 }}>
          <input type="password" placeholder="현재 비밀번호" value={cur} onChange={(e) => setCur(e.target.value)} required />
          <input type="password" placeholder="새 비밀번호 (8자 이상)" value={next} onChange={(e) => setNext(e.target.value)} minLength={8} required />
          <button type="submit">변경</button>
          {msg && <div style={{ color: '#6bdd9b', fontSize: 13 }}>{msg}</div>}
          {err && <div style={{ color: '#ff8f8f', fontSize: 13 }}>{err}</div>}
        </form>
      </div>

      <div className="panel">
        <h2>푸시 알림</h2>
        {!push.supported && <p style={{ color: '#8a96a5', fontSize: 13 }}>이 브라우저는 웹 푸시를 지원하지 않습니다 (iOS Safari는 홈화면 추가 후 사용 가능).</p>}
        {push.supported && (
          <>
            <p style={{ fontSize: 13, color: '#8a96a5', marginTop: 0 }}>
              자동제어 발동·센서 오프라인 등 warn/critical 알림을 브라우저/홈화면 앱으로 받습니다.
            </p>
            <div className="flex">
              <button onClick={togglePush} disabled={pushBusy}>
                {pushBusy ? '처리중...' : push.subscribed ? '푸시 끄기' : '푸시 켜기'}
              </button>
              {push.subscribed && <button className="ghost" onClick={() => sendTestPush().catch((e) => alert(e.message))}>테스트 전송</button>}
              <span style={{ fontSize: 13, color: push.subscribed ? '#6bdd9b' : '#8a96a5' }}>
                {push.subscribed ? '● 활성' : '○ 비활성'} {push.permission === 'denied' && '(권한 차단됨 — 브라우저 설정에서 허용 필요)'}
              </span>
            </div>
          </>
        )}
      </div>

      <div className="panel">
        <h2>개인정보 내보내기</h2>
        <p style={{ fontSize: 13, color: '#8a96a5', marginTop: 0 }}>
          개인정보보호법상 이동권 보장. 모든 하우스·센서·수확·매출·일지·진단 내역을 JSON으로 받습니다.
        </p>
        <button onClick={exportData}>전체 데이터 다운로드 (JSON)</button>
      </div>

      <div className="panel">
        <h2 style={{ color: '#ff8f8f' }}>회원 탈퇴</h2>
        <p style={{ fontSize: 13, color: '#8a96a5', marginTop: 0 }}>
          탈퇴 시 모든 하우스·센서·측정값·매출 기록이 즉시 영구 삭제됩니다. 복구 불가.
        </p>
        <button onClick={deleteAccount} style={{ background: '#c24a4a' }}>회원 탈퇴</button>
      </div>
    </>
  );
}
