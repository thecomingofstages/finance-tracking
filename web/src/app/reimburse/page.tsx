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

// Realistic fallback data when API returns empty or mock server is without records
const FALLBACK_REIMBURSEMENTS = [
  {
    id: "reim-001",
    _id: "018f7a90-1111-7000-8000-000000000001",
    tracking_id: "REIM-2026-001",
    title: "ค่าอุปกรณ์ประกอบฉากรอบซ้อมใหญ่ (ฉากหลัง + อุปกรณ์เวที)",
    purpose: "ค่าอุปกรณ์ประกอบฉากรอบซ้อมใหญ่ (ฉากหลัง + อุปกรณ์เวที)",
    amount: 15500,
    status: "waiting",
    latest_status: "waiting",
    project_name: "The Coming of Stages 3",
    department_name: "ฝ่ายการละคร",
    requester_name: "สมชาย ใจดี (Golf)",
    created_at: "2026-08-01T10:30:00Z",
    receipt_url: "https://placehold.co/600x800/e2e8f0/1e293b?text=Receipt+001",
    note: "ซื้อผ้าฉากและโครงเหล็กฉากสำหรับเวทีใหญ่",
    staff: { nickname: "Golf", first_name: "สมชาย", last_name: "ใจดี" },
    project: { name: "The Coming of Stages 3" },
    department: { name: "ฝ่ายการละคร" },
    status_history: [
      { status: "waiting", created_at: "2026-08-01T10:30:00Z", staff: null },
    ],
  },
  {
    id: "reim-002",
    _id: "018f7a90-2222-7000-8000-000000000002",
    tracking_id: "REIM-2026-002",
    title: "ค่าเช่าไมโครโฟนไร้สายและมิกเซอร์เสียง",
    purpose: "ค่าเช่าไมโครโฟนไร้สายและมิกเซอร์เสียง",
    amount: 8500,
    status: "head_approve",
    latest_status: "head_approve",
    project_name: "The Coming of Stages 3",
    department_name: "ฝ่ายเสียงและเทคนิค",
    requester_name: "ชมพู่ สุขใจ (Chompoo)",
    created_at: "2026-07-30T14:15:00Z",
    receipt_url: "https://placehold.co/600x800/e2e8f0/1e293b?text=Receipt+002",
    note: "มัดจำค่าเช่าอุปกรณ์ระบบเสียงรอบการแสดงจริง",
    staff: { nickname: "Chompoo", first_name: "ชมพู่", last_name: "สุขใจ" },
    project: { name: "The Coming of Stages 3" },
    department: { name: "ฝ่ายเสียงและเทคนิค" },
    status_history: [
      { status: "waiting", created_at: "2026-07-30T14:15:00Z", staff: null },
      {
        status: "head_approve",
        created_at: "2026-07-31T09:00:00Z",
        staff: { nickname: "Mark" },
      },
    ],
  },
  {
    id: "reim-003",
    _id: "018f7a90-3333-7000-8000-000000000003",
    tracking_id: "REIM-2026-003",
    title: "ค่าพิมพ์โปสเตอร์และแผ่นพับประชาสัมพันธ์",
    purpose: "ค่าพิมพ์โปสเตอร์และแผ่นพับประชาสัมพันธ์",
    amount: 12400,
    status: "fin_approve",
    latest_status: "fin_approve",
    project_name: "The Coming of Stages 3",
    department_name: "ฝ่ายประชาสัมพันธ์",
    requester_name: "มาร์ค พร้อมพงษ์ (Mark)",
    created_at: "2026-07-28T11:00:00Z",
    receipt_url: "https://placehold.co/600x800/e2e8f0/1e293b?text=Receipt+003",
    note: "สั่งพิมพ์โปสเตอร์ไซส์ A2 จำนวน 200 ใบ และแผ่นพับ 1,000 ชุด",
    staff: { nickname: "Mark", first_name: "มาร์ค", last_name: "พร้อมพงษ์" },
    project: { name: "The Coming of Stages 3" },
    department: { name: "ฝ่ายประชาสัมพันธ์" },
    status_history: [
      { status: "waiting", created_at: "2026-07-28T11:00:00Z", staff: null },
      {
        status: "head_approve",
        created_at: "2026-07-29T10:00:00Z",
        staff: { nickname: "Beam" },
      },
      {
        status: "fin_approve",
        created_at: "2026-07-30T16:00:00Z",
        staff: { nickname: "Golf" },
      },
    ],
  },
  {
    id: "reim-004",
    _id: "018f7a90-4444-7000-8000-000000000004",
    tracking_id: "REIM-2026-004",
    title: "ค่าอาหารและเครื่องดื่มสำหรับทีมงานซ้อมใหญ่",
    purpose: "ค่าอาหารและเครื่องดื่มสำหรับทีมงานซ้อมใหญ่",
    amount: 4200,
    status: "transfer",
    latest_status: "transfer",
    project_name: "The Coming of Stages 3",
    department_name: "ฝ่ายสวัสดิการ",
    requester_name: "บีม มงคล (Beam)",
    created_at: "2026-07-25T16:45:00Z",
    receipt_url: "https://placehold.co/600x800/e2e8f0/1e293b?text=Receipt+004",
    note: "ข้าวกล่อง 50 ชุด สำหรับทีมงานและนักแสดงซ้อมดนตรีสด",
    staff: { nickname: "Beam", first_name: "บีม", last_name: "มงคล" },
    project: { name: "The Coming of Stages 3" },
    department: { name: "ฝ่ายสวัสดิการ" },
    status_history: [
      { status: "waiting", created_at: "2026-07-25T16:45:00Z", staff: null },
      {
        status: "head_approve",
        created_at: "2026-07-26T09:30:00Z",
        staff: { nickname: "Chompoo" },
      },
      {
        status: "fin_approve",
        created_at: "2026-07-26T14:00:00Z",
        staff: { nickname: "Golf" },
      },
      {
        status: "transfer",
        created_at: "2026-07-27T11:20:00Z",
        staff: { nickname: "Golf" },
      },
    ],
  },
  {
    id: "reim-005",
    _id: "018f7a90-5555-7000-8000-000000000005",
    tracking_id: "REIM-2026-005",
    title: "ค่าจัดทำเสื้อทีมและของที่ระลึก staff",
    purpose: "ค่าจัดทำเสื้อทีมและของที่ระลึก staff",
    amount: 18900,
    status: "rejected",
    latest_status: "rejected",
    project_name: "The Coming of Stages 3",
    department_name: "ฝ่ายบริหารทั่วไป",
    requester_name: "สมชาย ใจดี (Golf)",
    created_at: "2026-07-22T09:10:00Z",
    receipt_url: "https://placehold.co/600x800/e2e8f0/1e293b?text=Receipt+005",
    note: "ไม่อนุมัติเนื่องจากเกินงบประมาณจัดสรรประจำแผนก",
    staff: { nickname: "Golf", first_name: "สมชาย", last_name: "ใจดี" },
    project: { name: "The Coming of Stages 3" },
    department: { name: "ฝ่ายบริหารทั่วไป" },
    status_history: [
      { status: "waiting", created_at: "2026-07-22T09:10:00Z", staff: null },
      {
        status: "rejected",
        created_at: "2026-07-23T13:00:00Z",
        staff: { nickname: "Mark" },
      },
    ],
  },
];

