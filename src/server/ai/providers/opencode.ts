import type { GenerateTextParams } from "../types";

interface OpenCodeMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

function isConfiguredValue(value?: string): boolean {
  if (!value) return false;

  const normalized = value.trim();
  if (!normalized) return false;

  return !normalized.includes("YOUR_") && !normalized.includes("MY_");
}

export function hasOpencodeApiKey(): boolean {
  return isConfiguredValue(process.env.OPENCODE_API_KEY);
}

function getOpencodeApiKey(): string {
  const apiKey = process.env.OPENCODE_API_KEY;
  if (!isConfiguredValue(apiKey)) {
    throw new Error("Missing OPENCODE_API_KEY for Opencode AI provider.");
  }

  return apiKey;
}

function toOpencodeMessages(params: GenerateTextParams): OpenCodeMessage[] {
  const messages: OpenCodeMessage[] = [];

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

function getOpencodeEndpoint(model: string) {
  const normalizedModel = model.toLowerCase();
  if (
    normalizedModel.startsWith("deepseek-v4-") ||
    normalizedModel.startsWith("glm-") ||
    normalizedModel.startsWith("kimi-")
  ) {
    return "https://opencode.ai/zen/go/v1/chat/completions";
  }

  return "https://opencode.ai/zen/v1/chat/completions";
}

export async function generateWithOpencode(params: GenerateTextParams): Promise<string> {
  const response = await fetch(getOpencodeEndpoint(params.model), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getOpencodeApiKey()}`,
    },
    body: JSON.stringify({
      model: params.model,
      messages: toOpencodeMessages(params),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Opencode API error: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}
