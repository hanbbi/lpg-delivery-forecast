'use client';

import { AnalysisResult } from '@/types';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

interface Props {
  analysis: AnalysisResult;
}

export default function AnalysisChart({ analysis }: Props) {
  // 충전 간격 데이터 준비
  const intervalData = analysis.intervals.map((interval, index) => ({
    name: `${index + 1}회`,
    interval,
    color: interval > analysis.avgInterval ? '#ef4444' : '#22c55e',
  }));

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <span className="text-2xl">📊</span>
        충전 패턴 분석
      </h2>

      {/* 통계 요약 */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-blue-50 p-4 rounded-lg">
          <p className="text-sm text-blue-600">평균 충전 주기</p>
          <p className="text-2xl font-bold text-blue-900">
            {analysis.avgInterval.toFixed(1)}일
          </p>
        </div>
        <div className="bg-purple-50 p-4 rounded-lg">
          <p className="text-sm text-purple-600">주기 표준편차</p>
          <p className="text-2xl font-bold text-purple-900">
            ±{analysis.stdInterval.toFixed(1)}일
          </p>
        </div>
        <div className="bg-green-50 p-4 rounded-lg">
          <p className="text-sm text-green-600">평균 충전 시작 잔량</p>
          <p className="text-2xl font-bold text-green-900">
            {analysis.avgRemain.toFixed(1)}%
          </p>
        </div>
        <div className="bg-orange-50 p-4 rounded-lg">
          <p className="text-sm text-orange-600">최소 잔량 기록</p>
          <p className="text-2xl font-bold text-orange-900">
            {analysis.minRemain.toFixed(1)}%
          </p>
        </div>
      </div>

      {/* 충전 간격 차트 */}
      {intervalData.length > 0 && (
        <div className="mb-6">
          <p className="text-sm font-medium text-gray-600 mb-2">충전 간격 추이</p>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={intervalData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value) => [`${value}일`, '충전 간격']}
                />
                <Bar dataKey="interval" radius={[4, 4, 0, 0]}>
                  {intervalData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-gray-500 text-center mt-1">
            🟢 평균 이하 | 🔴 평균 초과
          </p>
        </div>
      )}

      {/* 충전 횟수 */}
      <div className="mt-4 text-center text-sm text-gray-500">
        총 <span className="font-semibold">{analysis.totalCharges}</span>회 충전
        기록 분석
      </div>
    </div>
  );
}
