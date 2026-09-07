"""
LPG AI 예측 ML 서버 - 기온 데이터 포함 (개선 버전)
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import pickle
import os
import numpy as np
from datetime import datetime

app = Flask(__name__)
CORS(app)

# 전역 변수
model = None
scaler = None
region_encoder = None
device_encoder = None

# 스크립트 디렉토리 기준 경로 설정
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(SCRIPT_DIR, 'models/lpg_weather_model.pkl')
SCALER_PATH = os.path.join(SCRIPT_DIR, 'models/lpg_weather_scaler.pkl')
REGION_ENCODER_PATH = os.path.join(SCRIPT_DIR, 'models/region_encoder.pkl')
DEVICE_ENCODER_PATH = os.path.join(SCRIPT_DIR, 'models/device_encoder.pkl')

# ============================================
# 모델 로드
# ============================================
def load_model():
    """학습된 모델 로드"""
    global model, scaler, region_encoder, device_encoder

    if (os.path.exists(MODEL_PATH) and
        os.path.exists(SCALER_PATH) and
        os.path.exists(REGION_ENCODER_PATH) and
        os.path.exists(DEVICE_ENCODER_PATH)):

        with open(MODEL_PATH, 'rb') as f:
            model = pickle.load(f)
        with open(SCALER_PATH, 'rb') as f:
            scaler = pickle.load(f)
        with open(REGION_ENCODER_PATH, 'rb') as f:
            region_encoder = pickle.load(f)
        with open(DEVICE_ENCODER_PATH, 'rb') as f:
            device_encoder = pickle.load(f)

        print("✅ 개선된 모델 로드 완료 (21개 특성)")
    else:
        print("⚠️  학습된 모델 없음")
        model = None
        scaler = None

# ============================================
# 예측 API
# ============================================
@app.route('/predict', methods=['POST'])
def predict():
    """
    충전까지 남은 일수 예측 (개선 버전)
    """
    try:
        if model is None:
            return jsonify({
                "error": "모델 없음",
                "message": "학습된 모델이 없습니다."
            }), 400

        data = request.json

        # 거래처 ID 인코딩
        device_id = data.get('device_id', 'unknown')
        try:
            device_encoded = device_encoder.transform([device_id])[0]
        except:
            device_encoded = len(device_encoder.classes_) // 2

        # 지역 ID 인코딩
        region_id = data.get('nearest_region', 'seoul')
        try:
            region_encoded = region_encoder.transform([region_id])[0]
        except:
            region_encoded = 0

        # 기본 특성 추출
        current_remain = data.get('current_remain', 50)
        days_since_charge = data.get('days_since_charge', 0)
        avg_interval = data.get('avg_interval', 7)
        avg_remain = data.get('avg_remain', 25)

        # ⭐ 새로운 핵심 특성 계산
        # 일일 소비율
        daily_consumption = (100 - avg_remain) / avg_interval if avg_interval > 0 else 10

        # 규칙 기반 예상 잔여일
        rule_based_estimate = max(0, avg_interval - days_since_charge)

        # 잔량 기반 예상 잔여일
        if daily_consumption > 0:
            remain_based_estimate = max(0, (current_remain - avg_remain) / daily_consumption)
        else:
            remain_based_estimate = rule_based_estimate

        # 소비 진행률
        consumption_progress = min(1, days_since_charge / avg_interval) if avg_interval > 0 else 0

        # 특성 구성 (21개 - 순서 중요!)
        features = [
            current_remain,
            days_since_charge,
            avg_interval,
            data.get('std_interval', 0),
            avg_remain,
            data.get('min_remain', 0),
            data.get('total_charges', 0),
            data.get('avg_temp', 15.0),
            data.get('max_temp', 20.0),
            data.get('min_temp', 10.0),
            data.get('season', 2),
            region_encoded,
            device_encoded,
            data.get('is_holiday', 0),
            data.get('is_weekend', 0),
            data.get('days_to_next_holiday', 30),
            data.get('is_holiday_week', 0),
            # ⭐ 새로운 핵심 특성들
            daily_consumption,
            rule_based_estimate,
            remain_based_estimate,
            consumption_progress,
        ]

        # 스케일링
        features_scaled = scaler.transform([features])

        # 예측
        days_until_charge = model.predict(features_scaled)[0]

        # 예측값 보정 (음수 방지, 최대값 제한)
        days_until_charge = max(0, min(days_until_charge, avg_interval * 1.5))

        # 신뢰도 계산
        total_charges = data.get('total_charges', 0)
        if total_charges >= 30:
            confidence = 0.95
        elif total_charges >= 20:
            confidence = 0.90
        elif total_charges >= 10:
            confidence = 0.85
        else:
            confidence = 0.80

        # 기온 영향 분석
        avg_temp = data.get('avg_temp', 15.0)
        temp_impact = analyze_temperature_impact(avg_temp)

        # 휴일/주말 정보
        is_holiday = data.get('is_holiday', 0)
        is_weekend = data.get('is_weekend', 0)
        days_to_next_holiday = data.get('days_to_next_holiday', 30)
        is_holiday_week = data.get('is_holiday_week', 0)

        # 휴일/주말 영향 분석
        holiday_weekend_impact = analyze_holiday_weekend_impact(is_holiday, is_weekend, days_to_next_holiday, is_holiday_week)

        # 제안 메시지
        if days_until_charge <= 2:
            suggestion = f"긴급! {days_until_charge:.1f}일 내 충전 필요"
        elif days_until_charge <= 5:
            suggestion = f"{days_until_charge:.1f}일 내 충전 권장"
        else:
            suggestion = f"약 {days_until_charge:.1f}일 후 충전 예정"

        return jsonify({
            "days_until_charge": round(days_until_charge, 1),
            "confidence": confidence,
            "model_type": "GRADIENT_BOOSTING",
            "suggestion": suggestion,
            "weather_impact": temp_impact,
            "holiday_weekend_impact": holiday_weekend_impact,
            "avg_temp": avg_temp,
            "season": data.get('season', 2),
            "is_holiday": is_holiday,
            "is_weekend": is_weekend,
            "days_to_next_holiday": days_to_next_holiday,
            "is_holiday_week": is_holiday_week
        })

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({
            "error": "예측 실패",
            "message": str(e)
        }), 500

def analyze_temperature_impact(avg_temp):
    """기온 영향 분석"""
    if avg_temp < 0:
        return "매우 높음 (혹한기)"
    elif avg_temp < 10:
        return "높음 (저온)"
    elif avg_temp > 25:
        return "낮음 (고온)"
    else:
        return "보통"

def analyze_holiday_weekend_impact(is_holiday, is_weekend, days_to_next_holiday, is_holiday_week):
    """휴일/주말 영향 분석"""
    if is_holiday == 1 and is_weekend == 1:
        return "매우 높음 (공휴일+주말)"
    elif is_holiday == 1:
        return "높음 (공휴일)"
    elif is_weekend == 1:
        return "높음 (주말)"
    elif is_holiday_week == 1:
        return "중간 (공휴일 주간)"
    elif days_to_next_holiday <= 3:
        return "중간 (공휴일 임박)"
    else:
        return "보통 (평일)"

# ============================================
# 헬스 체크
# ============================================
@app.route('/health', methods=['GET'])
def health():
    """서버 상태 확인"""
    return jsonify({
        "status": "running",
        "model_loaded": model is not None,
        "model_type": "gradient_boosting_improved",
        "timestamp": datetime.now().isoformat()
    })

# ============================================
# 모델 정보
# ============================================
@app.route('/model/info', methods=['GET'])
def model_info():
    """모델 정보 조회"""
    if model is None:
        return jsonify({
            "model_loaded": False,
            "message": "모델이 로드되지 않았습니다."
        })

    return jsonify({
        "model_loaded": True,
        "model_type": "GradientBoostingRegressor (Improved)",
        "feature_count": 21,
        "feature_names": [
            'current_remain',
            'days_since_charge',
            'avg_interval',
            'std_interval',
            'avg_remain',
            'min_remain',
            'total_charges',
            'avg_temp',
            'max_temp',
            'min_temp',
            'season',
            'region_encoded',
            'device_encoded',
            'is_holiday',
            'is_weekend',
            'days_to_next_holiday',
            'is_holiday_week',
            'daily_consumption',
            'rule_based_estimate',
            'remain_based_estimate',
            'consumption_progress'
        ],
        "regions_count": len(region_encoder.classes_) if region_encoder else 0,
        "devices_count": len(device_encoder.classes_) if device_encoder else 0
    })

# ============================================
# 서버 시작
# ============================================
if __name__ == '__main__':
    # 모델 로드
    load_model()

    # 서버 실행
    print("=" * 50)
    print("🌡️  LPG AI ML 서버 (개선 버전)")
    print("=" * 50)
    print("📍 URL: http://localhost:5001")
    print("📍 예측: POST /predict")
    print("📍 상태: GET /health")
    print("📍 모델정보: GET /model/info")
    print("=" * 50)

    app.run(host='0.0.0.0', port=5001, debug=True)
