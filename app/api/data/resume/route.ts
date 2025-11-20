
export const runtime = "nodejs";

import { randomUUID } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  createAirtableRecords,
  hasAirtableConfig,
  listAirtableRecords,
  updateAirtableRecords,
  type AirtableRecord,
} from "../../../../lib/db/airtable";
import {
  BasicInfoSchema,
  CvQaSchema,
  DesiredConditionsSchema,
  HighestEducationSchema,
  ResumeFreeTextSchema,
  ResumeStatusSchema,
  type BasicInfo,
  type CvQa,
  type DesiredConditions,
  type HighestEducation,
  type ResumeStatus,
} from "../../../../lib/validation/schemas";
import { generateAnonKey, readAnonKey, setAnonCookie } from "../../../../lib/utils/anon";
import { getMemoryStore, type MemoryResumeRecord } from "../../../../lib/db/memory";

const TABLE_NAME = process.env.AIRTABLE_TABLE_RESUME ?? "Resumes";
const hasAirtable = hasAirtableConfig();
const memoryStore = getMemoryStore();

type MemoryResumeWithDesired = MemoryResumeRecord & { desired?: DesiredConditions };

function findMemoryResume(
  id: string | null,
  anonKey: string | null
): MemoryResumeWithDesired | null {
  if (id && memoryStore.resumes.has(id)) {
    return (memoryStore.resumes.get(id) as MemoryResumeWithDesired | undefined) ?? null;
  }
  if (anonKey) {
    for (const record of memoryStore.resumes.values()) {
      if (record.anonKey === anonKey) {
        return record as MemoryResumeWithDesired;
      }
    }
  }
  return null;
}

function writeMemoryResume(record: MemoryResumeWithDesired) {
  memoryStore.resumes.set(record.id, record);
}

function handleMemoryPost(req: NextRequest, payload: z.infer<typeof UpdatePayloadSchema>) {
  const {
    id: bodyId,
    basicInfo,
    status,
    highestEducation,
    qa,
    selfPr,
    summary,
    desired,
    touch,
  } = payload;
  const anonCookie = readAnonKey(req);
  const existing = findMemoryResume(bodyId ?? null, anonCookie);

  const resumeId = existing?.id ?? bodyId ?? randomUUID();
  const anonKey = existing?.anonKey ?? anonCookie ?? generateAnonKey();

  const hasUpdates =
    Boolean(basicInfo) ||
    Boolean(status) ||
    typeof highestEducation !== "undefined" ||
    typeof qa !== "undefined" ||
    typeof selfPr !== "undefined" ||
    typeof summary !== "undefined" ||
    typeof desired !== "undefined";

  if (!hasUpdates && !touch) {
    const response = NextResponse.json({ id: resumeId });
    setAnonCookie(response, anonKey);
    return response;
  }

  const now = new Date().toISOString();
  const baseRecord: MemoryResumeWithDesired = existing ?? {
    id: resumeId,
    anonKey,
    createdAt: now,
    updatedAt: now,
  };

  const updated: MemoryResumeWithDesired = {
    ...baseRecord,
    updatedAt: now,
  };

  if (basicInfo) {
    updated.basicInfo = basicInfo;
  }
  if (status) {
    updated.status = status;
  }
  if (typeof highestEducation !== "undefined") {
    updated.highestEducation = highestEducation;
  }
  if (typeof qa !== "undefined") {
    updated.qa = qa ?? undefined;
  }
  if (typeof selfPr !== "undefined") {
    updated.selfPr = selfPr;
  }
  if (typeof summary !== "undefined") {
    updated.summary = summary;
  }
  if (typeof desired !== "undefined") {
    updated.desired = desired;
  }

  writeMemoryResume(updated);

  const response = NextResponse.json({ id: updated.id });
  setAnonCookie(response, updated.anonKey);
  return response;
}

const UpdatePayloadSchema = z
  .object({
    id: z.string().min(1).optional(),
    basicInfo: BasicInfoSchema.optional(),
    status: ResumeStatusSchema.optional(),
    highestEducation: HighestEducationSchema.optional(),
    qa: CvQaSchema.optional(),
    selfPr: ResumeFreeTextSchema.optional(),
    summary: ResumeFreeTextSchema.optional(),
    desired: DesiredConditionsSchema.optional(),
    touch: z.boolean().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.touch) return;
    if (
      value.basicInfo ||
      value.status ||
      typeof value.highestEducation !== "undefined" ||
      typeof value.qa !== "undefined" ||
      typeof value.selfPr !== "undefined" ||
      typeof value.summary !== "undefined" ||
      typeof value.desired !== "undefined"
    ) {
      return;
    }
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "更新内容がありません",
    });
  });

