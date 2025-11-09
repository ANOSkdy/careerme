const GEMINI_MODEL = 'gemini-2.0-flash';
const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_TIMEOUT_MS = 12_000;
const MAX_RETRIES = 1;
const timeoutRegistry = new WeakMap<AbortSignal, NodeJS.Timeout>();

type GenerateContentParams = {
  prompt: string;
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
};

type GeminiCandidate = {
  content?: {
    parts?: Array<{ text?: string }>;
  };
};

type GeminiUsageMetadata = {
  totalTokenCount?: number;
  promptTokenCount?: number;
  candidatesTokenCount?: number;
};

type GeminiResponse = {
  candidates?: GeminiCandidate[];
  usageMetadata?: GeminiUsageMetadata;
};

export type GeminiUsage = {
  totalTokens?: number;
  inputTokens?: number;
  outputTokens?: number;
};

export type GeminiResult = {
  text: string;
  usage: GeminiUsage;
};

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

function extractUsage(metadata: GeminiUsageMetadata | undefined): GeminiUsage {
  return {
    totalTokens: metadata?.totalTokenCount,
    inputTokens: metadata?.promptTokenCount,
    outputTokens: metadata?.candidatesTokenCount,
  };
}

function createTimeoutSignal(timeoutMs: number): AbortSignal {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  timeoutRegistry.set(controller.signal, timeout);
  return controller.signal;
}

function clearTimeoutSignal(signal: AbortSignal | undefined) {
  if (!signal) return;
  const timeout = timeoutRegistry.get(signal);
  if (timeout) {
    clearTimeout(timeout);
    timeoutRegistry.delete(signal);
  }
}

export async function generateGeminiText({
  prompt,
  model = GEMINI_MODEL,
  temperature = 0.7,
  maxOutputTokens = 768,
}: GenerateContentParams): Promise<GeminiResult> {
  if (!prompt?.trim()) {
    throw new Error('Prompt is required for Gemini generation');
  }

  const apiKey = getGeminiApiKey();
  const url = `${GEMINI_ENDPOINT}/${encodeURIComponent(
    model
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const signal = createTimeoutSignal(DEFAULT_TIMEOUT_MS);

  try {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
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
          }),
          signal,
        });

        if (!response.ok) {
          const errorText = await response.text();
          const isRetryable = response.status >= 500 && response.status < 600 && attempt < MAX_RETRIES;
          if (isRetryable) {
            continue;
          }
          const error = new Error(
            `Gemini request failed (${response.status}): ${errorText || response.statusText}`
          );
          (error as Error & { status?: number }).status = response.status;
          throw error;
        }

        const payload = (await response.json()) as GeminiResponse;
        const text = extractCandidateText(payload.candidates?.[0]);
        if (!text) {
          throw new Error('Gemini response did not include any text content');
        }

        return { text, usage: extractUsage(payload.usageMetadata) };
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          const timeoutError = new Error('Gemini request timed out');
          (timeoutError as Error & { status?: number }).status = 408;
          throw timeoutError;
        }
        if (attempt === MAX_RETRIES) {
          throw error;
        }
      }
    }

    throw new Error('Gemini request failed after retries');
  } finally {
    clearTimeoutSignal(signal);
  }
}
