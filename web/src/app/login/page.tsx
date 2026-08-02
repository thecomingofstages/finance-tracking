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

  const { user, isLoading, refreshUser } = useAuth();
  const [activeTab, setActiveTab] = useState<ActiveTab>(() =>
    tokenParam ? "claim" : "login"
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
    <div className="min-h-screen w-full flex items-center justify-center p-4 sm:p-6 bg-slate-50/80 text-slate-900 font-sans selection:bg-blue-100 selection:text-blue-900 relative">
      {/* Soft Corporate Login Container */}
      <div className="w-full max-w-[410px] bg-white border border-slate-200/90 rounded-2xl p-7 sm:p-9 shadow-sm sm:shadow-md relative z-10 space-y-6">
        {/* Header / Brand Logo */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center">
            <div className="bg-blue-950 px-5 py-3 rounded-2xl shadow-sm shadow-blue-950/20 flex items-center justify-center border border-blue-900/50">
              <img
                src="/logo-the-coming-of-stages.png"
                alt="The Coming of Stages Logo"
                className="h-10 w-auto object-contain"
              />
            </div>
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-slate-900">
              Finance Tracking System
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              ระบบติดตามและบริหารจัดการการเงิน TCOS
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-slate-100/90 p-1 rounded-xl border border-slate-200/80">
          <button
            type="button"
            onClick={() => setActiveTab("login")}
            className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 cursor-pointer ${
              activeTab === "login"
                ? "bg-blue-900 text-white shadow-sm"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            เข้าสู่ระบบ
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("claim")}
            className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 cursor-pointer ${
              activeTab === "claim"
                ? "bg-blue-900 text-white shadow-sm"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            ตั้งรหัสแรกเข้า
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("forgot")}
            className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 cursor-pointer ${
              activeTab === "forgot"
                ? "bg-blue-900 text-white shadow-sm"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            ลืมรหัสผ่าน
          </button>
        </div>

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
              onSuccess={() => setActiveTab("login")}
            />
          )}

          {activeTab === "forgot" && (
            <ForgotPasswordForm
              onBackToLogin={() => setActiveTab("login")}
              onSuccess={() => setActiveTab("login")}
            />
          )}
        </div>

        {/* Footer Brand Note */}
        <div className="pt-2 text-center text-[11px] text-slate-400 border-t border-slate-100">
          The Coming of Stages • Internal Financial Portal
        </div>
      </div>

      {/* Signature Upload Modal if missing signature */}
      <SignatureUploadModal
        isOpen={showSignatureModal}
        onClose={handleSignatureClose}
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
              className="animate-spin h-6 w-6 text-blue-500"
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
