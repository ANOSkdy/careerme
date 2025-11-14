'use client';
import { useState } from 'react';

export default function SummarySimplified() {
  const [preview, setPreview] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleGenerate() {
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/ai/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || 'Failed to generate');
      setPreview(data?.text ?? data?.result ?? '');
    } catch (_error) {
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
