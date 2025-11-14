import { useMemo } from 'react';

export type CvPrintTextField =
  | string
  | null
  | undefined
  | {
      final?: unknown;
      draft?: unknown;
      text?: unknown;
      value?: unknown;
    };

export type CvPrintResume = {
  basicInfo?: {
    lastName?: string | null;
    firstName?: string | null;
  } | null;
  lastName?: string | null;
  firstName?: string | null;
  summary?: CvPrintTextField;
  summary_text?: CvPrintTextField;
  summaryDraft?: CvPrintTextField;
  summary_draft?: CvPrintTextField;
  selfPr?: CvPrintTextField;
  selfpr?: CvPrintTextField;
  self_pr?: CvPrintTextField;
  desired?: {
    roles?: unknown;
    industries?: unknown;
    tools_text?: unknown;
    tools?: unknown;
  } | null;
  roles?: unknown;
  industries?: unknown;
  tools_text?: unknown;
  tools?: unknown;
  qualifications?: unknown;
};

export type CvPrintWork = {
  id?: string;
  resumeId?: string | null;
  company?: string | null;
  company_name?: string | null;
  organization?: string | null;
  division?: string | null;
  department?: string | null;
  team?: string | null;
  title?: string | null;
  position?: string | null;
  role?: string | null;
  startYm?: string | null;
  start_ym?: string | null;
  start?: string | null;
  endYm?: string | null;
  end_ym?: string | null;
  end?: string | null;
  present?: boolean | null;
  current?: boolean | null;
  q_job_desc?: unknown;
  q_tasks?: unknown;
  q_result?: unknown;
  description?: unknown;
  achievements?: unknown;
  responsibilities?: unknown;
  roles?: unknown;
  industries?: unknown;
  qualifications?: unknown;
};

type CvPrintViewProps = {
  resume?: CvPrintResume | null;
  works?: CvPrintWork[] | null;
};

type NormalizedWork = {
  key: string;
  company: string;
  division?: string;
  title?: string;
  periodText: string;
  duties: string[];
  achievements: string[];
  roles: string[];
  industries: string[];
  qualifications: string[];
  startValue: number;
  endValue: number;
};

function extractText(value: CvPrintTextField): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    return value.map((item) => extractText(item as CvPrintTextField)).filter(Boolean).join('\n');
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (record.final) {
      const finalText = extractText(record.final as CvPrintTextField);
      if (finalText.trim()) return finalText;
    }
    if (record.draft) {
      const draftText = extractText(record.draft as CvPrintTextField);
      if (draftText.trim()) return draftText;
    }
    if (record.text) {
      const text = extractText(record.text as CvPrintTextField);
      if (text.trim()) return text;
    }
    if (record.value) {
      const text = extractText(record.value as CvPrintTextField);
      if (text.trim()) return text;
    }
  }
  return '';
}

function pickText(...candidates: CvPrintTextField[]): string {
  for (const candidate of candidates) {
    const text = extractText(candidate);
    if (text.trim()) {
      return text;
    }
  }
  return '';
}

function coalesceString(...values: Array<string | null | undefined>): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return '';
}

function toStringArray(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === 'string' ? item.trim() : String(item).trim()))
      .filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(/[,、\n]/u)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function toBulletList(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.flatMap((item) => toBulletList(item));
  }
  if (typeof value === 'string') {
    return value
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter(Boolean);
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const next = record.final ?? record.draft ?? record.text ?? record.value;
    return toBulletList(next);
  }
  return [];
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result;
}

function parseYearMonth(value: string | null | undefined): number | null {
  if (!value) return null;
  const normalized = value.replace(/[./]/g, '-').trim();
  const match = normalized.match(/^(\d{4})[-年]?(\d{1,2})$/u);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return null;
  return year * 100 + Math.max(1, Math.min(12, month));
}

function formatYearMonth(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.replace(/[./]/g, '-').trim();
  const match = normalized.match(/^(\d{4})-(\d{1,2})$/u);
  if (!match) return value;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return value;
  return `${year}年${month}月`;
}

