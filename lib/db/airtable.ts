import { setTimeout as sleep } from 'node:timers/promises';

export type SourceEnv = 'prod' | 'preview' | 'dev';

export interface AirtableRecord<TFields extends Record<string, unknown>> {
  id: string;
  createdTime: string;
  fields: TFields & GuardFields;
}

interface GuardFields {
  source_env: SourceEnv;
  pr_ref: string;
}

interface AirtableListResponse<TFields extends Record<string, unknown>> {
  records: AirtableRecord<TFields>[];
  offset?: string;
}

interface AirtableWriteRecord<TFields extends Record<string, unknown>> {
  id?: string;
  fields: TFields;
}

interface AirtableRequestOptions
  extends Omit<RequestInit, 'body' | 'headers' | 'cache'> {
  body?: BodyInit | null | Record<string, unknown> | Array<unknown>;
  headers?: HeadersInit;
  searchParams?: URLSearchParams;
  next?: { revalidate?: number };
  cache?: RequestCache;
}

export const AIRTABLE_PAGE_SIZE = 100;
const MAX_RETRIES = 3;

function getAirtableBaseUrl(): string {
  const baseId = process.env.AIRTABLE_BASE_ID;
  if (!baseId) {
    throw new Error('Missing AIRTABLE_BASE_ID environment variable');
  }

  return `https://api.airtable.com/v0/${baseId}`;
}

function getAirtableApiKey(): string {
  const apiKey = process.env.AIRTABLE_API_KEY;
  if (!apiKey) {
    throw new Error('Missing AIRTABLE_API_KEY environment variable');
  }

  return apiKey;
}

export function getSourceEnv(): SourceEnv {
  const vercelEnv = process.env.VERCEL_ENV;
  if (vercelEnv === 'production') return 'prod';
  if (vercelEnv === 'preview') return 'preview';
  return 'dev';
}

export function getPrRef(): string {
  return (
    process.env.VERCEL_GIT_PULL_REQUEST_ID ||
    process.env.VERCEL_GIT_COMMIT_REF ||
    process.env.VERCEL_URL ||
    'local'
  );
}

export function hasAirtableConfig(): boolean {
  return Boolean(process.env.AIRTABLE_BASE_ID && process.env.AIRTABLE_API_KEY);
}

export function combineFilterFormulas(
  ...formulas: Array<string | undefined | null>
): string | undefined {
  const valid = formulas.filter((formula): formula is string => Boolean(formula));
  if (!valid.length) return undefined;
  if (valid.length === 1) return valid[0];
  return `AND(${valid.join(',')})`;
}

function ensureGuardFields(
  fields: Record<string, unknown>
): Record<string, unknown> & GuardFields {
  const cleanFields = { ...fields } as Record<string, unknown> &
    Partial<GuardFields>;
  delete cleanFields.source_env;
  delete cleanFields.pr_ref;

  return {
    ...cleanFields,
    source_env: getSourceEnv(),
    pr_ref: getPrRef(),
  } as Record<string, unknown> & GuardFields;
}

async function airtableFetch<T>(
  table: string,
  path: string,
  options: AirtableRequestOptions = {}
): Promise<T> {
  const url = new URL(`${getAirtableBaseUrl()}/${table}${path}`);
  if (options.searchParams) {
    url.search = options.searchParams.toString();
  }

  const { headers, body, cache, next, ...rest } = options;

  const mergedHeaders = new Headers({
    Authorization: `Bearer ${getAirtableApiKey()}`,
    'Content-Type': 'application/json',
  });

  if (headers) {
    if (headers instanceof Headers) {
      for (const [key, value] of headers.entries()) {
        mergedHeaders.set(key, value);
      }
    } else if (Array.isArray(headers)) {
      for (const [key, value] of headers) {
        mergedHeaders.set(key, value);
      }
    } else {
      Object.entries(headers as Record<string, string | string[]>).forEach(
        ([key, value]) => {
          if (Array.isArray(value)) {
            value.forEach((val) => mergedHeaders.set(key, val));
          } else if (typeof value !== 'undefined') {
            mergedHeaders.set(key, value);
          }
        }
      );
    }
  }

  const init: RequestInit & { next?: { revalidate?: number } } = {
    ...rest,
    method: rest.method ?? 'GET',
    headers: mergedHeaders,
  };

  if (typeof cache !== 'undefined') {
    init.cache = cache;
  } else if (!next?.revalidate) {
    init.cache = 'no-store';
  }

  if (typeof body !== 'undefined') {
    if (
      body === null ||
      typeof body === 'string' ||
      body instanceof URLSearchParams ||
      body instanceof FormData ||
      body instanceof Blob ||
      body instanceof ArrayBuffer ||
      ArrayBuffer.isView(body)
    ) {
      init.body = body as BodyInit | null;
    } else {
      init.body = JSON.stringify(body);
    }
  }

  if (next) {
    init.next = next;
  }

  for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
    const response = await fetch(url, init);
    if (response.ok) {
      return (await response.json()) as T;
    }

    if (response.status !== 429 && response.status < 500) {
      const text = await response.text();
      throw new Error(
        `Airtable request failed (${response.status}): ${text || response.statusText}`
      );
    }

    if (attempt === MAX_RETRIES - 1) {
      const text = await response.text();
      throw new Error(
        `Airtable request failed after retries (${response.status}): ${
          text || response.statusText
        }`
      );
    }

    const delay = 250 * 2 ** attempt;
    await sleep(delay);
  }

  throw new Error('Unexpected Airtable retry loop termination');
}

