'use client';

import { useCallback, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

type ResumeResponse = {
  id?: string | null;
};

type PrintResponse = {
  ok?: boolean;
  id?: string;
  error?: { message?: string };
};

export default function PdfActions() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resumeIdRef = useRef<string | null>(null);
  const ensureIdPromiseRef = useRef<Promise<string | null> | null>(null);

  const ensureResumeId = useCallback(async () => {
    if (resumeIdRef.current) return resumeIdRef.current;
    if (ensureIdPromiseRef.current) return ensureIdPromiseRef.current;

    ensureIdPromiseRef.current = (async () => {
      try {
        const res = await fetch('/api/data/resume', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ touch: true }),
          cache: 'no-store',
        });
        if (!res.ok) {
          throw new Error(`failed to ensure resume id: ${res.status}`);
        }
        const data = (await res.json()) as ResumeResponse;
        const id = typeof data.id === 'string' && data.id ? data.id : null;
        if (id) {
          resumeIdRef.current = id;
        }
        return id;
      } catch (e) {
        console.error('Failed to ensure resume id', e);
        return null;
      } finally {
        ensureIdPromiseRef.current = null;
      }
    })();

    return ensureIdPromiseRef.current;
  }, []);

  const handlePrint = useCallback(async () => {
    setError(null);
    setIsLoading(true);
    const ensuredId = await ensureResumeId();
    if (!ensuredId) {
      setError('下書きIDの確保に失敗しました。時間をおいて再試行してください。');
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/prints', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ resumeId: ensuredId, template: 'cv_v1' }),
      });
      const data = (await res.json()) as PrintResponse;
      if (res.ok && data?.ok && data.id) {
        router.push(`/cv-print/${data.id}`);
      } else {
        const message = data?.error?.message || '職務経歴書の生成に失敗しました。';
        setError(message);
      }
    } catch (e) {
      console.error('Failed to create print snapshot', e);
      setError('ネットワークエラーが発生しました。');
    } finally {
      setIsLoading(false);
    }
  }, [ensureResumeId, router]);

  return (
    <>
      <div className="cv-row" style={{ justifyContent: 'flex-end', marginBottom: 16 }}>
        <button
          type="button"
          className="cv-btn ghost"
          aria-label="職務経歴書の生成"
          onClick={handlePrint}
          disabled={isLoading}
        >
          {isLoading ? '生成中…' : '職務経歴書の生成'}
        </button>
      </div>
      {error ? (
        <p className="cv-error" role="alert" style={{ marginTop: 8 }}>
          {error}
        </p>
      ) : null}
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
