// 거래처
export interface Customer {
  device_id: string;
  cust_id: string;
  cust_nm: string;
  serial_no: string;
  latitude: number;
  longitude: number;
}

// 이력
export interface History {
  device_id: string;
  remain1?: number;
  remain2?: number;
  remain1_percent?: number;
  remain2_percent?: number;
  tran_dttm: string;
  isCharge: boolean;
}

// 날씨
export interface Weather {
  sigungu_id: number;
  latitude: number;
  longitude: number;
  weather_dt: string;
  avg_temp: number;
  max_temp: number;
  min_temp: number;
}

// 분석 결과
export interface AnalysisResult {
  deviceId: string;
  custNm: string;
  success: boolean;
  chargeEvents: { datetime: string; remainBefore: number }[];
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

// 예측 결과
export interface PredictResult {
  days_until_charge: number;
  confidence: number;
  model_type: string;
  suggestion: string;
  weather_impact?: string;
  avg_temp?: number;
  season?: number;
  // 휴일/주말 관련 필드 (개별 날짜 체크)
  holiday_weekend_impact?: string;
  is_holiday?: number;
  is_weekend?: number;
  days_to_next_holiday?: number;
  is_holiday_week?: number;
  customer: {
    device_id: string;
    cust_nm: string;
  };
  analysisData: {
    currentRemain: number;
    daysSinceCharge: number;
    avgInterval: number;
    totalCharges: number;
    nearestRegion: number;
    regionDistance: number;
    // 디버깅용
    ruleBasedEstimate?: number;
    analysisDateUsed?: string;
    lastChargeDate?: string;
  };
  warning?: string;
}
