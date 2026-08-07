"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  consumeSessionFromUrl,
  stashPendingToken,
} from "@/lib/auth/supabaseOAuth";

/**
 * Landing point for the Google sign-in redirect (see supabaseOAuth.ts). Supabase drops its
 * session in the URL fragment; this page reads it, trades it for one of our sessions at
 * POST /auth/login/supabase, and gets out of the way. Nothing is rendered for long — it's a
 * spinner and a redirect.
 *
 * The two 404s from Auth.helper.js are not failures, they're the first-login path:
 *   ACCOUNT_NOT_CLAIMED — staff row exists, no password_hash yet → claim form.
 *   NOT_PROVISIONED     — no staff row → genuinely can't proceed, tell them to ask an admin.
 */
export default function AuthCallbackPage() {
  const router = useRouter();
  const { loginWithSupabase } = useAuth();
  const [error, setError] = useState<string | null>(null);

  /** React 19 StrictMode double-invokes effects in dev; the token is single-use, so a second
   *  exchange would 401 against an already-consumed fragment we've since scrubbed. */
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    const { accessToken, error: oauthError } = consumeSessionFromUrl();

    if (oauthError) {
      setError(oauthError);
      return;
    }

    if (!accessToken) {
      setError("ไม่พบข้อมูลการเข้าสู่ระบบจาก Google กรุณาลองใหม่อีกครั้ง");
      return;
    }

    (async () => {
      const result = await loginWithSupabase(accessToken);

      if (result.success) {
        // /login owns the post-login routing (signature modal, then home) — reuse it rather
        // than duplicating that decision here.
        router.replace("/login");
        return;
      }

      if (result.code === "ACCOUNT_NOT_CLAIMED") {
        stashPendingToken(accessToken);
        router.replace("/login?mode=claim");
        return;
      }

      setError(result.error ?? "เข้าสู่ระบบด้วย Google ไม่สำเร็จ กรุณาติดต่อฝ่าย IT");
    })();
  }, [loginWithSupabase, router]);

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 sm:p-6 bg-slate-50/80 text-slate-900 font-sans">
      <div className="w-full max-w-[410px] bg-white border border-slate-200/90 rounded-2xl p-7 sm:p-9 shadow-sm sm:shadow-md space-y-5 text-center">
        <div className="inline-flex items-center justify-center py-1">
          <img
            src="/logo-the-coming-of-stages.png"
            alt="The Coming of Stages Logo"
            className="h-12 w-auto object-contain brightness-0 opacity-90"
          />
        </div>

        {error ? (
          <>
            <div className="p-3 rounded-xl text-xs bg-red-50 text-red-700 border border-red-200/80 flex items-center gap-2 text-left">
              <svg
                className="w-4 h-4 flex-shrink-0"
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
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={() => router.replace("/login")}
              className="text-xs text-slate-800 hover:text-blue-600 font-medium transition-colors focus:outline-none cursor-pointer"
            >
              ← กลับไปยังหน้าเข้าสู่ระบบ
            </button>
          </>
        ) : (
          <div className="flex items-center justify-center gap-3 py-2">
            <svg
              className="animate-spin h-5 w-5 text-blue-900"
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
            <span className="text-sm font-medium text-slate-600">
              กำลังเข้าสู่ระบบด้วย Google...
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