function formatPeriod(startRaw: string | null | undefined, endRaw: string | null | undefined, isCurrent: boolean): string {
  const start = formatYearMonth(startRaw);
  const end = isCurrent ? '現在' : formatYearMonth(endRaw);
  if (!start && !end) return '期間未設定';
  if (!start) return `〜 ${end ?? '未設定'}`;
  if (!end) return `${start} 〜`;
  return `${start} 〜 ${end}`;
}

function normalizeWorks(works: CvPrintWork[] | null | undefined): NormalizedWork[] {
  const normalized = (works ?? []).map((work, index) => {
    const startRaw = coalesceString(work.start_ym ?? undefined, work.startYm ?? undefined, work.start ?? undefined);
    const endRaw = coalesceString(work.end_ym ?? undefined, work.endYm ?? undefined, work.end ?? undefined);
    const isCurrent = Boolean(work.present ?? work.current ?? (!endRaw));
    const periodText = formatPeriod(startRaw || null, endRaw || null, isCurrent);
    const duties = uniqueStrings([
      ...toBulletList(work.q_job_desc),
      ...toBulletList(work.q_tasks),
      ...toBulletList(work.description),
      ...toBulletList(work.responsibilities),
    ]);
    const achievements = uniqueStrings([
      ...toBulletList(work.q_result),
      ...toBulletList(work.achievements),
    ]);
    const company = coalesceString(work.company ?? undefined, work.company_name ?? undefined, work.organization ?? undefined);
    const division = coalesceString(work.division ?? undefined, work.department ?? undefined, work.team ?? undefined);
    const title = coalesceString(work.title ?? undefined, work.position ?? undefined, work.role ?? undefined);
    const roles = uniqueStrings(toStringArray(work.roles));
    const industries = uniqueStrings(toStringArray(work.industries));
    const qualifications = uniqueStrings(toStringArray(work.qualifications));
    const endValue = isCurrent ? Number.POSITIVE_INFINITY : parseYearMonth(endRaw) ?? Number.NEGATIVE_INFINITY;
    const startValue = parseYearMonth(startRaw) ?? Number.NEGATIVE_INFINITY;

    return {
      key: work.id ?? `work-${index}`,
      company: company || '会社名未設定',
      division: division || undefined,
      title: title || undefined,
      periodText,
      duties,
      achievements,
      roles,
      industries,
      qualifications,
      startValue,
      endValue,
    } satisfies NormalizedWork;
  });

  normalized.sort((a, b) => {
    if (b.endValue !== a.endValue) {
      return b.endValue - a.endValue;
    }
    if (b.startValue !== a.startValue) {
      return b.startValue - a.startValue;
    }
    return a.key.localeCompare(b.key);
  });

  return normalized;
}

