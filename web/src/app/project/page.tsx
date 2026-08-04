"use client";

import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { AppShell } from "@/components/layout";
import { ProjectCard, CreateProjectModal } from "@/components/project";
import { getProjectsApi } from "@/lib/api/projects";

interface ProjectItem {
  _id?: string;
  id?: string;
  name: string;
  code?: string;
  description?: string;
  allocated_budget?: number;
  actual_expense?: number;
}

const MOCK_FALLBACK_PROJECTS: ProjectItem[] = [
  {
    _id: "p1",
    name: "The Coming of Stages 3",
    code: "PRJ-2026-001",
    description: "โครงการผลิตรายการเวทีการแสดงเพื่อความบันเทิงและพัฒนาศักยภาพชุมชน",
    allocated_budget: 1500000,
    actual_expense: 450000,
  },
  {
    _id: "p2",
    name: "ระบบบริหารการเงินและงบประมาณ",
    code: "PRJ-2026-002",
    description: "ระบบติดตามงบประมาณ การเบิกจ่าย และการอนุมัติรายจ่ายขององค์กร",
    allocated_budget: 800000,
    actual_expense: 720000,
  },
  {
    _id: "p3",
    name: "โครงการจัดหาครุภัณฑ์เทคโนโลยี 2026",
    code: "PRJ-2026-003",
    description: "จัดซื้อเครื่องคอมพิวเตอร์และอุปกรณ์ไอทีสำหรับการทำงานของเจ้าหน้าที่",
    allocated_budget: 500000,
    actual_expense: 120000,
  },
];

export default function ProjectsPage() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const canCreateProject = user?.role === "admin" || user?.role === "owner";

  const fetchProjects = async () => {
    setIsLoading(true);
    try {
      const res = await getProjectsApi();
      if (res.data) {
        const dataList = Array.isArray(res.data)
          ? res.data
          : (res.data as any).data && Array.isArray((res.data as any).data)
          ? (res.data as any).data
          : [];

        if (dataList.length > 0) {
          setProjects(dataList);
        } else {
          setProjects(MOCK_FALLBACK_PROJECTS);
        }
      } else {
        setProjects(MOCK_FALLBACK_PROJECTS);
      }
    } catch {
      setProjects(MOCK_FALLBACK_PROJECTS);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) return projects;
    const q = searchQuery.toLowerCase().trim();
    return projects.filter(
      (p) =>
        p.name?.toLowerCase().includes(q) ||
        p.code?.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q)
    );
  }, [projects, searchQuery]);

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              รายการแผนงานทั้งหมด (Projects)
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              การจัดสรรงบประมาณ ติดตามค่าใช้จ่าย และสถานะการดำเนินงานของแต่ละโครงการ
            </p>
          </div>

          {canCreateProject && (
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="bg-blue-900 hover:bg-blue-800 text-white rounded-xl px-4 py-2.5 shadow-sm shadow-blue-900/20 text-sm font-medium flex items-center gap-2 cursor-pointer self-start sm:self-auto transition-colors shrink-0"
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
              <span>เพิ่ม Project</span>
            </button>
          )}
        </div>

        {/* Search Bar Container */}
        <div className="relative max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
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
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ค้นหาชื่อโครงการ หรือรหัสโปรเจกต์..."
            className="w-full pl-10 pr-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 shadow-sm placeholder:text-slate-400 transition-all"
          />
        </div>

        {/* Projects Grid Container */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm animate-pulse h-48 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="h-5 bg-slate-200 rounded w-3/4" />
                  <div className="h-4 bg-slate-100 rounded w-full" />
                </div>
                <div className="h-4 bg-slate-200 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : filteredProjects.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProjects.map((p) => (
              <ProjectCard key={p._id || p.id} project={p} />
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <svg
              className="w-12 h-12 text-slate-300 mx-auto mb-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
              />
            </svg>
            <p className="text-slate-500 font-medium text-sm">
              ไม่พบโครงการที่ตรงกับคำค้นหา
            </p>
          </div>
        )}

        {/* Modal Integration */}
        <CreateProjectModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={() => {
            setIsCreateModalOpen(false);
            fetchProjects();
          }}
        />
      </div>
    </AppShell>
  );
}
