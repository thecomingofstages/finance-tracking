"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { AppShell } from "@/components/layout";
import { StatusBadge } from "@/components/reimburse";
import BatchPaymentConfirmModal from "@/components/checkslip/BatchPaymentConfirmModal";
import { getPaymentsApi } from "@/lib/api/payments";

const FALLBACK_PAYMENTS = [
  {
    id: "pay-001",
    _id: "pay-001",
    payment_id: "pay-001",
    tracking_id: "PAY-2026-001",
    title: "ค่าลงทะเบียนเข้าร่วมอบรมเชิงปฏิบัติการ (โครงการ A)",
    payer: "นายวิชัย สุขสำราญ",
    channel: "PromptPay QR โครงการ",
    expected_amount: 2500.0,
    amount: 2500.0,
    status: "waiting",
    created_at: "2026-01-15T10:30:00Z",
    promptpay_qr_data: "00020101021229370016A0000006770101110313084000000000053037645402500.005802TH6304",
  },
  {
    id: "pay-002",
    _id: "pay-002",
    payment_id: "pay-002",
    tracking_id: "PAY-2026-002",
    title: "ค่าซื้อสินค้าและของที่ระลึกหน้างาน",
    payer: "นางสาวอนงค์ รุ่งเรือง",
    channel: "โอนผ่านธนาคารกสิกรไทย",
    expected_amount: 1800.0,
    amount: 1800.0,
    status: "waiting",
    created_at: "2026-01-16T14:15:00Z",
    promptpay_qr_data: "00020101021229370016A0000006770101110313084000000000053037645401800.005802TH6304",
  },
];

type Decision = { status: "approved" | "rejected"; actual_amount?: number };

