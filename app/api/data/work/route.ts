export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

import {
  createAirtableRecords,
  deleteAirtableRecords,
  getPrRef,
  getSourceEnv,
  hasAirtableConfig,
  listAirtableRecords,
  updateAirtableRecords,
  type AirtableRecord,
} from "../../../../lib/db/airtable";
import { WorkRowSchema } from "../../../../lib/validation/schemas";

const TABLE_NAME = process.env.AIRTABLE_TABLE_WORK ?? "Work";
const hasAirtable = hasAirtableConfig();

const guardEnv = () => ({
  source_env: getSourceEnv(),
  pr_ref: getPrRef(),
});

type WorkFields = {
  resumeId?: string;
  company?: string;
  startYm?: string;
  endYm?: string;
  division?: string;
  title?: string;
  source_env?: string;
  pr_ref?: string;
};

type MemoryWorkRecord = {
  id: string;
  resumeId: string;
  company: string;
  startYm: string;
  endYm?: string;
  division?: string;
  title?: string;
  source_env: string;
  pr_ref: string;
};

type MemoryStore = {
  work: Map<string, MemoryWorkRecord>;
};

interface MemoryGlobal {
  __careermeWorkStore?: MemoryStore;
}

function getMemoryStore(): MemoryStore {
  const globalObj = globalThis as typeof globalThis & MemoryGlobal;
  if (!globalObj.__careermeWorkStore) {
    globalObj.__careermeWorkStore = { work: new Map() };
  }
  return globalObj.__careermeWorkStore;
}

function sanitizeId(id: string) {
  return id.replace(/'/g, "\\'");
}

function toFilterFormula(resumeId: string) {
  const sanitized = sanitizeId(resumeId);
  return `{resumeId}='${sanitized}'`;
}

function badRequest(message: string) {
  return NextResponse.json({ ok: false, error: message }, { status: 400 });
}

function serverError(error: unknown) {
  const message = error instanceof Error ? error.message : "Internal error";
  return NextResponse.json({ ok: false, error: message }, { status: 500 });
}

function normalizeRecord(record: AirtableRecord<WorkFields>) {
  const { id, fields } = record;
  return {
    id,
    company: typeof fields.company === "string" ? fields.company : "",
    startYm: typeof fields.startYm === "string" ? fields.startYm : "",
    endYm: typeof fields.endYm === "string" ? fields.endYm : "",
    division: typeof fields.division === "string" ? fields.division : "",
    title: typeof fields.title === "string" ? fields.title : "",
  };
}

function normalizeMemoryRecord(record: MemoryWorkRecord) {
  return {
    id: record.id,
    company: record.company,
    startYm: record.startYm,
    endYm: record.endYm ?? "",
    division: record.division ?? "",
    title: record.title ?? "",
  };
}

type WorkPayload = {
  id?: string;
  resumeId: string;
  company: string;
  startYm: string;
  endYm?: string;
  division?: string;
  title?: string;
};

function parsePayload(raw: unknown): WorkPayload | { error: NextResponse } {
  if (!raw || typeof raw !== "object") {
    return { error: badRequest("Invalid JSON body") };
  }

  const source = raw as Record<string, unknown>;
  const resumeId = source.resumeId;
  if (typeof resumeId !== "string" || !resumeId) {
    return { error: badRequest("resumeId is required") };
  }

  const id = typeof source.id === "string" && source.id ? source.id : undefined;

  const candidate = {
    company: source.company,
    startYm: source.startYm,
    endYm: source.endYm,
    division: source.division,
    title: source.title,
  };

  const parsed = WorkRowSchema.safeParse(candidate);
  if (!parsed.success) {
    return { error: NextResponse.json({ ok: false, issues: parsed.error.issues }, { status: 400 }) };
  }

  const data = parsed.data;
  return {
    id,
    resumeId,
    company: data.company,
    startYm: data.startYm,
    endYm: data.endYm,
    division: data.division,
    title: data.title,
  };
}

export async function GET(req: NextRequest) {
  try {
    const resumeId = req.nextUrl.searchParams.get("resumeId");
    if (!resumeId) {
      return badRequest("resumeId is required");
    }

    if (!hasAirtable) {
      const env = getSourceEnv();
      const store = getMemoryStore();
      const items = Array.from(store.work.values())
        .filter((record) => record.resumeId === resumeId && record.source_env === env)
        .map((record) => normalizeMemoryRecord(record));
      return NextResponse.json({ ok: true, items });
    }

    const records = await listAirtableRecords<WorkFields>(TABLE_NAME, {
      filterByFormula: toFilterFormula(resumeId),
      fields: ["resumeId", "company", "startYm", "endYm", "division", "title"],
    });

    return NextResponse.json({
      ok: true,
      items: records.map((record) => normalizeRecord(record)),
    });
  } catch (error) {
    console.error("Failed to fetch work records", error);
    return serverError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const parsed = parsePayload(body);
    if ("error" in parsed) {
      return parsed.error;
    }

    const { id, resumeId, company, startYm, endYm, division, title } = parsed;

    if (!hasAirtable) {
      const store = getMemoryStore();
      const recordId = id ?? `${resumeId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const record: MemoryWorkRecord = {
        id: recordId,
        resumeId,
        company,
        startYm,
        endYm,
        division,
        title,
        ...guardEnv(),
      };
      store.work.set(recordId, record);
      return NextResponse.json({ ok: true, record: normalizeMemoryRecord(record) });
    }

    const fields: WorkFields = {
      resumeId,
      company,
      startYm,
      division,
      title,
      ...guardEnv(),
    };
    if (endYm) fields.endYm = endYm;

    if (id) {
      const updated = await updateAirtableRecords<WorkFields>(TABLE_NAME, [
        {
          id,
          fields,
        },
      ]);
      const record = updated[0];
      return NextResponse.json({ ok: true, record: normalizeRecord(record) });
    }

    const created = await createAirtableRecords<WorkFields>(TABLE_NAME, [
      {
        fields,
      },
    ]);
    const record = created[0];
    return NextResponse.json({ ok: true, record: normalizeRecord(record) });
  } catch (error) {
    console.error("Failed to upsert work record", error);
    return serverError(error);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) {
      return badRequest("id is required");
    }

    if (!hasAirtable) {
      const store = getMemoryStore();
      const record = store.work.get(id);
      if (record) {
        store.work.delete(id);
      }
      return NextResponse.json({ ok: true, count: record ? 1 : 0 });
    }

    await deleteAirtableRecords(TABLE_NAME, [id]);
    return NextResponse.json({ ok: true, count: 1 });
  } catch (error) {
    console.error("Failed to delete work record", error);
    return serverError(error);
  }
}
