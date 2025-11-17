'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

type ResumeResponse = {
  id?: string | null;
  record?: { id?: string | null } | null;
  data?: { id?: string | null } | null;
  resume?: { id?: string | null } | null;
};

type PrintResponse = {
  ok?: boolean;
  id?: string;
  error?: string;
};

type Props = {
  template?: string;
  className?: string;
  buttonClassName?: string;
  children?: React.ReactNode;
};

async function resolveResumeId() {
  const res = await fetch('/api/data/resume', { method: 'GET', cache: 'no-store' });
  if (!res.ok) {
    throw new Error('職務経歴書の取得に失敗しました。');
  }
  const data = (await res.json().catch(() => ({}))) as ResumeResponse;
  const candidates = [data?.id, data?.record?.id, data?.data?.id, data?.resume?.id];
  const resumeId = candidates.find((v): v is string => typeof v === 'string' && v.length > 0);
  if (!resumeId) {
    throw new Error('職務経歴書IDを取得できませんでした。');
  }
  return resumeId;
}

export default function PrintSnapshotButton({
  template = 'cv_v1',
  className,
  buttonClassName = 'cv-btn ghost',
  children = '職務経歴書の生成',
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    if (loading) return;
    setError(null);
    setLoading(true);
    try {
      const resumeId = await resolveResumeId();
      const resp = await fetch('/api/prints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeId, template }),
      });
      const json = (await resp.json().catch(() => ({}))) as PrintResponse;
      const ok = resp.ok && json?.ok === true && typeof json?.id === 'string';
      if (!ok) {
        throw new Error(json?.error || '印刷用スナップショットの作成に失敗しました。');
      }
      router.push(`/cv-print/${encodeURIComponent(String(json.id))}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : '印刷用スナップショットの作成に失敗しました。';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={className}>
      <button
        type="button"
        aria-label="職務経歴書の生成"
        onClick={handleClick}
        disabled={loading}
        className={buttonClassName}
      >
        {loading ? '生成中…' : children}
      </button>
      {error ? (
        <p className="text-red-600" role="alert" style={{ marginTop: 8 }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
