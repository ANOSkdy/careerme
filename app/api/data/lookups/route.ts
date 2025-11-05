export const runtime = 'nodejs';
export const revalidate = 86400;

import { NextResponse } from 'next/server';

import { listAirtableRecords } from '../../../../lib/db/airtable';

const TABLE_NAME = process.env.AIRTABLE_TABLE_LOOKUPS ?? 'Lookups';

type LookupFields = Record<string, unknown>;

export async function GET() {
  try {
    const records = await listAirtableRecords<LookupFields>(TABLE_NAME, {
      next: { revalidate },
    });

    return NextResponse.json({ ok: true, records });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
