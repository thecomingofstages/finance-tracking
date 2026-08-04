"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/layout";
import { StatusBadge } from "@/components/reimburse";
import { ReceiptViewer, ReimbursementEditForm, ReimbursementActionModal, EditDetailItem } from "@/components/reimburse";
import { useAuth } from "@/context/AuthContext";
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
  const [actionModal, setActionModal] = useState<{ isOpen: boolean; action: "head_approve" | "fin_approve" | "transfer" }>({ isOpen: false, action: "head_approve" });

  const fetchDetail = useCallback(async () => {
    setIsFetching(true);
    try {
      const res = await getReimbursementDetailApi(id);
      if (res.data) {
        setRecord((res.data as any).record || res.data); // Support mocked structure which wraps in { record, history } or flat
        setHistory((res.data as any).history || []);
      }
    } catch (err) {
      console.error("Failed to fetch reimbursement details", err);
    } finally {
      setIsFetching(false);
    }
  }, [id]);

  useEffect(() => {
    if (!authLoading && user) {
      fetchDetail();
    }
  }, [authLoading, user, fetchDetail]);

  const latestStatus = record?.latest_status || "waiting";
  
  // Permissions & Roles
  const userRole = user?.role?.toLowerCase() || "user";
  const isFinance = userRole === "finance" || userRole === "admin" || userRole === "owner";
  
  // Is this user the one who created it? (Assuming mock requester is current user for demo unless specified)
  // In real app, we check `record.staff_id === user._id`
  const isRequester = true; // Placeholder for demo

  // Edit Rights: only requester, and only when waiting or rejected
  const canEdit = isRequester && ["waiting", "rejected"].includes(latestStatus);

  // Action Rights
  // Head approve: Need head_of scope. We will just simulate it if they are finance or admin as fallback for mock
  const canHeadApprove = latestStatus === "waiting" && (isFinance || (user?.scope?.head_of && user.scope.head_of.length > 0));
  const canFinApprove = latestStatus === "head_approve" && isFinance;
  const canTransfer = latestStatus === "fin_approve" && isFinance;

  const handleEditSave = async ({ purpose, details, receiptFile }: { purpose: string; details: EditDetailItem[]; receiptFile: File | null }) => {
    setIsSaving(true);
    try {
      await updateReimbursementDetailApi(id, { purpose, details });
      if (receiptFile) {
        await uploadReceiptApi(id, receiptFile);
      }
      setIsEditing(false);
      fetchDetail(); // refresh
    } catch (err) {
      console.error("Failed to save edit", err);
      alert("บันทึกการแก้ไขไม่สำเร็จ");
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrint = (type: "request" | "voucher") => {
    const url = getReimbursementDocumentUrl(id, type, "pdf");
    window.open(url, "_blank");
  };

  if (authLoading || (isFetching && !record)) {
    return (
      <AppShell>
        <div className="flex items-center justify-center min-h-[50vh]">
          <svg className="w-8 h-8 animate-spin text-slate-800" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
        </div>
      </AppShell>
    );
  }

  if (!record) {
    return (
      <AppShell>
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200">
          <p className="text-slate-500">ไม่พบข้อมูลการเบิกเงินนี้</p>
          <button onClick={() => router.push("/")} className="mt-4 text-slate-800 font-medium hover:underline">กลับหน้าหลัก</button>
        </div>
      </AppShell>
    );
  }

  const details = record.details || [];
  const totalAmount = details.reduce((sum: number, d: any) => sum + (Number(d.amount) || 0), 0);

  // Mocked details since they aren't populated in mock DB
  const requesterName = record.staff?.nickname || "พนักงาน (ทดสอบ)";
  const departmentName = record.department?.name || "ฝ่ายกิจกรรม (ทดสอบ)";
  
  // Bank Account Censoring
  const rawBankAcc = record.bank_account?.account_number || "0123456789";
  const bankAccDisplay = isFinance ? rawBankAcc : rawBankAcc.replace(/\d(?=\d{4})/g, "X");
  const bankName = record.bank_account?.bank_name || "ธนาคารกสิกรไทย (KBANK)";

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto space-y-6 pb-24 relative animate-fadeIn">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-white p-6 rounded-2xl border border-slate-200 shadow-sm gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">รายละเอียดการเบิกเงิน</h1>
              <StatusBadge status={latestStatus} />
            </div>
            <p className="text-sm font-mono text-slate-500 tracking-wide">
              ID: {record.tracking_id || record._id || id}
            </p>
          </div>
          
          <div className="flex items-center gap-3">
             <button
               onClick={() => handlePrint("request")}
               className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm rounded-xl transition-colors cursor-pointer inline-flex items-center gap-2"
             >
               <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
               พิมพ์ใบเบิกเงิน
             </button>
             
             {["transfer", "completed"].includes(latestStatus) && (
                <button
                  onClick={() => handlePrint("voucher")}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm rounded-xl transition-colors cursor-pointer inline-flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  พิมพ์ใบสำคัญจ่าย
                </button>
             )}
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left Panel: Details */}
          <div className="flex-1 space-y-6">
            {isEditing ? (
              <ReimbursementEditForm
                initialPurpose={record.purpose}
                initialDetails={details}
                onSave={handleEditSave}
                onCancel={() => setIsEditing(false)}
                isSubmitting={isSaving}
              />
            ) : (
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-bold text-slate-900">ข้อมูลการเบิกเงิน</h3>
                  {canEdit && (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="px-4 py-2 text-sm font-semibold text-slate-800 bg-zinc-50 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer inline-flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                      แก้ไขข้อมูล
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                  <div>
                    <div className="text-xs font-semibold text-slate-400 mb-1 uppercase tracking-wide">ผู้เบิกเงิน</div>
                    <div className="font-medium text-slate-900">{requesterName}</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-400 mb-1 uppercase tracking-wide">ฝ่าย / แผนก</div>
                    <div className="font-medium text-slate-900">{departmentName}</div>
                  </div>
                  <div className="md:col-span-2">
                    <div className="text-xs font-semibold text-slate-400 mb-1 uppercase tracking-wide">วัตถุประสงค์</div>
                    <div className="font-medium text-slate-900 bg-slate-50 p-3 rounded-xl border border-slate-100">{record.purpose}</div>
                  </div>
                </div>

                <div className="mb-8">
                  <div className="text-xs font-semibold text-slate-400 mb-3 uppercase tracking-wide">รายการเบิกเงิน</div>
                  <div className="space-y-3">
                    {details.map((item: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-xl">
                        <div className="font-medium text-slate-800">{item.title}</div>
                        <div className="font-bold text-slate-900">
                          ฿{Number(item.amount || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between p-4 mt-3 bg-zinc-50 border border-blue-100 rounded-xl">
                    <div className="font-bold text-blue-900">ยอดรวมทั้งหมด</div>
                    <div className="font-black text-xl text-blue-700">
                      ฿{totalAmount.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>

                <div>
                  <div className="text-xs font-semibold text-slate-400 mb-3 uppercase tracking-wide">เอกสารประกอบ (ใบเสร็จ / ใบกำกับภาษี)</div>
                  <ReceiptViewer url={record.receipt_link} />
                </div>
              </div>
            )}
          </div>

          {/* Right Panel: Status & Actions */}
          <div className="w-full lg:w-80 xl:w-96 shrink-0 space-y-6">
            
            {/* Action Box */}
            {(canHeadApprove || canFinApprove || canTransfer) && (
              <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-6 rounded-2xl shadow-lg text-white">
                <h3 className="text-lg font-bold mb-2">
                   {canHeadApprove && "อนุมัติการเบิกเงิน (หัวหน้าฝ่าย)"}
                   {canFinApprove && "อนุมัติการเบิกเงิน (ฝ่ายการเงิน)"}
                   {canTransfer && "การโอนเงิน (เจ้าของบัญชี)"}
                </h3>
                
                {canTransfer && (
                   <div className="mt-4 mb-6 bg-white/10 p-4 rounded-xl border border-white/20">
                      <div className="text-xs font-medium text-blue-200 mb-1">บัญชีปลายทาง</div>
                      <div className="font-bold text-lg mb-1">{bankAccDisplay}</div>
                      <div className="text-sm font-medium text-white">{bankName}</div>
                      <div className="text-xs text-blue-200 mt-2">ยอดโอน: ฿{totalAmount.toLocaleString()}</div>
                   </div>
                )}
                
                {!canTransfer && (
                   <p className="text-sm text-blue-100 mb-6 leading-relaxed">
                     โปรดตรวจสอบข้อมูลเอกสารและยอดเงินให้ถูกต้องก่อนทำการอนุมัติ
                   </p>
                )}

                <button
                  onClick={() => {
                    if (canHeadApprove) setActionModal({ isOpen: true, action: "head_approve" });
                    else if (canFinApprove) setActionModal({ isOpen: true, action: "fin_approve" });
                    else if (canTransfer) setActionModal({ isOpen: true, action: "transfer" });
                  }}
                  className="w-full py-3 bg-white text-blue-700 hover:bg-blue-50 font-bold rounded-xl shadow-md transition-colors cursor-pointer"
                >
                  {canTransfer ? "โอนเงินเรียบร้อย" : "ดำเนินการอนุมัติ"}
                </button>
              </div>
            )}

            {/* Timeline */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-slate-900">สถานะการเบิกเงิน</h3>
                <button onClick={fetchDetail} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer" title="รีเฟรช">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                </button>
              </div>

              <div className="relative pl-4 border-l-2 border-slate-100 space-y-8">
                {/* Always show Created */}
                <div className="relative">
                  <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-slate-300 ring-4 ring-white" />
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wide">CREATED</div>
                  <div className="text-sm font-medium text-slate-900 mt-1">สร้างรายการเบิกเงิน</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {new Date(record.created_at).toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>

                {/* Map History */}
                {history.map((entry, idx) => (
                  <div key={idx} className="relative">
                    <div className={`absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full ring-4 ring-white ${
                      entry.status === "rejected" ? "bg-rose-500" :
                      entry.status === "transfer" ? "bg-blue-900" : "bg-zinc-500"
                    }`} />
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wide">{entry.status}</div>
                    <div className="text-sm font-medium text-slate-900 mt-1">
                      {entry.status === "head_approve" && "หัวหน้าฝ่ายอนุมัติแล้ว"}
                      {entry.status === "fin_approve" && "ฝ่ายการเงินอนุมัติแล้ว"}
                      {entry.status === "transfer" && "โอนเงินเรียบร้อยแล้ว"}
                      {entry.status === "rejected" && "ถูกปฏิเสธ / ส่งกลับไปแก้ไข"}
                      {entry.status === "waiting" && "รอการอนุมัติ"}
                    </div>
                    {entry.staff?.nickname && (
                      <div className="text-xs text-slate-600 mt-1">
                        โดย {entry.staff.nickname}
                      </div>
                    )}
                    {entry.created_at && (
                      <div className="text-xs text-slate-400 mt-0.5">
                        {new Date(entry.created_at).toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

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
