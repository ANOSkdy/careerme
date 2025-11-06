'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

export default function IdBadge() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [id, setId] = useState('');

  useEffect(() => {
    const urlId = params.get('id') || '';
    let stored = '';
    try {
      stored = window.localStorage.getItem('resumeId') || '';
    } catch (error) {
      stored = '';
    }
    const nextId = urlId || stored;
    setId(nextId);
  }, [params]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === 'resumeId') {
        setId(event.newValue || '');
      }
    };
    const handleCustom = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail ?? '';
      setId(detail);
    };
    window.addEventListener('storage', handleStorage);
    window.addEventListener('resumeId-change', handleCustom as EventListener);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('resumeId-change', handleCustom as EventListener);
    };
  }, []);

  const short = useMemo(() => {
    if (!id) return '';
    return id.length > 12 ? `${id.slice(0, 6)}…${id.slice(-4)}` : id;
  }, [id]);

  const clear = () => {
    try {
      window.localStorage.removeItem('resumeId');
    } catch (error) {
      // noop
    }
    window.dispatchEvent(new CustomEvent('resumeId-change', { detail: '' }));
    const next = new URLSearchParams(params.toString());
    next.delete('id');
    router.replace(`${pathname}${next.size ? `?${next.toString()}` : ''}`, { scroll: false });
    setId('');
  };

  return (
    <div className="cv-meta" role="status" aria-live="polite">
      <span className="cv-chip">ID: {short || '-'}</span>
      <button
        className="cv-btn ghost"
        onClick={clear}
        disabled={!id}
        style={{ fontSize: 12, padding: '6px 10px', lineHeight: 1 }}
        type="button"
        title="Clear resumeId"
      >
        Clear
      </button>
    </div>
  );
}
