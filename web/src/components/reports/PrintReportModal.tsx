"use client";

import React, { useState, useEffect } from "react";
import { getProjectsApi } from "@/lib/api/projects";
import { exportJournalReportApi } from "@/lib/api/reports";

export interface PrintReportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ProjectOption {
  _id?: string;
  id?: string;
  name?: string;
  code?: string;
}

export const PrintReportModal: React.FC<PrintReportModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>("all");
  const [dateRangeType, setDateRangeType] = useState<"all" | "month">("month");
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    return `${year}-${month}`;
  });
  const [isLoadingProjects, setIsLoadingProjects] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Load projects list when modal opens
  useEffect(() => {
    if (!isOpen) {
      setError(null);
      setIsExporting(false);
      return;
    }

    let isMounted = true;
    async function loadProjects() {
      setIsLoadingProjects(true);
      try {
        const res = await getProjectsApi();
        if (!isMounted) return;

        if (res.data) {
          const resData: any = res.data;
          const list = Array.isArray(resData.data)
            ? resData.data
            : Array.isArray(resData)
            ? resData
            : [];
          setProjects(list);
        }
      } catch (err) {
        console.error("Failed to fetch projects for report:", err);
      } finally {
        if (isMounted) {
          setIsLoadingProjects(false);
        }
      }
    }

    loadProjects();

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handlePrintReport = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsExporting(true);

    try {
      const projectIdParam =
        selectedProject && selectedProject !== "all" ? selectedProject : undefined;

      const res: any = await exportJournalReportApi({
        project_id: projectIdParam,
        month: dateRangeType === "month" ? selectedMonth : undefined,
      });

      if (res?.error) {
        const errData = res.error;
        setError(errData?.error?.message || "เกิดข้อผิดพลาดในการส่งออกรายงาน");
        setIsExporting(false);
        return;
      }

      // Handle CSV or file data download if returned
      const data: any = res.data;
      if (typeof data === "string") {
        const blob = new Blob([data], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute(
          "download",
          `cashflow_report_${selectedProject || "all"}_${dateRangeType === "month" ? selectedMonth : "all_time"}.csv`
        );
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else if (data?.url || data?.download_url) {
        const downloadUrl = data.url || data.download_url;
        window.open(downloadUrl, "_blank");
      }

      // Trigger print view
      window.print();

      onClose();
    } catch (err: any) {
      console.error("Export report error:", err);
      setError(err?.message || "เกิดข้อผิดพลาดในการพิมพ์รายงาน");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn print:hidden">
      <div
        className="relative w-full max-w-md overflow-hidden bg-white rounded-2xl shadow-2xl border border-slate-200 transition-all transform scale-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center space-x-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-zinc-50 text-blue-900 border border-blue-100">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
                />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                พิมพ์รายรับ - รายจ่าย
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                เลือก Project และกำหนดช่วงเวลาสำหรับสั่งพิมพ์รายงาน
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content & Form */}
        <form onSubmit={handlePrintReport} className="p-6 space-y-4">
          {error && (
            <div className="p-3 text-sm text-red-700 bg-red-50 rounded-xl border border-red-200 flex items-start space-x-2">
              <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {/* Project Selector Dropdown */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              เลือก Project
            </label>
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              disabled={isLoadingProjects}
              className="w-full px-3.5 py-2.5 text-sm bg-white text-slate-900 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 outline-hidden transition-all disabled:opacity-50"
            >
              <option value="all">ทุก Project</option>
              {projects.map((proj) => {
                const pid = proj._id || proj.id || "";
                const label = proj.code ? `[${proj.code}] ${proj.name}` : proj.name || pid;
                return (
                  <option key={pid} value={pid}>
                    {label}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Time Range Selector */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              เลือกช่วงเวลา
            </label>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <button
                type="button"
                onClick={() => setDateRangeType("month")}
                className={`px-3 py-2 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
                  dateRangeType === "month"
                    ? "border-blue-900 bg-zinc-50 text-blue-900"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                ระบุประจำเดือน
              </button>
              <button
                type="button"
                onClick={() => setDateRangeType("all")}
                className={`px-3 py-2 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
                  dateRangeType === "all"
                    ? "border-blue-900 bg-zinc-50 text-blue-900"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                ทุกช่วงเวลา
              </button>
            </div>

            {dateRangeType === "month" && (
              <input
                type="month"
                required
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-white text-slate-900 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 outline-hidden transition-all"
              />
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isExporting}
              className="px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-50"
            >
              ยกเลิก
            </button>

            <button
              type="submit"
              disabled={isExporting}
              className="inline-flex items-center space-x-2 px-6 py-2.5 text-sm font-semibold text-white bg-blue-900 hover:bg-blue-800 active:bg-blue-950 rounded-xl shadow-lg shadow-blue-900/25 transition-all disabled:opacity-50"
            >
              {isExporting ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  <span>กำลังสั่งพิมพ์...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
                    />
                  </svg>
                  <span>พิมพ์</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PrintReportModal;
