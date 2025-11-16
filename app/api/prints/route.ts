export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';

import { createAirtableRecords } from '../../../lib/db/airtable';

const TABLE_NAME = process.env.AIRTABLE_TABLE_PRINT_SNAPSHOTS ?? 'PrintSnapshots';

interface PrintSnapshotFields {
  public_id: string;
  html?: string;
  template_version?: string;
  created_at?: string;
}

interface PrintSnapshotRequestBody {
  html?: unknown;
  templateVersion?: unknown;
}

function generatePublicId(): string {
  const random = Math.random().toString(36).slice(2, 8);
  const timestamp = Date.now().toString(36);
  return `ps_${timestamp}${random}`;
}

export async function POST(request: NextRequest) {
  let body: PrintSnapshotRequestBody;
  try {
    body = (await request.json()) as PrintSnapshotRequestBody;
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 },
    );
  }

  const html = typeof body.html === 'string' ? body.html : undefined;
  const templateVersion =
    typeof body.templateVersion === 'string' ? body.templateVersion : undefined;

  if (!html || !html.trim()) {
    return NextResponse.json(
      { error: 'Snapshot html is required' },
      { status: 400 },
    );
  }

  const publicId = generatePublicId();
  const createdAt = new Date().toISOString();

  try {
    await createAirtableRecords<PrintSnapshotFields>(TABLE_NAME, [
      {
        fields: {
          public_id: publicId,
          html,
          created_at: createdAt,
          ...(templateVersion ? { template_version: templateVersion } : {}),
        },
      },
    ]);

    return NextResponse.json({ id: publicId });
  } catch (error) {
    console.error('Failed to create print snapshot', error);
    return NextResponse.json(
      { error: 'Failed to create print snapshot' },
      { status: 500 },
    );
  }
}
