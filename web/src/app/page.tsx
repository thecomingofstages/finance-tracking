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
    department_name: "แผนกเทคโนโลยีสารสนเทศ",
  },
  {
    _id: "r2",
    tracking_id: "REIM-2026-002",
    title: "จัดซื้ออุปกรณ์สำนักงานและเครื่องเขียนไตรมาส 3",
    amount: 5200,
    status: "head_approve",
    created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    department_name: "แผนกบริหารและทรัพยากรบุคคล",
  },
  {
    _id: "r3",
    tracking_id: "REIM-2026-003",
    title: "ค่าเลี้ยงรับรองลูกค้าโครงการระบบชำระเงิน",
    amount: 8900,
    status: "fin_approve",
    created_at: new Date(Date.now() - 86400000 * 4).toISOString(),
    department_name: "แผนกการตลาดและพัฒนาธุรกิจ",
  },
  {
    _id: "r4",
    tracking_id: "REIM-2026-004",
    title: "ค่าต่ออายุ License Software การออกแบบ UI/UX",
    amount: 12000,
    status: "transfer",
    created_at: new Date(Date.now() - 86400000 * 7).toISOString(),
    department_name: "แผนกออกแบบผลิตภัณฑ์",
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

        // Process summary
        if (summaryRes.status === "fulfilled" && summaryRes.value.data) {
          const sData: any = summaryRes.value.data;
          const summaryObj = sData.data || sData;
          if (
            summaryObj &&
            (summaryObj.total_income !== undefined || summaryObj.net_cashflow !== undefined)
          ) {
            setSummary(summaryObj);
          }
        }

        // Process projects
        if (projectsRes.status === "fulfilled" && projectsRes.value.data) {
          const pData: any = projectsRes.value.data;
          const projList = Array.isArray(pData.data) ? pData.data : Array.isArray(pData) ? pData : [];
          if (projList.length > 0) {
            setProjects(projList);
          }
        }

        // Process reimbursements
        if (reimbursementsRes.status === "fulfilled" && reimbursementsRes.value.data) {
          const rData: any = reimbursementsRes.value.data;
          const reimList = Array.isArray(rData.data) ? rData.data : Array.isArray(rData) ? rData : [];
          if (reimList.length > 0) {
            setReimbursements(reimList);
          }
        }
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

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header Section */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              แผงควบคุมการเงิน (Financial Dashboard)
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              ยินดีต้อนรับคุณ {user?.nickname || user?.first_name || "ทีมงาน"}
            </p>
          </div>
          <Link
            href="/reimburse"
            className="bg-blue-900 hover:bg-blue-800 text-white rounded-xl px-4 py-2.5 shadow-sm shadow-blue-900/20 text-sm font-medium flex items-center gap-2 cursor-pointer self-start sm:self-auto transition-colors"
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

        {/* StatCards */}
        <StatCards summaryData={summary} isLoading={isLoading} />

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <RecentReimbursementsTable items={reimbursements} isLoading={isLoading} />
          </div>
          <div className="lg:col-span-1">
            <ActiveProjectsWidget projects={projects} isLoading={isLoading} />
          </div>
        </div>
      </div>
    </AppShell>
  );
}

