'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
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

type ResumeSnapshot = {
  selfPr?: string;
  summary?: string;
};

type ResumeResponse = {
  id?: string | null;
  selfPr?: string | null;
  summary?: string | null;
};

export default function Step2Client() {
  const [resumeId, setResumeId] = useState<string | null>(null);
  const resumeIdRef = useRef<string | null>(null);
  const ensureIdPromiseRef = useRef<Promise<string | null> | null>(null);

  const [role, setRole] = useState('');
  const [years, setYears] = useState<number | ''>('');
  const [skills, setSkills] = useState('');
  const [achievements, setAchievements] = useState('');
  const [tone, setTone] = useState<'business' | 'friendly' | 'formal'>('business');
  const [extra, setExtra] = useState('');
  const [result, setResult] = useState('');
  const [saved, setSaved] = useState<boolean | null>(null);
  const [isPending, startTransition] = useTransition();
  const [, syncResumeTransition] = useTransition();
  const [serverState, setServerState] = useState<ResumeSnapshot>({});
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isHydrating, setIsHydrating] = useState(true);

  useEffect(() => {
    resumeIdRef.current = resumeId;
  }, [resumeId]);

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

  const loadFromServer = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch('/api/data/resume', { cache: 'no-store' });
      if (!res.ok) {
        throw new Error(`failed to load resume: ${res.status}`);
      }
      const data = (await res.json()) as ResumeResponse;
      syncResumeTransition(() => {
        const id = typeof data.id === 'string' && data.id ? data.id : null;
        resumeIdRef.current = id;
        setResumeId(id);
        const nextState: ResumeSnapshot = {
          selfPr: data.selfPr ?? undefined,
          summary: data.summary ?? undefined,
        };
        setServerState(nextState);
      });
    } catch (error) {
      console.error('Failed to load server data', error);
    } finally {
      setIsRefreshing(false);
      setIsHydrating(false);
    }
  }, [syncResumeTransition]);

  useEffect(() => {
    void loadFromServer();
  }, [loadFromServer]);

  const canGenerate = useMemo(() => !isHydrating && !isPending, [isHydrating, isPending]);

  const doGenerate = () => {
    startTransition(async () => {
      const ensuredId = await ensureResumeId();
      if (!ensuredId) {
        alert('下書きIDの確保に失敗しました。時間をおいて再試行してください。');
        return;
      }
      const payload: SelfPrPayload = {
        resumeId: ensuredId,
        role: role || undefined,
        years: years === '' ? undefined : Number(years),
        skills: skills.split(',').map((s) => s.trim()).filter(Boolean),
        achievements: achievements.split('\n').map((s) => s.trim()).filter(Boolean),
        tone,
        extraNotes: extra || undefined,
      };
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
          await loadFromServer();
        } else {
          setResult('');
          setSaved(false);
          alert(data?.error?.message || '生成に失敗しました。');
        }
      } catch (error) {
        console.error(error);
        setResult('');
        setSaved(false);
        alert('ネットワークエラーが発生しました。');
      }
    });
  };

  return (
    <section>
      <h2 className="cv-kicker">自己PR</h2>
      <div className="cv-card" style={{ marginBottom: 16 }}>
        <h3>自己PRの生成</h3>
        
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
          <label className="cv-label">Skills (comma)</label>
          <input
            className="cv-input"
            value={skills}
            onChange={(e) => setSkills(e.target.value)}
            placeholder="React, Next.js"
          />
        </div>
        <div className="cv-field" style={{ alignItems: 'flex-start' }}>
          <label className="cv-label" style={{ paddingTop: 8 }}>Achievements</label>
          <textarea
            className="cv-textarea"
            value={achievements}
            onChange={(e) => setAchievements(e.target.value)}
            placeholder={'Line1\nLine2'}
          />
        </div>
        <div className="cv-field">
          <label className="cv-label">Tone</label>
          <select className="cv-select" value={tone} onChange={(e) => setTone(e.target.value as typeof tone)}>
            <option value="business">business</option>
            <option value="friendly">friendly</option>
            <option value="formal">formal</option>
          </select>
        </div>
        <div className="cv-field" style={{ alignItems: 'flex-start' }}>
          <label className="cv-label" style={{ paddingTop: 8 }}>Extra notes</label>
          <textarea
            className="cv-textarea"
            value={extra}
            onChange={(e) => setExtra(e.target.value)}
            placeholder="プロジェクトの背景や補足事項など"
          />
        </div>
        <div className="cv-row" style={{ marginTop: 20, gap: 12 }}>
          <button className="cv-btn primary" onClick={doGenerate} disabled={!canGenerate}>
            {isPending ? '生成中…' : 'AIで自己PRを生成'}
          </button>
          <button className="cv-btn ghost" onClick={() => loadFromServer()} disabled={isRefreshing}>
            {isRefreshing ? '更新中…' : '最新の保存内容を取得'}
          </button>
        </div>
        <div className="cv-row" style={{ marginTop: 12 }}>
          <Link href="/cv/3">
            <span className="cv-btn">次へ（要約）</span>
          </Link>
        </div>
        <div className="summary-status" role="status" aria-live="polite">
          {saved === null && !isPending && null}
          {isPending && <span>AI が出力しています…</span>}
          {saved === true && !isPending && <span style={{ color: '#0a0' }}>Airtable に保存しました。</span>}
          {saved === false && !isPending && null}
        </div>
      </div>
      {result && (
        <div className="cv-card" style={{ marginBottom: 16 }}>
          <h3>生成結果（この画面の反映）</h3>
          <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{result}</p>
          <div style={{ marginTop: 8, color: saved ? '#0a0' : '#555' }}>
            {saved === null
              ? '生成結果はAirtableへの保存を確認しています…'
              : saved
                ? 'Airtable に保存しました。'
                : ''}
          </div>
        </div>
      )}
      <div className="cv-card">
        <h3>保存済みの自己PR（最新のドラフト）</h3>
        <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
          {serverState.selfPr || '（保存された自己PRはまだありません）'}
        </p>
      </div>
    </section>
  );
}
