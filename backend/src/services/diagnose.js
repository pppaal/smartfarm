// Claude API 기반 딸기 병해 진단
// 이미지 (base64) → Claude Opus 4.7 vision → 구조화된 진단
//
// ENV: ANTHROPIC_API_KEY
// 미설정 시 degraded 응답 (규칙 기반 플레이스홀더)

const MODEL = process.env.CLAUDE_MODEL || 'claude-opus-4-7';

const SYSTEM_PROMPT = `당신은 한국 딸기 재배 전문가입니다. 사용자가 올린 딸기 잎·과실·줄기 사진을 보고 병해충 진단을 내려주세요.

가능한 병명 예시 (딸기):
- 탄저병 (Colletotrichum)
- 잿빛곰팡이병 (Botrytis cinerea)
- 흰가루병 (Powdery mildew)
- 시들음병 (Fusarium wilt)
- 역병 (Phytophthora)
- 점박이응애 (Two-spotted spider mite)
- 진딧물, 총채벌레
- 영양결핍 (질소/칼슘/철)
- 정상

반드시 아래 JSON 스키마로만 응답하세요 (다른 문자 금지):
{
  "disease": "병명 또는 '정상'",
  "severity": "없음|경미|보통|심각",
  "confidence": 0.0~1.0,
  "symptoms": "관찰된 증상 서술 (1-2문장)",
  "recommendation": "권장 조치 (3줄 이내, 한국 농가 현실 반영: 방제약제·생물학적방제·환경관리)",
  "urgency_hours": "조치까지 권장 시간 (숫자, 없으면 168)"
}`;

export async function diagnoseImage({ base64, mime }) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return {
      mode: 'degraded',
      disease: '진단 불가',
      severity: '없음',
      confidence: 0,
      recommendation: 'ANTHROPIC_API_KEY 가 설정되어 있지 않습니다. 관리자에게 문의하세요.',
      raw: null,
    };
  }

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: mime, data: base64 } },
              { type: 'text', text: '이 딸기 사진을 진단해주세요. JSON 으로만 응답.' },
            ],
          },
        ],
      }),
      signal: AbortSignal.timeout(60_000),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Claude API ${res.status}: ${err.slice(0, 200)}`);
    }
    const data = await res.json();
    const text = data?.content?.[0]?.text || '';
    let parsed;
    try {
      const jsonStart = text.indexOf('{');
      const jsonEnd = text.lastIndexOf('}');
      parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1));
    } catch {
      parsed = { disease: '파싱 실패', severity: '없음', confidence: 0, recommendation: text.slice(0, 300), raw: text };
    }
    return { mode: 'live', ...parsed, raw: text };
  } catch (e) {
    return { mode: 'error', disease: '진단 실패', severity: '없음', confidence: 0, recommendation: e.message, raw: null };
  }
}
