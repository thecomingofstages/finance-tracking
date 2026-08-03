"use client";

import React, { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { verifyPasswordApi, uploadSignatureApi } from "@/lib/api/auth";

export default function SignaturePage() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    user?.signature_image || null
  );
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.type.startsWith("image/")) {
        setError("กรุณาเลือกไฟล์รูปภาพเท่านั้น (PNG หรือ JPEG)");
        return;
      }
      setFile(selectedFile);
      setPreviewUrl(URL.createObjectURL(selectedFile));
      setError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError("กรุณาเลือกไฟล์รูปภาพลายเซ็น");
      return;
    }
    if (!password) {
      setError("กรุณากรอกรหัสผ่านเพื่อยืนยันตัวตน");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Step 1: Verify password to get short-lived reauth token
      const verifyRes = await verifyPasswordApi(password);
      if (!verifyRes.response.ok || !verifyRes.reauth_token) {
        setError("รหัสผ่านไม่ถูกต้อง กรุณากรอกใหม่อีกครั้ง");
        setIsLoading(false);
        return;
      }

      // Step 2: Upload signature image
      const uploadRes = await uploadSignatureApi(file, verifyRes.reauth_token);
      if (!uploadRes.response.ok) {
        setError("เกิดข้อผิดพลาดในการอัปโหลดรูปภาพ กรุณาติดต่อฝ่าย IT");
        setIsLoading(false);
        return;
      }

      await refreshUser();
      setSuccess(true);
      setTimeout(() => {
        router.push("/");
      }, 1500);
    } catch {
      setError("เกิดข้อผิดพลาดในการเชื่อมต่อระบบ กรุณาติดต่อฝ่าย IT");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 sm:p-6 bg-slate-50/80 text-slate-900 font-sans selection:bg-blue-100 selection:text-blue-900">
      <div className="w-full max-w-md bg-white border border-slate-200/90 rounded-2xl p-7 sm:p-9 shadow-sm sm:shadow-md space-y-6">
        {/* Header Logo & Title */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center py-1">
            <img
              src="/logo-the-coming-of-stages.png"
              alt="The Coming of Stages Logo"
              className="h-12 w-auto object-contain brightness-0 opacity-90"
            />
          </div>
          <h1 className="text-lg font-bold text-slate-900">
            จัดการลายเซ็นดิจิทัล (Digital Signature)
          </h1>
          <p className="text-xs text-slate-500">
            อัปโหลดไฟล์รูปภาพลายเซ็นเพื่อใช้อนุมัติใบเบิก/อนุมัติการเงิน TCOS
          </p>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {error && (
            <div className="p-3 rounded-xl text-xs bg-red-50 text-red-700 border border-red-200/80 flex items-center gap-2">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 rounded-xl text-xs bg-emerald-50 text-emerald-700 border border-emerald-200/80 flex items-center gap-2">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>อัปโหลดลายเซ็นเรียบร้อยแล้ว กำลังนำท่านกลับสู่หน้าหลัก...</span>
            </div>
          )}

          {/* File Picker */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              รูปภาพลายเซ็น (PNG หรือ JPEG)
            </label>
            {previewUrl ? (
              <div className="relative border border-slate-200 rounded-xl p-4 flex flex-col items-center justify-center bg-slate-50">
                <img src={previewUrl} alt="Signature preview" className="max-h-28 object-contain mb-2" />
                <p className="text-xs text-slate-500 truncate max-w-xs">{file?.name || "ลายเซ็นปัจจุบัน"}</p>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-2 text-xs text-blue-800 hover:text-blue-900 font-medium transition-colors"
                >
                  เปลี่ยนรูปภาพลายเซ็น
                </button>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-slate-400 rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer bg-slate-50/70 transition-colors"
              >
                <svg className="w-8 h-8 text-slate-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-xs font-medium text-slate-700">คลิกเพื่อเลือกไฟล์รูปภาพลายเซ็น</p>
                <p className="text-[11px] text-slate-400 mt-1">รองรับไฟล์ PNG หรือ JPEG</p>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png, image/jpeg, image/jpg"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {/* Password Input for Step-up reauth */}
          <div>
            <label htmlFor="signature-password" className="block text-xs font-medium text-slate-700 mb-1.5">
              ยืนยันรหัสผ่านของคุณ
            </label>
            <input
              id="signature-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="กรอกรหัสผ่านเพื่ออนุมัติการอัปโหลด"
              disabled={isLoading}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:border-blue-800 focus:ring-1 focus:ring-blue-800 transition-all disabled:opacity-50"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => router.push("/")}
              disabled={isLoading}
              className="px-4 py-2.5 text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors disabled:opacity-50"
            >
              ไว้ทีหลัง
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-5 py-2.5 rounded-xl text-xs font-medium text-white bg-blue-900 hover:bg-blue-800 transition-all shadow-sm shadow-blue-900/20 disabled:opacity-50 flex items-center gap-2 cursor-pointer"
            >
              {isLoading ? "กำลังอัปโหลด..." : "บันทึกและอัปโหลดลายเซ็น"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
