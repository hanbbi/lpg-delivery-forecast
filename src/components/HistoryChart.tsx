'use client';

import { AnalysisResult } from '@/types';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { format } from 'date-fns';

interface Props {
  analysis: AnalysisResult;
}

export default function HistoryChart({ analysis }: Props) {
  // 충전 이벤트 데이터 준비
  const chargeData = analysis.chargeEvents.map((event, index) => ({
    date: format(new Date(event.datetime), 'MM/dd'),
    fullDate: format(new Date(event.datetime), 'yyyy-MM-dd'),
    remainBefore: event.remainBefore,
    interval: index > 0 ? analysis.intervals[index - 1] : null,
  }));

  // 잔량 데이터 준비
  const remainData = analysis.remainsBeforeCharge.map((remain, index) => ({
    name: `${index + 1}회`,
    remain,
    color: remain < 15 ? '#ef4444' : remain < 25 ? '#f59e0b' : '#22c55e',
  }));

  return (
    <div className="space-y-6">
      {/* 충전 시점 잔량 추이 */}
      <div>
        <p className="text-sm font-medium text-gray-600 mb-3">
          충전 시점 잔량 추이
        </p>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chargeData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 11 }}
                tickFormatter={(value) => `${value}%`}
              />
              <Tooltip
                formatter={(value) => [`${Number(value).toFixed(1)}%`, '잔량']}
                labelFormatter={(label) => `날짜: ${label}`}
              />
              <ReferenceLine
                y={analysis.avgRemain}
                stroke="#6366f1"
                strokeDasharray="5 5"
                label={{
                  value: `평균 ${analysis.avgRemain.toFixed(1)}%`,
                  fill: '#6366f1',
                  fontSize: 11,
                }}
              />
              <ReferenceLine
                y={20}
                stroke="#ef4444"
                strokeDasharray="3 3"
                label={{
                  value: '위험 수준 20%',
                  fill: '#ef4444',
                  fontSize: 11,
                }}
              />
              <Line
                type="monotone"
                dataKey="remainBefore"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ r: 4, fill: '#3b82f6' }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 충전 이력 테이블 */}
      <div>
        <p className="text-sm font-medium text-gray-600 mb-3">충전 이력 상세</p>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  회차
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  충전일
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  충전 전 잔량
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  이전 충전과의 간격
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {chargeData.slice(-10).reverse().map((event, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {chargeData.length - index}회
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {event.fullDate}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        event.remainBefore < 15
                          ? 'bg-red-100 text-red-700'
                          : event.remainBefore < 25
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-green-100 text-green-700'
                      }`}
                    >
                      {event.remainBefore.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {event.interval !== null ? `${event.interval}일` : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {chargeData.length > 10 && (
          <p className="text-xs text-gray-500 text-center mt-2">
            최근 10건만 표시됩니다. (전체 {chargeData.length}건)
          </p>
        )}
      </div>
    </div>
  );
}
