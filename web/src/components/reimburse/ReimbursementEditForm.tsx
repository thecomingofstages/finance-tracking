"use client";

import React, { useState, ChangeEvent } from "react";

export interface EditDetailItem {
  id?: string;
  title: string;
  amount: number;
}

export interface ReimbursementEditFormProps {
  initialPurpose: string;
  initialDetails: any[];
  onSave: (data: { purpose: string; details: EditDetailItem[]; receiptFile: File | null }) => Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export const ReimbursementEditForm: React.FC<ReimbursementEditFormProps> = ({
  initialPurpose,
  initialDetails,
  onSave,
  onCancel,
  isSubmitting = false,
}) => {
  const [purpose, setPurpose] = useState(initialPurpose || "");
  const [details, setDetails] = useState<EditDetailItem[]>(
    initialDetails?.length > 0
      ? initialDetails.map((d) => ({ id: d._id || d.id, title: d.title, amount: d.amount }))
      : [{ title: "", amount: 0 }]
  );
  const [receiptFile, setReceiptFile] = useState<File | null>(null);

  const handleAddDetail = () => {
    setDetails([...details, { title: "", amount: 0 }]);
  };

  const handleRemoveDetail = (index: number) => {
    if (details.length > 1) {
      setDetails(details.filter((_, i) => i !== index));
    }
  };

  const handleDetailChange = (index: number, field: "title" | "amount", value: any) => {
    const newDetails = [...details];
    newDetails[index] = { ...newDetails[index], [field]: value };
    setDetails(newDetails);
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setReceiptFile(e.target.files[0]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ purpose, details, receiptFile });
  };

  const totalAmount = details.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);

  return (
    <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative">
      <div className="absolute top-0 left-0 w-full h-1.5 bg-zinc-500 rounded-t-2xl" />
      
      <div>
        <h3 className="text-lg font-bold text-slate-900">แก้ไขข้อมูลการเบิกเงิน</h3>
        <p className="text-sm text-slate-500 mt-1">
          คุณสามารถแก้ไขวัตถุประสงค์ รายการเบิกเงิน และแนบไฟล์เอกสารใหม่ได้
        </p>
      </div>

      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-1.5">
          วัตถุประสงค์ <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          required
          value={purpose}
          onChange={(e) => setPurpose(e.target.value)}
          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-zinc-900 focus:bg-white transition-all outline-none"
          placeholder="ระบุวัตถุประสงค์การใช้งาน..."
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-semibold text-slate-700">
            รายการเบิกเงิน <span className="text-red-500">*</span>
          </label>
          <button
            type="button"
            onClick={handleAddDetail}
            className="text-xs font-semibold text-slate-800 hover:text-blue-700"
          >
            + เพิ่มรายการ
          </button>
        </div>
        <div className="space-y-3">
          {details.map((item, idx) => (
            <div key={idx} className="flex items-start gap-3">
              <div className="flex-1">
                <input
                  type="text"
                  required
                  value={item.title}
                  onChange={(e) => handleDetailChange(idx, "title", e.target.value)}
                  placeholder="ชื่อรายการ"
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-zinc-900 focus:bg-white outline-none"
                />
              </div>
              <div className="w-1/3 relative">
                <span className="absolute left-3 top-2.5 text-slate-400 text-sm">฿</span>
                <input
                  type="number"
                  min="1"
                  required
                  value={item.amount || ""}
                  onChange={(e) => handleDetailChange(idx, "amount", parseFloat(e.target.value))}
                  placeholder="จำนวนเงิน"
                  className="w-full pl-8 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-zinc-900 focus:bg-white outline-none"
                />
              </div>
              {details.length > 1 && (
                <button
                  type="button"
                  onClick={() => handleRemoveDetail(idx)}
                  className="mt-1 p-1.5 text-slate-400 hover:text-rose-500 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="mt-3 text-right">
          <span className="text-sm text-slate-500">ยอดรวม: </span>
          <span className="text-base font-bold text-slate-900">
            ฿{totalAmount.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-1.5">
          แนบเอกสารประกอบใหม่ (ตัวเลือก)
        </label>
        <p className="text-xs text-slate-500 mb-2">หากไม่ต้องการเปลี่ยนเอกสาร ให้เว้นว่างไว้</p>
        <input
          type="file"
          accept="image/png,image/jpeg,application/pdf"
          onChange={handleFileChange}
          className="block w-full text-sm text-slate-500
            file:mr-4 file:py-2 file:px-4
            file:rounded-full file:border-0
            file:text-sm file:font-semibold
            file:bg-zinc-50 file:text-blue-700
            hover:file:bg-blue-50 transition-colors"
        />
      </div>

      <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
        >
          ยกเลิก
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center space-x-2 px-5 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-md transition-colors disabled:opacity-50"
        >
          {isSubmitting ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
              <span>กำลังบันทึก...</span>
            </>
          ) : (
            <span>บันทึกการแก้ไข</span>
          )}
        </button>
      </div>
    </form>
  );
};

export default ReimbursementEditForm;
