import type { AIProviderName, GenerateTextParams } from "./types";
import { generateWithGoogle } from "./providers/google";
import { hasGoogleApiKey } from "./providers/google";
import { generateWithOpenRouter, hasOpenRouterApiKey, streamWithOpenRouter } from "./providers/openrouter";
import { generateWithOpencode, hasOpencodeApiKey, streamWithOpencode } from "./providers/opencode";
import { generateWithOpenAi, hasOpenAiApiKey } from "./providers/openai";
import { generateWithAnthropic, hasAnthropicApiKey } from "./providers/anthropic";

function getConfiguredProvider(): AIProviderName {
  const configured = (process.env.AI_PROVIDER || "").toLowerCase();
  if (configured === "google") return "google";
  if (configured === "openrouter") return "openrouter";
  if (configured === "openai") return "openai";
  if (configured === "anthropic" || configured === "claude") return "anthropic";
  return "opencode";
}

function resolveProvider(model: string): AIProviderName {
  const normalizedModel = model.toLowerCase();

  if (normalizedModel.startsWith("gemini")) {
    return "google";
  }

  if (
    normalizedModel.startsWith("minimax") ||
    normalizedModel.startsWith("deepseek-v4-") ||
    normalizedModel.startsWith("glm-") ||
    normalizedModel.startsWith("kimi-") ||
    normalizedModel.startsWith("mimo-")
  ) {
    return "opencode";
  }

  if (normalizedModel.startsWith("gpt") || normalizedModel.startsWith("openai/")) {
    return "openai";
  }

  if (normalizedModel.startsWith("claude") || normalizedModel.startsWith("anthropic/")) {
    return "anthropic";
  }

  if (normalizedModel.includes("/")) {
    return "openrouter";
  }

  return getConfiguredProvider();
}

export function getDefaultModel(): string {
  const configuredDefault = process.env.AI_DEFAULT_MODEL;
  if (configuredDefault) {
    return configuredDefault;
  }

  if (hasOpencodeApiKey()) {
    return "kimi-k2.6";
  }

  if (hasOpenRouterApiKey()) {
    return "openrouter/auto";
  }

  if (hasOpenAiApiKey()) {
    return "gpt-4o-mini";
  }

  if (hasAnthropicApiKey()) {
    return "claude-3-5-haiku-latest";
  }

  return "gemini-3.1-pro-preview";
}

function getFallbackModel(provider: AIProviderName): string {
  if (provider === "google") {
    return "gemini-3.1-pro-preview";
  }

  if (provider === "openrouter") {
    return "openrouter/auto";
  }

  if (provider === "openai") {
    return "gpt-4o-mini";
  }

  if (provider === "anthropic") {
    return "claude-3-5-haiku-latest";
  }

  return "kimi-k2.6";
}

function isProviderAvailable(provider: AIProviderName): boolean {
  if (provider === "google") {
    return hasGoogleApiKey();
  }

  if (provider === "openrouter") {
    return hasOpenRouterApiKey();
  }

  if (provider === "openai") {
    return hasOpenAiApiKey();
  }

  if (provider === "anthropic") {
    return hasAnthropicApiKey();
  }

  return hasOpencodeApiKey();
}

function getAlternateProviders(provider: AIProviderName): AIProviderName[] {
  if (provider === "google") {
    return ["opencode", "openrouter", "openai", "anthropic"];
  }

  if (provider === "opencode") {
    return ["google", "openrouter", "openai", "anthropic"];
  }

  if (provider === "openrouter") {
    return ["google", "opencode", "openai", "anthropic"];
  }

  if (provider === "openai") {
    return ["google", "opencode", "openrouter", "anthropic"];
  }

  return ["google", "opencode", "openrouter", "openai"];
}

function resolveRequest(params: GenerateTextParams): { provider: AIProviderName; model: string } {
  const requestedProvider = resolveProvider(params.model);

  if (isProviderAvailable(requestedProvider)) {
    return { provider: requestedProvider, model: normalizeProviderModel(requestedProvider, params.model) };
  }

  for (const alternateProvider of getAlternateProviders(requestedProvider)) {
    if (isProviderAvailable(alternateProvider)) {
      return { provider: alternateProvider, model: getFallbackModel(alternateProvider) };
    }
  }

  throw new Error(
    "No configured AI provider is available. Add OPENCODE_API_KEY, OPENROUTER_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY/CLAUDE_API_KEY, or GOOGLE_API_KEY/GEMINI_API_KEY."
  );
}

function normalizeProviderModel(provider: AIProviderName, model: string): string {
  if (provider === "openai" && model.toLowerCase().startsWith("openai/")) {
    return model.slice("openai/".length);
  }

  if (provider === "anthropic" && model.toLowerCase().startsWith("anthropic/")) {
    return model.slice("anthropic/".length);
  }

  return model;
}

export function getAiConfig() {
  return {
    provider: getConfiguredProvider(),
    defaultModel: getDefaultModel(),
    availableProviders: {
      google: hasGoogleApiKey(),
      opencode: hasOpencodeApiKey(),
      openrouter: hasOpenRouterApiKey(),
      openai: hasOpenAiApiKey(),
      anthropic: hasAnthropicApiKey(),
    },
  };
}

export async function generateText(params: GenerateTextParams): Promise<string> {
  const resolved = resolveRequest(params);
  const request = { ...params, model: resolved.model };

  if (resolved.provider === "google") {
    return generateWithGoogle(request);
  }

  if (resolved.provider === "openrouter") {
    return generateWithOpenRouter(request);
  }

  if (resolved.provider === "openai") {
    return generateWithOpenAi(request);
  }

  if (resolved.provider === "anthropic") {
    return generateWithAnthropic(request);
  }

  return generateWithOpencode(request);
}

export async function* generateTextStream(params: GenerateTextParams): AsyncGenerator<string> {
  const resolved = resolveRequest(params);
  const request = { ...params, model: resolved.model };

  if (resolved.provider === "opencode") {
    yield* streamWithOpencode(request);
    return;
  }

  if (resolved.provider === "openrouter") {
    yield* streamWithOpenRouter(request);
    return;
  }

  yield await generateText(request);
}
