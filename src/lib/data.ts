import fs from 'fs';
import path from 'path';

// 데이터 파일 경로
const DATA_DIR = path.join(process.cwd(), 'data');

// 타입 정의
export interface Customer {
  cust_id: string;
  cust_nm: string;
  device_id: string;
  serial_no: string;
  latitude: string;
  longitude: string;
}

export interface History {
  device_id: string;
  cust_id: string;
  remain1?: string;
  remain2?: string | null;
  remain1_percent?: string;
  remain2_percent?: string | null;
  tran_dttm: string;
  isCharge: string;
}

export interface Weather {
  sigungu_id: number;
  latitude: string;
  longitude: string;
  weather_dt: string;
  avg_temp: number;
  max_temp: number;
  min_temp: number;
}

// JSON 파일 로드 함수
function loadJsonFile<T>(filename: string): T[] {
  const filePath = path.join(DATA_DIR, filename);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  return data.rows || [];
}

// 캐시된 데이터
let customersCache: Customer[] | null = null;
let historyCache: History[] | null = null;
let weatherCache: Weather[] | null = null;

// 거래처 데이터 로드
export function getCustomers(): Customer[] {
  if (!customersCache) {
    customersCache = loadJsonFile<Customer>('customers.json');
  }
  return customersCache;
}

// 이력 데이터 로드
export function getHistory(): History[] {
  if (!historyCache) {
    historyCache = loadJsonFile<History>('history.json');
  }
  return historyCache;
}

// 날씨 데이터 로드
export function getWeather(): Weather[] {
  if (!weatherCache) {
    weatherCache = loadJsonFile<Weather>('weather.json');
  }
  return weatherCache;
}

// 거래처 조회 (device_id로)
export function getCustomerByDeviceId(deviceId: string): Customer | undefined {
  return getCustomers().find(c => c.device_id === deviceId);
}

// 이력 조회 (device_id, 날짜 범위)
export function getHistoryByDeviceId(
  deviceId: string,
  startDate?: string,
  endDate?: string
): History[] {
  let history = getHistory().filter(h => h.device_id === deviceId);

  if (startDate) {
    history = history.filter(h => h.tran_dttm >= startDate);
  }
  if (endDate) {
    history = history.filter(h => h.tran_dttm <= endDate + ' 23:59:59');
  }

  return history.sort((a, b) => a.tran_dttm.localeCompare(b.tran_dttm));
}

// 가장 가까운 지역 찾기 (Haversine 공식)
export function findNearestRegion(lat: number, lon: number): { sigungu_id: number; distance: number } {
  const weather = getWeather();
  const regions = new Map<number, { lat: number; lon: number }>();

  // 지역별 좌표 수집
  weather.forEach(w => {
    if (!regions.has(w.sigungu_id)) {
      regions.set(w.sigungu_id, {
        lat: parseFloat(w.latitude),
        lon: parseFloat(w.longitude)
      });
    }
  });

  let nearestRegion = 1;
  let minDistance = Infinity;

  regions.forEach((coords, sigunguId) => {
    const distance = calculateDistance(lat, lon, coords.lat, coords.lon);
    if (distance < minDistance) {
      minDistance = distance;
      nearestRegion = sigunguId;
    }
  });

  return { sigungu_id: nearestRegion, distance: Math.round(minDistance * 10) / 10 };
}

// 거리 계산 (Haversine)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// 기간별 날씨 통계
export function getWeatherStats(
  sigunguId: number,
  startDate: string,
  endDate: string
): { avgTemp: number; maxTemp: number; minTemp: number } {
  const weather = getWeather().filter(w =>
    w.sigungu_id === sigunguId &&
    w.weather_dt >= startDate &&
    w.weather_dt <= endDate
  );

  if (weather.length === 0) {
    return { avgTemp: 15, maxTemp: 20, minTemp: 10 };
  }

  const avgTemp = weather.reduce((sum, w) => sum + w.avg_temp, 0) / weather.length;
  const maxTemp = Math.max(...weather.map(w => w.max_temp));
  const minTemp = Math.min(...weather.map(w => w.min_temp));

  return { avgTemp, maxTemp, minTemp };
}

// 날씨 지역 목록
export function getWeatherRegions(): { sigungu_id: number; latitude: string; longitude: string }[] {
  const weather = getWeather();
  const regionsMap = new Map<number, { sigungu_id: number; latitude: string; longitude: string }>();

  weather.forEach(w => {
    if (!regionsMap.has(w.sigungu_id)) {
      regionsMap.set(w.sigungu_id, {
        sigungu_id: w.sigungu_id,
        latitude: w.latitude,
        longitude: w.longitude
      });
    }
  });

  return Array.from(regionsMap.values()).sort((a, b) => a.sigungu_id - b.sigungu_id);
}
