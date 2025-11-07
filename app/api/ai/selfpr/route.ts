export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { generateGeminiText } from "../../../../lib/ai/gemini";
import { buildSelfPrPrompt } from "../../../../lib/ai/promptTemplates";
import { CvQaSchema } from "../../../../lib/validation/schemas";

const extrasSchema = z.object({
  experienceSummary: z.string().trim().min(1).max(1200).optional(),
});

const requestSchema = z.object({
  resumeId: z.string().min(1, "resumeId is required"),
  qa: CvQaSchema,
  extras: extrasSchema.optional(),
});

type RequestPayload = z.infer<typeof requestSchema>;

type ErrorBody = {
  ok: false;
  error: { message: string };
};

type SuccessBody = {
  ok: true;
  text: string;
  saved: boolean;
  warn?: string;
};

function json<T>(body: T, status: number) {
  return NextResponse.json(body, { status });
}

export async function POST(req: NextRequest) {
  let payload: RequestPayload;
  try {
    const jsonBody = await req.json();
    payload = requestSchema.parse(jsonBody);
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? error.issues.map((issue) => issue.message).join(", ")
        : error instanceof Error
          ? error.message
          : "Invalid request";
    return json<ErrorBody>({ ok: false, error: { message } }, 400);
  }

  try {
    const prompt = buildSelfPrPrompt(payload.qa, payload.extras);
    const text = await generateGeminiText({
      prompt,
      temperature: 0.4,
      maxOutputTokens: 768,
    });

    let saved = false;
    let warn: string | undefined;

    try {
      const response = await fetch(`${req.nextUrl.origin}/api/data/resume`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: payload.resumeId, selfPr: text }),
        cache: "no-store",
      });

      if (!response.ok) {
        const detail = await response.text();
        throw new Error(
          detail ? `Failed to save selfPr: ${detail}` : `Failed to save selfPr (${response.status})`
        );
      }

      saved = true;
    } catch (error) {
      warn = error instanceof Error ? error.message : String(error);
    }

    return json<SuccessBody>({ ok: true, text, saved, warn }, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    console.error("[api/ai/selfpr] generation failed", error);
    return json<ErrorBody>({ ok: false, error: { message } }, 500);
  }
}
