"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  LoginForm,
  ClaimAccountForm,
  ForgotPasswordForm,
  SignatureUploadModal,
} from "@/components/auth";

type ActiveTab = "login" | "claim" | "forgot";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tokenParam = searchParams.get("session_token") || searchParams.get("token") || "";
  /** /auth/callback redirects here with ?mode=claim after ACCOUNT_NOT_CLAIMED. The Supabase
   *  token itself travels in sessionStorage, not the URL — ClaimAccountForm picks it up. */
  const isClaimMode = searchParams.get("mode") === "claim";

  const { user, isLoading, refreshUser } = useAuth();
  const [activeTab, setActiveTab] = useState<ActiveTab>(() =>
    tokenParam || isClaimMode ? "claim" : "login"
  );
  const [showSignatureModal, setShowSignatureModal] = useState(false);

  useEffect(() => {
    if (!isLoading && user) {
      if (!user.signature_image) {
        setShowSignatureModal(true);
      } else {
        router.push("/");
      }
    }
  }, [user, isLoading, router]);

  const handleSignatureClose = () => {
    setShowSignatureModal(false);
    router.push("/");
  };

  const handleSignatureSuccess = async () => {
    await refreshUser();
    setShowSignatureModal(false);
    router.push("/");
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 sm:p-6 bg-slate-50/80 text-slate-900 font-sans selection:bg-blue-50 selection:text-blue-900 relative">
      {/* Soft Corporate Login Container */}
      <div className="w-full max-w-[410px] bg-white border border-slate-200/90 rounded-2xl p-7 sm:p-9 shadow-sm sm:shadow-md relative z-10 space-y-6">
        {/* Header / Brand Logo */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center py-1">
            <img
              src="/logo-the-coming-of-stages.png"
              alt="The Coming of Stages Logo"
              className="h-14 w-auto object-contain brightness-0 opacity-90"
            />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-slate-900">
              Finance Tracking System
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              ระบบติดตามและบริหารจัดการการเงิน TCOS
            </p>
          </div>
        </div>

        {/* Not Provisioned Error Banner */}
        {searchParams.get("error") === "not_provisioned" && (
          <div className="p-3.5 rounded-xl text-xs bg-red-50 text-red-700 border border-red-200 flex items-start gap-2.5">
            <svg
              className="w-4 h-4 flex-shrink-0 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div>
              <div className="font-semibold">ไม่พบข้อมูลทีมงานในระบบ</div>
              <div className="text-[11px] text-red-600 mt-0.5">
                อีเมลนี้ยังไม่ได้ลงทะเบียนในฐานข้อมูล กรุณาติดต่อฝ่าย IT เพื่อเพิ่มชื่อเข้าสู่ระบบ
              </div>
            </div>
          </div>
        )}

        {/* Mode Title Indicator */}
        {activeTab === "claim" && (
          <div className="bg-zinc-50 border border-slate-200/80 rounded-xl p-3 text-center text-xs text-blue-900 font-medium">
            ตั้งรหัสผ่านสำหรับเข้าใช้งานครั้งแรก (Create Password)
          </div>
        )}
        {activeTab === "forgot" && (
          <div className="bg-zinc-50 border border-slate-200/80 rounded-xl p-3 text-center text-xs text-blue-900 font-medium">
            รีเซ็ตรหัสผ่าน (Reset Password)
          </div>
        )}

        {/* Form Body based on activeTab */}
        <div className="mt-1">
          {activeTab === "login" && (
            <LoginForm
              onSelectClaim={() => setActiveTab("claim")}
              onSelectForgot={() => setActiveTab("forgot")}
              onSuccess={() => {
                refreshUser();
              }}
            />
          )}

          {activeTab === "claim" && (
            <ClaimAccountForm
              initialToken={tokenParam}
              onBackToLogin={() => setActiveTab("login")}
              onSuccess={() => {
                refreshUser();
              }}
            />
          )}

          {activeTab === "forgot" && (
            <ForgotPasswordForm
              onBackToLogin={() => setActiveTab("login")}
              onSuccess={() => setActiveTab("login")}
            />
          )}
        </div>
      </div>

      {/* Signature Upload Modal if missing signature */}
      <SignatureUploadModal
        isOpen={showSignatureModal}
        onClose={handleSignatureClose}
        onSuccess={handleSignatureSuccess}
      />
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen w-full flex items-center justify-center bg-slate-950 text-white">
          <div className="flex items-center gap-3">
            <svg
              className="animate-spin h-6 w-6 text-rose-600"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            <span className="text-sm font-medium">กำลังโหลด...</span>
          </div>
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
