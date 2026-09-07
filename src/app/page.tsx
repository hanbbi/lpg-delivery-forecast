'use client';

import { useState, useEffect } from 'react';
import { Customer, PredictResult, AnalysisResult } from '@/types';
import CustomerSelect from '@/components/CustomerSelect';
import PredictionCard from '@/components/PredictionCard';
import AnalysisChart from '@/components/AnalysisChart';
import HistoryChart from '@/components/HistoryChart';

// 오늘 기준 날짜 계산 함수
function getDateRange() {
  const today = new Date();
  const sixMonthsAgo = new Date(today);
  sixMonthsAgo.setMonth(today.getMonth() - 6);

  const formatDate = (d: Date) => d.toISOString().split('T')[0];

  return {
    minDate: formatDate(sixMonthsAgo),
    maxDate: formatDate(today),
  };
}

const { minDate: MIN_DATE, maxDate: MAX_DATE } = getDateRange();

export default function Home() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [prediction, setPrediction] = useState<PredictResult | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 날짜 범위 상태 (기본값: 최근 6개월)
  const [startDate, setStartDate] = useState<string>(MIN_DATE);
  const [endDate, setEndDate] = useState<string>(MAX_DATE);

  // 거래처 목록 로드
  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      const response = await fetch('/api/customers');
      const data = await response.json();
      setCustomers(data);
    } catch (err) {
      setError('거래처 목록을 불러오는데 실패했습니다.');
    }
  };

  // 분석 데이터 로드 함수
  const loadAnalysisData = async (customer: Customer, start: string, end: string) => {
    setLoading(true);
    setError(null);
    setPrediction(null);
    setAnalysis(null);

    try {
      const [analysisRes, predictRes] = await Promise.all([
        fetch(
          `/api/analysis?device_id=${customer.device_id}&startDate=${start}&endDate=${end}`
        ),
        fetch('/api/predict', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            device_id: customer.device_id,
            startDate: start,
            endDate: end,
          }),
        }),
      ]);

      const analysisData = await analysisRes.json();
      const predictData = await predictRes.json();

      if (analysisData.results && analysisData.results[0]) {
        setAnalysis(analysisData.results[0]);
      }

      if (predictData.error) {
        setError(predictData.error);
      } else {
        setPrediction(predictData);
      }
    } catch (err) {
      setError('데이터를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 거래처 선택 시 예측 및 분석 수행
  const handleCustomerSelect = async (customer: Customer) => {
    setSelectedCustomer(customer);
    await loadAnalysisData(customer, startDate, endDate);
  };

  // 날짜 변경 핸들러
  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newStart = e.target.value;
    setStartDate(newStart);
  };

  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newEnd = e.target.value;
    setEndDate(newEnd);
  };

  // 분석 버튼 클릭 시 재분석
  const handleAnalyze = async () => {
    if (selectedCustomer) {
      await loadAnalysisData(selectedCustomer, startDate, endDate);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* 헤더 */}
      <header className="bg-blue-600 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold">AI 기반 LPG 배송 예측 시스템</h1>
          <p className="text-blue-100 mt-1">
            기온 데이터 기반 충전 주기 예측
          </p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* 거래처 선택 및 날짜 범위 */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">거래처 선택</h2>
          <CustomerSelect
            customers={customers}
            selectedCustomer={selectedCustomer}
            onSelect={handleCustomerSelect}
          />

          {/* 날짜 범위 선택 */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <h3 className="text-md font-medium text-gray-700 mb-3">분석 기간 선택</h3>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <label htmlFor="startDate" className="text-sm text-gray-600">
                  시작일:
                </label>
                <input
                  type="date"
                  id="startDate"
                  value={startDate}
                  min={MIN_DATE}
                  max={endDate}
                  onChange={handleStartDateChange}
                  className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <label htmlFor="endDate" className="text-sm text-gray-600">
                  종료일:
                </label>
                <input
                  type="date"
                  id="endDate"
                  value={endDate}
                  min={startDate}
                  max={MAX_DATE}
                  onChange={handleEndDateChange}
                  className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <button
                onClick={handleAnalyze}
                disabled={!selectedCustomer || loading}
                className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? '분석 중...' : '분석하기'}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              * 오늘 기준 최근 6개월 데이터만 조회 가능합니다.
            </p>
          </div>
        </div>

        {/* 로딩 */}
        {loading && (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">분석 중...</p>
          </div>
        )}

        {/* 에러 */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-600">{error}</p>
          </div>
        )}

        {/* 예측 결과 */}
        {prediction && !loading && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <PredictionCard prediction={prediction} />
            {analysis && <AnalysisChart analysis={analysis} />}
          </div>
        )}

        {/* 이력 차트 */}
        {analysis && analysis.success && !loading && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">충전 이력</h2>
            <HistoryChart analysis={analysis} />
          </div>
        )}

        {/* 선택 안내 */}
        {!selectedCustomer && !loading && (
          <div className="bg-white rounded-lg shadow p-12 text-center text-gray-500">
            <svg
              className="w-16 h-16 mx-auto mb-4 text-gray-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
            <p>거래처를 선택하면 AI 예측 결과를 확인할 수 있습니다.</p>
          </div>
        )}
      </main>
    </div>
  );
}
