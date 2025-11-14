'use client';

import { useEffect, useState } from 'react';

import PdfActions from '../../components/PdfActions';
import CvPrintView, { type CvPrintResume, type CvPrintWork, type CvPrintTextField } from '../../components/cv/CvPrintView';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type ResumeResponse = Partial<CvPrintResume> & {
  id?: string | null;
  basicInfo?: CvPrintResume['basicInfo'] | null;
  desired?: CvPrintResume['desired'] | null;
};

type WorkResponse = {
  ok?: boolean;
  items?: CvPrintWork[];
};

function normalizeResumePayload(data: ResumeResponse | null | undefined): CvPrintResume | null {
  if (!data) return null;
  const resume: CvPrintResume = {
    basicInfo: data.basicInfo ?? undefined,
    lastName: data.lastName ?? undefined,
    firstName: data.firstName ?? undefined,
    summary: data.summary ?? undefined,
    summary_text: data.summary_text ?? undefined,
    summaryDraft: data.summaryDraft ?? undefined,
    summary_draft: data.summary_draft ?? undefined,
    selfPr: data.selfPr ?? undefined,
    selfpr: data.selfpr ?? undefined,
    self_pr: (data as Record<string, unknown>).self_pr as CvPrintTextField | undefined,
    desired: data.desired ?? undefined,
    roles: data.roles ?? undefined,
    industries: data.industries ?? undefined,
    tools_text: data.tools_text ?? undefined,
    tools: data.tools ?? undefined,
    qualifications: data.qualifications ?? undefined,
  };
  return resume;
}

export default function CvPrintPage() {
  const [resume, setResume] = useState<CvPrintResume | null>(null);
  const [works, setWorks] = useState<CvPrintWork[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isWorksLoading, setIsWorksLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const resumeController = new AbortController();
    const workController = new AbortController();

    const ensureResumeId = async (): Promise<string | null> => {
      try {
        const response = await fetch('/api/data/resume', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ touch: true }),
          cache: 'no-store',
          signal: resumeController.signal,
        });
        if (!response.ok) return null;
        const payload = (await response.json()) as { id?: string | null };
        const ensuredId = typeof payload.id === 'string' && payload.id ? payload.id : null;
        return ensuredId;
      } catch (postError) {
        console.error('Failed to ensure resume id', postError);
        return null;
      }
    };

    const loadData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const resumeResponse = await fetch('/api/data/resume', {
          cache: 'no-store',
          signal: resumeController.signal,
        });
        if (!resumeResponse.ok) {
          throw new Error(`resume fetch failed (${resumeResponse.status})`);
        }
        const resumeJson = (await resumeResponse.json()) as ResumeResponse;
        if (cancelled) return;

        const normalized = normalizeResumePayload(resumeJson);
        setResume(normalized);

        let resumeId = typeof resumeJson.id === 'string' && resumeJson.id ? resumeJson.id : null;
        if (!resumeId) {
          resumeId = await ensureResumeId();
          if (cancelled) return;
        }

        if (!resumeId) {
          setWorks([]);
          return;
        }

        setIsWorksLoading(true);
        try {
          const workResponse = await fetch(`/api/data/work?resumeId=${encodeURIComponent(resumeId)}`, {
            cache: 'no-store',
            signal: workController.signal,
          });
          if (!workResponse.ok) {
            throw new Error(`work fetch failed (${workResponse.status})`);
          }
          const workJson = (await workResponse.json()) as WorkResponse;
          if (!cancelled) {
            setWorks(Array.isArray(workJson.items) ? workJson.items : []);
          }
        } catch (workError) {
          if (!cancelled) {
            console.error('Failed to load work history', workError);
            setWorks([]);
          }
        } finally {
          if (!cancelled) {
            setIsWorksLoading(false);
          }
        }
      } catch (resumeError) {
        if (!cancelled) {
          console.error('Failed to load resume', resumeError);
          setError('データの取得に失敗しました。時間をおいて再試行してください。');
          setResume(null);
          setWorks([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadData();

    return () => {
      cancelled = true;
      resumeController.abort();
      workController.abort();
    };
  }, []);

  return (
    <>
      <PdfActions />
      <div className="cv-print-status" data-print-hidden="true">
        {isLoading && <p>職務経歴書の内容を読み込み中です…</p>}
        {!isLoading && isWorksLoading && <p>職務経歴を更新中です…</p>}
        {error && <p className="cv-print-status__error">{error}</p>}
      </div>
      <div id="cv-print-root">
        <CvPrintView resume={resume ?? undefined} works={works} />
      </div>
      <style jsx>{`
        .cv-print-status {
          margin-bottom: 16px;
          color: #333;
        }

        .cv-print-status p {
          margin: 0 0 4px;
        }

        .cv-print-status__error {
          color: #b42318;
        }
      `}</style>
    </>
  );
}
