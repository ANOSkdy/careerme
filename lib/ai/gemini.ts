const GEMINI_MODEL = 'gemini-2.0-flash';
const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

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

type GeminiResponse = {
  candidates?: GeminiCandidate[];
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

export async function generateGeminiText({
  prompt,
  model = GEMINI_MODEL,
  temperature = 0.7,
  maxOutputTokens = 768,
}: GenerateContentParams): Promise<string> {
  if (!prompt?.trim()) {
    throw new Error('Prompt is required for Gemini generation');
  }

  const apiKey = getGeminiApiKey();
  const url = `${GEMINI_ENDPOINT}/${encodeURIComponent(
    model
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;

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
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Gemini request failed (${response.status}): ${errorText || response.statusText}`
    );
  }

  const payload = (await response.json()) as GeminiResponse;
  const text = extractCandidateText(payload.candidates?.[0]);
  if (!text) {
    throw new Error('Gemini response did not include any text content');
  }

  return text;
}
