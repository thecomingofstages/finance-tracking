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
    <div className="min-h-screen w-full grid lg:grid-cols-12 bg-slate-950 text-slate-100 font-sans selection:bg-slate-800 selection:text-white relative overflow-hidden">
      {/* Minimal subtle background grid lines */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-20 pointer-events-none" />

      {/* LEFT PANEL: Brand & Financial System Showcase (Desktop Only) */}
      <div className="hidden lg:flex lg:col-span-7 relative flex-col justify-between p-12 lg:p-16 border-r border-slate-800/80 bg-gradient-to-b from-slate-950 via-slate-900/60 to-slate-950">
        {/* Glow ambient effect */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Top Header */}
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center shadow-inner">
              <span className="font-mono font-bold text-xs text-slate-200 tracking-wider">TC</span>
            </div>
            <div>
              <div className="text-[10px] font-mono tracking-widest text-slate-400 font-semibold uppercase">
                THE COMING OF STAGES
              </div>
              <div className="text-xs font-semibold text-slate-200">
                Finance Tracking System
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900/80 border border-slate-800 text-[11px] text-slate-300">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>v1.0 Operational</span>
          </div>
        </div>

        {/* Middle Main Content & Showcase Card */}
        <div className="relative z-10 my-auto max-w-xl space-y-8">
          <div className="space-y-3">
            <h2 className="text-3xl lg:text-4xl font-bold tracking-tight text-white leading-tight">
              ระบบติดตามและบริหารจัดการ <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-slate-100 via-slate-300 to-slate-400">
                การเบิกจ่ายงบประมาณการเงิน
              </span>
            </h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              ควบคุม ติดตาม และอนุมัติเอกสารเบิกจ่ายทางการเงินอย่างเป็นระบบ ถูกต้อง รวดเร็ว พร้อมระบบยืนยันตัวตนระดับองค์กร
            </p>
          </div>

          {/* Glass Finance Preview Card */}
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <span className="text-xs font-semibold text-slate-300">
                ภาพรวมโครงการและเบิกจ่ายล่าสุด
              </span>
              <span className="text-[11px] font-mono text-slate-500">Live Analytics</span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/60">
                <div className="text-[11px] text-slate-400 mb-1">งบประมาณอนุมัติสะสม</div>
                <div className="text-lg font-bold font-mono text-slate-100">฿1,480,000</div>
                <div className="text-[10px] text-emerald-400 mt-1 flex items-center gap-1">
                  <span>↑ 12%</span>
                  <span className="text-slate-500">จากเดือนก่อน</span>
                </div>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/60">
                <div className="text-[11px] text-slate-400 mb-1">รายการเบิกจ่ายรอดำเนินการ</div>
                <div className="text-lg font-bold font-mono text-slate-100">12 รายการ</div>
                <div className="text-[10px] text-amber-400 mt-1 flex items-center gap-1">
                  <span>● รอตรวจสอบสิทธิ์</span>
                </div>
              </div>
            </div>

            {/* Mock Recent Activity Item */}
            <div className="pt-1 flex items-center justify-between text-xs text-slate-300">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-emerald-950/50 border border-emerald-900/60 text-emerald-400 flex items-center justify-center font-mono text-[10px]">
                  ✓
                </div>
                <div>
                  <div className="font-medium text-slate-200">เบิกจ่ายค่าอุปกรณ์ Production</div>
                  <div className="text-[10px] text-slate-500">แผนก IT & Media • 2 นาทีที่แล้ว</div>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-950/60 text-emerald-400 border border-emerald-900/50">
                อนุมัติแล้ว
              </span>
            </div>
          </div>
        </div>

        {/* Bottom Footer */}
        <div className="relative z-10 text-xs text-slate-500 flex items-center justify-between">
          <span>© 2026 The Coming of Stages. All rights reserved.</span>
          <span className="hover:text-slate-400 transition-colors">TCOS Security Standards</span>
        </div>
      </div>

      {/* RIGHT PANEL: Login / Auth Form Container */}
      <div className="col-span-12 lg:col-span-5 flex items-center justify-center p-6 sm:p-10 lg:p-12 relative z-10 my-auto">
        <div className="w-full max-w-md bg-slate-900/90 border border-slate-800/90 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
          {/* Header / Brand Logo for Mobile (Shown on mobile only) */}
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
              className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all duration-200 cursor-pointer ${
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
              className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all duration-200 cursor-pointer ${
                activeTab === "claim"
                  ? "bg-slate-800 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              ตั้งรหัสแรกเข้า
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("forgot")}
              className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all duration-200 cursor-pointer ${
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
