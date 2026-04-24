-- 사용자
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 비밀번호 재설정 토큰 (1회용, 1시간 유효) — 해시 저장
CREATE TABLE IF NOT EXISTS password_resets (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  expires_at DATETIME NOT NULL,
  used INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id)
);

-- 로그인 실패 추적 (계정 잠금)
CREATE TABLE IF NOT EXISTS login_attempts (
  email TEXT PRIMARY KEY,
  fail_count INTEGER DEFAULT 0,
  locked_until DATETIME,
  last_failed_at DATETIME
);

-- 이용약관 동의 (법적)
CREATE TABLE IF NOT EXISTS consents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  terms INTEGER DEFAULT 0,         -- 이용약관 (필수)
  privacy INTEGER DEFAULT 0,       -- 개인정보처리방침 (필수)
  marketing INTEGER DEFAULT 0,     -- 마케팅 수신 (선택)
  age_14 INTEGER DEFAULT 0,        -- 14세 이상 (필수)
  terms_version TEXT,
  privacy_version TEXT,
  ts DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id)
);

-- JWT 리프레시 토큰
CREATE TABLE IF NOT EXISTS refresh_tokens (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  expires_at DATETIME NOT NULL,
  revoked INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id)
);

-- 영농일지
CREATE TABLE IF NOT EXISTS journal_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  greenhouse_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  date DATE NOT NULL,
  category TEXT,        -- 작업|관찰|방제|영양|기타
  title TEXT,
  body TEXT,
  photo_base64 TEXT,    -- 선택, 사진 첨부
  weather_snapshot TEXT,  -- JSON
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(greenhouse_id) REFERENCES greenhouses(id),
  FOREIGN KEY(user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_journal_gh_date ON journal_entries(greenhouse_id, date DESC);

-- 하우스 공유 (멀티유저)
CREATE TABLE IF NOT EXISTS greenhouse_members (
  greenhouse_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',  -- owner | member | viewer
  invited_by INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (greenhouse_id, user_id),
  FOREIGN KEY(greenhouse_id) REFERENCES greenhouses(id),
  FOREIGN KEY(user_id) REFERENCES users(id)
);

-- 시간 기반 자동제어 스케줄
CREATE TABLE IF NOT EXISTS schedules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  greenhouse_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  cron_expr TEXT NOT NULL,     -- e.g., "0 6 * * *" (매일 6시)
  action TEXT NOT NULL,        -- irrigate | vent | heat | cool
  duration_sec INTEGER NOT NULL DEFAULT 120,
  enabled INTEGER DEFAULT 1,
  last_fired DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(greenhouse_id) REFERENCES greenhouses(id)
);

-- 전력/난방 사용량
CREATE TABLE IF NOT EXISTS energy_readings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  greenhouse_id INTEGER NOT NULL,
  ts DATETIME DEFAULT CURRENT_TIMESTAMP,
  power_w REAL,
  energy_kwh REAL,
  source TEXT,                 -- heater | pump | light | total
  FOREIGN KEY(greenhouse_id) REFERENCES greenhouses(id)
);

-- Web Push 구독
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  endpoint TEXT UNIQUE NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id)
);

-- 감사 로그
CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  action TEXT NOT NULL,
  detail TEXT,
  ip TEXT,
  ts DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 병해 진단
CREATE TABLE IF NOT EXISTS diagnoses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  greenhouse_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  image_mime TEXT,
  disease TEXT,
  severity TEXT,
  confidence REAL,
  recommendation TEXT,
  raw TEXT,
  ts DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(greenhouse_id) REFERENCES greenhouses(id),
  FOREIGN KEY(user_id) REFERENCES users(id)
);

