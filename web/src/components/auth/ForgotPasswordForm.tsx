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
          <h3 className="text-sm font-semibold text-slate-900 mb-0.5">
            ลืมรหัสผ่าน?
          </h3>
          <p className="text-xs text-slate-500 mb-3">
            กรอกอีเมลเพื่อรับลิงก์รีเซ็ตรหัสผ่าน หากพบปัญหา กรุณาติดต่อฝ่าย IT
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-xl text-xs bg-red-50 text-red-700 border border-red-200/80 flex items-center gap-2">
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
          <div className="p-3 rounded-xl text-xs bg-emerald-50 text-blue-900 border border-emerald-200/80 flex items-center gap-2">
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
            className="block text-xs font-medium text-slate-700 mb-1"
          >
            อีเมล
          </label>
          <input
            id="forgot-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@company.com"
            disabled={isLoading}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:border-blue-800 focus:ring-1 focus:ring-blue-800 transition-all disabled:opacity-50"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-2.5 px-4 rounded-xl text-white font-medium bg-blue-900 hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-800 transition-all duration-200 shadow-sm shadow-blue-900/20 text-sm disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer mt-2"
        >
          {isLoading ? (
            <>
              <svg
                className="animate-spin h-4 w-4 text-white"
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
          <div className="pt-3 text-center border-t border-slate-100 mt-4">
            <button
              type="button"
              onClick={onBackToLogin}
              className="text-xs text-slate-800 hover:text-blue-600 font-medium transition-colors focus:outline-none"
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
