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
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [role, setRole] = useState('');
  const [years, setYears] = useState('');
  const [headlineKeywords, setHeadlineKeywords] = useState('');
  const [extraNotes, setExtraNotes] = useState('');

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
      const payload: {
        resumeId: string;
        role?: string;
        years?: number;
        headlineKeywords?: string[];
        extraNotes?: string;
      } = { resumeId: ensuredId };

      const roleValue = role.trim();
      if (roleValue) payload.role = roleValue;

      const yearsValue = years.trim();
      if (yearsValue) {
        const parsedYears = Number(yearsValue);
        if (!Number.isNaN(parsedYears)) {
          payload.years = parsedYears;
        }
      }

      const keywords = headlineKeywords
        .split(/[\n,]/)
        .map((kw) => kw.trim())
        .filter(Boolean);
      if (keywords.length) payload.headlineKeywords = keywords;

      const notes = extraNotes.trim();
      if (notes) payload.extraNotes = notes;

      try {
        const res = await fetch('/api/ai/summary', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
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

            <div className="ai-advanced">
              <button
                type="button"
                className="ai-advanced__toggle"
                onClick={() => setShowAdvanced((prev) => !prev)}
                aria-expanded={showAdvanced}
                aria-controls="ai-advanced-panel"
              >
                <div>
                  <p className="ai-advanced__title">AIへの詳細指示（任意）</p>
                  <p className="ai-advanced__helper">
                    職種や経験年数、含めたいキーワードがあれば設定してください。
                  </p>
                </div>
                <span
                  aria-hidden
                  className={`ai-advanced__chevron ${showAdvanced ? 'is-open' : ''}`}
                >
                  ▶
                </span>
              </button>

              {showAdvanced && (
                <div id="ai-advanced-panel" className="ai-advanced__panel">
                  <label className="cv-field">
                    <span className="cv-field__label">希望している職種</span>
                    <input
                      className="cv-field__input"
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      placeholder="例：プロダクトマネージャー"
                    />
                  </label>

                  <label className="cv-field">
                    <span className="cv-field__label">経験年数</span>
                    <input
                      className="cv-field__input"
                      value={years}
                      onChange={(e) => setYears(e.target.value)}
                      inputMode="numeric"
                      placeholder="例：5"
                    />
                  </label>

                  <label className="cv-field">
                    <span className="cv-field__label">含めたいキーワード（カンマ/改行区切り）</span>
                    <textarea
                      className="cv-field__textarea"
                      rows={3}
                      value={headlineKeywords}
                      onChange={(e) => setHeadlineKeywords(e.target.value)}
                      placeholder="例：BtoB, SaaS, プロジェクトマネジメント"
                    />
                  </label>

                  <label className="cv-field">
                    <span className="cv-field__label">補足情報</span>
                    <textarea
                      className="cv-field__textarea"
                      rows={3}
                      value={extraNotes}
                      onChange={(e) => setExtraNotes(e.target.value)}
                      placeholder="例：カジュアルなトーンで、チームリード経験を強調してほしい"
                    />
                  </label>
                </div>
              )}
            </div>

            <button className="cv-btn summary-ai-button" onClick={doGenerate} disabled={isPending}>
              {isPending ? '生成中…' : 'AIで出力'}
            </button>
            <div className="summary-status" role="status" aria-live="polite">
              {saved === null && !isPending && null}
              {isPending && <span>AI が出力しています…</span>}
              {saved === true && !isPending && <span style={{ color: '#0a0' }}>Airtable に保存しました。</span>}
              {saved === false && !isPending && null}
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

        .ai-advanced {
          border: 1px solid rgba(0, 0, 0, 0.08);
          border-radius: 12px;
          margin: 16px 0;
          background: #f8fafc;
        }

        .ai-advanced__toggle {
          align-items: center;
          background: transparent;
          border: none;
          cursor: pointer;
          display: flex;
          justify-content: space-between;
          gap: 8px;
          padding: 12px 14px;
          width: 100%;
        }

        .ai-advanced__title {
          margin: 0;
          font-weight: 600;
        }

        .ai-advanced__helper {
          margin: 4px 0 0;
          color: #5b6674;
          font-size: 0.9rem;
        }

        .ai-advanced__chevron {
          display: inline-block;
          transition: transform 0.2s ease;
        }

        .ai-advanced__chevron.is-open {
          transform: rotate(90deg);
        }

        .ai-advanced__panel {
          padding: 12px 14px 14px;
          display: grid;
          gap: 12px;
        }

        .cv-field {
          display: grid;
          gap: 8px;
        }

        .cv-field__label {
          font-size: 0.95rem;
          font-weight: 600;
        }

        .cv-field__input,
        .cv-field__textarea {
          width: 100%;
          border: 1px solid rgba(0, 0, 0, 0.14);
          border-radius: 8px;
          padding: 10px 12px;
          font-size: 0.95rem;
        }

        .cv-field__input:focus,
        .cv-field__textarea:focus,
        .ai-advanced__toggle:focus-visible,
        .summary-ai-button:focus-visible,
        .cv-btn:focus-visible {
          outline: 2px solid #2563eb;
          outline-offset: 2px;
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
          color: #555;
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
