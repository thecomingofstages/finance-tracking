"use client";

import React from "react";

export interface StatusBadgeProps {
  status: string;
  className?: string;
}

interface StatusConfig {
  label: string;
  classes: string;
}

const statusMap: Record<string, StatusConfig> = {
  waiting: {
    label: "รอหัวหน้าอนุมัติ",
    classes: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20",
  },
  head_approve: {
    label: "รอการเงินตรวจสอบ",
    classes: "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-700/10",
  },
  fin_approve: {
    label: "รอโอนเงิน",
    classes: "bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-700/10",
  },
  transfer: {
    label: "โอนเงินเรียบร้อย",
    classes: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20",
  },
  completed: {
    label: "โอนเงินเรียบร้อย",
    classes: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20",
  },
  rejected: {
    label: "ปฏิเสธ",
    classes: "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-600/20",
  },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  className = "",
}) => {
  const config = statusMap[status] || {
    label: status || "ไม่ระบุ",
    classes: "bg-slate-50 text-slate-700 ring-1 ring-inset ring-slate-500/10",
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.classes} ${className}`.trim()}
    >
      {config.label}
    </span>
  );
};

export default StatusBadge;
