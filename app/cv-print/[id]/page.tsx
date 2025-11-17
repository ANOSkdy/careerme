'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface SnapshotResponse {
  ok?: boolean;
  snapshot?: { id: string; resumeId?: string; createdAt?: string; payload?: unknown };
  error?: { message?: string };
}

export default function CvPrintPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [message, setMessage] = useState<string>('生成したスナップショットを読み込んでいます…');

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/prints/${id}`);
        const data = (await res.json()) as SnapshotResponse;
        if (res.ok && data?.ok) {
          setStatus('ready');
          setMessage('印刷ダイアログを開いています…');
          window.print();
        } else {
          setStatus('error');
          setMessage(data?.error?.message || 'スナップショットが見つかりませんでした。');
        }
      } catch (e) {
        console.error('Failed to load snapshot', e);
        setStatus('error');
        setMessage('スナップショットの取得に失敗しました。');
      }
    };

    void load();
  }, [id]);

  return (
    <main style={{ padding: '24px', maxWidth: 720, margin: '0 auto' }}>
      <h1 style={{ marginBottom: 12 }}>印刷プレビュー</h1>
      <p style={{ marginBottom: 12 }}>スナップショットID: {id}</p>
      <p>{message}</p>
      {status === 'error' ? (
        <button type="button" className="cv-btn" onClick={() => router.push('/cv/3')} style={{ marginTop: 16 }}>
          戻る
        </button>
      ) : null}
    </main>
  );
}
