export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { generateGeminiText } from '../../../../lib/ai/gemini';

const requestSchema = z.object({
  resumeId: z.string().min(1, 'resumeId is required'),
  locale: z.string().min(2).max(5).optional(),
  role: z.string().min(1).optional(),
  years: z.number().nonnegative().optional(),
  headlineKeywords: z.array(z.string().min(1)).max(15).optional(),
  extraNotes: z.string().max(1000).optional(),
});

type RequestPayload = z.infer<typeof requestSchema>;

function buildPrompt({
  locale = 'ja',
  role,
  years,
  headlineKeywords,
  extraNotes,
}: RequestPayload): string {
  const lines: string[] = [
    `You are a writing assistant. Output language: ${locale}.`,
    'Task: Compose a Japanese professional summary (職務要約).',
    'Target length: 200–400 Japanese characters.',
    'Guidelines:',
    '- Begin with a headline describing role and impact.',
    '- Summarize scope, domains, and strengths in 2–3 sentences.',
    '- Prefer measurable outcomes or concrete achievements.',
    '- Avoid redundant phrases or excessive first-person pronouns.',
    'Context:',
  ];

  if (role) lines.push(`■ロール: ${role}`);
  if (typeof years === 'number') lines.push(`■経験年数: 約${years}年`);
  if (headlineKeywords?.length)
    lines.push(`■含めたいキーワード: ${headlineKeywords.join(', ')}`);
  if (extraNotes) lines.push(`■補足: ${extraNotes}`);

  return lines.join('\n');
}

export async function POST(req: NextRequest) {
  let payload: RequestPayload;
  try {
    payload = requestSchema.parse(await req.json());
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? error.issues.map((issue) => issue.message).join(', ')
        : (error as Error).message;
    return NextResponse.json(
      { ok: false, error: { message } },
      { status: 400 }
    );
  }

  try {
    const prompt = buildPrompt(payload);
    const text = await generateGeminiText({
      prompt,
      temperature: 0.6,
      maxOutputTokens: 512,
    });

    let saved = false;
    let warn: string | undefined;

    try {
      const response = await fetch(`${req.nextUrl.origin}/api/data/resume`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: payload.resumeId, summary: text }),
        cache: 'no-store',
      });

      if (!response.ok) {
        const detail = await response.text();
        throw new Error(detail || `Failed to save summary (${response.status})`);
      }

      saved = true;
    } catch (error) {
      warn = error instanceof Error ? error.message : String(error);
    }

    return NextResponse.json({
      ok: true,
      text,
      saved,
      resumeId: payload.resumeId,
      warn,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: { message } }, { status: 500 });
  }
}
