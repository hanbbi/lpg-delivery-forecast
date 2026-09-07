# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI 기반 LPG 배송 예측 시스템 프로토타입. 기온 데이터를 포함한 ML 모델로 LPG 탱크 충전 주기를 예측합니다.

## Tech Stack

- **Frontend/Backend**: Next.js 16 + TypeScript + React + Tailwind CSS
- **Database**: MySQL
- **ML Server**: Python + Flask + scikit-learn
- **Charts**: Recharts

## Project Structure

```
├── src/
│   ├── app/
│   │   ├── api/              # API Routes
│   │   │   ├── customers/    # 거래처 API
│   │   │   ├── history/      # 이력 API
│   │   │   ├── weather/      # 날씨 API
│   │   │   ├── analysis/     # 분석 API
│   │   │   └── predict/      # 예측 API (ML 서버 호출)
│   │   └── page.tsx          # 메인 대시보드
│   ├── components/           # React 컴포넌트
│   ├── lib/                  # DB 연결, 유틸리티
│   └── types/                # TypeScript 타입
├── python/
│   ├── ml_server_weather.py  # ML 서버 (Flask, Port 5001)
│   ├── train_model_weather.py # 모델 학습 스크립트
│   ├── training_data_by_device_weather.py # 학습 데이터 생성
│   └── models/               # 학습된 모델 파일들
└── sql/
    └── schema.sql            # DB 스키마
```

## Commands

```bash
# Next.js 개발 서버
npm run dev

# 빌드
npm run build

# ML 서버 실행
cd python && python ml_server_weather.py

# 모델 학습
cd python && python train_model_weather.py
```

## Database Schema

- **customers**: 거래처 (device_id, cust_id, cust_nm, latitude, longitude)
- **history**: 이력 (device_id, remain1_percent, tran_dttm, isCharge)
- **weather**: 날씨 (sigungu_id 1~15, weather_dt, avg_temp, max_temp, min_temp)

## Key APIs

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/customers` | GET | 거래처 목록/상세 |
| `/api/history?device_id=&startDate=&endDate=` | GET | 이력 조회 |
| `/api/weather?sigungu_id=` | GET | 날씨 데이터 |
| `/api/analysis?device_id=&startDate=&endDate=` | GET | 거래처 분석 |
| `/api/predict` | POST | ML 예측 요청 |

## Environment Variables (.env.local)

```
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=lpg_ai
ML_SERVER_URL=http://localhost:5001
```
