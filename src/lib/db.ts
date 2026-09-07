import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'lpg_ai',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

export default pool;

// 타입 정의
export interface Customer {
  device_id: string;
  cust_id: string;
  cust_nm: string;
  serial_no: string;
  latitude: number;
  longitude: number;
}

export interface History {
  device_id: string;
  remain1?: number;
  remain2?: number;
  remain1_percent?: number;
  remain2_percent?: number;
  tran_dttm: Date;
  isCharge: boolean;
}

export interface Weather {
  sigungu_id: number;
  latitude: number;
  longitude: number;
  weather_dt: Date;
  avg_temp: number;
  max_temp: number;
  min_temp: number;
}

export interface WeatherRegion {
  sigungu_id: number;
  latitude: number;
  longitude: number;
}
