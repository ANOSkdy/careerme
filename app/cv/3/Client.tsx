'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';

type ResumeResponse = {
  id?: string | null;
  summary?: string | null;
};

export default function Step3Client() {
  const [resumeId, setResumeId] = useState<string | null>(null);
  const resumeIdRef = useRef<string | null>(null);
  const ensureIdPromiseRef = useRef<Promise<string | null> | null>(null);

  const [result, setResult] = useState('');
  const [saved, setSaved] = useState<boolean | null>(null);
  const [isPending, startTransition] = useTransition();
  const [, startUiTransition] = useTransition();
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    resumeIdRef.current = resumeId;
  }, [resumeId]);

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
          setResumeId(id);
        }
        return id;
      } catch (error) {
        console.error('Failed to ensure resume id', error);
        return null;
      } finally {
        ensureIdPromiseRef.current = null;
      }
    })();

    return ensureIdPromiseRef.current;
  }, []);

  const loadFromServer = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch('/api/data/resume', { cache: 'no-store' });
      if (!res.ok) {
        throw new Error(`failed to load resume summary: ${res.status}`);
      }
      const data = (await res.json()) as ResumeResponse;
      startUiTransition(() => {
        const id = typeof data.id === 'string' && data.id ? data.id : null;
        resumeIdRef.current = id;
        setResumeId(id);
        setResult(data.summary ?? '');
        setSaved(data.summary ? true : null);
      });
    } catch (error) {
      console.error('Failed to load summary', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [startUiTransition]);

  useEffect(() => {
    void loadFromServer();
  }, [loadFromServer]);

  const doGenerate = () => {
    startTransition(async () => {
      const ensuredId = await ensureResumeId();
      if (!ensuredId) {
        alert('下書きIDの確保に失敗しました。時間をおいて再試行してください。');
        return;
      }
      setSaved(null);
      setResult('');
      try {
        const res = await fetch('/api/ai/summary', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ resumeId: ensuredId }),
        });
        const data = await res.json();
        if (data?.ok) {
          setResult(data.text || '');
          setSaved(!!data.saved);
          await loadFromServer();
        } else {
          setResult('');
          setSaved(false);
          alert(data?.error?.message || '生成に失敗しました。');
        }
      } catch (error) {
        console.error(error);
        setResult('');
        setSaved(false);
        alert('ネットワークエラーが発生しました。');
      }
    });
  };

  const previewText = result || '';
  const hasPreview = previewText.trim().length > 0;

  return (
    <section>
      <h2 className="cv-kicker">要約</h2>
      <div className="summary-layout">
        <div className="summary-actions" data-print-hidden="true">
          <div className="cv-card" style={{ marginBottom: 16 }}>
            <h3>AIで職務要約を作成</h3>
            <p style={{ color: 'var(--cv-muted)', marginTop: 0, marginBottom: 16, lineHeight: 1.6 }}>
              これまでに入力した内容をもとに AI が職務要約を生成します。生成後は自動的に下書きとして保存されます。
            </p>
            <button className="cv-btn summary-ai-button" onClick={doGenerate} disabled={isPending}>
              {isPending ? '生成中…' : 'AIで出力'}
            </button>
            <div className="summary-status" role="status" aria-live="polite">
              {saved === null && !isPending && (
                <span style={{ color: 'var(--cv-muted)' }}>
                  Airtable へ保存された最新の要約をプレビューで確認できます。
                </span>
              )}
              {isPending && <span>AI が出力しています…</span>}
              {saved === true && !isPending && <span style={{ color: '#0a0' }}>Airtable に保存しました。</span>}
              {saved === false && !isPending && (
                <span style={{ color: '#b00' }}>保存に失敗しました（Airtable 側をご確認ください）。</span>
              )}
            </div>
            <div className="cv-row" style={{ marginTop: 20, gap: 12 }}>
              <Link href="/cv/2">
                <span className="cv-btn">戻る（自己PR）</span>
              </Link>
              <button className="cv-btn ghost" onClick={() => loadFromServer()} disabled={isRefreshing}>
                {isRefreshing ? '更新中…' : '最新の保存内容を取得'}
              </button>
            </div>
          </div>
        </div>
        <div className="cv-card summary-preview">
          <div className="summary-preview__header">
            <h3>プレビュー</h3>
          </div>
          <div className={`summary-preview__surface ${hasPreview ? 'is-filled' : ''}`}>
            {hasPreview ? (
              <p className="summary-preview__text">{previewText}</p>
            ) : (
              <p className="summary-preview__placeholder">
                「AIで出力」ボタンを押すと、ここに職務要約の出力結果が表示されます。
              </p>
            )}
          </div>
        </div>
      </div>
      <style jsx>{`
        .summary-layout {
          display: grid;
          gap: 1.5rem;
        }

        .summary-actions {
          display: flex;
          flex-direction: column;
        }

        .summary-ai-button {
          width: 100%;
          font-size: 1rem;
          min-height: 3rem;
        }

        .summary-status {
          margin-top: 16px;
          font-size: 0.9rem;
          line-height: 1.6;
        }

        .summary-preview {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .summary-preview__header {
          align-items: center;
          display: flex;
          gap: 0.75rem;
          justify-content: space-between;
        }

        .summary-preview__surface {
          border: 1px solid rgba(0, 0, 0, 0.08);
          border-radius: 12px;
          min-height: 200px;
          padding: 16px;
          background: #fff;
        }

        .summary-preview__surface.is-filled {
          background: linear-gradient(180deg, rgba(245, 249, 255, 0.8), rgba(255, 255, 255, 0.95));
        }

        .summary-preview__text {
          margin: 0;
          white-space: pre-wrap;
          line-height: 1.7;
        }

        .summary-preview__placeholder {
          margin: 0;
          color: var(--cv-muted);
          line-height: 1.6;
        }

        @media (min-width: 960px) {
          .summary-layout {
            grid-template-columns: minmax(0, 420px) minmax(0, 1fr);
          }
        }
      `}</style>
    </section>
  );
}
