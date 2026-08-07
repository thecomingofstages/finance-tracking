"use client";

import React, { useState, useEffect, useRef, ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { AppShell } from "@/components/layout";
import { CreateReimbursementConfirmModal, CreateReimbursementData } from "@/components/reimburse";
import { getProjectsApi, getProjectDepartmentsApi, getProjectTagsApi } from "@/lib/api/projects";
import { getBankAccountsApi } from "@/lib/api/staff";

interface DetailItem {
  id: string;
  title: string;
  amount: string;
}

export default function NewReimbursementPage() {
  const router = useRouter();
  const { user, isLoading: isUserLoading } = useAuth();

  const [projects, setProjects] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [tags, setTags] = useState<any[]>([]);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);

  const [projectId, setProjectId] = useState<string>("");
  const [departmentId, setDepartmentId] = useState<string>("");
  const [tagId, setTagId] = useState<string>("");
  const [purpose, setPurpose] = useState<string>("");

  const [details, setDetails] = useState<DetailItem[]>([{ id: "1", title: "", amount: "" }]);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);

  const [bankingMode, setBankingMode] = useState<"existing" | "new" | "cash">("existing");
  const [bankingId, setBankingId] = useState<string>("");
  
  const [newBankName, setNewBankName] = useState<string>("");
  const [newBankNumber, setNewBankNumber] = useState<string>("");
  const [newBankProvider, setNewBankProvider] = useState<string>("");

  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [confirmData, setConfirmData] = useState<CreateReimbursementData | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auth Guard
  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push("/auth/login?returnUrl=/reimburse/new");
    }
  }, [user, isUserLoading, router]);

  // Fetch initial data
  useEffect(() => {
    if (!user) return;
    const fetchInitial = async () => {
      try {
        const [projRes, bankRes] = await Promise.all([
          getProjectsApi(),
          getBankAccountsApi(),
        ]);
        
        const projData = Array.isArray(projRes.data) ? projRes.data : (projRes.data as any)?.items || [];
        setProjects(projData);

        const bankData = Array.isArray(bankRes.data) ? bankRes.data : (bankRes.data as any)?.items || [];
        setBankAccounts(bankData);
        if (bankData.length > 0) {
          setBankingId(bankData[0].id || bankData[0]._id);
        } else {
          setBankingMode("new");
        }
      } catch (err) {
        console.error("Failed to fetch initial data", err);
      }
    };
    fetchInitial();
  }, [user]);

  // Fetch departments & tags when project changes
  useEffect(() => {
    if (!projectId) {
      setDepartments([]);
      setTags([]);
      setDepartmentId("");
      setTagId("");
      return;
    }
    const fetchProjData = async () => {
      try {
        const [deptRes, tagRes] = await Promise.all([
          getProjectDepartmentsApi(projectId),
          getProjectTagsApi(projectId)
        ]);
        const deptData = Array.isArray(deptRes.data) ? deptRes.data : (deptRes.data as any)?.items || [];
        setDepartments(deptData);
        if (deptData.length > 0) setDepartmentId(deptData[0].id || deptData[0]._id);

        const tagData = Array.isArray(tagRes.data) ? tagRes.data : (tagRes.data as any)?.items || [];
        setTags(tagData);
      } catch (err) {
        console.error("Failed to fetch project children", err);
      }
    };
    fetchProjData();
  }, [projectId]);

  const totalAmount = details.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

  const handleAddDetail = () => {
    setDetails([...details, { id: Date.now().toString(), title: "", amount: "" }]);
  };

  const handleRemoveDetail = (id: string) => {
    if (details.length <= 1) return;
    setDetails(details.filter((d) => d.id !== id));
  };

  const handleDetailChange = (id: string, field: "title" | "amount", value: string) => {
    setDetails(
      details.map((d) => {
        if (d.id === id) {
          return { ...d, [field]: value };
        }
        return d;
      })
    );
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (!file.type.match(/^(image\/(jpeg|png|webp)|application\/pdf)$/)) {
        alert("รองรับเฉพาะไฟล์รูปภาพ (JPG, PNG) หรือ PDF เท่านั้น");
        return;
      }
      if (file.size > 25 * 1024 * 1024) {
        alert("ขนาดไฟล์ต้องไม่เกิน 25 MB");
        return;
      }
      setReceiptFile(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!departmentId) {
      alert("กรุณาเลือกฝ่าย/แผนก");
      return;
    }
    if (!purpose.trim()) {
      alert("กรุณากรอกวัตถุประสงค์");
      return;
    }
    if (details.some(d => !d.title.trim() || !d.amount || Number(d.amount) <= 0)) {
      alert("กรุณากรอกรายการและจำนวนเงินให้ถูกต้อง");
      return;
    }
    if (!receiptFile) {
      alert("กรุณาแนบไฟล์ใบเสร็จหรือใบกำกับภาษี");
      return;
    }

    if (bankingMode === "existing" && !bankingId) {
      alert("กรุณาเลือกบัญชีรับเงิน หรือเพิ่มบัญชีใหม่");
      return;
    }

    if (bankingMode === "new") {
      if (!newBankName.trim() || !newBankNumber.trim() || !newBankProvider.trim()) {
        alert("กรุณากรอกข้อมูลบัญชีใหม่ให้ครบถ้วน");
        return;
      }
    }

    const payload: CreateReimbursementData = {
      department_id: departmentId,
      tag_id: tagId || null,
      purpose,
      details: details.map(d => ({ title: d.title, amount: Number(d.amount) })),
      receipt_file: receiptFile,
      banking_mode: bankingMode,
    };

    if (bankingMode === "existing") {
      payload.banking_id = bankingId;
    } else if (bankingMode === "new") {
      payload.new_bank_account = {
        name: newBankName,
        number: newBankNumber,
        provider: newBankProvider,
      };
    }

    setConfirmData(payload);
    setIsConfirmModalOpen(true);
  };

  if (isUserLoading || !user) {
    return (
      <AppShell>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-900"></div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto space-y-6 pb-20">
        <div className="flex items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <button
            onClick={() => router.back()}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-500 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">สร้างใบเบิกเงิน</h1>
            <p className="text-slate-500 text-sm mt-1">กรอกรายละเอียดเพื่อขอเบิกเงินคืน</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section 1: Department & Purpose */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <h2 className="font-semibold text-slate-800">1. ข้อมูลส่วนงานและวัตถุประสงค์</h2>
            </div>
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">โครงการ (Project) <span className="text-red-500">*</span></label>
                  <select
                    required
                    value={projectId}
                    onChange={(e) => setProjectId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 transition-all"
                  >
                    <option value="" disabled>-- เลือกโครงการ --</option>
                    {projects.map((p) => (
                      <option key={p.id || p._id} value={p.id || p._id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">ส่วนงาน/ฝ่าย (Department) <span className="text-red-500">*</span></label>
                  <select
                    required
                    disabled={!projectId}
                    value={departmentId}
                    onChange={(e) => setDepartmentId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 transition-all disabled:opacity-50"
                  >
                    <option value="" disabled>-- เลือกฝ่าย --</option>
                    {departments.map((d) => (
                      <option key={d.id || d._id} value={d.id || d._id}>{d.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">แท็ก (Tag)</label>
                  <select
                    disabled={!projectId || tags.length === 0}
                    value={tagId}
                    onChange={(e) => setTagId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 transition-all disabled:opacity-50"
                  >
                    <option value="">-- ไม่ระบุแท็ก --</option>
                    {tags.map((t) => (
                      <option key={t.id || t._id} value={t.id || t._id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">วัตถุประสงค์การเบิกเงิน <span className="text-red-500">*</span></label>
                <input
                  required
                  type="text"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  placeholder="เช่น ค่าจัดทำเสื้อทีม, ค่าเช่าอุปกรณ์"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 transition-all"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Items */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <h2 className="font-semibold text-slate-800">2. รายการเบิกเงิน</h2>
              <span className="text-xs text-slate-500">กรอกไม่เกิน 9 รายการเพื่อพิมพ์ลง 1 หน้ากระดาษพอดี</span>
            </div>
            <div className="p-6 space-y-4">
              {details.map((item, index) => (
                <div key={item.id} className="flex flex-col sm:flex-row gap-3 items-start">
                  <div className="flex-1 w-full space-y-1.5">
                    {index === 0 && <label className="text-xs font-medium text-slate-500">ชื่อรายการ</label>}
                    <input
                      required
                      type="text"
                      value={item.title}
                      onChange={(e) => handleDetailChange(item.id, "title", e.target.value)}
                      placeholder="ระบุรายการ..."
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 transition-all"
                    />
                  </div>
                  <div className="w-full sm:w-48 space-y-1.5">
                    {index === 0 && <label className="text-xs font-medium text-slate-500">จำนวนเงิน (บาท)</label>}
                    <input
                      required
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={item.amount}
                      onChange={(e) => handleDetailChange(item.id, "amount", e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 transition-all"
                    />
                  </div>
                  {details.length > 1 && (
                    <div className={`${index === 0 ? 'mt-6' : ''}`}>
                      <button
                        type="button"
                        onClick={() => handleRemoveDetail(item.id)}
                        className="w-10 h-10 flex items-center justify-center text-red-500 hover:bg-red-50 rounded-xl transition-colors shrink-0"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  )}
                </div>
              ))}

              <div className="pt-2 flex justify-between items-center border-t border-slate-100 mt-4">
                <button
                  type="button"
                  onClick={handleAddDetail}
                  className="text-slate-800 font-medium text-sm px-4 py-2 hover:bg-blue-50 rounded-xl transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  เพิ่มรายการ
                </button>
                <div className="text-right">
                  <span className="text-sm text-slate-500 mr-3">ยอดรวม:</span>
                  <span className="text-xl font-bold text-slate-900">
                    ฿{totalAmount.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Receipt */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <h2 className="font-semibold text-slate-800">3. ใบเสร็จรับเงิน / ใบกำกับภาษี</h2>
              <span className="text-xs text-slate-500">จำกัด 1 ไฟล์ (Max 25MB)</span>
            </div>
            <div className="p-6">
              {!receiptFile ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:bg-slate-50 hover:border-slate-400 transition-colors cursor-pointer"
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                  />
                  <div className="mx-auto w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 mb-3">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                  </div>
                  <p className="text-sm font-medium text-slate-700">คลิกเพื่ออัปโหลดไฟล์</p>
                  <p className="text-xs text-slate-500 mt-1">รองรับ PDF, JPG, PNG</p>
                </div>
              ) : (
                <div className="flex items-center justify-between p-4 border border-blue-100 bg-zinc-50/50 rounded-xl">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="w-10 h-10 shrink-0 bg-white rounded-lg border border-slate-200 flex items-center justify-center text-slate-800">
                      {receiptFile.type === "application/pdf" ? (
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                      ) : (
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      )}
                    </div>
                    <div className="truncate">
                      <p className="text-sm font-medium text-slate-800 truncate">{receiptFile.name}</p>
                      <p className="text-xs text-slate-500">{(receiptFile.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setReceiptFile(null)}
                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Section 4: Receiving Method */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <h2 className="font-semibold text-slate-800">4. วิธีรับเงินคืน</h2>
            </div>
            <div className="p-6 space-y-4">
              
              {/* Existing Bank Accounts */}
              {bankAccounts.length > 0 && (
                <label className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${bankingMode === 'existing' ? 'border-blue-500 bg-zinc-50/30 ring-1 ring-blue-500/20' : 'border-slate-200 hover:border-slate-300'}`}>
                  <input
                    type="radio"
                    name="banking_mode"
                    className="mt-1 w-4 h-4 text-slate-800"
                    checked={bankingMode === 'existing'}
                    onChange={() => setBankingMode('existing')}
                  />
                  <div className="flex-1 w-full space-y-3">
                    <span className="font-medium text-slate-800 text-sm">โอนเข้าบัญชีเดิมที่มีอยู่</span>
                    {bankingMode === 'existing' && (
                      <select
                        value={bankingId}
                        onChange={(e) => setBankingId(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 transition-all"
                      >
                        {bankAccounts.map((b) => (
                          <option key={b.id || b._id} value={b.id || b._id}>
                            {b.provider} - {b.number} ({b.name})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </label>
              )}

              {/* Cash */}
              <label className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${bankingMode === 'cash' ? 'border-blue-500 bg-zinc-50/30 ring-1 ring-blue-500/20' : 'border-slate-200 hover:border-slate-300'}`}>
                <input
                  type="radio"
                  name="banking_mode"
                  className="mt-1 w-4 h-4 text-slate-800"
                  checked={bankingMode === 'cash'}
                  onChange={() => setBankingMode('cash')}
                />
                <div className="flex-1">
                  <span className="font-medium text-slate-800 text-sm">รับเป็นเงินสด (Cash)</span>
                </div>
              </label>

              {/* New Bank Account */}
              <label className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${bankingMode === 'new' ? 'border-blue-500 bg-zinc-50/30 ring-1 ring-blue-500/20' : 'border-slate-200 hover:border-slate-300'}`}>
                <input
                  type="radio"
                  name="banking_mode"
                  className="mt-1 w-4 h-4 text-slate-800"
                  checked={bankingMode === 'new'}
                  onChange={() => setBankingMode('new')}
                />
                <div className="flex-1 space-y-3">
                  <span className="font-medium text-slate-800 text-sm">เพิ่มบัญชีธนาคารใหม่</span>
                  {bankingMode === 'new' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                      <div className="space-y-1.5 md:col-span-2">
                        <label className="text-xs font-medium text-slate-500">ชื่อธนาคาร (เช่น กสิกรไทย, กรุงศรีฯ)</label>
                        <input
                          required={bankingMode === 'new'}
                          type="text"
                          value={newBankProvider}
                          onChange={(e) => setNewBankProvider(e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 transition-all"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-500">เลขที่บัญชี</label>
                        <input
                          required={bankingMode === 'new'}
                          type="text"
                          value={newBankNumber}
                          onChange={(e) => setNewBankNumber(e.target.value.replace(/[^0-9]/g, ""))}
                          className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 transition-all"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-500">ชื่อบัญชี</label>
                        <input
                          required={bankingMode === 'new'}
                          type="text"
                          value={newBankName}
                          onChange={(e) => setNewBankName(e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 transition-all"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </label>

            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 text-slate-800 text-sm p-4 rounded-xl flex items-start gap-3">
            <svg className="w-5 h-5 shrink-0 text-slate-800 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <p>กรุณาตรวจสอบความถูกต้องของข้อมูลทั้งหมด (วัตถุประสงค์, รายการ, และรูปถ่ายใบเสร็จ) ก่อนกดส่งคำขอเบิกเงิน</p>
          </div>

          <div className="flex gap-4 pt-4">
            <button
              type="submit"
              className="w-full bg-blue-900 text-white rounded-xl py-3.5 font-medium shadow-sm shadow-blue-900/20 hover:bg-blue-800 transition-colors"
            >
              ส่งคำขอเบิกเงิน
            </button>
          </div>

        </form>
      </div>

      <CreateReimbursementConfirmModal 
        isOpen={isConfirmModalOpen}
        data={confirmData}
        onClose={() => setIsConfirmModalOpen(false)}
        onSuccess={(id) => {
          setIsConfirmModalOpen(false);
          router.push(`/reimburse/${id}`);
        }}
      />
    </AppShell>
  );
}
