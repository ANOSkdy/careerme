'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

export default function Step1Client() {
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
      <h2 className="cv-kicker">Step 1</h2>
      <div className="cv-card">
        <h3>基本設定</h3>
        <p style={{ marginBottom: 12 }}>
          <code>resumeId</code> を設定してください。URL の <code>?id=</code> から自動取得できます。
        </p>
        <div className="cv-field">
          <label htmlFor="rid" className="cv-label">
            resumeId
          </label>
          <input
            id="rid"
            className="cv-input"
            value={resumeId}
            onChange={(e) => setResumeId(e.target.value)}
            placeholder="recXXXXXXXXXXXXXX"
          />
          <button
            className="cv-btn ghost"
            onClick={() => {
              if (resumeId && typeof window !== 'undefined') {
                window.localStorage.setItem('resumeId', resumeId);
                alert('Saved.');
              }
            }}
          >
            Save
          </button>
        </div>
        <p style={{ color: 'var(--cv-muted)', marginTop: 10 }}>
          次へ進むと、自己PR/職務要約の生成フォームが表示されます。
        </p>
        <div className="cv-row" style={{ marginTop: 12 }}>
          <Link href="/cv/2" aria-disabled={!canContinue} style={{ pointerEvents: canContinue ? 'auto' : 'none' }}>
            <span className="cv-btn primary">次へ（Step 2）</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
