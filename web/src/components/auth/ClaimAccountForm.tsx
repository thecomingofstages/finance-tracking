"use client";

import React, { useState } from "react";
import { claimApi } from "@/lib/api/auth";

export interface ClaimAccountFormProps {
  initialToken?: string;
  onSuccess?: () => void;
  onBackToLogin?: () => void;
}

export const ClaimAccountForm: React.FC<ClaimAccountFormProps> = ({
  initialToken = "",
  onSuccess,
  onBackToLogin,
}) => {
  const [sessionToken, setSessionToken] = useState(initialToken);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!sessionToken.trim()) {
      setError("ไม่พบสิทธิ์การตั้งรหัสผ่าน กรุณากดลิงก์รับรองจากอีเมล หรือติดต่อฝ่าย IT");
      return;
    }

    if (!password) {
      setError("กรุณากรอกรหัสผ่านใหม่");
      return;
    }

    if (password.length < 8) {
      setError("รหัสผ่านต้องมีความยาวอย่างน้อย 8 ตัวอักษร");
      return;
    }

    if (password !== confirmPassword) {
      setError("รหัสผ่านและการยืนยันรหัสผ่านไม่ตรงกัน");
      return;
    }

    setIsLoading(true);

    try {
      const { response, error: apiError } = await claimApi(password, sessionToken.trim());

      if (response.status === 404) {
        setError("ไม่พบข้อมูลทีมงาน กรุณาติดต่อฝ่าย IT");
        return;
      }

      if (response.status === 409) {
        setError("บัญชีนี้ถูกตั้งรหัสผ่านไปแล้ว กรุณาใช้หน้าล็อกอินปกติ หรือติดต่อฝ่าย IT");
        return;
      }

      if (!response.ok || apiError) {
        const errObj = apiError as any;
        const msg =
          errObj?.error?.message ||
          errObj?.message ||
          "เกิดข้อผิดพลาดในการตั้งรหัสผ่าน กรุณาติดต่อฝ่าย IT";
        setError(msg);
        return;
      }

      setSuccessMessage("ตั้งรหัสผ่านเรียบร้อยแล้ว กรุณาเข้าสู่ระบบด้วยรหัสผ่านใหม่");
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
            ตั้งรหัสผ่านเข้าใช้งานครั้งแรก
          </h3>
          <p className="text-xs text-slate-500 mb-3">
            กำหนดรหัสผ่านใหม่สำหรับเข้าใช้งานระบบ หากพบปัญหา กรุณาติดต่อฝ่าย IT
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
          <div className="p-3 rounded-xl text-xs bg-emerald-50 text-emerald-700 border border-emerald-200/80 flex items-center gap-2">
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

        {/* Hide manual token input if token was already provided in URL */}
        {!initialToken && (
          <div>
            <label
              htmlFor="sessionToken"
              className="block text-xs font-medium text-slate-700 mb-1"
            >
              โทเคนยืนยันตัวตน (Session Token)
            </label>
            <input
              id="sessionToken"
              type="text"
              value={sessionToken}
              onChange={(e) => setSessionToken(e.target.value)}
              placeholder="วางโทเคนที่ได้รับจากลิงก์เชิญ..."
              disabled={isLoading}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:border-blue-800 focus:ring-1 focus:ring-blue-800 transition-all disabled:opacity-50"
            />
          </div>
        )}

        <div>
          <label
            htmlFor="claim-password"
            className="block text-xs font-medium text-slate-700 mb-1"
          >
            รหัสผ่านใหม่
          </label>
          <input
            id="claim-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="อย่างน้อย 8 ตัวอักษร"
            disabled={isLoading}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:border-blue-800 focus:ring-1 focus:ring-blue-800 transition-all disabled:opacity-50"
          />
        </div>

        <div>
          <label
            htmlFor="confirmPassword"
            className="block text-xs font-medium text-slate-700 mb-1"
          >
            ยืนยันรหัสผ่านใหม่
          </label>
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="กรอกรหัสผ่านใหม่อีกครั้ง"
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
              <span>กำลังบันทึกรหัสผ่าน...</span>
            </>
          ) : (
            "ตั้งรหัสผ่าน"
          )}
        </button>

        {onBackToLogin && (
          <div className="pt-3 text-center border-t border-slate-100 mt-4">
            <button
              type="button"
              onClick={onBackToLogin}
              className="text-xs text-blue-800 hover:text-blue-900 font-medium transition-colors focus:outline-none"
            >
              ← กลับไปยังหน้าเข้าสู่ระบบ
            </button>
          </div>
        )}
      </form>
    </div>
  );
};

export default ClaimAccountForm;
