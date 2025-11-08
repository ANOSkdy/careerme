'use client';

import { useEffect, useState } from 'react';

type ResumeResponse = {
  id?: string | null;
};

function formatId(id: string | null): string {
  if (!id) return '-';
  return id.length > 12 ? `${id.slice(0, 6)}…${id.slice(-4)}` : id;
}

export default function IdBadge() {
  const [draftId, setDraftId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    (async () => {
      try {
        const res = await fetch('/api/data/resume', {
          cache: 'no-store',
          signal: controller.signal,
        });
        if (!res.ok) {
          throw new Error(`failed to load resume id: ${res.status}`);
        }
        const data = (await res.json()) as ResumeResponse;
        if (!cancelled) {
          const id = typeof data.id === 'string' && data.id ? data.id : null;
          setDraftId(id);
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to resolve draft id', error);
          setDraftId(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  const label = isLoading ? '読み込み中…' : `ドラフトID: ${formatId(draftId)}`;

  return (
    <div className="cv-meta" role="status" aria-live="polite">
      <span className="cv-chip">{label}</span>
    </div>
  );
}
