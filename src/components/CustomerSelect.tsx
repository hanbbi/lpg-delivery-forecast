'use client';

import { useState } from 'react';
import { Customer } from '@/types';

interface Props {
  customers: Customer[];
  selectedCustomer: Customer | null;
  onSelect: (customer: Customer) => void;
}

export default function CustomerSelect({
  customers,
  selectedCustomer,
  onSelect,
}: Props) {
  const [searchTerm, setSearchTerm] = useState('');

  // customers가 배열인지 확인
  const customerList = Array.isArray(customers) ? customers : [];

  const filteredCustomers = customerList.filter(
    (customer) =>
      customer.cust_nm?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.device_id?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* 검색 입력 */}
      <div className="relative">
        <input
          type="text"
          placeholder="거래처명 또는 Device ID로 검색..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <svg
          className="absolute right-3 top-3.5 w-5 h-5 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </div>

      {/* 거래처 목록 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-64 overflow-y-auto">
        {filteredCustomers.map((customer) => (
          <button
            key={customer.device_id}
            onClick={() => onSelect(customer)}
            className={`p-4 text-left rounded-lg border-2 transition-all ${
              selectedCustomer?.device_id === customer.device_id
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
            }`}
          >
            <p className="font-medium text-gray-900">{customer.cust_nm}</p>
            <p className="text-sm text-gray-500">{customer.device_id}</p>
          </button>
        ))}

        {filteredCustomers.length === 0 && (
          <div className="col-span-full text-center py-8 text-gray-500">
            {customerList.length === 0
              ? '거래처 데이터를 불러오는 중...'
              : '검색 결과가 없습니다.'}
          </div>
        )}
      </div>

      {/* 선택된 거래처 정보 */}
      {selectedCustomer && (
        <div className="mt-4 p-4 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-600 font-medium">선택된 거래처</p>
          <p className="text-lg font-semibold text-blue-900">
            {selectedCustomer.cust_nm}
          </p>
          <p className="text-sm text-blue-700">
            Device: {selectedCustomer.device_id} | 위치: (
            {parseFloat(String(selectedCustomer.latitude))?.toFixed(4)},{' '}
            {parseFloat(String(selectedCustomer.longitude))?.toFixed(4)})
          </p>
        </div>
      )}
    </div>
  );
}
