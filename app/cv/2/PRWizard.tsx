'use client';

import { useRouter } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FocusEvent,
} from 'react';

import { CvQaSchema, type CvQa } from '../../../lib/validation/schemas';

type QuestionKey = keyof CvQa;
type QaState = Record<QuestionKey, string>;
type ToastState = { message: string; variant: 'success' | 'error' | 'info' };
type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';
type SaveOptions = { skipIfUnchanged?: boolean };
type ResumeResponse = {
  id?: string | null;
  qa?: CvQa | null;
};

const MIN_MESSAGE = '10文字以上で入力してください';
const MAX_MESSAGE = '600文字以内で入力してください';
const MIN_LENGTH = 10;
const MAX_LENGTH = 600;

const QUESTIONS: Array<{
  key: QuestionKey;
  label: string;
  description: string;
  placeholder: string;
}> = [
  {
    key: 'q1',
    label: 'Q1. あなたの強み・自己PR',
    description: '得意領域や周囲から評価されているポイントを具体的に記載してください。',
    placeholder:
      '例：SaaSプロダクトのPdMとして、課題発見からグロース施策まで横断的にリードし、機能改善で解約率を15%改善しました。',
  },
  {
    key: 'q2',
    label: 'Q2. 強みを示すエピソード',
    description: '強みが発揮された出来事を、背景・取り組み・成果の順で簡潔にまとめてください。',
    placeholder:
      '例：顧客ヒアリングから課題を特定し、スクラム体制を立て直してリリースサイクルを半減させた経験など。',
  },
  {
    key: 'q3',
    label: 'Q3. 仕事で大切にしていることと理由',
    description: '価値観や意思決定の基準となる考え方、その理由を教えてください。',
    placeholder:
      '例：ユーザー価値の最大化を最優先に考え、データと定性インサイトの両面で意思決定するよう心掛けています。',
  },
  {
    key: 'q4',
    label: 'Q4. 希望する役割',
    description: '今後チャレンジしたい職種や役割、関わりたい領域を記載してください。',
    placeholder:
      '例：事業戦略と連動したプロダクトマネジメント全体をリードし、組織横断での推進役を担いたいです。',
  },
];

const EMPTY_QA: QaState = {
  q1: '',
  q2: '',
  q3: '',
  q4: '',
};

const EMPTY_TOUCHED: Record<QuestionKey, boolean> = {
  q1: false,
  q2: false,
  q3: false,
  q4: false,
};

const EMPTY_ERRORS: Record<QuestionKey, string | undefined> = {
  q1: undefined,
  q2: undefined,
  q3: undefined,
  q4: undefined,
};

function sanitizeQa(values: QaState): CvQa {
  return {
    q1: values.q1.trim(),
    q2: values.q2.trim(),
    q3: values.q3.trim(),
    q4: values.q4.trim(),
  } as CvQa;
}

function getFieldError(value: string): string | undefined {
  const length = value.trim().length;
  if (!length || length < MIN_LENGTH) {
    return MIN_MESSAGE;
  }
  if (length > MAX_LENGTH) {
    return MAX_MESSAGE;
  }
  return undefined;
}

