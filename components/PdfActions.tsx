'use client';

import { useCallback } from 'react';

export default function PdfActions() {
  const handlePrint = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  }, []);

  return (
    <>
      <div className="pdf-actions" data-print-hidden="true">
        <button type="button" className="cv-btn ghost" onClick={handlePrint}>
          PDFを出力
        </button>
      </div>
      <style jsx>{`
        .pdf-actions {
          display: flex;
          justify-content: flex-end;
          margin-bottom: 16px;
        }

        .cv-btn {
          min-width: 160px;
        }
      `}</style>
      <style jsx global>{`
        @page {
          size: A4;
          margin: 12mm;
        }

        @media print {
          html,
          body {
            background: #fff;
            margin: 0;
          }

          body * {
            display: none !important;
          }

          #cv-print-root,
          #cv-print-root * {
            display: revert !important;
          }

          #cv-print-root {
            position: static !important;
            width: 100%;
            visibility: visible !important;
          }

          [data-print-hidden],
          [data-print-hidden] * {
            display: none !important;
          }

          #cv-print-root section,
          #cv-print-root article,
          #cv-print-root .cv-print-card {
            break-inside: avoid;
            page-break-inside: avoid;
          }
        }
      `}</style>
    </>
  );
}
