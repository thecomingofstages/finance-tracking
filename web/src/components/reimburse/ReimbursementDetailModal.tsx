"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import StatusBadge from "./StatusBadge";
import { ReceiptViewer } from "./ReceiptViewer";
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
  const [copiedTrackingId, setCopiedTrackingId] = useState<boolean>(false);

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
    item.department_name || item.department?.name || item.staff_dept_name || "ไม่ระบุฝ่าย";
  
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

  const fullTrackingId = String(item.tracking_id || item._id || item.id || "");

  const handleCopyId = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(fullTrackingId);
      setCopiedTrackingId(true);
      setTimeout(() => setCopiedTrackingId(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm transition-opacity animate-in fade-in duration-200">
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-2xl overflow-hidden transition-all transform scale-100 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-slate-900">
              รายละเอียดคำขอเบิกเงิน
            </h3>
            <StatusBadge status={status} />
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Dedicated Full UUID7 Tracking ID Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-6 py-2.5 bg-blue-50/60 border-b border-blue-100/60 text-xs">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="text-slate-500 font-medium whitespace-nowrap">รหัสติดตาม (UUID7):</span>
            <span className="font-mono text-xs font-bold text-blue-900 bg-white px-2.5 py-1 rounded-md border border-blue-200/80 shadow-2xs break-all select-all">
              {fullTrackingId || trackingId}
            </span>
          </div>
          <button
            type="button"
            onClick={handleCopyId}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-blue-900 bg-white hover:bg-blue-50 border border-blue-200 rounded-lg shadow-2xs transition-all active:scale-95 shrink-0 cursor-pointer"
            title="คัดลอกรหัสติดตามฉบับเต็ม"
          >
            {copiedTrackingId ? (
              <span className="text-emerald-600 font-bold">✓ คัดลอกแล้ว</span>
            ) : (
              <>
                <svg className="w-3.5 h-3.5 text-blue-900" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <span>คัดลอกรหัส</span>
              </>
            )}
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Title & Amount Card */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 p-4 bg-slate-50/70 rounded-2xl border border-slate-100">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                หัวข้อรายการเบิกเงิน
              </p>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 leading-snug break-words">
                {title}
              </h2>
              {item.note && (
                <p className="text-xs text-slate-600 mt-2 bg-white p-2.5 rounded-xl border border-slate-100">
                  <span className="font-semibold text-slate-700">หมายเหตุ:</span> {item.note}
                </p>
              )}
            </div>
            <div className="text-left sm:text-right shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200/60">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                ยอดเงินรวม
              </p>
              <span className="text-xl sm:text-2xl font-extrabold text-blue-900 block">
                {formattedAmount}
              </span>
            </div>
          </div>

          {/* Metadata Grid (2 Columns, Never Truncated) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-slate-50/50 rounded-2xl border border-slate-100">
            <div className="flex items-start justify-between sm:justify-start sm:gap-3 p-2.5 bg-white rounded-xl border border-slate-100">
              <span className="text-xs font-medium text-slate-400 shrink-0">โครงการ:</span>
              <span className="text-xs font-semibold text-slate-800 text-right sm:text-left break-words">{projectName}</span>
            </div>
            <div className="flex items-start justify-between sm:justify-start sm:gap-3 p-2.5 bg-white rounded-xl border border-slate-100">
              <span className="text-xs font-medium text-slate-400 shrink-0">ฝ่าย:</span>
              <span className="text-xs font-semibold text-slate-800 text-right sm:text-left break-words">{departmentName}</span>
            </div>
            <div className="flex items-start justify-between sm:justify-start sm:gap-3 p-2.5 bg-white rounded-xl border border-slate-100">
              <span className="text-xs font-medium text-slate-400 shrink-0">ผู้ยื่นคำขอ:</span>
              <span className="text-xs font-semibold text-slate-800 text-right sm:text-left break-words">{requesterName}</span>
            </div>
            <div className="flex items-start justify-between sm:justify-start sm:gap-3 p-2.5 bg-white rounded-xl border border-slate-100">
              <span className="text-xs font-medium text-slate-400 shrink-0">วันที่ยื่น:</span>
              <span className="text-xs font-semibold text-slate-800 text-right sm:text-left break-words">{formattedDate}</span>
            </div>
          </div>

          {/* ตารางรายการเบิกเงิน (Itemized Table Matching Image 2) */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
              รายการเบิกเงิน (ตารางตามแบบฟอร์มใบเบิกเงิน)
            </h3>
            
            <div className="overflow-hidden border border-slate-300 rounded-xl bg-white shadow-2xs">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-300 font-bold text-slate-700 text-center">
                    <th className="py-2 px-3 w-14 border-r border-slate-300">ลำดับ</th>
                    <th className="py-2 px-3 text-left border-r border-slate-300">รายการ</th>
                    <th className="py-2 px-3 text-right w-32">จำนวนเงิน (บาท)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-800 font-medium">
                  {(Array.isArray(item.details) && item.details.length > 0
                    ? item.details
                    : [{ title: title, amount: amount }]
                  ).map((d: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-2 px-3 text-center border-r border-slate-200 text-slate-500 font-mono">
                        {idx + 1}
                      </td>
                      <td className="py-2 px-3 border-r border-slate-200">
                        {d.title}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-semibold text-slate-900">
                        {formatCurrencyTH(d.amount, 2)}
                      </td>
                    </tr>
                  ))}
                  {/* Summary Row */}
                  <tr className="bg-slate-50 font-bold border-t-2 border-slate-300">
                    <td colSpan={2} className="py-2.5 px-3 text-center border-r border-slate-300 text-blue-900">
                      รวมทั้งสิ้น
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-blue-900 font-bold">
                      {formattedAmount}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Receipt Document Section */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
              เอกสารหลักฐาน / ใบกำกับภาษี
            </h3>
            <ReceiptViewer url={receiptUrl} />
          </div>

          {/* Status Progress Vertical 3-Stage Timeline */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                สถานะการดำเนินงาน (Timeline)
              </h3>
            </div>
            
            <div className="p-4 bg-slate-50/70 border border-slate-200 rounded-xl">
              <div className="relative pl-6 space-y-5 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                
                {/* Step 3: APPROVED / TRANSFERRED */}
                <div className="relative">
                  <div
                    className={`absolute -left-[29px] top-0.5 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ring-4 ring-white ${
                      ["transfer", "completed"].includes(status)
                        ? "bg-emerald-600 text-white"
                        : "bg-slate-200 text-slate-500"
                    }`}
                  >
                    {["transfer", "completed"].includes(status) ? "✓" : "3"}
                  </div>
                  <div className="space-y-0.5">
                    <span className="inline-block px-2 py-0.5 text-[10px] font-mono font-bold bg-slate-100 text-slate-700 rounded border border-slate-200">
                      APPROVED / TRANSFERRED
                    </span>
                    <p className="text-xs font-semibold text-slate-900">
                      {["transfer", "completed"].includes(status)
                        ? "อนุมัติการโอนเงินและจ่ายเงินเรียบร้อยแล้ว"
                        : "ยืนยันการอนุมัติเบิกเงินและโอนเงิน"}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {["transfer", "completed"].includes(status) ? "โอนเงินเรียบร้อย" : "รอการโอนเงินเข้าบัญชี"}
                    </p>
                  </div>
                </div>

                {/* Step 2: UNDER REVIEW / EDITED */}
                <div className="relative">
                  <div
                    className={`absolute -left-[29px] top-0.5 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ring-4 ring-white ${
                      ["head_approve", "fin_approve", "transfer", "completed"].includes(status)
                        ? "bg-blue-900 text-white"
                        : status === "rejected"
                        ? "bg-rose-500 text-white"
                        : "bg-blue-100 text-blue-900"
                    }`}
                  >
                    {["head_approve", "fin_approve", "transfer", "completed"].includes(status) ? "✓" : "2"}
                  </div>
                  <div className="space-y-0.5">
                    <span className="inline-block px-2 py-0.5 text-[10px] font-mono font-bold bg-slate-100 text-slate-700 rounded border border-slate-200">
                      {status === "rejected" ? "EDITED / REJECTED" : "UNDER_REVIEW"}
                    </span>
                    <p className="text-xs font-semibold text-slate-900">
                      {status === "head_approve"
                        ? "ฝ่ายการเงินกำลังตรวจสอบเอกสาร"
                        : status === "rejected"
                        ? "ส่งกลับให้ผู้ยื่นแก้ไขเอกสาร"
                        : "หัวหน้าฝ่ายกำลังตรวจสอบคำขอ"}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      กำลังดำเนินการ
                    </p>
                  </div>
                </div>

                {/* Step 1: CREATED */}
                <div className="relative">
                  <div className="absolute -left-[29px] top-0.5 w-6 h-6 rounded-full bg-blue-900 text-white flex items-center justify-center text-xs font-bold ring-4 ring-white">
                    ✓
                  </div>
                  <div className="space-y-0.5">
                    <span className="inline-block px-2 py-0.5 text-[10px] font-mono font-bold bg-slate-100 text-slate-700 rounded border border-slate-200">
                      CREATED
                    </span>
                    <p className="text-xs font-semibold text-slate-900">
                      &lt;{requesterName}&gt; {departmentName} ยื่นคำขอเบิกเงิน
                    </p>
                    <p className="text-[11px] text-slate-400">
                      เมื่อ {formattedDate}
                    </p>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>

        {/* Footer / Action Bar for Privileged Roles */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/70 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Link
              href={`/reimburse/${rawId}`}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-blue-900 bg-white hover:bg-blue-50 border border-slate-200 rounded-xl transition-colors shadow-2xs"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              <span>เปิดดูหน้าเต็ม</span>
            </Link>
          </div>

          {canPerformAction ? (
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => handleOpenActionDialog("reject")}
                className="px-4 py-2 text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-xl hover:bg-rose-100 transition-colors flex items-center space-x-1.5 cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                <span>ปฏิเสธคำขอ</span>
              </button>
              <button
                type="button"
                onClick={() => handleOpenActionDialog("approve")}
                className="px-4 py-2 text-xs font-medium text-white bg-blue-900 hover:bg-blue-800 rounded-xl transition-colors shadow-sm flex items-center space-x-1.5 cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>อนุมัติคำขอ</span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer"
            >
              ปิดหน้าต่าง
            </button>
          )}
        </div>
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
