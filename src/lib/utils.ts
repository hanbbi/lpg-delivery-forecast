// 지역 코드 → 지역명 매핑
export const REGION_NAMES: { [key: string]: string } = {
  '1': '서울',
  '2': '인천',
  '3': '충북',
  '4': '충남',
  '5': '경북',
  '6': '경남',
  '7': '경기',
  '8': '강원',
  '9': '제주',
  '10': '세종',
  '11': '부산',
  '12': '대전',
  '13': '대구',
  '14': '광주',
  '15': '울산',
  '16': '전북',
  '17': '전남',
};

// 지역 코드로 지역명 가져오기
export function getRegionName(regionCode: string | number): string {
  return REGION_NAMES[String(regionCode)] || `지역 ${regionCode}`;
}

// 두 좌표 간 거리 계산 (Haversine 공식, km)
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // 지구 반경 (km)

  const lat1Rad = (lat1 * Math.PI) / 180;
  const lat2Rad = (lat2 * Math.PI) / 180;
  const deltaLat = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1Rad) *
      Math.cos(lat2Rad) *
      Math.sin(deltaLon / 2) *
      Math.sin(deltaLon / 2);
  const c = 2 * Math.asin(Math.sqrt(a));

  return R * c;
}

// 날짜로부터 계절 계산 (1: 봄, 2: 여름, 3: 가을, 4: 겨울)
export function getSeason(date: Date): number {
  const month = date.getMonth() + 1;

  if (month >= 3 && month <= 5) return 1; // 봄
  if (month >= 6 && month <= 8) return 2; // 여름
  if (month >= 9 && month <= 11) return 3; // 가을
  return 4; // 겨울
}

// 계절 이름
export function getSeasonName(season: number): string {
  const names = ['', '봄', '여름', '가을', '겨울'];
  return names[season] || '';
}

// 표준편차 계산
export function calculateStd(values: number[]): number {
  if (values.length < 2) return 0;
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / values.length;
  return Math.sqrt(variance);
}

// 날짜 포맷 (YYYY-MM-DD)
export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

// 충전 이벤트 감지 (잔량이 급증하면 충전으로 판단)
export function detectChargeEvents(
  history: { remain1?: number; remain1_percent?: number; tran_dttm: Date; isCharge?: boolean }[]
): { datetime: Date; remainBefore: number }[] {
  const chargeEvents: { datetime: Date; remainBefore: number }[] = [];

  for (let i = 1; i < history.length; i++) {
    const prev = history[i - 1];
    const curr = history[i];
    // remain1 또는 remain1_percent 필드 지원
    const prevRemain = prev.remain1 ?? prev.remain1_percent ?? 0;
    const currRemain = curr.remain1 ?? curr.remain1_percent ?? 0;

    // isCharge 플래그가 있으면 사용
    if (curr.isCharge) {
      chargeEvents.push({
        datetime: new Date(curr.tran_dttm),
        remainBefore: prevRemain,
      });
    }
    // 잔량이 30% 이상 증가하면 충전으로 판단
    else if (currRemain - prevRemain > 30) {
      chargeEvents.push({
        datetime: new Date(curr.tran_dttm),
        remainBefore: prevRemain,
      });
    }
  }

  return chargeEvents;
}

// 충전 간격 계산 (일 단위)
export function calculateIntervals(
  chargeEvents: { datetime: Date }[]
): number[] {
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

// 한국 공휴일 목록 생성 (date-holidays 대신 직접 구현)
function getKoreanHolidays(year: number): Set<string> {
  const holidays = new Set<string>();

  // 양력 고정 공휴일
  const fixedHolidays = [
    `${year}-01-01`, // 신정
    `${year}-03-01`, // 삼일절
    `${year}-05-05`, // 어린이날
    `${year}-06-06`, // 현충일
    `${year}-08-15`, // 광복절
    `${year}-10-03`, // 개천절
    `${year}-10-09`, // 한글날
    `${year}-12-25`, // 성탄절
  ];

  fixedHolidays.forEach((d) => holidays.add(d));

  // 음력 공휴일 (설날, 석가탄신일, 추석) - 년도별 미리 계산된 날짜
  const lunarHolidays: { [key: number]: string[] } = {
    2024: [
      '2024-02-09', '2024-02-10', '2024-02-11', // 설날 연휴
      '2024-05-15', // 석가탄신일
      '2024-09-16', '2024-09-17', '2024-09-18', // 추석 연휴
    ],
    2025: [
      '2025-01-28', '2025-01-29', '2025-01-30', // 설날 연휴
      '2025-05-05', // 석가탄신일 (어린이날과 겹침)
      '2025-10-05', '2025-10-06', '2025-10-07', // 추석 연휴
    ],
    2026: [
      '2026-02-16', '2026-02-17', '2026-02-18', // 설날 연휴
      '2026-05-24', // 석가탄신일
      '2026-09-24', '2026-09-25', '2026-09-26', // 추석 연휴
    ],
    2027: [
      '2027-02-05', '2027-02-06', '2027-02-07', // 설날 연휴
      '2027-05-13', // 석가탄신일
      '2027-09-14', '2027-09-15', '2027-09-16', // 추석 연휴
    ],
  };

  if (lunarHolidays[year]) {
    lunarHolidays[year].forEach((d) => holidays.add(d));
  }

  return holidays;
}

// 휴일/주말 특성 계산 (개별 날짜 체크)
export interface HolidayFeatures {
  isHoliday: number;
  isWeekend: number;
  daysToNextHoliday: number;
  isHolidayWeek: number;
}

export function getHolidayFeatures(targetDate: Date): HolidayFeatures {
  // 관련 연도의 공휴일 가져오기
  const years = new Set<number>();
  years.add(targetDate.getFullYear());
  years.add(targetDate.getFullYear() + 1);

  const allHolidays = new Set<string>();
  years.forEach((year) => {
    const yearHolidays = getKoreanHolidays(year);
    yearHolidays.forEach((h) => allHolidays.add(h));
  });

  // 1. 해당 날짜가 공휴일인지 체크
  const targetDateStr = targetDate.toISOString().split('T')[0];
  const isHoliday = allHolidays.has(targetDateStr) ? 1 : 0;

  // 2. 해당 날짜가 주말인지 체크 (토요일=6, 일요일=0)
  const dayOfWeek = targetDate.getDay();
  const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6) ? 1 : 0;

  // 3. 다음 공휴일까지 남은 일수 계산
  let daysToNextHoliday = 0;
  const checkDate = new Date(targetDate);
  const maxDays = 100;
  while (daysToNextHoliday < maxDays) {
    checkDate.setDate(checkDate.getDate() + 1);
    daysToNextHoliday++;
    const dateStr = checkDate.toISOString().split('T')[0];
    if (allHolidays.has(dateStr)) {
      break;
    }
  }

  // 4. 해당 주에 공휴일 있는지 확인
  const weekStart = new Date(targetDate);
  weekStart.setDate(targetDate.getDate() - ((dayOfWeek + 6) % 7)); // 월요일로 이동
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6); // 일요일

  let isHolidayWeek = 0;
  const checkDay = new Date(weekStart);
  while (checkDay <= weekEnd) {
    const dateStr = checkDay.toISOString().split('T')[0];
    if (allHolidays.has(dateStr)) {
      isHolidayWeek = 1;
      break;
    }
    checkDay.setDate(checkDay.getDate() + 1);
  }

  return {
    isHoliday,
    isWeekend,
    daysToNextHoliday,
    isHolidayWeek,
  };
}
