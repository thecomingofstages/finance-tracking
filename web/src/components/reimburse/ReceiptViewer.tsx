"use client";

import React, { useState } from "react";

export interface ReceiptViewerProps {
  url: string | null;
  fallbackText?: string;
  className?: string;
}

export const ReceiptViewer: React.FC<ReceiptViewerProps> = ({
  url,
  fallbackText = "ไม่พบเอกสารประกอบ",
  className = "",
}) => {
  const [isError, setIsError] = useState(false);

  if (!url) {
    return (
      <div className={`flex items-center justify-center bg-slate-100 rounded-xl text-slate-400 text-sm ${className}`}>
        {fallbackText}
      </div>
    );
  }

  // Detect if it's a PDF from URL extension or standard presigned URL patterns
  const isPdf = url.toLowerCase().includes(".pdf") || url.toLowerCase().includes("type=pdf") || url.toLowerCase().includes("content-type=application%2fpdf");

  if (isError) {
    return (
      <div className={`flex flex-col items-center justify-center bg-rose-50 border border-rose-100 rounded-xl text-rose-500 text-sm ${className}`}>
        <svg className="w-8 h-8 mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>ไม่สามารถโหลดเอกสารได้</span>
        <a href={url} target="_blank" rel="noreferrer" className="text-xs text-slate-800 hover:underline mt-2">
          เปิดไฟล์ในหน้าต่างใหม่
        </a>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-center ${className}`}>
      {isPdf ? (
        <object
          data={url}
          type="application/pdf"
          className="w-full h-full min-h-[400px]"
          onError={() => setIsError(true)}
        >
          <div className="flex flex-col items-center justify-center h-full p-4 text-center">
            <p className="text-sm text-slate-600 mb-3">เบราว์เซอร์ของคุณไม่รองรับการแสดงผล PDF ในตัว</p>
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              ดาวน์โหลด / เปิด PDF
            </a>
          </div>
        </object>
      ) : (
        <img
          src={url}
          alt="Receipt Document"
          className="max-w-full max-h-full object-contain"
          onError={() => setIsError(true)}
        />
      )}
    </div>
  );
};

export default ReceiptViewer;
