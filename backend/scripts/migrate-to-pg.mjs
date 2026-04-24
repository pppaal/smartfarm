// SQLite → PostgreSQL 마이그레이션
// 사용:
//   DATABASE_URL=postgres://user:pass@host/db \
//   SQLITE_PATH=./data/smartfarm.db \
//   node scripts/migrate-to-pg.mjs
//
// 1) PG 에 schema.pg.sql 적용
// 2) SQLite 의 모든 테이블을 PG 로 복사
// 3) 시퀀스 reset

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const { Client } = pg;

const SQLITE_PATH = process.env.SQLITE_PATH || './data/smartfarm.db';
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('DATABASE_URL required'); process.exit(1); }

const TABLES = [
  'users', 'password_resets', 'push_subscriptions', 'audit_logs',
  'greenhouses', 'devices', 'readings', 'rules', 'actuations', 'alerts',
  'harvests', 'sales', 'diagnoses', 'subscriptions', 'invoices',
];

async function main() {
  const sqlite = new Database(SQLITE_PATH, { readonly: true });
  const pgClient = new Client({ connectionString: DATABASE_URL });
  await pgClient.connect();

  const schema = fs.readFileSync(path.join(__dirname, '../src/db/schema.pg.sql'), 'utf-8');
  console.log('[schema] applying...');
  await pgClient.query(schema);

  for (const table of TABLES) {
    const exists = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table);
    if (!exists) { console.log(`[${table}] 원본 SQLite 에 없음 — skip`); continue; }
    const rows = sqlite.prepare(`SELECT * FROM ${table}`).all();
    if (rows.length === 0) { console.log(`[${table}] 0 rows — skip`); continue; }

    const cols = Object.keys(rows[0]);
    const colList = cols.map((c) => `"${c}"`).join(',');
    let inserted = 0;
    for (const row of rows) {
      const placeholders = cols.map((_, i) => `$${i + 1}`).join(',');
      const values = cols.map((c) => row[c]);
      try {
        await pgClient.query(
          `INSERT INTO ${table}(${colList}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
          values,
        );
        inserted++;
      } catch (e) {
        console.warn(`[${table}] row ${row.id} failed: ${e.message}`);
      }
    }
    console.log(`[${table}] ${inserted}/${rows.length} rows`);

    // 시퀀스 재설정
    if (cols.includes('id')) {
      try {
        await pgClient.query(`SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE((SELECT MAX(id) FROM ${table}), 1))`);
      } catch {}
    }
  }

  await pgClient.end();
  sqlite.close();
  console.log('✓ migration done');
}
main().catch((e) => { console.error(e); process.exit(1); });
