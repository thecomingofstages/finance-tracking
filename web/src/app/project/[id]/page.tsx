"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { AppShell } from "@/components/layout";
import {
  SourceSection,
  TagSection,
  DepartmentSection,
  ExpenseHistorySection,
} from "@/components/project";
import type {
  ProjectSource,
  ProjectTag,
  ProjectDepartment,
  ReimbursementItem,
} from "@/components/project/types";
import { ReimbursementDetailModal } from "@/components/reimburse";
import {
  getProjectDetailApi,
  getProjectTagsApi,
  getProjectDepartmentsApi,
  getProjectSourcesApi,
} from "@/lib/api/projects";
import { getReimbursementsApi } from "@/lib/api/reimbursements";

export interface ProjectDetail {
  id?: string;
  _id?: string;
  name: string;
  code?: string;
  description?: string;
  allocated_budget?: number;
  total_income?: number;
  total_expense?: number;
  actual_expense?: number;
  status?: string;
}

// ── Fallback mock data ──────────────────────────────────────────

const MOCK_PROJECT: ProjectDetail = {
  id: "p1", _id: "p1", name: "The Coming of Stages 3", code: "PRJ-2026-001",
  description: "โครงการผลิตรายการเวทีการแสดงเพื่อความบันเทิงและพัฒนาศักยภาพชุมชน",
  allocated_budget: 1500000, total_income: 820000, total_expense: 450000, status: "active",
};

const MOCK_SOURCES = [
  { _id: "s1", type: "enroll", name: "The Coming of Stages 3 — บัตร Early Bird", expect_amount: 300000, actual_amount: 280000 },
  { _id: "s2", type: "enroll", name: "The Coming of Stages 3 — บัตร Regular", expect_amount: 200000, actual_amount: 150000 },
  { _id: "s3", type: "merch", name: "เสื้อทีม Official", expect_amount: 100000, actual_amount: 90000 },
  { _id: "s4", type: "spon", name: "บริษัท ABC จำกัด", expect_amount: 150000, actual_amount: 150000 },
  { _id: "s5", type: "spon", name: "บริษัท XYZ จำกัด (มหาชน)", expect_amount: 100000, actual_amount: 100000 },
  { _id: "s6", type: "other", name: "เงินสนับสนุนจากมหาวิทยาลัย", expect_amount: 50000, actual_amount: 50000 },
];

const MOCK_DEPARTMENTS = [
  { id: "d1", name: "ฝ่ายการละคร", allocated_budget: 600000, total_expense: 200000 },
  { id: "d2", name: "ฝ่ายการเงินและบัญชี", allocated_budget: 400000, total_expense: 150000 },
  { id: "d3", name: "ฝ่ายเทคนิคและสถานที่", allocated_budget: 500000, total_expense: 100000 },
];

const MOCK_TAGS = [
  { id: "t1", name: "ค่าอุปกรณ์/วิก/เครื่องแต่งกาย", allocated_budget: 200000, total_income: 0, total_expense: 180000 },
  { id: "t2", name: "ค่าสถานที่/เวที", allocated_budget: 300000, total_income: 0, total_expense: 150000 },
  { id: "t3", name: "ค่าเบี้ยเลี้ยง/สวัสดิการ", allocated_budget: 100000, total_income: 0, total_expense: 80000 },
  { id: "t4", name: "ค่าสื่อและประชาสัมพันธ์", allocated_budget: 80000, total_income: 0, total_expense: 40000 },
];

const MOCK_REIMBURSEMENTS = [
  { id: "reim-001", _id: "reim-001", title: "ค่าอุปกรณ์ประกอบฉากรอบซ้อมใหญ่", amount: 15500, status: "waiting", department_name: "ฝ่ายการละคร", created_at: "2026-08-01T10:30:00Z", tag_name: "ค่าอุปกรณ์/วิก/เครื่องแต่งกาย" },
  { id: "reim-002", _id: "reim-002", title: "ค่าเช่าไมโครโฟนไร้สาย", amount: 8500, status: "head_approve", department_name: "ฝ่ายเทคนิคและสถานที่", created_at: "2026-07-30T14:15:00Z", tag_name: "ค่าสถานที่/เวที" },
  { id: "reim-003", _id: "reim-003", title: "ค่าพิมพ์โปสเตอร์", amount: 12400, status: "fin_approve", department_name: "ฝ่ายการเงินและบัญชี", created_at: "2026-07-28T11:00:00Z", tag_name: "ค่าสื่อและประชาสัมพันธ์" },
  { id: "reim-004", _id: "reim-004", title: "ค่าอาหารซ้อมใหญ่", amount: 4200, status: "transfer", department_name: "ฝ่ายการละคร", created_at: "2026-07-25T16:45:00Z", tag_name: "ค่าเบี้ยเลี้ยง/สวัสดิการ" },
];

// ── helpers ──────────────────────────────────────────

