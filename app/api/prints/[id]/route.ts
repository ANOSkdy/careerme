export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

import { getMemoryStore } from "../../../../lib/db/memory";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const store = getMemoryStore();
  const snapshot = store.prints.get(params.id);
  if (!snapshot) {
    return NextResponse.json({ ok: false, error: { message: "Not found" } }, { status: 404 });
  }
  return NextResponse.json({ ok: true, snapshot });
}
