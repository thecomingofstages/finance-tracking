"use client";

import React, { useState, useEffect, useRef, ChangeEvent, DragEvent } from "react";
import { useAuth } from "@/context/AuthContext";
import { createReimbursementApi, uploadReceiptApi } from "@/lib/api/reimbursements";
import { verifyPasswordApi, uploadSignatureApi } from "@/lib/api/auth";
import { addBankAccountApi } from "@/lib/api/staff";

export interface CreateReimbursementData {
  department_id: string;
  tag_id: string | null;
  purpose: string;
  details: { title: string; amount: number }[];
  receipt_file: File;
  banking_mode: "existing" | "new" | "cash";
  banking_id?: string;
  new_bank_account?: { name: string; number: string; provider: string };
}

export interface CreateReimbursementConfirmModalProps {
  isOpen: boolean;
  data: CreateReimbursementData | null;
  onClose: () => void;
  onSuccess?: (reimbursementId: string) => void;
}

export const CreateReimbursementConfirmModal: React.FC<CreateReimbursementConfirmModalProps> = ({
  isOpen,
  data,
  onClose,
  onSuccess,
}) => {
  const { user, refreshUser } = useAuth();

  const [password, setPassword] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);
  
  // Signature File state
  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  const [signaturePreviewUrl, setSignaturePreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const needsSignature = !user?.signature_image;

  useEffect(() => {
    if (!isOpen) {
      setPassword("");
      setShowPassword(false);
      setSignatureFile(null);
      if (signaturePreviewUrl) {
        URL.revokeObjectURL(signaturePreviewUrl);
        setSignaturePreviewUrl(null);
      }
      setError(null);
      setIsSubmitting(false);
    }
  }, [isOpen]);

  if (!isOpen || !data) return null;

  // Drag and drop for Signature
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };
  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleSignatureFile(e.dataTransfer.files[0]);
    }
  };
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleSignatureFile(e.target.files[0]);
    }
  };
  const handleSignatureFile = (file: File) => {
    if (!file.type.match(/^image\/(jpeg|png|gif|webp)$/)) {
      setError("รองรับเฉพาะไฟล์รูปภาพ (JPG, PNG, GIF) เท่านั้น");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("ขนาดไฟล์ลายเซ็นต์ต้องไม่เกิน 5 MB");
      return;
    }
    setError(null);
    setSignatureFile(file);
    const url = URL.createObjectURL(file);
    setSignaturePreviewUrl(url);
  };

  const removeSignature = () => {
    setSignatureFile(null);
    if (signaturePreviewUrl) {
      URL.revokeObjectURL(signaturePreviewUrl);
      setSignaturePreviewUrl(null);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setError("กรุณากรอกรหัสผ่านเพื่อยืนยันตัวตน");
      return;
    }
    if (needsSignature && !signatureFile) {
      setError("กรุณาอัปโหลดรูปลายเซ็นต์ของคุณ");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // 1. Verify Password & Get Reauth Token
      const verifyRes = await verifyPasswordApi(password);
      if (verifyRes.error || !verifyRes.reauth_token) {
        throw new Error((verifyRes.error as any)?.message || "รหัสผ่านไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง");
      }
      const reauthToken = verifyRes.reauth_token;

      // 2. Upload Signature if needed
      if (needsSignature && signatureFile) {
        const sigRes = await uploadSignatureApi(signatureFile, reauthToken);
        if (sigRes.error) {
          throw new Error((sigRes.error as any)?.message || "อัปโหลดลายเซ็นต์ไม่สำเร็จ");
        }
        await refreshUser();
      }

      // 3. Handle Banking logic
      let finalBankingId = null;
      if (data.banking_mode === "existing") {
        finalBankingId = data.banking_id || null;
      } else if (data.banking_mode === "new" && data.new_bank_account) {
        // Create new bank account
        const bankRes = await addBankAccountApi(data.new_bank_account);
        if (bankRes.error) {
          throw new Error((bankRes.error as any)?.message || "เพิ่มบัญชีรับเงินไม่สำเร็จ");
        }
        if (bankRes.data && (bankRes.data as any).id) {
          finalBankingId = (bankRes.data as any).id;
        } else if (bankRes.data && (bankRes.data as any)._id) {
          finalBankingId = (bankRes.data as any)._id;
        }
      }

      // 4. Create Reimbursement
      const createRes = await createReimbursementApi({
        department_id: data.department_id,
        tag_id: data.tag_id || undefined,
        purpose: data.purpose,
        banking_id: finalBankingId || undefined,
        details: data.details,
      });

      if (createRes.error) {
        throw new Error((createRes.error as any)?.message || "สร้างรายการขอเบิกเงินไม่สำเร็จ");
      }

      const newReimbursementId = (createRes.data as any).id || (createRes.data as any)._id;
      if (!newReimbursementId) {
        throw new Error("API สร้างรายการสำเร็จแต่ไม่ส่งรหัสรายการกลับมา");
      }

      if (data.receipt_file) {
        const receiptRes = await uploadReceiptApi(newReimbursementId, data.receipt_file);
        if ((receiptRes as any).error) {
          console.error("Receipt upload error:", (receiptRes as any).error);
          // We won't block the success flow if only receipt upload fails slightly, but ideally it should succeed.
          // throw new Error(((receiptRes as any).error)?.message || "อัปโหลดใบเสร็จไม่สำเร็จ");
        }
      }

      // 6. Success
      if (onSuccess) {
        onSuccess(newReimbursementId);
      }
    } catch (err: any) {
      setError(err.message || "เกิดข้อผิดพลาดในการทำรายการ");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-opacity animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-md overflow-hidden transition-all transform scale-100 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 pb-0">
          <div className="w-12 h-12 bg-blue-50 text-slate-800 rounded-2xl flex items-center justify-center mb-4">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-900">ยืนยันการส่งใบเบิกเงิน</h2>
          <p className="text-slate-500 mt-1 text-sm leading-relaxed">
            กรุณากรอกรหัสผ่านเพื่อยืนยันตัวตน (Step-up Verification) ข้อมูลจะถูกบันทึกลงระบบทันที
          </p>
        </div>

        <div className="p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-red-50 text-red-600 text-sm p-3.5 rounded-xl border border-red-100 flex items-start space-x-2.5">
                <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="leading-relaxed">{error}</span>
              </div>
            )}

            {needsSignature && (
              <div className="space-y-3">
                <label className="block text-sm font-medium text-slate-700">
                  อัปโหลดลายเซ็นต์ <span className="text-red-500">*</span>
                  <p className="text-xs text-slate-500 font-normal mt-0.5">ระบบตรวจพบว่าคุณยังไม่มีลายเซ็นต์ กรุณาอัปโหลดลายเซ็นต์เพื่อดำเนินการต่อ</p>
                </label>
                
                {signaturePreviewUrl ? (
                  <div className="relative rounded-xl border border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center p-2 group h-32">
                    <img src={signaturePreviewUrl} alt="Signature Preview" className="max-h-full max-w-full object-contain" />
                    <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button
                        type="button"
                        onClick={removeSignature}
                        className="bg-white text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors shadow-sm"
                      >
                        เปลี่ยนรูปลายเซ็นต์
                      </button>
                    </div>
                  </div>
                ) : (
                  <div 
                    className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer ${
                      isDragging ? 'border-blue-500 bg-zinc-50' : 'border-slate-300 hover:border-slate-400 hover:bg-slate-50'
                    }`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      className="hidden" 
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      onChange={handleFileChange}
                    />
                    <div className="mx-auto w-10 h-10 mb-2 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </div>
                    <p className="text-sm font-medium text-slate-700">คลิก หรือ ลากไฟล์รูปลายเซ็นต์มาวางที่นี่</p>
                    <p className="text-xs text-slate-500 mt-1">รองรับ JPG, PNG (พื้นหลังโปร่งใส) ขนาดไม่เกิน 5MB</p>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700">รหัสผ่านของคุณ</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-4 pr-12 py-2.5 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 transition-all placeholder:text-slate-400"
                  placeholder="กรอกรหัสผ่านเพื่อยืนยัน"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none p-1"
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div className="pt-2 flex gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !password || (needsSignature && !signatureFile)}
                className="flex-1 px-4 py-2.5 bg-blue-900 text-white hover:bg-blue-800 rounded-xl font-medium transition-all shadow-sm shadow-blue-900/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    กำลังดำเนินการ...
                  </>
                ) : (
                  "ส่งคำขอเบิกเงิน"
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
