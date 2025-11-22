import { NextRequest, NextResponse } from 'next/server';

import { hasAirtableConfig } from '../../../../../lib/db/airtable';

export const runtime = 'nodejs';

type ResumeFields = {
  selfpr_draft?: string;
  summary_draft?: string;
  source_env?: string;
  pr_ref?: string;
};

type AirtableRecord = {
  id: string;
  fields: ResumeFields;
};

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_req: NextRequest, context: RouteContext) {
  if (!hasAirtableConfig()) {
    console.warn('[API] Airtable config missing. Returning null for resume fetch.');
    return NextResponse.json(null);
  }

  const { id } = await context.params;
  if (!id) {
    return json({ ok: false, error: { message: 'id is required' } }, 400);
  }

  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;
  if (!apiKey || !baseId) {
    return json({ ok: false, error: { message: 'Airtable env not set' } }, 500);
  }

  const table = process.env.AIRTABLE_TABLE_RESUMES || 'Resumes';
  const url = `https://api.airtable.com/v0/${encodeURIComponent(baseId)}/${encodeURIComponent(table)}/${encodeURIComponent(id)}`;

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: 'no-store',
    });

    if (res.status === 404) {
      return json({ ok: false, error: { message: 'Record not found' } }, 404);
    }

    if (!res.ok) {
      const text = await res.text();
      return json({ ok: false, error: { message: `Airtable error: ${res.status} ${text}` } }, 502);
    }

    const data = (await res.json()) as AirtableRecord;
    return json({ ok: true, id: data.id, fields: data.fields ?? {} }, 200);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return json({ ok: false, error: { message } }, 500);
  }
}

function json<T>(body: T, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
