import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    { ok: true, note: "GET /api/prints/[id] stub" },
    { status: 200 }
  );
}
