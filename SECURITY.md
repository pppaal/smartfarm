# 보안 정책 (Security Policy)

## 취약점 신고

공개 이슈로 올리지 마세요. 공격자에게 노출됩니다.

**GitHub Private Security Advisory 로 신고:**
👉 https://github.com/pppaal/smartfarm/security/advisories/new

또는 이메일: `security@smartfarm.kr`

## 처리 흐름

1. 48시간 이내 접수 확인
2. 7일 이내 심각도 평가 및 재현
3. 패치 완료 시 보고자와 함께 공개 advisory 발행 (사전 합의 시)
4. 필요 시 CVE 발급

## 지원 버전

| 버전 | 지원 여부 |
|---|---|
| main (HEAD) | ✅ 보안 패치 제공 |
| 구 버전 | ❌ 최신 main 으로 업그레이드 권장 |

## Scope

아래는 **유효한 보안 이슈**입니다:
- 인증 우회 (JWT·세션)
- SQL 인젝션, NoSQL 인젝션, 명령어 인젝션
- XSS (Stored/Reflected/DOM)
- CSRF / SSRF
- 권한 상승 (IDOR, 권한 체크 우회)
- 기밀 정보 노출 (로그·에러메시지·API 응답)
- 암호화 약점 (약한 해시·하드코딩 시크릿)
- DoS (의도적 리소스 고갈)

아래는 **유효하지 않습니다**:
- 자동화 스캐너 결과 (POC 없이)
- 클릭재킹 (로그인 페이지 제외)
- 로그아웃 후 세션 토큰 무효화 (JWT 설계 한계)
- Rate limit 우회 (이미 layer 다수 적용됨을 반드시 확인)

## 알려진 설계 한계

- **JWT 중단 불가**: 로그인 세션은 만료 시까지 유효 (refresh token 은 revoke 가능)
- **SQLite 파일 평문**: 디스크 접근 권한이 있는 공격자 대비 불가 (전체 디스크 암호화 권장)
- **Toss SDK v1 사용**: 추후 v2 로 마이그레이션 예정
- **KMA API key URL 평문 전송**: HTTPS 의존

## 책임 있는 공개

취약점 공개 합의 기간: 기본 90일. 단, 심각한 경우 즉시 패치 후 공개.
