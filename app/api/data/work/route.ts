export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  combineFilterFormulas,
  createAirtableRecords,
  deleteAirtableRecords,
  listAirtableRecords,
  updateAirtableRecords,
} from "../../../../lib/db/airtable";
import {
  WorkHistoryItemSchema,
  type WorkHistoryItem,
} from "../../../../lib/validation/schemas";

const TABLE_NAME = process.env.AIRTABLE_TABLE_WORK ?? "Work";

const UpsertSchema = z.object({
  id: z.string().trim().min(1).optional(),
  resumeId: z.string().trim().min(1, "履歴書IDが必要です"),
  data: WorkHistoryItemSchema,
});

type WorkFields = {
  resumeId?: string;
  company?: string;
  division?: string;
  title?: string;
  startYm?: string;
  endYm?: string | null;
  roles?: string[];
  industries?: string[];
  qualifications?: string[];
  description?: string;
};

type AirtableWorkRecord = {
  id: string;
  fields: WorkFields;
};

function sanitizeFormulaValue(value: string) {
  return value.replace(/'/g, "\\'");
}

function normalizeArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.length > 0);
}

function normalizeRecord(record: AirtableWorkRecord) {
  const fields = record.fields;
  return {
    id: record.id,
    resumeId: fields.resumeId ?? "",
    company: fields.company ?? "",
    division: fields.division ?? "",
    title: fields.title ?? "",
    startYm: fields.startYm ?? "",
    endYm: fields.endYm ?? undefined,
    roles: normalizeArray(fields.roles),
    industries: normalizeArray(fields.industries),
    qualifications: normalizeArray(fields.qualifications),
    description: fields.description ?? "",
  } satisfies WorkHistoryItem & { id: string; resumeId: string };
}

function toAirtableFields(resumeId: string, data: WorkHistoryItem): WorkFields {
  return {
    resumeId,
    company: data.company,
    division: data.division ?? "",
    title: data.title ?? "",
    startYm: data.startYm,
    endYm: data.endYm ?? null,
    roles: data.roles ?? [],
    industries: data.industries ?? [],
    qualifications: data.qualifications ?? [],
    description: data.description ?? "",
  };
}

function toErrorResponse(error: unknown, status = 500) {
  const message = error instanceof Error ? error.message : "Unknown error";
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function GET(req: NextRequest) {
  try {
    const resumeId = req.nextUrl.searchParams.get("resumeId");
    if (!resumeId) {
      return toErrorResponse(new Error("resumeId is required"), 400);
    }

    const filter = combineFilterFormulas(`{resumeId}='${sanitizeFormulaValue(resumeId)}'`);
    const records = await listAirtableRecords<WorkFields>(TABLE_NAME, {
      filterByFormula: filter,
      fields: [
        "resumeId",
        "company",
        "division",
        "title",
        "startYm",
        "endYm",
        "roles",
        "industries",
        "qualifications",
        "description",
      ],
      sort: [{ field: "startYm", direction: "desc" }],
    });

    const items = records.map((record) => normalizeRecord(record));

    return NextResponse.json({ ok: true, items });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => {
      throw new Error("Invalid JSON body");
    });
    const parsed = UpsertSchema.safeParse(body);
    if (!parsed.success) {
      return toErrorResponse(parsed.error, 400);
    }

    const { id, resumeId, data } = parsed.data;
    const fields = toAirtableFields(resumeId, data);

    if (id) {
      const updated = await updateAirtableRecords<WorkFields>(TABLE_NAME, [
        {
          id,
          fields,
        },
      ]);
      return NextResponse.json({ ok: true, id: updated[0]?.id ?? id });
    }

    const created = await createAirtableRecords<WorkFields>(TABLE_NAME, [
      {
        fields,
      },
    ]);

    return NextResponse.json({ ok: true, id: created[0]?.id ?? null });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) {
      return toErrorResponse(new Error("id is required"), 400);
    }

    await deleteAirtableRecords(TABLE_NAME, [id]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
