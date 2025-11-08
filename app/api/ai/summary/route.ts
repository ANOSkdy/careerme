export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { generateGeminiText, GeminiRequestError } from '../../../../lib/ai/gemini';
import {
  combineFilterFormulas,
  listAirtableRecords,
  updateAirtableRecords,
} from '../../../../lib/db/airtable';
import { readAnonKey, setAnonCookie, generateAnonKey } from '../../../../lib/utils/anon';
import { ensureCorrelationId } from '../../../../lib/utils/correlation';
import { checkRateLimit } from '../../../../lib/utils/rate-limit';
import {
  CvQaSchema,
  type CvQa,
  SummaryTextSchema,
  SUMMARY_MAX_CHARS,
  SUMMARY_MIN_CHARS,
} from '../../../../lib/validation/schemas';

const RESUME_TABLE = process.env.AIRTABLE_TABLE_RESUMES || 'Resumes';
const RATE_LIMIT_PER_HOUR = 10;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const SUMMARY_FALLBACK = `【職務要約テンプレート】\n- 担当領域: \n- 強み/スキル: \n- 実績と提供価値:`;

const requestSchema = z.object({
  resumeId: z.string().min(1, 'resumeId is required'),
  action: z.enum(['generate', 'save', 'load']).default('generate'),
  target: z.enum(['draft', 'final']).default('draft'),
  draft: z.string().optional(),
});

type ResumeFields = {
  qa?: string;
  selfpr_final?: string;
  summary_draft?: string;
  summary_final?: string;
  summary?: string;
};

type ResumeRecord = {
  id: string;
  fields: ResumeFields;
};

type AiResponseBody = {
  draft: string;
  target: 'draft' | 'final';
  tokens?: number;
  correlationId: string;
};

type ErrorBody = {
  code: string;
  message: string;
  correlationId: string;
};

function jsonResponse<T>(
  body: T,
  status: number,
  options: { anonKey?: string | null; setAnonCookie?: boolean; retryAfterSeconds?: number } = {}
) {
  const response = NextResponse.json(body, { status });
  if (options.retryAfterSeconds) {
    response.headers.set('Retry-After', String(options.retryAfterSeconds));
  }
  if (options.setAnonCookie && options.anonKey) {
    setAnonCookie(response, options.anonKey);
  }
  return response;
}

function sanitize(value: string): string {
  return value.replace(/'/g, "''");
}

async function findResumeRecord(
  resumeId: string,
  anonKey: string | null
): Promise<ResumeRecord | null> {
  const filters: string[] = [];
  const sanitizedId = sanitize(resumeId);
  filters.push(`OR({resumeId}='${sanitizedId}', {draftId}='${sanitizedId}')`);
  if (anonKey) {
    filters.push(`{anonKey}='${sanitize(anonKey)}'`);
  }

  const filterByFormula = combineFilterFormulas(...filters);
  const records = await listAirtableRecords<ResumeFields>(RESUME_TABLE, {
    filterByFormula,
    fields: ['qa', 'selfpr_final', 'summary_draft', 'summary_final'],
    maxRecords: 1,
  });

  if (!records.length) return null;
  return records[0];
}

function parseCvQa(value: string | undefined): CvQa | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    const result = CvQaSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch (error) {
    console.warn('[api/ai/summary] failed to parse qa', error);
    return null;
  }
}

function buildSummaryPrompt(options: {
  qa: CvQa | null;
  selfPr?: string | null;
}): string {
  const lines: string[] = [];
  lines.push('あなたは職務経歴書の専門編集者です。');
  lines.push(
    `候補者の情報から${SUMMARY_MIN_CHARS}〜${SUMMARY_MAX_CHARS}文字の日本語の職務要約を作成してください。`
  );
  lines.push('- 1文目: ロール・経験年数・主要領域の要約');
  lines.push('- 2文目: 強みや実績、スキルセットを具体的に');
  lines.push('- 3文目: 提供できる価値や今後の志向があれば触れる');
  lines.push('- 語調は客観的かつ簡潔に。重複や冗長な表現は避ける。');
  lines.push('- 箇条書きではなく文章で出力する。');
  lines.push('');

  if (options.selfPr) {
    lines.push('【自己PRの要点】');
    lines.push(options.selfPr);
    lines.push('');
  }

  if (options.qa) {
    lines.push('【候補者のQ&A】');
    lines.push(`Q1: ${options.qa.q1}`);
    lines.push(`Q2: ${options.qa.q2}`);
    lines.push(`Q3: ${options.qa.q3}`);
    lines.push(`Q4: ${options.qa.q4}`);
    lines.push('');
  }

  lines.push('上記を踏まえて要約を生成してください。');
  return lines.join('\n');
}

async function updateSummaryField(
  recordId: string,
  target: 'draft' | 'final',
  text: string
): Promise<void> {
  const fields: Record<string, string> = {};
  if (target === 'draft') {
    fields.summary_draft = text;
  } else {
    fields.summary_final = text;
    fields.summary = text;
  }

  await updateAirtableRecords(RESUME_TABLE, [
    {
      id: recordId,
      fields,
    },
  ]);
}

