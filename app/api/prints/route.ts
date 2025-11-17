import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AirtableRecord<T = any> = { id: string; fields: T; createdTime?: string };

const AIRTABLE_BASE_URL = process.env.AIRTABLE_BASE_URL ?? "https://api.airtable.com/v0";
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const SOURCE_ENV = process.env.SOURCE_ENV ?? "dev";
const PR_REF = process.env.PR_REF ?? "local";

function atHeaders() {
  return {
    Authorization: "Bearer " + AIRTABLE_API_KEY,
    "Content-Type": "application/json",
  };
}

export async function POST(req: Request) {
  try {
    if (!AIRTABLE_BASE_ID || !AIRTABLE_API_KEY) {
      return NextResponse.json({ ok: false, error: "Missing Airtable env" }, { status: 500 });
    }

    const body = (await req.json().catch(() => ({}))) as any;
    const resumeId = typeof body?.resumeId === "string" ? body.resumeId : "";
    const template = (body?.template as string) || "cv_v1";

    if (!resumeId || !/^rec/i.test(resumeId)) {
      return NextResponse.json({ ok: false, error: "Invalid resumeId" }, { status: 400 });
    }

    // 1) Resumes から対象レコード取得
    const resumeRes = await fetch(
      `${AIRTABLE_BASE_URL}/${AIRTABLE_BASE_ID}/Resumes/${encodeURIComponent(resumeId)}`,
      { headers: atHeaders(), cache: "no-store" }
    );
    if (!resumeRes.ok) {
      const detail = await resumeRes.text();
      return NextResponse.json(
        { ok: false, error: "Fetch resume failed", detail },
        { status: 502 }
      );
    }
    const resume = (await resumeRes.json()) as AirtableRecord<any>;

    // 2) 印刷用 render_model を生成（まずは Resumes の fields そのまま）
    const render_model = {
      template,
      resume_id: resumeId,
      fields: resume.fields ?? {},
      $generated_at: new Date().toISOString(),
    };

    // 3) PrintSnapshots へ保存
    const payloadFields = {
      resume_id: resumeId,
      template,
      payload: JSON.stringify(render_model),
      source_env: SOURCE_ENV,
      pr_ref: PR_REF,
    };

    const createRes = await fetch(
      `${AIRTABLE_BASE_URL}/${AIRTABLE_BASE_ID}/PrintSnapshots`,
      {
        method: "POST",
        headers: atHeaders(),
        body: JSON.stringify({ records: [{ fields: payloadFields }], typecast: true }),
        cache: "no-store",
      }
    );

    if (!createRes.ok) {
      const detail = await createRes.text();
      return NextResponse.json(
        { ok: false, error: "Create snapshot failed", detail },
        { status: 502 }
      );
    }

    const created = (await createRes.json()) as { records: AirtableRecord[] };
    const id = created.records?.[0]?.id;
    if (!id) {
      return NextResponse.json(
        { ok: false, error: "Create snapshot returned no id" },
        { status: 502 }
      );
    }

    return NextResponse.json(
      { ok: true, id, source_env: SOURCE_ENV, pr_ref: PR_REF },
      { status: 201 }
    );
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Unexpected error in POST /api/prints" },
      { status: 500 }
    );
  }
}
