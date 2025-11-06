'use client';

import { useEffect } from 'react';

export default function CvError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="cv-card">
      <h3>エラーが発生しました</h3>
      <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
        {error?.message || 'Unknown error'}
      </p>
      {error?.digest ? (
        <p className="cv-kicker">digest: {error.digest}</p>
      ) : null}
      <button className="cv-btn primary" onClick={() => reset()} style={{ marginTop: 8 }}>
        再試行
      </button>
    </div>
  );
}
