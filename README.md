# 🍓 스마트팜 딸기하우스 — MVP 완성본

충청도 기반 딸기(설향) 스마트팜 전용 통합 시스템. 회원가입부터 현장 배포까지 바로 쓸 수 있는 완성형 MVP.

## 왜 딸기인가
- 한국 스마트팜 도입률·수익성 1위 작목 (평당 연매출 30~50만원, 일반 노지 대비 2~3배)
- 고정 판매처(공판장/직거래) 확보 용이, 단가 안정적
- 환경제어 민감도가 높아 자동화 효과가 체감 큼 (야간 저온, 토양수분 관리 핵심)
- 정부 ICT 융복합 확산사업 시설비 50~60% 보조 가능

## MVP 포함 기능

| 영역 | 기능 |
|---|---|
| **계정** | 회원가입, 로그인(JWT), 로그아웃 |
| **온보딩** | 첫 하우스 등록 → 기본 딸기 룰 자동 시드 → 디바이스 자동 생성 |
| **대시보드** | 5종 센서 실시간 카드 + 12시간 차트 (WebSocket 실시간 갱신) |
| **자동제어** | 룰 기반 엔진 (조건→동작), 쿨다운 보호, 딸기 권장 프리셋 4종 |
| **수확예측** | GDD(base 5℃) 적산 기반 → 개화기·수확기 ETA + 진행률 |
| **수확기록** | 날짜·무게·등급·메모 등록 |
| **매출관리** | 판매등록(공판장/직거래/온라인) + 월별 차트 + 누적 통계 + **CSV 내보내기** |
| **알림** | 룰 발동·이상치·**디바이스 오프라인 자동 감지** + 확인처리 |
| **설정** | 하우스 정보 수정, 디바이스 추가/삭제, **Device Key 복사**, 온라인 상태 |
| **PWA** | 홈화면 설치 가능, 오프라인 기본 캐시 |

## 구성

```
smartfarm/
├── backend/      Node.js + Express + SQLite + WebSocket API
├── frontend/     React + Vite 대시보드 + PWA
├── firmware/     ESP32 Arduino 펌웨어
├── simulator/    Python 센서 시뮬레이터
├── docker-compose.yml
└── docs/         수익성분석.md
```

## 바로 실행하기 (로컬 개발, 5분)

**필요:** Node.js 20+, Python 3.10+

```bash
# 1) 백엔드
cd backend
cp .env.example .env
npm install
npm start                    # → http://localhost:4000

# 2) 프론트엔드 (새 터미널)
cd frontend
npm install
npm run dev                  # → http://localhost:5173

# 3) 시뮬레이터 (새 터미널, 선택)
cd simulator
pip install -r requirements.txt
python simulate.py --device demo-device-key-0001 --interval 3
```

브라우저 → `http://localhost:5173`
- 데모 계정: **demo@smartfarm.kr / demo1234**
- 또는 `/register` 에서 신규 가입 → 온보딩 마법사로 하우스 등록

## 운영 배포 (Docker, 권장)

```bash
# 1) 시크릿 생성
export JWT_SECRET=$(openssl rand -hex 32)

# 2) 올리기
docker compose up -d --build
```

- 프론트엔드: `http://서버:8080`
- API: `http://서버:4000` (프론트가 `/api` 경유 프록시)
- 매일 자동 DB 백업 → `./backups/smartfarm-YYYYMMDD-HHMM.db` (최근 14개 유지)

**HTTPS (권장):** Caddy/Nginx 리버스프록시 앞에 세우기. 예:
```
smartfarm.example.com {
  reverse_proxy localhost:8080
}
```

## 실제 하우스에 적용하기

### 1단계: 하드웨어 (1동 기준 약 15~25만원)
| 부품 | 모델 | 가격 |
|---|---|---|
| ESP32 DevKit | WROOM-32 | 8,000원 |
| DHT22 온습도 | - | 5,000원 |
| 정전식 토양수분 | v1.2 | 4,000원 × 센서수 |
| MH-Z19B CO2 | - | 35,000원 |
| BH1750 조도 | - | 3,000원 |
| 12V 솔레노이드 밸브 | 1/2" | 15,000원 |
| 5V 릴레이 모듈 | 4채널 | 5,000원 |
| 방수함 + 전원 | 5V 어댑터 | 15,000원 |

### 2단계: 디바이스 등록 (웹에서)
1. 웹 로그인 → **설정** → 디바이스 섹션
2. 디바이스 이름 입력 후 "추가"
3. 생성된 **Device Key** 복사

### 3단계: ESP32 업로드
[firmware/smartfarm_esp32.ino](firmware/smartfarm_esp32.ino) 상단 상수 수정:
```c
const char* WIFI_SSID   = "...";
const char* WIFI_PASS   = "...";
const char* API_URL     = "http://서버IP:4000/api/readings/ingest";
const char* DEVICE_KEY  = "설정에서 복사한 키";
```
Arduino IDE로 업로드 → 10초 뒤부터 대시보드에 값 뜸.

### 4단계: 센서 캘리브레이션
토양수분 센서는 개체차가 큼. `readSoilMoisturePct()` 안의 건조/포화 ADC 값을 현장 측정값으로 조정.

## API 요약

| Method | Path | 용도 |
|---|---|---|
| POST | `/api/auth/register`, `/api/auth/login` | 계정 |
| GET | `/api/auth/me` | 현재 사용자 |
| GET/POST/PATCH | `/api/greenhouses`, `/api/greenhouses/:id` | 하우스 |
| POST/DELETE | `/api/greenhouses/:id/devices`, `/:ghId/devices/:devId` | 디바이스 |
| POST | `/api/readings/ingest` | **센서 데이터 업로드** (device_key 인증) |
| GET | `/api/readings/greenhouse/:id/latest`, `/series?hours=24` | 측정값 조회 |
| GET/POST/PATCH/DELETE | `/api/rules/...` | 자동제어 룰 |
| POST | `/api/rules/greenhouse/:id/seed-defaults` | 딸기 기본 룰 시드 |
| GET | `/api/harvests/greenhouse/:id/forecast` | 수확 예측 |
| GET/POST | `/api/harvests/greenhouse/:id`, `/api/sales/greenhouse/:id` | 수확/판매 |
| GET | `/api/sales/greenhouse/:id/export.csv?token=...` | CSV 내보내기 |
| GET | `/api/sales/greenhouse/:id/summary` | 월별 매출 요약 |
| GET/POST | `/api/alerts/greenhouse/:id`, `/api/alerts/:id/ack` | 알림 |
| WS | `/ws` | 실시간 측정값·제어·디바이스 상태 푸시 |

## 다음 확장 (Phase 2)
1. **FCM 푸시** — 크리티컬 알림을 폰으로
2. **카카오톡 알림톡** — 주간 매출 리포트
3. **이미지 기반 병해 진단** — Claude API (`claude-opus-4-7`) 로 탄저·잿빛곰팡이 진단
4. **전력 모니터링** — PZEM-004T 로 난방 전기료 추적
5. **직거래 쇼핑몰** — 공개 URL 로 품질·재고·예약
6. **기상청 API 연동** — 지역 일기예보 기반 선제 대응

## 라이선스
MIT
