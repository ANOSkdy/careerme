import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { generateGeminiText } from '../../../../lib/ai/gemini';
import { readAnonKey } from '../../../../lib/utils/anon';
import { ensureCorrelationId } from '../../../../lib/utils/correlation';
import { consumeRateLimit } from '../../../../lib/utils/rate-limit';
import {
  CvQaSchema,
  SummaryTextSchema,
  SUMMARY_MAX_CHARS,
  SUMMARY_MIN_CHARS,
  type CvQa,
} from '../../../../lib/validation/schemas';
import {
  combineFilterFormulas,
  hasAirtableConfig,
  listAirtableRecords,
  updateAirtableRecords,
} from '../../../../lib/db/airtable';

const RATE_LIMIT = 10;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const TABLE_NAME = process.env.AIRTABLE_TABLE_RESUMES ?? 'Resumes';
const hasAirtable = hasAirtableConfig();

const aiMemoryStore = new Map<string, { draft?: string; final?: string }>();

const baseSchema = z.object({
  resumeId: z.string().min(1),
  target: z.enum(['draft', 'final']),
  action: z.enum(['generate', 'save', 'load']),
});

const generateSchema = baseSchema.extend({
  action: z.literal('generate'),
  qa: CvQaSchema,
  draft: z.string().max(2000).optional(),
});

const saveSchema = baseSchema.extend({
  action: z.literal('save'),
  text: SummaryTextSchema,
});

const loadSchema = baseSchema.extend({
  action: z.literal('load'),
});

const requestSchema = z.union([generateSchema, saveSchema, loadSchema]);

type RequestPayload = z.infer<typeof requestSchema>;

type AirtableRecord = {
  id: string;
  fields: {
    resumeId?: string;
    draftId?: string;
    anonKey?: string;
    summary_draft?: string;
    summary_final?: string;
    qa?: string;
  };
};

type SuccessBody = {
  success: true;
  correlationId: string;
  data: {
    target: 'draft' | 'final';
    text: string;
    fallback?: boolean;
    usage?: { totalTokens?: number; inputTokens?: number; outputTokens?: number };
  };
};

type ErrorBody = {
  code: string;
  message: string;
  correlationId: string;
};

function json(body: SuccessBody | ErrorBody, status = 200, extraHeaders?: HeadersInit) {
  return NextResponse.json(body, { status, headers: extraHeaders });
}

function sanitizeFormulaValue(value: string): string {
  return value.replace(/'/g, "\'");
}

async function findAirtableRecord(req: NextRequest, resumeId: string): Promise<AirtableRecord | null> {
  if (!hasAirtable) return null;
  const anonKey = readAnonKey(req);
  const filters: Array<string | undefined> = [];
  if (resumeId) {
    const sanitized = sanitizeFormulaValue(resumeId);
    filters.push(`OR({resumeId}='${sanitized}', {draftId}='${sanitized}')`);
  }
  if (anonKey) {
    const sanitized = sanitizeFormulaValue(anonKey);
    filters.push(`{anonKey}='${sanitized}'`);
  }
  const filterByFormula = combineFilterFormulas(...filters);
  if (!filterByFormula) return null;

  const records = await listAirtableRecords<AirtableRecord['fields']>(TABLE_NAME, {
    filterByFormula,
    maxRecords: 1,
    fields: ['resumeId', 'draftId', 'anonKey', 'summary_draft', 'summary_final'],
  });
  return records[0] ?? null;
}

function readRateLimitKey(req: NextRequest): string {
  const anon = readAnonKey(req);
  if (anon) return `anon:${anon}`;
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    return `ip:${forwarded.split(',')[0].trim()}`;
  }
  const realIp = req.headers.get('x-real-ip') ?? req.headers.get('cf-connecting-ip');
  if (realIp) return `ip:${realIp}`;
  return 'ip:unknown';
}

function readFromMemory(resumeId: string, target: 'draft' | 'final'): string {
  const entry = aiMemoryStore.get(resumeId);
  return entry?.[target] ?? '';
}

function writeToMemory(resumeId: string, target: 'draft' | 'final', text: string) {
  const entry = aiMemoryStore.get(resumeId) ?? {};
  entry[target] = text;
  aiMemoryStore.set(resumeId, entry);
}

function getStoredText(record: AirtableRecord | null, target: 'draft' | 'final'): string {
  if (!record) return '';
  const fieldName = target === 'draft' ? 'summary_draft' : 'summary_final';
  const raw = record.fields[fieldName];
  return typeof raw === 'string' ? raw : '';
}

async function saveToAirtable(record: AirtableRecord | null, resumeId: string, target: 'draft' | 'final', text: string) {
  if (!hasAirtable || !record) {
    writeToMemory(resumeId, target, text);
    return;
  }

  await updateAirtableRecords(TABLE_NAME, [
    {
      id: record.id,
      fields: {
        [target === 'draft' ? 'summary_draft' : 'summary_final']: text,
      },
    },
  ]);
}

