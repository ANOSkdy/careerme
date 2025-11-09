'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import Button from '../../../components/ui/Button';
import { Tab, TabPanel, Tabs, TabsList } from '../../../components/ui/Tabs';
import {
  CvQaSchema,
  SELF_PR_MAX_CHARS,
  SELF_PR_MIN_CHARS,
  SUMMARY_MAX_CHARS,
  SUMMARY_MIN_CHARS,
  type CvQa,
} from '../../../lib/validation/schemas';

import type { GeminiUsage } from '../../../lib/ai/gemini';

const TABS: Array<{ value: TabValue; label: string }> = [
  { value: 'selfpr', label: '自己PR' },
  { value: 'summary', label: '職務要約' },
];

const TARGET_OPTIONS: Array<{ value: TargetValue; label: string }> = [
  { value: 'draft', label: '下書き' },
  { value: 'final', label: '最終稿' },
];

type TabValue = 'selfpr' | 'summary';
type TargetValue = 'draft' | 'final';

type ResumeResponse = {
  id?: string | null;
  qa?: CvQa | null;
};

type Notice = {
  tone: 'success' | 'error' | 'info' | 'warning';
  message: string;
  correlationId?: string;
};

type AiResponse<T extends TargetValue> = {
  success: true;
  correlationId: string;
  data: {
    target: T;
    text: string;
    fallback?: boolean;
    usage?: GeminiUsage;
    updatedAt?: string | null;
    saved?: boolean;
  };
};

type AiErrorResponse = {
  code?: string;
  message?: string;
  correlationId?: string;
};

type AiPayloadBase = {
  resumeId: string;
  target: TargetValue;
};

type AiGeneratePayload = AiPayloadBase & {
  action: 'generate';
  qa: CvQa;
  draft?: string;
};

type AiSavePayload = AiPayloadBase & {
  action: 'save';
  text: string;
};

type AiLoadPayload = AiPayloadBase & {
  action: 'load';
};

function createNotice(
  tone: Notice['tone'],
  message: string,
  correlationId?: string
): Notice {
  return { tone, message, correlationId };
}

function getCharCount(text: string): number {
  return text.trim().length;
}

function withinRange(length: number, min: number, max: number): boolean {
  return length >= min && length <= max;
}

function formatRange(min: number, max: number): string {
  return `${min}〜${max}文字`;
}

function safeRandomId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}

type EditorState = {
  text: Record<TargetValue, string>;
  saved: Record<TargetValue, string>;
  fallbackUsed: Record<TargetValue, boolean>;
  loading: Record<TargetValue, boolean>;
  loaded: Record<TargetValue, boolean>;
  generating: boolean;
  saving: boolean;
  target: TargetValue;
};

function createInitialEditorState(target: TargetValue): EditorState {
  return {
    text: { draft: '', final: '' },
    saved: { draft: '', final: '' },
    fallbackUsed: { draft: false, final: false },
    loading: { draft: false, final: false },
    loaded: { draft: false, final: false },
    generating: false,
    saving: false,
    target,
  };
}

function isSameText(state: EditorState, target: TargetValue): boolean {
  const current = state.text[target];
  const saved = state.saved[target];
  return current === saved;
}

function buildLengthLabel(text: string, min: number, max: number): {
  tone: Notice['tone'];
  message: string;
} {
  const count = getCharCount(text);
  if (!count) {
    return {
      tone: 'info',
      message: `推奨 ${formatRange(min, max)}`,
    };
  }
  if (withinRange(count, min, max)) {
    return {
      tone: 'success',
      message: `${count}文字（推奨 ${formatRange(min, max)}）`,
    };
  }
  return {
    tone: 'warning',
    message: `${count}文字（推奨 ${formatRange(min, max)}）`,
  };
}

function createFallbackSelfPr(qa: CvQa): string {
  return [
    '【自己PR（バックアップ生成）】',
    qa.q1,
    qa.q2,
    `価値観: ${qa.q3}`,
    `志向: ${qa.q4}`,
  ]
    .join('\n')
    .trim();
}

