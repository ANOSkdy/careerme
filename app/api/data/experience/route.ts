export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

import {
  createAirtableRecords,
  deleteAirtableRecords,
  hasAirtableConfig,
  listAirtableRecords,
  type AirtableRecord,
} from "../../../../lib/db/airtable";
import { ExperienceListSchema } from "../../../../lib/validation/schemas";

const TABLE_NAME = process.env.AIRTABLE_TABLE_EXPERIENCE ?? "Experience";
const WRITE_BATCH_SIZE = 10;

type ExperienceFields = {
  resumeId?: string;
  companyName?: string;
  jobTitle?: string;
  start?: string;
  end?: string;
  present?: boolean;
  current?: boolean;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
};

type ExperienceRecord = {
  id: string;
  companyName: string;
  jobTitle: string;
  start: string;
  end: string;
  present: boolean;
  description: string;
};

function sanitizeId(value: string) {
  return value.replace(/'/g, "\\'");
}

function toFilterFormula(id: string) {
  const sanitized = sanitizeId(id);
  return `{resumeId}='${sanitized}'`;
}

function normalizeRecord(record: AirtableRecord<ExperienceFields>): ExperienceRecord {
  const { id, fields } = record;
  const present = Boolean(fields.present ?? fields.current);
  const end = present ? "" : typeof fields.end === "string" ? fields.end : "";

  return {
    id,
    companyName: typeof fields.companyName === "string" ? fields.companyName : "",
    jobTitle: typeof fields.jobTitle === "string" ? fields.jobTitle : "",
    start: typeof fields.start === "string" ? fields.start : "",
    end,
    present,
    description: typeof fields.description === "string" ? fields.description : "",
  };
}

function badRequest(message: string) {
  return NextResponse.json({ ok: false, error: message }, { status: 400 });
}

function serverError(error: unknown) {
  const message = error instanceof Error ? error.message : "Internal error";
  return NextResponse.json({ ok: false, error: message }, { status: 500 });
}

function chunk<T>(values: T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

export async function GET(req: NextRequest) {
  try {
    if (!hasAirtableConfig()) {
      console.warn("[API] Airtable config missing. Returning empty experience list.");
      return NextResponse.json({
        ok: true,
        items: [],
      });
    }

    const search = req.nextUrl.searchParams;
    const resumeId = search.get("resumeId") ?? search.get("draftId");
    if (!resumeId) {
      return badRequest("resumeId is required");
    }

    const records = await listAirtableRecords<ExperienceFields>(TABLE_NAME, {
      filterByFormula: toFilterFormula(resumeId),
      fields: [
        "resumeId",
        "companyName",
        "jobTitle",
        "start",
        "end",
        "present",
        "current",
        "description",
      ],
    });

    return NextResponse.json({
      ok: true,
      items: records.map((record) => normalizeRecord(record)),
    });
  } catch (error) {
    console.error("Failed to fetch experience records", error);
    return serverError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return badRequest("Invalid JSON body");
    }

    const data = body as Record<string, unknown>;
    const resumeIdInput = (data.resumeId ?? data.draftId) as unknown;
    if (typeof resumeIdInput !== "string" || !resumeIdInput) {
      return badRequest("resumeId is required");
    }

    const resumeId = resumeIdInput;
    const items = data.items;
    if (!Array.isArray(items)) {
      return badRequest("items must be an array");
    }

    const parsed = ExperienceListSchema.safeParse(items);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, issues: parsed.error.issues }, { status: 400 });
    }

    if (!hasAirtableConfig()) {
      console.warn("[API] Airtable config missing. Skipping experience persistence.");
      return NextResponse.json({
        ok: true,
        count: parsed?.data?.length || 0,
        saved: false,
      });
    }

    const existing = await listAirtableRecords<ExperienceFields>(TABLE_NAME, {
      filterByFormula: toFilterFormula(resumeId),
      fields: ["resumeId"],
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
        companyName: item.companyName,
        jobTitle: item.jobTitle,
        start: item.start,
        end: item.present ? "" : item.end ?? "",
        present: Boolean(item.present),
        current: Boolean(item.present),
        description: item.description ?? "",
        createdAt: now,
        updatedAt: now,
      },
    }));

    for (const batch of chunk(payload, WRITE_BATCH_SIZE)) {
      await createAirtableRecords(TABLE_NAME, batch);
    }

    return NextResponse.json({ ok: true, count: parsed.data.length });
  } catch (error) {
    console.error("Failed to save experience records", error);
    return serverError(error);
  }
}
