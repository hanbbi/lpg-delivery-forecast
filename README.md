# AI 기반 LPG 배송 예측 시스템

기온 데이터를 활용한 LPG 탱크 충전 주기 예측 프로토타입

> 참고: data/ 안의 거래처·이력·기온 파일은 실제 데이터가 아니라 스키마만 같은 합성 샘플입니다. scripts/generate_sample_data.py로 다시 만들 수 있고, 학습된 모델(*.pkl)은 저장소에 넣지 않았습니다.


## 개요

본 시스템은 거래처별 LPG 충전 이력과 기온 데이터를 분석하여 다음 충전 시점을 예측합니다. Gradient Boosting 기반 ML 모델과 규칙 기반 예측을 하이브리드로 적용하여 안정적인 예측 서비스를 제공합니다.

### 주요 기능

- 거래처별 충전 패턴 분석
- 기온 데이터 기반 충전 주기 예측
- 충전 이력 시각화
- 날짜 범위 선택 분석

## 기술 스택

| 구분 | 기술 |
|------|------|
| Frontend | Next.js 16 + TypeScript + React |
| Styling | Tailwind CSS |
| Charts | Recharts |
| ML Server | Python + Flask |
| ML Library | scikit-learn (GradientBoostingRegressor) |
| Data | JSON 파일 기반 |

## 프로젝트 구조

```
lpg-delivery-forecast/
├── src/
│   ├── app/
│   │   ├── api/                    # API Routes
│   │   │   ├── customers/          # 거래처 API
│   │   │   ├── history/            # 이력 API
│   │   │   ├── weather/            # 날씨 API
│   │   │   ├── analysis/           # 분석 API
│   │   │   └── predict/            # 예측 API
│   │   └── page.tsx                # 메인 대시보드
│   ├── components/
│   │   ├── CustomerSelect.tsx      # 거래처 선택
│   │   ├── PredictionCard.tsx      # 예측 결과 카드
│   │   ├── AnalysisChart.tsx       # 분석 차트
│   │   └── HistoryChart.tsx        # 이력 차트
│   ├── lib/
│   │   ├── data.ts                 # 데이터 로더
│   │   └── utils.ts                # 유틸리티 함수
│   └── types/
│       └── index.ts                # TypeScript 타입
├── python/
│   ├── ml_server_weather.py        # ML 서버 (Port 5001)
│   ├── train_model_weather.py      # 모델 학습
│   ├── training_data_by_device_weather.py  # 학습 데이터 생성
│   └── models/                     # 학습된 모델 파일
├── data/
│   ├── customers.json              # 거래처 데이터
│   ├── history.json                # 충전 이력 데이터
│   └── weather.json                # 기온 데이터
└── REPORT.md                       # 프로토타입 검증 보고서
```

## 설치 및 실행

### 1. 의존성 설치

```bash
# Node.js 패키지
npm install

# Python 패키지
pip install flask flask-cors scikit-learn pandas numpy
```

### 2. 샘플 데이터 생성

```bash
python scripts/generate_sample_data.py
```

### 3. ML 모델 학습

```bash
cd python

# 학습 데이터 생성
python training_data_by_device_weather.py

# 모델 학습
python train_model_weather.py
```

### 4. 서버 실행

```bash
# ML 서버 실행 (터미널 1)
cd python
python ml_server_weather.py

# Next.js 앱 실행 (터미널 2)
npm run dev
```

### 5. 접속

- **Web UI**: http://localhost:3000
- **ML Server**: http://localhost:5001

## API 엔드포인트

| 엔드포인트 | 메서드 | 설명 |
|------------|--------|------|
| `/api/customers` | GET | 거래처 목록 조회 |
| `/api/customers?device_id=xxx` | GET | 거래처 상세 조회 |
| `/api/history?device_id=xxx&startDate=&endDate=` | GET | 충전 이력 조회 |
| `/api/weather?sigungu_id=xxx` | GET | 기온 데이터 조회 |
| `/api/weather/regions` | GET | 기온 측정 지역 목록 |
| `/api/analysis?device_id=xxx&startDate=&endDate=` | GET | 충전 패턴 분석 |
| `/api/predict` | POST | 충전 예측 요청 |

### 예측 API 요청 예시

```bash
curl -X POST http://localhost:3000/api/predict \
  -H "Content-Type: application/json" \
  -d '{"device_id": "sample-dev-001"}'
```

### 응답 예시

```json
{
  "days_until_charge": 8.5,
  "confidence": 0.90,
  "model_type": "ML_WEATHER",
  "suggestion": "약 8일 후 충전 예정",
  "customer": {
    "device_id": "sample-dev-001",
    "cust_nm": "거래처명"
  },
  "analysisData": {
    "currentRemain": 45.2,
    "daysSinceCharge": 12,
    "avgInterval": 21.5,
    "totalCharges": 25,
    "nearestRegion": "7",
    "regionDistance": 5.2
  }
}
```

## 예측 모델

### 사용 모델

**Gradient Boosting Regressor** - 앙상블(부스팅) 기반 회귀 모델

### 입력 특성 (13개)

| 특성 | 설명 |
|------|------|
| current_remain | 현재 잔량 (%) |
| days_since_charge | 마지막 충전 후 경과일 |
| avg_interval | 평균 충전 주기 (일) |
| std_interval | 충전 주기 표준편차 |
| avg_remain | 평균 충전 시작 잔량 (%) |
| min_remain | 최소 잔량 기록 (%) |
| total_charges | 총 충전 횟수 |
| avg_temp | 평균 기온 (°C) |
| max_temp | 최고 기온 (°C) |
| min_temp | 최저 기온 (°C) |
| season | 계절 (1:봄, 2:여름, 3:가을, 4:겨울) |
| region_encoded | 지역 코드 |
| device_encoded | 거래처 코드 |

### 예측 조건

- **ML 예측**: 충전 횟수 20회 이상
- **규칙 기반**: 충전 횟수 20회 미만 (평균 주기 기반)

## 지역 코드

| 코드 | 지역 | 코드 | 지역 |
|------|------|------|------|
| 1 | 서울 | 10 | 세종 |
| 2 | 인천 | 11 | 부산 |
| 3 | 충북 | 12 | 대전 |
| 4 | 충남 | 13 | 대구 |
| 5 | 경북 | 14 | 광주 |
| 6 | 경남 | 15 | 울산 |
| 7 | 경기 | 16 | 전북 |
| 8 | 강원 | 17 | 전남 |
| 9 | 제주 | | |

## 환경 변수

`.env.local` 파일 생성:

```env
# ML 서버 URL
ML_SERVER_URL=http://localhost:5001

# MySQL (향후 연동 시)
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=lpg_ai
```

## 스크립트

```bash
# 개발 서버
npm run dev

# 프로덕션 빌드
npm run build

# 프로덕션 실행
npm start

# 린트 검사
npm run lint
```

## 관련 문서

- [프로토타입 검증 보고서](./REPORT.md)

## 라이선스

포트폴리오/데모용 프로젝트입니다. 저장소에 포함된 데이터는 모두 가상(합성) 샘플입니다.
