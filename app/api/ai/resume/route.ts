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
    'Task: Compose a Japanese resume (履歴書) body text suitable for a standard Japanese job application.',
    'Tone: Polite (です・ます調) and natural.',
    'Target length: 400–800 Japanese characters.',
    'Structure guidelines:',
    '- Start with a brief profile summary that sets the role intention.',
    '- Summarize strengths and notable achievements in 2–3 sentences.',
    '- Outline career overview with responsibilities, domains, and outcomes.',
    '- Close with motivation or values relevant to the target role.',
    'If some fields are missing, make reasonable, generic assumptions without hallucinating specific companies.',
    'Context:',
  ];

  if (role) lines.push(`■志望ロール: ${role}`);
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
    return NextResponse.json({ error: { message } }, { status: 400 });
  }

  try {
    const prompt = buildPrompt(payload);
    const content = await generateGeminiText({
      prompt,
      temperature: 0.6,
      maxOutputTokens: 1024,
    });

    return NextResponse.json({ content }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: { message } }, { status: 500 });
  }
}
