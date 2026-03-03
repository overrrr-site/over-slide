import { NextRequest, NextResponse } from "next/server";
import { assertInput, parseJsonBody } from "@/lib/api/validation";
import { generateText } from "ai";
import { sonnet } from "@/lib/ai/anthropic";
import { parseJsonObjectFromText } from "@/lib/ai/json-response";
import { compactJsonForPrompt } from "@/lib/ai/prompt-utils";
import { patchBySlideNumber, type NumberedPatch } from "@/lib/ai/diff-patch";
import {
  dedupeFeedbackItems,
  isLowSignalInstruction,
} from "@/lib/ai/pre-call-gate";
import { recordAiUsage } from "@/lib/ai/usage-logger";
import { DESIGN_HTML_PROMPT } from "@/lib/ai/prompts/design-html";
import { requireAuth } from "@/lib/api/auth";
import { createTimeoutController } from "@/lib/api/abort";
import { withErrorHandling } from "@/lib/api/error";
import type { HtmlSlide, HtmlPresentation } from "@/lib/slides/types";
import { resolveIconPlaceholders } from "@/lib/slides/icon-resolver";
import { chunkArray } from "@/lib/utils/array";

type FeedbackItem = {
  target_page?: number;
  description: string;
  suggestion?: string;
};

type SlideInput = {
  slideNumber: number;
  slideType: string;
  title: string;
  html: string;
};
type UsageLogContext = {
  supabase: unknown;
  userId: string;
  projectId: string;
};

/**
 * Process a batch of slides with feedback through AI.
 */
async function processBatch(
  batchSlides: SlideInput[],
  feedbackText: string,
  signal: AbortSignal,
  logContext: UsageLogContext
): Promise<NumberedPatch[]> {
  const slideNums = batchSlides.map((s) => `S${s.slideNumber}`).join(", ");
  const prompt = `## 修正対象のHTMLスライド（${batchSlides.length}枚分）
${compactJsonForPrompt(batchSlides)}

## デザインレビューフィードバック（採用済み指摘）
${feedbackText}

上記のフィードバックのうち、対象スライド ${slideNums} に関連する項目を反映してHTMLを改善してください。
必要な変更のみ差分として返してください。変更不要スライドは出力しないでください。
各差分は slideNumber と changes を含め、changes には変更するフィールド（html/slideType/title）のみを入れてください。
slideNumber は変更しないでください。
JSONのみ出力し、説明文は不要です。

出力形式:
{
  "patches": [
    {
      "slideNumber": 1,
      "changes": {
        "html": "...",
        "slideType": "...",
        "title": "..."
      }
    }
  ]
}`;

  const { text, usage } = await generateText({
    model: sonnet,
    system: DESIGN_HTML_PROMPT,
    prompt,
    maxOutputTokens: 16384,
    abortSignal: signal,
  });

  await recordAiUsage({
    supabase: logContext.supabase,
    endpoint: "/api/ai/design/apply-feedback",
    operation: "generateText",
    model: "claude-sonnet-4-5-20250929",
    userId: logContext.userId,
    projectId: logContext.projectId,
    promptChars: prompt.length,
    completionChars: text.length,
    usage,
    metadata: { slideNumbers: slideNums, patchMode: true },
  });

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`バッチ ${slideNums} のJSON抽出に失敗`);
  }

  let parsed: { patches?: NumberedPatch[] };
  try {
    parsed = parseJsonObjectFromText<{ patches?: NumberedPatch[] }>(jsonMatch[0]);
  } catch {
    throw new Error(`バッチ ${slideNums} のJSON抽出に失敗`);
  }

  if (!parsed.patches || !Array.isArray(parsed.patches)) {
    throw new Error(`バッチ ${slideNums} の差分配列が不正`);
  }

  return parsed.patches;
}

