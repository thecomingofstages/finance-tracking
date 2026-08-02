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
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-slate-950 text-slate-100 font-sans selection:bg-slate-800 selection:text-white relative">
      {/* Minimal subtle background grid lines */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-25 pointer-events-none" />

      {/* Minimal Card Container */}
      <div className="w-full max-w-sm bg-slate-900/90 border border-slate-800/90 rounded-2xl p-6 sm:p-8 shadow-2xl relative z-10 space-y-6">
        {/* Header / Brand Logo */}
        <div className="text-left space-y-1">
          <div className="text-[10px] font-mono tracking-widest uppercase text-slate-500 font-semibold">
            TCOS SYSTEM
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-100">
            Finance Tracking
          </h1>
          <p className="text-xs text-slate-400">
            ระบบติดตามและบริหารจัดการการเงิน
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800/80">
          <button
            type="button"
            onClick={() => setActiveTab("login")}
            className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 ${
              activeTab === "login"
                ? "bg-slate-800 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            เข้าสู่ระบบ
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("claim")}
            className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 ${
              activeTab === "claim"
                ? "bg-slate-800 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            ตั้งรหัสผ่านแรกเข้า
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("forgot")}
            className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 ${
              activeTab === "forgot"
                ? "bg-slate-800 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            ลืมรหัสผ่าน
          </button>
        </div>

        {/* Form Body based on activeTab */}
        <div className="mt-2">
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
