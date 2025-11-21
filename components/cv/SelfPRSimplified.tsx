"use client";
import { useCallback, useEffect, useRef, useState } from "react";

import { CvQaSchema, type CvQa } from "../../lib/validation/schemas";

const STORAGE_KEY = "resume.resumeId";

// Minimal, self-contained UI for /cv/2 (Self-PR).
// No external secrets; calls server-only API via internal route.
type ResumeResponse = {
  id?: string | null;
  qa?: CvQa | null;
};

export default function SelfPRSimplified() {
  const [resumeId, setResumeId] = useState<string | null>(null);
  const resumeIdRef = useRef<string | null>(null);
  const ensureIdPromiseRef = useRef<Promise<string | null> | null>(null);
  const [q1, setQ1] = useState('');
  const [q2, setQ2] = useState('');
  const [q3, setQ3] = useState('');
  const [q4, setQ4] = useState('');
  const [preview, setPreview] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    resumeIdRef.current = resumeId;
  }, [resumeId]);

  const ensureResumeId = useCallback(async () => {
    if (resumeIdRef.current) return resumeIdRef.current;
    if (ensureIdPromiseRef.current) return ensureIdPromiseRef.current;

    ensureIdPromiseRef.current = (async () => {
      try {
        // Prefer the same localStorage slot used in the resume wizard steps.
        if (typeof window !== "undefined") {
          const stored = window.localStorage.getItem(STORAGE_KEY);
          if (stored) {
            resumeIdRef.current = stored;
            setResumeId(stored);
            return stored;
          }
        }

        const res = await fetch("/api/data/resume", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ touch: true }),
          cache: "no-store",
        });
        if (!res.ok) {
          throw new Error(`failed to ensure resume id: ${res.status}`);
        }
        const data = (await res.json()) as ResumeResponse;
        const id = typeof data.id === "string" && data.id ? data.id : null;
        if (id) {
          resumeIdRef.current = id;
          setResumeId(id);
          if (typeof window !== "undefined") {
            window.localStorage.setItem(STORAGE_KEY, id);
          }
        }
        return id;
      } catch (error) {
        console.error("Failed to ensure resume id", error);
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

  async function handleGenerate() {
    if (submitting) return;
    const ensuredId = await ensureResumeId();
    if (!ensuredId) {
      setPreview('（履歴書IDの取得に失敗しました。/resume 画面で一度保存してから再度お試しください）');
      return;
    }

    const qa: CvQa = {
      q1: q1.trim(),
      q2: q2.trim(),
      q3: q3.trim(),
      q4: q4.trim(),
    };

    const parsed = CvQaSchema.safeParse(qa);
    if (!parsed.success) {
      setPreview('（各設問は10〜600文字で入力してください）');
      return;
    }

    const body = {
      resumeId: ensuredId,
      qa: parsed.data,
    };

    setSubmitting(true);
    try {
      const res = await fetch('/api/ai/selfpr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || 'Failed to generate');
      setPreview(data?.text ?? data?.result ?? '');
    } catch (_e) {
      setPreview('（生成に失敗しました。入力内容を見直して再度お試しください）');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main
      style={{
        width: '100%',
        maxWidth: 375,
        margin: '0 auto',
        padding: '24px 16px 40px',
        boxSizing: 'border-box',
      }}
    >
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>自己PR</h1>

      {/* Q&A */}
      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Q＆A</h2>

        <label style={{ display: 'block', fontWeight: 600, margin: '8px 0' }}>
          自己の強みやPRしたいことを教えてください
        </label>
        <textarea
          value={q1}
          onChange={(e) => setQ1(e.target.value)}
          rows={3}
          style={{
            width: '100%',
            padding: 10,
            border: '1px solid #CCCCCC',
            borderRadius: 6,
            boxSizing: 'border-box',
          }}
          placeholder="例）ユーザー起点で仮説検証を回し、プロダクト改善を推進できます。"
        />

        <label style={{ display: 'block', fontWeight: 600, margin: '8px 0' }}>
          強みが生かされた具体的なエピソードを教えてください
        </label>
        <textarea
          value={q2}
          onChange={(e) => setQ2(e.target.value)}
          rows={3}
          style={{
            width: '100%',
            padding: 10,
            border: '1px solid #CCCCCC',
            borderRadius: 6,
            boxSizing: 'border-box',
          }}
          placeholder="例）新規プロダクトの立ち上げで、ユーザーインタビューを通じて価値仮説を磨き上げました。"
        />

        <label style={{ display: 'block', fontWeight: 600, margin: '8px 0' }}>
          仕事をする上で大切にしていることを、理由を含めて教えてください
        </label>
        <textarea
          value={q3}
          onChange={(e) => setQ3(e.target.value)}
          rows={3}
          style={{
            width: '100%',
            padding: 10,
            border: '1px solid #CCCCCC',
            borderRadius: 6,
            boxSizing: 'border-box',
          }}
          placeholder="例）ユーザーへの価値提供を最優先に、スピードと品質のバランスを意識しています。"
        />

        <label style={{ display: 'block', fontWeight: 600, margin: '8px 0' }}>
          希望している職種を教えてください
        </label>
        <textarea
          value={q4}
          onChange={(e) => setQ4(e.target.value)}
          rows={2}
          style={{
            width: '100%',
            padding: 10,
            border: '1px solid #CCCCCC',
            borderRadius: 6,
            boxSizing: 'border-box',
          }}
          placeholder="例）プロダクトマネージャー、もしくはそれに準ずるポジション"
        />
      </section>

      {/* AI Generate button */}
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
            boxSizing: 'border-box',
          }}
          aria-busy={submitting}
        >
          {submitting ? '生成中…' : 'AIで自己PRを生成'}
        </button>
      </section>

      {/* Preview */}
      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>プレビュー</h2>
        <textarea
          value={preview}
          readOnly
          rows={10}
          style={{
            width: '100%',
            padding: 10,
            border: '1px solid #CCCCCC',
            borderRadius: 6,
          }}
          placeholder="ここに生成結果が表示されます"
        />
      </section>

      {/* Next */}
      <nav>
        <a
          href="/cv/3"
          style={{
            display: 'block',
            width: '100%',
            textAlign: 'center',
            padding: '12px 0',
            borderRadius: 8,
            background: '#3A75C4',
            color: '#FFFFFF',
            fontWeight: 700,
            textDecoration: 'none',
          }}
        >
          履歴書の生成
        </a>
      </nav>
    </main>
  );
}
