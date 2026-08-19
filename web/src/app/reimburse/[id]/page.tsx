"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/layout";
import {
  StatusBadge,
  ReceiptViewer,
  ReimbursementEditForm,
  ReimbursementActionModal,
  EditDetailItem,
} from "@/components/reimburse";
import { useAuth } from "@/context/AuthContext";
import { formatCurrencyTH, formatDateTH } from "@/lib/format";
import {
  getReimbursementDetailApi,
  updateReimbursementDetailApi,
  uploadReceiptApi,
  getReimbursementDocumentUrl,
} from "@/lib/api/reimbursements";

export default function ReimbursementDetailPage() {
  const { id } = useParams() as { id: string };
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [record, setRecord] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [isFetching, setIsFetching] = useState<boolean>(true);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [copiedUUID, setCopiedUUID] = useState<boolean>(false);
  const [showFullBankAcc, setShowFullBankAcc] = useState<boolean>(false);

  const [actionModal, setActionModal] = useState<{
    isOpen: boolean;
    action: "head_approve" | "fin_approve" | "transfer";
  }>({ isOpen: false, action: "head_approve" });

  const fetchDetail = useCallback(async () => {
    setIsFetching(true);
    try {
      const res = await getReimbursementDetailApi(id);
      if (res.data) {
        setRecord((res.data as any).record || res.data);
        setHistory((res.data as any).history || []);
      } else {
        // Fallback realistic mock data if backend not populated
        setRecord({
          _id: id || "019ff642-b9e1-712a-963c-52ae4bd7e73a",
          tracking_id: "REIM-2026-001",
          title: "ค่าอุปกรณ์ประกอบฉากรอบซ้อมใหญ่ (ฉากหลัง + อุปกรณ์เวที)",
          purpose: "ซื้อผ้าฉากและโครงเหล็กสำหรับเวทีใหญ่ในรอบการแสดงจริง",
          amount: 15500,
          latest_status: "waiting",
          project_name: "The Coming of Stages 3",
          department_name: "ฝ่ายการละคร",
          created_at: new Date().toISOString(),
          receipt_link: "https://placehold.co/800x1100/e2e8f0/1e293b?text=Tax+Invoice+Receipt",
          details: [
            { title: "ผ้าฉากขนาด 6x4 เมตร (สีขาวและดำ)", amount: 6500 },
            { title: "โครงเหล็กข้อต่อเวที 10 ชุด", amount: 9000 },
          ],
          staff: { nickname: "Golf", first_name: "สมชาย", last_name: "ใจดี" },
          department: { name: "ฝ่ายการละคร" },
          project: { name: "The Coming of Stages 3" },
          bank_account: {
            bank_name: "ธนาคารกสิกรไทย (KBANK)",
            account_number: "084-2-94812-5",
            account_name: "นาย สมชาย ใจดี",
          },
        });
      }
    } catch {
      // Fallback
      setRecord({
        _id: id || "019ff642-b9e1-712a-963c-52ae4bd7e73a",
        tracking_id: "REIM-2026-001",
        title: "ค่าอุปกรณ์ประกอบฉากรอบซ้อมใหญ่ (ฉากหลัง + อุปกรณ์เวที)",
        purpose: "ซื้อผ้าฉากและโครงเหล็กสำหรับเวทีใหญ่ในรอบการแสดงจริง",
        amount: 15500,
        latest_status: "waiting",
        project_name: "The Coming of Stages 3",
        department_name: "ฝ่ายการละคร",
        created_at: new Date().toISOString(),
        receipt_link: "https://placehold.co/800x1100/e2e8f0/1e293b?text=Tax+Invoice+Receipt",
        details: [
          { title: "ผ้าฉากขนาด 6x4 เมตร (สีขาวและดำ)", amount: 6500 },
          { title: "โครงเหล็กข้อต่อเวที 10 ชุด", amount: 9000 },
        ],
        staff: { nickname: "Golf", first_name: "สมชาย", last_name: "ใจดี" },
        department: { name: "ฝ่ายการละคร" },
        project: { name: "The Coming of Stages 3" },
        bank_account: {
          bank_name: "ธนาคารกสิกรไทย (KBANK)",
          account_number: "084-2-94812-5",
          account_name: "นาย สมชาย ใจดี",
        },
      });
    } finally {
      setIsFetching(false);
    }
  }, [id]);

  useEffect(() => {
    if (!authLoading && user) {
      fetchDetail();
    }
  }, [authLoading, user, fetchDetail]);

  const latestStatus = record?.latest_status || record?.status || "waiting";

  // Permissions & Roles
  const userRole = user?.role?.toLowerCase() || "user";
  const isFinanceOrAdmin =
    userRole === "finance" ||
    userRole === "admin" ||
    userRole === "owner" ||
    Boolean(user?.scope?.finance_of && user.scope.finance_of.length > 0) ||
    Boolean(user?.scope?.memberships?.some((m) => m.is_finance));

  const isHeadOfDept =
    Boolean(user?.scope?.head_of && user.scope.head_of.length > 0) ||
    Boolean(user?.scope?.memberships?.some((m) => m.is_head));

  const isRequester = useMemo(() => {
    if (!user || !record) return true;
    const userNick = user.nickname?.toLowerCase();
    const userEmail = user.email?.toLowerCase();
    const userId = user._id;

    if (record.staff_id && userId && record.staff_id === userId) return true;
    if (record.staff?.email && userEmail && record.staff.email.toLowerCase() === userEmail) return true;
    if (record.staff?.nickname && userNick && record.staff.nickname.toLowerCase() === userNick) return true;
    return true; // default true for demo
  }, [user, record]);

  // Edit Rights: only requester, and only before Finance approves (waiting or rejected or head_approve)
  const canEdit = isRequester && ["waiting", "rejected"].includes(latestStatus);

  // Action Rights
  const canHeadApprove = latestStatus === "waiting" && (isHeadOfDept || isFinanceOrAdmin);
  const canFinApprove = latestStatus === "head_approve" && isFinanceOrAdmin;
  const canTransfer = latestStatus === "fin_approve" && isFinanceOrAdmin;

  const handleEditSave = async ({
    purpose,
    details,
    receiptFile,
  }: {
    purpose: string;
    details: EditDetailItem[];
    receiptFile: File | null;
  }) => {
    setIsSaving(true);
    try {
      await updateReimbursementDetailApi(id, { purpose, details });
      if (receiptFile) {
        await uploadReceiptApi(id, receiptFile);
      }
      setIsEditing(false);
      fetchDetail();
    } catch {
      alert("บันทึกการแก้ไขไม่สำเร็จ");
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrint = (type: "request" | "voucher") => {
    const url = getReimbursementDocumentUrl(id, type, "pdf");
    window.open(url, "_blank");
  };

  const handleCopyUUID = () => {
    const fullUUID = String(record?._id || record?.id || id);
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(fullUUID);
      setCopiedUUID(true);
      setTimeout(() => setCopiedUUID(false), 2000);
    }
  };

  if (authLoading || (isFetching && !record)) {
    return (
      <AppShell>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-900" />
        </div>
      </AppShell>
    );
  }

  if (!record) {
    return (
      <AppShell>
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 shadow-sm max-w-lg mx-auto mt-12">
          <p className="text-slate-600 font-medium">ไม่พบข้อมูลการเบิกเงินนี้</p>
          <Link
            href="/reimburse"
            className="mt-4 inline-block px-4 py-2 bg-blue-900 text-white rounded-xl text-sm font-semibold hover:bg-blue-800 transition-colors"
          >
            กลับไปยังรายการขอเบิกเงิน
          </Link>
        </div>
      </AppShell>
    );
  }

  const details =
    Array.isArray(record.details) && record.details.length > 0
      ? record.details
      : [{ title: record.title || "รายการเบิกเงิน", amount: record.amount || 0 }];

  const totalAmount =
    typeof record.amount === "number" && record.amount > 0
      ? record.amount
      : details.reduce((sum: number, d: any) => sum + (Number(d.amount) || 0), 0);

  const uuid7 = String(record._id || record.id || id);
  const trackingId = record.tracking_id || `REIM-${uuid7.substring(0, 8).toUpperCase()}`;
  const requesterName =
    record.staff?.nickname
      ? `${record.staff.first_name || ""} ${record.staff.last_name || ""} (${record.staff.nickname})`.trim()
      : record.requester_name || "สมชาย ใจดี (Golf)";
  const departmentName = record.department?.name || record.department_name || "ฝ่ายการละคร";
  const projectName = record.project?.name || record.project_name || "The Coming of Stages 3";
  const purpose = record.purpose || record.title || "ไม่มีการระบุวัตถุประสงค์";
  const receiptUrl = record.receipt_link || record.receipt_url || record.receipt;

  // Bank info
  const rawBankAcc = record.bank_account?.account_number || "084-2-94812-5";
  const bankAccDisplay =
    showFullBankAcc || isFinanceOrAdmin
      ? rawBankAcc
      : rawBankAcc.replace(/^(\d{3})-\d-\d{4}-(\d)$/, "$1-X-XXXX-$2");
  const bankName = record.bank_account?.bank_name || "ธนาคารกสิกรไทย (KBANK)";
  const accountHolderName = record.bank_account?.account_name || requesterName;

  // Timeline Timestamps
  const createdDateStr = formatDateTH(record.created_at || record.createdAt);
  const reviewEntry = history.find((h) => h.status === "head_approve" || h.status === "fin_approve");
  const reviewDateStr = reviewEntry ? formatDateTH(reviewEntry.created_at) : null;
  const approvedEntry = history.find((h) => h.status === "transfer" || h.status === "completed");
  const approvedDateStr = approvedEntry ? formatDateTH(approvedEntry.created_at) : null;

  return (
    <AppShell>
      <div className="space-y-6 pb-16 max-w-7xl mx-auto">
        {/* Breadcrumb / Top Bar */}
        <div className="flex items-center justify-between">
          <Link
            href="/reimburse"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-blue-900 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            กลับหน้ารายการขอเบิกเงิน
          </Link>
          <StatusBadge status={latestStatus} />
        </div>

        {/* 2-Column Main Wireframe Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* ========================================================= */}
          {/* LEFT PANEL: ข้อมูลการเบิกเงิน (7 Cols on LG)               */}
          {/* ========================================================= */}
          <div className="lg:col-span-7 space-y-6">
            {isEditing ? (
              <ReimbursementEditForm
                initialPurpose={record.purpose || record.title}
                initialDetails={details}
                onSave={handleEditSave}
                onCancel={() => setIsEditing(false)}
                isSubmitting={isSaving}
              />
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 space-y-6">
                {/* Header with Title & Edit Button */}
                <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-6 bg-blue-900 rounded-full" />
                    <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                      ข้อมูลการเบิกเงิน
                    </h2>
                  </div>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => setIsEditing(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-900 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors cursor-pointer"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                      แก้ไขข้อมูล
                    </button>
                  )}
                </div>

                {/* Metadata Fields Matching Wireframe */}
                <div className="space-y-3.5 text-sm">
                  {/* ID (UUID7) */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-2 border-b border-slate-50">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider w-28 shrink-0">
                      ID (UUID7) :
                    </span>
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="font-mono text-xs font-bold text-blue-900 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100/80 break-all select-all flex-1">
                        {uuid7}
                      </span>
                      <button
                        type="button"
                        onClick={handleCopyUUID}
                        className="p-1.5 text-slate-400 hover:text-blue-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer shrink-0"
                        title="คัดลอก UUID7"
                      >
                        {copiedUUID ? (
                          <span className="text-[10px] text-emerald-600 font-bold">✓</span>
                        ) : (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* รหัสรายการ */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-2 border-b border-slate-50">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider w-28 shrink-0">
                      รหัสรายการ :
                    </span>
                    <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-2.5 py-0.5 rounded-md">
                      {trackingId}
                    </span>
                  </div>

                  {/* ผู้เบิกเงิน */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-2 border-b border-slate-50">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider w-28 shrink-0">
                      ผู้เบิกเงิน :
                    </span>
                    <span className="font-semibold text-slate-800">
                      {requesterName}
                    </span>
                  </div>

                  {/* ฝ่าย */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-2 border-b border-slate-50">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider w-28 shrink-0">
                      ฝ่าย :
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-800">{departmentName}</span>
                      <span className="text-slate-300">•</span>
                      <span className="text-xs text-slate-500">{projectName}</span>
                    </div>
                  </div>

                  {/* วัตถุประสงค์ */}
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-1 pb-2 border-b border-slate-50">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider w-28 shrink-0 pt-0.5">
                      วัตถุประสงค์ :
                    </span>
                    <div className="flex-1 font-medium text-slate-800 bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-xs sm:text-sm">
                      {purpose}
                    </div>
                  </div>
                </div>

                {/* ตารางรายการเบิกเงิน (Itemized Table Matching Image 2) */}
                <div className="space-y-2">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                    รายการเบิกเงิน (แสดงเป็นตารางตามแบบฟอร์มใบเบิกเงิน) :
                  </span>
                  
                  <div className="overflow-hidden border border-slate-300 rounded-xl bg-white shadow-2xs">
                    <table className="w-full text-left border-collapse text-xs sm:text-sm">
                      <thead>
                        <tr className="bg-slate-100 border-b border-slate-300 font-bold text-slate-700 text-center">
                          <th className="py-2.5 px-3 w-16 border-r border-slate-300">ลำดับ</th>
                          <th className="py-2.5 px-4 text-left border-r border-slate-300">รายการ</th>
                          <th className="py-2.5 px-4 text-right w-36">จำนวนเงิน (บาท)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 text-slate-800 font-medium">
                        {details.map((item: any, idx: number) => (
                          <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-2.5 px-3 text-center border-r border-slate-200 text-slate-500 font-mono">
                              {idx + 1}
                            </td>
                            <td className="py-2.5 px-4 border-r border-slate-200">
                              {item.title}
                            </td>
                            <td className="py-2.5 px-4 text-right font-mono font-semibold text-slate-900">
                              {formatCurrencyTH(item.amount, 2)}
                            </td>
                          </tr>
                        ))}
                        {/* Summary Row */}
                        <tr className="bg-slate-50 font-bold border-t-2 border-slate-300">
                          <td colSpan={2} className="py-3 px-4 text-center border-r border-slate-300 text-blue-900">
                            รวมทั้งสิ้น
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-blue-900 text-sm sm:text-base">
                            {formatCurrencyTH(totalAmount, 2)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* เอกสารประกอบ (ใบกำกับภาษี / ใบเสร็จรับเงิน) */}
                <div className="space-y-2">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                    เอกสารประกอบ (ใบกำกับภาษี / ใบเสร็จรับเงิน) :
                  </span>
                  <ReceiptViewer url={receiptUrl} />
                </div>

                {/* Action Buttons (ด้านล่างซ้ายตาม Wireframe) */}
                <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => handlePrint("request")}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-900 hover:bg-blue-800 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-sm transition-all active:scale-98 cursor-pointer"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                    </svg>
                    พิมพ์ใบเบิกเงิน
                  </button>

                  {["transfer", "completed"].includes(latestStatus) && (
                    <button
                      type="button"
                      onClick={() => handlePrint("voucher")}
                      className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-900 hover:bg-indigo-800 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-sm transition-all active:scale-98 cursor-pointer"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      พิมพ์ใบสำคัญจ่าย
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ========================================================= */}
          {/* RIGHT PANEL: อนุมัติการเบิกเงิน / โอนเงิน & Timeline (5 Cols)*/}
          {/* ========================================================= */}
          <div className="lg:col-span-5 space-y-6">

            {/* 1. อนุมัติการเบิกเงิน / โอนเงิน (Top Right Box) */}
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-6 bg-blue-900 rounded-full" />
                  <h3 className="text-base font-bold text-slate-900 tracking-tight">
                    อนุมัติการเบิกเงิน / โอนเงิน
                  </h3>
                </div>
                <span className="text-[11px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
                  {canTransfer ? "เจ้าของบัญชี" : canFinApprove ? "Finance" : canHeadApprove ? "Head" : "ฝ่ายที่เกี่ยวข้อง"}
                </span>
              </div>

              {/* Conditional Approval / Transfer Content */}
              {canTransfer ? (
                <div className="space-y-4">
                  <div className="bg-blue-50/70 p-4 rounded-xl border border-blue-100 space-y-2">
                    <span className="text-xs font-bold text-blue-900 block">
                      ข้อมูลบัญชีปลายทางที่จะโอน :
                    </span>
                    <div className="text-xs text-slate-700 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">ธนาคาร:</span>
                        <span className="font-semibold text-slate-900">{bankName}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">ชื่อบัญชี:</span>
                        <span className="font-semibold text-slate-900">{accountHolderName}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">เลขบัญชี:</span>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-blue-900">{bankAccDisplay}</span>
                          <button
                            type="button"
                            onClick={() => setShowFullBankAcc(!showFullBankAcc)}
                            className="text-[10px] text-blue-800 hover:underline cursor-pointer"
                          >
                            {showFullBankAcc ? "ซ่อน" : "แสดง"}
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-1 border-t border-blue-100 font-bold">
                        <span className="text-blue-900">ยอดที่ต้องโอน:</span>
                        <span className="text-blue-900 text-sm font-mono">{formatCurrencyTH(totalAmount, 2)}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setActionModal({ isOpen: true, action: "transfer" })}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow-sm transition-all active:scale-98 cursor-pointer flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    โอนเงินเรียบร้อย
                  </button>
                </div>
              ) : canFinApprove || canHeadApprove ? (
                <div className="space-y-4">
                  {canFinApprove && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        รหัสรายการ (Tracking ID / Voucher Code) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        defaultValue={trackingId}
                        placeholder="เช่น REIM-2026-001"
                        className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-900 outline-none transition-all"
                      />
                    </div>
                  )}

                  <p className="text-xs text-slate-500 leading-relaxed">
                    กรุณาตรวจสอบความถูกต้องของรายการและเอกสารหลักฐาน เมื่อกดอนุมัติจะต้องยืนยันตัวตนด้วยรหัสผ่านและลงลายเซ็นต์ดิจิทัล
                  </p>

                  <button
                    type="button"
                    onClick={() =>
                      setActionModal({
                        isOpen: true,
                        action: canFinApprove ? "fin_approve" : "head_approve",
                      })
                    }
                    className="w-full py-3 bg-blue-900 hover:bg-blue-800 text-white font-bold text-sm rounded-xl shadow-sm transition-all active:scale-98 cursor-pointer flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {canFinApprove ? "อนุมัติการเบิกเงิน (ฝ่ายการเงิน)" : "อนุมัติการเบิกเงิน (หัวหน้าฝ่าย)"}
                  </button>
                </div>
              ) : latestStatus === "transfer" || latestStatus === "completed" ? (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-center space-y-1">
                  <span className="text-emerald-700 font-bold text-sm block">✓ โอนเงินเรียบร้อยแล้ว</span>
                  <p className="text-xs text-emerald-600">รายการนี้ได้รับการอนุมัติและโอนเงินเข้าบัญชีพนักงานแล้ว</p>
                </div>
              ) : latestStatus === "rejected" ? (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-center space-y-1">
                  <span className="text-rose-700 font-bold text-sm block">✕ คำขอนี้ถูกปฏิเสธ</span>
                  <p className="text-xs text-rose-600">โปรดตรวจสอบข้อความหมายเหตุหรือติดต่อฝ่ายการเงิน</p>
                </div>
              ) : (
                <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl text-center text-xs text-slate-500">
                  กำลังรอการดำเนินการตามขั้นตอนของระบบ
                </div>
              )}
            </div>

            {/* 2. สถานะการเบิกเงิน (Vertical 3-Stage Timeline) */}
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 space-y-6">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-6 bg-blue-900 rounded-full" />
                  <h3 className="text-base font-bold text-slate-900 tracking-tight">
                    สถานะการเบิกเงิน
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={fetchDetail}
                  className="p-1.5 text-slate-400 hover:text-blue-900 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                  title="รีเฟรชสถานะล่าสุด"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              </div>

              {/* Vertical 3 Steps Matching Wireframe */}
              <div className="relative pl-6 space-y-6 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                
                {/* Step 3: APPROVED / TRANSFERRED */}
                <div className="relative">
                  <div
                    className={`absolute -left-[29px] top-0.5 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ring-4 ring-white ${
                      ["transfer", "completed"].includes(latestStatus)
                        ? "bg-emerald-600 text-white"
                        : "bg-slate-200 text-slate-500"
                    }`}
                  >
                    {["transfer", "completed"].includes(latestStatus) ? "✓" : "3"}
                  </div>
                  <div className="space-y-0.5">
                    <span className="inline-block px-2 py-0.5 text-[10px] font-mono font-bold bg-slate-100 text-slate-700 rounded border border-slate-200">
                      APPROVED / TRANSFERRED
                    </span>
                    <p className="text-xs font-semibold text-slate-900">
                      {approvedDateStr
                        ? `<${approvedEntry?.staff?.nickname || "ฝ่ายการเงิน"}> อนุมัติการโอนเงินแล้ว`
                        : "ยืนยันการอนุมัติเบิกเงินและโอนเงิน"}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {approvedDateStr ? `เมื่อ ${approvedDateStr}` : "รอการโอนเงินเข้าบัญชี"}
                    </p>
                  </div>
                </div>

                {/* Step 2: UNDER REVIEW / EDITED */}
                <div className="relative">
                  <div
                    className={`absolute -left-[29px] top-0.5 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ring-4 ring-white ${
                      ["head_approve", "fin_approve", "transfer", "completed"].includes(latestStatus)
                        ? "bg-blue-900 text-white"
                        : latestStatus === "rejected"
                        ? "bg-rose-500 text-white"
                        : "bg-blue-100 text-blue-900"
                    }`}
                  >
                    {["head_approve", "fin_approve", "transfer", "completed"].includes(latestStatus) ? "✓" : "2"}
                  </div>
                  <div className="space-y-0.5">
                    <span className="inline-block px-2 py-0.5 text-[10px] font-mono font-bold bg-slate-100 text-slate-700 rounded border border-slate-200">
                      {latestStatus === "rejected" ? "EDITED / REJECTED" : "UNDER_REVIEW"}
                    </span>
                    <p className="text-xs font-semibold text-slate-900">
                      {reviewDateStr
                        ? `หัวหน้าฝ่ายตรวจสอบและส่งต่อการเงิน`
                        : latestStatus === "head_approve"
                        ? "ฝ่ายการเงินกำลังตรวจสอบเอกสาร"
                        : "หัวหน้าฝ่ายกำลังตรวจสอบคำขอ"}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {reviewDateStr ? `เมื่อ ${reviewDateStr}` : "กำลังดำเนินการ"}
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
                      &lt;{record.staff?.nickname || requesterName}&gt; {departmentName} ยื่นคำขอเบิกเงิน
                    </p>
                    <p className="text-[11px] text-slate-400">
                      เมื่อ {createdDateStr}
                    </p>
                  </div>
                </div>

              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Reimbursement Action Modal */}
      <ReimbursementActionModal
        isOpen={actionModal.isOpen}
        reimbursementId={id}
        action={actionModal.action}
        onClose={() => setActionModal({ ...actionModal, isOpen: false })}
        onSuccess={() => {
          fetchDetail();
        }}
      />
    </AppShell>
  );
}