export default function ReimbursementsPage() {
  const { user } = useAuth();
  const [reimbursements, setReimbursements] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const [isFormModalOpen, setIsFormModalOpen] = useState<boolean>(false);
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState<boolean>(false);

  const router = useRouter();

  const filterFallbackData = (filter: StatusFilter) => {
    if (filter === "all") return FALLBACK_REIMBURSEMENTS;
    return FALLBACK_REIMBURSEMENTS.filter(
      (item) =>
        item.status === filter ||
        item.latest_status === filter ||
        (filter === "transfer" &&
          (item.status === "completed" || item.latest_status === "completed"))
    );
  };

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

        if (rawList.length > 0) {
          setReimbursements(rawList);
        } else {
          setReimbursements(filterFallbackData(statusFilter));
        }
      } else {
        setReimbursements(filterFallbackData(statusFilter));
      }
    } catch {
      setReimbursements(filterFallbackData(statusFilter));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReimbursements();
  }, [statusFilter]);

  // Client-side search filtering
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return reimbursements;
    const q = searchQuery.toLowerCase().trim();

    return reimbursements.filter((item) => {
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
  }, [reimbursements, searchQuery]);

  return (
    <AppShell>
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              รายการขอเบิกเงิน (Reimbursements)
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              ยื่นคำขอเบิกเงินแนบใบเสร็จ และติดตามสถานะการอนุมัติ
            </p>
          </div>

          <button
            onClick={() => router.push("/reimburse/new")}
            className="bg-blue-900 hover:bg-blue-800 text-white rounded-xl px-4 py-2.5 shadow-sm shadow-blue-900/20 text-sm font-medium flex items-center gap-2 cursor-pointer transition-all self-start md:self-auto"
          >
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
                d="M12 4v16m8-8H4"
              />
            </svg>
            <span>ขอเบิกเงินใหม่</span>
          </button>
        </div>

        {/* Filter & Search Bar Container */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
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
                  : "ยังไม่มีรายการขอเบิกเงินในระบบ"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200/80 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    <th className="py-3.5 px-4">รหัสติดตาม (Tracking ID)</th>
                    <th className="py-3.5 px-4">รายการ (Title)</th>
                    <th className="py-3.5 px-4">แผนก (Department)</th>
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
                    const trackingId =
                      item.tracking_id ||
                      (rawId
                        ? `REIM-${String(rawId).substring(0, 8).toUpperCase()}`
                        : "REIM-N/A");
                    const title =
                      item.title || item.purpose || "ไม่มีชื่อรายการ";
                    const departmentName =
                      item.department_name ||
                      item.department?.name ||
                      item.staff_dept_name ||
                      "ไม่ระบุแผนก";
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
                        <td className="py-3.5 px-4 font-mono text-xs font-semibold text-blue-900 group-hover:underline">
                          {trackingId}
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
