"use client";

import React, { useState, useRef } from "react";
import { verifyPasswordApi, uploadSignatureApi } from "@/lib/api/auth";

export interface SignatureUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const SignatureUploadModal: React.FC<SignatureUploadModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.type.startsWith("image/")) {
      setError("กรุณาเลือกไฟล์รูปภาพ (PNG หรือ JPEG)");
      return;
    }

    setError(null);
    setFile(selectedFile);
    const url = URL.createObjectURL(selectedFile);
    setPreviewUrl(url);
  };

  const handleRemoveFile = () => {
    setFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!file) {
      setError("กรุณาเลือกไฟล์ลายเซ็นดิจิทัล (PNG หรือ JPEG)");
      return;
    }

    if (!password) {
      setError("กรุณากรอกรหัสผ่านเพื่อยืนยันการทำรายการ");
      return;
    }

    setIsLoading(true);

    try {
      // Step 1: Step-up re-authentication
      const verifyRes = await verifyPasswordApi(password);

      if (!verifyRes.response.ok || !verifyRes.reauth_token) {
        const errObj = verifyRes.error as any;
        setError(errObj?.error?.message || "รหัสผ่านไม่ถูกต้อง");
        setIsLoading(false);
        return;
      }

      // Step 2: Upload signature image with X-Reauth-Token header
      const uploadRes = await uploadSignatureApi(file, verifyRes.reauth_token);

      if (!uploadRes.response.ok) {
        const errObj = uploadRes.error as any;
        setError(
          errObj?.error?.message || "เกิดข้อผิดพลาดในการอัปโหลดลายเซ็น กรุณาลองใหม่อีกครั้ง"
        );
        setIsLoading(false);
        return;
      }

      onSuccess?.();
      onClose();
    } catch {
      setError("เกิดข้อผิดพลาดในการเชื่อมต่อระบบ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden text-slate-900">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">
            อัปโหลดลายเซ็นดิจิทัล
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg focus:outline-none"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} noValidate className="p-5 space-y-4">
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

          {/* Signature File Input */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              ไฟล์รูปภาพลายเซ็น (PNG หรือ JPEG)
            </label>

            {previewUrl ? (
              <div className="relative border border-slate-200 rounded-xl p-4 flex flex-col items-center justify-center bg-slate-50">
                {/* Image Preview */}
                <img
                  src={previewUrl}
                  alt="Signature preview"
                  className="max-h-28 object-contain mb-2"
                />
                <p className="text-xs text-slate-500 truncate max-w-xs">{file?.name}</p>
                <button
                  type="button"
                  onClick={handleRemoveFile}
                  className="mt-2 text-xs text-slate-600 hover:text-slate-900 transition-colors"
                >
                  เปลี่ยนรูปภาพ
                </button>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-slate-400 rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer bg-slate-50/70 transition-colors"
              >
                <svg
                  className="w-8 h-8 text-slate-400 mb-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                <p className="text-xs font-medium text-slate-700">
                  คลิกเพื่อเลือกไฟล์ หรือลากไฟล์มาวางที่นี่
                </p>
                <p className="text-[11px] text-slate-400 mt-1">รองรับเฉพาะ PNG และ JPEG</p>
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
            <label
              htmlFor="verify-password"
              className="block text-xs font-medium text-slate-700 mb-1"
            >
              ยืนยันรหัสผ่านเพื่อดำเนินการ
            </label>
            <input
              id="verify-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="กรอกรหัสผ่านของคุณ"
              disabled={isLoading}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-all disabled:opacity-50"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-3.5 py-2 text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors disabled:opacity-50"
            >
              ไว้ทีหลัง
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 rounded-xl text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 transition-all shadow-sm disabled:opacity-50 flex items-center gap-2 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <svg
                    className="animate-spin h-3.5 w-3.5 text-white"
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
                  <span>กำลังอัปโหลด...</span>
                </>
              ) : (
                "อัปโหลดลายเซ็น"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SignatureUploadModal;
