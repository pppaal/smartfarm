import { Routes, Route, Navigate, NavLink, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { getToken, clearToken, api } from './lib/api.js';
import { GreenhouseProvider, useGreenhouses } from './hooks/useGreenhouse.jsx';
import { ToastProvider } from './lib/toast.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import GreenhouseSwitcher from './components/GreenhouseSwitcher.jsx';
import Footer from './components/Footer.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import Onboarding from './pages/Onboarding.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Rules from './pages/Rules.jsx';
import Harvest from './pages/Harvest.jsx';
import Sales from './pages/Sales.jsx';
import Alerts from './pages/Alerts.jsx';
import Settings from './pages/Settings.jsx';
import Account from './pages/Account.jsx';
import Diagnose from './pages/Diagnose.jsx';
import Billing from './pages/Billing.jsx';
import Journal from './pages/Journal.jsx';
import Members from './pages/Members.jsx';
import Schedule from './pages/Schedule.jsx';
import Terms from './pages/Terms.jsx';
import Privacy from './pages/Privacy.jsx';

function ShellInner({ children }) {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const { list, loading } = useGreenhouses();

  useEffect(() => {
    if (!getToken()) { navigate('/login'); return; }
    api('/auth/me').then((r) => setUser(r.user)).catch(() => navigate('/login'));
  }, []);

  useEffect(() => {
    if (!loading && list.length === 0) navigate('/onboarding');
  }, [loading, list.length]);

  const logout = async () => {
    try { await api('/auth/logout', { method: 'POST', body: JSON.stringify({ refresh_token: localStorage.getItem('smartfarm_refresh') }) }); } catch {}
    clearToken();
    navigate('/login');
  };

  if (loading || list.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <div className="app" style={{ flex: 1 }}>
        <aside className="sidebar">
          <h1>🍓 스마트팜</h1>
          <GreenhouseSwitcher />
          <nav>
            <NavLink to="/" end>📊 대시보드</NavLink>
            <NavLink to="/rules">⚙️ 자동제어</NavLink>
            <NavLink to="/schedule">⏰ 스케줄</NavLink>
            <NavLink to="/diagnose">🩺 병해 진단</NavLink>
            <NavLink to="/journal">📘 영농일지</NavLink>
            <NavLink to="/harvest">🌾 수확 예측</NavLink>
            <NavLink to="/sales">💰 매출</NavLink>
            <NavLink to="/alerts">🔔 알림</NavLink>
            <NavLink to="/members">👥 공유</NavLink>
            <NavLink to="/settings">🛠 하우스 설정</NavLink>
            <NavLink to="/billing">💳 요금제</NavLink>
            <NavLink to="/account">👤 계정</NavLink>
          </nav>
          <div style={{ marginTop: 40, fontSize: 13, color: '#8a96a5' }}>
            {user && <div>{user.name}<br/><span style={{ fontSize: 11 }}>{user.email}</span></div>}
            <button className="ghost" style={{ marginTop: 12, width: '100%' }} onClick={logout}>로그아웃</button>
          </div>
        </aside>
        <main className="main">
          <ErrorBoundary>{children}</ErrorBoundary>
        </main>
      </div>
      <Footer />
    </div>
  );
}

function Shell({ children }) {
  return <GreenhouseProvider><ShellInner>{children}</ShellInner></GreenhouseProvider>;
}

export default function App() {
  return (
    <ToastProvider>
      <ErrorBoundary>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot" element={<ForgotPassword />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/onboarding" element={<GreenhouseProvider><Onboarding /></GreenhouseProvider>} />
          <Route path="/" element={<Shell><Dashboard /></Shell>} />
          <Route path="/rules" element={<Shell><Rules /></Shell>} />
          <Route path="/schedule" element={<Shell><Schedule /></Shell>} />
          <Route path="/diagnose" element={<Shell><Diagnose /></Shell>} />
          <Route path="/journal" element={<Shell><Journal /></Shell>} />
          <Route path="/harvest" element={<Shell><Harvest /></Shell>} />
          <Route path="/sales" element={<Shell><Sales /></Shell>} />
          <Route path="/alerts" element={<Shell><Alerts /></Shell>} />
          <Route path="/members" element={<Shell><Members /></Shell>} />
          <Route path="/settings" element={<Shell><Settings /></Shell>} />
          <Route path="/billing" element={<Shell><Billing /></Shell>} />
          <Route path="/account" element={<Shell><Account /></Shell>} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </ErrorBoundary>
    </ToastProvider>
  );
}