function createFallbackSummary(qa: CvQa): string {
  return [
    '【職務要約（バックアップ生成）】',
    qa.q1,
    `主要エピソード: ${qa.q2}`,
    `志向・価値観: ${qa.q3}`,
  ]
    .join('\n')
    .trim();
}

type AiComposerProps = {
  initialTab: TabValue;
};

export default function AiComposer({ initialTab }: AiComposerProps) {
  const [activeTab, setActiveTab] = useState<TabValue>(initialTab);
  const [resumeState, setResumeState] = useState<{
    id: string | null;
    qa: CvQa | null;
    loading: boolean;
    error: string | null;
  }>({
    id: null,
    qa: null,
    loading: true,
    error: null,
  });
  const resumeIdRef = useRef<string | null>(null);
  const ensureIdPromiseRef = useRef<Promise<string | null> | null>(null);
  const qaRef = useRef<CvQa | null>(null);

  const [notices, setNotices] = useState<{ selfpr: Notice | null; summary: Notice | null }>(
    () => ({ selfpr: null, summary: null })
  );
  const [selfPrState, setSelfPrState] = useState<EditorState>(() => createInitialEditorState('draft'));
  const [summaryState, setSummaryState] = useState<EditorState>(() => createInitialEditorState('draft'));

  const setEditorTarget = useCallback((key: TabValue, target: TargetValue) => {
    if (key === 'selfpr') {
      setSelfPrState((prev) => ({ ...prev, target }));
    } else {
      setSummaryState((prev) => ({ ...prev, target }));
    }
  }, []);

  const setEditorLoading = useCallback((key: TabValue, target: TargetValue, value: boolean) => {
    if (key === 'selfpr') {
      setSelfPrState((prev) => ({
        ...prev,
        loading: { ...prev.loading, [target]: value },
      }));
    } else {
      setSummaryState((prev) => ({
        ...prev,
        loading: { ...prev.loading, [target]: value },
      }));
    }
  }, []);

  const setEditorGenerating = useCallback((key: TabValue, value: boolean) => {
    if (key === 'selfpr') {
      setSelfPrState((prev) => ({ ...prev, generating: value }));
    } else {
      setSummaryState((prev) => ({ ...prev, generating: value }));
    }
  }, []);

  const setEditorSaving = useCallback((key: TabValue, value: boolean) => {
    if (key === 'selfpr') {
      setSelfPrState((prev) => ({ ...prev, saving: value }));
    } else {
      setSummaryState((prev) => ({ ...prev, saving: value }));
    }
  }, []);

  const setEditorText = useCallback((key: TabValue, target: TargetValue, value: string) => {
    if (key === 'selfpr') {
      setSelfPrState((prev) => ({
        ...prev,
        text: { ...prev.text, [target]: value },
      }));
    } else {
      setSummaryState((prev) => ({
        ...prev,
        text: { ...prev.text, [target]: value },
      }));
    }
  }, []);

  const setEditorSaved = useCallback((key: TabValue, target: TargetValue, value: string) => {
    if (key === 'selfpr') {
      setSelfPrState((prev) => ({
        ...prev,
        saved: { ...prev.saved, [target]: value },
      }));
    } else {
      setSummaryState((prev) => ({
        ...prev,
        saved: { ...prev.saved, [target]: value },
      }));
    }
  }, []);

  const setEditorFallback = useCallback((key: TabValue, target: TargetValue, value: boolean) => {
    if (key === 'selfpr') {
      setSelfPrState((prev) => ({
        ...prev,
        fallbackUsed: { ...prev.fallbackUsed, [target]: value },
      }));
    } else {
      setSummaryState((prev) => ({
        ...prev,
        fallbackUsed: { ...prev.fallbackUsed, [target]: value },
      }));
    }
  }, []);

  const setEditorLoaded = useCallback((key: TabValue, target: TargetValue, value: boolean) => {
    if (key === 'selfpr') {
      setSelfPrState((prev) => ({
        ...prev,
        loaded: { ...prev.loaded, [target]: value },
      }));
    } else {
      setSummaryState((prev) => ({
        ...prev,
        loaded: { ...prev.loaded, [target]: value },
      }));
    }
  }, []);

  const updateNotice = useCallback((key: TabValue, notice: Notice | null) => {
    setNotices((prev) => ({ ...prev, [key]: notice }));
  }, []);

  useEffect(() => {
    resumeIdRef.current = resumeState.id;
  }, [resumeState.id]);

  useEffect(() => {
    qaRef.current = resumeState.qa;
  }, [resumeState.qa]);

  const ensureResumeId = useCallback(async (): Promise<string | null> => {
    if (resumeIdRef.current) {
      return resumeIdRef.current;
    }
    if (ensureIdPromiseRef.current) {
      return ensureIdPromiseRef.current;
    }

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
          setResumeState((prev) => ({ ...prev, id }));
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

  useEffect(() => {
    let cancelled = false;
    setResumeState((prev) => ({ ...prev, loading: true, error: null }));

    (async () => {
      try {
        const res = await fetch('/api/data/resume', { cache: 'no-store' });
        if (!res.ok) {
          throw new Error(`failed to load resume: ${res.status}`);
        }
        const data = (await res.json()) as ResumeResponse;
        if (cancelled) return;
        const id = typeof data.id === 'string' && data.id ? data.id : null;
        const qaResult = data.qa ? CvQaSchema.safeParse(data.qa) : null;
        resumeIdRef.current = id;
        qaRef.current = qaResult?.success ? qaResult.data : null;
        setResumeState({
          id,
          qa: qaResult?.success ? qaResult.data : null,
          loading: false,
          error: null,
        });
      } catch (error) {
        if (cancelled) return;
        console.error('Failed to load resume data', error);
        setResumeState((prev) => ({
          ...prev,
          loading: false,
          error: '履歴書データの取得に失敗しました。時間をおいて再試行してください。',
        }));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const callAi = useCallback(
    async <T extends TargetValue>(
      key: TabValue,
      payload: AiGeneratePayload | AiSavePayload | AiLoadPayload
    ): Promise<AiResponse<T>> => {
      const correlationId = safeRandomId();
      const endpoint = key === 'selfpr' ? '/api/ai/selfpr' : '/api/ai/summary';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-correlation-id': correlationId,
        },
        body: JSON.stringify(payload),
      });

      const data = (await res.json().catch(() => null)) as
        | AiResponse<T>
        | AiErrorResponse
        | null;

      if (!res.ok || !data || (data as AiResponse<T>).success !== true) {
        const errorBody = data as AiErrorResponse | null;
        const message =
          errorBody?.message ||
          (res.status === 429
            ? '短時間にリクエストが集中しました。しばらく待ってから再度お試しください。'
            : 'AI API の呼び出しに失敗しました。');
        const error = new Error(message);
        (error as Error & { code?: string; correlationId?: string }).code = errorBody?.code;
        (error as Error & { code?: string; correlationId?: string }).correlationId =
          errorBody?.correlationId;
        throw error;
      }

      return data as AiResponse<T>;
    },
    []
  );

  const loadEditor = useCallback(
    async (key: TabValue, target: TargetValue) => {
      const resumeId = resumeIdRef.current;
      if (!resumeId) return;
      setEditorLoading(key, target, true);
      updateNotice(key, null);
      try {
        const response = await callAi<TargetValue>(key, {
          action: 'load',
          resumeId,
          target,
        });
        setEditorText(key, target, response.data.text ?? '');
        setEditorSaved(key, target, response.data.text ?? '');
        setEditorFallback(key, target, Boolean(response.data.fallback));
        setEditorLoaded(key, target, true);
      } catch (error) {
        console.error(`Failed to load ${key}`, error);
        updateNotice(
          key,
          createNotice(
            'error',
            '保存済みの内容を読み込めませんでした。時間をおいて再試行してください。',
            (error as Error & { correlationId?: string }).correlationId
          )
        );
      } finally {
        setEditorLoading(key, target, false);
      }
    },
    [callAi, setEditorFallback, setEditorLoaded, setEditorLoading, setEditorSaved, setEditorText, updateNotice]
  );

  useEffect(() => {
    if (!resumeIdRef.current) return;
    if (!selfPrState.loaded.draft) {
      void loadEditor('selfpr', 'draft');
    }
    if (!summaryState.loaded.draft) {
      void loadEditor('summary', 'draft');
    }
  }, [loadEditor, selfPrState.loaded.draft, summaryState.loaded.draft]);

  useEffect(() => {
    if (selfPrState.target === 'final' && !selfPrState.loaded.final && resumeIdRef.current) {
      void loadEditor('selfpr', 'final');
    }
  }, [loadEditor, resumeState.id, selfPrState.loaded.final, selfPrState.target]);

  useEffect(() => {
    if (summaryState.target === 'final' && !summaryState.loaded.final && resumeIdRef.current) {
      void loadEditor('summary', 'final');
    }
  }, [loadEditor, resumeState.id, summaryState.loaded.final, summaryState.target]);

  const canGenerateSelfPr = Boolean(
    qaRef.current && Object.values(qaRef.current).every((value) => value.trim().length > 0)
  );

  const canGenerateSummary = canGenerateSelfPr;

  const handleGenerate = useCallback(
    async (key: TabValue) => {
      const target = key === 'selfpr' ? selfPrState.target : summaryState.target;
      const qa = qaRef.current;
      if (!qa) {
        updateNotice(key, createNotice('error', '必要な質問への回答が不足しています。'));
        return;
      }
      const ensuredId = await ensureResumeId();
      if (!ensuredId) {
        updateNotice(key, createNotice('error', '下書きIDの確保に失敗しました。'));
        return;
      }

      setEditorGenerating(key, true);
      updateNotice(key, null);
      try {
        const payload: AiGeneratePayload = {
          action: 'generate',
          resumeId: ensuredId,
          target,
          qa,
          draft: key === 'selfpr' ? selfPrState.text[target] : summaryState.text[target],
        };
        const response = await callAi<TargetValue>(key, payload);
        const text = response.data.text || (key === 'selfpr'
          ? createFallbackSelfPr(qa)
          : createFallbackSummary(qa));
        setEditorText(key, target, text);
        setEditorFallback(key, target, Boolean(response.data.fallback));
        updateNotice(
          key,
          createNotice(
            response.data.fallback ? 'warning' : 'success',
            response.data.fallback
              ? 'Gemini からの応答が不安定だったためバックアップ文面を表示しています。'
              : 'AI が文章を生成しました。',
            response.correlationId
          )
        );
      } catch (error) {
        console.error('Failed to generate AI text', error);
        const qaSnapshot = qaRef.current;
        const fallback = qaSnapshot
          ? key === 'selfpr'
            ? createFallbackSelfPr(qaSnapshot)
            : createFallbackSummary(qaSnapshot)
          : '';
        if (fallback) {
          setEditorText(key, target, fallback);
          setEditorFallback(key, target, true);
          updateNotice(
            key,
            createNotice(
              'warning',
              'AI 生成に失敗したためバックアップ文面を表示しています。必要に応じて編集してください。',
              (error as Error & { correlationId?: string }).correlationId
            )
          );
        } else {
          updateNotice(
            key,
            createNotice(
              'error',
              (error as Error).message || 'AI 生成に失敗しました。',
              (error as Error & { correlationId?: string }).correlationId
            )
          );
        }
      } finally {
        setEditorGenerating(key, false);
      }
    },
    [callAi, ensureResumeId, selfPrState.target, selfPrState.text, summaryState.target, summaryState.text, setEditorFallback, setEditorGenerating, setEditorText, updateNotice]
  );

  const handleSave = useCallback(
    async (key: TabValue) => {
      const target = key === 'selfpr' ? selfPrState.target : summaryState.target;
      const text = key === 'selfpr' ? selfPrState.text[target] : summaryState.text[target];
      if (!text.trim()) {
        updateNotice(key, createNotice('error', '文章が空です。内容を確認してください。'));
        return;
      }
      const ensuredId = await ensureResumeId();
      if (!ensuredId) {
        updateNotice(key, createNotice('error', '下書きIDの確保に失敗しました。'));
        return;
      }
      setEditorSaving(key, true);
      updateNotice(key, null);
      try {
        const response = await callAi<TargetValue>(key, {
          action: 'save',
          resumeId: ensuredId,
          target,
          text,
        });
        setEditorSaved(key, target, text);
        updateNotice(
          key,
          createNotice('success', '保存しました。', response.correlationId)
        );
      } catch (error) {
        console.error('Failed to save AI text', error);
        updateNotice(
          key,
          createNotice(
            'error',
            (error as Error).message || '保存に失敗しました。',
            (error as Error & { correlationId?: string }).correlationId
          )
        );
      } finally {
        setEditorSaving(key, false);
      }
    },
    [callAi, ensureResumeId, selfPrState.target, selfPrState.text, summaryState.target, summaryState.text, setEditorSaving, setEditorSaved, updateNotice]
  );

  const renderEditor = (key: TabValue, state: EditorState) => {
    const isSelfPr = key === 'selfpr';
    const min = isSelfPr ? SELF_PR_MIN_CHARS : SUMMARY_MIN_CHARS;
    const max = isSelfPr ? SELF_PR_MAX_CHARS : SUMMARY_MAX_CHARS;
    const notice = notices[key];
    const target = state.target;
    const text = state.text[target];
    const lengthLabel = buildLengthLabel(text, min, max);
    const isGenerating = state.generating;
    const isSaving = state.saving;
    const isLoading = state.loading[target];
    const disableGenerate = key === 'selfpr' ? !canGenerateSelfPr : !canGenerateSummary;
    const hasText = Boolean(text.trim());
    const canSave = hasText && !isSameText(state, target);

    return (
      <div className="ai-editor">
        <div className="ai-editor__controls">
          <div className="ai-editor__target">
            <label>
              保存先
              <select
                value={target}
                onChange={(event) => {
                  const nextTarget = event.target.value as TargetValue;
                  setEditorTarget(key, nextTarget);
                }}
                aria-label="保存先"
              >
                {TARGET_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <Button
            variant="ai"
            loading={isGenerating}
            disabled={disableGenerate || isGenerating || resumeState.loading}
            onClick={() => {
              void handleGenerate(key);
            }}
          >
            AIで出力する
          </Button>
        </div>
        <p className={`ai-editor__hint ai-editor__hint--${lengthLabel.tone}`}>
          {lengthLabel.message}
        </p>
        {notice ? (
          <div className={`ai-editor__notice ai-editor__notice--${notice.tone}`} role="status">
            <span>{notice.message}</span>
            {notice.correlationId ? (
              <span className="ai-editor__notice-id">ID: {notice.correlationId}</span>
            ) : null}
          </div>
        ) : null}
        {isLoading && !hasText ? (
          <p className="ai-editor__loading">読み込み中です…</p>
        ) : null}
        {hasText || isLoading ? (
          <label className="ai-editor__textarea-label">
            <span>{isSelfPr ? '自己PR本文' : '職務要約本文'}</span>
            <textarea
              value={text}
              onChange={(event) => setEditorText(key, target, event.target.value)}
              rows={12}
              aria-label={isSelfPr ? '自己PR本文' : '職務要約本文'}
            />
          </label>
        ) : (
          <p className="ai-editor__placeholder">
            AIで出力するボタンを押すと、ここに{isSelfPr ? '自己PR' : '職務要約'}の案が表示されます。
          </p>
        )}
        <div className="ai-editor__actions">
          <Button
            variant="secondary"
            loading={isSaving}
            disabled={!canSave || isSaving}
            onClick={() => {
              void handleSave(key);
            }}
          >
            保存する
          </Button>
        </div>
      </div>
    );
  };

  return (
    <section className="ai-composer">
      <Tabs value={activeTab} defaultValue={initialTab} onValueChange={(value) => setActiveTab(value as TabValue)}>
        <TabsList className="ai-composer__tabs">
          {TABS.map((tab) => (
            <Tab key={tab.value} value={tab.value}>
              {tab.label}
            </Tab>
          ))}
        </TabsList>
        <TabPanel value="selfpr">{renderEditor('selfpr', selfPrState)}</TabPanel>
        <TabPanel value="summary">{renderEditor('summary', summaryState)}</TabPanel>
      </Tabs>
      {resumeState.loading ? (
        <p className="ai-composer__status" role="status">
          履歴書情報を読み込んでいます…
        </p>
      ) : null}
      {resumeState.error ? (
        <p className="ai-composer__status ai-composer__status--error" role="alert">
          {resumeState.error}
        </p>
      ) : null}
      <style jsx>{`
        .ai-composer {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          width: 100%;
        }

        .ai-composer__tabs {
          display: inline-flex;
          gap: 0.75rem;
          border-radius: 9999px;
          padding: 0.25rem;
          background: rgba(15, 23, 42, 0.05);
        }

        .ai-composer__tabs > button {
          border: none;
          background: none;
          padding: 0.65rem 1.5rem;
          border-radius: 9999px;
          font-weight: 600;
          cursor: pointer;
          color: #475569;
        }

        .ai-composer__tabs > button[aria-selected='true'] {
          background: linear-gradient(135deg, #14b8a6, #6366f1);
          color: #fff;
        }

        .ai-editor {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          border: 1px solid rgba(148, 163, 184, 0.2);
          border-radius: 1rem;
          padding: 1.5rem;
          background: #fff;
          box-shadow: 0 10px 25px rgba(15, 23, 42, 0.08);
        }

        .ai-editor__controls {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
        }

        .ai-editor__target label {
          display: flex;
          flex-direction: column;
          font-size: 0.85rem;
          color: #334155;
          gap: 0.25rem;
        }

        .ai-editor__target select {
          min-width: 8rem;
          padding: 0.5rem 0.75rem;
          border-radius: 0.75rem;
          border: 1px solid rgba(148, 163, 184, 0.6);
          background: #f8fafc;
          color: #0f172a;
        }

        .ai-editor__hint {
          font-size: 0.85rem;
          margin: 0;
        }

        .ai-editor__hint--success {
          color: #0f766e;
        }

        .ai-editor__hint--warning {
          color: #d97706;
        }

        .ai-editor__hint--info {
          color: #475569;
        }

        .ai-editor__notice {
          padding: 0.75rem 1rem;
          border-radius: 0.75rem;
          font-size: 0.9rem;
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .ai-editor__notice--success {
          background: rgba(16, 185, 129, 0.12);
          color: #047857;
        }

        .ai-editor__notice--warning {
          background: rgba(245, 158, 11, 0.12);
          color: #b45309;
        }

        .ai-editor__notice--error {
          background: rgba(248, 113, 113, 0.12);
          color: #b91c1c;
        }

        .ai-editor__notice--info {
          background: rgba(59, 130, 246, 0.12);
          color: #1d4ed8;
        }

        .ai-editor__notice-id {
          font-size: 0.75rem;
          opacity: 0.7;
        }

        .ai-editor__loading {
          color: #475569;
          margin: 0;
        }

        .ai-editor__textarea-label {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          font-weight: 600;
          color: #1e293b;
        }

        .ai-editor__textarea-label textarea {
          border-radius: 1rem;
          border: 1px solid rgba(148, 163, 184, 0.6);
          padding: 1rem;
          resize: vertical;
          font-size: 1rem;
          line-height: 1.6;
          min-height: 12rem;
        }

        .ai-editor__textarea-label textarea:focus {
          outline: 2px solid rgba(99, 102, 241, 0.7);
          outline-offset: 2px;
        }

        .ai-editor__placeholder {
          margin: 0;
          color: #64748b;
          background: rgba(148, 163, 184, 0.12);
          padding: 1.5rem;
          border-radius: 1rem;
        }

        .ai-editor__actions {
          display: flex;
          justify-content: flex-end;
        }

        .ai-composer__status {
          margin: 0;
          font-size: 0.85rem;
          color: #475569;
        }

        .ai-composer__status--error {
          color: #b91c1c;
        }

        @media (max-width: 768px) {
          .ai-editor {
            padding: 1rem;
          }

          .ai-editor__controls {
            flex-direction: column;
            align-items: stretch;
          }

          .ai-editor__actions {
            justify-content: stretch;
          }

          .ai-editor__actions :global(.ui-button) {
            width: 100%;
          }
        }
      `}</style>
    </section>
  );
}
