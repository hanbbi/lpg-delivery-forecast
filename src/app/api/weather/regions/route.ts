import { NextRequest, NextResponse } from 'next/server';
import { getWeatherRegions, findNearestRegion } from '@/lib/data';

// GET /api/weather/regions - 모든 날씨 지역 정보 조회
// GET /api/weather/regions?latitude=37.5&longitude=127.0 - 가장 가까운 지역 찾기
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const latitude = searchParams.get('latitude');
    const longitude = searchParams.get('longitude');

    // 가장 가까운 지역 찾기
    if (latitude && longitude) {
      const result = findNearestRegion(parseFloat(latitude), parseFloat(longitude));
      return NextResponse.json(result);
    }

    // 전체 지역 목록
    const regions = getWeatherRegions();
    return NextResponse.json(regions);
  } catch (error) {
    console.error('지역 조회 오류:', error);
    return NextResponse.json(
      { error: '지역 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
