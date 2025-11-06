'use client';

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

type SummaryPayload = {
  resumeId: string;
  role?: string;
  years?: number;
  headlineKeywords?: string[];
  extraNotes?: string;
};

type ResumeInfo = {
  selfpr_draft?: string;
  summary_draft?: string;
  source_env?: string;
  pr_ref?: string;
};

export default function Step3Client() {
  const params = useSearchParams();
  const [resumeId, setResumeId] = useState('');
  const [role, setRole] = useState('');
  const [years, setYears] = useState<number | ''>('');
  const [keywords, setKeywords] = useState('');
  const [extra, setExtra] = useState('');
  const [result, setResult] = useState('');
  const [saved, setSaved] = useState<boolean | null>(null);
  const [isPending, startTransition] = useTransition();
  const [, syncResumeTransition] = useTransition();
  const [serverState, setServerState] = useState<ResumeInfo>({});
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    const idFromUrl = params.get('id') || '';
    const ls = typeof window !== 'undefined' ? window.localStorage.getItem('resumeId') : '';
    const nextId = idFromUrl || ls || '';
    if (nextId) {
      syncResumeTransition(() => {
        setResumeId(nextId);
      });
      if (typeof window !== 'undefined') window.localStorage.setItem('resumeId', nextId);
    }
  }, [params, syncResumeTransition]);

  const loadFromServer = useCallback(
    async (idValue?: string) => {
      const targetId = idValue ?? resumeId;
      if (!targetId) return;
      setIsRefreshing(true);
      try {
        const res = await fetch(`/api/data/resumes/${encodeURIComponent(targetId)}`);
        const data = await res.json();
        if (data?.ok) {
          setServerState(data.fields || {});
        } else {
          setServerState({});
        }
      } catch (error) {
        console.error('Failed to load server data', error);
      } finally {
        setIsRefreshing(false);
      }
    },
    [resumeId],
  );

  useEffect(() => {
    loadFromServer();
  }, [loadFromServer]);

  const canGenerate = useMemo(() => !!resumeId, [resumeId]);

  const doGenerate = () => {
    if (!resumeId) {
      alert('resumeId is required. 上のフィールドに入力してください。');
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
          await loadFromServer(resumeId);
        } else {
          setResult('');
          setSaved(false);
          alert(data?.error?.message || 'Generation failed');
        }
      } catch (error) {
        console.error(error);
        setResult('');
        setSaved(false);
        alert('Network error');
      }
    });
  };

  return (
    <section>
      <h2 className="cv-kicker">Step 3</h2>
      {!resumeId && (
        <p style={{ color: '#b00', marginBottom: 12 }}>
          resumeId が未設定です。上のフィールドに入力してください。
        </p>
      )}
      <div className="cv-card" style={{ marginBottom: 16 }}>
        <h3>職務要約の生成</h3>
        <div className="cv-field">
          <label className="cv-label">resumeId</label>
          <input
            className="cv-input"
            value={resumeId}
            onChange={(e) => {
              setResumeId(e.target.value);
              if (typeof window !== 'undefined') window.localStorage.setItem('resumeId', e.target.value);
            }}
            placeholder="recXXXXXXXXXXXXXX"
          />
        </div>
        <div className="cv-field">
          <label className="cv-label">Role</label>
          <input className="cv-input" value={role} onChange={(e) => setRole(e.target.value)} />
        </div>
        <div className="cv-field">
          <label className="cv-label">Years</label>
          <input
            className="cv-input"
            type="number"
            value={years}
            onChange={(e) => setYears(e.target.value === '' ? '' : Number(e.target.value))}
          />
        </div>
        <div className="cv-field">
          <label className="cv-label">Keywords (comma)</label>
          <input
            className="cv-input"
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            placeholder="leadership, DX, KPI"
          />
        </div>
        <div className="cv-field" style={{ alignItems: 'flex-start' }}>
          <label className="cv-label" style={{ paddingTop: 8 }}>Extra notes</label>
          <textarea className="cv-textarea" value={extra} onChange={(e) => setExtra(e.target.value)} />
        </div>
        <div className="cv-row" style={{ marginTop: 16 }}>
          <button className="cv-btn primary" onClick={doGenerate} disabled={!canGenerate || isPending}>
            {isPending ? 'Generating…' : 'AIで職務要約を生成'}
          </button>
          <Link href={resumeId ? { pathname: '/cv/2', query: { id: resumeId } } : '/cv/2'}>
            <span className="cv-btn">戻る（Step 2）</span>
          </Link>
          <button className="cv-btn ghost" onClick={() => loadFromServer()} disabled={!resumeId || isRefreshing}>
            {isRefreshing ? '更新中…' : 'サーバから再読込'}
          </button>
        </div>
      </div>
      {result && (
        <div className="cv-card" style={{ marginBottom: 16 }}>
          <h3>生成結果（この画面の反映）</h3>
          <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{result}</p>
          <div style={{ marginTop: 8, color: saved ? '#0a0' : 'var(--cv-muted)' }}>
            {saved === null
              ? null
              : saved
              ? 'Saved to Airtable (summary_draft)'
              : 'Not saved (see API response).'}
          </div>
        </div>
      )}
      <div className="cv-card">
        <h3>サーバ保存値（検証用）</h3>
        <p style={{ color: 'var(--cv-muted)', marginTop: 0, marginBottom: 8 }}>
          env: {serverState.source_env || '-'} / ref: {serverState.pr_ref || '-'}
        </p>
        <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, margin: 0 }}>
          {serverState.summary_draft || '（保存なし）'}
        </p>
      </div>
    </section>
  );
}
