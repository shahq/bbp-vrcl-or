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
    normalizedModel.startsWith("minimax") ||
    normalizedModel.startsWith("deepseek-v4-") ||
    normalizedModel.startsWith("glm-") ||
    normalizedModel.startsWith("kimi-") ||
    normalizedModel.startsWith("mimo-")
  ) {
    return "https://opencode.ai/zen/go/v1/chat/completions";
  }

  return "https://opencode.ai/zen/v1/chat/completions";
}

function stripReasoningTags(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, "").replace(/<think>[\s\S]*$/i, "").trim();
}

function createReasoningTagFilter() {
  const openTag = "<think>";
  const closeTag = "</think>";
  let insideReasoningTag = false;
  let bufferedTagPrefix = "";

  const getPartialTagSuffixLength = (text: string) => {
    for (const tag of [openTag, closeTag]) {
      const maxLength = Math.min(tag.length - 1, text.length);
      for (let length = maxLength; length > 0; length -= 1) {
        if (tag.startsWith(text.slice(-length).toLowerCase())) {
          return length;
        }
      }
    }
    return 0;
  };

  return (chunk: string) => {
    let text = bufferedTagPrefix + chunk;
    bufferedTagPrefix = "";

    const partialTagLength = getPartialTagSuffixLength(text);
    if (partialTagLength > 0) {
      bufferedTagPrefix = text.slice(-partialTagLength);
      text = text.slice(0, -partialTagLength);
    }

    let output = "";
    while (text) {
      const lowerText = text.toLowerCase();

      if (insideReasoningTag) {
        const closeIndex = lowerText.indexOf(closeTag);
        if (closeIndex === -1) {
          return output;
        }

        text = text.slice(closeIndex + closeTag.length);
        insideReasoningTag = false;
        continue;
      }

      const openIndex = lowerText.indexOf(openTag);
      if (openIndex === -1) {
        output += text;
        break;
      }

      output += text.slice(0, openIndex);
      text = text.slice(openIndex + openTag.length);
      insideReasoningTag = true;
    }

    return output;
  };
}

export async function generateWithOpencode(params: GenerateTextParams): Promise<string> {
  const response = await fetch(getOpencodeEndpoint(params.model), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getOpencodeApiKey()}`,
    },
    signal: params.abortSignal,
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
  return stripReasoningTags(data.choices?.[0]?.message?.content || "");
}

export async function* streamWithOpencode(params: GenerateTextParams): AsyncGenerator<string> {
  const response = await fetch(getOpencodeEndpoint(params.model), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getOpencodeApiKey()}`,
    },
    signal: params.abortSignal,
    body: JSON.stringify({
      model: params.model,
      messages: toOpencodeMessages(params),
      stream: true,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Opencode API error: ${response.status} ${errorText}`);
  }

  if (!response.body) {
    throw new Error("Opencode API did not return a stream.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const filterReasoningTags = createReasoningTagFilter();
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
            const filteredDelta = filterReasoningTags(delta);
            if (filteredDelta) {
              yield filteredDelta;
            }
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
