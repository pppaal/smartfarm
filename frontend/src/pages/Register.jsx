import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, setToken, setRefreshToken } from '../lib/api.js';
import { useToast } from '../lib/toast.jsx';

export default function Register() {
  const [form, setForm] = useState({ email: '', password: '', name: '' });
  const [consent, setConsent] = useState({ terms: false, privacy: false, age_14: false, marketing: false });
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();

  const requiredOk = consent.terms && consent.privacy && consent.age_14;
  const allAgreed = requiredOk && consent.marketing;
  const toggleAll = () => {
    const next = !allAgreed;
    setConsent({ terms: next, privacy: next, age_14: next, marketing: next });
  };

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    if (!requiredOk) { setErr('필수 약관에 동의해주세요'); return; }
    if (form.password.length < 8) { setErr('비밀번호는 8자 이상이어야 합니다'); return; }
    setLoading(true);
    try {
      const r = await api('/auth/register', { method: 'POST', body: JSON.stringify({ ...form, ...consent }) });
      setToken(r.token);
      if (r.refresh_token) setRefreshToken(r.refresh_token);
      toast.success('가입 완료! 첫 하우스를 등록해주세요');
      navigate('/onboarding');
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  };

  const Box = ({ k, children, required }) => (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', cursor: 'pointer' }}>
      <input type="checkbox" checked={consent[k]} onChange={(e) => setConsent({ ...consent, [k]: e.target.checked })} />
      <span style={{ fontSize: 13 }}>
        {required && <span style={{ color: '#ff8f8f' }}>(필수)</span>} {children}
      </span>
    </label>
  );

  return (
    <div className="auth">
      <h1 style={{ textAlign: 'center' }}>🍓 스마트팜 회원가입</h1>
      <form onSubmit={submit} className="panel">
        <input placeholder="이름" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required style={{ width: '100%' }} />
        <input type="email" placeholder="이메일" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required style={{ width: '100%' }} />
        <input type="password" placeholder="비밀번호 (8자 이상)" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} minLength={8} required style={{ width: '100%' }} />

        <div style={{ marginTop: 14, padding: 12, border: '1px solid #1f2630', borderRadius: 8 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, borderBottom: '1px solid #1f2630', paddingBottom: 6, marginBottom: 6 }}>
            <input type="checkbox" checked={allAgreed} onChange={toggleAll} />
            <span>전체 동의 (선택 포함)</span>
          </label>
          <Box k="terms" required><Link to="/terms" target="_blank">이용약관</Link> 동의</Box>
          <Box k="privacy" required><Link to="/privacy" target="_blank">개인정보처리방침</Link> 동의</Box>
          <Box k="age_14" required>만 14세 이상입니다</Box>
          <Box k="marketing">마케팅 정보 수신 (선택, 이벤트·뉴스레터)</Box>
        </div>

        <button type="submit" disabled={loading || !requiredOk} style={{ width: '100%', marginTop: 14 }}>
          {loading ? '가입중...' : '가입하기'}
        </button>
        {err && <p style={{ color: '#ff8f8f', marginTop: 10 }}>{err}</p>}
        <p style={{ fontSize: 13, color: '#8a96a5', marginTop: 14, textAlign: 'center' }}>
          이미 계정이 있으신가요? <Link to="/login">로그인</Link>
        </p>
      </form>
    </div>
  );
}
