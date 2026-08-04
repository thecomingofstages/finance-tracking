"use client";

import React, { useState } from "react";
import { createProjectTagsApi, updateTagApi, deleteTagApi } from "@/lib/api/projects";
import type { ProjectTag } from "./types";

interface TagSectionProps {
  projectId: string;
  tags: ProjectTag[];
  isPrivileged: boolean;
  onRefresh: () => void;
}

const formatTHB = (val: number) =>
  `฿${val.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const TagSection: React.FC<TagSectionProps> = ({ projectId, tags, isPrivileged, onRefresh }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<ProjectTag | null>(null);
  const [formName, setFormName] = useState("");
  const [formBudget, setFormBudget] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const openCreateModal = () => {
    setEditingTag(null);
    setFormName("");
    setFormBudget("");
    setError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (tag: any) => {
    setEditingTag(tag);
    setFormName(tag.name || "");
    setFormBudget(String(tag.allocated_budget || ""));
    setError(null);
    setIsModalOpen(true);
  };

  const handleDelete = async (tagId: string) => {
    if (!confirm("ต้องการลบ Tag นี้หรือไม่?")) return;
    setIsDeleting(tagId);
    try {
      await deleteTagApi(tagId);
      onRefresh();
    } catch (err: any) {
      alert(err?.message || "ลบไม่สำเร็จ");
    } finally {
      setIsDeleting(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) { setError("กรุณากรอกชื่อ Tag"); return; }
    setIsSubmitting(true);
    setError(null);
    try {
      if (editingTag) {
        await updateTagApi(editingTag._id || editingTag.id!, {
          name: formName.trim(),
          allocated_budget: Number(formBudget) || 0,
        });
      } else {
        await createProjectTagsApi(projectId, [{ name: formName.trim(), allocated_budget: Number(formBudget) || 0 }]);
      }
      setIsModalOpen(false);
      onRefresh();
    } catch (err: any) {
      setError(err?.message || "เกิดข้อผิดพลาด");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <h2 className="font-semibold text-slate-800">ข้อมูล Tags</h2>
          {isPrivileged && (
            <button onClick={openCreateModal} className="bg-blue-900 text-white rounded-xl px-3.5 py-2 text-xs font-medium hover:bg-blue-800 transition-colors flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              เพิ่ม Tag
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200/80 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                <th className="py-3 px-5">ชื่อ Tag</th>
                <th className="py-3 px-5 text-right">กำหนดงบไว้</th>
                <th className="py-3 px-5 text-right">รายได้</th>
                <th className="py-3 px-5 text-right">รายจ่าย</th>
                <th className="py-3 px-5 text-right">กำไร/ขาดทุน</th>
                {isPrivileged && <th className="py-3 px-5 w-20"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
              {tags.length === 0 ? (
                <tr><td colSpan={isPrivileged ? 6 : 5} className="py-8 text-center text-slate-400 text-sm">ยังไม่มี Tag</td></tr>
              ) : (
                tags.map((tag) => {
                  const tagId = tag._id || tag.id;
                  const budget = Number(tag.allocated_budget) || 0;
                  const income = Number(tag.total_income) || 0;
                  const expense = Number(tag.total_expense) || 0;
                  const profit = income - expense;
                  return (
                    <tr key={tagId} className="hover:bg-slate-50/80 transition-colors group">
                      <td className="py-3 px-5 font-medium text-slate-900">{tag.name}</td>
                      <td className="py-3 px-5 text-right">{formatTHB(budget)}</td>
                      <td className="py-3 px-5 text-right text-emerald-600">{formatTHB(income)}</td>
                      <td className="py-3 px-5 text-right text-rose-600">{formatTHB(expense)}</td>
                      <td className={`py-3 px-5 text-right font-semibold ${profit >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{formatTHB(profit)}</td>
                      {isPrivileged && (
                        <td className="py-3 px-5">
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                            <button onClick={() => openEditModal(tag)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                            </button>
                            <button disabled={isDeleting === tagId} onClick={() => tagId && handleDelete(tagId)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50">
                              {isDeleting === tagId ? (
                                <div className="w-3.5 h-3.5 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                              )}
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-sm overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <h3 className="font-semibold text-slate-800">{editingTag ? "แก้ไข Tag" : "เพิ่ม Tag"}</h3>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-xl border border-red-100">{error}</div>}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">ชื่อ Tag <span className="text-red-500">*</span></label>
                <input required type="text" value={formName} onChange={(e) => setFormName(e.target.value)} className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-sm" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">งบประมาณที่กำหนดไว้ (บาท)</label>
                <input type="number" min="0" step="1" value={formBudget} onChange={(e) => setFormBudget(e.target.value)} className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-sm" placeholder="0" />
              </div>
              <div className="pt-2 flex gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 rounded-xl font-medium transition-colors">ยกเลิก</button>
                <button type="submit" disabled={isSubmitting} className="flex-1 px-4 py-2.5 bg-blue-900 text-white hover:bg-blue-800 rounded-xl font-medium transition-all disabled:opacity-50">
                  {isSubmitting ? "กำลังบันทึก..." : (editingTag ? "บันทึก" : "เพิ่ม")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
