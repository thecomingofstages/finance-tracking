"use client";

import React from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";

interface NavbarProps {
  onToggleSidebar?: () => void;
  onOpenReportModal?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onToggleSidebar, onOpenReportModal }) => {
  const { user, logout } = useAuth();

  const getRoleBadgeColor = (role?: string) => {
    switch (role?.toLowerCase()) {
      case "admin":
      case "owner":
        return "bg-purple-100 text-purple-800 border-purple-200";
      case "finance":
        return "bg-blue-50 text-slate-800 border-emerald-200";
      case "it":
        return "bg-blue-50 text-slate-800 border-slate-200";
      case "hr":
        return "bg-pink-100 text-pink-800 border-pink-200";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  const roleLower = user?.role?.toLowerCase();
  const isFinance =
    roleLower === "admin" ||
    roleLower === "owner" ||
    roleLower === "finance" ||
    Boolean(user?.scope?.finance_of && user.scope.finance_of.length > 0);

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-200 bg-white/95 px-4 shadow-xs backdrop-blur-xs md:px-6">
      <div className="flex items-center gap-3">
        {/* Mobile menu toggle */}
        <button
          type="button"
          onClick={onToggleSidebar}
          className="inline-flex items-center justify-center rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-slate-300 md:hidden"
          aria-label="Toggle Navigation"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {/* Brand & Logo */}
        <Link href="/" className="flex items-center gap-3 transition-opacity hover:opacity-90">
          <img
            src="/logo-the-coming-of-stages.png"
            alt="TCOS Logo"
            className="h-8 w-auto object-contain brightness-0 opacity-90"
          />
          <span className="text-base font-bold tracking-tight text-slate-900 md:text-lg">
            Finance Tracking System
          </span>
        </Link>
      </div>

      {/* User Profile Section */}
      <div className="flex items-center gap-2 sm:gap-3">
        {user && (
          <>
            {isFinance && onOpenReportModal && (
              <button
                type="button"
                onClick={onOpenReportModal}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-900 px-3 py-1.5 text-xs font-semibold text-white transition-all hover:bg-blue-800 shadow-xs cursor-pointer"
                title="พิมพ์รายรับ - รายจ่าย"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                <span className="hidden md:inline">พิมพ์รายรับ - รายจ่าย</span>
                <span className="md:hidden">พิมพ์รายงาน</span>
              </button>
            )}

            <div className="hidden flex-col items-end sm:flex">
              <span className="text-sm font-semibold text-slate-800">
                {user.nickname || user.first_name || "ผู้ใช้งาน"}
              </span>
              {user.role && (
                <span
                  className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium uppercase tracking-wider ${getRoleBadgeColor(
                    user.role
                  )}`}
                >
                  {user.role}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 border-l border-slate-200 pl-2 sm:pl-3">
              <Link
                href="/signature"
                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-all hover:bg-slate-50 hover:text-slate-900 shadow-xs"
              >
                <svg className="h-3.5 w-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
                <span className="hidden lg:inline">จัดการลายเซ็น</span>
              </Link>

              <button
                type="button"
                onClick={() => logout()}
                className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-600 transition-all hover:bg-red-100 hover:text-red-700"
              >
                <svg className="h-3.5 w-3.5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span>ออกจากระบบ</span>
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  );
};
