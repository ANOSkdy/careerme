export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';

import {
  createAirtableRecords,
  deleteAirtableRecords,
  listAirtableRecords,
  updateAirtableRecords,
} from '../../../../lib/db/airtable';

const TABLE_NAME = process.env.AIRTABLE_TABLE_RESUME ?? 'Resume';

type ResumeFields = Record<string, unknown>;

class BadRequestError extends Error {}

function sanitizeFields(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new BadRequestError('Invalid record fields payload');
  }

  const fields = { ...(input as Record<string, unknown>) };
  delete (fields as Record<string, unknown> & { source_env?: unknown }).source_env;
  delete (fields as Record<string, unknown> & { pr_ref?: unknown }).pr_ref;
  delete (fields as Record<string, unknown> & { id?: unknown }).id;
  return fields;
}

function parseCreateBody(body: unknown) {
  if (!body || typeof body !== 'object') {
    throw new BadRequestError('Invalid request body');
  }

  const data = body as Record<string, unknown>;

  if (Array.isArray(data.records)) {
    return data.records.map((record) => {
      if (!record || typeof record !== 'object') {
        throw new BadRequestError('Invalid record payload');
      }

      const recordObject = record as Record<string, unknown>;
      if (
        'fields' in recordObject &&
        recordObject.fields &&
        typeof recordObject.fields === 'object'
      ) {
        return { fields: sanitizeFields(recordObject.fields) };
      }

      return { fields: sanitizeFields(recordObject) };
    });
  }

  if ('fields' in data && data.fields && typeof data.fields === 'object') {
    return [{ fields: sanitizeFields(data.fields) }];
  }

  return [{ fields: sanitizeFields(body) }];
}

function parseUpdateBody(body: unknown) {
  if (!body || typeof body !== 'object') {
    throw new BadRequestError('Invalid request body');
  }

  const data = body as Record<string, unknown>;
  const records = Array.isArray(data.records) ? data.records : [body];

  return records.map((record) => {
    if (!record || typeof record !== 'object') {
      throw new BadRequestError('Invalid record payload');
    }

    const recordObject = record as Record<string, unknown>;
    const id = recordObject.id;

    if (typeof id !== 'string' || !id) {
      throw new BadRequestError('Record id is required');
    }

    if (
      'fields' in recordObject &&
      recordObject.fields &&
      typeof recordObject.fields === 'object'
    ) {
      return { id, fields: sanitizeFields(recordObject.fields) };
    }

    return { id, fields: sanitizeFields(recordObject) };
  });
}

function parseDeleteIds(body: unknown): string[] {
  if (!body || typeof body !== 'object') {
    return [];
  }

  const data = body as Record<string, unknown>;

  if (Array.isArray(data.ids)) {
    return data.ids.filter(
      (value): value is string => typeof value === 'string' && value.length > 0,
    );
  }

  if (Array.isArray(data.records)) {
    return data.records.filter(
      (value): value is string => typeof value === 'string' && value.length > 0,
    );
  }

  if (typeof data.id === 'string' && data.id) {
    return [data.id];
  }

  return [];
}

function toErrorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : 'Unknown error';
  const status = error instanceof BadRequestError ? 400 : 500;
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function GET(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id');
    const filterByFormula = id ? `RECORD_ID()='${id}'` : undefined;
    const records = await listAirtableRecords<ResumeFields>(TABLE_NAME, {
      filterByFormula,
    });

    return NextResponse.json({ ok: true, records });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => {
      throw new BadRequestError('Invalid JSON body');
    });

    const records = parseCreateBody(body);
    const created = await createAirtableRecords<ResumeFields>(TABLE_NAME, records);

    return NextResponse.json({ ok: true, records: created });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json().catch(() => {
      throw new BadRequestError('Invalid JSON body');
    });

    const records = parseUpdateBody(body);
    const updated = await updateAirtableRecords<ResumeFields>(TABLE_NAME, records);

    return NextResponse.json({ ok: true, records: updated });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json().catch(() => {
      throw new BadRequestError('Invalid JSON body');
    });

    const records = parseUpdateBody(body);
    const updated = await updateAirtableRecords<ResumeFields>(TABLE_NAME, records, {
      replace: true,
    });

    return NextResponse.json({ ok: true, records: updated });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const idsFromBody = parseDeleteIds(body);
    const idFromQuery = req.nextUrl.searchParams.getAll('id');
    const ids = Array.from(new Set([...idsFromBody, ...idFromQuery].filter(Boolean)));

    if (!ids.length) {
      throw new BadRequestError('At least one record id is required for deletion');
    }

    const deleted = await deleteAirtableRecords(TABLE_NAME, ids);

    return NextResponse.json({ ok: true, records: deleted });
  } catch (error) {
    return toErrorResponse(error);
  }
}
