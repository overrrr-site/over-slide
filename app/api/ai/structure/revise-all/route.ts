import { NextRequest, NextResponse } from "next/server";
import { assertInput, parseJsonBody } from "@/lib/api/validation";
import { opus } from "@/lib/ai/anthropic";
import { ANTHROPIC_PROMPT_CACHE_LONG } from "@/lib/ai/anthropic-cache";
import { cachedGenerateText } from "@/lib/ai/cached-generation";
import { extractAnthropicCacheMetrics } from "@/lib/ai/cache-metadata";
import { parseJsonObjectFromText } from "@/lib/ai/json-response";
import { compactJsonForPrompt } from "@/lib/ai/prompt-utils";
import { patchByPageNumber, type NumberedPatch } from "@/lib/ai/diff-patch";
import {
  findDuplicateRevisionResult,
  isLowSignalInstruction,
} from "@/lib/ai/pre-call-gate";
import { recordAiUsage } from "@/lib/ai/usage-logger";
import { STRUCTURE_PROMPT } from "@/lib/ai/prompts/structure";
import { requireAuth } from "@/lib/api/auth";
import { createTimeoutController } from "@/lib/api/abort";
import { getTeamIdForUser } from "@/lib/api/team";
import { withErrorHandling } from "@/lib/api/error";
import { buildRagContext } from "@/lib/knowledge/rag-context";

interface PageStructure {
  page_number: number;
  master_type: string;
  title: string;
  purpose: string;
  key_content: string;
  notes?: string;
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

      const pages = currentPages as PageStructure[];
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
        stepType: "structure",
        pageNumber: 0,
        instruction,
      });
      if (duplicate) {
        const originalPages = Array.isArray(duplicate.originalContent?.pages)
          ? (duplicate.originalContent.pages as unknown[])
          : null;
        const revisedPages = Array.isArray(duplicate.revisedContent?.pages)
          ? (duplicate.revisedContent.pages as PageStructure[])
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

      // Timeout: 120 seconds
      const { signal, cleanup } = createTimeoutController(120_000);

      try {
        const teamId = await getTeamIdForUser(supabase, user.id);
        const ragContext = await buildRagContext({
          query: instruction,
          teamId,
          chunkTypes: ["composition", "correction"],
          limit: 3,
          logContext: "structure/revise-all",
        });

        // Generate revised pages with AI (structure data is lightweight, no batching needed)
        const prompt = `## 現在の全ページ構成（${currentPages.length}ページ）
${compactJsonForPrompt(currentPages)}

## 全体修正指示
${instruction}

上記の修正指示に従って、必要なページだけ差分を作成してください。
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
        "master_type": "...",
        "title": "...",
        "purpose": "...",
        "key_content": "...",
        "notes": "..."
      }
    },
    ...
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
          endpoint: "/api/ai/structure/revise-all",
          modelName: "claude-opus-4-6",
          model: opus,
          system: STRUCTURE_PROMPT,
          prompt,
          abortSignal: signal,
          providerOptions: ANTHROPIC_PROMPT_CACHE_LONG,
          cacheMetadata: { patchMode: true },
        });
        const { cacheReadInputTokens, cacheCreationInputTokens } =
          extractAnthropicCacheMetrics(providerMetadata);

        await recordAiUsage({
          supabase,
          endpoint: "/api/ai/structure/revise-all",
          operation: "generateText",
          model: "claude-opus-4-6",
          userId: user.id,
          teamId,
          projectId,
          promptChars: prompt.length,
          completionChars: text.length,
          usage,
          metadata: {
            patchMode: true,
            cacheHit,
            cacheLayer,
            cacheKeyPrefix,
            cacheReadInputTokens,
            cacheCreationInputTokens,
            requestFingerprintVersion,
          },
        });

        let parsed: { patches?: NumberedPatch[] };
        try {
          parsed = parseJsonObjectFromText<{ patches?: NumberedPatch[] }>(text);
        } catch {
          return NextResponse.json(
            { error: "AIの応答からJSONを抽出できませんでした" },
            { status: 500 }
          );
        }

        if (!parsed.patches || !Array.isArray(parsed.patches)) {
          return NextResponse.json(
            { error: "AIの応答形式が不正です" },
            { status: 500 }
          );
        }

        const mergedPages = patchByPageNumber(pages, parsed.patches);
        const changedPageNumbers = new Set(
          parsed.patches
            .map((patch) =>
              typeof patch.page_number === "number" ? patch.page_number : null
            )
            .filter((num): num is number => num !== null)
        );

        // Get current structure
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

        // Update structures table
        const { error: updateErr } = await supabase
          .from("structures")
          .update({
            pages: mergedPages as unknown as Record<string, unknown>[],
          })
          .eq("id", structureData.id);

        if (updateErr) {
          console.error("[structure/revise-all] Update failed:", updateErr);
          return NextResponse.json(
            { error: `保存に失敗しました: ${updateErr.message}` },
            { status: 500 }
          );
        }

        // Save revision instruction history
        await supabase.from("revision_instructions").insert({
          project_id: projectId,
          step_type: "structure",
          page_number: 0, // 0 = global revision
          instruction,
          original_content: { pages } as unknown as Record<
            string,
            unknown
          >,
          revised_content: {
            pages: mergedPages,
            patches: parsed.patches,
          } as unknown as Record<string, unknown>,
        });

        console.log(
          `[structure/revise-all] Revised ${changedPageNumbers.size} pages for project ${projectId}`
        );

        return NextResponse.json({ revisedPages: mergedPages });
      } finally {
        cleanup();
      }
    },
    {
      context: "structure/revise-all",
      fallbackMessage: "全体修正に失敗しました",
    }
  );
}
