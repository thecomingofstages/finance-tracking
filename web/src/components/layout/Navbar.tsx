"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

interface NavbarProps {
  onToggleSidebar?: () => void;
  onOpenReportModal?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onToggleSidebar, onOpenReportModal }) => {
  const { user } = useAuth();
  const pathname = usePathname();

  const getBreadcrumbs = () => {
    if (pathname === "/") return [{ label: "หน้าหลัก (Dashboard)", href: "/" }];
    if (pathname.startsWith("/reimburse/new"))
      return [
        { label: "หน้าหลัก", href: "/" },
        { label: "รายการขอเบิกเงิน", href: "/reimburse" },
        { label: "ยื่นคำขอใหม่", href: "/reimburse/new" },
      ];
    if (pathname.startsWith("/reimburse"))
      return [
        { label: "หน้าหลัก", href: "/" },
        { label: "รายการขอเบิกเงิน", href: "/reimburse" },
      ];
    if (pathname.startsWith("/project/"))
      return [
        { label: "หน้าหลัก", href: "/" },
        { label: "แผนงานและโครงการ", href: "/project" },
        { label: "รายละเอียดโครงการ", href: pathname },
      ];
    if (pathname.startsWith("/project"))
      return [
        { label: "หน้าหลัก", href: "/" },
        { label: "แผนงานและโครงการ", href: "/project" },
      ];
    if (pathname.startsWith("/checkslip"))
      return [
        { label: "หน้าหลัก", href: "/" },
        { label: "ตรวจสลิปและโอนเงิน", href: "/checkslip" },
      ];
    if (pathname.startsWith("/signature"))
      return [
        { label: "หน้าหลัก", href: "/" },
        { label: "จัดการลายเซ็นดิจิทัล", href: "/signature" },
      ];
    return [{ label: "หน้าหลัก", href: "/" }];
  };

  const breadcrumbs = getBreadcrumbs();

  const roleLower = user?.role?.toLowerCase();
  const isFinance =
    roleLower === "admin" ||
    roleLower === "owner" ||
    roleLower === "finance" ||
    Boolean(user?.scope?.finance_of && user.scope.finance_of.length > 0);

  return (
    <header className="sticky top-0 z-30 flex h-14 md:h-16 w-full items-center justify-between border-b border-slate-200/80 bg-white/95 px-3 md:px-6 shadow-2xs backdrop-blur-xs">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        {/* Mobile menu toggle */}
        <button
          type="button"
          onClick={onToggleSidebar}
          className="inline-flex items-center justify-center rounded-xl p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus:outline-none md:hidden cursor-pointer shrink-0"
          aria-label="Toggle Navigation"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {/* Breadcrumb Navigation (สไตล์ ERP SaaS) */}
        <nav className="flex items-center gap-1.5 text-xs font-medium text-slate-500 overflow-hidden text-ellipsis whitespace-nowrap">
          {breadcrumbs.map((crumb, idx) => {
            const isLast = idx === breadcrumbs.length - 1;
            return (
              <React.Fragment key={crumb.href + idx}>
                {idx > 0 && <span className="text-slate-300">/</span>}
                {isLast ? (
                  <span className="font-semibold text-slate-900 truncate">
                    {crumb.label}
                  </span>
                ) : (
                  <Link
                    href={crumb.href}
                    className="hover:text-blue-900 transition-colors truncate"
                  >
                    {crumb.label}
                  </Link>
                )}
              </React.Fragment>
            );
          })}
        </nav>
      </div>

      {/* Right Quick Action Toolbar */}
      <div className="flex items-center gap-2 shrink-0">
        {isFinance && onOpenReportModal && (
          <button
            type="button"
            onClick={onOpenReportModal}
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-900 px-3 py-1.5 text-xs font-semibold text-white transition-all hover:bg-blue-800 shadow-xs cursor-pointer active:scale-95"
            title="พิมพ์รายงานรับ - จ่าย"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            <span className="hidden sm:inline">พิมพ์รายงานรับ-จ่าย</span>
          </button>
        )}

        <Link
          href="/signature"
          className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-all hover:bg-slate-50 hover:text-slate-900 shadow-xs"
          title="จัดการลายเซ็น"
        >
          <svg className="h-3.5 w-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
          <span className="hidden md:inline">ลายเซ็นดิจิทัล</span>
        </Link>
      </div>
    </header>
  );
};

