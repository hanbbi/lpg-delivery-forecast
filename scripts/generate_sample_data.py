#!/usr/bin/env python3
"""
가상(합성) 샘플 데이터 생성기.

실제 거래처 데이터를 대체하기 위한 스크립트입니다. 실제 데이터와 '스키마'만 동일할 뿐,
값은 모두 무작위로 생성된 가짜 데이터이므로 공개 저장소에 안전하게 커밋할 수 있습니다.

생성 파일:
  data/customers.json  : 가상 거래처 30곳
  data/weather.json    : 지역별 일별 기온(공개 좌표 기반, 값은 계절 모델로 합성)
  data/history.json    : 거래처별 3시간 간격 잔량 이력 + 충전 이벤트

학습 파이프라인(python/)이 그대로 동작하도록 필드명을 실제와 맞췄습니다:
  - history: device_id, cust_id, remain1, remain1_percent, remain2, tran_dttm, isCharge
  - 충전 인식: isCharge='Y' 이고 잔량이 이전 대비 크게 증가한 시점

사용:
  python scripts/generate_sample_data.py
"""
import json
import os
import random
import math
from datetime import datetime, timedelta

random.seed(20260907)

OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
os.makedirs(OUT_DIR, exist_ok=True)

# 지역(시군구) 대표 좌표 — 공개된 도시 좌표(민감정보 아님)
REGIONS = {
    1: ("서울", 37.5665, 126.9780), 2: ("인천", 37.4563, 126.7052),
    3: ("충북", 36.6424, 127.4890), 4: ("충남", 36.6588, 126.6728),
    5: ("경북", 36.5684, 128.7294), 6: ("경남", 35.2280, 128.6811),
    7: ("경기", 37.2636, 127.0286), 8: ("강원", 37.8813, 127.7300),
    9: ("제주", 33.4996, 126.5312), 10: ("세종", 36.4801, 127.2890),
    11: ("부산", 35.1796, 129.0756), 12: ("대전", 36.3504, 127.3845),
    13: ("대구", 35.8714, 128.6014), 14: ("광주", 35.1595, 126.8526),
    15: ("울산", 35.5384, 129.3114), 16: ("전북", 35.8242, 127.1480),
    17: ("전남", 34.8118, 126.3922),
}

START = datetime(2024, 6, 1)
END = datetime(2025, 8, 15)          # 약 440일
INTERVAL_H = 3                        # 3시간 간격
N_DEVICES = 30


def rand_hex(n):
    return "".join(random.choice("0123456789abcdef") for _ in range(n))


def seasonal_temp(day_of_year, region_id):
    # 여름 고온/겨울 저온 사인 모델 + 지역 오프셋
    base = 13.0 - 12.0 * math.cos(2 * math.pi * (day_of_year - 20) / 365.0)
    offset = (region_id % 5) - 2        # -2 ~ +2
    if region_id in (9, 11, 15, 17):    # 남부/해안은 조금 더 따뜻
        offset += 2
    avg = base + offset + random.uniform(-1.5, 1.5)
    return round(avg, 1)


def gen_customers():
    rows = []
    for i in range(1, N_DEVICES + 1):
        region_id = random.randint(1, 17)
        _, rlat, rlon = REGIONS[region_id]
        rows.append({
            "cust_id": rand_hex(10),
            "cust_nm": f"샘플거래처 {i:02d}",              # 가상 상호명
            "device_id": f"sample-dev-{i:03d}",            # 가상 식별자
            "serial_no": f"SN{random.randint(1000000, 9999999)}",
            "latitude": f"{rlat + random.uniform(-0.2, 0.2):.6f}",
            "longitude": f"{rlon + random.uniform(-0.2, 0.2):.6f}",
            "_region_id": region_id,                        # 내부용(파일엔 남지만 코드에서 무시)
        })
    return rows


def gen_weather():
    rows = []
    for region_id, (_, lat, lon) in REGIONS.items():
        d = START
        while d <= END:
            avg = seasonal_temp(d.timetuple().tm_yday, region_id)
            rows.append({
                "sigungu_id": region_id,
                "latitude": f"{lat}",
                "longitude": f"{lon}",
                "weather_dt": d.strftime("%Y-%m-%d"),
                "avg_temp": avg,
                "max_temp": round(avg + random.uniform(3, 7), 1),
                "min_temp": round(avg - random.uniform(3, 7), 1),
            })
            d += timedelta(days=1)
    return rows


def gen_history(customers, weather):
    # 지역별 일평균 기온 조회용 인덱스
    wmap = {}
    for w in weather:
        wmap[(w["sigungu_id"], w["weather_dt"])] = w["avg_temp"]

    rows = []
    for c in customers:
        device_id = c["device_id"]
        cust_id = c["cust_id"]
        region_id = c["_region_id"]
        base_minute = random.randint(0, 59)

        remain = random.uniform(70, 95)
        refill_threshold = random.uniform(12, 22)
        t = START
        prev_remain = remain
        while t <= END:
            day_key = t.strftime("%Y-%m-%d")
            avg_temp = wmap.get((region_id, day_key), 15.0)

            # 기온이 낮을수록(난방 등) 소비가 커지는 경향
            temp_factor = 1.0 + max(0.0, (15.0 - avg_temp)) * 0.03
            # 3시간당 소비량(대략 하루 5~8% 수준)
            consume = random.uniform(0.5, 1.0) * temp_factor
            remain -= consume

            is_charge = "N"
            if remain <= refill_threshold:
                # 충전: 잔량이 크게 뛴다(이전 대비 +로 인식되도록)
                remain = random.uniform(85, 96)
                is_charge = "Y"
                refill_threshold = random.uniform(12, 22)

            rv = max(0, round(remain))
            ts = t.replace(minute=base_minute, second=0).strftime("%Y-%m-%d %H:%M:%S")
            rows.append({
                "device_id": device_id,
                "cust_id": cust_id,
                "remain1": str(rv),
                "remain1_percent": str(rv),   # 학습 스크립트가 읽는 필드
                "remain2": None,
                "remain2_percent": None,
                "tran_dttm": ts,
                "isCharge": is_charge,
            })
            prev_remain = remain
            t += timedelta(hours=INTERVAL_H)
    return rows


def main():
    customers = gen_customers()
    weather = gen_weather()
    history = gen_history(customers, weather)

    # 내부용 필드(_region_id)는 파일에서 제거
    cust_out = [{k: v for k, v in c.items() if not k.startswith("_")} for c in customers]

    with open(os.path.join(OUT_DIR, "customers.json"), "w", encoding="utf-8") as f:
        json.dump({"rows": cust_out}, f, ensure_ascii=False, indent=2)
    with open(os.path.join(OUT_DIR, "weather.json"), "w", encoding="utf-8") as f:
        json.dump({"rows": weather}, f, ensure_ascii=False)
    with open(os.path.join(OUT_DIR, "history.json"), "w", encoding="utf-8") as f:
        json.dump({"rows": history}, f, ensure_ascii=False)

    # 요약 출력
    charges = {}
    for h in history:
        if h["isCharge"] == "Y":
            charges[h["device_id"]] = charges.get(h["device_id"], 0) + 1
    avg_charges = sum(charges.values()) / max(1, len(charges))
    print(f"customers: {len(cust_out)}곳")
    print(f"weather  : {len(weather):,}행 (17지역 x 일별)")
    print(f"history  : {len(history):,}행")
    print(f"충전 이벤트: 거래처당 평균 {avg_charges:.1f}회 "
          f"(최소 {min(charges.values())}, 최대 {max(charges.values())})")


if __name__ == "__main__":
    main()
