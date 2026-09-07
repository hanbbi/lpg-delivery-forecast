import { NextRequest, NextResponse } from 'next/server';
import {
  getCustomerByDeviceId,
  getHistoryByDeviceId,
  findNearestRegion,
  getWeatherStats,
} from '@/lib/data';
import { getSeason, calculateStd, getHolidayFeatures } from '@/lib/utils';

const ML_SERVER_URL = process.env.ML_SERVER_URL || 'http://localhost:5001';

interface PredictRequest {
  device_id: string;
  current_remain: number;
  days_since_charge: number;
  avg_interval: number;
  std_interval: number;
  avg_remain: number;
  min_remain: number;
  total_charges: number;
  avg_temp: number;
  max_temp: number;
  min_temp: number;
  season: number;
  nearest_region: string;
  is_holiday: number;
  is_weekend: number;
  days_to_next_holiday: number;
  is_holiday_week: number;
}

// 이력 데이터 정제 (잔량 0 등 이상값 제거)
function cleanHistory(history: any[]): any[] {
  return history.filter((h) => {
    // remain1 또는 remain1_percent 필드 지원
    const remain = parseFloat(h.remain1 ?? h.remain1_percent) || 0;
    return remain > 0;
  });
}

// 충전 이벤트 감지 (가짜 충전, 연속 충전, 이상 데이터 필터링)
function detectChargeEvents(history: any[]): { datetime: Date; remainBefore: number }[] {
  // 먼저 이상값 정제
  const cleaned = cleanHistory(history);

  const rawChargeEvents: { datetime: Date; remainBefore: number }[] = [];

  for (let i = 1; i < cleaned.length; i++) {
    const prev = cleaned[i - 1];
    const curr = cleaned[i];
    // remain1 또는 remain1_percent 필드 지원
    const prevRemain = parseFloat(prev.remain1 ?? prev.remain1_percent) || 0;
    const currRemain = parseFloat(curr.remain1 ?? curr.remain1_percent) || 0;
    const diff = currRemain - prevRemain;

    // isCharge='Y'이면서 잔량이 실제로 10% 이상 증가한 경우만 충전
    if ((curr.isCharge === 'Y' || curr.isCharge === true) && diff >= 10) {
      rawChargeEvents.push({
        datetime: new Date(curr.tran_dttm),
        remainBefore: prevRemain,
      });
    }
    // isCharge 플래그 없이 잔량이 30% 이상 증가한 경우
    else if (curr.isCharge !== 'Y' && curr.isCharge !== true && diff > 30) {
      rawChargeEvents.push({
        datetime: new Date(curr.tran_dttm),
        remainBefore: prevRemain,
      });
    }
  }

  // 연속 충전 필터링 (2일 이내 재충전은 하나로 병합)
  if (rawChargeEvents.length < 2) {
    return rawChargeEvents;
  }

  const filteredEvents: { datetime: Date; remainBefore: number }[] = [rawChargeEvents[0]];

  for (let i = 1; i < rawChargeEvents.length; i++) {
    const prevEvent = filteredEvents[filteredEvents.length - 1];
    const currEvent = rawChargeEvents[i];

    const daysDiff = Math.round(
      (currEvent.datetime.getTime() - prevEvent.datetime.getTime()) / (1000 * 60 * 60 * 24)
    );

    // 2일 초과 간격만 정상 충전으로 인정
    if (daysDiff > 2) {
      filteredEvents.push(currEvent);
    }
  }

  return filteredEvents;
}

// 충전 간격 계산
function calculateIntervals(chargeEvents: { datetime: Date }[]): number[] {
  const intervals: number[] = [];
  for (let i = 1; i < chargeEvents.length; i++) {
    const diffDays = Math.round(
      (chargeEvents[i].datetime.getTime() - chargeEvents[i - 1].datetime.getTime()) /
        (1000 * 60 * 60 * 24)
    );
    intervals.push(diffDays);
  }
  return intervals;
}

