'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import Button from '../../../components/ui/Button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../components/ui/Tabs';
import {
  SELF_PR_MAX_CHARS,
  SELF_PR_MIN_CHARS,
  type CvQa,
} from '../../../lib/validation/schemas';

type ResumeResponse = {
  id?: string | null;
  qa?: CvQa | null;
};

type AiResponse = {
  draft?: string;
  target?: 'draft' | 'final';
  tokens?: number;
  correlationId?: string;
  code?: string;
  message?: string;
};

type SaveTarget = 'draft' | 'final';

const TARGET_LABEL: Record<SaveTarget, string> = {
  draft: '下書き',
  final: '本番',
};

export default function Page() {
  return <SelfPrSection />;
}

function SelfPrSection() {
  const router = useRouter();
  const [resumeId, setResumeId] = useState<string | null>(null);
  const resumeIdRef = useRef<string | null>(null);
  useEffect(() => {
    resumeIdRef.current = resumeId;
  }, [resumeId]);

  const ensureIdPromiseRef = useRef<Promise<string | null> | null>(null);

  const [qa, setQa] = useState<CvQa | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [target, setTarget] = useState<SaveTarget>('draft');
  const [text, setText] = useState('');
  const [savedText, setSavedText] = useState<Partial<Record<SaveTarget, string>>>({});
  const loadedTargets = useRef<Record<SaveTarget, boolean>>({ draft: false, final: false });

  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tokens, setTokens] = useState<number | undefined>();
  const [correlationId, setCorrelationId] = useState<string | null>(null);

  const qaReady = useMemo(() => {
    if (!qa) return false;
    return Object.values(qa).every((value) => value.trim().length >= 10);
  }, [qa]);

  const charCount = text.trim().length;
  const isWithinRange = charCount >= SELF_PR_MIN_CHARS && charCount <= SELF_PR_MAX_CHARS;
  const savedCurrent = savedText[target] ?? '';
  const isDirty = text !== savedCurrent;

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
        if (!res.ok) throw new Error(`failed to ensure resume id: ${res.status}`);
        const data = (await res.json()) as ResumeResponse;
        const id = data.id && typeof data.id === 'string' ? data.id : null;
        if (id) {
          resumeIdRef.current = id;
          setResumeId(id);
        }
        return id;
      } catch (err) {
        console.error('Failed to ensure resume id', err);
        return null;
      } finally {
        ensureIdPromiseRef.current = null;
      }
    })();

    return ensureIdPromiseRef.current;
  }, []);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);
    (async () => {
      try {
        const res = await fetch('/api/data/resume', { cache: 'no-store' });
        if (!res.ok) throw new Error(`failed to load resume: ${res.status}`);
        const data = (await res.json()) as ResumeResponse;
        if (cancelled) return;
        const id = data.id && typeof data.id === 'string' ? data.id : null;
        resumeIdRef.current = id;
        setResumeId(id);
        setQa(data.qa ?? null);
      } catch (err) {
        console.error('Failed to fetch resume data', err);
        if (!cancelled) setLoadError('履歴書情報の取得に失敗しました。');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadSection = useCallback(
    async (targetToLoad: SaveTarget, force = false) => {
      if (!resumeIdRef.current) return;
      if (!force && loadedTargets.current[targetToLoad]) return;
      try {
        const res = await fetch('/api/ai/selfpr', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            resumeId: resumeIdRef.current,
            action: 'load',
            target: targetToLoad,
          }),
        });
        const data = (await res.json()) as AiResponse;
        if (!res.ok) {
          const message = data?.message ?? '保存済みの内容を取得できませんでした。';
          setError(message);
          return;
        }
        const nextText = typeof data.draft === 'string' ? data.draft : '';
        setSavedText((prev) => ({ ...prev, [targetToLoad]: nextText }));
        if (targetToLoad === target) {
          setText(nextText);
        }
        setCorrelationId(data.correlationId ?? null);
        loadedTargets.current[targetToLoad] = true;
      } catch (err) {
        console.error('Failed to load AI draft', err);
        setError('保存済みの内容を取得できませんでした。');
      }
    },
    [target]
  );

  useEffect(() => {
    if (!resumeId) return;
    const existing = savedText[target];
    if (typeof existing === 'string') {
      setText(existing);
      return;
    }
    void loadSection(target);
  }, [resumeId, target, savedText, loadSection]);

  const handleGenerate = useCallback(async () => {
    setError(null);
    setStatus(null);
    setTokens(undefined);
    setIsGenerating(true);
    try {
      const ensuredId = await ensureResumeId();
      if (!ensuredId) {
        setError('下書きIDの確保に失敗しました。時間をおいて再試行してください。');
        return;
      }
      const res = await fetch('/api/ai/selfpr', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ resumeId: ensuredId, action: 'generate' }),
      });
      const data = (await res.json()) as AiResponse;
      if (!res.ok && data?.message) {
        setError(data.message);
        return;
      }
      const generated = typeof data.draft === 'string' ? data.draft : '';
      setCorrelationId(data.correlationId ?? null);
      setTokens(typeof data.tokens === 'number' ? data.tokens : undefined);
      setSavedText((prev) => ({ ...prev, draft: generated }));
      loadedTargets.current.draft = true;
      setTarget('draft');
      setText(generated);
      setStatus('AIが下書きを生成しました。');
    } catch (err) {
      console.error('Failed to generate self PR', err);
      setError('AI生成に失敗しました。時間をおいて再試行してください。');
    } finally {
      setIsGenerating(false);
    }
  }, [ensureResumeId]);

  const handleSave = useCallback(async () => {
    setError(null);
    setStatus(null);
    setIsSaving(true);
    try {
      const ensuredId = await ensureResumeId();
      if (!ensuredId) {
        setError('下書きIDの確保に失敗しました。時間をおいて再試行してください。');
        return;
      }
      const res = await fetch('/api/ai/selfpr', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          resumeId: ensuredId,
          action: 'save',
          target,
          draft: text,
        }),
      });
      const data = (await res.json()) as AiResponse;
      if (!res.ok) {
        const message = data?.message ?? '保存に失敗しました。';
        setError(message);
        return;
      }
      const saved = typeof data.draft === 'string' ? data.draft : text;
      setSavedText((prev) => ({ ...prev, [target]: saved }));
      loadedTargets.current[target] = true;
      setStatus(`${TARGET_LABEL[target]}として保存しました。`);
      setCorrelationId(data.correlationId ?? null);
    } catch (err) {
      console.error('Failed to save self PR', err);
      setError('保存中にエラーが発生しました。');
    } finally {
      setIsSaving(false);
    }
  }, [ensureResumeId, target, text]);

  const handleTabChange = useCallback(
    (value: string) => {
      if (value === 'summary') {
        router.push('/cv/3');
      }
    },
    [router]
  );

  const showRangeHint = text.length > 0 && !isWithinRange;
  const hasDraft = Boolean(savedText.draft && savedText.draft.trim().length > 0);
  const canGenerate = qaReady && !isGenerating && !isLoading;
  const canSave = !isSaving && !isGenerating && isDirty && isWithinRange && text.trim().length > 0;

  return (
    <div className="cv-ai-shell">
      <Tabs value="selfpr" onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="selfpr">自己PR</TabsTrigger>
          <TabsTrigger value="summary">職務要約</TabsTrigger>
        </TabsList>
        <TabsContent value="selfpr">
          <section className="ai-section">
            <header className="ai-section__header">
              <h1>自己PRの作成</h1>
              <p className="ai-section__description">
                Q&Aで入力した内容をもとに、AIが400〜800文字の自己PRを提案します。生成後はテキストを編集し、保存先を選んで確定してください。
              </p>
            </header>

            <div className="ai-section__actions">
              <Button
                variant="ai"
                onClick={handleGenerate}
                disabled={!canGenerate}
                isLoading={isGenerating}
                loadingText="生成中..."
              >
                {hasDraft ? '再生成する' : 'AIで出力する'}
              </Button>
              {!qaReady && !isLoading && (
                <p className="ai-hint" role="status">
                  自己PRのQ&Aが未入力です。入力を完了するとAI生成が利用できます。
                </p>
              )}
              {isLoading && <p className="ai-hint" role="status">履歴書情報を読み込み中です...</p>}
            </div>

            <div className="ai-section__editor">
              <label className="ai-label" htmlFor="selfpr-text">
                自己PRテキスト
              </label>
              <textarea
                id="selfpr-text"
                value={text}
                onChange={(event) => {
                  setText(event.target.value);
                  setError(null);
                  setStatus(null);
                }}
                placeholder="AIで生成した文章やご自身で作成した文章をこちらに記入してください。"
              />
              <div className="ai-section__meta">
                <span className={showRangeHint ? 'ai-meta ai-meta--alert' : 'ai-meta'}>
                  文字数: {charCount}（推奨 {SELF_PR_MIN_CHARS}〜{SELF_PR_MAX_CHARS}）
                </span>
                {tokens ? <span className="ai-meta">推定トークン: {tokens}</span> : null}
                {correlationId ? <span className="ai-meta">ID: {correlationId}</span> : null}
              </div>
              {showRangeHint && (
                <p className="ai-hint" role="alert">
                  文字数が推奨範囲から外れています。調整してから保存してください。
                </p>
              )}
            </div>

            <div className="ai-section__controls">
              <label className="ai-label" htmlFor="selfpr-target">
                保存先
              </label>
              <select
                id="selfpr-target"
                value={target}
                onChange={(event) => {
                  const nextTarget = event.target.value as SaveTarget;
                  setTarget(nextTarget);
                  setStatus(null);
                  setError(null);
                }}
              >
                <option value="draft">下書き（候補者メモ）</option>
                <option value="final">本番（提出用）</option>
              </select>
              <Button onClick={handleSave} disabled={!canSave} isLoading={isSaving} loadingText="保存中...">
                保存
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  if (resumeIdRef.current) {
                    loadedTargets.current[target] = false;
                    void loadSection(target, true);
                  }
                }}
                disabled={isGenerating || isSaving || isLoading}
              >
                保存内容を再読込
              </Button>
            </div>

            {status && !error && (
              <p className="ai-status" role="status">
                {status}
              </p>
            )}
            {error && (
              <p className="ai-error" role="alert">
                {error}
              </p>
            )}
            {loadError && !error && (
              <p className="ai-error" role="alert">
                {loadError}
              </p>
            )}
          </section>
        </TabsContent>
        <TabsContent value="summary">
          <section className="ai-section ai-section--note">
            <p>職務要約の編集に移動します。</p>
            <Button variant="secondary" onClick={() => router.push('/cv/3')}>
              職務要約タブへ
            </Button>
          </section>
        </TabsContent>
      </Tabs>

      <style jsx>{`
        .cv-ai-shell {
          display: flex;
          flex-direction: column;
          gap: 2rem;
          padding: 1.5rem;
        }

        .ai-section {
          background: var(--color-bg);
          border-radius: 1.5rem;
          padding: 2rem;
          box-shadow: 0 20px 45px rgba(15, 23, 42, 0.08);
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .ai-section__header h1 {
          font-size: 1.5rem;
          margin-bottom: 0.5rem;
        }

        .ai-section__description {
          color: var(--color-muted);
          line-height: 1.7;
        }

        .ai-section__actions {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          align-items: flex-start;
        }

        .ai-hint {
          font-size: 0.9rem;
          color: var(--color-muted);
        }

        .ai-section__editor textarea {
          width: 100%;
          min-height: 220px;
          resize: vertical;
          border-radius: 1rem;
          border: 1px solid var(--color-border);
          padding: 1rem;
          line-height: 1.6;
        }

        .ai-section__meta {
          display: flex;
          flex-wrap: wrap;
          gap: 0.75rem;
          font-size: 0.85rem;
          color: var(--color-muted);
        }

        .ai-meta--alert {
          color: #b42318;
          font-weight: 600;
        }

        .ai-section__controls {
          display: flex;
          flex-wrap: wrap;
          gap: 1rem;
          align-items: center;
        }

        .ai-section__controls select {
          width: auto;
          min-width: 200px;
        }

        .ai-label {
          font-weight: 600;
          display: block;
        }

        .ai-status {
          color: #046c4e;
          font-weight: 600;
        }

        .ai-error {
          color: #b42318;
          font-weight: 600;
        }

        .ai-section--note {
          align-items: flex-start;
          gap: 1rem;
        }

        @media (max-width: 768px) {
          .cv-ai-shell {
            padding: 1rem;
          }

          .ai-section {
            padding: 1.5rem;
          }

          .ai-section__controls {
            flex-direction: column;
            align-items: stretch;
          }

          .ai-section__controls select {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}
