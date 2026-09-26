type LlmRequest = {
  systemPrompt: string;
  userPrompt: string;
  model: string;
};

type LlmResult = {
  text: string;
  model: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  raw?: unknown;
};

const DEFAULT_BASE_URL = "https://api.openai.com/v1";

function normalizeBaseUrl(value?: string) {
  if (!value) return DEFAULT_BASE_URL;
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

export async function runCompletion({ systemPrompt, userPrompt, model }: LlmRequest): Promise<LlmResult> {
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) {
    throw new Error("LLM_API_KEY is not configured");
  }

  const baseUrl = normalizeBaseUrl(process.env.LLM_BASE_URL);
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    signal: AbortSignal.timeout(30_000),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ]
    })
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message = payload?.error?.message || `LLM request failed with ${response.status}`;
    throw new Error(message);
  }

  const text = payload?.choices?.[0]?.message?.content?.toString() ?? "";
  if (!text.trim()) throw new Error("LLM returned an empty response");
  const usage = payload?.usage
    ? {
        promptTokens: payload.usage.prompt_tokens,
        completionTokens: payload.usage.completion_tokens,
        totalTokens: payload.usage.total_tokens
      }
    : undefined;

  return {
    text,
    model: payload?.model ?? model,
    usage,
    raw: payload
  };
}
