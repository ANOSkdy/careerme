export type YearMonth = {
  year: number;
  month: number;
};

const YEAR_MONTH_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/u;

export function parseYearMonth(value: string | null | undefined): YearMonth | null {
  if (!value || typeof value !== "string") return null;
  const match = value.match(YEAR_MONTH_PATTERN);
  if (!match) return null;
  const year = Number.parseInt(match[1] ?? "", 10);
  const month = Number.parseInt(match[2] ?? "", 10);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return null;
  return { year, month };
}

export function compareYearMonth(a: string, b: string): number {
  const parsedA = parseYearMonth(a);
  const parsedB = parseYearMonth(b);
  if (!parsedA || !parsedB) return 0;
  if (parsedA.year !== parsedB.year) return parsedA.year - parsedB.year;
  return parsedA.month - parsedB.month;
}

export function isYearMonthOrderValid(
  start: string,
  end: string | null | undefined
): boolean {
  if (!end) return true;
  const parsedStart = parseYearMonth(start);
  const parsedEnd = parseYearMonth(end);
  if (!parsedStart || !parsedEnd) return true;
  if (parsedEnd.year < parsedStart.year) return false;
  if (parsedEnd.year === parsedStart.year && parsedEnd.month < parsedStart.month) {
    return false;
  }
  return true;
}
