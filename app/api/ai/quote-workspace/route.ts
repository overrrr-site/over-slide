import { NextRequest, NextResponse } from "next/server";
import { parseJsonWithSchema } from "@/lib/api/validation";
import { requireAuth } from "@/lib/api/auth";
import { withErrorHandling } from "@/lib/api/error";
import { sonnet } from "@/lib/ai/anthropic";
import { ANTHROPIC_PROMPT_CACHE_LONG } from "@/lib/ai/anthropic-cache";
import { cachedGenerateObject } from "@/lib/ai/cached-generation";
import { extractAnthropicCacheMetrics } from "@/lib/ai/cache-metadata";
import { recordAiUsage } from "@/lib/ai/usage-logger";
import { buildPastQuotesContext } from "@/lib/quotes/past-quotes";
import {
  buildQuoteWorkspaceInitialPrompt,
  buildQuoteWorkspaceRevisePrompt,
} from "@/lib/ai/prompts/quote-workspace";
import {
  quoteWorkspaceRequestSchema,
  type QuoteWorkspaceResponse,
  quoteWorkspaceResponseSchema,
  sanitizeWorkspaceProjectTypeIds,
} from "@/lib/quotes/workspace-schema";

export async function POST(request: NextRequest) {
  return withErrorHandling(
    async () => {
      const auth = await requireAuth();
      if (auth instanceof Response) {
        return auth;
      }

      const { supabase, user, profile } = auth;
      const teamId = profile.team_id;

      const body = await parseJsonWithSchema(request, quoteWorkspaceRequestSchema);
      const meaningfulCurrentItems = body.currentItems.filter(
        (item) => item.name.trim() !== ""
      );
      const meaningfulDraftItems = body.draftItems.filter(
        (item) => item.name.trim() !== ""
      );
      const referenceMaterials = body.referenceMaterials
        .map((material) => ({
          ...material,
          title: material.title.trim(),
          text: material.text.trim(),
        }))
        .filter((material) => material.text.length > 0)
        .slice(0, 4);

      const pastQuotesContext = await buildPastQuotesContext(
        supabase,
        teamId,
        body.projectTypes
      );

      const prompt =
        body.mode === "initial"
          ? buildQuoteWorkspaceInitialPrompt(
              pastQuotesContext,
              body.orientSheetMarkdown,
              referenceMaterials,
              body.projectTypes,
              meaningfulCurrentItems
            )
          : buildQuoteWorkspaceRevisePrompt(
              pastQuotesContext,
              body.orientSheetMarkdown,
              referenceMaterials,
              body.instruction,
              body.projectTypes,
              meaningfulDraftItems.length > 0
                ? meaningfulDraftItems
                : meaningfulCurrentItems,
              meaningfulCurrentItems
            );

      const {
        object,
        usage,
        providerMetadata,
        cacheHit,
        cacheLayer,
        cacheKeyPrefix,
        requestFingerprintVersion,
      } = await cachedGenerateObject<QuoteWorkspaceResponse>({
        supabase,
        teamId,
        endpoint: "/api/ai/quote-workspace",
        modelName: "claude-sonnet-4-5-20250929",
        model: sonnet,
        schema: quoteWorkspaceResponseSchema,
        prompt,
        maxOutputTokens: 4096,
        providerOptions: ANTHROPIC_PROMPT_CACHE_LONG,
        cacheMetadata: { mode: body.mode },
      });
      const { cacheReadInputTokens, cacheCreationInputTokens } =
        extractAnthropicCacheMetrics(providerMetadata);

      const suggestedProjectTypes = sanitizeWorkspaceProjectTypeIds(
        object.suggestedProjectTypes
      );
      const confidence = Math.min(Math.max(object.confidence ?? 0.5, 0), 1);
      if ((confidence < 0.5 || suggestedProjectTypes.length === 0) && !suggestedProjectTypes.includes("other")) {
        suggestedProjectTypes.push("other");
      }

      const normalized = {
        ...object,
        confidence,
        suggestedProjectTypes,
      };

      await recordAiUsage({
        supabase,
        endpoint: "/api/ai/quote-workspace",
        operation: "generateText",
        model: "claude-sonnet-4-5-20250929",
        userId: user.id,
        teamId,
        promptChars: prompt.length,
        completionChars: JSON.stringify(normalized).length,
        usage,
        metadata: {
          mode: body.mode,
          orient_chars: body.orientSheetMarkdown.length,
          reference_materials: referenceMaterials.length,
          current_items: meaningfulCurrentItems.length,
          draft_items: meaningfulDraftItems.length,
          cacheHit,
          cacheLayer,
          cacheKeyPrefix,
          cacheReadInputTokens,
          cacheCreationInputTokens,
          requestFingerprintVersion,
        },
      });

      if (body.mode === "initial") {
        return NextResponse.json(normalized);
      }

      return NextResponse.json({
        rationale: normalized.rationale,
        items: normalized.items,
        suggestedProjectTypes: normalized.suggestedProjectTypes,
      });
    },
    {
      context: "quote-workspace",
      fallbackMessage: "見積ワークスペースAIの生成に失敗しました",
    }
  );
}
