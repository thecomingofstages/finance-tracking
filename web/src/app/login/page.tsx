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

  const { user, isLoading, authError, refreshUser } = useAuth();
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

        {/* Backend is unreachable or erroring — distinct from "your password was wrong", which
            the forms report themselves. Without this the page looks identical to a normal
            signed-out visit, which is how a 500 on /auth/me read as "login is broken". */}
        {authError && (
          <div
            role="alert"
            className="p-3 rounded-xl text-xs bg-amber-50 text-amber-900 border border-amber-200/80 flex items-start gap-2"
          >
            <svg
              className="w-4 h-4 flex-shrink-0 mt-px"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4c-.77-1.33-2.69-1.33-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z"
              />
            </svg>
            <span>{authError.message}</span>
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
            /* No onSuccess: a successful claim already signs the user in, so the `user` effect
             * above owns what happens next. Switching back to the login tab here would unmount
             * this form mid-success and destroy the confirmation it just rendered. */
            <ClaimAccountForm
              initialToken={tokenParam}
              onBackToLogin={() => setActiveTab("login")}
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