export async function listAirtableRecords<TFields extends Record<string, unknown>>(
  table: string,
  options: {
    filterByFormula?: string;
    fields?: string[];
    maxRecords?: number;
    sort?: { field: string; direction?: 'asc' | 'desc' }[];
    view?: string;
    pageSize?: number;
    next?: { revalidate?: number };
  } = {}
): Promise<AirtableRecord<TFields>[]> {
  const records: AirtableRecord<TFields>[] = [];
  let offset: string | undefined;
  const pageSize = options.pageSize ?? AIRTABLE_PAGE_SIZE;

  const envFormula = `{source_env}='${getSourceEnv()}'`;
  const filterByFormula = combineFilterFormulas(envFormula, options.filterByFormula);

  do {
    const searchParams = new URLSearchParams();
    searchParams.set('pageSize', String(pageSize));
    if (filterByFormula) {
      searchParams.set('filterByFormula', filterByFormula);
    }

    options.fields?.forEach((field) => {
      searchParams.append('fields[]', field);
    });

    if (options.maxRecords) {
      searchParams.set('maxRecords', String(options.maxRecords));
    }

    options.sort?.forEach((sort, index) => {
      searchParams.append(`sort[${index}][field]`, sort.field);
      if (sort.direction) {
        searchParams.append(`sort[${index}][direction]`, sort.direction);
      }
    });

    if (options.view) {
      searchParams.set('view', options.view);
    }

    if (offset) {
      searchParams.set('offset', offset);
    }

    const response = await airtableFetch<AirtableListResponse<TFields>>(table, '', {
      searchParams,
      next: options.next,
    });

    records.push(...response.records);

    if (options.maxRecords && records.length >= options.maxRecords) {
      return records.slice(0, options.maxRecords);
    }

    offset = response.offset;
  } while (offset);

  return records;
}

export async function createAirtableRecords<TFields extends Record<string, unknown>>(
  table: string,
  records: AirtableWriteRecord<TFields>[],
  options: { typecast?: boolean } = {}
): Promise<AirtableRecord<TFields>[]> {
  const payload = {
    records: records.map((record) => ({
      fields: ensureGuardFields(record.fields),
    })),
    typecast: options.typecast,
  };

  const response = await airtableFetch<AirtableListResponse<TFields>>(table, '', {
    method: 'POST',
    body: payload,
  });

  return response.records;
}

export async function updateAirtableRecords<TFields extends Record<string, unknown>>(
  table: string,
  records: AirtableWriteRecord<TFields>[],
  options: { typecast?: boolean; replace?: boolean } = {}
): Promise<AirtableRecord<TFields>[]> {
  const payload = {
    records: records.map((record) => ({
      id: record.id,
      fields: ensureGuardFields(record.fields),
    })),
    typecast: options.typecast,
  };

  const method = options.replace ? 'PUT' : 'PATCH';

  const response = await airtableFetch<AirtableListResponse<TFields>>(table, '', {
    method,
    body: payload,
  });

  return response.records;
}

export async function deleteAirtableRecords(
  table: string,
  recordIds: string[]
): Promise<{ deleted: boolean; id: string }[]> {
  if (!recordIds.length) return [];

  const searchParams = new URLSearchParams();
  recordIds.forEach((id) => {
    searchParams.append('records[]', id);
  });

  const response = await airtableFetch<{ records: { id: string; deleted: boolean }[] }>(
    table,
    '',
    {
      method: 'DELETE',
      searchParams,
    }
  );

  return response.records.map((record) => ({
    id: record.id,
    deleted: record.deleted,
  }));
}