export default function CheckslipPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  // Permission Guard Requirement
  const userRole = user?.role?.toLowerCase();
  const isFinanceScope = Boolean(
    user?.scope?.finance_of && user.scope.finance_of.length > 0
  );
  const canAccess =
    userRole === "admin" ||
    userRole === "owner" ||
    userRole === "finance" ||
    isFinanceScope;

  useEffect(() => {
    if (!isLoading && !canAccess) {
      router.replace("/");
    }
  }, [isLoading, canAccess, router]);

  // Page State
  const [payments, setPayments] = useState<any[]>([]);
  const [isFetching, setIsFetching] = useState<boolean>(true);
  const [tab, setTab] = useState<"waiting" | "verified">("waiting");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Dictionary of decisions keyed by payment ID
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  
  const [isBatchModalOpen, setIsBatchModalOpen] = useState<boolean>(false);

  // Fetch payments
  const fetchPayments = useCallback(async () => {
    setIsFetching(true);
    try {
      // Typically, we would pass status filtering to the backend.
      // Since it's a mock, we fetch all and filter in UI.
      const res = await getPaymentsApi({ limit: 100 });
      const responseData: any = res?.data;
      
      let list: any[] = [];
      if (responseData && Array.isArray(responseData.data) && responseData.data.length > 0) {
        list = responseData.data;
      } else if (responseData && Array.isArray(responseData) && responseData.length > 0) {
        list = responseData;
      }

      if (list.length === 0) {
        list = FALLBACK_PAYMENTS;
      }
      setPayments(list);
    } catch {
      setPayments(FALLBACK_PAYMENTS);
    } finally {
      setIsFetching(false);
    }
  }, []);

  useEffect(() => {
    if (canAccess) {
      fetchPayments();
    }
  }, [canAccess, fetchPayments]);

  // Filter payments by active tab
  const displayedPayments = useMemo(() => {
    return payments.filter((p) => {
      const isWaiting = !p.status || p.status === "waiting";
      if (tab === "waiting") return isWaiting;
      if (tab === "verified") return !isWaiting;
      return true;
    });
  }, [payments, tab]);

  // Handle Mark Decision
  const handleMark = (id: string, decisionStatus: "approved" | "rejected", amount: number) => {
    setDecisions((prev) => ({
      ...prev,
      [id]: { status: decisionStatus, actual_amount: amount },
    }));
    // Auto-collapse and move to next? Not necessarily, user can do it manually.
    setExpandedId(null);
  };

  const undoMark = (id: string) => {
    setDecisions((prev) => {
      const newMap = { ...prev };
      delete newMap[id];
      return newMap;
    });
  };

  // Convert dictionary to array for submission with tracking_id and title
  const decisionArray = useMemo(() => {
    return Object.keys(decisions).map((id) => {
      const payment = payments.find((p) => (p.payment_id || p.id || p._id) === id);
      return {
        payment_id: id,
        tracking_id: payment?.tracking_id,
        title: payment?.title,
        ...decisions[id],
      };
    });
  }, [decisions, payments]);

  if (isLoading || !canAccess) {
    return null;
  }

  return (
    <AppShell>
      <div className="space-y-6 pb-24 relative">
        {/* Page Header (ERP SaaS style) */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-900 border border-blue-100">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              ตรวจสลิปและโอนเงิน
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              ตรวจสอบสลิปการโอนเงิน ยืนยันยอดเงิน และอนุมัติรายการแบบกลุ่ม
            </p>
          </div>
        </div>

        {/* Status Tabs */}
        <div className="flex items-center space-x-1 p-1.5 bg-slate-100 rounded-xl max-w-fit">
          <button
            type="button"
            onClick={() => setTab("waiting")}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all cursor-pointer ${
              tab === "waiting"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
            }`}
          >
            ยังไม่ได้ตรวจสลิป
          </button>
          <button
            type="button"
            onClick={() => setTab("verified")}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all cursor-pointer ${
              tab === "verified"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
            }`}
          >
            ตรวจสลิปแล้ว
          </button>
        </div>

        {/* Payments Accordion List */}
        <div className="space-y-3">
          {isFetching ? (
            <div className="p-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-200/80">
               <div className="inline-flex items-center gap-2">
                 <svg className="w-5 h-5 animate-spin text-blue-900" fill="none" viewBox="0 0 24 24">
                   <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                   <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                 </svg>
                 <span>กำลังโหลดข้อมูล...</span>
               </div>
            </div>
          ) : displayedPayments.length === 0 ? (
            <div className="p-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-200/80">
              ไม่มีสลิปในสถานะนี้
            </div>
          ) : (
            displayedPayments.map((item, idx) => {
              const rawId = item.payment_id || item._id || item.id || `fallback-${idx}`;
              const trackingId =
                item.tracking_id || (item._id ? `PAY-${String(item._id).substring(0, 8).toUpperCase()}` : "PAY-N/A");
              const title = item.title || item.purpose || "รายการรับเงิน";
              const payer = item.payer || item.customer_name || item.staff_name || "ไม่ระบุผู้โอน";
              const rawAmount = typeof item.amount === "number" ? item.amount : Number(item.expected_amount || 0);
              const formattedAmount = `฿${rawAmount.toLocaleString("th-TH", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}`;
              const createdDate = item.created_at || item.createdAt || item.date;
              const formattedDate = createdDate
                ? new Date(createdDate).toLocaleDateString("th-TH", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "-";

              // Check if currently marked locally
              const localDecision = decisions[rawId];
              const isMarked = !!localDecision;
              const isExpanded = expandedId === rawId;

              const promptpayQrData = item.promptpay_qr_data || item.qr_data || "";
              const qrImageUrl = promptpayQrData
                ? `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(promptpayQrData)}`
                : null;

              return (
                <div
                  key={rawId}
                  className={`bg-white rounded-2xl border transition-all ${
                    isMarked
                      ? localDecision.status === "approved"
                        ? "border-blue-500 shadow-sm ring-1 ring-blue-500/20"
                        : "border-slate-200 shadow-sm ring-1 ring-rose-500/20"
                      : isExpanded
                      ? "border-blue-500 shadow-md ring-1 ring-blue-500/20"
                      : "border-slate-200 hover:border-blue-300"
                  }`}
                >
                  {/* Collapsed Header / Toggle */}
                  <div
                    onClick={() => {
                       // Only allow expand if not marked and it's in waiting tab
                       if (tab === "waiting" && !isMarked) {
                         setExpandedId(isExpanded ? null : rawId);
                       }
                    }}
                    className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-4 ${
                      tab === "waiting" && !isMarked ? "cursor-pointer" : ""
                    }`}
                  >
                    <div className="flex items-center gap-4">
                       {tab === "waiting" && (
                         <div className={`w-6 h-6 shrink-0 rounded-full flex items-center justify-center border-2 transition-colors ${
                           isMarked 
                           ? localDecision.status === "approved" ? "border-blue-500 bg-blue-900" : "border-slate-200 bg-rose-500"
                           : "border-slate-300"
                         }`}>
                           {isMarked && (
                              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"/></svg>
                           )}
                         </div>
                       )}
                       <div>
                         <div className="flex items-center gap-2 mb-1">
                            <span className="font-mono text-sm font-semibold text-slate-500">{trackingId}</span>
                            <span className="text-xs text-slate-400">•</span>
                            <span className="text-xs text-slate-500">{formattedDate}</span>
                         </div>
                         <h3 className={`font-semibold ${isMarked && localDecision.status === "rejected" ? "text-slate-400 line-through" : "text-slate-900"}`}>{title}</h3>
                         <div className="text-sm text-slate-600 mt-0.5">{payer}</div>
                       </div>
                    </div>
                    
                    <div className="flex items-center justify-between sm:justify-end gap-6 sm:w-1/3 shrink-0">
                       <div className="text-right">
                          <div className={`text-lg font-bold ${isMarked && localDecision.status === "rejected" ? "text-slate-400 line-through" : "text-blue-900"}`}>{formattedAmount}</div>
                          {tab === "verified" && (
                            <div className="mt-1 flex justify-end">
                              <StatusBadge status={item.status} />
                            </div>
                          )}
                       </div>
                       
                       {/* Actions / Status indicator when collapsed */}
                       {tab === "waiting" && (
                         isMarked ? (
                           <div className="flex items-center gap-3">
                              <span className={`text-xs font-bold px-2.5 py-1 rounded-md ${
                                localDecision.status === "approved" ? "bg-blue-50 text-slate-800" : "bg-blue-50 text-slate-800"
                              }`}>
                                {localDecision.status === "approved" ? "อนุมัติ" : "ปฏิเสธ"}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); undoMark(rawId); }}
                                className="text-xs text-slate-500 hover:text-slate-800 underline cursor-pointer"
                              >
                                เลิกทำ
                              </button>
                           </div>
                         ) : (
                           <div className="text-slate-400 transition-transform duration-200" style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)" }}>
                             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"/></svg>
                           </div>
                         )
                       )}
                    </div>
                  </div>

                  {/* Expanded Content */}
                  {isExpanded && tab === "waiting" && !isMarked && (
                    <div className="border-t border-slate-100 bg-slate-50/50 p-6 flex flex-col md:flex-row gap-8">
                       {/* Info Section */}
                       <div className="flex-1 space-y-4">
                          <h4 className="text-sm font-bold text-slate-800 border-b border-slate-200 pb-2">รายละเอียดการโอนเงิน</h4>
                          
                          <div className="grid grid-cols-2 gap-y-4 gap-x-2 text-sm">
                             <div>
                               <div className="text-slate-500 text-xs mb-1">กิจกรรม / สินค้า</div>
                               <div className="font-medium text-slate-900">{title}</div>
                             </div>
                             <div>
                               <div className="text-slate-500 text-xs mb-1">ยอดชำระที่คาดหวัง</div>
                               <div className="font-bold text-slate-900">{formattedAmount}</div>
                             </div>
                             <div>
                               <div className="text-slate-500 text-xs mb-1">ชื่อผู้ทำรายการ</div>
                               <div className="font-medium text-slate-900">{payer}</div>
                             </div>
                             <div>
                               <div className="text-slate-500 text-xs mb-1">เบอร์โทรติดต่อ</div>
                               <div className="font-medium text-slate-900">{item.phone || "-"}</div>
                             </div>
                          </div>
                       </div>

                       {/* QR Section */}
                       <div className="w-full md:w-64 shrink-0 flex flex-col items-center justify-center p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
                          <div className="text-xs font-bold text-blue-900 mb-2">PromptPay QR Code</div>
                          {qrImageUrl ? (
                            <img src={qrImageUrl} alt="QR Code" className="w-40 h-40 object-contain rounded-lg" />
                          ) : (
                            <div className="w-40 h-40 bg-slate-100 flex items-center justify-center text-slate-400 text-xs rounded-lg">ไม่พบ QR Data</div>
                          )}
                          <div className="text-[10px] text-slate-500 mt-2 text-center">สแกนเพื่อตรวจสอบยอดเงินเข้าบัญชี</div>
                       </div>
                       
                       {/* Actions */}
                       <div className="w-full md:w-48 shrink-0 flex flex-col justify-center gap-3">
                          <button
                            type="button"
                            onClick={() => handleMark(rawId, "approved", rawAmount)}
                            className="w-full py-3 bg-blue-900 hover:bg-blue-800 text-white font-bold rounded-xl shadow-md transition-colors cursor-pointer"
                          >
                            อนุมัติยอด (Approve)
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMark(rawId, "rejected", rawAmount)}
                            className="w-full py-3 bg-white border-2 border-slate-200 text-slate-800 hover:bg-blue-50 hover:border-blue-300 font-bold rounded-xl transition-colors cursor-pointer"
                          >
                            ปฏิเสธ (Reject)
                          </button>
                       </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Floating Batch Action Bar */}
      {decisionArray.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 p-4 pointer-events-none">
           <div className="max-w-4xl mx-auto flex items-center justify-between p-4 bg-slate-900 text-white rounded-2xl shadow-2xl pointer-events-auto border border-slate-700 animate-slideUp">
              <div className="flex items-center gap-4">
                 <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center text-lg font-bold text-white">
                   {decisionArray.length}
                 </div>
                 <div>
                    <h3 className="font-bold text-lg">ยืนยันการตรวจสลิป</h3>
                    <p className="text-slate-400 text-xs">อนุมัติ {decisionArray.filter(d => d.status === "approved").length} รายการ, ปฏิเสธ {decisionArray.filter(d => d.status === "rejected").length} รายการ</p>
                 </div>
              </div>
              <button
                type="button"
                onClick={() => setIsBatchModalOpen(true)}
                className="px-6 py-3 bg-zinc-500 hover:bg-zinc-700 text-white font-bold rounded-xl shadow-lg transition-colors cursor-pointer"
              >
                 ดำเนินการต่อ
              </button>
           </div>
        </div>
      )}

      {/* Modals */}
      <BatchPaymentConfirmModal
        isOpen={isBatchModalOpen}
        decisions={decisionArray}
        onClose={() => setIsBatchModalOpen(false)}
        onSuccess={() => {
          setDecisions({});
          setExpandedId(null);
          fetchPayments();
          setTab("verified");
        }}
      />
    </AppShell>
  );
}
