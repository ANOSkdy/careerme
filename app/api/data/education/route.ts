export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

import {
  createAirtableRecords,
  deleteAirtableRecords,
  hasAirtableConfig,
  listAirtableRecords,
  type AirtableRecord,
} from "../../../../lib/db/airtable";
import { EducationListSchema } from "../../../../lib/validation/schemas";
import { getMemoryStore, type MemoryEducationRecord } from "../../../../lib/db/memory";

const TABLE_NAME = process.env.AIRTABLE_TABLE_EDUCATION ?? "Education";
const WRITE_BATCH_SIZE = 10;
const hasAirtable = hasAirtableConfig();
const memoryStore = getMemoryStore();

type EducationFields = {
  resumeId?: string;
  draftId?: string;
  schoolName?: string;
  faculty?: string;
  school?: string;
  degree?: string;
  start?: string;
  end?: string;
  present?: boolean;
  current?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

type EducationRecord = {
  id: string;
  schoolName: string;
  faculty: string;
  start: string;
  end: string;
  present: boolean;
};

function getMemoryEducationRecords(resumeId: string): MemoryEducationRecord[] {
  const records = memoryStore.education.get(resumeId);
  return records ? [...records] : [];
}

function setMemoryEducationRecords(resumeId: string, records: MemoryEducationRecord[]) {
  if (records.length) {
    memoryStore.education.set(resumeId, records);
  } else {
    memoryStore.education.delete(resumeId);
  }
}

function removeMemoryEducationRecord(id: string) {
  for (const [resumeId, records] of memoryStore.education.entries()) {
    const index = records.findIndex((record) => record.id === id);
    if (index !== -1) {
      const next = [...records.slice(0, index), ...records.slice(index + 1)];
      setMemoryEducationRecords(resumeId, next);
      return true;
    }
  }
  return false;
}

function sanitizeId(id: string) {
  return id.replace(/'/g, "\\'");
}

function toFilterFormula(id: string) {
  const sanitized = sanitizeId(id);
  return `OR({resumeId}='${sanitized}', {draftId}='${sanitized}')`;
}

function chunk<T>(values: T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

function normalizeRecord(record: AirtableRecord<EducationFields>): EducationRecord {
  const { id, fields } = record;
  const present = Boolean(fields.present ?? fields.current);
  const endValue = present ? "" : typeof fields.end === "string" ? fields.end : "";

  return {
    id,
    schoolName: fields.schoolName ?? fields.school ?? "",
    faculty: fields.faculty ?? fields.degree ?? "",
    start: typeof fields.start === "string" ? fields.start : "",
    end: endValue,
    present,
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
    const search = req.nextUrl.searchParams;
    const resumeId = search.get("resumeId") ?? search.get("draftId");
    if (!resumeId) {
      return badRequest("resumeId is required");
    }

    if (!hasAirtable) {
      const items = getMemoryEducationRecords(resumeId);
      return NextResponse.json({
        ok: true,
        items: items.map(({ schoolName, faculty, start, end, present }) => ({
          schoolName,
          faculty,
          start,
          end,
          present,
        })),
      });
    }

    const records = await listAirtableRecords<EducationFields>(TABLE_NAME, {
      filterByFormula: toFilterFormula(resumeId),
      fields: [
        "resumeId",
        "draftId",
        "schoolName",
        "faculty",
        "school",
        "degree",
        "start",
        "end",
        "present",
        "current",
      ],
    });

    return NextResponse.json({
      ok: true,
      items: records.map((record) => normalizeRecord(record)),
    });
  } catch (error) {
    console.error("Failed to fetch education records", error);
    return serverError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return badRequest("Invalid JSON body");
    }

    const resumeIdInput = (body as { resumeId?: unknown; draftId?: unknown }).resumeId ??
      (body as { draftId?: unknown }).draftId;
    if (typeof resumeIdInput !== "string" || !resumeIdInput) {
      return badRequest("resumeId is required");
    }
    const resumeId = resumeIdInput;

    const items = (body as { items?: unknown }).items;
    if (!Array.isArray(items)) {
      return badRequest("items must be an array");
    }

    const parsed = EducationListSchema.safeParse(items);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, issues: parsed.error.issues }, { status: 400 });
    }

    if (!hasAirtable) {
      const now = Date.now();
      const records: MemoryEducationRecord[] = parsed.data.map((item, index) => ({
        id: `${resumeId}-${index}-${now}`,
        resumeId,
        schoolName: item.schoolName,
        faculty: item.faculty ?? "",
        start: item.start,
        end: item.present ? "" : item.end ?? "",
        present: Boolean(item.present),
      }));
      setMemoryEducationRecords(resumeId, records);
      return NextResponse.json({ ok: true, count: records.length });
    }

    const existing = await listAirtableRecords<EducationFields>(TABLE_NAME, {
      filterByFormula: toFilterFormula(resumeId),
      fields: ["resumeId", "draftId"],
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
    const payload = parsed.data.map((item) => ({
      fields: {
        resumeId,
        draftId: resumeId,
        schoolName: item.schoolName,
        faculty: item.faculty ?? "",
        school: item.schoolName,
        degree: item.faculty ?? "",
        start: item.start,
        end: item.present ? "" : item.end ?? "",
        present: Boolean(item.present),
        current: Boolean(item.present),
        createdAt: now,
        updatedAt: now,
      },
    }));

    for (const group of chunk(payload, WRITE_BATCH_SIZE)) {
      await createAirtableRecords(TABLE_NAME, group);
    }

    return NextResponse.json({ ok: true, count: parsed.data.length });
  } catch (error) {
    console.error("Failed to save education records", error);
    return serverError(error);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const idFromQuery = req.nextUrl.searchParams.get("id");
    let id = idFromQuery ?? null;

    if (!id) {
      const body = await req.json().catch(() => null);
      if (
        body &&
        typeof body === "object" &&
        typeof (body as { id?: unknown }).id === "string"
      ) {
        id = (body as { id: string }).id;
      }
    }

    if (!id) {
      return badRequest("id is required");
    }

    if (!hasAirtable) {
      removeMemoryEducationRecord(id);
      return NextResponse.json({ ok: true });
    }

    await deleteAirtableRecords(TABLE_NAME, [id]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to delete education record", error);
    return serverError(error);
  }
}
