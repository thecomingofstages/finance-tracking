"use client";

import React, { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Navbar } from "./Navbar";
import { Sidebar } from "./Sidebar";
import { SignatureUploadModal } from "@/components/auth";
import { PrintReportModal } from "@/components/reports";

export interface AppShellProps {
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const { user, isLoading, refreshUser } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [signatureModalOpen, setSignatureModalOpen] = useState(false);
  const [printReportModalOpen, setPrintReportModalOpen] = useState(false);

  const isAuthPage = pathname === "/login" || pathname === "/claim" || pathname === "/forgot-password";

  useEffect(() => {
    if (!isLoading && !user && !isAuthPage) {
      router.push("/login");
    }
  }, [isLoading, user, isAuthPage, router]);

  useEffect(() => {
    if (!isLoading && user && !user.signature_image && !isAuthPage) {
      setSignatureModalOpen(true);
    } else {
      setSignatureModalOpen(false);
    }
  }, [isLoading, user, isAuthPage]);

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#1e3a8a] border-t-transparent" />
          <p className="text-sm font-medium text-slate-600">กำลังโหลด...</p>
        </div>
      </div>
    );
  }

  if (isAuthPage) {
    return <>{children}</>;
  }

  if (!user) {
    return null;
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <Navbar
        onToggleSidebar={() => setMobileSidebarOpen((prev) => !prev)}
        onOpenReportModal={() => setPrintReportModalOpen(true)}
      />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          isOpen={mobileSidebarOpen}
          onClose={() => setMobileSidebarOpen(false)}
        />

        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl">
            {children}
          </div>
        </main>
      </div>

      <SignatureUploadModal
        isOpen={signatureModalOpen}
        onClose={() => setSignatureModalOpen(false)}
        onSuccess={async () => {
          setSignatureModalOpen(false);
          await refreshUser();
        }}
      />

      <PrintReportModal
        isOpen={printReportModalOpen}
        onClose={() => setPrintReportModalOpen(false)}
      />
    </div>
  );
};
