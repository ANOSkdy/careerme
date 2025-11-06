'use client';
import { Suspense, useEffect, useMemo, useState, useTransition } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

type SelfPrPayload = {
  resumeId: string;
  role?: string;
  years?: number;
  skills?: string[];
  achievements?: string[];
  tone?: 'business' | 'friendly' | 'formal';
  extraNotes?: string;
};

export default function CVStep2() {
  return (
    <Suspense fallback={<section>読み込み中...</section>}>
      <CVStep2Inner />
    </Suspense>
  );
}

function CVStep2Inner() {
  const params = useSearchParams();
  const [resumeId, setResumeId] = useState('');
  const [role, setRole] = useState('');
  const [years, setYears] = useState<number | ''>('');
  const [skills, setSkills] = useState('');
  const [achievements, setAchievements] = useState('');
  const [tone, setTone] = useState<'business' | 'friendly' | 'formal'>('business');
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
    const payload: SelfPrPayload = {
      resumeId,
      role: role || undefined,
      years: years === '' ? undefined : Number(years),
      skills: skills.split(',').map((s) => s.trim()).filter(Boolean),
      achievements: achievements.split('\n').map((s) => s.trim()).filter(Boolean),
      tone,
      extraNotes: extra || undefined,
    };
    startTransition(async () => {
      setSaved(null);
      setResult('');
      try {
        const res = await fetch('/api/ai/selfpr', {
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
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Step 2 — 自己PRの生成</h2>
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
          <label style={{ minWidth: 120 }}>Skills (comma)</label>
          <input value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="React, Next.js, Node.js" style={{ flex: 1, padding: 8, border: '1px solid #ccc', borderRadius: 6 }} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <label style={{ minWidth: 120, paddingTop: 8 }}>Achievements</label>
          <textarea value={achievements} onChange={(e) => setAchievements(e.target.value)} placeholder={'Line1\nLine2'} style={{ flex: 1, minHeight: 96, padding: 8, border: '1px solid #ccc', borderRadius: 6 }} />
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label style={{ minWidth: 120 }}>Tone</label>
          <select value={tone} onChange={(e) => setTone(e.target.value as typeof tone)} style={{ width: 200, padding: 8, border: '1px solid #ccc', borderRadius: 6 }}>
            <option value="business">business</option>
            <option value="friendly">friendly</option>
            <option value="formal">formal</option>
          </select>
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
          {isPending ? 'Generating…' : 'AIで自己PRを生成'}
        </button>
        <Link href="/cv/3"><span style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #999' }}>次へ（Step 3）</span></Link>
      </div>
      {result && (
        <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Result</div>
          <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{result}</p>
          <div style={{ marginTop: 8, color: saved ? '#0a0' : '#555' }}>
            {saved === null ? null : saved ? 'Saved to Airtable (selfpr_draft)' : 'Not saved (see API response).'}
          </div>
        </div>
      )}
    </section>
  );
}
