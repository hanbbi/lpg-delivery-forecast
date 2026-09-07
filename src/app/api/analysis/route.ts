import { NextRequest, NextResponse } from 'next/server';
import {
  getCustomerByDeviceId,
  getHistoryByDeviceId,
  findNearestRegion,
  getWeatherStats,
} from '@/lib/data';
import { getSeason, calculateStd } from '@/lib/utils';

interface AnalysisResult {
  deviceId: string;
  custNm: string;
  success: boolean;
  message?: string;
  chargeEvents: { datetime: Date; remainBefore: number }[];
  intervals: number[];
  remainsBeforeCharge: number[];
  avgInterval: number;
  stdInterval: number;
  avgRemain: number;
  minRemain: number;
  totalCharges: number;
  daysSinceLastCharge: number;  // 분석 기준일 기준 마지막 충전 후 경과일
  analysisEndDate: string;      // 분석 기준일
  weatherData: {
    nearestRegion: number;
    distance: number;
    avgTemp: number;
    maxTemp: number;
    minTemp: number;
    season: number;
  } | null;
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

// 충전 간격 계산 (일 단위)
function calculateIntervals(chargeEvents: { datetime: Date }[]): number[] {
  const intervals: number[] = [];

  for (let i = 1; i < chargeEvents.length; i++) {
    const prev = chargeEvents[i - 1].datetime;
    const curr = chargeEvents[i].datetime;
    const diffDays = Math.round(
      (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24)
    );
    intervals.push(diffDays);
  }

  return intervals;
}

// GET /api/analysis?device_id=xxx&startDate=2024-01-01&endDate=2024-12-31
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const deviceId = searchParams.get('device_id');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!deviceId || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'device_id, startDate, endDate는 필수입니다.' },
        { status: 400 }
      );
    }

    // 1. 거래처 정보 조회
    const customer = getCustomerByDeviceId(deviceId);

    if (!customer) {
      return NextResponse.json(
        { error: '거래처를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 2. 이력 데이터 조회
    const historyRows = getHistoryByDeviceId(deviceId, startDate, endDate);
    console.log(`[분석] device_id=${deviceId}, 이력 데이터 ${historyRows.length}건`);

    // 충전 데이터 샘플 확인
    const chargeDataSample = historyRows.filter(h => h.isCharge === 'Y').slice(0, 3);
    console.log(`[분석] isCharge='Y' 샘플:`, JSON.stringify(chargeDataSample));

    if (historyRows.length === 0) {
      return NextResponse.json({
        results: [
          {
            deviceId,
            custNm: customer.cust_nm,
            success: false,
            message: '이력 데이터가 없습니다.',
          },
        ],
      });
    }

    // 3. 가장 가까운 지역 찾기
    const lat = parseFloat(customer.latitude) || 37.5665;
    const lon = parseFloat(customer.longitude) || 126.978;
    const { sigungu_id: nearestRegion, distance: regionDistance } = findNearestRegion(lat, lon);

    // 4. 충전 이벤트 감지
    const chargeEvents = detectChargeEvents(historyRows);
    const intervals = calculateIntervals(chargeEvents);
    const remainsBeforeCharge = chargeEvents.map((e) => e.remainBefore);

    // 5. 통계 계산
    const avgInterval =
      intervals.length > 0
        ? intervals.reduce((a, b) => a + b, 0) / intervals.length
        : 0;
    const stdInterval = calculateStd(intervals);
    const avgRemain =
      remainsBeforeCharge.length > 0
        ? remainsBeforeCharge.reduce((a, b) => a + b, 0) / remainsBeforeCharge.length
        : 0;
    const minRemain =
      remainsBeforeCharge.length > 0 ? Math.min(...remainsBeforeCharge) : 0;

    // 6. 날씨 데이터 조회
    const weatherStats = getWeatherStats(nearestRegion, startDate, endDate);
    const lastDate = new Date(endDate);

    // 7. 마지막 충전 후 경과일 계산 (분석 기준일 기준)
    let daysSinceLastCharge = 0;
    if (chargeEvents.length > 0) {
      const lastChargeDate = chargeEvents[chargeEvents.length - 1].datetime;
      daysSinceLastCharge = Math.round(
        (lastDate.getTime() - lastChargeDate.getTime()) / (1000 * 60 * 60 * 24)
      );
    }

    const result: AnalysisResult = {
      deviceId,
      custNm: customer.cust_nm,
      success: true,
      chargeEvents,
      intervals,
      remainsBeforeCharge,
      avgInterval,
      stdInterval,
      avgRemain,
      minRemain,
      totalCharges: chargeEvents.length,
      daysSinceLastCharge,
      analysisEndDate: endDate,
      weatherData: {
        nearestRegion,
        distance: regionDistance,
        avgTemp: weatherStats.avgTemp,
        maxTemp: weatherStats.maxTemp,
        minTemp: weatherStats.minTemp,
        season: getSeason(lastDate),
      },
    };

    return NextResponse.json({ results: [result] });
  } catch (error) {
    console.error('분석 오류:', error);
    return NextResponse.json(
      { error: '분석 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
