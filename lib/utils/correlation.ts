import { randomUUID } from 'node:crypto';

export function createCorrelationId(): string {
  return randomUUID();
}

export function ensureCorrelationId(existing?: string | null): string {
  const candidate = existing?.trim();
  if (candidate) return candidate;
  return createCorrelationId();
}
