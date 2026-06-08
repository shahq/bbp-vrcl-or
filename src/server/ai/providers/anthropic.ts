import type { GenerateTextParams } from "../types";

interface AnthropicMessage {
  role: "user" | "assistant";
  content: string;
}

function isConfiguredValue(value?: string): boolean {
  if (!value) return false;

  const normalized = value.trim();
  if (!normalized) return false;

  return !normalized.includes("YOUR_") && !normalized.includes("MY_");
}

export function hasAnthropicApiKey(): boolean {
  return isConfiguredValue(process.env.ANTHROPIC_API_KEY) || isConfiguredValue(process.env.CLAUDE_API_KEY);
}

function getAnthropicApiKey(): string {
  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
  if (!isConfiguredValue(apiKey)) {
    throw new Error("Missing ANTHROPIC_API_KEY or CLAUDE_API_KEY for Anthropic provider.");
  }

  return apiKey;
}

function toAnthropicMessages(params: GenerateTextParams): AnthropicMessage[] {
  const messages: AnthropicMessage[] = [];

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

export async function generateWithAnthropic(params: GenerateTextParams): Promise<string> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": getAnthropicApiKey(),
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: params.model,
      max_tokens: 1024,
      ...(params.systemInstruction ? { system: params.systemInstruction } : {}),
      messages: toAnthropicMessages(params),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Anthropic API error: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  return (data.content || [])
    .filter((part: { type?: string; text?: string }) => part.type === "text" && typeof part.text === "string")
    .map((part: { text: string }) => part.text)
    .join("");
}
