import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { parseJsonWithSchema } from "@/lib/api/validation";
import { withErrorHandling } from "@/lib/api/error";
import { requireAuth } from "@/lib/api/auth";
import { extractAnthropicCacheMetrics } from "@/lib/ai/cache-metadata";
import { recordAiUsage } from "@/lib/ai/usage-logger";
import { generateResearchQueries } from "@/lib/research/query-generator";
import {
  createQueryPresetMeta,
  parseQueryPresetMeta,
  type QueryPresetSource,
} from "@/lib/research/query-preset";
import {
  extractQueriesFromKeywords,
  mergeKeywordText,
  sanitizeText,
} from "@/lib/research/text-utils";
import { normalizeKeywordTextToQueries } from "@/lib/research/topic-queries";

const presetSourceSchema = z.enum([
  "handoff",
  "research_init",
  "brief_save",
  "manual",
]);

const suggestKeywordsRequestSchema = z.object({
  projectId: z.string().min(1, "projectId is required"),
  briefSheet: z.string().optional(),
  researchTopics: z.string().optional(),
  source: presetSourceSchema.optional(),
  persistPreset: z.boolean().optional(),
  briefUpdatedAt: z.string().optional(),
  existingKeywords: z.string().optional(),
});

type PresetMemoRow = {
  theme_keywords?: string;
  content?: unknown;
};

type PresetSupabaseLike = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        single: () => PromiseLike<{
          data: PresetMemoRow | null;
          error: { message: string } | null;
        }>;
      };
    };
    upsert: (
      row: Record<string, unknown>,
      options: { onConflict: string }
    ) => PromiseLike<{ error: { message: string } | null }>;
  };
};

async function persistPresetState(params: {
  supabase: unknown;
  projectId: string;
  source: QueryPresetSource;
  briefUpdatedAt: string | null;
  existingKeywords?: string;
  generatedQueries?: string[];
  status: "success" | "failed";
  errorMessage: string | null;
}) {
  const db = params.supabase as PresetSupabaseLike;

  const { data: memoRow } = await db
    .from("research_memos")
    .select("theme_keywords, content")
    .eq("project_id", params.projectId)
    .single();

  const baseKeywords = normalizeKeywordTextToQueries(
    sanitizeText(params.existingKeywords) ||
      sanitizeText(memoRow?.theme_keywords)
  );
  const generatedQueries = (params.generatedQueries || []).filter(Boolean);
  const mergedKeywords = normalizeKeywordTextToQueries(
    mergeKeywordText(baseKeywords, generatedQueries)
  );
  const beforeSet = new Set(extractQueriesFromKeywords(baseKeywords));
  const afterSet = new Set(extractQueriesFromKeywords(mergedKeywords));
  const addedQueryCount = Math.max(afterSet.size - beforeSet.size, 0);

  const existingContent =
    memoRow?.content && typeof memoRow.content === "object"
      ? (memoRow.content as Record<string, unknown>)
      : {};

  const nextContent: Record<string, unknown> = {
    ...existingContent,
    query_preset: createQueryPresetMeta({
      status: params.status,
      source: params.source,
      briefUpdatedAt: params.briefUpdatedAt,
      errorMessage: params.errorMessage,
    }),
  };

  const payload: Record<string, unknown> = {
    project_id: params.projectId,
    content: nextContent,
  };

  if (params.status === "success") {
    payload.theme_keywords = mergedKeywords;
    payload.search_queries = extractQueriesFromKeywords(mergedKeywords);
  }

  const { error } = await db
    .from("research_memos")
    .upsert(payload, { onConflict: "project_id" });
  if (error) {
    console.warn(
      `[suggest-keywords] Failed to persist query preset: ${error.message}`
    );
  }

  return {
    keywords: mergedKeywords,
    addedQueryCount,
    queryPreset: parseQueryPresetMeta(nextContent.query_preset),
  };
}

export async function POST(request: NextRequest) {
  return withErrorHandling(
    async () => {
      const auth = await requireAuth();
      if (auth instanceof Response) {
        return auth;
      }
      const { supabase, user, profile } = auth;

      const {
        projectId,
        briefSheet,
        researchTopics,
        source = "manual",
        persistPreset = false,
        briefUpdatedAt,
        existingKeywords,
      } = await parseJsonWithSchema(request, suggestKeywordsRequestSchema);
      let briefMarkdown = sanitizeText(briefSheet);
      let resolvedResearchTopics = sanitizeText(researchTopics);
      let resolvedBriefUpdatedAt = sanitizeText(briefUpdatedAt) || null;

      if (!briefMarkdown || !resolvedResearchTopics || !resolvedBriefUpdatedAt) {
        const { data: briefData } = await supabase
          .from("brief_sheets")
          .select("raw_markdown, research_topics, updated_at")
          .eq("project_id", projectId)
          .single();

        if (!briefMarkdown) {
          briefMarkdown = sanitizeText(briefData?.raw_markdown);
        }
        if (!resolvedResearchTopics) {
          resolvedResearchTopics = sanitizeText(briefData?.research_topics);
        }
        if (!resolvedBriefUpdatedAt) {
          resolvedBriefUpdatedAt = sanitizeText(briefData?.updated_at) || null;
        }
      }

      if (!briefMarkdown) {
        return NextResponse.json(
          { error: "ブリーフシートが見つかりません" },
          { status: 404 }
        );
      }

      try {
        const result = await generateResearchQueries({
          supabase,
          teamId: profile.team_id,
          projectId,
          briefSheet: briefMarkdown,
          researchTopics: resolvedResearchTopics,
          endpoint: "/api/ai/suggest-keywords",
          cacheMetadata: { projectId, source },
        });
        const { cacheReadInputTokens, cacheCreationInputTokens } =
          extractAnthropicCacheMetrics(result.providerMetadata);

        await recordAiUsage({
          supabase,
          endpoint: "/api/ai/suggest-keywords",
          operation: "generateText",
          model: "claude-sonnet-4-5-20250929",
          userId: user.id,
          projectId,
          promptChars: result.prompt.length,
          completionChars: JSON.stringify(result.queries).length,
          usage: result.usage,
          metadata: {
            cacheHit: result.cacheHit,
            cacheLayer: result.cacheLayer,
            cacheKeyPrefix: result.cacheKeyPrefix,
            cacheReadInputTokens,
            cacheCreationInputTokens,
            requestFingerprintVersion: result.requestFingerprintVersion,
            source,
          },
        });

        if (!persistPreset) {
          return NextResponse.json({ queries: result.queries });
        }

        const persisted = await persistPresetState({
          supabase,
          projectId,
          source,
          briefUpdatedAt: resolvedBriefUpdatedAt,
          existingKeywords,
          generatedQueries: result.queries.map((item) => item.query),
          status: "success",
          errorMessage: null,
        });

        return NextResponse.json({
          queries: result.queries,
          keywords: persisted.keywords,
          addedQueryCount: persisted.addedQueryCount,
          queryPreset: persisted.queryPreset,
        });
      } catch (error) {
        if (persistPreset) {
          const message =
            error instanceof Error
              ? error.message
              : "キーワード候補の生成に失敗しました";
          await persistPresetState({
            supabase,
            projectId,
            source,
            briefUpdatedAt: resolvedBriefUpdatedAt,
            existingKeywords,
            status: "failed",
            errorMessage: message,
          });
        }
        throw error;
      }
    },
    {
      context: "suggest-keywords",
      fallbackMessage: "キーワード候補の生成に失敗しました",
    }
  );
}
