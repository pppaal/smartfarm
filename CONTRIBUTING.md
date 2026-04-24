# 기여 가이드

스마트팜 프로젝트에 기여해주셔서 감사합니다. 아래 규칙을 지켜주세요.

## 개발 환경 준비

```bash
# 저장소 포크 후 클론
git clone https://github.com/<your-fork>/smartfarm
cd smartfarm

# 백엔드
cd backend
cp .env.example .env         # JWT_SECRET 은 openssl rand -hex 32
npm install
npm start                     # http://localhost:4000

# 프론트엔드 (새 터미널)
cd frontend
npm install
npm run dev                   # http://localhost:5173
```

데모 계정: `demo@smartfarm.kr` / `demo1234`

## 개발 흐름

1. 이슈 확인 또는 생성 (중복 방지)
2. `main` 에서 브랜치 분기: `git checkout -b feat/내-기능` 또는 `fix/버그명`
3. 코드 작성 + 테스트 통과 확인
4. 커밋 메시지는 [Conventional Commits](https://www.conventionalcommits.org/) 따라 주세요:
   - `feat:` 새 기능
   - `fix:` 버그 수정
   - `docs:` 문서
   - `refactor:` 리팩토링
   - `test:` 테스트
   - `chore:` 빌드/설정
5. PR 생성 시 PR 템플릿을 채워주세요

## 테스트

```bash
# 백엔드 e2e (143 테스트)
cd backend && npm run test:e2e

# 프론트엔드 빌드
cd frontend && npm run build

# 프론트엔드 브라우저 E2E (Playwright)
cd frontend && npx playwright install && npx playwright test
```

PR 은 CI 통과 후 머지됩니다.

## 코드 스타일

- **ESLint 9 flat config** (backend/eslint.config.js) — warn 레벨 유지
- 들여쓰기: 2 스페이스
- 세미콜론: 필수
- 파일명: kebab-case 대신 lowerCamelCase (backend), PascalCase (React 컴포넌트)
- 함수 주석은 *why* 만 (what 은 코드로 설명)

## 보안 원칙

- 평문 비밀/토큰 절대 커밋 금지 (`.env`, `*.db` 는 `.gitignore`)
- 입력 검증은 zod 스키마 사용
- SQL 은 항상 parameterized (`?` placeholder)
- 보안 취약점은 [private advisory](https://github.com/pppaal/smartfarm/security/advisories/new) 로 신고

## 새 환경변수 추가 시

1. `backend/.env.example` 에 주석과 함께 추가
2. 라이브/degraded 모드 판단 로직 포함
3. README 의 "라이브 모드 활성화 스위치" 섹션 업데이트

## 라이선스

MIT. 기여물은 동일 라이선스 하에 배포됩니다.
