export const runtime = 'nodejs';
import { NextResponse } from 'next/server';

export async function GET() {
  const env = process.env.VERCEL_ENV ?? 'local';
  return NextResponse.json({ ok: true, env, time: new Date().toISOString() });
}
