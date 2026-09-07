'use client';

import { PredictResult } from '@/types';

interface Props {
  prediction: PredictResult;
}

export default function PredictionCard({ prediction }: Props) {
  // 평균 충전 주기 대비 비율로 색상 결정
  const getUrgencyStyle = (days: number) => {
    const avgInterval = prediction.analysisData?.avgInterval || 7;
    const ratio = days / avgInterval;

    // 50% 이상 남음 → 초록 (여유)
    if (ratio >= 0.5) return 'from-emerald-400 to-green-400';
    // 25% 이상 남음 → 주황 (주의)
    if (ratio >= 0.25) return 'from-amber-400 to-orange-400';
    // 25% 미만 → 빨강 (긴급)
    return 'from-rose-400 to-red-400';
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return 'bg-green-500';
    if (confidence >= 0.8) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getSeasonName = (season: number) => {
    const names = ['', '봄', '여름', '가을', '겨울'];
    return names[season] || '';
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <span className="text-2xl">🤖</span>
        AI 예측 결과
      </h2>

      {/* 핵심 예측 결과 - 큰 카드 */}
      <div className={`bg-gradient-to-r ${getUrgencyStyle(prediction.days_until_charge)} rounded-lg p-5 mb-6 text-white`}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm opacity-90">다음 충전까지</p>
            <p className="text-4xl font-bold">
              {prediction.days_until_charge.toFixed(1)}
              <span className="text-xl font-normal ml-1">일</span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs opacity-80">신뢰도</p>
            <p className="text-2xl font-bold">{(prediction.confidence * 100).toFixed(0)}%</p>
            <div className="w-16 h-1.5 bg-white/30 rounded-full overflow-hidden mt-1 ml-auto">
              <div
                className="h-full bg-white"
                style={{ width: `${prediction.confidence * 100}%` }}
              />
            </div>
          </div>
        </div>
        <p className="text-sm opacity-90 border-t border-white/20 pt-2">
          {prediction.suggestion}
        </p>
        <div className="mt-2 flex items-center gap-2">
          <span className="text-xs bg-white/20 px-2 py-0.5 rounded">{prediction.model_type}</span>
        </div>
      </div>

      {/* 분석 데이터 - 2x2 그리드 */}
      {prediction.analysisData && (
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-blue-50 p-4 rounded-lg">
            <p className="text-sm text-blue-600">현재 잔량</p>
            <p className="text-2xl font-bold text-blue-900">
              {prediction.analysisData.currentRemain.toFixed(1)}%
            </p>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg">
            <p className="text-sm text-purple-600">충전 후 경과</p>
            <p className="text-2xl font-bold text-purple-900">
              {prediction.analysisData.daysSinceCharge}일
            </p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <p className="text-sm text-green-600">평균 충전 주기</p>
            <p className="text-2xl font-bold text-green-900">
              {prediction.analysisData.avgInterval.toFixed(1)}일
            </p>
          </div>
          <div className="bg-orange-50 p-4 rounded-lg">
            <p className="text-sm text-orange-600">총 충전 횟수</p>
            <p className="text-2xl font-bold text-orange-900">
              {prediction.analysisData.totalCharges}회
            </p>
          </div>
        </div>
      )}

      {/* 환경 요소 */}
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-4 rounded-lg">
        <p className="text-sm font-medium text-indigo-700 mb-2 flex items-center gap-1">
          <span>🌤️</span> 환경 요소
        </p>
        <div className="grid grid-cols-2 gap-3 text-sm">
          {prediction.avg_temp !== undefined && (
            <div>
              <span className="text-gray-600">평균 기온:</span>
              <span className="font-medium ml-1">{prediction.avg_temp.toFixed(1)}°C</span>
            </div>
          )}
          {prediction.season !== undefined && (
            <div>
              <span className="text-gray-600">계절:</span>
              <span className="font-medium ml-1">{getSeasonName(prediction.season)}</span>
            </div>
          )}
          {prediction.is_holiday !== undefined && (
            <div>
              <span className="text-gray-600">공휴일:</span>
              <span className={`font-medium ml-1 ${prediction.is_holiday === 1 ? 'text-red-600' : ''}`}>
                {prediction.is_holiday === 1 ? '예' : '아니오'}
              </span>
            </div>
          )}
          {prediction.is_weekend !== undefined && (
            <div>
              <span className="text-gray-600">주말:</span>
              <span className={`font-medium ml-1 ${prediction.is_weekend === 1 ? 'text-orange-600' : ''}`}>
                {prediction.is_weekend === 1 ? '예' : '아니오'}
              </span>
            </div>
          )}
        </div>
        {/* 영향 분석 */}
        {(prediction.weather_impact || prediction.holiday_weekend_impact) && (
          <div className="mt-2 pt-2 border-t border-indigo-200 text-xs text-gray-600 space-y-1">
            {prediction.weather_impact && <div>🌡️ {prediction.weather_impact}</div>}
            {prediction.holiday_weekend_impact && <div>🗓️ {prediction.holiday_weekend_impact}</div>}
          </div>
        )}
      </div>

      {/* 디버깅 비교 */}
      {prediction.analysisData?.ruleBasedEstimate !== undefined && (
        <div className="mt-4 text-center text-sm text-gray-500">
          📊 규칙 기반: <span className="font-semibold text-green-700">{prediction.analysisData.ruleBasedEstimate}일</span>
          {' | '}
          ML 예측: <span className="font-semibold text-blue-700">{prediction.days_until_charge.toFixed(1)}일</span>
        </div>
      )}

      {/* 경고 */}
      {prediction.warning && (
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-700">
          ⚠️ {prediction.warning}
        </div>
      )}
    </div>
  );
}