// POST /api/predict - ML 서버에 예측 요청
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { device_id, startDate: requestStartDate, endDate: requestEndDate } = body;

    if (!device_id) {
      return NextResponse.json(
        { error: 'device_id는 필수입니다.' },
        { status: 400 }
      );
    }

    // 1. 거래처 정보 조회
    const customer = getCustomerByDeviceId(device_id);

    if (!customer) {
      return NextResponse.json(
        { error: '거래처를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 2. 이력 데이터 조회 (사용자가 선택한 날짜 범위 사용)
    const endDate = requestEndDate || new Date().toISOString().split('T')[0];
    const startDate = requestStartDate || new Date(Date.now() - 180 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];

    // 분석 기준일 (사용자가 선택한 종료일)
    const analysisDate = new Date(endDate);

    const historyRows = getHistoryByDeviceId(device_id, startDate, endDate);
    console.log(`[예측] device_id=${device_id}, 기간=${startDate}~${endDate}, 이력=${historyRows.length}건`);

    // 충전 데이터 샘플 확인
    const chargeDataSample = historyRows.filter(h => h.isCharge === 'Y').slice(0, 3);
    console.log(`[예측] isCharge='Y' 샘플:`, JSON.stringify(chargeDataSample));

    if (historyRows.length === 0) {
      return NextResponse.json(
        { error: '이력 데이터가 없습니다.' },
        { status: 400 }
      );
    }

    // 3. 가장 가까운 지역 찾기
    const lat = parseFloat(customer.latitude) || 37.5665;
    const lon = parseFloat(customer.longitude) || 126.978;
    const { sigungu_id: nearestRegion, distance: regionDistance } = findNearestRegion(lat, lon);

    // 4. 충전 이벤트 및 통계 계산
    const chargeEvents = detectChargeEvents(historyRows);
    const intervals = calculateIntervals(chargeEvents);
    const remainsBeforeCharge = chargeEvents.map((e) => e.remainBefore);

    const avgInterval =
      intervals.length > 0
        ? intervals.reduce((a, b) => a + b, 0) / intervals.length
        : 30;
    const stdInterval = calculateStd(intervals);
    const avgRemain =
      remainsBeforeCharge.length > 0
        ? remainsBeforeCharge.reduce((a, b) => a + b, 0) / remainsBeforeCharge.length
        : 20;
    const minRemain =
      remainsBeforeCharge.length > 0 ? Math.min(...remainsBeforeCharge) : 10;

    // 5. 현재 잔량 및 마지막 충전 이후 경과일 (분석 기준일 기준)
    const lastHistory = historyRows[historyRows.length - 1];
    // remain1 또는 remain1_percent 필드 지원
    const currentRemain = parseFloat(lastHistory.remain1 || lastHistory.remain1_percent || '0') || 0;

    let daysSinceCharge = 0;
    if (chargeEvents.length > 0) {
      const lastChargeDate = chargeEvents[chargeEvents.length - 1].datetime;
      daysSinceCharge = Math.round(
        (analysisDate.getTime() - lastChargeDate.getTime()) / (1000 * 60 * 60 * 24)
      );
    }

    // 6. 최근 날씨 데이터 조회 (분석 기준일 기준 최근 7일)
    const recentStart = new Date(analysisDate.getTime() - 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];
    const weatherStats = getWeatherStats(nearestRegion, recentStart, endDate);

    // 규칙 기반 예측 함수
    const getRuleBasedPrediction = (reason: string) => {
      const estimatedDays = Math.max(0, Math.round(avgInterval - daysSinceCharge));
      return {
        days_until_charge: estimatedDays,
        confidence: 0.7,
        model_type: 'RULE_BASED',
        suggestion:
          estimatedDays <= 3
            ? `긴급! ${estimatedDays}일 내 충전 필요`
            : `약 ${estimatedDays}일 후 충전 예정`,
        customer: {
          device_id: customer.device_id,
          cust_nm: customer.cust_nm,
        },
        analysisData: {
          currentRemain,
          daysSinceCharge,
          avgInterval,
          totalCharges: chargeEvents.length,
          nearestRegion,
          regionDistance,
        },
        warning: reason,
      };
    };

    // 7. 충전 횟수가 20회 미만이면 규칙 기반 예측 사용
    console.log(`[예측] 감지된 충전 이벤트: ${chargeEvents.length}건`);
    if (chargeEvents.length < 20) {
      console.log(`충전 횟수 ${chargeEvents.length}회 < 20회, 규칙 기반 예측 사용`);
      return NextResponse.json(
        getRuleBasedPrediction(`충전 이력이 ${chargeEvents.length}회로 부족하여 규칙 기반 예측을 사용했습니다. (최소 20회 필요)`)
      );
    }

    // 8. 휴일 특성 계산 (분석 기준일의 개별 날짜 체크)
    const holidayFeatures = getHolidayFeatures(analysisDate);

    // 9. ML 서버에 예측 요청
    const predictRequest: PredictRequest = {
      device_id,
      current_remain: currentRemain,
      days_since_charge: daysSinceCharge,
      avg_interval: avgInterval,
      std_interval: stdInterval,
      avg_remain: avgRemain,
      min_remain: minRemain,
      total_charges: chargeEvents.length,
      avg_temp: weatherStats.avgTemp,
      max_temp: weatherStats.maxTemp,
      min_temp: weatherStats.minTemp,
      season: getSeason(analysisDate),
      nearest_region: String(nearestRegion),
      is_holiday: holidayFeatures.isHoliday,
      is_weekend: holidayFeatures.isWeekend,
      days_to_next_holiday: holidayFeatures.daysToNextHoliday,
      is_holiday_week: holidayFeatures.isHolidayWeek,
    };

    try {
      const mlResponse = await fetch(`${ML_SERVER_URL}/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(predictRequest),
      });

      if (!mlResponse.ok) {
        throw new Error('ML 서버 응답 오류');
      }

      const mlResult = await mlResponse.json();

      // 규칙 기반 예상값 계산 (비교용)
      const ruleBasedEstimate = Math.max(0, avgInterval - daysSinceCharge);

      return NextResponse.json({
        ...mlResult,
        customer: {
          device_id: customer.device_id,
          cust_nm: customer.cust_nm,
        },
        analysisData: {
          currentRemain,
          daysSinceCharge,
          avgInterval,
          totalCharges: chargeEvents.length,
          nearestRegion,
          regionDistance,
          // 디버깅용 추가 정보
          ruleBasedEstimate: Math.round(ruleBasedEstimate * 10) / 10,
          analysisDateUsed: endDate,
          lastChargeDate: chargeEvents.length > 0
            ? chargeEvents[chargeEvents.length - 1].datetime.toISOString().split('T')[0]
            : null,
        },
      });
    } catch (mlError) {
      // ML 서버 연결 실패 시 규칙 기반 예측
      console.warn('ML 서버 연결 실패, 규칙 기반 예측 사용');
      return NextResponse.json(
        getRuleBasedPrediction('ML 서버 연결 실패로 규칙 기반 예측을 사용했습니다.')
      );
    }
  } catch (error) {
    console.error('예측 오류:', error);
    return NextResponse.json(
      { error: '예측 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
