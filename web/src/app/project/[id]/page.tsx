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

import { formatCurrencyTH } from "@/lib/format";

// ── helpers ──────────────────────────────────────────

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
      setProject(pData || null);
    } catch { setProject(null); }

    try { const r = await getProjectSourcesApi(projectId); setSources(extractList(r.data)); }
    catch { setSources([]); }

    try { const r = await getProjectDepartmentsApi(projectId); setDepartments(extractList(r.data)); }
    catch { setDepartments([]); }

    try { const r = await getProjectTagsApi(projectId); setTags(extractList(r.data)); }
    catch { setTags([]); }

    try { const r = await getReimbursementsApi({ project_id: projectId, limit: 200 }); setReimbursements(extractList(r.data)); }
    catch { setReimbursements([]); }

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
          ) : !project ? (
            <div className="text-center py-6 space-y-1.5">
              <p className="text-base font-semibold text-slate-700">ไม่พบโครงการนี้</p>
              <p className="text-xs text-slate-500">โครงการอาจถูกลบไปแล้ว หรือคุณไม่มีสิทธิ์เข้าถึง</p>
            </div>
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
                {isLoading ? "..." : formatCurrencyTH(card.value)}
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
