import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, setToken, setRefreshToken } from '../lib/api.js';

export default function Login() {
  const [email, setEmail] = useState('demo@smartfarm.kr');
  const [password, setPassword] = useState('demo1234');
  const [err, setErr] = useState('');
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    try {
      const r = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
      setToken(r.token);
      if (r.refresh_token) setRefreshToken(r.refresh_token);
      navigate('/');
    } catch (e) { setErr(e.message); }
  };

  return (
    <div className="auth">
      <h1 style={{ textAlign: 'center' }}>🍓 스마트팜 로그인</h1>
      <form onSubmit={submit} className="panel">
        <input placeholder="이메일" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input type="password" placeholder="비밀번호" value={password} onChange={(e) => setPassword(e.target.value)} />
        <button type="submit">로그인</button>
        {err && <p style={{ color: '#ff8f8f', marginTop: 10 }}>{err}</p>}
        <p style={{ fontSize: 12, color: '#8a96a5', marginTop: 14 }}>
          데모: demo@smartfarm.kr / demo1234
        </p>
        <p style={{ fontSize: 13, color: '#8a96a5', marginTop: 8, textAlign: 'center' }}>
          <Link to="/register">회원가입</Link> · <Link to="/forgot">비밀번호 찾기</Link>
        </p>
      </form>
    </div>
  );
}
