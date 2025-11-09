import { randomUUID } from 'node:crypto';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function ensureCorrelationId(value?: string | null): string {
  const trimmed = value?.trim();
  if (trimmed && UUID_PATTERN.test(trimmed)) {
    return trimmed;
  }
  return randomUUID();
}
