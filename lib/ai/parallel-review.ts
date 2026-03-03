import { generateText } from "ai";
import { parseJsonObjectFromText } from "@/lib/ai/json-response";
import { recordAiUsage } from "@/lib/ai/usage-logger";
import {
  buildSemanticCacheKey,
  getCachedText,
  setCachedText,
} from "@/lib/ai/semantic-cache";

export interface ReviewResult {
  model: string;
  label: string;
  data: unknown;
  error?: string;
}

export interface ReviewModelConfig {
  model: Parameters<typeof generateText>[0]["model"];
  key: string;
  label: string;
  modelName: string;
}

interface RunParallelReviewsParams {
  supabase: Awaited<ReturnType<typeof import("@/lib/supabase/server").createClient>>;
  userId: string;
  teamId: string;
  projectId?: string;
  endpoint: string;
  prompt: string;
  system: string;
  models: ReviewModelConfig[];
  maxOutputTokens?: number;
  abortSignal?: AbortSignal;
}

export async function runParallelReviews({
  supabase,
  userId,
  teamId,
  projectId,
  endpoint,
  prompt,
  system,
  models,
  maxOutputTokens,
  abortSignal,
}: RunParallelReviewsParams): Promise<ReviewResult[]> {
  const results = await Promise.allSettled(
    models.map(async ({ model, key, label, modelName }) => {
      const cacheKey = buildSemanticCacheKey({
        endpoint,
        model: modelName,
        system,
        prompt,
      });

      const cached = await getCachedText({
        supabase,
        teamId,
        endpoint,
        model: modelName,
        cacheKey,
      });

      let text: string;
      let usage;
      let cacheHit = false;

      if (cached) {
        text = cached.text;
        usage = undefined;
        cacheHit = true;
      } else {
        const generated = await generateText({
          model,
          system,
          prompt,
          maxOutputTokens,
          abortSignal,
        });
        text = generated.text;
        usage = generated.usage;

        await setCachedText({
          supabase,
          teamId,
          endpoint,
          model: modelName,
          cacheKey,
          text,
          usage,
          metadata: { modelKey: key },
          ttlHours: 48,
        });
      }

      await recordAiUsage({
        supabase,
        endpoint,
        operation: "generateText",
        model: modelName,
        userId,
        projectId,
        promptChars: prompt.length,
        completionChars: text.length,
        usage,
        metadata: { modelKey: key, cacheHit },
      });

      try {
        const parsed = parseJsonObjectFromText<unknown>(text);
        return { model: key, label, data: parsed } as ReviewResult;
      } catch {
        return {
          model: key,
          label,
          data: null,
          error: "JSONの解析に失敗",
        } as ReviewResult;
      }
    })
  );

  return results.map((result, index) => {
    if (result.status === "fulfilled") {
      return result.value;
    }
    return {
      model: models[index].key,
      label: models[index].label,
      data: null,
      error: result.reason?.message || "レビューの生成に失敗しました",
    };
  });
}
