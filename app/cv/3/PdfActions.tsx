'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';

const TEMPLATE_VERSION = 'cv-3';

export default function PdfActions() {
  const router = useRouter();
  const [isPosting, setIsPosting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handlePrint = useCallback(async () => {
    if (isPosting) return;

    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }

    const root = document.getElementById('cv-print-root');
    if (!root) {
      window.print();
      return;
    }

    setMessage(null);
    setIsPosting(true);
    const html = root.outerHTML;

    try {
      const response = await fetch('/api/prints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html, templateVersion: TEMPLATE_VERSION }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || 'Failed to create snapshot');
      }

      const data = (await response.json()) as { id?: string };
      if (!data?.id) {
        throw new Error('Invalid snapshot response');
      }

      router.push(`/cv-print/${data.id}`);
    } catch (error) {
      console.error('Failed to prepare print snapshot', error);
      setMessage('スナップショット生成に失敗したため、直接印刷します。');
      window.print();
    } finally {
      setIsPosting(false);
    }
  }, [isPosting, router]);

  return (
    <>
      <div className="cv-row" style={{ justifyContent: 'flex-end', marginBottom: 16 }}>
        <button
          type="button"
          className="cv-btn ghost"
          aria-label="職務経歴書の生成"
          onClick={handlePrint}
          disabled={isPosting}
        >
          {isPosting ? '生成中…' : '職務経歴書の生成'}
        </button>
      </div>
      {message && (
        <p
          className="cv-row"
          style={{ justifyContent: 'flex-end', marginTop: -8, color: '#b00', fontSize: 12 }}
        >
          {message}
        </p>
      )}
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
