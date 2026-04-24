import nodemailer from 'nodemailer';

const {
  SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE,
  FROM_EMAIL = 'noreply@smartfarm.kr',
  FROM_NAME = '🍓 스마트팜',
  PUBLIC_URL = 'http://localhost:5173',
} = process.env;

let transporter = null;
let mode = 'console';

if (SMTP_HOST && SMTP_USER) {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT || 587),
    secure: SMTP_SECURE === 'true',
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  mode = 'smtp';
  console.log(`[email] SMTP 모드 (${SMTP_HOST})`);
} else {
  console.log('[email] 콘솔 모드 (SMTP 미설정) — 메일은 서버 로그로 출력됩니다');
}

export async function sendMail({ to, subject, html, text }) {
  const msg = {
    from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
    to, subject, html, text: text || html?.replace(/<[^>]+>/g, ''),
  };
  if (mode === 'smtp') {
    try {
      const info = await transporter.sendMail(msg);
      return { ok: true, messageId: info.messageId };
    } catch (e) {
      console.error('[email] send failed', e.message);
      return { ok: false, error: e.message };
    }
  }
  console.log('\n───── [email:console] ─────');
  console.log(`To:   ${to}`);
  console.log(`Subj: ${subject}`);
  console.log(text || html);
  console.log('───────────────────────────\n');
  return { ok: true, mode: 'console' };
}

export const emailMode = () => mode;

export function emailResetLink({ email, name, resetUrl }) {
  return sendMail({
    to: email,
    subject: '[스마트팜] 비밀번호 재설정 안내',
    html: `
      <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto;">
        <h2 style="color: #2d6cdf;">🍓 비밀번호 재설정</h2>
        <p>${name || '회원'}님, 안녕하세요.</p>
        <p>아래 버튼을 클릭하여 비밀번호를 재설정해주세요. 이 링크는 <b>1시간 동안만 유효</b>합니다.</p>
        <p style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" style="background: #2d6cdf; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none;">비밀번호 재설정</a>
        </p>
        <p style="color: #888; font-size: 13px;">직접 요청하지 않으셨다면 이 메일을 무시하세요.</p>
      </div>`,
  });
}

export function emailAlertDigest({ email, alerts, greenhouseName }) {
  if (!alerts.length) return Promise.resolve({ ok: true, skipped: true });
  const rows = alerts.map((a) => `<li><b>${a.level}</b> · ${a.message} <span style="color:#888;font-size:12px">(${a.ts})</span></li>`).join('');
  return sendMail({
    to: email,
    subject: `[스마트팜] ${greenhouseName} 알림 ${alerts.length}건`,
    html: `<div style="font-family:sans-serif;max-width:520px;margin:0 auto">
      <h2>🍓 ${greenhouseName}</h2>
      <ul>${rows}</ul>
      <p><a href="${PUBLIC_URL}/alerts">알림 확인하기</a></p></div>`,
  });
}
