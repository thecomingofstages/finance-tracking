"use client";

import React from "react";

export interface DepartmentBudgetWidgetProps {
  departments?: Array<{
    id?: string;
    _id?: string;
    name: string;
    allocated_budget?: number;
    actual_expense?: number;
  }>;
  isLoading?: boolean;
}

export default function DepartmentBudgetWidget({
  departments = [],
  isLoading = false,
}: DepartmentBudgetWidgetProps) {
  const formatTHB = (val: number) => {
    return `฿${val.toLocaleString("th-TH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

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
            <div className="p-2 bg-zinc-50 text-blue-900 rounded-lg">
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
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5m0 0h4m-4 0V11m0 0l-3 3m3-3l3 3"
                />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 text-base">
                สัดส่วนตามฝ่าย / แผนก
              </h3>
              <p className="text-xs text-slate-500">
                การจัดสรรและการเบิกจ่ายงบประมาณจำแนกตามหน่วยงาน
              </p>
            </div>
          </div>
          <span className="text-xs text-slate-500 font-medium">
            {departments.length} แผนก
          </span>
        </div>

        {departments.length === 0 ? (
          <div className="py-8 text-center text-slate-500 text-sm">
            ไม่มีข้อมูลการจัดสรรงบประมาณตามแผนก
          </div>
        ) : (
          <div className="space-y-4">
            {departments.map((dept, index) => {
              const allocated = dept.allocated_budget ?? 0;
              const actual = dept.actual_expense ?? 0;
              const ratio = allocated > 0 ? (actual / allocated) * 100 : 0;
              const percentage = Math.round(ratio);

              const barColor =
                ratio > 90
                  ? "bg-amber-500"
                  : ratio > 75
                  ? "bg-blue-600"
                  : "bg-blue-900";

              return (
                <div key={dept.id || dept._id || index} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-800">
                      {dept.name}
                    </span>
                    <span className="text-slate-600 font-medium">
                      ใช้ไป {formatTHB(actual)} / {formatTHB(allocated)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${barColor}`}
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
