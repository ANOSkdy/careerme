export const runtime = "nodejs";

import { randomUUID } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getMemoryStore } from "../../../lib/db/memory";

const PostSchema = z.object({
  resumeId: z.string().min(1),
  template: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const json = await req.json().catch(() => null);
  const parsed = PostSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: { message: "Invalid payload" } }, { status: 400 });
  }

  const { resumeId, template } = parsed.data;
  const id = randomUUID();

  const store = getMemoryStore();
  const snapshot = {
    id,
    resumeId,
    template,
    createdAt: new Date().toISOString(),
    payload: json,
  };

  store.prints.set(id, snapshot);

  const response = NextResponse.json({ ok: true, id });
  response.cookies.set(`print_snapshot_${id}`, JSON.stringify(snapshot), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10,
  });
  return response;
}
