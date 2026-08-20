"use client";

import React from "react";
import { formatCurrencyTH, formatIntegerTH } from "@/lib/format";

export interface StatSummaryData {
  total_income?: number;
  total_expense?: number;
  net_cashflow?: number;
  pending_count?: number;
}

export interface StatCardsProps {
  summaryData?: StatSummaryData;
  isLoading?: boolean;
}

export const StatCards: React.FC<StatCardsProps> = ({
  summaryData,
  isLoading = false,
}) => {
  const cards = [
    {
      title: "รายรับรวม",
      subtitle: "TOTAL INCOME",
      value: formatCurrencyTH(summaryData?.total_income, 2),
      icon: (
        <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      ),
      bgColor: "bg-emerald-50",
      textColor: "text-slate-900",
      borderColor: "border-slate-200/80",
    },
    {
      title: "รายจ่ายรวม",
      subtitle: "TOTAL EXPENSE",
      value: formatCurrencyTH(summaryData?.total_expense, 2),
      icon: (
        <svg className="w-4 h-4 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
        </svg>
      ),
      bgColor: "bg-rose-50",
      textColor: "text-slate-900",
      borderColor: "border-slate-200/80",
    },
    {
      title: "กระแสเงินสดสุทธิ",
      subtitle: "NET CASH FLOW",
      value: formatCurrencyTH(summaryData?.net_cashflow, 2),
      icon: (
        <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l9-3 9 3v12l-9 3-9-3V6z" />
        </svg>
      ),
      bgColor: "bg-blue-50",
      textColor: "text-slate-900",
      borderColor: "border-slate-200/80",
    },
    {
      title: "รายการรออนุมัติ/รอโอน",
      subtitle: "PENDING REQUESTS",
      value: `${formatIntegerTH(summaryData?.pending_count)} รายการ`,
      icon: (
        <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      bgColor: "bg-amber-50",
      textColor: "text-slate-900",
      borderColor: "border-slate-200/80",
    },
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="animate-pulse rounded-2xl border border-slate-200/80 bg-white p-3.5 sm:p-5 shadow-sm space-y-2.5"
          >
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="h-3 w-16 sm:w-24 rounded bg-slate-200" />
                <div className="h-2 w-12 sm:w-16 rounded bg-slate-100" />
              </div>
              <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg bg-slate-100" />
            </div>
            <div className="pt-1.5">
              <div className="h-5 sm:h-7 w-20 sm:w-32 rounded bg-slate-200" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-4">
      {cards.map((card, index) => (
        <div
          key={index}
          className={`relative flex flex-col justify-between overflow-hidden rounded-2xl border ${card.borderColor} bg-white p-3.5 sm:p-5 shadow-sm transition-all duration-200 hover:shadow-md hover:border-slate-300`}
        >
          <div className="flex items-start justify-between gap-1.5">
            <div className="min-w-0">
              <div className="text-[11px] sm:text-xs font-semibold text-slate-700 truncate">
                {card.title}
              </div>
              <div className="text-[9px] sm:text-[10px] font-medium tracking-wider text-slate-400 uppercase truncate">
                {card.subtitle}
              </div>
            </div>
            <div
              className={`flex h-6 w-6 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-lg ${card.bgColor} ring-1 ring-black/5`}
            >
              {card.icon}
            </div>
          </div>
          <div className="mt-2 sm:mt-3.5">
            <span
              className={`text-sm sm:text-xl lg:text-2xl font-bold tracking-tight text-slate-900 block truncate`}
              title={card.value}
            >
              {card.value}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
};
