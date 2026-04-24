import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';

// Toss 결제 SDK 동적 로드
async function loadTossSDK(clientKey, customerKey) {
  if (!window.TossPayments) {
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://js.tosspayments.com/v1/payment';
      s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
  }
  return window.TossPayments(clientKey);
}

const fmt = (n) => (n || 0).toLocaleString('ko-KR');

export default function Billing() {
  const [plans, setPlans] = useState([]);
  const [mode, setMode] = useState('degraded');
  const [clientKey, setClientKey] = useState(null);
  const [sub, setSub] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const refresh = async () => {
    const p = await api('/billing/plans');
    setPlans(p.plans); setMode(p.mode); setClientKey(p.toss_client_key);
    const s = await api('/billing/subscription');
    setSub(s.subscription); setInvoices(s.invoices);
  };
  useEffect(() => { refresh(); }, []);

  const subscribe = async (planId) => {
    if (mode === 'degraded' || !clientKey) {
      alert('결제 비활성 — 서버에 TOSS_SECRET_KEY / TOSS_CLIENT_KEY 설정 필요');
      return;
    }
    setBusy(true); setMsg('');
    try {
      const customerKey = 'u-' + (sub?.user_id || '?') + '-' + Date.now();
      const toss = await loadTossSDK(clientKey, customerKey);
      // Billing Auth (카드등록) 창 열기
      await toss.requestBillingAuth('카드', {
        customerKey,
        successUrl: window.location.origin + '/billing?success=1&plan=' + planId + '&customerKey=' + customerKey,
        failUrl: window.location.origin + '/billing?fail=1',
      });
    } catch (e) {
      setMsg(e.message); setBusy(false);
    }
  };

  // successUrl 리다이렉트 처리
  useEffect(() => {
    const qp = new URLSearchParams(window.location.search);
    if (qp.get('success') === '1') {
      const authKey = qp.get('authKey');
      const plan = qp.get('plan');
      const customerKey = qp.get('customerKey');
      if (authKey && plan && customerKey) {
        setBusy(true);
        api('/billing/subscribe', { method: 'POST', body: JSON.stringify({ auth_key: authKey, customer_key: customerKey, plan }) })
          .then(() => { setMsg('구독이 시작되었습니다 ✅'); refresh(); window.history.replaceState({}, '', '/billing'); })
          .catch((e) => setMsg('결제 실패: ' + e.message))
          .finally(() => setBusy(false));
      }
    } else if (qp.get('fail') === '1') {
      setMsg('결제가 취소되었습니다');
      window.history.replaceState({}, '', '/billing');
    }
  }, []);

  const cancel = async () => {
    if (!confirm('정말 구독을 해지하시겠어요? 다음 결제일부터 무료 플랜으로 전환됩니다.')) return;
    await api('/billing/cancel', { method: 'POST' });
    refresh();
  };

  const currentPlan = plans.find((p) => p.id === sub?.plan);

  return (
    <>
      <h2>💰 구독 / 요금제</h2>

      {sub && (
        <div className="panel">
          <h2>현재 플랜</h2>
          <div className="flex" style={{ justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 24, fontWeight: 600 }}>{currentPlan?.name || sub.plan}</div>
              <div style={{ color: '#8a96a5', fontSize: 13, marginTop: 4 }}>
                상태: {sub.status}
                {sub.last4 && ` · 카드 ${sub.card_company || ''} **** ${sub.last4}`}
                {sub.current_period_end && ` · 다음 결제일 ${sub.current_period_end.slice(0,10)}`}
              </div>
            </div>
            {sub.plan !== 'free' && sub.status === 'active' && (
              <button className="ghost" onClick={cancel}>구독 해지</button>
            )}
          </div>
        </div>
      )}

      <div className="row">
        {plans.map((p) => (
          <div key={p.id} className={`card ${sub?.plan === p.id ? 'ok' : ''}`} style={{ minWidth: 240 }}>
            <h3>{p.name}</h3>
            <div className="value">{p.price === 0 ? '무료' : fmt(p.price) + '원'}<span className="unit">/월</span></div>
            <ul style={{ fontSize: 13, color: '#c8ced6', marginTop: 10, paddingLeft: 18 }}>
              <li>하우스 {p.limits.greenhouses >= 999 ? '무제한' : p.limits.greenhouses + '동'}</li>
              <li>센서 {p.limits.devices >= 999 ? '무제한' : p.limits.devices + '개'}</li>
              <li>AI 진단 {p.limits.diagnoses_per_month >= 999 ? '무제한' : p.limits.diagnoses_per_month + '회'}/월</li>
              <li>실시간 모니터링</li>
              <li>자동제어 + 푸시알림</li>
            </ul>
            {sub?.plan === p.id ? (
              <button disabled style={{ width: '100%', marginTop: 10 }}>현재 플랜</button>
            ) : p.id === 'free' ? null : (
              <button onClick={() => subscribe(p.id)} disabled={busy} style={{ width: '100%', marginTop: 10 }}>
                {busy ? '처리중...' : '시작하기'}
              </button>
            )}
          </div>
        ))}
      </div>

      {mode === 'degraded' && (
        <p style={{ color: '#ffd27a', fontSize: 13, marginTop: 10 }}>
          ⚠ 결제 비활성 — 서버에 TOSS_CLIENT_KEY / TOSS_SECRET_KEY 환경변수 설정 필요
        </p>
      )}
      {msg && <p style={{ color: '#6bdd9b', marginTop: 10 }}>{msg}</p>}

      <div className="panel">
        <h2>결제 내역</h2>
        <table>
          <thead><tr><th>날짜</th><th>금액</th><th>상태</th><th>주문번호</th></tr></thead>
          <tbody>
            {invoices.length === 0 && <tr><td colSpan="4" className="empty">결제 내역이 없습니다</td></tr>}
            {invoices.map((i) => (
              <tr key={i.id}>
                <td>{(i.paid_at || i.created_at)?.slice(0, 10)}</td>
                <td>{fmt(i.amount)}원</td>
                <td><span className={`badge ${i.status === 'paid' ? 'ok' : 'warn'}`}>{i.status}</span></td>
                <td style={{ fontSize: 11, color: '#8a96a5' }}>{i.toss_order_id}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
