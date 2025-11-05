export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { generateGeminiText } from '../../../../lib/ai/gemini';
import { updateResumeDraft } from '../../../../lib/db/resumes';

const requestSchema = z.object({
  resumeId: z.string().min(1, 'resumeId is required'),
  locale: z.string().min(2).max(5).optional(),
  tone: z.enum(['business', 'friendly', 'formal']).optional(),
  years: z.number().nonnegative().optional(),
  role: z.string().min(1).optional(),
  skills: z.array(z.string().min(1)).max(20).optional(),
  achievements: z.array(z.string().min(1)).max(20).optional(),
  extraNotes: z.string().max(1000).optional(),
});

type RequestPayload = z.infer<typeof requestSchema>;

function buildPrompt({
  locale = 'ja',
  tone = 'business',
  years,
  role,
  skills,
  achievements,
  extraNotes,
}: RequestPayload): string {
  const lines: string[] = [
    `You are a writing assistant. Output language: ${locale}.`,
    'Task: Compose a Japanese self-promotion paragraph (自己PR).',
    'Target length: 400–800 Japanese characters.',
    `Tone: ${tone}.`,
    'Guidelines:',
    '- Begin with a single-sentence value proposition.',
    '- Highlight 2–3 strengths with measurable or concrete outcomes.',
    '- Avoid buzzwords, cliches, or repetition.',
    '- Conclude with a forward-looking statement about future contributions.',
    'Context:',
  ];

  if (role) lines.push(`■ロール: ${role}`);
  if (typeof years === 'number') lines.push(`■経験年数: 約${years}年`);
  if (skills?.length) lines.push(`■スキル: ${skills.join(', ')}`);
  if (achievements?.length)
    lines.push(`■実績: ${achievements.join(' / ')}`);
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
      temperature: 0.7,
      maxOutputTokens: 768,
    });

    try {
      await updateResumeDraft(payload.resumeId, { selfpr_draft: text });
      return NextResponse.json({
        ok: true,
        text,
        saved: true,
        resumeId: payload.resumeId,
      });
    } catch (airtableError) {
      return NextResponse.json({
        ok: true,
        text,
        saved: false,
        resumeId: payload.resumeId,
        warn: airtableError instanceof Error ? airtableError.message : String(airtableError),
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: { message } }, { status: 500 });
  }
}
