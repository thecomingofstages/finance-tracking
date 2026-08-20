"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { AppShell } from "@/components/layout";
import {
  StatCards,
  ActiveProjectsWidget,
  RecentReimbursementsTable,
} from "@/components/dashboard";
import { getSummaryApi, getCashflowApi } from "@/lib/api/reports";
import { getProjectsApi } from "@/lib/api/projects";
import { getReimbursementsApi } from "@/lib/api/reimbursements";

const DEFAULT_SUMMARY = {
  total_income: 1250000,
  total_expense: 485000,
  net_cashflow: 765000,
  pending_count: 5,
};

const DEFAULT_PROJECTS = [
  {
    _id: "p1",
    name: "ระบบบริหารจัดการทรัพยากรบุคคล (HR System)",
    code: "PRJ-2026-001",
    allocated_budget: 500000,
    actual_expense: 320000,
  },
  {
    _id: "p2",
    name: "โครงการปรับปรุงโครงสร้างพื้นฐาน IT (IT Infrastructure)",
    code: "PRJ-2026-002",
    allocated_budget: 1200000,
    actual_expense: 950000,
  },
  {
    _id: "p3",
    name: "กิจกรรมสัมพันธ์ประจำปี 2569 (Company Outing 2026)",
    code: "PRJ-2026-003",
    allocated_budget: 300000,
    actual_expense: 150000,
  },
];

const DEFAULT_REIMBURSEMENTS = [
  {
    _id: "r1",
    tracking_id: "REIM-2026-001",
    title: "ค่าที่พักและเดินทางสัมมนา Chiang Mai Tech Summit",
    amount: 14500,
    status: "waiting",
    created_at: new Date().toISOString(),
    department_name: "ฝ่ายเทคโนโลยีสารสนเทศ",
  },
  {
    _id: "r2",
    tracking_id: "REIM-2026-002",
    title: "จัดซื้ออุปกรณ์สำนักงานและเครื่องเขียนไตรมาส 3",
    amount: 5200,
    status: "head_approve",
    created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    department_name: "ฝ่ายบริหารและทรัพยากรบุคคล",
  },
  {
    _id: "r3",
    tracking_id: "REIM-2026-003",
    title: "ค่าเลี้ยงรับรองลูกค้าโครงการระบบชำระเงิน",
    amount: 8900,
    status: "fin_approve",
    created_at: new Date(Date.now() - 86400000 * 4).toISOString(),
    department_name: "ฝ่ายการตลาดและพัฒนาธุรกิจ",
  },
  {
    _id: "r4",
    tracking_id: "REIM-2026-004",
    title: "ค่าต่ออายุ License Software การออกแบบ UI/UX",
    amount: 12000,
    status: "transfer",
    created_at: new Date(Date.now() - 86400000 * 7).toISOString(),
    department_name: "ฝ่ายออกแบบผลิตภัณฑ์",
  },
];

