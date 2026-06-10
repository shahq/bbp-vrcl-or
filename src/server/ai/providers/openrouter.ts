import type { GenerateTextParams } from "../types";

interface OpenRouterMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

function isConfiguredValue(value?: string): boolean {
  if (!value) return false;

  const normalized = value.trim();
  if (!normalized) return false;

  return !normalized.includes("YOUR_") && !normalized.includes("MY_");
}

export function hasOpenRouterApiKey(): boolean {
  return isConfiguredValue(process.env.OPENROUTER_API_KEY);
}

function getOpenRouterApiKey(): string {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!isConfiguredValue(apiKey)) {
    throw new Error("Missing OPENROUTER_API_KEY for OpenRouter AI provider.");
  }

  return apiKey;
}

function toOpenRouterMessages(params: GenerateTextParams): OpenRouterMessage[] {
  const messages: OpenRouterMessage[] = [];

  if (params.systemInstruction) {
    messages.push({ role: "system", content: params.systemInstruction });
  }

  for (const entry of params.history || []) {
    messages.push({
      role: entry.role === "model" ? "assistant" : "user",
      content: entry.text,
    });
  }

  if (params.message) {
    messages.push({ role: "user", content: params.message });
  } else if (params.prompt) {
    messages.push({ role: "user", content: params.prompt });
  }

  return messages;
}

function getOpenRouterHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${getOpenRouterApiKey()}`,
  };

  const appUrl = process.env.APP_URL;
  if (appUrl) {
    headers["HTTP-Referer"] = appUrl;
  }

  headers["X-Title"] = "Beyond Bullet Points";
  return headers;
}

export async function generateWithOpenRouter(params: GenerateTextParams): Promise<string> {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: getOpenRouterHeaders(),
    signal: params.abortSignal,
    body: JSON.stringify({
      model: params.model,
      messages: toOpenRouterMessages(params),
      ...(params.maxOutputTokens ? { max_tokens: params.maxOutputTokens } : {}),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

export async function* streamWithOpenRouter(params: GenerateTextParams): AsyncGenerator<string> {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: getOpenRouterHeaders(),
    signal: params.abortSignal,
    body: JSON.stringify({
      model: params.model,
      messages: toOpenRouterMessages(params),
      ...(params.maxOutputTokens ? { max_tokens: params.maxOutputTokens } : {}),
      stream: true,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} ${errorText}`);
  }

  if (!response.body) {
    throw new Error("OpenRouter API did not return a stream.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data:")) continue;

        const payload = trimmed.slice("data:".length).trim();
        if (!payload || payload === "[DONE]") continue;

        try {
          const data = JSON.parse(payload);
          const delta = data.choices?.[0]?.delta?.content;
          if (typeof delta === "string" && delta) {
            yield delta;
          }
        } catch {
          // Ignore malformed keepalive/event lines from OpenAI-compatible streams.
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
