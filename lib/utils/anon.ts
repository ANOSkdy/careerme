
import { randomUUID } from "node:crypto";

import type { NextRequest, NextResponse } from "next/server";

export const ANON_COOKIE_NAME = "anon_key";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export function readAnonKey(request: Pick<NextRequest, "cookies">): string | null {
  return request.cookies.get(ANON_COOKIE_NAME)?.value ?? null;
}

export function setAnonCookie(response: NextResponse, value: string) {
  response.cookies.set({
    name: ANON_COOKIE_NAME,
    value,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ONE_YEAR_SECONDS,
  });
}

export function ensureAnonKey(
  request: Pick<NextRequest, "cookies">,
  response: NextResponse
): string {
  const existing = readAnonKey(request);
  if (existing) {
    setAnonCookie(response, existing);
    return existing;
  }
  const generated = randomUUID();
  setAnonCookie(response, generated);
  return generated;
}

export function generateAnonKey(): string {
  return randomUUID();
}