function createFallbackText(qa: CvQa): string {
  const lines = [
    '【職務要約（バックアップ）】',
    qa.q1,
    qa.q2,
    `価値観: ${qa.q3}`,
    `志向: ${qa.q4}`,
  ];
  const fallback = lines.join('\n').trim();
  if (fallback.length >= SUMMARY_MIN_CHARS && fallback.length <= SUMMARY_MAX_CHARS) {
    return fallback;
  }
  return `${qa.q1}／${qa.q2}／${qa.q3}／${qa.q4}`.trim();
}

function buildSummaryPrompt(qa: CvQa, existing?: string): string {
  const lines: string[] = [];
  lines.push('あなたはプロのキャリアアドバイザーです。');
  lines.push('候補者情報をもとに日本語の職務要約を作成してください。');
  lines.push(`目標文字数: ${SUMMARY_MIN_CHARS}〜${SUMMARY_MAX_CHARS}文字。`);
  lines.push('構成: 1段落で、冒頭に役割や強みを端的に示し、その後でスコープ・成果・価値観を補足してください。');
  lines.push('語調はビジネスライクに保ち、誇張や断定を避け、具体的な数値や成果を優先してください。');
  if (existing?.trim()) {
    lines.push('参考として直近の草案があります。改善点を見つけつつ、内容を洗練させてください。');
    lines.push(existing.trim());
  }
  lines.push('以下のQ&Aを参考にしてください:');
  lines.push(`Q1 強み・自己PR: ${qa.q1}`);
  lines.push(`Q2 強みを示すエピソード: ${qa.q2}`);
  lines.push(`Q3 仕事で大切にしていること: ${qa.q3}`);
  lines.push(`Q4 希望する役割: ${qa.q4}`);
  lines.push('以上を踏まえ、要件に沿った職務要約を出力してください。');
  return lines.join('\n');
}

export async function POST(req: NextRequest) {
  const correlationId = ensureCorrelationId(req.headers.get('x-correlation-id'));

  let payload: RequestPayload;
  try {
    const body = await req.json();
    const result = requestSchema.safeParse(body);
    if (!result.success) {
      const message = result.error.issues.map((issue) => issue.message).join(', ');
      return json({ code: 'invalid_request', message, correlationId }, 400);
    }
    payload = result.data;
  } catch {
    return json({ code: 'invalid_json', message: '不正なJSONです。', correlationId }, 400);
  }

  const rateKey = readRateLimitKey(req);
  const rateResult = consumeRateLimit(rateKey, RATE_LIMIT, RATE_LIMIT_WINDOW_MS);
  if (rateResult.limited) {
    return json(
      {
        code: 'rate_limited',
        message: 'リクエストが集中しています。時間をおいて再試行してください。',
        correlationId,
      },
      429,
      rateResult.retryAfterMs
        ? { 'retry-after': Math.max(1, Math.ceil(rateResult.retryAfterMs / 1000)).toString() }
        : undefined
    );
  }

  let record: AirtableRecord | null = null;
  try {
    record = await findAirtableRecord(req, payload.resumeId);
  } catch (error) {
    console.error('[api/ai/summary] failed to load Airtable record', error);
    if (hasAirtable) {
      return json(
        {
          code: 'load_failed',
          message: 'データ取得に失敗しました。時間をおいて再試行してください。',
          correlationId,
        },
        502
      );
    }
  }

  switch (payload.action) {
    case 'load': {
      const text = hasAirtable ? getStoredText(record, payload.target) : readFromMemory(payload.resumeId, payload.target);
      return json({ success: true, correlationId, data: { target: payload.target, text, fallback: false } });
    }
    case 'save': {
      try {
        await saveToAirtable(record, payload.resumeId, payload.target, payload.text);
      } catch (error) {
        console.error('[api/ai/summary] failed to save Airtable record', error);
        return json(
          {
            code: 'save_failed',
            message: '保存に失敗しました。時間をおいて再試行してください。',
            correlationId,
          },
          502
        );
      }
      return json({ success: true, correlationId, data: { target: payload.target, text: payload.text } });
    }
    case 'generate': {
      let text: string;
      let fallback = false;
      let usage: SuccessBody['data']['usage'];
      try {
        const prompt = buildSummaryPrompt(payload.qa, payload.draft);
        const result = await generateGeminiText({
          prompt,
          temperature: 0.5,
          maxOutputTokens: 512,
        });
        text = result.text;
        usage = result.usage;
      } catch (error) {
        console.warn('[api/ai/summary] Gemini generation failed', error);
        text = createFallbackText(payload.qa);
        fallback = true;
      }

      if (!text.trim()) {
        text = createFallbackText(payload.qa);
        fallback = true;
      }

      return json({ success: true, correlationId, data: { target: payload.target, text, fallback, usage } });
    }
    default:
      return json({ code: 'unsupported_action', message: '未対応のアクションです。', correlationId }, 400);
  }
}
