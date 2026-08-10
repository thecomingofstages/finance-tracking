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
      title: "รายรับรวม (Total Income)",
      value: formatCurrencyTH(summaryData?.total_income, 2),
      icon: (
        <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 4v16m8-8H4" />
        </svg>
      ),
      bgColor: "bg-emerald-50",
      textColor: "text-slate-900",
      borderColor: "border-slate-200/60",
      ringColor: "group-hover:border-slate-300",
    },
    {
      title: "รายจ่ายรวม (Total Expense)",
      value: formatCurrencyTH(summaryData?.total_expense, 2),
      icon: (
        <svg className="w-5 h-5 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M20 12H4" />
        </svg>
      ),
      bgColor: "bg-rose-50",
      textColor: "text-slate-900",
      borderColor: "border-slate-200/60",
      ringColor: "group-hover:border-slate-300",
    },
    {
      title: "กระแสเงินสดสุทธิ (Net Cash Flow)",
      value: formatCurrencyTH(summaryData?.net_cashflow, 2),
      icon: (
        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 6l9-3 9 3v12l-9 3-9-3V6z" />
        </svg>
      ),
      bgColor: "bg-blue-50",
      textColor: "text-slate-900",
      borderColor: "border-slate-200/60",
      ringColor: "group-hover:border-slate-300",
    },
    {
      title: "รายการรออนุมัติ/รอโอน (Pending Requests)",
      value: `${formatIntegerTH(summaryData?.pending_count)} รายการ`,
      icon: (
        <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      bgColor: "bg-amber-50",
      textColor: "text-slate-900",
      borderColor: "border-slate-200/60",
      ringColor: "group-hover:border-slate-300",
    },
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="animate-pulse rounded-2xl border border-slate-200/60 bg-white p-6 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div className="h-4 w-28 rounded-md bg-slate-200" />
              <div className="h-10 w-10 rounded-xl bg-slate-100" />
            </div>
            <div className="mt-4 h-8 w-36 rounded-md bg-slate-200" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card, index) => (
        <div
          key={index}
          className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl border ${card.borderColor} bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md ${card.ringColor}`}
        >
          <div className="flex items-start justify-between gap-3 pt-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              {card.title}
            </span>
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${card.bgColor} shadow-sm ring-1 ring-black/5 transition-transform duration-200 group-hover:scale-105`}
            >
              {card.icon}
            </div>
          </div>
          <div className="mt-4">
            <span className={`text-3xl font-bold font-mono tracking-tight ${card.textColor}`}>
              {card.value}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
};