export async function POST(req: NextRequest) {
  const correlationId = ensureCorrelationId(req.headers.get('x-correlation-id'));
  const anonCookie = readAnonKey(req);
  const ipAddress =
    req.ip ||
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown';

  let anonKey = anonCookie;
  let shouldSetAnonCookie = false;
  if (!anonKey) {
    anonKey = generateAnonKey();
    shouldSetAnonCookie = true;
  }

  let payload: z.infer<typeof requestSchema>;
  try {
    payload = requestSchema.parse(await req.json());
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? error.issues.map((issue) => issue.message).join(', ')
        : error instanceof Error
          ? error.message
          : 'Invalid request';
    return jsonResponse<ErrorBody>(
      { code: 'invalid_request', message, correlationId },
      400,
      { anonKey, setAnonCookie: shouldSetAnonCookie }
    );
  }

  if (!process.env.AIRTABLE_API_KEY || !process.env.AIRTABLE_BASE_ID) {
    return jsonResponse<ErrorBody>(
      {
        code: 'config_error',
        message: 'Airtable credentials are not configured',
        correlationId,
      },
      500,
      { anonKey, setAnonCookie: shouldSetAnonCookie }
    );
  }

  const rateKey = anonKey ? `anon:${anonKey}` : `ip:${ipAddress}`;
  if (payload.action === 'generate') {
    const rate = checkRateLimit({ key: rateKey, limit: RATE_LIMIT_PER_HOUR, windowMs: RATE_LIMIT_WINDOW_MS });
    if (!rate.allowed) {
      return jsonResponse<ErrorBody>(
        { code: 'rate_limited', message: '生成リクエストが多すぎます。時間をおいて再試行してください。', correlationId },
        429,
        {
          anonKey,
          setAnonCookie: shouldSetAnonCookie,
          retryAfterSeconds: Math.max(1, Math.ceil((rate.reset - Date.now()) / 1000)),
        }
      );
    }
  }

  try {
    const record = await findResumeRecord(payload.resumeId, anonKey);
    if (!record) {
      return jsonResponse<ErrorBody>(
        {
          code: 'resume_not_found',
          message: '指定された履歴書情報が見つかりませんでした',
          correlationId,
        },
        404,
        { anonKey, setAnonCookie: shouldSetAnonCookie }
      );
    }

    const qa = parseCvQa(record.fields.qa);

    if (payload.action === 'load') {
      const stored = payload.target === 'final' ? record.fields.summary_final : record.fields.summary_draft;
      return jsonResponse<AiResponseBody>(
        {
          draft: stored ?? '',
          target: payload.target,
          correlationId,
        },
        200,
        { anonKey, setAnonCookie: shouldSetAnonCookie }
      );
    }

    if (payload.action === 'save') {
      const text = (payload.draft ?? '').trim();
      const parseResult = SummaryTextSchema.safeParse(text);
      if (!parseResult.success) {
        const [issue] = parseResult.error.issues;
        return jsonResponse<ErrorBody>(
          {
            code: 'invalid_text',
            message: issue?.message ?? '保存する本文が正しくありません',
            correlationId,
          },
          400,
          { anonKey, setAnonCookie: shouldSetAnonCookie }
        );
      }

      await updateSummaryField(record.id, payload.target, parseResult.data);
      return jsonResponse<AiResponseBody>(
        {
          draft: parseResult.data,
          target: payload.target,
          correlationId,
        },
        200,
        { anonKey, setAnonCookie: shouldSetAnonCookie }
      );
    }

    if (!qa) {
      return jsonResponse<ErrorBody>(
        {
          code: 'missing_required_inputs',
          message: '職務要約を生成するための情報が不足しています',
          correlationId,
        },
        400,
        { anonKey, setAnonCookie: shouldSetAnonCookie }
      );
    }

    const { text, tokens } = await generateGeminiText({
      prompt: buildSummaryPrompt({ qa, selfPr: record.fields.selfpr_final }),
      temperature: 0.4,
      maxOutputTokens: 768,
      correlationId,
    });

    const normalized = text.trim();
    await updateSummaryField(record.id, 'draft', normalized);

    return jsonResponse<AiResponseBody>(
      {
        draft: normalized,
        target: 'draft',
        tokens,
        correlationId,
      },
      200,
      { anonKey, setAnonCookie: shouldSetAnonCookie }
    );
  } catch (error) {
    if (error instanceof GeminiRequestError) {
      console.error('[api/ai/summary] Gemini error', correlationId, error);
    } else {
      console.error('[api/ai/summary] Unexpected error', correlationId, error);
    }

    return jsonResponse<AiResponseBody>(
      {
        draft: SUMMARY_FALLBACK,
        target: 'draft',
        correlationId,
      },
      200,
      { anonKey, setAnonCookie: shouldSetAnonCookie }
    );
  }
}
