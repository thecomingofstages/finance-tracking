"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

interface NavItem {
  label: string;
  href: string;
  badge?: string;
  icon: React.ReactNode;
}

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen = false, onClose }) => {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [searchFilter, setSearchFilter] = useState("");

  const userRole = user?.role?.toLowerCase();
  const isFinanceScope = Boolean(user?.scope?.finance_of && user.scope.finance_of.length > 0);

  const canAccessCheckslip =
    userRole === "admin" ||
    userRole === "owner" ||
    userRole === "finance" ||
    isFinanceScope;

  const navItems: NavItem[] = [
    {
      label: "หน้าหลัก",
      href: "/",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.75}
            d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
          />
        </svg>
      ),
    },
    {
      label: "รายการขอเบิกเงิน",
      href: "/reimburse",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.75}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      ),
    },
    {
      label: "แผนงานและงบประมาณ",
      href: "/project",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.75}
            d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
          />
        </svg>
      ),
    },
  ];

  if (canAccessCheckslip) {
    navItems.push({
      label: "ตรวจสลิปและโอนเงิน",
      href: "/checkslip",
      badge: "การเงิน",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.75}
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
    });
  }

  navItems.push({
    label: "จัดการลายเซ็นดิจิทัล",
    href: "/signature",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.75}
          d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
        />
      </svg>
    ),
  });

  const isLinkActive = (href: string) => {
    if (href === "/") {
      return pathname === "/";
    }
    return pathname === href || pathname?.startsWith(href + "/");
  };

  const filteredItems = navItems.filter((item) =>
    item.label.toLowerCase().includes(searchFilter.toLowerCase())
  );

  const getRoleLabelTH = (role?: string) => {
    switch (role?.toLowerCase()) {
      case "admin":
        return "ผู้ดูแลระบบสูงสุด";
      case "owner":
        return "เจ้าขององค์กร";
      case "finance":
        return "ฝ่ายการเงิน";
      case "it":
        return "ฝ่ายเทคโนโลยี";
      case "hr":
        return "ฝ่ายทรัพยากรบุคคล";
      default:
        return "ทีมงานทั่วไป";
    }
  };

  const userInitials =
    user?.nickname?.substring(0, 2)?.toUpperCase() ||
    user?.first_name?.substring(0, 2)?.toUpperCase() ||
    "TC";

  const sidebarContent = (
    <aside className="flex h-full w-64 flex-col border-r border-slate-200/80 bg-white shadow-xs">
      {/* Quick Search Menu */}
      <div className="px-3 pt-4">
        <div className="relative">
          <svg
            className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="ค้นหาเมนู..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="w-full rounded-xl bg-slate-50 border border-slate-200/80 py-1.5 pl-8 pr-3 text-xs text-slate-700 placeholder-slate-400 focus:bg-white focus:border-blue-900 focus:outline-none transition-all"
          />
        </div>
      </div>

      {/* 3. Main Navigation List */}
      <div className="flex-1 overflow-y-auto px-3 py-3">
        <div className="mb-2 px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">
          เมนูหลัก
        </div>
        <nav className="space-y-1">
          {filteredItems.map((item) => {
            const active = isLinkActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`group relative flex items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-medium transition-all duration-150 cursor-pointer ${
                  active
                    ? "bg-blue-900 text-white font-semibold shadow-sm shadow-blue-900/20"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={`flex items-center justify-center shrink-0 ${
                      active ? "text-white" : "text-slate-400 group-hover:text-blue-900"
                    }`}
                  >
                    {item.icon}
                  </span>
                  <span className="truncate">{item.label}</span>
                </div>

                {item.badge && !active && (
                  <span className="rounded-md bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-900 border border-blue-100">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* 4. Bottom User Profile Widget (สไตล์ ERP) */}
      <div className="border-t border-slate-100 p-3 bg-slate-50/50">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-200 text-xs font-bold text-slate-700 font-mono">
              {userInitials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-900 truncate">
                {user?.nickname || user?.first_name || "ทีมงาน"}
              </p>
              <p className="text-[10px] font-medium text-slate-400 truncate">
                {getRoleLabelTH(user?.role)}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => logout()}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors cursor-pointer"
            title="ออกจากระบบ"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden md:block md:w-64 md:shrink-0">
        {sidebarContent}
      </div>

      {/* Mobile drawer overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
            onClick={onClose}
            aria-hidden="true"
          />
          <div className="relative z-50 w-64 max-w-full transform transition-transform duration-200 ease-in-out">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};

export const BottomNav: React.FC = () => {
  const pathname = usePathname();
  const { user } = useAuth();

  const userRole = user?.role?.toLowerCase();
  const isFinanceScope = Boolean(user?.scope?.finance_of && user.scope.finance_of.length > 0);

  const canAccessCheckslip =
    userRole === "admin" ||
    userRole === "owner" ||
    userRole === "finance" ||
    isFinanceScope;

  const navItems: NavItem[] = [
    {
      label: "หน้าแรก",
      href: "/",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
    },
    {
      label: "ขอเบิกเงิน",
      href: "/reimburse",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
    {
      label: "แผนงาน",
      href: "/project",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      ),
    },
  ];

  if (canAccessCheckslip) {
    navItems.push({
      label: "ตรวจสลิป",
      href: "/checkslip",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    });
  }

  const isLinkActive = (href: string) => {
    if (href === "/") {
      return pathname === "/";
    }
    return pathname === href || pathname?.startsWith(href + "/");
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 flex h-16 items-center justify-around border-t border-slate-200 bg-white/95 px-2 backdrop-blur-md md:hidden shadow-lg pb-safe">
      {navItems.map((item) => {
        const active = isLinkActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center justify-center gap-1 rounded-xl px-3 py-1.5 transition-colors cursor-pointer ${
              active ? "text-blue-900 font-bold" : "text-slate-400 hover:text-slate-600 font-medium"
            }`}
          >
            {item.icon}
            <span className="text-[10px] tracking-tight">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
};