-- 구독 / 결제
CREATE TABLE IF NOT EXISTS subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER UNIQUE NOT NULL,
  plan TEXT NOT NULL DEFAULT 'free',   -- free | basic | pro
  status TEXT NOT NULL DEFAULT 'active', -- active | canceled | past_due
  billing_key TEXT,
  customer_key TEXT,
  last4 TEXT,
  card_company TEXT,
  current_period_end DATETIME,
  canceled_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  subscription_id INTEGER,
  amount INTEGER NOT NULL,
  status TEXT NOT NULL,        -- paid | failed
  toss_payment_key TEXT,
  toss_order_id TEXT UNIQUE,
  paid_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id)
);

-- 농장(하우스) — 여러 동 운영 대비
CREATE TABLE IF NOT EXISTS greenhouses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  location TEXT,
  crop TEXT DEFAULT 'strawberry',
  variety TEXT DEFAULT '설향',
  planted_at DATE,
  area_pyeong REAL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id)
);

-- 디바이스 (ESP32 등)
CREATE TABLE IF NOT EXISTS devices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  greenhouse_id INTEGER NOT NULL,
  device_key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  last_seen DATETIME,
  online INTEGER DEFAULT 0,
  FOREIGN KEY(greenhouse_id) REFERENCES greenhouses(id)
);

-- 센서 측정값 (시계열)
CREATE TABLE IF NOT EXISTS readings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id INTEGER NOT NULL,
  ts DATETIME DEFAULT CURRENT_TIMESTAMP,
  temperature REAL,
  humidity REAL,
  soil_moisture REAL,
  co2 REAL,
  light REAL,
  FOREIGN KEY(device_id) REFERENCES devices(id)
);
CREATE INDEX IF NOT EXISTS idx_readings_device_ts ON readings(device_id, ts DESC);

-- 자동제어 룰
CREATE TABLE IF NOT EXISTS rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  greenhouse_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  metric TEXT NOT NULL,        -- soil_moisture | temperature | humidity | co2
  operator TEXT NOT NULL,      -- < | > | <= | >=
  threshold REAL NOT NULL,
  action TEXT NOT NULL,        -- irrigate | vent | heat | cool
  duration_sec INTEGER DEFAULT 60,
  enabled INTEGER DEFAULT 1,
  cooldown_sec INTEGER DEFAULT 600,
  last_fired DATETIME,
  FOREIGN KEY(greenhouse_id) REFERENCES greenhouses(id)
);

-- 제어 이벤트 로그
CREATE TABLE IF NOT EXISTS actuations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  greenhouse_id INTEGER NOT NULL,
  rule_id INTEGER,
  action TEXT NOT NULL,
  duration_sec INTEGER,
  ts DATETIME DEFAULT CURRENT_TIMESTAMP,
  reason TEXT,
  FOREIGN KEY(greenhouse_id) REFERENCES greenhouses(id)
);

-- 이상 알림
CREATE TABLE IF NOT EXISTS alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  greenhouse_id INTEGER NOT NULL,
  level TEXT NOT NULL,       -- info | warn | critical
  metric TEXT,
  message TEXT NOT NULL,
  ts DATETIME DEFAULT CURRENT_TIMESTAMP,
  acknowledged INTEGER DEFAULT 0,
  FOREIGN KEY(greenhouse_id) REFERENCES greenhouses(id)
);

-- 수확 기록 + 판매
CREATE TABLE IF NOT EXISTS harvests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  greenhouse_id INTEGER NOT NULL,
  date DATE NOT NULL,
  weight_kg REAL NOT NULL,
  grade TEXT,                -- 특 | 상 | 중
  notes TEXT,
  FOREIGN KEY(greenhouse_id) REFERENCES greenhouses(id)
);

CREATE TABLE IF NOT EXISTS sales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  greenhouse_id INTEGER NOT NULL,
  date DATE NOT NULL,
  channel TEXT,              -- 공판장 | 직거래 | 온라인
  weight_kg REAL NOT NULL,
  unit_price INTEGER NOT NULL,
  revenue INTEGER NOT NULL,
  buyer TEXT,
  FOREIGN KEY(greenhouse_id) REFERENCES greenhouses(id)
);
