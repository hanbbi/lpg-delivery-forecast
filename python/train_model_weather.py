"""
LPG AI - 기온 데이터 포함 ML 모델 학습 (개선 버전)
"""

import json
import pickle
import os
import pandas as pd
import numpy as np
from sklearn.ensemble import GradientBoostingRegressor, RandomForestRegressor
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import mean_squared_error, r2_score

# 스크립트 디렉토리 기준 경로 설정
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

# ============================================
# 1. 학습 데이터 로드
# ============================================
def load_training_data(filename="training_data_with_weather.json"):
    """JSON 파일에서 학습 데이터 로드"""
    filepath = os.path.join(SCRIPT_DIR, filename)
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)
    return pd.DataFrame(data)

# ============================================
# 2. 데이터 전처리
# ============================================
def preprocess_data(df):
    """데이터 전처리 및 분할"""

    # 지역 ID 인코딩
    le_region = LabelEncoder()
    df['region_encoded'] = le_region.fit_transform(df['nearest_region'])

    # 거래처 ID 인코딩
    le_device = LabelEncoder()
    df['device_encoded'] = le_device.fit_transform(df['device_id'])

    # 특성(X)과 타겟(y) 분리 - 핵심 특성 추가
    feature_columns = [
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
        # ⭐ 새로운 핵심 특성들
        'daily_consumption',
        'rule_based_estimate',
        'remain_based_estimate',
        'consumption_progress',
    ]

    X = df[feature_columns].values
    y = df['actual_days_until_charge'].values

    # 이상치 제거
    mask = (y > 0) & (y < 100)
    X = X[mask]
    y = y[mask]

    # 학습/테스트 데이터 분할
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )

    # 스케일링
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    return X_train_scaled, X_test_scaled, y_train, y_test, scaler, le_region, le_device, feature_columns

# ============================================
# 3. 모델 학습 (Gradient Boosting 사용)
# ============================================
def train_model(X_train, y_train):
    """Gradient Boosting 모델 학습 (더 정확한 예측)"""

    print("\n🎓 모델 학습 중 (Gradient Boosting)...")

    model = GradientBoostingRegressor(
        n_estimators=200,
        max_depth=8,
        learning_rate=0.1,
        min_samples_split=5,
        min_samples_leaf=3,
        subsample=0.8,
        random_state=42
    )

    model.fit(X_train, y_train)

    print("✅ 학습 완료!")

    return model

# ============================================
# 4. 모델 평가
# ============================================
def evaluate_model(model, X_test, y_test):
    """모델 성능 평가"""

    print("\n📊 모델 평가 중...")

    # 예측
    y_pred = model.predict(X_test)

    # 성능 지표
    mse = mean_squared_error(y_test, y_pred)
    rmse = np.sqrt(mse)
    r2 = r2_score(y_test, y_pred)
    mae = np.mean(np.abs(y_test - y_pred))

    print(f"\n✅ 평가 결과:")
    print(f"   RMSE: {rmse:.2f}일")
    print(f"   MAE: {mae:.2f}일")
    print(f"   R² 스코어: {r2:.3f}")

    # 정확도
    within_1_day = np.sum(np.abs(y_test - y_pred) <= 1) / len(y_test) * 100
    within_2_days = np.sum(np.abs(y_test - y_pred) <= 2) / len(y_test) * 100
    within_3_days = np.sum(np.abs(y_test - y_pred) <= 3) / len(y_test) * 100

    print(f"   ±1일 이내 정확도: {within_1_day:.1f}%")
    print(f"   ±2일 이내 정확도: {within_2_days:.1f}%")
    print(f"   ±3일 이내 정확도: {within_3_days:.1f}%")

    return {
        'rmse': rmse,
        'mae': mae,
        'r2': r2,
        'accuracy_1day': within_1_day,
        'accuracy_2days': within_2_days,
        'accuracy_3days': within_3_days
    }

# ============================================
# 5. 특성 중요도
# ============================================
def plot_feature_importance(model, feature_columns):
    """특성 중요도 출력"""

    importances = model.feature_importances_
    indices = np.argsort(importances)[::-1]

    print("\n📈 특성 중요도 (Top 10):")
    for i in range(min(10, len(importances))):
        idx = indices[i]
        print(f"   {i+1}. {feature_columns[idx]}: {importances[idx]*100:.1f}%")

