import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [newPw, setNewPw] = useState('');
  const [step, setStep] = useState(1);
  const [err, setErr] = useState('');
  const [resetUrl, setResetUrl] = useState('');

  const requestToken = async (e) => {
    e.preventDefault();
    setErr('');
    try {
      const r = await api('/auth/request-reset', { method: 'POST', body: JSON.stringify({ email }) });
      // MVP: 이메일 미발송, 서버가 토큰 URL 직접 반환 (프로덕션은 이메일로 전송)
      if (r.reset_url) setResetUrl(r.reset_url);
      setStep(2);
    } catch (e) { setErr(e.message); }
  };

  const resetPassword = async (e) => {
    e.preventDefault();
    setErr('');
    try {
      await api('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, new_password: newPw }) });
      setStep(3);
    } catch (e) { setErr(e.message); }
  };

  return (
    <div className="auth">
      <h1 style={{ textAlign: 'center' }}>🍓 비밀번호 재설정</h1>

      {step === 1 && (
        <form onSubmit={requestToken} className="panel">
          <p style={{ fontSize: 13, color: '#8a96a5' }}>가입한 이메일을 입력하시면 재설정 토큰을 발급해드립니다.</p>
          <input type="email" placeholder="이메일" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ width: '100%', marginBottom: 10 }} />
          <button type="submit" style={{ width: '100%' }}>토큰 요청</button>
          {err && <p style={{ color: '#ff8f8f', marginTop: 10 }}>{err}</p>}
          <p style={{ fontSize: 13, color: '#8a96a5', marginTop: 14, textAlign: 'center' }}>
            <Link to="/login">로그인으로</Link>
          </p>
        </form>
      )}

      {step === 2 && (
        <form onSubmit={resetPassword} className="panel">
          {resetUrl && (
            <div style={{ background: '#0f141c', border: '1px solid #2a3340', padding: 12, borderRadius: 8, marginBottom: 14, fontSize: 12 }}>
              <div style={{ color: '#8a96a5', marginBottom: 6 }}>🔑 발급된 재설정 토큰 (1시간 유효):</div>
              <code style={{ wordBreak: 'break-all' }}>{resetUrl.split('token=')[1]}</code>
              <div style={{ marginTop: 8, fontSize: 11, color: '#8a96a5' }}>
                * 프로덕션 환경에서는 이메일로 자동 발송됩니다
              </div>
            </div>
          )}
          <input placeholder="토큰" value={token} onChange={(e) => setToken(e.target.value)} required style={{ width: '100%', marginBottom: 10 }} />
          <input type="password" placeholder="새 비밀번호 (8자 이상)" minLength={8} value={newPw} onChange={(e) => setNewPw(e.target.value)} required style={{ width: '100%', marginBottom: 10 }} />
          <button type="submit" style={{ width: '100%' }}>비밀번호 변경</button>
          {err && <p style={{ color: '#ff8f8f', marginTop: 10 }}>{err}</p>}
        </form>
      )}

      {step === 3 && (
        <div className="panel" style={{ textAlign: 'center' }}>
          <p style={{ color: '#6bdd9b', fontSize: 16 }}>✓ 비밀번호가 변경되었습니다</p>
          <Link to="/login"><button style={{ marginTop: 14 }}>로그인하기</button></Link>
        </div>
      )}
    </div>
  );
}
