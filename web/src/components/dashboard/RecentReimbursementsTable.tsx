"use client";

import React from "react";
import Link from "next/link";
import StatusBadge from "@/components/reimburse/StatusBadge";
import { formatCurrencyTH, formatDateTH } from "@/lib/format";

export interface ReimbursementItem {
  _id: string;
  tracking_id?: string;
  title: string;
  amount?: number;
  status: string;
  created_at?: string;
  department_name?: string;
}

export interface RecentReimbursementsTableProps {
  items?: ReimbursementItem[];
  isLoading?: boolean;
}

export const RecentReimbursementsTable: React.FC<
  RecentReimbursementsTableProps
> = ({ items = [], isLoading = false }) => {
  if (isLoading) {
    return (
      <div className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="h-5 w-44 rounded-md bg-slate-200 animate-pulse" />
          <div className="h-4 w-16 rounded-md bg-slate-200 animate-pulse" />
        </div>
        <div className="mt-4 space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-10 w-full rounded bg-slate-100 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col rounded-2xl border border-slate-200/60 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <h3 className="text-base font-bold text-slate-900 tracking-tight">
          รายการขอเบิกเงินล่าสุด (Recent Reimbursements)
        </h3>
        <Link
          href="/reimburse"
          className="text-xs font-medium text-blue-900 hover:text-blue-700 hover:underline"
        >
          ดูทั้งหมด →
        </Link>
      </div>

      <div className="mt-4 overflow-x-auto">
        {items.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-sm text-slate-400">
            ยังไม่มีรายการขอเบิกเงิน
          </div>
        ) : (
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              <tr className="border-b border-slate-100">
                <th scope="col" className="px-3 py-3">
                  รหัสติดตาม
                </th>
                <th scope="col" className="px-3 py-3">
                  รายการ
                </th>
                <th scope="col" className="px-3 py-3 hidden md:table-cell">
                  แผนก
                </th>
                <th scope="col" className="px-3 py-3 text-right">
                  จำนวนเงิน
                </th>
                <th scope="col" className="px-3 py-3 text-center">
                  สถานะ
                </th>
                <th scope="col" className="px-3 py-3 text-right hidden sm:table-cell">
                  วันที่
                </th>
                <th scope="col" className="px-3 py-3">
                  <span className="sr-only">การกระทำ</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/80">
              {items.map((item) => {
                return (
                  <tr
                    key={item._id}
                    className="group transition-colors hover:bg-slate-50/50"
                  >
                    <td className="whitespace-nowrap px-3 py-4 font-mono text-[11px] font-medium text-slate-500">
                      {item.tracking_id || item._id.substring(0, 8)}
                    </td>
                    <td className="px-3 py-4 font-medium text-slate-900 max-w-[200px] truncate">
                      {item.title}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-xs text-slate-500 hidden md:table-cell">
                      {item.department_name || "-"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-right font-bold font-mono text-slate-900">
                      {formatCurrencyTH(item.amount, 2)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-center">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-right text-xs text-slate-400 hidden sm:table-cell">
                      {formatDateTH(item.created_at)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-right text-xs">
                      <Link
                        href={`/reimburse`}
                        className="font-semibold text-slate-400 hover:text-blue-600 transition-colors"
                      >
                        รายละเอียด
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
