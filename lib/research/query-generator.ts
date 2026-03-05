import { z } from "zod";
import type { LanguageModelUsage, ProviderMetadata } from "ai";
import { sonnet } from "@/lib/ai/anthropic";
import { ANTHROPIC_PROMPT_CACHE_LONG } from "@/lib/ai/anthropic-cache";
import { cachedGenerateObject } from "@/lib/ai/cached-generation";
import { createTimeoutController } from "@/lib/api/abort";
import { RESEARCH_QUERY_PROMPT } from "@/lib/ai/prompts/research";
import {
  MAX_RESEARCH_QUERY_COUNT,
  normalizeQuerySuggestions,
  type QuerySuggestion,
} from "@/lib/research/query-preset";

const generatedQuerySchema = z.object({
  queries: z.array(
    z.object({
      query: z.string(),
      purpose: z.string(),
      source: z.string().optional(),
    })
  ),
});

interface GenerateResearchQueriesParams {
  supabase: unknown;
  teamId: string;
  projectId: string;
  briefSheet: string;
  researchTopics?: string;
  endpoint: string;
  cacheMetadata?: Record<string, unknown>;
  maxCount?: number;
}

export interface GenerateResearchQueriesResult {
  queries: QuerySuggestion[];
  prompt: string;
  usage?: LanguageModelUsage;
  providerMetadata?: ProviderMetadata;
  cacheHit: boolean;
  cacheLayer: string;
  cacheKeyPrefix: string;
  requestFingerprintVersion: string;
}

export function buildResearchQueryPrompt(params: {
  briefSheet: string;
  researchTopics?: string;
}): string {
  return [
    "以下のブリーフシートをもとに、Web検索クエリを生成してください。",
    params.briefSheet,
    typeof params.researchTopics === "string" && params.researchTopics.trim()
      ? `特に以下の調査項目は、検索クエリに変換して優先的に含めてください:\n${params.researchTopics.trim()}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export async function generateResearchQueries(
  params: GenerateResearchQueriesParams
): Promise<GenerateResearchQueriesResult> {
  const prompt = buildResearchQueryPrompt({
    briefSheet: params.briefSheet,
    researchTopics: params.researchTopics,
  });
  const { signal, cleanup } = createTimeoutController(60_000);

  try {
    const {
      object,
      usage,
      providerMetadata,
      cacheHit,
      cacheLayer,
      cacheKeyPrefix,
      requestFingerprintVersion,
    } = await cachedGenerateObject<z.infer<typeof generatedQuerySchema>>({
      supabase: params.supabase,
      teamId: params.teamId,
      endpoint: params.endpoint,
      modelName: "claude-sonnet-4-5-20250929",
      model: sonnet,
      schema: generatedQuerySchema,
      system: RESEARCH_QUERY_PROMPT,
      prompt,
      maxOutputTokens: 4096,
      abortSignal: signal,
      providerOptions: ANTHROPIC_PROMPT_CACHE_LONG,
      cacheMetadata: params.cacheMetadata,
    });

    const maxCount =
      typeof params.maxCount === "number" && params.maxCount > 0
        ? params.maxCount
        : MAX_RESEARCH_QUERY_COUNT;
    const queries = normalizeQuerySuggestions(object.queries, maxCount);

    return {
      queries,
      prompt,
      usage,
      providerMetadata,
      cacheHit,
      cacheLayer,
      cacheKeyPrefix,
      requestFingerprintVersion,
    };
  } finally {
    cleanup();
  }
}
