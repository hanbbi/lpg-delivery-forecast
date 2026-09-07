import { NextRequest, NextResponse } from 'next/server';
import { getWeather, getWeatherStats } from '@/lib/data';

// GET /api/weather?sigungu_id=1&startDate=2024-01-01&endDate=2024-12-31
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const sigunguId = searchParams.get('sigungu_id');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!sigunguId) {
      return NextResponse.json(
        { error: 'sigungu_id는 필수입니다.' },
        { status: 400 }
      );
    }

    // 기간별 평균 기온 조회
    if (startDate && endDate) {
      const stats = getWeatherStats(parseInt(sigunguId), startDate, endDate);
      return NextResponse.json(stats);
    }

    // 특정 지역의 전체 날씨 데이터
    const weather = getWeather().filter(w => w.sigungu_id === parseInt(sigunguId));
    return NextResponse.json(weather);
  } catch (error) {
    console.error('날씨 조회 오류:', error);
    return NextResponse.json(
      { error: '날씨 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
