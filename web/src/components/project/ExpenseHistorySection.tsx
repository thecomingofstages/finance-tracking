"use client";

import React, { useState, useMemo } from "react";
import { StatusBadge } from "@/components/reimburse";
import type { ReimbursementItem, ProjectDepartment, ProjectTag } from "./types";

interface ExpenseHistorySectionProps {
  reimbursements: ReimbursementItem[];
  departments: ProjectDepartment[];
  tags: ProjectTag[];
  onItemClick?: (item: ReimbursementItem) => void;
}

const formatTHB = (val: number) =>
  `฿${val.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const ITEMS_PER_PAGE = 20;

export const ExpenseHistorySection: React.FC<ExpenseHistorySectionProps> = ({
  reimbursements,
  departments,
  tags,
  onItemClick,
}) => {
  const [filterDept, setFilterDept] = useState("");
  const [filterTag, setFilterTag] = useState("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const filtered = useMemo(() => {
    let items = [...reimbursements];

    if (filterDept) {
      items = items.filter((item) => {
        const deptName = item.department_name || item.department?.name || "";
        const deptId = item.department_id || item.department?._id || item.department?.id || "";
        return deptId === filterDept || deptName === filterDept;
      });
    }

    if (filterTag) {
      items = items.filter((item) => {
        const tagId = item.tag_id || item.tag?._id || item.tag?.id || "";
        const tagName = item.tag_name || item.tag?.name || "";
        return tagId === filterTag || tagName === filterTag;
      });
    }

    if (filterFrom) {
      const from = new Date(filterFrom);
      items = items.filter((item) => {
        const d = new Date(item.created_at || item.createdAt || "");
        return !isNaN(d.getTime()) && d >= from;
      });
    }

    if (filterTo) {
      const to = new Date(filterTo);
      to.setHours(23, 59, 59, 999);
      items = items.filter((item) => {
        const d = new Date(item.created_at || item.createdAt || "");
        return !isNaN(d.getTime()) && d <= to;
      });
    }

    return items;
  }, [reimbursements, filterDept, filterTag, filterFrom, filterTo]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedItems = filtered.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE);

  const handleClearFilters = () => {
    setFilterDept("");
    setFilterTag("");
    setFilterFrom("");
    setFilterTo("");
    setCurrentPage(1);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-slate-800">ประวัติการใช้จ่าย</h2>
          <p className="text-xs text-slate-500">{filtered.length} รายการ</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="px-6 py-3 border-b border-slate-100 flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-slate-500">ช่วงเวลา (จาก)</label>
          <input type="date" value={filterFrom} onChange={(e) => { setFilterFrom(e.target.value); setCurrentPage(1); }} className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs" />
        </div>
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-slate-500">ถึง</label>
          <input type="date" value={filterTo} onChange={(e) => { setFilterTo(e.target.value); setCurrentPage(1); }} className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs" />
        </div>
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-slate-500">ฝ่าย</label>
          <select value={filterDept} onChange={(e) => { setFilterDept(e.target.value); setCurrentPage(1); }} className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs min-w-[140px]">
            <option value="">ทั้งหมด</option>
            {departments.map((d) => <option key={d._id || d.id} value={d._id || d.id}>{d.name}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-slate-500">Tag</label>
          <select value={filterTag} onChange={(e) => { setFilterTag(e.target.value); setCurrentPage(1); }} className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs min-w-[140px]">
            <option value="">ทั้งหมด</option>
            {tags.map((t) => <option key={t._id || t.id} value={t._id || t.id}>{t.name}</option>)}
          </select>
        </div>
        {(filterDept || filterTag || filterFrom || filterTo) && (
          <button onClick={handleClearFilters} className="text-xs text-slate-800 hover:text-slate-800 font-medium px-2 py-1.5">ล้างตัวกรอง</button>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/80 border-b border-slate-200/80 text-xs font-semibold text-slate-600 uppercase tracking-wider">
              <th className="py-3 px-5">ชื่อรายการ</th>
              <th className="py-3 px-5">Tag</th>
              <th className="py-3 px-5">ฝ่าย</th>
              <th className="py-3 px-5 text-right">จำนวน (฿)</th>
              <th className="py-3 px-5">สถานะ</th>
              <th className="py-3 px-5">วันที่จ่าย</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
            {paginatedItems.length === 0 ? (
              <tr><td colSpan={6} className="py-8 text-center text-slate-400 text-sm">ไม่พบรายการ</td></tr>
            ) : (
              paginatedItems.map((item, idx) => {
                const rawId = item._id || item.id || `exp-${idx}`;
                const title = item.title || item.purpose || "ไม่มีชื่อรายการ";
                const tagName = item.tag_name || item.tag?.name || "-";
                const deptName = item.department_name || item.department?.name || "-";
                const amount = Number(item.amount) || 0;
                const status = item.status || item.latest_status || "waiting";

                const rawDate = item.created_at || item.createdAt;
                let formattedDate = "-";
                if (rawDate) {
                  try {
                    const d = new Date(rawDate);
                    if (!isNaN(d.getTime())) {
                      formattedDate = d.toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" });
                    }
                  } catch { formattedDate = String(rawDate); }
                }

                return (
                  <tr
                    key={rawId}
                    onClick={() => onItemClick?.(item)}
                    className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-5 font-medium text-slate-900 max-w-xs truncate">{title}</td>
                    <td className="py-3 px-5 text-slate-500">{tagName}</td>
                    <td className="py-3 px-5 text-slate-500">{deptName}</td>
                    <td className="py-3 px-5 text-right font-semibold text-slate-900">{formatTHB(amount)}</td>
                    <td className="py-3 px-5"><StatusBadge status={status} /></td>
                    <td className="py-3 px-5 text-slate-500 whitespace-nowrap">{formattedDate}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-6 py-3 border-t border-slate-100 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            แสดง {(safePage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(safePage * ITEMS_PER_PAGE, filtered.length)} จาก {filtered.length} รายการ
          </span>
          <div className="flex items-center gap-2">
            <button
              disabled={safePage <= 1}
              onClick={() => setCurrentPage(safePage - 1)}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              ← ก่อนหน้า
            </button>
            <span className="text-xs text-slate-500">หน้า {safePage}/{totalPages}</span>
            <button
              disabled={safePage >= totalPages}
              onClick={() => setCurrentPage(safePage + 1)}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              ถัดไป →
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
