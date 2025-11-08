import { randomUUID } from 'node:crypto';

const GEMINI_MODEL = 'gemini-2.0-flash';
const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

export type GenerateContentParams = {
  prompt: string;
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
  topP?: number;
  correlationId?: string;
  timeoutMs?: number;
};

export type GeminiTextResult = {
  text: string;
  tokens?: number;
};

type GeminiCandidate = {
  content?: {
    parts?: Array<{ text?: string }>;
  };
};

type GeminiResponse = {
  candidates?: GeminiCandidate[];
  usageMetadata?: {
    totalTokenCount?: number;
    totalTokens?: number;
    promptTokenCount?: number;
    candidatesTokenCount?: number;
  };
};

export class GeminiRequestError extends Error {
  readonly status?: number;
  readonly correlationId: string;

  constructor(message: string, options: { status?: number; correlationId: string }) {
    super(message);
    this.name = 'GeminiRequestError';
    this.status = options.status;
    this.correlationId = options.correlationId;
  }
}

function getGeminiApiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error('Missing GEMINI_API_KEY environment variable');
  }
  return key;
}

function extractCandidateText(candidate?: GeminiCandidate): string | undefined {
  if (!candidate?.content?.parts?.length) return undefined;
  const text = candidate.content.parts
    .map((part) => part?.text?.trim())
    .filter((value): value is string => Boolean(value && value.length > 0))
    .join('\n')
    .trim();
  return text || undefined;
}

function extractUsageTokens(response: GeminiResponse): number | undefined {
  const usage = response.usageMetadata;
  if (!usage) return undefined;
  return (
    usage.totalTokenCount ??
    usage.totalTokens ??
    (usage.promptTokenCount ?? 0) + (usage.candidatesTokenCount ?? 0) || undefined
  );
}

export async function generateGeminiText({
  prompt,
  model = GEMINI_MODEL,
  temperature = 0.7,
  maxOutputTokens = 768,
  topP,
  correlationId = randomUUID(),
  timeoutMs = 12_000,
}: GenerateContentParams): Promise<GeminiTextResult> {
  if (!prompt?.trim()) {
    throw new GeminiRequestError('Prompt is required for Gemini generation', {
      correlationId,
    });
  }

  const apiKey = getGeminiApiKey();
  const url = `${GEMINI_ENDPOINT}/${encodeURIComponent(model)}:generateContent`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const body: Record<string, unknown> = {
    contents: [
      {
        role: 'user',
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      temperature,
      maxOutputTokens,
    },
  };

  if (typeof topP === 'number') {
    (body.generationConfig as Record<string, unknown>).topP = topP;
  }

  let lastError: unknown;

  try {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        if (!response.ok) {
          const status = response.status;
          const contentType = response.headers.get('content-type') ?? '';
          let message = `Gemini request failed (${status})`;

          if (contentType.includes('application/json')) {
            const payload = (await response.json().catch(() => null)) as
              | { error?: { message?: string } }
              | null;
            const errorMessage = payload?.error?.message?.trim();
            if (errorMessage) {
              message = errorMessage;
            }
          } else {
            const text = await response.text();
            if (text) {
              message = text;
            }
          }

          if (status >= 500 && status < 600 && attempt === 0) {
            lastError = new GeminiRequestError(message, { status, correlationId });
            continue;
          }

          throw new GeminiRequestError(message, { status, correlationId });
        }

        const payload = (await response.json()) as GeminiResponse;
        const text = extractCandidateText(payload.candidates?.[0]);
        if (!text) {
          throw new GeminiRequestError('Gemini response did not include any text content', {
            status: response.status,
            correlationId,
          });
        }

        return {
          text,
          tokens: extractUsageTokens(payload),
        };
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          throw new GeminiRequestError('Gemini request timed out', {
            status: 408,
            correlationId,
          });
        }
        if (error instanceof GeminiRequestError) {
          lastError = error;
          if (error.status && error.status >= 500 && error.status < 600) {
            continue;
          }
          throw error;
        }
        lastError = error;
        throw error;
      }
    }
  } finally {
    clearTimeout(timeout);
  }

  if (lastError instanceof GeminiRequestError) {
    throw lastError;
  }

  throw new GeminiRequestError('Gemini request failed after retries', {
    correlationId,
  });
}
