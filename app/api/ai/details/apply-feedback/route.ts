import { NextRequest, NextResponse } from "next/server";
import { assertInput, parseJsonBody } from "@/lib/api/validation";
import { generateText } from "ai";
import { sonnet } from "@/lib/ai/anthropic";
import { compactJsonForPrompt } from "@/lib/ai/prompt-utils";
import { patchByPageNumber, type NumberedPatch } from "@/lib/ai/diff-patch";
import {
  dedupeFeedbackItems,
  isLowSignalInstruction,
} from "@/lib/ai/pre-call-gate";
import { recordAiUsage } from "@/lib/ai/usage-logger";
import { DETAILS_PROMPT, DOCUMENT_DETAILS_PROMPT } from "@/lib/ai/prompts/details";
import { requireAuth } from "@/lib/api/auth";
import { createTimeoutController } from "@/lib/api/abort";
import { withErrorHandling } from "@/lib/api/error";

interface FeedbackItem {
  target_page?: number;
  description: string;
  suggestion?: string;
}

/**
 * Clean common JSON issues from AI output.
 */
function cleanJson(raw: string): string {
  return raw
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "")
    .replace(/,\s*([}\]])/g, "$1");
}

/**
 * Robust JSON parse with multiple fallback strategies.
 */
function robustJsonParse(raw: string): unknown {
  const cleaned = cleanJson(raw);

  // Strategy 1: Direct parse
  try {
    return JSON.parse(cleaned);
  } catch {
    // continue
  }

  // Strategy 2: Fix unescaped newlines/tabs in string values
  try {
    const fixed = cleaned.replace(
      /"((?:[^"\\]|\\.)*)"/g,
      (_match: string, content: string) => {
        const escaped = content
          .replace(/(?<!\\)\n/g, "\\n")
          .replace(/(?<!\\)\r/g, "\\r")
          .replace(/(?<!\\)\t/g, "\\t");
        return `"${escaped}"`;
      }
    );
    return JSON.parse(fixed);
  } catch {
    // continue
  }

  // Strategy 3: Truncation recovery (close open brackets)
  try {
    let recovery = cleaned;
    const opens = (recovery.match(/\[/g) || []).length;
    const closes = (recovery.match(/\]/g) || []).length;
    const openBraces = (recovery.match(/\{/g) || []).length;
    const closeBraces = (recovery.match(/\}/g) || []).length;

    recovery = recovery.replace(/,\s*"[^"]*"?\s*:?\s*[^,}\]]*$/, "");
    recovery = recovery.replace(/,\s*$/, "");

    for (let i = 0; i < opens - closes; i++) recovery += "]";
    for (let i = 0; i < openBraces - closeBraces; i++) recovery += "}";

    console.warn("[apply-feedback] JSON was truncated, recovered with bracket closure");
    return JSON.parse(recovery);
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    throw new Error(`AIの応答JSONの解析に失敗しました: ${errMsg}`);
  }
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

      // Timeout: 300 seconds (5 min)
      const { signal, cleanup } = createTimeoutController(300_000);

      try {
        // Get current structure and page contents + output_type
        const [{ data: structureData }, { data: projectData }] =
          await Promise.all([
            supabase
              .from("structures")
              .select("id, pages")
              .eq("project_id", projectId)
              .order("version", { ascending: false })
              .limit(1)
              .single(),
            supabase
              .from("projects")
              .select("output_type")
              .eq("id", projectId)
              .single(),
          ]);

        const outputType = projectData?.output_type || "slide";

        if (!structureData) {
          return NextResponse.json(
            { error: "構成データが見つかりません" },
            { status: 404 }
          );
        }

        const { data: contents } = await supabase
          .from("page_contents")
          .select("page_number, content")
          .eq("structure_id", structureData.id)
          .order("page_number");

        const currentPages = (contents?.map((c) => c.content) || []) as Array<{
          page_number: number;
          [key: string]: unknown;
        }>;

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
            pages: currentPages,
            skipped: true,
            reason: "low_signal_feedback",
          });
        }

        // Group feedback by target page
        const affectedPageNumbers = new Set<number>();
        for (const item of feedbackItems) {
          if (item.target_page) {
            affectedPageNumbers.add(item.target_page);
          }
        }

        // Items without target_page affect all pages
        const globalFeedback = feedbackItems.filter((item) => !item.target_page);
        if (globalFeedback.length > 0) {
          // If there's global feedback, mark all pages as affected
          for (const page of currentPages) {
            if (page.page_number) affectedPageNumbers.add(page.page_number);
          }
        }

        // Only send affected pages to AI (saves tokens + time)
        const affectedPages = currentPages.filter((p) =>
          affectedPageNumbers.has(p.page_number)
        );

        if (affectedPages.length === 0) {
          return NextResponse.json({ pages: currentPages });
        }

        const feedbackText = feedbackItems
          .map(
            (item, i) =>
              `${i + 1}. ${item.target_page ? `[P${item.target_page}] ` : ""}${item.description}${item.suggestion ? ` → 提案: ${item.suggestion}` : ""}`
          )
          .join("\n");

        console.log(
          `[apply-feedback] Processing ${affectedPages.length}/${currentPages.length} pages for project ${projectId}`
        );

        // Only regenerate affected pages
        const prompt = `## 改善対象のページコンテンツ（${affectedPages.length}ページ分）
${compactJsonForPrompt(affectedPages)}

## レビューフィードバック（採用済み指摘）
${feedbackText}

上記のレビューフィードバックを反映し、該当ページに必要な変更のみ差分として返してください。
変更不要ページは出力しないでください。
各差分は page_number と changes を含め、changes には変更するフィールドのみを入れてください。
page_number は変更しないでください。
JSONのみ出力し、説明文は不要です。

出力形式:
{
  "patches": [
    {
      "page_number": 1,
      "changes": {
        "title": "...",
        "body": "...",
        "bullets": [...]
      }
    },
    ...
  ]
}`;

        const { text, usage } = await generateText({
          model: sonnet,
          system: outputType === "document" ? DOCUMENT_DETAILS_PROMPT : DETAILS_PROMPT,
          prompt,
          maxOutputTokens: 16384,
          abortSignal: signal,
        });

        await recordAiUsage({
          supabase,
          endpoint: "/api/ai/details/apply-feedback",
          operation: "generateText",
          model: "claude-sonnet-4-5-20250929",
          userId: user.id,
          projectId,
          promptChars: prompt.length,
          completionChars: text.length,
          usage,
          metadata: {
            affectedPages: affectedPages.length,
            feedbackItems: feedbackItems.length,
            patchMode: true,
          },
        });

        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          return NextResponse.json(
            { error: "AIの応答からJSONを抽出できませんでした" },
            { status: 500 }
          );
        }

        const parsed = robustJsonParse(jsonMatch[0]) as {
          patches?: NumberedPatch[];
        };

        if (!parsed.patches || !Array.isArray(parsed.patches)) {
          return NextResponse.json(
            { error: "AIの応答形式が不正です（patchesが見つかりません）" },
            { status: 500 }
          );
        }

        const mergedPages = patchByPageNumber(currentPages, parsed.patches);
        const changedPageNumbers = new Set(
          parsed.patches
            .map((patch) =>
              typeof patch.page_number === "number" ? patch.page_number : null
            )
            .filter((num): num is number => num !== null)
        );

        const rows = mergedPages
          .filter((page) => changedPageNumbers.has(page.page_number))
          .map((page) => ({
            structure_id: structureData.id,
            page_number: page.page_number,
            content: page,
          }));

        if (rows.length > 0) {
          const { error: upsertErr } = await supabase
            .from("page_contents")
            .upsert(rows, { onConflict: "structure_id,page_number" });

          if (upsertErr) {
            console.error("[apply-feedback] Upsert failed:", upsertErr);
            return NextResponse.json(
              { error: `DB保存に失敗しました: ${upsertErr.message}` },
              { status: 500 }
            );
          }
        }

        console.log(
          `[apply-feedback] Updated ${changedPageNumbers.size} pages for project ${projectId}`
        );

        return NextResponse.json({ pages: mergedPages });
      } finally {
        cleanup();
      }
    },
    {
      context: "details/apply-feedback",
      fallbackMessage: "フィードバックの反映に失敗しました",
    }
  );
}
