import { NextRequest, NextResponse } from "next/server";
import { assertInput, parseJsonBody } from "@/lib/api/validation";
import { sonnet } from "@/lib/ai/anthropic";
import { ANTHROPIC_PROMPT_CACHE_LONG } from "@/lib/ai/anthropic-cache";
import { cachedGenerateText } from "@/lib/ai/cached-generation";
import { extractAnthropicCacheMetrics } from "@/lib/ai/cache-metadata";
import { parseJsonObjectFromText } from "@/lib/ai/json-response";
import { compactJsonForPrompt } from "@/lib/ai/prompt-utils";
import {
  findDuplicateRevisionResult,
  isLowSignalInstruction,
} from "@/lib/ai/pre-call-gate";
import { recordAiUsage } from "@/lib/ai/usage-logger";
import { DESIGN_HTML_PROMPT } from "@/lib/ai/prompts/design-html";
import { requireAuth } from "@/lib/api/auth";
import { createTimeoutController } from "@/lib/api/abort";
import { getTeamIdForUser } from "@/lib/api/team";
import { withErrorHandling } from "@/lib/api/error";
import { buildRagContext } from "@/lib/knowledge/rag-context";
import { saveCorrectionChunk } from "@/lib/knowledge/correction-tracker";
import type { HtmlSlide, HtmlPresentation } from "@/lib/slides/types";
import { resolveIconPlaceholders } from "@/lib/slides/icon-resolver";

