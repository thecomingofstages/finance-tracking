"use client";

import React, { useState, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import StatusBadge from "./StatusBadge";
import { updateReimbursementStatusApi } from "@/lib/api/reimbursements";
import { verifyPasswordApi } from "@/lib/api/auth";
import { formatCurrencyTH } from "@/lib/format";

export interface ReimbursementDetailModalProps {
  isOpen: boolean;
  item: any | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export const ReimbursementDetailModal: React.FC<ReimbursementDetailModalProps> = ({
  isOpen,
  item,
  onClose,
  onSuccess,
}) => {
  const { user } = useAuth();

  // Action / Step-up password dialog state
  const [actionType, setActionType] = useState<"approve" | "reject" | null>(null);
  const [password, setPassword] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Check privileged role permissions
  const isPrivilegedRole = useMemo(() => {
    if (!user) return false;
    if (user.role === "admin" || user.role === "finance") return true;
    if (user.scope?.head_of && user.scope.head_of.length > 0) return true;
    if (user.scope?.finance_of && user.scope.finance_of.length > 0) return true;
    if (user.scope?.memberships?.some((m) => m.is_head || m.is_finance)) return true;
    return false;
  }, [user]);

  if (!isOpen || !item) return null;

  // Extract fields with fallbacks
  const status = item.status || item.latest_status || "waiting";
  const rawId = item._id || item.id || "";
  const trackingId =
    item.tracking_id ||
    (rawId ? `REIM-${String(rawId).substring(0, 8).toUpperCase()}` : "REIM-N/A");
  const title = item.title || item.purpose || "ไม่มีชื่อรายการ";

  // Calculate total amount
  let amount = 0;
  if (typeof item.amount === "number") {
    amount = item.amount;
  } else if (Array.isArray(item.details) && item.details.length > 0) {
    amount = item.details.reduce((sum: number, d: any) => sum + (Number(d.amount) || 0), 0);
  }

  const formattedAmount = formatCurrencyTH(amount, 2);

  const projectName =
    item.project_name || item.project?.name || item.project_code || "โครงการทั่วไป";
  const departmentName =
    item.department_name || item.department?.name || item.staff_dept_name || "ไม่ระบุแผนก";
  
  const requesterName =
    item.requester_name ||
    item.staff_name ||
    item.staff?.nickname ||
    (item.staff?.first_name ? `${item.staff.first_name} ${item.staff.last_name || ""}` : null) ||
    "ไม่ระบุผู้ยื่น";

  const rawDate = item.created_at || item.createdAt || item.date;
  let formattedDate = "-";
  if (rawDate) {
    try {
      const d = new Date(rawDate);
      if (!isNaN(d.getTime())) {
        formattedDate = d.toLocaleDateString("th-TH", {
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
      }
    } catch {
      formattedDate = String(rawDate);
    }
  }

  const receiptUrl = item.receipt_url || item.receipt_link || item.receipt || item.receiptUrl;
  const isImageReceipt =
    receiptUrl && typeof receiptUrl === "string" && receiptUrl.match(/\.(png|jpe?g|webp|gif)/i);

  // Timeline steps definitions
  const steps = [
    { key: "waiting", label: "ยื่นคำขอ" },
    { key: "head_approve", label: "หัวหน้าอนุมัติ" },
    { key: "fin_approve", label: "การเงินตรวจสอบ" },
    { key: "transfer", label: "โอนเงินเรียบร้อย" },
  ];

  const getStepIndex = (statusKey: string) => {
    switch (statusKey) {
      case "waiting":
        return 0;
      case "head_approve":
        return 1;
      case "fin_approve":
        return 2;
      case "transfer":
      case "completed":
        return 3;
      default:
        return 0;
    }
  };

  const currentStepIndex = getStepIndex(status);
  const isRejected = status === "rejected";

  const handleOpenActionDialog = (type: "approve" | "reject") => {
    setActionType(type);
    setPassword("");
    setNote("");
    setError(null);
  };

  const handleCloseActionDialog = () => {
    setActionType(null);
    setPassword("");
    setNote("");
    setError(null);
  };

  const handleSubmitAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setError("กรุณากรอกรหัสผ่านเพื่อยืนยันตัวตน");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Step-up verification
      const verifyRes = await verifyPasswordApi(password);
      if (verifyRes.error || !verifyRes.reauth_token) {
        const errMsg =
          (verifyRes.error as any)?.message ||
          "รหัสผ่านไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง";
        setError(errMsg);
        setIsSubmitting(false);
        return;
      }

      // Determine next status
      let nextStatus = "rejected";
      if (actionType === "approve") {
        if (status === "waiting") {
          nextStatus = "head_approve";
        } else if (status === "head_approve") {
          nextStatus = "fin_approve";
        } else {
          nextStatus = "transfer";
        }
      }

      const updateRes = await updateReimbursementStatusApi(
        rawId,
        nextStatus,
        note.trim() || undefined,
        verifyRes.reauth_token
      );

      if (updateRes.error) {
        const errMsg =
          (updateRes.error as any)?.message ||
          "เกิดข้อผิดพลาดในการอัปเดตสถานะ";
        setError(errMsg);
        setIsSubmitting(false);
        return;
      }

      handleCloseActionDialog();
      if (onSuccess) {
        onSuccess();
      }
      onClose();
    } catch (err: any) {
      setError(err?.message || "เกิดข้อผิดพลาดในการเชื่อมต่อระบบ");
    } finally {
      setIsSubmitting(false);
    }
  };

  const canPerformAction = (() => {
    if (!user) return false;
    const isFinanceOrAdmin =
      user.role === "admin" ||
      user.role === "owner" ||
      user.role === "finance" ||
      Boolean(user.scope?.finance_of && user.scope.finance_of.length > 0) ||
      Boolean(user.scope?.memberships?.some((m) => m.is_finance));

    const isHead =
      Boolean(user.scope?.head_of && user.scope.head_of.length > 0) ||
      Boolean(user.scope?.memberships?.some((m) => m.is_head));

    if (status === "waiting") return isHead || isFinanceOrAdmin;
    if (status === "head_approve") return isFinanceOrAdmin;
    return false;
  })();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm transition-opacity animate-in fade-in duration-200">
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-2xl overflow-hidden transition-all transform scale-100 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center space-x-3">
            <span className="font-mono text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg border border-slate-200">
              {trackingId}
            </span>
            <StatusBadge status={status} />
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Title & Amount */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">
                หัวข้อรายการเบิกเงิน
              </p>
              <h2 className="text-xl font-bold text-slate-800">{title}</h2>
              {item.note && (
                <p className="text-sm text-slate-600 mt-1 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  {item.note}
                </p>
              )}
            </div>
            <div className="text-left sm:text-right shrink-0">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">
                ยอดเงินรวม
              </p>
              <span className="text-2xl font-extrabold text-blue-900">{formattedAmount}</span>
            </div>
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-slate-50/70 rounded-xl border border-slate-100">
            <div>
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
                โครงการ (Project)
              </span>
              <span className="text-xs font-semibold text-slate-700 mt-0.5 block truncate">
                {projectName}
              </span>
            </div>
            <div>
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
                แผนก (Department)
              </span>
              <span className="text-xs font-semibold text-slate-700 mt-0.5 block truncate">
                {departmentName}
              </span>
            </div>
            <div>
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
                ผู้ยื่นคำขอ (Requester)
              </span>
              <span className="text-xs font-semibold text-slate-700 mt-0.5 block truncate">
                {requesterName}
              </span>
            </div>
            <div>
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
                วันที่ยื่น (Date)
              </span>
              <span className="text-xs font-semibold text-slate-700 mt-0.5 block truncate">
                {formattedDate}
              </span>
            </div>
          </div>

          {/* Receipt Document Section */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
              เอกสารหลักฐาน / ใบเสร็จรับเงิน
            </h3>
            {receiptUrl ? (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                {isImageReceipt ? (
                  <div className="relative rounded-lg overflow-hidden border border-slate-200 max-h-56 flex items-center justify-center bg-slate-900/5">
                    <img
                      src={receiptUrl}
                      alt="Receipt preview"
                      className="max-h-56 object-contain"
                    />
                  </div>
                ) : (
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-50 text-slate-800 flex items-center justify-center font-bold text-xs">
                      DOC
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-slate-800 truncate">
                        หลักฐานการเบิกเงิน
                      </p>
                      <p className="text-[11px] text-slate-400">คลิกเพื่อดูเอกสารแนบฉบับเต็ม</p>
                    </div>
                  </div>
                )}
                <div className="flex justify-end">
                  <a
                    href={receiptUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-blue-900 bg-zinc-50 border border-slate-200 rounded-lg hover:bg-blue-50 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                      />
                    </svg>
                    <span>ดูเอกสารฉบับเต็ม</span>
                  </a>
                </div>
              </div>
            ) : (
              <div className="p-4 border border-dashed border-slate-200 rounded-xl text-center bg-slate-50/50 text-xs text-slate-400">
                ไม่มีเอกสารหลักฐานแนบในรายการนี้
              </div>
            )}
          </div>

          {/* Status Progress Timeline */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
              สถานะการดำเนินงาน (Timeline)
            </h3>
            <div className="p-4 bg-slate-50/70 border border-slate-200 rounded-xl">
              {isRejected ? (
                <div className="flex items-center space-x-3 text-slate-800 bg-rose-50 border border-slate-200 p-3 rounded-lg text-xs font-medium">
                  <svg className="w-5 h-5 shrink-0 fill-current" viewBox="0 0 20 20">
                    <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" />
                  </svg>
                  <span>คำขอนี้ถูกปฏิเสธแล้ว</span>
                </div>
              ) : (
                <div className="relative flex items-center justify-between">
                  {/* Background progress bar */}
                  <div className="absolute top-1/2 left-4 right-4 h-0.5 bg-slate-200 -translate-y-1/2 z-0" />
                  <div
                    className="absolute top-1/2 left-4 h-0.5 bg-blue-900 -translate-y-1/2 z-0 transition-all duration-300"
                    style={{
                      width: `${(currentStepIndex / (steps.length - 1)) * 100}%`,
                    }}
                  />

                  {steps.map((step, idx) => {
                    const isCompleted = idx <= currentStepIndex;
                    const isCurrent = idx === currentStepIndex;

                    return (
                      <div
                        key={step.key}
                        className="relative z-10 flex flex-col items-center group"
                      >
                        <div
                          className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                            isCompleted
                              ? "bg-blue-900 text-white ring-4 ring-emerald-50"
                              : isCurrent
                              ? "bg-blue-900 text-white ring-4 ring-blue-100"
                              : "bg-white text-slate-400 border border-slate-300"
                          }`}
                        >
                          {isCompleted && idx < currentStepIndex ? (
                            <svg className="w-4 h-4 stroke-current" fill="none" viewBox="0 0 24 24">
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={3}
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          ) : (
                            idx + 1
                          )}
                        </div>
                        <span
                          className={`text-[11px] font-medium mt-1.5 text-center ${
                            isCurrent
                              ? "text-blue-900 font-bold"
                              : isCompleted
                              ? "text-slate-700"
                              : "text-slate-400"
                          }`}
                        >
                          {step.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer / Action Bar for Privileged Roles */}
        {canPerformAction && (
          <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/70 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={() => handleOpenActionDialog("reject")}
              className="px-4 py-2.5 text-xs font-medium text-slate-800 bg-rose-50 border border-slate-200 rounded-xl hover:bg-blue-50 transition-colors flex items-center space-x-1.5"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              <span>ปฏิเสธคำขอ</span>
            </button>
            <button
              type="button"
              onClick={() => handleOpenActionDialog("approve")}
              className="px-5 py-2.5 text-xs font-medium text-white bg-blue-900 hover:bg-blue-800 rounded-xl transition-colors shadow-sm flex items-center space-x-1.5"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>อนุมัติคำขอ</span>
            </button>
          </div>
        )}
      </div>

      {/* Step-Up Password Confirmation Dialog */}
      {actionType && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-md overflow-hidden transition-all transform scale-100 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-base font-bold text-slate-800">
                {actionType === "approve" ? "ยืนยันการอนุมัติคำขอ" : "ยืนยันการปฏิเสธคำขอ"}
              </h3>
              <button
                type="button"
                onClick={handleCloseActionDialog}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {error && (
              <div className="p-3 mb-4 text-xs text-rose-600 bg-rose-50 border border-slate-200 rounded-lg flex items-center gap-2">
                <svg className="w-4 h-4 shrink-0 fill-current" viewBox="0 0 20 20">
                  <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmitAction} className="space-y-4">
              <p className="text-xs text-slate-600">
                เพื่อความปลอดภัย กรุณากรอกรหัสผ่านของคุณเพื่อยืนยันการทำรายการ (Step-Up Re-Authentication)
              </p>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  รหัสผ่าน / Password <span className="text-rose-500">*</span>
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="กรอกรหัสผ่านของคุณ"
                  className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-900 focus:border-transparent"
                  autoFocus
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  หมายเหตุ / เหตุผลเพิ่มเติม
                </label>
                <textarea
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={
                    actionType === "reject"
                      ? "ระบุเหตุผลในการปฏิเสธคำขอ"
                      : "ระบุข้อความเพิ่มเติม (ถ้ามี)"
                  }
                  className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-900 focus:border-transparent resize-none"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleCloseActionDialog}
                  disabled={isSubmitting}
                  className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-50"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`px-4 py-2 text-xs font-medium text-white rounded-xl transition-colors shadow-xs flex items-center space-x-2 disabled:opacity-50 ${
                    actionType === "approve"
                      ? "bg-blue-900 hover:bg-blue-800"
                      : "bg-blue-600 hover:bg-blue-900"
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <svg className="w-3.5 h-3.5 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>กำลังประมวลผล...</span>
                    </>
                  ) : (
                    <span>
                      {actionType === "approve" ? "ยืนยันอนุมัติ" : "ยืนยันปฏิเสธ"}
                    </span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReimbursementDetailModal;
