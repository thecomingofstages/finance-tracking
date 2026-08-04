"use client";

import React, { useState, useEffect, useRef, ChangeEvent, DragEvent } from "react";
import { useAuth } from "@/context/AuthContext";
import { getProjectsApi } from "@/lib/api/projects";
import { createReimbursementApi, uploadReceiptApi } from "@/lib/api/reimbursements";

export interface ReimbursementFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface ProjectOption {
  _id?: string;
  id?: string;
  name?: string;
  code?: string;
  department_id?: string;
}

export const ReimbursementFormModal: React.FC<ReimbursementFormModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { user } = useAuth();
  const [projectId, setProjectId] = useState<string>("");
  const [title, setTitle] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    async function loadProjects() {
      try {
        const res = await getProjectsApi();
        if (!isMounted) return;
        if (res.data) {
          const pData: any = res.data;
          const list = Array.isArray(pData.data)
            ? pData.data
            : Array.isArray(pData)
            ? pData
            : [];
          setProjects(list);
          if (list.length > 0 && !projectId) {
            setProjectId(list[0]._id || list[0].id || "");
          }
        }
      } catch (err) {
        console.error("Failed to load projects:", err);
      }
    }

    loadProjects();

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  const handleFileChange = (file: File | null) => {
    if (!file) {
      setReceiptFile(null);
      if (filePreviewUrl) {
        URL.revokeObjectURL(filePreviewUrl);
        setFilePreviewUrl(null);
      }
      return;
    }

    // Validate file type
    const validTypes = ["image/png", "image/jpeg", "image/jpg", "application/pdf"];
    if (!validTypes.includes(file.type) && !file.name.match(/\.(png|jpe?g|pdf)$/i)) {
      setError("รองรับเฉพาะไฟล์ PNG, JPEG และ PDF เท่านั้น");
      return;
    }

    setError(null);
    setReceiptFile(file);

    if (filePreviewUrl) {
      URL.revokeObjectURL(filePreviewUrl);
    }

    if (file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      setFilePreviewUrl(url);
    } else {
      setFilePreviewUrl(null);
    }
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

  const removeFile = () => {
    setReceiptFile(null);
    if (filePreviewUrl) {
      URL.revokeObjectURL(filePreviewUrl);
      setFilePreviewUrl(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const resetForm = () => {
    setProjectId(projects.length > 0 ? projects[0]._id || projects[0].id || "" : "");
    setTitle("");
    setAmount("");
    setNote("");
    removeFile();
    setError(null);
  };

  const handleModalClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!projectId) {
      setError("กรุณาเลือกโครงการ");
      return;
    }
    if (!title.trim()) {
      setError("กรุณาระบุรายการเบิกเงิน");
      return;
    }
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError("กรุณาระบุจำนวนเงินที่ถูกต้อง (มากกว่า 0)");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const selectedProject = projects.find(
        (p) => (p._id || p.id) === projectId
      );
      const department_id =
        selectedProject?.department_id ||
        (user?.scope?.memberships?.[0]?.department_id) ||
        "00000000-0000-0000-0000-000000000000";

      const createRes = await createReimbursementApi({
        department_id,
        purpose: title.trim(),
        details: [{ title: title.trim(), amount: numAmount }],
      });

      if (createRes.error) {
        const errMessage =
          (createRes.error as any)?.message ||
          "เกิดข้อผิดพลาดในการสร้างรายการเบิกเงิน";
        setError(errMessage);
        setIsLoading(false);
        return;
      }

      const resData = createRes.data as any;
      const createdId =
        resData?._id ||
        resData?.id ||
        resData?.data?._id ||
        resData?.data?.id;

      if (receiptFile && createdId) {
        try {
          await uploadReceiptApi(createdId, receiptFile);
        } catch (uploadErr) {
          console.error("Receipt upload failed:", uploadErr);
        }
      }

      resetForm();
      if (onSuccess) {
        onSuccess();
      }
      onClose();
    } catch (err: any) {
      setError(err.message || "เกิดข้อผิดพลาดในการเชื่อมต่อระบบ");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm transition-opacity animate-in fade-in duration-200">
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-lg overflow-hidden transition-all transform scale-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div>
            <h3 className="text-lg font-semibold text-slate-800">
              สร้างรายการขอเบิกเงิน
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              กรอกข้อมูลเพื่อยื่นคำขออนุมัติเบิกเงินทดรองจ่าย
            </p>
          </div>
          <button
            type="button"
            onClick={handleModalClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 text-sm text-rose-600 bg-rose-50 border border-slate-200 rounded-lg flex items-center gap-2">
              <svg className="w-4 h-4 shrink-0 fill-current" viewBox="0 0 20 20">
                <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {/* Project */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              โครงการ / Project <span className="text-rose-500">*</span>
            </label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-900 focus:border-transparent transition-all"
              required
            >
              <option value="" disabled>
                -- เลือกโครงการ --
              </option>
              {projects.map((p) => {
                const id = p._id || p.id || "";
                return (
                  <option key={id} value={id}>
                    {p.name || p.code || id}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              รายการ / หัวข้อเรื่อง <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="ระบุรายการ เช่น ค่าอุปกรณ์สำนักงาน, ค่าเดินทาง"
              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-900 focus:border-transparent transition-all"
              required
            />
          </div>

          {/* Amount */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              จำนวนเงิน (บาท) <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full pl-3.5 pr-12 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-900 focus:border-transparent transition-all"
                required
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400 pointer-events-none">
                THB
              </span>
            </div>
          </div>

          {/* Note */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              หมายเหตุ /รายละเอียดเพิ่มเติม
            </label>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="ระบุรายละเอียดเพิ่มเติม (ถ้ามี)"
              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-900 focus:border-transparent transition-all resize-none"
            />
          </div>

          {/* Receipt File Upload */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              แนบใบเสร็จ / หลักฐาน (PNG, JPEG, PDF)
            </label>
            <input
              type="file"
              ref={fileInputRef}
              accept="image/png,image/jpeg,image/jpg,application/pdf"
              className="hidden"
              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                if (e.target.files && e.target.files.length > 0) {
                  handleFileChange(e.target.files[0]);
                }
              }}
            />

            {!receiptFile ? (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-colors ${
                  isDragging
                    ? "border-blue-900 bg-zinc-50/50"
                    : "border-slate-300 hover:border-blue-800 bg-slate-50/30"
                }`}
              >
                <svg
                  className="w-8 h-8 mx-auto text-slate-400 mb-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
                <p className="text-xs font-medium text-slate-700">
                  ลากไฟล์มาวางที่นี่ หรือ{" "}
                  <span className="text-blue-900 underline font-semibold">
                    คลิกเพื่อเลือกไฟล์
                  </span>
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  รองรับไฟล์ PNG, JPEG หรือ PDF
                </p>
              </div>
            ) : (
              <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="flex items-center space-x-3 overflow-hidden">
                  {filePreviewUrl ? (
                    <img
                      src={filePreviewUrl}
                      alt="Receipt preview"
                      className="w-12 h-12 object-cover rounded-lg border border-slate-200 shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-blue-50 text-slate-800 flex items-center justify-center font-bold text-xs shrink-0">
                      PDF
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-800 truncate">
                      {receiptFile.name}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      {(receiptFile.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={removeFile}
                  className="px-2.5 py-1 text-xs text-rose-600 hover:bg-blue-50 border border-slate-200 rounded-lg transition-colors shrink-0 ml-2"
                >
                  ลบไฟล์
                </button>
              </div>
            )}
          </div>

          {/* Footer actions */}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={handleModalClose}
              disabled={isLoading}
              className="px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-50"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-5 py-2.5 text-sm font-medium text-white bg-blue-900 hover:bg-blue-800 rounded-xl transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-900 focus:ring-offset-2 disabled:opacity-50 flex items-center space-x-2"
            >
              {isLoading ? (
                <>
                  <svg
                    className="w-4 h-4 animate-spin text-white"
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
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  <span>กำลังส่งข้อมูล...</span>
                </>
              ) : (
                <span>ส่งคำขอเบิกเงิน</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ReimbursementFormModal;
