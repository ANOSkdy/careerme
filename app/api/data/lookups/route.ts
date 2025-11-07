export const runtime = 'nodejs';
export const revalidate = 86400;

import { NextRequest, NextResponse } from 'next/server';

import { combineFilterFormulas, listAirtableRecords } from '../../../../lib/db/airtable';

const TABLE_NAME = process.env.AIRTABLE_TABLE_LOOKUPS ?? 'Lookups';

type LookupFields = {
  type?: string;
  value?: string;
  label?: string;
  order?: number;
};

type NormalizedLookup = {
  id: string;
  type: string;
  value: string;
  label: string;
  order: number | null;
};

function sanitizeFormulaValue(value: string) {
  return value.replace(/'/g, "\\'");
}

function normalizeRecord(record: { id: string; fields: LookupFields }): NormalizedLookup {
  return {
    id: record.id,
    type: record.fields.type ?? '',
    value: record.fields.value ?? '',
    label: record.fields.label ?? record.fields.value ?? '',
    order:
      typeof record.fields.order === 'number' && Number.isFinite(record.fields.order)
        ? record.fields.order
        : null,
  };
}

export async function GET(req: NextRequest) {
  try {
    const type = req.nextUrl.searchParams.get('type');
    const filter = type
      ? combineFilterFormulas(`{type}='${sanitizeFormulaValue(type)}'`)
      : undefined;

    const records = await listAirtableRecords<LookupFields>(TABLE_NAME, {
      filterByFormula: filter,
      fields: ['type', 'value', 'label', 'order'],
      sort: [{ field: 'order', direction: 'asc' }],
      next: { revalidate },
    });

    const normalized = records.map((record) => normalizeRecord(record));
    const certificationOptions =
      type === 'certifications'
        ? normalized
            .filter((record) => record.value && record.label)
            .map((record) => ({ value: record.value, label: record.label }))
        : undefined;

    return NextResponse.json({
      ok: true,
      records: normalized,
      options: certificationOptions,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
