"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import StatusBadge from "@/components/reimburse/StatusBadge";
import { ReimbursementDetailModal } from "@/components/reimburse/ReimbursementDetailModal";
import { formatCurrencyTH, formatDateTH } from "@/lib/format";

export interface ReimbursementItem {
  _id?: string;
  id?: string;
  tracking_id?: string;
  title?: string;
  purpose?: string;
  amount?: number;
  status?: string;
  latest_status?: string;
  created_at?: string;
  createdAt?: string;
  date?: string;
  department_name?: string;
  project_name?: string;
  department_id?: string;
  project_id?: string;
  staff_id?: string;
  requester_name?: string;
  staff?: any;
  department?: any;
  project?: any;
  receipt_url?: string;
  note?: string;
  status_history?: any[];
}

export interface RecentReimbursementsTableProps {
  items?: ReimbursementItem[];
  isLoading?: boolean;
  onRefresh?: () => void;
}

export const RecentReimbursementsTable: React.FC<
  RecentReimbursementsTableProps
> = ({ items = [], isLoading = false, onRefresh }) => {
  const { user } = useAuth();
  const [selectedItem, setSelectedItem] = useState<ReimbursementItem | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState<boolean>(false);

  // Check User Roles and Scopes
  const userRole = user?.role?.toLowerCase();
  const isAdminOrOwner = userRole === "admin" || userRole === "owner";

  const headDeptIds = useMemo(() => {
    const list: string[] = [];
    if (user?.scope?.head_of) list.push(...user.scope.head_of);
    user?.scope?.memberships?.forEach((m) => {
      if (m.is_head) {
        if (m.department_id) list.push(m.department_id);
        if (m.department_name) list.push(m.department_name);
      }
    });
    return list;
  }, [user]);

  const financeProjIds = useMemo(() => {
    const list: string[] = [];
    if (user?.scope?.finance_of) list.push(...user.scope.finance_of);
    user?.scope?.memberships?.forEach((m) => {
      if (m.is_finance) {
        if (m.project_id) list.push(m.project_id);
        if (m.project_name) list.push(m.project_name);
      }
    });
    return list;
  }, [user]);

  const isGlobalFinance = userRole === "finance" && financeProjIds.length === 0;
  const isHead = headDeptIds.length > 0;
  const isProjectFinance = financeProjIds.length > 0;
  const isApprover = isAdminOrOwner || isGlobalFinance || isHead || isProjectFinance;

  // 1. Pending Items for Approver (อย่าลืมตรวจรายการเบิกเงิน!)
  const pendingApprovalItems = useMemo(() => {
    if (!items || items.length === 0 || !isApprover) return [];

    if (isAdminOrOwner || isGlobalFinance) {
      // Global approvers see all items waiting for approval (waiting or head_approve)
      return items.filter((item) => {
        const st = item.status || item.latest_status || "waiting";
        return st === "waiting" || st === "head_approve";
      });
    }

    return items.filter((item) => {
      const st = item.status || item.latest_status || "waiting";
      const itemDept = String(item.department_id || item.department_name || item.department?.name || "");
      const itemProj = String(item.project_id || item.project_name || item.project?.name || "");

      const matchHead =
        isHead &&
        st === "waiting" &&
        headDeptIds.some(
          (h) =>
            itemDept.toLowerCase().includes(h.toLowerCase()) ||
            h.toLowerCase().includes(itemDept.toLowerCase())
        );

      const matchFinance =
        isProjectFinance &&
        st === "head_approve" &&
        financeProjIds.some(
          (f) =>
            itemProj.toLowerCase().includes(f.toLowerCase()) ||
            f.toLowerCase().includes(itemProj.toLowerCase())
        );

      return matchHead || matchFinance;
    });
  }, [
    items,
    isAdminOrOwner,
    isGlobalFinance,
    isHead,
    isProjectFinance,
    headDeptIds,
    financeProjIds,
    isApprover,
  ]);

  // 2. Personal Submitted Items (รายการเบิกเงินของคุณ)
  const myReimbursementItems = useMemo(() => {
    if (!items || items.length === 0) return [];

    const myId = user?._id;
    const myNick = user?.nickname?.toLowerCase();

    const myItems = items.filter((item) => {
      if (myId && item.staff_id === myId) return true;
      if (
        myNick &&
        (item.staff?.nickname?.toLowerCase() === myNick ||
          item.requester_name?.toLowerCase().includes(myNick))
      ) {
        return true;
      }
      return false;
    });

    return myItems;
  }, [items, user]);

  const renderItemRow = (item: ReimbursementItem, actionLabel: string = "รายละเอียด") => {
    const rawId = item._id || item.id || Math.random().toString();
    const trackingId = item.tracking_id || (rawId.length > 8 ? `REIM-${rawId.substring(0, 8).toUpperCase()}` : rawId);
    const title = item.title || item.purpose || "ไม่มีชื่อรายการ";
    const status = item.status || item.latest_status || "waiting";
    const dept = item.department_name || item.department?.name;
    const proj = item.project_name || item.project?.name;
    const dateStr = formatDateTH(item.created_at || item.createdAt || item.date);

    return (
      <div
        key={rawId}
        onClick={() => {
          setSelectedItem(item);
          setIsDetailModalOpen(true);
        }}
        className="group rounded-2xl border border-slate-200/90 bg-white p-3.5 sm:p-4 shadow-2xs transition-all hover:border-blue-300 hover:shadow-xs active:scale-[0.99] cursor-pointer space-y-2 sm:space-y-0 sm:flex sm:items-center sm:justify-between sm:gap-3"
      >
        {/* Top meta & Title */}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center justify-between sm:justify-start gap-2">
            <span className="font-mono text-[11px] font-semibold text-blue-900 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100/80">
              {trackingId}
            </span>
            <span className="text-[11px] text-slate-400 sm:hidden">
              {dateStr}
            </span>
          </div>

          <h4 className="text-xs sm:text-sm font-bold text-slate-900 line-clamp-2 group-hover:text-blue-900 transition-colors">
            {title}
          </h4>

          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
            {dept && <span className="font-medium text-slate-700">{dept}</span>}
            {dept && proj && <span className="text-slate-300">•</span>}
            {proj && <span className="text-slate-500 truncate max-w-[150px]">{proj}</span>}
            <span className="hidden sm:inline text-slate-300">•</span>
            <span className="hidden sm:inline text-slate-400">{dateStr}</span>
          </div>
        </div>

        {/* Amount, Status Badge & Action Button */}
        <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 shrink-0">
          <span className="font-bold text-slate-900 text-xs sm:text-sm whitespace-nowrap">
            {formatCurrencyTH(item.amount, 2)}
          </span>
          <div className="shrink-0 scale-90 sm:scale-100 origin-right">
            <StatusBadge status={status} />
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedItem(item);
              setIsDetailModalOpen(true);
            }}
            className="inline-flex items-center gap-1 px-2.5 sm:px-3 py-1 sm:py-1.5 text-[11px] sm:text-xs font-semibold text-blue-900 bg-blue-50 hover:bg-blue-100 rounded-xl transition-all active:scale-95 cursor-pointer whitespace-nowrap shrink-0"
          >
            <span>{actionLabel}</span>
            <svg
              className="w-3 h-3 sm:w-3.5 sm:h-3.5 transition-transform group-hover:translate-x-0.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-sm">
          <div className="h-5 w-44 rounded-md bg-slate-200 animate-pulse mb-4" />
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 w-full rounded-2xl bg-slate-100 animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* SECTION 1: อย่าลืมตรวจรายการเบิกเงิน! (Shown for Head / Finance / Admin / Owner) */}
      {isApprover && (
        <div className="flex flex-col rounded-2xl border border-amber-200/70 bg-amber-50/25 p-4 sm:p-6 shadow-xs">
          <div className="flex flex-wrap items-start justify-between gap-2 border-b border-amber-100/80 pb-3 mb-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <span className="flex h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
                <h3 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
                  อย่าลืมตรวจรายการเบิกเงิน!
                </h3>
                {pendingApprovalItems.length > 0 && (
                  <span className="inline-flex items-center rounded-full bg-amber-100/90 px-2 py-0.5 text-[10px] sm:text-xs font-bold text-amber-900 border border-amber-300/60 whitespace-nowrap">
                    รอตรวจ {pendingApprovalItems.length} รายการ
                  </span>
                )}
              </div>
              <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5 line-clamp-1">
                รายการเบิกเงินที่รอให้คุณตรวจสอบและอนุมัติตามสายงาน
              </p>
            </div>
            <Link
              href="/reimburse"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-900 bg-white/90 hover:bg-blue-50 border border-amber-300/80 hover:border-blue-300 rounded-xl shadow-2xs transition-all active:scale-95 shrink-0 cursor-pointer"
            >
              <span>ดูทั้งหมด</span>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>

          {pendingApprovalItems.length === 0 ? (
            <div className="flex h-24 flex-col items-center justify-center text-xs text-slate-400 bg-white/70 rounded-xl border border-dashed border-amber-200">
              <span>ไม่มีรายการเบิกเงินที่ค้างรอการตรวจสอบในขณะนี้</span>
            </div>
          ) : (
            <div className="space-y-2.5">
              {pendingApprovalItems.map((item) => renderItemRow(item, "ตรวจรายการ"))}
            </div>
          )}
        </div>
      )}

      {/* SECTION 2: รายการเบิกเงินของคุณ (Shown for Everyone / User) */}
      <div className="flex flex-col rounded-2xl border border-slate-200/70 bg-white p-4 sm:p-6 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3 mb-4">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
              รายการเบิกเงินของคุณ
            </h3>
            <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5">
              ติดตามสถานะคำขอเบิกเงินที่คุณได้ยื่นไว้
            </p>
          </div>
          <Link
            href="/reimburse"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-blue-900 bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-200 rounded-xl shadow-2xs transition-all active:scale-95 shrink-0 cursor-pointer"
          >
            <span>ดูทั้งหมด</span>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>

        {myReimbursementItems.length === 0 ? (
          <div className="flex h-28 flex-col items-center justify-center text-xs text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
            <span>คุณยังไม่ได้ยื่นคำขอเบิกเงิน</span>
            <Link
              href="/reimburse"
              className="mt-2 text-xs font-semibold text-blue-900 hover:underline"
            >
              + ขอเบิกเงินใหม่
            </Link>
          </div>
        ) : (
          <div className="space-y-2.5">
            {myReimbursementItems.map((item) => renderItemRow(item, "รายละเอียด"))}
          </div>
        )}
      </div>

      {/* Reimbursement Detail Modal for instant review / viewing */}
      <ReimbursementDetailModal
        isOpen={isDetailModalOpen}
        item={selectedItem}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedItem(null);
        }}
        onSuccess={() => {
          onRefresh?.();
        }}
      />
    </div>
  );
};


