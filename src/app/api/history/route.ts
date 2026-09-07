import { NextRequest, NextResponse } from 'next/server';
import { getHistoryByDeviceId } from '@/lib/data';

// GET /api/history?device_id=xxx&startDate=2024-01-01&endDate=2024-12-31
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const deviceId = searchParams.get('device_id');
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;

    if (!deviceId) {
      return NextResponse.json(
        { error: 'device_id는 필수입니다.' },
        { status: 400 }
      );
    }

    const history = getHistoryByDeviceId(deviceId, startDate, endDate);

    // isCharge를 boolean으로 변환, remain1/remain2 필드 지원
    const result = history.map(row => ({
      ...row,
      remain1: parseFloat(row.remain1 || row.remain1_percent || '0') || 0,
      remain2: (row.remain2 || row.remain2_percent) ? parseFloat(row.remain2 || row.remain2_percent || '0') : null,
      isCharge: row.isCharge === 'Y'
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error('이력 조회 오류:', error);
    return NextResponse.json(
      { error: '이력 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
