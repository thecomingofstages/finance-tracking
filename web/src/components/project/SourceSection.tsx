"use client";

import React, { useState } from "react";
import {
  createProjectSourceApi,
  updateSourceApi,
  deleteSourceApi,
} from "@/lib/api/projects";
import type { ProjectSource, ProjectTag } from "./types";
import { ConfirmDeleteModal } from "./ConfirmDeleteModal";

const SOURCE_TYPE_LABELS: Record<string, string> = {
  enroll: "กิจกรรม",
  merch: "การขายสินค้า",
  spon: "Sponsor",
  other: "อื่นๆ",
};

const SOURCE_TYPE_OPTIONS = [
  { value: "enroll", label: "กิจกรรม" },
  { value: "merch", label: "การขายสินค้า" },
  { value: "spon", label: "Sponsor" },
  { value: "other", label: "อื่นๆ" },
];

interface SourceSectionProps {
  projectId: string;
  sources: ProjectSource[];
  tags: ProjectTag[];
  isPrivileged: boolean;
  onRefresh: () => void;
}

const formatTHB = (val: number) =>
  `฿${val.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const SourceSection: React.FC<SourceSectionProps> = ({
  projectId,
  sources,
  tags,
  isPrivileged,
  onRefresh,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSource, setEditingSource] = useState<ProjectSource | null>(null);
  const [formType, setFormType] = useState("enroll");
  const [formName, setFormName] = useState("");
  const [formReferenceId, setFormReferenceId] = useState("");
  const [formTagId, setFormTagId] = useState("");
  const [formExpectAmount, setFormExpectAmount] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Group by type
  const grouped = Object.keys(SOURCE_TYPE_LABELS).map((type) => ({
    type,
    label: SOURCE_TYPE_LABELS[type],
    items: sources.filter((s) => s.type === type),
  }));

  const grandTotalExpect = sources.reduce((s, src) => s + (Number(src.expect_amount) || 0), 0);
  const grandTotalActual = sources.reduce((s, src) => s + (Number(src.actual_amount) || 0), 0);

  const openCreateModal = () => {
    setEditingSource(null);
    setFormType("enroll");
    setFormName("");
    setFormReferenceId("");
    setFormTagId("");
    setFormExpectAmount("");
    setError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (src: ProjectSource) => {
    setEditingSource(src);
    setFormType(src.type || "other");
    setFormName(src.name || "");
    setFormReferenceId(src.reference_id || "");
    setFormTagId(src.tag_id || "");
    setFormExpectAmount(String(src.expect_amount || ""));
    setError(null);
    setIsModalOpen(true);
  };

  const requestDelete = (srcId: string) => {
    setError(null);
    setDeleteConfirmId(srcId);
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmId) return;
    setIsDeleting(deleteConfirmId);
    setError(null);
    try {
      await deleteSourceApi(deleteConfirmId);
      setDeleteConfirmId(null);
      onRefresh();
    } catch (err: any) {
      setError(err?.message || "ลบไม่สำเร็จ");
    } finally {
      setIsDeleting(null);
    }
  };

  const cancelDelete = () => {
    setError(null);
    setDeleteConfirmId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) { setError("กรุณากรอกชื่อรายการ"); return; }
    setIsSubmitting(true);
    setError(null);
    try {
      if (editingSource) {
        await updateSourceApi(editingSource._id || editingSource.id!, {
          name: formName.trim(),
          tag_id: formTagId || null,
          expect_amount: Number(formExpectAmount) || 0,
        });
      } else {
        const body: any = {
          type: formType,
          name: formName.trim(),
          tag_id: formTagId || undefined,
          expect_amount: Number(formExpectAmount) || 0,
        };
        if ((formType === "enroll" || formType === "merch") && formReferenceId.trim()) {
          body.reference_id = formReferenceId.trim();
        }
        await createProjectSourceApi(projectId, body);
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
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">ข้อมูลแหล่งเงินได้</h2>
            <p className="text-sm text-slate-500 mt-0.5">บริหารจัดการและติดตามแหล่งที่มาของงบประมาณ</p>
          </div>
          {isPrivileged && (
            <button onClick={openCreateModal} className="bg-blue-600 text-white rounded-xl px-4 py-2 text-sm font-semibold hover:bg-blue-700 shadow-sm shadow-blue-600/20 transition-all flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
              เพิ่มแหล่งเงินได้
            </button>
          )}
        </div>

        <div className="p-6 bg-slate-50/30 space-y-8">
          {grouped.map((group) => (
            <div key={group.type}>
              <div className="flex items-center gap-3 mb-4 px-1">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">{group.label}</h3>
                <span className="text-[10px] font-bold text-slate-500 bg-slate-200/60 px-2 py-0.5 rounded-full">
                  {group.items.length} รายการ
                </span>
              </div>
              {group.items.length === 0 ? (
                <div className="flex items-center justify-center p-6 rounded-xl border border-dashed border-slate-200 bg-slate-50/50">
                  <p className="text-sm font-medium text-slate-400">ยังไม่มีรายการ</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {group.items.map((src) => {
                    const srcId = src._id || src.id;
                    return (
                      <div key={srcId} className="flex items-center justify-between p-4 rounded-xl border border-slate-200/60 bg-white shadow-sm hover:border-slate-300 hover:shadow-md transition-all group">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="w-10 h-10 rounded-full bg-slate-100/80 flex items-center justify-center text-slate-400 group-hover:text-blue-500 group-hover:bg-blue-50 transition-colors shrink-0">
                            {src.type === 'enroll' ? (
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" /></svg>
                            ) : src.type === 'merch' ? (
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
                            ) : src.type === 'spon' ? (
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                            ) : (
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                            )}
                          </div>
                          <span className="text-sm font-semibold text-slate-800 truncate">{src.name}</span>
                        </div>
                        
                        <div className="flex items-center gap-6 shrink-0">
                          <div className="text-right">
                            <span className="text-sm font-bold text-slate-900 block">{formatTHB(Number(src.expect_amount) || 0)}</span>
                            {(src.actual_amount != null && src.actual_amount !== src.expect_amount) && (
                              <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded block mt-0.5">
                                {formatTHB(Number(src.actual_amount) || 0)} จริง
                              </span>
                            )}
                          </div>
                          
                          {isPrivileged && (
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => openEditModal(src)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="แก้ไข">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                              </button>
                              <button disabled={isDeleting === srcId} onClick={() => srcId && requestDelete(srcId)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-50" title="ลบ">
                                {isDeleting === srcId ? (
                                  <div className="w-4 h-4 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                )}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}

          {/* Grand Total */}
          <div className="mt-8 bg-blue-50/50 border border-blue-100 rounded-xl p-5 flex items-center justify-between">
            <span className="text-base font-bold text-slate-800">ยอดรวมแหล่งเงินได้ทั้งหมด</span>
            <div className="text-right">
              <span className="text-2xl font-black text-blue-900 tracking-tight block">{formatTHB(grandTotalExpect)}</span>
              {grandTotalActual !== grandTotalExpect && (
                <span className="text-sm font-semibold text-emerald-600 block mt-1">
                  ยอดเข้าจริง: {formatTHB(grandTotalActual)}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <h3 className="font-semibold text-slate-800">{editingSource ? "แก้ไขแหล่งเงินได้" : "เพิ่มแหล่งเงินได้"}</h3>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-xl border border-red-100">{error}</div>}

              {!editingSource && (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">ประเภท <span className="text-rose-500">*</span></label>
                  <select value={formType} onChange={(e) => setFormType(e.target.value)} className="w-full bg-slate-50 border border-slate-300 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none rounded-xl px-4 py-2.5 text-sm transition-all">
                    {SOURCE_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">ชื่อรายการ <span className="text-rose-500">*</span></label>
                <input required type="text" value={formName} onChange={(e) => setFormName(e.target.value)} className="w-full bg-slate-50 border border-slate-300 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none rounded-xl px-4 py-2.5 text-sm transition-all" />
              </div>

              {!editingSource && (formType === "enroll" || formType === "merch") && (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">ID อ้างอิง (Reference ID)</label>
                  <input type="text" value={formReferenceId} onChange={(e) => setFormReferenceId(e.target.value)} className="w-full bg-slate-50 border border-slate-300 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none rounded-xl px-4 py-2.5 text-sm transition-all" placeholder="UUID ของกิจกรรมหรือร้านค้า" />
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Tag</label>
                <select value={formTagId} onChange={(e) => setFormTagId(e.target.value)} className="w-full bg-slate-50 border border-slate-300 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none rounded-xl px-4 py-2.5 text-sm transition-all">
                  <option value="">-- ไม่ระบุ --</option>
                  {tags.map((t) => <option key={t._id || t.id} value={t._id || t.id}>{t.name}</option>)}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">คาดการณ์เงินได้ (บาท)</label>
                <input type="number" min="0" step="1" value={formExpectAmount} onChange={(e) => setFormExpectAmount(e.target.value)} className="w-full bg-slate-50 border border-slate-300 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none rounded-xl px-4 py-2.5 text-sm transition-all" placeholder="0" />
              </div>

              <div className="pt-2 flex gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 rounded-xl font-medium transition-colors">ยกเลิก</button>
                <button type="submit" disabled={isSubmitting} className="flex-1 px-4 py-2.5 bg-blue-900 text-white hover:bg-blue-800 rounded-xl font-medium transition-all disabled:opacity-50">
                  {isSubmitting ? "กำลังบันทึก..." : (editingSource ? "บันทึก" : "เพิ่ม")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDeleteModal
        isOpen={deleteConfirmId !== null}
        title="ลบแหล่งเงินได้"
        message="คุณแน่ใจหรือไม่ว่าต้องการลบแหล่งเงินได้นี้? การกระทำนี้ไม่สามารถย้อนกลับได้"
        isDeleting={isDeleting !== null}
        error={deleteConfirmId !== null ? error : null}
        onConfirm={handleConfirmDelete}
        onCancel={cancelDelete}
      />
    </>
  );
};
