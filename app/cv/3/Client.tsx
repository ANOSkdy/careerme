'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

type ResumeInfo = {
  selfpr_draft?: string;
  summary_draft?: string;
  source_env?: string;
  pr_ref?: string;
};

export default function Step3Client() {
  const params = useSearchParams();
  const [resumeId, setResumeId] = useState('');
  const [result, setResult] = useState('');
  const [saved, setSaved] = useState<boolean | null>(null);
  const [isPending, startTransition] = useTransition();
  const [, syncResumeTransition] = useTransition();
  const [serverState, setServerState] = useState<ResumeInfo>({});
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    const idFromUrl = params.get('id') || '';
    const ls = typeof window !== 'undefined' ? window.localStorage.getItem('resumeId') || '' : '';
    const nextId = idFromUrl || ls;
    syncResumeTransition(() => {
      setResumeId(nextId);
    });
    if (typeof window !== 'undefined') {
      if (nextId) {
        window.localStorage.setItem('resumeId', nextId);
      } else {
        window.localStorage.removeItem('resumeId');
      }
      window.dispatchEvent(new CustomEvent('resumeId-change', { detail: nextId }));
    }
  }, [params, syncResumeTransition]);

  useEffect(() => {
    if (!resumeId) {
      setServerState({});
      setResult('');
      setSaved(null);
    }
  }, [resumeId]);

  const loadFromServer = useCallback(
    async (idValue?: string) => {
      const targetId = idValue ?? resumeId;
      if (!targetId) return;
      setIsRefreshing(true);
      try {
        const res = await fetch(`/api/data/resumes/${encodeURIComponent(targetId)}`);
        const data = await res.json();
        if (data?.ok) {
          setServerState(data.fields || {});
          setResult(data.fields?.summary_draft || '');
        } else {
          setServerState({});
          setResult('');
        }
      } catch (error) {
        console.error('Failed to load server data', error);
      } finally {
        setIsRefreshing(false);
      }
    },
    [resumeId],
  );

  useEffect(() => {
    loadFromServer();
  }, [loadFromServer]);

  const canGenerate = !!resumeId;

  const doGenerate = () => {
    if (!resumeId) {
      alert('resumeId is required. 上のフィールドに入力してください。');
      return;
    }
    startTransition(async () => {
      setSaved(null);
      setResult('');
      try {
        const res = await fetch('/api/ai/summary', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ resumeId }),
        });
        const data = await res.json();
        if (data?.ok) {
          setResult(data.text || '');
          setSaved(!!data.saved);
          await loadFromServer(resumeId);
        } else {
          setResult('');
          setSaved(false);
          alert(data?.error?.message || 'Generation failed');
        }
      } catch (error) {
        console.error(error);
        setResult('');
        setSaved(false);
        alert('Network error');
      }
    });
  };

  const previewText = result || '';
  const hasPreview = previewText.trim().length > 0;

  return (
    <section>
      <h2 className="cv-kicker">要約</h2>
      {!resumeId && (
        <p style={{ color: '#b00', marginBottom: 12 }}>
          resumeId が未設定です。上のフィールドに入力してください。
        </p>
      )}
      <div className="summary-layout">
        <div className="summary-actions" data-print-hidden="true">
          <div className="cv-card" style={{ marginBottom: 16 }}>
            <h3>AIで職務要約を作成</h3>
            <p style={{ color: 'var(--cv-muted)', marginTop: 0, marginBottom: 16, lineHeight: 1.6 }}>
              これまでに入力した内容をもとに AI が職務要約を生成します。出力結果は右の
              プレビューに即時反映され、保存可能なテキストとして確認できます。
            </p>
            <button
              className="cv-btn summary-ai-button"
              variant="ai"
              onClick={doGenerate}
              disabled={!canGenerate || isPending}
            >
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
            <div className="cv-row" style={{ marginTop: 20 }}>
              <Link href={resumeId ? { pathname: '/cv/2', query: { id: resumeId } } : '/cv/2'}>
                <span className="cv-btn">戻る（自己PR）</span>
              </Link>
              <button
                className="cv-btn ghost"
                onClick={() => loadFromServer()}
                disabled={!resumeId || isRefreshing}
              >
                {isRefreshing ? '更新中…' : 'サーバから再読込'}
              </button>
            </div>
          </div>
          <div className="cv-card">
            <h3>サーバ保存値（検証用）</h3>
            <p style={{ color: 'var(--cv-muted)', marginTop: 0, marginBottom: 8 }}>
              env: {serverState.source_env || '-'} / ref: {serverState.pr_ref || '-'}
            </p>
            <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, margin: 0 }}>
              {serverState.summary_draft || '（保存なし）'}
            </p>
          </div>
        </div>
        <div className="cv-card summary-preview">
          <div className="summary-preview__header">
            <h3>プレビュー</h3>
            {resumeId && (
              <span className="preview-chip" aria-label="現在の resumeId">
                ID: {resumeId.length > 12 ? `${resumeId.slice(0, 6)}…${resumeId.slice(-4)}` : resumeId}
              </span>
            )}
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

        .preview-chip {
          background: rgba(58, 117, 196, 0.08);
          border-radius: 999px;
          color: rgba(35, 64, 104, 0.88);
          font-size: 0.8rem;
          font-weight: 600;
          letter-spacing: 0.02em;
          padding: 0.35rem 0.75rem;
        }

        .summary-preview__surface {
          background: linear-gradient(180deg, rgba(58, 117, 196, 0.08), rgba(255, 255, 255, 0.92));
          border: 1px dashed rgba(58, 117, 196, 0.25);
          border-radius: 0.9rem;
          min-height: 280px;
          padding: 1.5rem;
        }

        .summary-preview__surface.is-filled {
          border-style: solid;
          border-color: rgba(58, 117, 196, 0.35);
          box-shadow: inset 0 0 0 1px rgba(58, 117, 196, 0.12);
        }

        .summary-preview__text {
          margin: 0;
          white-space: pre-wrap;
          line-height: 1.7;
          font-size: 1rem;
        }

        .summary-preview__placeholder {
          margin: 0;
          color: var(--cv-muted);
          line-height: 1.7;
        }

        @media (min-width: 960px) {
          .summary-layout {
            grid-template-columns: minmax(0, 340px) minmax(0, 1fr);
          }
        }

        @media (max-width: 959px) {
          .summary-actions .cv-card {
            margin-bottom: 1rem;
          }
        }

        @media print {
          .summary-layout {
            display: block;
          }

          .summary-preview {
            box-shadow: none;
          }

          .summary-preview__surface {
            background: #ffffff;
            border: none;
            padding: 0;
            min-height: auto;
          }
        }
      `}</style>
    </section>
  );
}