type ResumeFields = {
  draftId?: string;
  resumeId?: string;
  anonKey?: string;
  step1?: string;
  step2?: string;
  highestEducation?: string;
  qa?: string;
  selfPr?: string;
  summary?: string;
  desired?: string;
  createdAt?: string;
  updatedAt?: string;
};

function extractUnknownFields(error: unknown): string[] {
  const message = (error as Error).message;
  const single = message.match(/Unknown field name:\s*"([^"]+)"/i);
  if (single?.[1]) return [single[1]];

  const multiple = message.match(/Unknown field names?:\s*([A-Za-z0-9_,\s"']+)/i);
  if (multiple?.[1]) {
    return multiple[1]
      .replace(/["']/g, "")
      .split(/[,\s]+/)
      .map((value) => value.trim())
      .filter(Boolean);
  }

  return [];
}

async function writeWithUnknownFieldRetry<T>(
  fields: ResumeFields,
  writer: (cleanFields: ResumeFields) => Promise<T>
): Promise<T> {
  const ignored = new Set<string>();
  let current = { ...fields };

  for (;;) {
    try {
      return await writer(current);
    } catch (error) {
      const unknownFields = extractUnknownFields(error);
      const removable = unknownFields.filter(
        (field) => field in current && !ignored.has(field)
      );

      if (!removable.length) throw error;

      for (const field of removable) {
        delete (current as Record<string, unknown>)[field];
        ignored.add(field);
      }

      console.warn(
        "Retrying Airtable write without unknown field(s):",
        removable.join(", ")
      );
    }
  }
}

function sanitizeFormulaValue(value: string) {
  return value.replace(/'/g, "\'");
}

function buildCandidateFilters(id: string | null, anonKey: string | null) {
  const filters: Array<{ formula: string; fields: string[] }> = [];
  const baseFields = [
    "anonKey",
    "step1",
    "step2",
    "highestEducation",
    "qa",
    "selfPr",
    "summary",
    "desired",
  ];

  if (id) {
    const sanitizedId = sanitizeFormulaValue(id);
    filters.push({
      formula: `{draftId}='${sanitizedId}'`,
      fields: [...baseFields, "draftId", "resumeId"],
    });
    filters.push({
      formula: `{resumeId}='${sanitizedId}'`,
      fields: [...baseFields, "resumeId", "draftId"],
    });
    filters.push({
      formula: `RECORD_ID()='${sanitizedId}'`,
      fields: [...baseFields, "draftId", "resumeId"],
    });
  }

  if (anonKey) {
    const sanitizedAnon = sanitizeFormulaValue(anonKey);
    filters.push({
      formula: `{anonKey}='${sanitizedAnon}'`,
      fields: [...baseFields, "draftId", "resumeId"],
    });
  }

  return filters;
}

function parseJsonField<T>(raw: unknown, schema: z.ZodSchema<T>): T | null {
  if (typeof raw !== "string") return null;
  try {
    const parsed = JSON.parse(raw);
    const result = schema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch (error) {
    console.warn("Failed to parse JSON field", error);
    return null;
  }
}

async function tryListRecords(
  filterByFormula: string,
  fields: string[]
): Promise<AirtableRecord<ResumeFields> | null> {
  try {
    const records = await listAirtableRecords<ResumeFields>(TABLE_NAME, {
      filterByFormula,
      fields,
      maxRecords: 1,
    });
    return records[0] ?? null;
  } catch (error) {
    const message = (error as Error).message;
    if (message.includes("Unknown field name")) {
      console.warn("Skipping Airtable query due to missing field", message);
      return null;
    }
    throw error;
  }
}

async function findResumeRecord(id: string | null, anonKey: string | null) {
  const candidates = buildCandidateFilters(id, anonKey);
  for (const { formula, fields } of candidates) {
    const record = await tryListRecords(formula, Array.from(new Set(fields)));
    if (record) return record;
  }
  return null;
}

function parseHighestEducation(value: unknown): HighestEducation | null {
  if (typeof value !== "string") return null;
  const parsed = HighestEducationSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const idParam = searchParams.get("id");
    const anonCookie = readAnonKey(req);

    if (!hasAirtable) {
      const record = findMemoryResume(idParam, anonCookie);
      const resumeId = record?.id ?? idParam ?? null;
      const response = NextResponse.json({
        id: resumeId,
        basicInfo: record?.basicInfo ?? null,
        status: record?.status ?? null,
        highestEducation: record?.highestEducation ?? null,
        qa: record?.qa ?? null,
        selfPr: record?.selfPr ?? null,
        summary: record?.summary ?? null,
        desired: record?.desired ?? null,
      });

      const anonKey = record?.anonKey ?? anonCookie ?? generateAnonKey();
      setAnonCookie(response, anonKey);

      return response;
    }

    const record = await findResumeRecord(idParam, anonCookie);
    const resumeId = record?.fields.draftId ?? record?.fields.resumeId ?? record?.id ?? idParam ?? null;
    const basicInfo = record?.fields.step1
      ? parseJsonField<BasicInfo>(record.fields.step1, BasicInfoSchema)
      : null;
    const status = record?.fields.step2
      ? parseJsonField<ResumeStatus>(record.fields.step2, ResumeStatusSchema)
      : null;
    const highestEducation = parseHighestEducation(record?.fields.highestEducation);
    const qa = record?.fields.qa
      ? parseJsonField<CvQa>(record.fields.qa, CvQaSchema)
      : null;
    const selfPr = typeof record?.fields.selfPr === "string" ? record.fields.selfPr : null;
    const summary = typeof record?.fields.summary === "string" ? record.fields.summary : null;
    const desired = record?.fields.desired
      ? parseJsonField<DesiredConditions>(record.fields.desired, DesiredConditionsSchema)
      : null;

    const response = NextResponse.json({
      id: resumeId,
      basicInfo,
      status,
      highestEducation,
      qa,
      selfPr,
      summary,
      desired,
    });

    const anonKey = record?.fields.anonKey ?? anonCookie ?? generateAnonKey();
    setAnonCookie(response, anonKey);

    return response;
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

    const parsed = UpdatePayloadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    if (!hasAirtable) {
      return handleMemoryPost(req, parsed.data);
    }

    const { id: bodyId, basicInfo, status, highestEducation, qa, selfPr, summary, desired, touch } =
      parsed.data;
    const anonCookie = readAnonKey(req);

    const existingRecord = await findResumeRecord(bodyId ?? null, anonCookie);

    let resumeId =
      existingRecord?.fields.draftId ?? existingRecord?.fields.resumeId ?? existingRecord?.id ?? bodyId ?? randomUUID();

    const anonKey = existingRecord?.fields.anonKey ?? anonCookie ?? generateAnonKey();

    const hasUpdates =
      Boolean(basicInfo) ||
      Boolean(status) ||
      typeof highestEducation !== "undefined" ||
      typeof qa !== "undefined" ||
      typeof selfPr !== "undefined" ||
      typeof summary !== "undefined" ||
      typeof desired !== "undefined";

    if (!hasUpdates && !touch) {
      const response = NextResponse.json({ id: resumeId });
      setAnonCookie(response, anonKey);
      return response;
    }

    const now = new Date().toISOString();
    const baseFields: ResumeFields = {
      anonKey,
      updatedAt: now,
    };

    if (basicInfo) {
      baseFields.step1 = JSON.stringify(basicInfo);
    }
    if (status) {
      baseFields.step2 = JSON.stringify(status);
    }
    if (typeof highestEducation !== "undefined") {
      baseFields.highestEducation = highestEducation;
    }
    if (typeof qa !== "undefined") {
      baseFields.qa = JSON.stringify(qa);
    }
    if (typeof selfPr !== "undefined") {
      baseFields.selfPr = selfPr;
    }
    if (typeof summary !== "undefined") {
      baseFields.summary = summary;
    }
    if (typeof desired !== "undefined") {
      baseFields.desired = JSON.stringify(desired);
    }

    const fieldsWithIds: ResumeFields = { ...baseFields };
    if (typeof existingRecord?.fields.draftId === "string") {
      fieldsWithIds.draftId = resumeId;
    }
    if (typeof existingRecord?.fields.resumeId === "string") {
      fieldsWithIds.resumeId = resumeId;
    }

    const attemptUpdate = async (fields: ResumeFields) =>
      writeWithUnknownFieldRetry(fields, (cleanFields) =>
        updateAirtableRecords(TABLE_NAME, [
          {
            id: existingRecord!.id,
            fields: cleanFields,
          },
        ])
      );

    if (existingRecord) {
      await attemptUpdate(fieldsWithIds);
    } else {
      const attemptCreate = async (fields: ResumeFields) =>
        writeWithUnknownFieldRetry(fields, (cleanFields) =>
          createAirtableRecords(TABLE_NAME, [
            {
              fields: {
                ...cleanFields,
                createdAt: now,
              },
            },
          ])
        );

      const created = await attemptCreate(fieldsWithIds);
      const createdRecord = created[0];
      resumeId =
        createdRecord.fields.draftId ?? createdRecord.fields.resumeId ?? createdRecord.id ?? resumeId;
    }

    const response = NextResponse.json({ id: resumeId });
    setAnonCookie(response, anonKey);
    return response;
  } catch (error) {
    console.error("Failed to update resume", error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
