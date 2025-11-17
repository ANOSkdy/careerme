export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

import { getMemoryStore } from "../../../../lib/db/memory";

export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  const store = getMemoryStore();
  const snapshot = store.prints.get(id);
  if (!snapshot) {
    return NextResponse.json({ ok: false, error: { message: "Not found" } }, { status: 404 });
  }
  return NextResponse.json({ ok: true, snapshot });
}
