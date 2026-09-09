"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { AppShell } from "@/components/layout";
import {
  StatusBadge,
  ReimbursementFormModal,
  ReimbursementDetailModal,
} from "@/components/reimburse";
import { getReimbursementsApi } from "@/lib/api/reimbursements";

type StatusFilter =
  | "all"
  | "waiting"
  | "head_approve"
  | "fin_approve"
  | "transfer"
  | "rejected";

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "ทั้งหมด" },
  { key: "waiting", label: "รอหัวหน้าอนุมัติ" },
  { key: "head_approve", label: "รอการเงินตรวจสอบ" },
  { key: "fin_approve", label: "รอโอนเงิน" },
  { key: "transfer", label: "โอนแล้ว" },
  { key: "rejected", label: "ปฏิเสธ" },
];

type ScopeTab = "my" | "review" | "all";

export default function ReimbursementsPage() {
  const { user } = useAuth();
  const [reimbursements, setReimbursements] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [scopeTab, setScopeTab] = useState<ScopeTab>("my");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const [isFormModalOpen, setIsFormModalOpen] = useState<boolean>(false);
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopyTrackingId = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(id);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const router = useRouter();

  const isMyItem = (item: any) => {
    if (!user) return true;
    const userNick = user.nickname?.toLowerCase();
    const userEmail = user.email?.toLowerCase();
    const userId = user._id;

    if (item.staff_id && userId && item.staff_id === userId) return true;
    if (item.staff?.email && userEmail && item.staff.email.toLowerCase() === userEmail) return true;
    if (item.staff?.nickname && userNick && item.staff.nickname.toLowerCase() === userNick) return true;
    if (item.requester_name && userNick && String(item.requester_name).toLowerCase().includes(userNick)) return true;
    return false;
  };

  const isPendingReviewItem = (item: any) => {
    const st = item.status || item.latest_status;
    return st === "waiting" || st === "head_approve" || st === "fin_approve";
  };

  const myCount = useMemo(() => reimbursements.filter(isMyItem).length, [reimbursements, user]);
  const reviewCount = useMemo(() => reimbursements.filter(isPendingReviewItem).length, [reimbursements]);
  const allCount = reimbursements.length;

  const fetchReimbursements = async () => {
    setIsLoading(true);
    try {
      const res = await getReimbursementsApi({
        status: statusFilter === "all" ? undefined : statusFilter,
        limit: 50,
      });

      if (res.data) {
        const rawList = Array.isArray(res.data)
          ? res.data
          : Array.isArray((res.data as any)?.data)
          ? (res.data as any).data
          : Array.isArray((res.data as any)?.items)
          ? (res.data as any).items
          : [];

        setReimbursements(rawList);
      } else {
        setReimbursements([]);
      }
    } catch {
      setReimbursements([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReimbursements();
  }, [statusFilter]);

  // Client-side search and scope filtering
  const filteredItems = useMemo(() => {
    let items = reimbursements;

    if (scopeTab === "my") {
      items = items.filter(isMyItem);
    } else if (scopeTab === "review") {
      items = items.filter(isPendingReviewItem);
    }

    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase().trim();

    return items.filter((item) => {
      const title = String(item.title || item.purpose || "").toLowerCase();
      const rawId = item._id || item.id || "";
      const trackingId = String(
        item.tracking_id ||
          (rawId ? `REIM-${String(rawId).substring(0, 8)}` : "")
      ).toLowerCase();
      const requester = String(
        item.requester_name ||
          item.staff_name ||
          item.staff?.nickname ||
          (item.staff?.first_name
            ? `${item.staff.first_name} ${item.staff.last_name || ""}`
            : "") ||
          ""
      ).toLowerCase();
      const department = String(
        item.department_name ||
          item.department?.name ||
          item.staff_dept_name ||
          ""
      ).toLowerCase();
      const project = String(
        item.project_name || item.project?.name || item.project_code || ""
      ).toLowerCase();

      return (
        title.includes(q) ||
        trackingId.includes(q) ||
        requester.includes(q) ||
        department.includes(q) ||
        project.includes(q)
      );
    });
  }, [reimbursements, scopeTab, searchQuery, user]);

  return (
    <AppShell>
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        {/* Page Header (ERP SaaS style) */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-900 border border-blue-100">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                รายการขอเบิกเงิน
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                ยื่นคำขอเบิกเงิน แนบใบเสร็จ และติดตามสถานะการอนุมัติ
              </p>
            </div>
          </div>

          <button
            onClick={() => router.push("/reimburse/new")}
            className="bg-blue-900 hover:bg-blue-800 text-white rounded-xl px-4 py-2.5 shadow-sm shadow-blue-900/20 text-xs sm:text-sm font-semibold flex items-center gap-2 cursor-pointer transition-all active:scale-95 self-start md:self-auto"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            <span>ขอเบิกเงินใหม่</span>
          </button>
        </div>

        {/* Filter & Search Bar Container */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
          {/* Scope Tabs (My Requests vs To Review vs All) */}
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 pb-4">
            <button
              onClick={() => setScopeTab("my")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                scopeTab === "my"
                  ? "bg-blue-900 text-white shadow-sm shadow-blue-900/20"
                  : "bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200/60"
              }`}
            >
              <span>รายการขอเบิกของฉัน</span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                  scopeTab === "my"
                    ? "bg-white/20 text-white"
                    : "bg-slate-200 text-slate-700"
                }`}
              >
                {myCount}
              </span>
            </button>

            <button
              onClick={() => setScopeTab("review")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                scopeTab === "review"
                  ? "bg-blue-900 text-white shadow-sm shadow-blue-900/20"
                  : "bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200/60"
              }`}
            >
              <span>รายการที่ต้องตรวจสอบ</span>
              {reviewCount > 0 && (
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                    scopeTab === "review"
                      ? "bg-amber-400 text-slate-950"
                      : "bg-amber-100 text-amber-900"
                  }`}
                >
                  {reviewCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setScopeTab("all")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                scopeTab === "all"
                  ? "bg-blue-900 text-white shadow-sm shadow-blue-900/20"
                  : "bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200/60"
              }`}
            >
              <span>รายการทั้งหมด</span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                  scopeTab === "all"
                    ? "bg-white/20 text-white"
                    : "bg-slate-200 text-slate-700"
                }`}
              >
                {allCount}
              </span>
            </button>
          </div>

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pt-1">
            {/* Status Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-2 lg:pb-0 scrollbar-none">
              {STATUS_TABS.map((tab) => {
                const isActive = statusFilter === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setStatusFilter(tab.key)}
                    className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium whitespace-nowrap transition-all cursor-pointer ${
                      isActive
                        ? "bg-blue-900 text-white shadow-sm"
                        : "bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Search Input */}
            <div className="relative w-full lg:w-72">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ค้นหารายการ, รหัสติดตาม, ผู้ยื่น..."
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 transition-all placeholder:text-slate-400"
              />
              <svg
                className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
          </div>
        </div>

        {/* Data Table Container */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="p-12 text-center text-slate-500 space-y-3">
              <div className="inline-block w-8 h-8 border-4 border-blue-900 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-sm">กำลังโหลดข้อมูลรายการขอเบิกเงิน...</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <p className="text-base font-medium text-slate-700">
                ไม่พบรายการขอเบิกเงิน
              </p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {searchQuery
                  ? "ลองค้นหาด้วยคำอื่น หรือเปลี่ยนตัวกรองสถานะ"
                  : scopeTab === "my"
                  ? "คุณยังไม่มีรายการขอเบิกเงิน กดปุ่ม “ขอเบิกเงินใหม่” เพื่อเริ่มยื่นคำขอ"
                  : scopeTab === "review"
                  ? "ไม่มีรายการที่รอการตรวจสอบจากคุณในขณะนี้"
                  : "ยังไม่มีรายการขอเบิกเงินในระบบ"}
              </p>
            </div>
          ) : (
            <>
              {/* Mobile Card Feed (< md) */}
              <div className="divide-y divide-slate-100 md:hidden">
                {filteredItems.map((item, idx) => {
                  const rawId = item._id || item.id || `item-${idx}`;
                  const fullTrackingId = String(item.tracking_id || rawId);
                  const isUUID = fullTrackingId.length >= 20;
                  const displayId = isUUID
                    ? `${fullTrackingId.substring(0, 13)}...`
                    : fullTrackingId;

                  const title =
                    item.title || item.purpose || "ไม่มีชื่อรายการ";
                  const departmentName =
                    item.department_name ||
                    item.department?.name ||
                    item.staff_dept_name ||
                    "ไม่ระบุฝ่าย";
                  const projectName =
                    item.project_name ||
                    item.project?.name ||
                    item.project_code ||
                    "โครงการทั่วไป";

                  let amount = 0;
                  if (typeof item.amount === "number") {
                    amount = item.amount;
                  } else if (
                    Array.isArray(item.details) &&
                    item.details.length > 0
                  ) {
                    amount = item.details.reduce(
                      (sum: number, d: any) => sum + (Number(d.amount) || 0),
                      0
                    );
                  }

                  const formattedAmount = `฿${amount.toLocaleString("th-TH", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}`;

                  const status =
                    item.status || item.latest_status || "waiting";

                  const rawDate = item.created_at || item.createdAt || item.date;
                  let formattedDate = "-";
                  if (rawDate) {
                    try {
                      const d = new Date(rawDate);
                      if (!isNaN(d.getTime())) {
                        formattedDate = d.toLocaleDateString("th-TH", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        });
                      }
                    } catch {
                      formattedDate = String(rawDate);
                    }
                  }

                  return (
                    <div
                      key={rawId}
                      onClick={() => {
                        setSelectedItem(item);
                        setIsDetailModalOpen(true);
                      }}
                      className="group p-4 active:bg-blue-50/40 hover:bg-slate-50/70 transition-all cursor-pointer space-y-2.5"
                    >
                      {/* Top Row: Tracking ID Badge with Copy & Status Badge */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span
                            className="font-mono text-[11px] font-semibold text-blue-900 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100/80 truncate max-w-[170px]"
                            title={`รหัสติดตามเต็ม: ${fullTrackingId}`}
                          >
                            {displayId}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => handleCopyTrackingId(fullTrackingId, e)}
                            className="p-1 text-slate-400 hover:text-blue-900 hover:bg-slate-100 rounded transition-colors shrink-0"
                            title="คัดลอกรหัสติดตาม"
                          >
                            {copiedId === fullTrackingId ? (
                              <span className="text-[10px] text-emerald-600 font-bold">คัดลอกแล้ว</span>
                            ) : (
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            )}
                          </button>
                        </div>
                        <StatusBadge status={status} />
                      </div>

                      <h4 className="text-sm font-semibold text-slate-900 line-clamp-2 group-hover:text-blue-900 transition-colors">
                        {title}
                      </h4>

                      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                        <span className="bg-slate-100 px-2 py-0.5 rounded-md font-medium text-slate-600">
                          {departmentName}
                        </span>
                        <span>•</span>
                        <span className="bg-slate-100 px-2 py-0.5 rounded-md text-slate-600">
                          {projectName}
                        </span>
                      </div>

                      <div className="flex items-center justify-between pt-2.5 border-t border-slate-100 text-xs">
                        <span className="text-slate-400">{formattedDate}</span>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-900 text-sm">
                            {formattedAmount}
                          </span>
                          <svg
                            className="w-4 h-4 text-blue-900 transition-transform group-hover:translate-x-1"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 5l7 7-7 7"
                            />
                          </svg>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop Table (>= md) */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200/80 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      <th className="py-3.5 px-4 whitespace-nowrap min-w-[280px]">รหัสติดตาม (TRACKING ID)</th>
                      <th className="py-3.5 px-4">รายการ (Title)</th>
                      <th className="py-3.5 px-4">ฝ่าย (Department)</th>
                      <th className="py-3.5 px-4">โครงการ (Project)</th>
                      <th className="py-3.5 px-4 text-right">
                        จำนวนเงิน (Amount)
                      </th>
                      <th className="py-3.5 px-4">สถานะ (Status)</th>
                      <th className="py-3.5 px-4">วันที่ (Date)</th>
                      <th className="py-3.5 px-4 text-center">
                        การกระทำ (Action)
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                    {filteredItems.map((item, idx) => {
                      const rawId = item._id || item.id || `item-${idx}`;
                      const fullTrackingId = String(item.tracking_id || rawId);

                      const title =
                        item.title || item.purpose || "ไม่มีชื่อรายการ";
                      const departmentName =
                        item.department_name ||
                        item.department?.name ||
                        item.staff_dept_name ||
                        "ไม่ระบุฝ่าย";
                      const projectName =
                        item.project_name ||
                        item.project?.name ||
                        item.project_code ||
                        "โครงการทั่วไป";

                      let amount = 0;
                      if (typeof item.amount === "number") {
                        amount = item.amount;
                      } else if (
                        Array.isArray(item.details) &&
                        item.details.length > 0
                      ) {
                        amount = item.details.reduce(
                          (sum: number, d: any) => sum + (Number(d.amount) || 0),
                          0
                        );
                      }

                      const formattedAmount = `฿${amount.toLocaleString("th-TH", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}`;

                      const status =
                        item.status || item.latest_status || "waiting";

                      const rawDate = item.created_at || item.createdAt || item.date;
                      let formattedDate = "-";
                      if (rawDate) {
                        try {
                          const d = new Date(rawDate);
                          if (!isNaN(d.getTime())) {
                            formattedDate = d.toLocaleDateString("th-TH", {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            });
                          }
                        } catch {
                          formattedDate = String(rawDate);
                        }
                      }

                      return (
                        <tr
                          key={rawId}
                          onClick={() => {
                            setSelectedItem(item);
                            setIsDetailModalOpen(true);
                          }}
                          className="hover:bg-slate-50/80 cursor-pointer transition-colors group"
                        >
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <span
                                className="font-mono text-xs font-semibold text-blue-900 bg-blue-50/90 px-2.5 py-1 rounded-lg border border-blue-100/90 group-hover:bg-blue-100 transition-colors select-all whitespace-nowrap"
                                title={`รหัสติดตามเต็ม: ${fullTrackingId}`}
                              >
                                {fullTrackingId}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => handleCopyTrackingId(fullTrackingId, e)}
                                className="p-1 text-slate-400 hover:text-blue-900 hover:bg-slate-100 rounded transition-colors opacity-70 hover:opacity-100 cursor-pointer"
                                title="คัดลอกรหัสเต็ม"
                              >
                                {copiedId === fullTrackingId ? (
                                  <span className="text-[10px] text-emerald-600 font-bold">✓</span>
                                ) : (
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                  </svg>
                                )}
                              </button>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 font-medium text-slate-900 max-w-xs truncate">
                            {title}
                          </td>
                          <td className="py-3.5 px-4 text-slate-600">
                            {departmentName}
                          </td>
                          <td className="py-3.5 px-4 text-slate-600">
                            {projectName}
                          </td>
                          <td className="py-3.5 px-4 text-right font-semibold text-slate-900">
                            {formattedAmount}
                          </td>
                          <td className="py-3.5 px-4">
                            <StatusBadge status={status} />
                          </td>
                          <td className="py-3.5 px-4 text-xs text-slate-500 whitespace-nowrap">
                            {formattedDate}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedItem(item);
                                setIsDetailModalOpen(true);
                              }}
                              className="inline-flex items-center gap-1 text-xs text-blue-900 hover:text-blue-700 font-medium bg-zinc-50 hover:bg-blue-50 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                            >
                              <svg
                                className="w-3.5 h-3.5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                />
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                                />
                              </svg>
                              ดูรายละเอียด
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Modals */}
        <ReimbursementFormModal
          isOpen={isFormModalOpen}
          onClose={() => setIsFormModalOpen(false)}
          onSuccess={fetchReimbursements}
        />

        <ReimbursementDetailModal
          isOpen={isDetailModalOpen}
          item={selectedItem}
          onClose={() => {
            setIsDetailModalOpen(false);
            setSelectedItem(null);
          }}
          onSuccess={fetchReimbursements}
        />
      </div>
    </AppShell>
  );
}
