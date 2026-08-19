"use client";

import React, { useState, useEffect, useRef, ChangeEvent, DragEvent } from "react";
import { useAuth } from "@/context/AuthContext";
import { updateReimbursementStatusApi } from "@/lib/api/reimbursements";
import { verifyPasswordApi, uploadSignatureApi } from "@/lib/api/auth";

export interface ReimbursementActionModalProps {
  isOpen: boolean;
  reimbursementId: string;
  action: "head_approve" | "fin_approve" | "transfer";
  onClose: () => void;
  onSuccess?: () => void;
}

export const ReimbursementActionModal: React.FC<ReimbursementActionModalProps> = ({
  isOpen,
  reimbursementId,
  action,
  onClose,
  onSuccess,
}) => {
  const { user, refreshUser } = useAuth();

  const [password, setPassword] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [trackingId, setTrackingId] = useState<string>("");
  const [note, setNote] = useState<string>("");
  
  // Signature File state
  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  const [signaturePreviewUrl, setSignaturePreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Does the user need to upload a signature?
  // Usually needed for head_approve and fin_approve, maybe transfer too.
  const needsSignature = !user?.signature_image;
  const requiresTrackingId = action === "fin_approve";

  useEffect(() => {
    if (!isOpen) {
      setPassword("");
      setShowPassword(false);
      setTrackingId("");
      setNote("");
      setSignatureFile(null);
      if (signaturePreviewUrl) {
        URL.revokeObjectURL(signaturePreviewUrl);
        setSignaturePreviewUrl(null);
      }
      setError(null);
      setIsSubmitting(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Handle Signature drag-and-drop
  const handleFileChange = (file: File | null) => {
    if (!file) {
      setSignatureFile(null);
      if (signaturePreviewUrl) {
        URL.revokeObjectURL(signaturePreviewUrl);
        setSignaturePreviewUrl(null);
      }
      return;
    }

    const validTypes = ["image/png", "image/jpeg", "image/jpg"];
    if (!validTypes.includes(file.type) && !file.name.match(/\.(png|jpe?g)$/i)) {
      setError("ลายเซ็นต์ต้องเป็นไฟล์รูปภาพ PNG หรือ JPEG เท่านั้น");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setError("ขนาดไฟล์ต้องไม่เกิน 2MB");
      return;
    }

    setError(null);
    setSignatureFile(file);

    if (signaturePreviewUrl) {
      URL.revokeObjectURL(signaturePreviewUrl);
    }
    setSignaturePreviewUrl(URL.createObjectURL(file));
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };
  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };
  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (requiresTrackingId && !trackingId.trim()) {
      setError("กรุณากรอกรหัสรายการ (Tracking ID)");
      return;
    }

    if (!password.trim()) {
      setError("กรุณากรอกรหัสผ่านเพื่อยืนยันตัวตน (Step-up Password)");
      return;
    }

    if (needsSignature && !signatureFile) {
      setError("กรุณาอัปโหลดไฟล์ลายเซ็นต์ดิจิทัล เพื่อใช้ในการดำเนินการ");
      return;
    }

    setIsSubmitting(true);

    try {
      // Step 1: Verify Password -> Get reauth_token
      const verifyRes = await verifyPasswordApi(password);
      if (verifyRes.error || !verifyRes.reauth_token) {
        const errData = verifyRes.error as any;
        const msg = errData?.error?.message || "รหัสผ่านไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง";
        setError(msg);
        setIsSubmitting(false);
        return;
      }
      const reauthToken = verifyRes.reauth_token;

      // Step 2: Upload signature if needed
      if (needsSignature && signatureFile) {
        const uploadRes = await uploadSignatureApi(signatureFile, reauthToken);
        if (uploadRes.error) {
           setError("อัปโหลดลายเซ็นต์ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
           setIsSubmitting(false);
           return;
        }
        await refreshUser(); // Update context so it knows user has signature
      }

      // Step 3: Approve / Transfer
      const res = await updateReimbursementStatusApi(
        reimbursementId,
        action,
        note ? (requiresTrackingId ? `[Tracking: ${trackingId}] ${note}` : note) : (requiresTrackingId ? trackingId : undefined),
        reauthToken
      );

      if (res.error) {
        const errData = res.error as any;
        setError(errData?.error?.message || "ไม่สามารถดำเนินการได้ กรุณาลองใหม่อีกครั้ง");
        setIsSubmitting(false);
        return;
      }

      // Success
      if (onSuccess) {
        onSuccess();
      }
      onClose();
    } catch (err: any) {
      console.error("Action error:", err);
      setError(err?.message || "เกิดข้อผิดพลาดที่ไม่คาดคิด กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsSubmitting(false);
    }
  };

  const titles = {
    head_approve: "อนุมัติการเบิกเงิน (หัวหน้าฝ่าย)",
    fin_approve: "อนุมัติการเบิกเงิน (ฝ่ายการเงิน)",
    transfer: "ยืนยันการโอนเงินเรียบร้อย",
  };

  const btnTitles = {
    head_approve: "ยืนยันอนุมัติ",
    fin_approve: "ยืนยันอนุมัติ",
    transfer: "โอนเงินเรียบร้อย",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn overflow-y-auto">
      <div
        className="relative w-full max-w-lg my-8 overflow-hidden bg-white rounded-2xl shadow-2xl border border-slate-200 transition-all transform scale-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center space-x-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-zinc-50 text-blue-900 border border-blue-100">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">{titles[action]}</h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3.5 text-sm text-red-700 bg-red-50 rounded-xl border border-red-200 flex items-start space-x-2">
              <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {requiresTrackingId && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                รหัสรายการ (Tracking ID) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={trackingId}
                onChange={(e) => setTrackingId(e.target.value.toUpperCase())}
                placeholder="เช่น PAY-2026-001"
                className="w-full px-4 py-2.5 text-sm bg-white font-mono text-slate-900 border border-slate-300 rounded-xl focus:ring-2 focus:ring-zinc-900 focus:border-transparent outline-none transition-all uppercase"
              />
            </div>
          )}

          {/* Remark / Note Field */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              หมายเหตุ / ข้อความบันทึก (Remark / Note) <span className="text-[11px] text-slate-400 font-normal">(ไม่บังคับ)</span>
            </label>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="ระบุข้อความหรือบันทึกเพิ่มเติมสำหรับการดำเนินการนี้..."
              className="w-full px-3 py-2 text-xs sm:text-sm bg-white text-slate-900 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-900 focus:border-transparent outline-none transition-all placeholder:text-slate-400"
            />
          </div>

          {needsSignature && (
            <div className="bg-orange-50/50 border border-orange-200 p-4 rounded-xl">
               <div className="flex items-start space-x-2 mb-3">
                  <svg className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div>
                     <h4 className="text-sm font-bold text-orange-900">จำเป็นต้องใช้ลายเซ็นต์ดิจิทัล</h4>
                     <p className="text-xs text-orange-700 mt-0.5">คุณยังไม่ได้อัปโหลดลายเซ็นต์ดิจิทัล กรุณาแนบไฟล์รูปภาพลายเซ็นต์พื้นหลังโปร่งใส (PNG/JPEG) เพื่อใช้เป็นหลักฐานในการดำเนินการ</p>
                  </div>
               </div>

              <input
                type="file"
                ref={fileInputRef}
                accept="image/png,image/jpeg,image/jpg"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileChange(e.target.files[0]);
                  }
                }}
              />
              {signaturePreviewUrl ? (
                <div className="relative flex items-center justify-center p-3 border-2 border-orange-300 rounded-xl bg-white group">
                  <img src={signaturePreviewUrl} alt="Signature Preview" className="max-h-24 object-contain rounded-lg" />
                  <button
                    type="button"
                    onClick={() => handleFileChange(null)}
                    className="absolute top-2 right-2 p-1.5 bg-red-600 hover:bg-red-700 text-white rounded-full shadow-md transition-colors cursor-pointer"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : (
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`flex flex-col items-center justify-center p-4 border-2 border-dashed rounded-xl cursor-pointer transition-colors bg-white ${
                    isDragging ? "border-orange-500" : "border-slate-300 hover:border-orange-400"
                  }`}
                >
                  <p className="text-sm font-medium text-slate-700">คลิกเพื่อเลือกไฟล์ หรือลากไฟล์มาวาง</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">รองรับไฟล์ PNG, JPEG (สูงสุด 2MB)</p>
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              ยืนยันรหัสผ่าน (Step-Up Password) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="กรอกรหัสผ่านเพื่อดำเนินการ"
                className="w-full px-4 py-2.5 pr-10 text-sm bg-white text-slate-900 border border-slate-300 rounded-xl focus:ring-2 focus:ring-zinc-900 focus:border-transparent outline-none transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                {showPassword ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M1 1l22 22"/></svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                )}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center space-x-2 px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-xl shadow-lg shadow-blue-600/25 transition-all disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
                  <span>กำลังดำเนินการ...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                  <span>{btnTitles[action]}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ReimbursementActionModal;
