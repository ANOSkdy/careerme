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
      <div className="cv-row" style={{ justifyContent: 'flex-end', marginBottom: 16 }}>
        <button
          type="button"
          className="cv-btn ghost"
          aria-label="PDFを出力"
          onClick={handlePrint}
        >
          PDFを出力
        </button>
      </div>
      <style jsx global>{`
        @page {
          size: A4;
          margin: 12mm;
        }

        @media print {
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

          #cv-print-root [data-print-hidden='true'],
          #cv-print-root [data-print-hidden='true'] * {
            display: none !important;
          }

          #cv-print-root {
            position: static !important;
            width: 100%;
            visibility: visible !important;
          }

          #cv-print-root .cv-card,
          #cv-print-root section,
          #cv-print-root h2,
          #cv-print-root h3,
          #cv-print-root h4,
          #cv-print-root h5,
          #cv-print-root h6 {
            break-inside: avoid;
            page-break-inside: avoid;
          }

          #cv-print-root .cv-card {
            page-break-after: avoid;
          }
        }
      `}</style>
    </>
  );
}
