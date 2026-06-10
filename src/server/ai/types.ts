import { Type } from "@google/genai";

export type AIProviderName = "google" | "opencode" | "openrouter" | "openai" | "anthropic";

export interface AIHistoryMessage {
  role: "user" | "model";
  text: string;
}

export interface GenerateTextParams {
  model: string;
  prompt?: string;
  systemInstruction?: string;
  history?: AIHistoryMessage[];
  message?: string;
  abortSignal?: AbortSignal;
  maxOutputTokens?: number;
  responseMimeType?: "text/plain" | "application/json";
  responseSchema?: {
    type: Type;
    items?: {
      type: Type;
      properties?: Record<string, { type: Type; description?: string }>;
      required?: string[];
    };
  };
}
