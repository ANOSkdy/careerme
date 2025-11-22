export const runtime = "nodejs";

import { randomUUID } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import {
  createAirtableRecords,
  hasAirtableConfig,
  listAirtableRecords,
  updateAirtableRecords,
} from "../../../../lib/db/airtable";
import { AIRTABLE_TABLES } from "../../../../lib/airtable/mapping";
import { airtableToResume, RESUME_AIRTABLE_FIELDS, resumeToAirtableFields } from "../../../../lib/db/resumes";
import { ResumeSchema, type Resume } from "../../../../lib/validation/schemas";
import { getMemoryStore, type MemoryResumeRecord } from "../../../../lib/db/memory";

const TABLE_NAME = process.env.AIRTABLE_TABLE_RESUME ?? AIRTABLE_TABLES.RESUMES;
const hasAirtable = hasAirtableConfig();
const memoryStore = getMemoryStore();

const ResumeUpsertSchema = ResumeSchema.extend({
  id: ResumeSchema.shape.id.optional(),
});

async function findAirtableResume(id: string) {
  const records = await listAirtableRecords<Record<string, unknown>>(TABLE_NAME, {
    filterByFormula: `{${RESUME_AIRTABLE_FIELDS.id}}='${id.replace(/'/g, "\'")}'`,
    fields: Object.values(RESUME_AIRTABLE_FIELDS),
    maxRecords: 1,
  });
  return records[0];
}

function findMemoryResume(id: string | null): MemoryResumeRecord | null {
  if (!id) return null;
  return memoryStore.resumes.get(id) ?? null;
}

function writeMemoryResume(record: MemoryResumeRecord) {
  memoryStore.resumes.set(record.id, record);
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ id: null });
    }

    if (!hasAirtable) {
      const record = findMemoryResume(id);
      return NextResponse.json(record ?? { id });
    }

    const record = await findAirtableResume(id);
    if (!record) {
      return NextResponse.json({ id: null });
    }

    const resume = airtableToResume(record);
    const parsed = ResumeSchema.safeParse(resume);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 500 });
    }

    return NextResponse.json(parsed.data);
  } catch (error) {
    console.error("Failed to fetch resume", error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = ResumeUpsertSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const resume: Resume = { ...parsed.data, id: parsed.data.id ?? randomUUID() } as Resume;

    if (!hasAirtable) {
      const now = new Date().toISOString();
      const updated: MemoryResumeRecord = {
        ...resume,
        createdAt: now,
        updatedAt: now,
      };
      writeMemoryResume(updated);
      return NextResponse.json({ id: resume.id });
    }

    const existing = await findAirtableResume(resume.id);
    const fields = resumeToAirtableFields(resume);
    const now = new Date().toISOString();

    if (existing) {
      await updateAirtableRecords(TABLE_NAME, [
        {
          id: existing.id,
          fields: {
            ...fields,
            [RESUME_AIRTABLE_FIELDS.updatedAt]: now,
          },
        },
      ]);
    } else {
      await createAirtableRecords(TABLE_NAME, [
        {
          fields: {
            ...fields,
            [RESUME_AIRTABLE_FIELDS.createdAt]: now,
            [RESUME_AIRTABLE_FIELDS.updatedAt]: now,
          },
        },
      ]);
    }

    return NextResponse.json({ id: resume.id });
  } catch (error) {
    console.error("Failed to update resume", error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
