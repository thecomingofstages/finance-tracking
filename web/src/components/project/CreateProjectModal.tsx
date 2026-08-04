"use client";

import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { createProjectApi } from "@/lib/api/projects";

export interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function CreateProjectModal({
  isOpen,
  onClose,
  onSuccess,
}: CreateProjectModalProps) {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [allocatedBudget, setAllocatedBudget] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const isAuthorized = user?.role === "admin" || user?.role === "owner";

  const handleReset = () => {
    setName("");
    setCode("");
    setDescription("");
    setAllocatedBudget("");
    setError(null);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isAuthorized) {
      setError("คุณไม่มีสิทธิ์ในการสร้างโครงการใหม่ (เฉพาะบทบาท Owner หรือ Admin เท่านั้น)");
      return;
    }

    if (!name.trim()) {
      setError("กรุณากรอกชื่อโปรเจกต์");
      return;
    }

    const budgetNum = Number(allocatedBudget);
    if (isNaN(budgetNum) || budgetNum <= 0) {
      setError("กรุณากรอกงบประมาณจัดสรรให้ถูกต้อง (มากกว่า 0)");
      return;
    }

    setIsLoading(true);
    try {
      const res = await createProjectApi({
        name: name.trim(),
        code: code.trim() || undefined,
        description: description.trim() || undefined,
        allocated_budget: budgetNum,
      });

      if (res.error || (res.response && !res.response.ok)) {
        const errObj = res.error as any;
        const msg =
          errObj?.error?.message ||
          errObj?.message ||
          "ไม่สามารถสร้างโครงการได้ กรุณาลองใหม่อีกครั้ง";
        setError(msg);
      } else {
        handleReset();
        if (onSuccess) {
          onSuccess();
        }
        onClose();
      }
    } catch (err: any) {
      setError(err?.message || "เกิดข้อผิดพลาดในการเชื่อมต่อระบบ");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border border-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <h2 className="text-lg font-semibold text-slate-800">
            สร้างโครงการใหม่
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-lg hover:bg-slate-100"
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Permission Error Banner */}
          {!isAuthorized && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium">
              คุณไม่มีสิทธิ์ในการสร้างโครงการใหม่ (เฉพาะบทบาท Owner หรือ Admin เท่านั้น)
            </div>
          )}

          {/* Form Error Message */}
          {error && isAuthorized && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium">
              {error}
            </div>
          )}

          {/* Project Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              ชื่อโปรเจกต์ <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              disabled={!isAuthorized || isLoading}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ระบุชื่อโครงการ"
              className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 disabled:opacity-50 transition-all"
            />
          </div>

          {/* Project Code */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              รหัสโปรเจกต์ <span className="text-slate-400 font-normal">(ไม่บังคับ)</span>
            </label>
            <input
              type="text"
              disabled={!isAuthorized || isLoading}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="เช่น PRJ-2026-004"
              className="w-full px-3.5 py-2 text-sm font-mono bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 disabled:opacity-50 transition-all"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              คำอธิบายโครงการ <span className="text-slate-400 font-normal">(ไม่บังคับ)</span>
            </label>
            <textarea
              rows={3}
              disabled={!isAuthorized || isLoading}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="รายละเอียดสั้น ๆ เกี่ยวกับโครงการนี้"
              className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 disabled:opacity-50 transition-all resize-none"
            />
          </div>

          {/* Allocated Budget */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              งบประมาณจัดสรร (บาท THB) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min="0"
              step="any"
              required
              disabled={!isAuthorized || isLoading}
              value={allocatedBudget}
              onChange={(e) => setAllocatedBudget(e.target.value)}
              placeholder="0.00"
              className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 disabled:opacity-50 transition-all"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={handleClose}
              disabled={isLoading}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-50"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={!isAuthorized || isLoading}
              className="px-5 py-2 text-xs font-semibold text-white bg-blue-900 hover:bg-blue-800 active:bg-blue-950 rounded-xl transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              {isLoading ? (
                <>
                  <svg
                    className="w-3.5 h-3.5 animate-spin"
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
                  <span>กำลังบันทึก...</span>
                </>
              ) : (
                <span>สร้างโครงการ</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
