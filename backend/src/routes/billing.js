import { Router } from 'express';
import { db } from '../db/index.js';
import { requireAuth } from '../services/auth.js';
import { audit } from '../services/audit.js';
import {
  PLANS, billingMode, issueBillingKey, chargeBilling,
  generateOrderId, getSubscription,
} from '../services/billing.js';

const router = Router();

router.get('/plans', (req, res) => {
  res.json({
    mode: billingMode(),
    plans: Object.values(PLANS),
    toss_client_key: process.env.TOSS_CLIENT_KEY || null,
  });
});

router.use(requireAuth);

router.get('/subscription', (req, res) => {
  const sub = getSubscription(req.user.id);
  const plan = PLANS[sub.plan] || PLANS.free;
  const invoices = db.prepare('SELECT * FROM invoices WHERE user_id = ? ORDER BY created_at DESC LIMIT 12').all(req.user.id);
  res.json({ subscription: sub, plan, invoices });
});

// 1단계: Toss 결제창에서 받은 authKey 를 billingKey 로 교환 + 즉시 최초 결제
router.post('/subscribe', async (req, res) => {
  const { auth_key, customer_key, plan } = req.body || {};
  if (!auth_key || !customer_key || !PLANS[plan]) {
    return res.status(400).json({ error: 'auth_key, customer_key, plan required' });
  }
  if (plan === 'free') return res.status(400).json({ error: 'cannot subscribe to free plan' });

  const issued = await issueBillingKey({ authKey: auth_key, customerKey: customer_key });
  if (issued.error) return res.status(502).json({ error: issued.error });

  const amount = PLANS[plan].price;
  const orderId = generateOrderId();
  const charge = await chargeBilling({
    billingKey: issued.billingKey, customerKey: customer_key,
    amount, orderId, orderName: `스마트팜 ${PLANS[plan].name} (1개월)`,
    customerEmail: req.user.email,
  });

  const periodEnd = new Date(Date.now() + 30 * 86400000).toISOString();
  const last4 = (issued.card?.number || '').slice(-4);
  const company = issued.card?.company || null;

  const existing = db.prepare('SELECT id FROM subscriptions WHERE user_id = ?').get(req.user.id);
  if (existing) {
    db.prepare(`UPDATE subscriptions SET plan=?, status=?, billing_key=?, customer_key=?, last4=?, card_company=?, current_period_end=?, canceled_at=NULL, updated_at=CURRENT_TIMESTAMP WHERE user_id=?`)
      .run(plan, 'active', issued.billingKey, customer_key, last4, company, periodEnd, req.user.id);
  } else {
    db.prepare(`INSERT INTO subscriptions(user_id, plan, status, billing_key, customer_key, last4, card_company, current_period_end) VALUES (?,?,?,?,?,?,?,?)`)
      .run(req.user.id, plan, 'active', issued.billingKey, customer_key, last4, company, periodEnd);
  }

  db.prepare(`INSERT INTO invoices(user_id, amount, status, toss_payment_key, toss_order_id, paid_at) VALUES (?,?,?,?,?,?)`)
    .run(req.user.id, amount, charge.error ? 'failed' : 'paid', charge.paymentKey || null, orderId, charge.error ? null : new Date().toISOString());

  audit(req.user.id, 'subscribe', plan, req);

  if (charge.error) return res.status(502).json({ error: '최초 결제 실패: ' + charge.error });
  res.json({ ok: true, plan, current_period_end: periodEnd, last4, card_company: company });
});

router.post('/cancel', (req, res) => {
  const sub = getSubscription(req.user.id);
  if (sub.plan === 'free') return res.json({ ok: true, already_free: true });
  db.prepare(`UPDATE subscriptions SET status='canceled', canceled_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE user_id=?`)
    .run(req.user.id);
  audit(req.user.id, 'cancel_subscription', sub.plan, req);
  res.json({ ok: true, note: '다음 결제일부터 무료 플랜으로 전환됩니다' });
});

export default router;
