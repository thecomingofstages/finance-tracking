"use client";

import React from "react";

export interface TagBreakdownWidgetProps {
  tags?: Array<{
    id?: string;
    _id?: string;
    name: string;
    total_expense?: number;
    count?: number;
  }>;
  totalProjectExpense?: number;
  isLoading?: boolean;
}

export default function TagBreakdownWidget({
  tags = [],
  totalProjectExpense = 0,
  isLoading = false,
}: TagBreakdownWidgetProps) {
  const formatTHB = (val: number) => {
    return `฿${val.toLocaleString("th-TH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  // Calculate sum of tag total_expense if totalProjectExpense is 0
  const sumTagExpenses = tags.reduce(
    (sum, t) => sum + (t.total_expense ?? 0),
    0
  );
  const baseTotal = totalProjectExpense > 0 ? totalProjectExpense : sumTagExpenses;

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm animate-pulse space-y-4">
        <div className="h-5 bg-slate-200 rounded w-1/3" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <div className="flex justify-between">
                <div className="h-4 bg-slate-200 rounded w-1/4" />
                <div className="h-4 bg-slate-100 rounded w-1/3" />
              </div>
              <div className="h-2 bg-slate-100 rounded-full w-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 text-indigo-900 rounded-lg">
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 text-base">
                สัดส่วนตามหมวดหมู่ / Tag
              </h3>
              <p className="text-xs text-slate-500">
                สรุปค่าใช้จ่ายจำแนกตามประเภทแท็กหมวดหมู่
              </p>
            </div>
          </div>
          <span className="text-xs text-slate-500 font-medium">
            {tags.length} หมวดหมู่
          </span>
        </div>

        {tags.length === 0 ? (
          <div className="py-8 text-center text-slate-500 text-sm">
            ไม่มีข้อมูลหมวดหมู่ค่าใช้จ่าย
          </div>
        ) : (
          <div className="space-y-4">
            {tags.map((tag, index) => {
              const expense = tag.total_expense ?? 0;
              const ratio = baseTotal > 0 ? (expense / baseTotal) * 100 : 0;
              const percentage = Math.round(ratio);

              return (
                <div key={tag.id || tag._id || index} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-800">
                        {tag.name}
                      </span>
                      {tag.count !== undefined && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-medium">
                          {tag.count} รายการ
                        </span>
                      )}
                    </div>
                    <span className="text-slate-600 font-medium">
                      {formatTHB(expense)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="h-full bg-indigo-600 rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(ratio, 100)}%` }}
                      />
                    </div>
                    <span className="text-xs font-semibold text-slate-700 min-w-[2.5rem] text-right">
                      {percentage}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
