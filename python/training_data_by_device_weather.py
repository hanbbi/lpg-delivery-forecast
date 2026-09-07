"""
LPG AI - 기온 데이터 포함 학습 데이터 생성
JSON 파일 기반 (로컬 데이터 사용)
"""

import json
import math
import os
from datetime import datetime, timedelta
import holidays

# ============================================
# 설정
# ============================================
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(os.path.dirname(SCRIPT_DIR), 'data')

# ============================================
# 1. JSON 파일 로드
# ============================================
def load_json_file(filename):
    """JSON 파일 로드"""
    filepath = os.path.join(DATA_DIR, filename)
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)
    return data.get('rows', [])

# ============================================
# 2. 거리 계산 (Haversine 공식)
# ============================================
def calculate_distance(lat1, lon1, lat2, lon2):
    """두 좌표 간 거리 계산 (km)"""
    R = 6371

    lat1_rad = math.radians(float(lat1))
    lat2_rad = math.radians(float(lat2))
    delta_lat = math.radians(float(lat2) - float(lat1))
    delta_lon = math.radians(float(lon2) - float(lon1))

    a = math.sin(delta_lat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon/2)**2
    c = 2 * math.asin(math.sqrt(a))

    return R * c

# ============================================
# 3. 가장 가까운 지역 찾기
# ============================================
def find_nearest_region(device_lat, device_lon, weather_regions):
    """거래처 위치에서 가장 가까운 기온 측정 지역 찾기"""
    min_distance = float('inf')
    nearest_region = None

    for region in weather_regions:
        distance = calculate_distance(
            device_lat,
            device_lon,
            region['latitude'],
            region['longitude']
        )

        if distance < min_distance:
            min_distance = distance
            nearest_region = region['sigungu_id']

    return nearest_region, min_distance

# ============================================
# 4. 기간 평균 기온 계산
# ============================================
def get_avg_temp_for_period(sigungu_id, start_date, end_date, weather_data):
    """특정 지역의 기간 평균 기온 계산"""
    temps = []
    max_temps = []
    min_temps = []

    start_str = start_date.strftime('%Y-%m-%d') if isinstance(start_date, datetime) else str(start_date)[:10]
    end_str = end_date.strftime('%Y-%m-%d') if isinstance(end_date, datetime) else str(end_date)[:10]

    for w in weather_data:
        if w['sigungu_id'] == sigungu_id:
            weather_dt = str(w['weather_dt'])[:10]
            if start_str <= weather_dt <= end_str:
                if w['avg_temp'] is not None:
                    temps.append(float(w['avg_temp']))
                if w['max_temp'] is not None:
                    max_temps.append(float(w['max_temp']))
                if w['min_temp'] is not None:
                    min_temps.append(float(w['min_temp']))

    avg_temp = sum(temps) / len(temps) if temps else 15.0
    max_temp = max(max_temps) if max_temps else avg_temp + 5
    min_temp = min(min_temps) if min_temps else avg_temp - 5

    return avg_temp, max_temp, min_temp

# ============================================
# 5. 휴일/공휴일/주말 특성 계산 (날짜 개별 체크)
# ============================================
def get_holiday_features(target_date):
    """
    특정 날짜의 휴일/주말 관련 특성 계산 (개별 날짜 체크)
    """
    if isinstance(target_date, str):
        target_date = datetime.fromisoformat(target_date.replace('Z', '+00:00').split('+')[0])

    # 한국 공휴일 객체 생성
    years = list(range(target_date.year, target_date.year + 2))
    kr_holidays = holidays.KR(years=years)

    # 1. 해당 날짜가 공휴일인지 체크
    is_holiday = 1 if target_date.date() in kr_holidays else 0

    # 2. 해당 날짜가 주말인지 체크 (토요일=5, 일요일=6)
    is_weekend = 1 if target_date.weekday() >= 5 else 0

    # 3. 다음 공휴일까지 남은 일수 계산
    days_to_next_holiday = 0
    check_date = target_date
    max_days = 100
    while days_to_next_holiday < max_days:
        check_date += timedelta(days=1)
        days_to_next_holiday += 1
        if check_date.date() in kr_holidays:
            break

    # 4. 해당 주에 공휴일 있는지 확인
    week_start = target_date - timedelta(days=target_date.weekday())
    week_end = week_start + timedelta(days=6)

    is_holiday_week = 0
    check_day = week_start
    while check_day <= week_end:
        if check_day.date() in kr_holidays:
            is_holiday_week = 1
            break
        check_day += timedelta(days=1)

    return is_holiday, is_weekend, days_to_next_holiday, is_holiday_week