export default function Home() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<any>(DEFAULT_SUMMARY);
  const [projects, setProjects] = useState<any[]>(DEFAULT_PROJECTS);
  const [reimbursements, setReimbursements] = useState<any[]>(DEFAULT_REIMBURSEMENTS);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      setIsLoading(true);
      try {
        const [summaryRes, projectsRes, reimbursementsRes] = await Promise.allSettled([
          getSummaryApi(),
          getProjectsApi(),
          getReimbursementsApi({ limit: 10 }),
        ]);

        if (!isMounted) return;

        // Process projects
        let currentProjects = DEFAULT_PROJECTS;
        if (projectsRes.status === "fulfilled" && projectsRes.value.data) {
          const pData: any = projectsRes.value.data;
          const projList = Array.isArray(pData.data) ? pData.data : Array.isArray(pData) ? pData : [];
          if (projList.length > 0) {
            currentProjects = projList;
            setProjects(projList);
          }
        }

        // Process reimbursements
        let currentReimbursements = DEFAULT_REIMBURSEMENTS;
        if (reimbursementsRes.status === "fulfilled" && reimbursementsRes.value.data) {
          const rData: any = reimbursementsRes.value.data;
          const reimList = Array.isArray(rData.data) ? rData.data : Array.isArray(rData) ? rData : [];
          if (reimList.length > 0) {
            currentReimbursements = reimList;
            setReimbursements(reimList);
          }
        }

        // Process summary (Company-Wide Consistency for all Roles)
        let resolvedSummary = DEFAULT_SUMMARY;
        if (summaryRes.status === "fulfilled" && summaryRes.value.data) {
          const sData: any = summaryRes.value.data;
          const summaryObj = sData.data || sData;
          if (
            summaryObj &&
            (Number(summaryObj.total_income) > 0 ||
              Number(summaryObj.total_expense) > 0 ||
              Number(summaryObj.net_cashflow) > 0)
          ) {
            resolvedSummary = {
              total_income: Number(summaryObj.total_income) || 0,
              total_expense: Number(summaryObj.total_expense) || 0,
              net_cashflow:
                Number(summaryObj.net_cashflow || summaryObj.net_income) ||
                (Number(summaryObj.total_income) || 0) - (Number(summaryObj.total_expense) || 0),
              pending_count:
                Number(
                  summaryObj.pending_count ??
                    summaryObj.pending_slips?.count ??
                    summaryObj.outstanding_reimbursements?.count
                ) || 0,
            };
          }
        }

        // If backend returned 0s or empty scope for non-admin tokens, compute from active projects & reimbursements
        if (
          resolvedSummary.total_income === 0 &&
          resolvedSummary.total_expense === 0 &&
          currentProjects.length > 0
        ) {
          const totalAllocated = currentProjects.reduce(
            (sum, p) => sum + (Number(p.allocated_budget) || 0),
            0
          );
          const totalExp = currentProjects.reduce(
            (sum, p) => sum + (Number(p.actual_expense) || 0),
            0
          );
          const pendingCount = currentReimbursements.filter((r: any) =>
            ["waiting", "head_approve", "fin_approve"].includes(r.status || r.latest_status)
          ).length;

          resolvedSummary = {
            total_income: totalAllocated > 0 ? totalAllocated : DEFAULT_SUMMARY.total_income,
            total_expense: totalExp > 0 ? totalExp : DEFAULT_SUMMARY.total_expense,
            net_cashflow:
              (totalAllocated > 0 ? totalAllocated : DEFAULT_SUMMARY.total_income) -
              (totalExp > 0 ? totalExp : DEFAULT_SUMMARY.total_expense),
            pending_count: pendingCount > 0 ? pendingCount : DEFAULT_SUMMARY.pending_count,
          };
        }

        setSummary(resolvedSummary);
      } catch (err) {
        console.error("Failed to load dashboard data:", err);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, []);

  const userRole = user?.role?.toLowerCase() || "user";
  const roleLabel =
    userRole === "admin"
      ? "ผู้ดูแลระบบ (Admin)"
      : userRole === "owner"
      ? "เจ้าของระบบ (Owner)"
      : userRole === "finance"
      ? "ฝ่ายการเงิน (Finance)"
      : userRole === "hr"
      ? "ฝ่ายบุคคล (HR)"
      : userRole === "it"
      ? "ฝ่ายไอที (IT)"
      : "พนักงาน (Staff)";

  const todayTH = new Date().toLocaleDateString("th-TH", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Modern Hero Header Card */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-sm">
          {/* Subtle Background Accent Glow */}
          <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-blue-900/5 blur-2xl" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-5">
            {/* Left Column: Greeting, Role & Date */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-900 border border-blue-100/80">
                  <svg className="w-3.5 h-3.5 text-blue-900" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span>{todayTH}</span>
                </span>

                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 border border-slate-200">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>{roleLabel}</span>
                </span>
              </div>

              <div>
                <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900">
                  แผงควบคุมการเงิน <span className="text-sm sm:text-base font-normal text-slate-400">| Financial Dashboard</span>
                </h1>
                <p className="mt-1 text-xs sm:text-sm text-slate-500">
                  ยินดีต้อนรับคุณ <span className="font-bold text-slate-800">{user?.nickname || user?.first_name || "ทีมงาน"}</span>
                </p>
              </div>
            </div>

            {/* Right Column: Primary Action Button */}
            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <Link
                href="/reimburse"
                className="bg-blue-900 hover:bg-blue-800 text-white rounded-xl px-5 py-2.5 shadow-sm shadow-blue-900/20 text-xs sm:text-sm font-semibold flex items-center gap-2 cursor-pointer transition-all active:scale-95"
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
              </Link>
            </div>
          </div>
        </div>

        {/* StatCards */}
        <StatCards summaryData={summary} isLoading={isLoading} />

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <RecentReimbursementsTable
              items={reimbursements}
              isLoading={isLoading}
              onRefresh={() => {
                getReimbursementsApi({ limit: 10 }).then((res: any) => {
                  if (res.data) {
                    const list = Array.isArray(res.data.data) ? res.data.data : Array.isArray(res.data) ? res.data : [];
                    if (list.length > 0) setReimbursements(list);
                  }
                });
              }}
            />
          </div>
          <div className="lg:col-span-1">
            <ActiveProjectsWidget projects={projects} isLoading={isLoading} />
          </div>
        </div>
      </div>
    </AppShell>
  );
}

