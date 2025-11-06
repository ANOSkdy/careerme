'use client';
import { Suspense, useEffect, useMemo, useState, useTransition } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

type SummaryPayload = {
  resumeId: string;
  role?: string;
  years?: number;
  headlineKeywords?: string[];
  extraNotes?: string;
};

export default function CVStep3() {
  return (
    <Suspense fallback={<section>読み込み中...</section>}>
      <CVStep3Inner />
    </Suspense>
  );
}

function CVStep3Inner() {
  const params = useSearchParams();
  const [resumeId, setResumeId] = useState('');
  const [role, setRole] = useState('');
  const [years, setYears] = useState<number | ''>('');
  const [keywords, setKeywords] = useState('');
  const [extra, setExtra] = useState('');
  const [result, setResult] = useState('');
  const [saved, setSaved] = useState<boolean | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const idFromUrl = params.get('id') || '';
    const ls = typeof window !== 'undefined' ? window.localStorage.getItem('resumeId') : '';
    const nextId = idFromUrl || ls || '';
    if (nextId) {
      setResumeId(nextId);
      if (typeof window !== 'undefined') window.localStorage.setItem('resumeId', nextId);
    }
  }, [params]);

  const canGenerate = useMemo(() => !!resumeId, [resumeId]);

  const doGenerate = () => {
    if (!resumeId) {
      alert('resumeId is required. Set it on Step 1.');
      return;
    }
    const payload: SummaryPayload = {
      resumeId,
      role: role || undefined,
      years: years === '' ? undefined : Number(years),
      headlineKeywords: keywords.split(',').map((s) => s.trim()).filter(Boolean),
      extraNotes: extra || undefined,
    };
    startTransition(async () => {
      setSaved(null);
      setResult('');
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
        } else {
          setResult('');
          setSaved(false);
          alert(data?.error?.message || 'Generation failed');
        }
      } catch (error) {
        setResult('');
        setSaved(false);
        alert('Network error');
      }
    });
  };

  return (
    <section>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Step 3 — 職務要約の生成</h2>
      {!resumeId && (
        <p style={{ color: '#b00', marginBottom: 12 }}>
          resumeId が未設定です。<Link href="/cv/1">Step 1</Link> で設定してください。
        </p>
      )}
      <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label style={{ minWidth: 120 }}>resumeId</label>
          <input
            value={resumeId}
            onChange={(e) => {
              setResumeId(e.target.value);
              if (typeof window !== 'undefined') window.localStorage.setItem('resumeId', e.target.value);
            }}
            placeholder="recXXXXXXXXXXXXXX"
            style={{ flex: 1, padding: 8, border: '1px solid #ccc', borderRadius: 6 }}
          />
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label style={{ minWidth: 120 }}>Role</label>
          <input value={role} onChange={(e) => setRole(e.target.value)} style={{ flex: 1, padding: 8, border: '1px solid #ccc', borderRadius: 6 }} />
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label style={{ minWidth: 120 }}>Years</label>
          <input type="number" value={years} onChange={(e) => setYears(e.target.value === '' ? '' : Number(e.target.value))} style={{ width: 160, padding: 8, border: '1px solid #ccc', borderRadius: 6 }} />
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label style={{ minWidth: 120 }}>Keywords (comma)</label>
          <input value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="leadership, DX, KPI" style={{ flex: 1, padding: 8, border: '1px solid #ccc', borderRadius: 6 }} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <label style={{ minWidth: 120, paddingTop: 8 }}>Extra notes</label>
          <textarea value={extra} onChange={(e) => setExtra(e.target.value)} style={{ flex: 1, minHeight: 72, padding: 8, border: '1px solid #ccc', borderRadius: 6 }} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
        <button
          onClick={doGenerate}
          disabled={!canGenerate || isPending}
          style={{ padding: '10px 14px', borderRadius: 6, border: '1px solid #999', background: '#4A90E2', color: '#fff' }}
        >
          {isPending ? 'Generating…' : 'AIで職務要約を生成'}
        </button>
        <Link href="/cv/2"><span style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #999' }}>戻る（Step 2）</span></Link>
      </div>
      {result && (
        <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Result</div>
          <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{result}</p>
          <div style={{ marginTop: 8, color: saved ? '#0a0' : '#555' }}>
            {saved === null ? null : saved ? 'Saved to Airtable (summary_draft)' : 'Not saved (see API response).'}
          </div>
        </div>
      )}
    </section>
  );
}