# ============================================
# 6. 계절 계산
# ============================================
def get_season(date):
    """날짜로부터 계절 계산"""
    if isinstance(date, str):
        date = datetime.fromisoformat(date.replace('Z', '+00:00').split('+')[0])
    month = date.month

    if 3 <= month <= 5:
        return 1  # 봄
    elif 6 <= month <= 8:
        return 2  # 여름
    elif 9 <= month <= 11:
        return 3  # 가을
    else:
        return 4  # 겨울

# ============================================
# 7. 표준편차 계산
# ============================================
def calculate_std(values):
    """표준편차 계산"""
    if len(values) < 2:
        return 0.0
    avg = sum(values) / len(values)
    variance = sum((x - avg) ** 2 for x in values) / len(values)
    return variance ** 0.5

# ============================================
# 8. 이력 데이터 정제 (이상값 제거)
# ============================================
def clean_history(history):
    """이력 데이터 정제 - 잔량 0 등 이상값 제거"""
    cleaned = []
    for h in history:
        remain = float(h.get('remain1_percent') or 0)
        # 잔량이 0인 데이터는 센서 오류로 판단하여 제외
        if remain <= 0:
            continue
        cleaned.append(h)
    return cleaned

# ============================================
# 9. 충전 이벤트 감지 (이상 데이터 필터링 포함)
# ============================================
def detect_charge_events(history):
    """충전 이벤트 감지 - 가짜 충전 및 연속 충전 필터링"""
    raw_charge_events = []

    for i in range(1, len(history)):
        prev = history[i - 1]
        curr = history[i]

        prev_remain = float(prev.get('remain1_percent') or 0)
        curr_remain = float(curr.get('remain1_percent') or 0)

        # isCharge='Y'이면서 잔량이 실제로 10% 이상 증가한 경우만 충전으로 인정
        if curr.get('isCharge') == 'Y' and (curr_remain - prev_remain) >= 10:
            raw_charge_events.append({
                'datetime': curr['tran_dttm'],
                'remain_before': prev_remain,
                'remain_after': curr_remain
            })
        # isCharge 플래그 없이 잔량이 30% 이상 증가한 경우
        elif curr.get('isCharge') != 'Y' and (curr_remain - prev_remain) > 30:
            raw_charge_events.append({
                'datetime': curr['tran_dttm'],
                'remain_before': prev_remain,
                'remain_after': curr_remain
            })

    # 연속 충전 필터링 (2일 이내 재충전은 하나로 병합)
    if len(raw_charge_events) < 2:
        return raw_charge_events

    filtered_events = [raw_charge_events[0]]

    for i in range(1, len(raw_charge_events)):
        prev_event = filtered_events[-1]
        curr_event = raw_charge_events[i]

        prev_dt = prev_event['datetime']
        curr_dt = curr_event['datetime']

        if isinstance(prev_dt, str):
            prev_dt = datetime.fromisoformat(prev_dt.replace('Z', '+00:00').split('+')[0])
        if isinstance(curr_dt, str):
            curr_dt = datetime.fromisoformat(curr_dt.replace('Z', '+00:00').split('+')[0])

        days_diff = (curr_dt - prev_dt).days

        # 2일 이내 연속 충전 → 이전 이벤트 업데이트
        if days_diff <= 2:
            if curr_event['remain_after'] > filtered_events[-1]['remain_after']:
                filtered_events[-1]['remain_after'] = curr_event['remain_after']
        else:
            filtered_events.append(curr_event)

    return filtered_events

# ============================================
# 9. 충전 간격 계산
# ============================================
def calculate_intervals(charge_events):
    """충전 간격 계산 (일 단위)"""
    intervals = []

    for i in range(1, len(charge_events)):
        prev_dt = charge_events[i - 1]['datetime']
        curr_dt = charge_events[i]['datetime']

        if isinstance(prev_dt, str):
            prev_dt = datetime.fromisoformat(prev_dt.replace('Z', '+00:00').split('+')[0])
        if isinstance(curr_dt, str):
            curr_dt = datetime.fromisoformat(curr_dt.replace('Z', '+00:00').split('+')[0])

        diff_days = (curr_dt - prev_dt).days
        if diff_days > 0:
            intervals.append(diff_days)

    return intervals

