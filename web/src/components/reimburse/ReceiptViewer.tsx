"use client";

import React, { useState } from "react";

export interface ReceiptViewerProps {
  url: string | null;
  fallbackText?: string;
  className?: string;
}

export const ReceiptViewer: React.FC<ReceiptViewerProps> = ({
  url,
  fallbackText = "ไม่มีเอกสารหลักฐาน / ใบกำกับภาษีแนบในรายการนี้",
  className = "",
}) => {
  const [isError, setIsError] = useState(false);

  if (!url) {
    return (
      <div
        className={`flex flex-col items-center justify-center p-8 bg-slate-50/70 border border-dashed border-slate-200 rounded-2xl text-slate-400 text-xs text-center ${className}`}
      >
        <svg
          className="w-8 h-8 mb-2 text-slate-300"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        <span>{fallbackText}</span>
      </div>
    );
  }

  // Detect if it's a PDF from URL extension or content type query parameter
  const isPdf =
    url.toLowerCase().includes(".pdf") ||
    url.toLowerCase().includes("type=pdf") ||
    url.toLowerCase().includes("content-type=application%2fpdf");

  if (isError) {
    return (
      <div
        className={`flex flex-col items-center justify-center p-6 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 text-xs text-center ${className}`}
      >
        <svg
          className="w-8 h-8 mb-2 opacity-60"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <span className="font-semibold mb-1">ไม่สามารถแสดงตัวอย่างเอกสารได้</span>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 mt-2 px-3 py-1.5 bg-white text-rose-700 font-medium border border-rose-200 rounded-lg shadow-2xs hover:bg-rose-50 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
          <span>เปิดไฟล์ในแท็บใหม่</span>
        </a>
      </div>
    );
  }

  return (
    <div
      className={`relative overflow-hidden bg-slate-50 border border-slate-200 rounded-2xl flex flex-col items-center justify-center ${className}`}
    >
      {isPdf ? (
        <div className="w-full flex flex-col">
          <div className="flex items-center justify-between px-4 py-2 bg-slate-100 border-b border-slate-200 text-xs text-slate-600">
            <span className="font-medium flex items-center gap-1.5">
              <svg className="w-4 h-4 text-rose-600" fill="currentColor" viewBox="0 0 20 20">
                <path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" />
              </svg>
              เอกสาร PDF (ใบกำกับภาษี / ใบเสร็จรับเงิน)
            </span>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-blue-900 font-semibold hover:underline"
            >
              เปิดเต็มจอ
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>
          <object
            data={url}
            type="application/pdf"
            className="w-full min-h-[360px] max-h-[500px]"
            onError={() => setIsError(true)}
          >
            <div className="flex flex-col items-center justify-center min-h-[220px] p-6 text-center">
              <p className="text-xs text-slate-600 mb-3">
                เบราว์เซอร์ไม่รองรับการแสดงผล PDF ในตัว
              </p>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-blue-900 text-white rounded-xl text-xs font-semibold shadow-sm hover:bg-blue-800 transition-colors"
              >
                ดาวน์โหลด / เปิดดู PDF
              </a>
            </div>
          </object>
        </div>
      ) : (
        <div className="w-full relative group">
          <div className="flex items-center justify-center p-3 max-h-[380px] bg-slate-900/5">
            <img
              src={url}
              alt="Receipt Document"
              className="max-h-[350px] max-w-full object-contain rounded-lg shadow-2xs"
              onError={() => setIsError(true)}
            />
          </div>
          <div className="absolute bottom-2 right-2 opacity-90 group-hover:opacity-100 transition-opacity">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-900/80 hover:bg-slate-900 text-white text-xs font-medium rounded-lg backdrop-blur-sm shadow-sm transition-colors cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              <span>ดูภาพขนาดเต็ม</span>
            </a>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReceiptViewer;
