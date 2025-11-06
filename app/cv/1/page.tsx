'use client';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

export default function CVStep1() {
  return (
    <Suspense fallback={<section>読み込み中...</section>}>
      <CVStep1Inner />
    </Suspense>
  );
}

function CVStep1Inner() {
  const params = useSearchParams();
  const [resumeId, setResumeId] = useState('');
  const idFromUrl = params.get('id') || '';

  useEffect(() => {
    const ls = typeof window !== 'undefined' ? window.localStorage.getItem('resumeId') : '';
    const nextId = idFromUrl || ls || '';
    if (nextId) {
      setResumeId(nextId);
      if (typeof window !== 'undefined') window.localStorage.setItem('resumeId', nextId);
    }
  }, [idFromUrl]);

  const canContinue = useMemo(() => !!resumeId, [resumeId]);

  return (
    <section>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Step 1 — 基本設定</h2>
      <p style={{ marginBottom: 12 }}>
        `resumeId` を設定してください。URL の <code>?id=</code> から自動取得できます。
      </p>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
        <label htmlFor="rid" style={{ minWidth: 90 }}>resumeId</label>
        <input
          id="rid"
          value={resumeId}
          onChange={(e) => setResumeId(e.target.value)}
          placeholder="recXXXXXXXXXXXXXX"
          style={{ flex: 1, padding: 8, border: '1px solid #ccc', borderRadius: 6 }}
        />
        <button
          onClick={() => {
            if (resumeId && typeof window !== 'undefined') {
              window.localStorage.setItem('resumeId', resumeId);
              alert('Saved.');
            }
          }}
          style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #999' }}
        >
          Save
        </button>
      </div>
      <p style={{ color: '#555', marginBottom: 16 }}>
        次へ進むと、自己PR/職務要約の生成フォームが表示されます。
      </p>
      <div style={{ display: 'flex', gap: 12 }}>
        <Link href="/cv/2" aria-disabled={!canContinue} style={{ pointerEvents: canContinue ? 'auto' : 'none' }}>
          <span style={{
            padding: '10px 14px', borderRadius: 6, background: canContinue ? '#4A90E2' : '#9fbbe0',
            color: '#fff', display: 'inline-block'
          }}>次へ（Step 2）</span>
        </Link>
      </div>
    </section>
  );
}
