-- PostgreSQL 스키마 (migrate-to-pg.js 스크립트가 적용)
-- 무료 프리티어: Supabase / Neon / Railway 등 어디서든 돌아감

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS password_resets (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  used INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT UNIQUE NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER,
  action TEXT NOT NULL,
  detail TEXT,
  ip TEXT,
  ts TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS greenhouses (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  location TEXT,
  crop TEXT DEFAULT 'strawberry',
  variety TEXT DEFAULT '설향',
  planted_at DATE,
  area_pyeong DOUBLE PRECISION,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS devices (
  id SERIAL PRIMARY KEY,
  greenhouse_id INTEGER NOT NULL REFERENCES greenhouses(id) ON DELETE CASCADE,
  device_key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  last_seen TIMESTAMPTZ,
  online INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS readings (
  id BIGSERIAL PRIMARY KEY,
  device_id INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  ts TIMESTAMPTZ DEFAULT NOW(),
  temperature DOUBLE PRECISION,
  humidity DOUBLE PRECISION,
  soil_moisture DOUBLE PRECISION,
  co2 DOUBLE PRECISION,
  light DOUBLE PRECISION
);
CREATE INDEX IF NOT EXISTS idx_readings_device_ts ON readings(device_id, ts DESC);

CREATE TABLE IF NOT EXISTS rules (
  id SERIAL PRIMARY KEY,
  greenhouse_id INTEGER NOT NULL REFERENCES greenhouses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  metric TEXT NOT NULL,
  operator TEXT NOT NULL,
  threshold DOUBLE PRECISION NOT NULL,
  action TEXT NOT NULL,
  duration_sec INTEGER DEFAULT 60,
  enabled INTEGER DEFAULT 1,
  cooldown_sec INTEGER DEFAULT 600,
  last_fired TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS actuations (
  id BIGSERIAL PRIMARY KEY,
  greenhouse_id INTEGER NOT NULL REFERENCES greenhouses(id) ON DELETE CASCADE,
  rule_id INTEGER,
  action TEXT NOT NULL,
  duration_sec INTEGER,
  ts TIMESTAMPTZ DEFAULT NOW(),
  reason TEXT
);

CREATE TABLE IF NOT EXISTS alerts (
  id BIGSERIAL PRIMARY KEY,
  greenhouse_id INTEGER NOT NULL REFERENCES greenhouses(id) ON DELETE CASCADE,
  level TEXT NOT NULL,
  metric TEXT,
  message TEXT NOT NULL,
  ts TIMESTAMPTZ DEFAULT NOW(),
  acknowledged INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS harvests (
  id SERIAL PRIMARY KEY,
  greenhouse_id INTEGER NOT NULL REFERENCES greenhouses(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  weight_kg DOUBLE PRECISION NOT NULL,
  grade TEXT,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS sales (
  id SERIAL PRIMARY KEY,
  greenhouse_id INTEGER NOT NULL REFERENCES greenhouses(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  channel TEXT,
  weight_kg DOUBLE PRECISION NOT NULL,
  unit_price INTEGER NOT NULL,
  revenue INTEGER NOT NULL,
  buyer TEXT
);

CREATE TABLE IF NOT EXISTS diagnoses (
  id SERIAL PRIMARY KEY,
  greenhouse_id INTEGER NOT NULL REFERENCES greenhouses(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  image_mime TEXT,
  disease TEXT,
  severity TEXT,
  confidence DOUBLE PRECISION,
  recommendation TEXT,
  raw TEXT,
  ts TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL DEFAULT 'free',
  status TEXT NOT NULL DEFAULT 'active',
  billing_key TEXT,
  customer_key TEXT,
  last4 TEXT,
  card_company TEXT,
  current_period_end TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS invoices (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subscription_id INTEGER,
  amount INTEGER NOT NULL,
  status TEXT NOT NULL,
  toss_payment_key TEXT,
  toss_order_id TEXT UNIQUE,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
