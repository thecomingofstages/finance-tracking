"use client";

import React from "react";
import Link from "next/link";

export interface ProjectItem {
  _id: string;
  name: string;
  code?: string;
  allocated_budget?: number;
  actual_expense?: number;
}

export interface ActiveProjectsWidgetProps {
  projects?: ProjectItem[];
  isLoading?: boolean;
}

const formatCurrency = (val?: number): string => {
  const amount = val ?? 0;
  return `฿${amount.toLocaleString("th-TH", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
};

export const ActiveProjectsWidget: React.FC<ActiveProjectsWidgetProps> = ({
  projects = [],
  isLoading = false,
}) => {
  if (isLoading) {
    return (
      <div className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="h-5 w-36 rounded-md bg-slate-200 animate-pulse" />
          <div className="h-4 w-16 rounded-md bg-slate-200 animate-pulse" />
        </div>
        <div className="mt-4 space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse space-y-2">
              <div className="flex justify-between">
                <div className="h-4 w-40 rounded-md bg-slate-200" />
                <div className="h-4 w-20 rounded-md bg-slate-200" />
              </div>
              <div className="h-2.5 w-full rounded-full bg-slate-100" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col rounded-2xl border border-slate-200/60 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <h3 className="text-base font-bold text-slate-900 tracking-tight">
          โครงการที่เปิดใช้งาน (Active Projects)
        </h3>
        <Link
          href="/project"
          className="text-xs font-medium text-slate-500 hover:text-blue-600 hover:underline transition-colors"
        >
          ดูทั้งหมด →
        </Link>
      </div>

      <div className="mt-4 flex-1">
        {projects.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-sm text-slate-400">
            ไม่มีโครงการที่เปิดใช้งานอยู่ในขณะนี้
          </div>
        ) : (
          <div className="space-y-4">
            {projects.map((project) => {
              const allocated = project.allocated_budget || 0;
              const actual = project.actual_expense || 0;
              const rawPercentage = allocated > 0 ? (actual / allocated) * 100 : 0;
              const displayPercentage = Math.round(rawPercentage);
              const isOver90Percent = rawPercentage > 90;

              return (
                <div
                  key={project._id}
                  className="group rounded-xl border border-slate-100 bg-slate-50/50 p-4 transition-all duration-200 hover:border-slate-200 hover:bg-slate-50 hover:shadow-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <span className="truncate text-sm font-semibold text-slate-900">
                        {project.name}
                      </span>
                      {project.code && (
                        <span className="shrink-0 rounded-md bg-white border border-slate-200 px-2 py-0.5 font-mono text-[10px] font-bold text-slate-500 shadow-sm">
                          {project.code}
                        </span>
                      )}
                    </div>
                    <Link
                      href={`/project/${project._id}`}
                      className="shrink-0 text-xs font-semibold text-slate-400 hover:text-blue-600 transition-colors opacity-0 group-hover:opacity-100 md:opacity-100"
                      title="ดูรายละเอียดโครงการ"
                    >
                      รายละเอียด
                    </Link>
                  </div>

                  {/* Budget & Expense info */}
                  <div className="mt-3 flex items-center justify-between text-[11px] font-medium text-slate-500">
                    <span>
                      ใช้ไป <span className="font-bold text-slate-700">{formatCurrency(actual)}</span> / {formatCurrency(allocated)}
                    </span>
                    <span
                      className={`font-bold ${
                        isOver90Percent ? "text-rose-600" : "text-slate-900"
                      }`}
                    >
                      {displayPercentage}%
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ease-out ${
                        isOver90Percent
                          ? "bg-gradient-to-r from-rose-400 to-rose-600"
                          : "bg-gradient-to-r from-blue-500 to-blue-600"
                      }`}
                      style={{ width: `${Math.min(rawPercentage, 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
