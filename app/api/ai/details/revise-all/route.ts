import { NextRequest, NextResponse } from "next/server";
import { assertInput, parseJsonBody } from "@/lib/api/validation";
import { generateText } from "ai";
import { sonnet } from "@/lib/ai/anthropic";
import { parseJsonObjectFromText } from "@/lib/ai/json-response";
import { compactJsonForPrompt } from "@/lib/ai/prompt-utils";
import { patchByPageNumber, type NumberedPatch } from "@/lib/ai/diff-patch";
import {
  findDuplicateRevisionResult,
  isLowSignalInstruction,
} from "@/lib/ai/pre-call-gate";
import { recordAiUsage } from "@/lib/ai/usage-logger";
import { DETAILS_PROMPT } from "@/lib/ai/prompts/details";
import { requireAuth } from "@/lib/api/auth";
import { createTimeoutController } from "@/lib/api/abort";
import { getTeamIdForUser } from "@/lib/api/team";
import { withErrorHandling } from "@/lib/api/error";
import { buildRagContext } from "@/lib/knowledge/rag-context";
import { chunkArray } from "@/lib/utils/array";

type PageContent = { page_number: number; [key: string]: unknown };
type UsageLogContext = {
  supabase: unknown;
  userId: string;
  projectId: string;
  teamId?: string | null;
};

/**
 * Process a batch of pages with a global revision instruction.
 */
async function reviseBatch(
  batchPages: PageContent[],
  instruction: string,
  ragContext: string,
  signal: AbortSignal,
  logContext: UsageLogContext
): Promise<NumberedPatch[]> {
  const pageNums = batchPages.map((p) => `P${p.page_number}`).join(", ");
  const prompt = `## 修正対象のページ詳細（${batchPages.length}ページ分）
${compactJsonForPrompt(batchPages)}

## 全体修正指示
${instruction}

上記の修正指示に従って、対象ページ ${pageNums} の詳細コンテンツを修正してください。
変更が必要なフィールドだけ差分として返してください。
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
    }
  ]
}${ragContext}`;

  const { text, usage } = await generateText({
    model: sonnet,
    system: DETAILS_PROMPT,
    prompt,
    maxOutputTokens: 16384,
    abortSignal: signal,
  });

  await recordAiUsage({
    supabase: logContext.supabase,
    endpoint: "/api/ai/details/revise-all",
    operation: "generateText",
    model: "claude-sonnet-4-5-20250929",
    userId: logContext.userId,
    projectId: logContext.projectId,
    teamId: logContext.teamId,
    promptChars: prompt.length,
    completionChars: text.length,
    usage,
    metadata: { pageNumbers: pageNums, patchMode: true },
  });

  let parsed: { patches?: NumberedPatch[] };
  try {
    parsed = parseJsonObjectFromText<{ patches?: NumberedPatch[] }>(text);
  } catch {
    throw new Error(`バッチ ${pageNums} のJSON抽出に失敗`);
  }

  if (!parsed.patches || !Array.isArray(parsed.patches)) {
    throw new Error(`バッチ ${pageNums} の差分配列が不正`);
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

      const { projectId, instruction, currentPages } = await parseJsonBody(request);

      assertInput(
        projectId && instruction && currentPages?.length,
        "Missing required fields"
      );

      const pages = currentPages as PageContent[];
      if (isLowSignalInstruction(instruction)) {
        return NextResponse.json({
          revisedPages: pages,
          skipped: true,
          reason: "low_signal_instruction",
        });
      }

      const duplicate = await findDuplicateRevisionResult({
        supabase,
        projectId,
        stepType: "details",
        pageNumber: 0,
        instruction,
      });
      if (duplicate) {
        const originalPages = Array.isArray(duplicate.originalContent?.pages)
          ? (duplicate.originalContent.pages as unknown[])
          : null;
        const revisedPages = Array.isArray(duplicate.revisedContent?.pages)
          ? (duplicate.revisedContent.pages as PageContent[])
          : null;

        if (
          originalPages &&
          revisedPages &&
          compactJsonForPrompt(originalPages) === compactJsonForPrompt(pages)
        ) {
          return NextResponse.json({
            revisedPages,
            reused: true,
            reason: "duplicate_instruction",
          });
        }
      }

      // Timeout: 300 seconds (5 min)
      const { signal, cleanup } = createTimeoutController(300_000);

      try {
        const teamId = await getTeamIdForUser(supabase, user.id);
        const ragContext = await buildRagContext({
          query: instruction,
          teamId,
          chunkTypes: ["correction", "style", "expression"],
          limit: 5,
          logContext: "details/revise-all",
        });

        // Batch strategy: 4 pages per batch, run in parallel
        const BATCH_SIZE = 4;
        const batches = chunkArray(pages, BATCH_SIZE);

        console.log(
          `[details/revise-all] Processing ${pages.length} pages in ${batches.length} batches for project ${projectId}`
        );

        const batchResults = await Promise.all(
          batches.map((batch) =>
            reviseBatch(batch, instruction, ragContext, signal, {
              supabase,
              userId: user.id,
              projectId,
              teamId,
            })
          )
        );

        const allPatches = batchResults.flat();
        const mergedPages = patchByPageNumber(pages, allPatches);
        const changedPageNumbers = new Set(
          allPatches
            .map((patch) =>
              typeof patch.page_number === "number" ? patch.page_number : null
            )
            .filter((num): num is number => num !== null)
        );

        // Get structure ID for upsert
        const { data: structureData, error: structErr } = await supabase
          .from("structures")
          .select("id")
          .eq("project_id", projectId)
          .order("version", { ascending: false })
          .limit(1)
          .single();

        if (structErr || !structureData) {
          return NextResponse.json(
            { error: "構成データが見つかりません" },
            { status: 404 }
          );
        }

        // Upsert all revised page_contents
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
            console.error("[details/revise-all] Upsert failed:", upsertErr);
            return NextResponse.json(
              { error: `保存に失敗しました: ${upsertErr.message}` },
              { status: 500 }
            );
          }
        }

        // Save revision instruction history
        await supabase.from("revision_instructions").insert({
          project_id: projectId,
          step_type: "details",
          page_number: 0, // 0 = global revision
          instruction,
          original_content: { pages } as unknown as Record<string, unknown>,
          revised_content: {
            pages: mergedPages,
            patches: allPatches,
          } as unknown as Record<string, unknown>,
        });

        console.log(
          `[details/revise-all] Revised ${changedPageNumbers.size} pages (${batches.length} batches) for project ${projectId}`
        );

        return NextResponse.json({ revisedPages: mergedPages });
      } finally {
        cleanup();
      }
    },
    {
      context: "details/revise-all",
      fallbackMessage: "全体修正に失敗しました",
    }
  );
}
