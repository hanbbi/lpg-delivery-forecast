import { NextRequest, NextResponse } from 'next/server';
import { getCustomers, getCustomerByDeviceId } from '@/lib/data';

// GET /api/customers - 전체 거래처 목록 조회
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const deviceId = searchParams.get('device_id');

    if (deviceId) {
      // 단일 거래처 조회
      const customer = getCustomerByDeviceId(deviceId);

      if (!customer) {
        return NextResponse.json(
          { error: '거래처를 찾을 수 없습니다.' },
          { status: 404 }
        );
      }

      return NextResponse.json(customer);
    }

    // 전체 거래처 조회
    const customers = getCustomers();
    return NextResponse.json(customers);
  } catch (error) {
    console.error('거래처 조회 오류:', error);
    return NextResponse.json(
      { error: '거래처 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
