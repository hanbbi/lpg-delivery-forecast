/**
 * 전체 거래처 예측 검증 보고서 엑셀 내보내기
 *
 * 실행: node scripts/export-prediction-report.mjs
 */

import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '..', 'data');
const OUTPUT_FILE = path.join(__dirname, '..', 'prediction_report.xlsx');

const START_DATE = '2025-08-01';
const END_DATE = '2026-01-24';

// ============================================
// 유틸리티 함수들
// ============================================
function loadJsonFile(filename) {
  const filepath = path.join(DATA_DIR, filename);
  const data = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
  return data.rows || [];
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 +
    Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) *
    Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function calculateStd(values) {
  if (values.length < 2) return 0;
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(values.reduce((s, v) => s + (v - avg)**2, 0) / values.length);
}

function getSeason(date) {
  const m = date.getMonth() + 1;
  if (m >= 3 && m <= 5) return '봄';
  if (m >= 6 && m <= 8) return '여름';
  if (m >= 9 && m <= 11) return '가을';
  return '겨울';
}

function formatDate(date) {
  // 로컬 시간 기준 YYYY-MM-DD (타임존 밀림 방지)
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// 날짜 문자열을 로컬 Date로 파싱 (타임존 밀림 방지)
function parseDate(str) {
  // "2025-08-05 00:00:00" → 로컬 시간으로 날짜만 추출
  const dateStr = str.split(' ')[0]; // "2025-08-05"
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

// 이력 데이터 정제 (잔량 0 등 이상값 제거)
function cleanHistory(history) {
  return history.filter(h => {
    const remain = parseFloat(h.remain1_percent) || 0;
    return remain > 0;
  });
}

// 충전 이벤트 감지 (가짜 충전, 연속 충전 필터링)
function detectChargeEvents(history) {
  const cleaned = cleanHistory(history);
  const rawEvents = [];
  for (let i = 1; i < cleaned.length; i++) {
    const prev = cleaned[i - 1];
    const curr = cleaned[i];
    const prevRemain = parseFloat(prev.remain1_percent) || 0;
    const currRemain = parseFloat(curr.remain1_percent) || 0;
    const diff = currRemain - prevRemain;
    // isCharge='Y'이면서 잔량 10% 이상 증가한 경우만 충전
    if (curr.isCharge === 'Y' && diff >= 10) {
      rawEvents.push({
        datetime: parseDate(curr.tran_dttm),
        remainBefore: prevRemain,
        remainAfter: currRemain,
      });
    }
    // isCharge 아닌데 잔량 30% 이상 증가
    else if (curr.isCharge !== 'Y' && diff > 30) {
      rawEvents.push({
        datetime: parseDate(curr.tran_dttm),
        remainBefore: prevRemain,
        remainAfter: currRemain,
      });
    }
  }
  if (rawEvents.length < 2) return rawEvents;
  const filtered = [rawEvents[0]];
  for (let i = 1; i < rawEvents.length; i++) {
    const prev = filtered[filtered.length - 1];
    const curr = rawEvents[i];
    const daysDiff = Math.round((curr.datetime.getTime() - prev.datetime.getTime()) / 86400000);
    if (daysDiff > 2) {
      filtered.push(curr);
    } else if (curr.remainAfter > prev.remainAfter) {
      filtered[filtered.length - 1].remainAfter = curr.remainAfter;
    }
  }
  return filtered;
}

function calculateIntervals(events) {
  const intervals = [];
  for (let i = 1; i < events.length; i++) {
    const diff = Math.round((events[i].datetime.getTime() - events[i-1].datetime.getTime()) / 86400000);
    if (diff > 0) intervals.push(diff);
  }
  return intervals;
}

// ============================================
// 메인
// ============================================
async function main() {
  console.log('='.repeat(60));
  console.log('📊 전체 거래처 예측 검증 보고서 생성');
  console.log(`📅 기간: ${START_DATE} ~ ${END_DATE}`);
  console.log('='.repeat(60));

  // 데이터 로드
  const customers = loadJsonFile('customers.json');
  const historyAll = loadJsonFile('history.json');
  const weatherAll = loadJsonFile('weather.json');
  console.log(`거래처: ${customers.length}개 | 이력: ${historyAll.length}개`);

  // 날씨 지역 정보
  const weatherRegions = {};
  for (const w of weatherAll) {
    if (!weatherRegions[w.sigungu_id]) {
      weatherRegions[w.sigungu_id] = { lat: w.latitude, lon: w.longitude };
    }
  }

  // 거래처별 이력 그룹화 + 필터링 + 정렬
  const historyByDevice = {};
  for (const h of historyAll) {
    if (!historyByDevice[h.device_id]) historyByDevice[h.device_id] = [];
    historyByDevice[h.device_id].push(h);
  }
  for (const did in historyByDevice) {
    historyByDevice[did] = historyByDevice[did]
      .filter(h => {
        const dt = h.tran_dttm.substring(0, 10); // "2025-08-05" 형태로 추출
        return dt >= START_DATE && dt <= END_DATE;
      })
      .sort((a, b) => a.tran_dttm.localeCompare(b.tran_dttm));
  }

  // ============================================
  // Sheet 1: 거래처 요약
  // ============================================
  const summaryRows = [];
  // ============================================
  // Sheet 2: 충전별 예측 검증
  // ============================================
  const verificationRows = [];

  const analysisDate = parseDate(END_DATE);

  for (let ci = 0; ci < customers.length; ci++) {
    const cust = customers[ci];
    const deviceId = cust.device_id;
    const history = historyByDevice[deviceId] || [];
    console.log(`[${ci+1}/${customers.length}] ${cust.cust_nm}`);

    if (history.length < 10) {
      summaryRows.push({ 순번: ci+1, 거래처명: cust.cust_nm, device_id: deviceId, serial_no: cust.serial_no, 비고: '이력 부족' });
      continue;
    }

    const chargeEvents = detectChargeEvents(history);
    if (chargeEvents.length < 3) {
      summaryRows.push({ 순번: ci+1, 거래처명: cust.cust_nm, device_id: deviceId, serial_no: cust.serial_no, 비고: '충전 이력 부족' });
      continue;
    }

    const intervals = calculateIntervals(chargeEvents);
    const remainsBefore = chargeEvents.map(e => e.remainBefore);

    // 전체 통계
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const stdInterval = calculateStd(intervals);
    const avgRemain = remainsBefore.reduce((a, b) => a + b, 0) / remainsBefore.length;
    const minRemain = Math.min(...remainsBefore);

    // 현재 상태 (분석 기준일)
    const lastHistory = history[history.length - 1];
    const currentRemain = parseFloat(lastHistory.remain1_percent) || 0;
    const lastCharge = chargeEvents[chargeEvents.length - 1];
    const daysSinceCharge = Math.round((analysisDate.getTime() - lastCharge.datetime.getTime()) / 86400000);

    // 가장 가까운 지역 + 기온
    const lat = parseFloat(cust.latitude) || 37.5665;
    const lon = parseFloat(cust.longitude) || 126.978;
    let nearestRegion = 1, minDist = Infinity;
    for (const [rid, coords] of Object.entries(weatherRegions)) {
      const dist = calculateDistance(lat, lon, coords.lat, coords.lon);
      if (dist < minDist) { minDist = dist; nearestRegion = parseInt(rid); }
    }

    const recentWeather = weatherAll.filter(w => {
      const dt = String(w.weather_dt).substring(0, 10);
      const weekAgo = formatDate(addDays(analysisDate, -7));
      return w.sigungu_id === nearestRegion && dt >= weekAgo && dt <= END_DATE;
    });
    const avgTemp = recentWeather.length > 0
      ? recentWeather.reduce((s, w) => s + (w.avg_temp || 0), 0) / recentWeather.length : 0;

    // 소비율
    const dailyConsumption = avgInterval > 0 ? (100 - avgRemain) / avgInterval : 10;
    const ruleEstimate = Math.max(0, avgInterval - daysSinceCharge);
    const remainEstimate = dailyConsumption > 0 ? Math.max(0, (currentRemain - avgRemain) / dailyConsumption) : ruleEstimate;
    const predictedDays = Math.round(((ruleEstimate + remainEstimate) / 2) * 10) / 10;
    const predictedDate = formatDate(addDays(analysisDate, Math.round(predictedDays)));

    const isWeekend = (analysisDate.getDay() === 0 || analysisDate.getDay() === 6) ? '예' : '아니오';

    // Sheet 1 행
    summaryRows.push({
      순번: ci + 1,
      거래처명: cust.cust_nm,
      device_id: deviceId,
      serial_no: cust.serial_no,
      현재잔량_퍼센트: r(currentRemain),
      평균충전주기_일: r(avgInterval),
      주기표준편차_일: r(stdInterval),
      총충전횟수: chargeEvents.length,
      마지막충전일: formatDate(lastCharge.datetime),
      충전후경과_일: daysSinceCharge,
      평균충전시작잔량_퍼센트: r(avgRemain),
      최소잔량기록_퍼센트: r(minRemain),
      일일소비율_퍼센트: r(dailyConsumption),
      다음충전예측일: predictedDate,
      예측잔여일: predictedDays,
      평균기온_도: r(avgTemp),
      계절: getSeason(analysisDate),
      주말여부: isWeekend,
    });

    // ============================================
    // Sheet 2: 각 충전 시점에서의 예측 검증
    // ============================================
    // 5번째 충전부터 시작 (최소 통계를 위해)
    for (let j = 4; j < chargeEvents.length; j++) {
      // j번째 충전 직후 시점에서 다음 충전(j+1)을 예측
      const pastIntervals = intervals.slice(0, j);
      const pastRemains = remainsBefore.slice(0, j + 1);

      if (pastIntervals.length < 3) continue;

      const pAvgInterval = pastIntervals.reduce((a, b) => a + b, 0) / pastIntervals.length;
      const pStdInterval = calculateStd(pastIntervals);
      const pAvgRemain = pastRemains.reduce((a, b) => a + b, 0) / pastRemains.length;

      // 예측 기준일: j번째 충전 후 여러 시점에서 예측
      // → j번째 충전 후 중간 시점 (충전 주기의 절반)에서 예측
      const chargeDate = chargeEvents[j].datetime;

      // 다음 충전이 있는 경우
      const hasNextCharge = j + 1 < chargeEvents.length;
      const actualNextChargeDate = hasNextCharge ? chargeEvents[j + 1].datetime : null;
      const actualInterval = hasNextCharge
        ? Math.round((actualNextChargeDate.getTime() - chargeDate.getTime()) / 86400000)
        : null;

      // 충전 후 다양한 시점에서 예측 (3일, 절반, 2/3 시점)
      const checkPoints = [
        { label: '충전 직후', offset: 0 },
        { label: '3일 경과', offset: 3 },
        { label: '절반 경과', offset: Math.round(pAvgInterval / 2) },
        { label: '2/3 경과', offset: Math.round(pAvgInterval * 2 / 3) },
      ];

      for (const cp of checkPoints) {
        const checkDate = addDays(chargeDate, cp.offset);
        if (checkDate > analysisDate) continue;

        // 해당 시점의 잔량 추정 (선형 감소)
        const pDailyConsumption = pAvgInterval > 0 ? (100 - pAvgRemain) / pAvgInterval : 10;
        const estimatedRemain = Math.max(0, 100 - pDailyConsumption * cp.offset);

        // 규칙 기반 예측
        const pRuleEstimate = Math.max(0, pAvgInterval - cp.offset);
        // 잔량 기반 예측
        const pRemainEstimate = pDailyConsumption > 0
          ? Math.max(0, (estimatedRemain - pAvgRemain) / pDailyConsumption) : pRuleEstimate;
        // 종합 예측
        const pPredictedDays = (pRuleEstimate + pRemainEstimate) / 2;
        const pPredictedDate = formatDate(addDays(checkDate, Math.round(pPredictedDays)));

        // 실제 남은 일수
        const actualDaysLeft = actualNextChargeDate
          ? Math.round((actualNextChargeDate.getTime() - checkDate.getTime()) / 86400000)
          : null;

        // 오차
        const error = actualDaysLeft !== null ? Math.round((pPredictedDays - actualDaysLeft) * 10) / 10 : null;

        verificationRows.push({
          거래처명: cust.cust_nm,
          device_id: deviceId,
          충전회차: `${j + 1}회`,
          충전일: formatDate(chargeDate),
          예측시점: cp.label,
          예측기준일: formatDate(checkDate),
          경과일수: cp.offset,
          추정잔량_퍼센트: r(estimatedRemain),
          예측잔여일: r(pPredictedDays),
          예측충전일: pPredictedDate,
          실제충전일: actualNextChargeDate ? formatDate(actualNextChargeDate) : '기간외',
          실제잔여일: actualDaysLeft !== null ? actualDaysLeft : '-',
          오차_일: error !== null ? error : '-',
          적중여부_3일이내: error !== null ? (Math.abs(error) <= 3 ? 'O' : 'X') : '-',
          평균충전주기: r(pAvgInterval),
          평균시작잔량: r(pAvgRemain),
        });
      }
    }
  }

  // ============================================
  // 엑셀 생성
  // ============================================
  console.log('\n📝 엑셀 파일 생성 중...');
  const wb = XLSX.utils.book_new();

  // Sheet 1: 요약
  const ws1 = XLSX.utils.json_to_sheet(summaryRows);
  ws1['!cols'] = [
    { wch: 5 }, { wch: 25 }, { wch: 14 }, { wch: 10 },
    { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 10 },
    { wch: 12 }, { wch: 12 }, { wch: 18 }, { wch: 16 },
    { wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 10 },
    { wch: 6 }, { wch: 8 },
  ];
  XLSX.utils.book_append_sheet(wb, ws1, '거래처별 요약');

  // Sheet 2: 예측 검증
  const ws2 = XLSX.utils.json_to_sheet(verificationRows);
  ws2['!cols'] = [
    { wch: 25 }, { wch: 14 }, { wch: 8 }, { wch: 12 },
    { wch: 10 }, { wch: 12 }, { wch: 8 }, { wch: 14 },
    { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 10 },
    { wch: 8 }, { wch: 14 }, { wch: 12 }, { wch: 12 },
  ];
  XLSX.utils.book_append_sheet(wb, ws2, '예측 검증');

  // Sheet 3: 적중률 요약
  const hitRateRows = [];
  const grouped = {};
  for (const row of verificationRows) {
    if (row['적중여부_3일이내'] === '-') continue;
    if (!grouped[row.device_id]) grouped[row.device_id] = { name: row.거래처명, total: 0, hit: 0 };
    grouped[row.device_id].total++;
    if (row['적중여부_3일이내'] === 'O') grouped[row.device_id].hit++;
  }

  let totalAll = 0, hitAll = 0;
  for (const [did, g] of Object.entries(grouped)) {
    const rate = g.total > 0 ? Math.round(g.hit / g.total * 1000) / 10 : 0;
    hitRateRows.push({
      거래처명: g.name,
      device_id: did,
      전체예측수: g.total,
      적중수_3일이내: g.hit,
      적중률_퍼센트: rate,
    });
    totalAll += g.total;
    hitAll += g.hit;
  }
  hitRateRows.push({
    거래처명: '★ 전체 평균',
    device_id: '-',
    전체예측수: totalAll,
    적중수_3일이내: hitAll,
    적중률_퍼센트: totalAll > 0 ? Math.round(hitAll / totalAll * 1000) / 10 : 0,
  });

  const ws3 = XLSX.utils.json_to_sheet(hitRateRows);
  ws3['!cols'] = [{ wch: 25 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, ws3, '적중률 요약');

  XLSX.writeFile(wb, OUTPUT_FILE);

  console.log(`\n✅ 엑셀 파일 저장: ${OUTPUT_FILE}`);
  console.log(`📊 거래처 요약: ${summaryRows.length}개`);
  console.log(`📊 예측 검증: ${verificationRows.length}건`);
  console.log(`📊 전체 적중률 (±3일): ${totalAll > 0 ? (hitAll/totalAll*100).toFixed(1) : 0}%`);
  console.log('='.repeat(60));
}

function r(v) { return Math.round(v * 10) / 10; }

main().catch(console.error);
