export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';

import { listAirtableRecords } from '../../../../lib/db/airtable';

const TABLE_NAME = process.env.AIRTABLE_TABLE_PRINT_SNAPSHOTS ?? 'PrintSnapshots';

interface PrintSnapshotFields {
  public_id?: string;
  html?: string;
  template_version?: string;
  created_at?: string;
}

function escapeFormulaValue(value: string): string {
  return value.replace(/'/g, "\\'");
}

export async function GET(
  _request: NextRequest,
  context: { params?: { id?: string } },
) {
  const id = context.params?.id;
  if (!id) {
    return NextResponse.json({ error: 'Snapshot id is required' }, { status: 400 });
  }

  const filterByFormula = `{public_id}='${escapeFormulaValue(id)}'`;

  try {
    const records = await listAirtableRecords<PrintSnapshotFields>(TABLE_NAME, {
      filterByFormula,
      maxRecords: 1,
      pageSize: 1,
    });

    const record = records[0];
    if (!record || !record.fields.public_id) {
      return NextResponse.json(
        { error: 'Snapshot not found' },
        { status: 404 },
      );
    }

    return NextResponse.json({
      id: record.fields.public_id,
      html: record.fields.html ?? '',
      templateVersion: record.fields.template_version ?? null,
      createdAt: record.fields.created_at ?? record.createdTime,
    });
  } catch (error) {
    console.error('Failed to load print snapshot', error);
    return NextResponse.json(
      { error: 'Failed to load print snapshot' },
      { status: 500 },
    );
  }
}
