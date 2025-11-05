export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

import type { AirtableRecord } from "../../../../lib/db/airtable";
import { createAirtableRecords, deleteAirtableRecords, listAirtableRecords } from "../../../../lib/db/airtable";
import { EducationListSchema } from "../../../resume/_schemas/resume";

const TABLE_NAME = process.env.AIRTABLE_TABLE_EDUCATION ?? "Education";
const WRITE_BATCH_SIZE = 10;

type EducationFields = {
  draftId: string;
  school: string;
  degree?: string;
  start: string;
  end?: string;
  current?: boolean;
  description?: string;
  createdAt: string;
  updatedAt: string;
};

function toFilterFormula(draftId: string) {
  return `{draftId} = ${JSON.stringify(draftId)}`;
}

function chunk<T>(values: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

function normalizeRecord(record: AirtableRecord<EducationFields>) {
  const { fields, id } = record;
  return {
    id,
    school: fields.school ?? "",
    degree: fields.degree ?? "",
    start: fields.start ?? "",
    end: fields.end ?? "",
    current: Boolean(fields.current),
    description: fields.description ?? "",
  };
}

function badRequest(message: string) {
  return NextResponse.json({ ok: false, error: message }, { status: 400 });
}

function serverError(error: unknown) {
  const message = error instanceof Error ? error.message : "Internal error";
  return NextResponse.json({ ok: false, error: message }, { status: 500 });
}

export async function GET(req: NextRequest) {
  try {
    const draftId = req.nextUrl.searchParams.get("draftId");
    if (!draftId) {
      return badRequest("draftId is required");
    }

    const records = await listAirtableRecords<EducationFields>(TABLE_NAME, {
      filterByFormula: toFilterFormula(draftId),
      fields: [
        "draftId",
        "school",
        "degree",
        "start",
        "end",
        "current",
        "description",
      ],
    });

    return NextResponse.json({
      ok: true,
      items: records.map((record) => normalizeRecord(record)),
    });
  } catch (error) {
    return serverError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return badRequest("Invalid JSON body");
    }

    const draftId = (body as { draftId?: unknown }).draftId;
    const items = (body as { items?: unknown }).items;
    if (typeof draftId !== "string" || !draftId) {
      return badRequest("draftId is required");
    }
    if (!Array.isArray(items)) {
      return badRequest("items must be an array");
    }

    const parsed = EducationListSchema.safeParse(items);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, issues: parsed.error.issues }, { status: 400 });
    }

    const existing = await listAirtableRecords<EducationFields>(TABLE_NAME, {
      filterByFormula: toFilterFormula(draftId),
      fields: ["draftId"],
    });

    if (existing.length) {
      await deleteAirtableRecords(
        TABLE_NAME,
        existing.map((record) => record.id)
      );
    }

    if (!parsed.data.length) {
      return NextResponse.json({ ok: true, count: 0 });
    }

    const now = new Date().toISOString();
    const payload = parsed.data.map((item) => {
      const fields: EducationFields = {
        draftId,
        school: item.school,
        degree: item.degree ?? "",
        start: item.start,
        end: item.current ? "" : item.end ?? "",
        current: Boolean(item.current),
        description: item.description ?? "",
        createdAt: now,
        updatedAt: now,
      };
      return { fields };
    });

    for (const group of chunk(payload, WRITE_BATCH_SIZE)) {
      await createAirtableRecords<EducationFields>(TABLE_NAME, group);
    }

    return NextResponse.json({ ok: true, count: parsed.data.length });
  } catch (error) {
    return serverError(error);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const idFromQuery = req.nextUrl.searchParams.get("id");
    let id = idFromQuery ?? null;

    if (!id) {
      const body = await req.json().catch(() => null);
      if (body && typeof body === "object" && typeof (body as { id?: unknown }).id === "string") {
        id = (body as { id: string }).id;
      }
    }

    if (!id) {
      return badRequest("id is required");
    }

    await deleteAirtableRecords(TABLE_NAME, [id]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return serverError(error);
  }
}
