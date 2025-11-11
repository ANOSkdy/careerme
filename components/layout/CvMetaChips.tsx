'use client';

import { useSelectedLayoutSegments } from 'next/navigation';

const HIDDEN_SEGMENTS = new Set(['2', '3']);

export default function CvMetaChips() {
  const segments = useSelectedLayoutSegments();
  const current = segments[0] ?? null;

  if (current && HIDDEN_SEGMENTS.has(current)) {
    return null;
  }

  return (
    <span className="cv-meta">
      <span className="cv-chip">AIサマリー対応</span>
      <span className="cv-chip">PDF出力</span>
    </span>
  );
}