# ============================================
# 10. 메인 실행
# ============================================
def main():
    print("=" * 60)
    print("🌡️  기온 데이터 포함 학습 데이터 생성 (JSON 파일 기반)")
    print("=" * 60)

    # 1. 데이터 로드
    print("\n📂 데이터 파일 로드 중...")

    try:
        customers = load_json_file('customers.json')
        print(f"   ✅ 거래처: {len(customers)}개")
    except Exception as e:
        print(f"   ❌ customers.json 로드 실패: {e}")
        return

    try:
        history_all = load_json_file('history.json')
        print(f"   ✅ 이력: {len(history_all)}개")
    except Exception as e:
        print(f"   ❌ history.json 로드 실패: {e}")
        return

    try:
        weather_all = load_json_file('weather.json')
        print(f"   ✅ 날씨: {len(weather_all)}개")
    except Exception as e:
        print(f"   ❌ weather.json 로드 실패: {e}")
        return

    # 2. 날씨 지역 정보 추출
    weather_regions = {}
    for w in weather_all:
        sid = w['sigungu_id']
        if sid not in weather_regions:
            weather_regions[sid] = {
                'sigungu_id': sid,
                'latitude': w['latitude'],
                'longitude': w['longitude']
            }
    weather_regions_list = list(weather_regions.values())
    print(f"   ✅ 날씨 지역: {len(weather_regions_list)}개")

    # 3. 거래처별 이력 그룹화
    history_by_device = {}
    for h in history_all:
        device_id = h['device_id']
        if device_id not in history_by_device:
            history_by_device[device_id] = []
        history_by_device[device_id].append(h)

    # 날짜순 정렬
    for device_id in history_by_device:
        history_by_device[device_id].sort(key=lambda x: x['tran_dttm'])

    # 4. 학습 데이터 생성
    print("\n🔧 학습 데이터 생성 중...")
    all_training_data = []

    for i, customer in enumerate(customers, 1):
        device_id = customer['device_id']

        # 해당 거래처의 이력 데이터 (이상값 정제)
        history_raw = history_by_device.get(device_id, [])
        history = clean_history(history_raw)

        if len(history) < 10:
            continue

        # 충전 이벤트 감지
        charge_events = detect_charge_events(history)

        if len(charge_events) < 3:
            continue

        # 충전 간격 계산
        intervals = calculate_intervals(charge_events)
        remains_before = [e['remain_before'] for e in charge_events]

        if len(intervals) < 2:
            continue

        # 가장 가까운 지역 찾기
        device_lat = float(customer.get('latitude') or 37.5665)
        device_lon = float(customer.get('longitude') or 126.978)
        nearest_region, distance = find_nearest_region(device_lat, device_lon, weather_regions_list)

        print(f"[{i}/{len(customers)}] {device_id}: 충전 {len(charge_events)}회, 지역 {nearest_region} ({distance:.1f}km)")

        # 일별 샘플 생성: 충전 사이의 모든 날짜에 대해 샘플 생성
        for j in range(1, len(charge_events)):
            # 이전 충전과 현재 충전 사이의 기간
            prev_charge_dt = charge_events[j-1]['datetime']
            curr_charge_dt = charge_events[j]['datetime']

            if isinstance(prev_charge_dt, str):
                prev_charge_dt = datetime.fromisoformat(prev_charge_dt.replace('Z', '+00:00').split('+')[0])
            if isinstance(curr_charge_dt, str):
                curr_charge_dt = datetime.fromisoformat(curr_charge_dt.replace('Z', '+00:00').split('+')[0])

            # 충전 간격 (일수)
            charge_interval = (curr_charge_dt - prev_charge_dt).days
            # 비정상적인 간격 제외 (3일 미만 또는 60일 초과)
            if charge_interval < 3 or charge_interval > 60:
                continue

            # 과거 통계 계산 (j-1 시점까지의 데이터 사용)
            past_intervals = intervals[:j]
            past_remains = remains_before[:j+1]

            if not past_intervals:
                continue

            avg_interval = sum(past_intervals) / len(past_intervals)
            std_interval = calculate_std(past_intervals)
            avg_remain = sum(past_remains) / len(past_remains) if past_remains else 20
            min_remain = min(past_remains) if past_remains else 10

            # ⭐ 일일 소비율 계산 (핵심 특성)
            # 충전 후 잔량 (보통 90~100%)
            remain_after_charge = charge_events[j-1].get('remain_after', 100)
            if remain_after_charge is None or remain_after_charge < 50:
                remain_after_charge = 100

            # 충전 직전 잔량
            remain_at_charge = remains_before[j] if j < len(remains_before) else avg_remain

            # 평균 일일 소비율 = (충전후 잔량 - 충전전 잔량) / 평균 주기
            daily_consumption = (100 - avg_remain) / avg_interval if avg_interval > 0 else 10

            # 충전 사이의 각 날짜에 대해 샘플 생성
            for day_offset in range(charge_interval):
                current_date = prev_charge_dt + timedelta(days=day_offset)
                days_since_charge = day_offset
                days_until_charge = charge_interval - day_offset

                # 잔량 추정 (선형 감소) - 실제 충전 후 잔량 사용
                if charge_interval > 0:
                    remain_decrease_per_day = (remain_after_charge - remain_at_charge) / charge_interval
                    current_remain = remain_after_charge - (remain_decrease_per_day * day_offset)
                else:
                    current_remain = remain_at_charge

                # ⭐ 규칙 기반 예상 잔여일 (핵심 특성)
                rule_based_estimate = max(0, avg_interval - days_since_charge)

                # ⭐ 잔량 기반 예상 잔여일
                if daily_consumption > 0:
                    remain_based_estimate = max(0, (current_remain - avg_remain) / daily_consumption)
                else:
                    remain_based_estimate = rule_based_estimate

                # ⭐ 소비 진행률 (0~1)
                consumption_progress = days_since_charge / avg_interval if avg_interval > 0 else 0

                # 해당 날짜의 기온 데이터
                avg_temp, max_temp, min_temp = get_avg_temp_for_period(
                    nearest_region,
                    current_date,
                    current_date,
                    weather_all
                )

                # 계절
                season = get_season(current_date)

                # 휴일/주말 특성 (해당 날짜 기준)
                is_holiday, is_weekend, days_to_next_holiday, is_holiday_week = get_holiday_features(current_date)

                # 학습 샘플
                sample = {
                    "device_id": device_id,
                    "current_remain": float(max(0, min(100, current_remain))),
                    "days_since_charge": int(days_since_charge),
                    "avg_interval": float(avg_interval),
                    "std_interval": float(std_interval),
                    "avg_remain": float(avg_remain),
                    "min_remain": float(min_remain),
                    "total_charges": j,
                    "avg_temp": float(avg_temp),
                    "max_temp": float(max_temp),
                    "min_temp": float(min_temp),
                    "season": int(season),
                    "nearest_region": str(nearest_region),
                    "is_holiday": int(is_holiday),
                    "is_weekend": int(is_weekend),
                    "days_to_next_holiday": int(days_to_next_holiday),
                    "is_holiday_week": int(is_holiday_week),
                    # ⭐ 새로운 핵심 특성들
                    "daily_consumption": float(daily_consumption),
                    "rule_based_estimate": float(rule_based_estimate),
                    "remain_based_estimate": float(remain_based_estimate),
                    "consumption_progress": float(min(1, consumption_progress)),
                    # 타겟
                    "actual_days_until_charge": float(days_until_charge)
                }

                all_training_data.append(sample)

    # 5. 결과 저장
    print(f"\n📊 총 {len(all_training_data)}개 학습 샘플 생성")

    if len(all_training_data) < 20:
        print("⚠️  경고: 학습 데이터가 부족합니다 (최소 20개 필요)")

    # JSON 저장
    output_file = os.path.join(SCRIPT_DIR, "training_data_with_weather.json")
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(all_training_data, f, indent=2, ensure_ascii=False)

    print(f"\n💾 학습 데이터 저장: {output_file}")

    # 6. 샘플 출력
    if all_training_data:
        print("\n📝 샘플 데이터 (첫 3개):")
        season_names = ['', '봄', '여름', '가을', '겨울']
        for idx, sample in enumerate(all_training_data[:3], 1):
            print(f"\n샘플 {idx}:")
            print(f"  거래처: {sample['device_id']}")
            print(f"  현재 잔량: {sample['current_remain']:.1f}%")
            print(f"  경과 일수: {sample['days_since_charge']}일")
            print(f"  평균 주기: {sample['avg_interval']:.1f}일")
            print(f"  일일 소비율: {sample['daily_consumption']:.1f}%")
            print(f"  규칙 기반 예상: {sample['rule_based_estimate']:.1f}일")
            print(f"  잔량 기반 예상: {sample['remain_based_estimate']:.1f}일")
            print(f"  → 실제 남은 일수: {sample['actual_days_until_charge']:.0f}일")

    # 7. 완료
    print("\n" + "=" * 60)
    print("✅ 학습 데이터 생성 완료!")
    print("=" * 60)
    print("\n📌 다음 단계:")
    print("   python train_model_weather.py")
    print("=" * 60)

if __name__ == "__main__":
    main()
