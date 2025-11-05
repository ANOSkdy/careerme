export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const hasKey = !!process.env.GEMINI_API_KEY;
  const body = await req.json().catch(() => ({}));
  return NextResponse.json({
    ok: true,
    configured: hasKey,
    note: hasKey ? 'Gemini call will be wired in Phase 4' : 'GEMINI_API_KEY not set; Phase 0 stub.',
    echo: body ?? null
  });
}
