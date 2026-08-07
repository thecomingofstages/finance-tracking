import React from "react";

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  isDeleting: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({
  isOpen,
  title,
  message,
  isDeleting,
  error,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-sm overflow-hidden" 
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">{title}</h3>
            <p className="text-sm text-slate-500 mt-2">{message}</p>
          </div>
          
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-sm text-rose-600 text-left">
              <span className="font-semibold block mb-1">เกิดข้อผิดพลาด:</span>
              {error}
            </div>
          )}
        </div>
        <div className="p-4 bg-slate-50/50 flex gap-3">
          <button 
            type="button" 
            onClick={onCancel}
            disabled={isDeleting}
            className="flex-1 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl font-medium transition-colors"
          >
            ยกเลิก
          </button>
          <button 
            type="button" 
            onClick={onConfirm}
            disabled={isDeleting}
            className="flex-1 px-4 py-2.5 bg-rose-600 text-white hover:bg-rose-700 rounded-xl font-medium shadow-sm shadow-rose-600/20 transition-all flex items-center justify-center disabled:opacity-50"
          >
            {isDeleting ? "กำลังลบ..." : "ยืนยันการลบ"}
          </button>
        </div>
      </div>
    </div>
  );
};
