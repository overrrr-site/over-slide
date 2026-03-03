import { NextRequest, NextResponse } from "next/server";
import { parseJsonBody } from "@/lib/api/validation";
import { generateText } from "ai";
import { sonnet } from "@/lib/ai/anthropic";
import { parseJsonObjectFromText } from "@/lib/ai/json-response";
import { compactJsonForPrompt } from "@/lib/ai/prompt-utils";
import { recordAiUsage } from "@/lib/ai/usage-logger";
import { DESIGN_HTML_PROMPT } from "@/lib/ai/prompts/design-html";
import { requireAuth } from "@/lib/api/auth";
import { createTimeoutController } from "@/lib/api/abort";
import { getTeamIdForUser } from "@/lib/api/team";
import { withErrorHandling } from "@/lib/api/error";
import { CSS_VERSION, type ColorOverrides } from "@/lib/slides/base-styles";
import type { HtmlSlide, HtmlPresentation } from "@/lib/slides/types";
import { resolveAllSlideIcons } from "@/lib/slides/icon-resolver";
import { generateAndEmbedImages } from "@/lib/slides/image-generator";
import { buildRagContext } from "@/lib/knowledge/rag-context";
import { chunkArray } from "@/lib/utils/array";

type UsageLogContext = {
  supabase: unknown;
  userId: string;
  teamId?: string | null;
  projectId: string;
};

/**
 * Generate HTML slides for a batch of pages.
 */
async function generateBatch(
  pages: Record<string, unknown>[],
  startIndex: number,
  totalPages: number,
  signal: AbortSignal,
  ragContext: string = "",
  logContext?: UsageLogContext
): Promise<HtmlSlide[]> {
  const prompt = `以下のページコンテンツ（${startIndex + 1}〜${startIndex + pages.length}ページ目 / 全${totalPages}ページ）をHTMLスライドに変換してください:\n\n${compactJsonForPrompt(pages)}${ragContext}`;
  const { text, usage } = await generateText({
    model: sonnet,
    system: DESIGN_HTML_PROMPT,
    prompt,
    maxOutputTokens: 16384,
    abortSignal: signal,
  });

  if (logContext) {
    await recordAiUsage({
      supabase: logContext.supabase,
      endpoint: "/api/ai/design",
      operation: "generateText",
      model: "claude-sonnet-4-5-20250929",
      userId: logContext.userId,
      teamId: logContext.teamId,
      projectId: logContext.projectId,
      promptChars: prompt.length,
      completionChars: text.length,
      usage,
      metadata: {
        batchStart: startIndex + 1,
        batchSize: pages.length,
        totalPages,
      },
    });
  }

  let parsed: {
    slides?: Array<{ slideType?: string; title?: string; html?: string }>;
  };
  try {
    parsed = parseJsonObjectFromText<{
      slides?: Array<{ slideType?: string; title?: string; html?: string }>;
    }>(text);
  } catch {
    throw new Error(`バッチ${startIndex + 1}〜のJSON抽出に失敗`);
  }

  if (!parsed.slides || !Array.isArray(parsed.slides)) {
    throw new Error(`バッチ${startIndex + 1}〜のスライド配列が不正`);
  }

  return parsed.slides.map((s, i) => ({
    index: startIndex + i,
    html: s.html || "",
    slideType: (s.slideType || "content") as HtmlSlide["slideType"],
    title: s.title || `スライド ${startIndex + i + 1}`,
  }));
}

export async function POST(request: NextRequest) {
  return withErrorHandling(
    async () => {
      const auth = await requireAuth();
      if (auth instanceof Response) {
        return auth;
      }
      const { supabase, user } = auth;

      const { projectId, pageContents } = await parseJsonBody(request);
      const teamId = await getTeamIdForUser(supabase, user.id);

      if (!teamId) {
        return NextResponse.json(
          { error: "Profile not found" },
          { status: 404 }
        );
      }

      // Fetch custom color scheme if available
      let colorOverrides: ColorOverrides | undefined;
      const { data: templateSettings } = await supabase
        .from("template_settings")
        .select("color_scheme")
        .eq("team_id", teamId)
        .single();

      if (templateSettings?.color_scheme) {
        colorOverrides = templateSettings.color_scheme as ColorOverrides;
      }

      // Timeout: abort after 300 seconds (includes image generation time)
      const { signal, cleanup } = createTimeoutController(300_000);

      try {
        const pages = pageContents as Record<string, unknown>[];
        const totalPages = pages.length;

        // Search knowledge base for design style patterns (once, shared across batches)
        const ragContext = await buildRagContext({
          query: "提案書のデザインパターンとスタイル",
          teamId,
          chunkTypes: ["style", "expression", "correction"],
          limit: 5,
          logContext: "design",
        });

        // Batch strategy: 4 pages per batch, run batches in parallel
        const BATCH_SIZE = 4;
        const batches = chunkArray(pages, BATCH_SIZE);

        const batchResults = await Promise.all(
          batches.map((batch, batchIndex) =>
            generateBatch(
              batch,
              batchIndex * BATCH_SIZE,
              totalPages,
              signal,
              ragContext,
              {
                supabase,
                userId: user.id,
                teamId,
                projectId,
              }
            )
          )
        );

        // Flatten, re-index, and resolve icon placeholders
        let allSlides: HtmlSlide[] = resolveAllSlideIcons(
          batchResults.flat().map((slide, i) => ({ ...slide, index: i }))
        );

        // Generate and embed images (non-critical: continues without images on failure)
        try {
          allSlides = await generateAndEmbedImages(
            allSlides,
            teamId,
            projectId,
            signal
          );
        } catch (imgErr) {
          console.warn("[design] Image generation failed (non-critical):", imgErr);
        }

        // Build presentation data (include custom colors if set)
        const presentation: HtmlPresentation = {
          title: allSlides[0]?.title || "提案書",
          slides: allSlides,
          cssVersion: CSS_VERSION,
          ...(colorOverrides ? { colorOverrides } : {}),
        };

        // Save to DB (slide_data stores the HtmlPresentation)
        const { data: genFile } = await supabase
          .from("generated_files")
          .insert({
            project_id: projectId,
            file_type: "pdf",
            storage_path: "", // PDF is generated on-demand
            slide_data: presentation as unknown as Record<string, unknown>,
          })
          .select("id")
          .single();

        console.log(
          `[design] Generated ${allSlides.length} HTML slides for project ${projectId}`
        );

        return NextResponse.json({
          id: genFile?.id,
          slides: allSlides,
        });
      } finally {
        cleanup();
      }
    },
    {
      context: "design",
      fallbackMessage: "デザイン生成に失敗しました",
    }
  );
}