# ============================================
# 6. 모델 저장
# ============================================
def save_model(model, scaler, le_region, le_device, feature_columns):
    """학습된 모델 저장"""

    models_dir = os.path.join(SCRIPT_DIR, 'models')
    os.makedirs(models_dir, exist_ok=True)

    # 모델 저장
    model_path = os.path.join(models_dir, 'lpg_weather_model.pkl')
    with open(model_path, 'wb') as f:
        pickle.dump(model, f)

    # 스케일러 저장
    scaler_path = os.path.join(models_dir, 'lpg_weather_scaler.pkl')
    with open(scaler_path, 'wb') as f:
        pickle.dump(scaler, f)

    # 인코더 저장
    region_encoder_path = os.path.join(models_dir, 'region_encoder.pkl')
    with open(region_encoder_path, 'wb') as f:
        pickle.dump(le_region, f)

    device_encoder_path = os.path.join(models_dir, 'device_encoder.pkl')
    with open(device_encoder_path, 'wb') as f:
        pickle.dump(le_device, f)

    # 특성 목록 저장
    features_path = os.path.join(models_dir, 'feature_columns.pkl')
    with open(features_path, 'wb') as f:
        pickle.dump(feature_columns, f)

    print(f"\n💾 모델 저장 완료:")
    print(f"   - {model_path}")
    print(f"   - {scaler_path}")
    print(f"   - {region_encoder_path}")
    print(f"   - {device_encoder_path}")
    print(f"   - {features_path}")

# ============================================
# 7. 메인 실행
# ============================================
def main():
    print("=" * 60)
    print("🌡️  기온 데이터 포함 ML 모델 학습 (개선 버전)")
    print("=" * 60)

    # 1. 데이터 로드
    print("\n📂 학습 데이터 로드 중...")
    try:
        df = load_training_data()
        print(f"✅ {len(df)}개 학습 샘플 로드 완료")
    except FileNotFoundError:
        print("❌ training_data_with_weather.json 파일을 찾을 수 없습니다!")
        print("   먼저 training_data_by_device_weather.py를 실행하세요.")
        return

    if len(df) < 20:
        print(f"⚠️  경고: 학습 데이터가 {len(df)}개로 부족합니다 (최소 20개 권장)")

    # 2. 데이터 전처리
    print("\n🔧 데이터 전처리 중...")
    X_train, X_test, y_train, y_test, scaler, le_region, le_device, feature_columns = preprocess_data(df)
    print(f"✅ 학습 데이터: {len(X_train)}개")
    print(f"✅ 테스트 데이터: {len(X_test)}개")
    print(f"✅ 특성 수: {len(feature_columns)}개")

    # 3. 모델 학습
    model = train_model(X_train, y_train)

    # 4. 모델 평가
    metrics = evaluate_model(model, X_test, y_test)

    # 5. 특성 중요도
    plot_feature_importance(model, feature_columns)

    # 6. 모델 저장
    save_model(model, scaler, le_region, le_device, feature_columns)

    # 7. 완료
    print("\n" + "=" * 60)
    print("✅ 모델 학습 완료!")
    print("=" * 60)

    # 8. 핵심 특성 중요도 분석
    importances = model.feature_importances_

    print("\n📊 핵심 특성 그룹별 중요도:")

    # 규칙 기반 예상 (가장 중요해야 함)
    rule_idx = feature_columns.index('rule_based_estimate')
    remain_idx = feature_columns.index('remain_based_estimate')
    progress_idx = feature_columns.index('consumption_progress')

    print(f"   🎯 rule_based_estimate: {importances[rule_idx]*100:.1f}%")
    print(f"   🎯 remain_based_estimate: {importances[remain_idx]*100:.1f}%")
    print(f"   🎯 consumption_progress: {importances[progress_idx]*100:.1f}%")

    # 기존 주요 특성
    days_since_idx = feature_columns.index('days_since_charge')
    avg_interval_idx = feature_columns.index('avg_interval')
    current_remain_idx = feature_columns.index('current_remain')

    print(f"\n   📈 days_since_charge: {importances[days_since_idx]*100:.1f}%")
    print(f"   📈 avg_interval: {importances[avg_interval_idx]*100:.1f}%")
    print(f"   📈 current_remain: {importances[current_remain_idx]*100:.1f}%")

    print("\n📌 다음 단계:")
    print("1. ML 서버 실행: python ml_server_weather.py")
    print("2. Next.js 앱 테스트: npm run dev")
    print("=" * 60)

if __name__ == "__main__":
    main()
