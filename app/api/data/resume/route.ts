export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Step1Schema, Step2Schema } from "../../../resume/_schemas/resume";

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const TABLE_NAME = "Resumes";

const BodySchema = z.object({
  draftId: z.string().min(1),
  step: z.union([z.literal(1), z.literal(2)]),
  data: z.unknown(),
});

const STEP_SCHEMAS = {
  1: Step1Schema,
  2: Step2Schema,
};

type AirtableRecord = {
  id: string;
  fields: Record<string, unknown>;
};

type AirtableListResponse = {
  records: AirtableRecord[];
};

type AirtableWriteResponse = {
  id?: string;
  records?: AirtableRecord[];
};

function requireEnv() {
  if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
    throw new Error("Missing Airtable credentials");
  }
}

function envTag() {
  const source_env =
    process.env.VERCEL_ENV ??
    (process.env.NODE_ENV === "production" ? "prod" : process.env.NODE_ENV ?? "dev");
  const pr_ref = process.env.VERCEL_GIT_COMMIT_REF ?? process.env.VERCEL_BRANCH_URL ?? "local";
  return { source_env, pr_ref };
}

async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function airtableFetch<T>(path: string, init?: RequestInit, attempt = 1): Promise<T> {
  requireEnv();
  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(TABLE_NAME)}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${AIRTABLE_API_KEY}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });

  if (res.status === 429 || res.status >= 500) {
    if (attempt < 3) {
      const waitMs = Math.pow(2, attempt - 1) * 200;
      await delay(waitMs);
      return airtableFetch<T>(path, init, attempt + 1);
    }
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Airtable error ${res.status}: ${text}`);
  }

  return res.json();
}

async function findRecordByDraftId(draftId: string) {
  const params = new URLSearchParams();
  const sanitized = draftId.replace(/'/g, "\\'");
  params.set("filterByFormula", `{draftId}='${sanitized}'`);
  params.set("maxRecords", "1");
  ["draftId", "step1", "step2"].forEach((field) => params.append("fields[]", field));
  const data = await airtableFetch<AirtableListResponse>(`?${params.toString()}`);
  return data.records?.[0];
}

function parseStepField<T>(value: unknown, schema: z.ZodSchema<T>) {
  if (typeof value !== "string") return null;
  try {
    const parsed = JSON.parse(value);
    const result = schema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch (error) {
    console.error("Failed to parse step data", error);
    return null;
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const draftId = searchParams.get("draftId");
    if (!draftId) {
      return NextResponse.json({ error: "draftId required" }, { status: 400 });
    }

    const record = await findRecordByDraftId(draftId);
    if (!record) {
      return NextResponse.json({ draftId, step1: null, step2: null });
    }

    const fields = record.fields ?? {};

    return NextResponse.json({
      draftId,
      step1: parseStepField(fields.step1, Step1Schema),
      step2: parseStepField(fields.step2, Step2Schema),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { draftId, step, data } = parsed.data;
    const schema = STEP_SCHEMAS[step];
    const validated = schema.safeParse(data);
    if (!validated.success) {
      return NextResponse.json({ error: validated.error.flatten() }, { status: 400 });
    }

    const record = await findRecordByDraftId(draftId);
    const { source_env, pr_ref } = envTag();

    const stepField = step === 1 ? "step1" : "step2";
    const fields: Record<string, unknown> = {
      draftId,
      [stepField]: JSON.stringify(validated.data ?? {}),
      source_env,
      pr_ref,
      updatedAt: new Date().toISOString(),
    };

    if (record) {
      const updated = await airtableFetch<AirtableWriteResponse>(`/${record.id}`, {
        method: "PATCH",
        body: JSON.stringify({ fields }),
      });
      return NextResponse.json({ ok: true, recordId: updated.id ?? record.id });
    }

    const created = await airtableFetch<AirtableWriteResponse>("", {
      method: "POST",
      body: JSON.stringify({
        records: [
          {
            fields: {
              ...fields,
              createdAt: new Date().toISOString(),
            },
          },
        ],
      }),
    });

    return NextResponse.json({
      ok: true,
      recordId: created.records?.[0]?.id ?? null,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
