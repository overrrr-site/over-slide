import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";

// --- Anthropic ---
const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  baseURL: "https://api.anthropic.com/v1",
});

/** Opus 4.6 — Discussion, Structure, Review */
export const opus = anthropic("claude-opus-4-6");

/** Sonnet 4.5 — Research, Details, Design, Knowledge analysis */
export const sonnet = anthropic("claude-sonnet-4-5-20250929");

// --- Google Gemini ---
const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY,
});

/** Gemini 3.1 Pro Preview — Review, Discussion */
export const gemini = google("gemini-3.1-pro-preview");

/** Gemini 3 Pro Image Preview — Slide image generation */
export const geminiImage = google.image("gemini-3-pro-image-preview");

// --- OpenAI ---
const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/** GPT-5.2 — Review, Discussion */
export const gpt = openai("gpt-5.2");