export default function CvPrintView({ resume, works }: CvPrintViewProps) {
  const normalizedWorks = useMemo(() => normalizeWorks(works), [works]);

  const summaryText = useMemo(
    () =>
      pickText(
        resume?.summary,
        resume?.summary_text,
        resume?.summaryDraft,
        resume?.summary_draft
      ),
    [resume?.summary, resume?.summaryDraft, resume?.summary_draft, resume?.summary_text]
  );

  const selfPrText = useMemo(
    () => pickText(resume?.selfPr, resume?.selfpr, resume?.self_pr),
    [resume?.selfPr, resume?.self_pr, resume?.selfpr]
  );

  const resumeRoles = useMemo(
    () =>
      uniqueStrings([
        ...toStringArray(resume?.roles),
        ...toStringArray(resume?.desired?.roles),
      ]),
    [resume?.desired?.roles, resume?.roles]
  );

  const resumeIndustries = useMemo(
    () =>
      uniqueStrings([
        ...toStringArray(resume?.industries),
        ...toStringArray(resume?.desired?.industries),
      ]),
    [resume?.desired?.industries, resume?.industries]
  );

  const resumeQualifications = useMemo(
    () => uniqueStrings([...toStringArray(resume?.qualifications)]),
    [resume?.qualifications]
  );

  const tools = useMemo(
    () =>
      uniqueStrings([
        ...toStringArray(resume?.tools_text),
        ...toStringArray(resume?.desired?.tools_text),
        ...toStringArray(resume?.tools),
        ...toStringArray(resume?.desired?.tools),
      ]),
    [resume?.desired?.tools, resume?.desired?.tools_text, resume?.tools, resume?.tools_text]
  );

  const aggregatedRoles = useMemo(
    () => uniqueStrings([...resumeRoles, ...normalizedWorks.flatMap((work) => work.roles)]),
    [normalizedWorks, resumeRoles]
  );

  const aggregatedIndustries = useMemo(
    () => uniqueStrings([...resumeIndustries, ...normalizedWorks.flatMap((work) => work.industries)]),
    [normalizedWorks, resumeIndustries]
  );

  const aggregatedQualifications = useMemo(
    () =>
      uniqueStrings([
        ...resumeQualifications,
        ...normalizedWorks.flatMap((work) => work.qualifications),
      ]),
    [normalizedWorks, resumeQualifications]
  );

  const nameParts = useMemo(() => {
    const lastName = coalesceString(resume?.basicInfo?.lastName ?? undefined, resume?.lastName ?? undefined);
    const firstName = coalesceString(resume?.basicInfo?.firstName ?? undefined, resume?.firstName ?? undefined);
    return [lastName, firstName].filter(Boolean);
  }, [resume?.basicInfo?.firstName, resume?.basicInfo?.lastName, resume?.firstName, resume?.lastName]);

  const todayLabel = useMemo(
    () => new Intl.DateTimeFormat('ja-JP', { dateStyle: 'long' }).format(new Date()),
    []
  );

  const summaryContent = summaryText.trim() ? summaryText : '（職務要約が未入力です）';
  const hasSelfPr = Boolean(selfPrText.trim());

  return (
    <main className="cv-print" role="document">
      <header className="cv-print__header">
        <div>
          <h1>職務経歴書</h1>
          <p className="cv-print__date">{todayLabel}</p>
        </div>
        <div className="cv-print__name">{nameParts.length ? nameParts.join(' ') : '氏名未設定'}</div>
      </header>

      <section className="cv-print__section">
        <h2>職務要約</h2>
        <p className="cv-print__body">{summaryContent}</p>
      </section>

      <section className="cv-print__section">
        <h2>職務経歴</h2>
        {normalizedWorks.length ? (
          <div className="cv-print__work-list">
            {normalizedWorks.map((work) => {
              const metaParts = uniqueStrings([work.division ?? '', work.title ?? '']);
              const metaLabel = metaParts.join(' / ');
              const duties = work.duties.length
                ? work.duties
                : ['（職務内容の記載がありません）'];
              return (
                <article key={work.key} className="cv-print-card">
                  <header className="cv-print-card__header">
                    <div className="cv-print-card__heading">
                      <p className="cv-print-card__company">{work.company}</p>
                      {metaLabel && <p className="cv-print-card__meta">{metaLabel}</p>}
                    </div>
                    <p className="cv-print-card__period">{work.periodText}</p>
                  </header>

                  <div className="cv-print-card__block">
                    <h3>職務内容</h3>
                    <ul>
                      {duties.map((item, index) => (
                        <li key={`duty-${work.key}-${index}`}>{item}</li>
                      ))}
                    </ul>
                  </div>

                  {work.achievements.length > 0 && (
                    <div className="cv-print-card__block">
                      <h3>実績</h3>
                      <ul>
                        {work.achievements.map((item, index) => (
                          <li key={`ach-${work.key}-${index}`}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        ) : (
          <p className="cv-print__body">（職務経歴が登録されていません）</p>
        )}
      </section>

      <section className="cv-print__section">
        <h2>スキル / 経験領域</h2>
        <div className="cv-print__grid">
          <div className="cv-print__grid-block">
            <h3>担当領域</h3>
            {aggregatedRoles.length ? (
              <ul>
                {aggregatedRoles.map((item) => (
                  <li key={`role-${item}`}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className="cv-print__body">（記載がありません）</p>
            )}
          </div>
          <div className="cv-print__grid-block">
            <h3>業界</h3>
            {aggregatedIndustries.length ? (
              <ul>
                {aggregatedIndustries.map((item) => (
                  <li key={`ind-${item}`}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className="cv-print__body">（記載がありません）</p>
            )}
          </div>
          <div className="cv-print__grid-block">
            <h3>使用ツール</h3>
            {tools.length ? (
              <ul>
                {tools.map((item) => (
                  <li key={`tool-${item}`}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className="cv-print__body">（記載がありません）</p>
            )}
          </div>
        </div>
      </section>

      <section className="cv-print__section">
        <h2>資格</h2>
        {aggregatedQualifications.length ? (
          <ul className="cv-print__list">
            {aggregatedQualifications.map((item) => (
              <li key={`qual-${item}`}>{item}</li>
            ))}
          </ul>
        ) : (
          <p className="cv-print__body">（資格の記載がありません）</p>
        )}
      </section>

      {hasSelfPr && (
        <section className="cv-print__section">
          <h2>自己PR</h2>
          <p className="cv-print__body">{selfPrText}</p>
        </section>
      )}

      <style jsx>{`
        .cv-print {
          font-family: 'Noto Sans JP', 'Hiragino Sans', 'Yu Gothic', sans-serif;
          color: #111;
          background: #fff;
          padding: 32px 40px 48px;
          font-size: 14px;
          line-height: 1.7;
          max-width: 720px;
          margin: 0 auto;
        }

        .cv-print__header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 24px;
          margin-bottom: 32px;
        }

        .cv-print__header h1 {
          font-size: 20px;
          font-weight: 700;
          margin: 0 0 4px;
        }

        .cv-print__date {
          margin: 0;
          font-size: 14px;
        }

        .cv-print__name {
          font-size: 20px;
          font-weight: 700;
          white-space: pre-wrap;
        }

        .cv-print__section {
          margin-bottom: 28px;
        }

        .cv-print__section h2 {
          font-size: 16px;
          font-weight: 700;
          margin: 0 0 12px;
          padding-bottom: 4px;
          border-bottom: 1px solid #d0d5dd;
        }

        .cv-print__body {
          margin: 0;
          white-space: pre-wrap;
        }

        .cv-print__work-list {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .cv-print-card {
          border: 1px solid #d0d5dd;
          border-radius: 8px;
          padding: 16px;
          break-inside: avoid;
          page-break-inside: avoid;
        }

        .cv-print-card__header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          margin-bottom: 12px;
        }

        .cv-print-card__heading {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .cv-print-card__company {
          margin: 0;
          font-size: 15px;
          font-weight: 700;
        }

        .cv-print-card__meta {
          margin: 4px 0 0;
          font-size: 13px;
        }

        .cv-print-card__period {
          margin: 0;
          font-size: 13px;
          white-space: nowrap;
        }

        .cv-print-card__block {
          margin-top: 12px;
        }

        .cv-print-card__block h3 {
          margin: 0 0 4px;
          font-size: 14px;
          font-weight: 700;
        }

        .cv-print-card__block ul,
        .cv-print__list,
        .cv-print__grid-block ul {
          margin: 0;
          padding-left: 18px;
        }

        .cv-print-card__block li,
        .cv-print__list li,
        .cv-print__grid-block li {
          margin-bottom: 4px;
        }

        .cv-print__grid {
          display: grid;
          gap: 16px;
        }

        .cv-print__grid-block h3 {
          margin: 0 0 4px;
          font-size: 14px;
          font-weight: 700;
        }

        @media (min-width: 720px) {
          .cv-print__grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }
      `}</style>
    </main>
  );
}
