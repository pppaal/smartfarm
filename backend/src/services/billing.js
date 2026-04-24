// 토스페이먼츠 정기결제 (빌링키) 통합
//
// 흐름:
// 1) 프론트에서 @tosspayments/payment-widget-sdk 로 카드 등록 → authKey 획득
// 2) 백엔드가 authKey → billingKey 교환 (/v1/billing/authorizations/issue)
// 3) 매월 스케줄러가 billingKey 로 결제 요청 (/v1/billing/{billingKey})
//
// ENV: TOSS_SECRET_KEY (test_sk_xxx / live_sk_xxx)
// 미설정 시 → mode='degraded', 모든 구독은 'free' 플랜 유지

import crypto from 'crypto';
import { db } from '../db/index.js';

export const PLANS = {
  free: { id: 'free', name: '무료', price: 0, limits: { greenhouses: 1, devices: 2, diagnoses_per_month: 3 } },
  basic: { id: 'basic', name: '베이직', price: 9900, limits: { greenhouses: 5, devices: 20, diagnoses_per_month: 50 } },
  pro: { id: 'pro', name: '프로', price: 29900, limits: { greenhouses: 999, devices: 999, diagnoses_per_month: 999 } },
};

const TOSS_BASE = 'https://api.tosspayments.com';

export function billingMode() {
  return process.env.TOSS_SECRET_KEY ? 'live' : 'degraded';
}

function authHeader() {
  const key = process.env.TOSS_SECRET_KEY || '';
  return 'Basic ' + Buffer.from(key + ':').toString('base64');
}

export async function issueBillingKey({ authKey, customerKey }) {
  if (billingMode() === 'degraded') return { error: 'TOSS_SECRET_KEY 미설정' };
  const res = await fetch(`${TOSS_BASE}/v1/billing/authorizations/issue`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: authHeader() },
    body: JSON.stringify({ authKey, customerKey }),
  });
  const json = await res.json();
  if (!res.ok) return { error: json?.message || `toss ${res.status}` };
  return json; // { billingKey, card: { number: '****-****-****-1234', company }, ... }
}

export async function chargeBilling({ billingKey, customerKey, amount, orderId, orderName, customerEmail }) {
  if (billingMode() === 'degraded') return { error: 'TOSS_SECRET_KEY 미설정' };
  const res = await fetch(`${TOSS_BASE}/v1/billing/${billingKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: authHeader() },
    body: JSON.stringify({ customerKey, amount, orderId, orderName, customerEmail }),
  });
  const json = await res.json();
  if (!res.ok) return { error: json?.message || `toss ${res.status}`, raw: json };
  return json;
}

export function generateOrderId() {
  return 'smfm_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');
}

export function getSubscription(userId) {
  const s = db.prepare('SELECT * FROM subscriptions WHERE user_id = ?').get(userId);
  if (s) return s;
  db.prepare('INSERT INTO subscriptions(user_id, plan, status) VALUES (?, ?, ?)')
    .run(userId, 'free', 'active');
  return db.prepare('SELECT * FROM subscriptions WHERE user_id = ?').get(userId);
}

export function getPlanLimits(userId) {
  const sub = getSubscription(userId);
  const plan = PLANS[sub.plan] || PLANS.free;
  return { plan: plan.id, limits: plan.limits, status: sub.status };
}
