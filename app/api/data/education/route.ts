export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

import {
  combineFilterFormulas,
  createAirtableRecords,
  deleteAirtableRecords,
  hasAirtableConfig,
  listAirtableRecords,
  type AirtableRecord,
} from "../../../../lib/db/airtable";
import { EducationListSchema } from "../../../../lib/validation/schemas";
import {
  getMemoryStore,
  type MemoryEducationRecord,
  type MemoryResumeRecord,
} from "../../../../lib/db/memory";
import { readAnonKey, setAnonCookie } from "../../../../lib/utils/anon";

const TABLE_NAME = process.env.AIRTABLE_TABLE_EDUCATION ?? "Education";
const RESUME_TABLE_NAME = process.env.AIRTABLE_TABLE_RESUME ?? "Resumes";
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

type ResumeFields = {
  resumeId?: string;
  draftId?: string;
  anonKey?: string;
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

function sanitizeFormulaValue(value: string) {
  return value.replace(/'/g, "\\'");
}

function chunk<T>(values: T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

function findMemoryResume(
  id: string | null,
  anonKey: string | null
): MemoryResumeRecord | null {
  if (id && memoryStore.resumes.has(id)) {
    return memoryStore.resumes.get(id) ?? null;
  }
  if (anonKey) {
    for (const record of memoryStore.resumes.values()) {
      if (record.anonKey === anonKey) {
        return record;
      }
    }
  }
  return null;
}

function buildResumeFilter(id: string | null, anonKey: string | null) {
  const filters: Array<string | undefined> = [];
  if (id) {
    const sanitized = sanitizeFormulaValue(id);
    filters.push(`OR({resumeId}='${sanitized}', {draftId}='${sanitized}')`);
  }
  if (anonKey) {
    const sanitized = sanitizeFormulaValue(anonKey);
    filters.push(`{anonKey}='${sanitized}'`);
  }
  return combineFilterFormulas(...filters);
}

async function findAirtableResumeRecord(
  id: string | null,
  anonKey: string | null
): Promise<AirtableRecord<ResumeFields> | null> {
  const filter = buildResumeFilter(id, anonKey);
  if (!filter) return null;
  const records = await listAirtableRecords<ResumeFields>(RESUME_TABLE_NAME, {
    filterByFormula: filter,
    fields: ["resumeId", "draftId", "anonKey"],
    maxRecords: 1,
  });
  return records[0] ?? null;
}

type ResumeContext = {
  resumeId: string | null;
  anonKey: string | null;
  found: boolean;
};

async function resolveResumeContext(
  id: string | null,
  anonKey: string | null
): Promise<ResumeContext> {
  if (!hasAirtable) {
    const record = findMemoryResume(id, anonKey);
    if (record) {
      return { resumeId: record.id, anonKey: record.anonKey, found: true };
    }
    return { resumeId: null, anonKey, found: false };
  }

  const record = await findAirtableResumeRecord(id, anonKey);
  if (record) {
    const resumeId = record.fields.resumeId ?? record.fields.draftId ?? null;
    const anon = record.fields.anonKey ?? anonKey ?? null;
    return { resumeId, anonKey: anon, found: Boolean(resumeId) };
  }

  return { resumeId: null, anonKey, found: false };
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

function resumeNotFound() {
  return NextResponse.json({ ok: false, error: "resume not found" }, { status: 404 });
}

export async function GET(req: NextRequest) {
  try {
    const search = req.nextUrl.searchParams;
    const idParam = search.get("resumeId") ?? search.get("draftId");
    const anonCookie = readAnonKey(req);
    const context = await resolveResumeContext(idParam, anonCookie);
    const resumeId = context.resumeId;
    const cookieValue = context.anonKey ?? anonCookie;

    if (!resumeId) {
      const response = NextResponse.json({ ok: true, items: [] });
      if (cookieValue) {
        setAnonCookie(response, cookieValue);
      }
      return response;
    }

    if (!hasAirtable) {
      const items = getMemoryEducationRecords(resumeId);
      const response = NextResponse.json({
        ok: true,
        items: items.map(({ schoolName, faculty, start, end, present }) => ({
          schoolName,
          faculty,
          start,
          end,
          present,
        })),
      });
      if (cookieValue) {
        setAnonCookie(response, cookieValue);
      }
      return response;
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

    const response = NextResponse.json({
      ok: true,
      items: records.map((record) => normalizeRecord(record)),
    });
    if (cookieValue) {
      setAnonCookie(response, cookieValue);
    }
    return response;
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
    const resumeId = resumeIdInput as string;

    const items = (body as { items?: unknown }).items;
    if (!Array.isArray(items)) {
      return badRequest("items must be an array");
    }

    const parsed = EducationListSchema.safeParse(items);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, issues: parsed.error.issues }, { status: 400 });
    }

    const anonCookie = readAnonKey(req);
    const context = await resolveResumeContext(resumeId, anonCookie);
    const targetResumeId = context.resumeId;
    if (!targetResumeId || !context.found) {
      return resumeNotFound();
    }
    const cookieValue = context.anonKey ?? anonCookie;

    if (!hasAirtable) {
      const now = Date.now();
      const records: MemoryEducationRecord[] = parsed.data.map((item, index) => ({
        id: `${targetResumeId}-${index}-${now}`,
        resumeId: targetResumeId,
        schoolName: item.schoolName,
        faculty: item.faculty ?? "",
        start: item.start,
        end: item.present ? "" : item.end ?? "",
        present: Boolean(item.present),
      }));
      setMemoryEducationRecords(targetResumeId, records);
      const response = NextResponse.json({ ok: true, count: records.length });
      if (cookieValue) {
        setAnonCookie(response, cookieValue);
      }
      return response;
    }

    const existing = await listAirtableRecords<EducationFields>(TABLE_NAME, {
      filterByFormula: toFilterFormula(targetResumeId),
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
        resumeId: targetResumeId,
        draftId: targetResumeId,
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

    const response = NextResponse.json({ ok: true, count: parsed.data.length });
    if (cookieValue) {
      setAnonCookie(response, cookieValue);
    }
    return response;
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