export async function POST(request: NextRequest) {
  return withErrorHandling(
    async () => {
      const auth = await requireAuth();
      if (auth instanceof Response) {
        return auth;
      }
      const { supabase, user } = auth;

      const { projectId, adoptedItems } = await parseJsonBody(request);

      assertInput(projectId && adoptedItems?.length, "Missing required fields");

      // Timeout: abort after 300 seconds (5 min)
      const { signal, cleanup } = createTimeoutController(300_000);

      try {
        // Get current slide data
        const { data: genFile, error: genErr } = await supabase
          .from("generated_files")
          .select("id, slide_data")
          .eq("project_id", projectId)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (genErr || !genFile) {
          return NextResponse.json(
            { error: "Generated slides not found" },
            { status: 404 }
          );
        }

        const presentation = genFile.slide_data as unknown as HtmlPresentation;
        if (!presentation.slides?.length) {
          return NextResponse.json(
            { error: "No slides found in generated data" },
            { status: 404 }
          );
        }

        // Save before state for comparison
        const beforeSlides = presentation.slides.map((s) => ({ ...s }));

        const feedbackItems = dedupeFeedbackItems(
          adoptedItems as FeedbackItem[]
        ).filter(
          (item) =>
            !isLowSignalInstruction(
              `${item.description} ${item.suggestion ?? ""}`
            )
        );

        if (feedbackItems.length === 0) {
          return NextResponse.json({
            beforeSlides,
            afterSlides: beforeSlides,
            skipped: true,
            reason: "low_signal_feedback",
          });
        }

        // Determine which slides are affected by feedback
        const affectedSlideNumbers = new Set<number>();
        const globalFeedback = feedbackItems.filter((item) => !item.target_page);

        for (const item of feedbackItems) {
          if (item.target_page) {
            affectedSlideNumbers.add(item.target_page);
          }
        }

        // Global feedback (no target_page) affects all slides
        if (globalFeedback.length > 0) {
          for (let i = 0; i < presentation.slides.length; i++) {
            affectedSlideNumbers.add(i + 1);
          }
        }

        // Build affected slides list
        const affectedSlides: SlideInput[] = presentation.slides
          .map((s, i) => ({
            slideNumber: i + 1,
            slideType: s.slideType || "content",
            title: s.title || `スライド ${i + 1}`,
            html: s.html || "",
          }))
          .filter((s) => affectedSlideNumbers.has(s.slideNumber));

        if (affectedSlides.length === 0) {
          return NextResponse.json({ beforeSlides, afterSlides: beforeSlides });
        }

        // Format all feedback text (shared across batches)
        const feedbackText = feedbackItems
          .map(
            (item, i) =>
              `${i + 1}. ${item.target_page ? `[スライド${item.target_page}] ` : "[全体] "}${item.description}${item.suggestion ? ` -> 提案: ${item.suggestion}` : ""}`
          )
          .join("\n");

        // Batch strategy: 4 slides per batch, run in parallel
        const BATCH_SIZE = 4;
        const batches = chunkArray(affectedSlides, BATCH_SIZE);

        console.log(
          `[design/apply-feedback] Processing ${affectedSlides.length}/${presentation.slides.length} slides in ${batches.length} batches for project ${projectId}`
        );

        const batchResults = await Promise.all(
          batches.map((batch) =>
            processBatch(batch, feedbackText, signal, {
              supabase,
              userId: user.id,
              projectId,
            })
          )
        );

        const allPatches = batchResults.flat();
        const changedSlideNumbers = new Set(
          allPatches
            .map((patch) =>
              typeof patch.slideNumber === "number" ? patch.slideNumber : null
            )
            .filter((num): num is number => num !== null)
        );
        const patchedSlides = patchBySlideNumber(
          presentation.slides.map((slide, index) => ({ ...slide, index })),
          allPatches,
          (_slide, index) => index + 1
        );

        const updatedSlides: HtmlSlide[] = patchedSlides.map((slide, index) => ({
          index,
          html: resolveIconPlaceholders(slide.html || ""),
          slideType: (slide.slideType || "content") as HtmlSlide["slideType"],
          title: slide.title || `スライド ${index + 1}`,
        }));

        if (changedSlideNumbers.size === 0) {
          return NextResponse.json({
            beforeSlides,
            afterSlides: beforeSlides,
            skipped: true,
            reason: "no_patch_changes",
          });
        }

        // Update presentation
        presentation.slides = updatedSlides;

        // Save to DB
        const { error: updateErr } = await supabase
          .from("generated_files")
          .update({
            slide_data: presentation as unknown as Record<string, unknown>,
          })
          .eq("id", genFile.id);

        if (updateErr) {
          console.error("[design/apply-feedback] Update failed:", updateErr);
          return NextResponse.json(
            { error: `DB保存に失敗しました: ${updateErr.message}` },
            { status: 500 }
          );
        }

        console.log(
          `[design/apply-feedback] Updated ${changedSlideNumbers.size} slides (${batches.length} batches) for project ${projectId}`
        );

        return NextResponse.json({
          beforeSlides,
          afterSlides: updatedSlides,
        });
      } finally {
        cleanup();
      }
    },
    {
      context: "design/apply-feedback",
      fallbackMessage: "フィードバックの反映に失敗しました",
    }
  );
}