const formatTHB = (val: number) =>
  `฿${val.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const extractList = (data: any) => {
  if (Array.isArray(data)) return data;
  if (data?.data && Array.isArray(data.data)) return data.data;
  if (data?.items && Array.isArray(data.items)) return data.items;
  return [];
};

// ── Page component ──────────────────────────────────────────

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const projectId = resolvedParams.id;
  const { user } = useAuth();

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [sources, setSources] = useState<ProjectSource[]>([]);
  const [departments, setDepartments] = useState<ProjectDepartment[]>([]);
  const [tags, setTags] = useState<ProjectTag[]>([]);
  const [reimbursements, setReimbursements] = useState<ReimbursementItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [selectedReimbursement, setSelectedReimbursement] = useState<ReimbursementItem | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Role checks
  const isFinanceOrOwner = Boolean(
    user && (user.role === "admin" || user.role === "finance" || user.role === "owner" ||
      user.scope?.finance_of?.length || user.scope?.memberships?.some((m: any) => m.is_finance))
  );
  const isHR = user?.role === "hr";
  const canManageDepts = isFinanceOrOwner || isHR;

  const fetchAll = async () => {
    setIsLoading(true);
    try {
      const projRes = await getProjectDetailApi(projectId);
      const pData = (projRes.data as any)?.data || projRes.data;
      setProject(pData || { ...MOCK_PROJECT, id: projectId });
    } catch { setProject({ ...MOCK_PROJECT, id: projectId }); }

    try { const r = await getProjectSourcesApi(projectId); const l = extractList(r.data); setSources(l.length > 0 ? l : MOCK_SOURCES); }
    catch { setSources(MOCK_SOURCES); }

    try { const r = await getProjectDepartmentsApi(projectId); const l = extractList(r.data); setDepartments(l.length > 0 ? l : MOCK_DEPARTMENTS); }
    catch { setDepartments(MOCK_DEPARTMENTS); }

    try { const r = await getProjectTagsApi(projectId); const l = extractList(r.data); setTags(l.length > 0 ? l : MOCK_TAGS); }
    catch { setTags(MOCK_TAGS); }

    try { const r = await getReimbursementsApi({ project_id: projectId, limit: 200 }); const l = extractList(r.data); setReimbursements(l.length > 0 ? l : MOCK_REIMBURSEMENTS); }
    catch { setReimbursements(MOCK_REIMBURSEMENTS); }

    setIsLoading(false);
  };

  useEffect(() => { fetchAll(); }, [projectId]);

  const allocatedBudget = Number(project?.allocated_budget) || 0;
  const totalIncome = Number(project?.total_income) || sources.reduce((s, src) => s + (Number(src.actual_amount) || 0), 0);
  const totalExpense = Number(project?.total_expense) || Number(project?.actual_expense) || 0;
  const balance = totalIncome - totalExpense;

  return (
    <AppShell>
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        {/* Back Link */}
        <div>
          <Link href="/project" className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-blue-600 transition-colors">
            <span>← กลับไปยังรายการแผนงาน</span>
          </Link>
        </div>

        {/* Header */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
          {isLoading ? (
            <div className="animate-pulse space-y-3"><div className="h-7 bg-slate-200 rounded w-1/3" /><div className="h-4 bg-slate-100 rounded w-2/3" /></div>
          ) : (
            <div>
              <div className="flex items-center gap-3 flex-wrap mb-1">
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{project?.name || "ไม่ระบุชื่อโครงการ"}</h1>
                {project?.code && <span className="font-mono text-xs font-semibold text-blue-900 bg-zinc-50 px-2.5 py-1 rounded-md border border-slate-200">{project.code}</span>}
              </div>
              <p className="text-sm text-slate-500 max-w-3xl">{project?.description || "ไม่มีคำอธิบายสำหรับโครงการนี้"}</p>
            </div>
          )}
        </div>

        {/* Summary Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "งบประมาณจัดสรร", value: allocatedBudget, color: "blue", icon: "M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" },
            { label: "รายรับรวม", value: totalIncome, color: "emerald", icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
            { label: "รายจ่ายรวม", value: totalExpense, color: "amber", icon: "M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" },
            { label: "คงเหลือ", value: balance, color: balance >= 0 ? "emerald" : "rose", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" },
          ].map((card) => (
            <div key={card.label} className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-2">
                <span>{card.label}</span>
                <div className={`p-1.5 bg-${card.color}-50 text-${card.color}-700 rounded-md`}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={card.icon} />
                  </svg>
                </div>
              </div>
              <div className={`text-xl font-bold ${card.label === "คงเหลือ" && balance < 0 ? "text-rose-600" : "text-slate-900"}`}>
                {isLoading ? "..." : formatTHB(card.value)}
              </div>
            </div>
          ))}
        </div>

        {/* Source Section */}
        <SourceSection
          projectId={projectId}
          sources={sources}
          tags={tags}
          isPrivileged={isFinanceOrOwner}
          onRefresh={fetchAll}
        />

        {/* Tag Section */}
        <TagSection
          projectId={projectId}
          tags={tags}
          isPrivileged={isFinanceOrOwner}
          onRefresh={fetchAll}
        />

        {/* Department Section */}
        <DepartmentSection
          projectId={projectId}
          departments={departments}
          isPrivileged={canManageDepts}
          onRefresh={fetchAll}
        />

        {/* Expense History Section */}
        <ExpenseHistorySection
          reimbursements={reimbursements}
          departments={departments}
          tags={tags}
          onItemClick={(item) => {
            setSelectedReimbursement(item);
            setIsDetailModalOpen(true);
          }}
        />

        {/* Reimbursement Detail Modal */}
        <ReimbursementDetailModal
          isOpen={isDetailModalOpen}
          item={selectedReimbursement}
          onClose={() => { setIsDetailModalOpen(false); setSelectedReimbursement(null); }}
          onSuccess={fetchAll}
        />
      </div>
    </AppShell>
  );
}