export async function POST(request: NextRequest) {
  return withErrorHandling(
    async () => {
      const auth = await requireAuth();
      if (auth instanceof Response) {
        return auth;
      }
      const { supabase, user } = auth;

      const { projectId, slideIndex, instruction, currentSlide } =
        await parseJsonBody(request);

      assertInput(
        projectId &&
          slideIndex !== undefined &&
          instruction &&
          currentSlide,
        "Missing required fields"
      );

      if (isLowSignalInstruction(instruction)) {
        return NextResponse.json({
          revisedSlide: currentSlide,
          skipped: true,
          reason: "low_signal_instruction",
        });
      }

      const pageNumber = Number(slideIndex) + 1;
      const duplicate = await findDuplicateRevisionResult({
        supabase,
        projectId,
        stepType: "design",
        pageNumber,
        instruction,
      });
      if (
        duplicate?.originalContent &&
        compactJsonForPrompt(duplicate.originalContent) ===
          compactJsonForPrompt(currentSlide)
      ) {
        return NextResponse.json({
          revisedSlide: duplicate.revisedContent,
          reused: true,
          reason: "duplicate_instruction",
        });
      }

      // Timeout: 60 seconds for single slide revision
      const { signal, cleanup } = createTimeoutController(60_000);

      try {
        const teamId = await getTeamIdForUser(supabase, user.id);
        const ragContext = await buildRagContext({
          query: instruction,
          teamId,
          chunkTypes: ["correction"],
          limit: 3,
          logContext: "design/revise",
        });

        // Generate revised HTML slide with AI
        const prompt = `## 修正対象スライド（現在のHTML）
\`\`\`html
${currentSlide.html || ""}
\`\`\`

スライドタイプ: ${currentSlide.slideType || "content"}
タイトル: ${currentSlide.title || ""}

## 修正指示
${instruction}

上記の修正指示に従って、このスライドのHTMLを修正してください。
修正した1枚分のスライドをJSON形式で出力してください。

出力形式:
{
  "slides": [
    {
      "slideType": "...",
      "title": "...",
      "html": "<div class=\\"slide ...\\">...</div>"
    }
  ]
}${ragContext}`;

        const {
          text,
          usage,
          providerMetadata,
          cacheHit,
          cacheLayer,
          cacheKeyPrefix,
          requestFingerprintVersion,
        } = await cachedGenerateText({
          supabase,
          teamId,
          endpoint: "/api/ai/design/revise",
          modelName: "claude-sonnet-4-5-20250929",
          model: sonnet,
          system: DESIGN_HTML_PROMPT,
          prompt,
          maxOutputTokens: 4096,
          abortSignal: signal,
          providerOptions: ANTHROPIC_PROMPT_CACHE_LONG,
          cacheMetadata: { slideNumber: pageNumber },
        });
        const { cacheReadInputTokens, cacheCreationInputTokens } =
          extractAnthropicCacheMetrics(providerMetadata);

        await recordAiUsage({
          supabase,
          endpoint: "/api/ai/design/revise",
          operation: "generateText",
          model: "claude-sonnet-4-5-20250929",
          userId: user.id,
          teamId,
          projectId,
          promptChars: prompt.length,
          completionChars: text.length,
          usage,
          metadata: {
            slideNumber: pageNumber,
            cacheHit,
            cacheLayer,
            cacheKeyPrefix,
            cacheReadInputTokens,
            cacheCreationInputTokens,
            requestFingerprintVersion,
          },
        });

        let parsed: {
          slides?: Array<{ slideType?: string; title?: string; html?: string }>;
        };
        try {
          parsed = parseJsonObjectFromText<{
            slides?: Array<{ slideType?: string; title?: string; html?: string }>;
          }>(text);
        } catch {
          return NextResponse.json(
            { error: "AIの応答からHTMLを抽出できませんでした" },
            { status: 500 }
          );
        }

        const revisedSlideData = parsed.slides?.[0];
        if (!revisedSlideData) {
          return NextResponse.json(
            { error: "修正スライドの解析に失敗しました" },
            { status: 500 }
          );
        }

        const revisedSlide: HtmlSlide = {
          index: slideIndex,
          html: resolveIconPlaceholders(revisedSlideData.html || ""),
          slideType: (revisedSlideData.slideType ||
            currentSlide.slideType ||
            "content") as HtmlSlide["slideType"],
          title:
            revisedSlideData.title ||
            currentSlide.title ||
            `スライド ${slideIndex + 1}`,
        };

        // Get latest generated file
        const { data: genFile, error: genErr } = await supabase
          .from("generated_files")
          .select("id, slide_data")
          .eq("project_id", projectId)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (genErr || !genFile) {
          return NextResponse.json(
            { error: "Generated file not found" },
            { status: 404 }
          );
        }

        // Replace the target slide in slide_data
        const presentation = genFile.slide_data as unknown as HtmlPresentation;
        if (presentation.slides && slideIndex < presentation.slides.length) {
          presentation.slides[slideIndex] = revisedSlide;
        }

        // Update generated_files table
        const { error: updateErr } = await supabase
          .from("generated_files")
          .update({
            slide_data: presentation as unknown as Record<string, unknown>,
          })
          .eq("id", genFile.id);

        if (updateErr) {
          console.error("[design/revise] Update failed:", updateErr);
          return NextResponse.json(
            { error: "修正の保存に失敗しました" },
            { status: 500 }
          );
        }

        // Save revision instruction history
        await supabase.from("revision_instructions").insert({
          project_id: projectId,
          step_type: "design",
          page_number: slideIndex + 1,
          instruction,
          original_content: currentSlide,
          revised_content: revisedSlide,
        });

        // Save as correction learning chunk (non-blocking)
        if (teamId) {
          saveCorrectionChunk({
            teamId,
            userId: user.id,
            stepType: "design",
            pageNumber: slideIndex + 1,
            instruction,
            originalContent: currentSlide,
            revisedContent: revisedSlide as unknown as Record<string, unknown>,
          }).catch(() => {});
        }

        console.log(
          `[design/revise] Revised slide ${slideIndex} for project ${projectId}`
        );

        return NextResponse.json({ revisedSlide, reused: cacheHit });
      } finally {
        cleanup();
      }
    },
    {
      context: "design/revise",
      fallbackMessage: "スライドの修正に失敗しました",
    }
  );
}
