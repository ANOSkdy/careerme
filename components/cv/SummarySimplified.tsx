"use client";
import { useCallback, useEffect, useRef, useState } from "react";

const STORAGE_KEY = "resume.resumeId";

type ResumeResponse = {
  id?: string | null;
  summary?: string | null;
};

type SummaryResponse = {
  ok?: boolean;
  text?: string;
  result?: string;
  warn?: string;
  error?: {
    message?: string;
  } | null;
};

export default function SummarySimplified() {
  const [preview, setPreview] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [desiredRole, setDesiredRole] = useState('');
  const [yearsInput, setYearsInput] = useState('');
  const [keywordsInput, setKeywordsInput] = useState('');
  const [extraNotes, setExtraNotes] = useState('');

  const [resumeId, setResumeId] = useState<string | null>(null);
  const resumeIdRef = useRef<string | null>(null);
  const ensureIdPromiseRef = useRef<Promise<string | null> | null>(null);

  useEffect(() => {
    resumeIdRef.current = resumeId;
  }, [resumeId]);

  const ensureResumeId = useCallback(async () => {
    if (resumeIdRef.current) return resumeIdRef.current;
    if (ensureIdPromiseRef.current) return ensureIdPromiseRef.current;

    ensureIdPromiseRef.current = (async () => {
      try {
        if (typeof window !== 'undefined') {
          const stored = window.localStorage.getItem(STORAGE_KEY);
          if (stored) {
            resumeIdRef.current = stored;
            setResumeId(stored);
            return stored;
          }
        }

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
          if (typeof window !== 'undefined') {
            window.localStorage.setItem(STORAGE_KEY, id);
          }
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
    void ensureResumeId();
  }, [ensureResumeId]);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch('/api/data/resume', { cache: 'no-store', signal: controller.signal });
        if (!res.ok) {
          throw new Error(`failed to load resume summary: ${res.status}`);
        }
        const data = (await res.json()) as ResumeResponse;
        if (cancelled) return;

        const id = typeof data.id === 'string' && data.id ? data.id : null;
        if (id) {
          resumeIdRef.current = id;
          setResumeId(id);
          if (typeof window !== 'undefined') {
            window.localStorage.setItem(STORAGE_KEY, id);
          }
        }

        if (typeof data.summary === 'string' && data.summary.trim().length > 0) {
          setPreview(data.summary);
        }
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          console.error('Failed to load summary', error);
        }
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  async function handleGenerate() {
    if (submitting) return;
    const ensuredId = await ensureResumeId();
    if (!ensuredId) {
      setPreview('（履歴書IDの取得に失敗しました。/resume 画面で一度保存してから再度お試しください）');
      return;
    }

    const parsedYears = yearsInput.trim() ? Number(yearsInput.trim()) : NaN;
    const years = Number.isFinite(parsedYears) && parsedYears >= 0 ? parsedYears : undefined;
    const headlineKeywords = keywordsInput
      .split(/[,\n]/)
      .map((keyword) => keyword.trim())
      .filter(Boolean);

    const body = {
      resumeId: ensuredId,
      locale: 'ja',
      role: desiredRole.trim() || undefined,
      years,
      headlineKeywords: headlineKeywords.length ? headlineKeywords : undefined,
      extraNotes: extraNotes.trim() || undefined,
    };

    setSubmitting(true);
    try {
      const res = await fetch('/api/ai/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as SummaryResponse;
      if (!res.ok || !data?.ok) {
        const detail = data?.error?.message;
        console.error('Failed to generate summary', detail || data);
        setPreview('（生成に失敗しました。入力内容を見直して再度お試しください）');
        return;
      }

      if (data.warn) {
        console.warn('Summary saved with warning:', data.warn);
      }

      setPreview(data?.text ?? data?.result ?? '');
    } catch (error) {
      console.error('Failed to generate summary', error);
      setPreview('（生成に失敗しました。入力内容を見直して再度お試しください）');
    } finally {
      setSubmitting(false);
    }
  }

  function handlePdf() {
    try {
      window.open('/api/pdf', '_blank', 'noopener,noreferrer');
    } catch (_error) {
      // noop
    }
  }

  return (
    <main
      style={{
        width: '100%',
        minHeight: '100vh',
        margin: 0,
        padding: '24px 16px 120px',
        boxSizing: 'border-box',
        backgroundColor: '#F7F9FC',
      }}
    >
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>職務要約</h1>

      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>AI への指示（任意）</h2>
        <div style={{ display: 'grid', gap: 12 }}>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontWeight: 600 }}>希望している職種</span>
            <input
              type="text"
              value={desiredRole}
              onChange={(event) => setDesiredRole(event.target.value)}
              placeholder="例）プロダクトマネージャー"
              style={{
                width: '100%',
                padding: 10,
                border: '1px solid #CCCCCC',
                borderRadius: 6,
                boxSizing: 'border-box',
              }}
            />
          </label>

          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontWeight: 600 }}>経験年数</span>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              value={yearsInput}
              onChange={(event) => setYearsInput(event.target.value)}
              placeholder="例）5"
              style={{
                width: '100%',
                padding: 10,
                border: '1px solid #CCCCCC',
                borderRadius: 6,
                boxSizing: 'border-box',
              }}
            />
          </label>

          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontWeight: 600 }}>含めたいキーワード（カンマ/改行区切り）</span>
            <textarea
              value={keywordsInput}
              onChange={(event) => setKeywordsInput(event.target.value)}
              rows={2}
              placeholder="例）BtoB SaaS, プロダクト戦略, アジャイル開発"
              style={{
                width: '100%',
                padding: 10,
                border: '1px solid #CCCCCC',
                borderRadius: 6,
                boxSizing: 'border-box',
              }}
            />
          </label>

          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontWeight: 600 }}>補足情報</span>
            <textarea
              value={extraNotes}
              onChange={(event) => setExtraNotes(event.target.value)}
              rows={3}
              placeholder="例）AI 生成後に語尾を敬体に統一してください"
              style={{
                width: '100%',
                padding: 10,
                border: '1px solid #CCCCCC',
                borderRadius: 6,
                boxSizing: 'border-box',
              }}
            />
          </label>
        </div>
      </section>

      <section style={{ marginBottom: 24 }}>
        <button
          onClick={handleGenerate}
          disabled={submitting}
          style={{
            width: '100%',
            padding: '12px 0',
            borderRadius: 8,
            border: 'none',
            color: '#FFFFFF',
            background: 'linear-gradient(to right, #3A75C4, #669EE8)',
            fontWeight: 700,
          }}
          aria-busy={submitting}
        >
          {submitting ? '生成中…' : 'AIで要約を生成'}
        </button>
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>プレビュー</h2>
        <textarea
          value={preview}
          readOnly
          rows={12}
          style={{
            width: '100%',
            padding: 10,
            border: '1px solid #CCCCCC',
            borderRadius: 6,
            backgroundColor: '#FFFFFF',
            resize: 'none',
          }}
          placeholder="ここに生成結果が表示されます"
        />
      </section>

      <nav
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          padding: '12px 16px',
          background: '#FFFFFF',
          boxShadow: '0 -2px 8px rgba(0,0,0,0.08)',
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <button
          onClick={handlePdf}
          style={{
            width: 'min(480px, 100%)',
            textAlign: 'center',
            padding: '12px 0',
            borderRadius: 8,
            border: 'none',
            background: '#3A75C4',
            color: '#FFFFFF',
            fontWeight: 700,
            boxShadow: '0 4px 10px rgba(58, 117, 196, 0.25)',
          }}
          aria-label="職務経歴書の生成"
        >
          職務経歴書の生成
        </button>
      </nav>
    </main>
  );
}
