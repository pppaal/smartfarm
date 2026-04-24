// 카카오 알림톡 발송 (솔라피·알리고·카카오i 커넥트 중 하나)
// 기본 구현: Solapi (https://solapi.com) — 가장 대중적인 국내 대행사
//
// ENV:
//   KAKAO_ALIMTALK_API_KEY       Solapi API key
//   KAKAO_ALIMTALK_API_SECRET    Solapi API secret
//   KAKAO_PFID                   카카오 비즈메시지 플러스친구 ID
//   KAKAO_TEMPLATE_ALERT         알림 템플릿 ID (등록 후 부여받음)
//
// 미설정 시 console 모드.

import crypto from 'crypto';

const API_BASE = 'https://api.solapi.com';

function enabled() {
  return !!(process.env.KAKAO_ALIMTALK_API_KEY && process.env.KAKAO_ALIMTALK_API_SECRET && process.env.KAKAO_PFID);
}

function buildAuth() {
  const apiKey = process.env.KAKAO_ALIMTALK_API_KEY;
  const apiSecret = process.env.KAKAO_ALIMTALK_API_SECRET;
  const date = new Date().toISOString();
  const salt = crypto.randomBytes(16).toString('hex');
  const signature = crypto.createHmac('sha256', apiSecret).update(date + salt).digest('hex');
  return `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`;
}

export async function sendAlimTalk({ to, templateId, variables = {}, text = '' }) {
  if (!enabled()) {
    console.log(`\n[kakao:console] to=${to} template=${templateId}\n${text}\nvars=${JSON.stringify(variables)}\n`);
    return { ok: true, mode: 'console' };
  }
  try {
    const res = await fetch(`${API_BASE}/messages/v4/send-many/detail`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: buildAuth() },
      body: JSON.stringify({
        messages: [{
          to,
          from: process.env.KAKAO_FROM_PHONE || '',
          type: 'ATA',
          kakaoOptions: {
            pfId: process.env.KAKAO_PFID,
            templateId,
            variables,
            disableSms: true,
          },
          text,
        }],
      }),
    });
    const json = await res.json();
    if (!res.ok) return { ok: false, error: json };
    return { ok: true, result: json };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

export function kakaoMode() {
  return enabled() ? 'live' : 'console';
}

// 크리티컬 알림 → 알림톡 자동 발송 (user_phone 이 등록된 경우만)
export async function alimTalkForAlert({ message, level, greenhouseName, userPhone }) {
  if (!userPhone || level === 'info') return;
  const templateId = process.env.KAKAO_TEMPLATE_ALERT;
  if (!templateId) return; // 템플릿 등록 필요
  return sendAlimTalk({
    to: userPhone.replace(/[^0-9]/g, ''),
    templateId,
    variables: { '#{하우스}': greenhouseName, '#{내용}': message, '#{등급}': level },
    text: `[스마트팜 ${level}] ${greenhouseName} - ${message}`,
  });
}
