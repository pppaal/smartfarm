// 종단간 검증 스크립트 — 서버가 http://localhost:4000 에서 이미 실행 중이어야 함
// 실행: node scripts/e2e-test.mjs
import WebSocket from 'ws';

const BASE = process.env.BASE || 'http://localhost:4000';
let pass = 0, fail = 0;
const fails = [];

function ok(name, cond, detail = '') {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; fails.push(`${name}: ${detail}`); console.log(`  ✗ ${name}  ${detail}`); }
}

async function req(method, path, { token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let json = null; try { json = JSON.parse(text); } catch {}
  return { status: res.status, json, text };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  console.log('== 1. Health ==');
  {
    const r = await req('GET', '/api/health');
    ok('health 200', r.status === 200 && r.json?.ok === true);
  }

  console.log('\n== 2. Auth ==');
  let tokenA, tokenB, userAId, refreshA;
  const consent = { terms: true, privacy: true, age_14: true, marketing: false };
  {
    const r = await req('POST', '/api/auth/register', { body: { email: `a${Date.now()}@t.kr`, password: 'password1', name: '테스트A', ...consent } });
    ok('register A 200', r.status === 200 && !!r.json.token);
    tokenA = r.json.token; userAId = r.json.user.id; refreshA = r.json.refresh_token;
    ok('register returns name', r.json.user.name === '테스트A', `got "${r.json.user.name}"`);
    ok('register returns refresh_token', !!r.json.refresh_token);
  }
  {
    const r = await req('POST', '/api/auth/register', { body: { email: `b${Date.now()}@t.kr`, password: 'password1', name: '테스트B', ...consent } });
    ok('register B 200', r.status === 200);
    tokenB = r.json.token;
  }
  {
    const noConsent = await req('POST', '/api/auth/register', { body: { email: `noc${Date.now()}@t.kr`, password: 'password1', name: 'NoC', terms: false, privacy: true, age_14: true } });
    ok('register without terms -> 400', noConsent.status === 400);
  }
  {
    await req('POST', '/api/auth/register', { body: { email: 'dup@t.kr', password: 'password1', name: 'x', ...consent } });
    const r2 = await req('POST', '/api/auth/register', { body: { email: 'dup@t.kr', password: 'password1', name: 'x', ...consent } });
    ok('register duplicate email -> 409', r2.status === 409, `got ${r2.status}`);
  }
  {
    const r = await req('POST', '/api/auth/register', { body: { email: '', password: '', name: '' } });
    ok('register missing fields -> 400', r.status === 400);
  }
  {
    const r = await req('POST', '/api/auth/login', { body: { email: 'nope@t.kr', password: 'x' } });
    ok('login wrong creds -> 401', r.status === 401);
  }
  {
    const r = await req('GET', '/api/auth/me', { token: tokenA });
    ok('me with token', r.status === 200 && r.json.user.id === userAId);
  }
  {
    const r = await req('GET', '/api/auth/me');
    ok('me without token -> 401', r.status === 401);
  }
  {
    const r = await req('GET', '/api/auth/me', { token: 'garbage.token.here' });
    ok('me with bad token -> 401', r.status === 401);
  }

  console.log('\n== 3. Greenhouse CRUD + 소유 격리 ==');
  let ghA;
  {
    const r = await req('POST', '/api/greenhouses', { token: tokenA, body: { name: 'A1하우스', location: '논산', variety: '설향', planted_at: '2026-02-10', area_pyeong: 200 } });
    ok('create greenhouse A1', r.status === 200 && r.json.id);
    ghA = r.json;
  }
  {
    const r = await req('POST', '/api/greenhouses', { token: tokenA, body: {} });
    ok('create greenhouse missing name -> 400', r.status === 400);
  }
  {
    const r = await req('GET', '/api/greenhouses', { token: tokenA });
    ok('list greenhouses A', r.status === 200 && r.json.length === 1);
  }
  {
    const r = await req('GET', '/api/greenhouses', { token: tokenB });
    ok('B sees 0 greenhouses', r.status === 200 && r.json.length === 0);
  }
  {
    const r = await req('GET', `/api/greenhouses/${ghA.id}`, { token: tokenB });
    ok("B can't read A's greenhouse -> 404", r.status === 404);
  }
  {
    const r = await req('PATCH', `/api/greenhouses/${ghA.id}`, { token: tokenA, body: { area_pyeong: 250 } });
    ok('PATCH greenhouse updates field', r.status === 200 && r.json.area_pyeong === 250);
  }
  {
    const r = await req('PATCH', `/api/greenhouses/${ghA.id}`, { token: tokenB, body: { area_pyeong: 999 } });
    ok("B can't PATCH A's greenhouse", r.status === 404);
  }

  console.log('\n== 4. Devices ==');
  let deviceA;
  {
    const r = await req('POST', `/api/greenhouses/${ghA.id}/devices`, { token: tokenA, body: { name: '센서#1' } });
    ok('create device', r.status === 200 && r.json.device_key);
    deviceA = r.json;
    ok('device_key length >= 20', deviceA.device_key.length >= 20);
    ok('device initial offline', deviceA.online === 0);
  }
  {
    const r = await req('POST', `/api/greenhouses/${ghA.id}/devices`, { token: tokenB, body: { name: 'X' } });
    ok("B can't add device to A's gh", r.status === 404);
  }
  {
    const r = await req('POST', `/api/greenhouses/${ghA.id}/devices`, { token: tokenA, body: { name: '센서#2' } });
    ok('second device created', r.status === 200);
    const del = await req('DELETE', `/api/greenhouses/${ghA.id}/devices/${r.json.id}`, { token: tokenA });
    ok('delete device', del.status === 200 && del.json.ok);
    const del2 = await req('DELETE', `/api/greenhouses/${ghA.id}/devices/${r.json.id}`, { token: tokenA });
    ok('delete again -> 404', del2.status === 404);
  }

  console.log('\n== 5. Readings ingest ==');
  {
    const r = await req('POST', '/api/readings/ingest', { body: { device_key: 'nonexistent', temperature: 20 } });
    ok('ingest wrong key -> 404', r.status === 404);
  }
  {
    const r = await req('POST', '/api/readings/ingest', { body: { temperature: 20 } });
    ok('ingest missing device_key -> 400', r.status === 400);
  }
  {
    // 룰 시드하지 않은 상태에서 ingest → fired 비어야 함
    const r = await req('POST', '/api/readings/ingest', { body: { device_key: deviceA.device_key, temperature: 22, humidity: 60, soil_moisture: 50, co2: 700, light: 10000 } });
    ok('ingest normal reading ok', r.status === 200 && r.json.ok === true);
    ok('no rules → no fired', Array.isArray(r.json.fired) && r.json.fired.length === 0);
  }
  {
    const r = await req('POST', `/api/rules/greenhouse/${ghA.id}/seed-defaults`, { token: tokenA });
    ok('seed-defaults ok', r.status === 200 && r.json.ok);
    const rules = await req('GET', `/api/rules/greenhouse/${ghA.id}`, { token: tokenA });
    ok('seeded 4 default rules', rules.json.length === 4, `got ${rules.json.length}`);
    const again = await req('POST', `/api/rules/greenhouse/${ghA.id}/seed-defaults`, { token: tokenA });
    ok('seed again is no-op', again.json.skipped === true);
  }
  {
    const r = await req('POST', '/api/readings/ingest', { body: { device_key: deviceA.device_key, temperature: 22, humidity: 60, soil_moisture: 20, co2: 700, light: 10000 } });
    ok('low soil moisture fires irrigate', r.json.fired.some((f) => f.action === 'irrigate'));
  }
  {
    const r = await req('POST', '/api/readings/ingest', { body: { device_key: deviceA.device_key, temperature: 22, humidity: 60, soil_moisture: 15, co2: 700, light: 10000 } });
    ok('cooldown prevents immediate refire', !r.json.fired.some((f) => f.action === 'irrigate'));
  }
  {
    const latest = await req('GET', `/api/readings/greenhouse/${ghA.id}/latest`, { token: tokenA });
    ok('latest reading returned', latest.status === 200 && latest.json?.soil_moisture != null);
    const series = await req('GET', `/api/readings/greenhouse/${ghA.id}/series?hours=24`, { token: tokenA });
    ok('series returns array', series.status === 200 && Array.isArray(series.json) && series.json.length >= 3);
  }
  {
    const latestB = await req('GET', `/api/readings/greenhouse/${ghA.id}/latest`, { token: tokenB });
    ok("B can't read A's latest", latestB.status === 404);
  }

  console.log('\n== 6. Rules CRUD ==');
  let newRuleId;
  {
    const r = await req('POST', `/api/rules/greenhouse/${ghA.id}`, { token: tokenA, body: { name: '맞춤룰', metric: 'temperature', operator: '>', threshold: 30, action: 'vent', duration_sec: 180 } });
    ok('create custom rule', r.status === 200); newRuleId = r.json.id;
    const patched = await req('PATCH', `/api/rules/${newRuleId}`, { token: tokenA, body: { enabled: 0 } });
    ok('patch disable rule', patched.json.enabled === 0);
    const delR = await req('DELETE', `/api/rules/${newRuleId}`, { token: tokenA });
    ok('delete rule', delR.status === 200);
  }
  {
    const acts = await req('GET', `/api/rules/greenhouse/${ghA.id}/actuations`, { token: tokenA });
    ok('actuations list returned', acts.status === 200 && acts.json.length >= 1);
  }

  console.log('\n== 7. Harvest forecast + records ==');
  {
    const r = await req('GET', `/api/harvests/greenhouse/${ghA.id}/forecast`, { token: tokenA });
    ok('forecast returns', r.status === 200);
    ok('forecast has stage', typeof r.json.stage === 'string');
    ok('forecast has GDD progress', r.json.progress_pct >= 0 && r.json.progress_pct <= 100);
  }
  {
    const r = await req('POST', `/api/harvests/greenhouse/${ghA.id}`, { token: tokenA, body: { date: '2026-04-20', weight_kg: 15.5, grade: '특', notes: 'first pick' } });
    ok('add harvest record', r.status === 200 && r.json.weight_kg === 15.5);
    const list = await req('GET', `/api/harvests/greenhouse/${ghA.id}`, { token: tokenA });
    ok('list harvests', list.json.length === 1);
  }
  {
    const r = await req('POST', `/api/harvests/greenhouse/${ghA.id}`, { token: tokenA, body: { date: '2026-04-21' } });
    ok('add harvest missing weight -> 400', r.status === 400);
  }

  console.log('\n== 8. Sales + CSV + Summary ==');
  {
    const r = await req('POST', `/api/sales/greenhouse/${ghA.id}`, { token: tokenA, body: { date: '2026-04-20', channel: '공판장', weight_kg: 10, unit_price: 18000, buyer: '논산원협' } });
    ok('add sale', r.status === 200 && r.json.revenue === 180000);
  }
  {
    const r = await req('POST', `/api/sales/greenhouse/${ghA.id}`, { token: tokenA, body: {} });
    ok('add sale missing fields -> 400', r.status === 400);
  }
  {
    const s = await req('GET', `/api/sales/greenhouse/${ghA.id}/summary`, { token: tokenA });
    ok('summary returns monthly+total', s.status === 200 && s.json.total.total_revenue === 180000);
  }
  {
    // CSV via query token  (fetch.text()는 UTF-8 BOM 자동 제거 → raw bytes 검사)
    const res = await fetch(`${BASE}/api/sales/greenhouse/${ghA.id}/export.csv?token=${tokenA}`);
    const buf = new Uint8Array(await res.arrayBuffer());
    const body = new TextDecoder('utf-8').decode(buf);
    ok('CSV 200', res.status === 200);
    ok('CSV has UTF-8 BOM bytes (EF BB BF)', buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF);
    ok('CSV has header', body.includes('date,channel,weight_kg,unit_price,revenue,buyer'));
    ok('CSV has data row', body.includes('18000'));
    ok('CSV content-type', (res.headers.get('content-type') || '').includes('csv'));
  }
  {
    const res = await fetch(`${BASE}/api/sales/greenhouse/${ghA.id}/export.csv`);
    ok('CSV no token -> 401', res.status === 401);
  }

  console.log('\n== 9. Alerts ==');
  {
    const r = await req('GET', `/api/alerts/greenhouse/${ghA.id}`, { token: tokenA });
    ok('alerts list', r.status === 200 && r.json.length >= 1);
    const first = r.json[0];
    const ack = await req('POST', `/api/alerts/${first.id}/ack`, { token: tokenA });
    ok('alert ack', ack.status === 200 && ack.json.ok);
    const again = await req('GET', `/api/alerts/greenhouse/${ghA.id}`, { token: tokenA });
    const acked = again.json.find((a) => a.id === first.id);
    ok('alert now acknowledged', acked.acknowledged === 1);
  }

  console.log('\n== 10. WebSocket broadcast ==');
  const gotFlags = await new Promise((resolve) => {
    const ws = new WebSocket(BASE.replace('http', 'ws') + '/ws');
    let got = 0;
    let done = false;
    const finish = () => { if (done) return; done = true; try { ws.close(); } catch {} resolve(got); };
    ws.on('message', (buf) => {
      try {
        const msg = JSON.parse(buf.toString());
        if (msg.type === 'hello') got |= 1;
        if (msg.type === 'reading') got |= 2;
        if (msg.type === 'actuation') got |= 4;
        if (got === 7) finish();
      } catch {}
    });
    ws.on('open', async () => {
      await sleep(200);
      await req('POST', '/api/readings/ingest', { body: { device_key: deviceA.device_key, temperature: 30, humidity: 60, soil_moisture: 70, co2: 700, light: 10000 } });
      setTimeout(finish, 1500);
    });
    ws.on('error', () => finish());
    setTimeout(finish, 3000);
  });
  ok('ws hello', (gotFlags & 1) !== 0);
  ok('ws reading broadcast', (gotFlags & 2) !== 0);
  ok('ws actuation broadcast (vent fired)', (gotFlags & 4) !== 0);

  console.log('\n== 10.5 Refresh token + Logout ==');
  {
    const r = await req('POST', '/api/auth/refresh', { body: { refresh_token: refreshA } });
    ok('refresh ok + new access token', r.status === 200 && r.json.token);
    ok('refresh rotates (new refresh_token)', r.json.refresh_token && r.json.refresh_token !== refreshA);
    const reuse = await req('POST', '/api/auth/refresh', { body: { refresh_token: refreshA } });
    ok('old refresh revoked -> 401', reuse.status === 401);
    refreshA = r.json.refresh_token;
  }
  {
    const bad = await req('POST', '/api/auth/refresh', { body: { refresh_token: 'nope-not-real' } });
    ok('invalid refresh -> 401', bad.status === 401);
    const noBody = await req('POST', '/api/auth/refresh', { body: {} });
    ok('refresh missing token -> 400', noBody.status === 400);
  }

  console.log('\n== 10.6 Login lockout ==');
  {
    const email = `lock${Date.now()}@t.kr`;
    await req('POST', '/api/auth/register', { body: { email, password: 'password1', name: 'Lock', ...consent } });
    let statuses = [];
    for (let i = 0; i < 6; i++) {
      const r = await req('POST', '/api/auth/login', { body: { email, password: 'WRONG' } });
      statuses.push(r.status);
    }
    ok('lockout triggers 423 after 5 fails', statuses.includes(423), `statuses=${statuses.join(',')}`);
  }

  console.log('\n== 10.7 Data export ==');
  {
    const r = await fetch(`${BASE}/api/auth/export`, { headers: { Authorization: `Bearer ${tokenA}` } });
    ok('export 200', r.status === 200);
    const body = await r.text();
    const parsed = JSON.parse(body);
    ok('export has user', !!parsed.user?.email);
    ok('export has greenhouses', Array.isArray(parsed.greenhouses));
    ok('export has consents', Array.isArray(parsed.consents));
  }

  console.log('\n== 10.8 Journal ==');
  {
    const add = await req('POST', `/api/journal/greenhouse/${ghA.id}`, { token: tokenA, body: { date: '2026-04-20', category: '관찰', title: '잎 상태 확인', body: '건강함' } });
    ok('journal add', add.status === 200 && add.json.id);
    const list = await req('GET', `/api/journal/greenhouse/${ghA.id}`, { token: tokenA });
    ok('journal list has entry', list.status === 200 && list.json.length >= 1);
    const noDate = await req('POST', `/api/journal/greenhouse/${ghA.id}`, { token: tokenA, body: { title: 'x' } });
    ok('journal missing date -> 400', noDate.status === 400);
    const otherUser = await req('GET', `/api/journal/greenhouse/${ghA.id}`, { token: tokenB });
    ok("B can't see A's journal", otherUser.status === 404);
  }

  console.log('\n== 10.9 Members sharing ==');
  {
    const members = await req('GET', `/api/members/greenhouse/${ghA.id}`, { token: tokenA });
    ok('member list includes owner', members.status === 200 && members.json[0].role === 'owner');
    const emailB = members.json[0].email; // A 자기 자신
    // B 에게 초대
    const regB = await req('GET', '/api/auth/me', { token: tokenB });
    const invite = await req('POST', `/api/members/greenhouse/${ghA.id}/invite`, { token: tokenA, body: { email: regB.json.user.email, role: 'member' } });
    ok('invite member ok', invite.status === 200);
    const dup = await req('POST', `/api/members/greenhouse/${ghA.id}/invite`, { token: tokenA, body: { email: regB.json.user.email, role: 'member' } });
    ok('duplicate invite -> 409', dup.status === 409);
    const bNow = await req('GET', `/api/journal/greenhouse/${ghA.id}`, { token: tokenB });
    ok('B can now access shared greenhouse journal', bNow.status === 200);
    const bCantInvite = await req('POST', `/api/members/greenhouse/${ghA.id}/invite`, { token: tokenB, body: { email: 'x@y.kr', role: 'member' } });
    ok('member cannot invite (only owner)', bCantInvite.status === 403);
  }

  console.log('\n== 10.10 Schedules ==');
  {
    const add = await req('POST', `/api/schedules/greenhouse/${ghA.id}`, { token: tokenA, body: { name: '아침관수', cron_expr: '0 6 * * *', action: 'irrigate', duration_sec: 120 } });
    ok('schedule add', add.status === 200 && add.json.id);
    const list = await req('GET', `/api/schedules/greenhouse/${ghA.id}`, { token: tokenA });
    ok('schedule list', list.json.length === 1);
    const bad = await req('POST', `/api/schedules/greenhouse/${ghA.id}`, { token: tokenA, body: { name: 'bad', cron_expr: 'not-cron', action: 'irrigate' } });
    ok('invalid cron -> 400', bad.status === 400);
    const badAction = await req('POST', `/api/schedules/greenhouse/${ghA.id}`, { token: tokenA, body: { name: 'x', cron_expr: '* * * * *', action: 'nuke' } });
    ok('invalid action -> 400', badAction.status === 400);
    const del = await req('DELETE', `/api/schedules/${add.json.id}`, { token: tokenA });
    ok('schedule delete', del.status === 200);
  }

  console.log('\n== 10.11 Energy ==');
  {
    const ing = await req('POST', '/api/energy/ingest', { body: { device_key: deviceA.device_key, power_w: 1500, energy_kwh: 2.5, source: 'heater' } });
    ok('energy ingest', ing.status === 200);
    const sum = await req('GET', `/api/energy/greenhouse/${ghA.id}/summary`, { token: tokenA });
    ok('energy summary', sum.status === 200 && sum.json.total_kwh >= 2.5);
    ok('energy cost estimated', sum.json.estimated_cost_krw > 0);
  }

  console.log('\n== 10.12 Health deep ==');
  {
    const r = await req('GET', '/api/health/deep');
    ok('health deep 200', r.status === 200);
    ok('health has integrations', r.json.integrations && typeof r.json.integrations.email === 'string');
    ok('health has uptime', Number.isFinite(r.json.uptime_sec));
  }

  console.log('\n== 10.13 Security headers ==');
  {
    const r = await fetch(`${BASE}/api/health`);
    ok('X-Content-Type-Options header', r.headers.get('x-content-type-options') === 'nosniff');
    ok('X-Frame-Options header', !!r.headers.get('x-frame-options'));
    ok('X-Request-Id header', !!r.headers.get('x-request-id'));
    ok('Strict-Transport-Security header', !!r.headers.get('strict-transport-security'));
  }

  console.log('\n== 10.14 3-day weather ==');
  {
    const r = await req('GET', `/api/weather/greenhouse/${ghA.id}/3day`, { token: tokenA });
    ok('3day weather 200', r.status === 200);
    ok('3day has days array', Array.isArray(r.json.days));
  }

  console.log('\n== 11. Password 변경/재설정 ==');
  let userC, tokenC;
  {
    const r = await req('POST', '/api/auth/register', { body: { email: `c${Date.now()}@t.kr`, password: 'oldpass123', name: '테스트C', ...consent } });
    userC = r.json.user; tokenC = r.json.token;
    ok('C register', r.status === 200);

    const wrong = await req('POST', '/api/auth/change-password', { token: tokenC, body: { current_password: 'WRONG', new_password: 'newpass123' } });
    ok('change-password wrong current -> 401', wrong.status === 401);

    const changed = await req('POST', '/api/auth/change-password', { token: tokenC, body: { current_password: 'oldpass123', new_password: 'newpass123' } });
    ok('change-password ok', changed.status === 200);

    const oldLogin = await req('POST', '/api/auth/login', { body: { email: userC.email, password: 'oldpass123' } });
    ok('old password no longer works', oldLogin.status === 401);

    const newLogin = await req('POST', '/api/auth/login', { body: { email: userC.email, password: 'newpass123' } });
    ok('new password works', newLogin.status === 200);
    tokenC = newLogin.json.token;
  }
  {
    const r = await req('POST', '/api/auth/request-reset', { body: { email: userC.email } });
    ok('request-reset ok', r.status === 200 && r.json.reset_url);
    const token = r.json.reset_url.split('token=')[1];
    ok('reset token issued', token && token.length >= 20);

    const bad = await req('POST', '/api/auth/reset-password', { body: { token: 'fake-token-abc', new_password: 'whatever12' } });
    ok('invalid reset token -> 400', bad.status === 400);

    const done = await req('POST', '/api/auth/reset-password', { body: { token, new_password: 'resetpass1' } });
    ok('reset-password ok', done.status === 200);

    const reused = await req('POST', '/api/auth/reset-password', { body: { token, new_password: 'another' } });
    ok('reused token -> 400', reused.status === 400);

    const login = await req('POST', '/api/auth/login', { body: { email: userC.email, password: 'resetpass1' } });
    ok('login with reset password', login.status === 200);
  }
  {
    const r = await req('POST', '/api/auth/request-reset', { body: { email: 'nonexistent@t.kr' } });
    ok('request-reset for unknown email -> 200 (no enumeration)', r.status === 200 && !r.json.reset_url);
  }

  console.log('\n== 12. Zod 입력 검증 ==');
  {
    const short = await req('POST', '/api/auth/register', { body: { email: 'x@t.kr', password: 'short', name: 'x' } });
    ok('register short password -> 400', short.status === 400);
    const badEmail = await req('POST', '/api/auth/register', { body: { email: 'not-email', password: 'longenough', name: 'x' } });
    ok('register bad email -> 400', badEmail.status === 400);
    const badIngest = await req('POST', '/api/readings/ingest', { body: { device_key: 'short', temperature: 'abc' } });
    ok('ingest non-numeric temperature -> 400', badIngest.status === 400);
    const badGh = await req('POST', '/api/greenhouses', { token: tokenA, body: { name: 'x', planted_at: '2026/01/01' } });
    ok('greenhouse bad date format -> 400', badGh.status === 400);
  }

  console.log('\n== 13. Push API ==');
  {
    const r = await req('GET', '/api/push/public-key');
    ok('public VAPID key exposed', r.status === 200 && typeof r.json.publicKey === 'string' && r.json.publicKey.length > 50);
    const sub = await req('POST', '/api/push/subscribe', { token: tokenA, body: { endpoint: 'https://fcm.googleapis.com/fcm/send/test-endpoint-' + Date.now(), keys: { p256dh: 'BFakeKey1234567890', auth: 'authauthauthauth' } } });
    ok('push subscribe', sub.status === 200 && sub.json.ok);
    const dup = await req('POST', '/api/push/subscribe', { token: tokenA, body: { endpoint: 'https://fcm.googleapis.com/fcm/send/dup-fixed', keys: { p256dh: 'BFakeKey', auth: 'aaa' } } });
    const dup2 = await req('POST', '/api/push/subscribe', { token: tokenA, body: { endpoint: 'https://fcm.googleapis.com/fcm/send/dup-fixed', keys: { p256dh: 'BNewKey', auth: 'bbb' } } });
    ok('push subscribe dedup (upsert)', dup.status === 200 && dup2.status === 200);
    const badSub = await req('POST', '/api/push/subscribe', { token: tokenA, body: { endpoint: 'not-a-url', keys: {} } });
    ok('push subscribe invalid body -> 400', badSub.status === 400);
    const noAuth = await req('POST', '/api/push/subscribe', { body: { endpoint: 'https://x', keys: { p256dh: 'a', auth: 'b' } } });
    ok('push subscribe requires auth', noAuth.status === 401);
  }

  console.log('\n== 13.5 Weather API ==');
  {
    const r = await req('GET', `/api/weather/greenhouse/${ghA.id}`, { token: tokenA });
    ok('weather endpoint 200', r.status === 200);
    ok('weather has grid nx/ny', r.json?.grid?.nx && r.json?.grid?.ny, `grid=${JSON.stringify(r.json?.grid)}`);
    ok('weather mode (degraded|live|error)', ['degraded', 'live', 'error'].includes(r.json.mode));
    const noAuth = await req('GET', `/api/weather/greenhouse/${ghA.id}`);
    ok('weather requires auth', noAuth.status === 401);
  }

  console.log('\n== 13.6 Diagnose API ==');
  {
    // 1x1 투명 PNG
    const tinyPng = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
    const r = await req('POST', `/api/diagnose/greenhouse/${ghA.id}`, { token: tokenA, body: { image_base64: tinyPng, mime: 'image/png' } });
    ok('diagnose returns 200', r.status === 200, `status=${r.status}`);
    ok('diagnose has disease field', typeof r.json.disease === 'string');
    ok('diagnose persists id', Number.isFinite(r.json.id));
    const hist = await req('GET', `/api/diagnose/greenhouse/${ghA.id}`, { token: tokenA });
    ok('diagnose history shows entry', hist.status === 200 && hist.json.length >= 1);
    const bad = await req('POST', `/api/diagnose/greenhouse/${ghA.id}`, { token: tokenA, body: {} });
    ok('diagnose missing image -> 400', bad.status === 400);
    const unauth = await req('POST', `/api/diagnose/greenhouse/${ghA.id}`, { token: tokenB, body: { image_base64: tinyPng } });
    ok("B can't diagnose A's greenhouse", unauth.status === 404);
  }

  console.log('\n== 13.7 Billing API ==');
  {
    const plans = await req('GET', '/api/billing/plans');
    ok('plans endpoint 200', plans.status === 200);
    ok('plans has free/basic/pro', plans.json.plans.length === 3);
    ok('plans exposes mode', ['live', 'degraded'].includes(plans.json.mode));

    const sub = await req('GET', '/api/billing/subscription', { token: tokenA });
    ok('subscription endpoint 200', sub.status === 200);
    ok('default plan is free', sub.json.subscription.plan === 'free');
    ok('invoices array', Array.isArray(sub.json.invoices));

    const bad = await req('POST', '/api/billing/subscribe', { token: tokenA, body: { plan: 'free' } });
    ok('subscribe to free -> 400', bad.status === 400);
    const bad2 = await req('POST', '/api/billing/subscribe', { token: tokenA, body: { plan: 'basic', auth_key: 'x', customer_key: 'y' } });
    ok('subscribe without TOSS -> 400/502', [400, 502].includes(bad2.status));

    const cancel = await req('POST', '/api/billing/cancel', { token: tokenA });
    ok('cancel on free -> already_free', cancel.status === 200 && cancel.json.already_free);
  }

  console.log('\n== 14. Account delete ==');  // rate-limit 테스트 전에 실행 (429 간섭 방지)
  {
    const del = await req('POST', '/api/auth/delete-account', { token: tokenC });
    ok('delete account ok', del.status === 200);
    const check = await req('POST', '/api/auth/login', { body: { email: userC.email, password: 'resetpass1' } });
    ok('deleted account cannot login', check.status === 401, `got ${check.status}`);
    const meAfter = await req('GET', '/api/auth/me', { token: tokenC });
    ok('deleted user token no longer valid', meAfter.status === 401);
  }

  console.log('\n== 15. Rate limit ==');
  {
    // 15분 윈도우 20회 한도 초과 트리거 (이 뒤의 login은 모두 429)
    let blocked = false;
    for (let i = 0; i < 25; i++) {
      const r = await req('POST', '/api/auth/login', { body: { email: 'ratelimit@t.kr', password: 'wrong' } });
      if (r.status === 429) { blocked = true; break; }
    }
    ok('auth rate limit fires 429', blocked);
  }

  console.log(`\n================\n  PASS: ${pass}   FAIL: ${fail}`);
  if (fail) {
    console.log('실패:'); fails.forEach((f) => console.log('  - ' + f));
    process.exit(1);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