export default function PRWizard() {
  const router = useRouter();
  const [qa, setQa] = useState<QaState>(EMPTY_QA);
  const [touched, setTouched] = useState<Record<QuestionKey, boolean>>(EMPTY_TOUCHED);
  const [errors, setErrors] = useState<Record<QuestionKey, string | undefined>>(EMPTY_ERRORS);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [resumeId, setResumeId] = useState<string | null>(null);

  const qaRef = useRef<QaState>(EMPTY_QA);
  const lastSavedSnapshot = useRef<string>(JSON.stringify(sanitizeQa(EMPTY_QA)));
  const resumeIdRef = useRef<string | null>(null);
  const ensureIdPromiseRef = useRef<Promise<string | null> | null>(null);

  useEffect(() => {
    qaRef.current = qa;
  }, [qa]);

  useEffect(() => {
    resumeIdRef.current = resumeId;
  }, [resumeId]);

  useEffect(() => {
    if (saveStatus !== 'saved') return undefined;
    const timer = window.setTimeout(() => setSaveStatus('idle'), 2000);
    return () => window.clearTimeout(timer);
  }, [saveStatus]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(timer);
  }, [toast]);

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

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    setIsLoading(true);

    (async () => {
      try {
        const res = await fetch('/api/data/resume', {
          cache: 'no-store',
          signal: controller.signal,
        });
        if (!res.ok) {
          throw new Error(`failed to load resume QA: ${res.status}`);
        }
        const data = (await res.json()) as ResumeResponse;
        if (cancelled) return;

        const id = typeof data.id === 'string' && data.id ? data.id : null;
        if (id) {
          resumeIdRef.current = id;
          setResumeId(id);
        }

        if (data.qa) {
          const parsed = CvQaSchema.safeParse(data.qa);
          if (parsed.success) {
            setQa(parsed.data);
            qaRef.current = parsed.data;
            lastSavedSnapshot.current = JSON.stringify(sanitizeQa(parsed.data));
            setTouched(EMPTY_TOUCHED);
            setErrors(EMPTY_ERRORS);
          }
        } else {
          setQa(EMPTY_QA);
          qaRef.current = EMPTY_QA;
          lastSavedSnapshot.current = JSON.stringify(sanitizeQa(EMPTY_QA));
          setTouched(EMPTY_TOUCHED);
          setErrors(EMPTY_ERRORS);
        }

        setSaveStatus('idle');
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          console.error('Failed to load resume QA', error);
          setToast(null);
          setSaveStatus('error');
          setQa(EMPTY_QA);
          qaRef.current = EMPTY_QA;
          lastSavedSnapshot.current = JSON.stringify(sanitizeQa(EMPTY_QA));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }

      if (!cancelled && !resumeIdRef.current) {
        await ensureResumeId();
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [ensureResumeId]);

  const saveQa = useCallback(
    async (values: QaState, options: SaveOptions = {}) => {
      const sanitized = sanitizeQa(values);
      const snapshot = JSON.stringify(sanitized);
      if (options.skipIfUnchanged && snapshot === lastSavedSnapshot.current) {
        return true;
      }

      const ensuredId = await ensureResumeId();
      if (!ensuredId) {
        setSaveStatus('error');
        return false;
      }

      setSaveStatus('saving');
      try {
        const res = await fetch('/api/data/resume', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ id: ensuredId, qa: sanitized }),
          cache: 'no-store',
        });
        if (!res.ok) {
          const detail = await res.text();
          throw new Error(detail || `Failed to save QA (${res.status})`);
        }
        lastSavedSnapshot.current = snapshot;
        setSaveStatus('saved');
        setResumeId(ensuredId);
        resumeIdRef.current = ensuredId;
        return true;
      } catch (error) {
        console.error('Failed to save QA', error);
        setSaveStatus('error');
        return false;
      }
    },
    [ensureResumeId],
  );

  const handleTextareaChange = useCallback(
    (key: QuestionKey) => (event: ChangeEvent<HTMLTextAreaElement>) => {
      const { value } = event.target;
      setQa((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const handleTextareaBlur = useCallback(
    (key: QuestionKey) => (event: FocusEvent<HTMLTextAreaElement>) => {
      setTouched((prev) => ({ ...prev, [key]: true }));
      const message = getFieldError(event.target.value);
      setErrors((prev) => ({ ...prev, [key]: message }));
      void saveQa(qaRef.current, { skipIfUnchanged: true });
    },
    [saveQa],
  );

  const handleGenerate = useCallback(async () => {
    const ensuredId = await ensureResumeId();
    if (!ensuredId) {
      setToast({
        message: '下書きIDの確保に失敗しました。時間をおいて再試行してください。',
        variant: 'error',
      });
      return;
    }
    const sanitized = sanitizeQa(qaRef.current);
    const parsed = CvQaSchema.safeParse(sanitized);
    if (!parsed.success) {
      const issues = parsed.error.issues;
      const nextErrors: Record<QuestionKey, string | undefined> = { ...EMPTY_ERRORS };
      for (const issue of issues) {
        const pathKey = issue.path[0];
        if (typeof pathKey === 'string' && pathKey in nextErrors) {
          nextErrors[pathKey as QuestionKey] = issue.message.includes('600')
            ? MAX_MESSAGE
            : MIN_MESSAGE;
        }
      }
      setErrors(nextErrors);
      setTouched({ q1: true, q2: true, q3: true, q4: true });
      setToast({ message: '各設問は10〜600文字で入力してください。', variant: 'error' });
      return;
    }

    setIsGenerating(true);
    await saveQa(parsed.data, { skipIfUnchanged: false });

    try {
      const res = await fetch('/api/ai/selfpr', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ resumeId: ensuredId, qa: parsed.data }),
        cache: 'no-store',
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        const message = data?.error?.message ?? '生成に失敗しました。時間をおいて再試行してください。';
        throw new Error(message);
      }
      if (data.warn && !data.saved) {
        console.warn('Self PR saved with warning:', data.warn);
      }
      setToast({ message: '生成しました。/cv/3で確認できます。', variant: 'success' });
    } catch (error) {
      console.error('Failed to generate self PR', error);
      const message =
        error instanceof Error ? error.message : '生成に失敗しました。時間をおいて再試行してください。';
      setToast({ message, variant: 'error' });
    } finally {
      setIsGenerating(false);
    }
  }, [ensureResumeId, saveQa]);

  const handleNext = useCallback(async () => {
    const sanitized = sanitizeQa(qaRef.current);
    const parsed = CvQaSchema.safeParse(sanitized);
    if (!parsed.success) {
      const issues = parsed.error.issues;
      const nextErrors: Record<QuestionKey, string | undefined> = { ...EMPTY_ERRORS };
      for (const issue of issues) {
        const pathKey = issue.path[0];
        if (typeof pathKey === 'string' && pathKey in nextErrors) {
          nextErrors[pathKey as QuestionKey] = issue.message.includes('600')
            ? MAX_MESSAGE
            : MIN_MESSAGE;
        }
      }
      setErrors(nextErrors);
      setTouched({ q1: true, q2: true, q3: true, q4: true });
      return;
    }

    const saved = await saveQa(parsed.data, { skipIfUnchanged: false });
    if (saved) {
      router.push('/cv/3');
    }
  }, [router, saveQa]);

  const isGenerateDisabled = isGenerating || isLoading;

  return (
    <section>
      <h2 className="cv-kicker">自己PR – Q&amp;A</h2>
      
      <div className="cv-card" style={{ marginBottom: 16 }}>
        {isLoading ? <p style={{ marginBottom: 16 }}>読み込み中です…</p> : null}
        {QUESTIONS.map(({ key, label, description, placeholder }) => {
          const errorMessage = errors[key];
          const showError = Boolean(errorMessage && touched[key]);
          return (
            <div className="cv-field" key={key} style={{ alignItems: 'flex-start' }}>
              <label className="cv-label" htmlFor={key} style={{ paddingTop: 8 }}>
                <span style={{ display: 'block', fontWeight: 600 }}>{label}</span>
                <span style={{ display: 'block', fontSize: 12, color: '#555', marginTop: 4 }}>
                  {description}
                </span>
              </label>
              <textarea
                id={key}
                className="cv-textarea"
                rows={6}
                value={qa[key]}
                placeholder={placeholder}
                onChange={handleTextareaChange(key)}
                onBlur={handleTextareaBlur(key)}
                aria-invalid={showError}
                aria-describedby={showError ? `${key}-error` : undefined}
              />
              {showError ? (
                <p
                  id={`${key}-error`}
                  role="alert"
                  style={{ color: '#b20000', fontSize: 12, marginTop: 4 }}
                >
                  {errorMessage}
                </p>
              ) : null}
            </div>
          );
        })}
        <div
          className="cv-row"
          style={{ justifyContent: 'flex-end', gap: 12, marginTop: 24, flexWrap: 'wrap' }}
        >
          <button
            type="button"
            className="cv-btn"
            data-variant="ai"
            onClick={handleGenerate}
            disabled={isGenerateDisabled}
          >
            {isGenerating ? '生成中…' : 'AIで自己PRを生成'}
          </button>
          <button type="button" className="cv-btn primary" onClick={handleNext}>
            履歴書の生成
          </button>
        </div>
        <div role="status" aria-live="polite" style={{ fontSize: 12, marginTop: 12 }}>
          {saveStatus === 'saving' && <span>保存中…</span>}
          {saveStatus === 'saved' && <span style={{ color: '#0a7' }}>保存しました。</span>}
          {saveStatus === 'error' && null}
        </div>
      </div>
      {toast ? (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed',
            right: 24,
            bottom: 24,
            background: toast.variant === 'success' ? '#0a7' : toast.variant === 'error' ? '#b20000' : '#333',
            color: '#fff',
            padding: '12px 16px',
            borderRadius: 8,
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)',
            maxWidth: 320,
            fontSize: 14,
            zIndex: 1000,
          }}
        >
          {toast.message}
        </div>
      ) : null}
    </section>
  );
}
