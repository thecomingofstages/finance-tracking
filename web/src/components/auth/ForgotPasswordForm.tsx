"use client";

import React, { useState } from "react";
import { forgotPasswordApi } from "@/lib/api/auth";

export interface ForgotPasswordFormProps {
  onSuccess?: () => void;
  onBackToLogin?: () => void;
}

export const ForgotPasswordForm: React.FC<ForgotPasswordFormProps> = ({
  onSuccess,
  onBackToLogin,
}) => {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!email.trim()) {
      setError("กรุณากรอกอีเมลของคุณ");
      return;
    }

    setIsLoading(true);

    try {
      const { response, error: apiError } = await forgotPasswordApi(email.trim());

      if (!response.ok || apiError) {
        const errObj = apiError as any;
        const msg =
          errObj?.error?.message ||
          errObj?.message ||
          "ไม่สามารถส่งลิงก์รีเซ็ตรหัสผ่านได้ กรุณาติดต่อฝ่าย IT";
        setError(msg);
        return;
      }

      setSuccessMessage("ส่งลิงก์รีเซ็ตรหัสผ่านเรียบร้อยแล้ว หากไม่ได้รับอีเมล กรุณาติดต่อฝ่าย IT");
      onSuccess?.();
    } catch {
      setError("เกิดข้อผิดพลาดในการเชื่อมต่อระบบ กรุณาติดต่อฝ่าย IT");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-100 mb-0.5">
            ลืมรหัสผ่าน?
          </h3>
          <p className="text-xs text-slate-400 mb-3">
            กรอกอีเมลเพื่อรับลิงก์รีเซ็ตรหัสผ่าน หากพบปัญหา กรุณาติดต่อฝ่าย IT
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-xl text-xs bg-red-950/40 text-red-400 border border-red-900/50 flex items-center gap-2">
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
        )}

        {successMessage && (
          <div className="p-3 rounded-xl text-xs bg-emerald-950/40 text-emerald-400 border border-emerald-900/50 flex items-center gap-2">
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
                d="M5 13l4 4L19 7"
              />
            </svg>
            <span>{successMessage}</span>
          </div>
        )}

        <div>
          <label
            htmlFor="forgot-email"
            className="block text-xs font-medium text-slate-300 mb-1"
          >
            อีเมล
          </label>
          <input
            id="forgot-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@company.com"
            disabled={isLoading}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-800 bg-slate-950/60 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500 transition-all disabled:opacity-50"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-2.5 px-4 rounded-xl text-slate-950 font-medium bg-slate-100 hover:bg-white focus:outline-none focus:ring-2 focus:ring-slate-400 transition-all duration-200 shadow text-sm disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer mt-2"
        >
          {isLoading ? (
            <>
              <svg
                className="animate-spin h-4 w-4 text-slate-900"
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
              <span>กำลังส่งข้อมูล...</span>
            </>
          ) : (
            "ขอลิงก์รีเซ็ตรหัสผ่าน"
          )}
        </button>

        {onBackToLogin && (
          <div className="pt-3 text-center border-t border-slate-800/80 mt-4">
            <button
              type="button"
              onClick={onBackToLogin}
              className="text-xs text-slate-400 hover:text-slate-200 transition-colors focus:outline-none"
            >
              ← กลับไปยังหน้าเข้าสู่ระบบ
            </button>
          </div>
        )}
      </form>
    </div>
  );
};

export default ForgotPasswordForm;
