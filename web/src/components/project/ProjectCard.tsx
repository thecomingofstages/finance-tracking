"use client";

import React from "react";
import Link from "next/link";

export interface ProjectCardProps {
  project: {
    _id?: string;
    id?: string;
    name: string;
    code?: string;
    description?: string;
    allocated_budget?: number;
    actual_expense?: number;
  };
}

export default function ProjectCard({ project }: ProjectCardProps) {
  const projectId = project._id || project.id || "";
  const actualExpense = project.actual_expense ?? 0;
  const allocatedBudget = project.allocated_budget ?? 0;

  const usageRatio = allocatedBudget > 0 ? (actualExpense / allocatedBudget) * 100 : 0;
  const usagePercentage = Math.round(usageRatio);

  const formatTHB = (val: number) => {
    return `฿${val.toLocaleString("th-TH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const progressBarColor = usageRatio > 90 ? "bg-amber-500" : "bg-blue-900";

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between group">
      <div>
        <div className="flex items-start justify-between gap-3 mb-2">
          <h3 className="font-bold text-slate-900 text-base line-clamp-1 group-hover:text-blue-600 transition-colors">
            {project.name}
          </h3>
          {project.code && (
            <span className="font-mono text-xs font-semibold text-blue-900 bg-zinc-50 px-2 py-0.5 rounded-lg border border-blue-100 shrink-0">
              {project.code}
            </span>
          )}
        </div>

        <p className="text-xs text-slate-500 line-clamp-2 mb-4 min-h-[2rem]">
          {project.description || "ไม่มีคำอธิบายโครงการ"}
        </p>

        {/* Budget Progress Box */}
        <div className="space-y-2 mb-4 bg-slate-50/80 p-3 rounded-xl border border-slate-100">
          <div className="flex items-center justify-between gap-1 text-xs">
            <span className="text-slate-500 font-medium">งบประมาณ</span>
            <span className="font-semibold text-slate-900">{formatTHB(allocatedBudget)}</span>
          </div>
          <div className="w-full bg-slate-200/80 rounded-full h-2 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${progressBarColor}`}
              style={{ width: `${Math.min(usageRatio, 100)}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-500">
            <span>ใช้ไป <strong className="text-slate-800 font-semibold">{formatTHB(actualExpense)}</strong></span>
            <span className={`font-bold ${usageRatio > 90 ? "text-rose-600" : "text-blue-900"}`}>{usagePercentage}%</span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs">
        <div className="flex items-center gap-1.5 text-slate-600">
          <span className="font-medium text-slate-500">คงเหลือ:</span>
          <span className="font-bold text-slate-800">{formatTHB(Math.max(0, allocatedBudget - actualExpense))}</span>
        </div>

        <Link
          href={`/project/${projectId}`}
          className="inline-flex items-center gap-1 font-semibold text-blue-900 hover:text-blue-700 transition-colors"
        >
          <span>ดูรายละเอียด</span>
          <svg
            className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </Link>
      </div>
    </div>
  );
}
