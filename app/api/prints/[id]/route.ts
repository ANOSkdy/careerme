export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

import { getMemoryStore } from "../../../../lib/db/memory";

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  const cookieSnapshot = req.cookies.get(`print_snapshot_${id}`)?.value;
  if (cookieSnapshot) {
    try {
      return NextResponse.json({ ok: true, snapshot: JSON.parse(cookieSnapshot) });
    } catch (e) {
      console.error("Failed to parse print snapshot cookie", e);
    }
  }

  const store = getMemoryStore();
  const snapshot = store.prints.get(id);
  if (!snapshot) {
    return NextResponse.json({ ok: false, error: { message: "Not found" } }, { status: 404 });
  }
  return NextResponse.json({ ok: true, snapshot });
}
