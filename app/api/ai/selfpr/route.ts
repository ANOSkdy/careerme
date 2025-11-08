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
  SelfPrTextSchema,
  SELF_PR_MAX_CHARS,
  SELF_PR_MIN_CHARS,
} from '../../../../lib/validation/schemas';

const RESUME_TABLE = process.env.AIRTABLE_TABLE_RESUMES || 'Resumes';
const RATE_LIMIT_PER_HOUR = 10;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const SELF_PR_FALLBACK = `【自己PRテンプレート】\n1. 強み・得意分野\n2. 実績や貢献内容\n3. 今後の挑戦と支援できる価値`;

const requestSchema = z.object({
  resumeId: z.string().min(1, 'resumeId is required'),
  action: z.enum(['generate', 'save', 'load']).default('generate'),
  target: z.enum(['draft', 'final']).default('draft'),
  draft: z.string().optional(),
});

type ResumeFields = {
  qa?: string;
  selfpr_draft?: string;
  selfpr_final?: string;
  summary_draft?: string;
  summary_final?: string;
  selfPr?: string;
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
    fields: ['qa', 'selfpr_draft', 'selfpr_final', 'summary_draft', 'summary_final'],
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
    console.warn('[api/ai/selfpr] failed to parse qa', error);
    return null;
  }
}

function buildSelfPrPrompt(qa: CvQa, context: { summary?: string | null }): string {
  const lines: string[] = [];
  lines.push('あなたは候補者の職務経歴書を支援するキャリアアドバイザーです。');
  lines.push(
    `以下の情報を基に日本語で${SELF_PR_MIN_CHARS}〜${SELF_PR_MAX_CHARS}文字の自己PRを3段落構成で作成してください。`
  );
  lines.push('- 第1段落: 強みと提供価値の要約');
  lines.push('- 第2段落: 強みを示す具体的なエピソード（成果・工夫・役割を含める）');
  lines.push('- 第3段落: 今後の志向や担いたい役割、活かせる経験');
  lines.push('- 語調はビジネスライクかつ前向きに。不要な言い回しや過度な謙遜は避ける。');
  lines.push('- 数値や成果は与えられた情報から自然な範囲で補足してよい。');
  lines.push('');
  lines.push('【候補者からの入力（Q&A）】');
  lines.push(`Q1: ${qa.q1}`);
  lines.push(`Q2: ${qa.q2}`);
  lines.push(`Q3: ${qa.q3}`);
  lines.push(`Q4: ${qa.q4}`);
  if (context.summary) {
    lines.push('');
    lines.push('【補足情報（職務要約やハイライト）】');
    lines.push(context.summary);
  }
  lines.push('');
  lines.push('出力はMarkdownではなく通常の文章でお願いします。');
  return lines.join('\n');
}

async function updateSelfPrField(
  recordId: string,
  target: 'draft' | 'final',
  text: string
): Promise<void> {
  const fields: Record<string, string> = {};
  if (target === 'draft') {
    fields.selfpr_draft = text;
  } else {
    fields.selfpr_final = text;
    fields.selfPr = text;
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
      const stored = payload.target === 'final' ? record.fields.selfpr_final : record.fields.selfpr_draft;
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
      const parseResult = SelfPrTextSchema.safeParse(text);
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

      await updateSelfPrField(record.id, payload.target, parseResult.data);
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
          message: '自己PRを生成するためのQ&Aが不足しています',
          correlationId,
        },
        400,
        { anonKey, setAnonCookie: shouldSetAnonCookie }
      );
    }

    const { text, tokens } = await generateGeminiText({
      prompt: buildSelfPrPrompt(qa, {
        summary: record.fields.selfpr_final || record.fields.summary_final || record.fields.summary_draft,
      }),
      temperature: 0.35,
      maxOutputTokens: 1024,
      correlationId,
    });

    const normalized = text.trim();
    await updateSelfPrField(record.id, 'draft', normalized);

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
      console.error('[api/ai/selfpr] Gemini error', correlationId, error);
    } else {
      console.error('[api/ai/selfpr] Unexpected error', correlationId, error);
    }

    return jsonResponse<AiResponseBody | ErrorBody>(
      {
        draft: SELF_PR_FALLBACK,
        target: 'draft',
        correlationId,
      } as AiResponseBody,
      200,
      { anonKey, setAnonCookie: shouldSetAnonCookie }
    );
  }
}
