import { NextRequest, NextResponse } from "next/server";
import { parseJsonWithSchema } from "@/lib/api/validation";
import { generateObject } from "ai";
import { z } from "zod";
import { sonnet } from "@/lib/ai/anthropic";
import { recordAiUsage } from "@/lib/ai/usage-logger";
import { RESEARCH_QUERY_PROMPT } from "@/lib/ai/prompts/research";
import { requireAuth } from "@/lib/api/auth";
import { createTimeoutController } from "@/lib/api/abort";
import { withErrorHandling } from "@/lib/api/error";

/** キーワード候補の型定義（構造化出力用） */
const suggestKeywordsSchema = z.object({
  queries: z
    .array(
      z.object({
        query: z.string().describe("Web検索に適した検索クエリ文字列"),
        purpose: z.string().describe("このクエリで何を調べたいか（1文で）"),
      })
    )
    .describe("5〜15件の検索クエリリスト"),
});

const suggestKeywordsRequestSchema = z.object({
  projectId: z.string().min(1, "projectId is required"),
  briefSheet: z.string().optional(),
  researchTopics: z.string().optional(),
});

export async function POST(request: NextRequest) {
  return withErrorHandling(
    async () => {
      const auth = await requireAuth();
      if (auth instanceof Response) {
        return auth;
      }
      const { supabase, user } = auth;

      const { projectId, briefSheet, researchTopics } = await parseJsonWithSchema(
        request,
        suggestKeywordsRequestSchema
      );

      let briefMarkdown = typeof briefSheet === "string" ? briefSheet.trim() : "";

      if (!briefMarkdown) {
        // ブリーフシートを取得
        const { data: briefData } = await supabase
          .from("brief_sheets")
          .select("raw_markdown")
          .eq("project_id", projectId)
          .single();

        if (!briefData?.raw_markdown) {
          return NextResponse.json(
            { error: "ブリーフシートが見つかりません" },
            { status: 404 }
          );
        }

        briefMarkdown = briefData.raw_markdown;
      }

      const prompt = [
        "以下のブリーフシートをもとに、Web検索クエリを生成してください。",
        briefMarkdown,
        typeof researchTopics === "string" && researchTopics.trim()
          ? `特に以下の調査項目は、検索クエリに変換して優先的に含めてください:\n${researchTopics.trim()}`
          : "",
      ]
        .filter(Boolean)
        .join("\n\n");
      const { signal, cleanup } = createTimeoutController(60_000);

      try {
        const { object: result, usage } = await generateObject({
          model: sonnet,
          schema: suggestKeywordsSchema,
          system: RESEARCH_QUERY_PROMPT,
          prompt,
          maxOutputTokens: 4096,
          abortSignal: signal,
        });

        const promptChars =
          RESEARCH_QUERY_PROMPT.length + prompt.length;
        const completionChars = JSON.stringify(result).length;

        await recordAiUsage({
          supabase,
          endpoint: "/api/ai/suggest-keywords",
          operation: "generateText",
          model: "claude-sonnet-4-5-20250929",
          userId: user.id,
          projectId,
          promptChars,
          completionChars,
          usage,
        });

        return NextResponse.json(result);
      } finally {
        cleanup();
      }
    },
    {
      context: "suggest-keywords",
      fallbackMessage: "キーワード候補の生成に失敗しました",
    }
  );
}
